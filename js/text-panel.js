/* Titles / text clips panel */
import { store, DEFAULT_TEXT_STYLE } from "./state.js";
import { toast } from "./media.js";
import { settings } from "./settings.js";
import {
  fonts as assetFonts,
  featuredFontFamilies,
  captionAnimations,
} from "./assets-bridge.js";

const PRESETS = [
  {
    id: "title",
    label: "Main Title",
    desc: "Large centered open",
    style: {
      content: "MAIN TITLE",
      size: 64,
      weight: 700,
      pos: "center",
      y: 0.42,
      anim: "fade",
      color: "#ffffff",
      letterSpacing: 4,
      uppercase: true,
    },
  },
  {
    id: "lower",
    label: "Lower Third",
    desc: "Name / location bar",
    style: {
      content: "Alex Rivera\nDirector of Photography",
      size: 28,
      weight: 600,
      pos: "lower",
      y: 0.82,
      anim: "slideup",
      color: "#ffffff",
      bg: "rgba(0,0,0,0.55)",
      letterSpacing: 1,
      uppercase: false,
    },
  },
  {
    id: "subtitle",
    label: "Subtitle",
    desc: "Bottom caption style",
    style: {
      content: "A quiet morning in the city",
      size: 26,
      weight: 500,
      pos: "lower",
      y: 0.88,
      anim: "fade",
      color: "#ffffff",
      shadow: true,
    },
  },
  {
    id: "chapter",
    label: "Chapter Card",
    desc: "Section break",
    style: {
      content: "02  ·  THE CUT",
      size: 40,
      weight: 600,
      pos: "center",
      y: 0.5,
      anim: "typewriter",
      color: "#00d4a0",
      letterSpacing: 6,
      uppercase: true,
    },
  },
  {
    id: "credits",
    label: "End Credits",
    desc: "Scroll-style block",
    style: {
      content: "WRITTEN & DIRECTED\nby\nYou",
      size: 32,
      weight: 500,
      pos: "center",
      y: 0.5,
      anim: "pop",
      color: "#e8ecf2",
      letterSpacing: 2,
    },
  },
  {
    id: "sticker",
    label: "Sticker Callout",
    desc: "Bold pop label",
    style: {
      content: "NEW!",
      size: 44,
      weight: 800,
      pos: "custom",
      x: 0.78,
      y: 0.22,
      anim: "pop",
      color: "#0b0d10",
      bg: "#ffb020",
      shadow: true,
      uppercase: true,
    },
  },
];

function selectedClip() {
  const id = store.get().selectedClipId;
  return id ? store.getClip(id) : null;
}

function ensureTextClip() {
  let clip = selectedClip();
  if (clip && (clip.type === "text" || clip.textStyle)) return clip;

  // Prefer existing text clip under playhead
  const t = window.__aifimoraPlayhead || 0;
  const s = store.get();
  clip = s.clips.find(
    (c) => c.type === "text" && t >= c.start && t < c.start + c.duration
  );
  if (clip) {
    store.set({ selectedClipId: clip.id });
    return clip;
  }

  const start = Math.round(t * 10) / 10;
  const titleLen = Number(settings.get().editing?.defaultTitleLen) || 3;
  clip = store.addClip({
    type: "text",
    trackId: "t1",
    name: "Title",
    text: "Your title",
    start,
    duration: titleLen,
    textStyle: { ...DEFAULT_TEXT_STYLE },
  });
  store.set({ selectedClipId: clip.id });
  return clip;
}

function applyStyleToSelected(stylePatch, { toastMsg } = {}) {
  const clip = ensureTextClip();
  if (!clip) return null;
  if (toastMsg) store.pushUndo(toastMsg);
  store.updateClip(clip.id, {
    textStyle: stylePatch,
    text: stylePatch.content != null ? stylePatch.content : clip.text,
    name:
      stylePatch.content != null
        ? String(stylePatch.content).split("\n")[0].slice(0, 28) || "Title"
        : clip.name,
  });
  if (toastMsg) toast(toastMsg, "ok");
  return clip;
}

function syncControlsFromClip() {
  const clip = selectedClip();
  const ts = clip?.textStyle;
  // Always enable the form so users can draft text then Add Title (Filmora-like)
  const fields = [
    "textContent",
    "textFont",
    "textSize",
    "textWeight",
    "textColor",
    "textBg",
    "textPos",
    "textAnim",
    "textAlign",
    "textX",
    "textY",
    "textShadow",
    "textUpper",
    "textSpacing",
  ];
  fields.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  });
  const applyBtn = document.getElementById("btnApplyText");
  const addBtn = document.getElementById("btnAddTitle");
  if (applyBtn) applyBtn.disabled = false;
  if (addBtn) addBtn.disabled = false;

  if (!ts) {
    const label = document.getElementById("textClipHint");
    if (label) label.textContent = "No text clip selected — Add Title creates one at the playhead.";
    return;
  }
  const label = document.getElementById("textClipHint");
  if (label) label.textContent = `Editing: ${clip.name} · ${clip.duration.toFixed(1)}s`;

  setVal("textContent", ts.content);
  setVal("textFont", ts.font);
  setVal("textSize", ts.size);
  setVal("textSizeOut", ts.size);
  setVal("textWeight", String(ts.weight));
  setVal("textColor", ts.color);
  setVal("textBg", ts.bg === "rgba(0,0,0,0)" || !ts.bg ? "#000000" : ts.bg);
  setVal("textPos", ts.pos);
  setVal("textAnim", ts.anim);
  setVal("textAlign", ts.align);
  setVal("textX", Math.round((ts.x ?? 0.5) * 100));
  setVal("textXOut", Math.round((ts.x ?? 0.5) * 100));
  setVal("textY", Math.round((ts.y ?? 0.5) * 100));
  setVal("textYOut", Math.round((ts.y ?? 0.5) * 100));
  const shadow = document.getElementById("textShadow");
  if (shadow) shadow.checked = !!ts.shadow;
  const upper = document.getElementById("textUpper");
  if (upper) upper.checked = !!ts.uppercase;
  setVal("textSpacing", ts.letterSpacing || 0);
  setVal("textSpacingOut", ts.letterSpacing || 0);
}

function setVal(id, v) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.type === "checkbox") el.checked = !!v;
  else el.value = v == null ? "" : String(v);
}

function readStyleFromForm() {
  const bgRaw = document.getElementById("textBg")?.value || "#000000";
  const bgAlpha = document.getElementById("textBgAlpha");
  const a = bgAlpha ? Number(bgAlpha.value) / 100 : 0;
  const bg =
    a <= 0.01
      ? "rgba(0,0,0,0)"
      : `rgba(${parseInt(bgRaw.slice(1, 3), 16)},${parseInt(bgRaw.slice(3, 5), 16)},${parseInt(bgRaw.slice(5, 7), 16)},${a})`;

  return {
    content: document.getElementById("textContent")?.value || "Title",
    font: document.getElementById("textFont")?.value || "Segoe UI",
    size: Number(document.getElementById("textSize")?.value || 48),
    weight: Number(document.getElementById("textWeight")?.value || 700),
    color: document.getElementById("textColor")?.value || "#ffffff",
    bg,
    pos: document.getElementById("textPos")?.value || "center",
    anim: document.getElementById("textAnim")?.value || "fade",
    align: document.getElementById("textAlign")?.value || "center",
    x: Number(document.getElementById("textX")?.value || 50) / 100,
    y: Number(document.getElementById("textY")?.value || 50) / 100,
    shadow: !!document.getElementById("textShadow")?.checked,
    uppercase: !!document.getElementById("textUpper")?.checked,
    letterSpacing: Number(document.getElementById("textSpacing")?.value || 0),
  };
}

export function initTextPanel() {
  const root = document.getElementById("textPresetGrid");
  if (root) {
    root.innerHTML = "";
    PRESETS.forEach((p) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "preset";
      btn.innerHTML = `<strong>${p.label}</strong><span>${p.desc}</span>`;
      btn.addEventListener("click", () => {
        applyStyleToSelected({ ...DEFAULT_TEXT_STYLE, ...p.style }, {
          toastMsg: `Applied “${p.label}”`,
        });
        syncControlsFromClip();
      });
      root.appendChild(btn);
    });
  }

  document.getElementById("btnAddTitle")?.addEventListener("click", () => {
    const style = readStyleFromForm();
    const clip = store.addClip({
      type: "text",
      trackId: "t1",
      name: style.content.split("\n")[0].slice(0, 24) || "Title",
      text: style.content,
      start: Math.round((window.__aifimoraPlayhead || 0) * 10) / 10,
      duration: 3,
      textStyle: { ...DEFAULT_TEXT_STYLE, ...style },
    });
    store.set({ selectedClipId: clip.id });
    toast("Title added to Text track", "ok");
    document.querySelector('[data-inspector="textpanel"]')?.click();
    syncControlsFromClip();
  });

  document.getElementById("btnAddTitleFromLib")?.addEventListener("click", () => {
    const style = readStyleFromForm();
    const clip = store.addClip({
      type: "text",
      trackId: "t1",
      name: style.content.split("\n")[0].slice(0, 24) || "Title",
      text: style.content,
      start: Math.round((window.__aifimoraPlayhead || 0) * 10) / 10,
      duration: 3,
      textStyle: { ...DEFAULT_TEXT_STYLE, ...style },
    });
    store.set({ selectedClipId: clip.id });
    document.querySelector('[data-inspector="textpanel"]')?.click();
    toast("Title added — edit in Text panel or on preview", "ok");
    syncControlsFromClip();
  });

  document.getElementById("btnClearAnim")?.addEventListener("click", () => {
    const id = store.get().selectedClipId;
    if (!id) return toast("Select a text clip first");
    store.pushUndo("Remove animation");
    store.updateClip(id, { textStyle: { anim: "none" } });
    syncControlsFromClip();
    toast("Animation removed", "ok");
  });

  document.getElementById("btnApplyText")?.addEventListener("click", () => {
    applyStyleToSelected(readStyleFromForm(), { toastMsg: "Text style updated" });
  });

  // ----- Filmora font picker (287 real Filmora fonts loaded via @font-face) -----
  initFilmoraFontPicker();

  // ----- Filmora caption-animation thumbnail gallery -----
  initCaptionAnimationGallery();

  const bindLive = (id, key, map) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("input", () => {
      const raw = map ? map(el) : el.value;
      applyStyleToSelected({ [key]: raw });
    });
  };

  bindLive("textContent", "content");
  bindLive("textFont", "font");
  bindLive("textSize", "size", (el) => Number(el.value));
  bindLive("textWeight", "weight", (el) => Number(el.value));
  bindLive("textColor", "color");
  bindLive("textPos", "pos");
  bindLive("textAnim", "anim");
  bindLive("textAlign", "align");
  bindLive("textX", "x", (el) => Number(el.value) / 100);
  bindLive("textY", "y", (el) => Number(el.value) / 100);
  bindLive("textSpacing", "letterSpacing", (el) => Number(el.value));
  bindLive("textBg", "bg", () => readStyleFromForm().bg);
  bindLive("textBgAlpha", "bg", () => readStyleFromForm().bg);

  document.getElementById("textShadow")?.addEventListener("change", (e) => {
    applyStyleToSelected({ shadow: e.target.checked });
  });
  document.getElementById("textUpper")?.addEventListener("change", (e) => {
    applyStyleToSelected({ uppercase: e.target.checked });
  });

  // slider outputs
  const pairs = [
    ["textSize", "textSizeOut"],
    ["textX", "textXOut"],
    ["textY", "textYOut"],
    ["textSpacing", "textSpacingOut"],
    ["textBgAlpha", "textBgAlphaOut"],
  ];
  pairs.forEach(([src, out]) => {
    document.getElementById(src)?.addEventListener("input", () => {
      const o = document.getElementById(out);
      if (o) o.textContent = document.getElementById(src).value;
    });
  });

  store.subscribe(() => syncControlsFromClip());
  syncControlsFromClip();
}

/* ----- Filmora font picker ------------------------------------------------------ */
let _fontShowAll = false;

/* One entry per family: the tile shows a specimen, the <select> keeps the
 * weight/style variants. 262 files / 87 MB means we must never load them all. */
function fontFamilies() {
  const byFamily = new Map();
  assetFonts().forEach((f) => {
    const cur = byFamily.get(f.family);
    if (!cur) { byFamily.set(f.family, { family: f.family, faces: [f] }); return; }
    cur.faces.push(f);
  });
  return [...byFamily.values()].sort((a, b) => a.family.localeCompare(b.family));
}

/* Lazily download a face, then swap the tile from the UI font to the real one. */
const _loadedFaces = new Set();
function loadFace(face) {
  const key = face.family + "|" + face.weight + "|" + face.style;
  if (_loadedFaces.has(key)) return Promise.resolve(true);
  _loadedFaces.add(key);
  const spec = `${face.style === "normal" ? "" : face.style + " "}${face.weight} 20px "${face.family}"`;
  if (!document.fonts || !document.fonts.load) return Promise.resolve(false);
  return document.fonts.load(spec).then(() => document.fonts.check(spec)).catch(() => false);
}

function initFilmoraFontPicker() {
  const sel = document.getElementById("textFont");
  const toggle = document.getElementById("textFontToggle");
  const preview = document.getElementById("textFontPreview");
  if (!sel) return;

  function paintOptions() {
    const list = _fontShowAll ? assetFonts() : featuredFontFamilies();
    // group options by family (one entry per family + "(weight style)" suffix)
    const byFamily = new Map();
    list.forEach((f) => {
      if (!byFamily.has(f.family)) byFamily.set(f.family, []);
      byFamily.get(f.family).push(f);
    });
    sel.innerHTML = "";
    for (const [family, weights] of byFamily) {
      const og = document.createElement("optgroup");
      og.label = family;
      weights.forEach((w) => {
        const opt = document.createElement("option");
        opt.value = family;
        opt.dataset.weight = w.weight;
        opt.dataset.style = w.style;
        opt.textContent = `${family} · ${w.weight}${w.style !== "normal" ? " " + w.style : ""}`;
        og.appendChild(opt);
      });
      sel.appendChild(og);
    }
  }
  paintOptions();

  /* The grid lists all 186 families but the <select> defaults to the curated 23,
   * so a tile may name a family the dropdown has no option for. Without this the
   * assignment silently no-ops and the change handler reads the stale value. */
  function ensureOption(family, faces) {
    if ([...sel.options].some((o) => o.value === family)) return;
    const og = document.createElement("optgroup");
    og.label = family;
    faces.forEach((w) => {
      const opt = document.createElement("option");
      opt.value = family;
      opt.dataset.weight = w.weight;
      opt.dataset.style = w.style;
      opt.textContent = `${family} · ${w.weight}${w.style !== "normal" ? " " + w.style : ""}`;
      og.appendChild(opt);
    });
    sel.appendChild(og);
  }

  function applyFamily(family, weight, style) {
    if (preview) {
      preview.style.fontFamily = `"${family}", sans-serif`;
      preview.style.fontWeight = weight;
      preview.style.fontStyle = style;
    }
    // Push the chosen weight/style back into the text panel's weight picker
    const weightSel = document.getElementById("textWeight");
    if (weightSel && weightSel.querySelector(`option[value="${weight}"]`)) weightSel.value = String(weight);
    applyStyleToSelected({ font: family, weight, weightStyle: style });
  }

  function applyPreview() {
    const opt = sel.selectedOptions?.[0];
    if (!opt) return;
    const family = opt.value;
    const weight = Number(opt.dataset.weight) || 400;
    const style = opt.dataset.style || "normal";
    if (preview) preview.style.fontFamily = `"${family}", sans-serif`;
    if (preview) preview.style.fontWeight = weight;
    if (preview) preview.style.fontStyle = style;
  }

  sel.addEventListener("change", () => {
    applyPreview();
    const opt = sel.selectedOptions?.[0];
    if (!opt) return;
    applyFamily(opt.value, Number(opt.dataset.weight) || 400, opt.dataset.style || "normal");
  });

  toggle?.addEventListener("click", () => {
    _fontShowAll = !_fontShowAll;
    toggle.textContent = _fontShowAll ? "Curated ▾" : "All ▾";
    toggle.title = _fontShowAll
      ? `Showing all ${assetFonts().length} Filmora fonts`
      : `Showing curated subset — click to expose all ${assetFonts().length} Filmora fonts`;
    paintOptions();
  });

  // initial preview
  applyPreview();

  /* ----- visual grid (1.6.0) --------------------------------------------- */
  const grid = document.getElementById("fontGrid");
  const gridSearch = document.getElementById("fontSearch");
  const gridHint = document.getElementById("fontGridHint");
  let _io = null;

  function paintGrid(filter = "") {
    if (!grid) return;
    if (_io) { _io.disconnect(); _io = null; }
    const all = fontFamilies();
    const q = filter.trim().toLowerCase();
    const list = q ? all.filter((f) => f.family.toLowerCase().includes(q)) : all;
    grid.innerHTML = "";
    if (gridHint) {
      gridHint.textContent = q
        ? `${list.length} of ${all.length} families`
        : `${all.length} families · ${assetFonts().length} faces · fonts load as you scroll`;
    }
    if (!list.length) {
      const empty = document.createElement("div");
      empty.style.cssText = "grid-column:1/-1;text-align:center;padding:16px;color:var(--muted);font-size:11px";
      empty.textContent = "No fonts match.";
      grid.appendChild(empty);
      return;
    }
    const current = selectedClip()?.textStyle?.font;
    const frag = document.createDocumentFragment();
    list.forEach((entry) => {
      const face = entry.faces[0];
      const tile = document.createElement("button");
      tile.type = "button";
      tile.className = "font-tile" + (entry.family === current ? " applied" : "");
      tile.dataset.family = entry.family;
      tile.title = `${entry.family} — ${entry.faces.length} weight${entry.faces.length > 1 ? "s" : ""}`;
      const sample = document.createElement("span");
      sample.className = "font-tile-sample";
      sample.textContent = "Aa Bb Cc 123";
      const name = document.createElement("span");
      name.className = "font-tile-name";
      name.textContent = entry.family;
      tile.append(sample, name);
      tile.addEventListener("click", () => {
        const face = entry.faces.find((f) => f.weight === 400 && f.style === "normal") || entry.faces[0];
        ensureOption(entry.family, entry.faces);
        sel.value = entry.family;
        applyFamily(entry.family, face.weight, face.style);
        grid.querySelectorAll(".font-tile.applied").forEach((n) => n.classList.remove("applied"));
        tile.classList.add("applied");
      });
      frag.appendChild(tile);
    });
    grid.appendChild(frag);

    // Only fetch a face once its tile is actually on screen.
    if ("IntersectionObserver" in window) {
      _io = new IntersectionObserver((entries, obs) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          obs.unobserve(e.target);
          const fam = e.target.dataset.family;
          const entry2 = list.find((x) => x.family === fam);
          if (!entry2) return;
          Promise.all(entry2.faces.slice(0, 4).map(loadFace)).then((res) => {
            if (!res.some(Boolean)) return;
            const s = e.target.querySelector(".font-tile-sample");
            const f0 = entry2.faces[0];
            if (s) s.style.fontFamily = `"${f0.family}", sans-serif`;
            if (s) { s.style.fontWeight = f0.weight; s.style.fontStyle = f0.style; }
          });
        });
      }, { root: grid, rootMargin: "120px" });
      grid.querySelectorAll(".font-tile").forEach((t) => _io.observe(t));
    }
  }

  paintGrid();
  gridSearch?.addEventListener("input", () => paintGrid(gridSearch.value));

  // When a clip selection changes, sync the picker to its current font
  store.subscribe(() => {
    const clip = selectedClip();
    if (!clip?.textStyle) return;
    if (preview) preview.style.fontFamily = `"${clip.textStyle.font || "Segoe UI"}", sans-serif`;
    grid?.querySelectorAll(".font-tile.applied").forEach((n) => n.classList.remove("applied"));
    const hit = grid?.querySelector(`.font-tile[data-family="${CSS.escape(clip.textStyle.font || "")}"]`);
    hit?.classList.add("applied");
  });
}

/* ----- Caption animation thumbnail gallery --------------------------------------- */
function initCaptionAnimationGallery() {
  const grid = document.getElementById("capAnimGrid");
  if (!grid) return;
  const search = document.getElementById("capAnimSearch");
  const kindSel = document.getElementById("capAnimKind");

  function paint(filter = "", kind = "all") {
    const all = captionAnimations();
    const norm = (s) => s.toLowerCase();
    const q = norm(filter);
    const list = all.filter((a) => {
      if (a.key == null) return false; // hide "No Animation"
      if (kind !== "all" && a.kind !== kind) return false;
      if (q && !norm(a.label).includes(q)) return false;
      return true;
    });
    grid.innerHTML = "";
    if (!list.length) {
      const empty = document.createElement("div");
      empty.style.cssText = "grid-column:1/-1;text-align:center;padding:18px;color:var(--muted);font-size:11px";
      empty.textContent = "No animations match.";
      grid.appendChild(empty);
      return;
    }
    const currentAnim = selectedClip()?.textStyle?.anim || "fade";
    list.forEach((a) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "caption-anim" + (a.key === currentAnim ? " applied" : "");
      cell.title = `${a.label} → anim: ${a.key || "none"}`;
      cell.innerHTML = `
        <img loading="lazy" src="${a.thumb}" alt="${a.label}" />
        <span class="caption-anim-label">${a.label}</span>`;
      cell.addEventListener("click", () => {
        applyStyleToSelected({ anim: a.key }, { toastMsg: `Animation → ${a.label}` });
        // refresh the highlighted cell
        grid.querySelectorAll(".caption-anim.applied").forEach((n) => n.classList.remove("applied"));
        cell.classList.add("applied");
      });
      grid.appendChild(cell);
    });
  }

  paint();
  search?.addEventListener("input", () => paint(search.value, kindSel?.value || "all"));
  kindSel?.addEventListener("change", () => paint(search?.value || "", kindSel.value));

  // Refresh applied marker when selection changes
  store.subscribe(() => {
    const anim = selectedClip()?.textStyle?.anim || null;
    grid.querySelectorAll(".caption-anim").forEach((n) => {
      const matches = n.title.endsWith(`anim: ${anim || "none"}`);
      n.classList.toggle("applied", !!matches);
    });
  });
}

export { PRESETS, ensureTextClip };
