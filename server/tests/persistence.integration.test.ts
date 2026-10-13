import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadIntegrationTestEnvironment } from './integrationTestEnvironment.js';

const integration = loadIntegrationTestEnvironment();
const runIntegration = integration ? describe : describe.skip;

runIntegration('Persistence API integration', () => {
  let app: (typeof import('../src/app.js'))['app'];
  let getPrisma: (typeof import('../src/db.js'))['getPrisma'];
  let disconnectPrisma: (typeof import('../src/db.js'))['disconnectPrisma'];
  let investigationIds: string[] = [];
  let sourceIds: string[] = [];

  beforeAll(async () => {
    ({ app } = await import('../src/app.js'));
    ({ getPrisma, disconnectPrisma } = await import('../src/db.js'));
  });
  beforeEach(() => { investigationIds = []; sourceIds = []; });
  afterEach(async () => {
    const prisma = getPrisma();
    if (sourceIds.length) await prisma.knowledgeChunk.deleteMany({ where: { knowledgeSourceId: { in: sourceIds } } });
    if (investigationIds.length) await prisma.investigation.deleteMany({ where: { id: { in: investigationIds } } });
    if (sourceIds.length) await prisma.knowledgeSource.deleteMany({ where: { id: { in: sourceIds } } });
  });
  afterAll(async () => { await disconnectPrisma(); });

  it('creates, retrieves, updates, and deletes an investigation', async () => {
    const created = await request(app).post('/api/investigations').send({ title: 'Deployment API failure', description: 'The API responds with a 500 after the production deployment.', errorLogs: 'Error: connection reset', technologyTags: ['TypeScript', 'Express'] });
    investigationIds.push(created.body.id);
    expect(created.status).toBe(201);
    const list = await request(app).get('/api/investigations?page=1&pageSize=10');
    expect(list.status).toBe(200);
    expect(list.body.items.some((item: { id: string }) => item.id === created.body.id)).toBe(true);
    expect((await request(app).patch(`/api/investigations/${created.body.id}`).send({ status: 'IN_PROGRESS' })).body.status).toBe('IN_PROGRESS');
    expect((await request(app).delete(`/api/investigations/${created.body.id}`)).status).toBe(204);
  });

  it('returns validation errors and missing-record responses', async () => {
    expect((await request(app).post('/api/investigations').send({ title: 'x' })).status).toBe(400);
    expect((await request(app).get('/api/investigations/not-a-uuid')).status).toBe(400);
    expect((await request(app).get('/api/investigations/11111111-1111-4111-8111-111111111111')).status).toBe(404);
  });

  it('performs knowledge source CRUD', async () => {
    const created = await request(app).post('/api/knowledge-sources').send({ title: 'Express error handling', sourceType: 'DOCUMENTATION', content: 'Handle errors with centralized middleware.', originUrl: 'https://expressjs.com/en/guide/error-handling.html' });
    sourceIds.push(created.body.id);
    expect(created.status).toBe(201);
    expect((await request(app).get('/api/knowledge-sources')).body.items.some((item: { id: string }) => item.id === created.body.id)).toBe(true);
    expect((await request(app).patch(`/api/knowledge-sources/${created.body.id}`).send({ title: 'Updated source' })).status).toBe(200);
    expect((await request(app).delete(`/api/knowledge-sources/${created.body.id}`)).status).toBe(204);
  });

  it('normalizes optional Origin URL values and rejects invalid nonempty URLs on create and update', async () => {
    const base = { title: 'Origin URL validation', sourceType: 'DOCUMENTATION', content: 'A source used to verify optional origin URL behavior.' };
    for (const originUrl of [undefined, null, '', '   '] as const) {
      const payload = originUrl === undefined ? base : { ...base, originUrl };
      const created = await request(app).post('/api/knowledge-sources').send(payload);
      expect(created.status).toBe(201); expect(created.body.originUrl).toBeNull(); sourceIds.push(created.body.id);
    }
    for (const originUrl of ['https://example.com/docs', 'http://example.com/docs']) {
      const created = await request(app).post('/api/knowledge-sources').send({ ...base, originUrl });
      expect(created.status).toBe(201); expect(created.body.originUrl).toBe(originUrl); sourceIds.push(created.body.id);
    }
    expect((await request(app).post('/api/knowledge-sources').send({ ...base, originUrl: 'not a URL' })).status).toBe(400);
    expect((await request(app).post('/api/knowledge-sources').send({ ...base, originUrl: 'ftp://example.com/docs' })).status).toBe(400);
    const editable = await request(app).post('/api/knowledge-sources').send({ ...base, originUrl: 'https://example.com/original' }); sourceIds.push(editable.body.id);
    const cleared = await request(app).patch(`/api/knowledge-sources/${editable.body.id}`).send({ originUrl: null });
    expect(cleared.status).toBe(200); expect(cleared.body.originUrl).toBeNull();
    const clearedWhitespace = await request(app).patch(`/api/knowledge-sources/${editable.body.id}`).send({ originUrl: '  ' });
    expect(clearedWhitespace.status).toBe(200); expect(clearedWhitespace.body.originUrl).toBeNull();
    const updated = await request(app).patch(`/api/knowledge-sources/${editable.body.id}`).send({ originUrl: 'https://example.com/updated' });
    expect(updated.status).toBe(200); expect(updated.body.originUrl).toBe('https://example.com/updated');
    expect((await request(app).patch(`/api/knowledge-sources/${editable.body.id}`).send({ originUrl: 'ftp://example.com/invalid' })).status).toBe(400);
  });

  it('creates and removes a knowledge source evidence relationship', async () => {
    const investigation = await request(app).post('/api/investigations').send({ title: 'Runtime error', description: 'An investigation used to verify source association.', technologyTags: [] });
    const source = await request(app).post('/api/knowledge-sources').send({ title: 'Incident note', sourceType: 'INCIDENT', content: 'An incident timeline from the engineering team.' });
    investigationIds.push(investigation.body.id); sourceIds.push(source.body.id);
    const evidence = await request(app).post(`/api/investigations/${investigation.body.id}/evidence`).send({ knowledgeSourceId: source.body.id, note: 'Relevant failure pattern.' });
    expect(evidence.status).toBe(201);
    expect((await request(app).get(`/api/investigations/${investigation.body.id}/evidence`)).body).toHaveLength(1);
    expect((await request(app).delete(`/api/investigations/${investigation.body.id}/evidence/${evidence.body.id}`)).status).toBe(204);
  });
});
