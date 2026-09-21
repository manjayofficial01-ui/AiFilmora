# F10 — Wondershare Filmora Shape / Drawing / Element Library UX

**Primary source:** official Filmora Windows User Guide (`filmora.wondershare.com/guide`) plus one first-party Pen Tool feature tutorial. Claims below are sourced; where the official guide is silent, that is stated as a gap.

**Survey date:** 2026-09 (Filmora v15.x product surface as documented).

---

## 1. Where shapes live (Elements? Stickers? Annotations?)

### Claim map

| Surface | Role | Shape relevance |
|---|---|---|
| **Stickers** (top library tab) | Browsable library of 1000+ decorative / animated assets | Primary *library* home for graphic elements; historically labeled “Elements” |
| **Drawing Tools** (timeline toolbar) | Interactive draw-on-preview tools | Primary home for parametric shapes (rect / arrow / oval / line) |
| **Pen Tool** (standalone toolbar as of v15.3) | Freeform path drawing + motion paths | Custom closed/open shapes, stroke animation, path follow |
| **Asset Center** (button under library tabs) | Curated marketplace / themed packs | Discovery of sticker/effect packs beyond default categories |
| **Filmstock** (external store) | Subscription / pack marketplace | Downloads land in Filmora categories; diamond badge marks Filmstock items |
| **Mine → Favorites / tags** | User-organized library | Star favorites + custom tags; not a shape-authoring surface |

### Claims + URLs

1. **There is no top-level “Shapes” or “Annotations” library tab.** The Media / library panel tabs are: Media, Stock Media, Audio, Titles, Transitions, Effects, **Stickers**, Templates.  
   URL: https://filmora.wondershare.com/guide/panel-layout.html

2. **The current guide renames the old “Elements” concept to “Stickers.”** Section title is “Adding and Customizing Stickers”; the guide section path is Video Customizations → Stickers. Marketing copy still says “1000+ built-in stickers.”  
   URL: https://filmora.wondershare.com/guide/add-and-customize-elements.html  
   (slug still says `add-and-customize-elements` — naming lag)

3. **Parametric shapes are NOT in the Stickers library.** They live under **Drawing Tools**, accessed “from the top of the timeline,” and the user picks Rectangle / Arrow / Line / Oval from a Shapes menu.  
   URL: https://filmora.wondershare.com/guide/drawing-tools.html

4. **Drawing Tools purpose is annotation + banners** (highlight details, create banners on video), not a general vector-design suite.  
   URL: https://filmora.wondershare.com/guide/drawing-tools.html

5. **Pen Tool moved out of Drawing Tools.** As of **Filmora v15.3**, Pen Tool is a standalone toolbar tool; it auto-creates a **Pen Path Clip** on the timeline.  
   URL: https://filmora.wondershare.com/customize-video/how-to-use-the-pen-tool-in-filmora.html

6. **Asset Center** sits under the main asset category tabs, next to the search bar; it opens a Discover view with promo banners, Top Lists, and theme categories (Game, Vlog, Spring, Birthday, …).  
   URL: https://filmora.wondershare.com/guide/asset-center.html

7. **Creative-asset taxonomy** explicitly lists: Stock Media, Audio, Titles, Transitions, Effects, Filters, **Stickers**, Templates. Favorites + custom groups appear under **Mine**.  
   URL: https://filmora.wondershare.com/guide/filmora-creative-assets.html

**Takeaway for AiFimora:** Filmora splits “shapes” into (a) a **library** of pre-made stickers/elements and (b) a **tool** family for drawing geometric shapes. Users must learn two surfaces. A unified **Library → Shapes** panel that holds both parametric primitives and hand-drawn stickers is a clarity win.

---

## 2. Shape types

### Drawing Tools (parametric)

| Type | Documented? | Notes |
|---|---|---|
| Rectangle | Yes | Used as banner base |
| Arrow | Yes | “Dynamic arrows” / annotation |
| Oval | Yes (mentioned in intro) | Guide intro lists arrow, rectangle, oval |
| Line | Yes | Special format customization (start/end style, size) |
| Pen / freeform | Yes (Way 4 / Pen Tool) | Bezier anchors, curves, close path |
| Hand-drawn brush | No dedicated brush | Handwriting is achieved via Pen + Trim Path animation |

URLs:
- https://filmora.wondershare.com/guide/drawing-tools.html  
- https://filmora.wondershare.com/customize-video/how-to-use-the-pen-tool-in-filmora.html

### Pen Tool capabilities (advanced)

- Single-click = straight segment; click-drag = Bezier curve; Alt+click toggles smooth/corner; double-click deletes anchor; close near start point to form a filled shape.
- Finish path: **Enter** (complete + return to Selection), **Esc** (cancel preview / exit mode).
- **End Shape** (v15.2+): start/end markers on **open** paths only (arrows, callout lines); size scales with stroke weight; Swap button.
- **Stroke effects** (v15.1.10+): solid or effect strokes including glow and **graphic-element pattern strokes**.
- **Trim Path**: Start / End / Offset keyframes → stroke growth (handwriting, ECG, progress bars).
- **Path Follow**: bind objects to path from Preset Library, timeline clips, or **Import from computer**.

URL: https://filmora.wondershare.com/customize-video/how-to-use-the-pen-tool-in-filmora.html

### Stickers (pre-made elements)

- Types called out: simple icons, animated graphics, audio-synced stickers.
- Categories browsable; download before use.
- AI Sticker Generator exists as a separate guide (generative stickers, not geometric shapes).

URL: https://filmora.wondershare.com/guide/add-and-customize-elements.html  
URL: https://filmora.wondershare.com/guide/ai-sticker-generator.html

### Claim: Hand-drawn style

- No “hand-drawn shape library category” is documented.
- Hand-drawn *motion* is produced by Pen Tool + Trim Path keyframes (handwriting titles / ECG growth).
- URL: https://filmora.wondershare.com/customize-video/how-to-use-the-pen-tool-in-filmora.html

---

## 3. Drag to timeline or preview

### Stickers

Three documented add paths:
1. Click **+** on the sticker thumbnail → adds to timeline at playhead.
2. **Drag and drop** onto the timeline.
3. (Related effects also support hover → + for overlays.)

After add: **double-click** the timeline sticker → right property panel for position/size and other properties.  
Delete: select + Delete key, or right-click → Delete.  
Favorite: star icon or right-click → Add to Favorites.

URL: https://filmora.wondershare.com/guide/add-and-customize-elements.html

### Drawing Tools / shapes

- Select tool (e.g. Rectangle) → **draw on the preview window** (not drag-from-library).
- Position by dragging the shape in the preview.
- Shapes become timeline clips (Pen Path Clip is created automatically for Pen).

URL: https://filmora.wondershare.com/guide/drawing-tools.html  
URL: https://filmora.wondershare.com/customize-video/how-to-use-the-pen-tool-in-filmora.html

### Asset Center

- Hover asset → **+**; auto-downloads if needed; inserts at playhead.
- Star → Favorites (accessible from main library panel).

URL: https://filmora.wondershare.com/guide/asset-center.html

**Takeaway:** Filmora has **two placement models** — library drag/+ (stickers) vs draw-on-canvas (shapes). AiFimora should support **both** on one Shapes panel: click-to-insert default size + drag-to-canvas + draw mode for freehand.

---

## 4. Customize fill / stroke

### Drawing Tools (simple)

- Right-side panel: enable **Fill** toggle + pick color (rectangle banner / arrow).
- Line-specific under **Basic → Line**: define start style, end style, overall style, size.
- Animations applied from Animation section (double-click); keyframes via right-click → Show Keyframe Animation.

URL: https://filmora.wondershare.com/guide/drawing-tools.html

### Pen Tool (full stroke model)

**Fill** (closed paths):
- Interior color, gradient, opacity.

**Stroke** (outline):
- Style: solid / dashed / dotted
- Cap: Butt / Round / Square
- Join: Miter / Round / Bevel
- Weight (thickness)
- Color / Opacity / Blur

**Stroke effect presets:**
- Solid stroke vs effect stroke (glow intensity, element-based pattern strokes).

**End Shape (open paths, v15.2+):**
- Independent Start / End marker pickers + Swap.

URL: https://filmora.wondershare.com/customize-video/how-to-use-the-pen-tool-in-filmora.html

### Stickers

- Double-click → property panel adjusts **position, size and other properties**.
- Guide does **not** claim full fill/stroke recolor for arbitrary sticker bitmaps — customization is transform/animation oriented.

URL: https://filmora.wondershare.com/guide/add-and-customize-elements.html

### Drop shadow (related)

- Generic “Applying drop shadow” exists as a clip property, not shape-specific stroke model.  
  URL: https://filmora.wondershare.com/guide/drop-shadow.html

**Takeaway:** Filmora’s richest shape styling is on **Pen Tool**, not on library stickers. AiFimora Shapes should expose Fill + Stroke (style/cap/join/weight/color/opacity/blur) as first-class on **every** parametric shape, not only freehand paths.

---

## 5. Custom import of elements / effects from user folder

### Documented import paths

| Path | What it imports | Where it appears | URL |
|---|---|---|---|
| **Filmstock web download** | Effect packs | Folder “Filmstock” – Effect inside Filmora | https://filmora.wondershare.com/guide/filmstock-asset.html |
| **Filmstock via in-app diamond badge** | Premium packs | Correct category sections (Audio, Title, Transitions, Elements/Stickers), marked with red dot | https://filmora.wondershare.com/guide/filmstock-asset.html ; https://filmora.wondershare.com/guide/effects-store-guide-new.html |
| **Asset Center** | Curated packs / singles | Direct to timeline after download | https://filmora.wondershare.com/guide/asset-center.html |
| **Path Follow → Import from computer** | Local media as path follower | Bound to Pen Path Clip | https://filmora.wondershare.com/customize-video/how-to-use-the-pen-tool-in-filmora.html |
| **Standard media Import** | User video/image/audio | Media panel (project media, not library stickers) | https://filmora.wondershare.com/guide/importing-media.html |

### Claims about limits / gaps

1. **Filmstock pack install** is the documented way third-party/extra assets enter library categories. After download, effects are “sorted into the correct sections of the program (Audio, Title, Transitions, and Elements) and marked with a red dot.”  
   URL: https://filmora.wondershare.com/guide/effects-store-guide-new.html

2. **Subscription risk:** “If your subscription expires, you will lose access to the video effects you installed in Filmora.”  
   URL: https://filmora.wondershare.com/guide/effects-store-guide-new.html

3. **Same Wondershare ID** recommended for Filmstock + Filmora. Filmstock resources require Filmora installed.  
   URL: https://filmora.wondershare.com/guide/filmstock-asset.html

4. **Favorites + custom tags** (Recently Used / Commonly Used / user-created New Tag; Manage Tag rename/delete) under **Mine → Favorites**.  
   URL: https://filmora.wondershare.com/guide/mark-favorite-elements.html

5. **Not documented in official guide:** importing arbitrary user-folder SVG/Lottie/JSON as a first-class library “shape sticker.” Closest analogues are (a) Filmstock pack install and (b) Path Follow local file import. Third-party plugins (OpenFX / VST3 / NewBlue / Boris) are effect plugins, not shape libraries.  
   URLs: https://filmora.wondershare.com/guide/filmora-openfx-plugins.html ; https://filmora.wondershare.com/guide/newblue-fx-effects.html

**Takeaway:** Filmora’s “custom import” is **pack/store-centric**, not folder-watch-centric. AiFimora can differentiate with a local **User Shapes folder** (drop SVG/PNG/Lottie → auto-index → Mine → Shapes) plus favorites/tags.

---

## Summary answer to the five research questions

1. **Where shapes live?**  
   Split: **Stickers** tab (library of pre-made elements; formerly Elements) + **Drawing Tools** (timeline toolbar for rect/arrow/oval/line) + **Pen Tool** (standalone since v15.3). No dedicated Shapes or Annotations tab. Asset Center / Filmstock feed the Stickers library.

2. **Shape types?**  
   Parametric: rectangle, arrow, oval, line. Freeform: Pen (open/closed Bezier). Hand-drawn look via Pen + Trim Path, not a library category. Stickers cover icons / animated / audio-synced graphics.

3. **Drag to timeline or preview?**  
   Stickers: + icon or drag to timeline. Shapes: draw on preview. Asset Center: + inserts at playhead (auto-download). Pen: first click creates Pen Path Clip.

4. **Customize fill/stroke?**  
   Drawing Tools: Fill toggle + color; Line start/end style + size. Pen Tool: full Fill + Stroke (style/cap/join/weight/color/opacity/blur) + effect/glow/pattern strokes + End Shape markers. Stickers: transform/animation, not deep recolor.

5. **Custom import from user folder?**  
   Officially: Filmstock pack installs into categories; Path Follow can import a local file as a follower. No official “drop SVG into Shapes library” flow. Favorites/tags organize under Mine.

---

## Source index

| # | Page | URL |
|---|---|---|
| 1 | Filmora User Guide home | https://filmora.wondershare.com/guide/ |
| 2 | Drawing Tools for Windows | https://filmora.wondershare.com/guide/drawing-tools.html |
| 3 | Adding and Customizing Stickers | https://filmora.wondershare.com/guide/add-and-customize-elements.html |
| 4 | Pen Tool tutorial (motion paths) | https://filmora.wondershare.com/customize-video/how-to-use-the-pen-tool-in-filmora.html |
| 5 | Panel Layout | https://filmora.wondershare.com/guide/panel-layout.html |
| 6 | Asset Center | https://filmora.wondershare.com/guide/asset-center.html |
| 7 | Creative Assets overview | https://filmora.wondershare.com/guide/filmora-creative-assets.html |
| 8 | Filmstock Asset | https://filmora.wondershare.com/guide/filmstock-asset.html |
| 9 | Effects Store / Filmstock access | https://filmora.wondershare.com/guide/effects-store-guide-new.html |
| 10 | Marked Favorites (tags) | https://filmora.wondershare.com/guide/mark-favorite-elements.html |
| 11 | Types of Effects | https://filmora.wondershare.com/guide/types-of-effects.html |
| 12 | AI Sticker Generator | https://filmora.wondershare.com/guide/ai-sticker-generator.html |

---

## Competitive implications for AiFimora (short)

- **Win on cohesion:** Filmora’s shapes are split across Stickers vs Drawing Tools vs Pen; users bounce between surfaces. One **Library → Shapes** panel is simpler.
- **Win on local import:** Official guide has no first-class user-folder shape pack; a watched folder + auto index is a clear differentiator.
- **Win on sticker recolor:** Filmora stickers are mostly transform-only; parametric SVG shapes with live fill/stroke would cover both use cases.
- **Match the motion bar:** Path Follow + Trim Path are the premium motion-graphics bar; at minimum, enter/exit animations + keyframes on shapes.
- **Match library hygiene:** Favorites, custom tags, Mine section, search, category chips, download-on-use — all expected.
