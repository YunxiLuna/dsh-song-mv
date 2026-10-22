# Storyboard schema

A storyboard is a JSON file that fully determines the video, given the same
`features.json` and `.lrc`. Nothing time-dependent is hardcoded in the engine.

```jsonc
{
  "title": "delete",
  "duration": 181.5,
  "lyricsFile": "lyrics.lrc",
  "fps": 30,
  "post":   { "scan": 0.03 },
  "safety": { "maxFlash": 0.7 },
  "reactive": { "beatDecay": 6, "onsetDecay": 9, "strongOnset": 0.35 },
  "shots": [ /* … */ ]
}
```

## Top-level fields

| field | type | default | meaning |
|---|---|---|---|
| `title` | string | file name | shown in tooling output |
| `duration` | number | from features | seconds; the last shot must end here |
| `lyricsFile` | string \| null | `null` | path to an `.lrc`, resolved **relative to the storyboard** first, then the CWD |
| `fps` | number | `30` | render frame rate; also the resolution of the beat grid |
| `post.scan` | number | `0.03` | scanline strength over the whole frame |
| `safety.maxFlash` | number | `0.7` | hard clamp on full-frame flash alpha (photosensitivity) |
| `reactive.beatDecay` | number | `6` | how fast the beat pulse decays (higher = snappier) |
| `reactive.onsetDecay` | number | `9` | same, for onsets |
| `reactive.strongOnset` | number | `0.35` | onset magnitude above which a hit counts as "strong" |

## Shot fields

```jsonc
{
  "id": "05_call110",          // cosmetic, but keep it unique
  "start": 95.1,
  "end": 119.8,
  "palette": "intense",
  "paletteFrom": "build",      // optional: cross-fade from this state over 0.9 s
  "enter": "cut",              // cut | dissolve | wipe | glitch
  "loud": true,                // camera punch on beats (defaults true for stampScene/erase/voidScene)
  "vignette": 0.4,             // optional per-shot override
  "scene": { "type": "call110", "params": { … } }
}
```

**Shots must tile the timeline exactly.** Overlaps are silently resolved in
favour of the earlier shot; gaps render as black.

### Palettes

`palette` names an emotional state. Each palette is a full set of colours
(`bg`, `panel`, `raised`, `line`, `text`, `sub`, `mute`, `accent`, `accentHot`,
`accentDim`, `glow`, `sat`) so scenes never hardcode colour.

| palette | use it for |
|---|---|
| `still` | dead air, an office at 3 AM, the moment before anything happens |
| `tender` | memory, warmth, the quiet verse |
| `build` | something is accumulating — pressure, notifications, work |
| `release` | the first chorus lift |
| `intense` | the argument, the panic, the phone call |
| `peak` | the drop; everything at once |
| `dawn` | exhaustion, the kitchen at 2 AM, acceptance |
| `fade` | outro, credits, black |

### Entry transitions

| value | effect |
|---|---|
| `cut` | hard cut — use on downbeats |
| `dissolve` | 0.45 s fade from black |
| `wipe` | horizontal wipe |
| `glitch` | 0.22 s horizontal tear — use when the beat slams |

### `loud`

Adds a 4.5 % camera punch scaled by `beatPulse`. Almost always on for
`stampScene`, `erase` and `voidScene`; almost always off for `kitchenScene` and
`logout` — the camera should not twitch during a quiet moment.

## Where the song's content goes

Two places only:

1. **`scene.params`** — text, numbers, and timings a scene exposes
   (`docs/scenes.md`).
2. **`lyricsFile`** — everything the singer says.

If you find yourself editing `engine/scenes.mjs` to change a word on screen, the
parameter is missing — add it to the scene instead.
