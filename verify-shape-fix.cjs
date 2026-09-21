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
  await page.waitForTimeout(400);

  await page.click('[data-sidebar="shapes"]');
  await page.waitForTimeout(150);

  // click Ellipse, Star, Heart
  const labels = await page.evaluate(() => [...document.querySelectorAll('#shapeGrid .preset strong')].map(e => e.textContent));
  async function addByLabel(label) {
    await page.evaluate((lab) => {
      const cards = [...document.querySelectorAll('#shapeGrid .preset')];
      const card = cards.find(c => c.querySelector('strong')?.textContent === lab);
      card?.click();
    }, label);
    await page.waitForTimeout(200);
  }
  await addByLabel('Ellipse');
  await addByLabel('Star');
  await addByLabel('Heart');

  const shapes = await page.evaluate(() => window.__aifimoraStore.get().clips.filter(c => c.shape).map(c => ({
    name: c.name,
    type: c.shape.type,
    kind: c.shape.kind,
    start: c.start,
    sx: c.shape.sx,
    sy: c.shape.sy,
  })));

  // double-click last (heart) and resize se (corner) then e (side)
  await page.evaluate(() => {
    const shapes = window.__aifimoraStore.get().clips.filter(c => c.shape);
    const last = shapes[shapes.length-1];
    window.__aifimoraStore.set({ selectedClipId: last.id });
  });
  // seek into clip
  await page.evaluate(() => {
    const shapes = window.__aifimoraStore.get().clips.filter(c => c.shape);
    const last = shapes[shapes.length-1];
    window.__aifimoraPlayhead = last.start + 0.5;
    window.dispatchEvent(new CustomEvent('aifimora:playhead', { detail: { time: last.start + 0.5 }}));
  });
  await page.waitForTimeout(200);

  const box = page.locator('#shapeEditBox');
  const bb = await box.boundingBox();
  const se = page.locator('#shapeEditBox .h-se');
  const seb = await se.boundingBox();
  await page.mouse.move(seb.x+4, seb.y+4);
  await page.mouse.down();
  await page.mouse.move(seb.x+4+40, seb.y+4+20, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const afterCorner = await page.evaluate(() => {
    const c = window.__aifimoraStore.getClip(window.__aifimoraStore.get().selectedClipId);
    return { sx: c.shape.sx, sy: c.shape.sy, ratio: (c.shape.sx/c.shape.sy).toFixed(3) };
  });

  const eH = page.locator('#shapeEditBox .h-e');
  const eb = await eH.boundingBox();
  await page.mouse.move(eb.x+4, eb.y+eb.height/2);
  await page.mouse.down();
  await page.mouse.move(eb.x+4+50, eb.y+eb.height/2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const afterSide = await page.evaluate(() => {
    const c = window.__aifimoraStore.getClip(window.__aifimoraStore.get().selectedClipId);
    return { sx: c.shape.sx, sy: c.shape.sy, ratio: (c.shape.sx/c.shape.sy).toFixed(3) };
  });

  console.log(JSON.stringify({ labels: labels.slice(0,8), shapes, afterCorner, afterSide, errors }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
