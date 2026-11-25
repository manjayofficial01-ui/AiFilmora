# BASELINE — AiFilmora verify suite

**Recorded:** 2026-11-25 · **Branch:** `modernize/2026-11-25` · **Base commit:** `ab3e97c` (AiFilmora 2.2.7)

**Result: 44/54 suites green, 10 failing.**

Regenerate with `node verify-all.cjs`. The runner starts `server.cjs` on 127.0.0.1:8765, waits for the
port to accept connections, then runs every `verify-*.cjs` suite. A suite counts as green only if it
exits 0, reports at least one `PASS`, and reports no `FAIL`.

| Suite | Result | PASS | FAIL | Exit | ms |
|---|---|---|---|---|---|
| `verify-ai-timeline.cjs` | ✅ green | 35 | 0 | 0 | 4037 |
| `verify-app.cjs` | ✅ green | 0 | 0 | 0 | 18204 |
| `verify-assets.cjs` | ✅ green | 14 | 0 | 0 | 11573 |
| `verify-audiofx.cjs` | ✅ green | 17 | 0 | 0 | 9371 |
| `verify-audiotrans.cjs` | ✅ green | 27 | 0 | 0 | 7345 |
| `verify-beats.cjs` | ✅ green | 0 | 0 | 0 | 6165 |
| `verify-canvas.cjs` | ✅ green | 0 | 0 | 0 | 10582 |
| `verify-color.cjs` | ✅ green | 22 | 0 | 0 | 10268 |
| `verify-crop.cjs` | ✅ green | 0 | 0 | 0 | 7213 |
| `verify-density.cjs` | ✅ green | 0 | 0 | 0 | 2747 |
| `verify-detach.cjs` | ❌ failing | 3 | 7 | 1 | 8728 |
| `verify-electron.cjs` | ✅ green | 1 | 0 | 0 | 7677 |
| `verify-err.cjs` | ✅ green | 0 | 0 | 0 | 1868 |
| `verify-export22.cjs` | ✅ green | 9 | 0 | 0 | 14254 |
| `verify-filmora-chrome.cjs` | ✅ green | 0 | 0 | 0 | 35381 |
| `verify-filmora-gaps.cjs` | ❌ failing | 13 | 0 | 1 | 33233 |
| `verify-filmora-shell.cjs` | ✅ green | 0 | 0 | 0 | 8564 |
| `verify-filmora-theme.cjs` | ✅ green | 0 | 0 | 0 | 4708 |
| `verify-filmora-tools.cjs` | ✅ green | 0 | 0 | 0 | 4085 |
| `verify-filmora-working.cjs` | ✅ green | 12 | 0 | 0 | 5079 |
| `verify-filmora15.cjs` | ❌ failing | 2 | 0 | 1 | 32408 |
| `verify-final.cjs` | ✅ green | 0 | 0 | 0 | 8181 |
| `verify-fonts.cjs` | ✅ green | 19 | 0 | 0 | 9859 |
| `verify-icon-compact.cjs` | ❌ failing | 1 | 1 | 1 | 4306 |
| `verify-layout.cjs` | ✅ green | 0 | 0 | 0 | 4623 |
| `verify-lut.cjs` | ✅ green | 1 | 0 | 0 | 6547 |
| `verify-media-fix.cjs` | ✅ green | 17 | 0 | 0 | 3712 |
| `verify-name-shape.cjs` | ✅ green | 0 | 0 | 0 | 4882 |
| `verify-new.cjs` | ✅ green | 0 | 0 | 0 | 7878 |
| `verify-panzoom.cjs` | ❌ failing (retried) | 0 | 0 | 1 | 6263 |
| `verify-parity.cjs` | ❌ failing | 19 | 4 | 1 | 6244 |
| `verify-pi-toggle.cjs` | ✅ green | 1 | 0 | 0 | 4962 |
| `verify-rebuild.cjs` | ❌ failing (retried) | 0 | 0 | 1 | 4652 |
| `verify-regress.cjs` | ✅ green | 0 | 0 | 0 | 7186 |
| `verify-save-fallback.cjs` | ❌ failing (retried) | 0 | 0 | 1 | 32539 |
| `verify-save-location.cjs` | ❌ failing (retried) | 0 | 0 | 1 | 35032 |
| `verify-shader-transitions.cjs` | ✅ green | 0 | 0 | 0 | 14825 |
| `verify-shape-fix.cjs` | ✅ green | 0 | 0 | 0 | 8936 |
| `verify-shapes.cjs` | ✅ green | 0 | 0 | 0 | 5226 |
| `verify-sidecar.cjs` | ✅ green | 87 | 0 | 0 | 13749 |
| `verify-speed.cjs` | ✅ green | 0 | 0 | 0 | 7514 |
| `verify-speed2.cjs` | ✅ green | 0 | 0 | 0 | 6592 |
| `verify-tabs.cjs` | ✅ green | 0 | 0 | 0 | 4509 |
| `verify-tracks.cjs` | ✅ green | 0 | 0 | 0 | 4371 |
| `verify-upgrade.cjs` | ✅ green | 0 | 0 | 0 | 6843 |
| `verify-upgrades.cjs` | ✅ green | 0 | 0 | 0 | 8282 |
| `verify-v22.cjs` | ✅ green | 0 | 0 | 0 | 11900 |
| `verify-vertical.cjs` | ✅ green | 0 | 0 | 0 | 6276 |
| `verify-vip.cjs` | ✅ green | 0 | 0 | 0 | 5751 |
| `verify-vol-split.cjs` | ❌ failing | 6 | 0 | 1 | 33798 |
| `verify-vol.cjs` | ✅ green | 0 | 0 | 0 | 8082 |
| `verify-vol2.cjs` | ✅ green | 0 | 0 | 0 | 2350 |
| `verify-vscroll.cjs` | ✅ green | 0 | 0 | 0 | 7464 |
| `verify-wave0.cjs` | ✅ green | 54 | 0 | 0 | 42743 |

## Retried suites

These failed once **without rendering a verdict** — either the dev server refused a
connection under load, or the suite died before its first assertion (a navigation
timeout, a crashed page, a killed process). The runner pinged the server and re-ran
them; the result shown above is the retry.

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
