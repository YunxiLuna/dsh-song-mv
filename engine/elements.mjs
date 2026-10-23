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

// `shadow` is the one role whose meaning is absolute rather than relative to the
// world: it is always darker than the ground, in a light world and a dark one.

function shade(hex, k) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v) => {
    const out = k < 0 ? v * (1 + k) : v + (255 - v) * k;
    return Math.max(0, Math.min(255, Math.round(out)));
  };
  return `#${[f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const ROLES = ['bg', 'panel', 'raised', 'line', 'text', 'sub', 'mute', 'accent', 'accentHot', 'accentDim', 'shadow'];

const EASE = {
  linear: (k) => k,
  out: (k) => 1 - Math.pow(1 - k, 3),
  inOut: (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2),
  back: (k) => 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2),
};

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

export const ELEMENT_KINDS = ['rect', 'ellipse', 'line', 'poly', 'arc', 'text', 'dots', 'band', 'blob', 'grid', 'figure'];

// A keyframe track is how an element *acts* rather than jitters:
//
//   "keys": [
//     { "at": 0.0, "x": 0.5, "y": 0.62, "r": 0 },
//     { "at": 2.4, "x": 0.38, "y": 0.60, "r": -0.06, "ease": "inOut" },
//     { "at": 6.0, "x": 0.30, "y": 0.58, "r": -0.09 }
//   ]
//
// `at` is seconds into the shot; every other field is absolute (x and y are
// frame fractions). Missing fields fall back to the element's resting value, so
// a track can animate one property and leave the rest alone.
const KEY_FIELDS = ['x', 'y', 's', 'r', 'a'];

function keyAt(el, localT) {
  const keys = el.keys;
  if (!Array.isArray(keys) || keys.length === 0) return null;
  const k0 = keys[0];
  if (localT <= (k0.at ?? 0)) return k0;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (localT <= (b.at ?? 0)) {
      const span = Math.max(0.001, (b.at ?? 0) - (a.at ?? 0));
      const k = clamp01((localT - (a.at ?? 0)) / span);
      const e = (EASE[b.ease] ?? EASE.inOut)(k);
      const out = {};
      const resting = {
        x: el.at?.[0] ?? 0.5,
        y: el.at?.[1] ?? 0.5,
        s: el.scale ?? 1,
        r: el.rotate ?? 0,
        a: el.alpha ?? 1,
      };
      for (const f of KEY_FIELDS) {
        const va = a[f] ?? resting[f];
        const vb = b[f] ?? va;
        if (va == null) continue;
        out[f] = va + (vb - va) * e;
      }
      return out;
    }
  }
  return keys[keys.length - 1];
}

// ---------------------------------------------------------------------------
// colour

function paint(p, role, fallback) {
  const key = role ?? fallback;
  if (!key || key === 'none') return null;
  if (key === 'shadow') return shade(p.bg, -0.55);
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
  const w = fx(size[0]);
  let h = fy(size[1]);
  // `round: true` makes the box square in *pixels*, which is what a circle or a
  // clock face needs: a fraction of the frame is not a circle on a 16:9 canvas.
  if (el.round) h = w;
  return { x: fx(at[0]), y: fy(at[1]), w, h };
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

  let spin = (m.spin ?? 0) * (tv - t0);
  const bob = (m.bob ?? 0) * Math.sin((tv - t0) * (m.bobHz ?? 0.6) * Math.PI * 2);
  const sink = m.sink ? clamp01((tv - t0 - (m.sinkAt ?? 0.6) * dur) / (dur * 0.3)) : 0;

  const beat = (f.beatPulse ?? 0) * (react.beat ?? 0);
  const bar = (f.barPulse ?? 0) * (react.bar ?? 0);
  const onset = (f.onsetPulse ?? 0) * (react.onset ?? 0);
  const pulse = beat + bar + onset;

  let alphaIn = m.fade === false ? 1 : a;
  let scaleK = m.scale ?? 1;
  const fadeOut = m.out ? clamp01((tv - t0 - (m.outAt ?? 0.8) * dur) / (dur * 0.2)) : 0;

  const key = keyAt(el, tv - start);
  if (key) {
    // a track is authoritative for what it touches; pulses still ride on top
    if (key.a != null) alphaIn = key.a;
    if (key.r != null) spin = key.r;
    if (key.s != null) scaleK = key.s;
  }

  return {
    offX, offY, travX, travY, spin, bob, sink, pulse,
    keyX: key?.x ?? null,
    keyY: key?.y ?? null,
    alpha: clamp01(alphaIn * (1 - fadeOut)),
    scale: scaleK * (1 + pulse) * (1 - sink * (m.sinkScale ?? 0.25)),
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
  const track = el.track ?? 0;          // letter-spacing in px, for signage
  const family = el.font === 'mono' ? 'ui-monospace, monospace'
    : el.font === 'sans' ? 'system-ui, sans-serif'
      : '"Impact","Arial Black",system-ui,sans-serif';
  g.font = `${weight} ${size}px ${family}`;
  g.textAlign = el.align ?? 'center';
  g.textBaseline = 'middle';
  const lines = String(el.text ?? '').split('\n');
  const width = Math.max(...lines.map((L) => g.measureText(L).width + track * Math.max(0, L.length - 1)));
  const lh = size * (el.leading ?? 1.22);

  // A plate turns a string into a sign, a label or a card. Without one, text on
  // a busy frame is unreadable, which is why most frames should carry one.
  if (el.plate) {
    const padX = el.pad?.[0] ?? size * 0.7;
    const padY = el.pad?.[1] ?? size * 0.5;
    const w = width + padX * 2;
    const h = lh * lines.length + padY * 2;
    const r = el.radius ?? Math.min(14, size * 0.18);
    g.fillStyle = paint(p, el.plate, 'panel');
    g.beginPath();
    if (r > 0.5 && g.roundRect) g.roundRect(-w / 2, -h / 2, w, h, r);
    else g.rect(-w / 2, -h / 2, w, h);
    g.fill();
    if (el.plateStroke) {
      g.strokeStyle = paint(p, el.plateStroke, 'line');
      g.lineWidth = el.lw ?? 2;
      g.stroke();
    }
  }

  g.fillStyle = paint(p, el.fill, 'text');
  lines.forEach((L, i) => {
    const y = (i - (lines.length - 1) / 2) * lh;
    if (!track) { g.fillText(L, 0, y); return; }
    // manual tracking: canvas has no letterSpacing everywhere
    const chars = [...L];
    const total = g.measureText(L).width + track * Math.max(0, chars.length - 1);
    let x = g.textAlign === 'center' ? -total / 2 : g.textAlign === 'right' ? -total : 0;
    const prevAlign = g.textAlign;
    g.textAlign = 'left';
    for (const c of chars) {
      g.fillText(c, x, y);
      x += g.measureText(c).width + track;
    }
    g.textAlign = prevAlign;
  });
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

function drawFigure(g, p, el, fr, tv) {
  // A body, not a stick: head, shoulders, torso, two arms, two legs. Poses are
  // a handful of angles, so a person can stand, walk, sit, lean or reach, and
  // `keys` can move them across a shot.
  const pose = el.pose ?? 'stand';
  const H = Math.abs(fr.h) || 240;
  const W = Math.abs(fr.w) || H * 0.42;
  const fill = paint(p, el.fill, 'mute');
  const line = paint(p, el.stroke, null);
  const t = tv ?? 0;

  const headR = H * 0.085;
  const shoulderY = -H * 0.30;
  const hipY = H * 0.06;
  const lean = el.lean ?? 0;

  g.save();
  g.rotate(lean);

  // legs
  const legSwing = pose === 'walk' ? Math.sin(t * (el.stride ?? 3.1)) * H * 0.13 : 0;
  const spread = pose === 'sit' ? H * 0.02 : W * 0.16;
  g.strokeStyle = fill;
  g.lineCap = 'round';

  if (pose === 'sit') {
    g.lineWidth = H * 0.075;
    g.beginPath();
    g.moveTo(-spread, hipY); g.lineTo(-spread * 0.6, hipY + H * 0.26);
    g.lineTo(-spread * 0.4, hipY + H * 0.40);
    g.moveTo(spread, hipY); g.lineTo(spread * 0.6, hipY + H * 0.26);
    g.lineTo(spread * 0.4, hipY + H * 0.40);
    g.stroke();
  } else {
    g.lineWidth = H * 0.085;
    g.beginPath();
    g.moveTo(-spread, hipY); g.lineTo(-spread - legSwing * 0.5, H * 0.5);
    g.moveTo(spread, hipY); g.lineTo(spread + legSwing * 0.5, H * 0.5);
    g.stroke();
  }

  // torso
  g.lineWidth = H * 0.16;
  g.beginPath();
  g.moveTo(0, shoulderY + H * 0.02);
  g.lineTo(0, hipY);
  g.stroke();

  // arms
  const armSwing = pose === 'walk' ? -legSwing * 0.8 : 0;
  g.lineWidth = H * 0.055;
  g.beginPath();
  if (pose === 'reach') {
    g.moveTo(-W * 0.06, shoulderY + H * 0.05);
    g.lineTo(W * 0.30, shoulderY - H * 0.05);
    g.moveTo(W * 0.06, shoulderY + H * 0.05);
    g.lineTo(W * 0.26, shoulderY + H * 0.12);
  } else if (pose === 'sit') {
    g.moveTo(-W * 0.06, shoulderY + H * 0.05);
    g.lineTo(-W * 0.14, hipY + H * 0.02);
    g.moveTo(W * 0.06, shoulderY + H * 0.05);
    g.lineTo(W * 0.18, hipY - H * 0.02);
  } else {
    g.moveTo(-W * 0.05, shoulderY + H * 0.05);
    g.lineTo(-W * 0.09, hipY - H * 0.04 + armSwing);
    g.moveTo(W * 0.05, shoulderY + H * 0.05);
    g.lineTo(W * 0.09, hipY - H * 0.04 - armSwing);
  }
  g.stroke();

  // head + shoulders
  g.fillStyle = fill;
  g.beginPath();
  g.ellipse(0, shoulderY - headR * 1.15, headR, headR * 1.06, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(0, shoulderY + H * 0.02, W * 0.13, H * 0.035, 0, 0, Math.PI * 2);
  g.fill();

  if (line) {
    g.strokeStyle = line;
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(0, shoulderY - headR * 1.15, headR, headR * 1.06, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
}

const DRAW = {
  rect: drawRect, ellipse: drawEllipse, line: drawLine, poly: drawPoly,
  arc: drawArc, text: drawText, dots: drawDots, band: drawBand, blob: drawBlob, grid: drawGrid,
  figure: drawFigure,
};

// ---------------------------------------------------------------------------
// events
//
// Elements say what is in the frame. Events say what *happens* in it: a hit, a
// sweep of light, a burst of dust, a wipe that clears half the picture. They are
// timed relative to the shot start and can snap to beats.
//
//   "events": [
//     { "at": 1.2, "type": "shake", "amount": 10, "dur": 0.35 },
//     { "at": 2.0, "type": "flash", "role": "accentHot", "alpha": 0.4, "dur": 0.5 },
//     { "at": 3.4, "type": "ring", "at2": [0.5, 0.6], "r": 0.4, "dur": 1.2 }
//   ]
export const EVENT_TYPES = ['shake', 'flash', 'ring', 'wipe', 'burst', 'sweep', 'punch'];

function eventK(ev, localT) {
  const dur = ev.dur ?? 0.6;
  return clamp01((localT - (ev.at ?? 0)) / dur);
}

/** Deterministic pseudo-random in [0,1) — the same frame everywhere. */
const rnd = (i, salt = 0) => ((Math.sin(i * 127.1 + salt * 311.7) * 43758.5453) % 1 + 1) % 1;

/** Geometric events that move or tint everything: call before drawing the layers. */
export function eventsBegin(g, p, events, localT, W, H) {
  if (!Array.isArray(events)) return { dx: 0, dy: 0, scale: 1 };
  let dx = 0, dy = 0, scale = 1;
  for (const ev of events) {
    const k = eventK(ev, localT);
    if (k <= 0 || k >= 1) continue;
    if (ev.type === 'shake') {
      const a = (ev.amount ?? 10) * (1 - k);
      dx += Math.sin(k * 62) * a;
      dy += Math.cos(k * 47) * a * 0.6;
    } else if (ev.type === 'punch') {
      scale *= 1 + (ev.amount ?? 0.03) * (1 - k);
    }
  }
  if (dx || dy) g.translate(dx, dy);
  if (scale !== 1) {
    g.translate(W / 2, H / 2);
    g.scale(scale, scale);
    g.translate(-W / 2, -H / 2);
  }
  return { dx, dy, scale };
}

/** Tint/additive events: call after the layers, still inside the camera. */
export function eventsEnd(g, p, events, localT, W, H) {
  if (!Array.isArray(events)) return;
  for (const ev of events) {
    const k = eventK(ev, localT);
    if (k <= 0 || k >= 1) continue;
    const ease = EASE.out(k);
    const fade = 1 - ease;
    const tint = (role, a) => (ROLES.includes(role ?? '') ? p[role] : role ?? p.accentHot);

    if (ev.type === 'flash') {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = hexA(tint(ev.role, p.accentHot), (ev.alpha ?? 0.35) * fade);
      g.fillRect(0, 0, W, H);
      g.restore();
    } else if (ev.type === 'ring') {
      const [cx, cy] = ev.at2 ?? ev.pos ?? [0.5, 0.5];
      const r = (ev.r ?? 0.3) * W * ease;
      g.save();
      g.strokeStyle = hexA(tint(ev.role), (ev.alpha ?? 0.5) * fade);
      g.lineWidth = (ev.lw ?? 4) * (1 - ease * 0.6);
      g.beginPath();
      g.arc(cx * W, cy * H, r, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    } else if (ev.type === 'wipe') {
      const dir = ev.dir === 'down' ? 'down' : ev.dir === 'up' ? 'up' : 'right';
      const span = (dir === 'right' ? W : H) * (1 - ease);
      g.save();
      const grd = dir === 'right'
        ? g.createLinearGradient(span - 120, 0, span + 40, 0)
        : g.createLinearGradient(0, dir === 'down' ? span - 120 : 0, 0, dir === 'down' ? span + 40 : H);
      grd.addColorStop(0, hexA(tint(ev.role), 0));
      grd.addColorStop(0.7, hexA(tint(ev.role), (ev.alpha ?? 0.5) * fade));
      grd.addColorStop(1, hexA(tint(ev.role), 0));
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
      g.restore();
    } else if (ev.type === 'burst') {
      const [cx, cy] = ev.at2 ?? [0.5, 0.5];
      const n = ev.n ?? 26;
      g.save();
      g.fillStyle = hexA(tint(ev.role), (ev.alpha ?? 0.7) * fade);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd(i, 3) * 0.5;
        const d = ease * (ev.reach ?? 0.45) * W * (0.5 + rnd(i, 7));
        const rr = (ev.dot ?? 4) * (0.5 + rnd(i, 11)) * fade;
        g.beginPath();
        g.ellipse(cx * W + Math.cos(a) * d, cy * H + Math.sin(a) * d * 0.7, rr, rr, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    } else if (ev.type === 'sweep') {
      const x = (-0.3 + 1.6 * ease) * W;
      g.save();
      g.globalCompositeOperation = 'lighter';
      const grd = g.createLinearGradient(x - 260, 0, x + 260, H);
      grd.addColorStop(0, hexA(tint(ev.role), 0));
      grd.addColorStop(0.5, hexA(tint(ev.role), (ev.alpha ?? 0.22) * fade));
      grd.addColorStop(1, hexA(tint(ev.role), 0));
      g.fillStyle = grd;
      g.fillRect(0, 0, W, H);
      g.restore();
    }
  }
}

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

    // a keyframe track overrides the resting position; otherwise the element
    // sits at `at` and the enter/travel offsets apply on top
    const baseX = mo.keyX != null ? mo.keyX * W : fr.x + (mo.offX + mo.travX) * W;
    const baseY = mo.keyY != null ? mo.keyY * H : fr.y + (mo.offY + mo.travY) * H + mo.bob + mo.sink * 60;

    // A prop without a shadow floats. `shadow: true` (or `shadow: 0.3`) drops a
    // soft ellipse under the box; depth decides how far and how soft.
    const shadow = el.shadow === undefined ? false : el.shadow;
    if (shadow && ['rect', 'ellipse', 'figure', 'text', 'poly'].includes(kind)) {
      const k = typeof shadow === 'number' ? shadow : 0.22;
      const out = 0.35 + depth * 0.9;
      const sw = Math.abs(fr.h || fr.w) * (el.shadowW ?? 0.78);
      const sh = sw * 0.16;
      g.save();
      const grd = g.createRadialGradient(baseX + par.x, baseY + par.y + Math.abs(fr.h) * 0.48 + 6, 0,
                                         baseX + par.x, baseY + par.y + Math.abs(fr.h) * 0.48 + 6, sw * 0.62);
      grd.addColorStop(0, hexA(p.line, k * out));
      grd.addColorStop(1, hexA(p.line, 0));
      g.fillStyle = grd;
      g.beginPath();
      g.ellipse(baseX + par.x, baseY + par.y + Math.abs(fr.h) * 0.48 + 6, sw * 0.55, sh, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    g.save();
    g.globalAlpha = clamp01((el.alpha ?? 1) * mo.alpha);
    g.translate(baseX + par.x, baseY + par.y);
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
