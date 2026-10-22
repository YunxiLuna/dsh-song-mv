#!/usr/bin/env node
// song-mv render — storyboard + audio features -> mp4 (or a PNG contact sheet).
//
//   node tools/render.mjs --storyboard storyboard.json --features data/features.json \
//                         --audio song.wav --out out/mv.mp4
//   node tools/render.mjs ... --sheet 10,40,80,120      # contact sheet instead
//
// Frames are streamed to ffmpeg over stdin: no PNG intermediates, no temp disk.
import fs from 'node:fs';
import path from 'node:path';
import { createEngine } from '../engine/core.mjs';
import { createFrameSink, requireFfmpeg, probeDuration } from './lib/ffmpeg.mjs';

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--storyboard') out.storyboard = next();
    else if (a === '--features') out.features = next();
    else if (a === '--audio') out.audio = next();
    else if (a === '--out' || a === '-o') out.out = next();
    else if (a === '--start') out.start = Number(next());
    else if (a === '--end') out.end = Number(next());
    else if (a === '--fps') out.fps = Number(next());
    else if (a === '--crf') out.crf = Number(next());
    else if (a === '--preset') out.preset = next();
    else if (a === '--sheet') out.sheet = next();
    else if (a === '--width') out.width = Number(next());
    else if (a === '--height') out.height = Number(next());
    else if (a === '--quiet' || a === '-q') out.quiet = true;
    else out._.push(a);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const need = ['storyboard', 'features', 'audio'];
for (const k of need) {
  if (!args[k]) {
    console.error(`missing --${k}`);
    console.error('usage: node tools/render.mjs --storyboard s.json --features f.json --audio song.wav --out mv.mp4');
    process.exit(1);
  }
}

const storyboard = JSON.parse(fs.readFileSync(args.storyboard, 'utf8'));
const features = JSON.parse(fs.readFileSync(args.features, 'utf8'));

const cfg = {
  render: { width: args.width || 1920, height: args.height || 1080, fps: args.fps || 30 },
  post: storyboard.post || { scan: 0.03 },
  safety: storyboard.safety || { maxFlash: 0.7 },
  reactive: storyboard.reactive || { beatDecay: 6, onsetDecay: 9, strongOnset: 0.35 },
  text: storyboard.text || {},
};

// lyricsFile is resolved relative to the storyboard, so a storyboard can live
// next to its own lyrics in a repo without absolute paths.
let lrcPath = [];
if (storyboard.lyricsFile) {
  const rel = path.resolve(path.dirname(path.resolve(args.storyboard)), storyboard.lyricsFile);
  const abs = path.resolve(storyboard.lyricsFile);
  lrcPath = fs.existsSync(rel) ? rel : (fs.existsSync(abs) ? abs : []);
  if (!lrcPath.length) console.warn(`warning: lyricsFile not found (${storyboard.lyricsFile}) — lyrics will be blank`);
}

const engine = createEngine({ cfg, features, storyboard, lrc: lrcPath });

const duration = Math.min(engine.duration, features.meta.duration);
const start = Math.max(0, args.start ?? 0);
const end = Math.min(duration, args.end ?? duration);
const fps = cfg.render.fps;
const total = Math.max(1, Math.round((end - start) * fps));

if (!args.quiet) {
  console.log(`storyboard: ${storyboard.title || '(untitled)'} — ${engine.shots.length} shots`);
  for (const s of engine.shots) {
    console.log(`  ${s.id.padEnd(10)} ${s.start.toFixed(2).padStart(7)} → ${s.end.toFixed(2).padStart(7)}  [${s.palette}] ${s.type}${s.loud ? ' *' : ''}`);
  }
  console.log(`rendering ${total} frames (${start.toFixed(2)}–${end.toFixed(2)}s @ ${fps}fps)`);
}

// ---- contact-sheet mode -------------------------------------------------------
if (args.sheet) {
  const times = args.sheet.split(',').map(Number).filter((n) => Number.isFinite(n));
  const outdir = path.dirname(args.out || 'out/sheet.png');
  fs.mkdirSync(outdir, { recursive: true });
  const base = (args.out || 'out/mv.mp4').replace(/\.mp4$/, '');
  times.forEach((t, i) => {
    const canvas = engine.renderFrame(t);
    const file = `${base}_${String(i + 1).padStart(3, '0')}_${t}s.png`;
    fs.writeFileSync(file, canvas.toBuffer('image/png'));
    if (!args.quiet) console.log(`  t=${t}s -> ${file}`);
  });
  console.log(`wrote ${times.length} frame(s)`);
  process.exit(0);
}

// ---- video mode ---------------------------------------------------------------
requireFfmpeg();
const outFile = args.out || 'out/mv.mp4';
fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });

const { width, height } = cfg.render;
const sink = createFrameSink({
  width, height, fps,
  outFile,
  audioFile: args.audio,
  crf: args.crf ?? 18,
  preset: args.preset ?? 'veryfast',
});

const t0 = Date.now();
let lastLog = 0;
for (let i = 0; i < total; i++) {
  const t = start + i / fps;
  const canvas = engine.renderFrame(t);
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, width, height);
  await sink.write(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength));
  if (!args.quiet) {
    const now = Date.now();
    if (now - lastLog > 700 || i === total - 1) {
      lastLog = now;
      const pct = ((i + 1) / total * 100).toFixed(1);
      const rate = (i + 1) / ((now - t0) / 1000);
      process.stdout.write(`\r  ${pct}%  frame ${i + 1}/${total}  ${rate.toFixed(1)} fps  t=${t.toFixed(1)}s   `);
    }
  }
}
process.stdout.write('\n');
await sink.close();
const secs = (Date.now() - t0) / 1000;
const size = fs.existsSync(outFile) ? (fs.statSync(outFile).size / 1024 / 1024).toFixed(1) : '?';
const dur = await probeDuration(outFile);
console.log(`done: ${outFile}  ${size} MB  ${dur ? dur.toFixed(1) + 's' : ''}  rendered in ${secs.toFixed(0)}s`);
