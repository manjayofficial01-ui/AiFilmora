/* Text-based editing — transcript paper edit */
import { store, DEFAULT_FX } from "./state.js";
import { toast } from "./media.js";

const SAMPLE_TRANSCRIPT = [
  { id: "s1", start: 0.0, end: 2.4, speaker: "Host", text: "Welcome back to the channel." },
  { id: "s2", start: 2.5, end: 6.8, speaker: "Host", text: "Today we're cutting a travel short entirely with AI." },
  { id: "s3", start: 6.9, end: 8.1, speaker: "Host", text: "Um, so, uh, first..." },
  { id: "s4", start: 8.2, end: 12.5, speaker: "Host", text: "First, tighten the audio and drop the filler words." },
  { id: "s5", start: 12.6, end: 17.9, speaker: "Host", text: "Next, generate two B-roll shots to cover the jump cuts." },
  { id: "s6", start: 18.0, end: 22.2, speaker: "Host", text: "Like you know, it's kind of important to match the cut points." },
  { id: "s7", start: 22.3, end: 27.0, speaker: "Host", text: "Finally, reframe for vertical and export." },
  { id: "s8", start: 27.1, end: 30.5, speaker: "Host", text: "Let's open the timeline and make it real." },
];

const FILLERS = /\b(um+|uh+|like|you know|kind of|sort of|basically|actually)\b/gi;

export function initTextEdit() {
  const btn = document.getElementById("btnTranscribe");
  const btnFillers = document.getElementById("btnRemoveFillers");
  const btnPaper = document.getElementById("btnPaperEdit");
  const btnCutSel = document.getElementById("btnCutSelected");

  btn?.addEventListener("click", () => transcribe());
  btnFillers?.addEventListener("click", () => removeFillers());
  btnPaper?.addEventListener("click", () => paperEdit());
  btnCutSel?.addEventListener("click", () => cutSelected());

  window.addEventListener("aifimora:open-text-edit", () => {
    document.querySelector('[data-inspector="text"]')?.click();
    if (!store.get().transcript) transcribe();
  });

  store.subscribe(() => renderTranscript());
  renderTranscript();
}

function transcribe() {
  const s = store.get();
  const hasAudio = s.clips.some((c) => c.type === "audio" || c.type === "video");
  if (!hasAudio) {
    toast("Add clips with audio before transcribing", "err");
    return;
  }

  const job = store.addJob({
    title: "faster-whisper · large-v2",
    detail: "Local ASR simulation · word timestamps + Silero VAD",
    progress: 0,
  });

  let p = 0;
  const timer = setInterval(() => {
    p += 14;
    if (p >= 100) {
      clearInterval(timer);
      const transcript = SAMPLE_TRANSCRIPT.map((seg) => ({
        ...seg,
        selected: false,
        fillers: extractFillers(seg.text),
      }));
      store.set({ transcript });
      store.updateJob(job.id, { progress: 100, status: "done", detail: "8 segments · 3 filler hits" });
      toast("Transcript ready", "ok");
      store.mateSay?.("sys", "Transcript ready — select words to cut, or remove all fillers.");
      return;
    }
    store.updateJob(job.id, { progress: p });
  }, 120);
}

function extractFillers(text) {
  const hits = [];
  let m;
  const re = new RegExp(FILLERS.source, "gi");
  while ((m = re.exec(text))) hits.push(m[0].toLowerCase());
  return hits;
}

function renderTranscript() {
  const root = document.getElementById("transcriptList");
  if (!root) return;
  const tr = store.get().transcript;
  if (!tr) {
    root.innerHTML = `<div class="empty">Click <strong>Transcribe</strong> to run text-based editing (simulated faster-whisper).</div>`;
    return;
  }

  root.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "transcript";

  tr.forEach((seg) => {
    const line = document.createElement("div");
    line.className = "t-line" + (seg.selected ? " selected" : "");
    line.dataset.segId = seg.id;
    line.innerHTML = `
      <div class="t">${tc(seg.start)}</div>
      <div class="w">${highlight(seg.text, seg.fillers)}</div>
      <div class="meta">${seg.fillers?.length ? seg.fillers.length + " filler" : ""}</div>
    `;
    line.addEventListener("click", (e) => {
      if (e.target.closest("mark.filler")) {
        toggleFiller(seg.id, e.target.textContent);
        return;
      }
      toggleSelect(seg.id);
    });
    line.addEventListener("dblclick", () => {
      window.dispatchEvent(new CustomEvent("aifimora:seek", { detail: { time: seg.start } }));
    });
    wrap.appendChild(line);
  });

  root.appendChild(wrap);
}

function highlight(text, fillers) {
  if (!fillers?.length) return escape(text);
  let html = escape(text);
  fillers.forEach((f) => {
    const re = new RegExp(`\\b${escapeRe(f)}\\b`, "gi");
    html = html.replace(re, (m) => `<mark class="filler">${m}</mark>`);
  });
  return html;
}

function toggleSelect(id) {
  const tr = store.get().transcript.map((s) =>
    s.id === id ? { ...s, selected: !s.selected } : s
  );
  store.set({ transcript: tr });
}

function toggleFiller(segId, word) {
  const tr = store.get().transcript.map((s) => {
    if (s.id !== segId) return s;
    const re = new RegExp(`\\b${escapeRe(word)}\\b`, "i");
    const text = s.text.replace(re, "").replace(/\s{2,}/g, " ").trim();
    const fillers = extractFillers(text);
    return { ...s, text, fillers };
  });
  store.set({ transcript: tr });
  toast(`Removed “${word}”`);
}

function removeFillers() {
  const tr = store.get().transcript;
  if (!tr) return toast("Transcribe first");
  const res = store.spendCredits(4, "Remove fillers");
  if (!res.ok) return toast(res.reason, "err");
  let removed = 0;
  const next = tr.map((s) => {
    let text = s.text;
    const before = text;
    text = text.replace(FILLERS, "").replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").trim();
    if (text !== before) removed++;
    return { ...s, text, fillers: extractFillers(text) };
  });
  store.set({ transcript: next });
  store.mateSay?.("sys", `Removed filler words from ${removed} segment(s) (4 credits).`);
  toast(`Fillers stripped from ${removed} segments`, "ok");
}

function paperEdit() {
  const tr = store.get().transcript;
  if (!tr) return toast("Transcribe first");
  const selected = tr.filter((s) => s.selected);
  if (!selected.length) return toast("Select transcript lines first");

  const res = store.spendCredits(8, "Paper Edit");
  if (!res.ok) return toast(res.reason, "err");

  const clips = [];
  let cursor = 0;
  selected.forEach((seg) => {
    const dur = Math.max(0.6, seg.end - seg.start);
    clips.push({
      id: store.uid("clip"),
      mediaId: store.get().media.find((m) => m.kind === "video")?.id || null,
      name: `Paper · ${seg.text.slice(0, 18)}…`,
      type: "video",
      trackId: "v1",
      start: cursor,
      duration: dur,
      text: seg.text,
      fx: { ...DEFAULT_FX },
    });
    cursor += dur + 0.05;
  });

  const hadClips = store.get().clips.length > 0;
  store.set({ clips, transcript: tr.map((s) => ({ ...s, selected: false })) });
  store.pushHistory({ type: "paper-edit", count: selected.length });
  toast(
    hadClips
      ? `Paper edit replaced timeline — ${selected.length} lines`
      : `Paper edit applied — ${selected.length} lines`,
    "ok"
  );
  store.mateSay?.("sys", `Paper Edit built ${selected.length} clips from transcript selection.`);
  window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
}

function cutSelected() {
  // Lift selected transcript segments out of the paper-edit script
  const tr = store.get().transcript;
  if (!tr) return toast("Transcribe first");
  const selected = tr.filter((s) => s.selected);
  if (!selected.length) return toast("Select lines to cut");
  const next = tr.filter((s) => !s.selected);
  store.set({ transcript: next });
  store.pushHistory({ type: "cut-transcript", count: selected.length });
  toast(`Cut ${selected.length} line${selected.length === 1 ? "" : "s"} from transcript`, "ok");
  store.mateSay?.("sys", `Removed ${selected.length} selected transcript segment(s).`);
}

function tc(t) {
  const s = Math.floor(t);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function escape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
