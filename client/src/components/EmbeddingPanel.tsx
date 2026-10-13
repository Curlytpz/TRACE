import { useEffect, useState } from 'react';
import { embedKnowledgeSource, getEmbeddingStatus } from '../lib/api';
import type { EmbeddingStatus } from '../lib/api';
const fail = (reason: unknown) => reason instanceof Error ? reason.message : 'Embedding request failed.';
export function EmbeddingPanel({ sourceId }: { sourceId: string }) {
  const [status, setStatus] = useState<EmbeddingStatus>(); const [error, setError] = useState(''); const [running, setRunning] = useState(false); const [notice, setNotice] = useState('');
  const refresh = () => { setError(''); getEmbeddingStatus(sourceId).then(setStatus).catch((reason) => setError(fail(reason))); };
  useEffect(() => { refresh(); }, [sourceId]);
  const embed = async () => { setRunning(true); setError(''); setNotice(''); try { const result = await embedKnowledgeSource(sourceId); setNotice(`Embedded ${result.embeddedCount} chunk(s); reused ${result.cachedCount} current embedding(s).`); refresh(); } catch (reason) { setError(fail(reason)); } finally { setRunning(false); } };
  return <section className="panel"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Semantic retrieval</p><h3 className="mt-1 font-semibold">Embeddings</h3></div><button className="secondary-button" disabled={running || status?.status === 'UNAVAILABLE' || status?.status === 'NOT_INGESTED'} onClick={() => void embed()}>{running ? 'Embedding…' : 'Generate embeddings'}</button></div>{!status ? <p className="mt-3 text-sm text-slate-500">Checking embedding availability…</p> : <><p className="mt-3 text-sm text-slate-500">{status.status === 'UNAVAILABLE' ? status.reason : `${status.currentEmbeddingCount} of ${status.totalChunks} current chunks embedded with ${status.provider} / ${status.model}.`}</p><p className="mt-2 text-xs text-slate-500">JSON-vector storage is a bounded local fallback. It does not use an AI provider unless one is explicitly configured.</p></>}{notice && <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">{notice}</p>}{error && <p className="mt-3 text-sm text-rose-700 dark:text-rose-400">{error}</p>}</section>;
}
