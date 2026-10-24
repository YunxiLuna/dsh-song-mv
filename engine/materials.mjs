// Materials and light.
//
// Flat fills make everything the same substance: a cup, a door and a wall all
// come out as the same colour field. A material is a *texture pass* drawn on
// top of an element after its fill, clipped to the same box, so the same rect
// can be paper, metal or glass. Light is a *direction*, applied to every
// element in a shot at once, so highlights and shaded edges agree with each
// other.
//
// Everything here is a pure function of (element, time): the same frame renders
// identically twice.

import { hexA } from './story_fx.mjs';
import { mulberry32 } from './prng.mjs';

export const MATERIALS = ['none', 'paper', 'grain', 'metal', 'glass', 'water', 'fabric', 'wood'];

const rnd = mulberry32(0x9e3779b9);

/** Clip to the element's own silhouette so texture never spills. */
function clipTo(g, el, fr) {
  g.beginPath();
  const w = Math.abs(fr.w);
  const h = Math.abs(fr.h);
  if (el.kind === 'ellipse') {
    g.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else if (el.kind === 'poly' && Array.isArray(el.points) && el.points.length > 2) {
    const pts = el.points;
    g.moveTo(pts[0][0] * w, pts[0][1] * h);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] * w, pts[i][1] * h);
    g.closePath();
  } else if (el.round) {
    const r = Math.min(w, h) * (el.radius ?? 0.06);
    g.roundRect(-w / 2, -h / 2, w, h, r);
  } else {
    g.rect(-w / 2, -h / 2, w, h);
  }
  g.clip();
}

/**
 * Draw a material over an element. Call inside the element's transform, after
 * its fill and stroke, with the context unclipped.
 *
 * @param {object} el   the element (`material`, `materialAmount`, `grainAngle`)
 * @param {object} fr   its frame: { w, h } in px (half not needed; box is centred)
 */
export function drawMaterial(g, p, el, fr, tv) {
  const kind = el.material;
  if (!kind || kind === 'none') return;
  const amt = el.materialAmount ?? 0.5;
  if (amt <= 0) return;

  const w = Math.abs(fr.w);
  const h = Math.abs(fr.h);
  const seed = el.seed ?? 7;
  // palette roles, overridable per element so one look can carry two
  // materials of the same family
  const light = el.lightFill ?? 'raised';
  const dark = el.darkFill ?? 'line';
  const R = mulberry32(seed * 7919 + Math.round(w) + Math.round(h) * 3);

  g.save();
  clipTo(g, el, fr);

  // Two passes make volume without adding brightness:
  //   multiply  — a gradient toward the far side, which *darkens* the body
  //   lighter   — a narrow specular band on the lit side
  // Painting white on top of a pale fill only produced white slabs, so the
  // highlight is kept narrow and the body is shaped by the dark pass.
  if (kind === 'glass' || kind === 'metal' || kind === 'paper' || kind === 'grain') {
    const shadowAmt = (kind === 'metal' ? 0.26 : 0.22) * amt;
    const grd = g.createLinearGradient(-w / 2, -h / 2, w * 0.55, h / 2);
    grd.addColorStop(0, hexA(p[dark], 0));
    grd.addColorStop(0.45, hexA(p[dark], shadowAmt * 0.35));
    grd.addColorStop(1, hexA(p[dark], shadowAmt));
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = grd;
    g.fillRect(-w / 2, -h / 2, w, h);

    g.globalCompositeOperation = 'lighter';
    const spec = kind === 'metal' ? 0.3 : kind === 'glass' ? 0.26 : 0.08;
    const sg = g.createLinearGradient(-w * 0.5, -h * 0.5, -w * 0.05, h * 0.1);
    sg.addColorStop(0, hexA(p[light], spec * amt));
    sg.addColorStop(1, hexA(p[light], 0));
    g.fillStyle = sg;
    g.fillRect(-w / 2, -h / 2, w, h);
    g.globalCompositeOperation = 'source-over';
  }

  if (kind === 'paper' || kind === 'grain') {
    const n = Math.round((w * h) / (kind === 'paper' ? 620 : 1100));
    g.globalCompositeOperation = 'multiply';
    for (let i = 0; i < n; i++) {
      const x = (R() - 0.5) * w;
      const y = (R() - 0.5) * h;
      const s = 0.6 + R() * 1.5;
      g.fillStyle = hexA(p[dark], (0.05 + R() * 0.07) * amt);
      g.beginPath();
      g.ellipse(x, y, s, s * 0.8, 0, 0, Math.PI * 2);
      g.fill();
    }
    if (kind === 'paper') {
      const fibres = Math.round(w / 10);
      g.lineCap = 'round';
      for (let i = 0; i < fibres; i++) {
        const x = (R() - 0.5) * w;
        const y = (R() - 0.5) * h;
        const len = 5 + R() * 20;
        const a = (R() - 0.5) * 0.5;
        g.strokeStyle = hexA(p[dark], (0.05 + R() * 0.05) * amt);
        g.lineWidth = 0.6 + R() * 0.6;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        g.stroke();
      }
    }
    g.globalCompositeOperation = 'source-over';
  } else if (kind === 'metal') {
    const streaks = Math.round(h / 4);
    for (let i = 0; i < streaks; i++) {
      const y = -h / 2 + (i / streaks) * h + R() * 2;
      g.strokeStyle = hexA(R() > 0.55 ? p[light] : p[dark], (0.02 + R() * 0.04) * amt);
      g.lineWidth = 0.5 + R();
      g.beginPath();
      g.moveTo(-w / 2, y);
      g.lineTo(w / 2, y + (R() - 0.5) * 2);
      g.stroke();
    }
  } else if (kind === 'glass') {
    // a single specular streak: what makes glass read as glass
    g.globalCompositeOperation = 'lighter';
    g.strokeStyle = hexA(p[light], 0.34 * amt);
    g.lineWidth = Math.max(1.2, Math.min(w, h) * 0.016);
    g.beginPath();
    g.moveTo(-w * 0.32, -h * 0.4);
    g.quadraticCurveTo(-w * 0.08, -h * 0.16, w * 0.06, -h * 0.42);
    g.stroke();
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = hexA(p[dark], 0.18 * amt);
    g.lineWidth = Math.max(1, Math.min(w, h) * 0.008);
    g.beginPath();
    g.moveTo(w * 0.34, -h * 0.3);
    g.lineTo(w * 0.34, h * 0.34);
    g.stroke();
  } else if (kind === 'water') {
    const n = Math.max(4, Math.round(h / 9));
    for (let i = 0; i < n; i++) {
      const y = -h / 2 + ((i + 0.5) / n) * h;
      const ph = (tv * (0.4 + (i % 3) * 0.15) + i * 0.7) % 1;
      const x = -w / 2 + ph * w;
      g.strokeStyle = hexA(p[light], (0.2 + 0.1 * Math.sin(tv + i)) * amt);
      g.lineWidth = 1 + (i % 2);
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + w * 0.06, y - h * 0.012, x + w * 0.12, y);
      g.stroke();
    }
  } else if (kind === 'fabric') {
    const step = Math.max(4, Math.round(Math.min(w, h) / 22));
    g.globalCompositeOperation = 'multiply';
    for (let x = -w / 2; x < w / 2; x += step) {
      g.strokeStyle = hexA(p[dark], 0.06 * amt);
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, -h / 2); g.lineTo(x + step * 0.25, h / 2); g.stroke();
    }
    for (let y = -h / 2; y < h / 2; y += step) {
      g.beginPath(); g.moveTo(-w / 2, y); g.lineTo(w / 2, y + step * 0.2); g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
  } else if (kind === 'wood') {
    const n = Math.max(6, Math.round(h / 6));
    g.globalCompositeOperation = 'multiply';
    for (let i = 0; i < n; i++) {
      const y = -h / 2 + (i / n) * h + (R() - 0.5) * 2;
      g.strokeStyle = hexA(p[dark], (0.05 + R() * 0.07) * amt);
      g.lineWidth = 0.8 + R() * 1.2;
      g.beginPath();
      g.moveTo(-w / 2, y);
      g.bezierCurveTo(-w * 0.15, y + (R() - 0.5) * 5, w * 0.15, y + (R() - 0.5) * 5, w / 2, y);
      g.stroke();
    }
    g.globalCompositeOperation = 'source-over';
  }

  g.restore();
}

/**
 * Form shading: give a flat shape a volume by shading it against the shot's key
 * light. `form` is one of:
 *
 *   flat    no shading (default)
 *   box     a slab: two faces meet at the light direction, plus a lit edge
 *   cyl     a cylinder (mugs, poles, columns): bright band offset to the light
 *   sphere  a ball (seals, fruit, lamps): radial gradient centred toward the key
 *
 * This is the difference between "a rectangle filled with cream" and "a door
 * leaf". It costs one gradient per element and no authoring: the same storyboard
 * gains volume by adding `"form": "box"` to a shape.
 */
export function formShade(g, p, el, fr, key) {
  const form = el.form;
  if (!form || form === 'flat' || !key || key.strength <= 0) return;
  const w = Math.abs(fr.w), h = Math.abs(fr.h);
  const k = Math.min(1, Math.max(0, key.strength));
  const { dx, dy } = key;
  const wrap = el.formWrap !== false;

  g.save();
  g.clip && clipTo(g, el, fr);
  if (form === 'box') {
    // Two faces: the one facing away from the key sinks toward the ground
    // colour, the one facing it lifts. A hard stop at the middle keeps it a
    // slab rather than a ball.
    const grd = g.createLinearGradient(-dx * w * 0.5, -dy * h * 0.5, dx * w * 0.5, dy * h * 0.5);
    grd.addColorStop(0, hexA(p.bg, 0.34 * k));
    grd.addColorStop(0.5, hexA(p.bg, 0.02 * k));
    grd.addColorStop(1, hexA(p.bg, 0.26 * k));
    g.fillStyle = grd;
    g.fillRect(-w / 2, -h / 2, w, h);
    // lit rim on the key side
    if (el.rim !== false) {
      const rim = g.createLinearGradient(-dx * w * 0.5, -dy * h * 0.5, dx * w * 0.2, dy * h * 0.2);
      rim.addColorStop(0, hexA(p.raised, 0.5 * k));
      rim.addColorStop(1, hexA(p.raised, 0));
      g.strokeStyle = rim;
      g.lineWidth = Math.max(2, (el.lw ?? 3) * 1.6);
      g.beginPath();
      g.rect(-w / 2, -h / 2, w, h);
      g.stroke();
    }
  } else if (form === 'cyl') {
    const grd = g.createLinearGradient(-w / 2, 0, w / 2, 0);
    grd.addColorStop(0, hexA(p.bg, 0.3 * k));
    grd.addColorStop(0.28, hexA(p.raised, 0.22 * k));
    grd.addColorStop(0.55, hexA(p.bg, 0.02 * k));
    grd.addColorStop(1, hexA(p.bg, 0.36 * k));
    g.fillStyle = grd;
    g.fillRect(-w / 2, -h / 2, w, h);
  } else if (form === 'sphere') {
    const cx = -dx * w * 0.28, cy = -dy * h * 0.28;
    const grd = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.62);
    grd.addColorStop(0, hexA(p.raised, 0.4 * k));
    grd.addColorStop(0.6, hexA(p.bg, 0.04 * k));
    grd.addColorStop(1, hexA(p.bg, 0.42 * k));
    g.fillStyle = grd;
    g.fillRect(-w / 2, -h / 2, w, h);
  }
  if (!wrap) g.restore();
  g.restore();
}

/**
 * Shade an element against a key light: a gradient across its box, bright on
 * the lit side, darker away from it. Call inside the element's transform after
 * the material pass.
 *
 * @param {{dx:number,dy:number,strength:number}} key  light vector, normalised
 */
export function shadeElement(g, p, el, fr, key) {
  if (!key || key.strength <= 0) return;
  const w = Math.abs(fr.w);
  const h = Math.abs(fr.h);
  const k = key.strength * (el.shadeAmount ?? 1);
  const cx = key.dx * w * 0.5;
  const cy = key.dy * h * 0.5;

  g.save();
  clipTo(g, el, fr);
  const grd = g.createLinearGradient(-cx, -cy, cx, cy);
  grd.addColorStop(0, hexA(p.raised, 0.1 * k));
  grd.addColorStop(0.55, hexA(p.raised, 0));
  grd.addColorStop(1, hexA(p.bg, 0.2 * k));
  g.fillStyle = grd;
  g.fillRect(-w / 2, -h / 2, w, h);
  g.restore();
}

/**
 * The shot's key light as a full-frame wash: a soft gradient from the light
 * position plus a warm tint. Keeps every shot's light direction identical to
 * the per-element shading above.
 */
export function keyLightWash(g, p, key, W, H) {
  if (!key || key.strength <= 0) return;
  // `soft-light` is not reliable across canvas builds, and any additive pass
  // over a cream world just milks it out. The wash therefore only darkens:
  // a multiply gradient that leaves the lit corner alone and deepens the far
  // side, which is what a key light actually does to a pale set.
  const lx = 0.5 - key.dx * 0.4;
  const ly = 0.5 - key.dy * 0.4;
  const fx = 0.5 + key.dx * 0.75;
  const fy = 0.5 + key.dy * 0.75;
  g.save();
  g.globalCompositeOperation = 'multiply';
  const grd = g.createLinearGradient(lx * W, ly * H, fx * W, fy * H);
  grd.addColorStop(0, hexA(p.bg, 0));
  grd.addColorStop(0.45, hexA(p.bg, 0.12 * key.strength));
  grd.addColorStop(1, hexA(p.bg, 0.55 * key.strength));
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);
  g.restore();

  // a narrow warm bounce on the lit side, small enough not to lift the whole
  // frame
  g.save();
  g.globalCompositeOperation = 'lighter';
  const warm = g.createRadialGradient(lx * W, ly * H, 0, lx * W, ly * H, Math.max(W, H) * 0.45);
  warm.addColorStop(0, hexA(p.accentHot, 0.1 * key.strength));
  warm.addColorStop(1, hexA(p.accentHot, 0));
  g.fillStyle = warm;
  g.fillRect(0, 0, W, H);
  g.restore();
}

/** Normalise a `keyLight` param into the vector the passes above consume. */
export function lightVector(keyLight) {
  if (!keyLight) return null;
  const [lx, ly] = keyLight.from ?? [0.22, 0.18];
  let dx = 0.5 - lx;
  let dy = 0.5 - ly;
  const len = Math.hypot(dx, dy) || 1;
  dx /= len;
  dy /= len;
  return { dx, dy, strength: keyLight.strength ?? 0.5 };
}
