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
const EVENTS = (els, shotEvents, shot) => {
  let n = Array.isArray(shotEvents) ? shotEvents.length : 0;
  // A camera move or an insert is motion in the film sense even when nothing
  // inside the frame travels.
  if (shot?.camera && shot.camera !== 'none') n++;
  if (Array.isArray(shot?.scene?.params?.inserts)) n += shot.scene.params.inserts.length;
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
  const ev = EVENTS(els, shot.scene?.params?.events, shot);

  const problems = [];
  if (els.length < minElements) problems.push(`only ${els.length} elements (want ≥ ${minElements})`);
  if (planes < 3) problems.push(`depth planes: ${planes}/3`);
  if (!hor) problems.push('no horizon (line/band/grid)');
  if (ev < 2) problems.push(`${ev} motion event(s) (want ≥ 2)`);
  // A frame with no in-world text is a diagram: nobody can tell a door from a
  // card from a screen. Signs, labels, tickets and timestamps are how a viewer
  // reads what they are looking at.
  const labels = els.filter((e) => e.kind === 'text' && String(e.text ?? '').trim().length > 0);
  if (labels.length === 0) problems.push('no in-world text (a sign, label or timestamp)');
  const plated = labels.filter((e) => e.plate);
  if (labels.length > 0 && plated.length === 0) problems.push('text with no plate — unreadable over texture');
  if (errors.length) problems.push(`${errors.length} invalid element(s)`);
  if (problems.length) failed++;

  rows.push([id, type, `${els.length}`, `${planes}/3`, hor ? 'yes' : 'no', problems.length ? `← ${problems.join('; ')}` : 'ok']);
}

// Repetition across the whole film: the same motif in a third of the shots is
// the single most common way a generated film starts to look like a loop.
const motifUse = new Map();
const layerUse = new Map();
for (const shot of sb.shots ?? []) {
  const p2 = shot.scene?.params ?? {};
  if (shot.scene?.type !== 'field') continue;
  if (p2.motif) motifUse.set(p2.motif, [...(motifUse.get(p2.motif) ?? []), shot.id ?? '?']);
  const l = p2.layer ?? 'paper';
  layerUse.set(l, [...(layerUse.get(l) ?? []), shot.id ?? '?']);
}
const fieldCount = (sb.shots ?? []).filter((s2) => s2.scene?.type === 'field').length;
const CAP = Math.max(2, Math.ceil(fieldCount / 3));
for (const [k, ids] of motifUse) {
  if (ids.length > CAP) {
    console.log(`\nmotif \`${k}\` carries ${ids.length} of ${fieldCount} field shots (cap ${CAP}): ${ids.join(', ')}.`);
    console.log('A repeated motif is a refrain, not a shot list: vary it or give it a different job.');
    failed++;
  }
}
for (const [k, ids] of layerUse) {
  if (ids.length > CAP + 1) {
    console.log(`\nlayer \`${k}\` carries ${ids.length} of ${fieldCount} field shots (cap ${CAP + 1}): ${ids.join(', ')}.`);
    failed++;
  }
}

// Repetition: five shots of the same water and the same boat is not a film, it
// is a wallpaper loop. Two in a row is a motif; three is a rut.
const RUN_MAX = 2;
const sig = (shot) => {
  const t = shot.scene?.type;
  const p2 = shot.scene?.params ?? {};
  if (t === 'field') return `field:${p2.layer ?? 'paper'}:${p2.motif ?? 'none'}`;
  if (t === 'typeOnly') return 'type';
  if (t === 'designed') {
    const layers = (p2.elements ?? []).filter((e) => e.kind === 'plane' || e.kind === 'band').length;
    return `designed:${layers}:${(p2.elements ?? []).length}`;
  }
  return t ?? '?';
};
const runIds = [];
let runLen = 0;
let runKey = null;
for (const shot of sb.shots ?? []) {
  const k = sig(shot);
  if (k === runKey) {
    runLen++;
    runIds.push(shot.id ?? '?');
    if (runLen > RUN_MAX) {
      console.log(`\nrepetition: ${runIds.join(' → ')} all render \`${k}\`.`);
      console.log(`At most ${RUN_MAX} consecutive shots may share a layer+motif: change one of them, or move it to another section.`);
      failed++;
      runIds.length = 0;
      runLen = 0;
    }
  } else {
    runKey = k;
    runLen = 1;
    runIds.length = 0;
    runIds.push(shot.id ?? '?');
  }
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
