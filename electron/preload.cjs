const { contextBridge, ipcRenderer } = require("electron");

/* The sidecar takes file bytes as an ArrayBuffer. Electron's IPC copies them
 * with the structured clone algorithm, so they must be handed over as a
 * typed array rather than a plain object. */
function withBytes(payload) {
  const p = payload || {};
  let bytes = null;
  if (p.bytes) {
    if (p.bytes instanceof ArrayBuffer) bytes = new Uint8Array(p.bytes);
    else if (ArrayBuffer.isView(p.bytes)) bytes = new Uint8Array(p.bytes.buffer, p.bytes.byteOffset, p.bytes.byteLength);
  }
  return {
    name: p.name || "",
    path: p.path || "",
    at: p.at || 0,
    language: p.language || "",
    bytes,
    // The encoder's own settings travel beside the bytes.
    opts: p.opts && typeof p.opts === "object" ? p.opts : {},
  };
}

/* One source of truth for the version: package.json, read by the main
 * process and handed over as a command-line argument (a sandboxed preload
 * cannot read files itself). The status bar, the About panel and the
 * release notes all read it from here, so it cannot drift the way the old
 * hard-coded strings did. */
const APP_VERSION = (() => {
  try {
    const arg = process.argv.find((a) => a.startsWith("--aifimora-version="));
    return arg ? arg.slice("--aifimora-version=".length) : "";
  } catch {
    return "";
  }
})();

contextBridge.exposeInMainWorld("aifimoraDesktop", {
  version: APP_VERSION,
  openFiles: () => ipcRenderer.invoke("dialog:openFiles"),
  // Returns the chosen full path (folder + file name), or null when cancelled.
  saveVideo: (opts) => ipcRenderer.invoke("dialog:saveVideo", opts),
  openFolder: () => ipcRenderer.invoke("dialog:openFolder"),
  // Project save/load + raw file write (used by Save dialog + real video export).
  saveProject: (opts) => ipcRenderer.invoke("dialog:saveProject", opts),
  openProject: () => ipcRenderer.invoke("dialog:openProject"),
  writeFile: (targetPath, dataBase64) => ipcRenderer.invoke("fs:writeFile", targetPath, dataBase64),
  platform: process.platform,

  /* The media sidecar: ffmpeg / ffprobe / whisper.
   *
   * Every call resolves with plain data. A missing tool comes back as
   * { ok: false, code, error } rather than an exception, so the UI can
   * report the truth instead of guessing. */
  media: {
    capabilities: () => ipcRenderer.invoke("media:capabilities"),
    ingest: (payload) => ipcRenderer.invoke("media:ingest", withBytes(payload)),
    analyze: (payload) => ipcRenderer.invoke("media:analyze", withBytes(payload)),
    convert: (payload) => ipcRenderer.invoke("media:convert", withBytes(payload)),
    // Encode a recorded capture into the file the export sheet promised.
    // The bytes go one way; only a path and a size come back.
    encode: (payload) => ipcRenderer.invoke("media:encode", withBytes(payload)),
    poster: (payload) => ipcRenderer.invoke("media:poster", withBytes(payload)),
    transcribe: (payload) => ipcRenderer.invoke("media:transcribe", withBytes(payload)),
    // Re-address a file the sidecar already made (e.g. a proxy from a
    // previous session) without running any tool again.
    register: (absPath) => ipcRenderer.invoke("media:register", String(absPath || "")),
    // Tokens address files the main process is willing to serve. They are
    // served on the app:// scheme, so the URL is same-origin with the page.
    url: (token) => (token ? `app://local/_media/${token}` : ""),
  },
});
