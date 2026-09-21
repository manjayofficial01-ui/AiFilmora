/* Asset-backed libraries; inspector controls remain available. */
import { store } from "./state.js";
import { toast } from "./media.js";
import { LUT_NAMES, LUT_PREFIX, loadLut, lutThumbnail } from "./lut-engine.js";
import { colorPresets } from "./color-presets.js";
import { colorPresetThumbnail } from "./color-engine.js";
import { audioEffects, defaultParams } from "./audio-fx.js";

export function initLibraryWorkspace() {
  const tabs = document.getElementById("libraryTabs");
  const header = tabs.parentElement;
  const sidebar = document.querySelector(".sidebar");
  const bar = document.createElement("nav");
  bar.className = "library-category-bar";
  bar.setAttribute("aria-label", "Editing libraries");
  document.querySelector(".workspace").before(bar);
  bar.append(tabs);
  header.innerHTML = '<h2 id="libraryHeading">Project Media</h2><span class="library-local">LOCAL</span>';
  const labels = { media: "Media", assets: "Local Assets", textpresets: "Titles", shapes: "Stickers & Shapes", effects: "Effects", transitions: "Transitions", tools: "AI Tools" };
  tabs.querySelectorAll("[data-sidebar]").forEach(button => {
    const label = labels[button.dataset.sidebar];
    button.querySelector(".tab-lbl").textContent = label;
    button.title = label;
  });
  for (const [id, label, icon] of [["audio", "Audio", "volume"], ["filters", "Filters", "fx"]]) {
    const button = document.createElement("button");
    button.className = "tab";
    button.dataset.sidebar = id;
    button.dataset.icon = icon;
    button.innerHTML = `<span class="tab-ico"></span><span class="tab-lbl">${label}</span>`;
    tabs.insertBefore(button, tabs.querySelector('[data-sidebar="tools"]'));
    const panel = document.createElement("div");
    panel.id = `side-${id}`;
    panel.className = "sidebar-view";
    panel.innerHTML = `<div class="panel-body"><p class="library-note">${id === "audio" ? "Local presets interpreted by Web Audio, not Filmora’s native DSP." : "Local .CUBE LUTs and parametric color grades."} Select an unlocked clip to apply.</p><input type="search" class="library-search" aria-label="Search ${label}" placeholder="Search ${label.toLowerCase()}…"><div class="library-result-count" role="status"></div><div class="library-catalog"></div></div>`;
    sidebar.append(panel);
    const entries = id === "audio"
      ? audioEffects().map(e => ({ id: e.id, label: e.label || e.id.replace(/_/g, " "), kind: "audio", badge: e.familyLabel }))
      : [...LUT_NAMES.map(name => ({ id: name, label: name, kind: "lut", badge: "3D LUT" })), ...colorPresets().map(p => ({ id: p.id, label: p.title, kind: "color", badge: "Color grade", preset: p }))];
    let built = false;
    const render = () => { built = true; renderCatalog(panel, entries); };
    panel.querySelector("input").addEventListener("input", render);
    button.addEventListener("click", () => { if (!built) render(); });
  }
  tabs.addEventListener("click", event => {
    const button = event.target.closest("[data-sidebar]");
    if (!button) return;
    const id = button.dataset.sidebar;
    tabs.querySelectorAll("[data-sidebar]").forEach(b => {
      b.classList.toggle("active", b === button);
      b.setAttribute("aria-pressed", String(b === button));
    });
    sidebar.querySelectorAll(".sidebar-view").forEach(p => p.classList.toggle("active", p.id === `side-${id}`));
    document.getElementById("libraryHeading").textContent = id === "media" ? "Project Media" : button.textContent.trim();
  });
}

function renderCatalog(panel, entries) {
  const grid = panel.querySelector(".library-catalog");
  const query = panel.querySelector("input").value.trim().toLowerCase();
  grid.replaceChildren();
  const list = entries.filter(e => `${e.label} ${e.badge}`.toLowerCase().includes(query));
  panel.querySelector(".library-result-count").textContent = `${list.length} / ${entries.length} presets`;
  if (!list.length) grid.textContent = "No matching presets. Try another search.";
  list.forEach(entry => {
    const tile = document.createElement("button");
    tile.className = "library-asset-card";
    tile.dataset.assetId = entry.id;
    tile.dataset.assetKind = entry.kind;
    const thumb = document.createElement("div");
    thumb.className = `library-asset-thumb ${entry.kind}`;
    thumb.textContent = entry.kind === "audio" ? "♫" : "";
    const name = document.createElement("strong");
    name.textContent = entry.label;
    const badge = document.createElement("small");
    badge.textContent = entry.badge;
    tile.append(thumb, name, badge);
    grid.append(tile);
    if (entry.kind === "color") thumb.append(colorPresetThumbnail(entry.preset, 160, 90));
    if (entry.kind === "lut") loadLut(entry.id).then(lut => {
      if (!tile.isConnected) return;
      const img = document.createElement("img");
      img.alt = "";
      img.src = lutThumbnail(lut, 160, 90);
      thumb.append(img);
    }).catch(() => { badge.textContent = "Asset unavailable"; tile.disabled = true; });
    tile.addEventListener("click", () => applyAsset(entry));
  });
}


function applyAsset(entry) {
  const state = store.get();
  const clip = store.getClip(state.selectedClipId);
  if (!clip) { toast("Select a timeline clip first", "err"); return; }
  if (state.tracks.find(t => t.id === clip.trackId)?.locked) { toast("Unlock the track first", "err"); return; }
  if ((entry.kind !== "audio" && clip.type === "audio") || (entry.kind === "audio" && !["audio", "video"].includes(clip.type))) {
    toast("Select a compatible clip for this preset", "err"); return;
  }
  const patch = entry.kind === "audio" ? { audioFx: [...(clip.audioFx || []), { id: entry.id, enabled: true, params: defaultParams(entry.id) }] }
    : { fx: { ...clip.fx, ...(entry.kind === "lut" ? { lut: LUT_PREFIX + entry.id } : { colorPreset: entry.id, colorPresetIntensity: 100 }) } };
  store.updateClip(clip.id, patch, { undo: true });
  window.__aifimoraPlayer?.render();
  toast(`${entry.label} applied`, "ok");
}
