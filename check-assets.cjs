/* check-assets.cjs — verify every `assets/...` path pinned in the JS sources
 * actually exists on disk. Run: node check-assets.cjs */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const files = fs.readdirSync(path.join(ROOT, "js")).filter((f) => f.endsWith(".js"));
const allRefs = new Map(); // ref -> [where]

for (const f of files) {
  const src = fs.readFileSync(path.join(ROOT, "js", f), "utf8");
  const re = /["'`](assets\/[^"'`]+)["'`]/g;
  let m;
  while ((m = re.exec(src))) {
    const ref = m[1];
    if (!allRefs.has(ref)) allRefs.set(ref, []);
    allRefs.get(ref).push(f);
  }
}

// Also verify FONT_FILES entries in assets-bridge.js (they are bare filenames)
const bridge = fs.readFileSync(path.join(ROOT, "js", "assets-bridge.js"), "utf8");
const fontBlock = bridge.match(/const FONT_FILES = \[([\s\S]*?)\];/);
const fontRefs = [];
if (fontBlock) {
  const re = /"([^"]+)"/g;
  let m;
  while ((m = re.exec(fontBlock[1]))) fontRefs.push(m[1]);
}

let missing = [];
let ok = 0;
for (const [ref, where] of allRefs) {
  if (ref.includes("{") || ref.includes("}")) continue; // comment pseudo-paths
  const p = path.join(ROOT, decodeURIComponent(ref));
  if (fs.existsSync(p)) ok++;
  else missing.push(`${ref}   ←  ${where.slice(0, 3).join(", ")}${where.length > 3 ? ` +${where.length - 3}` : ""}`);
}
let fontMissing = [];
let fontOk = 0;
for (const f of fontRefs) {
  if (fs.existsSync(path.join(ROOT, "assets", "Fonts", f))) fontOk++;
  else fontMissing.push(f);
}

console.log(`JS path refs: ${ok} ok, ${missing.length} missing`);
missing.sort().forEach((m) => console.log("  MISSING " + m));
console.log(`Font files: ${fontOk} ok, ${fontMissing.length} missing`);
fontMissing.sort().forEach((f) => console.log("  MISSING FONT " + f));

// summary by top dir
const byDir = {};
for (const m of missing) {
  const parts = m.split(/[\\/]/);
  const key = parts.slice(0, 2).join("/");
  byDir[key] = (byDir[key] || 0) + 1;
}
console.log("\nMissing by area:", JSON.stringify(byDir, null, 1));
