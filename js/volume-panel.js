/* Volume panel (Filmora Audio-style) + master player volume */
import { store } from "./state.js";
import { toast } from "./media.js";

function selected() {
  const id = store.get().selectedClipId;
  return id ? store.getClip(id) : null;
}

function syncVolumeUI() {
  const clip = selected();
  const label = document.getElementById("volumeClipLabel");
  if (label) {
    if (!clip) label.textContent = "No clip selected";
    else {
      const v = clip.volume ?? 100;
      const detached = store.isDetachSilent(clip);
      label.textContent = `${clip.name} · ${v}%${detached ? " · audio detached (silent)" : clip.audioMuted ? " · muted" : ""}${clip.fx?.eqPreset && clip.fx.eqPreset !== "flat" ? " · EQ:" + clip.fx.eqPreset : ""}`;
    }
  }
  const vol = document.getElementById("clipVolume");
  const volOut = document.getElementById("clipVolumeOut");
  const v = clip?.volume ?? 100;
  if (vol) vol.value = String(v);
  if (volOut) volOut.textContent = `${v}%`;

  const fi = document.getElementById("volFadeIn");
  const fo = document.getElementById("volFadeOut");
  const fio = document.getElementById("volFadeInOut");
  const foo = document.getElementById("volFadeOutOut");
  const fadeIn = clip?.fadeIn || 0;
  const fadeOut = clip?.fadeOut || 0;
  if (fi) fi.value = String(fadeIn);
  if (fo) fo.value = String(fadeOut);
  if (fio) fio.textContent = Number(fadeIn).toFixed(1) + "s";
  if (foo) foo.textContent = Number(fadeOut).toFixed(1) + "s";

  const mute = document.getElementById("volMute");
  if (mute) mute.checked = !!clip?.audioMuted;
  const norm = document.getElementById("volNormalize");
  if (norm) norm.checked = clip?.normalizeLufs != null;
  const lufs = document.getElementById("volLufs");
  if (lufs && clip?.normalizeLufs != null) lufs.value = String(clip.normalizeLufs);
  const eq = document.getElementById("volEq");
  if (eq) eq.value = clip?.fx?.eqPreset || "flat";
  const dn = document.getElementById("volDenoise");
  if (dn) dn.value = clip?.fx?.denoiseStrength || (clip?.fx?.denoise ? "medium" : "off");
  const hum = document.getElementById("volHum");
  if (hum) hum.checked = !!clip?.fx?.humRemoval;
  const wind = document.getElementById("volWind");
  if (wind) wind.checked = !!clip?.fx?.windRemoval;
}

function applyVolume(val) {
  const clip = selected();
  if (!clip) return toast("Select a clip first");
  if (clip.type === "text") return toast("Text has no audio", "err");
  store.setClipVolume(clip.id, val);
  toast(`Volume ${val}%`, "ok");
  syncVolumeUI();
  window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
}

export function initVolumePanel() {
  const vol = document.getElementById("clipVolume");
  vol?.addEventListener("input", () => {
    const out = document.getElementById("clipVolumeOut");
    if (out) out.textContent = vol.value + "%";
  });
  vol?.addEventListener("change", () => applyVolume(Number(vol.value)));

  document.querySelectorAll("[data-vol]").forEach((btn) => {
    btn.addEventListener("click", () => applyVolume(Number(btn.dataset.vol)));
  });

  document.getElementById("volMute")?.addEventListener("change", (e) => {
    const clip = selected();
    if (!clip) return toast("Select a clip");
    store.setClipMuted(clip.id, e.target.checked);
    toast(e.target.checked ? "Muted" : "Unmuted", "ok");
    syncVolumeUI();
  });

  const bindFade = (id, key) => {
    const el = document.getElementById(id);
    const out = document.getElementById(id + "Out");
    el?.addEventListener("input", () => {
      if (out) out.textContent = Number(el.value).toFixed(1) + "s";
    });
    el?.addEventListener("change", () => {
      const clip = selected();
      if (!clip) return toast("Select a clip");
      store.setClipFades(clip.id, { [key]: Number(el.value) });
      toast(`${key === "fadeIn" ? "Fade in" : "Fade out"} ${Number(el.value).toFixed(1)}s`, "ok");
      syncVolumeUI();
    });
  };
  bindFade("volFadeIn", "fadeIn");
  bindFade("volFadeOut", "fadeOut");

  document.getElementById("btnVolReset")?.addEventListener("click", () => {
    const clip = selected();
    if (!clip) return toast("Select a clip");
    store.pushUndo("Reset volume");
    store.updateClip(clip.id, { volume: 100, fadeIn: 0, fadeOut: 0, audioMuted: false, fx: { eqPreset: "flat", denoise: false, humRemoval: false, windRemoval: false } });
    syncVolumeUI();
    toast("Volume reset", "ok");
  });

  document.getElementById("volEq")?.addEventListener("change", (e) => {
    const clip = selected();
    if (!clip) return toast("Select a clip");
    store.updateClip(clip.id, { fx: { eqPreset: e.target.value } }, { undo: true });
    toast(`EQ: ${e.target.value}`, "ok");
    syncVolumeUI();
  });
  document.getElementById("volDenoise")?.addEventListener("change", (e) => {
    const clip = selected();
    if (!clip) return toast("Select a clip");
    const v = e.target.value;
    store.updateClip(clip.id, { fx: { denoise: v !== "off", denoiseStrength: v } }, { undo: true });
    toast(v === "off" ? "Denoise off" : `Denoise ${v}`, "ok");
    syncVolumeUI();
  });
  document.getElementById("volHum")?.addEventListener("change", (e) => {
    const clip = selected();
    if (!clip) return toast("Select a clip");
    store.updateClip(clip.id, { fx: { humRemoval: e.target.checked } }, { undo: true });
    syncVolumeUI();
  });
  document.getElementById("volWind")?.addEventListener("change", (e) => {
    const clip = selected();
    if (!clip) return toast("Select a clip");
    store.updateClip(clip.id, { fx: { windRemoval: e.target.checked } }, { undo: true });
    syncVolumeUI();
  });
  document.getElementById("btnAudioStretch")?.addEventListener("click", async () => {
    const { applyAudioStretch } = await import("./ai-studio.js");
    applyAudioStretch();
  });

  // Master volume on player
  const master = document.getElementById("masterVolume");
  const masterOut = document.getElementById("masterVolumeOut");
  const muteMaster = document.getElementById("btnPlayerMute");
  const saved = Number(localStorage.getItem("aifimora.masterVol") || 80);
  let masterVol = Math.min(100, Math.max(0, saved));
  let masterMuted = localStorage.getItem("aifimora.masterMuted") === "1";

  const paintMaster = () => {
    if (master) master.value = String(masterVol);
    if (masterOut) masterOut.textContent = masterMuted ? "Mute" : `${masterVol}%`;
    if (muteMaster) muteMaster.textContent = masterMuted || masterVol === 0 ? "🔇" : masterVol < 50 ? "🔉" : "🔊";
  };
  paintMaster();

  master?.addEventListener("input", () => {
    masterVol = Number(master.value);
    masterMuted = masterVol === 0;
    localStorage.setItem("aifimora.masterVol", String(masterVol));
    localStorage.setItem("aifimora.masterMuted", masterMuted ? "1" : "0");
    paintMaster();
    window.dispatchEvent(
      new CustomEvent("aifimora:master-volume", { detail: { volume: masterMuted ? 0 : masterVol / 100 } })
    );
  });

  muteMaster?.addEventListener("click", () => {
    masterMuted = !masterMuted;
    localStorage.setItem("aifimora.masterMuted", masterMuted ? "1" : "0");
    paintMaster();
    window.dispatchEvent(
      new CustomEvent("aifimora:master-volume", {
        detail: { volume: masterMuted ? 0 : masterVol / 100 },
      })
    );
  });

  // Auto normalize (Filmora LUFS presets) — sets clip volume toward target
  document.getElementById("volNormalize")?.addEventListener("change", (e) => {
    const clip = selected();
    if (!clip) {
      e.target.checked = false;
      return toast("Select a clip first");
    }
    const lufs = Number(document.getElementById("volLufs")?.value || -14);
    // Map LUFS target to a demo gain (−23 → quieter, −10 → louder)
    const target = Math.round(100 + (lufs + 14) * 3);
    store.pushUndo("Auto normalize");
    store.updateClip(clip.id, { volume: Math.min(500, Math.max(0, target)), normalizeLufs: lufs });
    toast(`Normalized to ${lufs} LUFS → ${target}%`, "ok");
    syncVolumeUI();
  });
  document.getElementById("volLufs")?.addEventListener("change", () => {
    const n = document.getElementById("volNormalize");
    if (n?.checked) n.dispatchEvent(new Event("change"));
  });

  store.subscribe(syncVolumeUI);
  syncVolumeUI();
}

export function getMasterVolume() {
  const muted = localStorage.getItem("aifimora.masterMuted") === "1";
  if (muted) return 0;
  return Math.min(100, Math.max(0, Number(localStorage.getItem("aifimora.masterVol") || 80))) / 100;
}
