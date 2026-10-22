# Publishing this repo

Everything below assumes you are in the repository root. Nothing here has been
done for you — the repo is ready to publish, not published.

## 1. Before the first commit

The `.gitignore` already blocks audio, lyrics, fonts, rendered output and
`node_modules`. Verify nothing slipped in:

```bash
git init
git add -A
git status --short
```

If you see a `.mp3` / `.flac` / `.lrc` / `.ttf` / `.mp4` in that list, stop and
fix `.gitignore` — committing one is the single most common way a project like
this acquires a problem.

Check the size of what you are about to commit:

```bash
git ls-files -s | wc -l          # 40-ish files
du -sh .git                      # should be a few MB, not hundreds
```

`docs/demo/demo.webm` (~4.7 MB) is the only heavy file, and it is deliberately
synthetic — see `examples/synthetic-demo/README.md`.

## 1b. Content audit — no borrowed words

The engine must not contain a single lyric line. Every word that appears on
screen has to arrive through a storyboard `params` value, because a string in
`engine/` is a string in an MIT repo, while a string in your local storyboard is
just your working file.

Before pushing, search for the song's distinctive fragments:

```bash
grep -rn --include='*.mjs' --include='*.json' --include='*.md' \
  -e 'some line from the song' -e 'another line' . | grep -v node_modules
```

Expected output: nothing outside your own ignored `demo-input/`. If the hits are
in `examples/`, replace them with placeholder copy — the storyboard is supposed
to describe *shot structure*, not to transcribe anyone's lyrics. Also check that
regex defaults in the engine are neutral (`"delete"`, not an actual hook line).

## 2. License and attribution

- `LICENSE` — MIT, year and holder already filled in.
- `package.json` — `"license": "MIT"` matches.
- `THIRD-PARTY-NOTICES.md` — the obligations that apply **only if you ship a
  binary** (a zip or image that embeds `node_modules`). Publishing source on
  GitHub triggers none of them.

You do **not** need to add a license header to every file. You do need to keep
`THIRD-PARTY-NOTICES.md` accurate if you add a dependency.

## 3. GitHub

```bash
git add -A
git commit -m "song-mv: code-rendered music videos"
git branch -M main
git remote add origin git@github.com:<you>/dsh-song-mv.git
git push -u origin main
```

Suggested repo description:

> Code-rendered music videos for DSH: beat-synced scenes, kinetic lyrics, story
> props drawn in code, encoded with ffmpeg. Ships as a plugin and a CLI.

Suggested topics: `dsh-plugin`, `music-video`, `lyric-video`, `node-canvas`,
`ffmpeg`, `generative-art`, `creative-coding`.

### If `github.com:443` is unreachable

Some networks block the git host while leaving the API reachable. `git push`
then dies with "Could not connect to server" and retrying does not help (SSH may
also have no registered key). The Git Data API is the same operation over a
different host:

```bash
GITHUB_TOKEN=$(gh auth token) node tools/push-via-api.mjs -m "your message"
```

It reads `owner/repo` from `origin`, uploads every tracked file as a blob, and
chains the new commit onto `main`. Treat it as a fallback: the resulting commit
is authored server-side, so its hash will not match a local `git log`, and you
should go back to `git push` as soon as the network allows it.

### If you attach a demo to the README

Use `docs/demo/demo.webm`. Do **not** attach a render of a real song: the video
contains the recording and the lyrics, and GitHub will host it under your name.

## 4. npm (optional)

```bash
npm pack --dry-run     # 38 files, ~1.4 MB
npm publish --access public
```

The package is `dsh-song-mv`, and `bin` exposes `song-mv`. Two notes:

- `canvas` ships prebuilt binaries for common platforms but compiles from source
  when none matches. Keep the `engines` field honest (`node >= 20.10`).
- Never add `postinstall` steps that download ffmpeg or fonts. The docs promise
  the user installs those themselves, and that promise is what keeps the
  licensing section true.

## 5. Installing into DSH

```bash
dsh plugin --profile desktop add "link:/absolute/path/to/dsh-song-mv"
# then restart DSH once
```

If `dsh` is not on your PATH (it lives inside the desktop app), do it manually —
the effect is identical:

1. add `"dsh-song-mv": "link:/absolute/path/to/dsh-song-mv"` to
   `~/.dsh/profiles/desktop/package.json` → `dependencies`;
2. add `"dsh-song-mv"` to the same file → `dsh.profile.bundles`;
3. run `pnpm install` in `~/.dsh/profiles/desktop`;
4. restart DSH.

The bundle layer reads `dsh.bundle.patch` → `cordis.patch.yml`, which inserts the
plugin id `dsh-song-mv`; `lib/index.js` then registers the `song-mv` skill with
the skills registry. After the restart the agent should list `song-mv` among its
skills and be able to run the whole pipeline.

## 6. Releasing a new version

1. bump `version` in `package.json`;
2. update the demo if scene behaviour changed (`examples/synthetic-demo`);
3. `node tools/render.mjs …` the synthetic demo and re-encode
   `docs/demo/demo.webm`;
4. `npm pack --dry-run` to confirm the file list;
5. re-run the content audit above (`git diff --stat` then grep the changed files);
6. tag and push: `git tag v0.1.1 && git push --tags`.
