# synthetic demo

A 54-second demo that uses **all nine scenes once**, with content that belongs to
nobody: the audio is synthesised by ffmpeg, the lyrics were written for this
directory, and the storyboard is the source of truth for every word on screen.

Nothing here is copyrighted, so this directory is safe to commit — and that is
the point. Real songs, real `.lrc` files and real rendered videos do not belong
in a public repo.

## Regenerate the audio

The bed is a 120 BPM kick plus a slow pad and a little noise, generated in one
command. No binary is committed.

```bash
ffmpeg -y -f lavfi -i "aevalsrc='0.55*exp(-18*mod(t\,0.5))*sin(2*PI*58*t) + 0.16*sin(2*PI*220*t)*(0.5+0.5*sin(2*PI*0.2*t)) + 0.04*(random(0)*2-1)':d=54:s=44100:c=mono" \
  -c:a pcm_s16le song.wav
```

## Run it

```bash
cd examples/synthetic-demo
song-mv analyze song.wav --bpm 120 --out features.json   # --bpm matters, see below
song-mv render  --storyboard storyboard.json --features features.json \
                --audio song.wav --out out/demo.mp4
```

`features.json` is committed so the demo renders without regenerating the audio,
but the audio must exist on disk for `--audio`.

**Why `--bpm 120`?** The kick is unambiguously at 120 BPM to a listener, and the
energy-voting tempo detector still prefers 60 — it hears the same periodicity an
octave down, which is a genuinely ambiguous question for an algorithm. This
directory is the reason `analyze` has a `--bpm` flag: the detector proposes, you
decide.

## What each shot proves

| shot | scene | shows |
|---|---|---|
| 0–5 s | `keyboard` | a single prop can carry five seconds |
| 5–11 s | `desk` | `inboxRows` + `cards` params drive all the copy |
| 11–18 s | `stampScene` | slides get a layout automatically; only titles are content |
| 18–25 s | `emptyScene` | negative space after density |
| 25–32 s | `call110` | `hitLine` switches a lyric from kinetic to stamped |
| 32–38 s | `erase` | a wipe that leaves a trail |
| 38–44 s | `voidScene` | the drop, then the title card resolves into credits |
| 44–48 s | `kitchenScene` | palette `dawn`, no camera punch |
| 48–54 s | `logout` | the cursor chooses cancel |

The rendered result lives in `docs/demo/demo.webm`.
