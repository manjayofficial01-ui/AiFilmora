/* Multi-track magnetic-ish timeline interactions */
import { store, DEFAULT_FX } from "./state.js";
import { mediaById, toast } from "./media.js";
import { formatTC } from "./player.js";
import { activateClipOnCanvas, openEditorForClip } from "./canvas-edit.js";
import { settings } from "./settings.js";

const PPS_BASE = 40; // pixels per second at zoom 1
let zoom = 1.2;
let els = {};
let playerRef = null;
let drag = null;

export function initTimeline(root, player) {
  playerRef = player;
  els = {
    root,
    body: root.querySelector(".tl-body"),
    scroll: root.querySelector(".tl-scroll") || root.querySelector(".tl-body"),
    labels: root.querySelector(".tl-track-labels"),
    labelsBody: root.querySelector(".tl-labels-body") || root.querySelector(".tl-track-labels"),
    lanes: root.querySelector(".tl-lanes"),
  };

  // Keep label column aligned with vertical lane scroll (both directions)
  let syncingScroll = false;
  const syncFromLanes = () => {
    if (syncingScroll) return;
    syncingScroll = true;
    if (els.labelsBody) els.labelsBody.scrollTop = els.scroll.scrollTop;
    syncingScroll = false;
  };
  const syncFromLabels = () => {
    if (syncingScroll) return;
    syncingScroll = true;
    if (els.scroll) els.scroll.scrollTop = els.labelsBody.scrollTop;
    syncingScroll = false;
  };
  els.scroll?.addEventListener("scroll", syncFromLanes, { passive: true });
  els._syncFromLanes = syncFromLanes;
  els._syncFromLabels = syncFromLabels;

  bindTimelineChrome();
  bindTimelineMarquee();
  window.addEventListener("aifimora:playhead", (e) => {
    setPlayheadVisual(e.detail.time);
  });
  const selSig = (s) => JSON.stringify(
    s.selectedClipIds?.length ? [...s.selectedClipIds].sort() : (s.selectedClipId ? [s.selectedClipId] : [])
  );
  const paintSelection = (s) => {
    const set = new Set(
      s.selectedClipIds?.length ? s.selectedClipIds : (s.selectedClipId ? [s.selectedClipId] : [])
    );
    els.lanes?.querySelectorAll(".tl-clip").forEach((el) => {
      el.classList.toggle("selected", set.has(el.dataset.clipId));
    });
    updateMultiCount();
  };
  let lastStruct = "";
  let lastSelected = selSig(store.get());
  store.subscribe((s) => {
    if (drag) {
      const live = s.clips.find((c) => c.id === drag.id);
      const node = els.lanes?.querySelector(`.tl-clip[data-clip-id="${drag.id}"]`);
      if (live && node) {
        node.style.left = timeToX(live.start) + "px";
        node.style.width = Math.max(8, timeToX(live.duration)) + "px";
        // Live re-parent when the clip hops tracks mid-drag
        const parentLane = els.lanes?.querySelector(`.tl-track[data-track-id="${live.trackId}"]`);
        if (parentLane && node.parentElement !== parentLane) {
          parentLane.appendChild(node);
        }
        // Group move: shift peers live as well
        if (drag.group?.length) {
          for (const g of drag.group) {
            const gn = els.lanes?.querySelector(`.tl-clip[data-clip-id="${g.id}"]`);
            if (gn && g.id !== drag.id) {
              const peer = s.clips.find((c) => c.id === g.id);
              if (peer) gn.style.left = timeToX(peer.start) + "px";
            }
          }
        }
      }
      if (selSig(s) !== lastSelected) {
        lastSelected = selSig(s);
        paintSelection(s);
      }
      return;
    }
    const struct = JSON.stringify({
      clips: s.clips,
      tracks: s.tracks.map((t) => `${t.id}|${t.name}|${t.kind}|${t.muted ? 1 : 0}|${t.locked ? 1 : 0}`),
      markers: s.markers,
    });
    if (struct === lastStruct) {
      if (selSig(s) !== lastSelected) {
        lastSelected = selSig(s);
        paintSelection(s);
      }
      return;
    }
    lastStruct = struct;
    lastSelected = selSig(s);
    renderTimeline();
  });
  renderTimeline();
  // Prime struct cache so the next selection-only change doesn't force a rebuild
  const s0 = store.get();
  lastStruct = JSON.stringify({
    clips: s0.clips,
    tracks: s0.tracks.map((t) => `${t.id}|${t.name}|${t.kind}|${t.muted ? 1 : 0}|${t.locked ? 1 : 0}`),
    markers: s0.markers,
  });
  lastSelected = selSig(s0);
  updateMultiCount();
}

/** "3 selected" badge next to the Delete button. */
function updateMultiCount() {
  const btn = document.getElementById("btnDeleteClip");
  if (!btn) return;
  const n = store.selectedClipIdList().length;
  if (n > 1 && !btn.dataset.label) btn.dataset.label = btn.textContent;
  if (n > 1) btn.textContent = `Delete (${n})`;
  else if (btn.dataset.label) btn.textContent = btn.dataset.label;
}

/** Rubber-band marquee: drag empty lane space to select clips (any type). */
function bindTimelineMarquee() {
  const sc = els.scroll;
  if (!sc) return;
  let mz = null;
  let box = null;

  const lanesOf = () => els.lanes;
  sc.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey) return;
    if (marqueeSuppressed()) return;
    // Only on empty lane background — clips/ruler/handles keep their own gestures
    const lanes = lanesOf();
    if (!lanes) return;
    if (e.target.closest(".tl-clip,.tl-ruler,.tl-trans,.ai-mark,.ruler-tick,.tl-empty-hint")) return;
    const lane = e.target.closest(".tl-track");
    if (!lane || !lanes.contains(lane)) return;
    const r = lanes.getBoundingClientRect();
    mz = {
      x0: e.clientX - r.left,
      y0: e.clientY - r.top,
      lanesRect: r,
      additive: !!(e.shiftKey),
      id: e.pointerId,
      moved: false,
    };
    try { sc.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  });
  sc.addEventListener("pointermove", (e) => {
    if (!mz) return;
    const lanes = lanesOf();
    if (!lanes) return;
    const r = lanes.getBoundingClientRect();
    // Account for lanes shifting under scroll between down/move
    const x1 = e.clientX - r.left;
    const y1 = e.clientY - r.top;
    if (Math.hypot(x1 - mz.x0, y1 - mz.y0) < 5 && !mz.moved) return;
    mz.moved = true;
    if (!box) {
      box = document.createElement("div");
      box.className = "tl-marquee";
      lanes.appendChild(box);
    }
    const x = Math.min(mz.x0, x1);
    const y = Math.min(mz.y0, y1);
    box.style.left = x + "px";
    box.style.top = y + "px";
    box.style.width = Math.abs(x1 - mz.x0) + "px";
    box.style.height = Math.abs(y1 - mz.y0) + "px";
    // Hit-test in viewport coords (robust to scroll)
    const mx0 = Math.min(e.clientX, mz.clientX0 ?? e.clientX);
    const mx1 = Math.max(e.clientX, mz.clientX0 ?? e.clientX);
    const my0 = Math.min(e.clientY, mz.clientY0 ?? e.clientY);
    const my1 = Math.max(e.clientY, mz.clientY0 ?? e.clientY);
    if (mz.clientX0 == null) { mz.clientX0 = e.clientX; mz.clientY0 = e.clientY; }
    const px0 = Math.min(mz.clientX0, e.clientX);
    const px1 = Math.max(mz.clientX0, e.clientX);
    const py0 = Math.min(mz.clientY0, e.clientY);
    const py1 = Math.max(mz.clientY0, e.clientY);
    lanes.querySelectorAll(".tl-clip").forEach((el) => {
      const cr = el.getBoundingClientRect();
      const hit = cr.left < px1 && cr.right > px0 && cr.top < py1 && cr.bottom > py0;
      el.classList.toggle("marquee-hit", hit);
    });
    void mx0; void mx1; void my0; void my1;
  });
  const end = (e) => {
    if (!mz) return;
    const lanes = lanesOf();
    const wasDrag = mz.moved;
    const additive = mz.additive;
    mz = null;
    const hits = lanes ? [...lanes.querySelectorAll(".tl-clip.marquee-hit")].map((el) => el.dataset.clipId) : [];
    lanes?.querySelectorAll(".tl-clip.marquee-hit").forEach((el) => el.classList.remove("marquee-hit"));
    box?.remove();
    box = null;
    if (!wasDrag) {
      // Plain click on empty lane space clears selection
      if (!additive && e?.target?.closest?.(".tl-track")) store.clearSelectedClips();
      return;
    }
    if (!hits.length) {
      if (!additive) store.clearSelectedClips();
      return;
    }
    if (additive) {
      const cur = new Set(store.selectedClipIdList());
      hits.forEach((id) => cur.add(id));
      store.setSelectedClips([...cur]);
      toast(`${store.selectedClipIdList().length} clips selected`, "ok");
    } else {
      store.setSelectedClips(hits);
      toast(`${hits.length} clip${hits.length === 1 ? "" : "s"} selected — drag to move, Del to remove`, "ok");
    }
  };
  sc.addEventListener("pointerup", end);
  sc.addEventListener("pointercancel", () => { mz = null; box?.remove(); box = null; });
  // Esc clears rubber-band selection
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !e.target?.isContentEditable) {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag !== "input" && tag !== "textarea" && store.selectedClipIdList().length > 1) {
        store.clearSelectedClips();
      }
    }
  });
}

function marqueeSuppressed() {
  // Don't start a marquee while a clip drag or pan is active
  return !!drag;
}

function pps() {
  return PPS_BASE * zoom;
}

function zoomAt(clientX, deltaY) {
  const sc = els.scroll;
  if (!sc) return;
  const rect = sc.getBoundingClientRect();
  const xView = clientX - rect.left + sc.scrollLeft;
  const timeUnder = xView / pps();
  const factor = deltaY > 0 ? 0.9 : 1.1;
  zoom = Math.min(4, Math.max(0.35, zoom * factor));
  const zoomEl = document.getElementById("tlZoom");
  if (zoomEl) zoomEl.value = String(Math.round(zoom * 100) / 100);
  renderTimeline();
  const newX = timeToX(timeUnder);
  sc.scrollLeft = Math.max(0, newX - (clientX - rect.left));
}

function timeToX(t) {
  return t * pps();
}

function xToTime(x) {
  return x / pps();
}

function bindTimelineChrome() {
  const zoomEl = document.getElementById("tlZoom");
  if (zoomEl) {
    zoomEl.value = String(zoom);
    zoomEl.addEventListener("input", () => {
      zoom = Number(zoomEl.value);
      renderTimeline();
    });
  }

  // Ctrl/⌘ + wheel = zoom at cursor; plain wheel/shift+wheel = horizontal pan
  const sc = els.scroll;
  sc?.addEventListener(
    "wheel",
    (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomAt(e.clientX, e.deltaY);
        return;
      }
      if (e.shiftKey) {
        e.preventDefault();
        sc.scrollLeft += e.deltaY;
        return;
      }
      const canScrollY = sc.scrollHeight > sc.clientHeight + 1;
      const canScrollX = sc.scrollWidth > sc.clientWidth + 1;
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && canScrollX) {
        e.preventDefault();
        sc.scrollLeft += e.deltaX;
        return;
      }
      // Native vertical scroll when tracks overflow
      if (canScrollY && Math.abs(e.deltaY) >= Math.abs(e.deltaX)) return;
      if (canScrollX) {
        e.preventDefault();
        sc.scrollLeft += e.deltaY;
      }
    },
    { passive: false }
  );

  let pan = null;
  sc?.addEventListener("pointerdown", (e) => {
    if (e.button === 1) {
      e.preventDefault();
      pan = { x: e.clientX, scroll: sc.scrollLeft };
      sc.classList.add("panning");
      try {
        sc.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  });
  sc?.addEventListener("pointermove", (e) => {
    if (!pan) return;
    sc.scrollLeft = pan.scroll - (e.clientX - pan.x);
  });
  const endPan = () => {
    if (!pan) return;
    pan = null;
    sc?.classList.remove("panning");
  };
  sc?.addEventListener("pointerup", endPan);
  sc?.addEventListener("pointercancel", endPan);

  // Drag the zoom slider region is already bound; also drag on the zoom track for quick scrub
  const zoomWrap = document.getElementById("tlZoomWrap");
  zoomWrap?.addEventListener("dblclick", () => {
    zoom = 1.2;
    if (zoomEl) zoomEl.value = String(zoom);
    renderTimeline();
  });

  const doSplit = () => {
    const t = playerRef?.getTime() || 0;
    const n = store.splitAtPlayhead(t);
    if (n > 0) toast(n > 1 ? `Split ${n} selected clips` : "Split selected clip", "ok");
    else toast(store._lastSplitReason || "Nothing to split at playhead");
  };
  document.getElementById("btnSplit")?.addEventListener("click", doSplit);
  window.addEventListener("aifimora:split", doSplit);

  const doTrimStart = () => {
    const id = store.get().selectedClipId;
    if (!id) return toast("Select a clip first");
    const t = playerRef?.getTime() || 0;
    const res = store.trimStartAtPlayhead(id, t);
    if (!res.ok) return toast(res.reason, "err");
    toast("Trimmed start to playhead", "ok");
    window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
  };
  const doTrimEnd = () => {
    const id = store.get().selectedClipId;
    if (!id) return toast("Select a clip first");
    const t = playerRef?.getTime() || 0;
    const res = store.trimEndAtPlayhead(id, t);
    if (!res.ok) return toast(res.reason, "err");
    toast("Trimmed end to playhead", "ok");
    window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
  };
  const doDelete = () => {
    const ids = store.selectedClipIdList();
    if (!ids.length) return toast("Select a clip first — or drag a marquee over clips");
    const res = store.removeClips(ids);
    toast(res.removed > 1 ? `${res.removed} clips removed` : "Clip removed");
  };
  document.getElementById("btnTrimStart")?.addEventListener("click", doTrimStart);
  document.getElementById("btnTrimEnd")?.addEventListener("click", doTrimEnd);
  document.getElementById("btnDeleteClip")?.addEventListener("click", doDelete);
  window.addEventListener("aifimora:trim-start", doTrimStart);
  window.addEventListener("aifimora:trim-end", doTrimEnd);
  window.addEventListener("aifimora:delete-clip", doDelete);

  const doUndo = () => {
    const label = store.undo();
    toast(label ? `Undo: ${label}` : "Nothing to undo");
  };
  const doRedo = () => {
    const label = store.redo();
    toast(label ? `Redo: ${label}` : "Nothing to redo");
  };
  document.getElementById("btnUndo")?.addEventListener("click", doUndo);
  document.getElementById("btnRedo")?.addEventListener("click", doRedo);
  window.addEventListener("aifimora:undo", doUndo);
  window.addEventListener("aifimora:redo", doRedo);

  const syncUndoUI = () => {
    const u = document.getElementById("btnUndo");
    const r = document.getElementById("btnRedo");
    const ul = store.peekUndoLabel();
    const rl = store.peekRedoLabel();
    if (u) {
      u.disabled = !store.canUndo();
      u.title = ul ? `Undo ${ul} (Ctrl+Z)` : "Nothing to undo";
    }
    if (r) {
      r.disabled = !store.canRedo();
      r.title = rl ? `Redo ${rl} (Ctrl+Y)` : "Nothing to redo";
    }
    const last = document.getElementById("statLastAction");
    if (last) last.textContent = ul ? `Last: ${ul}` : "";
  };
  store.subscribe(syncUndoUI);
  syncUndoUI();

  document.getElementById("btnSnap")?.addEventListener("click", (e) => {
    e.currentTarget.classList.toggle("active");
    e.currentTarget.setAttribute(
      "aria-pressed",
      e.currentTarget.classList.contains("active") ? "true" : "false"
    );
  });

  bindAddTrackButtons();
  bindCropButton(playerRef);
}

function bindAddTrackButtons() {
  document.getElementById("btnAddTrack")?.addEventListener("click", () => {
    const s = store.get();
    const n = s.tracks.filter((t) => t.kind === "video").length + 1;
    store.set({
      tracks: [
        { id: store.uid("v"), kind: "video", name: `V${n}`, locked: false, muted: false },
        ...s.tracks,
      ],
    });
    toast(`Added video track V${n}`);
  });

  document.getElementById("btnAddAudioTrack")?.addEventListener("click", () => {
    const s = store.get();
    const n = s.tracks.filter((t) => t.kind === "audio").length + 1;
    store.set({
      tracks: [
        ...s.tracks,
        { id: store.uid("a"), kind: "audio", name: `A${n}`, locked: false, muted: false },
      ],
    });
    toast(`Added audio track A${n}`);
  });
}

function bindCropButton(player) {
  document.getElementById("btnCrop")?.addEventListener("click", () => {
    const id = store.get().selectedClipId;
    const clip = id ? store.getClip(id) : null;
    if (!clip || clip.type === "text" || clip.type === "audio") {
      toast("Select a video clip to crop", "err");
      return;
    }
    window.dispatchEvent(
      new CustomEvent("aifimora:toggle-crop", { detail: { clipId: id } })
    );
  });
}

export function setZoom(z) {
  // View-only: changing pixels-per-second must never touch clip data.
  const before = JSON.stringify(store.get().clips.map((c) => c.id + "|" + c.start + "|" + c.duration));
  zoom = Math.min(4, Math.max(0.4, z));
  const el = document.getElementById("tlZoom");
  if (el) el.value = String(zoom);
  renderTimeline();
  const after = JSON.stringify(store.get().clips.map((c) => c.id + "|" + c.start + "|" + c.duration));
  if (before !== after) console.warn("[timeline] zoom mutated clips — this must never happen");
}

/**
 * Ruler gestures (2.2.0):
 * - CLICK the ruler → seek the playhead (seek only);
 * - DRAG the ruler in any direction → zoom the timeline view
 *   (right / up = zoom in, left / down = zoom out).
 * Zoom is strictly view-only: it only changes pixels-per-second and never
 * extends/shortens video, audio, or file lengths.
 *
 * Implementation note: every zoom step calls renderTimeline(), which rebuilds
 * the ruler DOM node. Listening for move/up on `window` (instead of the ruler
 * with pointer capture) keeps the gesture alive across those rebuilds.
 */
let rulerGesture = null;

function bindRulerGestures(ruler) {
  ruler.title =
    "Drag \u25C0\u25B6 or \u2195 to zoom in/out \u00B7 click to seek \u2014 zoom is view-only, clip lengths never change";
  ruler.addEventListener("pointerdown", (e) => {
    if ((e.button !== 0 && e.button !== 2) || rulerGesture) return;
    e.preventDefault();
    rulerGesture = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      zoom0: zoom,
      moved: false,
    };
    window.addEventListener("pointermove", onRulerGestureMove);
    window.addEventListener("pointerup", onRulerGestureEnd);
    window.addEventListener("pointercancel", onRulerGestureEnd);
  });
  ruler.addEventListener("contextmenu", (e) => e.preventDefault());
}

function onRulerGestureMove(e) {
  const g = rulerGesture;
  if (!g || e.pointerId !== g.id) return;
  const dx = e.clientX - g.x0;
  const dy = e.clientY - g.y0;
  if (!g.moved && Math.hypot(dx, dy) < 4) return;
  g.moved = true;
  // Dominant axis wins: horizontal drag → dx, vertical drag → -dy.
  const delta = Math.abs(dx) >= Math.abs(dy) ? dx : -dy;
  const next = Math.min(4, Math.max(0.4, g.zoom0 * Math.pow(1.006, delta)));
  if (Math.abs(next - zoom) > 0.0005) {
    zoom = next;
    const zoomEl = document.getElementById("tlZoom");
    if (zoomEl) zoomEl.value = String(Math.round(zoom * 100) / 100);
    renderTimeline();
  }
}

function onRulerGestureEnd(e) {
  const g = rulerGesture;
  if (!g || (e && e.pointerId !== g.id)) return;
  rulerGesture = null;
  window.removeEventListener("pointermove", onRulerGestureMove);
  window.removeEventListener("pointerup", onRulerGestureEnd);
  window.removeEventListener("pointercancel", onRulerGestureEnd);
  if (!g.moved && e && e.type === "pointerup") {
    // Plain click → seek. The ruler may have been rebuilt, so re-query it.
    const ruler = els.lanes?.querySelector(".tl-ruler");
    if (ruler) {
      const rect = ruler.getBoundingClientRect();
      playerRef?.seek(Math.max(0, xToTime(e.clientX - rect.left)));
    }
  }
}

function renderTimeline() {
  const state = store.get();
  const dur = Math.max(store.sequenceDuration() + 4, 12);
  const width = Math.max(timeToX(dur), 800);

  // labels — only rebuild the scrolling list; keep spacer + foot buttons in DOM
  let labelsBody = els.labels.querySelector(".tl-labels-body");
  if (!labelsBody) {
    els.labels.innerHTML =
      `<div class="tl-label-spacer"></div><div class="tl-labels-body"></div>` +
      `<div class="tl-labels-foot track-add-col">
        <button class="track-add-btn" id="btnAddTrack" title="Add video track" aria-label="Add video track"><span class="ta-icon">+V</span></button>
        <button class="track-add-btn" id="btnAddAudioTrack" title="Add audio track" aria-label="Add audio track"><span class="ta-icon">+A</span></button>
      </div>`;
    labelsBody = els.labels.querySelector(".tl-labels-body");
    bindAddTrackButtons();
  }
  labelsBody.innerHTML = "";
  els.labelsBody = labelsBody;
  state.tracks.forEach((t, index) => {
    labelsBody.appendChild(buildTrackLabel(t, index));
  });
  // Re-bind labels scroll → lanes (body is recreated each render)
  if (els._syncFromLabels) {
    labelsBody.addEventListener("scroll", els._syncFromLabels, { passive: true });
    // restore scroll position after rebuild
    requestAnimationFrame(() => {
      if (els.scroll) labelsBody.scrollTop = els.scroll.scrollTop;
    });
  }
  // Track mute / lock / hide / solo via delegation (labels are rebuilt each render)
  labelsBody.onclick = (e) => {
    const btn = e.target.closest("[data-track-act]");
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const id = btn.dataset.trackId;
    const act = btn.dataset.trackAct;
    if (act === "mute") {
      const muted = store.toggleTrackMute(id);
      const track = store.get().tracks.find((t) => t.id === id);
      toast(muted ? `${track?.name || "Track"} muted` : `${track?.name || "Track"} unmuted`, "ok");
    } else if (act === "lock") {
      const locked = store.toggleTrackLock(id);
      toast(locked ? "Track locked" : "Track unlocked", "ok");
    } else if (act === "hide") {
      const hidden = store.toggleTrackHide(id);
      toast(hidden ? "Track hidden" : "Track visible", "ok");
    } else if (act === "solo") {
      const solo = store.toggleTrackSolo(id);
      toast(solo ? "Track soloed" : "Solo cleared", "ok");
    }
    window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
  };

  // lanes
  els.lanes.style.width = width + "px";
  els.lanes.innerHTML = "";

  // ruler — click/drag ◀▶ scrubs, drag ↕ (or Alt+drag) zooms.
  // Zoom is strictly view-only (pixels-per-second): it never mutates clips,
  // tracks, durations, or the sequence length.
  const ruler = document.createElement("div");
  ruler.className = "tl-ruler";
  ruler.style.width = width + "px";
  bindRulerGestures(ruler);
  const step = zoom > 2 ? 1 : zoom > 1 ? 2 : 5;
  for (let t = 0; t <= dur; t += step) {
    const tick = document.createElement("div");
    tick.className = "ruler-tick";
    tick.style.left = timeToX(t) + "px";
    // MM:SS keeps the ruler readable (skip HH and frames)
    tick.textContent = formatTC(t).slice(3, 8);
    ruler.appendChild(tick);
  }
  els.lanes.appendChild(ruler);

  // AI markers
  const markers = document.createElement("div");
  markers.className = "ai-markers";
  markers.style.width = width + "px";
  (state.markers || []).forEach((m) => {
    const el = document.createElement("div");
    el.className = "ai-mark";
    el.style.left = timeToX(m.start) + "px";
    el.style.width = Math.max(2, timeToX(m.end - m.start)) + "px";
    markers.appendChild(el);
  });
  els.lanes.appendChild(markers);

  state.tracks.forEach((track) => {
    const lane = document.createElement("div");
    lane.className = "tl-track";
    lane.dataset.trackId = track.id;
    lane.style.width = width + "px";

    lane.addEventListener("dragover", (e) => {
      const types = [...(e.dataTransfer?.types || [])];
      const hasMedia =
        types.includes("text/aifimora-media") ||
        types.includes("text/plain") ||
        types.includes("Files");
      if (hasMedia) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
        lane.classList.add("drop-ok");
      }
    });
    lane.addEventListener("dragleave", () => lane.classList.remove("drop-ok"));
    lane.addEventListener("drop", async (e) => {
      lane.classList.remove("drop-ok");
      const rect = lane.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const t = Math.max(0, xToTime(x));
      // 1) OS files dropped straight onto the timeline: import, then place
      if (e.dataTransfer?.files?.length) {
        e.preventDefault();
        try {
          const { importFileList } = await import("./media.js");
          const { imported } = await importFileList([...e.dataTransfer.files]);
          if (!imported.length) return;
          let cursor = Math.round(t * 10) / 10;
          for (const media of imported) {
            store.addClip({
              mediaId: media.id,
              name: media.name,
              type: media.kind === "audio" ? "audio" : media.kind === "text" ? "text" : "video",
              trackId: media.kind === "audio" && track.kind !== "audio" ? "a1" : track.id,
              start: cursor,
              duration: media.duration || 4,
              fx: { ...DEFAULT_FX },
            });
            cursor = Math.round((cursor + (media.duration || 4) + 0.08) * 10) / 10;
          }
          toast(imported.length > 1 ? `Added ${imported.length} files to timeline` : `Added ${imported[0].name} to ${track.name}`);
        } catch (err) {
          toast("Import failed: " + (err?.message || err), "err");
        }
        return;
      }
      // 2) Internal media-bin drag (custom MIME, with text/plain fallback)
      let mediaId = "";
      try {
        mediaId =
          e.dataTransfer.getData("text/aifimora-media") ||
          (e.dataTransfer.getData("text/plain") || "").replace(/^aifimora-media:/, "");
      } catch { /* getData can throw after navigation */ }
      if (!mediaId) return;
      e.preventDefault();
      const media = mediaById(mediaId);
      if (!media) return;
      store.addClip({
        mediaId,
        name: media.name,
        type: media.kind === "audio" ? "audio" : media.kind === "text" ? "text" : "video",
        trackId: track.id,
        start: Math.round(t * 10) / 10,
        duration: media.duration || 4,
        fx: { ...DEFAULT_FX },
      });
      store.setSelectedClips([store.get().clips[store.get().clips.length - 1]?.id].filter(Boolean));
      toast(`Added ${media.name} to ${track.name}`);
    });

    const clips = store.clipsOnTrack(track.id);
    clips.forEach((clip, i) => {
      lane.appendChild(buildClipEl(clip, width));
      // Transition diamond at cut (out-point of this clip)
      if (clip.type !== "audio" && i < clips.length - 1) {
        const next = clips[i + 1];
        const cut = clip.start + clip.duration;
        if (Math.abs(next.start - cut) < 0.2) {
          lane.appendChild(buildTransitionHandle(clip, cut));
        }
      }
    });

    if (!clips.length) {
      // keep lane empty for drops
    }

    els.lanes.appendChild(lane);
  });

  // playhead
  const ph = document.createElement("div");
  ph.className = "playhead";
  ph.id = "tlPlayhead";
  ph.style.left = timeToX(playerRef?.getTime() || 0) + "px";
  els.lanes.appendChild(ph);

  if (!state.clips.length) {
    const hint = document.createElement("div");
    hint.className = "tl-empty-hint";
    hint.textContent =
      "Empty timeline — drag media from the bin, or use AI Mate / GenAI Lab to generate a rough cut.";
    els.lanes.appendChild(hint);
  }

  // update duration display
  const seqEl = document.getElementById("seqDuration");
  if (seqEl) seqEl.textContent = formatTC(store.sequenceDuration());
  updateMultiCount();
}

function buildTransitionHandle(clip, cutTime) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "tl-trans" + (clip.outTransition?.type ? " has" : "");
  el.style.left = `${timeToX(cutTime) - 7}px`;
  el.title = clip.outTransition?.label || "Add transition";
  el.setAttribute("aria-label", el.title);
  el.innerHTML = `<span>${clip.outTransition?.type ? "◆" : "◇"}</span>`;
  el.addEventListener("click", (e) => {
    e.stopPropagation();
    store.setSelectedClips([clip.id]);
    window.dispatchEvent(
      new CustomEvent("aifimora:open-transitions", { detail: { clipId: clip.id } })
    );
    document.querySelector('[data-sidebar="transitions"]')?.click();
  });
  return el;
}

function buildTrackLabel(track, index) {
  const div = document.createElement("div");
  div.className =
    "tl-label" +
    (track.muted ? " is-muted" : "") +
    (track.locked ? " is-locked" : "") +
    (track.hidden ? " is-hidden" : "") +
    (track.solo ? " is-solo" : "");
  div.dataset.trackId = track.id;
  div.dataset.index = String(index);
  div.title = "Drag to reorder · buttons: lock / mute / hide / solo";
  div.innerHTML = `
    <span class="grip" aria-hidden="true">⋮⋮</span>
    <span class="track-acts">
      <button type="button" class="track-act ${track.locked ? "on" : ""}" data-track-act="lock" data-track-id="${track.id}" title="Lock track" aria-label="Lock ${escape(track.name)}">${track.locked ? "🔒" : "🔓"}</button>
      <button type="button" class="track-act ${track.muted ? "on" : ""}" data-track-act="mute" data-track-id="${track.id}" title="Mute track" aria-label="Mute ${escape(track.name)}">${track.muted ? "🔇" : "🔊"}</button>
      <button type="button" class="track-act ${track.hidden ? "on" : ""}" data-track-act="hide" data-track-id="${track.id}" title="Hide track" aria-label="Hide ${escape(track.name)}">${track.hidden ? "🙈" : "👁"}</button>
      <button type="button" class="track-act ${track.solo ? "on" : ""}" data-track-act="solo" data-track-id="${track.id}" title="Solo track" aria-label="Solo ${escape(track.name)}">S</button>
    </span>
    <strong>${escape(track.name)}</strong>
    <span class="kind">${track.kind}</span>
  `;

  let tDrag = null;

  div.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest(".track-act")) return;
    e.preventDefault();
    e.stopPropagation();
    tDrag = {
      id: track.id,
      startY: e.clientY,
      fromIndex: index,
      toIndex: index,
      moved: false,
    };
    div.classList.add("dragging");
    try {
      div.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    div.addEventListener("pointermove", onTrackLabelMove);
    div.addEventListener("pointerup", onTrackLabelEnd);
    div.addEventListener("pointercancel", onTrackLabelEnd);
  });

  function onTrackLabelMove(e) {
    if (!tDrag) return;
    if (Math.abs(e.clientY - tDrag.startY) > 3) tDrag.moved = true;
    const body = els.labelsBody || els.labels;
    const rows = [...body.querySelectorAll(".tl-label")];
    if (!rows.length) return;
    const br = body.getBoundingClientRect();
    const contentY = e.clientY - br.top + body.scrollTop;
    const rowH = rows[0].getBoundingClientRect().height || 48;
    let target = Math.floor(contentY / rowH);
    if (contentY > rowH * rows.length - rowH / 2) target = rows.length - 1;
    target = Math.max(0, Math.min(rows.length - 1, target));
    tDrag.toIndex = target;
    rows.forEach((row, i) => {
      row.classList.toggle("drop-before", i === target && tDrag.moved);
    });
    const sc = els.scroll;
    if (sc) {
      const sr = sc.getBoundingClientRect();
      const edge = 32;
      if (e.clientY < sr.top + edge) sc.scrollTop -= 10;
      else if (e.clientY > sr.bottom - edge) sc.scrollTop += 10;
      if (els.labelsBody) els.labelsBody.scrollTop = sc.scrollTop;
    }
  }

  function onTrackLabelEnd() {
    div.removeEventListener("pointermove", onTrackLabelMove);
    div.removeEventListener("pointerup", onTrackLabelEnd);
    div.removeEventListener("pointercancel", onTrackLabelEnd);
    div.classList.remove("dragging");
    (els.labelsBody || els.labels)
      ?.querySelectorAll(".tl-label.drop-before")
      .forEach((n) => n.classList.remove("drop-before"));
    if (tDrag?.moved && tDrag.toIndex != null && tDrag.toIndex !== tDrag.fromIndex) {
      if (store.reorderTrack(tDrag.id, tDrag.toIndex)) {
        toast(`Moved ${track.name} → slot ${tDrag.toIndex + 1}`, "ok");
      }
    }
    tDrag = null;
  }

  return div;
}

function buildClipEl(clip, totalWidth) {
  const el = document.createElement("div");
  const isSel = store.selectedClipIdList().includes(clip.id);
  el.className = "tl-clip" + (isSel ? " selected" : "");
  el.dataset.clipId = clip.id;
  el.dataset.type = clip.type;
  const left = timeToX(clip.start);
  const w = Math.max(8, timeToX(clip.duration));
  el.style.left = left + "px";
  el.style.width = w + "px";
  const speed = clip.speed && Math.abs(clip.speed - 1) > 0.01 ? ` · ${clip.speed.toFixed(2)}×` : "";
  const muted = store.isDetachSilent(clip) ? " · no audio" : clip.audioMuted ? " · muted" : "";
  const freeze = clip.freeze ? " · freeze" : "";
  const rev = clip.reversed ? " · rev" : "";
  const vol = clip.volume != null && Math.abs(clip.volume - 100) > 1 ? ` · ${Math.round(clip.volume)}%` : "";
  el.innerHTML = `
    <div class="fill"></div>
    ${clip.type === "audio" ? '<div class="wave"></div>' : ""}
    <div class="label">${escape(clip.name)}</div>
    <div class="sub">${clip.duration.toFixed(1)}s${speed}${rev}${freeze}${vol}${muted}</div>
    <div class="tl-handle l" data-handle="l"></div>
    <div class="tl-handle r" data-handle="r"></div>
    ${(clip.type === "audio" || clip.type === "video")
      ? store.isDetachSilent(clip)
        ? `<div class="tl-vol is-detached" title="Audio was detached — it lives on the independent audio clip">
            <button type="button" data-vol-act="goto-audio" title="Select the detached audio clip" aria-label="Select detached audio">♪</button>
            <span data-vol-val>Detached</span>
          </div>`
        : `<div class="tl-vol" title="Clip volume — − / + (Shift = ±25)">
          <button type="button" data-vol-act="down" title="Volume down (−10, Shift −25)" aria-label="Volume down">−</button>
          <span data-vol-val>${clip.audioMuted ? "Mute" : Math.round(clip.volume ?? 100) + "%"}</span>
          <button type="button" data-vol-act="up" title="Volume up (+10, Shift +25, max 500%)" aria-label="Volume up">+</button>
        </div>`
      : ""}
  `;
  if (clip.freeze) el.classList.add("is-freeze");
  if ((clip.volume ?? 100) > 100) el.classList.add("is-boosted");

  // Filmora-style inline volume stepper (audio + video clips)
  el.querySelector(".tl-vol")?.addEventListener("pointerdown", (e) => e.stopPropagation());
  el.querySelectorAll(".tl-vol button").forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => e.stopPropagation());
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (btn.dataset.volAct === "goto-audio") {
        const link = clip.linkedAudioId && store.getClip(clip.linkedAudioId);
        if (link) {
          store.setSelectedClips([link.id]);
          toast("Detached audio selected — adjust volume there", "ok");
        } else {
          toast("Detached audio clip is gone", "err");
        }
        return;
      }
      const big = e.shiftKey ? 25 : 10;
      const next = store.nudgeClipVolume(clip.id, btn.dataset.volAct === "up" ? big : -big);
      if (next !== false) toast(`Volume ${next}%`, "ok");
    });
    btn.addEventListener("dblclick", (e) => e.stopPropagation());
  });

  // Beat Sync markers (audio clips) — Filmora highlights vs all
  if (clip.beats && clip.beats.length && clip.type === "audio") {
    const bw = Math.max(8, timeToX(clip.duration));
    const layer = document.createElement("div");
    layer.className = "beat-layer";
    let freq = 4, offset = 0, showAll = false;
    try {
      const cfg = settings.beatConfig ? settings.beatConfig() : settings.get().beat;
      freq = cfg.highlightFreq || 4;
      offset = cfg.highlightOffset || 0;
      showAll = !!cfg.showAllBeats;
    } catch { /* defaults */ }
    clip.beats.forEach((bt, i) => {
      if (bt < 0 || bt > clip.duration) return;
      const isHl = (i - offset) % freq === 0;
      if (!showAll && !isHl) return;
      const tick = document.createElement("div");
      tick.className = "beat-tick" + (isHl ? " hl" : "");
      tick.style.left = (bt / clip.duration) * bw + "px";
      layer.appendChild(tick);
    });
    el.appendChild(layer);
  }

  el.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    e.preventDefault();
    const handle = e.target.dataset?.handle;
    // Filmora: clicking a clip parks the playhead at the click (so Split / Trim hit the right frame).
    if (!handle && !e.target.closest(".tl-vol")) {
      const rect = el.getBoundingClientRect();
      const t = clip.start + Math.max(0, Math.min(clip.duration, ((e.clientX - rect.left) / Math.max(1, rect.width)) * clip.duration));
      playerRef?.seek(t);
    }
    // Multi-select: Ctrl/Cmd toggles membership; plain click on an
    // already-grouped clip keeps the group for a group-move.
    if (e.ctrlKey || e.metaKey) {
      store.toggleSelectedClip(clip.id);
      if (store.selectedClipIdList().includes(clip.id)) openEditorForClip(clip);
    } else if (!store.selectedClipIdList().includes(clip.id)) {
      store.setSelectedClips([clip.id]);
      // CapCut/Filmora: single-click selection also opens the matching property panel
      openEditorForClip(clip);
    }
    const mode = handle === "l" ? "trim-l" : handle === "r" ? "trim-r" : "move";
    const group = mode === "move"
      ? store.selectedClipIdList()
        .filter((id) => id !== clip.id && store.getClip(id))
        .map((id) => {
          const c = store.getClip(id);
          return { id, origStart: c.start, trackId: c.trackId };
        })
      : [];
    drag = {
      id: clip.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      clientX: e.clientX,
      clientY: e.clientY,
      origStart: clip.start,
      origDur: clip.duration,
      origOffset: Math.max(0, Number(clip.offset) || 0),
      trackId: clip.trackId,
      type: clip.type,
      moved: false,
      group,
    };
    el.classList.add("dragging");
    window.addEventListener("pointermove", onGlobalDragMove);
    window.addEventListener("pointerup", onGlobalDragEnd);
    window.addEventListener("pointercancel", onGlobalDragEnd);
    startDragAutoScroll();
  });

  // Filmora-style: double-click clip → jump playhead + open on-canvas / inspector editor
  el.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    e.preventDefault();
    drag = null;
    stopDragAutoScroll();
    window.removeEventListener("pointermove", onGlobalDragMove);
    window.removeEventListener("pointerup", onGlobalDragEnd);
    window.removeEventListener("pointercancel", onGlobalDragEnd);
    el.classList.remove("dragging");
    clearTrackHighlights();
    const live = store.getClip(clip.id);
    activateClipOnCanvas(live || clip, playerRef);
  });

  return el;
}

function trackKindForClipType(type) {
  if (type === "audio") return "audio";
  if (type === "text") return "text";
  return "video";
}

function trackAtY(clientY) {
  const lanes = els.lanes?.querySelectorAll(".tl-track");
  if (!lanes) return null;
  for (const lane of lanes) {
    const r = lane.getBoundingClientRect();
    if (clientY >= r.top && clientY <= r.bottom) {
      return {
        id: lane.dataset.trackId,
        el: lane,
        top: r.top,
        height: r.height,
      };
    }
  }
  return null;
}

function highlightTargetTrack(trackId) {
  els.lanes?.querySelectorAll(".tl-track").forEach((lane) => {
    lane.classList.toggle("drop-ok", lane.dataset.trackId === trackId);
  });
}

function clearTrackHighlights() {
  els.lanes?.querySelectorAll(".tl-track").forEach((lane) => lane.classList.remove("drop-ok"));
}

function findCompatibleTrackFromY(clientY, clipType) {
  const hit = trackAtY(clientY);
  if (!hit) return null;
  const tracks = store.get().tracks;
  const track = tracks.find((t) => t.id === hit.id);
  if (!track || track.locked) return null;
  const want = trackKindForClipType(clipType);
  // Allow same-kind always. Also allow video-like clips on text tracks (titles over video).
  const ok =
    track.kind === want ||
    (want === "video" && track.kind === "text") ||
    (want === "text" && track.kind === "video");
  return ok ? hit : null;
}

/* Hold-still auto-scroll: while a clip is held near the timeline panel edges,
 * the panel keeps scrolling (vertically AND horizontally) even without further
 * pointer movement, so audio/video clips can be dragged to tracks and times
 * that are currently out of view. The label column follows the lane scroll. */
let dragAutoScrollTimer = null;

function startDragAutoScroll() {
  stopDragAutoScroll();
  dragAutoScrollTimer = setInterval(() => {
    if (!drag || drag.mode !== "move") return;
    const sc = els.scroll;
    if (!sc || drag.clientX == null || drag.clientY == null) return;
    const r = sc.getBoundingClientRect();
    const edge = 44;
    let dY = 0;
    let dX = 0;
    if (drag.clientY < r.top + edge) dY = -16;
    else if (drag.clientY > r.bottom - edge) dY = 16;
    if (drag.clientX < r.left + edge) dX = -28;
    else if (drag.clientX > r.right - edge) dX = 28;
    if (!dX && !dY) return;
    sc.scrollTop += dY;
    sc.scrollLeft += dX;
    if (els.labelsBody) els.labelsBody.scrollTop = sc.scrollTop;
    // The lanes moved under a held pointer: refresh the drop-target
    // highlight so it tracks the track now under the cursor.
    const target = findCompatibleTrackFromY(drag.clientY, drag.type);
    highlightTargetTrack(target ? target.id : null);
  }, 50);
}

function stopDragAutoScroll() {
  if (dragAutoScrollTimer) {
    clearInterval(dragAutoScrollTimer);
    dragAutoScrollTimer = null;
  }
}

function onGlobalDragMove(e) {
  if (!drag) return;
  const clip = store.getClip(drag.id);
  if (!clip) return;
  const dx = e.clientX - drag.startX;
  const dy = e.clientY - drag.startY;
  if (Math.abs(dx) > 2 || Math.abs(dy) > 2) drag.moved = true;
  // Remember the pointer for the hold-still auto-scroll ticker below.
  drag.clientX = e.clientX;
  drag.clientY = e.clientY;

  // Auto-scroll the timeline panel when dragging near its edges
  // (immediate nudge per move event; the ticker covers holding still).
  const sc = els.scroll;
  if (sc && drag.mode === "move") {
    const r = sc.getBoundingClientRect();
    const edge = 36;
    if (e.clientY < r.top + edge) sc.scrollTop -= 12;
    else if (e.clientY > r.bottom - edge) sc.scrollTop += 12;
    if (e.clientX < r.left + edge) sc.scrollLeft -= 24;
    else if (e.clientX > r.right - edge) sc.scrollLeft += 24;
    if (els.labelsBody) els.labelsBody.scrollTop = sc.scrollTop;
  }

  if (drag.mode === "move") {
    let start = Math.max(0, drag.origStart + dx / pps());
    if (document.getElementById("btnSnap")?.getAttribute("aria-pressed") !== "false") {
      start = smartSnap(start, drag.id, drag.origDur);
    }
    let trackId = clip.trackId;
    const target = findCompatibleTrackFromY(e.clientY, drag.type);
    if (target) {
      trackId = target.id;
      highlightTargetTrack(trackId);
    } else {
      // Vertical intent outside a compatible lane: keep current track, show no highlight
      if (Math.abs(dy) > 8) highlightTargetTrack(null);
    }
    const appliedDelta = start - drag.origStart;
    store.updateClip(drag.id, { start, trackId }, { silent: true });
    // Group move: peers glide by the same delta on their own tracks
    if (drag.group?.length && Math.abs(appliedDelta) > 0.0001) {
      for (const g of drag.group) {
        store.updateClip(g.id, { start: Math.max(0, g.origStart + appliedDelta) }, { silent: true });
      }
    }
  } else if (drag.mode === "trim-r") {
    let duration = Math.max(0.2, drag.origDur + dx / pps());
    if (document.getElementById("btnSnap")?.getAttribute("aria-pressed") !== "false") {
      const end = smartSnap(drag.origStart + duration, drag.id, duration);
      duration = Math.max(0.2, end - drag.origStart);
    }
    store.updateClip(drag.id, { duration }, { silent: true });
  } else if (drag.mode === "trim-l") {
    let start = Math.max(0, drag.origStart + dx / pps());
    let duration = drag.origDur - dx / pps();
    if (document.getElementById("btnSnap")?.getAttribute("aria-pressed") !== "false") {
      const snapped = smartSnap(start, drag.id, duration);
      const delta = snapped - start;
      start = snapped;
      duration = Math.max(0.2, duration - delta);
    }
    if (duration < 0.2) {
      duration = 0.2;
      start = drag.origStart + drag.origDur - 0.2;
    }
    // Left-trim moves the in-point: advancing start must advance the source
    // offset by the same delta (extending left consumes offset, never below 0).
    let offset = (drag.origOffset || 0) + (start - drag.origStart);
    if (offset < 0) {
      start = Math.max(0, drag.origStart - (drag.origOffset || 0));
      duration = drag.origStart + drag.origDur - start;
      offset = 0;
    }
    store.updateClip(drag.id, { start, duration, offset }, { silent: true });
  }
}

/** Filmora-style smart snap: clip edges, markers, beats, playhead, then 0.5s grid. */
function smartSnap(start, movingId, movingDur = 0) {
  const state = store.get();
  const threshold = 0.12 / pps() * 40; // ~few px worth of seconds
  const candidates = [];

  // playhead
  const ph = window.__aifimoraPlayer?.getTime?.();
  if (ph != null) candidates.push(ph, ph - movingDur);

  // markers
  (state.markers || []).forEach((m) => {
    if (m?.t != null) candidates.push(m.t, m.t - movingDur);
  });

  // other clip edges + beat markers on them
  state.clips.forEach((c) => {
    if (c.id === movingId) return;
    candidates.push(c.start, c.start + c.duration, c.start - movingDur, c.start + c.duration - movingDur);
    (c.beats || []).forEach((b) => {
      const abs = c.start + b;
      candidates.push(abs, abs - movingDur);
    });
  });

  // 0.5s grid as fallback
  candidates.push(Math.round(start * 2) / 2);

  let best = start;
  let bestDist = Infinity;
  for (const cand of candidates) {
    if (cand < -0.01) continue;
    const d = Math.abs(cand - start);
    if (d < bestDist && d <= Math.max(0.05, threshold)) {
      bestDist = d;
      best = Math.max(0, cand);
    }
  }
  return best;
}

function onGlobalDragEnd() {
  window.removeEventListener("pointermove", onGlobalDragMove);
  window.removeEventListener("pointerup", onGlobalDragEnd);
  window.removeEventListener("pointercancel", onGlobalDragEnd);
  stopDragAutoScroll();
  clearTrackHighlights();
  if (!drag) return;
  const d = drag;
  drag = null;
  const clip = store.getClip(d.id);
  if (clip) {
    const node = els.lanes?.querySelector(`.tl-clip[data-clip-id="${d.id}"]`);
    node?.classList.remove("dragging");
    if (d.mode === "move" && (clip.trackId !== d.trackId || (d.group?.length && d.moved))) {
      if (d.group?.length) toast(`Moved ${d.group.length + 1} clips`, "ok");
      else {
        const track = store.get().tracks.find((t) => t.id === clip.trackId);
        toast(`Moved to ${track?.name || "track"}`, "ok");
      }
      // Full rebuild so the clip sits cleanly in the new lane
      renderTimeline();
    }
  }
  store.save();
  updateMultiCount();
}

/** Keyboard: Alt+↑/↓ move selected clip across compatible tracks */
export function moveSelectedClipTrack(dir) {
  const id = store.get().selectedClipId;
  if (!id) {
    toast("Select a clip first");
    return;
  }
  const clip = store.getClip(id);
  if (!clip) return;
  const tracks = store.get().tracks;
  const want = trackKindForClipType(clip.type);
  const compatible = tracks.filter(
    (t) => !t.locked && (t.kind === want || (want === "video" && t.kind === "text") || (want === "text" && t.kind === "video"))
  );
  const idx = compatible.findIndex((t) => t.id === clip.trackId);
  if (idx < 0) return;
  const next = compatible[idx + dir];
  if (!next) {
    toast(dir < 0 ? "Already on top compatible track" : "Already on bottom compatible track");
    return;
  }
  store.updateClip(id, { trackId: next.id });
  store.save();
  toast(`Moved to ${next.name}`, "ok");
}

function onRulerSeek(e) {
  const ruler = e.currentTarget;
  const rect = ruler.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const t = xToTime(x);
  playerRef?.seek(t);
}

function setPlayheadVisual(t) {
  window.__aifimoraPlayhead = t;
  const ph = document.getElementById("tlPlayhead");
  if (ph) ph.style.left = timeToX(t) + "px";
  const tc = document.getElementById("timecode");
  if (tc) tc.textContent = formatTC(t);
}

function escape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function getZoom() {
  return zoom;
}
