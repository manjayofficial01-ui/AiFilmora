/* Smoke test: browser (no Electron) fallback — typed name + folder are used. */
const { chromium } = require("playwright");
const path = require("path");
const OUT = path.join(__dirname, "output-save-fallback.png");
const URL = "http://127.0.0.1:8765/index.html";

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  const notes = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text());
  });

  await page.addInitScript(() => {
    delete window.aifimoraDesktop;
    Object.defineProperty(window, "showSaveFilePicker", { value: undefined, configurable: true }); // no FSA API
  });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  await page.click("#btnExport");
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT, clip: await page.locator("#exportModal .modal").boundingBox() });

  // cleared name auto-fills back to the project name (never exports an unnamed file)
  await page.fill("#exportFileName", "");
  await page.click("#exportStart");
  await page.waitForTimeout(300);
  notes.push("clearedNameStatus=" + (await page.locator("#exportStatus").textContent()));
  notes.push("clearedNameValue=" + (await page.inputValue("#exportFileName")));
  await page.waitForTimeout(4500);

  // valid name → renders to typed path (modal auto-closes after a completed render)
  await page.click("#btnExport");
  await page.waitForTimeout(250);
  await page.fill("#exportFileName", "Reel v2");
  await page.fill("#exportFolder", "D:\\Export");
  await page.click("#exportStart");
  await page.waitForTimeout(4500);
  notes.push("finalStatus=" + (await page.locator("#exportStatus").textContent()));
  notes.push(
    "remembered=" +
      (await page.evaluate(() => JSON.parse(localStorage.getItem("aifimora.settings.v2") || "{}").outputFolder))
  );

  console.log(notes.join("\n"));
  console.log("errors: " + (errors.length ? "\n  " + errors.join("\n  ") : "none"));
  await browser.close();
})();
