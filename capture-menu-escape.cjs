/* capture-menu-escape.cjs — visual evidence that Escape closes the Filmora menu.
 *
 * Run: node capture-menu-escape.cjs   (needs server.cjs on 127.0.0.1:8765)
 * Writes design/shots/menu-open.png and design/shots/menu-escaped.png.
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const { dismissFirstRun } = require("./test-helpers.cjs");

const ROOT = __dirname;
const URL = "http://127.0.0.1:8765/index.html";
const OUT = path.join(ROOT, "design", "shots");

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGE: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });

  await page.goto(URL, { waitUntil: "networkidle" });
  await dismissFirstRun(page, "#frSkip");
  await page.waitForTimeout(600);

  await page.click("#fmVersion > summary");
  await page.waitForTimeout(250);
  const open = await page.evaluate(() => document.querySelectorAll(".fm-item[open]").length);
  await page.screenshot({ path: path.join(OUT, "menu-open.png") });

  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => document.querySelectorAll(".fm-item[open]").length);
  await page.screenshot({ path: path.join(OUT, "menu-escaped.png") });

  console.log(JSON.stringify({ menusOpenAfterClick: open, menusOpenAfterEscape: after, consoleErrors: errors }, null, 2));
  await browser.close();
  if (errors.length || open !== 1 || after !== 0) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
