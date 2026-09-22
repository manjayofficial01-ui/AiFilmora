const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");
const root = __dirname;
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
function serve() {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const p = path.join(root, (req.url || "/").split("?")[0].replace(/^\//, "") || "index.html");
      fs.readFile(p, (err, buf) => {
        if (err) { res.writeHead(404); return res.end("nope"); }
        res.writeHead(200, { "Content-Type": mime[path.extname(p)] || "application/octet-stream" });
        res.end(buf);
      });
    });
    s.listen(0, "127.0.0.1", () => resolve(s));
  });
}
(async () => {
  const server = await serve();
  const port = server.address().port;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle" });
  await page.click("#frDemo").catch(() => {});
  await page.waitForTimeout(500);
  const out = await page.evaluate(() => ({
    layoutBtns: [...document.querySelectorAll("[data-layout]")].map((b) => b.dataset.layout),
    hasKfRows: !!document.querySelector(".kf-rows"),
    hasKfPropSel: !!document.getElementById("kfPropSel"),
    hasKfDiamonds: document.querySelectorAll("[data-kf-toggle]").length,
    hasGraphShell: !!document.getElementById("kfGraph"),
    toolBtns: ["btnAiColorPalette","btnColorMatch","btnStabilizeProps","btnChromaProps","btnAiMatting","btnSegmentedSpeed","btnFreezeFrame","btnReverseSpeed"]
      .filter((id) => document.getElementById(id)),
    hasInstantCutterMenu: !!document.getElementById("menuInstantCutter"),
    hasRecordMenu: !!document.getElementById("menuRecordMedia"),
    hasToolsExtras: !!document.getElementById("menuSilence") && !!document.getElementById("menuAutoReframe"),
    layoutMode: document.getElementById("app")?.dataset.layout || null,
  }));
  await page.evaluate(() => document.getElementById("kfOpenGraph")?.click());
  await page.waitForTimeout(150);
  out.graphVisible = await page.evaluate(() => {
    const g = document.getElementById("kfGraph");
    return !!g && !g.hidden;
  });
  await page.evaluate(() => document.getElementById("menuInstantCutter")?.click());
  await page.waitForTimeout(150);
  out.cutterOpen = await page.evaluate(() => document.getElementById("instantCutterModal")?.classList.contains("open"));
  out.errors = errors;
  console.log(JSON.stringify(out, null, 2));
  const fail =
    errors.length ||
    !(out.layoutBtns || []).includes("short-video") ||
    !out.hasKfRows ||
    out.hasKfDiamonds < 5 ||
    !(out.toolBtns || []).includes("btnAiMatting") ||
    !out.hasInstantCutterMenu ||
    !out.graphVisible ||
    !out.cutterOpen;
  await browser.close();
  server.close();
  process.exit(fail ? 1 : 0);
})();
