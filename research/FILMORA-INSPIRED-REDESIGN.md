# AiFimora → Filmora-Inspired Redesign — Deep Research & Upgrade Plan

> Scope: read the Filmora 14/15 screenshot the user shared, audit AiFimora's current shell, map the
> visible differences, and turn the local `assets/` folder (a real Filmora install dump) into
> first-class feature content.

---

## 1. What the Filmora screenshot is showing

The reference is **Filmora 14.x** (Windows build, dark theme) running on a project named
`Untitled-2026-09-15 22 06 24(copy).wfp` at `C:\Users\…\Roaming\…\Untitled-2026-09-15 22 06 24(copy).wfp`.

### Layout (top → bottom)

| Region | Content | Notes |
|---|---|---|
| Title bar | Logo + name + **File · Edit · Tools · View · Extended · Help · Version** menu | Real menus, not chips |
| Title bar | Project name centered | Click-to-rename pattern |
| Title bar right | Sync / Effects / Cart / Login / **Export ▾** / min · max · ✕ | Export is the only filled action |
| **Library tabs** | Media · Stock Media · Audio · **Titles · Transitions · Effects · Filters · Stickers · Templates** | 9 surface categories — much richer than AiFimora's 6 |
| Library body | "Project Media" tree (Folder, Global Media, **Cloud Media**, Editing Presets, Influence Kit), Search bar, Import Media tile + grid thumbnails | Cloud Media is the major cross-device item we don't have |
| Preview stage | **Timeline / Source** tabs, Full Quality dropdown, aspect dropdown (16:9), preview canvas, transport (← ▶ →), time display, snapshot/fullscreen | Tabs + quality chooser are key UX beats |
| **Right rail** | "Project Info" with **Name · Location · Resolution · Frame Rate · Color Space · Sample Rate · Duration · Thumbnail** + Edit button | A single, opinionated metadata panel — not a 9-tab inspector |
| Timeline toolbar | Snap toggle, split, undo/redo, **markers, dictation, AI tools** | Marker + dictation we don't ship |
| Timeline | 3 tracks (Video 2 / Video 1 / Audio 1) with **lock / mute / hide / FX-routing icons**, beat-track waveform, colored clip thumbnails | Much more compact track header than ours |

### Why the Filmora layout feels calm

1. **One primary action per panel.** The right rail is "Project Info" — read-only metadata. The
   left rail is the only content chooser. The timeline is the only editing surface.
2. **Color is reserved for accents** (the playhead, the AI gradient, the cyan Export button). Body
   chrome is near-monochrome `#181c1f / #0a0d0f`. Our app already does this — good.
3. **Tab counts are low** (2 on the preview, 9 on the library). We currently have **11 inspector
   tabs** — that's the loudest visible gap.

---

## 2. Audit of AiFimora today

```
AiFimora 1.4.0  ·  ~18,400 lines JS, ~2,500 lines CSS, 1,257 lines HTML
  • Shell: titlebar → menubar → workspace (sidebar + preview + inspector) → timeline → statusbar
  • Library: 6 sidebar tabs (Media · Text · Shapes · Effects · Transitions · AI Tools)
  • Inspector: 11 tabs (Color-FX · Motion · Speed · Volume · Text · AI Mate · GenAI Lab ·
    Transcript · Scopes · AI · Creative)
  • AI Mate, GenAI Lab, AI Providers, Auto-captions, Beat sync, LUT import, Pen tool, Charts,
    Visualizer, Chapters, Multi-clip, Motion Blur, Flicker Removal, Subprojects, …
```

| Feature present | Notes |
|---|---|
| Timeline toolbar (Split / Crop / Trim / Delete / Undo / Redo / Snap / Detach / Beat Sync / Mute) | Heavier than Filmora's snap+split+undo. Could be consolidated. |
| Track controls (lock / mute / hide / solo) | ✅ 4-button — richer than Filmora's 2 |
| Preview quality dropdown | ❌ missing — Filmora shows Full Quality + aspect |
| Preview tabs Timeline / Source | ❌ missing — single canvas |
| Project Info panel (right rail) | ❌ missing — we have a 11-tab inspector instead |
| Cloud Media / Global Media / Influence Kit | ❌ — only local import + Project Media |
| Stock Media / Templates / Stickers / Filters as tabs | ❌ — we have a generic "Effects" tab |
| Export dropdown with social presets | partial — we ship presets, no dropdown |
| Top menu bar (File · Edit · Tools · View · Extended · Help · Version) | partial — we have chips |

---

## 3. How much *could* we redesign — pragmatic verdict

| Redesign axis | Effort | Value | Decision |
|---|---|---|---|
| **Top menu bar** (File · Edit · Tools · View · Extended · Help · Version) | Small | High | **Do.** Adds Filmora's "pro" feel in one row. |
| **Preview tabs (Timeline / Source)** + **Full Quality / aspect dropdowns** | Small | Medium | **Do** — boosts filmora parity in 60 LOC. |
| **Right rail consolidation → "Project Info" + secondary panel** | Medium | High | **Do as collapsible** — keep our inspector but demote Project Info to the top. |
| **Inspector tab pruning** (11 → 6) | Medium | Medium | **Partial** — group: Color/FX · Motion/Speed · Audio/Volume · Captions/Text · AI · Scopes. |
| **Library tab expansion** to 9 (Stock / Stickers / Filters / Templates) | Medium | Medium | **Partial** — add **Templates** (we have none yet) and **Stickers** (free stickers from public sources). |
| **Cloud Media / Global Media / Influence Kit** | Large | Low | **Defer** — these need an account system. |
| **New Skin / Dark2X rcc loader** | Very large | Low | **Defer** — Qt rcc is a custom container. Not browser-loadable. |
| **Asset-driven Font library (290 fonts from `assets/Fonts/`)** | Small | **Very high** | **Do now** — real type ships in the preview today. |
| **Asset-driven Caption animations** (parsed from `assets/resources/captions/Animation.xml` + folder scan) | Medium | **Very high** | **Do now** — Filmora's actual animation thumbnails. |
| **Asset-driven Shapes / Transitions manifests** | Tiny | Medium | **Do now** — `manifest.json` already referenced, just load via bridge. |
| **Filmora-derived theme tokens** (from `assets/Skin/filmora_dark.txt` palette extraction) | Small | Medium | **Do now** — adds "Filmora Dark" / "Filmora Light" theme presets in Preferences. |
| **Project thumbnail (program-monitor JPEG)** | Small | High | **Do** — adds the "Edit" thumbnail block to the right rail. |
| **Marker / Dictation toolbar buttons** | Small | Medium | **Do markers** (we already have chapters), skip dictation. |

Net: **about 1 day of focused work** can move us from "70% Filmora-shaped" to "90% Filmora-shaped"
*plus* gain real Filmora-quality type and caption animation content sourced from the assets folder.

---

## 4. Asset utilization matrix

The `assets/` directory is a real Filmora 14 installation. Most of it is native binaries, but a
significant subset is **directly loadable by a browser** today:

| Path | Type | Size | Useful? | Plan |
|---|---|---|---|---|
| `assets/Fonts/*.ttf` | TTF/OTF fonts | 290 files · 87 MB | **Yes** | Inject @font-face, expose in Text panel |
| `assets/Skin/filmora_dark.txt` | JSON style rules | 11 843 lines | **Yes** | Extract dominant colors → "Filmora Dark" theme |
| `assets/Skin/filmora_light.txt` | JSON style rules | 11 843 lines | **Yes** | "Filmora Light" theme |
| `assets/resources/captions/Animation.xml` | Caption animations manifest | 200+ entries | **Yes** | Parse → caption animations gallery |
| `assets/resources/captions/AnimationWithGUID/` | PNG thumbnails + GUID-keyed animations | hundreds of PNGs | **Yes** | Thumbnail grid in Text/Captions panel |
| `assets/resources/captions/Motion/` | More animations + XMLs | dozens | **Yes** | Same |
| `assets/resources/captions/Base/` | "Wavy / Type Writer / Cinema Style" animations + thumbnails | dozens | **Yes** | Same |
| `assets/resources/style/style_random/description.json` | Style preset JSON | tiny | Reference only | Show as "Random Style" preset |
| `assets/Captions/Texttures/` | Caption texture backgrounds | a few JPGs | **Yes** | Add as background overlays in Text panel |
| `assets/AIClip/*.png` | AI clip thumbnails | 5 PNGs | Optional | Show in GenAI Lab as reference |
| `assets/AINanoBanana/*.png` | AI style thumbnails | a few PNGs | Optional | Show as AI style previews |
| `assets/AIRelight/` | (unknown) | — | TBD | Skip unless thumbnails |
| `assets/AIWatermark/` | (unknown) | — | TBD | Skip unless thumbnails |
| `assets/Skin/*.rcc` | Qt resource bundles | 247 MB | **No** | Qt binary format — not browser-readable |
| `assets/shapes/manifest.json` | Existing manifest | tiny | **Yes** | Already wired — extend loader |
| `assets/transitions/manifest.json` | Existing manifest | tiny | **Yes** | Already wired — extend loader |
| `assets/*` (DLL / .exe / `core.dll` / `bs*.dll`) | Native binaries | hundreds | **No** | Skipped — not browser-loadable |
| `assets/4KvideoforGPUtest1.mp4` | Test video | small | Optional | Auto-add to media bin as "GPU test clip" |

The **bridging module** (`js/assets-bridge.js`) will be the single source of truth that knows how to
load each of these.

---

## 5. The visual redesign (Filmora-shaped layout)

### Current vs target

```
CURRENT  Title bar · menu chips · [Library | Preview | Inspector×11tabs] · Timeline · Status
TARGET   Title bar · File/Edit/Tools/View/Extended/Help/Version · 
         [Library×9tabs | Preview (Timeline/Source + Quality + Aspect)] · 
         [Project Info (sticky top) + Inspector (consolidated 6 tabs)] · 
         Timeline · Status
```

### Five concrete shell changes (all low-risk)

1. **Add a real `<nav class="menubar">`** with File · Edit · Tools · View · Extended · Help · Version.
   Each opens a small dropdown (a CSS-only `<details>` menu works for v1; modal upgrade later).
2. **Add a `.preview-tabs` row** above the canvas: `Timeline · Source`. Each tab toggles between
   the current program monitor and a "source" view of the first selected clip.
3. **Add `.preview-controls` row** in the transport strip: `Full Quality ▾ · 16:9 ▾`. Quality
   toggles `settings.playback.previewQuality`. Aspect toggles the project aspect (existing).
4. **Add a `.project-info` card** in the right rail above the existing inspector tabs: name,
   location, resolution, FPS, color space, duration, thumbnail. Edit button re-opens the
   Project Settings dialog.
5. **Add a "Captions" mini-tab strip** in the Text panel that overlays the Filmora animation
   thumbnails onto the title preview.

### Theme presets (extracted from Filmora skin JSON)

Dominant colors found in `assets/Skin/filmora_dark.txt`:

```
#181c1f  panels           →  --bg-2     (we already use #12151a — close)
#0a0d0f  input bg         →  --bg-3
#55e5c5  accent (cyan)    →  --accent   (vs our #5b8cFF blue)
#f0f8fe  text on accent   →  ink on accent
```

We'll add **Preferences → Appearance → Theme** with three options:
- `dark` (current AiFimora — blue accent)
- `filmora-dark` (Filmora's cyan + near-black panels)
- `filmora-light` (Filmora's white-on-near-white)

---

## 6. Implementation plan (what we ship this round)

Three deliverables:

### A. `js/assets-bridge.js` (new module)
- `assetsBridge.fonts()` — list of { id, family, fullLabel, weight, style, file, url }
- `assetsBridge.fontFaceCSS()` — injected once at boot
- `assetsBridge.captionAnimations()` — parsed list of Filmora caption animations with thumbnails
- `assetsBridge.themePresets()` — `{ 'filmora-dark': tokens, 'filmora-light': tokens }`
- `assetsBridge.shapeManifest()` / `transitionManifest()` — reads existing `manifest.json`s

### B. Visible UI upgrades
1. **Filmora-style top menubar** with File · Edit · Tools · View · Extended · Help · Version.
2. **Preview tabs** Timeline / Source.
3. **Quality + aspect dropdowns** in the transport row.
4. **Right-rail Project Info card** above the inspector.
5. **Text panel: Font dropdown** populated from the 290 Filmora fonts (searchable).
6. **Text panel: Caption animations gallery** showing Filmora's animation thumbnails (click to
   apply the matching `anim` style).
7. **Preferences → Appearance: Theme** now includes `filmora-dark` and `filmora-light`.

### C. `research/FILMORA-INSPIRED-REDESIGN.md` (this document)
+ updates to `research/gap-analysis.md` and the daily memory log.

---

## 7. What we *won't* try this round

- Native rcc / Qt binary decoding — too risky.
- Cloud Media / Global Media / Influence Kit — needs an account model.
- A full inspector prune — high-risk for the existing UX.
- A new "Stickers" library of 100s of PNGs — needs sourcing.
- 9-tab library expansion — incremental, can come next.

---

## 8. Acceptance criteria

- New menubar visible with 7 items, each opens a small dropdown.
- Preview area shows **Timeline / Source** tabs and **Full Quality + 16:9** dropdowns.
- Right rail starts with **Project Info** card (name, path, res, fps, color, sample rate,
  duration, thumbnail).
- **Text panel** font dropdown lists at least the curated set from `assets/Fonts/`; selecting
  one applies the @font-face and shows the title in that font on the program monitor.
- **Text panel** has a "Caption animations" gallery showing thumbnails from
  `assets/resources/captions/...`; clicking one changes the selected title's `anim`.
- **Preferences → Appearance → Theme** lists dark / filmora-dark / filmora-light; switching
  changes the panel and accent colors immediately.
- The Playwright smoke tests pass and `output-filmora-inspired.png` shows the new shell.