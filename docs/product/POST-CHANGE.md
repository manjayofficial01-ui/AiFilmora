# BASELINE — AiFilmora verify suite

**Recorded:** 2026-11-25 · **Branch:** `modernize/2026-11-25` · **Base commit:** `ab3e97c` (AiFilmora 2.2.7)

**Result: 41/53 suites green, 12 failing.**

Regenerate with `node verify-all.cjs`. The runner starts `server.cjs` on 127.0.0.1:8765, waits for the
port to accept connections, then runs every `verify-*.cjs` suite. A suite counts as green only if it
exits 0, reports at least one `PASS`, and reports no `FAIL`.

| Suite | Result | PASS | FAIL | Exit | ms |
|---|---|---|---|---|---|
| `verify-ai-timeline.cjs` | ✅ green | 35 | 0 | 0 | 5589 |
| `verify-app.cjs` | ✅ green | 0 | 0 | 0 | 18978 |
| `verify-assets.cjs` | ✅ green | 14 | 0 | 0 | 11299 |
| `verify-audiofx.cjs` | ✅ green | 17 | 0 | 0 | 10563 |
| `verify-audiotrans.cjs` | ✅ green | 27 | 0 | 0 | 8505 |
| `verify-beats.cjs` | ✅ green | 0 | 0 | 0 | 7033 |
| `verify-canvas.cjs` | ✅ green | 0 | 0 | 0 | 10194 |
| `verify-color.cjs` | ✅ green | 22 | 0 | 0 | 11276 |
| `verify-crop.cjs` | ✅ green | 0 | 0 | 0 | 7106 |
| `verify-density.cjs` | ✅ green | 0 | 0 | 0 | 2872 |
| `verify-detach.cjs` | ❌ failing | 3 | 7 | 1 | 9110 |
| `verify-electron.cjs` | ❌ failing | 0 | 0 | null | 180030 |
| `verify-err.cjs` | ✅ green | 0 | 0 | 0 | 2297 |
| `verify-export22.cjs` | ✅ green | 0 | 0 | 0 | 24100 |
| `verify-filmora-chrome.cjs` | ✅ green | 0 | 0 | 0 | 35573 |
| `verify-filmora-gaps.cjs` | ❌ failing | 13 | 0 | 1 | 33276 |
| `verify-filmora-shell.cjs` | ❌ failing | 0 | 0 | 1 | 33975 |
| `verify-filmora-theme.cjs` | ✅ green | 0 | 0 | 0 | 10036 |
| `verify-filmora-tools.cjs` | ✅ green | 0 | 0 | 0 | 4154 |
| `verify-filmora-working.cjs` | ✅ green | 12 | 0 | 0 | 4438 |
| `verify-filmora15.cjs` | ❌ failing | 2 | 0 | 1 | 32476 |
| `verify-final.cjs` | ✅ green | 0 | 0 | 0 | 10007 |
| `verify-fonts.cjs` | ✅ green | 19 | 0 | 0 | 9888 |
| `verify-icon-compact.cjs` | ❌ failing | 1 | 1 | 1 | 3966 |
| `verify-layout.cjs` | ✅ green | 0 | 0 | 0 | 4539 |
| `verify-lut.cjs` | ✅ green | 1 | 0 | 0 | 6490 |
| `verify-media-fix.cjs` | ✅ green | 17 | 0 | 0 | 3696 |
| `verify-name-shape.cjs` | ✅ green | 0 | 0 | 0 | 5673 |
| `verify-new.cjs` | ✅ green | 0 | 0 | 0 | 8904 |
| `verify-panzoom.cjs` | ❌ failing | 0 | 0 | 1 | 6369 |
| `verify-parity.cjs` | ❌ failing | 19 | 4 | 1 | 5458 |
| `verify-pi-toggle.cjs` | ✅ green | 1 | 0 | 0 | 4112 |
| `verify-rebuild.cjs` | ❌ failing | 0 | 0 | 1 | 4966 |
| `verify-regress.cjs` | ✅ green | 0 | 0 | 0 | 6694 |
| `verify-save-fallback.cjs` | ❌ failing | 0 | 0 | 1 | 32596 |
| `verify-save-location.cjs` | ❌ failing | 0 | 0 | 1 | 35391 |
| `verify-shader-transitions.cjs` | ✅ green | 0 | 0 | 0 | 15110 |
| `verify-shape-fix.cjs` | ✅ green | 0 | 0 | 0 | 10019 |
| `verify-shapes.cjs` | ✅ green | 0 | 0 | 0 | 5705 |
| `verify-speed.cjs` | ✅ green | 0 | 0 | 0 | 7447 |
| `verify-speed2.cjs` | ✅ green | 0 | 0 | 0 | 6546 |
| `verify-tabs.cjs` | ✅ green | 0 | 0 | 0 | 4439 |
| `verify-tracks.cjs` | ✅ green | 0 | 0 | 0 | 4851 |
| `verify-upgrade.cjs` | ✅ green | 0 | 0 | 0 | 7380 |
| `verify-upgrades.cjs` | ✅ green | 0 | 0 | 0 | 8536 |
| `verify-v22.cjs` | ✅ green | 0 | 0 | 0 | 6059 |
| `verify-vertical.cjs` | ✅ green | 0 | 0 | 0 | 5806 |
| `verify-vip.cjs` | ✅ green | 0 | 0 | 0 | 10860 |
| `verify-vol-split.cjs` | ❌ failing | 6 | 0 | 1 | 34842 |
| `verify-vol.cjs` | ✅ green | 0 | 0 | 0 | 10079 |
| `verify-vol2.cjs` | ✅ green | 0 | 0 | 0 | 4507 |
| `verify-vscroll.cjs` | ✅ green | 0 | 0 | 0 | 8240 |
| `verify-wave0.cjs` | ✅ green | 26 | 0 | 0 | 27695 |

## Pre-existing failures

These fail on the **base commit**, before any change in this cycle. A failure that appears here
after a code change is a regression; a failure that was already here is not.

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
