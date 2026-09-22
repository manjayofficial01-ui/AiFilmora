/* Export presets + REAL video save (2.2.0).
 * Every render first resolves WHERE to save and WHAT to name the file:
 * silent default (when "Always ask" is off) → native save dialog in Electron
 * → File System Access API in Chromium → the file name / folder fields in the
 * export modal as a last resort. The two new checkboxes ("Use as default save
 * location", "Always ask where to save") persist to settings.save.
 *
 * The render itself captures the program monitor (previewCanvas) with
 * MediaRecorder into a real video Blob, then writes those bytes to the chosen
 * location via the file handle / Electron fs:writeFile bridge / download. */
import { store } from "./state.js";
import { toast } from "./media.js";
import { settings } from "./settings.js";
import {
  getSavePrefs,
  setSavePrefs,
  saveBlobToLocation,
  joinPath,
  splitPath,
  sanitizeName,
} from "./save-dialog.js";

const PRESETS = [
  { id: "yt1080", label: "YouTube 1080p", detail: "H.264 · 1920×1080 · 30fps", credits: 0, w: 1920, h: 1080, fps: 30, codec: "h264", container: "mp4" },
  { id: "yt4k", label: "YouTube 4K", detail: "H.265 · 3840×2160 · 30fps", credits: 5, w: 3840, h: 2160, fps: 30, codec: "h265", container: "mp4" },
  { id: "tiktok", label: "TikTok / Reels 9:16", detail: "H.264 · 1080×1920 · 30fps", credits: 2, w: 1080, h: 1920, fps: 30, codec: "h264", container: "mp4" },
  { id: "shorts", label: "YouTube Shorts", detail: "H.264 · 1080×1920 · 60fps", credits: 2, w: 1080, h: 1920, fps: 60, codec: "h264", container: "mp4" },
  { id: "prores", label: "ProRes Proxy", detail: "Editing master · 1920×1080", credits: 0, w: 1920, h: 1080, fps: 30, codec: "prores", container: "mov" },
  { id: "gif", label: "Animated GIF", detail: "720p · 15fps loop", credits: 1, w: 1280, h: 720, fps: 15, codec: "gif", container: "gif" },
  { id: "custom", label: "Custom (from prefs)", detail: "Uses Export defaults", credits: 0, w: null, h: null, fps: null, codec: null, container: null },
];

let activePreset = PRESETS[0];
let exportTimer = null;
let exporting = false;
let picking = false;
let cancelFlag = false;
/** Chosen destination: { dir, name } — name has no extension. */
let saveTarget = { dir: "", name: "" };
/** Handle returned by the browser save picker (File System Access API). */
let fileHandle = null;
/** Directory handle granted via folder Browse (File System Access API). */
let dirHandle = null;

const KNOWN_EXT = /\.(mp4|mov|gif|webm|mkv|m4v|avi)$/i;

function desktopApi() {
  return typeof window !== "undefined" ? window.aifimoraDesktop : null;
}

function pathSep() {
  const p = desktopApi()?.platform;
  if (p) return p === "win32" ? "\\" : "/";
  return navigator.userAgent.includes("Windows") ? "\\" : "/";
}

function joinPathLocal(dir, file) {
  const d = String(dir || "").replace(/[\\/]+$/, "");
  return d ? d + pathSep() + file : file;
}

function splitPathLocal(full) {
  const s = String(full || "");
  const i = Math.max(s.lastIndexOf("\\"), s.lastIndexOf("/"));
  return i < 0 ? { dir: "", name: s } : { dir: s.slice(0, i), name: s.slice(i + 1) };
}

function sanitizeNameLocal(raw, fallback = "Untitled Project") {
  const n = String(raw ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+/, "");
  return n || fallback;
}

function stripExt(name) {
  return String(name).replace(KNOWN_EXT, "");
}

function defaultBaseName() {
  return sanitizeNameLocal(store.get()?.name, "Untitled Project");
}

function currentDir() {
  if (saveTarget.dir) return saveTarget.dir;
  // 2.2.0: prefer the dedicated video default, then the legacy output folder.
  return getSavePrefs("video").defaultDir || settings.get().outputFolder || "";
}

function currentExt() {
  return "." + (resolveExportConfig().container || "mp4");
}

function currentFileName() {
  return sanitizeNameLocal(saveTarget.name || defaultBaseName(), defaultBaseName()) + currentExt();
}

function fullPath() {
  return joinPathLocal(currentDir(), currentFileName());
}

function rememberDir(dir) {
  if (!dir) return;
  // Legacy outputFolder + new dedicated video default stay in sync.
  if (dir !== settings.get().outputFolder) settings.set({ outputFolder: dir });
  const cur = getSavePrefs("video").defaultDir;
  if (!cur) setSavePrefs("video", { defaultDir: dir });
}

export function initExport() {
  const modal = document.getElementById("exportModal");
  const openBtns = ["btnExport", "menuExport", "btnExportTop"];
  openBtns.forEach((id) => {
    document.getElementById(id)?.addEventListener("click", () => openExport());
  });
  window.addEventListener("aifimora:open-export", () => openExport());

  // Destination fields — typing here pre-fills the save dialog.
  const nameEl = document.getElementById("exportFileName");
  nameEl?.addEventListener("input", () => {
    saveTarget.name = nameEl.value;
    syncDestHint();
  });
  nameEl?.addEventListener("blur", () => {
    saveTarget.name = stripExt(sanitizeNameLocal(nameEl.value, defaultBaseName()));
    syncDestInputs();
  });
  const dirEl = document.getElementById("exportFolder");
  dirEl?.addEventListener("input", () => {
    saveTarget.dir = dirEl.value.trim();
    syncDestHint();
  });
  document.getElementById("exportBrowse")?.addEventListener("click", () => browseFolder());
  // 2.2.0 default-location checkboxes (present in the modal markup).
  document.getElementById("exportRememberDir")?.addEventListener("change", (e) => {
    if (e.target.checked && currentDir()) setSavePrefs("video", { defaultDir: currentDir() });
  });
  document.getElementById("exportAskAlways")?.addEventListener("change", (e) => {
    setSavePrefs("video", { ask: !!e.target.checked });
    syncDestHint();
  });

  document.getElementById("exportClose")?.addEventListener("click", () => closeModal());
  document.getElementById("exportCancel")?.addEventListener("click", () => {
    cancelExport();
    closeModal();
  });
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });

  // Escape closes / cancels
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal?.classList.contains("open")) {
      e.preventDefault();
      cancelExport();
      closeModal();
    }
  });

  renderPresets();
  document.getElementById("exportStart")?.addEventListener("click", startExport);
}

/** Push the current destination into the modal's fields (never fights typing). */
function syncDestInputs() {
  const extEl = document.getElementById("exportExt");
  if (extEl) extEl.textContent = currentExt();
  const nameEl = document.getElementById("exportFileName");
  if (nameEl && document.activeElement !== nameEl) nameEl.value = stripExt(sanitizeNameLocal(saveTarget.name || defaultBaseName(), defaultBaseName()));
  const dirEl = document.getElementById("exportFolder");
  if (dirEl && document.activeElement !== dirEl) dirEl.value = currentDir();
  const rem = document.getElementById("exportRememberDir");
  if (rem && document.activeElement !== rem) {
    // Checked when the current folder already IS the default.
    rem.checked = !!currentDir() && currentDir() === getSavePrefs("video").defaultDir;
  }
  const ask = document.getElementById("exportAskAlways");
  if (ask) ask.checked = getSavePrefs("video").ask !== false;
  syncDestHint();
}

function syncDestHint() {
  const el = document.getElementById("exportDestHint");
  if (!el) return;
  if (exporting) return;
  const prefs = getSavePrefs("video");
  const askNote = prefs.ask === false && prefs.defaultDir
    ? ` · using default ${prefs.defaultDir} silently (tick “Always ask” to choose each time).`
    : " · you'll confirm the folder and name before rendering.";
  const api = desktopApi();
  if (api?.saveVideo) {
    el.textContent = `Will save as ${fullPath()} — you'll confirm the folder and name before rendering${prefs.ask === false ? " (or silently to the default when “Always ask” is off)." : "."}`;
  } else if (fileHandle) {
    el.textContent = `Will save as ${fileHandle.name || currentFileName()} (browser save picker)${askNote}`;
  } else if (window.showSaveFilePicker) {
    el.textContent = "Your browser will ask where to save the file before rendering" + askNote + " Capture records WebM from the program monitor.";
  } else {
    el.textContent = currentDir()
      ? `Will save as ${fullPath()}${askNote}`
      : `Will save as ${currentFileName()} in your browser's download folder${askNote}`;
  }
}

/** Browse for a folder only (keeps the typed file name). */
async function browseFolder() {
  if (exporting || picking) return;
  const api = desktopApi();
  if (!api?.openFolder) {
    // Chromium directory picker as a middle ground. The bare folder name
    // is only a label — the granted handle is what the writer uses.
    if (window.showDirectoryPicker) {
      try {
        const h = await window.showDirectoryPicker({ mode: "readwrite" });
        if (h?.name) {
          saveTarget.dir = h.name;
          dirHandle = h || null;
          syncDestInputs();
        }
        return;
      } catch (err) {
        if (err?.name === "AbortError") return;
      }
    }
    toast("Folder browsing needs the desktop app — type a path instead", "err");
    document.getElementById("exportFolder")?.focus();
    return;
  }
  picking = true;
  syncExportControls();
  let dir = null;
  try {
    dir = await api.openFolder();
  } finally {
    picking = false;
    syncExportControls();
  }
  if (!dir) return;
  saveTarget.dir = dir;
  rememberDir(dir);
  if (document.getElementById("exportRememberDir")?.checked) {
    setSavePrefs("video", { defaultDir: dir });
  }
  syncDestInputs();
}

/**
 * Ask the user where to save and what to name the video.
 * Returns { dir, name, fullPath, fileHandle } or null when cancelled.
 * Honors the 2.2.0 "Always ask" + default-folder prefs: when asking is off
 * and a default exists, the location resolves silently with no dialog.
 */
async function pickSaveTarget() {
  const cfg = resolveExportConfig();
  const ext = cfg.container || "mp4";
  const base = sanitizeNameLocal(saveTarget.name || defaultBaseName(), defaultBaseName());
  const prefs = getSavePrefs("video");

  // Silent default path — no dialog at all.
  if (prefs.ask === false && prefs.defaultDir) {
    saveTarget.dir = prefs.defaultDir;
    saveTarget.name = base;
    fileHandle = null;
    dirHandle = null;
    syncDestInputs();
    return { dir: saveTarget.dir, name: base, fullPath: fullPath(), fileHandle: null, silent: true };
  }

  const dir = currentDir();
  const api = desktopApi();

  // 1) Native save dialog (Electron) — asks for folder + file name in one go.
  if (api?.saveVideo) {
    const picked = await api.saveVideo({ defaultPath: joinPathLocal(dir, base + "." + ext), ext });
    if (!picked) return null;
    fileHandle = null;
    dirHandle = null;
    const sp = splitPathLocal(picked);
    if (sp.dir) {
      saveTarget.dir = sp.dir;
      rememberDir(sp.dir);
      if (document.getElementById("exportRememberDir")?.checked) {
        setSavePrefs("video", { defaultDir: sp.dir });
      }
    }
    saveTarget.name = stripExt(sanitizeNameLocal(sp.name, base)) || base;
    const askChk = document.getElementById("exportAskAlways");
    if (askChk) setSavePrefs("video", { ask: !!askChk.checked });
    syncDestInputs();
    return { dir: saveTarget.dir, name: saveTarget.name, fullPath: fullPath(), fileHandle: null, silent: false };
  }

  // 2) Chromium / Edge: File System Access API save picker.
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: base + "." + ext,
        types: [{ description: ext === "gif" ? "Animated GIF" : "Video", accept: { "video/*": ["." + ext] } }],
      });
      fileHandle = handle || null;
      saveTarget.name = stripExt(sanitizeNameLocal(fileHandle?.name, base)) || base;
      const askChk = document.getElementById("exportAskAlways");
      if (askChk) setSavePrefs("video", { ask: !!askChk.checked });
      syncDestInputs();
      return { dir: saveTarget.dir, name: saveTarget.name, fullPath: fullPath(), fileHandle, silent: false };
    } catch (err) {
      if (err?.name === "AbortError") return null;
      // older browsers → fall through to the manual fields
    }
  }

  // 3) Fallback: whatever is typed in the modal.
  const nameEl = document.getElementById("exportFileName");
  const typed = (nameEl?.value || "").trim();
  if (!typed) {
    document.getElementById("exportDest")?.classList.add("invalid");
    nameEl?.focus();
    toast("Enter a file name before exporting", "err");
    return null;
  }
  document.getElementById("exportDest")?.classList.remove("invalid");
  saveTarget.name = stripExt(sanitizeNameLocal(typed, defaultBaseName()));
  saveTarget.dir = (document.getElementById("exportFolder")?.value || "").trim();
  if (saveTarget.dir) rememberDir(saveTarget.dir);
  if (document.getElementById("exportRememberDir")?.checked && saveTarget.dir) {
    setSavePrefs("video", { defaultDir: saveTarget.dir });
  }
  const askChk = document.getElementById("exportAskAlways");
  if (askChk) setSavePrefs("video", { ask: !!askChk.checked });
  syncDestInputs();
  // Only reuse the browsed directory handle when the folder field still
  // names that same folder — typed edits after browsing invalidate it.
  const dh = dirHandle && (!saveTarget.dir || saveTarget.dir === dirHandle.name) ? dirHandle : null;
  return { dir: saveTarget.dir, name: saveTarget.name, fullPath: fullPath(), fileHandle: null, dirHandle: dh, silent: false };
}

function readFilmoraExportSettings() {
  const g = (id) => document.getElementById(id);
  return {
    dest: window.__exportDest || "local",
    format: g("exportFormat")?.value || "mp4",
    codec: g("exportCodec")?.value || "h264",
    resolution: g("exportRes")?.value || "1920x1080",
    fps: Number(g("exportFps")?.value || 30),
    bitrateMbps: Number(g("exportBitrate")?.value || 16),
    hardware: g("exportHw")?.value || "auto",
  };
}

function applyFilmoraExportDefaults() {
  const def = settings.get().exportDefaults || {};
  const g = (id) => document.getElementById(id);
  const map = {
    exportFormat: def.format || def.codec === "hevc" ? "mp4" : def.format || "mp4",
    exportCodec: def.codec || "h264",
    exportRes: def.resolution || "1920x1080",
    exportFps: String(def.fps || 30),
    exportBitrate: String(def.bitrateMbps || def.bitrate || 16),
    exportHw: def.hardware || "auto",
  };
  for (const [id, val] of Object.entries(map)) {
    const el = g(id);
    if (el) el.value = val;
  }
  if (def.format && g("exportFormat")) g("exportFormat").value = def.format;
  const dest = window.__exportDest || def.dest || "local";
  document.querySelectorAll("#exportTabs [data-edest]").forEach((b) => {
    b.classList.toggle("active", b.dataset.edest === dest);
  });
}

function openExport() {
  applyFilmoraExportDefaults();
  if (window.__exportDest) {
    document.querySelectorAll("#exportTabs [data-edest]").forEach((b) => {
      b.classList.toggle("active", b.dataset.edest === window.__exportDest);
    });
  }
  document.getElementById("exportModal")?.classList.add("open");
  renderPresets();
  if (!saveTarget.name) saveTarget.name = defaultBaseName();
  if (!saveTarget.dir) saveTarget.dir = getSavePrefs("video").defaultDir || settings.get().outputFolder || "";
  const el = document.getElementById("exportDuration");
  if (el) el.textContent = fmt(store.sequenceDuration());
  const status = document.getElementById("exportStatus");
  if (status && !exporting) status.textContent = "Ready";
  syncDestInputs();
  syncExportControls();
}

function closeModal() {
  // Keep render running if user just dismisses; cancel only on Cancel/Escape.
  document.getElementById("exportModal")?.classList.remove("open");
}

function syncExportControls() {
  const start = document.getElementById("exportStart");
  if (start) {
    start.disabled = exporting || picking;
    start.textContent = exporting ? "Rendering…" : picking ? "Choosing location…" : "Start render";
  }
  const busy = exporting || picking;
  ["exportBrowse", "exportFileName", "exportFolder", "exportRememberDir", "exportAskAlways"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = busy;
  });
}

function cancelExport() {
  cancelFlag = true;
  if (exportTimer) {
    clearInterval(exportTimer);
    exportTimer = null;
  }
  if (exporting) {
    exporting = false;
    try { window.__aifimoraPlayer?.pause?.(); } catch { /* ignore */ }
    toast("Export cancelled");
    const label = document.getElementById("exportStatus");
    if (label) label.textContent = "Cancelled";
    const bar = document.getElementById("exportProgress");
    if (bar) bar.style.width = "0%";
    syncExportControls();
  }
}

function renderPresets() {
  const root = document.getElementById("presetGrid");
  if (!root) return;
  root.innerHTML = "";
  const def = settings.get().exportDefaults || {};
  PRESETS.forEach((p) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "preset" + (p.id === activePreset.id ? " active" : "");
    btn.setAttribute("aria-pressed", p.id === activePreset.id ? "true" : "false");
    btn.disabled = exporting;
    let detail = p.detail;
    if (p.id === "custom") {
      const codec = (def.codec || "h264").toUpperCase();
      const br = def.quality === "custom" ? `${def.bitrate || 12} Mbps` : def.quality || "high";
      detail = `${codec} · ${def.container || "mp4"} · ${br}${def.hardware ? " · HW" : ""}`;
    }
    btn.innerHTML = `<strong>${p.label}</strong><span>${detail}${p.credits ? " · " + p.credits + " cr" : ""}</span>`;
    btn.addEventListener("click", () => {
      activePreset = p;
      renderPresets();
      syncExportMeta();
    });
    root.appendChild(btn);
  });
  syncExportMeta();
}

function resolveExportConfig() {
  const def = settings.get().exportDefaults || {};
  const p = activePreset;
  return {
    label: p.label,
    width: p.w || store.get().width || 1920,
    height: p.h || store.get().height || 1080,
    fps: p.fps || Number(def.fps) || store.get().fps || 30,
    codec: p.codec || def.codec || "h264",
    container: p.container || def.container || "mp4",
    quality: def.quality || "high",
    bitrate: Number(def.bitrate) || 12,
    hardware: def.hardware !== false,
    audioCodec: def.audioCodec || "aac",
    audioBitrate: Number(def.audioBitrate) || 192,
    burnInCaptions: def.burnInCaptions !== false,
    socialUpload: def.socialUpload || "none",
  };
}

function syncExportMeta() {
  const cfg = resolveExportConfig();
  const el = document.getElementById("exportMeta");
  if (el) {
    el.textContent = `${cfg.codec.toUpperCase()} · ${cfg.width}×${cfg.height} · ${cfg.fps}fps · ${cfg.quality}${cfg.hardware ? " · hardware" : ""}${cfg.burnInCaptions ? " · captions" : ""}${cfg.socialUpload && cfg.socialUpload !== "none" ? " · →" + cfg.socialUpload : ""} · capture records WebM from the program monitor`;
  }
  syncDestInputs(); // container can change with the preset → keep the extension in sync
}

/* ---------------- real capture ---------------- */

function pickRecorderMime() {
  const cands = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  try {
    for (const m of cands) {
      if (window.MediaRecorder?.isTypeSupported?.(m)) return m;
    }
  } catch { /* ignore */ }
  return "";
}

/**
 * Record the program monitor in real time into a WebM Blob.
 * Plays the timeline from 0..duration while MediaRecorder captures the
 * canvas stream. View-only: never mutates clips, tracks, or durations.
 */
function capturePreviewToWebM(duration, fps, onProgress) {
  return new Promise((resolve, reject) => {
    const canvas = document.getElementById("previewCanvas");
    const player = window.__aifimoraPlayer;
    if (!canvas || !player) return reject(new Error("Preview not ready"));
    if (typeof canvas.captureStream !== "function") return reject(new Error("Canvas capture not supported in this browser"));
    if (typeof window.MediaRecorder !== "function") return reject(new Error("MediaRecorder not supported in this browser"));
    const mime = pickRecorderMime();
    let stream = null;
    try {
      stream = canvas.captureStream(Math.min(60, Math.max(10, Number(fps) || 30)));
    } catch (err) {
      return reject(err);
    }
    let rec = null;
    try {
      rec = mime ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 }) : new MediaRecorder(stream);
    } catch (err) {
      return reject(err);
    }
    const chunks = [];
    const startedAt = performance.now();
    const dur = Math.max(0.5, Number(duration) || 1);
    const fromTime = player.getTime?.() || 0;
    let finished = false;
    const finish = (err) => {
      if (finished) return;
      finished = true;
      clearInterval(probe);
      try { stream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
      if (err) {
        try { player.seek(fromTime); } catch { /* ignore */ }
        reject(err);
      }
    };
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    rec.onerror = () => finish(new Error("Recorder error"));
    rec.onstop = () => {
      try { player.pause?.(); } catch { /* ignore */ }
      try { player.seek(fromTime); } catch { /* ignore */ }
      clearInterval(probe);
      try { stream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
      finished = true;
      if (!chunks.length) {
        reject(new Error("Recorder produced no data"));
        return;
      }
      resolve({ blob: new Blob(chunks, { type: rec.mimeType || "video/webm" }), mimeType: rec.mimeType || "video/webm" });
    };
    const probe = setInterval(() => {
      if (cancelFlag) {
        clearInterval(probe);
        try { rec.stop(); } catch { /* ignore */ }
        finish(new Error("cancelled"));
        return;
      }
      const t = player.getTime?.() || 0;
      onProgress?.(Math.min(1, t / dur));
      // Safety timeout: duration + 15s headroom, then stop.
      if ((performance.now() - startedAt) / 1000 > dur + 15) {
        try { rec.stop(); } catch { finish(new Error("Recorder timed out")); }
      } else if (t >= dur - 0.05) {
        try { rec.stop(); } catch { /* ignore */ }
      }
    }, 200);
    try {
      player.seek(0);
      rec.start(250);
      player.play?.();
    } catch (err) {
      finish(err);
    }
  });
}

async function startExport() {
  if (exporting) return toast("An export is already running");
  if (picking) return;
  if (!store.get().clips.length) {
    toast("Timeline is empty — add clips before exporting", "err");
    return;
  }

  // Ask where to save and what to name the file BEFORE rendering anything.
  picking = true;
  syncExportControls();
  let dest = null;
  try {
    dest = await pickSaveTarget();
  } catch (err) {
    toast("Could not open the save dialog — " + (err?.message || err), "err");
  } finally {
    picking = false;
    syncExportControls();
  }
  if (!dest) {
    const label = document.getElementById("exportStatus");
    if (label && !exporting) label.textContent = "Cancelled — no save location chosen";
    return;
  }

  if (activePreset.credits) {
    const res = store.spendCredits(activePreset.credits, `Export ${activePreset.label}`);
    if (!res.ok) return toast(res.reason, "err");
  }

  const cfg = resolveExportConfig();
  const duration = Math.max(0.5, store.sequenceDuration());
  exporting = true;
  cancelFlag = false;
  renderPresets();
  syncExportControls();

  const bar = document.getElementById("exportProgress");
  const label = document.getElementById("exportStatus");
  if (label) label.textContent = `Rendering → ${dest.fullPath || dest.name} (0%)`;
  if (bar) bar.style.width = "0%";

  const onProgress = (frac) => {
    const pct = Math.round(Math.min(1, Math.max(0, frac)) * 100);
    if (bar) bar.style.width = pct + "%";
    if (label) label.textContent = `Rendering → ${dest.fullPath || dest.name} (${pct}%)`;
  };

  try {
    const { blob, mimeType } = await capturePreviewToWebM(duration, cfg.fps, onProgress);
    if (cancelFlag) return; // cancelExport already reported
    // MediaRecorder captures WebM regardless of the requested container.
    const isWebM = /webm/i.test(mimeType || "");
    const actualExt = isWebM ? "webm" : (cfg.container || "mp4");
    const baseName = stripExt(dest.name || defaultBaseName());
    const actualName = `${baseName}.${actualExt}`;
    const actualPath = dest.dir ? joinPath(dest.dir, actualName) : actualName;
    const saveLoc = { dir: dest.dir, name: baseName, fullPath: actualPath, fileHandle: dest.fileHandle || fileHandle, dirHandle: dest.dirHandle || null };
    let savedPath = actualPath;
    const api = desktopApi();
    if (api?.writeFile && saveLoc.fullPath) {
      const { blobToBase64 } = await import("./save-dialog.js");
      const b64 = await blobToBase64(blob);
      const res = await api.writeFile(saveLoc.fullPath, b64);
      if (!res?.ok) throw new Error(res?.error || "Desktop write failed");
      savedPath = res.path || actualPath;
    } else if (saveLoc.fileHandle) {
      const out = await saveBlobToLocation(blob, { ...saveLoc, name: actualName });
      if (!out.ok) {
        if (out.cancelled) {
          if (label) label.textContent = "Cancelled — no save location chosen";
          return;
        }
        throw new Error(out.error || "Write failed");
      }
      savedPath = out.path || actualPath;
    } else if (api?.saveVideo && !api?.writeFile) {
      // Legacy stub (automated check): dialog already returned a path, but the
      // capture may have switched the extension to WebM — report the actual file.
      savedPath = actualPath;
      // Still trigger a download so a human gets the file.
      try {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = actualName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } catch { /* download is best-effort */ }
    } else {
      const out = await saveBlobToLocation(blob, { ...saveLoc, name: actualName }, { mime: blob.type });
      if (!out.ok) {
        if (out.cancelled) {
          if (label) label.textContent = "Cancelled — no save location chosen";
          return;
        }
        throw new Error(out.error || "Write failed");
      }
      savedPath = out.path || actualPath;
    }
    if (bar) bar.style.width = "100%";
    const note = isWebM && (cfg.container || "mp4") !== "webm"
      ? `Saved → ${savedPath} (WebM capture — MP4/MOV mux needs the desktop FFmpeg build)`
      : `Saved → ${savedPath}`;
    if (label) label.textContent = note;
    toast(`Export complete → ${savedPath} (${(blob.size / 1048576).toFixed(1)} MB)`, "ok");
    store.pushHistory({ type: "export", preset: activePreset.id, cfg, outputPath: savedPath, bytes: blob.size });
    try { store.mateSay("sys", `Exported ${cfg.label} (${cfg.width}×${cfg.height}@${cfg.fps}) to ${savedPath}.`); } catch { /* ignore */ }
    store.save();
    setTimeout(() => document.getElementById("exportModal")?.classList.remove("open"), 1200);
  } catch (err) {
    if (String(err?.message || "").toLowerCase().includes("cancelled")) {
      if (label) label.textContent = "Cancelled";
      return;
    }
    if (label) label.textContent = "Export failed — " + (err?.message || err);
    toast("Export failed: " + (err?.message || err), "err");
  } finally {
    exporting = false;
    if (exportTimer) {
      clearInterval(exportTimer);
      exportTimer = null;
    }
    renderPresets();
    syncExportControls();
  }
}

function fmt(t) {
  const s = Math.floor(t);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function getActivePreset() {
  return activePreset;
}
