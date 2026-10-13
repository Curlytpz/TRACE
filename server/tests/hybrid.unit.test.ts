import { describe, expect, it } from 'vitest';
import { AppError } from '../src/errors.js';
import { fuseHybridResults, HYBRID_RRF_K, semanticFailurePolicy } from '../src/services/search/retrieveHybridKnowledgeChunks.js';

const keyword = (chunkId: string, source = 'source-a', index = 0, score = 1) => ({ chunkId, knowledgeSourceId: source, sourceTitle: source, chunkIndex: index, content: chunkId, sectionHeading: null, score, startOffset: 0, endOffset: 1 });

describe('hybrid retrieval', () => {
  it('uses one-based reciprocal rank fusion without adding incomparable scores', () => {
    const results = fuseHybridResults([keyword('both', 'source-a', 0, 0.1), keyword('keyword-only', 'source-b')], [keyword('semantic-only', 'source-c'), keyword('both', 'source-a', 0, 0.99)]);
    expect(results.map((item) => item.chunkId)).toEqual(['both', 'semantic-only', 'keyword-only']);
    expect(results[0]).toMatchObject({ keywordRank: 1, semanticRank: 2, keywordScore: 0.1, semanticScore: 0.99, fusionScore: 1 / (HYBRID_RRF_K + 1) + 1 / (HYBRID_RRF_K + 2) });
    expect(results[1]).toMatchObject({ keywordRank: null, semanticRank: 1, keywordScore: null });
    expect(results[2]).toMatchObject({ keywordRank: 2, semanticRank: null, semanticScore: null });
  });

  it('deduplicates by chunk ID and uses stable source, chunk, and chunk-ID tie breaking', () => {
    const first = fuseHybridResults([keyword('z', 'source-b')], [keyword('a', 'source-a')]);
    const second = fuseHybridResults([keyword('z', 'source-b')], [keyword('a', 'source-a')]);
    expect(first).toEqual(second);
    expect(first.map((item) => item.chunkId)).toEqual(['a', 'z']);
  });

  it('keeps pagination outside fusion by producing one ranked candidate collection', () => {
    const fused = fuseHybridResults([keyword('one'), keyword('two'), keyword('three')], []);
    expect(fused.slice(1, 2).map((item) => item.chunkId)).toEqual(['two']);
  });

  it('only permits explicit keyword-only degradation for known semantic provider failures', () => {
    expect(semanticFailurePolicy(new AppError(503, 'Provider unavailable'))).toMatchObject({ code: 'semantic_unavailable' });
    expect(semanticFailurePolicy(new AppError(429, 'Rate limited'))).toMatchObject({ code: 'semantic_rate_limited' });
    expect(semanticFailurePolicy(new AppError(504, 'Timed out'))).toMatchObject({ code: 'semantic_timeout' });
    expect(semanticFailurePolicy(new AppError(502, 'Invalid vector'))).toMatchObject({ code: 'semantic_invalid_response' });
    expect(semanticFailurePolicy(new AppError(409, 'Candidate limit exceeded'))).toBeUndefined();
  });
});
