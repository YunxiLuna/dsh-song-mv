# song-mv

**English** · [简体中文](README.zh-CN.md)

**Code-rendered music videos.** Point it at a song and an `.lrc`, and it draws a
beat-synced video frame by frame — no stock footage, no After Effects, no
browser, no GPU. Lyrics are typography you can animate; backgrounds are scenes
drawn in code (a keyboard at 2 AM, an inbox avalanche, an office tower going
dark, a phone call to 110, an eraser eating a floor plan).

It ships two ways:

- a **DSH plugin** — install it once, then ask your agent for a music video;
- a **standalone CLI** (`song-mv analyze|plan|preview|render|qa`) — no agent
  required.

```
song  ─▶ analyze ─▶ features.json ─┐
                                   ├─▶ render ─▶ frames ─(pipe)─▶ ffmpeg ─▶ .mp4
storyboard.json ───────────────────┘                              ▲
lyrics.lrc ─────────────────────────────────────────────────────────┘
```

**[▶ watch the 54 s demo (webm, silent)](docs/demo/demo.webm)** · [contact sheet](docs/demo/contact-sheet.png)

![nine scenes](docs/demo/contact-sheet.png)

*Every frame above is drawn by code: no footage, no images, no bundled fonts.
The demo's audio is synthesised by ffmpeg and its lyrics were written for this
repo — see [`examples/synthetic-demo`](examples/synthetic-demo).*

> **On how this was built.** The engine was developed and tuned against a
> personal copy of a commercial track (a NetEase Cloud Music purchase) plus its
> `.lrc`. Neither that recording nor any of its lyrics — and none of the videos
> rendered from it — are in this repository or in its history. What ships is the
> engine, the storyboard format, and the synthetic demo above. If you point it at
> a song you own, the output is for you; publishing *that* video is a separate
> question that your local copyright rules answer, not this repo.

Rendering is a pure function of time: `renderFrame(t)` draws the exact same
pixels every run. That is what makes it scriptable, diffable and safe to
re-render after a one-line change.

---

## Install

### Requirements (two, both installed by you)

| dependency | version | where to get it |
|---|---|---|
| **Node.js** | ≥ 20.10 | [nodejs.org](https://nodejs.org/) — LTS release |
| **ffmpeg** | ≥ 6.0 | [ffmpeg.org/download.html](https://ffmpeg.org/download.html) — unzip, put `bin` on `PATH` |

```bash
node -v          # v20.10 or newer
ffmpeg -version  # any version prints fine
```

ffmpeg is **not** bundled and **not** downloaded for you, on purpose (see
[Licensing](#licensing)). If it is missing, `render` fails with the exact
download link for your platform instead of guessing.

There is no postinstall step and no bundled binary.

macOS/Linux note: if `npm install` cannot find Cairo/Pango headers, install them
(`brew install pkg-config cairo pango libpng jpeg giflib librsvg`, or
`apt install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`).

---

### As a DSH plugin

```bash
git clone <this repo> dsh-song-mv
cd dsh-song-mv && npm install        # fetches canvas; run this once to verify it builds
dsh plugin --profile desktop add "link:$PWD/dsh-song-mv"
# restart DSH once so the bundle layer picks it up
```

You get a `song-mv` skill in the agent's skill list plus the `song-mv` CLI.
The skill walks the agent through: analyze → read the song → plan → preview →
render → qa.

**No `dsh` command?** It is not on `PATH` for every install (the desktop app
does not expose it). Two equivalent routes:

- **ask your agent to install it** — DSH ships a plugin manager, and the agent
  can also do the file edits below for you;
- **edit the profile by hand** — add `"dsh-song-mv": "link:/abs/path"` to
  `~/.dsh/profiles/desktop/package.json` → `dependencies`, add `"dsh-song-mv"` to
  the same file → `dsh.profile.bundles`, run `pnpm install` in that directory,
  restart DSH. Step by step:
  [docs/publishing.md](docs/publishing.md#5-installing-into-dsh).

### As a plain CLI

```bash
git clone <this repo> dsh-song-mv
cd dsh-song-mv
npm install          # builds/downloads the canvas native binding
node tools/cli.mjs help
```

Everything below works identically with the plugin installed — the plugin only
adds the agent skill on top of these commands.

## Five-minute quickstart

```bash
# 1. decode + analyze the song (any format ffmpeg can read)
node tools/analyze.mjs song.flac --out features.json
#    tempo 106.67 BPM · 5445 frames · 181.5s

# 2. draft a storyboard (cut points land on bar lines, scenes vary by energy)
node tools/plan.mjs --features features.json --out storyboard.json --shots 9

# 3. edit storyboard.json: set lyricsFile, replace the placeholder scene
#    params with what the song is actually about (see docs/scenes.md)

# 4. look before you commit ten minutes of rendering
node tools/preview.mjs --storyboard storyboard.json --features features.json \
  --audio song.flac --out out/preview

# 5. render
node tools/render.mjs --storyboard storyboard.json --features features.json \
  --audio song.flac --out out/mv.mp4 --crf 18

# 6. check it
node tools/qa.mjs --file out/mv.mp4
```

A 3-minute 1080p video renders at roughly **25 fps** on a normal laptop
(~3.5 minutes wall clock, 57 MB at CRF 18).

### `analyze` options

| flag | meaning |
|---|---|
| `--fps 30` | frames per second of the beat grid (must divide the sample rate) |
| `--bpm 106.67` | force the tempo when you know it — energy voting cannot tell 80 from 160 |
| `--out features.json` | where to write the analysis |

Tempo detection is honest about its ambiguity: it reports the winning grid plus
`tempoCandidates` (the runner-up metrical levels). If the pulse feels half-speed,
that is not a bug — pass `--bpm`.

---

## What a storyboard looks like

```jsonc
{
  "title": "delete",
  "duration": 181.5,
  "lyricsFile": "lyrics.lrc",
  "post": { "scan": 0.03 },          // scanlines
  "safety": { "maxFlash": 0.7 },     // clamp on full-frame flashes
  "shots": [
    {
      "id": "05_call110",
      "start": 95.1, "end": 119.8,
      "palette": "intense",          // still|tender|build|release|intense|peak|dawn|fade
      "enter": "cut",                // cut|dissolve|wipe|glitch
      "loud": true,                  // camera punch on the beat
      "scene": {
        "type": "call110",
        "params": {
          "number": "110",
          "caller": "你好，我需要帮助。",
          "reply": "请讲，我在听。",
          "tickerText": "deadline · deadline · nobody answers the mail"
        }
      }
    }
  ]
}
```

Rules that matter:

- **shots must tile the timeline** — no gaps, no overlaps; the last `end` is the
  song duration.
- **`palette` is emotional state, not colour** — `still` is a dead office at
  2 AM, `peak` is the drop. Scenes read palette fields (`p.accent`, `p.text`, …)
  so a palette change re-colours everything for free.
- **`enter`** is how the shot arrives; `glitch` is for when the beat hits.
- **params carry the story.** Every string the demo shows lives in its
  storyboard, not in the engine — `examples/nine-shots/storyboard.json` is a full
  nine-shot arc you can copy and rewrite line by line.

Full schema: [docs/storyboard.md](docs/storyboard.md).
Scene catalogue and every parameter: [docs/scenes.md](docs/scenes.md).

---

## Lyrics

`lyricsFile` points at a standard `.lrc`:

```
[00:00.50]one step at a time
[00:05.80]walking through the queue
[00:18.40]delete the noise
```

The engine finds the active line for each timestamp and hands it to the scene,
which decides *how* it appears (slam, word-by-word bounce, rubber stamp,
RGB-split glitch, karaoke fill, echo wall…). Lines without a timestamp are
ignored, so a plain-text lyric file will produce a video with no lyrics.

Lyrics are a literary work. Ship an `.lrc` only if you have the right to use it
— see below.

---

## Licensing

This repository is **MIT**. The interesting part is what it does *not* contain:

- **No music, no lyrics, no fonts, no ffmpeg.** All four are supplied by you at
  run time. `.gitignore` blocks them from ever being committed by accident.
- **ffmpeg is spawned as a separate process**, never linked or bundled. Per the
  GPL FAQ that is mere aggregation: your video output is yours, and the repo
  carries no ffmpeg obligation.
- **fonts are referenced by family name only** (`Inter`, `Microsoft YaHei`,
  `Noto Sans CJK` …) and rendered by whatever the OS provides.

If you *do* redistribute a packaged artifact (zip, Docker image, single binary)
that embeds `node_modules`, then you are a distributor: `canvas` bundles
**Cairo (LGPL-2.1 / MPL-1.1)** and, in canvas v3, **Pango (LGPL only)**. Read
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) before you do that.

The realistic risk in a project like this is not the MIT dependencies — it is
**demo assets**: a commercial track, a scraped `.lrc`, or a font file committed
"just for the example". So `examples/` ships the *storyboard format* — shot
tables with original placeholder copy — plus one **synthetic** demo whose audio is
generated by ffmpeg and whose lyrics were written for this repo.

To be precise about what that means: this repo contains no audio recording of any
published song, no `.lrc` transcribed from one, and no video rendered from one.
The storyboards in `examples/` describe *shot structure* (timings, palettes, scene
types); the words in them are written for the example. A storyboard is not a
recording and not a lyric sheet, but if you fill one with someone else's lyrics
and publish the render, that is on you, not on the MIT licence.

---

## Repository layout

```
engine/
  core.mjs        palettes, Features (beat/onset sampling), Lyrics, canvas ctx, post FX, createEngine
  scenes.mjs      9 scene functions, each (ctx, tv, f, params)
  lyric_fx.mjs    lyric treatments: slam / bounce / wall / sliced / karaoke / decode …
  story_fx.mjs    story props: stamp, ticker, phone call, city towers, kitchen, floor plan, black hole …
  prng.mjs        seeded randomness (same seed → same frame)
tools/
  analyze.mjs     ffmpeg decode → WAV → FFT → features.json
  plan.mjs        draft a storyboard from the energy curve
  preview.mjs     render a few stills
  render.mjs      full render, raw frames piped straight into ffmpeg
  qa.mjs          luma curve + flash detector
  cli.mjs         one entry point for all of the above
  lib/analyze.mjs pure-JS FFT / mel bands / tempo grid (no Python, no librosa)
skills/song-mv/   the agent-facing workflow
examples/         storyboards: nine-shots (full arc, placeholder copy) and synthetic-demo
docs/             storyboard schema, scene catalogue, rendering model, demo assets
```

---

## FAQ

**Why canvas and not a browser?** Frames are generated headlessly and piped to
ffmpeg as raw RGBA. No page load, no screenshot timing, no 60 fps ceiling, no
GPU. It also means the output is deterministic.

**Can I add my own scene?** Yes — write `export function myscene(ctx, tv, f, P)`
in `engine/scenes.mjs`, draw with `ctx.g`, read the palette from `ctx.pal`, the
lyrics from `lyricsOf(ctx).activeAt(tv)`, and register it in `SCENES`. Then use
`"type": "myscene"` in a shot.

**Why is the first frame black?** Shot-entry transitions (`dissolve`, `glitch`)
fade in from black. Start the first shot at 0 with `"enter": "cut"`.

**The render is slow on my machine.** Drop `--fps` to 24, or render a section
with `--start 60 --end 90` while iterating. Rendering at 1080p is CPU-bound in
canvas.

**Can I use a still image or a photo?** Read it with `canvas.loadImage()` inside
a scene. Make sure you have the rights to it.

---

## License

MIT © 2026 dsh-song-mv contributors. See [LICENSE](LICENSE) and
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
