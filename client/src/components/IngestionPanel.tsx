import { useEffect, useState } from 'react';
import { getIngestionStatus, getKnowledgeChunks, ingestKnowledgeSource } from '../lib/api';
import type { IngestionStatus, KnowledgeChunk } from '../lib/api';

const errorMessage = (value: unknown) => value instanceof Error ? value.message : 'Ingestion failed.';

export function IngestionPanel({ sourceId }: { sourceId: string }) {
  const [status, setStatus] = useState<IngestionStatus>(); const [chunks, setChunks] = useState<KnowledgeChunk[]>([]);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const refresh = () => Promise.all([getIngestionStatus(sourceId), getKnowledgeChunks(sourceId)]).then(([nextStatus, result]) => { setStatus(nextStatus); setChunks(result.items); }).catch((reason) => setError(errorMessage(reason)));
  useEffect(() => { setStatus(undefined); setChunks([]); setError(''); refresh(); }, [sourceId]);
  const ingest = async () => { setBusy(true); setError(''); setNotice(''); try { const result = await ingestKnowledgeSource(sourceId); setNotice(result.reingested ? 'Source chunks refreshed.' : 'Knowledge source ingested.'); await refresh(); } catch (reason) { setError(errorMessage(reason)); } finally { setBusy(false); } };
  return <section className="panel"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">Controlled ingestion</p><h3 className="mt-1 font-semibold">Searchable text chunks</h3></div><button onClick={ingest} disabled={busy} className="primary-button">{busy ? 'Processing…' : status?.isCurrent ? 'Re-ingest' : 'Ingest knowledge'}</button></div>{error && <div className="error-banner mt-4">{error}</div>}{notice && <div className="success-banner mt-4">{notice}</div>}<p className="mt-3 text-sm text-slate-500">{!status ? 'Checking ingestion status…' : status.isCurrent ? `${status.chunkCount} current chunks · ${status.offsetUnit}` : 'Not ingested or source content changed. Ingest to refresh chunks.'}</p>{chunks.length > 0 && <details className="mt-4 rounded-lg border p-3 dark:border-slate-700"><summary className="cursor-pointer text-sm font-medium">Preview {chunks.length} chunks</summary><div className="mt-3 space-y-3">{chunks.map((chunk) => <article key={chunk.id} className="rounded bg-slate-100 p-3 dark:bg-slate-950"><p className="text-xs font-medium text-slate-500">Chunk {chunk.chunkIndex + 1} · offsets {chunk.startOffset}–{chunk.endOffset}{chunk.sectionHeading ? ` · ${chunk.sectionHeading}` : ''}</p><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs">{chunk.content}</pre></article>)}</div></details>}</section>;
}
