import { useEffect, useState } from 'react';

const readPreference = () => {
  try {
    return localStorage.getItem('theme') || 'system';
  } catch {
    return 'system';
  }
};

const systemPrefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

// 'light' | 'dark' | 'system'; applied as data-theme on <html>
export function useTheme() {
  const [preference, setPreference] = useState(readPreference);

  useEffect(() => {
    const apply = () => {
      const dark = preference === 'dark' || (preference === 'system' && systemPrefersDark());
      document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    };
    apply();
    try {
      localStorage.setItem('theme', preference);
    } catch {
      // Storage can be unavailable (private mode); the theme still applies for this visit
    }
    if (preference !== 'system') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [preference]);

  return [preference, setPreference];
}
