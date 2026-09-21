/* Project Info show/hide toggle: mouse + keyboard, persistence, hidden sync, settings checkbox. */
const { chromium } = require("playwright");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = __dirname;
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml" };
const server = http.createServer((req, res) => {
  const file = path.resolve(root, "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true, channel: "chrome" });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
    await page.waitForFunction(() => window.__aifimoraStore && document.querySelectorAll("#transPresetGrid button").length === 4);
    await page.click("#frEmpty"); // dismiss first-run chooser (as verify-rebuild.cjs does)
    assert.equal(await page.locator("#projectInfo").isVisible(), true, "visible by default");
    assert.equal(await page.locator("#piToggle").innerText(), "Hide");
    await page.click("#piToggle");
    assert.equal(await page.locator("#projectInfo").isHidden(), true, "hidden after Hide");
    assert.equal(await page.locator("#piToggle").innerText(), "Show");
    assert.equal(await page.locator("#piToggle").getAttribute("aria-expanded"), "false");
    await page.screenshot({ path: path.join(root, "output-pi-toggle-hidden.png") });
    await page.evaluate(() => window.__aifimoraStore.set({ name: "While Hidden", width: 3840, height: 2160 }));
    assert.equal(await page.locator("#piName").innerText(), "While Hidden", "values keep syncing while hidden");
    await page.reload();
    await page.waitForFunction(() => window.__aifimoraStore && document.querySelectorAll("#transPresetGrid button").length === 4);
    assert.equal(await page.locator("#projectInfo").isHidden(), true, "hidden state persists across reload");
    await page.locator("#piToggle").focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("#projectInfo").isVisible(), true, "keyboard Enter shows the card");
    await page.screenshot({ path: path.join(root, "output-pi-toggle-shown.png") });
    assert.deepEqual(errors, []);
    console.log("PASS project-info toggle: Hide/Show, keyboard, persistence, hidden sync; no page errors.");
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });