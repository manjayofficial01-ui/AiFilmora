const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const firstRun = await page.evaluate(() => document.getElementById('firstRunModal')?.classList.contains('open'));
  await page.click('#frDemo');
  await page.waitForTimeout(300);

  const after = await page.evaluate(() => ({
    closed: !document.getElementById('firstRunModal')?.classList.contains('open'),
    assetsTab: !!document.querySelector('[data-sidebar="assets"]'),
    version: document.querySelector('.statusbar span')?.textContent,
    undoDisabled: document.getElementById('btnUndo')?.disabled,
  }));

  // do something to enable undo
  await page.locator('.tl-clip').first().click({ force: true });
  await page.click('#btnSplit');
  await page.waitForTimeout(200);
  const undoReady = await page.evaluate(() => ({
    canUndo: !document.getElementById('btnUndo')?.disabled,
    last: document.getElementById('statLastAction')?.textContent,
  }));

  await page.click('[data-sidebar="assets"]');
  await page.waitForTimeout(800);
  const assets = await page.evaluate(() => ({
    cards: document.querySelectorAll('#assetGrid .asset-card').length,
    status: document.getElementById('assetStatus')?.textContent,
  }));

  console.log(JSON.stringify({ firstRun, after, undoReady, assets, errors }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
