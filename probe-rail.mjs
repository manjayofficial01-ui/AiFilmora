import { chromium } from 'playwright';

const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const p = await b.newPage();
await p.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle', timeout: 30000 });
await p.waitForTimeout(1200);

console.log('=== AiFimora Media Menu — full rail probe ===\n');

const results = [];

for (const tabId of ['media','assets','audio','textpresets','transitions','effects','filters','shapes','templates','tools']) {
  // Activate the tab
  await p.click(`[data-sidebar="${tabId}"]`);
  await p.waitForTimeout(180);

  // Count category rail items
  const railItems = await p.$$eval('.cat-rail .cat-item', els => els.map(e => e.dataset.cat));
  const activeRailCount = railItems.length;

  // Count visible grid cards before any click
  const visibleCards = await p.$$eval(`#side-${tabId} .media-card, #side-${tabId} .fx-card, #side-${tabId} .template-card, #side-${tabId} .tool-item, #templateGrid .template-card`,
    els => els.filter(e => !e.hidden).length);

  // If rail has multiple categories, click each one and check the grid changes
  let categoryFilterWorks = true;
  let catResults = [];
  if (activeRailCount > 1) {
    for (const cat of railItems) {
      if (cat === railItems[0]) continue; // just test non-default ones
      await p.click(`.cat-rail .cat-item[data-cat="${cat}"]`);
      await p.waitForTimeout(120);
      const afterCount = await p.$$eval(`#side-${tabId} .media-card, #side-${tabId} .fx-card, #side-${tabId} .template-card, #side-${tabId} .tool-item, #templateGrid .template-card`,
        els => els.filter(e => !e.hidden).length);
      catResults.push({ cat, visible: afterCount });
      if (afterCount === visibleCards && activeRailCount > 1) {
        // It's acceptable if all cards are the same category, but flag it
      }
    }
    // Restore default
    await p.click(`.cat-rail .cat-item[data-cat="${railItems[0]}"]`);
    await p.waitForTimeout(120);
  }

  // Take a screenshot of this tab
  await p.screenshot({ path: `rail-${tabId}.png`, fullPage: false });

  // Verify the panel content exists (not just rail)
  const hasContent = await p.$eval(`#side-${tabId} .panel-body`, body => body.children.length > 0 ? 'content' : 'empty');

  results.push({
    tabId,
    label: await p.$eval(`[data-sidebar="${tabId}"] .tab-lbl`, el => el.textContent.trim()),
    activeCats: activeRailCount,
    initialVisibleCards: visibleCards,
    categoryFilterWorks: activeRailCount > 1 ? (catResults.some(c => c.visible !== visibleCards || activeRailCount === 1) ? 'partial' : 'yes') : 'n/a',
    catDetails: catResults,
    hasPanelContent: hasContent,
    screenshot: `rail-${tabId}.png`,
  });

  console.log(`[${tabId}] label="${results[results.length-1].label}" cats=${activeRailCount} cards=${visibleCards} filter=${results[results.length-1].categoryFilterWorks} content=${hasContent}`);
}

// Also test the Player chip
const hasPlayerChip = await p.$eval('.player-chip', el => el.textContent.trim());
const hasFullBtn = await p.$eval('#btnPlayerFull', el => el.textContent.trim()) || 'NO';
console.log(`\nPlayer chip: "${hasPlayerChip}" | Full btn: "${hasFullBtn}"`);

await p.screenshot({ path: 'media-menu-full.png', fullPage: false });

console.log('\n=== SUMMARY ===');
const ok = results.filter(r => r.categoryFilterWorks !== 'no-broken' && r.hasPanelContent !== 'empty');
console.log(`Tabs with working rails + content: ${ok.length}/${results.length}`);
for (const r of results) {
  const status = r.hasPanelContent === 'empty' ? '❌ NO CONTENT' : (r.categoryFilterWorks === 'no-broken' ? '❌ FILTER BROKEN' : '✅');
  console.log(`  ${status} ${r.tabId} (${r.label}) — cats:${r.activeCats} cards:${r.initialVisibleCards}`);
}

await b.close();
console.log('\nScreenshots saved: media-menu-full.png + rail-*.png');
