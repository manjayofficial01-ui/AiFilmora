const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
  // Native confirm()/prompt() (new project, rename, etc.) otherwise leave a
  // dialog hanging and the run dies at teardown with "Not attached to an
  // active page". Accept and record instead.
  const dialogs = [];
  page.on('dialog', async (d) => { dialogs.push(d.type() + ': ' + d.message().slice(0, 60)); await d.accept('1'); });
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => localStorage.setItem('aifilmora.firstRun.v1', 'skip')); // first-run chooser dismissal (auto-patched)
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  // create title at t=2 via form
  await page.click('[data-inspector="textpanel"]');
  await page.evaluate(() => { window.__aifimoraPlayhead = 2; });
  // seek via keyboard end/home then click ruler
  await page.click('.tl-ruler', { position: { x: 90, y: 8 } });
  await page.waitForTimeout(100);
  await page.fill('#textContent', 'Hello Canvas');
  await page.click('#btnAddTitle');
  await page.waitForTimeout(200);

  const clipId = await page.evaluate(() => {
    const s = [...document.querySelectorAll('.tl-clip[data-type="text"]')];
    return s[s.length-1]?.dataset.clipId;
  });

  await page.evaluate((id) => {
    const el = document.querySelector(`.tl-clip[data-clip-id="${id}"]`);
    el?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  }, clipId);
  await page.waitForTimeout(400);

  const state = await page.evaluate(() => ({
    layerVisible: document.querySelector('.canvas-edit-layer')?.classList.contains('visible'),
    boxText: document.getElementById('canvasEditText')?.textContent,
    textPanel: document.querySelector('[data-inspector="textpanel"]')?.classList.contains('active'),
    timecode: document.getElementById('timecode')?.textContent,
  }));

  const box = page.locator('#canvasEditBox');
  const bb = await box.boundingBox().catch(() => null);
  const posBefore = await page.evaluate(() => ({
    l: document.getElementById('canvasEditBox')?.style.left,
    t: document.getElementById('canvasEditBox')?.style.top,
  }));
  if (bb) {
    await page.mouse.move(bb.x + bb.width/2, bb.y + bb.height/2);
    await page.mouse.down();
    await page.mouse.move(bb.x + bb.width/2 + 60, bb.y + 25, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(200);
  }
  const posAfter = await page.evaluate(() => ({
    l: document.getElementById('canvasEditBox')?.style.left,
    t: document.getElementById('canvasEditBox')?.style.top,
  }));

  // resize via handle
  if (bb) {
    const h = await page.locator('.canvas-edit-handle.h-se').boundingBox();
    if (h) {
      await page.mouse.move(h.x + 5, h.y + 5);
      await page.mouse.down();
      await page.mouse.move(h.x + 5, h.y + 40, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(150);
    }
  }
  const sizeAfter = await page.evaluate(() => document.getElementById('canvasEditBox')?.style.fontSize);

  await box.dblclick({ force: true });
  await page.waitForTimeout(100);
  const editing = await page.evaluate(() => document.getElementById('canvasEditText')?.contentEditable);
  await page.evaluate(() => {
    const t = document.getElementById('canvasEditText');
    t.textContent = 'Edited On Canvas';
    t.dispatchEvent(new FocusEvent('blur'));
  });
  await page.waitForTimeout(250);
  const afterEdit = await page.evaluate(() => document.getElementById('canvasEditText')?.textContent);

  await page.locator('.tl-clip[data-type="video"]').first().click({ force: true });
  await page.waitForTimeout(100);
  await page.locator('.tl-clip[data-type="video"]').first().dblclick({ force: true });
  await page.waitForTimeout(250);
  const fxActive = await page.evaluate(() => document.querySelector('[data-inspector="fx"]')?.classList.contains('active'));

  await page.screenshot({ path: 'D:/000000 Lab/AiFimora/output-canvas-edit.png' });
  console.log(JSON.stringify({ state, posBefore, posAfter, sizeAfter, editing, afterEdit, fxActive, errors, dialogs }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
