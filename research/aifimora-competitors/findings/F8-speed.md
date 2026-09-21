# F8 — Filmora video speed / time remapping (2024–2026)

Research date: 2026-03-19  
Scope: speed presets, uniform vs segmented/ramp, ripple on duration change, freeze frame, audio pitch/mute, UI location.  
Primary sources: filmora.wondershare.com official User Guide (Windows/Mac) + one official how-to article.

---

## Executive summary (what Filmora actually does today)

| Topic | Filmora behavior (2024–2026) |
|---|---|
| Uniform speed | Right Property Panel → **Speed** tab → **Uniform Speed**; also toolbar **Speed** icon / right-click **Speed** |
| Preset groups | Documented as **Slow / Normal / Fast** + **custom numeric value** (current guides do **not** publish a fixed 0.5×/2× list) |
| Reverse | Checkbox **Reverse Speed** in Speed tab; also toolbar Speed → Reverse |
| Speed ramp | **Segmented Speed Control** (v15.5.10+): **Add Speed Point** → independent per-segment speed; optional **Freeze Frame** between segments |
| Uniform vs ramp | Explicit two-mode split: **Uniform Speed** vs segmented speed points (ramp) |
| Freeze frame | Right-click clip → **Speed** → **Add Freeze Frame**; auto-split + still; **default 5s**; trim via right-click → **Duration** |
| Ripple | **Magnetic Timeline** snaps/adjusts surrounding media on trim/move/delete; **Auto Ripple** auto-removes gaps. Speed-length-change ripple is **not** spelled out as a dedicated control |
| Audio pitch | Separate: Property Panel → **Audio** → **Adjustment** → **Pitch** slider. Not documented as auto-compensating speed |
| Mute on speed | No dedicated "mute when speeding" control; mute is track/clip-level (speaker icon / right-click Mute) |
| UI home | **Right Property Panel → Speed tab** is the canonical surface; timeline Speed icon + right-click Speed menu as secondary |

---

## 1. Speed presets (Slow / Normal / Fast / custom / reverse / freeze)

### 1.1 Toolbar Speed icon → Slow / Fast / Normal

> "After selecting the clip, tap on the **Speed** icon above the timeline and select from the **Slow**, **Fast**, and **Normal** speed."

- URL: https://filmora.wondershare.com/guide/magnetic-timeline.html
- Source type: primary (official User Guide)
- Confidence: high

### 1.2 Segmented segments also use Slow / Normal / Fast + custom

> "Use the preset options such as **Slow**, **Normal**, or **Fast**, or manually enter a custom speed value according to your editing needs."

- URL: https://filmora.wondershare.com/guide/change-video-speed.html
- Source type: primary
- Confidence: high
- Note: This page is the current Windows "Change Video Speed" guide and is titled **Apply Segmented Speed Control Windows** — the uniform-speed page content has been reoriented to segmented speed; uniform lives under Speed tab → Uniform Speed (see §6).

Mac guide is parallel:

> "You can choose preset speeds like **Slow**, **Normal**, or **Fast**, or manually enter a custom value."

- URL: https://filmora.wondershare.com/guide-mac/change-speed.html
- Confidence: high

### 1.3 Custom Speed dialog (uniform path)

Official how-to (not the User Guide) still documents a **Custom Speed** dialog:

> "Right-click on the video in the timeline. Choose 'Speed and Duration' from a long list of menu options that pop up. A Custom Speed dialogue box appears. Change the duration of the video to reduce it to less than 1x…"

> "To uniformly slow down an entire clip without speed points, access the Custom Speed dialog box via the Speed and Duration menu and reduce the speed multiplier below 1x or increase the total duration time."

- URL: https://filmora.wondershare.com/video-editing-tips/speed-ramping.html
- Source type: official marketing/tutorial (filmora.wondershare.com)
- Confidence: medium-high (official site, not the /guide/ tree)
- Product implication: speed multiplier **and** duration are bidirectionally linked in one dialog.

### 1.4 Exact multipliers (0.5×, 2×, …)

**Gap in primary docs.** Current official guides document **Slow / Normal / Fast** groups + custom entry; they do **not** publish the current default preset list (e.g. 0.1×, 0.5×, 2×, 10×). Those values appear in older Filmora UI and third-party tutorials but could not be verified on a current `/guide/` page.

- Confidence for exact numbers: **low / unverified**
- Recommendation for AiFimora: ship explicit presets `0.25×, 0.5×, 0.75×, 1×, 1.5×, 2×, 4×, 8×, 16×` + free numeric + reverse. Industry-standard; do not invent "Filmora exact list" as a claim.

### 1.5 Reverse

> "Click the video in the timeline to enter the Video edit panel, and then switch to the Speed tab. Check the box next to **Reverse Speed**."

> "Select the video in the timeline, go to the **Speed** icon in the toolbar, and then select the **Reverse** option."

- URL: https://filmora.wondershare.com/guide/filmora-play-video-in-reverse.html
- Confidence: high

### 1.6 Reset

> "select a speed segment and clear the speed points by clicking the **Clear Clip Speed**. This will restore the clip back to a single 1x speed segment."

- URL: https://filmora.wondershare.com/guide/change-video-speed.html
- Confidence: high

---

## 2. Uniform speed vs speed ramp / curve

Filmora documents **two speed modes**, not a continuous Bezier "speed curve" editor like Premiere.

### 2.1 Uniform Speed (whole clip)

From Super Slow Motion guide (clearest UI path today):

> "Select the video you just dropped into the timeline and navigate to the right settings panel. Then, select the **Speed** tab and choose **Uniform Speed** further. Expand the **AI Frame Interpolation** and select **Optical Flow** from the given options."

Alternate entry points on the same page:
- Right-click clip → **Uniform Speed**
- Top toolbar → **Tool** → **Speed** → **Uniform Speed**

- URL: https://filmora.wondershare.com/guide/super-slow-motion-with-optical-flow.html
- Confidence: high

Under Uniform Speed Filmora exposes **AI Frame Interpolation** (including **Optical Flow**) for smooth slow-mo — a quality option, not a ramp.

### 2.2 Segmented Speed Control / speed ramp (v15.5.10+)

> "This feature allows you to create multiple speed variations within a single video clip using adjustable speed points… Segmented speed automatically divides clips into independent speed segments, giving each section its own playback speed and allowing real-time preview."

Workflow:
1. Move playhead to desired point.
2. Right-click clip → **Speed** → **Add Speed Point**.
3. Click a segment → set Slow/Normal/Fast or custom.
4. Optional: **Freeze Frame** at a boundary.
5. **Clear Clip Speed** to reset.

- URL: https://filmora.wondershare.com/guide/change-video-speed.html
- Mac: https://filmora.wondershare.com/guide-mac/change-speed.html
- Version note (official how-to): segmented ramp "in Filmora v15.5.10 and later" on Windows  
  URL: https://filmora.wondershare.com/video-editing-tips/speed-ramping.html
- Confidence: high

### 2.3 No continuous speed-curve graph

Official guides describe **speed points → piecewise constant segments**, not interpolated ramps with handles. Mac copy mentions "smooth transitions between speed points" at a marketing level, but the User Guide procedure is discrete segments.

- URL: https://filmora.wondershare.com/guide-mac/change-speed.html
- Confidence: medium (absence of curve editor in documented UI)

---

## 3. Ripple: when a clip shortens/lengthens, do following clips move?

Filmora splits "ripple" into **two separate timeline systems**. Neither User Guide page says the words "when you change speed, following clips move," but together they define the behavior AiFimora should copy.

### 3.1 Magnetic Timeline (primary mechanism for length change)

> "In Filmora on Windows, the magnetic timeline automatically snaps clips together, preventing gaps during editing. When you **trim, move, or delete** a clip, surrounding media adjusts instantly to maintain alignment."

Enabled via a **Magnetic Timeline icon on the left side of the timeline**.

- URL: https://filmora.wondershare.com/guide/magnetic-timeline.html
- Confidence: high
- Inference (marked): a speed change that **changes clip duration** is treated like a duration edit; with Magnetic Timeline on, later clips on that track stay snapped. Docs list trim/move/delete explicitly — speed is not named.

### 3.2 Auto Ripple (gap cleanup)

> "With Filmora's Auto Ripple functionality, users do not need to remove them manually. Enabling this functionality before the editing process will **auto-remove these spaces between clips**."

Enabled via **Open Auto Ripple** next to Track Manager (left of timeline tracks).

Manual gap close if off:
- Click gap → **X** icon
- Right-click gap → **Ripple Delete**
- Shortcut **Shift + Delete**

- URL: https://filmora.wondershare.com/guide/auto-ripple.html
- Confidence: high
- Note: Auto Ripple is framed as **gap removal after edits**, not a per-clip "ripple following clips" toggle like Premiere's Ripple Edit.

### 3.3 Answer for product spec

| Setting | Speed shortens clip | Speed lengthens clip |
|---|---|---|
| Magnetic Timeline ON (default Filmora style) | Later clips on same track **shift left** (stay snapped) | Later clips **shift right** / clip may overwrite or push depending on free space — docs say surrounding media adjusts |
| Magnetic Timeline OFF | **Gap** left where clip shrank | Overlap or manual push |
| Auto Ripple ON | Residual gaps **auto-closed** | Same |

**AiFimora should implement:** one project/timeline toggle `rippleOnDurationChange` (default **true**, Filmora-magnetic style). When true, any duration change (speed, freeze insert, trim) shifts all following clips on that track (and linked audio) by Δ. When false, leave a gap (user closes manually).

---

## 4. Freeze frame: still creation + duration

### 4.1 Standalone freeze

> "Move the playhead to the exact frame where you want to create a freeze frame. Right-click on the video clip in the timeline, select **Speed** and choose **Add Freeze Frame** from the menu. Filmora will **automatically split the clip and insert a still image** at the selected frame."

Duration edit:

> "Now right-click the frozen frame and choose the **Duration** option from the expanded menu."  
> "Adjust the duration by dragging the timestamp and click on the **Save** button."

- URL: https://filmora.wondershare.com/guide/freeze-frame.html
- Confidence: high

### 4.2 Freeze as a speed-segment (default 5s)

> "Use the **Freeze Frame** option to automatically create a separate freeze segment with a **default duration of 5 seconds**."

> "Filmora will insert a freeze segment (default length is 5 seconds), which you can trim to match your timing."

- URLs:  
  https://filmora.wondershare.com/guide/change-video-speed.html  
  https://filmora.wondershare.com/video-editing-tips/speed-ramping.html  
- Confidence: high

### 4.3 Product rule

Freeze frame = **split at playhead + insert still segment** (not a zero-speed keyframe). Default hold **5.0s**, editable. Source frame is the playhead frame. Following timeline content obeys §3 ripple rules.

---

## 5. Audio pitch / mute when speeding

### 5.1 Pitch is a separate Audio control (not speed-linked)

> "Head to the properties panel on the right and enable the **Audio** section. Now, expand the **Adjustment** option and drag the **Pitch** slider."

Official pitch page: "modify the tone of audio **without affecting its speed**."

- URL: https://filmora.wondershare.com/guide/pitch.html
- Confidence: high
- Implication: Filmora does **not** document "pitch-lock when changing clip speed." Speeding a clip (historical NLE default) typically speeds audio with it; pitch correction is a **manual** Pitch slider, or detach/mute.

### 5.2 Mute is independent

> "To silence the full audio, click the speaker icon on the timeline, or right-click the clip and choose **Mute**. The volume bar will appear dimmed once muted."

Partial mute = split first, then mute the section. Unmute via track mute icon.

- URL: https://filmora.wondershare.com/guide/mute.html
- Confidence: high

### 5.3 Reverse audio

Reverse is a clip-level **Reverse Speed** checkbox (video+audio of that clip). No separate "reverse audio only" control documented in the reverse guide.

- URL: https://filmora.wondershare.com/guide/filmora-play-video-in-reverse.html

### 5.4 Adjacent: AI Audio Stretch (separate feature)

Filmora ships **AI Audio Stretch** as its own AI audio tool (not nested under Speed). Relevant if AiFimora wants duration-matched audio without pitch change.

- URL: https://filmora.wondershare.com/guide/ai-audio-stretch-for-windows.html (linked from guide nav; not fully scraped this pass)
- Confidence: medium (existence high, exact UI unscraped)

### 5.5 Gap in docs

No official control found named "Mute audio on speed change" or "Maintain pitch on speed." Those would be **AiFimora improvements**, not Filmora copies.

---

## 6. UI location (right panel tab?)

### 6.1 Property Panel is the home for Speed

> "The Property Panel shows you all relevant information on your project to display your clip's video, audio, color, and **speed** properties…"

- URL: https://filmora.wondershare.com/guide/panel-layout.html
- Confidence: high

Super Slow Motion guide confirms the **Speed tab** inside that right panel, with subsection **Uniform Speed**:

> "navigate to the right settings panel. Then, select the **Speed** tab and choose **Uniform Speed**."

- URL: https://filmora.wondershare.com/guide/super-slow-motion-with-optical-flow.html

### 6.2 Secondary entry points (all documented)

| Surface | Action |
|---|---|
| Right Property Panel | **Speed** tab → Uniform Speed / Reverse Speed / AI Frame Interpolation |
| Timeline toolbar | **Speed** icon → Slow / Fast / Normal / Reverse |
| Clip right-click | **Speed** → Add Speed Point / Add Freeze Frame / Uniform Speed; **Speed and Duration** (Custom Speed dialog) |
| Top menu | **Tool** → **Speed** → Uniform Speed |

Sources: reverse guide, magnetic timeline guide, segmented speed guide, super slow-motion guide, speed-ramping how-to (URLs above).

### 6.3 Layout note

Property Panel is one of four core panels (Media, Player, Timeline, Property). Layout modes include **Edit** (property panel extended).

- URL: https://filmora.wondershare.com/guide/panel-layout.html

---

## 7. Product spec for AiFimora — copy this

### 7.1 Data model

```ts
type ClipSpeed =
  | { mode: 'uniform'; rate: number; reverse: boolean; pitchLock: boolean }
  | { mode: 'segments'; points: SpeedPoint[]; reverse: boolean };

type SpeedPoint = {
  t: number;          // source time (s) of speed break
  rate: number;       // playback rate for [t, next)
  freezeHold?: number; // if set, insert still of length freezeHold at t
};
```

- Timeline duration of a uniform clip: `sourceDur / rate` (reverse does not change length).
- Segment duration: sum over segments of `(Δsource / rate) + freezeHold`.

### 7.2 Exact controls (UI)

**Right Property Panel → Speed tab** (primary, Filmora-style):

1. **Mode**
   - Uniform Speed (default)
   - Segmented / Ramp
2. **Uniform mode**
   - Preset chips: `0.25×  0.5×  0.75×  1×  1.5×  2×  4×  8×  16×`
   - Numeric rate input + slider (range e.g. 0.01–100)
   - Linked **Duration** field (edit either; they stay inverse)
   - Checkbox **Reverse speed**
   - Checkbox **Mute audio** (AiFimora extra — Filmora lacks this on Speed)
   - Checkbox **Maintain pitch** (pitchLock; Filmora lacks this on Speed)
   - Slow-mo quality: **Frame blend / Optical flow** (match Filmora AI Frame Interpolation)
3. **Segmented mode**
   - Button **Add speed point** (at playhead)
   - Per-segment rate (same presets + custom)
   - Button **Add freeze frame** at playhead (default **5.0s**)
   - Select segment → edit rate / freeze duration
   - Button **Clear speed** → restore single 1× segment
4. **Secondary entry points**
   - Toolbar Speed menu (presets + reverse + freeze + add point)
   - Clip context menu: Speed → same actions; **Speed & Duration…** opens Custom dialog (rate ↔ duration)
5. **Timeline chrome**
   - Speed badge on clip (`2×`, `0.5×`, `R` for reverse)
   - Segmented clips show speed-point ticks; freeze segments show a still hatch/hold region

### 7.3 Ripple behavior (copy Filmora)

- Project/timeline setting **Snap & Ripple** (Magnetic Timeline analog), **default ON**.
- When a clip's timeline duration changes (uniform speed, segment rate, freeze insert/delete, trim):
  - **Ripple ON:** every following clip on the **same track** (and its linked audio/other tracks if grouped) shifts by Δduration. No gap, no overlap.
  - **Ripple OFF:** leave a gap (user closes with Ripple Delete / X).
- Optional Auto-Ripple pass: if any gaps remain after an edit and Auto Ripple is ON, close them automatically (Filmora Auto Ripple analog).
- Freeze insert = duration **increase** of that clip (or of the parent clip if freeze is a sub-segment) → ripple applies.
- **Clear speed** returns to source length → reverse ripple.

### 7.4 Audio rules (better than Filmora where it matters)

| Action | Audio behavior |
|---|---|
| Uniform speed, pitchLock OFF | Time-scale audio with video (chipmunk/growl), like classic Filmora |
| Uniform speed, pitchLock ON | Time-scale duration, keep pitch (AiFimora default ON for speech) |
| Mute audio ON | Silent clip; video speed unaffected |
| Reverse | Reverse audio with video |
| Freeze segment | Hold audio: either silence (default) or last audio sample hold — pick **silence** for simplicity |
| Segmented | Audio follows each segment's rate; freeze segments silent unless hold chosen |

### 7.5 Do / don't

**Do copy**
- Speed as a **right-panel tab** sibling of Video/Audio/Color
- Uniform vs segmented as two explicit modes
- Speed points + piecewise rates (not a Bezier curve editor in v1)
- Freeze = split + still + default 5s
- Clear Clip Speed reset
- Reverse checkbox
- Magnetic-style ripple default ON

**Don't claim as Filmora**
- Exact default preset multiplier list (not published on current /guide/)
- Continuous speed-curve handles
- Auto pitch correction / mute-on-speed (Filmora does not document these)

---

## 8. Source index

| # | Claim area | URL |
|---|---|---|
| 1 | Segmented speed, freeze 5s, Clear Clip Speed | https://filmora.wondershare.com/guide/change-video-speed.html |
| 2 | Mac segmented speed | https://filmora.wondershare.com/guide-mac/change-speed.html |
| 3 | Freeze frame split + Duration | https://filmora.wondershare.com/guide/freeze-frame.html |
| 4 | Reverse Speed checkbox + toolbar | https://filmora.wondershare.com/guide/filmora-play-video-in-reverse.html |
| 5 | Auto Ripple / Ripple Delete | https://filmora.wondershare.com/guide/auto-ripple.html |
| 6 | Magnetic Timeline + Speed icon Slow/Fast/Normal | https://filmora.wondershare.com/guide/magnetic-timeline.html |
| 7 | Speed tab → Uniform Speed → Optical Flow | https://filmora.wondershare.com/guide/super-slow-motion-with-optical-flow.html |
| 8 | Property Panel includes speed | https://filmora.wondershare.com/guide/panel-layout.html |
| 9 | Pitch slider under Audio → Adjustment | https://filmora.wondershare.com/guide/pitch.html |
| 10 | Mute via speaker / right-click | https://filmora.wondershare.com/guide/mute.html |
| 11 | Custom Speed dialog; v15.5.10+ segmented | https://filmora.wondershare.com/video-editing-tips/speed-ramping.html |

---

## 9. Residual gaps

1. **Exact current Slow/Fast multiplier list** not on any scraped `/guide/` page — treat as unverified.
2. **Whether speed-change without Magnetic Timeline leaves a gap** is inferred from magnetic's trim/move/delete language, not stated for speed.
3. **Audio auto-behavior on speed** (pitch shift vs stretch) is not documented on the Speed pages; only that Pitch is a separate control.
4. Filmora 12/11 PDF user guides were not parsed; older "Custom Speed" UI details may still appear in those PDFs if needed later.
