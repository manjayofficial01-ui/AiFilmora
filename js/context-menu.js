/* Filmora-style clip context menu on the timeline. */

import { store } from "./state.js";
import { toast } from "./media.js";
import { getClipboard, setClipboard } from "./shortcuts.js";

let menuEl = null;

function ensureMenu() {
  if (menuEl) return menuEl;
  menuEl = document.createElement("div");
  menuEl.id = "clipContextMenu";
  menuEl.className = "ctx-menu";
  menuEl.hidden = true;
  menuEl.setAttribute("role", "menu");
  document.body.appendChild(menuEl);
  window.addEventListener(
    "pointerdown",
    (e) => {
      if (!menuEl.hidden && !menuEl.contains(e.target)) hideMenu();
    },
    true
  );
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideMenu();
  });
  window.addEventListener("blur", hideMenu);
  return menuEl;
}

export function hideMenu() {
  if (menuEl) menuEl.hidden = true;
}

function item(label, action, { disabled = false, danger = false } = {}) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "ctx-item" + (danger ? " danger" : "");
  b.setAttribute("role", "menuitem");
  b.textContent = label;
  b.disabled = disabled;
  b.addEventListener("click", (e) => {
    e.stopPropagation();
    hideMenu();
    action();
  });
  return b;
}

function sep() {
  const s = document.createElement("div");
  s.className = "ctx-sep";
  return s;
}

function openMenu(x, y, clip) {
  const menu = ensureMenu();
  menu.innerHTML = "";
  const locked = store.get().tracks.find((t) => t.id === clip.trackId)?.locked;

  menu.appendChild(item("Split at playhead", () => {
    const t = window.__aifimoraPlayer?.getTime?.() ?? 0;
    const n = store.splitAtPlayhead(t);
    if (n > 0) toast(n > 1 ? `Split ${n} selected clips` : "Split", "ok");
    else toast(store._lastSplitReason || "Nothing to split at playhead");
  }, { disabled: locked }));

  menu.appendChild(item("Copy", () => {
    setClipboard(clip);
    toast(`Copied “${clip.name}”`, "ok");
  }));

  menu.appendChild(item("Paste at playhead", () => {
    const src = getClipboard();
    if (!src) return toast("Clipboard is empty");
    const at = window.__aifimoraPlayer?.getTime?.() ?? null;
    store.pasteClipAt(src, { at });
    toast("Pasted", "ok");
  }, { disabled: !getClipboard() || locked }));

  menu.appendChild(item("Duplicate", () => {
    store.duplicateClip(clip.id);
    toast("Duplicated", "ok");
  }, { disabled: locked }));

  menu.appendChild(sep());

  menu.appendChild(item("Ripple delete", () => {
    const res = store.rippleDeleteClip(clip.id);
    if (res?.ok) toast("Ripple delete", "ok");
    else toast(res?.reason || "Failed");
  }, { disabled: locked, danger: true }));

  menu.appendChild(item("Delete", () => {
    store.removeClip(clip.id);
    toast("Clip deleted");
  }, { disabled: locked, danger: true }));

  menu.appendChild(sep());

  menu.appendChild(item(clip.audioMuted ? "Unmute audio" : "Mute audio", () => {
    store.setClipMuted(clip.id, !clip.audioMuted);
  }, { disabled: clip.type === "text" }));

  if (clip.type === "video" || clip.type === "audio") {
    menu.appendChild(item(clip.reversed ? "Play forward" : "Reverse", () => {
      store.reverseClip(clip.id);
      toast(clip.reversed ? "Forward" : "Reversed", "ok");
    }));
  }

  if (clip.type === "video") {
    menu.appendChild(item("Freeze frame", () => {
      const t = window.__aifimoraPlayer?.getTime?.() ?? 0;
      const res = store.freezeFrame(clip.id, 2, t);
      if (res?.ok) toast("Freeze frame inserted", "ok");
      else toast(res?.reason || "Failed");
    }, { disabled: locked }));
  }

  menu.appendChild(item("Speed…", () => {
    store.set({ selectedClipId: clip.id });
    document.querySelector('[data-inspector="speed"]')?.click();
    document.querySelector('[data-sidebar=""]')?.click();
    // open speed inspector tab
    document.querySelector('[data-inspector="speed"]')?.click();
    window.dispatchEvent(new CustomEvent("aifimora:open-speed"));
  }));

  menu.appendChild(item("Beat Sync", async () => {
    store.set({ selectedClipId: clip.id });
    document.getElementById("btnBeatSync")?.click();
  }, { disabled: clip.type !== "audio" }));

  menu.appendChild(item("Beat Options…", () => {
    window.dispatchEvent(new CustomEvent("aifimora:beat-options"));
  }));

  menu.appendChild(item(clip.fx?.stabilize ? "Unstabilize" : "Stabilize", async () => {
    const { applyStabilization } = await import("./ai-studio.js");
    store.set({ selectedClipId: clip.id });
    if (clip.fx?.stabilize) {
      store.updateClip(clip.id, { fx: { stabilize: false } }, { undo: true });
      toast("Stabilization off", "ok");
    } else applyStabilization();
  }, { disabled: clip.type === "audio" || clip.type === "text" }));

  menu.appendChild(item("Vocal Remover", async () => {
    const { applyVocalRemover } = await import("./ai-studio.js");
    applyVocalRemover();
  }, { disabled: clip.type !== "audio" }));

  menu.appendChild(item("Color Match from this", async () => {
    const { applyColorMatch } = await import("./ai-studio.js");
    store.set({ selectedClipId: clip.id });
    applyColorMatch();
  }, { disabled: clip.type === "audio" || clip.type === "text" }));

  menu.appendChild(item("AI Extend", async () => {
    const { extendSelectedClip } = await import("./ai-studio.js");
    store.set({ selectedClipId: clip.id });
    extendSelectedClip();
  }, { disabled: clip.type === "audio" || clip.type === "text" }));

  // Filmora 15 creative items
  menu.appendChild(item("Add Chapter at playhead", () => {
    import("./creative-tools.js").then((m) => m.addChapterFromPlayhead());
  }));

  menu.appendChild(item("Extract Subtitles", () => {
    import("./creative-tools.js").then((m) => m.extractSubtitles(clip.id));
  }, { disabled: clip.type === "audio" || clip.type === "text" }));

  menu.appendChild(item("Voice Changer…", () => {
    import("./creative-tools.js").then((m) => {
      const { VOICE_PRESETS, applyVoiceChanger } = m;
      const pick = prompt(`Voice Changer presets:\n${VOICE_PRESETS.map((v, i) => `${i + 1}. ${v.label}`).join("\n")}\n\nEnter number:`, "1");
      const idx = parseInt(pick, 10) - 1;
      if (Number.isInteger(idx) && VOICE_PRESETS[idx]) {
        store.set({ selectedClipId: clip.id });
        applyVoiceChanger(VOICE_PRESETS[idx].id);
      }
    });
  }, { disabled: clip.type !== "audio" }));

  menu.appendChild(item("Auto Sync to video", () => {
    import("./creative-tools.js").then((m) => {
      store.set({ selectedClipId: clip.id });
      m.autoSyncAudio();
    });
  }, { disabled: clip.type !== "audio" }));

  menu.appendChild(item(clip.fx?.motionBlur > 0 ? "Motion Blur ✓ (turn off)" : "Motion Blur", () => {
    import("./settings.js").then(({ settings }) => {
      const ed = settings.get().editing || {};
      const turnOn = !(clip.fx?.motionBlur > 0);
      store.pushUndo(turnOn ? "Motion Blur on" : "Motion Blur off");
      store.updateClip(clip.id, { fx: { ...(clip.fx || {}), motionBlur: turnOn ? Number(ed.motionBlurDefault) || 45 : 0 } });
    });
  }, { disabled: clip.type === "audio" || clip.type === "text" }));

  menu.appendChild(item(clip.fx?.deflicker > 0 ? "Flicker Removal ✓ (turn off)" : "Flicker Removal", () => {
    import("./settings.js").then(({ settings }) => {
      const ed = settings.get().editing || {};
      const turnOn = !(clip.fx?.deflicker > 0);
      store.pushUndo(turnOn ? "Flicker Removal on" : "Flicker Removal off");
      store.updateClip(clip.id, { fx: { ...(clip.fx || {}), deflicker: turnOn ? Number(ed.deflickerDefault) || 60 : 0 } });
    });
  }, { disabled: clip.type === "audio" || clip.type === "text" }));

  menu.appendChild(item("Multi-Clip (batch) edit…", () => {
    import("./creative-tools.js").then((m) => m.openBatchEdit());
  }));

  menu.appendChild(item("Properties", () => {
    store.set({ selectedClipId: clip.id });
    document.querySelector('[data-inspector="fx"]')?.click();
  }));

  menu.appendChild(sep());

  if (clip.compoundId) {
    menu.appendChild(item("Un-nest compound", () => {
      store.uncompound(clip.compoundId);
      toast("Compound expanded", "ok");
    }));
  } else {
    menu.appendChild(item("Compound / nest", () => {
      store.set({ selectedClipId: clip.id });
      const res = store.compoundSelected("Compound clip");
      if (res?.ok) toast(`Compounded ${res.count} clip(s)`, "ok");
      else toast(res?.reason || "Nothing to nest");
    }, { disabled: locked }));
  }

  // position
  menu.hidden = false;
  menu.style.left = "0px";
  menu.style.top = "0px";
  const rect = menu.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.min(x, vw - rect.width - 8);
  const top = Math.min(y, vh - rect.height - 8);
  menu.style.left = Math.max(8, left) + "px";
  menu.style.top = Math.max(8, top) + "px";
}

export function initContextMenu() {
  const lanes = () => document.getElementById("tlLanes") || document.getElementById("timelinePanel");

  document.addEventListener(
    "contextmenu",
    (e) => {
      const clipEl = e.target.closest?.("[data-clip-id]");
      if (!clipEl) {
        hideMenu();
        return;
      }
      const id = clipEl.dataset.clipId;
      const clip = store.getClip(id);
      if (!clip) return;
      e.preventDefault();
      store.set({ selectedClipId: id });
      openMenu(e.clientX, e.clientY, clip);
    },
    true
  );

  // style injection once
  if (!document.getElementById("ctxMenuStyle")) {
    const st = document.createElement("style");
    st.id = "ctxMenuStyle";
    st.textContent = `
.ctx-menu{
  position:fixed;z-index:4000;min-width:200px;
  background:#1a1f28;border:1px solid #2c3442;border-radius:8px;
  box-shadow:0 12px 32px rgba(0,0,0,.45);padding:6px;
  display:flex;flex-direction:column;gap:2px;
  font:13px/1.3 "Segoe UI",system-ui,sans-serif;color:#e8ecf2;
}
.ctx-menu[hidden]{display:none}
.ctx-item{
  appearance:none;border:0;background:transparent;color:inherit;
  text-align:left;padding:7px 10px;border-radius:5px;cursor:pointer;font:inherit;
}
.ctx-item:hover:not(:disabled){background:#5b8cff22;color:#fff}
.ctx-item:disabled{opacity:.4;cursor:default}
.ctx-item.danger{color:#ff7b72}
.ctx-sep{height:1px;background:#2c3442;margin:4px 2px}
`;
    document.head.appendChild(st);
  }
}
