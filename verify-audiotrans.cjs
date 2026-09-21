// Verifies Filmora audio transition curves (1.9.0).
// These are crossfade SHAPES, so the tests assert the audio-theoretic property
// each one is named for — not merely "gain changed".
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
    const m = await import('./js/audio-transitions.js');
    const all = m.audioTransitions();
    return {
      count: all.length,
      curves: all.map(t => t.curve),
      labels: all.map(t => t.label),
      allNoted: all.every(t => !!t.note),
      byId: !!m.audioTransitionById(all[0].id),
      defaultIsConstantPower: m.audioTransitionById(m.DEFAULT_AUDIO_TRANSITION)?.curve === 'constantPower',
      resolvesRawCurve: m.curveOf('exponential') === 'exponential',
      resolvesUnknown: m.curveOf('nonsense') === 'constantPower',
    };
  });
  ok('7 Filmora audio transitions', lib.count === 7, lib.count);
  ok('every type maps to a curve', lib.curves.every(Boolean), lib.curves);
  ok('names match the asset dump',
    lib.labels.includes('Constant Power') && lib.labels.includes('Exponential Fade') && lib.labels.includes('Simple Mix'),
    lib.labels);
  ok('each type explains itself in the UI', lib.allNoted);
  ok('default is Constant Power', lib.defaultIsConstantPower);
  ok('curveOf resolves raw names and falls back safely', lib.resolvesRawCurve && lib.resolvesUnknown);

  // ---------- curve maths ----------
  const m = await page.evaluate(async () => {
    const m = await import('./js/audio-transitions.js');
    const sweep = (curve) => {
      const out = [], inn = [], power = [];
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        const o = m.fadeOutGain(curve, t), n = m.fadeInGain(curve, t);
        out.push(o); inn.push(n);
        power.push(Math.sqrt(o * o + n * n));
      }
      return { out, inn, power };
    };
    return {
      cp: sweep('constantPower'),
      cg: sweep('constantGain'),
      ex: sweep('exponential'),
      lg: sweep('logarithmic'),
      mix: sweep('mix'),
      da: sweep('dealiasing'),
      endpoints: ['constantPower', 'constantGain', 'exponential', 'logarithmic', 'dealiasing'].map(c => ({
        c,
        inAt0: m.fadeInGain(c, 0), inAt1: m.fadeInGain(c, 1),
        outAt0: m.fadeOutGain(c, 0), outAt1: m.fadeOutGain(c, 1),
      })),
      clamped: { below: m.fadeInGain('constantPower', -3), above: m.fadeInGain('constantPower', 9) },
    };
  });

  const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

  // endpoints: every real fade must start silent-ish and end full (or vice versa)
  const badEnds = m.endpoints.filter(e =>
    !(near(e.inAt0, 0, 1e-3) && near(e.inAt1, 1, 1e-3) && near(e.outAt0, 1, 1e-3) && near(e.outAt1, 0, 1e-3)));
  ok('every curve runs 0→1 / 1→0 across the fade', badEnds.length === 0, badEnds);

  // constant power holds combined level flat — that's the whole point of it
  const cpMin = Math.min(...m.cp.power), cpMax = Math.max(...m.cp.power);
  ok('Constant Power holds combined level flat', Math.abs(cpMax - cpMin) < 0.01, { cpMin, cpMax });

  // constant gain sums to 1 in amplitude, but dips in power — the reason CP exists
  const cgSum = m.cg.out.map((o, i) => o + m.cg.inn[i]);
  const cgFlat = cgSum.every(s => near(s, 1, 1e-6));
  const cgDip = Math.min(...m.cg.power);
  ok('Constant Gain sums to exactly 1', cgFlat, { min: Math.min(...cgSum), max: Math.max(...cgSum) });
  ok('Constant Gain dips in power (why Constant Power exists)', cgDip < 0.8, cgDip);

  // every pair must be a true mirror: in(t) === out(1-t)
  const mirrored = ['exponential', 'logarithmic', 'constantGain', 'linear', 'dealiasing']
    .every(c => m[({ exponential: 'ex', logarithmic: 'lg', constantGain: 'cg', linear: 'cg', dealiasing: 'da' })[c]].inn
      .every((v, i) => near(v, m[({ exponential: 'ex', logarithmic: 'lg', constantGain: 'cg', linear: 'cg', dealiasing: 'da' })[c]].out[20 - i], 1e-6)));
  ok('fade in and fade out are exact mirrors', mirrored);

  // exponential and logarithmic must be OPPOSITES in character — this is what
  // caught them both leaning the same way in the first implementation.
  ok('Exponential rises slower than linear early on', m.ex.inn[2] < 2 / 20, { exp: m.ex.inn[2], linear: 2 / 20 });
  ok('Logarithmic rises faster than linear early on', m.lg.inn[2] > 2 / 20, { log: m.lg.inn[2], linear: 2 / 20 });
  ok('Exponential and logarithmic are opposites',
    m.ex.inn[10] < m.lg.inn[10] - 0.2, { exp: m.ex.inn[10], log: m.lg.inn[10] });

  // simple mix never ducks anything
  ok('Simple Mix holds both at full level', m.mix.out.every(v => near(v, 1)) && m.mix.inn.every(v => near(v, 1)));

  // de-aliasing is smoothed equal-power: monotonic, no corner
  const daMono = m.da.out.every((v, i) => i === 0 || v <= m.da.out[i - 1] + 1e-9);
  const daMonoIn = m.da.inn.every((v, i) => i === 0 || v >= m.da.inn[i - 1] - 1e-9);
  ok('De-aliasing is monotonic both ways', daMono && daMonoIn);

  ok('gains are clamped outside 0..1', near(m.clamped.below, 0) && near(m.clamped.above, 1), m.clamped);

  // ---------- UI ----------
  await page.click('[data-inspector="volume"]');
  await page.waitForTimeout(300);
  await page.locator('.tl-clip[data-type="video"]').first().click({ force: true });
  await page.waitForTimeout(200);
  await page.click('[data-inspector="volume"]');
  await page.waitForTimeout(300);

  const grid = await page.evaluate(() => ({
    tiles: document.querySelectorAll('#audioTransGrid .lut-tile').length,
    visible: (document.getElementById('audioTransGrid')?.getBoundingClientRect().height || 0) > 0,
    active: document.querySelectorAll('#audioTransGrid .lut-tile.active').length,
    note: document.getElementById('audioTransNote')?.textContent || '',
  }));
  ok('grid renders 7 tiles in the Audio panel', grid.tiles === 7 && grid.visible, grid);
  ok('project default is marked active', grid.active === 1, grid);
  ok('the note says it is the project default', /project default/.test(grid.note), grid.note);

  // pick Exponential Fade
  await page.locator('#audioTransGrid .lut-tile[data-trans="audio/blender/transition-xe-exponential-fade"]').click();
  await page.waitForTimeout(350);
  const applied = await page.evaluate(() => {
    const s = window.__aifimoraStore.get();
    const c = s.clips.find(x => x.id === s.selectedClipId);
    return { t: c?.audioTransition, active: document.querySelectorAll('#audioTransGrid .lut-tile.active').length, note: document.getElementById('audioTransNote')?.textContent || '' };
  });
  ok('clicking a tile sets a clip override', applied.t === 'audio/blender/transition-xe-exponential-fade', applied);
  ok('the note reports it as a clip override', /clip override/.test(applied.note), applied.note);
  ok('still exactly one active tile', applied.active === 1, applied);

  // reset to project default
  await page.click('#btnAudioTransDefault');
  await page.waitForTimeout(350);
  const reset = await page.evaluate(() => {
    const s = window.__aifimoraStore.get();
    const c = s.clips.find(x => x.id === s.selectedClipId);
    return { t: c?.audioTransition, note: document.getElementById('audioTransNote')?.textContent || '' };
  });
  ok('reset clears the override', !reset.t, reset);
  ok('the note returns to project default', /project default/.test(reset.note), reset.note);

  // fades still work end to end
  await page.fill('#volFadeIn', '1.2');
  await page.dispatchEvent('#volFadeIn', 'change');
  await page.waitForTimeout(250);
  const fade = await page.evaluate(() => {
    const s = window.__aifimoraStore.get();
    const c = s.clips.find(x => x.id === s.selectedClipId);
    return c?.fadeIn;
  });
  ok('fade in still persists', Number(fade) > 0, fade);

  ok('no console/page errors', errors.length === 0, errors.slice(0, 4));

  const pass = results.filter(r => r.pass).length;
  console.log('\n--- audio transitions (1.9.0) ---');
  for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : '  << ' + JSON.stringify(r.extra)}`);
  console.log(`\n${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
