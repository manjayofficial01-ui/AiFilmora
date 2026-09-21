/* media-menu.js — Filmora 14-style media menu:
 *
 *  • Full top tab row: Media · Stock Media · Audio · Titles · Transitions ·
 *    Effects · Filters · Stickers · Templates · AI Tools
 *  • Context-aware LEFT CATEGORY RAIL inside every library panel — the rail's
 *    categories change with the active tab and actually filter that panel's
 *    grid (Media counts, Stock Media packs, Audio families, section switchers…)
 *  • Independent Player panel header (Player chip + Full button)
 *
 * Tab data-sidebar ids stay stable so all existing bindings/tests keep working. */
import { renderMediaBin } from "./media.js";
import { store } from "./state.js";
import { toast } from "./media.js";
import { families as audioFamilies } from "./audio-fx.js";
import { hydrateIcons } from "./icons.js";

const TAB_LABELS = {
  media: "Media",
  assets: "Stock Media",
  audio: "Audio",
  textpresets: "Titles",
  transitions: "Transitions",
  effects: "Effects",
  filters: "Filters",
  shapes: "Stickers",
  templates: "Templates",
  tools: "AI Tools",
};
const TAB_ICONS = {
  media: "media", assets: "grid", audio: "volume", textpresets: "text",
  transitions: "transitions", effects: "effects", filters: "fx",
  shapes: "shapes", templates: "layers", tools: "aiTools",
};
const TAB_TITLES = {
  media: "Media", assets: "Installed stock + asset packs", audio: "Audio effects",
  textpresets: "Text presets", transitions: "Transitions", effects: "Effects & AI tools",
  filters: "LUTs & color grades", shapes: "Stickers & shapes",
  templates: "Project templates", tools: "AI tools",
};

/* ---------------- helpers ---------------------------------------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function ensureRail(view, title, cats, onPick, opts = {}) {
  if (view.querySelector(".cat-rail")) return view.querySelector(".cat-rail");
  view.classList.add("has-rail");
  const rail = document.createElement("nav");
  rail.className = "cat-rail";
  rail.setAttribute("aria-label", (opts?.label || "Categories"));
  if (opts?.title) {
    const t = document.createElement("div");
    t.className = "cat-rail-title";
    t.textContent = opts.title || "Library";
    rail.append(t);
  }
  const build = (catList) => {
    rail.querySelectorAll(".cat-item").forEach((b) => b.remove());
    for (const c of catList) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cat-item" + (c.active ? " active" : "");
      btn.dataset.cat = c.id;
      btn.innerHTML = `<span class="cat-lbl">${c.label}</span>` + (c.count != null ? `<span class="cat-count">${c.count}</span>` : "");
      btn.addEventListener("click", () => {
        rail.querySelectorAll(".cat-item").forEach((b) => b.classList.toggle("active", b === btn));
        onPick(c.id, btn);
      });
      rail.append(btn);
    }
  };
  build(cats);
  rail.refresh = (list) => build(list);
  view.prepend(rail);
  return rail;
}

function hide(el) { if (el) el.hidden = true; }

/** Group a panel body by .section-title boundaries → [{title, els}] */
function sectionGroups(body) {
  const groups = [];
  let cur = null;
  [...body.children].forEach((el) => {
    if (el.classList.contains("section-title")) {
      cur = { title: el.textContent.trim().toLowerCase(), els: [el] };
      groups.push(cur);
    } else if (cur) cur.els.push(el);
    else groups.push({ title: "", els: [el] }), (cur = groups[0]);
  });
  return groups;
}

function showGroups(groups, keep) {
  groups.forEach((g) => {
    const on = keep === "all" || g.title.includes(keep);
    g.els.forEach((el) => {
      if (el.classList.contains("cat-rail")) return; // never hide the rail itself
      el.hidden = !on;
    });
  });
}

/* ---------------- per-panel category rails ---------------------------------------- */
function railMedia(view) {
  const counts = () => {
    const c = { video: 0, audio: 0, image: 0, ai: 0 };
    for (const m of store.get().media) {
      const k = (m.kind || "").toLowerCase();
      if (k in c) c[k]++;
      if (m.generated || m.model) c.ai++;
    }
    return c;
  };
  const catList = () => {
    const c = counts();
    return [
      { id: "all", label: "Library", count: store.get().media.length },
      { id: "video", label: "Video", count: c.video },
      { id: "audio", label: "Audio", count: c.audio },
      { id: "image", label: "Images", count: c.image },
      { id: "ai", label: "AI Generated", count: c.ai },
    ];
  };
  const pick = (id) => {
    rail.dataset.cat = id;
    window.__aifimoraMediaCat = id;
    window.__aifimoraMediaFilterDirty = true;
    renderMediaBin($("#mediaGrid"), $("#mediaSearch")?.value || "", id);
  };
  const rail = ensureRail(view, "Library", catList(), pick, { title: "Library", label: "Media categories" });
  rail.dataset.cat = window.__aifimoraMediaCat || "all";
  window.__aifimoraMediaCat = rail.dataset.cat;
  window.__aifimoraRefreshMediaRail = () => {
    rail.refresh(catList());
    queueMicrotask(() => pick(rail.dataset.cat || "all"));
  };
}

function railStock(view) {
  const cats = [
    { id: "all", label: "Trending" },
    { id: "video", label: "Video" },
    { id: "image", label: "Images" },
    { id: "transitions", label: "Transitions" },
    { id: "styles", label: "Textures" },
    { id: "cinematic", label: "Cinematic" },
    { id: "music", label: "Music" },
    { id: "intro", label: "Intro" },
    { id: "vertical", label: "Vertical" },
  ];
  ensureRail(view, "Asset Center", cats, (id) => {
    const grid = $("#assetGrid");
    if (!grid) return;
    const chip = $(`#assetCats [data-asset-cat="${id === "transitions" ? "transitions" : id === "styles" ? "styles" : "media"}"]`);
    chip?.click();
    const kw = {
      cinematic: /4k|woven|blur/i,
      music: /music/i,
      intro: /image to video|player preview/i,
      vertical: /reframe/i,
    };
    const cards = $$("#assetGrid .media-card", grid);
    if (id === "all" || id === "transitions" || id === "styles") {
      cards.forEach((c) => { c.hidden = false; });
    } else if (kw[id]) {
      cards.forEach((c) => {
        const label = c.querySelector("strong")?.textContent || "";
        c.hidden = !kw[id].test(label);
      });
    } else {
      cards.forEach((c) => {
        const badge = (c.querySelector(".media-badge")?.textContent || "").trim().toLowerCase();
        c.hidden = badge !== id;
      });
    }
    const status = $("#assetStatus");
    if (status) {
      const shown = cards.filter((c) => !c.hidden).length;
      if (id !== "all" && !["transitions", "styles"].includes(id)) status.textContent = `${shown} stock items`;
    }
  }, { title: "Asset Center", label: "Stock media categories" });
}

function railAudio(view) {
  const list = () => [
    { id: "all", label: "All" },
    ...audioFamilies().map((f) => ({ id: f.label.toLowerCase(), label: f.label, count: f.count })),
  ];
  const rail = ensureRail(view, "Families", list(), (id) => {
    const input = $("#side-audio .library-search");
    if (!input) return;
    input.value = id === "all" ? "" : id;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, { title: "Families", label: "Audio effect families" });
  rail.dataset.cat = "all";
}

function railFilters(view) {
  ensureRail(view, "Type", [
    { id: "all", label: "All" },
    { id: "lut", label: "3D LUT" },
    { id: "color", label: "Color Grade" },
  ], (id) => {
    const cards = $$("#side-filters .library-asset-card");
    cards.forEach((c) => {
      c.hidden = id !== "all" && c.dataset.assetKind !== id;
    });
    const out = $("#side-filters .library-result-count");
    if (out) out.textContent = `${cards.filter((c) => !c.hidden).length} / ${cards.length} presets`;
  }, { title: "Type", label: "Filter types" });
}

function railTitles(view) {
  const catOf = (card) => {
    const label = (card.querySelector("strong")?.textContent || card.textContent || "").toLowerCase();
    if (label.includes("lower")) return "thirds";
    if (label.includes("subtitle") || label.includes("caption")) return "captions";
    if (label.includes("chapter") || label.includes("credit") || label.includes("end")) return "endings";
    if (label.includes("sticker")) return "stickers";
    return "openers";
  };
  ensureRail(view, "Categories", [
    { id: "all", label: "All" },
    { id: "openers", label: "Openers" },
    { id: "thirds", label: "Lower Thirds" },
    { id: "captions", label: "Captions" },
    { id: "endings", label: "Endings" },
    { id: "stickers", label: "Stickers" },
  ], (id) => {
    $$("#textPresetGrid > *").forEach((card) => {
      card.hidden = id !== "all" && catOf(card) !== id;
    });
  }, { title: "Categories", label: "Title categories" });
}

function railTransitions(view) {
  const groups = sectionGroups($(".panel-body", view));
  ensureRail(view, "Types", [
    { id: "all", label: "All" },
    { id: "preview", label: "Preview" },
    { id: "shader", label: "Shader" },
    { id: "filmora", label: "Filmora" },
    { id: "built-in", label: "Built-in" },
    { id: "custom", label: "Custom" },
  ], (id) => showGroups(groups, id === "all" ? "all" : id), { title: "Types", label: "Transition types" });
}

function railEffects(view) {
  const groups = sectionGroups($(".panel-body", view));
  ensureRail(view, "Groups", [
    { id: "all", label: "All" },
    { id: "looks", label: "Looks" },
    { id: "isolation", label: "Isolation & Audio" },
    { id: "filmora", label: "Filmora AI" },
  ], (id) => {
    if (id === "all") return showGroups(groups, "all");
    showGroups(groups, { looks: "looks", isolation: "isolation", filmora: "filmora" }[id]);
  }, { title: "Groups", label: "Effect groups" });
}

function railStickers(view) {
  hide($("#shapeCats"));
  ensureRail(view, "Categories", [
    { id: "all", label: "All" },
    { id: "basic", label: "Basic" },
    { id: "arrow", label: "Arrows" },
    { id: "badge", label: "Badges" },
    { id: "user", label: "Mine" },
    { id: "fav", label: "★ Fav" },
  ], (id) => {
    const chip = $(`#shapeCats [data-shape-cat="${id}"]`);
    if (chip) chip.click();
  }, { title: "Categories", label: "Sticker categories" });
}

function railTools(view) {
  const MAP = {
    toolVoiceChanger: "audio", toolVoiceClone: "audio", toolSfx: "audio",
    toolMotionBlur: "video", toolDeflicker: "video", toolSubtitles: "video",
    toolAutoSync: "video",
    toolChart: "data", toolChartImport: "data", toolVisualizer: "data",
    toolChapterAdd: "data", toolChapterExport: "data", toolSubproject: "data",
  };
  ensureRail(view, "Groups", [
    { id: "all", label: "All" },
    { id: "audio", label: "AI Audio" },
    { id: "video", label: "AI Video" },
    { id: "data", label: "Data & Chapters" },
  ], (id) => {
    $$("#side-tools .tool-item").forEach((el) => {
      el.hidden = id !== "all" && MAP[el.id] !== id;
    });
  }, { title: "Groups", label: "AI tool groups" });
}

/* ---------------- Templates panel (new) -------------------------------------------- */
function setAspect(v) {
  const sel = document.getElementById("previewAspect");
  if (!sel) return;
  sel.value = v;
  sel.dispatchEvent(new Event("change", { bubbles: true }));
}

const TEMPLATES = [
  { id: "demo", cat: "all", label: "Demo Cut", desc: "Sample timeline, titles + beat markers", ico: "▶", run: () => document.getElementById("frDemo")?.click() },
  { id: "vertical", cat: "social", label: "Vertical Social", desc: "9:16 shorts / reels canvas", ico: "▯", run: () => setAspect("9:16") },
  { id: "square", cat: "social", label: "Square Post", desc: "1:1 feed post canvas", ico: "▣", run: () => setAspect("1:1") },
  { id: "cine", cat: "cinematic", label: "Cinematic Scope", desc: "21:9 anamorphic canvas", ico: "▭", run: () => setAspect("21:9") },
  { id: "grade", cat: "cinematic", label: "Cinematic LUT", desc: "Apply the Batman 3D LUT to selection", ico: "◑", run: () => { document.querySelector('[data-sidebar="filters"]')?.click(); setTimeout(() => document.querySelector('#side-filters [data-asset-kind="lut"]')?.click(), 350); } },
  { id: "title", cat: "cinematic", label: "Title Intro", desc: "Main Title preset at playhead", ico: "T", run: () => { document.getElementById("btnAddTitleFromLib")?.click(); toast("Title Intro added at playhead", "ok"); } },
  { id: "captions", cat: "ai", label: "Auto Captions", desc: "AI Mate captions for the timeline", ico: "cc", run: () => document.querySelector('[data-quick="Add auto captions"]')?.click() },
  { id: "beats", cat: "ai", label: "Beat Montage", desc: "Cut clips to detected beats", ico: "♫", run: () => document.querySelector('[data-tool="beatMontage"]')?.click() },
];

function buildTemplates(view) {
  const cats = [
    { id: "all", label: "All" },
    { id: "social", label: "Social" },
    { id: "cinematic", label: "Cinematic" },
    { id: "ai", label: "AI Assist" },
  ];
  ensureRail(view, "Categories", cats, (id) => {
    $$("#templateGrid .template-card").forEach((c) => {
      c.hidden = id !== "all" && c.dataset.tcat !== id;
    });
  }, { title: "Categories", label: "Template categories" });
  const body = $(".panel-body", view);
  const grid = document.createElement("div");
  grid.id = "templateGrid";
  grid.className = "template-grid";
  TEMPLATES.forEach((t) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "template-card";
    card.dataset.tcat = t.cat;
    card.innerHTML = `<span class="template-ico">${t.ico}</span><span class="template-txt"><strong>${t.label}</strong><span>${t.desc}</span></span>`;
    card.addEventListener("click", () => t.run());
    grid.append(card);
  });
  body.append(grid);
}

function ensureTemplatesView(sidebar) {
  let view = document.getElementById("side-templates");
  if (view) return view;
  view = document.createElement("div");
  view.id = "side-templates";
  view.className = "sidebar-view";
  view.innerHTML = `<div class="panel-body"><div class="section-title">Project templates</div>
    <p class="library-note">One click applies the whole recipe — canvas, presets, or an AI action. Currently ${TEMPLATES.length} templates.</p></div>`;
  sidebar.append(view);
  buildTemplates(view);
  return view;
}

/* ---------------- top tab row (Filmora media menu) --------------------------------- */
function restructureTabs() {
  const tabs = document.getElementById("libraryTabs");
  if (!tabs) return;

  // Templates tab (before AI Tools)
  if (!tabs.querySelector('[data-sidebar="templates"]')) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab";
    btn.dataset.sidebar = "templates";
    btn.dataset.icon = "layers";
    btn.title = TAB_TITLES.templates;
    btn.innerHTML = `<span class="tab-ico"></span><span class="tab-lbl">Templates</span>`;
    tabs.insertBefore(btn, tabs.querySelector('[data-sidebar="tools"]'));
  }

  // Relabel + re-icon + reorder to Filmora order
  const ORDER = ["media", "assets", "audio", "textpresets", "transitions", "effects", "filters", "shapes", "templates", "tools"];
  for (const id of ORDER) {
    const btn = tabs.querySelector(`[data-sidebar="${id}"]`);
    if (!btn) continue;
    btn.dataset.icon = TAB_ICONS[id];
    btn.title = TAB_TITLES[id];
    const lbl = btn.querySelector(".tab-lbl");
    if (lbl) lbl.textContent = TAB_LABELS[id];
    btn.setAttribute("aria-label", TAB_LABELS[id]);
    tabs.append(btn); // append re-orders
  }
  hydrateIcons(tabs);
}

/* ---------------- independent Player panel header ----------------------------------- */
function buildPlayerHeader() {
  const bar = document.querySelector(".preview-tabs");
  if (!bar || bar.querySelector(".player-chip")) return;
  const chip = document.createElement("span");
  chip.className = "player-chip";
  chip.textContent = "Player";
  bar.prepend(chip);
  const full = document.createElement("button");
  full.type = "button";
  full.className = "ptab player-full";
  full.id = "btnPlayerFull";
  full.title = "Full player (F)";
  full.textContent = "Full";
  full.addEventListener("click", () =>
    window.dispatchEvent(new CustomEvent("aifimora:fullscreen-preview")));
  bar.querySelector(".preview-spacer")?.before(full);
}

/* ---------------- main -------------------------------------------------------------- */
export function initMediaMenu() {
  restructureTabs();
  const sidebar = document.querySelector(".sidebar");
  if (!sidebar) return;

  ensureTemplatesView(sidebar);

  const RAILS = [
    ["side-media", railMedia],
    ["side-assets", railStock],
    ["side-audio", railAudio],
    ["side-textpresets", railTitles],
    ["side-transitions", railTransitions],
    ["side-effects", railEffects],
    ["side-filters", railFilters],
    ["side-shapes", railStickers],
    ["side-templates", railTemplatesStub],
    ["side-tools", railTools],
  ];
  for (const [id, fn] of RAILS) {
    const view = document.getElementById(id);
    if (view) fn(view);
  }
  buildPlayerHeader();
  hydrateIcons(sidebar);
}

function railTemplatesStub(view) { /* rail built inside buildTemplates */ }

