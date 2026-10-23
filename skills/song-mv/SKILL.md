# song-mv — turn a song into a code-rendered music video

Use this skill when the user wants a **music video, lyric video, or MV** rendered from an audio
file, or wants to change an existing one ("make the lyrics punchier", "add a story scene").

Every frame is drawn in code (node-canvas) as a pure function of song time, then piped to ffmpeg.
There is no timeline editor and no stock footage.

## Before you start

- The audio file (`.mp3` / `.flac` / `.wav` / anything ffmpeg reads).
- A `.lrc` lyric file **if the song has lyrics**. Ask for it; do not scrape lyrics from a streaming
  service — they are licensed text and must not be committed to a repo.
- `ffmpeg` on PATH. Check with `ffmpeg -version`; if missing, tell the user how to install it.

## The gate: decide two things before writing any JSON

Most bad results from this tool come from skipping this step — opening the storyboard, reusing the
scenes from the example, and filling them with the new song's words. That produces a video where the
imagery belongs to a different song. Work in this order instead.

Write both answers into `STORYBOARD.md` and show them to the user before rendering anything.

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

If none of them fit, write a new one — see `docs/looks.md`. Six entries where one is a stretch is
still better than reusing `night-shift` because it was the default.

### Decision 2 — the imagery list

Before scene types, list **5–8 concrete things the viewer will see**, each one sentence, each one
traceable to a lyric line or to what the user told you about the song.

- "a paper boat going down a rain gutter" — good: a place, an object, an action.
- "sadness" — not imagery. Neither is "the vibe of the chorus".

Then cover the song with those images. If a section has nothing to show, that is a signal: reread
the lyric line, or ask the user what the song is about. Do not fill the gap with a scene you already
have — that is how one song's props end up in another song's video.

**The nine office scenes (`keyboard`, `desk`, `stampScene`, `emptyScene`, `call110`, `erase`,
`voidScene`, `kitchenScene`, `logout`) are the props of one specific song about working late.** They
exist as a worked example of how far the engine goes, not as a template. Use them only if the song is
genuinely about that: an office, deadlines, being deleted, calling for help at 2 AM. For any other
song, build from `field` / `typeOnly` or write a new scene.

## Steps

### 1. Analyze the audio

```bash
song-mv analyze song.flac --out data/features.json
```

Reports tempo, downbeat phase, onset count. This JSON is the timing ground truth — beats, bars and
onsets in every scene come from it. Do not hand-edit it.

Half/double-time ambiguity is normal: if the reported tempo is obviously wrong for the song, rerun
with `--bpm <the tempo you hear>`.

### 2. Read the song

Write in `STORYBOARD.md` what the song is about, in three sentences. If the user gave comments,
interview quotes or a mood brief, those are the director's notes and outrank your reading.

Then mark the sections (intro / verse / chorus / bridge / outro) and give each one an emotional
state: `still`, `tender`, `build`, `release`, `intense`, `peak`, `dawn`, `fade`.

### 3. Choose the look and the imagery (the gate above)

### 4. Draft the storyboard

```bash
song-mv plan --features data/features.json --look paper --scenes generic --storyboard storyboard.json
```

`plan` slices the song at bar lines where the energy actually changes and assigns a look, a state and
a generic scene per shot. It is a first draft: replace the params with your imagery list.

Shot fields:

| field | meaning |
|---|---|
| `start` / `end` | seconds; shots tile the song in order |
| `scene.type` | `field` / `typeOnly`, or a scene you wrote, or an office-pack scene |
| `scene.params` | content for that scene: texture, motif, text, layout |
| `palette` | emotional state for the shot; the look turns it into colours |
| `enter` | `cut` / `dissolve` / `glitch` / `wipe` |
| `loud` | camera punch on downbeats |

Top level: `look`, `lyricsFile`, `duration`, optional `post` / `safety` overrides.

### 5. Preview stills, not video

```bash
song-mv preview --storyboard storyboard.json --features data/features.json \
                --times 5,30,60,90,120 --out out/preview
```

Look at the images. For each one ask: *could this frame belong to a different song?* If yes, the
imagery is not specific enough — go back to the list, not to the render. Fix text collisions and
contrast here; a render is minutes, a still is a second.

### 6. Render

```bash
song-mv render --storyboard storyboard.json --features data/features.json \
               --audio song.wav --out out/mv.mp4
```

### 7. Check the encoded file

- Extract frames from the **mp4**, not from the engine, and confirm they match the previews.
- `song-mv qa --file out/mv.mp4` reports the luma curve and hard flashes. More than ~3 luminance
  jumps per second is uncomfortable and a photosensitivity risk.

## Scene reference

### Generic scenes (any song)

| type | what it draws | key params |
|---|---|---|
| `field` | a textured background, one motif, the lyric | `layer`, `motif`, `motifAt`, `folds`, `horizon`, `density`, `lyricY`, `still`, `caption` |
| `typeOnly` | the lyric as the whole picture | `lines[]`, `layout`, `size`, `accent`, `kicker` |

`layer`: `paper` `water` `rain` `snow` `ink` `motes` `thread` `window`
`motif`: `boat` `window` `moon` `lantern` `chair` `birds`

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

## When nothing fits: write a scene

A scene is a function of `(ctx, tv, f, P)` — about twenty lines. Copy `field` from
`engine/scenes.mjs`, register it in `SCENES`, and build the image from the primitives in
`engine/primitive_fx.mjs` (grain, folds, water, rain, motes, ink, thread, light, boat, window, moon,
lantern, chair, birds). `docs/writing-a-scene.md` walks through one.

Writing a scene that fits the song beats reusing one that does not. That trade is the whole reason
this engine has primitives.

## Craft rules

1. **Frame is a pure function of time.** `renderFrame(t)` keeps no state between calls; shots are
   rendered out of order and single frames are re-rendered.
2. **Colour is state.** Pick palette names. A raw hex value is a design decision that needs a reason.
3. **Lyrics are the melody line.** Time words to onsets, vary the treatment between sections, and let
   the last line of a chorus land differently from the first.
4. **One idea per shot.** If it takes two sentences to describe, split the shot.
5. **Leave the last two seconds breathing.** Fade, don't cut.

## Licensing — say this before shipping

- The mp4 contains the **song**: publishing it is the user's call and their risk. The tool grants no
  rights to the music or the lyrics.
- Do not commit audio, `.lrc` files, or rendered mp4s to a public repo. `.gitignore` already
  excludes them.
- Never bundle fonts or ffmpeg. This package references system fonts by name and shells out to the
  user's own ffmpeg.
