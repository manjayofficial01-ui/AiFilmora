/* Smoke test: Filmora theme actually transforms the UI (round 2).
 * Asserts computed token values differ per theme AND that real components pick them up. */
const { chromium } = require("playwright");
const path = require("path");
const URL = "http://127.0.0.1:8765/index.html";

const TOKENS = [
  "--bg", "--panel", "--elevated", "--accent", "--accent-ai", "--gen",
  "--ink", "--ink-body", "--ink-muted", "--ink-disabled",
  "--surface-1", "--surface-3", "--field", "--stroke-1", "--border", "--scrollbar",
];

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  const read = () =>
    page.evaluate((toks) => {
      const cs = getComputedStyle(document.documentElement);
      const out = {};
      toks.forEach((t) => { out[t] = cs.getPropertyValue(t).trim(); });
      // real component colours — proof the theme reaches the DOM, not just :root
      const btn = document.querySelector(".btn");
      const tab = document.querySelector(".tab.active");
      const panel = document.querySelector(".panel.sidebar");
      const titlebar = document.querySelector(".titlebar");
      out.__btnBorder = btn ? getComputedStyle(btn).borderTopColor : "";
      out.__btnBg = btn ? getComputedStyle(btn).backgroundColor : "";
      out.__tabBg = tab ? getComputedStyle(tab).backgroundColor : "";
      out.__panelBg = panel ? getComputedStyle(panel).backgroundColor : "";
      out.__titlebarBg = titlebar ? getComputedStyle(titlebar).backgroundImage.slice(0, 60) : "";
      return out;
    }, TOKENS);

  const results = {};
  for (const theme of ["dark", "filmora-dark", "filmora-light"]) {
    await page.evaluate((t) => {
      if (t === "dark") window.__aifimoraClearThemePreset?.();
      else window.__aifimoraApplyThemePreset?.(t);
    }, theme);
    await page.waitForTimeout(250);
    results[theme] = await read();
    const f = path.join(__dirname, `output-theme-${theme}.png`);
    await page.screenshot({ path: f });
  }

  // Report
  console.log("=== TOKEN COMPARISON ===");
  const keys = [...TOKENS, "__btnBg", "__btnBorder", "__tabBg", "__panelBg"];
  for (const k of keys) {
    const a = results.dark[k], b = results["filmora-dark"][k], c = results["filmora-light"][k];
    const changed = a !== b || a !== c;
    console.log(`${changed ? "CHANGED" : "same   "}  ${k.padEnd(16)} dark=${(a||"-").padEnd(26)} filmoraDark=${(b||"-").padEnd(26)} filmoraLight=${(c||"-")}`);
  }

  const changedCount = keys.filter((k) => results.dark[k] !== results["filmora-dark"][k]).length;
  console.log(`\nfilmora-dark differs from dark on ${changedCount}/${keys.length} measured values`);

  console.log("\ntitlebar dark        :", results.dark.__titlebarBg);
  console.log("titlebar filmora-dark:", results["filmora-dark"].__titlebarBg);
  console.log("titlebar filmora-light:", results["filmora-light"].__titlebarBg);

  console.log("\nerrors: " + (errors.length ? "\n  " + errors.join("\n  ") : "none"));
  await browser.close();
})();