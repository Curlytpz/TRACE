-- Phase 3.3 JSON embedding fallback. This migration is additive and contains no drops,
-- truncations, or data rewrites. JSONB is intentionally used while pgvector is unavailable.
CREATE TABLE "KnowledgeChunkEmbedding" (
    "id" UUID NOT NULL,
    "chunkId" UUID NOT NULL,
    "provider" VARCHAR(50) NOT NULL,
    "model" VARCHAR(200) NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "values" JSONB NOT NULL,
    "contentHash" CHAR(64) NOT NULL,
    "embeddedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "KnowledgeChunkEmbedding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "KnowledgeChunkEmbedding_chunkId_key" ON "KnowledgeChunkEmbedding"("chunkId");
CREATE INDEX "KnowledgeChunkEmbedding_provider_model_dimensions_idx" ON "KnowledgeChunkEmbedding"("provider", "model", "dimensions");
CREATE INDEX "KnowledgeChunkEmbedding_contentHash_idx" ON "KnowledgeChunkEmbedding"("contentHash");

ALTER TABLE "KnowledgeChunkEmbedding"
  ADD CONSTRAINT "KnowledgeChunkEmbedding_chunkId_fkey"
  FOREIGN KEY ("chunkId") REFERENCES "KnowledgeChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
