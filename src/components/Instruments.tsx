import React from 'react';

const SWEEP = 270;
const START = 135; // degrees, measured clockwise from +x in screen space

const polar = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};

const arc = (cx: number, cy: number, r: number, from: number, to: number) => {
  if (to - from < 0.01) return '';
  const [x0, y0] = polar(cx, cy, r, from);
  const [x1, y1] = polar(cx, cy, r, to);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

interface GaugeProps {
  label: string;
  unit: string;
  value: number;
  max: number;
  /** major tick spacing in value units */
  step: number;
  digits?: number;
  /** values above this are drawn in the warning tone */
  warn?: number;
}

/** 270° dial with a live value arc, major/minor ticks and a centred readout. */
export const Gauge: React.FC<GaugeProps> = ({ label, unit, value, max, step, digits = 1, warn }) => {
  const C = 60;
  const R = 50;
  const k = Math.min(1, Math.max(0, value / max));
  const ticks: React.ReactNode[] = [];
  const minor = step / 2;
  for (let v = 0; v <= max + 1e-6; v += minor) {
    const major = Math.abs(v / step - Math.round(v / step)) < 1e-6;
    const deg = START + (v / max) * SWEEP;
    const [x0, y0] = polar(C, C, R - 5, deg);
    const [x1, y1] = polar(C, C, R - (major ? 10 : 7.5), deg);
    ticks.push(
      <line key={v} x1={x0} y1={y0} x2={x1} y2={y1} className={major ? 'tick-major' : 'tick-minor'} />
    );
  }
  const hot = warn !== undefined && value > warn;
  const [nx, ny] = polar(C, C, R, START + k * SWEEP);

  return (
    <figure className="gauge">
      <svg viewBox="0 0 120 120" role="img" aria-label={`${label} ${value.toFixed(digits)} ${unit}`}>
        <path d={arc(C, C, R, START, START + SWEEP)} className="gauge-track" />
        {warn !== undefined && (
          <path d={arc(C, C, R, START + (warn / max) * SWEEP, START + SWEEP)} className="gauge-redline" />
        )}
        <path d={arc(C, C, R, START, START + k * SWEEP)} className={`gauge-value${hot ? ' is-hot' : ''}`} />
        <circle cx={nx} cy={ny} r={2.6} className={`gauge-head${hot ? ' is-hot' : ''}`} />
        {ticks}
        <text x={C} y={41} className="gauge-label">
          {label}
        </text>
        <text x={C} y={70} className="gauge-readout">
          {value.toFixed(digits)}
        </text>
        <text x={C} y={88} className="gauge-unit">
          {unit}
        </text>
      </svg>
    </figure>
  );
};

type View = 'side' | 'top' | 'rear';

// Roadster silhouettes, nose toward +x, drawn about the origin
const SILHOUETTE: Record<View, React.ReactNode> = {
  side: (
    <>
      <path d="M-19 3.5L-18.5 0-15-1.6-7-2.6-1.5-6.6 5.5-6.8 11.5-3 18-1.8 19.5 1 19 3.5Z" />
      <path className="detail" d="M-5.5-2.8L-1.2-5.6 5-5.7 9-3Z" />
      <circle cx={-11.5} cy={3.5} r={3.4} />
      <circle cx={12} cy={3.5} r={3.4} />
    </>
  ),
  top: (
    <>
      <path d="M-19-6.2Q-19.5-8.4-16-8.6L13-8.6Q19.5-8 20-3L20 3Q19.5 8 13 8.6L-16 8.6Q-19.5 8.4-19 6.2Z" />
      <path className="detail" d="M-7-5.6L5-5.6 9 0 5 5.6-7 5.6-9 0Z" />
    </>
  ),
  rear: (
    <>
      <path d="M-11 3L-10.6-1.4-8-3-4.8-6.8 4.8-6.8 8-3 10.6-1.4 11 3Z" />
      <path className="detail" d="M-7.2-2.2L7.2-2.2" />
      <rect x={-10.6} y={2.4} width={4.2} height={4.2} rx={1} />
      <rect x={6.4} y={2.4} width={4.2} height={4.2} rx={1} />
    </>
  ),
};

interface AttitudeProps {
  label: string;
  view: View;
  /** degrees; positive is nose-up / clockwise as seen in the icon */
  angle: number;
}

/** Small round attitude indicator with a fixed reference horizon. */
export const Attitude: React.FC<AttitudeProps> = ({ label, view, angle }) => {
  const shown = ((Math.round(angle) % 360) + 360) % 360;
  return (
    <figure className="attitude">
      <svg viewBox="-30 -30 60 60" role="img" aria-label={`${label} ${shown} degrees`}>
        <circle r={27} className="attitude-ring" />
        {[0, 90, 180, 270].map((d) => {
          const a = (d * Math.PI) / 180;
          return (
            <line
              key={d}
              x1={27 * Math.cos(a)}
              y1={27 * Math.sin(a)}
              x2={23.5 * Math.cos(a)}
              y2={23.5 * Math.sin(a)}
              className="attitude-tick"
            />
          );
        })}
        <line x1={-20} y1={0} x2={20} y2={0} className="attitude-horizon" />
        <g className="attitude-car" transform={`rotate(${-angle})`}>
          {SILHOUETTE[view]}
        </g>
      </svg>
      <figcaption>
        <span>{label}</span>
        <span className="attitude-value">{shown}°</span>
      </figcaption>
    </figure>
  );
};
