const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGE: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });
  await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  if (await page.evaluate(() => document.getElementById("firstRunModal")?.classList.contains("open"))) {
    await page.click("#frSkip"); await page.waitForTimeout(400);
  }
  const r = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll("#libraryTabs .tab")].map((t) => t.textContent.trim());
    const rails = {};
    for (const [view, sel] of [["media", "#side-media"], ["assets", "#side-assets"], ["audio", "#side-audio"], ["textpresets", "#side-textpresets"], ["transitions", "#side-transitions"], ["effects", "#side-effects"], ["filters", "#side-filters"], ["shapes", "#side-shapes"], ["templates", "#side-templates"], ["tools", "#side-tools"]]) {
      const el = document.querySelector(sel);
      rails[view] = el
        ? { rail: !!el.querySelector(".cat-rail"), items: [...el.querySelectorAll(".cat-item")].map((b) => b.textContent.replace(/[0-9]/g, "").trim()) }
        : null;
    }
    return {
      tabs,
      playerChip: !!document.querySelector(".player-chip"),
      fullBtn: !!document.querySelector("#btnPlayerFull"),
      templates: document.querySelectorAll("#templateGrid .template-card").length,
      rails,
    };
  });
  console.log(JSON.stringify(r, null, 1));
  // exercise: switch to Media tab, pick Video, then log render args
  const r2 = await page.evaluate(async () => {
    document.querySelector("#side-media .cat-item[data-cat='video']").click();
    await new Promise((r) => setTimeout(r, 1500));
    return { cat: window.__aifimoraMediaCat, grid: document.getElementById("mediaGrid").innerHTML.length };
  });
  console.log("CAT " + r2.cat + " gridLen=" + r2.grid);
  console.log("ERRORS " + JSON.stringify(errors.slice(0, 8)));
  await page.screenshot({ path: "output-media-menu.png" });
  await browser.close();
  if (errors.length) process.exitCode = 2;
})().catch((e) => { console.error(e); process.exit(1); });
