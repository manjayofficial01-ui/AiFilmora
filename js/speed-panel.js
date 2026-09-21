/* Speed panel — Filmora-style uniform speed, ripple, freeze */
import { store } from "./state.js";
import { toast } from "./media.js";

function selected() {
  const id = store.get().selectedClipId;
  return id ? store.getClip(id) : null;
}

function setVal(id, v) {
  const el = document.getElementById(id);
  if (!el) return;
  el.value = String(v);
}

function fmtSpeed(s) {
  return Number(s).toFixed(2) + "×";
}

function syncSpeedUI() {
  const clip = selected();
  const label = document.getElementById("speedClipLabel");
  const speed = clip?.speed || 1;
  setVal("clipSpeed", Math.round(speed * 100));
  const out = document.getElementById("clipSpeedOut");
  if (out) out.textContent = fmtSpeed(speed);
  const hint = document.getElementById("speedHint");
  if (label) {
    if (!clip) label.textContent = "No clip selected";
    else if (clip.type === "text") label.textContent = `${clip.name} — text clips have no speed`;
    else {
      let t = `${clip.name} · ${clip.duration.toFixed(2)}s · ${fmtSpeed(speed)}`;
      if (clip.reversed) t += " · reversed";
      if (clip.freeze) t += " · freeze";
      label.textContent = t;
    }
  }
  if (hint && clip) {
    hint.textContent =
      clip.type === "text"
        ? "Select a video or audio clip."
        : `Timeline length follows rate${document.getElementById("speedRipple")?.checked ? " · ripple on" : ""}.`;
  }
  const freezeOut = document.getElementById("freezeDurOut");
  const freezeEl = document.getElementById("freezeDur");
  if (freezeOut && freezeEl) freezeOut.textContent = Number(freezeEl.value).toFixed(1) + "s";
  const rev = document.getElementById("speedReverse");
  if (rev) rev.checked = !!clip?.reversed;

  const can = clip && clip.type !== "text";
  document.getElementById("btnFreezeFrame")?.toggleAttribute?.("disabled", !can && clip != null);
}

function applySpeed(val) {
  const clip = selected();
  if (!clip) return toast("Select a clip first");
  if (clip.type === "text") return toast("Text clips have no speed", "err");
  const ripple = !!document.getElementById("speedRipple")?.checked;
  const muteFast = !!document.getElementById("speedMuteOnFast")?.checked;
  const ok = store.setClipSpeed(clip.id, val, { ripple, muteWhenNot1x: muteFast });
  if (ok) toast(`Speed ${fmtSpeed(val)}${ripple ? " · rippled" : ""}`, "ok");
  syncSpeedUI();
  window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
}

export function initSpeedPanel() {
  const speedEl = document.getElementById("clipSpeed");
  speedEl?.addEventListener("input", () => {
    const out = document.getElementById("clipSpeedOut");
    if (out) out.textContent = fmtSpeed(Number(speedEl.value) / 100);
  });
  speedEl?.addEventListener("change", () => {
    applySpeed(Number(speedEl.value) / 100);
  });

  document.querySelectorAll("[data-speed]").forEach((btn) => {
    btn.addEventListener("click", () => applySpeed(Number(btn.dataset.speed)));
  });

  document.getElementById("btnSpeedReset")?.addEventListener("click", () => {
    const clip = selected();
    if (clip?.reversed) store.reverseClip(clip.id);
    const rev = document.getElementById("speedReverse");
    if (rev) rev.checked = false;
    applySpeed(1);
  });

  document.getElementById("speedReverse")?.addEventListener("change", (e) => {
    const clip = selected();
    if (!clip || clip.type === "text") return toast("Select a video clip");
    store.reverseClip(clip.id);
    toast(e.target.checked || clip.reversed ? "Reverse toggled" : "Forward", "ok");
    syncSpeedUI();
    window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
  });

  document.getElementById("freezeDur")?.addEventListener("input", () => {
    const out = document.getElementById("freezeDurOut");
    if (out) out.textContent = Number(document.getElementById("freezeDur").value).toFixed(1) + "s";
  });

  document.getElementById("btnFreezeFrame")?.addEventListener("click", () => {
    const clip = selected();
    if (!clip) return toast("Select a video clip first");
    if (clip.type === "text" || clip.type === "audio") return toast("Freeze needs a video clip", "err");
    const hold = Number(document.getElementById("freezeDur")?.value || 5);
    const t = window.__aifimoraPlayhead || 0;
    const res = store.freezeFrame(clip.id, hold, t);
    if (!res.ok) {
      toast(res.reason, "err");
      return;
    }
    toast(`Freeze frame ${hold.toFixed(1)}s inserted`, "ok");
    store.set({ selectedClipId: res.id });
    syncSpeedUI();
    window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
  });

  // Timeline toolbar audio (next to Snap)
  document.getElementById("btnDetachAudio")?.addEventListener("click", () => {
    const clip = selected();
    if (!clip) return toast("Select a video clip first");
    const res = store.detachAudio(clip.id);
    if (!res.ok) return toast(res.reason, "err");
    toast("Audio detached to A1", "ok");
    window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
    syncSpeedUI();
  });

  document.getElementById("btnMuteClip")?.addEventListener("click", () => {
    const clip = selected();
    if (!clip || clip.type === "text") return toast("Select a clip to mute");
    if (store.isDetachSilent(clip)) {
      const link = clip.linkedAudioId && store.getClip(clip.linkedAudioId);
      if (link) {
        store.setSelectedClips([link.id]);
        syncSpeedUI();
        return toast("Video has no audio since detach — detached clip selected", "ok");
      }
    }
    const next = !clip.audioMuted;
    store.setClipMuted(clip.id, next);
    const btn = document.getElementById("btnMuteClip");
    if (btn) {
      btn.setAttribute("aria-pressed", next ? "true" : "false");
      btn.textContent = next ? "Unmute Clip" : "Mute Clip";
    }
    toast(next ? "Muted" : "Unmuted", "ok");
  });

  // Filmora speed ramp presets — set base rate + store a curve on the clip
  const RAMPS = {
    montage: { speed: 2, label: "Montage", curve: [1, 2.5, 1.5, 3, 1] },
    hero: { speed: 0.5, label: "Hero Moment", curve: [1, 0.35, 0.35, 1] },
    bullet: { speed: 0.25, label: "Bullet Time", curve: [0.25, 0.25, 1, 0.25] },
    jumper: { speed: 1.5, label: "Jumper", curve: [1, 3, 0.6, 2] },
    flashIn: { speed: 4, label: "Flash In", curve: [8, 2, 1, 1] },
    flashOut: { speed: 1, label: "Flash Out", curve: [1, 1, 2, 8] },
  };

  document.querySelectorAll("[data-ramp]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const clip = selected();
      if (!clip || clip.type === "text") return toast("Select a video clip first", "err");
      const ramp = RAMPS[btn.dataset.ramp];
      if (!ramp) return;
      const ripple = !!document.getElementById("speedRipple")?.checked;
      store.pushUndo(`Speed ramp ${ramp.label}`);
      store.setClipSpeed(clip.id, ramp.speed, { ripple });
      store.updateClip(clip.id, {
        speedRamp: {
          name: ramp.label,
          peak: Math.max(...ramp.curve),
          curve: ramp.curve,
          maintainPitch: !!document.getElementById("speedPitch")?.checked,
        },
      });
      toast(`${ramp.label} ramp · base ${ramp.speed}×`, "ok");
      const hint = document.getElementById("rampHint");
      if (hint) hint.textContent = `Applied “${ramp.label}” — curve ${ramp.curve.join(" → ")}×. Adjust base rate above.`;
      syncSpeedUI();
      window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
    });
  });

  store.subscribe(() => {
    const clip = selected();
    const btn = document.getElementById("btnMuteClip");
    if (btn && clip) {
      const muted = !!clip.audioMuted;
      btn.setAttribute("aria-pressed", muted ? "true" : "false");
      btn.textContent = muted ? "Unmute Clip" : "Mute Clip";
    }
    syncSpeedUI();
  });
  syncSpeedUI();
}
