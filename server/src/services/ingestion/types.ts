export type NormalizedText = { text: string; offsets: 'UTF-16 code units' };
export type TextChunk = { chunkIndex: number; content: string; startOffset: number; endOffset: number; sectionHeading: string | null };
export type IngestionSummary = { knowledgeSourceId: string; status: 'COMPLETED'; chunkCount: number; reingested: boolean };
export const DEFAULT_CHUNK_SIZE = 1500;
export const DEFAULT_CHUNK_OVERLAP = 200;
export const MAX_INGESTION_SOURCE_CHARS = 100_000;
