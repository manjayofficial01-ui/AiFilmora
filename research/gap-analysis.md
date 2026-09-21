# AiFilmora vs Filmora 14/15 — Gap Analysis (updated 2026-09-14, round 2)

## Fixed earlier (P0 + key P1)

1. **Clipboard wired** — Ctrl+C / Ctrl+V / Ctrl+D now hit real store APIs (`workflows.js`)
2. **Ripple delete wired** — Shift+Delete works
3. **Clip context menu** — right-click: split, copy, paste, duplicate, ripple delete, reverse, freeze, speed, compound, properties
4. **Backup / crash recovery** — `backup-now` / `backup-restore` listeners, version ring, exit snapshot, recover prompt
5. **Autosave timer** — reads `autosaveSec` preference
6. **Beat BPM bug** — `settings.beat.bpm` → `settings.get().beat.bpm`
7. **Safe areas** — player honors `playback.showSafeAreas` (title-safe + action-safe)
8. **Project aspect** — player uses project W/H (9:16 / 1:1 / 21:9 letterbox correctly)
9. **Track lock / hide / solo UI** — four buttons per track; player skips hidden / non-solo tracks
10. **Smart snap** — clip edges, markers, beats, playhead, then 0.5s grid
11. **Project Settings dialog** — edit current W/H/FPS; New Project applies defaults
12. **Export honors exportDefaults** — codec, quality, hardware, bitrate shown; Custom preset
13. **Remappable Delete** — no longer hardcodes Backspace
14. **Extra shortcuts** — F fullscreen, Shift+Z zoom-fit, Ctrl+Shift+E SRT, Ctrl+Alt+P project settings
15. **Silence cut uses silenceConfig()** — threshold + pad from Preferences
16. **Scene detection** — uses `sceneThreshold`; splits video clips into scene pieces
17. **Auto duck** — uses `duckConfig()`; lowers music under voice with fades
18. **Chroma key UI + canvas keying** — color / similarity / smoothness
19. **Split screen mode select** — side / pip / grid4 chrome
20. **Speed ramp presets** — Montage, Hero, Bullet Time, Jumper, Flash In/Out
21. **Transition duration slider** — per applied transition
22. **Caption SRT export** — Effects panel + shortcut + AI Mate
23. **Imported LUTs in fxLut dropdown**
24. **Title default length** from Preferences
25. **Transition default duration** from Preferences
26. **Syntax fix** — settings-panel.js extra `)` that blocked app boot

## Fixed round 2 — Filmora Preferences parity (Settings/configurations)

- **General**: Light/Dark/VIP + System mode, update-check cadence, project-library-at-startup, message-center, output folder (`settings.folders`, `interfaceMode`, `checkUpdates`).
- **Folders tab (new)**: snapshot / temp / recorded / project / backup locations — mirrors Filmora Folders prefs.
- **Editing**: default effect duration (5s), split-screen duration (5s), photo placement Fit/Crop/Pan&Zoom, insert vs overwrite, timeline units timecode/seconds/frames.
- **Performance**: separate decode/playback/render accel, background render, preview-render toggle (Filmora Performance tab).
- **Playback**: playback resolution Full/1-2/1-4 (export unaffected).
- **Audio**: denoise strength, hum/wind removal, EQ presets, pitch semitones; per-clip EQ/denoise in Volume panel + Audio Stretch.
- **AI**: min silence length, AI Extend seconds, enhancer intensity, face-mosaic size, music mood/tempo/duration, TTS voice/rate.
- **Captions**: Dynamic templates basic/pop/karaoke/outline + bilingual second line.
- **Beat Options (Filmora dialog)**: highlight every N, highlight offset, show-all vs highlights-only; timeline renders `hl` beats gold; Beat Montage snaps video to highlights.
- **Color tab (new)**: LUT intensity, auto-enhance intensity, color-match strength, default sharpness.
- **Export**: burn-in captions toggle, social-upload target (label), meta line shows captions/hardware/upload.
- **Keyboard**: Recent (Ctrl+O), Snapshot (C), Beat Options (B), Stabilize (Ctrl+Shift+S), Thumbnail (Ctrl+T).

## Fixed round 2 — Filmora tools parity

- **Color depth**: tint, highlights, shadows, sharpness, LUT intensity; Auto Enhance (histogram-aware, intensity-scaled); Color Match (reference-clip lerp by strength).
- **Chroma Plus**: edge feather + spill suppression in canvas keyer.
- **Stabilization**: per-clip stabilize + smoothness (canvas counter-shake zoom crop), tool + context menu + shortcut.
- **Mask depth**: feather + invert.
- **Voice depth**: voice strength slider; Vocal Remover splits ·vox/·inst pair to A2; Denoise strength presets.
- **AI Music Generator**: mood/tempo/duration prefs → job → A2 bed.
- **TTS Voiceover**: prefs voice/rate/pitch + Web Speech preview → A1 clip; Mate `tts` intent.
- **Thumbnail Creator**: 1280×720 canvas + title bar download (Filmora AI Thumbnail).
- **AI Extend (Filmora 15)**: +1–5s forward extend with ripple, ·ext flag.
- **Face Mosaic**: mosaic pixelate preview, size pref.
- **Object Remover**: Magic Box flag + canvas marker.
- **Beat Montage**: Highlight Beat Sync montage.
- **Recent Projects Library**: File → Recent dialog (names + timestamps); still local-first.
- **Snapshot**: C key / event → PNG download honoring snapshot folder label.
- **Context menu**: + Beat Sync, Beat Options, Stabilize, Vocal Remover, Color Match, AI Extend (18 items).
- **Captions render**: pop pill, karaoke two-tone, outline, bilingual second line.

## Fixed round 3 — Filmora 15 feature parity (2026-09-14)

Based on fresh research of Filmora 15.0.1/15.3 release notes + official feature pages
(see `research/aifimora-competitors/findings/F1.md`, `F10-shapes.md`):

**Tools added (`js/creative-tools.js`, wired into Library → AI Tools + context menu + shortcuts):**
1. **Pen Tool (P)** — click points on the program monitor → Pen Path clip with stroke glow, close-path fill, and trim-path reveal animation (Filmora v15.3 standalone Pen Tool).
2. **Text Path** — draws the selected title's text along a drawn path, letter-by-letter with rotation + reveal.
3. **Animated Charts** — "label,value" CSV prompt or file import → animated bar / line / pie-donut chart clip with styled card + legend.
4. **Audio Visualizer** — bars / wave / circle modes, beat-grid driven pseudo-spectrum.
5. **Video Chapters (N)** — chapters at playhead, player progress bar with chapter dividers + current chapter label, rename dialog, YouTube timestamp export (`Ctrl+Shift+N`, includes the required `00:00` first entry), chapter list in the inspector.
6. **Subtitle Extractor** — extracts caption segments from the selected video clip into the project caption list.
7. **Voice Changer** — 7 presets (Chipmunk, Deep/Trailer, Robot, Echo Cave, Phone Call, Child, Narrator) with Web Speech preview, stored as `fx.voiceChanger`.
8. **AI Voice Cloning** — enroll a named voice clone (≥3s source audio) into `voiceClones`; language count in Preferences → AI.
9. **AI SFX Generator** — text prompt → generated SFX clip on A2; duration from Preferences → AI.
10. **Auto Sync** — aligns the selected audio clip to the video under the playhead (nearest-video fallback) with simulated waveform-offset.
11. **Multi-Clip Editing (Ctrl+Alt+B)** — batch dialog: scope (selected/video/audio/all) × volume, speed, LUT, Motion Blur, Flicker Removal; undoable.
12. **Motion Blur** — ghost-trail render along the clip's motion vector (zoom-blur fallback when static).
13. **Flicker Removal** — counter-oscillating luminance correction pass.
14. **Import Subprojects** — `.aifimora.json` imported as a nested compound group at the playhead, registered in `subprojects`.

**Settings/configurations added (Preferences → Creative Tools + Audio + AI):**
- Pen Tool: stroke width, fill closed paths, trim-path animation on/off.
- Charts: default type (bar/line/pie), default duration; Visualizer style.
- FX: Motion Blur strength, Flicker Removal strength (used when toggled).
- Chapters: program-monitor progress bar on/off.
- Audio: **bit depth** (16 / 24 / **32-bit float — Filmora 15 pipeline**).
- AI: voice-clone language count, AI SFX duration.

**Engine wiring:** `state.js` gained `chapters`, `voiceClones`, `subprojects` (+ undo/redo snapshot + sanitize), `DEFAULT_FX` gained `motionBlur`, `deflicker`, `voiceChanger`; creative clip fields (`chart`, `visualizer`, `textPath`, `shape.type === "path"`) persist through save/load. Player dispatches creative overlays after styled text and before safe-areas.

**Verification:** `node verify-filmora15.cjs` → **22/22** (boot, 16 tool buttons, inspector panel, pen path create + render, CSV chart + render, visualizer, text path, chapters + timestamps + bar, subtitle extraction, voice changer, SFX → A2, auto sync, motion blur/deflicker render, batch dialog + apply + undo, Creative Tools prefs pane, persisted prefs, subproject API, zero JS errors).

## Still open (P2 / engine depth)

- Real media frame playback / audio graph / FFmpeg export
- Multi-select rubber band
- Proxy generation + badges (prefs exist, no encode)
- Screen recorder
- Real STT / GenAI (simulated by design)
- i18n (language preference still cosmetic)
- Multicam, planar tracking, motion-track pinning (data model ready, no tracker)

## Verification

- `node verify-parity.cjs` → **23/23 passed** (clipboard, context menu 18 items, track acts, project 9:16, chroma UI, ramps, scene/duck/SRT, export meta with captions, no JS errors).
- `node verify-filmora-gaps.cjs` → **66/66 passed** (all new prefs, UI, tools, functional flows, dialogs, player render, no JS errors).
