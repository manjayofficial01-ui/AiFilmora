/* filmora-parity.js — round 5: make the shell behave like Filmora 14/15.
 *
 *  • Undo / Redo buttons disable + show the next action name (Filmora Edit menu)
 *  • Source monitor actually previews the selected media item
 *  • Project Info thumbnail copies the program monitor
 *  • Split Screen library (Filmora top-level tab) applies real fx.split layouts
 *  • First-run aspect chips (16:9 / 9:16 / 1:1 / 21:9) like Filmora's start page
 *  • Marker at playhead (timeline toolbar)
 */
import { store, DEFAULT_FX } from "./state.js";
import { mediaById, makeThumbDataURL, toast } from "./media.js";
let getVideoEl = () => null;
import("./player.js").then((m) => { getVideoEl = m.getVideoEl || getVideoEl; }).catch(() => {});

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------------- Undo / Redo UI -------------------------------------------------- */
export function bindUndoUI() {
  const sync = () => {
    const canU = store.canUndo();
    const canR = store.canRedo();
    const uLabel = store.peekUndoLabel();
    const rLabel = store.peekRedoLabel();
    $$('[data-edit="undo"], #btnUndo').forEach((btn) => {
      btn.disabled = !canU;
      const base = uLabel ? `Undo ${uLabel}` : "Undo";
      btn.title = canU ? `${base} (Ctrl+Z)` : "Nothing to undo";
      btn.setAttribute("aria-label", btn.title);
      if (btn.closest(".fm-pop")) btn.textContent = base;
    });
    $$('[data-edit="redo"], #btnRedo').forEach((btn) => {
      btn.disabled = !canR;
      const base = rLabel ? `Redo ${rLabel}` : "Redo";
      btn.title = canR ? `${base} (Ctrl+Y)` : "Nothing to redo";
      btn.setAttribute("aria-label", btn.title);
      if (btn.closest(".fm-pop")) btn.textContent = base;
    });
    const last = $("#statLastAction");
    if (last) last.textContent = uLabel ? `Last: ${uLabel}` : "";
  };
  store.subscribe(sync);
  window.addEventListener("aifimora:undo", sync);
  window.addEventListener("aifimora:redo", sync);
  sync();
}

/* ---------------- Source monitor (Filmora Timeline / Source tabs) ----------------- */
let sourceImg = null;
let sourceImgUrl = "";

function coverDraw(ctx, src, w, h) {
  const sw = src.videoWidth || src.naturalWidth || src.width || 1;
  const sh = src.videoHeight || src.naturalHeight || src.height || 1;
  const scale = Math.max(w / sw, h / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  ctx.drawImage(src, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

export function renderSourceMonitor(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = "#0a0d0f";
  ctx.fillRect(0, 0, w, h);

  const sel = store.get().selectedMediaId || store.get().selectedMediaIds?.[0];
  const m = sel ? mediaById(sel) : null;
  if (!m) {
    ctx.fillStyle = "#959ca2";
    ctx.font = "600 16px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Source · select a media item", w / 2, h / 2 - 8);
    ctx.fillStyle = "#6c7585";
    ctx.font = "12px Segoe UI";
    ctx.fillText("Click a thumbnail in Media, or double-click to insert it", w / 2, h / 2 + 16);
    return;
  }

  const v = m.kind === "video" ? getVideoEl(m) : null;
  if (v && (v.readyState >= 2) && (v.videoWidth || 0) > 0) {
    coverDraw(ctx, v, w, h);
  } else if (m.kind === "image" && m.url) {
    paintStill(ctx, w, h, m.url, m);
  } else if (m.thumb) {
    paintStill(ctx, w, h, m.thumb, m);
  } else {
    const url = makeThumbDataURL(m.seed || 1, m.name);
    paintStill(ctx, w, h, url, m);
  }

  ctx.fillStyle = "rgba(10,13,15,0.72)";
  ctx.fillRect(0, h - 28, w, 28);
  ctx.fillStyle = "#f0f8fe";
  ctx.font = "600 11px Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(m.name, 10, h - 10);
  ctx.textAlign = "right";
  ctx.fillStyle = "#55e5c5";
  ctx.fillText((m.kind || "clip").toUpperCase(), w - 10, h - 10);
}

function paintStill(ctx, w, h, url, m) {
  if (sourceImg && sourceImgUrl === url && sourceImg.complete && sourceImg.naturalWidth) {
    coverDraw(ctx, sourceImg, w, h);
    return;
  }
  if (sourceImgUrl !== url) {
    sourceImg = new Image();
    sourceImgUrl = url;
    sourceImg.onload = () => {
      const c = document.getElementById("sourceCanvas");
      if (c && !c.hidden) renderSourceMonitor(c);
    };
    sourceImg.src = url;
  }
  // placeholder while loading
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, m.color || "#1e3a5f");
  g.addColorStop(1, "#0a1020");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#c3cad0";
  ctx.font = "600 14px Segoe UI";
  ctx.textAlign = "center";
  ctx.fillText(m.name, w / 2, h / 2);
}

export function bindSourceMonitor() {
  const canvas = $("#sourceCanvas");
  if (!canvas) return;
  const paint = () => {
    if (canvas.hidden) return;
    renderSourceMonitor(canvas);
  };
  store.subscribe(paint);
  window.addEventListener("aifimora:playhead", paint);
  window.addEventListener("aifimora:frame", paint);
}

/* ---------------- Project thumbnail = live program monitor ----------------------- */
export function bindProjectThumb() {
  const paint = () => {
    const c = $("#piThumb");
    const src = $("#previewCanvas");
    if (!c || !src || !src.width) return;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#0a0d0f";
    ctx.fillRect(0, 0, c.width, c.height);
    try {
      ctx.drawImage(src, 0, 0, c.width, c.height);
    } catch {
      /* tainted canvas — fall back to label */
      const s = store.get();
      ctx.fillStyle = "#c3cad0";
      ctx.font = "600 11px Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.name || "Untitled", c.width / 2, c.height / 2);
    }
  };
  window.addEventListener("aifimora:frame", paint);
  store.subscribe(() => setTimeout(paint, 40));
  setTimeout(paint, 500);
}

/* ---------------- Split Screen library (Filmora top-level tab) ------------------- */
const SPLIT_TEMPLATES = [
  { id: "side", label: "Side by Side", desc: "Two clips split down the middle", ico: "▥" },
  { id: "pip", label: "Picture-in-Picture", desc: "Small overlay in the corner", ico: "▣" },
  { id: "grid4", label: "2 × 2 Grid", desc: "Four-up split screen", ico: "▦" },
  { id: "none", label: "Clear layout", desc: "Remove split-screen chrome", ico: "✕" },
];

function applySplit(mode) {
  const clip = store.getClip(store.get().selectedClipId);
  if (!clip || clip.type === "audio" || clip.type === "text") {
    toast("Select a video clip on the timeline first", "err");
    return;
  }
  if (store.get().tracks.find((t) => t.id === clip.trackId)?.locked) {
    toast("Unlock the track first", "err");
    return;
  }
  store.updateClip(clip.id, { fx: { ...(clip.fx || DEFAULT_FX), split: mode } }, { undo: true });
  window.__aifimoraPlayer?.render?.();
  toast(mode === "none" ? "Split screen cleared" : `Split screen · ${mode}`, "ok");
}

function ensureSplitView() {
  /* Fold into Effects so we do not add a 7th library tab (icon-compact asserts 6). */
  const effects = $("#side-effects .panel-body");
  if (!effects || $("#splitGrid")) return $("#splitGrid")?.closest(".sidebar-view") || $("#side-effects");
  const wrap = document.createElement("div");
  wrap.id = "splitSection";
  wrap.innerHTML = `<div class="section-title">Split Screen</div>
    <p class="library-note">Filmora layouts. Select a video clip, then click a template — a layout guide paints on the program monitor.</p>
    <div class="split-grid" id="splitGrid"></div>`;
  effects.append(wrap);
  const grid = wrap.querySelector("#splitGrid");
  SPLIT_TEMPLATES.forEach((t) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "template-card split-card";
    card.dataset.split = t.id;
    card.innerHTML = `<span class="template-ico">${t.ico}</span><span class="template-txt"><strong>${t.label}</strong><span>${t.desc}</span></span>`;
    card.addEventListener("click", () => applySplit(t.id));
    grid.append(card);
  });
  return $("#side-effects");
}

function ensureSplitTab() {
  /* Intentionally a no-op: Split Screen lives under Effects. */
}

/* ---------------- First-run aspect chips ----------------------------------------- */
function setAspect(value) {
  const sel = $("#previewAspect");
  if (!sel) return;
  sel.value = value;
  sel.dispatchEvent(new Event("change", { bubbles: true }));
}

export function bindFirstRunAspects() {
  document.querySelectorAll("[data-fr-aspect]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll("[data-fr-aspect]").forEach((b) => b.classList.toggle("active", b === btn));
      setAspect(btn.dataset.frAspect);
    });
  });
  $("#frEmpty")?.addEventListener("click", () => {
    const active = document.querySelector("[data-fr-aspect].active");
    if (active) setAspect(active.dataset.frAspect);
  });
}

/* ---------------- Marker at playhead --------------------------------------------- */
export function bindMarkerTool() {
  const add = () => {
    const t = window.__aifimoraPlayer?.getTime?.() ?? 0;
    const markers = [...(store.get().markers || [])];
    markers.push({ t, name: `M${markers.length + 1}` });
    store.pushUndo("Add marker");
    store.set({ markers });
    store.save();
    toast(`Marker at ${t.toFixed(2)}s`, "ok");
  };
  $("#btnMarker")?.addEventListener("click", add);
}

/* ---------------- boot ----------------------------------------------------------- */
export function initFilmoraParity() {
  bindUndoUI();
  bindSourceMonitor();
  bindProjectThumb();
  ensureSplitView();
  ensureSplitTab();
  bindFirstRunAspects();
  bindMarkerTool();
}
