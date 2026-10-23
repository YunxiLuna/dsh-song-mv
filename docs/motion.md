# Motion

A music video is not a slideshow of illustrations. What separates the two is almost never the
drawing — it is what moves, how fast, and whether anything *happens*.

This document is about the machinery that makes shots move. It assumes you have read
[docs/scenes.md](scenes.md) and know what a shot is.

## Three kinds of motion

Every shot in this engine gets all three, and they are not interchangeable.

| kind | what it is | where it comes from |
|---|---|---|
| **camera** | the whole frame travels: push in, pull back, pan, drift | `camera` / `cameraAmount` on the shot |
| **parallax** | layers slide against each other as the camera moves | automatic — read from `ctx.cam.depth(k)` |
| **staging** | subjects enter, cross, react, sink, return | `motif` + `travel` + `stage` + beat events |

A shot with only camera motion reads as a zoom. A shot with only staging reads as a sticker moving on
a still. You want the three stacked.

## Camera

The camera is applied once per shot, around the whole scene, in `engine/core.mjs`. That means **every
scene inherits it, including ones written before this existed** — a new scene gets a camera for free.

```json
{ "id": "03_sink", "start": 43.4, "end": 72.0,
  "camera": "push", "cameraAmount": 0.09, "cameraEase": "inOutQuad",
  "handheld": 1.4, "focus": [960, 620], "loud": true,
  "scene": { "type": "field", "params": { "...": "..." } } }
```

| field | meaning |
|---|---|
| `camera` | `push` `pull` `panL` `panR` `driftUp` `driftDown` `none` |
| `cameraAmount` | how far it travels across the shot: 0.03 is a whisper, 0.15 is a lurch |
| `cameraEase` | `linear` `inQuad` `outCubic` `inOutQuad` `outQuint` — default `inOutQuad` |
| `focus` | `[x, y]` the move centres on; default the frame centre |
| `handheld` | px of shake; 0–1 for quiet songs, 2–3 for the peak |
| `loud` | adds a small punch on downbeats on top of the move |

The camera keeps the frame covered: a `push` scales from 1.0 upward, and the pan/drift moves are
pre-multiplied by a margin so no background edge can enter frame.

**Vary the move.** Two pushes in a row feel like one long push with a mistake in the middle. A
workable pattern for a four-section song: `push` → `panR` → `driftDown` → `pull`.

## Parallax

`ctx.cam.depth(k)` returns the offset for a plane at depth `k`, where `0` is infinitely far and `1` is
the lens. Scenes use it like this:

```js
const back = cam.depth(0.12);   // sky, wash
const mid  = cam.depth(0.45);   // the water, the rain, the folds
const near = cam.depth(1.0);    // foreground specks, faster than everything
```

`field` already draws three planes this way. When you write a scene, drawing everything into one plane
is the single most common reason it looks flat: nothing can slide against anything else.

## Staging: the subject's arc

A motif is one object the viewer follows. Give it a path, and give it a story.

| param | effect |
|---|---|
| `motifAt` | `[x, y, size]` — where it sits at the shot's start |
| `travel` | `[dx, dy]` — how far it crosses the frame over the whole shot |
| `stage` | `enter` (arrive), `drift` (default), `sink` (tilt and go under), `return` (rise back in) |
| `idle` / `idleHz` | slow bob amplitude and rate |
| `events` | arrows/rings on strong onsets (`false` to disable) |

A whole song can be told with one subject and one arc:

```
01  window   no subject        rain on the glass, camera push
02  water     boat  enter       travels 430px right, camera panR
03  water     boat  sink        sinks at 55% of the shot, camera push
04  rain      no subject        the storm; handheld 2.2
05  ink       chair drift       the room after; camera push
06  snow      boat  return      back, smaller, camera pull
```

That is six shots, one boat, and a viewer who knows what happened. Nothing needed a new scene type.

## Beat events

`f` carries the audio analysis. The three useful signals:

- `f.downPulse` — strongest on bar starts. Good for camera punches and light flashes.
- `f.onsetPulse` — per-transient energy. Good for rings, ticks, small kicks.
- `f.beatTime` — the last beat's timestamp, so `decay(tv, f.beatTime, 0.35)` fades a hit correctly.

Use them sparingly. An event on every onset reads as a stutter; an event on every fourth bar reads as
intent.

## Lyric treatments

| `lyricStyle` | reads as | use for |
|---|---|---|
| `kinetic` | words smash in, ghosts behind | verses, punchlines, rhythmic sections |
| `karaoke` | the line fills as it is sung | choruses, long lines, slow songs |
| `plain` | one clean static line | held final cards |

Karaoke is the one to reach for when a line has to sit for four seconds: it moves without asking the
viewer to re-read the frame. Use `lineRate` to match the singing speed (about one character per
0.09–0.16 s).

## Checklist before rendering

Take two stills inside one shot, one second apart, and compare:

- [ ] Did anything other than the lyric change? If not, the shot is dead.
- [ ] Does the camera move in a different direction from the previous shot?
- [ ] Does the subject move across the frame — not just bob in place?
- [ ] Does at least one thing happen in the shot: enter, sink, wash, cut of light?
- [ ] Is the parallax visible? Hold a hand over the foreground specks and see if the frame changes.
