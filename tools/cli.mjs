#!/usr/bin/env node
// song-mv — one CLI for the whole pipeline.
//
//   song-mv analyze <audio> [--out data/features.json]
//   song-mv plan    --features f.json [--storyboard storyboard.json] [--duration N]
//   song-mv preview --storyboard s.json --features f.json [--times 5,30,60]
//   song-mv check-motion --storyboard s.json --features f.json
//   song-mv new-scene gutter --out scenes/gutter.mjs
//   song-mv render  --storyboard s.json --features f.json --audio song.wav --out out/mv.mp4
//   song-mv qa      --file out/mv.mp4
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const [cmd, ...rest] = process.argv.slice(2);

const COMMANDS = {
  analyze: 'analyze.mjs',
  plan: 'plan.mjs',
  preview: 'preview.mjs',
  'check-motion': 'check-motion.mjs',
  'new-scene': 'new-scene.mjs',
  render: 'render.mjs',
  qa: 'qa.mjs',
};

if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
  console.log(`song-mv — code-rendered music videos

  song-mv analyze <audio>    analyze tempo/beats/spectrum -> features.json
  song-mv plan               draft a storyboard from the features
  song-mv preview            render a few stills to check composition
  song-mv check-motion       measure whether each shot actually moves
  song-mv new-scene <name>   start a scene file shaped like the engine expects
  song-mv render             render the full video (frames piped into ffmpeg)
  song-mv qa                 inspect an mp4 for brightness/flash problems

Run "song-mv <command> --help" for that command's flags.`);
  process.exit(cmd ? 0 : 1);
}

const script = COMMANDS[cmd];
if (!script) {
  console.error(`unknown command: ${cmd}\nTry: ${Object.keys(COMMANDS).join(', ')}`);
  process.exit(1);
}

const child = spawn(process.execPath, [path.join(here, script), ...rest], { stdio: 'inherit' });
child.on('close', (code) => process.exit(code ?? 1));
