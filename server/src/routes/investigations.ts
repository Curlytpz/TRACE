import { Router } from 'express';
import { asyncHandler, AppError } from '../errors.js';
import { getPrisma } from '../db.js';
import { analyzeInvestigationSchema, createEvidenceSchema, createInvestigationSchema, evidenceParams, idParams, paginationQuery, updateInvestigationSchema } from '../validation.js';
import { analyzeInvestigation } from '../services/analysis/analyzeInvestigation.js';

export const investigationsRouter = Router();

investigationsRouter.post('/:id/analyze', asyncHandler(async (request, response) => { const { id } = idParams.parse(request.params); const { question } = analyzeInvestigationSchema.parse(request.body); response.json(await analyzeInvestigation(id, question)); }));

investigationsRouter.post('/', asyncHandler(async (request, response) => {
  const data = createInvestigationSchema.parse(request.body);
  const investigation = await getPrisma().investigation.create({ data });
  response.status(201).json(investigation);
}));

investigationsRouter.get('/', asyncHandler(async (request, response) => {
  const { page, pageSize } = paginationQuery.parse(request.query);
  const prisma = getPrisma();
  const [items, total] = await prisma.$transaction([
    prisma.investigation.findMany({ orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.investigation.count(),
  ]);
  response.json({ items, page, pageSize, total });
}));

investigationsRouter.get('/:id', asyncHandler(async (request, response) => {
  const { id } = idParams.parse(request.params);
  const investigation = await getPrisma().investigation.findUnique({
    where: { id },
    include: { evidence: { include: { knowledgeSource: true }, orderBy: { createdAt: 'desc' } } },
  });
  if (!investigation) throw new AppError(404, 'Investigation not found.');
  response.json(investigation);
}));

investigationsRouter.patch('/:id', asyncHandler(async (request, response) => {
  const { id } = idParams.parse(request.params);
  const data = updateInvestigationSchema.parse(request.body);
  const existing = await getPrisma().investigation.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new AppError(404, 'Investigation not found.');
  response.json(await getPrisma().investigation.update({ where: { id }, data }));
}));

investigationsRouter.delete('/:id', asyncHandler(async (request, response) => {
  const { id } = idParams.parse(request.params);
  const existing = await getPrisma().investigation.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new AppError(404, 'Investigation not found.');
  await getPrisma().investigation.delete({ where: { id } });
  response.status(204).send();
}));

investigationsRouter.post('/:id/evidence', asyncHandler(async (request, response) => {
  const { id } = idParams.parse(request.params);
  const data = createEvidenceSchema.parse(request.body);
  const prisma = getPrisma();
  const [investigation, source] = await prisma.$transaction([
    prisma.investigation.findUnique({ where: { id }, select: { id: true } }),
    prisma.knowledgeSource.findUnique({ where: { id: data.knowledgeSourceId }, select: { id: true } }),
  ]);
  if (!investigation) throw new AppError(404, 'Investigation not found.');
  if (!source) throw new AppError(404, 'Knowledge source not found.');
  const evidence = await prisma.investigationEvidence.create({ data: { investigationId: id, ...data }, include: { knowledgeSource: true } });
  response.status(201).json(evidence);
}));

investigationsRouter.get('/:id/evidence', asyncHandler(async (request, response) => {
  const { id } = idParams.parse(request.params);
  const prisma = getPrisma();
  const exists = await prisma.investigation.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new AppError(404, 'Investigation not found.');
  response.json(await prisma.investigationEvidence.findMany({ where: { investigationId: id }, include: { knowledgeSource: true }, orderBy: { createdAt: 'desc' } }));
}));

investigationsRouter.delete('/:id/evidence/:evidenceId', asyncHandler(async (request, response) => {
  const { id, evidenceId } = evidenceParams.parse(request.params);
  const evidence = await getPrisma().investigationEvidence.findFirst({ where: { id: evidenceId, investigationId: id }, select: { id: true } });
  if (!evidence) throw new AppError(404, 'Evidence relationship not found.');
  await getPrisma().investigationEvidence.delete({ where: { id: evidenceId } });
  response.status(204).send();
}));
