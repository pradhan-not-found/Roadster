import React, { useState, useEffect, useRef } from 'react';
import { KickflipCanvas } from './components/KickflipCanvas';
import { RampCanvas } from './components/RampCanvas';
import { TelemetryPanel } from './components/TelemetryPanel';
import { sounds } from './audio/sounds';
import type { SceneId } from './engine/telemetry';
import { SCENES } from './engine/telemetry';

const SCENE_ICONS: Record<SceneId, React.ReactNode> = {
  kickflip: (
    <>
      <path d="M5.5 9.5a6.5 3.5 0 0 1 13 0" />
      <path d="M18.5 9.5l-2.4-.6M18.5 9.5l.7-2.3" />
      <path d="M4 17.5h1.6M10 17.5h4M18.4 17.5H20M4.5 17.5l.8-2.6 3.4-.9 2-2h3.6l2.7 2.4 2.1.4.4 2.7" />
      <circle cx="7.8" cy="17.5" r="1.6" />
      <circle cx="16.2" cy="17.5" r="1.6" />
    </>
  ),
  ramp: (
    <>
      <path d="M3 20h6a9 9 0 0 0 9-9V3.5" />
      <path d="M18 3.5h3V20M18 8h3M18 13h3M18 8l3 5" />
      <path d="M14.5 6.5C12 3 7 3.5 6 8" strokeDasharray="1.4 1.8" />
      <path d="M6 8l-.9-2.2M6 8l2-1.1" />
    </>
  ),
};

export const App: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [speed, setSpeed] = useState<number>(1.0);
  const [progress, setProgress] = useState<number>(0);
  const [azimuthDeg, setAzimuthDeg] = useState<number>(45);
  const [showDrawer, setShowDrawer] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [scene, setScene] = useState<SceneId>('kickflip');

  const switchScene = (next: SceneId) => {
    if (next === scene) return;
    setProgress(0);
    setScene(next);
  };

  // Theme state with 180deg turn animation matching original
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'dark';
    }
  });

  const [turns, setTurns] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'light') return 0;
      if (saved === 'dark') return 1;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 1 : 0;
    } catch {
      return 1;
    }
  });

  const knobRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (knobRef.current) {
      knobRef.current.style.transform = `rotate(${turns * 180}deg)`;
    }
  }, [theme, turns]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    const nextTurns = turns + 1;
    setTheme(next);
    setTurns(nextTurns);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      // ignore
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setProgress((p) => Math.max(0, p - 0.05));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setProgress((p) => Math.min(1, p + 0.05));
      } else if (e.key === 't' || e.key === 'T') {
        toggleTheme();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [theme, turns]);

  const toggleSound = () => {
    const next = !isMuted;
    sounds.setMuted(next);
    setIsMuted(next);
  };

  return (
    <>
      {/* Theme Toggle Button */}
      <button
        className="icon theme"
        type="button"
        aria-label="Toggle light and dark mode"
        onClick={toggleTheme}
      >
        <svg
          ref={knobRef}
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm0 1.5v11a5.5 5.5 0 0 1 0-11Z" />
        </svg>
      </button>

      {/* Sequence rail, middle left */}
      <nav className="rail rail-left" role="radiogroup" aria-label="Sequence">
        {SCENES.map((sc) => (
          <button
            key={sc.id}
            type="button"
            role="radio"
            aria-checked={scene === sc.id}
            className={`rail-btn${scene === sc.id ? ' is-active' : ''}`}
            onClick={() => switchScene(sc.id)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">{SCENE_ICONS[sc.id]}</svg>
            <span>{sc.label}</span>
          </button>
        ))}
      </nav>

      {/* Main 1:1 Layout Container */}
      <main>
        <div className="wordmark" role="img" aria-label="Roadster" />

        {scene === 'kickflip' ? (
          <KickflipCanvas
            key="kickflip"
            isPlaying={isPlaying}
            speed={speed}
            progress={progress}
            azimuthDeg={azimuthDeg}
            onProgressUpdate={setProgress}
          />
        ) : (
          <RampCanvas
            key="ramp"
            isPlaying={isPlaying}
            speed={speed}
            progress={progress}
            azimuthDeg={azimuthDeg}
            onProgressUpdate={setProgress}
          />
        )}

        <p className="line">the future is wild</p>
        <p className="by">
          by{' '}
          <a href="http://souradeep.me" target="_blank" rel="noopener noreferrer">
            Souradeep Pradhan
          </a>
          <svg className="verified" viewBox="0 0 22 22" aria-label="Verified account" role="img">
            <linearGradient gradientUnits="userSpaceOnUse" id="verified-a" x1="4.411" x2="18.083" y1="2.495" y2="21.508">
              <stop offset="0" stopColor="#f4e72a" />
              <stop offset=".539" stopColor="#cd8105" />
              <stop offset=".68" stopColor="#cb7b00" />
              <stop offset="1" stopColor="#f4ec26" />
              <stop offset="1" stopColor="#f4e72a" />
            </linearGradient>
            <linearGradient gradientUnits="userSpaceOnUse" id="verified-b" x1="5.355" x2="16.361" y1="3.395" y2="19.133">
              <stop offset="0" stopColor="#f9e87f" />
              <stop offset=".406" stopColor="#e2b719" />
              <stop offset=".989" stopColor="#e2b719" />
            </linearGradient>
            <g clipRule="evenodd" fillRule="evenodd">
              <path
                d="M13.324 3.848L11 1.6 8.676 3.848l-3.201-.453-.559 3.184L2.06 8.095 3.48 11l-1.42 2.904 2.856 1.516.559 3.184 3.201-.452L11 20.4l2.324-2.248 3.201.452.559-3.184 2.856-1.516L18.52 11l1.42-2.905-2.856-1.516-.559-3.184zm-7.09 7.575l3.428 3.428 5.683-6.206-1.347-1.247-4.4 4.795-2.072-2.072z"
                fill="url(#verified-a)"
              />
              <path
                d="M13.101 4.533L11 2.5 8.899 4.533l-2.895-.41-.505 2.88-2.583 1.37L4.2 11l-1.284 2.627 2.583 1.37.505 2.88 2.895-.41L11 19.5l2.101-2.033 2.895.41.505-2.88 2.583-1.37L17.8 11l1.284-2.627-2.583-1.37-.505-2.88zm-6.868 6.89l3.429 3.428 5.683-6.206-1.347-1.247-4.4 4.795-2.072-2.072z"
                fill="url(#verified-b)"
              />
              <path
                d="M6.233 11.423l3.429 3.428 5.65-6.17.038-.033-.005 1.398-5.683 6.206-3.429-3.429-.003-1.405.005.003z"
                fill="#d18800"
              />
            </g>
          </svg>
        </p>

        <div className="icons">
          <a
            className="icon"
            href="https://x.com/bysoura"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Souradeep Pradhan on X"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            className="icon"
            href="https://github.com/pradhan-not-found/Roadster"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Roadster source code on GitHub"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
            </svg>
          </a>
          <a
            className="icon"
            href="https://souradeep.me/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Souradeep Pradhan's website"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.93 6h-2.95a15.65 15.65 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.93 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14a8.2 8.2 0 0 1 0-4h3.38a16.5 16.5 0 0 0 0 4H4.26zm.81 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.99 7.99 0 0 1 5.07 16zm2.95-8H5.07a7.99 7.99 0 0 1 4.33-3.56A15.65 15.65 0 0 0 8.02 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66a14.7 14.7 0 0 1 0-4h4.68a14.7 14.7 0 0 1 0 4zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56zM16.36 14a16.5 16.5 0 0 0 0-4h3.38a8.2 8.2 0 0 1 0 4h-3.38z" />
            </svg>
          </a>
        </div>
      </main>

      {/* Telemetry toggle, middle right */}
      <nav className="rail rail-right" aria-label="Telemetry">
        <button
          className={`rail-btn${showDrawer ? ' is-active' : ''}`}
          onClick={() => setShowDrawer((v) => !v)}
          type="button"
          aria-expanded={showDrawer}
          aria-controls="telemetry-panel"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4.2 17a8.5 8.5 0 1 1 15.6 0" />
            <path d="M12 6.5v1.6M6.7 8.7l1.1 1.1M17.3 8.7l-1.1 1.1M5 14h1.6M19 14h-1.6" />
            <path d="M12 14l3.6-3.8" />
            <circle cx="12" cy="14" r="1.3" />
          </svg>
          <span>Telemetry</span>
        </button>
      </nav>

      {/* Telemetry panel: instruments and sequence controls */}
      {showDrawer && (
        <TelemetryPanel
          scene={scene}
          progress={progress}
          isPlaying={isPlaying}
          speed={speed}
          azimuthDeg={azimuthDeg}
          isMuted={isMuted}
          onClose={() => setShowDrawer(false)}
          onTogglePlay={() => setIsPlaying((p) => !p)}
          onScrub={setProgress}
          onRestart={() => {
            setProgress(0);
            setIsPlaying(true);
          }}
          onSpeed={setSpeed}
          onAzimuth={setAzimuthDeg}
          onToggleSound={toggleSound}
        />
      )}
    </>
  );
};

export default App;
