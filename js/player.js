/* Canvas preview engine */
import { store } from "./state.js";
import { mediaById, makeThumbDataURL } from "./media.js";
import { activeTransition, paintTransition } from "./transitions.js";
import { getEditingTextClipId } from "./canvas-edit.js";
import { drawShape } from "./shapes.js";
import { settings, applyLutToPixels } from "./settings.js";
import { drawCreativeClips, drawChaptersBar, isCreativeClip } from "./creative-tools.js";
import {
  isCubeLut,
  cubeLutName,
  getCachedLut,
  loadLut,
  applyLutToCanvasRegion,
} from "./lut-engine.js";
import { ensureGraph, graphFor, resumeAudio, syncElementFx } from "./audio-fx.js";
import { clipAnimTransform } from "./preset-ui.js";
import { colorPresetById } from "./color-presets.js";
import { applyColorGradeToCanvasRegion } from "./color-engine.js";
import { panZoomById, effectiveRect } from "./panzoom.js";
import { curveOf, fadeInGain, fadeOutGain, DEFAULT_AUDIO_TRANSITION } from "./audio-transitions.js";

const fillCache = new Map();
// Real media elements for imported files (video frames + audio beds).
// Thumb-only rendering was why "imported video could not be played".
const videoElCache = new Map(); // mediaId -> HTMLVideoElement
const audioElCache = new Map(); // mediaId -> HTMLAudioElement

function isPlayableUrl(u) {
  return typeof u === "string" && (u.startsWith("blob:") || u.startsWith("http") || u.startsWith("data:") || u.startsWith("file:"));
}

export function getVideoEl(media) {
  if (!media?.url || media._offline || !isPlayableUrl(media.url)) return null;
  if (media.kind !== "video") return null;
  let v = videoElCache.get(media.id);
  if (v && v.dataset.src !== media.url) {
    try { v.pause(); v.removeAttribute("src"); v.load(); } catch { /* ignore */ }
    videoElCache.delete(media.id);
    v = null;
  }
  if (!v) {
    v = document.createElement("video");
    v.preload = "auto";
    v.playsInline = true;
    // @ts-ignore
    v.playsinline = true;
    v.crossOrigin = "anonymous";
    v.muted = false;
    v.loop = false;
    v.dataset.src = media.url;
    v.src = media.url;
    try { v.load(); } catch { /* ignore */ }
    videoElCache.set(media.id, v);
  }
  return v;
}

export function getAudioEl(media) {
  if (!media?.url || media._offline || !isPlayableUrl(media.url)) return null;
  // Video-kind media counts: detached audio clips reference the video file
  // and an <audio> element plays just its sound track.
  if (media.kind !== "audio" && media.kind !== "video") return null;
  let a = audioElCache.get(media.id);
  if (a && a.dataset.src !== media.url) {
    try { a.pause(); a.removeAttribute("src"); a.load(); } catch { /* ignore */ }
    audioElCache.delete(media.id);
    a = null;
  }
  if (!a) {
    a = document.createElement("audio");
    a.preload = "auto";
    a.dataset.src = media.url;
    a.src = media.url;
    try { a.load(); } catch { /* ignore */ }
    audioElCache.set(media.id, a);
  }
  return a;
}

if (typeof window !== "undefined") {
  window.addEventListener("aifimora:media-removed", (e) => {
    (e.detail?.ids || []).forEach((id) => {
      const v = videoElCache.get(id);
      if (v) {
        const g = boostGraphs.get(v);
        if (g) { try { g.gain.disconnect(); } catch {} boostGraphs.delete(v); }
        try { v.pause(); v.removeAttribute("src"); v.load(); } catch {} videoElCache.delete(id);
      }
      const a = audioElCache.get(id);
      if (a) {
        const g = boostGraphs.get(a);
        if (g) { try { g.gain.disconnect(); } catch {} boostGraphs.delete(a); }
        try { a.pause(); a.removeAttribute("src"); a.load(); } catch {} audioElCache.delete(id);
      }
      fillCache.delete(id);
    });
  });
}

/* Boost-gain pipeline: HTMLMediaElement.volume caps at 1.0, so clip
   volume above 100% (up to 500% = 5x) runs through a Web Audio GainNode.
   Only built when actually needed and only for same-origin-safe URLs
   (blob:/data:/file: — i.e. local imports) to avoid CORS-silenced output. */
/* The graph now lives in audio-fx.js so the boost gain and the Filmora FX chain
 * share a single `createMediaElementSource` call — the Web Audio API allows
 * exactly one per element, so a second one would throw and mute the clip. */
const boostGraphs = { get: (el) => graphFor(el) };

function boostGainFor(el, mediaUrl) {
  try {
    const existing = graphFor(el);
    if (existing) return existing;
    return ensureGraph(el, mediaUrl);
  } catch {
    return null;
  }
}

/** Apply a 0..5 linear level to an element (gain node when > 1). */
function applyElementLevel(el, mediaUrl, total, muted) {
  const t = Math.max(0, Number(total) || 0);
  if (muted) {
    const g = boostGraphs.get(el);
    if (g) { try { g.gain.value = 0; } catch { /* ignore */ } }
    el.muted = true;
    return;
  }
  el.muted = false;
  if (t <= 1 && !boostGraphs.get(el)) {
    el.volume = Math.max(0, Math.min(1, t));
    return;
  }
  const rec = boostGainFor(el, mediaUrl);
  if (!rec) {
    el.volume = Math.max(0, Math.min(1, t));
    return;
  }
  try {
    el.volume = 1;
    resumeAudio();
    rec.gain.value = Math.max(0, Math.min(5, t));
  } catch {
    el.volume = Math.max(0, Math.min(1, t));
  }
}

function masterVolume() {
  try {
    const v = Number(document.getElementById("masterVolume")?.value);
    if (Number.isFinite(v)) return Math.max(0, Math.min(1, v / 100));
  } catch { /* ignore */ }
  return 0.8;
}

/** Media timestamp for a clip-local time (speed aware). Reverse = mirrored. */
function mediaTimeFor(clip, localT, mediaDur) {
  const speed = Math.max(0.25, Math.min(8, Number(clip.speed) || 1));
  let t = Math.max(0, localT) * speed;
  if (clip.reversed) {
    const src = Number.isFinite(mediaDur) && mediaDur > 0 ? mediaDur : clip.duration * speed;
    t = Math.max(0, src - t - 0.04);
  }
  if (Number.isFinite(mediaDur) && mediaDur > 0) t = Math.min(Math.max(0, mediaDur - 0.05), t);
  return t;
}

/* Interpolate a clip's Motion transform at local time t (keyframes if present). */
export function motionAt(clip, localT) {
  const m = clip.motion;
  if (!m) return { x: 0, y: 0, scale: 1, rotation: 0, alpha: 1, opacity: 100, anchorX: 0.5, anchorY: 0.5 };
  if (!m.keys || !m.keys.length) {
    return {
      x: m.x || 0,
      y: m.y || 0,
      scale: m.scale || 1,
      rotation: m.rotation || 0,
      alpha: m.opacity != null ? m.opacity / 100 : 1,
      opacity: m.opacity != null ? m.opacity : 100,
      anchorX: m.anchorX != null ? m.anchorX : 0.5,
      anchorY: m.anchorY != null ? m.anchorY : 0.5,
    };
  }
  // keyframe interpolation (linear per channel)
  const keys = [...m.keys].sort((a, b) => a.t - b.t);
  const dur = Math.max(clip.duration, 0.001);
  const t = Math.min(dur, Math.max(0, localT));
  const lerp = (a, b, k) => a + (b - a) * k;
  let a = keys[0], b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (t >= keys[i].t && t <= keys[i + 1].t) {
      a = keys[i];
      b = keys[i + 1];
      break;
    }
  }
  const span = (b.t - a.t) || 1;
  const k = Math.min(1, Math.max(0, (t - a.t) / span));
  const pick = (key) => (a[key] != null && b[key] != null ? lerp(a[key], b[key], k) : 0);
  return {
    x: pick("x"),
    y: pick("y"),
    scale: pick("scale") || 1,
    rotation: pick("rotation") || 0,
    alpha: pick("opacity") != null ? pick("opacity") / 100 : 1,
    opacity: pick("opacity") != null ? pick("opacity") : 100,
    anchorX: m.anchorX != null ? m.anchorX : 0.5,
    anchorY: m.anchorY != null ? m.anchorY : 0.5,
  };
}

/** Applies a clip's Motion transform (save + transform) when non-identity. Returns true if a save() was pushed (caller must restore). */
function applyMotionTransform(ctx, w, h, clip, localT) {
  if (!clip || clip.type === "text" || clip.shape) return false;
  const m = motionAt(clip, localT);
  if (m.scale === 1 && m.rotation === 0 && m.x === 0 && m.y === 0 && m.alpha >= 1) return false;
  const cx = m.anchorX * w;
  const cy = m.anchorY * h;
  ctx.save();
  ctx.translate(cx + m.x * w, cy + m.y * h);
  ctx.rotate((m.rotation * Math.PI) / 180);
  ctx.scale(m.scale, m.scale);
  ctx.translate(-cx, -cy);
  if (m.alpha < 1) ctx.globalAlpha *= Math.max(0, Math.min(1, m.alpha));
  return true;
}

/** Filmora-style imported 3D LUT post-process on the program output (downscaled for speed). */
function applyCustomLuts(ctx, w, h, state) {
  const ph = window.__aifimoraPlayhead || 0;
  const active = state.clips.find(
    (c) =>
      c.fx?.lut &&
      String(c.fx.lut).startsWith("custom:") &&
      ph >= c.start &&
      ph < c.start + c.duration
  );
  if (!active) return;
  const lutId = String(active.fx.lut).slice("custom:".length);
  const lut = settings.getLut(lutId);
  if (!lut) return;
  const maxW = 640;
  const sw = Math.min(w, maxW);
  const sh = Math.max(1, Math.round(sw * (h / w)));
  if (!lut._tmp) lut._tmp = document.createElement("canvas");
  lut._tmp.width = sw;
  lut._tmp.height = sh;
  const tctx = lut._tmp.getContext("2d");
  tctx.drawImage(ctx.canvas, 0, 0, sw, sh);
  const img = tctx.getImageData(0, 0, sw, sh);
  applyLutToPixels(img, lut);
  tctx.putImageData(img, 0, 0);
  ctx.drawImage(lut._tmp, 0, 0, sw, sh, 0, 0, w, h);
}

function getFillImage(media, seed) {
  const key = media?.id || `seed-${seed}`;
  if (fillCache.has(key)) return fillCache.get(key);
  // Imported images: draw the real file (url), not a generated gradient.
  // (blob: thumbs are stripped on save; url is re-hydrated from IndexedDB.)
  let url = media?.thumb || null;
  if (media?.kind === "image" && media?.url && !media?._offline && isPlayableUrl(media.url)) {
    url = media.url;
  }
  if (!url) url = makeThumbDataURL(seed || 1, media?.name || "Clip");
  // Dead blob: thumb (after reload without IDB hit) -> generated fallback
  if (typeof url === "string" && url.startsWith("blob:")) {
    url = makeThumbDataURL(seed || 1, media?.name || "Clip");
  }
  const img = new Image();
  img.src = url;
  img.onload = () => {
    /* cache ready */
  };
  fillCache.set(key, img);
  return img;
}

/** Cover-fit draw of a <video> frame into the clip rect. Returns true if drawn. */
/* `rect` is an optional Pan & Zoom window in 0..1 FRACTIONS OF THE COVER-FIT
 * CROP (not of the raw source). Composing it that way means the move stays
 * correct whether the clip is letterboxed, pillarboxed or an exact fit. */
function drawVideoFrame(ctx, video, dx, dy, dw, dh, rect) {
  try {
    if (!video || !video.videoWidth || video.readyState < 2) return false;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const scale = Math.max(dw / vw, dh / vh);
    const sw = dw / scale;
    const sh = dh / scale;
    const sx = (vw - sw) / 2;
    const sy = (vh - sh) / 2;
    let csx = sx, csy = sy, csw = sw, csh = sh;
    if (rect) {
      csx = sx + rect.x * sw;
      csy = sy + rect.y * sh;
      csw = rect.w * sw;
      csh = rect.h * sh;
      if (csw < 1 || csh < 1) return false;
    }
    ctx.drawImage(video, csx, csy, csw, csh, dx, dy, dw, dh);
    return true;
  } catch {
    return false;
  }
}

/* Pan & Zoom: resolve a clip's preset into the crop window for this instant.
 * Returns null when no preset is set, so callers keep their normal path. */
function panZoomRectFor(clip, localT) {
  const id = clip && clip.panZoom && clip.panZoom.id;
  if (!id) return null;
  const preset = panZoomById(id);
  if (!preset) return null;
  const dur = Math.max(0.001, Number(clip.duration) || 1);
  const t = Math.min(1, Math.max(0, localT / dur));
  const k = clip.panZoom.intensity == null ? 1 : clip.panZoom.intensity / 100;
  return effectiveRect(preset, t, k);
}

export function drawFrame(ctx, w, h, time, opts = {}) {
  const state = store.get();
  const anySolo = state.tracks.some((t) => t.solo);
  const clips = state.clips.filter((c) => {
    if (time < c.start || time >= c.start + c.duration) return false;
    const track = state.tracks.find((t) => t.id === c.trackId);
    if (!track) return true;
    if (track.hidden) return false;
    if (anySolo && !track.solo) return false;
    return true;
  });

  // background
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#07090c");
  bg.addColorStop(1, "#0b1018");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  if (!clips.length) {
    drawEmpty(ctx, w, h, time);
    return { active: [] };
  }

  // stack video-ish clips bottom-up; shapes/titles draw after video, later clips on top
  const visual = clips
    .filter((c) => c.type !== "audio")
    .sort((a, b) => {
      const ra = trackRank(state, a.trackId);
      const rb = trackRank(state, b.trackId);
      if (ra !== rb) return ra - rb;
      // same track: earlier start first; selected last so it paints on top
      if (a.start !== b.start) return a.start - b.start;
      if (a.id === state.selectedClipId) return 1;
      if (b.id === state.selectedClipId) return -1;
      return 0;
    });

  const tr = activeTransition(state, time);
  if (tr && visual.length) {
    const paintFrom = () => drawClip(ctx, w, h, time, tr.from, true);
    const paintTo = () => drawClip(ctx, w, h, Math.max(tr.to.start + 0.01, time), tr.to, true);
    paintTransition(ctx, w, h, tr.type, tr.progress, paintFrom, paintTo, {
      customSrc: tr.from?.outTransition?.customSrc || tr.to?.outTransition?.customSrc,
    });
  } else {
    const base = visual.find((c) => !c.type || c.type !== "text") || visual[0];
    // Prefer non-text as base if present
    const baseClip = visual.find((c) => c.type === "video" || c.type === "gen" || c.type === "ai") || base;
    if (baseClip) drawClip(ctx, w, h, time, baseClip, true);
    for (let i = 0; i < visual.length; i++) {
      if (visual[i] === baseClip) continue;
      ctx.save();
      ctx.globalAlpha = visual[i].type === "text" ? 1 : 0.92;
      drawClip(ctx, w, h, time, visual[i], false);
      ctx.restore();
    }
  }

  // captions
  const captions = (state.captions || []).filter((c) => time >= c.start && time < c.end);
  if (captions.length && !visual.some((c) => c.type === "text")) {
    drawCaption(ctx, w, h, captions[0].text);
  }

  // styled text clips — skip the one currently owned by the HTML edit overlay (no double-draw)
  // Filmora 15 creative clips (Pen Path / Chart / Visualizer / Text Path) render via the toolkit
  const editingId = typeof getEditingTextClipId === "function" ? getEditingTextClipId() : null;
  clips
    .filter((c) => (c.type === "text" || c.textStyle) && c.id !== editingId && !isCreativeClip(c))
    .forEach((c) => {
      if (c.shape) drawShape(ctx, w, h, c, time);
      else drawStyledText(ctx, w, h, time, c);
    });

  // Filmora 15 creative toolkit overlays (pen paths, charts, visualizers, text paths, pen draft)
  drawCreativeClips(ctx, w, h, time, state);

  // Filmora 15 Video Chapters — progress bar + chapter dividers
  drawChaptersBar(ctx, w, h, state, time);

  // safe area when exporting/review or preference is on (Filmora title-safe + action-safe)
  const showSafe = opts.safe || !!settings.get().playback?.showSafeAreas;
  if (showSafe) {
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1;
    // action-safe ~93%
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.strokeRect(w * 0.035, h * 0.035, w * 0.93, h * 0.93);
    // title-safe ~90%
    ctx.strokeStyle = "rgba(91,140,255,0.35)";
    ctx.strokeRect(w * 0.05, h * 0.05, w * 0.9, h * 0.9);
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = `11px Consolas, monospace`;
    ctx.fillText("TITLE SAFE", w * 0.05 + 4, h * 0.05 + 14);
  }

  // Filmora-style imported 3D LUT (applies to program output when active)
  try {
    applyCustomLuts(ctx, w, h, state);
  } catch (e) {
    /* LUT pass is non-critical */
  }

  window.dispatchEvent(new CustomEvent("aifimora:frame"));
  return { active: clips.map((c) => c.id) };
}

function trackRank(state, trackId) {
  const idx = state.tracks.findIndex((t) => t.id === trackId);
  // lower index is top track visually in our UI (V2, V1, ...); draw V1 as base
  return state.tracks.length - idx;
}

/** Filmora-style chroma key: remove pixels near the key color within a rect. */
function applyChromaKey(ctx, x, y, w, h, fx) {
  try {
    const ix = Math.max(0, Math.floor(x));
    const iy = Math.max(0, Math.floor(y));
    const iw = Math.max(1, Math.min(Math.ceil(w), ctx.canvas.width - ix));
    const ih = Math.max(1, Math.min(Math.ceil(h), ctx.canvas.height - iy));
    if (iw < 2 || ih < 2) return;
    const img = ctx.getImageData(ix, iy, iw, ih);
    const d = img.data;
    const key = hexToRgb(fx.chromaColor || "#00ff00");
    const sim = Math.max(0, Math.min(1, fx.chromaSimilarity ?? 0.4)) * 255 * 1.5;
    // Filmora Enhanced Chroma: smoothness + edge feather widen the soft band, spill trims green fringe
    const feather = Number(fx.chromaFeather ?? 10) / 100;
    const spill = Number(fx.chromaSpill ?? 10) / 100;
    const smooth = Math.max(1, (fx.chromaSmoothness ?? 0.1) * 80 + feather * 60);
    for (let i = 0; i < d.length; i += 4) {
      const dr = d[i] - key.r;
      const dg = d[i + 1] - key.g;
      const db = d[i + 2] - key.b;
      // weight green channel more (typical chroma)
      const dist = Math.sqrt(dr * dr * 0.3 + dg * dg * 1.2 + db * db * 0.3);
      if (dist < sim) {
        const edge = Math.min(1, Math.max(0, (dist - (sim - smooth)) / smooth));
        d[i + 3] = Math.round(d[i + 3] * edge);
        // spill suppression: pull green toward neutral on semi-transparent edge
        if (spill > 0.01 && edge > 0 && edge < 1) {
          const gExcess = Math.max(0, d[i + 1] - Math.max(d[i], d[i + 2]));
          d[i + 1] = Math.round(d[i + 1] - gExcess * spill * (1 - edge));
        }
      }
    }
    ctx.putImageData(img, ix, iy);
  } catch {
    /* keying is non-critical; tainted canvas etc. */
  }
}

function hexToRgb(hex) {
  const m = String(hex).replace("#", "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const n = parseInt(full, 16) || 0;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Visual split-screen chrome for the current clip (layout guide + inset). */
function applySplitScreen(ctx, w, h, mode, clip, localT) {
  ctx.save();
  ctx.strokeStyle = "rgba(91,140,255,0.55)";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  if (mode === "side") {
    ctx.strokeRect(w / 2 - 1, 4, 2, h - 8);
  } else if (mode === "pip") {
    const pw = w * 0.28;
    const ph = h * 0.28;
    ctx.strokeRect(w - pw - 16, h - ph - 16, pw, ph);
    ctx.fillStyle = "rgba(91,140,255,0.08)";
    ctx.fillRect(w - pw - 16, h - ph - 16, pw, ph);
  } else if (mode === "grid4") {
    ctx.strokeRect(w / 2 - 1, 4, 2, h - 8);
    ctx.strokeRect(4, h / 2 - 1, w - 8, 2);
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function drawEmpty(ctx, w, h, time) {
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(91,140,255,0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(w * 0.2, h * 0.28, w * 0.6, h * 0.44);
  ctx.fillStyle = "#6b7589";
  ctx.font = `500 14px "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.fillText("Drop media on the timeline or ask AI Mate to build a rough cut", w / 2, h / 2);
  ctx.font = `12px Consolas, monospace`;
  ctx.fillText(`t = ${time.toFixed(2)}s`, w / 2, h / 2 + 22);
  ctx.textAlign = "left";
}

function drawClip(ctx, w, h, time, clip, isBase) {
  const media = mediaById(clip.mediaId);
  const fx = clip.fx || {};
  const localT = time - clip.start;
  const img = getFillImage(media, (media?.seed || 1) + clip.name.length);

  ctx.save();

  // FX filters (Filmora color depth: exposure/contrast/saturation + sharpness approx + tint via overlay later)
  const brightness = 1 + (fx.exposure || 0) / 100 + (fx.highlights || 0) / 300;
  const contrast = 1 + (fx.contrast || 0) / 100 + (fx.sharpness || 0) / 400;
  const saturate = 1 + (fx.saturation || 0) / 100;
  let filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturate})`;
  if (fx.upscale) filter += " contrast(1.05) saturate(1.05)";
  if ((fx.sharpness || 0) > 0) filter += ` contrast(${1 + fx.sharpness / 500})`;
  ctx.filter = filter;

  // Per-clip Motion transform (Filmora-style position / scale / rotate / opacity / keyframes)
  const _motion = applyMotionTransform(ctx, w, h, clip, localT);
  // Filmora clip animation (configs/AnimationNew — see filmora-presets.js).
  const _anim = applyClipAnimation(ctx, w, h, clip, localT);

  // Stabilization: subtle counter-shake zoom (Filmora crops ~5-10% to hide shake)
  let stabZoom = 1;
  let stabX = 0;
  let stabY = 0;
  if (fx.stabilize) {
    const smooth = Math.min(100, Math.max(0, fx.stabilizeSmooth ?? 50)) / 100;
    stabZoom = 1.04 + smooth * 0.06;
    const f = 1 - smooth * 0.85; // higher smoothness = less residual motion
    stabX = Math.sin(localT * 7.3) * 3.5 * f;
    stabY = Math.cos(localT * 5.1) * 2.8 * f;
  }

  // reframe crop + free crop
  let dx = 0, dy = 0, dw = w, dh = h;
  if (fx.reframe === "9:16") {
    const nw = h * (9 / 16);
    dx = (w - nw) / 2;
    dw = nw;
  } else if (fx.reframe === "1:1") {
    const s = Math.min(w, h);
    dx = (w - s) / 2;
    dy = (h - s) / 2;
    dw = s;
    dh = s;
  } else if (fx.reframe === "4:5") {
    const nw = h * (4 / 5);
    dx = (w - nw) / 2;
    dw = nw;
  }
  if (stabZoom !== 1) {
    const cx = dx + dw / 2;
    const cy = dy + dh / 2;
    dw = dw / stabZoom;
    dh = dh / stabZoom;
    dx = cx - dw / 2 + stabX;
    dy = cy - dh / 2 + stabY;
  }

  const crop = fx.crop || { x: 0, y: 0, w: 1, h: 1 };
  if (crop.w < 0.999 || crop.h < 0.999 || crop.x > 0.001 || crop.y > 0.001) {
    // zoom into crop region
    const sx = dw / Math.max(crop.w, 0.001);
    const sy = dh / Math.max(crop.h, 0.001);
    dw = sx;
    dh = sy;
    dx = dx - crop.x * sx;
    dy = dy - crop.y * sy;
  }

  let drewReal = false;
  // Real imported video: draw the live <video> frame (not the static thumb).
  // Falls back to thumb/gradient while loading or for synthetic clips.
  const videoEl = getVideoEl(media);
  if (videoEl) {
    // Keep the element's clock glued to the timeline when paused/seeking.
    // (When playing, the per-frame sync in createPlayer drives playback.)
    try {
      const want = mediaTimeFor(clip, localT, Number(videoEl.duration) || media?.duration || clip.duration);
      if (videoEl.readyState >= 1 && Number.isFinite(want)) {
        const drift = Math.abs((videoEl.currentTime || 0) - want);
        if (videoEl.paused && drift > 0.06) {
          try { videoEl.currentTime = want; } catch { /* seek later */ }
        }
      }
    } catch { /* clock sync is best-effort */ }
    drewReal = drawVideoFrame(ctx, videoEl, dx, dy, dw, dh, panZoomRectFor(clip, localT));
    if (!drewReal && media?.kind === "image") {
      // video slot reused for image media? no-op
    }
    if (!drewReal && clip.reversed) {
      // Reverse playback can't run a <video> backwards — hold the synced
      // frame if available, otherwise fall through to thumb + REV badge.
    }
  }
  // Imported still image: draw the full file (cover-fit), not the tiny thumb.
  if (!drewReal && media?.kind === "image" && media?.url && !media?._offline && isPlayableUrl(media.url)) {
    try {
      const key = `imgurl-${media.id}`;
      let full = fillCache.get(key);
      if (!full) {
        full = new Image();
        full.src = media.url;
        fillCache.set(key, full);
      }
      if (full && full.complete && full.naturalWidth) {
        const iw = full.naturalWidth;
        const ih = full.naturalHeight;
        const s = Math.max(dw / iw, dh / ih);
        const sw = dw / s;
        const sh = dh / s;
        const bx = (iw - sw) / 2;
        const by = (ih - sh) / 2;
        const pz = panZoomRectFor(clip, localT);
        if (pz) {
          ctx.drawImage(full, bx + pz.x * sw, by + pz.y * sh, pz.w * sw, pz.h * sh, dx, dy, dw, dh);
        } else {
          ctx.drawImage(full, bx, by, sw, sh, dx, dy, dw, dh);
        }
        drewReal = true;
      }
    } catch { /* fall through to thumb */ }
  }
  if (!drewReal) {
    const pz = panZoomRectFor(clip, localT);
    if (img && img.complete && img.naturalWidth) {
      // Thumbnails are real images, so the crop applies here too. Without this
      // branch Pan & Zoom looked dead on synthetic demo media.
      if (pz) {
        const iw = img.naturalWidth, ih = img.naturalHeight;
        ctx.drawImage(img, pz.x * iw, pz.y * ih, pz.w * iw, pz.h * ih, dx, dy, dw, dh);
      } else {
        ctx.drawImage(img, dx, dy, dw, dh);
      }
    } else {
      const g = ctx.createLinearGradient(dx, dy, dx + dw, dy + dh);
      g.addColorStop(0, media?.color || "#1e3a5f");
      g.addColorStop(1, "#0a1020");
      ctx.fillStyle = g;
      ctx.fillRect(dx, dy, dw, dh);
    }
  }
  // Reverse badge (we mirror time; element itself plays forward/paused)
  if (!drewReal && clip.reversed) {
    /* thumb already drawn; badge below */
  }
  if (clip.reversed) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = "600 11px Consolas, monospace";
    ctx.fillText("REV", dx + 8, dy + 18);
    ctx.restore();
  }
  // Offline badge for missing files (blob died + no IDB bytes). Synthetic
  // demo placeholders never had a file, so they are not "missing".
  if ((media?._offline || !media?.url) && media && (media.kind === "video" || media.kind === "audio" || media.kind === "image") && !media.generated && !media.synthetic) {
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    const label = "FILE MISSING — re-import to relink";
    ctx.font = "600 12px Consolas, monospace";
    const tw = ctx.measureText(label).width;
    ctx.fillRect(dx + dw / 2 - tw / 2 - 8, dy + dh / 2 - 14, tw + 16, 24);
    ctx.fillStyle = "#FFB020";
    ctx.fillText(label, dx + dw / 2 - tw / 2, dy + dh / 2 + 4);
    ctx.restore();
  }

  // Chroma key (Filmora green screen) — pixel-level key on the clip region
  if (fx.chroma) {
    applyChromaKey(ctx, dx, dy, dw, dh, fx);
  }

  // Split-screen layout (Filmora templates)
  if (fx.split && fx.split !== "none") {
    applySplitScreen(ctx, w, h, fx.split, clip, localT);
  }

  // Filmora 15 Motion Blur — ghost trail along the motion vector
  if ((fx.motionBlur || 0) > 0) {
    const strength = Math.min(1, fx.motionBlur / 100);
    const mNow = motionAt(clip, localT);
    const mPrev = motionAt(clip, Math.max(0, localT - 0.08));
    const vx = mPrev.x - mNow.x;
    const vy = mPrev.y - mNow.y;
    const mag = Math.hypot(vx, vy);
    ctx.save();
    ctx.globalAlpha = 0.16 * strength;
    const trail = 0.6 + strength * 2.4;
    for (let i = 1; i <= 3; i++) {
      const f = (i / 3) * trail * (h / 720);
      if (mag > 0.002) {
        ctx.drawImage(img, dx + vx * w * f, dy + vy * h * f, dw, dh);
      } else {
        // no motion → subtle zoom-blur trail
        const z = 1 + f * 0.02;
        const zw = dw * z, zh = dh * z;
        ctx.drawImage(img, dx + (dw - zw) / 2, dy + (dh - zh) / 2, zw, zh);
      }
    }
    ctx.restore();
  }

  // Filmora Flicker Removal — counter-oscillating luminance correction
  if ((fx.deflicker || 0) > 0) {
    const strength = Math.min(1, fx.deflicker / 100);
    const flicker = Math.sin(localT * 47.3) * Math.sin(localT * 13.1);
    const comp = flicker * 0.1 * strength;
    ctx.save();
    ctx.globalCompositeOperation = comp > 0 ? "multiply" : "screen";
    ctx.fillStyle = comp > 0 ? `rgba(255,255,255,${Math.abs(comp).toFixed(3)})` : `rgba(30,30,30,${Math.abs(comp).toFixed(3)})`;
    ctx.fillRect(dx, dy, dw, dh);
    ctx.restore();
  }

  // temperature + tint (Filmora white balance)
  if (fx.temperature) {
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle =
      fx.temperature > 0
        ? `rgba(255,140,60,${Math.min(0.35, Math.abs(fx.temperature) / 200)})`
        : `rgba(60,140,255,${Math.min(0.35, Math.abs(fx.temperature) / 200)})`;
    ctx.fillRect(dx, dy, dw, dh);
    ctx.globalCompositeOperation = "source-over";
  }
  if (fx.tint) {
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle =
      fx.tint > 0
        ? `rgba(255,60,180,${Math.min(0.25, Math.abs(fx.tint) / 220)})`
        : `rgba(60,255,140,${Math.min(0.25, Math.abs(fx.tint) / 220)})`;
    ctx.fillRect(dx, dy, dw, dh);
    ctx.globalCompositeOperation = "source-over";
  }
  // shadows lift (simple)
  if (fx.shadows) {
    ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = fx.shadows > 0 ? `rgba(180,200,255,${Math.min(0.2, fx.shadows / 300)})` : `rgba(0,0,10,${Math.min(0.2, Math.abs(fx.shadows) / 300)})`;
    ctx.fillRect(dx, dy, dw, dh);
    ctx.globalCompositeOperation = "source-over";
  }

  // mask highlight (simulated subject isolation)
  if (fx.mask) {
    ctx.globalCompositeOperation = "source-over";
    ctx.filter = "none";
    const cx = dx + dw * 0.5;
    const cy = dy + dh * 0.48;
    const r = Math.min(dw, dh) * 0.28;
    const feather = Math.min(60, Math.max(0, fx.maskFeather ?? 20));
    const rg = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * (1.2 + feather / 80));
    rg.addColorStop(0, "rgba(91,140,255,0)");
    rg.addColorStop(0.75, "rgba(91,140,255,0)");
    rg.addColorStop(1, "rgba(91,140,255,0.25)");
    ctx.fillStyle = rg;
    ctx.fillRect(dx, dy, dw, dh);
    ctx.strokeStyle = fx.maskInvert ? "rgba(255,176,32,0.7)" : "rgba(0,212,160,0.55)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 0.7, r, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Face Mosaic (Filmora privacy blur) — blocky mosaic over face zone
  if (fx.faceMosaic) {
    try {
      const mx = dx + dw * 0.38;
      const my = dy + dh * 0.28;
      const mw = dw * 0.24;
      const mh = dh * 0.32;
      const size = Math.min(64, Math.max(8, settings.get().ai?.faceMosaicSize ?? fx.faceMosaicSize ?? 24));
      const tmp = document.createElement("canvas");
      tmp.width = Math.max(2, Math.round(mw / size));
      tmp.height = Math.max(2, Math.round(mh / size));
      const tctx = tmp.getContext("2d");
      tctx.drawImage(ctx.canvas, mx, my, mw, mh, 0, 0, tmp.width, tmp.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, mx, my, mw, mh);
      ctx.imageSmoothingEnabled = true;
      ctx.strokeStyle = "rgba(255,176,32,0.5)";
      ctx.strokeRect(mx, my, mw, mh);
    } catch { /* mosaic is best-effort */ }
  }

  // Object Remover flag (Filmora Magic Box) — dashed box marker
  if (fx.objectRemover) {
    ctx.strokeStyle = "rgba(255,80,120,0.65)";
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 2;
    ctx.strokeRect(dx + dw * 0.3, dy + dh * 0.35, dw * 0.4, dh * 0.3);
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,80,120,0.8)";
    ctx.font = "12px Consolas, monospace";
    ctx.fillText("MAGIC BOX", dx + dw * 0.3 + 4, dy + dh * 0.35 - 6);
  }

  // vignette
  if (fx.vignette) {
    const v = Math.min(0.7, (fx.vignette || 0) / 150);
    const rg = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.75);
    rg.addColorStop(0, "rgba(0,0,0,0)");
    rg.addColorStop(1, `rgba(0,0,0,${v})`);
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, w, h);
  }

  // LUT tints (Filmora intensity)
  applyLut(ctx, w, h, fx.lut, dx, dy, dw, dh, fx.lutIntensity ?? settings.colorConfig().lutIntensity);

  // Filmora built-in colour presets — a full per-pixel grade, applied after the
  // LUT so the two can be stacked the way Filmora stacks them.
  if (fx.colorPreset) {
    const preset = colorPresetById(fx.colorPreset);
    if (preset) {
      applyColorGradeToCanvasRegion(
        ctx, preset, (fx.colorPresetIntensity ?? 100) / 100, dx, dy, dw, dh
      );
    }
  }

  if (_anim) ctx.restore();
  if (_motion) ctx.restore();

  // ken burns on AI clips
  if (clip.type === "gen" || clip.type === "ai") {
    const p = localT / Math.max(clip.duration, 0.001);
    ctx.strokeStyle = `rgba(0,212,160,${0.15 + Math.sin(p * Math.PI) * 0.1})`;
    ctx.lineWidth = 1;
    ctx.strokeRect(dx + dw * 0.02, dy + dh * 0.02, dw * 0.96, dh * 0.96);
  }

  ctx.filter = "none";
  ctx.restore();

  if (isBase && clip.type !== "audio") {
    // subtle film grain strip
    ctx.fillStyle = "rgba(255,255,255,0.02)";
    for (let i = 0; i < 40; i++) {
      const x = (Math.sin(localT * 3 + i) * 0.5 + 0.5) * w;
      const y = (Math.cos(localT * 2 + i * 1.7) * 0.5 + 0.5) * h;
      ctx.fillRect(x, y, 2, 1);
    }
  }
}

/* Filmora clip animation — a transform/opacity envelope derived from the preset's
 * title (see animEnvelope in filmora-presets.js). Returns true if a save() was
 * taken, so the caller can restore in LIFO order. */
function applyClipAnimation(ctx, w, h, clip, localT) {
  try {
    const a = clipAnimTransform(clip, localT);
    if (!a) return false;
    ctx.save();
    const cx = w / 2;
    const cy = h / 2;
    ctx.translate(cx + a.x * w, cy + a.y * h);
    if (a.rotation) ctx.rotate((a.rotation * Math.PI) / 180);
    if (a.scale !== 1) ctx.scale(a.scale, a.scale);
    ctx.translate(-cx, -cy);
    if (a.alpha < 1) ctx.globalAlpha *= Math.max(0, Math.min(1, a.alpha));
    return true;
  } catch {
    return false;
  }
}

function applyLut(ctx, w, h, lut, dx, dy, dw, dh, intensity) {
  if (!lut || lut === "none") return;
  // Real 3D LUTs from assets/configs/ColorAnd3dLutPreset/CubeLUTFiles (see lut-engine.js).
  // The .CUBE loads async; until it lands we fall through to the tint so the
  // preview never flashes ungraded, then repaint once it is cached.
  if (isCubeLut(lut)) {
    const name = cubeLutName(lut);
    const cube = getCachedLut(name);
    if (!cube) {
      loadLut(name)
        .then(() => window.__aifimoraPlayer?.render())
        .catch(() => {});
      return;
    }
    applyLutToCanvasRegion(ctx, cube, (intensity ?? 80) / 100, dx, dy, dw, dh);
    return;
  }
  const k = Math.min(1, Math.max(0, (intensity ?? 80) / 100));
  if (k <= 0.01) return;
  const map = {
    tealOrange: ["rgba(0,128,128,0.18)", "rgba(255,120,40,0.12)"],
    cinematic: ["rgba(20,40,80,0.22)", "rgba(255,200,120,0.08)"],
    mono: null,
    sunset: ["rgba(255,80,40,0.16)", "rgba(120,40,80,0.14)"],
    neon: ["rgba(180,0,255,0.14)", "rgba(0,200,255,0.12)"],
  };
  if (lut === "mono") {
    ctx.save();
    ctx.globalAlpha = k;
    ctx.globalCompositeOperation = "saturation";
    ctx.fillStyle = "#808080";
    ctx.fillRect(dx, dy, dw, dh);
    ctx.restore();
    return;
  }
  const pair = map[lut];
  if (!pair) return;
  ctx.save();
  ctx.globalAlpha = Math.max(0.05, k);
  ctx.globalCompositeOperation = "soft-light";
  const g = ctx.createLinearGradient(dx, dy, dx + dw, dy + dh);
  g.addColorStop(0, pair[0]);
  g.addColorStop(1, pair[1]);
  ctx.fillStyle = g;
  ctx.fillRect(dx, dy, dw, dh);
  ctx.restore();
}

function drawCaption(ctx, w, h, text, isTitle = false) {
  const c = settings.captionStyle();
  const pad = 24;
  const template = c.template || "basic";
  // Filmora Dynamic Captions: pop scales up, karaoke uses highlight color
  let size = Math.max(14, Math.round((c.fontSize || 22) * (h / 720)));
  if (template === "pop") size = Math.round(size * 1.25);
  ctx.save();
  ctx.font = `${c.bold || template === "pop" ? "800" : "600"} ${size}px "${c.font || "Segoe UI"}", "Segoe UI", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  let y = h - 56;
  if (c.position === "top") y = h * 0.14;
  else if (c.position === "lower") y = h * 0.82;
  else y = h - 56;

  const metrics = ctx.measureText(text);
  const tw = metrics.width;
  if (template === "pop") {
    // TikTok-style pill with accent border
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    roundRect(ctx, w / 2 - tw / 2 - pad * 0.7, y - size * 1.25, tw + pad * 1.4, size * 1.7, 14);
    ctx.fill();
    ctx.strokeStyle = "#00D4A0";
    ctx.lineWidth = 2;
    roundRect(ctx, w / 2 - tw / 2 - pad * 0.7, y - size * 1.25, tw + pad * 1.4, size * 1.7, 14);
    ctx.stroke();
  } else if (c.bg && c.bg !== "rgba(0,0,0,0)") {
    ctx.fillStyle = c.bg;
    roundRect(ctx, w / 2 - tw / 2 - pad * 0.6, y - size * 1.1, tw + pad * 1.2, size * 1.5, 8);
    ctx.fill();
  }
  if (template === "karaoke") {
    // first word highlighted (active-word simulation)
    const words = String(text).split(" ");
    const first = words.shift() || "";
    const rest = words.join(" ");
    const wFirst = ctx.measureText(first).width;
    ctx.fillStyle = "#00D4A0";
    ctx.fillText(first, w / 2 - tw / 2 + wFirst / 2, y);
    ctx.fillStyle = c.color || "#fff";
    if (rest) ctx.fillText(rest, w / 2 + wFirst / 2 + ctx.measureText(" ").width, y);
    if (c.bilingual) {
      ctx.font = `500 ${Math.round(size * 0.7)}px "${c.font || "Segoe UI"}", sans-serif`;
      ctx.fillStyle = "rgba(255,255,255,0.75)";
      ctx.fillText("[" + (c.secondLang || "es") + "] " + text, w / 2, y + size * 1.1);
    }
    ctx.restore();
    return;
  }
  ctx.fillStyle = template === "outline" ? "rgba(0,0,0,0)" : c.color || "#fff";
  if (c.outline !== false || template === "outline") {
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 8;
    ctx.lineWidth = Math.max(2, size * (template === "outline" ? 0.14 : 0.08));
    ctx.strokeStyle = template === "outline" ? "#5B8CFF" : "rgba(0,0,0,0.85)";
    ctx.strokeText(text, w / 2, y);
    if (template === "outline") {
      ctx.fillStyle = "#fff";
    }
  } else {
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 8;
  }
  ctx.fillText(text, w / 2, y);
  if (c.bilingual) {
    ctx.font = `500 ${Math.round(size * 0.7)}px "${c.font || "Segoe UI"}", sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillText("[" + (c.secondLang || "es") + "] " + text, w / 2, y + size * 1.1);
  }
  ctx.restore();
}

function drawStyledText(ctx, w, h, time, clip) {
  if (time < clip.start || time >= clip.start + clip.duration) return;
  const ts = clip.textStyle || {};
  const local = time - clip.start;
  const dur = Math.max(clip.duration, 0.001);
  let alpha = 1;
  let offsetY = 0;
  let scale = 1;
  let visibleChars = Infinity;

  const anim = ts.anim || "none";
  if (anim === "fade") {
    alpha = Math.min(1, local / 0.35, (dur - local) / 0.35);
  } else if (anim === "slideup") {
    const p = Math.min(1, local / 0.45);
    alpha = p;
    offsetY = (1 - p) * 28;
  } else if (anim === "slidedown") {
    const p = Math.min(1, local / 0.45);
    alpha = p;
    offsetY = -(1 - p) * 28;
  } else if (anim === "pop") {
    const p = Math.min(1, local / 0.3);
    alpha = p;
    scale = 0.7 + 0.3 * p;
  } else if (anim === "zoom") {
    const p = Math.min(1, local / 0.4);
    alpha = p;
    scale = 1.35 - 0.35 * p;
  } else if (anim === "typewriter") {
    const full = ts.content || clip.text || "";
    const chars = Math.ceil(full.length * Math.min(1, local / Math.max(0.8, dur * 0.6)));
    visibleChars = chars;
    alpha = 1;
  } else if (anim === "blur") {
    const p = Math.min(1, local / 0.5);
    alpha = p;
    // approximate blur via slight scale jitter + alpha
    scale = 1 + (1 - p) * 0.06;
  }
  // fade out end
  if (anim !== "none") alpha *= Math.min(1, Math.max(0, (dur - local) / 0.3));
  if (alpha <= 0.01) return;

  let text = ts.content || clip.text || "";
  if (ts.uppercase) text = text.toUpperCase();
  if (visibleChars < text.length) text = text.slice(0, visibleChars);
  const lines = text.split("\n");

  let x = w * (ts.x ?? 0.5);
  let y = h * (ts.y ?? 0.5);
  if (ts.pos === "lower") y = h * (ts.y ?? 0.82);
  if (ts.pos === "top") y = h * (ts.y ?? 0.22);
  if (ts.pos === "center") {
    x = w * 0.5;
    y = h * (ts.y ?? 0.5);
  }
  y += offsetY;

  const size = (ts.size || 42) * (h / 720);
  const family = ts.font || "Segoe UI";
  const weight = ts.weight || 600;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.font = `${weight} ${size}px "${family}", "Segoe UI", sans-serif`;
  ctx.textAlign = ts.align === "left" ? "left" : ts.align === "right" ? "right" : "center";
  ctx.textBaseline = "middle";

  const metrics = ctx.measureText(lines[0] || " ");
  const lineH = size * 1.25;
  const blockH = lineH * lines.length;
  const padX = size * 0.45;
  const padY = size * 0.28;
  let bw = 0;
  lines.forEach((ln) => {
    bw = Math.max(bw, ctx.measureText(ln).width);
  });

  if (ts.bg && ts.bg !== "rgba(0,0,0,0)") {
    ctx.fillStyle = ts.bg;
    const bx = ts.align === "left" ? -padX : ts.align === "right" ? -bw - padX : -bw / 2 - padX;
    roundRect(ctx, bx, -blockH / 2 - padY, bw + padX * 2, blockH + padY * 2, size * 0.2);
    ctx.fill();
  }

  ctx.fillStyle = ts.color || "#fff";
  if (ts.shadow !== false) {
    ctx.shadowColor = "rgba(0,0,0,0.65)";
    ctx.shadowBlur = size * 0.2;
    ctx.shadowOffsetY = 2;
  }
  lines.forEach((ln, i) => {
    const ly = -blockH / 2 + lineH * i + lineH / 2;
    if (ts.letterSpacing) {
      // manual tracking
      const chars = [...ln];
      const total = chars.reduce((a, ch) => a + ctx.measureText(ch).width + ts.letterSpacing, 0) - ts.letterSpacing;
      let cx = ctx.textAlign === "left" ? 0 : ctx.textAlign === "right" ? -total : -total / 2;
      const prevAlign = ctx.textAlign;
      ctx.textAlign = "left";
      chars.forEach((ch) => {
        ctx.fillText(ch, cx, ly);
        cx += ctx.measureText(ch).width + ts.letterSpacing;
      });
      ctx.textAlign = prevAlign;
    } else {
      ctx.fillText(ln, 0, ly);
    }
  });
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createPlayer(canvas) {
  const ctx = canvas.getContext("2d", { alpha: false });
  let raf = 0;
  let playing = false;
  let playhead = 0;
  let last = 0;

  function resize() {
    const wrap = canvas.parentElement;
    const box = wrap?.getBoundingClientRect?.() || { width: 640, height: 360 };
    const pad = 24;
    const availW = Math.max(240, Math.floor(box.width - pad));
    const availH = Math.max(135, Math.floor(box.height - pad));
    const proj = store.get();
    const aspect = Math.max(0.1, (proj.width || 1920) / (proj.height || 1080));
    let cssW = availW;
    let cssH = Math.round(cssW / aspect);
    if (cssH > availH) {
      cssH = availH;
      cssW = Math.round(cssH * aspect);
    }
    // final clamp so we never exceed wrap
    if (cssW > availW) {
      cssW = availW;
      cssH = Math.round(cssW / aspect);
    }
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const dpr = Math.min(window.devicePixelRatio || 1, 2) * settings.previewScale();
    const w = Math.max(320, Math.floor(cssW * dpr));
    const h = Math.max(180, Math.round(w / aspect));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function render(time = playhead) {
    resize();
    const w = canvas.width;
    const h = canvas.height;
    drawFrame(ctx, w, h, time, { safe: !!store.get().exportSafe });
    // Glue real media clocks to the timeline even while paused/seeking
    try { syncMediaElements(time, playing); } catch { /* non-critical */ }
  }

  /** Keep imported <video>/<audio> elements glued to the timeline. */
  function syncMediaElements(time, isPlaying) {
    const state = store.get();
    const anySolo = state.tracks.some((t) => t.solo);
    const trackById = new Map(state.tracks.map((t) => [t.id, t]));
    const active = state.clips.filter((c) => {
      if (time < c.start || time >= c.start + c.duration) return false;
      const track = trackById.get(c.trackId);
      if (!track) return true;
      if (track.hidden) return false;
      if (anySolo && !track.solo) return false;
      return true;
    });
    const activeVideoIds = new Set();
    const activeAudioIds = new Set();
    const mv = masterVolume();

    for (const clip of active) {
      const media = mediaById(clip.mediaId);
      if (!media || !media.url || media._offline) continue;
      const track = trackById.get(clip.trackId);
      const trackMuted = !!track?.muted;
      const localT = time - clip.start;
      const speed = Math.max(0.25, Math.min(8, Number(clip.speed) || 1));

      if ((clip.type === "video" || clip.type === "gen" || clip.type === "ai") && media.kind === "video") {
        const v = getVideoEl(media);
        if (!v) continue;
        activeVideoIds.add(media.id);
        try {
          const want = mediaTimeFor(clip, localT, Number(v.duration) || media.duration || clip.duration);
          const clipVol = Math.max(0, Math.min(5, (clip.volume ?? 100) / 100));
          // Filmora audio-effect chain (see audio-fx.js). No-ops when the clip
          // carries no effects, so the default path is untouched.
          syncElementFx(v, media.url, clip.audioFx);
          // Detached video carries no sound — audio lives in the linked clip.
          const silent = trackMuted || clip.audioMuted || store.isDetachSilent(clip);
          applyElementLevel(v, media.url, clipVol * mv, !!silent);
          try { v.playbackRate = clip.reversed ? 1 : speed; } catch { /* ignore */ }
          const drift = Math.abs((v.currentTime || 0) - want);
          if (clip.reversed) {
            // No native reverse: hold the mirrored frame, stay paused.
            if (!v.paused) v.pause();
            if (v.readyState >= 1 && drift > 0.08) {
              try { v.currentTime = want; } catch { /* ignore */ }
            }
          } else if (isPlaying) {
            if (drift > 0.4 && v.readyState >= 1) {
              try { v.currentTime = want; } catch { /* ignore */ }
            }
            if (v.paused) {
              const p = v.play();
              if (p && p.catch) p.catch(() => { /* autoplay guard */ });
            }
          } else {
            if (!v.paused) v.pause();
            if (v.readyState >= 1 && drift > 0.06) {
              try { v.currentTime = want; } catch { /* ignore */ }
            }
          }
        } catch { /* per-clip sync is best-effort */ }
      }

      if (clip.type === "audio" && (media.kind === "audio" || media.kind === "video")) {
        const a = getAudioEl(media);
        if (!a) continue;
        activeAudioIds.add(media.id);
        try {
          const want = mediaTimeFor(clip, localT, Number(a.duration) || media.duration || clip.duration);
          const clipVol = Math.max(0, Math.min(5, (clip.volume ?? 100) / 100));
          // Fades (Filmora volume panel), shaped by the project's audio
          // transition curve instead of a plain linear ramp.
          let fade = 1;
          const fi = Number(clip.fadeIn) || 0;
          const fo = Number(clip.fadeOut) || 0;
          const curve = curveOf(clip.audioTransition || settings.audioConfig?.().audioTransition || DEFAULT_AUDIO_TRANSITION);
          if (fi > 0 && localT < fi) fade *= Math.max(0, fadeInGain(curve, localT / fi));
          if (fo > 0 && localT > clip.duration - fo) {
            fade *= Math.max(0, fadeOutGain(curve, (localT - (clip.duration - fo)) / fo));
          }
          syncElementFx(a, media.url, clip.audioFx);
          applyElementLevel(a, media.url, clipVol * mv * fade, !!(trackMuted || clip.audioMuted));
          try { a.playbackRate = clip.reversed ? 1 : speed; } catch { /* ignore */ }
          const drift = Math.abs((a.currentTime || 0) - want);
          if (isPlaying && !clip.reversed) {
            if (drift > 0.4 && Number.isFinite(want)) {
              try { a.currentTime = want; } catch { /* ignore */ }
            }
            if (a.paused) {
              const p = a.play();
              if (p && p.catch) p.catch(() => {});
            }
          } else {
            if (!a.paused) a.pause();
            if (clip.reversed) {
              const src = Number(a.duration) || media.duration || clip.duration;
              const rw = Math.max(0, src - want - 0.04);
              if (drift > 0.12) { try { a.currentTime = rw; } catch {} }
            } else if (drift > 0.08 && Number.isFinite(want)) {
              try { a.currentTime = want; } catch { /* ignore */ }
            }
          }
        } catch { /* ignore */ }
      }
    }

    // Pause anything that fell out of range (stale talking heads = classic bug)
    videoElCache.forEach((v, id) => {
      if (!activeVideoIds.has(id) && !v.paused) {
        try { v.pause(); } catch { /* ignore */ }
      }
    });
    audioElCache.forEach((a, id) => {
      if (!activeAudioIds.has(id) && !a.paused) {
        try { a.pause(); } catch { /* ignore */ }
      }
    });
  }

  function tick(ts) {
    if (!playing) return;
    if (!last) last = ts;
    const dt = (ts - last) / 1000;
    last = ts;
    const dur = Math.max(store.sequenceDuration(), 1);
    playhead += dt;
    if (playhead >= dur) {
      playhead = 0;
      playing = false;
      last = 0;
      try { syncMediaElements(playhead, false); } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent("aifimora:playhead", { detail: { time: playhead, playing } }));
      render();
      return;
    }
    window.dispatchEvent(new CustomEvent("aifimora:playhead", { detail: { time: playhead, playing } }));
    render();
    raf = requestAnimationFrame(tick);
  }

  function play() {
    if (playing) return;
    playing = true;
    last = 0;
    try { syncMediaElements(playhead, true); } catch { /* ignore */ }
    raf = requestAnimationFrame(tick);
    window.dispatchEvent(new CustomEvent("aifimora:playhead", { detail: { time: playhead, playing } }));
  }

  function pause() {
    playing = false;
    last = 0;
    cancelAnimationFrame(raf);
    try { syncMediaElements(playhead, false); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent("aifimora:playhead", { detail: { time: playhead, playing } }));
  }

  function toggle() {
    if (playing) pause();
    else play();
  }

  function seek(t) {
    const dur = store.sequenceDuration();
    // Allow a little past the end so empty tail is visible, but don't run away
    playhead = Math.max(0, Math.min(Number(t) || 0, dur + 30));
    render();
    try { syncMediaElements(playhead, playing); } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent("aifimora:playhead", { detail: { time: playhead, playing } }));
  }

  function setTime(t) {
    playhead = Math.max(0, Number(t) || 0);
  }

  function getTime() {
    return playhead;
  }

  function isPlaying() {
    return playing;
  }

  // initial
  render(0);
  window.addEventListener("resize", () => render());
  window.addEventListener("aifimora:layout", () => render());
  if (typeof ResizeObserver !== "undefined" && canvas.parentElement) {
    const ro = new ResizeObserver(() => render());
    ro.observe(canvas.parentElement);
  }

  return { play, pause, toggle, seek, setTime, getTime, isPlaying, render };
}

export function formatTC(t) {
  const fps = store.get()?.fps || 30;
  const total = Math.max(0, t);
  const s = Math.floor(total);
  const f = Math.floor((total - s) * fps);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  const ff = String(f).padStart(2, "0");
  return `${hh}:${mm}:${ss}:${ff}`;
}
