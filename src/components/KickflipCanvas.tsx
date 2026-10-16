import React, { useEffect, useRef, useCallback } from 'react';
import type {
  Point3D,
  Point2D,
  CameraState,
} from '../engine/math';
import {
  lerp,
  clamp,
  smooth,
  r2,
  poly,
  open,
  dot,
  createProjection,
  frame,
  pose,
  DEFAULT_CONSTANTS,
} from '../engine/math';
import type { VehicleModel } from '../data/vehicles';
import {
  ROADSTER,
  FLEET,
} from '../data/vehicles';
import type { BuiltVehicle } from '../engine/renderer';
import {
  mk,
  buildVehicle,
  renderVehicle,
} from '../engine/renderer';
import { sounds } from '../audio/sounds';

export interface KickflipCanvasProps {
  isPlaying: boolean;
  speed: number;
  progress: number;
  azimuthDeg: number;
  onProgressUpdate?: (u: number) => void;
  onSelectVehicle?: (vehicle: VehicleModel) => void;
}

export const KickflipCanvas: React.FC<KickflipCanvasProps> = ({
  isPlaying,
  speed,
  progress,
  azimuthDeg,
  onProgressUpdate,
  onSelectVehicle,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // References to keep mutable animation state without re-creating SVG DOM
  const animRef = useRef<{
    raf: number;
    t0: number;
    u: number;
    lastTime: number;
  }>({
    raf: 0,
    t0: 0,
    u: progress,
    lastTime: 0,
  });

  const sceneRefs = useRef<{
    RS: BuiltVehicle;
    jets: SVGPathElement;
    trail: SVGPathElement;
    body: SVGGElement;
    car: SVGGElement;
    puffs: { x: number; els: SVGPathElement[] }[];
    fleet: { g: SVGGElement; depth: number; v: VehicleModel }[];
    slot: SVGElement | null;
    P: (p: Point3D) => Point2D;
    VIEW: Point3D;
  } | null>(null);

  // Keep latest props in ref for animation frame callback
  const propsRef = useRef({
    isPlaying,
    speed,
    azimuthDeg,
    onProgressUpdate,
    onSelectVehicle,
  });
  useEffect(() => {
    propsRef.current = {
      isPlaying,
      speed,
      azimuthDeg,
      onProgressUpdate,
      onSelectVehicle,
    };
  }, [isPlaying, speed, azimuthDeg, onProgressUpdate, onSelectVehicle]);

  // If progress is externally scrubbed while paused, update u
  useEffect(() => {
    if (!isPlaying) {
      animRef.current.u = progress;
      if (sceneRefs.current) {
        drawFrame(progress, performance.now());
      }
    }
  }, [progress, isPlaying]);

  const drawFrame = useCallback((u: number, now: number) => {
    const sc = sceneRefs.current;
    if (!sc) return;

    const { RS, jets, trail, body, car, puffs, fleet, P, VIEW } = sc;
    const { XL, XR, H, PIV } = DEFAULT_CONSTANTS;

    const q = pose(u, DEFAULT_CONSTANTS);
    const fr = frame([q.x, 0, q.z], PIV, 0, q.pitch, q.roll);
    renderVehicle(RS, fr, -q.x * 0.3, body, P, VIEW);

    // Jet cold gas thruster flame particles
    let d = '';
    if (q.jet > 0.02) {
      for (const [f, s] of [
        [-13.5, -5.5],
        [-13.5, 5.5],
        [13.6, -5.5],
        [13.6, 5.5],
      ]) {
        const L = q.jet * (11 + 2 * Math.sin(now / 40 + f + s));
        d += open(
          [
            [f - 1, s, 1.8],
            [f, s, 1.8 - L],
            [f + 1, s, 1.8],
          ].map((p) => P(fr.at(p as Point3D)))
        );
      }
    }
    jets.setAttribute('d', d);

    // Fleet depth sorting vs flying Roadster
    const depth = dot([q.x, 0, PIV + q.z], VIEW);
    const before = fleet.filter((v) => v.depth < depth).pop();
    const ref = before ? before.g : puffs[1].els[1];
    if (ref !== sc.slot) {
      sc.slot = ref;
      ref.after(trail, car);
    }

    // Trajectory dashed flight path
    if (q.t > 0) {
      const end = Math.min(q.x, XR);
      const pts: Point2D[] = [];
      for (let k = 0; k <= 32; k++) {
        const x = lerp(XL, end, k / 32);
        const t = (x - XL) / (XR - XL);
        pts.push(P([x, 0, PIV - 3 + H * 4 * t * (1 - t)]));
      }
      trail.setAttribute('d', open(pts));
      trail.setAttribute('opacity', String(r2(1 - smooth((q.x - XR) / 46))));
    } else {
      trail.setAttribute('d', '');
    }

    // Tire smoke puff clouds
    for (const p of puffs) {
      const k = (q.x - p.x) / 70;
      p.els.forEach((el, j) => {
        const s = clamp(k - j * 0.15, 0, 1);
        const on = k > j * 0.15 && s < 1;
        if (!on) {
          el.setAttribute('d', '');
          return;
        }
        const R = lerp(4, 22 - j * 6, 1 - Math.pow(1 - s, 3));
        el.setAttribute('opacity', String(r2(1 - s)));
        el.setAttribute(
          'd',
          poly(
            Array.from({ length: 28 }, (_, a) =>
              P([
                p.x + R * Math.cos((a / 28) * 2 * Math.PI),
                R * 0.9 * Math.sin((a / 28) * 2 * Math.PI),
                0.3,
              ])
            )
          )
        );
      });
    }

    // Sound effect trigger update
    sounds.updateSound(q.t, q.air, q.jet);
  }, []);

  // Initialize and reconstruct SVG Scene when Azimuth or Mount occurs
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    // Clear previous elements
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    const { XL, XR, XA, XB, PIV, H } = DEFAULT_CONSTANTS;
    const cam: CameraState = { S: 1, ox: 0, oy: 0 };
    const { VIEW, project: P } = createProjection(cam, azimuthDeg);

    // Compute bounding box for auto-scaling
    const bound: Point3D[] = [
      [-118, -44, -4],
      [118, 44, -4],
      [-118, 44, -4],
      [118, -44, -4],
      [0, 0, PIV + H + 12],
      [0, -12, PIV + H + 10],
      [0, 12, PIV + H + 10],
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
    const cyy = c.map((p) => p[1]);
    cam.ox = 200 - (Math.max(...cx) + Math.min(...cx)) / 2;
    cam.oy = 162 - (Math.max(...cyy) + Math.min(...cyy)) / 2;

    // Defs & Edge Mask
    const defs = mk('defs', {}, svg);
    const g0 = P([-150, 0, 0]);
    const g1 = P([150, 0, 0]);
    const grad = mk(
      'linearGradient',
      {
        id: 'rk-fade',
        gradientUnits: 'userSpaceOnUse',
        x1: g0[0],
        y1: g0[1],
        x2: g1[0],
        y2: g1[1],
      },
      defs
    );

    [
      [0, 0],
      [0.18, 1],
      [0.82, 1],
      [1, 0],
    ].forEach(([o, a]) => {
      mk('stop', { offset: o, 'stop-color': '#fff', 'stop-opacity': a }, grad);
    });

    const mask = mk(
      'mask',
      { id: 'rk-mask', maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 400, height: 320 },
      defs
    );
    mk('rect', { x: 0, y: 0, width: 400, height: 320, fill: 'url(#rk-fade)' }, mask);

    const scene = mk('g', { mask: 'url(#rk-mask)' }, svg);

    // Ground platform & Lane Dash markings
    const deck = mk('g', {}, scene);
    const deckTop: Point3D[] = [
      [-170, -44, 0],
      [170, -44, 0],
      [170, 44, 0],
      [-170, 44, 0],
    ];
    const deckSide: Point3D[] = [
      [-170, 44, 0],
      [170, 44, 0],
      [170, 44, -4],
      [-170, 44, -4],
    ];

    mk(
      'path',
      {
        d: poly(deckTop.map(P)) + poly(deckSide.map(P)),
      },
      deck
    );

    mk(
      'path',
      {
        class: 'nf lo dash',
        d:
          open([P([XA, 0, 0]), P([XL, 0, 0])]) +
          open([P([XR, 0, 0]), P([XB, 0, 0])]),
      },
      deck
    );

    // Smoke puff clouds
    const puffs = [XL - 4, XR + 4].map((x) => ({
      x,
      els: [0, 1].map(() => mk('path', { class: 'nf mid' }, scene)),
    }));

    // Tesla Fleet Vehicles
    const fleet = FLEET.map((f) => {
      const g = mk('g', { style: 'cursor: pointer;' }, scene);
      g.setAttribute('role', 'button');
      g.setAttribute('aria-label', f.v.name);
      g.addEventListener('click', () => {
        if (propsRef.current.onSelectVehicle) {
          propsRef.current.onSelectVehicle(f.v);
        }
      });
      const m = buildVehicle(g, f.v, '');
      renderVehicle(m, frame([f.x, f.y, 0], 0, 90, 0, 0), 0.6, g, P, VIEW);
      return { g, depth: dot([f.x, f.y, f.h / 2], VIEW), v: f.v };
    });

    // Trajectory trail
    const trail = mk('path', { class: 'nf dash' }, scene);

    // Roadster car
    const car = mk('g', { style: 'cursor: pointer;' }, scene);
    car.setAttribute('role', 'button');
    car.setAttribute('aria-label', ROADSTER.name);
    car.addEventListener('click', () => {
      if (propsRef.current.onSelectVehicle) {
        propsRef.current.onSelectVehicle(ROADSTER);
      }
    });

    const jets = mk('path', { class: 'nf mid' }, car);
    const body = mk('g', {}, car);
    const RS = buildVehicle(body, ROADSTER, 'hi');

    sceneRefs.current = {
      RS,
      jets,
      trail,
      body,
      car,
      puffs,
      fleet,
      slot: null,
      P,
      VIEW,
    };

    drawFrame(animRef.current.u, performance.now());
  }, [azimuthDeg, drawFrame]);

  // Main animation ticker loop
  useEffect(() => {
    let active = true;

    const tick = (now: number) => {
      if (!active) return;

      const { isPlaying, speed, onProgressUpdate } = propsRef.current;
      const { PERIOD } = DEFAULT_CONSTANTS;

      if (isPlaying) {
        if (!animRef.current.lastTime) {
          animRef.current.lastTime = now;
        }
        const delta = now - animRef.current.lastTime;
        animRef.current.lastTime = now;

        // Advance progress
        const step = (delta / PERIOD) * speed;
        animRef.current.u = (animRef.current.u + step) % 1;

        if (onProgressUpdate) {
          onProgressUpdate(animRef.current.u);
        }

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
      cancelAnimationFrame(animRef.current.raf);
    };
  }, [drawFrame]);

  return (
    <div
      ref={containerRef}
      className="loader"
      role="status"
      aria-label="Tesla Roadster Kickflip Animation"
    >
      <svg
        ref={svgRef}
        viewBox="0 0 400 320"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid meet"
      />
    </div>
  );
};
