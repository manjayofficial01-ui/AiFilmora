/* Library → Shapes (Filmora Drawing Tools + Stickers hybrid) */
import { store, DEFAULT_TEXT_STYLE } from "./state.js";
import { toast } from "./media.js";

const USER_KEY = "aifimora.userShapes.v1";
const FAV_KEY = "aifimora.shapeFavs.v1";

const SHAPES = [
  { id: "rect", label: "Rectangle", desc: "Filled box", cat: "basic" },
  { id: "rrect", label: "Rounded", desc: "Rounded rect", cat: "basic" },
  { id: "ellipse", label: "Ellipse", desc: "Circle / oval", cat: "basic" },
  { id: "triangle", label: "Triangle", desc: "Point-up", cat: "basic" },
  { id: "diamond", label: "Diamond", desc: "Rhombus", cat: "basic" },
  { id: "line", label: "Line", desc: "Straight line", cat: "basic" },
  { id: "hex", label: "Hexagon", desc: "Polygon", cat: "basic" },
  { id: "arrow", label: "Arrow", desc: "Right arrow", cat: "arrow" },
  { id: "chevron", label: "Chevron", desc: "Play head", cat: "arrow" },
  { id: "star", label: "Star", desc: "5-point star", cat: "badge" },
  { id: "heart", label: "Heart", desc: "Heart shape", cat: "badge" },
  { id: "speech", label: "Speech", desc: "Callout bubble", cat: "badge" },
  { id: "check", label: "Check", desc: "Checkmark", cat: "badge" },
  { id: "badge", label: "Badge", desc: "Ribbon badge", cat: "badge" },
];

let cat = "all";
let query = "";
let userShapes = [];
let favs = new Set();

function loadUser() {
  try {
    userShapes = JSON.parse(localStorage.getItem(USER_KEY) || "[]");
  } catch {
    userShapes = [];
  }
}
function saveUser() {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(userShapes.slice(0, 60)));
  } catch {
    /* quota */
  }
}
function loadFavs() {
  try {
    favs = new Set(JSON.parse(localStorage.getItem(FAV_KEY) || "[]"));
  } catch {
    favs = new Set();
  }
}
function saveFavs() {
  localStorage.setItem(FAV_KEY, JSON.stringify([...favs]));
}

function readStyle() {
  const fill = document.getElementById("shapeFill")?.value || "#c9a227";
  const stroke = document.getElementById("shapeStroke")?.value || "#ffffff";
  const sw = Number(document.getElementById("shapeStrokeW")?.value || 2);
  const size = Number(document.getElementById("shapeSize")?.value || 50);
  const strokeStyle = document.getElementById("shapeStrokeStyle")?.value || "solid";
  return { fill, stroke, sw, size, strokeStyle };
}

export function shapePath(kind) {
  switch (kind) {
    case "rect":
      return "M12 18 H88 V82 H12 Z";
    case "rrect":
      return "M22 18 H78 Q88 18 88 28 V72 Q88 82 78 82 H22 Q12 82 12 72 V28 Q12 18 22 18 Z";
    case "ellipse":
      return "M50 18 C72 18 88 34 88 50 C88 66 72 82 50 82 C28 82 12 66 12 50 C12 34 28 18 50 18 Z";
    case "triangle":
      return "M50 16 L90 84 H10 Z";
    case "diamond":
      return "M50 12 L88 50 L50 88 L12 50 Z";
    case "arrow":
      return "M10 42 H60 V22 L94 50 L60 78 V58 H10 Z";
    case "chevron":
      return "M30 16 L70 50 L30 84";
    case "line":
      return "M8 50 H92";
    case "hex":
      return "M50 12 L84 32 V68 L50 88 L16 68 V32 Z";
    case "star":
      return "M50 12 L61 40 H90 L67 57 L76 86 L50 68 L24 86 L33 57 L10 40 H39 Z";
    case "heart":
      return "M50 82 C20 60 12 42 22 30 C32 18 46 22 50 34 C54 22 68 18 78 30 C88 42 80 60 50 82 Z";
    case "speech":
      return "M16 20 H84 V62 H44 L28 80 V62 H16 Z";
    case "check":
      return "M18 52 L40 74 L82 28";
    case "badge":
      return "M20 20 H80 V70 L50 88 L20 70 Z";
    default:
      return "M12 18 H88 V82 H12 Z";
  }
}

export function drawShape(ctx, w, h, clip, time) {
  const st = clip.shape || {};
  const type = st.type || (st.kind === "image" ? "image" : st.kind) || "rect";
  const base = st.size != null ? st.size / 100 : 0.5;
  const sx = st.sx != null ? st.sx : base;
  const sy = st.sy != null ? st.sy : base;
  const minSide = Math.min(w, h);
  const boxW = minSide * sx;
  const boxH = minSide * sy;
  const x = (st.x ?? 0.5) * w;
  const y = (st.y ?? 0.5) * h;
  const anim = clip.textStyle?.anim || "fade";
  const local = time - clip.start;
  const dur = Math.max(clip.duration, 0.001);
  let alpha = 1;
  let pop = 1;
  if (anim === "fade") alpha = Math.min(1, local / 0.3, (dur - local) / 0.3);
  else if (anim === "pop") {
    pop = Math.min(1, local / 0.25);
    alpha = pop;
  }
  if (alpha <= 0.01) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(pop, pop);

  if (type === "image" && st.src) {
    const img = getImage(st.src);
    if (img?.complete && img.naturalWidth) {
      ctx.drawImage(img, -boxW / 2, -boxH / 2, boxW, boxH);
    } else {
      ctx.fillStyle = st.fill || "#c9a227";
      ctx.fillRect(-boxW / 2, -boxH / 2, boxW, boxH);
    }
    ctx.restore();
    return;
  }

  ctx.translate(-boxW / 2, -boxH / 2);
  ctx.scale(boxW / 100, boxH / 100);
  let path;
  try {
    path = new Path2D(shapePath(type));
  } catch {
    path = new Path2D(shapePath("rect"));
  }
  ctx.fillStyle = st.fill || "#c9a227";
  ctx.strokeStyle = st.stroke || "#fff";
  ctx.lineWidth = st.sw || 2;
  if (st.strokeStyle === "dashed") ctx.setLineDash([8, 6]);
  else if (st.strokeStyle === "dotted") ctx.setLineDash([2, 4]);
  const strokeOnly = type === "line" || type === "check" || type === "chevron";
  if (strokeOnly) {
    ctx.stroke(path);
  } else {
    ctx.fill(path);
    if ((st.sw || 0) > 0) ctx.stroke(path);
  }
  ctx.restore();
}

const imgCache = new Map();
function getImage(src) {
  if (imgCache.has(src)) return imgCache.get(src);
  const img = new Image();
  img.src = src;
  imgCache.set(src, img);
  return img;
}

function thumbSvg(id, fill = "#c9a227") {
  if (id === "image") return "";
  const d = shapePath(id);
  const strokeOnly = id === "line" || id === "check" || id === "chevron";
  return `<svg viewBox="0 0 100 100" width="48" height="48"><path d="${d}" fill="${strokeOnly ? "none" : fill}" stroke="#fff" stroke-width="3"/></svg>`;
}

function allItems() {
  const built = SHAPES.map((s) => ({ ...s, source: "builtin" }));
  const user = userShapes.map((u) => ({
    id: u.id,
    label: u.label,
    desc: "User shape",
    cat: "user",
    source: "user",
    kind: "image",
    src: u.src,
  }));
  return [...built, ...user];
}

function filtered() {
  let list = allItems();
  if (cat === "fav") list = list.filter((s) => favs.has(s.id));
  else if (cat === "user") list = list.filter((s) => s.source === "user");
  else if (cat !== "all") list = list.filter((s) => s.cat === cat);
  if (query) {
    const q = query.toLowerCase();
    list = list.filter((s) => s.label.toLowerCase().includes(q) || s.desc.toLowerCase().includes(q));
  }
  return list;
}

function renderGrid() {
  const root = document.getElementById("shapeGrid");
  if (!root) return;
  const list = filtered();
  root.innerHTML = "";
  if (!list.length) {
    root.innerHTML = `<div class="empty" style="grid-column:1/-1">No shapes match.</div>`;
    return;
  }
  list.forEach((s) => {
    const card = document.createElement("div");
    card.className = "preset shape-preset";
    const isFav = favs.has(s.id);
    card.innerHTML = `
      <button type="button" class="shape-star" title="Favorite" aria-label="Favorite">${isFav ? "★" : "☆"}</button>
      <span class="shape-thumb" aria-hidden="true">${
        s.kind === "image" && s.src
          ? `<img src="${s.src}" alt="" style="width:48px;height:48px;object-fit:contain" />`
          : thumbSvg(s.id)
      }</span>
      <strong>${s.label}</strong><span>${s.desc}</span>
    `;
    card.addEventListener("click", (e) => {
      if (e.target.closest(".shape-star")) return;
      addShape(s);
    });
    card.querySelector(".shape-star")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (favs.has(s.id)) favs.delete(s.id);
      else favs.add(s.id);
      saveFavs();
      renderGrid();
    });
    root.appendChild(card);
  });
}

export function initShapesPanel() {
  loadUser();
  loadFavs();

  document.getElementById("shapeCats")?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-shape-cat]");
    if (!btn) return;
    cat = btn.dataset.shapeCat;
    document.querySelectorAll("[data-shape-cat]").forEach((b) => b.classList.toggle("active", b === btn));
    renderGrid();
  });

  document.getElementById("shapeSearch")?.addEventListener("input", (e) => {
    query = e.target.value.trim();
    renderGrid();
  });

  const input = document.getElementById("fileImportShapes");
  document.getElementById("btnImportShapes")?.addEventListener("click", () => input?.click());
  input?.addEventListener("change", async () => {
    const files = [...(input.files || [])];
    for (const file of files) {
      const src = URL.createObjectURL(file);
      userShapes.push({
        id: "us_" + file.name + "_" + Date.now(),
        label: file.name.replace(/\.\w+$/, "").slice(0, 18),
        src,
      });
    }
    saveUser();
    input.value = "";
    cat = "user";
    document.querySelectorAll("[data-shape-cat]").forEach((b) =>
      b.classList.toggle("active", b.dataset.shapeCat === "user")
    );
    renderGrid();
    toast(`Imported ${files.length} shape(s) to Mine`, "ok");
  });

  // Rescan assets/shapes via manifest
  rescanShapeFolder();

  const bindOut = (id, out) => {
    const el = document.getElementById(id);
    el?.addEventListener("input", () => {
      const o = document.getElementById(out);
      if (o) o.textContent = el.value;
    });
  };
  bindOut("shapeStrokeW", "shapeStrokeWOut");
  bindOut("shapeSize", "shapeSizeOut");

  renderGrid();
  initShapeCanvasEdit();
}

async function rescanShapeFolder() {
  try {
    const res = await fetch("assets/shapes/manifest.json", { cache: "no-store" });
    if (!res.ok) return;
    const man = await res.json();
    const items = Array.isArray(man) ? man : man.items || [];
    items.forEach((it) => {
      const id = "us_" + (it.id || it.label || userShapes.length);
      if (userShapes.some((u) => u.id === id)) return;
      userShapes.push({
        id,
        label: it.label || it.name || "Shape",
        src: it.src || it.file,
      });
    });
    saveUser();
    renderGrid();
  } catch {
    /* no folder */
  }
}

function addShape(def) {
  const st = readStyle();
  const t = Math.round((window.__aifimoraPlayhead || 0) * 10) / 10;
  const isImg = def.kind === "image" || def.source === "user";
  // Nudge if another shape already sits at this time so the new one is visible
  const occupied = store
    .get()
    .clips.some((c) => c.shape && Math.abs(c.start - t) < 0.05 && c.trackId === "t1");
  const start = occupied ? t + 0.25 : t;
  const sizePct = st.size;
  const clip = store.addClip({
    type: "text",
    trackId: "t1",
    name: `Shape · ${def.label}`,
    text: "",
    start,
    duration: 3,
    textStyle: { ...DEFAULT_TEXT_STYLE, content: "", anim: "fade" },
    shape: {
      type: isImg ? "image" : def.id,
      kind: isImg ? "image" : def.id,
      src: def.src || null,
      fill: st.fill,
      stroke: st.stroke,
      sw: st.sw,
      strokeStyle: st.strokeStyle,
      size: sizePct,
      sx: sizePct / 100,
      sy: sizePct / 100,
      x: 0.5,
      y: 0.5,
    },
  });
  store.set({ selectedClipId: clip.id });
  toast(`Shape “${def.label}” added`, "ok");
  window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
}

/** On-canvas shape box: move + resize (Filmora double-click edit). */
let sOverlay = null;
let sBox = null;
let sClipId = null;
let sDrag = null;

function ensureShapeOverlay(wrap) {
  if (sOverlay?.isConnected) return sOverlay;
  sOverlay = document.createElement("div");
  sOverlay.className = "crop-layer shape-edit-layer";
  const handles = ["nw", "n", "ne", "e", "se", "s", "sw", "w"]
    .map((d) => `<div class="crop-handle h-${d}" data-dir="${d}"></div>`)
    .join("");
  sOverlay.innerHTML = `<div class="crop-box" id="shapeEditBox" tabindex="0"><div class="crop-label">Shape</div>${handles}</div>`;
  wrap.appendChild(sOverlay);
  sBox = sOverlay.querySelector("#shapeEditBox");
  bindShapeBox();
  return sOverlay;
}

function paintShapeBox() {
  if (!sBox || !sClipId) return;
  const clip = store.getClip(sClipId);
  const canvas = document.getElementById("previewCanvas");
  if (!clip?.shape || !canvas) {
    sOverlay?.classList.remove("visible");
    return;
  }
  const st = clip.shape;
  const wrap = sOverlay.parentElement.getBoundingClientRect();
  const cr = canvas.getBoundingClientRect();
  const ox = cr.left - wrap.left;
  const oy = cr.top - wrap.top;
  const minSide = Math.min(cr.width, cr.height);
  const base = st.size != null ? st.size / 100 : 0.5;
  const sx = st.sx != null ? st.sx : base;
  const sy = st.sy != null ? st.sy : base;
  const bw = minSide * sx;
  const bh = minSide * sy;
  const cx = ox + (st.x ?? 0.5) * cr.width;
  const cy = oy + (st.y ?? 0.5) * cr.height;
  sBox.style.left = `${cx - bw / 2}px`;
  sBox.style.top = `${cy - bh / 2}px`;
  sBox.style.width = `${bw}px`;
  sBox.style.height = `${bh}px`;
  sOverlay.classList.add("visible");
}

const CORNER = new Set(["nw", "ne", "se", "sw"]);

function bindShapeBox() {
  sBox.addEventListener("pointerdown", (e) => {
    const dir = e.target.dataset?.dir;
    if (!sClipId) return;
    e.preventDefault();
    e.stopPropagation();
    const clip = store.getClip(sClipId);
    const canvas = document.getElementById("previewCanvas");
    if (!clip?.shape || !canvas) return;
    const cr = canvas.getBoundingClientRect();
    const st = clip.shape;
    const base = st.size != null ? st.size / 100 : 0.5;
    sDrag = {
      mode: dir ? "resize" : "move",
      dir: dir || "",
      proportional: CORNER.has(dir || ""),
      startX: e.clientX,
      startY: e.clientY,
      x0: st.x ?? 0.5,
      y0: st.y ?? 0.5,
      sx0: st.sx != null ? st.sx : base,
      sy0: st.sy != null ? st.sy : base,
      minSide: Math.min(cr.width, cr.height),
      cw: cr.width,
      ch: cr.height,
    };
    try {
      (dir ? e.target : sBox).setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    sBox.classList.add("dragging");
    store.pushUndo("Edit shape");
  });

  window.addEventListener("pointermove", (e) => {
    if (!sDrag || !sClipId) return;
    const clip = store.getClip(sClipId);
    if (!clip?.shape) return;
    const px = e.clientX - sDrag.startX;
    const py = e.clientY - sDrag.startY;
    // Normalize drag into minSide units (same as shape box)
    const nx = px / sDrag.minSide;
    const ny = py / sDrag.minSide;

    if (sDrag.mode === "move") {
      const dx = px / sDrag.cw;
      const dy = py / sDrag.ch;
      const x = Math.min(0.95, Math.max(0.05, sDrag.x0 + dx));
      const y = Math.min(0.95, Math.max(0.05, sDrag.y0 + dy));
      store.updateClip(
        sClipId,
        { shape: { ...clip.shape, x, y } },
        { silent: true }
      );
    } else {
      const d = sDrag.dir;
      let sx = sDrag.sx0;
      let sy = sDrag.sy0;
      if (sDrag.proportional) {
        // Corner: scale both axes by the same factor (dominant drag)
        let factor = 1;
        if (d.includes("e")) factor += nx;
        if (d.includes("w")) factor -= nx;
        if (d.includes("s")) factor += ny;
        if (d.includes("n")) factor -= ny;
        // average of horizontal/vertical contribution for stability
        const fx = 1 + (d.includes("e") ? nx : d.includes("w") ? -nx : 0);
        const fy = 1 + (d.includes("s") ? ny : d.includes("n") ? -ny : 0);
        factor = (fx + fy) / 2;
        factor = Math.min(4, Math.max(0.2, factor));
        sx = sDrag.sx0 * factor;
        sy = sDrag.sy0 * factor;
      } else {
        // Side: free (non-proportional) on that axis only
        if (d === "e") sx = sDrag.sx0 + nx;
        if (d === "w") sx = sDrag.sx0 - nx;
        if (d === "s") sy = sDrag.sy0 + ny;
        if (d === "n") sy = sDrag.sy0 - ny;
      }
      sx = Math.min(2.5, Math.max(0.08, sx));
      sy = Math.min(2.5, Math.max(0.08, sy));
      const size = Math.round(((sx + sy) / 2) * 100);
      store.updateClip(
        sClipId,
        { shape: { ...clip.shape, sx, sy, size } },
        { silent: true }
      );
    }
    paintShapeBox();
  });

  const end = () => {
    if (!sDrag) return;
    sDrag = null;
    sBox.classList.remove("dragging");
    store.save();
  };
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);

  sBox.addEventListener("dblclick", () => {
    // open shapes library for style
    document.querySelector('[data-sidebar="shapes"]')?.click();
    toast("Edit fill/stroke in Library → Shapes", "ok");
  });
}

function syncShapeEdit() {
  const t = window.__aifimoraPlayhead || 0;
  const id = store.get().selectedClipId;
  const clip = id ? store.getClip(id) : null;
  if (!clip?.shape || t < clip.start || t >= clip.start + clip.duration) {
    sClipId = null;
    sOverlay?.classList.remove("visible");
    return;
  }
  sClipId = id;
  paintShapeBox();
}

function initShapeCanvasEdit() {
  const wrap = document.querySelector(".preview-wrap");
  if (!wrap) return;
  ensureShapeOverlay(wrap);
  window.addEventListener("aifimora:playhead", syncShapeEdit);
  window.addEventListener("aifimora:layout", syncShapeEdit);
  window.addEventListener("aifimora:shape-selected", syncShapeEdit);
  store.subscribe(() => {
    if (!sDrag) syncShapeEdit();
  });
}
