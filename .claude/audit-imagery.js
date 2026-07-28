/* Which images are actually in use, and which have never been eyeballed?
 *
 * Three separate competitor-branded images have now been found by accident —
 * "AQUA PEL" on the peeling gel, "RENEU Skincare" on the refill, and "AURORA"
 * on the application shot, the last of which was live on 15 pages. Every one was
 * caught by a person looking at it, never by a grep, because the offending text
 * is raster pixels.
 *
 * This lists every asset still referenced by the site, flags the ones that are
 * old (pre-dating the generated set, so never verified) and reports where each
 * is used, so the remaining unverified ones can be reviewed deliberately rather
 * than stumbled upon.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', '.claude', '.venv', '.netlify', '_do-not-use'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html') && !e.name.includes('backup')) out.push(p);
  }
  return out;
}

const pages = walk(ROOT);
const usage = new Map();

for (const file of pages) {
  const html = fs.readFileSync(file, 'utf8');
  for (const m of html.matchAll(/\/assets\/([a-z0-9-]+)\.(webp|png)/gi)) {
    const asset = m[1];
    if (!usage.has(asset)) usage.set(asset, new Set());
    usage.get(asset).add(path.relative(ROOT, file));
  }
}

// Anything written during the generated-photography run is verified; the rest
// predates it and has never been looked at deliberately.
const CUTOFF = new Date('2026-07-28T22:00:00Z');

const rows = [];
for (const [asset, files] of usage) {
  for (const ext of ['webp', 'png']) {
    const p = path.join(ROOT, 'assets', asset + '.' + ext);
    if (!fs.existsSync(p)) continue;
    const st = fs.statSync(p);
    rows.push({
      asset: asset + '.' + ext,
      pages: files.size,
      verified: st.mtime > CUTOFF,
      kb: Math.round(st.size / 1024),
    });
    break;
  }
}

rows.sort((a, b) => b.pages - a.pages);

const unverified = rows.filter((r) => !r.verified);
const verified = rows.filter((r) => r.verified);

console.log(`in use: ${rows.length} assets across ${pages.length} pages`);
console.log(`  generated this session (verified by eye): ${verified.length}`);
console.log(`  pre-existing (NEVER deliberately reviewed): ${unverified.length}\n`);
console.log('UNVERIFIED, ordered by blast radius:');
for (const r of unverified) {
  console.log(`  ${String(r.pages).padStart(3)} pages  ${r.asset.padEnd(42)} ${r.kb}KB`);
}

fs.writeFileSync(
  path.join(ROOT, '.claude', 'imagery-audit.json'),
  JSON.stringify({ verified, unverified }, null, 1)
);
