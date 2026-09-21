/* filmora-presets.js — the rest of the Filmora asset libraries.
 *
 * assets/configs and assets/resources ship several hundred named presets that
 * were previously invisible to the app:
 *
 *   150 animations  configs/AnimationNew/<uuid>/info.json   scene_in / scene_out / scene_loop
 *    48 text styles configs/TextStyle/*.png                 real thumbnail per style
 *    98 text art    configs/TextArt/<name>/
 *    86 motion      configs/Motion/<name>.conf
 *   192 filters     resources/wfx_effect/nle_default/       Filmora's built-in looks
 *    10 masks       configs/MaskPreset/
 *     4 transitions configs/Transition/Default Transitions/ with thumbnail + preview video
 *
 * Filmora's native preset bodies are .conf/.frag/.cl (GPU shaders) — not loadable
 * here. What IS loadable, and what we use, is the published metadata: names,
 * categories, parameter ranges and (for text styles and transitions) real
 * thumbnails. Animation titles are mapped onto CSS-equivalent envelopes.
 */
import {
  ANIMATION_PRESETS,
  TEXT_STYLES,
  MOTION_PRESETS,
  TEXT_ART_PRESETS,
  FILTER_PRESETS,
  MASK_PRESETS,
  TRANSITION_PRESETS,
} from "./filmora-library.js";

/* ------------------------------------------------------------ animations --- */
export const ANIM_KINDS = [
  { id: "in", cat: "animation_scene_in", label: "In" },
  { id: "out", cat: "animation_scene_out", label: "Out" },
  { id: "loop", cat: "animation_scene_loop", label: "Loop" },
];

export function animationsOf(kind) {
  const k = ANIM_KINDS.find((x) => x.id === kind);
  if (!k) return [];
  return ANIMATION_PRESETS.filter((a) => a.cat === k.cat)
    .map((a) => ({ ...a, kind }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function animationById(id) {
  const a = ANIMATION_PRESETS.find((x) => x.id === id);
  if (!a) return null;
  const k = ANIM_KINDS.find((x) => x.cat === a.cat);
  return { ...a, kind: k ? k.id : "in" };
}

export function animationCounts() {
  const out = {};
  ANIM_KINDS.forEach((k) => { out[k.id] = animationsOf(k.id).length; });
  return out;
}

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t) => t * t * t;
const easeOutBack = (t) => {
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/**
 * Map a Filmora animation title onto a transform/opacity envelope.
 * `p` is 0..1 progress through the animation; `kind` decides the direction.
 * Returns { x, y, scale, rotation, alpha, blur } as *multipliers / offsets*.
 */
export function animEnvelope(title, kind, p) {
  const t = Math.min(1, Math.max(0, p));
  const T = (s) => String(title || "").toLowerCase().includes(s);
  // "in" plays forwards from hidden, "out" plays forwards to hidden
  const q = kind === "out" ? 1 - t : t;
  const e = kind === "out" ? easeInCubic(t) : easeOutCubic(t);
  const eb = kind === "out" ? t : easeOutBack(t);

  let x = 0, y = 0, scale = 1, rotation = 0, alpha = 1, blur = 0;

  if (T("fade") || T("appears") || T("disappears") || T("gradually")) {
    alpha = q;
    if (T("gradually")) scale = 0.92 + 0.08 * q;
  } else if (T("zoom in")) {
    scale = 0.6 + 0.4 * (T("bounce") ? eb : e);
    alpha = Math.min(1, q * 1.6);
  } else if (T("zoom out")) {
    scale = 1.4 - 0.4 * (T("bounce") ? eb : e);
    alpha = Math.min(1, q * 1.6);
  } else if (T("rotate")) {
    rotation = (T("clockwise") ? 1 : -1) * (1 - e) * 90;
    scale = 0.7 + 0.3 * e;
    alpha = Math.min(1, q * 1.5);
  } else if (T("slide") || T("push") || T("move")) {
    const dist = (1 - e) * 0.9;
    if (T("left")) x = -dist; else if (T("right")) x = dist;
    else if (T("up") || T("top")) y = -dist; else if (T("down") || T("bottom")) y = dist;
    else x = -dist;
    alpha = Math.min(1, q * 2);
  } else if (T("flip")) {
    scale = T("horizontal") || T("x") ? Math.max(0.02, Math.abs(2 * e - 1)) : 1;
    rotation = T("vertical") ? 90 * (1 - e) : 0;
    alpha = Math.min(1, q * 1.4);
  } else if (T("blur")) {
    blur = (1 - q) * 12;
    alpha = q;
  } else if (T("bounce")) {
    scale = 0.85 + 0.15 * eb;
    alpha = Math.min(1, q * 1.6);
  } else if (T("spin") || T("swirl") || T("twist")) {
    rotation = (1 - e) * 360 * (T("counter") ? -1 : 1);
    scale = 0.5 + 0.5 * e;
    alpha = Math.min(1, q * 1.5);
  } else {
    // generic "appearing / disappearing" — scale + fade
    scale = 0.88 + 0.12 * e;
    alpha = q;
  }

  if (kind === "loop") {
    // loop presets cycle rather than ramp
    const w = Math.sin(t * Math.PI * 2);
    if (T("zoom")) scale = 1 + 0.06 * w;
    else if (T("rotate") || T("spin")) rotation = w * 8;
    else if (T("slide") || T("move")) x = 0.03 * w;
    else alpha = 0.82 + 0.18 * (w * 0.5 + 0.5);
  }

  return { x, y, scale, rotation, alpha, blur };
}

/* ------------------------------------------------------------ text styles -- */
export function textStyles() {
  return TEXT_STYLES.map((s) => ({
    id: s.name,
    label: s.name.replace(/^Text style /i, "").replace(/^(\d+)$/, "Style $1"),
    thumb: s.thumb,
  }));
}

export function textArtPresets() {
  return TEXT_ART_PRESETS.map((n) => ({ id: n, label: n }));
}

/* ---------------------------------------------------------------- motion --- */
export function motionPresets() {
  return MOTION_PRESETS.map((n) => ({ id: n, label: n }));
}

/* --------------------------------------------------------------- filters --- */
export function filterPresets() {
  return FILTER_PRESETS.map((n) => ({ id: n, label: n }));
}

/* ----------------------------------------------------------------- masks --- */
export function maskPresets() {
  return [
    { id: "none", label: "No mask" },
    ...MASK_PRESETS.map((m) => ({ id: m.id, label: m.name })),
  ];
}

/* ----------------------------------------------------------- transitions --- */
export function transitionPresets() {
  return TRANSITION_PRESETS.map((t) => ({ ...t }));
}

/* ---------------------------------------------------------------- counts --- */
export function presetCounts() {
  return {
    animations: ANIMATION_PRESETS.length,
    textStyles: TEXT_STYLES.length,
    textArt: TEXT_ART_PRESETS.length,
    motion: MOTION_PRESETS.length,
    filters: FILTER_PRESETS.length,
    masks: MASK_PRESETS.length,
    transitions: TRANSITION_PRESETS.length,
  };
}
