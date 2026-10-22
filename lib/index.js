// dsh-song-mv — host plugin.
//
// The plugin ships one agent skill ("song-mv") plus the engine and CLI behind
// it. Nothing here does any rendering by itself: the skill teaches the agent to
// call tools/*.mjs, so the heavy work stays in ordinary Node processes that the
// user can also run from a terminal.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export const name = 'dsh-song-mv';

// Only the skill registry is needed; no session or web server access.
export const inject = ['skills'];

const SKILL_DIR = new URL('../skills/song-mv/', import.meta.url);
const SKILL_FILE = new URL('SKILL.md', SKILL_DIR);
const SKILL_RANK = 600; // same band as first-party bundled skills

const CANDIDATE = {
  name: 'song-mv',
  description:
    'Turn a song into a code-rendered music video: analyze the audio, draft a storyboard, write lyric animations and code-drawn story props, render to mp4 with ffmpeg.',
  invocation: { modelInvocable: true, userInvocable: true },
  provider: 'dsh-song-mv',
  source: 'bundled',
  rank: SKILL_RANK,
  resourceBase: { kind: 'directory', path: fileURLToPath(SKILL_DIR) },
  locator: SKILL_FILE,
};

export function apply(ctx) {
  ctx.skills.registerProvider(() => ({
    name: CANDIDATE.name,
    list: async () => [CANDIDATE],
    async get() {
      return { ...CANDIDATE, content: await readFile(SKILL_FILE, 'utf8') };
    },
  }));
}
