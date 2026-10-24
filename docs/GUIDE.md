# The guide

Everything an agent needs to make a music video, in one file. The deep docs at
the bottom are reference, not required reading.

## The job

Turn a song file into a film:

```
song-mv new work/ --audio "song.flac" --look paper
song-mv doctor   --storyboard work/storyboard.json      # ms, no render
song-mv preview  --storyboard work/storyboard.json      # stills, seconds
song-mv check-imagery / check-frame / check-motion      # the three gates
song-mv sheet    --storyboard work/storyboard.json      # contact sheet
song-mv render   --storyboard work/storyboard.json --audio work/song.flac --out work/mv.mp4
song-mv qa       --file work/mv.mp4 --storyboard work/storyboard.json
```

`new` gives you a folder that already passes `doctor`: real duration, six
shots, lyrics copied, and a `notes.md` with the three decisions to make.

**Cheap checks first.** `doctor` is milliseconds, `preview` is seconds, the
gates are ~10 s, a render is 10–25 minutes. Never render to find out whether a
storyboard is valid.

## The four decisions

Make them in this order and write each one down before touching JSON.

### 1. Look — which world

| id | when |
|---|---|
| `paper` | memory, letters, quiet grief, daylight that is not clinical |
| `rain` | longing, night streets, held-back tears |
| `daylight` | ordinary days, work, clarity, the song's plain surface |
| `ember` | exhaustion, late hours, anger that has burned down |
| `mono` | documentary, black-and-white memory |
| `cafe` | warmth, morning, small comforts, the colour of coffee and cream |
| `night-shift` | screens, offices, neon, burnout |

The look sets the *tonal ladder* (background lighter than objects, objects
lighter than recesses) and the post pass (vignette, grain, levels). You can pass
`post.levels` per storyboard to lift or crush it, but do not fight the ladder.

### 2. Cast — what carries the song

One thing: a mug, a paper boat, a window, a chair, a coat. It appears in the
first shot, is changed by the middle, and is still there at the end. If every
shot has a different subject, the film has none.

### 3. Cutting — how many shots

Three shots per section, not one. 8–14 s per shot. Give each a different
distance: a wide, a detail, an insert of the single most telling object.
`t0Offset = shotStart - sectionStart` keeps a cut from replaying the section's
entrances.

### 4. Motion — every shot is a camera plus an event

| camera | reads as |
|---|---|
| `push` / `pull` | attention arriving / leaving |
| `panL` / `panR` | following, searching |
| `tiltUp` / `tiltDown` | scale, or looking away |
| `driftUp` / `driftDown` | time passing |
| `rollCW` / `rollCCW` | unease, a tilt in the world |
| `arc` | circling a subject |
| `none` | only for a held final card |

An *event* is something that happens inside the shot: an object enters, falls,
is struck, empties, fills, breaks, drifts past, closes. If nothing happens, the
shot is a poster. `check-motion` measures this and will fail you.

## The three gates

They answer different questions and are cheap to expensive. Run in order.

| gate | question | typical fix |
|---|---|---|
| `check-imagery` | is the shot *composed*? | elements, depth planes, horizon, labels, events; at most 2 consecutive shots share a layer+motif, and a motif may not carry more than a third of the field shots |
| `check-frame` | is the *picture* any good? | subject 15–55% of frame, 3–18 colour masses, mean luma ≥ 24 (≥ 18 at night), tonal range ≥ 40, ≥ 25% of pixels above 24 luma |
| `check-motion` | does the shot *move*? | score ≥ 1.0 — give it a camera move, a travelling motif or an event |

`check-frame` also refuses a film that is dark from the first shot to the last:
over 60% of shots under mean luma 30 fails, and if *no* shot reaches 55 it says
so. A genuinely all-night song can opt out with `post.allowDark: true`.

## Composition, in one page

- **Roughly 8–14 elements per `designed` shot**, spread over three depths
  (0.1–0.3 back, 0.4–0.7 mid, 0.8–1.0 near). A frame with two shapes is a
  diagram.
- **Give every shot a horizon** — a line, a band, a floor plane. Without it the
  picture floats.
- **Label the world.** At least one piece of in-world text (a sign, a ticket, a
  timestamp), on a plate. 人民广场 / 2号线·往徐泾东 says what the shot is; two
  rectangles do not.
- **One light source, set once**: `keyLight: { from: [x, y], strength }`. Every
  object shades from it.
- **Form, not fill**: `form: "box" | "cyl" | "sphere" | "plane"` gives a shape
  volume from the key light. Flat fills are why vector scenes look like
  stickers.
- **Size carries meaning**: the subject wants 25–40% of the frame width. A prop
  under a fifth reads as a sticker on a wall.
- **Depth of field is opt-in**: `dof` (max blur px) plus `focusKeys` for a rack
  focus. Text at blur 0 stays crisp.

## Lyrics are timing, not text

`check-lyrics` first, always. A `.std.lrc` stamped with each line's *last* word
runs 1–6 s late; enhanced `.lrc` files carry `<mm:ss.xx>` marks that let karaoke
follow the voice. Timestamps accept 1–3 decimals. Lines hold about 8 s.

Treatments, per shot: `kinetic` (default), `karaoke` (fills with the vocal),
`plain`, plus `slam`, `bounce`, `wall`, `sliced`, `decode` in `engine/lyric_fx.mjs`.

## Storyboard shape

```json
{
  "title": "song",
  "look": "paper",
  "duration": 181.5,
  "lyricsFile": "./lyrics.lrc",
  "post": { "allowDark": false },
  "shots": [
    { "id": "01_room", "start": 0, "end": 13.1, "palette": "still",
      "enter": "dissolve", "camera": "driftDown", "cameraAmount": 0.05,
      "scene": { "type": "field", "params": { "layer": "paper", "folds": 0.5, "lyricY": 930 } } }
  ]
}
```

Palettes are emotional states, not colours: `still tender build release intense
peak dawn fade`. They resolve through the look. `enter` is `cut | dissolve |
glitch`. Shots must be contiguous, start at 0, and end at `duration`.

## Lanes — how much code a shot needs

| lane | use | how |
|---|---|---|
| **field** | landscape, weather, one object drifting | `scene.type: "field"` + `layer` / `motif` / `stage` |
| **designed** | a room, a desk, an object with parts | `scene.type: "designed"` + `elements: [...]` |
| **typeOnly** | the lyric is the picture | `scene.type: "typeOnly"` + `layout` |
| **scene** | nothing fits, write one | `song-mv new-scene my-thing` |

The nine office scenes (`keyboard`, `desk`, `stampScene`, …) are **one song's
props**, kept for that film. Do not reach for them on a new song.

## The ten field layers

`paper` (creases, scraps) · `water` (ripples, reflection, boat wake) · `rain`
(three depth bands, puddles) · `snow` · `ink` (bleeding wash) · `motes` · `thread`
· `window` (rain on glass) — plus `motif`: `boat window moon lantern chair birds`.

## Fix table

| symptom | cause | fix |
|---|---|---|
| frame is flat, everything one value | props and wall share a tone | move props up a role (`raised`), wall to `bg` |
| frame is milky white | additive light + pale palette | lower `post.levels.white`, raise `black` |
| film is dark end to end | every palette is night | give a verse daylight, or `post.allowDark` |
| elements look like stickers | flat fills, no shadow | `form`, `shadow`, `keyLight` |
| shot reads static | no camera, no event | set `camera`, add `keys` or an `events` entry |
| lyrics sit still, then late | `.std.lrc` | use the enhanced `.lrc` |
| text unreadable | no plate, wrong role | `plate: "panel"`, `fill: "text"` |
| render is slow | heavy `designed` shots | see the field lane; `field` costs a fraction |

## Reference

- `docs/imagery.md` — every element kind, motion field, and the frame rules
- `docs/motion.md` — camera tables, staging, beat signals
- `docs/looks.md` — the seven worlds and how to author one
- `docs/scenes.md` — field/typeOnly parameters, the office pack
- `docs/storyboard.md` — every top-level and shot field
- `docs/lyrics.md` — the `.std` trap and timestamp semantics
- `docs/scene-pipeline.md` — writing your own scene
- `docs/how-it-works.md` — why it is built this way
- `docs/publishing.md` — releasing the plugin itself
