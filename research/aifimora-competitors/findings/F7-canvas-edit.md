# F7 — Double-click-to-edit & canvas direct manipulation (Filmora / CapCut / Premiere)

Research date: 2026-03-19
Scope: text/titles, stickers/elements, images/PIP on the timeline → what double-click opens, what on-canvas handles do, which properties users edit.

---

## 1. Filmora — double-click on text clip

### 1.1 Canonical interaction (official guide)

> "To edit a title effect, **double click on it in the timeline to open the Text editing panel**. From here you can change the style (font, size, color, alignment, etc.) and animation of your text."

Source: https://filmora.wondershare.com/guide-filmora-v10/text-and-titles.html

**Answer: BOTH surfaces open together.**
1. **Right-side Property / Text Editing panel** becomes the text-edit surface (default surface in modern Filmora 12/13/14).
2. **Preview / Player window** shows the selected text box with an on-canvas bounding box (Title Group Controller / transform handles).

Double-click does **not** open a modal only. It selects the clip, focuses the Property Panel on Text, and arms the preview for direct manipulation.

### 1.2 Modern Filmora (12/13/14) — Property Panel is primary

Filmora 12+ introduced a persistent **Property Panel** on the right:

> "The Property Panel shows you all relevant information on your project to display your clip's video, audio, color, and speed properties in the Timeline Panel or Preview Window."

Source: https://filmora.wondershare.com/guide/panel-layout.html

Current text-edit flow (Filmora 13/14 guide):

1. Drop a Title from the **Titles** library onto the timeline (`+` icon or drag).
2. Select the text clip → Property Panel opens the **Text** section.
3. Type / rewrite the string in the text box in the Property Panel.
4. Customize font, color, alignment, letter case, bold/italic/underline below the text box.
5. Duration is changed by **dragging the clip edges on the timeline**.

Source: https://filmora.wondershare.com/guide/edit-and-customize-texts.html

So in current Filmora the double-click/select path is: **timeline clip → Property Panel (Text tab) + preview handles**. There is no separate "Advanced Text Edit" window as the default path anymore (that was the v9–v11 modal).

### 1.3 Legacy / Advanced Text Edit window (v9–v11, still documented)

Older guides and the still-shipped Advanced path:

- Double-click title → **Text Editing panel** with tabs: **Presets / Customize / Animation**.
- An **Advanced** button opens a dedicated **Advanced Text Edit** window where you can add extra text boxes, shapes, and images onto the title, with its own mini-timeline for element duration.

Sources:
- https://filmora.wondershare.com/guide-filmora-v10/text-and-titles.html
- https://filmora.wondershare.com/guide/advanced-text-edit.html

### 1.4 Title Group Controller (on-canvas composite transform)

For multi-element title templates, double-clicking the title in the track surfaces a **Title Group Controller** overlay:

- **X / Y boxes** → position of the whole template
- **Scale slider** → size
- **Rotate slider** → orientation

Source: https://filmora.wondershare.com/guide-filmora-v10/text-and-titles.html

### 1.5 Stickers / elements — same double-click pattern

> "To edit a sticker, **double-click it on the timeline**. The settings panel will open on the right side, where you can adjust position, size and other properties."

Source: https://filmora.wondershare.com/guide/add-and-customize-elements.html

No text editing for stickers — only transform + animation.

---

## 2. Filmora — on-canvas / preview direct manipulation

### 2.1 What works on the canvas

From the official text-titles guide (still the best canvas-manipulation spec Filmora publishes):

| Action | How |
|---|---|
| **Move** | Drag the text box in the Preview window to any position; or type X/Y in Transform |
| **Resize** | Drag the circle handles around the text box; or set Scale under Transform |
| **Rotate** | Transform → Rotate slider, or enter a numeric angle |
| **Horizontal ↔ vertical text** | Click the **T** icon in the text style controls |

Source: https://filmora.wondershare.com/guide-filmora-v10/text-and-titles.html

### 2.2 Transform panel (numeric + keyframable)

Property Panel → **Basic → Transform**:
- Scale (Width / Height sliders)
- Position
- Path Curve
- Anchor Point
- Rotation
- Opacity
- Per-parameter **keyframe diamond** icons

Source: https://filmora.wondershare.com/guide/transform.html

Canvas drag and panel numbers stay in sync: drag on preview updates X/Y/Scale; typing numbers moves the on-canvas box.

### 2.3 Bubble text on canvas

Text Bubble section in Property Panel: selecting a bubble renders it in the preview window where you can drag position/size and type content directly.

Source: https://filmora.wondershare.com/guide/edit-and-customize-texts.html

---

## 3. CapCut desktop — similar UX

CapCut desktop follows the same two-surface model, with the **right editing panel** as the property surface.

### 3.1 Select / double-click behavior

- **Single-click** a video, image, or text clip on the timeline → right editing panel loads that clip's properties.
- CapCut help frames selection (not necessarily double-click) as the required step: "The keyframe option only appears when a video, image, or text clip is selected in the timeline. If nothing is selected, CapCut will not display keyframe controls."
- In practice CapCut desktop treats **double-click on a text clip** the same way users expect from Filmora: it selects the text and focuses the Text properties in the right panel (font, size, color, style, animation). Community/third-party guides describe double-click-to-try for effects and select/double-click to edit text; the official help uses "select the clip" language.

Source (official, selection → right panel): https://www.capcut.com/help/keyframes-in-capcut-pc

### 3.2 Right panel sections (CapCut desktop)

When a text / image / sticker clip is selected, the right inspector exposes sections such as:
- **Text** (for text clips): font family, size, color, bold/italic/underline, stroke, background, shadow, alignment, letter/line spacing, bubble, glow
- **Transform**: Position (X/Y), Scale, Rotate, Skew (varies by version)
- **Video / Basic**: Opacity, blend, etc.
- **Animation**: In / Out / Combo presets with duration
- **Keyframe diamonds** next to Position, Scale, Opacity (and more)

Source: https://www.capcut.com/help/keyframes-in-capcut-pc

### 3.3 On-canvas manipulation (CapCut desktop)

CapCut desktop preview supports:
- **Drag** selected text/sticker/image to move
- **Corner handles** to scale (uniform by default; some builds allow free scale)
- **Rotate handle** above the box
- Live binding to the right-panel Transform numbers
- Stickers: "You can't edit text but can use the transform functions (RH Window) to change size etc. You can also play with Animation."

Sources:
- https://www.capcut.com/help/keyframes-in-capcut-pc
- https://roughcut.media/2026/01/21/capcut-a-guide-for-beginners/
- https://www.capcut.com/tools/add-text-to-video

### 3.4 CapCut vs Filmora difference worth noting

- CapCut desktop is more **selection-driven** (one click arms the right panel); double-click is conventional but the documented contract is "clip must be selected."
- CapCut's player canvas and right panel are the only edit surfaces — there is no separate Advanced Text Edit modal like Filmora's legacy window.
- CapCut mobile/web share the same property vocabulary (font, size, color, animation, transform).

---

## 4. Adobe Premiere Pro (reference)

Premiere is the pro end of the same model: **type on canvas + edit in Properties panel**.

### 4.1 Create / edit titles

> "Select the Type tool from the toolbar. Type your title in the Program Monitor. **Right-click the title in the Program Monitor and select Edit Properties** from the context menu to open the Properties panel. You can then customize your title with fonts, colors, and styling options."

Source: https://helpx.adobe.com/premiere/desktop/add-text-images/stylize-text/create-titles.html

### 4.2 Graphics tab (bulk text)

Text panel → Graphics tab lists all text in the sequence. **Double-click any editable text field in the Graphics tab to edit your text.**

Source: https://helpx.adobe.com/premiere/desktop/add-text-images/insert-images-and-graphics/edit-text-in-graphics-tab.html

### 4.3 Properties panel

Premiere's Properties panel is the unified inspector for text appearance (font, style, fill, stroke, shadow, alignment) and transform. On-canvas bounding boxes in the Program Monitor handle move/scale/rotate of graphic layers.

Sources:
- https://helpx.adobe.com/premiere/desktop/add-text-images/stylize-text/about-properties-panel.html
- https://helpx.adobe.com/premiere/desktop/edit-projects/intro-to-editing/edit-video-using-the-properties-panel.html

### 4.4 Premiere nuance for AiFimora

Premiere does **not** use "double-click timeline clip → editor" as its primary text path. It uses:
- Type tool click-on-program-monitor to create
- Select graphic → Properties panel
- Double-click text **in the Graphics list** (not the timeline clip) to edit the string
- Right-click on canvas → Edit Properties

Filmora/CapCut's timeline-double-click is the better model for consumer AI editors.

---

## 5. Properties users actually edit (cross-product matrix)

| Property | Filmora | CapCut desktop | Premiere |
|---|---|---|---|
| Text string | Property Panel text box | Right panel Text section | Properties / direct on canvas |
| Font family | ✓ | ✓ | ✓ |
| Font size | ✓ | ✓ | ✓ |
| Bold / italic / underline | ✓ | ✓ | ✓ |
| Color / fill | ✓ | ✓ | ✓ |
| Stroke / outline | ✓ (Advanced / Basic) | ✓ | ✓ |
| Shadow | ✓ | ✓ | ✓ |
| Glow | ✓ | ✓ | (via effects) |
| Background / bubble | ✓ Bubble | ✓ Background | (shapes) |
| Alignment | ✓ | ✓ | ✓ |
| Letter / line spacing | ✓ | ✓ | ✓ |
| Opacity | ✓ Transform | ✓ | ✓ |
| Position X/Y | canvas drag + panel | canvas drag + panel | canvas drag + panel |
| Scale / resize | handles + panel | handles + panel | handles + panel |
| Rotation | handle/slider + panel | handle + panel | handle + panel |
| Anchor point | ✓ | (version-dependent) | ✓ |
| In/Out/Combo animation presets | ✓ 80+ presets | ✓ | (Motion Graphics / Essential Graphics) |
| Keyframes on transform | ✓ | ✓ | ✓ |
| Duration | timeline clip edges | timeline clip edges | timeline clip edges |
| Save as preset | ✓ | (styles/templates) | Motion Graphics templates |

---

## 6. Product-spec summary for AiFimora — exact interaction model to copy

**Copy the Filmora 13/14 + CapCut desktop hybrid.** It is the consumer-proven model; Premiere is too tool-heavy for an AI editor.

### 6.1 Double-click contract (timeline)

**Double-click a text / title / sticker / image clip on the timeline →**

1. Select the clip (highlight on timeline).
2. Seek the playhead to the click position inside the clip (or keep current playhead — pick one and be consistent; Filmora keeps playhead, CapCut often seeks; recommend **keep playhead**, avoid surprise jumps).
3. Open / focus the **right-side Property Panel** on the clip-type inspector:
   - Text clip → **Text** tab (string + font/size/color/style)
   - Sticker / image / PIP → **Basic / Transform** tab
4. Show **selection handles on the preview canvas** for that clip.
5. Do **not** open a modal window. Do **not** require a second confirmation.

Single-click on a timeline clip should also select + open the Property Panel (CapCut behavior). Double-click is the discoverable "edit me" gesture users already know from Filmora.

### 6.2 Preview canvas direct manipulation (must-have)

When a text/sticker/image clip is selected:

| Gesture | Behavior |
|---|---|
| Drag body | Move (updates Position X/Y live in panel) |
| Drag corner handle | Uniform scale (Shift = free scale if needed) |
| Drag side handle | Optional; default uniform |
| Rotate handle (above box) | Rotate around anchor |
| Double-click **on canvas text** | Enter text-edit mode (caret in the string); Esc exits |
| Arrow keys | Nudge 1px; Shift+Arrow = 10px |
| Pinch (touch) | Scale |

Handles: 8-point box + rotation stick. Snap to title-safe / center guides with a visible snap line.

### 6.3 Property Panel structure (right side)

```
[Text clip selected]
├─ Text
│   ├─ string input (multiline)
│   ├─ Font family / size / B I U
│   ├─ Color fill, Stroke, Shadow, Glow
│   ├─ Alignment, letter-spacing, line-height
│   └─ Bubble / background (optional)
├─ Transform
│   ├─ Position X, Y          ← keyframe
│   ├─ Scale W, H             ← keyframe
│   ├─ Rotation               ← keyframe
│   ├─ Opacity                ← keyframe
│   └─ Anchor point
├─ Animation
│   ├─ In / Out / Combo presets
│   └─ Duration slider
└─ Advanced
    └─ multi-element title composer (later)
```

```
[Sticker / Image / PIP selected]
├─ Basic (opacity, blend)
├─ Transform (same as above)
└─ Animation
```

### 6.4 Duration

Change duration **only** by dragging clip edges on the timeline (or numeric duration field next to the clip). Do not put duration inside the text editor — that's a common Filmora/CapCut confusion to avoid.

### 6.5 Bidirectional binding (critical)

- Canvas drag ↔ panel numbers must update in the same frame.
- Panel number entry must move the canvas box immediately.
- Undo/redo covers both paths as one transaction per gesture.

### 6.6 What NOT to copy

| Avoid | Why |
|---|---|
| Filmora legacy **Advanced Text Edit modal** | Context loss; users hate modal editors |
| Premiere "Type tool then right-click Edit Properties" | Too many hops for AI-first users |
| Separate on-canvas-only edit with no panel | Power users need numeric control |
| Double-click opening a different workspace / layout switch | Disorienting |

### 6.7 Recommended double-click outcomes by clip type (spec)

| Clip type | Double-click opens | Canvas shows | Primary panel tab |
|---|---|---|---|
| Text / Title | Property Panel → Text | text box + handles | Text |
| Caption / Subtitle | Property Panel → Text + caption list highlight | caption box + handles | Text |
| Sticker / Element | Property Panel → Transform + Animation | sticker + handles | Basic |
| Image / PIP | Property Panel → Transform | image + handles | Basic / Video |
| Video clip | Property Panel → Video / Color / Speed (no canvas handles unless transform on) | optional crop/transform | Video |
| Audio clip | Property Panel → Audio (waveform; no canvas) | — | Audio |

### 6.8 Priority for AiFimora v1

**P0**
1. Timeline single/double-click → select + Property Panel + canvas handles
2. Canvas move / scale / rotate with live panel sync
3. Text: string, font, size, color, bold, alignment, opacity
4. Sticker/image: transform + opacity
5. Duration via timeline edges

**P1**
6. Text double-click on canvas → inline caret edit
7. Animation In/Out presets
8. Stroke / shadow / glow
9. Keyframe diamonds on Transform
10. Snap guides + title-safe

**P2**
11. Bubble / background
12. Save style as preset
13. Advanced multi-element title composer
14. Anchor point control

---

## Sources

### Filmora
- https://filmora.wondershare.com/guide-filmora-v10/text-and-titles.html — double-click → Text editing panel; canvas move/resize/rotate; Title Group Controller; Advanced Text Edit
- https://filmora.wondershare.com/guide/edit-and-customize-texts.html — modern Property Panel text flow, bubble, shadow/glow/shape, duration on timeline
- https://filmora.wondershare.com/guide/add-and-customize-elements.html — stickers: double-click → settings panel (position/size)
- https://filmora.wondershare.com/guide/advanced-text-edit.html — Advanced Text Edit window (Presets / Customize / Animation)
- https://filmora.wondershare.com/guide/panel-layout.html — Property Panel definition (Filmora 12+)
- https://filmora.wondershare.com/guide/transform.html — Transform: scale/position/rotation/opacity + keyframes
- https://filmora.wondershare.com/guide/text-animation.html — text animation presets
- https://support.wondershare.com/how-tos/filmora/how-to-apply-animation-to-text.html — "Double-click it to have the advanced editing options; Switch to the Animation tab"

### CapCut
- https://www.capcut.com/help/keyframes-in-capcut-pc — select clip → right editing panel; Transform/Video/Adjust; Position/Scale/Opacity keyframes
- https://www.capcut.com/tools/add-text-to-video — text templates; customize style, font, color, animation
- https://roughcut.media/2026/01/21/capcut-a-guide-for-beginners/ — stickers: transform functions in RH window; no text edit on stickers
- https://www.capcut.com/editor — desktop/web editor structure (Text, Captions, player, timeline)

### Premiere Pro
- https://helpx.adobe.com/premiere/desktop/add-text-images/stylize-text/create-titles.html — Type tool + Program Monitor + right-click Edit Properties → Properties panel
- https://helpx.adobe.com/premiere/desktop/add-text-images/stylize-text/about-properties-panel.html — Properties panel overview
- https://helpx.adobe.com/premiere/desktop/add-text-images/insert-images-and-graphics/edit-text-in-graphics-tab.html — double-click editable text field in Graphics tab
- https://helpx.adobe.com/premiere/desktop/edit-projects/intro-to-editing/edit-video-using-the-properties-panel.html — Properties panel clip editing
