import { env } from '../../config.js';
import { AppError } from '../../errors.js';
import type { EmbeddingAvailability, EmbeddingProvider, EmbeddingTaskType } from './types.js';

const OPENAI_EMBEDDINGS_URL = 'https://api.openai.com/v1/embeddings';
const GEMINI_API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models';
type FetchImplementation = typeof fetch;
type Sleep = (milliseconds: number) => Promise<void>;
const wait: Sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

class UnavailableEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'disabled';
  readonly model = 'unconfigured';
  constructor(private readonly reason: string) {}
  availability(): EmbeddingAvailability { return { available: false, reason: this.reason }; }
  async embed(_texts: string[], _taskType: EmbeddingTaskType): Promise<number[][]> { throw new AppError(503, this.reason); }
}

class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'openai';
  readonly model: string;
  constructor(private readonly apiKey: string, model: string) { this.model = model; }
  availability(): EmbeddingAvailability { return { available: true }; }
  async embed(texts: string[], _taskType: EmbeddingTaskType): Promise<number[][]> {
    if (texts.length === 0) return [];
    let response: Response;
    try { response = await fetch(OPENAI_EMBEDDINGS_URL, { method: 'POST', headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: this.model, input: texts, encoding_format: 'float' }) }); } catch { throw new AppError(502, 'The configured embedding provider could not be reached.'); }
    if (!response.ok) throw new AppError(502, 'The configured embedding provider rejected the embedding request.');
    const body: unknown = await response.json().catch(() => undefined);
    if (!body || typeof body !== 'object' || !Array.isArray((body as { data?: unknown }).data)) throw new AppError(502, 'The configured embedding provider returned an invalid response.');
    const rows = (body as { data: Array<{ index?: unknown; embedding?: unknown }> }).data; const ordered = [...rows].sort((a, b) => Number(a.index) - Number(b.index));
    if (ordered.length !== texts.length || ordered.some((row) => !Array.isArray(row.embedding))) throw new AppError(502, 'The configured embedding provider returned incomplete embeddings.');
    return ordered.map((row) => row.embedding as number[]);
  }
}

function retryDelay(response: Response): number { const seconds = Number(response.headers.get('retry-after')); return Number.isFinite(seconds) && seconds >= 0 ? Math.min(Math.round(seconds * 1000), 2_000) : 300; }
function parseGeminiEmbedding(payload: unknown, expectedDimensions: number): number[] {
  const values = payload && typeof payload === 'object' ? (payload as { embedding?: { values?: unknown } }).embedding?.values : undefined;
  if (!Array.isArray(values)) throw new AppError(502, 'Gemini returned an embedding response without numeric values.');
  if (values.length !== expectedDimensions) throw new AppError(502, `Gemini returned an embedding with ${values.length} dimensions; expected configured ${expectedDimensions} dimensions.`);
  if (values.some((value) => typeof value !== 'number' || !Number.isFinite(value))) throw new AppError(502, 'Gemini returned an embedding with non-numeric or non-finite values.');
  return values;
}
/** Official Gemini REST adapter. It does no work until an embedding operation explicitly calls it. */
export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly id = 'gemini';
  constructor(private readonly apiKey: string, readonly model: string, readonly dimensions: number, private readonly fetchImplementation: FetchImplementation = fetch, private readonly sleep: Sleep = wait) {}
  availability(): EmbeddingAvailability { return { available: true }; }
  async embed(texts: string[], taskType: EmbeddingTaskType): Promise<number[][]> {
    const vectors: number[][] = [];
    for (const text of texts) vectors.push(await this.embedOne(text, taskType));
    return vectors;
  }
  private async embedOne(text: string, taskType: EmbeddingTaskType): Promise<number[]> {
    const endpoint = `${GEMINI_API_ROOT}/${encodeURIComponent(this.model)}:embedContent`;
    // TRACE uses the raw v1beta REST endpoint rather than Google's SDK. Its
    // top-level fields are the compatible wire format for task type and
    // reduced dimensionality; the nested SDK-style config was accepted but
    // ignored, causing Gemini to return its default 3,072-dimension vector.
    const body = JSON.stringify({ model: `models/${this.model}`, content: { parts: [{ text }] }, taskType, outputDimensionality: this.dimensions });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let response: Response;
      try { response = await this.fetchImplementation(endpoint, { method: 'POST', headers: { 'x-goog-api-key': this.apiKey, 'Content-Type': 'application/json' }, body, signal: AbortSignal.timeout(15_000) }); }
      catch (error) { if (error instanceof DOMException && error.name === 'TimeoutError') throw new AppError(504, 'Gemini embedding request timed out.'); if (attempt === 0) { await this.sleep(300); continue; } throw new AppError(502, 'Gemini embedding provider could not be reached.'); }
      if (response.ok) { const payload: unknown = await response.json().catch(() => undefined); return parseGeminiEmbedding(payload, this.dimensions); }
      if ((response.status === 429 || response.status >= 500) && attempt === 0) { await this.sleep(retryDelay(response)); continue; }
      if (response.status === 429) throw new AppError(429, 'Gemini embedding requests are rate limited. Retry later.');
      throw new AppError(502, 'Gemini rejected the embedding request. Verify the configured model and API access.');
    }
    throw new AppError(502, 'Gemini embedding provider could not be reached.');
  }
}

type EmbeddingConfiguration = Pick<typeof env, 'EMBEDDING_PROVIDER' | 'OPENAI_API_KEY' | 'OPENAI_EMBEDDING_MODEL' | 'GEMINI_API_KEY' | 'GEMINI_EMBEDDING_MODEL' | 'GEMINI_EMBEDDING_DIMENSIONS'>;
export function createEmbeddingProvider(configuration: EmbeddingConfiguration): EmbeddingProvider {
  if (configuration.EMBEDDING_PROVIDER === 'openai' && configuration.OPENAI_API_KEY) return new OpenAiEmbeddingProvider(configuration.OPENAI_API_KEY, configuration.OPENAI_EMBEDDING_MODEL);
  if (configuration.EMBEDDING_PROVIDER === 'openai') return new UnavailableEmbeddingProvider('Semantic search is unavailable because OPENAI_API_KEY is not configured.');
  if (configuration.EMBEDDING_PROVIDER === 'gemini' && configuration.GEMINI_API_KEY) return new GeminiEmbeddingProvider(configuration.GEMINI_API_KEY, configuration.GEMINI_EMBEDDING_MODEL, configuration.GEMINI_EMBEDDING_DIMENSIONS);
  if (configuration.EMBEDDING_PROVIDER === 'gemini') return new UnavailableEmbeddingProvider('Semantic search is unavailable because GEMINI_API_KEY is not configured.');
  return new UnavailableEmbeddingProvider('Semantic search is disabled. Configure an embedding provider to enable it.');
}
let testProvider: EmbeddingProvider | undefined;
export function getEmbeddingProvider(): EmbeddingProvider {
  return testProvider ?? createEmbeddingProvider(env);
}
/** Test-only dependency injection. It is never selected for a production request. */
export function setEmbeddingProviderForTests(provider: EmbeddingProvider | undefined): void { testProvider = provider; }
