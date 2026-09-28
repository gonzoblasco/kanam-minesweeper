# EVOLUTION-PLAN - Kanam MINESWEEPER v2

<!-- project: github.com/gonzoblasco/kanam-minesweeper -->

Sintesis tecnica de los informes de MIND (`EVOLUTION-RESEARCH.md`) y STUDIO
(`EVOLUTION-DESIGN.md`) en un plan ejecutable y priorizado. Autor: Kanam DEV
(ingenieria). Fecha: 2026-09-28.

**Esto es un plan, no implementacion.** No toca `src/` ni `test/`. Cada criterio
de aceptacion se verifica con un comando, no con una opinion. Lo que sigue marca
`[medido]` cuando lo corri y `[propuesta]` cuando es diseno o inferencia.

Los numeros de MIND y STUDIO **los reproduje** antes de usarlos. Lo que no se
reproduce queda dicho. Las secciones 2 y 3 traen el comando exacto de cada cosa.

---

## 1. Objetivo de la evolucion

Cumplir la promesa que la v1 declara y no entrega: **que el azar nunca obligue a
adivinar**, y sostenerla con la deuda de accesibilidad y de lenguaje visual que
hoy quedan a medio camino.

En una frase operativa: subir el modo Difícil de 4.6% a 100% de tableros
resolubles por logica (por filtro de solubilidad en el generador), reparar el
borde de control que hoy mide 1.34:1, y agregar el movimiento que la v1 no tiene
sin romper `prefers-reduced-motion`.

---

## 2. Hallazgos que cambian el rumbo

Son los que obligan a actuar y no a opinar. Todos reproducidos hoy.

### 2.1 La promesa del BRIEF esta incumplida [medido]

El BRIEF vende "no forzamos adivinanzas" y el `#1` de la v1 es el primer clic
seguro. Medido sobre el motor real, 500 tableros por preset, primer clic al azar:

| Dificultad | Resuelve por logica | **Se traba (fuerza adivinar)** |
|---|---|---|
| Facil 9x9/10 | 82.0% | **18.0%** |
| Medio 16x16/40 | 53.4% | **46.6%** |
| Dificil 30x16/99 | 4.6% | **95.4%** |

Y no es culpa de que el solver sea corto: con un solver reforzado (conteo global
de minas + enumeracion por componente) Difícil sigue trabado en **92%**. En
Dificil el **tablero** obliga a adivinar, no el solver. Cobertura final del solver
en Dificil: **48.9%** (deja mas de la mitad del tablero sin resolver).

Reproducir:
```
cd /Users/gonzoblasco/projects/kanam-minesweeper
N=500 node .knowledge/research/ms-measure2.mjs   # traba, cobertura, techo
N=200 node .knowledge/research/ms-strong.mjs     # solver reforzado
```
`verifyFail` fue 0 en todas las corridas: el solver que tenemos es correcto, solo
es corto. **Esto cambia el rumbo porque el diferencial declarado es una mentira
medida**, y no una preferencia: es el criterio #1 de la v2.

### 2.2 El costo del no-guess esta medido [medido]

Rechazo puro (regenerar hasta que `solveLogically` gane), N=100 solubles:

| Dificultad | intentos por tablero | costo total (100 tableros) |
|---|---|---|
| Facil | 1.3 | 13 ms |
| Medio | 1.9 | 195-243 ms |
| Dificil | **23.2** | ~6.1-6.4 s (~64 ms por tablero) |

Reproducir: `N=400 node .knowledge/research/ms-cost.mjs` (seccion `noGuessRetry`).
Nota importante: ese costo es del **rechazo puro** con el solver de 2 tecnicas.
Con el solver reforzado mas tableros pasan el filtro (Medio 65% en vez de 53%),
asi que el costo de rechazo **baja** al reforzar el solver.

### 2.3 Deuda de accesibilidad, confirmada en el CSS real [medido]

`--line` (#2a303a) se usa hoy como borde real en **9 reglas** de `styles.css`
(lineas 107, 145, 173, 231, 273, 316, 454, 566, 583: botones, level-card, chip,
kbd, stat-card, board). Medido con la formula WCAG 2.x:

| par | ratio | piso 3:1 |
|---|---|---|
| `--line` sobre `--surface` #15181e | **1.34:1** | falla |
| `--line` sobre `--surface-2` #1b1f27 | **1.24:1** | falla |
| `--line` sobre `--bg` #0d0f12 | **1.45:1** | falla |

Contraste de la propuesta de STUDIO `--ctrl-line` #626c7a: **3.34:1** sobre
surface, **3.10:1** sobre surface-2, **3.61:1** sobre bg. Pasa el piso en los tres.

Reproducir (mide el CSS real, no el `.md`):
```
grep -c "border.*var(--line)" src/ui/styles.css   # 9
python3 - <<'PY'
def ch(c):
    c/=255; return c/12.92 if c<=0.03928 else ((c+0.055)/1.055)**2.4
def lum(h):
    h=h.lstrip('#'); r,g,b=int(h[0:2],16),int(h[2:4],16),int(h[4:6],16)
    return 0.2126*ch(r)+0.7152*ch(g)+0.0722*ch(b)
def r(a,b):
    la,lb=lum(a),lum(b); hi,lo=max(la,lb),min(la,lb); return (hi+0.05)/(lo+0.05)
print("line/surface", round(r("#2a303a","#15181e"),2))
print("ctrl-line/surface", round(r("#626c7a","#15181e"),2))
PY
```
**Aclaracion a STUDIO:** el informe dice que migrar `--line` a `--ctrl-line` es
obligatorio. Estoy de acuerdo con el diagnostico medido, pero discrepo del alcance:
**tres** de los 9 bordes de `--line` (lineas 107, 173, 231) son
`border-bottom` de separadores de seccion, no limites de control (WCAG 1.4.11 solo
exige 3:1 en bordes "required to identify a UI component"). Esos tres deben
**quedarse en `--line`** como decorativos; migrar los 9 sería un cambio ciego.
Detalle en la seccion 3.5 y en "Que discrepa".

### 2.4 Movimiento inexistente, kill-switch decorativo [medido]

`grep -n "transition\|@keyframes" src/ui/styles.css` devuelve **0** transiciones y
**0** keyframes. El unico bloque de movimiento (linea 612) es
`@media (prefers-reduced-motion: reduce)` que desactiva transiciones que no
existen: hoy reduce la nada. Es deuda de accesibilidad declarada y no pagada.

### 2.5 Huecos de features, verificados en el codigo [medido]

Grep sobre `src/` e `index.html`: **0 coincidencias** de marca de duda (`?`),
undo/reverso, 3BV/eficiencia, daily/share, tablero custom. El historial de
movimientos no existe (el estado no guarda pila de acciones). Pistas que explican:
presentes (`explain.js` + `session.hint()`), 1 paso por vez.

### 2.6 El estado del proyecto, verificado [medido]

`npm test`: **168 pass, 0 fail** (STATUS.md declara 156, esta desactualizado).
Nuestro 3BV calza con el estandar de la comunidad (Facil 14.3 vs ~15, Medio 63.7
vs ~65, Dificil 170.1 vs ~174): los tableros son normales, no anomalos.

Reproducir: `npm test`, `N=500 node .knowledge/research/ms-3bv.mjs`.

---

## 3. Fases ordenadas

Orden por dependencia, no por tamano. F1 desbloquea a F3; F2 es independiente y
barata; F4 depende de F1.

### F1 - Generador no-guess por filtro de solubilidad [propuesta]

**Que cambia y por que.** Es el criterio #1 de la v2: cumple la promesa del BRIEF
que hoy esta incumplida (2.1). El generador deja de aceptar el primer tablero
aleatorio y descarta hasta que `solveLogically` gane. No cambia la UI ni el
formato del tablero: cambia **que** tablero se sirve.

**Decision de diseno de la fase (la tomo yo, no Gonzo):** el primer paso es
**medir en navegador antes de implementar**, no implementar y medir despues.
MIND midio 64 ms/tablero en Node (V8), pero el costo en el navegador del usuario
no lo midio (lo declara incognita #2). 64 ms es aceptable como spinner en el primer
clic; 300 ms ya no. Sin esa medicion, F1 arranca a ciegas.

**Unidades atomicas:**

- **F1.1 Medir el rechazo en navegador.** Un script que corra el bucle de rechazo
  en Chromium (el que ya usa `scripts/e2e.mjs`) y reporte ms por tablero en
  Difícil. Criterio: `N=100` tableros, p50 y p95 de ms, y el techo de intentos.
  `node scripts/no-guess-bench.mjs` (nuevo) imprime la tabla. Dato [medido] a
  fijar; si p95 > 250 ms en Difícil, F1.2 cambia a perturbacion incremental o a
  muestreo (ver decisiones abiertas).
- **F1.2 Filtro de solubilidad en el generador.** `createGame`/`reveal` colocan
  minas con `placeMines`, y si el tablero resultante no gana con `solveLogically`,
  reintentan con `deriveSeed(seed, n+1)`. Tope de reintentos con fallback honesto
  (servir el ultimo tablero y no prometer). Toca `src/core/game.js` (o un helper
  nuevo `src/core/generator.js`) y `src/core/presets.js` si se agrega el flag
  `noGuess`. Criterio: `N=200` tableros por preset, **100% resueltos por
  `solveLogically`**; `N=100` tableros, ms p95 por preset bajo el techo de F1.1.
  Test nuevo `test/no-guess.test.js`.
- **F1.3 Exponerlo como modo.** Toggle o modo de primer nivel (Standard /
  No-guess), persistido. Toca `src/ui/session.js`, `src/ui/persistence.js`
  (`SCHEMA_VERSION` sube), `src/ui/render.js`, `index.html`. Criterio: el modo
  sobrevive un reload y las partidas no-guess se registran aparte.
- **F1.4 Sembrar sin-guess en el modo clasico.** Que el generador acepte una
  semilla explicita (ya existe `deriveSeed`) para que un tablero no-guess sea
  reproducible y compartible. Habilita F4. Criterio: misma semilla -> mismo
  tablero, test determinista.

**Riesgo principal.** Costo de UI en Difícil (23.2 intentos). Mitigacion: F1.1
primero; si el p95 en navegador excede el techo, se cae a perturbacion incremental
(estilo Tatham) o a muestreo uniforme (decision abierta #1).

**Estimacion:** medio (el motor es chico y puro; el costo esta en la medicion y en
el modo persistido).

### F2 - Reparar la deuda de accesibilidad [propuesta]

**Que cambia y por que.** El borde de control mas usado mide 1.34:1 (2.3) y el
kill-switch no reduce nada (2.4). Es deuda de WCAG declarada en el propio
`DESIGN.md` y hoy no pagada.

**Unidades atomicas:**

- **F2.1 Separar el rol decorativo del rol de control.** Agregar `--ctrl-line`
  y migrar **solo los 6 bordes de control** (lineas 145, 273, 316, 454, 566, 583)
  de `--line` a `--ctrl-line`. Los **3 separadores** (107, 173, 231) quedan en
  `--line`. Criterio: `grep -c "border.*var(--ctrl-line)" src/ui/styles.css` da 6;
  `grep -c "border.*var(--line)" src/ui/styles.css` da 3 (los separadores); y el
  test de contraste pasa.
- **F2.2 Extender el guard de contraste.** `test/contrast.test.js` debe cubrir
  `--ctrl-line` contra `--surface`, `--surface-2` y `--bg`, con piso 3:1. Criterio:
  bajar `--ctrl-line` a un valor que falle hace fallar el test (test que falla por
  la razon correcta).
- **F2.3 Alinear `DESIGN.md` con el CSS.** Hoy el `.md` declara `--cell-line`
  #39414d que mide 1.40:1 (el CSS lo corrigio en silencio a #79828f y el test no
  lo atrapa porque lee el CSS, no el `.md`). El documento de sistema deja de
  mentir. Criterio: un test que lea los tokens del `.md` y los compare contra el
  CSS, o que al menos verifique que `--cell-line-decor` no se usa como limite.
- **F2.4 Vocabulario de movimiento.** Definir los tokens de STUDIO (`--ease-out`,
  `--dur-fast/dur/dur-slow`) y las animaciones de revelar, bandera, chording,
  pista, perder y ganar. Regla dura: la bandera nunca anima el borde, solo el
  glifo (el borde es la senal medida de estado). Criterio: `grep -c "@keyframes\|
  transition" src/ui/styles.css` > 0 y ninguna animacion mueve un borde de estado.
- **F2.5 Arreglar el kill-switch.** El bloque de `prefers-reduced-motion` debe
  reducir movimiento real (todo instantaneo, sin translate/scale/shake/stagger,
  conservando el anillo de foco). Criterio: e2e con
  `--force-prefers-reduced-motion` en Chromium, sin desplazamientos, foco visible.

**Riesgo principal.** Subir los overlays (grilla/grano de STUDIO) de z-index
invalidaria las mediciones de contraste de la seccion 3 de STUDIO. Mitigacion:
regla dura de capa, overlays solo en el fondo de pagina, nunca sobre texto ni
bordes de componente; test de contraste corre con los tokens, y el e2e verifica
que los overlays no se apilan.

**Estimacion:** chico para F2.1-F2.3 y F2.5; medio para F2.4 (vocabulario + tests).

### F3 - Subir el techo del solver [propuesta]

**Que cambia y por que.** Hoy el 95% de los pasos en Difícil son conteo simple y
`subset` aporta poco (2.4). Dos mejoras baratas y una cara: el **conteo global de
minas** (no lo usamos; lo confirma el hecho de que `logic.js` no lee `mineCount`)
y la **enumeracion por componente conexa** (el metodo de referencia de MIND). Con
esto, mas tableros pasan el filtro de F1 y las pistas son mejores.

**Dependencia:** F3 **no** es prerequisito de F1 (F1 funciona con el solver de 2
tecnicas, solo con mas intentos), pero F3 **abarata F1** y es prerequisito honesto
de F4 (el post-mortem necesita enumeracion por componente).

**Unidades atomicas:**

- **F3.1 Conteo global de minas como deduccion.** Si `mineCount - banderas`
  iguala las celdas ocultas de un componente, todas son mina; si es 0, todas son
  seguras. `src/core/logic.js`, tecnica nueva `global`. Criterio: test que
  reproduzca un caso donde counting+subset se traban y `global` destraba;
  `N=200 node .knowledge/research/ms-strong.mjs` como cota.
- **F3.2 Enumeracion por componente conexa.** Separar las celdas ocultas en
  componentes, enumerar asignaciones consistentes con tope de celdas, derivar
  seguras/mias por interseccion. `src/core/logic.js` (+ helper puro). Criterio:
  Difícil sube de 48.9% a >= 59.4% de cobertura (cota reforzada medida); test
  `verifyDeduction` para la tecnica nueva.
- **F3.3 Calificar el tablero por tier de tecnica.** Al generar, anotar la
  tecnica mas alta que exige (conteo / subset / global / enumeracion). Base del
  modo ensenanza. Criterio: el tier de un tablero es determinista para su semilla.

**Riesgo principal.** La enumeracion es exponencial: sin tope se cuelga. Mitigacion:
tope de celdas por componente (MIND uso 22) y fallback a "no deducible por ahora".
Criterio de aceptacion incluye el tope, no solo el resultado.

**Estimacion:** medio.

### F4 - Features de jugador: lo barato primero [propuesta]

**Que cambia y por que.** Cierra huecos verificados (2.5) y son las expectativas
base del genero (Windows). Ordenadas por valor/esfuerzo.

**Unidades atomicas:**

- **F4.1 Punto de peso en los numeros.** El glyph que hace que la senal no
  dependa solo del hues (STUDIO seccion 3). Acompana a la paleta.
  Criterio: los 8 numeros se distinguen sin color (test de DOM).
- **F4.2 Marca de duda `?`.** Tercer estado de celda: oculta -> bandera -> duda
  -> oculta. Toca `src/core/game.js` (`toggleFlag` o `cycleMark`), `src/ui/render.js`,
  `a11y.js`, `persistence.js`. **Ojo SPEC:** la forma de `Game` esta congelada; la
  duda agrega un estado, asi que hay que avisar al orquestador y subir
  `SCHEMA_VERSION`. Criterio: ciclo completo por teclado y mouse, label ARIA
  correcto, persistido.
- **F4.3 Stat 3BV + eficiencia (3BV/clics).** Mostrar 3BV y su cociente. Criterio:
  el 3BV de un tablero coincide con `N=500 node .knowledge/research/ms-3bv.mjs`.
- **F4.4 Primer clic de area variable** (celda sola / 3x3 / 5x5). Hoy `safeZoneOf`
  es fijo 3x3. Toca `src/core/game.js`, `presets.js`, UI. Criterio: elegir el area
  cambia cuantas celdas revela el primer clic, medido.
- **F4.5 Post-mortem al perder** (banderas mal puestas + celdas que se podian
  revelar seguro). **Depende de F3.2.** Criterio: sobre una partida perdida, el
  post-mortem no reporta una celda que el solver no podia probar seguro.

**Riesgo principal.** F4.2 toca el contrato congelado de `SPEC.md` (forma de
`Game`) y la a11y (un tercer estado que el lector de pantalla debe anunciar).
Mitigacion: avisar al orquestador, subir schema, y no tocar los labels ARIA
existentes (`revelada`, `oculta`, `bandera`, `mina`, que tienen tests).

**Estimacion:** chico por unidad; F4.5 es medio.

### F5 - Identidad visual CAMPO [propuesta, requiere firma de Gonzo]

**Que cambia y por que.** La direccion de STUDIO (paleta calida, Archivo +
JetBrains Mono, radios 4-8px, hero como placa de campo). Es la de mayor volumen de
obra y la mas discutible, por eso va ultima: el producto ya funciona, esto lo
firma.

**Unidad atomica unica, por slices:**
- Paleta y radios (tokens), luego tipografia, luego hero, luego voz.
- Criterio de cada slice: `test/contrast.test.js` verde con los tokens nuevos y
  `npm test` verde. El texto de voz se entrega como borrador para Gonzo.

**Riesgo principal.** Las fuentes por CDN agregan una dependencia externa de red
(no de runtime) y un flash de fuente. Mitigacion: `display=swap`, preconnect,
fallback de sistema declarado. **Y es un limite del alcance:** "cero dependencias
de runtime" se mantiene, pero "todo local" cambia si la fuente viene de Google.

**Estimacion:** grande.

---

## 4. Lo que NO entra (alcance negativo)

- **Variantes de tablero** (hexagonal, 3D, multijugador): el BRIEF v1 las excluye
  y la v2 no las reabre. Sin fuente primaria que las pida (MIND incognita #5).
- **Ranking online, cuentas, backend, telemetria, anuncios, pagos:** no-objetivos
  del BRIEF, y contradicen "campo local, sin red".
- **Lecciones por tecnica (modo entrenador completo, estilo HoDoKu):** alto
  esfuerzo y depende de F3.3. Se deja la **calificacion por tier** (F3.3) como
  base, pero el modo entrenador queda para v3.
- **Muestreo uniforme sobre el conjunto resoluble (mindsweeper):** es la familia
  tecnica mas fuerte, pero mas obra (WASM/Rust en la referencia). Se ofrece como
  decision abierta #1, no se implementa de entrada.
- **Undo/reverso libre:** rompe la integridad de records (un undo invalida el
  tiempo y el 3BV). Si entra, solo acotado a modo practica, sin record, y eso es
  una decision de producto (no la tomo yo).
- **Mover los 9 bordes de `--line`:** tres son decorativos, no limites de control
  (2.3). Migrar los 9 seria un cambio ciego.

---

## 5. Decisiones abiertas para Gonzo (producto, no tecnicas)

1. **Generador no-guess: rechazo vs muestreo.**
   - *Rechazo* (F1): simple, cero dependencias nuevas, ~1.3/1.9/23.2 intentos por
     tablero [medido], ~64 ms/tablero en Difícil en Node. Riesgo: costo de UI en
     el primer clic en Difícil, aun sin medir en navegador.
   - *Muestreo uniforme* (familia B): mas fuerte, "nunca adivinas" sin toggle y con
     castigo de adivinanza, pero mas obra y probablemente WASM (rompe el "cero
     dependencias" estricto o exige escribir el core en otro lenguaje).
   - **Mi recomendacion:** empezar por rechazo con el solver reforzado (F1 + F3),
     medir en navegador (F1.1) y **no** comprometerse al muestreo hasta ver ese
     numero.

2. **La pista, cuenta en las estadisticas?**
   - Hoy `session` ya cuenta `hintsUsed`, pero no separa records por uso de pista.
     Opciones: (a) una pista invalida el record de tiempo/3BV de esa partida;
     (b) la pista se registra pero no invalida; (c) la pista solo existe en un
     modo practica sin records. Es una definicion de que significa "record" para
     el jugador, no una decision tecnica.

3. **El modo no-guess, es default o opt-in?**
   - Es un modo de primera clase en minesweeper.online y la promesa del BRIEF, pero
     cambia la dificultad real de cada nivel. Si Difícil se vuelve no-guess por
     defecto, deja de ser el Difícil clasico. Definir: default, toggle, o modo
     aparte con su propia tabla de records.

4. **Que firma STUDIO:** la direccion CAMPO, la paleta, la tipografia por CDN y la
   voz. Todo eso es `[propuesta]` hasta su firma. En particular, aceptar una fuente
   por CDN es aceptar una dependencia de red que hoy no existe.

---

## 6. Orden recomendado y por que

```
F2 (a11y, independiente)  ────────────────┐
                                          ├─►  entrega incremental, sin bloqueos
F1.1 (medir en navegador) ─► F1.2 ─► F1.3 ─┐
                                           ├─► F3 (abaratada por F1, base de F4.5)
                                           └─► F4.1-F4.4 ─► F4.5 (necesita F3.2)
F5 (CAMPO, requiere firma) ── al final
```

- **F1 primero, empezando por F1.1**, porque es el criterio #1 (la promesa
  incumplida) y porque el costo de UI es la unica incognita que decide el diseno
  de la fase. Medir antes de implementar.
- **F2 en paralelo** porque es independiente, barata y cierra deuda de a11y
  medida. No bloquea ni depende de nada.
- **F3 despues de F1**: F1 funciona sin F3, pero F3 abarata F1 (mas tableros pasan
  el filtro) y es prerequisito de F4.5. Y F3.3 (tiering) habilita el modo
  ensenanza futuro.
- **F4.1-F4.4 despues de F1/F3** porque comparten la paleta y el generador; F4.5
  **depende de F3.2** (necesita la enumeracion por componente).
- **F5 al final**: mayor volumen, mas discutible, requiere firma. No bloquea
  ninguna funcionalidad.

Dependencias explicitas: F1 desbloquea F4.4 (semilla sembrada) y abarata por F3;
F3.2 desbloquea F4.5; F3.3 desbloquea el modo entrenador (v3).

---

## Verificacion de este plan

| Gate | Resultado |
|---|---|
| Archivo con las 6 secciones | OK (este documento) |
| Guiones largos | 0 (verificado con `check_em_dash.py .`) |
| `git status` sin cambios en `src/` ni `test/` | OK (arbol limpio) |
| Numeros de MIND/STUDIO reproducidos | si, ver seccion 2 de cada uno |
| `npm test` | 168 pass / 0 fail |

Reproduccion completa:
```
cd /Users/gonzoblasco/projects/kanam-minesweeper
npm test
N=500 node .knowledge/research/ms-measure2.mjs
N=200 node .knowledge/research/ms-strong.mjs
N=400 node .knowledge/research/ms-cost.mjs
N=500 node .knowledge/research/ms-3bv.mjs
python3 ~/.openclaw/workspace/scripts/check_em_dash.py .
git status --short
```
