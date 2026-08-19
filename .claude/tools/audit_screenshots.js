const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const routes = [
    { name: 'homepage', path: 'http://localhost:8888/' },
    { name: 'science', path: 'http://localhost:8888/#/science' },
    { name: 'protocol', path: 'http://localhost:8888/#/protocol' },
    { name: 'products', path: 'http://localhost:8888/#/products' },
    { name: 'product-detail', path: 'http://localhost:8888/#/products/precision-collagen-activation-syringe' },
    { name: 'story', path: 'http://localhost:8888/#/story' },
    { name: 'testimonials', path: 'http://localhost:8888/#/testimonials' },
    { name: 'contact', path: 'http://localhost:8888/#/contact' },
  ];

  for (const r of routes) {
    await page.goto(r.path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `/Users/metabt/Desktop/ZLweb_audit_${r.name}_top.png`, fullPage: false });
    // Scroll to bottom for scroll-triggered animations
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `/Users/metabt/Desktop/ZLweb_audit_${r.name}_mid.png`, fullPage: false });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `/Users/metabt/Desktop/ZLweb_audit_${r.name}_bottom.png`, fullPage: false });
    console.log('Done:', r.name);
  }

  // Hover on product card
  await page.goto('http://localhost:8888/#/products', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const card = await page.locator('.prod-card').first();
  if (card) {
    await card.hover();
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/Users/metabt/Desktop/ZLweb_audit_products_hover.png', fullPage: false });
  }

  // Open cart drawer
  await page.goto('http://localhost:8888/#/products', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const cartBtn = await page.locator('button[aria-label="Cart"]').first();
  if (cartBtn) {
    await cartBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: '/Users/metabt/Desktop/ZLweb_audit_cart_drawer.png', fullPage: false });
  }

  await browser.close();
  console.log('All screenshots done');
})();
