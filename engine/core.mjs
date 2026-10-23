// Core: palettes, audio-feature accessor, lyrics, canvas context, and the
// storyboard-driven engine. Everything here is a pure function of song time.
import { createCanvas } from 'canvas';
import fs from 'node:fs';
import { SCENES, SCENE_META } from './scenes.mjs';
import { hexA } from './story_fx.mjs';

function clamp(x, lo = 0, hi = 1) { return Math.max(lo, Math.min(hi, x)); }
function pulse(since, decay) { return Math.exp(-decay * Math.max(0, since)); }

// ---------- Palettes -------------------------------------------------------------
// Colour is STATE, not decoration: a shot names a state (still, peak, …) and the
// active *look* decides what that state looks like. Swap the look and the whole
// video changes world without touching a scene.
import { getLook, LOOKS, DEFAULT_LOOK, LOOK_IDS } from './looks.mjs';

let ACTIVE_LOOK = getLook(DEFAULT_LOOK);

/** Switch the colour world. Called by createEngine() from storyboard.look. */
export function setLook(id) {
  ACTIVE_LOOK = getLook(id);
  return ACTIVE_LOOK;
}
export function activeLook() { return ACTIVE_LOOK; }

/** Default look's states, kept as an export for scripts that predate looks. */
export const PALETTES = getLook(DEFAULT_LOOK).states;

export function pal(state) { return ACTIVE_LOOK.states[state] || ACTIVE_LOOK.states.still; }

function hexRgb(h) { return h.match(/^#(..)(..)(..)$/).slice(1).map((v) => parseInt(v, 16)); }
function mixHex(a, b, k) {
  const A = hexRgb(a), B = hexRgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('');
}
export function mixPal(a, b, k) {
  const A = pal(a), B = pal(b);
  if (k <= 0) return { ...A, _state: a };
  if (k >= 1) return { ...B, _state: b };
  const out = { _state: `${a}>${b}`, glow: A.glow + (B.glow - A.glow) * k, sat: A.sat + (B.sat - A.sat) * k };
  for (const key of Object.keys(A)) {
    if (typeof A[key] === 'string' && A[key].startsWith('#')) out[key] = mixHex(A[key], B[key], k);
  }
  return out;
}

// ---------- Audio feature accessor -----------------------------------------------
export class Features {
  constructor(data, cfg = {}) {
    this.d = data;
    this.bpm = data.bpm;
    this.period = data.grid.period;
    this.t0 = data.grid.t0;
    this.downPhase = data.downbeatPhase ?? 0;
    this.n = data.meta.frames;
    this.fps = data.meta.fps;
    this.duration = data.meta.duration;
    this.nb = data.meta.spectrumBands;
    this.spec = Uint8Array.from(data.spectrum);
    this.onT = data.onsets.t;
    this.onS = data.onsets.s;
    this.rms = data.rms; this.low = data.low; this.mid = data.mid; this.high = data.high;
    this.r = cfg.reactive || { beatDecay: 6, onsetDecay: 9, strongOnset: 0.35 };
  }
  series(name, t) {
    const a = this.d[name], x = clamp(t * this.fps, 0, this.n - 1);
    const i = Math.floor(x), k = x - i, j = Math.min(i + 1, this.n - 1);
    return a[i] * (1 - k) + a[j] * k;
  }
  env(name, t, release = 8, windowSec = 0.5) {
    const a = this.d[name], end = Math.floor(clamp(t * this.fps, 0, this.n - 1));
    const start = Math.max(0, end - Math.ceil(windowSec * this.fps));
    let m = 0;
    for (let i = start; i <= end; i++) {
      const v = a[i] * Math.exp(-release * (t - i / this.fps));
      if (v > m) m = v;
    }
    return Math.max(m, this.series(name, t));
  }
  beatTime(i) { return this.t0 + i * this.period; }
  beatIndex(t) { return Math.floor((t - this.t0) / this.period + 1e-6); }
  barTime(n) { return this.beatTime(this.downPhase + 4 * n); }
  barIndex(t) { const rel = this.beatIndex(t) - this.downPhase; return Math.floor(rel / 4); }
  snapToBeat(t, tol = 0.09) {
    const b = this.beatTime(Math.round((t - this.t0) / this.period));
    return Math.abs(b - t) <= tol ? b : t;
  }
  onsetIndex(t) {
    let lo = 0, hi = this.onT.length - 1, r = -1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (this.onT[m] <= t) { r = m; lo = m + 1; } else hi = m - 1; }
    return r;
  }
  sample(t) {
    const tt = Math.max(0, t);
    const beat = this.beatIndex(tt);
    const sinceBeat = tt - this.beatTime(beat);
    const rel = beat - this.downPhase;
    const bar = Math.floor(rel / 4);
    const beatInBar = ((rel % 4) + 4) % 4;
    const sinceBar = tt - this.barTime(bar);
    const started = tt >= this.t0;
    const oi = this.onsetIndex(tt);
    const sinceOnset = oi >= 0 ? tt - this.onT[oi] : 1e9;
    const onsetStrength = oi >= 0 ? this.onS[oi] : 0;
    return {
      t: tt,
      period: this.period,
      rms: this.series('rms', tt), low: this.series('low', tt),
      mid: this.series('mid', tt), high: this.series('high', tt),
      lowEnv: this.env('low', tt, 7), rmsEnv: this.env('rms', tt, 5),
      beat, beatPhase: sinceBeat / this.period, sinceBeat,
      bar, beatInBar, sinceBar,
      beatPulse: started ? pulse(sinceBeat, this.r.beatDecay) : 0,
      barPulse: started ? pulse(sinceBar, this.r.beatDecay * 0.6) : 0,
      onsetStrength, onsetPulse: onsetStrength * pulse(sinceOnset, this.r.onsetDecay),
      downPulse: started && beatInBar === 0 ? pulse(sinceBar, this.r.beatDecay * 0.8) : 0,
      spec: this.spec, fps: this.fps, nb: this.nb,
    };
  }
}

// ---------- Lyrics ----------------------------------------------------------------
export function parseLrc(path) {
  const lines = [];
  for (const raw of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    // Timestamps are [mm:ss.xx]. Lyric editors write anywhere from one to three
    // fractional digits, so accept all of them and scale by magnitude.
    const m = raw.trim().match(/^\[(\d{1,3}):(\d{2})\.(\d{1,3})\](.*)$/);
    if (m) {
      const frac = +m[3] / Math.pow(10, m[3].length);
      lines.push({ t: +m[1] * 60 + +m[2] + frac, text: m[4].trim() });
    }
  }
  return lines.sort((a, b) => a.t - b.t);
}

export class Lyrics {
  constructor(data) { this.lines = data; }
  activeAt(t) {
    let cur = null, next = null;
    for (const L of this.lines) {
      if (L.t <= t) cur = L; else { next = L; break; }
    }
    return { cur, next };
  }
  lineAge(t) {
    const { cur } = this.activeAt(t);
    return cur ? t - cur.t : -1;
  }
}

// ---------- 2D context wrapper -----------------------------------------------------
export class Ctx2D {
  constructor(canvas, cfg) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.cfg = cfg;
    this.pal = pal('still');
  }
  setPal(name) {
    this.pal = typeof name === 'string' ? pal(name) : name;
    this._state = name;
  }
  begin(tv, f, t, fx) { this.tv = tv; this.f = f; this.t = t; this.fx = fx; }
  clear() {
    const g = this.g, p = this.pal;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = p.bg;
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
  glowCircle(x, y, r, color, strength) {
    if (strength <= 0.003) return;
    const g = this.g;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, hexA(color, strength));
    grad.addColorStop(1, hexA(color, 0));
    g.fillStyle = grad;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  measure(str, o = {}) {
    this.g.font = `${o.weight || 400} ${o.size || 32}px ${o.font || "Inter, 'Segoe UI', system-ui, sans-serif"}`;
    return this.g.measureText(str);
  }
}

// ---------- Post (canvas-2d) --------------------------------------------------------
export class Post2D {
  constructor(canvas, cfg) {
    this.canvas = canvas;
    this.cfg = cfg;
    this.off = createCanvas(canvas.width, canvas.height);
    this.g2 = this.off.getContext('2d');
    // A 256 px noise tile, repeated. Cheaper than per-pixel work every frame.
    this.noise = createCanvas(256, 256);
    const ng = this.noise.getContext('2d');
    const img = ng.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ng.putImageData(img, 0, 0);
    this.noisePattern = this.g2.createPattern(this.noise, 'repeat');
  }
  apply(src, fx) {
    const g = this.g2, c = this.canvas;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(src, 0, 0);

    // Vignette colour comes from the look: black corners would wreck a paper world.
    const vig = fx.vignette === false ? null
      : (fx.vignette ?? this.cfg.post?.vignette ?? { color: '#000000', alpha: 0.3 });
    if (vig) {
      const vg = g.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.42,
        c.width / 2, c.height / 2, c.height * 0.92);
      vg.addColorStop(0, hexA(vig.color, 0));
      vg.addColorStop(1, hexA(vig.color, vig.alpha));
      g.fillStyle = vg;
      g.fillRect(0, 0, c.width, c.height);
    }

    const scan = fx.scan ?? this.cfg.post?.scan ?? 0.03;
    if (scan > 0) {
      g.fillStyle = `rgba(0,0,0,${scan})`;
      for (let y = 0; y < c.height; y += 4) g.fillRect(0, y, c.width, 1);
    }

    const grain = fx.grain ?? this.cfg.post?.grain ?? 0;
    if (grain > 0) {
      g.globalCompositeOperation = 'overlay';
      g.globalAlpha = grain * 3;
      g.fillStyle = this.noisePattern;
      g.fillRect(0, 0, c.width, c.height);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }

    const flash = Math.min(fx.flash ?? 0, this.cfg.safety?.maxFlash ?? 0.7);
    if (flash > 0) {
      g.fillStyle = hexA(fx.flashColor ?? '#ffffff', flash);
      g.fillRect(0, 0, c.width, c.height);
    }
    g.drawImage(this.off, 0, 0, c.width, c.height);
  }
}

function punchScale(f, amount = 0.045) {
  return 1 + amount * (f.beatPulse * 0.7 + f.onsetPulse * 0.55);
}

// ---------- Storyboard -> shots -----------------------------------------------------
export function shotsFromStoryboard(storyboard) {
  const shots = [];
  const list = storyboard.shots || [];
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const type = s.scene?.type;
    if (!SCENES[type]) throw new Error(`unknown scene type "${type}" in shot ${s.id ?? i}; known: ${Object.keys(SCENES).join(', ')}`);
    const params = { start: s.start, ...(s.scene.params || {}) };
    shots.push({
      id: s.id || `shot${String(i + 1).padStart(2, '0')}`,
      type,
      start: s.start,
      end: s.end,
      palette: s.palette || SCENE_META[type]?.palette || 'still',
      paletteFrom: s.paletteFrom || null,
      enter: s.enter || SCENE_META[type]?.enter || 'cut',
      loud: s.loud ?? ['stampScene', 'erase', 'voidScene'].includes(type),
      params,
      render: (ctx, tv, f) => SCENES[type](ctx, tv, f, params),
    });
  }
  shots.sort((a, b) => a.start - b.start);
  return shots;
}

// ---------- Top-level engine -------------------------------------------------------
export function createEngine({ cfg, features, storyboard, lrc }) {
  const width = cfg.render?.width ?? 1920;
  const height = cfg.render?.height ?? 1080;
  const feats = new Features(features, cfg);
  const lyr = new Lyrics(typeof lrc === 'string' ? parseLrc(lrc) : lrc || []);
  const canvas = createCanvas(width, height);
  const ctx = new Ctx2D(canvas, cfg);
  const post = new Post2D(canvas, cfg);
  // Scenes read shared state off the context; nothing is module-global.
  ctx.lyr = lyr;
  ctx.feats = feats;
  ctx.cfg = cfg;

  // A storyboard names its world; the look supplies palettes and post defaults.
  const look = setLook(storyboard.look || cfg.look || DEFAULT_LOOK);

  const shots = shotsFromStoryboard(storyboard);

  if (!shots.length) throw new Error('storyboard has no shots');

  function shotAt(t) {
    let active = shots[0];
    for (const s of shots) if (t >= s.start && t < s.end) { active = s; return active; }
    return t < shots[0].start ? shots[0] : shots[shots.length - 1];
  }

  function renderFrame(t) {
    const f = feats.sample(t);
    const active = shotAt(t);
    const prev = shots[Math.max(0, shots.indexOf(active) - 1)];

    // Palette: hard switch, or cross-fade from the previous shot's state.
    const sinceIn = t - active.start;
    if (active.paletteFrom && sinceIn < 0.9) {
      ctx.setPal(mixPal(active.paletteFrom, active.palette, clamp(sinceIn / 0.9)));
    } else {
      ctx.setPal(active.palette);
    }
    ctx.begin(t, f, t, {});
    ctx.clear();

    if (active.loud) {
      const g = ctx.g;
      const sc = punchScale(f, 0.035);
      g.save();
      g.translate(width / 2, height / 2); g.scale(sc, sc); g.translate(-width / 2, -height / 2);
      active.render(ctx, t, f);
      g.restore();
    } else {
      active.render(ctx, t, f);
    }

    // Shot entry: dissolve from black / glitch tear
    if (active.enter === 'dissolve' && sinceIn < 0.45) {
      ctx.g.fillStyle = `rgba(0,0,0,${1 - sinceIn / 0.45})`;
      ctx.g.fillRect(0, 0, width, height);
    }
    if (active.enter === 'glitch' && sinceIn < 0.22) {
      const g = ctx.g;
      for (let i = 0; i < 6; i++) {
        const y = (i * 197 + Math.floor(t * 60) * 31) % (height - 40);
        const h = 20 + ((i * 37) % 70);
        try {
          const img = g.getImageData(0, y, width, h);
          g.putImageData(img, ((i % 3) - 1) * 90, y);
        } catch { /* headless canvas without readback */ }
      }
    }

    post.apply(canvas, {
      scan: cfg.post?.scan ?? look.scan,
      grain: cfg.post?.grain ?? look.grain,
      vignette: cfg.post?.vignette ?? look.vignette,
      flash: 0,
      rgbSplit: f.onsetPulse > 0.5 ? f.onsetPulse * 6 : 0,
    });
    return canvas;
  }

  return { canvas, renderFrame, features: feats, lyrics: lyr, shots, look, duration: feats.duration };
}
