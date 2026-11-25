/* waveform-render.js — turn decoded audio peaks into an SVG path.
 *
 * The timeline draws a waveform inside every audio clip. The path is built
 * from the min/max envelope produced by media-analysis.js: the top edge
 * follows the max sample of each bucket, the bottom edge follows the min,
 * and the shape is closed so it can be filled.
 *
 * Two properties matter for the result to read like a real editor:
 *
 *   • the shape is mirrored around the vertical centre of the box, so the
 *     envelope reads as an RMS shape rather than a one-sided bar chart
 *   • silence collapses to a visible hairline (never a zero-height shape
 *     that would simply disappear) instead of a filled block
 *
 * The function is pure and deterministic so the timeline can call it on every
 * repaint and cache the result by waveformCacheKey().
 */

/** Longest path we are willing to build; keeps repaints cheap. */
const MAX_COLUMNS = 600;

/** Minimum half-thickness in px — a silent track still shows a 1 px line. */
const MIN_HALF_PX = 0.5;

/** Round to 2 decimals so the path string stays small and comparable. */
function r2(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Build the SVG `d` attribute for the waveform of a media region.
 *
 * @param {Float32Array|number[]} peaks interleaved [min, max] per bucket
 * @param {object} opts
 * @param {number} opts.resolution peak buckets per second of media
 * @param {number} opts.offset     source in-point in media seconds
 * @param {number} opts.duration   source span in media seconds
 * @param {number} opts.width      box width in px
 * @param {number} opts.height     box height in px
 * @returns {string} SVG path data, or "" when there is nothing to draw
 */
export function waveformPath(
  peaks,
  { resolution = 100, offset = 0, duration = 1, width = 100, height = 18 } = {}
) {
  try {
    if (!peaks || typeof peaks.length !== "number" || peaks.length < 2) return "";

    const res = Number(resolution);
    const w = Number(width);
    const h = Number(height);
    const off = Number(offset);
    const dur = Number(duration);
    if (!Number.isFinite(res) || res <= 0) return "";
    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return "";
    if (!Number.isFinite(off) || !Number.isFinite(dur) || dur <= 0) return "";

    const columns = Math.max(1, Math.min(MAX_COLUMNS, Math.round(w)));
    const step = w / columns;
    const half = h / 2;

    const tops = new Array(columns);
    const bottoms = new Array(columns);

    for (let c = 0; c < columns; c++) {
      // Each output column covers a slice of media time; every bucket that
      // overlaps that slice contributes to the column's min/max, so a zoomed
      // view never loses a transient that is narrower than one pixel.
      const t0 = off + dur * (c / columns);
      const t1 = off + dur * ((c + 1) / columns);
      let b0 = Math.floor(t0 * res);
      let b1 = Math.ceil(t1 * res);
      if (b1 <= b0) b1 = b0 + 1;

      let lo = 0;
      let hi = 0;
      for (let b = b0; b < b1; b++) {
        const i = b * 2;
        if (i < 0 || i + 1 >= peaks.length) continue;
        const pMin = peaks[i];
        const pMax = peaks[i + 1];
        if (typeof pMin === "number" && pMin < lo) lo = pMin;
        if (typeof pMax === "number" && pMax > hi) hi = pMax;
      }
      tops[c] = Math.min(1, Math.max(0, hi));
      bottoms[c] = Math.min(1, Math.max(0, -lo));
    }

    const parts = [];
    // Top edge, left to right.
    for (let c = 0; c < columns; c++) {
      const x = r2(c * step);
      const y = r2(half - Math.max(MIN_HALF_PX, tops[c] * half));
      parts.push(`${c === 0 ? "M" : "L"}${x} ${y}`);
    }
    // Bottom edge, right to left, so the mirrored halves close into one shape.
    for (let c = columns - 1; c >= 0; c--) {
      const x = r2(c * step);
      const y = r2(half + Math.max(MIN_HALF_PX, bottoms[c] * half));
      parts.push(`L${x} ${y}`);
    }
    parts.push("Z");
    return parts.join("");
  } catch {
    return "";
  }
}

/**
 * Stable cache key for a rendered waveform.
 * The numbers are rounded so floating point noise does not blow up the cache.
 */
export function waveformCacheKey(
  mediaId,
  { offset = 0, duration = 1, width = 100, height = 18 } = {}
) {
  try {
    const n = (value) => {
      const x = Number(value);
      return Number.isFinite(x) ? r2(x) : 0;
    };
    return `wf:${mediaId ?? ""}:${n(offset)}:${n(duration)}:${n(width)}:${n(height)}`;
  } catch {
    return "wf::0:0:0:0";
  }
}
