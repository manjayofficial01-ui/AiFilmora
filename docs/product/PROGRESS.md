# PROGRESS — AiFilmora

**Last cycle:** 2026-11-25 · **Mode:** `teardown` + `modernize` build (master-application path)
**Workspace:** `D:\000000 Lab\AiFimora` · **Branch:** `modernize/2026-11-25` (created this cycle, not pushed)
**Base commit:** `ab3e97c` (AiFilmora 2.2.7) · **Cycle commits:** `a13c155`, `366afe4`, `1fb4aa1` (+ a follow-up for the hydration performance fix)

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
| Test suite | ✅ run | `verify-all.cjs` → 53 suites; `verify-wave0.cjs` → 28 checks; `verify-sidecar.cjs` → 46 checks |
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
| 7 Test/fix/retest | 🟡 partial | `verify-wave0.cjs` **28/28**; `verify-sidecar.cjs` **46/46** (incl. a real Electron run); full-suite regression run recorded in `POST-CHANGE.md` |
| 8 Harden | ⏭️ not started | |
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
- `docs/product/` — `RESEARCH-EDITROOM.md`, `ROADMAP.md`, `SKETCH.md`, `BASELINE.md`, `POST-CHANGE.md`, `PROGRESS.md`, **`SIDECAR.md`**
- `design/timeline-v2-mock.html` + `design/shots/` — interactive Today/Proposed mock, both states rendered and visually QA'd (two defects found and fixed: marker/ruler collision, overlay overlap)
- `verify-all.cjs` — the suite runner, with a classifier that matches how this repo actually reports
- `verify-wave0.cjs` — 28 checks covering every item in this cycle, in a real browser
- `verify-sidecar.cjs` — 46 checks covering the sidecar, **including a real Electron run**
- `capture-mock.cjs`, `capture-wave1.cjs` — visual evidence capture

## Key findings

1. Editroom's moat is **legibility**, not editing verbs — AiFilmora already had most of the verbs.
2. AiFilmora's timeline showed **no frames, no waveform, no clip state**. It now shows both.
3. The transcript, the LUFS control and the import MIME were **simulated or fake** — the highest-value work in Wave 0 was honesty, not features.
4. **Timeline drags were never undoable.** `js/timeline.js` contained no `pushUndo` call at all.
5. Editroom exposes a **43-tool MCP server** on loopback; AiFilmora has none, and its `store` is already a clean command surface to expose.
6. AiFilmora **already exceeds** Editroom on colour scopes, AI-provider breadth, asset library depth, token discipline and shortcut remapping — do not rewrite those.

## Verification performed

| Check | Result |
|---|---|
| `verify-wave0.cjs` | **28/28 pass**, 0 console errors |
| `verify-sidecar.cjs` | **48/48 pass** — discovery (7), the worker (21), the manager (6), **a real Electron run** (8), and the browser build (6) |
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
| Full suite | `docs/product/POST-CHANGE.md` — **43/54 green vs. a 39/52 baseline, zero regressions.** Two suites were failing at the baseline and now pass (`verify-app.cjs`, `verify-filmora-shell.cjs`); two suites were added and are green (`verify-wave0.cjs` 28/28, `verify-sidecar.cjs` 48/48). |

## Not verified / unknown

- ❌ `npm run dist` was not run; no installer was produced or tested.
- ❌ **No real FFmpeg, ffprobe or Whisper was ever executed.** None is installed on this machine, and installing system software needs the user's approval. The sidecar's spawn, command construction, output parsing, IPC and file delivery are all verified **against stand-in tools**; real binaries are not. See `docs/product/SIDECAR.md` §5.
- ❌ **The transcript was never run against real speech.** The whisper.cpp JSON shapes are parsed correctly; no model was transcribed.
- ⚠️ `verify-electron.cjs` fails for a **pre-existing** reason, not a sidecar one: it clicks `#frEmpty` a second time after the first-run modal is already dismissed, so the click times out on a hidden element. The Electron shell itself launches and runs — `verify-sidecar.cjs` drives it end to end.
- ❌ APP-010 (scene tags + semantic search) is not started.
- ❌ Waves 2–5 are not started: clip badges, transition wedges, ruler ladder, trim affordances, track gain/meter, the inspector redesign, colour wheels, grade copy/paste, LUT import UI, MCP, @mentions, draft isolation, agent presence, export loudness/shape, in/out points, command palette, the state kit, auto-update, responsive breakpoints, the undo panel, close gaps, true reverse.
- ❌ Editroom's "plays 4K in realtime" was not measured — a README claim with bench harnesses but no recorded numbers.
- ⚠️ 13 suites were already failing on the base commit. They are **pre-existing**, not caused by this cycle — the post-change run has the same 13 failing and no new ones.

## Exact next step

**Finish Wave 1** — one item remains:

1. **APP-010** — scene tags + semantic library search, on top of the analysis cache that now exists (`js/media-analysis.js`). Per-frame tags (luma / sharpness / motion / colourfulness) computed in the browser, plus phrases derived from the sidecar's transcript. The media search field resolves **quoted** queries to transcript matches and **plain** queries to tag/name matches, and results highlight the matching times.
2. A **user decision** is still open and is not blocking: bundle `ffmpeg-static`/`ffprobe-static` as dependencies (~80 MB of binaries, a supply-chain choice) or require a system install. The sidecar works either way, and the browser build keeps working with neither.

Then **Wave 2** (clip badges, transition wedges, ruler ladder, trim affordances, track gain + level meter) — the items that make the timeline legible, which is the whole point of the comparison with Editroom.

## Repeat-run notes

- `docs/product/RESEARCH-EDITROOM.md` §7 lists exactly what was and was not verified — re-read it before re-running.
- The Editroom clone lives in `%TEMP%\editroom-src` and will not survive a machine reset; re-clone with `git clone --depth 1 https://github.com/robbietilton/Editroom`.
- Editroom ships new versions often (v1.0.2 on 2026-11-24). If more than 90 days pass, re-check its README, `MCPTools.definitions`, and the `ExportSheet.swift` loudness presets before trusting the numbers above.
- `verify-all.cjs` writes `docs/product/BASELINE.md` by default — pass a different path to record a comparison run.
