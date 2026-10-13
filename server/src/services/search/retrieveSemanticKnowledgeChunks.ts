import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { getEmbeddingProvider } from '../embeddings/provider.js';
import { validVector } from '../embeddings/embedKnowledgeSource.js';
import { normalizeSearchQuery } from './retrieveKnowledgeChunks.js';

const MAX_SEMANTIC_CANDIDATES = 1_000;
export type SemanticSearchInput = { query: string; investigationId?: string; page: number; limit: number };
export type SemanticSearchResult = { chunkId: string; knowledgeSourceId: string; sourceTitle: string; chunkIndex: number; content: string; sectionHeading: string | null; score: number; startOffset: number; endOffset: number };
export type SemanticCandidateResponse = { query: string; results: SemanticSearchResult[]; coverage: { totalCurrentChunks: number; compatibleEmbeddedChunks: number; complete: boolean; candidateLimit: number; provider: string; model: string } };

function cosineSimilarity(a: number[], b: number[]): number { let dot = 0; let aNorm = 0; let bNorm = 0; for (let index = 0; index < a.length; index += 1) { const left = a[index]!; const right = b[index]!; dot += left * right; aNorm += left * left; bNorm += right * right; } if (aNorm === 0 || bNorm === 0) throw new AppError(409, 'Stored embeddings contain a zero vector and must be regenerated.'); return dot / Math.sqrt(aNorm * bNorm); }

/** Returns all bounded, ranked semantic candidates before endpoint pagination. */
export async function retrieveSemanticCandidates(input: SemanticSearchInput): Promise<SemanticCandidateResponse> {
  const query = normalizeSearchQuery(input.query); const prisma = getPrisma(); const provider = getEmbeddingProvider(); const availability = provider.availability();
  if (!availability.available) throw new AppError(503, availability.reason ?? 'Semantic search is unavailable.');
  if (input.investigationId && !await prisma.investigation.findUnique({ where: { id: input.investigationId }, select: { id: true } })) throw new AppError(404, 'Investigation not found.');
  const sourceScope = input.investigationId ? { evidence: { some: { investigationId: input.investigationId } } } : undefined;
  const [totalCurrentChunks, candidates] = await Promise.all([
    prisma.knowledgeChunk.count({ where: { knowledgeSource: { ingestedContentHash: { not: null }, ...(sourceScope ?? {}) } } }),
    prisma.knowledgeChunk.findMany({ where: { knowledgeSource: { ingestedContentHash: { not: null }, ...(sourceScope ?? {}) }, embedding: { is: { provider: provider.id, model: provider.model } } }, orderBy: [{ knowledgeSourceId: 'asc' }, { chunkIndex: 'asc' }, { id: 'asc' }], take: MAX_SEMANTIC_CANDIDATES + 1, include: { knowledgeSource: { select: { title: true } }, embedding: true } }),
  ]);
  if (candidates.length > MAX_SEMANTIC_CANDIDATES) throw new AppError(409, `Semantic search has more than ${MAX_SEMANTIC_CANDIDATES} eligible embeddings. Narrow the investigation scope before searching; no partial ranking was returned.`);
  const vectors = await provider.embed([query], 'RETRIEVAL_QUERY'); const queryVector = vectors[0];
  if (!queryVector || !validVector(queryVector, provider.dimensions) || vectors.length !== 1) throw new AppError(502, 'The embedding provider returned an invalid query vector.');
  const compatible = candidates.map((chunk) => ({ chunk, embedding: chunk.embedding! })).filter(({ chunk, embedding }) => embedding.contentHash === chunk.contentHash && embedding.dimensions === queryVector.length && (provider.dimensions === undefined || embedding.dimensions === provider.dimensions) && validVector(embedding.values, embedding.dimensions));
  const results = compatible.map(({ chunk, embedding }) => ({ chunkId: chunk.id, knowledgeSourceId: chunk.knowledgeSourceId, sourceTitle: chunk.knowledgeSource.title, chunkIndex: chunk.chunkIndex, content: chunk.content, sectionHeading: chunk.sectionHeading, score: cosineSimilarity(queryVector, embedding.values as number[]), startOffset: chunk.startOffset, endOffset: chunk.endOffset })).sort((left, right) => right.score - left.score || left.knowledgeSourceId.localeCompare(right.knowledgeSourceId) || left.chunkIndex - right.chunkIndex || left.chunkId.localeCompare(right.chunkId));
  return { query, results, coverage: { totalCurrentChunks, compatibleEmbeddedChunks: results.length, complete: results.length === totalCurrentChunks, candidateLimit: MAX_SEMANTIC_CANDIDATES, provider: provider.id, model: provider.model } };
}

export async function retrieveSemanticKnowledgeChunks(input: SemanticSearchInput) {
  const { query, results, coverage } = await retrieveSemanticCandidates(input); const offset = (input.page - 1) * input.limit;
  return { query, results: results.slice(offset, offset + input.limit), pagination: { total: results.length, page: input.page, limit: input.limit, totalPages: Math.ceil(results.length / input.limit) }, coverage };
}
export { cosineSimilarity, MAX_SEMANTIC_CANDIDATES };
