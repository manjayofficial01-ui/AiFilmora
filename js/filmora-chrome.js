/* filmora-chrome.js — true Filmora 14/15 shell behaviors.
 *
 *  • Content-aware Properties accordion (selection type drives sections)
 *  • Dock collapse/restore for Library / Properties / Timeline
 *  • Filmora transport glyphs (replaces emoji)
 *  • Export▾ destination menu (Local / Device / YouTube / TikTok / Vimeo / DVD)
 *  • File menu Import / Exit + View panel toggles
 *  • Timeline toolbar becomes an icon strip
 */
import { store } from "./state.js";
import { toast } from "./media.js";
import { hydrateIcons, ICONS, iconSvg } from "./icons.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------------- Content-aware Properties ------------------------------------ */
const SECTIONS = {
  none: [],
  video: ["video", "color", "anim", "speed", "mask", "ai"],
  image: ["video", "color", "anim", "mask", "ai"],
  text: ["text", "anim", "ai"],
  audio: ["audio", "ai"],
  transition: ["anim"],
  shape: ["video", "color", "anim"],
  ai: ["video", "ai"],
};

function clipSectionKeys(clip) {
  if (!clip) return SECTIONS.none;
  const t = (clip.type || "video").toLowerCase();
  if (t === "audio") return SECTIONS.audio;
  if (t === "text") return SECTIONS.text;
  if (t === "transition") return SECTIONS.transition;
  if (t === "shape" || clip.shape) return SECTIONS.shape;
  if (t === "image" || t === "img") return SECTIONS.image;
  if (clip.model || t === "gen" || t === "ai") return SECTIONS.ai;
  return SECTIONS.video;
}

/* One panel, one navigator: the 11-tab strip stays visible on top and the
 * content-aware accordion lives directly below it, inside the same
 * `.inspector` column. Tab clicks reveal their section; selection changes
 * filter sections without ever leaving a blank void (empty-state instead). */
const TAB_TO_SECTION = {
  fx: "color",
  motion: "video",
  speed: "speed",
  volume: "audio",
  textpanel: "text",
  creative: "mask",
  mate: "ai",
  lab: "ai",
  aisettings: "ai",
  text: "ai",
  scopes: "ai",
};

/* An explicit tab click always wins over the content filter: unhide the
 * section that owns the now-active view so the panel never looks dead. */
function revealActiveViews() {
  const acc = $("#propsAccordion");
  if (!acc) return;
  const actives = acc.querySelectorAll(".props-view.active");
  if (!actives.length) return;
  hideEmptyState();
  let first = null;
  actives.forEach((v) => {
    const sec = v.closest(".props-sec");
    if (!sec) return;
    sec.hidden = false;
    sec.classList.add("open");
    sec.querySelector(".props-head")?.setAttribute("aria-expanded", "true");
    first ||= sec;
  });
  first?.scrollIntoView({ block: "nearest" });
}

function hideEmptyState() {
  $("#propsEmpty")?.setAttribute("hidden", "");
}

function maybeShowEmptyState() {
  const acc = $("#propsAccordion");
  if (!acc) return;
  const anyVisible = !!acc.querySelector(".props-sec:not([hidden])");
  $("#propsEmpty")?.toggleAttribute("hidden", anyVisible);
}

function dimOffContextTabs() {
  const acc = $("#propsAccordion");
  const nav = $("#inspectorTabs");
  if (!acc || !nav) return;
  const visible = new Set(
    [...acc.querySelectorAll(".props-sec:not([hidden])")].map((s) => s.dataset.sec)
  );
  nav.querySelectorAll("[data-inspector]").forEach((btn) => {
    btn.classList.toggle("is-off", !visible.has(TAB_TO_SECTION[btn.dataset.inspector]));
  });
}

function ensurePropsAccordion() {
  const insp = $(".inspector");
  if (!insp) return;

  // The tab strip is the panel navigator: keep it visible and titled.
  const header = [...insp.querySelectorAll(".panel-header.compact")][1];
  if (header) {
    header.hidden = false;
    header.classList.add("props-nav");
    if (!header.querySelector(".props-title")) {
      header.querySelector("h2")?.remove();
      const t = document.createElement("h2");
      t.className = "props-title";
      t.textContent = "Properties";
      header.prepend(t);
    }
  }

  let wrap = $("#propsAccordion");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "propsAccordion";
    wrap.className = "props-accordion";
    const bodyHost = document.createElement("div");
    bodyHost.className = "props-scroll";

    // Empty-state placeholder: shown only when the content filter hides
    // every section, so the panel never renders as a blank void.
    const empty = document.createElement("div");
    empty.id = "propsEmpty";
    empty.className = "props-empty";
    empty.innerHTML = `
      <p class="props-empty-title">No clip selected</p>
      <p>Select a clip on the timeline to edit its properties here.</p>
      <div class="btn-row">
        <button type="button" class="btn sm" data-props-nav="mate">Open AI Mate</button>
        <button type="button" class="btn sm" data-props-nav="scopes">Open Scopes</button>
      </div>`;
    bodyHost.appendChild(empty);

    const map = [
      { key: "video", label: "Video", tabs: ["motion"] },
      { key: "color", label: "Color", tabs: ["fx"] },
      { key: "anim", label: "Animation", tabs: ["motion"] },
      { key: "speed", label: "Speed", tabs: ["speed"] },
      { key: "audio", label: "Audio", tabs: ["volume"] },
      { key: "text", label: "Text", tabs: ["textpanel"] },
      { key: "mask", label: "Mask / Cutout", tabs: ["creative"] },
      { key: "ai", label: "AI Tools", tabs: ["mate", "lab", "aisettings", "text", "scopes"] },
    ];

    const views = {
      motion: $("#insp-motion"),
      fx: $("#insp-fx"),
      speed: $("#insp-speed"),
      volume: $("#insp-volume"),
      textpanel: $("#insp-textpanel"),
      creative: $("#insp-creative"),
      mate: $("#insp-mate"),
      lab: $("#insp-lab"),
      aisettings: $("#insp-aisettings"),
      text: $("#insp-text"),
      scopes: $("#insp-scopes"),
    };

    // Animation reuses Motion controls (Filmora nests Animation under Video)
    if (views.motion && !$("#insp-motion-anim")) {
      const clone = views.motion.cloneNode(true);
      clone.id = "insp-motion-anim";
      clone.classList.remove("active");
      views.anim = clone;
    } else {
      views.anim = $("#insp-motion-anim") || views.motion;
    }

    for (const sec of map) {
      const item = document.createElement("section");
      item.className = "props-sec";
      item.dataset.sec = sec.key;
      item.innerHTML = `<button type="button" class="props-head" aria-expanded="true"><span class="props-caret">▾</span><span class="props-lbl">${sec.label}</span><span class="props-kind"></span></button><div class="props-body"></div>`;
      const body = item.querySelector(".props-body");
      for (const tab of sec.tabs) {
        const v = views[tab === "motion" && sec.key === "anim" ? "anim" : tab];
        if (!v) continue;
        v.classList.add("props-view");
        if (v.parentElement !== body) body.appendChild(v);
      }
      item.querySelector(".props-head").addEventListener("click", () => {
        const open = item.classList.toggle("open");
        item.querySelector(".props-head").setAttribute("aria-expanded", String(open));
      });
      item.classList.add("open");
      bodyHost.appendChild(item);
    }

    wrap.appendChild(bodyHost);
  }

  // Dock the accordion INSIDE the inspector, directly under the tab strip,
  // so tabs + content-aware settings share one panel window.
  if (wrap.parentElement !== insp) insp.appendChild(wrap);
  if (header && wrap.previousElementSibling !== header) header.after(wrap);

  // Empty-state shortcuts reuse the real navigator tabs.
  if (!wrap.dataset.navBound) {
    wrap.dataset.navBound = "1";
    wrap.addEventListener("click", (e) => {
      const shortcut = e.target.closest("[data-props-nav]");
      if (shortcut) {
        $(`#inspectorTabs [data-inspector="${shortcut.dataset.propsNav}"]`)?.click();
      }
    });
  }

  // Tab strip drives the accordion. This delegated listener runs after the
  // per-button handlers in app.js (bubble phase), so the newly-active view
  // is already set when we reveal its section.
  const nav = $("#inspectorTabs");
  if (nav && !nav.dataset.propsBound) {
    nav.dataset.propsBound = "1";
    nav.addEventListener("click", () => {
      // let app.js toggle .active first
      requestAnimationFrame(() => revealActiveViews());
    });
  }

  hydrateIcons(wrap);
  if (header) hydrateIcons(header);
}

function syncPropsForSelection() {
  const acc = $("#propsAccordion");
  if (!acc) return;
  const s = store.get();
  const clip = store.getClip(s.selectedClipId) || store.getClip(s.selectedClipIds?.[0]);
  const keys = new Set(clipSectionKeys(clip));
  // Sections holding a view the user explicitly opened stay visible even
  // when the content filter would hide them — an open tab never blanks out.
  const chosen = new Set(
    [...acc.querySelectorAll(".props-view.active")]
      .map((v) => v.closest(".props-sec")?.dataset.sec)
      .filter(Boolean)
  );
  acc.querySelectorAll(".props-sec").forEach((sec) => {
    const on = keys.has(sec.dataset.sec) || chosen.has(sec.dataset.sec);
    sec.hidden = !on;
    sec.classList.toggle("open", on);
    sec.querySelector(".props-head")?.setAttribute("aria-expanded", String(on));
    if (on) {
      // ensure at least one view inside is active so panels are visible
      const views = sec.querySelectorAll(".props-view");
      if (views.length && !sec.querySelector(".props-view.active")) {
        views[0].classList.add("active");
      }
    }
  });
  const kind = (clip?.type || "").toString();
  acc.querySelectorAll(".props-kind").forEach((el) => {
    el.textContent = clip ? kind : "";
  });
  const first = acc.querySelector(".props-sec:not([hidden]) .props-view");
  if (first && !acc.querySelector(".props-view.active")) first.classList.add("active");
  maybeShowEmptyState();
  dimOffContextTabs();
}

export function bindContentAwareProps() {
  ensurePropsAccordion();
  const sync = () => syncPropsForSelection();
  store.subscribe(sync);
  sync();
}

/* ---------------- Dock collapse ------------------------------------------------ */
const COLLAPSE_KEY = "aifimora.dock.v1";

function loadCollapse() {
  try {
    return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveCollapse(map) {
  localStorage.setItem(COLLAPSE_KEY, JSON.stringify(map));
}

function applyCollapse(map) {
  const app = $("#app");
  if (!app) return;
  app.classList.toggle("lib-collapsed", !!map.library);
  app.classList.toggle("insp-collapsed", !!map.inspector);
  app.classList.toggle("tl-collapsed", !!map.timeline);
}

function dockBtn(target, title) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "dock-btn";
  b.dataset.dock = target;
  b.title = title;
  b.setAttribute("aria-label", title);
  b.innerHTML = `<span class="dock-chev">‹</span>`;
  return b;
}

function restoreStub(target, title, chev) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "dock-restore";
  b.dataset.dock = target;
  b.title = title;
  b.setAttribute("aria-label", title);
  b.innerHTML = `<span class="dock-chev">${chev}</span><span class="dock-lbl">${target === "library" ? "Library" : "Properties"}</span>`;
  return b;
}

export function setDock(which, on) {
  const next = loadCollapse();
  next[which] = !!on;
  saveCollapse(next);
  applyCollapse(next);
  window.dispatchEvent(new CustomEvent("aifimora:dock"));
}

export function bindDockCollapse() {
  applyCollapse(loadCollapse());

  const sidebar = $(".sidebar");
  const insp = $(".inspector");
  const tl = $("#timelinePanel");
  const workspace = $(".workspace");

  if (sidebar && !sidebar.querySelector(".dock-btn")) {
    sidebar.prepend(dockBtn("library", "Collapse library (Ctrl+1)"));
  }
  if (insp && !insp.querySelector(".dock-btn")) {
    insp.prepend(dockBtn("inspector", "Collapse properties (Ctrl+2)"));
  }
  if (tl && !tl.querySelector(".dock-btn")) {
    tl.querySelector(".tl-toolbar")?.prepend(dockBtn("timeline", "Collapse timeline (Ctrl+3)"));
  }
  // Restore stubs lived in CSS only — create them, otherwise a collapsed
  // panel leaves a dead void with no visible way back.
  if (workspace && !workspace.querySelector('.dock-restore[data-dock="library"]')) {
    workspace.prepend(restoreStub("library", "Show library panel", "›"));
  }
  if (workspace && !workspace.querySelector('.dock-restore[data-dock="inspector"]')) {
    workspace.append(restoreStub("inspector", "Show properties panel", "‹"));
  }

  // Clicking a library tab while the library is collapsed re-opens it:
  // otherwise the tab highlight moves but nothing visible happens.
  if (!document.body.dataset.dockTabsBound) {
    document.body.dataset.dockTabsBound = "1";
    document.getElementById("libraryTabs")?.addEventListener("click", () => {
      if ($("#app")?.classList.contains("lib-collapsed")) setDock("library", false);
    });
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-dock]");
    if (!btn) return;
    toggleDock(btn.dataset.dock);
  });
}

export function toggleDock(which) {
  const next = loadCollapse();
  next[which] = !next[which];
  saveCollapse(next);
  applyCollapse(next);
  window.dispatchEvent(new CustomEvent("aifimora:dock"));
}

/* ---------------- Player transport glyphs -------------------------------------- */
export function bindTransportIcons() {
  const map = {
    btnGoStart: "home",
    btnPrev: "prev",
    btnPlay: "play",
    btnNext: "next",
    btnPlayerMute: "mute",
    btnFullscreen: "fullscreen",
  };
  for (const [id, icon] of Object.entries(map)) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.dataset.icon = icon;
    el.textContent = "";
    el.classList.add("transport-btn", "ico-host");
  }

  const transport = $(".transport");
  if (transport && !$("#btnSnapshot")) {
    const snap = document.createElement("button");
    snap.className = "transport-btn";
    snap.id = "btnSnapshot";
    snap.title = "Snapshot (C)";
    snap.setAttribute("aria-label", "Snapshot");
    snap.dataset.icon = "camera";
    $("#btnFullscreen")?.before(snap);
    snap.addEventListener("click", () => {
      window.dispatchEvent(new CustomEvent("aifimora:snapshot"));
    });
  }
  hydrateIcons($(".transport"));

  const play = $("#btnPlay");
  if (play && !play.dataset.playBound) {
    play.dataset.playBound = "1";
    const paint = () => {
      const playing = !!(window.__aifimoraPlayer && window.__aifimoraPlayer.isPlaying && window.__aifimoraPlayer.isPlaying());
      play.innerHTML = iconSvg(playing ? (ICONS.pause || ICONS.play) : ICONS.play, { size: 16 });
    };
    window.addEventListener("aifimora:play", paint);
    window.addEventListener("aifimora:pause", paint);
    play.addEventListener("click", () => setTimeout(paint, 40));
  }
}

/* ---------------- Export destinations ----------------------------------------- */
const DESTS = [
  { id: "local", label: "Local", desc: "Save video to this computer" },
  { id: "device", label: "Device", desc: "iPhone, Android, TV, console presets" },
  { id: "youtube", label: "YouTube", desc: "Upload with title, description, tags" },
  { id: "tiktok", label: "TikTok", desc: "Vertical 9:16 social export" },
  { id: "vimeo", label: "Vimeo", desc: "High-quality creator upload" },
  { id: "dvd", label: "DVD", desc: "Burn a disc image (simulated)" },
];

export function bindExportMenu() {
  const btn = $("#btnExportTop");
  if (!btn || btn.dataset.menuBound) return;
  btn.dataset.menuBound = "1";
  btn.classList.add("has-menu");

  const pop = document.createElement("div");
  pop.className = "export-menu fm-pop";
  pop.setAttribute("role", "menu");
  pop.innerHTML = DESTS.map(
    (d) => `<button type="button" role="menuitem" data-dest="${d.id}"><strong>${d.label}</strong><span>${d.desc}</span></button>`
  ).join("");
  btn.append(pop);

  btn.addEventListener("click", (e) => {
    if (e.target.closest(".export-menu")) return;
    pop.classList.toggle("open");
  });
  pop.addEventListener("click", (e) => {
    const item = e.target.closest("[data-dest]");
    if (!item) return;
    pop.classList.remove("open");
    window.__exportDest = item.dataset.dest;
    window.dispatchEvent(
      new CustomEvent("aifimora:open-export", { detail: { dest: item.dataset.dest } })
    );
  });
  document.addEventListener("click", (e) => {
    if (!btn.contains(e.target)) pop.classList.remove("open");
  });
}

/* ---------------- File / View menu upgrades ------------------------------------ */
export function bindMenuExtras() {
  const filePop = $("#fmFile .fm-pop");
  if (filePop && !$("#menuImportMedia")) {
    filePop.insertAdjacentHTML(
      "afterbegin",
      `<button id="menuImportMedia">Import media…</button><button id="menuImportProject">Import project…</button><hr/>`
    );
    filePop.insertAdjacentHTML(
      "beforeend",
      `<hr/><button id="menuExportFile">Export…</button><button id="menuExit">Exit</button>`
    );
    $("#menuImportMedia")?.addEventListener("click", () => $("#btnImport")?.click());
    $("#menuImportProject")?.addEventListener("click", () => $("#menuLoad")?.click());
    $("#menuExportFile")?.addEventListener("click", () =>
      window.dispatchEvent(new CustomEvent("aifimora:open-export"))
    );
    $("#menuExit")?.addEventListener("click", () => {
      if (window.aifimora?.close) window.aifimora.close();
      else toast("Close the window to exit (Electron binds this)", "info");
    });
  }

  const viewPop = $("#fmView .fm-pop");
  if (viewPop && !$("#menuToggleLibrary")) {
    viewPop.insertAdjacentHTML(
      "afterbegin",
      `<button id="menuToggleLibrary">Toggle library panel</button>
       <button id="menuToggleInspector">Toggle properties panel</button>
       <button id="menuToggleTimeline">Toggle timeline panel</button>
       <button id="menuResetPanels">Reset panels &amp; layout</button>
       <hr/>`
    );
    $("#menuToggleLibrary")?.addEventListener("click", () => toggleDock("library"));
    $("#menuToggleInspector")?.addEventListener("click", () => toggleDock("inspector"));
    $("#menuToggleTimeline")?.addEventListener("click", () => toggleDock("timeline"));
    $("#menuResetPanels")?.addEventListener("click", () => {
      for (const k of ["aifimora.dock.v1", "aifimora.layoutMode.v1", "aifimora.layout.v1"]) {
        try { localStorage.removeItem(k); } catch { /* private mode */ }
      }
      location.reload();
    });
  }
}

/* ---------------- Timeline icon strip ------------------------------------------ */
export function bindTimelineIconStrip() {
  const bar = $(".tl-toolbar");
  if (!bar) return;
  bar.classList.add("tl-toolbar-icons");
  const iconFor = {
    btnUndo: "undo",
    btnRedo: "redo",
    btnMuteClip: "mute",
    btnTrimStart: "trim",
    btnTrimEnd: "trim",
    btnSplit: "split",
    btnDetachAudio: "volume",
    btnBeatSync: "spark",
    btnBeatOptions: "snap",
    btnClearBeats: "delete",
    btnDeleteClip: "delete",
    btnCrop: "aspect",
    btnMarker: "recent",
    btnSnap: "snap",
  };
  for (const [id, icon] of Object.entries(iconFor)) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.classList.add("tl-tool");
    el.dataset.icon = icon;
    const label = el.textContent.trim() || el.title;
    el.title = el.title || label;
    el.innerHTML = `<span class="ico"></span><span class="sr-only">${label}</span>`;
    el.dataset.iconDone = "";
    el.removeAttribute("data-icon-done");
    el.dataset.icon = icon;
    el.innerHTML = `<span class="ico"></span><span class="sr-only">${label}</span>`;
    // force icon paint via hydrateIcons
  }
  if (!$("#btnSilence")) {
    const snap = $("#btnSnap");
    const sil = document.createElement("button");
    sil.type = "button";
    sil.className = "btn sm tl-tool";
    sil.id = "btnSilence";
    sil.title = "Silence detect";
    sil.dataset.icon = "volume";
    sil.innerHTML = `<span class="ico"></span><span class="sr-only">Silence</span>`;
    sil.addEventListener("click", () =>
      window.dispatchEvent(new CustomEvent("aifimora:fm", { detail: "silence" }))
    );
    snap?.before(sil);
    const duck = document.createElement("button");
    duck.type = "button";
    duck.className = "btn sm tl-tool";
    duck.id = "btnDuck";
    duck.title = "Auto duck";
    duck.dataset.icon = "spark";
    duck.innerHTML = `<span class="ico"></span><span class="sr-only">Duck</span>`;
    duck.addEventListener("click", () =>
      window.dispatchEvent(new CustomEvent("aifimora:fm", { detail: "auto-duck" }))
    );
    snap?.before(duck);
  }
  // re-hydrate: clear icon-done then paint
  bar.querySelectorAll("[data-icon]").forEach((el) => {
    el.removeAttribute("data-icon-done");
  });
  hydrateIcons(bar);
}

/* ---------------- Project dirty dot -------------------------------------------- */
/* ---------------- Window controls + export tab sync ---------------------------- */
export function bindWindowControls() {
  const call = (channel) => {
    if (window.aifimora?.[channel]) window.aifimora[channel]();
    else toast(`Window ${channel} (Electron)`, "info");
  };
  $("#winMin")?.addEventListener("click", () => call("minimize"));
  $("#winMax")?.addEventListener("click", () => call("maximize"));
  $("#winClose")?.addEventListener("click", () => call("close"));
  $("#btnAccount")?.addEventListener("click", () =>
    toast("Account / Login — Wondershare cloud (simulated)", "info")
  );
}

export function bindExportTabs() {
  const tabs = $("#exportTabs");
  if (!tabs) return;
  tabs.addEventListener("click", (e) => {
    const b = e.target.closest("[data-edest]");
    if (!b) return;
    tabs.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
    window.__exportDest = b.dataset.edest;
    const hint = $("#exportDestHint");
    if (hint) hint.textContent = `Destination: ${b.textContent.trim()}`;
  });
  const start = window.__exportDest;
  if (start) {
    tabs.querySelectorAll("button").forEach((x) =>
      x.classList.toggle("active", x.dataset.edest === start)
    );
  }
  $("#exportQuality")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-qual]");
    if (!b) return;
    e.currentTarget.querySelectorAll("button").forEach((x) => x.classList.toggle("active", x === b));
    const map = { lower: 8, recommend: 16, higher: 40 };
    const br = $("#exportBitrate");
    if (br) br.value = map[b.dataset.qual] || 16;
  });
}

export function bindProjectChrome() {
  const pill = $(".project-pill");
  if (pill && !pill.querySelector(".dirty-dot")) {
    const d = document.createElement("span");
    d.className = "dirty-dot";
    d.title = "Unsaved changes";
    pill.append(d);
  }
  const sync = () => {
    pill?.classList.toggle("is-dirty", !!store.get().dirty);
  };
  store.subscribe(sync);
  sync();
}

export function initFilmoraChrome() {
  bindContentAwareProps();
  bindDockCollapse();
  bindTransportIcons();
  bindExportMenu();
  bindMenuExtras();
  bindTimelineIconStrip();
  bindProjectChrome();
  bindWindowControls();
  bindExportTabs();
}
