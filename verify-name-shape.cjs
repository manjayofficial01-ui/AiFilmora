const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('ERR', e.message));
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => localStorage.setItem('aifilmora.firstRun.v1', 'skip')); // first-run chooser dismissal (auto-patched)
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.click('[data-sidebar="shapes"]');
  await page.locator('#shapeGrid .preset').first().click();
  await page.waitForTimeout(200);
  const r = await page.evaluate(() => {
    const s = window.__aifimoraStore;
    const clips = s.get().clips.filter(c => c.shape);
    const id = s.get().selectedClipId;
    const sel = s.getClip(id);
    const overlay = document.querySelector('.shape-edit-layer');
    return {
      shapeClips: clips.map(c => ({ id: c.id, shape: !!c.shape, kind: c.shape?.kind, start: c.start })),
      selected: { id, hasShape: !!sel?.shape, type: sel?.type },
      playhead: window.__aifimoraPlayhead,
      overlay: !!overlay,
      overlayClass: overlay?.className,
      visible: overlay?.classList.contains('visible'),
    };
  });
  console.log(JSON.stringify(r, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
