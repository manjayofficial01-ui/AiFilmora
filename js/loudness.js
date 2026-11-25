/* loudness.js — real ITU-R BS.1770-4 integrated loudness measurement.
 *
 * The volume panel used to "normalise" a clip by turning a typed LUFS number
 * into a made-up gain (−23 → quieter, −10 → louder) without ever looking at
 * the audio. That number was fiction: nothing in the app measured anything.
 * This module replaces the guess with a measurement of the decoded PCM:
 *
 *   • K-weighting — a high-shelf pre-filter cascaded with the RLB high-pass,
 *     using the coefficient sets published in BS.1770-4 (48 kHz).
 *   • 400 ms blocks with 75 % overlap (100 ms hop).
 *   • An absolute gate at −70 LUFS, then a relative gate 10 LU below the mean
 *     power of the absolute-gated blocks.
 *   • L = −0.691 + 10·log10( Σ_ch G_ch · z_ch ), integrated over the blocks
 *     that survive both gates.
 *
 * The sample peak is returned alongside the loudness because a gain change is
 * only safe while the peak stays below full scale.
 *
 * No browser globals are referenced at module scope, so the module can be
 * imported from a plain Node process (tooling, smoke tests) without a DOM.
 */

/* ---------------------------------------------------------------- constants -- */

/* The BS.1770-4 K-weighting coefficients are published for 48 kHz only, so
 * everything is measured at 48 kHz rather than redesigning the filters for
 * whatever rate a file happens to carry. */
const TARGET_RATE = 48000;

const BLOCK_SAMPLES = Math.round(0.4 * TARGET_RATE); // 400 ms gating block
const HOP_SAMPLES = Math.round(0.1 * TARGET_RATE);   // 75 % overlap
const ABSOLUTE_GATE_LUFS = -70;      // blocks below this are discarded outright
const RELATIVE_GATE_OFFSET = -10;    // keep blocks within 10 LU of the mean
const LOUDNESS_OFFSET = -0.691;      // the constant BS.1770 adds to every block
const PEAK_CEILING_DBFS = -1;        // where a peak-limited gain lands

/* BS.1770-4 stage 1 — high-shelf pre-filter ("K-weighting", 48 kHz). */
const STAGE1_B = [1.53512485958697, -2.69169618940638, 1.19839281085285];
const STAGE1_A = [1, -1.69065929318241, 0.73248077421585];

/* BS.1770-4 stage 2 — RLB high-pass (48 kHz). */
const STAGE2_B = [1, -2, 1];
const STAGE2_A = [1, -1.99004745483398, 0.99007225036621];

/* BS.1770-4 Table 3: L 1.0, R 1.0, C 1.0, Ls 1.41, Rs 1.41. The LFE channel
 * carries weight 0 — it is excluded from the measurement entirely. */
const SURROUND_WEIGHTS = [1, 1, 1, 0, 1.41, 1.41];

const FETCH_TIMEOUT_MS = 15000;
const DECODE_TIMEOUT_MS = 20000;
const PROBE_TIMEOUT_MS = 6000;

/* ------------------------------------------------------------------ targets -- */

/* The loudness targets the volume panel offers. "As mixed" has no numeric
 * target — it means "leave the clip alone". */
export const LUFS_TARGETS = [
  { id: "mixed", label: "As mixed", lufs: null },
  { id: "web", label: "−14 LUFS · web, YouTube", lufs: -14 },
  { id: "podcast", label: "−16 LUFS · podcasts", lufs: -16 },
  { id: "broadcast", label: "−23 LUFS · broadcast", lufs: -23 },
];

/* --------------------------------------------------------------- small math -- */

/** dB → linear amplitude gain. */
export function dbToGain(db) {
  const v = Number(db);
  if (!Number.isFinite(v)) return v === -Infinity ? 0 : 1;
  return Math.pow(10, v / 20);
}

/** Linear amplitude gain → dB. A gain of zero (or less) is −∞ dB. */
export function gainToDb(gain) {
  const v = Number(gain);
  if (!(v > 0)) return -Infinity;
  return 20 * Math.log10(v);
}

/* ------------------------------------------------------------- measurement -- */

/** Uniform failure envelope — every public entry point answers in this shape. */
function failure(error, samplePeak = null) {
  return { ok: false, lufs: null, samplePeak, error: String(error) };
}

/**
 * Direct-form IIR biquad, applied in place on a copy of the input.
 * Written out longhand instead of using an AudioWorklet because the module
 * has to run outside a DOM (Node smoke tests) and because the arithmetic is
 * the part that must be auditable against the standard.
 */
function biquad(input, b, a) {
  const out = new Float64Array(input.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let n = 0; n < input.length; n++) {
    const x = input[n];
    const y = b[0] * x + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
    x2 = x1; x1 = x;
    y2 = y1; y1 = y;
    out[n] = y;
  }
  return out;
}

/** K-weighting = stage 1 (shelf) followed by stage 2 (RLB high-pass). */
function kWeight(channels) {
  return channels.map((ch) => biquad(biquad(ch, STAGE1_B, STAGE1_A), STAGE2_B, STAGE2_A));
}

/**
 * Resample to the 48 kHz the published coefficients assume.
 *
 * Linear interpolation is used rather than an OfflineAudioContext because the
 * measurement must give the same number in the browser, in Electron and in a
 * plain Node process — an offline render would make the result depend on the
 * host. The resampling error sits above the audio band that the K-weighting
 * shelf cares about, so it does not move the integrated figure measurably.
 */
function resampleToTargetRate(channels, srcRate) {
  if (srcRate === TARGET_RATE) return channels;
  const srcLen = channels[0]?.length || 0;
  const outLen = Math.max(1, Math.round((srcLen * TARGET_RATE) / srcRate));
  const step = srcRate / TARGET_RATE; // input samples per output sample
  return channels.map((src) => {
    const dst = new Float64Array(outLen);
    const last = src.length - 1;
    for (let i = 0; i < outLen; i++) {
      const pos = i * step;
      const i0 = Math.floor(pos);
      const a = i0 <= last ? src[i0] : src[last] || 0;
      const b = i0 < last ? src[i0 + 1] : a;
      dst[i] = a + (b - a) * (pos - i0);
    }
    return dst;
  });
}

/** BS.1770-4 Table 3 weights for the channel count we actually have. */
function channelWeights(count) {
  const w = [];
  for (let i = 0; i < count; i++) w.push(count === 6 ? SURROUND_WEIGHTS[i] : 1);
  return w;
}

/**
 * Mean square per block per channel, then the weighted block power
 * P_b = Σ_ch G_ch · z_ch (the quantity BS.1770 takes the log of).
 */
function blockPowers(channels, weights) {
  const length = channels[0]?.length || 0;
  const blockSize = Math.min(BLOCK_SAMPLES, length);
  // Only complete blocks take part; a signal shorter than one block is
  // measured as a single (shorter) block, which is what a user expects from
  // a one-second clip.
  const blockCount = length > blockSize
    ? 1 + Math.floor((length - blockSize) / HOP_SAMPLES)
    : 1;
  const samplesPerBlock = length > blockSize ? blockSize : length;

  const powers = new Float64Array(blockCount);
  for (let ch = 0; ch < channels.length; ch++) {
    const data = channels[ch];
    const weight = weights[ch] ?? 1;
    if (!weight) continue;
    let sum = 0;
    for (let i = 0; i < samplesPerBlock; i++) sum += data[i] * data[i];
    powers[0] += (weight * sum) / samplesPerBlock;
    // Slide the window one hop at a time instead of re-summing every block:
    // a long file is then touched roughly once instead of four times.
    for (let b = 1; b < blockCount; b++) {
      const leaving = (b - 1) * HOP_SAMPLES;
      const entering = leaving + blockSize;
      // The window only advances by one hop, so exactly one hop of samples
      // leaves it and one hop of samples joins it.
      for (let i = leaving; i < leaving + HOP_SAMPLES; i++) sum -= data[i] * data[i];
      for (let i = entering; i < entering + HOP_SAMPLES; i++) sum += data[i] * data[i];
      powers[b] += (weight * sum) / samplesPerBlock;
    }
  }
  return powers;
}

/**
 * Integrated loudness of decoded PCM, ITU-R BS.1770-4.
 *
 * @param {{sampleRate:number, length:number, numberOfChannels:number, getChannelData:Function}} audioBuffer
 * @returns {{ok:boolean, lufs:number|null, samplePeak:number|null, samplePeakDb?:number, error?:string}}
 */
export function measureLufs(audioBuffer) {
  try {
    if (!audioBuffer || typeof audioBuffer.getChannelData !== "function") {
      return failure("not an audio buffer");
    }
    const channelCount = Math.floor(Number(audioBuffer.numberOfChannels) || 0);
    const length = Math.floor(Number(audioBuffer.length) || 0);
    const sampleRate = Number(audioBuffer.sampleRate) || 0;
    if (!channelCount || !length || !(sampleRate > 0)) {
      return failure("the audio buffer is empty");
    }

    // Read the channels once: the sample peak is measured on the untouched
    // source, because a peak is a property of the file, not of the filter.
    const raw = [];
    let samplePeak = 0;
    for (let ch = 0; ch < channelCount; ch++) {
      let data = null;
      try { data = audioBuffer.getChannelData(ch); } catch { data = null; }
      if (!data || !data.length) continue;
      raw.push(data);
      for (let i = 0; i < data.length; i++) {
        const v = data[i] < 0 ? -data[i] : data[i];
        if (v > samplePeak) samplePeak = v;
      }
    }
    if (!raw.length) return failure("no readable channel data", samplePeak);

    const resampled = resampleToTargetRate(raw, sampleRate);
    const weighted = kWeight(resampled);
    const powers = blockPowers(weighted, channelWeights(weighted.length));

    // Absolute gate: anything quieter than −70 LUFS is not programme material.
    const absolute = [];
    for (const p of powers) {
      const l = LOUDNESS_OFFSET + 10 * Math.log10(p);
      if (l > ABSOLUTE_GATE_LUFS) absolute.push(p);
    }
    if (!absolute.length) {
      return failure("the signal is below the −70 LUFS absolute gate", samplePeak);
    }

    // Relative gate: keep the blocks that sit within 10 LU of the mean power
    // of the absolute-gated blocks. Working in power (not dB) is what the
    // standard asks for — averaging dB values would bias the result low.
    let absSum = 0;
    for (const p of absolute) absSum += p;
    // Γ_r − 10 LU in power terms is the mean power scaled by 10^(−10/10).
    const relThreshold =
      (absSum / absolute.length) * Math.pow(10, RELATIVE_GATE_OFFSET / 10);

    let kept = 0;
    let keptSum = 0;
    for (const p of powers) {
      if (p > relThreshold) { keptSum += p; kept++; }
    }
    // The gate can only empty the set in pathological cases (a single block
    // exactly at the threshold); falling back to the absolute-gated set keeps
    // the answer defined instead of returning −∞.
    if (!kept) { keptSum = absSum; kept = absolute.length; }

    const mean = keptSum / kept;
    const lufs = LOUDNESS_OFFSET + 10 * Math.log10(mean);
    if (!Number.isFinite(lufs)) {
      return failure("the measured loudness is not finite (silent signal)", samplePeak);
    }
    return { ok: true, lufs, samplePeak, samplePeakDb: gainToDb(samplePeak) };
  } catch (err) {
    return failure(String(err?.message || err));
  }
}

/* ---------------------------------------------------------------- gain calc -- */

/**
 * Gain that moves a measured loudness onto a target without clipping.
 *
 * @param {number} measuredLufs  the loudness that was measured
 * @param {number} targetLufs    the loudness that is wanted
 * @param {number} samplePeak    linear sample peak of the source; a negative
 *                               value is read as a dBFS peak instead
 * @returns {{ok:boolean, gainDb:number, clamped:boolean, error?:string}}
 */
export function gainForTarget(measuredLufs, targetLufs, samplePeak) {
  // null/undefined must not sneak through Number() — a missing measurement is
  // an error, not a loudness of 0.
  if (measuredLufs === null || measuredLufs === undefined) {
    return { ok: false, gainDb: 0, clamped: false, error: "no measured loudness" };
  }
  if (targetLufs === null || targetLufs === undefined) {
    return { ok: false, gainDb: 0, clamped: false, error: "no loudness target" };
  }
  const measured = Number(measuredLufs);
  const target = Number(targetLufs);
  if (!Number.isFinite(measured)) {
    return { ok: false, gainDb: 0, clamped: false, error: "no measured loudness" };
  }
  if (!Number.isFinite(target)) {
    return { ok: false, gainDb: 0, clamped: false, error: "no loudness target" };
  }

  // The peak argument is linear in the normal case; a negative value can only
  // be a dBFS figure, so accept both spellings.
  let peak = Number(samplePeak);
  if (!Number.isFinite(peak)) peak = 0;      // no peak information
  else if (peak < 0) peak = dbToGain(peak);   // negative = dBFS

  let gainDb = target - measured;
  let clamped = false;
  const peakDb = gainToDb(peak);
  // Only pull the gain back when the boosted signal would actually run past
  // full scale; then land the peak on −1 dBFS so there is headroom left.
  if (peak > 0 && peakDb + gainDb > 0) {
    const limit = PEAK_CEILING_DBFS - peakDb;
    if (limit < gainDb) {
      gainDb = limit;
      clamped = true;
    }
  }
  return { ok: true, gainDb, clamped };
}

/* ------------------------------------------------------------ media decoding -- */

let sharedContext = null;

/**
 * A single AudioContext reused across measurements. Creating one per file
 * leaks audio hardware handles in Chromium, and decoding is not hot enough to
 * justify the churn.
 */
function audioContext() {
  if (sharedContext) return sharedContext;
  const Ctor =
    (typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext)) ||
    (typeof AudioContext !== "undefined" && AudioContext) ||
    null;
  if (!Ctor) return null;
  try {
    sharedContext = new Ctor();
  } catch {
    sharedContext = null;
  }
  return sharedContext;
}

/** Release the shared decoding context (the editor does this on teardown). */
export function closeLoudnessContext() {
  const ctx = sharedContext;
  sharedContext = null;
  try { ctx?.close?.(); } catch { /* ignore */ }
  return true;
}

/** fetch() → ArrayBuffer with a hard timeout. */
async function fetchAudioBytes(url) {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl
    ? setTimeout(() => { try { ctrl.abort(); } catch { /* ignore */ } }, FETCH_TIMEOUT_MS)
    : null;
  try {
    const res = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
    if (!res.ok) throw new Error(`the media could not be fetched (HTTP ${res.status})`);
    const bytes = await res.arrayBuffer();
    if (!bytes || !bytes.byteLength) throw new Error("the media file is empty");
    return bytes;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** decodeAudioData with both the callback and the promise contract covered. */
function decodeBuffer(ctx, bytes) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const ok = (buffer) => { if (!settled) { settled = true; resolve(buffer); } };
    const bad = (err) => { if (!settled) { settled = true; reject(err || new Error("the audio track could not be decoded")); } };
    try {
      const ret = ctx.decodeAudioData(bytes, ok, bad);
      if (ret && typeof ret.then === "function") ret.then(ok, bad);
    } catch (err) {
      bad(err);
    }
  });
}

/**
 * Ask a media element whether the browser can load the file at all.
 *
 * This is only used to turn an opaque "Failed to fetch" into a reason a user
 * can act on: a remote host without CORS headers fails here exactly like it
 * would taint a canvas. The element is asked for anonymous CORS so the
 * failure is a clean load error instead of a half-readable buffer.
 */
async function probeWithElement(url) {
  if (typeof document === "undefined") return null;
  return new Promise((resolve) => {
    let el;
    try { el = document.createElement("audio"); } catch { resolve(null); return; }
    const finish = (reason) => {
      try { el.onloadeddata = null; el.onerror = null; el.removeAttribute("src"); el.load?.(); } catch { /* ignore */ }
      resolve(reason);
    };
    const timer = setTimeout(() => finish("the media load timed out"), PROBE_TIMEOUT_MS);
    el.preload = "metadata";
    el.muted = true;
    if (!url.startsWith("blob:") && !url.startsWith("data:")) {
      el.crossOrigin = "anonymous";
    }
    el.onloadeddata = () => { clearTimeout(timer); finish("the media loaded"); };
    el.onerror = () => {
      clearTimeout(timer);
      finish("the media could not be loaded (CORS, revoked blob URL or unsupported codec)");
    };
    try { el.src = url; } catch { clearTimeout(timer); finish("the media source was rejected"); }
  });
}

/**
 * Measure the loudness of a media item.
 *
 * @param {{id?:string, kind?:string, url?:string, duration?:number, name?:string}} media
 * @returns {Promise<{ok:boolean, lufs:number|null, samplePeak:number|null, error?:string}>}
 */
export async function measureMediaLufs(media) {
  try {
    if (!media || typeof media !== "object") {
      return failure("no media item");
    }
    const url = typeof media.url === "string" ? media.url.trim() : "";
    if (!url) return failure("the media item has no url");
    if (media.kind && media.kind !== "audio" && media.kind !== "video") {
      return failure(`a ${media.kind} item has no audio to measure`);
    }

    let bytes;
    try {
      bytes = await fetchAudioBytes(url);
    } catch (err) {
      const detail = String(err?.message || err);
      const probe = await probeWithElement(url);
      return failure(probe && probe !== "the media loaded" ? `${detail} — ${probe}` : detail);
    }

    const ctx = audioContext();
    if (!ctx) return failure("Web Audio is not available in this environment");

    let buffer = null;
    try {
      buffer = await Promise.race([
        decodeBuffer(ctx, bytes),
        new Promise((_, reject) => setTimeout(() => reject(new Error("the audio decode timed out")), DECODE_TIMEOUT_MS)),
      ]);
    } catch (err) {
      return failure(String(err?.message || err));
    }
    if (!buffer || !buffer.length) return failure("the audio track is empty");
    return measureLufs(buffer);
  } catch (err) {
    return failure(String(err?.message || err));
  }
}
