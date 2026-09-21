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

  const toolbar = await page.evaluate(() => {
    const ids = [...document.querySelector('.tl-toolbar').querySelectorAll('button')].map(b => b.id);
    return { ids, hasCrop: ids.includes('btnCrop'), hasAddTrack: ids.includes('btnAddTrack') };
  });
  const foot = await page.evaluate(() => ({
    foot: !!document.querySelector('.tl-labels-foot'),
    addV: !!document.querySelector('.tl-labels-foot #btnAddTrack'),
    addA: !!document.querySelector('.tl-labels-foot #btnAddAudioTrack'),
    tracksBefore: document.querySelectorAll('.tl-label').length,
  }));

  await page.click('.tl-labels-foot #btnAddTrack');
  await page.click('.tl-labels-foot #btnAddAudioTrack');
  await page.waitForTimeout(150);
  const tracksAfter = await page.evaluate(() => document.querySelectorAll('.tl-label').length);

  // crop
  await page.locator('.tl-clip[data-type="video"]').first().click({ force: true });
  await page.click('#btnCrop');
  await page.waitForTimeout(200);
  const cropUI = await page.evaluate(() => ({
    visible: document.querySelector('.crop-layer:not(.shape-edit-layer)')?.classList.contains('visible'),
    handles: document.querySelectorAll('#cropBox .crop-handle').length,
    btnActive: document.getElementById('btnCrop')?.classList.contains('active'),
  }));

  // drag se handle
  const se = page.locator('#cropBox > .crop-handle.h-se');
  const sb = await se.boundingBox();
  if (sb) {
    await page.mouse.move(sb.x + 5, sb.y + 5);
    await page.mouse.down();
    await page.mouse.move(sb.x - 80, sb.y - 40, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(150);
  }
  const cropAfter = await page.evaluate(() => {
    const b = document.getElementById('cropBox');
    return { w: b?.style.width, h: b?.style.height };
  });
  await page.click('#btnCropDone');
  await page.waitForTimeout(100);
  const closed = await page.evaluate(() => !document.querySelector('.crop-layer')?.classList.contains('visible'));

  console.log(JSON.stringify({ toolbar, foot, tracksAfter, cropUI, cropAfter, closed, errors }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
