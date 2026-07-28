/* Re-encode assets/ at the width the layout actually uses.
 *
 * Every image on this site was generated at 2K–5K and shipped at that size,
 * regardless of the box it lands in. atmosphere-teal-gel-swatch.webp is 5376px
 * wide and 313 KB, and the widest box it ever occupies is 342 CSS px. On a phone
 * that is not just wasted bytes, it is wasted memory: the browser decodes the
 * full bitmap before it scales it down.
 *
 * Targets come from measuring the rendered box of every <img> on all 53 pages at
 * 1440 and 390, then doubling for retina — not from guessing. That measurement
 * lives in .claude/image-targets.json; regenerate it by re-running the perf
 * pass if the layout changes materially.
 *
 * Quality: q82 for photographs, q88 for the twelve product and carton renders.
 * Those have crisp synthetic edges against flat white, where q82 shows ringing
 * (worst-window SSIM 0.72); they are also small files already, so the stricter
 * setting costs almost nothing.
 *
 * Usage:  node .claude/reencode.js [--dry]
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const DRY = process.argv.includes('--dry');

const targets = JSON.parse(fs.readFileSync(path.join(__dirname, 'image-targets.json'), 'utf8'));

// Crisp synthetic edges on flat white — packaging renders. q82 rings on these.
const CRISP = /^(product-|box-|collection-|logo)/;

function dims(file) {
  const o = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file]).toString();
  return {
    w: +(o.match(/pixelWidth:\s*(\d+)/) || [])[1],
    h: +(o.match(/pixelHeight:\s*(\d+)/) || [])[1],
  };
}

let before = 0, after = 0, touched = 0, skipped = 0;
const rows = [];

for (const [name, want] of Object.entries(targets)) {
  const file = path.join(ASSETS, name);
  if (!fs.existsSync(file)) { skipped++; continue; }

  const size0 = fs.statSync(file).size;
  before += size0;

  // decode to PNG first: cwebp will not read webp input
  const tmp = path.join('/tmp', 'reenc-' + name.replace(/\W/g, '_') + '.png');
  try {
    execFileSync('dwebp', ['-quiet', file, '-o', tmp]);
  } catch {
    after += size0; skipped++; continue;
  }

  const nat = dims(tmp);
  const q = CRISP.test(name) ? 88 : 82;
  // never upscale, and never go below the target the layout needs
  const w = Math.min(nat.w, want);

  const out = path.join('/tmp', 'reenc-out-' + name.replace(/\W/g, '_') + '.webp');
  const args = ['-q', String(q), '-m', '6', '-quiet'];
  if (w < nat.w) args.push('-resize', String(w), '0');
  args.push(tmp, '-o', out);
  execFileSync('cwebp', args);

  const size1 = fs.statSync(out).size;

  // Only keep the re-encode if it is actually smaller. A file already tuned
  // tighter than this pass would be made worse by overwriting it.
  if (size1 < size0 * 0.97) {
    if (!DRY) fs.copyFileSync(out, file);
    after += size1;
    touched++;
    rows.push({ name, from: size0, to: size1, natW: nat.w, w, q });
  } else {
    after += size0;
    skipped++;
  }
  fs.unlinkSync(tmp); fs.unlinkSync(out);
}

rows.sort((a, b) => (b.from - b.to) - (a.from - a.to));
for (const r of rows.slice(0, 20)) {
  console.log(
    `  ${r.name.padEnd(40)} ${String(Math.round(r.from / 1024)).padStart(5)}KB -> ` +
    `${String(Math.round(r.to / 1024)).padStart(4)}KB   ${r.natW}px -> ${r.w}px  q${r.q}`
  );
}
if (rows.length > 20) console.log(`  … and ${rows.length - 20} more`);

const saved = before - after;
console.log(
  `\n${DRY ? '[dry run] ' : ''}re-encoded ${touched}, left alone ${skipped}` +
  `\n${(before / 1048576).toFixed(2)} MB -> ${(after / 1048576).toFixed(2)} MB ` +
  `(saved ${(saved / 1048576).toFixed(2)} MB, ${((saved / before) * 100).toFixed(0)}%)`
);
