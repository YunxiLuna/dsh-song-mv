# generic-field — a storyboard that fits any song

Seven shots, one look (`paper`), six different images, no story-specific props.

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

| shot | time | scene | what it proves |
|---|---|---|---|
| `01_window` | 0–10.5 | `field` / `paper` + `window` | an opening that is a place, not a title card |
| `02_boat` | 10.5–14.5 | `field` / `paper` + `boat` | a motif can carry a whole verse |
| `03_rain` | 14.5–22.5 | `field` / `rain` + `lantern` | the loud section gets weather, not more objects |
| `04_type` | 22.5–30.5 | `typeOnly` / column | one line of type as the picture |
| `05_water` | 30.5–40.5 | `field` / `water` + `boat` | the same motif in a different element |
| `06_ink` | 40.5–44.5 | `field` / `ink` + `chair` | a four-second shot; short shots do not need props |
| `07_outro` | 44.5–54 | `field` / `motes` + `boat` | the ending holds the title instead of cutting |

All the copy comes from `params`. Change the `still`, the `caption`, or the lyrics file and the same
seven shots belong to another song — which is the point: the *look* and the *imagery list* are the
decisions, the scene mechanics are reusable.

The nine scenes in `../nine-shots` are the other end of the dial: props written for one specific song
about an office at 2 AM. Read them as an example of how far a scene can go, not as a template.
