/* Export happy-path: short timeline + stubbed desktop dialog → real file saved.
 *
 * This is the suite that caught the mix-bus regression: a project whose
 * timeline has no imported media has no Web Audio graph, so the bus track
 * stalled — and a MediaRecorder carrying a stalled audio track records
 * nothing at all, not even the video. The export produced an empty file.
 * The assertions below are that guard.
 */
const { chromium } = require("playwright");
const URL = "http://127.0.0.1:8765/index.html";

const checks = [];
const ok = (name, pass, extra = "") => {
  checks.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
};

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
  const finalStatus = await page.locator("#exportStatus").textContent();
  console.log("finalStatus=" + finalStatus);
  const savedFiles = await page.evaluate(() => JSON.stringify(window.__savedFiles));
  console.log("savedFiles=" + savedFiles);
  console.log("historyPath=" + (await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem("aifimora.project.v1") || "{}");
    const h = (p.history || []).filter((x) => x && x.type === "export").pop();
    return h ? h.outputPath + " bytes=" + h.bytes : "none";
  })));

  /* The assertions. */
  const files = JSON.parse(savedFiles);
  const written = Object.keys(files);
  ok("the export wrote a file", written.length === 1, savedFiles);
  ok("the file has real content", (files[written[0]] || 0) > 1000, `${files[written[0]] || 0} bytes`);
  ok("the export reports success", /Saved/.test(finalStatus || ""), finalStatus);
  ok("the export says what it produced", /preview export|WebM|MP4/.test(finalStatus || ""), finalStatus);

  /* The extension must be the one this build can really deliver. The stub
   * has no media sidecar, so there is no encoder and the honest answer is
   * a WebM — never a .mp4 it cannot write. */
  const ext = written[0] ? written[0].split(".").pop().toLowerCase() : "";
  ok("the extension is the one this build can deliver", ext === "webm", `ext=${ext}`);
  const callExt = await page.evaluate(() => window.__saveCalls[0]?.ext || "");
  ok("the save dialog was asked for that extension", callExt === "webm", `ext=${callExt}`);

  const history = await page.evaluate(() => {
    const p = JSON.parse(localStorage.getItem("aifimora.project.v1") || "{}");
    const h = (p.history || []).filter((x) => x && x.type === "export").pop();
    return h ? { path: h.outputPath, bytes: h.bytes } : null;
  });
  ok("the export is in the undo history", !!history && history.bytes > 1000, JSON.stringify(history));

  // Cancel path.
  await page.evaluate(() => { window.aifimoraDesktop.saveVideo = async () => null; });
  await page.click("#btnExport");
  await page.waitForTimeout(200);
  await page.click("#exportStart");
  await page.waitForTimeout(700);
  const cancelStatus = await page.locator("#exportStatus").textContent();
  console.log("cancelStatus=" + cancelStatus);
  ok("cancelling the save writes no second file", Object.keys(await page.evaluate(() => window.__savedFiles)).length === 1, "one file");

  console.log("errors: " + (errors.length ? errors.join(" | ") : "none"));
  ok("no page errors", errors.length === 0, errors.join(" | "));

  await browser.close();
  const failed = checks.filter((c) => !c.pass).length;
  console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("CRASH: " + (e?.stack || e)); process.exit(1); });
