#!/usr/bin/env node
// song-mv check-motion — is every shot actually moving?
//
// A frame is drawn, so "does this shot move" is measurable: render a handful of
// frames inside the shot, compare consecutive ones, and report how much changed.
// This is the gate that catches a beautiful still pretending to be a shot.
//
//   node tools/check-motion.mjs --storyboard s.json --features f.json
//   node tools/check-motion.mjs ... --shot 03_sink --frames 10 --min 1.2
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from 'canvas';
import { createEngine } from '../engine/core.mjs';
import { loadUserScenes } from './lib/scenes.mjs';

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => argv[++i];
    if (a === '--storyboard') out.storyboard = next();
    else if (a === '--features') out.features = next();
    else if (a === '--shot') out.shot = next();
    else if (a === '--frames') out.frames = Number(next());
    else if (a === '--min') out.min = Number(next());
    else if (a === '--width') out.width = Number(next());
    else if (a === '--quiet' || a === '-q') out.quiet = true;
    else out._.push(a);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.storyboard || !args.features) {
  console.error('usage: node tools/check-motion.mjs --storyboard s.json --features f.json [--shot id] [--frames 8] [--min 1.0]');
  process.exit(1);
}

const storyboardPath = path.resolve(args.storyboard);
const storyboard = JSON.parse(fs.readFileSync(storyboardPath, 'utf8'));
const features = JSON.parse(fs.readFileSync(args.features, 'utf8'));

await loadUserScenes(storyboard, storyboardPath);

const cfg = {
  render: { width: 960, height: 540, fps: 30 },
  post: storyboard.post || { scan: 0.03 },
  safety: storyboard.safety || { maxFlash: 0.7 },
  reactive: storyboard.reactive || { beatDecay: 6, onsetDecay: 9, strongOnset: 0.35 },
  text: storyboard.text || {},
};

let lrcPath = [];
if (storyboard.lyricsFile) {
  const rel = path.resolve(path.dirname(storyboardPath), storyboard.lyricsFile);
  const abs = path.resolve(storyboard.lyricsFile);
  lrcPath = fs.existsSync(rel) ? rel : (fs.existsSync(abs) ? abs : []);
}

const engine = createEngine({ cfg, features, storyboard, lrc: lrcPath });
const small = createCanvas(240, 135);
const sctx = small.getContext('2d');

function sample(t) {
  const c = engine.renderFrame(t);
  sctx.clearRect(0, 0, 240, 135);
  sctx.drawImage(c, 0, 0, 240, 135);
  return sctx.getImageData(0, 0, 240, 135).data;
}

/** Mean absolute difference (0..255) plus the centroid shift in pixels. */
function compare(a, b) {
  let sum = 0, ax = 0, ay = 0, bx = 0, by = 0, aw = 0, bw = 0;
  for (let i = 0, px = 0; i < a.length; i += 4, px++) {
    const va = (a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114);
    const vb = (b[i] * 0.299 + b[i + 1] * 0.587 + b[i + 2] * 0.114);
    sum += Math.abs(va - vb);
    const x = px % 240, y = (px / 240) | 0;
    const da = Math.max(0, 200 - va), db = Math.max(0, 200 - vb);
    ax += x * da; ay += y * da; aw += da;
    bx += x * db; by += y * db; bw += db;
  }
  const mean = sum / (a.length / 4);
  if (!aw || !bw) return { mean, shift: 0 };
  const dx = bx / bw - ax / aw, dy = by / bw - ay / aw;
  return { mean, shift: Math.sqrt(dx * dx + dy * dy) };
}

const frames = Math.max(3, args.frames || 8);
const minMean = args.min ?? 1.0;
const rows = [];
let worst = Infinity;

for (const shot of engine.shots) {
  if (args.shot && shot.id !== args.shot) continue;
  const a = shot.start + Math.min(0.35, (shot.end - shot.start) * 0.1);
  const b = shot.end - Math.min(0.2, (shot.end - shot.start) * 0.05);
  const times = [];
  for (let i = 0; i < frames; i++) times.push(a + ((b - a) * i) / (frames - 1));

  let prev = sample(times[0]);
  let total = 0, totalShift = 0, changed = 0;
  for (let i = 1; i < times.length; i++) {
    const cur = sample(times[i]);
    const { mean, shift } = compare(prev, cur);
    total += mean;
    totalShift += shift;
    if (mean > 0.35) changed++;
    prev = cur;
  }
  const avg = total / (times.length - 1);
  const avgShift = totalShift / (times.length - 1);
  // Line art on a flat paper background moves a lot but changes few pixels, so
  // the score blends pixel change with how far the dark mass travelled.
  const score = avg + 0.05 * avgShift;
  worst = Math.min(worst, score);
  rows.push({ id: shot.id, type: shot.type, dur: shot.end - shot.start, avg, avgShift, score, changed, n: times.length - 1 });
}

if (!rows.length) {
  console.error(`no shot matched ${args.shot ?? '(all)'}`);
  process.exit(2);
}

if (!args.quiet) {
  console.log('\nshot                     type        len   score   pixels  shift  frames');
  console.log('-------------------------------------------------------------------------');
  for (const r of rows) {
    const flag = r.score < minMean ? '  ← static' : r.score < minMean * 1.8 ? '  ← barely' : '';
    console.log(
      `${r.id.padEnd(24)} ${String(r.type).padEnd(11)} ${r.dur.toFixed(1).padStart(5)}s ` +
      `${r.score.toFixed(2).padStart(7)} ${r.avg.toFixed(2).padStart(8)} ${r.avgShift.toFixed(1).padStart(6)}  ${r.changed}/${r.n}${flag}`,
    );
  }
  console.log('');
  console.log(`threshold: score ≥ ${minMean.toFixed(2)} (pixel change + 0.05 × travel)`);
}

const bad = rows.filter((r) => r.score < minMean);
if (bad.length) {
  console.error(`${bad.length} shot(s) look static: ${bad.map((b) => b.id).join(', ')}`);
  console.error('give each one a camera move, a travelling motif, or an event (docs/motion.md)');
  process.exit(1);
}
if (!args.quiet) console.log('all shots move.');
