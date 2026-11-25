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
| Electron shell | ⚠️ not launched | `electron/main.cjs` inspected statically only |
| Test suite | ✅ run | `verify-all.cjs` → 52 suites; `verify-wave0.cjs` → 28 checks |
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
| 4 Architecture | ✅ done | 4 new modules: `speed-ramp.js`, `media-analysis.js`, `waveform-render.js`, `loudness.js` |
| 5 Prototype | ✅ done | `design/timeline-v2-mock.html` — interactive mock, both states rendered and visually QA'd |
| 6 Build | 🟡 **partial** | **Wave 0 complete (6/6). Wave 1: 2 of 4 done (filmstrip, waveform). Waves 2–5 not started.** |
| 7 Test/fix/retest | 🟡 partial | `verify-wave0.cjs` **28/28**; full-suite regression run recorded in `POST-CHANGE.md` |
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

### Wave 1 — media understanding (2 of 4 done)

| ID | Change | File |
|---|---|---|
| APP-007 | Video clips carry **real filmstrip frames** on the timeline, extracted by seeking a `<video>` and drawing to canvas, cached per media id. | `js/media-analysis.js` (new), `js/timeline.js` |
| APP-008 | Audio and video clips carry the **real decoded waveform**. The CSS-gradient placeholder is gone; silence renders as a thin line. | `js/waveform-render.js` (new), `js/media-analysis.js`, `js/timeline.js`, `css/timeline.css` |
| APP-009 | Real ASR | **not started** |
| APP-010 | Scene tags + semantic search | **not started** |

### Also landed
- `docs/product/` — `RESEARCH-EDITROOM.md`, `ROADMAP.md`, `SKETCH.md`, `BASELINE.md`, `POST-CHANGE.md`, `PROGRESS.md`
- `design/timeline-v2-mock.html` + `design/shots/` — interactive Today/Proposed mock, both states rendered and visually QA'd (two defects found and fixed: marker/ruler collision, overlay overlap)
- `verify-all.cjs` — the suite runner, with a classifier that matches how this repo actually reports
- `verify-wave0.cjs` — 28 checks covering every item in this cycle, in a real browser
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
| Marker flag geometry | Renders at a finite x (67.2 px for t=1.4 s at 48 px/s) with its name |
| Speed ramp | Source time is non-linear across the ramp (0.70 s at 25 %, 4.50 s at 100 %) and the source span is unchanged (4.50 → 4.50) |
| Ripple scope | No selection → both tracks move (4, 4); with a selection → only that track moves (4, 6) |
| Undo | Bulk AI-style `set()` is undoable; a 5-frame drag collapses into one step (2.00 → 2.50 → undo → 2.00) |
| Loudness | −3.004 LUFS on a full-scale sine; `gainForTarget(−20→−14, peak .5)` = +6 dB; with peak 1.0 it clamps to −1 dBFS |
| Filmstrip / waveform | 12 real frames and a 2 437-character SVG path; both **survive a timeline rebuild** (12 → 12) |
| Visual QA | Rendered at 1680×1000, 0 console errors; the timeline crop confirms real frames and waveform |
| Full suite | `docs/product/POST-CHANGE.md` — **41/53 green vs. a 39/52 baseline, zero regressions.** The only change is `verify-app.cjs`, which failed in the baseline and passes now. `verify-wave0.cjs` adds 28/28. |

## Not verified / unknown

- ❌ `npm run dist` was not run; no installer was produced or tested.
- ❌ The Electron shell was never launched; Electron-specific behaviour is **unverified**.
- ❌ **No FFmpeg / Whisper sidecar was built.** The user chose an Electron-sidecar target, but that work has not started — `electron/main.cjs` is untouched.
- ❌ APP-009 (ASR) and APP-010 (semantic search) are not started.
- ❌ Waves 2–5 are not started: clip badges, transition wedges, ruler ladder, trim affordances, track gain/meter, the inspector redesign, colour wheels, grade copy/paste, LUT import UI, MCP, @mentions, draft isolation, agent presence, export loudness/shape, in/out points, command palette, the state kit, auto-update, responsive breakpoints, the undo panel, close gaps, true reverse.
- ❌ Editroom's "plays 4K in realtime" was not measured — a README claim with bench harnesses but no recorded numbers.
- ⚠️ 13 suites were already failing on the base commit. They are **pre-existing**, not caused by this cycle — the post-change run has the same 13 failing and no new ones.

## Exact next step

**Wave 1 completion** — APP-009 (real ASR) and APP-010 (scene tags + semantic search) — on the **Electron sidecar** target the user chose:
1. Build the FFmpeg/Whisper sidecar in `electron/` (UtilityProcess, per `ARCHITECTURE.md`) with a browser fallback so the web build keeps working.
2. Wire APP-009 to the sidecar and fall back to the existing simulated transcript when the sidecar is absent.
3. Add scene tags and the semantic library search on top of the existing analysis cache.

Then **Wave 2** (clip badges, transition wedges, ruler ladder, trim affordances, track gain + level meter) — the items that make the timeline legible, which is the whole point of the comparison with Editroom.

## Repeat-run notes

- `docs/product/RESEARCH-EDITROOM.md` §7 lists exactly what was and was not verified — re-read it before re-running.
- The Editroom clone lives in `%TEMP%\editroom-src` and will not survive a machine reset; re-clone with `git clone --depth 1 https://github.com/robbietilton/Editroom`.
- Editroom ships new versions often (v1.0.2 on 2026-11-24). If more than 90 days pass, re-check its README, `MCPTools.definitions`, and the `ExportSheet.swift` loudness presets before trusting the numbers above.
- `verify-all.cjs` writes `docs/product/BASELINE.md` by default — pass a different path to record a comparison run.
