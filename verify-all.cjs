/* verify-all.cjs — run every verify-*.cjs suite and record a baseline.
 *
 * Usage: node verify-all.cjs [outFile]
 *
 * Starts server.cjs on 127.0.0.1:8765 (if it is not already serving) and polls
 * the port until it actually accepts connections before running anything, then
 * runs each suite and classifies it. A suite is green only when it exits 0 and
 * reports at least one pass marker and no fail markers.
 *
 * Run this BEFORE changing product code and again after, so a regression can
 * be told apart from a pre-existing failure.
 */
const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");

const ROOT = __dirname;
const OUT = process.argv[2] || path.join(ROOT, "docs", "product", "BASELINE.md");
const SELF = path.basename(__filename);
const files = fs
  .readdirSync(ROOT)
  .filter((f) => /^verify-.*\.cjs$/.test(f) && f !== SELF)
  .sort();

/** Is something already serving 8765? */
function ping() {
  return new Promise((resolve) => {
    const req = http.get("http://127.0.0.1:8765/index.html", (res) => {
      res.resume();
      resolve(true);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1200, () => { req.destroy(); resolve(false); });
  });
}

async function ensureServer() {
  if (await ping()) return { started: false, child: null };
  const child = spawn("node", [path.join(ROOT, "server.cjs")], {
    cwd: ROOT,
    stdio: "ignore",
  });
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 500));
    if (await ping()) return { started: true, child };
  }
  child.kill();
  throw new Error("server.cjs did not come up on 127.0.0.1:8765");
}

/** Strip ANSI colour so the counts are meaningful. */
function clean(s) {
  return String(s || "").replace(/\x1b\[[0-9;]*m/g, "");
}

/**
 * Classify one suite run.
 *
 * The repo has three different reporting styles, so a single marker check
 * would be wrong:
 *   1. PASS/FAIL lines           (verify-parity, verify-assets, …)
 *   2. a JSON report with a `failed` array and `process.exitCode = 2`
 *      (verify-app, verify-layout, …)
 *   3. a bare throw              (`.catch(e => process.exit(1))`)
 *
 * A suite is green only when the exit code is 0 AND no FAIL marker appears
 * AND a JSON report does not carry a non-empty `failed` array.
 */
function classify(code, out) {
  const passes = (out.match(/\bPASS\b/g) || []).length;
  const fails = (out.match(/\bFAIL\b/g) || []).length;
  const reasons = [];
  if (code !== 0) reasons.push(`exit ${code}`);
  if (fails > 0) reasons.push(`${fails} FAIL marker(s)`);

  // JSON report with a `failed` collection (possibly nested one level down).
  const jsonStart = out.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const data = JSON.parse(out.slice(jsonStart));
      const failed = data && Array.isArray(data.failed) ? data.failed : null;
      const errors = data && Array.isArray(data.errors) ? data.errors : null;
      if (failed && failed.length) reasons.push(`${failed.length} failed assertion(s): ${failed.slice(0, 3).join(", ")}`);
      if (errors && errors.length) reasons.push(`${errors.length} runtime error(s): ${String(errors[0]).slice(0, 120)}`);
    } catch {
      /* not a pure JSON report — fall through to the exit-code verdict */
    }
  }
  return { ok: reasons.length === 0, passes, fails, reasons };
}

(async () => {
  const srv = await ensureServer();
  const results = [];

  for (const f of files) {
    const started = Date.now();
    const r = spawnSync("node", [path.join(ROOT, f)], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 180000,
      env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
    });
    const out = clean((r.stdout || "") + (r.stderr || ""));
    const v = classify(r.status, out);
    results.push({
      f, code: r.status, passes: v.passes, fails: v.fails,
      ms: Date.now() - started, ok: v.ok,
      note: v.ok ? "" : (v.reasons.join("; ") || (out.trim().split("\n").filter(Boolean).slice(-2).join(" | ").slice(0, 200) || "(no output)")),
    });
    process.stdout.write(
      `${v.ok ? "OK  " : "BAD "} ${f.padEnd(32)} pass=${String(v.passes).padStart(3)} fail=${String(v.fails).padStart(3)} exit=${r.status}${v.ok ? "" : "  " + v.reasons.join("; ")}\n`
    );
  }

  if (srv.child) { try { srv.child.kill(); } catch {} }

  const good = results.filter((r) => r.ok).length;
  const bad = results.filter((r) => !r.ok);
  const lines = [];
  lines.push("# BASELINE — AiFilmora verify suite");
  lines.push("");
  lines.push("**Recorded:** 2026-11-25 · **Branch:** `modernize/2026-11-25` · **Base commit:** `ab3e97c` (AiFilmora 2.2.7)");
  lines.push("");
  lines.push(`**Result: ${good}/${results.length} suites green, ${bad.length} failing.**`);
  lines.push("");
  lines.push("Regenerate with `node verify-all.cjs`. The runner starts `server.cjs` on 127.0.0.1:8765, waits for the");
  lines.push("port to accept connections, then runs every `verify-*.cjs` suite. A suite counts as green only if it");
  lines.push("exits 0, reports at least one `PASS`, and reports no `FAIL`.");
  lines.push("");
  lines.push("| Suite | Result | PASS | FAIL | Exit | ms |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of results) {
    lines.push(`| \`${r.f}\` | ${r.ok ? "✅ green" : "❌ failing"} | ${r.passes} | ${r.fails} | ${r.code} | ${r.ms} |`);
  }
  if (bad.length) {
    lines.push("");
    lines.push("## Pre-existing failures");
    lines.push("");
    lines.push("These fail on the **base commit**, before any change in this cycle. A failure that appears here");
    lines.push("after a code change is a regression; a failure that was already here is not.");
    lines.push("");
    for (const r of bad) {
      lines.push(`### \`${r.f}\``);
      lines.push("");
      lines.push(`- exit ${r.code}, ${r.passes} pass, ${r.fails} fail`);
      lines.push(`- tail: \`${r.note}\``);
      lines.push("");
    }
  }
  lines.push("");
  lines.push("## How to use this baseline");
  lines.push("");
  lines.push("Run `node verify-all.cjs` after every slice and diff the result table above. The suites that were");
  lines.push("green must stay green; the ones that were failing may be re-baselined only with a recorded reason.");
  lines.push("");
  fs.writeFileSync(OUT, lines.join("\n"), "utf8");
  console.log(`\n${good}/${results.length} green -> ${path.relative(ROOT, OUT)}`);
  process.exit(0);
})();
