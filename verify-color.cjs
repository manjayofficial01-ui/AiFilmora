// Verifies the Filmora colour engine added in 1.7.0.
// The presets are parametric (not LUTs), so the point of this test is that the
// NUMBERS from Filmora's .conf files produce the look their name promises.
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
    const m = await import('./js/color-presets.js');
    const all = m.colorPresets();
    return {
      count: all.length,
      titled: all.filter(p => p.title && !/^\d+_/.test(p.title)).length,
      withVignette: all.filter(p => p.vignette).length,
      withHsl: all.filter(p => p.hsl).length,
      byId: !!m.colorPresetById(all[0].id),
      byTitle: !!m.colorPresetByTitle('Blockbuster'),
      titles: all.map(p => p.title),
    };
  });
  ok('29 Filmora colour presets parsed', lib.count === 29, lib.count);
  ok('all have canonical titles', lib.titled === 29, lib.titled);
  ok('all carry HSL + vignette blocks', lib.withHsl === 29 && lib.withVignette === 29, lib);
  ok('lookup by id and by title works', lib.byId && lib.byTitle, lib);
  ok('names match the asset dump', lib.titles.includes('Blockbuster') && lib.titles.includes('Black&White'), lib.titles.slice(0, 5));

  // ---------- engine maths ----------
  const math = await page.evaluate(async () => {
    const cp = await import('./js/color-presets.js');
    const ce = await import('./js/color-engine.js');

    // 8x8 patch of a mid-tone colour
    const patch = (r, g, b, size = 8) => {
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      const img = ctx.createImageData(size, size);
      for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
      }
      return img;
    };
    const mid = () => patch(128, 128, 128);
    const avg = (img) => {
      let r = 0, g = 0, b = 0, n = img.data.length / 4;
      for (let i = 0; i < img.data.length; i += 4) { r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; }
      return [r / n, g / n, b / n];
    };
    const run = (title, base) => {
      const p = cp.colorPresetByTitle(title);
      const img = base || mid();
      ce.applyColorGradeToImageData(img, p, 1);
      return avg(img);
    };

    const bw = run('Black&White');
    const bwSpread = Math.max(...bw) - Math.min(...bw);

    const warm = run('Warm Max');
    const cool = run('Cool Max');

    const brightImg = mid();
    const beforeBright = avg(brightImg);
    const bright = (() => { const p = cp.colorPresetByTitle('Brighten'); const i = mid(); ce.applyColorGradeToImageData(i, p, 1); return avg(i); })();

    // intensity 0 must be a no-op
    const zero = mid();
    const p0 = cp.colorPresetByTitle('Blockbuster');
    ce.applyColorGradeToImageData(zero, p0, 0);
    const zeroAvg = avg(zero);

    // vignette: corner must be darker than centre
    const big = patch(200, 200, 200, 64);
    const vg = cp.colorPresetByTitle('Vignette Classic');
    ce.applyColorGradeToImageData(big, vg, 1);
    const px = (x, y) => { const i = (y * 64 + x) * 4; return [big.data[i], big.data[i + 1], big.data[i + 2]]; };
    const centre = px(32, 32), corner = px(1, 1);

    return {
      bwSpread, warm, cool, bright, beforeBright, zeroAvg,
      centre, corner,
      vignette: vg && vg.vignette,
    };
  });

  ok('Black&White desaturates to neutral grey', math.bwSpread < 1.5, math.bwSpread);
  ok('Warm Max pushes red up and blue down', math.warm[0] > math.warm[2] + 10, math.warm);
  ok('Cool Max pushes blue up and red down', math.cool[2] > math.cool[0] + 10, math.cool);
  ok('Brighten lifts exposure', math.bright[0] > math.beforeBright[0] + 10, { before: math.beforeBright, after: math.bright });
  ok('intensity 0 is a true no-op', Math.abs(math.zeroAvg[0] - 128) < 0.01, math.zeroAvg);
  ok('vignette darkens the corner, not the centre', math.corner[0] < math.centre[0] - 15, { centre: math.centre, corner: math.corner });

  // ---------- thumbnails ----------
  const thumbs = await page.evaluate(async () => {
    const cp = await import('./js/color-presets.js');
    const ce = await import('./js/color-engine.js');
    const urls = cp.colorPresets().map(p => ce.colorPresetThumbnail(p, 96, 54).toDataURL());
    return { count: urls.length, distinct: new Set(urls).size };
  });
  ok('every preset generates a thumbnail', thumbs.count === 29, thumbs.count);
  ok('thumbnails are visually distinct', thumbs.distinct >= 25, thumbs);

  // ---------- UI ----------
  await page.click('[data-inspector="fx"]');
  await page.waitForTimeout(300);
  await page.locator('.tl-clip[data-type="video"]').first().click({ force: true });
  await page.waitForTimeout(200);
  await page.click('[data-inspector="fx"]');
  await page.waitForTimeout(300);

  const grid = await page.evaluate(() => ({
    tiles: document.querySelectorAll('#colorPresetGrid .lut-tile').length,
    visible: (document.getElementById('colorPresetGrid')?.getBoundingClientRect().height || 0) > 0,
  }));
  ok('grid renders 29 tiles in the FX panel', grid.tiles === 29 && grid.visible, grid);

  await page.fill('#colorPresetSearch', 'vignette');
  await page.waitForTimeout(250);
  const searched = await page.evaluate(() => ({
    tiles: document.querySelectorAll('#colorPresetGrid .lut-tile').length,
    allMatch: [...document.querySelectorAll('#colorPresetGrid .lut-tile')].every(t => /vignette/i.test(t.dataset.preset)),
  }));
  ok('search narrows the grid', searched.tiles === 10, searched);
  ok('every search hit matches', searched.allMatch, searched);
  await page.fill('#colorPresetSearch', '');
  await page.waitForTimeout(250);

  // apply
  await page.locator('#colorPresetGrid .lut-tile').first().click();
  await page.waitForTimeout(400);
  const applied = await page.evaluate(() => {
    const s = window.__aifimoraStore.get();
    const c = s.clips.find(x => x.id === s.selectedClipId);
    return { preset: c?.fx?.colorPreset, active: document.querySelectorAll('#colorPresetGrid .lut-tile.active').length };
  });
  ok('clicking a tile persists fx.colorPreset', !!applied.preset, applied);
  ok('exactly one tile shows as active', applied.active === 1, applied);

  // intensity
  await page.evaluate(() => {
    const s = document.getElementById('fxColorPresetIntensity');
    s.value = '40';
    s.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  const inten = await page.evaluate(() => {
    const s = window.__aifimoraStore.get();
    const c = s.clips.find(x => x.id === s.selectedClipId);
    return c?.fx?.colorPresetIntensity;
  });
  ok('intensity slider persists', inten === 40, inten);

  // clear
  await page.click('#btnColorPresetClear');
  await page.waitForTimeout(300);
  const cleared = await page.evaluate(() => {
    const s = window.__aifimoraStore.get();
    const c = s.clips.find(x => x.id === s.selectedClipId);
    return { preset: c?.fx?.colorPreset, active: document.querySelectorAll('#colorPresetGrid .lut-tile.active').length };
  });
  ok('clear removes the preset', !cleared.preset && cleared.active === 0, cleared);

  // playback still renders
  await page.locator('#colorPresetGrid .lut-tile').nth(3).click();
  const tc0 = await page.textContent('#timecode');
  await page.click('#btnPlay').catch(() => {});
  await page.waitForTimeout(1100);
  const tc1 = await page.textContent('#timecode');
  ok('transport advances with a colour preset attached', tc0 !== tc1, { tc0, tc1 });

  ok('no console/page errors', errors.length === 0, errors.slice(0, 4));

  const pass = results.filter(r => r.pass).length;
  console.log('\n--- colour presets (1.7.0) ---');
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : '  << ' + JSON.stringify(r.extra)}`);
  console.log(`\n${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
