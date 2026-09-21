/* Measures vertical chrome cost so "unnecessary space" is a number, not a vibe. */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ headless: true, channel: "chrome" });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto("http://127.0.0.1:8765/index.html", { waitUntil: "networkidle" });
  await p.waitForTimeout(1000);
  const m = await p.evaluate(() => {
    const h = (sel) => { const n = document.querySelector(sel); return n ? Math.round(n.getBoundingClientRect().height) : null; };
    const w = (sel) => { const n = document.querySelector(sel); return n ? Math.round(n.getBoundingClientRect().width) : null; };
    // horizontal dead space in the titlebar: distance between brand end and right cluster start
    const tb = document.querySelector(".filmora-titlebar").getBoundingClientRect();
    const brand = document.querySelector(".brand").getBoundingClientRect();
    const menu = document.querySelector(".filmora-menu").getBoundingClientRect();
    const pill = document.querySelector(".project-pill").getBoundingClientRect();
    const right = document.querySelector(".titlebar-right").getBoundingClientRect();
    return {
      viewport: [innerWidth, innerHeight],
      titlebar: h(".filmora-titlebar"),
      tbGapBrandMenu: Math.round(menu.left - brand.right),
      tbGapMenuPill: Math.round(pill.left - menu.right),
      tbGapPillRight: Math.round(right.left - pill.right),
      tbRightW: Math.round(right.width),
      sidebarHeader: h(".sidebar > .panel-header"),
      inspectorProjectHeader: h(".inspector > .panel-header"),
      inspectorTabHeader: h("#inspectorTabs") && Math.round(document.querySelector("#inspectorTabs").closest(".panel-header").getBoundingClientRect().height),
      previewTabs: h(".preview-tabs"),
      transport: h(".transport"),
      tlToolbar: h(".tl-toolbar"),
      statusbar: h(".statusbar"),
      sidebarW: w(".sidebar"),
      inspectorW: w(".inspector"),
      railRow: h("#libraryTabs"),
      sidebarBodyScrollH: document.querySelector(".sidebar .panel-body")?.scrollHeight,
    };
  });
  const chrome = (m.titlebar||0) + (m.sidebarHeader||0) + (m.previewTabs||0) + (m.transport||0) + (m.tlToolbar||0) + (m.statusbar||0);
  console.log(JSON.stringify(m, null, 1));
  console.log("chrome rows total: " + chrome + "px of " + m.viewport[1] + "px  (" + Math.round(chrome / m.viewport[1] * 100) + "%)");
  await b.close();
})();
