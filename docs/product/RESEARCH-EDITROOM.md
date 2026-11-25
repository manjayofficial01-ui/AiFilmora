# Teardown — Editroom (robbietilton/Editroom) → AiFilmora

**Stage:** 2 (research & feature teardown) of the master-application path.
**Reference app:** https://github.com/robbietilton/Editroom — "Fast and powerful video editing for Mac", MIT, Swift 92.3%, 58 stars, v1.0.2 (build 3), 370 commits, last commit 2026-11-24.
**Subject app:** AiFilmora 2.2.7, `D:\000000 Lab\AiFimora` — Windows-first web/Electron NLE (pure HTML/CSS/JS, no build step).

**Authorization & scope.** Editroom is a public MIT repository. Analysis was **static and read-only**: a shallow clone into `%TEMP%\editroom-src`, source reading only. No binary was executed, no code was copied. All AiFilmora findings are static analysis plus a headless Chromium render of the running app. Editroom is macOS 14+/Apple-silicon native; AiFilmora targets Windows. **Rebuild, don't copy** — every recommendation below is re-specified for a web/Electron/Canvas stack.

**Evidence labels.** `observed` = read directly in source or observed in a render. `derived` = a conclusion I drew from observed facts. `inferred` = plausible but not verified. `unknown` = not checked.

---

## 0. Executive summary

Editroom is a 2026-native, 7.5 MB macOS editor whose real differentiators are **not** the editing verbs — those are table stakes and AiFilmora already has most of them. Its differentiators are four things:

1. **The timeline is an instrument.** Clips carry *actual filmstrip frames*, audio clips carry *actual waveforms*, transitions render as wedges, clip state renders as badges, and the ruler is a 20-step timecode ladder. AiFilmora's timeline is flat colour rectangles (`observed` — see §4.1).
2. **An external agent can drive the editor.** Editroom exposes a **43-tool MCP server** on loopback HTTP (`observed`, `Editroom/MCP/MCPServer.swift:50`), and the agent's edits are *performed* on the timeline by a swarm of named cursors and land as **one undo step** (`observed`, `Editroom/Magic/MagicShow.swift`, `AgentPresence.swift`).
3. **The editor understands its own media.** On-device transcription, Vision scene tags, MusicAnalyser beat/energy analysis, and a *semantic* library search ("quoted words match what's said; plain words match what is shown") (`observed`, `Editroom/Engine/Transcripts.swift`, `SceneTags.swift`, `Editroom/Magic/MediaAnalyzer.swift`, `Editroom/UI/LibraryView.swift`).
4. **Its inspector is a model of restraint.** Collapsible, persisted, and — critically — a **modified-but-collapsed section shows an accent dot**, so nothing changes silently (`observed`, `Editroom/UI/InspectorView.swift:659`).

**The single most valuable takeaway for AiFilmora is not a feature — it is a direction.** Editroom is *legible*: every edit, every agent action, every hidden state is visible on screen. AiFilmora is currently *powerful but opaque*: it has 52+ capabilities, several simulated, and a timeline that shows almost none of them. The gap is not capability count; it is **truthfulness and legibility of the timeline**.

**Highest-leverage recommendation:** build a real media-understanding layer (frame extraction + audio peaks + ASR + semantic tags) and render it directly into the timeline. That single stack unlocks filmstrips, waveforms, transcript search, semantic search, "find the moment" AI, and MCP `look_at_media` — and it fixes the app's most visible credibility gap, which is a timeline with no real frames and no real waveform.

---

## 1. Editroom's architecture, in brief

`observed` throughout this section.

### 1.1 Document model

`Project` (`Editroom/Model/Project.swift:282`) is a flat `Codable` value: `width=1920 height=1080 fps=30`, `videoTracks: [Track]`, `audioTracks: [Track]`, `clips: [Clip]`, `assets: [MediaAsset]`, optional `markers`, `inPoint`/`outPoint`, `captions`, `captionFixes`, `magicHistory`.

`Clip` (`:86`) carries `kind` (`.video/.audio/.image/.solid/.text`), `assetID`, `start`, `duration`, `sourceStart`, `speed`, `fadeIn/fadeOut` + `fadeInCurve/fadeOutCurve`, `gainDB`, `linkID` (A/V link), `text: TextStyle`, `grade: ColorGrade?`, `transform: ClipTransform?`, `transitionIn: Transition?`, `freeze`, `reversed`, `ramp: SpeedRamp?`, `captioned`.

`Track` (`:14`): `kind`, `hidden`, `muted`, `gainDB`, `solo`, `locked`, `duckUnder`, `duckDB = -12`.

### 1.2 Undo model — the pattern to steal

`EditorModel.mutate` (`Editroom/Model/EditorModel.swift:713`) copies the project, applies a closure, sanitises, and pushes the **previous** project onto an `undoStack` capped at 200. `live(autoCommit:)` coalesces a continuous drag into one step, auto-committing after **0.8 s** (`:754`); `discardLive()` throws it away. `amendLastStep` merges into the last entry.

AiFilmora already does the equivalent with 50 snapshot steps (`observed` — `js/state.js:120-163`) and already has a rebindable shortcut system (`js/shortcuts.js:9-39`). **Do not rewrite either.** The missing piece is the *label + history panel*, and the invariant that **one agent tool call = one undo step**.

### 1.3 Editing semantics worth adopting verbatim

| Verb | Editroom semantics | Portability to AiFilmora |
|---|---|---|
| Ripple remove | `rippleRemove(a,b,tracks)` (`:602`) splits at both edges, deletes clips inside, shifts clips after `b` left by `b-a` **on those tracks** | High — pure array math on `js/state.js` clips |
| Ripple trim | `rippleTrimRange` (`:1504`) uses **all** tracks when nothing is under the playhead, and only the selected clips' tracks (+ linked partners) when something is selected | High — this is the exact semantics users expect |
| Retime / sticky | `retime(ids:sticky:)` (`:639`) keeps changed clips butted together, later ones slide by the delta, overlaps pushed later; `carried(by:)` (`Project.swift:678`) makes touching clips ride along | High |
| Close gaps | `closeAllGaps(on:)` (`Project.swift:829`) | High |
| Freeze | `freezeFrame(seconds hold: 2)` (`EditorModel.swift:1680`) | Already present in AiFilmora (`js/state.js:644`) |
| Detach audio | `unlink(ids:)` (`Project.swift:840`) — breaks `linkID` | Already present (`js/state.js:694`) |
| Reverse | `reversed` + `reversedFrom: ReverseSource` | Present but **mirrored-time only**, not a true decode (`js/player.js:160-166`) — `observed` |

**Gap in AiFilmora:** ripple exists but the `rippleGap` parameter at `js/state.js:513,541` is **never passed** by any caller (`js/timeline.js:357,366`), so the shift is same-track only and the cross-track "move together" semantic does not exist (`observed`).

### 1.4 Markers & in/out

`Marker` (`Project.swift:309`): `id`, `time`, `name`, `tint` (6 fixed hexes). Markers are **snap targets**, **edit points** for playhead jumping, and survive in/out cropping. `inPoint`/`outPoint` drive **looping**, **export range** (`ExportSettings.rangeOnly` → `cropped(to:)`) and snapping.

AiFilmora: markers are **partially broken** — the writer stores `{t,name}` while the renderer reads `m.start/m.end`, so the flag geometry is `NaN` (`observed` — writer `js/filmora-parity.js:243-253`, renderer `js/timeline.js:629-634`). There is **no** in/out point model at all; `iconMarkIn/iconMarkOut` exist in `js/icons.js:46-47` and are **dead code** (`observed`). That is a P1: the UI affordance was designed and never wired.

### 1.5 Realtime playback — what "plays 4K in realtime" means in code

`observed`:
- Preview render size capped at 1920 long side; YUV 8/10-bit pixel buffers kept in the decoder's format (no RGB round-trip); Metal-backed `CIContext` via `kCVPixelBufferMetalCompatibilityKey`; colour conversion happens *after* scaling.
- A **spare `AVPlayer`** primes ahead (`handoffPrep * 1.5 + 0.03` s) and swaps in, so an edit never interrupts playback (`Engine/PlaybackEngine.swift:390`).
- Seeks are coalesced (one in flight, latest wins); scrub mode uses a 0.75 s slack window, exact when the scrub rests (`:226`).
- `ScrubCache` pre-decodes frames at **rate 12/s**, `maxSide 1920`, into per-video files (`.scrub709`, mmap'd, ≤ 6 GB, LRU evicted). `ScrubStrips` builds **JPEG 480 px** strips of 24–120 frames.
- `AudioScrubber` renders the mix into memory and plays it at 32 kHz through a low-latency callback (`snippet = 0.08 s`, max 45 min).

The **README claim of 4K realtime is a claim, not a measured guarantee** — the repo has `--bench` and `--reverse-bench` harnesses but no recorded numbers (`unknown`).

### 1.6 Import ladder — "opens any format"

`MediaStore.importFile` (`Engine/MediaStore.swift:110`) probes with AVFoundation first; **only if AVFoundation cannot read the file** does it fall back to `FFmpeg.makePlayable` (`:695`). The ladder is (1) stream-copy `-c copy -tag:v hvc1` into `.mov`; (2) plain stream copy; (3) transcode `h264_videotoolbox -q:v 70 -pix_fmt yuv420p`; each step re-probed. FFmpeg resolution: bundled binary → `/opt/homebrew/bin` → `/usr/local/bin` → `/usr/bin`.

AiFilmora has **no FFmpeg and no fallback**: `js/media.js:282` coerces `mkv/avi` to `video/mp4` (a false MIME), and the Electron import filter (`electron/main.cjs:44`) omits `mxf`/`mkv` (`observed`). MXF/MKV footage therefore fails silently.

### 1.7 Content understanding

| Layer | Mechanism | Data shape |
|---|---|---|
| Transcripts | Apple on-device `SpeechTranscriber` (macOS 26+) | `Transcript { words: [Word{start,end,text}], language }`, cached JSON; search API `says(_:)`, `snippet(_:)`, `occurrences(_:)`, `speech(gap: 0.45)`, `sentences(gap: 0.8)` |
| Scene tags | Vision `VNClassifyImageRequest`, confidence ≥ 0.2, kept when max ≥ 0.35; ~20 frames sampled ≤640 px; Apple Intelligence keywords ≤12 @ 0.6 | `SceneTags { tags: [Tag{name,confidence,times}] }` |
| Media analysis | Per-frame `luma`, `sharpness` (Laplacian variance), `motion` (frame diff), `color` (Hasler–Süsstrunk), `faces` (Vision), `aesthetic`/`utility` (Vision aesthetics) | `ClipAnalysis.Sample`, cached by `path|size|mtime`, `version = 2` |
| Music analysis | vDSP FFT spectral-flux onset envelope → autocorrelation tempo weighted toward 120 BPM → beat grid + bar phase from bass energy | `MusicAnalysis { bpm, beats, barPhase, energy }` |

**Matching is lexical, not embeddings** — singularisation, `sameStem` suffix stripping, and a large alias table (`"portal"→door`, `"swimming pool"→pool`). `derived`: this is deliberately simple and cheap, and it is the *right* complexity for a local-first editor. AiFilmora can match this with a tag table, no model needed.

### 1.8 Colour pipeline

`ColorGrade` (`Model/ColorGrade.swift:4`): `look` (built-in name **or a `.cube` path**), `lookIntensity`, `exposure` (−2…2), `contrast` (−50…50), `saturation` (−100…100), `temperature`/`tint` (−50…50), plus three `WheelPoint` wheels (shadows/midtones/highlights; radius × 0.22, angles 0°/120°/240°).

`GradeRecipe.apply`: exposure gain `pow(2,exposure)`; luma weights `0.2126/0.7152/0.0722`, `sh = 1-l`, `mid = 4l(1-l)`; contrast `1 + contrast/50*0.6`; saturation. **Everything bakes into one 32³ `CIColorCube`** (`GradeBaker`, cached ≤200 entries) so viewer and export share one lookup.

`SourceColor.swift`: `.standard/.hlg/.pq/.appleLog/.appleLog2` → 64³ cube; HLG diffuse white 0.2647, PQ 203 nits, highlight knee 0.9, primaries matrixed Rec.2020→709.

Copy/paste uses `copiedGrade: ColorGrade??` — a **double-optional**, so "no grade" pastes as "clear grade" (`observed`). AiFilmora has **no grade copy/paste** (`js/color-engine.js:70` — grade entry only) (`observed`).

### 1.9 Speed ramps

`SpeedRamp` (`Model/SpeedRamp.swift:7`): `inFrom/inTo/outFrom/outTo` (seconds **in the clip's source**), `startSpeed`, `endSpeed`; the clip's own `speed` is the mid value. `speed(at:)` blends in **log speed** with a smoothstep ease (`exp(log a + (log b − log a)·e)`) so 100%→400% feels even. `span(from:to:)` integrates piecewise with **Simpson's rule, n = 24**. `source(from:after:)` inverts it with 40-iteration bisection. `shifted(by:)`/`mirrored(length:)` keep ramps valid across trims and reversal.

AiFilmora: presets store `speedRamp.curve` (`js/speed-panel.js:152-183`) but **no read path exists in the player** — playback is constant-rate (`observed`). The field is written and never honoured. That is a **correctness bug wearing a feature's clothes**.

### 1.10 Audio & loudness

- One audio renderer lane per track on a shared clock; queued 0.2 s ahead; readers start 0.25 s early and drop the first 0.25 s to avoid decoder clicks; each lane reads at its own dominant rate (8 k–192 k, else 48 k) to avoid resampling artefacts.
- `LoudnessMeter.measure` implements **ITU-R BS.1770**: 48 kHz, K-weighting (high-shelf + high-pass biquads), 100 ms mean-square steps, **400 ms blocks at 75 % overlap**, absolute gate **−70 LUFS**, relative gate **−10 LU**, `lufs = −0.691 + 10·log10(power)`, plus sample peak.
- `duckGain`: attack 0.15 s, release 0.5 s.

AiFilmora: `js/volume-panel.js:184-197` maps a typed LUFS number to a **fake gain** (`100 + (lufs+14)*3`) with no measurement anywhere (`observed`).

### 1.11 Export

`ExportSettings` (`Engine/Exporter.swift:5`): `format` `.mp4`/`.wav`; `codec` H.264/HEVC; `quality` high/web; `height`; `includeAudio`; `loudness: Double?`; `shape`; `reframe: CGPoint`; `rangeOnly`.

- **Shape** = `.original`, `.vertical` (16:9), `.square` (1:1), `.portrait` (4:5). `renderSize` names the short side, rounds to even pixels. `crops(project)` is true when output aspect differs > 0.01; `reframe` then chooses the crop centre (0…1).
- **Loudness presets** (`UI/ExportSheet.swift:76`): *As mixed* (nil), **−14 LUFS** (web/YouTube), **−16 LUFS** (podcasts), **−23 LUFS** (broadcast). Export **measures the mix first**, then applies `gain = min(target − measuredLUFS, −1 − peakDB)` to **every** audio track so the result sits 1 dB under full scale.
- Pipeline: `CompositionBuilder.build` → `AVAssetReader` + `AVAssetWriter`; `AVAssetReaderVideoCompositionOutput` through a custom `TimelineCompositor`; H.264 High Auto Level; keyframe interval `fps*2`; bitrate `w·h·min(fps,60)·bpp`, bpp **0.2** high / **0.085** web, ×**0.62** HEVC; AAC 256 k/160 k (or PCM 24-bit WAV 48 kHz stereo); frames re-tagged Rec.709 to stop the encoder double-converting.

AiFilmora's export is a **MediaRecorder → WebM → disk save** (`js/export.js:410-561`) with no codec choice beyond container/bitrate labels, **no loudness target**, and shape presets that are crop-only (`observed`).

### 1.12 Self-test taxonomy — free specification

`App/SelfTest.swift` (~144 KB) is a headless harness (`--selftest <mediaDir> <outDir>`, `--bench`, `--reverse-bench`). Its **log tags are the product specification as a test matrix**: `IMPORT, EXPORT, TIMECODE, TRACKS, SPEED, RAMP, STICKY, RIPPLE, RANGE, MARKER, TRANSITIONS, FREEZE, REVERSE, GRADE, FILM, AUDIO, DUCK, METERS, LOUDNESS, CAPTIONS, CAPTION, SHAPES, SHOWING, VIEW, PLACEMENT, SEARCH, LOCAL, MAGIC, AI, AGENT, MCP, MENTIONS, HISTORY, RELINK, RELOAD, OPENING, MEDIA, DOWNLOAD, SHORTCUTS, GRIP, AUTO`.

`derived`: AiFilmora's `verify-*.cjs` suite is the same idea but keyed by *feature implemented*, not by *invariant*. Editroom's taxonomy is behaviour-keyed — it would catch the AiFilmora-class bug (ramp curve written but never read) that a feature checklist misses.

---

## 2. The AI / agent architecture — the biggest strategic divergence

### 2.1 MCP server (observed)

- Transport: **Streamable HTTP, loopback only**. `NWListener` with `params.requiredInterfaceType = .loopback` (`MCPServer.swift:50`); endpoint `http://127.0.0.1:47920/mcp`. `POST`/`DELETE` only. `Mcp-Session-Id` header carries a UUID session created on `initialize`.
- Protocol versions: `["2025-06-18", "2025-03-26", "2024-11-05"]`; `initialize` echoes the client's version or defaults to `2025-06-18`. `capabilities = {tools:{listChanged:false}}`, `serverInfo = {name:"editroom", title:"Editroom", version:"1.0"}`, plus `instructions`.
- **Auth: none** — security is locality: `Host` must be `127.0.0.1`/`localhost`/`[::1]`, `Origin` must be localhost, path must start `/mcp`; otherwise `403`.
- **Handshake without the app**: `MCPHandler.handshake` answers `initialize`, `ping`, `tools/list` with the editor closed; `MCPBridge` (`Editroom --mcp`) answers those itself, so opening a new chat never launches the app (`MCPBridge.swift:68-82`).
- **stdio bridge**: `Editroom --mcp` reads stdin lines, POSTs each to the local endpoint (600 s timeout), writes one line per reply. On a real request it launches the app via `NSWorkspace.openApplication` and retries ~80× at 0.25 s (~20 s).
- `?draft=<token>` query addresses a **hidden draft** project (`:130-140`).
- Port 47920 in use → re-listen on an ephemeral port.

### 2.2 Tool catalogue — 43 tools (`observed`)

| Group | Tools |
|---|---|
| Read/inspect | `get_project`, `list_media`, `list_looks`, `analyze_media`, `get_transcript`, `look_at_media`, `search_media`, `get_frame`, `export_status` |
| Media I/O | `note_media`, `import_media`, `download_media` |
| Timeline edits | `add_clip`, `add_title`, `add_solid`, `set_solid_color`, `move_clip`, `trim_clip`, `split_clip`, `delete_clips`, `duplicate_clip`, `freeze_frame`, `reverse_clip`, `detach_audio` |
| Property edits | `set_speed`, `set_speed_ramp`, `set_transform`, `set_grade`, `set_audio`, `set_transition`, `set_title_style`, `set_captions` |
| Structure | `add_track`, `set_track`, `set_sequence`, `set_marker`, `delete_markers`, `set_in_out` |
| Transport/history/IO | `playback`, `history`, `auto_edit`, `save_project`, `export` |

Read-only tools carry `annotations.readOnlyHint = true`. `import_media`, `auto_edit`, `save_project`, `export` are refused while a Magic edit is in flight (`notInMagic()`).

### 2.3 Agent presence — the signature UX (`observed`)

`Editroom/Magic/AgentPresence.swift`: each connected agent gets a **parked cursor** — a cursor image plus a name tag on a transparent borderless child window over the editor. It bobs (`sin(now*2.2 + hash)`), fades after `AgentPresence.linger = 12.0` s of inactivity, then is removed (30 Hz tick). Colour identity: Claude = orange `(0.85,0.47,0.34)`, Codex/ChatGPT = green `(0.06,0.64,0.50)`, others = FNV-1a hash → hue.

Serialization: everything is `@MainActor`; `MagicShow.perform` waits while another show is running. An external agent's edits are played by a **single named cursor** as sequential tasks (`after: [i-1]`) — one tool call = one undo step. Track-level **locks** are enforced ("That clip is on a locked track.").

### 2.4 The draft isolation model — the highest-value idea (`observed`)

`Editroom/Magic/MCPDraft.swift`: a draft is a **hidden copy of the project** addressed by a token UUID in the MCP URL. It holds `base`, `project`, `steps: [[MagicEdit]]`, `undone`, `playhead`, `calls`, `lastTool`. Each tool call appends one step (so `history` undoes a whole call). `undo/redo` rebuild from `base` + `steps`.

Two planning functions:
- `inSteps(base:edits:)` converts consecutive ripple-deletes into plain deletes + a "Close gaps" step (human-like).
- `resultPlan(base:edits:)` **diffs base vs final** to synthesise one elegant reveal plan (new clips fly straight to their final position; moves/trims/grades each get their own cursor), verified to land exactly, else falls back to the raw step plan.

`plan(base:edits:)` computes dependency ordering via per-edit `Footprint` (clip ids, track spans, barrier/setting/lift/transition flags) into `MagicTask(edit:after:delay:)`.

**The draft is the isolation boundary: the agent never mutates the live project until the show plays the plan — and then it is one undo step.**

### 2.5 The prompt surface (`observed`)

`UI/MagicPopover.swift` (380 pt), `UI/MentionField.swift`:
- Capsule button shows **who** is working (Claude / ChatGPT / Local) with a spinner; status text sits left of it and grows away from the button; hovering while working offers **Stop** in the same space; a `sparkles` glyph means a finished result is waiting.
- Segmented switch **Claude | ChatGPT | Local** mirroring the timeline's select/cut tool switch.
- Guided connect: *Get the Claude app* → *Finish in the Claude app* → *Connect Claude* ("No API key needed") → *Open Claude Code once* → prompt form.
- **@-mentions**: `@playhead`, `@selected`, `@in-out`, `@media:`, `@clip:`, `@marker:`. Mentions are **bolded in the text**. The list is ordered by likely use; `@selected` is shown **but disabled** with "Select clips first", teaching the affordance before it works. 25 pt rows, ↑/↓/Return/Tab/esc, esc dismisses only that `@`. Typing letters narrows markers **and** files in one list.
- Mention resolution: marker names → times; `@playhead`/`@selected` → concrete time ranges and clip sets before the agent sees them. `MagicMention.find` ignores `me@example.com` (requires a non-word char before `@`), longest-name-wins, whole-word boundary enforced.
- Progress stages: **Looking → Analyzing → Thinking → Editing**; the latest tool call is shown then reverts to the stage after 1.5 s.
- **While the agent works, the whole editor is inert** — no hover, no scrub, no resize (`ContentView.swift:44`).
- Result: `MagicNoteView` — agent logo, markdown body with clickable links, **Undo** (only if `note.changed`) and **Done**.

### 2.6 Local (on-device) path (`observed`)

`LocalBrain.swift` parses a `LocalRecipe` (seconds, pace, look, music, frame, keepOnly/takeOut, moments, shots, speed, soundEffects, levelAudio, title, cannotDo) two ways: Apple's on-device model via `FoundationModels` (`@Generable`/`@Guide` structured output), or pure regex heuristics. Critically, `LocalBrain.checked(_:against:)` **re-validates the model's output against the request words** and drops settings nobody asked for — explicit distrust of model over-reach.

Siblings: `LocalImprover` (improve an existing edit), `LocalPointed` (small edits on what you pointed at), `LocalAdd` (add clips at a position), `LocalRamp`, `LocalSpeech` (cut pauses/filler), `LocalCaptions`, `LocalTitle`, `LocalCombined` (chained as one undo step).

### 2.7 Media download (`observed`)

`MCP/MediaDownload.swift`: https only (file:// only when explicitly allowed), 120 s timeout, rejects `text/html`/`json` with "That link is a web page, not an audio file", ≤200 MB, infers extension from URL/suggested filename/mime, validates with AVFoundation (≥1 s of audio, else deletes), and appends to `Sources.txt` (file, ISO date, source page, licence). **Licence provenance is recorded on disk.**

---

## 3. UI/UX teardown — what Editroom's interface actually does

### 3.1 Shell (`observed`)

`ContentView.swift:23-51`: `VStack { HStack { LibraryView | PreviewView | Hairline | InspectorView }; Splitter(horizontal); TimelinePanel }`.

- Library 252 pt default, clamped 190–440. Preview flexible. Inspector **fixed 320 pt**. Timeline 360 pt default, clamped `max(200, geo.height − 240)`.
- The `Splitter` (`Theme.swift:460`) is a 1 pt hairline that shows **only** the resize cursor on hover (Mac split-view convention); a brighter line appears while dragging; it **hard-disables while Magic works**.
- Chrome vs workspace is a real distinction: chrome = `Theme.panel`, workspace = `Theme.bg` (timeline lanes), with a 1 pt `panelTopLight()` highlight along panel top edges.
- Density: header rows 44 pt, toolbar 44 pt, inspector header 44 pt, transport 76 pt, track-header column 176 pt.

### 3.2 Design tokens (`observed`, `Theme.swift`)

One `Palette` struct (`:62`) with **four instances**: `dark`, `grey`, `amber`, `light`; `enum AppTheme { auto, dark, grey, amber, light }`.

| Token | dark | grey | amber | light |
|---|---|---|---|---|
| `bg` | `0x0A0A0A` | `0x1C1C1C` | `0x100B06` | `0xE3E3E0` |
| `panel` | `0x111111` | `0x232323` | `0x18120A` | `0xF4F4F2` |
| `lane`/`laneAlt` | `0x0D0D0D`/`0x0A0A0A` | `0x1F1F1F`/`0x1C1C1C` | `0x130E08`/`0x100B06` | `0xEAEAE7`/`0xE3E3E0` |
| `raised`/`field` | `0x1A1A1A`/`0x181818` | `0x2D2D2D`/`0x2A2A2A` | `0x261C10`/`0x22190E` | `0xFFFFFF`/`0xFFFFFF` |
| `text`/`textDim`/`textFaint` | `0xF2F2F0`/`0x9A9A96`/`0x5C5C59` | `0xF2F2F0`/`0xA6A6A2`/`0x6F6F6C` | `0xF7E7CF`/`0xB39B7C`/`0x76634C` | `0x1C1C1B`/`0x5F5F5B`/`0x98988F` |
| `accent` | `0xFF4A1C` | `0xFF4A1C` | `0xFFA43A` | `0xF0451A` |
| `sheet` | `0x141414` | `0x262626` | `0x1A140C` | `0xF4F4F2` |

**The mechanism to steal: a single `ink`-at-opacity tint model.** Chrome tints are `ink` (white in dark, black in light) at `strokeAlpha 0.085–0.11`, `hoverAlpha 0.055–0.075` — one mechanism for strokes, quiet fills and hovers, instead of per-component greys. Fixed accents: `NS.alert = 0xFF4A1C` (always), `NS.snap = 0xF2C14E` (meter yellow), `NS.meterLow = 0xD9D9D6`.

Clip type colours (flat, Premiere-like): video/image `0x3A5A80`, audio `0x2F6A47`, text `0x664675`, solid `0x7A6428`; clip strokes `0x2C2C2C`; offline `0x5A1F1F`. Selection flips white-on-dark → `0x1C1C1B` on Light.

Type: `Theme.label(10)` = `.system(size:10, weight:.semibold)` uppercase with `kerning(1.6)`; `Theme.mono(size, weight)`. Radii ladder: 5, 6, 7, 8, 9, 10, 12.

**Gap:** Editroom has **no spacing token scale** — padding is literal per view (`observed`). Do not copy that mistake.

### 3.3 Timeline UX (`observed`)

`TimelineLayout.swift`: `ruler 26`, `zone 26`, `gap 1`, `divider 9`, `headerWidth 176`, `captionRow 30`, `fixedHeight = 61`.

- **Ruler** (`TimelineCanvas.swift:1502`): a **20-step ladder** of `(seconds, subdivisions)`; picks the first step whose pixel width ≥ 86. Major ticks `ink(0.28)`, minor `ink(0.13)`, labels `Timecode.short`, frame suffix when `major < 1`.
- **Markers** (`:1552`): coloured flag + name, tinted per `Marker.Tint`; click opens a `MarkerPanel` popover (270 pt) with name field, tint swatches, delete, and a list of all markers with times. Dragging a flag moves it.
- **In/out**: lit band `ink(0.06)` + white brackets; a `RangeReadout` chip in the toolbar shows In/Out/length, clickable to seek, ✕ to clear.
- **Playhead**: separate layer-backed `PlayheadView` (width 16) so moving it never redraws clips (`:12`); auto-scrolls at 28 pt from the edge; hidden off-screen.
- **Zoom**: custom `ZoomScrollBar`/`RowScaleBar` with **grips** — drag a grip to zoom, centred on the playhead via a `mirror` ratio; `gripDrag` binary-searches to clamp length; row zoom snaps to whole point heights; `BarDrag` captures the start state so drags cannot drift.
- **Clip encoding** — the crown jewel:
  - radius `min(7, w/2)`;
  - a **`Strip` toggle** switches thumbnails ↔ flat type colour;
  - filmstrip tiles are source-aspect and sampled on a **power-of-two time grid** so tiles never resample while scrolling (`:1934`);
  - ramped clips use a fixed grid so frames do not blink;
  - **audio = RMS filled shape from the lane bottom** (silence → a thin line, so pauses are findable);
  - title strip 17 pt with a black scrim;
  - **suffix badges** `Freeze`, `120%`, `Reversed`, gain dB;
  - **graded clips get a colour-wheel dot + `● Warm film` / `Graded`**;
  - transitions render as **wedges** between clips (visible in `docs/screenshot.webp`).
- **Affordances**: trim edge zone `min(7, max(2, w/4))` with a white 3.5 pt edge bar; hovering an edge of a selected clip shows that edge on *all* selected clips; fade dots exist only when a fade is set (radius 4 → 5.5 hot, accent colour) and the longer fade is drawn last so it takes the click; audio gain is a draggable horizontal line.
- **Snapping**: thresholds are in **pixels** (8 pt, 6 pt for scrub/cut/markers) so behaviour is identical at any zoom; holding ⌘ temporarily **disables** snapping; a haptic tap fires on each new snap.
- **Selection**: marquee selects clips and auto-includes linked A/V; a box over the caption row selects captions instead; ⌥-drag duplicates.
- **Track headers** (`TimelinePanel.swift:549`): `V1`/`A1` mono 11.5 semibold in a 24 pt column; `MiniKey` hide/lock 20×20 r5; `LetterToggle` M/S; **`GainPill`** (drag sideways = 0.15 dB/pt, click to type, Esc cancels); **`LevelMeter`** 6 pt wide, 2 pt segments, yellow > −12 dB, red > −3 dB, peak-hold, clip light at the top.
- **Empty state**: "Drag media here, or double-click it in the library" centred across V1.

### 3.4 Inspector UX (`observed`)

`UI/InspectorView.swift` — 320 pt wide, 44 pt header with symbol + adaptive title (`Sequence`, clip name, `N clips`, `Caption`/`N captions`).

- **Adaptation**: caption selection → *Caption* + *Style*; nothing selected → *Sequence* (*Frame*, *Frame rate*); selection → clip sections.
- **Section order**: Solid/Text → **Playback** (Volume, Speed + ramp graph) → **Transform** → **Transitions** → **Fade** → **Grade** → **Text**.
- **`InspectorSection`** (`:623`): uppercase 10 pt semibold label (`kerning 1.6`), chevron rotates 0→90°, collapse persisted in `UserDefaults` under `inspector.collapsed.<Title>`, optional trailing **Reset** link shown only when expanded, and an **accent dot when collapsed but modified** (`marked`) — *a changed section is never silently hidden*.
- **Progressive disclosure**: `collapsedByDefault: true` for Transform, Transitions, Fade, Grade.
- **Control types**: `ParamRow` = 18 pt icon + label + `ThinSlider` (2 pt track, 13 pt knob, accent fill) + typed value field, with optional `logarithmic` mapping (speed 10–5000 %, scale 5–1000 %); `MenuField` for enums; `ColorField`; three `ColorWheel`s; `CurveMenu` for fade curves; `FrameSizeFields`; `FontPicker`; `TextEditor`.
- **Edit model**: `model.live(autoCommit:false)` + `model.commitLive()` on release → one undo step; speed/ramp always recompute from an `origin` snapshot so rounding never accumulates.

### 3.5 Library (`observed`)

`UI/LibraryView.swift`: "MEDIA" header + import spinner + Add Text / Add Solid / Import; search field; thumbnails (adaptive grid, min 88) or list layout (`@AppStorage MediaLayout`); thumb width grows 64→104 with panel width; **search is semantic** — *quoted* words match **what is said** (transcripts), plain words match **name or scene tags**; progressive typing; offline assets marked; tiles used by the current selection get a ring; empty state "Imported media appears here".

### 3.6 Export sheet (`observed`)

`UI/ExportSheet.swift`: two columns — 284 pt form + **388 pt live preview**; 84 pt label column; 28 pt fields, radius 8. Rows: Filename, Location, **Range** (In-to-out / Whole timeline), Format (MP4/WAV), **Loudness** ("As mixed", −14 LUFS web/YouTube, −16 podcasts, −23 broadcast), **Resolution** (Source/4K/1440p/1080p/720p with computed W×H), **Shape** (Sequence shape, Vertical 9:16, Square 1:1, Portrait 4:5) with **drag-to-reframe crop**, Codec, Quality (High/Web), Audio toggle. **Stats strip**: display size, fps, estimated MB/GB.

Completion: background export queue; toolbar `ExportProgressPill` shows a 72 pt bar + "42% · 0:12 left", and states "Export failed" / "Exported"; its popover lists jobs with cancel / Show in Finder / Clear Finished.

### 3.7 First launch (`observed`)

`design/first-launch-mock.html` (1480×940; rows 44 px / 1fr / 380 px; columns 260 / 1fr / 320) is an **empty-state first run, not a wizard**: viewer drop zone "Drop video, audio or images anywhere" + "or press ⌘I to import · MP4, MOV, MKV, WebM, WAV, MP3, JPG, PNG"; Media "Imported media appears here"; timeline "Drag media here, or double-click it in the library"; inspector shows *Sequence → Frame* (1920 × 1080 + W/H fields) and *Frame rate* (30 fps + "Matches the first video you import."); Export dimmed, Delete disabled, Snap/Skim on. **No multi-step onboarding flow** — the mocks encode empty states, not a tutorial.

### 3.8 Settings (`observed`)

`UI/SettingsView.swift` — 600×640, custom tab row (icon over name): **General, Shortcuts, Magic, Updates**. *General*: theme swatches, View (media layout, "Show time as" 00:00:05:15 / 0:05.50), Saving (auto-save). *Shortcuts*: search box, grouped by `ShortcutAction.Group` (File, Edit, Playback, Tools, Clip, Mark, View); a recorder captures the next key press; **conflicts explain themselves** — "⌘⇧S was Save As's shortcut, so Save As no longer has it." (6 s note); defaults in code, overrides in `UserDefaults("shortcuts")`; each action holds multiple combos.

---

## 4. AiFilmora's current state — the honest baseline

Static audit of `D:\000000 Lab\AiFimora` plus a headless render at 1680×1000 (`research/editroom-benchmark/shots/`, **0 console errors**).

### 4.1 Capability matrix (52 items)

Status legend: **P** = present, **Pt** = partial, **A** = absent. Evidence is `file:line`.

#### A. Timeline & editing

| # | Capability | Status | Evidence |
|---|---|---|---|
| 1 | Ripple trim (cross-track) | Pt | `js/state.js:513,541` (`rippleGap`) — never passed by callers `js/timeline.js:357,366` |
| 2 | Ripple delete vs. lift | **P** | `js/state.js:798`, `js/context-menu.js:88-95` |
| 3 | Detach audio | **P** | `js/state.js:694` |
| 4 | Freeze frame | **P** | `js/state.js:644` |
| 5 | Reverse clip | **P** | `js/state.js:685` — mirrored time, not true reverse (`js/player.js:160-166`) |
| 6 | Duplicate clip | **P** | `js/state.js:821` |
| 7 | Close gaps / magnetic | A | no `closeGap`/`magnetic` symbol |
| 8 | Markers | Pt | writer `{t,name}` `js/filmora-parity.js:243-253`; renderer reads `m.start/m.end` `js/timeline.js:629-634` → **NaN geometry** |
| 9 | In/out points | A | `js/icons.js:46-47` dead icons; no state fields |
| 10 | Source monitor | **P** | `js/filmora-parity.js:61-103` |
| 11 | Multi-track audio: solo/mute/level/meters/waveforms | Pt | solo `js/state.js:784`; **no per-track level, no meters** |
| 12 | Clip waveform | A | `css/timeline.css:405-417` is a `repeating-linear-gradient` placeholder |
| 13 | Filmstrip thumbnails on clips | A | `js/timeline.js:880-899` — no `<img>` in clip DOM |
| 14 | Undo/redo | **P** | `js/state.js:120-163`, depth 50, labelled; UI `js/filmora-parity.js:19-25` |
| 15 | Remappable shortcuts | **P** | `js/shortcuts.js:9-39` (31 actions); rebind UI `js/settings-panel.js:675-708` |
| 16 | Speed ramp on sub-range | Pt | `js/speed-panel.js:152-183` stores `curve`; **no read path in the player** |
| 17 | Split screen / PiP | **P** | `js/state.js:42`, `js/player.js:487-495` |
| 18 | Compound clips | **P** | `js/state.js:865-896` — shared `compoundId`, no nested renderer |
| 19 | Track reorder by drag | **P** | `js/state.js:927`, `js/timeline.js:855` |

#### B. Media & content understanding

| # | Capability | Status | Evidence |
|---|---|---|---|
| 20 | Exotic formats via FFmpeg | A | `js/media.js:282` coerces `mkv/avi`→`video/mp4`; `electron/main.cjs:44` lacks mxf/mkv; no ffmpeg |
| 21 | Format compatibility badge | A | no `compat` symbol |
| 22 | Real ASR | A | `js/text-edit.js:5-17` `SAMPLE_TRANSCRIPT` hardcoded |
| 23 | Transcript search | A | no search input in `js/text-edit.js` |
| 24 | Semantic visual search | A | no `semantic`/`searchClips` symbol |
| 25 | Scene detection | Pt | `js/ai-studio.js:385-410` — fixed interval from a slider, not frame-difference |
| 26 | Auto captions / burn-in | Pt | `js/ai-studio.js:351-383` synthetic cues; burn-in `js/export.js:480` |

#### C. AI / agent

| # | Capability | Status | Evidence |
|---|---|---|---|
| 27 | NL chat that mutates the timeline | Pt | ~25 regex intents `js/ai-studio.js:175-202`; free-form → `liveChat()` `:1084-1107` = **advisory text only** |
| 28 | @mentions | A | no mention parsing; `js/ai-studio.js:159-173` takes raw text |
| 29 | Plan preview before applying | A | no `planPreview`/`dryRun` symbol |
| 30 | Undo for AI edits | Pt | `js/ai-studio.js:400` pushes undo, but `removeSilence()` `:489-514` calls `store.set({clips})` **without** `pushUndo` |
| 31 | MCP server | A | no `mcp` in `js/` or `electron/` |
| 32 | On-device / local model | **P** | `js/ai-providers.js:59-70` Ollama `:11434`, LM Studio `:1234` |
| 33 | Multi-provider cloud AI | **P** | `js/ai-providers.js:10-77` — OpenAI, OpenRouter, Groq, DeepSeek, Mistral, Together, custom |
| 34 | Agent presence indicator | A | no agent/presence symbol |

#### D. Colour / audio / export

| # | Capability | Status | Evidence |
|---|---|---|---|
| 35 | LUT import (.cube) + library | Pt | parser `js/lut-engine.js:33`; 25 shipped `.CUBE`; **no user file import UI** in `js/lut-panel.js` |
| 36 | Colour scopes | **P** | `js/scopes.js:1-67` — waveform/parade/vectorscope/histogram, live from program canvas |
| 37 | Grade copy/paste | A | no `copyGrade`/`pasteGrade`; grade entry `js/color-engine.js:70` |
| 38 | LUFS normalisation / measurement | Pt | `js/volume-panel.js:184-197` maps a typed number to a **fake gain** (`100 + (lufs+14)*3`) |
| 39 | Export loudness target presets | A | `js/export.js:23-31` — resolution/codec only |
| 40 | Export shape + framing choice | Pt | presets `js/export.js:26-27`; `fx.reframe` `js/ai-studio.js:553-562` — crop-only |
| 41 | Export codec/bitrate options | **P** | `js/export.js:23-31,343-359,464-480` |
| 42 | Export progress + failure states | **P** | `js/export.js:410-561`, toasts `:222-226` |
| 43 | Auto-update | A | no `autoUpdater` in `electron/main.cjs` |

#### E. Design system & shell

| # | Capability | Status | Evidence |
|---|---|---|---|
| 44 | Token architecture | **P** | `css/tokens.css:18-97` — **64 tokens** in `:root` |
| 45 | Dark/light balance | Pt | `.theme-light` overrides **32 of 64**; `css/theme-vip.css` adds 42 more + 51 hardcoded hexes → the token system **forks** |
| 46 | Panel resizing | Pt | `js/panel-resize.js:25-40`, persisted; **no docking** |
| 47 | State coverage | Pt | empty states in 9 modules; **zero loading states** — no `spinner`/`skeleton`/`aria-busy` in the codebase |
| 48 | First-run | **P** | `js/app.js:544-572` modal (Empty/Demo/Assets/Skip) — UPGRADE-AUDIT.md:34 is stale |
| 49 | Command palette | A | no `palette`/`Ctrl+K` symbol |
| 50 | Accessibility | Pt | `css/app.css:35-39` `:focus-visible`; `css/app.css:1589` `prefers-reduced-motion`; 92 aria attrs; **no skip-nav, no ARIA live regions, no modal focus trap** |
| 51 | Responsive | Pt | **zero width-based media queries** (the only media query in the repo is `prefers-reduced-motion`) |
| 52 | Design mocks | A | no `design/` folder — only `index.html` |

### 4.2 Strengths to preserve (do not rewrite)

- **Real colour engine** — trilinear 3D LUT + per-pixel grade (`js/lut-engine.js:33-113`, `js/color-engine.js:70`) with 25 genuine `.CUBE` files. Editroom bakes to a 32³ cube; AiFilmora's per-pixel path is equivalent in effect.
- **Live colour scopes** off the program canvas (`js/scopes.js:1-67`) — Editroom has no scopes at all.
- **Deterministic, inspectable AI** — every "AI" action exposes its parameters in the timeline (`detectScenes` reports threshold; `removeSilence` reports threshold/pad/minDur) and mutates the store for real, not a fake progress bar. **Editroom's Local path is the same philosophy, and AiFilmora's is more transparent.**
- **Offline-first multi-provider AI** with 8 presets including local Ollama/LM Studio (`js/ai-providers.js:10-77`) — no credit meter, no cloud lock-in. **Editroom's cloud path requires the Claude or ChatGPT app; AiFilmora is strictly more flexible here.**
- **Real export path** — MediaRecorder → WebM → disk save with cancel/progress/status (`js/export.js:410-561`, `electron/main.cjs:53-60`).
- **31 remappable shortcuts with a rebind UI** (`js/shortcuts.js`, `js/settings-panel.js:675-708`) — Editroom's is better organised, but AiFilmora already has the harder half.
- **64 tokens, 490 `var(--…)` usages, only 25 hex literals** in `css/app.css` — the token discipline is real.
- **Real frame extraction already exists.** `probeVideo` (`js/media.js:309`) seeks a `<video>` element and grabs a real frame to canvas. **This is the single most important fact for the roadmap: a filmstrip scrub-cache is already one refactor away.**

### 4.3 Weakest areas, ranked by prosumer impact

1. **No real waveform anywhere** — CSS gradient placeholder only (`css/timeline.css:405`). A wave-less timeline is the loudest "not a real NLE" tell.
2. **No real ASR** — the transcript is fabricated (`js/text-edit.js:5-17`). This blocks transcript editing, caption accuracy, filler-word removal, and semantic search simultaneously.
3. **No FFmpeg** — MXF/MKV footage fails silently, and `js/media.js:282` fakes the MIME rather than reporting the problem.
4. **Timeline clips carry no state** — no filmstrip, no waveform, no transition wedge, no badge (freeze / reversed / speed / grade / dB). The timeline cannot tell you what is on it.
5. **AI Mate is regex-driven** (`js/ai-studio.js:175-202`); free-form language never mutates the timeline (`liveChat()` `:1084-1107`).
6. **No plan/preview before AI edits**, and some AI ops skip `pushUndo` (`js/ai-studio.js:489-514`) → trust risk.
7. **Markers are geometrically broken** (`m.start/m.end` vs `{t,name}`) and there is no in/out point model despite dead icons for it.
8. **Inspector is one flat list** (12 horizontal tabs, `FX · Motion · Speed · Audio · Text · Mate · Lab · Text edit · Scopes · AI · Creative`) — no collapsible sections, no "modified" indicator, no persisted collapse state. Editroom's `InspectorSection` model is directly transplantable and is a pure win.
9. **No command palette** in a 52-capability app.
10. **No MCP / external-agent surface** — the fastest-moving integration frontier in editing, and Editroom's implementation is only ~19 KB of Swift that ports to Node in an afternoon.
11. **No loading states at all** — LUT parse, asset scan, AI jobs and export have no pending UI; **no ARIA live regions** on toasts or AI Mate.
12. **No auto-update** (`electron/main.cjs`) — every release is a manual download.
13. **Zero width-based media queries** — nothing reflows on a narrow window or a second monitor.

---

## 5. Editroom → AiFilmora: what to upgrade, integrate, or skip

### 5.1 Upgrade in place (AiFilmora is already half-way)

| # | Editroom pattern | AiFilmora state | Action |
|---|---|---|---|
| U1 | Trim edge zone + white edge bar; hover shows the edge on all selected clips | Absent | Add to `js/timeline.js` drag handling |
| U2 | Snapping thresholds in **pixels** (8 pt / 6 pt), ⌘ suspends snapping, haptic tap on snap | `smartSnap` at `js/timeline.js:1183` (time-based) | Convert to pixel thresholds; add a modifier to suspend |
| U3 | `InspectorSection`: collapsible, persisted per title, **accent dot when collapsed but modified** | Flat list | Transplant the model into `js/filmora-chrome.js` |
| U4 | Track header `GainPill` (drag = 0.15 dB/pt, click = type) + `LevelMeter` (−12 dB yellow, −3 dB red, peak-hold, clip light) | mute/solo/hide/lock only | Add per-track gain + a meter strip |
| U5 | Clip state badges: `Freeze`, `120%`, `Reversed`, gain dB, colour-wheel dot + look name | Absent | Render from clip state in `js/timeline.js` |
| U6 | Transition wedge between clips | Transitions exist but are not visible on the timeline | Draw the wedge |
| U7 | Ruler = 20-step ladder, first step ≥ 86 px wide, frame suffix when major < 1 s | Fixed tick set | Adopt the ladder algorithm |
| U8 | `live(autoCommit:)` — one drag = one undo step, 0.8 s coalescing | 50 snapshot stack, no coalescing | Add live-commit to drag handlers |
| U9 | 3-way colour wheels (shadows/midtones/highlights) | 8-band HSL grade + LUT | Add three lift/gamma/gain wheels to `js/color-engine.js` |
| U10 | "Paste grade", with double-optional so "no grade" clears the grade | Absent | Add `copyGrade`/`pasteGrade` to `js/state.js` |
| U11 | Shortcut conflicts explained in words | Rebind UI exists, no conflict explanation | Add the 6 s explanatory note |
| U12 | Named loudness targets ("−14 LUFS · web, YouTube") | None | Add to `js/export.js` presets |

### 5.2 Integrate (new capability, high value)

| # | Capability | Why it matters here | Effort |
|---|---|---|---|
| I1 | **Real waveform rendering** from decoded audio peaks | Removes the single loudest "fake NLE" tell; enables beat-accurate visual editing | M |
| I2 | **Filmstrip scrub cache** on video clips (power-of-two time grid) | Blind editing becomes sighted editing; AiFilmora already has frame extraction in `probeVideo` | M |
| I3 | **In/out points + range-only export** | Dead icons already exist; unlocks "export just this part" | S–M |
| I4 | **@mention system** in AI Mate (`@playhead`, `@selected`, `@in-out`, `@clip:`, `@marker:`) | The cheapest way to make the AI actually precise | M |
| I5 | **Plan preview + one-undo-step AI edits** (the draft model, simplified) | Fixes the trust gap; turns a chatbot into an editor | M–L |
| I6 | **MCP server** (Node HTTP, loopback, `tools/list` + `tools/call`) | Puts AiFilmora inside Claude Code / Codex / any MCP client — the distribution channel of 2026 | M |
| I7 | **Agent presence** — a named cursor + tag on the timeline while an agent works | Legible automation; Editroom's most-loved-in-principle idea | S–M |
| I8 | **Real ASR** (Whisper via a sidecar, or Web Speech) | Unlocks transcript editing, captions, filler removal and search | L |
| I9 | **Semantic library search** ("quoted = what's said, plain = what's shown") | The most-loved feature in Editroom's README ("Find any moment") | M |
| I10 | **Command palette** (Ctrl+K) over the existing 31 shortcuts | 52 capabilities with no fast surface today | S |
| I11 | **FFmpeg sidecar** for MXF/MKV + a per-clip compatibility badge | Fixes real-world footage and stops silent failure | M |
| I12 | **Export loudness targets** with real BS.1770 measurement | Our current LUFS field is a fake gain — shipping it is a correctness bug | M |
| I13 | **Auto-update** (`electron-updater` + a Sparkle-style "what's new" panel) | Releases currently require a manual download | S |
| I14 | **Grade copy/paste + 3 colour wheels** | Colour craft parity | S–M |
| I15 | **Loading / skeleton / empty / error state kit** | Zero loading states today; long ops look hung | S |

### 5.3 Deliberately not built

| Editroom feature | Why not |
|---|---|
| Native AVFoundation / VideoToolbox pipeline | Windows-first; WebCodecs + FFmpeg sidecar is the equivalent. `unknown` — not attempted here. |
| `FoundationModels` / Apple Intelligence local path | No Windows equivalent. **AiFilmora already exceeds this** with Ollama/LM Studio (`js/ai-providers.js:59-70`). |
| `SpeechTranscriber` (macOS 26+) | Superseded by I8 for our platform. |
| Sparkle / appcast | Replace with `electron-updater` (I13). |
| `.mcpb` Claude-desktop extension bundle | macOS-path-bound; the Claude Code / Codex config routes are cross-platform and sufficient. |
| Apple Log / HLG / PQ source colour transforms | Camera-format-specific; revisit if ProRes/Log footage is a stated requirement. |
| Full 3-way colour wheels *before* waveforms | Wrong order — the timeline is the credibility surface. |

---

## 6. The strategic thesis

**AiFilmora should not try to be "Editroom for Windows."** Editroom's moat is native macOS media throughput. AiFilmora's moat is that it already has things Editroom lacks:

- **Live colour scopes** — Editroom has none.
- **A real, inspectable, offline-first AI provider layer** with 8 providers and local models — Editroom has exactly three (Claude / ChatGPT / Local) and two of them require a subscription app.
- **A deeper asset library** — 262 font faces, 29 colour presets, 76 audio FX, 150 animations, 192 filters, 25 real LUTs, 15 GPU-shader transitions.
- **An existing token system measured from Filmora's own skin**, and 490 token usages.
- **31 remappable shortcuts**, a rebind UI, and a 50-deep labelled undo stack.

**Where AiFilmora loses is exactly where Editroom wins: the media layer and legibility.** So the thesis is:

> **Make the timeline tell the truth.**
> Everything else — agent integration, semantic search, export parity — becomes cheap once the app genuinely understands its own media.

**Concretely: build one `MediaAnalyzer` that produces (a) frame thumbnails, (b) audio peaks, (c) transcript words, (d) scene tags — cache them as JSON keyed by `path|size|mtime` — and then render (a) and (b) directly into the timeline and expose (c) and (d) to search and to the agent.** Editroom's `MediaAnalyzer` is 22 KB of Swift for exactly this, and it is the keystone of the whole comparison.

**And one interaction thesis, borrowed wholesale:**

> **Every agent action is performed on the timeline, in view, by a named cursor, and lands as one undo step.**

Editroom never asks the user to trust a chat transcript. It shows the work. AiFilmora's AI Mate currently asks for exactly that trust (regex intents, no plan, some ops not undoable) — and that is why its free-form chat is advisory-only.

---

## 7. Verification performed

| Check | Result |
|---|---|
| Editroom clone | `git clone --depth 1` → `%TEMP%\editroom-src`; 130 files; read-only |
| Editroom source read | `UI/` (Theme, ContentView, TimelineCanvas, TimelinePanel, InspectorView, ExportSheet, LibraryView, SettingsView, MagicPopover, MentionField, ViewerScreen, PreviewView, ExportProgress, EditroomAlert, TimelineLayout), `Magic/` (11 files), `MCP/` (5 files), `Engine/` (13 files), `Model/` (5 files), `App/` (4 files), `design/*.html` (7 mocks) |
| Editroom visual reference | `docs/screenshot.webp` read and compared against our render |
| AiFilmora static audit | 52 capabilities checked with `file:line` evidence by a dedicated audit agent |
| AiFilmora render | Headless Chromium at 1680×1000 and 900×800; 16 screenshots in `research/editroom-benchmark/shots/`; **0 console errors** |
| AiFilmora visual findings | Timeline clips confirmed as flat solid rectangles with no `<img>` and no waveform; inspector confirmed as a flat single list; media-bin thumbnails confirmed as generated gradients for synthetic assets |
| Build/lint/test | **Not run.** No test runner was invoked; the `verify-*.cjs` suite exists but was not executed in this cycle |

**Not verified / unknown:**
- Editroom's `git log` was truncated by the shallow clone — **no feature-evolution history** was obtained.
- Editroom's "plays 4K in realtime" is a README claim with `--bench`/`--reverse-bench` harnesses but **no recorded numbers**.
- `MagicShow.swift` (84 KB) was not read in full — cursor choreography detail is partly inferred.
- `TimelineCanvas.swift` (103 KB) drag/sticky-trim mechanics were described from the `Project`/`EditorModel` APIs, not from the canvas code.
- AiFilmora's `speedRamp.curve` and `fx.reframe` were classified PARTIAL on a **static** read-path analysis; runtime behaviour was not instrumented.
- No Windows-side FFmpeg, WebCodecs or ASR implementation was attempted or benchmarked.
