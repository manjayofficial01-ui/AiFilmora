# Filmora 14/15 UI & Tool Deep Research — AiFilmora Parity Report

**Date:** 2026-09-22  
**Depth:** deep (8 angles, 8 parallel sub-agents)  
**Workspace:** `research/filmora-ui-2026/`  
**Findings:** F1–F8 (100+ sourced claims)

---

## Executive summary

Filmora 14/15’s chrome is a **four-panel workspace** (Media · Player · Property · Timeline)
with a **content-aware Property Panel**, a **six-destination Export window**, and a
**multi-entry tool distribution** (same tool appears in 2–4 of: startup Toolbox, Tools menu,
timeline toolbar, clip Smart Edit / right-click, Properties inspector). AiFilmora already
had broad feature names; the gap was **layout identity and interaction contracts**. This
pass closed the chrome gaps called out below.

---

## 1. Title bar & menus (F1)

| Contract | Filmora 14/15 | Notes |
|---|---|---|
| Menu bar | File · Edit · Tools · View · Help | No official “Extended” or “Version” menus |
| File | New / Open / Save / Save As / Archive / Import / Record Voice-Over / Preferences / Exit + Project Settings + Keyboard Shortcuts | |
| Tools | Auto Reframe, Planar Tracking, Auto Sync, STT/TTS + Video/Audio/Text submenus | Silence Detection under **Tools → Audio** |
| Top-right | **Export** (Ctrl+E) · Login/Avatar | Asset Center lives near library search, not titlebar |
| Export window tabs | **Local \| Device \| YouTube \| TikTok \| Vimeo \| DVD** | Primary source: V14 Windows PDF |

Primary: https://filmora.wondershare.com/guide/filmora-user-guide-v14-for-windows.pdf

**Shipped in AiFilmora:** File Import/Project/Export/Exit; View panel toggles; Export▾ menu
with the six destinations; Account + window controls cluster; Export dialog tabs.

---

## 2. Library panel (F2)

**Tabs (complete):** Media · Stock Media · Audio · Titles · Transitions · Effects ·
**Filters** · Stickers · Templates. Filters is top-level (not nested under Effects).

**Media tree:** Project Media / Global Media / Cloud Media (My Cloud + Downloads) ·
Stock Mine (Favorites, Downloads) · AI Image · Library · Influence Kit · Adjustment Layer ·
Compound clip.

**Universal asset chrome:** search + type filter (All/Video/Audio/Image) + thumbnail size +
sort (Name/Duration/Type/Date Created) + group. Favorites via Star → Mine > Favorites with tags.

**Apply pattern:** hover Plus · drag-to-timeline · default effect **5s** / opacity 0–100 ·
transitions between clips · templates show “N items can be replaced” swap UI.

**Already shipped:** `media-menu.js` reorders to Filmora tab taxonomy + category rails.

---

## 3. Property Panel (F3) — content-aware

Filmora’s Property Panel **swaps sections** by selection type:

| Selection | Sections |
|---|---|
| Video | Transform Basic (Scale W/H, Position, Path Curve, Anchor, Rotation) + keyframe diamonds · Color (Basic/LUT, HSL, Curves YRGB, Color Wheels, HDR) · Speed · Animation · Audio · AI Matting |
| Audio | Volume, Pitch, Balance, Fades, EQ |
| Text | Text Basic/Bubble: font, color, align, shadow, shape, glow + Apply to All |
| Transition | Duration / direction |
| No selection | Project Info (Name, Location, Resolution, FPS, Color space, Sample rate, Duration, Thumbnail) |

**Keyframes:** diamond icons per property + timeline-embedded **Keyframe Graph Editor**
(right-click → Show Keyframe Animation) with Bezier curves.

**Six workspace layouts:** Default · Organize · Edit · Short Video · Classic · Dual.

**Shipped:** `filmora-chrome.js` Properties accordion (Video / Color / Animation / Speed /
Audio / Text / Mask / AI) that shows/hides sections from `clip.type`, with Mate/Lab/
Transcript/AI/Scopes as a compact side switcher. Project Info card remains on top.

---

## 4. Player & Timeline (F4)

| Contract | Filmora 14/15 |
|---|---|
| Monitors | Dual **Source Monitor** + **Timeline Monitor** (floatable, second screen) |
| Playback quality | **Full / 1/2 / 1/4** (preview only) |
| Player extras | Snapshot under timecode · Mark In/Out · Aspect overlay · Video Scopes |
| Track headers | Eye · Speaker · Lock + Manage Timeline (add tracks, Adjust Track Height) |
| Split | 4-way (head / tail / playhead / both) |
| Speed menu | Add Freeze Frame (default 5s) · Reverse Speed · Segmented Speed Control / Add Speed Point |
| Markers | **Media Markers** (M on media) vs **Timeline Markers** (Bookmark / Add Marker) |
| Motion tracking | Properties panel + Link |

**Shipped:** SVG transport glyphs (home/prev/play/next/mute/fullscreen) + **Snapshot (C)**;
timeline icon strip + Silence/Duck tool buttons. Quality dropdown aligned to Full/½/¼.

---

## 5. Export & Save (F5)

| Contract | Filmora 14/15 |
|---|---|
| Project format | **`.wfp`** — references only (paths/filenames); optional archive bundles sources |
| Save | File → Save Project / Save Project As / **Ctrl+S** |
| Project Settings | Aspect (16:9 default, 1:1, 9:16, Custom) · Resolution · Frame rate · Sample rate **44.1 / 48 kHz** |
| Export destinations | Local · Device · YouTube · TikTok · Vimeo · DVD |
| Local formats | MP4, AVI, WMV, AV1, MOV, GoPro CineForm, F4V, MKV, TS, 3GP, MPEG-2, WEBM, GIF, MP3 (+ HEVC/AV1 MP4) |
| Quality tiers | **Lower / Recommend / Higher** — bitrate only; Res / FPS / Bit Rate adjustable in Settings |
| Device presets | iPhone, iPad, Apple TV, Samsung Galaxy, Pixel, Xbox, PS4, Smart TV… (still writes locally) |
| Social | YouTube (title/desc/tags/visibility) · TikTok · Vimeo only |
| Preferences tabs | General · Folders · Editing · **Save** · Performance (+ Appearance under General) |
| Backup | Backup Settings (autosave interval) + Default Storage Location under Folders |
| Scratch disks | **Project-scoped** (saved with project, restored on open) |
| Export memory | “Previous export settings” preset |

**Shipped:** Export dialog with the six destination tabs, Lower/Recommend/Higher quality
chips (drive bitrate 8/16/40), Format/Encoder/Res/FPS/Bitrate/HW-accel grid, dirty-dot on
project pill, save-location memory already present (`save-dialog.js`).

---

## 6. AI tools & entry points (F6)

| Tool | Entry points in Filmora |
|---|---|
| **AI Mate** (ex-Copilot) | Timeline toolbar chat icon · modes Action / Guide / AIGC / Inspiration-to-Video / Auto |
| Text-based editing | Create-project option · clip right-click **Smart Edit Tool** · timeline More · Tools → Audio |
| Captions / STT | Title menu · AI Captions panel |
| TTS | Text-to-Speech panel |
| Translation + Lip Sync | Media library right-click · AI Translation (videos **< 5 min**, voice+caption) |
| Smart Cutout | **Properties → AI Matting** |
| Silence Detection | **Tools → Audio** |
| AI Thumbnail Creator | **Export flow** |
| AI Extend | Stock Media → Video Extend (5–8s video / 10–30s audio) |

Pattern: many tools appear in **2–4 surfaces**. AiFilmora already has Mate/Lab/AI Tools
tab + context menu; Tools menu and timeline strip now surface Silence/Duck/Beat.

---

## 7. Icons, theme, density (F7)

| Token | Value |
|---|---|
| Brand navy | `#203D51` → `#143247` |
| Mint accent | `#55E5C5` / `#55E3C5` |
| Marketing CTA gradient | `#83FFE9` → `#58FFDA` → `#00F0FF` |
| Hover mint | `#50E3C2` |
| Dark surface | `#07273D` / near-black |
| Appearance | Light / Dark / System Default (Preferences → General), immediate apply |

Workspace is **four panels** + **six layout modes**. Official docs do **not** publish
stroke-vs-fill icon rules, icon px sizes, or control heights — reverse-engineering targets.

**Shipped:** Export pill uses the mint→cyan marketing gradient as the only filled CTA;
thin 14px stroke icon language on transport + timeline strip.

---

## 8. Tools often missing in clones (F8) — all present in Filmora

| Tool | UI home |
|---|---|
| Instant Cutter | Standalone home-screen / import (lossless HEVC) |
| Screen / webcam recorder | Startup · File → Record Media · Media toolbar |
| Proxy | File → Preferences → Performance (auto 720p/1080p thresholds) |
| Silence Detection | Tools → Audio |
| Beat Sync | Tools (Auto Beat Sync) |
| Motion Tracking | Properties + Link |
| Planar Tracking | Tools menu |
| Smart Cutout | Properties → AI Matting |
| AI Extend | Stock Media → Video Extend |
| Freeze / Reverse / Speed ramp | Clip **Speed** menu (Segmented Speed Control) |
| Split screen | Library / effects |
| Crop / Pan & Zoom | Properties |
| Chroma Key | Properties |
| Color Match → **AI Color Palette** | Color → Basic |
| Stabilization | Properties |
| Compound clip | Tools → Create Compound Clip |
| Detach audio | Clip menu |
| Batch edit | Multi-select |
| Templates / Stock | Library tabs |

**Naming to match:** “AI Color Palette”, “Segmented Speed Control”, “AI Matting”, “AI Mate”.

---

## Implemented this pass (code)

| File | Change |
|---|---|
| `js/filmora-chrome.js` | Content-aware Properties accordion · dock collapse · SVG transport · Export▾ menu · File/View extras · timeline icon strip · window controls · export tabs |
| `css/filmora-chrome.css` | Filmora chrome styles (accordion, docks, export dialog, transport, CTA gradient) |
| `js/icons.js` | pause/home/end/prev/next/camera/markIn/markOut |
| `index.html` | filmora-chrome.css · titlebar Account/win controls · Export dialog 6 tabs + quality + settings grid |
| `js/app.js` | `initFilmoraChrome()` |
| `js/export.js` | `readFilmoraExportSettings` / `applyFilmoraExportDefaults` wired into openExport |

---

## Open questions

1. Exact icon stroke widths / filled-vs-outline ratios (not in public tokens).
2. Project Info field list beyond name/location/res/FPS still needs the 641-page V14 PDF pass.
3. Keyframe Graph Editor (Bezier) UI not yet built — diamond keyframes exist.

## Sources (primary)

- https://filmora.wondershare.com/guide/filmora-user-guide-v14-for-windows.pdf
- https://filmora.wondershare.com/guide/create-a-project.html
- https://filmora.wondershare.com/guide/export-to-local.html
- https://filmora.wondershare.com/guide/ (Windows guide IA: media panel, property panel, player, AI Mate, tools)
- https://support.wondershare.com/how-tos/filmora/ (formats, social targets, appearance)
- Per-claim URLs in `findings/F1.md` … `F8.md` (access date 2026-09-22)
