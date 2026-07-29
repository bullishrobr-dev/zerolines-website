/* Crawl the site the way a visitor does: land on a page, click each nav link,
 * record where you actually end up. Catches dead ends and pages that bounce you
 * somewhere unexpected.
 */
const { chromium } = require('playwright');
const BASE = 'http://localhost:8420';

const START = ['/', '/science', '/story', '/protocol', '/testimonials', '/contact',
  '/products', '/products/day-cream', '/blog/', '/analyser/', '/faq.html'];

(async () => {
  const browser = await chromium.launch();

  for (const start of START) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    try {
      await page.goto(BASE + start, { waitUntil: 'networkidle', timeout: 15000 });
    } catch (e) {
      console.log(`${start}  ->  LOAD FAILED: ${e.message.split('\n')[0]}`);
      await ctx.close();
      continue;
    }
    await page.waitForTimeout(1800);

    const landed = page.url().replace(BASE, '') || '/';
    const bounced = landed.replace(/\/$/, '') !== start.replace(/\/$/, '');
    console.log(`\n=== ${start}${bounced ? `   ⚠ BOUNCED TO ${landed}` : ''}`);

    // collect visible nav-ish links
    const links = await page.evaluate(() => {
      const out = [];
      const seen = new Set();
      document.querySelectorAll('header a[href], nav a[href]').forEach((a) => {
        const r = a.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const txt = (a.textContent || '').trim().slice(0, 22);
        const href = a.getAttribute('href');
        if (!txt || seen.has(txt + href)) return;
        seen.add(txt + href);
        out.push({ txt, href });
      });
      return out.slice(0, 10);
    });

    if (!links.length) { console.log('   (no visible header/nav links found)'); }

    for (const { txt, href } of links) {
      if (/^(https?:|mailto:|tel:)/.test(href)) continue;
      const p2 = await ctx.newPage();
      try {
        await p2.goto(BASE + start, { waitUntil: 'domcontentloaded', timeout: 12000 });
        await p2.waitForTimeout(1200);
        await p2.click(`header a:has-text("${txt}"), nav a:has-text("${txt}")`, { timeout: 5000 });
        await p2.waitForTimeout(1800);
        const dest = p2.url().replace(BASE, '') || '/';
        const expected = href.startsWith('/') ? href : null;
        const odd = expected && dest.replace(/\/$/, '') !== expected.replace(/\/$/, '');
        console.log(`   "${txt}" [${href}]  ->  ${dest}${odd ? '   ⚠ NOT WHERE THE LINK POINTS' : ''}`);
      } catch (e) {
        console.log(`   "${txt}" [${href}]  ->  CLICK FAILED`);
      }
      await p2.close();
    }
    await ctx.close();
  }

  await browser.close();
})();
