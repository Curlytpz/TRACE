import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadIntegrationTestEnvironment } from './integrationTestEnvironment.js';
import { setEmbeddingProviderForTests } from '../src/services/embeddings/provider.js';
import type { EmbeddingProvider } from '../src/services/embeddings/types.js';

const integration = loadIntegrationTestEnvironment();
const runIntegration = integration ? describe : describe.skip;
const provider: EmbeddingProvider = { id: 'hybrid-test', model: 'hybrid-v1', dimensions: 3, availability: () => ({ available: true }), embed: async (texts, taskType) => texts.map((text) => { const value = text.toLowerCase(); return [value.includes('timeout') ? 1 : 0, value.includes('database') ? 1 : 0, taskType === 'RETRIEVAL_QUERY' ? 0.1 : 0.2]; }) };

runIntegration('Hybrid search integration', () => {
  let app: (typeof import('../src/app.js'))['app']; let getPrisma: (typeof import('../src/db.js'))['getPrisma']; let disconnectPrisma: (typeof import('../src/db.js'))['disconnectPrisma']; let sourceIds: string[] = []; let investigationIds: string[] = [];
  beforeAll(async () => { setEmbeddingProviderForTests(provider); ({ app } = await import('../src/app.js')); ({ getPrisma, disconnectPrisma } = await import('../src/db.js')); });
  beforeEach(() => { sourceIds = []; investigationIds = []; setEmbeddingProviderForTests(provider); });
  afterEach(async () => { const prisma = getPrisma(); if (investigationIds.length) await prisma.investigation.deleteMany({ where: { id: { in: investigationIds } } }); if (sourceIds.length) await prisma.knowledgeSource.deleteMany({ where: { id: { in: sourceIds } } }); });
  afterAll(async () => { setEmbeddingProviderForTests(undefined); await disconnectPrisma(); });
  async function createSource(title: string, content: string) { const created = await request(app).post('/api/knowledge-sources').send({ title, sourceType: 'DOCUMENTATION', content }); sourceIds.push(created.body.id); expect((await request(app).post(`/api/knowledge-sources/${created.body.id}/ingest`)).status).toBe(200); expect((await request(app).post(`/api/knowledge-sources/${created.body.id}/embed`)).status).toBe(200); return created.body; }

  it('returns structured, deduplicated RRF results and applies scope and stale-content safeguards', async () => {
    const linked = await createSource('Timeout guide', 'timeout database connection recovery');
    await createSource('Unrelated database guide', 'database connection configuration');
    const investigation = await request(app).post('/api/investigations').send({ title: 'Hybrid scope', description: 'Validate hybrid retrieval investigation isolation.', technologyTags: [] }); investigationIds.push(investigation.body.id);
    await request(app).post(`/api/investigations/${investigation.body.id}/evidence`).send({ knowledgeSourceId: linked.id });
    const scoped = await request(app).get(`/api/search/hybrid?q=timeout&investigationId=${investigation.body.id}`);
    expect(scoped.status).toBe(200); expect(scoped.body).toMatchObject({ query: 'timeout', mode: 'hybrid', branches: { keyword: { available: true }, semantic: { available: true, provider: 'hybrid-test', model: 'hybrid-v1' } }, retrievalWindow: { rrfK: 60, candidateLimitPerBranch: 100 } });
    expect(scoped.body.results).toHaveLength(1); expect(scoped.body.results[0]).toMatchObject({ knowledgeSourceId: linked.id, keywordRank: 1, semanticRank: 1 }); expect(scoped.body.results[0].fusionScore).toBeGreaterThan(0);
    await request(app).patch(`/api/knowledge-sources/${linked.id}`).send({ content: 'changed and stale' });
    expect((await request(app).get(`/api/search/hybrid?q=timeout&investigationId=${investigation.body.id}`)).body.results).toHaveLength(0);
  });

  it('returns explicit keyword-only results when semantic retrieval is unavailable and validates requests', async () => {
    const source = await createSource('Timeout fallback guide', 'timeout handling and retry');
    setEmbeddingProviderForTests({ id: 'disabled', model: 'unconfigured', availability: () => ({ available: false, reason: 'Semantic provider is unavailable for this test.' }), embed: async () => [] });
    const degraded = await request(app).get('/api/search/hybrid?q=timeout');
    expect(degraded.status).toBe(200); expect(degraded.body).toMatchObject({ mode: 'keyword_only', branches: { semantic: { available: false, failure: { code: 'semantic_unavailable' } } } }); expect(degraded.body.results[0]).toMatchObject({ knowledgeSourceId: source.id, keywordRank: 1, semanticRank: null, semanticScore: null });
    expect((await request(app).get('/api/search/hybrid?q=!!!')).status).toBe(400);
  });
});
