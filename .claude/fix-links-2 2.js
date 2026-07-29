/* Second link pass.
 *   a) Blog category cards: hrefs carry a "./" prefix my first pattern missed.
 *      Repoint each card's blog-hero-*.jpg (never existed) at the hero image of
 *      the article the card actually links to.
 *   b) Everywhere else: any .jpg reference for which only a .webp exists.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.claude', '.venv', '.netlify', 'assets'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html') && !e.name.includes('backup')) out.push(p);
  }
  return out;
}

// ---- a) blog category hero images ----------------------------------------
const blogDir = path.join(ROOT, 'blog');
const articleHero = {};
for (const f of fs.readdirSync(blogDir).filter((f) => f.endsWith('.html') && !f.startsWith('category-') && f !== 'index.html')) {
  const html = fs.readFileSync(path.join(blogDir, f), 'utf8');
  const m = html.match(/\.\.\/assets\/([a-z0-9-]+\.webp)/);
  if (m) articleHero[f] = m[1];
}

let repointed = 0, catFiles = 0;
for (const f of fs.readdirSync(blogDir).filter((f) => f.startsWith('category-'))) {
  const file = path.join(blogDir, f);
  let html = fs.readFileSync(file, 'utf8');
  const before = html;

  // <a href="./slug.html" ...> <img src="../assets/blog-hero-x.jpg" ...>
  html = html.replace(
    /(href="\.?\/?([a-z0-9-]+\.html)"[^>]*>\s*<img\s+src=")\.\.\/assets\/blog-hero-[a-z0-9-]+\.jpg(")/g,
    (whole, pre, slug, post) => {
      const hero = articleHero[slug];
      if (!hero) return whole;
      repointed++;
      return `${pre}../assets/${hero}${post}`;
    }
  );

  if (html !== before) { fs.writeFileSync(file, html); catFiles++; }
}
console.log(`blog category: ${repointed} hero image(s) repointed across ${catFiles} file(s)`);

// ---- b) global .jpg -> .webp ---------------------------------------------
let jpgFixed = 0, jpgFiles = 0;
for (const file of walk(ROOT)) {
  let html = fs.readFileSync(file, 'utf8');
  const before = html;

  html = html.replace(/(["'(])((?:\.\.?\/)*(?:\/)?assets\/)([a-z0-9-]+)\.jpg/g, (m, q, dir, base) => {
    // leave og/ cards alone — those really are .jpg and really exist
    if (dir.includes('og/')) return m;
    if (!fs.existsSync(path.join(ASSETS, base + '.webp'))) return m;
    jpgFixed++;
    return `${q}${dir}${base}.webp`;
  });

  if (html !== before) { fs.writeFileSync(file, html); jpgFiles++; }
}
console.log(`.jpg -> .webp: ${jpgFixed} reference(s) across ${jpgFiles} file(s)`);
