import type { Point3D, Point2D } from '../engine/math';
import { rad, lerp, lerp3, mean } from '../engine/math';

export interface Face {
  pts: Point3D[];
  n: Point3D;
  c: Point3D;
  deco: Point3D[][];
  quiet?: boolean;
}

export interface WindowSpec {
  w: number;
  pts: Point2D[];
}

export interface WheelSpec {
  f: number;
  R: number;
  w: number;
  bare?: boolean;
  s?: number;
}

export interface GlassFace {
  pts: Point3D[];
  n: Point3D;
}

export interface VehicleModel {
  id: string;
  name: string;
  tagline: string;
  specs: {
    acceleration?: string;
    topSpeed?: string;
    range?: string;
    power?: string;
  };
  faces: Face[];
  outlines: Point3D[][];
  glass: GlassFace[];
  wheels: WheelSpec[];
}

export type LoftInput =
  | [number, number, number, number?]
  | { prof: [number, number, number, number?][] };

const face = (pts: Point3D[], n: Point3D, deco: Point3D[][] = []): Face => ({
  pts,
  n,
  c: mean(pts),
  deco,
});

export function loft(
  prof: [number, number, number, number?][],
  side: (s: number) => Point3D[][],
  quiet = false
): Face[] {
  const n = prof.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const [a, b] = [prof[i], prof[(i + 1) % n]];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const L: Point3D[] = prof.map(([f, u, w]) => [f, -w, u]);
  const R: Point3D[] = prof.map(([f, u, w]) => [f, w, u]);
  const faces: Face[] = [
    face(L, [0, -1, 0], side(-1)),
    face(R, [0, 1, 0], side(1)),
  ];

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const df = prof[j][0] - prof[i][0];
    const du = prof[j][1] - prof[i][1];
    const m = Math.hypot(df, du) * Math.sign(area);
    const q = (s: number, t: number): Point3D =>
      lerp3(lerp3(L[i], L[j], s), lerp3(R[i], R[j], s), t);
    const glassDeco: Point3D[][] = prof[i][3]
      ? [[q(0.14, 0.1), q(0.86, 0.1), q(0.86, 0.9), q(0.14, 0.9), q(0.14, 0.1)]]
      : [];
    faces.push({
      ...face([L[i], L[j], R[j], R[i]], [du / m, 0, -df / m], glassDeco),
      quiet,
    });
  }
  return faces;
}

export const ring = (cf: number, cu: number, y: number, R: number, n = 22): Point3D[] =>
  Array.from({ length: n }, (_, k) => {
    const a = (k / n) * Math.PI * 2;
    return [cf + R * Math.cos(a), y, cu + R * Math.sin(a)];
  });

export const arch = (f: number, R: number, y: number): Point3D[] =>
  Array.from({ length: 9 }, (_, k) => {
    const a = rad(8 + (164 * k) / 8);
    return [f + (R + 1.3) * Math.cos(a), y, R + (R + 1.3) * Math.sin(a)];
  });

export const soft = (
  prof: [number, number, number, number?][],
  iterations = 2
): [number, number, number, number?][] => {
  let result = prof;
  for (let k = 0; k < iterations; k++) {
    result = result.flatMap((a, i) => {
      const b = result[(i + 1) % result.length];
      const m = (t: number): [number, number, number] => [
        lerp(a[0], b[0], t),
        lerp(a[1], b[1], t),
        lerp(a[2], b[2], t),
      ];
      return [[...m(0.25), a[3]], m(0.75)] as [number, number, number, number?][];
    });
  }
  return result;
};

export function createVehicle({
  id,
  name,
  tagline,
  specs,
  lofts,
  wheels,
  windows,
  glass = [],
}: {
  id: string;
  name: string;
  tagline: string;
  specs: { acceleration?: string; topSpeed?: string; range?: string; power?: string };
  lofts: (
    | [number, number, number, number?][]
    | { prof: [number, number, number, number?][] }
  )[];
  wheels: WheelSpec[];
  windows: WindowSpec[];
  glass?: GlassFace[];
}): VehicleModel {
  const side = (s: number): Point3D[][] => [
    ...windows.map((win) =>
      [...win.pts, win.pts[0]].map(([f, u]) => [f, s * win.w, u] as Point3D)
    ),
    ...wheels.filter((wh) => !wh.bare).map((wh) => arch(wh.f, wh.R, s * wh.w)),
  ];

  const processedLofts = lofts.map((p) => ('prof' in p ? p.prof : p));

  return {
    id,
    name,
    tagline,
    specs,
    faces: processedLofts.flatMap((p, i) =>
      loft(p, i === processedLofts.length - 1 ? side : () => [], 'prof' in lofts[i])
    ),
    outlines: lofts
      .filter((p): p is { prof: [number, number, number, number?][] } => 'prof' in p)
      .map((p) =>
        p.prof.flatMap(([f, u, w]) => [
          [f, -w, u] as Point3D,
          [f, w, u] as Point3D,
        ])
      ),
    glass,
    wheels: [1, -1].flatMap((s) => wheels.map((wh) => ({ ...wh, s }))),
  };
}

export const ROADSTER = createVehicle({
  id: 'roadster',
  name: 'Tesla Roadster',
  tagline: 'SpaceX Thruster Package',
  specs: {
    acceleration: '0-60 mph in 1.1s (thrusters)',
    topSpeed: '250+ mph (400+ km/h)',
    range: '620 miles (1,000 km)',
    power: 'All-Wheel Drive / 10,000 Nm',
  },
  lofts: [
    {
      prof: soft(
        [
          [-21.5, 3.2, 9.4],
          [-22.2, 8.4, 9.4],
          [-15, 9.6, 8.8, 1],
          [-7, 11.8, 6.4, 1],
          [1, 12, 6.2, 1],
          [9.5, 8.6, 8.6],
          [18.5, 6.6, 9.8],
          [22.6, 4.8, 9.4],
          [22, 2.6, 9.2],
          [-19, 1.8, 9.2],
        ],
        1
      ),
    },
  ],
  windows: [
    { w: 8.3, pts: [[-12.5, 9.8], [-6.6, 11.2], [0.8, 11.4], [8, 9.1]] },
    { w: 9.3, pts: [[-1.6, 2.6], [-2.2, 9.6]] },
    // Shoulder line, as segments since window outlines are drawn closed
    { w: 9.35, pts: [[-19.6, 6.8], [-8, 7.6]] },
    { w: 9.35, pts: [[-8, 7.6], [9, 7.2]] },
    { w: 9.35, pts: [[9, 7.2], [20.6, 5.6]] },
    { w: 9.35, pts: [[19.4, 6.3], [22.2, 5]] },
    { w: 9.35, pts: [[-21.6, 7.6], [-19.2, 8.2]] },
  ],
  wheels: [{ f: -13.5, R: 3.9, w: 9.6 }, { f: 13.6, R: 3.9, w: 9.6 }],
});

export const MODEL3 = createVehicle({
  id: 'model3',
  name: 'Tesla Model 3',
  tagline: 'High-Efficiency Electric Sedan',
  specs: {
    acceleration: '0-60 mph in 2.9s',
    topSpeed: '163 mph',
    range: '341 miles',
    power: 'Dual Motor Performance AWD',
  },
  lofts: [
    {
      prof: soft(
        [
          [-23.5, 3.5, 9.2],
          [-24, 8.6, 9.2],
          [-19.5, 10, 8.6, 1],
          [-10, 14.2, 6.8, 1],
          [2, 14.4, 6.8, 1],
          [11, 10.2, 8.6],
          [21, 8, 9.2],
          [23.6, 6, 9.2],
          [23.2, 3.2, 9.2],
          [-21, 2.4, 9.2],
        ],
        1
      ),
    },
  ],
  windows: [
    { w: 8, pts: [[-14.5, 10.6], [-9.5, 13.3], [1.5, 13.5], [9, 10.6]] },
    { w: 8.1, pts: [[-3.2, 10.6], [-3.4, 13.4]] },
    { w: 9.15, pts: [[-3.4, 3], [-3.6, 10.2]] },
    { w: 9.15, pts: [[9.4, 3.2], [9.2, 10.1]] },
    { w: 9.15, pts: [[21, 7.4], [23.4, 6.2]] },
  ],
  wheels: [{ f: -14.5, R: 3.4, w: 9.4 }, { f: 14.5, R: 3.4, w: 9.4 }],
});

export const MODELY = createVehicle({
  id: 'modely',
  name: 'Tesla Model Y',
  tagline: 'World’s Best-Selling EV Crossover',
  specs: {
    acceleration: '0-60 mph in 3.5s',
    topSpeed: '155 mph',
    range: '320 miles',
    power: 'Dual Motor Long Range AWD',
  },
  lofts: [
    {
      prof: soft(
        [
          [-23.5, 3.5, 9.4],
          [-24, 10, 9.2],
          [-21, 13.8, 8.2, 1],
          [-14, 16, 7, 1],
          [3, 16.2, 7, 1],
          [11.5, 11, 8.8],
          [21, 8.6, 9.4],
          [23.6, 6.4, 9.4],
          [23.2, 3.2, 9.4],
          [-21, 2.4, 9.4],
        ],
        1
      ),
    },
  ],
  windows: [
    { w: 8.3, pts: [[-19.5, 11.6], [-13.5, 15], [2.5, 15.2], [10, 11.4]] },
    { w: 8.4, pts: [[-4.6, 11.6], [-4.8, 15.1]] },
    { w: 9.35, pts: [[-4.8, 3], [-5, 11.2]] },
    { w: 9.35, pts: [[10.4, 3.2], [10.2, 10.9]] },
    { w: 9.35, pts: [[21, 8], [23.4, 6.6]] },
  ],
  wheels: [{ f: -14.5, R: 3.6, w: 9.6 }, { f: 14.8, R: 3.6, w: 9.6 }],
});

export const CYBERTRUCK = createVehicle({
  id: 'cybertruck',
  name: 'Tesla Cybertruck',
  tagline: 'Stainless Steel Exoskeleton Beast',
  specs: {
    acceleration: '0-60 mph in 2.6s (Beast)',
    topSpeed: '130 mph',
    range: '340 miles',
    power: '845 hp Tri-Motor Cyberbeast',
  },
  lofts: [
    [
      [-28.5, 4, 10],
      [-28.5, 12.6, 10],
      [1, 19, 8.4, 1],
      [12, 15.6, 9.4],
      [28.5, 10.6, 10.1],
      [28.6, 5.6, 10.1],
      [24, 3.4, 10],
      [-24, 3.4, 10],
    ],
  ],
  windows: [{ w: 9.4, pts: [[-10, 13.4], [-8, 16.2], [1, 18.1], [11, 15.2], [13, 13.4]] }],
  wheels: [{ f: -18.5, R: 4.4, w: 10.2 }, { f: 18.5, R: 4.4, w: 10.2 }],
});

const SEMI_FACE: [Point3D, Point3D] = [
  [13.6, 31.6, 12],
  [22.4, 20.6, 12.4],
];

export const SEMI = createVehicle({
  id: 'semi',
  name: 'Tesla Semi',
  tagline: 'Class 8 Electric Heavy Hauler',
  specs: {
    acceleration: '0-60 mph in 20s (fully loaded)',
    topSpeed: '65 mph up 5% grade',
    range: '500 miles highway',
    power: 'Tri-Motor Independent Axles',
  },
  lofts: [
    [
      [-41, 3.6, 9],
      [-41, 9.4, 9],
      [-5, 9.4, 9],
      [-5, 3.6, 9],
    ],
    {
      prof: soft([
        [-5, 4.4, 12.6],
        [-5, 39.6, 12.4],
        [-3, 41.2, 12.2],
        [4, 40.8, 12],
        [9.5, 38.6, 11.8],
        [13.6, 31.6, 12],
        [22.4, 20.6, 12.4],
        [27.6, 16.8, 12.6],
        [30.8, 12.2, 12.6],
        [31.8, 6.6, 12.6],
        [30.6, 3.8, 12.4],
      ]),
    },
  ],
  windows: [
    { w: 12.4, pts: [[2, 24.4], [2, 35], [6.6, 37.6], [10.6, 35.4], [19.8, 23.4]] },
    { w: 12.6, pts: [[0.4, 6.4], [0.4, 38.2]] },
    { w: 12.6, pts: [[-4.4, 26.4], [2, 26.4]] },
  ],
  glass: [
    (() => {
      const [a, b] = SEMI_FACE;
      const at = (t: number, s: number): Point3D => {
        const p = lerp3(a, b, t);
        return [p[0] + 0.15, s * (p[2] - 1.6), p[1] + 0.15];
      };
      const loop: Point3D[] = [
        at(0.1, -1),
        at(0.1, 1),
        at(0.92, 1),
        at(0.92, -1),
        at(0.1, -1),
      ];
      const du = b[1] - a[1];
      const df = b[0] - a[0];
      const m = Math.hypot(du, df);
      return { pts: loop, n: [-du / m, 0, df / m] as Point3D };
    })(),
  ],
  wheels: [
    { f: -34, R: 5, w: 9.4, bare: true },
    { f: -23, R: 5, w: 9.4, bare: true },
    { f: 22.4, R: 5.4, w: 12.8 },
  ],
});

export interface FleetItem {
  x: number;
  y: number;
  v: VehicleModel;
  h: number;
}

export const FLEET: FleetItem[] = [
  { x: -52, y: 2, v: MODEL3, h: 14 },
  { x: -18, y: -3, v: SEMI, h: 40 },
  { x: 15, y: 4, v: MODELY, h: 16 },
  { x: 47, y: 0, v: CYBERTRUCK, h: 19 },
];
