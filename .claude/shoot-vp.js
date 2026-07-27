/* Viewport-sized (not fullPage) screenshots at given scroll offsets.
 * Usage: node .claude/shoot-vp.js <path> <preset> [scrollY ...]
 *   preset: mobile | desktop
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(__dirname, 'shots');
const BASE = 'http://localhost:8420';
const [urlPath = '/', preset = 'mobile', ...offsets] = process.argv.slice(2);
const VP = preset === 'desktop' ? { width: 1440, height: 900 } : { width: 390, height: 844 };
const ys = offsets.length ? offsets.map(Number) : [0];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: VP, deviceScaleFactor: 2, isMobile: preset === 'mobile', hasTouch: preset === 'mobile' });
  const page = await ctx.newPage();
  await page.goto(BASE + urlPath, { waitUntil: 'networkidle' });

  // prime lazy media + reveals
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 100));
    }
  });
  await page.waitForLoadState('networkidle');

  const slug = urlPath.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home';
  for (const y of ys) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(700);
    const f = path.join(OUT, `${slug}-${preset}-y${y}.png`);
    await page.screenshot({ path: f });
    console.log('wrote', path.relative(process.cwd(), f));
  }

  await browser.close();
})();
