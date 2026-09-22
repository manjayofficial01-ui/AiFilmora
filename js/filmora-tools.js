/* filmora-tools.js — remaining Filmora 14/15 parity: workspace layouts,
 * keyframe diamonds + graph shell, Filmora tool names, Instant Cutter / Record. */
import { store } from "./state.js";
import { toast } from "./media.js";

const $ = (s, r = document) => r.querySelector(s);
const LAYOUT_KEY = "aifimora.layoutMode.v1";

const LAYOUTS = [
  { id: "default", label: "Default", desc: "Library · Player · Properties · Timeline" },
  { id: "organize", label: "Organize", desc: "Wider library for sorting media" },
  { id: "edit", label: "Edit", desc: "Balanced edit workspace" },
  { id: "short-video", label: "Short Video", desc: "Tall player for 9:16" },
  { id: "classic", label: "Classic", desc: "Compact NLE density" },
  { id: "dual", label: "Dual", desc: "Emphasize Source + Program" },
];

function applyLayout(id, { silent = false } = {}) {
  const app = $("#app");
  if (!app) return;
  app.dataset.layout = id;
  localStorage.setItem(LAYOUT_KEY, id);
  const root = document.documentElement;
  const map = {
    default: { sb: "280px", insp: "320px", tl: "280px" },
    organize: { sb: "380px", insp: "280px", tl: "240px" },
    edit: { sb: "300px", insp: "340px", tl: "300px" },
    "short-video": { sb: "240px", insp: "300px", tl: "260px" },
    classic: { sb: "220px", insp: "280px", tl: "220px" },
    dual: { sb: "240px", insp: "360px", tl: "280px" },
  };
  const m = map[id] || map.default;
  root.style.setProperty("--sidebar-w", m.sb);
  root.style.setProperty("--inspector-w", m.insp);
  root.style.setProperty("--timeline-h", m.tl);
  if (id === "short-video") {
    const asp = $("#previewAspect");
    if (asp) asp.value = "9:16";
  }
  if (!silent) toast(`Layout · ${id}`, "ok");
}

export function bindWorkspaceLayouts() {
  const viewPop = $("#fmView .fm-pop");
  if (!viewPop || $("#menuLayoutDefault")) return;
  const block = document.createElement("div");
  block.className = "fm-layout-list";
  block.innerHTML =
    `<div class="fm-info-row"><strong>Workspace layout</strong></div>` +
    LAYOUTS.map(
      (l, i) =>
        `<button type="button" ${i === 0 ? 'id="menuLayoutDefault" ' : ""}data-layout="${l.id}" title="${l.desc}">${l.label}</button>`
    ).join("") +
    `<hr/>`;
  viewPop.prepend(block);
  block.addEventListener("click", (e) => {
    const b = e.target.closest("[data-layout]");
    if (!b) return;
    applyLayout(b.dataset.layout);
    b.closest("details")?.removeAttribute("open");
  });
  applyLayout(localStorage.getItem(LAYOUT_KEY) || "default", { silent: true });
}

const KF_PROPS = [
  { id: "scale", label: "Scale", min: 10, max: 400, step: 1 },
  { id: "x", label: "Position X", min: -100, max: 100, step: 0.1 },
  { id: "y", label: "Position Y", min: -100, max: 100, step: 0.1 },
  { id: "rot", label: "Rotation", min: -360, max: 360, step: 1 },
  { id: "opacity", label: "Opacity", min: 0, max: 100, step: 1 },
];

function selectedClip() {
  const s = store.get();
  return store.getClip(s.selectedClipId) || store.getClip(s.selectedClipIds?.[0]) || null;
}

function clipTime() {
  return store.get().playhead || 0;
}

function sampleProp(clip, prop) {
  const map = {
    scale: clip.transform?.scale ?? 100,
    x: clip.transform?.x ?? 0,
    y: clip.transform?.y ?? 0,
    rot: clip.transform?.rotation ?? 0,
    opacity: clip.fx?.opacity ?? 100,
  };
  return map[prop] ?? 0;
}

function addKeyframeAtPlayhead(propId, value) {
  const clip = selectedClip();
  if (!clip) {
    toast("Select a clip first", "err");
    return;
  }
  const t = clipTime();
  const kfs = Array.isArray(clip.keyframes) ? [...clip.keyframes] : [];
  const prop = propId || "opacity";
  const idx = kfs.findIndex((k) => k.prop === prop && Math.abs(k.t - t) < 0.05);
  const kf = { prop, t, v: value ?? sampleProp(clip, prop) };
  if (idx >= 0) kfs[idx] = kf;
  else kfs.push(kf);
  kfs.sort((a, b) => a.t - b.t);
  store.updateClip(clip.id, { keyframes: kfs }, { undo: true });
  paintGraph();
  toast(`Keyframe · ${prop} @ ${t.toFixed(2)}s`, "ok");
}

function stepKey(dir) {
  const clip = selectedClip();
  if (!clip) return;
  const t = clipTime();
  const kfs = (clip.keyframes || []).slice().sort((a, b) => a.t - b.t);
  if (!kfs.length) return;
  let target =
    dir > 0 ? kfs.find((k) => k.t > t + 0.01) : [...kfs].reverse().find((k) => k.t < t - 0.01);
  if (!target) target = dir > 0 ? kfs[0] : kfs[kfs.length - 1];
  store.set({ playhead: target.t });
  window.dispatchEvent(new CustomEvent("aifimora:playhead"));
  paintGraph();
}

function paintGraph() {
  const c = $("#kfGraphCanvas");
  if (!c) return;
  const ctx = c.getContext("2d");
  const w = c.width;
  const h = c.height;
  ctx.fillStyle = "#0a0d0f";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  for (let i = 0; i <= 4; i++) {
    const y = (h * i) / 4;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  const clip = selectedClip();
  const sel = $("#kfPropSel")?.value || "opacity";
  const kfs = ((clip && clip.keyframes) || []).filter((k) => k.prop === sel);
  const dur = Math.max(4, (clip && clip.duration) || 8);
  ctx.strokeStyle = "#55e5c5";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  kfs.forEach((k, i) => {
    const x = (k.t / dur) * (w - 20) + 10;
    const y = h - 20 - (Math.min(100, Math.max(0, k.v)) / 100) * (h - 40);
    if (i === 0) ctx.moveTo(x, y);
    else {
      const prev = kfs[i - 1];
      const px = (prev.t / dur) * (w - 20) + 10;
      const py = h - 20 - (Math.min(100, Math.max(0, prev.v)) / 100) * (h - 40);
      const cx = (px + x) / 2;
      ctx.bezierCurveTo(cx, py, cx, y, x, y);
    }
  });
  ctx.stroke();
  kfs.forEach((k) => {
    const x = (k.t / dur) * (w - 20) + 10;
    const y = h - 20 - (Math.min(100, Math.max(0, k.v)) / 100) * (h - 40);
    ctx.fillStyle = "#55e5c5";
    ctx.beginPath();
    ctx.moveTo(x, y - 5);
    ctx.lineTo(x + 5, y);
    ctx.lineTo(x, y + 5);
    ctx.lineTo(x - 5, y);
    ctx.closePath();
    ctx.fill();
  });
  const t = clipTime();
  const px = (t / dur) * (w - 20) + 10;
  ctx.strokeStyle = "#ffb020";
  ctx.beginPath();
  ctx.moveTo(px, 0);
  ctx.lineTo(px, h);
  ctx.stroke();
}

function ensureGraphShell() {
  if ($("#kfGraph")) return;
  const host = $(".props-accordion") || $(".inspector");
  if (!host) return;
  const wrap = document.createElement("section");
  wrap.id = "kfGraph";
  wrap.className = "kf-graph";
  wrap.hidden = true;
  wrap.innerHTML = `
    <div class="kf-graph-head">
      <strong>Keyframe Animation</strong>
      <span class="kf-graph-hint">Bezier · Show Keyframe Animation</span>
      <button type="button" class="btn sm" id="kfGraphClose">Close</button>
    </div>
    <canvas id="kfGraphCanvas" width="480" height="160" aria-label="Keyframe graph editor"></canvas>
    <div class="kf-graph-tools">
      <button type="button" class="btn sm" id="kfAdd">Add at playhead</button>
      <button type="button" class="btn sm" id="kfPrev">◀ Key</button>
      <button type="button" class="btn sm" id="kfNext">Key ▶</button>
      <button type="button" class="btn sm danger" id="kfClear">Clear</button>
    </div>`;
  host.append(wrap);
  $("#kfGraphClose")?.addEventListener("click", () => {
    wrap.hidden = true;
  });
  $("#kfAdd")?.addEventListener("click", () => addKeyframeAtPlayhead($("#kfPropSel")?.value));
  $("#kfClear")?.addEventListener("click", () => {
    const clip = selectedClip();
    if (!clip) return;
    store.updateClip(clip.id, { keyframes: [] }, { undo: true });
    paintGraph();
    toast("Keyframes cleared", "ok");
  });
  $("#kfPrev")?.addEventListener("click", () => stepKey(-1));
  $("#kfNext")?.addEventListener("click", () => stepKey(1));
}

function ensureKeyframeRows() {
  const mount =
    $("#motionPanel") ||
    $("#insp-motion")?.querySelector(".panel-body") ||
    $("[data-sec='video'] .props-body");
  if (!mount || mount.querySelector(".kf-rows")) return;
  const wrap = document.createElement("div");
  wrap.className = "kf-rows";
  wrap.innerHTML = `
    <div class="section-title">Transform · Keyframes</div>
    <div class="kf-prop-row"><label>Track</label>
      <select id="kfPropSel">
        ${KF_PROPS.map((p) => `<option value="${p.id}">${p.label}</option>`).join("")}
      </select>
    </div>
    ${KF_PROPS.map(
      (p) => `<div class="kf-prop-row" data-kf="${p.id}">
        <span>${p.label}</span>
        <button type="button" class="kf-diamond" data-kf-toggle="${p.id}" title="Toggle keyframe at playhead">◆</button>
        <input type="range" min="${p.min}" max="${p.max}" step="${p.step}" data-kf-range="${p.id}" />
      </div>`
    ).join("")}
    <div class="btn-row">
      <button type="button" class="btn sm" id="kfOpenGraph">Show Keyframe Animation</button>
    </div>`;
  mount.append(wrap);
  wrap.addEventListener("click", (e) => {
    const d = e.target.closest("[data-kf-toggle]");
    if (d) {
      addKeyframeAtPlayhead(d.dataset.kfToggle);
      d.classList.add("on");
      return;
    }
    if (e.target.closest("#kfOpenGraph")) {
      ensureGraphShell();
      const g = $("#kfGraph");
      if (g) {
        g.hidden = false;
        paintGraph();
      }
    }
  });
  wrap.addEventListener("input", (e) => {
    const r = e.target.closest("[data-kf-range]");
    if (!r) return;
    const prop = r.dataset.kfRange;
    const clip = selectedClip();
    if (!clip) return;
    const val = Number(r.value);
    const patch =
      prop === "opacity"
        ? { fx: { ...(clip.fx || {}), opacity: val } }
        : {
            transform: {
              ...(clip.transform || {}),
              scale: prop === "scale" ? val : clip.transform?.scale ?? 100,
              x: prop === "x" ? val : clip.transform?.x ?? 0,
              y: prop === "y" ? val : clip.transform?.y ?? 0,
              rotation: prop === "rot" ? val : clip.transform?.rotation ?? 0,
            },
          };
    store.updateClip(clip.id, patch, { undo: false });
    window.__aifimoraPlayer?.render?.();
    const t = clipTime();
    const has = (clip.keyframes || []).some((k) => k.prop === prop && Math.abs(k.t - t) < 0.05);
    if (has) addKeyframeAtPlayhead(prop, val);
    paintGraph();
  });
  paintGraph();
}

export function bindKeyframes() {
  ensureKeyframeRows();
  ensureGraphShell();
  paintGraph();
}

function renameFilmoraTools() {
  const fxBody =
    $("#insp-fx")?.querySelector(".panel-body") || $("[data-sec='color'] .props-body");
  if (fxBody && !$("#btnAiColorPalette")) {
    const row = document.createElement("div");
    row.className = "btn-row filmora-tool-row";
    row.innerHTML = `
      <button type="button" class="btn sm" id="btnAiColorPalette">AI Color Palette</button>
      <button type="button" class="btn sm" id="btnColorMatch">Color Match</button>
      <button type="button" class="btn sm" id="btnStabilizeProps">Stabilization</button>
      <button type="button" class="btn sm" id="btnChromaProps">Chroma Key</button>
      <button type="button" class="btn sm" id="btnAiMatting">AI Matting</button>`;
    fxBody.prepend(row);
    const wire = (id, detail) =>
      $(id)?.addEventListener("click", () =>
        window.dispatchEvent(new CustomEvent("aifimora:fm", { detail }))
      );
    wire("#btnAiColorPalette", "auto-enhance");
    wire("#btnColorMatch", "color-match");
    wire("#btnStabilizeProps", "stabilize");
    wire("#btnChromaProps", "chroma");
    $("#btnAiMatting")?.addEventListener("click", () => {
      const clip = selectedClip();
      if (!clip) return toast("Select a clip first", "err");
      store.updateClip(
        clip.id,
        { fx: { ...(clip.fx || {}), cutout: true, matting: true } },
        { undo: true }
      );
      window.__aifimoraPlayer?.render?.();
      toast("AI Matting · Smart Cutout on", "ok");
    });
  }

  const spBody =
    $("#insp-speed")?.querySelector(".panel-body") || $("[data-sec='speed'] .props-body");
  if (spBody && !$("#btnSegmentedSpeed")) {
    const row = document.createElement("div");
    row.className = "btn-row filmora-tool-row";
    row.innerHTML = `
      <button type="button" class="btn sm" id="btnSegmentedSpeed">Segmented Speed</button>
      <button type="button" class="btn sm" id="btnFreezeFrame">Freeze Frame</button>
      <button type="button" class="btn sm" id="btnReverseSpeed">Reverse</button>`;
    spBody.prepend(row);
    $("#btnSegmentedSpeed")?.addEventListener("click", () => {
      const clip = selectedClip();
      if (!clip) return toast("Select a clip first", "err");
      const t = clipTime();
      const pts = Array.isArray(clip.speedPoints) ? [...clip.speedPoints] : [];
      pts.push(t);
      pts.sort((a, b) => a - b);
      store.updateClip(clip.id, { speedPoints: pts }, { undo: true });
      toast(`Speed point @ ${t.toFixed(2)}s`, "ok");
    });
    $("#btnFreezeFrame")?.addEventListener("click", () =>
      window.dispatchEvent(new CustomEvent("aifimora:fm", { detail: "freeze" }))
    );
    $("#btnReverseSpeed")?.addEventListener("click", () =>
      window.dispatchEvent(new CustomEvent("aifimora:fm", { detail: "reverse" }))
    );
  }
}

function bindInstantCutterAndRecord() {
  const filePop = $("#fmFile .fm-pop");
  if (filePop && !$("#menuRecordMedia")) {
    filePop.insertAdjacentHTML(
      "afterbegin",
      `<button id="menuInstantCutter">Instant Cutter…</button>
       <button id="menuRecordMedia">Record Media…</button>
       <hr/>`
    );
    $("#menuInstantCutter")?.addEventListener("click", () => openInstantCutter());
    $("#menuRecordMedia")?.addEventListener("click", () => openRecorder());
  }
  const toolsPop = $("#fmTools .fm-pop");
  if (toolsPop && !$("#menuSilence")) {
    toolsPop.insertAdjacentHTML(
      "afterbegin",
      `<div class="fm-info-row"><strong>Audio</strong></div>
       <button id="menuSilence">Silence Detection</button>
       <button id="menuDuck">Auto Duck</button>
       <button id="menuBeat">Auto Beat Sync</button>
       <div class="fm-info-row"><strong>Video</strong></div>
       <button id="menuCompound">Create Compound Clip</button>
       <button id="menuPlanar">Planar Tracking</button>
       <button id="menuAutoReframe">Auto Reframe</button>
       <button id="menuMotionTrack">Motion Tracking</button>
       <hr/>`
    );
    const wire = (id, detail) =>
      $(id)?.addEventListener("click", () =>
        window.dispatchEvent(new CustomEvent("aifimora:fm", { detail }))
      );
    wire("#menuSilence", "silence");
    wire("#menuDuck", "auto-duck");
    wire("#menuBeat", "beat-sync");
    wire("#menuCompound", "compound");
    wire("#menuPlanar", "planar");
    wire("#menuAutoReframe", "auto-reframe");
    wire("#menuMotionTrack", "motion-track");
  }
}

function openInstantCutter() {
  if ($("#instantCutterModal")) {
    $("#instantCutterModal").classList.add("open");
    return;
  }
  const m = document.createElement("div");
  m.className = "modal-backdrop open";
  m.id = "instantCutterModal";
  m.setAttribute("role", "dialog");
  m.setAttribute("aria-modal", "true");
  m.innerHTML = `
    <div class="modal">
      <h3>Instant Cutter</h3>
      <p>Lossless trim on import (Filmora Instant Cutter). Set In/Out and add a trimmed sub-clip.</p>
      <div class="export-settings-grid">
        <label>In (s)<input id="icIn" type="number" min="0" step="0.1" value="0" /></label>
        <label>Out (s)<input id="icOut" type="number" min="0.1" step="0.1" value="5" /></label>
      </div>
      <div class="btn-row">
        <button type="button" class="btn primary" id="icAdd">Add trimmed clip</button>
        <button type="button" class="btn" id="icClose">Close</button>
      </div>
    </div>`;
  document.body.append(m);
  $("#icClose").addEventListener("click", () => m.classList.remove("open"));
  $("#icAdd").addEventListener("click", () => {
    const a = Number($("#icIn").value) || 0;
    const b = Number($("#icOut").value) || 5;
    if (b <= a) return toast("Out must be after In", "err");
    window.dispatchEvent(new CustomEvent("aifimora:instant-cutter", { detail: { in: a, out: b } }));
    toast(`Instant Cutter · ${a}s → ${b}s`, "ok");
    m.classList.remove("open");
  });
}

function openRecorder() {
  toast("Record Media · screen/webcam (Electron desktopCapturer hook)", "info");
  window.dispatchEvent(new CustomEvent("aifimora:record-media"));
}

export function initFilmoraTools() {
  bindWorkspaceLayouts();
  bindKeyframes();
  renameFilmoraTools();
  bindInstantCutterAndRecord();
}
