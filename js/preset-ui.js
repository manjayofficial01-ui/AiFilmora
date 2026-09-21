/* preset-ui.js — browsers for the remaining Filmora asset libraries.
 *
 *   • 48 text styles   (configs/TextStyle, real PNG thumbnails)  → Text panel
 *   • 150 animations   (configs/AnimationNew)                    → Motion panel
 *   • 192 filter looks (resources/wfx_effect/nle_default)        → FX panel
 *   • 10 masks         (configs/MaskPreset)                      → FX panel
 *   • 4 transitions    (configs/Transition, thumbnail + video)   → Transitions
 */
import { store } from "./state.js";
import { toast } from "./media.js";
import { applyTransitionToClip } from "./transitions.js";
import {
  ANIM_KINDS,
  animationsOf,
  animEnvelope,
  animationCounts,
  textStyles,
  filterPresets,
  maskPresets,
  transitionPresets,
  presetCounts,
} from "./filmora-presets.js";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

function selectedClip() {
  const s = store.get();
  const sel = s.selectedClipId || (s.selection && s.selection[0]);
  return s.clips.find((c) => c.id === sel) || null;
}

/* ============================================================ text styles == */
let styleQuery = "";

function renderTextStyles() {
  const host = document.getElementById("textStyleGrid");
  if (!host) return;
  const all = textStyles();
  const q = styleQuery.trim().toLowerCase();
  const list = q ? all.filter((s) => s.label.toLowerCase().includes(q)) : all;
  host.innerHTML = list.length
    ? list.map((s) => `<button type="button" class="style-tile" data-style="${esc(s.id)}"
        title="${esc(s.label)}" role="option" aria-selected="false">
        <img src="${esc(s.thumb)}" alt="${esc(s.label)}" loading="lazy" />
        <span>${esc(s.label)}</span>
      </button>`).join("")
    : `<p class="empty-hint">No text style matches “${esc(styleQuery)}”.</p>`;
  const hint = document.getElementById("textStyleCount");
  if (hint) hint.textContent = `${list.length} of ${all.length} presets`;
}

/* ============================================================== animation == */
let animKind = "in";
let animQuery = "";

function renderAnimKinds() {
  const host = document.getElementById("animKindRow");
  if (!host) return;
  const counts = animationCounts();
  host.innerHTML = ANIM_KINDS.map((k) => `
    <button type="button" class="chip${animKind === k.id ? " active" : ""}" data-kind="${k.id}"
      role="tab" aria-selected="${animKind === k.id}">${esc(k.label)} <span class="chip-n">${counts[k.id]}</span></button>`).join("");
}

function renderAnims() {
  const host = document.getElementById("animList");
  if (!host) return;
  const all = animationsOf(animKind);
  const q = animQuery.trim().toLowerCase();
  const list = q ? all.filter((a) => a.title.toLowerCase().includes(q)) : all;
  const clip = selectedClip();
  const current = clip?.[animKind === "in" ? "animIn" : animKind === "out" ? "animOut" : "animLoop"];
  host.innerHTML = list.length
    ? list.map((a) => `<button type="button" class="fx-item${current === a.id ? " active" : ""}"
        data-anim="${esc(a.id)}" role="option" aria-selected="${current === a.id}">
        <span class="fx-item-name">${esc(a.title)}</span></button>`).join("")
    : `<p class="empty-hint">No animation matches “${esc(animQuery)}”.</p>`;
  const hint = document.getElementById("animCountHint");
  if (hint) hint.textContent = `${list.length} shown`;
}

/* ================================================================ filters == */
let filterQuery = "";

function renderFilters() {
  const host = document.getElementById("filterList");
  if (!host) return;
  const all = filterPresets();
  const q = filterQuery.trim().toLowerCase();
  const list = q ? all.filter((f) => f.label.toLowerCase().includes(q)) : all;
  const clip = selectedClip();
  const cur = clip?.fx?.lut;
  host.innerHTML = list.length
    ? list.map((f) => `<button type="button" class="fx-item${cur === f.id ? " active" : ""}"
        data-filter="${esc(f.id)}" role="option" aria-selected="${cur === f.id}">
        <span class="fx-item-name">${esc(f.label)}</span></button>`).join("")
    : `<p class="empty-hint">No look matches “${esc(filterQuery)}”.</p>`;
  const hint = document.getElementById("filterCountHint");
  if (hint) hint.textContent = `${list.length} of ${all.length} presets`;
}

/* ================================================================== masks == */
function renderMasks() {
  const sel = document.getElementById("fxMaskShape");
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = maskPresets()
    .map((m) => `<option value="${esc(m.id)}">${esc(m.label)}</option>`).join("");
  const clip = selectedClip();
  if (clip?.fx?.maskShape) sel.value = clip.fx.maskShape;
  else if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
  sel.addEventListener("change", () => {
    const c = selectedClip();
    if (!c) { toast("Select a clip first", "err"); return; }
    store.updateClip(c.id, { fx: { ...(c.fx || {}), maskShape: sel.value } }, { undo: false });
    window.__aifimoraPlayer?.render();
  }, { once: true });
}

/* =========================================================== transitions == */
function renderTransitionPresets() {
  const host = document.getElementById("transPresetGrid");
  if (!host) return;
  const list = transitionPresets();
  if (!list.length) { host.innerHTML = `<p class="empty-hint">No default transitions found.</p>`; return; }
  host.innerHTML = list.map((t) => `
    <button type="button" class="preset trans-preset" data-trans="${esc(t.id)}" title="${esc(t.name)}">
      <img src="${esc(t.thumb)}" alt="${esc(t.name)}" loading="lazy" />
      <span>${esc(t.name)}</span>
    </button>`).join("");
  const hint = document.getElementById("transPresetCount");
  if (hint) hint.textContent = `${list.length} with previews`;
}

/* ================================================================== init == */
export function initPresetUI() {
  /* text styles */
  if (document.getElementById("textStyleGrid")) {
    renderTextStyles();
    document.getElementById("textStyleSearch")?.addEventListener("input", (e) => {
      styleQuery = e.target.value;
      renderTextStyles();
    });
    document.getElementById("textStyleGrid")?.addEventListener("click", (e) => {
      const b = e.target.closest(".style-tile");
      if (!b) return;
      const c = selectedClip();
      if (!c) { toast("Select a text clip first", "err"); return; }
      store.updateClip(c.id, { textStyle: b.dataset.style }, { undo: false });
      toast("Text style · " + b.dataset.style, "ok");
      window.__aifimoraPlayer?.render();
    });
  }

  /* animations */
  if (document.getElementById("animList")) {
    renderAnimKinds();
    renderAnims();
    document.getElementById("animKindRow")?.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (!chip) return;
      animKind = chip.dataset.kind;
      renderAnimKinds();
      renderAnims();
    });
    document.getElementById("animSearch")?.addEventListener("input", (e) => {
      animQuery = e.target.value;
      renderAnims();
    });
    document.getElementById("animList")?.addEventListener("click", (e) => {
      const b = e.target.closest("[data-anim]");
      if (!b) return;
      const c = selectedClip();
      if (!c) { toast("Select a clip first", "err"); return; }
      const key = animKind === "in" ? "animIn" : animKind === "out" ? "animOut" : "animLoop";
      store.updateClip(c.id, { [key]: b.dataset.anim }, { undo: false });
      toast(`${animKind === "in" ? "In" : animKind === "out" ? "Out" : "Loop"} animation applied`, "ok");
      renderAnims();
      window.__aifimoraPlayer?.render();
    });
    document.getElementById("btnAnimPreview")?.addEventListener("click", () => {
      const c = selectedClip();
      const id = c?.[animKind === "in" ? "animIn" : animKind === "out" ? "animOut" : "animLoop"];
      if (!id) { toast("Pick an animation first", "err"); return; }
      toast("Previewing animation — press play", "ok");
      window.__aifimoraPlayer?.render();
    });
    document.getElementById("btnAnimClear")?.addEventListener("click", () => {
      const c = selectedClip();
      if (!c) return;
      const key = animKind === "in" ? "animIn" : animKind === "out" ? "animOut" : "animLoop";
      store.updateClip(c.id, { [key]: null }, { undo: false });
      renderAnims();
      window.__aifimoraPlayer?.render();
    });
  }

  /* filters */
  if (document.getElementById("filterList")) {
    renderFilters();
    document.getElementById("filterSearch")?.addEventListener("input", (e) => {
      filterQuery = e.target.value;
      renderFilters();
    });
    document.getElementById("filterList")?.addEventListener("click", (e) => {
      const b = e.target.closest("[data-filter]");
      if (!b) return;
      const c = selectedClip();
      if (!c) { toast("Select a clip first", "err"); return; }
      const id = b.dataset.filter;
      const next = c.fx?.lut === id ? "none" : id;
      store.updateClip(c.id, { fx: { ...(c.fx || {}), lut: next } }, { undo: false });
      toast(next === "none" ? "Filter cleared" : "Filter · " + id, "ok");
      renderFilters();
      const sel = document.getElementById("fxLut");
      if (sel && [...sel.options].some((o) => o.value === next)) sel.value = next;
      window.__aifimoraPlayer?.render();
    });
  }

  renderMasks();
  renderTransitionPresets();

  document.getElementById("transPresetGrid")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-trans]");
    if (!b) return;
    const t = transitionPresets().find((x) => x.id === b.dataset.trans);
    if (!t) return;
    const clip = selectedClip();
    if (!clip) { toast("Select a timeline clip first", "err"); return; }
    if (clip.type === "audio" || store.get().tracks.find((track) => track.id === clip.trackId)?.locked) {
      toast("Select an unlocked visual clip for a video transition", "err");
      return;
    }
    const name = `${t.id} ${t.name}`.toLowerCase();
    const type = /white/.test(name) ? "dipWhite" : /fade/.test(name) ? "dipBlack" : "dissolve";
    const result = applyTransitionToClip(store, clip.id, type);
    toast(result.ok ? result.warn || `${t.name} applied` : result.reason, result.ok ? "ok" : "err");
    window.__aifimoraPlayer?.render();
  });

  window.addEventListener("aifimora:clip-selected", () => {
    renderTextStyles(); renderAnims(); renderFilters(); renderMasks();
  });
  store.subscribe(() => { renderAnims(); renderFilters(); });

  return presetCounts();
}

/* Exposed so the player can apply a clip's Filmora animation. */
export function clipAnimTransform(clip, localT) {
  if (!clip) return null;
  const dur = Math.max(0.001, Number(clip.duration) || 0);
  const inDur = 0.45;
  const outDur = 0.45;
  let x = 0, y = 0, scale = 1, rotation = 0, alpha = 1, blur = 0;

  const applyOne = (id, kind, p) => {
    if (!id) return;
    const meta = animationsOf(kind).find((a) => a.id === id);
    const title = meta ? meta.title : id;
    const e = animEnvelope(title, kind === "loop" ? "loop" : kind, p);
    x += e.x; y += e.y;
    scale *= e.scale;
    rotation += e.rotation;
    alpha *= e.alpha;
    blur += e.blur;
  };

  if (clip.animIn && localT < inDur) applyOne(clip.animIn, "in", localT / inDur);
  if (clip.animOut && localT > dur - outDur) applyOne(clip.animOut, "out", 1 - (dur - localT) / outDur);
  if (clip.animLoop) applyOne(clip.animLoop, "loop", (localT % 2) / 2);

  if (x === 0 && y === 0 && scale === 1 && rotation === 0 && alpha === 1 && blur === 0) return null;
  return { x, y, scale, rotation, alpha, blur };
}
