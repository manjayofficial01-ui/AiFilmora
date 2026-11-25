/* electron/sidecar/index.cjs — the main-process manager for the media sidecar.
 *
 * The renderer cannot run ffmpeg, so the main process owns a worker that can.
 * This module is the bridge:
 *
 *   renderer  --ipc-->  main (this file)  --port-->  worker (media-service.cjs)
 *
 * It also owns the on-disk cache. Anything the renderer wants to play back
 * (a converted proxy, a poster frame) has to be handed over as a URL the
 * renderer is allowed to load, so files are registered here and served over
 * the `media://` scheme.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

const { discover } = require("./tools.cjs");

const SERVICE = path.join(__dirname, "media-service.cjs");

/* Operation timeouts. Probing is quick; a transcode is not. */
const DEFAULT_TIMEOUT = 120000;
const LONG_TIMEOUT = 1800000;

const state = {
  child: null,
  kind: "",              // "utility" | "child"
  seq: 0,
  pending: new Map(),
  started: false,
  startError: "",
  tokens: new Map(),     // token -> absolute path
  tokenSeq: 0,
  root: "",
};

/** The cache root. The Electron app passes its userData path; tests use temp. */
function cacheRoot() {
  if (!state.root) {
    state.root = path.join(os.tmpdir(), "aifilmora-media");
  }
  return state.root;
}

function setCacheRoot(dir) {
  state.root = dir || path.join(os.tmpdir(), "aifilmora-media");
  return state.root;
}

/* ------------------------------------------------------------------ *
 * Worker lifecycle
 * ------------------------------------------------------------------ */

/** Electron's utilityProcess, when we are running inside Electron. */
function utilityProcessApi() {
  try {
    // Only resolvable in the Electron main process.
    const electron = require("electron");
    return electron?.utilityProcess || null;
  } catch {
    return null;
  }
}

function start() {
  if (state.child) return state.child;
  if (state.startError) throw new Error(state.startError);

  const root = cacheRoot();
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.mkdirSync(path.join(root, "work"), { recursive: true });

  const env = {
    ...process.env,
    AIFIMORA_SIDECAR_CACHE: path.join(root, "work"),
  };

  const utility = utilityProcessApi();
  if (utility && typeof utility.fork === "function" && !state.fellBack) {
    try {
      const child = utility.fork(SERVICE, [], {
        stdio: "pipe",
        serviceName: "aifilmora-media",
        env,
        cwd: root,
      });
      child.on("message", (msg) => onMessage(msg));
      child.on("exit", (code) => onExit(`utility process exited (${code})`));
      state.child = child;
      state.kind = "utility";
      state.started = true;
      return child;
    } catch (err) {
      // Fall through to the plain Node child.
      state.fellBack = true;
      state.startError = String(err?.message || err);
    }
  }

  // Plain Node child: newline-delimited JSON over stdio. (spawn, not fork —
  // fork insists on an IPC channel this transport does not use.)
  const child = spawn(process.execPath, [SERVICE], {
    stdio: ["pipe", "pipe", "pipe"],
    env,
    cwd: root,
  });
  let buffer = "";
  child.stdout.setEncoding("utf-8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let idx;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      try { onMessage(JSON.parse(line)); } catch { /* ignore a bad line */ }
    }
  });
  child.on("exit", (code) => onExit(`sidecar exited (${code})`));
  state.child = child;
  state.kind = "child";
  state.started = true;
  return child;
}

function onExit(reason) {
  const wasUtility = state.kind === "utility";
  state.child = null;
  state.started = false;
  state.startError = reason || "sidecar stopped";
  for (const [, entry] of state.pending) {
    clearTimeout(entry.timer);
    entry.resolve({ ok: false, code: "sidecar-exited", error: reason });
  }
  state.pending.clear();

  // A utility process that dies immediately usually means it could not run
  // this script. The plain Node child speaks the same protocol, so try it
  // before giving up — but never during shutdown.
  if (wasUtility && !state.fellBack && !state.stopping) {
    state.fellBack = true;
    state.startError = "";
    try {
      start();
      return;
    } catch {
      /* fall through to the failure below */
    }
  }
}

function send(payload) {
  const child = state.child;
  if (!child) throw new Error("sidecar is not running");
  if (state.kind === "utility") {
    child.postMessage(payload);
  } else {
    child.stdin.write(JSON.stringify(payload) + "\n");
  }
}

function onMessage(msg) {
  if (!msg || typeof msg !== "object") return;
  const entry = state.pending.get(String(msg.id));
  if (!entry) return;
  state.pending.delete(String(msg.id));
  clearTimeout(entry.timer);
  if (msg.ok) {
    entry.resolve(msg.result);
    return;
  }
  // Failures travel as data, never as an exception: the renderer needs to
  // show "ffmpeg is missing", not a stack trace.
  const err = msg.error || {};
  entry.resolve({
    ok: false,
    code: err.code || "failed",
    error: err.message || "sidecar operation failed",
    ...err,
  });
}

/**
 * Run one sidecar operation.
 * @param {string} op      ping | analyze | convert | poster | transcribe | ingest
 * @param {object} params
 * @param {object} opts    { timeout }
 */
async function call(op, params = {}, { timeout } = {}) {
  const limit = timeout || (op === "convert" || op === "transcribe" ? LONG_TIMEOUT : DEFAULT_TIMEOUT);
  let child;
  try {
    child = start();
  } catch (err) {
    return { ok: false, code: "sidecar-unavailable", error: String(err?.message || err) };
  }
  if (!child) {
    return { ok: false, code: "sidecar-unavailable", error: "sidecar is not running" };
  }

  const id = String(++state.seq);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      state.pending.delete(id);
      resolve({
        ok: false,
        code: "timeout",
        error: `The ${op} operation did not finish within ${Math.round(limit / 1000)}s.`,
      });
    }, limit);
    state.pending.set(id, { resolve, timer });
    try {
      send({ id, op, params });
    } catch (err) {
      clearTimeout(timer);
      state.pending.delete(id);
      resolve({ ok: false, code: "send-failed", error: String(err?.message || err) });
    }
  });
}

/* ------------------------------------------------------------------ *
 * File registry — the renderer can only load what we hand it
 * ------------------------------------------------------------------ */

/** Register a file and return the token that addresses it. */
function registerFile(absPath) {
  if (!absPath || !fs.existsSync(absPath)) return "";
  const key = path.resolve(absPath);
  for (const [token, p] of state.tokens) {
    if (p === key) return token;
  }
  const token = `f${++state.tokenSeq}_${crypto.createHash("sha1").update(key).digest("hex").slice(0, 10)}`;
  state.tokens.set(token, key);
  return token;
}

function resolveToken(token) {
  return state.tokens.get(String(token || "")) || "";
}

/** Write incoming bytes into the cache and return the absolute path. */
function materialise(bytes, name) {
  const ext = path.extname(String(name || "")).toLowerCase() || ".bin";
  const dir = path.join(cacheRoot(), "src");
  fs.mkdirSync(dir, { recursive: true });
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(String(bytes || ""), "base64");
  const hash = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 16);
  const file = path.join(dir, `${hash}${ext}`);
  fs.writeFileSync(file, buf);
  return file;
}

/* ------------------------------------------------------------------ *
 * Public surface
 * ------------------------------------------------------------------ */

/** What the app is allowed to promise, right now. */
async function capabilities() {
  const tools = discover();
  const ping = await call("ping", {}, { timeout: 15000 });
  if (ping?.ok) {
    return {
      available: true,
      worker: state.kind,
      started: state.started,
      tools: ping.tools || tools,
      canTranscode: !!(ping.tools || tools).canTranscode,
      canProbe: !!(ping.tools || tools).canProbe,
      canTranscribe: !!(ping.tools || tools).canTranscribe,
      missing: (ping.tools || tools).missing || [],
      reason: "",
    };
  }
  return {
    available: false,
    worker: state.kind,
    started: state.started,
    tools,
    canTranscode: !!tools.canTranscode,
    canProbe: !!tools.canProbe,
    canTranscribe: !!tools.canTranscribe,
    missing: tools.missing,
    reason: ping?.error || state.startError || "The media sidecar could not be started.",
  };
}

/**
 * The import path the renderer uses: it sends the file bytes, and gets back
 * everything the app knows about the file.
 */
async function ingest({ bytes, name, path: srcPath, at } = {}) {
  let file = srcPath ? String(srcPath) : "";
  if (!file && bytes) file = materialise(bytes, name);
  if (!file) {
    return { ok: false, code: "no-file", error: "No file was supplied." };
  }
  const res = await call("ingest", { path: file, at: Number(at) || 1 });
  if (!res?.ok) return res;
  const out = { ...res, playableToken: "", posterToken: "", playablePath: "", posterPath: "" };
  if (res.playable) {
    out.playablePath = res.playable;
    out.playableToken = registerFile(res.playable);
  }
  if (res.poster?.path) {
    out.posterPath = res.poster.path;
    out.posterToken = registerFile(res.poster.path);
  }
  return out;
}

async function analyze(params) {
  let file = params?.path ? String(params.path) : "";
  if (!file && params?.bytes) file = materialise(params.bytes, params.name);
  return call("analyze", { path: file });
}

async function convert(params) {
  let file = params?.path ? String(params.path) : "";
  if (!file && params?.bytes) file = materialise(params.bytes, params.name);
  const res = await call("convert", { path: file });
  if (res?.ok && res.path) res.token = registerFile(res.path);
  return res;
}

async function poster(params) {
  let file = params?.path ? String(params.path) : "";
  if (!file && params?.bytes) file = materialise(params.bytes, params.name);
  const res = await call("poster", { path: file, at: Number(params?.at) || 1 });
  if (res?.ok && res.path) res.token = registerFile(res.path);
  return res;
}

async function transcribe(params) {
  let file = params?.path ? String(params.path) : "";
  if (!file && params?.bytes) file = materialise(params.bytes, params.name);
  return call("transcribe", { path: file, language: params?.language || "" });
}

function stop() {
  state.stopping = true;
  try { state.child?.kill?.(); } catch { /* already gone */ }
  state.child = null;
  state.started = false;
  state.pending.clear();
}

module.exports = {
  start,
  stop,
  call,
  capabilities,
  ingest,
  analyze,
  convert,
  poster,
  transcribe,
  registerFile,
  resolveToken,
  materialise,
  setCacheRoot,
  cacheRoot,
};
