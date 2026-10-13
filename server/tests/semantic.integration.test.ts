import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadIntegrationTestEnvironment } from './integrationTestEnvironment.js';
import { setEmbeddingProviderForTests } from '../src/services/embeddings/provider.js';
import type { EmbeddingProvider } from '../src/services/embeddings/types.js';

const integration = loadIntegrationTestEnvironment();
const runIntegration = integration ? describe : describe.skip;
const embeddingTasks: string[] = [];
const provider: EmbeddingProvider = { id: 'test-deterministic', model: 'test-v1', availability: () => ({ available: true }), embed: async (texts, taskType) => { embeddingTasks.push(taskType); return texts.map((text) => { const lower = text.toLowerCase(); return [lower.includes('timeout') ? 1 : 0, lower.includes('database') ? 1 : 0, text.length / 1000]; }); } };
runIntegration('Semantic retrieval integration', () => {
  let app: (typeof import('../src/app.js'))['app']; let getPrisma: (typeof import('../src/db.js'))['getPrisma']; let disconnectPrisma: (typeof import('../src/db.js'))['disconnectPrisma']; let sourceIds: string[] = []; let investigationIds: string[] = [];
  beforeAll(async () => { setEmbeddingProviderForTests(provider); ({ app } = await import('../src/app.js')); ({ getPrisma, disconnectPrisma } = await import('../src/db.js')); });
  beforeEach(() => { sourceIds = []; investigationIds = []; embeddingTasks.length = 0; });
  afterEach(async () => { const prisma = getPrisma(); if (investigationIds.length) await prisma.investigation.deleteMany({ where: { id: { in: investigationIds } } }); if (sourceIds.length) await prisma.knowledgeSource.deleteMany({ where: { id: { in: sourceIds } } }); });
  afterAll(async () => { setEmbeddingProviderForTests(undefined); await disconnectPrisma(); });
  async function createEmbeddedSource(title: string, content: string) { const created = await request(app).post('/api/knowledge-sources').send({ title, sourceType: 'DOCUMENTATION', content }); sourceIds.push(created.body.id); expect((await request(app).post(`/api/knowledge-sources/${created.body.id}/ingest`)).status).toBe(200); return created.body; }
  it('embeds current chunks once, reuses unchanged vectors, and ranks scoped semantic results', async () => {
    const timeout = await createEmbeddedSource('Timeout guide', 'timeout connection retry guidance'); const database = await createEmbeddedSource('Database guide', 'database configuration guidance');
    const first = await request(app).post(`/api/knowledge-sources/${timeout.id}/embed`); expect(first.status).toBe(200); expect(first.body).toMatchObject({ embeddedCount: 1, cachedCount: 0, provider: 'test-deterministic' });
    const again = await request(app).post(`/api/knowledge-sources/${timeout.id}/embed`); expect(again.status).toBe(200); expect(again.body).toMatchObject({ embeddedCount: 0, cachedCount: 1 });
    expect((await request(app).post(`/api/knowledge-sources/${database.id}/embed`)).status).toBe(200);
    const investigation = await request(app).post('/api/investigations').send({ title: 'Timeout investigation', description: 'Investigate timeout evidence with enough detail.', technologyTags: [] }); investigationIds.push(investigation.body.id); await request(app).post(`/api/investigations/${investigation.body.id}/evidence`).send({ knowledgeSourceId: timeout.id });
    const searched = await request(app).get(`/api/search/semantic?q=timeout&investigationId=${investigation.body.id}`); expect(searched.status).toBe(200); expect(searched.body.results).toHaveLength(1); expect(searched.body.results[0]).toMatchObject({ knowledgeSourceId: timeout.id, sourceTitle: 'Timeout guide' }); expect(searched.body.coverage).toMatchObject({ complete: true, compatibleEmbeddedChunks: 1 }); expect(embeddingTasks).toContain('RETRIEVAL_DOCUMENT'); expect(embeddingTasks).toContain('RETRIEVAL_QUERY');
  });
  it('rejects invalid provider vectors and excludes embeddings after source content becomes stale', async () => {
    const source = await createEmbeddedSource('Stale guide', 'timeout connection retry guidance'); expect((await request(app).post(`/api/knowledge-sources/${source.id}/embed`)).status).toBe(200); await request(app).patch(`/api/knowledge-sources/${source.id}`).send({ content: 'changed source text' }); const stale = await request(app).get('/api/search/semantic?q=timeout'); expect(stale.status).toBe(200); expect(stale.body.results).toHaveLength(0); expect(stale.body.coverage).toMatchObject({ totalCurrentChunks: 0, complete: true });
    const invalid: EmbeddingProvider = { ...provider, model: 'invalid-v1', embed: async () => [[Infinity, 0, 0]] }; setEmbeddingProviderForTests(invalid); const next = await createEmbeddedSource('Invalid guide', 'timeout validation'); const rejected = await request(app).post(`/api/knowledge-sources/${next.id}/embed`); expect(rejected.status).toBe(502); setEmbeddingProviderForTests(provider);
  });
});
