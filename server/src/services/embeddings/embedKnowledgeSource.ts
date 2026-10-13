import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';
import { getEmbeddingProvider } from './provider.js';

const MAX_EMBEDDING_BATCH_SIZE = 16;
const MAX_EMBEDDING_BATCH_CHARS = 24_000;
const MAX_EMBEDDING_DIMENSIONS = 4_096;

type ChunkWithEmbedding = { id: string; content: string; contentHash: string; embedding: { provider: string; model: string; dimensions: number; values: unknown; contentHash: string } | null };
function validVector(value: unknown, expectedDimensions?: number): value is number[] {
  return Array.isArray(value) && value.length > 0 && value.length <= MAX_EMBEDDING_DIMENSIONS && (expectedDimensions === undefined || (expectedDimensions > 0 && value.length === expectedDimensions)) && value.every((item) => typeof item === 'number' && Number.isFinite(item));
}
function batches<T extends { content: string }>(items: T[]): T[][] {
  const result: T[][] = []; let current: T[] = []; let chars = 0;
  for (const item of items) {
    if (item.content.length > MAX_EMBEDDING_BATCH_CHARS) throw new AppError(413, 'A knowledge chunk exceeds the embedding input limit.');
    if (current.length === MAX_EMBEDDING_BATCH_SIZE || chars + item.content.length > MAX_EMBEDDING_BATCH_CHARS) { result.push(current); current = []; chars = 0; }
    current.push(item); chars += item.content.length;
  }
  if (current.length) result.push(current);
  return result;
}
async function loadCurrentSource(id: string) {
  const source = await getPrisma().knowledgeSource.findUnique({ where: { id }, select: { id: true, ingestedContentHash: true, chunks: { orderBy: { chunkIndex: 'asc' }, include: { embedding: true } } } });
  if (!source) throw new AppError(404, 'Knowledge source not found.');
  if (!source.ingestedContentHash) throw new AppError(409, 'Knowledge source must be ingested before it can be embedded.');
  return source;
}
export async function embedKnowledgeSource(id: string) {
  const provider = getEmbeddingProvider(); const availability = provider.availability();
  if (!availability.available) throw new AppError(503, availability.reason ?? 'Semantic search is unavailable.');
  const source = await loadCurrentSource(id); const chunks = source.chunks as ChunkWithEmbedding[];
  const pending = chunks.filter((chunk) => !chunk.embedding || chunk.embedding.provider !== provider.id || chunk.embedding.model !== provider.model || chunk.embedding.dimensions !== provider.dimensions && provider.dimensions !== undefined || chunk.embedding.contentHash !== chunk.contentHash || !validVector(chunk.embedding.values, chunk.embedding.dimensions));
  let embeddedCount = 0;
  for (const batch of batches(pending)) {
    const vectors = await provider.embed(batch.map((chunk) => chunk.content), 'RETRIEVAL_DOCUMENT');
    if (vectors.length !== batch.length || vectors.some((vector) => !validVector(vector, provider.dimensions))) throw new AppError(502, 'The embedding provider returned invalid numeric vectors.');
    const dimensions = vectors[0]?.length;
    if (!dimensions || vectors.some((vector) => vector.length !== dimensions)) throw new AppError(502, 'The embedding provider returned incompatible vector dimensions.');
    await getPrisma().$transaction(batch.map((chunk, index) => getPrisma().knowledgeChunkEmbedding.upsert({ where: { chunkId: chunk.id }, create: { chunkId: chunk.id, provider: provider.id, model: provider.model, dimensions, values: vectors[index]!, contentHash: chunk.contentHash }, update: { provider: provider.id, model: provider.model, dimensions, values: vectors[index]!, contentHash: chunk.contentHash, embeddedAt: new Date() } })));
    embeddedCount += batch.length;
  }
  return { knowledgeSourceId: id, status: 'COMPLETED', chunkCount: chunks.length, embeddedCount, cachedCount: chunks.length - pending.length, provider: provider.id, model: provider.model };
}
export async function getEmbeddingStatus(id: string) {
  const provider = getEmbeddingProvider(); const availability = provider.availability();
  const source = await getPrisma().knowledgeSource.findUnique({ where: { id }, select: { id: true, ingestedContentHash: true, chunks: { select: { contentHash: true, embedding: { select: { provider: true, model: true, dimensions: true, values: true, contentHash: true } } } } } });
  if (!source) throw new AppError(404, 'Knowledge source not found.');
  const totalChunks = source.chunks.length;
  const currentEmbeddingCount = source.chunks.filter((chunk) => { const embedding = chunk.embedding; return !!embedding && embedding.provider === provider.id && embedding.model === provider.model && (provider.dimensions === undefined || embedding.dimensions === provider.dimensions) && embedding.contentHash === chunk.contentHash && validVector(embedding.values, embedding.dimensions); }).length;
  const status = !source.ingestedContentHash ? 'NOT_INGESTED' : !availability.available ? 'UNAVAILABLE' : currentEmbeddingCount === totalChunks ? 'COMPLETED' : currentEmbeddingCount === 0 ? 'NOT_EMBEDDED' : 'PARTIAL';
  return { knowledgeSourceId: id, status, totalChunks, currentEmbeddingCount, provider: provider.id, model: provider.model, available: availability.available, reason: availability.reason };
}
export { validVector, MAX_EMBEDDING_BATCH_SIZE };
