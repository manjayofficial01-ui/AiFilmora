/* Verify 500% timeline volume + selected-only split */
const { chromium } = require("playwright");
const path = require("path");
const http = require("http");
const fs = require("fs");

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = path.join(process.cwd(), decodeURIComponent(req.url.split("?")[0]));
      if (p.endsWith("/") || p.endsWith("\\")) p = path.join(p, "index.html");
      const ext = path.extname(p);
      const types = {
        ".js": "text/javascript", ".css": "text/css", ".html": "text/html",
        ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
      };
      fs.readFile(p, (e, d) => {
        if (e) { res.writeHead(404); res.end("404"); return; }
        res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
        res.end(d);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

(async () => {
  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGE: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  const checks = [];
  const ok = (name, pass, extra = "") => {
    checks.push({ name, pass });
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  };

  // ---- Volume caps ----
  const caps = await page.evaluate(() => {
    const s = window.__aifimoraStore;
    const audio = s.get().clips.find((c) => c.type === "audio");
    s.setClipVolume(audio.id, 900);
    const capped = s.getClip(audio.id).volume;
    s.setClipVolume(audio.id, 100);
    const up = s.nudgeClipVolume(audio.id, 10);
    const down = s.nudgeClipVolume(audio.id, -1000);
    const text = s.get().clips.find((c) => c.type === "text");
    return { capped, up, down, textNudge: text ? s.nudgeClipVolume(text.id, 10) : "no-text-clip" };
  });
  ok("volume caps at 500", caps.capped === 500, JSON.stringify(caps.capped));
  ok("nudge +10 steps", caps.up === 110, JSON.stringify(caps.up));
  ok("nudge clamps at 0", caps.down === 0, JSON.stringify(caps.down));

  ok("panel slider max 500", await page.evaluate(() => document.getElementById("clipVolume")?.max === "500"));
  ok("panel 500% preset", await page.evaluate(() => !!document.querySelector('[data-vol="500"]')));
  ok("timeline vol badge", await page.evaluate(() => document.querySelectorAll(".tl-clip .tl-vol").length > 0));

  // Click + on an audio clip badge
  const stepped = await page.evaluate(() => {
    const s = window.__aifimoraStore;
    const audio = s.get().clips.find((c) => c.type === "audio");
    s.updateClip(audio.id, { volume: 100 });
    return audio.id;
  });
  await page.locator(`.tl-clip[data-clip-id="${stepped}"]`).hover({ force: true });
  await page.waitForTimeout(150);
  await page.locator(`.tl-clip[data-clip-id="${stepped}"] .tl-vol button[data-vol-act="up"]`).click();
  await page.waitForTimeout(250);
  const afterStep = await page.evaluate((id) => window.__aifimoraStore.getClip(id)?.volume, stepped);
  ok("badge + raises volume", afterStep === 110, JSON.stringify(afterStep));

  // Boost gain pipeline present
  const psrc = fs.readFileSync(path.join(process.cwd(), "js", "player.js"), "utf8");
  ok("gain-node boost pipeline", psrc.includes("createMediaElementSource") && psrc.includes("applyElementLevel"));
  ok("5x cap in player", psrc.includes("Math.min(5,"));

  // ---- Selected-only split ----
  const split = await page.evaluate(() => {
    const s = window.__aifimoraStore;
    // Two stacked clips covering t=2 on different tracks
    const media = s.get().media;
    const vm = media.find((m) => m.kind === "video");
    const am = media.find((m) => m.kind === "audio");
    s.pushUndo("test setup");
    const demoCount = s.get().clips.length;
    const v = s.addClip({ mediaId: vm.id, name: "SPLIT-V", type: "video", trackId: "v1", start: 0, duration: 8 });
    const a = s.addClip({ mediaId: am.id, name: "SPLIT-A", type: "audio", trackId: "a1", start: 0, duration: 8 });
    const before = s.get().clips.length;
    s.setSelectedClips([v.id]);
    const n = s.splitAtPlayhead(2);
    const afterSel = s.get().clips.length;
    const vKids = s.get().clips.filter((c) => c.name.startsWith("SPLIT-V")).length;
    const aKids = s.get().clips.filter((c) => c.name.startsWith("SPLIT-A")).length;
    // Cleanup test clips
    const ids = s.get().clips.filter((c) => c.name.startsWith("SPLIT-")).map((c) => c.id);
    s.removeClips(ids);
    return { before, demoCount, n, afterSel, vKids, aKids, restored: s.get().clips.length };
  });
  ok("split returns count", split.n === 1, JSON.stringify(split.n));
  ok("only selected clip split", split.vKids === 2 && split.aKids === 1, JSON.stringify({ v: split.vKids, a: split.aKids }));
  ok("test clips cleaned", split.restored === split.demoCount, `${split.restored} vs ${split.demoCount}`);

  // No selection -> splits all under playhead (legacy fallback)
  const fallback = await page.evaluate(() => {
    const s = window.__aifimoraStore;
    const media = s.get().media;
    const vm = media.find((m) => m.kind === "video");
    const v1 = s.addClip({ mediaId: vm.id, name: "FB-V", type: "video", trackId: "v1", start: 40, duration: 8 });
    const v2 = s.addClip({ mediaId: vm.id, name: "FB-V2", type: "video", trackId: "v2", start: 40, duration: 8 });
    s.clearSelectedClips();
    const n = s.splitAtPlayhead(42);
    const ids = s.get().clips.filter((c) => c.name.startsWith("FB-")).map((c) => c.id);
    s.removeClips(ids);
    return n;
  });
  ok("no selection splits all", fallback === 2, JSON.stringify(fallback));

  // Playhead outside selection -> no split + reason
  const miss = await page.evaluate(() => {
    const s = window.__aifimoraStore;
    const v = s.get().clips.find((c) => c.type === "video");
    s.setSelectedClips([v.id]);
    const n = s.splitAtPlayhead(v.start + v.duration + 50);
    return { n, reason: s._lastSplitReason || "" };
  });
  ok("split outside selection blocked", miss.n === 0 && /selected/.test(miss.reason), JSON.stringify(miss));

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  if (errors.length) console.log("page errors:\n" + errors.slice(0, 8).join("\n"));
  await browser.close();
  server.close();
  process.exit(failed.length || errors.length > 5 ? 1 : 0);
})();
