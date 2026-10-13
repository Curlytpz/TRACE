import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './App';

const savedTheme = localStorage.getItem('trace-theme');
const isDark = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
document.documentElement.classList.toggle('dark', isDark);

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
