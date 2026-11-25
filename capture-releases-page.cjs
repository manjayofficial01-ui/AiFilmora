/* capture-releases-page.cjs — screenshot the public GitHub Releases page,
 * so the installation guide shows the page the reader will actually land on.
 */
const { chromium } = require("playwright");
const path = require("node:path");

const ROOT = path.resolve(__dirname);
const OUT = path.join(ROOT, "docs", "images", "07-releases-page.png");
const URL = "https://github.com/manjayofficial01-ui/AiFilmora/releases/tag/v2.3.0";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 1400 },
    deviceScaleFactor: 1,
  });
  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: OUT });
  console.log("saved " + OUT);
  console.log("title: " + (await page.title()));
  await browser.close();
})().catch((e) => { console.error("CRASH: " + (e?.stack || e)); process.exit(1); });
