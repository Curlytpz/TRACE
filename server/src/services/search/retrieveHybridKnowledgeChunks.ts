import { AppError } from '../../errors.js';
import { retrieveKeywordCandidates } from './retrieveKnowledgeChunks.js';
import type { KeywordSearchResult, SearchInput } from './retrieveKnowledgeChunks.js';
import { retrieveSemanticCandidates } from './retrieveSemanticKnowledgeChunks.js';
import type { SemanticSearchResult } from './retrieveSemanticKnowledgeChunks.js';

export const HYBRID_RRF_K = 60;
export const HYBRID_CANDIDATE_WINDOW = 100;
type RankedResult = KeywordSearchResult | SemanticSearchResult;
export type HybridResult = { chunkId: string; knowledgeSourceId: string; sourceTitle: string; chunkIndex: number; content: string; sectionHeading: string | null; startOffset: number; endOffset: number; keywordRank: number | null; semanticRank: number | null; keywordScore: number | null; semanticScore: number | null; fusionScore: number };

function compareHybrid(left: HybridResult, right: HybridResult) {
  return right.fusionScore - left.fusionScore || left.knowledgeSourceId.localeCompare(right.knowledgeSourceId) || left.chunkIndex - right.chunkIndex || left.chunkId.localeCompare(right.chunkId);
}

/** Pure, deterministic Reciprocal Rank Fusion. Ranks are one-based. */
export function fuseHybridResults(keyword: KeywordSearchResult[], semantic: SemanticSearchResult[], k = HYBRID_RRF_K): HybridResult[] {
  const merged = new Map<string, HybridResult>();
  const merge = (item: RankedResult, rank: number, branch: 'keyword' | 'semantic') => {
    const current = merged.get(item.chunkId) ?? { chunkId: item.chunkId, knowledgeSourceId: item.knowledgeSourceId, sourceTitle: item.sourceTitle, chunkIndex: item.chunkIndex, content: item.content, sectionHeading: item.sectionHeading, startOffset: item.startOffset, endOffset: item.endOffset, keywordRank: null, semanticRank: null, keywordScore: null, semanticScore: null, fusionScore: 0 };
    if (branch === 'keyword') { current.keywordRank = rank; current.keywordScore = item.score; }
    else { current.semanticRank = rank; current.semanticScore = item.score; }
    current.fusionScore += 1 / (k + rank);
    merged.set(item.chunkId, current);
  };
  keyword.forEach((item, index) => merge(item, index + 1, 'keyword'));
  semantic.forEach((item, index) => merge(item, index + 1, 'semantic'));
  return [...merged.values()].sort(compareHybrid);
}

export type SemanticFailure = { code: 'semantic_unavailable' | 'semantic_rate_limited' | 'semantic_timeout' | 'semantic_invalid_response'; reason: string };
/** Only known provider failures can degrade to keyword-only. Safety-cap refusals remain explicit errors. */
export function semanticFailurePolicy(error: unknown): SemanticFailure | undefined {
  if (!(error instanceof AppError)) return undefined;
  if (error.status === 503) return { code: 'semantic_unavailable', reason: error.message };
  if (error.status === 429) return { code: 'semantic_rate_limited', reason: error.message };
  if (error.status === 504) return { code: 'semantic_timeout', reason: error.message };
  if (error.status === 502) return { code: 'semantic_invalid_response', reason: error.message };
  return undefined;
}

export async function retrieveHybridKnowledgeChunks(input: SearchInput) {
  const keyword = await retrieveKeywordCandidates(input, HYBRID_CANDIDATE_WINDOW);
  let semantic: Awaited<ReturnType<typeof retrieveSemanticCandidates>> | undefined;
  let semanticFailure: SemanticFailure | undefined;
  try { semantic = await retrieveSemanticCandidates(input); }
  catch (error) {
    semanticFailure = semanticFailurePolicy(error);
    if (!semanticFailure) throw error;
  }
  const semanticWindow = semantic?.results.slice(0, HYBRID_CANDIDATE_WINDOW) ?? [];
  const fused = fuseHybridResults(keyword.results, semanticWindow);
  const offset = (input.page - 1) * input.limit;
  const isWindowed = keyword.total > keyword.results.length || (semantic?.results.length ?? 0) > semanticWindow.length;
  return {
    query: keyword.query,
    results: fused.slice(offset, offset + input.limit),
    pagination: { total: fused.length, page: input.page, limit: input.limit, totalPages: Math.ceil(fused.length / input.limit), isWindowed },
    mode: semanticFailure ? 'keyword_only' as const : 'hybrid' as const,
    branches: {
      keyword: { available: true, candidateCount: keyword.results.length, totalMatches: keyword.total },
      semantic: semantic ? { available: true, candidateCount: semanticWindow.length, provider: semantic.coverage.provider, model: semantic.coverage.model, coverage: semantic.coverage } : { available: false, candidateCount: 0, failure: semanticFailure! },
    },
    retrievalWindow: { rrfK: HYBRID_RRF_K, candidateLimitPerBranch: HYBRID_CANDIDATE_WINDOW, fusedCandidateCount: fused.length, isWindowed },
  };
}
