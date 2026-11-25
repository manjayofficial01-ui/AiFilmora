/* electron/sidecar/tools.cjs — where the media tools live.
 *
 * AiFilmora needs three external programs, none of which ship with Node:
 *
 *   ffmpeg   — transcode footage the browser cannot decode (MXF, MKV, AVI…)
 *   ffprobe  — read a file's streams, duration and codecs
 *   whisper  — transcribe speech into word-level timings
 *
 * This module only DISCOVERS them. It never installs anything and never
 * assumes they exist: when a tool is missing the sidecar says so, and the
 * app reports that plainly instead of pretending the work was done.
 *
 * Search order, first hit wins:
 *   1. an explicit environment variable (AIFIMORA_FFMPEG, …)
 *   2. a copy bundled with the app (bin/ next to the executable)
 *   3. the npm statics (ffmpeg-static, ffprobe-static)
 *   4. PATH
 *   5. the usual hand-installed locations
 */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const isWin = process.platform === "win32";
const EXE = isWin ? ".exe" : "";

/** Directories that sit beside the app executable (packaged and dev). */
function appBinDirs() {
  const dirs = [];
  const roots = [
    process.resourcesPath,                                  // packaged
    path.join(__dirname, "..", ".."),                       // dev: project root
    path.join(__dirname, "..", "..", "bin"),                // dev: project bin
  ];
  for (const r of roots) {
    if (!r) continue;
    dirs.push(r);
    dirs.push(path.join(r, "bin"));
    dirs.push(path.join(r, "ffmpeg"));
    dirs.push(path.join(r, "ffmpeg", "bin"));
  }
  return dirs.filter((d, i, a) => a.indexOf(d) === i);
}

/** The usual places a person puts a hand-installed ffmpeg. */
function systemDirs() {
  if (isWin) {
    const local = process.env.LOCALAPPDATA || "";
    const programFiles = process.env.ProgramFiles || "C:\\Program Files";
    const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
    return [
      "C:\\ffmpeg\\bin",
      "C:\\Program Files\\ffmpeg\\bin",
      path.join(programFiles, "ffmpeg\\bin"),
      path.join(programFilesX86, "ffmpeg\\bin"),
      local ? path.join(local, "Microsoft\\WinGet\\Links") : null,
      local ? path.join(local, "Programs\\ffmpeg\\bin") : null,
      "C:\\ProgramData\\chocolatey\\bin",
      "C:\\ProgramData\\scoop\\shims",
      path.join(process.env.USERPROFILE || "", "scoop\\shims"),
    ].filter(Boolean);
  }
  if (process.platform === "darwin") {
    return [
      "/opt/homebrew/bin",
      "/usr/local/bin",
      "/usr/bin",
      "/opt/local/bin",
      "/Applications/ffmpeg/bin",
    ];
  }
  return ["/usr/bin", "/usr/local/bin", "/opt/local/bin", "/snap/bin"];
}

/** Ask the OS where a program lives. Returns "" when it is not on PATH. */
function onPath(name) {
  try {
    if (isWin) {
      const out = execFileSync("where.exe", [name], { encoding: "utf8", timeout: 4000, stdio: ["ignore", "pipe", "ignore"] });
      const first = String(out).split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0];
      return first || "";
    }
    const out = execFileSync("which", [name], { encoding: "utf8", timeout: 4000, stdio: ["ignore", "pipe", "ignore"] });
    return String(out).split(/\r?\n/).map((s) => s.trim()).filter(Boolean)[0] || "";
  } catch {
    return "";
  }
}

function usable(file) {
  try {
    if (!file) return false;
    const st = fs.statSync(file);
    if (!st.isFile()) return false;
    fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * A tool may be a Node script rather than a native program — handy for a
 * wrapper, and it is how the test suite substitutes a stand-in for ffmpeg
 * without installing one. Such a file is run as `node <script> <args>`.
 */
function isNodeScript(file) {
  return /\.(js|cjs|mjs)$/i.test(String(file || ""));
}

/** How to launch a discovered tool. */
function runnerFor(file) {
  return isNodeScript(file) ? "node" : "direct";
}

/**
 * Find one executable.
 * @param {string} name    the base name, e.g. "ffmpeg"
 * @param {object} opts    { envVar, extraFiles }
 * @returns {{ path: string, source: string, runner: string } | null}
 */
function findExecutable(name, { envVar, extraFiles = [] } = {}) {
  // 1. explicit override
  const env = envVar ? process.env[envVar] : "";
  if (env && usable(env)) return { path: env, source: `env:${envVar}`, runner: runnerFor(env) };

  const fileNames = isWin ? [`${name}.exe`, `${name}.cmd`, `${name}.bat`] : [name];

  // 2. bundled with the app
  for (const dir of appBinDirs()) {
    for (const f of fileNames) {
      const p = path.join(dir, f);
      if (usable(p)) return { path: p, source: "bundled", runner: runnerFor(p) };
    }
  }

  // 3. explicit extra candidates (npm statics etc.)
  for (const p of extraFiles) {
    if (usable(p)) return { path: p, source: "dependency", runner: runnerFor(p) };
  }

  // 4. PATH
  const onPathHit = onPath(name);
  if (onPathHit && usable(onPathHit)) return { path: onPathHit, source: "path", runner: runnerFor(onPathHit) };

  // 5. hand-installed locations
  for (const dir of systemDirs()) {
    for (const f of fileNames) {
      const p = path.join(dir, f);
      if (usable(p)) return { path: p, source: "system", runner: runnerFor(p) };
    }
  }
  return null;
}

/** npm static binaries, when the project has them. */
function staticCandidates(pkg, rel) {
  const out = [];
  try {
    const p = require.resolve(pkg, { paths: [path.join(__dirname, "..", "..")] });
    out.push(p);
  } catch {
    /* not installed — fine */
  }
  const root = path.join(__dirname, "..", "..", "node_modules", pkg);
  out.push(path.join(root, rel));
  out.push(path.join(root, "bin", "win32", "x64", `${path.basename(rel, EXE)}${EXE}`));
  return out;
}

/** A whisper model file, which the binary needs before it can run. */
function findWhisperModel() {
  const explicit = process.env.AIFIMORA_WHISPER_MODEL;
  if (explicit && fs.existsSync(explicit)) return explicit;
  for (const dir of appBinDirs()) {
    for (const f of ["models", "whisper", ""]) {
      const d = f ? path.join(dir, f) : dir;
      try {
        const hit = fs
          .readdirSync(d)
          .filter((n) => /^ggml.*\.bin$/i.test(n))
          .sort((a, b) => b.length - a.length)[0];
        if (hit) return path.join(d, hit);
      } catch {
        /* not here */
      }
    }
  }
  return "";
}

/**
 * Everything the sidecar could use, plus an honest statement about what it
 * cannot do.
 */
function discover() {
  const ffmpeg = findExecutable("ffmpeg", {
    envVar: "AIFIMORA_FFMPEG",
    extraFiles: staticCandidates("ffmpeg-static", path.join("ffmpeg", `ffmpeg${EXE}`)),
  });
  const ffprobe = findExecutable("ffprobe", {
    envVar: "AIFIMORA_FFPROBE",
    extraFiles: staticCandidates("ffprobe-static", path.join("bin", "win32", "x64", `ffprobe${EXE}`)),
  });
  // whisper.cpp ships its binary as whisper-cli (older builds call it main).
  const whisper = findExecutable("whisper-cli", {
    envVar: "AIFIMORA_WHISPER",
    extraFiles: [
      ...staticCandidates("whisper-node", `whisper-cli${EXE}`),
      ...appBinDirs().map((d) => path.join(d, `whisper${EXE}`)),
    ],
  }) || findExecutable("whisper", { envVar: "AIFIMORA_WHISPER" });
  const whisperModel = findWhisperModel();

  const missing = [];
  if (!ffmpeg) missing.push("ffmpeg");
  if (!ffprobe) missing.push("ffprobe");
  if (!whisper || !whisperModel) missing.push("whisper");

  return {
    ffmpeg: ffmpeg?.path || "",
    ffmpegSource: ffmpeg?.source || "",
    ffmpegRunner: ffmpeg?.runner || "",
    ffprobe: ffprobe?.path || "",
    ffprobeSource: ffprobe?.source || "",
    ffprobeRunner: ffprobe?.runner || "",
    whisper: whisper?.path || "",
    whisperSource: whisper?.source || "",
    whisperRunner: whisper?.runner || "",
    whisperModel,
    // What the app may promise, and what it must refuse to promise.
    canTranscode: !!ffmpeg,
    canProbe: !!ffprobe,
    canTranscribe: !!whisper && !!whisperModel,
    missing,
    searched: {
      appBin: appBinDirs().slice(0, 4),
      system: systemDirs().slice(0, 6),
      envVars: ["AIFIMORA_FFMPEG", "AIFIMORA_FFPROBE", "AIFIMORA_WHISPER", "AIFIMORA_WHISPER_MODEL"],
    },
  };
}

module.exports = { discover, findExecutable, usable, isNodeScript, runnerFor };
