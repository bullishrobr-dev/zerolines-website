/* Check every internal href/src across the site resolves to a real file,
 * applying the same resolution rules Netlify uses (directory -> index.html,
 * extensionless -> .html or /index.html).
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.claude', '.venv', '.netlify'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html') && !e.name.includes('backup')) out.push(p);
  }
  return out;
}

// Routes served by _redirects rather than by a file on disk.
const ALIASES = new Set(['/journal', '/analyser', '/analyzer', '/faq', '/privacy',
  '/terms', '/cookies', '/accessibility', '/shipping', '/shipping-returns']);

function resolves(target) {
  if (ALIASES.has(target.replace(/\/$/, ''))) return true;
  const rel = target.replace(/^\//, '');
  const candidates = [
    path.join(ROOT, rel),
    path.join(ROOT, rel, 'index.html'),
    path.join(ROOT, rel + '.html'),
  ];
  return candidates.some((c) => fs.existsSync(c) && fs.statSync(c).isFile());
}

const files = walk(ROOT);
const broken = new Map();
let checked = 0;

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const rel = path.relative(ROOT, file);

  for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    let target = m[1];
    if (/^(https?:|mailto:|tel:|data:|#|javascript:)/i.test(target)) continue;
    target = target.split('#')[0].split('?')[0];
    if (!target) continue;

    // resolve relative to the file if not root-absolute
    let abs;
    if (target.startsWith('/')) abs = target;
    else abs = '/' + path.relative(ROOT, path.resolve(path.dirname(file), target)).split(path.sep).join('/');

    checked++;
    if (!resolves(abs)) {
      if (!broken.has(rel)) broken.set(rel, new Set());
      broken.get(rel).add(`${m[1]}  ->  ${abs}`);
    }
  }
}

console.log(`checked ${checked} internal reference(s) across ${files.length} page(s)`);
if (!broken.size) {
  console.log('all internal links resolve');
} else {
  let total = 0;
  for (const [f, set] of broken) {
    console.log(`\n${f}`);
    for (const s of set) { console.log(`   ${s}`); total++; }
  }
  console.log(`\n${total} broken reference(s) in ${broken.size} file(s)`);
}
