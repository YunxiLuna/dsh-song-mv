// Core: palettes, audio-feature accessor, lyrics, canvas context, and the
// storyboard-driven engine. Everything here is a pure function of song time.
import { createCanvas } from 'canvas';
import fs from 'node:fs';
import { SCENES, SCENE_META } from './scenes.mjs';
import { hexA } from './story_fx.mjs';

function clamp(x, lo = 0, hi = 1) { return Math.max(lo, Math.min(hi, x)); }
function pulse(since, decay) { return Math.exp(-decay * Math.max(0, since)); }

// ---------- Palettes -------------------------------------------------------------
// Colour is STATE, not decoration: each shot names a state, never raw hex.
export const PALETTES = {
  still:   { bg:'#141821', panel:'#1e232f', raised:'#2a3242', line:'#3a4358', text:'#e2e8f2',
             sub:'#708090', mute:'#4a5468', accent:'#5e6a80', accentHot:'#6e90f8',
             accentDim:'#4a60d0', glow:0.5, sat:0.9 },
  tender:  { bg:'#181a26', panel:'#222538', raised:'#303550', line:'#454e6e', text:'#f0eadf',
             sub:'#9088a0', mute:'#5e5c70', accent:'#b06060', accentHot:'#e09080',
             accentDim:'#7a4848', glow:0.7, sat:1.0 },
  build:   { bg:'#1c1c30', panel:'#282650', raised:'#3c3868', line:'#504a80', text:'#f8f0ff',
             sub:'#a09cc0', mute:'#6e68a0', accent:'#8878ff', accentHot:'#b8a0ff',
             accentDim:'#6050d0', glow:0.85, sat:1.1 },
  release: { bg:'#221a38', panel:'#362a58', raised:'#503a75', line:'#7055a0', text:'#ffffff',
             sub:'#c0b0dd', mute:'#8878b0', accent:'#ff6aa0', accentHot:'#ffa0d0',
             accentDim:'#c03878', glow:1.15, sat:1.35 },
  intense: { bg:'#281a40', panel:'#3c2858', raised:'#584080', line:'#8868b0', text:'#fff8f0',
             sub:'#e0c8dd', mute:'#a878b0', accent:'#ff4870', accentHot:'#ff88b0',
             accentDim:'#d02850', glow:1.4, sat:1.5 },
  peak:    { bg:'#2e1e48', panel:'#403058', raised:'#604a80', line:'#9078b8', text:'#ffffff',
             sub:'#f0d8e8', mute:'#b888b8', accent:'#ffd848', accentHot:'#ffe880',
             accentDim:'#d89818', glow:1.65, sat:1.6 },
  dawn:    { bg:'#1a1614', panel:'#262019', raised:'#3a2f22', line:'#54432f', text:'#ffe8cc',
             sub:'#c0a080', mute:'#7a6450', accent:'#e08a3c', accentHot:'#ffc46a',
             accentDim:'#a85e22', glow:0.95, sat:1.1 },
  fade:    { bg:'#0e0e14', panel:'#16161e', raised:'#202030', line:'#2c2c3a', text:'#6a6a78',
             sub:'#4a4a55', mute:'#383844', accent:'#4a4a5e', accentHot:'#5a5a70',
             accentDim:'#3a3a48', glow:0.25, sat:0.55 },
};

export function pal(state) { return PALETTES[state] || PALETTES.still; }

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
  }
  apply(src, fx) {
    const g = this.g2, c = this.canvas;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(src, 0, 0);

    const vg = g.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.45, c.width / 2, c.height / 2, c.height * 0.9);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.30)');
    g.fillStyle = vg;
    g.fillRect(0, 0, c.width, c.height);

    const scan = fx.scan ?? this.cfg.post?.scan ?? 0.03;
    if (scan > 0) {
      g.fillStyle = `rgba(0,0,0,${scan})`;
      for (let y = 0; y < c.height; y += 4) g.fillRect(0, y, c.width, 1);
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
      scan: cfg.post?.scan ?? 0.03,
      flash: 0,
      rgbSplit: f.onsetPulse > 0.5 ? f.onsetPulse * 6 : 0,
    });
    return canvas;
  }

  return { canvas, renderFrame, features: feats, lyrics: lyr, shots, duration: feats.duration };
}
