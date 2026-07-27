/* Fix social sharing.
 *
 * Two defects:
 *   1. og:image / twitter:image point at .jpg files. /assets contains ONLY
 *      .webp and .png — every one of those URLs 404s, so link previews on
 *      WhatsApp, LinkedIn, Facebook, Slack and X are blank. For a brand whose
 *      only live conversion channel is WhatsApp, that is expensive.
 *   2. Some point at zero-lines-website.netlify.app rather than the canonical
 *      zerolines.life.
 *
 * Fix: generate real JPEGs at 1200x630 (the ratio every platform crops to)
 * via macOS sips, then rewrite every OG/Twitter image URL to an absolute
 * https://zerolines.life/assets/og/*.jpg.
 *
 * JPEG rather than WebP deliberately: WebP support among link-preview crawlers
 * is still uneven, and a share card is exactly where a silent failure costs most.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OG_DIR = path.join(ROOT, 'assets', 'og');
const CANON = 'https://zerolines.life';

fs.mkdirSync(OG_DIR, { recursive: true });

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.claude', '.venv', '.netlify'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html') && !e.name.includes('backup')) out.push(p);
  }
  return out;
}

const files = walk(ROOT);

// 1. Collect every image basename referenced by an og:image / twitter:image.
const wanted = new Set();
const RE = /(?:property|name)="(?:og:image|twitter:image)"\s+content="([^"]+)"|(?:content)="([^"]+)"\s+(?:property|name)="(?:og:image|twitter:image)"/g;
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  for (const m of html.matchAll(RE)) {
    const url = m[1] || m[2];
    if (!url) continue;
    const base = path.basename(url).replace(/\.(jpg|jpeg|png|webp)$/i, '');
    if (base) wanted.add(base);
  }
}

// 2. Generate a 1200x630 JPEG for each, from whichever source exists.
let made = 0, skipped = [];
for (const base of wanted) {
  const out = path.join(OG_DIR, `${base}.jpg`);
  if (fs.existsSync(out)) { made++; continue; }
  const src = ['webp', 'png', 'jpg'].map((ext) => path.join(ROOT, 'assets', `${base}.${ext}`)).find(fs.existsSync);
  if (!src) { skipped.push(base); continue; }
  try {
    // Fill a 1200x630 frame: scale to cover, then crop to the exact card size.
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80',
      '--resampleHeightWidthMax', '1400', src, '--out', out], { stdio: 'ignore' });
    execFileSync('sips', ['-c', '630', '1200', out], { stdio: 'ignore' });
    made++;
  } catch (err) {
    skipped.push(`${base} (sips: ${err.message.split('\n')[0]})`);
  }
}
console.log(`og images ready: ${made}`);
if (skipped.length) console.log(`no source for: ${skipped.join(', ')}`);

// 3. Rewrite every og:image / twitter:image URL to the absolute canonical JPEG.
let changed = 0, rewritten = 0;
for (const f of files) {
  let html = fs.readFileSync(f, 'utf8');
  const before = html;

  html = html.replace(
    /((?:property|name)="(?:og:image|twitter:image)"\s+content=")([^"]+)(")/g,
    (_m, pre, url, post) => {
      const base = path.basename(url).replace(/\.(jpg|jpeg|png|webp)$/i, '');
      if (!base || !fs.existsSync(path.join(OG_DIR, `${base}.jpg`))) return _m;
      rewritten++;
      return `${pre}${CANON}/assets/og/${base}.jpg${post}`;
    }
  );
  html = html.replace(
    /(content=")([^"]+)("\s+(?:property|name)="(?:og:image|twitter:image)")/g,
    (_m, pre, url, post) => {
      const base = path.basename(url).replace(/\.(jpg|jpeg|png|webp)$/i, '');
      if (!base || !fs.existsSync(path.join(OG_DIR, `${base}.jpg`))) return _m;
      rewritten++;
      return `${pre}${CANON}/assets/og/${base}.jpg${post}`;
    }
  );

  if (html !== before) { fs.writeFileSync(f, html); changed++; }
}
console.log(`rewrote ${rewritten} og/twitter image URL(s) across ${changed} file(s)`);

// 4. Verify: no og image URL should 404 locally, none should use the netlify.app host.
let bad = 0;
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  for (const m of html.matchAll(/(?:property|name)="(?:og:image|twitter:image)"\s+content="([^"]+)"/g)) {
    const url = m[1];
    if (url.includes('netlify.app')) { console.log(`  ! netlify.app host: ${path.relative(ROOT, f)}`); bad++; continue; }
    if (url.startsWith(CANON)) {
      const local = path.join(ROOT, url.slice(CANON.length));
      if (!fs.existsSync(local)) { console.log(`  ! missing file: ${url} (${path.relative(ROOT, f)})`); bad++; }
    }
  }
}
console.log(bad === 0 ? 'verified: every og:image resolves to a real file on the canonical domain'
                      : `${bad} og image problem(s) remain`);
