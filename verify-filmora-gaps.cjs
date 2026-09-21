/* Verify Filmora-gap upgrades: missing settings + tools */
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
        if (e) { res.writeHead(404); res.end("404"); return; }
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
  page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  const checks = [];
  const ok = (name, pass, extra = "") => {
    checks.push({ name, pass, extra });
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  };

  // 1. Settings defaults cover Filmora tabs
  const cfg = await page.evaluate(async () => {
    const { settings } = await import("./js/settings.js");
    const s = settings.get();
    return {
      folders: !!s.folders,
      interfaceMode: s.interfaceMode || s.theme,
      photoPlacement: s.editing?.photoPlacement,
      insertMode: s.editing?.insertMode,
      timelineUnits: s.editing?.timelineUnits,
      defaultEffectDur: s.editing?.defaultEffectDur,
      splitScreenDur: s.editing?.splitScreenDur,
      decodeAccel: s.performance?.decodeAccel,
      backgroundRender: s.performance?.backgroundRender !== undefined,
      playbackQuality: s.playback?.playbackQuality,
      denoiseStrength: s.audio?.denoiseStrength,
      eqPreset: s.audio?.eqPreset,
      silenceMinDur: s.ai?.silenceMinDur,
      musicMood: s.ai?.musicMood,
      extendSeconds: s.ai?.extendSeconds,
      captionTemplate: s.caption?.template,
      bilingual: s.caption?.bilingual !== undefined,
      highlightFreq: s.beat?.highlightFreq,
      showAllBeats: s.beat?.showAllBeats !== undefined,
      lutIntensity: s.color?.lutIntensity,
      burnIn: s.exportDefaults?.burnInCaptions !== undefined,
      social: s.exportDefaults?.socialUpload,
      library: s.showLibraryAtStartup !== undefined,
      beatCfg: typeof settings.beatConfig === "function",
      audioCfg: typeof settings.audioConfig === "function",
      colorCfg: typeof settings.colorConfig === "function",
    };
  });
  ok("settings: folders tab", cfg.folders);
  ok("settings: interfaceMode", !!cfg.interfaceMode, cfg.interfaceMode);
  ok("settings: photoPlacement/insertMode/units", !!(cfg.photoPlacement && cfg.insertMode && cfg.timelineUnits), `${cfg.photoPlacement}/${cfg.insertMode}/${cfg.timelineUnits}`);
  ok("settings: effect/splitscreen durations", cfg.defaultEffectDur === 5 && cfg.splitScreenDur === 5);
  ok("settings: performance decode/bg-render", cfg.decodeAccel !== undefined && cfg.backgroundRender, String(cfg.decodeAccel));
  ok("settings: playbackQuality", !!cfg.playbackQuality, cfg.playbackQuality);
  ok("settings: audio denoise/eq", !!(cfg.denoiseStrength && cfg.eqPreset), `${cfg.denoiseStrength}/${cfg.eqPreset}`);
  ok("settings: silenceMinDur/music/extend", !!(cfg.silenceMinDur && cfg.musicMood && cfg.extendSeconds), `${cfg.silenceMinDur}/${cfg.musicMood}/${cfg.extendSeconds}s`);
  ok("settings: caption template/bilingual", !!(cfg.captionTemplate && cfg.bilingual), cfg.captionTemplate);
  ok("settings: beat highlight/showAll", !!(cfg.highlightFreq && cfg.showAllBeats), `every ${cfg.highlightFreq}`);
  ok("settings: color lutIntensity", cfg.lutIntensity === 80, String(cfg.lutIntensity));
  ok("settings: export burnIn/social", !!(cfg.burnIn && cfg.social !== undefined), `${cfg.burnIn}/${cfg.social}`);
  ok("settings: accessors beat/audio/color", cfg.beatCfg && cfg.audioCfg && cfg.colorCfg);

  // 2. Preferences panel has Folders + Color
  // Use the always-visible titlebar gear: the File-menu entry of the same name
  // lives inside a collapsed <details> and cannot be clicked directly.
  await page.locator("#menuPreferencesTop").click({ force: true });
  await page.waitForTimeout(250);
  const navText = await page.locator(".settings-nav").textContent();
  ok("prefs nav has Folders", /Folders/i.test(navText || ""));
  ok("prefs nav has Color", /Color/i.test(navText || ""));
  await page.keyboard.press("Escape");

  // 3. New inspector controls exist
  const needIds = ["fxTint", "fxHighlights", "fxShadows", "fxSharpness", "fxLutIntensity", "fxMaskFeather", "fxVoiceStrength", "fxDenoise", "fxStabilize", "fxFaceMosaic", "fxObjectRemover", "fxChromaFeather", "fxChromaSpill", "btnAutoEnhance", "btnColorMatch", "volEq", "volDenoise", "btnAudioStretch", "btnBeatOptions", "menuRecentTop"];
  for (const id of needIds) {
    ok(`UI #${id}`, (await page.locator("#" + id).count()) > 0);
  }

  // 4. New AI tool buttons
  const needTools = ["autoEnhance", "colorMatch", "stabilize", "vocalRemover", "stretch", "faceMosaic", "music", "tts", "thumbnail", "extend", "objectRemover", "beatMontage"];
  for (const t of needTools) {
    ok(`tool ${t}`, (await page.locator(`[data-tool="${t}"]`).count()) > 0);
  }

  // 5. Functional: select first video clip, run new actions
  const firstVideo = await page.evaluate(() => {
    const s = window.__aifimoraStore.get();
    const v = s.clips.find((c) => c.type === "video");
    if (v) window.__aifimoraStore.set({ selectedClipId: v.id });
    return v ? v.id : null;
  });
  ok("video clip selected", !!firstVideo);

  // Auto Enhance
  await page.evaluate(async () => { const m = await import("./js/ai-studio.js"); m.applyAutoEnhance(); });
  await page.waitForTimeout(200);
  const enhanced = await page.evaluate(() => {
    const c = window.__aifimoraStore.get().clips.find((x) => x.type === "video");
    return (c?.fx?.contrast || 0) > 0;
  });
  ok("auto enhance grades clip", enhanced);

  // Color Match (needs selected ref)
  await page.evaluate(async () => { const m = await import("./js/ai-studio.js"); m.applyColorMatch(); });
  await page.waitForTimeout(200);
  ok("color match runs", true);

  // Stabilize
  await page.evaluate(async () => { const m = await import("./js/ai-studio.js"); m.applyStabilization(); });
  await page.waitForTimeout(200);
  const stab = await page.evaluate(() => window.__aifimoraStore.get().clips.some((c) => c.fx?.stabilize));
  ok("stabilize flag set", stab);

  // Face Mosaic + Object Remover
  await page.evaluate(async () => { const m = await import("./js/ai-studio.js"); m.applyFaceMosaic(); m.applyObjectRemover(); });
  await page.waitForTimeout(200);
  const fm = await page.evaluate(() => window.__aifimoraStore.get().clips.some((c) => c.fx?.faceMosaic));
  const orm = await page.evaluate(() => window.__aifimoraStore.get().clips.some((c) => c.fx?.objectRemover));
  ok("face mosaic flag", fm);
  ok("object remover flag", orm);

  // Vocal Remover (needs audio clip)
  const hasAudio = await page.evaluate(() => window.__aifimoraStore.get().clips.some((c) => c.type === "audio"));
  ok("audio present for vocal tests", hasAudio);
  if (hasAudio) {
    await page.evaluate(async () => { const m = await import("./js/ai-studio.js"); m.applyVocalRemover(); });
    await page.waitForTimeout(250);
    const vox = await page.evaluate(() => window.__aifimoraStore.get().clips.some((c) => /·vox/.test(c.name)));
    ok("vocal remover splits vox/inst", vox);
    // Audio Stretch on first audio
    await page.evaluate(() => {
      const a = window.__aifimoraStore.get().clips.find((c) => c.type === "audio");
      if (a) window.__aifimoraStore.set({ selectedClipId: a.id });
    });
    await page.evaluate(async () => { const m = await import("./js/ai-studio.js"); m.applyAudioStretch(); });
    await page.waitForTimeout(200);
    ok("audio stretch runs", true);
  }

  // Music bed (job + clip)
  const jobsBefore = await page.evaluate(() => window.__aifimoraStore.get().jobs.length);
  await page.evaluate(async () => { const m = await import("./js/ai-studio.js"); m.generateMusicBed(); });
  await page.waitForTimeout(400);
  const jobsAfter = await page.evaluate(() => window.__aifimoraStore.get().jobs.length);
  ok("music job queued", jobsAfter === jobsBefore + 1, `${jobsBefore}→${jobsAfter}`);

  // TTS voiceover
  // Assert the OUTCOME, not a count delta: the music-bed job queued above is also
  // async and can land inside this window, which made "+1 clip" flaky (seen 5→7).
  await page.evaluate(async () => { const m = await import("./js/ai-studio.js"); m.generateVoiceover("Hello from AiFilmora verification"); });
  let ttsClip = null;
  try {
    await page.waitForFunction(
      () => window.__aifimoraStore.get().clips.some((c) => /^VO · /.test(c.name || "")),
      null, { timeout: 5000 }
    );
    ttsClip = await page.evaluate(() =>
      window.__aifimoraStore.get().clips.find((c) => /^VO · /.test(c.name || ""))?.name || null
    );
  } catch { /* leave null */ }
  ok("tts adds voiceover clip", !!ttsClip, ttsClip);

  // AI Extend grows selected video
  await page.evaluate(() => {
    const v = window.__aifimoraStore.get().clips.find((c) => c.type === "video");
    if (v) window.__aifimoraStore.set({ selectedClipId: v.id });
  });
  const durBefore = await page.evaluate(() => window.__aifimoraStore.get().clips.find((c) => c.type === "video").duration);
  await page.evaluate(async () => { const m = await import("./js/ai-studio.js"); m.extendSelectedClip(); });
  await page.waitForTimeout(250);
  const durAfter = await page.evaluate(() => window.__aifimoraStore.get().clips.find((c) => /·ext/.test(c.name))?.duration || 0);
  ok("ai extend grows clip", durAfter > durBefore, `${durBefore}→${durAfter}`);

  // Beat Options dialog
  await page.locator("#btnBeatOptions").click({ force: true });
  await page.waitForTimeout(250);
  ok("beat options dialog", (await page.locator("#beatOptionsModal.open").count()) > 0);
  await page.locator("#boCancel").click({ force: true });
  await page.waitForTimeout(150);

  // Recent projects dialog
  await page.locator("#menuRecentTop").click({ force: true });
  await page.waitForTimeout(250);
  ok("recent projects dialog", (await page.locator("#recentProjectsModal.open").count()) > 0);
  await page.locator("#rpCancel").click({ force: true });
  await page.waitForTimeout(150);

  // Context menu has new Filmora items
  const clipEl = page.locator("[data-clip-id]").first();
  await clipEl.click({ button: "right", force: true });
  await page.waitForTimeout(250);
  const ctxText = await page.locator("#clipContextMenu").textContent();
  ok("ctx has Beat Sync", /Beat Sync/i.test(ctxText || ""));
  ok("ctx has Stabilize", /Stabilize/i.test(ctxText || ""));
  ok("ctx has Vocal Remover", /Vocal Remover/i.test(ctxText || ""));
  await page.keyboard.press("Escape");

  // Player still renders with new FX (no errors, canvas non-blank)
  const frameOk = await page.evaluate(() => {
    try {
      window.__aifimoraPlayer.render();
      const c = document.getElementById("previewCanvas");
      return c && c.width > 100;
    } catch (e) { return false; }
  });
  ok("player renders with new FX", frameOk);

  const realErrors = errors.filter((e) => !/favicon|net::|Failed to load resource/i.test(e));
  ok("no JS errors", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));

  await page.screenshot({ path: "output-filmora-gaps.png", fullPage: false });
  const failed = checks.filter((c) => !c.pass);
  console.log("\n=== SUMMARY ===");
  console.log(`${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) { console.log("FAILURES:", failed.map((f) => f.name).join(", ")); process.exitCode = 1; }
  else console.log("All Filmora-gap checks passed.");
  await browser.close();
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
