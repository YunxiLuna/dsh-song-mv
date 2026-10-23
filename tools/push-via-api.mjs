#!/usr/bin/env node
// Push the current working tree to GitHub through the REST API.
//
// Why this exists: on some networks `github.com:443` is unreachable while
// `api.github.com:443` works (or vice versa). `git push` then fails with
// "Could not connect to server" no matter how long you wait, and SSH keys may
// not be registered. The Git Data API is the same operation over a different
// host: blobs → tree → commit → ref.
//
// Usage:
//   GITHUB_TOKEN=$(gh auth token) node tools/push-via-api.mjs [owner/repo] [-m "message"]
//
// A quoted message is also accepted without -m:
//   node tools/push-via-api.mjs "docs: fix the install steps"
//
// With no owner/repo it reads the `origin` remote. The commit is chained onto
// the existing branch head, so repeat runs append history like a normal push.
// This is a fallback, not the default workflow — prefer `git push`.
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const BINARY = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webm', '.ico']);
const API = 'https://api.github.com';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : fallback;
}

/** Everything on the command line that is neither a flag nor an owner/repo slug. */
function freeText() {
  const out = [];
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === '-m') { i++; continue; }
    if (a.startsWith('-')) continue;
    if (/^[\w.-]+\/[\w.-]+$/.test(a)) continue;
    out.push(a);
  }
  return out.join(' ').trim();
}

function slug() {
  const explicit = process.argv[2];
  if (explicit && /^[\w.-]+\/[\w.-]+$/.test(explicit)) return explicit;
  const url = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
  const m = url.match(/[:/]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/);
  if (!m) throw new Error(`cannot read owner/repo from remote: ${url}`);
  return `${m[1]}/${m[2]}`;
}

const [OWNER, REPO] = slug().split('/');
const MESSAGE = arg('-m', '') || freeText() || 'update from push-via-api';
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
if (!TOKEN) {
  console.error('set GITHUB_TOKEN: GITHUB_TOKEN=$(gh auth token) node tools/push-via-api.mjs');
  process.exit(2);
}

async function call(method, endpoint, body) {
  const res = await fetch(API + endpoint, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'push-via-api',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${endpoint} → ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

// Tracked files plus new ones that are not ignored yet: `git ls-files` alone
// silently drops a file you have not staged, which is how a "pushed" commit can
// be missing half its new files.
const files = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' })
  .split('\n')
  .map((f) => f.trim())
  .filter((f) => f && fs.existsSync(f));

const untracked = files.filter((f) => {
  try {
    execSync(`git ls-files --error-unmatch "${f}"`, { stdio: 'ignore' });
    return false;
  } catch {
    return true;
  }
});

console.log(`${files.length} files → ${OWNER}/${REPO}` +
  (untracked.length ? ` (${untracked.length} of them new)` : ''));

// GitHub answers 409 on a repository with zero commits, so seed one first.
try {
  await call('POST', `/repos/${OWNER}/${REPO}/git/blobs`, { content: 'seed', encoding: 'utf-8' });
} catch (err) {
  if (!String(err.message).includes('409')) throw err;
  console.log('empty repo → seeding a first commit');
  await call('PUT', `/repos/${OWNER}/${REPO}/contents/.seed`, {
    message: 'seed',
    content: Buffer.from('seed\n').toString('base64'),
  });
}

const tree = [];
for (const rel of files) {
  const body = BINARY.has(path.extname(rel).toLowerCase())
    ? { content: fs.readFileSync(rel).toString('base64'), encoding: 'base64' }
    : { content: fs.readFileSync(rel, 'utf8'), encoding: 'utf-8' };
  const blob = await call('POST', `/repos/${OWNER}/${REPO}/git/blobs`, body);
  tree.push({
    path: rel,
    mode: /cli\.mjs$|push-via-api\.mjs$/.test(rel) ? '100755' : '100644',
    type: 'blob',
    sha: blob.sha,
  });
  process.stdout.write('.');
}
console.log('');

const treeRes = await call('POST', `/repos/${OWNER}/${REPO}/git/trees`, { tree });

let parents = [];
try {
  const head = await call('GET', `/repos/${OWNER}/${REPO}/git/ref/heads/main`);
  parents = [head.object.sha];
} catch {
  /* first push */
}

const commit = await call('POST', `/repos/${OWNER}/${REPO}/git/commits`, {
  message: MESSAGE,
  tree: treeRes.sha,
  parents,
});

try {
  await call('POST', `/repos/${OWNER}/${REPO}/git/refs`, {
    ref: 'refs/heads/main',
    sha: commit.sha,
  });
} catch {
  await call('PATCH', `/repos/${OWNER}/${REPO}/git/refs/heads/main`, { sha: commit.sha });
}

console.log(`https://github.com/${OWNER}/${REPO}/commit/${commit.sha}`);
