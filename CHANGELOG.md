# Changelog

## 0.15.0

- **No more jitter.** handheld defaulted to 1.2 px of *per-frame hash* noise,
  so every frame of every shot was displaced by up to a pixel in a random
  direction. It now defaults to 0 and, when a shot asks for it, the noise is
  smooth interpolated value noise. Measured on a locked-off shot, consecutive
  frames differ by 0.03 luma instead of a visible shift.
- **levels.shoulder / levels.lift**: highlight compression and shadow lift in
  the LUT. A cream set otherwise climbs straight to paper white and every prop
  reads as a cutout.

Notable changes, newest first. The engine is versioned in `package.json`; the
storyboards in the repo are tested against the same version.

## 0.14.0

- **Camera**: `tiltUp`, `tiltDown`, `rollCW`, `rollCCW` and `arc`. Roll and arc
  scale the frame to keep the corners covered.
- **Actors**: `designed` now accepts `actors[]` (the documented name) as well as
  `mid[]`, and flat `{prop, x, y, size}` specs where `size` is a scale.
- **Chair** rebuilt with legs, two rails, slats and a jacket over the back. A
  prop with no silhouette reads as a ladder.
- **Gates**: night shots (`dawn`/`fade` palettes) are allowed to crush their
  shadows; tone counting is quantised to 3 bits so grain is not counted as
  colour.

## 0.13.0

- **Post finally reaches the canvas.** `Post2D.apply` used to composite the
  scratch canvas into itself, so vignette, scan, grain and levels were invisible.
- **Levels** (`black`, `white`, `gamma`, `sat`, `warm`) per look, via a 256-entry
  LUT. This is what puts a black into a cream world.
- **Grain** blits a prepared noise plate instead of filling with a
  `createPattern`: a pattern plus an `overlay` composite returns raw noise from
  the second frame onwards in node-canvas.

## 0.12.0

- **`t0Offset`** on a shot: element timing continues from the block the shot
  belongs to, so cutting a long shot into three does not replay every entrance.

## 0.11.0

- **Materials** (`paper`, `grain`, `metal`, `glass`, `water`, `fabric`, `wood`)
  and **per-shot key light**. Materials only ever darken and highlight; adding
  white over a pale world just milks it out.
- **Palette ladder** fixed for the `cafe` look: `raised` had been lighter than
  `bg`, which flattened every frame.

## 0.10.0

- **Depth of field** per element, bucketed by blur radius so text stays crisp.
- **Inserts**: a cut to a detail inside a long shot, 0.06 s edges.

## 0.9.0

- **`check-frame`**: subject coverage, colour masses, luma percentiles, tonal
  range and 3x3 occupancy, each failure naming the field to change.
- **`shadow` palette role**, always darker than the ground, because `text`
  flips light/dark between looks.

## 0.8.0

- **In-world text is a requirement**: every shot needs at least one labelled
  object, and text over texture needs a plate.
