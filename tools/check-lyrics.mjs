#!/usr/bin/env node
// song-mv check-lyrics — sanity-check an .lrc before it ends up on screen.
//
//   node tools/check-lyrics.mjs lyrics.lrc [--duration 200.9] [--json]
//
// Catches the failures that are invisible in a text editor:
//   - the file is enhanced (word-timed) and something downstream ignores the marks
//   - a sibling `<name>.std.lrc` was derived from the enhanced file and every
//     line is stamped with its LAST word's time, so lines arrive late by an
//     amount that differs from line to line
//   - timestamps that go backwards, overlap the next line, or sit past the audio
import fs from 'node:fs';
import path from 'node:path';
import { parseLrc } from '../engine/core.mjs';

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('-'));
const json = argv.includes('--json');
const di = argv.indexOf('--duration');
const duration = di >= 0 ? Number(argv[di + 1]) : null;

if (!file) {
  console.error('usage: node tools/check-lyrics.mjs <file.lrc> [--duration 200.9] [--json]');
  process.exit(1);
}

const abs = path.resolve(file);
if (!fs.existsSync(abs)) {
  console.error(`no such file: ${abs}`);
  process.exit(2);
}

const lines = parseLrc(abs);
const raw = fs.readFileSync(abs, 'utf8');
const enhanced = /<\d{1,3}:\d{2}\.\d{1,3}>/.test(raw);
const offsetTag = raw.match(/\[offset:([+-]?\d+)\]/i);

const problems = [];
const warnings = [];

if (!lines.length) problems.push('no timed lines parsed — is this an .lrc at all?');
if (enhanced) {
  warnings.push('enhanced LRC (word marks): per-word timings are used for karaoke fill');
}

// order / overlap / past-the-end
for (let i = 1; i < lines.length; i++) {
  if (lines[i].t <= lines[i - 1].t) problems.push(`line ${i + 1} does not advance (${fmt(lines[i].t)} after ${fmt(lines[i - 1].t)})`);
}
if (duration) {
  const late = lines.filter((l) => l.t > duration + 0.2);
  if (late.length) problems.push(`${late.length} line(s) start after the audio ends (${duration}s), first at ${fmt(late[0].t)}`);
}

// a .std.lrc next to a word-timed .lrc is the classic end-stamped copy
const base = abs.replace(/\.std\.lrc$/i, '').replace(/\.lrc$/i, '');
const enhancedSibling = [`${base}.lrc`, `${base}.enhanced.lrc`].find((p) => fs.existsSync(p) && p !== abs);
let siblingReport = null;
if (enhancedSibling && /\.std\.lrc$/i.test(abs)) {
  const src = parseLrc(enhancedSibling);
  const pairs = [];
  for (const line of lines) {
    const match = src.find((l) => l.text === line.text);
    if (match) pairs.push({ text: line.text, mine: line.t, theirs: match.t, lastWord: match.words?.length ? match.words[match.words.length - 1].t : null });
  }
  const deltas = pairs.filter((p) => p.lastWord != null).map((p) => +(p.theirs - p.lastWord).toFixed(2));
  const late = pairs.filter((p) => p.mine - p.theirs > 0.35);
  siblingReport = { file: path.basename(abs), source: path.basename(enhancedSibling), pairs: pairs.length, deltas, late: late.length };
  if (late.length) {
    problems.push(
      `${late.length} line(s) are stamped later than the word-timed source — this file looks derived from ` +
      `${path.basename(enhancedSibling)} using each line's LAST word mark (median ${median(late.map((p) => p.mine - p.theirs)).toFixed(2)}s late). Use the word-timed file instead.`,
    );
  }
}

if (!json) {
  console.log(`\n${path.basename(abs)} — ${lines.length} lines, ${enhanced ? 'word-timed' : 'plain'}${offsetTag ? `, offset ${offsetTag[1]}ms` : ''}`);
  console.log('----------------------------------------------------------------');
  for (const [i, l] of lines.entries()) {
    const next = lines[i + 1];
    const span = next ? (next.t - l.t).toFixed(2) : '—';
    console.log(`${String(i + 1).padStart(3)}  ${fmt(l.t)}  +${span.padStart(6)}  ${l.text}${l.words?.length ? `   (${l.words.length} marks)` : ''}`);
  }
  if (siblingReport) {
    console.log('');
    console.log(`vs ${siblingReport.source}: ${siblingReport.pairs} matching lines, ` +
      `${siblingReport.late} stamped late, median lag ${median(siblingReport.deltas).toFixed(2)}s`);
  }
  for (const w of warnings) console.log(`note: ${w}`);
  for (const p of problems) console.log(`PROBLEM: ${p}`);
  console.log('');
  console.log(problems.length ? `${problems.length} problem(s).` : 'lyrics look consistent.');
}

if (json) console.log(JSON.stringify({ file: abs, lines: lines.length, enhanced, duration, problems, warnings, sibling: siblingReport }, null, 2));
process.exit(problems.length ? 1 : 0);

function fmt(t) {
  const m = Math.floor(t / 60);
  const s = (t - m * 60).toFixed(2).padStart(5, '0');
  return `${String(m).padStart(2, '0')}:${s}`;
}
function median(a) {
  if (!a.length) return 0;
  const b = [...a].sort((x, y) => x - y);
  return b[Math.floor(b.length / 2)];
}
