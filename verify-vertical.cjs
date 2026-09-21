const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => localStorage.setItem('aifilmora.firstRun.v1', 'skip')); // first-run chooser dismissal (auto-patched)
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  // Full mouse drag audio A1 -> A2 with taller viewport
  const acb = await page.locator('.tl-clip[data-type="audio"]').first().boundingBox();
  const a2b = await page.locator('.tl-track[data-track-id="a2"]').boundingBox();
  await page.mouse.move(acb.x + 40, acb.y + acb.height/2);
  await page.mouse.down();
  await page.mouse.move(acb.x + 50, a2b.y + a2b.height/2, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(150);
  const audioTrack = await page.evaluate(() => document.querySelector('.tl-clip[data-type="audio"]')?.closest('.tl-track')?.dataset.trackId);

  // text-type: double-click Lower Third from media, then move on timeline
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => localStorage.setItem('aifilmora.firstRun.v1', 'skip')); // first-run chooser dismissal (auto-patched)
  // use keyboard Alt on video
  const vcb = await page.locator('.tl-clip[data-type="video"]').nth(1).boundingBox();
  await page.mouse.click(vcb.x + 15, vcb.y + vcb.height/2);
  await page.keyboard.press('Alt+ArrowUp');
  await page.waitForTimeout(100);
  const up = await page.evaluate(() => document.querySelector('.tl-clip.selected')?.closest('.tl-track')?.dataset.trackId);
  await page.keyboard.press('Alt+ArrowUp');
  await page.waitForTimeout(100);
  const up2 = await page.evaluate(() => document.querySelector('.tl-clip.selected')?.closest('.tl-track')?.dataset.trackId);
  await page.keyboard.press('Alt+ArrowDown');
  await page.waitForTimeout(100);
  const down = await page.evaluate(() => document.querySelector('.tl-clip.selected')?.closest('.tl-track')?.dataset.trackId);

  console.log(JSON.stringify({ audioTrack, up, up2, down, errors }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
