// E2E real en navegador (Chromium via Playwright-core) sobre el build de dist/.
//
// Verifica que el juego carga, que se puede jugar de verdad y que la pista
// explica. No es una suposicion: abre la pagina, mira el DOM y actua.
//
// Uso: node scripts/e2e.mjs [baseDir]
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const DIST = process.argv[2] || "dist";
const PORT = 8117;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    let path = decodeURIComponent(url.pathname);
    if (path === "/") path = "/index.html";
    const file = normalize(join(DIST, path));
    if (!file.startsWith(normalize(DIST))) {
      res.writeHead(403).end("forbidden");
      return;
    }
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});

await new Promise((r) => server.listen(PORT, r));

let chromium;
try {
  ({ chromium } = await import("playwright-core"));
} catch {
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error("E2E SKIP: no hay playwright-core ni playwright instalados.");
    server.close();
    process.exit(3);
  }
}

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` - ${detail}` : ""}`);
}

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

await page.goto(`http://localhost:${PORT}/`, { waitUntil: "load" });
await page.waitForSelector('[role="grid"]', { timeout: 10000 });

const cells = await page.locator('[role="gridcell"]').count();
check("grid rendered", cells === 81, `${cells} cells (expect 81 for easy 9x9)`);

// Primer clic seguro: revelar una celda del centro por teclado.
const grid = page.locator('[role="gridcell"]');
await grid.nth(40).click();
await page.waitForTimeout(150);

const revealedAfterFirstClick = await page
  .locator('[role="gridcell"][data-state="revealed"]')
  .count();
check("first click reveals", revealedAfterFirstClick > 0, `${revealedAfterFirstClick} revealed`);

// Jugar: revelar por teclado (flechas + Enter).
await page.keyboard.press("ArrowRight");
await page.keyboard.press("ArrowDown");
await page.keyboard.press("Enter");
await page.waitForTimeout(100);

// Pedir una pista y ver que aparezca texto explicativo.
const hintBtn = page.locator("button", { hasText: /pista/i }).first();
let hintText = "";
if (await hintBtn.count()) {
  await hintBtn.click();
  await page.waitForTimeout(200);
  const hintRegion = page.locator('[data-hint-text], #hint, .hint').first();
  hintText = (await hintRegion.count()) ? (await hintRegion.innerText()) : "";
  check("hint produces explanatory text", hintText.trim().length > 15, hintText.slice(0, 120));
} else {
  check("hint button exists", false, "no button matching /pista/i");
}

// Estado accesible presente.
const live = await page.locator('[aria-live]').count();
check("aria-live status region", live > 0, `${live} region(s)`);

// Service worker registrado (solo produccion).
const sw = await page.evaluate(async () => {
  if (!("serviceWorker" in navigator)) return "no-api";
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? "registered" : "none";
});
check("service worker registration", sw === "registered" || sw === "no-api", sw);

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
server.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
