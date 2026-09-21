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
  const info = await page.evaluate(() => {
    const body = document.querySelector('.tl-body');
    const scroll = document.querySelector('.tl-scroll');
    const labels = document.querySelector('.tl-track-labels');
    const br = body.getBoundingClientRect();
    const sr = scroll.getBoundingClientRect();
    const lr = labels.getBoundingClientRect();
    return {
      bodyScrollW: body.scrollWidth,
      bodyClientW: body.clientWidth,
      bodyOverflowX: getComputedStyle(body).overflowX,
      scrollOverflowX: getComputedStyle(scroll).overflowX,
      scrollClientW: scroll.clientWidth,
      scrollScrollW: scroll.scrollWidth,
      labelsW: Math.round(lr.width),
      labelsClientW: labels.clientWidth,
      labelsScrollW: labels.scrollWidth,
      labelsOverflow: getComputedStyle(labels).overflow,
      // scrollbar under labels?
      bodyHasHScroll: body.scrollWidth > body.clientWidth + 1,
      scrollHasHScroll: scroll.scrollWidth > scroll.clientWidth + 1,
      clips: document.querySelectorAll('.tl-clip').length,
    };
  });
  console.log(JSON.stringify({ info, errors }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
