# BASELINE — AiFilmora verify suite

**Recorded:** 2026-11-25 · **Branch:** `modernize/2026-11-25` · **Base commit:** `ab3e97c` (AiFilmora 2.2.7)

**Result: 43/54 suites green, 11 failing.**

Regenerate with `node verify-all.cjs`. The runner starts `server.cjs` on 127.0.0.1:8765, waits for the
port to accept connections, then runs every `verify-*.cjs` suite. A suite counts as green only if it
exits 0, reports at least one `PASS`, and reports no `FAIL`.

| Suite | Result | PASS | FAIL | Exit | ms |
|---|---|---|---|---|---|
| `verify-ai-timeline.cjs` | ✅ green | 35 | 0 | 0 | 14918 |
| `verify-app.cjs` | ✅ green | 0 | 0 | 0 | 19311 |
| `verify-assets.cjs` | ✅ green | 14 | 0 | 0 | 11533 |
| `verify-audiofx.cjs` | ✅ green | 17 | 0 | 0 | 10224 |
| `verify-audiotrans.cjs` | ✅ green | 27 | 0 | 0 | 8280 |
| `verify-beats.cjs` | ✅ green | 0 | 0 | 0 | 6856 |
| `verify-canvas.cjs` | ✅ green | 0 | 0 | 0 | 11016 |
| `verify-color.cjs` | ✅ green | 22 | 0 | 0 | 10404 |
| `verify-crop.cjs` | ✅ green | 0 | 0 | 0 | 7588 |
| `verify-density.cjs` | ✅ green | 0 | 0 | 0 | 2698 |
| `verify-detach.cjs` | ❌ failing | 3 | 7 | 1 | 8671 |
| `verify-electron.cjs` | ❌ failing | 0 | 0 | null | 180036 |
| `verify-err.cjs` | ✅ green | 0 | 0 | 0 | 2946 |
| `verify-export22.cjs` | ✅ green | 0 | 0 | 0 | 24824 |
| `verify-filmora-chrome.cjs` | ✅ green | 0 | 0 | 0 | 35979 |
| `verify-filmora-gaps.cjs` | ❌ failing | 13 | 0 | 1 | 33513 |
| `verify-filmora-shell.cjs` | ✅ green | 0 | 0 | 0 | 7891 |
| `verify-filmora-theme.cjs` | ✅ green | 0 | 0 | 0 | 4772 |
| `verify-filmora-tools.cjs` | ✅ green | 0 | 0 | 0 | 4586 |
| `verify-filmora-working.cjs` | ✅ green | 12 | 0 | 0 | 5317 |
| `verify-filmora15.cjs` | ❌ failing | 2 | 0 | 1 | 32688 |
| `verify-final.cjs` | ✅ green | 0 | 0 | 0 | 9767 |
| `verify-fonts.cjs` | ✅ green | 19 | 0 | 0 | 11455 |
| `verify-icon-compact.cjs` | ❌ failing | 1 | 1 | 1 | 5453 |
| `verify-layout.cjs` | ✅ green | 0 | 0 | 0 | 5213 |
| `verify-lut.cjs` | ✅ green | 1 | 0 | 0 | 7398 |
| `verify-media-fix.cjs` | ✅ green | 17 | 0 | 0 | 13805 |
| `verify-name-shape.cjs` | ✅ green | 0 | 0 | 0 | 6900 |
| `verify-new.cjs` | ✅ green | 0 | 0 | 0 | 9324 |
| `verify-panzoom.cjs` | ❌ failing | 0 | 0 | 1 | 7222 |
| `verify-parity.cjs` | ❌ failing | 19 | 4 | 1 | 5608 |
| `verify-pi-toggle.cjs` | ✅ green | 1 | 0 | 0 | 4739 |
| `verify-rebuild.cjs` | ❌ failing | 0 | 0 | 1 | 5983 |
| `verify-regress.cjs` | ✅ green | 0 | 0 | 0 | 8306 |
| `verify-save-fallback.cjs` | ❌ failing | 0 | 0 | 1 | 32966 |
| `verify-save-location.cjs` | ❌ failing | 0 | 0 | 1 | 35420 |
| `verify-shader-transitions.cjs` | ✅ green | 0 | 0 | 0 | 14894 |
| `verify-shape-fix.cjs` | ✅ green | 0 | 0 | 0 | 8628 |
| `verify-shapes.cjs` | ✅ green | 0 | 0 | 0 | 5768 |
| `verify-sidecar.cjs` | ✅ green | 48 | 0 | 0 | 19150 |
| `verify-speed.cjs` | ✅ green | 0 | 0 | 0 | 7777 |
| `verify-speed2.cjs` | ✅ green | 0 | 0 | 0 | 7012 |
| `verify-tabs.cjs` | ✅ green | 0 | 0 | 0 | 4492 |
| `verify-tracks.cjs` | ✅ green | 0 | 0 | 0 | 5017 |
| `verify-upgrade.cjs` | ✅ green | 0 | 0 | 0 | 7371 |
| `verify-upgrades.cjs` | ✅ green | 0 | 0 | 0 | 8408 |
| `verify-v22.cjs` | ✅ green | 0 | 0 | 0 | 6131 |
| `verify-vertical.cjs` | ✅ green | 0 | 0 | 0 | 6589 |
| `verify-vip.cjs` | ✅ green | 0 | 0 | 0 | 6266 |
| `verify-vol-split.cjs` | ❌ failing | 6 | 0 | 1 | 33858 |
| `verify-vol.cjs` | ✅ green | 0 | 0 | 0 | 8815 |
| `verify-vol2.cjs` | ✅ green | 0 | 0 | 0 | 2446 |
| `verify-vscroll.cjs` | ✅ green | 0 | 0 | 0 | 7234 |
| `verify-wave0.cjs` | ✅ green | 28 | 0 | 0 | 19949 |

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
