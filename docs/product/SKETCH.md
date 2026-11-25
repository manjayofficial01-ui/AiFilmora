# SKETCH — AiFilmora

**Stage 3 (sketch) of the master-application path.** Low-fidelity structure before code. These are wireframes, not a visual design — the visual language lives in `design/` (see APP-036) and is validated against rendered output.

Items here map to roadmap IDs. Nothing in this file is implemented yet.

---

## 1. Timeline v2 — the credibility surface (APP-007, APP-008, APP-011, APP-012, APP-013, APP-014, APP-015)

### 1.1 The problem being solved

Today a clip is a flat coloured rectangle. The user cannot tell what is on it, what state it is in, whether a transition joins it, where the markers are, or what an agent is doing to it. The timeline is the densest surface in the app and it currently carries almost no information.

### 1.2 Target structure

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ⌖  ✂  │ Split  Delete      │                     Strip ▾  Snap ▾  Sticky  Skim  │ ← tool row
├──────────────────────────────────────────────────────────────────────────────────┤
│ 0:00   0:05        0:10        0:15        0:20        0:25        0:30         │ ← ladder ruler
│         ▏              ▏              ▏              ▏              ▏            │
│ ┌─────┬──────────────────────────────────────────────────────────┐              │
│ │ V2  │  ▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨  │              │
│ │ 👁 🔒│  ferry.jpg ──────────────────────────────  ● Warm film 120% │              │
│ ├─────┼──────────────────────────────────────────────────────────┤              │
│ │ V1  │ ▨▨▨▨▨▨▨╲▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨▨  │              │
│ │ 👁 🔒│  beach.mov ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │              │
│ │     │            ╲___ dissolve 0.4s ___╲                                  │              │
│ ├─────┼──────────────────────────────────────────────────────────┤              │
│ │ A1  │ M S 🔒 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │              │
│ │     │   voice.wav  ▁▂▅▇▅▂▁▁▁▁▂▅▇█▆▃▁▁▂▅▇▇▅▂▁▁▁▂▅▇▆▃▁▁▁▁▂▅▇▇▅▂▁▁▁▁▂▅▇  │              │
│ │     │ −16.0 dB ▁▂▅▇▅▂▁▁▁▁▂▅▇█▆▃▁▁▂▅▇▇▅▂▁▁▁▂▅▇▇▅▂▁▁▁▁▂▅▇▇▅▂▁▁▁▁▂▅▇  │              │
│ ├─────┼──────────────────────────────────────────────────────────┤              │
│ │ A2  │ M S 🔒 ▁▁▂▃▅▇▆▃▁▁▁▂▃▅▇▆▃▁▁▂▃▅▇▆▃▁▁▂▃▅▇▆▃▁▁▂▃▅▇▆▃▁▁▂▃▅▇▆▃▁▁  │              │
│ │     │  music.mp3         ░ meter ░   peak ▁▄▆▇▆▄▁                  │              │
│ └─────┴──────────────────────────────────────────────────────────┘              │
│ ▲ playhead                                                                   ⌄ │
│ ⚑ "cake thrown"  ⚑ "intro"              ◉ Claude  ◉ Codex                     │ ← markers + agents
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Reading the wireframe**

| Element | Meaning | Roadmap |
|---|---|---|
| `▨` inside a video clip | Real filmstrip frame, sampled on a power-of-two time grid | APP-007 |
| `▓` inside an audio clip | Real RMS waveform, filled from the lane bottom; silence is a thin line | APP-008 |
| `╲___` between two clips | Transition wedge, coloured by family, with duration on hover | APP-012 |
| `● Warm film` `120%` | Clip state badges: grade dot + look name, speed, freeze, reversed, gain dB | APP-011 |
| `M S 🔒 👁` | Track header controls, plus a draggable gain pill and a level meter | APP-015 |
| `−16.0 dB` | Per-track gain readout | APP-015 |
| `░ meter ░` / `peak ▁▄▆▇▆▄▁` | Level meter with peak-hold (yellow > −12 dB, red > −3 dB) | APP-015 |
| `⚑ "cake thrown"` | Marker flags on the ruler, coloured by tint, draggable, click for a rename popover | APP-001 |
| `◉ Claude` | Agent presence cursor with a name tag, bobbing while active, fading after 12 s idle | APP-024 |
| `Strip ▾` | Toggle between thumbnails and flat type colour | APP-007 |
| `Sticky` | Sticky retime (touching clips ride along) | APP-003 |
| `Skim` | Skim/scrub mode with coarse seeking | APP-014 |

**Interaction rules (from the Editroom teardown, re-specified for the web stack)**

1. Trim edge zone = `min(7px, max(2px, clipWidth/4))`; a white 3.5 px bar marks the active edge.
2. Hovering an edge of a selected clip shows that edge on **all** selected clips.
3. Snap thresholds are in **pixels** (8 px; 6 px for scrub, cut and marker targets) so behaviour is identical at every zoom.
4. Holding a modifier suspends snapping; a subtle flash confirms the snap landed.
5. Fade handles exist **only when a fade is set**; the longer fade draws last so it takes the click.
6. Audio gain is a draggable horizontal line inside the clip, not a separate widget.
7. The playhead lives in its own layer, so moving it never redraws the clips.
8. One drag = one undo step, coalesced within 800 ms; cancelling discards it.

---

## 2. Inspector v2 — collapsible sections with a modified-dot (APP-017, APP-018, APP-020)

```
┌─────────────────────────────────────┐
│ ▣  beach.mov                    ⋯  │  44pt header, adaptive title
├─────────────────────────────────────┤
│ ▾  ▸ VOLUME                    ⊙   │  ← collapsed + modified ⇒ accent dot
│ ▾  ▸ SPEED                  ● 120% │  ← collapsed + modified ⇒ accent dot
│ ▾  ▸ TRANSFORM                   │  ← collapsed, unmodified ⇒ no dot
│ ▾  ▸ TRANSITIONS                  │
│ ▾  ▸ FADE                         │
│ ▾  ▸ GRADE                         │
│ ▾  ▸ TEXT                          │
│                                     │
│   (expanded section)                │
│   ┌─────────────────────────────┐   │
│   │ VOLUME                   Reset│ │  ← Reset only when expanded + changed
│   │ ───────────────────────────  │   │
│   │  ◐  Volume      ─────●────  0.0│ │  icon · label · slider · typed value
│   │  →  Fade In     ─●────────  0.4s│ │  curve dropdown when applicable
│   │  →  Fade Out    ────────●  1.2s│ │
│   │  ◔  Pan          ──────●── 0.0 │ │
│   │  ⏱  Speed        ────●──── 100%│ │  logarithmic mapping 10–5000 %
│   │     [ramp graph  ▁▂▄▆▇▆▄▂▁  ] │ │
│   └─────────────────────────────┘   │
├─────────────────────────────────────┤
│ GRADE                               │
│  ◉ Shadows   ◉ Midtones   ◉ Highlights│  three colour wheels
│  ☼ Exposure  ──────●─────  +0.00    │
│  ◐ Contrast  ───────●────    0      │
│  ◑ Saturate  ──────●─────    0      │
│  ☀ Temp       ───────●──     0      │
│  ⚗ Tint       ─────●───     0      │
│  [Copy grade] [Paste grade]         │
└─────────────────────────────────────┘
```

**Rules**

1. Section labels: uppercase, 10 px, semibold, `letter-spacing 1.6px` — one label style across the inspector, the library and settings.
2. Collapse state persists per section title across sessions.
3. **A collapsed section that has been modified shows an accent dot.** This is the single most important rule here: the inspector must never hide a change.
4. `Reset` appears only when the section is expanded **and** differs from default.
5. Transform / Transitions / Fade / Grade are collapsed by default.
6. The header title adapts: `Sequence` (nothing selected) · clip name · `N clips` · `Caption`.
7. Every parameter row is `icon · label · slider · typed value`; sliders that need it are logarithmic (speed 10–5000 %, scale 5–1000 %).
8. Values are recomputed from an `origin` snapshot on every change, so rounding never accumulates.

---

## 3. AI Mate v2 — @mentions, plan preview, presence (APP-022, APP-023, APP-024)

```
┌──────────────────────────────────────────────────────┐
│ ✦  Magic                                              │
│ ┌──────────────────────────────────────────────────┐ │
│ │  Claude   ChatGPT   Local      ▸ (switch)        │ │  provider switch
│ ├──────────────────────────────────────────────────┤ │
│ │ Make an intro montage from the best moments.     │ │
│ │ Cut to the beat. Slow-mo on @beach-party when    │ │
│ │ the cake is thrown.                              │ │  ← @mentions rendered bold
│ └──────────────────────────────────────────────────┘ │
│   ┌────────────────────────────────────────────┐     │
│   │ @playhead            0:04:12:08            │     │  suggestion list,
│   │ @selected            Select clips first  ⚠ │     │  ordered by likely use
│   │ @in-out              0:00:02 – 0:00:19      │     │  @selected shown but
│   │ @marker:cake thrown  0:00:14:02              │     │  disabled when empty
│   │ @media:beach-party   video · 0:42           │     │
│   └────────────────────────────────────────────┘     │
│ │  ▸ Suggestions   ▸ History                        │ │
│ └──────────────────────────────────────────────────┘ │
│                                                        │
│   ⟨ RUNNING ─────────────────────────────────────── ⟩ │
│   ● Looking      scanning the Media panel            │
│   ● Analyzing    clips, media, viewer                │
│   ● Thinking     ░░░ ghost clips ░░░                 │  ghost clips preview
│   ● Editing      adding 4 clips                      │  the plan, before commit
│                                                        │
│   ┌────────────────────────────────────────────┐     │
│   │  PLAN PREVIEW                              │     │
│   │  + beach-party.mov      → 0:00 – 0:06       │     │
│   │  + cake.mp4             → 0:06 – 0:09       │     │
│   │  ~ speed 40% on cake.mp4                    │     │
│   │  [ Discard ]              [ Apply as 1 step ]│     │
│   └────────────────────────────────────────────┘     │
│                                                        │
│   ┌────────────────────────────────────────────┐     │
│   │ ✦ Opus 5.5 · Low · 54s                      │     │
│   │ "Cut the montage to the beat and slowed the  │     │
│   │  cake moment."                    [Undo][✓] │     │
│   └────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────┘
```

**Rules**

1. The provider switch mirrors the timeline's select/cut tool switch: one visible mode at a time.
2. Mentions are **bold in the text** so the user can see what the model will read.
3. The suggestion list shows `@selected` even when nothing is selected, **disabled with "Select clips first"** — it teaches the affordance before it works.
4. One search narrows **both** markers and files.
5. Mentions resolve to concrete times and clip sets before the model sees them; the user sees the resolved form.
6. Stages are **Looking → Analyzing → Thinking → Editing**; the latest tool call is shown, then the stage name returns after 1.5 s.
7. **Nothing mutates the live timeline until Apply.** The preview shows ghost clips; Apply commits the whole run as **one** undo step.
8. While an agent works, the editor is inert — no hover, no scrub, no resize — so no half-applied state is visible.
9. The result note carries the agent, model, effort and elapsed time, and an **Undo** appears only if something actually changed.

---

## 4. MCP architecture (APP-021)

```
┌──────────────┐        JSON-RPC over HTTP        ┌─────────────────────────┐
│ Claude Code  │──── POST /mcp ────────────────────▶│                          │
│ Codex        │──── POST /mcp ────────────────────▶│  AiFilmora MCP server    │
│ Any MCP      │──── POST /mcp ────────────────────▶│  127.0.0.1:47921/mcp     │
│ client       │◀─── tools/call result ───────────│                          │
└──────────────┘                                    │  Host/Origin must be     │
                                                     │  localhost, else 403      │
        ┌────────────────────────────────────────────┤                          │
        │                                            │  initialize / ping /     │
        │  tools/call ──▶ tool router                │  tools/list answer even  │
        │        │                                   │  when the app is closed  │
        │        ├─ read tools  ─▶ store getters    │                          │
        │        └─ write tools ─▶ DRAFT COPY       │                          │
        │                            │              └─────────────────────────┘
        │                            ▼
        │                   ┌──────────────────┐
        │                   │  draft project   │  hidden copy; per-call steps
        │                   │  steps[] undo[]  │  undo/redo rebuilds from base
        │                   └────────┬─────────┘
        │                            │  Apply (one undo step)
        ▼                            ▼
   ┌────────────────────────────────────────────┐
   │  live project  ◉ agent cursor on the timeline
   └────────────────────────────────────────────┘
```

**Rules**

1. Loopback only. `Host` ∈ {`127.0.0.1`, `localhost`, `[::1]`} and `Origin` ∈ localhost; path must start `/mcp`; otherwise **403**.
2. Protocol versions `2025-06-18`, `2025-03-26`, `2024-11-05`; echo the client's version when known.
3. `Mcp-Session-Id` header; `initialize` mints a UUID.
4. `initialize`, `ping` and `tools/list` answer **without the Electron app running**, so opening a chat never launches the editor.
5. Read-only tools declare `annotations.readOnlyHint = true`.
6. **Every write goes to a draft copy.** The live project is touched only on Apply, and then as one undo step.
7. The port is configurable; if it is taken, fall back to an ephemeral port and advertise it.

---

## 5. Library semantic search (APP-010)

```
┌────────────────────────────────────────┐
│ MEDIA                    ⤓  ▦  ▤  ⊞   │
│ ┌────────────────────────────────────┐ │
│ │ 🔍 "the cake is thrown"             │ │  quoted ⇒ search what is SAID
│ └────────────────────────────────────┘ │  plain  ⇒ search what is SHOWN
│                                        │
│  ▨ beach-party  0:42   ▸ 0:14 match    │  tag match + matching times
│  ▨ birthday-1    0:31   ▸ 0:22 match   │
│                                        │
│  beach                             ×   │  plain query ⇒ tag/name
│  ▨ beach.mov      0:56                │
│  ▨ hotel-pool     0:07                │
└────────────────────────────────────────┘
```

**Rules**

1. Quoted text → transcript/ASR match. Plain text → name, scene tag, or note match.
2. Every result shows **which times** matched, so a hit is navigable, not just a list.
3. Offline and incompatible assets are visibly badged.
4. Tiles used by the current selection carry a ring.

---

## 6. Information architecture (unchanged, confirmed)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ title bar: project name · undo/redo · split/trim/delete · credits · export  │
├──────────┬──────────────────────────────────────────────┬────────────────────┤
│          │                                              │                    │
│ LIBRARY  │              PROGRAM MONITOR                 │     INSPECTOR      │
│ 260px    │              + transport + timecode          │     320px          │
│          │                                              │                    │
│ 10 tabs  │                                              │  adaptive sections │
│          ├──────────────────────────────────────────────┤                    │
│          │  TOOL ROW · RULER · TRACKS                   │                    │
│          │                                              │                    │
└──────────┴──────────────────────────────────────────────┴────────────────────┘
```

Two things to note, both from the teardown:

1. **The library's 10 tabs and the inspector's 11 tabs are the real navigation problem**, not the layout. Editroom solves it with *one* library surface that filters rather than tabs, and an inspector that *sections* rather than tabs. The sketch above keeps the layout but proposes: library → a single surface with a segmented filter (Media / Audio / Text / Transitions / Effects / Templates) rather than 10 peer tabs; inspector → sections (sketch §2) rather than 11 peer tabs.
2. The **program monitor should dominate**. Editroom gives the preview the flexible middle column and everything else a fixed or clamped width. AiFilmora's current middle column already flexes, but the inspector's 320 px competes with a library that renders 10 tab strips. Reducing tab count buys back preview width, which is the app's most valuable pixels.

---

## 7. Data model changes implied

```js
// Asset analysis cache — one per media id, invalidated by path|size|mtime
AssetAnalysis {
  mediaId, key: "path|size|mtime", version: 2,
  thumbs:  [{ t, dataUrl }],       // filmstrip frames, power-of-two time grid
  peaks:   Float32Array,           // min/max per bucket, for waveforms
  words:   [{ s, e, text }],       // ASR words with times
  tags:    [{ name, confidence, times: [t] }],
  moments: [{ t, score }],         // best-moment candidates
}

// Project additions
Project {
  …existing…,
  markers: [{ id, t, name, color }],  // APP-001: ONE shape, read and written the same way
  inPoint: null, outPoint: null,     // APP-027
}

// Clip state the timeline must render
Clip { …existing…, speedRamp: { from, to, curve, points }, grade, transform, transitionIn }
// → rendered as: filmstrip | waveform | badges | wedge
```

**The one-shape rule:** the marker bug (`{t,name}` written vs `m.start/m.end` read) is a symptom of a missing convention. Every timeline-visible field gets exactly one shape, defined once and imported by both the writer and the renderer.
