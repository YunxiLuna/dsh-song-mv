# Writing a scene

When the song needs an image the engine does not have, write it. A scene is a function of
`(ctx, tv, f, P)` — the context, the song time, the audio features for that frame, and the shot's
params — and it returns nothing. It draws.

The reason this is cheap is `engine/primitive_fx.mjs`: grain, fold creases, water, rain, drifting
motes, ink wash, threads, light shafts, and a handful of motifs (paper boat, lit window, moon,
lantern, empty chair, birds). A scene is usually three primitives and one motif.

## The contract

```js
export function windowRain(ctx, tv, f, P = { start: 0 }) {
  const p = ctx.pal;       // the palette for the current emotional state
  const g = ctx.g;         // the 2D context, 1920x1080
  ctx.clear();             // fill with p.bg

  const t0 = tv - P.start; // seconds since this shot began
  …
}
```

Rules that are not negotiable:

- **Pure function of time.** No state on the module, no `ctx.previous`. Frames are rendered out of
  order; a stored value produces a video that flickers differently on every render.
- **Colours come from `p`.** Never write a hex value in a scene. If the value is not in the palette,
  it belongs in the look.
- **Read the lyrics through the context**, not from a closure: `lyricsOf(ctx).activeAt(tv)` returns
  `{ cur, prev, lineAge }`.
- **Keep the lyric clear.** Decide where the line lands and do not put a motif there. The bottom
  120 px is where most shots put it.

## A worked example: rain on a window

```js
import { grainField, rainField, litWindow, moonDisc, driftMotes } from './primitive_fx.mjs';
import { kinetic } from './story_fx.mjs';

export function windowRain(ctx, tv, f, P = { start: 0 }) {
  const p = ctx.pal, g = ctx.g;
  ctx.clear();

  const t0 = tv - P.start;
  const [wx, wy, ws] = P.windowAt ?? [560, 210, 520];

  grainField(g, p, tv, f, { alpha: 0.16 });

  // the room side of the glass
  litWindow(g, p, wx, wy, ws, ws * 0.78, { warm: false });

  // rain on the far side, denser as the section gets louder
  const density = 90 + Math.round((f.rmsEnv ?? 0) * 160);
  g.save();
  g.beginPath();
  g.rect(wx + 4, wy + 4, ws - 8, ws * 0.78 - 8);
  g.clip();
  rainField(g, p, tv, f, { density, alpha: 0.4 });
  g.restore();

  // one thing outside, seen through it
  if (P.moon) moonDisc(g, p, wx + ws * 0.72, wy + ws * 0.26, ws * 0.1, { phase: 0.5 });

  driftMotes(g, p, tv, f, { n: 40, alpha: 0.3 });

  const { cur } = lyricsOf(ctx).activeAt(tv);
  if (cur && tv - cur.t < 8) {
    kinetic(g, cur.text, P.lyricX ?? 960, P.lyricY ?? 900, tv, cur.t, {
      size: P.lyricSize ?? 88, color: p.text, hot: p.accentHot, ghost: p.accent,
    });
  }
}
```

Register it next to the others in `engine/scenes.mjs`:

```js
export const SCENES = {
  field, typeOnly, windowRain,   // …
  keyboard, desk, /* …the office pack… */
};
```

Use it:

```json
{
  "type": "windowRain",
  "params": { "windowAt": [560, 210, 520], "moon": true, "lyricY": 900 }
}
```

Then check it at three moments — the first frame, once it is at rest, and the loudest beat in the
shot — before rendering the whole film:

```bash
song-mv preview --storyboard storyboard.json --features data/features.json \
                --times 12,18,24 --out out/scene-test
```

## What to check on the stills

1. **Is anything unreadable?** Type over a busy texture, a motif behind the lyric, a palette where
   `sub` and `bg` are four values apart.
2. **Does the frame survive being paused?** Motion hides a lot; a still does not.
3. **Is it this song?** If the same frame could sit in a different video, the motif is decoration
   rather than meaning.

## Params, not copies

Resist writing a scene per lyric line. `field` with a different `layer` and `motif` covers a lot of
ground, and params let the storyboard make the film-specific decisions. Write a new scene when the
*image itself* is new — a gutter, a platform, a screen of chat messages — not when only the colours
changed.
