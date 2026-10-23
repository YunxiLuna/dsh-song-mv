#!/usr/bin/env node
// song-mv check-frame — is the picture a picture?
//
// check-imagery reads the JSON and asks whether the shot is *built* (enough
// elements, three planes, a horizon, labels, events). check-motion renders and
// asks whether it *moves*. This one renders and asks whether what it drew fills
// the frame, reads at a glance, and can be seen.
//
//   node tools/check-frame.mjs --storyboard s.json --features f.json [--audio a.wav]
//
// Every finding comes with the number that failed and a field to change, because
// an agent can act on "subject is 8% of the frame → raise size" but not on
// "looks empty".
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from 'canvas';
import { createEngine, pal } from '../engine/core.mjs';
import { loadUserScenes } from './lib/scenes.mjs';
import { validateElements } from '../engine/elements.mjs';

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) out[a.slice(2)] = argv[++i] ?? true;
    else out._.push(a);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.storyboard || !args.features) {
  console.error('usage: node tools/check-frame.mjs --storyboard s.json --features f.json [--audio a.wav]');
  process.exit(1);
}

// thresholds — the composition rules from docs/imagery.md, made numeric
const T = {
  subjectMin: 0.15, subjectMax: 0.68,   // union box of solid subjects / frame
  tonesMin: 3, tonesMax: 18,            // distinct colour masses in the frame
  p10Min: 18, spreadMin: 40,            // luma floor and dynamic range
  cellsMin: 5,                          // 3x3 cells with content
  textContrast: 38,                     // text luma vs plate luma
};

const sbPath = path.resolve(args.storyboard);
const sb = JSON.parse(fs.readFileSync(sbPath, 'utf8'));
const feats = JSON.parse(fs.readFileSync(args.features, 'utf8'));
await loadUserScenes(sb, sbPath);

const cfg = {
  render: {
    width: sb.render?.width ?? 1920,
    height: sb.render?.height ?? 1080,
    fps: sb.render?.fps ?? 30,
  },
  post: { scan: 0.02 },
  safety: { maxFlash: 0.7 },
};
const engine = createEngine({ cfg, features: feats, storyboard: sb, lrc: null });
const W = cfg.render.width;
const H = cfg.render.height;

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const SCRATCH = createCanvas(960, 540);
const SG = SCRATCH.getContext('2d');

function analyse(canvas) {
  // Downsample first: the questions are about the picture, not about pixels, and
  // a 480x270 scratch surface makes this ~60x cheaper than reading the frame.
  SG.drawImage(canvas, 0, 0, 960, 540);
  const d = SG.getImageData(0, 0, 960, 540).data;
  const w = 960, h = 540;
  const hist = new Array(32).fill(0);
  const buckets = new Map();
  let n = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4;
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      const L = lum(r, gg, b);
      hist[Math.min(31, Math.floor(L / 8))] += 1;
      n++;
      const key = `${r >> 4},${gg >> 4},${b >> 4}`;
      const cur = buckets.get(key);
      if (cur) { cur.n++; cur.r += r; cur.g += gg; cur.b += b; }
      else buckets.set(key, { n: 1, r, g: gg, b });
    }
  }
  let top = null;
  for (const v of buckets.values()) if (!top || v.n > top.n) top = v;

  // How many colour masses hold real area? Flat art is made of a handful of
  // shapes; a frame with two masses is an empty frame, whatever its edges do.
  let tones = 0;
  for (const v of buckets.values()) if (v.n / n >= 0.015) tones++;

  const total = hist.reduce((a, b2) => a + b2, 0);
  const pct = (q) => {
    let acc = 0;
    for (let i = 0; i < hist.length; i++) {
      acc += hist[i];
      if (acc / total >= q) return i * 8 + 4;
    }
    return 255;
  };
  return { p10: pct(0.1), p50: pct(0.5), p90: pct(0.9), tones };
}

/** Union box of elements that read as subjects (not texture, not labels). */
const SUBJECT_KINDS = new Set(['rect', 'ellipse', 'poly', 'figure', 'arc']);
function subjectBox(els) {
  const DECOR = new Set(['band', 'blob', 'dots', 'grid', 'line', 'text']);
  let x0 = 1, y0 = 1, x1 = 0, y1 = 0, any = false;
  for (const el of els ?? []) {
    if (DECOR.has(el.kind)) continue;
    if (!SUBJECT_KINDS.has(el.kind)) continue;
    if ((el.depth ?? 0.5) < 0.4) continue;
    if ((el.alpha ?? 1) < 0.3) continue;
    if ((el.depth ?? 0.5) >= 0.95) continue;   // foreground silhouettes frame the shot
    // a full-bleed rectangle is a ground or a foreground wash, not a subject
    const szw = Array.isArray(el.size) ? el.size[0] : 0;
    if (szw >= 0.9) continue;
    const [ax, ay] = el.at ?? [0.5, 0.5];
    const sz = el.size ?? [0.2, 0.2];
    // text uses a pixel font size, everything else a [w, h] pair of fractions
    const sw = Array.isArray(sz) ? sz[0] : (el.kind === 'text' ? sz / 900 : 0.2);
    const shh = Array.isArray(sz) ? sz[1] : (el.kind === 'text' ? sz / 1400 : 0.2);
    const w = el.round ? sw * (W / H) : sw;
    const h = el.round ? sw : shh;
    // text boxes are small on purpose: skip plates, they are not the subject
    x0 = Math.min(x0, ax - w / 2); y0 = Math.min(y0, ay - h / 2);
    x1 = Math.max(x1, ax + w / 2); y1 = Math.max(y1, ay + h / 2);
    any = true;
  }
  return any ? { x0, y0, x1, y1, area: Math.max(0, x1 - x0) * Math.max(0, y1 - y0) } : null;
}

function cellCoverage(els) {
  const cells = new Set();
  for (const el of els ?? []) {
    const [ax, ay] = el.at ?? [0.5, 0.5];
    const sz2 = el.size;
    const sw = Array.isArray(sz2) ? sz2[0] : 0.1;
    const sh = Array.isArray(sz2) ? sz2[1] : 0.1;
    const cx = Math.min(2, Math.max(0, Math.floor(ax * 3)));
    const cy = Math.min(2, Math.max(0, Math.floor(ay * 3)));
    cells.add(`${cx},${cy}`);
    if (sw > 0.34) cells.add(`${Math.min(2, cx + 1)},${cy}`);
    if (sh > 0.34) cells.add(`${cx},${Math.min(2, cy + 1)}`);
  }
  return cells.size;
}

function textContrast(els, pal) {
  const l = (hex) => {
    if (!hex || !hex.startsWith('#') || hex.length < 7) return null;
    return lum(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
  };
  let worst = 999;
  for (const el of els ?? []) {
    if (el.kind !== 'text') continue;
    const fg = l(pal[el.fill ?? 'text']);
    const bgc = l(pal[el.plate ?? 'bg']);
    if (fg == null || bgc == null) continue;
    worst = Math.min(worst, Math.abs(fg - bgc));
  }
  return worst === 999 ? null : worst;
}

const rows = [];
let failed = 0;
const times = [0.3, 0.6, 0.9];

for (const [i, shot] of (sb.shots ?? []).entries()) {
  const id = shot.id ?? `shot${i + 1}`;
  const els = shot.scene?.params?.elements;
  const dur = (shot.end ?? 0) - (shot.start ?? 0);
  const problems = [];

  const errs = els ? validateElements(els, `${id}.elements`) : [];
  if (errs.length) problems.push(`${errs.length} invalid element(s)`);

  let tones = 0, p10 = 255, spread = 0, cells = 0;
  for (const k of times) {
    const t = (shot.start ?? 0) + dur * k;
    if (process.env.MV_DEBUG) console.error('  frame', id, t.toFixed(1));
    const canvas = engine.renderFrame(t);
    const a = analyse(canvas);
    if (process.env.MV_DEBUG) console.error('    analysed', JSON.stringify(a));
    tones = Math.max(tones, a.tones);
    p10 = Math.min(p10, a.p10);
    spread = Math.max(spread, a.p90 - a.p10);
  }
  const box = subjectBox(els);
  const area = box?.area ?? 0;
  cells = cellCoverage(els);


  if (box && area < T.subjectMin) problems.push(`subject ${(area * 100).toFixed(0)}% of frame (want ≥ ${T.subjectMin * 100}%) → raise size / lower cameraAmount`);
  if (box && area > T.subjectMax) problems.push(`subject ${(area * 100).toFixed(0)}% (want ≤ ${T.subjectMax * 100}%) → the prop is eating the frame`);
  if (tones < T.tonesMin) problems.push(`only ${(ink * 100).toFixed(0)}% of pixels differ from the background → the frame is empty`);
  if (tones > T.tonesMax) problems.push(`${tones} colour masses → the frame is noise; cut a layer or unify the palette`);
  if (p10 < T.p10Min) problems.push(`shadows at ${p10.toFixed(0)} luma (want ≥ ${T.p10Min}) → raise the dawn palette or the light`);
  if (spread < T.spreadMin) problems.push(`tonal range ${spread.toFixed(0)} (want ≥ ${T.spreadMin}) → add a strong light or a dark foreground`);
  if (cells < T.cellsMin) problems.push(`content in ${cells}/9 cells → spread elements across the frame`);
  const p2 = pal(shot.palette ?? 'still');
  const tc = textContrast(els, p2);
  if (tc != null && tc < T.textContrast) problems.push(`label contrast ${tc.toFixed(0)} (want ≥ ${T.textContrast}) → change fill or plate role`);

  if (problems.length) failed++;
  rows.push([id, `${(area * 100).toFixed(0)}%`, `${tones}`, `${p10.toFixed(0)}`, `${spread.toFixed(0)}`, `${cells}/9`,
    problems.length ? `← ${problems.join('; ')}` : 'ok']);
}

const w = [18, 6, 6, 6, 6, 6];
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('shot', w[0]) + pad('subj', w[1]) + pad('tones', w[2]) + pad('p10', w[3]) + pad('range', w[4]) + pad('grid', w[5]) + 'verdict');
console.log('-'.repeat(112));
for (const r of rows) console.log(pad(r[0], w[0]) + pad(r[1], w[1]) + pad(r[2], w[2]) + pad(r[3], w[3]) + pad(r[4], w[4]) + pad(r[5], w[5]) + r[6]);
console.log('-'.repeat(112));

if (failed) {
  console.log(`${failed} shot(s) do not hold up as a picture. Rules: docs/imagery.md`);
  process.exit(1);
}
console.log('every shot holds up as a picture.');
