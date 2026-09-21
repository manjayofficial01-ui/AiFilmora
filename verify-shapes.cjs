const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => localStorage.setItem('aifilmora.firstRun.v1', 'skip')); // first-run chooser dismissal (auto-patched)
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.click('[data-sidebar="shapes"]');
  await page.waitForTimeout(400);
  const info = await page.evaluate(() => ({
    built: document.querySelectorAll('#shapeGrid .preset').length,
    cats: document.querySelectorAll('#shapeCats .chip').length,
    hasImport: !!document.getElementById('btnImportShapes'),
    hasStrokeStyle: !!document.getElementById('shapeStrokeStyle'),
  }));
  await page.click('[data-shape-cat="badge"]');
  await page.waitForTimeout(100);
  const badge = await page.evaluate(() => document.querySelectorAll('#shapeGrid .preset').length);
  await page.click('[data-shape-cat="user"]');
  await page.waitForTimeout(100);
  const user = await page.evaluate(() => document.querySelectorAll('#shapeGrid .preset').length);
  console.log(JSON.stringify({ info, badge, user, errors }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
