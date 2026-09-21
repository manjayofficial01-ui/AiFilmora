/* 2.2.0 — Unified "Ask location + Default Save Location" helper.
 * Used by project Save/Save-As/Open and by video Export.
 *
 * - If prefs say "don't ask" and a default folder exists, the location is
 *   returned silently (no modal, no native dialog).
 * - Otherwise a small modal asks for folder + file name with two checkboxes:
 *     [x] Use this folder as the default save location
 *     [x] Always ask where to save (uncheck = use the default silently)
 * - Actual bytes are written via File System Access (browser), the Electron
 *   fs:writeFile bridge (desktop), or a download fallback (plain web). */

import { store } from "./state.js";
import { settings } from "./settings.js";

function toast(msg, kind) {
  window.dispatchEvent(new CustomEvent("aifimora:toast", { detail: { msg, kind } }));
}

function desktopApi() {
  return typeof window !== "undefined" ? window.aifimoraDesktop : null;
}

function pathSep() {
  const p = desktopApi()?.platform;
  if (p) return p === "win32" ? "\\" : "/";
  return navigator.userAgent.includes("Windows") ? "\\" : "/";
}

export function joinPath(dir, file) {
  const d = String(dir || "").replace(/[\\/]+$/, "");
  return d ? d + pathSep() + file : file;
}

export function splitPath(full) {
  const s = String(full || "");
  const i = Math.max(s.lastIndexOf("\\"), s.lastIndexOf("/"));
  return i < 0 ? { dir: "", name: s } : { dir: s.slice(0, i), name: s.slice(i + 1) };
}

export function sanitizeName(raw, fallback = "Untitled Project") {
  const n = String(raw ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+/, "");
  return n || fallback;
}

export function stripKnownExt(name) {
  return String(name || "").replace(/\.(aifimora\.json|json|mp4|mov|gif|webm|mkv|m4v|avi)$/i, "");
}

/* ---------------- prefs ---------------- */

export function getSavePrefs(kind) {
  const s = settings.saveConfig();
  if (kind === "video") {
    return {
      defaultDir: s.defaultVideoDir || s.defaultProjectDir || settings.get().outputFolder || "",
      ask: s.askVideoLocation !== false,
    };
  }
  return {
    defaultDir: s.defaultProjectDir || settings.get().folders?.projectLocation || "",
    ask: s.askProjectLocation !== false,
  };
}

export function setSavePrefs(kind, { defaultDir, ask } = {}) {
  const cur = settings.saveConfig();
  if (kind === "video") {
    const patch = {};
    if (defaultDir !== undefined) patch.defaultVideoDir = defaultDir;
    if (ask !== undefined) patch.askVideoLocation = !!ask;
    settings.set({ save: { ...cur, ...patch } });
  } else {
    const patch = {};
    if (defaultDir !== undefined) patch.defaultProjectDir = defaultDir;
    if (ask !== undefined) patch.askProjectLocation = !!ask;
    settings.set({ save: { ...cur, ...patch } });
  }
}

/* ---------------- modal ---------------- */

let modalEls = null;

function ensureModal() {
  if (modalEls) return modalEls;
  const back = document.createElement("div");
  back.className = "modal-backdrop";
  back.id = "saveLocationModal";
  back.setAttribute("role", "dialog");
  back.setAttribute("aria-modal", "true");
  back.innerHTML = `
    <div class="modal" role="document" aria-label="Save location">
      <h3 id="saveLocTitle">Save</h3>
      <p id="saveLocSub" style="font-size:12px;color:var(--ink-dim);margin:0 0 12px"></p>
      <div class="export-dest">
        <div class="export-dest-row">
          <label for="saveLocName">File name</label>
          <div class="export-dest-ctl">
            <input id="saveLocName" type="text" spellcheck="false" autocomplete="off" />
            <span class="export-dest-ext" id="saveLocExt"></span>
          </div>
        </div>
        <div class="export-dest-row">
          <label for="saveLocDir">Save in</label>
          <div class="export-dest-ctl">
            <input id="saveLocDir" type="text" spellcheck="false" autocomplete="off" placeholder="Choose a folder…" />
            <button class="btn sm" id="saveLocBrowse" type="button">Browse…</button>
          </div>
        </div>
        <label class="save-check" for="saveLocDefault">
          <input id="saveLocDefault" type="checkbox" />
          <span>Use this folder as the default save location</span>
        </label>
        <label class="save-check" for="saveLocAsk">
          <input id="saveLocAsk" type="checkbox" checked />
          <span>Always ask where to save (uncheck to reuse the default silently)</span>
        </label>
        <div class="export-dest-hint" id="saveLocHint"></div>
      </div>
      <div class="modal-actions">
        <button class="btn ghost" id="saveLocCancel" type="button">Cancel</button>
        <button class="btn primary" id="saveLocOk" type="button">Save here</button>
      </div>
    </div>`;
  document.body.appendChild(back);
  modalEls = {
    back,
    title: back.querySelector("#saveLocTitle"),
    sub: back.querySelector("#saveLocSub"),
    name: back.querySelector("#saveLocName"),
    ext: back.querySelector("#saveLocExt"),
    dir: back.querySelector("#saveLocDir"),
    browse: back.querySelector("#saveLocBrowse"),
    useDefault: back.querySelector("#saveLocDefault"),
    ask: back.querySelector("#saveLocAsk"),
    hint: back.querySelector("#saveLocHint"),
    ok: back.querySelector("#saveLocOk"),
    cancel: back.querySelector("#saveLocCancel"),
  };
  return modalEls;
}

function hintForApi() {
  if (desktopApi()?.writeFile) return "Desktop app — the file is written exactly to the folder above.";
  if (window.showSaveFilePicker || window.showDirectoryPicker)
    return "Browser — the file handle you grant is written directly; the folder is remembered as your default.";
  return "Browser — files download to your browser's download folder; the folder above is remembered as a label.";
}

/**
 * Ask for folder + file name (honouring "don't ask + default" prefs).
 * Resolves to { dir, name, fullPath } or null when cancelled.
 */
export function askSaveLocation({ kind = "project", suggestedName = "", ext = "json", title = "", subtitle = "" } = {}) {
  const prefs = getSavePrefs(kind);
  const cleanExt = String(ext || "").replace(/^\./, "") || "json";
  const base = stripKnownExt(sanitizeName(suggestedName || (kind === "video" ? "Untitled Video" : "Untitled Project"), kind === "video" ? "Untitled Video" : "Untitled Project"));

  // Silent path: user unchecked "always ask" and a default folder exists.
  if (!prefs.ask && prefs.defaultDir) {
    return Promise.resolve({
      dir: prefs.defaultDir,
      name: base,
      fullPath: joinPath(prefs.defaultDir, `${base}.${cleanExt}`),
      silent: true,
    });
  }

  const m = ensureModal();
  m.title.textContent = title || (kind === "video" ? "Save video as" : "Save project as");
  m.sub.textContent = subtitle || (kind === "video"
    ? "Choose where this video is saved. Tick the box to reuse this folder automatically."
    : "Choose where this project file is saved. Tick the box to reuse this folder automatically.");
  m.ext.textContent = "." + cleanExt;
  m.name.value = base;
  m.dir.value = prefs.defaultDir || "";
  m.useDefault.checked = !prefs.defaultDir;
  m.ask.checked = prefs.ask !== false;
  m.hint.textContent = hintForApi();

  m.back.classList.add("open");
  setTimeout(() => m.name?.focus(), 60);

  return new Promise((resolve) => {
    const done = (val) => {
      m.back.classList.remove("open");
      m.ok.onclick = null;
      m.cancel.onclick = null;
      m.back.onclick = null;
      m.browse.onclick = null;
      m.name.onkeydown = null;
      resolve(val);
    };
    m.cancel.onclick = () => done(null);
    m.back.onclick = (e) => {
      if (e.target === m.back) done(null);
    };
    m.name.onkeydown = (e) => {
      if (e.key === "Enter") m.ok.click();
      if (e.key === "Escape") done(null);
    };
    m.browse.onclick = async () => {
      const api = desktopApi();
      try {
        if (api?.openFolder) {
          const picked = await api.openFolder();
          if (picked) m.dir.value = picked;
          return;
        }
        if (window.showDirectoryPicker) {
          const h = await window.showDirectoryPicker({ mode: "readwrite" });
          if (h?.name) m.dir.value = h.name;
          m._dirHandle = h || null;
          return;
        }
      } catch (err) {
        if (err?.name === "AbortError") return;
      }
      toast("Type a folder path — the file itself is picked via download in this browser", "err");
      m.dir.focus();
    };
    m.ok.onclick = () => {
      const rawName = stripKnownExt(sanitizeName(m.name.value, base)) || base;
      const dir = m.dir.value.trim();
      // Remember prefs from the checkboxes BEFORE returning.
      if (m.useDefault.checked && dir) setSavePrefs(kind, { defaultDir: dir });
      setSavePrefs(kind, { ask: m.ask.checked });
      if (!rawName) {
        m.name.focus();
        toast("Enter a file name", "err");
        return;
      }
      done({
        dir,
        name: rawName,
        fullPath: joinPath(dir, `${rawName}.${cleanExt}`),
        dirHandle: m._dirHandle || null,
        silent: false,
      });
      m._dirHandle = null;
    };
  });
}

/* ---------------- byte writers ---------------- */

function strToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  }
  return btoa(bin);
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const res = String(r.result || "");
      const i = res.indexOf(",");
      resolve(i >= 0 ? res.slice(i + 1) : res);
    };
    r.onerror = () => reject(r.error || new Error("blob read failed"));
    r.readAsDataURL(blob);
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** Write text to the chosen location (desktop bridge / file handle / download). */
export async function saveTextToLocation(text, location, { ext = "json", mime = "application/json" } = {}) {
  const filename = `${location.name}.${String(ext).replace(/^\./, "")}`;
  // 1) File System Access handle (granted earlier via picker)
  if (location.fileHandle) {
    try {
      const w = await location.fileHandle.createWritable();
      await w.write(text);
      await w.close();
      return { ok: true, via: "handle", path: location.fileHandle.name || filename };
    } catch (err) {
      if (err?.name === "AbortError") return { ok: false, cancelled: true };
      // fall through to download
    }
  }
  // 2) Desktop bridge writes exactly to fullPath
  const api = desktopApi();
  if (api?.writeFile && location.fullPath) {
    const res = await api.writeFile(location.fullPath, strToBase64(text));
    if (res?.ok) return { ok: true, via: "desktop", path: location.fullPath };
    return { ok: false, error: res?.error || "Desktop write failed" };
  }
  // 3) Plain-browser download (folder is a remembered label)
  downloadBlob(new Blob([text], { type: mime }), filename);
  return { ok: true, via: "download", path: location.dir ? joinPath(location.dir, filename) : filename };
}

/** Write binary blob to the chosen location. */
export async function saveBlobToLocation(blob, location, { filename = null, mime = null } = {}) {
  const name = filename || `${location.name}`;
  if (location.fileHandle) {
    try {
      const w = await location.fileHandle.createWritable();
      await w.write(blob);
      await w.close();
      return { ok: true, via: "handle", path: location.fileHandle.name || name };
    } catch (err) {
      if (err?.name === "AbortError") return { ok: false, cancelled: true };
    }
  }
  const api = desktopApi();
  if (api?.writeFile && location.fullPath) {
    const b64 = await blobToBase64(blob);
    const res = await api.writeFile(location.fullPath, b64);
    if (res?.ok) return { ok: true, via: "desktop", path: location.fullPath, bytes: res.bytes };
    return { ok: false, error: res?.error || "Desktop write failed" };
  }
  downloadBlob(mime ? new Blob([blob], { type: mime }) : blob, name.includes(".") ? name : name);
  return { ok: true, via: "download", path: location.dir ? joinPath(location.dir, name) : name };
}

/* ---------------- project flows ---------------- */

function serializableProject() {
  const s = store.get();
  const media = (s.media || []).map((m) => {
    const copy = { ...m };
    if (copy?.url && String(copy.url).startsWith("blob:")) {
      copy.url = null;
      copy._offline = true;
      copy._needsRelink = true;
    }
    if (copy?.thumb && String(copy.thumb).startsWith("blob:")) copy.thumb = null;
    return copy;
  });
  return {
    app: "AiFilmora",
    version: 1,
    savedAt: new Date().toISOString(),
    ...s,
    media,
    jobs: (s.jobs || []).slice(-20),
  };
}

/** Save the project: localStorage + project file at the chosen location. */
export async function saveProjectFlow({ saveAs = false } = {}) {
  const prefs = getSavePrefs("project");
  let location = null;
  if (!saveAs && window.__aifimoraProjectFile?.fullPath && !prefs.ask) {
    // Re-save silently to the last file when the user disabled asking.
    location = window.__aifimoraProjectFile;
  } else {
    location = await askSaveLocation({
      kind: "project",
      suggestedName: stripKnownExt(store.get()?.name || "Untitled Project"),
      ext: "aifimora.json",
      title: saveAs ? "Save project as…" : "Save project",
    });
  }
  if (!location) {
    toast("Save cancelled — no location chosen");
    return false;
  }
  const data = JSON.stringify(serializableProject(), null, 2);
  const res = await saveTextToLocation(data, location, { ext: "aifimora.json" });
  if (!res.ok) {
    if (!res.cancelled) toast("Project save failed: " + (res.error || "unknown error"), "err");
    return false;
  }
  window.__aifimoraProjectFile = location;
  try {
    const { rememberRecentProject } = await import("./workflows.js");
    rememberRecentProject(store.get().name);
  } catch { /* non-critical */ }
  store.save();
  store.pushHistory({ type: "save-file", path: res.path });
  toast(`Project saved → ${res.path}`, "ok");
  return true;
}

/** Open a project from disk (desktop bridge or browser file picker). */
export async function openProjectFlow() {
  const api = desktopApi();
  const applyJson = (text, label) => {
    const obj = JSON.parse(text);
    if (store.importProject(obj)) {
      window.__aifimoraProjectFile = label ? { dir: splitPath(label).dir, name: stripKnownExt(splitPath(label).name), fullPath: label } : null;
      toast(`Project loaded ← ${label || "file"}`, "ok");
      window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
      return true;
    }
    toast("Import failed: invalid project", "err");
    return false;
  };
  try {
    if (api?.openProject) {
      const picked = await api.openProject();
      if (!picked) return false;
      if (picked.error || picked.content == null) {
        toast("Open failed: " + (picked.error || "could not read file"), "err");
        return false;
      }
      return applyJson(picked.content, picked.path);
    }
  } catch (err) {
    toast("Open failed: " + (err?.message || err), "err");
    return false;
  }
  // Browser fallback: <input type=file>
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".aifimora.json,.json,application/json";
  const picked = await new Promise((resolve) => {
    input.onchange = () => resolve(input.files?.[0] || null);
    input.oncancel = () => resolve(null);
    input.click();
  });
  if (!picked) return false;
  try {
    const text = await picked.text();
    return applyJson(text, picked.name);
  } catch (err) {
    toast("Import failed: " + (err?.message || err), "err");
    return false;
  }
}
