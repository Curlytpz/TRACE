type ConnectionStatusProps = {
  state: 'loading' | 'connected' | 'error';
  message?: string;
};

const stateStyles = {
  loading: 'bg-amber-400',
  connected: 'bg-accent-500',
  error: 'bg-rose-500',
} as const;

export function ConnectionStatus({ state, message }: ConnectionStatusProps) {
  const label = state === 'loading' ? 'Checking API' : state === 'connected' ? 'API connected' : 'API unavailable';

  return (
    <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300" title={message}>
      <span className={`h-2 w-2 rounded-full ${stateStyles[state]} ${state === 'loading' ? 'animate-pulse' : ''}`} />
      <span>{label}</span>
    </div>
  );
}
