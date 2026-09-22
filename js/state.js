/* AiFimora project state — pub/sub store */
const STORAGE_KEY = "aifimora.project.v1";

const DEFAULT_FX = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0, // Filmora white-balance tint (green↔magenta)
  highlights: 0, // -50..+50
  shadows: 0, // -50..+50
  sharpness: 0, // 0..100 (Filmora Sharpen)
  vignette: 0,
  lut: "none",
  lutIntensity: 80, // 0..100 (Filmora LUT strength)
  mask: false,
  maskFeather: 20, // Filmora Smart Mask feather
  maskInvert: false,
  voiceEnhance: false,
  voiceStrength: 60, // Filmora Voice Enhancer intensity
  denoise: false,
  denoiseStrength: "medium", // off | weak | medium | strong
  humRemoval: false,
  windRemoval: false,
  eqPreset: "flat",
  upscale: false,
  upscaleIntensity: 60,
  stabilize: false, // Filmora Video Stabilization
  stabilizeSmooth: 50, // 0..100 smoothness
  lensCorrect: false,
  faceMosaic: false, // Filmora AI Face Mosaic
  faceMosaicSize: 24,
  objectRemover: false, // Filmora AI Object Remover flag
  reframe: "none",
  crop: { x: 0, y: 0, w: 1, h: 1 },
  chroma: false,
  chromaColor: "#00ff00",
  chromaSimilarity: 0.4,
  chromaSmoothness: 0.1,
  chromaFeather: 10, // Filmora Enhanced Chroma edge feather
  chromaSpill: 10, // spill suppression
  split: "none", // none | side | pip | grid4
  motionBlur: 0, // Filmora 15 Motion Blur 0..100
  deflicker: 0, // Filmora Flicker Removal 0..100
  voiceChanger: null, // { id, pitch, rate } Voice Changer preset
};

const DEFAULT_TEXT_STYLE = {
  content: "Your title",
  font: "Segoe UI",
  size: 48,
  weight: 700,
  color: "#ffffff",
  bg: "rgba(0,0,0,0)",
  align: "center",
  pos: "center",
  x: 0.5,
  y: 0.5,
  anim: "fade",
  shadow: true,
  letterSpacing: 0,
  uppercase: false,
};

/** Per-clip Motion (Filmora-style transform + keyframes). null = identity. */
export const DEFAULT_MOTION = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 100,
  anchorX: 0.5,
  anchorY: 0.5,
  keys: null, // array of { t, x, y, scale, rotation, opacity } over clip-local seconds
};

const DEFAULT_PROJECT = () => ({
  name: "Untitled Project",
  fps: 30,
  width: 1920,
  height: 1080,
  // Project canvas length hint; sequence duration is derived from clips.
  // Keep 0 so empty/short cuts are not forced to a phantom 48s timeline.
  duration: 0,
  credits: { used: 0, cap: 1000 },
  selectedClipId: null,
  selectedClipIds: [],
  selectedMediaId: null,
  selectedMediaIds: [],
  tracks: [
    { id: "v2", kind: "video", name: "V2", locked: false, muted: false, solo: false, hidden: false },
    { id: "v1", kind: "video", name: "V1", locked: false, muted: false, solo: false, hidden: false },
    { id: "t1", kind: "text", name: "Text", locked: false, muted: false, solo: false, hidden: false },
    { id: "a1", kind: "audio", name: "A1", locked: false, muted: false, solo: false, hidden: false },
    { id: "a2", kind: "audio", name: "A2", locked: false, muted: false, solo: false, hidden: false },
  ],
  clips: [],
  media: [],
  transcript: null,
  captions: [],
  jobs: [],
  mateLog: [
    {
      role: "bot",
      text: "Hi — I'm AI Mate. I can cut silence, write captions, grade color, generate B-roll, reframe, and edit the timeline from your words. What should we do first?",
      ts: Date.now(),
    },
  ],
  history: [],
  markers: [],
  chapters: [], // Filmora 15 Video Chapters [{ t, name }]
  voiceClones: [], // AI Voice Cloning enrollments
  subprojects: [], // Import Subprojects registry
});

class Store {
  constructor() {
    this.state = DEFAULT_PROJECT();
    this.listeners = new Set();
    this._undo = [];
    this._redo = [];
    this._undoCap = 50;
  }

  /** Snapshot project fields for undo. Call BEFORE a mutation. */
  pushUndo(label = "Edit") {
    const snap = {
      label,
      ts: Date.now(),
      clips: JSON.parse(JSON.stringify(this.state.clips)),
      tracks: JSON.parse(JSON.stringify(this.state.tracks)),
      media: JSON.parse(JSON.stringify(this.state.media || [])),
      captions: JSON.parse(JSON.stringify(this.state.captions || [])),
      markers: JSON.parse(JSON.stringify(this.state.markers || [])),
      chapters: JSON.parse(JSON.stringify(this.state.chapters || [])),
      selectedClipId: this.state.selectedClipId,
      selectedClipIds: [...(this.state.selectedClipIds || [])],
      selectedMediaId: this.state.selectedMediaId || null,
      selectedMediaIds: [...(this.state.selectedMediaIds || [])],
      credits: { ...this.state.credits },
      name: this.state.name,
    };
    this._undo.push(snap);
    if (this._undo.length > this._undoCap) this._undo.shift();
    this._redo = [];
    // Do not emit here — callers emit after the actual mutation
  }

  canUndo() {
    return this._undo.length > 0;
  }

  canRedo() {
    return this._redo.length > 0;
  }

  peekUndoLabel() {
    return this._undo[this._undo.length - 1]?.label || null;
  }

  peekRedoLabel() {
    return this._redo[this._redo.length - 1]?.label || null;
  }

  undo() {
    if (!this._undo.length) return null;
    const snap = this._undo.pop();
    this._redo.push({
      label: snap.label,
      ts: Date.now(),
      clips: JSON.parse(JSON.stringify(this.state.clips)),
      tracks: JSON.parse(JSON.stringify(this.state.tracks)),
      media: JSON.parse(JSON.stringify(this.state.media || [])),
      captions: JSON.parse(JSON.stringify(this.state.captions || [])),
      markers: JSON.parse(JSON.stringify(this.state.markers || [])),
      chapters: JSON.parse(JSON.stringify(this.state.chapters || [])),
      selectedClipId: this.state.selectedClipId,
      selectedClipIds: [...(this.state.selectedClipIds || [])],
      selectedMediaId: this.state.selectedMediaId || null,
      selectedMediaIds: [...(this.state.selectedMediaIds || [])],
      credits: { ...this.state.credits },
      name: this.state.name,
    });
    this.state = {
      ...this.state,
      clips: snap.clips,
      tracks: snap.tracks,
      media: snap.media || this.state.media,
      captions: snap.captions,
      markers: snap.markers,
      chapters: snap.chapters || [],
      selectedClipId: snap.selectedClipId,
      selectedClipIds: snap.selectedClipIds || (snap.selectedClipId ? [snap.selectedClipId] : []),
      selectedMediaId: snap.selectedMediaId || null,
      selectedMediaIds: snap.selectedMediaIds || [],
      credits: snap.credits,
      name: snap.name,
    };
    this.emit();
    this.save();
    return snap.label;
  }

  redo() {
    if (!this._redo.length) return null;
    const snap = this._redo.pop();
    this._undo.push({
      label: snap.label,
      ts: Date.now(),
      clips: JSON.parse(JSON.stringify(this.state.clips)),
      tracks: JSON.parse(JSON.stringify(this.state.tracks)),
      media: JSON.parse(JSON.stringify(this.state.media || [])),
      captions: JSON.parse(JSON.stringify(this.state.captions || [])),
      markers: JSON.parse(JSON.stringify(this.state.markers || [])),
      chapters: JSON.parse(JSON.stringify(this.state.chapters || [])),
      selectedClipId: this.state.selectedClipId,
      selectedClipIds: [...(this.state.selectedClipIds || [])],
      selectedMediaId: this.state.selectedMediaId || null,
      selectedMediaIds: [...(this.state.selectedMediaIds || [])],
      credits: { ...this.state.credits },
      name: this.state.name,
    });
    this.state = {
      ...this.state,
      clips: snap.clips,
      tracks: snap.tracks,
      media: snap.media || this.state.media,
      captions: snap.captions,
      markers: snap.markers,
      chapters: snap.chapters || [],
      selectedClipId: snap.selectedClipId,
      selectedClipIds: snap.selectedClipIds || (snap.selectedClipId ? [snap.selectedClipId] : []),
      selectedMediaId: snap.selectedMediaId || null,
      selectedMediaIds: snap.selectedMediaIds || [],
      credits: snap.credits,
      name: snap.name,
    };
    this.emit();
    this.save();
    return snap.label;
  }

  get() {
    return this.state;
  }

  set(patch, { silent = false } = {}) {
    const next = { ...this.state, ...patch };
    // Keep single/multi clip selection in sync for legacy callers that
    // only set selectedClipId (inspector, context menu, drops, AI tools).
    if (Object.hasOwn(patch, "selectedClipId") && !Object.hasOwn(patch, "selectedClipIds")) {
      next.selectedClipIds = patch.selectedClipId ? [patch.selectedClipId] : [];
    }
    if (Object.hasOwn(patch, "selectedMediaId") && !Object.hasOwn(patch, "selectedMediaIds")) {
      next.selectedMediaIds = patch.selectedMediaId ? [patch.selectedMediaId] : [];
    }
    this.state = next;
    if (!silent) this.emit();
  }

  update(fn, opts) {
    const next = fn(this.state);
    this.set(next, opts);
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    this.listeners.forEach((fn) => fn(this.state));
  }

  save() {
    try {
      // Blob: URLs die on reload — persist them as idb: placeholders.
      // The real bytes live in IndexedDB (see js/media.js) and are
      // re-hydrated to fresh blob: URLs on boot.
      const media = (this.state.media || []).map((m) => {
        const copy = { ...m };
        if (copy?.url && String(copy.url).startsWith("blob:")) {
          copy.url = `idb:${m.id}`;
          copy._offline = true;
        }
        // Image thumbs are often the same blob: URL — drop dead thumbs
        // (player falls back to media.url / generated thumb).
        if (copy?.thumb && String(copy.thumb).startsWith("blob:")) {
          copy.thumb = null;
        }
        return copy;
      });
      const snapshot = {
        ...this.state,
        media,
        jobs: this.state.jobs.slice(-20),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      this._lastSavedAt = Date.now();
      this.notifySaved();
    } catch (e) {
      console.warn("save failed", e);
    }
  }

  notifySaved() {
    window.dispatchEvent(
      new CustomEvent("aifimora:saved", { detail: { at: this._lastSavedAt || Date.now() } })
    );
  }

  getLastSavedAt() {
    return this._lastSavedAt || null;
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || typeof data !== "object") return false;
      this.state = sanitizeProject(data);
      this._lastSavedAt = Date.now();
      this.emit();
      this.notifySaved();
      return true;
    } catch {
      return false;
    }
  }

  /** Replace the whole project from an imported object (file import / .aifimora). */
  importProject(obj) {
    try {
      if (!obj || typeof obj !== "object") return false;
      const data = sanitizeProject(obj);
      this.state = data;
      this._lastSavedAt = Date.now();
      this.emit();
      this.save();
      return true;
    } catch {
      return false;
    }
  }

  reset() {
    this.state = DEFAULT_PROJECT();
    this.emit();
    this.save();
  }

  /* --- credits --- */
  creditLeft() {
    const c = this.state.credits || { used: 0, cap: 0 };
    return Math.max(0, (c.cap || 0) - (c.used || 0));
  }

  spendCredits(n, reason) {
    const amount = Number(n) || 0;
    if (amount <= 0) return { ok: true };
    const left = this.creditLeft();
    if (left < amount) {
      return { ok: false, reason: `Need ${amount} credits, only ${left} left.` };
    }
    const credits = { ...this.state.credits, used: (this.state.credits.used || 0) + amount };
    this.state = { ...this.state, credits };
    this.pushHistory({ type: "credits", n: amount, reason });
    this.emit();
    this.save();
    return { ok: true };
  }

  pushHistory(entry) {
    this.state.history = [...this.state.history, { ...entry, ts: Date.now() }].slice(-100);
  }

  /* --- clips --- */
  uid(prefix = "c") {
    return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
  }

  addClip(clip) {
    this.pushUndo("Add clip");
    const base = {
      id: this.uid("clip"),
      type: "video",
      trackId: "v1",
      start: 0,
      duration: 4,
      name: "Clip",
      mediaId: null,
      // Source in-point (seconds into the media file where this clip begins).
      // Split / trim-left advance it so the right half continues the picture
      // instead of restarting from the media head (Filmora behaviour).
      offset: 0,
      fx: { ...DEFAULT_FX },
      text: "",
      speed: 1,
      volume: 100,
      fadeIn: 0,
      fadeOut: 0,
      audioMuted: false,
      audioDetached: false,
      linkedAudioId: null,
      speedRamp: null, // { in:0..1, out:0..1, peak } ease
      proxy: false,
      compoundId: null,
      ...clip,
    };
    const c = {
      ...base,
      fx: { ...DEFAULT_FX, ...(clip.fx || {}) },
      textStyle: clip.textStyle || (clip.type === "text" && !clip.shape ? { ...DEFAULT_TEXT_STYLE, content: clip.text || clip.name || "Title" } : clip.shape ? { ...DEFAULT_TEXT_STYLE, content: "" } : undefined),
      shape: clip.shape || null,
      motion: clip.motion || null,
      outTransition: clip.outTransition || null,
      duration: Math.max(0.1, Number(base.duration) || 4),
      start: Math.max(0, Number(base.start) || 0),
      speed: Math.min(4, Math.max(0.25, Number(base.speed) || 1)),
    };
    this.state.clips = [...this.state.clips, c];
    this.pushHistory({ type: "addClip", id: c.id, name: c.name });
    this.emit();
    this.save();
    return c;
  }

  updateClip(id, patch, { silent = false, undo = false } = {}) {
    if (undo) this.pushUndo("Edit clip");
    this.state.clips = this.state.clips.map((c) => {
      if (c.id !== id) return c;
      const next = { ...c, ...patch };
      next.fx = { ...(c.fx || DEFAULT_FX), ...(patch.fx || {}) };
      if (c.textStyle || patch.textStyle) {
        next.textStyle = { ...(c.textStyle || DEFAULT_TEXT_STYLE), ...(patch.textStyle || {}) };
      }
      return next;
    });
    this.emit();
    if (!silent) this.save();
  }

  removeClip(id) {
    this.removeClips([id]);
  }

  /** Multi-select helpers for timeline rubber-band selection. */
  selectedClipIdList() {
    const arr = Array.isArray(this.state.selectedClipIds) && this.state.selectedClipIds.length
      ? this.state.selectedClipIds
      : this.state.selectedClipId
        ? [this.state.selectedClipId]
        : [];
    return arr.filter((id) => this.state.clips.some((c) => c.id === id));
  }

  setSelectedClips(ids, { silent = false } = {}) {
    const valid = new Set(this.state.clips.map((c) => c.id));
    const list = [...new Set((Array.isArray(ids) ? ids : [ids]).filter((id) => id && valid.has(id)))];
    this.state = {
      ...this.state,
      selectedClipIds: list,
      selectedClipId: list.length ? list[list.length - 1] : null,
    };
    if (!silent) this.emit();
  }

  toggleSelectedClip(id) {
    const cur = new Set(this.selectedClipIdList());
    if (cur.has(id)) cur.delete(id);
    else if (this.getClip(id)) cur.add(id);
    this.setSelectedClips([...cur]);
  }

  clearSelectedClips({ silent = false } = {}) {
    this.setSelectedClips([], { silent });
  }

  /** Delete several clips at once (marquee selection). Undoable. */
  removeClips(ids) {
    const list = [...new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean))];
    if (!list.length) return { ok: false, reason: "Nothing selected" };
    const byId = new Map(this.state.clips.map((c) => [c.id, c]));
    const targets = list.filter((id) => byId.has(id));
    if (!targets.length) return { ok: false, reason: "Clip not found" };
    this.pushUndo(targets.length > 1 ? `Delete ${targets.length} clips` : "Delete clip");
    const drop = new Set(targets);
    // Also drop linked audio of removed clips
    for (const id of targets) {
      const linked = byId.get(id)?.linkedAudioId;
      if (linked) drop.add(linked);
    }
    const removed = this.state.clips.filter((c) => drop.has(c.id));
    this.state.clips = this.state.clips.filter((c) => !drop.has(c.id));
    if (removed.length) this.pushHistory({ type: "removeClip", count: removed.length, name: removed[0]?.name });
    if (drop.has(this.state.selectedClipId)) this.state.selectedClipId = null;
    this.state.selectedClipIds = (this.state.selectedClipIds || []).filter((id) => !drop.has(id));
    if (!this.state.selectedClipId && this.state.selectedClipIds.length) {
      this.state.selectedClipId = this.state.selectedClipIds[this.state.selectedClipIds.length - 1];
    }
    this.emit();
    this.save();
    return { ok: true, removed: removed.length };
  }

  /**
   * Trim clip start to playhead (Filmora-style left trim).
   * The clip's start moves to the playhead and its source offset advances,
   * so the remaining head shows the correct later frame (not the old head).
   * Ripple shifts the clip (and later clips if rippleGap).
   */
  trimStartAtPlayhead(id, playhead, { rippleGap = false } = {}) {
    const clip = this.getClip(id);
    if (!clip) return { ok: false, reason: "Select a clip" };
    const t = Number(playhead) || 0;
    if (t <= clip.start + 0.05) return { ok: false, reason: "Playhead is at/before clip start" };
    if (t >= clip.start + clip.duration - 0.05) return { ok: false, reason: "Playhead is at/after clip end" };
    this.pushUndo("Trim start");
    const cut = t - clip.start;
    const newStart = t;
    const newDur = clip.start + clip.duration - t;
    const newOffset = Math.max(0, (Number(clip.offset) || 0) + cut);
    this.state.clips = this.state.clips.map((c) => {
      if (c.id === id) return { ...c, start: newStart, duration: Math.max(0.1, newDur), offset: newOffset };
      if (clip.linkedAudioId && c.id === clip.linkedAudioId) {
        return { ...c, start: newStart, duration: Math.max(0.1, newDur), offset: newOffset };
      }
      if (rippleGap && c.trackId === clip.trackId && c.start >= clip.start + clip.duration - 0.001) {
        return { ...c, start: Math.max(0, c.start - cut) };
      }
      return c;
    });
    this.pushHistory({ type: "trimStart", id });
    this.emit();
    this.save();
    return { ok: true, cut };
  }

  /** Trim clip end to playhead. */
  trimEndAtPlayhead(id, playhead, { rippleGap = false } = {}) {
    const clip = this.getClip(id);
    if (!clip) return { ok: false, reason: "Select a clip" };
    const t = Number(playhead) || 0;
    const end = clip.start + clip.duration;
    if (t >= end - 0.05) return { ok: false, reason: "Playhead is at/after clip end" };
    if (t <= clip.start + 0.05) return { ok: false, reason: "Playhead is at/before clip start" };
    this.pushUndo("Trim end");
    const cut = end - t;
    const newDur = Math.max(0.1, clip.duration - cut);
    this.state.clips = this.state.clips.map((c) => {
      if (c.id === id) return { ...c, duration: newDur };
      if (clip.linkedAudioId && c.id === clip.linkedAudioId) {
        return { ...c, duration: newDur };
      }
      if (rippleGap && c.trackId === clip.trackId && c.start >= end - 0.001) {
        return { ...c, start: Math.max(0, c.start - cut) };
      }
      return c;
    });
    this.pushHistory({ type: "trimEnd", id });
    this.emit();
    this.save();
    return { ok: true, cut };
  }

  /** Clip volume 0–500 (100 = unity). Stored on clip. */
  setClipVolume(id, volume) {
    const clip = this.getClip(id);
    if (!clip) return false;
    const v = Math.min(500, Math.max(0, Math.round(Number(volume) || 0)));
    this.pushUndo(`Volume ${v}%`);
    this.updateClip(id, { volume: v });
    if (clip.linkedAudioId) {
      this.updateClip(clip.linkedAudioId, { volume: v }, { silent: true });
    }
    return true;
  }

  /** Filmora-style step up/down of clip volume (timeline −/+ control). */
  nudgeClipVolume(id, delta) {
    const clip = this.getClip(id);
    if (!clip || clip.type === "text") return false;
    const step = Number(delta) || 0;
    const v = Math.min(500, Math.max(0, Math.round((clip.volume ?? 100) + step)));
    if (v === (clip.volume ?? 100)) return false;
    this.pushUndo(`Volume ${v}%`);
    this.updateClip(id, { volume: v });
    if (clip.linkedAudioId) {
      this.updateClip(clip.linkedAudioId, { volume: v }, { silent: true });
    }
    return v;
  }

  setClipFades(id, { fadeIn = null, fadeOut = null } = {}) {
    const clip = this.getClip(id);
    if (!clip) return false;
    this.pushUndo("Fades");
    const patch = {};
    if (fadeIn != null) patch.fadeIn = Math.max(0, Number(fadeIn) || 0);
    if (fadeOut != null) patch.fadeOut = Math.max(0, Number(fadeOut) || 0);
    this.updateClip(id, patch);
    return true;
  }

  /**
   * Rescale clip length for a new rate.
   * When ripple=true, later clips on the same track (and linked audio) shift by the length delta.
   */
  setClipSpeed(id, speed, { ripple = true, muteWhenNot1x = false } = {}) {
    const clip = this.getClip(id);
    if (!clip || clip.type === "text") return false;
    const next = Math.min(8, Math.max(0.25, Number(speed) || 1));
    const prev = clip.speed || 1;
    if (Math.abs(next - prev) < 0.001) return false;
    this.pushUndo(`Speed ${next.toFixed(2)}×`);
    const newDuration = Math.max(0.1, (clip.duration * prev) / next);
    const delta = newDuration - clip.duration;
    const patch = {
      speed: next,
      duration: newDuration,
      reversed: false,
    };
    if (muteWhenNot1x) patch.audioMuted = Math.abs(next - 1) > 0.01;

    this.state.clips = this.state.clips.map((c) => {
      if (c.id === id) return { ...c, ...patch };
      // linked audio follows video length/speed
      if (clip.linkedAudioId && c.id === clip.linkedAudioId) {
        return { ...c, speed: next, duration: newDuration };
      }
      if (ripple && c.trackId === clip.trackId && c.start >= clip.start + clip.duration - 0.001) {
        return { ...c, start: Math.max(0, c.start + delta) };
      }
      return c;
    });
    this.pushHistory({ type: "speed", id, next, delta });
    this.emit();
    this.save();
    return true;
  }

  /** Insert a still (freeze) clip at playhead on the source track; ripples later clips. */
  freezeFrame(sourceId, holdSeconds = 2, playhead = 0) {
    const src = this.getClip(sourceId);
    if (!src || src.type === "text" || src.type === "audio") return { ok: false, reason: "Select a video clip" };
    const hold = Math.max(0.25, Number(holdSeconds) || 2);
    // freeze at playhead if inside clip, else at clip end
    let insertAt = playhead;
    if (playhead < src.start || playhead > src.start + src.duration) {
      insertAt = src.start + src.duration;
    }
    insertAt = Math.max(0, insertAt);

    this.pushUndo("Freeze frame");
    const freezeId = this.uid("clip");
    const freeze = {
      id: freezeId,
      type: "video",
      trackId: src.trackId,
      name: `Freeze · ${src.name}`,
      mediaId: src.mediaId,
      start: insertAt,
      duration: hold,
      // Hold the exact frame at the insert point, not the media head.
      offset: Math.max(0, (Number(src.offset) || 0) + Math.max(0, insertAt - src.start)),
      speed: 1,
      freeze: true,
      fx: { ...(src.fx || DEFAULT_FX) },
    };
    // ripple later clips on this track
    const shifted = this.state.clips.map((c) => {
      if (c.trackId === src.trackId && c.start >= insertAt - 0.001) {
        return { ...c, start: c.start + hold };
      }
      return c;
    });
    this.state.clips = [...shifted, freeze];
    this.pushHistory({ type: "freeze", id: freezeId, hold });
    this.emit();
    this.save();
    return { ok: true, id: freezeId, insertAt, hold };
  }

  reverseClip(id) {
    const clip = this.getClip(id);
    if (!clip || clip.type === "text") return false;
    this.pushUndo(clip.reversed ? "Forward" : "Reverse");
    this.updateClip(id, { reversed: !clip.reversed });
    return true;
  }

  /** Split audio off a video clip onto the first free A track. */
  detachAudio(id) {
    const clip = this.getClip(id);
    if (!clip) return { ok: false, reason: "Select a clip" };
    if (clip.type === "audio") return { ok: false, reason: "Clip is already audio" };
    if (clip.audioDetached || clip.linkedAudioId) return { ok: false, reason: "Audio already detached" };
    if (clip.type === "text") return { ok: false, reason: "Text clips have no audio" };

    this.pushUndo("Detach audio");
    const audioId = this.uid("clip");
    const audioClip = {
      id: audioId,
      type: "audio",
      trackId: "a1",
      name: `${clip.name} · audio`,
      mediaId: clip.mediaId,
      start: clip.start,
      duration: clip.duration,
      speed: clip.speed || 1,
      // The sound now lives here: inherit the video's level + fades + source offset.
      offset: Math.max(0, Number(clip.offset) || 0),
      volume: clip.volume ?? 100,
      fadeIn: clip.fadeIn || 0,
      fadeOut: clip.fadeOut || 0,
      audioMuted: false,
      fx: { ...DEFAULT_FX, voiceEnhance: clip.fx?.voiceEnhance || false },
      linkedFromId: clip.id,
    };
    this.state.clips = [...this.state.clips, audioClip];
    this.state.clips = this.state.clips.map((c) =>
      c.id === clip.id ? { ...c, audioDetached: true, linkedAudioId: audioId, audioMuted: true } : c
    );
    this.pushHistory({ type: "detachAudio", id: audioId });
    this.emit();
    this.save();
    return { ok: true, audioId };
  }

  setClipMuted(id, muted) {
    const clip = this.getClip(id);
    if (!clip) return false;
    this.pushUndo(muted ? "Mute clip" : "Unmute clip");
    this.updateClip(id, { audioMuted: !!muted });
    return true;
  }

  /**
   * Filmora rule: once audio is detached, the video itself carries no
   * sound — the audio lives only in the independent clip. This is
   * structural (not just the mute flag) so no UI path can resurrect
   * video audio while the linked audio clip exists.
   */
  isDetachSilent(clip) {
    if (!clip || clip.type === "audio" || clip.type === "text") return false;
    if (!clip.audioDetached || !clip.linkedAudioId) return false;
    return !!this.getClip(clip.linkedAudioId);
  }

  /** Filmora-style track mute from the track header. */
  toggleTrackMute(trackId) {
    this.pushUndo("Track mute");
    this.state.tracks = this.state.tracks.map((t) =>
      t.id === trackId ? { ...t, muted: !t.muted } : t
    );
    this.emit();
    this.save();
    const t = this.state.tracks.find((x) => x.id === trackId);
    return t?.muted;
  }

  toggleTrackLock(trackId) {
    this.pushUndo("Track lock");
    this.state.tracks = this.state.tracks.map((t) =>
      t.id === trackId ? { ...t, locked: !t.locked } : t
    );
    this.emit();
    this.save();
    return this.state.tracks.find((t) => t.id === trackId)?.locked;
  }

  toggleTrackHide(trackId) {
    this.pushUndo("Track hide");
    this.state.tracks = this.state.tracks.map((t) =>
      t.id === trackId ? { ...t, hidden: !t.hidden } : t
    );
    this.emit();
    this.save();
    return this.state.tracks.find((t) => t.id === trackId)?.hidden;
  }

  /** Solo: isolate this track (and clear other solos if already soloed). */
  toggleTrackSolo(trackId) {
    this.pushUndo("Track solo");
    const target = this.state.tracks.find((t) => t.id === trackId);
    if (!target) return false;
    const wasSolo = !!target.solo;
    this.state.tracks = this.state.tracks.map((t) =>
      wasSolo ? { ...t, solo: false } : { ...t, solo: t.id === trackId }
    );
    this.emit();
    this.save();
    return !wasSolo;
  }

  /** Delete selected clip and close the gap (Filmora ripple delete). */
  rippleDeleteClip(id) {
    const clip = this.getClip(id);
    if (!clip) return { ok: false, reason: "Select a clip" };
    if (this.state.tracks.find((t) => t.id === clip.trackId)?.locked) {
      return { ok: false, reason: "Track is locked" };
    }
    this.pushUndo("Ripple delete");
    const end = clip.start + clip.duration;
    this.state.clips = this.state.clips
      .filter((c) => c.id !== id && c.id !== clip.linkedAudioId)
      .map((c) => {
        if (c.trackId === clip.trackId && c.start >= end - 0.001) {
          return { ...c, start: Math.max(0, c.start - clip.duration) };
        }
        return c;
      });
    if (this.state.selectedClipId === id) this.state.selectedClipId = null;
    this.pushHistory({ type: "rippleDelete", id });
    this.emit();
    this.save();
    return { ok: true };
  }

  /** Duplicate clip on same track (or next free compatible), offset to end. */
  duplicateClip(id) {
    const clip = this.getClip(id);
    if (!clip) return null;
    this.pushUndo("Duplicate clip");
    const copy = {
      ...JSON.parse(JSON.stringify(clip)),
      id: this.uid("clip"),
      start: clip.start + clip.duration + 0.05,
      name: clip.name + " copy",
    };
    // nudge if overlapping
    let start = copy.start;
    const same = this.clipsOnTrack(clip.trackId);
    while (same.some((c) => start < c.start + c.duration && start + copy.duration > c.start)) {
      start += 0.1;
    }
    copy.start = start;
    this.state.clips = [...this.state.clips, copy];
    this.state.selectedClipId = copy.id;
    this.pushHistory({ type: "duplicate", id: copy.id });
    this.emit();
    this.save();
    return copy;
  }

  pasteClipAt(sourceClip, { trackId = null, at = null } = {}) {
    if (!sourceClip) return null;
    this.pushUndo("Paste clip");
    const playhead = at != null ? at : sourceClip.start;
    const copy = {
      ...JSON.parse(JSON.stringify(sourceClip)),
      id: this.uid("clip"),
      start: Math.max(0, playhead),
      trackId: trackId || sourceClip.trackId,
    };
    this.state.clips = [...this.state.clips, copy];
    this.state.selectedClipId = copy.id;
    this.pushHistory({ type: "paste", id: copy.id });
    this.emit();
    this.save();
    return copy;
  }

  /** Group selected clips into a compound (nested) clip placeholder. */
  compoundSelected(name = "Compound clip") {
    const ids = this.state.clips
      .filter((c) => c.compoundId == null && c.id === this.state.selectedClipId)
      .map((c) => c.id);
    // If multi-select not present, compound all overlapping clips on selected clip's track + next video track
    const sel = this.getClip(this.state.selectedClipId);
    if (!sel) return { ok: false, reason: "Select a clip" };
    const members = this.state.clips.filter(
      (c) =>
        !c.compoundId &&
        ((c.trackId === sel.trackId && c.start < sel.start + sel.duration && c.start + c.duration > sel.start) ||
          (c.type === "audio" && c.start < sel.start + sel.duration && c.start + c.duration > sel.start))
    );
    if (members.length < 1) return { ok: false, reason: "Nothing to nest" };
    this.pushUndo("Compound clip");
    const compoundId = this.uid("cmp");
    this.state.clips = this.state.clips.map((c) =>
      members.some((m) => m.id === c.id) ? { ...c, compoundId } : c
    );
    this.pushHistory({ type: "compound", compoundId, name });
    this.emit();
    this.save();
    return { ok: true, compoundId, count: members.length };
  }

  uncompound(compoundId) {
    if (!compoundId) return false;
    this.pushUndo("Unnest compound");
    this.state.clips = this.state.clips.map((c) =>
      c.compoundId === compoundId ? { ...c, compoundId: null } : c
    );
    this.pushHistory({ type: "uncompound", compoundId });
    this.emit();
    this.save();
    return true;
  }

  setProjectSettings({ width, height, fps } = {}) {
    this.pushUndo("Project settings");
    const patch = {};
    if (width) patch.width = Math.round(width);
    if (height) patch.height = Math.round(height);
    if (fps) patch.fps = fps;
    this.state = { ...this.state, ...patch };
    this.pushHistory({ type: "projectSettings", ...patch });
    this.emit();
    this.save();
  }

  /** Apply preferences project defaults when creating a new project. */
  applyProjectDefaults(defaults) {
    if (!defaults) return;
    this.state = {
      ...this.state,
      width: defaults.width || this.state.width,
      height: defaults.height || this.state.height,
      fps: defaults.fps || this.state.fps,
    };
  }

  /** Move track to a new index in the tracks array. Clips keep their trackId. */
  reorderTrack(trackId, toIndex) {
    this.pushUndo("Reorder track");
    const tracks = [...this.state.tracks];
    const from = tracks.findIndex((t) => t.id === trackId);
    if (from < 0) return false;
    const clamped = Math.max(0, Math.min(tracks.length - 1, toIndex));
    if (from === clamped) return false;
    const [item] = tracks.splice(from, 1);
    tracks.splice(clamped, 0, item);
    this.state.tracks = tracks;
    this.pushHistory({ type: "reorderTrack", id: trackId, to: clamped });
    this.emit();
    this.save();
    return true;
  }

  /**
   * Split at playhead — selected clip(s) only.
   * When clips are selected, only those under the playhead are cut
   * (clips above/below on other tracks are untouched). With no
   * selection, falls back to splitting every clip under the playhead.
   * Returns the number of clips split (0 = nothing to split).
   */
  splitAtPlayhead(time) {
    const t = Number(time) || 0;
    const sel = this.selectedClipIdList();
    const scope = sel.length ? new Set(sel) : null;
    if (scope) {
      const hit = sel.some((id) => {
        const c = this.getClip(id);
        return c && t > c.start + 0.05 && t < c.start + c.duration - 0.05;
      });
      if (!hit) {
        this._lastSplitReason = "Playhead is not inside the selected clip";
        return 0;
      }
      // Detached audio lives in its own clip: cutting the video must cut
      // the linked audio at the same frame (Filmora behaviour).
      for (const id of [...scope]) {
        const c = this.getClip(id);
        if (c?.linkedAudioId && this.getClip(c.linkedAudioId)) scope.add(c.linkedAudioId);
        if (c?.linkedFromId && this.getClip(c.linkedFromId)) scope.add(c.linkedFromId);
      }
    }
    this.pushUndo(scope && scope.size > 1 ? `Split ${scope.size} clips` : "Split clip");
    let count = 0;
    const next = [];
    for (const c of this.state.clips) {
      const end = c.start + c.duration;
      if ((scope && !scope.has(c.id)) || !(t > c.start + 0.05 && t < end - 0.05)) {
        next.push(c);
        continue;
      }
      // The right half continues the source where the left half ends:
      // its source offset advances by the length of the left half, so both
      // halves no longer restart from the same frame.
      const cutLen = t - c.start;
      const baseOffset = Math.max(0, Number(c.offset) || 0);
      const left = { ...c, duration: cutLen };
      const right = {
        ...c,
        id: this.uid("clip"),
        start: t,
        duration: end - t,
        offset: baseOffset + cutLen,
        name: c.name + " (B)",
        fx: { ...c.fx },
      };
      next.push(left, right);
      count++;
    }
    if (count) {
      this.state.clips = next;
      // Keep selection on the left halves of what was split
      if (scope) {
        const leftIds = [];
        for (let i = 0; i < next.length; i++) {
          const c = next[i];
          if (scope.has(c.id)) leftIds.push(c.id);
        }
        this.setSelectedClips(leftIds, { silent: true });
      }
      this.pushHistory({ type: "split", time: t, count });
      this.emit();
      this.save();
    }
    return count;
  }

  getClip(id) {
    return this.state.clips.find((c) => c.id === id) || null;
  }

  clipsOnTrack(trackId) {
    return this.state.clips
      .filter((c) => c.trackId === trackId)
      .sort((a, b) => a.start - b.start);
  }

  sequenceDuration() {
    if (!this.state.clips.length) return Math.max(this.state.duration || 0, 0);
    return Math.max(
      ...this.state.clips.map((c) => c.start + c.duration),
      this.state.duration || 0
    );
  }

  snapshot(label) {
    this.pushHistory({ type: "snapshot", label, ts: Date.now() });
    this.save();
  }

  addMedia(media) {
    const m = {
      id: this.uid("media"),
      name: "Media",
      kind: "video",
      duration: 5,
      color: "#3d6fd4",
      generated: false,
      thumb: null,
      ...media,
    };
    this.state.media = [...this.state.media, m];
    this.emit();
    this.save();
    return m;
  }

  /** Selection helpers for the media bin (single + multi). */
  setSelectedMedia(ids, { silent = false } = {}) {
    const list = [...new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean))];
    const patch = {
      selectedMediaIds: list,
      selectedMediaId: list.length ? list[list.length - 1] : null,
    };
    this.state = { ...this.state, ...patch };
    if (!silent) this.emit();
  }

  toggleSelectedMedia(id) {
    const cur = new Set(this.state.selectedMediaIds || []);
    if (cur.has(id)) cur.delete(id);
    else cur.add(id);
    this.setSelectedMedia([...cur]);
  }

  clearSelectedMedia({ silent = false } = {}) {
    this.setSelectedMedia([], { silent });
  }

  /** Delete one media item + any timeline clips that use it. Returns info. */
  removeMedia(id) {
    return this.removeMedias([id]);
  }

  /** Delete several media items + dependent clips. Undoable. */
  removeMedias(ids) {
    const list = [...new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean))];
    if (!list.length) return { ok: false, reason: "Nothing selected" };
    const existing = new Set((this.state.media || []).map((m) => m.id));
    const targets = list.filter((id) => existing.has(id));
    if (!targets.length) return { ok: false, reason: "Media not found" };
    this.pushUndo(targets.length > 1 ? `Delete ${targets.length} media` : "Delete media");
    const targetSet = new Set(targets);
    const removedMedia = (this.state.media || []).filter((m) => targetSet.has(m.id));
    const removedClips = (this.state.clips || []).filter((c) => c.mediaId && targetSet.has(c.mediaId));
    this.state.media = (this.state.media || []).filter((m) => !targetSet.has(m.id));
    if (removedClips.length) {
      const clipIds = new Set(removedClips.map((c) => c.id));
      this.state.clips = (this.state.clips || []).filter((c) => !clipIds.has(c.id));
    }
    if (this.state.selectedMediaId && targetSet.has(this.state.selectedMediaId)) {
      this.state.selectedMediaId = null;
    }
    this.state.selectedMediaIds = (this.state.selectedMediaIds || []).filter(
      (id) => !targetSet.has(id)
    );
    if (this.state.selectedClipId && removedClips.some((c) => c.id === this.state.selectedClipId)) {
      this.state.selectedClipId = null;
    }
    this.pushHistory({ type: "removeMedia", ids: targets, clips: removedClips.length });
    // NOTE: do NOT revoke blob: URLs or drop IndexedDB bytes here — Undo
    // must be able to restore the exact same media objects. Orphan bytes
    // are tiny vs. the cost of a broken Undo; IDB is purged on Reset.
    try {
      window.dispatchEvent(new CustomEvent("aifimora:media-removed", { detail: { ids: targets } }));
    } catch { /* ignore */ }
    this.emit();
    this.save();
    return { ok: true, removed: removedMedia, removedClips: removedClips.length };
  }

  addJob(job) {
    const j = {
      id: this.uid("job"),
      status: "running",
      progress: 0,
      createdAt: Date.now(),
      ...job,
    };
    this.state.jobs = [...this.state.jobs, j];
    this.emit();
    return j;
  }

  updateJob(id, patch) {
    this.state.jobs = this.state.jobs.map((j) => (j.id === id ? { ...j, ...patch } : j));
    this.emit();
    if (patch.status === "done" || patch.status === "fail") this.save();
  }

  mateSay(role, text, actions) {
    const msg = { role, text, ts: Date.now(), actions: actions || null };
    this.state.mateLog = [...this.state.mateLog, msg].slice(-80);
    this.emit();
    this.save();
  }
}

function sanitizeClip(c) {
  if (!c || typeof c !== "object") return null;
  return {
    ...c,
    id: c.id || `clip_${Math.random().toString(36).slice(2, 9)}`,
    type: c.type || "video",
    trackId: c.trackId || "v1",
    start: Math.max(0, Number(c.start) || 0),
    duration: Math.max(0.1, Number(c.duration) || 4),
    offset: Math.max(0, Number(c.offset) || 0),
    name: typeof c.name === "string" ? c.name : "Clip",
    fx: { ...DEFAULT_FX, ...(c.fx || {}), crop: { x: 0, y: 0, w: 1, h: 1, ...(c.fx?.crop || {}) } },
    shape: c.shape || null,
    motion: c.motion || null,
    speed: Math.min(8, Math.max(0.25, Number(c.speed) || 1)),
    volume: Math.min(500, Math.max(0, Number(c.volume ?? 100))),
    fadeIn: Math.max(0, Number(c.fadeIn) || 0),
    fadeOut: Math.max(0, Number(c.fadeOut) || 0),
    audioMuted: !!c.audioMuted,
    audioDetached: !!c.audioDetached,
    linkedAudioId: c.linkedAudioId || null,
    linkedFromId: c.linkedFromId || null,
  };
}

function sanitizeProject(data) {
  const base = DEFAULT_PROJECT();
  const merged = { ...base, ...data };
  merged.credits = {
    used: Math.max(0, Number(data.credits?.used) || 0),
    cap: Math.max(0, Number(data.credits?.cap) || base.credits.cap),
  };
  if (merged.credits.used > merged.credits.cap) merged.credits.used = merged.credits.cap;
  merged.tracks = Array.isArray(data.tracks) && data.tracks.length ? data.tracks : base.tracks;
  merged.clips = (Array.isArray(data.clips) ? data.clips : [])
    .map(sanitizeClip)
    .filter(Boolean);
  merged.media = Array.isArray(data.media)
    ? data.media
        .filter((m) => m && typeof m === "object")
        .map((m) => ({
          id: m.id || `media_${Math.random().toString(36).slice(2, 9)}`,
          name: typeof m.name === "string" ? m.name : "Media",
          kind: m.kind || "video",
          duration: Math.max(0.1, Number(m.duration) || 4),
          color: m.color || "#3d6fd4",
          generated: !!m.generated,
          synthetic: !!m.synthetic || (!m.url && !m.fileType && !m.generated),
          thumb: m.thumb || null,
          url: typeof m.url === "string" ? m.url : null,
          fileType: m.fileType || null,
          fileSize: Number(m.fileSize) || 0,
          seed: m.seed ?? null,
          model: m.model || null,
          prompt: m.prompt || null,
          // blob: URLs can't survive reload — flag for IDB re-hydration
          _offline: m.url && String(m.url).startsWith("idb:") ? true : !!m._offline,
        }))
    : [];
  merged.jobs = (Array.isArray(data.jobs) ? data.jobs : []).map((j) =>
    j && j.status === "running"
      ? { ...j, status: "fail", progress: j.progress || 0, detail: "Interrupted by reload" }
      : j
  );
  merged.mateLog = Array.isArray(data.mateLog) && data.mateLog.length ? data.mateLog : base.mateLog;
  merged.captions = Array.isArray(data.captions) ? data.captions : [];
  merged.markers = Array.isArray(data.markers) ? data.markers : [];
  merged.chapters = Array.isArray(data.chapters)
    ? data.chapters.filter((c) => c && Number.isFinite(Number(c.t))).map((c) => ({ t: Number(c.t) || 0, name: String(c.name || "Chapter") }))
    : [];
  merged.voiceClones = Array.isArray(data.voiceClones) ? data.voiceClones : [];
  merged.subprojects = Array.isArray(data.subprojects) ? data.subprojects : [];
  merged.history = Array.isArray(data.history) ? data.history.slice(-100) : [];
  merged.transcript = Array.isArray(data.transcript) ? data.transcript : null;
  if (
    merged.selectedClipId &&
    !merged.clips.some((c) => c.id === merged.selectedClipId)
  ) {
    merged.selectedClipId = null;
  }
  merged.selectedClipIds = Array.isArray(data.selectedClipIds)
    ? data.selectedClipIds.filter((id) => merged.clips.some((c) => c.id === id))
    : merged.selectedClipId
      ? [merged.selectedClipId]
      : [];
  if (
    merged.selectedMediaId &&
    !merged.media.some((m) => m.id === merged.selectedMediaId)
  ) {
    merged.selectedMediaId = null;
  }
  merged.selectedMediaIds = Array.isArray(data.selectedMediaIds)
    ? data.selectedMediaIds.filter((id) => merged.media.some((m) => m.id === id))
    : merged.selectedMediaId
      ? [merged.selectedMediaId]
      : [];
  return merged;
}

export const store = new Store();
export { DEFAULT_FX, DEFAULT_TEXT_STYLE };
