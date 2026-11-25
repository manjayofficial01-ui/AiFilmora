/* capture-release.cjs — take the release screenshots from the REAL desktop app.
 *
 * These are not mock-ups: the Electron shell is launched, the bundled
 * FFmpeg sidecar is live (so the export sheet shows a real .mp4, not the
 * browser build's WebM fallback), a real video and a real audio file are
 * imported so the timeline shows actual filmstrips and a real waveform, and
 * every frame is captured from the running window.
 */
const { _electron } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname);
const OUT = path.join(ROOT, "docs", "images");
const EXE = path.join(ROOT, "node_modules", "electron", "dist", "electron.exe");
const VIDEO = path.join(ROOT, "assets", "FFAIToolbox", "AI Video Enhancer 420-276.mp4");
const AUDIO = path.join(ROOT, "assets", "AIWatermark", "audioWatermarkForFilmora.mp3");

fs.mkdirSync(OUT, { recursive: true });

const shot = async (page, name) => {
  // Park the pointer away from the panels so no tooltip is caught in the
  // frame — a stuck tooltip over the media library is not the app.
  await page.mouse.move(760, 20);
  await page.waitForTimeout(400);
  const file = path.join(OUT, name);
  await page.screenshot({ path: file });
  const kb = Math.round(fs.statSync(file).size / 1024);
  console.log(`  saved ${name} (${kb} KB)`);
};

(async () => {
  const app = await _electron.launch({
    args: ["."],
    executablePath: EXE,
    cwd: ROOT,
    env: { ...process.env, AIFIMORA_SIDECAR_CACHE: path.join(ROOT, ".sidecar-cache") },
  });
  const page = await app.firstWindow();

  // Resize the REAL window. page.setViewportSize() only changes the CSS
  // viewport of an Electron page, which leaves the app's own layout
  // arithmetic out of step with the container it draws into.
  await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win.isMaximized()) win.unmaximize();
    win.setSize(1600, 980);
    win.center();
  });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2500);

  // Dismiss the first-run modal if it is up.
  await page.evaluate(() => {
    try { localStorage.setItem("aifilmora.firstRun.v1", "skip"); } catch {}
  });
  for (const sel of ["#frClose", "#frSkip", ".modal-backdrop .btn.primary"]) {
    const el = page.locator(sel).first();
    if (await el.count()) {
      try { await el.click({ timeout: 800 }); break; } catch { /* try the next */ }
    }
  }
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    document.querySelectorAll(".modal-backdrop").forEach((m) => {
      if (m.id !== "exportModal" && getComputedStyle(m).display !== "none") m.style.display = "none";
    });
    // A wider media library, the way a user would drag the resizer.
    localStorage.setItem("aifimora.layout.v1", JSON.stringify({
      "--sidebar-w": "400px", "--inspector-w": "330px", "--timeline-h": "320px",
    }));
    window.dispatchEvent(new Event("resize"));
  });
  await page.waitForTimeout(900);

  console.log("capturing:");

  // 1. The editor, with REAL media on the timeline so the filmstrip and the
  //    waveform are the real ones, drawn from the real files.
  await page.setInputFiles("#fileImport", [VIDEO, AUDIO]);
  await page.waitForTimeout(4000);

  const built = await page.evaluate(() => {
    const s = window.__aifimoraStore;
    const st = s.get();
    const withUrl = (m) => m && m.url && !m._offline;
    const realVideo = st.media.find((m) => m.kind === "video" && withUrl(m));
    const realAudio = st.media.find((m) => m.kind === "audio" && withUrl(m));
    if (!realVideo) return { ok: false, media: st.media.length };
    const fx = { ...(st.clips[0]?.fx || {}) };
    const titleClips = st.clips.filter((c) => c.trackId === "t1");
    s.pushUndo("release screenshot project");
    s.state.clips = [
      { id: "clip_real_v", mediaId: realVideo.id, name: realVideo.name, type: "video", trackId: "v1", start: 0, duration: Math.min(realVideo.duration || 8, 9), fx: { ...fx } },
      ...(realAudio ? [{ id: "clip_real_a", mediaId: realAudio.id, name: realAudio.name, type: "audio", trackId: "a1", start: 0, duration: realAudio.duration || 8, fx: { ...fx } }] : []),
      ...titleClips,
    ];
    s.emit();
    return { ok: true, video: realVideo.name, audio: realAudio ? realAudio.name : "(none)" };
  });
  console.log("  project:", JSON.stringify(built));
  await page.waitForTimeout(4500);
  await shot(page, "01-editor.png");
  console.log("  status bar:", await page.evaluate(() => document.querySelector("#statVersion")?.textContent || "(none)"));
  console.log("  media in the project:", await page.evaluate(() => (window.__aifimoraStore?.get()?.media || []).length));

  // 2. The media library — real Filmora asset packs.
  const libTab = page.locator('#libraryTabs .tab[data-sidebar="assets"]');
  if (await libTab.count()) {
    await libTab.click();
    await page.waitForTimeout(1600);
    await shot(page, "02-asset-library.png");
    const mediaTab = page.locator('#libraryTabs .tab[data-sidebar="media"]');
    if (await mediaTab.count()) { await mediaTab.click(); await page.waitForTimeout(700); }
  }

  // 3. Colour scopes — a signature panel, live from the program monitor.
  const scopeTab = page.locator('#inspectorTabs .tab[data-inspector="scopes"]');
  if (await scopeTab.count()) {
    await scopeTab.click();
    await page.waitForTimeout(1800);
    await shot(page, "03-color-scopes.png");
  }

  // 4. The export sheet — the real one, with the encoder available.
  await page.click("#btnExport");
  await page.waitForTimeout(1000);
  if (await page.locator("#exportModal").count()) {
    await shot(page, "04-export.png");
    const ext = await page.evaluate(() => {
      const el = document.querySelector("#exportContainer, #exportExt, #exportFormat");
      return el ? el.value || el.textContent : "";
    });
    console.log("  export extension shown:", ext || "(n/a)");
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);

  // 5. The timeline, zoomed in so the filmstrips and waveform are visible.
  await page.mouse.move(800, 880);
  for (let i = 0; i < 6; i++) { await page.keyboard.press("+"); await page.waitForTimeout(150); }
  await page.waitForTimeout(1600);
  await shot(page, "05-timeline-detail.png");

  console.log("done");
  await app.close();
})().catch((e) => { console.error("CRASH: " + (e?.stack || e)); process.exit(1); });
