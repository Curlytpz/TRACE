-- Full-text retrieval index and source freshness marker. No data is removed.
ALTER TABLE "KnowledgeSource" ADD COLUMN "ingestedContentHash" CHAR(64);
CREATE INDEX "KnowledgeChunk_content_simple_fts_idx" ON "KnowledgeChunk" USING GIN (to_tsvector('simple', "content"));
