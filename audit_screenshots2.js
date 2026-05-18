const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:8888/#/products/peeling-gel', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: '/Users/metabt/Desktop/ZLweb_audit_product-detail2_top.png', fullPage: false });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/Users/metabt/Desktop/ZLweb_audit_product-detail2_mid.png', fullPage: false });

  await page.goto('http://localhost:8888/#/products', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  const cartBtn = await page.locator('button[aria-label="Cart"]').first();
  if (cartBtn) {
    await cartBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: '/Users/metabt/Desktop/ZLweb_audit_cart_drawer2.png', fullPage: false });
  }

  await browser.close();
  console.log('Done');
})();
