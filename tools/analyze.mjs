#!/usr/bin/env node
// song-mv analyze — turn a song into the feature timeline the engine needs.
//
//   node tools/analyze.mjs <song.mp3|flac|wav> [--out features.json] [--fps 30]
//
// Requires ffmpeg on PATH (used only to decode to WAV, never bundled).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { toWav, probeDuration } from './lib/ffmpeg.mjs';
import { readWav, analyze } from './lib/analyze.mjs';

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out' || a === '-o') out.out = argv[++i];
    else if (a === '--fps') out.fps = Number(argv[++i]);
    else if (a === '--bpm') out.bpm = Number(argv[++i]);
    else if (a === '--quiet' || a === '-q') out.quiet = true;
    else out._.push(a);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args._.length) {
  console.error('usage: node tools/analyze.mjs <song.wav|mp3|flac> [--out features.json] [--fps 30] [--bpm 106.7]');
  process.exit(1);
}
const input = args._[0];
const fps = args.fps || 30;
const outFile = args.out || path.join('data', 'features.json');

if (!fs.existsSync(input)) {
  console.error(`no such file: ${input}`);
  process.exit(1);
}

const tmp = path.join(os.tmpdir(), `song-mv-${process.pid}.wav`);
try {
  await toWav(input, tmp, 44100);
  const buf = fs.readFileSync(tmp);
  const { samples, sampleRate } = readWav(buf);
  if (!args.quiet) console.log(`decoded ${(samples.length / sampleRate).toFixed(2)}s @ ${sampleRate}Hz`);
  const data = analyze(samples, sampleRate, {
    fps,
    bpm: args.bpm || null,
    onProgress: args.quiet ? null : (p) => {
      if (p % 20 === 0 || p === 100) process.stdout.write(`\r  analyzing ${p}%`);
    },
  });
  if (!args.quiet) {
    process.stdout.write('\r\x1b[K');
    const tc = (data.tempoCandidates || []).slice(0, 3).map((c) => `${c.bpm.toFixed(1)} (${c.score.toFixed(2)})`).join(', ');
    console.log(`tempo: ${data.bpm.toFixed(2)} BPM   downbeat phase: ${data.downbeatPhase}`);
    if (tc) console.log(`runners-up: ${tc}`);
    console.log(`onsets: ${data.onsets.t.length}   frames: ${data.meta.frames}   duration: ${data.meta.duration.toFixed(2)}s`);
  }
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(data));
  if (!args.quiet) console.log(`wrote ${outFile} (${(fs.statSync(outFile).size / 1024 / 1024).toFixed(2)} MB)`);
} finally {
  try { fs.unlinkSync(tmp); } catch { /* ignore */ }
}
