/* Verify media-bin delete + marquee + real playback wiring */
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
        ".js": "text/javascript",
        ".css": "text/css",
        ".html": "text/html",
        ".json": "application/json",
        ".png": "image/png",
        ".svg": "image/svg+xml",
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

  ok("store booted", await page.evaluate(() => !!window.__aifimoraStore));
  ok("removeMedias API", await page.evaluate(() => typeof window.__aifimoraStore.removeMedias === "function"));
  ok("setSelectedMedia API", await page.evaluate(() => typeof window.__aifimoraStore.setSelectedMedia === "function"));
  ok("media toolbar", await page.evaluate(() => !!document.querySelector("#mediaDeleteSel")));
  ok("select-all checkbox", await page.evaluate(() => !!document.querySelector("#mediaSelectAll")));
  ok("per-card checkbox", await page.evaluate(() => document.querySelectorAll(".media-check input").length > 0));
  ok("per-card delete btn", await page.evaluate(() => document.querySelectorAll(".media-del").length > 0));
  ok("marquee wrap", await page.evaluate(() => !!document.querySelector(".media-select-wrap")));
  ok("marquee rect hidden", await page.evaluate(() => !!document.querySelector(".media-marquee")));

  // Checkbox multi-select selects 2 items
  const multi = await page.evaluate(() => {
    const s = window.__aifimoraStore;
    const ids = s.get().media.slice(0, 2).map((m) => m.id);
    s.setSelectedMedia(ids);
    return s.get().selectedMediaIds;
  });
  ok("checkbox/multi select 2", Array.isArray(multi) && multi.length === 2, JSON.stringify(multi));

  // Delete selected media (stub confirm) removes items
  const del = await page.evaluate(() => {
    const s = window.__aifimoraStore;
    const before = s.get().media.length;
    window.confirm = () => true;
    const ids = s.get().media.slice(0, 1).map((m) => m.id);
    s.setSelectedMedia(ids);
    const res = s.removeMedias(ids);
    const after = s.get().media.length;
    return { before, after, ok: res.ok, removed: res.removed?.length };
  });
  ok("delete media removes item", del.ok && del.after === del.before - 1, JSON.stringify(del));

  // Undo restores
  const undo = await page.evaluate(() => {
    const s = window.__aifimoraStore;
    const before = s.get().media.length;
    s.undo();
    return { before, after: s.get().media.length };
  });
  ok("undo restores media", undo.after === undo.before + 1, JSON.stringify(undo));

  // Real playback wiring present
  const src = fs.readFileSync(path.join(process.cwd(), "js", "player.js"), "utf8");
  ok("player has video element cache", src.includes("videoElCache") && src.includes("getVideoEl"));
  ok("player draws video frames", src.includes("drawVideoFrame"));
  ok("player syncs media clocks", src.includes("syncMediaElements"));
  const msrc = fs.readFileSync(path.join(process.cwd(), "js", "media.js"), "utf8");
  ok("media persists to IndexedDB", msrc.includes("aifilmora-media-db") && msrc.includes("restoreMediaUrls"));
  ok("marquee select code", msrc.includes("media-marquee") && msrc.includes("marquee-hit"));

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  if (errors.length) console.log("page errors:\n" + errors.slice(0, 8).join("\n"));
  await browser.close();
  server.close();
  process.exit(failed.length || errors.length > 5 ? 1 : 0);
})();
