// Advanced lyric treatments (kinetic type, stamped words, echo walls) drawn on node-canvas.
// Pure functions of t; no wall clock. Uses seeded PRNG only.
import { mulberry32 } from './prng.mjs';

function easeOut(k) { return 1 - Math.pow(1 - k, 3); }
function clamp01(x) { return Math.max(0, Math.min(1, x)); }

/**
 * Slam: each character of `str` smashes in one after another.
 * t0 = when the first character starts, step = seconds between characters.
 * g = 2D canvas context.
 */
export function slam(g, str, cx, cy, t, t0, opts = {}) {
  const { size = 120, weight = 900, font = "Inter, 'Arial Black', sans-serif", color = '#fff', hot = '#fff',
          step = 0.05, from = 2.2, settle = 0.12, alpha = 1 } = opts;
  g.font = `${weight} ${size}px ${font}`;
  const metrics = g.measureText(str);
  const x0 = cx - metrics.width / 2;
  let cursor = x0;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const ti = t0 + i * step;
    if (t >= ti && ch !== ' ') {
      const k = clamp01((t - ti) / settle);
      const sc = from + (1 - from) * easeOut(k);
      const col = k < 1 ? hot : color;
      const a = alpha * (0.35 + 0.65 * k);
      const wCh = g.measureText(ch).width;
      g.save();
      g.translate(cursor + wCh / 2, cy);
      g.scale(sc, sc);
      g.globalAlpha = a;
      g.fillStyle = col;
      g.font = `${weight} ${size}px ${font}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(ch, 0, 0);
      g.restore();
    }
    cursor += g.measureText(ch).width + size * 0.02;
  }
}

/**
 * Bounce: word enters from below with an elastic bounce. t0 = start, `dur` = settle time.
 */
export function bounce(g, str, cx, cy, t, t0, opts = {}) {
  const { size = 80, weight = 800, font = "Inter, sans-serif", color = '#fff', dur = 0.45 } = opts;
  const k = clamp01((t - t0) / dur);
  if (k <= 0) return;
  // Elastic ease-out: overshoot then settle
  const s = 4.0, p = 0.3;
  const ek = k === 1 ? 1 : Math.pow(2, -10 * k) * Math.sin((k - p / 4) * (2 * Math.PI) / p) * -1 + 1;
  const yy = cy + (1 - ek) * 200;
  g.save();
  g.globalAlpha = Math.min(1, k * 2);
  g.fillStyle = color;
  g.font = `${weight} ${size}px ${font}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(str, cx, yy);
  g.restore();
}

/**
 * Wall: repeated word as a texture layer. `rows` = number of rows, clip to the canvas.
 * rowAlpha(r) controls per-row fade.
 */
export function wall(g, str, t, opts = {}) {
  const { x = 0, y = 0, w = 1920, h = 1080, size = 80, lineH = 1.15, alpha = 0.25,
          color = '#555', font = "Inter, sans-serif", weight = 900, shiftSpeed = 40 } = opts;
  const rows = Math.ceil(h / (size * lineH)) + 1;
  g.save();
  // The font must be set *before* measuring, otherwise the row pitch is
  // computed from whatever font the previous helper happened to leave behind.
  g.font = `${weight} ${size}px ${font}`;
  const rowW = g.measureText(str + '  ').width || str.length * size * 0.6;
  g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = color;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  for (let r = 0; r < rows; r++) {
    const shift = (((t * shiftSpeed * (r % 2 === 0 ? 1 : -1)) + r * 37) % rowW + rowW) % rowW;
    const yy = y + (r + 0.86) * size * lineH;
    const reps = Math.ceil(w / rowW) + 2;
    g.globalAlpha = alpha * (1 - r / (rows + 2));
    for (let k = -1; k < reps; k++) g.fillText(str, x + k * rowW + shift, yy);
  }
  g.restore();
}

/**
 * Sliced: word drawn in horizontal slices, each offset sideways.
 * n = number of slices, offset(i) px shift per slice index.
 */
export function sliced(g, str, cx, cy, t, t0, opts = {}) {
  const { size = 140, weight = 900, font = "Inter, sans-serif", color = '#fff',
          n = 12, dur = 0.6, spread = 60 } = opts;
  const k = clamp01((t - t0) / dur);
  if (k <= 0) return;
  g.save();
  g.globalAlpha = Math.min(1, k * 1.5);
  g.fillStyle = color;
  g.font = `${weight} ${size}px ${font}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const rowH = size * 1.3;
  const totalH = rowH * n;
  const top = cy - totalH / 2;
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const off = Math.sin(t * 3 + i * 0.7) * spread * (1 - k);
    const y0 = top + i * rowH;
    g.save();
    g.beginPath(); g.rect(cx - 1200, y0, 2400, rowH + 0.5); g.clip();
    g.translate(off, 0);
    g.fillText(str, cx, y0 + rowH / 2);
    g.restore();
  }
  g.restore();
}

/**
 * OnPath: text along a circular path (for chorus hits).
 */
export function onPath(g, str, cx, cy, t, t0, opts = {}) {
  const { size = 48, weight = 700, font = "Inter, sans-serif", color = '#fff',
          radius = 280, startAngle = -Math.PI / 2, dur = 0.8, alpha = 1 } = opts;
  const k = clamp01((t - t0) / dur);
  if (k <= 0) return;
  const revealCount = Math.ceil(str.length * k);
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.font = `${weight} ${size}px ${font}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const per = (2 * Math.PI) / str.length;
  for (let i = 0; i < revealCount; i++) {
    const a = startAngle + i * per;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    g.save();
    g.translate(x, y);
    g.rotate(a + Math.PI / 2);
    g.fillText(str[i], 0, 0);
    g.restore();
  }
  g.restore();
}

/**
 * Decode/scramble: text appears as if decoding from random chars.
 */
export function decode(g, str, cx, cy, t, t0, opts = {}) {
  const { size = 64, weight = 700, font = "'JetBrains Mono', 'Consolas', monospace",
          color = '#888', hot = '#fff', dur = 0.9 } = opts;
  const k = clamp01((t - t0) / dur);
  if (k <= 0) return;
  const G = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/<>[]%$&@!';
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const reveal = clamp01((k - i / str.length) * str.length * 2);
    const done = str[i] === ' ' || reveal >= 1;
    if (done) out += str[i];
    else {
      // Deterministic pseudo-random char based on (i, frame bucket)
      const bucket = Math.floor(t * 20);
      let h = (i * 31 + bucket * 7919) & 0xffff;
      h = (h ^ (h >>> 13)) * 0x5bd1e995;
      h = (h ^ (h >>> 15)) & 0xffff;
      out += G[h % G.length];
    }
  }
  g.save();
  g.fillStyle = hot;
  g.font = `${weight} ${size}px ${font}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(out, cx, cy);
  g.restore();
}

/**
 * Particle burst: small glowing particles radiate from a point when `t` crosses `t0`.
 * Deterministic (seeded by t0 hash).
 */
export function burst(g, cx, cy, t, t0, opts = {}) {
  const { n = 24, speed = 400, life = 0.8, color = '#ff5e9a', size = 4, fade = true } = opts;
  const age = t - t0;
  if (age < 0 || age > life) return;
  const k = age / life;
  // Seed a stable PRNG from t0
  const seed = Math.floor(t0 * 1000);
  const prng = mulberry32(seed);
  g.save();
  for (let i = 0; i < n; i++) {
    const a = prng() * Math.PI * 2;
    const v = (0.5 + prng() * 0.5) * speed;
    const x = cx + Math.cos(a) * v * age;
    const y = cy + Math.sin(a) * v * age;
    const r = size * (1 - k);
    const alpha = fade ? 1 - k : 1;
    g.globalAlpha = alpha * 0.8;
    g.fillStyle = color;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    // Glow
    g.globalAlpha = alpha * 0.3;
    g.beginPath(); g.arc(x, y, r * 3, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

/**
 * Per-word karaoke highlight: color words progressively.
 * Words = space-split. `t0` = when the line starts; `dur` = line total time;
 * Each word gets highlighted as its window passes.
 */
export function karaoke(g, str, cx, cy, t, t0, opts = {}) {
  const { size = 72, weight = 700, font = "Inter, sans-serif",
          litColor = '#ffd038', dimColor = '#555', dur = 3.0 } = opts;
  const words = str.split(' ');
  const perWord = dur / words.length;
  g.save();
  g.font = `${weight} ${size}px ${font}`;
  // Measure total width
  let totalW = 0;
  const ws = words.map(w => { const m = g.measureText(w).width; totalW += m + size * 0.3; return m; });
  totalW -= size * 0.3;
  let x = cx - totalW / 2;
  g.textBaseline = 'middle';
  words.forEach((w, i) => {
    const wi = t - t0;
    const wordT = i * perWord;
    const k = clamp01((wi - wordT) / (perWord * 0.8));
    g.textAlign = 'left';
    g.fillStyle = k > 0.5 ? litColor : dimColor;
    g.globalAlpha = 0.4 + 0.6 * k;
    g.fillText(w, x, cy);
    x += ws[i] + size * 0.3;
  });
  g.restore();
}
