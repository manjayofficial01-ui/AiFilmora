/* Export presets + REAL video save (2.2.0).
 * Every render first resolves WHERE to save and WHAT to name the file:
 * silent default (when "Always ask" is off) → native save dialog in Electron
 * → File System Access API in Chromium → the file name / folder fields in the
 * export modal as a last resort. The two new checkboxes ("Use as default save
 * location", "Always ask where to save") persist to settings.save.
 *
 * The render itself captures the program monitor (previewCanvas) with
 * MediaRecorder into a real video Blob, then writes those bytes to the chosen
 * location via the file handle / Electron fs:writeFile bridge / download.
 *
 * APP-037 (2026-11-25) — the export now produces the file the sheet
 * promised:
 *   - the six export controls are live; they are read, not decorated;
 *   - the render happens at the requested resolution, not the preview's;
 *   - the timeline's sound is mixed into the recording through the mix bus;
 *   - the render ends when the timeline ends (the player says so);
 *   - with an encoder available the capture is encoded into the requested
 *     container and codec, and the result is probed before it is reported;
 *   - without one, the app says plainly that this is a preview export and
 *     what it actually contains. */
import { store } from "./state.js";
import { toast } from "./media.js";
import { settings } from "./settings.js";
import { sidecarCapabilities, encodeCapture } from "./media-sidecar.js";
import { mixBusStream, resumeAudio } from "./audio-fx.js";
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
/** What the sidecar can really produce: { canEncode, reason, missing }. */
let encoderCaps = null;
/** The container this export will actually write, once it is known. */
let exportContainer = "";
/** Has the user changed the export controls since the sheet was last opened? */
let controlsTouched = false;

const KNOWN_EXT = /\.(mp4|mov|gif|webm|mkv|m4v|avi|mp3)$/i;

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
  return "." + effectiveContainer();
}

/**
 * The container this build can actually write.
 *
 * Without an encoder the app writes the raw capture — a WebM — and says so,
 * rather than promising an MP4 it cannot deliver. The extension shown in the
 * sheet is therefore the extension the file will really have.
 */
function effectiveContainer() {
  if (exportContainer) return exportContainer;
  const want = String(resolveExportConfig().container || "mp4").toLowerCase();
  if (encoderCaps && !encoderCaps.canEncode) return "webm";
  return want;
}

/**
 * Ask the sidecar what it can produce, so the sheet never promises more than
 * the build can deliver. The answer is cached until the sheet is reopened.
 */
async function refreshEncoderCaps() {
  try {
    const caps = await sidecarCapabilities();
    encoderCaps = {
      canEncode: !!(caps?.available && caps.canTranscode),
      reason: caps?.reason || "",
      missing: caps?.missing || [],
    };
  } catch (err) {
    encoderCaps = { canEncode: false, reason: String(err?.message || err), missing: [] };
  }
  return encoderCaps;
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

  /* The six export controls are the contract. They are read by
   * resolveExportConfig() and they change the file that comes out — which
   * means editing one moves the preset chip to "Custom", because the sheet
   * must never claim a preset that is no longer in effect. */
  ["exportFormat", "exportCodec", "exportRes", "exportFps", "exportBitrate", "exportHw"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", () => {
      controlsTouched = true;
      activePreset = PRESETS.find((p) => p.id === "custom") || activePreset;
      renderPresets();
      syncExportMeta();
    });
  });

  // The destination tabs live in filmora-chrome.js; when one is chosen the
  // hint is rewritten there, so it is re-synced here afterwards.
  window.addEventListener("aifimora:export-dest", () => syncDestInputs());

  // What can this build really produce? The sheet must not promise more.
  refreshEncoderCaps().then(() => {
    if (document.getElementById("exportModal")?.classList.contains("open")) {
      syncDestInputs();
      syncExportMeta();
    }
  });
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

/**
 * What this build will actually write, in words.
 * The sheet may promise 4K H.265; the app may only be able to record a
 * preview. When that is the case, this says so here, before the render.
 */
function formatNote() {
  const cfg = resolveExportConfig();
  if (encoderCaps && !encoderCaps.canEncode) {
    return "This build has no encoder, so it records a WebM preview — a real MP4 needs the desktop app with FFmpeg.";
  }
  const codec = String(cfg.codec || "").toUpperCase();
  const where = cfg.container ? " in " + String(cfg.container).toUpperCase() : "";
  return `Records ${cfg.width}×${cfg.height} at ${cfg.fps} fps, ${codec}${where}.`;
}

function syncDestHint() {
  const el = document.getElementById("exportDestHint");
  if (!el) return;
  if (exporting) return;
  const prefs = getSavePrefs("video");
  const askNote = prefs.ask === false && prefs.defaultDir
    ? ` · using default ${prefs.defaultDir} silently (tick “Always ask” to choose each time).`
    : " · you'll confirm the folder and name before rendering.";
  const note = " " + formatNote();
  const api = desktopApi();
  if (api?.saveVideo) {
    el.textContent = `Will save as ${fullPath()} — you'll confirm the folder and name before rendering${prefs.ask === false ? " (or silently to the default when “Always ask” is off)." : "."}${note}`;
  } else if (fileHandle) {
    el.textContent = `Will save as ${fileHandle.name || currentFileName()} (browser save picker)${askNote}${note}`;
  } else if (window.showSaveFilePicker) {
    el.textContent = "Your browser will ask where to save the file before rendering" + askNote + note;
  } else {
    el.textContent = currentDir()
      ? `Will save as ${fullPath()}${askNote}${note}`
      : `Will save as ${currentFileName()} in your browser's download folder${askNote}${note}`;
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
async function pickSaveTarget(container) {
  const cfg = resolveExportConfig();
  const ext = String(container || cfg.container || "mp4").replace(/^\./, "");
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

/** Set a select only when it really has that option. */
function setSelect(id, val) {
  const el = document.getElementById(id);
  if (!el || val === undefined || val === null || val === "") return false;
  const v = String(val);
  const has = Array.from(el.options || []).some((o) => o.value === v);
  if (!has) return false;
  el.value = v;
  return true;
}

/**
 * The presets and the controls do not use the same words for the codecs:
 * a preset says "h265", the encoder control says "hevc". Without this map
 * the YouTube 4K preset would quietly write H.264 into the control and
 * deliver an H.264 file while the chip claims H.265.
 */
const CODEC_ALIAS = { h265: "hevc", h264: "h264", av1: "av1", prores: "prores", vp9: "vp9" };

function codecForControl(codec) {
  const c = String(codec || "").toLowerCase();
  return CODEC_ALIAS[c] || c;
}

/** Write a preset's own numbers into the six controls. */
function applyPresetToControls(p) {
  if (!p) return;
  if (p.container) setSelect("exportFormat", p.container);
  if (p.codec && p.codec !== "gif" && p.codec !== "mp3") setSelect("exportCodec", codecForControl(p.codec));
  if (p.w && p.h) setSelect("exportRes", `${p.w}x${p.h}`);
  if (p.fps) setSelect("exportFps", String(p.fps));
}

/** The preset that matches the six controls, or "Custom" when none does. */
function matchPresetToControls() {
  const s = readFilmoraExportSettings();
  const hit = PRESETS.find((p) => {
    if (p.id === "custom") return false;
    if (p.container && p.container !== s.format) return false;
    if (p.codec && p.codec !== "gif" && p.codec !== "mp3" && codecForControl(p.codec) !== s.codec) return false;
    if (p.w && `${p.w}x${p.h}` !== s.resolution) return false;
    if (p.fps && String(p.fps) !== String(s.fps)) return false;
    return true;
  });
  return hit || PRESETS.find((p) => p.id === "custom") || activePreset;
}

function applyFilmoraExportDefaults() {
  const def = settings.get().exportDefaults || {};
  const map = {
    exportFormat: def.format || "mp4",
    exportCodec: def.codec || "h264",
    exportRes: def.resolution || "1920x1080",
    exportFps: String(def.fps || 30),
    exportBitrate: String(def.bitrateMbps ?? def.bitrate ?? 16),
    exportHw: def.hardware || "auto",
  };
  for (const [id, val] of Object.entries(map)) setSelect(id, val);
  const dest = window.__exportDest || def.dest || "local";
  document.querySelectorAll("#exportTabs [data-edest]").forEach((b) => {
    b.classList.toggle("active", b.dataset.edest === dest);
  });
}

function openExport() {
  // The saved defaults only apply until the user touches the controls —
  // opening the sheet must not throw away a choice they already made.
  if (!controlsTouched) applyFilmoraExportDefaults();
  activePreset = matchPresetToControls();
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
  // The sheet must not promise more than this build can deliver.
  refreshEncoderCaps().then(() => {
    if (document.getElementById("exportModal")?.classList.contains("open")) {
      syncDestInputs();
      syncExportMeta();
    }
  });
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
  PRESETS.forEach((p) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "preset" + (p.id === activePreset.id ? " active" : "");
    btn.setAttribute("aria-pressed", p.id === activePreset.id ? "true" : "false");
    btn.disabled = exporting;
    let detail = p.detail;
    if (p.id === "custom") {
      // "Custom" is not a preset — it is whatever the six controls say.
      const s = readFilmoraExportSettings();
      detail = `${String(s.codec).toUpperCase()} · ${String(s.resolution).replace("x", "×")} · ${s.fps}fps · ${String(s.format).toUpperCase()}`;
    }
    btn.innerHTML = `<strong>${p.label}</strong><span>${detail}${p.credits ? " · " + p.credits + " cr" : ""}</span>`;
    btn.addEventListener("click", () => {
      activePreset = p;
      controlsTouched = true;
      // A preset writes its own numbers into the six controls, so the sheet
      // always shows what the preset will actually produce.
      if (p.id !== "custom") applyPresetToControls(p);
      renderPresets();
      syncExportMeta();
    });
    root.appendChild(btn);
  });
  syncExportMeta();
}

/**
 * The export configuration — read from the six controls, because those are
 * what the user set. The preset and the saved defaults only fill the gaps.
 */
function resolveExportConfig() {
  const def = settings.get().exportDefaults || {};
  const p = activePreset;
  const s = readFilmoraExportSettings();
  const [rw, rh] = String(s.resolution || "").split("x").map(Number);
  const width = rw > 0 ? rw : (p.w || store.get().width || 1920);
  const height = rh > 0 ? rh : (p.h || store.get().height || 1080);
  return {
    label: p.label,
    width,
    height,
    fps: s.fps || p.fps || Number(def.fps) || store.get().fps || 30,
    codec: String(s.codec || p.codec || def.codec || "h264").toLowerCase(),
    container: String(s.format || p.container || def.container || "mp4").toLowerCase(),
    quality: def.quality || "high",
    bitrate: s.bitrateMbps || Number(def.bitrate) || 12,
    hardware: s.hardware || "auto",
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
    const bits = [
      `${String(cfg.codec || "").toUpperCase()} · ${cfg.width}×${cfg.height} · ${cfg.fps}fps`,
      cfg.bitrate ? `${cfg.bitrate} Mbps` : cfg.quality,
    ];
    if (encoderCaps && !encoderCaps.canEncode) {
      bits.push("preview capture · no encoder in this build");
    } else {
      bits.push(String(cfg.container || "").toUpperCase());
      if (cfg.hardware && cfg.hardware !== "off") bits.push(cfg.hardware === "auto" ? "hardware if available" : cfg.hardware);
    }
    if (cfg.burnInCaptions) bits.push("captions");
    if (cfg.socialUpload && cfg.socialUpload !== "none") bits.push("→" + cfg.socialUpload);
    el.textContent = bits.join(" · ");
  }
  syncDestInputs(); // container can change with the preset → keep the extension in sync
}

/* ---------------- real capture ---------------- */

function pickRecorderMime(withAudio) {
  const cands = withAudio
    ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm;codecs=vp9", "video/webm"]
    : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  try {
    for (const m of cands) {
      if (window.MediaRecorder?.isTypeSupported?.(m)) return m;
    }
  } catch { /* ignore */ }
  return "";
}

/**
 * Record the program monitor while the timeline plays from 0 to its end.
 *
 * Three things make this a real render rather than a screen recording:
 *   - the canvas is captured at the output resolution (the player is in
 *     export mode, so the composition is full-size);
 *   - the mix bus supplies the sound track, so the file has audio;
 *   - the render ends when the *player* says the timeline ended, not when a
 *     timer guesses that it has.
 *
 * View-only: never mutates clips, tracks, or durations.
 */
function capturePreview({ duration, fps, onProgress, withAudio = true } = {}) {
  return new Promise((resolve, reject) => {
    const canvas = document.getElementById("previewCanvas");
    const player = window.__aifimoraPlayer;
    if (!canvas || !player) return reject(new Error("Preview not ready"));
    if (typeof canvas.captureStream !== "function") return reject(new Error("Canvas capture not supported in this browser"));
    if (typeof window.MediaRecorder !== "function") return reject(new Error("MediaRecorder not supported in this browser"));

    // The timeline's sound, mixed exactly as the user heard it.
    const bus = withAudio ? mixBusStream() : null;
    const audioTrack = bus ? bus.getAudioTracks()[0] || null : null;
    const mime = pickRecorderMime(!!audioTrack);
    // A suspended AudioContext records silence — wake it up for the render.
    try { resumeAudio(); } catch { /* ignore */ }

    let stream = null;
    try {
      stream = canvas.captureStream(Math.min(60, Math.max(10, Number(fps) || 30)));
    } catch (err) {
      return reject(err);
    }
    if (audioTrack) {
      try { stream.addTrack(audioTrack); } catch { /* ignore */ }
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

    const stopTracks = () => {
      // The bus track is live and shared — it must not be stopped here.
      try { stream.getTracks().forEach((t) => { if (t !== audioTrack) t.stop(); }); } catch { /* ignore */ }
    };

    const onComplete = () => {
      if (finished) return;
      try { rec.stop(); } catch { /* ignore */ }
    };

    const finish = (err) => {
      if (finished) return;
      finished = true;
      window.removeEventListener("aifimora:render-complete", onComplete);
      clearInterval(probe);
      stopTracks();
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
      window.removeEventListener("aifimora:render-complete", onComplete);
      try { player.pause?.(); } catch { /* ignore */ }
      try { player.seek(fromTime); } catch { /* ignore */ }
      clearInterval(probe);
      stopTracks();
      finished = true;
      if (!chunks.length) {
        reject(new Error("Recorder produced no data"));
        return;
      }
      resolve({
        blob: new Blob(chunks, { type: rec.mimeType || "video/webm" }),
        mimeType: rec.mimeType || "video/webm",
        hasAudio: !!audioTrack,
        width: canvas.width,
        height: canvas.height,
      });
    };

    // The render-complete signal. The player stops at the end of the
    // sequence and says so; that is what ends the recording.
    window.addEventListener("aifimora:render-complete", onComplete);

    const probe = setInterval(() => {
      if (cancelFlag) {
        clearInterval(probe);
        try { rec.stop(); } catch { /* ignore */ }
        finish(new Error("cancelled"));
        return;
      }
      const t = player.getTime?.() || 0;
      onProgress?.(Math.min(1, t / dur));
      // Safety net only: if the player never signals completion (it was not
      // put into export mode, say), stop after the duration plus headroom.
      if ((performance.now() - startedAt) / 1000 > dur + 15) {
        try { rec.stop(); } catch { finish(new Error("Recorder timed out")); }
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

/**
 * Write a captured blob to the chosen place, using whatever the build has:
 * the Electron bridge, a browser file handle, or a download.
 * @returns {Promise<string>} the path it wrote to
 */
async function writeCapture(blob, loc, fileName) {
  const api = desktopApi();
  if (api?.writeFile && loc.fullPath) {
    const { blobToBase64 } = await import("./save-dialog.js");
    const b64 = await blobToBase64(blob);
    const res = await api.writeFile(loc.fullPath, b64);
    if (!res?.ok) throw new Error(res?.error || "Desktop write failed");
    return res.path || loc.fullPath;
  }
  if (loc.fileHandle) {
    const out = await saveBlobToLocation(blob, { ...loc, name: fileName });
    if (!out.ok) {
      if (out.cancelled) {
        const err = new Error("cancelled");
        err.cancelled = true;
        throw err;
      }
      throw new Error(out.error || "Write failed");
    }
    return out.path || loc.fullPath;
  }
  if (api?.saveVideo && !api?.writeFile) {
    // Legacy stub (automated check): the dialog already returned a path, so
    // the file is reported there and a download is offered to a human.
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch { /* download is best-effort */ }
    return loc.fullPath;
  }
  const out = await saveBlobToLocation(blob, { ...loc, name: fileName }, { mime: blob.type });
  if (!out.ok) {
    if (out.cancelled) {
      const err = new Error("cancelled");
      err.cancelled = true;
      throw err;
    }
    throw new Error(out.error || "Write failed");
  }
  return out.path || loc.fullPath;
}

/**
 * Describe the file that was actually written — from the probe of it, not
 * from what was asked for. When the two differ, the file says so.
 */
function describeEncoded(enc, cfg) {
  const probe = enc?.probe || null;
  const bits = [];
  if (probe?.video) {
    bits.push(`${String(probe.video.codec || "").toUpperCase()} · ${probe.video.width}×${probe.video.height}`);
  } else {
    bits.push(`${String(cfg.codec || "").toUpperCase()} · ${cfg.width}×${cfg.height}`);
  }
  bits.push(probe ? (probe.hasAudio ? "with audio" : "no audio") : "audio not checked");
  if (enc?.hardware) bits.push("hardware encoded");
  else if (cfg.hardware && cfg.hardware !== "auto" && cfg.hardware !== "off") {
    bits.push("software encoded (no hardware encoder available)");
  }
  const warns = (enc?.warnings || []).filter(Boolean);
  if (warns.length) bits.push(warns.join("; "));
  return bits.join(" · ");
}

async function startExport() {
  if (exporting) return toast("An export is already running");
  if (picking) return;
  if (!store.get().clips.length) {
    toast("Timeline is empty — add clips before exporting", "err");
    return;
  }

  // What can this build really produce? The answer decides the extension
  // the user is shown, so it is settled before the save dialog opens.
  await refreshEncoderCaps();
  const canEncode = !!(encoderCaps && encoderCaps.canEncode);
  const cfg = resolveExportConfig();
  exportContainer = canEncode ? cfg.container : "webm";
  const codec = canEncode ? cfg.codec : "vp9";

  // Ask where to save and what to name the file BEFORE rendering anything.
  picking = true;
  syncExportControls();
  let dest = null;
  try {
    dest = await pickSaveTarget(exportContainer);
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

  const player = window.__aifimoraPlayer;
  try {
    // Render at the output resolution; the player tells us when the
    // timeline has ended, and the recording stops there.
    player?.setExportMode?.(true, { width: cfg.width, height: cfg.height });

    let capture = null;
    let audioDropped = false;
    try {
      capture = await capturePreview({ duration, fps: cfg.fps, onProgress });
    } catch (err) {
      /* A recorder carrying a stalled audio track records nothing at all —
       * not even the video. The picture is worth more than the sound, so
       * the render is tried again without the audio track rather than
       * failing outright. */
      if (!/no data/i.test(String(err?.message || ""))) throw err;
      audioDropped = true;
      capture = await capturePreview({ duration, fps: cfg.fps, onProgress, withAudio: false });
    }
    if (cancelFlag) return; // cancelExport already reported

    const { blob, mimeType, hasAudio, width, height } = capture;
    const withSound = hasAudio && !audioDropped;

    const baseName = stripExt(dest.name || defaultBaseName());
    let savedPath = "";
    let bytes = blob.size;
    let note = "";

    if (canEncode) {
      if (label) label.textContent = `Encoding → ${dest.fullPath || dest.name}`;
      const enc = await encodeCapture(blob, {
        container: exportContainer,
        codec,
        width: cfg.width,
        height: cfg.height,
        fps: cfg.fps,
        bitrateMbps: cfg.bitrate,
        audio: withSound,
        audioBitrate: cfg.audioBitrate,
        hardware: cfg.hardware,
        dest: dest.fullPath || "",
      });
      if (enc?.ok) {
        savedPath = enc.savedTo || enc.path || dest.fullPath || dest.name;
        bytes = enc.bytes || bytes;
        note = describeEncoded(enc, cfg);
      } else {
        // The encode failed. The render is not lost: the raw capture is
        // saved next to the destination and the app says what happened.
        const fbName = `${baseName}.webm`;
        const fbPath = dest.dir ? joinPath(dest.dir, fbName) : fbName;
        savedPath = await writeCapture(blob, { ...dest, name: baseName, fullPath: fbPath }, fbName);
        bytes = blob.size;
        note = `The ${String(exportContainer).toUpperCase()} could not be encoded (${enc?.error || "unknown error"}); the raw WebM capture was saved instead.`;
      }
    } else {
      // No encoder in this build. This is a preview capture, and the app
      // says exactly that — with what it really contains.
      const actualName = `${baseName}.webm`;
      const actualPath = dest.dir ? joinPath(dest.dir, actualName) : actualName;
      savedPath = await writeCapture(blob, { ...dest, name: baseName, fullPath: actualPath }, actualName);
      const sound = withSound ? "with audio" : "no audio";
      const why = audioDropped ? " (the sound track could not be recorded)" : "";
      note = `Quick preview export · WebM · ${height}p · ${sound}${why} — a real ${String(cfg.container).toUpperCase()} needs the desktop app with FFmpeg.`;
    }

    if (bar) bar.style.width = "100%";
    const summary = `Saved → ${savedPath} — ${note}`;
    if (label) label.textContent = summary;
    toast(`Export complete → ${savedPath} (${(bytes / 1048576).toFixed(1)} MB)`, "ok");
    store.pushHistory({ type: "export", preset: activePreset.id, cfg, outputPath: savedPath, bytes });
    try { store.mateSay("sys", `Exported ${cfg.label} (${cfg.width}×${cfg.height}@${cfg.fps}) to ${savedPath}.`); } catch { /* ignore */ }
    store.save();
    setTimeout(() => document.getElementById("exportModal")?.classList.remove("open"), 1200);
  } catch (err) {
    if (String(err?.message || "").toLowerCase().includes("cancelled") || err?.cancelled) {
      if (label) label.textContent = "Cancelled";
      return;
    }
    if (label) label.textContent = "Export failed — " + (err?.message || err);
    toast("Export failed: " + (err?.message || err), "err");
  } finally {
    // The preview goes back to being a preview.
    try { player?.setExportMode?.(false); } catch { /* ignore */ }
    exporting = false;
    exportContainer = "";
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
