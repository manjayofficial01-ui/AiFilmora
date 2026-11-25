# BASELINE — AiFilmora verify suite

**Recorded:** 2026-11-25 · **Branch:** `modernize/2026-11-25` · **Base commit:** `ab3e97c` (AiFilmora 2.2.7)

**Result: 41/53 suites green, 12 failing.**

Regenerate with `node verify-all.cjs`. The runner starts `server.cjs` on 127.0.0.1:8765, waits for the
port to accept connections, then runs every `verify-*.cjs` suite. A suite counts as green only if it
exits 0, reports at least one `PASS`, and reports no `FAIL`.

| Suite | Result | PASS | FAIL | Exit | ms |
|---|---|---|---|---|---|
| `verify-ai-timeline.cjs` | ✅ green | 35 | 0 | 0 | 3904 |
| `verify-app.cjs` | ✅ green | 0 | 0 | 0 | 17580 |
| `verify-assets.cjs` | ✅ green | 14 | 0 | 0 | 10415 |
| `verify-audiofx.cjs` | ✅ green | 17 | 0 | 0 | 9051 |
| `verify-audiotrans.cjs` | ✅ green | 27 | 0 | 0 | 7237 |
| `verify-beats.cjs` | ✅ green | 0 | 0 | 0 | 6026 |
| `verify-canvas.cjs` | ✅ green | 0 | 0 | 0 | 9201 |
| `verify-color.cjs` | ✅ green | 22 | 0 | 0 | 9728 |
| `verify-crop.cjs` | ✅ green | 0 | 0 | 0 | 6113 |
| `verify-density.cjs` | ✅ green | 0 | 0 | 0 | 4389 |
| `verify-detach.cjs` | ❌ failing | 3 | 7 | 1 | 8472 |
| `verify-electron.cjs` | ❌ failing | 0 | 0 | null | 180026 |
| `verify-err.cjs` | ✅ green | 0 | 0 | 0 | 2152 |
| `verify-export22.cjs` | ✅ green | 0 | 0 | 0 | 14994 |
| `verify-filmora-chrome.cjs` | ✅ green | 0 | 0 | 0 | 35278 |
| `verify-filmora-gaps.cjs` | ❌ failing | 13 | 0 | 1 | 33040 |
| `verify-filmora-shell.cjs` | ❌ failing | 0 | 0 | 1 | 33124 |
| `verify-filmora-theme.cjs` | ✅ green | 0 | 0 | 0 | 3518 |
| `verify-filmora-tools.cjs` | ✅ green | 0 | 0 | 0 | 4351 |
| `verify-filmora-working.cjs` | ✅ green | 12 | 0 | 0 | 4705 |
| `verify-filmora15.cjs` | ❌ failing | 2 | 0 | 1 | 32827 |
| `verify-final.cjs` | ✅ green | 0 | 0 | 0 | 10196 |
| `verify-fonts.cjs` | ✅ green | 19 | 0 | 0 | 10485 |
| `verify-icon-compact.cjs` | ❌ failing | 1 | 1 | 1 | 4604 |
| `verify-layout.cjs` | ✅ green | 0 | 0 | 0 | 4168 |
| `verify-lut.cjs` | ✅ green | 1 | 0 | 0 | 6917 |
| `verify-media-fix.cjs` | ✅ green | 17 | 0 | 0 | 3833 |
| `verify-name-shape.cjs` | ✅ green | 0 | 0 | 0 | 4535 |
| `verify-new.cjs` | ✅ green | 0 | 0 | 0 | 8339 |
| `verify-panzoom.cjs` | ❌ failing | 0 | 0 | 1 | 5996 |
| `verify-parity.cjs` | ❌ failing | 19 | 4 | 1 | 5226 |
| `verify-pi-toggle.cjs` | ✅ green | 1 | 0 | 0 | 3239 |
| `verify-rebuild.cjs` | ❌ failing | 0 | 0 | 1 | 4105 |
| `verify-regress.cjs` | ✅ green | 0 | 0 | 0 | 5498 |
| `verify-save-fallback.cjs` | ❌ failing | 0 | 0 | 1 | 32558 |
| `verify-save-location.cjs` | ❌ failing | 0 | 0 | 1 | 35438 |
| `verify-shader-transitions.cjs` | ✅ green | 0 | 0 | 0 | 14812 |
| `verify-shape-fix.cjs` | ✅ green | 0 | 0 | 0 | 8278 |
| `verify-shapes.cjs` | ✅ green | 0 | 0 | 0 | 5678 |
| `verify-speed.cjs` | ✅ green | 0 | 0 | 0 | 8210 |
| `verify-speed2.cjs` | ✅ green | 0 | 0 | 0 | 6164 |
| `verify-tabs.cjs` | ✅ green | 0 | 0 | 0 | 3980 |
| `verify-tracks.cjs` | ✅ green | 0 | 0 | 0 | 4107 |
| `verify-upgrade.cjs` | ✅ green | 0 | 0 | 0 | 6520 |
| `verify-upgrades.cjs` | ✅ green | 0 | 0 | 0 | 8249 |
| `verify-v22.cjs` | ✅ green | 0 | 0 | 0 | 6061 |
| `verify-vertical.cjs` | ✅ green | 0 | 0 | 0 | 6359 |
| `verify-vip.cjs` | ✅ green | 0 | 0 | 0 | 5554 |
| `verify-vol-split.cjs` | ❌ failing | 6 | 0 | 1 | 33471 |
| `verify-vol.cjs` | ✅ green | 0 | 0 | 0 | 6532 |
| `verify-vol2.cjs` | ✅ green | 0 | 0 | 0 | 2149 |
| `verify-vscroll.cjs` | ✅ green | 0 | 0 | 0 | 6407 |
| `verify-wave0.cjs` | ✅ green | 28 | 0 | 0 | 19707 |

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
