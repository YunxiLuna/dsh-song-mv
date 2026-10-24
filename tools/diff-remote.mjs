// Compare the local working tree against the remote HEAD tree, file by file.
// Prints any file whose blob differs, plus files only on one side.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const TOKEN = process.env.GITHUB_TOKEN;
const REPO = 'YunxiLuna/dsh-song-mv';

const res = await fetch(`https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`, {
  headers: { authorization: `Bearer ${TOKEN}`, accept: 'application/vnd.github+json' },
});
if (!res.ok) { console.error('api', res.status, await res.text()); process.exit(1); }
const tree = await res.json();
const remote = new Map();
for (const e of tree.tree) if (e.type === 'blob') remote.set(e.path, e.sha);

const files = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' })
  .split('\n').map((s) => s.trim()).filter((s) => s && fs.existsSync(s));

function blobSha(buf) {
  return createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
}

const localOnly = [], different = [];
for (const f of files) {
  const sha = blobSha(fs.readFileSync(f));
  if (!remote.has(f)) localOnly.push(f);
  else if (remote.get(f) !== sha) different.push(f);
}
const remoteOnly = [...remote.keys()].filter((p) => !files.includes(p));

console.log('remote files:', remote.size, ' local files:', files.length);
if (localOnly.length) console.log('only local:', localOnly.join(', '));
if (remoteOnly.length) console.log('only remote:', remoteOnly.join(', '));
if (different.length) console.log('differing:', different.join(', '));
if (!localOnly.length && !different.length && !remoteOnly.length) console.log('trees are identical');
