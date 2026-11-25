# BASELINE — AiFilmora verify suite

**Recorded:** 2026-11-25 · **Branch:** `modernize/2026-11-25` · **Base commit:** `ab3e97c` (AiFilmora 2.2.7)

**Result: 44/54 suites green, 10 failing.**

Regenerate with `node verify-all.cjs`. The runner starts `server.cjs` on 127.0.0.1:8765, waits for the
port to accept connections, then runs every `verify-*.cjs` suite. A suite counts as green only if it
exits 0, reports at least one `PASS`, and reports no `FAIL`.

| Suite | Result | PASS | FAIL | Exit | ms |
|---|---|---|---|---|---|
| `verify-ai-timeline.cjs` | ✅ green | 35 | 0 | 0 | 3864 |
| `verify-app.cjs` | ✅ green | 0 | 0 | 0 | 18610 |
| `verify-assets.cjs` | ✅ green | 14 | 0 | 0 | 11388 |
| `verify-audiofx.cjs` | ✅ green | 17 | 0 | 0 | 8735 |
| `verify-audiotrans.cjs` | ✅ green | 27 | 0 | 0 | 7322 |
| `verify-beats.cjs` | ✅ green | 0 | 0 | 0 | 6285 |
| `verify-canvas.cjs` | ✅ green | 0 | 0 | 0 | 8822 |
| `verify-color.cjs` | ✅ green | 22 | 0 | 0 | 10562 |
| `verify-crop.cjs` | ✅ green | 0 | 0 | 0 | 7048 |
| `verify-density.cjs` | ✅ green | 0 | 0 | 0 | 4139 |
| `verify-detach.cjs` | ❌ failing | 3 | 7 | 1 | 9326 |
| `verify-electron.cjs` | ✅ green | 1 | 0 | 0 | 8168 |
| `verify-err.cjs` | ✅ green | 0 | 0 | 0 | 2868 |
| `verify-export22.cjs` | ✅ green | 9 | 0 | 0 | 15607 |
| `verify-filmora-chrome.cjs` | ✅ green | 0 | 0 | 0 | 35586 |
| `verify-filmora-gaps.cjs` | ❌ failing | 13 | 0 | 1 | 32906 |
| `verify-filmora-shell.cjs` | ✅ green | 0 | 0 | 0 | 8858 |
| `verify-filmora-theme.cjs` | ✅ green | 0 | 0 | 0 | 4323 |
| `verify-filmora-tools.cjs` | ✅ green | 0 | 0 | 0 | 4141 |
| `verify-filmora-working.cjs` | ✅ green | 12 | 0 | 0 | 5070 |
| `verify-filmora15.cjs` | ❌ failing | 2 | 0 | 1 | 32523 |
| `verify-final.cjs` | ✅ green | 0 | 0 | 0 | 10675 |
| `verify-fonts.cjs` | ✅ green | 19 | 0 | 0 | 10126 |
| `verify-icon-compact.cjs` | ❌ failing | 1 | 1 | 1 | 4587 |
| `verify-layout.cjs` | ✅ green | 0 | 0 | 0 | 4880 |
| `verify-lut.cjs` | ✅ green | 1 | 0 | 0 | 7923 |
| `verify-media-fix.cjs` | ✅ green | 17 | 0 | 0 | 3732 |
| `verify-name-shape.cjs` | ✅ green | 0 | 0 | 0 | 5542 |
| `verify-new.cjs` | ✅ green | 0 | 0 | 0 | 9112 |
| `verify-panzoom.cjs` | ❌ failing (retried) | 0 | 0 | 1 | 6130 |
| `verify-parity.cjs` | ❌ failing | 19 | 4 | 1 | 6697 |
| `verify-pi-toggle.cjs` | ✅ green | 1 | 0 | 0 | 5112 |
| `verify-rebuild.cjs` | ❌ failing (retried) | 0 | 0 | 1 | 5462 |
| `verify-regress.cjs` | ✅ green | 0 | 0 | 0 | 8001 |
| `verify-save-fallback.cjs` | ❌ failing (retried) | 0 | 0 | 1 | 32706 |
| `verify-save-location.cjs` | ❌ failing (retried) | 0 | 0 | 1 | 34961 |
| `verify-shader-transitions.cjs` | ✅ green | 0 | 0 | 0 | 14655 |
| `verify-shape-fix.cjs` | ✅ green | 0 | 0 | 0 | 8764 |
| `verify-shapes.cjs` | ✅ green | 0 | 0 | 0 | 5811 |
| `verify-sidecar.cjs` | ✅ green | 118 | 0 | 0 | 21715 |
| `verify-speed.cjs` | ✅ green | 0 | 0 | 0 | 7670 |
| `verify-speed2.cjs` | ✅ green | 0 | 0 | 0 | 6277 |
| `verify-tabs.cjs` | ✅ green | 0 | 0 | 0 | 4680 |
| `verify-tracks.cjs` | ✅ green | 0 | 0 | 0 | 4251 |
| `verify-upgrade.cjs` | ✅ green | 0 | 0 | 0 | 7721 |
| `verify-upgrades.cjs` | ✅ green | 0 | 0 | 0 | 7724 |
| `verify-v22.cjs` | ✅ green | 0 | 0 | 0 | 11202 |
| `verify-vertical.cjs` | ✅ green | 0 | 0 | 0 | 6254 |
| `verify-vip.cjs` | ✅ green | 0 | 0 | 0 | 5601 |
| `verify-vol-split.cjs` | ❌ failing | 6 | 0 | 1 | 33700 |
| `verify-vol.cjs` | ✅ green | 0 | 0 | 0 | 5974 |
| `verify-vol2.cjs` | ✅ green | 0 | 0 | 0 | 1874 |
| `verify-vscroll.cjs` | ✅ green | 0 | 0 | 0 | 7536 |
| `verify-wave0.cjs` | ✅ green | 54 | 0 | 0 | 39387 |

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
