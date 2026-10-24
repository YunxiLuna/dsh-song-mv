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
  meanFloor: 24, meanFloorNight: 18,    // nothing on screen below this
  litMin: 0.25,                         // share of pixels above 24
  darkMean: 30, darkFilmMax: 0.6,       // a shot under 30 counts as a dark shot
  brightMean: 55,                       // and this is what counts as daylight
  textContrast: 38,                     // text luma vs plate luma
};

const sbPath = path.resolve(args.storyboard);
const sb = JSON.parse(fs.readFileSync(sbPath, 'utf8'));
const feats = JSON.parse(fs.readFileSync(args.features, 'utf8'));
await loadUserScenes(sb, sbPath);

// Measure the picture the way it ships: the engine's post is storyboard-driven
// (render.mjs passes sb.post / sb.look, see engine/core.mjs renderFrame), so the
// check has to use the same post or it evaluates a different picture than the
// one that gets encoded.
const cfg = {
  render: {
    width: sb.render?.width ?? 1920,
    height: sb.render?.height ?? 1080,
    fps: sb.render?.fps ?? 30,
  },
  post: sb.post ?? { scan: 0.02 },
  safety: sb.safety ?? { maxFlash: 0.7 },
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
  for (const v of buckets.values()) if (v.n / n >= 0.025) tones++;

  const total = hist.reduce((a, b2) => a + b2, 0);
  const pct = (q) => {
    let acc = 0;
    for (let i = 0; i < hist.length; i++) {
      acc += hist[i];
      if (acc / total >= q) return i * 8 + 4;
    }
    return 255;
  };
  // mean luma and the share of the frame above 24: a film can be night-time
  // and still be photographed, but it cannot be 8% grey edge to edge
  let lsum = 0;
  for (let i = 0; i < hist.length; i++) lsum += hist[i] * (i * 8 + 4);
  const mean = lsum / total;
  let litPx = 0;
  for (let i = 3; i < hist.length; i++) litPx += hist[i];
  return { p10: pct(0.1), p50: pct(0.5), p90: pct(0.9), mean, lit: litPx / total, tones };
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
let darkShots = 0;
let brightShots = 0;
let litShots = 0;
const times = [0.3, 0.6, 0.9];

for (const [i, shot] of (sb.shots ?? []).entries()) {
  const id = shot.id ?? `shot${i + 1}`;
  const els = shot.scene?.params?.elements;
  const dur = (shot.end ?? 0) - (shot.start ?? 0);
  const problems = [];

  const errs = els ? validateElements(els, `${id}.elements`) : [];
  if (errs.length) problems.push(`${errs.length} invalid element(s)`);

  let tones = 0, p10 = 255, spread = 0, cells = 0, mean = 0, lit = 0;
  for (const k of times) {
    const t = (shot.start ?? 0) + dur * k;
    if (process.env.MV_DEBUG) console.error('  frame', id, t.toFixed(1));
    const canvas = engine.renderFrame(t);
    const a = analyse(canvas);
    if (process.env.MV_DEBUG) console.error('    analysed', JSON.stringify(a));
    tones = Math.max(tones, a.tones);
    p10 = Math.min(p10, a.p10);
    spread = Math.max(spread, a.p90 - a.p10);
    mean = Math.max(mean, a.mean);
    lit = Math.max(lit, a.lit);
  }
  // A type card is a page: one flat ground plus type. Asking it for a wide
  // tonal range or nine occupied cells is asking it to stop being a page.
  const page = shot?.scene?.type === 'typeOnly';
  // Element-based rules apply only to shots that are built from elements:
  // a `field` shot is composed from primitives, so 'subject coverage' would
  // be invented. This is the false-positive class that made the gates
  // untrustworthy.
  const hasEls = Array.isArray(els) && els.length > 0;
  const box = hasEls ? subjectBox(els) : null;
  const area = box?.area ?? 0;
  cells = cellCoverage(els);


  if (hasEls && box && !page && area < T.subjectMin) problems.push(`subject ${(area * 100).toFixed(0)}% of frame (want ≥ ${T.subjectMin * 100}%) → raise size / lower cameraAmount`);
  if (hasEls && box && area > T.subjectMax) problems.push(`subject ${(area * 100).toFixed(0)}% (want ≤ ${T.subjectMax * 100}%) → the prop is eating the frame`);
  if (tones < T.tonesMin) problems.push(`only ${tones} colour masses → the frame is too empty → add a texture layer or a second plane`);
  if (tones > T.tonesMax) problems.push(`${tones} colour masses → the frame is noise; cut a layer or unify the palette`);
  // A dawn or night shot is supposed to crush its shadows: hold those to a
  // far lower floor instead of asking every frame for the same exposure.
  // Same idea for tonal spread: the rain / mono looks author their palettes
  // midtone-compressed by design (docs/looks.md), so the ≥40 range target is
  // an exposure requirement, not a hard ceiling — honour shot.night the same
  // way the p10 floor already does.
  const night = shot?.palette === 'dawn' || shot?.palette === 'fade' || shot?.night === true;
  const floor = night ? 3 : T.p10Min;
  if (p10 < floor) problems.push(`shadows at ${p10.toFixed(0)} luma (want ≥ ${floor}) → raise the dawn palette or the light`);
  if (!night && !page && spread < T.spreadMin) problems.push(`tonal range ${spread.toFixed(0)} (want ≥ ${T.spreadMin}) → add a strong light or a dark foreground`);
  // Exposure is not a taste question. A night look may sit low, but not this
  // low: at mean < 26 there is nothing on screen but texture.
  const meanFloor = night ? T.meanFloorNight : T.meanFloor;
  if (mean < meanFloor) {
    problems.push(`mean luma ${mean.toFixed(0)} (want ≥ ${meanFloor}) → raise post.levels.gamma / black, or lighten the palette`);
  }
  if (lit < T.litMin) problems.push(`only ${(lit * 100).toFixed(0)}% of pixels above 24 luma → the frame is a texture, not a picture`);
  // The 9-cell grid asks elements to spread across the frame; it only applies
  // to the elements lane (a shot with an `elements` array). Field and typeOnly
  // shots compose the picture from textures and lyrics, not elements.
  if (hasEls && !page && cells < T.cellsMin) problems.push(`content in ${cells}/9 cells → spread elements across the frame`);
  if (mean < T.darkMean) darkShots++;
  if (mean >= T.brightMean) brightShots++;
  if (mean >= 26) litShots++;
  const p2 = pal(shot.palette ?? 'still');
  const tc = textContrast(els, p2);
  if (tc != null && tc < T.textContrast) problems.push(`label contrast ${tc.toFixed(0)} (want ≥ ${T.textContrast}) → change fill or plate role`);

  if (problems.length) failed++;
  rows.push([id, `${(area * 100).toFixed(0)}%`, `${tones}`, `${p10.toFixed(0)}`, `${spread.toFixed(0)}`, `${cells}/9`, `${mean.toFixed(0)}`,
    problems.length ? `← ${problems.join('; ')}` : 'ok']);
}

const w = [18, 6, 6, 6, 6, 6, 6, 6];
const pad = (s, n) => String(s).padEnd(n);
console.log(pad('shot', w[0]) + pad('subj', w[1]) + pad('tones', w[2]) + pad('p10', w[3]) + pad('mean', w[6]) + pad('range', w[4]) + pad('grid', w[5]) + 'verdict');
console.log('-'.repeat(112));
for (const r of rows) console.log(pad(r[0], w[0]) + pad(r[1], w[1]) + pad(r[2], w[2]) + pad(r[3], w[3]) + pad(r[6], w[6]) + pad(r[4], w[4]) + pad(r[5], w[5]) + r[7]);
console.log('-'.repeat(112));

// Film-level tone: a mood is allowed, an unbroken murk is not. The rule is
// about contrast between sections, not about overall brightness — a rain film
// can be sombre as long as some of it is lit.
const n = rows.length;
const darkShare = n ? darkShots / n : 0;
const brightShare = n ? brightShots / n : 0;
const allowDark = !!(sb.post && sb.post.allowDark);
if (n >= 4 && darkShare > T.darkFilmMax) {
  const msg = `${(darkShare * 100).toFixed(0)}% of the shots sit under mean luma ${T.darkMean}`
    + ` (max ${(T.darkFilmMax * 100).toFixed(0)}%) → the film is dark from the first shot to the last.`
    + ` Give some section a lit mood, or set post.allowDark if the whole song really is night.`;
  console.log(`\n${msg}`);
  if (!allowDark) failed++;
}
if (n >= 6 && brightShare === 0) {
  console.log(`\nno shot reaches mean luma ${T.brightMean}: every frame is murk.`
    + ` Raise post.levels.gamma / white, or lighten the look's palette ladder.`);
  if (!allowDark) failed++;
}
if (failed) {
  const shotsFlagged = rows.filter((r) => r[7] !== 'ok').length;
  console.log(`${shotsFlagged} shot(s) flagged, ${failed} finding(s) in all. Rules: docs/GUIDE.md`);
  process.exit(1);
}
console.log('every shot holds up as a picture.');
