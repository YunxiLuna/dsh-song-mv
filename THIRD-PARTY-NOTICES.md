# What this repo does *not* contain

`dsh-song-mv` ships source code only. It contains **no music, no lyrics, no fonts, and no
ffmpeg binaries**. Everything time-critical is generated at run time from files the user supplies.

Run `npm install` and the dependencies below land on the user's machine — distribution in that
case is performed by npm, not by this repository. The obligations listed here are the ones that
become *yours* if you redistribute a packaged artifact (a zip, a Docker image, a single-file
binary) that embeds these dependencies.

## Runtime dependencies

| Component | Licence | Distributed by this repo? | Notes |
|---|---|---|---|
| `canvas` (npm) | MIT | No — `npm install` only | Node bindings for Cairo |
| Cairo (inside canvas' prebuilt `.node`) | **LGPL-2.1 or MPL-1.1** | No | If you ship a binary that embeds `canvas.node`, LGPL-2.1 §6 applies: provide Cairo's source and a way to relink. Choosing Cairo under MPL-1.1 avoids the relink obligation. |
| Pango (only in canvas v3) | **LGPL-2.1-or-later** | No | No MPL alternative; another reason to prefer not redistributing binaries. |
| pixman, freetype, libpng, libjpeg-turbo, giflib, harfbuzz, SheenBidi, lunasvg, zlib | MIT / FTL-or-GPLv2 / libpng-2.0 / IJG+BSD-3+zlib / MIT / MIT / Apache-2.0 / MIT / zlib | No | Reproduce their notices if you ship a binary. SheenBidi is Apache-2.0 and has a `NOTICE`; carry it forward if you redistribute. |

## External programs (not dependencies of this package)

| Program | Licence | Why there is no obligation |
|---|---|---|
| `ffmpeg` | LGPL-2.1+ or GPL-2.0+ depending on build flags | The tool shells out to `ffmpeg` as a **separate process** over pipes and command-line arguments. That is mere aggregation, not linking, and the user installs ffmpeg themselves. Never bundle it, never link against libav*, never auto-download it "for" the user. |

## Fonts

No font files are included. Scenes reference fonts **by family name** (`Inter`, `Microsoft YaHei`,
`Noto Sans CJK`, …) and fall back to whatever the operating system provides. Naming a font is not
distribution. If you later bundle a font, it must be OFL-1.1 (or similar) and you must ship its
licence text plus its copyright line, and must not use a Reserved Font Name for a modified version.

## Assets you supply

Audio files, `.lrc` lyrics and rendered videos are **yours**, and are gitignored here:

```
demo-input/
*.mp3  *.flac  *.wav  *.m4a  *.aac
*.lrc
out/
```

Lyrics are a literary work and recordings carry neighbouring rights. Do not commit scraped `.lrc`
files or rendered videos containing commercial music. The `examples/` directory ships
*storyboards only* — no song, no lyric text from any published work.
