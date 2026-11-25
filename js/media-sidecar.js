/* js/media-sidecar.js — the renderer's view of the media sidecar.
 *
 * The browser build has no ffmpeg, no ffprobe and no whisper. The Electron
 * build has a sidecar that does. This module is the seam:
 *
 *   browser build   -> every call returns null / { available: false }
 *   electron build  -> the call goes to ffmpeg, ffprobe or whisper
 *
 * Nothing here throws. When a tool is missing the caller gets an honest
 * answer and the UI says what is missing, rather than quietly pretending the
 * work happened.
 */

/** Bigger than this and copying the file into the sidecar is not worth it. */
const MAX_TRANSFER_BYTES = 512 * 1024 * 1024;

let cachedCaps = null;

function mediaApi() {
  if (typeof window === "undefined") return null;
  return window.aifimoraDesktop?.media || null;
}

/** Is the desktop shell present at all? */
export function hasDesktopBridge() {
  return !!mediaApi();
}

/**
 * What the sidecar can do right now.
 * @returns {Promise<{available:boolean, reason:string, canTranscode:boolean,
 *   canProbe:boolean, canTranscribe:boolean, missing:string[]}>}
 */
export async function sidecarCapabilities({ refresh = false } = {}) {
  const api = mediaApi();
  if (!api) {
    return {
      available: false,
      reason: "Browser build — external media tools are not available.",
      canTranscode: false,
      canProbe: false,
      canTranscribe: false,
      missing: ["ffmpeg", "ffprobe", "whisper"],
    };
  }
  if (cachedCaps && !refresh) return cachedCaps;
  try {
    const res = await api.capabilities();
    cachedCaps = {
      available: !!res?.available,
      reason: res?.reason || "",
      canTranscode: !!res?.canTranscode,
      canProbe: !!res?.canProbe,
      canTranscribe: !!res?.canTranscribe,
      missing: res?.missing || [],
      tools: res?.tools || null,
      worker: res?.worker || "",
    };
  } catch (err) {
    cachedCaps = {
      available: false,
      reason: String(err?.message || err),
      canTranscode: false,
      canProbe: false,
      canTranscribe: false,
      missing: [],
    };
  }
  return cachedCaps;
}

/** The URL that plays a file the main process registered. */
export function sidecarUrl(token) {
  const api = mediaApi();
  if (!api || !token) return "";
  try {
    return api.url(token);
  } catch {
    return "";
  }
}

async function fileBytes(file) {
  if (!file) return null;
  if (file.size > MAX_TRANSFER_BYTES) return null;
  try {
    return await file.arrayBuffer();
  } catch {
    return null;
  }
}

/**
 * Hand a file to the sidecar and learn what it is.
 *
 * @returns {Promise<object|null>} null when there is no sidecar or the file is
 *   too large to hand over; the caller then keeps its own behaviour.
 */
export async function ingestFile(file, { at = 1 } = {}) {
  const api = mediaApi();
  if (!api) return null;
  const caps = await sidecarCapabilities();
  if (!caps.available) return null;
  if (file && file.size > MAX_TRANSFER_BYTES) {
    return {
      ok: false,
      code: "too-large",
      error: `That file is ${Math.round((file.size || 0) / 1048576)} MB — too large to hand to the media tools.`,
    };
  }
  const bytes = await fileBytes(file);
  if (!bytes) return null;
  try {
    return await api.ingest({ name: file?.name || "", bytes, at });
  } catch (err) {
    return { ok: false, code: "ipc-failed", error: String(err?.message || err) };
  }
}

/**
 * Transcribe speech with real word timings.
 * @returns {Promise<object|null>} null when no sidecar is available.
 */
export async function transcribeFile(file, { language = "" } = {}) {
  const api = mediaApi();
  if (!api) return null;
  const caps = await sidecarCapabilities();
  if (!caps.available || !caps.canTranscribe) return null;
  const bytes = await fileBytes(file);
  if (!bytes) {
    return {
      ok: false,
      code: "too-large",
      error: "That file is too large to hand to the transcription engine.",
    };
  }
  try {
    return await api.transcribe({ name: file?.name || "", bytes, language });
  } catch (err) {
    return { ok: false, code: "ipc-failed", error: String(err?.message || err) };
  }
}

/**
 * Re-register a proxy that was made in an earlier session, so its URL works
 * again after a restart.
 */
export async function registerProxy(absPath) {
  const api = mediaApi();
  if (!api || !absPath) return "";
  try {
    const res = await api.register(absPath);
    return res?.ok ? res.token : "";
  } catch {
    return "";
  }
}

/** Forget the cached capability answer (used after the user installs a tool). */
export function resetSidecarCache() {
  cachedCaps = null;
}
