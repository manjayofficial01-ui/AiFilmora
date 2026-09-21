/* Filmora-parity workflows: clipboard, backup/crash recovery, autosave timer,
 * SRT caption export, project settings dialog, fullscreen, zoom-to-fit. */

import { store } from "./state.js";
import { settings } from "./settings.js";
import { getClipboard, setClipboard } from "./shortcuts.js";
import { setZoom } from "./timeline.js";
import { toast } from "./media.js";

const BACKUP_KEY = "aifimora.backup.v1";
const RECENT_KEY = "aifimora.recent.v1";

function selectedClip() {
  const s = store.get();
  return s.clips.find((c) => c.id === s.selectedClipId) || null;
}

export function copySelectedClip() {
  const clip = selectedClip();
  if (!clip) return toast("Select a clip to copy");
  setClipboard(clip);
  toast(`Copied “${clip.name}”`, "ok");
}

export function pasteClip(player) {
  const src = getClipboard();
  if (!src) return toast("Clipboard is empty");
  const at = player?.getTime?.() ?? null;
  const copy = store.pasteClipAt(src, { at });
  if (copy) toast(`Pasted “${copy.name}”`, "ok");
}

export function duplicateSelectedClip() {
  const id = store.get().selectedClipId;
  if (!id) return toast("Select a clip to duplicate");
  const copy = store.duplicateClip(id);
  if (copy) toast(`Duplicated “${copy.name}”`, "ok");
  else toast("Could not duplicate clip");
}

export function rippleDeleteSelected() {
  const id = store.get().selectedClipId;
  if (!id) return toast("Select a clip to ripple delete");
  const res = store.rippleDeleteClip(id);
  if (res?.ok) toast("Ripple delete", "ok");
  else toast(res?.reason || "Could not ripple delete");
}

export function deleteSelected() {
  const id = store.get().selectedClipId;
  if (!id) return;
  store.removeClip(id);
  toast("Clip deleted");
}

export function compoundSelected() {
  const res = store.compoundSelected("Compound clip");
  if (res?.ok) toast(`Compounded ${res.count} clip(s)`, "ok");
  else toast(res?.reason || "Nothing to compound");
}

export function uncompoundSelected() {
  const clip = selectedClip();
  if (!clip?.compoundId) return toast("Clip is not part of a compound");
  store.uncompound(compoundIdOf(clip));
  toast("Compound expanded", "ok");
}

function compoundIdOf(clip) {
  return clip.compoundId;
}

/* ---------------- Backup ring + crash recovery ---------------- */

function loadBackupStore() {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return { versions: [] };
    const data = JSON.parse(raw);
    return { versions: Array.isArray(data.versions) ? data.versions : [] };
  } catch {
    return { versions: [] };
  }
}

function saveBackupStore(bk) {
  try {
    localStorage.setItem(BACKUP_KEY, JSON.stringify(bk));
  } catch {
    /* quota */
  }
}

export function writeBackup(label = "manual") {
  if (settings.get().backup?.enabled === false && label === "auto") return;
  const keep = Math.max(1, Number(settings.get().backup?.keepVersions) || 8);
  const snap = {
    ts: Date.now(),
    label,
    project: JSON.parse(JSON.stringify(store.get())),
  };
  // strip heavy media object URLs that cannot survive reload
  snap.project.media = (snap.project.media || []).map((m) => ({
    ...m,
    url: undefined,
    src: undefined,
    blob: undefined,
  }));
  const bk = loadBackupStore();
  bk.versions.unshift(snap);
  bk.versions = bk.versions.slice(0, keep);
  saveBackupStore(bk);
  return snap;
}

export function restoreLatestBackup() {
  const bk = loadBackupStore();
  if (!bk.versions.length) {
    toast("No backup snapshots found");
    return false;
  }
  const snap = bk.versions[0];
  writeBackup("pre-restore");
  // restore core timeline fields only
  const p = snap.project || {};
  store.set(
    {
      name: p.name || store.get().name,
      clips: p.clips || [],
      tracks: p.tracks || store.get().tracks,
      captions: p.captions || [],
      markers: p.markers || [],
      transcript: p.transcript || null,
      width: p.width || store.get().width,
      height: p.height || store.get().height,
      fps: p.fps || store.get().fps,
    },
    { silent: true }
  );
  store.emit();
  store.save();
  toast(`Restored backup · ${new Date(snap.ts).toLocaleString()}`, "ok");
  return true;
}

export function clearBackups() {
  localStorage.removeItem(BACKUP_KEY);
  toast("Backup history cleared");
}

export function listBackups() {
  return loadBackupStore().versions;
}

function promptCrashRecovery() {
  const bk = loadBackupStore();
  if (!bk.versions.length) return;
  if (settings.get().backup?.recoverPrompt === false) return;
  const latest = bk.versions[0];
  const ageMin = (Date.now() - latest.ts) / 60000;
  // only prompt if backup is newer than the live autosave slot and not from this same minute
  if (ageMin > 24 * 60) return;
  const ok = confirm(
    `Recover unsaved work?\n\nA ${latest.label} backup from ${new Date(latest.ts).toLocaleString()} is available.\n\nOK = restore · Cancel = keep current project`
  );
  if (ok) restoreLatestBackup();
}

/* ---------------- Autosave timer ---------------- */

let autosaveTimer = null;

export function startAutosaveTimer() {
  stopAutosaveTimer();
  const sec = Number(settings.get().autosaveSec) || 0;
  if (sec <= 0) return;
  autosaveTimer = setInterval(() => {
    store.save();
    if (settings.get().backup?.enabled !== false) writeBackup("auto");
  }, sec * 1000);
}

export function stopAutosaveTimer() {
  if (autosaveTimer) {
    clearInterval(autosaveTimer);
    autosaveTimer = null;
  }
}

/* ---------------- SRT caption export ---------------- */

function pad(n, w = 2) {
  return String(n).padStart(w, "0");
}

function srtTime(t) {
  const ms = Math.max(0, Math.round((Number(t) || 0) * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const rest = ms % 1000;
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(rest, 3)}`;
}

export function exportCaptionsSrt() {
  const caps = store.get().captions || [];
  if (!caps.length) {
    toast("No captions to export — generate Auto Captions first");
    return false;
  }
  const body = caps
    .map((c, i) => `${i + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${c.text || ""}\n`)
    .join("\n");
  downloadText(body, (store.get().name || "captions") + ".srt", "application/x-subrip");
  toast(`Exported ${caps.length} caption(s) as .srt`, "ok");
  return true;
}

export function downloadText(text, filename, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------------- Fullscreen + zoom to fit ---------------- */

export function toggleFullscreenPreview() {
  const wrap = document.getElementById("previewWrap") || document.getElementById("previewCanvas")?.parentElement;
  if (!wrap) return;
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
  } else {
    wrap.requestFullscreen?.().catch(() => toast("Fullscreen not available"));
  }
}

export function zoomTimelineToFit() {
  const s = store.get();
  const dur = Math.max(store.sequenceDuration(), 1);
  const panel = document.getElementById("timelinePanel")?.querySelector(".tl-scroll") || document.getElementById("tlScroll");
  const avail = (panel?.clientWidth || 900) - 40;
  // pps scale: timeline zoom slider maps 0.4–4 → px/sec roughly 20*zoom
  const needed = Math.max(0.4, Math.min(4, avail / (dur * 20)));
  setZoom(needed);
  toast("Timeline zoomed to fit", "ok");
}

/* ---------------- Recent projects (names only, localStorage) ---------------- */

export function rememberRecentProject(name) {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    let list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
    list = [{ name, ts: Date.now() }, ...list.filter((x) => x.name !== name)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function listRecentProjects() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function openRecentProjects() {
  let modal = document.getElementById("recentProjectsModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "recentProjectsModal";
    modal.className = "modal-backdrop";
    modal.innerHTML = `
      <div class="modal" role="dialog" aria-label="Recent Projects">
        <header class="modal-head"><h3>Project Library (Filmora)</h3><button type="button" class="icon-btn" id="rpClose">✕</button></header>
        <div class="modal-body"><div id="rpList"></div>
        <p style="font-size:11px;color:var(--muted);margin-top:8px">Recent names stored locally. Full .json import/export lives in Preferences → Project.</p></div>
        <footer class="modal-foot"><button type="button" class="btn ghost" id="rpCancel">Close</button></footer>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector("#rpClose")?.addEventListener("click", () => modal.classList.remove("open"));
    modal.querySelector("#rpCancel")?.addEventListener("click", () => modal.classList.remove("open"));
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("open"); });
    window.addEventListener("keydown", (e) => { if (e.key === "Escape") modal.classList.remove("open"); });
  }
  const list = modal.querySelector("#rpList");
  const recents = listRecentProjects();
  list.innerHTML = "";
  if (!recents.length) {
    list.innerHTML = `<div class="muted-note">No recent projects yet — save or rename this project to pin it here.</div>`;
  } else {
    recents.forEach((r) => {
      const row = document.createElement("div");
      row.className = "lut-row";
      const d = new Date(r.ts).toLocaleString();
      row.innerHTML = `<span class="name"></span><span style="font-size:11px;color:var(--muted)">${d}</span>`;
      row.querySelector(".name").textContent = r.name || "Untitled";
      const open = document.createElement("button");
      open.className = "btn sm";
      open.textContent = "Rename current";
      open.addEventListener("click", () => {
        store.set({ name: r.name });
        store.save();
        toast(`Switched label to “${r.name}”`, "ok");
        modal.classList.remove("open");
      });
      row.appendChild(open);
      list.appendChild(row);
    });
  }
  modal.classList.add("open");
}

export function takeSnapshot() {
  const canvas = document.getElementById("previewCanvas");
  if (!canvas) return toast("Preview not ready");
  try {
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = (store.get().name || "snapshot") + "-snapshot.png";
    a.click();
    const folder = settings.get().folders?.snapshot;
    toast(folder ? `Snapshot saved (folder: ${folder})` : "Snapshot saved to Media downloads", "ok");
  } catch (e) {
    toast("Snapshot failed: " + e.message, "err");
  }
}

/* ---------------- Project Settings dialog ---------------- */

export function openProjectSettings() {
  let modal = document.getElementById("projectSettingsModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "projectSettingsModal";
    modal.className = "modal-backdrop";
    modal.innerHTML = `
      <div class="modal" role="dialog" aria-label="Project Settings">
        <header class="modal-head">
          <h3>Project Settings</h3>
          <button type="button" class="icon-btn" id="psClose" aria-label="Close">✕</button>
        </header>
        <div class="modal-body">
          <label class="field-row"><span>Width</span><input type="number" id="psW" min="16" max="7680" step="2"></label>
          <label class="field-row"><span>Height</span><input type="number" id="psH" min="16" max="4320" step="2"></label>
          <label class="field-row"><span>Frame rate</span>
            <select id="psFps">
              <option>24</option><option>25</option><option selected>30</option>
              <option>50</option><option>60</option><option>120</option>
            </select>
          </label>
          <div class="ps-presets" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
            <button type="button" data-ps="1920x1080">1080p 16:9</button>
            <button type="button" data-ps="1080x1920">9:16 Vertical</button>
            <button type="button" data-ps="1080x1080">1:1 Square</button>
            <button type="button" data-ps="3840x2160">4K 16:9</button>
            <button type="button" data-ps="2560x1080">21:9</button>
          </div>
        </div>
        <footer class="modal-foot">
          <button type="button" class="btn ghost" id="psCancel">Cancel</button>
          <button type="button" class="btn primary" id="psApply">Apply</button>
        </footer>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector("#psClose")?.addEventListener("click", () => modal.classList.remove("open"));
    modal.querySelector("#psCancel")?.addEventListener("click", () => modal.classList.remove("open"));
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("open");
    });
    modal.querySelectorAll("[data-ps]").forEach((b) => {
      b.addEventListener("click", () => {
        const [w, h] = b.dataset.ps.split("x").map(Number);
        const wi = modal.querySelector("#psW");
        const hi = modal.querySelector("#psH");
        if (wi) wi.value = String(w);
        if (hi) hi.value = String(h);
      });
    });
    modal.querySelector("#psApply")?.addEventListener("click", () => {
      const w = Number(modal.querySelector("#psW")?.value) || 1920;
      const h = Number(modal.querySelector("#psH")?.value) || 1080;
      const fps = Number(modal.querySelector("#psFps")?.value) || 30;
      store.setProjectSettings({ width: w, height: h, fps });
      settings.set({ projectDefaults: { width: w, height: h, fps } });
      window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
      toast(`Project ${w}×${h} @ ${fps}fps`, "ok");
      modal.classList.remove("open");
    });
  }
  const s = store.get();
  const w = modal.querySelector("#psW");
  const h = modal.querySelector("#psH");
  const f = modal.querySelector("#psFps");
  if (w) w.value = String(s.width || 1920);
  if (h) h.value = String(s.height || 1080);
  if (f) f.value = String(s.fps || 30);
  modal.classList.add("open");
}

/* ---------------- Event wiring ---------------- */

export function initWorkflows(player) {
  // Clipboard / ripple-delete events dispatched by shortcuts.js
  window.addEventListener("aifimora:copy-clip", () => copySelectedClip());
  window.addEventListener("aifimora:paste-clip", () => pasteClip(player));
  window.addEventListener("aifimora:duplicate-clip", () => duplicateSelectedClip());
  window.addEventListener("aifimora:ripple-delete", () => rippleDeleteSelected());
  window.addEventListener("aifimora:export-srt", () => exportCaptionsSrt());
  window.addEventListener("aifimora:project-settings", () => openProjectSettings());
  window.addEventListener("aifimora:recent-projects", () => openRecentProjects());
  window.addEventListener("aifimora:snapshot", () => takeSnapshot());
  window.addEventListener("aifimora:fullscreen-preview", () => toggleFullscreenPreview());
  window.addEventListener("aifimora:zoom-fit", () => zoomTimelineToFit());

  // Backup buttons in Preferences
  window.addEventListener("aifimora:backup-now", () => {
    writeBackup("manual");
    toast("Backup snapshot written", "ok");
  });
  window.addEventListener("aifimora:backup-restore", () => {
    if (confirm("Restore the latest backup snapshot? Current timeline will be replaced.")) {
      restoreLatestBackup();
    }
  });
  window.addEventListener("aifimora:backup-clear", () => clearBackups());

  // Restart autosave when preference changes
  settings.subscribe(() => startAutosaveTimer());
  startAutosaveTimer();

  // Apply AI credit cap from prefs at boot
  const cap = Number(settings.get().ai?.creditCap);
  if (cap > 0) {
    const s = store.get();
    if (s.credits?.cap !== cap) store.set({ credits: { ...s.credits, cap } }, { silent: true });
  }

  // Apply projectDefaults on first empty project if width still default and prefs differ
  // (actual New Project path is in app.js)

  // Crash recovery prompt after a short delay so UI is ready
  setTimeout(promptCrashRecovery, 600);

  // Remember project name on save
  store.subscribe((s) => {
    if (s?.name) rememberRecentProject(s.name);
  });

  // Persist backup on unload
  window.addEventListener("beforeunload", () => {
    if (settings.get().backup?.enabled !== false) writeBackup("exit");
  });
}
