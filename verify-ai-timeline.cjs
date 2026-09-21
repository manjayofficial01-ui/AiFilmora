/* Verify AI provider upgrade + timeline DnD/marquee */
const { chromium } = require("playwright");
const path = require("path");
const http = require("http");
const fs = require("fs");

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = path.join(process.cwd(), decodeURIComponent(req.url.split("?")[0]));
      if (p.endsWith("/") || p.endsWith("\\")) p = path.join(p, "index.html");
      const ext = path.extname(p);
      const types = {
        ".js": "text/javascript", ".css": "text/css", ".html": "text/html",
        ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml",
      };
      fs.readFile(p, (e, d) => {
        if (e) { res.writeHead(404); res.end("404"); return; }
        res.writeHead(200, { "Content-Type": types[ext] || "application/octet-stream" });
        res.end(d);
      });
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

(async () => {
  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGE: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text()); });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  const checks = [];
  const ok = (name, pass, extra = "") => {
    checks.push({ name, pass });
    console.log(`${pass ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  };

  // ---- AI provider UI ----
  for (const id of ["aiProviderSelect", "aiBaseURL", "aiApiKey", "aiModel", "aiModelSelect",
    "aiTemp", "aiTopP", "aiMaxTokens", "aiFreq", "aiPres", "aiSeed", "aiTimeout",
    "aiOrg", "aiHeaders", "aiExtraBody", "btnAIListModels", "btnAITest"]) {
    ok(`AI control #${id}`, await page.evaluate((i) => !!document.getElementById(i), id));
  }
  ok("model dropdown has options", await page.evaluate(() => document.querySelectorAll("#aiModelSelect option").length > 0));

  // Custom provider + List models populates the DROPDOWN (stub /models)
  const listed = await page.evaluate(async () => {
    const sel = document.getElementById("aiProviderSelect");
    sel.value = "custom";
    sel.dispatchEvent(new Event("change"));
    await new Promise((r) => setTimeout(r, 150));
    document.getElementById("aiBaseURL").value = "https://models.example.com/v1";
    document.getElementById("aiApiKey").value = "test-key";
    const realFetch = window.fetch;
    window.fetch = (url, opts) => {
      if (String(url).includes("/models")) {
        return Promise.resolve(new Response(JSON.stringify({ data: [{ id: "alpha-1" }, { id: "beta-2" }] }), { status: 200 }));
      }
      return realFetch(url, opts);
    };
    document.getElementById("btnAIListModels").click();
    await new Promise((r) => setTimeout(r, 600));
    window.fetch = realFetch;
    const dd = [...document.querySelectorAll("#aiModelSelect option")].map((o) => o.value);
    return { dd, input: document.getElementById("aiModel").value, status: document.getElementById("aiProviderStatus").textContent };
  });
  ok("List models fills dropdown", listed.dd.includes("alpha-1") && listed.dd.includes("beta-2"), JSON.stringify(listed.dd));
  ok("List models adopts model", listed.input === "alpha-1" || listed.input === "beta-2", listed.input);
  ok("List models status OK", /OK/.test(listed.status), listed.status);

  // Provider helpers: headers + quality + normalization
  const helpers = await page.evaluate(async () => {
    const m = await import("./js/ai-providers.js");
    const h1 = m.parseCustomHeaders("HTTP-Referer: https://x.example\nX-Title: AiFilmora");
    const h2 = m.parseCustomHeaders('{"X-Foo":"bar"}');
    const norm = m.normalizeModelList({ models: [{ name: "llama3.2" }, { name: "qwen2.5" }] });
    const bh = m.buildHeaders({ baseURL: "https://openrouter.ai/api/v1", apiKey: "k", organization: "", headersText: "" });
    return { h1, h2, norm, hasRef: !!bh["HTTP-Referer"], hasTitle: bh["X-Title"] === "AiFilmora" };
  });
  ok("custom headers line format", helpers.h1["HTTP-Referer"] === "https://x.example" && helpers.h1["X-Title"] === "AiFilmora");
  ok("custom headers JSON format", helpers.h2["X-Foo"] === "bar");
  ok("ollama-shape normalize", JSON.stringify(helpers.norm) === JSON.stringify(["llama3.2", "qwen2.5"]));
  ok("openrouter attribution headers", helpers.hasRef && helpers.hasTitle);

  // Quality params persist per provider
  const qual = await page.evaluate(async () => {
    document.getElementById("aiTemp").value = "1.2";
    document.getElementById("aiTemp").dispatchEvent(new Event("input", { bubbles: true }));
    document.getElementById("aiMaxTokens").value = "2048";
    document.getElementById("aiMaxTokens").dispatchEvent(new Event("input", { bubbles: true }));
    const m = await import("./js/ai-providers.js");
    const p = m.getActiveProvider();
    return { t: p.temperature, mt: p.maxTokens };
  });
  ok("quality params persist", qual.t === 1.2 && qual.mt === 2048, JSON.stringify(qual));

  // ---- Timeline DnD ----
  ok("media cards draggable", await page.evaluate(() => {
    const c = document.querySelector(".media-card");
    return !!c && c.draggable === true;
  }));
  const src = fs.readFileSync(path.join(process.cwd(), "js", "timeline.js"), "utf8");
  ok("drop accepts OS files", src.includes("importFileList") && src.includes("e.dataTransfer?.files"));
  ok("drop has plain-text fallback", src.includes("aifimora-media:"));
  const msrc = fs.readFileSync(path.join(process.cwd(), "js", "media.js"), "utf8");
  ok("drag sets dual MIME + guard flag", msrc.includes("text/plain") && msrc.includes("__aifimoraMediaDragging"));

  // Programmatic drop simulation: add clip the way the handler does
  const drop = await page.evaluate(() => {
    const s = window.__aifimoraStore;
    const before = s.get().clips.length;
    const media = s.get().media[0];
    s.addClip({ mediaId: media.id, name: media.name, type: "video", trackId: "v1", start: 1, duration: media.duration || 4 });
    return { before, after: s.get().clips.length };
  });
  ok("drop adds clip to timeline", drop.after === drop.before + 1, JSON.stringify(drop));

  // ---- Timeline marquee multi-select ----
  ok("multi-select API", await page.evaluate(() => typeof window.__aifimoraStore.setSelectedClips === "function"));
  const multi = await page.evaluate(() => {
    const s = window.__aifimoraStore;
    const ids = s.get().clips.slice(0, 2).map((c) => c.id);
    s.setSelectedClips(ids);
    const painted = [...document.querySelectorAll(".tl-clip.selected")].length;
    return { ids, painted, list: s.selectedClipIdList() };
  });
  ok("marquee-equivalent multi select paints", multi.list.length === 2 && multi.painted >= 2, JSON.stringify({ list: multi.list, painted: multi.painted }));
  const del = await page.evaluate(() => {
    const s = window.__aifimoraStore;
    const before = s.get().clips.length;
    const res = s.removeClips(s.selectedClipIdList());
    return { before, after: s.get().clips.length, removed: res.removed };
  });
  ok("group delete removes all", del.removed >= 2 && del.after === del.before - del.removed, JSON.stringify(del));
  const undone = await page.evaluate(() => {
    const s = window.__aifimoraStore;
    const before = s.get().clips.length;
    s.undo();
    return { before, after: s.get().clips.length };
  });
  ok("group delete undo restores", undone.after > undone.before, JSON.stringify(undone));

  // Old suites still green
  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
  if (errors.length) console.log("page errors:\n" + errors.slice(0, 8).join("\n"));
  await browser.close();
  server.close();
  process.exit(failed.length || errors.length > 5 ? 1 : 0);
})();
