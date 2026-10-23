# generic-field — a storyboard that fits any song

Seven shots, one look (`paper`), six different images, no story-specific props — and a camera move
and an event in every shot.

```bash
node tools/plan.mjs --features ../synthetic-demo/features.json --look paper --shots 7 \
  --out storyboard.json            # this file started as that draft, then was edited
node tools/preview.mjs --storyboard storyboard.json \
  --features ../synthetic-demo/features.json --out out/preview
node tools/render.mjs --storyboard storyboard.json \
  --features ../synthetic-demo/features.json --audio ../synthetic-demo/song.wav --out out/mv.mp4
```

It reuses the shipped synthetic demo's audio, lyrics and feature file, so the commands above work
from a clean checkout.

| shot | time | camera | scene | what moves |
|---|---|---|---|---|
| `01_window` | 0–10.5 | `push` 0.05 | `field` / `paper` + `window` | opening that is a place, not a title card; slow push |
| `02_boat` | 10.5–14.5 | `panR` 0.05 | `field` / `paper` + `boat` | boat enters from the left, travels 260px |
| `03_rain` | 14.5–22.5 | `push` 0.10 | `field` / `rain` + `lantern` | three rain depths; handheld 2.2 |
| `04_type` | 22.5–30.5 | `panL` 0.04 | `typeOnly` / column | a lateral drift under a static line |
| `05_water` | 30.5–40.5 | `driftDown` 0.05 | `field` / `water` + `boat` | boat crosses 520px, then **sinks** at 62% |
| `06_ink` | 40.5–44.5 | `push` 0.12 | `field` / `ink` + `chair` | the stain spreads while the camera closes in |
| `07_outro` | 44.5–54 | `pull` 0.06 | `field` / `motes` + `boat` | the boat **returns**, smaller; the frame opens up |

Two things worth copying from this file:

1. **No shot repeats the previous camera move.** Push → pan → push → pan → drift → push → pull. Two
   moves in a row in the same direction reads as one long move with a mistake in the middle.
2. **The boat has an arc.** It enters, crosses, sinks, and comes back. One subject, four strings
   (`stage`), and the seven shots are a story instead of a slideshow.

All the copy comes from `params`. Change the `still`, the `caption`, or the lyrics file and the same
seven shots belong to another song — which is the point: the *look*, the *cast* and the *motion plan*
are the decisions, the scene mechanics are reusable.

The nine scenes in `../nine-shots` are the other end of the dial: props written for one specific song
about an office at 2 AM. Read them as an example of how far a scene can go, not as a template.
