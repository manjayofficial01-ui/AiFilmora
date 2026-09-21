/* Export happy-path: short timeline + stubbed desktop dialog → real file saved. */
const { chromium } = require("playwright");
const URL = "http://127.0.0.1:8765/index.html";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  await page.addInitScript(() => {
    try { localStorage.setItem("aifilmora.firstRun.v1", "skip"); } catch {}
    window.__savedFiles = {};
    window.__saveCalls = [];
    window.aifimoraDesktop = {
      platform: "win32",
      saveVideo: async (opts) => {
        window.__saveCalls.push(opts);
        return "D:\\Videos\\AiFilmora\\Test Export.mp4";
      },
      openFolder: async () => "D:\\Videos\\AiFilmora",
      writeFile: async (p, b64) => {
        window.__savedFiles[p] = (b64 || "").length;
        return { ok: true, path: p, bytes: (b64 || "").length };
      },
    };
    delete window.showSaveFilePicker;
  });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  // Shrink to a ~2s timeline so realtime capture is fast.
  await page.evaluate(() => {
    const s = window.__aifimoraStore;
    const cur = s.get();
    const first = cur.clips[0];
    if (first) {
      s.pushUndo("shrink for export test");
      s.state.clips = [{ ...first, start: 0, duration: 2 }];
      s.emit();
    }
    return s.sequenceDuration();
  });
  const dur = await page.evaluate(() => window.__aifimoraStore.sequenceDuration());
  console.log("seqDur=" + dur);

  await page.click("#btnExport");
  await page.waitForTimeout(250);
  await page.fill("#exportFileName", "Test Export");
  await page.fill("#exportFolder", "D:\\Videos\\AiFilmora");
  await page.click("#exportStart");
  await page.waitForTimeout(600);
  console.log("saveCalls=" + (await page.evaluate(() => JSON.stringify(window.__saveCalls))));
  console.log("midStatus=" + (await page.locator("#exportStatus").textContent()));
  // Realtime capture of ~2s + overhead.
  await page.waitForTimeout(9000);
  console.log("finalStatus=" + (await page.locator("#exportStatus").textContent()));
  console.log("savedFiles=" + (await page.evaluate(() => JSON.stringify(window.__savedFiles))));
  console.log("historyPath=" + (await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem("aifimora.project.v1") || "{}");
    const h = (p.history || []).filter((x) => x && x.type === "export").pop();
    return h ? h.outputPath + " bytes=" + h.bytes : "none";
  })));
  // Cancel path.
  await page.evaluate(() => { window.aifimoraDesktop.saveVideo = async () => null; });
  await page.click("#btnExport");
  await page.waitForTimeout(200);
  await page.click("#exportStart");
  await page.waitForTimeout(700);
  console.log("cancelStatus=" + (await page.locator("#exportStatus").textContent()));
  console.log("errors: " + (errors.length ? errors.join(" | ") : "none"));
  await browser.close();
})().catch((e) => { console.error("CRASH: " + (e?.stack || e)); process.exit(1); });
