import { describe, expect, it } from 'vitest';
import { semanticSearchQuerySchema } from '../src/validation.js';
import { cosineSimilarity, MAX_SEMANTIC_CANDIDATES } from '../src/services/search/retrieveSemanticKnowledgeChunks.js';
import { validVector } from '../src/services/embeddings/embedKnowledgeSource.js';
describe('semantic retrieval safeguards', () => {
  it('calculates bounded cosine similarity deterministically', () => { expect(cosineSimilarity([1, 0], [1, 0])).toBe(1); expect(cosineSimilarity([1, 0], [0, 1])).toBe(0); expect(() => cosineSimilarity([0, 0], [1, 0])).toThrow(); });
  it('rejects malformed, non-finite, and incompatible vectors', () => { expect(validVector([0.1, 0.2], 2)).toBe(true); expect(validVector([Infinity, 0.2])).toBe(false); expect(validVector([0.1], 2)).toBe(false); expect(validVector([], 0)).toBe(false); });
  it('uses conservative semantic pagination and a fixed candidate ceiling', () => { expect(semanticSearchQuerySchema.parse({ q: 'timeout' })).toMatchObject({ limit: 10 }); expect(() => semanticSearchQuerySchema.parse({ q: 'timeout', limit: 26 })).toThrow(); expect(MAX_SEMANTIC_CANDIDATES).toBe(1000); });
});
