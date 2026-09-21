/* lut-engine.js — real 3D LUT grading using the Filmora .CUBE files in assets/.
 *
 * Before this module every "LUT" in AiFilmora was a two-stop CSS gradient painted
 * with `soft-light`. Nice enough as a tint, but it is not colour grading. Filmora
 * ships 25 genuine 32×32×32 .CUBE files under
 *   assets/configs/ColorAnd3dLutPreset/CubeLUTFiles/
 * (007 Series, B&W Film, Batman, Cyberpunk 1/2, Game of Thrones, Gravity,
 * Harry Potter, House of Cards, Mission Impossible, Sparta 300, Star Wars,
 * Walking Dead, Warm Film, Cool Film and the CLog/DLog/GPLog/NLog/SLog/VLog
 * log-to-709 conversions). This module parses them and applies them per-pixel.
 *
 * .CUBE layout (Adobe/Wondershare, all 25 files are LUT_3D_SIZE 32):
 *   # comment
 *   TITLE "007 Series"
 *   LUT_3D_SIZE 32
 *   DOMAIN_MIN 0.0 0.0 0.0
 *   DOMAIN_MAX 1.0 1.0 1.0
 *   <size³ lines of "r g b">
 * Data order — red varies fastest, then green, then blue:
 *   index = (b * size + g) * size + r
 */

import { LUT_NAMES, LUT_BASE, LUT_EXT } from "./filmora-library.js";

/* Re-exported so consumers only need to import this module. */
export { LUT_NAMES, LUT_BASE, LUT_EXT };

const cache = new Map();      // name -> parsed lut
const inflight = new Map();   // name -> Promise
const thumbCache = new Map(); // name -> dataURL

/* ---------------------------------------------------------------- parse -------- */
export function parseCube(text, fallbackTitle = "") {
  if (!text) return null;
  let size = 0;
  let title = fallbackTitle;
  const dmin = [0, 0, 0];
  const dmax = [1, 1, 1];
  const nums = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line || line[0] === "#") continue;
    const up = line.toUpperCase();
    if (up.startsWith("TITLE")) {
      const m = line.match(/"([^"]*)"/);
      if (m) title = m[1];
      continue;
    }
    if (up.startsWith("LUT_3D_SIZE")) {
      size = parseInt(line.split(/\s+/)[1], 10) || 0;
      continue;
    }
    if (up.startsWith("LUT_1D_SIZE")) return null; // we only handle 3D
    if (up.startsWith("DOMAIN_MIN")) {
      const p = line.split(/\s+/).slice(1).map(Number);
      if (p.length >= 3) { dmin[0] = p[0]; dmin[1] = p[1]; dmin[2] = p[2]; }
      continue;
    }
    if (up.startsWith("DOMAIN_MAX")) {
      const p = line.split(/\s+/).slice(1).map(Number);
      if (p.length >= 3) { dmax[0] = p[0]; dmax[1] = p[1]; dmax[2] = p[2]; }
      continue;
    }
    // data line: three floats
    const p = line.split(/\s+/);
    if (p.length >= 3) {
      const r = parseFloat(p[0]), g = parseFloat(p[1]), b = parseFloat(p[2]);
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
        nums.push(r, g, b);
      }
    }
  }
  if (!size || nums.length / 3 !== size * size * size) return null;
  const span = [dmax[0] - dmin[0], dmax[1] - dmin[1], dmax[2] - dmin[2]];
  return {
    size,
    title: title || fallbackTitle,
    data: Float32Array.from(nums),
    domainMin: dmin,
    domainSpan: span,
  };
}

/* ---------------------------------------------------------------- load --------- */
export function lutUrl(name) {
  return LUT_BASE + encodeURIComponent(name) + LUT_EXT;
}

export function lutNames() {
  return LUT_NAMES.slice();
}

export function getCachedLut(name) {
  return cache.get(name) || null;
}

/* Number of .CUBE files parsed so far — used by the smoke tests to wait for the
 * background preload instead of guessing at a timeout. */
if (typeof window !== "undefined") {
  window.__aifimoraLutCount = () => cache.size;
}

export async function loadLut(name) {
  if (cache.has(name)) return cache.get(name);
  if (inflight.has(name)) return inflight.get(name);
  const p = (async () => {
    try {
      const res = await fetch(lutUrl(name));
      if (!res.ok) throw new Error("HTTP " + res.status);
      const lut = parseCube(await res.text(), name);
      if (!lut) throw new Error("unparsable .CUBE");
      cache.set(name, lut);
      return lut;
    } catch (err) {
      inflight.delete(name);
      throw err;
    }
  })();
  inflight.set(name, p);
  return p;
}

/* -------------------------------------------------------------- sampling ------- */
/* Trilinear sample. r/g/b are 0..1 in the LUT's own domain. */
export function sampleLut(lut, r, g, b, out) {
  const n = lut.size;
  const dm = lut.domainMin;
  const ds = lut.domainSpan;
  // normalise into domain, then into lattice space
  let x = ((r - dm[0]) / (ds[0] || 1)) * (n - 1);
  let y = ((g - dm[1]) / (ds[1] || 1)) * (n - 1);
  let z = ((b - dm[2]) / (ds[2] || 1)) * (n - 1);
  if (x < 0) x = 0; else if (x > n - 1) x = n - 1;
  if (y < 0) y = 0; else if (y > n - 1) y = n - 1;
  if (z < 0) z = 0; else if (z > n - 1) z = n - 1;

  const x0 = x | 0, y0 = y | 0, z0 = z | 0;
  const x1 = x0 + 1 < n ? x0 + 1 : x0;
  const y1 = y0 + 1 < n ? y0 + 1 : y0;
  const z1 = z0 + 1 < n ? z0 + 1 : z0;
  const fx = x - x0, fy = y - y0, fz = z - z0;

  const d = lut.data;
  const n2 = n * n;
  // index = (b * n + g) * n + r
  const i000 = ((z0 * n + y0) * n + x0) * 3;
  const i100 = ((z0 * n + y0) * n + x1) * 3;
  const i010 = ((z0 * n + y1) * n + x0) * 3;
  const i110 = ((z0 * n + y1) * n + x1) * 3;
  const i001 = ((z1 * n + y0) * n + x0) * 3;
  const i101 = ((z1 * n + y0) * n + x1) * 3;
  const i011 = ((z1 * n + y1) * n + x0) * 3;
  const i111 = ((z1 * n + y1) * n + x1) * 3;

  const w000 = (1 - fx) * (1 - fy) * (1 - fz);
  const w100 = fx * (1 - fy) * (1 - fz);
  const w010 = (1 - fx) * fy * (1 - fz);
  const w110 = fx * fy * (1 - fz);
  const w001 = (1 - fx) * (1 - fy) * fz;
  const w101 = fx * (1 - fy) * fz;
  const w011 = (1 - fx) * fy * fz;
  const w111 = fx * fy * fz;

  out[0] = d[i000] * w000 + d[i100] * w100 + d[i010] * w010 + d[i110] * w110 +
           d[i001] * w001 + d[i101] * w101 + d[i011] * w011 + d[i111] * w111;
  out[1] = d[i000 + 1] * w000 + d[i100 + 1] * w100 + d[i010 + 1] * w010 + d[i110 + 1] * w110 +
           d[i001 + 1] * w001 + d[i101 + 1] * w101 + d[i011 + 1] * w011 + d[i111 + 1] * w111;
  out[2] = d[i000 + 2] * w000 + d[i100 + 2] * w100 + d[i010 + 2] * w010 + d[i110 + 2] * w110 +
           d[i001 + 2] * w001 + d[i101 + 2] * w101 + d[i011 + 2] * w011 + d[i111 + 2] * w111;
  return out;
}

const _smp = new Float32Array(3);

/* In-place on an ImageData. intensity 0..1 blends between original and graded. */
export function applyLutToImageData(imageData, lut, intensity = 1) {
  if (!lut) return imageData;
  const k = Math.min(1, Math.max(0, intensity));
  if (k <= 0.001) return imageData;
  const px = imageData.data;
  const len = px.length;
  if (k >= 0.999) {
    for (let i = 0; i < len; i += 4) {
      sampleLut(lut, px[i] / 255, px[i + 1] / 255, px[i + 2] / 255, _smp);
      px[i] = _smp[0] * 255;
      px[i + 1] = _smp[1] * 255;
      px[i + 2] = _smp[2] * 255;
    }
  } else {
    for (let i = 0; i < len; i += 4) {
      sampleLut(lut, px[i] / 255, px[i + 1] / 255, px[i + 2] / 255, _smp);
      px[i] += (_smp[0] * 255 - px[i]) * k;
      px[i + 1] += (_smp[1] * 255 - px[i + 1]) * k;
      px[i + 2] += (_smp[2] * 255 - px[i + 2]) * k;
    }
  }
  return imageData;
}

/* Grade a rectangular region of a live canvas.
 * Grading is per-pixel JS, so we grade a downscaled copy (max 480 px wide) and
 * scale it back up — visually identical at preview sizes, roughly 6× cheaper. */
let _buf = null;
export function applyLutToCanvasRegion(ctx, lut, intensity, dx, dy, dw, dh) {
  if (!lut || dw <= 0 || dh <= 0) return;
  const k = Math.min(1, Math.max(0, intensity));
  if (k <= 0.001) return;
  const maxW = 480;
  const sw = Math.max(1, Math.min(Math.round(dw), maxW));
  const sh = Math.max(1, Math.round(sw * (dh / dw)));
  if (!_buf) _buf = document.createElement("canvas");
  _buf.width = sw;
  _buf.height = sh;
  const bctx = _buf.getContext("2d", { willReadFrequently: true });
  bctx.clearRect(0, 0, sw, sh);
  bctx.drawImage(ctx.canvas, dx, dy, dw, dh, 0, 0, sw, sh);
  const img = bctx.getImageData(0, 0, sw, sh);
  applyLutToImageData(img, lut, k);
  bctx.putImageData(img, 0, 0);
  ctx.drawImage(_buf, 0, 0, sw, sh, dx, dy, dw, dh);
}

/* --------------------------------------------------------- preview thumbnail --- */
/* A LUT is only useful if you can see it. There is no thumbnail in the asset dump,
 * so we grade a synthetic reference chart — skin, foliage, sky, a neutral step
 * wedge and saturated primaries — which is what actually reveals what a look does. */
export function referenceChart(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const x = c.getContext("2d");
  const bands = [
    ["#2b1b12", "#c88f6a"], // shadow skin -> highlight skin
    ["#1d3b1a", "#6fae52"], // foliage
    ["#12314f", "#7fc2e8"], // sky
    ["#8a6a3a", "#e0c08a"], // sand / wood
    ["#3a3a3a", "#d8d8d8"], // neutral
  ];
  const bh = h / bands.length;
  bands.forEach((b, i) => {
    const g = x.createLinearGradient(0, i * bh, w, (i + 1) * bh);
    g.addColorStop(0, b[0]);
    g.addColorStop(1, b[1]);
    x.fillStyle = g;
    x.fillRect(0, Math.round(i * bh), w, Math.ceil(bh) + 1);
  });
  // saturated primaries strip along the bottom fifth
  const prim = ["#e02b2b", "#e0a52b", "#2be02b", "#2bb6e0", "#7a2be0"];
  const ph = h * 0.18;
  const pw = w / prim.length;
  prim.forEach((p, i) => {
    x.fillStyle = p;
    x.fillRect(Math.round(i * pw), h - ph, Math.ceil(pw) + 1, ph);
  });
  return c;
}

export function lutThumbnail(lut, w = 96, h = 54) {
  if (!lut) return null;
  if (thumbCache.has(lut.title)) return thumbCache.get(lut.title);
  const src = referenceChart(w, h);
  const ctx = src.getContext("2d");
  const img = ctx.getImageData(0, 0, w, h);
  applyLutToImageData(img, lut, 1);
  ctx.putImageData(img, 0, 0);
  const url = src.toDataURL("image/png");
  thumbCache.set(lut.title, url);
  return url;
}

/* Ungraded reference swatch so the browser can show a "no LUT" tile that matches. */
export function referenceThumbnail(w = 96, h = 54) {
  const key = "__ref__" + w + "x" + h;
  if (thumbCache.has(key)) return thumbCache.get(key);
  const url = referenceChart(w, h).toDataURL("image/png");
  thumbCache.set(key, url);
  return url;
}

/* -------------------------------------------------------------- UI helpers ---- */
export const LUT_PREFIX = "cube:";

export function isCubeLut(value) {
  return typeof value === "string" && value.startsWith(LUT_PREFIX);
}

export function cubeLutName(value) {
  return isCubeLut(value) ? value.slice(LUT_PREFIX.length) : null;
}

/* Load every LUT in the background so the browser is instant once opened. */
export async function preloadLuts(onEach) {
  const out = [];
  for (const name of LUT_NAMES) {
    try {
      const lut = await loadLut(name);
      out.push(lut);
      onEach?.(lut);
    } catch { /* a missing file must not break the panel */ }
  }
  return out;
}
