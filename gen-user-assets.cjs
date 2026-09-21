/* gen-user-assets.cjs — regenerate the user-asset folders the app fetches from
 * `assets/` but that are absent from the Filmora install dump:
 *
 *   • assets/shapes/manifest.json + SVG shapes        (shapes.js rescan)
 *   • assets/transitions/manifest.json + wipe PNGs    (transitions-ui.js rescan)
 *   • assets/Captions/Texttures/TexturePreset/*.png   (assets-bridge CAPTION_TEXTURES)
 *   • assets/configs/Transition/Default Transitions/<name>/thumbnail.png (filmora-library)
 *   • assets/AIClip|AINanoBanana|AIWatermark samples  (AI_SAMPLES + assets-browser)
 *   • assets/UpgradeGuide/resources/motion_blur.png   (assets-browser)
 *
 * Dependency-free: writes valid PNGs via zlib + a hand-rolled CRC32.
 * Re-run: node gen-user-assets.cjs */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const ROOT = path.join(__dirname, "assets");

/* ---------------- minimal PNG encoder -------------------------------------------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

/* ---------------- tiny drawing surface ------------------------------------------- */
class Img {
  constructor(w, h) { this.w = w; this.h = h; this.d = Buffer.alloc(w * h * 4); }
  set(x, y, c) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = c[3] ?? 255;
  }
  mix(x, y, c, k) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    this.d[i] = this.d[i] * (1 - k) + c[0] * k;
    this.d[i + 1] = this.d[i + 1] * (1 - k) + c[1] * k;
    this.d[i + 2] = this.d[i + 2] * (1 - k) + c[2] * k;
    this.d[i + 3] = Math.max(this.d[i + 3], (c[3] ?? 255) * k);
  }
  save(rel) {
    const p = path.join(ROOT, ...rel.split("/"));
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, encodePNG(this.w, this.h, this.d));
    console.log("  wrote", rel, `${this.w}x${this.h}`);
  }
}

/* ---------------- palette + pattern helpers -------------------------------------- */
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const mixc = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, 255];
let seed = 12345;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

function vgrad(img, stops) { // stops: [[pos,color],...]
  for (let y = 0; y < img.h; y++) {
    const t = y / (img.h - 1);
    let i = 0;
    while (i < stops.length - 2 && t > stops[i + 1][0]) i++;
    const [p0, c0] = stops[i], [p1, c1] = stops[i + 1];
    const k = p1 === p0 ? 0 : Math.min(1, Math.max(0, (t - p0) / (p1 - p0)));
    const c = mixc(c0, c1, k);
    for (let x = 0; x < img.w; x++) img.set(x, y, c);
  }
}
function dgrad(img, c1, c2) {
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) img.set(x, y, mixc(c1, c2, (x / img.w + y / img.h) / 2));
}
function radial(img, cx, cy, r0, r1, c0, c1) {
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const d = Math.hypot(x - cx, y - cy);
    img.set(x, y, mixc(c0, c1, Math.min(1, Math.max(0, (d - r0) / (r1 - r0)))));
  }
}
function speckle(img, amount) {
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const i = (y * img.w + x) * 4;
    const n = (rnd() - 0.5) * amount;
    for (let k = 0; k < 3; k++) {
      const v = img.d[i + k] + n * (96 + img.d[i + k] * 0.4);
      img.d[i + k] = Math.max(0, Math.min(255, v));
    }
  }
}

/* ---------------- caption textures (assets/Captions/Texttures/TexturePreset) ------ */
const TEXTURES = {
  "abstract1.png": (im) => { vgrad(im, [[0, hex("#3a2c5f")], [0.5, hex("#7a4fb0")], [1, hex("#e88fb0")]]); for (let i = 0; i < 24; i++) radial(im, rnd() * im.w, rnd() * im.h, 0, 8 + rnd() * 40, [255, 255, 255, 26], [255, 255, 255, 0]); },
  "abstract2.png": (im) => { dgrad(im, hex("#0f3057"), hex("#00587a")); for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) if ((x + y * 2) % 53 < 3) im.mix(x, y, [255, 255, 255], 0.08); },
  "abstract4.png": (im) => { radial(im, im.w * 0.3, im.h * 0.35, 0, im.w * 0.8, hex("#ff9966"), hex("#ff5e62")); radial(im, im.w * 0.75, im.h * 0.7, 0, im.w * 0.55, hex("#ffd194"), [0, 0, 0, 0]); },
  "abstract5.png": (im) => { vgrad(im, [[0, hex("#134e5e")], [1, hex("#71b280")]]); for (let i = 0; i < 40; i++) { const x = rnd() * im.w, y = rnd() * im.h, r = 4 + rnd() * 26; for (let a = 0; a < 6.28; a += 0.05) im.mix(x + Math.cos(a) * r, y + Math.sin(a) * r, [255, 255, 255], 0.05); } },
  "marble3.png": (im) => { vgrad(im, [[0, hex("#e8e8e8")], [1, hex("#c9cdd2")]]); for (let v = 0; v < 12; v++) { const y0 = rnd() * im.h, amp = 6 + rnd() * 14; for (let x = 0; x < im.w; x++) { const y = y0 + Math.sin(x / 26 + v) * amp; for (let t = -2; t <= 2; t++) im.mix(x, y + t, hex("#6b7076"), 0.35 - Math.abs(t) * 0.12); } } },
  "noise1.png": (im) => { dgrad(im, hex("#3c3f45"), hex("#22252a")); speckle(im, 0.9); },
  "paper3.png": (im) => { vgrad(im, [[0, hex("#f5efdf")], [1, hex("#e6dcc3")]]); speckle(im, 0.25); },
  "paper4.png": (im) => { vgrad(im, [[0, hex("#f2f2ee")], [1, hex("#dcdcd4")]]); for (let y = 0; y < im.h; y += 3) for (let x = 0; x < im.w; x++) im.mix(x, y, [180, 175, 160], 0.05); speckle(im, 0.15); },
  "paper5.png": (im) => { dgrad(im, hex("#efe7da"), hex("#d9c9b2")); speckle(im, 0.2); for (let i = 0; i < 300; i++) im.mix(rnd() * im.w, rnd() * im.h, [120, 100, 80], 0.12); },
  "plastic4.png": (im) => { vgrad(im, [[0, hex("#4a90d9")], [0.5, hex("#2f6fb8")], [1, hex("#1d4f8f")]]); for (let x = 0; x < im.w; x++) { const k = 1 - Math.abs(x - im.w * 0.35) / (im.w * 0.35); if (k > 0) for (let y = 0; y < im.h * 0.4; y++) im.mix(x, y, [255, 255, 255], 0.10 * k * (1 - y / (im.h * 0.4))); } },
  "plastic5.png": (im) => { vgrad(im, [[0, hex("#8e2de2")], [1, hex("#4a00e0")]]); for (let x = 0; x < im.w; x++) { const k = 1 - Math.abs(x - im.w * 0.6) / (im.w * 0.3); if (k > 0) for (let y = 0; y < im.h * 0.35; y++) im.mix(x, y, [255, 255, 255], 0.10 * k); } },
  "tetxile5.png": (im) => { vgrad(im, [[0, hex("#7a6a55")], [1, hex("#57493a")]]); for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) if (((x % 6) < 3) !== ((y % 6) < 3)) im.mix(x, y, [255, 255, 255], 0.10); },
  "textile1.png": (im) => { dgrad(im, hex("#314755"), hex("#263238")); for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++) if (Math.sin(x / 3) * Math.sin(y / 3) > 0.6) im.mix(x, y, [255, 255, 255], 0.07); },
  "textile3.png": (im) => { vgrad(im, [[0, hex("#870000")], [1, hex("#5a0000")]]); for (let y = 0; y < im.h; y += 4) for (let x = ((y / 4) % 2) * 2; x < im.w; x += 4) im.mix(x, y, [255, 200, 160], 0.08); },
  "textile4.png": (im) => { dgrad(im, hex("#1f4037"), hex("#3b8d6e")); for (let x = 0; x < im.w; x += 5) for (let y = 0; y < im.h; y++) im.mix(x, y, [0, 0, 0], 0.12); for (let y = 0; y < im.h; y += 5) for (let x = 0; x < im.w; x++) im.mix(x, y, [0, 0, 0], 0.12); },
};

function captionTextures() {
  console.log("caption textures:");
  for (const [name, draw] of Object.entries(TEXTURES)) {
    seed = 12345 + name.length * 977;
    const im = new Img(256, 256);
    draw(im);
    im.save("Captions/Texttures/TexturePreset/" + name);
  }
}


/* ---------------- built-in transition thumbnails (filmora-library) ---------------- */
function transitionThumbs() {
  console.log("built-in transition thumbnails:");
  const W = 320, H = 180;
  const a = hex("#2f6fb8"), b = hex("#e88fb0");
  const META = {
    "1_Dissolve": "Dissolve",
    "2_Fade": "Fade",
    "3_fade_white": "Fade White",
    "trans_default": "Transition",
  };
  const writePreview = (im, name) => {
    for (let y = 0; y < im.h; y++) for (let x = 0; x < im.w; x++)
      im.mix(x, y, [255, 255, 255], 0.06 * Math.sin(x / 9 + y / 7));
    im.save("configs/Transition/Default Transitions/" + name + "/preview.png");
    const meta = { display_name: META[name], category: "transition" };
    fs.writeFileSync(
      path.join(ROOT, "configs", "Transition", "Default Transitions", name, "title.json"),
      JSON.stringify(meta, null, 2) + "\n"
    );
    console.log("  wrote configs/Transition/Default Transitions/" + name + "/title.json");
  };
  // 1_Dissolve — checkerboard A/B blend
  {
    const im = new Img(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      im.set(x, y, mixc(a, b, ((x >> 4) + (y >> 3)) % 2 ? 0.15 : 0.85));
    im.save("configs/Transition/Default Transitions/1_Dissolve/thumbnail.png");
    writePreview(im, "1_Dissolve");
  }
  // 2_Fade — to black
  {
    const im = new Img(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) im.set(x, y, mixc(a, [0, 0, 0], x / W));
    im.save("configs/Transition/Default Transitions/2_Fade/thumbnail.png");
    writePreview(im, "2_Fade");
  }
  // 3_fade_white — to white
  {
    const im = new Img(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) im.set(x, y, mixc(b, [255, 255, 255], x / W));
    im.save("configs/Transition/Default Transitions/3_fade_white/thumbnail.png");
    writePreview(im, "3_fade_white");
  }
  // trans_default — diagonal wipe split
  {
    const im = new Img(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = (x / W + y / H) / 2;
      im.set(x, y, t < 0.5 ? mixc(a, b, t * 2) : mixc([250, 250, 250], b, (t - 0.5) * 2));
    }
    im.save("configs/Transition/Default Transitions/trans_default/thumbnail.png");
    writePreview(im, "trans_default");
  }
}

/* ---------------- custom wipe overlays (assets/transitions) ----------------------- */
function customTransitions() {
  console.log("custom transition wipes:");
  const W = 480, H = 270;
  { // gold-wipe
    const im = new Img(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = x / W;
      const edge = Math.min(1, Math.max(0, 1 - Math.abs(t - 0.72) * 8));
      const c = mixc(hex("#5c4300"), hex("#ffd700"), t);
      im.set(x, y, [c[0], c[1], c[2], Math.round(120 + 135 * edge)]);
    }
    im.save("transitions/gold-wipe.png");
  }
  { // blue-sweep
    const im = new Img(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const t = x / W;
      const edge = Math.min(1, Math.max(0, 1 - Math.abs(t - 0.65) * 6));
      const c = mixc(hex("#021b37"), hex("#3ddcff"), t);
      im.set(x, y, [c[0], c[1], c[2], Math.round(110 + 145 * edge)]);
    }
    im.save("transitions/blue-sweep.png");
  }
  { // ember-flash
    const im = new Img(W, H);
    radial(im, W * 0.62, H * 0.5, 0, W * 0.75, [255, 236, 190, 255], [180, 60, 10, 40]);
    for (let i = 0; i < 220; i++) im.mix(rnd() * W, rnd() * H, [255, 170, 60], 0.35 * rnd());
    im.save("transitions/ember-flash.png");
  }
  const manifest = {
    items: [
      { id: "gold-wipe", label: "Gold Wipe", src: "assets/transitions/gold-wipe.png", kind: "wipeOverlay" },
      { id: "blue-sweep", label: "Blue Sweep", src: "assets/transitions/blue-sweep.png", kind: "wipeOverlay" },
      { id: "ember-flash", label: "Ember Flash", src: "assets/transitions/ember-flash.png", kind: "wipeOverlay" },
    ],
  };
  fs.writeFileSync(path.join(ROOT, "transitions", "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log("  wrote transitions/manifest.json (3 items)");
}


/* ---------------- shapes (assets/shapes) ------------------------------------------ */
const SHAPES = {
  "gold-star.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 5l12.6 29.6 32.1 2.9-24.2 21.3 7.1 31.5L50 73.2 22.4 90.3l7.1-31.5L5.3 37.5l32.1-2.9z" fill="#f5c518" stroke="#a87d00" stroke-width="3"/></svg>`,
  "heart.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 88C22 66 8 50 8 33 8 20 18 10 31 10c9 0 16 5 19 12 3-7 10-12 19-12 13 0 23 10 23 23 0 17-14 33-42 56z" fill="#e84855" stroke="#8f1d2c" stroke-width="3"/></svg>`,
  "arrow-right.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 60"><path d="M6 22h84V6l42 24-42 24V38H6z" fill="#3ddcff" stroke="#0b6a8f" stroke-width="3"/></svg>`,
  "burst.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50 2l9 22 20-13-6 23 24 2-18 15 18 15-24 2 6 23-20-13-9 22-9-22-20 13 6-23-24-2 18-15-18-15 24-2-6-23 20 13z" fill="#ff8c42" stroke="#b34700" stroke-width="3"/></svg>`,
  "badge-circle.svg": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="#00d4a0" stroke="#046d57" stroke-width="4"/><circle cx="50" cy="50" r="28" fill="none" stroke="#ffffff" stroke-width="4" opacity="0.7"/></svg>`,
};

function shapes() {
  console.log("shapes:");
  for (const [name, svg] of Object.entries(SHAPES)) {
    const p = path.join(ROOT, "shapes", name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, svg.trim() + "\n");
    console.log("  wrote shapes/" + name);
  }
  const manifest = {
    items: [
      { id: "gold-star", label: "Gold Star", src: "assets/shapes/gold-star.svg", kind: "image" },
      { id: "heart", label: "Heart", src: "assets/shapes/heart.svg", kind: "image" },
      { id: "arrow-right", label: "Arrow Right", src: "assets/shapes/arrow-right.svg", kind: "image" },
      { id: "burst", label: "Burst", src: "assets/shapes/burst.svg", kind: "image" },
      { id: "badge-circle", label: "Badge", src: "assets/shapes/badge-circle.svg", kind: "image" },
    ],
  };
  fs.writeFileSync(path.join(ROOT, "shapes", "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  console.log("  wrote shapes/manifest.json (5 items)");
}

/* ---------------- AI sample cards + motion blur ref ------------------------------- */
function aiSamples() {
  console.log("AI sample cards:");
  const W = 420, H = 276;
  const card = (im, c1, c2, blob) => {
    dgrad(im, c1, c2);
    radial(im, W * 0.68, H * 0.38, 0, W * 0.32, [255, 255, 255, 200], [255, 255, 255, 0]);
    radial(im, W * 0.32, H * 0.62, 0, W * 0.4, blob.concat([180]), [0, 0, 0, 0]);
    for (let i = 0; i < 26; i++) im.mix(rnd() * W, rnd() * H, [255, 255, 255], 0.14 * rnd());
  };
  const gen = (dir, file, c1, c2, blob) => {
    seed = file.length * 613;
    const im = new Img(W, H);
    card(im, hex(c1), hex(c2), hex(blob));
    im.save(dir + "/" + file);
  };
  gen("AIClip", "ColorPaletteSwap1.png", "#1a2a6c", "#b21f1f", "#fdbb2d");
  gen("AIClip", "Fashion1.png", "#41295a", "#2F0743", "#ff6ec4");
  gen("AIClip", "Figurine1.png", "#0f2027", "#2c5364", "#00d4a0");
  gen("AINanoBanana", "ColorPaletteSwap1.png", "#134e5e", "#71b280", "#ffd700");
  gen("AINanoBanana", "Fashion1.png", "#42275a", "#734b6d", "#3ddcff");
  gen("AINanoBanana", "Figurine1.png", "#141e30", "#243b55", "#ff8c42");
  gen("AIWatermark", "PreviewWaterMark.png", "#0b0d10", "#5B8CFF", "#00D4A0");
  { // motion blur reference
    seed = 42;
    const im = new Img(W, H);
    dgrad(im, hex("#101318"), hex("#2a2f3a"));
    for (let i = 0; i < 5; i++) {
      const y = H * (0.2 + i * 0.15);
      for (let x = 0; x < W; x++) {
        const spread = 3 + (x / W) * 26;
        for (let t = -spread; t <= spread; t++) im.mix(x, y + t, [120, 170, 255], 0.05);
      }
    }
    im.save("UpgradeGuide/resources/motion_blur.png");
  }
}
/* ---------------- TextArt thumbnails + remaining browser candidates --------------- */
function textArtThumbnails() {
  console.log("TextArt thumbnails (assets/TextArtThumbnail):");
  const names = ["abstract1.png", "abstract2.png", "abstract4.png", "abstract5.png", "marble3.png",
    "noise1.png", "paper3.png", "paper4.png", "plastic4.png"];
  for (const name of names) {
    const draw = TEXTURES[name];
    if (!draw) continue;
    seed = 555 + name.length * 31;
    const im = new Img(160, 90);
    draw(im);
    im.save("TextArtThumbnail/" + name);
  }
  // gold-star.svg copy for the same gallery
  fs.mkdirSync(path.join(ROOT, "TextArtThumbnail"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "shapes", "gold-star.svg"), path.join(ROOT, "TextArtThumbnail", "gold-star.svg"));
  console.log("  wrote TextArtThumbnail/gold-star.svg (copy)");
  // assets-browser "AI music cover" candidate
  seed = 77;
  const im = new Img(420, 276);
  dgrad(im, hex("#5B8CFF"), hex("#0b0d10"));
  radial(im, 210, 138, 20, 150, [0, 212, 160, 220], [0, 0, 0, 0]);
  for (let x = 0; x < 420; x += 12) for (let y = 180; y < 260; y += 14) {
    const h = 20 + ((x * 7 + y * 3) % 50);
    for (let t = 0; t < h; t++) im.mix(x, y - t, [255, 255, 255], 0.10);
  }
  im.save("UpgradeGuide/resources/ai_music.png");
}

/* ---------------- main ------------------------------------------------------------ */
console.log("gen-user-assets: regenerating user asset folders under assets/");
captionTextures();
transitionThumbs();
customTransitions();
shapes();
aiSamples();
textArtThumbnails();
console.log("done.");


