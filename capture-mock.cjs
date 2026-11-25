/* capture-mock.cjs — render design/timeline-v2-mock.html in both states. */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const OUT = path.resolve(path.join(process.cwd(), "design", "shots"));
const FILE = "file:///" + path.join(process.cwd(), "design", "timeline-v2-mock.html").replace(/\\/g, "/");

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGE: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });

  await page.goto(FILE, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, "mock-today.png"), fullPage: true });
  console.log("shot: mock-today");

  await page.click("#btn-proposed");
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, "mock-proposed.png"), fullPage: true });
  console.log("shot: mock-proposed");

  await page.click("#t-agents");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "mock-agent.png"), fullPage: true });
  console.log("shot: mock-agent");

  // high-DPI crop of the V1 lane to verify wedges, badges and filmstrip
  const lane = await page.$('.lane-track[data-track="v1"]');
  if (lane) {
    const p2 = await browser.newPage({ viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 3 });
    await p2.goto(FILE, { waitUntil: "networkidle" });
    await p2.click("#btn-proposed");
    await p2.waitForTimeout(700);
    const l2 = await p2.$('.lane-track[data-track="v1"]');
    await l2.screenshot({ path: path.join(OUT, "mock-lane-v1@3x.png") });
    await p2.close();
    console.log("shot: mock-lane-v1@3x");
  }

  // ruler crop
  const ruler = await page.$("#ruler");
  if (ruler) { await ruler.screenshot({ path: path.join(OUT, "mock-ruler@2x.png") }).catch(()=>{}); }

  // narrow viewport check
  await page.setViewportSize({ width: 1180, height: 1200 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, "mock-narrow.png"), fullPage: true });
  console.log("shot: mock-narrow");

  console.log("errors:", errors.length);
  errors.slice(0, 20).forEach((e) => console.log("  ", e));
  await browser.close();
})();
