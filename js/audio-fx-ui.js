/* audio-fx-ui.js — the rack UI for Filmora's 76 audio effect presets.
 *
 * Lives in the Audio inspector. The list and every parameter range are read from
 * assets/resources/audio_effect/<name>/description.json via filmora-library.js,
 * so this panel is a view over the real Filmora library rather than a hardcoded
 * handful of presets.
 */
import { store } from "./state.js";
import { toast } from "./media.js";
import {
  audioEffects,
  families,
  effectById,
  audition,
  stopAudition,
  syncElementFx,
  defaultParams,
} from "./audio-fx.js";

let famFilter = "all";
let query = "";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

const pretty = (id) =>
  id.replace(/^audio_/, "").replace(/^voice_change_/, "").replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

/** Current chain on the selected clip. */
function chain() {
  const c = selectedClip();
  return c?.audioFx ? c.audioFx.slice() : [];
}

function selectedClip() {
  const s = store.get();
  const sel = s.selectedClipId || (s.selection && s.selection[0]);
  return s.clips.find((c) => c.id === sel) || null;
}

function writeChain(list) {
  const c = selectedClip();
  if (!c) { toast("Select a clip first", "err"); return false; }
  store.updateClip(c.id, { audioFx: list }, { undo: false });
  // push the new chain into any live element graph so it is audible at once
  document.querySelectorAll("audio,video").forEach((el) => {
    try { syncElementFx(el, el.src, list); } catch { /* ignore */ }
  });
  window.__aifimoraPlayer?.render();
  return true;
}

/* ------------------------------------------------------------- rendering --- */
function renderFamilies() {
  const host = document.getElementById("audioFxFamilies");
  if (!host) return;
  const fams = families();
  const all = [{ fam: "all", label: "All", count: audioEffects().length }];
  host.innerHTML = [...all, ...fams]
    .map((f) => `<button type="button" class="chip${famFilter === f.fam ? " active" : ""}"
        data-fam="${esc(f.fam)}" role="tab" aria-selected="${famFilter === f.fam}">${esc(f.label)} <span class="chip-n">${f.count}</span></button>`)
    .join("");
}

function filtered() {
  const q = query.trim().toLowerCase();
  return audioEffects().filter((e) => {
    if (famFilter !== "all" && e.fam !== famFilter) return false;
    if (!q) return true;
    return e.id.includes(q) || (e.label || "").toLowerCase().includes(q) ||
      e.familyLabel.toLowerCase().includes(q);
  });
}

function renderList() {
  const host = document.getElementById("audioFxList");
  if (!host) return;
  const list = filtered();
  const active = chain();
  if (!list.length) {
    host.innerHTML = `<p class="empty-hint">No effect matches “${esc(query)}”.</p>`;
    return;
  }
  host.innerHTML = list
    .map((e) => {
      const on = active.some((a) => a.id === e.id);
      const p = e.params?.[0];
      return `<button type="button" class="fx-item${on ? " active" : ""}" data-fx="${esc(e.id)}"
        role="option" aria-selected="${on}" title="${esc(e.id)} — ${e.params.length} param(s)">
        <span class="fx-item-name">${esc(pretty(e.id))}</span>
        <span class="fx-item-meta">${esc(e.familyLabel)}${p ? ` · ${esc(p.n)} ${p.min}–${p.max}` : ""}</span>
      </button>`;
    })
    .join("");
  const hint = document.getElementById("audioFxCount");
  if (hint) hint.textContent = `${list.length} of ${audioEffects().length} presets`;
}

function renderChain() {
  const host = document.getElementById("audioFxChain");
  if (!host) return;
  const list = chain();
  if (!list.length) {
    host.innerHTML = `<p class="empty-hint">No effects on this clip — pick one above.</p>`;
    return;
  }
  host.innerHTML = list
    .map((item, i) => {
      const e = effectById(item.id);
      const sliders = (e?.params || []).map((p) => {
        const v = Number(item.params?.[p.n] ?? p.def);
        return `<label class="fx-param">
            <span>${esc(p.n.replace(/_/g, " "))}</span>
            <input type="range" min="${p.min}" max="${p.max}" step="${stepFor(p)}" value="${v}"
              data-chain="${i}" data-param="${esc(p.n)}" />
            <output>${fmt(v)}</output>
          </label>`;
      }).join("");
      return `<div class="fx-chain-row">
        <div class="fx-chain-head">
          <strong>${esc(pretty(item.id))}</strong>
          <button type="button" class="fx-remove" data-remove="${i}" title="Remove">✕</button>
        </div>
        ${sliders || `<div class="fx-note">No parameters published by Filmora.</div>`}
      </div>`;
    })
    .join("");
}

function stepFor(p) {
  const span = Number(p.max) - Number(p.min);
  if (!Number.isFinite(span) || span <= 1) return 1;
  return span > 20 ? 1 : 0.01;
}
function fmt(v) {
  return Number.isInteger(Number(v)) ? String(v) : Number(v).toFixed(2);
}

function render() {
  renderFamilies();
  renderList();
  renderChain();
}

/* --------------------------------------------------------------- wiring ---- */
export function initAudioFxUI() {
  const list = document.getElementById("audioFxList");
  if (!list) return;

  render();

  document.getElementById("audioFxSearch")?.addEventListener("input", (e) => {
    query = e.target.value;
    renderList();
  });

  document.getElementById("audioFxFamilies")?.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    famFilter = chip.dataset.fam;
    render();
  });

  list.addEventListener("click", (e) => {
    const btn = e.target.closest(".fx-item");
    if (!btn) return;
    const id = btn.dataset.fx;
    const cur = chain();
    const at = cur.findIndex((c) => c.id === id);
    if (at >= 0) {
      cur.splice(at, 1);
      toast(pretty(id) + " removed");
    } else {
      // Seed with Filmora's own published defaults, not zeros.
      cur.push({ id, params: defaultParams(id) });
      toast(pretty(id) + " added to chain", "ok");
    }
    if (writeChain(cur)) render();
  });

  const chainHost = document.getElementById("audioFxChain");
  chainHost?.addEventListener("input", (e) => {
    const inp = e.target.closest("input[type=range]");
    if (!inp) return;
    const i = Number(inp.dataset.chain);
    const name = inp.dataset.param;
    const out = inp.parentElement.querySelector("output");
    if (out) out.textContent = fmt(inp.value);
    const cur = chain();
    if (!cur[i]) return;
    cur[i].params = { ...(cur[i].params || {}), [name]: Number(inp.value) };
    writeChain(cur);
  });

  chainHost?.addEventListener("click", (e) => {
    const rm = e.target.closest("[data-remove]");
    if (!rm) return;
    const cur = chain();
    cur.splice(Number(rm.dataset.remove), 1);
    if (writeChain(cur)) render();
  });

  document.getElementById("btnAudioFxAudition")?.addEventListener("click", () => {
    const cur = chain();
    if (!cur.length) { toast("Add an effect first", "err"); return; }
    if (audition(cur)) toast("Auditioning " + cur.length + " effect(s)", "ok");
    else toast("Web Audio unavailable in this context", "err");
  });

  document.getElementById("btnAudioFxClear")?.addEventListener("click", () => {
    if (!chain().length) return;
    stopAudition();
    if (writeChain([])) render();
    toast("Audio chain cleared");
  });

  // keep the rack in step with clip selection
  window.addEventListener("aifimora:clip-selected", render);
  store.subscribe(render);
}
