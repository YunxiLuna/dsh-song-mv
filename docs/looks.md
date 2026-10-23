# Looks — the colour world of a video

A **look** decides every colour in the film. It is not a theme for one shot: it is the world the
whole video lives in. Switching looks mid-song is possible but rare — usually a film has one.

```json
{ "look": "paper", "shots": [ … ] }
```

If `look` is missing, `night-shift` is used. Pick deliberately: a breakup ballad rendered in
`night-shift` looks like a product demo.

## The seven that ship

| id | world | grain / scan | reach for it when |
|---|---|---|---|
| `paper` | warm off-white, sepia ink, fold creases | grain 0.022, no scan | memory, letters, tenderness, acoustic, nostalgia |
| `rain` | wet blue-grey, cold diffuse light | grain 0.02, light scan | grief, distance, city at night, regret |
| `daylight` | bright neutral, clean air, high key | grain 0.012, no scan | hope, morning, release, outdoor, major key |
| `ember` | deep red-brown, low light, warm core | grain 0.03 | anger, heat, obsession, slow burn |
| `mono` | black and white, no hue at all | grain 0.035 | archive, documentary, grief held still |
| `night-shift` | dark blue neon, screens, scanlines | grain 0.025, scan 0.022 | electronic, late-night work, irony, dread |
| `cafe` | cream walls, morning light, coffee and caramel | grain 0.022, no scan | ordinary days told warmly, food, small comforts, humour without cruelty |

Each look is authored as **four** palettes — `calm`, `mid`, `hot`, `dawn` — and the eight emotional
states are interpolated from them:

```
still   = calm
tender  = blend(calm, mid, 0.5)
build   = blend(calm, mid, 0.8)
release = mid
intense = blend(mid, hot, 0.65)
peak    = hot
dawn    = dawn
fade    = blend(calm, black, 0.55)
```

That is why a storyboard only ever names states: `still`, `tender`, `build`, `release`, `intense`,
`peak`, `dawn`, `fade`. The look decides what those words mean in colour.

## What a palette holds

Every palette is one row of twelve values, in this order:

| index | name | used for |
|---|---|---|
| 0 | `bg` | the frame's base |
| 1 | `panel` | big surfaces behind content |
| 2 | `raised` | cards, paper, objects in front |
| 3 | `line` | hairlines, creases, outlines |
| 4 | `text` | primary type |
| 5 | `sub` | secondary type, captions |
| 6 | `mute` | tertiary type, ghost text, stills |
| 7 | `accent` | the film's one colour |
| 8 | `accentHot` | the accent at its loudest |
| 9 | `accentDim` | accent at rest |
| 10 | `glow` | light, halos, bloom |
| 11 | `sat` | saturation multiplier for post |

Scenes read `ctx.pal` and never hardcode a colour. If you find yourself typing `#` inside a scene,
the value belongs in the look.

## Post settings

Each look also carries `scan`, `grain` and `vignette`:

- `scan` — horizontal CRT lines, 0 disables. Anywhere above ~0.03 is a stylistic statement.
- `grain` — noise, multiplied into the frame with `overlay`. Light worlds want less.
- `vignette` — `{ color, alpha }`. A black vignette wrecks a paper world; light looks use a warm or
  blue-grey tint instead, and `mono` keeps black.

A storyboard can override any of them per video:

```json
{ "look": "paper", "post": { "scan": 0, "grain": 0.03, "vignette": { "color": "#8a7a63", "alpha": 0.18 } } }
```

## Writing a new look

Add a `makeLook({...})` call to `LOOKS` in `engine/looks.mjs`:

```js
makeLook({
  id: 'dusk',
  label: 'Dusk — mauve sky, warm windows',
  when: 'evening, something ending without drama',
  calm:  row('#2a2233', '#332a3d', '#3d3348', '#54465f', '#e8dcea', '#b9a8c0', '#7d6f88', '#c98aa4', '#f0b6c4', '#8a6172', '#f0b6c4', 0.9),
  mid:   row('#332735', '#3e2f42', '#4a3a4e', '#5f4a63', '#f2e3f0', '#c4b0c8', '#8a7a92', '#d295aa', '#ffc6d2', '#94697a', '#ffc6d2', 1.0),
  hot:   row('#3d2530', '#49303c', '#57404a', '#6d5260', '#ffeeF2', '#d0b4bd', '#97818c', '#e07f9c', '#ffb0bd', '#a3627a', '#ffb0bd', 1.1),
  dawn:  row('#2b2434', '#352d3f', '#41384a', '#574c60', '#eaddE6', '#bdaec4', '#82748c', '#a98bb4', '#d3b6de', '#7d6389', '#d3b6de', 0.85),
  scan: 0.008,
  grain: 0.024,
  vignette: { color: '#241d2b', alpha: 0.26 },
})
```

`row()` takes the twelve values above in order. Then export it in `LOOK_IDS` (the map is already
built from `LOOKS`, so registering the entry is enough) and run:

```bash
song-mv preview --storyboard storyboard.json --features data/features.json --times 10,40,70 --out out/look-test
```

Look at one dark shot and one bright shot. A look usually fails on the type: if `text` and `bg` are
too close, every lyric will feel like a watermark.

## Two rules worth keeping

1. **One look per film.** Changing worlds reads as a mistake unless the song has a hard turn.
2. **`accent` is one colour.** A video with four accent colours has none. If the song needs a second
   accent for one moment, blend toward `accentHot` for that shot instead.
