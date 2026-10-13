import { describe, expect, it } from 'vitest';
import { searchQuerySchema } from '../src/validation.js';
import { normalizeSearchQuery } from '../src/services/search/retrieveKnowledgeChunks.js';
describe('search validation', () => {
  it('uses bounded default pagination', () => expect(searchQuerySchema.parse({ q: 'database' })).toMatchObject({ page: 1, limit: 10 }));
  it('rejects invalid pagination and oversized queries', () => {
    expect(() => searchQuerySchema.parse({ q: 'x', page: 0 })).toThrow();
    expect(() => searchQuerySchema.parse({ q: 'x', limit: 51 })).toThrow();
    expect(() => searchQuerySchema.parse({ q: 'x'.repeat(201) })).toThrow();
  });
  it('rejects empty and punctuation-only normalized queries', () => {
    expect(() => normalizeSearchQuery(' ')).toThrow();
    expect(() => normalizeSearchQuery('!!!')).toThrow();
  });
});
