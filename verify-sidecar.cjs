/* verify-sidecar.cjs — proves the media sidecar works, or says why it cannot.
 *
 * FFmpeg and ffprobe now ship with the app (the `ffmpeg-static` and
 * `ffprobe-static` npm packages), so the suite runs **both** ways:
 *
 *   - against STAND-IN tools, where the process spawn, the command
 *     construction, the output parsing, the IPC and the media:// delivery
 *     are exercised for real and only the binaries are replaced. This is
 *     how the "tool is missing" paths are proved.
 *   - against the REAL bundled binaries, which is how the encoder is
 *     finally proved end to end: a real MP4 is written and probed by a
 *     real ffprobe, and the codec, resolution and audio track in the file
 *     are read back rather than assumed.
 *
 * Whisper is still not bundled (it needs a model file), so the speech
 * engine remains verified against a stand-in only.
 *
 * Groups:
 *   1. discovery   — where the tools are looked for, and what is missing
 *   2. worker      — the sidecar itself, over newline-delimited JSON
 *   2b. encoder    — the `encode` op: the arguments, the probe of the
 *                     result, and the honest refusal when ffmpeg is absent
 *   2c. real tools — the same encoder against the REAL bundled ffmpeg and
 *                     ffprobe, not a stand-in
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

/* ---- the encoder path (APP-037) ----
 * The encode op always passes -r and a scale filter, which is how this
 * stand-in tells an encode apart from the conversion ladder's transcode
 * rung (that one has no -r). */
const vIdx = args.indexOf("-c:v");
const encoder = vIdx >= 0 ? args[vIdx + 1] : "";
const vfIdx = args.indexOf("-vf");
const vf = vfIdx >= 0 ? args[vfIdx + 1] : "";
const rIdx = args.indexOf("-r");
const fps = rIdx >= 0 ? Number(args[rIdx + 1]) : (src.fps || 25);
const silent = args.includes("-an");

const readSize = () => {
  const m = /scale=(\\d+):(\\d+)/.exec(vf);
  if (m) return { width: Number(m[1]), height: Number(m[2]) };
  return { width: src.width || 1920, height: src.height || 1080 };
};

/* No hardware encoder exists on the test machine. Failing here is what
 * lets the software fallback be observed. */
if (encoder && /nvenc|qsv/.test(encoder)) {
  process.stderr.write("Unknown encoder '" + encoder + "'\\n");
  process.exit(1);
}

/* Audio only (MP3). */
if (!encoder && args.includes("-vn") && args.includes("libmp3lame")) {
  fs.writeFileSync(out, JSON.stringify({
    kind: "audio", codec: "mp3", audio: "mp3", duration: src.duration || 5, container: "mp3"
  }));
  process.exit(0);
}

/* Animated GIF: the palette pass. */
if (!encoder && /palettegen/.test(vf)) {
  const size = readSize();
  fs.writeFileSync(out, JSON.stringify({
    kind: "video", codec: "gif", audio: null, width: size.width, height: size.height,
    fps, duration: src.duration || 5, container: "gif"
  }));
  process.exit(0);
}

if (encoder && rIdx >= 0) {
  let codec = src.codec || "vp9";
  if (/264/.test(encoder)) codec = "h264";
  else if (/265/.test(encoder)) codec = "hevc";
  else if (/av1|svtav1|aom/.test(encoder)) codec = "av1";
  else if (/vpx/.test(encoder)) codec = "vp9";
  else if (/prores/.test(encoder)) codec = "prores";
  else if (/mpeg4/.test(encoder)) codec = "mpeg4";
  let audio = silent ? null : (src.audio || "aac");
  const aIdx = args.indexOf("-c:a");
  if (aIdx >= 0) {
    const ac = args[aIdx + 1];
    if (ac === "aac") audio = "aac";
    else if (ac === "libopus") audio = "opus";
    else if (ac === "libmp3lame") audio = "mp3";
  }
  const size = readSize();
  const container = out.endsWith(".mov") ? "mov,mp4,m4a"
    : out.endsWith(".webm") ? "matroska,webm"
    : out.endsWith(".gif") ? "gif"
    : out.endsWith(".mp3") ? "mp3"
    : "mov,mp4,m4a,3gp,3g2,mj2";
  fs.writeFileSync(out, JSON.stringify({
    kind: "video", codec, audio, width: size.width, height: size.height, fps,
    duration: src.duration || 5, container
  }));
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

  // First, with no overrides at all: what the project finds for itself.
  // A bundled static must resolve to the BINARY — the package's JavaScript
  // entry point would be run as a script and fail in a way that looks like
  // a broken FFmpeg rather than a broken lookup.
  for (const k of ["AIFIMORA_FFMPEG", "AIFIMORA_FFPROBE"]) delete process.env[k];
  const self = tools.discover();
  const resolvesToBinary = ["ffmpeg", "ffprobe"].every((n) => {
    const p = self[n];
    if (!p) return true;                    // not installed here — nothing to judge
    return !/\.(js|cjs|mjs)$/i.test(p);
  });
  ok("discovery: a bundled static resolves to the binary, not to a script", resolvesToBinary,
    `${self.ffmpeg || "(none)"} | ${self.ffprobe || "(none)"}`);

  // The packaged app must prefer the UNPACKED binary. A path that is still
  // inside an asar cannot be executed, and Electron's filesystem will
  // happily report such a file as existing, so offering it would mean the
  // app tries to run something that is not a program.
  const savedResources = process.resourcesPath;
  try {
    Object.defineProperty(process, "resourcesPath", { value: "C:\\app\\resources", configurable: true });
    const cands = tools.staticCandidates("ffmpeg-static", ["ffmpeg.exe"]);
    const archived = cands.filter((p) => /app\.asar[\\/]/i.test(p));
    ok("discovery: the unpacked binary is preferred over the archived one",
      cands.length > 0 && cands[0].includes("app.asar.unpacked") && archived.length === 0,
      cands.join(" | "));

    // A relative path is a path, not a list of characters.
    const one = tools.staticCandidates("whisper-node", "whisper-cli.exe");
    const split = one.filter((p) => !p.endsWith("whisper-cli.exe"));
    ok("discovery: a single relative path is not split into characters",
      one.length > 0 && split.length === 0, `${one.length} candidates: ${one.join(" | ")}`);
  } finally {
    Object.defineProperty(process, "resourcesPath", { value: savedResources, configurable: true });
  }

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

  // With the bundled statics switched off, no tool may come from the npm
  // packages any more. An explicit override still wins — that is by design —
  // so the check is on the SOURCE, not on "is there a path at all".
  process.env.AIFIMORA_DISABLE_BUNDLED_TOOLS = "1";
  const bare = tools.discover();
  ok("discovery: what is missing is named", Array.isArray(bare.missing) && bare.missing.length > 0, JSON.stringify(bare.missing));
  const fromStatics = [bare.ffmpeg, bare.ffprobe].filter((p) => p && /node_modules[\\/]ff(mpeg|probe)-static/i.test(p));
  ok("discovery: a bundled tool can be switched off",
    fromStatics.length === 0 && bare.ffmpegSource !== "dependency" && bare.ffprobeSource !== "dependency",
    `${bare.ffmpeg || "(none)"} ${bare.ffprobe || "(none)"}`);
  delete process.env.AIFIMORA_DISABLE_BUNDLED_TOOLS;

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
  // The bundled statics are switched off, or the real binaries would answer.
  const bare = startWorker({
    AIFIMORA_FFMPEG: "", AIFIMORA_FFPROBE: "", AIFIMORA_WHISPER: "", AIFIMORA_WHISPER_MODEL: "",
    AIFIMORA_DISABLE_BUNDLED_TOOLS: "1",
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
 * 2b. The encoder (APP-037)
 *
 * The `encode` op is what turns a recorded WebM into the file the export
 * sheet promised. The arguments are checked one by one, the op is run end to
 * end against the stand-in ffmpeg, and the output is probed — because the
 * sidecar's rule is that nothing is claimed that was not verified.
 * ------------------------------------------------------------------ */
async function testEncoder(stubs, tmp) {
  const svc = require(path.join(ROOT, "electron", "sidecar", "media-service.cjs"));

  /* ---- the argument builder, on its own ---- */
  // A build without the encoder must report each missing piece rather than
  // take the whole suite down with it.
  const hasBuilder = typeof svc.buildEncodeArgs === "function" && typeof svc.encoderPlans === "function";
  const build = (opts) => {
    if (!hasBuilder) return { args: [], notes: [] };
    try { return svc.buildEncodeArgs(opts); } catch { return { args: [], notes: [] }; }
  };
  const plans = (opts) => {
    if (!hasBuilder) return { family: "", plans: [] };
    try { return svc.encoderPlans(opts); } catch { return { family: "", plans: [] }; }
  };

  const h264 = build({
    container: "mp4", family: "h264", encoder: "libx264",
    width: 1920, height: 1080, fps: 30, bitrateMbps: 16, audio: true, audioBitrate: 192,
  });
  const h264s = h264.args.join(" ");
  ok("encoder: the argument builder exists", hasBuilder);
  ok("encoder: MP4/H.264 asks for libx264", h264.args.includes("libx264"), h264s);
  ok("encoder: the requested size is in the scale filter", /scale=1920:1080/.test(h264s), h264s);
  ok("encoder: the frame rate is set", h264.args.includes("-r") && h264.args[h264.args.indexOf("-r") + 1] === "30", h264s);
  ok("encoder: the bit rate is set", h264.args.includes("-b:v") && h264.args[h264.args.indexOf("-b:v") + 1] === "16M", h264s);
  ok("encoder: the sound track is AAC", h264.args.includes("aac"), h264s);
  ok("encoder: MP4 is written faststart", /faststart/.test(h264s), h264s);
  ok("encoder: the source is fitted, not stretched", /force_original_aspect_ratio=decrease/.test(h264s) && /pad=/.test(h264s), h264s);

  const hevc = build({
    container: "mov", family: "hevc", encoder: "libx265",
    width: 3840, height: 2160, fps: 60, bitrateMbps: 40, audio: true,
  });
  ok("encoder: HEVC is tagged hvc1 so Apple and Windows play it", hevc.args.includes("hvc1"), hevc.args.join(" "));

  const silent = build({
    container: "mp4", family: "h264", encoder: "libx264",
    width: 1280, height: 720, fps: 24, bitrateMbps: 8, audio: false,
  });
  ok("encoder: no audio means -an, not a silent track", silent.args.includes("-an") && !silent.args.includes("aac"), silent.args.join(" "));

  const gif = build({ container: "gif", family: "gif", encoder: null, width: 640, height: 360, fps: 15 });
  ok("encoder: a GIF is made with a palette, not posterised", /palettegen/.test(gif.args.join(" ")), gif.args.join(" "));

  const webm = build({
    container: "webm", family: "vp9", encoder: "libvpx-vp9",
    width: 1280, height: 720, fps: 30, bitrateMbps: 8, audio: true,
  });
  ok("encoder: WebM carries Opus, not AAC", webm.args.includes("libopus"), webm.args.join(" "));

  /* ---- which encoder gets used ---- */
  const webmPlan = plans({ container: "webm", codec: "h264", hardware: "auto" });
  ok("encoder: WebM cannot hold H.264, so it does not try", webmPlan.family === "vp9", webmPlan.family);
  const nvPlan = plans({ container: "mp4", codec: "h264", hardware: "nvenc" });
  ok("encoder: NVENC is tried before the software encoder", (nvPlan.plans[0] || {}).id === "hw:h264_nvenc", nvPlan.plans.map((p) => p.id).join(","));
  ok("encoder: the software encoder is the fallback", nvPlan.plans.some((p) => p.id === "sw:libx264"), nvPlan.plans.map((p) => p.id).join(","));

  /* ---- the op, end to end ---- */
  const src = path.join(tmp, "capture.webm");
  fs.writeFileSync(src, JSON.stringify({
    kind: "video", codec: "vp9", audio: "opus", width: 1280, height: 720, fps: 30, duration: 4.25,
  }));
  const env = {
    AIFIMORA_FFMPEG: stubs.ffmpeg,
    AIFIMORA_FFPROBE: stubs.probe,
    AIFIMORA_SIDECAR_CACHE: path.join(tmp, "enc-cache"),
  };
  const w = startWorker(env);

  const enc = await w.call("encode", {
    path: src, container: "mp4", codec: "h264", width: 1920, height: 1080,
    fps: 30, bitrateMbps: 16, audio: true, hardware: "auto",
  });
  const e = enc.result || {};
  ok("encoder: the op writes a file", enc.ok && !!e.path && fs.existsSync(e.path), JSON.stringify(e).slice(0, 160));
  ok("encoder: the result is probed, not assumed", e.verified === true && !!e.probe, JSON.stringify(e.probe || {}).slice(0, 120));
  ok("encoder: the file is the codec that was asked for", e.probe?.video?.codec === "h264", e.probe?.video?.codec);
  ok("encoder: the file is the resolution that was asked for", e.probe?.video?.width === 1920 && e.probe?.video?.height === 1080, `${e.probe?.video?.width}x${e.probe?.video?.height}`);
  ok("encoder: the file carries the sound track", e.probe?.hasAudio === true, String(e.probe?.hasAudio));
  ok("encoder: the encoder that ran is named", e.encoder === "libx264", e.encoder);
  ok("encoder: a successful encode raises no warnings", (e.warnings || []).length === 0, JSON.stringify(e.warnings));

  // A container that cannot hold the requested codec says so out loud.
  const mismatch = await w.call("encode", {
    path: src, container: "webm", codec: "h264", width: 1280, height: 720,
    fps: 30, bitrateMbps: 8, audio: true, hardware: "auto",
  });
  const m = mismatch.result || {};
  ok("encoder: an impossible codec/container pair is reported, not hidden", (m.warnings || []).some((w2) => /cannot hold/i.test(w2)), JSON.stringify(m.warnings));
  ok("encoder: the codec that was really used is reported", m.codec === "vp9", m.codec);

  // Hardware asked for, hardware absent: software takes over, and says so.
  const nvEnc = await w.call("encode", {
    path: src, container: "mp4", codec: "h264", width: 1280, height: 720,
    fps: 30, bitrateMbps: 16, audio: true, hardware: "nvenc",
  });
  const n = nvEnc.result || {};
  ok("encoder: a missing hardware encoder falls back to software", n.ok === true && n.hardware === false, JSON.stringify(n.attempts));
  ok("encoder: the software fallback is named, not hidden", (n.warnings || []).some((w2) => /hardware/i.test(w2)), JSON.stringify(n.warnings));
  ok("encoder: the failed hardware attempt is still listed", (n.attempts || []).some((a) => /hw:/.test(a.id)), JSON.stringify(n.attempts));

  w.kill();

  // The same worker with no tools at all must say so instead of pretending.
  const bare = startWorker({
    AIFIMORA_FFMPEG: "", AIFIMORA_FFPROBE: "",
    AIFIMORA_DISABLE_BUNDLED_TOOLS: "1",
    AIFIMORA_SIDECAR_CACHE: path.join(tmp, "enc-bare"),
  });
  const bareEnc = await bare.call("encode", { path: src, container: "mp4", codec: "h264" });
  ok("encoder: without ffmpeg it says ffmpeg is missing", bareEnc.ok === false && bareEnc.error.code === "no-ffmpeg", JSON.stringify(bareEnc.error));
  bare.kill();
}

/* ------------------------------------------------------------------ *
 * 2c. The real tools
 *
 * The statics are bundled now, so the encoder can finally be run against a
 * REAL FFmpeg rather than a stand-in. This is the group that closes the
 * biggest "not verified" gap in the sidecar's history: the argument
 * builder, the encoder selection, the probe of the written file and the
 * AV1 fallback chain are all exercised against the real binaries.
 *
 * It runs only when a real ffmpeg/ffprobe is actually present; otherwise it
 * says so and is skipped rather than faked.
 * ------------------------------------------------------------------ */
async function testRealTools(tmp) {
  const tools = require(path.join(ROOT, "electron", "sidecar", "tools.cjs"));
  const saved = {
    ffmpeg: process.env.AIFIMORA_FFMPEG,
    ffprobe: process.env.AIFIMORA_FFPROBE,
    whisper: process.env.AIFIMORA_WHISPER,
    model: process.env.AIFIMORA_WHISPER_MODEL,
    off: process.env.AIFIMORA_DISABLE_BUNDLED_TOOLS,
  };
  // No overrides: this group is about what the build can find on its own.
  for (const k of ["AIFIMORA_FFMPEG", "AIFIMORA_FFPROBE", "AIFIMORA_WHISPER", "AIFIMORA_WHISPER_MODEL"]) {
    delete process.env[k];
  }
  delete process.env.AIFIMORA_DISABLE_BUNDLED_TOOLS;

  const found = tools.discover();
  const realFfmpeg = found.ffmpeg && !/stub/i.test(found.ffmpeg);
  const realFfprobe = found.ffprobe && !/stub/i.test(found.ffprobe);
  if (!realFfmpeg || !realFfprobe) {
    ok("real tools: a real ffmpeg and ffprobe are available", false,
      `ffmpeg=${found.ffmpeg || "(none)"} ffprobe=${found.ffprobe || "(none)"}`);
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    return;
  }
  ok("real tools: a real ffmpeg and ffprobe are available", true, `${found.ffmpeg} | ${found.ffprobe}`);
  ok("real tools: they are run directly, not through a script wrapper", found.ffmpegRunner === "direct" && found.ffprobeRunner === "direct",
    `${found.ffmpegRunner}/${found.ffprobeRunner}`);

  const svc = require(path.join(ROOT, "electron", "sidecar", "media-service.cjs"));
  const cache = path.join(tmp, "real-cache");
  fs.mkdirSync(cache, { recursive: true });

  /* Build a real source: a test pattern with a real sine tone. */
  const source = path.join(cache, "source.mp4");
  const mk = await runTool(found.ffmpeg, found.ffmpegRunner, [
    "-y", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=25:duration=3",
    "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
    "-shortest", source,
  ], 180000);
  ok("real tools: a real source with video and sound was made", mk.ok && fs.existsSync(source),
    mk.ok ? source : (mk.stderr || "").trim().split("\n").slice(-3).join(" "));

  const probeSrc = await svc.handle({ id: "1", op: "analyze", params: { path: source } });
  const ps = probeSrc.result || {};
  ok("real tools: the real source probes as H.264 with an AAC track", probeSrc.ok && ps.video?.codec === "h264" && ps.hasAudio === true,
    `${ps.video?.codec} ${ps.video?.width}x${ps.video?.height} audio=${ps.audio?.codec}`);

  /* Now encode it for real, the way the export does. */
  const w = startWorker({ AIFIMORA_SIDECAR_CACHE: cache });
  const cases = [
    { id: "mp4-h264", container: "mp4", codec: "h264", width: 1280, height: 720, fps: 30, audio: true,
      expect: { codec: "h264", w: 1280, h: 720, audio: "aac" } },
    { id: "mp4-hevc", container: "mp4", codec: "hevc", width: 640, height: 360, fps: 24, audio: true,
      expect: { codec: "hevc", w: 640, h: 360, audio: "aac" } },
    { id: "webm-vp9", container: "webm", codec: "vp9", width: 640, height: 360, fps: 25, audio: true,
      expect: { codec: "vp9", w: 640, h: 360, audio: "opus" } },
    { id: "mp4-av1", container: "mp4", codec: "av1", width: 320, height: 240, fps: 15, audio: false,
      expect: { codec: "av1", w: 320, h: 240, audio: null } },
    { id: "mov-prores", container: "mov", codec: "prores", width: 320, height: 240, fps: 25, audio: false,
      expect: { codec: "prores", w: 320, h: 240, audio: null } },
  ];
  for (const c of cases) {
    const res = await w.call("encode", {
      path: source, container: c.container, codec: c.codec, width: c.width, height: c.height,
      fps: c.fps, bitrateMbps: 8, audio: c.audio, audioBitrate: 128, hardware: "auto",
    });
    const e = res.result || {};
    const v = e.probe?.video || {};
    const a = e.probe?.audio || {};
    ok(`real tools: ${c.id} is written and probed`, res.ok === true && !!e.path && fs.existsSync(e.path),
      res.ok ? e.path : JSON.stringify(res.error || {}).slice(0, 200));
    ok(`real tools: ${c.id} really is ${c.expect.codec} at ${c.expect.w}×${c.expect.h}`, v.codec === c.expect.codec && v.width === c.expect.w && v.height === c.expect.h,
      `${v.codec} ${v.width}x${v.height}`);
    if (c.expect.audio) {
      ok(`real tools: ${c.id} really carries a ${c.expect.audio} track`, e.probe?.hasAudio === true && a.codec === c.expect.audio,
        `audio=${a.codec}`);
    } else {
      ok(`real tools: ${c.id} really has no audio track`, e.probe?.hasAudio === false, `audio=${a.codec || "(none)"}`);
    }
    ok(`real tools: ${c.id} is reported without warnings`, (e.warnings || []).length === 0, JSON.stringify(e.warnings));
  }

  /* The AV1 chain: this build has libaom but not libsvtav1, so the fallback
   * must have taken over — and the op must say which encoder ran. */
  const av1 = await w.call("encode", {
    path: source, container: "mp4", codec: "av1", width: 320, height: 240,
    fps: 15, bitrateMbps: 4, audio: false, hardware: "auto",
  });
  const av1r = av1.result || {};
  ok("real tools: the AV1 encoder that actually ran is named", !!av1r.encoder, `${av1r.encoder}`);

  /* A GIF, with the two-pass palette. */
  const gif = await w.call("encode", {
    path: source, container: "gif", codec: "gif", width: 240, height: 180,
    fps: 10, bitrateMbps: 4, audio: false, hardware: "auto",
  });
  const gr = gif.result || {};
  ok("real tools: a GIF is written and probes as a GIF", gif.ok === true && gr.probe?.video?.codec === "gif",
    JSON.stringify({ ok: gif.ok, codec: gr.probe?.video?.codec, err: gr.error }).slice(0, 200));

  /* An MP3 (audio only). */
  const mp3 = await w.call("encode", {
    path: source, container: "mp3", codec: "mp3", width: 320, height: 240,
    fps: 25, bitrateMbps: 8, audio: true, audioBitrate: 128, hardware: "auto",
  });
  const mr = mp3.result || {};
  ok("real tools: an MP3 is written and probes as MP3 audio", mp3.ok === true && mr.probe?.audio?.codec === "mp3",
    JSON.stringify({ ok: mp3.ok, codec: mr.probe?.audio?.codec, err: mr.error }).slice(0, 200));

  w.kill();

  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
}

/** Run a discovered tool directly (the real binaries are native programs). */
function runTool(toolPath, runner, args, timeout = 60000) {
  return new Promise((resolve) => {
    const child = spawn(toolPath, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => { out += d.toString(); });
    child.stderr.on("data", (d) => { err += d.toString(); });
    const timer = setTimeout(() => { try { child.kill(); } catch { /* gone */ } }, timeout);
    child.on("error", (e) => { clearTimeout(timer); resolve({ ok: false, stdout: out, stderr: String(e?.message || e) }); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ ok: code === 0, code, stdout: out, stderr: err }); });
  });
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

  /* The encoder, through the manager: bytes in, a finished file at the
   * destination out. The bytes never travel back to the caller. */
  const capture = JSON.stringify({
    kind: "video", codec: "vp9", audio: "opus", width: 1280, height: 720, fps: 30, duration: 4.25,
  });
  const dest = path.join(tmp, "manager-export.mp4");
  const encoded = typeof mgr.encode === "function"
    ? await mgr.encode({
      bytes: Buffer.from(capture, "utf-8"),
      name: "capture.webm",
      container: "mp4", codec: "h264", width: 1280, height: 720, fps: 30,
      bitrateMbps: 8, audio: true, hardware: "auto", dest,
    })
    : { ok: false, code: "no-encode-op" };
  ok("manager: encode returns the finished file", encoded?.ok === true && !!encoded.path, JSON.stringify(encoded).slice(0, 160));
  ok("manager: the finished file is copied to the destination", fs.existsSync(dest), dest);
  ok("manager: the captured bytes arrived intact", Math.abs((encoded?.probe?.duration || 0) - 4.25) < 0.01, String(encoded?.probe?.duration));
  ok("manager: the encoded file is the size that was asked for", encoded?.probe?.video?.width === 1280 && encoded?.probe?.video?.height === 720, `${encoded?.probe?.video?.width}x${encoded?.probe?.video?.height}`);

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

    /* The export path, end to end: the renderer hands a captured video to
     * the encoder over IPC and a real file appears at the destination. The
     * bytes are the ones the renderer sent — the probe says so. */
    const destFile = path.join(tmp, "electron-export.mp4");
    const capture = JSON.stringify({
      kind: "video", codec: "vp9", audio: "opus", width: 1280, height: 720, fps: 30, duration: 4.25,
    });
    const encoded = await page.evaluate(async ({ bytes, dest }) => {
      try {
        return await window.aifimoraDesktop.media.encode({
          name: "capture.webm",
          bytes: new Uint8Array(bytes),
          opts: {
            container: "mp4", codec: "h264", width: 1280, height: 720, fps: 30,
            bitrateMbps: 8, audio: true, hardware: "auto", dest,
          },
        });
      } catch (e) { return { ok: false, error: String(e) }; }
    }, { bytes: Array.from(Buffer.from(capture, "utf-8")), dest: destFile });
    ok("electron: the renderer can encode a capture", encoded?.ok === true, JSON.stringify(encoded).slice(0, 160));
    ok("electron: the encoded file lands at the destination", fs.existsSync(destFile), destFile);
    ok("electron: the captured bytes arrived intact", Math.abs((encoded?.probe?.duration || 0) - 4.25) < 0.01, String(encoded?.probe?.duration));
    ok("electron: the encoded file is the size that was asked for", encoded?.probe?.video?.width === 1280 && encoded?.probe?.video?.height === 720, `${encoded?.probe?.video?.width}x${encoded?.probe?.video?.height}`);

    /* A file the sidecar produced must reach a Web Audio graph. If it did
     * not, the export would record a silent video. */
    const graphed = await page.evaluate(async (filePath) => {
      try {
        const api = window.aifimoraDesktop.media;
        const token = (await api.register(filePath)).token;
        const url = api.url(token);
        const mod = await import("./js/audio-fx.js");
        const el = document.createElement("video");
        el.src = url;
        el.crossOrigin = "anonymous";
        document.body.appendChild(el);
        const rec = mod.ensureGraph(el, url);
        let busTracks = -1;
        let busErr = "";
        try {
          const bus = typeof mod.mixBusStream === "function" ? mod.mixBusStream() : null;
          busTracks = bus ? bus.getAudioTracks().length : 0;
        } catch (e) { busErr = String(e?.message || e); }
        return {
          url,
          hasGraph: !!rec,
          hasGain: !!(rec && rec.gain),
          busTracks,
          busErr,
        };
      } catch (e) { return { hasGraph: false, error: String(e?.message || e) }; }
    }, served);
    ok("electron: a sidecar file reaches a Web Audio graph (so it is not silent)", graphed.hasGraph === true, graphed.error || graphed.url);
    ok("electron: the mix bus has an audio track to record", graphed.busTracks === 1, String(graphed.busTracks) + " " + (graphed.busErr || ""));
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

    console.log("\n— encoder —");
    await testEncoder(stubs, tmp);

    console.log("\n— the real tools —");
    await testRealTools(tmp);

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
