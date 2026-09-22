/* Synthetic media library + import helpers — with marquee/checkbox multi-select,
   deletable imports, real-file persistence (IndexedDB) and quick preview. */
import { store, DEFAULT_TEXT_STYLE } from "./state.js";

const PALETTES = [
  ["#1a2a4a", "#5b8cff", "#9ec1ff"],
  ["#0f2a24", "#00d4a0", "#7af0d0"],
  ["#2a1a12", "#ff8a4c", "#ffc4a0"],
  ["#1a1030", "#a78bfa", "#d4c4ff"],
  ["#102030", "#38bdf8", "#bae6fd"],
  ["#201818", "#f472b6", "#fbcfe8"],
];

function drawThumb(canvas, seed, label) {
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const p = PALETTES[seed % PALETTES.length];
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, p[0]);
  g.addColorStop(0.55, p[1]);
  g.addColorStop(1, p[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  // abstract shapes
  ctx.globalAlpha = 0.35;
  for (let i = 0; i < 5; i++) {
    const x = ((seed * 37 + i * 71) % 100) / 100 * w;
    const y = ((seed * 53 + i * 29) % 100) / 100 * h;
    const r = 20 + ((seed + i) % 5) * 10;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = p[(i % 2) + 1];
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // scanline texture
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  for (let y = 0; y < h; y += 3) ctx.fillRect(0, y, w, 1);

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.font = `600 14px "Segoe UI", sans-serif`;
  ctx.fillText(label, 10, h - 12);

  // corner mark
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
}

export function makeThumbDataURL(seed, label, w = 320, h = 180) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  drawThumb(c, seed, label);
  return c.toDataURL("image/png");
}

export function seedLibrary() {
  if (store.get().media.length) return;

  const samples = [
    { name: "City Drone", kind: "video", duration: 8, color: "#3d6fd4" },
    { name: "Interview A", kind: "video", duration: 12, color: "#2f6b4f" },
    { name: "Interview B", kind: "video", duration: 10, color: "#6b4f9e" },
    { name: "B-Roll Food", kind: "video", duration: 6, color: "#c45c26" },
    { name: "Music Bed", kind: "audio", duration: 24, color: "#1f7a4d" },
    { name: "VO Draft", kind: "audio", duration: 15, color: "#2a6a8a" },
    { name: "Logo Sting", kind: "video", duration: 3, color: "#5b8cff" },
    { name: "Lower Third", kind: "text", duration: 4, color: "#c9a227" },
  ];

  samples.forEach((s, i) => {
    store.addMedia({
      ...s,
      thumb: makeThumbDataURL(i + 1, s.name),
      generated: false,
      synthetic: true, // demo placeholder — renders a gradient, has no real file
      seed: i + 1,
    });
  });
}

export function addGeneratedMedia({ name, kind = "video", duration = 5, model, prompt }) {
  const seed = Math.floor(Math.random() * 1000);
  return store.addMedia({
    name,
    kind,
    duration,
    color: "#0d9488",
    generated: true,
    model,
    prompt,
    seed,
    thumb: makeThumbDataURL(seed, name),
  });
}

/* ---------------- IndexedDB file persistence ----------------
   Blob: URLs die on reload. We keep the real File/Blob bytes in
   IndexedDB keyed by media id and re-hydrate to fresh blob: URLs. */
const IDB_NAME = "aifilmora-media-db";
const IDB_STORE = "files";

function openMediaDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("no indexedDB"));
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      try {
        req.result.createObjectStore(IDB_STORE);
      } catch { /* exists */ }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("idb open failed"));
  });
}

function idbPutMediaFile(id, blob) {
  return openMediaDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        try {
          const tx = db.transaction(IDB_STORE, "readwrite");
          tx.objectStore(IDB_STORE).put(blob, id);
          tx.oncomplete = () => { try { db.close(); } catch {} resolve(true); };
          tx.onerror = () => { try { db.close(); } catch {} reject(tx.error); };
        } catch (e) { try { db.close(); } catch {} reject(e); }
      })
  ).catch(() => false);
}

function idbGetMediaFile(id) {
  return openMediaDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        try {
          const tx = db.transaction(IDB_STORE, "readonly");
          const rq = tx.objectStore(IDB_STORE).get(id);
          rq.onsuccess = () => { try { db.close(); } catch {} resolve(rq.result || null); };
          rq.onerror = () => { try { db.close(); } catch {} reject(rq.error); };
        } catch (e) { try { db.close(); } catch {} reject(e); }
      })
  );
}

function idbDeleteMediaFiles(ids) {
  const list = Array.isArray(ids) ? ids : [ids];
  if (!list.length) return Promise.resolve(false);
  return openMediaDB().then(
    (db) =>
      new Promise((resolve) => {
        try {
          const tx = db.transaction(IDB_STORE, "readwrite");
          list.forEach((id) => { try { tx.objectStore(IDB_STORE).delete(id); } catch {} });
          tx.oncomplete = () => { try { db.close(); } catch {} resolve(true); };
          tx.onerror = () => { try { db.close(); } catch {} resolve(false); };
        } catch { try { db.close(); } catch {} resolve(false); }
      })
  ).catch(() => false);
}

/** Re-hydrate idb: placeholders to live blob: URLs after reload. */
export async function restoreMediaUrls() {
  const { media } = store.get();
  const pending = media.filter((m) => m?.url && String(m.url).startsWith("idb:"));
  if (!pending.length) return { restored: 0, missing: 0 };
  let restored = 0;
  let missing = 0;
  const next = [...media];
  for (let i = 0; i < next.length; i++) {
    const m = next[i];
    if (!m?.url || !String(m.url).startsWith("idb:")) continue;
    const id = String(m.url).slice(4) || m.id;
    try {
      const blob = await idbGetMediaFile(id);
      if (blob) {
        const url = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob], { type: m.fileType || undefined }));
        next[i] = { ...m, url, _offline: false };
        restored++;
      } else {
        next[i] = { ...m, url: null, _offline: true };
        missing++;
      }
    } catch {
      next[i] = { ...m, url: null, _offline: true };
      missing++;
    }
  }
  store.set({ media: next }, { silent: true });
  store.emit();
  return { restored, missing };
}

if (typeof window !== "undefined") {
  // Keep IndexedDB bytes after delete so Undo can restore the media.
  // (Player element caches are still dropped via player.js listener.)
  window.addEventListener("aifimora:media-removed", () => {});
}

export function bindImport(inputEl) {
  inputEl.addEventListener("change", async () => {
    const files = [...(inputEl.files || [])];
    inputEl.value = "";
    if (!files.length) return;
    await importFileList(files);
  });
}

/** Shared importer: File[] -> media items (used by picker + timeline drop). */
export async function importFileList(files) {
  const list = [...(files || [])];
  if (!list.length) return { imported: [], skipped: 0 };
  let skipped = 0;
  const imported = [];
  for (const file of list) {
    const type = file.type || guessMimeByName(file.name);
    const isVideo = type.startsWith("video");
    const isAudio = type.startsWith("audio");
    const isImage = type.startsWith("image");
    if (!isVideo && !isAudio && !isImage) {
      skipped++;
      continue;
    }

    let duration = isImage ? 4 : 6;
    let thumb = null;
    const url = URL.createObjectURL(file);

    if (isImage) {
      thumb = url;
    } else if (isVideo) {
      try {
        const meta = await probeVideo(url);
        duration = meta.duration;
        thumb = meta.thumb;
      } catch {
        thumb = makeThumbDataURL(Math.floor(Math.random() * 999), file.name);
      }
      if (!Number.isFinite(duration) || duration <= 0) duration = Math.min(60, Math.max(2, file.size / 1_000_000));
    } else {
      try {
        duration = await probeAudio(url, file);
      } catch {
        duration = 6;
      }
      thumb = makeThumbDataURL(Math.floor(Math.random() * 999), file.name);
    }

    const item = store.addMedia({
      name: file.name,
      kind: isAudio ? "audio" : isImage ? "image" : "video",
      duration: Math.max(0.5, Math.round((Number(duration) || 6) * 10) / 10),
      url,
      thumb,
      generated: false,
      fileType: type || null,
      fileSize: file.size || 0,
      _offline: false,
    });
    idbPutMediaFile(item.id, file);
    imported.push(item);
  }
  if (imported.length) {
    store.setSelectedMedia([imported[imported.length - 1].id]);
    toast(
      skipped
        ? `Imported ${imported.length} file${imported.length === 1 ? "" : "s"} · skipped ${skipped}`
        : `Imported ${imported.length} file${imported.length === 1 ? "" : "s"} — drag onto the timeline, double-click to insert`,
      "ok"
    );
  } else {
    toast("No supported media in selection (video / audio / image)", "err");
  }
  return { imported, skipped };
}

function guessMimeByName(name) {
  const ext = String(name || "").split(".").pop()?.toLowerCase() || "";
  if (["mp4", "mov", "m4v", "webm", "mkv", "avi"].includes(ext)) return "video/mp4";
  if (["mp3", "wav", "ogg", "m4a", "flac", "aac"].includes(ext)) return "audio/mpeg";
  if (["png", "jpg", "jpeg", "gif", "bmp", "svg", "webp"].includes(ext)) return "image/png";
  return "";
}

function probeAudio(url, file) {
  return new Promise((resolve) => {
    try {
      const a = document.createElement("audio");
      a.preload = "metadata";
      const timer = setTimeout(() => resolve(6), 4000);
      a.onloadedmetadata = () => {
        clearTimeout(timer);
        resolve(Number.isFinite(a.duration) && a.duration > 0 ? a.duration : 6);
      };
      a.onerror = () => {
        clearTimeout(timer);
        resolve(6);
      };
      a.src = url;
    } catch {
      resolve(6);
    }
  });
}

function probeVideo(url) {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    // @ts-ignore playsInline for thumbnail seek
    v.playsInline = true;
    let settled = false;
    const cleanup = () => {
      v.onloadedmetadata = null;
      v.onseeked = null;
      v.onerror = null;
      v.removeAttribute("src");
      try {
        v.load();
      } catch {
        /* ignore */
      }
    };
    const fail = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err || new Error("video probe failed"));
    };
    const ok = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };
    // Guard against codecs/browsers that never fire metadata events
    const timer = setTimeout(() => fail(new Error("video probe timeout")), 6000);

    v.onloadedmetadata = () => {
      const duration = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 6;
      try {
        v.currentTime = Math.min(0.2, duration / 2);
      } catch {
        clearTimeout(timer);
        ok({ duration, thumb: null });
        return;
      }
      v.onseeked = () => {
        try {
          const c = document.createElement("canvas");
          c.width = 320;
          c.height = 180;
          const ctx = c.getContext("2d");
          ctx.drawImage(v, 0, 0, 320, 180);
          const thumb = c.toDataURL("image/png");
          clearTimeout(timer);
          ok({ duration, thumb });
        } catch (e) {
          clearTimeout(timer);
          ok({ duration, thumb: null });
        }
      };
      // If seek never fires (some codecs), fall back after a beat
      setTimeout(() => {
        if (!settled) {
          clearTimeout(timer);
          ok({ duration, thumb: null });
        }
      }, 2500);
    };
    v.onerror = () => {
      clearTimeout(timer);
      fail(new Error("video load error"));
    };
    v.src = url;
  });
}

export function mediaById(id) {
  return store.get().media.find((m) => m.id === id) || null;
}

// Track last playhead so double-click insert uses the real play position
// (player keeps playhead in a closure, not in the store).
let lastPlayheadTime = 0;
if (typeof window !== "undefined") {
  window.addEventListener("aifimora:playhead", (e) => {
    lastPlayheadTime = e.detail?.time || 0;
  });
}

export function getPlayheadTime() {
  return lastPlayheadTime;
}

/** Delete the current media selection (toolbar / keyboard / context menu). */
export function deleteSelectedMedia() {
  const s = store.get();
  const ids = (s.selectedMediaIds && s.selectedMediaIds.length
    ? s.selectedMediaIds
    : s.selectedMediaId
      ? [s.selectedMediaId]
      : []
  );
  if (!ids.length) {
    toast("Select media first — click, checkbox, or drag a marquee");
    return { ok: false, reason: "Nothing selected" };
  }
  const inUse = s.clips.filter((c) => c.mediaId && ids.includes(c.mediaId)).length;
  const label = ids.length > 1 ? `${ids.length} media items` : (mediaById(ids[0])?.name || "media");
  const ok = window.confirm(
    inUse
      ? `Delete ${label}?\n${inUse} timeline clip${inUse === 1 ? "" : "s"} using it will also be removed.`
      : `Delete ${label} from the media bin?`
  );
  if (!ok) return { ok: false, reason: "Cancelled" };
  const res = store.removeMedias(ids);
  if (res.ok) {
    toast(
      res.removedClips
        ? `Deleted ${res.removed.length} media + ${res.removedClips} clip${res.removedClips === 1 ? "" : "s"}`
        : `Deleted ${res.removed.length} media`,
      "ok"
    );
  } else {
    toast(res.reason || "Delete failed", "err");
  }
  return res;
}

/** Quick preview overlay for imported files (real <video>/<audio>/<img>). */
export function previewMedia(m) {
  if (!m) return;
  closePreview();
  const overlay = document.createElement("div");
  overlay.id = "mediaPreviewOverlay";
  overlay.className = "media-preview-overlay";
  const kind = m.kind || "video";
  let body = "";
  if (kind === "video" && m.url) {
    body = `<video src="${escapeAttr(m.url)}" controls autoplay playsinline style="max-width:min(720px,90vw);max-height:64vh;background:#000;border-radius:8px"></video>`;
  } else if (kind === "audio" && m.url) {
    body = `<audio src="${escapeAttr(m.url)}" controls autoplay style="width:min(480px,86vw)"></audio>`;
  } else if (kind === "image" && (m.url || m.thumb)) {
    body = `<img src="${escapeAttr(m.url || m.thumb)}" alt="" style="max-width:min(720px,90vw);max-height:64vh;border-radius:8px;object-fit:contain;background:#000" />`;
  } else if (m.thumb) {
    body = `<img src="${m.thumb}" alt="" style="max-width:min(720px,90vw);max-height:64vh;border-radius:8px;object-fit:contain;background:#000" />`;
  } else {
    body = `<div style="padding:24px">No preview available for ${escapeHtml(m.name)}</div>`;
  }
  overlay.innerHTML = `
    <div class="media-preview-card" role="dialog" aria-label="Media preview">
      <div class="media-preview-head">
        <strong title="${escapeAttr(m.name)}">${escapeHtml(m.name)}</strong>
        <span>${escapeHtml(kind)} · ${formatDur(m.duration)}${(m._offline || !m.url) && !m.synthetic ? " · file missing — re-import to relink" : ""}</span>
        <button class="btn sm" id="mediaPreviewClose" aria-label="Close preview">✕</button>
      </div>
      <div class="media-preview-body">${body}</div>
      <div class="media-preview-foot">
        <button class="btn sm primary" id="mediaPreviewInsert">Insert at playhead</button>
        <button class="btn sm danger" id="mediaPreviewDelete">Delete media</button>
      </div>
    </div>`;
  overlay.addEventListener("pointerdown", (e) => {
    if (e.target === overlay) closePreview();
  });
  document.body.appendChild(overlay);
  document.getElementById("mediaPreviewClose")?.addEventListener("click", closePreview);
  document.getElementById("mediaPreviewInsert")?.addEventListener("click", () => {
    insertMediaAtPlayhead(m.id);
    closePreview();
  });
  document.getElementById("mediaPreviewDelete")?.addEventListener("click", () => {
    closePreview();
    store.setSelectedMedia([m.id]);
    deleteSelectedMedia();
  });
}

export function closePreview() {
  document.getElementById("mediaPreviewOverlay")?.remove();
}

if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closePreview();
  });
}

export function insertMediaAtPlayhead(mediaId) {
  const m = mediaById(mediaId);
  if (!m) return null;
  const trackId = m.kind === "audio" ? "a1" : m.kind === "text" ? "t1" : "v1";
  const start = Math.round(lastPlayheadTime * 10) / 10;
  const clip = store.addClip({
    mediaId: m.id,
    name: m.name,
    type: m.kind === "audio" ? "audio" : m.kind === "text" ? "text" : "video",
    trackId,
    start,
    duration: m.duration || 4,
    text: m.kind === "text" ? m.name : "",
    textStyle:
      m.kind === "text"
        ? { ...DEFAULT_TEXT_STYLE, content: m.name }
        : undefined,
  });
  window.dispatchEvent(new CustomEvent("aifimora:seek", { detail: { time: start } }));
  window.dispatchEvent(
    new CustomEvent("aifimora:activate-clip", { detail: { clipId: clip.id } })
  );
  toast(`Inserted ${m.name} — editing on preview`);
  return clip;
}

export function renderMediaBin(container, filter = "", cat = "all") {
  if (!container) return;
  container.innerHTML = "";
  container.classList.add("media-bin");
  const state = store.get();
  const { media } = state;
  const selected = new Set(state.selectedMediaIds || (state.selectedMediaId ? [state.selectedMediaId] : []));
  const q = (filter || "").trim().toLowerCase();
  const catOk = (m) => {
    if (!cat || cat === "all") return true;
    if (cat === "ai") return !!(m.generated || m.model);
    return (m.kind || "").toLowerCase() === cat;
  };
  const visible = media.filter(
    (m) =>
      catOk(m) &&
      (!q ||
        m.name.toLowerCase().includes(q) ||
        (m.kind || "").toLowerCase().includes(q) ||
        (m.model || "").toLowerCase().includes(q))
  );

  // Toolbar: select-all checkbox + count + delete (always visible so
  // users discover multi-select + delete without hunting)
  const bar = document.createElement("div");
  bar.className = "media-toolbar";
  const selCount = [...selected].filter((id) => visible.some((m) => m.id === id)).length;
  const allChecked = visible.length > 0 && visible.every((m) => selected.has(m.id));
  bar.innerHTML = `
    <label class="media-select-all" title="Select / deselect all (shown) media">
      <input type="checkbox" id="mediaSelectAll" ${allChecked ? "checked" : ""} aria-label="Select all media" />
      <span>All</span>
    </label>
    <span class="media-count" aria-live="polite">${selCount ? `${selCount} selected` : `${visible.length} item${visible.length === 1 ? "" : "s"}`}</span>
    <span class="media-hint" title="Drag an empty area to marquee-select like Photoshop">drag = marquee</span>
    <button class="btn sm danger" id="mediaDeleteSel" ${selCount ? "" : "disabled"} title="Delete selected media (Del)">Delete${selCount > 1 ? ` (${selCount})` : ""}</button>
  `;
  container.appendChild(bar);
  bar.querySelector("#mediaSelectAll")?.addEventListener("change", (e) => {
    if (e.target.checked) store.setSelectedMedia(visible.map((m) => m.id));
    else store.clearSelectedMedia();
  });
  bar.querySelector("#mediaDeleteSel")?.addEventListener("click", deleteSelectedMedia);

  if (!media.length) {
    const empty = document.createElement("div");
    empty.className = "empty media-empty-cta";
    empty.innerHTML = `<p>No media yet. Import files or generate clips in GenAI Lab.</p>
      <div class="btn-row">
        <button type="button" class="btn sm primary" data-media-cta="import">Import files…</button>
        <button type="button" class="btn sm" data-media-cta="stock">Browse stock</button>
      </div>`;
    empty.querySelector('[data-media-cta="import"]')?.addEventListener("click", () =>
      document.getElementById("btnImport")?.click()
    );
    empty.querySelector('[data-media-cta="stock"]')?.addEventListener("click", () =>
      document.querySelector('#libraryTabs [data-sidebar="assets"]')?.click()
    );
    container.appendChild(empty);
    return;
  }
  if (!visible.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = `No media matches “${filter}”.`;
    container.appendChild(empty);
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "media-select-wrap";
  const grid = document.createElement("div");
  grid.className = "media-grid";
  wrap.appendChild(grid);
  const marquee = document.createElement("div");
  marquee.className = "media-marquee";
  marquee.hidden = true;
  wrap.appendChild(marquee);
  container.appendChild(wrap);

  visible.forEach((m) => {
    const card = document.createElement("div");
    const fileMissing = (m._offline || !m.url) && !m.synthetic;
    card.className = "media-card" + (selected.has(m.id) ? " selected" : "") + (fileMissing ? " is-offline" : "");
    card.dataset.mediaId = m.id;
    card.draggable = true;
    card.tabIndex = 0;
    card.setAttribute("role", "option");
    card.setAttribute("aria-selected", selected.has(m.id) ? "true" : "false");
    card.title = `${m.name} — click select · Ctrl+click multi · double-click insert · right-click more`;
    const thumbSrc = m.thumb || makeThumbDataURL(m.seed || 1, m.name);
    const isSel = selected.has(m.id);
    const playable = (m.kind === "video" || m.kind === "audio") && !!m.url && !m._offline;
    card.innerHTML = `
      <label class="media-check" title="Select this media (multi-select)">
        <input type="checkbox" ${isSel ? "checked" : ""} aria-label="Select ${escapeAttr(m.name)}" />
      </label>
      <img class="media-thumb" alt="" src="${thumbSrc}" draggable="false" />
      ${m.generated ? `<span class="media-badge ai">AI</span>` : `<span class="media-badge">${escapeHtml(m.kind)}${fileMissing ? " · missing" : ""}</span>`}
      ${playable ? `<button class="media-play" title="Preview ${escapeAttr(m.name)}" aria-label="Preview ${escapeAttr(m.name)}">▶</button>` : ""}
      <button class="media-del" title="Delete ${escapeAttr(m.name)}" aria-label="Delete ${escapeAttr(m.name)}">✕</button>
      <div class="media-meta">
        <strong title="${escapeAttr(m.name)}">${escapeHtml(m.name)}</strong>
        <span>${formatDur(m.duration)}${m.model ? " · " + escapeHtml(m.model) : ""}${m.fileSize ? " · " + formatBytes(m.fileSize) : ""}</span>
      </div>
    `;
    // Checkbox toggles multi-select without disturbing others
    card.querySelector(".media-check input")?.addEventListener("click", (e) => {
      e.stopPropagation();
      store.toggleSelectedMedia(m.id);
    });
    // Per-card delete
    card.querySelector(".media-del")?.addEventListener("click", (e) => {
      e.stopPropagation();
      store.setSelectedMedia([m.id]);
      deleteSelectedMedia();
    });
    // Preview button
    card.querySelector(".media-play")?.addEventListener("click", (e) => {
      e.stopPropagation();
      store.setSelectedMedia([m.id]);
      previewMedia(m);
    });
    // Click select: plain = single, Ctrl/Cmd/Shift = toggle/add
    card.addEventListener("click", (e) => {
      if (e.target.closest(".media-check,.media-del,.media-play")) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey) store.toggleSelectedMedia(m.id);
      else store.setSelectedMedia([m.id]);
    });
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        previewMedia(m);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        e.stopPropagation();
        store.setSelectedMedia([m.id]);
        deleteSelectedMedia();
      }
    });
    card.addEventListener("dblclick", (e) => {
      if (e.target.closest(".media-check,.media-del,.media-play")) return;
      insertMediaAtPlayhead(m.id);
    });
    card.addEventListener("dragstart", (e) => {
      // Flag prevents the selection re-render from replacing the drag
      // source mid-gesture (which cancels the drop in Chromium/Electron).
      window.__aifimoraMediaDragging = m.id;
      try {
        e.dataTransfer.setData("text/aifimora-media", m.id);
        // Fallback: some Electron builds drop custom MIME types
        e.dataTransfer.setData("text/plain", `aifimora-media:${m.id}`);
      } catch { /* clipboard formats are best-effort */ }
      e.dataTransfer.effectAllowed = "copy";
    });
    card.addEventListener("dragend", () => {
      if (window.__aifimoraMediaDragging) {
        window.__aifimoraMediaDragging = null;
        // Deferred selection render may be pending (see app.js)
        window.dispatchEvent(new CustomEvent("aifimora:media-dragend"));
      }
    });
    // Right-click menu: preview / insert / delete
    card.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!selected.has(m.id)) store.setSelectedMedia([m.id]);
      closeMediaMenu();
      const menu = document.createElement("div");
      menu.className = "media-ctx";
      menu.id = "mediaCtxMenu";
      menu.innerHTML = `
        <button data-act="preview">▶ Preview</button>
        <button data-act="insert">＋ Insert at playhead</button>
        <button data-act="delete" class="danger">✕ Delete${selected.has(m.id) && selected.size > 1 ? ` (${selected.size})` : ""}</button>
      `;
      document.body.appendChild(menu);
      const x = Math.min(window.innerWidth - 200, e.clientX);
      const y = Math.min(window.innerHeight - 140, e.clientY);
      menu.style.left = x + "px";
      menu.style.top = y + "px";
      menu.querySelector('[data-act="preview"]')?.addEventListener("click", () => { closeMediaMenu(); previewMedia(m); });
      menu.querySelector('[data-act="insert"]')?.addEventListener("click", () => { closeMediaMenu(); insertMediaAtPlayhead(m.id); });
      menu.querySelector('[data-act="delete"]')?.addEventListener("click", () => { closeMediaMenu(); deleteSelectedMedia(); });
      const away = (ev) => {
        if (!menu.contains(ev.target)) {
          closeMediaMenu();
          document.removeEventListener("pointerdown", away, true);
        }
      };
      setTimeout(() => document.addEventListener("pointerdown", away, true), 0);
    });
    grid.appendChild(card);
  });

  // Photoshop-style marquee: drag empty bin area to select intersecting cards
  let mz = null;
  wrap.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest(".media-card,.media-toolbar,.btn,input,button")) return;
    const rect = wrap.getBoundingClientRect();
    mz = {
      x0: e.clientX - rect.left + wrap.scrollLeft,
      y0: e.clientY - rect.top + wrap.scrollTop,
      rect,
      additive: !!(e.ctrlKey || e.metaKey || e.shiftKey),
      id: e.pointerId,
    };
    try { wrap.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    marquee.hidden = false;
    positionMarquee(marquee, 0, 0, 0, 0, wrap);
    e.preventDefault();
  });
  wrap.addEventListener("pointermove", (e) => {
    if (!mz) return;
    const rect = wrap.getBoundingClientRect();
    const x1 = e.clientX - rect.left + wrap.scrollLeft;
    const y1 = e.clientY - rect.top + wrap.scrollTop;
    const x = Math.min(mz.x0, x1);
    const y = Math.min(mz.y0, y1);
    const w = Math.abs(x1 - mz.x0);
    const h = Math.abs(y1 - mz.y0);
    positionMarquee(marquee, x, y, w, h, wrap);
    // Hit-test cards in viewport coords
    const mx0 = Math.min(mz.x0, x1);
    const mx1 = Math.max(mz.x0, x1);
    const my0 = Math.min(mz.y0, y1);
    const my1 = Math.max(mz.y0, y1);
    grid.querySelectorAll(".media-card").forEach((card) => {
      const cr = card.getBoundingClientRect();
      const wr = wrap.getBoundingClientRect();
      const cx0 = cr.left - wr.left + wrap.scrollLeft;
      const cx1 = cr.right - wr.left + wrap.scrollLeft;
      const cy0 = cr.top - wr.top + wrap.scrollTop;
      const cy1 = cr.bottom - wr.top + wrap.scrollTop;
      const hit = cx0 < mx1 && cx1 > mx0 && cy0 < my1 && cy1 > my0;
      card.classList.toggle("marquee-hit", hit);
    });
  });
  const endMarquee = (e) => {
    if (!mz) return;
    const hits = [...grid.querySelectorAll(".media-card.marquee-hit")].map((c) => c.dataset.mediaId);
    grid.querySelectorAll(".media-card.marquee-hit").forEach((c) => c.classList.remove("marquee-hit"));
    marquee.hidden = true;
    const z = mz;
    mz = null;
    // Click without drag on empty area = clear selection
    if (!hits.length) {
      const rect = wrap.getBoundingClientRect();
      const moved = e && Math.hypot((e.clientX - rect.left + wrap.scrollLeft) - z.x0, (e.clientY - rect.top + wrap.scrollTop) - z.y0) > 4;
      if (!moved && !z.additive) store.clearSelectedMedia();
      return;
    }
    if (z.additive) {
      const cur = new Set(store.get().selectedMediaIds || []);
      hits.forEach((id) => cur.add(id));
      store.setSelectedMedia([...cur]);
    } else {
      store.setSelectedMedia(hits);
    }
  };
  wrap.addEventListener("pointerup", endMarquee);
  wrap.addEventListener("pointercancel", () => { mz = null; marquee.hidden = true; });
}

function positionMarquee(el, x, y, w, h, wrap) {
  el.style.left = (x - wrap.scrollLeft) + "px";
  el.style.top = (y - wrap.scrollTop) + "px";
  el.style.width = w + "px";
  el.style.height = h + "px";
}

function closeMediaMenu() {
  document.getElementById("mediaCtxMenu")?.remove();
}

if (typeof window !== "undefined") {
  document.addEventListener("pointerdown", (e) => {
    if (!e.target.closest?.("#mediaCtxMenu")) closeMediaMenu();
  }, true);
}

function formatDur(d) {
  const s = Math.round(d);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `00:${mm}:${ss}`;
}

function formatBytes(n) {
  const v = Number(n) || 0;
  if (v < 1024) return `${v} B`;
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(0)} KB`;
  return `${(v / 1024 / 1024).toFixed(1)} MB`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

function toast(msg, kind) {
  window.dispatchEvent(new CustomEvent("aifimora:toast", { detail: { msg, kind } }));
}

export { toast, escapeHtml, formatDur, drawThumb };
