import { Monitor, Moon, Sun } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import type { ThemePreference } from '../lib/theme';

const options = [
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
] as const;

export function AppearanceSelector({ preference, onChange, idPrefix = 'appearance' }: { preference: ThemePreference; onChange: (value: ThemePreference) => void; idPrefix?: string }) {
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const offset = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    const next = (index + offset + options.length) % options.length;
    onChange(options[next].value);
    document.getElementById(`${idPrefix}-${options[next].value}`)?.focus();
  };
  return <div className="appearance-selector" role="radiogroup" aria-label="Appearance">
    {options.map(({ value, label, Icon }, index) => <button id={`${idPrefix}-${value}`} key={value} role="radio" aria-label={`Use ${label.toLowerCase()} appearance`} title={label} aria-checked={preference === value} tabIndex={preference === value ? 0 : -1} className={`appearance-option ${preference === value ? 'appearance-option-active' : ''}`} onClick={() => onChange(value)} onKeyDown={(event) => move(event, index)}><Icon aria-hidden="true" /></button>)}
  </div>;
}
