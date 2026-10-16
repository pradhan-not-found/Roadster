import type { Point3D, Point2D } from './math';
import { dot, poly, open, hull } from './math';
import type { VehicleModel, Face, GlassFace, WheelSpec } from '../data/vehicles';
import { ring } from '../data/vehicles';

export const SVG_NS = 'http://www.w3.org/2000/svg';

export const mk = <K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
  parent?: SVGElement | Element
): SVGElementTagNameMap[K] => {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) {
    el.setAttribute(k, String(attrs[k]));
  }
  if (parent) {
    parent.append(el);
  }
  return el;
};

export interface BuiltFace extends Omit<Face, 'deco'> {
  g: SVGGElement;
  body: SVGPathElement;
  decoEl: SVGPathElement;
  lines: Point3D[][];
}

export interface BuiltWheel extends WheelSpec {
  g: SVGGElement;
  tread: SVGPathElement;
  disc: SVGPathElement;
  hub: SVGPathElement;
  s: number;
}

export interface BuiltVehicle {
  faces: BuiltFace[];
  outlines: { pts: Point3D[]; el: SVGPathElement }[];
  glass: (GlassFace & { el: SVGPathElement })[];
  wheels: BuiltWheel[];
  order: string;
}

export function buildVehicle(
  parent: SVGElement,
  v: VehicleModel,
  cls: string
): BuiltVehicle {
  return {
    faces: v.faces.map((f) => {
      const g = mk('g', {}, parent);
      return {
        ...f,
        g,
        body: mk('path', { class: f.quiet ? 'fo' : cls }, g),
        decoEl: mk('path', { class: 'nf mid' }, g),
        lines: f.deco,
      };
    }),
    outlines: v.outlines.map((pts) => ({
      pts,
      el: mk('path', { class: 'nf ' + cls }, parent),
    })),
    glass: v.glass.map((gl) => ({
      ...gl,
      el: mk('path', { class: 'nf mid' }, parent),
    })),
    wheels: v.wheels.map((w) => {
      const g = mk('g', {}, parent);
      return {
        ...w,
        g,
        tread: mk('path', { class: cls }, g),
        disc: mk('path', { class: cls }, g),
        hub: mk('path', { class: 'nf ' + cls }, g),
        s: w.s ?? 1,
      };
    }),
    order: '',
  };
}

export interface FrameResult {
  R: (v: Point3D) => Point3D;
  at: (v: Point3D) => Point3D;
}

export function renderVehicle(
  m: BuiltVehicle,
  fr: FrameResult,
  spin: number,
  parent: SVGElement,
  P: (pt: Point3D) => Point2D,
  VIEW: Point3D
) {
  const at = (p: Point3D): Point2D => P(fr.at(p));
  const far: { g: SVGElement }[] = [];
  const near: { g: SVGElement }[] = [];
  const mid: { g: SVGElement; d: number }[] = [];
  const base: { g: SVGElement; d: number }[] = [];

  for (const f of m.faces) {
    const seen = dot(fr.R(f.n), VIEW) > 0;
    f.body.setAttribute('d', seen ? poly(f.pts.map(at)) : '');
    f.decoEl.setAttribute('d', seen ? f.lines.map((l) => open(l.map(at))).join('') : '');
    if (seen) {
      (f.n[2] < -0.5 ? base : mid).push({ g: f.g, d: dot(fr.at(f.c), VIEW) });
    }
  }

  mid.sort((a, b) => a.d - b.d);

  for (const w of m.wheels) {
    const y = w.s * (w.w + 0.2);
    const out = ring(w.f, w.R, y, w.R);
    const seen = dot(fr.R([0, w.s, 0]), VIEW) > 0;
    const innerRing = ring(w.f, w.R, y - w.s * 2.6, w.R);
    const combinedPoints: Point3D[] = [...out, ...innerRing];
    w.tread.setAttribute(
      'd',
      poly(hull(combinedPoints.map(at)))
    );

    const cap = seen ? y : y - w.s * 2.6;
    w.disc.setAttribute(
      'd',
      poly(ring(w.f, w.R, cap, w.R).map(at)) +
        (seen ? '' : poly(ring(w.f, w.R, cap, w.R * 0.3, 12).map(at)))
    );

    let hub = '';
    if (seen) {
      hub = poly(ring(w.f, w.R, y, w.R * 0.36, 12).map(at));
      for (let k = 0; k < 5; k++) {
        const a = spin / w.R + (k * Math.PI * 2) / 5;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const spokeStart: Point3D = [w.f + c * w.R * 0.36, y, w.R + s * w.R * 0.36];
        const spokeEnd: Point3D = [w.f + c * w.R * 0.82, y, w.R + s * w.R * 0.82];
        hub += open([at(spokeStart), at(spokeEnd)]);
      }
    }
    w.hub.setAttribute('d', hub);
    (seen ? near : far).push({ g: w.g });
  }

  for (const o of m.outlines) {
    o.el.setAttribute('d', poly(hull(o.pts.map(at))));
  }

  for (const gl of m.glass) {
    gl.el.setAttribute('d', dot(fr.R(gl.n), VIEW) > 0 ? open(gl.pts.map(at)) : '');
  }

  const seq = [...base, ...far, ...mid, ...m.outlines, ...m.glass, ...near].map(
    (it) => ('g' in it ? it.g : it.el)
  );

  const key = seq
    .map((g) => {
      const el = g as unknown as HTMLElement;
      return el.dataset.i || (el.dataset.i = Math.random().toString(36).slice(2, 7));
    })
    .join();

  if (key !== m.order) {
    m.order = key;
    parent.append(...seq);
  }
}
