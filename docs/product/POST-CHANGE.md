# BASELINE — AiFilmora verify suite

**Recorded:** 2026-11-25 · **Branch:** `modernize/2026-11-25` · **Base commit:** `ab3e97c` (AiFilmora 2.2.7)

**Result: 44/54 suites green, 10 failing.**

Regenerate with `node verify-all.cjs`. The runner starts `server.cjs` on 127.0.0.1:8765, waits for the
port to accept connections, then runs every `verify-*.cjs` suite. A suite counts as green only if it
exits 0, reports at least one `PASS`, and reports no `FAIL`.

| Suite | Result | PASS | FAIL | Exit | ms |
|---|---|---|---|---|---|
| `verify-ai-timeline.cjs` | ✅ green | 35 | 0 | 0 | 4611 |
| `verify-app.cjs` | ✅ green | 0 | 0 | 0 | 19271 |
| `verify-assets.cjs` | ✅ green | 14 | 0 | 0 | 13183 |
| `verify-audiofx.cjs` | ✅ green | 17 | 0 | 0 | 11004 |
| `verify-audiotrans.cjs` | ✅ green | 27 | 0 | 0 | 8495 |
| `verify-beats.cjs` | ✅ green | 0 | 0 | 0 | 6745 |
| `verify-canvas.cjs` | ✅ green | 0 | 0 | 0 | 13215 |
| `verify-color.cjs` | ✅ green | 22 | 0 | 0 | 11135 |
| `verify-crop.cjs` | ✅ green | 0 | 0 | 0 | 7877 |
| `verify-density.cjs` | ✅ green | 0 | 0 | 0 | 3038 |
| `verify-detach.cjs` | ❌ failing | 3 | 7 | 1 | 8742 |
| `verify-electron.cjs` | ✅ green | 1 | 0 | 0 | 8250 |
| `verify-err.cjs` | ✅ green | 0 | 0 | 0 | 2192 |
| `verify-export22.cjs` | ✅ green | 0 | 0 | 0 | 25111 |
| `verify-filmora-chrome.cjs` | ✅ green | 0 | 0 | 0 | 35755 |
| `verify-filmora-gaps.cjs` | ❌ failing | 13 | 0 | 1 | 32760 |
| `verify-filmora-shell.cjs` | ✅ green | 0 | 0 | 0 | 7890 |
| `verify-filmora-theme.cjs` | ✅ green | 0 | 0 | 0 | 4069 |
| `verify-filmora-tools.cjs` | ✅ green | 0 | 0 | 0 | 3691 |
| `verify-filmora-working.cjs` | ✅ green | 12 | 0 | 0 | 6400 |
| `verify-filmora15.cjs` | ❌ failing | 2 | 0 | 1 | 34470 |
| `verify-final.cjs` | ✅ green | 0 | 0 | 0 | 10330 |
| `verify-fonts.cjs` | ✅ green | 19 | 0 | 0 | 9302 |
| `verify-icon-compact.cjs` | ❌ failing | 1 | 1 | 1 | 4936 |
| `verify-layout.cjs` | ✅ green | 0 | 0 | 0 | 5372 |
| `verify-lut.cjs` | ✅ green | 1 | 0 | 0 | 6868 |
| `verify-media-fix.cjs` | ✅ green | 17 | 0 | 0 | 3545 |
| `verify-name-shape.cjs` | ✅ green | 0 | 0 | 0 | 6321 |
| `verify-new.cjs` | ✅ green | 0 | 0 | 0 | 8878 |
| `verify-panzoom.cjs` | ❌ failing (retried) | 0 | 0 | 1 | 6044 |
| `verify-parity.cjs` | ❌ failing | 19 | 4 | 1 | 6239 |
| `verify-pi-toggle.cjs` | ✅ green | 1 | 0 | 0 | 4312 |
| `verify-rebuild.cjs` | ❌ failing (retried) | 0 | 0 | 1 | 5002 |
| `verify-regress.cjs` | ✅ green | 0 | 0 | 0 | 7796 |
| `verify-save-fallback.cjs` | ❌ failing (retried) | 0 | 0 | 1 | 32642 |
| `verify-save-location.cjs` | ❌ failing (retried) | 0 | 0 | 1 | 34995 |
| `verify-shader-transitions.cjs` | ✅ green | 0 | 0 | 0 | 14529 |
| `verify-shape-fix.cjs` | ✅ green | 0 | 0 | 0 | 8500 |
| `verify-shapes.cjs` | ✅ green | 0 | 0 | 0 | 5738 |
| `verify-sidecar.cjs` | ✅ green | 49 | 0 | 0 | 13439 |
| `verify-speed.cjs` | ✅ green | 0 | 0 | 0 | 6909 |
| `verify-speed2.cjs` | ✅ green | 0 | 0 | 0 | 5996 |
| `verify-tabs.cjs` | ✅ green | 0 | 0 | 0 | 4187 |
| `verify-tracks.cjs` | ✅ green | 0 | 0 | 0 | 4136 |
| `verify-upgrade.cjs` | ✅ green | 0 | 0 | 0 | 7214 |
| `verify-upgrades.cjs` | ✅ green | 0 | 0 | 0 | 7810 |
| `verify-v22.cjs` | ✅ green | 0 | 0 | 0 | 11232 |
| `verify-vertical.cjs` | ✅ green | 0 | 0 | 0 | 5700 |
| `verify-vip.cjs` | ✅ green | 0 | 0 | 0 | 5427 |
| `verify-vol-split.cjs` | ❌ failing | 6 | 0 | 1 | 33536 |
| `verify-vol.cjs` | ✅ green | 0 | 0 | 0 | 7880 |
| `verify-vol2.cjs` | ✅ green | 0 | 0 | 0 | 3568 |
| `verify-vscroll.cjs` | ✅ green | 0 | 0 | 0 | 7524 |
| `verify-wave0.cjs` | ✅ green | 34 | 0 | 0 | 35124 |

## Retried suites

These failed once with a **connection error** — the dev server refused a connection under
load, so the suite never reached its first assertion. The runner pinged the server and
re-ran them; the result shown above is the retry.

- `verify-panzoom.cjs` → ❌ still failing
- `verify-rebuild.cjs` → ❌ still failing
- `verify-save-fallback.cjs` → ❌ still failing
- `verify-save-location.cjs` → ❌ still failing

## Pre-existing failures

These fail on the **base commit**, before any change in this cycle. A failure that appears here
after a code change is a regression; a failure that was already here is not.

### `verify-detach.cjs`

- exit 1, 3 pass, 7 fail
- tail: `exit 1; 7 FAIL marker(s)`

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
- tail: `inconclusive run, retry also failed — exit 1`

### `verify-parity.cjs`

- exit 1, 19 pass, 4 fail
- tail: `exit 1; 4 FAIL marker(s)`

### `verify-rebuild.cjs`

- exit 1, 0 pass, 0 fail
- tail: `inconclusive run, retry also failed — exit 1`

### `verify-save-fallback.cjs`

- exit 1, 0 pass, 0 fail
- tail: `inconclusive run, retry also failed — exit 1`

### `verify-save-location.cjs`

- exit 1, 0 pass, 0 fail
- tail: `inconclusive run, retry also failed — exit 1`

### `verify-vol-split.cjs`

- exit 1, 6 pass, 0 fail
- tail: `exit 1`


## How to use this baseline

Run `node verify-all.cjs` after every slice and diff the result table above. The suites that were
green must stay green; the ones that were failing may be re-baselined only with a recorded reason.
