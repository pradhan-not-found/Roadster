import React from 'react';
import { Gauge, Attitude } from './Instruments';
import type { SceneId } from '../engine/telemetry';
import { SCENES, readTelemetry } from '../engine/telemetry';

interface TelemetryPanelProps {
  scene: SceneId;
  progress: number;
  isPlaying: boolean;
  speed: number;
  azimuthDeg: number;
  isMuted: boolean;
  onClose: () => void;
  onTogglePlay: () => void;
  onScrub: (u: number) => void;
  onRestart: () => void;
  onSpeed: (s: number) => void;
  onAzimuth: (a: number) => void;
  onToggleSound: () => void;
}

const RATES = [0.25, 0.5, 1, 2];
const ANGLES = [15, 45, 75, 135];

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({
  scene,
  progress,
  isPlaying,
  speed,
  azimuthDeg,
  isMuted,
  onClose,
  onTogglePlay,
  onScrub,
  onRestart,
  onSpeed,
  onAzimuth,
  onToggleSound,
}) => {
  const t = readTelemetry(scene, progress);
  const title = SCENES.find((s) => s.id === scene)!.title;

  return (
    <section id="telemetry-panel" className="telemetry" aria-label="Telemetry">
      <header className="telemetry-header">
        <div>
          <p className="telemetry-eyebrow">Telemetry</p>
          <h2 className="telemetry-title">{title}</h2>
        </div>
        <div className="telemetry-header-end">
          <span className={`telemetry-phase${t.jet > 0.05 ? ' is-jet' : ''}`}>{t.phase}</span>
          <button className="telemetry-close" onClick={onClose} type="button" aria-label="Close telemetry">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      </header>

      <div className="tm-grid">
        <div className="tm-card">
          <Gauge label="G-FORCE" unit="G" value={t.g} max={10} step={2} warn={7} />
        </div>
        <div className="tm-card">
          <Gauge label="ALTITUDE" unit="FT" value={t.altitudeFt} max={40} step={10} />
        </div>

        <div className="tm-card tm-wide tm-attitude">
          <Attitude label="Pitch" view="side" angle={t.pitch} />
          <Attitude label="Yaw" view="top" angle={t.yaw} />
          <Attitude label="Roll" view="rear" angle={t.roll} />
        </div>

        <dl className="tm-wide tm-stats">
          <div className="tm-card">
            <dt>Speed</dt>
            <dd>
              {t.speedMph.toFixed(1)}
              <small>mph</small>
            </dd>
          </div>
          <div className="tm-card">
            <dt>Thrust</dt>
            <dd>
              {Math.round(t.jet * 100)}
              <small>%</small>
            </dd>
          </div>
          <div className="tm-card">
            <dt>Sequence</dt>
            <dd>
              {(progress * 100).toFixed(1)}
              <small>%</small>
            </dd>
          </div>
        </dl>

        <div className="tm-card tm-wide tm-controls">
          <div className="telemetry-transport">
            <button
              className="tm-btn tm-icon-btn tm-primary"
              onClick={onTogglePlay}
              type="button"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                {isPlaying ? <path d="M5 3h2v10H5zM9 3h2v10H9z" /> : <path d="M5 3l8 5-8 5z" />}
              </svg>
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={progress}
              onChange={(e) => onScrub(parseFloat(e.target.value))}
              className="telemetry-slider"
              style={{ '--fill': `${progress * 100}%` } as React.CSSProperties}
              aria-label="Scrub sequence"
            />
            <button className="tm-btn tm-icon-btn" onClick={onRestart} type="button" aria-label="Restart">
              <svg viewBox="0 0 16 16" aria-hidden="true" className="stroke">
                <path d="M3 8a5 5 0 1 0 1.5-3.5M3 3v2.5h2.5" />
              </svg>
            </button>
          </div>

          <div className="telemetry-settings">
            <div className="telemetry-group">
              <span className="telemetry-label">Rate</span>
              <div className="telemetry-segment" role="radiogroup" aria-label="Playback rate">
                {RATES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={speed === s}
                    className={speed === s ? 'is-active' : ''}
                    onClick={() => onSpeed(s)}
                  >
                    {s}×
                  </button>
                ))}
              </div>
            </div>
            <div className="telemetry-group">
              <span className="telemetry-label">Camera</span>
              <div className="telemetry-segment" role="radiogroup" aria-label="Camera azimuth">
                {ANGLES.map((a) => (
                  <button
                    key={a}
                    type="button"
                    role="radio"
                    aria-checked={azimuthDeg === a}
                    className={azimuthDeg === a ? 'is-active' : ''}
                    onClick={() => onAzimuth(a)}
                  >
                    {a}°
                  </button>
                ))}
              </div>
            </div>
          </div>

          <footer className="telemetry-footer">
            <button
              type="button"
              role="switch"
              aria-checked={!isMuted}
              className={`tm-btn tm-sound${!isMuted ? ' is-on' : ''}`}
              onClick={onToggleSound}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path d="M2.5 6h2.2L8 3.2v9.6L4.7 10H2.5z" />
                {isMuted ? (
                  <path d="M10.5 6l3.5 4M14 6l-3.5 4" />
                ) : (
                  <path d="M10.4 5.6a3.4 3.4 0 0 1 0 4.8M12.2 3.8a6 6 0 0 1 0 8.4" />
                )}
              </svg>
              {isMuted ? 'Sound off' : 'Sound on'}
            </button>
            <span className="telemetry-keys">
              <kbd>Space</kbd>
              <kbd>←</kbd>
              <kbd>→</kbd>
              <kbd>T</kbd>
            </span>
          </footer>
        </div>
      </div>
    </section>
  );
};
