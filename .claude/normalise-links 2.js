/* Normalise internal directory-route links to the trailing-slash form.
 *
 * Netlify serves directory routes WITH a trailing slash: a request for
 * /science 301s to /science/. Internal links written as href="/science" or
 * href="/products/serum" therefore cost every visitor (and every crawler) a
 * redirect. This script rewrites them to the form Netlify actually serves.
 *
 * Scope — deliberately narrow:
 *   - only href attributes whose value is a root-absolute directory route
 *     that really exists on disk as <route>/index.html;
 *   - a #fragment or ?query after the route is preserved (/protocol#step-04
 *     becomes /protocol/#step-04);
 *   - .html links, pure in-page anchors (href="#..."), external URLs,
 *     mailto:/tel:, and _redirects aliases (/journal, /faq, ...) never match,
 *     because none of them is a bare on-disk directory route;
 *   - canonical/og:url tags are absolute https:// URLs (already normalised),
 *     so the root-absolute pattern cannot touch them.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const SKIP_DIRS = new Set(['.git', 'node_modules', '.claude', '.venv', '.netlify', 'assets', 'api']);

// 1. Discover the directory routes that exist on disk (dir containing index.html).
function findRoutes(dir, prefix = '', out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory() || SKIP_DIRS.has(e.name)) continue;
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (fs.existsSync(path.join(dir, e.name, 'index.html'))) out.push(rel);
    findRoutes(path.join(dir, e.name), rel, out);
  }
  return out;
}

// Longest first so /products/serum wins over /products in the alternation.
const routes = findRoutes(ROOT).sort((a, b) => b.length - a.length);

// 2. Collect the HTML files to rewrite.
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html') && !e.name.includes('backup')) out.push(p);
  }
  return out;
}

// href="/science" | href="/science#x" | href="/science?q"  ->  slash inserted.
// The lookahead excludes "/" so already-correct links never match twice.
const alternation = routes.join('|');
const reDouble = new RegExp(`href="/(${alternation})(?=["#?])`, 'g');
const reSingle = new RegExp(`href='/(${alternation})(?=['#?])`, 'g');

let rewrites = 0;
let filesChanged = 0;

for (const file of walk(ROOT)) {
  const before = fs.readFileSync(file, 'utf8');
  let n = 0;
  const after = before
    .replace(reDouble, (m, r) => { n++; return `href="/${r}/`; })
    .replace(reSingle, (m, r) => { n++; return `href='/${r}/`; });
  if (n > 0) {
    fs.writeFileSync(file, after);
    rewrites += n;
    filesChanged++;
    console.log(`  ${path.relative(ROOT, file)}: ${n}`);
  }
}

console.log(`routes on disk: ${routes.length} (${routes.slice().sort().join(', ')})`);
console.log(`${rewrites} href rewrite(s) in ${filesChanged} file(s)`);
