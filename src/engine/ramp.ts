import type { Point3D } from './math';
import { lerp, clamp, smooth } from './math';

/**
 * C-ramp launch: the track curves up, runs vertical, then curls over the top
 * so the car leaves the lip upside down heading back the way it came.
 * Distances are scene units (the Roadster is ~27 long), times are seconds
 * at 1x. Gravity matches the kickflip arc.
 */
export const G = 66;
export const PIV = 6.5;

export const RAMP = {
  XA: -170, // entry, hidden by the edge mask
  X0: 30, // foot of the lower curve
  R1: 30, // lower curve radius
  WALL: 18, // vertical run
  R2: 20, // upper curl radius
  LIP: 165, // lip angle in degrees: nearly inverted
  TOP: 18, // straight overhanging arm after the curl
  HALF: 15, // half lane width
  XLAND: -18, // centre x on touchdown
  XOUT: -200, // exit, hidden by the edge mask
};

const D2R = Math.PI / 180;
const ARC1 = RAMP.R1 * (Math.PI / 2);
const ARC2 = RAMP.R2 * (RAMP.LIP - 90) * D2R;
const TRACK = ARC1 + RAMP.WALL + ARC2 + RAMP.TOP;
const XW = RAMP.X0 + RAMP.R1;
const ZW = RAMP.R1 + RAMP.WALL;

/** Surface point and slope (degrees) at arc length s from the foot. */
function surface(s: number): { x: number; z: number; th: number } {
  s = clamp(s, 0, TRACK);
  if (s <= ARC1) {
    const a = s / RAMP.R1;
    return { x: RAMP.X0 + RAMP.R1 * Math.sin(a), z: RAMP.R1 * (1 - Math.cos(a)), th: a / D2R };
  }
  if (s <= ARC1 + RAMP.WALL) {
    return { x: XW, z: RAMP.R1 + (s - ARC1), th: 90 };
  }
  const s2 = Math.min(s - ARC1 - RAMP.WALL, ARC2);
  const a = Math.PI / 2 + s2 / RAMP.R2;
  const x = XW + RAMP.R2 * (Math.sin(a) - 1);
  const z = ZW - RAMP.R2 * Math.cos(a);
  // Straight arm beyond the curl
  const t = s - ARC1 - RAMP.WALL - ARC2;
  if (t <= 0) return { x, z, th: a / D2R };
  return { x: x + t * Math.cos(a), z: z + t * Math.sin(a), th: a / D2R };
}

// The car's centre rides PIV inside the track, so on curves it travels a
// shorter path. Motion is timed along that centre path to keep speed smooth.
const C1 = (RAMP.R1 - PIV) * (Math.PI / 2);
const C2 = (RAMP.R2 - PIV) * (RAMP.LIP - 90) * D2R;
const CTRACK = C1 + RAMP.WALL + C2 + RAMP.TOP;

/** Surface arc length for a distance travelled by the car's centre. */
function surfaceAt(c: number): number {
  if (c <= C1) return (c * RAMP.R1) / (RAMP.R1 - PIV);
  if (c <= C1 + RAMP.WALL) return ARC1 + (c - C1);
  if (c <= C1 + RAMP.WALL + C2) return ARC1 + RAMP.WALL + ((c - C1 - RAMP.WALL) * RAMP.R2) / (RAMP.R2 - PIV);
  return ARC1 + RAMP.WALL + ARC2 + (c - C1 - RAMP.WALL - C2);
}

/** Centre of the car when its belly rests on a surface point with slope th. */
const onSurface = (x: number, z: number, th: number): Point3D => {
  const a = th * D2R;
  return [x - PIV * Math.sin(a), 0, z + PIV * Math.cos(a)];
};

const LIP = surface(TRACK);
const LIP_C = onSurface(LIP.x, LIP.z, LIP.th);

const V2 = 46; // speed leaving the lip, enough to stay pinned through the curl
const V1 = Math.sqrt(V2 * V2 + 2 * G * LIP.z); // speed at the foot
const VZ = V2 * Math.sin(RAMP.LIP * D2R);

const T_IN = (RAMP.X0 - RAMP.XA) / V1;
const T_CLIMB = CTRACK / ((V1 + V2) / 2);
const T_RISE = VZ / G;
const T_FALL = 1.9;
const T_SETTLE = 0.35;
const T_OUT = 2.2;
const T_AIR = T_RISE + T_FALL;

export const APEX = LIP_C[2] + (VZ * VZ) / (2 * G);
export const LIP_POINT = LIP;
export const RAMP_PERIOD = (T_IN + T_CLIMB + T_AIR + T_SETTLE + T_OUT) * 1000;
/** Slope beyond which the track overhangs the car */
export const OVERHANG = 100;

const SEC = RAMP_PERIOD / 1000;
const DUST_AT = T_IN + T_CLIMB + T_RISE + 0.6 * T_FALL;

/** Loop fractions where the car leaves the lip and touches down. */
export const U_LIP = (T_IN + T_CLIMB) / SEC;
export const U_LAND = (T_IN + T_CLIMB + T_AIR) / SEC;

export interface RampPose {
  /** rotation centre in world space */
  c: Point3D;
  yaw: number;
  pitch: number;
  roll: number;
  jet: number;
  /** distance travelled, drives wheel spin */
  dist: number;
  /** -1 before the lip, 0..1 airborne, >1 after touchdown */
  t: number;
  air: boolean;
  phase: 'Approach' | 'Climb' | 'Inverted' | 'Descent' | 'Touchdown' | 'Exit';
  /** 0..1 progress of the touchdown gas cloud */
  dust: number;
}

export function rampPose(u: number): RampPose {
  let T = (((u % 1) + 1) % 1) * SEC;
  const dust = T < DUST_AT ? 0 : clamp((T - DUST_AT) / 1.6, 0, 1);
  const still = { yaw: 0, pitch: 0, roll: 0, jet: 0, air: false, dust };

  // Approach
  if (T < T_IN) {
    const x = RAMP.XA + V1 * T;
    return { ...still, c: [x, 0, PIV], dist: x - RAMP.XA, t: -1, phase: 'Approach' };
  }
  T -= T_IN;

  // Climb: constant deceleration around the C
  if (T < T_CLIMB) {
    const s = V1 * T + ((V2 - V1) / (2 * T_CLIMB)) * T * T;
    const p = surface(surfaceAt(s));
    return {
      ...still,
      c: onSurface(p.x, p.z, p.th),
      pitch: p.th,
      dist: RAMP.X0 - RAMP.XA + s,
      t: -1,
      phase: 'Climb',
    };
  }
  T -= T_CLIMB;

  const climbed = RAMP.X0 - RAMP.XA + CTRACK;

  // Airborne. Pitch 165 is re-expressed as yaw 180 / pitch 15 / roll 180 (same
  // attitude), so a half roll and a small pitch bring the car upright facing
  // back down the run-up. Jets fire inverted to push it clear of the lip, then
  // brake the descent.
  if (T < T_AIR) {
    const k = T / T_AIR;
    const z =
      T < T_RISE
        ? LIP_C[2] + VZ * T - 0.5 * G * T * T
        : lerp(APEX, PIV, smooth((T - T_RISE) / T_FALL));
    const fall = clamp((T - T_RISE) / T_FALL, 0, 1);
    // Hermite blend: leaves the lip at the track's horizontal speed, stops over the pad
    const vx0 = V2 * Math.cos(RAMP.LIP * D2R) * T_AIR;
    const x = LIP_C[0] + vx0 * (k - 2 * k * k + k * k * k) + (RAMP.XLAND - LIP_C[0]) * (3 * k * k - 2 * k * k * k);
    const push = 1 - smooth(k / 0.22);
    const brake = smooth((fall - 0.3) / 0.2) * (1 - smooth((fall - 0.96) / 0.04));
    return {
      c: [x, 0, z],
      yaw: 180,
      pitch: (180 - RAMP.LIP) * (1 - smooth((k - 0.1) / 0.5)),
      roll: 180 * (1 - smooth((k - 0.12) / 0.4)),
      jet: Math.max(push, brake),
      dist: climbed + V2 * Math.min(T, 0.3),
      t: k,
      air: true,
      phase: k < 0.4 ? 'Inverted' : 'Descent',
      dust,
    };
  }
  T -= T_AIR;

  const parked = climbed + V2 * 0.3;

  // Suspension settle
  if (T < T_SETTLE) {
    const k = T / T_SETTLE;
    const sag = Math.sin(Math.PI * k) ** 2 * (1 - k);
    return {
      ...still,
      c: [RAMP.XLAND, 0, PIV - 1.4 * sag],
      yaw: 180,
      pitch: -2.5 * sag,
      dist: parked,
      t: 1,
      phase: 'Touchdown',
    };
  }
  T -= T_SETTLE;

  // Drive off, accelerating from rest
  const d = (RAMP.XLAND - RAMP.XOUT) * (T / T_OUT) ** 2;
  return { ...still, c: [RAMP.XLAND - d, 0, PIV], yaw: 180, dist: parked + d, t: 2, phase: 'Exit' };
}

/** Riding surface as [x, z, slope radians] samples, foot to lip. */
export function rampProfile(n = 48): [number, number, number][] {
  return Array.from({ length: n + 1 }, (_, k) => {
    const p = surface((TRACK * k) / n);
    return [p.x, p.z, p.th * D2R];
  });
}

/** Back-of-slab x at height z on the lower curve and wall (for truss struts). */
export function backAt(z: number, slab: number): number {
  if (z >= RAMP.R1) return XW + slab;
  const a = Math.acos(clamp(1 - z / RAMP.R1, -1, 1));
  return RAMP.X0 + (RAMP.R1 + slab) * Math.sin(a);
}

export const WALL_X = XW;
