/* Motion / Transform inspector — Filmora-style position, scale, rotation,
 * opacity and anchor, with per-property keyframes.
 * Writes to clip.motion; the canvas engine interpolates via motionAt(). */

import { store, DEFAULT_MOTION } from "./state.js";
import { motionAt } from "./player.js";

const PROPS = [
  { key: "x", label: "Position X", min: -0.5, max: 0.5, step: 0.01, fmt: (v) => `${(v * 100).toFixed(0)}%` },
  { key: "y", label: "Position Y", min: -0.5, max: 0.5, step: 0.01, fmt: (v) => `${(v * 100).toFixed(0)}%` },
  { key: "scale", label: "Scale", min: 0.1, max: 3, step: 0.01, fmt: (v) => `${v.toFixed(2)}×` },
  { key: "rotation", label: "Rotation", min: -180, max: 180, step: 1, fmt: (v) => `${v.toFixed(0)}°` },
  { key: "opacity", label: "Opacity", min: 0, max: 100, step: 1, fmt: (v) => `${v.toFixed(0)}%` },
];

function $(sel, root = document) {
  return root.querySelector(sel);
}
function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else if (v != null) n.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c == null) return;
    if (typeof c === "string" || typeof c === "number") n.appendChild(document.createTextNode(String(c)));
    else n.appendChild(c);
  });
  return n;
}

function selectedClip() {
  const s = store.get();
  return s.clips.find((c) => c.id === s.selectedClipId) || null;
}
function isAnimatable(c) {
  return c && !c.textStyle && !c.shape;
}
function localTime(clip) {
  const ph = window.__aifimoraPlayhead || 0;
  return Math.max(0, Math.min(clip.duration || 0, ph - clip.start));
}
function isAnimated(clip) {
  return !!(clip && clip.motion && clip.motion.keys && clip.motion.keys.length);
}

export function initMotionPanel() {
  const mount = document.getElementById("motionPanel");
  const label = document.getElementById("motionClipLabel");
  if (!mount) return;

  // Build static structure once
  mount.innerHTML = "";
  const head = el("div", { class: "field" });
  const modeRow = el("div", { class: "kf-head" }, [
    (function () {
      const c = el("label", { class: "row", style: "gap:6px;font-size:12px" });
      const cb = el("input", { type: "checkbox", id: "motionAnimate" });
      cb.addEventListener("change", () => {
        const clip = selectedClip();
        if (!isAnimatable(clip)) return;
        if (cb.checked) enableKeyframes(clip);
        else disableKeyframes(clip);
        sync();
      });
      c.appendChild(cb);
      c.appendChild(el("span", {}, "Animate with keyframes"));
      return c;
    })(),
    (function () {
      const b = el("div", { class: "row", style: "gap:6px" });
      const add = el("button", { class: "btn sm", title: "Add keyframe at playhead", onclick: () => { addKeyframe(); sync(); } }, "◆ Add");
      const del = el("button", { class: "btn sm", title: "Remove keyframe at playhead", onclick: () => { removeKeyframe(); sync(); } }, "Remove");
      b.appendChild(add);
      b.appendChild(del);
      return b;
    })(),
  ]);
  const timeRead = el("div", { class: "kf-empty", id: "motionTime" });

  head.appendChild(el("div", { id: "motionPlaceholder", class: "muted-note", style: "display:none" },
    "Motion applies to video and image clips. Select one to animate transform."));

  const anchorSection = el("div", { class: "kf-section" }, [
    el("div", { class: "kf-head" }, [el("span", { class: "prop" }, "Anchor point"), el("span", { class: "hint" }, "defaults center")]),
  ]);
  const ax = slider("Anchor X", 0, 1, 0.01, (v) => v.toFixed(2), (v) => setBase("anchorX", v));
  const ay = slider("Anchor Y", 0, 1, 0.01, (v) => v.toFixed(2), (v) => setBase("anchorY", v));
  anchorSection.appendChild(ax.row);
  anchorSection.appendChild(ay.row);

  const propSections = PROPS.map((p) => {
    const sec = el("div", { class: "kf-section", "data-prop": p.key });
    const s = slider(p.label, p.min, p.max, p.step, p.fmt, (v) => onPropEdit(p.key, v));
    sec.appendChild(s.row);
    const rail = el("div", { class: "kf-track", "data-rail": p.key });
    rail.addEventListener("click", (e) => onRailClick(e, p.key));
    sec.appendChild(rail);
    sec._rail = rail;
    sec._slider = s;
    return sec;
  });

  mount.appendChild(head);
  mount.appendChild(modeRow);
  mount.appendChild(timeRead);
  mount.appendChild(anchorSection);
  propSections.forEach((s) => mount.appendChild(s));

  function slider(labelTxt, min, max, step, fmt, onInput) {
    const out = el("output", { style: "min-width:46px;text-align:right" }, "0");
    const input = el("input", { type: "range", min, max, step, value: 0 });
    input.addEventListener("input", () => {
      const v = parseFloat(input.value);
      out.textContent = fmt(v);
      onInput(v);
    });
    const row = el("div", { class: "field" }, [
      el("label", {}, labelTxt),
      el("div", { class: "slider-row" }, [input, out]),
    ]);
    return { row, input, out, fmt };
  }

  function currentMotion(clip) {
    return clip.motion ? { ...DEFAULT_MOTION, ...clip.motion } : { ...DEFAULT_MOTION };
  }

  function setBase(prop, value) {
    const clip = selectedClip();
    if (!isAnimatable(clip)) return;
    const m = currentMotion(clip);
    m[prop] = value;
    store.updateClip(clip.id, { motion: m });
  }

  function onPropEdit(prop, value) {
    const clip = selectedClip();
    if (!isAnimatable(clip)) return;
    if (isAnimated(clip)) {
      setKey(clip, prop, value, localTime(clip));
    } else {
      setBase(prop, value);
    }
  }

  function setKey(clip, prop, value, lt) {
    const m = currentMotion(clip);
    const keys = (m.keys || []).map((k) => ({ ...k }));
    let k = keys.find((kk) => Math.abs(kk.t - lt) < 1e-3);
    if (!k) {
      k = { t: lt };
      // seed other props from base so a lone keyframe doesn't zero them
      PROPS.forEach((p) => (k[p.key] = m[p.key]));
      keys.push(k);
    }
    k[prop] = value;
    keys.sort((a, b) => a.t - b.t);
    m.keys = keys;
    store.updateClip(clip.id, { motion: m });
  }

  function addKeyframe() {
    const clip = selectedClip();
    if (!isAnimatable(clip)) return;
    const lt = localTime(clip);
    const mv = motionAt(clip, lt);
    const m = currentMotion(clip);
    const keys = (m.keys || []).map((k) => ({ ...k }));
    const existing = keys.find((kk) => Math.abs(kk.t - lt) < 1e-3);
    if (!existing) {
      keys.push({ t: lt, x: mv.x, y: mv.y, scale: mv.scale, rotation: mv.rotation, opacity: mv.opacity * 100 });
      keys.sort((a, b) => a.t - b.t);
      m.keys = keys;
      store.updateClip(clip.id, { motion: m });
    }
  }

  function removeKeyframe() {
    const clip = selectedClip();
    if (!isAnimatable(clip)) return;
    const lt = localTime(clip);
    const m = currentMotion(clip);
    if (!m.keys) return;
    const keys = m.keys.filter((kk) => Math.abs(kk.t - lt) >= 1e-3);
    m.keys = keys.length ? keys : null;
    store.updateClip(clip.id, { motion: m });
  }

  function enableKeyframes(clip) {
    const m = currentMotion(clip);
    if (m.keys && m.keys.length) return;
    // seed a keyframe at clip start with current base values
    m.keys = [{ t: 0, x: m.x, y: m.y, scale: m.scale, rotation: m.rotation, opacity: m.opacity }];
    store.updateClip(clip.id, { motion: m });
  }
  function disableKeyframes(clip) {
    const m = currentMotion(clip);
    const mv = motionAt(clip, 0);
    m.x = mv.x;
    m.y = mv.y;
    m.scale = mv.scale;
    m.rotation = mv.rotation;
    m.opacity = mv.opacity * 100;
    m.keys = null;
    store.updateClip(clip.id, { motion: m });
  }

  function onRailClick(e, prop) {
    const clip = selectedClip();
    if (!isAnimatable(clip) || !isAnimated(clip)) return;
    const rail = e.currentTarget;
    const rect = rail.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const t = ratio * (clip.duration || 0);
    if (window.__aifimoraPlayer) window.__aifimoraPlayer.seek(clip.start + t);
  }

  function sync() {
    const clip = selectedClip();
    const anim = isAnimatable(clip);
    if (label) label.textContent = clip ? clip.name || clip.type : "No clip selected";
    const ph = document.getElementById("motionPlaceholder");
    if (ph) ph.style.display = anim ? "none" : "block";
    mount.querySelectorAll(".kf-section, .kf-head").forEach((n) => (n.style.opacity = anim ? "1" : "0.4"));

    const cb = document.getElementById("motionAnimate");
    if (cb) cb.checked = isAnimated(clip);
    if (timeRead) {
      if (clip && anim) {
        const lt = localTime(clip);
        timeRead.textContent = `Clip time ${lt.toFixed(2)}s / ${clip.duration.toFixed(2)}s · ${
          isAnimated(clip) ? "keyframed" : "fixed"
        }`;
      } else timeRead.textContent = "";
    }
    if (!clip || !anim) return;

    const mv = motionAt(clip, localTime(clip));
    const m = currentMotion(clip);
    PROPS.forEach((p) => {
      const sec = propSections.find((s) => s.dataset.prop === p.key);
      if (!sec) return;
      const val = mv[p.key];
      sec._slider.input.value = val;
      sec._slider.out.textContent = p.fmt(val);
      // rebuild keyframe dots
      sec._rail.innerHTML = "";
      (m.keys || []).forEach((k) => {
        const dot = el("div", { class: "kf-dot", "data-v": `${p.label}: ${p.fmt(k[p.key] ?? 0)}` });
        dot.style.left = `${((k.t / (clip.duration || 1)) * 100).toFixed(2)}%`;
        sec._rail.appendChild(dot);
      });
    });
    // anchors (base values, not keyframed)
    ax.input.value = m.anchorX;
    ax.out.textContent = m.anchorX.toFixed(2);
    ay.input.value = m.anchorY;
    ay.out.textContent = m.anchorY.toFixed(2);
  }

  store.subscribe(sync);
  window.addEventListener("aifimora:playhead", sync);
  sync();
}
