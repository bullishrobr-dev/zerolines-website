/* Give card-sized images a card-sized file.
 *
 * The re-encode pass sized every asset to the widest box it occupies anywhere on
 * the site. That is right for a hero, and badly wrong for the same photograph
 * reused as a thumbnail: /blog/ renders 31 cards at 342 CSS px on a phone and
 * was handed files up to 2752px wide — 8x over-service on every one. The bytes
 * matter, but the memory matters more. Each of those decodes to a full RGBA
 * bitmap before the browser scales it down, which is what makes a long index
 * page feel like the phone is struggling rather than merely slow.
 *
 * So: one extra file per card image at 820px (403 CSS px desktop x 2), and a
 * srcset that lets the browser pick. The full-size file stays exactly as it is
 * for the pages that genuinely display it large.
 *
 * Usage: node .claude/srcset.js [--dry]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry');

// Measured, not guessed: the largest rendered box for each of these classes
// across viewports, doubled for retina.
const CARD_CLASSES = [
  'zl-blog-landing-card-image',
  'zl-blog-card-image',
  'zl-card__img',
];
const CARD_W = 820;

const SKIP_DIRS = ['.git', 'node_modules', '.venv', '.netlify', '.claude', '_do-not-use'];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const pages = walk(ROOT);
const classRe = new RegExp(`class="[^"]*(?:${CARD_CLASSES.join('|')})[^"]*"`);

// 1. which assets appear inside a card?
const needed = new Set();
for (const file of pages) {
  const html = fs.readFileSync(file, 'utf8');
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    if (!classRe.test(m[0])) continue;
    const src = (m[0].match(/src="\/assets\/([A-Za-z0-9._-]+\.webp)"/) || [])[1];
    if (src) needed.add(src);
  }
}
console.log(`${needed.size} assets appear in card contexts`);

// 2. build the card variant for each, unless the original is already small
let built = 0, saved = 0;
for (const name of needed) {
  const src = path.join(ROOT, 'assets', name);
  if (!fs.existsSync(src)) continue;
  const out = path.join(ROOT, 'assets', name.replace(/\.webp$/, '-card.webp'));

  const png = '/tmp/srcset-src.png';
  execFileSync('dwebp', ['-quiet', src, '-o', png]);
  const w = +execFileSync('sips', ['-g', 'pixelWidth', png]).toString().match(/pixelWidth:\s*(\d+)/)[1];
  if (w <= CARD_W * 1.1) { fs.unlinkSync(png); continue; }   // already card-sized

  if (!DRY) execFileSync('cwebp', ['-q', '82', '-m', '6', '-quiet', '-resize', String(CARD_W), '0', png, '-o', out]);
  fs.unlinkSync(png);
  if (!DRY && fs.existsSync(out)) {
    built++;
    saved += fs.statSync(src).size - fs.statSync(out).size;
  }
}
console.log(`built ${built} card variants`);

// 3. rewrite the card <img> tags to offer both
let touched = 0, tags = 0;
for (const file of pages) {
  const html = fs.readFileSync(file, 'utf8');
  let out = html;
  out = out.replace(/<img\b[^>]*>/g, (tag) => {
    if (!classRe.test(tag)) return tag;
    if (tag.includes('srcset')) return tag;
    const m = tag.match(/src="\/assets\/([A-Za-z0-9._-]+\.webp)"/);
    if (!m) return tag;
    const card = m[1].replace(/\.webp$/, '-card.webp');
    if (!fs.existsSync(path.join(ROOT, 'assets', card))) return tag;
    tags++;
    // sizes reflects the measured layout: cards cap at 403 CSS px on desktop and
    // sit near half the viewport on a phone.
    return tag.replace(
      /(<img\b)/,
      `$1 srcset="/assets/${card} 820w, /assets/${m[1]} 2560w" sizes="(max-width: 700px) 46vw, 410px"`
    );
  });
  if (out !== html) {
    if (!DRY) fs.writeFileSync(file, out);
    touched++;
  }
}
console.log(`${DRY ? '[dry] ' : ''}added srcset to ${tags} card images across ${touched} pages`);
if (built) console.log(`card variants add ${(saved / 1048576).toFixed(2)} MB of disk but remove far more from every phone that loads an index page`);
