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

## Motion has three levels, cheapest first

A still frame with drifting particles is not a shot. Between "in the frame" and
"moving" there are three rungs, and most shots need the top one:

| level | field | reads as | use for |
|---|---|---|---|
| drift | `motion.bob` / `dots` | idle shimmer | texture only — never the main subject |
| one-shot | `motion.enter` / `travel` / `sink` | something arrives, crosses, leaves | entrances, exits, a boat crossing |
| **keyframes** | `keys` | **an object acts** | doors opening, a clock's hands, a card being knocked away |

### keys — the element as a performer

```json
{ "kind": "rect", "at": [0.37, 0.5], "size": [0.26, 0.62], "fill": "panel",
  "stroke": "line", "lw": 4, "depth": 0.6,
  "keys": [
    { "at": 0.0, "x": 0.37 },
    { "at": 8.0, "x": 0.37 },
    { "at": 9.2, "x": 0.24, "ease": "inOut" },
    { "at": 17.0, "x": 0.24 },
    { "at": 18.4, "x": 0.37 }
  ] }
```

`at` inside a key is **seconds into the shot**. Every other field is absolute and
optional: `x`, `y` (frame fractions), `s` (scale), `r` (radians), `a` (alpha).
A property not named in a key falls back to the element's resting value, so a
track can animate one thing and leave the rest alone. Two keys that share a
value hold the element still — that is how you write a pause.

`ease` on a key describes the segment that *ends* there: `linear`, `out`,
`inOut`, `back`.

### events — what happens to the frame

Elements say what is in the picture. Events say what it does:

```json
"events": [
  { "at": 0.9, "type": "shake", "amount": 7, "dur": 0.4 },
  { "at": 0.9, "type": "flash", "role": "accentHot", "alpha": 0.22, "dur": 0.5 },
  { "at": 3.2, "type": "ring",  "at2": [0.5, 0.56], "r": 0.28, "dur": 1.1 },
  { "at": 9.2, "type": "sweep", "alpha": 0.3, "dur": 1.1 },
  { "at": 12.0, "type": "burst", "at2": [0.5, 0.56], "n": 22, "reach": 0.2 }
]
```

| type | does |
|---|---|
| `shake` | jolts the whole frame; `amount` in px, decays over `dur` |
| `punch` | scale pop around the frame centre |
| `flash` | additive tint over everything |
| `ring` | expanding stroked circle from `at2` |
| `wipe` | a soft band travelling across, revealing |
| `sweep` | a diagonal light band; the cheapest "camera move" |
| `burst` | dust/sparks radially outward from `at2` |

Times are seconds into the shot. Put a shake on the beat the object is struck,
not on the cut, and never stack two shakes closer than 0.6 s — it reads as a
broken encoder rather than as force.

### round: true

An `ellipse` with `size: [0.2, 0.2]` is an oval, because fractions of a 16:9
canvas are not square. For circles — clock faces, bowls, moons — add
`"round": true` and the box becomes square in pixels.

## Label the frame

A picture of two rectangles closing is not a subway door. A picture of two
rectangles with a station sign, a "mind the gap" line and a clock reading 07:42
is. Text is not decoration — it is how a viewer knows *what they are looking at*
and *when it is happening*.

Rules that keep a frame readable:

- **Every shot carries at least one piece of in-world text**: a sign, a ticket,
  a screen, a label, a timestamp. `check-imagery` fails the shot without one.
- **Put text on a plate** (`"plate": "raised"`, `"plateStroke": "line"`). Text
  over texture is noise; text on a plate is signage.
- **Name things, don't describe them.** 人民广场 / 2号线 · 往徐泾东 / 请勿靠近车门
  — not "a subway". 喜宴 · 十月三日 · 老地方 — not "a card".
- **Two or three labels per shot is right.** One label reads as a sticker on an
  empty frame; six reads as a dashboard.
- **Time stamps place the story**: `07:42 早高峰`, `23:59`, `02:13 · 第 7 杯`.
- A prop on its own has no meaning; a prop **plus its label plus one companion
  prop** does. A cup is a cup; a cup with a "半糖 · 去冰" sleeve, a saucer and a
  timestamp is someone's seventh coffee at 2 a.m.

```json
{ "kind": "text", "at": [0.5, 0.2], "size": 34, "weight": 800, "track": 6,
  "text": "人 民 广 场", "fill": "text",
  "plate": "raised", "plateStroke": "line", "pad": [40, 16], "depth": 0.35 }
```

`track` is letter-spacing in px (signage needs it), `pad` `[x, y]` is the plate's
padding, `leading` overrides line height.

## Frame check

song-mv check-frame --storyboard <file> --features <file> renders three frames
per shot and measures the picture, not the motion:

| column | what it means | want |
|---|---|---|
| subj | how much of the frame the props occupy (union of non-ground elements) | 15-55% |
| 	ones | how many distinct colour masses hold real area | 3-18 |
| p10 | the tenth percentile of luminance | > 30 |
| 
ange | p90 - p10: the tonal range | > 40 |
| grid | which of the nine 3x3 cells contain something | >= 6 |

Every failure names the field to change. A frame can pass check-imagery
(composed) and still fail check-frame (empty or muddy) — they answer different
questions, so run both.

Two lessons the thresholds encode:

- **A prop under about a fifth of the frame reads as a sticker on a wall.**
  Clock faces, cards and cups want 0.25-0.4 of the width.
- **Flat art passes or fails on tonal range, not on edges.** A cream world needs
  something dark in it — a phone face down, a laptop edge, a foreground chair —
  or it reads as an empty page.

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
