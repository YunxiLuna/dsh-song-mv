# Imagery — writing a shot as JSON

A scene catalogue is finite. It is a list of one song's props, and the next song
is never about those props. This is the way out: ten drawing verbs with colour
roles, depth and motion, so the imagery for a song you have never heard can be
invented and written down as data.

```json
{ "type": "designed",
  "params": {
    "layer": "rain",
    "lyricStyle": "karaoke",
    "elements": [
      { "kind": "band", "at": [0.5, 0.72], "size": [1.3, 0.5], "fill": "panel", "alpha": 0.5, "depth": 0.2 },
      { "kind": "rect", "at": [0.5, 0.55], "size": [0.62, 0.5], "fill": "raised", "stroke": "line", "lw": 3, "depth": 0.6 },
      { "kind": "text", "at": [0.5, 0.55], "size": 42, "text": "回家", "fill": "sub", "depth": 0.62,
        "motion": { "enter": 0.8, "from": [0, 0.04] } }
    ] } }
```

No JavaScript. The shot is one JSON object, and the fields below are the whole
language.

## The ten verbs

| kind | reads as | main fields |
|---|---|---|
| `rect` | wall, card, door, screen, table edge | `size`, `radius`, `rotate`, `fill`, `stroke` |
| `ellipse` | moon, bowl, ring, stain, lamp | `size`, `rotate` |
| `line` | horizon, string, table line, rain streak | `from`, `to` (fractions of the box), `lw` |
| `poly` | roof, wave, hand, arrow, shard | `points` (fractions of the box), `close` |
| `arc` | handle, tap, smile, curl of steam | `start`, `end` (radians), `lw` |
| `text` | a place name, a date, one word | `text`, `size` (px), `font`, `weight`, `align` |
| `dots` | dust, snow, sparks, rain | `n`, `dot` (radius px), `mode`: `drift` / `fall` / `rise` |
| `band` | fog, light, water surface, vignette | `size`, `axis`, `fill`, `alpha` |
| `blob` | ink, shadow, breath, smoke | `size`, `lobes`, `alpha` |
| `grid` | window mullions, tiles, graph paper | `cols`, `rows`, `stroke` |

Every element also takes:

| field | meaning |
|---|---|
| `at` | `[x, y]` as fractions of the frame — `0.5` is the middle, `1.0` the right/bottom edge |
| `size` | `[w, h]` as fractions of the frame, except `text`, whose `size` is pixels |
| `depth` | `0` (far, barely moves with the camera) → `1` (near, moves the most) |
| `alpha` | 0–1 |
| `rotate` | radians |
| `blend` | any canvas composite mode, e.g. `"screen"`, `"multiply"` |
| `unit` | `"px"` to give `at`/`size` in pixels instead of fractions |

### Colours are roles, not hex

`fill` and `stroke` name a **palette role**: `bg panel raised line text sub mute
accent accentHot accentDim`, or `"none"`. The look decides what those mean, so
the same JSON works in all seven worlds. A hex value is accepted but freezes the
colour and loses look-awareness — use it only for something that must not shift.

### Motion

```json
"motion": { "enter": 0.7, "from": [0, 0.06], "ease": "out",
            "travel": [0.1, 0], "spin": 0.02, "bob": 0.008,
            "sink": true, "sinkAt": 0.6, "out": true, "lag": 0.4 }
```

| field | meaning |
|---|---|
| `enter` | seconds to arrive; without it the element is simply there |
| `from` | offset it starts from, in frame fractions |
| `ease` | `linear` `out` `inOut` `back` |
| `travel` | offset it drifts to across the shot |
| `spin` | radians per second |
| `bob` | idle amplitude, `bobHz` for the rate |
| `sink` / `sinkAt` | slides down and shrinks from `sinkAt` (fraction of the shot) |
| `out` / `outAt` | fades out late in the shot |
| `lag` | seconds after the shot starts before this element begins |

### Beat reactions

```json
"react": { "bar": 0.04, "beat": 0.02, "onset": 0.03 }
```

Each is an amplitude added to scale on that signal. `bar` fires once a bar (use
it for slow breathing), `beat` every beat, `onset` on detected hits (use it
sparingly — it is the loudest).

## Composition — what separates a shot from a diagram

The verbs are easy; the picture is not. Five rules carry most of it:

1. **One light source.** Pick a side, put a `band` or `blob` there, and keep
   everything else darker. Two light sources read as flat.
2. **Three planes.** At least one element at `depth < 0.3`, one around `0.5`,
   one at `0.9`. Then the camera move in the storyboard produces parallax, and
   the frame stops looking like a poster.
3. **A horizon.** Almost every image needs a line that divides ground from air
   — `line`, `band` or the edge of a `rect`. Without it, objects float.
4. **Eight to fourteen elements.** Six reads as a diagram. Twenty reads as noise.
   The extras are usually texture: `dots`, a second `band`, a faint `grid`.
5. **Two events, not one.** Something arrives (`enter`), and something leaves or
   changes (`sink`, `travel`, `out`). A shot with one event is a still with a
   slow zoom.

## From a lyric line to JSON

Take 天黑了，我还在等公交 (it is dark, I am still waiting for the bus):

1. **Name the image in nouns** — night, bus stop, a pole, rain, a phone screen.
2. **Pick the light** — the screen is the only light, so everything else sits in
   shadow; the screen gets `accentHot`.
3. **Assign the planes** — sky `band` at 0.15, the street `band` at 0.3, the pole
   at 0.85 (near, so it slides), rain `dots` at 0.95.
4. **Give the shot two events** — the pole slides past (`travel`), the phone
   screen flares on the first chorus (`react.onset`).
5. **Write it.** Roughly a dozen elements; the JSON above is the shape.

The lyric is not an illustration brief; it is a list of things that exist in the
same world. Pick two of them and put them in one frame.

## Checklist before rendering

- [ ] Every `fill`/`stroke` is a role, not a hex, unless it must not shift.
- [ ] Three depths are used, and the shot's camera move is non-`none`.
- [ ] There is a horizon.
- [ ] 8–14 elements.
- [ ] Two events, and they are not both at second 0.
- [ ] `node tools/preview.mjs` looks right at the start, middle and end of the
      shot, not just the middle.
- [ ] `node tools/check-motion.mjs` scores the shot above 1.0.

## Mixing with the prop library

`designed` accepts `elements` and `actors` in the same shot. Use actors when the
thing already exists (`boat`, `moon`, `lantern`, `chair`, `birds`), elements for
everything else. A shot that is all actors is a scene from the catalogue; a shot
that is all elements is one you invented.
