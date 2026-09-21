// Verifies Filmora Pan & Zoom (1.8.0).
// The presets store four keyframed tracks = normalised crop rect [x, y, w, h].
// These tests assert the GEOMETRY, not just "something rendered".
const { chromium } = require('playwright');

const results = [];
const ok = (name, cond, extra) => results.push({ name, pass: !!cond, extra });

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });

  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => localStorage.setItem('aifilmora.firstRun.v1', 'skip')); // first-run chooser dismissal (auto-patched)
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // ---------- manifest ----------
  const lib = await page.evaluate(async () => {
    const m = await import('./js/panzoom.js');
    const all = m.panZoomPresets();
    return {
      count: all.length,
      fourTracks: all.every(p => p.tracks && p.tracks.length === 4),
      normalised: all.every(p => p.tracks.every(tr => tr.keys.every(k => k.t >= 0 && k.t <= 1))),
      titles: all.map(p => p.title),
      byId: !!m.panZoomById(all[0].id),
    };
  });
  ok('6 Filmora Pan & Zoom presets', lib.count === 6, lib.count);
  ok('every preset has 4 tracks (x,y,w,h)', lib.fourTracks, lib.fourTracks);
  ok('keyframe times normalised to 0..1', lib.normalised, lib.normalised);
  ok('lookup by id works', lib.byId);
  ok('titles come from Filmora', lib.titles.includes('Zoom in') && lib.titles.includes('Pan Left'), lib.titles);

  // ---------- geometry ----------
  const geo = await page.evaluate(async () => {
    const m = await import('./js/panzoom.js');
    const at = (title, t, k = 1) => {
      const p = m.panZoomPresets().find(x => x.title === title);
      return m.effectiveRect(p, t, k);
    };
    return {
      originalStart: at('Zoom Original', 0),
      originalEnd: at('Zoom Original', 1),
      inStart: at('Zoom in', 0),
      inEnd: at('Zoom in', 1),
      outStart: at('Zoom out', 0),
      outEnd: at('Zoom out', 1),
      panRightStart: at('Pan Right', 0),
      panRightEnd: at('Pan Right', 1),
      panLeftStart: at('Pan Left', 0),
      panLeftEnd: at('Pan Left', 1),
      inHalf: at('Zoom in', 0.5),
      intensity0: at('Zoom in', 1, 0),
      intensity50: at('Zoom in', 1, 0.5),
      staticFlag: m.isStaticPreset(m.panZoomPresets().find(x => x.title === 'Zoom Original')),
      movingFlag: m.isStaticPreset(m.panZoomPresets().find(x => x.title === 'Zoom in')),
    };
  });

  const full = (r) => Math.abs(r.x) < 1e-6 && Math.abs(r.y) < 1e-6 && Math.abs(r.w - 1) < 1e-6 && Math.abs(r.h - 1) < 1e-6;

  ok('Zoom Original is the full frame at both ends', full(geo.originalStart) && full(geo.originalEnd), geo.originalStart);
  ok('Zoom Original is flagged static', geo.staticFlag === true);
  ok('Zoom in is flagged moving', geo.movingFlag === false);

  ok('Zoom in starts full-frame', full(geo.inStart), geo.inStart);
  ok('Zoom in ends at 2x (w=h=0.5)', Math.abs(geo.inEnd.w - 0.5) < 1e-6 && Math.abs(geo.inEnd.h - 0.5) < 1e-6, geo.inEnd);
  ok('Zoom in stays centred (x=y=0.25 at end)', Math.abs(geo.inEnd.x - 0.25) < 1e-6 && Math.abs(geo.inEnd.y - 0.25) < 1e-6, geo.inEnd);
  ok('Zoom in interpolates halfway (w=0.75)', Math.abs(geo.inHalf.w - 0.75) < 1e-6, geo.inHalf);

  ok('Zoom out is the exact mirror of Zoom in',
    Math.abs(geo.outStart.w - geo.inEnd.w) < 1e-6 && Math.abs(geo.outEnd.w - geo.inStart.w) < 1e-6,
    { outStart: geo.outStart, outEnd: geo.outEnd });

  ok('Pan Right moves x right with w fixed',
    geo.panRightEnd.x > geo.panRightStart.x + 0.4 && Math.abs(geo.panRightEnd.w - geo.panRightStart.w) < 1e-6,
    { start: geo.panRightStart, end: geo.panRightEnd });
  ok('Pan Left moves x left with w fixed',
    geo.panLeftEnd.x < geo.panLeftStart.x - 0.4 && Math.abs(geo.panLeftEnd.w - geo.panLeftStart.w) < 1e-6,
    { start: geo.panLeftStart, end: geo.panLeftEnd });
  ok('Pans hold y steady', Math.abs(geo.panRightEnd.y - geo.panRightStart.y) < 1e-6, geo.panRightEnd);

  ok('intensity 0 collapses to the full frame', full(geo.intensity0), geo.intensity0);
  ok('intensity 50 lands between', geo.intensity50.w > 0.5 && geo.intensity50.w < 1, geo.intensity50);

  // never escape the source
  const clamped = await page.evaluate(async () => {
    const m = await import('./js/panzoom.js');
    const bad = [];
    for (const p of m.panZoomPresets()) {
      for (let i = 0; i <= 20; i++) {
        const r = m.effectiveRect(p, i / 20, 1);
        if (r.x < -1e-9 || r.y < -1e-9 || r.x + r.w > 1 + 1e-9 || r.y + r.h > 1 + 1e-9) {
          bad.push(p.title + '@' + (i / 20) + ' ' + JSON.stringify(r));
        }
      }
    }
    return bad;
  });
  ok('crop never leaves the source frame', clamped.length === 0, clamped.slice(0, 3));

  // ---------- UI ----------
  await page.click('[data-inspector="motion"]');
  await page.waitForTimeout(300);
  await page.locator('.tl-clip[data-type="video"]').first().click({ force: true });
  await page.waitForTimeout(200);
  await page.click('[data-inspector="motion"]');
  await page.waitForTimeout(300);

  const grid = await page.evaluate(() => ({
    tiles: document.querySelectorAll('#panZoomGrid .lut-tile').length,
    visible: (document.getElementById('panZoomGrid')?.getBoundingClientRect().height || 0) > 0,
    thumbs: [...document.querySelectorAll('#panZoomGrid .lut-thumb')].filter(t => /data:image/.test(t.style.backgroundImage)).length,
  }));
  ok('grid renders 6 tiles in the Motion panel', grid.tiles === 6 && grid.visible, grid);
  ok('every tile has a generated preview', grid.thumbs === 6, grid);

  // apply "Zoom in"
  await page.locator('#panZoomGrid .lut-tile[data-pz="panzoom:zoom-in"]').click();
  await page.waitForTimeout(400);
  const applied = await page.evaluate(() => {
    const s = window.__aifimoraStore.get();
    const c = s.clips.find(x => x.id === s.selectedClipId);
    return { pz: c?.panZoom, active: document.querySelectorAll('#panZoomGrid .lut-tile.active').length };
  });
  ok('clicking a tile persists clip.panZoom', applied.pz && applied.pz.id === 'panzoom:zoom-in', applied);
  ok('exactly one tile is active', applied.active === 1, applied);

  await page.evaluate(() => {
    const s = document.getElementById('panZoomIntensity');
    s.value = '50';
    s.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  const inten = await page.evaluate(() => {
    const s = window.__aifimoraStore.get();
    return s.clips.find(x => x.id === s.selectedClipId)?.panZoom?.intensity;
  });
  ok('intensity slider persists', inten === 50, inten);

  /* The RENDER path, tested directly against a real image.
   * Worth knowing: the demo project's media is synthetic, so most clips have no
   * real video element and Pan & Zoom cannot crop them — comparing preview-canvas
   * data URLs there is meaningless (it stayed byte-identical, twice, for two
   * different reasons: the baseline was captured after applying, and at t=0
   * "Zoom in" IS the full frame). So drive drawWithPanZoom() with a real canvas. */
  const draw = await page.evaluate(async () => {
    const m = await import('./js/panzoom.js');
    // 200x200 source: four solid quadrants, so a crop is unambiguous
    const src = document.createElement('canvas');
    src.width = 200; src.height = 200;
    const sctx = src.getContext('2d');
    sctx.fillStyle = '#ff0000'; sctx.fillRect(0, 0, 100, 100);     // TL red
    sctx.fillStyle = '#00ff00'; sctx.fillRect(100, 0, 100, 100);   // TR green
    sctx.fillStyle = '#0000ff'; sctx.fillRect(0, 100, 100, 100);   // BL blue
    sctx.fillStyle = '#ffffff'; sctx.fillRect(100, 100, 100, 100); // BR white

    const out = document.createElement('canvas');
    out.width = 100; out.height = 100;
    const octx = out.getContext('2d');
    const at = (x, y) => {
      const d = octx.getImageData(x, y, 1, 1).data;
      return [d[0], d[1], d[2]].join(',');
    };

    // full frame -> centre pixel is the boundary, sample each quadrant instead
    m.drawWithPanZoom(octx, src, m.effectiveRect(null, 0, 1), 0, 0, 100, 100);
    const fullTL = at(25, 25), fullBR = at(75, 75);

    // crop to the top-left quadrant -> the WHOLE destination turns red
    m.drawWithPanZoom(octx, src, { x: 0, y: 0, w: 0.5, h: 0.5 }, 0, 0, 100, 100);
    const tlTL = at(25, 25), tlBR = at(75, 75);

    // crop to the bottom-right quadrant -> all white
    m.drawWithPanZoom(octx, src, { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }, 0, 0, 100, 100);
    const brTL = at(25, 25), brBR = at(75, 75);

    return { fullTL, fullBR, tlTL, tlBR, brTL, brBR };
  });
  ok('full-frame draw keeps the source layout', draw.fullTL === '255,0,0' && draw.fullBR === '255,255,255', draw);
  ok('cropping to top-left fills the frame with that quadrant',
    draw.tlTL === '255,0,0' && draw.tlBR === '255,0,0', draw);
  ok('cropping to bottom-right fills the frame with that quadrant',
    draw.brTL === '255,255,255' && draw.brBR === '255,255,255', draw);

  // the whole "Zoom in" move sampled over time
  const sweep = await page.evaluate(async () => {
    const m = await import('./js/panzoom.js');
    const p = m.panZoomPresets().find(x => x.title === 'Zoom in');
    const ws = [0, 0.25, 0.5, 0.75, 1].map(t => m.effectiveRect(p, t, 1).w);
    const monotonic = ws.every((v, i) => i === 0 || v <= ws[i - 1] + 1e-9);
    return { ws, monotonic };
  });
  ok('Zoom in narrows monotonically over time', sweep.monotonic && sweep.ws[0] === 1 && sweep.ws[4] === 0.5, sweep);

  await page.click('#btnPanZoomClear');
  await page.waitForTimeout(300);
  const cleared = await page.evaluate(() => {
    const s = window.__aifimoraStore.get();
    const c = s.clips.find(x => x.id === s.selectedClipId);
    return { pz: c?.panZoom, active: document.querySelectorAll('#panZoomGrid .lut-tile.active').length };
  });
  ok('clear removes the preset', !cleared.pz && cleared.active === 0, cleared);

  ok('no console/page errors', errors.length === 0, errors.slice(0, 4));

  const pass = results.filter(r => r.pass).length;
  console.log('\n--- Pan & Zoom (1.8.0) ---');
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : '  << ' + JSON.stringify(r.extra)}`);
  console.log(`\n${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
