/* Verifies the Electron shell: app:// protocol, asset fetches (LUTs), version labels. */
const { _electron } = require("playwright");
const path = require("node:path");
const assert = require("node:assert/strict");
const { dismissFirstRun } = require("./test-helpers.cjs");
const root = __dirname;

(async () => {
  const customExe = process.env.AIFIMORA_ELECTRON;
  // Dev: electron.exe + "." arg. Packaged: AiFilmora.exe with no args
  // (a stray "." arg breaks asset resolution in the packaged build).
  const exe = customExe || path.join(root, "node_modules", "electron", "dist", "electron.exe");
  const args = customExe ? [] : ["."];
  const app = await _electron.launch({ args, executablePath: exe, cwd: root });
  // The app must always be closed. Without this, an assertion failure leaves
  // the Electron child running, the node process never exits, and the runner
  // kills it at its 180 s timeout — which reports "exit null" and loses every
  // line of output, hiding the real failure.
  try {
    const page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    // Dismiss the first-run chooser (added after this script was written) so it
    // doesn't intercept later clicks. It opens 400 ms after boot, so wait for it
    // rather than sampling a boolean at an arbitrary moment.
    await dismissFirstRun(page, "#frEmpty");
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

    // App boots with version labels. The chooser is already dismissed above —
    // clicking #frEmpty a second time used to time out on the hidden button.
    await page.click("#fmVersion > summary");
    // Assert against the version the app actually ships, not a stale literal.
    const shipped = require("./package.json").version;
    assert.match(await page.locator("#fmVersion .fm-info-row").first().innerText(), new RegExp(`AiFilmora ${shipped.replace(/\./g, "\\.")}`));

    // Escape must close the open menu. A native <details> has no keyboard
    // dismissal of its own, so the panel used to stay open over the sidebar and
    // swallow the next click.
    await page.keyboard.press("Escape");
    const menusStillOpen = await page.evaluate(() => document.querySelectorAll(".fm-item[open]").length);
    assert.equal(menusStillOpen, 0, "Escape closes the open Filmora menu");

    // Filters library: LUT tiles get real thumbnails (proves loadLut works end-to-end)
    await page.click('[data-sidebar="filters"]');
    await page.waitForFunction(() => document.querySelectorAll("#side-filters .library-asset-card").length >= 54);
    await page.waitForFunction(() => document.querySelectorAll("#side-filters .library-asset-thumb img").length > 0, null, { timeout: 15000 });
    assert.deepEqual(errors, []);
    console.log("PASS electron: app:// LUT fetch + manifest + " + shipped + " labels + filter thumbnails");
  } finally {
    try { await app.close(); } catch { /* already gone */ }
  }
})().catch((e) => { console.error(e); process.exitCode = 1; });
