/**
 * Actors — a prop registry plus one choreographer.
 *
 * A scene used to be a function that drew props in a fixed order. This module
 * makes the props data: name, position, and how they arrive / travel / react.
 * `designed` (in scenes.mjs) composes a shot out of these without new code, and
 * a hand-written scene can use the same registry for the parts it does not need
 * to customise.
 *
 * Every actor supports the same choreography, so motion is not something each
 * scene re-invents:
 *
 *   { "prop": "paperBoat", "at": [700, 620, 200],
 *     "enter": 0.3,               // seconds into the shot before it appears
 *     "enterDur": 1.1,            // how long the entrance takes
 *     "enterFrom": "below",       // below | above | left | right | none
 *     "travel": [420, -20],       // how far it crosses the frame over the shot
 *     "bob": 5, "bobHz": 0.32,    // idle float
 *     "rot": -0.03,               // base rotation
 *     "stage": "sink",            // none | sink | return
 *     "sinkAt": 0.55,             // fraction of the shot where a sink starts
 *     "react": true,              // kick on strong onsets
 *     "alpha": 1, "flip": false }
 */

import { ease, rampE, decay, bob, clamp01 } from './motion.mjs';
import {
  grainField, foldCreases, waterSurface, rainField, driftMotes, inkBleed,
  threadLines, softenVignette, lightShaft,
  paperBoat, litWindow, moonDisc, lantern, emptyChair, birdLine,
} from './primitive_fx.mjs';

/**
 * Prop registry. Each entry draws at (x, y) with a nominal size and reads
 * colours from the palette, so the same prop works in every look.
 */
export const PROPS = {
  boat: (g, p, x, y, s, o) => paperBoat(g, p, x, y, s, o),
  window: (g, p, x, y, s, o) => litWindow(g, p, x - s * 1.6, y - s * 1.1, s * 3.2, s * 2.2, o),
  moon: (g, p, x, y, s, o) => moonDisc(g, p, x, y, s * 0.55, o),
  lantern: (g, p, x, y, s, o) => lantern(g, p, x, y, s * 0.6, o),
  chair: (g, p, x, y, s, o) => emptyChair(g, p, x, y, s * 1.4, o),
  birds: (g, p, x, y, s, o) => birdLine(g, p, x, y, s * 2.4, o),
  grain: (g, p, x, y, s, o) => grainField(g, p, o.t ?? 0, o.f, { alpha: o.alpha ?? 0.2 }),
  folds: (g, p, x, y, s, o) => foldCreases(g, p, o.t ?? 0, o.f, { n: o.n ?? 3, alpha: o.alpha ?? 0.45 }),
  water: (g, p, x, y, s, o) => waterSurface(g, p, o.t ?? 0, o.f, { horizon: y, reflectX: x }),
  rain: (g, p, x, y, s, o) => rainField(g, p, o.t ?? 0, o.f, { density: o.density ?? 200, alpha: o.alpha ?? 0.4 }),
  motes: (g, p, x, y, s, o) => driftMotes(g, p, o.t ?? 0, o.f, { n: o.n ?? 140, alpha: o.alpha ?? 0.5, rise: o.rise ?? 30 }),
  ink: (g, p, x, y, s, o) => inkBleed(g, p, o.t ?? 0, o.f, { x, y, r: s }),
  thread: (g, p, x, y, s, o) => threadLines(g, p, o.t ?? 0, o.f, { n: o.n ?? 16 }),
  light: (g, p, x, y, s, o) => lightShaft(g, p, x, y - 80, s, 1200, { alpha: o.alpha ?? 0.16 }),
  vignette: (g, p) => softenVignette(g, p),
};

/** A wrapped list of actor specs, normalised to arrays. */
export function actors(list) {
  if (!list) return [];
  return Array.isArray(list) ? list : [list];
}

/**
 * Draw one actor with its full choreography applied.
 * `depth` is the parallax plane (0 far … 1 near), read from ctx.cam.
 */
export function drawActor(g, p, a, tv, f, ctxState = {}) {
  const draw = PROPS[a.prop];
  if (!draw) return;
  const { cam = null, depth = 0.5, t0 = 0, dur = 18 } = ctxState;
  const [x, y, size = 180] = a.at ?? [960, 560, 180];

  const enterAt = a.enter ?? 0;
  const enterDur = a.enterDur ?? 1.1;
  const inK = a.enterFrom === 'none' || enterAt === null
    ? 1
    : rampE(t0, enterAt, Math.max(0.05, enterDur), ease.outBack);

  const trav = a.travel ?? [0, 0];
  const travK = ease.inOutQuad(clamp01(t0 / Math.max(0.2, dur)));
  const stage = a.stage ?? 'none';
  let sinkK = 0;
  let riseK = 0;
  if (stage === 'sink') sinkK = ease.inQuad(clamp01((t0 - dur * (a.sinkAt ?? 0.55)) / Math.max(1.2, dur * 0.3)));
  else if (stage === 'return') riseK = 1 - ease.outCubic(clamp01(t0 / Math.max(1.4, a.riseDur ?? 2.6)));

  const idle = bob(tv, a.bob ?? 4, a.bobHz ?? 0.32);
  const kick = a.react && f.onsetPulse > 0.5 ? decay(f.sinceBeat ?? 99, 0, 0.34) : 0;

  // entrance direction: slide in from an edge rather than fading out of nowhere
  const off = (1 - inK) * Math.max(60, size * 0.45);
  let dx = 0, dy = 0;
  if (a.enterFrom === 'left') dx = -off;
  else if (a.enterFrom === 'right') dx = off;
  else if (a.enterFrom === 'above') dy = -off;
  else if (a.enterFrom !== 'none') dy = off;

  const ax = x + trav[0] * travK + dx;
  const ay = y + trav[1] * travK + dy + idle + sinkK * size * 0.8 + riseK * size * 1.5;
  const sc = size / 180;
  const rot = (a.rot ?? 0) + Math.sin(tv * 0.55) * (a.sway ?? 0.03) + sinkK * 0.5 + kick * 0.012;
  const alpha = clamp01(inK * 1.15) * (a.alpha ?? 1) * (1 - sinkK * 0.85);

  const pl = cam ? cam.depth(depth) : { x: 0, y: 0 };
  g.save();
  g.globalAlpha = alpha;
  g.translate(pl.x, pl.y);
  if (a.flip) { g.translate(ax, ay); g.scale(-1, 1); g.translate(-ax, -ay); }
  draw(g, p, ax, ay, (a.at?.[2] ?? 180), {
    ...a.opts,
    rot,
    scale: sc,
    t: tv,
    f,
    n: a.n,
    alpha: 1,
    phase: a.phase ?? 0.15,
  });
  g.restore();
}
