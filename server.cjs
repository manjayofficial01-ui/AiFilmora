/* server.cjs — static dev server on 127.0.0.1:8765 for the verify-*.cjs suite. */
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const MIME = {
  ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
  ".cjs": "text/javascript", ".mjs": "text/javascript", ".json": "application/json",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml", ".ttf": "font/ttf", ".otf": "font/otf",
  ".mp4": "video/mp4", ".cube": "text/plain", ".conf": "application/json",
  ".txt": "text/plain", ".xml": "text/xml", ".skin": "text/plain", ".svg": "image/svg+xml",
};

http.createServer((req, res) => {
  try {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(ROOT, ...p.split("/"));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    const data = fs.readFileSync(file);
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-cache",
    });
    res.end(data);
  } catch {
    res.writeHead(404); res.end("not found");
  }
}).listen(8765, "0.0.0.0", () => console.log("serving on http://0.0.0.0:8765"));
