const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => localStorage.setItem('aifilmora.firstRun.v1', 'skip')); // first-run chooser dismissal (auto-patched)
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  // Trim buttons next to Split
  const order = await page.evaluate(() => {
    const ids = [...document.querySelector('.tl-toolbar').querySelectorAll('button')].map(b => b.id);
    return { split: ids.indexOf('btnSplit'), trimS: ids.indexOf('btnTrimStart'), trimE: ids.indexOf('btnTrimEnd') };
  });

  // select clip, seek mid, trim end
  await page.locator('.tl-clip[data-type="video"]').first().click({ force: true });
  const ruler = await page.locator('.tl-ruler').boundingBox();
  await page.mouse.click(ruler.x + 50, ruler.y + 8);
  await page.waitForTimeout(100);
  const wBefore = await page.evaluate(() => document.querySelector('.tl-clip')?.style.width);
  await page.click('#btnTrimEnd');
  await page.waitForTimeout(200);
  const wAfter = await page.evaluate(() => document.querySelector('.tl-clip')?.style.width);

  // player volume
  const hasVol = await page.evaluate(() => !!document.getElementById('masterVolume'));
  await page.fill('#masterVolume', '40');
  await page.waitForTimeout(50);
  const volOut = await page.evaluate(() => document.getElementById('masterVolumeOut')?.textContent);
  await page.click('#btnPlayerMute');
  await page.waitForTimeout(50);
  const mutedOut = await page.evaluate(() => document.getElementById('masterVolumeOut')?.textContent);

  // Volume tab
  await page.click('[data-inspector="volume"]');
  await page.locator('.tl-clip[data-type="video"]').first().click({ force: true });
  await page.click('[data-inspector="volume"]');
  await page.click('#insp-volume [data-vol="50"]');
  await page.waitForTimeout(200);
  const volUI = await page.evaluate(() => ({
    label: document.getElementById('volumeClipLabel')?.textContent,
    out: document.getElementById('clipVolumeOut')?.textContent,
    sub: document.querySelector('.tl-clip .sub')?.textContent,
  }));

  await page.fill('#volFadeIn', '1.5');
  await page.dispatchEvent('#volFadeIn', 'change');
  await page.waitForTimeout(100);

  console.log(JSON.stringify({ order, wBefore, wAfter, hasVol, volOut, mutedOut, volUI, errors }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
