/* AiFimora — global Preferences / Settings store (persisted, cross-project).
 * This is the "missing" Preferences dialog Filmora ships with: General, Editing,
 * Playback, Audio, AI and caption/scope/beat configuration live here.
 * Settings persist independently of the project so they survive New / Load. */

const SETTINGS_KEY = "aifimora.settings.v2";

const DEFAULTS = {
  theme: "dark", // "dark" | "light" | "vip"
  interfaceMode: "dark", // Filmora General → Appearance: dark | light | system
  checkUpdates: "weekly", // never | daily | weekly
  showLibraryAtStartup: true, // Filmora Project Library window at startup
  showProjectInfo: true, // Expand the Project information card in the inspector
  messageCenter: true,
  outputFolder: "",
  autosaveSec: 30,
  folders: {
    // Filmora Folders tab: snapshot / temp / recorded / project / backup locations
    snapshot: "",
    temp: "",
    recorded: "",
    projectLocation: "",
    backupLocation: "",
  },
  editing: {
    defaultTransition: "dissolve",
    defaultTransitionDur: 0.6,
    defaultPhotoLen: 4,
    defaultTitleLen: 3,
    defaultEffectDur: 5, // Filmora Editing → default effect duration
    splitScreenDur: 5, // Filmora Editing → split-screen duration
    photoPlacement: "fit", // fit | crop | panzoom (Filmora Photo Placement)
    insertMode: "insert", // insert (ripple split) | overwrite
    timelineUnits: "timecode", // timecode | seconds | frames
    rippleDefault: true,
    snapDefault: true,
    imageAnim: "kenburns", // none | fade | kenburns
    autoTransitions: true,
    stillHold: 2,
    compoundDefault: false,
    // Filmora 15 creative tool defaults
    penStrokeW: 6, // Pen Tool stroke weight
    penFillClose: true, // fill closed paths
    penTrimPath: true, // trim-path reveal animation
    chartType: "bar", // bar | line | pie
    chartDuration: 5, // chart / path / visualizer default length
    visualizerStyle: "bars", // bars | wave | circle
    chaptersBar: true, // draw chapter progress bar in program monitor
    motionBlurDefault: 45, // when toggling Motion Blur on
    deflickerDefault: 60, // when toggling Flicker Removal on
  },
  playback: {
    previewQuality: 1, // 0.5 | 0.75 | 1 | 1.5 | 2 device-pixel scale
    playbackQuality: "full", // Filmora Preview quality: full | half | quarter
    masterVolume: 80,
    loopTimeline: false,
    showSafeAreas: false,
    playFromScrub: false,
  },
  audio: {
    normalizeTarget: -14, // LUFS
    sampleRate: 48000,
    ducking: false,
    duckingDb: -12,
    duckingFade: 0.4,
    defaultFade: 0.3,
    noiseGate: false,
    // Filmora AI Audio suite depth
    denoiseStrength: "medium", // off | weak | medium | strong
    humRemoval: false,
    windRemoval: false,
    eqPreset: "flat", // flat | voice | music | bass | treble | custom
    pitchSemitones: 0, // -12..+12 for pitch-shifted preview
    autoNormalize: false,
    bitDepth: "32f", // Filmora 15 32-bit float audio pipeline: 16 | 24 | 32f
  },
  ai: {
    creditCap: 1000,
    watermark: false,
    offlineFirst: true,
    defaultModel: "veo-3.1",
    silenceThreshold: 0.18,
    silenceMinPad: 0.15,
    silenceMinDur: 0.5, // Filmora Silence Detection → min silence length (s)
    sceneThreshold: 0.28,
    autoCaptionsOnImport: false,
    // Filmora 15 generation depth
    musicMood: "cinematic",
    musicTempo: "90bpm",
    musicDuration: 15,
    ttsVoice: "aria",
    ttsRate: 1,
    ttsPitch: 1,
    extendSeconds: 3, // AI Extend forward seconds (1-5)
    enhancerIntensity: 60, // AI Video Enhancer 0-100
    faceMosaicSize: 24,
    sfxDuration: 2, // AI Sound Effect Generator default length (s)
    voiceCloneLangs: 16, // AI Voice Cloning language count
  },
  caption: {
    fontSize: 22,
    color: "#ffffff",
    bg: "rgba(0,0,0,0.55)",
    position: "bottom", // top | lower | bottom
    bold: true,
    outline: true,
    highlightWord: true,
    font: "Segoe UI",
    lang: "en",
    template: "basic", // basic | pop | karaoke | outline (Filmora Dynamic Captions)
    bilingual: false,
    secondLang: "es",
  },
  scopes: { mode: "waveform", parity: "rec709" },
  beat: {
    bpm: 120,
    strength: 0.6,
    autoMontage: false,
    highlightFreq: 4, // Filmora Beat Options → highlight every N beats
    highlightOffset: 0, // beats to skip before first highlight
    showAllBeats: false, // false = highlights only
  },
  color: {
    // Filmora Color depth: LUT strength + auto-enhance + match
    lutIntensity: 80, // 0-100
    autoEnhanceIntensity: 60,
    colorMatchStrength: 80,
    sharpnessDefault: 0,
  },
  performance: {
    gpuAccel: true,
    hardwareEncode: true,
    decodeAccel: true, // Filmora Performance → video decoding
    playbackAccel: true, // Filmora Performance → playback
    renderAccel: true, // Filmora Performance → rendering
    backgroundRender: false, // Filmora Performance → background render
    previewRender: true, // render preview files
    smartRender: true,
    proxyEnabled: false,
    proxyRes: 540,
    autoProxy: false,
    timelineThumbs: true,
    showWaveform: true,
    previewDropped: true,
  },
  exportDefaults: {
    container: "mp4",
    codec: "h264",
    quality: "high", // low | medium | high | custom
    bitrate: 12, // Mbps when custom
    fps: 30,
    hardware: true,
    audioCodec: "aac",
    audioBitrate: 192,
    preset: "yt1080",
    burnInCaptions: true, // Filmora export → burn captions
    socialUpload: "none", // none | youtube | tiktok | vimeo
  },
  projectDefaults: {
    width: 1920,
    height: 1080,
    fps: 30,
    aspect: "16:9",
    colorSpace: "rec709",
  },
  storage: {
    maxCacheMb: 2048,
    autoClearDays: 30,
  },
  backup: {
    enabled: true,
    keepVersions: 8,
    recoverPrompt: true,
  },
  appearance: {
    uiScale: 100, // 80–125
    compact: false,
    language: "en", // en | zh
  },
  importDefaults: {
    stillDuration: 4,
    autoAddToTimeline: false,
    generateProxy: false,
    conformToProject: true,
  },
  save: {
    // 2.2.0 — Ask-location + Default Save Location for project & video saves.
    defaultProjectDir: "",
    defaultVideoDir: "",
    askProjectLocation: true,
    askVideoLocation: true,
  },
  // Filmora-style remappable shortcuts (action id → "KeyS" style)
  shortcuts: {},
  // Imported 3D LUTs (Filmora-style .cube)
  luts: [], // [{ id, name, size, data:Uint8Array-like Array }]
};

export const ASPECT_PRESETS = [
  { id: "16:9", w: 1920, h: 1080, label: "16:9 · YouTube" },
  { id: "9:16", w: 1080, h: 1920, label: "9:16 · TikTok / Shorts" },
  { id: "1:1", w: 1080, h: 1080, label: "1:1 · Instagram" },
  { id: "4:5", w: 1080, h: 1350, label: "4:5 · Feed" },
  { id: "21:9", w: 2560, h: 1080, label: "21:9 · Cinematic" },
];

function deepMerge(base, over) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  if (!over || typeof over !== "object") return out;
  for (const k of Object.keys(over)) {
    const bv = base?.[k];
    const ov = over[k];
    if (bv && typeof bv === "object" && !Array.isArray(bv) && ov && typeof ov === "object") {
      out[k] = deepMerge(bv, ov);
    } else {
      out[k] = ov;
    }
  }
  return out;
}

function sanitizeLuts(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((l) => l && l.id && l.size && Array.isArray(l.data))
    .map((l) => ({
      id: l.id,
      name: l.name || "LUT",
      size: l.size,
      data: l.data,
    }))
    .slice(0, 40);
}

class Settings {
  constructor() {
    this.s = deepMerge(DEFAULTS, {});
    this.listeners = new Set();
    this.load();
  }

  load() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      const merged = deepMerge(DEFAULTS, data);
      merged.luts = sanitizeLuts(data.luts || []);
      this.s = merged;
    } catch {
      /* keep defaults */
    }
  }

  save() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.s));
    } catch {
      /* quota — ignore */
    }
  }

  get() {
    return this.s;
  }

  /** Shallow-or-deep patch. Accepts a function (state)=>patch too. */
  set(patch, { silent = false } = {}) {
    const p = typeof patch === "function" ? patch(this.s) : patch;
    this.s = deepMerge(this.s, p);
    if (!silent) {
      this.save();
      this.emit();
    }
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    this.listeners.forEach((fn) => fn(this.s));
    window.dispatchEvent(new CustomEvent("aifimora:settings", { detail: this.s }));
  }

  // --- convenience accessors used across modules ---
  captionStyle() {
    return this.s.caption;
  }
  previewScale() {
    const q = Number(this.s.playback.previewQuality) || 1;
    return Math.min(2, Math.max(0.4, q));
  }
  snapDefault() {
    return !!this.s.editing.snapDefault;
  }
  addLut(lut) {
    const luts = sanitizeLuts([...this.s.luts, lut]);
    this.set({ luts });
    return lut;
  }
  removeLut(id) {
    this.set({ luts: this.s.luts.filter((l) => l.id !== id) });
  }
  getLut(id) {
    return this.s.luts.find((l) => l.id === id) || null;
  }

  /** Apply theme + playback defaults that are global side-effects. */
  applyTheme() {
    const root = document.documentElement;
    const theme = this.s.theme || this.s.interfaceMode || "dark";
    const vip = theme === "vip";
    // Filmora-derived presets carry their own token table (see assets-bridge.js).
    // Anything else must first drop the inline overrides so the stylesheet wins.
    const filmoraLight = theme === "filmora-light";
    const light = theme === "light" || filmoraLight;
    if (window.__aifimoraIsThemePreset?.(theme)) {
      window.__aifimoraApplyThemePreset?.(theme);
    } else {
      window.__aifimoraClearThemePreset?.();
    }
    root.classList.toggle("theme-vip", vip);
    root.classList.toggle("theme-light", light);
    root.setAttribute("data-theme", vip ? "vip" : light ? "light" : "dark");
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) meta.setAttribute("content", light ? "light" : "dark");
    this.applyAppearance();
  }

  applyAppearance() {
    const a = this.s.appearance || {};
    const scale = Math.min(125, Math.max(80, Number(a.uiScale) || 100));
    document.documentElement.style.fontSize = (13 * scale) / 100 + "px";
    document.documentElement.classList.toggle("ui-compact", !!a.compact);
    document.documentElement.setAttribute("data-lang", a.language || "en");
  }

  applyMasterVolume() {
    const v = Math.min(100, Math.max(0, Number(this.s.playback.masterVolume) ?? 80));
    const master = document.getElementById("masterVolume");
    const out = document.getElementById("masterVolumeOut");
    if (master && !master.dataset.touched) {
      master.value = String(v);
      if (out) out.textContent = v + "%";
    }
  }

  projectDefaults() {
    const p = this.s.projectDefaults || {};
    return {
      width: Number(p.width) || 1920,
      height: Number(p.height) || 1080,
      fps: Number(p.fps) || 30,
      aspect: p.aspect || "16:9",
      colorSpace: p.colorSpace || "rec709",
    };
  }

  silenceConfig() {
    return {
      threshold: Number(this.s.ai?.silenceThreshold) || 0.18,
      minPad: Number(this.s.ai?.silenceMinPad) || 0.15,
      minDur: Number(this.s.ai?.silenceMinDur) || 0.5,
    };
  }

  beatConfig() {
    const b = this.s.beat || {};
    return {
      bpm: Number(b.bpm) || 120,
      strength: Number(b.strength ?? 0.6),
      autoMontage: !!b.autoMontage,
      highlightFreq: Math.max(1, Number(b.highlightFreq) || 4),
      highlightOffset: Math.max(0, Number(b.highlightOffset) || 0),
      showAllBeats: !!b.showAllBeats,
    };
  }

  audioConfig() {
    const a = this.s.audio || {};
    return {
      denoiseStrength: a.denoiseStrength || "medium",
      humRemoval: !!a.humRemoval,
      windRemoval: !!a.windRemoval,
      eqPreset: a.eqPreset || "flat",
      pitchSemitones: Number(a.pitchSemitones) || 0,
      audioTransition: a.audioTransition || "audio/blender/transition-xe-constant-power",
    };
  }

  colorConfig() {
    const c = this.s.color || {};
    return {
      lutIntensity: Math.min(100, Math.max(0, Number(c.lutIntensity ?? 80))),
      autoEnhanceIntensity: Math.min(100, Math.max(0, Number(c.autoEnhanceIntensity ?? 60))),
      colorMatchStrength: Math.min(100, Math.max(0, Number(c.colorMatchStrength ?? 80))),
      sharpnessDefault: Number(c.sharpnessDefault ?? 0),
    };
  }

  foldersConfig() {
    return { ...(this.s.folders || {}) };
  }

  /** 2.2.0 save-location prefs (always merged over defaults). */
  saveConfig() {
    const d = {
      defaultProjectDir: "",
      defaultVideoDir: "",
      askProjectLocation: true,
      askVideoLocation: true,
    };
    return { ...d, ...(this.s.save || {}) };
  }

  sceneConfig() {
    return { threshold: Number(this.s.ai?.sceneThreshold) || 0.28 };
  }

  duckConfig() {
    const a = this.s.audio || {};
    return {
      enabled: !!a.ducking,
      db: Number(a.duckingDb ?? -12),
      fade: Number(a.duckingFade ?? 0.4),
    };
  }

  getShortcut(actionId, fallback) {
    const custom = this.s.shortcuts?.[actionId];
    return custom || fallback;
  }

  setShortcut(actionId, combo) {
    this.set({ shortcuts: { ...(this.s.shortcuts || {}), [actionId]: combo } });
  }

  resetShortcuts() {
    this.set({ shortcuts: {} });
  }

  /** Disk-ish cache meter (localStorage-backed media + project). */
  estimateCacheMb() {
    try {
      let bytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        bytes += (k.length + (localStorage.getItem(k)?.length || 0)) * 2;
      }
      return Math.round(bytes / (1024 * 1024));
    } catch {
      return 0;
    }
  }

  clearCache() {
    try {
      const keep = new Set([SETTINGS_KEY, "aifimora.project.v1", "aifimora.backup.v1", "aifimora.ai.v1"]);
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("aifimora.") && !keep.has(k)) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
      return keys.length;
    } catch {
      return 0;
    }
  }

  clearLuts() {
    this.set({ luts: [] });
  }

  resetToDefaults() {
    this.s = deepMerge(DEFAULTS, {});
    this.save();
    this.emit();
    this.applyTheme();
    this.applyMasterVolume();
  }
}

export const settings = new Settings();

/* --- .cube 3D LUT parsing (Filmora-style import) --- */
export function parseCube(text) {
  let size = 0;
  const data = [];
  const lower = text.toLowerCase();
  const m = lower.match(/^\s*size\s+(\d+)/m);
  if (m) size = parseInt(m[1], 10);
  // tolerate leading comments and whitespace
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#") || t.startsWith("title") || t.startsWith("domain")) continue;
    const parts = t.split(/\s+/);
    if (parts.length < 3) continue;
    const r = parseFloat(parts[0]);
    const g = parseFloat(parts[1]);
    const b = parseFloat(parts[2]);
    if ([r, g, b].some((n) => Number.isNaN(n))) continue;
    data.push(r * 255, g * 255, b * 255);
  }
  if (!size) size = Math.round(Math.cbrt(data.length / 3));
  if (!size || size * size * size * 3 !== data.length) {
    // truncate/pad to a perfect cube
    const need = size * size * size * 3;
    while (data.length < need) data.push(0, 0, 0);
    data.length = need;
  }
  return { size, data };
}

/** Trilinear 3D-LUT lookup on a flat RGBA Uint8ClampedArray (in place). */
export function applyLutToPixels(pixels, lut) {
  if (!lut || !lut.data || !lut.size) return;
  const size = lut.size;
  const max = size - 1;
  const data = lut.data;
  const inv = 1 / 255;
  const px = pixels.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const r = px[i] * inv;
    const g = px[i + 1] * inv;
    const b = px[i + 2] * inv;
    const ri = r * max, gi = g * max, bi = b * max;
    const r0 = ri | 0, g0 = gi | 0, b0 = bi | 0;
    const r1 = Math.min(max, r0 + 1), g1 = Math.min(max, g0 + 1), b1 = Math.min(max, b0 + 1);
    const fr = ri - r0, fg = gi - g0, fb = bi - b0;
    const idx = (x, y, z) => (z * size * size + y * size + x) * 3;
    const lerp = (a, b, t) => a + (b - a) * t;
    const c00 = idx(r0, g0, b0), c10 = idx(r1, g0, b0), c01 = idx(r0, g1, b0), c11 = idx(r1, g1, b0);
    const c02 = idx(r0, g0, b1), c12 = idx(r1, g0, b1), c03 = idx(r0, g1, b1), c13 = idx(r1, g1, b1);
    // Per-channel trilinear interpolation (data cell starts at *3 index; base = 0/1/2 picks channel)
    const ch = (base) => {
      const rA = lerp(data[base + c00], data[base + c10], fr);
      const rB = lerp(data[base + c01], data[base + c11], fr);
      const rC = lerp(data[base + c02], data[base + c12], fr);
      const rD = lerp(data[base + c03], data[base + c13], fr);
      const gA = lerp(rA, rB, fg), gB = lerp(rC, rD, fg);
      return lerp(gA, gB, fb);
    };
    px[i] = ch(0);
    px[i + 1] = ch(1);
    px[i + 2] = ch(2);
  }
}
