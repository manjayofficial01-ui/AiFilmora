# AiFilmora — Product + Engineering Upgrade Audit

**Scope:** `index.html`, `js/*.js`, `css/*`, `assets/**`, `README.md`, `ARCHITECTURE.md`, `package.json`
**Version under audit:** 1.9.0 (`package.json`) — statusbar still says **1.4** (`index.html:1457`)
**Date:** 2026-09-16
**Method:** static source review + asset tree inventory. No code was changed.

---

## Executive summary

AiFilmora already has impressive *breadth* (48 JS modules, Filmora-derived LUTs/fonts/presets, multi-track timeline, AI Mate shell). The product risk is no longer missing feature names — it is **integration depth, ship hygiene, and first-run UX**.

Three structural facts drive most of this report:

1. **`assets/` is a full Wondershare Filmora install dump** — **1.71 GB / 6,298 files**, including `Filmora.exe`, 701 DLLs, 36 EXEs. `package.json` `build.files` includes `assets/**/*`, so every Electron build ships the competitor's binaries.
2. **Folder-based user assets (`assets/shapes`, `assets/transitions`) are first-class in copy, second-class in code** — one hand-written `manifest.json` each, no auto-scan, no drag-to-timeline, and custom transition *images never paint*.
3. **Undo is complete in the store but invisible in the UI** — `canUndo()`/`canRedo()` exist and are never called; toolbar buttons are never disabled; no Edit-menu labels; no undo toast with the action name on the button.

Ship-blocking items (P0) must land before any polish pass. The Top 10 list at the end is ordered so one implementation pass can clear the highest-leverage gaps.

---

## 1. UI/UX gaps vs Filmora / CapCut

### 1.1 Empty states & first-run

| Surface | Current | Filmora / CapCut | Gap |
|---|---|---|---|
| First boot | Auto-seeds 8 synthetic media + a demo timeline (`app.js:465–501`, `media.js:61–83`). One toast: “AiFilmora ready…”. | Project Library / template chooser; explicit “New project” vs “Open” vs “Try demo”. | **No choice.** Demo is forced; New Project (`app.js:145–150`) then produces a *different* empty experience. Users can't learn the empty→import→edit loop. |
| Empty timeline | One line of text (`timeline.js:635–640`): “Empty timeline — drag media…”. | CapCut: large drop zone + Import CTA + recent templates. Filmora: media library focused, timeline drop targets glowing. | Hint is not a drop target, has no Import button, no AI Mate CTA click. |
| Empty media bin | Text only (`media.js:560–563`). | Drop zone + “Import” + sample pack + cloud. | No visual drop affordance; Import lives only in a small sidebar button. |
| Source monitor | Stub canvas that draws “Source · select a media item” (`app.js:317–330`). | Real dual-monitor scrub of the source clip. | Dead UI — looks like a feature, does nothing. |
| Onboarding / coachmarks | None. | Filmora: first-run tour; CapCut: contextual tips. | New users land in a dense NLE with 11 inspector tabs and 6 library tabs. |

**Recommendation:** First-run modal with three paths (Empty / Demo / Open recent). Empty timeline becomes a real HTML5 drop zone. Source tab either becomes real or is hidden until a media item is double-clicked.

### 1.2 Undo / redo visibility

**What exists (good):**
- Snapshot undo stack, cap 50 (`state.js:116–233`)
- Every mutation path labels the undo (`pushUndo("Split clip")` etc. — ~80 call sites)
- Ctrl+Z / Ctrl+Y toast: `Undo: ${label}` (`shortcuts.js:100–110`, `timeline.js:379–380`)

**What's missing vs Filmora/CapCut:**

| Gap | Evidence |
|---|---|
| Toolbar Undo/Redo never disabled | `canUndo()` / `canRedo()` defined (`state.js:149–155`) — **zero callers** outside the class. Buttons in `index.html:125–126` stay always active. |
| Edit menu Undo/Redo never show the next action name | Filmora shows “Undo Split clip”. Menu is static (`index.html:46–47`). |
| No persistent “last action” chip | Toasts vanish in 2.8 s (`app.js:57`). Statusbar (`index.html:1455–1465`) shows clips/AI/credits/autosave — not history. |
| Redo shortcut is Ctrl+Y | Industry default is **Ctrl+Shift+Z**. Both work (`shortcuts.js:106`), but the toolbar tooltip says Ctrl+Shift+Z (`index.html:126`) while Preferences default is Ctrl+Y (`shortcuts.js:11`). Inconsistent. |
| No History panel | `state.history` is an action log (`state.js:367`) but has no UI (AI Mate only reads last 5). |

**Recommendation:** Bind `store.subscribe` → toggle `disabled` on `[data-edit=undo|redo]`; set `title`/menu label from `peekUndoLabel()`. One statusbar span “Last: Split clip”.

### 1.3 Asset browsing (library density)

Filmora/CapCut libraries are **thumbnail-first, hover-preview, category chips, favorites, search**. AiFilmora is uneven:

| Library | Categories | Search | Thumbnails | Hover preview | Drag-to-timeline | Fav |
|---|---|---|---|---|---|---|
| Media | ✗ (search only) | ✅ | ✅ | Source monitor stub | ✅ | ✗ |
| Text presets | ✗ | via Text editor | style PNGs | ✗ | ✗ (click apply) | ✗ |
| Shapes | ✅ chips | ✅ | SVG path / img | ✗ | ✗ click-insert | ✅ |
| Effects | button rows, not a browser | ✗ | ✗ | ✗ | ✗ | ✗ |
| Transitions | Built-in / Filmora / Custom | ✗ | Filmora tiles have thumbs; built-ins are text-only | ✅ canvas loop | ✗ | ✗ |
| Filters (FX panel) | search + list | ✅ | ✗ list | ✗ | n/a | ✗ |
| LUTs | search + grid | ✅ | ✅ graded thumbs | select | n/a | ✗ |
| Audio FX | family chips + search | ✅ | ✗ | Audition | n/a | ✗ |
| Fonts | All/featured toggle | ✅ | ✅ lazy faces | ✅ | n/a | ✗ |

**Biggest UX holes:**
1. **Effects tab is a wall of AI tool buttons**, not a browsable effects library (Filmora has animated effect previews). `index.html:241–281`.
2. **Transitions: Filmora default tiles do nothing.** Click handler only toasts “play the preview video to see it” (`preset-ui.js:225–230`). Users will click Dissolve/Fade and nothing happens. **Broken promise UI.**
3. **Built-in transitions have no thumbnails** — only label + duration (`transitions-ui.js:158–177`).
4. **No drag from library → timeline** except media cards (`media.js:648–657` + `timeline.js:553+`). Shapes, titles, transitions, filters are click-only. CapCut/Filmora both drag everything.

### 1.4 Drag & drop

| Gesture | Status |
|---|---|
| OS files → media bin | ✅ Import button + file input (`index.html:166–167`) |
| OS files → timeline lane | ✅ `timeline.js:558–563` |
| Media card → timeline | ✅ `text/aifimora-media` + plain fallback |
| Media card → media (reorder) | ✗ |
| Shape / text preset → timeline | ✗ |
| Transition → cut handle | ✗ (must select clip, open Transitions tab, click) |
| Effect / filter → clip | ✗ |
| External file drop on empty timeline | Partial — only on a **lane**; empty-state hint is not a drop target |

**Recommendation:** Unified `dataTransfer` MIME (`text/aifimora-asset`) consumed by timeline lanes *and* the empty-state hint. Library tiles for shapes/text/transitions become `draggable=true`.

### 1.5 Other Filmora/CapCut parity gaps (product)

- **No template / quick-style packs** (CapCut's core acquisition loop).
- **No captions auto-styling from the library onto the timeline** with drag.
- **No multi-cam / proxy badges** (acknowledged P2 in `research/gap-analysis.md:99–107`).
- **Export is simulated** — fine for a demo, but the Export pill is the loudest CTA in the titlebar.
- **Statusbar version drift** (1.4 vs 1.9.0) undermines trust.

---

## 2. Assets folder integration

### 2.1 What `assets/` actually is

Measured inventory:

| Metric | Value |
|---|---|
| Total size | **1,705.5 MB** |
| File count | **6,298** |
| `.dll` | 701 files / 1,021 MB |
| `.exe` | 36 files / 42 MB (includes **`Filmora.exe`**, `FilmoraPlayer.exe`, uninstaller, crash reporter…) |
| `.ttf/.otf` | 288 fonts / ~87 MB |
| `.png` | 996 / 67 MB |
| `.CUBE` | 72 / 50 MB |
| `.mp4` | 42 / 76 MB |

`assets-bridge.js:1–15` documents this honestly: “ships a real Wondershare Filmora 14 install”. That is fine for local research — **it is not fine for distribution**.

### 2.2 How assets are consumed today

| Mechanism | What it covers | How |
|---|---|---|
| `gen-library.cjs` → `js/filmora-library.js` | LUTs, audio FX, animations, filters, text art/styles, motion, masks, 4 default transitions | Build-time directory scan, baked JSON |
| `gen-color.cjs` / `gen-panzoom.cjs` / `gen-audiotrans.cjs` | colour presets, pan-zoom curves, audio crossfades | Same pattern |
| Hardcoded `FONT_FILES` in `assets-bridge.js:21–128` | 262 font faces | Manual pin (fonts added in 1.6.0 via comment block) |
| Hardcoded caption PNG lists | ~100 caption anims | Manual pin |
| `assets/shapes/manifest.json` | **1 item** (`gold-star.svg`) | Hand-written; `shapes.js:297–317` fetches on boot |
| `assets/transitions/manifest.json` | **1 item** (`gold-wipe.png`) | Hand-written; `transitions-ui.js:30–62` fetches |

**Gap:** `gen-library.cjs` does **not** regenerate the shapes/transitions manifests. Dropping a file in `assets/shapes/` requires editing JSON by hand (despite UI copy: “also drop files in `assets/shapes/`” — `index.html:202–205`). That copy is currently a lie unless the user also edits the manifest.

### 2.3 Custom transitions are not real transitions

```js
// transitions-ui.js:216–221
applyTransitionToClip(store, id, "dissolve");
store.updateClip(id, {
  outTransition: { type: "dissolve", duration: 0.6, label: a.label, customSrc: a.src },
});
```

- `customSrc` is stored on the clip.
- `paintTransition()` (`transitions.js:83–234`) only switches on built-in type ids. It **never reads `customSrc`**.
- `activeTransition()` (`transitions.js:38–56`) returns `{ type: tr.type }` only — no image payload.
- Player (`player.js:359–363`) therefore always paints a plain dissolve for custom assets.

**User-visible result:** Importing a gold-wipe image, clicking it, and playing the cut looks identical to Cross Dissolve. The wipe PNG in `assets/transitions/` is dead weight.

### 2.4 Filmora default transition tiles are decorative

`TRANSITION_PRESETS` (4 items with real thumbs + preview videos) are rendered in `#transPresetGrid` (`preset-ui.js:122–134`). The click handler:

```js
// preset-ui.js:225–230
toast(t ? `${t.name} — play the preview video to see it` : "Transition");
```

No `applyTransitionToClip`. No mapping from `dissolve|fade|fade_white|trans_default` onto `TRANSITIONS`. Preview videos exist on disk and are never played.

### 2.5 Legal / distribution risk (P0)

`package.json:31–37`:

```json
"files": ["index.html", "css/**/*", "js/**/*", "electron/**/*", "assets/**/*", "package.json"]
```

This packs **Filmora.exe + 1 GB of Wondershare DLLs** into every `npm run dist`. Even ignoring copyright, the installer is absurdly large and will trip AV heuristics.

**Required fix (must ship before any public build):**
1. Extract only the *used* media into a clean `assets/` allowlist: fonts actually referenced, `.CUBE` LUTs, config JSON/PNG thumbs used by generated manifests, caption PNGs, shapes/transitions user folders.
2. Add `build.files` exclusions for `**/*.dll`, `**/*.exe` (except none needed), `**/log/**`, `**/wfxPlugin/**`, etc. Prefer an explicit include list over `assets/**/*`.
3. Document in README that research assets are stripped for distribution; keep the full tree only in a local `research-assets/` path outside the package.

### 2.6 Target integration model (shapes / transitions / future dirs)

Treat every user asset dir the same:

```
assets/
  shapes/          # svg/png + optional meta
  transitions/     # png/mp4 + optional meta
  overlays/        # future
  stickers/        # future
  manifest.json    # GENERATED, not hand-edited
```

**One pipeline:**

1. **Generate** — extend `gen-library.cjs` (or a new `gen-user-assets.cjs`) to scan `assets/shapes` and `assets/transitions` and write both folder manifests *and* a `USER_ASSETS` export. Run as `npm run gen:assets` prebuild.
2. **Runtime rescan** — Electron `fs.readdir` via IPC (already have `electron/main.cjs`); browser fallback keeps manifest fetch. Single `loadUserAssets(kind)` API in `assets-bridge.js`.
3. **UI contract** — every asset card: thumbnail, label, category chip, ★, `draggable`, context menu (Apply / Add at playhead / Reveal).
4. **Apply contract**
   - Shape → text-track clip (already works via `addShape`)
   - Transition → `outTransition { type: "wipeOverlay", customSrc, duration }` **and** player draws the image as a wipe mask (new branch in `paintTransition`)
   - Title preset → title clip at playhead
5. **Empty state per folder** — “No custom transitions. Drop PNG/MP4 here or click Import.”

---

## 3. Architecture debt

### 3.1 Bugs / broken promises (fix first)

| # | Issue | Evidence | Severity |
|---|---|---|---|
| B1 | Filmora default transition tiles do not apply | `preset-ui.js:225–230` | High (dead UI) |
| B2 | Custom transition images never render (`customSrc` ignored) | `transitions-ui.js:220` vs `transitions.js:83–234` | High |
| B3 | UI copy promises auto-drop into `assets/shapes/`; only hand-edited manifests load | `index.html:202–205`, `shapes.js:297–317` | Medium |
| B4 | Statusbar version 1.4 ≠ package 1.9.0 | `index.html:1457` | Low (trust) |
| B5 | Undo/Redo toolbar never reflects stack state | `canUndo` uncalled | Medium |
| B6 | Redo shortcut label conflict (tooltip Ctrl+Shift+Z vs default Ctrl+Y) | `index.html:126` vs `shortcuts.js:11` | Low |
| B7 | Source monitor is a non-functional stub always visible as a tab | `app.js:317–330` | Medium |

### 3.2 Dead / decorative code

- **Source monitor** stub (above).
- **`4KvideoforGPUtest1.mp4`** and dozens of Filmora test/skin/log files in `assets/` are never referenced by JS.
- **`transPresetGrid`** renders thumbs that cannot be applied (B1).
- **`aifimora:media-removed`** listener is empty (`media.js:196–199`) — comment claims intent, no implementation.
- **Effects sidebar** lists ~20 AI tools; many likely share the same simulated job path (`ai-studio.js`) and do not surface clip-level results. Worth a call-graph audit before advertising them as distinct.

### 3.3 Inconsistent patterns

| Pattern | Inconsistency |
|---|---|
| **toast()** | 5 copies: `app.js:47` (kind support, direct DOM), `media.js:812` (event bus, no kind), `settings-panel.js:28`, `creative-tools.js:17`, `beats.js:9`. Media's version drops `kind` so “err” styling is lost when imported from media. |
| **Integration bus** | Mix of `window.__aifimora*` globals (`__aifimoraPlayer`, `__aifimoraStore`, `__aifimoraPlayhead`, `__aifimoraThemePresets`…) and `CustomEvent("aifimora:*")`. Modules reach into each other; hard to test. |
| **Undo on sliders** | Some controls `pushUndo` on every input event (volume, speed) → stack floods; others use `{ undo: false }`. |
| **Generated vs hand lists** | LUTs/filters generated; fonts/captions/shapes/transitions hand-pinned or hand-manifested. |
| **CSS scale** | Single `app.css` is 61 KB / ~2500+ lines; no panel-level split despite 48 JS modules. |
| **index.html** | 1,617-line monolith: all inspector panels inline. JS is modular; HTML is not. |

### 3.4 Performance / memory

- Undo snapshots deep-clone **clips + tracks + media + captions + markers + chapters** on every push (`state.js:127–142`). Media array includes thumb dataURLs. Cap 50 can be tens of MB.
- `bootAssets()` injects `@font-face` for **all 262 faces** at once (`assets-bridge.js:177–192`). Comment claims lazy load (good for download), but the CSS is still fully emitted.
- Player re-renders on **every** store emit (`app.js:618–622`) including pure UI selection changes.
- `index.html` loads 4 CSS + 1 JS module; no critical-path split — fine for Electron, slower for cold `file://` open.

### 3.5 Missing features that block polish (not just “nice”)

1. **Real custom wipe painter** — without it, asset transitions are a lie.
2. **Unified asset registry** — without it, every new folder is another special case.
3. **Undo UI binding** — without it, users don't trust the editor.
4. **First-run / empty-state hierarchy** — without it, CapCut users bounce.
5. **Ship allowlist** — without it, you cannot legally or practically release.
6. **Drag from library** — without it, the library feels like a settings panel, not an NLE bin.
7. **Effect preview loop** — Filmora's effects sell themselves on hover; text buttons don't.

### 3.6 What is already solid (do not rewrite)

- Multi-track timeline with snap, marquee select, track lock/mute/solo (`timeline.js`)
- Per-clip FX / motion / speed / volume panels with real canvas preview (`player.js`)
- LUT trilinear engine + colour per-pixel grade (`lut-engine.js`, `color-engine.js`)
- Audio FX Web Audio rack (`audio-fx.js`)
- Settings surface breadth (`settings-panel.js`)
- Verify suite (`verify-*.cjs` — 23+66+22+13+17+19+22+30+27 asserts)

Polish should extend these, not replace them.

---

## 4. Top 10 concrete improvements (impact × effort, one pass)

Ranked so a single focused implementation session can land 1–7 cleanly; 8–10 are same-pass if time allows.

| Rank | Improvement | Impact | Effort | Files | Acceptance |
|---|---|---|---|---|---|
| **1** | **Ship allowlist — stop packaging Filmora binaries** | Critical (legal + size + trust) | S | `package.json`, new `scripts/sync-assets.cjs`, README | `npm run dist` contains 0 `.dll`/`Filmora.exe`; fonts/LUTs still load; installer ≪ 200 MB |
| **2** | **Make Filmora default transitions + custom wipes real** | High (broken UI → working feature) | M | `preset-ui.js`, `transitions.js`, `player.js`, `transitions-ui.js` | Clicking Dissolve/Fade tile applies transition; `customSrc` PNG animates as wipe across the cut |
| **3** | **Auto-scan `assets/shapes` + `assets/transitions`** | High (asset story becomes true) | M | `gen-library.cjs` or `gen-user-assets.cjs`, `assets-bridge.js`, `shapes.js`, `transitions-ui.js` | Drop `foo.svg` in shapes → appears after Rescan without hand-editing JSON |
| **4** | **Undo/redo UI: disabled state + next-action label** | High (editor trust) | S | `app.js` or new `undo-ui.js`, `state.js` (peek helpers), `index.html` | Buttons grey out on empty stacks; tooltip/menu shows “Undo Split clip” |
| **5** | **First-run chooser + real empty-timeline drop zone** | High (activation) | M | `index.html`, `app.js`, `timeline.js`, `app.css` | Modal: Empty / Demo / Open; empty timeline accepts OS file drop + Import + “Ask AI Mate” |
| **6** | **Drag shapes/titles/transitions to timeline** | High (NLE feel) | M | `shapes.js`, `transitions-ui.js`, `text-panel.js`, `timeline.js`, `media.js` (shared MIME) | Drag shape card onto V1/T1 inserts clip at drop time; drag transition onto ◇ applies |
| **7** | **Single `toast` + version truth in statusbar** | Medium (hygiene) | S | new `js/toast.js`, replace 5 copies; `index.html:1457` | One implementation; kinds work everywhere; statusbar reads 1.9.0 |
| **8** | **Thumbnail previews for built-in transitions + hover loop** | Medium | S | `transitions-ui.js`, small canvas thumbs or generated stills | Each built-in tile shows animated or still preview on hover (already have preview canvas) |
| **9** | **Effects tab → browsable look library** (reuse filter grid + LUT thumbs) | Medium | M | `index.html` side-effects, `preset-ui.js`, `filmora-library.js` | Filter/LUT tiles live in Library → Effects with search; AI tools collapse to a secondary section |
| **10** | **Undo stack diet + History chip** | Medium (stability) | S–M | `state.js` (skip media thumbs in snapshots; coalesce slider undos), statusbar span | 50-step undo on a media-heavy project stays under a few MB; statusbar shows last action |

### Suggested implementation order in one pass

```
Pass A (ship blockers + broken UI)   → #1, #2, #4, #7
Pass B (asset pipeline truth)        → #3, #6, #8
Pass C (first-run + library feel)    → #5, #9, #10
```

Each pass should re-run the existing verify suite:

```powershell
node verify-parity.cjs
node verify-filmora-gaps.cjs
node verify-filmora15.cjs
node verify-shapes.cjs
node verify-upgrades.cjs
```

Add two new verifies while implementing:
- `verify-assets-pack.cjs` — assert no `.dll`/`.exe` under packaged file list; manifests regenerate from folders.
- `verify-transitions-apply.cjs` — Filmora tiles call apply; customSrc reaches paint path.

---

## Appendix A — Module map (current)

| Module | KB | Role | Debt notes |
|---|---:|---|---|
| `creative-tools.js` | 55 | Pen, charts, chapters, voice, batch | Local `toast` copy |
| `player.js` | 51 | Canvas compositor | Ignores `customSrc` |
| `settings-panel.js` | 45 | Preferences | Local `toast` |
| `color-presets.js` | 43 | Generated grades | OK (generated) |
| `state.js` | 42 | Store + undo | Heavy snapshots; `canUndo` unused |
| `ai-studio.js` | 42 | Mate + jobs | Many tools share one sim path |
| `timeline.js` | 41 | Tracks / DnD | Empty hint not a drop target |
| `filmora-library.js` | 41 | Generated manifests | No shapes/transitions |
| `media.js` | 30 | Bin + IDB | Weak `toast`; empty state text-only |
| `assets-bridge.js` | 26 | Fonts/captions/themes | Hardcoded lists; no user-asset scan |
| `app.js` | 24 | Bootstrap | Demo force-seed; local `toast`; stub source |
| `shapes.js` | 17 | Shape library | Manifest fetch only; no DnD out |
| `transitions.js` | 7 | Built-in paints | No custom/wipe branch |
| `transitions-ui.js` | 9 | Browser UI | Stores `customSrc` unused |
| `preset-ui.js` | 11 | Preset browsers | Transition tiles dead-ended |
| `index.html` | — | 1617 lines | All panels inline; version 1.4 |

## Appendix B — Asset dirs worth keeping after allowlist

**Keep (referenced by generated JS or user folders):**
- `assets/Fonts/` (or a curated subset of the 262 faces actually listed)
- `assets/configs/ColorAnd3dLutPreset/CubeLUTFiles/*.CUBE`
- `assets/configs/TextStyle/*.png`, `TextArt/`, `Motion/`, `AnimationNew/*/info.json`, `MaskPreset/`, `PanZoom/*.conf`
- `assets/configs/Transition/Default Transitions/*/thumbnail.png` (+ optional previewVideo.mp4)
- `assets/resources/audio_effect/*/description.json`
- `assets/resources/wfx_effect/nle_default/` (filter names)
- `assets/resources/captions/**` thumbnails
- `assets/Captions/Texttures/TexturePreset/`
- `assets/Skin/filmora_{dark,light}.txt` (theme measurement source — can go after values are baked)
- `assets/shapes/**`, `assets/transitions/**` (user)

**Drop from any shipped package:**
- `*.dll`, `*.exe`, `*.ax`, `*.pak`, `platforms/`, `swiftshader/`, `vlcPlugins/`, `log/`, `rtlib/`, `UHPPlugins/`, `wfxPlugin/` binaries, `*.db`, `debug.log`, `AIGCModuleConfigs/` (unless UI reads it — currently does not), `4KvideoforGPUtest1.mp4`, splash/upgrade guides, BugSplat, installer leftovers.

---

*End of audit.*
