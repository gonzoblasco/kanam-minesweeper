# SPEC - Kanam MINESWEEPER v1

<!-- project: github.com/gonzoblasco/kanam-minesweeper -->

Contrato de interfaces. **Los nombres, firmas y formas de datos de esta seccion
estan congelados**: las unidades se construyen en paralelo contra ellos y ningun
agente los cambia sin avisar al orquestador.

Reglas transversales:
- Cero dependencias de runtime. Solo `node --test` para tests.
- Codigo y tests **sin guion largo** (em dash / en dash): se usa guion comun `-`.
- UI en **espanol**; commits, README y nombres de codigo en **ingles**.
- Modulo puro = no toca el DOM. Toda logica de UI se extrae a funcion pura.

---

## 1. Modelo de datos

### Celda (indice plano)
`index = y * width + x`. Rango `0 .. size-1`, `size = width * height`.

### `Board` (campo de minas, puro)
Objeto plano (no clase, para serializar facil):

```js
{
  width: number,      // > 0
  height: number,     // > 0
  size: number,       // width * height
  mineCount: number,  // minas a colocar (0 <= mineCount < size)
  mines: Uint8Array,  // size, 1 = mina, 0 = no
  counts: Uint8Array, // size, 0..8 = minas adyacentes (0 en celdas con mina)
  placed: boolean     // true una vez colocadas las minas
}
```

### `Game` (estado de partida, puro)
```js
{
  width: number,
  height: number,
  size: number,
  mineCount: number,
  mines: Uint8Array,    // size
  counts: Uint8Array,   // size
  revealed: Uint8Array, // size, 1 = revelada
  flagged: Uint8Array,  // size, 1 = bandera
  started: boolean,     // true tras el primer reveal
  exploded: boolean,    // true si se revelo una mina
  status: "ready" | "playing" | "won" | "lost"
}
```

---

## 2. `src/core/rng.js` (puro)

```js
export function createRng(seed: number): () => number
```
PRNG determinista mulberry32. Devuelve `[0, 1)`.

```js
export function deriveSeed(seed: number, n: number): number
```
Semilla derivada y determinista para el intento `n` (entero >= 0).

```js
export function randInt(rng: () => number, maxExclusive: number): number
```
Entero en `[0, maxExclusive)`.

```js
export function shuffle(array: Array<any>, rng: () => number): Array<any>
```
Copia mezclada (Fisher-Yates con `rng`). No muta la entrada.

---

## 3. `src/core/board.js` (puro)

```js
export function createBoard(width, height, mineCount): Board
```
`placed: false`, `mines` y `counts` en cero.

```js
export function indexOf(board, x, y): number      // y * width + x
export function xOf(board, i): number
export function yOf(board, i): number
export function inBounds(board, x, y): boolean
export function neighborsOf(board, i): number[]   // hasta 8 indices, precalculado
```

```js
export function placeMines(board, rng, safeIndices: number[]): Board
export function computeCounts(board): Uint8Array
```
`placeMines`: coloca exactamente `mineCount` minas en indices fuera de
`safeIndices`, con `rng`. Marca `placed: true`. Si
`mineCount > size - safeIndices.length`, **lanza** `RangeError` (no se inventa un
tablero imposible). `computeCounts`: `counts[i] = minas adyacentes a i`; en celdas
con mina el valor es `0`.

---

## 4. `src/core/game.js` (puro)

```js
export function createGame({ width, height, mineCount }): Game
```
Tablero vacio, sin minas colocadas, `status: "ready"`.

```js
export function safeZoneOf(game, i): number[]
```
Celda `i` mas sus vecinas (lo que queda libre de minas en el primer clic).

```js
export function reveal(game, i, rng): Game
```
Copia y revela. En el primer reveal (`started === false`) coloca las minas con
`safeZoneOf(game, i)`. Propaga con **flood fill** sobre vecinos con `counts === 0`.
Si la celda revelada es mina: `exploded: true`, `status: "lost"`, y revela todas
las minas. Si con esto se completa todo lo no-mina: `status: "won"`. No muta la
entrada. Una celda ya revelada o con bandera no se revela.

```js
export function toggleFlag(game, i): Game
export function chord(game, i): Game
```
`toggleFlag`: no aplica a celdas reveladas. `chord(game, i)`: si `i` esta
revelada y la cantidad de banderas vecinas iguala `counts[i]`, revela los vecinos
sin bandera (puede perder si las banderas estaban mal puestas). Si no se cumple,
devuelve una copia sin cambios.

```js
export function revealAllMines(game): Game
export function statusOf(game): "ready" | "playing" | "won" | "lost"
export function isWon(game): boolean
export function hiddenCount(game): number   // celdas no reveladas
```

---

## 5. `src/core/logic.js` (puro) - el solver explicable

```js
export function analyze(game): {
  deductions: Deduction[],
  solved: boolean,        // no quedan celdas seguras deducibles
  remainingMines: number  // mineCount - banderas
}
```

### `Deduction`
```js
{
  technique: "counting" | "subset",
  action: "mine" | "safe",
  cells: number[],     // celdas a las que aplica
  source: number,      // celda revelada que origina el razonamiento
  evidence: {          // numeros reales del tablero, para el texto
    unit: "neighbors" | "subset",
    count: number,           // el numero visible (ej. 2)
    flags: number,           // banderas vecinas ya puestas
    hidden: number[],        // celdas ocultas involucradas
    // solo en subset:
    outer?: { count: number, cells: number[], mines: number },
    inner?: { count: number, cells: number[], mines: number }
  }
}
```

```js
export function findDeduction(game): Deduction | null
```
La deduccion mas simple disponible (counting antes que subset), o `null`.

```js
export function verifyDeduction(game, deduction): boolean
```
Re-evalua la deduccion contra el estado **actual** del juego. Debe devolver
`false` si el estado cambio y la deduccion ya no se sostiene.

```js
export function solveLogically(game, opts?): {
  steps: Deduction[],
  solved: boolean,
  stuck: boolean
}
```
Aplica deducciones hasta resolver o trabarse. **No** adivina nunca. Devuelve
`solved: true` si dejo el tablero ganado.

---

## 6. `src/core/explain.js` (puro)

```js
export function explain(deduction, game): string
```
Texto en espanol construido desde `evidence` (no un string fijo por tecnica).
Debe nombrar la posicion y los numeros reales.

Ejemplos de contrato (forma, no texto literal):
- counting/mine: `"La celda B3 es mina: el 2 de la fila 2 ya tiene sus 2 minas marcadas."`
- counting/safe: `"La celda C4 es segura: el 1 de la fila 3 tiene su unica mina marcada."`
- subset/safe: `"La celda D5 es segura: las celdas del 1 de la fila 4 son un subconjunto de las del 2 de la fila 5, y la diferencia queda libre."`

Posiciones como notacion de tablero: columna `A..Z` (o `AA`), fila `1..n`
(ej. `A1` = `x 0, y 0`). Exportar:

```js
export function cellName(board, i): string   // "A1", "B3", ...
```

---

## 7. `src/core/presets.js` (puro)

```js
export const PRESETS = {
  easy:   { id: "easy",   label: "Facil",   width: 9,  height: 9,  mineCount: 10 },
  medium: { id: "medium", label: "Medio",   width: 16, height: 16, mineCount: 40 },
  hard:   { id: "hard",   label: "Dificil", width: 30, height: 16, mineCount: 99 }
};

export function presetOf(id): object   // lanza RangeError si no existe
export function validatePreset(preset): boolean
```
`validatePreset`: `mineCount > 0`, `mineCount < width * height`, dimensiones
positivas, y `mineCount <= width * height - 9` (para garantizar primer clic
seguro).

---

## 8. `src/ui/` (logica pura, sin DOM, testeable)

```js
// state.js
export class GameSession { /* ver 8.1 */ }
export function revealedNeighbors(game, i): number[]
export function flagCountOf(game): number

// a11y.js
export function cellLabel(game, i, opts?): string
export function statusText(game): string

// navigation.js
export const ARROW_KEYS: Record<string, [number, number]>
export function move(board, i, dx, dy, wrap?): number
export function moveByKey(board, i, key): number
```

### 8.1 `GameSession`
Une partida, cronometro, estadisticas y persistencia. Inyecta dependencias para
poder testear sin DOM:
```js
new GameSession({
  storage,        // { getItem, setItem, removeItem } o null
  createRng,      // opcional, para tests deterministas
  now             // opcional, () => ms, para tests de timer
})
```
API: `newGame(presetId)`, `reveal(i)`, `toggleFlag(i)`, `chord(i)`, `hint()`,
`pause()`, `resume()`, `restart()`, `state` (getter con `game`, `presetId`,
`elapsedMs`, `paused`, `stats`, `hintsUsed`).

---

## 9. `src/ui/persistence.js` (puro)

```js
export const SCHEMA_VERSION = 1
export function load(storage): { game, presetId, stats, elapsedMs, recovered }
export function save(storage, payload): void
export function defaultStats(): object
export function recordWin(stats, presetId, timeMs): object  // unico mutador
export function recordLoss(stats, presetId): object
export function migrate(payload, fromVersion): object
```
Payload con `schemaVersion`; version futura se rechaza. `localStorage` corrupto o
ausente **no lanza**: arranca limpio y reporta `recovered: true`.

---

## 10. Criterios de aceptacion globales

- `npm test` verde con `node --test`.
- `npm run build` verde.
- Primer clic **nunca** pisa mina (test con muchas semillas).
- El solver nunca adivina: `solveLogically` no toca celdas sin deduccion.
- Cada deduccion tiene `verifyDeduction` que la valida contra el estado actual.
- Nada depende solo del color; foco visible; roles ARIA correctos.
- Cero dependencias de runtime.
