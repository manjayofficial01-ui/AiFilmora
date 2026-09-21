# AiFimora — Product & Architecture Plan

## Vision
A Windows-first AI video editor suite that combines Filmora's approachable AI Mate + multi-model GenAI lab, Premiere/Descript text-based editing, Resolve/FCP isolation & color craft, and CapCut speed-to-publish — as one coherent prosumer NLE.

## Visual direction
- **Anchor:** Pro NLE instrument panel (Premiere/DaVinci density) with Filmora-like AI friendliness
- **Palette:** `#0B0D10` bg · `#12151A` panels · `#E8ECF2` ink · `#5B8CFF` AI accent · `#00D4A0` generate/success · `#FFB020` warn
- **Type:** `Segoe UI Variable Text, Segoe UI, system-ui` body; `Cascadia Code, Consolas, monospace` timecode
- **Signature:** Glowing AI action rail + AI Mate dock that can drive the timeline

## Architecture (this build)
Electron-ready single-page app (pure HTML/CSS/JS, no build step required).

```
AiFimora/
├── index.html          # shell + layout regions
├── css/tokens.css      # design tokens
├── css/app.css         # layout + panels + components
├── css/timeline.css    # tracks, clips, playhead
├── js/state.js         # project store + pub/sub
├── js/media.js         # media bin + synthetic assets
├── js/player.js        # preview engine (canvas)
├── js/timeline.js      # multi-track magnetic timeline
├── js/ai-studio.js     # AI Mate, GenAI Lab, credits
├── js/text-edit.js     # transcript / paper edit
├── js/effects.js       # color, voice, mask, upscale
├── js/export.js        # export presets + render sim
├── js/shortcuts.js     # keyboard map
├── js/app.js           # bootstrap + wiring
├── js/filmora-library.js  # GENERATED (gen-library.cjs) asset manifests
├── js/lut-engine.js    # .CUBE parser + trilinear sampler + thumbs
├── js/lut-panel.js     # LUT browser UI
├── js/color-presets.js # GENERATED (gen-color.cjs) 29 parametric presets
├── js/color-engine.js  # per-pixel grade: WB/exposure/vibrance/HSL/vignette
├── js/color-preset-ui.js # colour preset browser
├── js/panzoom-presets.js # GENERATED (gen-panzoom.cjs) keyframed crop curves
├── js/panzoom.js       # crop sampling + draw + previews
├── js/panzoom-ui.js    # Pan & Zoom picker
├── js/audio-transition-presets.js # GENERATED (gen-audiotrans.cjs)
├── js/audio-transitions.js # crossfade curve maths + previews
├── js/audio-transition-ui.js # curve picker
├── js/audio-fx.js      # Web Audio graph + 76 Filmora audio presets
├── js/audio-fx-ui.js   # audio rack UI
├── js/filmora-presets.js # animations / filters / text / motion / masks
├── js/preset-ui.js     # browsers for the above + clip anim transform
├── electron/main.cjs   # optional desktop wrapper
├── gen-library.cjs     # regenerate js/filmora-library.js from assets/
├── gen-color.cjs       # regenerate js/color-presets.js from assets/
├── gen-panzoom.cjs     # regenerate js/panzoom-presets.js from assets/
├── gen-audiotrans.cjs  # regenerate js/audio-transition-presets.js from assets/
├── gen-user-assets.cjs # regenerate user-asset folders (shapes/transitions/textures) under assets/
├── check-assets.cjs    # audit: every assets/... path referenced by js/ exists on disk
├── server.cjs          # static dev server 127.0.0.1:8765 for the verify-*.cjs suite
├── verify-assets.cjs   # end-to-end asset-integration verification (Playwright)
├── package.json
└── research/           # competitive intelligence
```

## Feature matrix (mapped to competitors)

| AiFimora feature | Inspired by | Priority |
|---|---|---|
| Multi-track magnetic timeline | Filmora / FCP | P0 |
| Media bin + dual preview | Filmora dual timeline | P0 |
| AI Mate (project memory, actions) | Filmora AI Mate + Descript Underlord | P0 |
| Text-based paper edit | Premiere TBE + Descript | P0 |
| Auto captions + filler/silence cut | CapCut + Premiere | P0 |
| Multi-model GenAI Lab + credits | Filmora + PowerDirector Model Lab | P0 |
| Script-to-video | CapCut + PowerDirector AI Agents | P1 |
| Color LUT / grade | Resolve | P1 |
| Magic Mask / Auto cutout | Resolve + CapCut + FCP | P1 |
| Voice isolation / Studio Sound | FCP + Descript | P1 |
| Super Scale / Upscale | Resolve + Topaz | P1 |
| Smart reframe | FCP Smart Conform | P1 |
| Export presets | All | P0 |
| Proxy status UI | Premiere | P2 |
| Multicam bin | Resolve / Filmora | P2 |

## Runtime model
- **UI thread:** timeline, player, panels (canvas compositing)
- **AI services (simulated now):** process-as-jobs with progress; design interfaces ready for Electron UtilityProcess + faster-whisper / ONNX later
- **Credits:** local metering, 1,000/mo Advanced-style demo pool
- **Persistence:** `localStorage` project autosave + JSON export/import

## Windows packaging
- Run in browser immediately (`index.html`)
- Optional: `electron .` via `electron/main.cjs` for native window + file dialogs

## Non-goals (this session)
- Real multi-GPU render farm
- Actual API keys to Veo/Runway/Kling
- Final Cut–only platform features
