/* Make declared URLs match the URLs Netlify actually serves.
 *
 * Netlify serves directory routes with a trailing slash: a request for /science
 * 301s to /science/. Our _redirects declared the exact opposite
 * (/science/ -> /science 301). Those rules are currently dormant — Netlify's own
 * directory handling wins, verified with curl: one redirect, then 200, no loop —
 * but two rules pointing in opposite directions is a redirect loop waiting for a
 * platform behaviour change, so they come out.
 *
 * Separately, canonical and og:url tags pointed at the non-slash form, i.e. at a
 * URL that 301s. A canonical should be the URL actually served. Normalise both.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const ROUTES = ['science', 'story', 'protocol', 'testimonials', 'contact', 'products',
  'products/peeling-gel', 'products/syringe', 'products/serum',
  'products/day-cream', 'products/night-cream', 'products/syringe-refill'];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', '.claude', '.venv', '.netlify', 'assets'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(html|xml)$/.test(e.name) && !e.name.includes('backup')) out.push(p);
  }
  return out;
}

// 1. canonical / og:url / sitemap <loc> -> trailing-slash form
let fixed = 0, files = 0;
for (const file of walk(ROOT)) {
  let text = fs.readFileSync(file, 'utf8');
  const before = text;
  for (const r of ROUTES) {
    const bare = `https://zerolines.life/${r}`;
    // only when NOT already followed by / or more path characters
    text = text.split(`${bare}"`).join(`${bare}/"`);
    text = text.split(`${bare}<`).join(`${bare}/<`);
  }
  if (text !== before) {
    const n = (before.match(/zerolines\.life\//g) || []).length;
    fs.writeFileSync(file, text);
    files++; fixed += n;
  }
}
console.log(`normalised declared URLs in ${files} file(s)`);

// 2. drop the contradictory trailing-slash block from _redirects
const RED = path.join(ROOT, '_redirects');
let red = fs.readFileSync(RED, 'utf8');
const start = red.indexOf('# --- Trailing-slash normalisation');
const end = red.indexOf('# --- Convenience aliases');
if (start !== -1 && end !== -1) {
  red = red.slice(0, start) +
    `# --- Trailing slashes ---------------------------------------------------------\n` +
    `# Netlify serves directory routes WITH a trailing slash and 301s /science to\n` +
    `# /science/ itself. Declaring the reverse here created two rules pointing in\n` +
    `# opposite directions — dormant today because Netlify's own handling wins, but a\n` +
    `# redirect loop waiting to happen. Canonicals now use the trailing-slash form\n` +
    `# that is actually served, and no rule is needed.\n\n` +
    red.slice(end);
  fs.writeFileSync(RED, red);
  console.log('removed the contradictory trailing-slash rules from _redirects');
}

// 3. verify no canonical points at a bare directory route any more
let bad = 0;
for (const file of walk(ROOT)) {
  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(/(?:rel="canonical" href|property="og:url" content)="([^"]+)"/g)) {
    const u = m[1];
    const tail = u.replace('https://zerolines.life', '');
    if (tail && !tail.endsWith('/') && !tail.endsWith('.html')) {
      console.log(`  ! still bare: ${u}  (${path.relative(ROOT, file)})`);
      bad++;
    }
  }
}
console.log(bad === 0 ? 'verified: every canonical matches a URL Netlify serves directly' : `${bad} remaining`);
