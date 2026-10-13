import { Router } from 'express';
import { asyncHandler, AppError } from '../errors.js';
import { getPrisma } from '../db.js';
import { createKnowledgeSourceSchema, idParams, paginationQuery, updateKnowledgeSourceSchema } from '../validation.js';
import { knowledgeIngestionRouter } from './knowledgeIngestion.js';

export const knowledgeSourcesRouter = Router();
knowledgeSourcesRouter.use('/:id', knowledgeIngestionRouter);

knowledgeSourcesRouter.post('/', asyncHandler(async (request, response) => {
  const data = createKnowledgeSourceSchema.parse(request.body);
  response.status(201).json(await getPrisma().knowledgeSource.create({ data }));
}));
knowledgeSourcesRouter.get('/', asyncHandler(async (request, response) => {
  const { page, pageSize } = paginationQuery.parse(request.query);
  const prisma = getPrisma();
  const [items, total] = await prisma.$transaction([prisma.knowledgeSource.findMany({ orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }), prisma.knowledgeSource.count()]);
  response.json({ items, page, pageSize, total });
}));
knowledgeSourcesRouter.get('/:id', asyncHandler(async (request, response) => {
  const { id } = idParams.parse(request.params);
  const source = await getPrisma().knowledgeSource.findUnique({ where: { id }, include: { evidence: { include: { investigation: true } } } });
  if (!source) throw new AppError(404, 'Knowledge source not found.');
  response.json(source);
}));
knowledgeSourcesRouter.patch('/:id', asyncHandler(async (request, response) => {
  const { id } = idParams.parse(request.params);
  const data = updateKnowledgeSourceSchema.parse(request.body);
  const prisma = getPrisma();
  const existing = await prisma.knowledgeSource.findUnique({ where: { id }, select: { id: true, content: true } });
  if (!existing) throw new AppError(404, 'Knowledge source not found.');
  const contentChanged = data.content !== undefined && data.content !== existing.content;
  const source = await prisma.$transaction(async (tx) => {
    if (contentChanged) await tx.knowledgeChunk.deleteMany({ where: { knowledgeSourceId: id } });
    return tx.knowledgeSource.update({ where: { id }, data: contentChanged ? { ...data, ingestedContentHash: null } : data });
  });
  response.json(source);
}));
knowledgeSourcesRouter.delete('/:id', asyncHandler(async (request, response) => {
  const { id } = idParams.parse(request.params);
  const existing = await getPrisma().knowledgeSource.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new AppError(404, 'Knowledge source not found.');
  await getPrisma().knowledgeSource.delete({ where: { id } });
  response.status(204).send();
}));
