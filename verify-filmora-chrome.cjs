/* verify-filmora-chrome.cjs — Filmora chrome parity smoke test */
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };

function serve() {
  return new Promise((resolve) => {
    const s = http.createServer((req, res) => {
      const p = path.join(root, (req.url || "/").split("?")[0].replace(/^\//, "") || "index.html");
      fs.readFile(p, (err, buf) => {
        if (err) {
          res.writeHead(404);
          return res.end("nope");
        }
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
  page.on("console", (m) => {
    // Ignore optional-asset 404 noise (LUTs, transition thumbs, AI toolbox demos)
    if (m.type() === "error" && !/Failed to load resource/i.test(m.text())) errors.push(m.text());
  });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle" });

  // dismiss first-run
  await page.click("#frDemo").catch(() => {});
  await page.waitForTimeout(600);

  const out = {};
  out.hasChromeModule = await page.evaluate(() => !!document.getElementById("propsAccordion"));
  out.propsSections = await page.$$eval("#propsAccordion .props-sec", (els) => els.map((e) => e.dataset.sec));
  out.exportMenuItems = await page.$$eval(".export-menu [data-dest]", (els) => els.map((e) => e.dataset.dest));
  out.exportTabs = await page.$$eval("#exportTabs [data-edest]", (els) => els.map((e) => e.dataset.edest));
  out.quality = await page.$$eval("#exportQuality [data-qual]", (els) => els.map((e) => e.dataset.qual));
  out.transportSvgs = await page.$$eval(".transport-btn svg", (els) => els.length);
  out.snapshotBtn = await page.$("#btnSnapshot") ? true : false;
  out.dockBtns = await page.$$eval("[data-dock]", (els) => els.map((e) => e.dataset.dock));
  out.winControls = await page.$$eval(".win-btn", (els) => els.map((e) => e.id));
  out.fileMenuExtras = await page.evaluate(() => !!document.getElementById("menuImportMedia") && !!document.getElementById("menuExit"));
  out.viewMenuExtras = await page.evaluate(() => !!document.getElementById("menuToggleLibrary"));

  // content-aware: select first timeline clip if any
  await page.click(".tl-clip").catch(() => {});
  await page.waitForTimeout(200);
  out.visibleSectionsOnClip = await page.$$eval("#propsAccordion .props-sec:not([hidden])", (els) => els.map((e) => e.dataset.sec));
  out.hiddenSectionsOnClip = await page.$$eval("#propsAccordion .props-sec[hidden]", (els) => els.map((e) => e.dataset.sec));

  // dock collapse
  await page.click('[data-dock="inspector"]');
  await page.waitForTimeout(100);
  out.inspCollapsed = await page.evaluate(() => document.getElementById("app").classList.contains("insp-collapsed"));
  await page.click('[data-dock="inspector"]').catch(() => {});
  // restore via View menu if dock button is gone
  await page.evaluate(() => document.getElementById("app").classList.remove("insp-collapsed"));

  // export modal
  await page.click("#btnExportTop");
  await page.waitForTimeout(100);
  // close export menu if open, then open via File
  await page.evaluate(() => {
    document.querySelector(".export-menu")?.classList.remove("open");
    window.dispatchEvent(new CustomEvent("aifimora:open-export"));
  });
  await page.waitForTimeout(150);
  out.exportOpen = await page.evaluate(() => document.getElementById("exportModal").classList.contains("open"));
  out.hasFormatSelect = await page.$("#exportFormat") ? true : false;

  out.errors = errors;
  console.log(JSON.stringify(out, null, 2));
  const fail =
    errors.length ||
    !out.hasChromeModule ||
    !(out.exportTabs || []).includes("local") ||
    !(out.exportTabs || []).includes("dvd") ||
    out.transportSvgs < 4 ||
    !out.snapshotBtn ||
    !out.fileMenuExtras;
  await browser.close();
  server.close();
  process.exit(fail ? 1 : 0);
})();
