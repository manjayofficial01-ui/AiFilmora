# BASELINE — AiFilmora verify suite

**Recorded:** 2026-11-25 · **Branch:** `modernize/2026-11-25` · **Base commit:** `ab3e97c` (AiFilmora 2.2.7)

**Result: 39/52 suites green, 13 failing.**

Regenerate with `node verify-all.cjs`. The runner starts `server.cjs` on 127.0.0.1:8765, waits for the
port to accept connections, then runs every `verify-*.cjs` suite. A suite counts as green only if it
exits 0, reports at least one `PASS`, and reports no `FAIL`.

| Suite | Result | PASS | FAIL | Exit | ms |
|---|---|---|---|---|---|
| `verify-ai-timeline.cjs` | ✅ green | 35 | 0 | 0 | 4102 |
| `verify-app.cjs` | ❌ failing | 0 | 0 | 1 | 2602 |
| `verify-assets.cjs` | ✅ green | 14 | 0 | 0 | 10724 |
| `verify-audiofx.cjs` | ✅ green | 17 | 0 | 0 | 9249 |
| `verify-audiotrans.cjs` | ✅ green | 27 | 0 | 0 | 7362 |
| `verify-beats.cjs` | ✅ green | 0 | 0 | 0 | 6382 |
| `verify-canvas.cjs` | ✅ green | 0 | 0 | 0 | 10051 |
| `verify-color.cjs` | ✅ green | 22 | 0 | 0 | 9957 |
| `verify-crop.cjs` | ✅ green | 0 | 0 | 0 | 7491 |
| `verify-density.cjs` | ✅ green | 0 | 0 | 0 | 2352 |
| `verify-detach.cjs` | ❌ failing | 3 | 7 | 1 | 8248 |
| `verify-electron.cjs` | ❌ failing | 0 | 0 | null | 180028 |
| `verify-err.cjs` | ✅ green | 0 | 0 | 0 | 1859 |
| `verify-export22.cjs` | ✅ green | 0 | 0 | 0 | 14679 |
| `verify-filmora-chrome.cjs` | ✅ green | 0 | 0 | 0 | 35294 |
| `verify-filmora-gaps.cjs` | ❌ failing | 13 | 0 | 1 | 32987 |
| `verify-filmora-shell.cjs` | ❌ failing | 0 | 0 | 1 | 34044 |
| `verify-filmora-theme.cjs` | ✅ green | 0 | 0 | 0 | 4037 |
| `verify-filmora-tools.cjs` | ✅ green | 0 | 0 | 0 | 4038 |
| `verify-filmora-working.cjs` | ✅ green | 12 | 0 | 0 | 4272 |
| `verify-filmora15.cjs` | ❌ failing | 2 | 0 | 1 | 32369 |
| `verify-final.cjs` | ✅ green | 0 | 0 | 0 | 7746 |
| `verify-fonts.cjs` | ✅ green | 19 | 0 | 0 | 9471 |
| `verify-icon-compact.cjs` | ❌ failing | 1 | 1 | 1 | 5513 |
| `verify-layout.cjs` | ✅ green | 0 | 0 | 0 | 4257 |
| `verify-lut.cjs` | ✅ green | 1 | 0 | 0 | 6684 |
| `verify-media-fix.cjs` | ✅ green | 17 | 0 | 0 | 3587 |
| `verify-name-shape.cjs` | ✅ green | 0 | 0 | 0 | 6614 |
| `verify-new.cjs` | ✅ green | 0 | 0 | 0 | 9000 |
| `verify-panzoom.cjs` | ❌ failing | 0 | 0 | 1 | 6013 |
| `verify-parity.cjs` | ❌ failing | 19 | 4 | 1 | 5069 |
| `verify-pi-toggle.cjs` | ✅ green | 1 | 0 | 0 | 3803 |
| `verify-rebuild.cjs` | ❌ failing | 0 | 0 | 1 | 5609 |
| `verify-regress.cjs` | ✅ green | 0 | 0 | 0 | 6415 |
| `verify-save-fallback.cjs` | ❌ failing | 0 | 0 | 1 | 32401 |
| `verify-save-location.cjs` | ❌ failing | 0 | 0 | 1 | 34981 |
| `verify-shader-transitions.cjs` | ✅ green | 0 | 0 | 0 | 14615 |
| `verify-shape-fix.cjs` | ✅ green | 0 | 0 | 0 | 8320 |
| `verify-shapes.cjs` | ✅ green | 0 | 0 | 0 | 5097 |
| `verify-speed.cjs` | ✅ green | 0 | 0 | 0 | 7086 |
| `verify-speed2.cjs` | ✅ green | 0 | 0 | 0 | 6354 |
| `verify-tabs.cjs` | ✅ green | 0 | 0 | 0 | 4283 |
| `verify-tracks.cjs` | ✅ green | 0 | 0 | 0 | 4551 |
| `verify-upgrade.cjs` | ✅ green | 0 | 0 | 0 | 6843 |
| `verify-upgrades.cjs` | ✅ green | 0 | 0 | 0 | 8018 |
| `verify-v22.cjs` | ✅ green | 0 | 0 | 0 | 5971 |
| `verify-vertical.cjs` | ✅ green | 0 | 0 | 0 | 5876 |
| `verify-vip.cjs` | ✅ green | 0 | 0 | 0 | 5883 |
| `verify-vol-split.cjs` | ❌ failing | 6 | 0 | 1 | 33842 |
| `verify-vol.cjs` | ✅ green | 0 | 0 | 0 | 6166 |
| `verify-vol2.cjs` | ✅ green | 0 | 0 | 0 | 1987 |
| `verify-vscroll.cjs` | ✅ green | 0 | 0 | 0 | 7093 |

## Pre-existing failures

These fail on the **base commit**, before any change in this cycle. A failure that appears here
after a code change is a regression; a failure that was already here is not.

### `verify-app.cjs`

- exit 1, 0 pass, 0 fail
- tail: `exit 1`

### `verify-detach.cjs`

- exit 1, 3 pass, 7 fail
- tail: `exit 1; 7 FAIL marker(s)`

### `verify-electron.cjs`

- exit null, 0 pass, 0 fail
- tail: `exit null`

### `verify-filmora-gaps.cjs`

- exit 1, 13 pass, 0 fail
- tail: `exit 1`

### `verify-filmora-shell.cjs`

- exit 1, 0 pass, 0 fail
- tail: `exit 1`

### `verify-filmora15.cjs`

- exit 1, 2 pass, 0 fail
- tail: `exit 1`

### `verify-icon-compact.cjs`

- exit 1, 1 pass, 1 fail
- tail: `exit 1; 1 FAIL marker(s)`

### `verify-panzoom.cjs`

- exit 1, 0 pass, 0 fail
- tail: `exit 1`

### `verify-parity.cjs`

- exit 1, 19 pass, 4 fail
- tail: `exit 1; 4 FAIL marker(s)`

### `verify-rebuild.cjs`

- exit 1, 0 pass, 0 fail
- tail: `exit 1`

### `verify-save-fallback.cjs`

- exit 1, 0 pass, 0 fail
- tail: `exit 1`

### `verify-save-location.cjs`

- exit 1, 0 pass, 0 fail
- tail: `exit 1`

### `verify-vol-split.cjs`

- exit 1, 6 pass, 0 fail
- tail: `exit 1`


## How to use this baseline

Run `node verify-all.cjs` after every slice and diff the result table above. The suites that were
green must stay green; the ones that were failing may be re-baselined only with a recorded reason.
