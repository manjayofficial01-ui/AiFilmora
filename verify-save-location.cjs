/* Smoke test: exporting must ask for save location + file name before rendering. */
const { chromium } = require("playwright");
const path = require("path");

const OUT = path.join(__dirname, "output-save-location.png");
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

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);

  // Pretend we're inside the Electron shell with a stubbed native save dialog.
  await page.addInitScript(() => {
    window.__saveCalls = [];
    window.__lastResult = null;
    window.aifimoraDesktop = {
      platform: "win32",
      saveVideo: async (opts) => {
        window.__saveCalls.push(opts);
        window.__lastResult = "D:\\Videos\\AiFilmora\\My Cut 2026.mp4";
        return window.__lastResult;
      },
      openFolder: async () => "D:\\Videos\\AiFilmora",
    };
    delete window.showSaveFilePicker; // force the desktop path
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  // open export
  await page.click("#btnExport");
  await page.waitForTimeout(200);
  notes.push("modalOpen=" + (await page.locator("#exportModal.open").count()));
  notes.push(
    "fields=" +
      JSON.stringify(
        await page.evaluate(() => ({
          name: document.getElementById("exportFileName")?.value,
          ext: document.getElementById("exportExt")?.textContent,
          dir: document.getElementById("exportFolder")?.value,
          hint: document.getElementById("exportDestHint")?.textContent,
        }))
      )
  );

  // preset switch should update the extension (.mov for ProRes)
  await page.click(".preset:has-text('ProRes')");
  await page.waitForTimeout(150);
  notes.push("extAfterProres=" + (await page.locator("#exportExt").textContent()));

  // type a name + folder
  await page.fill("#exportFileName", "Holiday Recap");
  await page.fill("#exportFolder", "D:\\Render");
  await page.waitForTimeout(100);

  // start render → must ask first
  await page.click("#exportStart");
  await page.waitForTimeout(400);
  const calls = await page.evaluate(() => window.__saveCalls);
  notes.push("saveDialogCalls=" + JSON.stringify(calls));
  notes.push("status=" + (await page.locator("#exportStatus").textContent()));

  // dialog returned a path → render should run and finish with that path
  await page.waitForTimeout(4500);
  notes.push("finalStatus=" + (await page.locator("#exportStatus").textContent()));
  notes.push(
    "rememberedOutputFolder=" +
      (await page.evaluate(() => JSON.parse(localStorage.getItem("aifimora.settings.v2") || "{}").outputFolder))
  );
  notes.push(
    "historyPath=" +
      (await page.evaluate(() => {
        const p = JSON.parse(localStorage.getItem("aifimora.project.v1") || "{}");
        const h = p.history || p.log || [];
        const last = h.filter((x) => x && x.type === "export").pop();
        return last ? last.outputPath : "none";
      }))
  );

  // ---- cancel path: dialog returns null → nothing rendered
  await page.evaluate(() => {
    window.aifimoraDesktop.saveVideo = async () => null;
  });
  await page.click("#btnExport");
  await page.waitForTimeout(200);
  await page.click("#exportStart");
  await page.waitForTimeout(600);
  notes.push("cancelStatus=" + (await page.locator("#exportStatus").textContent()));
  notes.push("startBtnEnabled=" + (await page.locator("#exportStart").isEnabled()));

  await page.screenshot({ path: OUT, fullPage: false });

  console.log(notes.join("\n"));
  console.log("errors: " + (errors.length ? "\n  " + errors.join("\n  ") : "none"));
  await browser.close();
})();
