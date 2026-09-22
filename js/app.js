/* AiFimora bootstrap */
import { store, DEFAULT_FX } from "./state.js";
import { seedLibrary, bindImport, renderMediaBin, restoreMediaUrls } from "./media.js";
import { createPlayer } from "./player.js";
import { initTimeline } from "./timeline.js";
import { initAIStudio } from "./ai-studio.js";
import { initTextEdit } from "./text-edit.js";
import { initEffects } from "./effects.js";
import { initLutBrowser } from "./lut-panel.js";
import { initAudioFxUI } from "./audio-fx-ui.js";
import { initColorPresetUI } from "./color-preset-ui.js";
import { initPresetUI } from "./preset-ui.js";
import { initPanZoomUI } from "./panzoom-ui.js";
import { initAudioTransitionUI } from "./audio-transition-ui.js";
import { initExport } from "./export.js";
import { initShortcuts } from "./shortcuts.js";
import { initTextPanel } from "./text-panel.js";
import { initTransitionsUI } from "./transitions-ui.js";
import { initPanelResize } from "./panel-resize.js";
import { initAISettings } from "./ai-settings.js";
import { initCanvasEdit } from "./canvas-edit.js";
import { initSpeedPanel } from "./speed-panel.js";
import { initVolumePanel } from "./volume-panel.js";
import { initCrop } from "./crop.js";
import { initShapesPanel } from "./shapes.js";
import { initAssetBrowser } from "./assets-browser.js";
import { initMotionPanel } from "./motion-panel.js";
import { initScopes } from "./scopes.js";
import { initBeats } from "./beats.js";
import { initSettingsPanel } from "./settings-panel.js";
import { settings } from "./settings.js";
import { initWorkflows } from "./workflows.js";
import { initContextMenu } from "./context-menu.js";
import { initCreativeTools } from "./creative-tools.js";
import {
  bootAssets,
  applyThemePreset,
  clearThemePreset,
  isThemePreset,
  listThemePresets,
} from "./assets-bridge.js";
import { hydrateIcons } from "./icons.js";
import { initLibraryWorkspace } from "./library-workspace.js";
import { initMediaMenu } from "./media-menu.js";
import { initFilmoraParity, renderSourceMonitor as paintSource } from "./filmora-parity.js";
import { initFilmoraChrome } from "./filmora-chrome.js";
import { initFilmoraTools } from "./filmora-tools.js";

function $(sel) {
  return document.querySelector(sel);
}

function toast(msg, kind) {
  const root = $("#toasts");
  if (!root) return;
  // Cap stack so rapid AI actions don't spam the corner
  while (root.children.length >= 4) root.firstElementChild?.remove();
  const el = document.createElement("div");
  el.className = "toast" + (kind ? " " + kind : "");
  el.textContent = msg;
  el.setAttribute("role", "status");
  root.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

window.addEventListener("aifimora:toast", (e) => toast(e.detail.msg, e.detail.kind));

function bindTabs() {
  document.querySelectorAll("[data-sidebar]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.sidebar;
      document.querySelectorAll("[data-sidebar]").forEach((b) => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".sidebar-view").forEach((v) => v.classList.toggle("active", v.id === `side-${id}`));
    });
  });

  document.querySelectorAll("[data-inspector]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.inspector;
      document.querySelectorAll("[data-inspector]").forEach((b) => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".inspector-view").forEach((v) =>
        v.classList.toggle("active", v.id === `insp-${id}`)
      );
      if (id === "mate") setTimeout(() => $("#mateInput")?.focus(), 50);
    });
  });
}

/**
 * Fill every `[data-icon]` host with its SVG.
 *
 * The icon set is declarative — markup carries `data-icon="…"` and the SVG is
 * injected at runtime, so adding an icon never means hand-pasting path data
 * into HTML. A MutationObserver catches hosts mounted later by panels that
 * render their own chrome (media bin, caption gallery, AI studio).
 */
function initIcons() {
  hydrateIcons();
  window.__aifimoraHydrateIcons = () => hydrateIcons();
  if (window.__aifimoraIconsWired) return;
  window.__aifimoraIconsWired = true;
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.matches?.("[data-icon]") || n.querySelector?.("[data-icon]")) hydrateIcons(n);
      });
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
}

function bindTransport(player) {
  $("#btnPlay")?.addEventListener("click", () => player.toggle());
  $("#btnPrev")?.addEventListener("click", () => player.seek(Math.max(0, player.getTime() - 5)));
  $("#btnNext")?.addEventListener("click", () => player.seek(player.getTime() + 5));
  $("#btnGoStart")?.addEventListener("click", () => player.seek(0));

  window.addEventListener("aifimora:playhead", (e) => {
    const btn = $("#btnPlay");
    if (btn) {
      btn.textContent = e.detail.playing ? "⏸" : "▶";
      btn.setAttribute("aria-label", e.detail.playing ? "Pause" : "Play");
      btn.title = e.detail.playing ? "Pause (Space)" : "Play (Space)";
    }
  });
}

function bindMenus() {
  const modal = $("#shortcutsModal");
  const openShortcuts = () => modal?.classList.add("open");
  const closeShortcuts = () => modal?.classList.remove("open");
  $("#menuShortcuts")?.addEventListener("click", openShortcuts);
  $("#shortcutsClose")?.addEventListener("click", closeShortcuts);
  $("#shortcutsOk")?.addEventListener("click", closeShortcuts);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeShortcuts();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal?.classList.contains("open")) {
      e.preventDefault();
      closeShortcuts();
    }
  });

  const notes = $("#releaseNotesModal");
  const closeNotes = () => notes?.classList.remove("open");
  $("#releaseNotesOk")?.addEventListener("click", closeNotes);
  notes?.addEventListener("click", (e) => { if (e.target === notes) closeNotes(); });

  $("#menuNew")?.addEventListener("click", () => {
    if (confirm("Start a new empty project? Unsaved changes may be lost.")) {
      store.reset();
      store.applyProjectDefaults(settings.projectDefaults());
      seedLibrary();
      toast("New project");
      window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
    }
  });

  $("#menuProjectSettings")?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("aifimora:project-settings"));
  });

  $("#menuRecent")?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("aifimora:recent-projects"));
  });

  $("#menuSave")?.addEventListener("click", async () => {
    // 2.2.0: real file save with Ask-location + Default Save Location.
    try {
      const { saveProjectFlow } = await import("./save-dialog.js");
      await saveProjectFlow();
    } catch (err) {
      toast("Save failed: " + (err?.message || err), "err");
    }
  });

  $("#menuSaveAs")?.addEventListener("click", async () => {
    try {
      const { saveProjectFlow } = await import("./save-dialog.js");
      await saveProjectFlow({ saveAs: true });
    } catch (err) {
      toast("Save failed: " + (err?.message || err), "err");
    }
  });

  $("#menuLoad")?.addEventListener("click", async () => {
    // 2.2.0: open a .aifimora.json file from disk (falls back to autosave slot).
    try {
      const { openProjectFlow } = await import("./save-dialog.js");
      const ok = await openProjectFlow();
      if (!ok) {
        if (store.load()) toast("Project loaded from autosave", "ok");
        else toast("No saved project found");
      }
    } catch (err) {
      toast("Open failed: " + (err?.message || err), "err");
    }
  });

  $("#menuResetDemo")?.addEventListener("click", () => {
    store.reset();
    seedLibrary();
    toast("Demo data restored", "ok");
  });

  $("#btnNewProject")?.addEventListener("click", () => $("#menuNew")?.click());
}

function bindProjectName() {
  const live = $("#projectTitleLive");
  const sync = (s) => {
    if (live) live.textContent = s.name;
  };
  sync(store.get());
  store.subscribe(sync);
  live?.addEventListener("dblclick", () => {
    const name = prompt("Project name", store.get().name);
    if (name) {
      store.set({ name });
      store.save();
    }
  });
}

/* ---------------- Filmora-style menubar wiring ----------------------------------- */
function bindFilmoraMenus() {
  // Map data-fm values to existing event flows
  const map = {
    new: () => $("#menuNew")?.click(),
    project: () => $("#menuProjectSettings")?.click(),
    recent: () => $("#menuRecent")?.click(),
    save: () => $("#menuSave")?.click(),
    load: () => $("#menuLoad")?.click(),
    reset: () => $("#menuResetDemo")?.click(),
    prefs: () => $("#menuPreferences")?.click(),
    shortcuts: () => $("#menuShortcuts")?.click(),
    stabilize: () => window.dispatchEvent(new CustomEvent("aifimora:apply-fx", { detail: { id: "stabilize" } })),
    "color-match": () => window.dispatchEvent(new CustomEvent("aifimora:apply-fx", { detail: { id: "colorMatch" } })),
    "auto-enhance": () => window.dispatchEvent(new CustomEvent("aifimora:apply-fx", { detail: { id: "autoEnhance" } })),
    "voice-isolate": () => window.dispatchEvent(new CustomEvent("aifimora:apply-fx", { detail: { id: "voice" } })),
    "vocal-remover": () => window.dispatchEvent(new CustomEvent("aifimora:apply-fx", { detail: { id: "vocalRemover" } })),
    "auto-sync": () => window.dispatchEvent(new CustomEvent("aifimora:apply-fx", { detail: { id: "autoSync" } })),
    "zoom-fit": () => window.dispatchEvent(new CustomEvent("aifimora:zoom-fit")),
    fullscreen: () => window.dispatchEvent(new CustomEvent("aifimora:fullscreen-preview")),
    "safe-areas": () => settings.set({ playback: { showSafeAreas: !settings.get().playback?.showSafeAreas } }),
    "chapters-bar": () => settings.set({ editing: { chaptersBar: !settings.get().editing?.chaptersBar } }),
    "script-to-video": () => window.dispatchEvent(new CustomEvent("aifimora:ai-action", { detail: { id: "scriptToVideo" } })),
    roughcut: () => window.dispatchEvent(new CustomEvent("aifimora:ai-action", { detail: { id: "roughcut" } })),
    batch: () => window.dispatchEvent(new CustomEvent("aifimora:ai-action", { detail: { id: "batch" } })),
    subprojects: () => window.dispatchEvent(new CustomEvent("aifimora:ai-action", { detail: { id: "subproject" } })),
    "export-srt": () => window.dispatchEvent(new CustomEvent("aifimora:export-srt")),
    "export-chapters": () => window.dispatchEvent(new CustomEvent("aifimora:export-chapters")),
    thumbnail: () => window.dispatchEvent(new CustomEvent("aifimora:ai-action", { detail: { id: "thumbnail" } })),
    about: () => toast("AiFilmora 2.2.2 — Filmora cyan theme · Split Screen · working Source monitor · " + (window.__aifimoraStore?.get()?.clips?.length ?? 0) + " clips in project"),
    docs: () => toast("See research/FILMORA-INSPIRED-REDESIGN.md"),
    "release-notes": () => document.getElementById("releaseNotesModal")?.classList.add("open"),
  };

  document.querySelectorAll("[data-fm]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const id = btn.dataset.fm;
      const fn = map[id];
      if (fn) fn();
      // close the menu by removing [open] on its details
      btn.closest("details")?.removeAttribute("open");
    });
  });

  document.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const id = btn.dataset.edit;
      const ev = {
        undo: "aifimora:undo",
        redo: "aifimora:redo",
        split: "aifimora:split",
        "trim-start": "aifimora:trim-start",
        "trim-end": "aifimora:trim-end",
        copy: "aifimora:copy-clip",
        paste: "aifimora:paste-clip",
        duplicate: "aifimora:duplicate-clip",
        ripple: "aifimora:ripple-delete",
        delete: "aifimora:delete-clip",
      }[id];
      if (ev) window.dispatchEvent(new CustomEvent(ev));
      btn.closest("details")?.removeAttribute("open");
    });
  });

  // Theme label in the Version menu
  const themeLabel = document.getElementById("fmThemeLabel");
  if (themeLabel) {
    const sync = () => { themeLabel.textContent = settings.get().theme || "dark"; };
    sync();
    settings.subscribe(sync);
  }

  // Click-outside closes any open details menu
  document.addEventListener("click", (e) => {
    document.querySelectorAll(".fm-item[open]").forEach((d) => {
      if (!d.contains(e.target)) d.removeAttribute("open");
    });
  });

  // Any dropdown item closes its menu — the data-fm handler used to do this,
  // but File-menu buttons no longer carry data-fm (see below).
  document.querySelectorAll(".fm-pop button").forEach((b) =>
    b.addEventListener("click", () => b.closest("details")?.removeAttribute("open"))
  );

  // Titlebar icon buttons. They forward to the canonical File-menu controls but
  // must NOT carry data-fm, or the map would re-click them recursively.
  $("#menuRecentTop")?.addEventListener("click", () => $("#menuRecent")?.click());
  $("#menuPreferencesTop")?.addEventListener("click", () => $("#menuPreferences")?.click());

  // Top export button in the titlebar (Filmora-style export pill)
  document.getElementById("btnExportTop")?.addEventListener("click", () => $("#btnExport")?.click());
}

/* ---------------- preview tabs + quality / aspect dropdowns --------------------- */
function bindPreviewTabs() {
  const tabs = document.querySelectorAll(".ptab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.toggle("active", t === tab));
      const id = tab.dataset.ptab;
      const program = document.getElementById("previewCanvas");
      const source = document.getElementById("sourceCanvas");
      if (!program || !source) return;
      if (id === "timeline") {
        program.hidden = false;
        source.hidden = true;
        window.__aifimoraPlayer?.render?.();
      } else {
        program.hidden = true;
        source.hidden = false;
        renderSourceMonitor(source);
      }
    });
  });
}

function renderSourceMonitor(canvas) {
  paintSource(canvas);
}

function bindPreviewDropdowns() {
  const q = document.getElementById("previewQuality");
  q?.addEventListener("change", () => {
    settings.set({ playback: { previewQuality: Number(q.value) || 1 } });
    toast("Preview quality: " + q.options[q.selectedIndex].text);
  });
  const a = document.getElementById("previewAspect");
  a?.addEventListener("change", () => {
    const map = {
      "16:9": { w: 1920, h: 1080 },
      "9:16": { w: 1080, h: 1920 },
      "1:1": { w: 1080, h: 1080 },
      "4:5": { w: 1080, h: 1350 },
      "21:9": { w: 2560, h: 1080 },
    };
    const p = map[a.value] || map["16:9"];
    store.applyProjectDefaults({ width: p.w, height: p.h, aspect: a.value });
    toast("Project aspect: " + a.value);
  });
}

/* ---------------- Project Info card (Filmora-style right rail) ------------------ */
function bindProjectInfo() {
  const info = document.getElementById("projectInfo");
  const toggle = document.getElementById("piToggle");
  const syncVisibility = (prefs) => {
    const expanded = prefs.showProjectInfo !== false;
    if (info) info.hidden = !expanded;
    if (toggle) {
      toggle.textContent = expanded ? "Hide" : "Show";
      toggle.setAttribute("aria-expanded", String(expanded));
      toggle.setAttribute("aria-label", `${expanded ? "Hide" : "Show"} project information`);
    }
  };
  toggle?.addEventListener("click", () => {
    settings.set({ showProjectInfo: settings.get().showProjectInfo === false });
  });
  settings.subscribe(syncVisibility);
  syncVisibility(settings.get());

  const nameEl = document.getElementById("piName");
  const resEl = document.getElementById("piResolution");
  const fpsEl = document.getElementById("piFps");
  const durEl = document.getElementById("piDuration");
  const filesEl = document.getElementById("piFiles");
  const colorEl = document.getElementById("piColor");
  const sampleEl = document.getElementById("piSample");
  const thumbBtn = document.getElementById("piEdit");

  const fmtTime = (t) => {
    const s = Math.floor(t);
    return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  const sync = (s) => {
    if (nameEl) nameEl.textContent = s.name || "Untitled";
    if (resEl) resEl.textContent = `${s.width || 1920} × ${s.height || 1080}`;
    if (fpsEl) fpsEl.textContent = `${s.fps || 30} fps`;
    if (durEl) durEl.textContent = fmtTime(store.sequenceDuration());
    if (filesEl) filesEl.textContent = s.media?.length ? `${s.media.length} clip${s.media.length === 1 ? "" : "s"} local` : "local";
    if (colorEl) colorEl.textContent = "Rec. 709";
    if (sampleEl) sampleEl.textContent = "48 000 Hz";
    paintThumb();
  };

  store.subscribe(sync);
  sync(store.get());

  // Edit button → opens Project Settings dialog
  thumbBtn?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("aifimora:project-settings"));
  });

  // Source-tab double-click loads the source
  document.getElementById("sourceCanvas")?.addEventListener("dblclick", () => {
    document.querySelector('.ptab[data-ptab="timeline"]')?.click();
  });
}

function paintThumb() {
  const c = document.getElementById("piThumb");
  if (!c) return;
  const src = document.getElementById("previewCanvas");
  if (!src) return;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#0a0d0f";
  ctx.fillRect(0, 0, c.width, c.height);
  try {
    if (src.width && src.height) ctx.drawImage(src, 0, 0, c.width, c.height);
  } catch {
    const s = store.get();
    ctx.fillStyle = "#c3cad0";
    ctx.font = "600 11px Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(s.name || "Untitled", c.width / 2, c.height / 2);
  }
}

function bindImportBtn() {
  const input = $("#fileImport");
  $("#btnImport")?.addEventListener("click", () => input?.click());
  if (input) bindImport(input);
}

function refreshMediaBin(filter) {
  const grid = $("#mediaGrid");
  const input = $("#mediaSearch");
  const q = filter !== undefined ? filter : input?.value || "";
  renderMediaBin(grid, q, window.__aifimoraMediaCat || "all");
}

function bindMediaSearch() {
  const input = $("#mediaSearch");
  if (!input) return;
  input.disabled = false;
  input.title = "Filter media by name, kind, or model";
  input.addEventListener("input", () => {
    refreshMediaBin(input.value);
  });
}

function bindStatus(player) {
  const paint = (s) => {
    const clips = s.clips.length;
    const left = store.creditLeft();
    const clipsEl = $("#statClips");
    const creditsEl = $("#statCredits");
    if (clipsEl) clipsEl.textContent = `${clips} clip${clips === 1 ? "" : "s"}`;
    if (creditsEl) creditsEl.textContent = `${left} credits left`;
  };
  store.subscribe(paint);
  paint(store.get());

  // Real autosave feedback (fires from store.save / load)
  const saveEl = $("#statSave");
  const stamp = () => {
    if (saveEl) saveEl.textContent = "Autosaved " + new Date().toLocaleTimeString();
  };
  window.addEventListener("aifimora:saved", stamp);
  stamp();
}

function bootDemoIfEmpty() {
  const s = store.get();
  if (s.clips.length) return;
  // seed a light demo sequence so first paint is not empty
  const media = s.media;
  if (!media.length) return;
  const v1 = media.filter((m) => m.kind === "video").slice(0, 3);
  const a1 = media.find((m) => m.kind === "audio");
  let cursor = 0;
  const clips = [];
  v1.forEach((m) => {
    const d = Math.min(4.5, m.duration || 4);
    clips.push({
      id: store.uid("clip"),
      mediaId: m.id,
      name: m.name,
      type: "video",
      trackId: "v1",
      start: cursor,
      duration: d,
      fx: { ...DEFAULT_FX },
    });
    cursor += d + 0.08;
  });
  if (a1) {
    clips.push({
      id: store.uid("clip"),
      mediaId: a1.id,
      name: a1.name,
      type: "audio",
      trackId: "a1",
      start: 0,
      duration: Math.min(cursor, a1.duration || 12),
      fx: { ...DEFAULT_FX, voiceEnhance: true },
    });
  }
  store.set({ clips, name: "AiFilmora Demo Cut" });
}

function bindMasterVolume(settings) {
  const mv = document.getElementById("masterVolume");
  const out = document.getElementById("masterVolumeOut");
  if (!mv) return;
  mv.addEventListener("input", () => {
    mv.dataset.touched = "1";
    const v = parseInt(mv.value, 10) || 0;
    if (out) out.textContent = v + "%";
    settings.set({ playback: { masterVolume: v } }, { silent: true });
  });
}

function initFirstRun() {
  const KEY = "aifilmora.firstRun.v1";
  const modal = $("#firstRunModal");
  if (!modal) return;
  if (localStorage.getItem(KEY)) return;
  // show after a beat so the UI paints
  setTimeout(() => modal.classList.add("open"), 400);
  const close = (choice) => {
    localStorage.setItem(KEY, choice || "skip");
    modal.classList.remove("open");
  };
  $("#frEmpty")?.addEventListener("click", () => {
    store.reset();
    toast("Empty project — import media to begin", "ok");
    close("empty");
  });
  $("#frDemo")?.addEventListener("click", () => {
    store.reset();
    seedLibrary();
    bootDemoIfEmpty();
    toast("Demo cut loaded", "ok");
    close("demo");
  });
  $("#frAssets")?.addEventListener("click", () => {
    document.querySelector('[data-sidebar="assets"]')?.click();
    close("assets");
  });
  $("#frSkip")?.addEventListener("click", () => close("skip"));
}

function main() {
  window.__aifimoraStore = store;
  window.__aifimoraPlayer = null;

  // Filmora-inspired shell: load 287 Filmora fonts + caption-animation thumbnails.
  bootAssets();
  // Theme-preset helpers. Registered BEFORE settings.applyTheme() runs so a
  // persisted Filmora theme is restored on boot rather than silently ignored.
  window.__aifimoraApplyThemePreset = (id) => applyThemePreset(id);
  window.__aifimoraClearThemePreset = () => clearThemePreset();
  window.__aifimoraIsThemePreset = (id) => isThemePreset(id);
  // Expose theme-preset helpers to the settings panel.
  window.__aifimoraThemePresets = () => listThemePresets().map((p) => ({
    id: p.id,
    label: p.label,
    desc: p.id === "filmora-dark"
      ? "Extracted from assets/Skin/filmora_dark.txt · cyan accent."
      : "Extracted from assets/Skin/filmora_light.txt · light surfaces, cyan accent.",
    swatches: p.id === "filmora-dark"
      ? ["#0a0d0f", "#181c1f", "#55e5c5", "#3ddcff"]
      : ["#f5f8fa", "#ffffff", "#25c2a4", "#207fee"],
  }));

  bindTabs();
  bindFilmoraMenus();
  initIcons();
  bindPreviewTabs();
  bindPreviewDropdowns();
  bindProjectInfo();
  seedLibrary();
  store.load();
  if (!store.get().media.length) seedLibrary();
  // Re-hydrate imported files (IndexedDB -> fresh blob: URLs) so
  // imported video/audio survives reload and stays playable.
  restoreMediaUrls().then((r) => {
    if (r?.missing) toast(`${r.missing} imported file${r.missing === 1 ? "" : "s"} missing — re-import to relink`, "err");
    refreshMediaBin();
    window.__aifimoraPlayer?.render();
  });
  bootDemoIfEmpty();
  initFirstRun();

  const canvas = $("#previewCanvas");
  const player = createPlayer(canvas);
  window.__aifimoraPlayer = player;

  initTimeline($("#timelinePanel"), player);
  initAIStudio();
  initTextEdit();
  initEffects();
  initExport();
  initShortcuts(player);
  initTextPanel();
  initLutBrowser();
  initAudioFxUI();
  initPresetUI();
  initColorPresetUI();
  initPanZoomUI();
  initAudioTransitionUI();
  initTransitionsUI();
  initPanelResize();
  initAISettings();
  initCanvasEdit();
  initSpeedPanel();
  initVolumePanel();
  initCrop();
  initShapesPanel();
  initAssetBrowser();
  initMotionPanel();
  initScopes();
  initBeats();
  initSettingsPanel();
  initWorkflows(player);
  initContextMenu();
  initCreativeTools();
  initLibraryWorkspace();
  initMediaMenu();
  initFilmoraParity();
  initFilmoraChrome();
  initFilmoraTools();

  // Apply persisted preferences (theme + master volume) at boot
  settings.applyTheme();
  settings.applyMasterVolume();
  bindMasterVolume(settings);

  bindTransport(player);
  $("#btnFullscreen")?.addEventListener("click", () => {
    window.dispatchEvent(new CustomEvent("aifimora:fullscreen-preview"));
  });
  bindMenus();
  bindProjectName();
  bindImportBtn();
  bindMediaSearch();
  bindStatus(player);

  // Only rebuild the media bin when the media list / selection actually changes
  // (avoids full DOM rebuild on every clip drag frame).
  // Skipped mid-drag: replacing the drag source cancels HTML5 DnD.
  let lastMediaSig = "";
  let mediaDirtyDuringDrag = false;
  const paintMedia = (s) => {
    const filterOn = (window.__aifimoraMediaCat || "all") !== "all" || ($("#mediaSearch")?.value || "");
    const sel = s.selectedMediaIds?.length ? s.selectedMediaIds.join(",") : (s.selectedMediaId || "");
    const sig = s.media.map((m) => `${m.id}|${m.url || ""}|${m.thumb ? "t" : ""}|${m._offline ? 1 : 0}`).join(",") + "|" + sel + "|cat:" + (window.__aifimoraMediaCat || "all");
    if (sig !== lastMediaSig || window.__aifimoraMediaFilterDirty) {
      window.__aifimoraMediaFilterDirty = false;
      // A live category/search filter pins the grid: store-driven rebuilds must
      // not wipe it while the user is browsing a category.
      if (filterOn && sig === lastMediaSig) return;
      lastMediaSig = sig;
      refreshMediaBin();
    }
  };
  store.subscribe((s) => {
    if (window.__aifimoraMediaDragging) mediaDirtyDuringDrag = true;
    else paintMedia(s);
    player.render();
  });
  window.addEventListener("aifimora:media-dragend", () => {
    if (mediaDirtyDuringDrag) {
      mediaDirtyDuringDrag = false;
      paintMedia(store.get());
    }
  });
  refreshMediaBin();

  window.addEventListener("aifimora:timeline-dirty", () => {
    player.render();
    refreshMediaBin();
  });

  // welcome
  toast("AiFilmora ready — try AI Mate or press Space to play");
  // Filmora Project Library lives under File → Recent (no auto-popup to avoid
  // covering the timeline during automated checks / first paint).
  console.info(
    "%cAiFilmora%c Windows AI video editor suite",
    "background:#55e5c5;color:#0a0d0f;padding:2px 6px;border-radius:3px;font-weight:700",
    "color:#45f3bf"
  );
}

document.addEventListener("DOMContentLoaded", main);
