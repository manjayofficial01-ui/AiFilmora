/* Round 5 — Filmora theme + working tools smoke test. */
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

function startServer() {
  return new Promise((resolve) => {
    const root = process.cwd();
    const types = {
      ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
      ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
    };
    const server = http.createServer((req, res) => {
      let p = path.join(root, decodeURIComponent(req.url.split("?")[0]));
      if (p.endsWith("/") || p.endsWith("\\")) p = path.join(p, "index.html");
      const ext = path.extname(p);
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGE: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !!window.__aifimoraStore, { timeout: 8000 });
  await page.waitForTimeout(400);

  const checks = [];
  const ok = (name, pass, extra = "") => {
    checks.push({ name, pass, extra });
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  };

  ok("store booted", await page.evaluate(() => !!window.__aifimoraStore));

  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
  ok("default accent is Filmora cyan", accent.toLowerCase() === "#55e5c5", accent);

  const exportBg = await page.evaluate(() => {
    const el = document.querySelector(".export-pill");
    return el ? getComputedStyle(el).backgroundImage || getComputedStyle(el).backgroundColor : "";
  });
  ok("Export pill uses cyan fill", /85,\s*229,\s*197|55e5c5|69,\s*243,\s*191|45f3bf|111,\s*240,\s*212/i.test(exportBg), exportBg.slice(0, 80));

  if (await page.evaluate(() => document.getElementById("firstRunModal")?.classList.contains("open"))) {
    ok("first-run aspect chips", await page.locator("[data-fr-aspect]").count() >= 4);
    await page.click("#frDemo");
    await page.waitForTimeout(300);
  } else {
    ok("first-run already dismissed", true);
  }

  ok("undo starts disabled", await page.evaluate(() => document.getElementById("btnUndo")?.disabled === true));

  const clipCount = await page.evaluate(() => window.__aifimoraStore.get().clips.length);
  ok("demo clips present", clipCount > 0, `${clipCount} clips`);

  if (clipCount > 0) {
    await page.locator(".tl-clip").first().click({ force: true });
    await page.waitForTimeout(80);
    await page.click("#btnSplit");
    await page.waitForTimeout(250);
    const undoReady = await page.evaluate(() => ({
      enabled: !document.getElementById("btnUndo")?.disabled,
      last: document.getElementById("statLastAction")?.textContent || "",
      canUndo: window.__aifimoraStore.canUndo(),
    }));
    ok("undo enables after edit", undoReady.enabled || undoReady.canUndo, JSON.stringify(undoReady));
  }

  await page.click('[data-sidebar="effects"]');
  await page.waitForTimeout(150);
  ok("Split Screen in Effects", await page.locator("#splitGrid .split-card").count() >= 4);

  await page.evaluate(() => {
    const c = window.__aifimoraStore.get().clips.find((x) => x.type === "video");
    if (c) window.__aifimoraStore.set({ selectedClipId: c.id });
  });
  await page.locator('#splitGrid [data-split="side"]').click();
  await page.waitForTimeout(150);
  const splitApplied = await page.evaluate(() => {
    const id = window.__aifimoraStore.get().selectedClipId;
    return window.__aifimoraStore.getClip(id)?.fx?.split;
  });
  ok("Split Screen applies to clip", splitApplied === "side", String(splitApplied));

  await page.click('.ptab[data-ptab="source"]');
  await page.waitForTimeout(150);
  const sourceOk = await page.evaluate(() => {
    const c = document.getElementById("sourceCanvas");
    return c && !c.hidden && c.width > 0;
  });
  ok("Source monitor visible", sourceOk);

  const menus = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".filmora-menu .fm-item > summary")).map((n) => n.textContent.trim())
  );
  ok("Filmora menus", menus.join(",") === "File,Edit,Tools,View,Extended,Help,Version", JSON.stringify(menus));

  ok("no JS errors", errors.length === 0, errors.slice(0, 4).join(" | "));

  await page.screenshot({ path: "output-filmora-working.png" });
  await browser.close();
  server.close();
  const failed = checks.filter((c) => !c.pass).length;
  console.log(`\n${checks.length - failed}/${checks.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(2);
});
