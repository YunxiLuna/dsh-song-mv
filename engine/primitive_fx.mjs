// Primitives — imagery that belongs to no particular story.
//
// story_fx.mjs has props: a specific keyboard, a specific inbox, a specific phone
// call. They were drawn for one song. primitives are the opposite: grain, water,
// rain, ink, light, folds. A new song usually needs a handful of these plus one
// motif, not another office.
//
// Every function takes the palette `p` and paints with `p.*`, so the same water
// works in the paper look and the rain look. None of them keep state between
// frames; anything random is seeded off `f.seed`.
import { hexA } from './story_fx.mjs';
import { mulberry32 } from './prng.mjs';

function clamp01(x) { return Math.max(0, Math.min(1, x)); }
const lerp = (a, b, k) => a + (b - a) * k;

// ---------- surfaces ---------------------------------------------------------

/** Fibrous paper texture: soft blotches plus short fibres. Cheap, alpha-friendly. */
export function grainField(g, p, t, f, opts = {}) {
  const { alpha = 0.16, cell = 26, fibre = 0.5 } = opts;
  const rnd = mulberry32((f.seed ?? 1) + 11);
  g.save();
  g.globalAlpha = alpha;
  for (let y = 0; y < 1080; y += cell) {
    for (let x = 0; x < 1920; x += cell) {
      if (rnd() > 0.55) continue;
      const a = rnd() * 0.5;
      g.fillStyle = hexA(rnd() > 0.5 ? p.mute : p.line, a);
      g.fillRect(x + rnd() * cell, y + rnd() * cell, 1 + rnd() * 3, 1 + rnd() * 2);
    }
  }
  // a few longer fibres
  g.strokeStyle = hexA(p.line, 0.25);
  g.lineWidth = 1;
  for (let i = 0; i < 60 * fibre; i++) {
    const x = rnd() * 1920, y = rnd() * 1080;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rnd() - 0.5) * 90, y + (rnd() - 0.5) * 26);
    g.stroke();
  }
  g.restore();
}

/** Fold creases across the frame, like a sheet that has been folded and reopened. */
export function foldCreases(g, p, t, f, opts = {}) {
  const { n = 3, alpha = 0.5 } = opts;
  g.save();
  g.lineWidth = 2;
  for (let i = 0; i < n; i++) {
    const y = ((i + 1) / (n + 1)) * 1080 + Math.sin(t * 0.3 + i) * 6;
    const grad = g.createLinearGradient(0, y - 26, 1920, y + 26);
    grad.addColorStop(0, hexA(p.bg, 0));
    grad.addColorStop(0.5, hexA(p.line, alpha));
    grad.addColorStop(1, hexA(p.bg, 0));
    g.strokeStyle = grad;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(1920, y + Math.sin(i * 2.1) * 10);
    g.stroke();
    // the lit side of the fold
    g.strokeStyle = hexA(p.raised, alpha * 0.7);
    g.beginPath();
    g.moveTo(0, y + 2);
    g.lineTo(1920, y + 2 + Math.sin(i * 2.1) * 10);
    g.stroke();
  }
  g.restore();
}

/** Water: a horizon, a graded body, ripples that drift with the beat. */
export function waterSurface(g, p, t, f, opts = {}) {
  const { horizon = 560, alpha = 1, amp = 1, reflectX = 960 } = opts;
  const body = g.createLinearGradient(0, horizon, 0, 1080);
  body.addColorStop(0, hexA(p.panel, alpha));
  body.addColorStop(0.35, hexA(p.bg, alpha));
  body.addColorStop(1, hexA(p.raised, alpha * 0.9));
  g.fillStyle = body;
  g.fillRect(0, horizon, 1920, 1080 - horizon);

  // horizon light
  const hz = g.createLinearGradient(0, horizon - 60, 0, horizon + 40);
  hz.addColorStop(0, hexA(p.bg, 0));
  hz.addColorStop(0.6, hexA(p.accent, 0.22 + f.low * 0.18));
  hz.addColorStop(1, hexA(p.bg, 0));
  g.fillStyle = hz;
  g.fillRect(0, horizon - 60, 1920, 100);

  // ripples: horizontal strokes, thinning toward the horizon
  const rows = 46;
  for (let i = 0; i < rows; i++) {
    const k = i / rows;
    const y = horizon + Math.pow(k, 1.7) * (1080 - horizon);
    const depth = 1 - k;
    const phase = t * (0.5 + k * 1.2) + i * 0.7;
    const w = 60 + depth * 380 + Math.sin(phase) * 40;
    const x = reflectX + Math.sin(phase * 0.8) * (30 + depth * 120) - w / 2;
    g.strokeStyle = hexA(p.accent, (0.05 + depth * 0.22) * amp * (0.6 + f.beatPulse * 0.5));
    g.lineWidth = 1 + depth * 2.2;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + w, y);
    g.stroke();
  }

  // reflected column under the light source
  const col = g.createLinearGradient(reflectX - 90, horizon, reflectX + 90, horizon);
  col.addColorStop(0, hexA(p.accentHot, 0));
  col.addColorStop(0.5, hexA(p.accentHot, 0.10 + f.onsetPulse * 0.10));
  col.addColorStop(1, hexA(p.accentHot, 0));
  g.fillStyle = col;
  g.fillRect(reflectX - 90, horizon, 180, 1080 - horizon);
}

/** Rain: deterministic streaks, slanted, with a faint splash line at the bottom. */
export function rainField(g, p, t, f, opts = {}) {
  const { density = 170, alpha = 0.5, angle = 0.18, speed = 1500 } = opts;
  const rnd = mulberry32((f.seed ?? 1) + 77);
  g.save();
  g.lineCap = 'round';
  for (let i = 0; i < density; i++) {
    const seedX = rnd(), seedY = rnd(), len = 40 + rnd() * 120;
    const scale = 0.5 + rnd() * 1.2;
    const y = ((seedY * 1320 + t * speed * scale) % 1320) - 120;
    const x = ((seedX * 2100 + y * Math.tan(angle)) % 2100) - 90;
    g.strokeStyle = hexA(p.accent, alpha * (0.25 + rnd() * 0.5));
    g.lineWidth = 0.8 + rnd() * 1.4;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + len * Math.sin(angle), y + len * Math.cos(angle));
    g.stroke();
  }
  g.restore();
}

/** Slow drifting motes — dust in a shaft of light, ash, snow, plankton. */
export function driftMotes(g, p, t, f, opts = {}) {
  const { n = 90, size = 2.4, alpha = 0.5, rise = 26, spread = 1 } = opts;
  const rnd = mulberry32((f.seed ?? 1) + 31);
  g.save();
  for (let i = 0; i < n; i++) {
    const sx = rnd(), sy = rnd(), r = rnd();
    const x = ((sx * 1920 + Math.sin(t * 0.5 + r * 6.3) * 30 * spread) % 1920 + 1920) % 1920;
    const y = (((sy - t * (rise / 900) * (0.3 + r)) % 1) + 1) % 1 * 1080;
    g.fillStyle = hexA(r > 0.7 ? p.accentHot : p.sub, alpha * (0.25 + r * 0.6));
    g.beginPath();
    g.arc(x, y, size * (0.4 + r), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** Ink bleeding into wet paper: a wobbly disc with ragged edges, plus a halo. */
export function inkBleed(g, p, t, f, opts = {}) {
  const { x = 960, y = 520, r = 220, alpha = 0.5, seed = 5 } = opts;
  const rnd = mulberry32(seed + Math.floor(f.seed ?? 0));
  g.save();
  // Several soft lobes read as watercolour: no hard polygon edge to fight with
  // the motif drawn on top of it.
  const lobes = 6;
  for (let i = 0; i < lobes; i++) {
    const a = rnd() * Math.PI * 2;
    const d = r * (0.1 + rnd() * 0.55);
    const cx = x + Math.cos(a) * d;
    const cy = y + Math.sin(a) * d * 0.8;
    const rr = r * (0.55 + rnd() * 0.6);
    const grad = g.createRadialGradient(cx, cy, rr * 0.05, cx, cy, rr);
    grad.addColorStop(0, hexA(p.accent, alpha * (0.10 + rnd() * 0.06)));
    grad.addColorStop(0.55, hexA(p.accent, alpha * (0.04 + rnd() * 0.03)));
    grad.addColorStop(1, hexA(p.accent, 0));
    g.fillStyle = grad;
    g.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
  }
  g.restore();
}

/** Thin vertical threads — rain chains, strings, hanging paper. Sway on the beat. */
export function threadLines(g, p, t, f, opts = {}) {
  const { n = 14, alpha = 0.5, top = -40, bottom = 1140 } = opts;
  const rnd = mulberry32((f.seed ?? 1) + 53);
  g.save();
  g.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) / n * 1920 + (rnd() - 0.5) * 40;
    const sway = Math.sin(t * 0.8 + i) * 8 * (1 + f.beatPulse);
    g.strokeStyle = hexA(p.line, alpha * (0.3 + rnd() * 0.5));
    g.beginPath();
    g.moveTo(x, top);
    g.quadraticCurveTo(x + sway, (top + bottom) / 2, x, bottom);
    g.stroke();
  }
  g.restore();
}

/** A soft vignette that works on light backgrounds too (darkens corners by tint). */
export function softenVignette(g, p, opts = {}) {
  const { alpha = 0.5, tint = null } = opts;
  const grad = g.createRadialGradient(960, 520, 380, 960, 540, 1180);
  grad.addColorStop(0, hexA(tint ?? p.bg, 0));
  grad.addColorStop(1, hexA(tint ?? p.raised, alpha));
  g.fillStyle = grad;
  g.fillRect(0, 0, 1920, 1080);
}

// ---------- motifs -----------------------------------------------------------
// One object, drawn from scratch. Motifs are the smallest honest unit of story:
// "a boat", not "the boat from that other video".

/** A folded paper boat. Two hull triangles, one sail, a crease down the middle. */
export function paperBoat(g, p, x, y, size, opts = {}) {
  const { rot = -0.04, alpha = 1, crease = true } = opts;
  const s = size / 100;
  g.save();
  g.globalAlpha = alpha;
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s, s);

  const stroke = hexA(p.line, 0.85);
  const fillA = hexA(p.raised, 0.95);
  const fillB = hexA(p.panel, 0.9);

  // two peaks, sharing one apex — the classic folded-paper boat
  g.beginPath();
  g.moveTo(0, -96);
  g.lineTo(-74, -8);
  g.lineTo(-8, -8);
  g.closePath();
  g.fillStyle = fillB;
  g.fill();
  g.strokeStyle = stroke;
  g.lineWidth = 1.6;
  g.stroke();

  g.beginPath();
  g.moveTo(0, -96);
  g.lineTo(74, -8);
  g.lineTo(8, -8);
  g.closePath();
  g.fillStyle = fillA;
  g.fill();
  g.stroke();

  // hull
  g.beginPath();
  g.moveTo(-100, -2);
  g.lineTo(-62, 46);
  g.lineTo(62, 46);
  g.lineTo(100, -2);
  g.closePath();
  g.fillStyle = fillA;
  g.fill();
  g.stroke();

  if (crease) {
    g.strokeStyle = hexA(p.line, 0.5);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, -96);
    g.lineTo(0, 46);
    g.stroke();
    g.beginPath();
    g.moveTo(-100, -2);
    g.lineTo(100, -2);
    g.stroke();
    g.beginPath();
    g.moveTo(-62, 46);
    g.lineTo(-8, -8);
    g.moveTo(62, 46);
    g.lineTo(8, -8);
    g.stroke();
  }
  g.restore();
}

/** A window with light behind it. Works as interior or exterior depending on scale. */
export function litWindow(g, p, x, y, w, h, opts = {}) {
  const { alpha = 1, mullions = true, warm = true, open = 0 } = opts;
  g.save();
  g.globalAlpha = alpha;

  const glowR = Math.max(w, h) * 0.9;
  const glow = g.createRadialGradient(x + w / 2, y + h / 2, 10, x + w / 2, y + h / 2, glowR);
  glow.addColorStop(0, hexA(warm ? p.accentHot : p.accent, 0.28));
  glow.addColorStop(1, hexA(p.bg, 0));
  g.fillStyle = glow;
  g.fillRect(x - glowR, y - glowR, w + glowR * 2, h + glowR * 2);

  g.fillStyle = hexA(p.bg, 1);
  g.fillRect(x, y, w, h);
  const sky = g.createLinearGradient(x, y, x, y + h);
  sky.addColorStop(0, hexA(p.bg, 1));
  sky.addColorStop(1, hexA(warm ? p.accentHot : p.accent, 0.16));
  g.fillStyle = sky;
  g.fillRect(x, y, w, h);

  g.strokeStyle = hexA(p.sub, 0.55);
  g.lineWidth = 5;
  g.strokeRect(x, y, w, h);
  if (mullions) {
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h);
    g.moveTo(x, y + h * 0.46); g.lineTo(x + w, y + h * 0.46);
    g.stroke();
  }
  if (open > 0) {
    g.save();
    g.translate(x, y);
    g.strokeStyle = hexA(p.sub, 0.5);
    g.lineWidth = 4;
    g.strokeRect(0, 0, w * open, h);
    g.restore();
  }
  g.restore();
}

/** A moon (or a sun) with a soft halo. `phase` 0..1 shrinks it toward a crescent. */
export function moonDisc(g, p, x, y, r, opts = {}) {
  const { alpha = 1, phase = 0 } = opts;
  g.save();
  const halo = g.createRadialGradient(x, y, r * 0.5, x, y, r * 4);
  halo.addColorStop(0, hexA(p.accentHot, 0.20 * alpha));
  halo.addColorStop(0.4, hexA(p.accentHot, 0.06 * alpha));
  halo.addColorStop(1, hexA(p.accentHot, 0));
  g.fillStyle = halo;
  g.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);

  g.fillStyle = hexA(p.sub, 0.95 * alpha);
  if (phase > 0.04) {
    // Crescent as a path of two arcs. (Erasing pixels would punch a hole
    // through the background wash and read as a second planet.)
    const off = r * (0.35 + phase * 0.55);
    g.beginPath();
    g.arc(x, y, r, Math.PI * 0.42, Math.PI * 1.58, false);
    g.arc(x + off, y, r * 0.96, Math.PI * 1.58, Math.PI * 0.42, true);
    g.closePath();
    g.fill();
  } else {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** A hanging lantern: cord, body, warm core. */
export function lantern(g, p, x, y, size, opts = {}) {
  const { alpha = 1, sway = 0 } = opts;
  g.save();
  g.globalAlpha = alpha;
  g.translate(x, y);
  g.rotate(sway);
  g.strokeStyle = hexA(p.line, 0.7);
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(0, -260);
  g.lineTo(0, -size * 0.55);
  g.stroke();

  const glow = g.createRadialGradient(0, 0, size * 0.2, 0, 0, size * 2.4);
  glow.addColorStop(0, hexA(p.accentHot, 0.42));
  glow.addColorStop(1, hexA(p.bg, 0));
  g.fillStyle = glow;
  g.fillRect(-size * 2.4, -size * 2.4, size * 4.8, size * 4.8);

  g.fillStyle = hexA(p.accent, 0.35);
  g.strokeStyle = hexA(p.accentHot, 0.9);
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(0, 0, size * 0.62, size * 0.78, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.beginPath();
  g.arc(0, 0, size * 0.2, 0, Math.PI * 2);
  g.fillStyle = hexA(p.accentHot, 0.85);
  g.fill();
  g.restore();
}

/** An empty chair, seen from the side. Presence through absence. */
export function emptyChair(g, p, x, y, size, opts = {}) {
  const { alpha = 1, rot = 0 } = opts;
  const s = size / 100;
  g.save();
  g.globalAlpha = alpha;
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s, s);
  g.strokeStyle = hexA(p.text, 0.55);
  g.lineWidth = 4;
  g.lineJoin = 'round';
  // back
  g.beginPath();
  g.moveTo(-26, -96); g.lineTo(-26, 8); g.lineTo(26, 8); g.lineTo(26, -96);
  g.stroke();
  // seat: a shallow ellipse reads as a plane rather than another line
  g.beginPath();
  g.ellipse(2, 10, 34, 9, 0, 0, Math.PI * 2);
  g.stroke();
  // legs
  g.beginPath();
  g.moveTo(-26, 8); g.lineTo(-30, 92);
  g.moveTo(26, 8); g.lineTo(30, 92);
  g.stroke();
  // shadow under it
  const sh = g.createRadialGradient(0, 94, 4, 0, 94, 70);
  sh.addColorStop(0, hexA(p.bg, 0.45));
  sh.addColorStop(1, hexA(p.bg, 0));
  g.fillStyle = sh;
  g.fillRect(-80, 70, 160, 50);
  g.restore();
}

/** Three birds; the number that flies off depends on the beat. */
export function birdLine(g, p, x, y, w, opts = {}) {
  const { t = 0, alpha = 1, flyAway = 0 } = opts;
  g.save();
  g.strokeStyle = hexA(p.text, 0.5 * alpha);
  g.lineWidth = 2;
  g.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const bx = x + i * w * 0.34 + flyAway * (120 + i * 90);
    const by = y - i * w * 0.06 - flyAway * (90 + i * 40);
    const flap = Math.sin(t * 5 + i) * 4;
    g.globalAlpha = alpha * (1 - flyAway * 0.7);
    g.beginPath();
    g.moveTo(bx - 9, by + flap);
    g.quadraticCurveTo(bx - 4, by - 4 + flap, bx, by);
    g.quadraticCurveTo(bx + 4, by - 4 + flap, bx + 9, by + flap);
    g.stroke();
  }
  g.restore();
}

/** A single shaft of light, angled. Good for interiors and for silhouettes. */
export function lightShaft(g, p, x, y, w, h, opts = {}) {
  const { alpha = 0.18, angle = 0.22, slices = 22 } = opts;
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  // Slices across the beam, each a filled quad with its own sideways falloff,
  // so the beam ends fade out instead of stopping at a hard edge.
  for (let i = 0; i < slices; i++) {
    const u0 = (i / slices) * 2 - 1;
    const u1 = ((i + 1) / slices) * 2 - 1;
    const mid = (u0 + u1) / 2;
    const falloff = 1 - Math.abs(mid) ** 1.7;
    if (falloff <= 0.005) continue;
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, hexA(p.accentHot, alpha));
    grad.addColorStop(0.5, hexA(p.accentHot, alpha * 0.4));
    grad.addColorStop(1, hexA(p.accentHot, 0));
    g.globalAlpha = falloff;
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(u0 * w * 0.3, 0);
    g.lineTo(u1 * w * 0.3, 0);
    g.lineTo(u1 * w * 0.8, h);
    g.lineTo(u0 * w * 0.8, h);
    g.closePath();
    g.fill();
  }
  g.globalAlpha = 1;
  g.restore();
}

export { lerp, clamp01 };
