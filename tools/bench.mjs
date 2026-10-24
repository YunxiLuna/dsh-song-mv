/**
 * Where does a frame go? Two modes.
 *
 *   node tools/bench.mjs --storyboard s.json --features f.json [--frames 3]
 *       the real film, per shot: where the minutes actually go
 *
 *   node tools/bench.mjs --features f.json
 *       synthetic shots, one per lane: the cost of a lane in isolation
 */
import fs from 'node:fs';
import path from 'node:path';
import { createEngine, parseLrc } from '../engine/core.mjs';

const arg = (n, d = null) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > 0 ? process.argv[i + 1] : d;
};

const featuresPath = arg('features');
const sbPath = arg('storyboard');
if (!featuresPath) {
  console.error('bench: --features <file.json> is required');
  process.exit(2);
}
const N = Number(arg('frames', 3));

function resolveFrom(base, p) {
  if (!p) return null;
  if (path.isAbsolute(p)) return p;
  const a = path.resolve(base, p);
  if (fs.existsSync(a)) return a;
  const b = path.resolve(process.cwd(), p);
  return fs.existsSync(b) ? b : a;
}

if (sbPath) {
  const sb = JSON.parse(fs.readFileSync(sbPath, 'utf8'));
  const base = path.dirname(path.resolve(sbPath));
  const feats = JSON.parse(fs.readFileSync(resolveFrom(base, featuresPath), 'utf8'));
  const lrcPath = sb.lyricsFile ? resolveFrom(base, sb.lyricsFile) : null;
  const lrc = lrcPath && fs.existsSync(lrcPath) ? parseLrc(lrcPath) : [];
  const eng = createEngine({ cfg: sb, features: feats, storyboard: sb, lrc });
  const fps = feats.meta?.fps ?? 30;

  const rows = [];
  let total = 0;
  let frames = 0;
  for (const shot of sb.shots ?? []) {
    const dur = (shot.end ?? 0) - (shot.start ?? 0);
    if (dur <= 0) continue;
    eng.renderFrame(shot.start + 0.1);
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < N; i++) eng.renderFrame(shot.start + dur * (0.2 + 0.6 * (i / N)));
    const ms = Number(process.hrtime.bigint() - t0) / 1e6 / N;
    const est = Math.round(dur * fps);
    rows.push([shot.id ?? '?', shot.scene?.type ?? '?', ms, est]);
    total += ms * est;
    frames += est;
  }
  console.log(`\nper-shot cost on ${path.basename(sbPath)} (${N} frames each, ${fps} fps)\n`);
  console.log('shot'.padEnd(20) + 'lane'.padEnd(11) + 'ms/frame'.padStart(10) + 'frames'.padStart(8) + 'shot'.padStart(9));
  for (const [id, lane, ms, est] of rows) {
    console.log(String(id).padEnd(20) + String(lane).padEnd(11) + ms.toFixed(0).padStart(10)
      + String(est).padStart(8) + `${(ms * est / 1000).toFixed(0)}s`.padStart(9));
  }
  console.log(`\n${frames} frames · ${(total / 1000 / 60).toFixed(1)} min estimated · ${(total / frames).toFixed(0)} ms/frame average`);
  const worst = rows.slice().sort((a, b) => b[2] - a[2])[0];
  console.log(`slowest: ${worst[0]} (${worst[1]}) at ${worst[2].toFixed(0)} ms/frame`);
  process.exit(0);
}

const feats = JSON.parse(fs.readFileSync(featuresPath, 'utf8'));
const dur = feats.meta?.duration ?? 120;
const blank = (type, params) => ({
  id: 'x', start: 0, end: dur, palette: 'build', enter: 'cut', camera: 'push',
  scene: { type, params },
});
const els = (n) => Array.from({ length: n }, (_, i) => ({
  kind: i % 3 === 0 ? 'rect' : i % 3 === 1 ? 'ellipse' : 'text',
  at: [0.2 + (i % 4) * 0.2, 0.3 + Math.floor(i / 4) * 0.2],
  ...(i % 3 === 2
    ? { size: 20, text: 'label', fill: 'text', weight: 700 }
    : { size: [0.22, 0.18], fill: 'raised', form: 'box', shadow: 0.3 }),
  depth: 0.3 + (i % 3) * 0.25,
}));

const CASES = {
  'field/paper': blank('field', { layer: 'paper', lyricY: 930 }),
  'field/water': blank('field', { layer: 'water', horizon: 620, motif: 'boat', motifAt: [980, 610, 190], travel: [520, -10], lyricY: 940 }),
  'field/rain': blank('field', { layer: 'rain', density: 220, motif: 'lantern', motifAt: [1420, 380, 150], lyricY: 940 }),
  typeOnly: blank('typeOnly', { layout: 'column', size: 104, kicker: 'chorus' }),
  'designed 12': blank('designed', { elements: els(12), lyricY: 950 }),
  'designed 12 + dof': blank('designed', { dof: 8, focus: 0.6, elements: els(12), lyricY: 950 }),
};

const rows = [];
for (const [name, shot] of Object.entries(CASES)) {
  const sb = { look: 'paper', duration: dur, shots: [{ ...shot, end: dur }] };
  const eng = createEngine({ cfg: sb, features: feats, storyboard: sb, lrc: [] });
  eng.renderFrame(1);
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < 8; i++) eng.renderFrame(2 + (dur - 4) * (i / 8));
  rows.push([name, Number(process.hrtime.bigint() - t0) / 1e6 / 8]);
}

const base = rows[0][1];
console.log('\nper-frame cost by lane, 1920x1080 (8 frames each)\n');
for (const [name, ms] of rows) {
  console.log(`${name.padEnd(20)} ${ms.toFixed(0).padStart(5)} ms  ${(1000 / ms).toFixed(1)} fps  ${'█'.repeat(Math.max(1, Math.round(ms / 10)))}`);
}
const slow = rows[rows.length - 1][1];
console.log(`\nslowest lane is ${(slow / base).toFixed(1)}x the cheapest.`);
console.log(`5445 frames (3:01 at 30 fps): ${((slow * 5445) / 1000 / 60).toFixed(0)} min worst, ${((base * 5445) / 1000 / 60).toFixed(0)} min best.`);
console.log('encode and mux are one extra pass at the end and are not in these numbers.');
