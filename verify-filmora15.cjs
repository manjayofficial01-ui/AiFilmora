/* Verify Filmora 15 round-3 parity: Pen Tool, Animated Charts, Text Path,
 * Audio Visualizer, Video Chapters, Subtitle Extractor, Voice Changer,
 * AI SFX, Auto Sync, Multi-Clip batch editing, Motion Blur / Deflicker,
 * Subprojects, Creative Tools preferences, 32-bit audio pipeline setting. */
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
      const types = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
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
  await page.waitForTimeout(900);

  const checks = [];
  const ok = (name, pass, extra = "") => {
    checks.push({ name, pass });
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  };
  const canvasSig = () =>
    page.evaluate(() => {
      const c = document.getElementById("previewCanvas");
      const d = c.getContext("2d").getImageData(0, 0, Math.min(c.width, 320), Math.min(c.height, 180)).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 40) sum += d[i] + d[i + 1] + d[i + 2];
      return sum;
    });

  // 1. App booted
  ok("app booted", await page.evaluate(() => !!window.__aifimoraStore));

  // 2. Creative tool buttons present
  const tools = await page.evaluate(() =>
    ["toolPen", "toolTextPath", "toolChart", "toolChartImport", "toolVisualizer", "toolSubtitles", "toolChapterAdd", "toolChapterExport", "toolVoiceChanger", "toolVoiceClone", "toolSfx", "toolAutoSync", "toolBatch", "toolMotionBlur", "toolDeflicker", "toolSubproject"].map((id) => !!document.getElementById(id))
  );
  ok("16 Filmora-15 tool buttons present", tools.every(Boolean), `${tools.filter(Boolean).length}/16`);

  // 3. Creative inspector tab
  await page.click('[data-inspector="creative"]');
  await page.waitForTimeout(150);
  const insp = await page.evaluate(() => ({
    view: !!document.getElementById("insp-creative"),
    label: !!document.getElementById("creativeClipLabel"),
    props: !!document.getElementById("creativeClipProps"),
    chapters: !!document.getElementById("chapterList"),
    addBtn: !!document.getElementById("btnChapterAdd"),
    expBtn: !!document.getElementById("btnChapterExport"),
  }));
  ok("Creative inspector panel", Object.values(insp).every(Boolean));

  // 4. Pen Tool → path clip
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aifimora:pen-tool")));
  await page.waitForTimeout(100);
  const box = await page.locator("#previewCanvas").boundingBox();
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.3);
  await page.waitForTimeout(100);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  const penClip = await page.evaluate(() => {
    const s = window.__aifimoraStore.get();
    return s.clips.find((c) => c.shape?.type === "path" && c.shape.points?.length === 3);
  });
  ok("Pen Tool creates Pen Path clip", !!penClip, penClip ? `${penClip.shape.points.length} pts` : "");
  const sigPen = await canvasSig();
  ok("pen path renders on program monitor", sigPen > 1000, `sig=${sigPen}`);

  // 5. Animated Chart clip + render
  const chartOk = await page.evaluate(async () => {
    const m = await import("./js/creative-tools.js");
    const series = m.parseChartCsv("Q1,32\nQ2,48\nQ3,41\nQ4,67");
    const clip = m.addChartClip(series, "Revenue");
    return { series: series.length === 4, made: !!clip?.chart, type: clip?.chart?.type };
  });
  ok("Animated Chart from CSV", chartOk.series && chartOk.made && chartOk.type === "bar");
  await page.evaluate(() => window.__aifimoraPlayer.render());
  await page.waitForTimeout(100);
  const sigChart = await canvasSig();
  ok("chart renders on program monitor", sigChart > 1000, `sig=${sigChart}`);

  // 6. Audio Visualizer clip + render
  const vzOk = await page.evaluate(async () => {
    const m = await import("./js/creative-tools.js");
    const clip = m.addVisualizerClip("bars");
    return !!clip?.visualizer && clip.visualizer.mode === "bars";
  });
  await page.evaluate(() => window.__aifimoraPlayer.render());
  await page.waitForTimeout(100);
  ok("Audio Visualizer clip + render", vzOk && (await canvasSig()) > 1000);

  // 7. Text Path on a title clip
  const tpOk = await page.evaluate(async () => {
    const { store } = await import("./js/state.js");
    const clip = store.addClip({ type: "text", trackId: "t1", start: 0.5, duration: 3, name: "TP", text: "Hello Path", textStyle: { content: "Hello Path" } });
    store.updateClip(clip.id, { textPath: { points: [[0.1, 0.2], [0.5, 0.5], [0.9, 0.3]], content: "Hello Path" } });
    return !!store.getClip(clip.id).textPath;
  });
  await page.evaluate(() => window.__aifimoraPlayer.render());
  await page.waitForTimeout(100);
  ok("Text Path renders", tpOk && (await canvasSig()) > 1000);

  // 8. Video Chapters
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aifimora:add-chapter")));
  await page.evaluate(() => {
    window.__aifimoraPlayer.seek(6);
    window.dispatchEvent(new CustomEvent("aifimora:add-chapter"));
  });
  await page.waitForTimeout(150);
  const chapters = await page.evaluate(() => window.__aifimoraStore.get().chapters.length);
  const ts = await page.evaluate(async () => {
    const m = await import("./js/creative-tools.js");
    return m.chaptersToTimestamps();
  });
  ok("Video Chapters added + timestamps", chapters >= 2 && /00:00/.test(ts), ts.split("\n")[0]);
  await page.evaluate(() => window.__aifimoraPlayer.render());
  await page.waitForTimeout(100);
  ok("chapters bar renders", (await canvasSig()) > 1000);

  // 9. Subtitle Extractor
  const subOk = await page.evaluate(async () => {
    const { store } = await import("./js/state.js");
    const m = await import("./js/creative-tools.js");
    const vid = store.get().clips.find((c) => c.type === "video");
    if (!vid) return { skip: true };
    const before = store.get().captions.length;
    const caps = m.extractSubtitles(vid.id);
    return { added: store.get().captions.length > before, n: caps?.length || 0 };
  });
  ok("Subtitle Extractor adds captions", subOk.skip || subOk.added, `+${subOk.n || 0}`);

  // 10. Voice Changer
  const vcOk = await page.evaluate(async () => {
    const { store } = await import("./js/state.js");
    const m = await import("./js/creative-tools.js");
    const audio = store.get().clips.find((c) => c.type === "audio");
    if (!audio) return false;
    store.set({ selectedClipId: audio.id });
    m.applyVoiceChanger("chipmunk");
    return store.getClip(audio.id).fx?.voiceChanger?.id === "chipmunk";
  });
  ok("Voice Changer preset applies", vcOk);

  // 11. AI SFX Generator
  const sfxOk = await page.evaluate(async () => {
    const { store } = await import("./js/state.js");
    const m = await import("./js/creative-tools.js");
    const before = store.get().clips.length;
    const mediaBefore = store.get().media.length;
    m.generateSfx("cinematic whoosh");
    const s = store.get();
    const clip = s.clips[s.clips.length - 1];
    return s.clips.length === before + 1 && s.media.length === mediaBefore + 1 && clip.type === "audio" && clip.trackId === "a2" && /SFX/.test(clip.name);
  });
  ok("AI SFX Generator → A2 clip", sfxOk);

  // 12. Auto Sync audio → video (targets video under playhead, else nearest)
  const syncOk = await page.evaluate(async () => {
    const { store } = await import("./js/state.js");
    const m = await import("./js/creative-tools.js");
    const audio = store.get().clips.find((c) => c.type === "audio");
    if (!audio) return false;
    store.set({ selectedClipId: audio.id });
    m.autoSyncAudio();
    const a1 = store.getClip(audio.id).start;
    const vids = store.get().clips.filter((c) => c.type !== "audio" && c.type !== "text");
    return vids.some((v) => Math.abs(a1 - v.start) <= 0.51);
  });
  ok("Auto Sync aligns audio to video", syncOk);

  // 13. Motion Blur / Deflicker toggles + render
  const fxOk = await page.evaluate(async () => {
    const { store } = await import("./js/state.js");
    const vid = store.get().clips.find((c) => c.type === "video");
    store.set({ selectedClipId: vid.id });
    document.getElementById("toolMotionBlur").click();
    document.getElementById("toolDeflicker").click();
    await new Promise((r) => setTimeout(r, 150));
    const c = store.getClip(vid.id);
    return c.fx?.motionBlur > 0 && c.fx?.deflicker > 0;
  });
  await page.evaluate(() => window.__aifimoraPlayer.render());
  await page.waitForTimeout(100);
  ok("Motion Blur + Flicker Removal apply + render", fxOk && (await canvasSig()) > 1000);

  // 14. Multi-Clip batch edit dialog
  await page.evaluate(() => document.getElementById("toolBatch").click());
  await page.waitForTimeout(150);
  const batchOpen = await page.evaluate(() => !!document.getElementById("batchModal"));
  const batchOk = await page.evaluate(async () => {
    const { store } = await import("./js/state.js");
    const modal = document.getElementById("batchModal");
    modal.querySelector("#batchScope").value = "video";
    modal.querySelector("#batchMb").value = "60";
    modal.querySelector("#batchMb").dispatchEvent(new Event("input"));
    modal.querySelector("#batchApplyBtn").click();
    await new Promise((r) => setTimeout(r, 200));
    const vids = store.get().clips.filter((c) => c.type !== "audio" && c.type !== "text");
    return vids.length > 0 && vids.every((c) => store.getClip(c.id).fx?.motionBlur === 60);
  });
  ok("Multi-Clip batch edit applies", batchOpen && batchOk);

  // 15. Undo restores previous state (snapshot integrity)
  const undoOk = await page.evaluate(async () => {
    const { store } = await import("./js/state.js");
    const vids = store.get().clips.filter((c) => c.type !== "audio" && c.type !== "text");
    const before = vids.every((c) => store.getClip(c.id).fx?.motionBlur === 60);
    store.undo();
    const after = store.get().clips.filter((c) => c.type !== "audio" && c.type !== "text");
    const restored = after.every((c) => store.getClip(c.id).fx?.motionBlur !== 60);
    return before && restored;
  });
  ok("undo reverses batch edit", undoOk);

  // 16. Creative Tools preferences pane
  await page.evaluate(() => document.querySelector("#menuPreferences")?.click());
  await page.waitForTimeout(250);
  const toolsPane = await page.evaluate(() => {
    const navBtn = [...document.querySelectorAll(".settings-nav button")].find((b) => /Creative Tools/i.test(b.textContent));
    if (!navBtn) return { has: false, tabs: document.querySelectorAll(".settings-nav button").length };
    navBtn.click();
    return { has: !!document.querySelector('#settingsModalBody [data-pane="tools"]'), tabs: document.querySelectorAll(".settings-nav button").length };
  });
  await page.waitForTimeout(150);
  ok("Preferences → Creative Tools pane", toolsPane.has, `${toolsPane.tabs} panes`);

  // 17. New prefs persisted
  const prefs = await page.evaluate(async () => {
    const { settings } = await import("./js/settings.js");
    return {
      bitDepth: settings.get().audio?.bitDepth,
      sfx: settings.get().ai?.sfxDuration,
      pen: settings.get().editing?.penStrokeW,
      chart: settings.get().editing?.chartType,
      vz: settings.get().editing?.visualizerStyle,
      chaptersBar: settings.get().editing?.chaptersBar,
    };
  });
  ok(
    "new prefs persisted (bitDepth/sfx/pen/chart/vz/chaptersBar)",
    prefs.bitDepth === "32f" && prefs.sfx === 2 && prefs.pen === 6 && prefs.chart === "bar" && prefs.vz === "bars" && prefs.chaptersBar === true,
    JSON.stringify(prefs)
  );

  // 18. Subproject API present
  const subprojectApi = await page.evaluate(async () => {
    const m = await import("./js/creative-tools.js");
    return typeof m.importSubproject === "function" && typeof m.autoSyncAudio === "function";
  });
  ok("Import Subproject API", subprojectApi);

  // 19. No JS errors during the whole run
  ok("no JS errors", errors.length === 0, errors.slice(0, 3).join(" | "));

  const passed = checks.filter((c) => c.pass).length;
  console.log(`\n${passed}/${checks.length} Filmora-15 checks passed`);
  await browser.close();
  server.close();
  process.exit(passed === checks.length ? 0 : 1);
})();
