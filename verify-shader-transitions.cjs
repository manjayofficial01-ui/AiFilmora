/* verify-shader-transitions.cjs — end-to-end check that the Filmora GPU-shader
 * transitions (ported from asset/resources/wfx_effect/Transition/*.frag) are
 * integrated and rendering. Run: node verify-shader-transitions.cjs
 * (requires the static server: node server.cjs) */
const { chromium } = require('playwright');

const FW_IDS = [
  'fw_crosszoom', 'fw_push', 'fw_drop', 'fw_erase', 'fw_linearwipe',
  'fw_pinwheel', 'fw_pixelate', 'fw_roll', 'fw_roundzoom', 'fw_skewsplit',
  'fw_doorway', 'fw_whirl', 'fw_evaporate', 'fw_fadeblack', 'fw_fadewhite',
];

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  const failed404 = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => { if (r.status() === 404) failed404.push(r.url()); });

  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => localStorage.setItem('aifilmora.firstRun.v1', 'skip'));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  // 1. Catalog integrity — every shader transition registered with a duration
  const catalog = await page.evaluate(async () => {
    const m = await import('./js/transitions.js');
    return m.TRANSITIONS.filter((t) => t.id.startsWith('fw_')).map((t) => ({ id: t.id, dur: t.dur }));
  });
  const missingCatalog = FW_IDS.filter((id) => !catalog.some((c) => c.id === id));
  const badDur = catalog.filter((c) => !(c.dur > 0 && c.dur <= 3));

  // 2. UI renders the shader tiles in their own section
  await page.click('[data-sidebar="transitions"]');
  await page.waitForTimeout(500);
  const ui = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('#transGrid .preset')];
    const heads = [...document.querySelectorAll('#transGrid .section-title')].map((h) => h.textContent);
    return {
      totalTiles: tiles.length,
      shaderTiles: tiles.filter((b) => /Cross Zoom|Push|Drop Bands|Erase Wipe|Linear Wipe|Pinwheel|Pixelate|Roll Clockwise|Round Zoom|Skew Split|Doorway|Whirl|Evaporate|Fade (Black|White) \(Filmora\)/.test(b.textContent)).length,
      sectionHeads: heads,
    };
  });

  // 3. Live preview canvas actually changes for each shader transition (renders, no exceptions)
  const paintResults = {};
  for (const id of FW_IDS) {
    const snap = () => page.evaluate(() => {
      const c = document.getElementById('transPreviewCanvas');
      if (!c) return null;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 397) sum = (sum * 31 + d[i]) | 0; // cheap full-canvas hash
      return String(sum);
    });
    await page.evaluate((tid) => window.dispatchEvent(new CustomEvent('aifimora:preview-transition', { detail: { type: tid, label: tid } })), id);
    await page.waitForTimeout(120); // early in the animation
    const early = await snap();
    await page.waitForTimeout(450); // and mid-animation
    const mid = await snap();
    paintResults[id] = early !== null && mid !== null && (early !== mid || early !== paintResults[id]);
    // a transition "paints" if the canvas content differs across its own timeline
    paintResults[id] = early !== null && mid !== null && early !== mid;
  }
  const notPainting = FW_IDS.filter((id) => !paintResults[id]);

  // 4. Apply a shader transition to a real clip and confirm the player pipeline accepts it
  const apply = await page.evaluate(async (tid) => {
    const { store } = await import('./js/state.js');
    const { TRANSITIONS, applyTransitionToClip, transitionById } = await import('./js/transitions.js');
    const state = store.get();
    const vid = state.clips.find((c) => c.type !== 'audio' && c.type !== 'text');
    if (!vid) return { ok: false, reason: 'no video clip in demo project' };
    const res = applyTransitionToClip(store, vid.id, tid);
    const clip = store.getClip(vid.id);
    return {
      ok: res.ok,
      applied: clip?.outTransition?.type === tid,
      label: transitionById(tid).label,
      dur: clip?.outTransition?.duration,
    };
  }, 'fw_push');

  // 5. Player pipeline resolves the applied transition at a mid-transition timestamp
  let playerPainted = false;
  let midInfo = null;
  try {
    midInfo = await page.evaluate(async () => {
      const { store } = await import('./js/state.js');
      const { activeTransition } = await import('./js/transitions.js');
      const state = store.get();
      const from = state.clips.find((c) => c.outTransition?.type?.startsWith('fw_'));
      if (!from) return null;
      // sample inside the transition window: (cut - duration) .. cut
      const cut = from.start + from.duration;
      const tr = activeTransition(state, cut - from.outTransition.duration / 2);
      return tr ? { type: tr.type, progress: Number(tr.progress.toFixed(2)) } : null;
    });
    playerPainted = !!midInfo && midInfo.type === 'fw_push';
  } catch (e) {
    midInfo = { err: e.message };
  }

  await page.screenshot({ path: 'output-shader-transitions.png' });
  await browser.close();

  const pass = missingCatalog.length === 0 && badDur.length === 0 && ui.shaderTiles === FW_IDS.length &&
    notPainting.length === 0 && apply.ok && apply.applied && playerPainted && errors.length === 0;
  console.log(JSON.stringify({
    pass,
    catalog: { count: catalog.length, missingCatalog, badDur },
    ui: { totalTiles: ui.totalTiles, shaderTiles: ui.shaderTiles, sectionHeads: ui.sectionHeads },
    previewPainting: { ok: notPainting.length === 0, notPainting },
    applyResult: apply,
    activeTransitionMid: midInfo,
    pageErrors: errors,
    notFound404: failed404.filter((u) => u.includes('wfx_effect')),
  }, null, 2));
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
