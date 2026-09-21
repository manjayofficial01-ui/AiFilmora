import { chromium } from 'playwright';

const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.addInitScript(() => {
  try { localStorage.clear(); localStorage.setItem('aifilmora.firstRun.v1', 'skip'); } catch (e) {}
});
await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(1500);

await p.screenshot({ path: 'media-menu-current.png', fullPage: false });

const tabs = ['media','assets','audio','textpresets','transitions','effects','filters','shapes','tools','templates'];

console.log('=== AiFimora Media Menu — current state ===\n');

for (const tabId of tabs) {
  await p.click(`[data-sidebar="${tabId}"]`);
  await p.waitForTimeout(150);
  const cats = await p.$$eval(`#side-${tabId} .cat-rail .cat-item`, els =>
    els.map(e => ({ id: e.dataset.cat, label: (e.querySelector('.cat-lbl')?.textContent||'').trim(), count: (e.querySelector('.cat-count')?.textContent||'').trim() }))
  );
  const label = await p.$eval(`[data-sidebar="${tabId}"] .tab-lbl`, el => el.textContent.trim()).catch(() => '?');
  const cards = await p.$$eval(`#side-${tabId} .media-card, #side-${tabId} .fx-card, #side-${tabId} .library-asset-card, #side-${tabId} .preset-card, #side-${tabId} .transition-card, #side-${tabId} .template-card, #side-${tabId} .tool-item, #templateGrid .template-card`, els => els.filter(e => e.offsetParent !== null && !e.closest('.cat-rail') && !e.closest('.panel-header') && !e.closest('[hidden]')).length).catch(() => 0);
  console.log(`[${tabId}] "${label}" | cats:[${cats.map(c=>c.id+':'+c.count).join(',')}] | visible-items:${cards}`);
  await p.screenshot({ path: `rail-${tabId}.png`, fullPage: false });
}

await p.screenshot({ path: 'media-menu-full.png', fullPage: false });
console.log('\nScreenshots saved: media-menu-current.png, media-menu-full.png, rail-*.png');

await b.close();
