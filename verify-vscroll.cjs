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

  // add several video + audio tracks to force vertical overflow
  for (let i = 0; i < 5; i++) await page.click('#btnAddTrack');
  for (let i = 0; i < 4; i++) await page.click('#btnAddAudioTrack');
  await page.waitForTimeout(200);

  const before = await page.evaluate(() => {
    const sc = document.querySelector('.tl-scroll');
    return {
      clientH: sc.clientHeight,
      scrollH: sc.scrollHeight,
      canScrollY: sc.scrollHeight > sc.clientHeight + 1,
      trackCount: document.querySelectorAll('.tl-track').length,
      labelCount: document.querySelectorAll('.tl-label').length,
    };
  });

  // vertical wheel scroll
  const scBox = await page.locator('.tl-scroll').boundingBox();
  await page.mouse.move(scBox.x + scBox.width/2, scBox.y + scBox.height/2);
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(100);
  const afterScroll = await page.evaluate(() => {
    const sc = document.querySelector('.tl-scroll');
    const lb = document.querySelector('.tl-labels-body');
    return { scrollTop: sc.scrollTop, labelsTop: lb?.scrollTop, synced: Math.abs(sc.scrollTop - (lb?.scrollTop||0)) < 2 };
  });

  // drag first video clip down several tracks
  const clip = page.locator('.tl-clip[data-type="video"]').first();
  const cb = await clip.boundingBox();
  const startTrack = await page.evaluate(() => document.querySelector('.tl-clip[data-type="video"]')?.closest('.tl-track')?.dataset.trackId);
  await page.mouse.move(cb.x + 20, cb.y + cb.height/2);
  await page.mouse.down();
  // move down ~3 track heights
  await page.mouse.move(cb.x + 25, cb.y + cb.height/2 + 150, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const afterDrag = await page.evaluate(() => {
    const c = document.querySelector('.tl-clip[data-type="video"]');
    return { track: c?.closest('.tl-track')?.dataset.trackId, name: c?.querySelector('.label')?.textContent };
  });

  // drag back up
  const cb2 = await page.locator('.tl-clip[data-type="video"]').first().boundingBox();
  await page.mouse.move(cb2.x + 20, cb2.y + cb2.height/2);
  await page.mouse.down();
  await page.mouse.move(cb2.x + 25, cb2.y - 120, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const afterUp = await page.evaluate(() => {
    const c = document.querySelector('.tl-clip[data-type="video"]');
    return { track: c?.closest('.tl-track')?.dataset.trackId };
  });

  console.log(JSON.stringify({ before, afterScroll, startTrack, afterDrag, afterUp, errors }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
