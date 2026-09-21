/* audio-fx.js — Filmora's 76 audio effect presets, realised with Web Audio.
 *
 * assets/resources/audio_effect/<name>/description.json ships a real preset
 * definition for every effect Filmora exposes: display name, unique name and a
 * parameter list with min / max / default. Before this module the app had eight
 * hand-written voice presets and nothing else.
 *
 * The native .dll implementations (magic_xe_audio_*.dll) are obviously not
 * loadable in a browser, so each Filmora family is mapped onto a Web Audio
 * equivalent and driven by the *real* parameter ranges from the JSON:
 *
 *   reverb family   → ConvolverNode with a procedurally generated impulse response
 *   echo family     → DelayNode + feedback gain
 *   eq / tone       → BiquadFilterNode (lowshelf / peaking / highshelf)
 *   dynamics        → DynamicsCompressorNode
 *   denoise         → notch / highpass / lowpass biquads
 *   modulation      → gain or delay modulated by an OscillatorNode LFO
 *   voice / pitch   → playbackRate + formant peaking
 *   stereo          → StereoPannerNode / channel merger tricks
 *
 * The parameter ranges are Filmora's; the DSP is ours. That is the honest
 * division and the module says so in the UI.
 */

import { AUDIO_EFFECTS } from "./filmora-library.js";

/* --------------------------------------------------------------- families --- */
const FAMILY_RULES = [
  [/^reverb_|^audio_(cave|church|corridor|concert_reverb|music_hall_reverb|deep|desert|forest|rain|roadside|under_glacier)$/, "reverb", "Reverb"],
  [/^echo$|^surround_echo$|^audio_echo/, "echo", "Echo"],
  [/^(equalizer|variation_(bass_boost2?|super_bass|treble_boost))$/, "eq", "Equaliser"],
  [/^(compressor|limiter|expander)$/, "dynamics", "Dynamics"],
  [/^(dehum|humming_denoise|hiss_denoise|dewind|click_removal|audio_wind)$/, "denoise", "Repair"],
  [/^(chorus|audio_trembling|audio_rotating|audio_circular|audio_electrical)$/, "modulation", "Modulation"],
  [/^(pitchshifter|voice_change_.*)$/, "voice", "Voice"],
  [/^(walkie_talkie|phone|audio_megaphone|audio_phonograph|audio_vinyl)$/, "bandpass", "Character"],
  [/^(audio_ducking)$/, "duck", "Ducking"],
  [/^(stereo_haas|audio_surround360|change_channel|variation_wide_voice)$/, "stereo", "Stereo"],
  [/^(volume|clip_volume|media_volume|fade|variation_mute)$/, "gain", "Level"],
  [/^(speech_enhance.*|audio_enhancer|variation_(voice_enhance3?|clear_voice|high_resolution_voice|bathroom|magnetic|meditation))$/, "clarity", "Clarity"],
];

export function familyOf(id) {
  for (const [re, fam, label] of FAMILY_RULES) {
    if (re.test(id)) return { fam, familyLabel: label };
  }
  return { fam: "tone", familyLabel: "Tone" };
}

export function audioEffects() {
  return AUDIO_EFFECTS.map((e) => ({ ...e, ...familyOf(e.id) }));
}

export function effectById(id) {
  const e = AUDIO_EFFECTS.find((x) => x.id === id);
  return e ? { ...e, ...familyOf(e.id) } : null;
}

export function families() {
  const m = new Map();
  audioEffects().forEach((e) => {
    if (!m.has(e.fam)) m.set(e.fam, { fam: e.fam, label: e.familyLabel, count: 0 });
    m.get(e.fam).count++;
  });
  return [...m.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/** Normalise a Filmora param (min..max) to 0..1 using its own range. */
export function normParam(p, value) {
  const min = Number(p.min) || 0;
  const max = Number(p.max) || 0;
  if (max === min) return 0.5;
  return Math.min(1, Math.max(0, (Number(value ?? p.def) - min) / (max - min)));
}

/* ------------------------------------------------------------ audio graph --- */
let actx = null;
const graphs = typeof WeakMap !== "undefined" ? new WeakMap() : new Map();

export function audioContext() {
  if (actx) return actx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try { actx = new AC(); } catch { return null; }
  return actx;
}

/* One graph per media element. `createMediaElementSource` may only be called
 * once per element, so this is the single place it happens — the player's boost
 * gain and the FX chain share it. */
export function ensureGraph(el, mediaUrl) {
  try {
    const existing = graphs.get(el);
    if (existing) return existing;
    if (!/^(blob|data|file):/.test(String(mediaUrl || ""))) return null;
    const ctx = audioContext();
    if (!ctx) return null;
    const src = ctx.createMediaElementSource(el);
    const fxIn = ctx.createGain();
    const fxOut = ctx.createGain();
    const gain = ctx.createGain();
    src.connect(fxIn);
    fxIn.connect(fxOut);
    fxOut.connect(gain);
    gain.connect(ctx.destination);
    const rec = { ctx, src, fxIn, fxOut, gain, nodes: [], sig: "" };
    try { graphs.set(el, rec); } catch { /* ignore */ }
    return rec;
  } catch {
    return null;
  }
}

export function graphFor(el) {
  try { return graphs.get(el) || null; } catch { return null; }
}

export function resumeAudio() {
  if (actx && actx.state === "suspended") actx.resume().catch(() => {});
}

/* ------------------------------------------------------------ IR synthesis -- */
/* No impulse responses ship with the asset dump, so we synthesise them. A
 * decaying noise burst with a family-dependent tail length is a passable stand-in
 * for "cave", "church", "big room" and so on. */
function impulseResponse(ctx, seconds, decay) {
  const rate = ctx.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const buf = ctx.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  return buf;
}

const REVERB_TAILS = {
  audio_cave: [2.6, 2.2], audio_church: [3.6, 2.0], audio_corridor: [1.4, 3.0],
  audio_concert_reverb: [3.0, 2.1], audio_music_hall_reverb: [3.2, 2.0],
  reverb_big_room: [2.8, 2.2], reverb_lobby: [1.6, 2.6], reverb_small_room: [0.7, 3.4],
  reverb_classroom: [1.0, 3.0], reverb_denoise: [0.6, 3.6], audio_deep: [2.2, 2.4],
  audio_desert: [1.8, 2.8], audio_forest: [1.2, 3.2], audio_rain: [1.0, 3.4],
  audio_roadside: [0.9, 3.4], under_glacier: [3.4, 2.0],
};

/* --------------------------------------------------------------- DSP chain -- */
/* Build the node chain for one effect. Returns {input, output} plus optional
 * `extra` nodes that need an LFO started. */
export function buildEffect(ctx, fx, level01) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const lfos = [];
  let node = input;

  const fam = fx.fam || familyOf(fx.id).fam;
  const p0 = (i) => {
    const p = fx.params?.[i];
    return p ? normParam(p, p.def) : 0.5;
  };
  const amount = typeof level01 === "number" ? level01 : 1;

  switch (fam) {
    case "reverb": {
      const [tail, decay] = REVERB_TAILS[fx.id] || [1.8, 2.6];
      const dry = ctx.createGain();
      const wet = ctx.createGain();
      const conv = ctx.createConvolver();
      conv.buffer = impulseResponse(ctx, tail, decay);
      const lvl = p0(0);
      dry.gain.value = 1 - lvl * 0.45 * amount;
      wet.gain.value = lvl * 0.9 * amount;
      input.connect(dry);
      dry.connect(output);
      input.connect(conv);
      conv.connect(wet);
      wet.connect(output);
      node = null;
      break;
    }
    case "echo": {
      const delay = ctx.createDelay(1.5);
      delay.delayTime.value = 0.12 + p0(0) * 0.38;
      const fb = ctx.createGain();
      fb.gain.value = Math.min(0.75, p0(1) * 0.7 * amount);
      const wet = ctx.createGain();
      wet.gain.value = 0.35 + p0(0) * 0.35 * amount;
      input.connect(output);
      input.connect(delay);
      delay.connect(fb);
      fb.connect(delay);
      delay.connect(wet);
      wet.connect(output);
      node = null;
      break;
    }
    case "eq": {
      const shelf = /bass/.test(fx.id) ? "lowshelf" : /treble/.test(fx.id) ? "highshelf" : "peaking";
      const f = ctx.createBiquadFilter();
      f.type = shelf;
      f.frequency.value = shelf === "lowshelf" ? 160 : shelf === "highshelf" ? 4200 : 1200;
      f.gain.value = (p0(0) - 0.5) * 24 * amount;
      f.Q.value = 0.9;
      node.connect(f);
      node = f;
      break;
    }
    case "dynamics": {
      const c = ctx.createDynamicsCompressor();
      const amt = p0(0);
      if (fx.id === "limiter") {
        c.threshold.value = -6; c.ratio.value = 20; c.knee.value = 0; c.attack.value = 0.003; c.release.value = 0.1;
      } else if (fx.id === "expander") {
        c.threshold.value = -30 + amt * 20; c.ratio.value = 1 + amt * 3; c.knee.value = 6; c.attack.value = 0.02; c.release.value = 0.25;
      } else {
        c.threshold.value = -24 + amt * 18; c.ratio.value = 2 + amt * 10; c.knee.value = 8; c.attack.value = 0.01; c.release.value = 0.2;
      }
      node.connect(c);
      node = c;
      break;
    }
    case "denoise": {
      const f = ctx.createBiquadFilter();
      if (/hum/.test(fx.id)) {
        f.type = "notch"; f.frequency.value = 50; f.Q.value = 12;
        f.gain.value = -18 * amount;
      } else if (/hiss|wind|dewind/.test(fx.id)) {
        f.type = "lowpass"; f.frequency.value = 900 + p0(0) * 5200; f.Q.value = 0.7;
      } else {
        f.type = "highpass"; f.frequency.value = 60 + p0(0) * 240; f.Q.value = 0.7;
      }
      node.connect(f);
      node = f;
      break;
    }
    case "modulation": {
      if (fx.id === "chorus") {
        const d1 = ctx.createDelay(0.06);
        d1.delayTime.value = 0.018 + p0(0) * 0.02;
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 0.7;
        lfoGain.gain.value = 0.004 + p0(1) * 0.006;
        lfo.connect(lfoGain);
        lfoGain.connect(d1.delayTime);
        lfos.push(lfo);
        const wet = ctx.createGain();
        wet.gain.value = 0.5 * amount;
        input.connect(output);
        input.connect(d1);
        d1.connect(wet);
        wet.connect(output);
        node = null;
      } else {
        const trem = ctx.createGain();
        trem.gain.value = 1;
        const lfo = ctx.createOscillator();
        const depth = ctx.createGain();
        lfo.frequency.value = 2 + p0(0) * 10;
        depth.gain.value = 0.35 * amount;
        lfo.connect(depth);
        depth.connect(trem.gain);
        lfos.push(lfo);
        node.connect(trem);
        node = trem;
      }
      break;
    }
    case "voice": {
      const fmt = ctx.createBiquadFilter();
      fmt.type = "peaking";
      fmt.Q.value = 1.4;
      const shift = { chipmunk: 1.7, helium: 1.6, child: 1.35, woman: 1.18, man: 0.82,
        husky: 0.86, robot: 1.0, robot2: 1.0, transformers: 0.7, radio: 1.0,
        phone: 1.0, water: 1.1 }[fx.id.replace("voice_change_", "")] || 1;
      fmt.frequency.value = 700 * Math.max(0.4, shift);
      fmt.gain.value = (shift - 1) * 10 * amount;
      const lp = ctx.createBiquadFilter();
      lp.type = shift > 1 ? "highpass" : "lowpass";
      lp.frequency.value = shift > 1 ? 220 : 3200;
      node.connect(fmt);
      fmt.connect(lp);
      node = lp;
      break;
    }
    case "bandpass": {
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = fx.id === "phone" ? 320 : 480;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = fx.id === "phone" ? 3400 : 5200;
      const peak = ctx.createBiquadFilter();
      peak.type = "peaking";
      peak.frequency.value = 1600;
      peak.gain.value = 6 * amount;
      peak.Q.value = 1.2;
      node.connect(hp); hp.connect(lp); lp.connect(peak);
      node = peak;
      break;
    }
    case "duck": {
      const g = ctx.createGain();
      g.gain.value = Math.max(0.1, 1 - p0(0) * 0.75 * amount);
      node.connect(g);
      node = g;
      break;
    }
    case "stereo": {
      const split = ctx.createChannelSplitter(2);
      const merge = ctx.createChannelMerger(2);
      const dL = ctx.createDelay(0.05);
      dL.delayTime.value = 0.004 + p0(0) * 0.02;
      node.connect(split);
      split.connect(merge, 0, 0);
      split.connect(dL);
      dL.connect(merge, 0, 1);
      node = merge;
      break;
    }
    case "clarity": {
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 90;
      const presence = ctx.createBiquadFilter();
      presence.type = "peaking";
      presence.frequency.value = 2600;
      presence.Q.value = 1.1;
      presence.gain.value = 3 + p0(0) * 7 * amount;
      node.connect(hp);
      hp.connect(presence);
      node = presence;
      break;
    }
    case "gain":
    default: {
      const g = ctx.createGain();
      g.gain.value = 0.4 + p0(0) * 1.2;
      node.connect(g);
      node = g;
      break;
    }
  }

  if (node && node !== input) node.connect(output);
  else if (node === input) input.connect(output);

  return { input, output, lfos };
}

/* -------------------------------------------------- apply chain to element -- */
function signatureOf(list) {
  return JSON.stringify(list.map((f) => [f.id, f.level ?? 1]));
}

export function syncElementFx(el, mediaUrl, fxList) {
  const g = ensureGraph(el, mediaUrl);
  if (!g) return false;
  const list = Array.isArray(fxList) ? fxList : [];
  const sig = signatureOf(list);
  if (g.sig === sig) return true;
  g.sig = sig;
  // tear down the old chain
  g.nodes.forEach((n) => { try { n.input.disconnect(); n.output.disconnect(); } catch { /* */ } });
  g.nodes.forEach((n) => n.lfos.forEach((l) => { try { l.stop(); l.disconnect(); } catch { /* */ } }));
  g.nodes = [];
  try { g.fxIn.disconnect(); } catch { /* */ }
  g.fxIn.connect(g.fxOut);
  if (!list.length) return true;

  let tail = g.fxIn;
  for (const item of list) {
    const def = effectById(item.id);
    if (!def) continue;
    const built = buildEffect(g.ctx, def, item.level ?? 1);
    tail.connect(built.input);
    built.lfos.forEach((l) => { try { l.start(); } catch { /* */ } });
    g.nodes.push(built);
    tail = built.output;
  }
  tail.connect(g.fxOut);
  return true;
}

/* ------------------------------------------------------------- audition ----- */
/* Play a short synthesised sweep through the chain so a preset can be heard
 * without touching the timeline. Used by the rack's preview button. */
let auditionNodes = null;

export function stopAudition() {
  if (!auditionNodes) return;
  const { src, nodes } = auditionNodes;
  try { src.stop(); } catch { /* */ }
  nodes.forEach((n) => n.lfos.forEach((l) => { try { l.stop(); } catch { /* */ } }));
  auditionNodes = null;
}

export function audition(fxList, seconds = 2.2) {
  stopAudition();
  const ctx = audioContext();
  if (!ctx) return false;
  resumeAudio();
  const list = (Array.isArray(fxList) ? fxList : []).map((f) => ({ ...effectById(f.id), ...f })).filter((f) => f.params !== undefined);
  const src = ctx.createOscillator();
  src.type = "sawtooth";
  const env = ctx.createGain();
  const out = ctx.createGain();
  out.gain.value = 0.16;
  env.gain.value = 0;
  const now = ctx.currentTime;
  /* Clamp: a very short (or missing) length used to push `now + seconds - 0.25`
   * below zero, which throws RangeError in setValueAtTime. Keep the envelope
   * monotonic — attack < sustain < release — for any input. */
  const dur = Math.max(0.6, Number.isFinite(seconds) ? seconds : 2.2);
  const attack = Math.min(0.08, dur * 0.2);
  const release = Math.min(0.25, dur * 0.35);
  const hold = now + Math.max(dur - release, attack);
  env.gain.linearRampToValueAtTime(1, now + attack);
  env.gain.setValueAtTime(1, hold);
  env.gain.linearRampToValueAtTime(0, now + dur);
  // a little movement so reverb/delay are audible
  src.frequency.setValueAtTime(180, now);
  src.frequency.linearRampToValueAtTime(420, now + dur * 0.5);
  src.frequency.linearRampToValueAtTime(220, now + dur);

  let tail = env;
  const nodes = [];
  for (const item of list) {
    const built = buildEffect(ctx, item, item.level ?? 1);
    tail.connect(built.input);
    built.lfos.forEach((l) => { try { l.start(); } catch { /* */ } });
    nodes.push(built);
    tail = built.output;
  }
  src.connect(env);
  tail.connect(out);
  out.connect(ctx.destination);
  src.start(now);
  src.stop(now + dur + 0.05);
  auditionNodes = { src, nodes };
  src.onended = () => { if (auditionNodes?.src === src) auditionNodes = null; };
  return true;
}

/* ------------------------------------------------------------- defaults ----- */
export function defaultParams(id) {
  const e = effectById(id);
  if (!e) return {};
  const out = {};
  e.params.forEach((p) => { out[p.n] = p.def; });
  return out;
}

export function audioEffectsById(ids) {
  return ids.map((id) => effectById(id)).filter(Boolean);
}
