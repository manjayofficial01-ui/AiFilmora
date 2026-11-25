/* speed-ramp.js — speed-ramp maths.
 *
 * A clip's `speedRamp` is:
 *   { name, peak, curve: [m0 … mn], maintainPitch }
 * where `curve` holds ABSOLUTE playback-rate multipliers sampled evenly across
 * the clip (n points → n−1 segments). "Montage" is [1, 2.5, 1.5, 3, 1]:
 * five samples across the clip's length.
 *
 * Two invariants keep the model self-consistent:
 *   1. `clip.speed` is the MEAN of the curve. The player falls back to
 *      `clip.speed` when a clip carries no ramp, so the two must agree or the
 *      clip would change length the moment the ramp is removed.
 *   2. Changing the base rate scales the whole curve, so the profile shape
 *      survives and the clip still consumes the same source media.
 *
 * The curve is interpolated in LOG space with a smoothstep ease. A linear blend
 * between 1× and 4× spends most of its time near the slow end, which reads as
 * a stall; the log blend gives the even perceptual ramp an editor expects.
 */

export const MIN_SPEED = 0.25;
export const MAX_SPEED = 8;

/** Clamp a rate into the range the player and the store agree on. */
export function clampSpeed(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, n));
}

/** Normalised position → the curve's control-point index space. */
function segIndex(curve, p) {
  const n = curve.length;
  if (n === 1) return { i: 0, f: 0 };
  const x = Math.min(1, Math.max(0, p)) * (n - 1);
  const i = Math.min(n - 2, Math.floor(x));
  return { i, f: x - i };
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

/**
 * Speed multiplier at normalised clip position `p` (0…1).
 * Returns 1 when there is no usable curve.
 */
export function curveSpeedAt(curve, p) {
  if (!Array.isArray(curve) || curve.length === 0) return 1;
  const vals = curve.map((v) => clampSpeed(v));
  if (vals.length === 1) return vals[0];
  const { i, f } = segIndex(vals, p);
  const a = vals[i];
  const b = vals[i + 1];
  if (a === b) return a;
  const e = smoothstep(f);
  // Geometric (log-space) blend — see the module note.
  return Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * e);
}

/** Mean of the curve — the effective average rate across the clip. */
export function meanSpeed(curve) {
  if (!Array.isArray(curve) || curve.length === 0) return 1;
  const vals = curve.map((v) => clampSpeed(v));
  if (vals.length === 1) return vals[0];
  // Area under the piecewise-log curve, sampled evenly.
  const STEPS = 64;
  let sum = 0;
  for (let i = 0; i < STEPS; i++) {
    const p = (i + 0.5) / STEPS;
    sum += curveSpeedAt(vals, p);
  }
  return sum / STEPS;
}

/** Scale every control point — used when the base rate changes. */
export function scaleCurve(curve, factor) {
  if (!Array.isArray(curve)) return curve;
  const f = Number(factor);
  if (!Number.isFinite(f) || f === 1) return curve.slice();
  return curve.map((v) => clampSpeed(Number(v) * f));
}

/** Does this clip carry a usable ramp? */
export function hasRamp(clip) {
  return !!(clip && Array.isArray(clip.speedRamp?.curve) && clip.speedRamp.curve.length >= 2);
}

/** Effective rate at normalised clip position `p`. */
export function rampSpeedAt(clip, p) {
  if (!hasRamp(clip)) return clampSpeed(clip?.speed ?? 1);
  return curveSpeedAt(clip.speedRamp.curve, p);
}

/**
 * Media seconds consumed by the first `localT` seconds of the clip.
 *
 * With a constant rate this is `localT × speed`. With a ramp the rate varies,
 * so we integrate — Simpson's rule over 24 intervals, the same approach the
 * reference implementation uses.
 */
export function rampSourceTime(clip, localT) {
  const t = Math.max(0, Number(localT) || 0);
  if (!hasRamp(clip)) return t * clampSpeed(clip?.speed ?? 1);
  const dur = Math.max(0.001, Number(clip.duration) || 1);
  const N = 24; // even → Simpson
  const h = t / N;
  if (h === 0) return 0;
  const f = (u) => rampSpeedAt(clip, Math.min(1, u / dur));
  let sum = f(0) + f(t);
  for (let i = 1; i < N; i++) sum += f(i * h) * (i % 2 ? 4 : 2);
  return (h / 3) * sum;
}

/**
 * Source span a clip consumes over its whole timeline duration.
 * Used when applying a ramp so the clip keeps covering the same media.
 */
export function rampSourceSpan(clip) {
  return rampSourceTime(clip, Math.max(0.001, Number(clip?.duration) || 0));
}

/**
 * Describe a ramp for the UI — the profile as a readable string.
 */
export function describeCurve(curve) {
  if (!Array.isArray(curve) || !curve.length) return "";
  return curve.map((v) => `${(+v).toFixed(2)}×`).join(" → ");
}
