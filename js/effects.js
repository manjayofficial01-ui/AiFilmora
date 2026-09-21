/* Color / audio / AI enhancement inspector */
import { store } from "./state.js";
import { toast } from "./media.js";
import { settings } from "./settings.js";
import {
  detectScenes,
  applyAutoDuck,
  applyVocalRemover,
  applyAudioStretch,
  generateMusicBed,
  generateVoiceover,
  createThumbnail,
  extendSelectedClip,
  applyFaceMosaic,
  applyObjectRemover,
  applyStabilization,
  applyAutoBeatMontage,
  applyColorMatch,
  applyAutoEnhance,
} from "./ai-studio.js";
import { exportCaptionsSrt } from "./workflows.js";
import { populateFilmoraLutOptions } from "./lut-panel.js";

export function initEffects() {
  bindRange("fxExposure", "exposure");
  bindRange("fxContrast", "contrast");
  bindRange("fxSaturation", "saturation");
  bindRange("fxTemperature", "temperature");
  bindRange("fxTint", "tint");
  bindRange("fxHighlights", "highlights");
  bindRange("fxShadows", "shadows");
  bindRange("fxSharpness", "sharpness");
  bindRange("fxVignette", "vignette");
  bindRange("fxLutIntensity", "lutIntensity");
  bindRange("fxMaskFeather", "maskFeather");
  bindRange("fxVoiceStrength", "voiceStrength");
  bindRange("fxStabilizeSmooth", "stabilizeSmooth");

  const lut = document.getElementById("fxLut");
  lut?.addEventListener("change", () => {
    patchSelected({ lut: lut.value });
  });

  document.getElementById("fxMask")?.addEventListener("change", (e) => {
    patchSelected({ mask: e.target.checked });
    if (e.target.checked) toast("Magic Mask on selected clip");
  });
  document.getElementById("fxMaskInvert")?.addEventListener("change", (e) => {
    patchSelected({ maskInvert: e.target.checked });
  });
  document.getElementById("fxVoice")?.addEventListener("change", (e) => {
    patchSelected({ voiceEnhance: e.target.checked });
  });
  document.getElementById("fxDenoise")?.addEventListener("change", (e) => {
    patchSelected({ denoise: e.target.checked });
    if (e.target.checked) toast("Denoise on — set strength below", "ok");
  });
  document.getElementById("fxDenoiseStrength")?.addEventListener("change", (e) => {
    patchSelected({ denoiseStrength: e.target.value });
  });
  document.getElementById("fxUpscale")?.addEventListener("change", (e) => {
    patchSelected({ upscale: e.target.checked });
  });
  document.getElementById("fxStabilize")?.addEventListener("change", (e) => {
    patchSelected({ stabilize: e.target.checked });
    if (e.target.checked) toast("Stabilization on — tune smoothness", "ok");
  });
  document.getElementById("fxFaceMosaic")?.addEventListener("change", (e) => {
    patchSelected({ faceMosaic: e.target.checked });
    if (e.target.checked) toast("Face Mosaic on — privacy blur preview", "ok");
  });
  document.getElementById("fxObjectRemover")?.addEventListener("change", (e) => {
    patchSelected({ objectRemover: e.target.checked });
    if (e.target.checked) toast("Object Remover flag set (Magic Box)", "ok");
  });

  document.getElementById("btnAutoEnhance")?.addEventListener("click", () => applyAutoEnhance());
  document.getElementById("btnColorMatch")?.addEventListener("click", () => applyColorMatch());

  // Chroma key (Filmora green screen)
  document.getElementById("fxChroma")?.addEventListener("change", (e) => {
    patchSelected({ chroma: e.target.checked });
    if (e.target.checked) toast("Chroma key on — pick a key color", "ok");
  });
  document.getElementById("fxChromaColor")?.addEventListener("input", (e) => {
    patchSelected({ chromaColor: e.target.value });
  });
  bindRange("fxChromaSimilarity", "chromaSimilarity");
  bindRange("fxChromaSmoothness", "chromaSmoothness");
  bindRange("fxChromaFeather", "chromaFeather");
  bindRange("fxChromaSpill", "chromaSpill");

  const split = document.getElementById("fxSplit");
  split?.addEventListener("change", () => {
    patchSelected({ split: split.value });
    if (split.value !== "none") toast(`Split screen: ${split.value}`, "ok");
  });

  const reframe = document.getElementById("fxReframe");
  reframe?.addEventListener("change", () => {
    patchSelected({ reframe: reframe.value });
  });

  document.getElementById("btnResetFx")?.addEventListener("click", () => {
    if (!store.get().selectedClipId) return toast("Select a clip first");
    store.pushUndo("Reset FX");
    patchSelected({
      exposure: 0,
      contrast: 0,
      saturation: 0,
      temperature: 0,
      tint: 0,
      highlights: 0,
      shadows: 0,
      sharpness: 0,
      vignette: 0,
      lut: "none",
      lutIntensity: 80,
      mask: false,
      maskFeather: 20,
      maskInvert: false,
      voiceEnhance: false,
      voiceStrength: 60,
      denoise: false,
      stabilize: false,
      stabilizeSmooth: 50,
      faceMosaic: false,
      objectRemover: false,
      reframe: "none",
      chroma: false,
      split: "none",
    });
    syncControls();
    toast("FX reset");
  });

  document.getElementById("btnClearFx")?.addEventListener("click", () => {
    const id = store.get().selectedClipId;
    if (!id) return toast("Select a clip first");
    store.pushUndo("Clear effects");
    store.updateClip(id, {
      fx: {
        exposure: 0,
        contrast: 0,
        saturation: 0,
        temperature: 0,
        tint: 0,
        highlights: 0,
        shadows: 0,
        sharpness: 0,
        vignette: 0,
        lut: "none",
        lutIntensity: 80,
        mask: false,
        voiceEnhance: false,
        denoise: false,
        stabilize: false,
        faceMosaic: false,
        objectRemover: false,
        reframe: "none",
        chroma: false,
        split: "none",
      },
    });
    syncControls();
    toast("All effects removed from clip", "ok");
  });

  // tool buttons in effects panel
  document.querySelectorAll("[data-tool]").forEach((btn) => {
    btn.addEventListener("click", () => runTool(btn.dataset.tool));
  });

  document.getElementById("btnApplyFxAll")?.addEventListener("click", () => {
    const clip = store.getClip(store.get().selectedClipId);
    if (!clip) return toast("Select a clip first");
    store.pushUndo("Apply FX to all");
    const fx = { ...(clip.fx || {}) };
    store.set({
      clips: store.get().clips.map((c) =>
        c.type === "audio"
          ? c
          : { ...c, fx: { ...fx, voiceEnhance: c.fx?.voiceEnhance ?? false } }
      ),
    });
    toast("FX copied to all video clips", "ok");
    store.save();
  });

  store.subscribe(() => syncControls());
  syncControls();
  populateLutDropdown();
  settings.subscribe(() => populateLutDropdown());
}

/** List built-in + imported .cube LUTs in the FX dropdown. */
function populateLutDropdown() {
  const sel = document.getElementById("fxLut");
  if (!sel) return;
  const current = sel.value;
  const builtins = [
    ["none", "None"],
    ["cinematic", "Cinematic"],
    ["tealOrange", "Teal & Orange"],
    ["sunset", "Sunset"],
    ["neon", "Neon"],
    ["mono", "Mono"],
  ];
  sel.innerHTML = builtins.map(([v, l]) => `<option value="${v}">${l}</option>`).join("");
  (settings.get().luts || []).forEach((l) => {
    const opt = document.createElement("option");
    opt.value = "custom:" + l.id;
    opt.textContent = l.name || "Imported LUT";
    sel.appendChild(opt);
  });
  // The 25 Filmora .CUBE looks ship with the app. Appended last so a rebuilt
  // dropdown (settings.subscribe) always keeps them.
  populateFilmoraLutOptions(sel);
  if ([...sel.options].some((o) => o.value === current)) sel.value = current;
}

function bindRange(id, key) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener("input", () => {
    const out = document.getElementById(id + "Out");
    if (out) out.textContent = el.value;
    patchSelected({ [key]: Number(el.value) });
  });
}

function patchSelected(patch) {
  const id = store.get().selectedClipId;
  if (!id) {
    toast("Select a clip on the timeline first", "err");
    return;
  }
  const clip = store.getClip(id);
  if (!clip) {
    toast("Select a clip on the timeline first", "err");
    return;
  }
  // Convert chroma similarity/smoothness/feather/spill from 0–100 UI to 0–1 storage
  const p = { ...patch };
  if ("chromaSimilarity" in p) p.chromaSimilarity = Number(p.chromaSimilarity) / 100;
  if ("chromaSmoothness" in p) p.chromaSmoothness = Number(p.chromaSmoothness) / 100;
  if ("chromaFeather" in p) p.chromaFeather = Number(p.chromaFeather);
  if ("chromaSpill" in p) p.chromaSpill = Number(p.chromaSpill);
  // Discrete toggles get their own undo step; continuous sliders rely on the
  // surrounding panel actions / undo of the last discrete change.
  const discrete = ["chroma", "mask", "maskInvert", "voiceEnhance", "denoise", "denoiseStrength", "upscale", "stabilize", "faceMosaic", "objectRemover", "split", "lut", "reframe", "eqPreset"];
  const wantsUndo = Object.keys(p).some((k) => discrete.includes(k));
  store.updateClip(id, { fx: p }, { undo: wantsUndo });
}

function syncControls() {
  const clip = store.getClip(store.get().selectedClipId);
  const fx = clip?.fx || {
    exposure: 0,
    contrast: 0,
    saturation: 0,
    temperature: 0,
    tint: 0,
    highlights: 0,
    shadows: 0,
    sharpness: 0,
    vignette: 0,
    lut: "none",
    lutIntensity: 80,
    mask: false,
    maskFeather: 20,
    maskInvert: false,
    voiceEnhance: false,
    voiceStrength: 60,
    denoise: false,
    denoiseStrength: "medium",
    stabilize: false,
    stabilizeSmooth: 50,
    faceMosaic: false,
    objectRemover: false,
    reframe: "none",
    chroma: false,
    chromaColor: "#00ff00",
    chromaSimilarity: 0.4,
    chromaSmoothness: 0.1,
    chromaFeather: 10,
    chromaSpill: 10,
    split: "none",
  };
  setRange("fxExposure", fx.exposure);
  setRange("fxContrast", fx.contrast);
  setRange("fxSaturation", fx.saturation);
  setRange("fxTemperature", fx.temperature);
  setRange("fxTint", fx.tint ?? 0);
  setRange("fxHighlights", fx.highlights ?? 0);
  setRange("fxShadows", fx.shadows ?? 0);
  setRange("fxSharpness", fx.sharpness ?? 0);
  setRange("fxVignette", fx.vignette);
  setRange("fxLutIntensity", fx.lutIntensity ?? 80);
  setRange("fxMaskFeather", fx.maskFeather ?? 20);
  setRange("fxVoiceStrength", fx.voiceStrength ?? 60);
  setRange("fxStabilizeSmooth", fx.stabilizeSmooth ?? 50);
  const lut = document.getElementById("fxLut");
  if (lut) lut.value = fx.lut || "none";
  const reframe = document.getElementById("fxReframe");
  if (reframe) reframe.value = fx.reframe || "none";
  const mask = document.getElementById("fxMask");
  if (mask) mask.checked = !!fx.mask;
  const maskInv = document.getElementById("fxMaskInvert");
  if (maskInv) maskInv.checked = !!fx.maskInvert;
  const voice = document.getElementById("fxVoice");
  if (voice) voice.checked = !!fx.voiceEnhance;
  const dn = document.getElementById("fxDenoise");
  if (dn) dn.checked = !!fx.denoise;
  const dnS = document.getElementById("fxDenoiseStrength");
  if (dnS) dnS.value = fx.denoiseStrength || "medium";
  const up = document.getElementById("fxUpscale");
  if (up) up.checked = !!fx.upscale;
  const stab = document.getElementById("fxStabilize");
  if (stab) stab.checked = !!fx.stabilize;
  const fm = document.getElementById("fxFaceMosaic");
  if (fm) fm.checked = !!fx.faceMosaic;
  const orm = document.getElementById("fxObjectRemover");
  if (orm) orm.checked = !!fx.objectRemover;
  const chroma = document.getElementById("fxChroma");
  if (chroma) chroma.checked = !!fx.chroma;
  const chromaColor = document.getElementById("fxChromaColor");
  if (chromaColor) chromaColor.value = fx.chromaColor || "#00ff00";
  // similarity/smoothness stored 0..1, UI 0..100
  setRange("fxChromaSimilarity", Math.round((fx.chromaSimilarity ?? 0.4) * 100));
  setRange("fxChromaSmoothness", Math.round((fx.chromaSmoothness ?? 0.1) * 100));
  setRange("fxChromaFeather", fx.chromaFeather ?? 10);
  setRange("fxChromaSpill", fx.chromaSpill ?? 10);
  const split = document.getElementById("fxSplit");
  if (split) split.value = fx.split || "none";

  const label = document.getElementById("selectedClipLabel");
  if (label) {
    let text = clip ? clip.name : "No clip selected";
    if (clip && clip.speed && Math.abs(clip.speed - 1) > 0.01) text += ` · ${clip.speed.toFixed(2)}×`;
    if (clip?.audioMuted) text += " · muted";
    if (clip?.freeze) text += " · freeze";
    if (clip?.fx?.chroma) text += " · chroma";
    if (clip?.fx?.stabilize) text += " · stab";
    if (clip?.fx?.faceMosaic) text += " · mosaic";
    label.textContent = text;
  }
}

function setRange(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = String(val ?? 0);
  const out = document.getElementById(id + "Out");
  if (out) out.textContent = String(val ?? 0);
}

function runTool(tool) {
  const s = store.get();
  if (!s.clips.length) return toast("Add clips first");

  const map = {
    grade: () => {
      store.set({
        clips: s.clips.map((c) =>
          c.type === "audio" ? c : { ...c, fx: { ...c.fx, contrast: 18, saturation: 10, temperature: 6, vignette: 30, lut: "cinematic" } }
        ),
      });
      toast("Cinematic grade applied", "ok");
    },
    autoEnhance: () => applyAutoEnhance(),
    colorMatch: () => applyColorMatch(),
    stabilize: () => applyStabilization(),
    mask: () => {
      store.set({
        clips: s.clips.map((c) => (c.type === "audio" ? c : { ...c, fx: { ...c.fx, mask: true } })),
      });
      toast("Magic Mask enabled", "ok");
    },
    voice: () => {
      store.set({
        clips: s.clips.map((c) => (c.type === "audio" ? { ...c, fx: { ...c.fx, voiceEnhance: true } } : c)),
      });
      toast("Voice isolation on", "ok");
    },
    upscale: () => {
      store.set({
        clips: s.clips.map((c) => (c.type === "audio" ? c : { ...c, fx: { ...c.fx, upscale: true } })),
      });
      toast("Super Scale enabled", "ok");
    },
    reframe: () => {
      store.set({
        clips: s.clips.map((c) => (c.type === "audio" ? c : { ...c, fx: { ...c.fx, reframe: "9:16" } })),
      });
      toast("Reframed to 9:16", "ok");
    },
    denoise: () => {
      const strength = settings.audioConfig().denoiseStrength;
      toast(`Denoise pass complete (${strength})`, "ok");
      store.set({
        clips: s.clips.map((c) => (c.type === "audio" ? { ...c, fx: { ...c.fx, denoise: true, denoiseStrength: strength }, name: c.name.replace(/ ·dn$/, "") + " ·dn" } : c)),
      });
    },
    vocalRemover: () => applyVocalRemover(),
    stretch: () => applyAudioStretch(),
    faceMosaic: () => applyFaceMosaic(),
    objectRemover: () => applyObjectRemover(),
    music: () => generateMusicBed(),
    tts: () => generateVoiceover(),
    thumbnail: () => createThumbnail(),
    extend: () => extendSelectedClip(),
    beatMontage: () => applyAutoBeatMontage(),
    scenes: () => detectScenes(),
    duck: () => applyAutoDuck(),
    srt: () => exportCaptionsSrt(),
  };
  (map[tool] || (() => toast("Unknown tool")))();
  store.save();
}
