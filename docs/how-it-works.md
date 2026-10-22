# Rendering model

This document explains *why* the code looks the way it does. If you are only
using the tool, `README.md` and `skills/song-mv/SKILL.md` are enough.

## 1. A frame is a pure function of time

```js
renderFrame(t)  // → canvas
```

No state is carried between calls. Nothing accumulates, nothing is "advanced".
Given the same storyboard, features and lyric file, frame 3000 is byte-identical
on every machine and every run.

That single decision buys:

- **random access** — render `--start 120 --end 130` to fix one shot without
  re-rendering the song;
- **parallelism** — frames have no ordering dependency;
- **reviewability** — a diff in the storyboard maps to a diff in the output;
- **crash safety** — a failed render retries only what is missing.

The cost is that every scene has to derive its animation from
`t0 = tv - P.start` instead of storing a velocity. In practice that makes scenes
*easier* to write, not harder: `Math.sin(t0 * 3)` replaces an integrator.

## 2. Time comes from data, never from the audio clock

`features.json` is the timing ground truth:

```jsonc
{
  "meta": { "sampleRate": 44100, "fps": 30, "frames": 5445, "duration": 181.5 },
  "bpm": 106.67,
  "grid": { "bpm": 106.67, "t0": 0.02, "period": 0.5625 },
  "downbeatPhase": 1,
  "beats": [ … ],
  "onsets": { "t": [ … ], "s": [ … ] },
  "rms": [ … ], "low": [ … ], "mid": [ … ], "high": [ … ],
  "spectrum": [ /* 32 mel bands per frame, uint8 */ ]
}
```

`Features.sample(t)` turns that into instantaneous values a scene can read:
`beatPulse`, `barPulse`, `downPulse`, `onsetPulse`, `rmsEnv`, `lowEnv`,
`spec`. The audio file is never opened during rendering — which is why a render
can start at the chorus.

## 3. Colour is state

A palette is not a colour scheme, it is an emotional position:

```js
intense: { bg: '#1a0f22', panel: '#2a1730', accent: '#ff3b5c', … }
```

Scenes read `p.accent`, `p.panel`, `p.text`… and never a literal hex. Change the
palette of a shot and every prop, lyric and HUD in it re-colours coherently.
`paletteFrom` cross-fades between two states over 0.9 s, which is how a chorus
"lifts" without a cut.

## 4. Lyrics are typography, not subtitles

`Lyrics.activeAt(t)` returns the current line, the previous one, the next one and
the age of the current line. A scene decides what to do with them, and the
treatments in `lyric_fx.mjs` are deliberately mechanical:

| treatment | shape of the motion |
|---|---|
| `kinetic` | word-by-word smash-in with scale/rotation overshoot and an afterimage |
| `slam` | whole line drops with a blur streak |
| `bounce` | elastic per-character landing |
| `wall` | the line repeated as a textured wall (used for the drop) |
| `sliced` | horizontal slices displaced on onsets |
| `karaoke` | wipe fill timed to the line duration |
| `decode` | scrambled → resolved (settles by `age`) |

Every one of them is a function of `age`, so they are seek-safe.

## 5. Frames go straight to the encoder

```
canvas.toDataURL / PNG per frame   →  ~8 fps, 2.5 GB of temp files
ctx.getImageData → rawvideo → ffmpeg stdin   →  ~25 fps, zero temp files
```

`render.mjs` pipes `rgba` buffers into a single ffmpeg process and lets it mux
the audio in the same command. That is a 3× speedup and removes the "half a
render leaked onto disk" failure mode.

Two things had to be right:

- `-pix_fmt yuv420p -r <fps>` with an explicit `-f rawvideo -s WxH` input spec,
  otherwise ffmpeg guesses the geometry from the first packet;
- `-movflags +faststart` so the mp4 seeks properly in a browser.

## 6. Quality gates

The pipeline is built so that mistakes are cheap to catch:

1. **`preview`** — stills at 62 % through each shot. Composition bugs, text
   collisions and dead frames show up here, before a render costs minutes.
2. **`qa`** — luma curve plus a flash detector. A music video that strobes more
   than ~3 times a second is a photosensitivity hazard; `safety.maxFlash` clamps
   full-frame flashes, and `qa` tells you when you are near the line.
3. **frames from the encoded file** — always verify the mp4, not the engine.
   Colour conversion and codec settings are exactly where a "perfect" render
   turns into a washed-out delivery.

## 7. What is deliberately *not* here

- **No timeline editor, no keyframes, no easing library.** Scenes are code.
- **No Python, no librosa.** `tools/lib/analyze.mjs` is a dependency-free FFT +
  mel filterbank + tempo grid; it agrees with librosa's band math to three
  decimals on real material and removes a 300 MB install.
- **No stock assets, no fonts, no ffmpeg in the repo.** See
  `THIRD-PARTY-NOTICES.md`.
