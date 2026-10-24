#!/usr/bin/env node
// song-mv — one CLI for the whole pipeline.
//
//   song-mv new      <dir>            scaffold a song project you can fill in
//   song-mv analyze  <audio>          tempo / beats / spectrum -> features.json
//   song-mv plan     --features f     draft a storyboard from the features
//   song-mv doctor   --storyboard s   static validation, milliseconds, no render
//   song-mv preview  --storyboard s   a few stills to check composition
//   song-mv sheet    --storyboard s | --video v   contact sheet
//   song-mv check-*                   the three gates
//   song-mv render / qa
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const [cmd, ...rest] = process.argv.slice(2);

const COMMANDS = {
  new: 'new.mjs',
  analyze: 'analyze.mjs',
  plan: 'plan.mjs',
  doctor: 'doctor.mjs',
  preview: 'preview.mjs',
  sheet: 'sheet.mjs',
  'check-lyrics': 'check-lyrics.mjs',
  'check-imagery': 'check-imagery.mjs',
  'check-frame': 'check-frame.mjs',
  'check-motion': 'check-motion.mjs',
  'new-scene': 'new-scene.mjs',
  render: 'render.mjs',
  qa: 'qa.mjs',
};

const HELP = `song-mv — code-rendered music videos

  song-mv new <dir>          scaffold <dir> with an analyzed song and a storyboard
  song-mv analyze <audio>    analyze tempo/beats/spectrum -> features.json
  song-mv plan               draft a storyboard from the features
  song-mv doctor             validate a storyboard without rendering (milliseconds)
  song-mv preview            render a few stills to check composition
  song-mv sheet              contact sheet from a storyboard or a finished mp4

  gates — cheap to expensive, run in this order:
  song-mv check-lyrics       .lrc timing, the .std trap, offsets
  song-mv check-imagery      composition: elements, planes, horizon, labels, repetition
  song-mv check-frame        the rendered picture: exposure, tonal range, coverage
  song-mv check-motion       whether each shot actually moves

  song-mv new-scene <name>   start a scene file shaped like the engine expects
  song-mv render             render the full video (frames piped into ffmpeg)
  song-mv qa                 inspect an mp4 for brightness/flash problems

Start with docs/GUIDE.md — it is the only doc you need to read first.`;

if (!cmd || cmd === '--help' || cmd === '-h' || cmd === 'help') {
  console.log(HELP);
  process.exit(cmd ? 0 : 1);
}

const script = COMMANDS[cmd];
if (!script) {
  console.error(`unknown command: ${cmd}\nTry: ${Object.keys(COMMANDS).join(', ')}`);
  process.exit(1);
}

const child = spawn(process.execPath, [path.join(here, script), ...rest], { stdio: 'inherit' });
child.on('close', (code) => process.exit(code ?? 1));
