#!/usr/bin/env node
// song-mv qa — brightness and flash report for a rendered mp4.
//
//   node tools/qa.mjs --file out/mv.mp4 [--fps 10]
//
// Loud, fast luminance jumps are both an encoding smell and a photosensitivity
// risk. This samples luma once a second and flags any step larger than the
// threshold (default 40/255).
import { spawn } from 'node:child_process';
import { requireFfmpeg } from './lib/ffmpeg.mjs';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--file' || a === '-f') out.file = argv[++i];
    else if (a === '--threshold') out.threshold = Number(argv[++i]);
    else if (a === '--fps') out.fps = Number(argv[++i]);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.file) {
  console.error('usage: node tools/qa.mjs --file out/mv.mp4');
  process.exit(1);
}
const W = 64, H = 36, FPS = args.fps || 1;
const bin = requireFfmpeg();

const chunks = [];
const child = spawn(bin, [
  '-hide_banner', '-loglevel', 'error', '-i', args.file,
  '-vf', `fps=${FPS},scale=${W}:${H},format=gray`,
  '-f', 'rawvideo', '-',
], { stdio: ['ignore', 'pipe', 'inherit'] });

child.stdout.on('data', (d) => chunks.push(d));
await new Promise((res, rej) => {
  child.on('error', rej);
  child.on('close', res);
});

const buf = Buffer.concat(chunks);
const frameSize = W * H;
const frames = Math.floor(buf.length / frameSize);
const luma = [];
for (let i = 0; i < frames; i++) {
  let s = 0;
  for (let p = 0; p < frameSize; p++) s += buf[i * frameSize + p];
  luma.push(s / frameSize);
}

const min = Math.min(...luma), max = Math.max(...luma);
const avg = luma.reduce((a, b) => a + b, 0) / (luma.length || 1);
const threshold = args.threshold ?? 40;
const flashes = [];
for (let i = 1; i < luma.length; i++) {
  const d = Math.abs(luma[i] - luma[i - 1]);
  if (d > threshold) flashes.push({ t: i / FPS, d: +d.toFixed(1) });
}

const spark = luma
  .filter((_, i) => i % Math.max(1, Math.round(luma.length / 90)) === 0)
  .map((v) => {
    const chars = ' .:-=+*#%@';
    return chars[Math.min(9, Math.floor((v / 255) * 10))];
  })
  .join('');

console.log(`file:   ${args.file}`);
console.log(`frames: ${frames} sampled @ ${FPS}/s`);
console.log(`luma:   min ${min.toFixed(1)}  avg ${avg.toFixed(1)}  max ${max.toFixed(1)}  (0-255)`);
console.log(`curve:  ${spark}`);
if (flashes.length) {
  console.log(`flashes above ${threshold}: ${flashes.length}`);
  for (const f of flashes.slice(0, 12)) console.log(`  t=${f.t.toFixed(1)}s  Δ${f.d}`);
  if (flashes.length > 12) console.log(`  … ${flashes.length - 12} more`);
} else {
  console.log(`flashes above ${threshold}: none`);
}
if (avg < 12) console.log('\nwarning: the video is very dark on average — check the palette before shipping.');
