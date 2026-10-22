// story_fx.mjs — narrative props ("story-bearing content") and lyric treatments.
//
// Everything in here is a PURE function of song time t: no wall clock, no
// frame-to-frame state, seeded PRNG only. Scenes compose these props to tell a
// story: a burned-out office worker at 2 AM, an inbox that will not stop, a
// floor plan being erased. None of the copy is baked in — every string is a
// parameter.
import { mulberry32 } from './prng.mjs';

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const easeOut = (k) => 1 - Math.pow(1 - clamp01(k), 3);
const easeInOut = (k) => {
  k = clamp01(k);
  return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
};
const lerp = (a, b, k) => a + (b - a) * k;

/** hex + alpha (0..1). Palettes are always 6-digit hex. */
export function hexA(hex, a) {
  return hex + Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0');
}

function hash01(i, salt = 0) {
  let h = (i * 374761393 + salt * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

// =============================================================================
// TEXT: upgraded lyric treatment
// =============================================================================

/**
 * Kinetic type: every word is its own moving object. Words smash in on their
 * own stagger with scale + rotation + afterimage ghost, then breathe with the
 * beat. This is the "big MV" look — not one uniform fade for the whole line.
 *
 * opts: { size, weight, font, color, hot, ghost, step, stagger, rotation,
 *         settle, beatsPerWord, punch }
 */
export function kinetic(g, str, cx, cy, t, t0, opts = {}) {
  const {
    size = 110, weight = 900, font = "Inter, 'Segoe UI', sans-serif",
    color = '#ffffff', hot = '#ffd848', ghost = null,
    step = 0.17, settle = 0.26, rotJit = 0.07, punch = 1.0,
    align = 'center', maxW = 1720,
  } = opts;
  const words = str.split(' ').filter((w) => w.length);
  if (!words.length) return;

  g.save();
  // Fit: shrink the type until the whole line fits inside maxW.
  let sz = size;
  let gap = sz * 0.26;
  g.font = `${weight} ${sz}px ${font}`;
  let widths = words.map((w) => g.measureText(w).width);
  let totalW = widths.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
  if (totalW > maxW) {
    sz = Math.max(28, sz * (maxW / totalW));
    gap = sz * 0.26;
    g.font = `${weight} ${sz}px ${font}`;
    widths = words.map((w) => g.measureText(w).width);
    totalW = widths.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
  }
  let x = align === 'center' ? cx - totalW / 2 : cx;
  g.textAlign = 'left';
  g.textBaseline = 'middle';

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const ti = t0 + i * step;
    const age = t - ti;
    if (age >= 0) {
      const k = clamp01(age / settle);
      // Elastic overshoot: 1.9 -> 1.0
      const ek = 1 - Math.pow(1 - k, 3);
      const sc = (1.9 + (1 - 1.9) * ek) * (1 + 0.05 * punch * Math.pow(1 - k, 3));
      const jitter = (hash01(i * 7 + Math.floor(t0 * 100)) - 0.5) * 2;
      const rot = jitter * rotJit * (1 - ek);
      const dy = (1 - ek) * -34;

      g.save();
      g.translate(x, cy + dy);
      g.rotate(rot);
      g.scale(sc * punch, sc * punch);
      // Afterimage ghosts (2 offsets, fading)
      if (ghost) {
        for (let gi = 1; gi <= 2; gi++) {
          g.globalAlpha = 0.20 * (1 - k) * (gi === 1 ? 1 : 0.55);
          g.fillStyle = ghost;
          g.fillText(w, gi * 7, gi * 3);
        }
      }
      g.globalAlpha = 0.35 + 0.65 * k;
      g.fillStyle = k < 0.85 ? hot : color;
      g.fillText(w, 0, 0);
      g.restore();
    }
    x += widths[i] + gap;
  }
  g.restore();
}

/** RGB-split glitch text: red/cyan channel offsets, used on strong onsets. */
export function rgbSplitText(g, str, cx, cy, size, opts = {}) {
  const {
    split = 10, weight = 900, font = "Inter, 'Segoe UI', sans-serif",
    color = '#ffffff', alpha = 1, align = 'center',
  } = opts;
  g.save();
  g.font = `${weight} ${size}px ${font}`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.globalAlpha = alpha * 0.85;
  g.fillStyle = '#ff2d55';
  g.fillText(str, cx - split, cy);
  g.fillStyle = '#00e5ff';
  g.fillText(str, cx + split, cy);
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.fillText(str, cx, cy);
  g.restore();
}

/** Rubber stamp: rotated, ink-mottled, slams down then holds. */
export function stamp(g, str, x, y, t, t0, opts = {}) {
  const {
    size = 120, rot = -0.18, color = '#ff3b5c', weight = 900,
    font = "Inter, 'Arial Black', sans-serif", frame = true,
    padding = 26, dur = 0.18, alpha = 1, holes = 22,
  } = opts;
  const age = t - t0;
  if (age < 0) return;
  const k = clamp01(age / dur);
  const sc = lerp(2.4, 1, easeOut(k));
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(sc, sc);
  g.globalAlpha = alpha * Math.min(1, k * 2.5);
  g.font = `${weight} ${size}px ${font}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const w = g.measureText(str).width;
  if (frame) {
    g.strokeStyle = color;
    g.lineWidth = 8;
    g.beginPath();
    g.roundRect(-w / 2 - padding, -size * 0.78, w + padding * 2, size * 1.56, 10);
    g.stroke();
  }
  // Ink: mottled fill (holes = un-inked patches, deterministic)
  g.fillStyle = color;
  g.fillText(str, 0, 0);
  if (holes > 0) {
    const prng = mulberry32(Math.floor(t0 * 997) + 13);
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < holes; i++) {
      const hx = (prng() - 0.5) * (w + padding * 2);
      const hy = (prng() - 0.5) * size * 1.4;
      g.beginPath();
      g.arc(hx, hy, 0.8 + prng() * 2.2, 0, Math.PI * 2);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();
}

/** Manga speed lines radiating from a point. */
export function speedLines(g, cx, cy, t, intensity, color, seed = 0, opts = {}) {
  if (intensity <= 0.02) return;
  const { n = 90, rMin = 260, rMax = 1500, width = 3 } = opts;
  const prng = mulberry32(seed);
  g.save();
  g.strokeStyle = color;
  g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = prng() * Math.PI * 2;
    const jitter = prng();
    const r0 = rMin + jitter * 220;
    const r1 = rMax * (0.55 + prng() * 0.45);
    g.globalAlpha = intensity * (0.10 + prng() * 0.28);
    g.lineWidth = width * (0.5 + prng());
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
    g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
    g.stroke();
  }
  g.restore();
}

/** Word-by-word pop: each word scales up on its own beat then settles. */
export function popWords(g, str, cx, cy, t, t0, opts = {}) {
  const {
    size = 96, weight = 900, font = "Inter, sans-serif",
    color = '#ffffff', hot = '#ffd848', perWord = 0.34, align = 'center',
    maxW = 1720,
  } = opts;
  const words = str.split(' ').filter(Boolean);
  g.save();
  let sz = size;
  let gap = sz * 0.24;
  g.font = `${weight} ${sz}px ${font}`;
  let widths = words.map((w) => g.measureText(w).width);
  let totalW = widths.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
  if (totalW > maxW) {
    sz = Math.max(28, sz * (maxW / totalW));
    gap = sz * 0.24;
    g.font = `${weight} ${sz}px ${font}`;
    widths = words.map((w) => g.measureText(w).width);
    totalW = widths.reduce((a, b) => a + b, 0) + gap * (words.length - 1);
  }
  let x = align === 'center' ? cx - totalW / 2 : cx;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  for (let i = 0; i < words.length; i++) {
    const ti = t0 + i * perWord;
    const age = t - ti;
    if (age >= 0) {
      const k = clamp01(age / 0.22);
      const pop = 1 + 0.7 * Math.pow(1 - k, 2);
      g.save();
      g.translate(x, cy);
      g.scale(pop, pop);
      g.globalAlpha = 0.3 + 0.7 * k;
      g.fillStyle = k < 0.7 ? hot : color;
      g.fillText(words[i], 0, 0);
      g.restore();
    }
    x += widths[i] + gap;
  }
  g.restore();
}

/** Broken-neon flicker text. */
export function neonFlicker(g, str, x, y, t, opts = {}) {
  const {
    size = 64, weight = 800, font = "Inter, sans-serif",
    color = '#ffffff', glow = '#ff4d7d', align = 'center',
  } = opts;
  // Deterministic flicker: mostly on, occasional dropouts
  const bucket = Math.floor(t * 24);
  const r = hash01(bucket, 7);
  const on = r > 0.12 ? 1 : (r > 0.04 ? 0.45 : 0.1);
  g.save();
  g.font = `${weight} ${size}px ${font}`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.globalAlpha = on;
  g.shadowColor = glow;
  g.shadowBlur = 26;
  g.fillStyle = color;
  g.fillText(str, x, y);
  g.shadowBlur = 0;
  g.restore();
}

/** Scrolling marquee ticker (news-crawl style bar). */
export function ticker(g, text, x, y, w, h, t, opts = {}) {
  const {
    size = 34, weight = 600, font = "Inter, sans-serif",
    bg = '#000000', fg = '#ffffff', speed = 150, alpha = 1, label = null,
  } = opts;
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = bg;
  g.fillRect(x, y, w, h);
  g.font = `${weight} ${size}px ${font}`;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  let startX = x;
  if (label) {
    const lw = g.measureText(label).width + 34;
    g.save();
    g.beginPath(); g.rect(x, y, lw, h); g.clip();
    g.fillStyle = fg;
    g.fillRect(x, y, lw, h);
    g.fillStyle = bg;
    g.fillText(label, x + 17, y + h / 2);
    g.restore();
    startX = x + lw;
    g.fillStyle = fg;
  }
  // Text scrolls only inside the region to the right of the label.
  g.save();
  g.beginPath(); g.rect(startX, y, w - (startX - x), h); g.clip();
  const tw = g.measureText(text + '    ').width;
  const span = (w - (startX - x)) + tw;
  const off = (t * speed) % span;
  g.fillStyle = fg;
  for (let k = 0; k < Math.ceil(span / tw) + 2; k++) {
    g.fillText(text, startX - off + k * tw, y + h / 2);
  }
  g.restore();
  g.restore();
}

// =============================================================================
// STORY PROP 1: the keyboard at 2 AM
// =============================================================================

/** Receding grid of keycaps (the infinite keyboard of the night). */
export function keyGrid(g, p, t, f, opts = {}) {
  const { rows = 9, cols = 22, topY = 300, bottomY = 1180, alpha = 0.5 } = opts;
  g.save();
  for (let r = 0; r < rows; r++) {
    const k = r / (rows - 1);
    const y = lerp(topY, bottomY, k * k);
    const capW = lerp(34, 128, k * k);
    const capH = capW * 0.62;
    const rowAlpha = alpha * (0.18 + 0.82 * k);
    for (let c = 0; c < cols; c++) {
      const spread = lerp(0.35, 1.0, k);
      const x = 960 + (c - (cols - 1) / 2) * (capW * 1.12) * spread;
      if (x < -capW || x > 1920 + capW) continue;
      const pulse2 = 0.5 + 0.5 * Math.sin(t * 1.4 + c * 0.31 + r * 0.7);
      const hot = hash01(r * 31 + c, 5) > 0.94 ? 0.8 + 0.2 * pulse2 : 0;
      g.fillStyle = hot > 0 ? hexA(p.accentHot, rowAlpha * 0.5 * hot) : hexA(p.raised, rowAlpha * 0.55);
      g.strokeStyle = hexA(p.line, rowAlpha * 0.7);
      g.lineWidth = 1.4;
      g.beginPath();
      g.roundRect(x - capW / 2, y, capW, capH, capW * 0.16);
      g.fill();
      g.stroke();
    }
  }
  g.restore();
}

/** One giant lit key, pressed on the beat, with a shockwave ring. */
export function giantKey(g, p, t, f, opts = {}) {
  const { cx = 960, cy = 470, w = 620, h = 360, label = 'delete', press = 1 } = opts;
  const beatK = f.beatPulse;
  const depth = beatK * 14 * press;
  const x = cx - w / 2;
  const y = cy - h / 2 + depth;

  // Halo
  g.save();
  const halo = g.createRadialGradient(cx, cy, 0, cx, cy, w * 0.95);
  halo.addColorStop(0, hexA(p.accentHot, 0.28 + beatK * 0.30));
  halo.addColorStop(0.55, hexA(p.accent, 0.10 + beatK * 0.12));
  halo.addColorStop(1, hexA(p.accent, 0));
  g.fillStyle = halo;
  g.fillRect(0, 0, 1920, 1080);

  // Key body (two-tone gives it a 3D lip)
  g.fillStyle = hexA(p.raised, 0.98);
  g.strokeStyle = hexA(p.accentHot, 0.55 + beatK * 0.45);
  g.lineWidth = 3 + beatK * 3;
  g.beginPath(); g.roundRect(x, y, w, h, 26); g.fill(); g.stroke();
  g.fillStyle = hexA(p.panel, 0.9);
  g.beginPath(); g.roundRect(x + 10, y + 10, w - 20, h - 20, 20); g.fill();

  // Label
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '900 132px Inter, "Arial Black", sans-serif';
  g.fillStyle = hexA(p.text, 0.95);
  g.fillText(label, cx, cy + 6);

  // Shockwave rings on the beat
  const ringK = clamp01(f.sinceBeat / (f.period ?? 0.56));
  if (ringK < 1) {
    const rr = lerp(w * 0.5, w * 1.6, ringK);
    g.strokeStyle = hexA(p.accentHot, (1 - ringK) * 0.6);
    g.lineWidth = 6 * (1 - ringK) + 1;
    g.beginPath(); g.roundRect(cx - rr, cy - rr * 0.58, rr * 2, rr * 1.16, 40); g.stroke();
  }
  // Small click sparks
  if (beatK > 0.25) {
    const prng = mulberry32(Math.floor(t * 30));
    for (let i = 0; i < 10; i++) {
      const a = prng() * Math.PI * 2;
      const d = w * (0.5 + prng() * 0.35);
      g.fillStyle = hexA(p.accentHot, beatK * 0.7);
      g.beginPath();
      g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.6, 2 + prng() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();
}

// =============================================================================
// STORY PROP 2: notification storm / the desk
// =============================================================================

// Neutral defaults only: the content of a particular song belongs in the
// storyboard, never in the engine.
const NOTIF = [
  { app: 'chat', text: '@all status report due 18:00', hot: true },
  { app: 'mail', text: 'requirement change v7 · urgent', hot: true },
  { app: 'calendar', text: 'review meeting 09:00', hot: false },
  { app: 'boss', text: 'you there?', hot: true },
  { app: 'sheet', text: 'KPI at 12%', hot: true },
  { app: 'HR', text: 'overtime request pending', hot: false },
  { app: 'system', text: 'you have 47 unread messages', hot: true },
  { app: 'project', text: 'deadline: 3 hours', hot: true },
];

/** Stack of notification cards flooding the screen. */
export function notificationStorm(g, p, t, f, opts = {}) {
  const { t0 = 0, density = 1, cards = NOTIF } = opts;
  const age = Math.max(0, t - t0);
  const prng = mulberry32(4242);
  const n = Math.min(cards.length, 2 + Math.floor(age * 0.9 * density));
  for (let i = 0; i < n; i++) {
    const item = cards[i % cards.length];
    const born = t0 + i / (0.9 * density);
    const a = t - born;
    if (a < 0) continue;
    const k = easeOut(clamp01(a / 0.45));
    const bx = lerp(prng() * 1200 - 120, 120 + (i % 3) * 520, k);
    const by = lerp(1080, 120 + (i % 4) * 190, k) + Math.sin(t * 0.7 + i) * 5;
    const w = 470, h = 116;
    g.save();
    g.globalAlpha = Math.min(1, a * 3);
    // Card
    g.fillStyle = hexA(p.panel, 0.96);
    g.strokeStyle = item.hot ? hexA(p.accentHot, 0.75) : hexA(p.line, 0.8);
    g.lineWidth = item.hot ? 2.5 : 1.5;
    g.beginPath(); g.roundRect(bx, by, w, h, 14); g.fill(); g.stroke();
    // Unread dot
    if (item.hot) {
      const rp = 0.75 + 0.25 * Math.sin(t * 6 + i);
      g.fillStyle = hexA('#ff3b5c', rp);
      g.beginPath(); g.arc(bx + 28, by + 34, 8, 0, Math.PI * 2); g.fill();
    }
    // App chip
    g.fillStyle = hexA(p.raised, 0.95);
    g.beginPath(); g.roundRect(bx + 48, by + 22, 74, 26, 6); g.fill();
    g.fillStyle = hexA(p.sub, 1);
    g.font = '600 17px "Microsoft YaHei", Inter, sans-serif';
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(item.app, bx + 58, by + 36);
    // Body
    g.fillStyle = hexA(p.text, 0.95);
    g.font = '600 24px "Microsoft YaHei", Inter, sans-serif';
    g.fillText(item.text, bx + 48, by + 78);
    // Badge count
    g.fillStyle = hexA('#ff3b5c', 0.95);
    g.beginPath(); g.arc(bx + w - 26, by + 26, 14, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff';
    g.font = '700 16px Inter, sans-serif';
    g.textAlign = 'center';
    g.fillText(String(3 + i), bx + w - 26, by + 27);
    g.restore();
  }
}

/** Analog clock with hands spinning absurdly fast (time is out of control). */
export function spinningClock(g, p, t, cx, cy, r, opts = {}) {
  const { speed = 6.0, label = true } = opts;
  g.save();
  g.fillStyle = hexA(p.panel, 0.92);
  g.strokeStyle = hexA(p.line, 0.9);
  g.lineWidth = 3;
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill(); g.stroke();
  // Ticks
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.strokeStyle = hexA(p.sub, i % 3 === 0 ? 0.9 : 0.4);
    g.lineWidth = i % 3 === 0 ? 3 : 1.5;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82);
    g.lineTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92);
    g.stroke();
  }
  // Hands
  const hA = t * speed * 0.08 - Math.PI / 2;
  const mA = t * speed * 0.9 - Math.PI / 2;
  const sA = t * speed * 5.5 - Math.PI / 2;
  const hand = (a, len, wdt, col) => {
    g.strokeStyle = col; g.lineWidth = wdt; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len); g.stroke();
  };
  hand(hA, r * 0.45, 7, hexA(p.text, 0.95));
  hand(mA, r * 0.66, 5, hexA(p.text, 0.95));
  hand(sA, r * 0.78, 2, hexA(p.accentHot, 0.95));
  g.fillStyle = hexA(p.accentHot, 1);
  g.beginPath(); g.arc(cx, cy, 6, 0, Math.PI * 2); g.fill();
  if (label) {
    g.fillStyle = hexA('#ff3b5c', 0.9);
    g.font = '700 22px "Microsoft YaHei", Inter, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('23:59', cx, cy + r * 0.42);
  }
  g.restore();
}

// =============================================================================
// STORY PROP 3: the 110 call
// =============================================================================

/** Smartphone with a deadpan 110 call in progress. */
export function phoneCall(g, p, t, f, opts = {}) {
  const {
    cx = 960, cy = 470, t0 = 0, connectedAt = 2.2, w = 470, h = 800,
    number = '110', caller = 'the night shift', reply = 'Police. Go ahead.',
    dialing = 'calling…', connectedLabel = 'connected', hangUp = 'hang up',
  } = opts;
  const x = cx - w / 2, y = cy - h / 2;
  const connected = (t - t0) >= connectedAt;

  g.save();
  // Body
  g.fillStyle = '#0a0b10';
  g.strokeStyle = hexA(p.accentHot, 0.5);
  g.lineWidth = 4;
  g.beginPath(); g.roundRect(x, y, w, h, 54); g.fill(); g.stroke();
  // Screen
  g.fillStyle = hexA(p.panel, 1);
  g.beginPath(); g.roundRect(x + 16, y + 16, w - 32, h - 32, 42); g.fill();
  // Notch
  g.fillStyle = '#000000';
  g.beginPath(); g.roundRect(cx - 70, y + 26, 140, 26, 13); g.fill();
  // Status bar
  g.fillStyle = hexA(p.sub, 0.9);
  g.font = '600 20px Inter, sans-serif';
  g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText('02:47', x + 40, y + 84);
  g.textAlign = 'right';
  g.fillText('5G  ▮▮▮', x + w - 40, y + 84);

  // Caller avatar circle + pulsing rings
  const avX = cx, avY = y + 300;
  for (let i = 0; i < 3; i++) {
    const ph = ((t - t0) * 0.7 + i / 3) % 1;
    g.strokeStyle = hexA(p.accentHot, (1 - ph) * 0.35);
    g.lineWidth = 2;
    g.beginPath(); g.arc(avX, avY, 78 + ph * 90, 0, Math.PI * 2); g.stroke();
  }
  g.fillStyle = hexA(p.raised, 1);
  g.beginPath(); g.arc(avX, avY, 78, 0, Math.PI * 2); g.fill();
  g.fillStyle = hexA(p.text, 0.9);
  g.font = '700 62px Inter, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(String(number), avX, avY + 4);

  // Number + status
  g.fillStyle = hexA(p.text, 0.95);
  g.font = '700 54px Inter, sans-serif';
  g.fillText(String(number), cx, avY + 140);
  const dots = '.'.repeat(1 + Math.floor(t * 2.2) % 3);
  g.fillStyle = hexA(p.sub, 0.95);
  g.font = '500 26px "Microsoft YaHei", Inter, sans-serif';
  g.fillText(connected ? connectedLabel : dialing + dots, cx, avY + 190);

  // Chat bubble: the famous line
  const lineT = t0 + connectedAt + 0.35;
  const lineAge = t - lineT;
  if (lineAge > 0) {
    const k = clamp01(lineAge / 0.6);
    const bw = 400, bh = 104;
    const bx = cx - bw / 2, by = avY + 250;
    g.globalAlpha = k;
    g.fillStyle = hexA(p.raised, 1);
    g.beginPath(); g.roundRect(bx, by, bw, bh, 20); g.fill();
    g.fillStyle = hexA(p.text, 0.98);
    g.font = '600 34px "Microsoft YaHei", Inter, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(caller, cx, by + bh / 2);
    g.globalAlpha = 1;
  }
  // Officer reply (deadpan)
  const repT = lineT + 1.6;
  if (t - repT > 0) {
    const k = clamp01((t - repT) / 0.6);
    const bw = 430, bh = 96;
    const bx = cx - bw / 2 - 20, by = avY + 380;
    g.globalAlpha = k;
    g.fillStyle = hexA(p.accentDim, 0.85);
    g.beginPath(); g.roundRect(bx, by, bw, bh, 20); g.fill();
    g.fillStyle = hexA(p.text, 0.98);
    g.font = '600 28px "Microsoft YaHei", Inter, sans-serif';
    g.fillText(reply, cx - 20, by + bh / 2);
    g.globalAlpha = 1;
  }
  // Hang-up row
  const hx = cx, hy = y + h - 130;
  const hb = 0.8 + 0.2 * Math.sin(t * 3.4);
  g.fillStyle = hexA('#ff3b5c', hb);
  g.beginPath(); g.arc(hx, hy, 52, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff';
  g.font = '700 24px "Microsoft YaHei", Inter, sans-serif';
  g.fillText(hangUp, hx, hy + 2);
  g.restore();
}

// =============================================================================
// STORY PROP 4: city towers being erased window by window
// =============================================================================

export function cityTowers(g, p, t, f, eraseK, opts = {}) {
  const { baseY = 900, amp = 1 } = opts;
  g.save();
  // Buildings from back to front
  const towers = [
    { x: 40, w: 250, h: 420 }, { x: 250, w: 190, h: 540 }, { x: 400, w: 230, h: 360 },
    { x: 600, w: 170, h: 620 }, { x: 730, w: 300, h: 330 }, { x: 990, w: 210, h: 580 },
    { x: 1160, w: 260, h: 400 }, { x: 1380, w: 180, h: 660 }, { x: 1520, w: 340, h: 380 },
    { x: 1810, w: 120, h: 300 },
  ];
  const front = Math.max(0, eraseK) * 2100 - 100; // eraser sweep x
  for (const bd of towers) {
    const y = baseY - bd.h * amp;
    const erased = bd.x < front;
    // Building body
    g.fillStyle = erased ? hexA('#0a0a0e', 0.95) : hexA(p.panel, 0.98);
    g.strokeStyle = hexA(p.line, 0.65);
    g.lineWidth = 1.5;
    g.beginPath(); g.rect(bd.x, y, bd.w, bd.h * amp); g.fill(); g.stroke();

    // Window grid
    const cols = Math.max(2, Math.floor(bd.w / 46));
    const rows = Math.max(3, Math.floor((bd.h * amp) / 58));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const wx = bd.x + 12 + c * ((bd.w - 24) / cols);
        const wy = y + 16 + r * ((bd.h * amp - 32) / rows);
        const ww = (bd.w - 24) / cols - 10;
        const wh = (bd.h * amp - 32) / rows - 14;
        if (ww < 4 || wh < 4) continue;
        const litSeed = hash01(Math.floor(wx * 0.07) + r * 91, c);
        // Only some windows are lit; erased area is dark; a live "cursor"
        // deletes windows at the sweep edge with a spark
        const wasLit = litSeed > 0.42;
        const isEdge = Math.abs(wx - front) < 120;
        if (!erased && wasLit) {
          const flick = 0.6 + 0.4 * Math.sin(t * 2 + r * 1.7 + c);
          g.fillStyle = hexA(p.accentHot, 0.35 + 0.45 * flick);
          g.fillRect(wx, wy, ww, wh);
        } else if (isEdge) {
          const spark = 1 - Math.abs(wx - front) / 120;
          g.fillStyle = hexA('#ffffff', spark * 0.8);
          g.fillRect(wx, wy, ww, wh);
        } else {
          g.fillStyle = hexA(p.line, 0.22);
          g.fillRect(wx, wy, ww, wh);
        }
      }
    }
    // Roof antenna for tall ones
    if (bd.h > 550) {
      g.strokeStyle = hexA(p.line, 0.8);
      g.beginPath(); g.moveTo(bd.x + bd.w / 2, y); g.lineTo(bd.x + bd.w / 2, y - 60); g.stroke();
      g.fillStyle = hexA('#ff3b5c', 0.5 + 0.5 * Math.sin(t * 3));
      g.beginPath(); g.arc(bd.x + bd.w / 2, y - 64, 4, 0, Math.PI * 2); g.fill();
    }
  }
  // Ground haze
  const hz = g.createLinearGradient(0, baseY - 30, 0, 1080);
  hz.addColorStop(0, hexA(p.accent, 0.16));
  hz.addColorStop(1, hexA(p.bg, 0));
  g.fillStyle = hz;
  g.fillRect(0, baseY - 30, 1920, 1080 - baseY + 30);
  g.restore();
}

/** A cursor-eraser: big delete cursor with a glowing wipe edge. */
export function eraserCursor(g, p, x, y, k, opts = {}) {
  const { size = 1 } = opts;
  g.save();
  // Wipe edge
  const grad = g.createLinearGradient(x - 160, 0, x + 20, 0);
  grad.addColorStop(0, hexA(p.accentHot, 0));
  grad.addColorStop(1, hexA(p.accentHot, 0.55));
  g.fillStyle = grad;
  g.fillRect(x - 160, 0, 180, 1080);
  g.strokeStyle = hexA('#ffffff', 0.7);
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 1080); g.stroke();
  // Mouse cursor arrow
  g.translate(x, y);
  g.scale(size, size);
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#000000';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, 0); g.lineTo(0, 56); g.lineTo(14, 44); g.lineTo(26, 68);
  g.lineTo(40, 62); g.lineTo(28, 38); g.lineTo(46, 38); g.closePath();
  g.fill(); g.stroke();
  g.restore();
}

// =============================================================================
// STORY PROP 5: the 2 AM kitchen (the warm thing that cannot be deleted)
// =============================================================================

export function kitchen(g, p, t, f, opts = {}) {
  const { floorY = 840 } = opts;
  g.save();

  // Warm hanging lamp glow (top-left)
  const lampX = 380, lampY = 170;
  g.fillStyle = hexA(p.accentHot, 0.16);
  g.beginPath(); g.moveTo(lampX - 90, lampY); g.lineTo(lampX + 90, lampY); g.lineTo(lampX + 150, 520); g.lineTo(lampX - 150, 520); g.closePath(); g.fill();
  const lg = g.createRadialGradient(lampX, lampY, 10, lampX, lampY, 700);
  lg.addColorStop(0, hexA(p.accentHot, 0.22 + 0.06 * f.lowEnv));
  lg.addColorStop(1, hexA(p.accentHot, 0));
  g.fillStyle = lg;
  g.fillRect(0, 0, 1920, 1080);
  // Lamp shade + cord
  g.strokeStyle = hexA(p.line, 0.9);
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(lampX, 0); g.lineTo(lampX, lampY - 12); g.stroke();
  g.fillStyle = hexA(p.raised, 1);
  g.beginPath(); g.roundRect(lampX - 74, lampY - 12, 148, 28, 8); g.fill();
  g.fillStyle = hexA(p.text, 0.95);
  g.beginPath(); g.roundRect(lampX - 60, lampY + 14, 120, 10, 5); g.fill();

  // Window (right) with night sky + moon
  const wxx = 1280, wyy = 130, www = 480, whh = 420;
  g.fillStyle = hexA('#0b1024', 1);
  g.fillRect(wxx, wyy, www, whh);
  // stars
  const prng = mulberry32(77);
  for (let i = 0; i < 40; i++) {
    const sx = wxx + prng() * www, sy = wyy + prng() * whh * 0.8;
    g.fillStyle = hexA('#ffffff', 0.15 + 0.35 * Math.abs(Math.sin(t * 1.5 + i)));
    g.beginPath(); g.arc(sx, sy, 1.2, 0, Math.PI * 2); g.fill();
  }
  // moon
  g.fillStyle = hexA(p.text, 0.85);
  g.beginPath(); g.arc(wxx + www * 0.68, wyy + whh * 0.32, 46, 0, Math.PI * 2); g.fill();
  g.fillStyle = hexA('#0b1024', 1);
  g.beginPath(); g.arc(wxx + www * 0.68 - 16, wyy + whh * 0.32 - 10, 42, 0, Math.PI * 2); g.fill();
  // window frame
  g.strokeStyle = hexA(p.line, 1);
  g.lineWidth = 10;
  g.strokeRect(wxx, wyy, www, whh);
  g.beginPath(); g.moveTo(wxx + www / 2, wyy); g.lineTo(wxx + www / 2, wyy + whh); g.stroke();

  // Counter
  g.fillStyle = hexA(p.panel, 1);
  g.fillRect(0, floorY, 1920, 1080 - floorY);
  g.fillStyle = hexA(p.raised, 1);
  g.fillRect(0, floorY - 16, 1920, 18);

  // Stove + pot (center-left)
  const stx = 620;
  g.fillStyle = hexA(p.raised, 1);
  g.beginPath(); g.roundRect(stx - 180, floorY - 26, 360, 30, 8); g.fill();
  // burner glow
  const bg2 = g.createRadialGradient(stx, floorY - 40, 10, stx, floorY - 40, 220);
  bg2.addColorStop(0, hexA('#ff6a3d', 0.35 + 0.15 * f.lowEnv));
  bg2.addColorStop(1, hexA('#ff6a3d', 0));
  g.fillStyle = bg2; g.fillRect(stx - 240, floorY - 260, 480, 300);
  // pot body: tapered, rounded bottom, handles, rim
  const potTop = floorY - 186, potBot = floorY - 44;
  const halfTop = 124, halfBot = 94;
  g.fillStyle = hexA('#24272f', 1);
  g.strokeStyle = hexA('#565c6c', 1);
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(stx - halfTop, potTop);
  g.lineTo(stx - halfBot, potBot);
  g.quadraticCurveTo(stx, potBot + 62, stx + halfBot, potBot);
  g.lineTo(stx + halfTop, potTop);
  g.closePath(); g.fill(); g.stroke();
  // warm rim light from the lamp on the left flank
  const flank = g.createLinearGradient(stx - halfTop, 0, stx + halfTop, 0);
  flank.addColorStop(0, hexA('#ffb066', 0.22));
  flank.addColorStop(0.35, hexA('#ffb066', 0.05));
  flank.addColorStop(1, hexA('#ffb066', 0));
  g.fillStyle = flank;
  g.beginPath();
  g.moveTo(stx - halfTop, potTop);
  g.lineTo(stx - halfBot, potBot);
  g.quadraticCurveTo(stx, potBot + 62, stx + halfBot, potBot);
  g.lineTo(stx + halfTop, potTop);
  g.closePath(); g.fill();
  // handles
  g.strokeStyle = hexA('#3a3f4a', 1);
  g.lineWidth = 10;
  g.lineCap = 'round';
  [-1, 1].forEach((s) => {
    g.beginPath();
    g.arc(stx + s * (halfTop - 6), potTop + 62, 30, s > 0 ? -1.3 : Math.PI - 1.3, s > 0 ? 1.3 : Math.PI + 1.3);
    g.stroke();
  });
  // rim
  g.fillStyle = hexA('#3a3f4a', 1);
  g.strokeStyle = hexA('#6b7284', 1);
  g.lineWidth = 3;
  g.beginPath(); g.ellipse(stx, potTop, halfTop, 24, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = hexA('#14161c', 1);
  g.beginPath(); g.ellipse(stx, potTop + 2, halfTop - 14, 17, 0, 0, Math.PI * 2); g.fill();
  // lid leaning, with knob
  g.save();
  g.translate(stx + 10, potTop + 2);
  g.rotate(-0.06);
  g.fillStyle = hexA('#343842', 1);
  g.strokeStyle = hexA('#6b7284', 1);
  g.beginPath(); g.ellipse(0, 0, 106, 18, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath(); g.ellipse(0, -6, 106, 18, 0, Math.PI, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = hexA('#4a505e', 1);
  g.beginPath(); g.ellipse(0, -24, 18, 14, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = hexA('#ffb066', 0.35);
  g.beginPath(); g.ellipse(-46, -14, 26, 7, -0.2, 0, Math.PI * 2); g.fill();
  g.restore();

  // Steam curls (bezier, seeded, rising, looping)
  const prng2 = mulberry32(913);
  for (let i = 0; i < 7; i++) {
    const phase = (t * 0.35 + i / 7) % 1;
    const sx = stx + (prng2() - 0.5) * 90;
    const sy = floorY - 210 - phase * 300;
    const amp = 18 + prng2() * 26;
    g.strokeStyle = hexA(p.text, (1 - phase) * 0.22);
    g.lineWidth = 3 + (1 - phase) * 3;
    g.beginPath();
    g.moveTo(sx, sy);
    g.bezierCurveTo(sx + amp, sy - 50, sx - amp, sy - 110, sx + amp * 0.4, sy - 165);
    g.stroke();
  }

  // Bowl of noodles (right of pot)
  const bx = 1060, by = floorY - 20;
  g.fillStyle = hexA('#3a3f4a', 1);
  g.beginPath(); g.ellipse(bx, by, 150, 34, 0, 0, Math.PI * 2); g.fill();
  g.beginPath();
  g.moveTo(bx - 150, by);
  g.quadraticCurveTo(bx, by + 150, bx + 150, by);
  g.closePath(); g.fill();
  // noodle arcs
  for (let i = 0; i < 5; i++) {
    g.strokeStyle = hexA('#e8c98a', 0.85);
    g.lineWidth = 5;
    g.beginPath();
    g.ellipse(bx + (i - 2) * 22, by - 8, 60 - i * 6, 14, 0.2 * i, 0, Math.PI * 2);
    g.stroke();
  }
  // chopsticks leaning
  g.strokeStyle = hexA('#9a7b52', 1);
  g.lineWidth = 8;
  g.lineCap = 'round';
  g.beginPath(); g.moveTo(bx + 90, by + 40); g.lineTo(bx + 250, by - 130); g.stroke();
  g.beginPath(); g.moveTo(bx + 110, by + 46); g.lineTo(bx + 268, by - 116); g.stroke();
  g.restore();
}

// =============================================================================
// STORY PROP 6: the eraser wave over a floor plan
// =============================================================================

export function floorplanErase(g, p, t, f, k, opts = {}) {
  const { cols = 16, rows = 9 } = opts;
  const cellW = 1920 / cols, cellH = 1080 / rows;
  const front = clamp01(k) * (cols + 3) - 1.5;
  g.save();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellW, y = r * cellH;
      const d = front - c;
      if (d > 1.2) {
        // deleted: debris specks + a ghost outline that fades with distance
        const fade = Math.max(0, 1 - (d - 1.2) / 4);
        g.fillStyle = hexA(p.bg, 1);
        g.fillRect(x, y, cellW, cellH);
        g.strokeStyle = hexA(p.line, 0.05 + 0.10 * fade);
        g.lineWidth = 1;
        g.strokeRect(x + cellW * 0.2, y + cellH * 0.2, cellW * 0.6, cellH * 0.6);
        const dprng = mulberry32(r * 53 + c * 149);
        for (let i = 0; i < 5; i++) {
          g.fillStyle = hexA(p.mute, 0.15 + 0.3 * fade);
          g.fillRect(x + dprng() * cellW, y + dprng() * cellH, 2 + dprng() * 4, 2);
        }
      } else if (d > -0.8) {
        // erasing edge: dissolve into debris
        const prng = mulberry32(r * 97 + c * 13);
        g.fillStyle = hexA(p.bg, 0.85);
        g.fillRect(x, y, cellW, cellH);
        for (let i = 0; i < 16; i++) {
          const dx = x + prng() * cellW, dy = y + prng() * cellH;
          const sz = 2 + prng() * 7;
          g.fillStyle = hexA(prng() > 0.5 ? p.accentHot : p.line, 0.25 + prng() * 0.5);
          g.fillRect(dx, dy, sz, sz * 0.6);
        }
        g.strokeStyle = hexA('#ffffff', 0.5);
        g.lineWidth = 2;
        g.strokeRect(x, y, cellW, cellH);
      } else {
        // intact room — bright enough to read as a floor plan
        const pulseR = 0.5 + 0.5 * Math.sin(t * 1.3 + c * 0.5 + r);
        g.fillStyle = hexA(p.panel, 0.55 + 0.12 * pulseR);
        g.fillRect(x + 3, y + 3, cellW - 6, cellH - 6);
        g.strokeStyle = hexA(p.accentHot, 0.42 + 0.16 * pulseR);
        g.lineWidth = 2;
        g.strokeRect(x + 3, y + 3, cellW - 6, cellH - 6);
        // wall hatch marks + furniture blocks
        const prng = mulberry32(r * 311 + c * 71);
        g.fillStyle = hexA(p.raised, 0.75);
        g.fillRect(x + cellW * 0.18, y + cellH * 0.24, cellW * 0.34, cellH * 0.2);
        if (prng() > 0.5) {
          g.fillStyle = hexA(p.line, 0.55);
          g.fillRect(x + cellW * 0.6, y + cellH * 0.55, cellW * 0.24, cellH * 0.3);
        }
        // room label tick
        g.fillStyle = hexA(p.sub, 0.35);
        g.fillRect(x + cellW * 0.2, y + cellH * 0.78, cellW * (0.2 + prng() * 0.3), 3);
      }
    }
  }
  g.restore();
}

// =============================================================================
// STORY PROP 7: black hole (the final delete)
// =============================================================================

export function blackHole(g, p, t, f, k, opts = {}) {
  const { cx = 960, cy = 500 } = opts;
  const R = lerp(40, 260, clamp01(k));
  g.save();
  // Accretion rings
  for (let i = 6; i >= 1; i--) {
    const rr = R * (1 + i * 0.34) + f.lowEnv * 40;
    const a = (0.42 - i * 0.05) * (0.6 + 0.4 * Math.sin(t * 2 + i));
    g.strokeStyle = hexA(i % 2 ? p.accentHot : p.accent, Math.max(0, a));
    g.lineWidth = 3 + (6 - i);
    g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.stroke();
  }
  // Spiral in-fall particles
  const prng = mulberry32(2024);
  for (let i = 0; i < 90; i++) {
    const ph = ((t * 0.5 + prng()) % 1);
    const rad = R * 1.1 + (1 - ph) * 620;
    const ang = prng() * Math.PI * 2 + ph * 5.5;
    const px = cx + Math.cos(ang) * rad;
    const py = cy + Math.sin(ang) * rad * 0.75;
    g.fillStyle = hexA(p.accentHot, ph * 0.75);
    g.beginPath(); g.arc(px, py, 1.5 + ph * 3, 0, Math.PI * 2); g.fill();
  }
  // Hot halo first, so the void stays truly black on top of it
  const rim = g.createRadialGradient(cx, cy, R, cx, cy, R * 1.9);
  rim.addColorStop(0, hexA(p.accentHot, 0.5));
  rim.addColorStop(1, hexA(p.accentHot, 0));
  g.fillStyle = rim;
  g.beginPath(); g.arc(cx, cy, R * 1.9, 0, Math.PI * 2); g.fill();
  // Event horizon: pure dark disc with hot rim
  g.fillStyle = '#000000';
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  g.strokeStyle = hexA(p.accentHot, 0.9);
  g.lineWidth = 5;
  g.beginPath(); g.arc(cx, cy, R + 2, 0, Math.PI * 2); g.stroke();
  g.restore();
}

/** Album-title OS window: a system dialog that names the song. */
export function albumWindow(g, p, t, t0, opts = {}) {
  const {
    x = 560, y = 300, w = 800, h = 300,
    title = 'album title', subtitle = '', windowTitle = 'album title',
  } = opts;
  const age = t - t0;
  if (age < 0) return;
  const k = clamp01(age / 0.7);
  g.save();
  g.globalAlpha = k;
  g.fillStyle = hexA(p.panel, 0.97);
  g.strokeStyle = hexA(p.accentHot, 0.7);
  g.lineWidth = 2.5;
  g.beginPath(); g.roundRect(x, y + (1 - easeOut(k)) * 40, w, h, 14); g.fill(); g.stroke();
  const yy = y + (1 - easeOut(k)) * 40;
  // title bar
  g.fillStyle = hexA(p.raised, 1);
  g.beginPath(); g.roundRect(x + 1, yy + 1, w - 2, 46, 13); g.fill();
  g.fillStyle = hexA(p.sub, 1);
  for (let b = 0; b < 3; b++) { g.beginPath(); g.arc(x + 26 + b * 24, yy + 24, 6, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = hexA(p.sub, 1);
  g.font = '600 20px "Microsoft YaHei", Inter, sans-serif';
  g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText(windowTitle, x + 110, yy + 24);
  // Body copy
  g.fillStyle = hexA(p.text, 1);
  g.font = '700 56px Inter, "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.fillText(title, x + w / 2, yy + 140);
  g.fillStyle = hexA(p.sub, 1);
  g.font = '400 26px "Microsoft YaHei", Inter, sans-serif';
  if (subtitle) g.fillText(subtitle, x + w / 2, yy + 210);
  g.restore();
}

// =============================================================================
// STORY PROP 8: the log-out dialog (the question of the whole song)
// =============================================================================

export function logOutDialog(g, p, t, t0, opts = {}) {
  const {
    x = 460, y = 330, w = 1000, h = 420,
    title = 'System', question = ['if this dull life is a game,', 'would you press quit?'],
    cancel = 'cancel', confirm = 'quit',
  } = opts;
  const age = t - t0;
  if (age < 0) return;
  const k = clamp01(age / 0.8);
  g.save();
  g.globalAlpha = Math.min(1, k * 1.6);
  // Dim the world behind
  g.fillStyle = hexA('#000000', 0.5 * k);
  g.fillRect(0, 0, 1920, 1080);
  g.globalAlpha = 1;
  // Dialog
  const yy = y + (1 - easeOut(k)) * 60;
  g.fillStyle = hexA(p.panel, 0.98);
  g.strokeStyle = hexA(p.line, 1);
  g.lineWidth = 2;
  g.beginPath(); g.roundRect(x, yy, w, h, 16); g.fill(); g.stroke();
  // Title bar
  g.fillStyle = hexA(p.raised, 1);
  g.beginPath(); g.roundRect(x + 1, yy + 1, w - 2, 54, 15); g.fill();
  g.fillStyle = hexA(p.sub, 1);
  for (let b = 0; b < 3; b++) { g.beginPath(); g.arc(x + 30 + b * 26, yy + 28, 7, 0, Math.PI * 2); g.fill(); }
  g.font = '600 22px "Microsoft YaHei", Inter, sans-serif';
  g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillText(title, x + 130, yy + 28);

  // Question
  g.fillStyle = hexA(p.text, 1);
  g.font = '600 44px "Microsoft YaHei", Inter, sans-serif';
  g.textAlign = 'center';
  const q = Array.isArray(question) ? question : [question];
  q.forEach((line, i) => g.fillText(line, x + w / 2, yy + 150 + i * 65));

  // Buttons
  const by = yy + h - 120;
  const buttons = [
    { label: cancel, bx: x + w / 2 - 230, hot: false },
    { label: confirm, bx: x + w / 2 + 30, hot: true },
  ];
  for (const b of buttons) {
    // The cancel button is the one that gets clicked
    g.fillStyle = b.hot ? hexA(p.accentHot, 0.16) : hexA(p.raised, 1);
    g.strokeStyle = b.hot ? hexA(p.accentHot, 0.85) : hexA(p.line, 0.9);
    g.lineWidth = 2;
    g.beginPath(); g.roundRect(b.bx, by, 200, 68, 10); g.fill(); g.stroke();
    g.fillStyle = b.hot ? hexA(p.accentHot, 1) : hexA(p.text, 0.9);
    g.font = '600 30px "Microsoft YaHei", Inter, sans-serif';
    g.fillText(b.label, b.bx + 100, by + 36);
  }
  g.restore();
}

/** Mouse cursor that glides to a target (used to choose "cancel"). */
export function cursorTo(g, from, to, k, opts = {}) {
  const { size = 1.0 } = opts;
  const e = easeInOut(k);
  const x = lerp(from[0], to[0], e);
  const y = lerp(from[1], to[1], e);
  g.save();
  g.translate(x, y);
  g.scale(size, size);
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#000000';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(0, 0); g.lineTo(0, 44); g.lineTo(11, 35); g.lineTo(20, 54);
  g.lineTo(31, 49); g.lineTo(22, 30); g.lineTo(36, 30); g.closePath();
  g.fill(); g.stroke();
  g.restore();
}
