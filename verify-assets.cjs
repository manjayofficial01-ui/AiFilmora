/* verify-assets.cjs — end-to-end verification of the `assets/` integration:
 * fonts, caption animations + textures, LUTs, transition thumbs + custom wipes,
 * shapes manifest, AI samples — plus zero console errors / zero 404s.
 * Run: node verify-assets.cjs   (needs server.cjs on 127.0.0.1:8765) */
const { chromium } = require("playwright");
const path = require("path");

const OUT = path.join(__dirname, "output-assets-integration.png");
const URL = "http://127.0.0.1:8765/index.html";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
};

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  const failed = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("response", (r) => { if (r.status() >= 400) failed.push(r.status() + " " + r.url()); });

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  if (await page.evaluate(() => document.getElementById("firstRunModal")?.classList.contains("open"))) {
    await page.click("#frSkip"); // standard layout so sidebar panels are live
    await page.waitForTimeout(900);
  }

  // 1. Fonts injected + loadable
  const fonts = await page.evaluate(async () => {
    const css = document.getElementById("assets-bridge-fonts")?.textContent || "";
    const faces = (css.match(/@font-face/g) || []).length;
    const first = css.match(/src:url\("([^"]+)"\)/)?.[1];
    const res = await fetch(first || "assets/Fonts/arial.ttf");
    return { faces, sampleOk: res.ok };
  });
  check("font faces injected", fonts.faces >= 250, fonts.faces + " faces");
  check("sample font loads", fonts.sampleOk);

  // 2. Caption animations mapped + thumbnails
  const caps = await page.evaluate(async () => {
    const mods = await import("./js/assets-bridge.js");
    const list = mods.captionAnimations();
    const bad = [];
    for (const c of list.slice(0, 12)) {
      const r = await fetch(c.thumb);
      if (!r.ok) bad.push(c.thumb);
    }
    return { total: list.length, bad: bad.length };
  });
  check("caption animations mapped", caps.total >= 90, caps.total + " items");
  check("caption thumbs fetchable", caps.bad === 0, caps.bad + " broken of first 12");

  // 3. LUT engine payload
  const lut = await page.evaluate(async () => {
    const r = await fetch("assets/configs/ColorAnd3dLutPreset/CubeLUTFiles/Batman.CUBE");
    return { ok: r.ok, lines: r.ok ? (await r.text()).split("\n").length : 0 };
  });
  check("LUT .CUBE fetch", lut.ok && lut.lines > 1000, lut.lines + " lines");

  // 4. Shape + transition manifests
  const manifest = await page.evaluate(async () => {
    const mods = await import("./js/assets-bridge.js");
    const s = await mods.shapeManifest();
    const t = await mods.transitionManifest();
    return { shapes: s.items?.length ?? 0, transitions: t.items?.length ?? 0 };
  });
  check("shapes manifest", manifest.shapes >= 5, manifest.shapes + " items");
  check("transitions manifest", manifest.transitions >= 3, manifest.transitions + " items");

  // 5. Built-in transition thumbnails actually render
  await page.evaluate(() => document.querySelector('[data-sidebar="transitions"]')?.click());
  await page.waitForTimeout(700);
  const transThumbs = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll("#traPresetGrid img, #transPresetGrid img")];
    return { count: imgs.length, broken: imgs.filter((i) => !i.complete || i.naturalWidth === 0).length };
  });
  check("built-in transition thumbs render", transThumbs.count >= 4 && transThumbs.broken === 0,
    transThumbs.count + " imgs, " + transThumbs.broken + " broken");

  // 6. Custom wipes appear in the transitions browser
  const customWipes = await page.evaluate(() =>
    [...document.querySelectorAll("button")].some((b) => b.textContent.includes("Gold Wipe"))
  );
  check("custom wipe in UI", customWipes);

  // 7. Shapes: user shapes from manifest in the grid
  await page.evaluate(() => document.querySelector('[data-sidebar="shapes"]')?.click());
  await page.waitForTimeout(1200);
  const shapes = await page.evaluate(() => {
    const g = document.getElementById("shapeGrid");
    if (!g) return { grid: false, has: false, n: 0 };
    const imgs = [...g.querySelectorAll("img")].map((i) => i.getAttribute("src"));
    return { grid: true, has: imgs.some((s) => s && s.includes("assets/shapes/")), n: imgs.length };
  });
  check("manifest shapes in grid", shapes.has, shapes.n + " user imgs, grid=" + shapes.grid);

  // 8. Caption texture + AI sample fetches
  const extras = await page.evaluate(async () => {
    const urls = [
      "assets/Captions/Texttures/TexturePreset/marble3.png",
      "assets/AIClip/Fashion1.png",
      "assets/AINanoBanana/Figurine1.png",
      "assets/AIWatermark/PreviewWaterMark.png",
      "assets/UpgradeGuide/resources/motion_blur.png",
    ];
    const bad = [];
    for (const u of urls) { const r = await fetch(u); if (!r.ok) bad.push(u); }
    return bad;
  });
  check("textures + AI samples fetchable", extras.length === 0, extras.join(", ") || "all 5 ok");

  // 9. Filter library LUT thumbs render
  await page.evaluate(() => document.querySelector('[data-sidebar="filters"]')?.click());
  await page.waitForTimeout(2500);
  const filterThumbs = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll("#side-filters .library-asset-thumb img, #side-filters img")];
    return { count: imgs.length, broken: imgs.filter((i) => !i.complete || i.naturalWidth === 0).length };
  });
  check("filter library thumbs", filterThumbs.count > 0 && filterThumbs.broken === 0,
    filterThumbs.count + " imgs, " + filterThumbs.broken + " broken");

  await page.screenshot({ path: OUT });

  const realErrors = errors.filter((e) => !e.includes("favicon"));
  const realFailed = failed.filter((f) => !f.includes("favicon") && !f.includes("previewVideo.mp4"));
  check("no console/page errors", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));
  check("no unexpected 404s", realFailed.length === 0, realFailed.slice(0, 3).join(" | "));

  const pass = results.filter((r) => r.ok).length;
  console.log(`\n${pass}/${results.length} checks passed. Screenshot: output-assets-integration.png`);
  await browser.close();
  if (pass !== results.length) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exit(1); });

