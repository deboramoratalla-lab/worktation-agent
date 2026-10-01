#!/usr/bin/env node
// Download the current main branch from GitHub without git, through the GitHub REST API.
// Writes into a target folder (default: a fresh temp folder) so it can be compared before
// anything local is overwritten.
//
//   node scripts/pull.mjs                 download to a temp folder and print its path
//   node scripts/pull.mjs --into <dir>    download into <dir>
//
// Uses the same token as push.mjs (~/.config/workation-agent/github-token). Never printed.

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const OWNER = 'deboramoratalla-lab';
const REPO = 'worktation-agent';
const BRANCH = 'main';
const token = readFileSync(join(homedir(), '.config', 'workation-agent', 'github-token'), 'utf8').trim();

const args = process.argv.slice(2);
const iIdx = args.indexOf('--into');
const target = iIdx >= 0 ? args[iIdx + 1] : mkdtempSync(join(tmpdir(), 'worktation-main-'));

async function gh(path) {
  const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!res.ok) throw new Error(`GitHub GET ${path}: ${res.status}`);
  return res.json();
}

const ref = await gh(`/git/ref/heads/${BRANCH}`);
const head = await gh(`/git/commits/${ref.object.sha}`);
const tree = await gh(`/git/trees/${head.tree.sha}?recursive=1`);
const files = tree.tree.filter((e) => e.type === 'blob');
for (const f of files) {
  const blob = await gh(`/git/blobs/${f.sha}`);
  const out = join(target, f.path);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, Buffer.from(blob.content, 'base64'));
}
console.log(`Downloaded ${files.length} files from ${ref.object.sha.slice(0, 7)} (“${head.message.split('\n')[0]}”) into ${target}`);
