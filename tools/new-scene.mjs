#!/usr/bin/env node
// song-mv new-scene — start a scene file that is already shaped like the engine
// expects: three planes, an entrance, a beat event, and the lyric.
//
//   node tools/new-scene.mjs gutter --out scenes/gutter.mjs
//   node tools/new-scene.mjs gutter --out scenes/gutter.mjs --from designed
//
// The scaffold renders as soon as you point a storyboard at it, so you always
// have a working picture to edit instead of a blank file.
import fs from 'node:fs';
import path from 'node:path';

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], next = () => argv[++i];
    if (a === '--out' || a === '-o') out.out = next();
    else if (a === '--from') out.from = next();
    else if (a === '--force') out.force = true;
    else out._.push(a);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const name = args._[0];
if (!name) {
  console.error('usage: node tools/new-scene.mjs <scene-name> [--out scenes/<name>.mjs] [--force]');
  process.exit(1);
}
if (!/^[a-zA-Z][\w-]*$/.test(name)) {
  console.error('scene name must start with a letter and contain only letters, digits, _ or -');
  process.exit(1);
}

const outFile = path.resolve(args.out || `scenes/${name}.mjs`);
if (fs.existsSync(outFile) && !args.force) {
  console.error(`${outFile} exists; pass --force to overwrite`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(outFile), { recursive: true });

const scaffold = `/**
 * Scene \`${name}\`.
 *
 * Contract: a scene is a pure function of time.
 *   (ctx, tv, f, P) -> draw one frame
 *     ctx   engine context: ctx.pal (colours), ctx.g (2D context), ctx.cam (camera),
 *           ctx.lyr (lyrics), ctx.feats (analysis)
 *     tv    song time in seconds
 *     f     sampled audio: f.onsetPulse, f.downPulse, f.sinceBeat, f.rmsEnv, f.spec
 *     P     this shot's params plus { start, end, dur }
 *
 * The engine already applies the camera around this function and calls it for
 * every frame; do not move the frame yourself.
 *
 * Params read here (add more as you need):
 *   lyricY, lyricStyle, caption, still
 */
// No imports on purpose: everything a scene needs arrives on ctx, so this file
// works wherever it lives (next to a storyboard, in another project, in a test).
const WORD = '"Noto Sans", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';

export function ${name}(ctx, tv, f, P = { start: 0 }) {
  const p = ctx.pal, g = ctx.g;
  // ctx.lib carries the primitives + hexA; ctx.mo carries the easing helpers.
  const { hexA, grainField, foldCreases, paperBoat } = ctx.lib;
  const { ease, rampE, decay, bob } = ctx.mo;
  const s = P.start ?? 0;
  const t0 = tv - s;                       // seconds into this shot
  const dur = P.dur ?? Math.max(1, (P.end ?? s + 18) - s);
  const cam = ctx.cam ?? { depth: () => ({ x: 0, y: 0 }) };
  ctx.clear();

  // 1. background — one plane, far away. Moves least.
  const back = cam.depth(0.15);
  const wash = g.createLinearGradient(0, 0, 0, 1080);
  wash.addColorStop(0, p.panel);
  wash.addColorStop(1, p.bg);
  g.fillStyle = wash;
  g.fillRect(-120, -120, 2160, 1320);
  g.save();
  g.translate(back.x, back.y);
  grainField(g, p, tv, f, { alpha: 0.14 });
  foldCreases(g, p, tv, f, { n: 2, alpha: 0.35 });
  g.restore();

  // 2. midground — the subject. Enters, travels, reacts to the beat.
  const mid = cam.depth(0.5);
  const inK = rampE(t0, 0.25, 1.1, ease.outBack);     // entrance over ~1.1 s
  const kick = f.onsetPulse > 0.5 ? decay(f.sinceBeat ?? 99, 0, 0.34) : 0;
  // Move across the *whole* shot and come back (ping-pong). A subject that
  // crosses once and parks leaves the second half of the shot static — the
  // motion check will (correctly) fail it.
  const swing = 0.5 - 0.5 * Math.cos((t0 / dur) * Math.PI * 2);
  const x = 560 + 440 * ease.inOutQuad(swing) + (1 - inK) * -120;
  const y = 620 + bob(tv, 5, 0.3) - kick * 10;
  g.save();
  g.globalAlpha = Math.min(1, inK);
  g.translate(mid.x, mid.y);
  paperBoat(g, p, x, y, 210, { rot: -0.03 + Math.sin(tv * 0.55) * 0.03 });
  g.restore();

  // 3. foreground — one element that moves fastest. This is what makes the
  //    frame read as depth instead of as a flat illustration.
  const near = cam.depth(1.0);
  g.save();
  g.translate(near.x * 1.5, near.y * 1.5);
  g.globalAlpha = 0.18 + (f.rmsEnv ?? 0) * 0.1;
  g.fillStyle = hexA(p.accentHot, 0.5);
  g.fillRect(0, 980, 1920, 2);
  g.restore();

  // 4. events — discrete things that happen, not one continuous drift.
  //    Rings on every strong onset, plus a slow surge every four bars so a long
  //    shot keeps producing visible change between beats.
  const barSurge = decay(((tv - s) % 8), 0, 1.6);
  const ring = Math.max(decay(f.sinceBeat ?? 99, 0, 0.9), barSurge * 0.55);
  if (ring > 0) {
    g.save();
    g.globalAlpha = ring * 0.45;
    g.strokeStyle = hexA(p.accentHot, 0.9);
    g.lineWidth = 2 + ring * 3;
    g.beginPath();
    g.ellipse(x, y + 110, 80 + (1 - ring) * 240, (80 + (1 - ring) * 240) * 0.28, 0, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }

  // 5. lyric — the melody line. Keep the treatment consistent within a section.
  const { cur } = (ctx.lyr ?? { activeAt: () => ({ cur: null }) }).activeAt(tv);
  const size = 92;
  const ly = P.lyricY ?? 890;
  if (cur && tv - cur.t < 8) {
    g.font = \`700 \${size}px \${WORD}\`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = p.text;
    g.fillText(cur.text, 960, ly);
  } else if (P.still) {
    g.font = \`700 \${size}px \${WORD}\`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = hexA(p.mute, 0.55);
    g.fillText(P.still, 960, ly);
  }

  if (P.caption) {
    g.font = '500 22px ui-monospace, monospace';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillStyle = hexA(p.sub, 0.8);
    g.fillText(P.caption, 96, 1006);
  }
}

// Storyboards can also load several scenes from one file.
export const SCENES = { ${name} };
`;

fs.writeFileSync(outFile, scaffold, 'utf8');

const rel = path.relative(process.cwd(), outFile).split(path.sep).join('/');
console.log(`wrote ${rel}`);
console.log('');
console.log('next:');
console.log(`  1. preview it        node tools/preview.mjs --storyboard storyboard.json --features data/features.json --times 30`);
console.log(`  2. tell the storyboard to load it:  "scenes": ["${rel}"]`);
console.log(`  3. use it            { "scene": { "type": "${name}", "params": {} } }`);
console.log('  4. before rendering  node tools/check-motion.mjs --storyboard storyboard.json --features data/features.json');
