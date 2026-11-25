# ROADMAP — AiFilmora

**Source of truth for status.** Derived from `docs/product/RESEARCH-EDITROOM.md` (Editroom teardown) and `docs/product/PROGRESS.md`.

Priorities: **P0** = data loss / security / release-blocking · **P1** = core job broken or missing, severe UX problem · **P2** = important, not core · **P3** = cosmetic or speculative.
Within a priority, order by Value × Confidence ÷ Effort, respecting dependencies.
Status: `proposed` · `approved` · `in-progress` · `done-verified` · `done-unverified` · `blocked` · `rejected`.

**Thesis:** *Make the timeline tell the truth.* Build one media-understanding layer (frames, peaks, transcript, tags); render it in the timeline; then make every agent action visible on the timeline and land as one undo step.

> **Superseded for the next phase by `docs/product/AUDIT-2026-11-25.md`** (2026-11-25). The waves below are still the right shape, but the audit found that the app's *middle* is real while its *two ends* are not — there is **no encoder**, so ~40 capabilities cannot reach the user's screen, and the AI tier charges credits for fabricated output. The audit's §4 ranks five upgrades (4.1 real export · 4.2 portable projects · 4.3 keyboard-first · 4.4 edit-by-text · 4.5 MCP agent surface); the next build item is **the user's choice** between them.

---

## Wave 0 — Truth fixes (correctness; do these before anything else)

> These are not new features. They are places where AiFilmora currently claims something it does not do — a marker that renders as `NaN`, a speed-ramp curve the player ignores, a LUFS number wired to a fake gain, AI edits that bypass the undo stack. Ship these first: they cost little and they buy back trust in everything else.

| ID | Title | Pri | Value | Effort | Conf | Status | Acceptance criteria | Verification |
|---|---|---|---|---|---|---|---|---|
| APP-001 | Fix marker geometry (writer/renderer mismatch) | P1 | Markers are a designed feature that renders broken | S | High | done-verified | Writer stores `{t, name, color}`; renderer reads the same shape; flag renders at the correct x with no `NaN`; marker is a snap target and a playhead jump target | Playwright: add marker → assert DOM `left` is a finite number equal to `t × pxPerSec`; screenshot at 3 zoom levels |
| APP-002 | Honour `speedRamp.curve` in the player | P1 | Speed ramping is advertised and does not play back | M | High | done-verified | A clip with `speedRamp` plays at varying rate across the ramp span; the ramp graph in the inspector matches the rendered output | Playwright + instrumented `player.js`: play a ramped clip, sample playback rate at 5 points, assert monotonic change matching the curve |
| APP-003 | Cross-track ripple trim semantics | P1 | Ripple exists but never moves other tracks | M | High | done-verified | `rippleGap` is passed by callers; ripple trim on the playhead shifts **all** tracks when nothing is selected, and only selected clips' tracks (+ linked partners) when something is | Unit-style test on `js/state.js` fixtures: 2-track project, ripple trim, assert track B start shifts by the same delta |
| APP-004 | Replace the fake LUFS mapping with real measurement | P0 | `js/volume-panel.js:184-197` maps a typed LUFS to `100 + (lufs+14)*3` — a fabricated gain | M | Med | done-verified | Either implement ITU-R BS.1770 measurement over decoded audio (48 kHz, K-weighting, 400 ms blocks @ 75 % overlap, −70 LUFS absolute gate, −10 LU relative gate) **or** remove the LUFS input and label the control honestly as a relative level | Unit test of the measurement function against 3 reference signals (sine at −20 dBFS, pink noise, silence) with expected LUFS ±0.5; if removed, assert no `lufs` field remains in the export path |
| APP-005 | Every AI mutation is undoable | P0 | `removeSilence()` (`js/ai-studio.js:489-514`) calls `store.set({clips})` without `pushUndo` | S | High | done-verified | No code path mutates clips/tracks without a preceding `pushUndo`; audit finds zero exceptions | Grep audit of `js/ai-studio.js`, `js/workflows.js`, `js/creative-tools.js` for `store.set(` without a nearby `pushUndo`; Playwright: run each AI action, press Ctrl+Z, assert the timeline is byte-identical to before |
| APP-006 | Truthful media import | P0 | `js/media.js:282` coerces `mkv/avi` to `video/mp4` — silent failure | S | High | done-verified | Unsupported containers are **detected and reported** with a per-clip compatibility badge; no false MIME is written | Playwright: import a `.mkv` → assert a visible "unsupported / needs conversion" badge, not a broken tile |

**Wave 0 exit criteria:** no AI operation is un-undoable; no advertised control is inert; no media import fails silently. All six carry `done-verified` before Wave 1 opens.

---

## Wave 1 — Media understanding (the keystone)

> One `MediaAnalyzer` produces frames, audio peaks, transcript words and scene tags, cached as JSON keyed by `path|size|mtime` (Editroom's exact cache key and version pattern). Everything in Waves 2–4 reads from this cache.

| ID | Title | Pri | Value | Effort | Conf | Status | Acceptance criteria | Verification |
|---|---|---|---|---|---|---|---|---|
| APP-007 | Scrub cache + filmstrip thumbnails on video clips | P1 | The timeline currently shows no footage — blind editing | M | High | done-verified | Video clips render real frames on a **power-of-two time grid** (tiles never resample while scrolling); a `Strip` toggle switches thumbnails ↔ flat type colour; frames are extracted by seeking a `<video>` and drawing to canvas, reusing the existing `probeVideo` technique (`js/media.js:309`); extraction happens off the main render path and is cached per asset | Playwright: import a video → assert ≥3 `<img>` inside the clip DOM; screenshot the timeline and confirm visible imagery; measure extraction time for a 60 s clip (< 1.5 s budget) |
| APP-008 | Real audio peaks + waveform rendering on audio clips | P1 | The loudest "not a real NLE" tell (`css/timeline.css:405` is a gradient) | M | High | done-verified | Peaks are computed from decoded audio (`decodeAudioData` → min/max per bucket), cached per asset; the waveform renders as an **RMS filled shape from the lane bottom** (silence → a thin line, so pauses are findable), replaced by the CSS placeholder | Playwright: import audio → assert a canvas/SVG waveform node exists in the clip; assert silence regions render as a thin line; visual diff against a reference render |
| APP-009 | Real ASR feeding the transcript panel | P1 | The transcript is fabricated (`js/text-edit.js:5-17`); blocks captions, filler removal and search | L | Med | **done-verified** (pipeline); real binary not run | An Electron sidecar runs Whisper over NDJSON and returns **real word timings**; the transcript panel renders real words with times; filler removal operates on real timings; the sample transcript is **labelled as a sample** rather than passed off as real | `verify-sidecar.cjs` → 48/48, including a **real Electron run**: the utility process starts, the renderer reaches it over IPC, whisper JSON is parsed into 2 segments / 9 words with token timings, the `-ojf`→`-oj` fallback works, and the "no whisper" path reports itself. **No real whisper binary exists on this machine** — the command construction and JSON parsing are proven, the model is not |
| APP-010 | Scene tags + semantic library search | P1 | Editroom's "Find any moment" — search what is *shown* and what is *said* | M | Med | proposed | Per-frame tags (luma/sharpness/motion/colourfulness/faces computed in-browser) plus transcript-derived phrases are cached; the media search field resolves **quoted** queries to transcript matches and **plain** queries to tag/name matches; results highlight matching times | Playwright: search `beach` → assert tagged clips match; search `"exact spoken phrase"` → assert the clip with that transcript matches |

**Wave 1 exit criteria:** an imported video appears in the timeline as frames, an imported audio track appears as a waveform, and the library search returns semantic matches. This single wave is what makes the app credible.

**Sidecar (landed with APP-009):** `electron/sidecar/` — an FFmpeg / ffprobe / Whisper worker that runs as an Electron `utilityProcess` and speaks newline-delimited JSON. It discovers the tools (never installs them), converts footage the browser cannot decode, pulls poster frames, and transcribes speech with real word timings. It degrades honestly: with no tools installed the app says which are missing and behaves exactly as the browser build does. Full manual, including what was and was not verified: **`docs/product/SIDECAR.md`**. APP-010 is still open, so Wave 1 is not yet complete.

---

## Wave 2 — Timeline visual language

> Editroom's timeline is an instrument: every state a clip carries is visible on it. This wave makes ours do the same.

| ID | Title | Pri | Value | Effort | Conf | Status | Acceptance criteria | Verification |
|---|---|---|---|---|---|---|---|---|
| APP-011 | Clip state badges | P1 | A clip can be frozen, reversed, ramped, graded or gain-adjusted and the timeline shows none of it | M | High | proposed | Video clips render suffix badges for `Freeze`, speed (`120%`), `Reversed`, gain dB; graded clips render a colour-wheel dot + look name; badges are legible at 100 % zoom and collapse gracefully when the clip is narrow | Playwright: create each clip state → assert a badge node with the right text; screenshot at 1× and 0.5× zoom |
| APP-012 | Transition wedges on the timeline | P2 | Transitions exist but are invisible where they apply | S | High | proposed | A transition renders as a wedge/arrow between the two clips it joins, coloured by transition family; hovering reveals duration and type | Playwright: apply a dissolve → assert a transition node between the clips; screenshot |
| APP-013 | Timecode ruler ladder | P2 | A fixed tick set cannot serve variable zoom | S | High | proposed | The ruler uses a 20-step ladder of `(seconds, subdivisions)` and picks the first step whose pixel width ≥ 86 px; labels are timecode, with a frame suffix when the major step is < 1 s | Playwright at 5 zoom levels → assert tick spacing and label format |
| APP-014 | Trim affordances, pixel-space snapping, snap suspension | P1 | Snapping behaviour changes with zoom; no way to suspend it | M | High | proposed | Trim edge zone = `min(7px, max(2px, w/4))` with a white 3.5 px edge bar; hovering an edge of a selected clip shows that edge on all selected clips; snap thresholds are in **pixels** (8 px, 6 px for scrub/cut/markers) so behaviour is zoom-invariant; holding a modifier suspends snapping | Playwright: zoom 0.5×→4×, assert the same snap target is chosen at each zoom; assert modifier suspends snapping |
| APP-015 | Per-track gain + level meter | P1 | Track headers have mute/solo/hide/lock but no level, and the app has no meters | M | High | proposed | `GainPill`: drag = 0.15 dB/pt, click = type, Esc cancels; `LevelMeter`: 6 px strip, 2 px segments, yellow > −12 dB, red > −3 dB, peak-hold, clip indicator at the top; the program monitor honours per-track gain | Playwright: drag a gain pill → assert dB readout changes by the expected amount; assert solo mutes other tracks in the mix |
| APP-016 | Ripple-safe drag & drop with live undo coalescing | P1 | Continuous drags can spam the undo stack | M | Med | proposed | A drag/trim produces **one** undo step, coalesced within 800 ms, and is discarded if cancelled | Playwright: perform a 2 s drag → assert the undo stack depth grew by exactly 1 |

---

## Wave 3 — Inspector redesign

> Editroom's inspector is the reference model: adaptive sections, persisted collapse, and an **accent dot when a collapsed section has been modified** so nothing changes silently.

| ID | Title | Pri | Value | Effort | Conf | Status | Acceptance criteria | Verification |
|---|---|---|---|---|---|---|---|---|
| APP-017 | `InspectorSection` model: collapsible, persisted, modified-dot | P1 | The inspector is one flat list of 12 tabs; users cannot see what they changed | M | High | proposed | Sections are uppercase 10 px semibold labels with `kerning 1.6`; a chevron rotates 0→90°; collapse state persists per section title; a trailing **Reset** appears only when expanded **and** the section differs from default; **a collapsed but modified section shows an accent dot**; Transform/Transitions/Fade/Grade are collapsed by default | Playwright: modify a value in a collapsed section → assert the accent dot appears; assert collapse persists across reload |
| APP-018 | Three colour wheels + grade copy/paste | P2 | Colour craft parity with Editroom; no way to reuse a grade | M | High | proposed | Shadows/Midtones/Highlights wheels (radius × 0.22, angles 0°/120°/240°) render and apply to `js/color-engine.js`; `copyGrade`/`pasteGrade` exist, and pasting an empty grade **clears** the grade (double-optional semantics) | Unit test of wheel → luma-weight math; Playwright: grade a clip, copy, paste onto another, assert both grade objects match |
| APP-019 | LUT import UI (.cube) | P2 | The parser exists; there is no way to load a user file | S | High | proposed | A file picker loads a `.cube`, validates size 2–256, trilinear-samples it, and adds it to the FX LUT dropdown with a live-graded thumbnail | Playwright: set an input file → assert the LUT appears in the dropdown and the graded thumbnail renders |
| APP-020 | Inspector adapts to selection | P2 | The inspector shows one thing regardless of what is selected | S | High | proposed | Nothing selected → *Sequence* (Frame, Frame rate); clip selected → clip sections with the clip's name as the header title; caption selected → *Caption* + *Style* | Playwright: assert the header title and section list for each of the three selection states |

---

## Wave 4 — Agent, export, and interoperability

> Editroom's bet is that the editor is an **agent surface**. AiFilmora's AI Mate is a regex chatbot. This wave turns it into a real editor with a real protocol.

| ID | Title | Pri | Value | Effort | Conf | Status | Acceptance criteria | Verification |
|---|---|---|---|---|---|---|---|---|
| APP-021 | MCP server over loopback HTTP | P1 | Puts AiFilmora inside Claude Code, Codex and any MCP client — the 2026 distribution channel | M | High | proposed | A Node HTTP server on `127.0.0.1:<port>/mcp` implements `initialize`, `ping`, `tools/list`, `tools/call`; protocol versions `2025-06-18`, `2025-03-26`, `2024-11-05`; `Mcp-Session-Id` header; `Host`/`Origin` localhost checks returning `403` otherwise; `tools/list` answers **without the app running**; read-only tools declare `readOnlyHint`; tool count ≥ 25 covering project/media/timeline/property/structure | Protocol test with a hand-written JSON-RPC client: initialize → tools/list → tools/call per read-only tool; assert `403` for a non-local Origin; assert `tools/list` succeeds with the Electron app closed |
| APP-022 | `@mention` system in AI Mate | P1 | Makes the AI precise instead of guessy | M | High | proposed | `@playhead`, `@selected`, `@in-out`, `@clip:`, `@marker:`, `@media:` are parsed and highlighted in the prompt; an autocomplete lists them ordered by likely use; `@selected` appears **but disabled** with "Select clips first" when nothing is selected; mentions resolve to concrete times/clip sets before the model sees them | Playwright: type `@` → assert the suggestion list; type `@playhead` → assert the resolved prompt contains a timecode |
| APP-023 | Draft isolation + plan preview + one-undo AI edits | P1 | AI edits currently apply instantly with no preview and sometimes with no undo | L | Med | proposed | An AI run applies to a **hidden copy** of the project; the plan is shown before commit; on commit the whole run is **one** undo step; the user can cancel before commit and nothing changes | Playwright: run a multi-step AI action → assert the undo stack grew by exactly 1; assert the pre-commit preview matches the post-commit timeline |
| APP-024 | Agent presence on the timeline | P2 | Automation you can watch is automation you trust | S | Med | proposed | While an external agent works, a named cursor with a colour-coded tag appears on the timeline at the affected clip, bobs while active, and fades after 12 s idle; the editor is inert during the run | Playwright with a simulated agent run → assert the presence node appears, moves, and fades |
| APP-025 | Export loudness targets with real measurement | P1 | Export has no loudness control at all; the volume panel's LUFS is fake (APP-004) | M | High | proposed | Export offers **As mixed**, **−14 LUFS · web, YouTube**, **−16 LUFS · podcasts**, **−23 LUFS · broadcast**; the mix is measured first, then gain `min(target − measuredLUFS, −1 − peakDB)` is applied to every audio track | Unit test of the target/gain maths; Playwright: assert the export dialog exposes the three named targets |
| APP-026 | Export shape + drag-to-reframe | P2 | Shape presets are crop-only, with no framing choice | M | High | proposed | Export offers Sequence shape / Vertical 9:16 / Square 1:1 / Portrait 4:5; choosing a different aspect enables a **drag-to-reframe crop control** that picks the crop centre (0…1); the output size is computed and shown | Playwright: choose Vertical → assert the reframe control appears; drag it → assert the exported crop centre changes |
| APP-027 | In/out points + range-only export | P1 | Dead icons exist (`js/icons.js:46-47`) for a feature that was never built | M | High | proposed | In and out points are settable, shown as a lit band with brackets on the ruler, adjustable by dragging, clearable, and drive a "Range: In to out / Whole timeline" export option | Playwright: set in/out → assert the export sheet shows the range; export with `rangeOnly` → assert the output duration matches |

---

## Wave 5 — Shell, states, and shipping

| ID | Title | Pri | Value | Effort | Conf | Status | Acceptance criteria | Verification |
|---|---|---|---|---|---|---|---|---|
| APP-028 | Command palette (Ctrl+K) | P1 | 52 capabilities and no fast surface | S | High | proposed | Ctrl+K opens a fuzzy palette over every action in `js/shortcuts.js` plus the AI action set; type → filter; Enter runs; Esc closes; focus returns to the origin | Playwright: Ctrl+K → type "ripple" → Enter → assert the ripple action ran |
| APP-029 | Loading / skeleton / empty / error state kit | P1 | There are **no** loading states in the codebase; long ops look hung | M | High | proposed | A shared state kit provides loading (skeleton reserving plausible geometry), empty, zero-result, error and no-access variants; applied to LUT parse, asset scan, AI jobs, export; toasts and AI Mate get an `aria-live` region | Playwright: assert a skeleton appears during an async asset scan and disappears on completion; assert `aria-live="polite"` on the toast container |
| APP-030 | FFmpeg sidecar for exotic formats | P1 | MXF/MKV footage fails today | M | Med | proposed | An Electron UtilityProcess sidecar probes with ffprobe and converts with ffmpeg using a rewrap→transcode ladder; a per-clip compatibility badge shows the state | Import a real `.mkv` fixture → assert it plays in the program monitor and shows a decoded thumbnail |
| APP-031 | Auto-update (`electron-updater`) | P2 | Every release currently needs a manual download | S | Med | proposed | `electron-updater` checks for updates after launch, shows a "What's new" panel listing the release notes, and supports Install-and-relaunch / Remind me later / Skip this version | Manual test against a staged release feed (no live release) |
| APP-032 | Width-based responsive breakpoints | P2 | Zero width media queries; nothing reflows on a narrow window or second monitor | M | High | proposed | Layout reflows at defined widths; the inspector collapses to an overlay below the narrow breakpoint; the timeline keeps a usable minimum; both themes hold up | Playwright at 1280 / 1024 / 900 / 700 CSS px → screenshot each; assert no horizontal scroll and no clipped controls |
| APP-033 | Undo history panel | P2 | 50 labelled steps exist but the user cannot see them | S | High | proposed | A history list shows the step labels in order with the current position; clicking a step jumps to that state | Playwright: perform 5 edits → assert 5 labelled entries; click entry 2 → assert the timeline matches step 2 |
| APP-034 | Close gaps / magnetic timeline | P2 | Snapping exists but gaps are never closed | S | Med | proposed | A "Close gaps" action per track and globally; a magnetic toggle keeps tracks butted together as clips are moved | Playwright: delete a middle clip → assert the following clip shifts left |
| APP-035 | True reverse decode | P3 | Reverse currently mirrors time rather than decoding backwards | L | Low | proposed | A reversed clip plays its source in reverse (frame order inverted), with a fallback to the mirrored approximation when the codec cannot do it | Playwright: import a clip with a visible time cue → assert the reversed playback shows the cue reversed |
| APP-036 | Design mock discipline (`design/` folder) | P3 | The repo has no design mocks; Editroom's designer worked in HTML | S | High | proposed | A `design/` folder holds HTML/CSS mocks for each significant surface change, checked into the repo and referenced from the roadmap item | Files exist in `design/` and are linked from the relevant roadmap rows |

---

## Wave 6 — Audit upgrades (2026-11-25)

> Added by `docs/product/AUDIT-2026-11-25.md`. The audit's core diagnosis: **the middle of this app is real; the two ends are not.** The entry point is 8 gradient placeholders and the exit is a silent 720p WebM while the export sheet promises 4K H.265 — and the AI tier charges credits for fabricated output. These five items are the ranked way out. **Which one to build first is the user's call**; each is still `proposed` until then.

| ID | Title | Pri | Value | Effort | Conf | Status | Acceptance criteria | Verification |
|---|---|---|---|---|---|---|---|---|
| APP-037 | Real export: encode the file you actually asked for | P0 | There is **no encoder**, so ~40 capabilities (LUFS targets, caption burn-in, the music/voiceover/Audio-FX/fade/duck stack, per-clip gain, per-track solo) terminate in a file that cannot hold any of them | M | High | proposed | The sidecar gains an `encode` op (WebM → the requested container/codec/resolution/fps); `readFilmoraExportSettings()` is bound so the six export controls are live; the audio mix bus is tapped into the output so the file has a sound track; the fallback is explicitly labelled ("Quick preview export · 720p · no audio") when FFmpeg is absent | Export a 4-clip project → assert the file is H.264/AAC MP4 at the requested resolution, with an audible audio track; assert the browser-only fallback says so in its own words |
| APP-038 | A project file you can actually reopen | P0 | The project file carries **no media** — opening it elsewhere gives "N imported files missing"; the autosave also dies early (measured: the empty demo project is 1,167,019 bytes, **99.4 % base64 thumbnails**, 22.3 % of the 5 MiB quota) | M | High | proposed | Every media item records its `sourcePath`; the snapshot omits `data:` thumbnails (they live in IndexedDB); opening relinks by path and offers relink for anything missing; `QuotaExceededError` is caught specifically and surfaced as a persistent toast, not a `console.warn` | Open a saved project on a second profile → assert every clip is relinked without re-import; fill the quota → assert a visible error appears instead of a silent freeze |
| APP-039 | Keyboard-first timeline and real focus management | P1 | `js/timeline.js:1046` builds clips as inert `<div>`s — **the entire inspector is unreachable without a mouse**; modals never take, trap or restore focus; the status dot is dead code that is always reassuringly green | M | High | proposed | Clips are focusable with a keyboard handler (Enter/Space/Delete/arrows) and `role="option"`; a shared `openModal()` moves focus in, traps Tab and restores it on close; `#statusDot` reflects real job state with an `aria-live` sibling | Tab to a clip → assert focus lands on it; open a modal → assert focus moved inside and Tab cycles; trigger a failing job → assert the dot goes to the error state |
| APP-040 | Edit by text: the transcript becomes the editing surface | P1 | The category's most-requested feature (r/Filmora_Official: *"gaps in sound and filler words cut automatically"*). The word timings **already exist** (APP-009); the cutting does not — "Silence & filler removal" currently scales every clip by a fixed ratio and charges 8 credits | L | Med | proposed | Words are selectable inside a transcript line; selecting a sentence cuts the timeline to it; `cutWordRange()`, `removePauses(threshold)` and `removeRetakes()` are store verbs that each take **one** undo step; the fake silence removal is replaced by the real one and stops charging credits | Transcribe a fixture → select a sentence → assert the timeline cut matches the word timings exactly; assert one Ctrl+Z restores it |
| APP-041 | The agent surface: MCP over the store, with the perception tools attached | P2 | Five independent 2026 projects (vedit, Cutline, WeftCut, MakeMyClip, OpenChatCut) converged on MCP + perception. AiFilmora already owns the timeline, the shared undo, and **all five perception tools** — frames, peaks, word timings, beats, loudness. Only the transport is missing | L | Med | proposed | A loopback MCP server exposes the store's 60+ verbs plus `get_frames`, `get_waveform_summary`, `get_transcript`, `detect_scenes`, `detect_silence`, `music_beats`, `loudness` and `preview_frame` (the real rendered frame); every mutating tool supports `dry_run` and lands as one undo step; bound to `127.0.0.1` with a bearer token and DNS-rebinding protection | Connect an MCP client → call `get_transcript` → assert real word timings; call `splitAtPlayhead` → assert the timeline changed and one Ctrl+Z undoes it |

---

## Deliberately not on this roadmap

| Item | Reason |
|---|---|
| Native AVFoundation / VideoToolbox pipeline | Windows-first target; the equivalent is WebCodecs + the FFmpeg sidecar (APP-030). |
| `FoundationModels` / Apple Intelligence local path | No Windows equivalent. **AiFilmora already exceeds it** — Ollama and LM Studio are live in `js/ai-providers.js:59-70`. |
| `SpeechTranscriber` (macOS 26+) | Superseded by APP-009 for our platform. |
| Sparkle / appcast update feed | Replaced by APP-031 (`electron-updater`). |
| Claude-desktop `.mcpb` extension bundle | macOS-path-bound; the Claude Code / Codex config routes in APP-021 are cross-platform and sufficient. |
| Apple Log / HLG / PQ source colour transforms | Camera-format-specific; revisit only if ProRes/Log footage becomes a stated requirement. |
| Full colour wheels before waveforms | Wrong order — the timeline is the credibility surface. |
| Rebuilding the undo stack or the shortcut system | Both are already good (`js/state.js:120-163`, `js/shortcuts.js:9-39`). Preserve, extend. |

---

## Summary

| Wave | Items | Theme | Gate |
|---|---|---|---|
| 0 | 6 | Truth fixes | Nothing advertised is inert; nothing AI-done is un-undoable |
| 1 | 4 | Media understanding | The timeline shows real frames and real waveforms |
| 2 | 5 | Timeline visual language | Every clip state is visible on the timeline |
| 3 | 4 | Inspector redesign | The inspector cannot hide a change silently |
| 4 | 7 | Agent + export + interop | An external agent can drive the editor, and every run is one undo step |
| 5 | 9 | Shell, states, shipping | The app has fast surfaces, honest states, and installs itself |
| 6 | 5 | Audit upgrades | The user gets a real file out of the app, can reopen the project, can drive it from the keyboard or by text, and an agent can drive it too |
| — | 41 total | | |
