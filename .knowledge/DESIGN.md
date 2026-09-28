# DESIGN - Kanam MINESWEEPER

<!-- project: github.com/gonzoblasco/kanam-minesweeper -->

Sistema visual **editorial dark**. Reemplaza la paleta clara de la v1: no es un
retoque de color, es la capa de presentacion completa.

Referencia (captura de Gonzo, 2026-09-28, hecha con Manus AI): fondo near-black,
un naranja como unico acento, headline a dos tonos, micro-labels monoespaciados
con tracking, cards de nivel con estado activo, celda grande y redondeada.

## Regla dura

**La accesibilidad no se negocia por estetica.** Todo token de abajo esta medido
contra WCAG AA con `test/contrast.test.js`. Si un cambio de color baja de los
umbrales, el test falla y el cambio no entra. Umbrales: texto `>= 4.5:1`,
limites de componente y estado `>= 3:1`.

## Tokens

```css
:root {
  /* superficies */
  --bg: #0d0f12;            /* fondo de pagina */
  --surface: #15181e;       /* panel / card */
  --surface-2: #1b1f27;     /* superficie elevada */
  --line: #2a303a;          /* regla decorativa (no limite de control) */

  /* texto */
  --ink: #f5f6f7;           /* texto principal */
  --muted: #98a0ab;         /* texto secundario */
  --faint: #6b7480;         /* SOLO decorativo, no texto informativo */

  /* acento (unico) */
  --accent: #ff7a1a;
  --accent-ink: #1a0e05;    /* texto sobre el acento (7.26:1) */
  --accent-soft: rgba(255, 122, 26, 0.12);  /* tinte de card activa */
  --accent-line: #b85712;   /* borde de card activa (>= 3:1 sobre surface) */

  /* tablero */
  --cell: #232a34;          /* celda oculta */
  --cell-hover: #2c3542;
  --cell-open: #0f1216;     /* celda revelada: claramente mas oscura */
  --cell-line: #79828f;     /* borde de celda: es el valor que renderiza el CSS y el que
                              verifica test/contrast.test.js (3.72:1 sobre cell, 4.83:1 sobre
                              cell-open, 4.57:1 sobre surface; piso 3:1). El valor viejo
                              #39414d daba 1.40:1 y NO cumplia. Regla: si el doc y el CSS
                              discrepan, manda el CSS (es lo que se ve) y el doc se alinea;
                              test/design-css.test.js falla ante cualquier divergencia. */
  --ctrl-line: #626c7a;     /* borde de controles: 3.34:1 sobre surface, 3.61:1 sobre bg
                              (>= 3:1). --line es SOLO decorativo, nunca borde de control. */
  --flag: #ff7a1a;
  --mine: #ff5a5a;
  --exploded: #3a1113;

  /* pista */
  --hint-bg: #2a2410;
  --hint-line: #ffc457;     /* >= 4.5:1 como texto sobre --hint-bg */

  /* numeros (AA sobre --cell-open) */
  --num-1: #7cb0ff;
  --num-2: #5ee08a;
  --num-3: #ff8a8a;
  --num-4: #b3a4ff;
  --num-5: #ffa94d;
  --num-6: #4dd6e8;
  --num-7: #f08cf0;
  --num-8: #d3dae3;

  --focus: #ff9d4d;         /* anillo de foco, >= 3:1 sobre bg */
}
```

## Componentes

### Header
- Lockup: marca `KANAM` (con marca grafica) + `MINESWEEPER` en mono, tracking
  amplio, size chico.
- Chip de estado a la derecha: punto verde + "Campo local - sin conexion"
  (el juego es offline-first de verdad).
- Regla fina debajo.

### Hero
- Numeral de seccion: `01` en naranja + label mono `LEE - MARCA - REVELA`.
- Headline a **dos tonos**: linea 1 en `--ink`, linea 2 en `--accent`.
  Ej.: "Piensa en frio." / "Despeja el campo."
- Bajada en `--muted`, dos o tres lineas.
- A la derecha, marca grafica geometrica (la misma del isotipo) con lineas finas
  en `--line` y un nodo naranja.

### Nivel (selector de dificultad)
- Label mono `NIVEL`.
- Tres cards en fila: nombre + `9 x 9 - 10 minas`.
- **Estado activo:** borde `--accent-line`, fondo `--accent-soft`, nombre en
  `--ink`. **Estado inactivo:** borde `--line`, nombre en `--muted`.
- El estado activo se marca ademas con `aria-checked` / `aria-pressed`: **no
  depende solo del color**.
- Boton primario `Nuevo campo` a la derecha: fondo `--accent`, texto
  `--accent-ink`, radio grande.

### Tablero
- Label `TABLERO` + dimensiones en mono (`9 x 9`).
- Titulo del nivel actual + estado a la derecha (punto + "Primera jugada segura:
  despeja el campo con calma.").
- Grid con gaps, celda `--cell` radio marcado, borde `--cell-line`.
- Revelada: `--cell-open`, numero en `--num-N`, **y** peso/tamano distinto por
  numero (nada depende solo del color).
- Leyenda de controles abajo: `Click` revelar, `Click derecho` marcar,
  `Modo bandera`. Teclas en mono + texto en `--muted`.

### Footer de estado
- Dos cards lado a lado: `MINAS RESTANTES` y `TIEMPO`, con label mono chico y
  valor grande en mono.
- Region `aria-live` con el estado (jugando / ganaste / perdiste).

## Reglas transversales

- Tipografia por rol: headline grande y ajustado; labels mono en mayuscula con
  `letter-spacing`; cuerpo en sans legible.
- Espaciado generoso, reglas finas (`--line`), esquinas redondeadas.
- Un solo acento. El naranja es la unica cosa que "grita".
- `prefers-reduced-motion` respetado. Foco visible siempre.
- Cero dependencias: CSS a mano.
