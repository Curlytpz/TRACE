import { describe, expect, it, vi } from 'vitest';
import { GeminiEmbeddingProvider } from '../src/services/embeddings/provider.js';

const dimensions = 768;
const validVector = Array.from({ length: dimensions }, (_value, index) => (index + 1) / 10_000);
const success = (values: unknown) => new Response(JSON.stringify({ embedding: { values } }), { status: 200 });
const providerFor = (response: Response) => new GeminiEmbeddingProvider('test-key', 'gemini-embedding-001', dimensions, vi.fn(async () => response) as unknown as typeof fetch, async () => {});

describe('GeminiEmbeddingProvider', () => {
  it('extracts the documented single-request embedding.values field and requires all 768 finite values', async () => {
    const fetchMock = vi.fn(async () => success(validVector)) as unknown as typeof fetch;
    const provider = new GeminiEmbeddingProvider('test-key', 'gemini-embedding-001', dimensions, fetchMock, async () => {});
    await expect(provider.embed(['trace content'], 'RETRIEVAL_DOCUMENT')).resolves.toEqual([validVector]);
    const [, init] = vi.mocked(fetchMock).mock.calls[0]!; const body = JSON.parse(String(init?.body));
    expect(body).toEqual({ model: 'models/gemini-embedding-001', content: { parts: [{ text: 'trace content' }] }, taskType: 'RETRIEVAL_DOCUMENT', outputDimensionality: dimensions });
    expect(body).not.toHaveProperty('embedContentConfig');
    expect(init?.headers).toMatchObject({ 'x-goog-api-key': 'test-key' });
  });
  it('rejects a missing values field, an incorrect dimension, and non-finite or non-numeric values', async () => {
    await expect(providerFor(new Response(JSON.stringify({ embedding: {} }), { status: 200 })).embed(['x'], 'RETRIEVAL_DOCUMENT')).rejects.toMatchObject({ message: 'Gemini returned an embedding response without numeric values.' });
    await expect(providerFor(success(validVector.slice(0, 767))).embed(['x'], 'RETRIEVAL_DOCUMENT')).rejects.toMatchObject({ message: 'Gemini returned an embedding with 767 dimensions; expected configured 768 dimensions.' });
    const invalid = [...validVector]; invalid[12] = Number.NaN;
    await expect(providerFor(success(invalid)).embed(['x'], 'RETRIEVAL_DOCUMENT')).rejects.toMatchObject({ message: 'Gemini returned an embedding with non-numeric or non-finite values.' });
  });
  it('retries a rate-limited request once and preserves the query task type', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': '0' } })).mockResolvedValueOnce(success(validVector)) as unknown as typeof fetch;
    const sleep = vi.fn(async () => {}); const provider = new GeminiEmbeddingProvider('test-key', 'gemini-embedding-001', dimensions, fetchMock, sleep);
    await expect(provider.embed(['timeout'], 'RETRIEVAL_QUERY')).resolves.toEqual([validVector]);
    expect(fetchMock).toHaveBeenCalledTimes(2); expect(sleep).toHaveBeenCalledOnce();
    const [, init] = vi.mocked(fetchMock).mock.calls[1]!;
    expect(JSON.parse(String(init?.body))).toEqual({ model: 'models/gemini-embedding-001', content: { parts: [{ text: 'timeout' }] }, taskType: 'RETRIEVAL_QUERY', outputDimensionality: dimensions });
  });
  it('returns a clear rate-limit error after the retry is exhausted', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 429 })) as unknown as typeof fetch;
    const provider = new GeminiEmbeddingProvider('test-key', 'gemini-embedding-001', dimensions, fetchMock, async () => {});
    await expect(provider.embed(['timeout'], 'RETRIEVAL_QUERY')).rejects.toMatchObject({ status: 429, message: 'Gemini embedding requests are rate limited. Retry later.' });
  });
});
