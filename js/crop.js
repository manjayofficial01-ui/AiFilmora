/* Filmora-style crop overlay on the program monitor */
import { store } from "./state.js";
import { toast } from "./media.js";

let overlay = null;
let box = null;
let active = false;
let clipId = null;
let drag = null;

function ensure(wrap) {
  if (overlay?.isConnected) return overlay;
  overlay = document.createElement("div");
  overlay.className = "crop-layer";
  const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"]
    .map((d) => `<div class="crop-handle h-${d}" data-dir="${d}"></div>`)
    .join("");
  overlay.innerHTML = `
    <div class="crop-shade"></div>
    <div class="crop-box" id="cropBox" tabindex="0">
      <div class="crop-label">Crop</div>
      ${handles}
    </div>
    <div class="crop-actions">
      <button type="button" class="btn sm" id="btnCropReset">Reset</button>
      <button type="button" class="btn sm primary" id="btnCropDone">Done</button>
    </div>
  `;
  wrap.appendChild(overlay);
  box = overlay.querySelector("#cropBox");
  bind();
  return overlay;
}

function getCanvas() {
  return document.getElementById("previewCanvas");
}

function canvasRect() {
  const c = getCanvas();
  if (!c) return null;
  return c.getBoundingClientRect();
}

function getCrop() {
  const clip = store.getClip(clipId);
  const fx = clip?.fx || {};
  return { x: 0, y: 0, w: 1, h: 1, ...(fx.crop || {}) };
}

function paint() {
  if (!box || !active) return;
  const c = getCanvas();
  if (!c) return;
  const wr = overlay.parentElement.getBoundingClientRect();
  const cr = c.getBoundingClientRect();
  const ox = cr.left - wr.left;
  const oy = cr.top - wr.top;
  const crop = getCrop();
  const x = ox + crop.x * cr.width;
  const y = oy + crop.y * cr.height;
  const w = crop.w * cr.width;
  const h = crop.h * cr.height;
  box.style.left = `${x}px`;
  box.style.top = `${y}px`;
  box.style.width = `${w}px`;
  box.style.height = `${h}px`;

  const shade = overlay.querySelector(".crop-shade");
  if (shade) {
    shade.style.clipPath = `polygon(
      0% 0%, 100% 0%, 100% 100%, 0% 100%,
      0% 0%,
      ${ox + crop.x * cr.width}px ${oy + crop.y * cr.height}px,
      ${ox + crop.x * cr.width}px ${oy + (crop.y + crop.h) * cr.height}px,
      ${ox + (crop.x + crop.w) * cr.width}px ${oy + (crop.y + crop.h) * cr.height}px,
      ${ox + (crop.x + crop.w) * cr.width}px ${oy + crop.y * cr.height}px,
      ${ox + crop.x * cr.width}px ${oy + crop.y * cr.height}px
    )`;
  }
}

function setCrop(patch) {
  const cur = getCrop();
  let { x, y, w, h } = { ...cur, ...patch };
  w = Math.min(1, Math.max(0.08, w));
  h = Math.min(1, Math.max(0.08, h));
  x = Math.min(1 - w, Math.max(0, x));
  y = Math.min(1 - h, Math.max(0, y));
  store.updateClip(clipId, { fx: { crop: { x, y, w, h } } }, { silent: true });
  paint();
}

function bind() {
  overlay.querySelector("#btnCropDone")?.addEventListener("click", () => {
    store.save();
    stop();
    toast("Crop applied", "ok");
  });
  overlay.querySelector("#btnCropReset")?.addEventListener("click", () => {
    store.pushUndo("Reset crop");
    store.updateClip(clipId, { fx: { crop: { x: 0, y: 0, w: 1, h: 1 } } });
    paint();
    toast("Crop reset", "ok");
  });

  box.addEventListener("pointerdown", (e) => {
    const dir = e.target.dataset?.dir;
    e.preventDefault();
    e.stopPropagation();
    const cr = canvasRect();
    const crop = getCrop();
    drag = {
      mode: dir ? "resize" : "move",
      dir: dir || "",
      startX: e.clientX,
      startY: e.clientY,
      crop: { ...crop },
      cw: cr?.width || 1,
      ch: cr?.height || 1,
    };
    try {
      (dir ? e.target : box).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    box.classList.add("dragging");
  });

  window.addEventListener("pointermove", (e) => {
    if (!drag || !active) return;
    const dx = (e.clientX - drag.startX) / drag.cw;
    const dy = (e.clientY - drag.startY) / drag.ch;
    const c0 = drag.crop;
    if (drag.mode === "move") {
      setCrop({ x: c0.x + dx, y: c0.y + dy });
      return;
    }
    let { x, y, w, h } = c0;
    const d = drag.dir;
    if (d.includes("e")) w = c0.w + dx;
    if (d.includes("w")) {
      x = c0.x + dx;
      w = c0.w - dx;
    }
    if (d.includes("s")) h = c0.h + dy;
    if (d.includes("n")) {
      y = c0.y + dy;
      h = c0.h - dy;
    }
    setCrop({ x, y, w, h });
  });

  const end = () => {
    if (!drag) return;
    drag = null;
    box?.classList.remove("dragging");
    store.save();
  };
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);

  window.addEventListener("aifimora:layout", () => active && paint());
  window.addEventListener("aifimora:playhead", () => active && paint());
  window.addEventListener("aifimora:need-render", () => active && paint());
}

function start(id) {
  const wrap = document.querySelector(".preview-wrap");
  if (!wrap) return;
  ensure(wrap);
  clipId = id;
  active = true;
  overlay.classList.add("visible");
  const btn = document.getElementById("btnCrop");
  if (btn) {
    btn.classList.add("active");
    btn.setAttribute("aria-pressed", "true");
  }
  store.pushUndo("Crop");
  paint();
  toast("Drag crop edges · Done applies", "ok");
}

function stop() {
  active = false;
  clipId = null;
  overlay?.classList.remove("visible");
  const btn = document.getElementById("btnCrop");
  if (btn) {
    btn.classList.remove("active");
    btn.setAttribute("aria-pressed", "false");
  }
  window.dispatchEvent(new CustomEvent("aifimora:crop-closed"));
}

export function initCrop() {
  window.addEventListener("aifimora:toggle-crop", (e) => {
    const id = e.detail?.clipId;
    if (active && clipId === id) stop();
    else if (id) start(id);
  });
  store.subscribe(() => {
    if (active && clipId && !store.getClip(clipId)) stop();
    if (active) paint();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && active) stop();
  });
}

export function isCropActive() {
  return active;
}
