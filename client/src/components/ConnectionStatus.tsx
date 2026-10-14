type ConnectionStatusProps = { state: 'loading' | 'connected' | 'error'; message?: string };

export function ConnectionStatus({ state, message }: ConnectionStatusProps) {
  const label = state === 'loading' ? 'Checking API' : state === 'connected' ? 'API connected' : 'API unavailable';
  return <span className="inline-flex items-center gap-2" title={message}><span className="status-dot" data-state={state} /><span>{label}</span></span>;
}
