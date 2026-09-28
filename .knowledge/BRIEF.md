# BRIEF - Kanam MINESWEEPER

<!-- project: github.com/gonzoblasco/kanam-minesweeper -->

## Que

Buscaminas clasico, jugable en el navegador, offline-first (PWA), con motor de
tablero propio, pistas que explican el razonamiento y accesibilidad de fabrica.

## Por que

Cierra la trilogia de juegos de Kanam OS (Tetris, Sudoku) con el estandar de
calidad ya probado: vanilla JS + Vite, cero dependencias de runtime, motor puro
y testeable, PWA y a11y desde el diseño. Ademas es la primera pieza construida
de punta a punta con la arquitectura multi-agente (ADR-073) y el pipeline A/B
asimetrico (ADR-077): orquestacion real, no demo.

El buscaminas tiene un problema de diseño conocido: el azar puede forzar
jugadas a ciegas. Ese es justamente el diferencial a resolver, igual que en
Sudoku fueron los hints que explican.

## Alcance de la v1

**Buscaminas clasico 9x9/16x16/30x16, ejecutado mejor.** Sin variantes
(hexagonal, no-adivinanza estricta, 3D, multijugador) en la v1.

## Imprescindibles

1. **Primer clic siempre seguro.** La mina se coloca despues del primer clic, y
   nunca en la celda elegida ni en sus vecinas. Nunca se arranca perdiendo.
2. **Pistas que explican.** No un "aca hay mina": un "esta celda es segura
   porque el 2 de la fila 3 ya tiene sus dos minas marcadas". El solver expone
   el paso logico, no solo la respuesta.
3. **Marcado, chording y bandera de duda.** Click izquierdo revela, derecho
   marca bandera, doble clic (o click del medio) hace chording sobre un numero
   ya satisfecho. Modo bandera para touch.
4. **Timer, estadisticas e historial.** Tiempo por partida, mejores tiempos por
   dificultad, partidas jugadas/ganadas, racha.
5. **Accesibilidad de fabrica.** Grilla navegable por teclado, roles y labels
   ARIA correctos, foco visible, contraste AA, nada que dependa solo del color.

## No-objetivos de la v1

- Variantes de tablero y modos experimentales.
- Ranking online, cuentas, backend, telemetria.
- Anuncios, pagos, suscripciones.
- Multijugador.

## Stack

- **Vanilla JS (ES modules) + Vite.** El tablero es estado + DOM; un framework
  agrega peso y ceremonia sin devolver nada. Mismo criterio que kanam-sudoku.
- **Cero dependencias de runtime.** El motor y el solver se escriben.
- **PWA** (manifest + service worker) para jugar offline e instalarlo.
- **localStorage** para partidas, estadisticas y preferencias.
- **Tests con `node --test`** sobre el motor puro (sin DOM).

## Estado

- [x] Discovery / Definition (2026-09-28)
- [ ] En desarrollo
- [ ] Live
- [ ] Archivado

## Decisiones clave

- **Primer clic seguro, garantizado.** Se difiere la colocacion de minas hasta
  el primer `reveal`. Es la unica forma de prometer "nunca arrancas perdiendo".
- **Solver explicable, no solo solucionador.** El motor expone *por que* una
  celda es segura o es mina; el mismo codigo sirve para el hint y para medir si
  el tablero se resuelve sin adivinar.
- **Dos tecnicas, honestas y verificables:** conteo por vecindad y subconjuntos
  (cubre 1-1, 1-2, 1-2-1, 1-2-2-1 y generalizaciones). Nada de tecnicas que no
  sepamos explicar con un texto que cite los numeros reales.
- **UI con logica pura separada del DOM**, para testear con `node --test` sin
  sumar jsdom.
