/* Repair the double-substitution I introduced in fix-product-images.js.
 *
 * Root cause: "./assets/" is a substring of "../../assets/", so a blanket
 * replace of /\.\/assets\//g ran a second time over paths the <picture>
 * collapse had already corrected, yielding "../.../../assets/".
 *
 * This pass normalises ANY malformed variant back to exactly "../../assets/".
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const slugs = ['day-cream', 'night-cream', 'peeling-gel', 'serum', 'syringe', 'syringe-refill'];

let fixed = 0;
for (const slug of slugs) {
  const file = path.join(ROOT, 'products', slug, 'index.html');
  let html = fs.readFileSync(file, 'utf8');
  const before = html;

  // Collapse any run of dot/slash garbage immediately preceding "assets/"
  // into the single correct relative prefix for /products/<slug>/.
  html = html.replace(/(?:\.{1,}\/)+assets\//g, '../../assets/');

  if (html !== before) {
    fs.writeFileSync(file, html);
    fixed++;
  }
}
console.log(`normalised asset paths in ${fixed} product page(s)`);

// Verify every referenced asset actually exists on disk.
let ok = 0, miss = 0;
for (const slug of slugs) {
  const html = fs.readFileSync(path.join(ROOT, 'products', slug, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/(?:src|srcset|href|content)="(\.\.\/\.\.\/assets\/[^"]+)"/g)].map((m) => m[1]);
  for (const ref of refs) {
    const abs = path.join(ROOT, 'products', slug, ref);
    if (fs.existsSync(abs)) ok++;
    else { console.log(`  MISSING  ${slug}: ${ref}`); miss++; }
  }
}
console.log(`\nverified: ${ok} asset reference(s) resolve, ${miss} missing`);
