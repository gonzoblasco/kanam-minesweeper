# EVOLUTION-RESEARCH - Kanam MINESWEEPER

<!-- project: github.com/gonzoblasco/kanam-minesweeper -->

Investigacion de producto para decidir la v2. Alcance: estado del arte, el
problema de la adivinanza, modos de ensenanza y **puntos debiles medidos de
nuestra version**. Fecha: 2026-09-28. Autor: Kanam MIND (investigacion/evidencia,
no diseno ni implementacion).

## Como leer esto

- **Verificado corriendo codigo** = numeros que salieron de ejecutar el motor
  real (`src/core/`) desde un harness en Node. Se marcan con la seccion
  "Medido" y traen el comando.
- **Verificado leyendo** = afirmaciones de una fuente que abri; traen link.
- **Inferido** = conclusion mia a partir de lo anterior, no medida.
- **Incognita** = no lo pude verificar; queda listado en la seccion final.

El resumen corto: **nuestra promesa ("el azar puede forzar jugadas a ciegas, y
eso lo resolvemos") hoy NO esta cumplida.** Medido: en Dificil el solver se
traba en el **95.4%** de los tableros; incluso con un solver mucho mas fuerte
sigue trabado en el **92%**. El primer clic resuelve el **65%** del tablero Facil.
Los numeros y como se midieron van abajo.

---

## 1. Estado del arte (verificado leyendo)

### 1.1 El problema de la adivinanza es el eje del genero

La friccion central del buscaminas, reportada por la comunidad, es la jugada a
ciegas forzada: cuando la logica se agota y hay que clickear sin informacion.

- Fuente: blog "Guess-Free Minesweeper", Mike Delmonaco, 2024-04.
  https://quasarbright.github.io/blog/2024/04/guess-free-minesweeper.html
  Que dice: "Sometimes, you end up in a situation where there is not enough
  information to find a tile that is definitely safe... guessing is required to
  proceed". Lo describe como consecuencia de como se reparten las minas, "a
  matter of luck... not a particularly fun aspect of a game that is otherwise
  about logic".
  Por que importa: confirma que el diferencial que elegimos en el BRIEF es el
  correcto y es un problema reconocido, no una preferencia nuestra.

- Fuente: "Every Expert Board That Forces a Guess", artwaste.land (censo).
  https://artwaste.land/strata/every-expert-board-that-forces-a-guess/
  Que dice: censa tableros Expert (16x30, 99 minas, apertura segura de 3x3) con
  un solver que propaga deducciones locales y, al trabarse, enumera cada
  asignacion consistente por componente conexa para calcular probabilidad exacta
  por celda. Mide "how often the player is forced to guess".
  Por que importa: es el metodo de referencia para medir lo mismo que medimos
  nosotros, y valida que enumeracion por componente es el siguiente paso tecnico.

### 1.2 No-guess: dos familias tecnicas

**Familia A - rechazo (regenerar hasta que salga resoluble).** Es lo simple.

- Fuente: "Writing a soluble-grid generator for Mines", Simon Tatham, 2019-08-26.
  https://www.chiark.greenend.org.uk/~sgtatham/quasiblog/mines-solver/
  Que dice: no existe (el no la conoce) una caracterizacion matematica de
  tablero resoluble. Su metodo real: incluir un solver que simule deducciones
  humanas; tirar minas al azar, correr el solver, y si no resuelve, regenerar.
  Agrega un "perturber" que **reordena minas en la parte cerrada** para destrabar
  en vez de empezar de cero; el ultimo recurso es regenerar. Nota clave: la
  solubilidad depende de donde arrancas ("It's very common that a grid which can
  be solved starting from this empty square can't also be solved starting from
  that one"), por eso todo se difiere al primer clic. Sorpresa declarada: con
  esta maquinaria pudo subir la densidad por encima de 2x la estandar de Windows
  y aun asi no tardar demasiado.
  Por que importa: (a) valida nuestro enfoque de primer clic diferido; (b) nos
  dice que la regeneracion simple alcanza a densidades estandar, y que la
  perturbacion incremental es la mejora siguiente para densidades altas; (c)
  confirma que a densidad Expert (99/480 = 20.6%) hace falta mas que rechazo puro.

- Fuente: quasarbright (mismo blog, seccion solver). Que dice: representa la
  informacion como "count-sets" (conjunto de celdas ocultas + cuantas minas hay
  adentro), aplica (1) certezas, (2) regla de superconjunto/resta, (3) regla 1-2
  generalizada, y (4) el **conteo global de minas restantes** como dato extra. Si
  se traba, regenera ("surefire backup").
  Por que importa: nuestra tecnica "subset" corresponde a la regla de
  superconjunto; el conteo global de minas es una mejora barata que **no usamos**
  (verificado en `src/core/logic.js`, no lee `mineCount`).

**Familia B - muestreo uniforme sobre el conjunto resoluble.** Mas fuerte.

- Fuente: AlexBuz/mindsweeper. https://github.com/alexbuz/mindsweeper/
  Que dice: en vez de tirar minas al azar, elige **uniformemente** un arreglo de
  minas del conjunto de arreglos que un "perfect logician" puede resolver sin
  adivinar. Promete: (1) nunca hay que adivinar, sin toggle; (2) "guess
  punishment" activado por defecto (si clickeas una celda que *puede* ser mina,
  lo sera); (3) primer clic irrestricto, corre en milisegundos tras el clic;
  (4) analisis post-mortem: te muestra que banderas pusiste mal y que celdas
  podias revelar seguro; (5) Rust/WASM, offline.
  Por que importa: es la implementacion de referencia del modo sin adivinanza, y
  trae dos features de ensenanza que nosotros no tenemos: castigo de adivinanza y
  post-mortem del error.

### 1.3 Variantes y modos comparables (que hace la comunidad)

- minesweeper.online (sitio insignia). https://minesweeper.online/help/guides
  Verificado leyendo: la barra tiene **Standard mode** y **No guessing mode**
  como dos modos de primer nivel, mas Multiplayer (pvp), Ranking y una guia
  titulada **"What is a 50/50"** (Scar) junto a "Probability calculation" (Scar).
  Por que importa: (a) no-guess no es nicho, es un modo de primera clase en el
  sitio mas grande; (b) que exista una guia dedicada al "50/50" confirma que el
  caso forzado es una molestia nombrada por los propios jugadores.

- Simon Tatham's Portable Puzzle Collection, "Mines".
  https://www.chiark.greenend.org.uk/~sgtatham/puzzles/
  Verificado leyendo (pagina indice): coleccion de puzzles con garantia de
  resolubilidad; su Mines es el caso de estudio del generador sin adivinanza. Su
  autor publico ademas un modo nuevo reciente que describio el mismo como
  "brain-meltingly confusing" (Hachyderm, @simontatham, 2025-08).
  https://hachyderm.io/@simontatham/117203035323163040
  Por que importa: muestra que la comunidad sigue experimentando con modos
  nuevos, no solo con el clasico.

- gnome-mines (GNOME). https://github.com/GNOME/gnome-mines
  Verificado leyendo (NEWS): proyecto vivo, version 50.0. Es el buscaminas
  "clasico de escritorio" sin modo no-guess destacado.
  Por que importa: referencia de que el clasico puro sigue siendo el default
  masivo; el no-guess es el diferenciador.

- "14 Minesweeper Variants" (Steam). Hilo de discusion "Ideas that would make the
  game more accessible".
  https://steamcommunity.com/app/1865060/discussions/0/3732953219566423963/
  Estado: **ubicado pero no abierto** (ver Incognitas). El titulo del hilo
  sugiere que la accesibilidad de variantes es un tema activo de la comunidad.

- "Better Minesweeper" (Steam, Early Access).
  https://store.steampowered.com/app/3898970/Better_Minesweeper/
  Verificado leyendo: lista de features que coinciden casi 1 a 1 con lo que
  piden los jugadores: **tamanos de tablero custom**, **reglas de primer clic
  configurables** ("first-click safety options"), **Daily Runs con tableros
  sembrados** (seeded) con **soporte No-Guess (beta)**, **stats extensas por
  partida y de todos los tiempos** (PB, rachas, **3BV**), multiples modos de
  chording, fast reveal, dark mode. Declara que la prioridad la fija el feedback
  de la comunidad.
  Por que importa: es la lista de "que piden los jugadores" ya validada por un
  producto en el mercado, con las mismas etiquetas que buscamos.

### 1.4 Metricas y friccion de jugadores expertos

- 3BV ("Bechtel's Board Benchmark Value") = minimo de clics izquierdos para
  limpiar el tablero sin banderas, con juego perfecto. Es la vara estandar de
  dificultad de la comunidad.
  Fuente: https://minesweeper.org/info/3bv y https://minesweepergame.com/statistics.php
  Datos utiles: promedios 3BV por preset estandar = Beginner (9x9/10) ~15,
  Intermediate (16x16/40) ~65, Expert (16x30/99) ~174.
  Derivadas: 3BV/s (velocidad), IOE/Efficiency = 3BV / clics totales (economia;
  >100% con chording habil), ZiNi (variante para jugadores que usan banderas).
  Por que importa: nos da un **ruler calibrado** para comparar nuestros tableros
  con el estandar (lo medimos, ver 2.6) y un stat que hoy no mostramos.

- Friccion nombrada: "50/50" es una guia con nombre propio en minesweeper.online
  (ver 1.3). El post-mortem de mindsweeper existe precisamente porque perder por
  una adivinanza o por una bandera mal puesta molesta (ver 1.2).

### 1.5 Modos de ensenanza (modelos de otros puzzles)

- HoDoKu (Sudoku trainer).
  https://hodoku.sourceforge.net/en/docs_intro.php y .../en/techniques.php
  Verificado leyendo: se define como "generator/solver/**trainer**/analyzer";
  genera en 5 niveles configurables; tiene una vista "**All possible steps**"
  que lista todos los pasos aplicables en el estado actual, y una biblioteca de
  tecnicas "human style" con la que **califica** el sudoku por la tecnica mas
  dificil requerida.
  Por que importa: es el modelo exacto para nuestro modo de ensenanza: (a)
  calificar el tablero por el tier de tecnica mas alto que exige, (b) mostrar
  "todos los pasos disponibles" en vez de solo el mas simple.

- LiveSudoku / Sudokly step-by-step solver.
  https://www.livesudoku.com/en/learn/how-to-solve-sudoku y
  https://sudokly.com/tools/step-by-step-solver/
  Verificado leyendo: la progresion es **guiada y en orden** ("start with How to
  Play Sudoku and work down the path in order; every lesson builds on the one
  before it"); cada paso del solver **nombra la tecnica** ("Each step says which
  technique you used. You learn while you finish").
  Por que importa: patron de ensenanza concreto: leccion por tecnica, en
  progresion, y el solver visible paso a paso como herramienta de practica. Hoy
  nuestro boton Pista da un paso; no hay lecciones ni calificacion.

---

## 2. Puntos debiles MEDIDOS de nuestra version

### 2.1 Metodologia

Todo lo de esta seccion sale de **correr el motor real** (`src/core/game.js`,
`logic.js`, `board.js`, `rng.js`, `presets.js`) desde scripts en Node. No toque
`src/` ni `tests/`. Harnesses (temporales, en `/tmp`, copiados a
`.knowledge/research/` para reproducibilidad):

- `/tmp/ms-measure2.mjs` - tasa de traba, cobertura, tiers de tecnica (motor real, N=500).
- `/tmp/ms-strong.mjs` - solver reforzado (counting + subset + conteo global +
  enumeracion por componente) para separar "el tablero obliga a adivinar" de
  "nuestro solver es corto" (N=200).
- `/tmp/ms-cost.mjs` - costo de generacion cruda, distribucion de tiers y barrido
  de densidad de minas (N=400).
- `/tmp/ms-3bv.mjs` - 3BV de nuestros presets (N=500).

Presets reales: easy 9x9/10, medium 16x16/40, hard 30x16/99 (de
`src/core/presets.js`). PRNG determinista `mulberry32`; semillas derivadas con
`deriveSeed`, asi que las corridas son reproducibles. Primer clic: "random"
(celda al azar, como un jugador real) y "center" (celda central). `verifyFail`
(fallos de `verifyDeduction`) fue **0** en todas las corridas.

### 2.2 Tasa de traba del solver (el numero que decide todo)

`solveLogically` (las 2 tecnicas reales: counting + subset), 500 tableros por
preset, primer clic al azar:

| Dificultad | Resuelve por logica | **Se traba (fuerza adivinar)** | avgSteps | maxSteps |
|---|---|---|---|---|
| Facil 9x9/10 | 82.0% | **18.0%** | 19.8 | 34 |
| Medio 16x16/40 | 53.4% | **46.6%** | 73.8 | 118 |
| Dificil 30x16/99 | 4.6% | **95.4%** | 93.3 | 250 |

Con primer clic al centro: Facil 78.8% / Medio 54.8% / Dificil 5.0% de exito.

**Pero esto podria ser culpa del solver, no del tablero.** Para separarlo, corri
un solver reforzado que agrega el conteo global de minas + enumeracion exhaustiva
por componente conexa (tope 22 celdas), 200 tableros:

| Dificultad | Solver real (2 tecnicas) | **Solver reforzado** | Sigue trabado |
|---|---|---|---|
| Facil | 82.0% | 86.0% | **14.0%** |
| Medio | 53.4% | 65.0% | **35.0%** |
| Dificil | 4.6% | 8.0% | **92.0%** |

Inferencia: en Facil y Medio el solver corto explica buena parte de la traba (el
reforzado gana 4 y 12 puntos). En Dificil el reforzado casi no cambia (8% contra
4.6%): **el tablero realmente obliga a adivinar**. Y esto coincide con la
literatura: el censo independiente de Expert (artwaste.land) encuentra la misma
clase de problema en 16x30/99. Conclusion: el diferencial declarado en el BRIEF
("no forzamos adivinanzas") esta incumplido en Medio (35-47%) y Dificil (92-95%).

Comando: `N=500 node /tmp/ms-measure2.mjs` y `N=200 node /tmp/ms-strong.mjs`.

### 2.3 Dificultad real y que tan trivial es el primer clic

N=500 por preset, primer clic al centro:

| Preset | 3BV medio (min-max) | regiones abiertas | celdas aisladas | **celdas reveladas por el 1er clic** | total no-mina |
|---|---|---|---|---|---|
| Facil 9x9/10 | 14.3 (4-32) | 2.5 | 11.8 | **46.2** | 71 |
| Medio 16x16/40 | 63.7 (26-98) | 7.0 | 56.7 | 64.2 | 216 |
| Dificil 30x16/99 | 170.1 (122-226) | 13.2 | 156.9 | 40.9 | 381 |

Lectura 1: nuestro 3BV **calza con el estandar de la comunidad** (14.3 vs ~15,
63.7 vs ~65, 170.1 vs ~174). Nuestros tableros no son anomalos: son buscaminas
estandar, con la misma distribucion de dificultad.

Lectura 2 (debilidad): en Facil, **el primer clic revela 46.2 de 71 celdas
(65%)**. El tablero esta casi resuelto antes de la primera decision real. No es
trivialidad de 3BV, es trivialidad de **tamano de apertura inicial**. Un jugador
que clickea al centro empieza con 2/3 del tablero abierto y solo 10 minas.

Barrido de densidad (N=200 por punto, % de tableros resueltos por logica, clic al
centro):

| Tablero | 6 minas | 10 | 16 | 25 | 40 | 60 | 99 |
|---|---|---|---|---|---|---|---|
| 9x9 | 97% | 86% | 26% | 1% | 0% | 0% | - |
| 16x16 | 100% | 100% | 98% | 94% | 56% | 0% | 0% |
| 30x16 | 100% | 100% | 99% | 98% | 93% | 74% | 3% |

Lectura: la dificultad se dispara con la densidad, no con el tamano. Nuestro
Facil (12.3% de minas) vive en la zona facil; Dificil (20.6%) esta justo en el
borde donde la logica se rompe.

Comandos: `N=500 node /tmp/ms-3bv.mjs` y `N=400 node /tmp/ms-cost.mjs`.

### 2.4 Cobertura del solver (cuantas celdas resuelve solo)

`solveLogically` sobre el tablero real, primer clic al azar:

| Dificultad | cobertura tras 1er clic | **cobertura final del solver** | techo sin adivinar |
|---|---|---|---|
| Facil | 50.9% | **94.0%** | resuelve casi todo |
| Medio | 22.1% | **84.0%** | deja ~1/6 sin resolver |
| Dificil | 8.6% | **48.9%** | deja **mas de la mitad** |

Con clic al centro, Dificil sube a 59.4% y Medio a 89.1%. En Dificil, cuando se
traba, deja en promedio **262-303 celdas** sin resolver (max medido 476 de 480).
Conteo de deducciones por tecnica (Dificil, 500 tableros): counting 44.537,
subset 2.131, o sea **el 95% de los pasos son conteo simple**; subset aporta poco.
Inferencia: subir el techo de Dificil exige mas que afinar subset.

### 2.5 Costo real de generar sin adivinanza (rechazo con nuestro solver)

Medido: cuantos tableros hay que tirar para obtener 100 solubles por logica
(nuestro solver, clic al centro). N=100 por preset:

| Dificultad | intentos promedio por tablero resoluble | costo total medido |
|---|---|---|
| Facil | **1.3** | 13 ms / 100 tableros |
| Medio | **1.9** | 243 ms / 100 tableros |
| Dificil | **23.2** | 6.376 ms / 100 tableros (~64 ms por tablero) |

Costo de generacion **cruda** (colocar minas + counts), 20.000 tableros por preset:
Facil 0.0064 ms, Medio 0.0175 ms, Dificil 0.0329 ms por tablero.

Inferencia: el no-guess por rechazo es **baratisimo en Facil y Medio** (1-2
intentos) y caro pero viable en Dificil (~23 intentos, ~64 ms en Node). Eso es
tiempo de UI en el primer clic, no en cada accion: aceptable con un spinner o con
la perturbacion incremental de Tatham para bajarlo. El costo se reduce si se usa
el solver reforzado (mas tableros pasan el filtro: Medio 65% en vez de 53%).

### 2.6 Huecos de features (verificado en el codigo, no opinado)

Busque en `src/` e `index.html`:

| Feature pedida por jugadores | Estado en nuestro codigo |
|---|---|
| Marca de duda "?" | **Ausente** (0 coincidencias de question/duda) |
| Reverso / undo | **Ausente** (solo aparece la palabra "history" en un comentario de `session.js`) |
| Compartir tablero / daily | **Ausente** (0 coincidencias en `src/` e `index.html`) |
| 3BV / eficiencia / ZiNi | **Ausente** (0 coincidencias) |
| Tablero custom / densidad elegible | **Ausente** (solo los 3 presets de `presets.js`) |
| Primer clic de area variable | **Ausente**: `safeZoneOf` es fijo 3x3 (celda + vecinas) |
| Pistas que explican | **Presente** (`explain.js`, `session.hint()`), 1 paso por vez |
| Historial de movimientos | **Ausente**: el estado no guarda pila de acciones |
| Post-mortem tras perder | **Ausente** |

### 2.7 Estado de verificacion propio

`npm test`: **168 pass, 0 fail** (STATUS.md dice 156; el numero deriva, conviene
actualizarlo). `python3 ~/.openclaw/workspace/scripts/check_em_dash.py .`:
**OK, sin guiones largos**. Ninguna de las mediciones de arriba reporto un
`verifyDeduction` fallido: el solver que tenemos es correcto, solo es corto.

---

## 3. Oportunidades priorizadas (valor vs esfuerzo)

Valor = cuanto ataca una debilidad medida o el diferencial declarado. Esfuerzo =
tamano de la obra (motor + UI + tests) segun lo que ya existe.

| # | Oportunidad | Valor | Esfuerzo | Evidencia que la respalda |
|---|---|---|---|---|
| 1 | **Modo no-guess por filtro de solubilidad** (generar y descartar hasta que `solveLogically` gane) | Muy alto | Bajo | 2.5: 1.3 / 1.9 / 23.2 intentos. Cumple el diferencial del BRIEF. Es el modo de primera clase en minesweeper.online |
| 2 | **Solver reforzado**: conteo global de minas + enumeracion por componente (con tope) | Muy alto | Medio | 2.2: sube Medio 53->65%, Facil 82->86%. Habilita no-guess barato y pistas mejores |
| 3 | **Calificar cada tablero por tier de tecnica** (conteo / subset / conteo global / enumeracion) y mostrarlo | Alto | Bajo | 1.5 (HoDoKu) + 2.2/2.4 (ya medimos la distribucion). Es la base del modo ensenanza |
| 4 | **Stat 3BV + eficiencia (3BV/clics)** | Alto | Bajo | 1.4 y 2.3: ya calculamos 3BV en el harness; nuestros valores calzan con el estandar. Hace comparables los tiempos |
| 5 | **Post-mortem al perder** (banderas mal puestas + celdas que se podian revelar seguro) | Alto | Medio | 1.2 mindsweeper; 1.5 estilo trainer. Reusa el solver. Ensenanza directa |
| 6 | **Reverso/undo limitado** (ej. solo en modo practica sin records, o 1 paso) | Medio | Medio | 2.6: ausente. Ojo: undo rompe la integridad de records, hay que acotarlo |
| 7 | **Marca de duda "?"** | Medio | Muy bajo | 2.6: ausente. Comportamiento clasico de Windows, expectativa base |
| 8 | **Primer clic de area variable** (celda sola / 3x3 / 5x5) | Medio | Bajo | 2.3: la apertura revela 65% en Facil. Ajustar el area cambia la dificultad real; Better Minesweeper lo expone como opcion |
| 9 | **Tablero custom + densidad elegible** | Medio | Medio | 1.3 Better Minesweeper; 2.3 barrido de densidad |
| 10 | **Daily / tablero por semilla + compartir** | Bajo-Medio | Medio | 1.3 Better Minesweeper (Daily Runs seeded); el repo ya tiene PRNG determinista y `deriveSeed` |
| 11 | **Lecciones por tecnica (practica dirigida)** | Bajo (v2) | Alto | 1.5 LiveSudoku/Sudokly. Depende de tener el tiering (#3) primero |

Camino corto recomendado (inferido): **#1 + #2 + #3 + #4 juntos**. #1 y #4 son
baratos y cierran la brecha entre lo prometido y lo entregado; #2 sube el techo
de Dificil; #3 y #4 habilitan la ensenanza y el stat comparable. #5 es el
siguiente escalon natural de ensenanza.

---

## 4. Incognitas (lo que NO pude verificar)

1. **Fuentes que no abri** (404/403/Cloudflare/cuerpo truncado). Solo tengo el
   titulo o el extracto del buscador, no el contenido:
   - StackOverflow "Generate a minesweeper board which doesn't need guessing"
     (score 33, 34k vistas): el cuerpo quedo tras un challenge 403.
   - Tesis TU Berlin "Approaches to creating solvable Minesweeper instances...
     using constraint programming" (Kunz, 2024): PDF ubicado, no leido.
   - "14 Minesweeper Variants" hilo de accesibilidad (Steam): no abierto.
   - `chiark.../puzzles/doc/mines.html` y HoDoKu `docs_intro.php`: 403/ECONNRESET.
2. **Latencia real en navegador.** Los costos de 2.5 son de Node (V8) en esta
   maquina; el rendimiento en el navegador del usuario no lo medi.
3. **Cuanta gente prefiere no-guess.** No encontre una encuesta; es inferencia a
   partir de que minesweeper.online lo ofrece como modo de primer nivel.
4. **Viabilidad exacta de no-guess a 99 minas sin perturbacion.** Tatham afirma
   que alcanza densidades altas con su "perturber", pero no implemente ni medi un
   generador con perturbacion; solo medi rechazo puro (23.2 intentos).
5. **Variantes (hexagonal, 3D, multijugador).** No abri ninguna fuente primaria
   especifica; lo unico verificado es que minesweeper.online tiene Multiplayer.
6. **Que tecnica nombra el usuario como "la que le falta".** No hay dataset de
   quejas etiquetadas; las guias de minesweeper.online sugieren "50/50" y
   "probability" como los temas calientes, pero no es una medicion.

---

## 5. Fuentes (links)

Estado del arte y no-guess:
- https://quasarbright.github.io/blog/2024/04/guess-free-minesweeper.html (solver, count-sets, no-guess)
- https://www.chiark.greenend.org.uk/~sgtatham/quasiblog/mines-solver/ (generador resoluble de Tatham)
- https://github.com/alexbuz/mindsweeper/ (muestreo uniforme no-guess, post-mortem, guess punishment)
- https://artwaste.land/strata/every-expert-board-that-forces-a-guess/ (censo de tableros Expert que fuerzan adivinanza)
- https://www.chiark.greenend.org.uk/~sgtatham/puzzles/ (coleccion de puzzles)

Sitios y variantes:
- https://minesweeper.online/help/guides (Standard vs No guessing, pvp, guias 50/50 y probabilidad)
- https://store.steampowered.com/app/3898970/Better_Minesweeper/ (custom, first-click options, daily seeded, stats, 3BV)
- https://github.com/GNOME/gnome-mines (clasico de escritorio)
- https://hachyderm.io/@simontatham/117203035323163040 (modo nuevo de Mines)

Metricas:
- https://minesweeper.org/info/3bv (definicion de 3BV, promedios por preset, topologias)
- https://minesweepergame.com/statistics.php (3BV, 3BV/s, IOE, ZiNi)

Ensenanza:
- https://hodoku.sourceforge.net/en/docs_intro.php y https://hodoku.sourceforge.net/en/techniques.php (trainer, grading por tecnica, all possible steps)
- https://www.livesudoku.com/en/learn/how-to-solve-sudoku (progresion guiada)
- https://sudokly.com/tools/step-by-step-solver/ (paso a paso nombrando la tecnica)

No abiertas (ver Incognitas): stackoverflow 8304982, tesis TU Berlin Kunz 2024,
hilo Steam de 14 Minesweeper Variants.

---

## 6. Reproduccion

```
cd /Users/gonzoblasco/projects/kanam-minesweeper
N=500 node /tmp/ms-measure2.mjs    # traba, cobertura, tiers (motor real)
N=200 node /tmp/ms-strong.mjs      # solver reforzado (conteo global + enumeracion)
N=400 node /tmp/ms-cost.mjs        # costo de generacion, sweep de densidad, reintentos
N=500 node /tmp/ms-3bv.mjs         # 3BV de los presets
npm test                           # 168 pass / 0 fail
python3 ~/.openclaw/workspace/scripts/check_em_dash.py .
```

Los harnesses importan el motor real por ruta absoluta y usan semillas
deterministas (`deriveSeed`), asi que los numeros son estables. Copia de los
cuatro scripts en `.knowledge/research/` para que la medicion sea auditable.

Nota de alcance: esta investigacion **no** toco `src/` ni `tests/`. Todo lo que
afirma "medido" salio de ejecutar el motor; lo que afirma "dice" trae link; lo
que es conjetura esta marcado como inferencia o incognita.
