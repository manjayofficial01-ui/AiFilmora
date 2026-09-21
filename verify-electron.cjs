/* Verifies the Electron shell: app:// protocol, asset fetches (LUTs), version labels. */
const { _electron } = require("playwright");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = __dirname;

(async () => {
  const customExe = process.env.AIFIMORA_ELECTRON;
  // Dev: electron.exe + "." arg. Packaged: AiFilmora.exe with no args
  // (a stray "." arg breaks asset resolution in the packaged build).
  const exe = customExe || path.join(root, "node_modules", "electron", "dist", "electron.exe");
  const args = customExe ? [] : ["."];
  const app = await _electron.launch({ args, executablePath: exe, cwd: root });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  // Dismiss the first-run chooser (added after this script was written) so it
  // doesn't intercept later clicks.
  if (await page.evaluate(() => document.getElementById("firstRunModal")?.classList.contains("open"))) {
    await page.click("#frEmpty");
    await page.waitForTimeout(400);
  }
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // The regression this guards: fetch() of a bundled LUT over app://
  const lutFetch = await page.evaluate(async () => {
    try {
      const res = await fetch("assets/configs/ColorAnd3dLutPreset/CubeLUTFiles/Batman.CUBE");
      const text = res.ok ? await res.text() : "";
      return { ok: res.ok, lines: text.split("\n").length };
    } catch (e) { return { ok: false, error: String(e) }; }
  });
  assert.equal(lutFetch.ok, true, "LUT .CUBE fetch works in Electron: " + JSON.stringify(lutFetch));
  assert.ok(lutFetch.lines > 1000, "LUT payload looks real (" + lutFetch.lines + " lines)");

  // Shape manifest (fetch-based too)
  const manifest = await page.evaluate(async () => {
    const r = await fetch("assets/shapes/manifest.json");
    return r.ok ? (await r.json()).items?.length ?? 0 : -1;
  });
  assert.ok(manifest >= 1, "shape manifest loads over app:// (" + manifest + " items)");

  // App boots with version labels
  await page.click("#frEmpty");
  await page.click("#fmVersion > summary");
  assert.match(await page.locator("#fmVersion .fm-info-row").first().innerText(), /AiFilmora 2\.2\.2/);

  // Filters library: LUT tiles get real thumbnails (proves loadLut works end-to-end)
  await page.keyboard.press("Escape");
  await page.click('[data-sidebar="filters"]');
  await page.waitForFunction(() => document.querySelectorAll("#side-filters .library-asset-card").length >= 54);
  await page.waitForFunction(() => document.querySelectorAll("#side-filters .library-asset-thumb img").length > 0, null, { timeout: 15000 });
  assert.deepEqual(errors, []);
  console.log("PASS electron: app:// LUT fetch + manifest + 2.2.2 labels + filter thumbnails");
  await app.close();
})().catch((e) => { console.error(e); process.exitCode = 1; });