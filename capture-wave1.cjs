/* capture-wave1.cjs — render the upgraded timeline with REAL filmstrip frames
 * and a REAL decoded waveform, for visual QA evidence.
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const OUT = path.resolve(path.join(process.cwd(), "research", "editroom-benchmark", "shots-wave1"));
const URL = "http://127.0.0.1:8765/index.html";

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGE: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /demo cut/i.test(x.textContent || ""));
    if (b) b.click();
  });
  await page.waitForTimeout(1500);

  // Build real media in the page: a canvas-captured WebM and a WAV tone.
  await page.evaluate(async () => {
    const s = window.__aifimoraStore;
    const canvas = document.createElement("canvas");
    canvas.width = 320; canvas.height = 180;
    const ctx = canvas.getContext("2d");
    const stream = canvas.captureStream(25);
    const rec = new MediaRecorder(stream);
    const chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.start();
    let f = 0;
    const paint = () => {
      f++;
      const g = ctx.createLinearGradient(0, 0, 320, 180);
      g.addColorStop(0, `hsl(${(f * 6) % 360} 65% 42%)`);
      g.addColorStop(1, `hsl(${(f * 6 + 60) % 360} 60% 22%)`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, 320, 180);
      ctx.fillStyle = "rgba(255,255,255,.85)";
      ctx.beginPath(); ctx.arc(40 + (f % 60) * 4, 100, 26, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(0, 140, 320, 40);
      if (f < 90) requestAnimationFrame(paint);
    };
    paint();
    await new Promise((r) => setTimeout(r, 3800));
    const blob = await new Promise((r) => { rec.onstop = () => r(new Blob(chunks, { type: "video/webm" })); rec.stop(); });
    const url = URL.createObjectURL(blob);

    const sr = 48000, n = sr * 3;
    const buf = new ArrayBuffer(44 + n * 2);
    const dv = new DataView(buf);
    const wr = (o, str) => { for (let i = 0; i < str.length; i++) dv.setUint8(o + i, str.charCodeAt(i)); };
    wr(0, "RIFF"); dv.setUint32(4, 36 + n * 2, true); wr(8, "WAVEfmt ");
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, sr, true); dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true);
    dv.setUint16(34, 16, true); wr(36, "data"); dv.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) {
      const env = 0.25 + 0.75 * Math.abs(Math.sin(i / 9000));
      const v = Math.round(Math.sin((2 * Math.PI * 220 * i) / sr) * env * 26000);
      dv.setInt16(44 + i * 2, v, true);
    }
    const wavUrl = URL.createObjectURL(new Blob([buf], { type: "audio/wav" }));

    const vTrack = s.get().tracks.find((t) => t.kind === "video");
    const aTrack = s.get().tracks.find((t) => t.kind === "audio");
    const vTrack2 = s.get().tracks.filter((t) => t.kind === "video")[1] || vTrack;

    s.set({
      media: [
        { id: "w1-vid", name: "beach-day.webm", kind: "video", duration: 3, url, thumb: null, generated: false },
        { id: "w1-vid2", name: "sunset.webm", kind: "video", duration: 3, url, thumb: null, generated: false },
        { id: "w1-aud", name: "voice.wav", kind: "audio", duration: 3, url: wavUrl, thumb: null, generated: false },
      ],
    });
    s.set({ clips: [
      { id: "w1-c1", type: "video", trackId: vTrack.id, mediaId: "w1-vid", start: 0, duration: 3, name: "beach-day.webm", volume: 100 },
      { id: "w1-c2", type: "video", trackId: vTrack.id, mediaId: "w1-vid2", start: 3.1, duration: 2.6, name: "sunset.webm", volume: 100 },
      { id: "w1-c3", type: "audio", trackId: aTrack.id, mediaId: "w1-aud", start: 0, duration: 3, name: "voice.wav", volume: 100 },
      { id: "w1-c4", type: "audio", trackId: aTrack.id, mediaId: "w1-aud", start: 3.1, duration: 2.6, name: "voice.wav", volume: 100 },
    ] });
    s.set({ markers: [{ id: "mk-1", t: 1.4, end: null, name: "cake thrown", color: "accent" }] });
    window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
  });

  await page.waitForTimeout(6000);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty")));
  await page.waitForTimeout(4000);

  await page.screenshot({ path: path.join(OUT, "wave1-full.png"), fullPage: true });
  console.log("shot: wave1-full");

  const tl = await page.$("#timelinePanel, .timeline-panel");
  if (tl) {
    await tl.screenshot({ path: path.join(OUT, "wave1-timeline.png") });
    console.log("shot: wave1-timeline");
  }

  const stats = await page.evaluate(() => {
    const strip = document.querySelector(".tl-strip");
    const wave = document.querySelector(".tl-wave path");
    const flag = document.querySelector(".tl-marker-flag");
    return {
      frames: strip ? strip.querySelectorAll("img").length : 0,
      waveLen: wave ? (wave.getAttribute("d") || "").length : 0,
      flag: flag ? flag.textContent.trim() : null,
      flagLeft: flag ? flag.style.left : null,
    };
  });
  console.log("stats:", JSON.stringify(stats));
  console.log("errors:", errors.length);
  errors.slice(0, 10).forEach((e) => console.log("  " + e));
  await browser.close();
})();
