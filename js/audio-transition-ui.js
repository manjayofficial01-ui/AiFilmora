/* Audio transition picker — Filmora's 7 crossfade curve types. */
import { toast } from "./media.js";
import { store } from "./state.js";
import { settings } from "./settings.js";
import {
  audioTransitions,
  audioTransitionById,
  curveOf,
  transitionPreview,
  DEFAULT_AUDIO_TRANSITION,
} from "./audio-transitions.js";

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function currentClip() {
  const s = store.get();
  return s.clips.find((c) => c.id === s.selectedClipId) || null;
}

function projectDefault() {
  return settings.audioConfig?.().audioTransition || DEFAULT_AUDIO_TRANSITION;
}

function effectiveId() {
  return currentClip()?.audioTransition || projectDefault();
}

function tile(t) {
  const thumb = transitionPreview(curveOf(t.id), 112, 63);
  return `<button type="button" class="lut-tile" data-trans="${esc(t.id)}"
      role="option" aria-selected="false" title="${esc(t.label)} — ${esc(t.note)}">
      <span class="lut-thumb" style="background-image:url('${thumb.toDataURL()}')"></span>
      <span class="lut-name">${esc(t.label)}</span>
    </button>`;
}

function render() {
  const grid = document.getElementById("audioTransGrid");
  if (!grid) return;
  const all = audioTransitions();
  grid.innerHTML = all.map(tile).join("");
  const hint = document.getElementById("audioTransHint");
  if (hint) hint.textContent = `${all.length} Filmora types`;
  syncActive();
}

function syncActive() {
  const cur = effectiveId();
  const clip = currentClip();
  document.querySelectorAll("#audioTransGrid .lut-tile").forEach((b) => {
    const on = b.dataset.trans === cur;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  const note = document.getElementById("audioTransNote");
  const t = audioTransitionById(cur);
  if (note && t) {
    note.textContent = `${t.label}${clip?.audioTransition ? " (clip override)" : " (project default)"} — ${t.note}`;
  }
}

export function initAudioTransitionUI() {
  const grid = document.getElementById("audioTransGrid");
  if (!grid) return;
  const reset = document.getElementById("btnAudioTransDefault");

  render();

  grid.addEventListener("click", (e) => {
    const btn = e.target.closest(".lut-tile");
    if (!btn) return;
    const id = btn.dataset.trans;
    const clip = currentClip();
    if (!clip) { toast("Select a clip on the timeline first", "err"); return; }
    store.updateClip(clip.id, { audioTransition: id }, { undo: false });
    const t = audioTransitionById(id);
    toast("Audio transition · " + (t ? t.label : id), "ok");
    syncActive();
  });

  reset?.addEventListener("click", () => {
    const clip = currentClip();
    if (!clip) { toast("Select a clip on the timeline first", "err"); return; }
    // store.updateClip MERGES, so an explicit null — not a delete — is what clears it.
    store.updateClip(clip.id, { audioTransition: null }, { undo: false });
    toast("Using project default transition", "ok");
    syncActive();
  });

  window.addEventListener("aifimora:clip-selected", syncActive);
  settings.subscribe?.(syncActive);
}
