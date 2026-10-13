import type { NormalizedText } from './types.js';
/** Offsets throughout ingestion are JavaScript UTF-16 string indexes in this normalized text. */
export function normalizeText(input: string): NormalizedText {
  const lines = input.replace(/\r\n?/g, '\n').split('\n');
  const normalized: string[] = []; let blanks = 0;
  for (const line of lines) { const value = line.replace(/[\t ]+$/g, ''); if (!value) { blanks += 1; if (blanks <= 2) normalized.push(''); } else { blanks = 0; normalized.push(value); } }
  return { text: normalized.join('\n'), offsets: 'UTF-16 code units' };
}
