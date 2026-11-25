/* Optional Electron shell for AiFilmora */
const { app, BrowserWindow, dialog, ipcMain, protocol, net } = require("electron");
const fs = require("node:fs");
const path = require("path");
const { pathToFileURL } = require("node:url");

const sidecar = require("./sidecar/index.cjs");

const inAsar = __dirname.includes(".asar");
/* In the packaged build __dirname lives inside app.asar; files under
 * resources/app.asar.unpacked (large assets) sit beside the archive, so map
 * requests across the boundary. In dev this is just the project root. */
const APP_ROOT = inAsar ? process.resourcesPath : path.join(__dirname, "..");
const UNPACKED_ROOT = inAsar ? path.join(process.resourcesPath, "app.asar.unpacked") : null;

/* The renderer fetch()es bundled assets (LUT .CUBE files, manifests, audio samples).
 * fetch() is blocked on file:// origins, so the window loads via a standard app://
 * scheme with fetch support instead of loadFile().
 *
 * The same scheme carries the sidecar's cache under /_media/<token>. Using
 * app:// rather than a second scheme keeps those URLs same-origin with the
 * page, so no CORS handshake is needed for a converted proxy to load. */
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#0b0d10",
    title: "AiFilmora",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL("app://local/index.html");
}

/* ---- IPC ---- */

ipcMain.handle("dialog:openFiles", async () => {
  const res = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [
      // The wide list is what the FFmpeg sidecar can actually open; the
      // browser-only build can only play a small part of it, and says so
      // on the card when a file cannot be decoded.
      { name: "Media", extensions: ["mp4", "mov", "m4v", "webm", "mkv", "avi", "mxf", "mpg", "mpeg", "wmv", "3gp"] },
      { name: "Audio", extensions: ["mp3", "wav", "aac", "m4a", "flac", "ogg", "opus", "wma", "aiff", "aif"] },
      { name: "Images", extensions: ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"] },
      { name: "All files", extensions: ["*"] },
    ],
  });
  return res.filePaths || [];
});

/* Ask where to save the rendered video — returns the full path, or null if cancelled. */
ipcMain.handle("dialog:saveVideo", async (_e, opts = {}) => {
  const ext = (opts.ext || "mp4").replace(/^\./, "");
  const res = await dialog.showSaveDialog({
    title: opts.title || "Save video as",
    defaultPath: opts.defaultPath || "",
    buttonLabel: "Save",
    filters: [{ name: ext.toUpperCase() === "GIF" ? "Animated GIF" : "Video", extensions: [ext] }],
    properties: ["showOverwriteConfirmation", "createDirectory"],
  });
  return res.canceled ? null : res.filePath;
});

/* Pick a folder only (used by the export modal's Browse button). */
ipcMain.handle("dialog:openFolder", async () => {
  const res = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
  });
  return res.canceled ? null : res.filePaths[0];
});

/* Ask where to save the project file — returns the full path, or null if cancelled. */
ipcMain.handle("dialog:saveProject", async (_e, opts = {}) => {
  const res = await dialog.showSaveDialog({
    title: opts.title || "Save project as",
    defaultPath: opts.defaultPath || "Untitled Project.aifimora.json",
    buttonLabel: "Save",
    filters: [
      { name: "AiFilmora project", extensions: ["aifimora.json", "json"] },
      { name: "All files", extensions: ["*"] },
    ],
    properties: ["showOverwriteConfirmation", "createDirectory"],
  });
  return res.canceled ? null : res.filePath;
});

/* Pick an existing project file and read it — returns { path, content } or null. */
ipcMain.handle("dialog:openProject", async () => {
  const res = await dialog.showOpenDialog({
    title: "Open project",
    properties: ["openFile"],
    filters: [
      { name: "AiFilmora project", extensions: ["aifimora.json", "json"] },
      { name: "All files", extensions: ["*"] },
    ],
  });
  if (res.canceled || !res.filePaths?.length) return null;
  try {
    const content = fs.readFileSync(res.filePaths[0], "utf-8");
    return { path: res.filePaths[0], content };
  } catch (err) {
    return { path: res.filePaths[0], content: null, error: err?.message || String(err) };
  }
});

/* Write a renderer-generated file (project JSON, exported video bytes) to disk.
 * `dataBase64` keeps the IPC payload JSON-safe for binary blobs. */
ipcMain.handle("fs:writeFile", async (_e, targetPath, dataBase64) => {
  try {
    if (!targetPath || typeof targetPath !== "string") return { ok: false, error: "No path" };
    const buf = Buffer.from(String(dataBase64 || ""), "base64");
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, buf);
    return { ok: true, path: targetPath, bytes: buf.length };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
});

/* ---- Media sidecar ----
 *
 * The browser build cannot decode MXF, MKV, ProRes or HEVC, and cannot
 * transcribe speech. The sidecar can. These handlers are the only way the
 * renderer reaches those tools, and every one of them answers with plain
 * data — including the failures, so the UI can say what is missing.
 */
ipcMain.handle("media:capabilities", async () => sidecar.capabilities());
ipcMain.handle("media:ingest", async (_e, p) => sidecar.ingest(p || {}));
ipcMain.handle("media:analyze", async (_e, p) => sidecar.analyze(p || {}));
ipcMain.handle("media:convert", async (_e, p) => sidecar.convert(p || {}));
ipcMain.handle("media:encode", async (_e, p) => sidecar.encode({ ...(p?.opts || {}), bytes: p?.bytes, name: p?.name, path: p?.path }));
ipcMain.handle("media:poster", async (_e, p) => sidecar.poster(p || {}));
ipcMain.handle("media:transcribe", async (_e, p) => sidecar.transcribe(p || {}));
ipcMain.handle("media:register", async (_e, absPath) => {
  const token = sidecar.registerFile(String(absPath || ""));
  return { ok: !!token, token };
});

/* ---- Lifecycle ---- */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".cjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".cube": "text/plain; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".m4v": "video/x-m4v",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
};

/**
 * Serve a file the sidecar registered (a converted proxy, a poster frame).
 *
 * The renderer may only load files it was given a token for — it cannot
 * address the disk by path. Byte ranges are honoured so <video> can seek
 * inside a converted proxy.
 */
async function serveRegisteredMedia(request, token) {
  const file = sidecar.resolveToken(token);
  if (!file) return new Response("Not found", { status: 404 });
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  const type = MIME[path.extname(file).toLowerCase()] || "application/octet-stream";

  const range = request.headers.get("Range");
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(String(range).trim()) : null;
  if (m) {
    let start = m[1] === "" ? null : parseInt(m[1], 10);
    let end = m[2] === "" ? null : parseInt(m[2], 10);
    if (start === null && end !== null) {
      start = Math.max(0, stat.size - end);
      end = stat.size - 1;
    } else if (start === null) {
      start = 0;
    }
    if (end === null || end >= stat.size) end = stat.size - 1;
    if (start > end || start >= stat.size) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${stat.size}` },
      });
    }
    // createReadStream owns its file descriptor for the life of the stream.
    // (FileHandle.readableWebStream() loses the descriptor to the garbage
    // collector and the response dies mid-transfer.)
    const stream = fs.createReadStream(file, { start, end });
    return new Response(stream, {
      status: 206,
      headers: {
        "Content-Type": type,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
      },
    });
  }

  const stream = fs.createReadStream(file);
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Content-Length": String(stat.size),
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache",
    },
  });
}

app.whenReady().then(() => {
  /* The sidecar's cache belongs to the app, not to the temp folder: a
   * converted proxy should survive a restart of the app but not leak into
   * the system temp dir forever. */
  try {
    sidecar.setCacheRoot(path.join(app.getPath("userData"), "media-cache"));
  } catch { /* keep the temp default */ }
  /* Serve the bundled app over app:// so relative asset fetches succeed.
   * Files are read with fs (which understands asar archives) instead of
   * net.fetch(file://), which cannot address paths inside app.asar. */
  protocol.handle("app", async (request) => {
    let file = null;
    try {
      const { pathname } = new URL(request.url);
      const rel = decodeURIComponent(pathname).replace(/^\/+/, "");
      // The sidecar's cache lives outside the app folder, so it is addressed
      // by token rather than by path. Serving it on the same scheme as the
      // page keeps the URL same-origin — no CORS handshake needed.
      if (rel.startsWith("_media/")) {
        return await serveRegisteredMedia(request, rel.slice("_media/".length));
      }
      // Prefer unpacked large assets; everything else lives inside app.asar (dev: plain files).
      if (UNPACKED_ROOT && fs.existsSync(path.join(UNPACKED_ROOT, rel))) {
        file = path.join(UNPACKED_ROOT, rel);
      } else if (inAsar) {
        file = path.join(APP_ROOT, "app.asar", rel);
      } else {
        file = path.join(APP_ROOT, rel);
      }
      const resolved = path.resolve(file);
      const okRoot =
        resolved.toLowerCase().startsWith(APP_ROOT.toLowerCase() + path.sep) ||
        (UNPACKED_ROOT && resolved.toLowerCase().startsWith(UNPACKED_ROOT.toLowerCase() + path.sep));
      if (!okRoot) return new Response("Forbidden", { status: 403 });
      let data;
      try { data = fs.readFileSync(resolved); }
      catch { return new Response("Not found: " + rel, { status: 404 }); }
      const type = MIME[path.extname(resolved).toLowerCase()] || "application/octet-stream";
      return new Response(data, { status: 200, headers: { "Content-Type": type } });
    } catch (err) {
      if (process.env.AIFIMORA_DEBUG_PROTOCOL) {
        // eslint-disable-next-line no-console
        console.error(`[app://] ${request.url} -> 400 (${file || "?"}): ${err?.message || err}`);
      }
      return new Response("Bad request", { status: 400 });
    }
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  sidecar.stop();
});