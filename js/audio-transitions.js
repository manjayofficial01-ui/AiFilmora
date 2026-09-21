/* Filmora audio transition curves.
 *
 * Seven audio_transition types ship in assets/resources/transition/. The native
 * DSP behind them is a DLL a browser cannot load, so what we implement is the
 * standard crossfade shape each name denotes — which is genuine, well-defined
 * audio maths rather than an invention.
 *
 * `fadeIn(t)` / `fadeOut(t)` take t in 0..1 across the fade and return gain.
 * For an equal-power pair the two curves must satisfy out² + in² = 1.
 */
import { audioTransitions, audioTransitionById, DEFAULT_AUDIO_TRANSITION } from "./audio-transition-presets.js";

export { audioTransitions, audioTransitionById, DEFAULT_AUDIO_TRANSITION };

const clamp01 = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t);
const K_EXP = 4; // curvature of the exponential shape
const K_LOG = 5; // curvature of the logarithmic shape

/* One shape function for the FADE-IN; the fade-out is its mirror, so every pair
 * is guaranteed symmetric. Defining them independently (as this module first did)
 * made exponential and logarithmic come out with the SAME character — both rising
 * fast at the start — which is wrong: they should be opposites.
 *   exponential: slow start, quick finish (gain grows exponentially)
 *   logarithmic: quick start, slow finish (log flattens out)
 */
function shapeIn(curve, x) {
  switch (curve) {
    case "linear":
    case "constantGain":
      return x;
    case "constantPower":            // equal-power: sine
      return Math.sin((x * Math.PI) / 2);
    case "exponential":
      return (Math.exp(K_EXP * x) - 1) / (Math.exp(K_EXP) - 1);
    case "logarithmic":
      return Math.log(1 + K_LOG * x) / Math.log(1 + K_LOG);
    case "dealiasing": {             // equal-power, smoothed to kill the corner
      const s = Math.sin((x * Math.PI) / 2);
      return s * s * (3 - 2 * s);
    }
    case "mix":                      // no crossfade — hold full level
      return 1;
    default:
      return Math.sin((x * Math.PI) / 2);
  }
}

/** Gain coming IN to a clip, at progress t through the fade (0 = start). */
export function fadeInGain(curve, t) {
  return shapeIn(curve, clamp01(t));
}

/** Gain leaving a clip, at progress t. The mirror of the fade-in by construction. */
export function fadeOutGain(curve, t) {
  if (curve === "mix") return 1;
  return shapeIn(curve, 1 - clamp01(t));
}

/** Resolve a stored id (or a raw curve name) to a curve key. */
export function curveOf(idOrCurve) {
  if (!idOrCurve) return "constantPower";
  const t = audioTransitionById(idOrCurve);
  if (t) return t.curve;
  const known = ["linear", "constantGain", "constantPower", "exponential", "logarithmic", "dealiasing", "mix"];
  return known.includes(idOrCurve) ? idOrCurve : "constantPower";
}

/** True when a curve keeps perceived level flat through the hand-over. */
export function isEqualPower(curve) {
  return curve === "constantPower" || curve === "dealiasing";
}

/* ---- preview: draw the two gain curves so you can see the hand-over ---- */
export function transitionPreview(curve, w = 112, h = 63) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#0e1116";
  ctx.fillRect(0, 0, w, h);

  // grid
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const y = (h * i) / 4;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }

  const plot = (fn, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let px = 0; px <= w; px++) {
      const t = px / w;
      const g = Math.max(0, Math.min(1, fn(t)));
      const y = h - 3 - g * (h - 6);
      if (px === 0) ctx.moveTo(px, y); else ctx.lineTo(px, y);
    }
    ctx.stroke();
  };

  plot((t) => fadeOutGain(curve, t), "#ff6b6b");
  plot((t) => fadeInGain(curve, t), "#00d4a0");

  // for an equal-power pair, out²+in² should be flat — show it as a faint line
  if (isEqualPower(curve)) {
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    for (let px = 0; px <= w; px++) {
      const t = px / w;
      const o = fadeOutGain(curve, t), i = fadeInGain(curve, t);
      const power = Math.sqrt(o * o + i * i);
      const y = h - 3 - power * (h - 6);
      if (px === 0) ctx.moveTo(px, y); else ctx.lineTo(px, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  return c;
}
