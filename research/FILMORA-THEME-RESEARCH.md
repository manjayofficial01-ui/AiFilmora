# Filmora Theme — Deep Research Round 2

> Round 1 shipped a Filmora shell, but the "Filmora Dark" theme looked nearly identical to our
> default dark. This round goes back to the source data and finds out **why**, extracts Filmora's
> real design system, and rebuilds the theme layer so it actually transforms the UI.

---

## 1. Why round 1's "Filmora Dark" looked the same

Three concrete causes, all measurable:

### Cause A — components ignore the theme tokens
`setProperty('--accent', …)` on `:root` works, but **most components never read `--accent`**.
Audit of `css/*.css`: **147 hardcoded hex literals, 86 distinct**, of which the theme-relevant ones are:

| Hex | Uses | Where |
|---|---|---|
| `#fff` | 18 | text on accent buttons, selected states |
| `#6b98ff` / `#4a7cf0` | 5 | `.btn.primary` gradient — blue, hardcoded |
| `#151922` / `#10141b` | 2 | `.titlebar` gradient — hardcoded |
| `#2e3648` | 5 | scrollbar thumb — hardcoded |
| `#3a455c` | 2 | `.btn:hover` border — hardcoded |
| `#000` | 5 | deep backgrounds |
| `#3d6fd4` `#2f9e6b` `#c9a227` `#8b5cf6` `#0d9488` | 10 | timeline clip gradients — raw hex, not `var(--clip-*)` (even though the tokens exist!) |
| `#14e0b0` / `#0bb890` / `#04281f` | 4 | `.btn.gen` gradient — hardcoded |

So changing `--accent` moved almost nothing visible.

### Cause B — we guessed the palette instead of measuring it
Round 1's Filmora Dark was a hand-picked approximation. The **real** palette, measured by counting
every hex literal in `assets/Skin/filmora_dark.txt` (2 348 occurrences) and `filmora_light.txt`
(2 374), is:

| Role | Dark (count) | Light (count) |
|---|---|---|
| Primary text | `#f0f8fe` (394) | `#2a3438` (392) |
| Body text | `#c3cad0` (286) | `#646c72` (296) |
| **Brand accent** | **`#55e5c5` (249)** | **`#25c2a4` (249)** |
| Panel surface | `#181c1f` (264) | `#ffffff` (326) |
| Border / control | `#363e44` (149) | `#e9edf0` (124) |
| Muted text | `#959ca2` (125) | `#8e959b` (125) |
| Disabled text | `#4f575d` (96) | `#b1b8bc` (96) |
| Elevated surface | `#21282d` (85) | `#ecf0f2` (48) |
| Deep surface | `#15191c` (50) | `#f5f8fa` (158) |
| Danger | `#ff6161` (40) | `#f05555` (40) |
| Deepest input | `#0a0d0f` (45) | `#eaeef0` (24) |
| Hover surface | `#2e353a` (31) | `#f1f5f7` (31) |
| Accent tint (light) | `#99efdc` (28) `#bbf5e8` (25) | `#2faa92` (28) `#23cfae` (25) |
| **AI accent** | **`#3ddcff` (18)** | `#207fee` (21) |

Our round-1 values (`--accent: #55e5c5`, `--panel: #181c1f`) happened to be right — but we were
missing the whole **4-step text ramp**, the **AI accent**, and the **elevated/hover surfaces**.

### Cause C — we used solid color steps where Filmora uses translucent overlays
This is the big one. Filmora builds its surface hierarchy with **translucent white overlays** on a
near-black base, not with discrete solid greys:

```
rgba(217, 223, 235, 0.04)   ← resting button          (white 4%)
rgba(217, 223, 235, 0.06)   ← hover button / track     (white 6%)
rgba(234, 247, 255, 0.06)   ← card border              (white 6%)
rgba(154, 179, 202, 0.08)   ← tag chip                 (white 8%)
rgba(199, 212, 224, 0.14)   ← pressed / selected       (white 14%)
rgba(202, 232, 255, 0.14)   ← button border            (white 14%)
rgba(255, 255, 255, 0.24)   ← separator line           (white 24%)
rgba(0, 0, 0, 0.3)          ← input field              (black 30%)
```

That glassy translucency is what makes Filmora read as "premium". Our `--panel / --panel-2 / --panel-3`
solid ladder can't reproduce it.

---

## 2. Filmora's real design system (extracted from the skin JSON)

### 2.1 Component radii

| Component | Radius |
|---|---|
| Standard button / combobox / spinbox | **6 px** |
| Tab (selected) | 4 px |
| Tab bar container | 6 px |
| Tool button (pill) | 12 px |
| Card / panel (AIMusicBottomWidget) | **10 px** |
| Dialog work area | 10 px |
| Slider | 4–6 px |

Our app: 6 px (`--radius`), 4 px (`--radius-sm`), 10 px (`--radius-lg`). Already close — good.

### 2.2 Button system (`MediaLibraryView`)

```css
/* resting */
background: rgba(217, 223, 235, 0.04);
border: 1px solid rgba(202, 232, 255, 0.14);
border-radius: 6px;
color: #c3cad0;

/* pressed / checked */
border-color: #55e5c5;          /* cyan ring */
color: #f0f8fe;

/* tag chip variant */
background: rgba(154, 179, 202, 0.08);
/* tag chip :checked */
background: rgba(199, 212, 224, 0.14);
color: #55e5c5;                 /* cyan TEXT, not just a ring */
```

Note the pattern: **resting = 4 % white, hover = 6 %, selected = 14 %, and the accent appears as a
cyan ring or cyan text — never as a cyan fill.** Our `.btn.primary` is a solid blue fill; Filmora's
primary buttons are mostly translucent with a cyan accent.

### 2.3 Tab system (`Public/FTabbarV15`)

```css
QTabBar            { background: rgba(217,223,235,0.06); border-radius: 6px; }
QTabBar::tab       { color: #959ca2; margin: 4px; min-height: 24px; border: none; }
QTabBar::tab:selected
                   { background: rgba(199,212,224,0.14); color: #f0f8fe;
                     border-radius: 4px; margin-top: 4px; }
```

Our tabs are flat text with a blue underline. Filmora's are **pills on a translucent strip**.

### 2.4 Input system (`Public/QCombobox`, `QDoubleSpinbox`)

```css
QComboBox          { color: #c3cad0; border-radius: 6px; padding-left: 8px; border: none; }
QComboBox QAbstractItemView
                   { background: #181C1F;
                     border: 1px solid rgba(199,212,224,0.14); padding-top: 8px; }
QDoubleSpinBox     { background: rgba(0,0,0,0.3); border-radius: 6px;
                     padding-left: 8px; color: #c3cad0; }
```

**Inputs are borderless with a 30 %-black fill.** Ours use `border: 1px solid var(--border)`.

### 2.5 Slider system (`Widgets/FFPlayerToolSlider`)

```css
FFPlayerToolSlider BackgroundWidget { background: rgba(234,247,255,0.06); border-radius: 2px; }
FFPlayerToolSlider GrooveWidget     { background: #c3cad0; border-radius: 0 0 2px 2px; }
```

Track = 6 % white. Filled portion = **light grey `#c3cad0`, not the accent**. Ours use the accent.

### 2.6 Surface system (`Public/BackQSS`, `Timeline`)

```
#0a0d0f   deepest (inputs, BGColorType 13)
#15191c   deep surface (sliders)
#181c1f   panel surface (BGColorType 11 is #21282d — elevated)
#21282d   ELEVATED (timeline view, FTimelineEmptyWidget is #181C1F)
#202427   card surface (AIMusicBottomWidget)
#0F1214   dialog / property panel deep
#000000   timeline module widget — pure black
gradient #14191E → #0B1318  (deep panel gradient, FTimelineRenderWidget)
```

Note `#21282d` is **lighter** than `#181c1f` — the timeline is deliberately raised above the rest.

### 2.7 Compact sizing (`Timeline`)

```
FTimelineToolbar FFToolButton { min-height: 24px; max-height: 24px; }
QTabBar::tab                  { min-height: 24px; }
```

**24 px is Filmora's standard control height.** Our `.btn` is `padding: 7px 12px` ≈ 31 px.

---

## 3. What to change (round 2 scope)

### 3.1 Replace hardcoded colors with tokens
The 10 `-fix` targets above — especially:
- `.titlebar` gradient → `var(--titlebar-grad)`
- `.btn.primary` → `var(--accent)`-driven gradient
- `.btn.gen` → `var(--gen)`-driven gradient
- timeline clip gradients → `var(--clip-video)` etc. (tokens already exist!)
- `#fff` → `var(--on-accent)`
- `#000` → `var(--bg-deep)`
- scrollbar `#2e3648` → `var(--scrollbar)`
- `.btn:hover` border `#3a455c` → `var(--border-hover)`

### 3.2 Add the missing tokens
```
--ink-strong  (#f0f8fe)     ← primary / heading text
--ink-body    (#c3cad0)     ← body text
--ink-muted   (#959ca2)     ← muted / unselected tab
--ink-disabled(#4f575d)     ← disabled
--accent-ai   (#3ddcff)     ← AI accent (separate from brand accent)
--surface-1   rgba(217,223,235,0.04)   ← resting
--surface-2   rgba(217,223,235,0.06)   ← hover / track / tab strip
--surface-3   rgba(199,212,224,0.14)   ← selected
--stroke-1    rgba(202,232,255,0.14)   ← control border
--stroke-2    rgba(234,247,255,0.06)   ← card border
--stroke-3    rgba(255,255,255,0.24)   ← separator
--field       rgba(0,0,0,0.30)         ← input fill
--on-accent   (#ffffff)                ← text on accent fills
--bg-deep     (#000000)                ← deepest
--scrollbar   (#2e3648)
--elevated    (#21282d)                ← timeline surface
--card        (#202427)                ← card surface
--ctl-h       (24px)                   ← standard control height
```

### 3.3 Rewrite the three theme presets with real values
- **AiFilmora Dark** (our identity, blue) — keep, but rewire to tokens.
- **Filmora Dark** — measured palette: `#0a0d0f` base, `#181c1f` panel, `#21282d` elevated,
  `#55e5c5` accent, `#3ddcff` AI accent, `#f0f8fe/#c3cad0/#959ca2/#4f575d` text ramp.
- **Filmora Light** — measured: `#f5f8fa` base, `#ffffff` panel, `#e9edf0` border,
  `#25c2a4` accent, `#2a3438/#646c72/#8e959b/#b1b8bc` text ramp.

### 3.4 Adopt Filmora's control language
- Buttons: translucent 4 % fill + 14 % border + 6 px radius; accent appears as ring/text on active.
- Tabs: pills on a 6 % translucent strip, 24 px tall, selected = 14 % + `#f0f8fe`.
- Inputs: borderless, 30 %-black fill, 6 px radius, 8 px left padding.
- Sliders: 6 %-white track, `#c3cad0` fill.
- Standard control height 24 px for toolbars.

---

## 4. Non-goals this round
- Porting Qt `border-image:` icon atlases (they're inside the 247 MB `.rcc` bundles).
- Rewriting every panel — only the shared primitives (buttons, tabs, inputs, sliders, surfaces).
- Light-theme pixel-perfection for third-party canvases (scopes, program monitor draw their own).

---

## 5. Acceptance criteria
- Switching **Filmora Dark** visibly changes: titlebar, panels, buttons, tabs, inputs, sliders,
  timeline surface, clip colors, and the accent — not just one variable.
- `grep` for hardcoded theme-relevant hex in `css/app.css` + `css/timeline.css` drops from
  ~75 to <10 (the remainder are legitimately fixed: brand-mark gradient, VIP gold, canvas fills).
- Filmora Dark shows the **cyan** accent; Filmora Light shows **light surfaces + dark text**.
- All existing Playwright smoke tests still pass; new `verify-filmora-theme.cjs` asserts the
  computed values of at least 8 tokens per theme.
