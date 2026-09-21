/* Pan & Zoom picker — Filmora's 6 keyframed crop presets. */
import { toast } from "./media.js";
import { store } from "./state.js";
import { panZoomPresets, panZoomById, panZoomPreview, isStaticPreset } from "./panzoom.js";

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function currentClip() {
  const s = store.get();
  return s.clips.find((c) => c.id === s.selectedClipId) || null;
}

/* store.updateClip MERGES the clip, so write the whole panZoom object (or an
 * explicit null) rather than trying to delete fields. */
function write(pz) {
  const clip = currentClip();
  if (!clip) { toast("Select a clip on the timeline first", "err"); return false; }
  store.updateClip(clip.id, { panZoom: pz }, { undo: false });
  window.__aifimoraPlayer?.render();
  return true;
}

function tile(p) {
  const thumb = panZoomPreview(p, 112, 63);
  return `<button type="button" class="lut-tile" data-pz="${esc(p.id)}"
      role="option" aria-selected="false" title="${esc(p.title)}${isStaticPreset(p) ? " (static)" : ""}">
      <span class="lut-thumb" style="background-image:url('${thumb.toDataURL()}')"></span>
      <span class="lut-name">${esc(p.title)}</span>
    </button>`;
}

function render() {
  const grid = document.getElementById("panZoomGrid");
  if (!grid) return;
  const all = panZoomPresets();
  grid.innerHTML = all.map(tile).join("");
  const hint = document.getElementById("panZoomHint");
  if (hint) hint.textContent = `${all.length} Filmora presets`;
  syncActive();
}

function syncActive() {
  const clip = currentClip();
  const cur = clip?.panZoom?.id || "";
  document.querySelectorAll("#panZoomGrid .lut-tile").forEach((b) => {
    const on = b.dataset.pz === cur;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  const inten = document.getElementById("panZoomIntensity");
  const out = document.getElementById("panZoomIntensityOut");
  if (inten && clip) {
    const v = clip.panZoom?.intensity ?? 100;
    inten.value = String(v);
    if (out) out.textContent = String(v);
  }
}

export function initPanZoomUI() {
  const grid = document.getElementById("panZoomGrid");
  if (!grid) return;
  const inten = document.getElementById("panZoomIntensity");
  const clear = document.getElementById("btnPanZoomClear");

  render();

  grid.addEventListener("click", (e) => {
    const btn = e.target.closest(".lut-tile");
    if (!btn) return;
    const id = btn.dataset.pz;
    const p = panZoomById(id);
    if (!p) return;
    const prev = currentClip()?.panZoom;
    if (write({ id, intensity: prev?.intensity ?? 100 })) {
      toast("Pan & Zoom · " + p.title, "ok");
      syncActive();
    }
  });

  inten?.addEventListener("input", () => {
    const out = document.getElementById("panZoomIntensityOut");
    if (out) out.textContent = inten.value;
    const clip = currentClip();
    if (!clip?.panZoom?.id) return;
    write({ id: clip.panZoom.id, intensity: Number(inten.value) });
  });

  clear?.addEventListener("click", () => {
    if (write(null)) {
      toast("Pan & Zoom cleared", "ok");
      syncActive();
    }
  });

  window.addEventListener("aifimora:clip-selected", syncActive);
}
