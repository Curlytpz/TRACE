import { describe, expect, it } from 'vitest';
import { parseEnvironment, serverEnvironmentPath } from '../src/config.js';
import { createEmbeddingProvider } from '../src/services/embeddings/provider.js';

describe('embedding provider configuration', () => {
  it('resolves dotenv from the server package rather than the caller working directory', () => { expect(serverEnvironmentPath.replace(/\\/g, '/')).toMatch(/server\/.env$/); });
  it('recognizes explicit Gemini configuration without making an API request', () => {
    const configuration = parseEnvironment({ EMBEDDING_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-only-key', GEMINI_EMBEDDING_MODEL: 'gemini-embedding-001', GEMINI_EMBEDDING_DIMENSIONS: '768' });
    const provider = createEmbeddingProvider(configuration);
    expect(provider).toMatchObject({ id: 'gemini', model: 'gemini-embedding-001', dimensions: 768 });
    expect(provider.availability()).toEqual({ available: true });
  });
  it('uses disabled only when no provider is configured and reports a missing Gemini key clearly', () => {
    const disabled = createEmbeddingProvider(parseEnvironment({}));
    expect(disabled).toMatchObject({ id: 'disabled', model: 'unconfigured' });
    const missingKey = createEmbeddingProvider(parseEnvironment({ EMBEDDING_PROVIDER: 'gemini' }));
    expect(missingKey.availability()).toEqual({ available: false, reason: 'Semantic search is unavailable because GEMINI_API_KEY is not configured.' });
  });
});
