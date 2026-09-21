const { chromium } = require("playwright");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME, args: ["--no-sandbox", "--disable-gpu", "--disable-http-cache"] });
  const page = await browser.newPage({ viewport: { width: 1366, height: 850 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message + "\n" + (e.stack || "")));
  await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => localStorage.setItem('aifilmora.firstRun.v1', 'skip')); // first-run chooser dismissal (auto-patched)
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  const before = await page.evaluate(async () => {
    const m = await import("./js/settings.js");
    return { beat: m.settings.get().beat, hasSettings: !!m.settings };
  });

  await page.locator(".tl-clip[data-type='audio']").first().click({ force: true });
  await page.click("#btnBeatSync");
  await page.waitForTimeout(300);

  const after = await page.evaluate(() => {
    const s = window.__aifimoraStore.get();
    const clip = s.clips.find((c) => c.id === s.selectedClipId);
    return { beats: clip && clip.beats ? clip.beats.length : -1, ticks: document.querySelectorAll(".beat-tick").length };
  });
  console.log(JSON.stringify({ before, after, errors }, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
