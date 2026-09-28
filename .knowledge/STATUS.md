# STATUS - Kanam MINESWEEPER

<!-- project: github.com/gonzoblasco/kanam-minesweeper -->

## Fase actual

**Live (2026-09-28).** v1 jugable de punta a punta, verificada en el navegador y
publicada en GitHub Pages:
https://gonzoblasco.github.io/kanam-minesweeper/

Construido con la arquitectura multi-agente (ADR-073, ADR-074) y el pipeline A/B
asimetrico (ADR-077): CORE orquesta y verifica, Kanam DEV ejecuta.

## Que funciona

- **Motor puro** (`src/core/`): PRNG mulberry32 determinista, tablero con
  vecinos precalculados, `placeMines` con zona segura, `game.js` con
  **primer clic siempre seguro**, flood fill, chording, victoria/derrota.
- **Solver explicable** (`logic.js` + `explain.js`): dos tecnicas honestas -
  counting (sobre una celda revelada) y subset (1-1, 1-2, 1-2-1, 1-2-2-1 y
  generalizaciones). `verifyDeduction` re-valida contra el estado actual, asi el
  hint no puede mentir. `solveLogically` **nunca adivina**.
- **UI jugable** (`src/ui/`): grilla accesible (`role=grid`/`row`/`gridcell`,
  `aria-label` por celda, `aria-live`), selector de dificultad (facil 9x9/10,
  medio 16x16/40, dificil 30x16/99), Partida nueva, Reiniciar, Pausar/Continuar,
  boton Pista que muestra el texto y resalta las celdas del razonamiento,
  contador de minas y cronometro. Click revela, click derecho bandera, doble
  click chording; teclado: flechas, Enter/Espacio, `F`, `C`, `N`.
- **Persistencia** (`persistence.js`): partida en curso, estadisticas por
  dificultad, migracion de esquema y recuperacion ante storage corrupto.
- **PWA**: manifest, iconos generados localmente sin dependencias, service
  worker escrito a mano con precache real y fallback offline.
- **Cero dependencias de runtime.** Vite 7.3.6 solo como devDependency.

## Verificacion (medida, no afirmada)

| Gate | Resultado |
|---|---|
| `npm test` | **156 tests, 156 pass, 0 fail** |
| `npm run build` | verde (JS 21.83 kB gzip 7.45 kB) |
| `scripts/review-gate.sh` | **8/8** |
| Primer clic seguro | 9000 casos (500 semillas x 6 puntos x 3 presets), **0 minas** |
| Solver sin adivinar | 200 tableros, 0 violaciones |
| Pistas veraces | 283 deducciones verificadas, **0 mentiras** |
| E2E Chromium | **31/31**, sin errores de consola; una partida **ganada usando solo las pistas** |
| Sitio publicado | HTTP 200, 81 celdas, primer clic revela, boton Pista presente |
| Guiones largos | 0 |

## Defectos que atrapo el pipeline (borrador de workers anonimos)

El borrador inicial era **falso verde**: reportaba "tests verde" sobre una suite
de 1 test. Defectos reales encontrados y corregidos:

1. `board.js` llamaba a `shuffle` **sin importarlo**: `ReferenceError`, el motor
   no ejecutaba.
2. `neighborsOf` **mutaba el board** del llamador al cachear vecinos (la spec
   exige pureza). Corregido con `WeakMap` a nivel modulo.
3. `explain` nombraba la **fila equivocada** en deducciones `subset`.
4. `analyze` (SPEC 5) **no existia**.
5. `session.js`/`render.js` eran un **stub**: el motor no se usaba, las minas
   nunca se colocaban, el juego era imposible de ganar o perder.
6. Dos `GameSession` en conflicto (uno roto en `state.js`).
7. Bug de teclado: `if (e.key in moveByKey)` - las flechas no movian el foco.
8. `render()` reconstruia las 81 celdas en cada accion, perdiendo el foco.
9. 19 guiones largos (en dash) en el core.

## Comandos

```bash
npm install
npm run dev                 # servidor de desarrollo
npm test                    # suite completa (motor + UI)
npm run build               # build de produccion
bash scripts/review-gate.sh # gate de verificacion independiente
node scripts/e2e.mjs dist   # E2E real en Chromium
```

## Proximo (fuera de la v1)

- Tecnicas de deduccion adicionales (colores, cadenas).
- Probado en dispositivo real sin red (hoy: offline simulado + PWA publicada).
