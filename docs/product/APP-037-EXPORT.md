# APP-037 — Real export: encode the file you actually asked for

**Status:** building · **Roadmap:** `ROADMAP.md` Wave 6, APP-037 · **Audit source:** `AUDIT-2026-11-25.md` §4.1
**Cycle:** 2026-11-25 · branch `modernize/2026-11-25`

---

## 1. The problem, stated exactly

AiFilmora's export sheet is a promise the app cannot keep.

Six live controls sit in the sheet — **Format** (MP4/MOV/AVI/MKV/WEBM/GIF/MP3),
**Encoder** (H.264/HEVC/AV1), **Resolution** (1080p/4K/720p/vertical),
**Frame rate**, **Bit rate**, **Hardware accel**. `readFilmoraExportSettings()`
reads all six. **It is never called.** `resolveExportConfig()` ignores the six
selects and reads only the preset chip plus `settings.exportDefaults`, so
choosing "3840×2160" changes nothing at all.

Underneath, the render is:

```js
canvas.captureStream(fps)  →  MediaRecorder  →  Blob  →  .webm on disk
```

That is the whole pipeline. Three consequences follow, and all three are
observable in the shipped app:

1. **The container is always WebM.** The requested format is discarded; the file
   is renamed `.webm` at save time (`js/export.js:632-633`).
2. **The resolution is always the preview's.** `#previewCanvas` is sized to the
   preview panel (`js/player.js:1182-1184`), so the file is 720p whatever the
   sheet says.
3. **There is no sound track.** The capture stream is the canvas only — there is
   no audio track anywhere in the export path (`grep MediaStream|getAudioTracks`
   over `js/` → 0 matches).

And the export does not even end when the timeline does: the player wraps the
playhead to 0 at the end of the sequence (`js/player.js:1329-1331`), so the
200 ms poll in `capturePreviewToWebM` that watches for `t >= dur - 0.05`
(`js/export.js:565`) usually misses its own end condition, and the recorder
keeps running until the `dur + 15 s` safety timeout — capturing a frozen frame
for the last fifteen seconds of every export.

So the app that can measure LUFS, transcribe with word timings, apply 76 audio
presets, duck, fade and shape transitions terminates in a silent 720p WebM.
**Roughly forty capabilities end here.** This is the audit's §2.2: *"the exit is
a silent 720p WebM while the export sheet promises 4K H.265."*

## 2. What APP-037 must deliver

| # | Requirement | Why it is not optional |
|---|---|---|
| R1 | The sidecar gains an `encode` op: WebM → the requested container, codec, resolution, fps and bit rate | Without an encoder there is no MP4. |
| R2 | The six export controls are **bound** — they change the file, not just the sheet | The sheet is the contract; a control that does nothing is a lie. |
| R3 | The output has an **audio mix bus** — a real sound track, mixed from the timeline | LUFS, fades, ducking, per-clip gain and Audio FX all terminate in the mix. |
| R4 | The render **ends when the timeline ends** | Fifteen seconds of frozen frame is not a render. |
| R5 | The output is rendered at the **requested resolution**, not the preview's | A 4K button that writes 720p is worse than no 4K button. |
| R6 | Without FFmpeg, the app says **exactly what it produced** | Honesty is a product feature here, not a nicety. |

## 3. Architecture

### 3.1 The render is real-time, and stays real-time

The player is a canvas compositor driven by `requestAnimationFrame`. A render is
therefore: play the timeline from 0 while the canvas is captured, then stop at
the end. That part is right. What is wrong is the *end* and the *size*.

```
 timeline ──► player (rAF) ──► #previewCanvas ──► canvas.captureStream(fps)
                                          │                    │
                                          │                    ├──► MediaRecorder ──► WebM blob
                                          ▼                    │
                                    mix bus (Web Audio) ───────┴──► audio track
```

### 3.2 Export mode in the player (`js/player.js`)

The player gains an **export mode**. It is off by default and changes exactly
two things:

| Behaviour | Normal | Export mode |
|---|---|---|
| Playhead at the end of the sequence | wraps to 0, playback stops | stops **at** the sequence duration |
| Canvas size | fits the preview panel, scaled by DPR | exactly the requested width × height |
| End of render | — | dispatches `aifimora:render-complete` |

`resize()` currently forces `canvas.width/height` to the panel size. In export
mode it is given the target resolution instead, so `drawFrame()` composes the
timeline — titles, overlays, grades, transitions — at the **output**
resolution. The source footage is still whatever it is; the *composition* is
full-size. That is what a real NLE does, and it is honest: we say the file is
1920×1080, and the timeline really is 1920×1080.

The end-of-render signal replaces the 200 ms poll. The poll exists only because
the player wrapped the playhead and there was nothing to listen for. With a
real signal, the export resolves the moment the last frame is drawn, and the
`dur + 15 s` timeout becomes the safety net it was always meant to be.

### 3.3 The mix bus (`js/audio-fx.js`)

Every media element in the player **already** has a Web Audio graph.
`syncElementFx()` is called for every active clip on every frame, and it calls
`ensureGraph()` unconditionally — so `src → fxIn → fxOut → gain →
ctx.destination` exists for every media element already. The gain node carries
the clip's level, fades, ducking and Audio FX chain.

The mix bus is therefore a small addition, not a rewrite:

- One `MediaStreamAudioDestinationNode` on the shared `AudioContext`.
- Every graph's `gain` also connects to it.
- During export the bus's audio track is added to the capture stream.

Two details that matter:

1. **The URL guard.** `ensureGraph()` refuses anything that is not
   `blob:`/`data:`/`file:`. `app://` — how the Electron shell serves sidecar
   proxies — was refused, so a rescued file played with no sound. The guard now
   admits `app:`. This is safe *because* `app://local/_media/…` is served from
   the same origin as the page (`electron/main.cjs:258-294`), so Web Audio can
   read it; the `createMediaElementSource` call is still wrapped in a `try`, and
   a failure degrades to the element's own volume rather than to silence.
2. **The bus exists before the graphs.** The `MediaStreamAudioDestinationNode`
   is created with the `AudioContext`, so every graph connects to it on
   creation. No graph is ever left unconnected to the mix.

### 3.3a What the bus needed, and how it was found

The first implementation of the bus produced **an export with no file at all**
for any project without imported media. The suite caught it
(`verify-export22.cjs` — *"Recorder produced no data"*), and the cause was
measured rather than guessed.

Five arrangements were recorded in a real Chromium, each on a fresh page:

| Arrangement | Chunks |
|---|---|
| canvas video only | 8 ✅ |
| canvas video + the bus's audio track, **bus idle** | **0** ❌ |
| canvas video + the bus's audio track, bus has a graph | 8 ✅ |
| canvas video + an element's own `captureStream()` audio, element inside a graph | **0** ❌ |
| canvas video + (element → `createMediaStreamSource` → destination) | 8 ✅ |

The mechanism is now clear:

- **An idle Web Audio graph does not render.** With no source connected, the
  `MediaStreamAudioDestinationNode` produces no frames, so its track delivers
  nothing.
- **A MediaRecorder carrying a stalled audio track records nothing at all** —
  not even the video. The muxer never finalises a cluster without an audio
  timestamp, so the video frames sit in the buffer and no chunk is emitted.
- An element's own `captureStream()` audio is **silent** once the element is
  routed through a Web Audio graph (`createMediaElementSource` takes its
  output), so that route cannot be used for the mix either.

**The fix is a silent keep-alive source**: a `ConstantSourceNode` with offset
0, connected to the bus. The graph then always renders, the bus's track always
delivers frames, and the recording always has a sound track — silence when the
timeline is silent. With the keep-alive, the same measurement gives **8 chunks
and a blob that decodes as audio** on a page with nothing playing at all.

The bus was not the only thing that needed hardening: `capturePreview()` now
takes a `withAudio` flag, and if the recorder still produces no data the export
is **retried once without the audio track**. The picture is worth more than the
sound, and a failed export must never be the price of an ambitious one.

### 3.4 The `encode` op (`electron/sidecar/media-service.cjs`)

The worker gains one operation, next to `convert`/`poster`/`transcribe`:

```
{ op: "encode", params: { path, container, codec, width, height, fps,
                           bitrateMbps, audio, audioBitrate, hardware } }
→ { ok, path, probe, warnings }
```

The argument builder is the whole design:

| Requested | Encoder | Notes |
|---|---|---|
| H.264 | `libx264` | `-pix_fmt yuv420p`, `-preset medium` |
| HEVC | `libx265` | `-tag:v hvc1` so Apple and Windows play it |
| AV1 | `libsvtav1` → `libaom-av1` | two candidates, first that works wins |
| ProRes | `prores_ks` | the "editing master" preset |
| VP9 (WebM) | `libvpx-vp9` | WebM cannot hold H.264 — the container decides |
| GIF | `palettegen`/`paletteuse` | two-pass, so the colours are not posterised |
| MP3 | `libmp3lame` | audio only, `-vn` |

Video filter: `scale=W:H:force_original_aspect_ratio=decrease,pad=W:H:(ow-iw)/2:(oh-ih)/2,setsar=1`
— the source is fitted, never stretched, and the remainder is black. A 16:9
timeline exported as 1080×1920 gets pillarboxes, which is correct.

Audio: AAC 192 k for MP4/MOV/MKV, Opus for WebM, MP3 for AVI, none for GIF.

Hardware: `nvenc`/`qsv` are tried **first** when asked for, and the software
encoder is the fallback — with the fallback recorded in `warnings`, so the UI can
say *"encoded in software; no NVENC encoder was available"* rather than
pretending the GPU did it.

**The result is verified, not assumed.** After ffmpeg runs, the output is
probed with the same `analyzeFile()` the rest of the sidecar uses. The op
returns the probe: the codec that was actually written, the resolution that was
actually written, whether an audio stream is actually there. The UI reports
those numbers, not the requested ones.

### 3.5 The bytes never come back to the renderer

A four-minute 1080p capture is hundreds of megabytes. Shipping that to the
renderer as base64 and back again would be slow and would double the memory.

```
renderer  ──bytes (structured clone)──►  main  ──path──►  sidecar worker
              ▲                                              │
              └────────── { path, bytes, probe } ─────────────┘
```

The main process materialises the capture into its own cache, the worker
encodes it in place, and the main process copies the finished file to the
destination the user chose. The renderer only ever sees a path and a size.

### 3.6 The extension is decided **before** the save dialog

This is the decision that makes the rest honest. Before asking the user where
to save, the app asks the sidecar what it can do:

| Sidecar | Extension shown | What is written |
|---|---|---|
| FFmpeg present | the requested one (`.mp4`, `.mov`, …) | a real encoded file |
| FFmpeg absent | `.webm` | the raw capture, labelled as a preview |

So the user is never shown "my-video.mp4" and handed a WebM.

**FFmpeg is now bundled with the app**, so the first row is the normal case in
the desktop build and the second row applies to the browser build (and to a
desktop build whose bundled binaries are switched off with
`AIFIMORA_DISABLE_BUNDLED_TOOLS=1`).

### 3.7 The six controls are bound

The sheet becomes coherent in both directions:

- **Clicking a preset writes into the six selects** (resolution, fps, codec,
  container), so the sheet always shows what the preset will produce.
- **Changing a select switches the preset to "Custom"**, so the chip row never
  claims a preset that is no longer in effect.
- **`resolveExportConfig()` reads the selects** as the source of truth, falling
  back to the preset, then to `settings.exportDefaults`.

Two vocabularies meet here, and they must be bridged: the presets say
**`h265`**, the encoder control says **`hevc`**. Without a map, clicking
*"YouTube 4K — H.265"* would write **H.264** into the control (a select cannot
hold a value it does not have), and the file would be H.264 while the chip
claimed H.265 — exactly the dishonesty this whole build exists to remove. The
same gap made *"ProRes Proxy"* fall back to HEVC, because the sheet had no
ProRes option at all; it does now, and the encoder can really write
`prores_ks`. The Animated GIF preset's 15 fps needed its own option for the
same reason.

### 3.8 The honest fallback

When there is no encoder, the app still renders — and says what it made:

> **Quick preview export** · WebM · 1280×720 · with audio
> A real MP4 needs the desktop build with FFmpeg installed.

The label is *computed* from the actual capture: the real container, the real
canvas height, and whether the mix bus actually produced a track. It is never a
fixed string, because a fixed string lies as soon as one of those changes.

The same honesty applies when FFmpeg *is* present but the encode fails: the
capture is still saved, next to the destination, as a `.webm`, and the app says
*"FFmpeg could not produce the MP4 (<the real reason>); the raw capture was
saved instead."* A failed encode never destroys the render.

## 4. The honesty contract

| Claim the app makes | How it is kept true |
|---|---|
| "1920×1080" | The canvas is resized to 1920×1080 for the render, and the probe of the written file is checked against it. |
| "H.264" | The probe's `video.codec` is reported, not the requested codec. |
| "with audio" | The probe's `hasAudio` decides the wording. |
| "hardware" | Only claimed when the hardware encoder actually ran; otherwise the fallback is named. |
| "Quick preview export" | Used whenever the file is a raw capture, whatever it contains. |

## 5. Verification

**The encoder was first verified against stand-in tools** — the process spawn,
the argument construction, the probe of the output, the IPC and the file
delivery are all exercised; only the binary is replaced.

**Then FFmpeg was bundled, and the encoder was verified against the real
thing.** `ffmpeg-static@5.3.0` (FFmpeg 6.1.1) and `ffprobe-static@3.1.0` now
ship inside the app, so `verify-sidecar.cjs` has a group that runs the encoder
against the **actual binaries**: a real source is built from `lavfi`
(`testsrc` + `sine`), probed, and then re-encoded for real — MP4/H.264+AAC,
MP4/HEVC, WebM/VP9+Opus, MP4/AV1, MOV/ProRes, a two-pass GIF and an MP3 —
each one **written and probed back**, with the codec, resolution and audio
track asserted from the file rather than from the request.

The AV1 case is the one worth noting: this build has `libaom-av1` but **not**
`libsvtav1`, so the fallback chain had to take over — and the op names the
encoder that actually ran. The fallback is not theoretical any more.

| Suite | What it proves |
|---|---|
| `verify-sidecar.cjs` (encoder group, 28) | The `encode` op builds the right arguments for every codec and container; refuses honestly when ffmpeg is missing; probes its own output; reports the real codec/resolution/audio; falls back from NVENC to software **and says so**. |
| `verify-sidecar.cjs` (**the real tools**, 27) | **Real FFmpeg 6.1.1**: a real source built and probed; five real encodes written and probed back; the real AV1 fallback chain; a real two-pass GIF; a real MP3. |
| `verify-sidecar.cjs` (discovery group, 11) | The bundled statics resolve to the **binary** (not the package's `index.js`), can be switched off with `AIFIMORA_DISABLE_BUNDLED_TOOLS=1`, and the **unpacked** copy is preferred over a path still inside an asar. |
| `verify-sidecar.cjs` (Electron group, 15) | The renderer can hand a capture to the encoder and get a file back at the destination. |
| `verify-wave0.cjs` (new checks) | The six controls are bound: changing each one changes the resolved config; clicking a preset writes into the selects; the fallback is labelled with its real format and resolution; **the mix bus records even when the timeline is silent, and the recording decodes as audio**. |
| `verify-export22.cjs` (strengthened) | The export **writes a file with real content**, reports success, says what it produced, and uses the extension this build can really deliver. |
| `verify-all.cjs` | The whole suite, against the 44/54 baseline — no regressions. |

**Still not proved:** that the *installed* app finds the binaries at
`app.asar.unpacked`. The packaging was built and measured, but the installed
copy was not launched. And real-world footage — a genuine MXF from a camera —
has not been pushed through it; the source used here is generated by FFmpeg.

## 6. Explicitly out of scope

- **LUFS normalisation (APP-025).** `js/loudness.js` exists and can drive
  −14/−16/−23 LUFS targets, but that is a separate roadmap item. This build
  makes the mix bus exist; it does not normalise it.
- **A WebCodecs pipeline.** The FFmpeg sidecar is the encoder for now.
- **Caption burn-in.** The sheet mentions it; it is not part of R1–R6.
