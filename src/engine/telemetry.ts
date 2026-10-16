import type { Point3D } from './math';
import { clamp, pose, DEFAULT_CONSTANTS } from './math';
import { rampPose, RAMP_PERIOD, G, PIV } from './ramp';

export type SceneId = 'kickflip' | 'ramp';

export const SCENES: { id: SceneId; label: string; title: string; period: number }[] = [
  { id: 'kickflip', label: 'Kickflip', title: 'Kickflip sequence', period: DEFAULT_CONSTANTS.PERIOD },
  { id: 'ramp', label: 'Ramp', title: 'Quarter-pipe launch', period: RAMP_PERIOD },
];

export const periodOf = (id: SceneId) => SCENES.find((s) => s.id === id)!.period;

// The Roadster is ~27 units long and 13.1 ft in reality.
const FT_PER_UNIT = 13.1 / 27;
const MPH_PER_UNIT_S = (FT_PER_UNIT * 3600) / 5280;

interface Sample {
  c: Point3D;
  pitch: number;
  roll: number;
  yaw: number;
  jet: number;
  phase: string;
}

function sample(id: SceneId, u: number): Sample {
  if (id === 'ramp') {
    const q = rampPose(u);
    return { c: q.c, pitch: q.pitch, roll: q.roll, yaw: q.yaw, jet: q.jet, phase: q.phase };
  }
  const q = pose(u);
  return {
    c: [q.x, 0, q.z + DEFAULT_CONSTANTS.PIV],
    pitch: q.pitch,
    roll: q.roll % 360,
    yaw: 0,
    jet: q.jet,
    phase: q.t <= 0 ? 'Approach' : q.air ? 'Rotation' : 'Rollout',
  };
}

export interface Telemetry {
  g: number;
  altitudeFt: number;
  speedMph: number;
  pitch: number;
  roll: number;
  yaw: number;
  jet: number;
  phase: string;
}

/** Derives instrument readings by differentiating the scene's motion in real time. */
export function readTelemetry(id: SceneId, u: number): Telemetry {
  const h = 1 / 120; // seconds
  const du = h / (periodOf(id) / 1000);
  const u0 = clamp(u, du, 1 - du);
  const a = sample(id, u0 - du).c;
  const b = sample(id, u0).c;
  const c = sample(id, u0 + du).c;
  const now = sample(id, u);

  const v = b.map((_, i) => (c[i] - a[i]) / (2 * h));
  const acc = b.map((_, i) => (c[i] - 2 * b[i] + a[i]) / (h * h));
  // Proper acceleration: what an accelerometer in the cabin would feel.
  const felt = Math.hypot(acc[0], acc[1], acc[2] + G) / G;

  return {
    g: clamp(felt, 0, 9.9),
    altitudeFt: Math.max(0, (now.c[2] - PIV) * FT_PER_UNIT),
    speedMph: Math.hypot(v[0], v[1], v[2]) * MPH_PER_UNIT_S,
    pitch: now.pitch,
    roll: now.roll,
    yaw: now.yaw,
    jet: now.jet,
    phase: now.phase,
  };
}
