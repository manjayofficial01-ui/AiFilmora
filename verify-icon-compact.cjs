/* Smoke test: Round 4 — icon-first tabs, compact chrome, dark-first default.
 *
 * Asserts:
 *   1. every [data-icon] host received an inline <svg> (library rail,
 *      inspector rail, titlebar buttons, export pill, project pill)
 *   2. no emoji is left in the titlebar
 *   3. the centred project-pill dead gap is gone (margin-left/right == 0px)
 *   4. the "LIBRARY" / "INSPECTOR" headings no longer cost a row
 *   5. dark is the boot theme and the tokens actually resolve to the deep ramp
 *   6. no console/page errors
 */
const { chromium } = require("playwright");
const URL = "http://127.0.0.1:8765/index.html";

const fail = [];
const ok = [];
const check = (cond, msg) => (cond ? ok.push(msg) : fail.push(msg));

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  if (await page.locator("#firstRunModal.open").count()) {
    await page.click("#frSkip");
    await page.waitForTimeout(200);
  }

  /* 1 — icon hydration ---------------------------------------------------- */
  const icons = await page.evaluate(() => {
    const hosts = Array.from(document.querySelectorAll("[data-icon]"));
    const missing = hosts
      .filter((h) => !h.querySelector(":scope > .tab-ico > svg, :scope > .ico > svg, :scope > .btn-ico > svg"))
      .map((h) => h.dataset.icon + "@" + (h.id || h.className));
    return { total: hosts.length, missing };
  });
  check(icons.total >= 19, `[data-icon] hosts present: ${icons.total}`);
  check(icons.missing.length === 0, `all hosts hydrated (missing: ${JSON.stringify(icons.missing)})`);

  const libIcons = await page.evaluate(() =>
    Array.from(document.querySelectorAll("#libraryTabs .tab")).map((t) => ({
      icon: t.dataset.icon,
      svg: !!t.querySelector(".tab-ico svg"),
      label: t.querySelector(".tab-lbl")?.textContent,
      w: Math.round(t.getBoundingClientRect().width),
    }))
  );
  check(libIcons.length === 6 && libIcons.every((t) => t.svg), `library rail: 6 tabs with SVGs — ${JSON.stringify(libIcons.map((t) => t.icon))}`);

  const inspIcons = await page.evaluate(() =>
    Array.from(document.querySelectorAll("#inspectorTabs .tab")).map((t) => ({
      icon: t.dataset.icon,
      svg: !!t.querySelector(".tab-ico svg"),
      label: t.querySelector(".tab-lbl")?.textContent,
    }))
  );
  check(inspIcons.length === 11 && inspIcons.every((t) => t.svg), `inspector rail: 11 tabs with SVGs — ${JSON.stringify(inspIcons.map((t) => t.icon))}`);

  /* 2 — no emoji left in the titlebar ------------------------------------- */
  const emoji = await page.evaluate(() => {
    const re = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
    return Array.from(document.querySelectorAll(".filmora-titlebar *"))
      .filter((n) => n.children.length === 0 && re.test(n.textContent || ""))
      .map((n) => (n.id || n.className) + ":" + n.textContent.trim());
  });
  check(emoji.length === 0, `no emoji glyphs in titlebar (${JSON.stringify(emoji)})`);

  /* 3 — the centred gap is gone ------------------------------------------- */
  const pill = await page.evaluate(() => {
    const p = document.querySelector(".project-pill");
    if (!p) return null;
    const r = p.getBoundingClientRect();
    const right = document.querySelector(".titlebar-right").getBoundingClientRect();
    const menu = document.querySelector(".filmora-menu").getBoundingClientRect();
    return {
      w: Math.round(r.width),
      hasIcon: !!p.querySelector(".ico svg"),
      // the chip must sit flush against the right cluster, not float mid-bar
      gapToRightCluster: Math.round(right.left - r.right),
      gapAfterMenu: Math.round(r.left - menu.right),
    };
  });
  check(
    pill && pill.gapToRightCluster <= 14,
    `project chip hugs the right cluster (gap ${pill?.gapToRightCluster}px, was a centred ~200px hole)`
  );
  check(pill && pill.hasIcon, "project-pill has an icon");

  /* 4 — headers no longer cost a row -------------------------------------- */
  const headers = await page.evaluate(() => {
    const pick = (sel) => {
      const h = document.querySelector(sel);
      if (!h) return null;
      const h2 = h.querySelector("h2");
      return {
        h: Math.round(h.getBoundingClientRect().height),
        // sr-only keeps the heading for screen readers but pulls it out of flow,
        // so it must contribute zero height to the header.
        h2: h2 ? getComputedStyle(h2).position : "(no h2)",
        text: (h.textContent || "").trim().slice(0, 24),
      };
    };
    return {
      project: pick(".inspector > .panel-header"),
      library: pick(".sidebar > .panel-header"),
      inspector: (() => {
        const h = document.querySelector("#inspectorTabs")?.closest(".panel-header");
        if (!h) return null;
        const h2 = h.querySelector("h2");
        return { h: Math.round(h.getBoundingClientRect().height), h2: h2 ? getComputedStyle(h2).position : "(no h2)" };
      })(),
      railH: Math.round(document.querySelector("#inspectorTabs").getBoundingClientRect().height),
      libRailH: Math.round(document.querySelector("#libraryTabs").getBoundingClientRect().height),
    };
  });
  check(headers.library?.h2 === "absolute", `library heading out of flow (position=${headers.library?.h2})`);
  check(headers.inspector?.h2 === "absolute", `inspector heading out of flow (position=${headers.inspector?.h2})`);
  check(headers.railH <= 40, `inspector rail is one compact row: ${headers.railH}px`);
  check(headers.libRailH <= 40, `library rail is one compact row: ${headers.libRailH}px`);
  check(
    headers.library.h - headers.libRailH <= 12,
    `library header adds only padding around the rail: ${headers.library.h - headers.libRailH}px`
  );
  check(
    headers.inspector.h - headers.railH <= 12,
    `inspector header adds only padding around the rail: ${headers.inspector.h - headers.railH}px`
  );

  /* 5 — dark is the boot theme, and it resolves deep ---------------------- */
  const theme = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    return {
      dataTheme: document.documentElement.getAttribute("data-theme"),
      panel: cs.getPropertyValue("--panel").trim(),
      bg: cs.getPropertyValue("--bg").trim(),
      accent: cs.getPropertyValue("--accent").trim(),
      colorScheme: document.querySelector('meta[name="color-scheme"]')?.getAttribute("content"),
      bodyBg: getComputedStyle(document.body).backgroundColor,
      panelBg: getComputedStyle(document.querySelector(".panel.sidebar")).backgroundColor,
    };
  });
  check(theme.dataTheme === "dark", `boot theme = ${theme.dataTheme}`);
  check(theme.colorScheme === "dark", `color-scheme meta = ${theme.colorScheme}`);
  check(theme.panel === "#14181c", `--panel = ${theme.panel}`);
  check(theme.bg === "#090b0d", `--bg = ${theme.bg}`);
  check(theme.panelBg === "rgb(20, 24, 28)", `sidebar panel paints deep: ${theme.panelBg}`);

  /* 6 — light theme is no longer a no-op ---------------------------------- */
  const light = await page.evaluate(() => {
    const root = document.documentElement;
    root.classList.add("theme-light");
    const bg = getComputedStyle(document.querySelector(".panel.sidebar")).backgroundColor;
    const ink = getComputedStyle(root).getPropertyValue("--ink").trim();
    root.classList.remove("theme-light");
    return { bg, ink };
  });
  check(light.bg === "rgb(255, 255, 255)", `light theme repaints panels: ${light.bg}`);
  check(light.ink === "#1b2129", `light theme swaps the ink ramp: ${light.ink}`);

  /* 7 — tabs still switch -------------------------------------------------- */
  await page.click('[data-sidebar="effects"]');
  await page.waitForTimeout(150);
  const sideOk = await page.evaluate(() => document.getElementById("side-effects")?.classList.contains("active"));
  check(!!sideOk, "library icon tab still switches the sidebar view");

  await page.click('[data-inspector="speed"]');
  await page.waitForTimeout(150);
  const inspOk = await page.evaluate(() => document.getElementById("insp-speed")?.classList.contains("active"));
  check(!!inspOk, "inspector icon tab still switches the inspector view");

  /* 8 — the new titlebar icon toolbar is functional, not decorative --------- */
  const tools = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".tb-tools .tb-ico")).map((b) => ({
      icon: b.dataset.icon,
      wired: b.dataset.fm ? "fm:" + b.dataset.fm : b.dataset.edit ? "edit:" + b.dataset.edit : "(none)",
      svg: !!b.querySelector(".ico svg"),
    }))
  );
  check(tools.length === 7 && tools.every((t) => t.svg && t.wired !== "(none)"),
    `titlebar quick actions wired: ${JSON.stringify(tools.map((t) => t.wired))}`);

  const clipsBefore = await page.evaluate(() => window.__aifimoraStore.get().clips.length);
  await page.evaluate(() => document.querySelector('.tb-tools [data-edit="split"]')?.click());
  await page.waitForTimeout(400);
  const clipsAfter = await page.evaluate(() => window.__aifimoraStore.get().clips.length);
  check(clipsAfter >= clipsBefore, `split quick action fires without breaking state (${clipsBefore} → ${clipsAfter})`);

  /* 9 — the preview stage now gives its height to the canvas ---------------- */
  const stage = await page.evaluate(() => {
    const box = (s) => {
      const n = document.querySelector(s);
      if (!n) return null;
      const r = n.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    };
    return { tabs: box(".preview-tabs"), wrap: box(".preview-wrap"), canvas: box("#previewCanvas"), stage: box(".stage") };
  });
  check(stage.tabs.h <= 40, `preview tab strip is a strip: ${stage.tabs.h}px`);
  check(stage.wrap.h > stage.tabs.h * 3, `preview area dominates the stage: ${stage.wrap.h}px vs tabs ${stage.tabs.h}px`);
  check(stage.canvas.w >= 400, `preview canvas uses the reclaimed space: ${stage.canvas.w}×${stage.canvas.h}`);

  await page.screenshot({ path: "output-round4.png", fullPage: false });

  console.log("\n=== PASS ===");
  ok.forEach((m) => console.log("  ✓ " + m));
  if (fail.length) {
    console.log("\n=== FAIL ===");
    fail.forEach((m) => console.log("  ✗ " + m));
  }
  console.log("\n=== METRICS ===");
  console.log("  headers: " + JSON.stringify(headers));
  console.log("  theme:   " + JSON.stringify(theme));
  console.log("  pill:    " + JSON.stringify(pill));
  console.log("  library tabs: " + JSON.stringify(libIcons));
  console.log("\n=== ERRORS (" + errors.length + ") ===");
  errors.slice(0, 12).forEach((e) => console.log("  ! " + e));

  await browser.close();
  process.exit(fail.length || errors.length ? 1 : 0);
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(2);
});
