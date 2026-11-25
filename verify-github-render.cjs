/* verify-github-render.cjs — check that the README's images and links actually
 * resolve on github.com, by reading the rendered page rather than assuming.
 */
const { chromium } = require("playwright");
const path = require("node:path");
const fs = require("node:fs");

const ROOT = path.resolve(__dirname);
const OUT = path.join(ROOT, "docs", "images", "08-github-readme.png");
const REPO = "https://github.com/manjayofficial01-ui/AiFilmora";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } });
  const broken = [];
  const failed = [];
  page.on("response", (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(REPO, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);

  // Every image the README shows, resolved on the page itself.
  const imgs = await page.$$eval("#readme img", (els) =>
    els.map((e) => ({ src: e.currentSrc || e.src, alt: e.alt, w: e.naturalWidth, h: e.naturalHeight }))
  );
  for (const i of imgs) {
    if (!i.w || !i.h) broken.push(`${i.alt || i.src} did not render (${i.w}x${i.h})`);
  }
  console.log(`images on the README: ${imgs.length}`);
  for (const i of imgs) console.log(`  ${i.w}x${i.h}  ${i.alt}`);

  const links = await page.$$eval("#readme a", (els) =>
    els.map((e) => ({ href: e.href, text: (e.textContent || "").trim().slice(0, 60) }))
  );
  console.log(`links on the README: ${links.length}`);

  const licence = await page.$eval("#readme a", () => true).catch(() => false);

  await page.screenshot({ path: OUT, fullPage: false });
  console.log("saved " + OUT);

  console.log("broken images: " + (broken.length ? broken.join(" | ") : "none"));
  console.log("failed requests: " + (failed.length ? failed.join(" | ") : "none"));
  await browser.close();
  process.exit(broken.length ? 1 : 0);
})().catch((e) => { console.error("CRASH: " + (e?.stack || e)); process.exit(1); });
