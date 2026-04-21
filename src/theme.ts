import { createSignal, type Accessor } from 'solid-js';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'hyasynth.theme';

function readStored(): Theme {
  if (typeof window === 'undefined') return 'light';
  return window.localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
}

function writeStored(theme: Theme): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // private-mode or storage blocked — theme still works for the session.
  }
}

function apply(theme: Theme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

// Apply the stored theme synchronously at module load so the first paint
// already has the right palette — avoids a flash of the wrong theme.
apply(readStored());

const [theme, setThemeSignal] = createSignal<Theme>(readStored());

export function getTheme(): Accessor<Theme> {
  return theme;
}

export function setTheme(next: Theme): void {
  setThemeSignal(next);
  apply(next);
  writeStored(next);
}

export function toggleTheme(): void {
  setTheme(theme() === 'light' ? 'dark' : 'light');
}
