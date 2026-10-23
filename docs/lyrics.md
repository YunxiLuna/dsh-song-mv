# Lyrics: the timestamps are the hard part

Lyrics are the most common source of a video that "feels off". Almost never is
it the typography — it is the `.lrc`.

## Which file to use

Prefer a **word-timed** file:

```
[00:37.67]<00:37.67>把名字从手机里 <00:39.79>悄悄删掉了
```

The leading tag is when the line starts; the inline `<...>` marks are when each
fragment is sung. The engine uses the marks to drive the karaoke fill, so the
highlight follows the voice instead of a constant reading speed.

A **plain** file is fine too:

```
[00:37.67]把名字从手机里 悄悄删掉了
```

Then the fill falls back to `lineRate` seconds per character. Set `lineRate` to
roughly `line duration / character count` for the song; 0.11 s/char suits slow
Mandarin ballads, 0.07 s/char fits fast pop.

## The `.std.lrc` trap

Streaming exports often ship two files: `song.lrc` (word-timed) and
`song.std.lrc` ("standard"). The `.std` variant is **derived**, and some
exporters stamp each line with its **last** word mark instead of its first.

The damage is not a constant offset you could nudge away — every line arrives
late by a different amount, so short lines look fine and long lines are seconds
behind:

```
line                 word-timed   .std    lag
把名字从手机里 悄悄删掉了   37.67    43.42   +5.75 s
聊天记录停在最底下          28.61    29.85   +1.24 s
座位号隔着两排 空着右边      23.07    24.38   +1.31 s
```

`check-lyrics` detects exactly this by comparing the two files:

```
$ song-mv check-lyrics song.std.lrc
vs song.lrc: 49 matching lines, 49 stamped late, median lag 1.96s
PROBLEM: this file looks derived from song.lrc using each line's LAST word mark
```

## Check before rendering

```bash
song-mv check-lyrics lyrics.lrc --duration 200.9
```

It prints every line with its start time and the gap to the next one, and fails
on: timestamps that do not advance, lines that start after the audio ends, and
the `.std` end-stamping above.

Read the gap column. A lyric line is on screen from its own start until the next
line starts, so:

- gaps under ~0.6 s are too fast to read on a long line;
- gaps over ~10 s mean the line sits unchanged for most of a section — that is a
  spacing problem in the source, not a rendering problem;
- an instrumental break shows up as a gap; nothing appears on screen there, by
  design.

## Offset

`[offset:+500]` shifts every timestamp by the LRC spec (positive = earlier).
The parser applies it, and `check-lyrics` prints it when present. If the whole
file is uniformly late, prefer fixing the offset tag over editing 60 timestamps.

## What the engine does with a line

A line is drawn from its start until eight seconds later (or until the next line
takes over, whichever comes first), so `still` text and the closing card can
breathe without leaving the previous line pinned on screen forever.
