/**
 * Motion — the part that makes a shot feel filmed instead of pasted.
 *
 * A scene draws objects. This module decides how they move: the camera, the
 * parallax between layers, staggered entrances, beat-synced hits, and the little
 * idle motion that keeps a still frame from looking like a screenshot.
 *
 * Everything here is a pure function of time, like the rest of the engine.
 */

// ---------------------------------------------------------------- easing ----

export const ease = {
  linear: (x) => x,
  inQuad: (x) => x * x,
  outQuad: (x) => 1 - (1 - x) * (1 - x),
  inOutQuad: (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2),
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outQuint: (x) => 1 - Math.pow(1 - x, 5),
  outBack: (x) => {
    const c = 1.70158, c3 = c + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
  },
  outElastic: (x) => {
    if (x === 0 || x === 1) return x;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1;
  },
};

export const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

/** 0→1 progress of a ramp that starts at `t0` and lasts `dur` seconds. */
export function ramp(t, t0, dur = 0.6) {
  if (!Number.isFinite(t) || !Number.isFinite(t0)) return 0;
  if (!Number.isFinite(dur) || dur <= 0) return t >= t0 ? 1 : 0;
  return clamp01((t - t0) / dur);
}

/** Eased ramp. */
export function rampE(t, t0, dur = 0.6, fn = ease.outCubic) {
  return fn(ramp(t, t0, dur));
}

/** A pulse that decays: 1 at `t0`, 0 by `t0 + decay`. NaN-safe: a missing
 *  timestamp must read as "no pulse", never as NaN leaking into a transform. */
export function decay(t, t0, decayT = 0.35) {
  if (!Number.isFinite(t) || !Number.isFinite(t0) || !Number.isFinite(decayT) || decayT <= 0) return 0;
  const k = (t - t0) / decayT;
  if (!(k >= 0) || k > 1) return 0;
  return (1 - k) * (1 - k);
}

/** Staggered start times for n items, like words in a line. */
export function stagger(n, t0, step = 0.12) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(t0 + i * step);
  return out;
}

/** Idle bob: slow float, no drift over a long shot. */
export function bob(t, amp = 6, hz = 0.35, phase = 0) {
  if (!Number.isFinite(t)) return 0;
  return Math.sin(t * Math.PI * 2 * hz + phase) * amp;
}

/** Softer, less periodic drift for background layers. */
export function drift(t, amp = 8, hz = 0.13, phase = 0) {
  return Math.sin(t * Math.PI * 2 * hz + phase) * amp + Math.sin(t * Math.PI * 2 * hz * 2.7 + phase) * amp * 0.25;
}

/**
 * Smooth value noise in one dimension: hashed lattice points, smoothstep
 * between them. `shake` used raw hash output first, which changes every frame
 * and reads as a permanently vibrating frame rather than a hand holding the
 * camera.
 */
function valueNoise(t, seed) {
  const x = Math.floor(t);
  const f = t - x;
  const h = (i) => {
    const v = Math.sin((i + seed * 37.7) * 12.9898) * 43758.5453;
    return v - Math.floor(v);
  };
  const a = h(x), b = h(x + 1);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}

/** Deterministic, *smooth* handheld sway. Rate is in lattice points per second. */
export function shake(t, amp = 3, seed = 1, rate = 1.6) {
  const x = valueNoise(t * rate, seed) - 0.5;
  const y = valueNoise(t * rate + 11.3, seed + 5.1) - 0.5;
  return [x * 2 * amp, y * 2 * amp];
}

// ---------------------------------------------------------------- camera ----

/**
 * The camera. Applied once per shot around the whole scene, so every scene
 * inherits it — including the ones that were written before this existed.
 *
 * Shot spec (all optional):
 *   camera:  'push' | 'pull' | 'panL' | 'panR' | 'driftUp' | 'driftDown'
 *          | 'tiltUp' | 'tiltDown' | 'rollCW' | 'rollCCW' | 'arc' | 'none'
 *   cameraAmount: 0.02 .. 0.25   how far it travels over the shot (default 0.09)
 *   cameraEase:  'linear' | 'inOutQuad' | 'outCubic'  (default inOutQuad)
 *   focus: [x, y]                what the move centres on (default frame centre)
 *   handheld: 0 .. 6             px of smooth sway (default 0 — opt in)
 */
/**
 * The camera vocabulary, in one place: `doctor` and the docs both read it, so a
 * move cannot exist in the engine and be missing from the list a storyboard is
 * checked against.
 */
export const CAMERA_MOVES = [
  'push', 'pull', 'panL', 'panR', 'driftUp', 'driftDown',
  'tiltUp', 'tiltDown', 'rollCW', 'rollCCW', 'arc', 'none',
];

export class Camera {
  constructor(width = 1920, height = 1080) {
    this.w = width;
    this.h = height;
    this.state = { scale: 1, x: 0, y: 0, sx: 0, sy: 0 };
  }

  /** Compute the transform for this frame, without touching the canvas. */
  sample(shot, t, f) {
    const w = this.w, h = this.h;
    const since = Math.max(0, t - shot.start);
    const dur = Math.max(0.001, shot.end - shot.start);
    const move = shot.camera ?? 'push';
    const amount = shot.cameraAmount ?? 0.09;
    const easeFn = ease[shot.cameraEase ?? 'inOutQuad'] ?? ease.inOutQuad;
    const k = easeFn(clamp01(since / dur));

    let scale = 1, x = 0, y = 0, roll = 0;
    if (move === 'push') scale = 1 + amount * k;
    else if (move === 'pull') scale = 1 + amount - amount * k;
    else if (move === 'panL') x = (amount * w) * (0.5 - k);
    else if (move === 'panR') x = (amount * w) * (k - 0.5);
    else if (move === 'driftUp') y = (amount * h) * (0.5 - k);
    else if (move === 'driftDown') y = (amount * h) * (k - 0.5);
    // A tilt is a drift plus a slight scale: craning up without a scale change
    // leaves the top edge of the set visible.
    else if (move === 'tiltUp') { y = (amount * h * 0.75) * (0.5 - k); scale = 1 + amount * 0.35 * k; }
    else if (move === 'tiltDown') { y = (amount * h * 0.75) * (k - 0.5); scale = 1 + amount * 0.35 * (1 - k * 0.5); }
    // Roll is the dutch angle: a couple of degrees, never more.
    else if (move === 'rollCW') { roll = (shot.cameraRoll ?? 0.035) * (2 * k - 1); scale = 1.07; }
    else if (move === 'rollCCW') { roll = -(shot.cameraRoll ?? 0.035) * (2 * k - 1); scale = 1.07; }
    // Arc: a shallow orbit — pan and drift at the same time, which reads as
    // the camera walking around the subject.
    else if (move === 'arc') {
      x = (amount * w * 0.6) * (k - 0.5);
      y = (amount * h * 0.35) * (0.5 - Math.sin(k * Math.PI) * 0.5 - k * 0.5);
      scale = 1 + amount * 0.9;
    }

    // keep the frame covered when panning or scaling
    if (scale !== 1) {
      scale = Math.max(scale, 1);
    } else {
      const margin = 1 + amount * 2;
      scale = margin;
    }

    // beat punch: a small kick on downbeats, not on every onset
    if (shot.loud) {
      const p = f?.downPulse ?? 0;
      scale *= 1 + p * 0.035;
    }

    // Off unless a shot asks for it: any constant sway on a locked-off frame
    // reads as a rendering fault, not as a camera operator.
    const amp = shot.handheld ?? 0;
    const [sx, sy] = amp > 0 ? shake(t, amp, 3, 1.4) : [0, 0];

    // Move the focus point toward the centre of the frame.
    const [fx, fy] = shot.focus ?? [w / 2, h / 2];
    const cx = w / 2, cy = h / 2;
    const ox = (cx - fx) * (scale - 1);
    const oy = (cy - fy) * (scale - 1);

    this.state = { scale, x: x + ox + sx, y: y + oy + sy, sx, sy, roll };
    return this.state;
  }

  /** Push the transform onto the canvas. Always paired with end(). */
  begin(g, shot, t, f) {
    const st = this.sample(shot, t, f);
    g.save();
    g.translate(this.w / 2 + st.x, this.h / 2 + st.y);
    if (st.roll) g.rotate(st.roll);
    g.scale(st.scale, st.scale);
    g.translate(-this.w / 2, -this.h / 2);
    return st;
  }

  end(g) {
    g.restore();
  }

  /**
   * Parallax offset for a layer at depth k (0 = far, 1 = near).
   * Scenes use it so background and foreground separate as the camera moves.
   */
  depth(k = 0.5) {
    const st = this.state;
    const pull = (1 - st.scale) * 400; // negative while zooming in
    return { x: -st.sx * k, y: -st.sy * k - pull * k * 0.35 };
  }
}

// ----------------------------------------------------------------- masks ----

/**
 * Draw-on reveal: grows a clip rect from `amount` 0→1. Use inside save/restore.
 */
export function clipReveal(g, t, t0, dur, rect, dir = 'up') {
  const k = rampE(t, t0, dur, ease.inOutCubic);
  if (k <= 0) return false;
  const [x, y, w, h] = rect;
  g.save();
  g.beginPath();
  if (dir === 'up') g.rect(x, y + h * (1 - k), w, h * k);
  else if (dir === 'down') g.rect(x, y, w, h * k);
  else if (dir === 'left') g.rect(x + w * (1 - k), y, w * k, h);
  else g.rect(x, y, w * k, h);
  g.clip();
  return true;
}

/** Horizontal blinds, useful as a cut, a wipe, or a lyric reveal. */
export function blinds(g, p, t, t0, { count = 14, color = null, alpha = 0.9, dir = 1 } = {}) {
  const k = rampE(t, t0, 0.7, ease.inOutCubic);
  if (k <= 0 || k >= 1) return;
  const h = 1080 / count;
  g.save();
  g.fillStyle = color ?? p.bg;
  g.globalAlpha = alpha * (1 - k);
  for (let i = 0; i < count; i++) {
    const off = (i % 2 === 0 ? 1 : -1) * dir * (1 - k) * 40;
    g.fillRect(0, i * h + off, 1920, h * 0.86);
  }
  g.restore();
}

// ---------------------------------------------------------------- layers ----

/**
 * A wrapping scroll offset for a texture layer. `speed` is px/second, so the
 * texture never repeats on a fixed beat and never jumps at the wrap point.
 */
export function scroll(t, speed, period) {
  const v = (t * speed) % period;
  return v < 0 ? v + period : v;
}
