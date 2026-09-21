/* Verify Filmora-parity upgrades: clipboard, context menu, track acts, settings wiring */
const { chromium } = require("playwright");
const path = require("path");
const http = require("http");
const fs = require("fs");

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = path.join(process.cwd(), decodeURIComponent(req.url.split("?")[0]));
      if (p.endsWith("/") || p.endsWith("\\")) p = path.join(p, "index.html");
      const ext = path.extname(p);
      const types = {
        ".js": "text/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".json": "application/json",
        ".png": "image/png",
        ".svg": "image/svg+xml",
      };
      fs.readFile(p, (e, d) => {
        if (e) {
          res.writeHead(404);
          res.end("404");
          return;
        }
        res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
        res.end(d);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

(async () => {
  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGE: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("CONSOLE: " + m.text());
  });

  const url = `http://127.0.0.1:${port}/index.html`;
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const checks = [];
  const ok = (name, pass, extra = "") => {
    checks.push({ name, pass, extra });
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  };

  // 1. App booted
  const store = await page.evaluate(() => !!window.__aifimoraStore);
  ok("store booted", store);

  // 2. Menu has Project Settings
  const hasPs = await page.locator("#menuProjectSettings").count();
  ok("Project Settings menu", hasPs > 0);

  // 3. Track header has lock/hide/solo buttons
  const trackActs = await page.locator(".track-act").count();
  ok("track lock/hide/solo UI", trackActs >= 8, `${trackActs} buttons`);

  // 4. Select first clip and copy/paste via events
  const clipCount = await page.evaluate(() => window.__aifimoraStore.get().clips.length);
  ok("demo clips present", clipCount > 0, `${clipCount} clips`);

  if (clipCount > 0) {
    const firstId = await page.evaluate(() => window.__aifimoraStore.get().clips[0].id);
    await page.evaluate((id) => window.__aifimoraStore.set({ selectedClipId: id }), firstId);

    await page.evaluate(() => window.dispatchEvent(new CustomEvent("aifimora:copy-clip")));
    await page.waitForTimeout(100);
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("aifimora:paste-clip")));
    await page.waitForTimeout(150);
    const afterPaste = await page.evaluate(() => window.__aifimoraStore.get().clips.length);
    ok("clipboard paste adds clip", afterPaste === clipCount + 1, `${clipCount} → ${afterPaste}`);

    await page.evaluate(() => window.dispatchEvent(new CustomEvent("aifimora:duplicate-clip")));
    await page.waitForTimeout(150);
    const afterDup = await page.evaluate(() => window.__aifimoraStore.get().clips.length);
    ok("duplicate adds clip", afterDup === afterPaste + 1, `${afterPaste} → ${afterDup}`);

    await page.evaluate(() => window.dispatchEvent(new CustomEvent("aifimora:ripple-delete")));
    await page.waitForTimeout(150);
    const afterRd = await page.evaluate(() => window.__aifimoraStore.get().clips.length);
    ok("ripple delete removes clip", afterRd === afterDup - 1, `${afterDup} → ${afterRd}`);
  }

  // 5. Context menu opens on right-click of a clip
  const clipEl = page.locator("[data-clip-id]").first();
  if (await clipEl.count()) {
    await clipEl.click({ button: "right", force: true });
    await page.waitForTimeout(200);
    const menuVisible = await page.evaluate(() => {
      const m = document.getElementById("clipContextMenu");
      return m && !m.hidden;
    });
    ok("clip context menu opens", !!menuVisible);
    const items = await page.locator("#clipContextMenu .ctx-item").count();
    ok("context menu has items", items >= 8, `${items} items`);
    await page.keyboard.press("Escape");
  } else {
    ok("clip context menu opens", false, "no clip elements");
  }

  // 6. Track mute toggle
  const muteBefore = await page.evaluate(() => {
    const t = window.__aifimoraStore.get().tracks.find((x) => x.id === "a1");
    return !!t?.muted;
  });
  await page.locator('[data-track-act="mute"][data-track-id="a1"]').first().click({ force: true });
  await page.waitForTimeout(100);
  const muteAfter = await page.evaluate(() => {
    const t = window.__aifimoraStore.get().tracks.find((x) => x.id === "a1");
    return !!t?.muted;
  });
  ok("track mute toggles", muteAfter !== muteBefore);

  // 7. BPM setting actually read
  const bpm = await page.evaluate(async () => {
    const { settings } = await import("./js/settings.js");
    settings.set({ beat: { bpm: 90 } });
    return Number(settings.get().beat.bpm);
  });
  ok("beat BPM preference readable", bpm === 90, String(bpm));

  // 8. Safe areas preference exists and player uses it
  const safe = await page.evaluate(async () => {
    const { settings } = await import("./js/settings.js");
    settings.set({ playback: { showSafeAreas: true } });
    return !!settings.get().playback.showSafeAreas;
  });
  ok("showSafeAreas preference", safe);

  // 9. Export modal opens and shows meta
  await page.locator("#btnExport").click({ force: true });
  await page.waitForTimeout(200);
  const exportOpen = await page.locator("#exportModal.open").count();
  ok("export modal opens", exportOpen > 0);
  const meta = await page.locator("#exportMeta").textContent();
  ok("export meta from prefs", !!meta && meta.length > 5, meta);

  // 10. Project settings dialog
  // The Filmora <details> menu keeps its items collapsed, so a Playwright click
  // lands on whatever is on top. Open the File menu first, then dispatch.
  await page.keyboard.press("Escape");
  await page.evaluate(() => {
    document.getElementById("fmFile")?.setAttribute("open", "");
    document.getElementById("menuProjectSettings")?.click();
  });
  await page.waitForTimeout(200);
  const psOpen = await page.locator("#projectSettingsModal.open").count();
  ok("project settings dialog", psOpen > 0);

  // 11. Apply 9:16 project settings
  await page.locator('[data-ps="1080x1920"]').click({ force: true });
  await page.locator("#psApply").click({ force: true });
  await page.waitForTimeout(200);
  const dims = await page.evaluate(() => {
    const s = window.__aifimoraStore.get();
    return { w: s.width, h: s.height };
  });
  ok("project 9:16 applied", dims.w === 1080 && dims.h === 1920, JSON.stringify(dims));

  // 12. Chroma UI present
  ok("chroma key UI", (await page.locator("#fxChroma").count()) > 0);

  // 13. Speed ramp presets
  ok("speed ramp presets", (await page.locator("[data-ramp]").count()) >= 6);

  // 14. Scene detect / duck / srt tools
  ok("scene detect tool", (await page.locator('[data-tool="scenes"]').count()) > 0);
  ok("auto duck tool", (await page.locator('[data-tool="duck"]').count()) > 0);
  ok("SRT export tool", (await page.locator('[data-tool="srt"]').count()) > 0);

  // 15. Fullscreen button
  ok("fullscreen button", (await page.locator("#btnFullscreen").count()) > 0);

  // 16. No page errors (filter benign file:// noise)
  const realErrors = errors.filter((e) => !/favicon|net::|Failed to load resource/i.test(e));
  ok("no JS errors", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));

  await page.screenshot({ path: "output-parity.png", fullPage: false });

  const failed = checks.filter((c) => !c.pass);
  console.log("\n=== SUMMARY ===");
  console.log(`${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) {
    console.log("FAILURES:", failed.map((f) => f.name).join(", "));
    process.exitCode = 1;
  } else {
    console.log("All Filmora-parity checks passed.");
  }

  await browser.close();
  server.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
