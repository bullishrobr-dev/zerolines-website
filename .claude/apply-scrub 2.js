/* Give the large imagery continuous, scroll-linked motion.
 *
 * Until now every image did the same thing: a one-shot clip-path wipe that fires
 * once and is over. However slow you make it, a fire-once transition reads flat,
 * because nothing on the page responds to HOW you are scrolling. That is what
 * mobile was missing.
 *
 * The split is deliberate rather than uniform:
 *   · LARGE editorial / cinema / full-bleed media -> .zl-scrub. Scale and tone
 *     track scroll position continuously, so the picture is alive the whole time
 *     it is on screen.
 *   · SMALL card and grid media -> keep the wipe. A discrete reveal is right for
 *     something that arrives as part of a set.
 * Variety between the two is the point; applying one effect everywhere is how
 * the page got flat in the first place.
 *
 * scrub and wipe both drive the <img> transform, so they must never be combined
 * on the same element — this converts rather than layers.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['.git', 'node_modules', '.claude', '.venv', '.netlify', 'assets'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html') && !e.name.includes('backup')) out.push(p);
  }
  return out;
}

// the big formats only
const BIG = /zl-media--(cinema|editorial|wide|tall|portrait)/;

let converted = 0, files = 0;
for (const file of walk(ROOT)) {
  let html = fs.readFileSync(file, 'utf8');
  const before = html;

  html = html.replace(/<div class="([^"]*zl-media[^"]*)"([^>]*)>/g, (whole, cls, attrs) => {
    if (!BIG.test(cls)) return whole;                    // small media keeps its wipe
    if (/zl-scrub/.test(cls)) return whole;              // already converted
    if (!/data-reveal="wipe"/.test(attrs)) return whole; // only convert existing wipes
    converted++;
    const newAttrs = attrs.replace(/\s*data-reveal="wipe"/, '');
    return `<div class="${cls} zl-scrub"${newAttrs}>`;
  });

  if (html !== before) { fs.writeFileSync(file, html); files++; }
}

console.log(`converted ${converted} large image(s) from one-shot wipe to scroll-scrub across ${files} file(s)`);

// report the resulting balance so the mix stays visible
let scrub = 0, wipe = 0;
for (const file of walk(ROOT)) {
  const h = fs.readFileSync(file, 'utf8');
  scrub += (h.match(/zl-scrub/g) || []).length;
  wipe += (h.match(/data-reveal="wipe"/g) || []).length;
}
console.log(`site now has ${scrub} scrubbed image(s) and ${wipe} wiped image(s)`);
