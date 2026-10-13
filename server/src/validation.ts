import { InvestigationStatus, KnowledgeSourceType } from '@prisma/client';
import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null).optional();
const id = z.string().uuid();

export const idParams = z.object({ id }).strict();
export const evidenceParams = z.object({ id, evidenceId: id }).strict();
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

export const createInvestigationSchema = z.object({
  title: text(200),
  description: text(20_000),
  errorLogs: optionalText(50_000),
  technologyTags: z.array(text(50)).max(20).default([]),
}).strict();

export const updateInvestigationSchema = z.object({
  title: text(200).optional(),
  description: text(20_000).optional(),
  errorLogs: optionalText(50_000),
  technologyTags: z.array(text(50)).max(20).optional(),
  status: z.nativeEnum(InvestigationStatus).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required.' });

const normalizedOriginUrl = z.string().trim().max(2_000).transform((value) => value || null).pipe(
  z.string().url().refine((value) => /^https?:\/\//i.test(value), 'Origin URL must use HTTP or HTTPS.').nullable(),
);
const optionalOriginUrl = z.union([z.null(), normalizedOriginUrl]).optional();

export const createKnowledgeSourceSchema = z.object({
  title: text(200),
  sourceType: z.nativeEnum(KnowledgeSourceType),
  content: text(100_000),
  originUrl: optionalOriginUrl,
}).strict();

export const updateKnowledgeSourceSchema = z.object({
  title: text(200).optional(),
  sourceType: z.nativeEnum(KnowledgeSourceType).optional(),
  content: text(100_000).optional(),
  originUrl: optionalOriginUrl,
}).strict().refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required.' });

export const createEvidenceSchema = z.object({
  knowledgeSourceId: id,
  note: optionalText(5_000),
}).strict();

export const searchQuerySchema = z.object({ q: z.string().trim().min(1).max(200), investigationId: id.optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(50).default(10), }).strict();
export const semanticSearchQuerySchema = searchQuerySchema.extend({ limit: z.coerce.number().int().min(1).max(25).default(10) }).strict();
export const hybridSearchQuerySchema = searchQuerySchema.extend({ limit: z.coerce.number().int().min(1).max(25).default(10) }).strict();
export const analyzeInvestigationSchema = z.object({ question: text(2_000) }).strict();
