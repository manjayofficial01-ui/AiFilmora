/* Asset Browser — indexes Filmora assets/ + app asset packs */
import { store } from "./state.js";
import { toast, makeThumbDataURL } from "./media.js";

const ROOT = "assets";
const idx = { media: [], transitions: [], shapes: [], textStyles: [], packs: [] };

function fileUrl(p) {
  return p.replace(/\\/g, "/");
}

async function tryHead(url) {
  try {
    const r = await fetch(url, { method: "HEAD", cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}

async function tryJson(url) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

/** Index sample media that exists on disk (safe HEAD probes). */
async function scanMedia() {
  const candidates = [
    { name: "4K GPU Test", path: `${ROOT}/4KvideoforGPUtest1.mp4`, kind: "video" },
    { name: "Player Preview", path: `${ROOT}/WMPCheckMedia/WMPPlayerPreview.mp4`, kind: "video" },
    { name: "Image to Video demo", path: `${ROOT}/FFAIToolbox/Image to Video 420x276.mp4`, kind: "video" },
    { name: "AI Music demo", path: `${ROOT}/FFAIToolbox/AI Music 420-276.mp4`, kind: "video" },
    { name: "AI Sticker demo", path: `${ROOT}/FFAIToolbox/AI Sticker 420-276.mp4`, kind: "video" },
    { name: "Auto Reframe demo", path: `${ROOT}/FFAIToolbox/Auto Reframe 420-276.mp4`, kind: "video" },
    { name: "Text Based Editing", path: `${ROOT}/FFAIToolbox/AI Text Based Editing 420-276.mp4`, kind: "video" },
    { name: "Voice Cloning demo", path: `${ROOT}/FFAIToolbox/AI Voice Cloning 420-276.mp4`, kind: "video" },
    { name: "Fashion sample", path: `${ROOT}/AINanoBanana/Fashion1.png`, kind: "image" },
    { name: "Figurine sample", path: `${ROOT}/AINanoBanana/Figurine1.png`, kind: "image" },
    { name: "Palette swap", path: `${ROOT}/AINanoBanana/ColorPaletteSwap1.png`, kind: "image" },
    { name: "Woven overlay", path: `${ROOT}/resources/wfx_effect/nle_default/Woven/Data/Woven16_9.png`, kind: "image" },
    { name: "Motion blur ref", path: `${ROOT}/UpgradeGuide/resources/motion_blur.png`, kind: "image" },
    { name: "AI music cover", path: `${ROOT}/UpgradeGuide/resources/ai_music.png`, kind: "image" },
  ];
  const found = [];
  // Parallel HEAD (limit noise)
  await Promise.all(
    candidates.map(async (c) => {
      if (await tryHead(c.path)) found.push(c);
    })
  );
  idx.media = found;
  return found;
}

/** Filmora Default Transitions + our packs. */
async function scanTransitions() {
  const list = [];
  const folders = [
    "1_Dissolve",
    "2_Fade",
    "3_fade_white",
    "trans_default",
  ];
  const base = `${ROOT}/configs/Transition/Default Transitions`;
  for (const folder of folders) {
    const thumb = `${base}/${folder}/thumbnail.png`;
    const preview = `${base}/${folder}/preview.png`;
    const title = `${base}/${folder}/title.json`;
    const hasThumb = await tryHead(thumb);
    const hasPreview = await tryHead(preview);
    const meta = await tryJson(title);
    if (!hasThumb && !hasPreview) continue;
    list.push({
      id: "fw_" + folder,
      label: meta?.display_name || folder.replace(/^\d+_/, "").replace(/_/g, " "),
      thumb: hasThumb ? thumb : hasPreview ? preview : null,
      preview: hasPreview ? preview : hasThumb ? thumb : null,
      // map to built-in effect ids we can paint
      map: mapFilmoraTransition(folder),
      source: "filmora",
    });
  }

  // our custom pack
  const man = await tryJson(`${ROOT}/transitions/manifest.json`);
  if (man) {
    const items = Array.isArray(man) ? man : man.items || [];
    items.forEach((it) => {
      list.push({
        id: it.id || "cf_" + (it.label || list.length),
        label: it.label || it.name || "Custom",
        thumb: it.src || it.file,
        preview: it.src || it.file,
        map: "dissolve",
        source: "custom",
      });
    });
  }
  idx.transitions = list;
  return list;
}

function mapFilmoraTransition(folder) {
  const f = folder.toLowerCase();
  if (f.includes("white")) return "fw_fadewhite";
  if (f.includes("fade") && !f.includes("dissolve")) return "dipBlack";
  if (f.includes("dissolve")) return "dissolve";
  if (f.includes("flash")) return "flash";
  return "dissolve";
}

/** Text style texture thumbs (Filmora TextArtThumbnail). */
async function scanTextStyles() {
  const names = [
    "abstract1.png",
    "abstract2.png",
    "abstract4.png",
    "abstract5.png",
    "marble3.png",
    "noise1.png",
    "paper3.png",
    "paper4.png",
    "plastic4.png",
    "gold-star.svg",
  ];
  const base = `${ROOT}/TextArtThumbnail`;
  const found = [];
  await Promise.all(
    names.map(async (n) => {
      const path = `${base}/${n}`;
      if (await tryHead(path)) {
        found.push({
          id: "ts_" + n,
          label: n.replace(/\.\w+$/, "").replace(/([A-Z])/g, " $1").trim(),
          thumb: path,
        });
      }
    })
  );
  // also our shapes folder svgs
  const shapeMan = await tryJson(`${ROOT}/shapes/manifest.json`);
  if (shapeMan) {
    const items = Array.isArray(shapeMan) ? shapeMan : shapeMan.items || [];
    items.forEach((it) => {
      found.push({
        id: it.id || "sh_" + it.label,
        label: it.label || "Shape",
        thumb: it.src || it.file,
      });
    });
  }
  idx.textStyles = found;
  return found;
}

export async function scanAllAssets() {
  await Promise.all([scanMedia(), scanTransitions(), scanTextStyles()]);
  idx.packs = [
    { id: "filmora", label: "Filmora install pack", count: idx.transitions.length + idx.textStyles.length },
    { id: "app", label: "App asset packs", count: idx.media.length },
  ];
  return idx;
}

export function getAssetIndex() {
  return idx;
}

function formatDurGuess(kind) {
  return kind === "image" ? 4 : 8;
}

/** Insert an indexed media asset into the Media Bin + optional timeline. */
export function useMediaAsset(asset, { insert = true } = {}) {
  const existing = store.get().media.find((m) => m.url === asset.path);
  let media = existing;
  if (!media) {
    media = store.addMedia({
      name: asset.name,
      kind: asset.kind,
      duration: formatDurGuess(asset.kind),
      url: asset.path,
      thumb: asset.kind === "image" ? asset.path : makeThumbDataURL(Math.floor(Math.random() * 999), asset.name),
      generated: false,
      fromAssets: true,
    });
    toast(`Added “${asset.name}” to Media Bin`, "ok");
  }
  if (insert) {
    const trackId = asset.kind === "audio" ? "a1" : "v1";
    const start = Math.round((window.__aifimoraPlayhead || 0) * 10) / 10;
    const clip = store.addClip({
      mediaId: media.id,
      name: media.name,
      type: asset.kind === "audio" ? "audio" : "video",
      trackId,
      start,
      duration: media.duration || 4,
    });
    window.dispatchEvent(new CustomEvent("aifimora:seek", { detail: { time: start } }));
    window.dispatchEvent(new CustomEvent("aifimora:activate-clip", { detail: { clipId: clip.id } }));
    window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
  }
  return media;
}

export function initAssetBrowser() {
  const grid = document.getElementById("assetGrid");
  const cats = document.getElementById("assetCats");
  const status = document.getElementById("assetStatus");
  if (!grid) return;

  let cat = "media";

  const render = () => {
    grid.innerHTML = "";
    if (status) status.textContent = "Loading assets…";
    let html = "";
    if (cat === "media") {
      if (!idx.media.length) {
        html = `<div class="empty" style="grid-column:1/-1">No sample media found under <code>assets/</code>.</div>`;
      } else {
        idx.media.forEach((m) => {
          html += `
            <div class="media-card asset-card" data-asset-media="${escapeAttr(m.path)}" draggable="false" title="Click to add to bin + timeline">
              <img class="media-thumb" src="${escapeAttr(m.kind === "image" ? m.path : makeThumbDataURL(m.name.length, m.name))}" alt="" />
              <span class="media-badge">${m.kind}</span>
              <div class="media-meta"><strong>${escapeHtml(m.name)}</strong><span>assets pack</span></div>
            </div>`;
        });
      }
    } else if (cat === "transitions") {
      idx.transitions.forEach((t) => {
        html += `
          <div class="media-card asset-card" data-asset-trans="${escapeAttr(t.id)}" title="Hover preview · click to apply">
            ${t.thumb ? `<img class="media-thumb" src="${escapeAttr(t.thumb)}" alt="" />` : `<div class="media-thumb" style="background:linear-gradient(135deg,#1a1a1a,#c9a227)"></div>`}
            <span class="media-badge ai">${t.source}</span>
            <div class="media-meta"><strong>${escapeHtml(t.label)}</strong><span>${t.map}</span></div>
          </div>`;
      });
    } else if (cat === "styles") {
      idx.textStyles.forEach((t) => {
        html += `
          <div class="media-card asset-card" title="Text texture / shape asset">
            <img class="media-thumb" src="${escapeAttr(t.thumb)}" alt="" />
            <span class="media-badge">style</span>
            <div class="media-meta"><strong>${escapeHtml(t.label)}</strong><span>texture</span></div>
          </div>`;
      });
    }
    grid.innerHTML = html || `<div class="empty" style="grid-column:1/-1">Nothing here yet.</div>`;
    if (status) {
      status.textContent =
        cat === "media"
          ? `${idx.media.length} media · ${idx.transitions.length} transitions indexed`
          : cat === "transitions"
            ? `${idx.transitions.length} transitions from assets/`
            : `${idx.textStyles.length} text textures`;
    }

    grid.querySelectorAll("[data-asset-media]").forEach((el) => {
      el.addEventListener("click", () => {
        const path = el.dataset.assetMedia;
        const asset = idx.media.find((m) => m.path === path);
        if (asset) useMediaAsset(asset, { insert: true });
      });
    });
    grid.querySelectorAll("[data-asset-trans]").forEach((el) => {
      el.addEventListener("mouseenter", () => {
        const t = idx.transitions.find((x) => x.id === el.dataset.assetTrans);
        if (t) window.dispatchEvent(new CustomEvent("aifimora:preview-transition", { detail: { type: t.map, label: t.label } }));
      });
      el.addEventListener("click", () => {
        const t = idx.transitions.find((x) => x.id === el.dataset.assetTrans);
        const id = store.get().selectedClipId;
        if (!t) return;
        if (!id) return toast("Select a clip first", "err");
        import("./transitions.js").then(({ applyTransitionToClip }) => {
          applyTransitionToClip(store, id, t.map);
          store.updateClip(id, {
            outTransition: { type: t.map, duration: 0.6, label: t.label, customSrc: t.thumb },
          });
          toast(`Applied ${t.label}`, "ok");
          window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
        });
      });
    });
  };

  cats?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-asset-cat]");
    if (!btn) return;
    cat = btn.dataset.assetCat;
    cats.querySelectorAll("[data-asset-cat]").forEach((b) => b.classList.toggle("active", b === btn));
    render();
  });

  document.getElementById("btnRescanAssets")?.addEventListener("click", async () => {
    if (status) status.textContent = "Scanning assets/…";
    await scanAllAssets();
    render();
    toast("Asset pack rescanned", "ok");
  });

  scanAllAssets().then(() => {
    render();
    // seed media bin with a couple of real samples
    idx.media.slice(0, 3).forEach((m) => {
      const exists = store.get().media.some((x) => x.name === m.name);
      if (!exists) {
        store.addMedia({
          name: m.name,
          kind: m.kind,
          duration: formatDurGuess(m.kind),
          url: m.path,
          thumb: m.kind === "image" ? m.path : makeThumbDataURL(m.name.length + 1, m.name),
          fromAssets: true,
        });
      }
    });
    window.dispatchEvent(new CustomEvent("aifimora:timeline-dirty"));
  });
}

function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
