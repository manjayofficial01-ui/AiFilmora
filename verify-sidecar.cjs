/* verify-sidecar.cjs — proves the media sidecar works, or says why it cannot.
 *
 * No FFmpeg, ffprobe or Whisper is installed on this machine, and a test may
 * not install one on its own. So the suite drives the real sidecar against
 * stand-in tools: the process spawn, the command construction, the output
 * parsing, the IPC and the media:// delivery are all exercised for real —
 * only the binaries themselves are replaced.
 *
 * What this proves: the plumbing.
 * What it cannot prove: that real FFmpeg behaves exactly like the stand-in.
 * The suites that assert the app still works without the sidecar prove the
 * other half — that nothing depends on FFmpeg being present.
 *
 * Groups:
 *   1. discovery   — where the tools are looked for, and what is missing
 *   2. worker      — the sidecar itself, over newline-delimited JSON
 *   3. manager     — the main-process bridge, request/response correlation
 *   4. electron    — the real Electron shell: IPC, media:// delivery, range
 *   5. browser     — the web build still works with no sidecar at all
 */
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

const ROOT = __dirname;
const PORT = 8793;
const TYPES = {
  ".js": "text/javascript", ".css": "text/css", ".html": "text/html",
  ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
  ".mp4": "video/mp4", ".wav": "audio/wav", ".webm": "video/webm", ".cube": "text/plain",
  ".conf": "application/json", ".txt": "text/plain", ".ttf": "font/ttf", ".otf": "font/otf",
};

const checks = [];
const ok = (name, pass, extra = "") => {
  checks.push({ name, pass: !!pass, extra });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
};

/* ------------------------------------------------------------------ *
 * Stand-in tools
 *
 * Each "media file" is a JSON description. The stand-in ffprobe reads it and
 * answers like ffprobe; the stand-in ffmpeg reads it and writes a new
 * description describing what it produced. That is enough to drive the
 * conversion ladder for real.
 * ------------------------------------------------------------------ */

const STUB_PROBE = `
const fs = require("node:fs");
const args = process.argv.slice(2);
const target = args[args.length - 1];
let m = null;
try { m = JSON.parse(fs.readFileSync(target, "utf-8")); } catch {}
if (!m || !m.codec) m = { kind: "video", codec: "h264", width: 1280, height: 720, fps: 25, duration: 5, audio: "aac", sampleRate: 48000, channels: 2 };
const rate = (fps) => {
  if (Math.abs(fps - 29.97) < 0.02) return "30000/1001";
  return String(fps) + "/1";
};
const streams = [];
if (m.kind !== "audio") streams.push({ index: 0, codec_type: "video", codec_name: m.codec, width: m.width, height: m.height, avg_frame_rate: rate(m.fps), r_frame_rate: rate(m.fps), pix_fmt: m.pixFmt || "yuv420p", duration: String(m.duration) });
if (m.audio) streams.push({ index: streams.length, codec_type: "audio", codec_name: m.audio, sample_rate: String(m.sampleRate), channels: m.channels, duration: String(m.duration) });
let size = 0;
try { size = fs.statSync(target).size; } catch {}
process.stdout.write(JSON.stringify({
  streams,
  format: { filename: target, format_name: m.container || "mov,mp4,m4a,3gp,3g2,mj2", duration: String(m.duration), size: String(size), bit_rate: "8000000" }
}));
`;

const STUB_FFMPEG = `
const fs = require("node:fs");
const args = process.argv.slice(2);
const out = args[args.length - 1];
const iIndex = args.indexOf("-i");
const input = iIndex >= 0 ? args[iIndex + 1] : "";
let src = {};
try { src = JSON.parse(fs.readFileSync(input, "utf-8")); } catch {}
if (args.includes("-frames:v")) {
  // A poster frame. 1x1 PNG.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  fs.writeFileSync(out, png);
  process.exit(0);
}
if (args.includes("-ar")) {
  // 16 kHz mono PCM for the speech engine.
  fs.writeFileSync(out, JSON.stringify({ kind: "audio", codec: "pcm_s16le", sampleRate: 16000, channels: 1, duration: src.duration || 10, audio: null }));
  process.exit(0);
}
let codec = src.codec;
let audio = src.audio;
let kind = src.kind || "video";
if (args.includes("libx264")) { codec = "h264"; audio = "aac"; }
const aIndex = args.indexOf("-c:a");
if (aIndex >= 0 && args[aIndex + 1] === "aac") { audio = "aac"; kind = "audio"; }
const tagIndex = args.indexOf("-tag:v");
if (tagIndex >= 0 && args[tagIndex + 1] === "hvc1") codec = "hevc";
fs.writeFileSync(out, JSON.stringify({
  kind, codec, audio, width: src.width || 1920, height: src.height || 1080,
  fps: src.fps || 25, duration: src.duration || 5,
  container: out.endsWith(".mov") ? "mov,mp4,m4a" : "mov,mp4,m4a,3gp,3g2,mj2"
}));
`;

const STUB_WHISPER = `
const fs = require("node:fs");
const args = process.argv.slice(2);
const mode = process.env.STUB_WHISPER_MODE || "full";
const ofIndex = args.indexOf("-of");
const base = ofIndex >= 0 ? args[ofIndex + 1] : "asr";
if (mode === "fail-full" && args.includes("-ojf")) {
  process.stderr.write("error: unknown option '-ojf'\\n");
  process.exit(1);
}
const segs = [
  { from: 0, to: 2240, text: " Welcome back to the channel.",
    words: [["Welcome",0,640],["back",640,1240],["to",1240,1640],["the",1640,2040],["channel",2040,2240]] },
  { from: 2500, to: 6800, text: " Um today we're cutting",
    words: [["Um",2500,3000],["today",3000,4200],["we're",4200,5200],["cutting",5200,6800]] }
];
const ts = (ms) => {
  const h = String(Math.floor(ms / 3600000)).padStart(2, "0");
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0");
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
  return h + ":" + m + ":" + s + "," + String(ms % 1000).padStart(3, "0");
};
let doc;
if (mode === "plain") {
  doc = { transcription: segs.map((s) => ({ timestamps: { from: ts(s.from), to: ts(s.to) }, offsets: { from: s.from, to: s.to }, text: s.text })) };
} else {
  doc = {
    system: "stub", model: { type: "tiny", multilingual: true }, params: { model: "tiny" },
    result: {
      language: "en",
      transcription: segs.map((s) => ({
        timestamps: { from: ts(s.from), to: ts(s.to) },
        offsets: { from: s.from, to: s.to },
        tokens: s.words.map((w) => ({ text: " " + w[0], offsets: { from: w[1], to: w[2] } })),
        text: s.text
      }))
    }
  };
}
fs.writeFileSync(base + ".json", JSON.stringify(doc, null, 2));
`;

function makeStubs(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const probe = path.join(dir, "ffprobe-stub.js");
  const ffmpeg = path.join(dir, "ffmpeg-stub.js");
  const whisper = path.join(dir, "whisper-stub.js");
  fs.writeFileSync(probe, STUB_PROBE);
  fs.writeFileSync(ffmpeg, STUB_FFMPEG);
  fs.writeFileSync(whisper, STUB_WHISPER);
  const model = path.join(dir, "ggml-tiny.bin");
  fs.writeFileSync(model, "stub model");
  return { probe, ffmpeg, whisper, model };
}

/* ------------------------------------------------------------------ *
 * Worker harness — newline-delimited JSON over stdio
 * ------------------------------------------------------------------ */

function startWorker(env) {
  const child = spawn(process.execPath, [path.join(ROOT, "electron", "sidecar", "media-service.cjs")], {
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const pending = new Map();
  let buf = "";
  let stderr = "";
  child.stderr.setEncoding("utf-8");
  child.stderr.on("data", (d) => { stderr += d; });
  child.stdout.setEncoding("utf-8");
  child.stdout.on("data", (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let msg;
      try { msg = JSON.parse(line); } catch { continue; }
      const entry = pending.get(String(msg.id));
      if (entry) { pending.delete(String(msg.id)); entry(msg); }
    }
  });
  let seq = 0;
  return {
    call(op, params, timeout = 30000) {
      const id = String(++seq);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { pending.delete(id); reject(new Error("timeout on " + op)); }, timeout);
        pending.set(id, (msg) => { clearTimeout(timer); resolve(msg); });
        child.stdin.write(JSON.stringify({ id, op, params }) + "\n");
      });
    },
    stderr: () => stderr,
    kill: () => { try { child.kill(); } catch { /* gone */ } },
  };
}

/* ------------------------------------------------------------------ *
 * Static server for the browser build
 * ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ *
 * 1. Discovery
 * ------------------------------------------------------------------ */
function testDiscovery(stubs) {
  const tools = require(path.join(ROOT, "electron", "sidecar", "tools.cjs"));
  const saved = {
    ffmpeg: process.env.AIFIMORA_FFMPEG,
    ffprobe: process.env.AIFIMORA_FFPROBE,
    whisper: process.env.AIFIMORA_WHISPER,
    model: process.env.AIFIMORA_WHISPER_MODEL,
  };

  process.env.AIFIMORA_FFMPEG = stubs.ffmpeg;
  process.env.AIFIMORA_FFPROBE = stubs.probe;
  process.env.AIFIMORA_WHISPER = stubs.whisper;
  process.env.AIFIMORA_WHISPER_MODEL = stubs.model;
  const d = tools.discover();
  ok("discovery: an explicit path wins", d.ffmpeg === stubs.ffmpeg && d.ffmpegSource === "env:AIFIMORA_FFMPEG", d.ffmpegSource);
  ok("discovery: a Node script is run through node", d.ffmpegRunner === "node", d.ffmpegRunner);
  ok("discovery: the model file is found", d.whisperModel === stubs.model);
  ok("discovery: all three capabilities are reported", d.canTranscode && d.canProbe && d.canTranscribe, JSON.stringify(d.missing));

  // A path that does not exist must not be reported as a tool.
  process.env.AIFIMORA_FFMPEG = path.join(path.dirname(stubs.ffmpeg), "nope.js");
  const bogus = tools.discover();
  ok("discovery: a missing override is not reported as a tool", bogus.ffmpeg !== process.env.AIFIMORA_FFMPEG, bogus.ffmpegSource);
  ok("discovery: what is missing is named", Array.isArray(bogus.missing) && bogus.missing.length > 0, JSON.stringify(bogus.missing));

  // Restore, then check the honest state of this machine.
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const clean = tools.discover();
  const named = ["ffmpeg", "ffprobe", "whisper"].every((n) => {
    const p = clean[n];
    if (p) return true;
    return clean.missing.includes(n);
  });
  ok("discovery: every tool is either found or named as missing", named, JSON.stringify({ missing: clean.missing }));
}

/* ------------------------------------------------------------------ *
 * 2. The worker
 * ------------------------------------------------------------------ */
async function testWorker(stubs, tmp) {
  const src = path.join(tmp, "source.mxf");
  fs.writeFileSync(src, JSON.stringify({
    kind: "video", codec: "prores", audio: "pcm_s24le", width: 1920, height: 1080,
    fps: 29.97, duration: 12.5,
  }));

  const env = {
    AIFIMORA_FFMPEG: stubs.ffmpeg,
    AIFIMORA_FFPROBE: stubs.probe,
    AIFIMORA_WHISPER: stubs.whisper,
    AIFIMORA_WHISPER_MODEL: stubs.model,
    AIFIMORA_SIDECAR_CACHE: path.join(tmp, "cache"),
  };

  const w = startWorker(env);

  const ping = await w.call("ping");
  ok("worker: ping reports what it can do", ping.ok && ping.result.canProbe === true, JSON.stringify(ping.result?.missing));

  const probe = await w.call("analyze", { path: src });
  const p = probe.result || {};
  ok("worker: analyze reads the real duration", probe.ok && Math.abs(p.duration - 12.5) < 0.01, String(p.duration));
  ok("worker: analyze reads the codec", p.video?.codec === "prores", p.video?.codec);
  ok("worker: analyze reads the frame rate", Math.abs((p.video?.fps || 0) - 29.97) < 0.02, String(p.video?.fps));
  ok("worker: an unplayable codec is called unplayable", p.browserSafe === false && /prores/.test(p.unsafeReason || ""), p.unsafeReason);

  const conv = await w.call("convert", { path: src });
  const c = conv.result || {};
  ok("worker: convert runs the ladder and lands on a playable file", conv.ok && c.browserSafe === true, JSON.stringify(c.attempts));
  ok("worker: the last rung is the transcode", c.rung === "transcode", c.rung);
  ok("worker: the converted file exists on disk", !!c.path && fs.existsSync(c.path), c.path);

  const poster = await w.call("poster", { path: src, at: 2 });
  ok("worker: a poster frame is written", poster.ok && fs.existsSync(poster.result.path), poster.result?.path);

  const asr = await w.call("transcribe", { path: src });
  const a = asr.result || {};
  ok("worker: transcription returns real segments", asr.ok && a.segments?.length === 2, String(a.segments?.length));
  ok("worker: transcription returns real word timings", a.words?.length === 9, String(a.words?.length));
  const firstStart = a.words?.[0]?.start;
  ok("worker: the first word is timed from zero", typeof firstStart === "number" && Math.abs(firstStart) < 0.001, String(firstStart));
  ok("worker: token timings are used, not estimated", a.wordsEstimated === false, String(a.wordsEstimated));
  ok("worker: the model that ran is named", a.model === "ggml-tiny.bin", a.model);

  const missingFile = await w.call("analyze", { path: path.join(tmp, "nope.mxf") });
  ok("worker: a missing file is reported, not guessed", missingFile.ok === false && missingFile.error.code === "no-file", JSON.stringify(missingFile.error));

  // Audio on its own takes a different path through the ladder.
  const audioSrc = path.join(tmp, "voice.aiff");
  fs.writeFileSync(audioSrc, JSON.stringify({
    kind: "audio", codec: "pcm_s24le", audio: "pcm_s24le", duration: 8, container: "aiff",
  }));
  const aProbe = await w.call("analyze", { path: audioSrc });
  ok("worker: raw PCM outside a WAV is not called playable", aProbe.result?.browserSafe === false, aProbe.result?.unsafeReason);
  const aConv = await w.call("convert", { path: audioSrc });
  ok("worker: an audio-only file is converted to a playable codec", aConv.ok === true && aConv.result?.browserSafe === true, `${aConv.result?.rung} ${aConv.result?.reason || ""}`);

  const unknown = await w.call("make-coffee", {});
  ok("worker: an unknown operation is refused", unknown.ok === false && unknown.error.code === "unknown-op", JSON.stringify(unknown.error));

  w.kill();

  // The same worker with no tools at all must say so instead of pretending.
  const bare = startWorker({
    AIFIMORA_FFMPEG: "", AIFIMORA_FFPROBE: "", AIFIMORA_WHISPER: "", AIFIMORA_WHISPER_MODEL: "",
    AIFIMORA_SIDECAR_CACHE: path.join(tmp, "cache-bare"),
  });
  const bareProbe = await bare.call("analyze", { path: src });
  ok("worker: without ffprobe it says ffprobe is missing", bareProbe.ok === false && bareProbe.error.code === "no-ffprobe", JSON.stringify(bareProbe.error));
  const bareAsr = await bare.call("transcribe", { path: src });
  ok("worker: without whisper it says whisper is missing", bareAsr.ok === false && bareAsr.error.code === "no-whisper", JSON.stringify(bareAsr.error));
  const barePing = await bare.call("ping");
  ok("worker: without tools it reports every capability as absent", barePing.result.canTranscode === false && barePing.result.canProbe === false && barePing.result.canTranscribe === false);
  bare.kill();
}

/* ------------------------------------------------------------------ *
 * 3. The manager
 * ------------------------------------------------------------------ */
async function testManager(stubs, tmp) {
  const mgr = require(path.join(ROOT, "electron", "sidecar", "index.cjs"));
  mgr.setCacheRoot(path.join(tmp, "mgr-cache"));
  mgr.stop();

  const saved = { ...process.env };
  process.env.AIFIMORA_FFMPEG = stubs.ffmpeg;
  process.env.AIFIMORA_FFPROBE = stubs.probe;
  process.env.AIFIMORA_WHISPER = stubs.whisper;
  process.env.AIFIMORA_WHISPER_MODEL = stubs.model;

  const ping = await mgr.call("ping", {}, { timeout: 20000 });
  ok("manager: a call round-trips to the worker", ping?.ok === true, JSON.stringify(ping).slice(0, 120));

  const caps = await mgr.capabilities();
  ok("manager: capabilities say the sidecar is available", caps.available === true, caps.reason);
  ok("manager: capabilities name the tools that were found", caps.canTranscode && caps.canProbe && caps.canTranscribe);

  const bytes = Buffer.from(JSON.stringify({
    kind: "video", codec: "prores", audio: "pcm_s24le", width: 1920, height: 1080,
    fps: 29.97, duration: 12.5,
  })).toString("base64");
  const ing = await mgr.ingest({ bytes, name: "clip.mxf" });
  ok("manager: ingest hands back a playable token", ing?.ok === true && !!ing.playableToken, JSON.stringify(ing).slice(0, 160));
  const resolved = mgr.resolveToken(ing.playableToken);
  ok("manager: the token resolves to a file that exists", !!resolved && fs.existsSync(resolved), resolved);

  const bad = await mgr.call("not-an-op", {});
  ok("manager: an unknown operation comes back as data, not a crash", bad?.ok === false && bad.code === "unknown-op", JSON.stringify(bad).slice(0, 120));

  mgr.stop();
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

/* ------------------------------------------------------------------ *
 * 4. The real Electron shell
 * ------------------------------------------------------------------ */
async function testElectron(stubs, tmp) {
  const { _electron } = require("playwright");
  const exe = path.join(ROOT, "node_modules", "electron", "dist", "electron.exe");
  if (!fs.existsSync(exe)) {
    ok("electron: the Electron binary is present", false, exe);
    return;
  }

  const served = path.join(tmp, "served.bin");
  const body = Buffer.from("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".repeat(20));
  fs.writeFileSync(served, body);

  let app;
  const mainLog = [];
  try {
    app = await _electron.launch({
      args: ["."],
      executablePath: exe,
      cwd: ROOT,
      env: {
        ...process.env,
        AIFIMORA_DEBUG_PROTOCOL: "1",
        AIFIMORA_FFMPEG: stubs.ffmpeg,
        AIFIMORA_FFPROBE: stubs.probe,
        AIFIMORA_WHISPER: stubs.whisper,
        AIFIMORA_WHISPER_MODEL: stubs.model,
        AIFIMORA_SIDECAR_CACHE: path.join(tmp, "electron-cache"),
      },
    });
  } catch (err) {
    ok("electron: the shell launches", false, String(err?.message || err).slice(0, 200));
    return;
  }
  try {
    app.process()?.stderr?.on("data", (d) => mainLog.push(String(d)));
    const page = await app.firstWindow();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(1500);
    const errors = [];
    page.on("pageerror", (e) => errors.push("PAGE: " + e.message));
    page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });

    const caps = await page.evaluate(async () => {
      const api = window.aifimoraDesktop?.media;
      if (!api) return { ok: false, reason: "no bridge" };
      try { return await api.capabilities(); } catch (e) { return { ok: false, reason: String(e) }; }
    });
    ok("electron: the renderer reaches the sidecar", caps?.available === true, caps?.reason || caps?.worker);
    ok("electron: the sidecar runs as a utility process", caps?.worker === "utility", caps?.worker);

    const analysed = await page.evaluate(async (p) => {
      try {
        return await window.aifimoraDesktop.media.analyze({ path: p });
      } catch (e) { return { ok: false, error: String(e) }; }
    }, path.join(tmp, "source.mxf"));
    ok("electron: the renderer can probe a file", analysed?.ok === true, JSON.stringify(analysed).slice(0, 140));

    const reg = await page.evaluate(async (p) => {
      try { return await window.aifimoraDesktop.media.register(p); } catch (e) { return { ok: false, error: String(e) }; }
    }, served);
    ok("electron: a file can be registered for delivery", reg?.ok === true && !!reg.token, JSON.stringify(reg));

    const fetched = await page.evaluate(async (token) => {
      const url = window.aifimoraDesktop.media.url(token);
      try {
        const res = await fetch(url);
        const text = await res.text();
        const ranged = await fetch(url, { headers: { Range: "bytes=0-9" } });
        const rangedText = await ranged.text();
        return { url, status: res.status, len: text.length, rangeStatus: ranged.status, rangeLen: rangedText.length, error: "" };
      } catch (e) { return { url, status: -1, len: -1, rangeStatus: -1, rangeLen: -1, error: String(e) }; }
    }, reg.token);
    ok("electron: the cache URL serves the file", fetched?.status === 200 && fetched.len === body.length, `${fetched?.status} ${fetched?.len}/${body.length} ${fetched?.error || ""} | main: ${mainLog.join(" ").slice(0, 300)}`);
    ok("electron: the cache URL honours byte ranges", fetched?.rangeStatus === 206 && fetched.rangeLen === 10, `${fetched?.rangeStatus} ${fetched?.rangeLen} ${fetched?.error || ""}`);

    // The console must be clean before the deliberate negative test below
    // (a 404 is expected there and Chromium logs it).
    ok("electron: no console errors while using the sidecar", errors.length === 0, errors.slice(0, 3).join(" | "));

    const unregistered = await page.evaluate(async () => {
      try {
        const res = await fetch("app://local/_media/not-a-real-token");
        return { status: res.status };
      } catch (e) { return { status: -1, error: String(e) }; }
    });
    ok("electron: an unregistered file is refused", unregistered?.status === 404, String(unregistered?.status));

    // The transport is not the feature. The app has to be able to PLAY the
    // file the sidecar produced — that is what the player's URL allowlist
    // decides, and it is easy to ship a sidecar whose output never plays.
    const playable = await page.evaluate(async (filePath) => {
      try {
        const mod = await import("./js/player.js");
        const api = window.aifimoraDesktop.media;
        const token = (await api.register(filePath));
        const url = api.url(token.token);
        const el = mod.getVideoEl({ id: "probe_media", kind: "video", url, _offline: false });
        return { url, hasEl: !!el, src: el ? el.getAttribute("src") : "" };
      } catch (e) { return { hasEl: false, error: String(e) }; }
    }, served);
    ok("electron: the app can play a file the sidecar produced", playable?.hasEl === true, JSON.stringify(playable).slice(0, 160));
  } finally {
    try { await app.close(); } catch { /* already closed */ }
  }
}

/* ------------------------------------------------------------------ *
 * 5. The browser build — no sidecar, and still working
 * ------------------------------------------------------------------ */
async function testBrowser(server) {
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGE: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const caps = await page.evaluate(async () => {
    const mod = await import("./js/media-sidecar.js");
    const c = await mod.sidecarCapabilities();
    return { available: c.available, reason: c.reason, hasDesktop: mod.hasDesktopBridge() };
  });
  ok("browser: the web build reports no sidecar", caps.available === false && caps.hasDesktop === false, caps.reason);
  ok("browser: the reason is stated, not hidden", /browser build/i.test(caps.reason || ""), caps.reason);

  const ingest = await page.evaluate(async () => {
    const mod = await import("./js/media-sidecar.js");
    const file = new File([new Uint8Array([1, 2, 3])], "x.mxf", { type: "application/mxf" });
    const res = await mod.ingestFile(file);
    return res === null ? "null" : JSON.stringify(res);
  });
  ok("browser: asking for a sidecar ingest returns null, not a crash", ingest === "null", String(ingest).slice(0, 120));

  const transcript = await page.evaluate(async () => {
    const { store } = await import("./js/state.js");
    store.set({ clips: [{ id: "c1", type: "video", trackId: "v1", start: 0, duration: 5, mediaId: null, name: "x", fx: {} }] });
    document.querySelector('[data-inspector="text"]')?.click();
    document.getElementById("btnTranscribe")?.click();
    await new Promise((r) => setTimeout(r, 1800));
    const tr = store.get().transcript || [];
    return {
      lines: document.querySelectorAll(".t-line").length,
      source: tr[0]?.source || "",
      banner: document.querySelector(".t-source")?.textContent || "",
    };
  });
  ok("browser: the transcript still appears without a speech engine", transcript.lines > 0, String(transcript.lines));
  ok("browser: the transcript says it is a sample", transcript.source === "simulated" && /sample/i.test(transcript.banner), transcript.banner);

  ok("browser: no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
}

/* ------------------------------------------------------------------ *
 * Run
 * ------------------------------------------------------------------ */
(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "aifimora-sidecar-"));
  const stubs = makeStubs(path.join(tmp, "stubs"));
  const server = await startServer();
  let failed = 0;

  try {
    console.log("\n— discovery —");
    testDiscovery(stubs);

    console.log("\n— worker —");
    await testWorker(stubs, tmp);

    console.log("\n— manager —");
    await testManager(stubs, tmp);

    console.log("\n— electron —");
    await testElectron(stubs, tmp);

    console.log("\n— browser build —");
    await testBrowser(server);
  } catch (err) {
    ok("suite ran to completion", false, String(err?.stack || err));
  }

  server.close();
  failed = checks.filter((c) => !c.pass).length;
  console.log(`\n${checks.length - failed}/${checks.length} checks passed`);
  if (failed) {
    console.log("FAILURES:");
    checks.filter((c) => !c.pass).forEach((c) => console.log("  - " + c.name + (c.extra ? " — " + c.extra : "")));
  }
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* leave it */ }
  process.exit(failed ? 1 : 0);
})();
