# Writing a scene is part of the pipeline

A generic scene can carry a shot. It cannot carry a *film*. The density in a
good music video comes from things that only make sense for that song: the
gutter the paper boat is stuck in, the particular way a phone glows at 2 a.m.,
the exact moment the room empties.

So scene authoring is a pipeline step with three lanes, ordered by cost:

| lane | when | how | cost |
|---|---|---|---|
| **elements** | the default: any shot you can describe with shapes, strokes, type and particles | `designed` + `elements` JSON ([docs/imagery.md](imagery.md)) | no code |
| **compose** | the shot is an arrangement of props that already exist | `designed` + actors in the storyboard | no code |
| **scaffold** | the shot needs a drawing the verbs cannot express | `song-mv new-scene <name>`, fill the body | ~40 lines |
| **custom** | the shot is the film's signature image | write it freely against the contract | as long as it needs |

The first lane is the one that scales, because it does not grow a catalogue: ten
verbs compose into any picture an agent can name, and the picture for a song
nobody has heard yet is just another JSON object.

All three end in the same place: a scene named by the storyboard, measured by
the motion check, rendered by the same engine.

## Lane 1 — compose with actors

`designed` takes three depth planes and a list of actors per plane. Each actor
is a prop plus its choreography.

```json
{ "type": "designed", "params": {
    "layer": "water", "horizon": 690,
    "back": [{ "prop": "moon", "at": [1480, 240, 150], "enter": 0.5, "enterFrom": "above" }],
    "mid":  [{ "prop": "boat", "at": [600, 650, 200], "enter": 0.5, "enterFrom": "left",
               "travel": [520, -10], "stage": "sink", "sinkAt": 0.62 }],
    "near": [{ "prop": "motes", "at": [960, 720, 1], "n": 36, "enterFrom": "none", "bob": 0 }],
    "lyricStyle": "karaoke", "lyricY": 930 } }
```

Props: `boat window moon lantern chair birds grain folds water rain motes ink thread light vignette`.
Choreography keys, identical for every prop:

| key | meaning |
|---|---|
| `at` | `[x, y, size]` |
| `enter`, `enterDur`, `enterFrom` | when and from where it arrives (`below` default) |
| `travel` | how far it crosses over the shot, as `[dx, dy]` |
| `bob`, `bobHz` | idle float |
| `rot`, `sway` | base rotation, sway amplitude |
| `stage`, `sinkAt` | `sink` or `return` partway through the shot |
| `react` | kick on strong onsets |
| `flip`, `alpha`, `phase` | mirror, opacity, moon phase |

Because every actor carries its own entrance and travel, a composed shot moves
by construction — which is the whole point.

## Lane 2 — scaffold a scene

```bash
song-mv new-scene gutter --out scenes/gutter.mjs
```

The file renders immediately: three planes, one entrance, one event, the lyric,
and a `SCENES` export. Point the storyboard at it:

```json
{ "scenes": ["scenes/gutter.mjs"],
  "shots": [{ "id": "03", "start": 41, "end": 68, "scene": { "type": "gutter", "params": {} } }] }
```

Then replace the placeholder body with the thing you actually see. Keep the
shape: background plane, subject with an entrance, foreground plane, one event,
lyric treatment. The scaffold's imports are on `ctx`, so the file needs no
`import` statements and can live anywhere.

## Lane 3 — write it freely

The contract is one function:

```js
export function shot(ctx, tv, f, P) { /* draw one frame */ }
```

- `ctx.pal` colours for the current emotional state
- `ctx.g` the 2D context
- `ctx.cam` the camera; `ctx.cam.depth(k)` gives this plane's parallax offset
- `ctx.lyr.activeAt(tv)` the current lyric line
- `ctx.feats` tempo/beat/spectrum
- `ctx.lib` the primitives and `hexA`; `ctx.mo` easing, `ramp`, `decay`, `bob`

Rules that are not optional:

1. **Pure function of time.** Same `tv` → same frame. No `Math.random()` without
   a seed, no state carried between frames.
2. **Do not move the frame.** The camera wraps your function; apply `ctx.cam.depth(k)`
   per plane instead of translating the whole canvas.
3. **Something must happen.** An arrival, a departure, a strike, a change of
   state. A held composition is a still, not a shot.

## Lane 4 — the gate: `check-motion`

```bash
song-mv check-motion --storyboard storyboard.json --features data/features.json
```

It renders eight frames per shot and scores each pair: pixel change + 0.05 × how
far the dark mass travelled. Shots under `1.0` fail.

```
shot                     type        len   score   pixels  shift  frames
03_sink                  field      28.6s    0.48     0.16    6.4  0/7  ← static
```

That line is a real result from this repo: a shot that looked fine as a still
and did nothing on screen. Fix by giving it a camera move, a travelling subject,
or a second event — then re-run until every shot passes.

### Measure at the size you ship

`check-motion` renders at the storyboard's resolution (1920×1080 by default).
Scenes place things in absolute coordinates, so measuring a downscaled frame
evaluates a different picture: a cup at x=1180 is off-screen at 960 wide, and a
shot that is clearly alive gets reported as static. If you change the render
size, keep it in the storyboard's `render` block so every tool agrees.

## The full order of operations

1. `analyze` — features
2. decide the look and the cast (SKILL gate)
3. `plan` — section boundaries
4. per shot: compose → scaffold → custom
5. `check-motion` — every shot moves
6. `preview` — composition, two frames one second apart must differ
7. `render`
8. `qa` — brightness, flashes
