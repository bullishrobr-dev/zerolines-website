/* Install a generated image into the site.
 *
 * Usage: node .claude/install-image.js <url> <asset-name-without-extension>
 *
 * Downloads, converts to WebP at web weight, writes assets/<name>.webp, and
 * regenerates the matching 1200x630 OG card so link previews stay correct.
 * Reports dimensions and file size so quality is verified rather than assumed.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const [url, name] = process.argv.slice(2);
if (!url || !name) {
  console.error('usage: node .claude/install-image.js <url> <name>');
  process.exit(1);
}

const tmp = path.join('/tmp', name + '-src.png');

function download(u, dest) {
  return new Promise((resolve, reject) => {
    https.get(u, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      const f = fs.createWriteStream(dest);
      res.pipe(f);
      f.on('finish', () => f.close(resolve));
    }).on('error', reject);
  });
}

function dims(file) {
  const o = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file]).toString();
  return {
    w: +(o.match(/pixelWidth:\s*(\d+)/) || [])[1],
    h: +(o.match(/pixelHeight:\s*(\d+)/) || [])[1],
  };
}

(async () => {
  await download(url, tmp);
  const src = dims(tmp);

  // cwebp, not sips. sips lists webp in --formats but can only READ it on this
  // macOS build; every write attempt fails regardless of formatOptions. cwebp is
  // Google's own encoder and gives better quality per byte anyway.
  // -q 82 is visually indistinguishable at these sizes; -m 6 is the slowest,
  // best-compressing method, which is the right trade for build-time assets.
  const out = path.join(ROOT, 'assets', name + '.webp');
  execFileSync('cwebp', ['-q', '82', '-m', '6', '-quiet', tmp, '-o', out]);

  const final = dims(out);
  const kb = Math.round(fs.statSync(out).size / 1024);
  console.log(`assets/${name}.webp  ${final.w}x${final.h}  ${kb}KB  (source ${src.w}x${src.h})`);

  // matching OG card, cover-cropped to exactly 1200x630
  const ogDir = path.join(ROOT, 'assets', 'og');
  fs.mkdirSync(ogDir, { recursive: true });
  const og = path.join(ogDir, name + '.jpg');
  const W = 1200, H = 630, AR = W / H;
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '82', tmp, '--out', og], { stdio: 'ignore' });
  if (src.w / src.h > AR) execFileSync('sips', ['--resampleHeight', String(H), og], { stdio: 'ignore' });
  else execFileSync('sips', ['--resampleWidth', String(W), og], { stdio: 'ignore' });
  execFileSync('sips', ['-c', String(H), String(W), og], { stdio: 'ignore' });
  const ogd = dims(og);
  console.log(`assets/og/${name}.jpg  ${ogd.w}x${ogd.h}`);

  fs.unlinkSync(tmp);
})().catch((e) => { console.error('failed:', e.message); process.exit(1); });
