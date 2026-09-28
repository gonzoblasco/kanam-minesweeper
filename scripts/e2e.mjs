// E2E real en navegador (Chromium via Playwright-core) sobre el build de dist/.
//
// No es una suposicion: abre la pagina, mira el DOM y juega de verdad. Verifica
// que el tablero se puede manejar con mouse y teclado, que las pistas explican
// y que la partida avanza jugando solo con los hints como guia.
//
// Uso: node scripts/e2e.mjs [baseDir]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
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
    // Fallback: resolve from a sibling project or an explicit env var, so this
    // script works without adding a runtime dependency to the game itself.
    const { createRequire } = await import("node:module");
    const candidates = [
      process.env.PLAYWRIGHT_CORE_DIR,
      "/Users/gonzoblasco/projects/kanam-fixer-v2",
      "/Users/gonzoblasco/projects/kanam-fixer",
    ].filter(Boolean);
    for (const dir of candidates) {
      try {
        const req = createRequire(`${dir}/`);
        ({ chromium } = req("playwright-core"));
        break;
      } catch {
        /* try the next candidate */
      }
    }
  } catch {
    /* fall through to the skip below */
  }
}

if (!chromium) {
  console.error("E2E SKIP: no hay playwright-core ni playwright instalados.");
  server.close();
  process.exit(3);
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

const cells = page.locator('[role="gridcell"]');
const count = await cells.count();
check("grid rendered", count === 81, `${count} cells (expect 81 for easy 9x9)`);

// Controles presentes.
for (const [id, label] of [
  ["#level-easy", "card de nivel Facil"],
  ["#level-medium", "card de nivel Medio"],
  ["#level-hard", "card de nivel Dificil"],
  ["#btn-new", "Nuevo campo"],
  ["#btn-restart", "Reiniciar"],
  ["#btn-pause", "Pausar"],
  ["#btn-hint", "Pista"],
  ["#btn-flag-mode", "Modo bandera"],
  ["#mine-counter", "contador de minas"],
  ["#timer", "cronometro"],
]) {
  const visible = await page.locator(id).isVisible();
  check(`control visible: ${label}`, visible, id);
}

// El nivel activo se marca con aria-checked, no solo con color.
const activeLevel = await page.locator('[role="radio"][aria-checked="true"]').count();
check("exactly one level card is aria-checked", activeLevel === 1, `${activeLevel} checked`);

// Dificultad: cambiar a Medio debe reconstruir la grilla en 16x16.
await page.locator("#level-medium").click();
 await page.waitForTimeout(120);
const mediumCells = await page.locator('[role="gridcell"]').count();
check("difficulty switch rebuilds the grid", mediumCells === 256, `${mediumCells} cells (expect 256)`);
check(
  "the active level follows the switch",
  (await page.locator("#level-medium").getAttribute("aria-checked")) === "true",
);
await page.locator("#level-easy").click();
await page.waitForTimeout(120);
check("back to easy", (await page.locator('[role="gridcell"]').count()) === 81);

// Primer clic seguro: revelar una celda del centro.
await page.locator('[role="gridcell"]').nth(40).click();
await page.waitForTimeout(150);
const revealedAfterFirstClick = await page.locator('[role="gridcell"][data-state="revealed"]').count();
check("first click reveals", revealedAfterFirstClick > 0, `${revealedAfterFirstClick} revealed`);

// Marcar con click derecho deja la celda en estado bandera.
const hiddenCell = page.locator('[role="gridcell"][data-state="hidden"]').first();
const hiddenIndex = await hiddenCell.getAttribute("data-index");
await hiddenCell.click({ button: "right" });
await page.waitForTimeout(80);
let flagged = await page.locator('[role="gridcell"][data-state="flagged"]').count();
check("right click plants a flag", flagged === 1, `${flagged} flagged`);
// El mismo click derecho la desmarca: prueba que el handler corre en vez del menu nativo.
await page.locator(`[role="gridcell"][data-index="${hiddenIndex}"]`).click({ button: "right" });
await page.waitForTimeout(80);
flagged = await page.locator('[role="gridcell"][data-state="flagged"]').count();
check("right click again removes the flag", flagged === 0, `${flagged} flagged`);

// Teclado: las flechas mueven el foco y Enter revela.
await page.locator('[role="gridcell"]').nth(0).focus();
const before = await page.evaluate(() => document.activeElement?.dataset?.index);
await page.keyboard.press("ArrowRight");
await page.keyboard.press("ArrowDown");
const after = await page.evaluate(() => document.activeElement?.dataset?.index);
check("arrow keys move focus", before === "0" && after === "10", `${before} -> ${after}`);

// Pausar / Continuar.
const pauseBtn = page.locator("#btn-pause");
await pauseBtn.click();
await page.waitForTimeout(60);
check("pause toggles the label", (await pauseBtn.innerText()).match(/continuar/i) !== null, await pauseBtn.innerText());
await pauseBtn.click();
await page.waitForTimeout(60);
check("resume toggles back", (await pauseBtn.innerText()).match(/pausar/i) !== null, await pauseBtn.innerText());

// Region aria-live con el estado accesible.
const live = await page.locator('[aria-live]').count();
check("aria-live status region", live > 0, `${live} region(s)`);

// Nuevo campo limpia el tablero.
await page.locator("#btn-new").click();
await page.waitForTimeout(120);
const freshRevealed = await page.locator('[role="gridcell"][data-state="revealed"]').count();
check("new game clears the board", freshRevealed === 0, `${freshRevealed} revealed after reset`);

// Teclado: F marca, F de nuevo desmarca, N alterna el modo bandera.
await page.locator('[role="gridcell"]').nth(0).focus();
await page.keyboard.press("f");
await page.waitForTimeout(60);
let keyFlagged = await page.locator('[role="gridcell"][data-index="0"][data-state="flagged"]').count();
check("F key plants a flag", keyFlagged === 1, `${keyFlagged} flagged`);
await page.keyboard.press("f");
await page.waitForTimeout(60);
keyFlagged = await page.locator('[role="gridcell"][data-index="0"][data-state="flagged"]').count();
check("F key removes the flag", keyFlagged === 0, `${keyFlagged} flagged`);

await page.keyboard.press("n");
await page.waitForTimeout(60);
const flagModeOn = await page.locator("#btn-flag-mode").getAttribute("aria-pressed");
check("N toggles flag mode", flagModeOn === "true", `aria-pressed=${flagModeOn}`);
// Con el modo bandera activo, un click normal marca en vez de revelar.
await page.locator('[role="gridcell"][data-index="1"]').click();
await page.waitForTimeout(60);
const modeFlagged = await page.locator('[role="gridcell"][data-index="1"][data-state="flagged"]').count();
check("flag mode turns a click into a flag", modeFlagged === 1, `${modeFlagged} flagged`);
await page.keyboard.press("n");
await page.waitForTimeout(60);
check("N toggles flag mode off", (await page.locator("#btn-flag-mode").getAttribute("aria-pressed")) === "false");

// Enter revela la celda enfocada.
await page.locator('[role="gridcell"]').nth(2).focus();
await page.keyboard.press("Enter");
await page.waitForTimeout(80);
const enterRevealed = await page.locator('[role="gridcell"][data-index="2"][data-state="revealed"]').count();
check("Enter reveals the focused cell", enterRevealed === 1, `${enterRevealed} revealed`);

// El cronometro avanza mientras se juega.
const timeBefore = await page.locator("#timer").innerText();
await page.waitForTimeout(1300);
const timeAfter = await page.locator("#timer").innerText();
check("timer advances", timeBefore !== timeAfter, `${timeBefore} -> ${timeAfter}`);

// --- Jugar de verdad guiandose solo por los hints ------------------------
// Tablero limpio: las banderas del jugador son parte de la premisa de la
// pista, asi que la partida guiada arranca sin marcas previas (las de la
// prueba de teclado eran a proposito y no corresponden a minas reales).
await page.locator("#btn-new").click();
await page.waitForTimeout(120);
// Pista: pide texto explicativo y resalta celdas con `data-hint="cell"`.
await page.locator('[role="gridcell"]').nth(40).click();
await page.waitForTimeout(120);
const hintBtn = page.locator("#btn-hint");
await hintBtn.click();
await page.waitForTimeout(150);
const hintText = await page.locator("#hint").innerText();
const hinted = await page.locator('[data-hint="cell"]').count();
check("hint produces explanatory text", hintText.trim().length > 15, hintText.slice(0, 120));
check("hint highlights its cells", hinted > 0, `${hinted} highlighted`);

let moves = 0;
let hintMoves = 0;
let won = false;
for (let step = 0; step < 140; step++) {
  const status = await page.locator("#status").innerText();
  if (/ganaste/i.test(status)) {
    won = true;
    break;
  }
  if (/perdiste/i.test(status)) break;

  await hintBtn.click();
  await page.waitForTimeout(40);
  const text = await page.locator("#hint").innerText();
  const targets = page.locator('[data-hint="cell"]');
  const n = await targets.count();
  if (n === 0) break; // no logical deduction left: need a guess
  const isMine = /es mina/i.test(text);
  const indexes = [];
  for (let k = 0; k < n; k++) {
    indexes.push(await targets.nth(k).getAttribute("data-index"));
  }
  for (const idx of indexes) {
    const cell = page.locator(`[role="gridcell"][data-index="${idx}"]`);
    if (isMine) await cell.click({ button: "right" });
    else await cell.click();
    moves++;
    hintMoves++;
  }
  await page.waitForTimeout(20);
}

const finalStatus = await page.locator("#status").innerText();
check(
  "playable with hints (progress made)",
  hintMoves > 0,
  `${hintMoves} hint-driven moves; final status: ${finalStatus.slice(0, 60)}`,
);
check("hint-driven play never loses", !/perdiste/i.test(finalStatus), finalStatus.slice(0, 60));
if (won) console.log(`INFO  la partida se gano usando solo los hints (${hintMoves} movimientos)`);
else console.log(`INFO  tablero no resuelto solo por logica con esos hints (${hintMoves} movimientos); el juego sigue en pie`);

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
