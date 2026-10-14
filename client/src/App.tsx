import { useEffect, useState } from 'react';
import { BookOpen, History, LayoutDashboard, Menu, Plus, ScanSearch, Settings2, X, type LucideIcon } from 'lucide-react';
import { AppearanceSelector } from './components/AppearanceSelector';
import { ConnectionStatus } from './components/ConnectionStatus';
import { InvestigationDetails, InvestigationForm, InvestigationHistory, KnowledgeSourceDetails, KnowledgeSources, Overview } from './components/WorkspaceViews';
import { SearchView } from './components/SearchView';
import { getHealth } from './lib/api';
import { applyTheme, getThemePreference } from './lib/theme';
import type { ThemePreference } from './lib/theme';

export type View = 'overview' | 'new' | 'history' | 'sources' | 'search' | 'settings';
type HealthState = 'loading' | 'connected' | 'error';
const navItems: Array<{ id: View; label: string; icon: LucideIcon }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard }, { id: 'new', label: 'New investigation', icon: Plus },
  { id: 'history', label: 'History', icon: History }, { id: 'sources', label: 'Knowledge sources', icon: BookOpen },
  { id: 'search', label: 'Evidence search', icon: ScanSearch }, { id: 'settings', label: 'Settings', icon: Settings2 },
];

export function App() {
  const [view, setView] = useState<View>('overview');
  const [health, setHealth] = useState<HealthState>('loading');
  const [healthError, setHealthError] = useState<string>();
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => getThemePreference());
  const [investigationId, setInvestigationId] = useState<string>();
  const [sourceId, setSourceId] = useState<string>();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const checkHealth = () => { setHealth('loading'); setHealthError(undefined); getHealth().then(() => setHealth('connected')).catch((error: unknown) => { setHealth('error'); setHealthError(error instanceof Error ? error.message : 'Unable to reach the API.'); }); };
  useEffect(() => { checkHealth(); }, []);
  useEffect(() => { applyTheme(themePreference); const media = window.matchMedia('(prefers-color-scheme: dark)'); const updateSystemTheme = () => { if (themePreference === 'system') applyTheme('system', false); }; media.addEventListener('change', updateSystemTheme); return () => media.removeEventListener('change', updateSystemTheme); }, [themePreference]);
  useEffect(() => { if (!mobileMenuOpen) return; const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMobileMenuOpen(false); }; window.addEventListener('keydown', closeOnEscape); return () => window.removeEventListener('keydown', closeOnEscape); }, [mobileMenuOpen]);
  const changeView = (next: View) => { setView(next); setMobileMenuOpen(false); if (next !== 'history') setInvestigationId(undefined); if (next !== 'sources') setSourceId(undefined); };
  const chooseTheme = (preference: ThemePreference) => setThemePreference(preference);
  const openInvestigation = (id: string) => { setInvestigationId(id); setView('history'); };
  const openSource = (id: string) => { setSourceId(id); setView('sources'); };
  const title = navItems.find((item) => item.id === view)?.label ?? 'Overview';
  const navigation = (mobile = false) => { const items = mobile ? navItems.slice(0, 4) : navItems; return <nav aria-label="Workspace" className={mobile ? 'trace-mobile-nav' : undefined}>{items.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => changeView(item.id)} aria-current={view === item.id ? 'page' : undefined} className={`nav-item ${view === item.id ? 'nav-item-active' : ''}`}><span className="nav-icon" aria-hidden="true"><Icon /></span><span className={mobile ? 'sr-only' : undefined}>{item.label}</span></button>; })}{mobile && <button className={`nav-item ${mobileMenuOpen ? 'nav-item-active' : ''}`} onClick={() => setMobileMenuOpen((open) => !open)} aria-label="More navigation" aria-expanded={mobileMenuOpen}><span className="nav-icon" aria-hidden="true">{mobileMenuOpen ? <X /> : <Menu />}</span><span className="sr-only">More</span></button>}</nav>; };
  return <div className="trace-app min-h-screen">
    <div className="trace-wall" aria-hidden="true"><svg className="trace-ribbons" viewBox="0 0 1200 700" preserveAspectRatio="none" aria-hidden="true"><defs><filter id="wb" x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur stdDeviation="46" /></filter><linearGradient id="g1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" style={{ stopColor: 'var(--w1)' }} /><stop offset=".55" style={{ stopColor: 'var(--w2)' }} /><stop offset="1" style={{ stopColor: 'var(--w3)' }} /></linearGradient><linearGradient id="g2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={{ stopColor: 'var(--w4)' }} /><stop offset=".5" style={{ stopColor: 'var(--w1)' }} /><stop offset="1" style={{ stopColor: 'var(--w2)' }} /></linearGradient><linearGradient id="g3" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={{ stopColor: 'var(--w3)' }} /><stop offset="1" style={{ stopColor: 'var(--w4)' }} /></linearGradient></defs><g filter="url(#wb)" style={{ opacity: 'var(--wo)' }}><path d="M-120 200 C 200 60, 470 330, 760 190 S 1100 40, 1320 130 L1320 430 C 1010 540, 700 360, 430 470 S 110 400, -120 460 Z" fill="url(#g2)" /><path d="M-120 540 C 200 400, 420 660, 700 500 S 1100 320, 1320 400 L1320 800 L-120 800 Z" fill="url(#g1)" /><path d="M560 -80 C 720 140, 900 40, 1320 250 L1320 -80 Z" fill="url(#g3)" /></g></svg></div>
    <aside className="trace-sidebar glass"><div className="trace-brand"><img className="trace-brand-symbol" src="/trace-mark.png" alt="" /><div><b className="trace-brand-title">TRACE</b><small className="trace-brand-copy">Investigation Workspace</small></div></div>{navigation()}<div className="sidebar-footer"><div><p className="appearance-label">Appearance</p><AppearanceSelector preference={themePreference} onChange={chooseTheme} idPrefix="sidebar-appearance" /></div><div className="api-status"><ConnectionStatus state={health} message={healthError} /></div></div></aside>
    <main className="trace-main"><div className="trace-wrap"><header className="trace-topbar"><span className="mobile-wordmark"><img src="/trace-mark.png" alt="" />TRACE</span><h1>{title}</h1><div className="topbar-actions">{view !== 'new' && <button onClick={() => changeView('new')} className="primary-button"><Plus />New investigation</button>}</div></header><div className="app-content">
      {view === 'overview' && <Overview onNew={() => changeView('new')} onHistory={() => changeView('history')} onOpen={openInvestigation} onSources={() => changeView('sources')} />}
      {view === 'new' && <InvestigationForm onCreated={openInvestigation} />}
      {view === 'history' && (investigationId ? <InvestigationDetails id={investigationId} onBack={() => setInvestigationId(undefined)} onDeleted={() => setInvestigationId(undefined)} onOpenSource={openSource} /> : <InvestigationHistory onOpen={openInvestigation} onNew={() => changeView('new')} />)}
      {view === 'search' && <SearchView onOpenSource={openSource} />}
      {view === 'sources' && (sourceId ? <KnowledgeSourceDetails id={sourceId} onBack={() => setSourceId(undefined)} onDeleted={() => setSourceId(undefined)} onOpenInvestigation={openInvestigation} /> : <KnowledgeSources onOpen={openSource} />)}
      {view === 'settings' && <section className="max-w-3xl"><p className="eyebrow">Preferences</p><h2 className="page-heading">Settings</h2><p className="page-copy">Personalize this local workspace without changing API or data settings.</p><div className="section-panel mt-4"><div className="data-row"><div><b>Appearance</b><small>Your preference is saved locally on this device.</small></div><AppearanceSelector preference={themePreference} onChange={chooseTheme} idPrefix="settings-appearance" /></div><div className="data-row"><div><b>Workspace access</b><small>Authentication is not implemented. Do not deploy this API publicly.</small></div></div></div></section>}
    </div></div></main>
    {mobileMenuOpen && <div className="mobile-menu-sheet" role="dialog" aria-label="More navigation"><div className="mobile-menu-backdrop" onClick={() => setMobileMenuOpen(false)} /><div className="mobile-menu-content glass"><div className="flex items-center justify-between"><p className="text-sm font-semibold">More</p><button className="icon-control cap-button" onClick={() => setMobileMenuOpen(false)} aria-label="Close navigation menu"><X /></button></div>{navItems.slice(4).map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => changeView(item.id)} className={`nav-item mt-2 w-full ${view === item.id ? 'nav-item-active' : ''}`}><span className="nav-icon"><Icon /></span>{item.label}</button>; })}<div className="mobile-appearance"><p className="appearance-label">Appearance</p><AppearanceSelector preference={themePreference} onChange={chooseTheme} idPrefix="mobile-appearance" /></div></div></div>}
    {navigation(true)}
  </div>;
}
