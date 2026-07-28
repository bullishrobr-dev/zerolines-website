/* Remove the smooth-scroll library entirely.
 *
 * Owner, twice: "the scrolling is HORRIBLE" and then "get rid of it, it's
 * annoying, let it be normal scrolling — keep all the other effects."
 *
 * Any interpolation between the wheel and the page inserts lag between intent
 * and response. Tuning (duration 1.25 -> lerp 0.14) only shrinks it. Native
 * scroll is instant and matches every other page the visitor uses.
 *
 * Nothing else is lost: reveals, scrub, pin, stagger and parallax all read
 * window.scrollY and behave identically on native scroll. Anchors go back to
 * the browser via CSS scroll-behavior:smooth + scroll-padding-top, which
 * already handles the header offset.
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

/* 1. drop the <script> tag from every page (13KB no longer fetched) */
let tagged = 0;
for (const file of walk(ROOT)) {
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  html = html.replace(/^[ \t]*<script[^>]*src="\/assets\/lenis\.min\.js"[^>]*><\/script>\s*\n/gm, '');
  html = html.replace(/<script[^>]*src="\/assets\/lenis\.min\.js"[^>]*><\/script>\s*/g, '');
  if (html !== before) { fs.writeFileSync(file, html); tagged++; }
}
console.log(`lenis script tag removed from ${tagged} page(s)`);

/* 2. the CSS override that stood scroll-behavior down for it */
const CSS = path.join(ROOT, 'assets', 'zl.css');
let css = fs.readFileSync(CSS, 'utf8');
css = css.replace(
  /\/\* When lenis is driving the scroll[\s\S]*?html\.zl-lenis \{ scroll-behavior: auto; \}\n/,
  '/* Native smooth scrolling owns anchors now — no library interpolates the\n' +
  '   scroll position, so nothing needs to stand down. scroll-padding-top above\n' +
  '   keeps a jumped-to heading clear of the fixed header. */\n'
);
fs.writeFileSync(CSS, css);
console.log('CSS override removed');

/* 3. the analyser used lenis for its panel-to-panel scroll */
const AJS = path.join(ROOT, 'assets', 'zl-analyser.js');
let ajs = fs.readFileSync(AJS, 'utf8');
ajs = ajs.replace(
  /    if \(window\.zlLenis && typeof window\.zlLenis\.scrollTo === 'function'\) \{\n.*?\n    \}\n/s,
  ''
);
fs.writeFileSync(AJS, ajs);
console.log('analyser scroll helper simplified to native');

/* 4. verify nothing still reaches for it */
const leftovers = [];
for (const f of [path.join(ROOT, 'assets', 'zl.js'), AJS, CSS]) {
  const t = fs.readFileSync(f, 'utf8');
  t.split('\n').forEach((line, i) => {
    if (/zlLenis|new window\.Lenis|zl-lenis/.test(line)) leftovers.push(`${path.basename(f)}:${i + 1}`);
  });
}
for (const f of walk(ROOT)) {
  if (fs.readFileSync(f, 'utf8').includes('lenis.min.js')) leftovers.push(path.relative(ROOT, f));
}
console.log(leftovers.length ? 'still referencing: ' + leftovers.join(', ') : 'verified: no live references to lenis remain');
