# Art direction for a song you have never heard

The engine can draw anything. This is the part that decides *what* to draw, and
it is the part an agent gets wrong: given a new song it will reach for whichever
storyboard it saw last. The rules below are what separate a film from a slide
deck, written so they can be applied without taste.

## 1. Start from the object, not the mood

A mood ("melancholy") produces a colour and nothing to look at. An object
produces a shot. Read the lyric and write down **things**, not feelings:

> 泡面加蛋算早餐 / 房租涨了心也宽 / 地铁关门挤了八遍

gives a mug, a rent notice, a train door. Three props, three shots. Feelings
come from how those objects are lit and how they move; they are an output, never
an input.

Pick 5–8 objects for a three-minute song. More than that and no one remembers
any of them; fewer and the film repeats.

## 2. One world, one ladder

Every frame needs four tones and they must be far apart: a ground (the wall, the
sky), a mass (the prop), a recess (a shadow, an opening), and a line (an edge, a
typeface). Write them down as hex values before drawing anything. If two of them
are within about 8% of each other in luminance, the frame will read as flat and
no amount of grain will save it.

The palette in `engine/looks.mjs` is exactly this ladder — do not invent colours
shot by shot. If a song needs a world the six looks do not have, add a look, or
write one scene by hand (`song-mv new-scene`).

## 3. Light from one side, always

Choose a key light direction for the whole film (e.g. upper left, `[0.22, 0.18]`)
and never change it. Every prop is shaded against it, the frame gets one
vignette in the same direction. A cut between two shots lit from opposite sides
reads as two different films intercut.

Practically: `keyLight: { from: [0.22, 0.18], strength: 0.5 }` on every shot, and
let the *palette* change between sections, not the light direction.

## 4. Three planes or it is a poster

Back (a wall, a sky, a window), middle (the prop), near (something out of focus:
a chair back, a doorway, a shoulder). Even 5% of near-plane silhouette at the
bottom of the frame changes the reading from "graphic" to "photographed".

## 5. Label it, or nobody knows what it is

Two rectangles closing are not a train door. Two rectangles closing **with a
station sign, a mind-the-gap stripe and a 07:42 timestamp** are. Every shot
carries at least one piece of in-world text, and text sits on a plate.

Name things precisely: `人民广场 / 2号线 · 往徐泾东 / 请勿靠近车门`, not "a subway".

## 6. Cut before you decorate

A 20-second shot of one object is a still. Split each section into 2–3 shots:
wide (establish), detail (the insert), tight (the reaction). Keep the props'
timing continuous with `t0Offset`, otherwise every cut looks like a restart.

Target 6–10 seconds per shot. Under 3 seconds the eye cannot read a new frame;
over 12 seconds it stops looking.

## 7. Give every shot one event

Something must *happen*: an object enters, a light changes, a hand arrives, a
thing falls, a page turns. The event is not the camera move — a push on a static
frame is still static. If you cannot name the event in one sentence, the shot is
not written yet.

## 8. Let silence be quiet

Not every shot needs motion. A held frame with a lyric and one slowly moving
element is a legitimate beat — but then the *cut* has to carry the rhythm, so the
following shot must arrive hard.

## 9. Check the picture, not the intention

Three gates, run in this order, each one cheaper than a re-render:

```bash
node tools/check-imagery.mjs --storyboard film.json   # is it composed?
node tools/check-frame.mjs   --storyboard film.json --features f.json  # is it a picture?
node tools/check-motion.mjs  --storyboard film.json --features f.json  # does it move?
```

They answer different questions: composition, exposure, motion. A shot can pass
one and fail the others, and each failure message names the field to change.

## 10. What has actually gone wrong, so far

- **Props with no silhouette** (two legs and a rail called a chair) read as
  abstract marks. If a shape is not recognisable at 20% of the frame, redraw it.
- **Highlights climbing to paper white** flatten a bright set: every prop turns
  into a cutout. Compress the top of the curve (`levels.shoulder`).
- **Additive light over a pale world** milks it out. Light with `multiply`.
- **Per-frame random sway** reads as a rendering fault. If a shot wants a hand,
  ask for `handheld` explicitly.
- **Reusing last film's props** is the failure this document exists to prevent.
  A storyboard that could belong to another song is the wrong storyboard.
