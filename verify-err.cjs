const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('ERR', e.stack || e.message));
  page.on('console', msg => { if (msg.type()==='error') console.log('C', msg.text()); });
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
