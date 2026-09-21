/* Filmora-style on-canvas edit: single text source + 8-handle resize */
import { store, DEFAULT_TEXT_STYLE } from "./state.js";
import { toast } from "./media.js";

let overlay = null;
let box = null;
let labelEl = null;
let textEl = null;
let activeClipId = null;
let drag = null;
let editingInline = false;

/** Player skips drawing this text clip while the HTML overlay owns it. */
export function getEditingTextClipId() {
  return activeClipId;
}

function ensureOverlay(wrap) {
  if (overlay && overlay.isConnected) return overlay;
  overlay = document.createElement("div");
  overlay.className = "canvas-edit-layer";
  const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"]
    .map((dir) => `<div class="canvas-edit-handle h-${dir}" data-dir="${dir}" title="Resize"></div>`)
    .join("");
  overlay.innerHTML = `
    <div class="canvas-edit-box" id="canvasEditBox" tabindex="0">
      <div class="canvas-edit-label" id="canvasEditLabel"></div>
      <div class="canvas-edit-text" id="canvasEditText"></div>
      ${handles}
    </div>
  `;
  wrap.appendChild(overlay);
  box = overlay.querySelector("#canvasEditBox");
  labelEl = overlay.querySelector("#canvasEditLabel");
  textEl = overlay.querySelector("#canvasEditText");
  bindBox();
  return overlay;
}

function hide() {
  if (overlay) overlay.classList.remove("visible");
  if (activeClipId) {
    activeClipId = null;
    // force player repaint so canvas text returns
    window.dispatchEvent(new CustomEvent("aifimora:canvas-edit-hide"));
  }
}

function show() {
  overlay?.classList.add("visible");
}

function clipUnderPlayhead(time) {
  const s = store.get();
  const clip = s.clips.find((c) => c.id === s.selectedClipId);
  if (!clip) return null;
  // Shape clips use a shape overlay, not the text editor box
  if (clip.shape) return null;
  if (!(clip.type === "text" || clip.textStyle)) return null;
  if (time < clip.start || time >= clip.start + clip.duration) return null;
  return clip;
}

function boxMetricsFromClip(clip, canvas) {
  const ts = { ...DEFAULT_TEXT_STYLE, ...(clip.textStyle || {}) };
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  const size = Math.max(12, (ts.size || 42) * (ch / 720));
  let x = cw * (ts.x ?? 0.5);
  let y = ch * (ts.y ?? 0.5);
  if (ts.pos === "center") {
    x = cw * 0.5;
    y = ch * (ts.y ?? 0.5);
  } else if (ts.pos === "lower") y = ch * (ts.y ?? 0.82);
  else if (ts.pos === "top") y = ch * (ts.y ?? 0.22);

  const raw = (ts.content || clip.text || "Title").trim() || "Title";
  const content = ts.uppercase ? raw.toUpperCase() : raw;
  const lines = content.split("\n");
  const approx = size * 0.56;
  const longest = Math.max(4, ...lines.map((l) => l.length));
  const tw = Math.min(cw * 0.92, Math.max(size * 2.2, approx * longest + size * 0.6));
  const th = Math.max(size * 1.45, size * 1.22 * lines.length + size * 0.25);
  return { x, y, tw, th, size, content, ts, cw, ch };
}

function styleBoxFromClip(clip, canvas) {
  if (!box || !canvas) return;
  const m = boxMetricsFromClip(clip, canvas);
  box.style.left = `${Math.round(m.x - m.tw / 2)}px`;
  box.style.top = `${Math.round(m.y - m.th / 2)}px`;
  box.style.width = `${Math.round(m.tw)}px`;
  box.style.height = `${Math.round(m.th)}px`;
  box.style.fontSize = `${Math.round(m.size)}px`;
  box.style.fontWeight = String(m.ts.weight || 600);
  box.style.fontFamily = `"${m.ts.font || "Segoe UI"}", "Segoe UI", sans-serif`;
  box.style.color = m.ts.color || "#fff";
  box.style.background = m.ts.bg && m.ts.bg !== "rgba(0,0,0,0)" ? m.ts.bg : "transparent";
  box.style.textAlign = m.ts.align || "center";
  box.style.justifyContent =
    m.ts.align === "left" ? "flex-start" : m.ts.align === "right" ? "flex-end" : "center";
  box.style.letterSpacing = `${m.ts.letterSpacing || 0}px`;
  box.style.textShadow = m.ts.shadow !== false ? "0 2px 8px rgba(0,0,0,0.65)" : "none";
  if (labelEl) labelEl.textContent = clip.name || "Text";
  if (textEl && !editingInline) {
    textEl.textContent = m.content;
  }
}

function canvasMetrics() {
  const canvas = document.getElementById("previewCanvas");
  if (!canvas) return null;
  return { canvas, rect: canvas.getBoundingClientRect(), w: canvas.clientWidth, h: canvas.clientHeight };
}

function commitStyle(patch) {
  if (!activeClipId) return;
  store.updateClip(activeClipId, { textStyle: patch });
}

function bindBox() {
  box.addEventListener("pointerdown", (e) => {
    const dir = e.target.dataset?.dir;
    if (dir) return; // handled below on handle el
    if (editingInline) return;
    e.preventDefault();
    e.stopPropagation();
    const m = canvasMetrics();
    const clip = store.getClip(activeClipId);
    if (!m || !clip) return;
    const ts = { ...DEFAULT_TEXT_STYLE, ...(clip.textStyle || {}) };
    drag = {
      mode: "move",
      startX: e.clientX,
      startY: e.clientY,
      origX: ts.x ?? 0.5,
      origY: ts.y ?? 0.5,
      canvasW: m.w,
      canvasH: m.h,
    };
    try {
      box.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    box.classList.add("dragging");
    store.pushUndo("Move text");
  });

  overlay.querySelectorAll(".canvas-edit-handle").forEach((h) => {
    h.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const clip = store.getClip(activeClipId);
      if (!clip) return;
      const ts = { ...DEFAULT_TEXT_STYLE, ...(clip.textStyle || {}) };
      const m = canvasMetrics();
      const br = box.getBoundingClientRect();
      drag = {
        mode: "resize",
        dir: h.dataset.dir,
        startX: e.clientX,
        startY: e.clientY,
        origSize: ts.size || 42,
        origX: ts.x ?? 0.5,
        origY: ts.y ?? 0.5,
        boxW: br.width,
        boxH: br.height,
        canvasW: m.w,
        canvasH: m.h,
      };
      try {
        h.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      box.classList.add("dragging");
      store.pushUndo("Resize text");
    });
  });

  window.addEventListener("pointermove", (e) => {
    if (!drag || !activeClipId) return;
    const clip = store.getClip(activeClipId);
    if (!clip) return;
    const canvas = document.getElementById("previewCanvas");
    if (!canvas) return;

    if (drag.mode === "move") {
      const dx = (e.clientX - drag.startX) / drag.canvasW;
      const dy = (e.clientY - drag.startY) / drag.canvasH;
      const x = Math.min(0.96, Math.max(0.04, drag.origX + dx));
      const y = Math.min(0.96, Math.max(0.04, drag.origY + dy));
      store.updateClip(activeClipId, { textStyle: { pos: "custom", x, y } }, { silent: true });
      styleBoxFromClip(store.getClip(activeClipId), canvas);
      window.dispatchEvent(new CustomEvent("aifimora:text-moved", { detail: { x, y } }));
      return;
    }

    if (drag.mode === "resize") {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const dir = drag.dir || "se";
      // scale factor from the dominant axis of this handle
      let delta = 0;
      if (dir.includes("e")) delta += dx * 0.4;
      if (dir.includes("w")) delta -= dx * 0.4;
      if (dir.includes("s")) delta += dy * 0.4;
      if (dir.includes("n")) delta -= dy * 0.4;
      if (dir === "n" || dir === "s") delta = dy * (dir === "s" ? 0.45 : -0.45);
      if (dir === "e" || dir === "w") delta = dx * (dir === "e" ? 0.45 : -0.45);

      const size = Math.min(180, Math.max(14, Math.round(drag.origSize + delta)));
      store.updateClip(activeClipId, { textStyle: { size } }, { silent: true });
      styleBoxFromClip(store.getClip(activeClipId), canvas);
      window.dispatchEvent(new CustomEvent("aifimora:text-resized", { detail: { size } }));
    }
  });

  const end = () => {
    if (!drag) return;
    drag = null;
    box.classList.remove("dragging");
    store.save();
  };
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);

  // Double-click → inline edit (single text source: overlay only)
  box.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    if (!textEl) return;
    editingInline = true;
    textEl.contentEditable = "true";
    textEl.focus();
    try {
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(textEl);
      sel?.removeAllRanges();
      sel?.addRange(range);
    } catch {
      /* ignore */
    }
    store.pushUndo("Edit text");

    const commit = () => {
      editingInline = false;
      textEl.contentEditable = "false";
      const val = textEl.innerText.replace(/\n{3,}/g, "\n\n").trim() || "Title";
      store.updateClip(activeClipId, {
        textStyle: { content: val },
        text: val,
        name: val.split("\n")[0].slice(0, 28),
      });
      window.dispatchEvent(new CustomEvent("aifimora:text-edited"));
    };
    textEl.addEventListener("blur", commit, { once: true });
    textEl.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" || (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey))) {
        ev.preventDefault();
        textEl.blur();
      }
      ev.stopPropagation();
    });
  });
}

export function openEditorForClip(clip) {
  if (!clip) return;
  // Shapes: stay in Library → Shapes (no text editor)
  if (clip.shape) {
    document.querySelector('[data-sidebar="shapes"]')?.click();
    window.dispatchEvent(new CustomEvent("aifimora:shape-selected", { detail: { clipId: clip.id } }));
    return;
  }
  const speedOpen = document.querySelector('[data-inspector="speed"]')?.classList.contains("active");
  if (clip.type === "text" || clip.textStyle) {
    document.querySelector('[data-inspector="textpanel"]')?.click();
  } else if (clip.freeze) {
    document.querySelector('[data-inspector="speed"]')?.click();
  } else if (speedOpen && clip.type !== "audio" && clip.type !== "gen" && clip.type !== "ai") {
    return;
  } else if (clip.type === "audio") {
    document.querySelector('[data-inspector="volume"]')?.click();
  } else if (clip.type === "gen" || clip.type === "ai") {
    document.querySelector('[data-inspector="lab"]')?.click();
  } else {
    document.querySelector('[data-inspector="fx"]')?.click();
  }
}

export function initCanvasEdit() {
  const wrap = document.querySelector(".preview-wrap");
  if (!wrap) return;
  ensureOverlay(wrap);

  const sync = () => {
    const time = window.__aifimoraPlayhead || 0;
    const clip = clipUnderPlayhead(time);
    const canvas = document.getElementById("previewCanvas");
    if (!clip || !canvas || editingInline) {
      if (!editingInline) hide();
      return;
    }
    const prev = activeClipId;
    activeClipId = clip.id;
    show();
    styleBoxFromClip(clip, canvas);
    if (prev !== activeClipId) {
      window.dispatchEvent(new CustomEvent("aifimora:canvas-edit-show"));
    }
  };

  window.addEventListener("aifimora:playhead", sync);
  window.addEventListener("aifimora:layout", sync);
  window.addEventListener("aifimora:canvas-edit-hide", () => {
    document.getElementById("previewCanvas") && window.dispatchEvent(new CustomEvent("aifimora:need-render"));
  });
  window.addEventListener("aifimora:text-edited", () => {
    editingInline = false;
    sync();
    document.querySelector('[data-inspector="textpanel"]')?.click();
  });
  window.addEventListener("aifimora:activate-clip", (e) => {
    const clip = store.getClip(e.detail?.clipId);
    if (clip) {
      store.set({ selectedClipId: clip.id });
      openEditorForClip(clip);
      sync();
    }
  });
  store.subscribe(() => {
    if (drag || editingInline) return;
    sync();
  });
  sync();
}

export function activateClipOnCanvas(clip, player) {
  if (!clip || !player) return;
  const t = window.__aifimoraPlayhead || 0;
  let seekTo = clip.start;
  if (!(t >= clip.start && t < clip.start + clip.duration)) {
    seekTo = clip.start + Math.min(0.12, clip.duration / 2);
  }
  player.seek(seekTo);
  store.set({ selectedClipId: clip.id });
  openEditorForClip(clip);
  if (clip.type === "text" || clip.textStyle) {
    toast("Drag to move · 8 handles to resize · double-click to type", "ok");
  } else if (clip.type === "audio") {
    toast("Opened audio / FX for this clip");
  } else {
    toast(`Editing “${clip.name}”`);
  }
}
