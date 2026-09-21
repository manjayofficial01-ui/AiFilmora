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
  await page.waitForTimeout(500);

  // Library Text tab
  await page.click('[data-sidebar="textpresets"]');
  const libPresets = await page.evaluate(() => document.querySelectorAll('#textPresetGrid .preset').length);
  const libActive = await page.evaluate(() => document.querySelector('[data-sidebar="textpresets"]')?.classList.contains('active'));

  // Inspector text has no presets grid
  await page.click('[data-inspector="textpanel"]');
  const inspHasPresets = await page.evaluate(() => !!document.querySelector('#insp-textpanel #textPresetGrid'));

  // Add title from library
  await page.click('#btnAddTitleFromLib');
  await page.waitForTimeout(300);

  // Double-click text clip
  await page.evaluate(() => {
    const els = [...document.querySelectorAll('.tl-clip[data-type="text"]')];
    els[els.length-1]?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  });
  await page.waitForTimeout(400);

  const noDouble = await page.evaluate(() => {
    const box = document.getElementById('canvasEditText')?.textContent;
    // count HELLO-like strings in DOM vs canvas-only one overlay
    return {
      overlayText: box,
      handles: document.querySelectorAll('.canvas-edit-handle').length,
      layer: document.querySelector('.canvas-edit-layer')?.classList.contains('visible'),
    };
  });

  // Undo: add another title then undo
  await page.click('[data-sidebar="textpresets"]');
  const clips0 = await page.evaluate(() => document.querySelectorAll('.tl-clip').length);
  await page.click('#btnAddTitleFromLib');
  await page.waitForTimeout(150);
  const clips1 = await page.evaluate(() => document.querySelectorAll('.tl-clip').length);
  await page.click('#btnUndo');
  await page.waitForTimeout(200);
  const clips2 = await page.evaluate(() => document.querySelectorAll('.tl-clip').length);
  await page.click('#btnRedo');
  await page.waitForTimeout(200);
  const clips3 = await page.evaluate(() => document.querySelectorAll('.tl-clip').length);

  // Clear FX
  await page.click('[data-inspector="fx"]');
  await page.click('.tl-clip[data-type="video"]');
  await page.waitForTimeout(100);
  await page.click('#btnClearFx');
  await page.waitForTimeout(100);

  // Clear anim
  await page.click('[data-inspector="textpanel"]');
  await page.click('#btnClearAnim');
  await page.waitForTimeout(100);

  // 8 handles present
  const handleDirs = await page.evaluate(() => [...document.querySelectorAll('.canvas-edit-handle')].map(h => h.dataset.dir));

  await page.screenshot({ path: 'D:/000000 Lab/AiFimora/output-final.png' });
  console.log(JSON.stringify({
    libPresets, libActive, inspHasPresets, noDouble,
    undo: { clips0, clips1, clips2, clips3 },
    handleDirs, errors
  }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
