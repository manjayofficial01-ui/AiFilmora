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
  await page.waitForTimeout(600);

  const theme = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  const trackBtns = await page.evaluate(() => {
    const foot = document.querySelector('.tl-labels-foot');
    return {
      hasCol: foot?.classList.contains('track-add-col'),
      labels: [...foot.querySelectorAll('.ta-icon')].map(e => e.textContent),
      stacked: (() => {
        const a = foot.querySelector('#btnAddTrack')?.getBoundingClientRect();
        const b = foot.querySelector('#btnAddAudioTrack')?.getBoundingClientRect();
        return a && b && b.top >= a.bottom - 2;
      })(),
    };
  });

  await page.click('[data-sidebar="shapes"]');
  const shapes = await page.evaluate(() => document.querySelectorAll('#shapeGrid .preset').length);
  await page.locator('#shapeGrid .preset').first().click();
  await page.waitForTimeout(200);
  const shapeClip = await page.evaluate(() => document.querySelectorAll('.tl-clip').length);

  await page.click('[data-sidebar="transitions"]');
  await page.waitForTimeout(300);
  const trans = await page.evaluate(() => ({
    builtIn: document.querySelectorAll('#transGrid .preset').length,
    custom: document.querySelectorAll('#customTransGrid .preset').length,
    preview: !!document.getElementById('transPreviewCanvas'),
    importBtn: !!document.getElementById('btnImportTransitions'),
  }));

  await page.locator('#transGrid .preset').first().hover();
  await page.waitForTimeout(200);
  const previewLabel = await page.evaluate(() => document.getElementById('transPreviewLabel')?.textContent);

  console.log(JSON.stringify({ theme, trackBtns, shapes, shapeClip, trans, previewLabel, errors }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
