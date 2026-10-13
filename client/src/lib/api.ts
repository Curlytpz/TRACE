export type InvestigationStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'ARCHIVED';
export type KnowledgeSourceType = 'DOCUMENTATION' | 'ERROR_LOG' | 'DEVELOPER_NOTE' | 'INCIDENT' | 'REPOSITORY';
export type Investigation = { id: string; title: string; description: string; errorLogs: string | null; technologyTags: string[]; status: InvestigationStatus; createdAt: string; updatedAt: string };
export type KnowledgeSource = { id: string; title: string; sourceType: KnowledgeSourceType; content: string; originUrl: string | null; createdAt: string; updatedAt: string };
export type Evidence = { id: string; note: string | null; createdAt: string; knowledgeSource: KnowledgeSource };
export type InvestigationDetail = Investigation & { evidence: Evidence[] };
export type KnowledgeSourceDetail = KnowledgeSource & { evidence: Array<{ id: string; investigation: Investigation }> };
export type Page<T> = { items: T[]; page: number; pageSize: number; total: number };
export type HealthResponse = { status: 'ok'; service: string };
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000';
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(body.error ?? `Request failed with status ${response.status}`);
  return body as T;
}
export function getHealth(signal?: AbortSignal) { return api<HealthResponse>('/api/health', { signal }); }
export function getInvestigations() { return api<Page<Investigation>>('/api/investigations'); }
export function getInvestigation(id: string) { return api<InvestigationDetail>(`/api/investigations/${id}`); }
export function createInvestigation(data: Pick<Investigation, 'title' | 'description' | 'errorLogs' | 'technologyTags'>) { return api<Investigation>('/api/investigations', { method: 'POST', body: JSON.stringify(data) }); }
export function updateInvestigation(id: string, data: Partial<Pick<Investigation, 'title' | 'description' | 'errorLogs' | 'technologyTags' | 'status'>>) { return api<Investigation>(`/api/investigations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
export function deleteInvestigation(id: string) { return api<void>(`/api/investigations/${id}`, { method: 'DELETE' }); }
export function getKnowledgeSources() { return api<Page<KnowledgeSource>>('/api/knowledge-sources'); }
export function getKnowledgeSource(id: string) { return api<KnowledgeSourceDetail>(`/api/knowledge-sources/${id}`); }
function normalizeOriginUrl(value: string | null | undefined) { return value?.trim() || null; }
export function createKnowledgeSource(data: Pick<KnowledgeSource, 'title' | 'sourceType' | 'content' | 'originUrl'>) { return api<KnowledgeSource>('/api/knowledge-sources', { method: 'POST', body: JSON.stringify({ ...data, originUrl: normalizeOriginUrl(data.originUrl) }) }); }
export function updateKnowledgeSource(id: string, data: Partial<Pick<KnowledgeSource, 'title' | 'sourceType' | 'content' | 'originUrl'>>) { const payload = data.originUrl === undefined ? data : { ...data, originUrl: normalizeOriginUrl(data.originUrl) }; return api<KnowledgeSource>(`/api/knowledge-sources/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }); }
export function deleteKnowledgeSource(id: string) { return api<void>(`/api/knowledge-sources/${id}`, { method: 'DELETE' }); }
export function addEvidence(investigationId: string, knowledgeSourceId: string, note?: string) { return api<Evidence>(`/api/investigations/${investigationId}/evidence`, { method: 'POST', body: JSON.stringify({ knowledgeSourceId, note: note || undefined }) }); }
export function deleteEvidence(investigationId: string, evidenceId: string) { return api<void>(`/api/investigations/${investigationId}/evidence/${evidenceId}`, { method: 'DELETE' }); }
export type AnalysisSection = { text: string; citations: string[] };
export type InvestigationAnalysis = { question: string; answer: { summary: AnalysisSection; findings: AnalysisSection[]; possibleCauses: AnalysisSection[]; recommendedChecks: AnalysisSection[]; limitations: AnalysisSection[] }; citations: Array<{ citationId: string; chunkId: string; knowledgeSourceId: string; sourceTitle: string; chunkIndex: number; content: string }>; retrieval: { mode: 'hybrid' | 'keyword_only' }; limitations: string[]; provider: { id: string; model: string } };
export function analyzeInvestigation(id: string, question: string) { return api<InvestigationAnalysis>(`/api/investigations/${id}/analyze`, { method: 'POST', body: JSON.stringify({ question }) }); }

export type KnowledgeChunk = { id: string; knowledgeSourceId: string; chunkIndex: number; content: string; contentHash: string; startOffset: number; endOffset: number; sectionHeading: string | null; createdAt: string; updatedAt: string };
export type IngestionStatus = { knowledgeSourceId: string; status: 'COMPLETED' | 'NOT_INGESTED'; chunkCount: number; isCurrent: boolean; offsetUnit: string };
export function ingestKnowledgeSource(id: string) { return api<{ knowledgeSourceId: string; status: 'COMPLETED'; chunkCount: number; reingested: boolean }>(`/api/knowledge-sources/${id}/ingest`, { method: 'POST' }); }
export function getKnowledgeChunks(id: string) { return api<{ items: KnowledgeChunk[]; offsetUnit: string }>(`/api/knowledge-sources/${id}/chunks`); }
export function getIngestionStatus(id: string) { return api<IngestionStatus>(`/api/knowledge-sources/${id}/ingestion-status`); }

export type SearchResult = { chunkId: string; knowledgeSourceId: string; sourceTitle: string; chunkIndex: number; content: string; sectionHeading: string | null; score: number; startOffset: number; endOffset: number };
export type SearchResponse = { query: string; results: SearchResult[]; pagination: { total: number; page: number; limit: number; totalPages: number } };
export function searchKnowledge(q: string, options: { investigationId?: string; page?: number; limit?: number } = {}) {
  const params = new URLSearchParams({ q, page: String(options.page ?? 1), limit: String(options.limit ?? 10) });
  if (options.investigationId) params.set('investigationId', options.investigationId);
  return api<SearchResponse>(`/api/search?${params}`);
}


export type EmbeddingStatus = { knowledgeSourceId: string; status: 'NOT_INGESTED' | 'UNAVAILABLE' | 'NOT_EMBEDDED' | 'PARTIAL' | 'COMPLETED'; totalChunks: number; currentEmbeddingCount: number; provider: string; model: string; available: boolean; reason?: string };
export type SemanticSearchResponse = SearchResponse & { coverage: { totalCurrentChunks: number; compatibleEmbeddedChunks: number; complete: boolean; candidateLimit: number; provider: string; model: string } };
export type HybridSearchResult = Omit<SearchResult, 'score'> & { keywordRank: number | null; semanticRank: number | null; keywordScore: number | null; semanticScore: number | null; fusionScore: number };
export type HybridSearchResponse = { query: string; results: HybridSearchResult[]; pagination: { total: number; page: number; limit: number; totalPages: number; isWindowed: boolean }; mode: 'hybrid' | 'keyword_only'; branches: { keyword: { available: true; candidateCount: number; totalMatches: number }; semantic: { available: boolean; candidateCount: number; provider?: string; model?: string; coverage?: SemanticSearchResponse['coverage']; failure?: { code: string; reason: string } } }; retrievalWindow: { rrfK: number; candidateLimitPerBranch: number; fusedCandidateCount: number; isWindowed: boolean } };
export function embedKnowledgeSource(id: string) { return api<{ knowledgeSourceId: string; status: 'COMPLETED'; chunkCount: number; embeddedCount: number; cachedCount: number; provider: string; model: string }>(`/api/knowledge-sources/${id}/embed`, { method: 'POST' }); }
export function getEmbeddingStatus(id: string) { return api<EmbeddingStatus>(`/api/knowledge-sources/${id}/embedding-status`); }
export function searchSemanticKnowledge(q: string, options: { investigationId?: string; page?: number; limit?: number } = {}) { const params = new URLSearchParams({ q, page: String(options.page ?? 1), limit: String(options.limit ?? 10) }); if (options.investigationId) params.set('investigationId', options.investigationId); return api<SemanticSearchResponse>(`/api/search/semantic?${params}`); }
export function searchHybridKnowledge(q: string, options: { investigationId?: string; page?: number; limit?: number } = {}) { const params = new URLSearchParams({ q, page: String(options.page ?? 1), limit: String(options.limit ?? 10) }); if (options.investigationId) params.set('investigationId', options.investigationId); return api<HybridSearchResponse>(`/api/search/hybrid?${params}`); }
