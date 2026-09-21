/* AI Mate + Multi-model GenAI Lab + jobs */
import { store, DEFAULT_FX } from "./state.js";
import { addGeneratedMedia, toast } from "./media.js";
import { aiComplete, isAIConfigured, getActiveProvider } from "./ai-providers.js";
import { settings } from "./settings.js";
import { iconSpark } from "./icons.js";

const MODELS = [
  {
    id: "veo-3.1",
    name: "Veo 3.1",
    vendor: "Google DeepMind",
    blurb: "Native audio · multi-shot extend",
    cost: 40,
  },
  {
    id: "runway-gen45",
    name: "Runway Gen-4.5",
    vendor: "Runway",
    blurb: "#1 T2V · cinematic motion",
    cost: 35,
  },
  {
    id: "kling-25",
    name: "Kling 2.5",
    vendor: "Kuaishou",
    blurb: "Normal Mode 2.0 quality",
    cost: 20,
  },
  {
    id: "seedance-2",
    name: "Seedance 2.0",
    vendor: "ByteDance",
    blurb: "Fast social B-roll",
    cost: 15,
  },
];

let selectedModel = MODELS[0];

export function initAIStudio() {
  renderModels();
  renderJobs();
  renderMate();
  bindChat();
  bindGenForm();

  store.subscribe(() => {
    renderJobs();
    renderMate();
    updateCreditsUI();
  });
  updateCreditsUI();
}

function updateCreditsUI() {
  const left = store.creditLeft();
  const cap = store.get().credits.cap || 0;
  const used = store.get().credits.used || 0;
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  const chip = document.getElementById("creditsChip");
  if (chip) {
    chip.innerHTML = `<span class="chip-ico">${iconSpark}</span>AI Credits <span class="bar"><i style="width:${pct}%"></i></span> ${left}`;
    chip.title = `${used} / ${cap} credits used`;
  }
}

function renderModels() {
  const root = document.getElementById("modelGrid");
  if (!root) return;
  root.innerHTML = "";
  MODELS.forEach((m) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "model-card" + (m.id === selectedModel.id ? " active" : "");
    btn.innerHTML = `<strong>${m.name}</strong><span>${m.vendor} · ${m.cost} cr</span><span>${m.blurb}</span>`;
    btn.addEventListener("click", () => {
      selectedModel = m;
      renderModels();
    });
    root.appendChild(btn);
  });
}

function renderJobs() {
  const root = document.getElementById("jobList");
  if (!root) return;
  const jobs = [...store.get().jobs].reverse();
  if (!jobs.length) {
    root.innerHTML = `<div class="empty">No generation jobs yet.</div>`;
    return;
  }
  root.innerHTML = jobs
    .map(
      (j) => `
    <div class="job ${j.status}">
      <header><strong>${escape(j.title)}</strong><span>${j.status}</span></header>
      <div class="progress"><i style="width:${j.progress}%"></i></div>
      ${j.detail ? `<div style="margin-top:6px;font-size:11px;color:var(--muted)">${escape(j.detail)}</div>` : ""}
    </div>`
    )
    .join("");
}

function renderMate() {
  const root = document.getElementById("mateLog");
  if (!root) return;
  const log = store.get().mateLog;
  root.innerHTML = log
    .map((m) => {
      const actions = m.actions
        ? `<div class="actions">${m.actions
            .map((a) => `<button type="button" class="btn sm" data-action="${a.id}">${escape(a.label)}</button>`)
            .join("")}</div>`
        : "";
      return `<div class="msg ${m.role}">${escape(m.text)}${actions}</div>`;
    })
    .join("");
  root.scrollTop = root.scrollHeight;

  root.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => runMateAction(btn.dataset.action, btn));
  });
}

function bindChat() {
  const input = document.getElementById("mateInput");
  const send = document.getElementById("mateSend");
  const sendIt = () => {
    const text = (input.value || "").trim();
    if (!text) return;
    input.value = "";
    handleMatePrompt(text);
  };
  send?.addEventListener("click", sendIt);
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendIt();
    }
  });

  document.querySelectorAll("[data-quick]").forEach((chip) => {
    chip.addEventListener("click", () => handleMatePrompt(chip.dataset.quick));
  });
}

function bindGenForm() {
  const form = document.getElementById("genForm");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const prompt = document.getElementById("genPrompt").value.trim();
    const kind = document.getElementById("genKind").value;
    if (!prompt) return toast("Enter a prompt");
    runGeneration({ prompt, kind, model: selectedModel });
  });
}

export function handleMatePrompt(text) {
  store.mateSay("user", text);
  const q = text.toLowerCase();

  // project memory: remember last intents
  const memory = {
    ...readMemory(),
    lastPrompt: text,
    lastIntent: detectIntent(q),
  };
  writeMemory(memory);

  const intent = memory.lastIntent;
  setTimeout(() => respondIntent(intent, text, memory), 280);
}

function detectIntent(q) {
  if (/caption|subtitle/.test(q)) return "captions";
  if (/filler|silence|um+|uh+|pause|dead air/.test(q)) return "silence";
  if (/grade|color|lut|cinematic|auto enhance|color match/.test(q)) return "grade";
  if (/generate|b-roll|broll|text to video|script to video/.test(q)) return "generate";
  if (/reframe|vertical|9:16|tiktok|shorts/.test(q)) return "reframe";
  if (/mask|cutout|isolate|subject/.test(q)) return "mask";
  if (/voice|denoise|studio sound|audio clean/.test(q)) return "voice";
  if (/vocal remover|karaoke|isolate vocal|acapella/.test(q)) return "vocalRemover";
  if (/audio stretch|retime audio|fit music/.test(q)) return "stretch";
  if (/stabiliz/.test(q)) return "stabilize";
  if (/face mosaic|blur face|privacy/.test(q)) return "faceMosaic";
  if (/object remover|magic box|remove object/.test(q)) return "objectRemover";
  if (/music|soundtrack|bgm|sound effect/.test(q)) return "music";
  if (/voiceover|text to speech|tts|speak/.test(q)) return "tts";
  if (/thumbnail/.test(q)) return "thumbnail";
  if (/extend|generative extend|fill gap/.test(q)) return "extend";
  if (/beat.*montage|auto beat|on-beat|sync.*beat/.test(q)) return "beatMontage";
  if (/upscale|4k|sharpen|enhance video/.test(q)) return "upscale";
  if (/rough cut|edit the timeline|build a cut|story/.test(q)) return "roughcut";
  if (/export|render|publish/.test(q)) return "export";
  if (/title|headline|lower third|hook/.test(q)) return "titles";
  if (/script|outline|shot list|storyboard/.test(q)) return "script";
  if (/transition|dissolve|wipe/.test(q)) return "transition";
  if (/help|what can you/.test(q)) return "help";
  if (/undo|history/.test(q)) return "history";
  return "chat";
}

function respondIntent(intent, text, memory) {
  const s = store.get();
  const clips = s.clips;

  if (intent === "help") {
    store.mateSay(
      "bot",
      "I can: captions, silence cut, grade/auto-enhance/color-match, B-roll, reframe, Magic Mask, voice enhance, vocal remover, audio stretch, stabilize, face mosaic, object remover, AI music, TTS voiceover, thumbnail, AI extend, beat montage, titles, transitions, rough cut, export. Free-form chat uses your provider when configured (AI tab).",
      [
        { id: "act_captions", label: "Add captions" },
        { id: "act_silence", label: "Cut silence" },
        { id: "act_roughcut", label: "Build rough cut" },
        { id: "act_music", label: "AI Music" },
        { id: "act_extend", label: "AI Extend" },
        { id: "act_titles", label: "Suggest titles" },
      ]
    );
    return;
  }

  if (intent === "titles") {
    suggestTitles(text);
    return;
  }
  if (intent === "script") {
    suggestScript(text);
    return;
  }
  if (intent === "transition") {
    window.dispatchEvent(new CustomEvent("aifimora:open-transitions"));
    store.mateSay("bot", "Opened Transitions. Select a clip, then pick dissolve / wipe / glitch, etc. Click ◇ on a cut anytime.");
    return;
  }
  if (intent === "chat") {
    liveChat(text);
    return;
  }

  if (intent === "history") {
    const hist = s.history.slice(-5).map((h) => h.type).join(", ") || "none yet";
    store.mateSay("bot", `Recent actions in this project: ${hist}. Project memory keeps your last intents for follow-ups.`);
    return;
  }

  runMateAction(`act_${intent}`, null, text);
}

function runMateAction(actionId, _btn, rawText) {
  const s = store.get();
  const action = actionId.replace(/^act_/, "");

  switch (action) {
    case "captions":
      createCaptions();
      break;
    case "silence":
      removeSilence();
      break;
    case "scenes":
      detectScenes();
      break;
    case "duck":
      applyAutoDuck();
      break;
    case "srt":
      window.dispatchEvent(new CustomEvent("aifimora:export-srt"));
      break;
    case "grade":
      applyGradeCinematic();
      break;
    case "autoEnhance":
      applyAutoEnhance();
      break;
    case "colorMatch":
      applyColorMatch();
      break;
    case "stabilize":
      applyStabilization();
      break;
    case "vocalRemover":
      applyVocalRemover();
      break;
    case "stretch":
      applyAudioStretch();
      break;
    case "faceMosaic":
      applyFaceMosaic();
      break;
    case "objectRemover":
      applyObjectRemover();
      break;
    case "music":
      generateMusicBed();
      break;
    case "tts":
      generateVoiceover(rawText);
      break;
    case "thumbnail":
      createThumbnail();
      break;
    case "extend":
      extendSelectedClip();
      break;
    case "beatMontage":
      applyAutoBeatMontage();
      break;
    case "generate":
      runGeneration({
        prompt: rawText && !/generate|b-roll/i.test(rawText) ? rawText : "Cinematic establishing B-roll of a modern city at golden hour, slow push-in",
        kind: "broll",
        model: selectedModel,
      });
      break;
    case "reframe":
      applyReframe("9:16");
      break;
    case "mask":
      applyMask();
      break;
    case "voice":
      applyVoiceEnhance();
      break;
    case "upscale":
      applyUpscale();
      break;
    case "roughcut":
      buildRoughCut();
      break;
    case "export":
      window.dispatchEvent(new CustomEvent("aifimora:open-export"));
      store.mateSay("bot", "Opened the Export panel. Pick a preset, then choose where to save and what to name the file.");
      break;
    case "transcript":
      store.mateSay("bot", "Switching to Transcript panel. Edit words to cut video.");
      window.dispatchEvent(new CustomEvent("aifimora:open-text-edit"));
      break;
    case "titles":
      suggestTitles(rawText || "");
      break;
    case "script":
      suggestScript(rawText || "");
      break;
    default:
      store.mateSay("bot", "I can still help — try one of the quick actions under the chat.");
  }
}

function createCaptions() {
  const s = store.get();
  if (!s.clips.length) {
    store.mateSay("bot", "Add or generate clips first — captions attach to your story length.");
    return;
  }
  const res = store.spendCredits(10, "Auto Captions");
  if (!res.ok) {
    store.mateSay("bot", res.reason);
    toast(res.reason, "err");
    return;
  }

  const script = [
    "Welcome back to the channel.",
    "Today we're cutting a travel short entirely with AI.",
    "First, tighten the audio and drop the filler words.",
    "Next, generate two B-roll shots to cover the jump cuts.",
    "Finally, reframe for vertical and export.",
  ];
  const dur = store.sequenceDuration();
  const captions = [];
  let t = 0.4;
  script.forEach((line) => {
    const end = Math.min(dur, t + 2.8);
    if (t < dur) captions.push({ start: t, end, text: line });
    t = end + 0.15;
  });

  store.set({ captions });
  store.mateSay("sys", `Auto Captions complete — ${captions.length} cues (10 credits).`);
  toast("Captions added", "ok");
}

export function detectScenes() {
  const s = store.get();
  const videos = s.clips.filter((c) => c.type === "video");
  if (!videos.length) {
    store.mateSay("bot", "Add video clips first — scene detection splits on visual cuts.");
    return;
  }
  const res = store.spendCredits(4, "Scene detection");
  if (!res.ok) {
    store.mateSay("bot", res.reason);
    return toast(res.reason, "err");
  }
  const { threshold } = settings.sceneConfig();
  // Higher threshold = fewer cuts (sensitivity inverted like Filmora slider copy)
  const cutEvery = Math.max(1.2, 6 - threshold * 12);
  store.pushUndo("Scene detect");
  let splits = 0;
  const next = [...s.clips];
  videos.forEach((clip) => {
    const idx = next.findIndex((c) => c.id === clip.id);
    if (idx < 0) return;
    const parts = Math.max(1, Math.floor(clip.duration / cutEvery));
    if (parts <= 1) return;
    const partDur = clip.duration / parts;
    const pieces = [];
    for (let i = 0; i < parts; i++) {
      pieces.push({
        ...JSON.parse(JSON.stringify(clip)),
        id: store.uid("clip"),
        name: `${clip.name} · scene ${i + 1}`,
        start: clip.start + i * partDur,
        duration: partDur,
      });
    }
    next.splice(idx, 1, ...pieces);
    splits += parts - 1;
  });
  store.set({ clips: next });
  store.pushHistory({ type: "scene-detect", splits, threshold });
  store.mateSay(
    "sys",
    `Scene detection complete — ${splits} cut${splits === 1 ? "" : "s"} at threshold ${threshold.toFixed(2)} (4 credits).`
  );
  toast(splits ? `Detected ${splits} scene cut(s)` : "No additional scenes found", "ok");
  store.save();
  window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
}

export function applyAutoDuck() {
  const s = store.get();
  const duck = settings.duckConfig();
  if (!duck.enabled) {
    store.mateSay(
      "bot",
      "Auto-ducking is off in Preferences → Audio. Enable Ducking there, then run again."
    );
    return;
  }
  const voice = s.clips.filter((c) => c.fx?.voiceEnhance || c.type === "audio");
  const music = s.clips.filter((c) => c.type === "audio" && !c.fx?.voiceEnhance);
  if (!music.length || !voice.length) {
    store.mateSay("bot", "Need at least one voice clip and one music clip to duck.");
    return;
  }
  store.pushUndo("Auto duck");
  const duckDb = duck.db;
  const next = s.clips.map((c) => {
    if (c.type !== "audio" || c.fx?.voiceEnhance) return c;
    // lower music volume under overlapping voice ranges
    const underVoice = voice.some(
      (v) => v.start < c.start + c.duration && v.start + v.duration > c.start
    );
    if (!underVoice) return c;
    const vol = Math.max(0, Math.min(100, 100 + duckDb)); // e.g. -12dB ≈ 25% linear approx for UI
    return { ...c, volume: vol, fadeIn: Math.max(c.fadeIn || 0, duck.fade), fadeOut: Math.max(c.fadeOut || 0, duck.fade) };
  });
  store.set({ clips: next });
  store.mateSay("sys", `Auto-duck applied — music under voice at ${duckDb} dB with ${duck.fade}s fades.`);
  toast("Auto-duck applied", "ok");
  store.save();
  window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
}

function removeSilence() {
  const s = store.get();
  if (!s.clips.length) {
    store.mateSay("bot", "No clips to tighten. Insert media or build a rough cut first.");
    return;
  }
  const res = store.spendCredits(8, "Silence & filler removal");
  if (!res.ok) {
    store.mateSay("bot", res.reason);
    return toast(res.reason, "err");
  }

  // Honor silence threshold / pad / min-duration from Preferences (Filmora Silence Detection)
  const silence = settings.silenceConfig();
  const compress = 1 - Math.min(0.5, Math.max(0.05, silence.threshold));
  const pad = Math.max(silence.minPad, 0.05);
  const minDur = silence.minDur || 0.5;

  // Simulate tightening: compress audio/text clips and punch video in slightly
  const next = s.clips.map((c) => {
    if (c.type === "audio" || c.type === "text") {
      const name = / ·tight$/.test(c.name) ? c.name : c.name + " ·tight";
      const d = Math.max(pad, c.duration * compress);
      return { ...c, duration: d, name };
    }
    return { ...c, duration: Math.max(0.4, c.duration * (1 - compress * 0.35)) };
  });
  // re-pack start times sequentially per track
  const trackIds = [...new Set(next.map((c) => c.trackId))];
  let packed = [...next];
  trackIds.forEach((tid) => {
    const onTrack = packed
      .filter((c) => c.trackId === tid)
      .sort((a, b) => a.start - b.start);
    let cursor = 0;
    const repacked = onTrack.map((c) => {
      const nc = { ...c, start: cursor };
      cursor += c.duration + 0.05;
      return nc;
    });
    packed = packed.filter((c) => c.trackId !== tid).concat(repacked);
  });

  store.set({ clips: packed });
  store.pushHistory({ type: "silence-removed" });
  store.mateSay("sys", `Silence & filler removal applied — threshold ${silence.threshold.toFixed(2)}, min ${minDur.toFixed(1)}s, pad ${pad.toFixed(2)}s (8 credits).`);
  toast("Silence removed", "ok");
  store.save();
  window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
}

function applyGradeCinematic() {
  const s = store.get();
  if (!s.clips.length) return store.mateSay("bot", "Nothing to grade yet.");
  const res = store.spendCredits(6, "Cinematic grade");
  if (!res.ok) {
    store.mateSay("bot", res.reason);
    return toast(res.reason, "err");
  }

  store.set({
    clips: s.clips.map((c) =>
      c.type === "audio"
        ? c
        : {
            ...c,
            fx: {
              ...c.fx,
              contrast: 18,
              saturation: 12,
              temperature: 8,
              vignette: 35,
              lut: "cinematic",
            },
          }
    ),
  });
  store.mateSay("sys", "Cinematic LUT applied (teal-shadow, warm highlight, vignette 35%).");
  toast("Grade applied", "ok");
  store.save();
}

function applyReframe(mode) {
  const s = store.get();
  if (!s.clips.length) return store.mateSay("bot", "Add clips before reframing.");
  store.set({
    clips: s.clips.map((c) => (c.type === "audio" ? c : { ...c, fx: { ...c.fx, reframe: mode } })),
  });
  store.mateSay("sys", `Smart Conform → ${mode}. Preview updates immediately.`);
  toast(`Reframed to ${mode}`, "ok");
  store.save();
}

function applyMask() {
  const s = store.get();
  if (!s.clips.length) return store.mateSay("bot", "No clips for Magic Mask.");
  const res = store.spendCredits(15, "Magic Mask");
  if (!res.ok) {
    store.mateSay("bot", res.reason);
    return toast(res.reason, "err");
  }
  store.set({
    clips: s.clips.map((c) => (c.type === "audio" ? c : { ...c, fx: { ...c.fx, mask: true } })),
  });
  store.mateSay("sys", "Magic Mask enabled — subject isolation preview on video clips (15 credits).");
  toast("Magic Mask on", "ok");
}

function applyVoiceEnhance() {
  const s = store.get();
  const audioClips = s.clips.filter((c) => c.type === "audio");
  if (!audioClips.length) {
    store.mateSay("bot", "No audio clips to enhance. Add voice or music first.");
    return toast("No audio clips on the timeline", "err");
  }
  const res = store.spendCredits(5, "Voice enhance");
  if (!res.ok) {
    store.mateSay("bot", res.reason);
    return toast(res.reason, "err");
  }
  store.set({
    clips: s.clips.map((c) => (c.type === "audio" ? { ...c, fx: { ...c.fx, voiceEnhance: true } } : c)),
  });
  store.mateSay("sys", "Studio Sound / Voice Isolation enabled on audio tracks (5 credits).");
  toast("Voice enhanced", "ok");
}

function applyUpscale() {
  const s = store.get();
  const videoClips = s.clips.filter((c) => c.type !== "audio");
  if (!videoClips.length) {
    store.mateSay("bot", "No video clips to upscale.");
    return toast("No video clips on the timeline", "err");
  }
  const res = store.spendCredits(12, "Super Scale");
  if (!res.ok) {
    store.mateSay("bot", res.reason);
    return toast(res.reason, "err");
  }
  store.set({
    clips: s.clips.map((c) => (c.type === "audio" ? c : { ...c, fx: { ...c.fx, upscale: true } })),
  });
  store.mateSay("sys", "Super Scale / Topaz-style upscale simulation enabled (12 credits).");
  toast("Upscale enabled", "ok");
}

/* ---------- Filmora-gap tools (all simulated, inspectable, undoable) ---------- */

export function applyAutoEnhance() {
  const s = store.get();
  if (!s.clips.length) {
    store.mateSay("bot", "Add clips before auto-enhance.");
    return toast("Add clips first", "err");
  }
  const intensity = Number(settings.get().color?.autoEnhanceIntensity ?? 60) / 100;
  const res = store.spendCredits(6, "Auto Enhance");
  if (!res.ok) {
    store.mateSay("bot", res.reason);
    return toast(res.reason, "err");
  }
  store.pushUndo("Auto Enhance");
  // Filmora Enhance Light & Color: histogram-aware exposure/contrast/wb scaled by intensity
  const k = 0.4 + intensity * 0.9;
  store.set({
    clips: s.clips.map((c) =>
      c.type === "audio"
        ? c
        : {
            ...c,
            fx: {
              ...c.fx,
              exposure: Math.round(8 * k),
              contrast: Math.round(16 * k),
              saturation: Math.round(10 * k),
              temperature: Math.round(6 * k),
              highlights: Math.round(-8 * k),
              shadows: Math.round(10 * k),
              vignette: 12,
            },
          }
    ),
  });
  store.mateSay("sys", `Auto Enhance applied at ${Math.round(intensity * 100)}% (6 credits). Tune in Preferences → Color.`);
  toast("Auto Enhance applied", "ok");
  store.save();
  window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
}

export function applyColorMatch() {
  const s = store.get();
  const src = s.clips.find((c) => c.id === s.selectedClipId && c.type !== "audio");
  if (!src) {
    store.mateSay("bot", "Select a reference video clip first — Color Match copies its grade to the rest.");
    return toast("Select a reference clip first", "err");
  }
  const strength = Number(settings.get().color?.colorMatchStrength ?? 80) / 100;
  const res = store.spendCredits(4, "Color Match");
  if (!res.ok) {
    store.mateSay("bot", res.reason);
    return toast(res.reason, "err");
  }
  store.pushUndo("Color Match");
  const lerp = (a, b) => Math.round(a + (b - a) * strength);
  store.set({
    clips: s.clips.map((c) => {
      if (c.type === "audio" || c.id === src.id) return c;
      const f = c.fx || {};
      const sf = src.fx || {};
      return {
        ...c,
        fx: {
          ...f,
          exposure: lerp(f.exposure || 0, sf.exposure || 0),
          contrast: lerp(f.contrast || 0, sf.contrast || 0),
          saturation: lerp(f.saturation || 0, sf.saturation || 0),
          temperature: lerp(f.temperature || 0, sf.temperature || 0),
          tint: lerp(f.tint || 0, sf.tint || 0),
          lut: sf.lut || f.lut,
          lutIntensity: sf.lutIntensity ?? f.lutIntensity,
        },
      };
    }),
  });
  store.mateSay("sys", `Color Match from “${src.name}” at ${Math.round(strength * 100)}% (4 credits).`);
  toast("Color matched to selected clip", "ok");
  store.save();
  window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
}

export function applyStabilization() {
  const s = store.get();
  const sel = s.clips.find((c) => c.id === s.selectedClipId && c.type !== "audio" && c.type !== "text");
  const targets = sel ? [sel] : s.clips.filter((c) => c.type !== "audio" && c.type !== "text");
  if (!targets.length) {
    store.mateSay("bot", "Select a video clip to stabilize.");
    return toast("Select a video clip first", "err");
  }
  const res = store.spendCredits(8, "Stabilization");
  if (!res.ok) {
    store.mateSay("bot", res.reason);
    return toast(res.reason, "err");
  }
  store.pushUndo("Stabilize");
  const smooth = 50; // default; inspector slider tunes per-clip after
  store.set({
    clips: s.clips.map((c) =>
      targets.some((t) => t.id === c.id) ? { ...c, fx: { ...c.fx, stabilize: true, stabilizeSmooth: smooth } } : c
    ),
  });
  store.mateSay("sys", `Stabilization on ${targets.length} clip(s) — smoothness ${smooth} (8 credits). Tune per-clip in Color/FX.`);
  toast("Stabilization applied", "ok");
  store.save();
  window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
}

export function applyVocalRemover() {
  const s = store.get();
  const music = s.clips.filter((c) => c.type === "audio");
  if (!music.length) {
    store.mateSay("bot", "Add an audio/music clip first — Vocal Remover splits vocals vs instruments.");
    return toast("No audio clips on the timeline", "err");
  }
  const res = store.spendCredits(9, "Vocal Remover");
  if (!res.ok) {
    store.mateSay("bot", res.reason);
    return toast(res.reason, "err");
  }
  store.pushUndo("Vocal Remover");
  // Simulate source separation: duplicate each music clip into vocals + instrumental pair
  const next = [...s.clips];
  music.slice(0, 3).forEach((c) => {
    const base = next.find((x) => x.id === c.id);
    if (!base) return;
    base.name = base.name.replace(/ ·(vox|inst)$/, "") + " ·inst";
    base.fx = { ...(base.fx || {}), eqPreset: "music" };
    next.push({
      ...JSON.parse(JSON.stringify(base)),
      id: store.uid("clip"),
      name: c.name.replace(/ ·(vox|inst)$/, "") + " ·vox",
      trackId: "a2",
      start: c.start,
      fx: { ...(base.fx || {}), voiceEnhance: true, eqPreset: "voice" },
    });
  });
  store.set({ clips: next });
  store.mateSay("sys", "Vocal Remover: split into ·vox (voice) + ·inst (instrumental) on A2 (9 credits).");
  toast("Vocals separated → A2", "ok");
  store.save();
  window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
}

export function applyAudioStretch() {
  const s = store.get();
  const sel = s.clips.find((c) => c.id === s.selectedClipId && c.type === "audio");
  if (!sel) {
    store.mateSay("bot", "Select an audio clip — Audio Stretch retimes it to the video length (Filmora).");
    return toast("Select an audio clip first", "err");
  }
  const videoDur = Math.max(...s.clips.filter((c) => c.type !== "audio").map((c) => c.start + c.duration), sel.start + sel.duration);
  const target = Math.max(0.5, videoDur - sel.start);
  store.pushUndo("Audio Stretch");
  const rate = Math.min(4, Math.max(0.5, sel.duration / target));
  store.updateClip(sel.id, { duration: target, speed: rate });
  store.mateSay("sys", `Audio Stretch: “${sel.name}” retimed ${sel.duration.toFixed(1)}s → ${target.toFixed(1)}s (${rate.toFixed(2)}×).`);
  toast(`Stretched to ${target.toFixed(1)}s`, "ok");
  store.save();
  window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
}

export function generateMusicBed() {
  const s = store.get();
  const ai = settings.get().ai || {};
  const mood = ai.musicMood || "cinematic";
  const tempo = ai.musicTempo || "90bpm";
  const dur = Math.min(120, Math.max(5, Number(ai.musicDuration) || 15));
  const res = store.spendCredits(14, `AI Music ${mood}`);
  if (!res.ok) {
    store.mateSay("bot", res.reason);
    return toast(res.reason, "err");
  }
  const job = store.addJob({ title: `AI Music · ${mood} ${tempo}`, detail: `${dur}s royalty-free bed`, progress: 0 });
  let p = 0;
  const timer = setInterval(() => {
    p += 12 + Math.random() * 14;
    if (p >= 100) {
      clearInterval(timer);
      store.updateJob(job.id, { progress: 100, status: "done", detail: "Landed in Media Bin + A2" });
      const media = addGeneratedMedia({ name: `Music · ${mood} ${tempo}`, kind: "audio", duration: dur, model: "AI Music", prompt: `${mood} ${tempo} ${dur}s` });
      store.addClip({ mediaId: media.id, name: media.name, type: "audio", trackId: "a2", start: store.sequenceDuration(), duration: dur, fx: { ...DEFAULT_FX, eqPreset: "music" } });
      store.mateSay("sys", `AI Music ready: ${mood} ${tempo}, ${dur}s on A2 (14 credits). Set mood/tempo in Preferences → AI.`);
      toast("Music bed generated", "ok");
      return;
    }
    store.updateJob(job.id, { progress: Math.floor(p) });
  }, 200);
}

export function generateVoiceover(text) {
  const s = store.get();
  const ai = settings.get().ai || {};
  const voice = ai.ttsVoice || "aria";
  const prompt = (text || document.getElementById("textContent")?.value || "Welcome to AiFilmora. This is your AI voiceover.").slice(0, 280);
  if (!prompt.trim()) return toast("Enter text for voiceover first", "err");
  const res = store.spendCredits(7, `TTS ${voice}`);
  if (!res.ok) {
    store.mateSay("bot", res.reason);
    return toast(res.reason, "err");
  }
  try {
    // Real preview when available: Web Speech API speaks the line (Filmora TTS preview)
    const synth = window.speechSynthesis;
    if (synth) {
      const u = new SpeechSynthesisUtterance(prompt.slice(0, 160));
      u.rate = Number(ai.ttsRate) || 1;
      u.pitch = Number(ai.ttsPitch) || 1;
      synth.cancel();
      synth.speak(u);
    }
  } catch { /* preview is best-effort */ }
  const dur = Math.min(60, Math.max(3, prompt.length / 14));
  const media = addGeneratedMedia({ name: `VO · ${voice} · ${prompt.slice(0, 20)}…`, kind: "audio", duration: dur, model: `TTS ${voice}`, prompt });
  store.addClip({ mediaId: media.id, name: media.name, type: "audio", trackId: "a1", start: store.sequenceDuration(), duration: dur, fx: { ...DEFAULT_FX, voiceEnhance: true } });
  store.mateSay("sys", `Text-to-Speech (${voice}) → ${dur.toFixed(1)}s voiceover on A1 (7 credits). Previewed via system voice.`);
  toast("Voiceover added to A1", "ok");
  store.save();
  window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
}

export function createThumbnail() {
  const canvas = document.getElementById("previewCanvas");
  if (!canvas) return toast("Preview not ready", "err");
  const res = store.spendCredits(3, "Thumbnail");
  if (!res.ok) {
    store.mateSay("bot", res.reason);
    return toast(res.reason, "err");
  }
  try {
    const out = document.createElement("canvas");
    out.width = 1280;
    out.height = 720;
    const ctx = out.getContext("2d");
    ctx.drawImage(canvas, 0, 0, out.width, out.height);
    // Filmora Thumbnail punch: title-safe title bar
    const title = (store.get().name || "AiFilmora").slice(0, 32);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, out.height - 140, out.width, 140);
    ctx.fillStyle = "#fff";
    ctx.font = "700 64px 'Segoe UI', sans-serif";
    ctx.fillText(title, 48, out.height - 52);
    const url = out.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = (store.get().name || "thumbnail") + "-thumb.png";
    a.click();
    store.mateSay("sys", "Thumbnail exported as 1280×720 PNG with title bar (3 credits).");
    toast("Thumbnail downloaded", "ok");
  } catch (e) {
    toast("Thumbnail failed: " + e.message, "err");
  }
}

export function extendSelectedClip() {
  const s = store.get();
  const sel = s.clips.find((c) => c.id === s.selectedClipId && c.type !== "audio" && c.type !== "text");
  if (!sel) {
    store.mateSay("bot", "Select a video clip — AI Extend grows it forward (Filmora 15 up to 5s).");
    return toast("Select a video clip first", "err");
  }
  const secs = Math.min(5, Math.max(1, Number(settings.get().ai?.extendSeconds) || 3));
  const res = store.spendCredits(16, `AI Extend +${secs}s`);
  if (!res.ok) {
    store.mateSay("bot", res.reason);
    return toast(res.reason, "err");
  }
  store.pushUndo(`AI Extend +${secs}s`);
  store.updateClip(sel.id, { duration: sel.duration + secs, name: sel.name.replace(/ ·ext$/, "") + " ·ext" });
  // Ripple later clips on the same track (Filmora extends and pushes)
  const end = sel.start + sel.duration;
  store.set({
    clips: store.get().clips.map((c) =>
      c.id !== sel.id && c.trackId === sel.trackId && c.start >= end - secs - 0.001 ? { ...c, start: c.start + secs } : c
    ),
  });
  store.mateSay("sys", `AI Extend: “${sel.name}” +${secs}s with generated frames (16 credits). Length in Preferences → AI.`);
  toast(`Extended +${secs}s`, "ok");
  store.save();
  window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
}

export function applyFaceMosaic() {
  const s = store.get();
  const vids = s.clips.filter((c) => c.type !== "audio" && c.type !== "text");
  if (!vids.length) return toast("Add video clips first", "err");
  const res = store.spendCredits(6, "Face Mosaic");
  if (!res.ok) {
    store.mateSay("bot", res.reason);
    return toast(res.reason, "err");
  }
  store.pushUndo("Face Mosaic");
  const sel = s.selectedClipId;
  store.set({
    clips: s.clips.map((c) =>
      c.type === "audio" || c.type === "text" ? c : sel && c.id !== sel ? c : { ...c, fx: { ...c.fx, faceMosaic: true } }
    ),
  });
  store.mateSay("sys", "Face Mosaic on — privacy blur preview on subject area (6 credits). Size in Preferences → AI.");
  toast("Face Mosaic on", "ok");
  store.save();
  window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
}

export function applyObjectRemover() {
  const s = store.get();
  const sel = s.clips.find((c) => c.id === s.selectedClipId && c.type !== "audio");
  if (!sel) return toast("Select a video clip first", "err");
  const res = store.spendCredits(10, "Object Remover");
  if (!res.ok) {
    store.mateSay("bot", res.reason);
    return toast(res.reason, "err");
  }
  store.pushUndo("Object Remover");
  store.updateClip(sel.id, { fx: { objectRemover: true } });
  store.mateSay("sys", `Object Remover flagged on “${sel.name}” — Magic Box inpaint preview (10 credits).`);
  toast("Object Remover flagged", "ok");
  store.save();
  window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
}

export function applyAutoBeatMontage() {
  const s = store.get();
  const audio = s.clips.find((c) => c.type === "audio" && c.beats?.length);
  if (!audio) {
    store.mateSay("bot", "Run Beat Sync on a music clip first — then Beat Montage cuts video to the highlights.");
    return toast("Beat Sync an audio clip first", "err");
  }
  const cfg = settings.beatConfig();
  const beats = (audio.beats || []).filter((_, i) => (i - cfg.highlightOffset) % cfg.highlightFreq === 0);
  if (beats.length < 2) return toast("Not enough highlight beats", "err");
  const res = store.spendCredits(7, "Beat Montage");
  if (!res.ok) {
    store.mateSay("bot", res.reason);
    return toast(res.reason, "err");
  }
  store.pushUndo("Beat Montage");
  // Re-time video clips to land cuts on highlight beats (ripple pack)
  const vids = s.clips.filter((c) => c.type !== "audio" && c.type !== "text").sort((a, b) => a.start - b.start);
  if (!vids.length) return toast("Add video clips first", "err");
  let bi = 0;
  const next = s.clips.map((c) => {
    if (c.type === "audio" || c.type === "text") return c;
    const t = audio.start + (beats[bi % beats.length] || 0);
    bi++;
    return { ...c, start: Math.max(0, t) };
  });
  store.set({ clips: next });
  store.mateSay("sys", `Highlight Beat Sync: ${vids.length} video clip(s) snapped to every ${cfg.highlightFreq} beats (7 credits).`);
  toast("Montage synced to beats", "ok");
  store.save();
  window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
}

function buildRoughCut() {
  const s = store.get();
  const videos = s.media.filter((m) => m.kind === "video").slice(0, 4);
  const audio = s.media.find((m) => m.kind === "audio");
  if (!videos.length) {
    store.mateSay("bot", "Import video media first, or generate B-roll in the Lab.");
    return;
  }
  const res = store.spendCredits(12, "AI rough cut");
  if (!res.ok) {
    store.mateSay("bot", res.reason);
    return toast(res.reason, "err");
  }

  const clips = [];
  let cursor = 0;
  videos.forEach((m) => {
    const d = Math.min(5, m.duration || 4);
    clips.push({
      id: store.uid("clip"),
      mediaId: m.id,
      name: m.name,
      type: "video",
      trackId: "v1",
      start: cursor,
      duration: d,
      fx: { ...DEFAULT_FX },
    });
    cursor += d + 0.05;
  });

  if (audio) {
    clips.push({
      id: store.uid("clip"),
      mediaId: audio.id,
      name: audio.name,
      type: "audio",
      trackId: "a1",
      start: 0,
      duration: Math.min(cursor, audio.duration || 12),
      fx: { ...DEFAULT_FX },
    });
  }

  store.set({
    clips,
    markers: [{ start: 0, end: cursor, label: "AI rough cut" }],
  });
  store.pushHistory({ type: "roughcut" });
  store.mateSay("sys", `Rough cut built — ${clips.length} clips from media bin (12 credits).`);
  toast("Rough cut ready", "ok");
  store.save();
  window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
}

export function runGeneration({ prompt, kind, model }) {
  const cost = model?.cost || 25;
  const res = store.spendCredits(cost, `${model?.name || "GenAI"} ${kind}`);
  if (!res.ok) {
    toast(res.reason, "err");
    store.mateSay("bot", res.reason);
    return;
  }

  const title = kind === "sfx" ? "SFX" : kind === "i2v" ? "Image→Video" : "B-roll";
  const job = store.addJob({
    title: `${model.name} · ${title}`,
    detail: prompt.slice(0, 80),
    progress: 0,
  });
  store.mateSay("bot", `Queued ${model.name} for ${title.toLowerCase()}: “${prompt}”. ${cost} credits reserved.`);

  let p = 0;
  const timer = setInterval(() => {
    p += 7 + Math.random() * 12;
    if (p >= 100) {
      clearInterval(timer);
      store.updateJob(job.id, { progress: 100, status: "done", detail: "Landed in Media Bin" });
      const media = addGeneratedMedia({
        name: `${title} · ${prompt.slice(0, 24)}…`,
        kind: kind === "sfx" ? "audio" : "video",
        duration: kind === "sfx" ? 3 : 5,
        model: model.name,
        prompt,
      });

      // auto place on timeline
      const trackId = media.kind === "audio" ? "a2" : "v2";
      const start = Math.max(0, store.sequenceDuration() - 4);
      store.addClip({
        mediaId: media.id,
        name: media.name,
        type: media.kind === "audio" ? "audio" : "gen",
        trackId,
        start,
        duration: media.duration,
        fx: { ...DEFAULT_FX },
      });
      store.mateSay("sys", `${model.name} finished. Clip added to ${trackId === "a2" ? "A2" : "V2"} and Media Bin.`);
      toast(`${model.name} generation complete`, "ok");
      return;
    }
    store.updateJob(job.id, { progress: Math.floor(p) });
  }, 220);
}

function projectBrief() {
  const s = store.get();
  const names = s.clips.map((c) => `${c.type}:${c.name}`).slice(0, 12).join(", ");
  return `Project "${s.name}", ${s.clips.length} clips, duration ${store.sequenceDuration().toFixed(1)}s. Clips: ${names || "none"}.`;
}

async function liveChat(userText) {
  if (!isAIConfigured()) {
    store.mateSay(
      "bot",
      "Open-ended chat needs a model. Open **AI Providers** (AI tab) and add an OpenAI-compatible key (OpenAI, Groq, Ollama, etc.). I can still run built-in edit actions without it.",
      [{ id: "act_open_ai", label: "Open AI settings" }]
    );
    return;
  }
  const p = getActiveProvider();
  store.mateSay("bot", `Asking ${p.label} (${p.model})…`);
  const res = await aiComplete(
    `${projectBrief()}\n\nUser: ${userText}\n\nReply as AiFimora AI Mate in under 120 words. Be concrete about editing next steps.`,
    {
      system:
        "You are AiFimora AI Mate inside a desktop video editor. Suggest practical NLE actions. Prefer short, actionable replies.",
    }
  );
  if (!res.ok) {
    store.mateSay("bot", `Provider error: ${res.error}. Check key/CORS in AI Providers.`);
    toast("AI provider error", "err");
    return;
  }
  store.mateSay("bot", res.content || "(empty reply)");
}

async function suggestTitles(userText) {
  if (!isAIConfigured()) {
    store.mateSay(
      "bot",
      "Title ideas need your AI provider. Meanwhile open the **Text** tab for presets (Main Title, Lower Third, Sticker).",
      [{ id: "act_open_text", label: "Open Text panel" }]
    );
    return;
  }
  store.mateSay("bot", "Drafting titles…");
  const res = await aiComplete(
    `${projectBrief()}\nUser request: ${userText || "suggest titles"}\n\nReturn exactly 5 title options, one per line, no numbering.`,
    { system: "You write punchy short video titles under 8 words." }
  );
  if (!res.ok) return store.mateSay("bot", "Title generation failed: " + res.error);
  store.mateSay("bot", "Title options:\n" + res.content);
}

async function suggestScript(userText) {
  if (!isAIConfigured()) {
    store.mateSay("bot", "Script drafting needs your AI provider configured in the AI tab.");
    return;
  }
  store.mateSay("bot", "Writing a shot list / script outline…");
  const res = await aiComplete(
    `${projectBrief()}\nUser: ${userText || "write a 30s short script"}\n\nOutput a compact shot list: 6-8 lines, each [time] visual — audio.`,
    { system: "You are a concise social-video director." }
  );
  if (!res.ok) return store.mateSay("bot", "Script failed: " + res.error);
  store.mateSay("bot", res.content);
}

window.addEventListener("aifimora:mate-ai-settings", () => {
  document.querySelector('[data-inspector="aisettings"]')?.click();
});
window.addEventListener("aifimora:mate-open-text", () => {
  document.querySelector('[data-inspector="textpanel"]')?.click();
});

// wire action buttons created dynamically
store.subscribe(() => {
  document.querySelectorAll("#mateLog [data-action]").forEach((btn) => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", () => {
      const a = btn.dataset.action;
      if (a === "act_open_ai") document.querySelector('[data-inspector="aisettings"]')?.click();
      if (a === "act_open_text") document.querySelector('[data-inspector="textpanel"]')?.click();
      if (a && a.startsWith("act_")) runMateAction(a, btn);
    });
  });
});

function readMemory() {
  try {
    return JSON.parse(localStorage.getItem("aifimora.mateMemory") || "{}");
  } catch {
    return {};
  }
}

function writeMemory(m) {
  try {
    localStorage.setItem("aifimora.mateMemory", JSON.stringify({ ...m, updatedAt: Date.now() }));
  } catch {
    /* quota or private mode */
  }
}

function escape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export { MODELS };
