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
    trail: SVGPathElement;
    body: SVGGElement;
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
    const { RS, jets, trail, body, dust, flight, P, VIEW } = sc;

    const q = rampPose(u);
    const fr = frame([q.c[0], q.c[1], q.c[2] - PIV], PIV, q.yaw, q.pitch, q.roll);
    renderVehicle(RS, fr, -q.dist * 0.3, body, P, VIEW);

    // Cold gas thrusters, firing along the car's local down axis
    let d = '';
    if (q.jet > 0.02) {
      for (const [f, s] of [
        [-13.5, -5.5],
        [-13.5, 5.5],
        [13.6, -5.5],
        [13.6, 5.5],
      ]) {
        const L = q.jet * (14 + 2.5 * Math.sin(now / 38 + f + s));
        d += open(
          [
            [f - 1.2, s, 1.8],
            [f, s, 1.8 - L],
            [f + 1.2, s, 1.8],
          ].map((p) => P(fr.at(p as Point3D)))
        );
      }
    }
    jets.setAttribute('d', d);

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

    const { XA, X0, RR, HALF, XLAND } = RAMP;
    const LZ = LIP_POINT.z;
    const XF = X0 + RR + 3; // front truss column, just behind the steepest point
    const XR = XF + TRUSS; // rear truss column

    // Side-on camera from the run-up side, so the riding surface faces the viewer
    const cam: CameraState = { S: 1, ox: 0, oy: 0 };
    const { VIEW, project: P } = createProjection(cam, -azimuthDeg * 0.55);

    // Framed on the ramp and touchdown zone; the long run-up bleeds off the left edge
    const bound: Point3D[] = [
      [-70, -30, -4],
      [110, 30, -4],
      [-70, 30, -4],
      [110, -30, -4],
      [XR, -HALF, LZ + 3],
      [XR, HALF, LZ + 3],
      [LIP_POINT.x - PIV, 0, APEX + 16],
      [XLAND, 0, APEX + 8],
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

    // Edge fade
    const defs = mk('defs', {}, svg);
    // Fade starts inside the framed area so the run-up never ends on a hard edge
    const g0 = P([-95, 0, 0]);
    const g1 = P([150, 0, 0]);
    const grad = mk(
      'linearGradient',
      { id: 'rp-fade', gradientUnits: 'userSpaceOnUse', x1: g0[0], y1: g0[1], x2: g1[0], y2: g1[1] },
      defs
    );
    [
      [0, 0],
      [0.22, 1],
      [0.85, 1],
      [1, 0],
    ].forEach(([o, a]) => mk('stop', { offset: o, 'stop-color': '#fff', 'stop-opacity': a }, grad));
    const mask = mk('mask', { id: 'rp-mask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 400, height: 320 }, defs);
    mk('rect', { x: 0, y: 0, width: 400, height: 320, fill: 'url(#rp-fade)' }, mask);

    const scene = mk('g', { mask: 'url(#rp-mask)' }, svg);
    const quad = (pts: Point3D[]) => poly(pts.map(P));

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
      { class: 'nf led dots', d: open([P([XA, -HALF, 0]), P([X0, -HALF, 0])]) + open([P([XA, HALF, 0]), P([X0, HALF, 0])]) },
      scene
    );
    mk('path', { class: 'nf lo dash', d: open([P([XA, 0, 0]), P([X0, 0, 0])]) }, scene);
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
      {
        class: 'nf lo',
        d: open([P([XLAND - 5, 0, 0]), P([XLAND + 5, 0, 0])]) + open([P([XLAND, -5, 0]), P([XLAND, 5, 0])]),
      },
      scene
    );

    const prof = rampProfile(36);
    // Back face of the slab, offset away from the riding side
    const back = prof.map(([x, z, th]): [number, number] => [
      x + SLAB * Math.sin(th),
      Math.max(0, z - SLAB * Math.cos(th)),
    ]);
    const backX = (z: number) => {
      const a = Math.acos(clamp(1 - z / RR, -1, 1));
      return X0 + RR * Math.sin(a) + SLAB * Math.sin(a);
    };

    // Support truss: two columns behind the steep section, struts reaching to the slab
    const truss = mk('g', {}, scene);
    const levels = [0, 12, 24, 36, 48, LZ];
    let frameD = '';
    let braceD = '';
    for (const y of [-HALF, HALF]) {
      for (const x of [XF, XR]) frameD += open([P([x, y, 0]), P([x, y, LZ + 3])]);
      levels.forEach((z, i) => {
        const zz = i === levels.length - 1 ? LZ + 3 : z;
        frameD += open([P([Math.min(backX(Math.max(z, 1)), XF), y, zz]), P([XR, y, zz])]);
        if (i > 0) braceD += open([P([XF, y, levels[i - 1]]), P([XR, y, zz])]);
      });
    }
    for (let i = 1; i < levels.length; i++) {
      const z0 = levels[i - 1];
      const z1 = i === levels.length - 1 ? LZ + 3 : levels[i];
      frameD += open([P([XR, -HALF, z1]), P([XR, HALF, z1])]) + open([P([XF, -HALF, z1]), P([XF, HALF, z1])]);
      braceD += open([P([XR, -HALF, z0]), P([XR, HALF, z1])]) + open([P([XR, HALF, z0]), P([XR, -HALF, z1])]);
    }
    mk('path', { class: 'nf lo', d: braceD }, truss);
    mk('path', { class: 'nf mid', d: frameD }, truss);

    // Riding surface
    const slab = mk('g', {}, scene);
    const near = VIEW[1] > 0 ? HALF : -HALF;

    // Edge band on the camera side shows the slab's thickness
    mk(
      'path',
      {
        d: poly([
          ...prof.map(([x, z]) => P([x, near, z])),
          ...back.slice().reverse().map(([x, z]) => P([x, near, z])),
        ]),
      },
      slab
    );

    let surf = '';
    for (let i = 0; i < prof.length - 1; i++) {
      const [x0, z0] = prof[i];
      const [x1, z1] = prof[i + 1];
      surf += quad([
        [x0, -HALF, z0],
        [x1, -HALF, z1],
        [x1, HALF, z1],
        [x0, HALF, z0],
      ]);
    }
    mk('path', { class: 'fo', d: surf }, slab);

    const rail = (y: number) => open(prof.map(([x, z]) => P([x, y, z])));
    mk('path', { class: 'nf mid', d: rail(-5) + rail(5) }, slab);
    mk(
      'path',
      {
        class: 'nf hi',
        d:
          rail(-HALF) +
          rail(HALF) +
          open([P([LIP_POINT.x, -HALF, LZ]), P([LIP_POINT.x, HALF, LZ])]) +
          open([P([X0, -HALF, 0]), P([X0, HALF, 0])]),
      },
      slab
    );
    // LED strips along both edges
    mk('path', { class: 'nf led', d: rail(-HALF + 0.8) + rail(HALF - 0.8) }, slab);

    const dust = [0, 1, 2].map(() => mk('path', { class: 'nf mid' }, scene));

    // Precomputed flight path from lip to touchdown
    const flight: Point3D[] = Array.from({ length: 48 }, (_, k) => {
      const q = rampPose(lerp(U_LIP, U_LAND, k / 47));
      return [q.c[0], 0, q.c[2] - 3];
    });
    const trail = mk('path', { class: 'nf dash' }, scene);

    const car = mk('g', {}, scene);
    car.setAttribute('aria-label', ROADSTER.name);
    const jets = mk('path', { class: 'nf mid' }, car);
    const body = mk('g', {}, car);
    const RS = buildVehicle(body, ROADSTER, 'hi');

    sceneRefs.current = { RS, jets, trail, body, dust, flight, P, VIEW };
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
