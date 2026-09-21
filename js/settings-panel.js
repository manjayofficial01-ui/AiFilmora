/* Preferences modal — Filmora-class settings dialog.
 * General / Editing / Performance / Playback / Audio / AI / Captions /
 * Scopes / Beat / LUTs / Export / Project / Storage / Backup / Appearance /
 * Keyboard. Persists via the settings store. */

import { store } from "./state.js";
import { settings, parseCube, ASPECT_PRESETS } from "./settings.js";
import { SHORTCUT_ACTIONS, formatCombo, parseCombo } from "./shortcuts.js";

function $(sel) {
  return document.querySelector(sel);
}
function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (v != null) n.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    if (typeof c === "string" || typeof c === "number") n.appendChild(document.createTextNode(String(c)));
    else n.appendChild(c);
  });
  return n;
}
function toast(msg, kind) {
  window.dispatchEvent(new CustomEvent("aifimora:toast", { detail: { msg, kind } }));
}

/* ---- field builders ---- */
function field(labelTxt, control, hint) {
  return el("div", { class: "field" }, [
    el("label", {}, labelTxt),
    control,
    hint ? el("div", { class: "hint" }, hint) : null,
  ]);
}
function select(options, value, onChange) {
  const s = el("select");
  options.forEach((o) => {
    const opt = el("option", { value: o.value }, o.label);
    if (String(o.value) === String(value)) opt.selected = true;
    s.appendChild(opt);
  });
  s.addEventListener("change", () => onChange(s.value));
  return s;
}
function num(value, onChange, attrs = {}) {
  const i = el("input", { type: "number", value: String(value), ...attrs });
  i.addEventListener("change", () => onChange(parseFloat(i.value)));
  return i;
}
function checkbox(checked, onChange) {
  const i = el("input", { type: "checkbox" });
  i.checked = !!checked;
  i.addEventListener("change", () => onChange(i.checked));
  return i;
}
function slider(value, min, max, step, fmt, onChange) {
  const out = el("output", { style: "min-width:46px;text-align:right" }, fmt(value));
  const i = el("input", { type: "range", min, max, step, value: String(value) });
  i.addEventListener("input", () => {
    const v = parseFloat(i.value);
    out.textContent = fmt(v);
    onChange(v);
  });
  return el("div", { class: "slider-row" }, [i, out]);
}
function color(value, onChange) {
  const i = el("input", { type: "color", value });
  i.addEventListener("input", () => onChange(i.value));
  return i;
}
function row(...children) {
  return el("div", { class: "row", style: "display:flex;gap:8px;align-items:center;flex-wrap:wrap" }, children);
}

const SECTIONS = [
  { id: "general", label: "General" },
  { id: "folders", label: "Folders" },
  { id: "editing", label: "Editing" },
  { id: "performance", label: "Performance" },
  { id: "playback", label: "Playback" },
  { id: "audio", label: "Audio" },
  { id: "ai", label: "AI" },
  { id: "tools", label: "Creative Tools" },
  { id: "captions", label: "Captions" },
  { id: "scopes", label: "Scopes" },
  { id: "beat", label: "Beat Sync" },
  { id: "color", label: "Color" },
  { id: "luts", label: "LUTs" },
  { id: "export", label: "Export" },
  { id: "project", label: "Project" },
  { id: "storage", label: "Storage" },
  { id: "backup", label: "Backup" },
  { id: "appearance", label: "Appearance" },
  { id: "keyboard", label: "Keyboard" },
];

export function initSettingsPanel() {
  const modal = $("#settingsModal");
  const body = $("#settingsModalBody");
  const openBtn = $("#menuPreferences");
  if (!modal || !body || !openBtn) return;

  let active = "general";

  function buildPane(id) {
    const s = settings.get();
    const p = el("div", { class: "settings-pane", "data-pane": id });

    if (id === "general") {
      // Filmora-derived theme presets (from assets/Skin/filmora_{dark,light}.txt)
      const filmoraThemes = window.__aifimoraThemePresets?.() || [];
      const themePresets = [
        { id: "dark", label: "Dark (default)", desc: "Filmora-inspired cyan accent on near-black panels.", swatches: ["#0b0d10", "#14181c", "#55e5c5", "#45f3bf"] },
        ...filmoraThemes,
      ];
      p.appendChild(field("Theme", el("div", { class: "theme-preset-grid" }, themePresets.map((t) => {
        const sw = el("div", { class: "theme-preset-swatches" }, t.swatches.map((c) => el("span", { style: `background:${c}` })));
        return el("button", {
          type: "button",
          class: "theme-preset" + (s.theme === t.id ? " active" : ""),
          onclick: () => {
            if (t.id === "dark" || t.id === "light") {
              settings.set({ theme: t.id, interfaceMode: t.id });
              settings.applyTheme();
            } else {
              // Filmora-derived: apply token preset + remember key
              settings.set({ theme: t.id });
              window.__aifimoraApplyThemePreset?.(t.id);
              settings.applyTheme();
            }
            buildPane(id); // rebuild to update active highlight
            const lbl = document.getElementById("fmThemeLabel");
            if (lbl) lbl.textContent = t.id;
          }
        }, [sw, el("div", { class: "theme-preset-name" }, t.label), el("div", { class: "theme-preset-desc" }, t.desc || "")]);
      })), "Filmora General → Appearance. Filmora Dark/Light palettes extracted from assets/Skin/filmora_*.txt."));
      p.appendChild(field("Interface mode", select(
        [{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }, { value: "system", label: "System default" }],
        s.interfaceMode || s.theme || "dark",
        (v) => { settings.set({ interfaceMode: v, theme: v === "system" ? "dark" : v }); settings.applyTheme(); }
      )));
      p.appendChild(field("Check for updates", select(
        [{ value: "never", label: "Never" }, { value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }],
        s.checkUpdates || "weekly",
        (v) => settings.set({ checkUpdates: v })
      )));
      p.appendChild(field("Show project library at startup", checkbox(s.showLibraryAtStartup !== false, (v) => settings.set({ showLibraryAtStartup: v })), "Filmora startup window with recent projects."));
      p.appendChild(field("Show project information panel", checkbox(s.showProjectInfo !== false, (v) => settings.set({ showProjectInfo: v })), "Filmora-style Project card at the top of the inspector."));
      p.appendChild(field("Message center announcements", checkbox(s.messageCenter !== false, (v) => settings.set({ messageCenter: v }))));
      p.appendChild(field("Default output folder", el("input", { type: "text", value: s.outputFolder || "", placeholder: "e.g. D:\\Videos\\AiFilmora", oninput: (e) => settings.set({ outputFolder: e.target.value }) }), "Filmora General → output / browsing folder."));
      p.appendChild(field("Autosave interval (sec)", num(s.autosaveSec, (v) => settings.set({ autosaveSec: v }), { min: 0, max: 600 })));
      p.appendChild(field("Language", select(
        [{ value: "en", label: "English" }, { value: "zh", label: "中文" }],
        s.appearance?.language || "en",
        (v) => { settings.set({ appearance: { language: v } }); settings.applyAppearance(); }
      ), "UI labels stay English this build; language is stored for future locales."));
    }

    if (id === "folders") {
      const f = s.folders || {};
      const pathField = (label, key, hint) => {
        const inp = el("input", { type: "text", value: f[key] || "", placeholder: "Default location" });
        inp.addEventListener("input", () => settings.set({ folders: { [key]: inp.value } }));
        p.appendChild(field(label, inp, hint));
      };
      p.appendChild(el("div", { class: "hint" }, "Filmora Folders tab — where snapshots, temp files, recordings and projects live. Empty = app default."));
      pathField("Snapshot folder", "snapshot", "Camera snapshots under the preview.");
      pathField("Temp / cache folder", "temp", "Preview renders + conform files.");
      pathField("Recorded files folder", "recorded", "Screen / webcam recordings.");
      pathField("Default project location", "projectLocation", "New .aifimora projects.");
      pathField("Backup location (label)", "backupLocation", "Label only in this web build; files stay in localStorage.");

      // 2.2.0 — Ask-location + Default Save Location (project & video).
      p.appendChild(el("div", { class: "section-title" }, "Save locations (2.2.0)"));
      p.appendChild(el("div", { class: "hint" }, "Chosen in the Save / Export dialogs via “Use this folder as the default save location”. Untick “Always ask” to reuse the default silently."));
      const sv = (settings.saveConfig ? settings.saveConfig() : settings.get().save) || {};
      const saveField = (label, key, hint) => {
        const inp = el("input", { type: "text", value: sv[key] || "", placeholder: "Default folder (empty = ask every time)" });
        inp.addEventListener("input", () => settings.set({ save: { [key]: inp.value } }));
        p.appendChild(field(label, inp, hint));
      };
      saveField("Default project save folder", "defaultProjectDir", "Save / Save as… targets this folder when “Always ask” is off.");
      saveField("Default video save folder", "defaultVideoDir", "Export targets this folder when “Always ask” is off.");
      p.appendChild(field("Always ask where to save projects", checkbox(sv.askProjectLocation !== false, (v) => settings.set({ save: { askProjectLocation: v } })), "Off = save silently to the default project folder."));
      p.appendChild(field("Always ask where to save videos", checkbox(sv.askVideoLocation !== false, (v) => settings.set({ save: { askVideoLocation: v } })), "Off = export silently to the default video folder."));
    }

    if (id === "editing") {
      const e = s.editing;
      p.appendChild(field("Default transition", select(
        [
          { value: "dissolve", label: "Cross Dissolve" },
          { value: "fade", label: "Fade" },
          { value: "wipe", label: "Wipe" },
          { value: "slide", label: "Slide" },
        ],
        e.defaultTransition,
        (v) => settings.set({ editing: { defaultTransition: v } })
      )));
      p.appendChild(field("Default transition length (s)", num(e.defaultTransitionDur, (v) => settings.set({ editing: { defaultTransitionDur: v } }), { min: 0.1, max: 5, step: 0.1 }), "Filmora default is 2s."));
      p.appendChild(field("Default photo length (s)", num(e.defaultPhotoLen, (v) => settings.set({ editing: { defaultPhotoLen: v } }), { min: 1, max: 60 }), "Filmora default is 5s."));
      p.appendChild(field("Default effect duration (s)", num(e.defaultEffectDur ?? 5, (v) => settings.set({ editing: { defaultEffectDur: v } }), { min: 1, max: 60 }), "Filmora Editing → effect duration."));
      p.appendChild(field("Split-screen duration (s)", num(e.splitScreenDur ?? 5, (v) => settings.set({ editing: { splitScreenDur: v } }), { min: 1, max: 60 })));
      p.appendChild(field("Default title length (s)", num(e.defaultTitleLen, (v) => settings.set({ editing: { defaultTitleLen: v } }), { min: 1, max: 60 })));
      p.appendChild(field("Freeze-frame hold (s)", num(e.stillHold ?? 2, (v) => settings.set({ editing: { stillHold: v } }), { min: 0.25, max: 30, step: 0.25 }), "Filmora default is 5s."));
      p.appendChild(field("Photo placement", select(
        [{ value: "fit", label: "Fit (letterbox)" }, { value: "crop", label: "Crop to Fit" }, { value: "panzoom", label: "Pan & Zoom" }],
        e.photoPlacement || "fit",
        (v) => settings.set({ editing: { photoPlacement: v } })
      ), "Filmora Photo Placement for stills."));
      p.appendChild(field("Insert mode (drag to occupied track)", select(
        [{ value: "insert", label: "Insert — split & ripple" }, { value: "overwrite", label: "Overwrite — replace" }],
        e.insertMode || "insert",
        (v) => settings.set({ editing: { insertMode: v } })
      )));
      p.appendChild(field("Timeline units", select(
        [{ value: "timecode", label: "Timecode HH:MM:SS:FF" }, { value: "seconds", label: "Seconds" }, { value: "frames", label: "Frames" }],
        e.timelineUnits || "timecode",
        (v) => settings.set({ editing: { timelineUnits: v } })
      )));
      p.appendChild(field("Ripple edits by default", checkbox(e.rippleDefault, (v) => settings.set({ editing: { rippleDefault: v } }))));
      p.appendChild(field("Snapping on by default", checkbox(e.snapDefault, (v) => settings.set({ editing: { snapDefault: v } }))));
      p.appendChild(field("Auto-apply transitions on import", checkbox(e.autoTransitions !== false, (v) => settings.set({ editing: { autoTransitions: v } }))));
      p.appendChild(field("Default image animation", select(
        [{ value: "none", label: "None" }, { value: "fade", label: "Fade" }, { value: "kenburns", label: "Ken Burns" }],
        e.imageAnim,
        (v) => settings.set({ editing: { imageAnim: v } })
      )));
      p.appendChild(field("Import still duration (s)", num(s.importDefaults?.stillDuration ?? 4, (v) => settings.set({ importDefaults: { stillDuration: v } }), { min: 1, max: 60 })));
      p.appendChild(field("Auto-add imports to timeline", checkbox(s.importDefaults?.autoAddToTimeline, (v) => settings.set({ importDefaults: { autoAddToTimeline: v } }))));
    }

    if (id === "performance") {
      const perf = s.performance;
      p.appendChild(field("GPU acceleration", checkbox(perf.gpuAccel, (v) => settings.set({ performance: { gpuAccel: v } })), "Uses Chromium compositing + canvas when available."));
      p.appendChild(field("Hardware acceleration — decoding", checkbox(perf.decodeAccel !== false, (v) => settings.set({ performance: { decodeAccel: v } })), "Filmora Performance → video decoding."));
      p.appendChild(field("Hardware acceleration — playback", checkbox(perf.playbackAccel !== false, (v) => settings.set({ performance: { playbackAccel: v } }))));
      p.appendChild(field("Hardware acceleration — rendering", checkbox(perf.renderAccel !== false, (v) => settings.set({ performance: { renderAccel: v } }))));
      p.appendChild(field("Hardware encode (NVENC/QSV/AMF)", checkbox(perf.hardwareEncode, (v) => {
        settings.set({ performance: { hardwareEncode: v }, exportDefaults: { hardware: v } });
      })));
      p.appendChild(field("Background render", checkbox(perf.backgroundRender, (v) => settings.set({ performance: { backgroundRender: v } })), "Filmora renders timeline in the background."));
      p.appendChild(field("Render preview files", checkbox(perf.previewRender !== false, (v) => settings.set({ performance: { previewRender: v } }))));
      p.appendChild(field("Smart render (skip unchanged frames)", checkbox(perf.smartRender, (v) => settings.set({ performance: { smartRender: v } }))));
      p.appendChild(field("Proxy workflow", checkbox(perf.proxyEnabled, (v) => settings.set({ performance: { proxyEnabled: v } })), "Filmora-style low-res proxies for heavy media."));
      p.appendChild(field("Proxy resolution", select(
        [
          { value: "360", label: "360p" },
          { value: "540", label: "540p" },
          { value: "720", label: "720p" },
        ],
        String(perf.proxyRes || 540),
        (v) => settings.set({ performance: { proxyRes: parseInt(v, 10) } })
      )));
      p.appendChild(field("Auto-create proxies on import", checkbox(perf.autoProxy, (v) => settings.set({ performance: { autoProxy: v } }))));
      p.appendChild(field("Timeline thumbnails", checkbox(perf.timelineThumbs !== false, (v) => settings.set({ performance: { timelineThumbs: v } }))));
      p.appendChild(field("Show audio waveforms", checkbox(perf.showWaveform !== false, (v) => {
        settings.set({ performance: { showWaveform: v } });
        window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
      })));
      p.appendChild(field("Hide dropped-frame warning", checkbox(perf.previewDropped, (v) => settings.set({ performance: { previewDropped: v } }))));
    }

    if (id === "playback") {
      const pb = s.playback;
      p.appendChild(field("Preview quality (device-pixel scale)", select(
        [{ value: "0.5", label: "0.5× (fast)" }, { value: "0.75", label: "0.75×" }, { value: "1", label: "1× (native)" }, { value: "1.5", label: "1.5×" }, { value: "2", label: "2× (sharp)" }],
        String(pb.previewQuality),
        (v) => settings.set({ playback: { previewQuality: parseFloat(v) } })
      ), "Higher is sharper but heavier."));
      p.appendChild(field("Playback resolution (Filmora preview)", select(
        [{ value: "full", label: "Full" }, { value: "half", label: "1/2" }, { value: "quarter", label: "1/4" }],
        pb.playbackQuality || "full",
        (v) => settings.set({ playback: { playbackQuality: v } })
      ), "Lower = smoother preview, export unaffected."));
      p.appendChild(field("Master volume", slider(pb.masterVolume, 0, 100, 1, (v) => v + "%", (v) => {
        settings.set({ playback: { masterVolume: v } });
        const mv = document.getElementById("masterVolume");
        if (mv) { mv.value = String(v); mv.dispatchEvent(new Event("input")); }
      })));
      p.appendChild(field("Loop timeline", checkbox(pb.loopTimeline, (v) => settings.set({ playback: { loopTimeline: v } }))));
      p.appendChild(field("Show title/action safe areas", checkbox(pb.showSafeAreas, (v) => settings.set({ playback: { showSafeAreas: v } }))));
      p.appendChild(field("Play from scrub position", checkbox(pb.playFromScrub, (v) => settings.set({ playback: { playFromScrub: v } }))));
    }

    if (id === "audio") {
      const a = s.audio;
      p.appendChild(field("Normalize target (LUFS)", num(a.normalizeTarget, (v) => settings.set({ audio: { normalizeTarget: v } }), { min: -30, max: 0, step: 1 })));
      p.appendChild(field("Sample rate", select(
        [{ value: "44100", label: "44.1 kHz" }, { value: "48000", label: "48 kHz" }, { value: "96000", label: "96 kHz" }],
        String(a.sampleRate),
        (v) => settings.set({ audio: { sampleRate: parseInt(v, 10) } })
      )));
      p.appendChild(field("Auto-duck music under dialogue", checkbox(a.ducking, (v) => settings.set({ audio: { ducking: v } }))));
      p.appendChild(field("Ducking amount (dB)", slider(a.duckingDb ?? -12, -24, -3, 1, (v) => v + " dB", (v) => settings.set({ audio: { duckingDb: v } }))));
      p.appendChild(field("Ducking fade (s)", num(a.duckingFade ?? 0.4, (v) => settings.set({ audio: { duckingFade: v } }), { min: 0, max: 2, step: 0.1 })));
      p.appendChild(field("Default audio fade (s)", num(a.defaultFade, (v) => settings.set({ audio: { defaultFade: v } }), { min: 0, max: 5, step: 0.1 })));
      p.appendChild(field("Noise gate on voice enhance", checkbox(a.noiseGate, (v) => settings.set({ audio: { noiseGate: v } }))));
      p.appendChild(el("div", { class: "section-title" }, "AI Audio suite (Filmora)"));
      p.appendChild(field("Denoise strength", select(
        [{ value: "off", label: "Off" }, { value: "weak", label: "Weak" }, { value: "medium", label: "Medium" }, { value: "strong", label: "Strong" }],
        a.denoiseStrength || "medium",
        (v) => settings.set({ audio: { denoiseStrength: v } })
      ), "Filmora AI Audio Denoise."));
      p.appendChild(field("Hum removal (50/60Hz)", checkbox(a.humRemoval, (v) => settings.set({ audio: { humRemoval: v } }))));
      p.appendChild(field("Wind removal", checkbox(a.windRemoval, (v) => settings.set({ audio: { windRemoval: v } }))));
      p.appendChild(field("Equalizer preset", select(
        [{ value: "flat", label: "Flat" }, { value: "voice", label: "Voice / Dialogue" }, { value: "music", label: "Music" }, { value: "bass", label: "Bass Boost" }, { value: "treble", label: "Treble Boost" }],
        a.eqPreset || "flat",
        (v) => settings.set({ audio: { eqPreset: v } })
      ), "Filmora Equalizer."));
      p.appendChild(field("Pitch shift (semitones)", slider(a.pitchSemitones || 0, -12, 12, 1, (v) => (v > 0 ? "+" : "") + v, (v) => settings.set({ audio: { pitchSemitones: v } })), "Stored per-project; preview pitch kept when speed ≠ 1×."));
      p.appendChild(field("Audio pipeline bit depth", select(
        [{ value: "16", label: "16-bit integer" }, { value: "24", label: "24-bit integer" }, { value: "32f", label: "32-bit float (Filmora 15)" }],
        a.bitDepth || "32f",
        (v) => settings.set({ audio: { bitDepth: v } })
      ), "Filmora 15 ships a 32-bit float audio pipeline for higher fidelity + dynamic range."));
    }

    if (id === "ai") {
      const ai = s.ai;
      p.appendChild(field("Credit cap", num(ai.creditCap, (v) => settings.set({ ai: { creditCap: v } }), { min: 0, max: 100000 }), "Caps simulated AI usage per project."));
      p.appendChild(field("Default GenAI model", select(
        [
          { value: "veo-3.1", label: "Veo 3.1" },
          { value: "runway-gen45", label: "Runway Gen-4.5" },
          { value: "kling-25", label: "Kling 2.5" },
          { value: "seedance-2", label: "Seedance 2.0" },
        ],
        ai.defaultModel || "veo-3.1",
        (v) => settings.set({ ai: { defaultModel: v } })
      )));
      p.appendChild(field("Burn-in watermark on export", checkbox(ai.watermark, (v) => settings.set({ ai: { watermark: v } }))));
      p.appendChild(field("Prefer offline / simulated models", checkbox(ai.offlineFirst, (v) => settings.set({ ai: { offlineFirst: v } }))));
      p.appendChild(field("Silence threshold", slider(ai.silenceThreshold ?? 0.18, 0.05, 0.5, 0.01, (v) => v.toFixed(2), (v) => settings.set({ ai: { silenceThreshold: v } })), "Lower cuts more aggressively."));
      p.appendChild(field("Silence padding (s)", num(ai.silenceMinPad ?? 0.15, (v) => settings.set({ ai: { silenceMinPad: v } }), { min: 0, max: 1, step: 0.05 })));
      p.appendChild(field("Min silence length (s)", num(ai.silenceMinDur ?? 0.5, (v) => settings.set({ ai: { silenceMinDur: v } }), { min: 0.1, max: 5, step: 0.1 }), "Filmora Silence Detection — ignore gaps shorter than this."));
      p.appendChild(field("Scene-cut sensitivity", slider(ai.sceneThreshold ?? 0.28, 0.05, 0.8, 0.01, (v) => v.toFixed(2), (v) => settings.set({ ai: { sceneThreshold: v } })), "Higher = fewer cuts."));
      p.appendChild(field("Auto captions on import", checkbox(ai.autoCaptionsOnImport, (v) => settings.set({ ai: { autoCaptionsOnImport: v } }))));
      p.appendChild(el("div", { class: "section-title" }, "Generation (Filmora 15)"));
      p.appendChild(field("AI Extend length (s)", slider(ai.extendSeconds ?? 3, 1, 5, 1, (v) => v + "s", (v) => settings.set({ ai: { extendSeconds: v } })), "Forward extension for AI Extend (Filmora allows up to 5s fwd / 8s back)."));
      p.appendChild(field("Video Enhancer intensity", slider(ai.enhancerIntensity ?? 60, 0, 100, 1, (v) => v + "%", (v) => settings.set({ ai: { enhancerIntensity: v } }))));
      p.appendChild(field("Face Mosaic size", slider(ai.faceMosaicSize ?? 24, 8, 64, 1, (v) => v + "px", (v) => settings.set({ ai: { faceMosaicSize: v } }))));
      p.appendChild(field("Music mood", select(
        [{ value: "cinematic", label: "Cinematic" }, { value: "upbeat", label: "Upbeat" }, { value: "lofi", label: "Lo-Fi" }, { value: "tension", label: "Tension" }, { value: "corporate", label: "Corporate" }],
        ai.musicMood || "cinematic",
        (v) => settings.set({ ai: { musicMood: v } })
      ), "Filmora AI Music Generator."));
      p.appendChild(field("Music tempo", select(
        [{ value: "70bpm", label: "70 BPM · Slow" }, { value: "90bpm", label: "90 BPM" }, { value: "120bpm", label: "120 BPM" }, { value: "140bpm", label: "140 BPM · Fast" }],
        ai.musicTempo || "90bpm",
        (v) => settings.set({ ai: { musicTempo: v } })
      )));
      p.appendChild(field("Music duration (s)", num(ai.musicDuration ?? 15, (v) => settings.set({ ai: { musicDuration: v } }), { min: 5, max: 120 })));
      p.appendChild(field("TTS voice", select(
        [{ value: "aria", label: "Aria (female)" }, { value: "guy", label: "Guy (male)" }, { value: "jenny", label: "Jenny (female)" }, { value: "davis", label: "Davis (narrator)" }],
        ai.ttsVoice || "aria",
        (v) => settings.set({ ai: { ttsVoice: v } })
      ), "Filmora Text-to-Speech."));
      p.appendChild(field("TTS rate", slider(ai.ttsRate ?? 1, 0.5, 2, 0.05, (v) => v.toFixed(2) + "×", (v) => settings.set({ ai: { ttsRate: v } }))));
      p.appendChild(el("div", { class: "section-title" }, "AI Voice Cloning + SFX (Filmora 15)"));
      p.appendChild(field("Voice clone languages", num(ai.voiceCloneLangs ?? 16, (v) => settings.set({ ai: { voiceCloneLangs: v } }), { min: 1, max: 64 }), "Cloned voices dub across this many languages."));
      p.appendChild(field("AI SFX duration (s)", num(ai.sfxDuration ?? 2, (v) => settings.set({ ai: { sfxDuration: v } }), { min: 0.5, max: 10, step: 0.5 }), "Default length for AI Sound Effect Generator results."));
    }

    if (id === "tools") {
      const ed = s.editing || {};
      p.appendChild(el("div", { class: "section-title" }, "Pen Tool (Filmora 15)"));
      p.appendChild(field("Default stroke width", num(ed.penStrokeW ?? 6, (v) => settings.set({ editing: { penStrokeW: v } }), { min: 1, max: 24 })));
      p.appendChild(field("Fill closed paths", checkbox(ed.penFillClose !== false, (v) => settings.set({ editing: { penFillClose: v } }))));
      p.appendChild(field("Trim-path animation", checkbox(ed.penTrimPath !== false, (v) => settings.set({ editing: { penTrimPath: v } })), "Stroke reveals over the clip duration (Filmora hand-drawn motion)."));
      p.appendChild(el("div", { class: "section-title" }, "Animated Charts / Visualizer"));
      p.appendChild(field("Default chart type", select(
        [{ value: "bar", label: "Bar" }, { value: "line", label: "Line" }, { value: "pie", label: "Pie / Donut" }],
        ed.chartType || "bar",
        (v) => settings.set({ editing: { chartType: v } })
      )));
      p.appendChild(field("Chart / overlay duration (s)", num(ed.chartDuration ?? 5, (v) => settings.set({ editing: { chartDuration: v } }), { min: 1, max: 30 })));
      p.appendChild(field("Visualizer style", select(
        [{ value: "bars", label: "Bars" }, { value: "wave", label: "Wave" }, { value: "circle", label: "Circle" }],
        ed.visualizerStyle || "bars",
        (v) => settings.set({ editing: { visualizerStyle: v } })
      )));
      p.appendChild(el("div", { class: "section-title" }, "Video FX + Chapters"));
      p.appendChild(field("Motion Blur strength (when toggled)", slider(ed.motionBlurDefault ?? 45, 0, 100, 5, (v) => v + "%", (v) => settings.set({ editing: { motionBlurDefault: v } }))));
      p.appendChild(field("Flicker Removal strength (when toggled)", slider(ed.deflickerDefault ?? 60, 0, 100, 5, (v) => v + "%", (v) => settings.set({ editing: { deflickerDefault: v } }))));
      p.appendChild(field("Chapter progress bar in preview", checkbox(ed.chaptersBar !== false, (v) => settings.set({ editing: { chaptersBar: v } })), "Filmora 15 Video Chapters overlay in the program monitor."));
    }

    if (id === "captions") {
      const c = s.caption;
      p.appendChild(field("Language", select(
        [
          { value: "en", label: "English" },
          { value: "es", label: "Español" },
          { value: "zh", label: "中文" },
          { value: "hi", label: "हिन्दी" },
          { value: "ja", label: "日本語" },
        ],
        c.lang || "en",
        (v) => settings.set({ caption: { lang: v } })
      )));
      p.appendChild(field("Dynamic template", select(
        [{ value: "basic", label: "Basic" }, { value: "pop", label: "Pop (Shorts/TikTok)" }, { value: "karaoke", label: "Karaoke highlight" }, { value: "outline", label: "Outline" }],
        c.template || "basic",
        (v) => settings.set({ caption: { template: v } })
      ), "Filmora Dynamic Captions for vertical video."));
      p.appendChild(field("Bilingual captions", checkbox(c.bilingual, (v) => settings.set({ caption: { bilingual: v } })), "Show second-language line (translation placeholder)."));
      p.appendChild(field("Second language", select(
        [{ value: "es", label: "Español" }, { value: "en", label: "English" }, { value: "zh", label: "中文" }, { value: "hi", label: "हिन्दी" }],
        c.secondLang || "es",
        (v) => settings.set({ caption: { secondLang: v } })
      )));
      p.appendChild(field("Font size (px)", num(c.fontSize, (v) => settings.set({ caption: { fontSize: v } }), { min: 10, max: 80 })));
      p.appendChild(field("Text color", color(c.color, (v) => settings.set({ caption: { color: v } }))));
      p.appendChild(field("Background", color(c.bg, (v) => settings.set({ caption: { bg: v } }))));
      p.appendChild(field("Position", select(
        [{ value: "top", label: "Top" }, { value: "lower", label: "Lower third" }, { value: "bottom", label: "Bottom" }],
        c.position,
        (v) => settings.set({ caption: { position: v } })
      )));
      p.appendChild(field("Bold", checkbox(c.bold, (v) => settings.set({ caption: { bold: v } }))));
      p.appendChild(field("Outline", checkbox(c.outline, (v) => settings.set({ caption: { outline: v } }))));
      p.appendChild(field("Highlight active word", checkbox(c.highlightWord, (v) => settings.set({ caption: { highlightWord: v } }))));
      p.appendChild(field("Font", el("input", { type: "text", value: c.font, oninput: (e) => settings.set({ caption: { font: e.target.value } }) })));
    }

    if (id === "scopes") {
      const sc = s.scopes;
      p.appendChild(field("Default scope", select(
        [{ value: "waveform", label: "Waveform" }, { value: "parade", label: "RGB Parade" }, { value: "vectorscope", label: "Vectorscope" }, { value: "histogram", label: "Histogram" }],
        sc.mode,
        (v) => { settings.set({ scopes: { mode: v } }); const sm = $("#scopeMode"); if (sm) sm.value = v; }
      )));
      p.appendChild(field("Color space", select(
        [{ value: "rec709", label: "Rec. 709" }, { value: "rec2020", label: "Rec. 2020" }],
        sc.parity,
        (v) => { settings.set({ scopes: { parity: v } }); const sp = $("#scopeParity"); if (sp) sp.value = v; }
      )));
    }

    if (id === "beat") {
      const b = s.beat;
      p.appendChild(field("BPM (when no audio analysis)", num(b.bpm, (v) => settings.set({ beat: { bpm: v } }), { min: 40, max: 240 }), "Used to simulate beat markers on generated/imported clips."));
      p.appendChild(field("Detection strength", slider(b.strength, 0, 1, 0.05, (v) => v.toFixed(2), (v) => settings.set({ beat: { strength: v } }))));
      p.appendChild(field("Auto-montage to beats", checkbox(b.autoMontage, (v) => settings.set({ beat: { autoMontage: v } }))));
      p.appendChild(el("div", { class: "section-title" }, "Beat Options (Filmora)"));
      p.appendChild(field("Highlight every N beats", num(b.highlightFreq ?? 4, (v) => settings.set({ beat: { highlightFreq: v } }), { min: 1, max: 16 }), "Filmora Beat Options → highlight beat frequency."));
      p.appendChild(field("Highlight offset (beats)", num(b.highlightOffset ?? 0, (v) => settings.set({ beat: { highlightOffset: v } }), { min: 0, max: 16 })));
      p.appendChild(field("Show all beat markers", checkbox(b.showAllBeats, (v) => settings.set({ beat: { showAllBeats: v } })), "Off = highlights only."));
    }

    if (id === "color") {
      const col = s.color || {};
      p.appendChild(el("div", { class: "hint" }, "Filmora Color depth — global strengths applied by Auto Enhance / Color Match / LUT."));
      p.appendChild(field("LUT intensity (%)", slider(col.lutIntensity ?? 80, 0, 100, 1, (v) => v + "%", (v) => settings.set({ color: { lutIntensity: v } }))));
      p.appendChild(field("Auto-enhance intensity (%)", slider(col.autoEnhanceIntensity ?? 60, 0, 100, 1, (v) => v + "%", (v) => settings.set({ color: { autoEnhanceIntensity: v } }))));
      p.appendChild(field("Color-match strength (%)", slider(col.colorMatchStrength ?? 80, 0, 100, 1, (v) => v + "%", (v) => settings.set({ color: { colorMatchStrength: v } }))));
      p.appendChild(field("Default sharpness", slider(col.sharpnessDefault ?? 0, 0, 100, 1, (v) => v + "%", (v) => settings.set({ color: { sharpnessDefault: v } }))));
    }

    if (id === "luts") {
      const file = el("input", { type: "file", accept: ".cube,text/plain" });
      file.addEventListener("change", () => importCube(file.files[0]));
      p.appendChild(field("Import 3D LUT (.cube)", file, "Filmora-style .cube files are parsed and available as a Color/FX LUT."));
      p.appendChild(row(
        el("button", {
          class: "btn sm danger",
          onclick: () => {
            if (confirm("Remove all imported LUTs?")) {
              settings.clearLuts();
              const list = $("#lutList");
              if (list) renderLutList(list);
              toast("LUT library cleared");
            }
          },
        }, "Clear all LUTs")
      ));
      const list = el("div", { id: "lutList" });
      renderLutList(list);
      p.appendChild(list);
    }

    if (id === "export") {
      const ex = s.exportDefaults;
      p.appendChild(field("Container", select(
        [
          { value: "mp4", label: "MP4" },
          { value: "mov", label: "MOV" },
          { value: "webm", label: "WebM" },
          { value: "gif", label: "GIF" },
        ],
        ex.container,
        (v) => settings.set({ exportDefaults: { container: v } })
      )));
      p.appendChild(field("Video codec", select(
        [
          { value: "h264", label: "H.264 / AVC" },
          { value: "h265", label: "H.265 / HEVC" },
          { value: "av1", label: "AV1" },
          { value: "prores", label: "ProRes (proxy)" },
        ],
        ex.codec,
        (v) => settings.set({ exportDefaults: { codec: v } })
      )));
      p.appendChild(field("Quality", select(
        [
          { value: "low", label: "Low · smaller file" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High · recommended" },
          { value: "custom", label: "Custom bitrate" },
        ],
        ex.quality,
        (v) => settings.set({ exportDefaults: { quality: v } })
      )));
      p.appendChild(field("Bitrate (Mbps)", num(ex.bitrate, (v) => settings.set({ exportDefaults: { bitrate: v } }), { min: 1, max: 200 }), "Used when Quality = Custom."));
      p.appendChild(field("Frame rate", select(
        [
          { value: "24", label: "24 fps" },
          { value: "30", label: "30 fps" },
          { value: "60", label: "60 fps" },
        ],
        String(ex.fps || 30),
        (v) => settings.set({ exportDefaults: { fps: parseInt(v, 10) } })
      )));
      p.appendChild(field("Hardware encode", checkbox(ex.hardware, (v) => settings.set({ exportDefaults: { hardware: v } }))));
      p.appendChild(field("Audio codec", select(
        [
          { value: "aac", label: "AAC" },
          { value: "opus", label: "Opus" },
          { value: "pcm", label: "PCM" },
        ],
        ex.audioCodec,
        (v) => settings.set({ exportDefaults: { audioCodec: v } })
      )));
      p.appendChild(field("Audio bitrate (kbps)", select(
        [
          { value: "128", label: "128" },
          { value: "192", label: "192" },
          { value: "256", label: "256" },
          { value: "320", label: "320" },
        ],
        String(ex.audioBitrate || 192),
        (v) => settings.set({ exportDefaults: { audioBitrate: parseInt(v, 10) } })
      )));
      p.appendChild(field("Preferred social preset", select(
        [
          { value: "yt1080", label: "YouTube 1080p" },
          { value: "yt4k", label: "YouTube 4K" },
          { value: "tiktok", label: "TikTok / Reels 9:16" },
          { value: "shorts", label: "YouTube Shorts" },
          { value: "prores", label: "ProRes Proxy" },
          { value: "gif", label: "Animated GIF" },
        ],
        ex.preset || "yt1080",
        (v) => settings.set({ exportDefaults: { preset: v } })
      )));
      p.appendChild(field("Burn in captions", checkbox(ex.burnInCaptions !== false, (v) => settings.set({ exportDefaults: { burnInCaptions: v } })), "Filmora export burns the caption track into the video."));
      p.appendChild(field("Direct social upload", select(
        [{ value: "none", label: "None (file only)" }, { value: "youtube", label: "YouTube" }, { value: "tiktok", label: "TikTok" }, { value: "vimeo", label: "Vimeo" }],
        ex.socialUpload || "none",
        (v) => settings.set({ exportDefaults: { socialUpload: v } })
      ), "Label only in this build; mirrors Filmora share targets."));
    }

    if (id === "project") {
      const pd = s.projectDefaults;
      p.appendChild(field("Aspect / resolution preset", select(
        ASPECT_PRESETS.map((a) => ({ value: a.id, label: `${a.label} · ${a.w}×${a.h}` })),
        pd.aspect || "16:9",
        (v) => {
          const a = ASPECT_PRESETS.find((x) => x.id === v) || ASPECT_PRESETS[0];
          settings.set({ projectDefaults: { aspect: a.id, width: a.w, height: a.h } });
          renderBody();
        }
      ), "Applied when you create a New Project."));
      p.appendChild(field("Width", num(pd.width, (v) => settings.set({ projectDefaults: { width: v } }), { min: 16, max: 7680 })));
      p.appendChild(field("Height", num(pd.height, (v) => settings.set({ projectDefaults: { height: v } }), { min: 16, max: 4320 })));
      p.appendChild(field("Frame rate", select(
        [{ value: "24", label: "24 fps" }, { value: "25", label: "25 fps" }, { value: "30", label: "30 fps" }, { value: "60", label: "60 fps" }],
        String(pd.fps || 30),
        (v) => settings.set({ projectDefaults: { fps: parseInt(v, 10) } })
      )));
      p.appendChild(field("Color space", select(
        [{ value: "rec709", label: "Rec. 709" }, { value: "rec2020", label: "Rec. 2020" }],
        pd.colorSpace || "rec709",
        (v) => settings.set({ projectDefaults: { colorSpace: v } })
      )));

      p.appendChild(el("div", { class: "section-title" }, "Current project"));
      const cur = store.get();
      p.appendChild(el("div", { class: "hint" }, `${cur.name} · ${cur.width}×${cur.height} · ${cur.fps} fps`));
      p.appendChild(row(
        el("button", {
          class: "btn sm primary",
          onclick: exportProject,
        }, "Export project (.json)"),
        el("button", {
          class: "btn sm",
          onclick: () => $("#projectImport")?.click(),
        }, "Import project")
      ));
      const fileIn = el("input", { type: "file", accept: ".json,application/json", id: "projectImport", style: "display:none" });
      fileIn.addEventListener("change", () => importProjectFile(fileIn.files[0]));
      p.appendChild(fileIn);
    }

    if (id === "storage") {
      const st = s.storage;
      const used = settings.estimateCacheMb();
      p.appendChild(el("div", { class: "hint" }, `Local cache estimate: ${used} MB`));
      p.appendChild(field("Max cache (MB)", num(st.maxCacheMb, (v) => settings.set({ storage: { maxCacheMb: v } }), { min: 100, max: 65536 })));
      p.appendChild(field("Auto-clear cache older than (days)", num(st.autoClearDays, (v) => settings.set({ storage: { autoClearDays: v } }), { min: 0, max: 365 })));
      p.appendChild(row(
        el("button", {
          class: "btn sm danger",
          onclick: () => {
            const n = settings.clearCache();
            toast(`Cleared ${n} cache item(s)`, "ok");
            renderBody();
          },
        }, "Clear AiFimora cache")
      ));
      p.appendChild(el("div", { class: "hint" }, "Clears non-project AiFimora keys. Project + preferences + LUTs stay."));
    }

    if (id === "backup") {
      const b = s.backup;
      p.appendChild(field("Enable autosave backup", checkbox(b.enabled !== false, (v) => settings.set({ backup: { enabled: v } }))));
      p.appendChild(field("Keep versions", num(b.keepVersions ?? 8, (v) => settings.set({ backup: { keepVersions: v } }), { min: 1, max: 50 })));
      p.appendChild(field("Offer recovery after crash / reload", checkbox(b.recoverPrompt !== false, (v) => settings.set({ backup: { recoverPrompt: v } }))));
      p.appendChild(row(
        el("button", {
          class: "btn sm",
          onclick: () => {
            window.dispatchEvent(new CustomEvent("aifimora:backup-now"));
            toast("Backup snapshot written", "ok");
          },
        }, "Snapshot now"),
        el("button", {
          class: "btn sm",
          onclick: () => {
            window.dispatchEvent(new CustomEvent("aifimora:backup-restore"));
          },
        }, "Restore last snapshot")
      ));
    }

    if (id === "appearance") {
      const a = s.appearance;
      p.appendChild(field("UI scale", slider(a.uiScale || 100, 80, 125, 5, (v) => v + "%", (v) => {
        settings.set({ appearance: { uiScale: v } });
        settings.applyAppearance();
      })));
      p.appendChild(field("Compact density", checkbox(a.compact, (v) => {
        settings.set({ appearance: { compact: v } });
        settings.applyAppearance();
      })));
      p.appendChild(field("Interface language", select(
        [{ value: "en", label: "English" }, { value: "zh", label: "中文" }],
        a.language || "en",
        (v) => {
          settings.set({ appearance: { language: v } });
          settings.applyAppearance();
        }
      )));
    }

    if (id === "keyboard") {
      p.appendChild(el("div", { class: "hint" }, "Click a combo field, then press the new shortcut. Empty = default."));
      SHORTCUT_ACTIONS.forEach((action) => {
        const current = settings.getShortcut(action.id, action.default);
        const input = el("input", {
          type: "text",
          readonly: true,
          value: formatCombo(current),
          class: "shortcut-input",
          style: "cursor:pointer;min-width:140px",
        });
        input.addEventListener("keydown", (e) => {
          e.preventDefault();
          const combo = parseCombo(e);
          if (!combo) return;
          if (combo === "Escape") {
            input.blur();
            return;
          }
          settings.setShortcut(action.id, combo);
          input.value = formatCombo(combo);
          toast(`${action.label} → ${formatCombo(combo)}`);
        });
        input.addEventListener("click", () => input.focus());
        p.appendChild(field(action.label, input, action.hint || ""));
      });
      p.appendChild(row(
        el("button", {
          class: "btn sm",
          onclick: () => {
            settings.resetShortcuts();
            renderBody();
            toast("Shortcuts reset to defaults", "ok");
          },
        }, "Reset shortcuts")
      ));
    }

    return p;
  }

  function renderLutList(list) {
    list.innerHTML = "";
    const luts = settings.get().luts || [];
    if (!luts.length) {
      list.appendChild(el("div", { class: "muted-note" }, "No LUTs imported yet."));
      return;
    }
    luts.forEach((l) => {
      const rowEl = el("div", { class: "lut-row" }, [
        el("span", { class: "name" }, `${l.name} · ${l.size}³`),
        el("button", { class: "btn sm danger", onclick: () => { settings.removeLut(l.id); renderLutList(list); } }, "Remove"),
      ]);
      list.appendChild(rowEl);
    });
  }

  function importCube(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseCube(String(reader.result));
        if (!parsed.size || parsed.data.length < 3) {
          toast("LUT file looks invalid", "warn");
          return;
        }
        const lut = {
          id: "lut_" + Math.random().toString(36).slice(2, 9),
          name: file.name.replace(/\.cube$/i, ""),
          size: parsed.size,
          data: Array.from(parsed.data),
        };
        settings.addLut(lut);
        toast(`LUT "${lut.name}" imported (${lut.size}³)`, "ok");
        const list = $("#lutList");
        if (list) renderLutList(list);
      } catch (e) {
        toast("Failed to parse LUT: " + e.message, "warn");
      }
    };
    reader.readAsText(file);
  }

  function exportProject() {
    const data = JSON.stringify(store.get(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: (store.get().name || "project") + ".aifimora.json" });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast("Project exported", "ok");
  }

  function importProjectFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result));
        if (store.importProject(obj)) {
          toast("Project imported", "ok");
          window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
        } else {
          toast("Import failed: invalid project", "warn");
        }
      } catch (e) {
        toast("Import failed: " + e.message, "warn");
      }
    };
    reader.readAsText(file);
  }

  function renderNav() {
    const nav = el("div", { class: "settings-nav" });
    SECTIONS.forEach((sec) => {
      const b = el("button", {
        class: sec.id === active ? "active" : "",
        onclick: () => { active = sec.id; renderBody(); },
      }, sec.label);
      nav.appendChild(b);
    });
    return nav;
  }

  function renderBody() {
    body.innerHTML = "";
    body.appendChild(renderNav());
    body.appendChild(buildPane(active));
  }

  function open() {
    active = "general";
    renderBody();
    modal.classList.add("open");
  }
  function close() {
    modal.classList.remove("open");
  }

  openBtn.addEventListener("click", open);
  $("#settingsClose")?.addEventListener("click", close);
  $("#settingsSave")?.addEventListener("click", close);
  $("#settingsReset")?.addEventListener("click", () => {
    if (confirm("Reset all preferences to defaults?")) {
      settings.resetToDefaults();
      renderBody();
      toast("Preferences reset", "ok");
    }
  });
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("open")) close();
  });

  window.addEventListener("aifimora:settings", () => {
    if (modal.classList.contains("open") && active !== "keyboard" && active !== "luts") {
      // avoid stealing focus from shortcut inputs
    }
  });

  // Open Preferences on a specific tab (used by AI / tools)
  window.addEventListener("aifimora:open-settings", (e) => {
    active = e.detail?.tab || "general";
    open();
    renderBody();
  });
}
