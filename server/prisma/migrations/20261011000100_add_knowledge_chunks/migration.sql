-- Knowledge chunks are deterministic, traceable fragments of a KnowledgeSource.
-- startOffset/endOffset are UTF-16 code-unit indexes into normalized source text.
CREATE TABLE "KnowledgeChunk" (
  "id" UUID NOT NULL,
  "knowledgeSourceId" UUID NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "contentHash" CHAR(64) NOT NULL,
  "startOffset" INTEGER NOT NULL,
  "endOffset" INTEGER NOT NULL,
  "sectionHeading" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KnowledgeChunk_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "KnowledgeChunk_knowledgeSourceId_chunkIndex_key" ON "KnowledgeChunk"("knowledgeSourceId", "chunkIndex");
CREATE INDEX "KnowledgeChunk_knowledgeSourceId_idx" ON "KnowledgeChunk"("knowledgeSourceId");
ALTER TABLE "KnowledgeChunk" ADD CONSTRAINT "KnowledgeChunk_knowledgeSourceId_fkey"
  FOREIGN KEY ("knowledgeSourceId") REFERENCES "KnowledgeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
