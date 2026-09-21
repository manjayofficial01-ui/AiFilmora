/* Real Filmora colour grading.
 *
 * The player's ordinary colour controls go through `ctx.filter`, which can only
 * express brightness/contrast/saturate. The 29 built-in presets need far more —
 * white balance, vibrance, highlight/shadow recovery, per-hue HSL and vignette —
 * so this module grades pixels directly.
 *
 * Every coefficient below is driven by the numbers Filmora itself stores in
 * assets/configs/ColorAnd3dLutPreset/default/*\/Data/*.conf. Ranges observed:
 *   temperature/tint ±100 · exposure 0…38 · contrast ±100 · saturation ±100
 *   vibrance ±100 · vignette amount −100…0 (negative darkens)
 */
import { referenceChart } from "./lut-engine.js";

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/* --- hue helpers --------------------------------------------------------- */
function rgbToHsl(r, g, b, out) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  const d = max - min;
  if (d > 1e-6) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  out[0] = h; out[1] = s; out[2] = l;
  return out;
}

function hueToRgb(h, s, l, out) {
  if (s <= 1e-6) { out[0] = out[1] = out[2] = l; return out; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hk = (((h % 360) + 360) % 360) / 60;
  const f = (n) => {
    let k = (n + hk) % 6;
    if (k < 0) k += 6;
    if (k < 1) return p + (q - p) * k;
    if (k < 3) return q;
    if (k < 4) return p + (q - p) * (4 - k);
    return p;
  };
  out[0] = f(5); out[1] = f(3); out[2] = f(1);
  return out;
}

/* A band may wrap past 360 (Red is 338…25), so membership is "min <= h <= max"
 * when min <= max, and "h >= min || h <= max" when it wraps. */
function bandWeight(h, min, max, feather) {
  if (min <= max) {
    if (h < min - feather || h > max + feather) return 0;
    if (h >= min && h <= max) return 1;
    return h < min ? 1 - (min - h) / feather : 1 - (h - max) / feather;
  }
  const inBand = h >= min || h <= max;
  if (inBand) return 1;
  const dLow = min - h;              // distance below the wrap start
  const dHigh = h - max;             // distance above the wrap end
  const d = Math.min(dLow > 0 ? dLow : Infinity, dHigh > 0 ? dHigh : Infinity);
  return d < feather ? 1 - d / feather : 0;
}

const BAND_FEATHER = 12; // degrees — hard edges would band badly

/* --- the grade ----------------------------------------------------------- */
export function applyColorGradeToImageData(img, preset, intensity = 1) {
  if (!preset || !img || !img.data) return;
  const k = Math.min(1, Math.max(0, intensity));
  if (k <= 0.001) return;

  const d = img.data;
  const n = d.length;
  const W = img.width, H = img.height;

  const wb = preset.wb || null;
  const t = wb ? wb.temp / 100 : 0;
  const tint = wb ? wb.tint / 100 : 0;
  const rMul = wb ? 1 + t * 0.13 : 1;
  const bMul = wb ? 1 - t * 0.13 : 1;
  const gMul = wb ? 1 - tint * 0.10 : 1;

  const col = preset.color || null;
  const expMul = col ? Math.pow(2, col.exposure / 50) : 1;
  const briAdd = col ? (col.brightness / 100) * 0.35 : 0;
  const conK = col ? 1 + col.contrast / 100 : 1;
  const satK = col ? 1 + col.saturation / 100 : 1;
  const vib = col ? col.vibrance / 100 : 0;

  const lt = preset.light || null;
  const shAdj = lt ? lt.shadow / 100 : 0;
  const hiAdj = lt ? lt.highlight / 100 : 0;
  const wAdj = lt ? lt.white / 100 : 0;
  const bAdj = lt ? lt.black / 100 : 0;

  // HSL: skip the whole per-pixel HSL round trip when every band is neutral.
  const hsl = preset.hsl || null;
  let bands = null;
  if (hsl) {
    bands = [];
    for (const name of Object.keys(hsl)) {
      const b = hsl[name];
      if (!b) continue;
      if (Math.abs(b.hue) < 0.5 && Math.abs(b.sat) < 0.5 && Math.abs(b.bri) < 0.5) continue;
      bands.push({ min: b.min, max: b.max, hue: b.hue, sat: b.sat / 100, bri: b.bri / 100 });
    }
    if (!bands.length) bands = null;
  }

  const vig = preset.vignette || null;
  const vAmount = vig ? vig.amount / 100 : 0;      // negative darkens
  const vSize = vig ? Math.max(10, vig.size) / 100 : 1;
  const vFeather = vig ? Math.max(1, vig.feather) / 100 : 0.5;
  const vRound = vig ? vig.roundness / 100 : 0;    // 0 = follow the frame
  const doVig = vig && Math.abs(vAmount) > 0.001;
  const cx = W / 2, cy = H / 2;
  const maxR = Math.sqrt(cx * cx + cy * cy) || 1;

  const hslBuf = [0, 0, 0];
  const rgbBuf = [0, 0, 0];

  for (let i = 0; i < n; i += 4) {
    let r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
    const r0 = r, g0 = g, b0 = b;

    // 1. white balance
    if (wb) { r *= rMul; g *= gMul; b *= bMul; }

    // 2. exposure + brightness
    if (col) {
      r = r * expMul + briAdd;
      g = g * expMul + briAdd;
      b = b * expMul + briAdd;
    }

    // 3. contrast about mid grey
    if (col && Math.abs(conK - 1) > 1e-4) {
      r = (r - 0.5) * conK + 0.5;
      g = (g - 0.5) * conK + 0.5;
      b = (b - 0.5) * conK + 0.5;
    }

    // 4. levels (black / white point)
    if (lt && (Math.abs(bAdj) > 1e-4 || Math.abs(wAdj) > 1e-4)) {
      const lo = bAdj * 0.5, hi = 1 + wAdj * 0.5;
      const span = Math.max(1e-3, hi - lo);
      r = (r - lo) / span;
      g = (g - lo) / span;
      b = (b - lo) / span;
    }

    // 5. shadow / highlight recovery
    if (lt && (Math.abs(shAdj) > 1e-4 || Math.abs(hiAdj) > 1e-4)) {
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const shW = (1 - clamp01(luma)) * (1 - clamp01(luma));
      const hiW = clamp01(luma) * clamp01(luma);
      const add = shAdj * shW * 0.5 + hiAdj * hiW * 0.5;
      r += add; g += add; b += add;
    }

    r = clamp01(r); g = clamp01(g); b = clamp01(b);

    // 6. vibrance then saturation
    if (col && (Math.abs(vib) > 1e-4 || Math.abs(satK - 1) > 1e-4)) {
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
      const satNow = mx <= 1e-6 ? 0 : (mx - mn) / mx;
      // vibrance protects already-saturated pixels; saturation is a flat multiplier
      const vibK = 1 + vib * (1 - satNow);
      const kk = vibK * satK;
      r = luma + (r - luma) * kk;
      g = luma + (g - luma) * kk;
      b = luma + (b - luma) * kk;
      r = clamp01(r); g = clamp01(g); b = clamp01(b);
    }

    // 7. per-hue HSL
    if (bands) {
      rgbToHsl(r, g, b, hslBuf);
      let h = hslBuf[0], s = hslBuf[1], l = hslBuf[2];
      for (const bd of bands) {
        const w = bandWeight(h, bd.min, bd.max, BAND_FEATHER);
        if (w <= 0) continue;
        h += bd.hue * w;
        s = clamp01(s * (1 + bd.sat * w));
        l = clamp01(l + bd.bri * w * 0.5);
      }
      hueToRgb(h, s, l, rgbBuf);
      r = rgbBuf[0]; g = rgbBuf[1]; b = rgbBuf[2];
    }

    // 8. vignette
    if (doVig) {
      const px = (i >> 2) % W, py = ((i >> 2) / W) | 0;
      const dx = (px - cx) / (cx || 1), dy = (py - cy) / (cy || 1);
      let dist = Math.sqrt(dx * dx + dy * dy) / Math.SQRT2;
      if (vRound > 0) {
        const circ = Math.sqrt(dx * dx + dy * dy);
        dist = dist * (1 - vRound) + circ * vRound;
      }
      const inner = Math.max(0, vSize - vFeather);
      let f = 0;
      if (dist > inner) f = Math.min(1, (dist - inner) / Math.max(1e-3, vFeather * 2));
      f = f * f * (3 - 2 * f); // smoothstep
      const mul = 1 + vAmount * f;
      r *= mul; g *= mul; b *= mul;
    }

    // 9. intensity blend against the ungraded pixel
    const rr = r0 + (clamp01(r) - r0) * k;
    const gg = g0 + (clamp01(g) - g0) * k;
    const bb = b0 + (clamp01(b) - b0) * k;
    d[i] = rr * 255; d[i + 1] = gg * 255; d[i + 2] = bb * 255;
  }
}

/* --- canvas region (mirrors the LUT engine's downscale path) -------------- */
let _buf = null;

export function applyColorGradeToCanvasRegion(ctx, preset, intensity, dx, dy, dw, dh) {
  if (!preset || dw <= 0 || dh <= 0) return;
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
  applyColorGradeToImageData(img, preset, k);
  bctx.putImageData(img, 0, 0);
  ctx.drawImage(_buf, 0, 0, sw, sh, dx, dy, dw, dh);
}

/* --- thumbnail: grade the same reference chart the LUT browser uses ------- */
export function colorPresetThumbnail(preset, w = 96, h = 54) {
  const src = referenceChart(w * 2, h * 2);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(src, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  applyColorGradeToImageData(img, preset, 1);
  ctx.putImageData(img, 0, 0);
  return c;
}

export function isNeutralPreset(preset) {
  if (!preset) return true;
  const p = [preset.wb, preset.color, preset.light, preset.hsl, preset.vignette];
  return !p.some(Boolean);
}
