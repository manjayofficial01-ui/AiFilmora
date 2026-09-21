/* Color Scopes — live waveform, RGB parade, vectorscope and histogram,
 * computed from the program monitor each frame (throttled). */

const SW = 256;
const SH = 144;

function $(sel) {
  return document.querySelector(sel);
}

export function initScopes() {
  const canvas = $("#previewCanvas");
  const scope = $("#scopeCanvas");
  const modeSel = $("#scopeMode");
  const paritySel = $("#scopeParity");
  if (!canvas || !scope) return;
  const sctx = scope.getContext("2d");
  const off = document.createElement("canvas");
  off.width = SW;
  off.height = SH;
  const octx = off.getContext("2d", { willReadFrequently: true });

  let dirty = true;
  let lastDraw = 0;

  function lumaCoefs() {
    return paritySel && paritySel.value === "rec2020"
      ? [0.2627, 0.678, 0.0593]
      : [0.2126, 0.7152, 0.0722];
  }

  function grab() {
    try {
      octx.drawImage(canvas, 0, 0, SW, SH);
    } catch (e) {
      return null;
    }
    return octx.getImageData(0, 0, SW, SH);
  }

  function draw() {
    const img = grab();
    const W = scope.width;
    const H = scope.height;
    sctx.clearRect(0, 0, W, H);
    sctx.fillStyle = "#070a0f";
    sctx.fillRect(0, 0, W, H);
    const mode = modeSel ? modeSel.value : "waveform";
    if (!img) {
      label("No signal");
      return;
    }
    if (mode === "waveform") drawWaveform(img, W, H);
    else if (mode === "parade") drawParade(img, W, H);
    else if (mode === "vectorscope") drawVectorscope(img, W, H);
    else drawHistogram(img, W, H);
  }

  function label(txt) {
    const W = scope.width;
    const H = scope.height;
    sctx.fillStyle = "rgba(255,255,255,0.5)";
    sctx.font = "11px sans-serif";
    sctx.fillText(txt, 8, 16);
  }

  function drawWaveform(img, W, H) {
    const [rC, gC, bC] = lumaCoefs();
    const d = img.data;
    // luma min/max per output column
    const cols = W;
    sctx.strokeStyle = "#9fe7c4";
    sctx.lineWidth = 1;
    sctx.beginPath();
    for (let cx = 0; cx < cols; cx++) {
      const sx = Math.floor((cx / cols) * SW);
      let mn = 255, mx = 0;
      for (let sy = 0; sy < SH; sy++) {
        const i = (sy * SW + sx) * 4;
        const l = rC * d[i] + gC * d[i + 1] + bC * d[i + 2];
        if (l < mn) mn = l;
        if (l > mx) mx = l;
      }
      const yTop = H - (mx / 255) * H;
      const yBot = H - (mn / 255) * H;
      sctx.moveTo(cx + 0.5, yTop);
      sctx.lineTo(cx + 0.5, Math.max(yBot, yTop + 0.5));
    }
    sctx.stroke();
    grid(W, H);
  }

  function drawParade(img, W, H) {
    const d = img.data;
    const bands = 3;
    const bh = Math.floor(H / bands);
    const chans = ["r", "g", "b"];
    const colors = ["#ff6b6b", "#7CFC8A", "#6ba8ff"];
    for (let b = 0; b < bands; b++) {
      const y0 = b * bh;
      sctx.strokeStyle = colors[b];
      sctx.lineWidth = 1;
      sctx.beginPath();
      for (let cx = 0; cx < W; cx++) {
        const sx = Math.floor((cx / W) * SW);
        let mn = 255, mx = 0;
        for (let sy = 0; sy < SH; sy++) {
          const i = (sy * SW + sx) * 4;
          const v = d[i + b];
          if (v < mn) mn = v;
          if (v > mx) mx = v;
        }
        const yTop = y0 + bh - (mx / 255) * bh;
        const yBot = y0 + bh - (mn / 255) * bh;
        sctx.moveTo(cx + 0.5, yTop);
        sctx.lineTo(cx + 0.5, Math.max(yBot, yTop + 0.5));
      }
      sctx.stroke();
      // band separator
      sctx.strokeStyle = "rgba(255,255,255,0.08)";
      sctx.beginPath();
      sctx.moveTo(0, y0);
      sctx.lineTo(W, y0);
      sctx.stroke();
    }
  }

  function drawVectorscope(img, W, H) {
    const d = img.data;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.min(W, H) * 0.45;
    sctx.globalCompositeOperation = "lighter";
    for (let sy = 0; sy < SH; sy += 2) {
      for (let sx = 0; sx < SW; sx += 2) {
        const i = (sy * SW + sx) * 4;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (r + g + b < 12) continue; // skip near-black
        const u = (r - g) / 255;
        const v = (b - g) / 255;
        const px = cx + u * R;
        const py = cy - v * R;
        sctx.fillStyle = "rgba(120,220,255,0.10)";
        sctx.fillRect(px, py, 1.5, 1.5);
      }
    }
    sctx.globalCompositeOperation = "source-over";
    grid(W, H);
    label("vectorscope");
  }

  function drawHistogram(img, W, H) {
    const [rC, gC, bC] = lumaCoefs();
    const d = img.data;
    const bins = 64;
    const counts = new Float32Array(bins);
    let max = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = rC * d[i] + gC * d[i + 1] + bC * d[i + 2];
      const bin = Math.min(bins - 1, Math.floor((l / 255) * bins));
      counts[bin]++;
      if (counts[bin] > max) max = counts[bin];
    }
    sctx.fillStyle = "rgba(159,231,196,0.8)";
    const bw = W / bins;
    for (let b = 0; b < bins; b++) {
      const h = (counts[b] / max) * (H - 4);
      sctx.fillRect(b * bw, H - h, Math.max(1, bw - 0.5), h);
    }
  }

  function grid(W, H) {
    sctx.strokeStyle = "rgba(255,255,255,0.06)";
    sctx.lineWidth = 1;
    sctx.beginPath();
    for (let i = 1; i < 4; i++) {
      const y = (i / 4) * H;
      sctx.moveTo(0, y);
      sctx.lineTo(W, y);
    }
    sctx.stroke();
  }

  function maybeDraw() {
    const now = performance.now();
    if (now - lastDraw < 50) {
      dirty = true;
      return;
    }
    lastDraw = now;
    draw();
    dirty = false;
  }

  window.addEventListener("aifimora:frame", () => {
    if (dirty) return;
    maybeDraw();
  });
  // when paused / scrubbing we still want a repaint; redraw on playhead too
  window.addEventListener("aifimora:playhead", () => {
    if (dirty) return;
    maybeDraw();
  });
  if (modeSel) modeSel.addEventListener("change", draw);
  if (paritySel) paritySel.addEventListener("change", draw);

  // initial
  requestAnimationFrame(() => draw());
}
