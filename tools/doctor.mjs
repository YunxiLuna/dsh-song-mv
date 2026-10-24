#!/usr/bin/env node
// song-mv doctor — check a storyboard before you spend five minutes rendering it.
//
// Every mistake that used to surface as a blank frame, a silent NaN or an
// assertion inside a gate is caught here, statically, in milliseconds.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { SCENES } from '../engine/scenes.mjs';
import { LOOK_IDS } from '../engine/looks.mjs';
import { validateElements, ELEMENT_KINDS } from '../engine/elements.mjs';
import { CAMERA_MOVES } from '../engine/motion.mjs';
import { parseLrc } from '../engine/core.mjs';

const CAMERA_ALIASES = new Set([...(CAMERA_MOVES ?? []), 'none', undefined]);
const PALETTES = ['still', 'tender', 'build', 'release', 'intense', 'peak', 'dawn', 'fade'];
const ENTER = ['cut', 'dissolve', 'glitch', undefined];

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('-'));
if (!file) {
  console.error('usage: song-mv doctor <storyboard.json> [--features features.json]');
  process.exit(2);
}

const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

let sb;
try {
  sb = JSON.parse(readFileSync(file, 'utf8'));
} catch (e) {
  console.error(`storyboard is not valid JSON: ${e.message}`);
  process.exit(1);
}

const shots = sb.shots ?? [];
if (!Array.isArray(shots) || !shots.length) err('shots: expected a non-empty array');
if (sb.look && !LOOK_IDS.includes(sb.look)) {
  err(`look: "${sb.look}" is not one of ${LOOK_IDS.join(', ')}`);
}

// --- timing ---------------------------------------------------------------
let prevEnd = 0;
const ids = new Set();
shots.forEach((sh, i) => {
  const at = `shots[${i}]${sh.id ? ` (${sh.id})` : ''}`;
  if (!sh.id) warn(`${at}: no id — give it one, it is what every report calls it`);
  else if (ids.has(sh.id)) err(`${at}: duplicate id "${sh.id}"`);
  else ids.add(sh.id);

  if (typeof sh.start !== 'number' || typeof sh.end !== 'number') {
    err(`${at}: start/end must be numbers`);
    return;
  }
  if (sh.end <= sh.start) err(`${at}: end ${sh.end} is not after start ${sh.start}`);
  const gap = sh.start - prevEnd;
  if (i === 0 && sh.start > 0.05) err(`${at}: the film starts at ${sh.start}s, not 0`);
  if (i > 0 && Math.abs(gap) > 0.05) err(`${at}: ${gap > 0 ? `${gap.toFixed(2)}s gap` : `${(-gap).toFixed(2)}s overlap`} before this shot`);
  prevEnd = sh.end;

  if (sh.palette && !PALETTES.includes(sh.palette)) err(`${at}.palette: "${sh.palette}" is not one of ${PALETTES.join(', ')}`);
  if (sh.paletteFrom && !PALETTES.includes(sh.paletteFrom)) err(`${at}.paletteFrom: unknown palette "${sh.paletteFrom}"`);
  if (!ENTER.includes(sh.enter)) err(`${at}.enter: "${sh.enter}" is not one of cut, dissolve, glitch`);
  if (sh.camera && !CAMERA_ALIASES.has(sh.camera)) err(`${at}.camera: "${sh.camera}" is not a known move (${[...CAMERA_ALIASES].filter(Boolean).join(', ')})`);

  const scene = sh.scene ?? {};
  const type = scene.type;
  if (!type) err(`${at}: scene.type is required (one of ${Object.keys(SCENES).join(', ')})`);
  else if (!SCENES[type]) err(`${at}: scene.type "${type}" does not exist (one of ${Object.keys(SCENES).join(', ')})`);

  const params = scene.params ?? {};
  if (typeof params !== 'object') err(`${at}: scene.params must be an object`);

  if (params.elements) {
    for (const msg of validateElements(params.elements, `${at}.elements`)) err(msg);
  }
  if (type === 'designed' && !params.elements && !params.actors && !params.mid) {
    err(`${at}: designed shot has no elements and no actors — it would render empty`);
  }
  if (type === 'field' && !params.layer) warn(`${at}: field has no layer (defaults to paper)`);
  if (params.actors) {
    for (const [k, a] of params.actors.entries()) {
      if (!a.prop) err(`${at}.actors[${k}]: no prop`);
      if (a.at && (!Array.isArray(a.at) || a.at.length < 2)) err(`${at}.actors[${k}].at: expected [x, y, size] in pixels or fractions`);
    }
  }
  for (const key of ['cameraAmount', 'dof', 'backlight', 'insertZoom']) {
    if (params[key] != null && typeof params[key] !== 'number') err(`${at}.params.${key}: expected a number`);
  }
});

if (shots.length && Math.abs(prevEnd - (sb.duration ?? prevEnd)) > 0.3) {
  warn(`last shot ends at ${prevEnd.toFixed(2)}s but duration says ${sb.duration} — the tail will be black`);
}

// --- lyrics ---------------------------------------------------------------
const lyricsRel = sb.lyricsFile;
if (!lyricsRel) {
  warn('lyricsFile: not set — the film will have no lyrics');
} else {
  const p = path.isAbsolute(lyricsRel) ? lyricsRel : path.resolve(path.dirname(file), lyricsRel);
  if (!existsSync(p)) {
    err(`lyricsFile: ${lyricsRel} not found (looked in ${path.dirname(p)})`);
  } else {
    const lines = parseLrc(p);
    if (!lines.length) err(`lyricsFile: ${lyricsRel} parsed to zero lines — check the [mm:ss.xx] format`);
    else {
      const unsorted = lines.findIndex((l, i) => i && l.t < lines[i - 1].t);
      if (unsorted > 0) err(`lyricsFile: line ${unsorted + 1} goes backwards in time`);
      const late = lines.filter((l) => l.t > (sb.duration ?? 1e9)).length;
      if (late) warn(`lyricsFile: ${late} line(s) start after the film ends`);
      const plain = lines.every((l) => !l.words);
      if (plain) warn('lyricsFile: no inline <mm:ss.xx> marks — karaoke will spread each line at a fixed rate');
    }
  }
}

// --- features -------------------------------------------------------------
const featArg = argv.indexOf('--features');
if (featArg >= 0) {
  const fp = argv[featArg + 1];
  if (!fp || !existsSync(fp)) err(`--features: ${fp} not found`);
  else {
    const feats = JSON.parse(readFileSync(fp, 'utf8'));
    const d = Number(feats.duration ?? feats.meta?.duration);
    if (Math.abs(d - (sb.duration ?? 0)) > 0.5) {
      err(`features duration ${d}s does not match storyboard duration ${sb.duration}s — re-run analyze or fix the storyboard`);
    }
    if (!feats.beats?.length) warn('features has no beats — palettes and pulses will be flat');
  }
}

// --- an honest summary of the edit ---------------------------------------
if (shots.length) {
  const cuts = shots.length;
  const shortest = Math.min(...shots.map((s2) => s2.end - s2.start));
  const longest = Math.max(...shots.map((s2) => s2.end - s2.start));
  const lanes = {};
  for (const s2 of shots) lanes[s2.scene?.type ?? '?'] = (lanes[s2.scene?.type ?? '?'] ?? 0) + 1;
  console.log(`${file}: ${cuts} shots, ${(sb.duration ?? prevEnd).toFixed(1)}s, look ${sb.look ?? 'night-shift'}`);
  console.log(`  shot length ${shortest.toFixed(1)}–${longest.toFixed(1)}s   lanes: ${Object.entries(lanes).map(([k, v]) => `${k}×${v}`).join(', ')}`);
  if (longest > 12) warn(`longest shot is ${longest.toFixed(1)}s — over 10s a vector scene reads as a slide; cut it`);
}

if (warns.length) {
  console.log('');
  for (const w of warns) console.log(`  warn  ${w}`);
}
if (errors.length) {
  console.log('');
  for (const e of errors) console.log(`  ERROR ${e}`);
  console.log(`\n${errors.length} error(s). Nothing was rendered.`);
  process.exit(1);
}
console.log(`\nno errors. next: song-mv preview --storyboard ${path.basename(file)}`);
