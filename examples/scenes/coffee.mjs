/**
 * `coffee` — one mug on a counter, in morning light.
 *
 * Written for a song that compares a hard week to a cup of bitter coffee you
 * sweeten to get down. The mug is the cast; the song's three events are staged
 * on it:
 *
 *   sugarAt   a sugar cube drops in and dissolves   ("加点糖才能下嘴")
 *   stirAt    the spoon goes round, rings spread     ("苦里也能酿出甜")
 *   empty     the cup is drained, a stain is left    ("我笑着把它喝完")
 *
 * Everything else is ambient: steam that breathes with the vocal, light that
 * drifts, grain.
 *
 * Params: sugarAt, stirAt, empty, lyricY, lyricSize, still, caption,
 *         cupX, cupY, cupSize
 */
const WORD = '"Noto Sans", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif';

export function coffee(ctx, tv, f, P = { start: 0 }) {
  const p = ctx.pal, g = ctx.g;
  const { hexA, grainField, driftMotes, lightShaft } = ctx.lib;
  const { ease, rampE, decay, bob } = ctx.mo;
  const cam = ctx.cam ?? { depth: () => ({ x: 0, y: 0 }) };

  const s = P.start ?? 0;
  const t0 = tv - s;
  ctx.clear();

  // slideX drifts the whole group across the shot: for a shot whose only subject
  // is a cup, a slow lateral move is what makes it a shot instead of a still.
  const slideK = Math.min(1, Math.max(0, t0 / (P.slideDur ?? 12)));
  const cx = (P.cupX ?? 1160) + (P.slideX ?? 0) * ease.inOutCubic(slideK);
  const cy = P.cupY ?? 700;
  const size = P.cupSize ?? 1;

  // back plane: wall + morning light through a window we never see
  const back = cam.depth(0.14);
  g.save();
  g.translate(back.x, back.y);
  const wall = g.createLinearGradient(0, 0, 0, 780);
  wall.addColorStop(0, p.panel);
  wall.addColorStop(0.7, p.bg);
  wall.addColorStop(1, p.raised);
  g.fillStyle = wall;
  g.fillRect(-140, -140, 2200, 1020);
  const barP = f.barPulse ?? 0;
  lightShaft(g, p, 210 + Math.sin(tv * 0.35) * 55 + barP * 46, -120, 520, 1160,
    { alpha: 0.13 + (f.rmsEnv ?? 0) * 0.05 + barP * 0.07 });
  grainField(g, p, tv, f, { alpha: 0.12 });
  g.restore();

  // window frame hint, far left
  const far = cam.depth(0.3);
  g.save();
  g.translate(far.x, far.y);
  const sky = g.createLinearGradient(0, 90, 0, 560);
  sky.addColorStop(0, hexA(p.accentHot, 0.22));
  sky.addColorStop(1, hexA(p.raised, 0.9));
  g.fillStyle = sky;
  g.fillRect(60, 90, 330, 470);
  g.strokeStyle = hexA(p.line, 0.75);
  g.lineWidth = 5;
  g.strokeRect(60, 90, 330, 470);
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(225, 90); g.lineTo(225, 560); g.stroke();
  g.beginPath(); g.moveTo(60, 300); g.lineTo(390, 300); g.stroke();
  g.fillStyle = hexA(p.raised, 1);
  g.fillRect(40, 556, 370, 16);
  g.restore();

  // table
  const mid = cam.depth(0.5);
  g.save();
  g.translate(mid.x, mid.y);
  const tableTop = 700;
  const table = g.createLinearGradient(0, tableTop, 0, 1080);
  table.addColorStop(0, hexA(p.panel, 0.98));
  table.addColorStop(0.35, hexA(p.panel, 0.85));
  table.addColorStop(1, hexA(p.bg, 0.95));
  g.fillStyle = table;
  g.fillRect(-140, tableTop, 2200, 420);
  // table edge + the shadow the wall throws onto it
  g.strokeStyle = hexA(p.line, 0.75);
  g.lineWidth = 3;
  g.beginPath(); g.moveTo(-140, tableTop); g.lineTo(2060, tableTop); g.stroke();
  const edge = g.createLinearGradient(0, tableTop, 0, tableTop + 90);
  edge.addColorStop(0, hexA(p.text, 0.1));
  edge.addColorStop(1, hexA(p.text, 0));
  g.fillStyle = edge;
  g.fillRect(-140, tableTop, 2200, 90);
  g.strokeStyle = hexA(p.line, 0.16);
  g.lineWidth = 1.5;
  for (let i = 0; i < 7; i++) {
    const y = tableTop + 26 + i * 40;
    g.beginPath();
    for (let x = -120; x < 2060; x += 60) {
      const yy = y + Math.sin((x + i * 130) * 0.004) * 5;
      if (x === -120) g.moveTo(x, yy); else g.lineTo(x, yy);
    }
    g.stroke();
  }
  g.restore();

  // the mug, near plane
  const near = cam.depth(1.0);
  const inK = rampE(t0, 0.15, 0.9, ease.outBack);
  const kick = (f.onsetPulse ?? 0) > 0.5 ? decay(f.sinceBeat ?? 99, 0, 0.3) : 0;
  const lift = (1 - inK) * 90 - kick * 5 + bob(tv, 2.2, 0.25);

  g.save();
  g.translate(near.x, near.y + lift);

  const cupW = 340 * size;
  const cupH = 262 * size;
  const rimY = cy - cupH * 0.42;
  const saucerY = cy + cupH * 0.52;

  // cast shadow, so the cup sits on the table instead of floating
  const sh = g.createRadialGradient(cx - 30, saucerY + 30, 20, cx - 30, saucerY + 30, cupW * 0.95);
  sh.addColorStop(0, hexA(p.text, 0.22));
  sh.addColorStop(1, hexA(p.text, 0));
  g.fillStyle = sh;
  g.beginPath();
  g.ellipse(cx - 30, saucerY + 30, cupW * 0.95, cupW * 0.3, 0, 0, Math.PI * 2);
  g.fill();

  const halfTop = cupW * 0.5;
  const halfBot = cupW * 0.4;
  const bodyTop = rimY + 14;
  const bodyBot = cy + cupH * 0.42;

  if (P.spill) {
    // The same mug, knocked over. A second image out of one prop: the cup on its
    // side, coffee spread across the table, sugar cubes scattered.
    const puddleK = rampE(t0, 0.25, 2.2, ease.outCubic);
    const tilt = -0.42 * rampE(t0, 0.15, 0.9, ease.outBack);
    // puddle
    g.save();
    g.beginPath();
    g.ellipse(cx + 60, saucerY + 46, cupW * 1.25 * puddleK, cupW * 0.4 * puddleK, 0.06, 0, Math.PI * 2);
    g.fillStyle = hexA(p.accentDim, 0.9);
    g.fill();
    g.clip();
    g.fillStyle = hexA(p.bg, 0.35);
    g.beginPath();
    g.ellipse(cx + 40 + Math.sin(tv * 0.4) * 14, saucerY + 26, cupW * 0.3, cupW * 0.07, 0.06, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.strokeStyle = hexA(p.line, 0.35);
    g.lineWidth = 1.6;
    g.beginPath();
    g.ellipse(cx + 40, saucerY + 40, cupW * 0.95 * puddleK, cupW * 0.3 * puddleK, 0.06, 0, Math.PI * 2);
    g.stroke();

    // the cup, lying down
    g.save();
    g.translate(cx - cupW * 0.34, saucerY - 30);
    g.rotate(tilt);
    g.fillStyle = hexA(p.raised, 1);
    g.strokeStyle = hexA(p.line, 0.85);
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(-halfTop, -cupH * 0.34);
    g.quadraticCurveTo(-halfTop * 1.02, cupH * 0.3, -halfBot, cupH * 0.34);
    g.quadraticCurveTo(0, cupH * 0.5, halfBot, cupH * 0.34);
    g.quadraticCurveTo(halfTop * 1.02, cupH * 0.3, halfTop, -cupH * 0.34);
    g.closePath();
    g.fill(); g.stroke();
    g.beginPath();
    g.ellipse(0, -cupH * 0.34, halfTop, cupW * 0.17, 0, 0, Math.PI * 2);
    g.fillStyle = hexA(p.panel, 1);
    g.fill(); g.stroke();
    g.beginPath();
    g.arc(halfTop * 0.98, 0, cupH * 0.2, -Math.PI * 0.5, Math.PI * 0.5);
    g.lineWidth = 11 * size;
    g.strokeStyle = hexA(p.line, 0.9);
    g.stroke();
    g.restore();

    // scattered sugar cubes, drifting apart
    for (let i = 0; i < 6; i++) {
      const a = -0.4 + i * 0.28;
      const d = cupW * (0.55 + i * 0.12) * rampE(t0, 0.1 + i * 0.08, 0.8, ease.outCubic);
      const sx = cx + Math.cos(a) * d;
      const sy = saucerY + 30 + Math.sin(a) * d * 0.32;
      const q = 38 * size;
      g.save();
      g.translate(sx, sy);
      g.rotate(a * 1.4 + t0 * 0.2 * (i % 2 ? 1 : -1));
      g.fillStyle = hexA(p.raised, 0.98);
      g.strokeStyle = hexA(p.line, 0.6);
      g.lineWidth = 1.6;
      g.fillRect(-q / 2, -q / 2, q, q);
      g.strokeRect(-q / 2, -q / 2, q, q);
      g.restore();
    }

    // the spoon, thrown to one side
    g.save();
    g.translate(cx + cupW * 1.15, saucerY + 60);
    g.rotate(0.5 + Math.sin(t0 * 0.6) * 0.05);
    g.fillStyle = hexA(p.text, 0.75);
    g.fillRect(-4 * size, -120 * size, 8 * size, 110 * size);
    g.beginPath();
    g.ellipse(0, 0, 13 * size, 19 * size, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  } else {

  // saucer
  g.fillStyle = hexA(p.raised, 0.95);
  g.strokeStyle = hexA(p.line, 0.7);
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(cx, saucerY + 16, cupW * 0.8, cupW * 0.21, 0, 0, Math.PI * 2);
  g.fill(); g.stroke();
  g.fillStyle = hexA(p.panel, 0.5);
  g.beginPath();
  g.ellipse(cx, saucerY + 10, cupW * 0.72, cupW * 0.18, 0, 0, Math.PI * 2);
  g.fill();

  // body
  g.beginPath();
  g.moveTo(cx - halfTop, bodyTop);
  g.quadraticCurveTo(cx - halfTop * 0.97, bodyBot - 18, cx - halfBot, bodyBot);
  g.quadraticCurveTo(cx, bodyBot + 16, cx + halfBot, bodyBot);
  g.quadraticCurveTo(cx + halfTop * 0.97, bodyBot - 18, cx + halfTop, bodyTop);
  g.closePath();
  const body = g.createLinearGradient(cx - halfTop, 0, cx + halfTop, 0);
  body.addColorStop(0, hexA(p.raised, 1));
  body.addColorStop(0.45, hexA(p.bg, 1));
  body.addColorStop(1, hexA(p.panel, 1));
  g.fillStyle = body;
  g.fill();
  g.strokeStyle = hexA(p.line, 0.85);
  g.lineWidth = 2.4;
  g.stroke();
  // rim light on the lit side: keeps the silhouette readable in dark palettes
  g.strokeStyle = hexA(p.accentHot, 0.35);
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(cx - halfTop, bodyTop + 4);
  g.quadraticCurveTo(cx - halfTop * 1.01, bodyTop + cupH * 0.3, cx - halfBot * 0.92, bodyBot);
  g.stroke();

  // sugar jar, behind and to the left
  const jarX = cx - cupW * 1.25;
  const jarY = saucerY - 30;
  g.fillStyle = hexA(p.raised, 0.9);
  g.strokeStyle = hexA(p.line, 0.6);
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(jarX, jarY, 52, 16, 0, 0, Math.PI * 2);
  g.fill(); g.stroke();
  g.beginPath();
  g.moveTo(jarX - 52, jarY);
  g.lineTo(jarX - 44, jarY - 86);
  g.lineTo(jarX + 44, jarY - 86);
  g.lineTo(jarX + 52, jarY);
  g.closePath();
  g.fill(); g.stroke();
  g.beginPath();
  g.ellipse(jarX, jarY - 86, 44, 13, 0, 0, Math.PI * 2);
  g.fillStyle = hexA(p.accentDim, 0.85);
  g.fill(); g.stroke();
  g.fillStyle = hexA(p.text, 0.6);
  for (let i = 0; i < 5; i++) {
    g.fillRect(jarX - 30 + i * 14, jarY - 62 + (i % 2) * 8, 8, 8);
  }

  // spoon rest, to the right
  g.strokeStyle = hexA(p.line, 0.5);
  g.lineWidth = 2;
  g.fillStyle = hexA(p.raised, 0.75);
  g.beginPath();
  g.ellipse(cx + cupW * 0.92, saucerY + 6, 62, 18, 0, 0, Math.PI * 2);
  g.fill(); g.stroke();

  // handle
  g.beginPath();
  g.arc(cx + halfTop * 0.98, bodyTop + cupH * 0.22, cupH * 0.22, -Math.PI * 0.42, Math.PI * 0.42);
  g.strokeStyle = hexA(p.line, 0.9);
  g.lineWidth = 12 * size;
  g.stroke();
  g.strokeStyle = hexA(p.raised, 1);
  g.lineWidth = 7 * size;
  g.stroke();

  // rim
  g.beginPath();
  g.ellipse(cx, rimY, halfTop, cupW * 0.19, 0, 0, Math.PI * 2);
  g.fillStyle = hexA(p.raised, 1);
  g.fill();
  g.strokeStyle = hexA(p.line, 0.9);
  g.lineWidth = 2.2;
  g.stroke();

  // coffee
  const coffeeY = rimY + 6;
  g.save();
  g.beginPath();
  g.ellipse(cx, rimY, halfTop - 8, cupW * 0.19 - 5, 0, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = P.empty ? hexA(p.panel, 0.85) : hexA(p.accentDim, 0.95);
  g.beginPath();
  g.ellipse(cx, coffeeY + 4, halfTop - 8, cupW * 0.185, 0, 0, Math.PI * 2);
  g.fill();

  if (!P.empty) {
    const stirK = P.stirAt != null
      ? ease.outCubic(Math.min(1, Math.max(0, (t0 - P.stirAt) / 3.2)))
      : 0;
    g.strokeStyle = hexA(p.text, 0.18 + stirK * 0.22);
    g.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const span = cupW * 0.5;
      const r = ((tv * (22 + stirK * 46) * (1 + barP * 0.5) + i * 40) % span);
      g.globalAlpha = (1 - r / span) * (0.25 + stirK * 0.5);
      g.beginPath();
      g.ellipse(cx, coffeeY + 4, r * 1.5, r * 0.58, 0, 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;
    g.fillStyle = hexA(p.raised, 0.5);
    g.beginPath();
    g.ellipse(cx - halfTop * (0.3 + Math.sin(tv * 0.6) * 0.06), coffeeY - 6, halfTop * 0.26, cupW * 0.05, -0.3 + Math.sin(tv * 0.4) * 0.12, 0, Math.PI * 2);
    g.fill();
  } else {
    g.strokeStyle = hexA(p.accentDim, 0.8);
    g.lineWidth = 6;
    g.beginPath();
    g.ellipse(cx, coffeeY + 12, halfTop - 26, cupW * 0.14, 0, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();

  // sugar cube
  if (P.sugarAt != null) {
    const st = t0 - P.sugarAt;
    if (st > -0.9 && st < 3.4) {
      const fall = Math.min(1, Math.max(0, (st + 0.9) / 0.9));
      const sy = 250 + (coffeeY - 250) * ease.inQuad(fall);
      const sq = 34 * size * (st > 0.55 ? Math.max(0, 1 - (st - 0.55) / 1.5) : 1);
      if (sq > 0.5) {
        g.save();
        g.translate(cx + 40, sy);
        g.rotate(st * 1.6);
        g.fillStyle = hexA(p.raised, 0.98);
        g.strokeStyle = hexA(p.line, 0.7);
        g.lineWidth = 2;
        g.fillRect(-sq / 2, -sq / 2, sq, sq);
        g.strokeRect(-sq / 2, -sq / 2, sq, sq);
        g.restore();
      }
      if (st > 0) {
        const ring = Math.max(0, 1 - st / 1.1);
        if (ring > 0) {
          g.strokeStyle = hexA(p.accentHot, 0.55 * ring);
          g.lineWidth = 3 + ring * 3;
          const rr = 30 + (1 - ring) * 150;
          g.beginPath();
          g.ellipse(cx + 40, coffeeY, rr * 1.6, rr * 0.5, 0, 0, Math.PI * 2);
          g.stroke();
        }
      }
    }
  }

  // spoon
  if (P.stirAt != null) {
    const k = ease.outCubic(Math.min(1, Math.max(0, (t0 - (P.stirAt - 0.8)) / 1.2)));
    if (k > 0) {
      const ang = -0.7 + (t0 - P.stirAt) * 1.9 + Math.sin(t0 * 2.1) * 0.12;
      const sx = cx + Math.cos(ang) * halfTop * 0.55;
      const sy2 = coffeeY + Math.sin(ang) * cupW * 0.11;
      g.save();
      g.translate(sx, sy2);
      g.rotate(ang * 0.6 + 1.15);
      g.fillStyle = hexA(p.text, 0.85 * k);
      g.fillRect(-4 * size, -160 * size, 8 * size, 150 * size);
      g.beginPath();
      g.ellipse(0, 4 * size, 13 * size, 20 * size, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }

  // steam
  if (!P.empty) {
    const amp = 0.32 + (f.rmsEnv ?? 0) * 0.4 + barP * 0.55;
    for (let i = 0; i < 3; i++) {
      const x0 = cx - 60 + i * 60;
      g.save();
      g.shadowColor = hexA(p.raised, 0.55 * amp);
      g.shadowBlur = 18;
      g.strokeStyle = hexA(p.raised, 0.34 * amp);
      g.lineWidth = 16 - i * 3;
      g.lineCap = 'round';
      g.beginPath();
      for (let k2 = 0; k2 <= 26; k2++) {
        const q = k2 / 26;
        const yy = coffeeY - q * 300;
        const xx = x0 + Math.sin(q * 5.2 + tv * 0.9 + i * 1.4) * (16 + q * 30) + barP * 8 * q;
        if (k2 === 0) g.moveTo(xx, yy); else g.lineTo(xx, yy);
      }
      g.stroke();
      g.restore();
    }
    g.lineCap = 'butt';
  }
  }
  g.restore();

  // foreground motes
  g.save();
  g.translate(near.x * 1.35, near.y * 1.35);
  driftMotes(g, p, tv, f, { n: 26, size: 2.4, alpha: 0.35, rise: 12 });
  g.restore();

  // lyric
  const { cur, next: nextLine } = (ctx.lyr ?? { activeAt: () => ({ cur: null }) }).activeAt(tv);
  const lsize = P.lyricSize ?? 86;
  const ly = P.lyricY ?? 950;
  if (cur && tv - cur.t < 8) {
    const chars = [...cur.text];
    g.font = `700 ${lsize}px ${WORD}`;
    // Over a pale saucer the line needs separation, but a plate would show as a
    // rectangle: a soft shadow the colour of the background does the job.
    g.shadowColor = hexA(p.bg, 0.9);
    g.shadowBlur = 16;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    const widths = chars.map((c) => g.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0);
    let px = 960 - total / 2;
    // Word-timed files drive the fill; plain files fall back to a reading rate.
    const lineEnd = nextLine ? nextLine.t : cur.t + 8;
    const times = cur.words && cur.words.length
      ? cur.words.flatMap((w, wi) => {
        const seg = [...w.text];
        const nxt = cur.words[wi + 1];
        // one mark per line is common: spread across the real line duration
        const stop = nxt ? nxt.t : lineEnd;
        const dt = Math.max(0.12, stop - w.t);
        return seg.map((_, k) => w.t + k * (dt / Math.max(1, seg.length)));
      })
      : chars.map((_, i) => cur.t + i * Math.max(0.06, (lineEnd - cur.t) / Math.max(1, chars.length)));
    for (let i = 0; i < chars.length; i++) {
      const on = times[i] != null ? times[i] <= tv : (tv - cur.t) / 0.12 > i;
      g.fillStyle = on ? p.text : hexA(p.text, 0.4);
      g.fillText(chars[i], px, ly + (on ? 0 : 2));
      px += widths[i];
    }
  } else if (P.still) {
    g.font = `700 ${lsize}px ${WORD}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = hexA(p.mute, 0.6);
    g.fillText(P.still, 960, ly);
  }

  g.shadowBlur = 0;
  if (P.caption) {
    g.font = '500 22px ui-monospace, monospace';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillStyle = hexA(p.sub, 0.85);
    g.fillText(P.caption, 96, 96);
  }
}

export const SCENES = { coffee };
