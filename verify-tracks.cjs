const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); });
  await page.evaluate(() => localStorage.setItem('aifilmora.firstRun.v1', 'skip')); // first-run chooser dismissal (auto-patched)
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => {
    for (let i = 0; i < 8; i++) document.getElementById('btnAddTrack').click();
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => { document.querySelector('.tl-labels-body').scrollTop = 150; });
  await page.waitForTimeout(80);
  const s1 = await page.evaluate(() => ({
    l: document.querySelector('.tl-labels-body').scrollTop,
    s: document.querySelector('.tl-scroll').scrollTop,
  }));
  await page.evaluate(() => { document.querySelector('.tl-scroll').scrollTop = 80; });
  await page.waitForTimeout(80);
  const s2 = await page.evaluate(() => ({
    l: document.querySelector('.tl-labels-body').scrollTop,
    s: document.querySelector('.tl-scroll').scrollTop,
  }));
  console.log(JSON.stringify({ s1, s2 }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
