/* Regenerate OG cards with a proper cover-crop.
 *
 * First attempt used `sips --resampleHeightWidthMax 1400` then `sips -c 630 1200`.
 * sips -c PADS to the target box rather than cropping to fill, so portrait
 * sources came out letterboxed with black bars down both sides.
 *
 * Correct cover behaviour: scale along whichever axis is the binding constraint
 * so the image fully covers 1200x630, THEN centre-crop to exactly that size.
 *   source wider than 1.905:1  -> scale to height 630, crop width
 *   source narrower            -> scale to width 1200, crop height
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OG_DIR = path.join(ROOT, 'assets', 'og');
const W = 1200, H = 630, AR = W / H;

function dims(file) {
  const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file]).toString();
  return {
    w: +(out.match(/pixelWidth:\s*(\d+)/) || [])[1],
    h: +(out.match(/pixelHeight:\s*(\d+)/) || [])[1],
  };
}

const targets = fs.readdirSync(OG_DIR).filter((f) => f.endsWith('.jpg'));
let done = 0, failed = [];

for (const name of targets) {
  const base = name.replace(/\.jpg$/, '');
  const src = ['webp', 'png', 'jpg']
    .map((ext) => path.join(ROOT, 'assets', `${base}.${ext}`))
    .find(fs.existsSync);
  if (!src) { failed.push(`${base} (no source)`); continue; }

  const out = path.join(OG_DIR, name);
  try {
    const { w, h } = dims(src);
    if (!w || !h) throw new Error('could not read dimensions');

    // convert to jpeg at full size first
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', src, '--out', out], { stdio: 'ignore' });

    // scale to COVER the 1200x630 frame
    if (w / h > AR) execFileSync('sips', ['--resampleHeight', String(H), out], { stdio: 'ignore' });
    else            execFileSync('sips', ['--resampleWidth', String(W), out], { stdio: 'ignore' });

    // centre-crop to exact card size (no padding now that we cover)
    execFileSync('sips', ['-c', String(H), String(W), out], { stdio: 'ignore' });

    const fin = dims(out);
    if (fin.w !== W || fin.h !== H) throw new Error(`got ${fin.w}x${fin.h}`);
    done++;
  } catch (err) {
    failed.push(`${base} (${err.message.split('\n')[0]})`);
  }
}

console.log(`regenerated ${done}/${targets.length} og cards at ${W}x${H} (cover-cropped)`);
if (failed.length) console.log('failed: ' + failed.join(', '));
