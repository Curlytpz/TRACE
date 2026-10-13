import cors from 'cors';
import express from 'express';
import { env } from './config.js';
import { AppError, errorHandler } from './errors.js';
import { investigationsRouter } from './routes/investigations.js';
import { knowledgeSourcesRouter } from './routes/knowledgeSources.js';
import { searchRouter } from './routes/search.js';

export const app = express();

app.disable('x-powered-by');
app.use(cors({
  origin: env.CLIENT_ORIGIN,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  optionsSuccessStatus: 204,
}));
app.use(express.json({ limit: '200kb' }));

app.get('/api/health', (_request, response) => {
  response.status(200).json({ status: 'ok', service: 'TRACE API' });
});
app.use('/api/investigations', investigationsRouter);
app.use('/api/knowledge-sources', knowledgeSourcesRouter);
app.use('/api/search', searchRouter);

app.use((_request, _response, next) => next(new AppError(404, 'Route not found.')));
app.use(errorHandler);
