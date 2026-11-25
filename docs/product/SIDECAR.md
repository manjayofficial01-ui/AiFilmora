# SIDECAR — the FFmpeg / Whisper bridge

**Status:** built and verified this cycle · **Added:** 2026-11-25 · **Branch:** `modernize/2026-11-25`

The browser build can decode mp4/webm/mp3 and nothing else. Real footage arrives
as MXF, MKV, ProRes, HEVC, AIFF, FLAC. The Electron build can reach three
external programs that Node does not ship:

| Tool | What it does for AiFilmora |
|---|---|
| `ffmpeg` | Converts footage the browser cannot decode; extracts poster frames; pulls 16 kHz mono audio out for the speech engine |
| `ffprobe` | Reads a file's real duration, codecs, frame rate, resolution — instead of guessing |
| `whisper` | Transcribes speech with **real word-level timings** |

This document is the operating manual: how the pieces fit, how to install the
tools, what the app says when they are missing, and — precisely — what was
verified and what was not.

---

## 1. Architecture

```
  renderer (js/media-sidecar.js)          main process                worker
  ─────────────────────────────           ──────────────               ──────
  importFileList(file)                    electron/main.cjs            media-service.cjs
    └─ ingestFile(file) ──IPC media:*──▶  sidecar/index.cjs ───────▶  (utilityProcess,
                                          · cache dir                  or plain Node child)
                                          · token registry            NDJSON over
                                          · app:// delivery            stdin/stdout
```

Four files:

| File | Role |
|---|---|
| `electron/sidecar/tools.cjs` | **Discovery only.** Finds the tools and reports what is missing. Never installs anything. |
| `electron/sidecar/media-service.cjs` | **The worker.** Owns the tools; implements `ping`, `analyze`, `convert`, `poster`, `transcribe`, `ingest`. |
| `electron/sidecar/index.cjs` | **The manager.** Starts the worker, correlates requests, owns the cache, registers files for delivery. |
| `js/media-sidecar.js` | **The renderer facade.** The only place the app asks "can we do real media work?". |

### The protocol

Newline-delimited JSON, one request per line:

```jsonc
{"id":"1","op":"analyze","params":{"path":"C:\\clips\\a.mxf"}}
{"id":"1","ok":true,"result":{ "duration":12.5, "video":{"codec":"prores", ...} }}
{"id":"1","ok":false,"error":{"code":"no-ffprobe","message":"ffprobe was not found, ..."}}
```

The same worker runs as an Electron `utilityProcess` (message port) or as a
plain Node child (stdio). Both are exercised — see §5.

### Two transports, one worker

- **Electron:** `utilityProcess.fork()` → the worker talks over `process.parentPort`.
- **Fallback:** `spawn(process.execPath, [service])` → the worker reads NDJSON on stdin.
  Used when the utility process cannot run the script, and by the test suite.

---

## 2. Operations

| Op | Does | Returns |
|---|---|---|
| `ping` | Reports which tools exist | `{ tools, canTranscode, canProbe, canTranscribe, missing[] }` |
| `analyze` | `ffprobe -show_format -show_streams` | duration, codecs, fps, resolution, `browserSafe`, `unsafeReason` |
| `convert` | Runs the conversion ladder | `{ path, rung, browserSafe, attempts[] }` |
| `poster` | `ffmpeg -frames:v 1` | `{ path, at, bytes }` |
| `transcribe` | 16 kHz WAV → whisper → parsed JSON | `{ segments[], words[], wordsEstimated, model }` |
| `ingest` | analyze → convert if needed → poster | the whole picture of one file |

### The conversion ladder

The point is to find the **cheapest** change that yields a file the browser can
actually play. Remuxing takes seconds; transcoding takes minutes.

| Rung | Command | When |
|---|---|---|
| `remux-hvc1` | `-c copy -tag:v hvc1` → `.mov` | HEVC sources: lossless, plays on Apple/Windows |
| `remux` | `-c copy` → `.mp4` | the source codec is already playable |
| `transcode` | `-c:v libx264 -crf 20 -pix_fmt yuv420p -c:a aac` → `.mp4` | everything else |
| *audio only* | `-c copy` → `.m4a`, then `-c:a aac` → `.m4a` | a file with no video stream |

A rung is only accepted when the output **probes clean and is browser-safe**.
A remux of ProRes is a valid file the browser still cannot play, so it is kept
as a fallback and the ladder keeps going. The result says which rung won and
what was tried.

What counts as "browser-safe" is judged on the codec **and** the container:
raw PCM is playable inside a WAV and nowhere else, so a 24-bit AIFF is
correctly reported as unplayable rather than waved through.

### Whisper output

whisper.cpp writes two shapes and the sidecar reads both:

- `-ojf` (full) → `result.transcription[].tokens[]` with per-token `offsets` → **real word timings**
- `-oj` (plain) → `transcription[].offsets` only → words are spread across the segment and flagged `wordsEstimated: true`

The sidecar tries `-ojf` first and falls back to `-oj`. It never presents
estimated word timings as measured ones.

---

## 3. Installing the tools

Nothing is installed automatically. The app finds what is already there.

**Search order** (first hit wins):

1. `AIFIMORA_FFMPEG` / `AIFIMORA_FFPROBE` / `AIFIMORA_WHISPER` / `AIFIMORA_WHISPER_MODEL` — an explicit path
2. a copy bundled next to the app (`bin/`)
3. the npm statics `ffmpeg-static` / `ffprobe-static`
4. `PATH`
5. the usual hand-installed locations (`C:\ffmpeg\bin`, `%LOCALAPPDATA%\Microsoft\WinGet\Links`, `C:\ProgramData\scoop\shims`, `/opt/homebrew/bin`, `/usr/local/bin`, …)

**On Windows, the easiest route:**

```powershell
winget install Gyan.FFmpeg
```

**Whisper** needs both the binary and a model file (`ggml-*.bin`). Point
`AIFIMORA_WHISPER` at `whisper-cli.exe` and `AIFIMORA_WHISPER_MODEL` at the
model.

**A tool may be a Node script.** If the resolved path ends in `.js`/`.cjs`/`.mjs`
it is run as `node <script> <args>`. This is how the test suite substitutes a
stand-in without installing anything.

---

## 4. When the tools are missing

**The app never claims work it did not do.** Every failure comes back as data
(`{ ok:false, code, error }`), never as an exception, and the UI reports it:

| Situation | What the user sees |
|---|---|
| Browser build, no sidecar | "Browser build — external media tools are not available." Import behaves exactly as before. |
| Sidecar present, ffmpeg absent | The import card is badged and dimmed: *"The browser cannot decode MXF — convert it to MP4/MOV or install the FFmpeg sidecar."* |
| Sidecar present, whisper absent | The transcript falls back to the sample transcript, **labelled** "Sample transcript — no speech engine is available on this machine." |
| Sidecar present, tools present | Real metadata, a real converted proxy, real word timings. |

---

## 5. What was verified, and what was not

**No FFmpeg, ffprobe or Whisper is installed on this machine**, and installing
system software is not something a test may do on its own. The suite therefore
drives the real sidecar against **stand-in tools** — the binaries are replaced,
everything else is real.

`verify-sidecar.cjs` → **48/48 checks pass**.

| Group | Checks | What is real |
|---|---|---|
| Discovery | 7 | env override, Node-script runner, "missing" reporting |
| Worker | 21 | the spawn, the command construction, ffprobe/ffmpeg/whisper output parsing, the conversion ladder (video **and** audio-only), the whisper `-ojf`→`-oj` fallback, the "tool missing" paths |
| Manager | 6 | request/response correlation, the cache, the token registry |
| **Electron** | 8 | **the real Electron shell**: the utility process starts, the renderer reaches it over IPC, a file is probed, a registered file is served over `app://` with **byte ranges**, an unregistered file is refused, no console errors |
| Browser build | 6 | the web build still works with no sidecar; the sample transcript is labelled |

### Not verified

- ❌ **A real FFmpeg was never run.** The command lines are constructed
  correctly and the output is parsed correctly, but real FFmpeg's behaviour on
  real footage is untested here.
- ❌ **A real Whisper was never run.** The JSON shapes are handled correctly
  against whisper.cpp's documented format, but no model was transcribed.
- ❌ `npm run dist` was not run; no packaged build was produced.

To close these gaps, install FFmpeg and Whisper, then re-run
`verify-sidecar.cjs` with `AIFIMORA_FFMPEG` / `AIFIMORA_FFPROBE` /
`AIFIMORA_WHISPER` pointing at the real binaries — the suite uses whichever
tools it finds.

---

## 6. Delivering files to the renderer

The renderer may not address the disk. Every file it may load is **registered**
with the manager, which returns a token; the token becomes a URL:

```
app://local/_media/f1_72db32f25c
```

Served by the **existing `app://` scheme** — the same scheme the page is
loaded from, so the URL is same-origin and no CORS handshake is needed.
Byte ranges are honoured, so `<video>` can seek inside a converted proxy.

> Two bugs were found and fixed here, both worth remembering:
> 1. `FileHandle.readableWebStream()` loses its file descriptor to the garbage
>    collector and the response dies mid-transfer (`ERR_FAILED`).
>    `fs.createReadStream()` owns its descriptor for the life of the stream.
> 2. A separate `media://` scheme was cross-origin to the `app://` page, so
>    `fetch()` was blocked. Same-origin delivery removed the problem entirely.

A proxy is cached in the app's `userData/media-cache`, so it survives a
restart. Its token does not — so on boot the renderer re-registers any cached
proxy (`rehydrateProxies()` in `js/media.js`) before anything uses it.

---

## 7. Where it is used

| Feature | Fallback when the sidecar is absent |
|---|---|
| **APP-006** — importing a file the browser cannot decode | The card is badged and dimmed with the reason (the Wave 0 behaviour) |
| **APP-009** — the transcript panel | The sample transcript, now labelled as a sample instead of passed off as real |
| Accurate duration / metadata | The browser's own probe, which is usually right and occasionally not |

---

## 8. Commands

```powershell
# the sidecar suite (46 checks, includes a real Electron run)
node verify-sidecar.cjs

# the focused Wave 0/1 suite (28 checks)
node verify-wave0.cjs

# the whole regression suite
node verify-all.cjs 'docs\product\POST-CHANGE.md'

# point the sidecar at real tools
$env:AIFIMORA_FFMPEG  = 'C:\ffmpeg\bin\ffmpeg.exe'
$env:AIFIMORA_FFPROBE = 'C:\ffmpeg\bin\ffprobe.exe'
$env:AIFIMORA_WHISPER = 'C:\whisper\whisper-cli.exe'
$env:AIFIMORA_WHISPER_MODEL = 'C:\whisper\models\ggml-base.bin'
npm start
```
