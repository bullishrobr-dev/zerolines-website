/* Fix broken images on the 6 product detail pages.
 *
 * Two defects, both fatal:
 *   1. Paths are "./assets/x" — from /products/<slug>/index.html that resolves to
 *      /products/<slug>/assets/x, a directory that does not exist.
 *   2. The <img> fallback points at .jpg. There is not a single .jpg in /assets.
 *
 * Because the <source> webp path was ALSO wrong, nothing rendered at all.
 * Fix: collapse each <picture> to a single <img> pointing at the real .webp
 * via the correct ../../assets/ path. WebP has universal support in 2026, so the
 * <picture>/<source> dance buys nothing and only creates a second path to get wrong.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const slugs = ['day-cream', 'night-cream', 'peeling-gel', 'serum', 'syringe', 'syringe-refill'];

// <picture> ... <source srcset="./assets/NAME.webp" ...> <img src="./assets/NAME.jpg" ATTRS> </picture>
const PICTURE_RE =
  /<picture>\s*<source\s+srcset="\.\/assets\/([^"]+\.webp)"[^>]*>\s*<img\s+src="\.\/assets\/[^"]+"([^>]*)>\s*<\/picture>/g;

let totalPictures = 0, totalPaths = 0;
const report = [];

for (const slug of slugs) {
  const file = path.join(ROOT, 'products', slug, 'index.html');
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  let pics = 0;

  html = html.replace(PICTURE_RE, (_m, webp, attrs) => {
    pics++;
    return `<img src="../../assets/${webp}"${attrs}>`;
  });

  // Any remaining ./assets/ references (og:image, plain img, etc.)
  const remaining = (html.match(/\.\/assets\//g) || []).length;
  html = html.replace(/\.\/assets\//g, '../../assets/');

  if (html !== before) {
    fs.writeFileSync(file, html);
    totalPictures += pics;
    totalPaths += remaining;
    report.push(`  ${slug.padEnd(15)} ${pics} <picture> collapsed, ${remaining} path(s) corrected`);
  } else {
    report.push(`  ${slug.padEnd(15)} no change`);
  }
}

console.log('Product image fix:');
report.forEach((r) => console.log(r));
console.log(`\n  ${totalPictures} <picture> blocks collapsed, ${totalPaths} paths corrected`);

// Verify: no ./assets/ and no .jpg references should remain in product pages
let bad = 0;
for (const slug of slugs) {
  const html = fs.readFileSync(path.join(ROOT, 'products', slug, 'index.html'), 'utf8');
  for (const m of html.match(/(\.\/assets\/[^"']+|assets\/[^"']+\.jpg)/g) || []) {
    console.log(`  ! ${slug}: ${m}`);
    bad++;
  }
}
console.log(bad === 0 ? '  verified: no broken asset references remain' : `  ${bad} references still need attention`);
