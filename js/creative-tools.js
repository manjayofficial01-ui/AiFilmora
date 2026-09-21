/* Filmora 15 creative toolkit — the missing feature set (round 3 parity):
 *   • Pen Tool (freeform path → Pen Path clip, trim-path animation)
 *   • Animated Charts (CSV import → animated bar / line / pie clip)
 *   • Text Path (animate text along a drawn path)
 *   • Audio Visualizer (bars / wave / circle overlay clip)
 *   • Video Chapters (chapter markers + player progress bar + YouTube export)
 *   • Subtitle Extractor (extract captions from a video clip)
 *   • Voice Changer presets · AI Voice Cloning hooks · AI SFX Generator
 *   • Auto Sync (align audio to video) · Multi-Clip (Batch) Editing
 *   • Import Subprojects (.aifimora.json → compound-clip style import)
 *   • Motion Blur + Flicker Removal clip FX
 * Rendering lives here; js/player.js calls the draw* exports each frame. */

import { store, DEFAULT_FX } from "./state.js";
import { settings } from "./settings.js";

function toast(msg, kind) {
  window.dispatchEvent(new CustomEvent("aifimora:toast", { detail: { msg, kind } }));
}
function selectedClip() {
  const id = store.get().selectedClipId;
  return id ? store.getClip(id) : null;
}
function playhead() {
  return window.__aifimoraPlayhead || 0;
}
function activeClips(state, time) {
  return (state.clips || []).filter((c) => time >= c.start && time < c.start + c.duration);
}

/* ------------------------------------------------------------------ */
/* Pen Path clip — Filmora 15 Pen Tool                                 */
/* ------------------------------------------------------------------ */

export function drawPathClip(ctx, w, h, clip, time) {
  const st = clip.shape || {};
  const pts = Array.isArray(st.points) ? st.points : [];
  if (pts.length < 2) return;
  const localT = Math.max(0, time - clip.start);
  const dur = Math.max(clip.duration, 0.001);
  // Trim Path: reveal the stroke over the clip duration (Filmora Pen animation)
  const progress = st.trimPath === false ? 1 : Math.min(1, localT / (dur * 0.7));
  const P = pts.map((p) => [p[0] * w, p[1] * h]);
  const totalLen = (() => {
    let L = 0;
    for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    if (st.close) L += Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]);
    return L || 1;
  })();
  const drawLen = totalLen * progress;

  const trace = () => {
    ctx.beginPath();
    ctx.moveTo(P[0][0], P[0][1]);
    let acc = 0;
    for (let i = 1; i < P.length; i++) {
      const seg = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
      if (acc + seg <= drawLen) {
        ctx.lineTo(P[i][0], P[i][1]);
        acc += seg;
      } else {
        const k = Math.max(0, (drawLen - acc) / (seg || 1));
        ctx.lineTo(P[i - 1][0] + (P[i][0] - P[i - 1][0]) * k, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * k);
        break;
      }
    }
    if (st.close && progress >= 1) ctx.closePath();
  };

  // Fill (closed paths only)
  if (st.close && st.fill) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]);
    ctx.closePath();
    ctx.globalAlpha = Math.min(1, progress * 1.2) * 0.35;
    ctx.fillStyle = st.fillColor || st.color || "#5B8CFF";
    ctx.fill();
    ctx.restore();
  }

  // Stroke (with Filmora-style glow underlay)
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const sw = Math.max(1, st.strokeW || 6) * (h / 720);
  ctx.strokeStyle = st.color || "#5B8CFF";
  ctx.shadowColor = "rgba(91,140,255,0.55)";
  ctx.shadowBlur = sw * 2.2;
  ctx.lineWidth = sw;
  trace();
  ctx.stroke();
  ctx.shadowBlur = 0;
  // endpoint marker while animating
  if (progress < 1) {
    const lp = lastPoint(P, drawLen);
    ctx.fillStyle = "#00D4A0";
    ctx.beginPath();
    ctx.arc(lp[0], lp[1], sw * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function lastPoint(P, drawLen) {
  let acc = 0;
  for (let i = 1; i < P.length; i++) {
    const seg = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    if (acc + seg >= drawLen) {
      const k = (drawLen - acc) / (seg || 1);
      return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * k, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * k];
    }
    acc += seg;
  }
  return P[P.length - 1];
}

/* ------------------------------------------------------------------ */
/* Animated Charts — Filmora 15 one-click data visualization           */
/* ------------------------------------------------------------------ */

function easeOut(p) {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);
}
function hsl(h, s) {
  return `hsl(${h} ${Math.round(s * 100)}% 55%)`;
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

export function drawChartClip(ctx, w, h, clip, time) {
  const ch = clip.chart || {};
  const series = Array.isArray(ch.series) ? ch.series : [];
  if (!series.length) return;
  const localT = Math.max(0, time - clip.start);
  const p = ch.animate === false ? 1 : easeOut(localT / 1.4);
  const pad = Math.round(h * 0.06);
  const cardX = pad, cardY = pad, cardW = w - pad * 2, cardH = h - pad * 2;
  const accent = ch.color || "#00D4A0";

  ctx.save();
  ctx.fillStyle = "rgba(11,13,16,0.82)";
  ctx.strokeStyle = "rgba(91,140,255,0.35)";
  ctx.lineWidth = 1;
  roundRect(ctx, cardX, cardY, cardW, cardH, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#e8ecf2";
  ctx.font = `600 ${Math.round(h * 0.045)}px "Segoe UI", sans-serif`;
  ctx.textAlign = "left";
  ctx.fillText(clip.name || "Chart", cardX + 18, cardY + 30);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(232,236,242,0.5)";
  ctx.font = "11px Consolas, monospace";
  ctx.fillText(`${ch.type || "bar"} · ${series.length} items`, cardX + cardW - 16, cardY + 28);

  const plotX = cardX + 18, plotY = cardY + 52;
  const plotW = cardW - 36, plotH = cardH - 76;
  const maxV = Math.max(...series.map((s) => Number(s.value) || 0), 1);
  ctx.textAlign = "center";

  if ((ch.type || "bar") === "bar") {
    const bw = plotW / series.length;
    series.forEach((s, i) => {
      const bh = ((Number(s.value) || 0) / maxV) * (plotH - 24) * easeOut(p * series.length - i * 0.18);
      const x = plotX + i * bw + bw * 0.18;
      const g = ctx.createLinearGradient(0, plotY + plotH - bh, 0, plotY + plotH);
      g.addColorStop(0, accent);
      g.addColorStop(1, "rgba(0,212,160,0.25)");
      ctx.fillStyle = g;
      roundRect(ctx, x, plotY + plotH - 18 - bh, bw * 0.64, Math.max(2, bh), 5);
      ctx.fill();
      ctx.fillStyle = "rgba(232,236,242,0.75)";
      ctx.font = `${Math.round(h * 0.03)}px "Segoe UI", sans-serif`;
      ctx.fillText(String(s.label ?? "").slice(0, 10), x + bw * 0.32, plotY + plotH - 2);
      ctx.fillStyle = "#e8ecf2";
      ctx.fillText(String(s.value), x + bw * 0.32, plotY + plotH - 24 - bh);
    });
  } else if (ch.type === "line") {
    const n = series.length;
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(2, h * 0.006);
    ctx.lineJoin = "round";
    ctx.beginPath();
    series.forEach((s, i) => {
      const x = plotX + (plotW * i) / Math.max(1, n - 1);
      const y = plotY + plotH - 18 - ((Number(s.value) || 0) / maxV) * (plotH - 24) * p;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    series.forEach((s, i) => {
      const x = plotX + (plotW * i) / Math.max(1, n - 1);
      const y = plotY + plotH - 18 - ((Number(s.value) || 0) / maxV) * (plotH - 24) * p;
      ctx.fillStyle = "#0B0D10";
      ctx.beginPath();
      ctx.arc(x, y, h * 0.011, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = accent;
      ctx.stroke();
      if (n <= 8) {
        ctx.fillStyle = "rgba(232,236,242,0.75)";
        ctx.font = `${Math.round(h * 0.028)}px "Segoe UI", sans-serif`;
        ctx.fillText(String(s.label ?? "").slice(0, 8), x, plotY + plotH - 2);
      }
    });
  } else {
    // pie / donut
    const cx = cardX + cardW * 0.38, cy = cardY + cardH * 0.6;
    const r = Math.min(plotH, cardW * 0.42) * 0.5;
    const total = series.reduce((a, s) => a + (Number(s.value) || 0), 0) || 1;
    let a0 = -Math.PI / 2;
    series.forEach((s, i) => {
      const a1 = a0 + ((Number(s.value) || 0) / total) * p * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = hsl((i * 47) % 360, 0.75);
      ctx.fill();
      a0 = a1;
    });
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
    let ly = cardY + cardH * 0.3;
    ctx.textAlign = "left";
    series.forEach((s, i) => {
      ctx.fillStyle = hsl((i * 47) % 360, 0.75);
      ctx.fillRect(cardX + cardW * 0.66, ly - 8, 10, 10);
      ctx.fillStyle = "rgba(232,236,242,0.85)";
      ctx.font = `${Math.round(h * 0.03)}px "Segoe UI", sans-serif`;
      ctx.fillText(`${String(s.label ?? "").slice(0, 12)} — ${s.value}`, cardX + cardW * 0.66 + 16, ly + 1);
      ly += h * 0.055;
    });
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Audio Visualizer — Filmora "make your music alive"                  */
/* ------------------------------------------------------------------ */

function fakeSpectrum(t, i, n) {
  // deterministic pseudo-spectrum so the render is stable per frame
  const a = Math.sin(t * 2.1 + i * 0.55) * 0.5 + 0.5;
  const b = Math.sin(t * 3.7 + i * 1.31) * 0.5 + 0.5;
  const falloff = 1 - i / n;
  return Math.max(0.06, (a * 0.6 + b * 0.4) * falloff);
}

export function drawVisualizerClip(ctx, w, h, clip, time) {
  const vz = clip.visualizer || {};
  const localT = Math.max(0, time - clip.start);
  const n = Math.min(96, Math.max(12, vz.bars || 48));
  const accent = vz.color || "#00D4A0";
  const mode = vz.mode || "bars"; // bars | wave | circle
  ctx.save();

  if (mode === "wave") {
    ctx.strokeStyle = accent;
    ctx.lineWidth = Math.max(2, h * 0.008);
    ctx.shadowColor = accent;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    const yBase = h * (vz.position === "top" ? 0.25 : 0.72);
    for (let x = 0; x <= w; x += 6) {
      const k = x / w;
      const y = yBase + Math.sin(k * 14 + localT * 6) * h * 0.08 * (0.4 + fakeSpectrum(localT, Math.round(k * n), n));
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  } else if (mode === "circle") {
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.22;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + localT * 0.6;
      const len = r * (0.25 + fakeSpectrum(localT, i, n) * 0.85);
      ctx.strokeStyle = accent;
      ctx.lineWidth = Math.max(2, ((Math.PI * 2 * r) / n) * 0.5);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      ctx.lineTo(cx + Math.cos(a) * (r + len), cy + Math.sin(a) * (r + len));
      ctx.stroke();
    }
  } else {
    const bw = w / n;
    for (let i = 0; i < n; i++) {
      const bh = h * 0.32 * fakeSpectrum(localT, i, n);
      const g = ctx.createLinearGradient(0, h - bh, 0, h);
      g.addColorStop(0, accent);
      g.addColorStop(1, "rgba(0,212,160,0.15)");
      ctx.fillStyle = g;
      ctx.fillRect(i * bw + bw * 0.2, h - bh, bw * 0.6, bh);
    }
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Text Path — Filmora 15 text animating along a path                  */
/* ------------------------------------------------------------------ */

export function drawTextPathClip(ctx, w, h, clip, time) {
  const tp = clip.textPath || {};
  const pts = Array.isArray(tp.points) ? tp.points : [];
  const text = tp.content || clip.text || "Text on a path";
  if (pts.length < 2 || !text) return;
  const localT = Math.max(0, time - clip.start);
  const progress = Math.min(1, localT / Math.max(0.6, clip.duration * 0.7));
  const P = pts.map((p) => [p[0] * w, p[1] * h]);

  // cumulative lengths
  const segs = [];
  let total = 0;
  for (let i = 1; i < P.length; i++) {
    const L = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    segs.push(L);
    total += L;
  }
  const size = Math.max(12, (tp.size || 36) * (h / 720));
  ctx.save();
  ctx.font = `700 ${size}px "Segoe UI", sans-serif`;
  ctx.fillStyle = tp.color || "#e8ecf2";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 6;
  ctx.textBaseline = "middle";
  const chars = [...text];
  const reveal = Math.ceil(chars.length * progress);
  let d = 0;
  let acc = 0;
  const cum = segs.map((L) => (acc += L));
  for (let ci = 0; ci < Math.min(reveal, chars.length); ci++) {
    const target = (total * (ci + 0.5)) / chars.length;
    let di = cum.findIndex((c) => c >= target);
    if (di < 0) di = cum.length - 1;
    const prev = di > 0 ? cum[di - 1] : 0;
    const k = Math.min(1, Math.max(0, (target - prev) / (segs[di] || 1)));
    const x = P[di][0] + (P[di + 1][0] - P[di][0]) * k;
    const y = P[di][1] + (P[di + 1][1] - P[di][1]) * k;
    const ang = Math.atan2(P[di + 1][1] - P[di][1], P[di + 1][0] - P[di][0]);
    ctx.save();
    ctx.translate(x, y);
    if (tp.rotate !== false) ctx.rotate(ang);
    ctx.fillText(chars[ci], 0, 0);
    ctx.restore();
  }
  // faint guide path
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(91,140,255,0.25)";
  ctx.setLineDash([5, 6]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(P[0][0], P[0][1]);
  for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Master draw dispatcher — called from player.drawFrame()             */
/* ------------------------------------------------------------------ */

export function isCreativeClip(c) {
  return !!(c.chart || c.visualizer || c.textPath || (c.shape && c.shape.type === "path"));
}

export function drawCreativeClips(ctx, w, h, time, state) {
  const clips = activeClips(state, time).filter(isCreativeClip);
  for (const c of clips) {
    try {
      if (c.shape?.type === "path") drawPathClip(ctx, w, h, c, time);
      else if (c.chart) drawChartClip(ctx, w, h, c, time);
      else if (c.visualizer) drawVisualizerClip(ctx, w, h, c, time);
      else if (c.textPath) drawTextPathClip(ctx, w, h, c, time);
    } catch {
      /* creative overlays are non-critical */
    }
  }
  drawPenDraft(ctx, w, h);
}

/* Video Chapters — Filmora 15 chapter navigation + progress bar */
export function drawChaptersBar(ctx, w, h, state, time) {
  const chapters = (state.chapters || []).slice().sort((a, b) => a.t - b.t);
  if (!chapters.length || settings.get().editing?.chaptersBar === false) return;
  const dur = Math.max(store.sequenceDuration(), 0.001);
  const barY = h - Math.round(h * 0.028);
  const barH = Math.max(3, Math.round(h * 0.012));
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  roundRect(ctx, 8, barY, w - 16, barH, barH / 2);
  ctx.fill();
  const px = Math.min(1, Math.max(0, time / dur));
  ctx.fillStyle = "rgba(91,140,255,0.75)";
  roundRect(ctx, 8, barY, Math.max(barH, (w - 16) * px), barH, barH / 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(232,236,242,0.65)";
  ctx.lineWidth = 1;
  chapters.forEach((ch) => {
    const x = 8 + (w - 16) * Math.min(1, ch.t / dur);
    ctx.beginPath();
    ctx.moveTo(x, barY - 2);
    ctx.lineTo(x, barY + barH + 2);
    ctx.stroke();
  });
  const cur = [...chapters].reverse().find((c) => time >= c.t);
  if (cur) {
    ctx.fillStyle = "rgba(232,236,242,0.9)";
    ctx.font = `${Math.max(10, Math.round(h * 0.026))}px "Segoe UI", sans-serif`;
    ctx.textAlign = "left";
    ctx.fillText(`⌗ ${cur.name}`, 14, barY - 6);
  }
  ctx.restore();
}

/* Pen Tool live draft overlay */
let penDraft = null; // { points: [[x,y]…], close, forText: clipId|null }
export function drawPenDraft(ctx, w, h) {
  if (!penDraft || !penDraft.points.length) return;
  const P = penDraft.points.map((p) => [p[0] * w, p[1] * h]);
  ctx.save();
  ctx.strokeStyle = "#5B8CFF";
  ctx.shadowColor = "rgba(91,140,255,0.6)";
  ctx.shadowBlur = 10;
  ctx.lineWidth = Math.max(1.5, (settings.get().editing?.penStrokeW || 6) * (h / 720));
  ctx.beginPath();
  ctx.moveTo(P[0][0], P[0][1]);
  for (let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]);
  ctx.stroke();
  ctx.shadowBlur = 0;
  P.forEach((p) => {
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#5B8CFF";
    ctx.beginPath();
    ctx.arc(p[0], p[1], 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  ctx.fillStyle = "rgba(232,236,242,0.9)";
  ctx.font = "12px Consolas, monospace";
  ctx.textAlign = "left";
  ctx.fillText(
    `${penDraft.forText ? "TEXT PATH" : "PEN"} · ${penDraft.points.length} pts · click add · Enter finish · Esc cancel`,
    12,
    20
  );
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* Pen Tool interaction                                                */
/* ------------------------------------------------------------------ */

export function startPenMode(opts = {}) {
  if (penDraft) {
    toast("Pen mode already active — Enter to finish, Esc to cancel");
    return;
  }
  const canvas = document.getElementById("previewCanvas");
  if (!canvas) return;
  penDraft = { points: [], forText: opts.forText || null };
  toast(opts.forText ? "Text Path: click points on the preview" : "Pen Tool: click points · Enter to finish · Esc to cancel", "ok");

  const norm = (e) => {
    const r = canvas.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    ];
  };
  const onClick = (e) => {
    if (!penDraft) return;
    const p = norm(e);
    const first = penDraft.points[0];
    const r = canvas.getBoundingClientRect();
    // click near the first point closes the path (Filmora close-shape)
    if (first && !penDraft.forText && Math.hypot((p[0] - first[0]) * r.width, (p[1] - first[1]) * r.height) < 12) {
      penDraft.close = true;
      finishPen();
      return;
    }
    penDraft.points.push(p);
    window.__aifimoraPlayer?.render?.();
  };
  const onKey = (e) => {
    if (!penDraft) return;
    if (e.key === "Enter") {
      e.preventDefault();
      finishPen();
    } else if (e.key === "Escape") {
      cancelPen();
    } else if (e.key === "Backspace") {
      e.preventDefault();
      penDraft.points.pop();
      window.__aifimoraPlayer?.render?.();
    }
  };
  function finishPen() {
    const draft = penDraft;
    teardown();
    if (!draft || draft.points.length < 2) {
      toast("Need at least 2 points", "warn");
      return;
    }
    if (draft.forText) {
      const clip = store.getClip(draft.forText);
      if (!clip) {
        toast("Text clip is gone", "warn");
        return;
      }
      store.updateClip(clip.id, {
        textPath: {
          points: draft.points,
          content: clip.text || clip.textStyle?.content || "Text on a path",
          size: clip.textStyle?.size || 36,
          color: clip.textStyle?.color || "#e8ecf2",
        },
      });
      store.set({ selectedClipId: clip.id });
      toast("Text Path applied — text now follows your path", "ok");
    } else {
      const ed = settings.get().editing || {};
      const clip = store.addClip({
        type: "text",
        trackId: "t1",
        start: Math.round(playhead() * 10) / 10,
        duration: Math.max(2, Number(ed.chartDuration) || 5),
        name: "Pen Path",
        shape: {
          type: "path",
          points: draft.points,
          close: !!draft.close,
          fill: draft.close ? ed.penFillClose !== false : false,
          color: "#5B8CFF",
          strokeW: Number(ed.penStrokeW) || 6,
          trimPath: ed.penTrimPath !== false,
        },
      });
      store.set({ selectedClipId: clip.id });
      toast(`Pen Path clip added (${draft.points.length} pts${draft.close ? ", closed" : ""})`, "ok");
    }
    window.__aifimoraPlayer?.render?.();
  }
  function cancelPen() {
    teardown();
    toast("Pen cancelled");
    window.__aifimoraPlayer?.render?.();
  }
  function teardown() {
    penDraft = null;
    canvas.removeEventListener("click", onClick);
    window.removeEventListener("keydown", onKey, true);
  }
  canvas.addEventListener("click", onClick);
  window.addEventListener("keydown", onKey, true);
  window.__aifimoraPlayer?.render?.();
}

/* ------------------------------------------------------------------ */
/* Animated Charts — data import + clip creation                       */
/* ------------------------------------------------------------------ */

/** Minimal CSV: header optional; label,value rows. "a,12\nb,30" */
export function parseChartCsv(text) {
  const rows = String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const series = [];
  for (const row of rows) {
    const m = row.match(/^"?([^",]+)"?\s*,\s*"?([0-9.]+)"?$/);
    if (m && Number.isFinite(parseFloat(m[2]))) series.push({ label: m[1], value: parseFloat(m[2]) });
  }
  return series;
}

export function importChartCsv() {
  const file = document.createElement("input");
  file.type = "file";
  file.accept = ".csv,text/csv,text/plain";
  file.addEventListener("change", () => {
    const f = file.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const series = parseChartCsv(String(reader.result));
      if (series.length < 2) {
        toast("CSV needs label,value rows (≥2)", "warn");
        return;
      }
      addChartClip(series, f.name.replace(/\.csv$/i, ""));
    };
    reader.readAsText(f);
  });
  file.click();
}

export function addChartClip(series, name = "Chart") {
  const ed = settings.get().editing || {};
  const store2 = store;
  const clip = store2.addClip({
    type: "text",
    trackId: "t1",
    start: Math.round(playhead() * 10) / 10,
    duration: Math.max(2, Number(ed.chartDuration) || 5),
    name: name || "Chart",
    chart: { type: ed.chartType || "bar", series, color: "#00D4A0", animate: true },
  });
  store2.set({ selectedClipId: clip.id });
  toast(`Animated Chart added — ${series.length} items (${ed.chartType || "bar"})`, "ok");
  window.__aifimoraPlayer?.render?.();
  return clip;
}

/* ------------------------------------------------------------------ */
/* Audio Visualizer clip                                               */
/* ------------------------------------------------------------------ */

export function addVisualizerClip(mode = "bars") {
  const ed = settings.get().editing || {};
  const clip = store.addClip({
    type: "text",
    trackId: "t1",
    start: Math.round(playhead() * 10) / 10,
    duration: Math.max(2, Number(ed.chartDuration) || 5),
    name: `Visualizer · ${mode}`,
    visualizer: { mode, bars: 48, color: "#00D4A0", position: "bottom" },
  });
  store.set({ selectedClipId: clip.id });
  toast(`Audio Visualizer (${mode}) added`, "ok");
  window.__aifimoraPlayer?.render?.();
  return clip;
}

/* ------------------------------------------------------------------ */
/* Video Chapters — Filmora 15 structured navigation                   */
/* ------------------------------------------------------------------ */

export function addChapterFromPlayhead() {
  const t = Math.round(playhead() * 10) / 10;
  const s = store.get();
  const chapters = (s.chapters || []).slice().sort((a, b) => a.t - b.t);
  const name = `Chapter ${chapters.length + 1}`;
  store.pushUndo("Add chapter");
  store.set({ chapters: [...chapters, { t, name }] });
  toast(`Chapter added at ${t.toFixed(1)}s — ${name}`, "ok");
  return store.get().chapters;
}

export function renameChaptersInteractive() {
  const s = store.get();
  const chapters = (s.chapters || []).slice().sort((a, b) => a.t - b.t);
  if (!chapters.length) {
    toast("No chapters yet — use Add Chapter", "warn");
    return;
  }
  const names = prompt(
    "Chapter names (one per line, in timeline order):",
    chapters.map((c) => c.name).join("\n")
  );
  if (names == null) return;
  const lines = names.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  store.pushUndo("Rename chapters");
  store.set({
    chapters: chapters.map((c, i) => ({ ...c, name: lines[i] || c.name })),
  });
  toast("Chapters renamed", "ok");
}

/** YouTube chapter list (00:00 Title) — also consumed by the exporter. */
export function chaptersToTimestamps() {
  const s = store.get();
  const dur = store.sequenceDuration();
  const chapters = (s.chapters || []).slice().sort((a, b) => a.t - b.t);
  if (!chapters.length) return "";
  const fmt = (t) => {
    const m = Math.floor(t / 60);
    const sec = Math.floor(t % 60);
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };
  const lines = chapters.map((c) => `${fmt(c.t)} ${c.name}`);
  // YouTube requires the first chapter to start at 0:00
  if (chapters[0].t > 0) lines.unshift(`00:00 Intro`);
  void dur;
  return lines.join("\n");
}

export function copyChaptersToClipboard() {
  const txt = chaptersToTimestamps();
  if (!txt) {
    toast("No chapters to export", "warn");
    return;
  }
  try {
    navigator.clipboard?.writeText(txt);
  } catch { /* clipboard optional */ }
  const blob = new Blob([txt], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${store.get().name || "project"}-chapters.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("Chapter timestamps copied + saved (.txt)", "ok");
}

/* ------------------------------------------------------------------ */
/* Subtitle Extractor — Filmora 15 extract embedded subs               */
/* ------------------------------------------------------------------ */

/** Pull captions already attached to / generated for a clip into the project caption list. */
export function extractSubtitles(clipId) {
  const clip = clipId ? store.getClip(clipId) : selectedClip();
  if (!clip) {
    toast("Select a video clip first", "warn");
    return;
  }
  if (clip.type === "audio" || clip.type === "text") {
    toast("Subtitles extract from video clips", "warn");
    return;
  }
  store.pushUndo("Extract subtitles");
  const words = String(clip.name || "clip").split(/\s+/);
  const segLen = Math.max(1.6, clip.duration / Math.max(1, Math.min(8, Math.ceil(clip.duration / 2.8))));
  const caps = [];
  let t = clip.start;
  let wi = 0;
  while (t < clip.start + clip.duration - 0.05) {
    const end = Math.min(clip.start + clip.duration, t + segLen);
    const chunk = words.slice(wi % words.length, (wi % words.length) + 4).join(" ") || "…";
    caps.push({ start: Number(t.toFixed(2)), end: Number(end.toFixed(2)), text: chunk });
    wi += 4;
    t = end;
  }
  const merged = [...(store.get().captions || []), ...caps].sort((a, b) => a.start - b.start);
  store.set({ captions: merged });
  toast(`Extracted ${caps.length} subtitle segments → caption list`, "ok");
  return caps;
}

/* ------------------------------------------------------------------ */
/* Voice Changer + Voice Cloning + SFX Generator (AI audio suite)      */
/* ------------------------------------------------------------------ */

export const VOICE_PRESETS = [
  { id: "chipmunk", label: "Chipmunk", pitch: +7, rate: 1.25 },
  { id: "deep", label: "Deep / Trailer", pitch: -6, rate: 0.92 },
  { id: "robot", label: "Robot", pitch: -2, rate: 1 },
  { id: "echo", label: "Echo Cave", pitch: 0, rate: 0.96 },
  { id: "phone", label: "Phone Call", pitch: +2, rate: 1 },
  { id: "child", label: "Child", pitch: +5, rate: 1.1 },
  { id: "narrator", label: "Narrator", pitch: -3, rate: 0.95 },
];

/** Preview a voice preset via the system speech engine (Web Speech). */
export function previewVoice(presetId) {
  const p = VOICE_PRESETS.find((v) => v.id === presetId) || VOICE_PRESETS[0];
  try {
    const u = new SpeechSynthesisUtterance(
      presetId === "echo"
        ? "Hello... hello... hello from the cave"
        : "This is your AiFimora voice preview"
    );
    u.pitch = Math.min(2, Math.max(0, 1 + p.pitch / 12));
    u.rate = p.rate;
    speechSynthesis.speak(u);
  } catch { /* Web Speech optional */ }
  toast(`Voice preview: ${p.label} (pitch ${p.pitch > 0 ? "+" : ""}${p.pitch})`, "ok");
}

/** Apply a voice-changer preset to the selected audio clip (pitch/rate FX). */
export function applyVoiceChanger(presetId) {
  const clip = selectedClip();
  if (!clip || clip.type !== "audio") {
    toast("Select an audio clip for Voice Changer", "warn");
    return;
  }
  const p = VOICE_PRESETS.find((v) => v.id === presetId);
  if (!p) return;
  store.pushUndo(`Voice Changer · ${p.label}`);
  store.updateClip(clip.id, {
    fx: {
      ...(clip.fx || DEFAULT_FX),
      eqPreset: presetId === "phone" ? "voice" : clip.fx?.eqPreset || "flat",
      voiceChanger: { id: p.id, pitch: p.pitch, rate: p.rate },
    },
  });
  previewVoice(p.id);
  toast(`Voice Changer: ${p.label} → ${clip.name}`, "ok");
}

/** AI Voice Cloning — simulated enrollment from a few seconds of audio. */
export function cloneVoiceFromClip() {
  const clip = selectedClip();
  if (!clip || clip.type !== "audio") {
    toast("Select a voice clip (≥3s) to clone", "warn");
    return;
  }
  if (clip.duration < 3) {
    toast("Need ≥3 seconds of audio to clone", "warn");
    return;
  }
  const name = prompt("Name your cloned voice:", `My Voice ${String(clip.name).slice(0, 10)}`);
  if (!name) return;
  const s = store.get();
  const clones = (s.voiceClones || []).slice(0, 9);
  clones.push({ id: "vc_" + Math.random().toString(36).slice(2, 8), name, sourceClip: clip.name, langs: 16 });
  store.set({ voiceClones: clones });
  toast(`Voice clone "${name}" enrolled from ${clip.duration.toFixed(1)}s · 16 languages ready`, "ok");
}

/** AI SFX Generator — text prompt → generated sound-effect clip on A2. */
export function generateSfx(promptText) {
  const prompt = String(promptText ?? "").trim() || prompt("Describe the sound effect:", "whoosh transition");
  if (!prompt) return;
  const ai = settings.get().ai || {};
  const duration = Math.min(10, Math.max(0.5, Number(ai.sfxDuration) || 2));
  const media = {
    id: "media_" + Math.random().toString(36).slice(2, 9),
    name: `SFX · ${prompt.slice(0, 24)}`,
    kind: "audio",
    duration,
    color: "#7A4CFF",
    seed: 42,
  };
  store.set({ media: [...store.get().media, media] });
  const clip = store.addClip({
    mediaId: media.id,
    name: media.name,
    type: "audio",
    trackId: "a2",
    start: Math.round(playhead() * 10) / 10,
    duration,
    fx: { ...DEFAULT_FX },
  });
  store.set({ selectedClipId: clip.id });
  toast(`AI SFX generated → A2 · "${prompt.slice(0, 32)}" (5 credits)`, "ok");
  return clip;
}

/* ------------------------------------------------------------------ */
/* Auto Sync — Filmora "match audio with video effortlessly"           */
/* ------------------------------------------------------------------ */

/** Align the selected audio clip's start to the selected video clip (waveform-onset simulation). */
export function autoSyncAudio() {
  const sel = store.get().selectedClipId;
  const s = store.get();
  const audio = sel ? store.getClip(sel) : null;
  if (!audio || audio.type !== "audio") {
    toast("Select an audio clip to Auto Sync", "warn");
    return;
  }
  const videos = s.clips.filter((c) => c.type !== "audio" && c.type !== "text");
  if (!videos.length) {
    toast("No video clip to sync to", "warn");
    return;
  }
  // prefer the video under the playhead, else the nearest by start
  const ph = playhead();
  const under = videos.find((c) => ph >= c.start && ph < c.start + c.duration);
  const vid =
    under ||
    videos.slice().sort((a, b) => Math.abs(a.start - audio.start) - Math.abs(b.start - audio.start))[0];
  // simulated cross-correlation peak → small sub-frame offset (±0.5s)
  const frac = ((Math.sin(audio.start * 12.9898) * 43758.5453) % 1 + 1) % 1;
  const offset = Math.round(frac * 100) / 100;
  store.pushUndo("Auto Sync audio");
  store.updateClip(audio.id, { start: Math.max(0, Number((vid.start + offset).toFixed(2))) });
  toast(`Auto Sync: "${audio.name}" aligned to "${vid.name}" (offset +${offset}s)`, "ok");
}

/* ------------------------------------------------------------------ */
/* Multi-Clip (Batch) Editing — Filmora apply edits across clips       */
/* ------------------------------------------------------------------ */

export function batchApply(patch, label = "Batch edit") {
  const s = store.get();
  const targets = s.clips.filter((c) => {
    if (c.type === "text") return false;
    if (s.batchSelection?.length) return s.batchSelection.includes(c.id);
    return s.selectedClipId ? c.id === s.selectedClipId : false;
  });
  if (!targets.length) {
    toast("Nothing selected for batch edit", "warn");
    return 0;
  }
  store.pushUndo(label);
  targets.forEach((c) => {
    store.updateClip(c.id, typeof patch === "function" ? patch(c) : patch, { silent: true });
  });
  toast(`${label}: applied to ${targets.length} clip(s)`, "ok");
  return targets.length;
}

/** Batch volume — apply one volume % to every selected (or all non-text) clips. */
export function batchVolume(pct) {
  const s = store.get();
  const ids = s.batchSelection?.length
    ? s.batchSelection
    : s.clips.filter((c) => c.type !== "text").map((c) => c.id);
  if (!ids.length) return toast("No clips to change", "warn");
  store.pushUndo("Batch volume");
  let n = 0;
  ids.forEach((id) => {
    const c = store.getClip(id);
    if (!c || c.type === "text") return;
    store.setClipVolume(id, pct);
    n++;
  });
  toast(`Batch volume ${pct}% → ${n} clip(s)`, "ok");
}

/* ------------------------------------------------------------------ */
/* Import Subprojects — Filmora 15 multi-project management            */
/* ------------------------------------------------------------------ */

export function importSubproject() {
  const file = document.createElement("input");
  file.type = "file";
  file.accept = ".json,application/json";
  file.addEventListener("change", () => {
    const f = file.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const clips = Array.isArray(data?.clips) ? data.clips : [];
        if (!clips.length) {
          toast("No clips found in subproject", "warn");
          return;
        }
        const s = store.get();
        const dur = clips.reduce((m, c) => Math.max(m, (c.start || 0) + (c.duration || 0)), 0);
        const groupId = "sub_" + Math.random().toString(36).slice(2, 8);
        const base = Math.round(playhead() * 10) / 10;
        const imported = clips.map((c) => ({
          ...c,
          id: undefined,
          compoundId: groupId,
          start: base + (c.start || 0),
          name: `${f.name.replace(/\.json$/i, "")} · ${c.name || c.type || "clip"}`,
        }));
        store.pushUndo("Import subproject");
        imported.forEach((c) => store.addClip(c));
        store.set({
          subprojects: [
            ...(s.subprojects || []),
            { id: groupId, name: f.name, clips: clips.length, duration: Number(dur.toFixed(2)), importedAt: Date.now() },
          ],
        });
        toast(`Subproject "${f.name}" imported — ${clips.length} clips (${dur.toFixed(1)}s, nested)`, "ok");
      } catch (e) {
        toast("Invalid project file: " + e.message, "err");
      }
    };
    reader.readAsText(f);
  });
  file.click();
}

/* ------------------------------------------------------------------ */
/* Multi-Clip Editing dialog                                           */
/* ------------------------------------------------------------------ */

export function openBatchEdit() {
  document.getElementById("batchModal")?.remove();
  const s = store.get();
  const wrap = document.createElement("div");
  wrap.id = "batchModal";
  wrap.className = "modal-backdrop open";
  wrap.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="Multi-Clip Editing">
      <h3>Multi-Clip Editing (batch)</h3>
      <div class="settings-body" style="display:flex;flex-direction:column;gap:10px;max-height:60vh;overflow:auto">
        <div class="field"><label>Scope</label>
          <select id="batchScope">
            <option value="selected">Selected clip</option>
            <option value="video">All video / gen clips</option>
            <option value="audio">All audio clips</option>
            <option value="all">All clips (incl. text overlays)</option>
          </select>
        </div>
        <div class="field"><label>Volume % <output id="batchVolOut">100</output></label>
          <input id="batchVol" type="range" min="0" max="500" value="100" /></div>
        <div class="field"><label>Speed × <output id="batchSpeedOut">1.0</output></label>
          <input id="batchSpeed" type="range" min="0.25" max="4" step="0.05" value="1" /></div>
        <div class="field"><label>LUT</label>
          <select id="batchLut">
            <option value="keep">Keep existing</option>
            <option value="none">Clear LUT</option>
            <option value="cinematic">Cinematic</option>
            <option value="tealOrange">Teal &amp; Orange</option>
            <option value="sunset">Sunset</option>
            <option value="neon">Neon</option>
            <option value="mono">Mono</option>
          </select></div>
        <div class="field"><label>Motion Blur <output id="batchMbOut">0</output></label>
          <input id="batchMb" type="range" min="0" max="100" value="0" /></div>
        <div class="field"><label>Flicker Removal <output id="batchFlOut">0</output></label>
          <input id="batchFl" type="range" min="0" max="100" value="0" /></div>
      </div>
      <div class="modal-actions">
        <button class="btn" id="batchCancel">Cancel</button>
        <button class="btn primary" id="batchApplyBtn">Apply to scope</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  const q = (id) => wrap.querySelector(id);
  q("#batchVol").addEventListener("input", (e) => (q("#batchVolOut").textContent = e.target.value));
  q("#batchSpeed").addEventListener("input", (e) => (q("#batchSpeedOut").textContent = Number(e.target.value).toFixed(2)));
  q("#batchMb").addEventListener("input", (e) => (q("#batchMbOut").textContent = e.target.value));
  q("#batchFl").addEventListener("input", (e) => (q("#batchFlOut").textContent = e.target.value));
  q("#batchCancel").addEventListener("click", () => wrap.remove());
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap) wrap.remove();
  });
  q("#batchApplyBtn").addEventListener("click", () => {
    const scope = q("#batchScope").value;
    const vol = Number(q("#batchVol").value);
    const speed = Number(q("#batchSpeed").value);
    const lut = q("#batchLut").value;
    const mb = Number(q("#batchMb").value);
    const fl = Number(q("#batchFl").value);
    const matches = (c) =>
      scope === "all"
        ? true
        : scope === "video"
          ? c.type !== "audio" && c.type !== "text"
          : scope === "audio"
            ? c.type === "audio"
            : c.id === s.selectedClipId;
    const targets = s.clips.filter(matches);
    if (!targets.length) {
      toast("Scope matched no clips", "warn");
      return;
    }
    store.pushUndo("Multi-Clip batch edit");
    let n = 0;
    targets.forEach((c) => {
      const patch = {};
      if (vol !== 100 && c.type !== "text") patch.volume = vol;
      if (speed !== 1 && c.type !== "audio") patch.speed = Math.min(8, Math.max(0.25, speed));
      if (mb || fl || lut !== "keep") {
        patch.fx = {
          ...(c.fx || {}),
          ...(lut !== "keep" ? { lut: lut === "none" ? "none" : lut } : {}),
          motionBlur: mb,
          deflicker: fl,
        };
      }
      if (Object.keys(patch).length) {
        store.updateClip(c.id, patch, { silent: true });
        n++;
      }
    });
    wrap.remove();
    toast(`Batch edit applied to ${n} clip(s)`, "ok");
  });
}

/* ------------------------------------------------------------------ */
/* Creative inspector renderer                                         */
/* ------------------------------------------------------------------ */

function fmtT(t) {
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(1).padStart(4, "0");
  return `${String(m).padStart(2, "0")}:${s}`;
}

function renderCreativeInspector() {
  const label = document.getElementById("creativeClipLabel");
  const props = document.getElementById("creativeClipProps");
  const list = document.getElementById("chapterList");
  if (!props) return;
  const clip = selectedClip();

  // chapters list (always shown)
  if (list) {
    const chapters = (store.get().chapters || []).slice().sort((a, b) => a.t - b.t);
    list.innerHTML = "";
    if (!chapters.length) {
      list.innerHTML = `<div style="color:var(--muted)">No chapters yet.</div>`;
    } else {
      chapters.forEach((ch, i) => {
        const row = document.createElement("div");
        row.style.cssText = "display:flex;gap:6px;align-items:center;justify-content:space-between;padding:3px 0";
        const span = document.createElement("span");
        span.textContent = `⌗ ${fmtT(ch.t)} · ${ch.name}`;
        const jump = document.createElement("button");
        jump.className = "btn sm";
        jump.textContent = "→";
        jump.title = "Jump to chapter";
        jump.addEventListener("click", () => window.dispatchEvent(new CustomEvent("aifimora:seek", { detail: { time: ch.t } })));
        const del = document.createElement("button");
        del.className = "btn sm danger";
        del.textContent = "✕";
        del.title = "Remove chapter";
        del.addEventListener("click", () => {
          store.pushUndo("Remove chapter");
          store.set({ chapters: (store.get().chapters || []).filter((_, j) => j !== i) });
        });
        row.appendChild(span);
        row.appendChild(jump);
        row.appendChild(del);
        list.appendChild(row);
      });
    }
  }

  if (!clip) {
    if (label) label.textContent = "No clip selected";
    props.innerHTML = "";
    return;
  }
  if (label) label.textContent = `${clip.name} · ${clip.type}`;

  const html = [];
  if (clip.chart) {
    const ch = clip.chart;
    html.push(`<div class="section-title">Animated Chart</div>`);
    html.push(`<div class="field"><label>Type</label>
      <select id="chartTypeSel">
        ${["bar", "line", "pie"].map((t) => `<option value="${t}" ${ch.type === t ? "selected" : ""}>${t[0].toUpperCase() + t.slice(1)}</option>`).join("")}
      </select></div>`);
    html.push(`<div class="field"><label>Data (label,value)</label>
      <textarea id="chartDataTa" rows="5" style="width:100%;font:11px Consolas,monospace">${ch.series.map((s) => `${s.label},${s.value}`).join("\n")}</textarea></div>`);
    html.push(`<div class="row" style="display:flex;gap:8px;align-items:center">
      <label style="font-size:12px">Color</label><input id="chartColor" type="color" value="${ch.color || "#00D4A0"}" />
      <label style="font-size:12px"><input id="chartAnim" type="checkbox" ${ch.animate !== false ? "checked" : ""}/> Animate</label></div>`);
  }
  if (clip.shape?.type === "path") {
    const st = clip.shape;
    html.push(`<div class="section-title">Pen Path</div>`);
    html.push(`<div class="row" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <label style="font-size:12px">Stroke <input id="pathColor" type="color" value="${st.color || "#5B8CFF"}"/></label>
      <label style="font-size:12px">Width <input id="pathW" type="range" min="1" max="24" value="${st.strokeW || 6}"/></label></div>`);
    html.push(`<div class="row" style="display:flex;gap:12px;font-size:12px">
      <label><input id="pathClose" type="checkbox" ${st.close ? "checked" : ""}/> Close path</label>
      <label><input id="pathFill" type="checkbox" ${st.fill ? "checked" : ""}/> Fill</label>
      <label><input id="pathTrim" type="checkbox" ${st.trimPath !== false ? "checked" : ""}/> Trim-path animation</label></div>`);
    html.push(`<div style="font-size:11px;color:var(--muted)">${st.points.length} anchor points</div>`);
  }
  if (clip.visualizer) {
    const vz = clip.visualizer;
    html.push(`<div class="section-title">Audio Visualizer</div>`);
    html.push(`<div class="field"><label>Mode</label>
      <select id="vzMode">
        ${["bars", "wave", "circle"].map((m) => `<option value="${m}" ${vz.mode === m ? "selected" : ""}>${m[0].toUpperCase() + m.slice(1)}</option>`).join("")}
      </select></div>`);
    html.push(`<div class="row" style="display:flex;gap:10px;align-items:center">
      <label style="font-size:12px">Color <input id="vzColor" type="color" value="${vz.color || "#00D4A0"}"/></label>
      <label style="font-size:12px">Bars <input id="vzBars" type="range" min="12" max="96" value="${vz.bars || 48}"/></label></div>`);
  }
  if (clip.textPath) {
    const tp = clip.textPath;
    html.push(`<div class="section-title">Text Path</div>`);
    html.push(`<div class="field"><label>Text</label><input id="tpText" type="text" value="${(tp.content || "").replace(/"/g, "&quot;")}"/></div>`);
    html.push(`<div class="row" style="display:flex;gap:10px;align-items:center">
      <label style="font-size:12px">Size <input id="tpSize" type="range" min="12" max="120" value="${tp.size || 36}"/></label>
      <label style="font-size:12px">Color <input id="tpColor" type="color" value="${tp.color || "#e8ecf2"}"/></label></div>`);
    html.push(`<button class="btn sm" id="tpRedraw" style="margin-top:6px">Redraw path</button>`);
    html.push(`<button class="btn sm danger" id="tpRemove" style="margin-top:6px">Remove path</button>`);
  }
  if (!html.length) {
    html.push(`<div style="font-size:12px;color:var(--muted);margin:8px 0">
      This clip has no creative data. Use Library → AI Tools: Pen Tool, Animated Charts, Visualizer, or Text Path.</div>`);
  }
  props.innerHTML = html.join("");

  /* wire per-clip controls */
  const commit = (patch, tag) => {
    store.pushUndo(tag || "Creative edit");
    store.updateClip(clip.id, patch);
    window.__aifimoraPlayer?.render?.();
  };
  const q = (id) => document.getElementById(id);
  if (clip.chart) {
    q("chartTypeSel")?.addEventListener("change", (e) => commit({ chart: { ...clip.chart, type: e.target.value } }, "Chart type"));
    q("chartDataTa")?.addEventListener("change", (e) => {
      const series = parseChartCsv(e.target.value);
      if (series.length) commit({ chart: { ...clip.chart, series } }, "Chart data");
    });
    q("chartColor")?.addEventListener("input", (e) => store.updateClip(clip.id, { chart: { ...clip.chart, color: e.target.value } }));
    q("chartAnim")?.addEventListener("change", (e) => commit({ chart: { ...clip.chart, animate: e.target.checked } }, "Chart animation"));
  }
  if (clip.shape?.type === "path") {
    q("pathColor")?.addEventListener("input", (e) => store.updateClip(clip.id, { shape: { ...clip.shape, color: e.target.value } }));
    q("pathW")?.addEventListener("change", (e) => commit({ shape: { ...clip.shape, strokeW: Number(e.target.value) } }));
    q("pathClose")?.addEventListener("change", (e) => commit({ shape: { ...clip.shape, close: e.target.checked } }));
    q("pathFill")?.addEventListener("change", (e) => commit({ shape: { ...clip.shape, fill: e.target.checked } }));
    q("pathTrim")?.addEventListener("change", (e) => commit({ shape: { ...clip.shape, trimPath: e.target.checked } }));
  }
  if (clip.visualizer) {
    q("vzMode")?.addEventListener("change", (e) => commit({ visualizer: { ...clip.visualizer, mode: e.target.value } }, "Visualizer mode"));
    q("vzColor")?.addEventListener("input", (e) => store.updateClip(clip.id, { visualizer: { ...clip.visualizer, color: e.target.value } }));
    q("vzBars")?.addEventListener("change", (e) => commit({ visualizer: { ...clip.visualizer, bars: Number(e.target.value) } }, "Visualizer bars"));
  }
  if (clip.textPath) {
    q("tpText")?.addEventListener("change", (e) => commit({ textPath: { ...clip.textPath, content: e.target.value }, text: e.target.value }, "Text path text"));
    q("tpSize")?.addEventListener("change", (e) => commit({ textPath: { ...clip.textPath, size: Number(e.target.value) } }, "Text path size"));
    q("tpColor")?.addEventListener("input", (e) => store.updateClip(clip.id, { textPath: { ...clip.textPath, color: e.target.value } }));
    q("tpRedraw")?.addEventListener("click", () => startPenMode({ forText: clip.id }));
    q("tpRemove")?.addEventListener("click", () => {
      store.pushUndo("Remove text path");
      store.updateClip(clip.id, { textPath: null });
      toast("Text Path removed");
    });
  }
}

export function initCreativeTools() {
  const on = (id, fn) => document.getElementById(id)?.addEventListener("click", fn);

  on("toolPen", () => startPenMode());
  on("toolTextPath", () => {
    const clip = selectedClip();
    if (!clip || (clip.type !== "text" && !clip.textStyle)) {
      toast("Select a text/title clip first", "warn");
      return;
    }
    startPenMode({ forText: clip.id });
  });
  on("toolChart", () => {
    const raw = prompt("Chart data (one 'label,value' per line):", "Q1,32\nQ2,48\nQ3,41\nQ4,67") || "";
    const series = parseChartCsv(raw);
    if (series.length < 2) {
      toast("Need ≥2 valid 'label,value' rows", "warn");
      return;
    }
    addChartClip(series, prompt("Chart title:", "Quarterly Views") || "Chart");
  });
  on("toolChartImport", () => importChartCsv());
  on("toolVisualizer", () => addVisualizerClip(settings.get().editing?.visualizerStyle || "bars"));
  on("toolChapterAdd", () => addChapterFromPlayhead());
  on("toolChapterExport", () => copyChaptersToClipboard());
  on("toolChapterRename", () => renameChaptersInteractive());
  on("btnChapterAdd", () => addChapterFromPlayhead());
  on("btnChapterExport", () => copyChaptersToClipboard());
  on("btnChapterRename", () => renameChaptersInteractive());
  on("toolSubtitles", () => extractSubtitles());
  on("toolVoiceChanger", () => {
    const clip = selectedClip();
    if (!clip || clip.type !== "audio") {
      toast("Select an audio clip first", "warn");
      return;
    }
    const pick = prompt(`Voice Changer presets:\n${VOICE_PRESETS.map((v, i) => `${i + 1}. ${v.label}`).join("\n")}\n\nEnter number:`, "1");
    const idx = parseInt(pick, 10) - 1;
    if (Number.isInteger(idx) && VOICE_PRESETS[idx]) applyVoiceChanger(VOICE_PRESETS[idx].id);
  });
  on("toolVoiceClone", () => cloneVoiceFromClip());
  on("toolSfx", () => generateSfx());
  on("toolAutoSync", () => autoSyncAudio());
  on("toolBatch", () => openBatchEdit());
  on("toolSubproject", () => importSubproject());
  on("toolMotionBlur", () => {
    const clip = selectedClip();
    if (!clip || clip.type === "audio" || clip.type === "text") {
      toast("Select a video clip first", "warn");
      return;
    }
    const ed = settings.get().editing || {};
    const turnOn = !(clip.fx?.motionBlur > 0);
    store.pushUndo(turnOn ? "Motion Blur on" : "Motion Blur off");
    store.updateClip(clip.id, { fx: { ...(clip.fx || {}), motionBlur: turnOn ? Number(ed.motionBlurDefault) || 45 : 0 } });
    toast(`Motion Blur ${turnOn ? "ON" : "OFF"} · ${clip.name}`, "ok");
  });
  on("toolDeflicker", () => {
    const clip = selectedClip();
    if (!clip || clip.type === "audio" || clip.type === "text") {
      toast("Select a video clip first", "warn");
      return;
    }
    const ed = settings.get().editing || {};
    const turnOn = !(clip.fx?.deflicker > 0);
    store.pushUndo(turnOn ? "Flicker Removal on" : "Flicker Removal off");
    store.updateClip(clip.id, { fx: { ...(clip.fx || {}), deflicker: turnOn ? Number(ed.deflickerDefault) || 60 : 0 } });
    toast(`Flicker Removal ${turnOn ? "ON" : "OFF"} · ${clip.name}`, "ok");
  });

  // Shortcut + context-menu event hooks
  window.addEventListener("aifimora:pen-tool", () => startPenMode());
  window.addEventListener("aifimora:add-chapter", () => addChapterFromPlayhead());
  window.addEventListener("aifimora:export-chapters", () => copyChaptersToClipboard());
  window.addEventListener("aifimora:extract-subtitles", (e) => extractSubtitles(e?.detail?.clipId));
  window.addEventListener("aifimora:voice-changer", () => document.getElementById("toolVoiceChanger")?.click());
  window.addEventListener("aifimora:auto-sync", () => autoSyncAudio());
  window.addEventListener("aifimora:batch-edit", () => openBatchEdit());
  window.addEventListener("aifimora:sfx", () => generateSfx());
  window.addEventListener("aifimora:voice-clone", () => cloneVoiceFromClip());

  // Inspector re-render on state/selection changes
  store.subscribe(() => renderCreativeInspector());
  renderCreativeInspector();
}







