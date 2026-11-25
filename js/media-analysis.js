/* media-analysis.js — real media understanding for AiFilmora.
 *
 * Until now the editor faked every media signal it drew: the timeline
 * waveform was a repeating-linear-gradient and the filmstrip was the single
 * poster frame captured at import time. This module extracts the two pieces
 * of ground truth the timeline actually needs:
 *
 *   • a filmstrip — evenly sampled JPEG frames taken from the real file
 *   • audio peaks — min/max envelopes decoded from the real audio track
 *
 * Everything here is defensive on purpose. A media item may point at a
 * revoked blob: URL, at a missing file (media._offline), at an "idb:"
 * placeholder whose bytes live in IndexedDB, at a codec Chromium cannot
 * decode, or at a file whose <video> never fires loadedmetadata. None of
 * those may throw into the render loop, so every public entry point answers
 * with an { ok, error } envelope instead.
 *
 * No browser globals are referenced at module scope, so the module can be
 * imported from a plain Node process (tooling, smoke tests) without a DOM.
 */

/* ---------------- tunables ---------------- */

const THUMB_W = 320;
const THUMB_H = 180;
const MAX_THUMBS = 32;
const METADATA_TIMEOUT_MS = 8000; // a wedged decoder must never hang the UI
const SEEK_TIMEOUT_MS = 2500;     // per frame; skipped frames are not fatal
const FETCH_TIMEOUT_MS = 8000;
const DECODE_TIMEOUT_MS = 8000;
const MAX_RESOLUTION = 2000;      // buckets/second; 2000 already over-samples

/* ---------------- caches ----------------
 * Analysis is expensive (seek + decode) and the timeline repaints often, so
 * results are memoised per media id. The cache stores the *same* array /
 * Float32Array instance on every hit so callers can compare by reference. */

const thumbCache = new Map();  // mediaId -> Array<{ t, url }>
const peakCache = new Map();   // mediaId -> { peaks, resolution, duration }
const inflight = new Map();    // "t:<id>" / "p:<id>" -> Promise

/* ---------------- small helpers ---------------- */

/** Yield to the event loop so a long extraction keeps the UI painting. */
function macrotask() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** True when the media item points at bytes we can actually read. */
function hasReadableSource(media) {
  if (!media || !media.url) return false;
  if (media._offline) return false;
  const url = String(media.url);
  // "idb:" urls are placeholders — the real bytes sit in IndexedDB and are
  // re-hydrated into a blob: URL before the timeline can use them.
  if (url.startsWith("idb:")) return false;
  return true;
}

/** Reject a promise that takes longer than ms to settle. */
function withTimeout(promise, ms, message) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/* ------------------------------------------------------------------ *
 * Frame extraction (filmstrip)
 * ------------------------------------------------------------------ */

/**
 * Whether this media can produce a filmstrip at all.
 * Demo/synthetic items have no url, so they keep the placeholder artwork.
 */
export function hasThumbnails(media) {
  try {
    if (!media || media.kind !== "video") return false;
    return hasReadableSource(media);
  } catch {
    return false;
  }
}

/**
 * Extract evenly spaced frames from a video.
 * @returns {Promise<{ok: boolean, thumbs: Array<{t:number,url:string}>, error?: string}>}
 */
export async function getThumbnails(media, { count = 8 } = {}) {
  const id = media?.id;
  try {
    if (!hasThumbnails(media)) {
      return { ok: false, thumbs: [], error: "no decodable video source" };
    }

    if (id && thumbCache.has(id)) {
      return { ok: true, thumbs: thumbCache.get(id) };
    }

    // Media without an id cannot be memoised, so it gets a throwaway slot to
    // make sure two anonymous items never share a result.
    const key = id ? `t:${id}` : `t:anon:${Math.random().toString(36).slice(2)}`;
    if (inflight.has(key)) return await inflight.get(key);

    const job = extractFrames(media, count).then(
      (res) => {
        inflight.delete(key);
        // Only successful extractions are memoised — a transient codec error
        // should be retryable on the next repaint.
        if (res.ok && id) thumbCache.set(id, res.thumbs);
        return res;
      },
      (err) => {
        inflight.delete(key);
        return { ok: false, thumbs: [], error: String(err?.message || err) };
      }
    );
    if (id) inflight.set(key, job);
    return await job;
  } catch (err) {
    return { ok: false, thumbs: [], error: String(err?.message || err) };
  }
}

/** Worker body for getThumbnails — never rejects. */
async function extractFrames(media, count) {
  const n = Math.max(1, Math.min(MAX_THUMBS, Math.floor(Number(count)) || 1));
  if (typeof document === "undefined") {
    return { ok: false, thumbs: [], error: "no DOM available" };
  }

  const url = String(media.url);
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  // Blob URLs are same-origin by construction. Remote files need CORS or the
  // canvas gets tainted and toDataURL throws a SecurityError — asking for
  // anonymous CORS up front turns that into a clean load error instead.
  if (!url.startsWith("blob:") && !url.startsWith("data:")) {
    video.crossOrigin = "anonymous";
  }

  let meta;
  try {
    meta = await waitForMetadata(video, url, METADATA_TIMEOUT_MS);
  } catch (err) {
    releaseVideo(video);
    return { ok: false, thumbs: [], error: String(err?.message || err) };
  }

  // Prefer the store's duration (it drives the timeline) and fall back to the
  // container's own duration when the metadata is missing or bogus.
  const mediaDur = Number(media.duration);
  let duration = Number.isFinite(mediaDur) && mediaDur > 0 ? mediaDur : 0;
  if (!duration && Number.isFinite(meta.duration) && meta.duration > 0) {
    duration = meta.duration;
  }
  if (!duration) {
    releaseVideo(video);
    return { ok: false, thumbs: [], error: "unknown media duration" };
  }

  const canvas = document.createElement("canvas");
  canvas.width = THUMB_W;
  canvas.height = THUMB_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    releaseVideo(video);
    return { ok: false, thumbs: [], error: "no 2d canvas context" };
  }

  const thumbs = [];
  try {
    for (let i = 0; i < n; i++) {
      // Sample mid-bucket so we never land on the very first (usually black)
      // frame, but keep the spacing perfectly even across the file.
      const t = duration * ((i + 0.5) / n);
      const seeked = await seekTo(video, t, SEEK_TIMEOUT_MS);
      if (!seeked) continue; // one undecodable frame is not fatal

      try {
        ctx.drawImage(video, 0, 0, THUMB_W, THUMB_H);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
        thumbs.push({ t: Math.round(t * 1000) / 1000, url: dataUrl });
      } catch (err) {
        // Tainted canvas (remote host without CORS headers) — bail out with a
        // readable reason instead of throwing into the timeline.
        return {
          ok: false,
          thumbs: [],
          error: `frame capture failed: ${String(err?.message || err)}`,
        };
      }

      // Yield between frames so a 30-frame strip never blocks a repaint.
      await macrotask();
    }
  } finally {
    releaseVideo(video);
  }

  if (!thumbs.length) {
    return { ok: false, thumbs: [], error: "no decodable frames" };
  }
  return { ok: true, thumbs };
}

/** Resolve once the video reports its metadata, or reject on error/timeout. */
function waitForMetadata(video, url, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;
    const done = (fn, arg) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      video.onloadedmetadata = null;
      video.onerror = null;
      fn(arg);
    };
    timer = setTimeout(() => done(reject, new Error("video metadata timeout")), timeoutMs);
    video.onloadedmetadata = () =>
      done(resolve, { duration: Number.isFinite(video.duration) ? video.duration : 0 });
    video.onerror = () => done(reject, new Error("video load error"));
    try {
      video.src = url;
    } catch (err) {
      done(reject, err);
    }
  });
}

/** Move the playhead to t; resolves false if the seek never completes. */
function seekTo(video, t, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    let timer = null;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      video.onseeked = null;
      video.onerror = null;
      resolve(ok);
    };
    timer = setTimeout(() => finish(false), timeoutMs);
    video.onseeked = () => finish(true);
    video.onerror = () => finish(false);
    try {
      video.currentTime = t;
    } catch {
      finish(false);
    }
  });
}

/** Detach the source so the decoder is not kept alive by a hidden element. */
function releaseVideo(video) {
  try {
    video.onloadedmetadata = null;
    video.onseeked = null;
    video.onerror = null;
    video.removeAttribute("src");
    try {
      video.load();
    } catch {
      /* ignore */
    }
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ *
 * Audio peaks (waveform)
 * ------------------------------------------------------------------ */

/**
 * Decode the audio track and reduce it to min/max buckets.
 * @returns {Promise<{ok: boolean, peaks: Float32Array|null, resolution: number, error?: string}>}
 */
export async function getPeaks(media, { resolution = 100 } = {}) {
  const id = media?.id;
  const res = Math.max(1, Math.min(MAX_RESOLUTION, Math.floor(Number(resolution)) || 100));
  try {
    if (!hasReadableSource(media)) {
      return { ok: false, peaks: null, resolution: res, error: "no audio source" };
    }

    if (id) {
      const hit = peakCache.get(id);
      // A cache entry only applies to the resolution it was built for.
      if (hit && hit.resolution === res) {
        return { ok: true, peaks: hit.peaks, resolution: hit.resolution };
      }
    }

    const key = id ? `p:${id}` : `p:anon:${Math.random().toString(36).slice(2)}`;
    if (inflight.has(key)) return await inflight.get(key);

    const job = buildPeaks(media, res).then(
      (result) => {
        inflight.delete(key);
        if (result.ok && id) {
          peakCache.set(id, {
            peaks: result.peaks,
            resolution: result.resolution,
            duration: result.duration,
          });
        }
        // Keep the public shape exactly { ok, peaks, resolution, error? }.
        return result.error
          ? { ok: false, peaks: null, resolution: result.resolution, error: result.error }
          : { ok: true, peaks: result.peaks, resolution: result.resolution };
      },
      (err) => {
        inflight.delete(key);
        return { ok: false, peaks: null, resolution: res, error: String(err?.message || err) };
      }
    );
    if (id) inflight.set(key, job);
    return await job;
  } catch (err) {
    return { ok: false, peaks: null, resolution: res, error: String(err?.message || err) };
  }
}

/** Worker body for getPeaks — never rejects. */
async function buildPeaks(media, resolution) {
  let buffer;
  try {
    buffer = await decodeAudio(String(media.url));
  } catch (err) {
    // No audio track, unsupported codec, revoked blob, offline file… all of
    // these are ordinary conditions, not exceptions worth propagating.
    return {
      ok: false,
      peaks: null,
      resolution,
      duration: 0,
      error: String(err?.message || err),
    };
  }

  const mediaDur = Number(media.duration);
  let duration = Number.isFinite(mediaDur) && mediaDur > 0 ? mediaDur : 0;
  if (!duration && Number.isFinite(buffer.duration) && buffer.duration > 0) {
    duration = buffer.duration;
  }
  if (!duration) {
    return { ok: false, peaks: null, resolution, duration: 0, error: "unknown media duration" };
  }

  const peaks = computePeaks(buffer, duration, resolution);
  return { ok: true, peaks, resolution, duration, error: undefined };
}

/**
 * Reduce an AudioBuffer to interleaved [min, max] buckets.
 * The buckets are normalised against the loudest bucket in the file so the
 * envelope keeps its real dynamics instead of clipping at ±1 everywhere.
 */
function computePeaks(buffer, duration, resolution) {
  const totalBuckets = Math.max(1, Math.ceil(duration * resolution));
  const mins = new Float32Array(totalBuckets);
  const maxs = new Float32Array(totalBuckets);

  const sampleRate = buffer.sampleRate || 44100;
  const length = buffer.length || 0;
  const channels = Math.max(1, buffer.numberOfChannels || 1);
  const bufferDuration =
    Number.isFinite(buffer.duration) && buffer.duration > 0 ? buffer.duration : length / sampleRate;
  // The decoded stream can be shorter or longer than the duration we were
  // handed, so bucket time is scaled into buffer time explicitly.
  const timeScale = duration > 0 && bufferDuration > 0 ? bufferDuration / duration : 1;

  for (let ch = 0; ch < channels; ch++) {
    let data;
    try {
      data = buffer.getChannelData(ch);
    } catch {
      continue;
    }
    for (let i = 0; i < length; i++) {
      const mediaTime = (i / sampleRate) / timeScale;
      let bucket = Math.floor(mediaTime * resolution);
      if (bucket < 0) bucket = 0;
      // Samples are time-ordered, so once we pass the end nothing later matters.
      if (bucket >= totalBuckets) break;
      const v = data[i];
      if (v < mins[bucket]) mins[bucket] = v;
      if (v > maxs[bucket]) maxs[bucket] = v;
    }
  }

  let peakAbs = 0;
  for (let b = 0; b < totalBuckets; b++) {
    const a = Math.max(Math.abs(mins[b]), Math.abs(maxs[b]));
    if (a > peakAbs) peakAbs = a;
  }
  const scale = peakAbs > 0 ? 1 / peakAbs : 0;

  const out = new Float32Array(totalBuckets * 2);
  for (let b = 0; b < totalBuckets; b++) {
    out[b * 2] = mins[b] * scale;
    out[b * 2 + 1] = maxs[b] * scale;
  }
  return out;
}

/** Fetch + decode the audio track into an AudioBuffer, then release the context. */
async function decodeAudio(url) {
  const Ctor =
    (typeof AudioContext !== "undefined" && AudioContext) ||
    (typeof webkitAudioContext !== "undefined" && webkitAudioContext) ||
    null;
  if (!Ctor) throw new Error("AudioContext unavailable");

  const bytes = await fetchArrayBuffer(url, FETCH_TIMEOUT_MS);
  const ctx = new Ctor();
  try {
    const buffer = await withTimeout(
      decodeBuffer(ctx, bytes),
      DECODE_TIMEOUT_MS,
      "audio decode timeout"
    );
    if (!buffer || !buffer.length) throw new Error("audio track is empty");
    return buffer;
  } finally {
    // Every decode gets a throwaway context: leaving them open leaks audio
    // hardware handles in Chromium.
    try {
      await ctx.close();
    } catch {
      /* ignore */
    }
  }
}

/** fetch() -> ArrayBuffer with a hard timeout. */
async function fetchArrayBuffer(url, timeoutMs) {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl
    ? setTimeout(() => {
        try {
          ctrl.abort();
        } catch {
          /* ignore */
        }
      }, timeoutMs)
    : null;
  try {
    const res = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
    if (!res.ok) throw new Error(`fetch failed: HTTP ${res.status}`);
    return await res.arrayBuffer();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** decodeAudioData with both the callback and the promise contract covered. */
function decodeBuffer(ctx, bytes) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const ok = (buffer) => {
      if (settled) return;
      settled = true;
      resolve(buffer);
    };
    const bad = (err) => {
      if (settled) return;
      settled = true;
      reject(err || new Error("audio decode failed"));
    };
    try {
      const ret = ctx.decodeAudioData(bytes, ok, bad);
      if (ret && typeof ret.then === "function") ret.then(ok, bad);
    } catch (err) {
      bad(err);
    }
  });
}

/* ------------------------------------------------------------------ *
 * Shared cache helpers
 * ------------------------------------------------------------------ */

/** Drop every cached analysis for one media id. */
export function clearAnalysisCache(mediaId) {
  try {
    thumbCache.delete(mediaId);
    peakCache.delete(mediaId);
    inflight.delete(`t:${mediaId}`);
    inflight.delete(`p:${mediaId}`);
    return true;
  } catch {
    return false;
  }
}

/** Drop everything — used when the project is reset or media is re-imported. */
export function clearAllAnalysisCache() {
  try {
    thumbCache.clear();
    peakCache.clear();
    inflight.clear();
    return true;
  } catch {
    return false;
  }
}

/** Number of media ids we are holding analysis for. */
export function getAnalysisCacheSize() {
  try {
    const ids = new Set();
    for (const key of thumbCache.keys()) ids.add(key);
    for (const key of peakCache.keys()) ids.add(key);
    return ids.size;
  } catch {
    return 0;
  }
}
