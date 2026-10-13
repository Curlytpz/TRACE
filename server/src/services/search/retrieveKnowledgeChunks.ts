import { Prisma } from '@prisma/client';
import { getPrisma } from '../../db.js';
import { AppError } from '../../errors.js';

export type SearchInput = { query: string; investigationId?: string; page: number; limit: number };
export type KeywordSearchResult = { chunkId: string; knowledgeSourceId: string; sourceTitle: string; chunkIndex: number; content: string; sectionHeading: string | null; score: number; startOffset: number; endOffset: number };

export function normalizeSearchQuery(query: string): string {
  const normalized = query.trim().replace(/\s+/g, ' ');
  if (!/[\p{L}\p{N}]/u.test(normalized)) throw new AppError(400, 'Search query must include at least one letter or number.');
  return normalized;
}

async function assertInvestigationExists(investigationId?: string) {
  if (!investigationId) return;
  const investigation = await getPrisma().investigation.findUnique({ where: { id: investigationId }, select: { id: true } });
  if (!investigation) throw new AppError(404, 'Investigation not found.');
}

async function findKeywordResults(input: SearchInput, take: number, skip: number) {
  const query = normalizeSearchQuery(input.query);
  const prisma = getPrisma();
  await assertInvestigationExists(input.investigationId);
  const scope = input.investigationId ? Prisma.sql`AND EXISTS (SELECT 1 FROM "InvestigationEvidence" e WHERE e."knowledgeSourceId" = c."knowledgeSourceId" AND e."investigationId" = ${input.investigationId}::uuid)` : Prisma.empty;
  const [results, counts] = await Promise.all([
    prisma.$queryRaw<KeywordSearchResult[]>(Prisma.sql`SELECT c."id" AS "chunkId", c."knowledgeSourceId", s."title" AS "sourceTitle", c."chunkIndex", c."content", c."sectionHeading", ts_rank_cd(to_tsvector('simple', c."content"), websearch_to_tsquery('simple', ${query}))::float8 AS "score", c."startOffset", c."endOffset" FROM "KnowledgeChunk" c JOIN "KnowledgeSource" s ON s."id" = c."knowledgeSourceId" WHERE s."ingestedContentHash" IS NOT NULL AND to_tsvector('simple', c."content") @@ websearch_to_tsquery('simple', ${query}) ${scope} ORDER BY "score" DESC, c."knowledgeSourceId" ASC, c."chunkIndex" ASC, c."id" ASC LIMIT ${take} OFFSET ${skip}`),
    prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`SELECT count(*)::bigint AS "total" FROM "KnowledgeChunk" c JOIN "KnowledgeSource" s ON s."id" = c."knowledgeSourceId" WHERE s."ingestedContentHash" IS NOT NULL AND to_tsvector('simple', c."content") @@ websearch_to_tsquery('simple', ${query}) ${scope}`),
  ]);
  return { query, results, total: Number(counts[0]?.total ?? 0) };
}

/** Bounded top-ranked keyword window used by hybrid retrieval. */
export async function retrieveKeywordCandidates(input: SearchInput, candidateLimit: number) {
  return findKeywordResults(input, candidateLimit, 0);
}

export async function retrieveKnowledgeChunks(input: SearchInput) {
  const { query, results, total } = await findKeywordResults(input, input.limit, (input.page - 1) * input.limit);
  return { query, results, pagination: { total, page: input.page, limit: input.limit, totalPages: Math.ceil(total / input.limit) } };
}
