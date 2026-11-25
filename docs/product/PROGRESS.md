# PROGRESS — AiFilmora

**Last cycle:** 2026-11-25 · **Mode:** `teardown` + `modernize` build (master-application path), then a `/best-suggestion` audit
**Workspace:** `D:\000000 Lab\AiFimora` · **Branch:** `modernize/2026-11-25` (created this cycle, not pushed)
**Base commit:** `ab3e97c` (AiFilmora 2.2.7) · **Cycle commits:** `a13c155`, `366afe4`, `1fb4aa1`, `30e2d67`, `6d3a48d`, `5d75f13`, `e66a206`, `533695d` (audit fixes), `063c186` (suite), `1f7aa54` (regression run), `83d95ff` (report)

---

## Capabilities (observed this cycle)

| Capability | State | Evidence |
|---|---|---|
| Git | ✅ present, clean tree before this cycle | `git status --porcelain` → only this cycle's new files |
| Node + Playwright | ✅ present | `node_modules/playwright`, chromium-1243 in `%LOCALAPPDATA%\ms-playwright` |
| Dev server | ✅ works | `node server.cjs` → `http://127.0.0.1:8765`, HTTP 200 |
| App renders | ✅ | headless Chromium 1680×1000 → **0 console errors** |
| Electron shell | ✅ **launches and runs** | Playwright `_electron.launch` → the window loads, `app://` serves assets, the sidecar starts as a `utilityProcess`. `verify-electron.cjs` is a **pre-existing** failure: it clicks `#frEmpty` twice and the second click times out because the modal is already closed. |
| Media tools | ❌ **not installed** | No `ffmpeg`, `ffprobe` or `whisper` on this machine (`Get-Command` finds none; no common install dirs). Installing them is a user decision, so the sidecar **discovers** them and degrades honestly. |
| Test suite | ✅ run | `verify-all.cjs` → 54 suites; `verify-wave0.cjs` → 34 checks; `verify-sidecar.cjs` → 49 checks |
| Build / packaging | ❌ not run | `npm run dist` not invoked |
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
| 6 Build | 🟡 **partial** | **Wave 0 complete (6/6). Wave 1: 3 of 4 done (filmstrip, waveform, real ASR + sidecar). Waves 2–5 not started.** |
| 7 Test/fix/retest | ✅ done | `verify-wave0.cjs` **34/34**; `verify-sidecar.cjs` **49/49** (incl. a real Electron run); full suite **44/54 green vs. a 43/54 baseline, zero regressions**; the suite's own first-run race and the Electron hang fixed |
| 8 Harden | 🟡 partial | **8 product bugs** and **1 systemic test race** found and fixed by the audit — see `AUDIT-2026-11-25.md` |
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
- `docs/product/` — `RESEARCH-EDITROOM.md`, `ROADMAP.md`, `SKETCH.md`, `BASELINE.md`, `POST-CHANGE.md`, `PROGRESS.md`, **`SIDECAR.md`**, **`AUDIT-2026-11-25.md`**
- `design/timeline-v2-mock.html` + `design/shots/` — interactive Today/Proposed mock, both states rendered and visually QA'd (two defects found and fixed: marker/ruler collision, overlay overlap)
- `verify-all.cjs` — the suite runner, with a classifier that matches how this repo actually reports
- `verify-wave0.cjs` — **34 checks** covering every item in this cycle, in a real browser
- `verify-sidecar.cjs` — 49 checks covering the sidecar, **including a real Electron run**
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
| `verify-wave0.cjs` | **28/28 pass**, 0 console errors |
| `verify-sidecar.cjs` | **49/49 pass** — discovery (7), the worker (23), the manager (6), **a real Electron run** (9), and the browser build (6) |
| Sidecar in Electron | The `utilityProcess` starts; the renderer reaches it over IPC; a file is probed (duration 12.5, codec `prores`); a registered file is served over `app://local/_media/<token>` with **206 + byte range**; an unregistered token is refused (404); **0 console errors** |
| Conversion ladder | A ProRes source runs `remux` (not browser-safe → rejected) then `transcode` → **h264**, `browserSafe: true`. An audio-only AIFF is correctly called unplayable (raw PCM outside a WAV) and converts to AAC |
| Whisper parsing | whisper.cpp's `-ojf` shape → **2 segments / 9 words** with token timings, `wordsEstimated: false`; the `-oj` shape falls back to estimated words and says so |
| Missing-tool paths | Without ffprobe → `code: "no-ffprobe"`; without whisper → `code: "no-whisper"`; an unknown op → `code: "unknown-op"`. All plain data, no exceptions |
| Browser build | No sidecar → import behaves as before; the transcript is labelled "Sample transcript — no speech engine is available on this machine." |
| Marker flag geometry | Renders at a finite x (67.2 px for t=1.4 s at 48 px/s) with its name |
| Speed ramp | Source time is non-linear across the ramp (0.70 s at 25 %, 4.50 s at 100 %) and the source span is unchanged (4.50 → 4.50) |
| Ripple scope | No selection → both tracks move (4, 4); with a selection → only that track moves (4, 6) |
| Undo | Bulk AI-style `set()` is undoable; a 5-frame drag collapses into one step (2.00 → 2.50 → undo → 2.00) |
| Loudness | −3.004 LUFS on a full-scale sine; `gainForTarget(−20→−14, peak .5)` = +6 dB; with peak 1.0 it clamps to −1 dBFS |
| Filmstrip / waveform | 12 real frames and a 2 437-character SVG path; both **survive a timeline rebuild** (12 → 12) |
| Visual QA | Rendered at 1680×1000, 0 console errors; the timeline crop confirms real frames and waveform |
| First-run race (measured) | Base code: `verify-filmora-shell.cjs` passes **1 of 5**; with this cycle's changes **0 of 5**; `networkidle` timing is **558–577 ms base vs 557–577 ms changed** (identical). The suite, not the product, was the cause. After the `dismissFirstRun()` fix: **3 of 3**. The other 8 affected suites were re-run **2× each, all green**. |
| New regression checks | `verify-wave0.cjs` is now **34/34** (was 28/28). The 6 new checks were **proven to fail against the unfixed code**: the scope signature froze (`435128228 → 435128228`), the menu stayed open (`{"opened":1,"after":1}`), and the recovery dialog appeared in both negative cases (32/34 on the old code). |
| `verify-electron.cjs` | **Green** — was a 180 s `exit null` with no output. Root cause was the open `<details>` menu blocking the next click, plus the suite never closing the Electron app. |
| Connection failures under load | Two suites failed in the suite run with **no verdict at all** — `verify-audiofx` in one run, `verify-speed2` in another (*different* suites, so not code-specific). Both pass standalone (`17/17` and **6/6**). The root cause was the recovery-prompt dialog (§ bug 8) racing the page teardown. `verify-all.cjs` now pings the server before each suite and **retries once** on an inconclusive run, so a transient failure can neither fake nor hide a regression. |
| Full suite | `docs/product/POST-CHANGE.md` — **44/54 green vs. a 43/54 baseline, zero regressions.** The 10 failing suites are a **strict subset** of the baseline's 11: `verify-electron.cjs` is now green. The two suites added this cycle stay green (`verify-wave0.cjs` 34/34, `verify-sidecar.cjs` 49/49). |

## Not verified / unknown

- ❌ `npm run dist` was not run; no installer was produced or tested.
- ❌ **No real FFmpeg, ffprobe or Whisper was ever executed.** None is installed on this machine, and installing system software needs the user's approval. The sidecar's spawn, command construction, output parsing, IPC and file delivery are all verified **against stand-in tools**; real binaries are not. See `docs/product/SIDECAR.md` §5.
- ❌ **The transcript was never run against real speech.** The whisper.cpp JSON shapes are parsed correctly; no model was transcribed.
- ⚠️ `verify-electron.cjs` fails for a **pre-existing** reason, not a sidecar one: it clicks `#frEmpty` a second time after the first-run modal is already dismissed, so the click times out on a hidden element. The Electron shell itself launches and runs — `verify-sidecar.cjs` drives it end to end.
- ❌ APP-010 (scene tags + semantic search) is not started.
- ❌ Waves 2–5 are not started: clip badges, transition wedges, ruler ladder, trim affordances, track gain/meter, the inspector redesign, colour wheels, grade copy/paste, LUT import UI, MCP, @mentions, draft isolation, agent presence, export loudness/shape, in/out points, command palette, the state kit, auto-update, responsive breakpoints, the undo panel, close gaps, true reverse.
- ❌ Editroom's "plays 4K in realtime" was not measured — a README claim with bench harnesses but no recorded numbers.
- ⚠️ 10 suites were already failing on the base commit (the baseline recorded 11; `verify-electron.cjs` is now green). They are **pre-existing**, not caused by this cycle — the post-change run has the same failing set minus the fixed one, and no new ones.
- ❌ **The audit's five critical shortcomings are reported, not fixed.** Only §2.1 (the sidecar's output could not be played) was fixed in this cycle. Still open, and the highest-value work in the repo:
  - **§2.2 — autosave silently stops working.** Measured: the empty demo project is 1,167,019 bytes of which 99.4 % is base64 thumbnails — 22.3 % of the 5 MiB quota before a single real clip. The backup ring and the 50 undo snapshots deep-clone the same thumbnails. The fix (scrub `data:` thumbs, catch `QuotaExceededError` explicitly, move the backup ring to IndexedDB) is **not started**.
  - **§2.3 — the Electron renderer can write and read any file on disk.** `fs:writeFile` takes a renderer-controlled path; `media:register` accepts any existing path; there is no CSP. **Not fixed** — it is a security change that needs the user's sign-off on the threat model.
  - **§2.4 — the export is silent, 720p, video-only WebM** while the sheet promises 4K H.265, and the six export controls are inert. **Not fixed.**
  - **§2.5 — the AI tier fabricates its output and charges credits for it.** **Not fixed**, beyond the transcript label that already landed.
- ❌ `verify-icon-compact.cjs` fails on **7 stale expectations** (6 library tabs vs the 10 that exist, a deliberate `✕` close glyph, and five CSS metrics that no longer match the redesigned chrome). It was already failing on the base commit. Fixing it means deciding what the chrome *should* measure, so it was left alone rather than edited to match whatever the page currently does.
- ❌ `verify-rebuild.cjs`, `verify-panzoom.cjs`, `verify-detach.cjs`, `verify-parity.cjs`, `verify-save-fallback.cjs`, `verify-save-location.cjs`, `verify-vol-split.cjs`, `verify-filmora-gaps.cjs`, `verify-filmora15.cjs` were **not triaged** — all pre-existing failures, none touched.

## Exact next step

**The audit's Step 1 — "Fix & Polish" — is the next work, and the choice of which item to build first is the user's.** The audit ranked five upgrades in `docs/product/AUDIT-2026-11-25.md` §4:

| # | Item | Effort | Why |
|---|---|---|---|
| 4.1 | **Export the file you actually asked for** — an `encode` op in the sidecar + the six bound export controls + a real audio mix bus | Quick Win | It is the app's *output*; the encoder already exists in `media-service.cjs:273-302` |
| 4.2 | **A project file you can actually reopen** — `sourcePath` per media item, relink on open, no thumbnails in the snapshot, a surfaced save failure | Quick Win | Fixes §2.2 and the "reopen last week's project" wall |
| 4.3 | **Keyboard-first timeline and real focus management** — focusable clips, a shared `openModal()` with focus trap, a live status dot | Quick Win | A reach item, and the cheapest |
| 4.4 | **Edit by text** — the transcript becomes the editing surface; real `removePauses()` / `cutWordRange()` on the word timings that now exist | Strategic Bet | The category's most-requested feature, half-built already |
| 4.5 | **The agent surface** — MCP over the store with the five perception tools attached | Moonshot | It makes the product's name true |

1. **Pick one** and it gets a design pass before code, in the master-application order (sketch → prototype → build → test → harden).
2. Then **Fix & Polish** continues with the §2.3 Electron path containment and the CSP — a security change that needs the user's sign-off first.
3. **APP-010** (scene tags + semantic library search) is still the one unfinished Wave 1 item, and the audit §3.2/§3.6 independently confirm it is table stakes rather than a nice-to-have.
4. A **user decision** is still open and is not blocking: bundle `ffmpeg-static`/`ffprobe-static` as dependencies (~80 MB of binaries, a supply-chain choice) or require a system install. The sidecar works either way, and the browser build keeps working with neither.

## Repeat-run notes

- `docs/product/RESEARCH-EDITROOM.md` §7 lists exactly what was and was not verified — re-read it before re-running.
- The Editroom clone lives in `%TEMP%\editroom-src` and will not survive a machine reset; re-clone with `git clone --depth 1 https://github.com/robbietilton/Editroom`.
- Editroom ships new versions often (v1.0.2 on 2026-11-24). If more than 90 days pass, re-check its README, `MCPTools.definitions`, and the `ExportSheet.swift` loudness presets before trusting the numbers above.
- `verify-all.cjs` writes `docs/product/BASELINE.md` by default — pass a different path to record a comparison run.
