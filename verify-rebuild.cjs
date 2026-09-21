const { chromium } = require("playwright");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = __dirname;
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: "chrome" });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
    await page.waitForFunction(() => window.__aifimoraStore && document.querySelectorAll("#transPresetGrid button").length === 4);
    await page.click("#frEmpty");
    await page.click('[data-sidebar="transitions"]');
    const result = await page.evaluate(() => {
      const store = window.__aifimoraStore;
      store.set({ clips: [
        { id: "verify-a", type: "video", trackId: "v1", start: 0, duration: 4, name: "A" },
        { id: "verify-b", type: "video", trackId: "v1", start: 4, duration: 4, name: "B" }
      ], selectedClipId: "verify-a" });
      const values = [];
      for (const tile of document.querySelectorAll("#transPresetGrid button")) {
        tile.click();
        values.push({ name: tile.textContent.trim(), type: store.getClip("verify-a").outTransition?.type });
        store.undo();
        if (store.getClip("verify-a").outTransition) throw new Error("Transition undo failed");
      }
      store.set({ selectedClipId: null });
      document.querySelector("#transPresetGrid button").click();
      return values;
    });
    assert.equal(result.length, 4);
    for (const item of result) {
      const expected = /white/i.test(item.name) ? "dipWhite" : /fade/i.test(item.name) ? "dipBlack" : "dissolve";
      assert.equal(item.type, expected, item.name);
    }
    await page.evaluate(() => window.__aifimoraStore.set({ selectedClipId: "verify-a" }));
    await page.click('[data-sidebar="filters"]');
    assert.equal(await page.locator('#side-filters .library-asset-card').count(), 54);
    await page.locator('#side-filters [data-asset-kind="color"]').first().click();
    assert.ok(await page.evaluate(() => window.__aifimoraStore.getClip("verify-a").fx.colorPreset));
    await page.evaluate(() => window.__aifimoraStore.undo());
    assert.ok(!await page.evaluate(() => window.__aifimoraStore.getClip("verify-a").fx?.colorPreset));
    await page.locator('#side-filters [data-asset-kind="lut"]').first().click();
    assert.ok(await page.evaluate(() => window.__aifimoraStore.getClip("verify-a").fx.lut));
    await page.evaluate(() => window.__aifimoraStore.undo());
    await page.getByRole('searchbox', { name: 'Search Filters', exact: true }).fill('no-such-preset-123');
    assert.equal(await page.locator('#side-filters .library-asset-card').count(), 0);
    await page.getByRole('searchbox', { name: 'Search Filters', exact: true }).fill('');
    await page.click('[data-sidebar="audio"]');
    assert.equal(await page.locator('#side-audio .library-asset-card').count(), 76);
    await page.locator('#side-audio .library-asset-card').first().click();
    assert.equal(await page.evaluate(() => window.__aifimoraStore.getClip("verify-a").audioFx.length), 1);
    await page.evaluate(() => window.__aifimoraStore.undo());
    assert.ok(!await page.evaluate(() => window.__aifimoraStore.getClip("verify-a").audioFx?.length));
    for (const width of [1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await page.locator('.sidebar-view.active').count(), 1);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    // Shapes panel regression (in-page version of legacy verify-shapes.cjs — no external server needed)
    await page.click('[data-sidebar="shapes"]');
    const shapes = await page.evaluate(() => ({
      built: document.querySelectorAll("#shapeGrid .preset").length,
      cats: document.querySelectorAll("#shapeCats .chip").length,
      hasImport: !!document.getElementById("btnImportShapes"),
      hasStrokeStyle: !!document.getElementById("shapeStrokeStyle"),
      barInPlace: !!document.querySelector(".library-category-bar #libraryTabs"),
      oneActive: document.querySelectorAll(".sidebar-view.active").length,
    }));
    assert.ok(shapes.built > 0, "shape grid builds");
    assert.ok(shapes.cats >= 5, "shape categories render");
    assert.ok(shapes.hasImport && shapes.hasStrokeStyle, "shape tools intact");
    assert.equal(shapes.barVisible ?? shapes.barInPlace, true, "category bar hosts the tab strip");
    assert.equal(shapes.oneActive, 1, "exactly one sidebar view active");
    await page.click('[data-shape-cat="badge"]');
    const badgeCount = await page.evaluate(() => document.querySelectorAll("#shapeGrid .preset").length);
    assert.ok(badgeCount > 0 && badgeCount < shapes.built, "badge category filters the shape grid");
    await page.click('[data-sidebar="filters"]');
    await page.click('#fmVersion > summary');
    assert.match(await page.locator('#fmVersion .fm-info-row').first().innerText(), /AiFilmora 2\.2\.2/, "Version menu shows 2.2.2");
    assert.match(await page.locator('.statusbar').innerText(), /AiFilmora 2\.2\.2/, "Status bar shows 2.2.2");
    await page.click('#fmVersion [data-fm="release-notes"]');
    assert.match(await page.locator('#releaseNotesModal h3').innerText(), /AiFilmora 2\.2\.2/, "Release notes show 2.2.2");
    await page.click('#releaseNotesOk');
    assert.deepEqual(errors, []);
    console.log("PASS: 4 transition mappings + undo, 54 filters, 76 audio presets, preset application + undo, search, shape grid intact + category filter, 3 viewport widths; no page errors.");
    await page.screenshot({ path: path.join(root, "output-rebuild.png") });
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
