const { chromium } = require("playwright");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: ["--no-sandbox", "--disable-gpu", "--disable-http-cache"] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 850 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });
  await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => localStorage.setItem('aifilmora.firstRun.v1', 'skip')); // first-run chooser dismissal (auto-patched)
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  // Text: add title
  await page.click('[data-inspector="textpanel"]');
  await page.click("#btnAddTitle");
  await page.waitForTimeout(200);
  const textClip = await page.evaluate(() => !!document.querySelector('.tl-clip[data-type="text"]'));

  // Transition: select a video clip, apply first transition
  await page.locator('.tl-clip[data-type="video"]').first().click({ force: true });
  await page.click('[data-sidebar="transitions"]');
  await page.waitForTimeout(100);
  const transApplied = await page.evaluate(() => {
    const grid = document.querySelector("#transGrid");
    const pre = grid && grid.querySelector(".preset");
    if (pre) pre.click();
    return !!document.querySelector(".tl-trans.has");
  });

  // AI settings present
  await page.click('[data-inspector="aisettings"]');
  await page.waitForTimeout(100);
  const aiOpts = await page.evaluate(() => document.getElementById("aiProviderSelect")?.options.length || 0);

  // Play for a moment
  await page.click("#btnPlay");
  await page.waitForTimeout(400);
  const playing = await page.evaluate(() => document.getElementById("btnPlay")?.textContent);

  console.log(JSON.stringify({ textClip, transApplied, aiOpts, playing, errors }, null, 2));
  await browser.close();
  if (errors.length) process.exit(2);
})().catch((e) => { console.error(e); process.exit(1); });
