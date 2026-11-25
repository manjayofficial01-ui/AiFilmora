/* verify-wave0.cjs — Wave 0 (truth fixes) + Wave 1 (real media) regression suite.
 *
 * Covers:
 *   APP-001  marker geometry — one shape, point markers render at a finite x
 *   APP-002  speed ramp is honoured by the player, not just stored
 *   APP-003  ripple trim moves the tracks it should, and only those
 *   APP-004  loudness is measured, not fabricated
 *   APP-005  every AI timeline mutation is undoable
 *   APP-006  an undecodable import is reported, not disguised
 *   APP-007  video clips carry real filmstrip frames
 *   APP-008  audio clips carry a real decoded waveform
 */
const { chromium } = require("playwright");
const path = require("path");
const http = require("http");
const fs = require("fs");

const ROOT = __dirname;
const PORT = 8791;
const TYPES = {
  ".js": "text/javascript", ".css": "text/css", ".html": "text/html",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
  ".mp4": "video/mp4", ".wav": "audio/wav", ".webm": "audio/webm", ".cube": "text/plain",
  ".conf": "application/json", ".txt": "text/plain", ".ttf": "font/ttf", ".otf": "font/otf",
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
      if (p.endsWith(path.sep) || p.endsWith("\\")) p = path.join(p, "index.html");
      const ext = path.extname(p);
      fs.readFile(p, (e, d) => {
        if (e) { res.writeHead(404); res.end("404"); return; }
        res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream" });
        res.end(d);
      });
    });
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

(async () => {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGE: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });

  const checks = [];
  const ok = (name, pass, extra = "") => {
    checks.push({ name, pass, extra });
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  };

  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  // Boot into the demo project so there is a populated timeline.
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /demo cut/i.test(x.textContent || ""));
    if (b) b.click();
  });
  await page.waitForTimeout(1200);

  const hasStore = await page.evaluate(() => !!window.__aifimoraStore);
  ok("store booted", hasStore);

  /* ---------------------------------------------------------------- APP-001 */
  const marker = await page.evaluate(() => {
    const s = window.__aifimoraStore;
    const before = s.get().markers.length;
    // Write a point marker in the canonical shape.
    s.set({ markers: [...(s.get().markers || []), { id: "mk-test", t: 3.5, end: null, name: "Test marker", color: "accent" }] });
    s.emit?.();
    return { before, after: s.get().markers.length, last: s.get().markers[s.get().markers.length - 1] };
  });
  ok("APP-001 point marker keeps one shape", marker.last && marker.last.t === 3.5 && marker.last.end === null);

  await page.waitForTimeout(700);
  const flag = await page.evaluate(() => {
    const el = document.querySelector(".tl-marker-flag");
    if (!el) return null;
    const left = parseFloat(el.style.left);
    return { left, finite: Number.isFinite(left), title: el.getAttribute("title"), text: el.textContent.trim() };
  });
  ok("APP-001 marker flag renders at a finite x", !!flag && flag.finite, flag ? `left=${flag.left} "${flag.text}"` : "no flag in DOM");
  ok("APP-001 marker flag carries its name", !!flag && /Test marker/.test(flag.text || ""));

  /* ---------------------------------------------------------------- APP-002 */
  const ramp = await page.evaluate(async () => {
    const s = window.__aifimoraStore;
    const clip = s.get().clips.find((c) => c.type === "video");
    if (!clip) return { skip: true };
    const before = { duration: clip.duration, speed: clip.speed ?? 1 };
    const res = s.applySpeedRamp(clip.id, { curve: [1, 4, 4, 1], name: "Test Ramp", ripple: false });
    const after = s.getClip(clip.id);
    const mod = await import("./js/speed-ramp.js");
    const srcAt = mod.rampSourceTime(after, after.duration * 0.25);
    const srcEnd = mod.rampSourceTime(after, after.duration);
    const speedEarly = mod.rampSpeedAt(after, 0.25);
    const speedMid = mod.rampSpeedAt(after, 0.5);
    return { before, res, after: { duration: after.duration, speed: after.speed, curve: after.speedRamp?.curve }, srcAt, srcEnd, speedEarly, speedMid };
  });
  ok("APP-002 ramp applies", !ramp.skip && ramp.res?.ok, ramp.skip ? "no video clip" : `avg=${ramp.res?.avg}`);
  ok("APP-002 clip speed becomes the curve mean", !ramp.skip && Math.abs(ramp.after.speed - ramp.res.avg) < 0.02, `speed=${ramp.after?.speed}`);
  ok("APP-002 ramp changes the source time mapping", !ramp.skip && ramp.srcAt > 0 && ramp.srcEnd > ramp.srcAt, `src(25%)=${ramp.srcAt?.toFixed(2)} src(100%)=${ramp.srcEnd?.toFixed(2)}`);
  ok("APP-002 ramp curve is not flat", !ramp.skip && Math.abs(ramp.speedEarly - ramp.speedMid) > 0.05, `early=${ramp.speedEarly?.toFixed(2)} mid=${ramp.speedMid?.toFixed(2)}`);
  ok("APP-002 clip still covers the same source", !ramp.skip && Math.abs(ramp.srcEnd - ramp.before.duration * ramp.before.speed) < 0.35, `srcSpan=${ramp.srcEnd?.toFixed(2)} vs was ${(ramp.before.duration * ramp.before.speed).toFixed(2)}`);

  /* ---------------------------------------------------------------- APP-003 */
  const ripple = await page.evaluate(() => {
    const s = window.__aifimoraStore;
    // Build a two-track fixture so we can see whether the ripple crosses tracks.
    const tracks = s.get().tracks;
    const a = tracks.find((t) => t.kind === "video");
    const b = tracks.find((t) => t.kind === "audio");
    if (!a || !b) return { skip: true };
    const clipA = { id: "w0-a", type: "video", trackId: a.id, start: 0, duration: 4, name: "A" };
    const clipB = { id: "w0-b", type: "video", trackId: b.id, start: 0, duration: 4, name: "B" };
    const tailA = { id: "w0-ta", type: "video", trackId: a.id, start: 6, duration: 2, name: "tailA" };
    const tailB = { id: "w0-tb", type: "video", trackId: b.id, start: 6, duration: 2, name: "tailB" };
    s.set({ clips: [clipA, clipB, tailA, tailB] });
    s.setSelectedClips([]);
    s.trimStartAtPlayhead("w0-a", 2, { rippleGap: true });
    const g = (id) => s.getClip(id);
    const res = {
      a: g("w0-a"), b: g("w0-b"), tailA: g("w0-ta"), tailB: g("w0-tb"),
    };
    // Now with a selection: only the selected clip's track should move.
    s.set({ clips: [clipA, clipB, tailA, tailB] });
    s.setSelectedClips(["w0-a"]);
    s.trimStartAtPlayhead("w0-a", 2, { rippleGap: true });
    const sel = { tailA: g("w0-ta"), tailB: g("w0-tb") };
    return { res, sel };
  });
  ok("APP-003 ripple with no selection moves every track", !ripple.skip && ripple.res.tailA.start === 4 && ripple.res.tailB.start === 4,
    ripple.skip ? "no two tracks" : `tailA=${ripple.res.tailA?.start} tailB=${ripple.res.tailB?.start}`);
  ok("APP-003 ripple with a selection moves only that track", !ripple.skip && ripple.sel.tailA.start === 4 && ripple.sel.tailB.start === 6,
    ripple.skip ? "" : `tailA=${ripple.sel.tailA?.start} tailB=${ripple.sel.tailB?.start}`);

  /* ---------------------------------------------------------------- APP-005 */
  const undoable = await page.evaluate(() => {
    const s = window.__aifimoraStore;
    const before = JSON.stringify(s.get().clips);
    // Simulate the AI path that used to skip pushUndo entirely.
    s.set({ clips: s.get().clips.map((c) => ({ ...c, name: c.name + " *" })) });
    const after = JSON.stringify(s.get().clips);
    const label = s.undo();
    const restored = JSON.stringify(s.get().clips);
    return { changed: before !== after, label, restored: restored === before };
  });
  ok("APP-005 a bulk set() is undoable", undoable.changed && undoable.restored, `undo label="${undoable.label}"`);

  const undoDeep = await page.evaluate(() => {
    const s = window.__aifimoraStore;
    const clip = s.get().clips[0];
    if (!clip) return { skip: true };
    const before = clip.duration;
    // A timeline drag: many updateClip calls in a row.
    for (let i = 1; i <= 5; i++) s.updateClip(clip.id, { duration: before + i * 0.1 });
    const moved = s.getClip(clip.id).duration;
    s.undo();
    return { skip: false, before, moved, after: s.getClip(clip.id).duration };
  });
  ok("APP-005 a drag collapses into one undo step", !undoDeep.skip && Math.abs(undoDeep.after - undoDeep.before) < 0.001,
    undoDeep.skip ? "" : `dur ${undoDeep.before?.toFixed(2)} → ${undoDeep.moved?.toFixed(2)} → undo → ${undoDeep.after?.toFixed(2)}`);

  /* ---------------------------------------------------------------- APP-004 */
  const loud = await page.evaluate(async () => {
    const mod = await import("./js/loudness.js");
    // A full-scale 1 kHz sine in one channel must read −3.01 LUFS.
    const sr = 48000, n = sr * 2;
    const data = new Float32Array(n);
    for (let i = 0; i < n; i++) data[i] = Math.sin((2 * Math.PI * 1000 * i) / sr);
    const buf = { sampleRate: sr, length: n, numberOfChannels: 1, duration: 2, getChannelData: () => data };
    const m = mod.measureLufs(buf);
    const g1 = mod.gainForTarget(-20, -14, 0.5);
    const g2 = mod.gainForTarget(-20, -14, 1.0);
    return { lufs: m.lufs, ok: m.ok, peak: m.samplePeak, g1, g2 };
  });
  ok("APP-004 full-scale sine measures −3.01 LUFS", loud.ok && Math.abs(loud.lufs + 3.01) < 0.15, `measured ${loud.lufs?.toFixed(3)} LUFS`);
  ok("APP-004 sample peak measures 1.0", Math.abs(loud.peak - 1) < 0.01, `peak=${loud.peak?.toFixed(4)}`);
  ok("APP-004 gainForTarget(−20 → −14, peak .5) = +6 dB", loud.g1.ok && Math.abs(loud.g1.gainDb - 6) < 0.01, `got ${loud.g1.gainDb}`);
  ok("APP-004 gainForTarget clamps so the peak lands at −1 dBFS", loud.g2.ok && loud.g2.clamped && Math.abs(loud.g2.gainDb + 1) < 0.01, `got ${loud.g2.gainDb}`);

  const fakeGone = await page.evaluate(async () => {
    const src = await (await fetch("./js/volume-panel.js")).text();
    return { hasFake: /100 \+ \(lufs \+ 14\) \* 3/.test(src), hasMeasure: /measureMediaLufs/.test(src) };
  });
  ok("APP-004 the fabricated gain mapping is gone", !fakeGone.hasFake);
  ok("APP-004 the volume panel measures instead", fakeGone.hasMeasure);

  /* ---------------------------------------------------------------- APP-006 */
  const mime = await page.evaluate(async () => {
    const src = await (await fetch("./js/media.js")).text();
    return {
      liesAboutMkv: /"mkv"[^\n]*"video\/mp4"/.test(src),
      liesAboutWav: /"wav"[^\n]*"audio\/mpeg"/.test(src),
      reportsUnplayable: /unplayable/.test(src),
    };
  });
  ok("APP-006 MKV is no longer reported as video/mp4", !mime.liesAboutMkv);
  ok("APP-006 WAV is no longer reported as audio/mpeg", !mime.liesAboutWav);
  ok("APP-006 an undecodable import is flagged", mime.reportsUnplayable);

  /* --------------------------------------------------------- APP-007 / 008 */
  // Build a real media file in the page and import it, so the timeline has
  // something genuine to analyse.
  const media = await page.evaluate(async () => {
    const s = window.__aifimoraStore;
    // 1) A canvas-captured WebM (video) + a generated WAV (audio).
    const canvas = document.createElement("canvas");
    canvas.width = 320; canvas.height = 180;
    const ctx = canvas.getContext("2d");
    const stream = canvas.captureStream(25);
    const rec = new MediaRecorder(stream);
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.start();
    let frame = 0;
    const paint = () => {
      frame++;
      ctx.fillStyle = `hsl(${frame * 8 % 360} 70% 45%)`;
      ctx.fillRect(0, 0, 320, 180);
      ctx.fillStyle = "#fff";
      ctx.fillRect(20 + (frame % 50) * 5, 60, 40, 40);
      if (frame < 50) requestAnimationFrame(paint);
    };
    paint();
    await new Promise((r) => setTimeout(r, 2200));
    const blob = await new Promise((r) => { rec.onstop = () => r(new Blob(chunks, { type: "video/webm" })); rec.stop(); });
    const url = URL.createObjectURL(blob);

    // 2) A WAV with a real (loud) sine, 2 seconds.
    const sr = 48000, n = sr * 2;
    const buf = new ArrayBuffer(44 + n * 2);
    const dv = new DataView(buf);
    const wr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    wr(0, "RIFF"); dv.setUint32(4, 36 + n * 2, true); wr(8, "WAVEfmt ");
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true);
    dv.setUint16(34, 16, true); wr(36, "data"); dv.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) {
      const v = Math.round(Math.sin((2 * Math.PI * 440 * i) / sr) * 20000);
      dv.setInt16(44 + i * 2, v, true);
    }
    const wavUrl = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));

    s.set({
      media: [
        { id: "w0-vid", name: "clip.webm", kind: "video", duration: 2, url, thumb: null, generated: false },
        { id: "w0-aud", name: "tone.wav", kind: "audio", duration: 2, url: wavUrl, thumb: null, generated: false },
      ],
    });
    s.set({ clips: [
      { id: "w0-vclip", type: "video", trackId: s.get().tracks.find((t) => t.kind === "video").id, mediaId: "w0-vid", start: 0, duration: 2, name: "clip.webm" },
      { id: "w0-aclip", type: "audio", trackId: s.get().tracks.find((t) => t.kind === "audio").id, mediaId: "w0-aud", start: 0, duration: 2, name: "tone.wav" },
    ] });
    window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
    return { ok: true };
  });
  ok("media fixtures built", !!media.ok);

  await page.waitForTimeout(4000);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty")));
  await page.waitForTimeout(4000);

  const rendered = await page.evaluate(() => {
    const v = document.querySelector('.tl-clip[data-clip-id="w0-vclip"]');
    const a = document.querySelector('.tl-clip[data-clip-id="w0-aclip"]');
    const strip = v?.querySelector(".tl-strip");
    const wave = a?.querySelector(".tl-wave");
    const pathEl = wave?.querySelector("path");
    return {
      stripImgs: strip ? strip.querySelectorAll("img").length : 0,
      stripHasImgSrc: !!(strip?.querySelector("img")?.src || "").startsWith("data:image"),
      wavePath: pathEl ? (pathEl.getAttribute("d") || "").length : 0,
      waveSvg: !!wave?.querySelector("svg"),
      waveIsReal: !!pathEl && (pathEl.getAttribute("d") || "").length > 40,
    };
  });
  ok("APP-007 video clip shows real filmstrip frames", rendered.stripImgs > 0 && rendered.stripHasImgSrc, `${rendered.stripImgs} frames`);
  ok("APP-008 audio clip shows a real decoded waveform", rendered.waveIsReal, `path length ${rendered.wavePath}`);

  const noPlaceholder = await page.evaluate(() => {
    const el = document.querySelector('.tl-clip[data-clip-id="w0-aclip"]');
    const wave = el?.querySelector(".tl-wave");
    const cs = wave ? getComputedStyle(wave) : null;
    return { hasGradient: !!cs && (cs.backgroundImage || "").includes("gradient") };
  });
  ok("APP-008 the CSS-gradient placeholder is gone", !noPlaceholder.hasGradient);

  // A zoom rebuilds every clip element — the media must come back, and it
  // must not cost a re-decode.
  const zoom = await page.evaluate(async () => {
    const before = {
      frames: document.querySelectorAll('.tl-clip[data-clip-id="w0-vclip"] .tl-strip img').length,
      wave: !!document.querySelector('.tl-clip[data-clip-id="w0-aclip"] .tl-wave svg'),
    };
    const z = document.getElementById("tlZoom");
    if (z) {
      z.value = "2";
      z.dispatchEvent(new Event("input", { bubbles: true }));
    }
    await new Promise((r) => setTimeout(r, 1500));
    const after = {
      frames: document.querySelectorAll('.tl-clip[data-clip-id="w0-vclip"] .tl-strip img').length,
      wave: !!document.querySelector('.tl-clip[data-clip-id="w0-aclip"] .tl-wave svg'),
    };
    if (z) { z.value = "1"; z.dispatchEvent(new Event("input", { bubbles: true })); }
    return { before, after };
  });
  ok("APP-007 the filmstrip survives a timeline rebuild", zoom.after.frames > 0, `${zoom.before.frames} → ${zoom.after.frames}`);
  ok("APP-008 the waveform survives a timeline rebuild", zoom.after.wave);

  /* ------------------------------------------------- audit fixes (2026-11-25) */

  // The colour scopes used to freeze permanently: a throttled draw set the
  // `dirty` flag, and the frame listener's `if (dirty) return;` guard then
  // suppressed every draw after that. A second frame event inside the 50 ms
  // window must still land.
  const scopeSig = () => page.evaluate(() => {
    const c = document.getElementById("scopeCanvas");
    if (!c) return "no-canvas";
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let s = 0;
    for (let i = 0; i < d.length; i += 97) s = (s * 31 + d[i]) >>> 0;
    return String(s);
  });
  const paintPreview = (color) => page.evaluate((c) => {
    const p = document.getElementById("previewCanvas");
    if (!p) return false;
    const ctx = p.getContext("2d");
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, p.width, p.height);
    return true;
  }, color);

  const painted = await paintPreview("#ff0000");
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aifimora:frame")));
  await page.waitForTimeout(250);
  const sigA = await scopeSig();
  await paintPreview("#00ff00");
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("aifimora:frame"));
    window.dispatchEvent(new CustomEvent("aifimora:frame"));
  });
  await page.waitForTimeout(350);
  const sigB = await scopeSig();
  ok("the colour scopes keep repainting (the dirty-flag freeze is fixed)", painted && sigA !== "no-canvas" && sigA !== sigB, `${sigA} → ${sigB}`);

  // A native <details> has no keyboard dismissal, so the Filmora menu used to
  // stay open over the UI after Escape and swallow the next click.
  const menuEscape = await page.evaluate(async () => {
    const summary = document.querySelector("#fmVersion > summary");
    if (!summary) return { skipped: true };
    summary.click();
    await new Promise((r) => setTimeout(r, 150));
    const opened = document.querySelectorAll(".fm-item[open]").length;
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise((r) => setTimeout(r, 150));
    return { opened, after: document.querySelectorAll(".fm-item[open]").length };
  });
  ok("Escape closes the open Filmora menu", !menuEscape.skipped && menuEscape.opened > 0 && menuEscape.after === 0, JSON.stringify(menuEscape));

  /* ------------------------------------------------ crash-recovery prompt */
  // The app showed a blocking "Recover unsaved work?" dialog on EVERY boot:
  // the guard never compared the backup against the live autosave, even
  // though its own comment said it did. A native dialog that fires on every
  // launch also made the test suite flaky.
  await page.addInitScript(() => {
    window.__confirmCalls = [];
    window.confirm = (msg) => { window.__confirmCalls.push(String(msg)); return false; };
  });

  const seedBackup = (opts) => page.evaluate((o) => {
    const live = window.__aifimoraStore.get();
    const project = JSON.parse(JSON.stringify(live));
    if (o.different) project.name = (project.name || "Project") + " (from a backup)";
    if (o.extraClip) {
      project.clips = (project.clips || []).concat([{ id: "cl_extra", start: 99, end: 103, type: "video" }]);
    }
    localStorage.setItem("aifimora.backup.v1", JSON.stringify({
      versions: [{ ts: o.ts, label: "auto", project }],
    }));
    // Turn the exit-time snapshot off for this check. Otherwise the unload
    // handler writes an "exit" copy of the live project on top of the
    // seeded backup, and that copy — holding nothing new — is the newest
    // entry, so the prompt is (correctly) never offered.
    try {
      const s = JSON.parse(localStorage.getItem("aifimora.settings.v2") || "{}");
      s.backup = { ...(s.backup || {}), enabled: false };
      localStorage.setItem("aifimora.settings.v2", JSON.stringify(s));
    } catch { /* no settings yet */ }
  }, opts);

  const readPrompts = async () => {
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(1400);   // the prompt is scheduled 600 ms after boot
    return page.evaluate(() => window.__confirmCalls || []);
  };

  // (a) the backup holds exactly what the live project holds -> nothing to
  //     recover. This is the case that used to prompt on every single boot.
  await seedBackup({ ts: Date.now() - 10 * 60 * 1000, different: false });
  const promptsSame = await readPrompts();
  ok("no recovery prompt when the backup holds nothing new", promptsSame.length === 0, JSON.stringify(promptsSame).slice(0, 140));

  // (b) a backup taken seconds ago is not a recovery candidate
  await seedBackup({ ts: Date.now() - 5 * 1000, different: true });
  const promptsSameMinute = await readPrompts();
  ok("no recovery prompt for a backup from this same minute", promptsSameMinute.length === 0, JSON.stringify(promptsSameMinute).slice(0, 140));

  // (c) positive control: a backup that really does hold different work must
  //     still offer the recovery
  await seedBackup({ ts: Date.now() - 10 * 60 * 1000, different: true });
  const promptsDiff = await readPrompts();
  ok("a backup that holds different work still offers recovery", promptsDiff.length === 1 && /Recover unsaved work/.test(promptsDiff[0]), JSON.stringify(promptsDiff).slice(0, 140));

  // (d) and one that differs only in the timeline, not just the name
  await seedBackup({ ts: Date.now() - 10 * 60 * 1000, different: false, extraClip: true });
  const promptsClip = await readPrompts();
  ok("a backup with an extra clip still offers recovery", promptsClip.length === 1 && /Recover unsaved work/.test(promptsClip[0]), JSON.stringify(promptsClip).slice(0, 140));

  /* ------------------------------------------------------------------ done */
  const passed = checks.filter((c) => c.pass).length;
  console.log(`\n${passed}/${checks.length} checks passed`);
  if (errors.length) {
    console.log(`\n${errors.length} console/page error(s):`);
    errors.slice(0, 10).forEach((e) => console.log("  " + e));
  }
  await browser.close();
  server.close();
  process.exit(passed === checks.length && errors.length === 0 ? 0 : 1);
})();
