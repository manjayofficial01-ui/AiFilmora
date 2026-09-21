/* color-preset-ui.js — Filmora's 29 built-in colour presets, as a browsable grid.
 *
 * These are NOT LUTs. A LUT is a 32³ lookup table; these presets are parametric
 * (white balance + exposure + vibrance + highlight/shadow + HSL + vignette) read
 * straight out of Filmora's .conf files, and they can coexist with a LUT.
 */
import { toast } from "./media.js";
import { store } from "./state.js";
import { colorPresets, colorPresetById } from "./color-presets.js";
import { colorPresetThumbnail } from "./color-engine.js";

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function currentClip() {
  const s = store.get();
  return s.clips.find((c) => c.id === s.selectedClipId) || null;
}

/* Written straight onto clip.fx — the same shape updateClip already merges. */
function writePreset(id, intensity) {
  const clip = currentClip();
  if (!clip) { toast("Select a clip on the timeline first", "err"); return false; }
  const fx = { ...(clip.fx || {}) };
  // store.updateClip MERGES fx rather than replacing it, so `delete fx.colorPreset`
  // would just be re-merged from the old value. Assign an explicit empty instead.
  fx.colorPreset = id || "";
  if (intensity != null) fx.colorPresetIntensity = intensity;
  store.updateClip(clip.id, { fx }, { undo: false });
  window.__aifimoraPlayer?.render();
  return true;
}

function tile(preset) {
  const thumb = colorPresetThumbnail(preset, 112, 63);
  return `<button type="button" class="lut-tile" data-preset="${esc(preset.id)}"
      role="option" aria-selected="false" title="${esc(preset.title)}">
      <span class="lut-thumb" style="background-image:url('${thumb.toDataURL()}')"></span>
      <span class="lut-name">${esc(preset.title)}</span>
    </button>`;
}

function renderGrid(filter = "") {
  const grid = document.getElementById("colorPresetGrid");
  if (!grid) return;
  const all = colorPresets();
  const q = filter.trim().toLowerCase();
  const list = q ? all.filter((p) => p.title.toLowerCase().includes(q)) : all;
  grid.innerHTML = list.length
    ? list.map(tile).join("")
    : `<p class="empty-hint">No colour preset matches “${esc(filter)}”.</p>`;
  const hint = document.getElementById("colorPresetHint");
  if (hint) hint.textContent = `${list.length} of ${all.length} built-in looks`;
  syncActive();
}

function syncActive() {
  const clip = currentClip();
  const cur = clip?.fx?.colorPreset || "";
  document.querySelectorAll("#colorPresetGrid .lut-tile").forEach((b) => {
    const on = b.dataset.preset === cur;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  const inten = document.getElementById("fxColorPresetIntensity");
  const out = document.getElementById("fxColorPresetIntensityOut");
  if (inten && clip) {
    const v = clip.fx?.colorPresetIntensity ?? 100;
    inten.value = String(v);
    if (out) out.textContent = String(v);
  }
}

export function initColorPresetUI() {
  const grid = document.getElementById("colorPresetGrid");
  if (!grid) return;
  const search = document.getElementById("colorPresetSearch");
  const inten = document.getElementById("fxColorPresetIntensity");
  const clear = document.getElementById("btnColorPresetClear");

  renderGrid();
  search?.addEventListener("input", () => renderGrid(search.value));

  grid.addEventListener("click", (e) => {
    const btn = e.target.closest(".lut-tile");
    if (!btn) return;
    const id = btn.dataset.preset;
    const preset = colorPresetById(id);
    if (writePreset(id, null)) {
      toast("Colour · " + (preset ? preset.title : id), "ok");
      syncActive();
    }
  });

  inten?.addEventListener("input", () => {
    const out = document.getElementById("fxColorPresetIntensityOut");
    if (out) out.textContent = inten.value;
    const clip = currentClip();
    if (!clip?.fx?.colorPreset) return;
    writePreset(clip.fx.colorPreset, Number(inten.value));
  });

  clear?.addEventListener("click", () => {
    if (writePreset(null, null)) {
      toast("Colour preset cleared", "ok");
      syncActive();
    }
  });

  window.addEventListener("aifimora:clip-selected", syncActive);
}
