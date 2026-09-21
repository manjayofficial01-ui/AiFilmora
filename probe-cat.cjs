const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const m = document.getElementById("firstRunModal");
    if (m && m.classList.contains("open")) document.getElementById("frSkip").click();
  });
  await page.waitForTimeout(1500);
  const out = await page.evaluate(async () => {
    document.querySelector("#side-media .cat-item[data-cat='video']").click();
    await new Promise((r) => setTimeout(r, 1500));
    const cards = [...document.querySelectorAll("#mediaGrid .media-card")];
    return {
      cat: window.__aifimoraMediaCat,
      n: cards.length,
      badges: cards.map((c) => c.querySelector(".media-badge")?.textContent.trim()),
      mediaLen: (window.__aifimoraStore?.get().media || []).length,
      gridHTML: document.getElementById("mediaGrid").innerHTML.slice(0, 120),
    };
  });
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
