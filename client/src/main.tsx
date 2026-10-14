import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App';
import { applyTheme, getThemePreference } from './lib/theme';

applyTheme(getThemePreference(), false);

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
