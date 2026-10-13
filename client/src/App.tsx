import { useEffect, useState } from 'react';
import { ConnectionStatus } from './components/ConnectionStatus';
import { InvestigationDetails, InvestigationForm, InvestigationHistory, KnowledgeSourceDetails, KnowledgeSources, Overview } from './components/WorkspaceViews';
import { SearchView } from './components/SearchView';
import { getHealth } from './lib/api';

export type View = 'overview' | 'new' | 'history' | 'sources' | 'search' | 'settings';
type HealthState = 'loading' | 'connected' | 'error';
const navItems: Array<{ id: View; label: string; icon: string }> = [
  { id: 'overview', label: 'Overview', icon: '◫' }, { id: 'new', label: 'New Investigation', icon: '+' },
  { id: 'history', label: 'Investigation History', icon: '◷' }, { id: 'sources', label: 'Knowledge Sources', icon: '◇' }, { id: 'search', label: 'Evidence Search', icon: '⌕' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

export function App() {
  const [view, setView] = useState<View>('overview');
  const [health, setHealth] = useState<HealthState>('loading');
  const [healthError, setHealthError] = useState<string>();
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
  const [investigationId, setInvestigationId] = useState<string>();
  const [sourceId, setSourceId] = useState<string>();
  const checkHealth = () => { setHealth('loading'); setHealthError(undefined); getHealth().then(() => setHealth('connected')).catch((error: unknown) => { setHealth('error'); setHealthError(error instanceof Error ? error.message : 'Unable to reach the API.'); }); };
  useEffect(() => { checkHealth(); }, []);
  const changeView = (next: View) => { setView(next); if (next !== 'history') setInvestigationId(undefined); if (next !== 'sources') setSourceId(undefined); };
  const toggleTheme = () => { const next = !darkMode; setDarkMode(next); document.documentElement.classList.toggle('dark', next); localStorage.setItem('trace-theme', next ? 'dark' : 'light'); };
  const openInvestigation = (id: string) => { setInvestigationId(id); setView('history'); };
  const openSource = (id: string) => { setSourceId(id); setView('sources'); };
  const title = navItems.find((item) => item.id === view)?.label ?? 'Overview';
  return <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-50">
    <aside className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 md:inset-y-0 md:left-0 md:right-auto md:w-64 md:border-r md:border-t-0">
      <div className="hidden p-6 md:block"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-accent-500 text-lg font-black text-white">T</div><div><p className="font-bold tracking-wide">TRACE</p><p className="text-xs text-slate-500 dark:text-slate-400">Investigation Workspace</p></div></div></div>
      <nav className="mx-auto flex max-w-xl justify-around px-2 py-2 md:block md:px-3">{navItems.map((item) => <button key={item.id} onClick={() => changeView(item.id)} className={`nav-item ${view === item.id ? 'nav-item-active' : ''}`}><span className="text-lg md:text-base">{item.icon}</span><span className="hidden md:inline">{item.label}</span></button>)}</nav>
      <div className="hidden border-t border-slate-200 p-5 dark:border-slate-800 md:block"><ConnectionStatus state={health} message={healthError} /></div>
    </aside>
    <main className="pb-20 md:ml-64 md:pb-0"><header className="flex min-h-20 items-center justify-between border-b border-slate-200 bg-white px-5 dark:border-slate-800 dark:bg-slate-900 md:px-10"><div><p className="text-sm text-slate-500 dark:text-slate-400">TRACE / Workspace</p><h1 className="text-xl font-semibold">{title}</h1></div><div className="flex gap-3"><div className="hidden sm:block"><ConnectionStatus state={health} message={healthError} /></div><button onClick={checkHealth} className="icon-button">↻</button><button onClick={toggleTheme} className="icon-button">{darkMode ? '☀' : '◐'}</button></div></header>
      <div className="mx-auto max-w-6xl p-5 md:p-10">
        {view === 'overview' && <Overview health={health} onNew={() => changeView('new')} onHistory={() => changeView('history')} />}
        {view === 'new' && <InvestigationForm onCreated={openInvestigation} />}
        {view === 'history' && (investigationId ? <InvestigationDetails id={investigationId} onBack={() => setInvestigationId(undefined)} onDeleted={() => setInvestigationId(undefined)} onOpenSource={openSource} /> : <InvestigationHistory onOpen={openInvestigation} onNew={() => changeView('new')} />)}
        {view === 'search' && <SearchView onOpenSource={openSource} />}
        {view === 'sources' && (sourceId ? <KnowledgeSourceDetails id={sourceId} onBack={() => setSourceId(undefined)} onDeleted={() => setSourceId(undefined)} onOpenInvestigation={openInvestigation} /> : <KnowledgeSources onOpen={openSource} />)}
        {view === 'settings' && <section className="max-w-3xl"><p className="eyebrow">Preferences</p><h2 className="mt-1 text-2xl font-semibold">Settings</h2><div className="panel mt-7"><button onClick={toggleTheme} className="secondary-button">Switch to {darkMode ? 'light' : 'dark'} mode</button><p className="mt-5 text-sm text-slate-500">Authentication is not implemented. All persisted data is shared in this configured instance; do not deploy this API publicly.</p></div></section>}
      </div>
    </main>
  </div>;
}
