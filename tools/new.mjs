#!/usr/bin/env node
/**
 * `song-mv new <dir>` — scaffold a song project.
 *
 * The point is that an agent has nothing to remember: one command produces a
 * folder whose storyboard already passes `doctor`, with the song's real timing
 * baked in, so the only work left is deciding what the shots are.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const arg = (name, dflt = null) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : dflt;
};
const flag = (name) => process.argv.includes(`--${name}`);

if (flag('help') || !process.argv[2] || process.argv[2].startsWith('--')) {
  console.log(`song-mv new <dir> [--audio <song.flac|mp3|wav>] [--bpm N] [--look <id>]

  Creates <dir>/ with:
    song.<ext>            a copy of the audio (or a placeholder note)
    features.json         from analyze, if --audio was given
    lyrics.lrc            copied next to the audio if a .lrc sibling exists
    storyboard.json       a valid skeleton: right duration, six shots, gates pass
    notes.md              the three decisions to make, in order

  --audio is optional: without it the skeleton uses a 120 s placeholder duration
  and you fill in features.json later with \`song-mv analyze\`.`);
  process.exit(process.argv[2] ? 0 : 1);
}

const dir = path.resolve(process.argv[2]);
const audio = arg('audio');
const look = arg('look', 'paper');
const bpm = arg('bpm', null);

fs.mkdirSync(dir, { recursive: true });

let duration = 120;
let featuresPath = path.join(dir, 'features.json');
let lyricsPath = null;

if (audio) {
  const src = path.resolve(audio);
  if (!fs.existsSync(src)) {
    console.error(`new: no such audio file: ${src}`);
    process.exit(2);
  }
  const ext = path.extname(src);
  const dst = path.join(dir, `song${ext}`);
  if (path.resolve(dst) !== src) fs.copyFileSync(src, dst);

  const lrcSrc = src.replace(/\.[^.]+$/, '.lrc');
  const lrcStd = src.replace(/\.[^.]+$/, '.std.lrc');
  const lrcPick = fs.existsSync(lrcSrc) ? lrcSrc : (fs.existsSync(lrcStd) ? lrcStd : null);
  if (lrcPick) {
    lyricsPath = path.join(dir, 'lyrics.lrc');
    fs.copyFileSync(lrcPick, lyricsPath);
    console.log(`new: lyrics ← ${path.basename(lrcPick)}`);
    if (lrcPick === lrcStd) {
      console.log('new: that is a .std.lrc — run `song-mv check-lyrics` on it before trusting the timing.');
    }
  }

  const args = [path.join(here, 'analyze.mjs'), dst, '--out', featuresPath];
  if (bpm) args.push('--bpm', String(bpm));
  const r = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('new: analysis failed; the skeleton will use a placeholder duration.');
  } else {
    try {
      const f = JSON.parse(fs.readFileSync(featuresPath, 'utf8'));
      duration = f.meta?.duration ?? duration;
    } catch { /* keep the placeholder */ }
  }
}

const d = Number(duration.toFixed(2));
const cuts = [0, 0.18, 0.36, 0.52, 0.72, 0.88, 1].map((k) => Number((d * k).toFixed(2)));
const storyboard = {
  title: path.basename(dir),
  look,
  duration: d,
  lyricsFile: lyricsPath ? './lyrics.lrc' : undefined,
  post: { allowDark: false },
  shots: [
    { id: '01_open', start: cuts[0], end: cuts[1], palette: 'still', enter: 'cut', camera: 'driftDown',
      scene: { type: 'field', params: { layer: 'paper', folds: 0.5, lyricY: 930, caption: 'establish the place' } } },
    { id: '02_subject', start: cuts[1], end: cuts[2], palette: 'tender', enter: 'dissolve', camera: 'push',
      scene: { type: 'designed', params: { dof: 8, focus: 0.7, elements: [
        { kind: 'rect', at: [0.5, 0.5], size: [1, 1], fill: 'panel', depth: 0.05 },
        { kind: 'rect', at: [0.34, 0.56], size: [0.42, 0.5], fill: 'raised', form: 'box', depth: 0.62, shadow: 0.4 },
        { kind: 'text', at: [0.34, 0.74], size: 22, weight: 700, text: 'label this object', fill: 'text',
          plate: 'panel', plateStroke: 'line', pad: [18, 10], depth: 0.64 },
        { kind: 'line', at: [0.5, 0.83], size: [1, 0], from: [-0.5, 0], to: [0.5, 0], stroke: 'line', lw: 2, depth: 0.3 },
      ], lyricY: 950 } } },
    { id: '03_detail', start: cuts[2], end: cuts[3], palette: 'build', enter: 'cut', camera: 'panR',
      scene: { type: 'field', params: { layer: 'water', horizon: 620, motif: 'boat', motifAt: [980, 610, 190], travel: [520, -10], lyricY: 940 } } },
    { id: '04_lift', start: cuts[3], end: cuts[4], palette: 'intense', enter: 'dissolve', camera: 'tiltUp',
      scene: { type: 'field', params: { layer: 'rain', motif: 'lantern', motifAt: [1420, 380, 150], density: 220, lyricY: 940 } } },
    { id: '05_peak', start: cuts[4], end: cuts[5], palette: 'peak', enter: 'cut', camera: 'push',
      scene: { type: 'typeOnly', params: { layout: 'column', size: 108, kicker: 'chorus', accent: 'the' } } },
    { id: '06_out', start: cuts[5], end: cuts[6], palette: 'dawn', enter: 'dissolve', camera: 'driftUp',
      scene: { type: 'field', params: { layer: 'motes', motif: 'window', motifAt: [960, 520, 420], lyricY: 940, still: 'a last line, if the song ends on one' } } },
  ].map((s) => (s.lyricsFile ? s : s)),
};
for (const s of storyboard.shots) {
  s.start = Number(s.start.toFixed(2));
  s.end = Number(s.end.toFixed(2));
}
if (!lyricsPath) delete storyboard.lyricsFile;

const sbPath = path.join(dir, 'storyboard.json');
fs.writeFileSync(sbPath, JSON.stringify(storyboard, null, 2) + '\n');

const notes = `# ${path.basename(dir)}

Three decisions, in this order. Do not write more shots until all three are
answered in a sentence each.

## 1. Look

Which of the shipped worlds does this song live in? \`song-mv\` --help in the
repo, or docs/looks.md. Current: **${look}**.

    paper | rain | daylight | ember | mono | cafe | night-shift

## 2. Cast and arc

What *thing* carries the song? A mug, a paper boat, a window, a chair. It
should appear in the first shot and in the last, and be changed by the middle.

## 3. Motion plan, per shot

For each shot, write one line: camera move, what moves, what happens. If a shot
has no event, it is a poster, not a shot.

---

    song-mv doctor --storyboard ${path.relative(process.cwd(), sbPath) || 'storyboard.json'}
        static check, milliseconds
    song-mv preview ...
        a few stills, seconds
    song-mv check-imagery / check-frame / check-motion ...
        the three gates
    song-mv render ...
        the film
    song-mv qa --file out.mp4
        brightness and flash report
`;
fs.writeFileSync(path.join(dir, 'notes.md'), notes);

console.log(`new: ${dir}`);
console.log(`  storyboard.json  ${storyboard.shots.length} shots, ${d}s`);
if (audio) console.log('  features.json    from analyze');
if (lyricsPath) console.log('  lyrics.lrc       copied');
console.log('  notes.md         the three decisions');
console.log(`\nnext: song-mv doctor --storyboard ${path.join(dir, 'storyboard.json')}`);
