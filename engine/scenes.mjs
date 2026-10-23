// Scene library — one exported function per scene type.
// Every scene is a pure function of song time: (ctx, tv, f, P) where P is the
// shot's `params` object from storyboard.json. Nothing here keeps state between
// frames; all randomness comes from the seeded PRNG on `f`.
import {
  hexA, kinetic, rgbSplitText, stamp, speedLines, popWords, neonFlicker, ticker,
  keyGrid, giantKey, notificationStorm, spinningClock, phoneCall,
  cityTowers, eraserCursor, kitchen, floorplanErase, blackHole,
  albumWindow, logOutDialog, cursorTo,
} from './story_fx.mjs';
import { drawElements, eventsBegin, eventsEnd } from './elements.mjs';
import {
  slam, bounce, wall, sliced, onPath, decode, burst, karaoke,
} from './lyric_fx.mjs';
import { mulberry32 } from './prng.mjs';
import { ease, rampE, decay, bob } from './motion.mjs';
import { PROPS, actors as asActors, drawActor } from './actors.mjs';
import {
  grainField, foldCreases, waterSurface, rainField, driftMotes, inkBleed,
  threadLines, lightShaft, paperBoat, litWindow, moonDisc, lantern, emptyChair, birdLine,
} from './primitive_fx.mjs';

function clamp(x, lo = 0, hi = 1) { return Math.max(lo, Math.min(hi, x)); }
function pulse(since, decay) { return Math.exp(-decay * Math.max(0, since)); }
const easeOut = (k) => 1 - Math.pow(1 - clamp01(k), 3);
function clamp01(x) { return Math.max(0, Math.min(1, x)); }
const lerp = (a, b, k) => a + (b - a) * k;

// Font stacks. System fonts only — this package bundles no font files, so there
// is no font licence to comply with. Swap these for a licensed display face if
// you have one; nothing else in the scene library assumes a specific font.
export const FONTS = {
  word: "Inter, 'Segoe UI', 'Microsoft YaHei', sans-serif",
  sans: "Inter, 'Segoe UI', 'Microsoft YaHei', sans-serif",
  mono: "'JetBrains Mono', Consolas, monospace",
  serif: "Georgia, 'Microsoft YaHei', serif",
};
const WORD = FONTS.word;
const SANS = FONTS.sans;
const MONO = FONTS.mono;

function perspectiveFloor(g, p, cx, horizonY, t, density = 14, glowK = 1) {
  g.save();
  for (let i = -density; i <= density; i++) {
    const x0 = cx + i * (1920 / density) * 2.2;
    g.strokeStyle = hexA(p.accent, 0.22 + 0.12 * glowK);
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(cx, horizonY); g.lineTo(x0, 1080); g.stroke();
  }
  const speed = 1.2, cycles = 22;
  for (let i = 0; i < cycles; i++) {
    const prog = ((t * speed + i / cycles) % 1);
    const y = horizonY + (1080 - horizonY) * prog * prog;
    const a = 0.12 + prog * 0.38;
    g.lineWidth = 1.5;
    g.strokeStyle = hexA(p.accentHot, a);
    g.beginPath(); g.moveTo(0, y); g.lineTo(1920, y); g.stroke();
  }
  const hg = g.createLinearGradient(0, horizonY - 80, 0, horizonY + 120);
  hg.addColorStop(0, hexA(p.accentHot, 0));
  hg.addColorStop(0.5, hexA(p.accentHot, 0.35 * glowK + 0.15));
  hg.addColorStop(1, hexA(p.accentHot, 0));
  g.fillStyle = hg;
  g.fillRect(0, horizonY - 80, 1920, 200);
  g.restore();
}

function radialSpectrum(g, f, p, cx, cy, radius, bars = 32) {
  const specs = f.spec, fps = f.fps, n = f.nb;
  const x = Math.max(0, Math.min(n - 1, f.t * fps)), i = Math.floor(x), k = x - i;
  g.save();
  g.lineWidth = 5;
  g.lineCap = 'round';
  for (let b = 0; b < bars; b++) {
    const v = (specs[i * n + b] * (1 - k) + specs[Math.min(i + 1, n - 1) * n + b] * k) / 255;
    const len = radius * (0.35 + 0.65 * v);
    const a = (b / bars) * Math.PI * 2 - Math.PI / 2 + f.t * 0.15;
    g.strokeStyle = hexA(p.accentHot, 0.35 + 0.65 * v);
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * radius * 0.35, cy + Math.sin(a) * radius * 0.35);
    g.lineTo(cx + Math.cos(a) * len, cy + Math.sin(a) * len);
    g.stroke();
  }
  g.restore();
}

function particles(g, f, p, t, count = 90) {
  g.save();
  for (let i = 0; i < count; i++) {
    const s = i * 0.6180339;
    const spd = 0.02 + (s * 7) % 0.05;
    const x = ((s * 997 + t * spd * 1920) % 1940 + 1940) % 1940 - 10;
    const y = ((s * 551 + t * spd * 900 + Math.sin(t * 0.4 + i) * 40) % 1100 + 1100) % 1100 - 10;
    const r = 2 + (s * 13 % 3) + f.lowEnv * 3;
    const a = 0.18 + (s * 31 % 0.30) + f.lowEnv * 0.20;
    g.fillStyle = hexA(p.accentHot, Math.min(0.85, a));
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

function dataRain(g, f, p, t, count = 40) {
  g.save();
  for (let i = 0; i < count; i++) {
    const s = i * 1.618;
    const x = ((s * 733) % 1920);
    const speed = 0.15 + (s * 11) % 0.35;
    const len = 30 + (s * 5) % 80;
    const y = ((t * speed * 400 + s * 991) % 1200) - 120;
    const a = 0.10 + f.high * 0.25;
    g.strokeStyle = hexA(p.accent, Math.min(0.7, a));
    g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + len); g.stroke();
  }
  g.restore();
}

/** horizontal tear rows on strong onsets */
function glitchSlices(g, f, t) {
  if (f.onsetPulse < 0.3) return;
  const n = 3 + Math.floor(f.onsetPulse * 5);
  for (let i = 0; i < n; i++) {
    const seed = Math.floor(t * 15) * 7 + i;
    const h = 6 + (seed % 20);
    const y = ((seed * 97) % 1080);
    const off = ((seed * 131 % 40) - 20) * (f.onsetPulse * 2.4);
    try {
      const img = g.getImageData(0, y, 1920, h);
      g.putImageData(img, off, y);
    } catch { /* ignore */ }
  }
}

/** Camera zoom punch: returns scale around (cx,cy) driven by downbeats. */
function punchScale(f, amount = 0.045) {
  return 1 + f.downPulse * amount + f.beatPulse * amount * 0.35;
}

// =============================================================================
// SCENES — the storyboard
// =============================================================================
function doBurstSafe(g, x, y, t, t0, p) {
  try { burst(g, x, y, t, t0, { color: p.accentHot, n: 28, speed: 460, life: 0.9 }); }
  catch { /* noop */ }
}

export function keyboard(ctx, tv, f, P = { 'start': 0.0 }) {
      const p = ctx.pal, g = ctx.g;
      ctx.clear();
      // Infinite keyboard receding into the dark
      keyGrid(g, p, tv, f, { rows: 10, cols: 24, topY: 250, bottomY: 1250, alpha: 0.55 });
      // Room haze
      const haze = g.createRadialGradient(960, 430, 80, 960, 430, 900);
      haze.addColorStop(0, hexA(p.accent, 0.10 + f.lowEnv * 0.10));
      haze.addColorStop(1, hexA(p.bg, 0));
      g.fillStyle = haze; g.fillRect(0, 0, 1920, 1080);
      // The one lit key
      giantKey(g, p, tv, f, { cx: 960, cy: 470, w: 640, h: 360, label: P.keyLabel ?? 'delete' });
      // Timestamp HUD — a fixed timestamp is the joke: this desk never sees daylight
      g.fillStyle = hexA(p.sub, 0.75);
      g.font = '600 26px "JetBrains Mono", Consolas, monospace';
      g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText(P.clock ?? '02:47  AM', 90, 92);
      g.fillText(P.place ?? 'office // floor 23', 90, 132);
      // Lyric: the whole thesis of the song
      const { cur } = lyricsOf(ctx).activeAt(tv);
      if (cur && tv - cur.t < 6.0) {
        kinetic(g, cur.text, 960, 900, tv, cur.t, {
          size: 96, color: p.text, hot: p.accentHot, ghost: p.accent,
          step: 0.15, settle: 0.30, font: WORD,
        });
      }
      particles(g, f, p, tv, 40);
      if (f.onsetPulse > 0.4) glitchSlices(g, f, tv);

}


/**
 * Scene `desk` — default length 26.0s.
 * Params (all optional) override the storyboard's content; see docs/scenes.md.
 */
export function desk(ctx, tv, f, P = { 'start': 13.1 }) {
      const p = ctx.pal, g = ctx.g;
      ctx.clear();
      const t0 = tv - P.start;

      // Wall + window slats (venetian blinds, night outside)
      g.fillStyle = hexA(p.bg, 1); g.fillRect(0, 0, 1920, 1080);
      for (let i = 0; i < 16; i++) {
        const y = 80 + i * 40;
        g.fillStyle = hexA(p.panel, 0.55);
        g.fillRect(0, y, 1920, 18);
        g.fillStyle = hexA(p.accent, 0.03 + f.low * 0.02);
        g.fillRect(0, y + 18, 1920, 4);
      }

      // Monitor
      const mx = 560, my = 250, mw = 800, mh = 480;
      g.save();
      g.fillStyle = hexA('#0c0e14', 1);
      g.strokeStyle = hexA(p.line, 0.9);
      g.lineWidth = 4;
      g.beginPath(); g.roundRect(mx - 18, my - 18, mw + 36, mh + 36, 18); g.fill(); g.stroke();
      // Screen
      const sg = g.createLinearGradient(mx, my, mx + mw, my + mh);
      sg.addColorStop(0, hexA(p.panel, 1));
      sg.addColorStop(1, hexA(p.bg, 1));
      g.fillStyle = sg;
      g.fillRect(mx, my, mw, mh);
      // Screen content: an inbox that never empties
      g.save();
      g.beginPath(); g.rect(mx, my, mw, mh); g.clip();
      g.fillStyle = hexA(p.raised, 1);
      g.fillRect(mx, my, mw, 46);
      g.fillStyle = hexA(p.text, 0.95);
      g.font = '700 22px "Microsoft YaHei", Inter, sans-serif';
      g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText(P.inboxTitle ?? 'inbox', mx + 20, my + 23);
      g.fillStyle = hexA('#ff3b5c', 0.95);
      g.beginPath(); g.roundRect(mx + 108, my + 10, 64, 26, 13); g.fill();
      g.fillStyle = '#ffffff';
      g.font = '700 17px Inter, sans-serif';
      g.textAlign = 'center';
      g.fillText(String(P.inboxCount ?? 47), mx + 140, my + 24);
      // The inbox is content, so it comes from params. Defaults are deliberately
      // generic: swap them for your own beat of the story in storyboard.json.
      const rows = P.inboxRows ?? [
        ['HR', 'Confirm this week\'s overtime', '02:31'],
        ['Client A', 'Change request v7 (urgent)', '02:19'],
        ['PM', 'Review 9am tomorrow, prep deck', '01:58'],
        ['Finance', 'Expense rejected: no receipt', '01:40'],
        ['System', 'You have 47 unread messages', '01:22'],
        ['Boss', 'you there?', '00:47'],
        ['Colleague', 'can I get this today', '00:12'],
      ];
      rows.forEach((r, i) => {
        const ry = my + 56 + i * 58;
        g.fillStyle = i < 3 ? hexA(p.accent, 0.10) : hexA(p.bg, 0.5);
        g.fillRect(mx, ry, mw, 56);
        g.fillStyle = i < 3 ? hexA('#ff3b5c', 0.9) : hexA(p.mute, 0.8);
        g.beginPath(); g.arc(mx + 22, ry + 28, 5, 0, Math.PI * 2); g.fill();
        g.fillStyle = hexA(p.sub, 0.95);
        g.font = '600 17px "Microsoft YaHei", Inter, sans-serif';
        g.textAlign = 'left';
        g.fillText(r[0], mx + 42, ry + 20);
        g.fillStyle = hexA(p.text, i < 3 ? 0.95 : 0.7);
        g.font = '400 19px "Microsoft YaHei", Inter, sans-serif';
        g.fillText(r[1], mx + 42, ry + 42);
        g.fillStyle = hexA(p.mute, 0.9);
        g.font = '500 15px Inter, sans-serif';
        g.textAlign = 'right';
        g.fillText(r[2], mx + mw - 18, ry + 20);
      });
      g.restore();
      // Screen glare
      g.fillStyle = hexA('#ffffff', 0.03);
      g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + 300, my); g.lineTo(mx + 80, my + mh); g.lineTo(mx, my + mh); g.closePath(); g.fill();
      // Scanlines inside screen
      g.fillStyle = hexA('#000000', 0.25);
      for (let y = my; y < my + mh; y += 4) g.fillRect(mx, y, mw, 1);
      g.restore();

      // Monitor stand
      g.fillStyle = hexA(p.raised, 1);
      g.fillRect(920, my + mh + 18, 80, 60);
      g.fillRect(840, my + mh + 78, 240, 14);

      // Desk surface
      const dg = g.createLinearGradient(0, 860, 0, 1080);
      dg.addColorStop(0, hexA(p.raised, 1));
      dg.addColorStop(1, hexA(p.panel, 1));
      g.fillStyle = dg;
      g.beginPath(); g.moveTo(120, 860); g.lineTo(1800, 860); g.lineTo(1920, 1080); g.lineTo(0, 1080); g.closePath(); g.fill();
      g.strokeStyle = hexA(p.line, 0.7); g.lineWidth = 2; g.stroke();

      // Keyboard in front (cropped bottom)
      g.save();
      g.translate(960, 1010);
      for (let r = 0; r < 4; r++) {
        for (let c = -11; c <= 11; c++) {
          const kw = 58, kh = 44;
          const x = c * 64 + (r % 2) * 10;
          const y = r * 52;
          const press = r === 0 && c === 8 ? f.beatPulse * 5 : 0;
          g.fillStyle = hexA(p.panel, 0.95);
          g.strokeStyle = hexA(p.line, 0.8);
          g.lineWidth = 1.5;
          g.beginPath(); g.roundRect(x - kw / 2, y + press, kw, kh, 8); g.fill(); g.stroke();
          if (r === 0 && c === 8) {
            g.fillStyle = hexA(p.accentHot, 0.55 + f.beatPulse * 0.45);
            g.beginPath(); g.roundRect(x - kw / 2 + 3, y + press + 3, kw - 6, kh - 6, 6); g.fill();
          }
        }
      }
      g.restore();

      // Clock: time is out of control
      spinningClock(g, p, tv, 1700, 150, 86, { speed: 5 + f.rms * 4 });

      // Coffee cup (cold, half drunk)
      g.save();
      g.fillStyle = hexA('#2a2622', 1);
      g.beginPath(); g.roundRect(230, 900, 96, 110, 10); g.fill();
      g.fillStyle = hexA('#4a3a2c', 1);
      g.beginPath(); g.ellipse(278, 902, 48, 12, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = hexA('#2a2622', 1); g.lineWidth = 12;
      g.beginPath(); g.arc(330, 950, 26, -1.2, 1.2); g.stroke();
      g.restore();

      // Notification cards flying across the foreground (kept sparse so the
      // lyric band and the monitor stay readable)
      g.save();
      g.globalAlpha = 0.8;
      notificationStorm(g, p, tv + 7, f, { t0: 0, density: 0.45, cards: P.cards });
      g.restore();

      // Lyric band at the bottom over the desk
      const { cur } = lyricsOf(ctx).activeAt(tv);
      if (cur) {
        const isHit = /delete|goodbye|help/i.test(cur.text);
        g.save();
        const band = g.createLinearGradient(0, 900, 0, 1080);
        band.addColorStop(0, hexA('#000000', 0));
        band.addColorStop(0.35, hexA('#000000', 0.62));
        band.addColorStop(1, hexA('#000000', 0.88));
        g.fillStyle = band;
        g.fillRect(0, 900, 1920, 180);
        if (isHit) {
          rgbSplitText(g, cur.text, 960, 990, 74, {
            split: 6 + f.onsetPulse * 8, color: p.text, font: WORD,
          });
        } else {
          kinetic(g, cur.text, 960, 990, tv, cur.t, {
            size: 70, color: p.text, hot: p.accentHot, ghost: p.accentDim,
            step: 0.12, settle: 0.26, font: WORD,
          });
        }
        g.restore();
      }
      if (f.onsetPulse > 0.5) glitchSlices(g, f, tv);

}


/**
 * Scene `stamp` — default length 26.7s.
 * Params (all optional) override the storyboard's content; see docs/scenes.md.
 */
export function stampScene(ctx, tv, f, P = { 'start': 39.1 }) {
      const p = ctx.pal, g = ctx.g;
      ctx.clear();
      const t0 = tv - P.start;

      // Background: city towers losing windows as the sweep passes
      const eraseK = clamp01(t0 / 24);
      cityTowers(g, p, tv, f, eraseK, { baseY: 820, amp: 0.72 });
      // faint grid
      g.save();
      g.globalAlpha = 0.28;
      perspectiveFloor(g, p, 960, 820, tv * 0.6, 12, f.rmsEnv * p.glow * 0.4);
      g.restore();

      // Foreground: PPT slides, stamped DELETE
      // A storyboard only has to say { title, bullets }; the layout comes from
      // here. Passing x/y/w/h/rot overrides the slot.
      const LAYOUT = [
        { x: 250, y: 200, w: 520, h: 300, rot: -0.05 },
        { x: 1050, y: 170, w: 560, h: 320, rot: 0.04 },
        { x: 640, y: 470, w: 600, h: 330, rot: -0.02 },
      ];
      const slides = (
        P.slides ?? [
          { title: 'Q3 review', bullets: 4 },
          { title: 'Roadmap v3', bullets: 3 },
          { title: 'KPI: 12%', bullets: 5 },
        ]
      ).map((s, i) => ({ ...LAYOUT[i % LAYOUT.length], bullets: 4, ...s }));
      slides.forEach((s, i) => {
        const drift = Math.sin(tv * 0.5 + i * 1.9) * 12;
        g.save();
        g.translate(s.x + s.w / 2 + drift, s.y + s.h / 2);
        g.rotate(s.rot + Math.sin(tv * 0.3 + i) * 0.01);
        g.fillStyle = hexA(p.panel, 0.97);
        g.strokeStyle = hexA(p.line, 0.9);
        g.lineWidth = 2;
        g.beginPath(); g.roundRect(-s.w / 2, -s.h / 2, s.w, s.h, 10); g.fill(); g.stroke();
        // title bar
        g.fillStyle = hexA(p.raised, 1);
        g.fillRect(-s.w / 2 + 2, -s.h / 2 + 2, s.w - 4, 44);
        g.fillStyle = hexA(p.text, 0.95);
        g.font = '700 24px "Microsoft YaHei", Inter, sans-serif';
        g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillText(s.title, -s.w / 2 + 24, -s.h / 2 + 24);
        // fake bullets
        for (let b = 0; b < s.bullets; b++) {
          const bw = (0.4 + 0.45 * Math.abs(Math.sin(i * 3 + b * 7))) * (s.w - 80);
          g.fillStyle = hexA(p.line, 0.75);
          g.fillRect(-s.w / 2 + 40, -s.h / 2 + 80 + b * 46, 12, 12);
          g.fillStyle = hexA(p.sub, 0.55);
          g.fillRect(-s.w / 2 + 62, -s.h / 2 + 80 + b * 46, bw, 12);
        }
        g.restore();
        // DELETE stamp on slide 1 and 3, timed to the hook
        if ((i === 0 || i === 2) && t0 > 1.5 + i * 0.8) {
          const age = t0 - (1.5 + i * 0.8);
          stamp(g, P.stampText ?? 'DELETED', s.x + s.w / 2 + 40, s.y + s.h / 2 - 10, tv, P.start + 1.5 + i * 0.8, {
            size: 64, rot: -0.22 + i * 0.1, color: hexA('#ff3b5c', 0.9), frame: true,
            alpha: Math.min(1, age * 2),
          });
        }
      });

      // "busy busy busy" swarm — many small words flying past
      const prng = mulberry32(561);
      for (let i = 0; i < 14; i++) {
        const sp = 90 + prng() * 160;
        const yy = 90 + prng() * 900;
        const xx = ((tv * sp + prng() * 2400) % 2400) - 240;
        g.fillStyle = hexA(p.mute, 0.28);
        g.font = `700 ${20 + Math.floor(prng() * 26)}px ${WORD}`;
        g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillText('busy', xx, yy);
      }

      // Lyric treatments are selected by the storyboard (regex sources in
      // params), never by words baked into the engine.
      const { cur } = lyricsOf(ctx).activeAt(tv);
      const re = (src) => (src ? new RegExp(src, 'i') : null);
      const hitRe = re(P.hitLine), popRe = re(P.popLine), busyRe = re(P.busyLine);
      if (cur) {
        const age = tv - cur.t;
        if (hitRe && hitRe.test(cur.text)) {
          rgbSplitText(g, cur.text.toUpperCase(), 960, 880, 104, {
            split: 8 + f.onsetPulse * 14, color: p.text, font: WORD,
          });
          if (age < 0.45) {
            speedLines(g, 960, 880, tv, (1 - age / 0.45) * 0.9, p.accentHot, 99);
          }
        } else if (popRe && popRe.test(cur.text)) {
          kinetic(g, cur.text, 960, 880, tv, cur.t, {
            size: 88, color: p.accentHot, hot: '#ffffff', ghost: p.accent,
            step: 0.13, settle: 0.25, font: WORD,
          });
        } else if (busyRe && busyRe.test(cur.text)) {
          popWords(g, cur.text, 960, 880, tv, cur.t, {
            size: 92, color: p.text, hot: p.accentHot, perWord: 0.28, font: WORD,
          });
        } else {
          kinetic(g, cur.text, 960, 880, tv, cur.t, {
            size: 76, color: p.text, hot: p.accentHot, ghost: p.accentDim,
            step: 0.11, settle: 0.24, font: WORD,
          });
        }
      }
      particles(g, f, p, tv, 50);
      if (f.onsetPulse > 0.55) glitchSlices(g, f, tv);

}


/**
 * Scene `empty` — default length 29.3s.
 * Params (all optional) override the storyboard's content; see docs/scenes.md.
 */
export function emptyScene(ctx, tv, f, P = { 'start': 65.8 }) {
      const p = ctx.pal, g = ctx.g;
      ctx.clear();
      const t0 = tv - P.start;

      // Deep office: back wall with a window of city lights
      g.fillStyle = hexA(p.bg, 1); g.fillRect(0, 0, 1920, 1080);
      // Window band (right)
      g.fillStyle = hexA('#0a1020', 1);
      g.fillRect(1240, 120, 560, 460);
      const prng = mulberry32(808);
      for (let i = 0; i < 60; i++) {
        const wx = 1240 + prng() * 560;
        const wy = 120 + prng() * 460;
        const lit = prng() > 0.45;
        if (lit) {
          g.fillStyle = hexA(p.accentHot, 0.10 + prng() * 0.35);
          g.fillRect(wx, wy, 4 + prng() * 5, 3 + prng() * 4);
        }
      }
      // Window mullions
      g.strokeStyle = hexA(p.line, 0.9);
      g.lineWidth = 8;
      g.strokeRect(1240, 120, 560, 460);
      g.beginPath(); g.moveTo(1520, 120); g.lineTo(1520, 580); g.stroke();
      g.beginPath(); g.moveTo(1240, 350); g.lineTo(1800, 350); g.stroke();

      // Cubicle partitions (silhouettes) receding
      for (let i = 0; i < 4; i++) {
        const x = 60 + i * 520;
        const h = 380 - i * 22;
        g.fillStyle = hexA(p.panel, 0.55 + i * 0.08);
        g.fillRect(x, 780 - h, 380, h);
        g.strokeStyle = hexA(p.line, 0.6);
        g.lineWidth = 2;
        g.strokeRect(x, 780 - h, 380, h);
        // partition top rail
        g.fillStyle = hexA(p.raised, 0.9);
        g.fillRect(x - 6, 780 - h - 14, 392, 16);
      }

      // One desk with a lamp (the only light left)
      const lampX = 520, lampY = 470;
      const cone = g.createLinearGradient(lampX, lampY, lampX, 900);
      cone.addColorStop(0, hexA(p.accentHot, 0.28 + f.lowEnv * 0.10));
      cone.addColorStop(1, hexA(p.accentHot, 0));
      g.fillStyle = cone;
      g.beginPath(); g.moveTo(lampX - 30, lampY); g.lineTo(lampX + 30, lampY); g.lineTo(lampX + 320, 940); g.lineTo(lampX - 320, 940); g.closePath(); g.fill();
      // lamp arm
      g.strokeStyle = hexA(p.line, 1); g.lineWidth = 8; g.lineCap = 'round';
      g.beginPath(); g.moveTo(lampX - 120, 860); g.lineTo(lampX - 120, lampY + 60); g.lineTo(lampX - 30, lampY); g.stroke();
      // lamp head
      g.fillStyle = hexA(p.raised, 1);
      g.beginPath(); g.roundRect(lampX - 60, lampY - 8, 120, 26, 10); g.fill();
      g.fillStyle = hexA('#ffe3b0', 0.95);
      g.beginPath(); g.ellipse(lampX, lampY + 18, 42, 10, 0, 0, Math.PI * 2); g.fill();

      // Desk + empty chair
      g.fillStyle = hexA(p.panel, 1);
      g.fillRect(240, 860, 640, 22);
      g.fillRect(280, 882, 16, 198); g.fillRect(824, 882, 16, 198);
      // chair silhouette
      g.fillStyle = hexA('#181a20', 1);
      g.beginPath(); g.roundRect(700, 700, 150, 170, 18); g.fill();
      g.fillRect(720, 866, 110, 30);
      g.beginPath(); g.moveTo(740, 892); g.lineTo(700, 1040); g.stroke();
      g.strokeStyle = hexA('#181a20', 1); g.lineWidth = 10;
      g.beginPath(); g.moveTo(775, 896); g.lineTo(775, 1050); g.stroke();

      // Monitor (off, reflecting the lamp)
      g.save();
      g.fillStyle = hexA('#0d0f14', 1);
      g.strokeStyle = hexA(p.line, 0.8); g.lineWidth = 3;
      g.beginPath(); g.roundRect(330, 640, 300, 190, 10); g.fill(); g.stroke();
      const refl = g.createLinearGradient(330, 640, 630, 830);
      refl.addColorStop(0, hexA(p.accentHot, 0.10));
      refl.addColorStop(0.5, hexA(p.accentHot, 0.02));
      refl.addColorStop(1, hexA(p.accentHot, 0));
      g.fillStyle = refl;
      g.fillRect(334, 644, 292, 182);
      g.fillStyle = hexA(p.raised, 1);
      g.fillRect(465, 830, 30, 24);
      g.fillRect(420, 854, 120, 8);
      g.restore();

      // Papers spread on the desk (work that never ends)
      const pprng = mulberry32(313);
      for (let i = 0; i < 7; i++) {
        const px = 300 + pprng() * 460;
        const py = 828 + pprng() * 26;
        g.save();
        g.translate(px, py);
        g.rotate((pprng() - 0.5) * 0.3);
        g.fillStyle = hexA('#d8d2c4', 0.16 + pprng() * 0.10);
        g.fillRect(-46, -14, 92, 28);
        g.restore();
      }
      // Sticky notes on the partition
      const notes = [
        { x: 120, y: 470, c: '#e8d24a', r: 0.05 },
        { x: 220, y: 520, c: '#e87a8a', r: -0.08 },
        { x: 150, y: 590, c: '#8ad2e8', r: 0.1 },
      ];
      for (const n of notes) {
        g.save();
        g.translate(n.x, n.y); g.rotate(n.r);
        g.fillStyle = hexA(n.c, 0.30);
        g.fillRect(-42, -42, 84, 84);
        g.fillStyle = hexA('#000000', 0.18);
        for (let l = 0; l < 3; l++) g.fillRect(-30, -22 + l * 16, 60 - l * 12, 4);
        g.restore();
      }
      // Potted plant (the only other living thing)
      g.save();
      g.fillStyle = hexA('#3a2f28', 1);
      g.beginPath(); g.roundRect(1770, 800, 96, 100, 8); g.fill();
      g.strokeStyle = hexA('#4e7a52', 0.85); g.lineWidth = 5; g.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i - 2.5) * 0.28 + Math.sin(tv * 0.6 + i) * 0.04;
        const len = 110 + (i % 3) * 40;
        g.beginPath();
        g.moveTo(1818, 800);
        g.quadraticCurveTo(1818 + Math.cos(a) * len * 0.5, 800 + Math.sin(a) * len * 0.7,
          1818 + Math.cos(a) * len, 800 + Math.sin(a) * len);
        g.stroke();
      }
      g.restore();

      // Wall clock stopped at 02:47
      spinningClock(g, p, tv, 980, 200, 62, { speed: 0 });

      // Coffee cup + takeaway box (life debris)
      g.fillStyle = hexA('#332a22', 1);
      g.beginPath(); g.roundRect(560, 812, 54, 50, 8); g.fill();
      g.fillStyle = hexA('#5a442f', 1);
      g.beginPath(); g.ellipse(587, 814, 27, 7, 0, 0, Math.PI * 2); g.fill();

      // Dust motes in the lamp light
      for (let i = 0; i < 40; i++) {
        const s = i * 0.77;
        const x = lampX + Math.sin(tv * 0.5 + s * 6) * (120 + (s * 37 % 200));
        const y = 500 + ((tv * 22 + s * 400) % 400);
        g.fillStyle = hexA('#ffe3b0', 0.10 + 0.18 * Math.abs(Math.sin(tv * 2 + i)));
        g.beginPath(); g.arc(x, y, 1.4 + (s * 5 % 2), 0, Math.PI * 2); g.fill();
      }

      // Lyric: quiet, floating in the lamp light (small scrim for legibility)
      const { cur } = lyricsOf(ctx).activeAt(tv);
      if (cur) {
        const scrim = g.createLinearGradient(0, 470, 0, 660);
        scrim.addColorStop(0, hexA('#000000', 0));
        scrim.addColorStop(0.5, hexA('#000000', 0.18));
        scrim.addColorStop(1, hexA('#000000', 0));
        g.fillStyle = scrim;
        g.fillRect(0, 470, 1920, 190);
        const isLoud = /goodbye|help/i.test(cur.text);
        if (isLoud) {
          g.save();
          g.shadowColor = p.accentHot; g.shadowBlur = 24;
          kinetic(g, cur.text, 960, 560, tv, cur.t, {
            size: 78, color: p.accentHot, hot: '#ffffff', step: 0.16, settle: 0.3, font: WORD,
          });
          g.restore();
        } else {
          const soft = /nobody|can't even cry|believe/i.test(cur.text);
          if (soft) {
            neonFlicker(g, cur.text, 960, 560, tv, { size: 64, color: p.sub, glow: p.accent, font: WORD });
          } else {
            kinetic(g, cur.text, 960, 560, tv, cur.t, {
              size: 66, color: p.text, hot: p.accentHot, ghost: p.mute,
              step: 0.15, settle: 0.28, font: WORD,
            });
          }
        }
      }
      // slow drifting particles
      particles(g, f, p, tv, 26);
      if (f.onsetPulse > 0.6) glitchSlices(g, f, tv);

}


/**
 * Scene `call110` — default length 24.7s.
 * Params (all optional) override the storyboard's content; see docs/scenes.md.
 */
export function call110(ctx, tv, f, P = { 'start': 95.1 }) {
      const p = ctx.pal, g = ctx.g;
      ctx.clear();
      const t0 = tv - P.start;

      // Dark room radial glow behind the phone
      const rg = g.createRadialGradient(960, 470, 60, 960, 470, 900);
      rg.addColorStop(0, hexA(p.accent, 0.16 + f.onsetPulse * 0.12));
      rg.addColorStop(1, hexA(p.bg, 0));
      g.fillStyle = rg; g.fillRect(0, 0, 1920, 1080);
      dataRain(g, f, p, tv, 26);
      particles(g, f, p, tv, 45);

      // The phone (dialing starts immediately; connects at +4.2s ≈ 99.3s)
      phoneCall(g, p, tv, f, { cx: 960, cy: 570, t0: P.start + (P.callDelay ?? 0.5), connectedAt: P.connectAfter ?? 3.7, w: 470, h: 800, number: P.number, caller: P.caller, reply: P.reply,
        dialing: P.dialing, connectedLabel: P.connectedLabel, hangUp: P.hangUp });

      // Speed lines on the deadpan punchline (call connects, then the reply lands)
      const jokeT = P.start + (P.callDelay ?? 0.5) + (P.connectAfter ?? 3.7) + 0.35;
      if (tv > jokeT && tv < jokeT + 0.9) {
        speedLines(g, 960, 470, tv, (1 - (tv - jokeT) / 0.9) * 0.8, p.accentHot, 7);
      }

      // A reminder card, floating left: kicker + title + source
      g.save();
      g.globalAlpha = 0.85;
      g.translate(250, 300);
      g.rotate(-0.06);
      g.fillStyle = hexA(p.panel, 0.9);
      g.strokeStyle = hexA(p.accentHot, 0.6);
      g.lineWidth = 2;
      g.beginPath(); g.roundRect(-170, -70, 340, 140, 10); g.fill(); g.stroke();
      g.fillStyle = hexA(p.sub, 1);
      g.font = '500 22px "Microsoft YaHei", Inter, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(P.noteKicker ?? 'night shift', 0, -34);
      g.fillStyle = hexA(p.text, 1);
      g.font = '700 30px "Microsoft YaHei", Inter, sans-serif';
      g.fillText(P.noteTitle ?? 'losing it, cheerfully', 0, 8);
      g.fillStyle = hexA(p.mute, 0.9);
      g.font = '400 16px Inter, sans-serif';
      g.fillText(P.noteSource ?? '— a listener', 0, 46);
      g.restore();

      // Lyric: overlay above the phone, not covering the screen center
      const { cur } = lyricsOf(ctx).activeAt(tv);
      if (cur) {
        const hitRe = P.hitLine ? new RegExp(P.hitLine, 'i') : /delete|delete/i;
        const isHit = hitRe.test(cur.text);
        if (isHit) {
          stamp(g, cur.text, 1580, 250, tv, cur.t, {
            size: 54, rot: -0.16, color: hexA('#ff3b5c', 0.92), frame: true,
          });
        } else {
          kinetic(g, cur.text, 960, 120, tv, cur.t, {
            size: 54, color: p.text, hot: p.accentHot, ghost: p.accent,
            step: 0.1, settle: 0.22, font: WORD,
          });
        }
      }

      // Bottom ticker: the comment thread as a news crawl
      ticker(g, P.tickerText ?? 'no overtime   ·   no more meetings   ·   out of office   ·   deleting myself', 0, 1004, 1920, 62, tv, {
        size: 30, bg: hexA('#000000', 0.72), fg: hexA(p.sub, 0.95), speed: 130,
        label: P.tickerLabel ?? 'comments', font: WORD,
      });

}


/**
 * Scene `erase` — default length 22.5s.
 * Params (all optional) override the storyboard's content; see docs/scenes.md.
 */
export function erase(ctx, tv, f, P = { 'start': 119.8 }) {
      const p = ctx.pal, g = ctx.g;
      ctx.clear();
      const t0 = tv - P.start;
      const k = clamp01((t0 - 1.0) / 17); // sweep left→right over the shot

      // Floor plan being erased
      floorplanErase(g, p, tv, f, k, { cols: 16, rows: 9 });

      // Wipe edge: a vertical energy band where rooms are being deleted
      const cellW = 1920 / 16;
      const frontX = clamp01(k) * (16 + 3) * cellW - 1.5 * cellW;
      const wipe = g.createLinearGradient(frontX - 300, 0, frontX + 30, 0);
      wipe.addColorStop(0, hexA(p.accentHot, 0));
      wipe.addColorStop(0.72, hexA(p.accentHot, 0.16));
      wipe.addColorStop(1, hexA(p.accentHot, 0.5));
      g.fillStyle = wipe;
      g.fillRect(frontX - 300, 0, 330, 1080);
      g.strokeStyle = hexA('#ffffff', 0.5 + f.onsetPulse * 0.3);
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(frontX, 0); g.lineTo(frontX, 1080); g.stroke();

      // The eraser cursor rides the wave front, high enough to clear the lyric
      eraserCursor(g, p, frontX, 190 + Math.sin(tv * 1.6) * 26, k, { size: 1.2 });
      speedLines(g, frontX, 190, tv, 0.45 + f.onsetPulse * 0.25, p.accentHot, 33, {
        n: 26, rMin: 90, rMax: 620, width: 2,
      });

      // Rubber stamps in a deliberate diagonal stack on the right
      for (let i = 0; i < 7; i++) {
        const st = 119.8 + 1.0 + i * 1.5;
        if (tv <= st) continue;
        const sx = 1380 + (i % 2) * 150 + i * 12;
        const sy = 150 + i * 118;
        stamp(g, 'DELETE', sx, sy, tv, st, {
          size: 34, rot: -0.22 + (i % 3) * 0.08, color: hexA(p.accentHot, 0.8),
          frame: false, alpha: 0.9, holes: 0,
        });
      }

      // Lyric — bottom third, on a scrim, clear of the cursor
      const { cur } = lyricsOf(ctx).activeAt(tv);
      if (cur) {
        const scrim = g.createLinearGradient(0, 720, 0, 1080);
        scrim.addColorStop(0, hexA('#000000', 0));
        scrim.addColorStop(0.45, hexA('#000000', 0.55));
        scrim.addColorStop(1, hexA('#000000', 0.8));
        g.fillStyle = scrim;
        g.fillRect(0, 720, 1920, 360);
        const isHit = /delete|forget/i.test(cur.text);
        kinetic(g, cur.text, 960, 890, tv, cur.t, {
          size: isHit ? 96 : 68,
          color: isHit ? '#ffffff' : p.text, hot: p.accentHot, ghost: p.accent,
          step: 0.12, settle: 0.24, font: WORD,
        });
      }
      // Beat strobe
      if (f.beatPulse > 0.62) {
        g.fillStyle = hexA(p.accent, (f.beatPulse - 0.62) * 0.55);
        g.fillRect(0, 0, 1920, 1080);
      }
      if (f.onsetPulse > 0.5) glitchSlices(g, f, tv);

}


/**
 * Scene `delete` — default length 24.2s.
 * Params (all optional) override the storyboard's content; see docs/scenes.md.
 */
export function voidScene(ctx, tv, f, P = { 'start': 142.3 }) {
      const p = ctx.pal, g = ctx.g;
      ctx.clear();
      const t0 = tv - P.start;

      // Rotating rays
      for (let i = 0; i < 32; i++) {
        const a = (i / 32) * Math.PI * 2 + tv * 0.25;
        g.strokeStyle = hexA(p.accentHot, 0.06 + f.high * 0.14);
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(960 + Math.cos(a) * 140, 520 + Math.sin(a) * 140);
        g.lineTo(960 + Math.cos(a) * 1100, 520 + Math.sin(a) * 1100);
        g.stroke();
      }
      // ...then recedes once the album cover arrives, so the title reads clean.
      const endK = clamp01((t0 - 13.5) / 5);
      // DELETE wall texture, calming down for the title card
      wall(g, 'DELETE', tv, {
        x: 0, y: 0, w: 1920, h: 1080, size: 96,
        alpha: (0.05 + f.onsetPulse * 0.09) * (1 - 0.6 * endK),
        color: p.accent, shiftSpeed: 34, font: WORD,
      });
      // Black hole opens in the second half of the shot
      const holeK = clamp01((t0 - 6) / 10);
      g.save();
      g.globalAlpha = 1 - 0.62 * endK;
      if (holeK > 0) blackHole(g, p, tv, f, holeK, { cx: 960, cy: 250 });
      radialSpectrum(g, f, p, 960, 250, 470, 32);
      particles(g, f, p, tv, 110);
      g.restore();

      // Lyric
      const { cur } = lyricsOf(ctx).activeAt(tv);
      const vre = (src) => (src ? new RegExp(src, 'i') : null);
      const stampRe = vre(P.stampLine), splitRe = vre(P.splitLine);
      if (cur) {
        const age = tv - cur.t;
        if (/^\d{2}:\d{2}\.\d{3}/.test(cur.text) || /Written by|Arranged|Producer|Engineer|Bass|Mixing|Copyright/i.test(cur.text)) {
          // Credits flow quietly at the bottom instead of being glitched.
          g.save();
          g.globalAlpha = clamp01(age / 0.4) * 0.9;
          g.fillStyle = hexA(p.sub, 0.95);
          g.font = '400 24px "Microsoft YaHei", Inter, sans-serif';
          g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(cur.text, 960, 1010);
          g.restore();
        } else if (stampRe && stampRe.test(cur.text)) {
          // giant stamped delete
          stamp(g, 'DELETE', 960, 500 + Math.sin(tv * 3) * 6, tv, cur.t, {
            size: 190, rot: -0.05, color: hexA(p.accentHot, 0.95), frame: true,
          });
          if (age < 0.5) doBurstSafe(g, 960, 500, tv, cur.t, p);
        } else if (splitRe && splitRe.test(cur.text)) {
          rgbSplitText(g, cur.text.toUpperCase(), 960, 880, 86, {
            split: 10 + f.onsetPulse * 16, color: '#ffffff', font: WORD,
          });
        } else {
          decode(g, cur.text, 960, 880, tv, cur.t, {
            size: 64, hot: p.accentHot, color: p.text,
          });
        }
      }

      // Album window appears near the end: the song announcing itself.
      albumWindow(g, p, tv, P.start + (P.albumAt ?? 14.3), {
        x: 560, y: 240, w: 800, h: 280,
        title: P.albumTitle ?? 'album title',
        subtitle: P.albumSubtitle ?? '',
        windowTitle: P.albumTitle ?? 'album title',
      });

      // Strobe on the beat
      if (f.beatPulse > 0.6) {
        g.fillStyle = hexA(p.accent, (f.beatPulse - 0.6) * 0.5);
        g.fillRect(0, 0, 1920, 1080);
      }
      if (f.onsetPulse > 0.45) glitchSlices(g, f, tv);

}


/**
 * Scene `kitchen` — default length 9.0s.
 * Params (all optional) override the storyboard's content; see docs/scenes.md.
 */
export function kitchenScene(ctx, tv, f, P = { 'start': 166.5 }) {
      const p = ctx.pal, g = ctx.g;
      ctx.clear();
      kitchen(g, p, tv, f, { floorY: 840 });

      // Credits scroll (from LRC 162.9+)
      const { cur } = lyricsOf(ctx).activeAt(tv);
      if (cur) {
        const age = tv - cur.t;
        if (age >= 0) {
          g.save();
          g.globalAlpha = clamp01(age / 0.5) * clamp01((5.0 - age) / 1.2);
          g.fillStyle = hexA(p.sub, 0.95);
          g.font = '400 26px "Microsoft YaHei", Inter, sans-serif';
          g.textAlign = 'right'; g.textBaseline = 'middle';
          g.fillText(cur.text, 1840, 980);
          g.restore();
        }
      }
      // A last warm line
      g.save();
      g.globalAlpha = clamp01((tv - (P.start + 1.5)) / 2) * 0.9;
      g.fillStyle = hexA(p.accentHot, 0.95);
      g.font = '300 46px "Microsoft YaHei", Georgia, serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(P.punchline ?? 'some things cannot be deleted.', 960, 520);
      g.restore();
      particles(g, f, p, tv, 30);

}


/**
 * Scene `logout` — default length 6.0s.
 * Params (all optional) override the storyboard's content; see docs/scenes.md.
 */
export function logout(ctx, tv, f, P = { start: 0 }) {
      const p = ctx.pal, g = ctx.g;
      ctx.clear();
      // Every beat of this shot is expressed relative to the shot's own start and
      // end, so the same scene works at any point in any song.
      const s = P.start ?? 0;
      const e = P.end ?? (s + 6);
      // The dawn kitchen stays behind, dimming as the dialog takes over.
      kitchen(g, p, tv, f, { floorY: 840 });
      g.fillStyle = hexA('#000000', 0.18);
      g.fillRect(0, 0, 1920, 1080);
      particles(g, f, p, tv, 22);

      logOutDialog(g, p, tv, s + 0.1, {
        x: 460, y: 300, w: 1000, h: 400,
        question: P.question ?? ['if this dull life is a game,', 'would you press quit?'],
        cancel: P.cancelLabel ?? 'cancel',
        confirm: P.quitLabel ?? 'quit',
      });

      // Cursor glides to the cancel button and clicks
      const k = clamp01((tv - (s + 1.7)) / 1.6);
      cursorTo(g, [1500, 900], [830, 614], k, { size: 1.1 });
      if (tv > s + 3.4) {
        const ck = clamp01((tv - (s + 3.4)) / 0.5);
        g.strokeStyle = hexA(p.accentHot, (1 - ck) * 0.9);
        g.lineWidth = 4;
        g.beginPath(); g.arc(830, 614, 20 + ck * 80, 0, Math.PI * 2); g.stroke();
      }

      // Fade to black + END
      const fadeK = clamp01((tv - (e - 2.1)) / Math.max(0.2, Math.min(1.6, e - s - 2.1)));
      if (fadeK > 0) {
        g.fillStyle = hexA('#000000', fadeK);
        g.fillRect(0, 0, 1920, 1080);
      }
      if (tv > e - 1.6) {
        g.globalAlpha = clamp01((tv - (e - 1.6)) / 1.0) * 0.85;
        g.fillStyle = '#c8b8a8';
        g.font = '300 40px Inter, "Microsoft YaHei", sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(P.endText ?? 'the end', 960, 540);
        g.globalAlpha = 1;
      }
}

// ---------- local drawing helpers ----------
// Each scene reads the shared lyrics off the context, so scene functions stay
// pure: (ctx, tv, f, P) with no module-level state.
function lyricsOf(ctx) { return ctx.lyr || { activeAt: () => ({ cur: null }) }; }

/**
 * Scene `field` — a background made of primitives, one motif, and the lyrics.
 *
 * This is the scene you reach for when the song is not about an office. It does
 * not know what the song is about; it only knows texture (paper/water/rain/…)
 * and, optionally, one object. Everything else comes from `params`.
 *
 * Params (all optional):
 *   layer    paper | water | rain | snow | ink | motes | thread | window
 *   motif    boat | window | moon | lantern | chair | birds
 *   motifAt  [x, y, size]
 *   folds    number of fold creases (paper layer)
 *   horizon  water horizon line, px from top (water layer)
 *   density  streak count (rain layer)
 *   lyricY / lyricX / lyricSize   where the line lands
 *   still    a string to hold on screen when no lyric is active
 *   caption  small mono caption, bottom left
 */
export function field(ctx, tv, f, P = { 'start': 0.0 }) {
  const p = ctx.pal, g = ctx.g;
  ctx.clear();
  const s = P.start ?? 0;
  const t0 = tv - s;                       // seconds inside this shot
  const cam = ctx.cam ?? { depth: () => ({ x: 0, y: 0 }) };
  const layer = P.layer ?? 'paper';

  // --- depth offsets -------------------------------------------------------
  // Three planes: a slow back wash, the layer itself, and near foreground
  // specks. Parallax is what makes a push-in read as movement through space.
  const back = cam.depth(0.12);
  const mid = cam.depth(0.45);
  const near = cam.depth(1.0);

  // --- back plane ----------------------------------------------------------
  const wash = g.createLinearGradient(0, 0, 0, 1080);
  wash.addColorStop(0, hexA(p.panel, 1));
  wash.addColorStop(1, hexA(p.bg, 1));
  g.fillStyle = wash;
  g.fillRect(-120, -120, 2160, 1320);

  g.save();
  g.translate(back.x, back.y);
  if (layer === 'paper' || layer === 'ink' || layer === 'motes' || layer === 'thread') {
    grainField(g, p, tv, f, { alpha: 0.16 });
  }
  if (layer === 'motes') {
    lightShaft(g, p, P.shaftX ?? 760, -80, 540, 1300, { alpha: 0.16 + (f.rmsEnv ?? 0) * 0.06 });
  }
  g.restore();

  // --- mid plane: the texture that defines the world ------------------------
  g.save();
  g.translate(mid.x, mid.y);
  const drift = (t0 * 9) % 240;            // slow sideways travel, wraps

  if (layer === 'paper') {
    foldCreases(g, p, tv, f, { n: P.folds ?? 3, alpha: 0.45, offset: drift * 0.2 });
    paperScraps(g, p, tv, f, { n: P.scraps ?? 7 });
  } else if (layer === 'water') {
    waterSurface(g, p, tv, f, { horizon: P.horizon ?? 600, reflectX: P.motifX ?? 960 });
    waterRipples(g, p, tv, f, { horizon: P.horizon ?? 600, n: P.ripples ?? 12 });
    if (P.rain) rainBand(g, p, tv, f, { n: 90, alpha: 0.2, vy: 620, vx: 40, w: 1.4, spread: 0.5 });
  } else if (layer === 'rain') {
    // far band slow and thin, near band fast and wide: the shot gains depth
    rainBand(g, p, tv, f, { n: 220, alpha: 0.16, vy: 520, vx: 60, w: 1.1, spread: 1.0 });
    rainBand(g, p, tv, f, { n: 120, alpha: 0.3, vy: 900, vx: 110, w: 1.7, spread: 1.15, seed: 7 });
    rainBand(g, p, tv, f, { n: 40, alpha: 0.45, vy: 1400, vx: 170, w: 2.6, spread: 1.3, seed: 19 });
    puddleRings(g, p, tv, f, { y: P.puddleY ?? 820 });
  } else if (layer === 'snow') {
    driftMotes(g, p, tv, f, { n: P.density ?? 180, size: 2.6, alpha: 0.6, rise: 44 });
    driftMotes(g, p, tv, f, { n: 40, size: 5.2, alpha: 0.4, rise: 30, seed: 11 });
  } else if (layer === 'ink') {
    // the stain keeps spreading for the whole shot
    inkBleed(g, p, tv, f, { x: P.motifAt?.[0] ?? 960, y: P.motifAt?.[1] ?? 430, r: (P.r ?? 260) * (0.72 + 0.42 * clamp01(t0 / 14)), breathe: t0 });
  } else if (layer === 'motes') {
    driftMotes(g, p, tv, f, { n: 130, alpha: 0.5, rise: 26 });
  } else if (layer === 'thread') {
    threadLines(g, p, tv, f, { n: P.threads ?? 16, t0 });
    driftMotes(g, p, tv, f, { n: 40, alpha: 0.32 });
  } else if (layer === 'window') {
    const [wx, wy, ww, wh] = P.pane ?? [120, 96, 1680, 886];
    litWindow(g, p, wx, wy, ww, wh, { warm: false });
    g.save();
    g.beginPath();
    g.rect(wx + 6, wy + 6, ww - 12, wh - 12);
    g.clip();
    rainBand(g, p, tv, f, { n: 170, alpha: 0.3, vy: 700, vx: 70, w: 1.5, spread: 1.05, seed: 3 });
    rainBand(g, p, tv, f, { n: 46, alpha: 0.42, vy: 1150, vx: 120, w: 2.4, spread: 1.2, seed: 23 });
    if (P.moon) moonDisc(g, p, wx + ww * 0.74, wy + wh * 0.28, ww * 0.045, { phase: 0.45 });
    g.restore();
    // a bead of water running down the glass
    const beadY = wy + 40 + ((t0 * 46) % (wh - 90));
    g.strokeStyle = hexA(p.sub, 0.3);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(wx + ww * 0.34, beadY);
    g.quadraticCurveTo(wx + ww * 0.35, beadY + 26, wx + ww * 0.34, beadY + 54);
    g.stroke();
  }
  g.restore();

  // --- motif: entrance, idle, beat reaction --------------------------------
  const motif = P.motif;
  if (motif) {
    const [mx, my, ms] = P.motifAt ?? [960, 560, 220];
    const inK = rampE(tv, s + (P.enterAt ?? 0.2), P.enterDur ?? 1.15, ease.outBack);
    // f.sinceBeat is seconds since the last beat; the kick decays from it.
    const kick = f.onsetPulse > 0.52 ? decay(f.sinceBeat ?? 99, 0, 0.34) : 0;
    const idle = bob(tv, P.idle ?? 5, P.idleHz ?? 0.32);
    // Travel: over the shot the motif crosses the frame, so a long take reads
    // as movement rather than a poster. Defaults suit each motif.
    const dur = P.dur ?? 18;
    const trav = P.travel ?? (motif === 'boat' ? [170, -14] : motif === 'birds' ? [340, -60] : motif === 'lantern' ? [0, 0] : [56, 0]);
    const travK = ease.inOutQuad(clamp01(t0 / dur));
    const motX = mx + trav[0] * travK;
    const motY = my + trav[1] * travK + idle - (1 - inK) * 74 - kick * 6;
    // Motif story beats: the same subject can drift, sink, or come back, so a
    // handful of shots can tell a small story with one prop.
    const stage = P.stage ?? 'drift';
    let sinkK = 0, sinkRot = 0, riseK = 0;
    if (stage === 'sink') {
      sinkK = ease.inQuad(clamp01((t0 - dur * (P.sinkAt ?? 0.55)) / Math.max(1.2, dur * 0.3)));
      sinkRot = sinkK * 0.5;
    } else if (stage === 'return') {
      riseK = 1 - ease.outCubic(clamp01(t0 / Math.max(1.4, P.riseDur ?? 2.6)));
    }
    const motS = ms * (0.94 + 0.06 * inK) * (1 + kick * 0.018) * (1 - sinkK * 0.12);
    const motR = (P.rot ?? -0.03) + Math.sin(tv * 0.55) * 0.028 + kick * 0.012 + sinkRot;

    g.save();
    g.globalAlpha = clamp01(inK * 1.2) * (1 - sinkK * 0.85);
    const mo = cam.depth(0.78);
    g.translate(mo.x, mo.y + sinkK * motS * 0.85 + riseK * motS * 1.6);
    if (motif === 'boat') {
      if (layer === 'water') wake(g, p, motX, motY, motS, tv, f);
      paperBoat(g, p, motX, motY, motS, { rot: motR });
    }
    else if (motif === 'window') litWindow(g, p, motX - motS * 1.6, motY - motS * 1.1, motS * 3.2, motS * 2.2);
    else if (motif === 'moon') moonDisc(g, p, motX, motY + idle * 0.3, motS * 0.55, { phase: P.phase ?? 0.15 });
    else if (motif === 'lantern') lantern(g, p, motX, motY, motS * 0.6, { sway: Math.sin(tv * 0.8) * 0.05 + kick * 0.03 });
    else if (motif === 'chair') emptyChair(g, p, motX, motY, motS * 1.4, { rot: motR * 0.6 });
    else if (motif === 'birds') birdLine(g, p, motX, motY, motS * 2.4, { t: tv, flyAway: P.flyAway ?? 0 });
    g.restore();

    // the reaction the motif leaves in the world: expanding rings
    if (P.events !== false && f.onsetPulse > 0.55) {
      ringPulse(g, p, motX, motY + motS * 0.62, decay(f.sinceBeat ?? 99, 0, 0.9), p.accentHot);
    }
  }

  // --- near plane: foreground specks, faster than everything --------------
  g.save();
  g.translate(near.x * 1.6, near.y * 1.6);
  driftMotes(g, p, tv, f, { n: P.near ?? 26, size: 3.4, alpha: 0.3, rise: 60, seed: 31 });
  g.restore();

  // --- type ---------------------------------------------------------------
  if (P.run && P.run.length) {
    g.font = `500 20px ${MONO}`;
    g.fillStyle = hexA(p.mute, 0.7);
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(P.run, 96, 132);
  }

  const { cur } = lyricsOf(ctx).activeAt(tv);
  const size = P.lyricSize ?? 92;
  const y = P.lyricY ?? 880;
  const x = P.lyricX ?? 960;
  if (cur && tv - cur.t < 8) {
    const style = P.lyricStyle ?? 'kinetic';
    if (style === 'karaoke') {
      karaokeLine(g, cur.text, x, y, tv, cur.t, {
        size, dim: hexA(p.text, 0.26), hot: p.text, accent: p.accentHot, font: WORD,
        chars: charTimings(cur, P.lineRate ?? 0.11),
        rate: P.lineRate ?? 0.11,
      });
    } else if (style === 'plain') {
      g.font = `700 ${size}px ${WORD}`;
      g.fillStyle = p.text;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(cur.text, x, y);
    } else {
      kinetic(g, cur.text, x, y, tv, cur.t, {
        size, color: p.text, hot: p.accentHot, ghost: p.accent,
        step: 0.16, settle: 0.32, font: WORD,
      });
    }
  } else if (P.still) {
    g.font = `700 ${size}px ${WORD}`;
    g.fillStyle = hexA(p.mute, 0.55);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(P.still, x, y);
  }

  if (P.caption) {
    g.font = `500 22px ${MONO}`;
    g.fillStyle = hexA(p.sub, 0.8);
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(P.caption, 96, 1006);
  }

  // Opt-in: slicing through a settled lyric line usually reads as a decode
  // error rather than as energy, so `field` stays clean unless asked.
  if (P.glitch && f.onsetPulse > 0.55) glitchSlices(g, f, tv);
}

// --- field helpers ---------------------------------------------------------

/** One depth band of rain, falling with its own speed and slant. */
function rainBand(g, p, tv, f, { n = 140, alpha = 0.3, vy = 700, vx = 60, w = 1.5, spread = 1, seed = 1 }) {
  const rnd = mulberry32(seed * 7919 + 13);
  g.save();
  g.strokeStyle = hexA(p.sub, alpha);
  g.lineWidth = w;
  g.lineCap = 'round';
  const h = 1160, wdt = 2000;
  for (let i = 0; i < n; i++) {
    const bx = rnd() * wdt - 40;
    const phase = rnd();
    const len = 22 + rnd() * 46 * spread;
    const y = ((phase * h + tv * vy) % h) - 40;
    const x = bx + (y / h) * vx * (0.6 + rnd() * 0.8);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x - vx * 0.02 * len, y + len);
    g.stroke();
  }
  g.restore();
}

/** Sun glitter / current lines on a water surface. */
function waterRipples(g, p, tv, f, { horizon = 600, n = 26 }) {
  g.save();
  for (let i = 0; i < n; i++) {
    const d = i / n;
    const y = horizon + 22 + Math.pow(d, 1.8) * 360;
    const amp = 1.5 + d * 5;
    const speed = 0.5 + d * 1.3;
    const alpha = (0.06 + (1 - d) * 0.1 + (f.rmsEnv ?? 0) * 0.04) * 0.9;
    g.strokeStyle = hexA(p.accentHot, alpha);
    g.lineWidth = 1 + d * 1.2;
    // short segment instead of a full-width rule: reads as water, not scanlines
    const x0 = 260 + ((i * 137) % 900) - d * 120;
    const len = 320 + d * 520;
    g.beginPath();
    for (let x = x0; x <= x0 + len; x += 32) {
      const yy = y + Math.sin((x * 0.008) + tv * speed + i) * amp;
      if (x === x0) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
  }
  g.restore();
}

/** Concentric rings where rain lands, on a puddle near the camera. */
function puddleRings(g, p, tv, f, { y = 820 }) {
  const rnd = mulberry32(4242);
  g.save();
  for (let i = 0; i < 5; i++) {
    const cycle = 1.6 + rnd() * 1.4;
    const phase = (tv + rnd() * 10) % cycle;
    const k = phase / cycle;
    const cx = 160 + rnd() * 1600;
    const r = 6 + k * 54;
    g.strokeStyle = hexA(p.sub, (1 - k) * 0.3);
    g.lineWidth = 1.4;
    g.beginPath();
    g.ellipse(cx, y + rnd() * 40, r, r * 0.28, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
}

/** A single expanding ring, used as the motif's reaction to a strong beat. */
function ringPulse(g, p, cx, cy, k, color) {
  if (k <= 0) return;
  g.save();
  g.globalAlpha = k * 0.5;
  g.strokeStyle = hexA(color, 0.8);
  g.lineWidth = 2 + k * 3;
  g.beginPath();
  g.ellipse(cx, cy, 60 + (1 - k) * 260, (60 + (1 - k) * 260) * 0.3, 0, 0, Math.PI * 2);
  g.stroke();
  g.restore();
}

/** Karaoke fill: the sung part of the line is bright, the rest is dim. */
/**
 * Per-character times for a lyric line.
 *
 * With word marks (enhanced LRC) each fragment's characters are spread across
 * the gap to the next fragment, so the highlight follows the voice. Without
 * them we fall back to a constant reading rate.
 */
export function charTimings(line, rate = 0.11) {
  const chars = [...(line?.text ?? '')];
  if (!line) return [];
  if (!line.words || !line.words.length) {
    return chars.map((_, i) => line.t + i * rate);
  }
  const out = [];
  for (let w = 0; w < line.words.length; w++) {
    const seg = [...line.words[w].text];
    const next = line.words[w + 1];
    const dt = next ? Math.max(0.08, next.t - line.words[w].t) : Math.max(0.08, seg.length * rate);
    const step = dt / Math.max(1, seg.length);
    for (let i = 0; i < seg.length; i++) out.push(line.words[w].t + i * step);
  }
  return out.slice(0, chars.length);
}

function karaokeLine(g, text, x, y, tv, t0, { size = 92, dim, hot, accent, font = WORD, rate = 0.16, chars: timings = null } = {}) {
  const chars = [...text];
  g.save();
  g.font = `700 ${size}px ${font}`;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  const widths = chars.map((c) => g.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0);
  let px = x - total / 2;
  const sung = timings && timings.length
    ? timings.reduce((n, t) => n + (t <= tv ? 1 : 0), 0)
    : Math.min(chars.length, Math.max(0, (tv - t0) / rate));
  for (let i = 0; i < chars.length; i++) {
    const on = i < Math.floor(sung);
    g.fillStyle = on ? hot : dim;
    g.fillText(chars[i], px, y + (on ? 0 : 2));
    if (i === Math.floor(sung)) {
      // a soft leading edge that reads as the voice arriving
      g.fillStyle = hexA(accent, 0.5);
      g.fillRect(px, y + size * 0.52, widths[i], 3);
    }
    px += widths[i];
  }
  g.restore();
}


/**
 * `designed` — compose a shot out of actors instead of writing code.
 *
 * Three depth planes, each a list of props with choreography. This is the
 * cheap path for a bespoke shot: new imagery usually means new *arrangement*
 * of the primitives, not new drawing code.
 *
 * params:
 *   layer       base texture: paper | water | rain | snow | ink | motes | thread | window | none
 *   horizon     water/rain: where the surface starts
 *   back[]      far plane actors   (parallax 0.2)
 *   mid[]       middle plane       (parallax 0.5)
 *   near[]      near plane         (parallax 0.95)
 *   lyricStyle / lyricY / lyricSize / caption / still / run / glitch
 */
export function designed(ctx, tv, f, P = { start: 0 }) {
  const p = ctx.pal, g = ctx.g;
  ctx.clear();
  const s = P.start ?? 0;
  const t0 = tv - s;
  const dur = P.dur ?? Math.max(1, (P.end ?? s + 18) - s);
  const cam = ctx.cam ?? { depth: () => ({ x: 0, y: 0 }) };

  // Events can move the whole frame (shake, punch); they wrap everything.
  g.save();
  eventsBegin(g, p, P.events, t0, 1920, 1080);

  // base wash
  const wash = g.createLinearGradient(0, 0, 0, 1080);
  wash.addColorStop(0, hexA(p.panel, 1));
  wash.addColorStop(1, hexA(p.bg, 1));
  g.fillStyle = wash;
  g.fillRect(-120, -120, 2160, 1320);

  // base texture: reuse the same layer vocabulary as `field`
  const layer = P.layer ?? 'none';
  if (layer !== 'none') {
    const mid = cam.depth(0.4);
    g.save();
    g.translate(mid.x, mid.y);
    if (layer === 'paper') { grainField(g, p, tv, f, { alpha: 0.16 }); foldCreases(g, p, tv, f, { n: P.folds ?? 3, alpha: 0.42 }); }
    else if (layer === 'water') { waterSurface(g, p, tv, f, { horizon: P.horizon ?? 640, reflectX: P.reflectX ?? 960 }); }
    else if (layer === 'rain') { grainField(g, p, tv, f, { alpha: 0.1 }); rainField(g, p, tv, f, { density: P.density ?? 200, alpha: 0.32 }); }
    else if (layer === 'snow') { grainField(g, p, tv, f, { alpha: 0.08 }); driftMotes(g, p, tv, f, { n: P.density ?? 170, size: 3, alpha: 0.6, rise: 40 }); }
    else if (layer === 'ink') { grainField(g, p, tv, f, { alpha: 0.12 }); inkBleed(g, p, tv, f, { x: P.inkAt?.[0] ?? 960, y: P.inkAt?.[1] ?? 480, r: P.r ?? 300, breathe: t0 }); }
    else if (layer === 'motes') { lightShaft(g, p, P.shaftX ?? 760, -80, 560, 1300, { alpha: 0.15 }); driftMotes(g, p, tv, f, { n: 130, alpha: 0.5, rise: 28 }); }
    else if (layer === 'thread') { threadLines(g, p, tv, f, { n: P.threads ?? 16, t0 }); driftMotes(g, p, tv, f, { n: 40, alpha: 0.3 }); }
    else if (layer === 'window') {
      const [wx, wy, ww, wh] = P.pane ?? [140, 96, 1640, 880];
      litWindow(g, p, wx, wy, ww, wh, { warm: false });
      g.save(); g.beginPath(); g.rect(wx + 6, wy + 6, ww - 12, wh - 12); g.clip();
      rainField(g, p, tv, f, { density: P.density ?? 180, alpha: 0.28 });
      if (P.moon) moonDisc(g, p, wx + ww * 0.74, wy + wh * 0.28, ww * 0.045, { phase: 0.45 });
      g.restore();
    }
    g.restore();
  }

  // three planes of actors
  const planes = [
    ['back', 0.2, P.back],
    ['mid', 0.5, P.mid],
    ['near', 0.95, P.near],
  ];
  for (const [, depth, list] of planes) {
    for (const a of asActors(list)) {
      drawActor(g, p, a, tv, f, { cam, depth, t0, dur });
    }
  }

  // Inserts: a cut to a detail inside an otherwise long shot. The storyboard
  // names a window and a focus; the frame punches in on it, which is how a
  // 20-second shot stops reading as one static image.
  let insertK = 0;
  let focus = [0.5, 0.5];
  if (Array.isArray(P.inserts)) {
    for (const ins of P.inserts) {
      const a = ins.at ?? 0;
      const d = ins.dur ?? 1.4;
      if (t0 >= a && t0 <= a + d) {
        const edge = Math.min(t0 - a, a + d - t0);
        insertK = Math.min(1, edge / 0.22);
        focus = ins.focus ?? [0.5, 0.5];
      }
    }
  }
  const zoom = insertK > 0 ? 1 + (P.insertZoom ?? 1.7) * insertK : 1;

  g.save();
  if (zoom !== 1) {
    const fx = focus[0] * 1920;
    const fy = focus[1] * 1080;
    g.translate(fx, fy);
    g.scale(zoom, zoom);
    g.translate(-fx, -fy);
  }

  // A shot can also be written as JSON: shapes, strokes, type, particles, each
  // with a depth and a motion. This is the lane an agent uses for imagery the
  // prop library has never heard of.
  if (P.elements) {
    drawElements(g, p, P.elements, tv, f, { width: 1920, height: 1080, start: s, cam });
  }
  g.restore();

  // One light source, applied over the whole frame: the cheapest way to make a
  // pile of shapes read as a place with air in it.
  const light = P.light;
  if (light) {
    const lx = (light.at?.[0] ?? 0.5) * 1920;
    const ly = (light.at?.[1] ?? 0.4) * 1080;
    const rad = (light.r ?? 0.75) * 1920;
    const strength = (light.strength ?? 0.3) * (1 + (f.barPulse ?? 0) * 0.25);
    const col = light.role && p[light.role] ? p[light.role] : (light.color ?? p.accentHot);
    const grd = g.createRadialGradient(lx, ly, 0, lx, ly, rad);
    grd.addColorStop(0, hexA(col, Math.min(0.85, strength)));
    grd.addColorStop(0.45, hexA(col, Math.min(0.5, strength * 0.45)));
    grd.addColorStop(1, hexA(col, 0));
    g.save();
    g.globalCompositeOperation = light.blend ?? 'lighter';
    g.fillStyle = grd;
    g.fillRect(0, 0, 1920, 1080);
    g.restore();
  }

  eventsEnd(g, p, P.events, t0, 1920, 1080);
  g.restore();

  // type
  if (P.run) {
    g.font = `500 20px ${MONO}`;
    g.fillStyle = hexA(p.mute, 0.7);
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(P.run, 96, 132);
  }
  const { cur } = lyricsOf(ctx).activeAt(tv);
  const size = P.lyricSize ?? 92;
  const ly = P.lyricY ?? 880;
  if (cur && tv - cur.t < 8) {
    const style = P.lyricStyle ?? 'karaoke';
    if (style === 'karaoke') karaokeLine(g, cur.text, 960, ly, tv, cur.t, { size, dim: hexA(p.text, 0.26), hot: p.text, accent: p.accentHot, font: WORD, chars: charTimings(cur, P.lineRate ?? 0.11), rate: P.lineRate ?? 0.11 });
    else if (style === 'plain') {
      g.font = `700 ${size}px ${WORD}`; g.fillStyle = p.text;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(cur.text, 960, ly);
    } else {
      kinetic(g, cur.text, 960, ly, tv, cur.t, { size, color: p.text, hot: p.accentHot, ghost: p.accent, step: 0.16, settle: 0.32, font: WORD });
    }
  } else if (P.still) {
    g.font = `700 ${size}px ${WORD}`; g.fillStyle = hexA(p.mute, 0.55);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(P.still, 960, ly);
  }
  if (P.caption) {
    g.font = `500 22px ${MONO}`; g.fillStyle = hexA(p.sub, 0.8);
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(P.caption, 96, 1006);
  }
  if (P.glitch && f.onsetPulse > 0.55) glitchSlices(g, f, tv);
}

/**
 * Scene `typeOnly` — the lyrics are the picture. No props at all.
 *
 * Use it when the song's best image is a sentence: the chorus, the last line,
 * the thing you do not want to illustrate.
 *
 * Params:
 *   lines    array of strings (defaults to the active lyric)
 *   layout   stack | column
 *   align    center | left
 *   size     type size in px (default 104)
 *   accent   a word to paint in accentHot
 *   kicker   small label, top left
 */
export function typeOnly(ctx, tv, f, P = { 'start': 0.0 }) {
  const p = ctx.pal, g = ctx.g;
  ctx.clear();

  const lyr = lyricsOf(ctx);
  const { cur, next } = lyr.activeAt(tv);
  const lines = P.lines ?? (cur ? [cur.text] : []);
  const size = P.size ?? 104;
  const layout = P.layout ?? 'stack';
  const leftX = 300;
  const s0 = cur ? cur.t : P.start;
  const age = tv - s0;

  // The page: paper, a faint echo of the line at 20x the size, drifting. Without
  // it a type card is a still image with letters on it.
  g.fillStyle = hexA(p.bg, 1);
  g.fillRect(0, 0, 1920, 1080);
  if (P.grain !== false) grainField(g, p, tv, f, { alpha: 0.1 });

  const subject = (lines[0] ?? '').slice(0, 12);
  if (subject) {
    g.save();
    g.globalAlpha = 0.03;
    g.font = `900 ${size * 3.4}px ${WORD}`;
    g.fillStyle = p.text;
    g.textAlign = 'left';
    g.textBaseline = 'top';
    const drift = ((tv * 34) % 700);
    g.fillText(subject, leftX - 120 - drift, 560);
    g.restore();
  }

  // the whole block rises a little as the line ages: the frame is never still
  const rise = Math.min(26, age * 9);

  if (P.kicker) {
    g.font = `600 20px ${MONO}`;
    g.fillStyle = hexA(p.sub, 0.85);
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(P.kicker, 96, 96);
  }

  g.textBaseline = 'middle';
  const total = lines.length;

  lines.forEach((text, i) => {
    const appear = s0 + i * 0.24;
    const k = clamp01((tv - appear) / 0.5);
    if (k <= 0) return;
    const e = 1 - Math.pow(1 - k, 3);
    const dy = (1 - e) * 46 - rise;

    let x, y;
    if (layout === 'column') {
      x = leftX;
      y = 210 + size * 0.7 + i * size * 1.34;
    } else {
      x = 960;
      y = 540 + (i - (total - 1) / 2) * size * 1.28;
    }

    g.globalAlpha = e;
    // a slight scale on entry: type that grows into place reads as arrival
    const sc = 0.965 + 0.035 * e;
    g.save();
    g.translate(x, y + dy);
    g.scale(sc, sc);
    g.translate(-x, -(y + dy));

    g.font = `800 ${size}px ${WORD}`;
    g.textAlign = layout === 'column' || P.align === 'left' ? 'left' : 'center';
    g.fillStyle = hexA(p.text, 1);

    let paintedAccent = false;
    if (P.accent) {
      const word = P.accent;
      const at = text.toLowerCase().indexOf(word.toLowerCase());
      if (at >= 0) {
        const before = text.slice(0, at);
        const after = text.slice(at + word.length);
        const wBefore = g.measureText(before).width;
        const wWord = g.measureText(word).width;
        const startX = g.textAlign === 'center' ? x - g.measureText(text).width / 2 : x;
        g.fillText(before, startX, y + dy);
        g.fillStyle = hexA(p.accentHot, 1);
        g.fillText(text.slice(at, at + word.length), startX + wBefore, y + dy);
        g.fillStyle = hexA(p.text, 1);
        g.fillText(after, startX + wBefore + wWord, y + dy);
        paintedAccent = true;
      }
    }
    if (!paintedAccent) g.fillText(text, x, y + dy);

    // a rule that draws itself under the current line
    const w = g.measureText(text).width;
    const rx = g.textAlign === 'center' ? x - w / 2 : x;
    const grow = clamp01((tv - appear - 0.18) / 0.8);
    if (grow > 0) {
      g.fillStyle = hexA(p.accentHot, 0.75 * e);
      g.fillRect(rx, y + dy + size * 0.62, w * grow, Math.max(2, size * 0.035));
    }
    g.restore();
    g.globalAlpha = 1;
  });
}


export const SCENES = {
  designed,
  // generic: work with any song, driven entirely by params
  field, typeOnly,
  // story-specific: drawn for one song about an office at 2 AM
  keyboard, desk, stampScene, emptyScene, call110, erase, voidScene, kitchenScene, logout,
};

export const SCENE_META = {
  keyboard: { start: 0.0, end: 13.1, enter: 'dissolve', palette: 'still' },
  desk: { start: 13.1, end: 39.1, enter: 'glitch', palette: 'tender' },
  stampScene: { start: 39.1, end: 65.8, enter: 'wipe', palette: 'build' },
  emptyScene: { start: 65.8, end: 95.1, enter: 'dissolve', palette: 'tender' },
  call110: { start: 95.1, end: 119.8, enter: 'cut', palette: 'intense' },
  erase: { start: 119.8, end: 142.3, enter: 'glitch', palette: 'intense' },
  voidScene: { start: 142.3, end: 166.5, enter: 'glitch', palette: 'peak' },
  kitchenScene: { start: 166.5, end: 175.5, enter: 'dissolve', palette: 'dawn' },
  logout: { start: 175.5, end: 181.5, enter: 'cut', palette: 'dawn' },
  // generic scenes: no built-in timing, no preferred palette
  field: { start: 0, end: 8, enter: 'dissolve', palette: 'tender' },
  typeOnly: { start: 0, end: 8, enter: 'cut', palette: 'still' },
};

/** Wake trailing a boat: two arcs and a fading bow wave. */
function wake(g, p, x, y, size, tv, f) {
  g.save();
  g.strokeStyle = hexA(p.accentHot, 0.28);
  g.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const k = ((tv * 0.6 + i * 0.33) % 1);
    g.globalAlpha = (1 - k) * 0.5;
    const w = size * (0.9 + k * 1.5);
    g.beginPath();
    g.ellipse(x - size * 0.25, y + size * 0.3 + k * 16, w, w * 0.16, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
}

/** Torn paper scraps crossing the frame, one per bar, each on its own arc. */
function paperScraps(g, p, tv, f, { n = 7 } = {}) {
  const rnd = mulberry32(913);
  g.save();
  for (let i = 0; i < n; i++) {
    const cycle = 9 + rnd() * 7;
    const phase = (tv + rnd() * cycle) % cycle;
    const k = phase / cycle;
    const y0 = 120 + rnd() * 800;
    const x = -80 + k * 2100;
    const y = y0 + Math.sin(k * Math.PI * 2 + i) * 26;
    const w = 16 + rnd() * 26;
    const h = w * (0.5 + rnd() * 0.5);
    g.save();
    g.translate(x, y);
    g.rotate(Math.sin(k * Math.PI * 2 + i * 1.7) * 0.5);
    g.globalAlpha = 0.16 + rnd() * 0.16;
    g.fillStyle = hexA(p.raised, 0.9);
    g.beginPath();
    g.moveTo(-w / 2, -h / 2);
    g.lineTo(w / 2, -h / 2 + 3);
    g.lineTo(w / 2 - 2, h / 2);
    g.lineTo(-w / 2 + 1, h / 2 - 2);
    g.closePath();
    g.fill();
    g.restore();
  }
  g.restore();
}
