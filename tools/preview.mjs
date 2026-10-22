#!/usr/bin/env node
// song-mv preview — render a handful of stills so composition can be checked
// before spending minutes on a full render.
//
//   node tools/preview.mjs --storyboard s.json --features f.json --times 5,30,60 --out out/preview
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--storyboard') out.storyboard = argv[++i];
    else if (a === '--features') out.features = argv[++i];
    else if (a === '--audio') out.audio = argv[++i];
    else if (a === '--times') out.times = argv[++i];
    else if (a === '--out' || a === '-o') out.out = argv[++i];
    else if (a === '--count') out.count = Number(argv[++i]);
    else out._.push(a);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.storyboard || !args.features) {
  console.error('usage: node tools/preview.mjs --storyboard s.json --features f.json [--times 5,30,60] [--out out/preview]');
  process.exit(1);
}

// Default: evenly spaced stills, one per shot when no explicit times are given.
let times = args.times;
if (!times) {
  const sb = JSON.parse(fs.readFileSync(args.storyboard, 'utf8'));
  const pick = sb.shots.map((s) => +(s.start + (s.end - s.start) * 0.62).toFixed(1));
  const every = args.count ? Math.max(1, Math.round(pick.length / args.count)) : 1;
  times = pick.filter((_, i) => i % every === 0).join(',');
}

const outBase = args.out || 'out/preview';
fs.mkdirSync(path.dirname(path.resolve(outBase)), { recursive: true });
const sheet = ["--sheet", times, "--out", `${outBase}/frame`];
const childArgs = [
  path.join(here, 'render.mjs'),
  '--storyboard', args.storyboard,
  '--features', args.features,
  ...(args.audio ? ['--audio', args.audio] : ['--audio', 'silence']),
  ...sheet,
];
const child = spawn(process.execPath, childArgs, { stdio: 'inherit' });
child.on('close', (code) => process.exit(code ?? 1));
