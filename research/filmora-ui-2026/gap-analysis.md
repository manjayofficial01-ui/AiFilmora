# Filmora 14/15 vs AiFilmora — UI/Tool Gap (2026-09-22)

Status: working gap board used for the chrome redesign. Deep-research findings under `findings/` refine this.

## Already close (keep)

| Area | Status |
|---|---|
| Titlebar menus File/Edit/Tools/View/Extended/Help/Version | Present (`index.html` filmora-menu) |
| Library tab taxonomy Media/Stock/Audio/Titles/Transitions/Effects/Filters/Stickers/Templates/AI | Present via `media-menu.js` |
| Timeline/Source player tabs + Quality + Aspect | Present |
| Project Info card (Name/Files/Res/FPS/Color/Sample/Duration/Thumb) | Present |
| Undo/Redo labels + disable | Present (`filmora-parity.js`) |
| Filmora dark/light tokens + VIP theme | Present (`tokens.css`, `assets-bridge.js`) |
| Panel resize (sidebar/inspector) | Present (`panel-resize.js`) |
| Feature depth (LUT, audio FX, panzoom, speed, captions, creative tools) | Broad |

## Critical gaps to close this pass

1. **Content-aware properties (right rail)**
   Filmora shows one Properties panel whose sections change with selection type
   (Video / Audio / Text / Transition / Element), not 11 always-on tabs.
   Need accordion: Project · Video · Color · Animation · Speed · Audio · Text · Mask · AI
   with automatic section visibility by `clip.type`.

2. **Titlebar right chrome**
   Filmora: cloud/sync · effects store · cart · account · **Export▾** · min/max/close.
   Current: credits chip · recent · prefs · Export. Missing store/account/window controls
   and Export format dropdown.

3. **Player transport icon language**
   Current transport uses emoji (⏮▶🔊⛶). Filmora uses thin monochrome SVG glyphs.
   Need: home, prev-frame, play/pause, next-frame, end, mute+volume, snapshot, fullscreen.

4. **Timeline toolbar density**
   Current: long text button row. Filmora: compact icon tools (undo/redo, delete, crop,
   split, speed, marker, snapshot, zoom). Convert to icon+tooltip cluster.

5. **Panel expand/collapse**
   Filmora can collapse library / properties / timeline. Only Project Info has Hide today.
   Need chevron collapse on sidebar, inspector, timeline.

6. **Export dialog Filmora structure**
   Tabs Video | Device | Social | Web + quality (Best/Good/Custom), codec, resolution,
   fps, bitrate, hardware accel, burn-in captions, social upload target.
   Partial fields exist; need tabbed Filmora layout + Export▾ presets.

7. **Save / project properties**
   Filmora Project Settings + Save location memory + "Save as package" (.aifimora.json
   archive) + dirty-dot on title. Partially present; surface as first-class File menu
   and Project Settings fields (Color space, Sample rate, Thumbnail update).

8. **Missing tool entry points (UI surface)**
   - Instant Cutter / trim tool entry
   - Screen recorder entry (menu Tools)
   - Silence detect + Auto duck in timeline toolbar / Tools
   - Motion tracking / Planar tracking property sections (data model ready)
   - Proxy status badge on clips
   - Stock media search bar UX (Filmora has top search across stocks)

## Non-goals
Real FFmpeg encode, cloud account, paid store checkout, Windows chrome frame from OS.

## Success criteria
A Filmora 14 user opening AiFilmora can identify: menu bar, library tabs, program monitor
with quality dropdown, Project Info + content-aware properties, compact timeline tools,
one filled Export CTA with dropdown, and icon language matching thin-stroke Filmora glyphs.
