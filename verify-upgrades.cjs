const { chromium } = require("playwright");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME,
    args: ["--no-sandbox", "--disable-gpu", "--disable-http-cache"],
  });
  const page = await browser.newPage({ viewport: { width: 1366, height: 850 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message + "\n" + (e.stack || "")));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("CONSOLE: " + m.text());
  });

  await page.goto("http://127.0.0.1:8765/index.html", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => localStorage.setItem('aifilmora.firstRun.v1', 'skip')); // first-run chooser dismissal (auto-patched)
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(500);

  const results = {};

  // 1) Inspector tabs present
  results.tabs = await page.evaluate(() => {
    const tabs = [...document.querySelectorAll("[data-inspector]")].map((b) => b.dataset.inspector);
    return {
      hasMotion: tabs.includes("motion"),
      hasScopes: tabs.includes("scopes"),
      hasMotionView: !!document.getElementById("insp-motion"),
      hasScopesView: !!document.getElementById("insp-scopes"),
    };
  });

  // 2) Motion: select video clip, enable keyframes, add keyframe
  await page.locator(".tl-clip[data-type='video']").first().click({ force: true });
  await page.click("[data-inspector='motion']");
  await page.waitForTimeout(150);
  results.motion = await page.evaluate(() => {
    const cb = document.getElementById("motionAnimate");
    if (!cb) return { ok: false, reason: "no motion checkbox" };
    cb.checked = true;
    cb.dispatchEvent(new Event("change"));
    const addBtn = [...document.querySelectorAll("#motionPanel button")].find((b) => b.textContent.includes("Add"));
    addBtn && addBtn.click();
    const s = window.__aifimoraStore.get();
    const clip = s.clips.find((c) => c.id === s.selectedClipId);
    return {
      ok: !!(clip.motion && clip.motion.keys && clip.motion.keys.length > 0),
      keys: clip.motion ? (clip.motion.keys || []).length : 0,
      dots: document.querySelectorAll("#motionPanel .kf-dot").length,
    };
  });

  // 3) Scopes: non-blank canvas after a frame
  await page.click("[data-inspector='scopes']");
  await page.waitForTimeout(400);
  results.scopes = await page.evaluate(() => {
    const c = document.getElementById("scopeCanvas");
    if (!c) return { ok: false, reason: "no scope canvas" };
    const ctx = c.getContext("2d");
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let nonblack = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 12) nonblack++;
    return { ok: nonblack > 50, nonblack, w: c.width, h: c.height };
  });

  // 4) Beat Sync on audio clip
  await page.locator(".tl-clip[data-type='audio']").first().click({ force: true });
  await page.click("#btnBeatSync");
  await page.waitForTimeout(300);
  results.beats = await page.evaluate(() => {
    const s = window.__aifimoraStore.get();
    const clip = s.clips.find((c) => c.id === s.selectedClipId);
    return {
      ok: !!(clip && clip.beats && clip.beats.length > 0),
      count: clip && clip.beats ? clip.beats.length : 0,
      ticks: document.querySelectorAll(".beat-tick").length,
    };
  });

  // 5) Preferences modal + theme switch applies VIP class
  // #menuPreferences now lives inside the collapsed File dropdown, so drive the
  // always-visible toolbar button (which is wired to the same handler).
  await page.click("#menuPreferencesTop");
  await page.waitForTimeout(250);
  results.settings = await page.evaluate(() => {
    const open = document.getElementById("settingsModal").classList.contains("open");
    const navBtns = document.querySelectorAll(".settings-nav button").length;
    // first select in the body is the theme picker (dark / light / system)
    const sel = document.querySelector("#settingsModalBody select");
    let applied = false;
    if (sel) {
      sel.value = "light";
      sel.dispatchEvent(new Event("change"));
      applied = document.documentElement.classList.contains("theme-light");
    }
    return { open, navBtns, lightApplied: applied };
  });
  // clean up theme
  await page.evaluate(() => {
    const sel = document.querySelector("#settingsModalBody select");
    if (sel) {
      sel.value = "dark";
      sel.dispatchEvent(new Event("change"));
    }
  });
  await page.click("#settingsClose");
  await page.waitForTimeout(100);

  // 6) master volume default applied from settings
  results.masterVol = await page.evaluate(() => {
    const mv = document.getElementById("masterVolume");
    return { value: mv ? mv.value : null };
  });

  results.errors = errors;
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
  if (errors.length) process.exit(2);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
