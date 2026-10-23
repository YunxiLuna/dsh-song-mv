# song-mv — turn a song into a code-rendered music video

Use this skill when the user wants a **music video, lyric video, or MV** rendered from an audio
file, or wants to change an existing one ("make the lyrics punchier", "add a story scene").

Every frame is drawn in code (node-canvas) as a pure function of song time, then piped to ffmpeg.
There is no timeline editor and no stock footage.

## Before you start

- The audio file (`.mp3` / `.flac` / `.wav` / anything ffmpeg reads).
- A `.lrc` lyric file **if the song has lyrics**. Ask for it; do not scrape lyrics from a streaming
  service — they are licensed text and must not be committed to a repo. If the folder holds both
  `song.lrc` and `song.std.lrc`, use the plain `.lrc`: the `.std` variant is usually derived and
  stamped with each line's **last** word mark, which makes every line late by a different amount.
  Run `song-mv check-lyrics lyrics.lrc --duration <seconds>` before you trust it (see
  `docs/lyrics.md`).
- `ffmpeg` on PATH. Check with `ffmpeg -version`; if missing, tell the user how to install it.

## The gate: decide three things before writing any JSON

Almost every bad MV from this tool comes from skipping this step. The two failure modes are
identical in shape: reusing the previous song's props, or making a beautiful still that never moves.

Write the three answers into `STORYBOARD.md` and show them to the user before rendering.

### Decision 1 — the look (colour world)

A look is a family of eight palettes plus grain/scan settings. Pick it from **what the song sounds
like and what it is about**, not from what you rendered last time.

| look | world | reach for it when |
|---|---|---|
| `paper` | warm off-white, ink, folds | memory, letters, tenderness, nostalgia, acoustic |
| `rain` | wet blue-grey, cold light | grief, distance, city at night, regret |
| `daylight` | bright neutral, clean air | hope, morning, release, outdoor, major key |
| `ember` | deep red-brown, low light | anger, heat, obsession, slow burn |
| `mono` | black and white, no colour | archive, documentary, grief held still |
| `night-shift` | dark blue neon, screens | electronic, late-night work, irony, dread |
| `cafe` | cream walls, morning light, coffee and caramel | ordinary days told warmly, food, small comforts, warm humour |

If none fit, write a new one — see `docs/looks.md`. Six entries where one is a stretch is still
better than reusing `night-shift` because it was the default.

### Decision 2 — the cast and its arc

Pick **one or two subjects** that can carry the whole song, and give each an arc across shots. A
subject is an object or a place, not a feeling: a paper boat, a window, a chair, a lantern.

```
boat:  enters left (verse 1) → travels the length of the frame (verse 2)
       → slows and sinks on the pre-chorus → comes back small in the last chorus
```

Sinking and returning are already supported by `stage` (`enter` / `drift` / `sink` / `return`), so an
arc costs one string per shot. Do not invent a new subject per shot — that reads as a stock-footage
montage, not a film.

### Decision 3 — the motion plan

**A shot that does not move is a failed shot.** For every shot write one line with all four parts:

```
[shot] camera: push 0.09  |  what moves: boat crosses 430px, foreground grains parallax
       | what happens: boat sinks at 0:52, ring pulse on the downbeat
       | lyric: karaoke, line at y=900
```

The four slots, and where they come from:

| slot | options | notes |
|---|---|---|
| **camera** | `push` `pull` `panL` `panR` `driftUp` `driftDown` `none` | set `camera` + `cameraAmount` per shot; vary it, never use the same move twice in a row |
| **what moves** | motif `travel`, layer drift, parallax, `scraps` | the engine gives every layer its own parallax plane; long shots need a subject that crosses the frame |
| **what happens** | `stage`, beat events, `enter`, `events` | at least one *discrete* event per shot: an entrance, a sink, a wash, a cut of light |
| **lyric** | `kinetic` / `karaoke` / `plain` + `lyricY` | change the treatment between sections, not every line |

Two rules that follow from this and are not negotiable:

1. **Every shot declares a camera move.** `none` is allowed only for a held final card.
2. **Every shot has an event.** If the only thing changing is the texture drifting, add a `stage`
   transition, a motif entrance, a beat-driven ring, or a cut to a different layer.

### Imagery, not moods

For each shot, write **what the viewer sees**, in one sentence, traceable to a lyric line or to what
the user told you:

- "a paper boat going down a rain gutter" — good: a place, an object, an action.
- "sadness" — not imagery. Neither is "the vibe of the chorus".

If a section has nothing to show, reread the lyric line or ask the user. Do not fill the gap with a
scene you already have — that is how one song's props end up in another song's video.

**The nine office scenes (`keyboard`, `desk`, `stampScene`, `emptyScene`, `call110`, `erase`,
`voidScene`, `kitchenScene`, `logout`) are the props of one specific song about working late.** They
exist as a worked example of how far the engine goes, not as a template. Use them only if the song is
genuinely about that: an office, deadlines, being deleted, calling for help at 2 AM.

## Steps

### 1. Analyze the audio

```bash
song-mv analyze song.flac --out data/features.json
```

Reports tempo, downbeat phase, onset count. This JSON is the timing ground truth — beats, bars and
onsets in every scene come from it. Do not hand-edit it.

Half/double-time ambiguity is normal: if the reported tempo is obviously wrong for the song, rerun
with `--bpm <the tempo you hear>`.

### 2. Check the lyrics

```bash
song-mv check-lyrics lyrics.lrc --duration 200.9
```

It prints every line's start and the gap to the next, and fails on timestamps that do not advance,
lines past the end of the audio, and the `.std.lrc` end-stamping trap. Word-timed files (`<mm:ss.xx>`
marks) drive the karaoke fill per fragment; plain files fall back to `lineRate`. Fix timing here —
it is invisible in a still and obvious in motion.

### 3. Read the song

Write in `STORYBOARD.md` what the song is about, in three sentences. If the user gave comments,
interview quotes or a mood brief, those are the director's notes and outrank your reading.

Then mark the sections (intro / verse / chorus / bridge / outro) and give each an emotional
state: `still`, `tender`, `build`, `release`, `intense`, `peak`, `dawn`, `fade`.

### 4. Fill the gate: look, cast, motion plan

### 5. Draft the storyboard

```bash
song-mv plan --features data/features.json --look paper --scenes generic --storyboard storyboard.json
```

`plan` slices the song at bar lines where the energy actually changes, assigns a state per shot, and
gives each shot a camera move chosen by energy (quiet songs drift, loud ones push or pull). It is a
first draft: replace the params with your cast and motion plan.

Shot fields:

| field | meaning |
|---|---|
| `start` / `end` | seconds; shots tile the song in order |
| `scene.type` | `field` / `typeOnly`, or a scene you wrote, or an office-pack scene |
| `scene.params` | content: texture, motif, text, layout, and the staging params below |
| `palette` | emotional state for the shot; the look turns it into colours |
| `camera` | `push` `pull` `panL` `panR` `driftUp` `driftDown` `none` |
| `cameraAmount` | 0.03 quiet … 0.15 loud |
| `cameraEase` | `linear` `inOutQuad` `outCubic` (default `inOutQuad`) |
| `focus` | `[x, y]` the move centres on, default frame centre |
| `handheld` | 0–3 px of shake; 0 for a locked-off card |
| `enter` | `cut` / `dissolve` / `glitch` / `wipe` |
| `loud` | beat punch on downbeats |

Staging params inside `field`:

| param | meaning |
|---|---|
| `layer` | `paper` `water` `rain` `snow` `ink` `motes` `thread` `window` |
| `motif` | `boat` `window` `moon` `lantern` `chair` `birds` |
| `motifAt` | `[x, y, size]` where the subject sits at the start |
| `travel` | `[dx, dy]` how far it crosses the frame over the shot |
| `stage` | `enter` `drift` `sink` `return` — the subject's arc |
| `sinkAt` | fraction of the shot where a `sink` starts (default 0.55) |
| `lyricStyle` | `kinetic` `karaoke` `plain` |
| `events` | `false` disables beat rings |
| `caption` / `run` | small mono text, bottom-left / top-left |
| `still` | a held line for when no lyric is active |

### 6. Compose or write the shots — this is part of the job

Drafting the storyboard gives you boundaries and states, not images. Each shot's image is
authored, in one of three lanes (details in `docs/scene-pipeline.md`):

| lane | use it when | command / shape |
|---|---|---|
| **compose** | the shot is a new arrangement of props you already have | `scene.type: "designed"` with `back` / `mid` / `near` actor lists |
| **scaffold** | the shot needs one image no prop draws | `song-mv new-scene gutter --out scenes/gutter.mjs`, then edit the body |
| **custom** | it is the film's signature shot | write `(ctx, tv, f, P)` freely against the contract |

A scaffolded or custom scene lives next to the storyboard and is loaded by name:

```json
{ "scenes": ["scenes/gutter.mjs"], "shots": [{ "type": "gutter" }] }
```

Scene files need no imports: primitives are on `ctx.lib`, easing on `ctx.mo`, the camera on
`ctx.cam`, lyrics on `ctx.lyr`. Do not translate the canvas yourself — apply `ctx.cam.depth(k)`
per plane.

Do not skip to rendering because the stills look nice. Composition is not motion.

### 7. Motion check — a hard gate

```bash
song-mv check-motion --storyboard storyboard.json --features data/features.json
```

Eight frames per shot, scored as pixel change plus travel. Anything under `1.0` prints
`← static` and exits non-zero. **Do not render while any shot fails.** Give it a camera move, a
subject that crosses, or a second event, then re-run. A shot that scores `← barely` (under 1.8) is
usually one beat away from being alive — shorten the travel window, add a ring, add a light cut.

Record the scores in `STORYBOARD.md` next to each shot; it is the only objective evidence that the
film moves.

### 8. Preview stills, not video

```bash
song-mv preview --storyboard storyboard.json --features data/features.json \
                --times 5,30,60,90,120 --out out/preview
```

Look at the images, then ask two questions:

- *Could this frame belong to a different song?* If yes, the imagery is not specific enough.
- *Does this shot move?* A still cannot answer that — take two frames 1–2 s apart inside the same
  shot and compare them. If only the lyric changed, the shot is dead.

Fix text collisions and contrast here; a render is minutes, a still is a second.

### 9. Render

```bash
song-mv render --storyboard storyboard.json --features data/features.json \
               --audio song.wav --out out/mv.mp4
```

### 10. Check the encoded file

- Extract frames from the **mp4**, not from the engine, and confirm they match the previews.
- `song-mv qa --file out/mv.mp4` reports the luma curve and hard flashes. More than ~3 luminance
  jumps per second is uncomfortable and a photosensitivity risk.

## Scene reference

### Generic scenes (any song)

| type | what it draws | key params |
|---|---|---|
| `designed` | three depth planes of actors, composed per shot | `layer`, `back[]`, `mid[]`, `near[]`, `lyricStyle` |
| `field` | layered texture + one travelling motif + the lyric | `layer`, `motif`, `motifAt`, `travel`, `stage`, `lyricStyle`, `still`, `caption` |
| `typeOnly` | the lyric as the whole picture | `lines[]`, `layout`, `size`, `accent`, `kicker` |

`designed` actors: `boat window moon lantern chair birds grain folds water rain motes ink thread
light vignette`, each with `at`, `enter`, `enterFrom`, `travel`, `bob`, `stage`, `sinkAt`, `react`.

### Office pack (one song's props — see the warning above)

| type | what it draws |
|---|---|
| `keyboard` | one giant lit key in the dark, timestamp HUD |
| `desk` | desk at night, monitor with an inbox, notifications piling up |
| `stampScene` | floating slides getting stamped |
| `emptyScene` | the same room, emptied out |
| `call110` | phone call UI, note card, comment ticker |
| `erase` | eraser cursor wiping a floor plan clean |
| `voidScene` | black hole, word wall, album card |
| `kitchenScene` | late-night kitchen: pot, noodles, moon |
| `logout` | log-out dialog, cursor clicks cancel |

## When nothing fits: scaffold a scene

```bash
song-mv new-scene gutter --out scenes/gutter.mjs
```

The scaffold already renders: three planes, an entrance, a beat event, the lyric. Replace the
placeholder body with the image you actually need, keep the shape, and add the file to the
storyboard's `scenes` list. A scene is a function of `(ctx, tv, f, P)`; the primitives arrive on
`ctx.lib` (grain, folds, water, rain, motes, ink, thread, light, boat, window, moon, lantern, chair,
birds), easing on `ctx.mo`.

`engine/motion.mjs` is what keeps a new scene alive: `ease`, `ramp`, `decay`, `bob`, `stagger`, the
`Camera` (already applied around every scene — read `ctx.cam.depth(k)` for a parallax plane), and
`clipReveal` for draw-on reveals. `docs/writing-a-scene.md` walks through one end to end.

Writing a scene that fits the song beats reusing one that does not. That trade is the whole reason
this engine has primitives.

## Craft rules

1. **Frame is a pure function of time.** `renderFrame(t)` keeps no state between calls; shots are
   rendered out of order and single frames are re-rendered.
2. **A shot is a camera plus an event, not a picture.** Declare both, every time.
3. **Colour is state.** Pick palette names. A raw hex value is a design decision that needs a reason.
4. **Lyrics are the melody line.** Time words to onsets, vary the treatment between sections, and let
   the last line of a chorus land differently from the first.
5. **One idea per shot.** If it takes two sentences to describe, split the shot.
6. **Leave the last two seconds breathing.** Fade, don't cut.

## Licensing — say this before shipping

- The mp4 contains the **song**: publishing it is the user's call and their risk. The tool grants no
  rights to the music or the lyrics.
- Do not commit audio, `.lrc` files, or rendered mp4s to a public repo. `.gitignore` already
  excludes them.
- Never bundle fonts or ffmpeg. This package references system fonts by name and shells out to the
  user's own ffmpeg.
