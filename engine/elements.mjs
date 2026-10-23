// Elements — a shot written as a sentence.
//
// The scene catalogue is finite because it is a list of one song's props. This
// module is the other half: ten drawing verbs with colour roles, depth and
// motion, so an agent can invent the imagery for a song it has never seen and
// say it in JSON instead of writing JavaScript.
//
// A layer is a list of elements drawn back to front. Every field is optional;
// what remains is a flat shape that does not move, which is almost never what
// you want — see `motion` and `react`.
//
//   { "kind": "rect", "at": [0.5, 0.62], "size": [0.34, 0.5],
//     "fill": "raised", "stroke": "line", "lw": 3,
//     "rotate": -0.04, "depth": 0.5, "alpha": 1,
//     "motion": { "enter": 0.7, "from": [0, 0.06], "travel": [0, -0.02], "spin": 0.06 },
//     "react":  { "bar": 0.03, "beat": 0.015 } }
//
// Coordinates: `at` and `size` are fractions of the frame (0.5 = middle), so a
// shot survives a change of render size. `px` swaps `at`/`size` for pixels when
// exact type sizes matter (text always uses pixels for `size`).

import {
  grainField, foldCreases, waterSurface, rainField, driftMotes,
  inkBleed, threadLines, lightShaft, softenVignette,
} from './primitive_fx.mjs';
import { hexA } from './story_fx.mjs';

const ROLES = ['bg', 'panel', 'raised', 'line', 'text', 'sub', 'mute', 'accent', 'accentHot', 'accentDim'];

const EASE = {
  linear: (k) => k,
  out: (k) => 1 - Math.pow(1 - k, 3),
  inOut: (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2),
  back: (k) => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2),
};

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

export const ELEMENT_KINDS = ['rect', 'ellipse', 'line', 'poly', 'arc', 'text', 'dots', 'band', 'blob', 'grid'];

// ---------------------------------------------------------------------------
// colour

function paint(p, role, fallback) {
  const key = role ?? fallback;
  if (!key || key === 'none') return null;
  if (ROLES.includes(key)) return p[key];
  return hexA(key, 1); // a literal colour is allowed; it just loses look-awareness
}

// ---------------------------------------------------------------------------
// geometry

function frameOf(el, W, H) {
  const u = el.unit === 'px';
  const fx = (v) => (u ? v : v * W);
  const fy = (v) => (u ? v : v * H);
  const at = el.at ?? [0.5, 0.5];
  const size = el.size ?? [0.2, 0.2];
  return { x: fx(at[0]), y: fy(at[1]), w: fx(size[0]), h: fy(size[1]) };
}

// ---------------------------------------------------------------------------
// motion

/**
 * Resolve one element's transform at time tv.
 * `enter` > 0 means the element arrives: it eases from `from` (a fraction of the
 * frame the element starts offset by) to its resting place.
 */
export function motionAt(el, tv, start, f) {
  const m = el.motion ?? {};
  const react = el.react ?? {};
  const enterDur = m.enter ?? 0;
  const delay = m.lag ?? 0;
  const t0 = start + delay;
  const k = enterDur > 0 ? clamp01((tv - t0) / enterDur) : 1;
  const a = (EASE[m.ease] ?? EASE.out)(k);

  const from = m.from ?? [0, 0.08];
  const offX = (1 - a) * (from[0] ?? 0);
  const offY = (1 - a) * (from[1] ?? 0);

  const dur = Math.max(0.001, (el.end ?? start + 1e9) - t0);
  const p = clamp01((tv - t0) / dur);
  const travel = m.travel ?? [0, 0];
  const travX = travel[0] * (m.travelEase ? (EASE[m.travelEase] ?? EASE.inOut)(p) : p);
  const travY = travel[1] * (m.travelEase ? (EASE[m.travelEase] ?? EASE.inOut)(p) : p);

  const spin = (m.spin ?? 0) * (tv - t0);
  const bob = (m.bob ?? 0) * Math.sin((tv - t0) * (m.bobHz ?? 0.6) * Math.PI * 2);
  const sink = m.sink ? clamp01((tv - t0 - (m.sinkAt ?? 0.6) * dur) / (dur * 0.3)) : 0;

  const beat = (f.beatPulse ?? 0) * (react.beat ?? 0);
  const bar = (f.barPulse ?? 0) * (react.bar ?? 0);
  const onset = (f.onsetPulse ?? 0) * (react.onset ?? 0);
  const pulse = beat + bar + onset;

  const alphaIn = m.fade === false ? 1 : a;
  const fadeOut = m.out ? clamp01((tv - t0 - (m.outAt ?? 0.8) * dur) / (dur * 0.2)) : 0;

  return {
    offX, offY, travX, travY, spin, bob, sink, pulse,
    alpha: clamp01(alphaIn * (1 - fadeOut)),
    scale: (m.scale ?? 1) * (1 + pulse) * (1 - sink * (m.sinkScale ?? 0.25)),
  };
}

// ---------------------------------------------------------------------------
// drawing verbs

function drawRect(g, p, el, fr, mo) {
  const fill = paint(p, el.fill, 'raised');
  const stroke = paint(p, el.stroke, null);
  const r = (el.radius ?? 0.02) * Math.min(fr.w, fr.h);
  g.beginPath();
  if (r > 0.5 && g.roundRect) g.roundRect(-fr.w / 2, -fr.h / 2, fr.w, fr.h, r);
  else g.rect(-fr.w / 2, -fr.h / 2, fr.w, fr.h);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = el.lw ?? 3; g.stroke(); }
}

function drawEllipse(g, p, el, fr) {
  const fill = paint(p, el.fill, 'raised');
  const stroke = paint(p, el.stroke, null);
  g.beginPath();
  g.ellipse(0, 0, Math.abs(fr.w) / 2, Math.abs(fr.h) / 2, 0, 0, Math.PI * 2);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = el.lw ?? 3; g.stroke(); }
}

function drawLine(g, p, el, fr) {
  const stroke = paint(p, el.stroke, 'line');
  // `from`/`to` are fractions of the element box: [-0.5, 0] is its left edge
  const a = el.from ?? [-0.5, 0];
  const b = el.to ?? [0.5, 0];
  g.beginPath();
  g.moveTo(a[0] * fr.w, a[1] * fr.h);
  g.lineTo(b[0] * fr.w, b[1] * fr.h);
  g.strokeStyle = stroke;
  g.lineWidth = el.lw ?? 3;
  g.stroke();
}

function drawPoly(g, p, el, fr) {
  const pts = el.points ?? [];
  if (pts.length < 2) return;
  const fill = paint(p, el.fill, null);
  const stroke = paint(p, el.stroke, fill ? null : 'line');
  g.beginPath();
  pts.forEach(([x, y], i) => {
    const px = x * fr.w, py = y * fr.h;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  });
  if (el.close !== false) g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = el.lw ?? 3; g.stroke(); }
}

function drawArc(g, p, el, fr) {
  const stroke = paint(p, el.stroke, 'line');
  const r = Math.min(Math.abs(fr.w), Math.abs(fr.h)) / 2;
  const a0 = el.start ?? 0;
  const a1 = el.end ?? Math.PI;
  g.beginPath();
  g.arc(0, 0, r, a0, a1);
  g.strokeStyle = stroke;
  g.lineWidth = el.lw ?? 3;
  g.lineCap = 'round';
  g.stroke();
}

function drawText(g, p, el, fr) {
  const size = el.size ?? 64;           // text always uses pixels
  const weight = el.weight ?? 800;
  const family = el.font === 'mono' ? 'ui-monospace, monospace'
    : el.font === 'sans' ? 'system-ui, sans-serif'
      : '"Impact","Arial Black",system-ui,sans-serif';
  g.font = `${weight} ${size}px ${family}`;
  g.textAlign = el.align ?? 'center';
  g.textBaseline = 'middle';
  g.fillStyle = paint(p, el.fill, 'text');
  const lines = String(el.text ?? '').split('\n');
  lines.forEach((L, i) => g.fillText(L, 0, (i - (lines.length - 1) / 2) * size * 1.22));
}

function drawDots(g, p, el, fr, tv) {
  const n = el.n ?? 40;
  const mode = el.mode ?? 'drift';
  const fill = paint(p, el.fill, 'accentHot');
  const dot = el.dot ?? 4;              // dot radius in px, not the spread
  const spreadX = fr.w, spreadY = fr.h;
  const speed = el.speed ?? 1;
  for (let i = 0; i < n; i++) {
    // deterministic per-index jitter: the same frame every render
    const r1 = ((i * 9301 + 49297) % 233280) / 233280;
    const r2 = ((i * 4801 + 9973) % 233280) / 233280;
    let x = (r1 - 0.5) * spreadX;
    let y = (r2 - 0.5) * spreadY;
    if (mode === 'fall') y = ((r2 * spreadY + tv * 60 * speed) % spreadY) - spreadY / 2;
    else if (mode === 'rise') y = spreadY / 2 - ((r2 * spreadY + tv * 50 * speed) % spreadY);
    else { x += Math.sin(tv * 0.6 + i) * 12; y += Math.cos(tv * 0.45 + i * 1.7) * 10; }
    const r = dot * (0.6 + 0.8 * r1);
    g.beginPath();
    g.ellipse(x, y, r, r, 0, 0, Math.PI * 2);
    g.fillStyle = fill;
    g.fill();
  }
}

function drawBand(g, p, el, fr) {
  // a horizontal or vertical gradient wash: light, fog, water surface
  const horiz = el.axis !== 'y';
  const g0 = horiz
    ? g.createLinearGradient(0, -fr.h / 2, 0, fr.h / 2)
    : g.createLinearGradient(-fr.w / 2, 0, fr.w / 2, 0);
  const c = paint(p, el.fill, 'raised');
  g0.addColorStop(0, hexA(c, 0));
  g0.addColorStop(0.5, hexA(c, el.alpha ?? 0.5));
  g0.addColorStop(1, hexA(c, 0));
  g.fillStyle = g0;
  g.fillRect(-fr.w / 2, -fr.h / 2, fr.w, fr.h);
}

function drawBlob(g, p, el, fr) {
  const c = paint(p, el.fill, 'accentDim');
  const lobes = el.lobes ?? 5;
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * Math.PI * 2;
    const rr = Math.min(fr.w, fr.h) * (0.3 + 0.12 * ((i * 37) % 7) / 7);
    const cx = Math.cos(a) * fr.w * 0.18;
    const cy = Math.sin(a) * fr.h * 0.18;
    const rad = g.createRadialGradient(cx, cy, 0, cx, cy, rr);
    rad.addColorStop(0, hexA(c, el.alpha ?? 0.16));
    rad.addColorStop(1, hexA(c, 0));
    g.fillStyle = rad;
    g.beginPath();
    g.arc(cx, cy, rr, 0, Math.PI * 2);
    g.fill();
  }
}

function drawGrid(g, p, el, fr) {
  const cols = el.cols ?? 6, rows = el.rows ?? 4;
  g.strokeStyle = paint(p, el.stroke, 'line');
  g.lineWidth = el.lw ?? 1;
  for (let c = 0; c <= cols; c++) {
    const x = -fr.w / 2 + (fr.w * c) / cols;
    g.beginPath(); g.moveTo(x, -fr.h / 2); g.lineTo(x, fr.h / 2); g.stroke();
  }
  for (let r = 0; r <= rows; r++) {
    const y = -fr.h / 2 + (fr.h * r) / rows;
    g.beginPath(); g.moveTo(-fr.w / 2, y); g.lineTo(fr.w / 2, y); g.stroke();
  }
}

const DRAW = {
  rect: drawRect, ellipse: drawEllipse, line: drawLine, poly: drawPoly,
  arc: drawArc, text: drawText, dots: drawDots, band: drawBand, blob: drawBlob, grid: drawGrid,
};

// ---------------------------------------------------------------------------
// the layer

/** Draw a back-to-front list of elements. `tv` is the song time. */
export function drawElements(g, p, elements, tv, f, opts = {}) {
  const W = opts.width ?? 1920;
  const H = opts.height ?? 1080;
  const start = opts.start ?? 0;
  const cam = opts.cam ?? null;

  if (!Array.isArray(elements)) {
    throw new TypeError('elements must be an array of element objects');
  }

  for (const el of elements) {
    const kind = el.kind;
    const fn = DRAW[kind];
    if (!fn) {
      throw new Error(
        `unknown element kind "${kind}" — use one of ${ELEMENT_KINDS.join(', ')}`,
      );
    }
    const depth = el.depth ?? 0.5;
    const par = cam ? cam.depth(depth) : { x: 0, y: 0 };
    const fr = frameOf(el, W, H);
    const mo = motionAt(el, tv, start, f);

    g.save();
    g.globalAlpha = clamp01((el.alpha ?? 1) * mo.alpha);
    g.translate(
      fr.x + (mo.offX + mo.travX) * W + par.x,
      fr.y + (mo.offY + mo.travY) * H + par.y + mo.bob + mo.sink * 60,
    );
    g.rotate((el.rotate ?? 0) + mo.spin);
    if (mo.scale !== 1) g.scale(mo.scale, mo.scale);
    if (el.blend) g.globalCompositeOperation = el.blend;
    fn(g, p, el, fr, tv, f);
    g.restore();
  }
}

/** Validate a layer before rendering: fail with the path, not with a blank frame. */
export function validateElements(elements, where = 'elements') {
  const errors = [];
  if (!Array.isArray(elements)) return [`${where}: expected an array`];
  elements.forEach((el, i) => {
    const at = `${where}[${i}]`;
    if (!el || typeof el !== 'object') { errors.push(`${at}: not an object`); return; }
    if (!ELEMENT_KINDS.includes(el.kind)) {
      errors.push(`${at}.kind: "${el.kind}" is not one of ${ELEMENT_KINDS.join(', ')}`);
    }
    for (const key of ['fill', 'stroke']) {
      const v = el[key];
      if (v && v !== 'none' && !ROLES.includes(v) && !/^#|^rgb|^hsl/.test(v)) {
        errors.push(`${at}.${key}: "${v}" is not a palette role (${ROLES.join(', ')}) or a colour`);
      }
    }
    if (el.at && (!Array.isArray(el.at) || el.at.length !== 2)) {
      errors.push(`${at}.at: expected [x, y]`);
    }
    if (el.kind === 'text' && typeof el.text !== 'string') {
      errors.push(`${at}.text: expected a string`);
    }
    if (el.kind === 'poly' && (!Array.isArray(el.points) || el.points.length < 2)) {
      errors.push(`${at}.points: expected at least two [x, y] pairs`);
    }
  });
  return errors;
}
