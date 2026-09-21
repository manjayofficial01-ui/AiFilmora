/* Optional Electron shell for AiFilmora */
const { app, BrowserWindow, dialog, ipcMain, protocol, net } = require("electron");
const fs = require("node:fs");
const path = require("path");
const { pathToFileURL } = require("node:url");

const inAsar = __dirname.includes(".asar");
/* In the packaged build __dirname lives inside app.asar; files under
 * resources/app.asar.unpacked (large assets) sit beside the archive, so map
 * requests across the boundary. In dev this is just the project root. */
const APP_ROOT = inAsar ? process.resourcesPath : path.join(__dirname, "..");
const UNPACKED_ROOT = inAsar ? path.join(process.resourcesPath, "app.asar.unpacked") : null;

/* The renderer fetch()es bundled assets (LUT .CUBE files, manifests, audio samples).
 * fetch() is blocked on file:// origins, so the window loads via a standard app://
 * scheme with fetch support instead of loadFile(). */
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
    filters: [{ name: "Media", extensions: ["mp4", "mov", "webm", "mp3", "wav", "png", "jpg", "jpeg"] }],
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
};

app.whenReady().then(() => {
  /* Serve the bundled app over app:// so relative asset fetches succeed.
   * Files are read with fs (which understands asar archives) instead of
   * net.fetch(file://), which cannot address paths inside app.asar. */
  protocol.handle("app", async (request) => {
    let file = null;
    try {
      const { pathname } = new URL(request.url);
      const rel = decodeURIComponent(pathname).replace(/^\/+/, "");
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