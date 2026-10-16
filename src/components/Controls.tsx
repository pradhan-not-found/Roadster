import React, { useState } from 'react';
import { sounds } from '../audio/sounds';

export interface ControlsProps {
  isPlaying: boolean;
  progress: number;
  speed: number;
  azimuthDeg: number;
  onTogglePlay: () => void;
  onSeek: (value: number) => void;
  onSpeedChange: (speed: number) => void;
  onAzimuthChange: (angle: number) => void;
  onReset: () => void;
  onOpenFleet: () => void;
}

export const Controls: React.FC<ControlsProps> = ({
  isPlaying,
  progress,
  speed,
  azimuthDeg,
  onTogglePlay,
  onSeek,
  onSpeedChange,
  onAzimuthChange,
  onReset,
  onOpenFleet,
}) => {
  const [isAudioActive, setIsAudioActive] = useState<boolean>(!sounds.getMuted());

  const toggleSound = () => {
    const next = !isAudioActive;
    sounds.setMuted(!next);
    setIsAudioActive(next);
    if (next) {
      sounds.playThrusterBlast(0.8);
    }
  };

  // Determine kickflip phase description
  const getPhaseText = (p: number) => {
    if (p < 0.14) return 'GROUND ACCELERATION';
    if (p < 0.28) return 'COLD-GAS THRUSTER IGNITION';
    if (p < 0.72) return '360° AERIAL KICKFLIP';
    if (p < 0.86) return 'RETRO THRUSTER ATTITUDE CONTROL';
    return 'SUSPENSION TOUCHDOWN';
  };

  return (
    <div className="controls-container">
      {/* Flight Telemetry Status Bar */}
      <div className="telemetry-bar">
        <span className="telemetry-phase">{getPhaseText(progress)}</span>
        <span className="telemetry-time">{(progress * 100).toFixed(0)}%</span>
      </div>

      {/* Scrub Slider */}
      <div className="scrub-wrapper">
        <input
          type="range"
          min="0"
          max="1"
          step="0.001"
          value={progress}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          aria-label="Timeline scrubber"
          className="scrub-slider"
        />
      </div>

      {/* Main Buttons Bar */}
      <div className="buttons-bar">
        {/* Play/Pause */}
        <button
          className="control-btn primary-btn"
          onClick={onTogglePlay}
          type="button"
          aria-label={isPlaying ? 'Pause animation (Space)' : 'Play animation (Space)'}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        >
          {isPlaying ? (
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z" />
            </svg>
          )}
          <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
        </button>

        {/* Speed Selector */}
        <div className="speed-pills" role="radiogroup" aria-label="Playback speed">
          {[0.25, 0.5, 1.0, 2.0].map((s) => (
            <button
              key={s}
              className={`pill-btn ${speed === s ? 'active' : ''}`}
              onClick={() => onSpeedChange(s)}
              type="button"
              aria-label={`${s}x speed`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Sound FX Toggle */}
        <button
          className={`control-btn icon-btn ${isAudioActive ? 'active-audio' : ''}`}
          onClick={toggleSound}
          type="button"
          aria-label={isAudioActive ? 'Mute SpaceX Thruster Audio' : 'Unmute SpaceX Thruster Audio'}
          title={isAudioActive ? 'Audio ON (SpaceX Thrusters)' : 'Audio Muted'}
        >
          {isAudioActive ? (
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M11.536 14.01A8.473 8.473 0 0 0 14.026 8a8.473 8.473 0 0 0-2.49-6.01l-.708.707A7.476 7.476 0 0 1 13.025 8c0 2.071-.84 3.946-2.197 5.303l.708.707z" />
              <path d="M10.121 12.596A6.48 6.48 0 0 0 12.025 8a6.48 6.48 0 0 0-1.904-4.596l-.707.707A5.483 5.483 0 0 1 11.025 8a5.483 5.483 0 0 1-1.61 3.89l.706.706z" />
              <path d="M8.707 11.182A4.486 4.486 0 0 0 10.025 8a4.486 4.486 0 0 0-1.318-3.182L8 5.525A3.489 3.489 0 0 1 9.025 8 3.49 3.49 0 0 1 8 10.475l.707.707zM6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06z" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06zm7.137 2.096a.5.5 0 0 1 0 .708L12.207 8l1.647 1.646a.5.5 0 0 1-.708.708L11.5 8.707l-1.646 1.647a.5.5 0 0 1-.708-.708L10.793 8 9.146 6.354a.5.5 0 1 1 .708-.708L11.5 7.293l1.646-1.647a.5.5 0 0 1 .708 0z" />
            </svg>
          )}
        </button>

        {/* Camera Views Selector */}
        <div className="camera-pills" role="radiogroup" aria-label="Camera perspective">
          {[
            { label: '45°', angle: 45, title: 'Isometric' },
            { label: '15°', angle: 15, title: 'Side view' },
            { label: '75°', angle: 75, title: 'Top-down' },
            { label: '135°', angle: 135, title: 'Reverse' },
          ].map((item) => (
            <button
              key={item.angle}
              className={`pill-btn ${azimuthDeg === item.angle ? 'active' : ''}`}
              onClick={() => onAzimuthChange(item.angle)}
              type="button"
              title={item.title}
              aria-label={`Switch camera to ${item.title}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Fleet Specs */}
        <button
          className="control-btn fleet-btn"
          onClick={onOpenFleet}
          type="button"
          aria-label="View Tesla fleet specifications"
          title="Tesla Fleet Specs"
        >
          <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
            <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
          </svg>
          <span>SPECS</span>
        </button>

        {/* Reset */}
        <button
          className="control-btn icon-btn"
          onClick={onReset}
          type="button"
          aria-label="Restart animation"
          title="Reset Animation"
        >
          <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
            <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z" />
            <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z" />
          </svg>
        </button>
      </div>
    </div>
  );
};
