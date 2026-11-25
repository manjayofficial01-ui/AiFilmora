# PROGRESS — AiFilmora

**Last cycle:** 2026-11-25 · **Mode:** `teardown` + `modernize` build (master-application path), then a `/best-suggestion` audit, then **APP-037 "Real MP4 export"** (the audit's §4.1), then **bundling `ffmpeg-static` / `ffprobe-static`** (the open packaging decision)
**Workspace:** `D:\000000 Lab\AiFimora` · **Branch:** `modernize/2026-11-25` (created this cycle, not pushed)
**Base commit:** `ab3e97c` (AiFilmora 2.2.7) · **Cycle commits:** `a13c155`, `366afe4`, `1fb4aa1`, `30e2d67`, `6d3a48d`, `5d75f13`, `e66a206`, `533695d` (audit fixes), `063c186` (suite), `1f7aa54` (regression run), `83d95ff` (report), `cde3ffc` (cycle log), **`2a81a30` (APP-037 — the real export)**

---

## Capabilities (observed this cycle)

| Capability | State | Evidence |
|---|---|---|
| Git | ✅ present, clean tree before this cycle | `git status --porcelain` → only this cycle's new files |
| Node + Playwright | ✅ present | `node_modules/playwright`, chromium-1243 in `%LOCALAPPDATA%\ms-playwright` |
| Dev server | ✅ works | `node server.cjs` → `http://127.0.0.1:8765`, HTTP 200 |
| App renders | ✅ | headless Chromium 1680×1000 → **0 console errors** |
| Electron shell | ✅ **launches and runs** | Playwright `_electron.launch` → the window loads, `app://` serves assets, the sidecar starts as a `utilityProcess`. `verify-electron.cjs` is a **pre-existing** failure: it clicks `#frEmpty` twice and the second click times out because the modal is already closed. |
| Media tools | ✅ **bundled with the app** | `ffmpeg-static@5.3.0` (FFmpeg 6.1.1) and `ffprobe-static@3.1.0` are now `dependencies`. The sidecar finds them in `node_modules` (dev) and in `resources/app.asar.unpacked/node_modules` (packaged). An explicit path (`AIFIMORA_FFMPEG`) still wins; `AIFIMORA_DISABLE_BUNDLED_TOOLS=1` makes the bundled ones stand down so a copy on `PATH` is used instead. |
| Test suite | ✅ run | `verify-all.cjs` → 54 suites; `verify-wave0.cjs` → 54 checks; `verify-sidecar.cjs` → **118 checks** (was 87), including **27 against the real FFmpeg** |
| Build / packaging | ✅ **run** | `npx electron-builder --dir` and `--win nsis` were run and measured. NSIS installer **187.8 MB** (152.5 MB without the bundled binaries → **+35.3 MB**); portable 152.2 MB; `win-unpacked` 591.6 MB. |
| Network | ✅ | GitHub clone + fetch both succeeded |
| Subagents | ✅ 6 used | `explore` ×4 (UI/design, AI-MCP, engine, self-audit) + `worker` ×2 (media-analysis, loudness) |

## Stage log

| Stage | Status | Output |
|---|---|---|
| 0B Baseline | ✅ done | 52-suite baseline → `docs/product/BASELINE.md` (**39/52 green, 13 failing before any change**) |
| 1 Concept | ⏭️ skipped | Existing app with a stated vision in `ARCHITECTURE.md`; the concept was **derived**, not invented |
| 2 Research + teardown | ✅ done | `RESEARCH-EDITROOM.md` — Editroom source teardown + 52-capability matrix |
| 3 Sketch | ✅ done | `SKETCH.md` — 5 wireframes + IA + data-model changes; `design/timeline-v2-mock.html` renders both states |
| 4 Architecture | ✅ done | 4 new modules: `speed-ramp.js`, `media-analysis.js`, `waveform-render.js`, `loudness.js` — plus the media sidecar (`electron/sidecar/`) |
| 5 Prototype | ✅ done | `design/timeline-v2-mock.html` — interactive mock, both states rendered and visually QA'd |
| 6 Build | 🟡 **partial** | **Wave 0 complete (6/6). Wave 1: 3 of 4 done (filmstrip, waveform, real ASR + sidecar). APP-037 (the export) built this cycle, and the bundled FFmpeg landed with it. Waves 2–5 not started.** |
| 7 Test/fix/retest | ✅ done | `verify-wave0.cjs` **54/54**; `verify-sidecar.cjs` **118/118** (incl. a real Electron run, the encoder round trip **and a real FFmpeg 6.1.1 run**); full suite — see the verification table |
| 8 Harden | 🟡 partial | **8 product bugs** (audit) **+ 2 more** (the export's frozen-frame tail and the operator-precedence bug in the export defaults) **+ 2 latent sidecar bugs** (typed-array bytes decoded as base64; the bundled static resolving to the package's `index.js` instead of the binary) found and fixed |
| 9 Release | ⏭️ not started | |

## What was actually built this cycle

### Wave 0 — truth fixes (6/6 done, all `done-verified`)

| ID | Change | File |
|---|---|---|
| APP-001 | One canonical marker shape `{id, t, end?, name, color}`; point markers draw as a flag on the ruler, range markers keep the bar. Legacy shapes migrate on load. | `js/state.js`, `js/timeline.js`, `js/filmora-parity.js`, `js/ai-studio.js`, `css/timeline.css` |
| APP-002 | The speed-ramp curve is now honoured: the player integrates the varying rate instead of using a constant one, and a ramp is applied atomically so the clip keeps covering the same source media. | `js/speed-ramp.js` (new), `js/player.js`, `js/state.js`, `js/speed-panel.js` |
| APP-003 | Ripple trim moves every track when nothing is selected, and only the selected clips' tracks (plus linked partners) when something is. | `js/state.js` |
| APP-004 | Loudness is measured with ITU-R BS.1770-4 instead of a fabricated gain. Verified: full-scale sine −3.004 LUFS, EBU R128 reference −23.0 → −22.993. | `js/loudness.js` (new), `js/volume-panel.js`, `index.html` |
| APP-005 | The store fingerprints its undoable state and takes a snapshot itself when a caller forgets. **Timeline drags — which never pushed undo at all — now collapse into ONE undo step.** | `js/state.js` |
| APP-006 | Real MIME types instead of lies (MKV was reported as `video/mp4`); a file the browser cannot decode is badged and dimmed instead of wearing a healthy thumbnail. | `js/media.js`, `js/state.js`, `css/app.css` |

### Wave 1 — media understanding (3 of 4 done)

| ID | Change | File |
|---|---|---|
| APP-007 | Video clips carry **real filmstrip frames** on the timeline, extracted by seeking a `<video>` and drawing to canvas, cached per media id. | `js/media-analysis.js` (new), `js/timeline.js` |
| APP-008 | Audio and video clips carry the **real decoded waveform**. The CSS-gradient placeholder is gone; silence renders as a thin line. | `js/waveform-render.js` (new), `js/media-analysis.js`, `js/timeline.js`, `css/timeline.css` |
| APP-009 | Real ASR with **real word timings**, through an Electron sidecar. With no speech engine the panel falls back to a sample transcript that is now **labelled as a sample** instead of passed off as real. | `electron/sidecar/*` (new), `js/media-sidecar.js` (new), `js/text-edit.js`, `js/media.js` |
| APP-010 | Scene tags + semantic search | **not started** |

### The media sidecar

`electron/sidecar/` — an FFmpeg / ffprobe / Whisper worker that runs as an
Electron `utilityProcess` (or a plain Node child) and speaks newline-delimited
JSON. It **discovers** the tools and never installs them; when they are absent
it says which are missing and the app behaves exactly as the browser build.

| Piece | Role |
|---|---|
| `electron/sidecar/tools.cjs` | Discovery: env override → bundled → npm statics → `PATH` → hand-installed dirs |
| `electron/sidecar/media-service.cjs` | The worker: `ping`, `analyze`, `convert`, `poster`, `transcribe`, `ingest` |
| `electron/sidecar/index.cjs` | The manager: worker lifecycle, request correlation, cache, token registry |
| `js/media-sidecar.js` | The renderer facade — the only place the app asks "can we do real media work?" |
| `electron/main.cjs` | `media:*` IPC + delivery of registered files over `app://local/_media/<token>` (same-origin, byte ranges honoured) |
| `electron/preload.cjs` | The renderer's door to the sidecar |

Full manual, including exactly what was and was not verified:
**`docs/product/SIDECAR.md`**.

Two bugs worth remembering, both found by the suite rather than by reading:
`FileHandle.readableWebStream()` loses its file descriptor to the garbage
collector and the response dies mid-transfer (`ERR_FAILED`) — `fs.createReadStream()`
owns its descriptor for the life of the stream; and a separate `media://` scheme
is cross-origin to the `app://` page, so `fetch()` is blocked — serving the
cache on the page's own scheme removed the problem entirely.

### Also landed
- `docs/product/` — `RESEARCH-EDITROOM.md`, `ROADMAP.md`, `SKETCH.md`, `BASELINE.md`, `POST-CHANGE.md`, `PROGRESS.md`, **`SIDECAR.md`**, **`AUDIT-2026-11-25.md`**, **`APP-037-EXPORT.md`** (the export design)
- `design/timeline-v2-mock.html` + `design/shots/` — interactive Today/Proposed mock, both states rendered and visually QA'd (two defects found and fixed: marker/ruler collision, overlay overlap)
- `verify-all.cjs` — the suite runner, with a classifier that matches how this repo actually reports
- `verify-wave0.cjs` — **50 checks** covering every item in this cycle, in a real browser
- `verify-sidecar.cjs` — **87 checks** covering the sidecar **and the encoder**, **including a real Electron run**
- `test-helpers.cjs` — the shared `dismissFirstRun()` helper that removed the first-run race from 9 suites
- `verify-all.cjs` — the runner now pings the dev server before each suite and **retries once on a connection failure**, so a transient refusal can neither fake nor hide a regression
- `capture-mock.cjs`, `capture-wave1.cjs` — visual evidence capture

## The best-suggestion audit (2026-11-25)

A full product/engineering audit, run as a three-lens parallel review (UI/UX craft, reliability/performance/security, product completeness & moat), first-hand measurement in a real Chromium, and live market research (4 searches, 36 sources read).

**The report:** `docs/product/AUDIT-2026-11-25.md`.

**The core diagnosis — *the middle of this app is real; the two ends are not*.** The timeline, the media-understanding layer, the colour suite, the undo model and the preset surface are genuinely good. But the user arrives at a file and leaves with a file, and both ends are faked: the entry is a demo project of 8 gradient placeholders, and the exit is a silent 1280×720 VP9 WebM while the export sheet promises *"YouTube 4K — H.265 · 3840×2160"*. All six export controls are inert (`readFilmoraExportSettings()` is defined and never called), and there is no audio track in the output at all.

**The biggest blind spot: there is no encoder, so nothing the app does can reach the user's screen.** Roughly forty capabilities — the LUFS targets, caption burn-in, the music/voiceover/Audio-FX/fade/duck stack, per-clip gain, per-track solo — all terminate in a file that cannot hold any of them. The sidecar built last cycle already contains the encoder (`libx264` + `aac`); it is wired to *import* and never to *export*.

### Eight product bugs found and fixed in this cycle

Bugs 1, 3, 4, 5 and 6 were **regressions introduced by this cycle's own sidecar work** — caught by the audit, fixed, and each given a regression check. Bugs 2, 7 and 8 were **pre-existing** defects the same audit happened to find.

| # | Bug | Fix |
|---|---|---|
| 1 | `isPlayableUrl()` did not allow `app:` — a rescued MKV imported, got a **real** filmstrip and waveform, and then played **a static poster frame with no sound**, with no error and no "file missing" badge | `js/player.js:30` — accept `app:`; `verify-sidecar.cjs` now asserts *"the app can play a file the sidecar produced"* |
| 2 | `js/scopes.js:184-203` — the `dirty` flag was **inverted**: a pending repaint *suppressed* the next draw, so the colour scopes froze permanently after the first throttle hit | trailing-edge `setTimeout` repaint; the inverted guard is gone |
| 3 | `sanitizeProject` dropped `proxyPath`, orphaning a converted proxy on disk after a reload | `js/state.js:1448` keeps `proxyPath` |
| 4 | `js/media.js:223/230` — stale `startsWith("media://")` checks; the real scheme is `app://local/_media/` | both checks corrected |
| 5 | The original blob URL was never revoked when the sidecar proxy replaced it — a leak for the life of the session | revoked in both the video and audio branches |
| 6 | `restoreMediaUrls()` and `rehydrateProxies()` ran **concurrently**, both rewriting the whole media array — last writer wins | chained in sequence (`js/app.js:606`) |
| 7 | `Escape` did not close an open Filmora menu. `#fmVersion` is a native `<details>`, which has no keyboard dismissal of its own, so the panel stayed over the UI and swallowed the next click | `js/app.js` closes any open `.fm-item` on Escape |
| 8 | The app showed a blocking **"Recover unsaved work?"** dialog **on every boot**, offering to recover work that was never lost | `js/workflows.js` — the prompt now fires only when the backup holds something the live project does not |

Plus one truthfulness bug: the **About toast claimed version 2.2.2** while the app shipped 2.2.7. It now reads the version from the DOM.

### Bug 7 — found by tracing the suite's oldest failure

`verify-electron.cjs` had been failing for **180 s** with `exit null` — a signature that carries no information, because the runner kills the process at its timeout and loses every line of output. The recorded diagnosis ("it clicks `#frEmpty` twice and the second click times out") was **wrong**. Tracing it step by step:

1. The **first-run chooser never opens in Electron** — the `aifimora.firstRun.v1` flag persists in the Electron user-data directory, so the dismissal is skipped.
2. The Version menu opens; the version label reads **"AiFilmora 2.2.7"** — so the old `/AiFilmora 2\.2\.2/` assertion was **also stale**.
3. `Escape` is pressed to close the menu. **It doesn't close it.** `#fmVersion` is a native `<details>`, and a native `<details>` has no keyboard dismissal — so the open panel stays over the UI.
4. The next click, `[data-sidebar="filters"]`, is **blocked by the open menu** and times out after 30 s.
5. The error is caught, but the Electron app was **never closed**, so the node process never exits; the runner kills it at 180 s → `exit null`, no output.

**Two fixes:**
- **Product:** `Escape` now closes any open `.fm-item` menu (`js/app.js`). Click-outside already did this; the keyboard path was missing. This is the same class of defect as the audit's §4.3 (*"modals never move focus in, never trap it, never restore it"*).
- **Test:** `verify-electron.cjs` now closes the Electron app in a `finally` block, so a failure can never hang the runner again, and it asserts the version against `package.json` instead of a stale literal.

The suite went from **180 s and no output** to **green in ~15 s**.

### Bug 8 — found by chasing a flaky suite to its source

`verify-name-shape.cjs` and `verify-shader-transitions.cjs` failed in one suite run and passed in every other (5/5 and 2/2 standalone). Chasing them produced the real cause, and it was a **product** bug.

`js/workflows.js` showed a blocking native **"Recover unsaved work?"** dialog **on every boot**. The guard's own comment said *"only prompt if backup is newer than the live autosave slot and not from this same minute"* — the code checked **neither**. It only looked at the backup's **age**, so any backup under a day old triggered the dialog, including the `exit` snapshot the app writes as it closes. Every launch therefore greeted the user with a dialog offering to recover work that was never lost.

It also made the suite flaky: the dialog fired 600 ms into each page load, and when the page tore down while the dialog was pending, Playwright's auto-dismiss raced the page detach → `ProtocolError: Protocol error (Page.handleJavaScriptDialog): Not attached to an active page` → the suite exited 1 with no verdict.

**Fix.** The prompt now fires only when the backup actually holds something the live project does not — a stable content signature over the project's name, clips, tracks, markers and media, with volatile fields (blob: URLs, thumbnails) excluded. A timestamp comparison was tried first and **does not work**: the boot path itself rewrites the live project (`js/media.js:205`), so *"the live project is newer than the backup"* is true on every single boot.

**Verified:** 4 new checks in `verify-wave0.cjs` (now **34/34**), and they were **proven to fail against the unfixed code** (32/34). The old code prompted in both negative cases — one of them on the `exit` copy, which is the proof that it fired on every boot — while both positive controls still pass in old and new code, so the recovery feature itself is intact.

### One systemic test race, found by measuring instead of guessing

`verify-filmora-shell.cjs` failed in the post-audit run. The obvious conclusion — "my change broke it" — was **wrong**, and measuring it properly took five steps:

- The suite samples *"is the first-run modal open?"* at an arbitrary moment. The modal opens **400 ms after boot** (`js/app.js:550`), so the check races that timer: sample too early, the test skips the dismissal, the modal then opens over the page and swallows the next click with *"<div id="firstRunModal"> intercepts pointer events"*.
- Measured pass rate **on the base code: 1 of 5** — the suite was already broken; the recorded baseline's green entry was a lucky sample.
- Measured pass rate **with this cycle's changes: 0 of 5**.
- Measured `networkidle` timing on both versions: **558–577 ms base, 557–577 ms changed** — identical distributions. The product change is **not** the cause.
- The same race exists in **9 suites** (`verify-app`, `verify-assets`, `verify-filmora-working`, `verify-filmora-shell`, `verify-fonts`, `verify-v22`, `verify-icon-compact`, `verify-electron`, `verify-upgrade`).

**Fix:** `test-helpers.cjs` exports `dismissFirstRun(page, choice)`, which waits for the modal to actually open (or never to open) and only then dismisses it. All 9 suites use it. `verify-filmora-shell.cjs` went from **1/5 to 3/3**; the others were re-run 2× each and are green.

Two more pre-existing faults fell out of the same work: `verify-electron.cjs` clicked `#frEmpty` a **second** time on an already-hidden button (the documented cause of its 180 s timeout), and it asserted the version string `2.2.2` against an app that ships `2.2.7` — it now asserts against `package.json`.

## APP-037 — Real export (2026-11-25)

The user picked **§4.1 "Real MP4 export"** from the audit's five ranked upgrades. This is the build of that item, in the master-application order: design sketch → build → test → harden.

**The design:** `docs/product/APP-037-EXPORT.md`.

### What was actually wrong

Not "the export is a bit rough" — the export was **a lie with a UI**:

| The sheet promised | The app delivered |
|---|---|
| MP4 / MOV / AVI / MKV / WEBM / GIF / MP3 | always `.webm`; the requested container was discarded at save time (`js/export.js:632-633`) |
| 3840×2160 | the **preview panel's** size — `#previewCanvas` is sized to the panel (`js/player.js:1182-1184`) |
| H.264 / HEVC / AV1 | VP9 WebM, whatever the recorder produced |
| 24 / 25 / 30 / 60 fps | the recorder's own choice |
| 1–200 Mbps | none |
| NVENC / QSV | none |
| **a video with sound** | **a video with no sound track at all** |

And the six controls themselves: `readFilmoraExportSettings()` read all six and was **never called**. `resolveExportConfig()` read the preset chip and `settings.exportDefaults` only. The controls were decoration.

Two further defects found while reading the path:
- The render **never ended when the timeline ended.** The player wrapped the playhead to 0 (`js/player.js:1329-1331`), so the export's 200 ms poll that watched for `t >= dur - 0.05` usually missed its own stop condition — and the recorder kept filming a **frozen frame** until the `dur + 15 s` safety timeout. Every export carried fifteen seconds of dead air.
- `applyFilmoraExportDefaults()` had an operator-precedence bug: `def.format || def.codec === "hevc" ? "mp4" : …` always evaluated to `"mp4"`, so the saved format default was silently discarded.

### What was built

**The sidecar gained an `encode` op** (`electron/sidecar/media-service.cjs`). `buildEncodeArgs()` and `encoderPlans()` are pure functions and are unit-checked directly. H.264 → `libx264`; HEVC → `libx265` with `-tag:v hvc1`; AV1 → `libsvtav1` then `libaom-av1`; ProRes → `prores_ks`; WebM → `libvpx-vp9` with Opus; GIF → a two-pass `palettegen`/`paletteuse`; MP3 → `libmp3lame`. The source is fitted with `scale=…:force_original_aspect_ratio=decrease,pad=…`, never stretched. Hardware is tried first and **its absence is named**. The result is **probed with the same `analyzeFile()` the rest of the sidecar uses**, and the probe — the codec, resolution and audio that were actually written — is what the app reports.

**The player gained an export mode** (`js/player.js`). Two changes, both about telling the truth: the canvas backing store *becomes* the output resolution (so the timeline is composited at 1920×1080, not upscaled afterwards), and the playhead **stops at the end of the sequence** and dispatches `aifimora:render-complete` instead of wrapping to zero. The export now listens for that signal; the `dur + 15 s` timeout is the safety net it was always meant to be. The title-safe guides are also kept out of exported frames — they are a preview aid, and burning them into the file would be wrong.

**The audio mix bus** (`js/audio-fx.js`). Every media element already had a Web Audio graph (`syncElementFx()` calls `ensureGraph()` unconditionally), and the gain node already carried the clip level, fades, ducking and the whole Audio-FX chain. The bus is therefore one `MediaStreamAudioDestinationNode` on the shared context, connected from every graph's gain, and its audio track is added to the capture stream. **The URL guard now admits `app:`** — the scheme the Electron shell serves sidecar proxies from, same-origin with the page — so a rescued file reaches a graph instead of playing mute.

**The six controls are bound** (`js/export.js`). `resolveExportConfig()` reads the selects as the source of truth; a preset **writes its own numbers into them**; editing a control moves the chip to *Custom*; the saved defaults no longer overwrite a choice the user has already made.

**The bytes never come back.** The renderer hands the capture to the main process once; the main process writes it into its own cache, the worker encodes that file in place, and the finished video is copied straight to the destination. The renderer sees a path and a size.

### The honesty contract

The extension is decided **before** the save dialog: with an encoder the requested one, without one `.webm` — so the user is never shown "my-video.mp4" and handed a WebM. The fallback label is **computed from the actual capture** (real container, real height, whether the mix bus produced a track), never a fixed string. If FFmpeg is present but the encode **fails**, the capture is still saved beside the destination and the app says *"The MP4 could not be encoded (<the real reason>); the raw WebM capture was saved instead."* A failed encode never destroys the render.

### One latent bug found and fixed on the way

`sidecar/index.cjs`'s `materialise()` did `Buffer.from(String(bytes), "base64")` for anything that was not already a Buffer. Over Electron's IPC a typed array arrives as a **Uint8Array**, so `String(bytes)` is `"1,2,3"` — base64-decoding that yields garbage. The bytes path of `ingest` was therefore corrupt in the real desktop app (the test suite only ever passed a base64 *string*, so it never caught it). `toBuffer()` now handles Buffer, ArrayBuffer, typed array and base64 string, and the new Electron round-trip test asserts the bytes arrive intact by checking the source's duration survives into the probe.

### A regression this cycle caused, and what it taught

The first full-suite run of this build came back **43/54 — one worse than the 44/54 baseline**, and the new failure was `verify-export22.cjs` with the message *"Recorder produced no data"*. The export was writing **no file at all**.

The cause was not guessed. Five capture arrangements were recorded in a real Chromium, each on a fresh page:

| Arrangement | Chunks |
|---|---|
| canvas video only | 8 ✅ |
| canvas video + the bus's audio track, **bus idle** | **0** ❌ |
| canvas video + the bus's audio track, bus has a graph | 8 ✅ |
| canvas video + an element's own `captureStream()` audio, element inside a graph | **0** ❌ |
| canvas video + (element → `createMediaStreamSource` → destination) | 8 ✅ |

Three facts fell out:

1. **An idle Web Audio graph does not render.** With nothing connected to the bus, the `MediaStreamAudioDestinationNode` produces no frames.
2. **A MediaRecorder carrying a stalled audio track records nothing at all** — not even the video. The muxer never finalises a cluster without an audio timestamp, so the video frames sit in the buffer and no chunk is ever emitted. *This is the finding that matters: mixing audio into a canvas recording can cost you the video too.*
3. An element's own `captureStream()` audio is **silent** once the element is routed through a Web Audio graph, so that route cannot carry the mix either.

The bug only appeared for projects **without imported media** — the demo project's clips are generated placeholders, so no Web Audio graph was ever created and the bus stayed idle. Every real project with real footage would have worked; every placeholder project produced an empty file. That is precisely the kind of defect that a happy-path test misses.

**The fix:** a silent `ConstantSourceNode` (offset 0) connected to the bus, so the graph always renders and the bus's track always delivers frames. The same measurement on a page with nothing playing then gives **8 chunks and a blob that decodes as audio**.

**And a second line of defence:** `capturePreview()` takes a `withAudio` flag, and if the recorder still produces nothing the export is retried once **without** the audio track. The picture is worth more than the sound; a failed export must never be the price of an ambitious one. The fallback label then says *"no audio (the sound track could not be recorded)"* rather than pretending.

`verify-export22.cjs` was also strengthened from a suite that only printed values into one that **asserts**: the export writes a file with real content, reports success, says what it produced, records the export in the undo history, and uses the extension this build can really deliver.

### A second honesty gap, caught in review

Wiring the presets to the six controls exposed a vocabulary mismatch: the presets say **`h265`**, the encoder control says **`hevc`**. `setSelect()` refuses a value the select does not have — correctly — so clicking **"YouTube 4K — H.265"** would have silently written **H.264** into the control, and the file would have been H.264 while the chip claimed H.265. The same gap made **"ProRes Proxy"** fall back to HEVC, because the control had no ProRes option at all.

Both were fixed by bridging the vocabularies (`CODEC_ALIAS`) and by giving the sheet the two options the encoder can really deliver — **ProRes** (`prores_ks`) and **15 fps** (the Animated GIF preset's own rate). Two new checks guard them, and both were **proven to fail without the fix**: the 4K preset reported `h264 3840x2160 30` and the ProRes preset reported `hevc mov`.

## Bundling FFmpeg — the encoder ships with the app (2026-11-25)

The last open decision from the previous cycle was a **packaging** one: bundle
`ffmpeg-static` / `ffprobe-static`, or require a system install. The user chose
**bundle**. This section records what that actually cost and what it closed.

### What landed

`npm install --save ffmpeg-static@5.3.0 ffprobe-static@3.1.0`. npm 11 skips
install scripts by default, but these two packages ship their Windows binaries
**inside the tarball**, so nothing was missing.

`ffmpeg-static` puts a single 79 MB `ffmpeg.exe` at the package root.
`ffprobe-static` puts a binary for **every platform** in `bin/<os>/<arch>/` —
**335 MB** in `node_modules`. Only the Windows x64 one may ship.

### The bug this found

`staticCandidates()` used `require.resolve(pkg)`, which returns the package's
**JavaScript entry point**, not the binary. The app would have resolved
`node_modules/ffmpeg-static/index.js`, decided it was a tool, and then **run
`index.js` as a script** — a failure that looks like a broken FFmpeg rather
than a broken lookup.

It is now resolved by path, in `node_modules` (dev) **and** in
`resources/app.asar.unpacked/node_modules` (packaged — an executable inside an
asar cannot be run), and the package's own export is consulted **last**, because
in a packaged app it points *into* the archive.

Two new checks guard it, and both were **proven to fail against the old code**
by restoring it and re-running the suite:

```
FAIL  discovery: a bundled static resolves to the binary, not to a script
      — node_modules\ffmpeg-static\index.js | node_modules\ffprobe-static\index.js
FAIL  discovery: a bundled tool can be switched off
```

The old code also ignored `AIFIMORA_DISABLE_BUNDLED_TOOLS` entirely — so the
"no tools" paths could not be exercised against a machine that has the
bundled ones.

### The encoder, verified against the real thing

The long-standing caveat — *"a real FFmpeg was never executed"* — is **closed
for ffmpeg and ffprobe**. `verify-sidecar.cjs` grew a group (**27 checks**) that
runs the encoder against the **actual binaries**: a real source is built from
`lavfi` (`testsrc` + `sine`), probed, and re-encoded for real — MP4/H.264+AAC,
MP4/HEVC, WebM/VP9+Opus, MP4/AV1, MOV/ProRes, a two-pass GIF and an MP3 — each
one **written and probed back**, with the codec, resolution and audio track
asserted from the **file**, not from the request.

The AV1 case is the one worth noting: this FFmpeg build has `libaom-av1` but
**not** `libsvtav1`, so the fallback chain had to take over — and the op names
the encoder that actually ran. The fallback stopped being theoretical.

### What it costs — measured, not assumed

A baseline build **without** the binaries was produced for comparison:

| Artifact | Without | With | Delta |
|---|---|---|---|
| `dist/win-unpacked` | 452.1 MB | 591.6 MB | **+139.5 MB** |
| `resources/app.asar` | 184.0 MB | 184.4 MB | +0.4 MB |
| `resources/app.asar.unpacked` | — | 139.2 MB | +139.2 MB |
| **`AiFilmora-2.2.7-win-x64.exe` (NSIS)** | **152.5 MB** | **187.8 MB** | **+35.3 MB** |
| `AiFilmora-2.2.7-portable-win-x64.exe` | not built | 152.2 MB | — |

**What the user pays is +35 MB, not +139 MB.** The binaries are 139 MB on disk
and 35 MB in the download, because the installer compresses them.

The packaging config was **verified**, not assumed: the other five platforms'
`ffprobe` binaries (275 MB of them) are **absent** from the package. Only
`bin/win32/x64/ffprobe.exe` ships.

### What is still not proved

The installer was built but **never installed and launched**. That the
installed app finds the binaries at `app.asar.unpacked` is *implied* by the
layout, not observed on an installed copy. And real-world footage — a genuine
MXF from a camera — has not been pushed through it; the source used in the
tests is generated by FFmpeg itself.

## Key findings

1. Editroom's moat is **legibility**, not editing verbs — AiFilmora already had most of the verbs.
2. AiFilmora's timeline showed **no frames, no waveform, no clip state**. It now shows both.
3. The transcript, the LUFS control and the import MIME were **simulated or fake** — the highest-value work in Wave 0 was honesty, not features.
4. **Timeline drags were never undoable.** `js/timeline.js` contained no `pushUndo` call at all.
5. Editroom exposes a **43-tool MCP server** on loopback; AiFilmora has none, and its `store` is already a clean command surface to expose.
6. AiFilmora **already exceeds** Editroom on colour scopes, AI-provider breadth, asset library depth, token discipline and shortcut remapping — do not rewrite those.

### From the audit

7. **The middle of the app is real; the two ends are not.** The entry point is 8 gradient placeholders and the exit is a silent 720p WebM while the sheet promises 4K H.265.
8. **There is no encoder**, so ~40 capabilities cannot reach the user's screen. The sidecar already has one; it is wired to import and never to export.
9. **The AI tier fabricates its output and charges credits for it** — 21 `spendCredits()` call sites; "Auto Captions" writes a hardcoded 5-line demo script, "Scene detection" splits clips into equal-length chunks without inspecting a frame, and 7–40-credit items produce a media row with no url.
10. **Autosave silently dies early**: the empty demo project is **1,167,019 bytes, 99.4 % of it base64 thumbnails** — 22.3 % of the 5 MiB browser quota before a single real clip.
11. **Five independent 2026 projects converged** on MCP-over-the-editor + perception tools. AiFilmora already owns the timeline, the shared undo and **all five perception tools** (frames, peaks, word timings, beats, loudness) — the substrate is built; the transport is missing.
12. **The market's most-requested feature is the one this app half-has.** r/Filmora_Official asks for *"gaps in sound and filler words cut automatically"* — the word timings exist; the cutting does not.

## Verification performed

| Check | Result |
|---|---|
| `verify-wave0.cjs` | **54/54 pass**, 0 console errors (was 34/34; +20 this cycle) |
| `verify-sidecar.cjs` | **118/118 pass** — discovery (11), the worker (21), **the encoder (28)**, **the real tools (27)**, the manager (10), **a real Electron run** (15), and the browser build (6) |
| **The real tools (new)** | **27 checks against the actual FFmpeg 6.1.1 and ffprobe binaries.** A real source built from `lavfi` (`testsrc` + `sine`), probed as H.264+AAC; five real encodes (MP4/H.264, MP4/HEVC, WebM/VP9+Opus, MP4/AV1, MOV/ProRes) each **written and probed back** with the codec, resolution and audio track asserted from the file; the **AV1 fallback chain** (`libsvtav1` absent → `libaom-av1` took over, and the op names the encoder that ran); a real two-pass GIF; a real MP3 |
| **The packaged build (new)** | `electron-builder --dir` and `--win nsis` were **run**. NSIS **187.8 MB** (baseline without the statics: **152.5 MB** → **+35.3 MB**); portable 152.2 MB; `win-unpacked` 591.6 MB; `app.asar.unpacked` 139.2 MB. The other five platforms' `ffprobe` binaries are **absent** from the package — verified by listing the asar. |
| `verify-export22.cjs` | **9/9 pass** (was a print-only suite with no assertions at all). The export writes a file with real content, reports success, says what it produced, records the export in the undo history, and uses the extension this build can really deliver. |
| Sidecar in Electron | The `utilityProcess` starts; the renderer reaches it over IPC; a file is probed (duration 12.5, codec `prores`); a registered file is served over `app://local/_media/<token>` with **206 + byte range**; an unregistered token is refused (404); **0 console errors** |
| Conversion ladder | A ProRes source runs `remux` (not browser-safe → rejected) then `transcode` → **h264**, `browserSafe: true`. An audio-only AIFF is correctly called unplayable (raw PCM outside a WAV) and converts to AAC |
| **The encoder** | The argument builder for every codec and container is checked one by one: `libx264` + `scale=1920:1080:force_original_aspect_ratio=decrease` + `-r 30` + `-b:v 16M` + AAC + `+faststart`; HEVC carries `-tag:v hvc1`; WebM carries Opus; a GIF uses a palette; no audio means `-an`. The op runs end to end and **probes its own output** → `h264`, `1920×1080`, audio present. A WebM+H.264 request reports *"WEBM cannot hold H264; encoded VP9 instead."* An NVENC request falls back to software **and says so**. Without ffmpeg: `code: "no-ffmpeg"`. |
| **The encoder, through Electron** | The renderer hands a capture over IPC → the main process materialises it → the worker encodes → the file is copied to the destination. The bytes arrive **intact** (the source's 4.25 s duration survives into the probe) and the file is the size that was asked for (1280×720). |
| **The mix bus** | One audio track on the bus; the bus **records even when the timeline is silent** (5 chunks, 23 159 bytes) and the blob **decodes as audio** (`decodable=true`). Five capture arrangements were measured to find that — see the regression note above. |
| **The export, end to end** | A 2 s project → `Saved → …Test Export.webm — Quick preview export · WebM · 1080p · with audio — a real MP4 needs the desktop app with FFmpeg.`, **82 220 bytes** written, the export in the undo history, 0 page errors. |
| Whisper parsing | whisper.cpp's `-ojf` shape → **2 segments / 9 words** with token timings, `wordsEstimated: false`; the `-oj` shape falls back to estimated words and says so |
| Missing-tool paths | Without ffprobe → `code: "no-ffprobe"`; without whisper → `code: "no-whisper"`; without ffmpeg → `code: "no-ffmpeg"`; an unknown op → `code: "unknown-op"`. All plain data, no exceptions |
| Browser build | No sidecar → import behaves as before; the transcript is labelled "Sample transcript — no speech engine is available on this machine." |
| Marker flag geometry | Renders at a finite x (67.2 px for t=1.4 s at 48 px/s) with its name |
| Speed ramp | Source time is non-linear across the ramp (0.70 s at 25 %, 4.50 s at 100 %) and the source span is unchanged (4.50 → 4.50) |
| Ripple scope | No selection → both tracks move (4, 4); with a selection → only that track moves (4, 6) |
| Undo | Bulk AI-style `set()` is undoable; a 5-frame drag collapses into one step (2.00 → 2.50 → undo → 2.00) |
| Loudness | −3.004 LUFS on a full-scale sine; `gainForTarget(−20→−14, peak .5)` = +6 dB; with peak 1.0 it clamps to −1 dBFS |
| Filmstrip / waveform | 12 real frames and a 2 437-character SVG path; both **survive a timeline rebuild** (12 → 12) |
| Visual QA | Rendered at 1680×1000, 0 console errors; the timeline crop confirms real frames and waveform |
| First-run race (measured) | Base code: `verify-filmora-shell.cjs` passes **1 of 5**; with this cycle's changes **0 of 5**; `networkidle` timing is **558–577 ms base vs 557–577 ms changed** (identical). The suite, not the product, was the cause. After the `dismissFirstRun()` fix: **3 of 3**. The other 8 affected suites were re-run **2× each, all green**. |
| New regression checks | **APP-037:** `verify-wave0.cjs` is now **54/54** (was 34/34) and `verify-sidecar.cjs` **87/87** (was 49/49). Every new check was **proven to fail against the unfixed code**: 14 of 16 export checks (the six controls were inert, the canvas was the preview's size, the playhead wrapped, there was no mix bus), **37** encoder/sidecar checks (no `encode` op existed at all), the mix-bus checks (an idle bus stalls the recorder → 0 chunks), and the two preset-vocabulary checks (`h264 3840x2160 30`, `hevc mov`). |
| `verify-electron.cjs` | **Green** — was a 180 s `exit null` with no output. Root cause was the open `<details>` menu blocking the next click, plus the suite never closing the Electron app. |
| Connection failures under load | Two suites failed in the suite run with **no verdict at all** — `verify-audiofx` in one run, `verify-speed2` in another (*different* suites, so not code-specific). Both pass standalone (`17/17` and **6/6**). The root cause was the recovery-prompt dialog (§ bug 8) racing the page teardown. `verify-all.cjs` now pings the server before each suite and **retries once** on an inconclusive run, so a transient failure can neither fake nor hide a regression. |
| Full suite | `docs/product/POST-CHANGE.md` — **44/54 green, exactly the baseline's 44/54, zero regressions.** The 10 failing suites are the **same ten** that fail on the base commit (`verify-detach`, `verify-filmora-gaps`, `verify-filmora15`, `verify-icon-compact`, `verify-panzoom`, `verify-parity`, `verify-rebuild`, `verify-save-fallback`, `verify-save-location`, `verify-vol-split`) — all pre-existing and untouched. The three export suites stay green: `verify-export22.cjs` **9/9**, `verify-sidecar.cjs` **87/87**, `verify-wave0.cjs` **54/54**. |

## Not verified / unknown

- ❌ **The AI tier still fabricates its output and charges credits for it.** APP-037 did not touch this (§2.5). The exit is now honest; the entry point is not.
- ❌ **LUFS normalisation (APP-025) is not part of APP-037.** The mix bus exists and carries the timeline's sound, but the −14/−16/−23 LUFS targets are a separate roadmap item — `js/loudness.js` can drive them and the export does not yet.
- ❌ **Caption burn-in is still not real.** The sheet mentions it; APP-037 did not implement it.
- ❌ **The installer was built but never installed and launched.** The artefacts are the right size and contain the right binaries; that the *installed* app finds them at `app.asar.unpacked` is implied by the layout, not observed on an installed copy. The packaged app was not exercised end to end — the 118 sidecar checks run against the source tree.
- ❌ **No real Whisper was ever executed.** FFmpeg and ffprobe now ship and are exercised for real (27 checks); whisper.cpp is still not installed, so the JSON shapes are handled correctly against its documented format but **no model was transcribed**.
- ❌ **The transcript was never run against real speech.** The whisper.cpp JSON shapes are parsed correctly; no model was transcribed.
- ⚠️ `verify-electron.cjs` fails for a **pre-existing** reason, not a sidecar one: it clicks `#frEmpty` a second time after the first-run modal is already dismissed, so the click times out on a hidden element. The Electron shell itself launches and runs — `verify-sidecar.cjs` drives it end to end.
- ❌ APP-010 (scene tags + semantic search) is not started.
- ❌ Waves 2–5 are not started: clip badges, transition wedges, ruler ladder, trim affordances, track gain/meter, the inspector redesign, colour wheels, grade copy/paste, LUT import UI, MCP, @mentions, draft isolation, agent presence, export loudness/shape, in/out points, command palette, the state kit, auto-update, responsive breakpoints, the undo panel, close gaps, true reverse.
- ❌ Editroom's "plays 4K in realtime" was not measured — a README claim with bench harnesses but no recorded numbers.
- ⚠️ 10 suites were already failing on the base commit (the baseline recorded 11; `verify-electron.cjs` is now green). They are **pre-existing**, not caused by this cycle — the final post-change run fails the **same ten** and no new ones.
- ❌ **The audit's five critical shortcomings are reported, not fixed.** Only §2.1 (the sidecar's output could not be played) was fixed in this cycle. Still open, and the highest-value work in the repo:
  - **§2.2 — autosave silently stops working.** Measured: the empty demo project is 1,167,019 bytes of which 99.4 % is base64 thumbnails — 22.3 % of the 5 MiB quota before a single real clip. The backup ring and the 50 undo snapshots deep-clone the same thumbnails. The fix (scrub `data:` thumbs, catch `QuotaExceededError` explicitly, move the backup ring to IndexedDB) is **not started**.
  - **§2.3 — the Electron renderer can write and read any file on disk.** `fs:writeFile` takes a renderer-controlled path; `media:register` accepts any existing path; there is no CSP. **Not fixed** — it is a security change that needs the user's sign-off on the threat model.
  - **§2.4 — the export is silent, 720p, video-only WebM** while the sheet promises 4K H.265, and the six export controls are inert. **Fixed by APP-037 this cycle** — the sidecar encodes, the controls are bound, the mix bus carries the sound, the render ends when the timeline ends, and the fallback is labelled with what it really produced. **And now verified against a real FFmpeg**: the binaries ship with the app and the encoder was exercised against FFmpeg 6.1.1 for real (27 checks, five container/codec combinations written and probed back). See `docs/product/APP-037-EXPORT.md` §5.
  - **§2.5 — the AI tier fabricates its output and charges credits for it.** **Not fixed**, beyond the transcript label that already landed.
- ❌ `verify-icon-compact.cjs` fails on **7 stale expectations** (6 library tabs vs the 10 that exist, a deliberate `✕` close glyph, and five CSS metrics that no longer match the redesigned chrome). It was already failing on the base commit. Fixing it means deciding what the chrome *should* measure, so it was left alone rather than edited to match whatever the page currently does.
- ❌ `verify-rebuild.cjs`, `verify-panzoom.cjs`, `verify-detach.cjs`, `verify-parity.cjs`, `verify-save-fallback.cjs`, `verify-save-location.cjs`, `verify-vol-split.cjs`, `verify-filmora-gaps.cjs`, `verify-filmora15.cjs` were **not triaged** — all pre-existing failures, none touched.

## Exact next step

**APP-037 (§4.1) is built and verified. The next upgrade is the user's call** — the audit ranked five in `docs/product/AUDIT-2026-11-25.md` §4, and the first one is done:

| # | Item | Effort | Status | Why |
|---|---|---|---|---|
| 4.1 | **Export the file you actually asked for** — an `encode` op in the sidecar + the six bound export controls + a real audio mix bus | Quick Win | ✅ **done-verified** | It is the app's *output*; the encoder already existed in `media-service.cjs` and was wired to import and never to export |
| 4.2 | **A project file you can actually reopen** — `sourcePath` per media item, relink on open, no thumbnails in the snapshot, a surfaced save failure | Quick Win | proposed | Fixes §2.2 and the "reopen last week's project" wall |
| 4.3 | **Keyboard-first timeline and real focus management** — focusable clips, a shared `openModal()` with focus trap, a live status dot | Quick Win | proposed | A reach item, and the cheapest |
| 4.4 | **Edit by text** — the transcript becomes the editing surface; real `removePauses()` / `cutWordRange()` on the word timings that now exist | Strategic Bet | proposed | The category's most-requested feature, half-built already |
| 4.5 | **The agent surface** — MCP over the store with the five perception tools attached | Moonshot | proposed | It makes the product's name true |

1. **Pick the next one** and it gets a design pass before code, in the master-application order (sketch → prototype → build → test → harden). **4.2** is the natural companion to 4.1: the export now produces a real file, and the project that describes it still cannot be reopened anywhere else.
2. **Two loose ends from APP-037 itself**, both small: the export's **caption burn-in** is still not real, and the **LUFS targets** (APP-025) are not wired to the mix bus that now exists.
3. Then **Fix & Polish** continues with the §2.3 Electron path containment and the CSP — a security change that needs the user's sign-off first.
4. **APP-010** (scene tags + semantic library search) is still the one unfinished Wave 1 item, and the audit §3.2/§3.6 independently confirm it is table stakes rather than a nice-to-have.
5. ~~A **user decision** is still open~~ — **closed this cycle.** `ffmpeg-static` / `ffprobe-static` are bundled as dependencies; the desktop build writes a real MP4 with no system install, at a measured **+35.3 MB** on the installer.

## Repeat-run notes

- `docs/product/RESEARCH-EDITROOM.md` §7 lists exactly what was and was not verified — re-read it before re-running.
- The Editroom clone lives in `%TEMP%\editroom-src` and will not survive a machine reset; re-clone with `git clone --depth 1 https://github.com/robbietilton/Editroom`.
- Editroom ships new versions often (v1.0.2 on 2026-11-24). If more than 90 days pass, re-check its README, `MCPTools.definitions`, and the `ExportSheet.swift` loudness presets before trusting the numbers above.
- `verify-all.cjs` writes `docs/product/BASELINE.md` by default — pass a different path to record a comparison run.
