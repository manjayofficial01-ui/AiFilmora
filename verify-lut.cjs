/* Smoke test: real .CUBE LUT engine + LUT browser.
 *
 * Asserts the 25 Filmora LUTs actually parse and actually change pixels —
 * the whole point of replacing the old gradient-overlay fake.
 */
const { chromium } = require("playwright");
const URL = "http://127.0.0.1:8765/index.html";

const fail = [];
const ok = [];
const check = (c, m) => (c ? ok.push(m) : fail.push(m));

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => localStorage.setItem('aifilmora.firstRun.v1', 'skip')); // first-run chooser dismissal (auto-patched)
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  // give the background preloader time to fetch all 25 .CUBE files (32k lines each)
  await page.waitForFunction(
    () => window.__aifimoraLutCount && window.__aifimoraLutCount() >= 25,
    { timeout: 45000 }
  ).catch(() => {});

  const probe = await page.evaluate(async () => {
    const eng = await import("./js/lut-engine.js");
    const lib = await import("./js/filmora-library.js");
    const names = eng.lutNames();
    const lut = await eng.loadLut("Batman");
    const identityish = await eng.loadLut("B&W Film");

    // sample a mid grey and a saturated red through each
    const out = new Float32Array(3);
    eng.sampleLut(lut, 0.5, 0.5, 0.5, out);
    const greyThroughBatman = [out[0], out[1], out[2]];
    eng.sampleLut(identityish, 0.6, 0.3, 0.2, out);
    const skinThroughBW = [out[0], out[1], out[2]];

    // B&W must desaturate: r≈g≈b
    const bwSpread = Math.max(...skinThroughBW) - Math.min(...skinThroughBW);

    // applyLutToImageData must move real pixels
    const c = document.createElement("canvas");
    c.width = 64; c.height = 64;
    const cx = c.getContext("2d");
    cx.fillStyle = "rgb(120,140,160)";
    cx.fillRect(0, 0, 64, 64);
    const img = cx.getImageData(0, 0, 64, 64);
    const before = [img.data[0], img.data[1], img.data[2]];
    eng.applyLutToImageData(img, lut, 1);
    const after = [img.data[0], img.data[1], img.data[2]];
    const delta = Math.abs(after[0] - before[0]) + Math.abs(after[1] - before[1]) + Math.abs(after[2] - before[2]);

    // intensity 0 must be a no-op
    const img2 = cx.getImageData(0, 0, 4, 4);
    const b2 = [img2.data[0], img2.data[1], img2.data[2]];
    eng.applyLutToImageData(img2, lut, 0);
    const zeroDelta = Math.abs(img2.data[0] - b2[0]);

    const thumb = eng.lutThumbnail(lut, 96, 54);
    const ref = eng.referenceThumbnail(96, 54);

    return {
      count: names.length,
      firstFive: names.slice(0, 5),
      size: lut.size,
      title: lut.title,
      dataLen: lut.data.length,
      greyThroughBatman,
      skinThroughBW,
      bwSpread,
      before, after, delta, zeroDelta,
      thumbIsPng: typeof thumb === "string" && thumb.startsWith("data:image/png"),
      thumbDiffersFromRef: thumb !== ref,
      filters: lib.FILTER_PRESETS.length,
      audio: lib.AUDIO_EFFECTS.length,
      anims: lib.ANIMATION_PRESETS.length,
      textStyles: lib.TEXT_STYLES.length,
      motion: lib.MOTION_PRESETS.length,
      textArt: lib.TEXT_ART_PRESETS.length,
      masks: lib.MASK_PRESETS.length,
      trans: lib.TRANSITION_PRESETS.length,
    };
  });

  check(probe.count === 25, `25 LUT names enumerated (${probe.count})`);
  check(probe.size === 32 && probe.dataLen === 32 * 32 * 32 * 3,
    `"Batman" parsed as LUT_3D_SIZE ${probe.size}, ${probe.dataLen} floats`);
  check(probe.delta > 12, `LUT visibly changes pixels (delta ${probe.delta.toFixed(1)})`);
  check(probe.zeroDelta === 0, `intensity 0 is a no-op (delta ${probe.zeroDelta})`);
  check(probe.bwSpread < 0.06, `"B&W Film" desaturates (channel spread ${probe.bwSpread.toFixed(4)})`);
  check(probe.thumbIsPng, "LUT thumbnail generated as PNG data URL");
  check(probe.thumbDiffersFromRef, "graded thumbnail differs from the neutral reference");

  /* browser UI ------------------------------------------------------------- */
  await page.click('[data-inspector="fx"]');
  await page.waitForTimeout(400);
  await page.locator('.tl-clip[data-type="video"]').first().click({ force: true });
  await page.waitForTimeout(300);

  const grid = await page.evaluate(() => {
    const g = document.getElementById("lutGrid");
    return {
      tiles: g ? g.querySelectorAll(".lut-tile").length : -1,
      graded: g ? g.querySelectorAll(".lut-tile:not(.pending)").length : -1,
      options: Array.from(document.querySelectorAll("#fxLut optgroup")).map((o) => o.label),
      cubeOptions: document.querySelectorAll('#fxLut option[value^="cube:"]').length,
    };
  });
  check(grid.tiles === 25, `LUT browser renders ${grid.tiles} tiles`);
  check(grid.graded === 25, `all ${grid.graded} tiles graded (not left on the neutral chart)`);
  check(grid.cubeOptions === 25, `FX dropdown exposes all 25 .CUBE looks`);

  // click a tile -> select must take the value
  await page.locator('#lutGrid .lut-tile').nth(4).click();
  await page.waitForTimeout(300);
  const applied = await page.evaluate(() => ({
    sel: document.getElementById("fxLut").value,
    active: document.querySelectorAll("#lutGrid .lut-tile.active").length,
  }));
  check(applied.sel.startsWith("cube:"), `clicking a tile applies it (${applied.sel})`);
  check(applied.active === 1, "exactly one tile marked active");

  // search filter
  await page.fill("#lutSearch", "cyber");
  await page.waitForTimeout(200);
  const filtered = await page.evaluate(() => document.querySelectorAll("#lutGrid .lut-tile").length);
  check(filtered === 2, `search narrows to the Cyberpunk pair (${filtered})`);
  await page.fill("#lutSearch", "");

  console.log("\n=== PASS ===");
  ok.forEach((m) => console.log("  ✓ " + m));
  if (fail.length) { console.log("\n=== FAIL ==="); fail.forEach((m) => console.log("  ✗ " + m)); }
  console.log("\n=== PROBE ===");
  console.log(JSON.stringify(probe, null, 1));
  console.log("=== ERRORS (" + errors.length + ") ===");
  errors.slice(0, 10).forEach((e) => console.log("  ! " + e));

  await browser.close();
  process.exit(fail.length || errors.length ? 1 : 0);
})().catch((e) => { console.error("FATAL", e); process.exit(2); });
