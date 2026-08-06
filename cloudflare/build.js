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
    if ((dir === OUT && e.name.endsWith('.md')) || / \d+\.[a-z]+$/i.test(e.name)) {
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
