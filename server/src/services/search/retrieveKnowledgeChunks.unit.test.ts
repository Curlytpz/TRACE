import { describe, expect, it } from 'vitest';
import { normalizeSearchQuery } from './retrieveKnowledgeChunks.js';
describe('search query normalization', () => {
 it('normalizes whitespace', () => expect(normalizeSearchQuery('  database   connection ')).toBe('database connection'));
 it('rejects empty and punctuation-only queries', () => { expect(() => normalizeSearchQuery('   ')).toThrow(); expect(() => normalizeSearchQuery('--- !!!')).toThrow(); });
 it('preserves technical identifiers', () => expect(normalizeSearchQuery('P1001 ECONNREFUSED')).toBe('P1001 ECONNREFUSED'));
});
