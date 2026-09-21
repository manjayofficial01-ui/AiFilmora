const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('ERR', e.message));
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const s = window.__aifimoraStore;
    const id = s.get().tracks[0].id;
    const before = s.get().tracks.map(t => t.muted);
    const out = s.toggleTrackMute(id);
    const after = s.get().tracks.map(t => t.muted);
    const cls = document.querySelector('.tl-label')?.className;
    const btn = document.querySelector('[data-track-mute]');
    return { id, before, out, after, cls, btnHtml: btn?.outerHTML?.slice(0,80) };
  });
  console.log(JSON.stringify(r, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
