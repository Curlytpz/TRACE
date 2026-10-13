import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadIntegrationTestEnvironment } from './integrationTestEnvironment.js';

const integration = loadIntegrationTestEnvironment();
const runIntegration = integration ? describe : describe.skip;

runIntegration('Knowledge ingestion integration', () => {
  let app: (typeof import('../src/app.js'))['app'];
  let getPrisma: (typeof import('../src/db.js'))['getPrisma'];
  let disconnectPrisma: (typeof import('../src/db.js'))['disconnectPrisma'];
  let sourceIds: string[] = [];

  beforeAll(async () => {
    ({ app } = await import('../src/app.js'));
    ({ getPrisma, disconnectPrisma } = await import('../src/db.js'));
  });
  beforeEach(() => { sourceIds = []; });
  afterEach(async () => {
    const prisma = getPrisma();
    if (sourceIds.length) await prisma.knowledgeChunk.deleteMany({ where: { knowledgeSourceId: { in: sourceIds } } });
    if (sourceIds.length) await prisma.knowledgeSource.deleteMany({ where: { id: { in: sourceIds } } });
  });
  afterAll(async () => { await disconnectPrisma(); });

  async function source(content = '# Guide\n\nFirst paragraph.\n\nSecond paragraph.') {
    const result = await request(app).post('/api/knowledge-sources').send({ title: 'Test documentation', sourceType: 'DOCUMENTATION', content });
    sourceIds.push(result.body.id);
    return result;
  }

  it('ingests, retrieves, and safely re-ingests an unchanged source', async () => {
    const created = await source('x'.repeat(1800));
    const first = await request(app).post(`/api/knowledge-sources/${created.body.id}/ingest`);
    expect(first.status).toBe(200);
    expect(first.body.chunkCount).toBeGreaterThan(1);
    expect((await request(app).get(`/api/knowledge-sources/${created.body.id}/chunks`)).body.items).toHaveLength(first.body.chunkCount);
    expect((await request(app).post(`/api/knowledge-sources/${created.body.id}/ingest`)).body.reingested).toBe(false);
  });

  it('invalidates chunks when source content changes and refreshes them on re-ingestion', async () => {
    const created = await source();
    await request(app).post(`/api/knowledge-sources/${created.body.id}/ingest`);
    await request(app).patch(`/api/knowledge-sources/${created.body.id}`).send({ content: '# Changed\n\nNew technical content.' });
    const status = await request(app).get(`/api/knowledge-sources/${created.body.id}/ingestion-status`);
    expect(status.body.isCurrent).toBe(false);
    expect(status.body.chunkCount).toBe(0);
    expect((await request(app).post(`/api/knowledge-sources/${created.body.id}/ingest`)).body.chunkCount).toBe(1);
  });

  it('cascades chunk deletion and rejects invalid, missing, and oversized sources', async () => {
    const created = await source();
    await request(app).post(`/api/knowledge-sources/${created.body.id}/ingest`);
    await request(app).delete(`/api/knowledge-sources/${created.body.id}`);
    sourceIds = sourceIds.filter((sourceId) => sourceId !== created.body.id);
    expect(await getPrisma().knowledgeChunk.count({ where: { knowledgeSourceId: created.body.id } })).toBe(0);
    expect((await request(app).post('/api/knowledge-sources/not-a-uuid/ingest')).status).toBe(400);
    expect((await request(app).post('/api/knowledge-sources/11111111-1111-4111-8111-111111111111/ingest')).status).toBe(404);
    const oversized = await getPrisma().knowledgeSource.create({ data: { title: 'Oversized', sourceType: 'DEVELOPER_NOTE', content: 'x'.repeat(100_001) } });
    sourceIds.push(oversized.id);
    expect((await request(app).post(`/api/knowledge-sources/${oversized.id}/ingest`)).status).toBe(413);
  });
});
