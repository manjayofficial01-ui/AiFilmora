/* Transitions browser: built-ins, custom assets, live preview */
import { TRANSITIONS, applyTransitionToClip, transitionById, paintTransition } from "./transitions.js";
import { store } from "./state.js";
import { toast } from "./media.js";

const CUSTOM_KEY = "aifimora.customTransitions.v1";
let previewRaf = 0;
let previewT = 0;
let previewType = "dissolve";
let customAssets = [];

function loadCustom() {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveCustom(list) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list.slice(0, 40)));
  } catch {
    toast("Storage full — too many custom assets", "err");
  }
  customAssets = list;
}

/** Try assets/transitions/manifest.json then common image names. */
async function rescanFolder() {
  const found = [];
  try {
    const res = await fetch("assets/transitions/manifest.json", { cache: "no-store" });
    if (res.ok) {
      const man = await res.json();
      const items = Array.isArray(man) ? man : man.items || man.transitions || [];
      items.forEach((it) => {
        found.push({
          id: "cf_" + (it.id || it.name || found.length),
          label: it.label || it.name || "Custom",
          src: it.src || it.file || it.url,
          kind: it.kind || "wipeOverlay",
        });
      });
    }
  } catch {
    /* no manifest */
  }
  // only use explicit manifest entries (avoid noisy 404 probes)
  if (found.length) {
    const merged = [...loadCustom().filter((c) => !c.src?.startsWith("blob:") && !c.src?.startsWith("data:")), ...found];
    // dedupe by src
    const seen = new Set();
    const uniq = merged.filter((m) => {
      if (seen.has(m.src)) return false;
      seen.add(m.src);
      return true;
    });
    saveCustom(uniq);
  }
  return found.length;
}

function bindImport() {
  const input = document.getElementById("fileImportTransitions");
  document.getElementById("btnImportTransitions")?.addEventListener("click", () => input?.click());
  document.getElementById("btnReloadTransitions")?.addEventListener("click", async () => {
    const n = await rescanFolder();
    render();
    toast(n ? `Found ${n} in assets/transitions` : "No folder assets — use Import", n ? "ok" : undefined);
  });
  input?.addEventListener("change", async () => {
    const files = [...(input.files || [])];
    const list = [...loadCustom()];
    for (const file of files) {
      if (file.name.endsWith(".json")) {
        try {
          const man = JSON.parse(await file.text());
          const items = Array.isArray(man) ? man : man.items || [];
          items.forEach((it) =>
            list.push({
              id: "cf_" + (it.id || list.length),
              label: it.label || "Custom",
              src: it.src || it.file,
              kind: it.kind || "wipeOverlay",
            })
          );
        } catch {
          toast("Invalid manifest JSON", "err");
        }
        continue;
      }
      const src = URL.createObjectURL(file);
      list.push({
        id: "cf_" + file.name,
        label: file.name.replace(/\.\w+$/, ""),
        src,
        kind: file.type.startsWith("image") ? "wipeOverlay" : "videoOverlay",
      });
    }
    saveCustom(list);
    input.value = "";
    render();
    toast(`Imported ${files.length} asset(s)`, "ok");
  });
}

function startPreview(typeId, label) {
  previewType = typeId;
  const lab = document.getElementById("transPreviewLabel");
  if (lab) lab.textContent = label || typeId;
  previewT = 0;
  if (previewRaf) cancelAnimationFrame(previewRaf);
  const canvas = document.getElementById("transPreviewCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const loop = () => {
    previewT = (previewT + 0.012) % 1;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);
    const paintFrom = () => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#1a3a5c");
      g.addColorStop(1, "#0d1f33");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "600 14px Segoe UI, sans-serif";
      ctx.fillText("A", 12, 24);
    };
    const paintTo = () => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#5c3d10");
      g.addColorStop(1, "#c9a227");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(0,0,0,0.85)";
      ctx.font = "600 14px Segoe UI, sans-serif";
      ctx.fillText("B", 12, 24);
    };
    paintTransition(ctx, w, h, previewType, previewT, paintFrom, paintTo);
    previewRaf = requestAnimationFrame(loop);
  };
  loop();
}

/** One tile in the transitions grid — shared by shader + built-in sections. */
function transButton(t, current) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "preset" + (t.id === current ? " active" : "");
  btn.innerHTML = `<strong>${t.label}</strong><span>${t.dur.toFixed(2)}s</span>`;
  btn.addEventListener("mouseenter", () => startPreview(t.id, t.label));
  btn.addEventListener("focus", () => startPreview(t.id, t.label));
  btn.addEventListener("click", () => {
    if (!store.get().selectedClipId) {
      toast("Select a clip on the timeline first", "err");
      return;
    }
    const res = applyTransitionToClip(store, store.get().selectedClipId, t.id);
    if (res.ok) toast(res.warn || `Transition: ${res.label}`, res.warn ? undefined : "ok");
    render();
    window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
  });
  return btn;
}

function render() {
  const root = document.getElementById("transGrid");
  const customRoot = document.getElementById("customTransGrid");
  if (!root) return;
  const clip = store.getClip(store.get().selectedClipId);
  const current = clip?.outTransition?.type || "none";
  customAssets = loadCustom();

  root.innerHTML = "";
  /* Filmora GPU-shader transitions (asset/resources/wfx_effect/Transition/) first,
   * grouped under their own section header, then the built-in canvas ones. */
  const isFw = (t) => t.id.startsWith("fw_");
  const section = (label) => {
    const h = document.createElement("div");
    h.className = "section-title";
    h.style.gridColumn = "1 / -1";
    h.textContent = label;
    root.appendChild(h);
  };
  section("Filmora shader transitions");
  TRANSITIONS.filter(isFw).forEach((t) => root.appendChild(transButton(t, current)));
  section("Built-in transitions");
  TRANSITIONS.filter((t) => !isFw(t) && t.id !== "none").forEach((t) => root.appendChild(transButton(t, current)));

  // Duration control for the applied transition (Filmora)
  const clipForDur = store.getClip(store.get().selectedClipId);
  if (clipForDur?.outTransition?.type) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    wrap.style.gridColumn = "1 / -1";
    wrap.style.marginTop = "8px";
    const cur = clipForDur.outTransition.duration || 0.5;
    wrap.innerHTML = `<label for="transDur">Transition duration</label>
      <div class="slider-row">
        <input id="transDur" type="range" min="0.1" max="3" step="0.05" value="${cur}" />
        <output id="transDurOut">${cur.toFixed(2)}s</output>
      </div>`;
    root.appendChild(wrap);
    const input = wrap.querySelector("#transDur");
    const out = wrap.querySelector("#transDurOut");
    input?.addEventListener("input", () => {
      const v = Number(input.value);
      if (out) out.textContent = v.toFixed(2) + "s";
      store.updateClip(clipForDur.id, {
        outTransition: { ...clipForDur.outTransition, duration: v },
      });
      window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
    });
  }

  if (customRoot) {
    customRoot.innerHTML = "";
    if (!customAssets.length) {
      customRoot.innerHTML = `<div class="empty" style="grid-column:1/-1">No custom transitions yet.</div>`;
    } else {
      customAssets.forEach((a) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "preset";
        btn.innerHTML = `<strong>${a.label}</strong><span>custom</span>`;
        btn.addEventListener("mouseenter", () => startPreview("dissolve", a.label + " (custom)"));
        btn.addEventListener("click", () => {
          if (!store.get().selectedClipId) return toast("Select a clip first", "err");
          applyTransitionToClip(store, store.get().selectedClipId, "dissolve");
          store.updateClip(store.get().selectedClipId, {
            outTransition: { type: "dissolve", duration: 0.6, label: a.label, customSrc: a.src },
          });
          toast(`Applied custom “${a.label}”`, "ok");
          render();
          window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
        });
        customRoot.appendChild(btn);
      });
    }
  }

  const hint = document.getElementById("transHint");
  if (hint) {
    if (!clip) hint.textContent = "Select a video clip, then pick a transition for its out-point.";
    else if (clip.outTransition?.type) {
      hint.textContent = `On “${clip.name}”: ${transitionById(clip.outTransition.type).label}`;
    } else hint.textContent = `Selected: ${clip.name} — no transition yet.`;
  }
}

export function initTransitionsUI() {
  bindImport();
  rescanFolder().then(() => render());
  window.addEventListener("aifimora:open-transitions", () => {
    render();
    document.querySelector('[data-sidebar="transitions"]')?.click();
    startPreview("dissolve", "Cross Dissolve");
  });
  window.addEventListener("aifimora:preview-transition", (e) => {
    startPreview(e.detail?.type || "dissolve", e.detail?.label || "Preview");
  });
  store.subscribe(() => {
    const el = document.getElementById("transGrid");
    if (el && el.offsetParent !== null) render();
  });
  render();
}
