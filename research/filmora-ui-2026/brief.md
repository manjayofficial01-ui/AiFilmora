# Brief — Filmora UI/Tool Deep Research (2026-09-22)

## Question
What are the exact chrome, tool surfaces, content-aware panels, properties/configurations,
player controls, export/save flows, and icon/theme language of Wondershare Filmora
(14/15, Windows dark theme) that AiFilmora must match to feel "true Filmora"?

## Why
AiFilmora already has broad feature names and some Filmora-derived assets/themes. The
remaining product gap is **layout identity and tool completeness**: title bar, menu bar,
library tabs, action tools, content-aware inspectors, panel collapse/resize, player
transport, export dialog, and save/project properties. Goal is visual and interaction
parity, not feature-name tourism.

## Scope (in)
- Filmora 14/15 Windows desktop UI chrome and tool inventory (primary)
- Library / media panel structure and tab taxonomy
- Inspector / properties panel content-awareness rules
- Preview player controls, quality/aspect, fullscreen, snapshot
- Timeline toolbar, track headers, clip tools
- Export dialog fields and save/project settings
- Iconography style (stroke vs fill, sizes, density) and theme (dark/light tokens)
- Tools often missed in casual docs: Instant Cutter, screen recorder, stock media,
  stickers, templates, AI tools entry points, planar/motion tracking, silence detect

## Scope (out)
- Pricing/credit legal issues
- Mobile Filmora
- Real codec/export engine internals
- Competitor deep dives beyond what Filmora itself does

## Assumptions
- Target reference is Filmora 14/15 Windows dark theme (primary working mode)
- AiFilmora is a browser/Electron HTML shell and can only approximate native chrome
- Local `assets/Skin/filmora_dark.txt` is a primary style source already partially mined

## Depth
deep (5–8 angles, 2 follow-up rounds, 25+ sources)

## Angles
1. Title bar + main menus + window/export chrome (File/Edit/Tools/View/Help/Version)
2. Library panel: 9 tabs taxonomy + media tree + stock/cloud/stickers/templates
3. Content-aware properties/inspector panels (what appears for clip type)
4. Player + timeline toolbar + track headers + clip context tools
5. Export dialog + save/project properties + Preferences structure
6. AI tools catalog and where they live in the UI (not just feature list)
7. Icon language + density + theme measurements (skin/screenshots)
8. Missing vs common Filmora workflows (Instant Cutter, recorder, proxy, silence,
   beat, motion track, planar, smart cutout, AI extend, etc.)
