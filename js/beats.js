/* Beat Sync — detect musical beats on an audio clip. Real analysis via the
 * Web Audio API when a fetchable source exists; otherwise simulates from the
 * BPM preference (Filmora-style Beat Markers). Results are stored on
 * clip.beats (clip-local seconds) and rendered on the timeline. */

import { store } from "./state.js";
import { settings } from "./settings.js";

function toast(msg, kind) {
  window.dispatchEvent(new CustomEvent("aifimora:toast", { detail: { msg, kind } }));
}
function selectedClip() {
  const s = store.get();
  return s.clips.find((c) => c.id === s.selectedClipId) || null;
}
function mediaFor(clip) {
  return store.get().media.find((m) => m.id === clip.mediaId) || null;
}

function simulateBeats(clip) {
  const cfg = settings.beatConfig ? settings.beatConfig() : { bpm: Number(settings.get().beat?.bpm) || 120 };
  const bpm = cfg.bpm || 120;
  const interval = 60 / bpm;
  const beats = [];
  let t = 0;
  let i = 0;
  while (t <= clip.duration) {
    // light humanization + accent emphasis every 4th beat
    const jitter = (Math.sin(i * 1.7) * 0.02 + (Math.random() - 0.5) * 0.03) * interval;
    beats.push(Math.max(0, Math.min(clip.duration, t + jitter)));
    t += interval;
    i++;
  }
  return { beats, bpm, source: "bpm", highlightFreq: cfg.highlightFreq || 4, highlightOffset: cfg.highlightOffset || 0 };
}

async function analyzeAudioFile(url, clip) {
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!OAC || !AC) throw new Error("Web Audio unavailable");
  const arrayBuf = await fetch(url).then((r) => {
    if (!r.ok) throw new Error("fetch " + r.status);
    return r.arrayBuffer();
  });
  const decodeCtx = new AC();
  const audioBuf = await decodeCtx.decodeAudioData(arrayBuf);
  const off = new OAC(1, audioBuf.length, audioBuf.sampleRate);
  const src = off.createBufferSource();
  src.buffer = audioBuf;
  src.connect(off.destination);
  src.start();
  const rendered = await off.startRendering();
  const data = rendered.getChannelData(0);
  // energy-based onset detection
  const fps = 60; // analysis resolution
  const frame = Math.max(1, Math.floor(data.length / (clip.duration * fps)));
  const env = [];
  for (let i = 0; i < data.length; i += frame) {
    let sum = 0;
    for (let j = 0; j < frame && i + j < data.length; j++) sum += data[i + j] * data[i + j];
    env.push(Math.sqrt(sum / frame));
  }
  // peak picking with adaptive threshold
  const beats = [];
  const win = Math.floor(0.12 * fps); // ~120ms
  for (let i = 1; i < env.length - 1; i++) {
    let local = 0;
    for (let k = Math.max(0, i - win); k < Math.min(env.length, i + win); k++) local += env[k];
    local /= Math.min(env.length, i + win) - Math.max(0, i - win);
    if (env[i] > local * 1.4 && env[i] >= env[i - 1] && env[i] >= env[i + 1]) {
      const t = (i / env.length) * clip.duration;
      if (!beats.length || t - beats[beats.length - 1] > 0.18) beats.push(t);
    }
  }
  const bpm = beats.length > 1 ? Math.round(60 / ((beats[beats.length - 1] - beats[0]) / (beats.length - 1))) : 120;
  return { beats, bpm, source: "audio" };
}

async function runBeatSync() {
  const clip = selectedClip();
  if (!clip || clip.type !== "audio") {
    toast("Select an audio clip to run Beat Sync", "warn");
    return;
  }
  toast("Beat Sync running…");
  let result;
  const media = mediaFor(clip);
  const url = media?.url || media?.src;
  if (url && /^https?:|^blob:|^data:/.test(url)) {
    try {
      result = await analyzeAudioFile(url, clip);
    } catch (e) {
      result = simulateBeats(clip);
    }
  } else {
    result = simulateBeats(clip);
  }
  store.updateClip(clip.id, { beats: result.beats, beatMeta: { bpm: result.bpm, source: result.source } });
  const cfg = settings.beatConfig ? settings.beatConfig() : { highlightFreq: 4 };
  toast(`Beat Sync: ${result.beats.length} beats · ${result.bpm} BPM (${result.source}) · highlights every ${cfg.highlightFreq}`, "ok");
  window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
}

export function isHighlightBeat(index) {
  const cfg = settings.beatConfig ? settings.beatConfig() : { highlightFreq: 4, highlightOffset: 0, showAllBeats: false };
  if (cfg.showAllBeats) return true;
  return (index - (cfg.highlightOffset || 0)) % (cfg.highlightFreq || 4) === 0;
}

export function openBeatOptions() {
  let modal = document.getElementById("beatOptionsModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "beatOptionsModal";
    modal.className = "modal-backdrop";
    modal.innerHTML = `
      <div class="modal" role="dialog" aria-label="Beat Options">
        <header class="modal-head"><h3>Beat Options (Filmora)</h3><button type="button" class="icon-btn" id="boClose">✕</button></header>
        <div class="modal-body">
          <label class="field-row"><span>Highlight every N beats</span><input type="number" id="boFreq" min="1" max="16"></label>
          <label class="field-row"><span>Highlight offset</span><input type="number" id="boOffset" min="0" max="16"></label>
          <label class="field-row"><span>Show all markers</span><input type="checkbox" id="boAll"></label>
          <label class="field-row"><span>BPM fallback</span><input type="number" id="boBpm" min="40" max="240"></label>
          <p style="font-size:11px;color:var(--muted)">Mirrors Filmora Beat Options: highlight beat frequency, offset, and all-vs-highlight display. Timeline dims non-highlight beats when “Show all” is off.</p>
        </div>
        <footer class="modal-foot"><button type="button" class="btn ghost" id="boCancel">Cancel</button><button type="button" class="btn primary" id="boApply">Apply</button></footer>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector("#boClose")?.addEventListener("click", () => modal.classList.remove("open"));
    modal.querySelector("#boCancel")?.addEventListener("click", () => modal.classList.remove("open"));
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("open"); });
    window.addEventListener("keydown", (e) => { if (e.key === "Escape") modal.classList.remove("open"); });
    modal.querySelector("#boApply")?.addEventListener("click", () => {
      const freq = Number(modal.querySelector("#boFreq")?.value) || 4;
      const offset = Number(modal.querySelector("#boOffset")?.value) || 0;
      const all = !!modal.querySelector("#boAll")?.checked;
      const bpm = Number(modal.querySelector("#boBpm")?.value) || 120;
      settings.set({ beat: { highlightFreq: freq, highlightOffset: offset, showAllBeats: all, bpm } });
      toast(`Beat Options: every ${freq}, offset ${offset}${all ? ", all markers" : ", highlights only"}`, "ok");
      modal.classList.remove("open");
      window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
    });
  }
  const b = settings.beatConfig ? settings.beatConfig() : settings.get().beat;
  modal.querySelector("#boFreq").value = String(b.highlightFreq ?? 4);
  modal.querySelector("#boOffset").value = String(b.highlightOffset ?? 0);
  modal.querySelector("#boAll").checked = !!b.showAllBeats;
  modal.querySelector("#boBpm").value = String(b.bpm ?? 120);
  modal.classList.add("open");
}

function clearBeats() {
  const clip = selectedClip();
  if (!clip) return;
  store.updateClip(clip.id, { beats: [] });
  toast("Beat markers cleared", "ok");
  window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
}

export function initBeats() {
  document.getElementById("btnBeatSync")?.addEventListener("click", () => runBeatSync());
  document.getElementById("btnBeatOptions")?.addEventListener("click", () => openBeatOptions());
  document.getElementById("btnClearBeats")?.addEventListener("click", clearBeats);
  window.addEventListener("aifimora:beat-options", () => openBeatOptions());
}
