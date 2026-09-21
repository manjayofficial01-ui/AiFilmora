/* Transition catalog + helpers */
import { settings } from "./settings.js";

export const TRANSITIONS = [
  { id: "none", label: "None", dur: 0 },
  /* ---- Filmora GPU-shader transitions (asset/resources/wfx_effect/Transition/) ----
   * Canvas ports of the real .frag shaders that ship inside the Filmora install. */
  { id: "fw_crosszoom", label: "Cross Zoom", dur: 0.8 },
  { id: "fw_push", label: "Push", dur: 0.6 },
  { id: "fw_drop", label: "Drop Bands", dur: 0.7 },
  { id: "fw_erase", label: "Erase Wipe", dur: 0.6 },
  { id: "fw_linearwipe", label: "Linear Wipe", dur: 0.6 },
  { id: "fw_pinwheel", label: "Pinwheel", dur: 0.9 },
  { id: "fw_pixelate", label: "Pixelate", dur: 0.7 },
  { id: "fw_roll", label: "Roll Clockwise", dur: 0.7 },
  { id: "fw_roundzoom", label: "Round Zoom Out", dur: 0.7 },
  { id: "fw_skewsplit", label: "Skew Split", dur: 0.6 },
  { id: "fw_doorway", label: "Doorway", dur: 0.8 },
  { id: "fw_whirl", label: "Whirl", dur: 0.9 },
  { id: "fw_evaporate", label: "Evaporate", dur: 0.9 },
  { id: "fw_fadeblack", label: "Fade Black (Filmora)", dur: 0.7 },
  { id: "fw_fadewhite", label: "Fade White (Filmora)", dur: 0.7 },
  /* ---- built-in canvas transitions ---- */
  { id: "dissolve", label: "Cross Dissolve", dur: 0.6 },
  { id: "dipBlack", label: "Dip to Black", dur: 0.7 },
  { id: "dipWhite", label: "Dip to White", dur: 0.5 },
  { id: "wipeLeft", label: "Wipe Left", dur: 0.5 },
  { id: "wipeRight", label: "Wipe Right", dur: 0.5 },
  { id: "slideLeft", label: "Slide Left", dur: 0.55 },
  { id: "slideRight", label: "Slide Right", dur: 0.55 },
  { id: "zoomIn", label: "Zoom In", dur: 0.5 },
  { id: "zoomOut", label: "Zoom Out", dur: 0.5 },
  { id: "flash", label: "Flash Cut", dur: 0.25 },
  { id: "glitch", label: "Glitch Cut", dur: 0.35 },
];

export function transitionById(id) {
  return TRANSITIONS.find((t) => t.id === id) || TRANSITIONS[0];
}

/** Find the clip that plays immediately after `clip` on the same track. */
export function nextClipOnTrack(state, clip) {
  const same = state.clips
    .filter((c) => c.trackId === clip.trackId && c.id !== clip.id)
    .sort((a, b) => a.start - b.start);
  const end = clip.start + clip.duration;
  return (
    same.find((c) => Math.abs(c.start - end) < 0.15 || (c.start >= end - 0.05 && c.start < end + 0.2)) ||
    null
  );
}

/**
 * If playhead is inside a transition window, return { from, to, type, progress (0..1), duration }.
 */
export function activeTransition(state, time) {
  const sorted = [...state.clips]
    .filter((c) => c.type !== "audio")
    .sort((a, b) => a.start + a.duration - (b.start + b.duration));

  for (const from of sorted) {
    const tr = from.outTransition;
    if (!tr || !tr.type || tr.type === "none" || !tr.duration) continue;
    const cut = from.start + from.duration;
    const t0 = cut - tr.duration;
    if (time >= t0 && time <= cut + 0.02) {
      const to = nextClipOnTrack(state, from);
      if (!to) continue;
      const progress = Math.min(1, Math.max(0, (time - t0) / tr.duration));
      return { from, to, type: tr.type, progress, duration: tr.duration };
    }
  }
  return null;
}

/** Apply a transition to the selected clip's out-point (toward next cut). */
export function applyTransitionToClip(store, clipId, typeId) {
  const clip = store.getClip(clipId);
  if (!clip) return { ok: false, reason: "Select a clip first" };
  const meta = transitionById(typeId);
  if (meta.id === "none") {
    store.updateClip(clipId, { outTransition: null });
    return { ok: true, label: "removed" };
  }
  const next = nextClipOnTrack(store.get(), clip);
  const prefDur = Number(settings.get().editing?.defaultTransitionDur);
  const dur = prefDur > 0 ? prefDur : meta.dur;
  store.updateClip(clipId, {
    outTransition: { type: meta.id, duration: dur, label: meta.label },
  }, { undo: true });
  if (!next) {
    return { ok: true, label: meta.label, warn: "Saved — add a following clip on this track to see it." };
  }
  return { ok: true, label: meta.label };
}

/**
 * Compose transition visuals.
 * paintFrom(ctx,w,h) and paintTo(ctx,w,h) draw the two full frames.
 */
export function paintTransition(ctx, w, h, type, p, paintFrom, paintTo, extra = {}) {
  const t = Math.min(1, Math.max(0, p));
  ctx.save();
  // Custom image wipe overlay (assets/transitions PNG)
  if (extra.customSrc && type !== "glitch") {
    paintFrom();
    const img = extra._img || (extra._img = new Image());
    if (img.src !== extra.customSrc) img.src = extra.customSrc;
    ctx.globalAlpha = Math.min(1, t * 1.4);
    if (img.complete && img.naturalWidth) {
      ctx.drawImage(img, 0, 0, w, h);
    } else {
      ctx.fillStyle = `rgba(201,162,39,${0.35 * t})`;
      ctx.fillRect(0, 0, w, h);
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.globalAlpha = t;
    paintTo();
    ctx.restore();
    ctx.restore();
    return;
  }
  switch (type) {
    /* ---- Filmora GPU-shader transitions (asset/resources/wfx_effect/Transition/*.frag) ----
     * Canvas-2D ports of the real GLSL shaders that ship in the Filmora install.
     * Each entry mirrors its .frag: same uniforms (progress, resolution), same
     * easing curves and blending maths. */
    case "fw_pinwheel": {
      // Pinwheel.frag — rotating fan of sectors sweeping across the frame
      paintFrom();
      const cx = w / 2, cy = h / 2;
      const steps = 24;
      for (let i = 0; i < steps; i++) {
        const a0 = ((i / steps) + (1 - t)) * Math.PI * 2;
        const a1 = a0 + (Math.PI * 2 * t) / steps + 0.02;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, Math.hypot(w, h), a0, a1);
        ctx.closePath();
        ctx.save();
        ctx.clip();
        paintTo();
        ctx.restore();
      }
      break;
    }
    case "fw_pixelate": {
      // Pixelate.frag — mosaic squares grow from the cut edges, then resolve
      const rev = 1 - t;
      const distEdges = Math.min(t, rev);
      const square = Math.max(1, 50 * distEdges * (h / 360));
      const tmp = document.createElement("canvas");
      tmp.width = Math.max(1, Math.ceil(w / square));
      tmp.height = Math.max(1, Math.ceil(h / square));
      const tctx = tmp.getContext("2d");
      paintFrom();
      tctx.drawImage(ctx.canvas, 0, 0, tmp.width, tmp.height);
      ctx.save();
      ctx.globalAlpha = t;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, 0, 0, w, h);
      ctx.restore();
      break;
    }
    case "fw_push": {
      // push.frag — sinusoidal + parabolic horizontal push with overlap
      const PI2 = Math.PI * 2;
      const iPro = t - Math.sin(PI2 * t) / PI2;               // GetSinusoidalMap
      const pro = 3 * iPro * iPro - 2 * iPro * iPro * iPro;   // GetParabolaMap
      paintFrom();
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w * (1 - pro), h);
      ctx.clip();
      ctx.translate(-w * pro, 0);
      paintTo();
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(w * (1 - pro), 0, w * pro, h);
      ctx.clip();
      ctx.translate(w * (1 - pro), 0);
      paintFrom();
      ctx.restore();
      break;
    }
    case "fw_drop": {
      // drop.frag — horizontal bands slide away top-down with cubic ease
      const iPro = 3 * t * t - 2 * t * t * t;
      const block = Math.max(8, Math.round(h / 12));
      const nBlocks = Math.ceil(h / block);
      const proc = Math.round(2 * iPro * h);
      paintTo();
      for (let i = 0; i < nBlocks; i++) {
        const offset = proc > i * block ? i * block - (proc - i * block) : i * block;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, offset, w, block);
        ctx.clip();
        paintFrom();
        ctx.restore();
      }
      break;
    }
    case "fw_erase": {
      // Erase.frag — soft 100px feathered wipe left→right
      const pos = (w + 100) * t;
      const pp = pos - 100;
      paintFrom();
      ctx.save();
      const grad = ctx.createLinearGradient(Math.max(0, pp), 0, Math.min(w, pos), 0);
      grad.addColorStop(0, "rgba(0,0,0,1)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      break;
    }
    case "fw_linearwipe": {
      // Linear Wipe.frag — 45° diagonal wipe with feathered edge
      paintFrom();
      ctx.save();
      ctx.beginPath();
      const d = (w + h) * t * 1.2;
      ctx.moveTo(0, d);
      ctx.lineTo(Math.min(w, d), 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.clip();
      paintTo();
      ctx.restore();
      break;
    }
    case "fw_roll": {
      // Roll_clockwise.frag — radial sweep with smoothstepped edge
      paintFrom();
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(w / 2, h / 2);
      ctx.arc(w / 2, h / 2, Math.hypot(w, h) / 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t);
      ctx.closePath();
      ctx.clip();
      paintTo();
      ctx.restore();
      break;
    }
    case "fw_roundzoom": {
      // Round_zoom_out.frag — expanding circle reveal with cubic ease
      const iPro = 3 * t * t - 2 * t * t * t;
      const r = iPro * Math.hypot(w, h) * 0.75;
      paintFrom();
      ctx.save();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
      ctx.clip();
      paintTo();
      ctx.restore();
      break;
    }
    case "fw_skewsplit": {
      // Skew_right_split.frag — diagonal soft split, halves slide apart
      const iPro = 3 * t * t - 2 * t * t * t;
      const m = 1.3 * iPro;
      paintFrom();
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w * (1 - m * 0.5), 0);
      ctx.lineTo(w * (1 - m * 0.5) - w * m * 0.2, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.clip();
      ctx.translate(-w * m * 0.15, 0);
      paintFrom();
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(w * (1 - m * 0.5), 0);
      ctx.lineTo(w, 0);
      ctx.lineTo(w, h);
      ctx.lineTo(w * (1 - m * 0.5) - w * m * 0.2, h);
      ctx.closePath();
      ctx.clip();
      ctx.translate(w * m * 0.15, 0);
      paintTo();
      ctx.restore();
      break;
    }
    case "fw_doorway": {
      // DoorWay.frag — perspective split doors reveal the incoming clip
      const iPro = 3 * t * t - 2 * t * t * t;
      const gap = iPro * w * 0.5;
      paintTo();
      const sc = 1 + iPro * 0.1;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w / 2 - gap / 2, h);
      ctx.clip();
      ctx.translate(-gap, 0);
      ctx.translate(w / 4, h / 2);
      ctx.scale(sc, sc);
      ctx.translate(-w / 4, -h / 2);
      paintFrom();
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(w / 2 + gap / 2, 0, w / 2 - gap / 2, h);
      ctx.clip();
      ctx.translate(gap, 0);
      ctx.translate((3 * w) / 4, h / 2);
      ctx.scale(sc, sc);
      ctx.translate(-(3 * w) / 4, -h / 2);
      paintFrom();
      ctx.restore();
      break;
    }
    case "fw_crosszoom": {
      // CrossZoom.frag — A zooms in + dissolves while B zooms from wide
      const ease = t < 0.5
        ? 0.5 * Math.pow(2, 10 * (2 * t - 1))
        : 0.5 * (-Math.pow(2, -10 * (2 * t - 1)) + 2);
      paintFrom();
      ctx.save();
      const sA = 1 + ease * 0.6;
      ctx.globalAlpha = 1 - t;
      ctx.translate(w / 2, h / 2);
      ctx.scale(sA, sA);
      ctx.translate(-w / 2, -h / 2);
      paintFrom();
      ctx.restore();
      ctx.save();
      const sB = 1.6 - ease * 0.6;
      ctx.globalAlpha = t;
      ctx.translate(w / 2, h / 2);
      ctx.scale(sB, sB);
      ctx.translate(-w / 2, -h / 2);
      paintTo();
      ctx.restore();
      break;
    }
    case "fw_whirl": {
      // Whirl 1/2.frag — swirl rotation between outgoing and incoming frames
      paintFrom();
      ctx.save();
      const ang = t < 0.5 ? t * 3.5 : (1 - t) * 3.5;
      const scale = t < 0.5 ? 1 + t * 0.9 : 1.9 - t * 0.9;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(t < 0.5 ? ang : -ang);
      ctx.scale(Math.max(0.05, Math.min(scale, 2)), Math.max(0.05, Math.min(scale, 2)));
      ctx.translate(-w / 2, -h / 2);
      ctx.globalAlpha = t < 0.5 ? 1 : t;
      if (t < 0.5) paintFrom(); else paintTo();
      ctx.restore();
      break;
    }
    case "fw_evaporate": {
      // Evaporate 1 — painted-lines mask dissolve (uses the real mask PNG)
      const mask = extra._evapMask || (extra._evapMask = (() => {
        const im = new Image();
        im.src = "assets/resources/wfx_effect/Transition/Evaporate 1/Evaporate_Painted%20Lines_mask.png";
        return im;
      })());
      paintFrom();
      if (mask.complete && mask.naturalWidth) {
        ctx.save();
        ctx.globalCompositeOperation = "destination-out";
        ctx.globalAlpha = Math.min(1, t * 1.6);
        ctx.drawImage(mask, 0, 0, w, h);
        ctx.restore();
      }
      ctx.save();
      ctx.globalAlpha = t;
      paintTo();
      ctx.restore();
      break;
    }
    case "fw_fadeblack": {
      // fade_black.frag — sine-shaped dip through black (real curve from .frag)
      const fade = 0.5 * Math.sin(6.2831852 * (t - 0.25)) + 0.5;
      if (t < 0.5) {
        paintFrom();
        ctx.fillStyle = `rgba(0,0,0,${fade})`;
        ctx.fillRect(0, 0, w, h);
      } else {
        paintTo();
        ctx.fillStyle = `rgba(0,0,0,${fade})`;
        ctx.fillRect(0, 0, w, h);
      }
      break;
    }
    case "fw_fadewhite": {
      // fade2.frag — sine-shaped dip through white
      const fade = 0.5 * Math.sin(6.2831852 * (t - 0.25)) + 0.5;
      if (t < 0.5) {
        paintFrom();
        ctx.fillStyle = `rgba(255,255,255,${fade})`;
        ctx.fillRect(0, 0, w, h);
      } else {
        paintTo();
        ctx.fillStyle = `rgba(255,255,255,${fade})`;
        ctx.fillRect(0, 0, w, h);
      }
      break;
    }
  }
  switch (type) {
    case "dissolve": {
      paintFrom();
      ctx.globalAlpha = t;
      paintTo();
      ctx.globalAlpha = 1;
      break;
    }
    case "dipBlack": {
      if (t < 0.5) {
        paintFrom();
        ctx.fillStyle = `rgba(0,0,0,${t * 2})`;
        ctx.fillRect(0, 0, w, h);
      } else {
        paintTo();
        ctx.fillStyle = `rgba(0,0,0,${(1 - t) * 2})`;
        ctx.fillRect(0, 0, w, h);
      }
      break;
    }
    case "dipWhite": {
      if (t < 0.5) {
        paintFrom();
        ctx.fillStyle = `rgba(255,255,255,${t * 2})`;
        ctx.fillRect(0, 0, w, h);
      } else {
        paintTo();
        ctx.fillStyle = `rgba(255,255,255,${(1 - t) * 2})`;
        ctx.fillRect(0, 0, w, h);
      }
      break;
    }
    case "wipeLeft": {
      paintFrom();
      ctx.save();
      ctx.beginPath();
      ctx.rect(w * (1 - t), 0, w * t, h);
      ctx.clip();
      paintTo();
      ctx.restore();
      ctx.fillStyle = "rgba(91,140,255,0.85)";
      ctx.fillRect(w * (1 - t) - 2, 0, 3, h);
      break;
    }
    case "wipeRight": {
      paintFrom();
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w * t, h);
      ctx.clip();
      paintTo();
      ctx.restore();
      ctx.fillStyle = "rgba(91,140,255,0.85)";
      ctx.fillRect(w * t - 1, 0, 3, h);
      break;
    }
    case "slideLeft": {
      paintFrom();
      ctx.save();
      ctx.beginPath();
      ctx.rect(w * (1 - t), 0, w * t, h);
      ctx.clip();
      ctx.translate(w * t, 0);
      paintTo();
      ctx.restore();
      break;
    }
    case "slideRight": {
      paintFrom();
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w * t, h);
      ctx.clip();
      ctx.translate(-w * (1 - t), 0);
      paintTo();
      ctx.restore();
      break;
    }
    case "zoomIn": {
      paintFrom();
      ctx.save();
      const s = 0.7 + t * 0.3;
      ctx.globalAlpha = t;
      ctx.translate(w / 2, h / 2);
      ctx.scale(s, s);
      ctx.translate(-w / 2, -h / 2);
      paintTo();
      ctx.restore();
      break;
    }
    case "zoomOut": {
      paintFrom();
      ctx.save();
      const s = 1.25 - t * 0.25;
      ctx.globalAlpha = t;
      ctx.translate(w / 2, h / 2);
      ctx.scale(s, s);
      ctx.translate(-w / 2, -h / 2);
      paintTo();
      ctx.restore();
      break;
    }
    case "flash": {
      if (t < 0.45) {
        paintFrom();
        ctx.fillStyle = `rgba(255,255,255,${t / 0.45})`;
        ctx.fillRect(0, 0, w, h);
      } else {
        paintTo();
        ctx.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - (t - 0.45) / 0.35)})`;
        ctx.fillRect(0, 0, w, h);
      }
      break;
    }
    case "glitch": {
      paintFrom();
      ctx.save();
      const bands = 6;
      for (let i = 0; i < bands; i++) {
        const y = (h / bands) * i;
        const shift = ((t * 40 + i * 13) % 30) - 15;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, y, w, h / bands);
        ctx.clip();
        ctx.translate(shift, 0);
        ctx.globalAlpha = 0.7 + t * 0.3;
        paintTo();
        ctx.restore();
      }
      if (t > 0.6) {
        ctx.globalAlpha = (t - 0.6) / 0.4;
        paintTo();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = `rgba(91,140,255,${0.15 * Math.sin(t * Math.PI * 6)})`;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      break;
    }
    default: {
      paintFrom();
      ctx.globalAlpha = t;
      paintTo();
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}
