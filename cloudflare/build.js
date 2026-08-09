#!/usr/bin/env node
/**
 * Assemble cloudflare/public/ — the asset directory the Worker serves.
 *
 * Source is `git archive HEAD`, not the working tree, so an experiment left
 * open in an editor cannot reach production. iCloud has twice dropped conflict
 * copies into this repo and one of them silently replaced a live page, so
 * anything matching "name 2.html" is excluded belt-and-braces even though the
 * archive should not contain it.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'public');

// Never shipped: server-only code, tooling, dependencies, notes to ourselves.
const DROP = [
  '.claude', 'node_modules', 'api', 'cloudflare', '.venv',
  'assets/_do-not-use', '.gitignore', 'package.json', 'package-lock.json',
  'netlify.toml',
];

/* Source is HEAD, not the working tree — deliberately, so an experiment left
   open in an editor cannot reach production. The cost is a trap I fell into
   three times in one session: edit a file, build, deploy, then verify against a
   site that still has the old version and conclude the fix did not work. Say so
   loudly instead of failing silently. */
const dirty = execSync('git status --porcelain -- . ":(exclude)cloudflare/public"', { cwd: ROOT })
  .toString().trim().split('\n').filter(Boolean);
if (dirty.length) {
  console.warn(`\n  ⚠  ${dirty.length} uncommitted change(s) — these will NOT be in this build:`);
  for (const line of dirty.slice(0, 12)) console.warn(`       ${line}`);
  if (dirty.length > 12) console.warn(`       … and ${dirty.length - 12} more`);
  console.warn('     Commit first, or you will verify against a stale deploy.\n');
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
execSync(`git archive HEAD | tar -x -C "${OUT}"`, { cwd: ROOT, stdio: 'inherit' });

for (const d of DROP) fs.rmSync(path.join(OUT, d), { recursive: true, force: true });

let removed = 0;
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    // Handover notes and iCloud conflict copies.
    // ' 2.html' and also ' 2' — iCloud numbers the copy after the extension
    // when there is one and after the name when there is not, and a bare
    // '_headers 2' shipped in the bundle for days because the first pattern
    // required an extension.
    if ((dir === OUT && e.name.endsWith('.md')) || / \d+(\.[a-z0-9]+)?$/i.test(e.name)) {
      fs.rmSync(p); removed++;
    }
  }
})(OUT);

// _redirects is Netlify's format; Cloudflare reads the same file, but the
// Netlify-specific proxy rules would be silently ignored, so flag any.
const rd = path.join(OUT, '_redirects');
if (fs.existsSync(rd)) {
  const proxied = fs.readFileSync(rd, 'utf8').split('\n').filter((l) => /\s200!?\s*$/.test(l) && /^\s*\/.*https?:/.test(l));
  if (proxied.length) console.warn(`  ! ${proxied.length} proxy rewrite(s) in _redirects — Cloudflare will not honour these`);
}

let files = 0, bytes = 0;
(function count(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) count(p);
    else { files++; bytes += fs.statSync(p).size; }
  }
})(OUT);

const html = execSync(`find "${OUT}" -name '*.html' | wc -l`).toString().trim();
console.log(`  public/: ${files} files, ${(bytes / 1048576).toFixed(1)}MB, ${html} html pages (${removed} excluded)`);
