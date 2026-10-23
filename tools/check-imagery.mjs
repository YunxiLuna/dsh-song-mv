#!/usr/bin/env node
// song-mv check-imagery — is the picture built, or just sketched?
//
// check-motion asks "does this shot move". This asks the other half: is the
// frame *composed*. Both questions have numeric answers, and an agent that can
// read a verdict fixes its own JSON without being told twice.
//
//   node tools/check-imagery.mjs --storyboard s.json [--min-elements 8]
import fs from 'node:fs';
import { validateElements } from '../engine/elements.mjs';

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) out[a.slice(2)] = argv[++i] ?? true;
    else out._.push(a);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.storyboard) {
  console.error('usage: node tools/check-imagery.mjs --storyboard s.json [--min-elements 8]');
  process.exit(1);
}

const minElements = Number(args['min-elements'] ?? 8);
const sb = JSON.parse(fs.readFileSync(args.storyboard, 'utf8'));

const HORIZON = (els) => els.filter((e) => ['line', 'band', 'grid'].includes(e.kind)).length > 0;
const DEPTHS = (els) => {
  const d = els.map((e) => e.depth ?? 0.5);
  const back = d.filter((v) => v < 0.35).length;
  const mid = d.filter((v) => v >= 0.35 && v <= 0.7).length;
  const near = d.filter((v) => v > 0.7).length;
  return { back, mid, near };
};
// "Does something happen" is counted from three sources: a keyframe track on an
// element (the strongest signal), a one-shot motion on an element, and a
// shot-level event (shake, flash, ring, sweep, burst, wipe).
const EVENTS = (els, shotEvents) => {
  let n = Array.isArray(shotEvents) ? shotEvents.length : 0;
  for (const e of els) {
    if (Array.isArray(e.keys) && e.keys.length >= 2) { n++; continue; }
    const m = e.motion ?? {};
    if (m.enter) n++;
    if (m.travel) n++;
    if (m.sink) n++;
    if (m.out) n++;
    if (m.spin) n++;
  }
  return n;
};

let failed = 0;
const rows = [];
for (const [i, shot] of (sb.shots ?? []).entries()) {
  const id = shot.id ?? `shot${i + 1}`;
  const els = shot.scene?.params?.elements;
  const type = shot.scene?.type;

  if (type !== 'designed' || !els) {
    rows.push([id, type, '—', '—', '—', 'no elements layer']);
    continue;
  }

  const errors = validateElements(els, `${id}.elements`);
  const d = DEPTHS(els);
  const planes = [d.back, d.mid, d.near].filter((v) => v > 0).length;
  const hor = HORIZON(els);
  const ev = EVENTS(els, shot.scene?.params?.events);

  const problems = [];
  if (els.length < minElements) problems.push(`only ${els.length} elements (want ≥ ${minElements})`);
  if (planes < 3) problems.push(`depth planes: ${planes}/3`);
  if (!hor) problems.push('no horizon (line/band/grid)');
  if (ev < 2) problems.push(`${ev} motion event(s) (want ≥ 2)`);
  if (errors.length) problems.push(`${errors.length} invalid element(s)`);
  if (problems.length) failed++;

  rows.push([id, type, `${els.length}`, `${planes}/3`, hor ? 'yes' : 'no', problems.length ? `← ${problems.join('; ')}` : 'ok']);
}

const w = [22, 12, 6, 6, 6];
const pad = (s, n) => String(s).padEnd(n);
console.log(
  pad('shot', w[0]) + pad('type', w[1]) + pad('els', w[2]) + pad('pln', w[3]) + pad('hor', w[4]) + 'verdict',
);
console.log('-'.repeat(96));
for (const r of rows) {
  console.log(pad(r[0], w[0]) + pad(r[1], w[1]) + pad(r[2], w[2]) + pad(r[3], w[3]) + pad(r[4], w[4]) + r[5]);
}
console.log('-'.repeat(96));

if (failed) {
  console.log(`${failed} shot(s) are under-composed. The rules are in docs/imagery.md:`);
  console.log('  one light source · three planes · a horizon · 8-14 elements · two events');
  process.exit(1);
}
console.log('every shot is composed.');
