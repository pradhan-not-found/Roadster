import React, { useEffect, useRef, useCallback } from 'react';
import type { Point3D, Point2D, CameraState } from '../engine/math';
import { lerp, clamp, smooth, r2, poly, open, createProjection, frame } from '../engine/math';
import { ROADSTER } from '../data/vehicles';
import type { BuiltVehicle } from '../engine/renderer';
import { mk, buildVehicle, renderVehicle } from '../engine/renderer';
import {
  RAMP,
  RAMP_PERIOD,
  APEX,
  LIP_POINT,
  OVERHANG,
  WALL_X,
  backAt,
  PIV,
  U_LIP,
  U_LAND,
  rampPose,
  rampProfile,
} from '../engine/ramp';
import { sounds } from '../audio/sounds';

export interface RampCanvasProps {
  isPlaying: boolean;
  speed: number;
  progress: number;
  azimuthDeg: number;
  onProgressUpdate?: (u: number) => void;
}

const SLAB = 2.5;
const TRUSS = 12;

export const RampCanvas: React.FC<RampCanvasProps> = ({
  isPlaying,
  speed,
  progress,
  azimuthDeg,
  onProgressUpdate,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const animRef = useRef({ raf: 0, u: progress, lastTime: 0 });

  const sceneRefs = useRef<{
    RS: BuiltVehicle;
    jets: SVGPathElement;
    jetCore: SVGPathElement;
    trail: SVGPathElement;
    body: SVGGElement;
    car: SVGGElement;
    slabTop: SVGGElement;
    dust: SVGPathElement[];
    flight: Point3D[];
    P: (p: Point3D) => Point2D;
    VIEW: Point3D;
  } | null>(null);

  const propsRef = useRef({ isPlaying, speed, onProgressUpdate });
  useEffect(() => {
    propsRef.current = { isPlaying, speed, onProgressUpdate };
  }, [isPlaying, speed, onProgressUpdate]);

  const drawFrame = useCallback((u: number, now: number) => {
    const sc = sceneRefs.current;
    if (!sc) return;
    const { RS, jets, jetCore, trail, body, car, slabTop, dust, flight, P, VIEW } = sc;

    const q = rampPose(u);
    // Riding under the curl, the track hides the car; otherwise the car is in front
    const under = q.phase === 'Climb' && q.pitch > OVERHANG;
    if (under !== (car.nextSibling === slabTop)) {
      if (under) slabTop.before(car);
      else slabTop.after(car);
    }
    const fr = frame([q.c[0], q.c[1], q.c[2] - PIV], PIV, q.yaw, q.pitch, q.roll);
    renderVehicle(RS, fr, -q.dist * 0.3, body, P, VIEW);

    // Cold gas thrusters: a flared plume per nozzle along the car's local down
    // axis, with a bright core and a wavering tip
    let d = '';
    let cores = '';
    if (q.jet > 0.02) {
      for (const [f, s] of [
        [-13.5, -5.5],
        [-13.5, 5.5],
        [13.6, -5.5],
        [13.6, 5.5],
      ]) {
        const t = now / 45 + f * 0.7 + s;
        const L = q.jet * (26 + 3 * Math.sin(t));
        const W = 1 + q.jet * (3.4 + 0.5 * Math.sin(t * 1.7));
        const sway = 0.8 * Math.sin(t * 0.9);
        const at = (df: number, du: number) => P(fr.at([f + df, s, 1.8 - du]));
        d += poly([
          at(-0.6, 0),
          at(-W * 0.35, L * 0.3),
          at(-W * 0.8 + sway * 0.5, L * 0.65),
          at(-W + sway, L * 0.9),
          at(sway * 1.4, L),
          at(W + sway, L * 0.9),
          at(W * 0.8 + sway * 0.5, L * 0.65),
          at(W * 0.35, L * 0.3),
          at(0.6, 0),
        ]);
        cores += open([at(0, 0), at(sway * 0.3, L * 0.4)]);
      }
    }
    jets.setAttribute('d', d);
    jetCore.setAttribute('d', cores);

    // Flight path, drawn up to the car, then faded after touchdown
    if (u >= U_LIP) {
      const k = clamp((u - U_LIP) / (U_LAND - U_LIP), 0, 1);
      const n = Math.max(2, Math.round(k * (flight.length - 1)) + 1);
      trail.setAttribute('d', open(flight.slice(0, n).map(P)));
      trail.setAttribute('opacity', String(r2(1 - smooth((u - U_LAND) / 0.08))));
    } else {
      trail.setAttribute('d', '');
    }

    // Touchdown dust rings
    dust.forEach((el, j) => {
      const s = clamp(q.dust - j * 0.14, 0, 1);
      if (s <= 0 || s >= 1) {
        el.setAttribute('d', '');
        return;
      }
      const R = lerp(6, 34 - j * 9, 1 - Math.pow(1 - s, 3));
      el.setAttribute('opacity', String(r2(1 - s)));
      // Scalloped edge reads as billowing gas rather than a clean ring
      el.setAttribute(
        'd',
        poly(
          Array.from({ length: 48 }, (_, a) => {
            const ang = (a / 48) * 2 * Math.PI;
            const r = R * (1 + 0.07 * Math.sin(ang * 9 + j * 2));
            return P([RAMP.XLAND + r * Math.cos(ang), r * 0.9 * Math.sin(ang), 0.3 + j * 2 * s]);
          })
        )
      );
    });

    sounds.updateSound(q.t, q.air, q.jet);
  }, []);

  useEffect(() => {
    if (!isPlaying) {
      animRef.current.u = progress;
      drawFrame(progress, performance.now());
    }
  }, [progress, isPlaying, drawFrame]);

  // Build the static scene; rebuilt when the camera azimuth changes
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const { XA, X0, HALF, XLAND } = RAMP;
    const XW = WALL_X;
    const XF = XW + 3; // front tower column, just behind the wall
    const XR = XF + TRUSS; // rear tower column
    const ZTOP = LIP_POINT.z + 7; // top of the gantry
    const XBEAM = LIP_POINT.x - 3; // overhead beam reaches out over the lip

    // Side-on camera from the run-up side, so the riding surface faces the viewer
    const cam: CameraState = { S: 1, ox: 0, oy: 0 };
    const { VIEW, project: P } = createProjection(cam, -azimuthDeg * 0.55);

    // Framed on the ramp and touchdown zone; the long run-up bleeds off the left edge
    const bound: Point3D[] = [
      [-80, -30, -4],
      [110, 30, -4],
      [-80, 30, -4],
      [110, -30, -4],
      [XR, -HALF, ZTOP],
      [XR, HALF, ZTOP],
      [XBEAM - 14, 0, APEX + 8],
      [XLAND, 0, APEX + 4],
    ];
    const b = bound.map(P);
    const xs = b.map((p) => p[0]);
    const ys = b.map((p) => p[1]);
    cam.S = Math.min(
      376 / (Math.max(...xs) - Math.min(...xs)),
      292 / (Math.max(...ys) - Math.min(...ys))
    );
    const c = bound.map(P);
    const cx = c.map((p) => p[0]);
    const cy = c.map((p) => p[1]);
    cam.ox = 200 - (Math.max(...cx) + Math.min(...cx)) / 2;
    cam.oy = 162 - (Math.max(...cy) + Math.min(...cy)) / 2;

    // Edge fade, starting inside the frame so the run-up never ends on a hard edge
    const defs = mk('defs', {}, svg);
    const g0 = P([-105, 0, 0]);
    const g1 = P([150, 0, 0]);
    const grad = mk(
      'linearGradient',
      { id: 'rp-fade', gradientUnits: 'userSpaceOnUse', x1: g0[0], y1: g0[1], x2: g1[0], y2: g1[1] },
      defs
    );
    [
      [0, 0],
      [0.2, 1],
      [0.85, 1],
      [1, 0],
    ].forEach(([o, a]) => mk('stop', { offset: o, 'stop-color': '#fff', 'stop-opacity': a }, grad));
    const mask = mk('mask', { id: 'rp-mask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 400, height: 320 }, defs);
    mk('rect', { x: 0, y: 0, width: 400, height: 320, fill: 'url(#rp-fade)' }, mask);

    const scene = mk('g', { mask: 'url(#rp-mask)' }, svg);
    const quad = (pts: Point3D[]) => poly(pts.map(P));
    const line = (p: Point3D, q: Point3D) => open([P(p), P(q)]);

    // Ground deck
    mk(
      'path',
      {
        d:
          quad([
            [-170, -44, 0],
            [170, -44, 0],
            [170, 44, 0],
            [-170, 44, 0],
          ]) +
          quad([
            [-170, 44, 0],
            [170, 44, 0],
            [170, 44, -4],
            [-170, 44, -4],
          ]),
      },
      scene
    );

    // Run-up lane edge lights and touchdown pad
    mk(
      'path',
      { class: 'nf led dots', d: line([XA, -HALF, 0], [X0, -HALF, 0]) + line([XA, HALF, 0], [X0, HALF, 0]) },
      scene
    );
    mk('path', { class: 'nf lo dash', d: line([XA, 0, 0], [X0, 0, 0]) }, scene);
    mk(
      'path',
      {
        class: 'nf mid dash',
        d: quad([
          [XLAND - 20, -14, 0],
          [XLAND + 20, -14, 0],
          [XLAND + 20, 14, 0],
          [XLAND - 20, 14, 0],
        ]),
      },
      scene
    );
    mk(
      'path',
      { class: 'nf lo', d: line([XLAND - 5, 0, 0], [XLAND + 5, 0, 0]) + line([XLAND, -5, 0], [XLAND, 5, 0]) },
      scene
    );

    // Back face of the slab, offset away from the riding side
    const prof = rampProfile(56);
    const backOf = ([x, z, th]: [number, number, number]): [number, number] => [
      x + SLAB * Math.sin(th),
      Math.max(0, z - SLAB * Math.cos(th)),
    ];

    // Gantry: a braced tower behind the wall and a beam reaching over the curl
    const truss = mk('g', {}, scene);
    const levels = [0, 12, 24, 36, 48, 60, ZTOP];
    let frameD = '';
    let braceD = '';
    for (const y of [-HALF, HALF]) {
      frameD += line([XF, y, 0], [XF, y, ZTOP]) + line([XR, y, 0], [XR, y, ZTOP]);
      levels.forEach((z, i) => {
        frameD += line([XF, y, z], [XR, y, z]);
        if (i > 0) {
          braceD += line([XF, y, levels[i - 1]], [XR, y, z]) + line([XR, y, levels[i - 1]], [XF, y, z]);
        }
        // Struts tying the lower curve back to the tower
        if (z > 0 && z < RAMP.R1) frameD += line([backAt(z, SLAB), y, z], [XF, y, z]);
      });
      // Overhead beam: two chords with a Warren web
      const zb = ZTOP - 5;
      frameD += line([XBEAM, y, ZTOP], [XR, y, ZTOP]) + line([XBEAM, y, zb], [XF, y, zb]);
      const bays = 4;
      for (let k = 0; k < bays; k++) {
        const x0 = lerp(XBEAM, XF, k / bays);
        const x1 = lerp(XBEAM, XF, (k + 1) / bays);
        braceD += line([x0, y, zb], [(x0 + x1) / 2, y, ZTOP]) + line([(x0 + x1) / 2, y, ZTOP], [x1, y, zb]);
      }
      frameD += line([XBEAM, y, zb], [XBEAM, y, ZTOP]);
      // Hangers from the beam down to the back of the curl
      for (const k of [0.72, 0.8, 0.88, 0.96]) {
        const [hx, hz] = backOf(prof[Math.round(k * (prof.length - 1))]);
        if (hz < zb) frameD += line([hx, y, hz], [hx, y, zb]);
      }
    }
    for (const z of levels.slice(1)) {
      frameD += line([XR, -HALF, z], [XR, HALF, z]);
      braceD += line([XR, -HALF, z - 12], [XR, HALF, z]);
    }
    frameD += line([XBEAM, -HALF, ZTOP], [XBEAM, HALF, ZTOP]) + line([XF, -HALF, ZTOP], [XF, HALF, ZTOP]);
    mk('path', { class: 'nf lo', d: braceD }, truss);
    mk('path', { class: 'nf mid', d: frameD }, truss);

    // Riding surface, split so the curl can be layered over a car riding beneath it
    const near = VIEW[1] > 0 ? HALF : -HALF;
    const cut = prof.findIndex(([, , th]) => th * (180 / Math.PI) > OVERHANG);
    const drawSlab = (part: [number, number, number][], g: SVGGElement, foot: boolean) => {
      mk(
        'path',
        {
          class: 'slab-edge',
          d: poly([
            ...part.map(([x, z]) => P([x, near, z])),
            ...part.map(backOf).reverse().map(([x, z]) => P([x, near, z])),
          ]),
        },
        g
      );
      let surf = '';
      for (let i = 0; i < part.length - 1; i++) {
        const [x0, z0] = part[i];
        const [x1, z1] = part[i + 1];
        surf += quad([
          [x0, -HALF, z0],
          [x1, -HALF, z1],
          [x1, HALF, z1],
          [x0, HALF, z0],
        ]);
      }
      mk('path', { class: 'fo surf', d: surf }, g);
      const rail = (y: number) => open(part.map(([x, z]) => P([x, y, z])));
      mk('path', { class: 'nf mid', d: rail(-5) + rail(5) }, g);
      const [ex, ez] = foot ? part[0] : part[part.length - 1];
      mk('path', { class: 'nf hi', d: rail(-HALF) + rail(HALF) + line([ex, -HALF, ez], [ex, HALF, ez]) }, g);
      mk('path', { class: 'nf led', d: rail(-HALF + 0.8) + rail(HALF - 0.8) }, g);
    };
    drawSlab(prof.slice(0, cut + 1), mk('g', {}, scene), true);

    const dust = [0, 1, 2].map(() => mk('path', { class: 'nf mid' }, scene));

    // Precomputed flight path from lip to touchdown
    const flight: Point3D[] = Array.from({ length: 48 }, (_, k) => {
      const q = rampPose(lerp(U_LIP, U_LAND, k / 47));
      return [q.c[0], 0, q.c[2] - 3];
    });
    const trail = mk('path', { class: 'nf dash' }, scene);

    const car = mk('g', {}, scene);
    car.setAttribute('aria-label', ROADSTER.name);
    const slabTop = mk('g', {}, scene);
    drawSlab(prof.slice(cut), slabTop, false);
    const jets = mk('path', { class: 'plume' }, car);
    const jetCore = mk('path', { class: 'nf hi plume-core' }, car);
    const body = mk('g', {}, car);
    const RS = buildVehicle(body, ROADSTER, 'hi');

    sceneRefs.current = { RS, jets, jetCore, trail, body, car, slabTop, dust, flight, P, VIEW };
    drawFrame(animRef.current.u, performance.now());
  }, [azimuthDeg, drawFrame]);

  // Animation ticker
  useEffect(() => {
    let active = true;
    const anim = animRef.current;
    const tick = (now: number) => {
      if (!active) return;
      const { isPlaying, speed, onProgressUpdate } = propsRef.current;
      if (isPlaying) {
        const delta = now - (animRef.current.lastTime || now);
        animRef.current.lastTime = now;
        animRef.current.u = (animRef.current.u + (delta / RAMP_PERIOD) * speed) % 1;
        onProgressUpdate?.(animRef.current.u);
        drawFrame(animRef.current.u, now);
      } else {
        animRef.current.lastTime = now;
      }
      animRef.current.raf = requestAnimationFrame(tick);
    };
    animRef.current.lastTime = performance.now();
    animRef.current.raf = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(anim.raf);
    };
  }, [drawFrame]);

  return (
    <div className="loader" role="status" aria-label="Tesla Roadster quarter-pipe launch">
      <svg ref={svgRef} viewBox="0 0 400 320" aria-hidden="true" preserveAspectRatio="xMidYMid meet" />
    </div>
  );
};
