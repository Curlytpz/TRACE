import { DEFAULT_CHUNK_OVERLAP, DEFAULT_CHUNK_SIZE, type TextChunk } from './types.js';
type Options = { maxSize?: number; overlap?: number };
function headingAt(text: string, offset: number): string | null { let heading: string | null = null; for (const match of text.matchAll(/^#{1,6}[ \t]+(.+?)\s*#*\s*$/gm)) { if ((match.index ?? 0) > offset) break; heading = match[1]?.trim() || null; } return heading; }
function preferredEnd(text: string, start: number, hardEnd: number): number { if (hardEnd >= text.length) return text.length; const slice = text.slice(start, hardEnd + 1); const paragraph = slice.lastIndexOf('\n\n'); if (paragraph > 0) return start + paragraph + 2; const line = slice.lastIndexOf('\n'); if (line > 0) return start + line + 1; const whitespace = Math.max(slice.lastIndexOf(' '), slice.lastIndexOf('\t')); return whitespace > 0 ? start + whitespace + 1 : hardEnd; }
/** Produces ordered chunks with UTF-16 offsets into normalized source text. */
export function chunkText(text: string, options: Options = {}): TextChunk[] {
 const maxSize = options.maxSize ?? DEFAULT_CHUNK_SIZE; const overlap = options.overlap ?? DEFAULT_CHUNK_OVERLAP;
 if (!Number.isInteger(maxSize) || maxSize < 1 || !Number.isInteger(overlap) || overlap < 0 || overlap >= maxSize) throw new Error('Chunk configuration requires maxSize > overlap >= 0.');
 if (!text) return []; const chunks: TextChunk[] = []; let start = 0;
 while (start < text.length) { const end = preferredEnd(text, start, Math.min(start + maxSize, text.length)); if (end <= start) throw new Error('Chunking failed to make progress.'); chunks.push({ chunkIndex: chunks.length, content: text.slice(start, end), startOffset: start, endOffset: end, sectionHeading: headingAt(text, start) }); if (end === text.length) break; start = Math.max(start + 1, end - overlap); }
 return chunks;
}
