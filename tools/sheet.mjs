#!/usr/bin/env node
/**
 * `song-mv sheet` — a contact sheet in one command.
 *
 * Two sources, because agents kept hand-rolling ffmpeg for this:
 *   --storyboard <file>  render n stills straight from the storyboard (no mp4)
 *   --video <file>       pull frames out of a finished mp4
 *
 * Both write one PNG plus a small `.txt` index naming each tile, so the tile
 * captions are never guessed after the fact.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createCanvas, loadImage } from 'canvas';
import { ffmpegPath, requireFfmpeg } from './lib/ffmpeg.mjs';

const arg = (name, dflt = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const flag = (name) => process.argv.includes(`--${name}`);

if (flag('help') || process.argv.includes('-h')) {
  console.log(`song-mv sheet — contact sheet

  --storyboard <file> [--features <file>] [--out <png>] [--cols 4] [--tile 480]
  --video <file> [--out <png>] [--cols 4] [--tile 480] [--count 12]

  --storyboard renders one still per shot at 62% of the shot (the moment a
  scene is usually settled) and labels each tile with the shot id.
  --video samples N frames evenly across the file and labels each with its
  timestamp.
`);
  process.exit(0);
}

const storyboardPath = arg('storyboard');
const videoPath = arg('video');
if (!storyboardPath && !videoPath) {
  console.error('sheet: give --storyboard <file> or --video <file>. Try `song-mv sheet --help`.');
  process.exit(2);
}
const cols = Number(arg('cols', 4));
const tileW = Number(arg('tile', 480));
const tileH = Math.round((tileW * 9) / 16);

const tiles = [];

if (storyboardPath) {
  const sb = JSON.parse(fs.readFileSync(storyboardPath, 'utf8'));
  const featuresPath = arg('features') ?? sb.features ?? 'features.json';
  const audioPath = arg('audio') ?? sb.audio ?? null;
  const base = path.dirname(path.resolve(storyboardPath));
  const resolve = (p) => {
    if (!p) return null;
    if (path.isAbsolute(p)) return p;
    const a = path.resolve(base, p);
    if (fs.existsSync(a)) return a;
    const b = path.resolve(process.cwd(), p);
    return fs.existsSync(b) ? b : a;
  };
  const { createEngine } = await import('../engine/core.mjs');
  const { parseLrc } = await import('../engine/core.mjs');
  const sbPath = resolve(arg('features') ?? featuresPath);
  const feats = JSON.parse(fs.readFileSync(sbPath, 'utf8'));
  const lrcPath = sb.lyricsFile ? resolve(sb.lyricsFile) : null;
  const lrc = lrcPath && fs.existsSync(lrcPath) ? parseLrc(lrcPath) : [];
  if (!lrc.length) console.error('sheet: no lyrics parsed — tiles will show instrumental state only.');
  const eng = createEngine({ cfg: sb, features: feats, storyboard: sb, lrc });
  const out = arg('out', path.join(base, 'contact-sheet.png'));
  for (const shot of sb.shots ?? []) {
    const dur = (shot.end ?? 0) - (shot.start ?? 0);
    const t = (shot.start ?? 0) + dur * 0.62;
    const frame = eng.renderFrame(t);
    // renderFrame reuses one canvas, so each tile has to be a copy: storing the
    // reference gives every tile the last frame drawn.
    const copy = createCanvas(frame.width, frame.height);
    copy.getContext('2d').drawImage(frame, 0, 0);
    tiles.push({ canvas: copy, label: `${shot.id ?? '?'} @${t.toFixed(1)}s` });
  }
  write(out, tiles);
} else {
  requireFfmpeg();
  const out = arg('out', path.join(path.dirname(path.resolve(videoPath)), `${path.basename(videoPath, path.extname(videoPath))}.sheet.png`));
  const probe = spawnSync(ffmpegPath(), ['-i', videoPath], { encoding: 'utf8' });
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(probe.stderr ?? '');
  if (!m) {
    console.error('sheet: cannot read the duration of that file.');
    process.exit(2);
  }
  const total = +m[1] * 3600 + +m[2] * 60 + +m[3];
  const count = Number(arg('count', 12));
  const tmp = fs.mkdtempSync(path.join(process.env.TEMP ?? '/tmp', 'sheet-'));
  for (let i = 0; i < count; i++) {
    const t = (total * (i + 0.5)) / count;
    const f = path.join(tmp, `f${String(i).padStart(3, '0')}.png`);
    const r = spawnSync(ffmpegPath(), ['-y', '-loglevel', 'error', '-ss', String(t), '-i', videoPath, '-frames:v', '1', f]);
    if (r.status !== 0 || !fs.existsSync(f)) continue;
    tiles.push({ canvas: await loadImage(f), label: `${t.toFixed(1)}s` });
  }
  write(out, tiles);
}

function write(out, list) {
  if (!list.length) {
    console.error('sheet: no frames produced.');
    process.exit(2);
  }
  const rows = Math.ceil(list.length / cols);
  const labelH = 22;
  const canvas = createCanvas(cols * tileW, rows * (tileH + labelH));
  const g = canvas.getContext('2d');
  g.fillStyle = '#0a0a0c';
  g.fillRect(0, 0, canvas.width, canvas.height);
  list.forEach((t, i) => {
    const x = (i % cols) * tileW;
    const y = Math.floor(i / cols) * (tileH + labelH);
    const src = t.canvas;
    g.drawImage(src, 0, 0, src.width ?? src.naturalWidth, src.height ?? src.naturalHeight, x, y + labelH, tileW, tileH);
    g.font = '600 12px monospace';
    g.fillStyle = '#d8d2c4';
    g.fillText(t.label, x + 6, y + 15);
  });
  fs.writeFileSync(out, canvas.toBuffer('image/png'));
  const index = out.replace(/\.png$/, '.txt');
  fs.writeFileSync(index, list.map((t) => t.label).join('\n'));
  console.log(`sheet: ${list.length} tiles → ${out}`);
  console.log(`index → ${index}`);
}
