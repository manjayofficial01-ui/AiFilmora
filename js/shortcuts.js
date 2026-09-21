/* Keyboard shortcuts + remappable action map */
import { store } from "./state.js";
import { toast } from "./media.js";
import { moveSelectedClipTrack } from "./timeline.js";
import { settings } from "./settings.js";

/** Canonical action list for Preferences → Keyboard. */
export const SHORTCUT_ACTIONS = [
  { id: "play", label: "Play / Pause", default: "Space" },
  { id: "undo", label: "Undo", default: "Ctrl+Z" },
  { id: "redo", label: "Redo", default: "Ctrl+Y" },
  { id: "split", label: "Split at playhead", default: "S" },
  { id: "save", label: "Save project", default: "Ctrl+S" },
  { id: "delete", label: "Delete clip", default: "Delete" },
  { id: "duplicate", label: "Duplicate clip", default: "Ctrl+D" },
  { id: "copy", label: "Copy clip", default: "Ctrl+C" },
  { id: "paste", label: "Paste clip", default: "Ctrl+V" },
  { id: "shuttleBack", label: "Shuttle back (J)", default: "J" },
  { id: "shuttleFwd", label: "Shuttle forward (L)", default: "L" },
  { id: "pause", label: "Pause (K)", default: "K" },
  { id: "zoomIn", label: "Zoom timeline in", default: "=" },
  { id: "zoomOut", label: "Zoom timeline out", default: "-" },
  { id: "mate", label: "Focus AI Mate", default: "M" },
  { id: "transcript", label: "Text-based edit", default: "T" },
  { id: "rippleDelete", label: "Ripple delete clip", default: "Shift+Delete" },
  { id: "export", label: "Open export", default: "Ctrl+E" },
  { id: "fullscreen", label: "Fullscreen preview", default: "F" },
  { id: "zoomFit", label: "Zoom timeline to fit", default: "Shift+Z" },
  { id: "exportSrt", label: "Export captions (.srt)", default: "Ctrl+Shift+E" },
  { id: "projectSettings", label: "Project settings", default: "Ctrl+Alt+P" },
  { id: "recent", label: "Recent projects", default: "Ctrl+O" },
  { id: "snapshot", label: "Snapshot frame", default: "C" },
  { id: "beatOptions", label: "Beat options", default: "B" },
  { id: "stabilize", label: "Stabilize clip", default: "Ctrl+Shift+S" },
  { id: "thumbnail", label: "Export thumbnail", default: "Ctrl+T" },
  { id: "penTool", label: "Pen Tool", default: "P" },
  { id: "addChapter", label: "Add chapter at playhead", default: "N" },
  { id: "exportChapters", label: "Export chapter timestamps", default: "Ctrl+Shift+N" },
  { id: "batchEdit", label: "Multi-Clip (batch) editing", default: "Ctrl+Alt+B" },
];

function isModalOpen() {
  return !!document.querySelector(".modal-backdrop.open");
}

/** Normalize KeyboardEvent → "Ctrl+Shift+Z" / "Space" / "Delete". */
export function parseCombo(e) {
  if (!e || e.key == null) return null;
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  let key = e.key;
  if (key === " ") key = "Space";
  else if (key.length === 1) key = key.toUpperCase();
  else key = key[0].toUpperCase() + key.slice(1);
  // Avoid Ctrl+Shift+I style collisions with just modifiers
  if (["Control", "Shift", "Alt", "Meta"].includes(key)) return null;
  parts.push(key);
  return parts.join("+");
}

export function formatCombo(combo) {
  return String(combo || "").replace(/\s+/g, " ");
}

export function matches(e, combo) {
  const c = parseCombo(e);
  return !!combo && c === formatCombo(combo);
}

function resolve(actionId, fallbackKey) {
  return settings.getShortcut(actionId, fallbackKey);
}

let clipboard = null;

export function getClipboard() {
  return clipboard;
}
export function setClipboard(clip) {
  clipboard = clip ? JSON.parse(JSON.stringify(clip)) : null;
}

export function initShortcuts(player) {
  window.addEventListener("keydown", (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea" || e.target.isContentEditable) {
      if (e.key === "Escape") e.target.blur();
      return;
    }

    if (isModalOpen() && e.key !== "Escape") return;

    if (matches(e, resolve("play", "Space"))) {
      e.preventDefault();
      player.toggle();
      return;
    }
    if (matches(e, resolve("undo", "Ctrl+Z")) && !e.shiftKey) {
      e.preventDefault();
      const label = store.undo();
      toast(label ? `Undo: ${label}` : "Nothing to undo", label ? "ok" : undefined);
      return;
    }
    if (matches(e, resolve("redo", "Ctrl+Y")) || (matches(e, resolve("undo", "Ctrl+Z")) && e.shiftKey)) {
      e.preventDefault();
      const label = store.redo();
      toast(label ? `Redo: ${label}` : "Nothing to redo", label ? "ok" : undefined);
      return;
    }
    if (matches(e, resolve("save", "Ctrl+S"))) {
      e.preventDefault();
      // 2.2.0: route through the real file-save flow (Ask location + default).
      document.getElementById("menuSave")?.click();
      return;
    }
    if (matches(e, resolve("export", "Ctrl+E"))) {
      e.preventDefault();
      // routed through export.js so the save-location fields get initialised
      window.dispatchEvent(new CustomEvent("aifimora:open-export"));
      return;
    }
    if (matches(e, resolve("duplicate", "Ctrl+D"))) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("aifimora:duplicate-clip"));
      return;
    }
    if (matches(e, resolve("copy", "Ctrl+C"))) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("aifimora:copy-clip"));
      return;
    }
    if (matches(e, resolve("paste", "Ctrl+V"))) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("aifimora:paste-clip"));
      return;
    }
    if (matches(e, resolve("rippleDelete", "Shift+Delete"))) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("aifimora:ripple-delete"));
      return;
    }
    if (matches(e, resolve("split", "S")) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const t = player.getTime();
      const n = store.splitAtPlayhead(t);
      if (n > 0) toast(n > 1 ? `Split ${n} selected clips` : "Split", "ok");
      else toast(store._lastSplitReason || "Nothing to split at playhead");
      return;
    }
    if (matches(e, resolve("delete", "Delete"))) {
      const ids = store.selectedClipIdList();
      if (ids.length) {
        e.preventDefault();
        const res = store.removeClips(ids);
        toast(res.removed > 1 ? `${res.removed} clips deleted` : "Clip deleted");
        return;
      }
      // No clip selected: Delete removes selected media bin items
      const s = store.get();
      const mediaSel = (s.selectedMediaIds?.length ? s.selectedMediaIds : s.selectedMediaId ? [s.selectedMediaId] : []);
      if (mediaSel.length) {
        e.preventDefault();
        import("./media.js").then((m) => m.deleteSelectedMedia());
      }
      return;
    }
    if (matches(e, resolve("fullscreen", "F"))) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("aifimora:fullscreen-preview"));
      return;
    }
    if (matches(e, resolve("zoomFit", "Shift+Z"))) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("aifimora:zoom-fit"));
      return;
    }
    if (matches(e, resolve("exportSrt", "Ctrl+Shift+E"))) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("aifimora:export-srt"));
      return;
    }
    if (matches(e, resolve("projectSettings", "Ctrl+Alt+P"))) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("aifimora:project-settings"));
      return;
    }
    if (matches(e, resolve("recent", "Ctrl+O"))) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("aifimora:recent-projects"));
      return;
    }
    if (matches(e, resolve("snapshot", "C")) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("aifimora:snapshot"));
      return;
    }
    if (matches(e, resolve("beatOptions", "B")) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("aifimora:beat-options"));
      return;
    }
    if (matches(e, resolve("stabilize", "Ctrl+Shift+S"))) {
      e.preventDefault();
      import("./ai-studio.js").then((m) => m.applyStabilization());
      return;
    }
    if (matches(e, resolve("thumbnail", "Ctrl+T"))) {
      e.preventDefault();
      import("./ai-studio.js").then((m) => m.createThumbnail());
      return;
    }
    if (matches(e, resolve("penTool", "P")) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("aifimora:pen-tool"));
      return;
    }
    if (matches(e, resolve("addChapter", "N")) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("aifimora:add-chapter"));
      return;
    }
    if (matches(e, resolve("exportChapters", "Ctrl+Shift+N"))) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("aifimora:export-chapters"));
      return;
    }
    if (matches(e, resolve("batchEdit", "Ctrl+Alt+B"))) {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("aifimora:batch-edit"));
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      player.seek(0);
      return;
    }
    if (e.key === "End") {
      e.preventDefault();
      player.seek(Math.max(0, store.sequenceDuration() - 0.01));
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      if (e.altKey) {
        e.preventDefault();
        moveSelectedClipTrack(e.key === "ArrowUp" ? -1 : 1);
        return;
      }
      if (store.get().selectedClipId) {
        e.preventDefault();
        const clip = store.getClip(store.get().selectedClipId);
        if (clip) {
          const step = e.shiftKey ? 1 : 0.5;
          const start = Math.max(0, clip.start + (e.key === "ArrowUp" ? -step : step));
          store.updateClip(clip.id, { start });
        }
        return;
      }
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const step = e.shiftKey ? 1 : 1 / 30;
      const dir = e.key === "ArrowRight" ? 1 : -1;
      player.seek(Math.max(0, player.getTime() + dir * step));
      return;
    }
    if (matches(e, resolve("shuttleBack", "J"))) {
      player.seek(Math.max(0, player.getTime() - 2));
      return;
    }
    if (matches(e, resolve("shuttleFwd", "L"))) {
      player.seek(player.getTime() + 2);
      return;
    }
    if (matches(e, resolve("pause", "K"))) {
      player.pause();
      return;
    }
    if (matches(e, resolve("zoomIn", "=")) || e.key === "+") {
      const z = document.getElementById("tlZoom");
      if (z) {
        z.value = String(Math.min(4, Number(z.value) + 0.2));
        z.dispatchEvent(new Event("input"));
      }
      return;
    }
    if (matches(e, resolve("zoomOut", "-")) || e.key === "_") {
      const z = document.getElementById("tlZoom");
      if (z) {
        z.value = String(Math.max(0.4, Number(z.value) - 0.2));
        z.dispatchEvent(new Event("input"));
      }
      return;
    }
    if (matches(e, resolve("mate", "M"))) {
      document.querySelector('[data-inspector="mate"]')?.click();
      document.getElementById("mateInput")?.focus();
      return;
    }
    if (matches(e, resolve("transcript", "T"))) {
      window.dispatchEvent(new CustomEvent("aifimora:open-text-edit"));
      return;
    }
  });

  window.addEventListener("aifimora:seek", (e) => {
    player.seek(e.detail.time);
  });
}
