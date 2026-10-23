# Writing a scene for one song: `coffee`

This folder is a worked example of lane 3 in
[`docs/scene-pipeline.md`](../../docs/scene-pipeline.md): a scene that only makes
sense for the song it was written for.

The song compares a hard week to a cup of bitter coffee you sweeten to get
down. Instead of reusing a generic look, the shot is one mug on a counter, and
the lyrics' three events are staged on it:

| lyric | what the scene does |
|---|---|
| 加点糖才能下嘴 | a sugar cube drops in, breaks the surface, dissolves |
| 苦里也能酿出甜 | the spoon goes round; rings spread across the surface |
| 我笑着把它喝完 | `empty: true` — a stained cup, no steam |

A fourth state, `spill: true`, tips the mug over: coffee spreads, sugar cubes
scatter, the spoon is thrown. One prop, two images.

```json
{ "scenes": ["coffee.mjs"],
  "shots": [{ "id": "04_sugar", "start": 36.0, "end": 47.63,
              "scene": { "type": "coffee", "params": { "sugarAt": 2.91 } } }] }
```

`sugarAt` and `stirAt` are seconds **into the shot**, not into the song.

The scene is 250 lines with no imports: primitives arrive on `ctx.lib`, easing on
`ctx.mo`, the camera on `ctx.cam`. To make your own, start from
`song-mv new-scene <name>` and keep the shape.
