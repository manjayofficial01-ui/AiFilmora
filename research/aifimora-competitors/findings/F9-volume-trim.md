# F9 — Wondershare Filmora: Volume & Trim (2024–2026)

**Research date:** 2026-10-14  
**Primary source:** Official Filmora Windows User Guide (`filmora.wondershare.com/guide/`), current as of Filmora 14/15 era.  
**Scope:** Audio volume panel, slider/units, fade, normalize, duck, mute (track vs clip), keyframe volume, trim/split at playhead, preview master volume.

---

## 1. Volume panel / tab location

**Claim:** Clip audio properties live in the **right-side Property Panel**, under an **Audio** section. Opening a clip (double-click or select) shows Audio properties that include volume, pitch, balance, fade, equalizer.

- "Double-click the audio clip in the timeline to access the editing panel on the right, where you can modify sound properties. Adjust settings like volume, pitch, balance, and apply fade-in or fade-out effects."  
  — https://filmora.wondershare.com/guide/add-and-modify-audio.html

- "In the main editing interface, head to the properties panel on the right and enable the **Audio** section. Now, locate the **Adjustment** option to enable it. Here, you can change the **Volume**, **Sound Balance**, **Pitch**, and other attributes by dragging the respective sliders."  
  — https://filmora.wondershare.com/guide/editing-audio.html

**Claim:** The Property Panel is a first-class workspace zone (not a modal). It shows the selected clip's **video, audio, color, and speed** properties for the timeline clip or preview window.

- "The Property Panel shows you all relevant information on your project to display your clip's video, audio, color, and speed properties in the Timeline Panel or Preview Window."  
  — https://filmora.wondershare.com/guide/panel-layout.html

**Claim:** Documented Audio Adjustment elements include Volume, Audio Channels, Sound Balance, Fade In/Out, Pitch, Equalizer.

- https://filmora.wondershare.com/guide/editing-audio.html

**UI takeaway:** There is no separate top-level "Volume app." Volume is a subsection of the **Audio tab inside the Property Panel**.

---

## 2. Volume slider range, fade, normalize, duck

### 2.1 Volume control

**Claim:** Clip volume is a **slider** in the Property Panel Audio → Adjustment group. Official text says "dragging the respective sliders" but **does not publish a numeric min/max (0–100 vs dB)** on the guide page.

- https://filmora.wondershare.com/guide/editing-audio.html

**Claim:** Separate **Audio Gain** is measured in **dB** (positive or negative) and can also **Normalize Maximum Peak**. It is opened from right-click menu or **Tools → Audio → Audio Gain**, not from the Volume slider. Supports **batch** apply via Ctrl multi-select.

- "Enter a desired value in dB (positive or negative) to increase or decrease volume"  
- "Select **Normalize Maximum Peak** to automatically adjust audio so the loudest point reaches a safe level."  
- "Hold **Ctrl** select multiple audio clips… Open **Audio Gain** to apply adjustments across all selected clips"  
  — https://filmora.wondershare.com/guide/audio-gain.html

**Inference (not stated in guide):** Product pattern is **relative clip volume slider (UI 0–100 default 100)** + **absolute gain dialog in dB**. Official docs confirm dB only for Audio Gain and LUFS for Normalization.

### 2.2 Fade in / fade out

**Claim:** Fade is set in the **Audio edit panel** by dragging sliders **or typing duration in seconds**.

- "Set fade-in and fade-out effects by dragging the sliders or by entering how many seconds a fade effect should last."  
  — https://filmora.wondershare.com/guide/fade-in-out.html

**Claim:** Quick timeline handles exist: **fade markers at the left and right edges of the audio waveform**. Drag farther = longer fade.

- "At the beginning of the audio clip, drag the fade-in maker to the right… Go to the end of the audio clip and drag the fade-out maker to the left…"  
- "The further you drag, the longer the fade effect will last."  
  — https://filmora.wondershare.com/guide/fade-in-out.html

### 2.3 Auto Normalization

**Claim:** Located under **right-side properties panel → Audio → Basic → Auto Normalization**. Toggle on; platform **presets** for loudness; **Custom** uses a **LUFS slider or typed value**, documented range **−23 LUFS to −10 LUFS**, then **Apply**.

- "Find and activate the **Auto Normalization** option within the basic audio settings. Select the preset loudness levels optimized for different platforms."  
- "use the LUFS slider or enter a specific value manually. Adjust within a flexible range, typically from **-23 LUFS** to **-10 LUFS** and click the **Apply** button."  
  — https://filmora.wondershare.com/guide/audio-auto-normalization.html

**Claim:** Purpose is consistent loudness to professional LUFS/LKFS standards for YouTube / streaming / podcasts / broadcast.

- https://filmora.wondershare.com/guide/audio-auto-normalization.html

### 2.4 Audio Ducking

**Claim:** Ducking lives in the same **right properties panel → Audio** area as a **toggle**, plus a **ducking-level slider** and fade position/duration. It auto-lowers background when the primary voice is present.

- "head to the properties panel on the right and enable the **Audio** section. Locate the **Audio Ducking** feature and turn its toggle on. Set the default ducking level using the slider… You can also adjust fade position and fade duration"  
  — https://filmora.wondershare.com/guide/ducking.html

---

## 3. Mute track vs clip; keyframe volume

### 3.1 Mute (clip + track)

**Claim:** **Clip mute:** click the **speaker icon on the timeline** or **right-click the clip → Mute**. Muted volume bar appears dimmed.

**Claim:** **Track mute:** a **Mute icon on the left side of the timeline next to the track**; toggle to mute/unmute the whole track.

**Claim:** **Section mute:** **split** with scissors, select the small section, then Mute via right-click.

- "click the speaker icon on the timeline, or right-click the clip and choose **Mute**. The volume bar will appear dimmed once muted."  
- "Use the scissors tool to split the clip… apply the Mute feature by right-clicking"  
- "select the muted clip and disable the small **Mute** icon located on the left side of the timeline next to the track."  
  — https://filmora.wondershare.com/guide/mute.html

### 3.2 Keyframe volume

**Claim (documented):** Filmora supports **keyframes** from the Property Panel (Keyframe icon) and on the timeline (add/delete keyframe markers). Official keyframing guide lists **Transform / position / scale / rotation / flip / opacity** as animatable parameters.

- "Enable **Transform** or choose another adjustable setting, such as position, scale, rotation, or opacity"  
- "Click the **Keyframe** icon in the property panel to place a keyframe"  
- "Right-click the keyframe marker directly on the timeline and choose **Delete Keyframe** or **Delete All Keyframes**"  
  — https://filmora.wondershare.com/guide/add-animation-keyframing.html

**Gap:** The official keyframe guide **does not explicitly list Volume** as a keyframable property. Documented time-varying volume is **Fade In/Out** (panel sliders + timeline edge handles). Treat dedicated **volume keyframes on the clip waveform** as not confirmed by primary docs (may exist in product; not in guide text).

Related advanced keyframe docs (graph editor / path) also focus on video transform:  
- https://filmora.wondershare.com/guide/keyframe-graph-editor.html

### 3.3 Audio Mixer (track-level)

**Claim:** **Audio Mixer** icon on the toolbar above the timeline opens a multi-track mixer with per-track **volume sliders**, **Balance**, **Stereo or Surround**, live **Play** preview, **Apply**.

- "Look at the toolbar located located above the timeline and click the **Audio Mixer** icon."  
- "drag the volume sliders up or down to raise or lower the gain of individual tracks"  
- "choose either **Stereo** or **Surround** mode"  
  — https://filmora.wondershare.com/guide/audio-mixer.html

---

## 4. Trim tools: trim start/end at playhead + split workflow

### 4.1 Audio trim/split/cut

**Claim (audio-specific guide):**

| Action | How |
|--------|-----|
| **Split** | Scissors icon on the playhead; or right-click → **Split** |
| **Trim (drag)** | Drag corners of the audio track **inward** |
| **Trim to playhead** | Place playhead; right-click → **Trim Start To Playhead** or **Trim End to Playhead** |
| **Cut** | Scissors to detach, then **Cut** or **Delete** |

- "Click on the scissors icon located on the playhead to instantly divide the audio"  
- "drag the corners of the audio track in the timeline in an inward direction"  
- "choose **Trim Start To Playhead** or **Trim End to Playhead**"  
- "Choose the **Cut** or **Delete** option to successfully remove the selected part"  
  — https://filmora.wondershare.com/guide/trim-audio.html

### 4.2 Video trim/split (same timeline grammar)

**Claim:** Split methods: **Split button on the playhead**, **scissors icon above timeline**, **right-click → Split**, **Quick Split Mode**. Unselected track = split all clips under playhead; selected track = split that track only. Split button can be enabled via **File → Preferences → Editing**.

**Claim:** Trim methods: **Mark In / Mark Out in Preview** before timeline; **drag clip edges** on timeline; **right-click → Trim Start to Playhead / Trim End to Playhead**.

**Claim:** Trimming/splitting **does not affect original source media**.

- "If you don’t select a specific track… you will split all of the clips under your playhead."  
- "Filmora also has an option for you to quick trim from the start or end of a clip. Move the Playhead… right click… **Trim Start to Playhead** or **Trim End to Playhead**"  
- "Trimming or splitting the media clip will not affect the original source media."  
  — https://filmora.wondershare.com/guide/trim-split-cut.html

**Note:** There is **no dedicated "trim button" toolbar cluster** for start/end-at-playhead in the guide; those are **context-menu commands**. Toolbar affordances are split/scissors + Quick Split Mode.

---

## 5. Master volume on preview player

**Claim (panel layout guide):** Player Panel (Preview Window) documents **playback quality/display**, **snapshot**, **Mark In / Mark Out**. **Master preview volume is not documented** on the Panel Layout page.

- "The Player Panel (Preview Window) shows you how the video plays… adjust playback quality and display settings… Capture a snapshot… Mark in and Mark out"  
  — https://filmora.wondershare.com/guide/panel-layout.html

**Claim (level monitoring):** Filmora has a separate **Audio Meter** guide and **Audio Mixer** for project mix, but neither guide describes a dedicated "master volume" slider on the preview chrome.

- Audio meter: https://filmora.wondershare.com/guide/access-audio-meter.html  
- Audio mixer: https://filmora.wondershare.com/guide/audio-mixer.html

**Finding:** From **primary Filmora guide pages**, **preview master volume is unconfirmed**. Product UI commonly shows a speaker control near the preview, but do **not** cite that as an official guide claim. For AiFimora, treat preview master volume as a **product decision** (recommended) rather than a confirmed Filmora guide feature.

---

## Source index (all primary)

| Topic | URL |
|-------|-----|
| Guide hub / Audio section | https://filmora.wondershare.com/guide/ |
| Panel layout (Property / Player / Timeline) | https://filmora.wondershare.com/guide/panel-layout.html |
| Add & modify audio | https://filmora.wondershare.com/guide/add-and-modify-audio.html |
| Adjust audio (volume/balance/pitch/EQ) | https://filmora.wondershare.com/guide/editing-audio.html |
| Fade in/out | https://filmora.wondershare.com/guide/fade-in-out.html |
| Mute | https://filmora.wondershare.com/guide/mute.html |
| Trim/Split/Cut audio | https://filmora.wondershare.com/guide/trim-audio.html |
| Split & trim video | https://filmora.wondershare.com/guide/trim-split-cut.html |
| Auto normalization | https://filmora.wondershare.com/guide/audio-auto-normalization.html |
| Audio ducking | https://filmora.wondershare.com/guide/ducking.html |
| Audio gain | https://filmora.wondershare.com/guide/audio-gain.html |
| Audio mixer | https://filmora.wondershare.com/guide/audio-mixer.html |
| Audio meter | https://filmora.wondershare.com/guide/access-audio-meter.html |
| Keyframing | https://filmora.wondershare.com/guide/add-animation-keyframing.html |

**Coverage notes**
- Exact **Volume slider numeric range (0–100 vs dB)** is **not stated** in official guide text; only Audio Gain (dB) and Normalization (LUFS −23…−10) publish units.
- **Volume keyframes** are **not documented** in the official keyframe page.
- **Preview master volume** is **not documented** in the official panel-layout page.
- Guide pages are Filmora 12/13/14/15-era Windows docs; feature set still listed under current "Audio Editing for Windows".

---

## Product spec — AiFimora (Volume tab + Trim + Player volume)

Derived from Filmora patterns above; fill gaps Filmora leaves unspecified.

### A. Property Panel → **Audio** tab (when clip or audio track selected)

| Control | Spec |
|---------|------|
| **Volume** | Slider 0–100, default 100; keyboard ±1, Shift±10. Optional dB readout beside % (0–100% maps ~−∞…+6 dB). |
| **Mute clip** | Toggle; dims waveform; independent of track mute. |
| **Fade In / Out** | Numeric seconds + slider; **and** timeline edge handles on waveform (drag length = fade duration). Default max fade = clip duration / 2. |
| **Pitch** | Slider (optional v1). |
| **Balance** | −100…+100 (optional v1). |
| **Auto Normalize** | Toggle + platform presets + **Custom LUFS −23…−10** (Filmora parity) + Apply. |
| **Ducking** | Toggle + amount slider + fade position/duration (when a voice track is marked primary). |
| **Keyframe** | Per-parameter keyframe icon. **Must include Volume** (gap vs Filmora docs). Volume keyframes render as dots on the audio waveform line. |

**Access rules:** same as Filmora — double-click clip **or** select clip → Audio tab always visible in right Property Panel (no modal).

### B. Trim button cluster (timeline toolbar + context)

| Action | Spec |
|--------|------|
| **Split at playhead** | Toolbar scissors + playhead split button. If no track selected → split all under playhead; if track selected → split that track only. |
| **Trim Start to Playhead** | Context menu + optional toolbar button; removes head of selected clip to playhead. |
| **Trim End to Playhead** | Same for tail. |
| **Edge drag** | Hover L/R edge → trim cursor; non-destructive to source media. |
| **Quick Split mode** | Optional; click-to-split continuous mode. |
| **Delete / Cut** | After split, Cut or Delete selection. |

**Rule:** Trimming/splitting never mutates original media (Filmora parity).

### C. Track header

- **Mute** (speaker) per track — left of track, Filmora parity.  
- Optional **Solo** (AiFimora differentiator).  
- Optional compact **track volume** slider in header or via Mixer.

### D. Preview **Player** master volume

| Control | Spec |
|---------|------|
| **Master volume** | 0–100 slider near transport controls; affects **monitoring only**, not export mix. |
| **Mute preview** | Speaker mute for monitoring. |
| **Audio meter** | Peak meter beside preview or timeline; optional clip indicator at 0 dBFS. |

**Rationale:** Filmora guide does not document preview master volume; including it is a clear AiFimora win (listen quietly without changing project levels).

### E. Priority for MVP

1. Property Audio tab: Volume slider + clip mute + fade in/out (panel + waveform handles).  
2. Trim Start/End to Playhead + Split at playhead.  
3. Track mute.  
4. Preview master volume + mute.  
5. Auto Normalize (LUFS −23…−10).  
6. Volume keyframes.  
7. Ducking + Audio Mixer.
