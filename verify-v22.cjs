/* 2.2.0 acceptance: save locations, full-height inspector, ruler zoom, custom AI. */
const { chromium } = require("playwright");
const path = require("path");

const OUT = path.join(__dirname, "output-v22.png");
const URL = "http://127.0.0.1:8765/index.html";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  const notes = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text());
  });

  // Stub desktop bridge BEFORE load: saveVideo/saveProject/openFolder/writeFile.
  await page.addInitScript(() => {
    try {
      localStorage.setItem("aifilmora.firstRun.v1", "skip");
    } catch { /* ignore */ }
    window.__savedFiles = {};
    window.aifimoraDesktop = {
      platform: "win32",
      saveVideo: async () => null, // cancel native path; export falls to typed fields
      saveProject: async () => null,
      openProject: async () => null,
      openFolder: async () => "D:\\Videos\\AiFilmora",
      writeFile: async (p, b64) => {
        window.__savedFiles[p] = (b64 || "").length;
        return { ok: true, path: p, bytes: (b64 || "").length };
      },
    };
    delete window.showSaveFilePicker;
    delete window.showDirectoryPicker;
  });

  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  // Dismiss the first-run chooser if it appears (covers fresh profiles).
  if (await page.locator("#firstRunModal.open").count()) {
    await page.click("#frSkip");
    await page.waitForTimeout(200);
  }
  notes.push("title=" + (await page.title()));

  // 1) Export modal: new checkboxes exist.
  await page.click("#btnExport");
  await page.waitForTimeout(250);
  notes.push("exportRemember=" + (await page.locator("#exportRememberDir").count()));
  notes.push("exportAsk=" + (await page.locator("#exportAskAlways").count()));
  notes.push("exportHint=" + (await page.locator("#exportDestHint").textContent()));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  // 2) Inspector full-height: computed grid rows.
  const inspGrid = await page.evaluate(() => {
    const el = document.querySelector(".inspector");
    const cs = getComputedStyle(el);
    return { row: cs.gridRowStart + "/" + cs.gridRowEnd, col: cs.gridColumnStart + "/" + cs.gridColumnEnd };
  });
  notes.push("inspectorGrid=" + JSON.stringify(inspGrid));
  const tlGrid = await page.evaluate(() => {
    const el = document.querySelector(".timeline-panel");
    const cs = getComputedStyle(el);
    return { row: cs.gridRowStart + "/" + cs.gridRowEnd, col: cs.gridColumnStart + "/" + cs.gridColumnEnd };
  });
  notes.push("timelineGrid=" + JSON.stringify(tlGrid));
  // Inspector bottom should reach near the status bar (within 40px).
  const inspBottom = await page.evaluate(() => {
    const r = document.querySelector(".inspector").getBoundingClientRect();
    return { bottom: Math.round(r.bottom), vh: window.innerHeight };
  });
  notes.push("inspectorBottom=" + JSON.stringify(inspBottom));

  // 3) Ruler drag zoom: clips must NOT change, zoom must change.
  const rulerTest = await page.evaluate(async () => {
    const before = JSON.stringify(window.__aifimoraStore.get().clips.map((c) => c.id + "|" + c.start + "|" + c.duration));
    const ruler = document.querySelector(".tl-ruler");
    if (!ruler) return { noRuler: true };
    const r = ruler.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const down = new PointerEvent("pointerdown", { bubbles: true, button: 0, clientX: x, clientY: y, pointerId: 7 });
    ruler.dispatchEvent(down);
    // vertical drag up 120px => zoom in
    for (let i = 1; i <= 10; i++) {
      ruler.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, button: 0, clientX: x, clientY: y - i * 12, pointerId: 7 }));
    }
    ruler.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, button: 0, clientX: x, clientY: y - 120, pointerId: 7 }));
    await new Promise((res) => setTimeout(res, 250));
    const after = JSON.stringify(window.__aifimoraStore.get().clips.map((c) => c.id + "|" + c.start + "|" + c.duration));
    const zoomVal = document.getElementById("tlZoom")?.value;
    const seqDur = window.__aifimoraStore.sequenceDuration();
    return { clipsUnchanged: before === after, zoomVal, seqDur, rulerTitle: ruler.title };
  });
  notes.push("rulerZoom=" + JSON.stringify(rulerTest));

  // 4) Custom AI provider: add + add model + delete model + delete provider.
  await page.click('[data-inspector="aisettings"]');
  await page.waitForTimeout(250);
  notes.push("aiCustomName=" + (await page.locator("#aiCustomName").count()));
  notes.push("aiNewModel=" + (await page.locator("#aiNewModel").count()));
  await page.fill("#aiCustomName", "Test Gateway");
  await page.fill("#aiCustomBaseURL", "https://gateway.example/v1");
  await page.fill("#aiCustomModels", "test-model-a, test-model-b");
  await page.click("#btnAIAddProvider");
  await page.waitForTimeout(300);
  const aiAfterAdd = await page.evaluate(() => ({
    opts: [...document.querySelectorAll("#aiProviderSelect option")].map((o) => o.value + "=" + o.text),
    active: document.getElementById("aiProviderSelect").value,
    customRows: document.querySelectorAll("#aiCustomList .lut-row").length,
  }));
  notes.push("aiProviders=" + JSON.stringify(aiAfterAdd.opts));
  notes.push("aiActive=" + aiAfterAdd.active + " customRows=" + aiAfterAdd.customRows);
  await page.fill("#aiNewModel", "test-model-c");
  await page.click("#btnAINewModel");
  await page.waitForTimeout(300);
  notes.push("userModels=" + (await page.evaluate(() => [...document.querySelectorAll("#aiUserModels .lut-row .name")].map((e) => e.textContent).join(","))));
  // Remove the added model via first Remove button.
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("#aiUserModels .lut-row button")].filter((b) => b.textContent === "Remove");
    btns[0]?.click();
  });
  await page.waitForTimeout(200);
  notes.push("userModelsAfterDel=" + (await page.evaluate(() => [...document.querySelectorAll("#aiUserModels .lut-row .name")].map((e) => e.textContent).join(","))));
  // Delete the custom provider.
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll("#aiCustomList .lut-row button")].filter((b) => b.textContent === "Delete");
    const origConfirm = window.confirm;
    window.confirm = () => true;
    btns[0]?.click();
    window.confirm = origConfirm;
  });
  await page.waitForTimeout(300);
  notes.push("providersAfterDel=" + (await page.evaluate(() => [...document.querySelectorAll("#aiProviderSelect option")].map((o) => o.value).join(","))));

  // 5) Project save flow: silent-default path writes via bridge, no modal.
  const saveTest = await page.evaluate(async () => {
    const { setSavePrefs } = await import("./js/save-dialog.js");
    setSavePrefs("project", { defaultDir: "D:\\Videos\\AiFilmora", ask: false });
    const { saveProjectFlow } = await import("./js/save-dialog.js");
    const ok = await saveProjectFlow();
    return { ok, files: window.__savedFiles, modalOpen: document.getElementById("saveLocationModal")?.classList.contains("open") };
  });
  notes.push("projectSave=" + JSON.stringify(saveTest));

  // 6) Save dialog modal: ask-path shows modal with both checkboxes.
  const modalTest = await page.evaluate(async () => {
    const { setSavePrefs, askSaveLocation } = await import("./js/save-dialog.js");
    setSavePrefs("project", { ask: true });
    const p = askSaveLocation({ kind: "project", suggestedName: "Demo", ext: "aifimora.json" });
    await new Promise((r) => setTimeout(r, 200));
    const open = document.getElementById("saveLocationModal")?.classList.contains("open");
    const hasDefault = !!document.getElementById("saveLocDefault");
    const hasAsk = !!document.getElementById("saveLocAsk");
    document.getElementById("saveLocCancel")?.click();
    const res = await p;
    return { open, hasDefault, hasAsk, cancelledNull: res === null };
  });
  notes.push("saveModal=" + JSON.stringify(modalTest));

  await page.screenshot({ path: OUT, fullPage: false });
  console.log(notes.join("\n"));
  console.log("errors: " + (errors.length ? "\n  " + errors.join("\n  ") : "none"));
  await browser.close();
})().catch((e) => {
  console.error("VERIFY CRASH: " + (e?.stack || e));
  process.exit(1);
});
