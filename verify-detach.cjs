/* Verify detach-audio: video silent, independent audio clip carries sound */
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
        ".js": "text/javascript", ".css": "text/css", ".html": "text/html",
        ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
      };
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
  const browser = await chromium.launch({
    headless: true,
    args: ["--autoplay-policy=no-user-gesture-required"],
  });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGE: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  const checks = [];
  const ok = (name, pass, extra = "") => {
    checks.push({ name, pass });
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  };

  // 1) Generate a REAL video+audio webm in-page (canvas + oscillator)
  const made = await page.evaluate(async () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 160; canvas.height = 90;
      const ctx = canvas.getContext("2d");
      let hue = 0;
      const draw = setInterval(() => {
        ctx.fillStyle = `hsl(${hue = (hue + 8) % 360},70%,45%)`;
        ctx.fillRect(0, 0, 160, 90);
      }, 50);
      const AC = window.AudioContext || window.webkitAudioContext;
      const ac = new AC();
      const osc = ac.createOscillator();
      osc.frequency.value = 440;
      const dest = ac.createMediaStreamDestination();
      osc.connect(dest);
      osc.start();
      const stream = new MediaStream([
        ...canvas.captureStream(15).getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);
      const rec = new MediaRecorder(stream);
      const chunks = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      const done = new Promise((r) => { rec.onstop = r; });
      rec.start();
      await new Promise((r) => setTimeout(r, 1500));
      rec.stop();
      await done;
      clearInterval(draw);
      osc.stop();
      ac.close();
      const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" });
      if (!blob.size) return { ok: false, reason: "empty recording" };
      const file = new File([blob], "av-test.webm", { type: blob.type || "video/webm" });
      const { importFileList } = await import("./js/media.js");
      const { imported } = await importFileList([file]);
      return { ok: !!imported.length, kind: imported[0]?.kind, hasUrl: !!imported[0]?.url, id: imported[0]?.id };
    } catch (e) {
      return { ok: false, reason: String(e?.message || e) };
    }
  });
  ok("real A/V file imported", made.ok && made.kind === "video" && made.hasUrl, JSON.stringify(made));
  if (!made.ok) {
    console.log("SKIP remaining (no media pipeline in this browser)");
    await browser.close(); server.close();
    process.exit(1);
  }

  // 2) Place on timeline, boost to 200% (forces gain graph), play
  const placed = await page.evaluate(async (mediaId) => {
    const { insertMediaAtPlayhead } = await import("./js/media.js");
    const s = window.__aifimoraStore;
    s.setSelectedMedia([mediaId]);
    const clip = insertMediaAtPlayhead(mediaId);
    s.setClipVolume(clip.id, 200);
    s.setSelectedClips([clip.id]);
    window.__aifimoraPlayer.seek(0.2);
    window.__aifimoraPlayer.play();
    await new Promise((r) => setTimeout(r, 900));
    const { getVideoEl } = await import("./js/player.js");
    const { mediaById } = await import("./js/media.js");
    const v = getVideoEl(mediaById(mediaId));
    return {
      clipId: clip.id,
      vMuted: v?.muted, vPaused: v?.paused, vVolume: v?.volume,
      ready: v?.readyState,
    };
  }, made.id);
  ok("video audible pre-detach", placed.vMuted === false, JSON.stringify(placed));

  // 3) Detach via the real toolbar button, then read state mid-clip
  await page.locator("#btnDetachAudio").click({ force: true });
  await page.waitForTimeout(400);
  const after = await page.evaluate(async (args) => {
    const s = window.__aifimoraStore;
    const { getVideoEl, getAudioEl } = await import("./js/player.js");
    const { mediaById } = await import("./js/media.js");
    const vclip = s.getClip(args.clipId);
    // Re-enter the clip so the sync loop is driving the elements now
    window.__aifimoraPlayer.seek(Math.min(0.3, (vclip?.duration || 1) / 2));
    await new Promise((r) => setTimeout(r, 450));
    const alink = vclip?.linkedAudioId && s.getClip(vclip.linkedAudioId);
    const media = mediaById(args.mediaId);
    const v = getVideoEl(media);
    const a = alink ? getAudioEl(media) : null;
    return {
      audioMuted: vclip?.audioMuted,
      audioDetached: vclip?.audioDetached,
      linkExists: !!alink,
      linkVolume: alink?.volume,
      linkType: alink?.type,
      vMuted: v?.muted, vVolume: v?.volume,
      aMuted: a?.muted, aVolume: a?.volume, aPaused: a?.paused, aNull: !a,
      badge: document.querySelector(`.tl-clip[data-clip-id="${args.clipId}"] .tl-vol span`)?.textContent,
    };
  }, { clipId: placed.clipId, mediaId: made.id });
  ok("video flagged muted+detached", after.audioMuted === true && after.audioDetached === true);
  ok("independent audio clip created", after.linkExists && after.linkType === "audio");
  ok("audio inherits video level", after.linkVolume === 200, JSON.stringify(after.linkVolume));
  ok("VIDEO ELEMENT SILENT", after.vMuted === true, JSON.stringify({ muted: after.vMuted, vol: after.vVolume }));
  ok("audio element carries sound", after.aNull === false && after.aMuted === false && after.aVolume > 0,
    JSON.stringify({ muted: after.aMuted, vol: after.aVolume, paused: after.aPaused }));
  ok("timeline shows Detached", after.badge === "Detached", JSON.stringify(after.badge));

  // 4) Unmuting the video must NOT resurrect its audio while linked audio lives
  const resurrect = await page.evaluate(async (clipId) => {
    const s = window.__aifimoraStore;
    s.setClipMuted(clipId, false);
    window.__aifimoraPlayer.seek(0.4);
    await new Promise((r) => setTimeout(r, 400));
    const { getVideoEl, getAudioEl } = await import("./js/player.js");
    const { mediaById } = await import("./js/media.js");
    const vclip = s.getClip(clipId);
    const media = mediaById(vclip.mediaId);
    const v = getVideoEl(media);
    const a = getAudioEl(media);
    return { flag: vclip.audioMuted, vMuted: v?.muted, aMuted: a?.muted, aVol: a?.volume };
  }, placed.clipId);
  ok("unmute cannot resurrect video audio", resurrect.vMuted === true, JSON.stringify(resurrect));
  ok("linked audio still sounding", resurrect.aMuted === false && resurrect.aVol > 0, JSON.stringify(resurrect));

  // 5) Cleanup: delete test clips + media
  await page.evaluate(async (clipId) => {
    const s = window.__aifimoraStore;
    window.__aifimoraPlayer.pause();
    const vclip = s.getClip(clipId);
    const ids = [clipId, vclip?.linkedAudioId].filter(Boolean);
    s.removeClips(ids);
    if (vclip) s.removeMedias([vclip.mediaId]);
  }, placed.clipId);

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  if (errors.length) console.log("page errors:\n" + errors.slice(0, 8).join("\n"));
  await browser.close();
  server.close();
  process.exit(failed.length || errors.length > 5 ? 1 : 0);
})();
