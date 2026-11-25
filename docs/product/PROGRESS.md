# PROGRESS — AiFilmora

**Last cycle:** 2026-11-25 · **Mode:** `teardown` + `modernize` planning (master-application path)
**Workspace:** `D:\000000 Lab\AiFimora` · **Branch:** `main` (no branch created — this cycle produced docs and a mock only; no product code was touched)

---

## Capabilities (observed this cycle)

| Capability | State | Evidence |
|---|---|---|
| Git | ✅ present, clean tree before this cycle | `git status --porcelain` → only this cycle's new files |
| Node + Playwright | ✅ present | `node_modules/playwright`, chromium-1243 in `%LOCALAPPDATA%\ms-playwright` |
| Dev server | ✅ works | `node server.cjs` → `http://127.0.0.1:8765`, HTTP 200, 106 491 bytes |
| App renders | ✅ | headless Chromium 1680×1000 → **0 console errors** |
| Electron shell | ⚠️ not launched this cycle | `electron/main.cjs` inspected statically only |
| Test suite | ⚠️ exists, **not run** | `verify-*.cjs` (11 scripts) — no test runner invoked |
| Build / packaging | ❌ not run | `npm run dist` not invoked |
| Network | ✅ | GitHub clone + fetch both succeeded |
| Subagents | ✅ 4 used in parallel | `explore` ×4 (UI/design, AI-MCP, engine, self-audit) |
| Browser control | ✅ | `mcp_browser` available; Playwright used instead (scriptable, reproducible) |

## Stage log

| Stage | Status | Output |
|---|---|---|
| 0B Baseline | ✅ done | Capability audit of 52 features, `file:line` evidence → `RESEARCH-EDITROOM.md` §4 |
| 1 Concept | ⏭️ skipped | Existing app with a stated vision in `ARCHITECTURE.md`; the concept was **derived**, not invented |
| 2 Research + teardown | ✅ done | `RESEARCH-EDITROOM.md` — Editroom source teardown + 52-item capability matrix |
| 3 Sketch | ✅ done | `SKETCH.md` — 5 wireframes + IA + data-model changes |
| 4 Architecture | ⏭️ not needed | No product code written this cycle |
| 5 Prototype | ✅ done | `design/timeline-v2-mock.html` — interactive mock, both states rendered |
| 6 Build MVP | ⏭️ **next cycle** | Backlog prepared in `ROADMAP.md` (36 items, 6 waves) |
| 7 Test/fix/retest | ⏭️ next cycle | `verify-*.cjs` suite not yet run |
| 8 Harden | ⏭️ next cycle | |
| 9 Release | ⏭️ next cycle | |

## What was actually produced this cycle

- `docs/product/RESEARCH-EDITROOM.md` — Editroom teardown with observed/derived/inferred labels, 52-capability matrix for AiFilmora, upgrade/integrate/skip tables, portability notes, and an explicit "not verified" section.
- `docs/product/ROADMAP.md` — 36-item backlog (`APP-001`…`APP-036`) across 6 waves, each with priority, value, effort, confidence, acceptance criteria and a verification step.
- `docs/product/SKETCH.md` — wireframes for Timeline v2, Inspector v2, AI Mate v2, the MCP architecture, and the semantic library search; plus the information architecture and the data-model changes implied.
- `design/timeline-v2-mock.html` — an interactive, self-contained HTML mock with a **Today / Proposed** comparison, an agent-presence toggle, collapsible inspector sections, and rendered synthetic filmstrips and waveforms.
- `design/shots/` — 5 rendered captures of the mock (`mock-today`, `mock-proposed`, `mock-agent`, `mock-narrow`, `mock-lane-v1@3x`).
- `research/editroom-benchmark/shots/` — 16 captures of the **current** AiFilmora app (the visual baseline the mock is measured against).

## Key findings (one line each)

1. Editroom's moat is **legibility**, not editing verbs — AiFilmora already has most of the verbs.
2. AiFilmora's timeline shows **no frames, no waveform, no clip state**; Editroom's shows all three.
3. Editroom exposes a **43-tool MCP server** on loopback; AiFilmora has none, and its `store` is already a clean command surface to expose.
4. Editroom's **draft isolation** (agents edit a hidden copy; the live project changes only on Apply, as one undo step) is the pattern that turns a chatbot into an editor.
5. AiFilmora's transcript, LUFS and scene detection are **simulated or fake**, not merely absent — the highest-priority items are honesty fixes, not features.
6. AiFilmora **already exceeds** Editroom on colour scopes, AI-provider breadth, asset library depth, token discipline and shortcut remapping — do not rewrite those.

## Exact next step

Run **Wave 0** of `ROADMAP.md` (6 truth fixes, APP-001…APP-006) on a branch `modernize/2026-11-25`, then re-run the `verify-*.cjs` suite to establish the regression baseline **before** Wave 1 opens.

**Before starting Wave 0, this needs a decision from the user** (see `docs/product/ROADMAP.md` for the full table):

- Confirm the priority order — the roadmap proposes truth fixes before features, but if the goal is a visible product differentiator rather than correctness, Wave 1 (filmstrips + waveforms) could be pulled forward instead.
- Confirm the platform target for the media layer (APP-007/008/009/030): browser-only with WebCodecs, or Electron with an FFmpeg/Whisper sidecar. This changes the effort on roughly a third of the backlog.

## Things NOT done (do not assume these exist)

- ❌ No product code was written or modified. `js/`, `css/`, `index.html`, `electron/` are untouched.
- ❌ The `verify-*.cjs` suite was **not executed** — no pass/fail claim is made about the current build.
- ❌ `npm run dist` was not run; no installer was produced or tested.
- ❌ The Electron shell was not launched; Electron-specific behaviour is **unverified**.
- ❌ No FFmpeg, WebCodecs or ASR implementation was attempted or benchmarked.
- ❌ Editroom's "plays 4K in realtime" was **not** measured — it is a README claim with bench harnesses but no recorded numbers.
- ❌ Editroom's git history was truncated by a shallow clone — **no feature-evolution history** was obtained.
- ❌ `MagicShow.swift` (84 KB) and `TimelineCanvas.swift` (103 KB) were not read in full; some choreography and drag mechanics are inferred from APIs.

## Repeat-run notes

- `docs/product/RESEARCH-EDITROOM.md` §7 lists exactly what was and was not verified — re-read it before re-running so a cycle does not redo settled work.
- The Editroom clone lives in `%TEMP%\editroom-src` and will not survive a machine reset; re-clone with `git clone --depth 1 https://github.com/robbietilton/Editroom` before the next teardown.
- Editroom ships new versions often (v1.0.2 on 2026-11-24). If more than 90 days pass, re-check its README, `MCPTools.definitions`, and `ExportSheet.swift` loudness presets before trusting the numbers above.
