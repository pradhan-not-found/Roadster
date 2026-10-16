import type { Point3D } from './math';
import { lerp, clamp, smooth } from './math';

/**
 * Quarter-pipe launch. Distances are scene units (the Roadster is ~27 long),
 * times are seconds at 1x. Gravity matches the kickflip arc.
 */
export const G = 66;
export const PIV = 6.5;

export const RAMP = {
  XA: -170, // entry, hidden by the edge mask
  X0: 30, // foot of the curve
  RR: 50, // curve radius
  LIP: 105, // lip angle in degrees; past vertical so the car pops back out
  HALF: 15, // half lane width
  XLAND: 2, // centre x on touchdown
  XOUT: -190, // exit, hidden by the edge mask
};

const LIP_RAD = (RAMP.LIP * Math.PI) / 180;
const ARC = RAMP.RR * LIP_RAD;

/** Surface point and slope (degrees) at arc length s from the foot. */
function surface(s: number): { x: number; z: number; th: number } {
  const a = clamp(s, 0, ARC) / RAMP.RR;
  return {
    x: RAMP.X0 + RAMP.RR * Math.sin(a),
    z: RAMP.RR * (1 - Math.cos(a)),
    th: (a * 180) / Math.PI,
  };
}

/** Centre of the car when its belly rests on a surface point with slope th. */
const onSurface = (x: number, z: number, th: number): Point3D => {
  const a = (th * Math.PI) / 180;
  return [x - PIV * Math.sin(a), 0, z + PIV * Math.cos(a)];
};

const LIP = surface(ARC);
const LIP_C = onSurface(LIP.x, LIP.z, LIP.th);

const V2 = 50; // speed leaving the lip
const V1 = Math.sqrt(V2 * V2 + 2 * G * LIP.z); // speed at the foot
const VZ = V2 * Math.sin(LIP_RAD);

const T_IN = (RAMP.X0 - RAMP.XA) / V1;
const T_CLIMB = ARC / ((V1 + V2) / 2);
const T_RISE = VZ / G;
const T_FALL = 1.5;
const T_SETTLE = 0.35;
const T_OUT = 2.2;
const T_AIR = T_RISE + T_FALL;

export const APEX = LIP_C[2] + (VZ * VZ) / (2 * G);
export const LIP_POINT = LIP;
export const RAMP_PERIOD = (T_IN + T_CLIMB + T_AIR + T_SETTLE + T_OUT) * 1000;

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
  phase: 'Approach' | 'Climb' | 'Ascent' | 'Descent' | 'Touchdown' | 'Exit';
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

  // Climb: constant deceleration along the curve
  if (T < T_CLIMB) {
    const s = V1 * T + ((V2 - V1) / (2 * T_CLIMB)) * T * T;
    const p = surface(s);
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

  const climbed = RAMP.X0 - RAMP.XA + ARC;

  // Airborne: ballistic rise, pirouette, pitch over, jet-braked descent
  if (T < T_AIR) {
    const k = T / T_AIR;
    const z =
      T < T_RISE
        ? LIP_C[2] + VZ * T - 0.5 * G * T * T
        : lerp(APEX, PIV, smooth((T - T_RISE) / T_FALL));
    const fall = clamp((T - T_RISE) / T_FALL, 0, 1);
    return {
      c: [lerp(LIP_C[0], RAMP.XLAND, smooth(k)), 0, z],
      yaw: 180 * smooth((k - 0.06) / 0.3),
      pitch: RAMP.LIP * (1 - smooth((k - 0.22) / 0.38)),
      roll: 0,
      jet: smooth((fall - 0.1) / 0.2) * (1 - smooth((fall - 0.96) / 0.04)),
      dist: climbed + V2 * Math.min(T, 0.3),
      t: k,
      air: true,
      phase: T < T_RISE ? 'Ascent' : 'Descent',
      dust,
    };
  }
  T -= T_AIR;

  const parked = climbed + V2 * 0.3;

  // Suspension settle
  if (T < T_SETTLE) {
    const k = T / T_SETTLE;
    const sag = Math.sin(Math.PI * k) * (1 - k);
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
export function rampProfile(n = 32): [number, number, number][] {
  return Array.from({ length: n + 1 }, (_, k) => {
    const p = surface((ARC * k) / n);
    return [p.x, p.z, (p.th * Math.PI) / 180];
  });
}
