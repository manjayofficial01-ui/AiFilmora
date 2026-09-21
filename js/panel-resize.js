/* Draggable panel resizers for the NLE layout */
const KEY = "aifimora.layout.v1";

function loadLayout() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function saveLayout(patch) {
  const cur = loadLayout();
  localStorage.setItem(KEY, JSON.stringify({ ...cur, ...patch }));
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Make a horizontal or vertical splitter work against a CSS custom property
 * on :root, persisted to localStorage.
 */
function bindSplitter(handle, { cssVar, min, max, axis = "x", invert = false }) {
  if (!handle) return;
  handle.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    const startPos = axis === "x" ? e.clientX : e.clientY;
    const rootStyle = getComputedStyle(document.documentElement);
    const startVal = parseFloat(rootStyle.getPropertyValue(cssVar)) || 0;
    document.body.classList.add(axis === "x" ? "resizing-x" : "resizing-y");

    const onMove = (ev) => {
      const pos = axis === "x" ? ev.clientX : ev.clientY;
      let delta = pos - startPos;
      if (invert) delta = -delta;
      const next = clamp(startVal + delta, min, max);
      document.documentElement.style.setProperty(cssVar, `${next}px`);
    };
    const onUp = () => {
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      document.body.classList.remove("resizing-x", "resizing-y");
      const rootStyle2 = getComputedStyle(document.documentElement);
      saveLayout({ [cssVar]: rootStyle2.getPropertyValue(cssVar).trim() });
      window.dispatchEvent(new CustomEvent("aifimora:layout"));
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  });

  handle.addEventListener("dblclick", () => {
    const defaults = {
      "--sidebar-w": "280px",
      "--inspector-w": "320px",
      "--timeline-h": "280px",
    };
    const def = defaults[cssVar] || "280px";
    document.documentElement.style.setProperty(cssVar, def);
    saveLayout({ [cssVar]: def });
    window.dispatchEvent(new CustomEvent("aifimora:layout"));
  });
}

const DEFAULTS = {
  "--sidebar-w": 280,
  "--inspector-w": 320,
  "--timeline-h": 280,
};

function parsePx(v, fallback) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function applySaneLayout() {
  const vw = window.innerWidth || 1400;
  const vh = window.innerHeight || 900;
  // Keep a usable center stage
  const maxSide = Math.min(420, Math.floor(vw * 0.28));
  const maxInsp = Math.min(420, Math.floor(vw * 0.3));
  const maxTl = Math.min(420, Math.floor(vh * 0.45));

  const layout = loadLayout();
  const sb = clamp(parsePx(layout["--sidebar-w"], DEFAULTS["--sidebar-w"]), 200, maxSide);
  const insp = clamp(parsePx(layout["--inspector-w"], DEFAULTS["--inspector-w"]), 240, maxInsp);
  const tl = clamp(parsePx(layout["--timeline-h"], DEFAULTS["--timeline-h"]), 160, maxTl);

  const root = document.documentElement;
  root.style.setProperty("--sidebar-w", `${sb}px`);
  root.style.setProperty("--inspector-w", `${insp}px`);
  root.style.setProperty("--timeline-h", `${tl}px`);
}

export function initPanelResize() {
  applySaneLayout();
  window.addEventListener("resize", applySaneLayout);

  bindSplitter(document.getElementById("resizeSidebar"), {
    cssVar: "--sidebar-w",
    min: 200,
    max: 420,
    axis: "x",
  });
  bindSplitter(document.getElementById("resizeInspector"), {
    cssVar: "--inspector-w",
    min: 240,
    max: 420,
    axis: "x",
    invert: true,
  });
  bindSplitter(document.getElementById("resizeTimeline"), {
    cssVar: "--timeline-h",
    min: 160,
    max: 420,
    axis: "y",
    invert: true,
  });
}
