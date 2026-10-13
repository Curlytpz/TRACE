import { describe, expect, it } from 'vitest';
import { buildEvidenceContext } from '../src/services/analysis/analyzeInvestigation.js';
import { GeminiGenerationProvider } from '../src/services/generation/provider.js';

describe('analysis safeguards', () => {
  it('deduplicates evidence, assigns stable citation IDs, and excludes whole chunks at context limits', () => {
    const result = buildEvidenceContext([{ chunkId: 'a', knowledgeSourceId: 's', sourceTitle: 'Source', chunkIndex: 0, content: 'one' }, { chunkId: 'a', knowledgeSourceId: 's', sourceTitle: 'Source', chunkIndex: 0, content: 'one' }, { chunkId: 'b', knowledgeSourceId: 's', sourceTitle: 'Source', chunkIndex: 1, content: 'two' }]);
    expect(result.evidence.map((item) => item.id)).toEqual(['E1', 'E2']); expect(result.excluded).toBe(0);
  });
  it('requests Gemini structured JSON and safely rejects malformed responses, rate limits, and truncation', async () => {
    const fetchMock = async () => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"summary":{}}' }] } }] }), { status: 200 });
    const success = new GeminiGenerationProvider('test', 'gemini-2.5-flash', fetchMock as typeof fetch);
    await expect(success.generate('x')).resolves.toBe('{"summary":{}}');
    // A separately captured request verifies responseSchema is nested in generationConfig.
    let body = ''; const captured = new GeminiGenerationProvider('test', 'gemini-2.5-flash', async (_url, init) => { body = String(init?.body); return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{}' }] } }] }), { status: 200 }); });
    await captured.generate('x'); expect(JSON.parse(body).generationConfig).toMatchObject({ responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', required: ['summary', 'findings', 'possibleCauses', 'recommendedChecks', 'limitations'] } });
    const malformed = new GeminiGenerationProvider('test', 'gemini-2.5-flash', async () => new Response(JSON.stringify({ candidates: [] }), { status: 200 }));
    await expect(malformed.generate('x')).rejects.toMatchObject({ status: 502 });
    const limited = new GeminiGenerationProvider('test', 'gemini-2.5-flash', async () => new Response('', { status: 429 }));
    await expect(limited.generate('x')).rejects.toMatchObject({ status: 429 });
    const truncated = new GeminiGenerationProvider('test', 'gemini-2.5-flash', async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS' }] }), { status: 200 }));
    await expect(truncated.generate('x')).rejects.toMatchObject({ message: 'Gemini generation response was truncated before completing the structured answer.' });
  });
});
