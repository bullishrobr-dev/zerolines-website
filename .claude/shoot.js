/* Screenshot the site at desktop and mobile widths for visual QA.
 * Usage: node .claude/shoot.js [url-path ...]
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = path.resolve(__dirname, 'shots');
const BASE = 'http://localhost:8420';
const paths = process.argv.slice(2).length ? process.argv.slice(2) : ['/'];

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  for (const p of paths) {
    const slug = p.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home';

    for (const [label, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
      const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
      const failed = [];
      page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });

      await page.goto(BASE + p, { waitUntil: 'networkidle' });

      // Walk the whole page so loading="lazy" images actually fetch and every
      // scroll-reveal fires; otherwise a fullPage shot captures unloaded media
      // and reports false "broken image" hits.
      await page.evaluate(async () => {
        const step = window.innerHeight * 0.8;
        for (let y = 0; y < document.body.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 120));
        }
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise((r) => setTimeout(r, 400));
      });
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(900);

      await page.screenshot({ path: path.join(OUT, `${slug}-${label}.png`), fullPage: true });

      const stats = await page.evaluate(() => ({
        height: document.body.scrollHeight,
        invisible: [...document.querySelectorAll('body *')].filter((e) => {
          const c = getComputedStyle(e);
          return c.opacity === '0' && c.display !== 'none' && e.offsetHeight > 0;
        }).length,
        brokenImgs: [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.currentSrc || i.src),
      }));

      console.log(`${p} [${label}] h=${stats.height} invisible=${stats.invisible} brokenImgs=${stats.brokenImgs.length}${stats.brokenImgs.length ? ' -> ' + stats.brokenImgs.join(', ') : ''}`);
      if (failed.length) console.log(`   HTTP failures: ${failed.join(', ')}`);
      if (errors.length) console.log(`   console errors: ${errors.slice(0, 4).join(' | ')}`);

      await ctx.close();
    }
  }

  await browser.close();
  console.log(`\nshots in ${OUT}`);
})();
