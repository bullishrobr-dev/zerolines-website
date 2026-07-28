/* Remove competitor packaging from the site.
 *
 * Two of the six product mockups are AI-generated stock carrying OTHER brands'
 * packaging, presented on the site as Zero Lines products:
 *   product-peeling-gel.webp    -> tube reads "AQUA PEL — DAILY EXFOLIATING GEL"
 *   product-syringe-refill.webp -> carton reads "RENEU Skincare — Refill Collagen
 *                                  Skincare / Hydration Serum" (garbled lettering)
 * The other four correctly show "zero lines" packaging.
 *
 * Replacements, both genuinely Zero Lines branded:
 *   peeling gel -> product-peeling.webp        (correct: "zero lines / Bio-Renewal Peeling Gel")
 *   refill      -> product-syringe.webp        (correct branding; the refill is a cartridge
 *                                               for that applicator, so the same product family)
 * The refill still needs its own photograph — flagged in STATUS.
 *
 * The offending files are moved to assets/_do-not-use/ rather than deleted, so the
 * change is reversible and they cannot be picked up again by accident.
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const SWAP = {
  'product-peeling-gel.webp': 'product-peeling.webp',
  'product-syringe-refill.webp': 'product-syringe.webp',
};

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', '.claude', '.venv', '.netlify'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(html|xml|json|js)$/.test(e.name) && !e.name.includes('backup')) out.push(p);
  }
  return out;
}

let refs = 0, files = 0;
for (const file of walk(ROOT)) {
  let text = fs.readFileSync(file, 'utf8');
  const before = text;
  for (const [bad, good] of Object.entries(SWAP)) {
    // Only swap the .webp product references, not the generated og/ jpgs
    text = text.split(bad).join(good);
  }
  if (text !== before) {
    const n = Object.keys(SWAP).reduce((a, b) => a + (before.split(b).length - 1), 0);
    refs += n; files++;
    fs.writeFileSync(file, text);
  }
}
console.log(`swapped ${refs} reference(s) across ${files} file(s)`);

// Quarantine the offending source files (and their generated og cards).
const quarantine = path.join(ROOT, 'assets', '_do-not-use');
fs.mkdirSync(quarantine, { recursive: true });
let moved = 0;
for (const bad of Object.keys(SWAP)) {
  const src = path.join(ROOT, 'assets', bad);
  if (fs.existsSync(src)) { fs.renameSync(src, path.join(quarantine, bad)); moved++; }
  const og = path.join(ROOT, 'assets', 'og', bad.replace('.webp', '.jpg'));
  if (fs.existsSync(og)) { fs.renameSync(og, path.join(quarantine, bad.replace('.webp', '.og.jpg'))); moved++; }
}
fs.writeFileSync(path.join(quarantine, 'README.md'),
  `# Do not use\n\nThese mockups carry other brands' packaging ("AQUA PEL", "RENEU Skincare")\n` +
  `and were being shown on the site as Zero Lines products. They are kept here only so the\n` +
  `swap is reversible. Replace with real Zero Lines product photography.\n`);
console.log(`quarantined ${moved} file(s) to assets/_do-not-use/`);

// Verify nothing still points at them
let left = 0;
for (const file of walk(ROOT)) {
  const t = fs.readFileSync(file, 'utf8');
  for (const bad of Object.keys(SWAP)) {
    if (t.includes(bad)) { console.log(`  ! still referenced in ${path.relative(ROOT, file)}: ${bad}`); left++; }
  }
}
console.log(left === 0 ? 'verified: no references to the off-brand images remain' : `${left} reference(s) remain`);
