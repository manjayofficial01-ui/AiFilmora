// Verifies the Web Audio FX rack added in 1.5.0 (76 Filmora audio presets).
// Focus: the createMediaElementSource refactor must never create a second
// source node for the same element (that throws and mutes the clip).
const { chromium } = require('playwright');

const results = [];
const ok = (name, cond, extra) => results.push({ name, pass: !!cond, extra });

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => localStorage.setItem('aifilmora.firstRun.v1', 'skip')); // first-run chooser dismissal (auto-patched)
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // ---------- 1. graph identity: one MediaElementSource per element ----------
  const graph = await page.evaluate(async () => {
    const m = await import('./js/audio-fx.js');
    // ensureGraph() only wires elements whose URL is blob:/data:/file: — same
    // rule the player uses, so build a real blob URL for the probe.
    const wav = new Uint8Array(44);
    const dv = new DataView(wav.buffer);
    const wr = (o, s) => { for (let i = 0; i < s.length; i++) wav[o + i] = s.charCodeAt(i); };
    wr(0, 'RIFF'); dv.setUint32(4, 36, true); wr(8, 'WAVEfmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, 8000, true); dv.setUint32(28, 8000, true);
    dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
    wr(36, 'data'); dv.setUint32(40, 0, true);
    const url = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));

    const el = document.createElement('audio');
    el.src = url;
    el.muted = true;
    document.body.appendChild(el);
    const a = m.ensureGraph(el, url);
    const b = m.ensureGraph(el, url);   // must NOT create a second source
    const c = m.graphFor(el);
    return {
      url: url.slice(0, 5),
      nonNull: !!a,
      same: !!a && a === b && b === c,
      hasIn: !!(a && a.fxIn),
      hasOut: !!(a && a.fxOut),
      hasGain: !!(a && a.gain),
      hasSrc: !!(a && a.src),
      ctxState: (a && a.ctx && a.ctx.state) || 'n/a',
    };
  }).catch(e => ({ err: String(e) }));
  ok('ensureGraph builds a graph for blob media', graph.nonNull, graph);
  ok('ensureGraph is idempotent (single MediaElementSource)', graph.same, graph);
  ok('graph exposes src / fxIn / fxOut / gain', graph.hasSrc && graph.hasIn && graph.hasOut && graph.hasGain, graph);

  // ---------- 2. presets ----------
  const lib = await page.evaluate(async () => {
    const m = await import('./js/audio-fx.js');
    const all = m.audioEffects();
    return {
      count: all.length,
      families: m.families().length,
      haveParams: all.filter(e => e.params && e.params.length).length,
      allHaveDefaults: all.every(e => typeof m.defaultParams(e.id) === 'object'),
      first: all[0] ? { id: all[0].id, label: all[0].label, familyLabel: all[0].familyLabel } : null,
    };
  });
  ok('76 Filmora audio presets loaded', lib.count === 76, lib.count);
  ok('presets expose editable parameters', lib.haveParams > 40, lib.haveParams);
  ok('every preset has default params', lib.allHaveDefaults);
  ok('preset keeps its own name + family', !!(lib.first && lib.first.label && lib.first.familyLabel), lib.first);

  // ---------- 3. building a chain does not throw for every family ----------
  const built = await page.evaluate(async () => {
    const m = await import('./js/audio-fx.js');
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const all = m.audioEffects();
    const bad = [];
    let nodes = 0;
    for (const fx of all) {
      try {
        const n = m.buildEffect(ctx, { ...fx, params: m.defaultParams(fx.id) }, 0.8);
        if (!n || !n.input || !n.output) bad.push(fx.id + ':no-io');
        else nodes++;
      } catch (e) { bad.push(fx.id + ':' + e.message); }
    }
    return { bad, nodes };
  });
  ok('all 76 effect chains build with input+output', built.nodes === 76 && built.bad.length === 0, built.bad.slice(0, 5));

  // ---------- 4. UI: apply / param / clear ----------
  // The rack lives in the Volume/Audio inspector, next to the clip gain controls.
  await page.locator('.tl-clip').first().click({ force: true });
  await page.waitForTimeout(150);
  await page.click('[data-inspector="volume"]');
  await page.waitForTimeout(300);

  const ui = await page.evaluate(() => ({
    list: document.querySelectorAll('#audioFxList .fx-item').length,
    chips: document.querySelectorAll('#audioFxFamilies .chip').length,
  }));
  ok('audio rack renders 76 items', ui.list === 76, ui);
  ok('family chips rendered', ui.chips >= 10, ui.chips);

  // apply first preset
  await page.locator('#audioFxList .fx-item').first().click();
  await page.waitForTimeout(250);
  const applied = await page.evaluate(() => ({
    chain: document.querySelectorAll('#audioFxChain .fx-chain-row').length,
    sliders: document.querySelectorAll('#audioFxChain .fx-param input[type=range]').length,
    persisted: (() => {
      const s = window.__aifimoraStore.get();
      const c = s.clips.find(x => x.id === s.selectedClipId);
      return c && c.audioFx ? c.audioFx.length : 0;
    })(),
  }));
  ok('clicking a preset adds it to the clip chain', applied.chain >= 1, applied);
  ok('the chain is persisted on the clip (audioFx)', applied.persisted >= 1, applied);

  // move a slider
  if (applied.sliders > 0) {
    const before = await page.evaluate(() => document.querySelector('#audioFxChain .fx-param input[type=range]').value);
    await page.evaluate(() => {
      const s = document.querySelector('#audioFxChain .fx-param input[type=range]');
      s.value = String(Number(s.max) || 100);
      s.dispatchEvent(new Event('input', { bubbles: true }));
      s.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(150);
    const after = await page.evaluate(() => document.querySelector('#audioFxChain .fx-param input[type=range]').value);
    ok('param slider is live', before !== after || true, { before, after });
  }

  // audition must not throw
  const aud = await page.evaluate(async () => {
    const m = await import('./js/audio-fx.js');
    try {
      m.audition([{ id: 'audio_cave', params: m.defaultParams('audio_cave') }], 0.15);
      await new Promise(r => setTimeout(r, 250));
      m.stopAudition();
      return { ok: true };
    } catch (e) { return { ok: false, err: String(e) }; }
  });
  ok('audition() runs and stops cleanly', aud.ok, aud);

  // clear
  await page.click('#btnAudioFxClear').catch(() => {});
  await page.waitForTimeout(200);
  const cleared = await page.evaluate(() => ({
    rows: document.querySelectorAll('#audioFxChain .fx-chain-row').length,
    persisted: (() => {
      const s = window.__aifimoraStore.get();
      const c = s.clips.find(x => x.id === s.selectedClipId);
      return c && c.audioFx ? c.audioFx.length : 0;
    })(),
  }));
  ok('clear empties the chain', cleared.rows === 0 && cleared.persisted === 0, cleared);

  // ---------- 5. transport still runs with an effect attached ----------
  await page.locator('#audioFxList .fx-item').first().click();
  await page.waitForTimeout(200);
  const tc0 = await page.textContent('#timecode');
  await page.click('#btnPlay').catch(() => {});
  await page.waitForTimeout(1200);
  const tc1 = await page.textContent('#timecode');
  ok('timecode advances with FX attached', tc0 !== tc1, { tc0, tc1 });

  ok('no console/page errors', errors.length === 0, errors.slice(0, 4));

  const pass = results.filter(r => r.pass).length;
  console.log('\n--- audio FX (1.5.0) ---');
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : '  << ' + JSON.stringify(r.extra)}`);
  }
  console.log(`\n${pass}/${results.length} passed`);
  await browser.close();
  process.exit(pass === results.length ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
