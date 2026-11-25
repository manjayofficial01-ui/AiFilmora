/* electron/sidecar/media-service.cjs — the worker that owns the external media tools.
 *
 * AiFilmora's browser build can decode mp4/webm/mp3 and nothing else. Real
 * footage arrives as MXF, MKV, ProRes, HEVC, AIFF, FLAC… A sidecar lets the
 * app see those files instead of showing a dead card.
 *
 * This worker speaks newline-delimited JSON. One request per line:
 *
 *     {"id":"1","op":"analyze","params":{"path":"C:\\clips\\a.mxf"}}
 *     {"id":"1","ok":true,"result":{ … }}
 *
 * It runs as an Electron UtilityProcess (message port) or as a plain Node
 * child (stdin/stdout), so the same code is testable without a desktop.
 *
 * Two rules hold everywhere in this file:
 *   1. Never claim work that was not done. If a tool is missing, say which.
 *   2. Never destroy the user's file. Every output goes to a cache path.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

const { discover } = require("./tools.cjs");

const isWin = process.platform === "win32";

/* Codecs a Chromium-based player (the Electron shell, and the browser build)
 * can actually decode. Anything else needs converting before it is useful. */
const BROWSER_SAFE_VIDEO = new Set(["h264", "vp8", "vp9", "av1", "theora"]);
const BROWSER_SAFE_AUDIO = new Set(["aac", "mp3", "mp3float", "opus", "flac", "vorbis"]);
/* Raw PCM is playable only inside a WAV container. */
const WAV_ONLY_AUDIO = new Set([
  "pcm_s16le", "pcm_s24le", "pcm_s32le", "pcm_f32le", "pcm_u8", "alac",
]);

/** Can a browser play this audio stream, in this container? */
function audioPlayable(audio, formatName) {
  if (!audio) return true;
  if (BROWSER_SAFE_AUDIO.has(audio.codec)) return true;
  if (WAV_ONLY_AUDIO.has(audio.codec)) {
    return /(^|,)wav(,|$)/.test(String(formatName || "").toLowerCase());
  }
  return false;
}

/* Where this worker may write. Everything it produces lives here. */
function cacheDir() {
  return process.env.AIFIMORA_SIDECAR_CACHE || path.join(os.tmpdir(), "aifilmora-sidecar");
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * discover() reports where the tools are; the operations need *how* to run
 * them as well. This turns one into the other.
 */
function toolSet(d = discover()) {
  return {
    ffmpeg: d.ffmpeg ? { path: d.ffmpeg, runner: d.ffmpegRunner } : null,
    ffprobe: d.ffprobe ? { path: d.ffprobe, runner: d.ffprobeRunner } : null,
    whisper: d.whisper ? { path: d.whisper, runner: d.whisperRunner } : null,
    whisperModel: d.whisperModel || "",
    missing: d.missing || [],
  };
}

/* ------------------------------------------------------------------ *
 * Process helpers
 * ------------------------------------------------------------------ */

/**
 * Run a program and collect its output.
 * @returns {Promise<{ok:boolean, code:number, stdout:string, stderr:string}>}
 */
function run(cmd, args, { timeout = 60000, cwd, env } = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, {
        cwd,
        env,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      resolve({ ok: false, code: -1, stdout: "", stderr: String(err?.message || err) });
      return;
    }
    let out = "";
    let err = "";
    const CAP = 8 * 1024 * 1024;
    let settled = false;
    const finish = (res) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(res);
    };
    child.stdout.on("data", (d) => {
      if (out.length < CAP) out += d.toString();
    });
    child.stderr.on("data", (d) => {
      if (err.length < CAP) err += d.toString();
    });
    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* already gone */ }
      finish({ ok: false, code: -1, stdout: out, stderr: `timed out after ${timeout}ms\n${err}` });
    }, timeout);
    child.on("error", (e) => finish({ ok: false, code: -1, stdout: out, stderr: String(e?.message || e) }));
    child.on("close", (code) => finish({ ok: code === 0, code, stdout: out, stderr: err }));
  });
}

/** Quote one argument for cmd.exe. */
function cmdQuote(s) {
  return `"${String(s).replace(/"/g, '""')}"`;
}

/**
 * Run a discovered tool. A tool may be a native program or a Node script.
 * On Windows a .cmd/.bat shim is run through cmd.exe, because the OS refuses
 * to execute those directly.
 */
async function toolCall(tool, args, opts = {}) {
  if (!tool?.path) return { ok: false, code: -1, stdout: "", stderr: "tool not found" };
  if (tool.runner === "node") {
    // Inside an Electron utility process process.execPath is electron.exe, so
    // it has to be told to behave like plain node.
    const env = { ...process.env };
    if (process.versions?.electron) env.ELECTRON_RUN_AS_NODE = "1";
    return run(process.execPath, [tool.path, ...args], { ...opts, env });
  }
  if (isWin && /\.(cmd|bat)$/i.test(tool.path)) {
    const line = [cmdQuote(tool.path), ...args.map(cmdQuote)].join(" ");
    return run(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", line], {
      ...opts,
      windowsVerbatimArguments: true,
    });
  }
  return run(tool.path, args, opts);
}

/* ------------------------------------------------------------------ *
 * File helpers
 * ------------------------------------------------------------------ */

/** Materialise incoming bytes (base64) into the cache so tools can read them. */
function materialise({ bytes, name }) {
  const ext = path.extname(String(name || "")).toLowerCase() || ".bin";
  const hash = crypto.createHash("sha1").update(String(bytes)).digest("hex").slice(0, 16);
  const dir = ensureDir(path.join(cacheDir(), "in"));
  const file = path.join(dir, `${hash}${ext}`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, Buffer.from(String(bytes), "base64"));
  return file;
}

function resolveInput(params = {}) {
  if (params.path) return String(params.path);
  if (params.bytes) return materialise(params);
  return "";
}

/* ------------------------------------------------------------------ *
 * ffprobe
 * ------------------------------------------------------------------ */

function parseRate(rate) {
  if (!rate) return 0;
  const [n, d] = String(rate).split("/").map(Number);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return 0;
  return Math.round((n / d) * 1000) / 1000;
}

/** Turn ffprobe's JSON into the flat shape the app actually uses. */
function normaliseProbe(doc, file) {
  const streams = Array.isArray(doc?.streams) ? doc.streams : [];
  const fmt = doc?.format || {};
  const v = streams.find((s) => s?.codec_type === "video");
  const a = streams.find((s) => s?.codec_type === "audio");

  const duration = Number(fmt.duration ?? v?.duration ?? a?.duration) || 0;
  const video = v
    ? {
        codec: v.codec_name || "",
        width: Number(v.width) || 0,
        height: Number(v.height) || 0,
        fps: parseRate(v.avg_frame_rate) || parseRate(v.r_frame_rate),
        pixFmt: v.pix_fmt || "",
        duration: Number(v.duration) || duration,
      }
    : null;
  const audio = a
    ? {
        codec: a.codec_name || "",
        sampleRate: Number(a.sample_rate) || 0,
        channels: Number(a.channels) || 0,
        duration: Number(a.duration) || duration,
      }
    : null;

  const hasVideo = !!video;
  const hasAudio = !!audio;
  const videoOk = !hasVideo || BROWSER_SAFE_VIDEO.has(video.codec);
  const audioOk = audioPlayable(audio, fmt.format_name);

  return {
    ok: true,
    path: file,
    duration: Math.round(duration * 1000) / 1000,
    format: fmt.format_name || "",
    size: Number(fmt.size) || 0,
    bitrate: Number(fmt.bit_rate) || 0,
    hasVideo,
    hasAudio,
    video,
    audio,
    // Can the browser play this as it stands? (Container is reported
    // separately — Chromium's demuxer covers more containers than codecs.)
    browserSafe: videoOk && audioOk,
    unsafeReason: [
      hasVideo && !videoOk ? `video codec ${video.codec}` : "",
      hasAudio && !audioOk ? `audio codec ${audio.codec}` : "",
    ].filter(Boolean).join(", "),
  };
}

async function analyzeFile(file, tools) {
  if (!tools.ffprobe) {
    return {
      ok: false,
      code: "no-ffprobe",
      error: "ffprobe was not found, so this file cannot be inspected.",
      missing: tools.missing,
    };
  }
  if (!file || !fs.existsSync(file)) {
    return { ok: false, code: "no-file", error: `File not found: ${file || "(no path)"}` };
  }
  const res = await toolCall(
    tools.ffprobe,
    ["-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", file],
    { timeout: 30000 }
  );
  if (!res.ok) {
    return {
      ok: false,
      code: "ffprobe-failed",
      error: res.stderr?.trim() || `ffprobe exited ${res.code}`,
    };
  }
  let doc;
  try {
    doc = JSON.parse(res.stdout);
  } catch {
    return { ok: false, code: "ffprobe-bad-json", error: "ffprobe did not return JSON" };
  }
  return normaliseProbe(doc, file);
}

/* ------------------------------------------------------------------ *
 * Conversion ladder
 * ------------------------------------------------------------------ */

/**
 * Work out the cheapest conversion that yields a file the browser can play.
 * The order matters: remuxing is seconds, transcoding is minutes.
 */
function planLadder(probe) {
  const rungs = [];

  // Audio on its own: there is no video stream to convert, so the ladder
  // works on the audio codec instead.
  if (!probe?.hasVideo) {
    rungs.push({ id: "remux", ext: ".m4a", args: ["-c", "copy"] });
    rungs.push({ id: "transcode", ext: ".m4a", args: ["-c:a", "aac", "-b:a", "192k"] });
    return rungs;
  }

  const codec = probe?.video?.codec || "";
  if (codec === "hevc") {
    // A lossless remux with the hvc1 tag makes HEVC playable on Apple and
    // Windows without re-encoding. Chromium still cannot decode it, so this
    // rung is reported as "better, not browser-safe".
    rungs.push({ id: "remux-hvc1", ext: ".mov", browserSafe: false, args: ["-c", "copy", "-tag:v", "hvc1"] });
  }
  rungs.push({ id: "remux", ext: ".mp4", browserSafe: BROWSER_SAFE_VIDEO.has(codec), args: ["-c", "copy"] });
  rungs.push({
    id: "transcode",
    ext: ".mp4",
    browserSafe: true,
    args: [
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k",
    ],
  });
  return rungs;
}

async function convertFile(input, tools, { outDir, rungs } = {}) {
  if (!tools.ffmpeg) {
    return {
      ok: false,
      code: "no-ffmpeg",
      error: "ffmpeg was not found, so this file cannot be converted.",
      missing: tools.missing,
    };
  }
  if (!input || !fs.existsSync(input)) {
    return { ok: false, code: "no-file", error: `File not found: ${input || "(no path)"}` };
  }

  const dir = ensureDir(outDir || path.join(cacheDir(), "out"));
  const stem = path.basename(input, path.extname(input)).replace(/[^\w.-]+/g, "_") || "clip";
  const attempts = [];
  // A rung that produced a real file but not one the browser can decode is
  // kept as a fallback, not as the answer.
  let fallback = null;

  for (const rung of rungs) {
    const out = path.join(dir, `${stem}.${rung.id}${rung.ext}`);
    const res = await toolCall(tools.ffmpeg, ["-y", "-i", input, ...rung.args, out], { timeout: 900000 });
    if (!res.ok) {
      attempts.push({ id: rung.id, ok: false, note: (res.stderr || "").trim().split("\n").slice(-3).join(" ") });
      continue;
    }
    // Confirm the output actually exists and is readable before claiming success.
    const check = await analyzeFile(out, tools);
    if (!check.ok || (!check.hasVideo && !check.hasAudio)) {
      attempts.push({ id: rung.id, ok: false, note: "output did not probe cleanly" });
      continue;
    }
    if (!check.browserSafe) {
      // Valid, but the browser still cannot play it. Keep looking.
      attempts.push({
        id: rung.id,
        ok: true,
        browserSafe: false,
        note: `wrote ${path.basename(out)} (${check.unsafeReason || "not browser-playable"})`,
      });
      if (!fallback) {
        fallback = {
          ok: true,
          path: out,
          rung: rung.id,
          browserSafe: false,
          probe: check,
          attempts: attempts.slice(),
          reason: `Converted, but the result is still not browser-playable (${check.unsafeReason || "unknown codec"}).`,
        };
      }
      continue;
    }
    attempts.push({ id: rung.id, ok: true, browserSafe: true, note: "wrote " + path.basename(out) });
    return {
      ok: true,
      path: out,
      rung: rung.id,
      browserSafe: true,
      probe: check,
      attempts,
    };
  }
  if (fallback) return fallback;
  return {
    ok: false,
    code: "convert-failed",
    error: "Every conversion step failed.",
    attempts,
  };
}

/* ------------------------------------------------------------------ *
 * Poster frame
 * ------------------------------------------------------------------ */

async function posterFrame(input, tools, { at, outDir } = {}) {
  if (!tools.ffmpeg) {
    return { ok: false, code: "no-ffmpeg", error: "ffmpeg was not found, so no poster frame could be made." };
  }
  if (!input || !fs.existsSync(input)) {
    return { ok: false, code: "no-file", error: `File not found: ${input || "(no path)"}` };
  }
  const dir = ensureDir(outDir || path.join(cacheDir(), "poster"));
  const stem = path.basename(input, path.extname(input)).replace(/[^\w.-]+/g, "_") || "clip";
  const out = path.join(dir, `${stem}.png`);
  const atSec = Number.isFinite(at) && at > 0 ? at : 1;
  const res = await toolCall(
    tools.ffmpeg,
    ["-y", "-ss", String(atSec), "-i", input, "-frames:v", "1", "-f", "image2", out],
    { timeout: 120000 }
  );
  if (!res.ok || !fs.existsSync(out)) {
    return {
      ok: false,
      code: "poster-failed",
      error: (res.stderr || "").trim().split("\n").slice(-3).join(" ") || "ffmpeg produced no frame",
    };
  }
  return { ok: true, path: out, at: atSec, bytes: fs.statSync(out).size };
}

/* ------------------------------------------------------------------ *
 * Transcription
 * ------------------------------------------------------------------ */

/** "00:00:02,500" -> 2500 (milliseconds) */
function parseTimestamp(ts) {
  if (typeof ts === "number") return ts;
  if (!ts) return 0;
  const m = String(ts).match(/(\d+):(\d+):(\d+)[.,](\d+)/);
  if (!m) return 0;
  return (+m[1]) * 3600000 + (+m[2]) * 60000 + (+m[3]) * 1000 + (+m[4] || 0);
}

/**
 * Read whisper.cpp's JSON. Two shapes exist:
 *   -oj    { "transcription": [ { offsets, timestamps, text } ] }
 *   -ojf   { "result": { "transcription": [ { …, tokens: [ { offsets, text } ] } ] } }
 * Tokens give real word timings; without them the words are estimated by
 * spreading the text across the segment — flagged as estimated, never as real.
 */
function parseWhisperJson(doc) {
  const list = Array.isArray(doc)
    ? doc
    : doc?.transcription || doc?.result?.transcription || [];
  const segments = [];
  const words = [];
  let estimated = false;

  for (const seg of list) {
    const from = Number(seg?.offsets?.from ?? parseTimestamp(seg?.timestamps?.from)) || 0;
    const to = Number(seg?.offsets?.to ?? parseTimestamp(seg?.timestamps?.to)) || from;
    const text = String(seg?.text || "").trim();
    if (!text) continue;
    segments.push({ start: from / 1000, end: to / 1000, text });

    const tokens = Array.isArray(seg?.tokens) ? seg.tokens : [];
    const real = [];
    for (const t of tokens) {
      const tt = String(t?.text ?? "");
      if (!tt.trim()) continue;
      if (/^\s*\[.+\]\s*$/.test(tt)) continue; // [BLANK_AUDIO], [_BEG_], …
      real.push({
        start: (Number(t?.offsets?.from) || 0) / 1000,
        end: (Number(t?.offsets?.to) || 0) / 1000,
        text: tt.trim(),
      });
    }
    if (real.length) {
      words.push(...real);
      continue;
    }
    // No token timings: estimate so downstream features still have words.
    estimated = true;
    const parts = text.split(/\s+/).filter(Boolean);
    if (!parts.length) continue;
    const span = Math.max(0.001, (to - from) / 1000);
    const total = parts.reduce((n, p) => n + p.length + 1, 0);
    let acc = 0;
    for (const p of parts) {
      const w = (p.length + 1) / total;
      words.push({ start: from / 1000 + acc * span, end: from / 1000 + (acc + w) * span, text: p });
      acc += w;
    }
  }
  return { segments, words, wordsEstimated: estimated };
}

async function transcribeFile(input, tools, { language } = {}) {
  if (!tools.whisper || !tools.whisperModel) {
    return {
      ok: false,
      code: "no-whisper",
      error: tools.whisper
        ? "A whisper model file was not found, so speech cannot be transcribed."
        : "whisper was not found, so speech cannot be transcribed.",
      missing: tools.missing,
    };
  }
  if (!tools.ffmpeg) {
    return {
      ok: false,
      code: "no-ffmpeg",
      error: "ffmpeg was not found; whisper needs a 16 kHz WAV extracted first.",
      missing: tools.missing,
    };
  }
  if (!input || !fs.existsSync(input)) {
    return { ok: false, code: "no-file", error: `File not found: ${input || "(no path)"}` };
  }

  const dir = ensureDir(path.join(cacheDir(), "asr"));
  const stem = path.basename(input, path.extname(input)).replace(/[^\w.-]+/g, "_") || "clip";
  const wav = path.join(dir, `${stem}.16k.wav`);

  // whisper.cpp needs 16 kHz mono PCM.
  const ext = await toolCall(
    tools.ffmpeg,
    ["-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav],
    { timeout: 600000 }
  );
  if (!ext.ok || !fs.existsSync(wav)) {
    return {
      ok: false,
      code: "audio-extract-failed",
      error: (ext.stderr || "").trim().split("\n").slice(-3).join(" ") || "could not extract audio",
    };
  }

  const attempts = [];
  const variants = [
    { id: "json-full", flag: "-ojf", base: path.join(dir, `${stem}.full`) },
    { id: "json", flag: "-oj", base: path.join(dir, `${stem}.plain`) },
  ];
  let parsed = null;
  let used = null;

  for (const v of variants) {
    const args = [
      "-m", tools.whisperModel,
      "-f", wav,
      v.flag,
      "-of", v.base,
      "-np",
    ];
    if (language) args.push("-l", String(language));
    const res = await toolCall(tools.whisper, args, { timeout: 1800000 });
    const jsonFile = `${v.base}.json`;
    const note = (res.stderr || "").trim().split("\n").slice(-3).join(" ");
    if (!res.ok) {
      attempts.push({ id: v.id, ok: false, note });
      continue;
    }
    if (!fs.existsSync(jsonFile)) {
      attempts.push({ id: v.id, ok: false, note: note || "no JSON written" });
      continue;
    }
    try {
      const doc = JSON.parse(fs.readFileSync(jsonFile, "utf-8"));
      parsed = parseWhisperJson(doc);
      used = v.id;
      attempts.push({ id: v.id, ok: true, note: `${parsed.segments.length} segments` });
      break;
    } catch (e) {
      attempts.push({ id: v.id, ok: false, note: "unreadable JSON: " + String(e?.message || e) });
    }
  }

  try { fs.unlinkSync(wav); } catch { /* best effort */ }

  if (!parsed) {
    return {
      ok: false,
      code: "whisper-failed",
      error: "whisper did not produce a transcript.",
      attempts,
    };
  }
  return {
    ok: true,
    segments: parsed.segments,
    words: parsed.words,
    wordsEstimated: parsed.wordsEstimated,
    format: used,
    model: path.basename(tools.whisperModel),
    attempts,
  };
}

/* ------------------------------------------------------------------ *
 * Operations
 * ------------------------------------------------------------------ */

const OPS = {
  /** Is the sidecar alive, and what can it actually do? */
  async ping(_params, _tools) {
    const tools = discover();
    return {
      ok: true,
      pid: process.pid,
      tools,
      canTranscode: tools.canTranscode,
      canProbe: tools.canProbe,
      canTranscribe: tools.canTranscribe,
      missing: tools.missing,
    };
  },

  /** Read a file's streams, duration and codecs. */
  async analyze(params, tools) {
    const file = resolveInput(params);
    const res = await analyzeFile(file, tools);
    if (!res.ok) return res;
    // Report the real path the tool read, so the caller can address it later.
    return { ...res, path: file };
  },

  /** Convert a file the browser cannot play, cheapest rung first. */
  async convert(params, tools) {
    const file = resolveInput(params);
    const probe = await analyzeFile(file, tools);
    if (!probe.ok) return probe;
    const rungs = planLadder(probe);
    return convertFile(file, tools, { rungs, outDir: params.outDir });
  },

  /** Pull one frame out of a video for the media bin. */
  async poster(params, tools) {
    const file = resolveInput(params);
    return posterFrame(file, tools, { at: Number(params.at) || 1, outDir: params.outDir });
  },

  /** Transcribe speech with real word timings. */
  async transcribe(params, tools) {
    const file = resolveInput(params);
    return transcribeFile(file, tools, { language: params.language });
  },

  /**
   * The full import path: inspect the file, convert it if the browser cannot
   * play it, and grab a poster frame. Returns the best playable file.
   */
  async ingest(params, tools) {
    const file = resolveInput(params);
    const probe = await analyzeFile(file, tools);
    if (!probe.ok) return probe;

    const result = { ok: true, source: file, probe };
    if (probe.hasVideo) {
      const poster = await posterFrame(file, tools, { at: Number(params.at) || 1 });
      result.poster = poster.ok ? poster : null;
    }

    if (probe.browserSafe) {
      result.converted = null;
      result.playable = file;
      return result;
    }
    if (!tools.ffmpeg) {
      result.converted = null;
      result.playable = file;
      result.reason = `The browser cannot decode this file (${probe.unsafeReason}) and ffmpeg is not available to convert it.`;
      return result;
    }
    const conv = await convertFile(file, tools, { rungs: planLadder(probe) });
    result.converted = conv.ok
      ? { path: conv.path, rung: conv.rung, browserSafe: conv.browserSafe }
      : { ok: false, error: conv.error, attempts: conv.attempts };
    result.playable = conv.ok && conv.browserSafe ? conv.path : file;
    result.reason = conv.ok && conv.browserSafe ? "" : "Could not produce a browser-playable copy.";
    return result;
  },
};

/** Handle one request. Always resolves — failures come back as data. */
async function handle(request) {
  const id = request?.id;
  const op = String(request?.op || "");
  try {
    const fn = OPS[op];
    if (!fn) {
      return { id, ok: false, error: { code: "unknown-op", message: `Unknown operation: ${op}` } };
    }
    const tools = toolSet();
    const result = await fn(request?.params || {}, tools);
    if (result && result.ok === false) {
      return { id, ok: false, error: { code: result.code || "failed", message: result.error || "failed", ...result } };
    }
    return { id, ok: true, result };
  } catch (err) {
    return {
      id,
      ok: false,
      error: { code: "exception", message: String(err?.message || err) },
    };
  }
}

/* ------------------------------------------------------------------ *
 * Transport
 * ------------------------------------------------------------------ */

function startParentPortTransport() {
  const port = process.parentPort;
  if (!port) return false;
  port.on("message", (event) => {
    const request = event?.data ?? event;
    handle(request).then((res) => {
      try { port.postMessage(res); } catch { /* main went away */ }
    });
  });
  return true;
}

function startStdioTransport() {
  let buffer = "";
  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", (chunk) => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      let request;
      try {
        request = JSON.parse(line);
      } catch {
        process.stdout.write(JSON.stringify({ ok: false, error: { code: "bad-json", message: "Could not parse request" } }) + "\n");
        continue;
      }
      handle(request).then((res) => {
        process.stdout.write(JSON.stringify(res) + "\n");
      });
    }
  });
  process.stdin.on("end", () => process.exit(0));
  return true;
}

// An Electron UtilityProcess gets a message port; a plain Node child gets
// newline-delimited JSON on stdin/stdout. Both are supported so the worker
// can be exercised without a desktop.
if (process.parentPort) {
  startParentPortTransport();
} else if (require.main === module) {
  startStdioTransport();
}

module.exports = { handle, discover, parseWhisperJson, normaliseProbe, planLadder, OPS };
