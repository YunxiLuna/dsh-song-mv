# song-mv — turn a song into a code-rendered music video

Use this when the user wants a **music video, lyric video or MV** rendered from
an audio file, or wants an existing one changed.

Every frame is drawn in code (node-canvas) as a pure function of song time, then
piped to ffmpeg. No timeline editor, no stock footage.

**Read `docs/GUIDE.md` once at the start.** It is the whole brief: the four
decisions, the three gates, the fix table. This file is only the running order.

## Before you start

- The audio (`.mp3` / `.flac` / `.wav` — anything ffmpeg reads).
- A `.lrc` **if the song has lyrics**. Ask the user for it; do not scrape lyrics
  from a streaming service, and never commit them to a repo.
- If the folder holds both `song.lrc` and `song.std.lrc`, prefer the plain one:
  `.std` is usually derived by stamping each line with its last word, which runs
  seconds late.

## 1. Analyse

```bash
song-mv new work/ --audio "song.flac" --look <id>
```

Copies the audio, analyses it, copies a sibling `.lrc`, and writes a
`storyboard.json` that already passes `doctor`, plus `work/notes.md` with the
three decisions. Without `new`: `song-mv analyze` then `song-mv plan`.

## 2. Check the lyrics

```bash
song-mv check-lyrics work/lyrics.lrc --duration <seconds>
```

If it reports lines stamped later than a word-timed sibling, switch to the
enhanced `.lrc`.

## 3. Decide, in writing

Answer in one sentence each, at the top of `work/notes.md`:

1. **Look** — which of the seven worlds does this song live in?
2. **Cast** — what one thing carries it, and how is it changed by the end?
3. **Motion** — per shot: camera move, what moves, what happens.

If you cannot name the event in a shot, that shot is not ready.

## 4. Write the shots

Three shots per section, 8–14 s each, at different distances. Prefer the built-in
lanes: `field` (landscape, weather, one drifting object), `designed` (a room or
object built from elements), `typeOnly` (the lyric is the picture). Write a scene
file only when none fits — `song-mv new-scene <name>`.

Label the world: at least one sign, ticket or timestamp per shot.

## 5. Validate before rendering

```bash
song-mv doctor        --storyboard work/storyboard.json   # milliseconds
song-mv preview       --storyboard work/storyboard.json   # stills
song-mv check-imagery --storyboard work/storyboard.json
song-mv check-frame   --storyboard work/storyboard.json --features work/features.json
song-mv check-motion  --storyboard work/storyboard.json --features work/features.json
song-mv sheet         --storyboard work/storyboard.json
```

Each finding names the field to change. Fix the JSON, never patch the tools. Do
not start a render until all three gates pass — a render costs 10–25 minutes.

## 6. Render, then check what you made

```bash
song-mv render --storyboard work/storyboard.json --audio work/song.flac --out work/mv.mp4
song-mv qa --file work/mv.mp4 --storyboard work/storyboard.json
```

`qa` reports brightness, flashes and cuts. A cut within 1.2 s of a shot start is
expected; anything else is a defect.

## Not negotiable

- The nine office scenes (`keyboard`, `desk`, `stampScene`, `erase`, …) are one
  song's props, not a template. Do not reach for them on a new song.
- Never copy another song's shot list, and do not repeat one motif across more
  than a third of the film — `check-imagery` measures this.
- A film may be dark, but not dark from the first shot to the last.
- Lyrics are timing, not text: check them before designing anything.
