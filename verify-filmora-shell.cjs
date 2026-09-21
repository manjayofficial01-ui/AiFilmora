/* Smoke test: Filmora-inspired shell + asset bridge. */
const { chromium } = require("playwright");
const path = require("path");
const URL = "http://127.0.0.1:8765/index.html";

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  const notes = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

  await page.goto(URL, { waitUntil: "networkidle" });
  // Dismiss the first-run chooser (added after this script was written)
  if (await page.evaluate(() => document.getElementById("firstRunModal")?.classList.contains("open"))) {
    await page.click("#frSkip");
    await page.waitForTimeout(400);
  }
  await page.waitForTimeout(900);

  const menus = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".filmora-menu .fm-item > summary")).map((n) => n.textContent.trim())
  );
  notes.push("filmoraMenus=" + JSON.stringify(menus));

  const previewTabs = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".ptab")).map((n) => n.textContent.trim())
  );
  notes.push("previewTabs=" + JSON.stringify(previewTabs));

  const previewDDs = await page.evaluate(() => ({
    quality: Array.from(document.querySelectorAll("#previewQuality option")).map((o) => o.textContent),
    aspect: Array.from(document.querySelectorAll("#previewAspect option")).map((o) => o.textContent),
  }));
  notes.push("previewDDs=" + JSON.stringify(previewDDs));

  const pi = await page.evaluate(() => ({
    name: document.getElementById("piName")?.textContent,
    res: document.getElementById("piResolution")?.textContent,
    fps: document.getElementById("piFps")?.textContent,
    dur: document.getElementById("piDuration")?.textContent,
  }));
  notes.push("projectInfo=" + JSON.stringify(pi));

  await page.click('[data-inspector="textpanel"]');
  await page.waitForTimeout(300);
  const fontCount = await page.evaluate(() => document.querySelectorAll("#textFont optgroup").length);
  const fontFamiliesSample = await page.evaluate(() =>
    Array.from(document.querySelectorAll("#textFont optgroup")).slice(0, 12).map((g) => g.label)
  );
  notes.push("fontFamilies=" + fontCount + " · sample=" + JSON.stringify(fontFamiliesSample));

  const capCount = await page.evaluate(() => document.querySelectorAll("#capAnimGrid .caption-anim").length);
  notes.push("captionAnimations=" + capCount);

  await page.evaluate(() => document.querySelector("#capAnimGrid .caption-anim")?.click());
  await page.waitForTimeout(250);
  const animValue = await page.evaluate(() => document.getElementById("textAnim")?.value);
  notes.push("afterClickAnim=" + animValue);

  await page.click("#textFontToggle");
  await page.waitForTimeout(200);
  const allFontCount = await page.evaluate(() => document.querySelectorAll("#textFont optgroup").length);
  notes.push("afterAllToggle=" + allFontCount);

  const fontFaceRules = await page.evaluate(() => {
    const style = document.getElementById("assets-bridge-fonts");
    return style ? style.textContent.length : 0;
  });
  notes.push("fontFaceCSSBytes=" + fontFaceRules);

  await page.evaluate(() => window.__aifimoraApplyThemePreset?.("filmora-dark"));
  await page.waitForTimeout(200);
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--accent").trim());
  notes.push("filmoraDarkAccent=" + accent);

  const outShell = path.join(__dirname, "output-filmora-shell.png");
  const outText = path.join(__dirname, "output-filmora-text.png");
  await page.evaluate(() => window.__aifimoraApplyThemePreset?.("dark"));
  await page.waitForTimeout(150);
  await page.screenshot({ path: outShell, fullPage: false });
  await page.click('[data-inspector="textpanel"]');
  await page.waitForTimeout(300);
  // Widen the inspector to make the caption gallery visible alongside the font picker.
  // Also inject a title so we can see the Filmora font applied to a real text clip.
  await page.evaluate(() => {
    const insp = document.querySelector(".panel.inspector");
    if (insp) insp.style.flex = "0 0 540px";
    // Add a title text clip at the playhead to ensure caption animations can apply
    const s = window.__aifimoraStore.get();
    if (!s.clips.find((c) => c.type === "text")) {
      window.__aifimoraStore.addClip({
        type: "text", trackId: "t1", name: "TITLE", text: "Your Title",
        start: 0, duration: 4,
        textStyle: { content: "Your Title", size: 64, weight: 700, pos: "center", color: "#ffffff", anim: "pop", letterSpacing: 4, uppercase: true },
      });
    }
    window.__aifimoraStore.set({ selectedClipId: window.__aifimoraStore.get().clips.find((c) => c.type === "text")?.id });
  });
  await page.waitForTimeout(200);
  // Scroll the inspector body down so both the font picker AND the caption gallery fit
  await page.evaluate(() => {
    const body = document.querySelector("#insp-textpanel .panel-body");
    if (body) body.scrollTop = body.scrollHeight;
  });
  await page.waitForTimeout(150);
  // Change font to a Filmora font so we can see the @font-face actually applied
  await page.selectOption("#textFont", { label: "Bebas Neue · 400" }).catch(() => {});
  await page.waitForTimeout(200);
  // Take a viewport screenshot covering the inspector and the program monitor
  await page.screenshot({ path: outText, fullPage: false });

  await page.evaluate(() => window.__aifimoraApplyThemePreset?.("filmora-dark"));
  await page.waitForTimeout(300);
  const outFilmora = path.join(__dirname, "output-filmora-theme.png");
  await page.screenshot({ path: outFilmora, fullPage: false });

  console.log(notes.join("\n"));
  console.log("errors: " + (errors.length ? "\n  " + errors.join("\n  ") : "none"));
  await browser.close();
})();