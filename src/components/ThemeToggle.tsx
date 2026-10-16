import React, { useEffect, useState } from 'react';

export interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '' }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [rotations, setRotations] = useState<number>(1);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('roadster-theme');
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const initial = saved === 'light' || saved === 'dark' ? saved : isSystemDark ? 'dark' : 'light';
      setTheme(initial);
      setRotations(initial === 'dark' ? 1 : 0);
      document.documentElement.dataset.theme = initial;
    } catch {
      // ignore
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    const nextRot = rotations + 1;
    setTheme(next);
    setRotations(nextRot);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('roadster-theme', next);
    } catch {
      // ignore
    }
  };

  return (
    <button
      className={`icon theme ${className}`}
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        style={{
          transform: `rotate(${rotations * 180}deg)`,
          transition: 'transform 500ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 1.5v11a5.5 5.5 0 0 1 0-11Z" />
      </svg>
    </button>
  );
};
