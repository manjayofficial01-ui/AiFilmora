/* Filmora Pan & Zoom (Ken Burns), driven by the real preset curves.
 *
 * The presets give a keyframed crop rectangle as normalised 0..1 fractions of
 * the frame: [x, y, w, h]. Applying one means drawing only that sub-rectangle of
 * the source, scaled up to fill the destination — which is precisely how a
 * Ken Burns move is built.
 */
import { panZoomPresets, panZoomById } from "./panzoom-presets.js";

export { panZoomPresets, panZoomById };

/** Linear interpolation across a track's keyframes, clamped at both ends. */
export function sampleTrack(track, t) {
  const keys = track.keys;
  if (!keys || !keys.length) return 0;
  if (keys.length === 1) return keys[0].v;
  const tt = t <= 0 ? 0 : t >= 1 ? 1 : t;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (tt >= a.t && tt <= b.t) {
      const span = b.t - a.t;
      if (span <= 1e-9) return b.v;
      const k = (tt - a.t) / span;
      return a.v + (b.v - a.v) * k;
    }
  }
  return tt <= keys[0].t ? keys[0].v : keys[keys.length - 1].v;
}

/** The crop rect at normalised time t (0..1 through the clip). */
export function cropRectAt(preset, t) {
  if (!preset) return { x: 0, y: 0, w: 1, h: 1 };
  const [x, y, w, h] = preset.tracks;
  return {
    x: sampleTrack(x, t),
    y: sampleTrack(y, t),
    w: sampleTrack(w, t),
    h: sampleTrack(h, t),
  };
}

/** Blend a preset between "off" (full frame) and full strength, then clamp so
 *  the rect can never leave the source or collapse to nothing. */
export function effectiveRect(preset, t, intensity = 1) {
  const r = cropRectAt(preset, t);
  const k = intensity <= 0 ? 0 : intensity >= 1 ? 1 : intensity;
  let { x, y, w, h } = r;
  if (k < 1) {
    x = x * k;
    y = y * k;
    w = 1 + (w - 1) * k;
    h = 1 + (h - 1) * k;
  }
  w = Math.min(1, Math.max(0.02, w));
  h = Math.min(1, Math.max(0.02, h));
  x = Math.min(1 - w, Math.max(0, x));
  y = Math.min(1 - h, Math.max(0, y));
  return { x, y, w, h };
}

/** Draw `img` into the destination rect, cropping to the Pan & Zoom window. */
export function drawWithPanZoom(ctx, img, rect, dx, dy, dw, dh) {
  if (!img) return false;
  const sw = img.naturalWidth || img.videoWidth || img.width || 0;
  const sh = img.naturalHeight || img.videoHeight || img.height || 0;
  if (!sw || !sh) return false;
  const sx = rect.x * sw, sy = rect.y * sh;
  const sWidth = rect.w * sw, sHeight = rect.h * sh;
  if (sWidth < 1 || sHeight < 1) return false;
  try {
    ctx.drawImage(img, sx, sy, sWidth, sHeight, dx, dy, dw, dh);
    return true;
  } catch {
    return false;
  }
}

/** Small animated preview canvas for the picker: a framed rect moving over a
 *  placeholder, so you can see the move without scrubbing the timeline. */
export function panZoomPreview(preset, w = 96, h = 54) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#0e1116";
  ctx.fillRect(0, 0, w, h);
  // subject
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  ctx.fillStyle = "rgba(0,212,160,0.16)";
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.22, 0, Math.PI * 2);
  ctx.fill();
  // the crop window at the end of the move
  const end = effectiveRect(preset, 1, 1);
  ctx.strokeStyle = "#00d4a0";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(end.x * w, end.y * h, end.w * w, end.h * h);
  // arrow from start window to end window
  const start = effectiveRect(preset, 0, 1);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.strokeRect(start.x * w, start.y * h, start.w * w, start.h * h);
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.beginPath();
  ctx.moveTo((start.x + start.w / 2) * w, (start.y + start.h / 2) * h);
  ctx.lineTo((end.x + end.w / 2) * w, (end.y + end.h / 2) * h);
  ctx.stroke();
  return c;
}

export function isStaticPreset(preset) {
  if (!preset) return true;
  return preset.tracks.every((tr) => {
    const vs = tr.keys.map((k) => k.v);
    return vs.every((v) => Math.abs(v - vs[0]) < 1e-6);
  });
}
