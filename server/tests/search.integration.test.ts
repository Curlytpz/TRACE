import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadIntegrationTestEnvironment } from './integrationTestEnvironment.js';

const integration = loadIntegrationTestEnvironment();
const runIntegration = integration ? describe : describe.skip;

runIntegration('Keyword search integration', () => {
  let app: (typeof import('../src/app.js'))['app'];
  let getPrisma: (typeof import('../src/db.js'))['getPrisma'];
  let disconnectPrisma: (typeof import('../src/db.js'))['disconnectPrisma'];
  let sourceIds: string[] = []; let investigationIds: string[] = [];

  beforeAll(async () => { ({ app } = await import('../src/app.js')); ({ getPrisma, disconnectPrisma } = await import('../src/db.js')); });
  beforeEach(() => { sourceIds = []; investigationIds = []; });
  afterEach(async () => {
    const prisma = getPrisma();
    if (sourceIds.length) await prisma.knowledgeChunk.deleteMany({ where: { knowledgeSourceId: { in: sourceIds } } });
    if (investigationIds.length) await prisma.investigation.deleteMany({ where: { id: { in: investigationIds } } });
    if (sourceIds.length) await prisma.knowledgeSource.deleteMany({ where: { id: { in: sourceIds } } });
  });
  afterAll(async () => { await disconnectPrisma(); });

  async function createSource(title: string, content: string) {
    const created = await request(app).post('/api/knowledge-sources').send({ title, sourceType: 'DOCUMENTATION', content });
    sourceIds.push(created.body.id);
    await request(app).post(`/api/knowledge-sources/${created.body.id}/ingest`);
    return created.body;
  }

  it('returns ranked current chunks with source traceability and paginates results', async () => {
    await createSource('Primary database guide', 'database connection database connection retry configuration');
    await createSource('Secondary guide', 'database connection configuration');
    const first = await request(app).get('/api/search?q=database+connection&limit=1');
    expect(first.status).toBe(200); expect(first.body.results).toHaveLength(1);
    expect(first.body.results[0]).toMatchObject({ sourceTitle: 'Primary database guide', chunkIndex: 0 });
    expect(first.body.results[0].score).toBeGreaterThan(0);
    expect(first.body.pagination).toMatchObject({ total: 2, page: 1, limit: 1, totalPages: 2 });
    expect((await request(app).get('/api/search?q=database+connection&limit=1&page=2')).body.results).toHaveLength(1);
  });

  it('filters to evidence-linked sources and excludes unrelated or stale chunks', async () => {
    const linked = await createSource('Linked guide', 'connection timeout recovery');
    await createSource('Unrelated guide', 'connection timeout unrelated');
    const investigation = await request(app).post('/api/investigations').send({ title: 'Connection investigation', description: 'Investigate connection timeout behavior.', technologyTags: [] });
    investigationIds.push(investigation.body.id);
    await request(app).post(`/api/investigations/${investigation.body.id}/evidence`).send({ knowledgeSourceId: linked.id });
    const scoped = await request(app).get(`/api/search?q=connection+timeout&investigationId=${investigation.body.id}`);
    expect(scoped.status).toBe(200); expect(scoped.body.results).toHaveLength(1); expect(scoped.body.results[0].knowledgeSourceId).toBe(linked.id);
    await request(app).patch(`/api/knowledge-sources/${linked.id}`).send({ content: 'connection timeout changed' });
    expect((await request(app).get(`/api/search?q=connection+timeout&investigationId=${investigation.body.id}`)).body.results).toHaveLength(0);
  });

  it('handles no matches, invalid parameters, missing investigations, and query injection text safely', async () => {
    await createSource('Safe guide', 'database connection is configured');
    expect((await request(app).get('/api/search?q=absentterm')).body.results).toHaveLength(0);
    expect((await request(app).get('/api/search?q=!!!')).status).toBe(400);
    expect((await request(app).get('/api/search?q=database&limit=51')).status).toBe(400);
    expect((await request(app).get('/api/search?q=database&investigationId=11111111-1111-4111-8111-111111111111')).status).toBe(404);
    const injected = await request(app).get('/api/search?q=%27%3B+DROP+TABLE+%22KnowledgeChunk%22%3B--');
    expect(injected.status).toBe(200);
    expect(await getPrisma().knowledgeChunk.count()).toBeGreaterThan(0);
  });
});
