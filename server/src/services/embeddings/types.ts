export type EmbeddingAvailability = { available: boolean; reason?: string };
export type EmbeddingTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';
export type EmbeddingProvider = {
  readonly id: string;
  readonly model: string;
  /** A fixed dimension, when the provider is configured to request one. */
  readonly dimensions?: number;
  availability(): EmbeddingAvailability;
  embed(texts: string[], taskType: EmbeddingTaskType): Promise<number[][]>;
};
