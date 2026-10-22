# Scene catalogue

Nine scenes ship with the engine. Each is an `export function` in
`engine/scenes.mjs` with the signature:

```js
scene(ctx, tv, f, P)   // tv = seconds, f = reactive features, P = shot.scene.params
```

Every scene reads its colours from `ctx.pal` and its lyrics from
`lyricsOf(ctx).activeAt(tv)`, so it re-colours and re-times for free. Defaults
below are the neutral English fallbacks; the demo overrides them in Chinese via
`examples/nine-shots/storyboard.json`.

---

## `keyboard` — the DELETE key, alone

A giant key on a dim desk plane, with an ambient clock and a place label. Use
for the intro: nothing has happened yet.

```jsonc
{ "type": "keyboard", "params": {
  "keyLabel": "delete",          // text on the key cap
  "clock": "02:47  AM",          // top-right clock readout
  "place": "office // floor 23"  // small location label
}}
```

---

## `desk` — inbox avalanche

A monitor showing an inbox, with notification cards piling up in front of it.
Each row is `[sender, subject, time]`.

```jsonc
{ "type": "desk", "params": {
  "inboxTitle": "inbox",
  "inboxCount": 47,
  "inboxRows": [
    ["HR", "@all weekly report due 18:00", "02:31"],
    ["Client A", "requirement change v7 (urgent)", "02:19"],
    ["PM", "review tomorrow 9 AM", "01:58"],
    ["Finance", "expense rejected: no receipt", "01:40"],
    ["System", "you have 47 unread messages", "01:22"],
    ["Boss", "you there?", "00:47"],
    ["Coworker", "can I get this today", "00:12"]
  ]
}}
```

Use 5–8 rows. The scene reveals them in sequence, so the list is also the
reveal order. `cards` defaults to a neutral English set of eight; `hot: true`
draws the red priority dot.

---

## `stampScene` — slides, and a rubber stamp

Presentation slides floating over a city of lit windows, each one slammed with a
stamp. Use it for the beat where the slide deck is the villain.

```jsonc
{ "type": "stampScene", "params": {
  "stampText": "DELETED",
  "slides": [
    { "title": "Q3 strategy review", "bullets": 5 },
    { "title": "Roadmap v3", "bullets": 4 },
    { "title": "KPI completion 12%", "bullets": 6 }
  ]
}}
```

A slide is `{ title, bullets }`; `bullets` is how many fake text lines to draw.
Positioning is automatic (`x`, `y`, `w`, `h`, `rot` override the slot if you
need a different layout).

The first and third slide get stamped — at `start + 1.5` and `start + 3.1` —
because two stamps read as a rhythm while three read as wallpaper.

---

## `emptyScene` — the office after everyone leaves

Desks, chairs, sticky notes, a plant, a stopped clock, a dead monitor. Mostly
negative space — this is the scene that lets a quiet lyric breathe.

```jsonc
{ "type": "emptyScene", "params": {} }
```

---

## `call110` — the phone call

A phone UI: dialling, then connected, with a chat bubble exchange, a comment
card pinned to the left, and a scrolling comment ticker along the bottom.

```jsonc
{ "type": "call110", "params": {
  "hitLine": "delete",     // regex: a lyric line matching this gets stamped
  "number": "110",
  "caller": "worker",
  "dialing": "calling…",
  "connectedLabel": "connected",
  "hangUp": "hang up",
  "reply": "110 emergency line. Go ahead.",
  "callDelay": 0.5,        // seconds into the shot before the call starts
  "connectAfter": 3.7,     // seconds of dialling before it connects
  "noteKicker": "night shift",
  "noteTitle": "going lightly, going crazy",
  "noteSource": "— top comment",
  "tickerLabel": "comments",
  "tickerText": "no overtime · no more meetings · out of office"
}}
```

`hitLine`, `popLine` and `busyLine` are regex sources tested against the active
lyric line, so the *engine* never knows which words are special — you decide per
song. A line matching `hitLine` (say `"delete"`) is stamped at the top right
instead of being animated word by word; `popLine` gets the per-word pop; anything
else falls through to the kinetic treatment at `y=120`, above the phone. This is the one scene that deliberately mixes UI, text and
lyrics — keep the copy short or it collides.

---

## `erase` — the eraser over a floor plan

A grid of rooms is wiped away left to right by a cursor, leaving stamps and
debris behind. Use for "forget about me".

```jsonc
{ "type": "erase", "params": {} }
```

The wipe sweeps left to right over the first 17 s of the shot; the lyric sits
low at `y=890` so the cursor never crosses it.

---

## `voidScene` — the drop

A black hole in a wall of the word DELETE, a radial spectrum, particles, then an
album window that resolves into the title card and credits.

```jsonc
{ "type": "voidScene", "params": {
  "albumAt": 14.3,                       // seconds into the shot when the cover arrives
  "albumTitle": "Album Title",
  "albumSubtitle": "Artist · Track",
  "stampLine": "delete",                 // lyrics matching this get the giant stamp
  "splitLine": "out|leave|gone"          // ...and these get the RGB split
}}
```

---

## `kitchenScene` — 2 AM, something warm

A pot on a lit counter, steam, a bowl of noodles, a moon in the window, and one
line of dialogue. This is the emotional landing; use it at low energy.

```jsonc
{ "type": "kitchenScene", "params": {
  "punchline": "some things cannot be deleted."
}}
```

---

## `logout` — the system dialog

A modal asking the question the song has been building to, with a cursor gliding
toward a button, then a fade and an end card.

```jsonc
{ "type": "logout", "params": {
  "question": ["if this dull life is a game,", "would you press quit?"],
  "cancelLabel": "cancel",
  "quitLabel": "quit",
  "endText": "the end"
}}
```

The cursor glides to the **cancel** button at (830, 614) and clicks; the click
ring lands at `start + 3.4`, the fade begins at `end - 2.1` and the end card
appears at `end - 1.6`. Everything is relative to `P.start` / `P.end`, so the
scene works at any length — but pass `end`, or it assumes a 6 s shot.

---

## Writing a new scene

```js
export function myScene(ctx, tv, f, P = { start: 0 }) {
  const t0 = tv - P.start;      // time since the shot began
  const p = ctx.pal, g = ctx.g;
  ctx.clear();                  // fill with palette background

  // … draw with g (canvas 2D). Colours from p only.

  const { cur, age } = lyricsOf(ctx).activeAt(tv);
  if (cur) { /* draw the lyric however you like */ }
}
```

Then add it to the `SCENES` registry at the bottom of the file and reference it
from a storyboard with `"type": "myScene"`.

Two rules keep this repo coherent:

1. **Read `ctx.pal`, never a raw hex colour** — otherwise a palette change
   breaks your scene.
2. **Put every user-visible string in `P`** — the engine must not contain the
   content of any particular song.
