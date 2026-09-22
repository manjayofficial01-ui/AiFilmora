/* icons.js — inline SVG icon library used across the Filmora-inspired shell.
 *
 * Each export is a 16×16 viewBox SVG string. They follow a consistent stroke / fill
 * language so they recolor cleanly with currentColor (the host rule sets color via
 * CSS). Add new icons by exporting another `iconXxx` function that returns the raw
 * SVG markup (no <svg> wrapper) so callers can place it inside their own button. */

const _icon = (path, viewBox = "0 0 16 16") =>
  `<svg viewBox="${viewBox}" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;

/* --- Library tabs --------------------------------------------------------- */
export const iconMedia        = _icon(`<rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 6h12M6 3v10M10 3v10"/><path d="M4 5h.01M4 8h.01M4 11h.01M12 5h.01M12 8h.01M12 11h.01"/>`);
export const iconText         = _icon(`<path d="M4 4h8M8 4v9M5.5 13h5"/>`);
export const iconShapes       = _icon(`<rect x="2" y="9" width="5" height="5" rx="1"/><circle cx="11.5" cy="5" r="2.5"/><path d="M2 5l4-3 4 3" />`);
export const iconEffects      = _icon(`<path d="M8 2l1.5 3.3 3.5.4-2.6 2.4.8 3.4L8 9.8 4.8 11.5l.8-3.4L3 5.7l3.5-.4z"/>`);
export const iconTransitions  = _icon(`<rect x="1.5" y="4" width="5" height="8" rx="1"/><rect x="9.5" y="4" width="5" height="8" rx="1"/><path d="M6.5 8l3-2.5-3-2.5" fill="currentColor"/>`);
export const iconAiTools      = _icon(`<path d="M8 1.5l1.8 3.7 4 .5-3 2.7.8 4-3.6-2-3.6 2 .8-4-3-2.7 4-.5z" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r="1.2" fill="currentColor" stroke="none" opacity=".5"/>`);

/* --- Inspector tabs ------------------------------------------------------- */
export const iconFx           = _icon(`<circle cx="8" cy="8" r="5"/><circle cx="8" cy="8" r="2" fill="currentColor" stroke="none"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.7 3.7l1.4 1.4M10.9 10.9l1.4 1.4M3.7 12.3l1.4-1.4M10.9 5.1l1.4-1.4"/>`);
export const iconMotion       = _icon(`<path d="M2 8a6 6 0 0 1 12 0M14 8a6 6 0 0 1-12 0"/><path d="M5 4l2 2-2 2M11 12l2-2-2-2"/>`);
export const iconSpeed        = _icon(`<path d="M9 1.5L4 9h4l-1 5.5L13 7H9z" fill="currentColor" stroke="currentColor"/>`);
export const iconVolume       = _icon(`<path d="M2.5 6h2L8 3v10L4.5 10h-2z" fill="currentColor" stroke="currentColor"/><path d="M10.5 5.5a3 3 0 0 1 0 5M12.5 3.5a5.5 5.5 0 0 1 0 9"/>`);
export const iconTextInspector= _icon(`<path d="M3 4h10M3 8h10M3 12h6"/>`);
export const iconMate         = _icon(`<path d="M2.5 4.5A1.5 1.5 0 0 1 4 3h6a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 10 11H6l-3 2v-2H4A1.5 1.5 0 0 1 2.5 9.5z"/><path d="M9 6l1.5 1.5L9 9" stroke-width="1.6"/>`);
export const iconLab           = _icon(`<path d="M6 2v4L3 12a2 2 0 0 0 1.8 2.5h6.4A2 2 0 0 0 13 12L10 6V2z"/><path d="M5 9h6M5.5 11.5h5"/>`);
export const iconTranscript   = _icon(`<rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M5 6h6M5 8h6M5 10h3"/><path d="M2 9c0-1 1-1.5 2-1.5" stroke-width="1"/>`);
export const iconScopes       = _icon(`<path d="M1.5 8h2M12.5 8h2M2 8a6 6 0 0 1 12 0M2 8a6 6 0 0 0 12 0"/><circle cx="8" cy="8" r="2.5"/>`);
export const iconAi           = _icon(`<path d="M8 1.5a3 3 0 0 1 3 3c0 1-.5 1.7-1.2 2.2.5.6.7 1.4.7 2.3a3 3 0 0 1-6 0c0-.9.2-1.7.7-2.3A3 3 0 0 1 5 4.5a3 3 0 0 1 3-3z" fill="currentColor" stroke="currentColor"/><path d="M6 12h4M7 14h2"/>`);
export const iconCreative     = _icon(`<path d="M3 13c0-3 3-4 5-4s4-1 5-3c2 1 2 4 0 6-1.5 1.5-4 1.5-5 1.5z" fill="currentColor" stroke="currentColor"/><path d="M6 11l3-3"/>`);

/* --- Titlebar ------------------------------------------------------------- */
export const iconRecent       = _icon(`<circle cx="8" cy="8" r="5.5"/><path d="M8 5v3l2 1.5"/>`);
export const iconSettings     = _icon(`<circle cx="8" cy="8" r="2.5"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.7 3.7l1.4 1.4M10.9 10.9l1.4 1.4M3.7 12.3l1.4-1.4M10.9 5.1l1.4-1.4"/>`);
export const iconExport        = _icon(`<path d="M8 2v8M5 7l3 3 3-3M3 12h10"/>`);
export const iconUndo         = _icon(`<path d="M3 8a5 5 0 0 1 5-5h5M3 5l3 3-3 3"/>`);
export const iconRedo         = _icon(`<path d="M13 8a5 5 0 0 0-5-5H3M13 5l-3 3 3 3"/>`);
export const iconFullscreen   = _icon(`<path d="M2 5V2h3M14 5V2h-3M2 11v3h3M14 11v3h-3"/>`);
export const iconPlay         = _icon(`<path d="M5 3l9 5-9 5z" fill="currentColor" stroke="currentColor"/>`);
export const iconPause        = _icon(`<path d="M5 3h2.2v10H5zM8.8 3H11v10H8.8z" fill="currentColor" stroke="none"/>`);
export const iconHome         = _icon(`<path d="M2 8l6-5 6 5"/><path d="M4 7.5V13h8V7.5"/><path d="M2 13h12"/>`);
export const iconEnd          = _icon(`<path d="M14 8l-6-5-6 5"/><path d="M4 7.5V13h8V7.5"/>`);
export const iconPrev         = _icon(`<path d="M10 4L5 8l5 4"/><path d="M4 3.5v9"/>`);
export const iconNext         = _icon(`<path d="M6 4l5 4-5 4"/><path d="M12 3.5v9"/>`);
export const iconCamera       = _icon(`<rect x="2" y="5" width="9" height="7" rx="1"/><path d="M11 8l3-2v6l-3-2z"/><circle cx="6.5" cy="8.5" r="1.5"/>`);
export const iconMarkIn       = _icon(`<path d="M3 3v10M3 8h8"/><path d="M8 5l3 3-3 3" fill="currentColor"/>`);
export const iconMarkOut      = _icon(`<path d="M13 3v10M13 8H5"/><path d="M8 5L5 8l3 3" fill="currentColor"/>`);
export const iconSplit        = _icon(`<path d="M3 4h10M3 12h10M8 4v8" stroke-width="1.6"/><path d="M8 8l-3 2 3 2 3-2-3-2z" fill="currentColor" stroke="currentColor"/>`);
export const iconTrim         = _icon(`<rect x="2" y="5" width="12" height="6" rx="1"/><path d="M2 8h5M9 8h5"/>`);
export const iconDelete       = _icon(`<path d="M3 4h10M5 4V2.5h6V4M4 4l1 9h6l1-9" stroke-width="1.4"/>`);
export const iconSnap         = _icon(`<path d="M2 5h3v3M14 5h-3v3M2 11h3v-3M14 11h-3v-3" />`);
export const iconMute         = _icon(`<path d="M2.5 6h2L8 3v10L4.5 10h-2z" fill="currentColor" stroke="currentColor"/><path d="M10 6l4 4M14 6l-4 4" stroke-width="1.5"/>`);
export const iconZoomIn       = _icon(`<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14M5 7h4M7 5v4" stroke-width="1.4"/>`);
export const iconQuality      = _icon(`<path d="M8 2.5l5 2v4c0 3-2.5 5-5 6-2.5-1-5-3-5-6v-4z"/><path d="M6 8l1.5 1.5L10 7"/>`);
export const iconAspect       = _icon(`<rect x="2" y="3.5" width="12" height="9" rx="1"/><path d="M2 9h12"/>`);
export const iconCog          = iconSettings;
export const iconChevronDown  = _icon(`<path d="M4 6l4 4 4-4" stroke-width="1.6"/>`);
export const iconBell         = _icon(`<path d="M4 11V8a4 4 0 0 1 8 0v3l1.5 2h-11z"/><path d="M6.5 14a1.5 1.5 0 0 0 3 0"/>`);
export const iconCart         = _icon(`<path d="M2 3h2l2 8h6l2-6H5"/><circle cx="7" cy="13.5" r="1"/><circle cx="12" cy="13.5" r="1"/>`);
export const iconSync         = _icon(`<path d="M3 8a5 5 0 0 1 9-3l1 1M13 8a5 5 0 0 1-9 3l-1-1" /><path d="M9 5h3v-3M7 11H4v3"/>`);

/* Returns a span-wrapped icon sized to the host. */
export function iconSvg(svg, opts = {}) {
  const size = opts.size || 14;
  // strip outer <svg> if present so we can re-wrap with the requested size
  const inner = svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  return `<svg viewBox="0 0 16 16" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

/* --- extras --------------------------------------------------------------- */
export const iconProject = _icon(
  `<rect x="2" y="3.5" width="12" height="9" rx="1.5"/><path d="M2 6h12"/><path d="M5.5 9.5h5"/>`
);
export const iconSpark = _icon(
  `<path d="M8 1.5l1.6 3.4 3.4 1.6-3.4 1.6L8 11.5 6.4 8.1 3 6.5l3.4-1.6z" fill="currentColor" stroke="none"/><path d="M12.5 10l.7 1.5 1.5.7-1.5.7-.7 1.5-.7-1.5-1.5-.7 1.5-.7z" fill="currentColor" stroke="none" opacity=".65"/>`
);
export const iconSave = _icon(`<path d="M2.5 2.5h8L13.5 5.5v8h-11z"/><path d="M5 2.5v4h5v-4"/><rect x="5" y="8.5" width="6" height="5"/>`);
export const iconLayers = _icon(`<path d="M8 2l6 3-6 3-6-3z"/><path d="M2 8l6 3 6-3" /><path d="M2 11.5l6 3 6-3"/>`);
export const iconGrid = _icon(`<rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>`);

/* --- name -> svg lookup ---------------------------------------------------- */
export const ICONS = {
  media: iconMedia,
  text: iconText,
  shapes: iconShapes,
  effects: iconEffects,
  transitions: iconTransitions,
  aiTools: iconAiTools,
  fx: iconFx,
  motion: iconMotion,
  speed: iconSpeed,
  volume: iconVolume,
  textInspector: iconTextInspector,
  mate: iconMate,
  lab: iconLab,
  transcript: iconTranscript,
  scopes: iconScopes,
  ai: iconAi,
  creative: iconCreative,
  recent: iconRecent,
  settings: iconSettings,
  export: iconExport,
  undo: iconUndo,
  redo: iconRedo,
  fullscreen: iconFullscreen,
  play: iconPlay,
  pause: iconPause,
  home: iconHome,
  end: iconEnd,
  prev: iconPrev,
  next: iconNext,
  camera: iconCamera,
  markIn: iconMarkIn,
  markOut: iconMarkOut,
  split: iconSplit,
  trim: iconTrim,
  delete: iconDelete,
  snap: iconSnap,
  mute: iconMute,
  zoomIn: iconZoomIn,
  quality: iconQuality,
  aspect: iconAspect,
  cog: iconCog,
  chevronDown: iconChevronDown,
  bell: iconBell,
  cart: iconCart,
  sync: iconSync,
  project: iconProject,
  save: iconSave,
  spark: iconSpark,
  layers: iconLayers,
  grid: iconGrid,
};

/**
 * Fill every `[data-icon]` host with its SVG.
 *
 * A host may already declare a slot (`.tab-ico`, `.btn-ico`, `.ico`); if it does
 * not, one is created and prepended so the icon sits before any existing label.
 * Safe to call more than once — an already-hydrated host is skipped via the
 * `data-icon-done` marker, which lets late-mounted panels pick up their icons
 * without re-writing the whole document.
 */
export function hydrateIcons(root = document) {
  const hosts = root.querySelectorAll("[data-icon]");
  hosts.forEach((el) => {
    const svg = ICONS[el.dataset.icon];
    if (!svg) return;
    let slot = el.querySelector(":scope > .tab-ico, :scope > .btn-ico, :scope > .ico");
    if (!slot) {
      slot = document.createElement("span");
      slot.className = "ico";
      el.prepend(slot);
    }
    if (slot.dataset.iconName === el.dataset.icon && slot.firstChild) return;
    slot.innerHTML = svg;
    slot.dataset.iconName = el.dataset.icon;
    el.classList.add("has-ico");
  });
  return hosts.length;
}