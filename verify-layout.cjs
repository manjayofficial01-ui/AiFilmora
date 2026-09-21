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
  const status = await page.evaluate(() => ({
    clips: document.getElementById('statClips')?.textContent,
    credits: document.getElementById('statCredits')?.textContent,
    tlClips: document.querySelectorAll('.tl-clip').length,
    canvas: (() => { const c = document.getElementById('previewCanvas'); const r = c.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), ratio: (r.width/r.height).toFixed(3) }; })(),
    overlap: (() => {
      const c = document.getElementById('previewCanvas').getBoundingClientRect();
      const i = document.querySelector('.inspector').getBoundingClientRect();
      return c.right > i.left + 2;
    })(),
  }));
  console.log(JSON.stringify({ status, errors }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
