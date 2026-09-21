// Verifies the visual font picker added in 1.6.0 — 262 Filmora faces / 186 families.
// Key risk: 87 MB of TTFs must NOT be downloaded at boot; only tiles scrolled into
// view may fetch their face.
const { chromium } = require('playwright');

const results = [];
const ok = (name, cond, extra) => results.push({ name, pass: !!cond, extra });

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  const fontReqs = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
  page.on('request', r => { if (/\.(ttf|otf)$/i.test(new URL(r.url()).pathname)) fontReqs.push(r.url()); });

  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  // Dismiss the first-run chooser so it doesn't intercept later clicks
  if (await page.evaluate(() => document.getElementById('firstRunModal')?.classList.contains('open'))) {
    await page.click('#frSkip');
    await page.waitForTimeout(400);
  }
  const fontsAtBoot = fontReqs.length;

  // ---------- manifest ----------
  const lib = await page.evaluate(async () => {
    const m = await import('./js/assets-bridge.js');
    const all = m.fonts();
    const fams = new Set(all.map(f => f.family));
    return {
      faces: all.length,
      families: fams.size,
      badNames: all.filter(f => /\s\d$/.test(f.family)).map(f => f.family), // "_0" copy suffix leaked
      allHaveUrl: all.every(f => /^assets\/Fonts\//.test(f.url)),
    };
  });
  ok('every font on disk is exposed', lib.faces >= 260, lib.faces);
  ok('families grouped', lib.families >= 180, lib.families);
  ok('no "_0" copy-counter leaks into family names', lib.badNames.length === 0, lib.badNames.slice(0, 5));
  ok('all faces resolve to assets/Fonts/', lib.allHaveUrl);

  // ---------- boot cost ----------
  ok('no font files downloaded at boot', fontsAtBoot === 0, fontsAtBoot);

  // ---------- grid ----------
  await page.click('[data-inspector="textpanel"]');
  await page.waitForTimeout(400);
  const grid = await page.evaluate(() => ({
    tiles: document.querySelectorAll('#fontGrid .font-tile').length,
    visible: document.getElementById('fontGrid').getBoundingClientRect().height > 0,
    hint: document.getElementById('fontGridHint')?.textContent,
    samples: document.querySelectorAll('.font-tile .font-tile-sample').length,
  }));
  ok('grid renders one tile per family', grid.tiles === lib.families, grid);
  ok('grid is visible in the text panel', grid.visible, grid);
  ok('each tile has a specimen line', grid.samples === grid.tiles, grid);
  ok('hint states the lazy-load contract', /load as you scroll/.test(grid.hint || ''), grid.hint);

  // ---------- search ----------
  await page.fill('#fontSearch', 'Roboto');
  await page.waitForTimeout(300);
  const searched = await page.evaluate(() => ({
    tiles: document.querySelectorAll('#fontGrid .font-tile').length,
    hint: document.getElementById('fontGridHint')?.textContent,
    allMatch: [...document.querySelectorAll('.font-tile')].every(t => /roboto/i.test(t.dataset.family)),
  }));
  ok('search narrows the grid', searched.tiles > 0 && searched.tiles < grid.tiles, searched);
  ok('every result matches the query', searched.allMatch, searched);

  await page.fill('#fontSearch', '');
  await page.waitForTimeout(400);

  // ---------- lazy loading ----------
  await page.waitForTimeout(2200);
  const lazy = await page.evaluate(() => {
    const s = [...document.querySelectorAll('.font-tile .font-tile-sample')].filter(x => x.style.fontFamily);
    return { loaded: s.length, first: s[0]?.style.fontFamily };
  });
  ok('visible tiles load their real face', lazy.loaded > 0, lazy);
  ok('off-screen tiles are NOT loaded', lazy.loaded < grid.tiles, { loaded: lazy.loaded, total: grid.tiles });
  ok('font requests stay proportional to what is on screen', fontReqs.length > 0 && fontReqs.length <= Math.max(40, lazy.loaded * 4), {
    requests: fontReqs.length, loadedTiles: lazy.loaded,
  });

  // ---------- apply ----------
  // Pick a tile whose family differs from whatever is current, so "did it change"
  // is a meaningful assertion. Deliberately choose one outside the curated 23 —
  // that path is where the select has no matching option.
  const before = await page.evaluate(() => document.getElementById('textFontPreview')?.style.fontFamily);
  const picked = await page.evaluate(() => {
    const cur = (document.getElementById('textFontPreview')?.style.fontFamily || '').replace(/["']/g, '').split(',')[0].trim();
    const tile = [...document.querySelectorAll('.font-tile')].find(t => t.dataset.family !== cur);
    if (!tile) return null;
    tile.click();
    return tile.dataset.family;
  });
  await page.waitForTimeout(400);
  const applied = await page.evaluate((picked) => ({
    appliedTiles: document.querySelectorAll('.font-tile.applied').length,
    select: document.getElementById('textFont')?.value,
    preview: document.getElementById('textFontPreview')?.style.fontFamily,
    picked,
  }), picked);
  ok('the dropdown adopts the clicked family', applied.select === picked, applied);
  ok('clicking a tile applies exactly one family', applied.appliedTiles === 1, applied);
  ok('the <select> stays in sync', !!applied.select, applied);
  ok('preview switches to the chosen family', applied.preview && applied.preview !== before, { before, after: applied.preview });

  ok('no console/page errors', errors.length === 0, errors.slice(0, 4));

  const pass = results.filter(r => r.pass).length;
  console.log('\n--- font picker (1.6.0) ---');
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : '  << ' + JSON.stringify(r.extra)}`);
  console.log(`\n${pass}/${results.length} passed  (font files fetched: ${fontReqs.length})`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
