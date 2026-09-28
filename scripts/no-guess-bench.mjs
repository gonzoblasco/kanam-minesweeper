// scripts/no-guess-bench.mjs - F1.1: measure the no-guess rejection cost IN THE BROWSER.
//
// Why this exists: MIND measured 64 ms/board in Node, but the plan (F1.1) says the
// browser cost is the unmeasured number that decides whether the rejection
// approach is viable. Node startup and its JIT warmup are not the browser's.
//
// It serves the project root over HTTP and runs the rejection loop inside Chromium
// (the same engine as the e2e), timing it with performance.now().
//
// Usage: node scripts/no-guess-bench.mjs [N]

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const N = Number(process.argv[2] || 100);

async function playwright() {
  try {
    return await import("playwright-core");
  } catch {
    const req = createRequire("/Users/gonzoblasco/projects/kanam-fixer-v2/");
    return req("playwright-core");
  }
}

const MIME = { ".js": "text/javascript", ".mjs": "text/javascript", ".html": "text/html", ".css": "text/css", ".json": "application/json" };

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    let path = decodeURIComponent(url.pathname);
    if (path === "/") path = "/index.html";
    const file = join(ROOT, normalize(path).replace(/^(\.\.[/\\])+/, ""));
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end("not found");
  }
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${server.address().port}`;

const { chromium } = await playwright();
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });

const result = await page.evaluate(async (iterations) => {
  const game = await import("/src/core/game.js");
  const logic = await import("/src/core/logic.js");
  const rng = await import("/src/core/rng.js");
  const presets = await import("/src/core/presets.js");

  const rows = [];
  for (const [id, preset] of Object.entries(presets.PRESETS)) {
    const times = [];
    let attemptsTotal = 0;
    let maxAttempts = 0;
    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      let attempts = 0;
      let ok = false;
      while (attempts < 200) {
        attempts++;
        const seed = rng.deriveSeed ? rng.deriveSeed(i, attempts) : i * 31 + attempts;
        const g = game.reveal(game.createGame(preset), Math.floor((preset.width * preset.height) / 2), rng.createRng(seed));
        if (logic.solveLogically(g).solved) { ok = true; break; }
      }
      times.push(performance.now() - t0);
      attemptsTotal += attempts;
      if (attempts > maxAttempts) maxAttempts = attempts;
      if (!ok) { /* fallback counted below */ }
    }
    times.sort((a, b) => a - b);
    const p = (q) => times[Math.min(times.length - 1, Math.floor(q * times.length))];
    rows.push({
      preset: id,
      n: iterations,
      p50: +p(0.5).toFixed(2),
      p95: +p(0.95).toFixed(2),
      max: +times[times.length - 1].toFixed(2),
      avgAttempts: +(attemptsTotal / iterations).toFixed(2),
      maxAttempts,
    });
  }
  return { ua: navigator.userAgent, rows };
}, N);

console.log(`Engine: ${result.ua}`);
console.log(`N=${N} boards per preset\n`);
console.log("preset   p50(ms)  p95(ms)  max(ms)  avgAttempts  maxAttempts");
for (const r of result.rows) {
  console.log(
    `${r.preset.padEnd(8)} ${String(r.p50).padStart(7)} ${String(r.p95).padStart(8)} ${String(r.max).padStart(8)} ${String(r.avgAttempts).padStart(12)} ${String(r.maxAttempts).padStart(12)}`,
  );
}
const worst = result.rows.find((r) => r.preset.toLowerCase().includes("hard") || r.preset.toLowerCase().includes("diff")) || result.rows[result.rows.length - 1];
console.log(`\nVerdict (gate F1.1: p95 <= 250 ms in the hardest preset): ${worst.p95 <= 250 ? "PASS" : "FAIL"} (${worst.preset} p95 = ${worst.p95} ms)`);

await browser.close();
server.close();
