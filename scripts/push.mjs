#!/usr/bin/env node
// Push local changes to GitHub without git, through the GitHub REST API.
// All changes go in one commit, so Vercel never builds a half-uploaded state.
//
//   node scripts/push.mjs --dry-run            show what would change
//   node scripts/push.mjs -m "What changed"    commit and push to main
//
// Token: a fine-grained GitHub token (Contents: read and write, this repo only),
// saved in ~/.config/workation-agent/github-token. It is read here and never printed.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join, relative, sep } from 'node:path';

const OWNER = 'deboramoratalla-lab';
const REPO = 'worktation-agent';
const BRANCH = 'main';
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TOKEN_FILE = join(homedir(), '.config', 'workation-agent', 'github-token');

// Never uploaded, whatever .gitignore says
const SKIP = new Set(['node_modules', 'node_modules.nosync', '.next', '.git', '.vercel', '.claude', '.DS_Store', '.env.local', '.env']);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const mIdx = args.indexOf('-m');
const message = mIdx >= 0 ? args[mIdx + 1] : null;
if (!dryRun && !message) {
  console.error('Add a commit message: node scripts/push.mjs -m "What changed"');
  process.exit(1);
}

let token;
try {
  token = readFileSync(TOKEN_FILE, 'utf8').trim();
} catch {
  console.error(`No token found at ${TOKEN_FILE}`);
  process.exit(1);
}

async function gh(path, init = {}) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...init.headers },
  });
  if (!res.ok) throw new Error(`GitHub ${init.method ?? 'GET'} ${path}: ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

function ignored() {
  try {
    return readFileSync(join(ROOT, '.gitignore'), 'utf8')
      .split('\n')
      .map((l) => l.trim().replace(/^\//, '').replace(/\/$/, ''))
      .filter((l) => l && !l.startsWith('#'));
  } catch {
    return [];
  }
}
const patterns = ignored().map((p) => new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*') + '(/|$)'));
const isIgnored = (rel) => rel.split('/').some((part) => SKIP.has(part)) || patterns.some((re) => re.test(rel) || re.test(rel.split('/').pop()));

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const rel = relative(ROOT, abs).split(sep).join('/');
    if (isIgnored(rel)) continue;
    const st = statSync(abs);
    if (st.isDirectory()) walk(abs, out);
    else if (st.isFile()) out.push(rel);
  }
  return out;
}

const blobSha = (buf) => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');

const ref = await gh(`/git/ref/heads/${BRANCH}`);
const headSha = ref.object.sha;
const head = await gh(`/git/commits/${headSha}`);
const remote = await gh(`/git/trees/${head.tree.sha}?recursive=1`);
if (remote.truncated) throw new Error('Remote tree too large to compare');
const remoteFiles = new Map(remote.tree.filter((e) => e.type === 'blob').map((e) => [e.path, e.sha]));

const local = walk(ROOT);
const changes = [];
for (const path of local) {
  const buf = readFileSync(join(ROOT, path));
  const sha = blobSha(buf);
  if (remoteFiles.get(path) !== sha) changes.push({ path, buf, kind: remoteFiles.has(path) ? 'changed' : 'new' });
}
const localSet = new Set(local);
const deletions = [...remoteFiles.keys()].filter((p) => !localSet.has(p) && !isIgnored(p));

if (!changes.length && !deletions.length) {
  console.log('GitHub is already up to date.');
  process.exit(0);
}
for (const c of changes) console.log(`${c.kind === 'new' ? '+' : '~'} ${c.path}`);
for (const d of deletions) console.log(`- ${d}`);
if (dryRun) {
  console.log(`\nDry run: ${changes.length} to upload, ${deletions.length} to delete. Nothing sent.`);
  process.exit(0);
}

const tree = [];
for (const c of changes) {
  const blob = await gh('/git/blobs', { method: 'POST', body: JSON.stringify({ content: c.buf.toString('base64'), encoding: 'base64' }) });
  tree.push({ path: c.path, mode: '100644', type: 'blob', sha: blob.sha });
}
for (const d of deletions) tree.push({ path: d, mode: '100644', type: 'blob', sha: null });

const newTree = await gh('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: head.tree.sha, tree }) });
const commit = await gh('/git/commits', { method: 'POST', body: JSON.stringify({ message, tree: newTree.sha, parents: [headSha] }) });
await gh(`/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
console.log(`\nPushed ${commit.sha.slice(0, 7)} to ${OWNER}/${REPO}@${BRANCH}. Vercel will deploy it.`);
