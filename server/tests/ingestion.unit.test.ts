import { describe, expect, it } from 'vitest';
import { chunkText } from '../src/services/ingestion/chunkText.js';
import { hashContent } from '../src/services/ingestion/hashContent.js';
import { normalizeText } from '../src/services/ingestion/normalizeText.js';

describe('knowledge ingestion utilities', () => {
  it('normalizes line endings and conservative excess blank lines while preserving indentation', () => {
    const output = normalizeText('Error:\r\n  at run (app.ts:1)  \r\n\r\n\r\n\r\n# Heading\r\n');
    expect(output.text).toBe('Error:\n  at run (app.ts:1)\n\n\n# Heading\n');
    expect(output.offsets).toBe('UTF-16 code units');
  });
  it('handles empty content without empty chunks', () => expect(chunkText('')).toEqual([]));
  it('preserves nearest markdown heading metadata', () => {
    const chunks = chunkText('# Setup\n\nInstall dependencies.', { maxSize: 15, overlap: 2 });
    expect(chunks[0]?.sectionHeading).toBe('Setup');
  });
  it('keeps stack trace indentation and long paragraph chunks within bounds', () => {
    const text = 'Error: boom\n    at functionName (file.ts:4)\n' + 'x'.repeat(400);
    const chunks = chunkText(text, { maxSize: 100, overlap: 20 });
    expect(chunks.every((chunk) => chunk.content.length <= 100)).toBe(true);
    expect(chunks[0]?.content).toContain('    at functionName');
  });
  it('uses overlap, deterministic ordering, and source offsets', () => {
    const text = Array.from({ length: 80 }, (_, index) => `word${index}`).join(' ');
    const first = chunkText(text, { maxSize: 80, overlap: 15 });
    const second = chunkText(text, { maxSize: 80, overlap: 15 });
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(1);
    expect(first[1]?.startOffset).toBeLessThan(first[0]?.endOffset ?? 0);
    expect(first.every((chunk) => text.slice(chunk.startOffset, chunk.endOffset) === chunk.content)).toBe(true);
  });
  it('uses UTF-16 offsets consistently for unicode', () => {
    const text = 'í ½í¸€ ' + 'a'.repeat(40);
    const chunk = chunkText(text, { maxSize: 10, overlap: 2 })[0];
    expect(chunk?.startOffset).toBe(0);
    expect(text.slice(chunk?.startOffset, chunk?.endOffset)).toBe(chunk?.content);
  });
  it('computes stable SHA-256 hashes', () => {
    expect(hashContent('trace')).toBe(hashContent('trace'));
    expect(hashContent('trace')).not.toBe(hashContent('TRACE'));
    expect(hashContent('trace')).toHaveLength(64);
  });
});
