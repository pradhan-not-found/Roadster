export type Point3D = [number, number, number];
export type Point2D = [number, number];

export const rad = (d: number): number => (d * Math.PI) / 180;
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const lerp3 = (a: Point3D, b: Point3D, t: number): Point3D => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const smooth = (t: number): number => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
export const r2 = (n: number): number => Math.round(n * 100) / 100;

export const poly = (pts: Point2D[]): string =>
  pts.length < 3 ? '' : 'M' + pts.map((p) => `${r2(p[0])} ${r2(p[1])}`).join('L') + 'Z';

export const open = (pts: Point2D[]): string =>
  pts.length < 2 ? '' : 'M' + pts.map((p) => `${r2(p[0])} ${r2(p[1])}`).join('L');

export const dot = (a: Point3D, b: Point3D): number =>
  a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export const mean = (pts: Point3D[]): Point3D => {
  const sum = pts.reduce((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]);
  return [sum[0] / pts.length, sum[1] / pts.length, sum[2] / pts.length];
};

/**
 * Computes 2D Convex Hull (Graham scan / monotone chain)
 */
export function hull(input: Point2D[]): Point2D[] {
  const pts = input.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Point2D, a: Point2D, b: Point2D) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Point2D[] = [];
  const up: Point2D[] = [];

  for (const p of pts) {
    while (lo.length > 1 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop();
    lo.push(p);
  }
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (up.length > 1 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop();
    up.push(p);
  }
  lo.pop();
  up.pop();
  return lo.concat(up);
}

export interface CameraState {
  S: number;
  ox: number;
  oy: number;
  azimuthDeg?: number;
  pitchDeg?: number;
}

export function createProjection(cam: CameraState, azimuthDeg = 45) {
  const K = 0.5;
  const ZF = Math.sqrt(1 - K * K);
  const AZ = rad(azimuthDeg);
  const VIEW: Point3D = [Math.sin(AZ) * ZF, Math.cos(AZ) * ZF, K];

  const project = ([x, y, z]: Point3D): Point2D => {
    const X = x * Math.cos(AZ) - y * Math.sin(AZ);
    const Y = x * Math.sin(AZ) + y * Math.cos(AZ);
    return [cam.ox + cam.S * X, cam.oy + cam.S * (Y * K - z * ZF)];
  };

  return { VIEW, project, AZ, K, ZF };
}

export function frame(pos: Point3D, piv: number, yaw: number, pitch: number, roll: number) {
  const [cy, sy, cp, sp, cr, sr] = [yaw, yaw, pitch, pitch, roll, roll].map((a, i) =>
    (i % 2 ? Math.sin : Math.cos)(rad(a))
  );

  const R = ([f, s, u]: Point3D): Point3D => {
    [s, u] = [s * cr - u * sr, s * sr + u * cr];
    [f, u] = [f * cp - u * sp, f * sp + u * cp];
    return [f * cy - s * sy, f * sy + s * cy, u];
  };

  const at = (v: Point3D): Point3D => {
    const r = R([v[0], v[1], v[2] - piv]);
    return [pos[0] + r[0], pos[1] + r[1], pos[2] + piv + r[2]];
  };

  return { R, at };
}

export const pace = (u: number): number =>
  u + (0.42 * Math.sin(2 * Math.PI * u)) / (2 * Math.PI);

export const bump = (t: number, c: number): number =>
  1 - smooth(Math.abs(t - c) / 0.13);

export interface KickflipConstants {
  XA: number;
  XB: number;
  XL: number;
  XR: number;
  H: number;
  PIV: number;
  PERIOD: number;
}

export const DEFAULT_CONSTANTS: KickflipConstants = {
  XA: -160,
  XB: 160,
  XL: -82,
  XR: 82,
  H: 58,
  PIV: 6.5,
  PERIOD: 4200,
};

export function pose(u: number, constants = DEFAULT_CONSTANTS) {
  const { XA, XB, XL, XR, H } = constants;
  const x = lerp(XA, XB, pace(u));
  const t = (x - XL) / (XR - XL);
  const air = t > 0 && t < 1;
  const out = (x - XR) / 18;

  return {
    x,
    t,
    z: air ? H * 4 * t * (1 - t) : 0,
    pitch: air
      ? 8 * Math.sin(2 * Math.PI * t)
      : out > 0 && out < 1
      ? -2.5 * Math.sin(Math.PI * out)
      : 0,
    roll: 360 * smooth((t - 0.14) / 0.72),
    jet: Math.max(bump(t, 0.02), bump(t, 0.98)),
    air,
  };
}
