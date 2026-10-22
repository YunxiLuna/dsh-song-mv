# song-mv — turn a song into a code-rendered music video

Use this skill when the user wants a **music video, lyric video, or MV** rendered from an audio
file, or wants to change an existing one ("make the lyrics punchier", "add a story scene").

Everything is drawn in code (node-canvas) as a pure function of song time, then piped to ffmpeg.
There is no timeline editor and no stock footage: every frame is generated.

## What you need before starting

- The audio file (`.mp3` / `.flac` / `.wav` / anything ffmpeg reads).
- A `.lrc` lyric file **if the song has lyrics**. Ask for it; do not scrape lyrics from a
  streaming service — they are licensed text and must not be committed to a repo.
- `ffmpeg` on PATH. Check first: `ffmpeg -version`. If missing, tell the user how to install it
  instead of trying to bundle or download it.

## The five steps

Run these from the project directory that will hold the MV (`song-mv` is the CLI this plugin
ships; `npx dsh-song-mv` also works once the package is installed).

### 1. Analyze the audio

```bash
song-mv analyze song.flac --out data/features.json
```

Reports tempo, downbeat phase and onset count. This JSON is the timing ground truth — every beat,
bar and onset in every scene comes from it. Do not hand-edit it.

### 2. Read the song before designing anything

Write down, in `STORYBOARD.md`, **what the song is about**. If the user gave you comments,
interview quotes, or a mood brief, treat those as the director's notes. Then assign each section:

- a **section** (intro / verse / chorus / bridge / outro),
- an **emotional state** (`still`, `tender`, `build`, `release`, `intense`, `peak`, `dawn`, `fade`),
- one **story beat** — a concrete thing the viewer sees, not an abstraction.

A music video is not "lyrics with a background". Tie each section to a place, an object, or an
action the audience can name in one sentence.

### 3. Draft the storyboard

```bash
song-mv plan --features data/features.json --storyboard storyboard.json
```

`plan` writes a starting point: it slices the song into shots at section boundaries and gives each
one a scene type and palette from the energy curve. Edit it by hand — it is a first draft, and the
interesting part is what you change.

Shot fields:

| field | meaning |
|---|---|
| `start` / `end` | seconds; shots must tile the song in order |
| `scene.type` | one of the built-in scene types (below) |
| `scene.params` | content for that scene: text, numbers, labels, layout |
| `palette` | emotional state for the shot; drives every colour |
| `enter` | `cut` / `dissolve` / `glitch` / `wipe` |
| `loud` | camera punch on downbeats (defaults on for stamp/erase/void) |

### 4. Preview cheaply, then render

Never start with a full render. Render stills first:

```bash
song-mv preview --storyboard storyboard.json --features data/features.json \
                --times 5,30,60,90,120 --out out/preview
```

Look at the images. Fix composition, contrast and text collisions **before** spending minutes on a
render. Then:

```bash
song-mv render --storyboard storyboard.json --features data/features.json \
               --audio song.wav --out out/mv.mp4
```

### 5. Check the result

- Extract frames from the **encoded mp4**, not from the engine, and confirm they match the
  previews (codecs and colour conversion can bite).
- Run the flash check: more than ~3 luminance jumps per second is uncomfortable and a photosensitivity
  risk. `song-mv qa --file out/mv.mp4` reports the luma curve and any hard flashes.

## Built-in scene types

Content-driven scenes expect `scene.params`. Unknown params are ignored; every string has a neutral
English default, so override them for the actual song.

| type | what it draws | key params |
|---|---|---|
| `keyboard` | one giant lit key in the dark; timestamp HUD | `keyLabel`, `clock`, `place` |
| `desk` | desk at night, monitor showing an inbox, notification cards piling up | `inboxTitle`, `inboxCount`, `inboxRows` |
| `stampScene` | floating slides/briefs getting stamped | `slides[]`, `stampText` |
| `emptyScene` | the same room, emptied out | — |
| `call110` | phone call UI, reminder card, comment ticker | `number`, `caller`, `reply`, `noteKicker`, `noteTitle`, `tickerText`, `tickerLabel` |
| `erase` | eraser cursor wiping a floor plan clean | — |
| `voidScene` | black hole, word wall, album title card | `albumAt`, `albumTitle`, `albumSubtitle` |
| `kitchenScene` | late-night kitchen: pot, noodles, moon | `punchline` |
| `logout` | log-out dialog over the kitchen, cursor clicks cancel | `question[]`, `cancelLabel`, `quitLabel`, `endText` |

Mix them with the lyric effects in `engine/lyric_fx.mjs` (`slam`, `bounce`, `wall`, `sliced`,
`onPath`, `decode`, `burst`, `karaoke`) and the props in `engine/story_fx.mjs`.

## Rules that keep it looking like a music video

1. **Frame is a pure function of time.** `renderFrame(t)` may not keep state between calls.
   `song-mv` renders shots out of order and re-renders single frames; any stored state breaks that.
2. **Colour is state, not decoration.** Pick from the palette names. A new hex value is a design
   decision that needs a reason.
3. **Lyrics are the melody line, not subtitles.** Time each word to an onset, not to a fixed
   characters-per-second rate, and vary treatment between sections.
4. **One idea per shot.** If a shot needs two sentences to describe, split it.
5. **Leave the last two seconds breathing.** Fade, don't cut.

## Licensing — say this to the user before shipping

- The generated mp4 contains the **song**, so publishing it is the user's call and their risk;
  the tool does not grant any rights to the music or lyrics.
- **Do not commit** audio files, `.lrc` files, or rendered mp4s to a public repo. `.gitignore`
  already excludes them.
- Never bundle fonts or ffmpeg. This package references system fonts by name only, and shells out
  to whatever ffmpeg the user installed.
