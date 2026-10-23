#!/usr/bin/env node
// song-mv plan — draft a storyboard from the audio features.
//
// This is a *starting point*, not a finished edit: it slices the song at
// detected energy changes, then assigns a palette and a scene type per shot
// based on how loud/energetic that stretch is. Every field is meant to be
// replaced by a human who has actually listened to the song.
import fs from 'node:fs';
import path from 'node:path';
import { LOOK_IDS, DEFAULT_LOOK } from '../engine/looks.mjs';

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--features') out.features = argv[++i];
    else if (a === '--storyboard' || a === '-o') out.storyboard = argv[++i];
    else if (a === '--shots') out.shots = Number(argv[++i]);
    else if (a === '--title') out.title = argv[++i];
    else if (a === '--duration') out.duration = Number(argv[++i]);
    else if (a === '--look') out.look = argv[++i];
    else if (a === '--scenes') out.scenes = argv[++i];
    else if (a === '--quiet' || a === '-q') out.quiet = true;
    else out._.push(a);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (!args.features) {
  console.error('usage: node tools/plan.mjs --features data/features.json [--storyboard storyboard.json] ' +
    '[--shots 9] [--look ' + LOOK_IDS.join('|') + '] [--scenes generic|nightshift]');
  process.exit(1);
}
const feats = JSON.parse(fs.readFileSync(args.features, 'utf8'));
const outFile = args.storyboard || 'storyboard.json';
const duration = args.duration || feats.meta.duration;
const wantShots = Math.max(3, args.shots || 9);
const look = args.look || DEFAULT_LOOK;
if (!LOOK_IDS.includes(look)) {
  console.error(`unknown look "${look}". available: ${LOOK_IDS.join(', ')}`);
  process.exit(1);
}
// "generic" scenes work for any song: texture + one motif + the lyrics.
// "nightshift" is the nine props from the office song this engine grew out of —
// they are an example of how far you can push it, not a template.
const sceneSet = args.scenes || 'generic';
if (!['generic', 'nightshift'].includes(sceneSet)) {
  console.error('--scenes must be generic or nightshift');
  process.exit(1);
}
if (!args.look) {
  console.error(`note: no --look given, using "${look}". Pick the one that matches the song.`);
}

// ---- section detection -------------------------------------------------------
// Smooth the RMS envelope, then cut where the derivative stays large.
const fps = feats.meta.fps;
const rms = feats.rms;
const win = Math.max(1, Math.round(fps * 0.5));
const smooth = [];
for (let i = 0; i < rms.length; i += win) {
  let s = 0, n = 0;
  for (let j = i; j < Math.min(rms.length, i + win); j++) { s += rms[j]; n++; }
  smooth.push({ t: i / fps, v: s / Math.max(1, n) });
}
const mean = smooth.reduce((a, b) => a + b.v, 0) / smooth.length;
const norm = smooth.map((p) => ({ t: p.t, v: p.v / (mean || 1) }));

// Prefer bar lines where the energy actually changes, instead of slicing the
// song into equal blocks: a cut in the middle of a phrase looks like a bug.
const beats = feats.beats || [];
const phase = feats.downbeatPhase || 0;
const barLen = 4 * (60 / (feats.bpm || 120));
const barStart = beats[phase] ?? 0;
const barLines = [];
for (let t = barStart; t < duration; t += barLen) {
  if (t > 1) barLines.push(t);
}
const at = (t) => {
  const i = Math.min(norm.length - 1, Math.max(0, Math.round(t / 0.5)));
  return norm[i].v;
};
const windowMean = (t0, t1) => {
  let s = 0, n = 0;
  for (let t = Math.max(0, t0); t < Math.min(duration, t1); t += 0.25) { s += at(t); n++; }
  return n ? s / n : 0;
};

const spacing = duration / wantShots;
const cuts = [0];
for (let k = 1; k < wantShots; k++) {
  const target = k * spacing;
  const tol = spacing * 0.4;
  let bestT = target, bestScore = -Infinity;
  for (const t of barLines) {
    if (Math.abs(t - target) > tol) continue;
    const jump = Math.abs(windowMean(t + 0.25, t + 1.75) - windowMean(t - 1.75, t - 0.25));
    // Energy change matters, but so does staying near the target length.
    const score = jump - 0.35 * Math.abs(t - target) / tol;
    if (score > bestScore) { bestScore = score; bestT = t; }
  }
  if (bestT > cuts[cuts.length - 1] + 2) cuts.push(bestT);
}
cuts.push(duration);

// Scene pools per energy band. Rotating through a pool keeps consecutive
// shots of the same intensity from looking like one long scene.
// Generic pools: a background made of primitives, one motif, and the lyrics.
// Energy picks the texture; the look supplies the colour.
const GENERIC = {
  still: [
    { type: 'field', params: { layer: 'paper', folds: 2, motif: 'window' } },
    { type: 'typeOnly', params: { layout: 'stack', size: 96 } },
  ],
  tender: [
    { type: 'field', params: { layer: 'paper', folds: 3, motif: 'boat' } },
    { type: 'field', params: { layer: 'water', horizon: 640 } },
    { type: 'field', params: { layer: 'motes', motif: 'moon' } },
  ],
  build: [
    { type: 'field', params: { layer: 'water', horizon: 620, motif: 'boat' } },
    { type: 'field', params: { layer: 'thread', motif: 'lantern' } },
    { type: 'typeOnly', params: { layout: 'column', size: 92 } },
  ],
  intense: [
    { type: 'field', params: { layer: 'rain', density: 220, motif: 'lantern' } },
    { type: 'field', params: { layer: 'thread', motif: 'chair' } },
    { type: 'typeOnly', params: { layout: 'column', size: 100 } },
  ],
  peak: [
    { type: 'field', params: { layer: 'ink', motif: 'chair', r: 320 } },
    { type: 'field', params: { layer: 'rain', density: 320 } },
    { type: 'typeOnly', params: { layout: 'stack', size: 108 } },
  ],
};

// The office-song props. Kept as a reference pack; do not reach for these
// unless the song is actually about a desk, a deadline, or a 110 hotline.
const NIGHTSHIFT = {
  still: ['emptyScene', 'keyboard'],
  tender: ['keyboard', 'desk', 'emptyScene'],
  build: ['desk', 'stampScene', 'keyboard'],
  intense: ['stampScene', 'erase', 'call110'],
  peak: ['voidScene', 'erase', 'stampScene'],
};

const POOLS = sceneSet === 'nightshift' ? NIGHTSHIFT : null;
const rotation = { still: 0, tender: 0, build: 0, intense: 0, peak: 0 };

const shots = [];
for (let i = 0; i < cuts.length - 1; i++) {
  const start = +cuts[i].toFixed(2);
  const end = +Math.min(duration, cuts[i + 1]).toFixed(2);
  // average energy across the shot decides the state
  let e = windowMean(start, end);
  const state = e < 0.55 ? 'still' : e < 0.8 ? 'tender' : e < 1.05 ? 'build' : e < 1.45 ? 'intense' : 'peak';
  let pick;
  if (POOLS) {
    const pool = POOLS[state];
    const type = pool[rotation[state]++ % pool.length];
    pick = { type, params: {} };
  } else {
    const pool = GENERIC[state];
    const base = pool[rotation[state]++ % pool.length];
    // deep-ish clone so params can be edited per shot without aliasing
    pick = { type: base.type, params: { ...base.params } };
  }
  shots.push({
    id: `${String(i + 1).padStart(2, '0')}_${pick.type}`,
    start, end,
    palette: state,
    enter: e > 1.3 ? 'glitch' : 'dissolve',
    scene: pick,
  });
}
// A music video should end quietly. With the office pack, that means the
// log-out card; with generic scenes, a field that resolves and holds the title.
if (shots.length >= 3) {
  const outro = shots[shots.length - 2];
  const eOutro = windowMean(outro.start, outro.end);
  // Only if the song actually winds down: a kitchen scene dropped onto a
  // chorus is worse than no kitchen scene at all.
  if (POOLS && outro.end - outro.start > 6 && eOutro < 0.85) {
    outro.scene = { type: 'kitchenScene', params: {} };
    outro.palette = 'dawn';
    outro.enter = 'dissolve';
    outro.id = outro.id.replace(/_\w+$/, '_kitchenScene');
  }
}
if (shots.length >= 2) {
  const last = shots[shots.length - 1];
  if (POOLS) {
    last.scene = { type: 'logout', params: {} };
    last.enter = 'cut';
    last.id = last.id.replace(/_\w+$/, '_logout');
  } else {
    // no dialog, no joke: just the last texture and the song title
    last.scene = {
      type: 'field',
      params: { layer: 'motes', motif: 'boat', motifAt: [960, 600, 200], still: args.title || '' },
    };
    last.enter = 'dissolve';
    last.id = last.id.replace(/_\w+$/, '_outro');
  }
  last.palette = 'dawn';
}

const storyboard = {
  title: args.title || path.basename(outFile, '.json'),
  duration,
  look,
  lyricsFile: null,
  post: { scan: 0.03 },
  safety: { maxFlash: 0.7 },
  reactive: { beatDecay: 6, onsetDecay: 9, strongOnset: 0.35 },
  shots,
};

fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(storyboard, null, 2));
if (!args.quiet) {
  console.log(`tempo ${feats.bpm.toFixed(1)} BPM · ${duration.toFixed(1)}s · drafted ${shots.length} shots -> ${outFile}`);
  for (const s of shots) console.log(`  ${s.id.padEnd(16)} ${s.start.toFixed(1).padStart(6)} → ${s.end.toFixed(1).padStart(6)}  [${s.palette}]`);
  console.log('\nThis is a draft. Set `lyricsFile`, then replace scene params with the actual content of your song.');
}
