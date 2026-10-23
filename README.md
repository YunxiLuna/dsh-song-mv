# song-mv

**English** · [简体中文](README.zh-CN.md)

Give it a song and an `.lrc` and it draws a beat-synced video, one frame at a
time, on a canvas. Lyrics are typography, not a subtitle bar.

What the video looks like is a decision you make, not a default you inherit.
A **look** picks the colour world — paper, rain, daylight, ember, mono, or the
dark neon one — and a small set of **primitives** (grain, folds, water, rain,
ink, motes, light, and a handful of motifs) builds the imagery that song needs.
A song about a paper boat gets paper and rain; it does not get an office.

Two ways to run it. As a DSH plugin, so you can just ask your agent for a video.
Or as a CLI, if you'd rather drive it yourself.

```
song  ─▶ analyze ─▶ features.json ─┐
                                   ├─▶ render ─▶ frames ─(pipe)─▶ ffmpeg ─▶ .mp4
storyboard.json ───────────────────┘                              ▲
lyrics.lrc ─────────────────────────────────────────────────────────┘
```

**[▶ 54 s demo (webm, silent)](docs/demo/demo.webm)** · [contact sheet](docs/demo/contact-sheet.png)

![nine scenes](docs/demo/contact-sheet.png)

*Frames from the demo. Every pixel is drawn by code — no footage, no images, no
bundled fonts. The audio is synthesised by ffmpeg and the lyrics were written for
this repo; see [`examples/synthetic-demo`](examples/synthetic-demo).*

About the test song: I built and tuned this against a commercial track I bought
on NetEase Cloud Music, together with its `.lrc`. That recording, its lyrics, and
the videos rendered from it are not in this repo. What's here is the engine, the
storyboard format and the synthetic demo.

A frame is a pure function of time. `renderFrame(t)` gives you the same pixels on
every run, which is why you can change one line, re-render, and diff the two.

## The two decisions

Everything that goes wrong with a generated music video goes wrong here, so the
skill makes them explicit before any JSON gets written.

**1. The look.** One colour world for the whole film.

| look | world | for songs about |
|---|---|---|
| `paper` | warm off-white, ink, folds | memory, letters, tenderness |
| `rain` | wet blue-grey, cold light | grief, distance, the city at night |
| `daylight` | bright neutral, clean air | hope, morning, release |
| `ember` | deep red-brown, low light | anger, heat, obsession |
| `mono` | black and white | archive, grief held still |
| `night-shift` | dark blue neon, screens | late-night work, irony, dread |

**2. The imagery.** Five to eight concrete things the viewer will see, each
traceable to a lyric line. "A paper boat going down a rain gutter" is imagery;
"sadness" is not. If a section has nothing to show, reread the lyric — do not
reuse a scene from the last song.

`docs/looks.md` covers the palettes and how to add a world.
`docs/writing-a-scene.md` walks through writing a 25-line scene when nothing
shipped fits. The nine office scenes in `examples/nine-shots` are one song's
props, kept as a worked example — see [the demo note](#a-note-on-the-test-song).

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

ffmpeg is not bundled and not downloaded for you, on purpose (see
[Licensing](#licensing)). If it's missing, `render` stops and prints the download
link for your platform instead of guessing. There's no postinstall step and no
binary in the package.

On macOS/Linux, if `npm install` can't find Cairo/Pango headers:

```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg
# or
apt install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

### As a DSH plugin

```bash
git clone <this repo> dsh-song-mv
cd dsh-song-mv && npm install        # fetches canvas; run it once to check it builds
dsh plugin --profile desktop add "link:$PWD/dsh-song-mv"
# restart DSH once so the bundle layer picks it up
```

That adds a `song-mv` skill to the agent's skill list, plus the CLI. The skill
walks the agent through analyze → read the song → plan → preview → render → qa.

If you don't have a `dsh` command (the desktop app doesn't always put it on
`PATH`), there are two equivalent routes:

- ask your agent to install it — DSH has a plugin manager, and the agent can do
  the file edits below for you;
- edit the profile by hand: add `"dsh-song-mv": "link:/abs/path"` to
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

Everything below works the same with the plugin installed. The plugin only adds
the agent skill on top of these commands.

## Five-minute quickstart

```bash
# 1. decode + analyze the song (any format ffmpeg can read)
node tools/analyze.mjs song.flac --out features.json
#    tempo 106.67 BPM · 5445 frames · 181.5s

# 2. draft a storyboard; cut points land on bar lines, scenes follow the energy.
#    --look picks the colour world, --scenes generic keeps it song-agnostic
node tools/plan.mjs --features features.json --out storyboard.json --shots 9 \
  --look paper --scenes generic

# 3. edit storyboard.json: set lyricsFile, replace the placeholder scene params
#    with what the song is actually about (see docs/scenes.md)

# 4. look before you commit ten minutes of rendering
node tools/preview.mjs --storyboard storyboard.json --features features.json \
  --audio song.flac --out out/preview

# 5. render
node tools/render.mjs --storyboard storyboard.json --features features.json \
  --audio song.flac --out out/mv.mp4 --crf 18

# 6. check it
node tools/qa.mjs --file out/mv.mp4
```

A 3-minute 1080p video renders at about 25 fps on a normal laptop: roughly 3.5
minutes wall clock, 57 MB at CRF 18.

### `analyze` options

| flag | meaning |
|---|---|
| `--fps 30` | frames per second of the beat grid (must divide the sample rate) |
| `--bpm 106.67` | force the tempo when you know it; energy voting can't tell 80 from 160 |
| `--out features.json` | where to write the analysis |

Tempo detection reports the winning grid plus `tempoCandidates`, the runner-up
metrical levels. If the pulse feels half-speed, that's expected: pass `--bpm`.

---

## What a storyboard looks like

```jsonc
{
  "title": "demo",
  "duration": 181.5,
  "lyricsFile": "lyrics.lrc",
  "post": { "scan": 0.03 },          // scanlines
  "safety": { "maxFlash": 0.7 },     // clamp on full-frame flashes
  "look": "paper",                   // the colour world for the whole film
  "shots": [
    {
      "id": "05_water",
      "start": 95.1, "end": 119.8,
      "palette": "intense",          // still|tender|build|release|intense|peak|dawn|fade
      "enter": "cut",                // cut|dissolve|wipe|glitch
      "loud": true,                  // camera punch on the beat
      "scene": {
        "type": "field",
        "params": {
          "layer": "water",          // paper|water|rain|snow|ink|motes|thread|window
          "motif": "boat",           // boat|window|moon|lantern|chair|birds
          "motifAt": [980, 600, 180],
          "horizon": 640,
          "lyricY": 880
        }
      }
    }
  ]
}
```

A few things worth knowing:

- Shots have to tile the timeline. No gaps, no overlaps, and the last `end` is
  the song duration.
- `palette` is a mood, not a colour. The look turns `still`, `peak`, `dawn` into
  actual values: `peak` is the loudest colour the world owns. Scenes read palette fields (`p.accent`, `p.text`, …), so changing the
  palette recolours everything.
- `enter` is how a shot comes in. `glitch` is the one for when the beat hits.
- `params` carry the copy. Every string the demo shows comes from its storyboard,
  not from the engine. `examples/nine-shots/storyboard.json` is a full nine-shot
  arc you can copy and rewrite line by line.

Schema: [docs/storyboard.md](docs/storyboard.md). Scenes and their parameters:
[docs/scenes.md](docs/scenes.md).

---

## Lyrics

`lyricsFile` points at a standard `.lrc`:

```
[00:00.50]one step at a time
[00:05.80]walking through the queue
[00:18.40]delete the noise
```

For each timestamp the engine finds the active line and hands it to the scene,
which decides how it shows up: slam, word-by-word bounce, rubber stamp, RGB-split
glitch, karaoke fill, echo wall. Lines without a timestamp are ignored, so a
plain-text lyric file will give you a video with no lyrics. Timestamps can carry
one to three decimal places, since editors disagree.

Lyrics are a literary work, so only ship an `.lrc` you have the right to use.

---

## Licensing

The code is MIT. What the repo does not contain matters as much as what it does:

- No music, no lyrics, no fonts, no ffmpeg. You supply all four at run time, and
  `.gitignore` keeps them out of commits.
- ffmpeg runs as a separate process and is never linked or bundled. Per the GPL
  FAQ that's mere aggregation: your video is yours and the repo carries no ffmpeg
  obligation.
- Fonts are referenced by family name (`Inter`, `Microsoft YaHei`, `Noto Sans
  CJK`) and rendered by whatever your OS has.

If you redistribute a packaged artifact (zip, Docker image, single binary) with
`node_modules` inside, you become a distributor: `canvas` brings **Cairo
(LGPL-2.1 / MPL-1.1)** and, in canvas v3, **Pango (LGPL only)**. Read
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) first.

The usual risk in a project like this isn't the MIT dependencies, it's demo
assets: a commercial track, a scraped `.lrc`, a font committed "just for the
example". So `examples/` ships the storyboard format — shot tables with
placeholder copy — and one synthetic demo, whose audio ffmpeg generates and whose
lyrics were written here.

To be precise: this repo has no recording of a published song, no `.lrc`
transcribed from one, and no video rendered from one. The storyboards in
`examples/` describe shot structure (timings, palettes, scene types); the words in
them were written for the example. A storyboard is neither a recording nor a
lyric sheet, but if you fill one with someone else's lyrics and publish the
render, that's your call and it isn't covered by the MIT licence.

---

## Repository layout

```
engine/
  core.mjs         Features (beat/onset sampling), Lyrics, canvas ctx, post FX, createEngine
  looks.mjs        the six colour worlds; eight states interpolated from four palettes
  primitive_fx.mjs style-neutral imagery: grain, folds, water, rain, motes, ink, thread, light, motifs
  scenes.mjs       field + typeOnly (generic), plus the nine office-pack scenes
  lyric_fx.mjs     lyric treatments: slam / bounce / wall / sliced / karaoke / decode
  story_fx.mjs     the office pack's props: stamp, ticker, phone call, towers, kitchen, floor plan
  prng.mjs         seeded randomness (same seed → same frame)
tools/
  analyze.mjs     ffmpeg decode → WAV → FFT → features.json
  plan.mjs        draft a storyboard from the energy curve
  preview.mjs     render a few stills
  render.mjs      full render, raw frames piped straight into ffmpeg
  qa.mjs          luma curve + flash detector
  cli.mjs         one entry point for all of the above
  lib/analyze.mjs pure-JS FFT / mel bands / tempo grid (no Python, no librosa)
skills/song-mv/   the agent-facing workflow
examples/         storyboards: generic-field (any song), nine-shots (the office pack), synthetic-demo
docs/             looks, scene catalogue, scene authoring, storyboard schema, rendering model, demo
```

---

## FAQ

**Why canvas instead of a browser?** Frames are generated headlessly and piped to
ffmpeg as raw RGBA. No page load, no screenshot timing, no 60 fps ceiling, no GPU
needed, and the output is deterministic.

**Can I add a scene?** Write `export function myscene(ctx, tv, f, P)` in
`engine/scenes.mjs`, draw with `ctx.g`, read the palette from `ctx.pal` and the
lyrics from `lyricsOf(ctx).activeAt(tv)`, then register it in `SCENES` and use
`"type": "myscene"` in a shot.

**Why is the first frame black?** The `dissolve` and `glitch` entries fade in from
black. Start the first shot at 0 with `"enter": "cut"`.

**Rendering is slow here.** Try `--fps 24`, or render a slice with
`--start 60 --end 90` while you iterate. 1080p in canvas is CPU-bound.

**Can I use a photo?** Load it with `canvas.loadImage()` inside a scene, and make
sure you have the rights to it.

---

## License

MIT © 2026 dsh-song-mv contributors. See [LICENSE](LICENSE).
