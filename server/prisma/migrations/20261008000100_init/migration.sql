-- Core TRACE persistence schema. This migration is intentionally free of embedding columns.
CREATE TYPE "InvestigationStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'ARCHIVED');
CREATE TYPE "KnowledgeSourceType" AS ENUM ('DOCUMENTATION', 'ERROR_LOG', 'DEVELOPER_NOTE', 'INCIDENT', 'REPOSITORY');

CREATE TABLE "Investigation" (
  "id" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "description" TEXT NOT NULL,
  "errorLogs" TEXT,
  "technologyTags" TEXT[] NOT NULL,
  "status" "InvestigationStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Investigation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "KnowledgeSource" (
  "id" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "sourceType" "KnowledgeSourceType" NOT NULL,
  "content" TEXT NOT NULL,
  "originUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "KnowledgeSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvestigationEvidence" (
  "id" UUID NOT NULL,
  "investigationId" UUID NOT NULL,
  "knowledgeSourceId" UUID NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InvestigationEvidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Investigation_status_idx" ON "Investigation"("status");
CREATE INDEX "Investigation_createdAt_idx" ON "Investigation"("createdAt");
CREATE INDEX "KnowledgeSource_sourceType_idx" ON "KnowledgeSource"("sourceType");
CREATE INDEX "KnowledgeSource_createdAt_idx" ON "KnowledgeSource"("createdAt");
CREATE UNIQUE INDEX "InvestigationEvidence_investigationId_knowledgeSourceId_key" ON "InvestigationEvidence"("investigationId", "knowledgeSourceId");
CREATE INDEX "InvestigationEvidence_knowledgeSourceId_idx" ON "InvestigationEvidence"("knowledgeSourceId");

ALTER TABLE "InvestigationEvidence" ADD CONSTRAINT "InvestigationEvidence_investigationId_fkey"
  FOREIGN KEY ("investigationId") REFERENCES "Investigation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InvestigationEvidence" ADD CONSTRAINT "InvestigationEvidence_knowledgeSourceId_fkey"
  FOREIGN KEY ("knowledgeSourceId") REFERENCES "KnowledgeSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
