import { Router } from 'express';
import { asyncHandler } from '../errors.js';
import { hybridSearchQuerySchema, searchQuerySchema, semanticSearchQuerySchema } from '../validation.js';
import { retrieveKnowledgeChunks } from '../services/search/retrieveKnowledgeChunks.js';
import { retrieveSemanticKnowledgeChunks } from '../services/search/retrieveSemanticKnowledgeChunks.js';
import { retrieveHybridKnowledgeChunks } from '../services/search/retrieveHybridKnowledgeChunks.js';

export const searchRouter = Router();
searchRouter.get('/', asyncHandler(async (request, response) => {
  const { q, ...options } = searchQuerySchema.parse(request.query);
  response.json(await retrieveKnowledgeChunks({ query: q, ...options }));
}));
searchRouter.get('/semantic', asyncHandler(async (request, response) => {
  const { q, ...options } = semanticSearchQuerySchema.parse(request.query);
  response.json(await retrieveSemanticKnowledgeChunks({ query: q, ...options }));
}));
searchRouter.get('/hybrid', asyncHandler(async (request, response) => {
  const { q, ...options } = hybridSearchQuerySchema.parse(request.query);
  response.json(await retrieveHybridKnowledgeChunks({ query: q, ...options }));
}));
