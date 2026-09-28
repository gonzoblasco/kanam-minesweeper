# EVOLUTION-DESIGN - Kanam MINESWEEPER

<!-- project: github.com/gonzoblasco/kanam-minesweeper -->

Estudio de identidad visual, arte y voz (ADR-074). **Es direccion creativa, no
implementacion.** No toca `src/`. Todo lo que propone es cero dependencias de
runtime: una fuente web por CDN, gradientes CSS y SVG inline.

Estado: **borrador para aprobacion de Gonzo.** Nada de aca se publica sin su
firma.

Separacion de metodos, para que no se confunda:

- **[M]** = medido con `python3` (formula WCAG 2.x: luminancia relativa y ratio de
  contraste). Son numeros reproducibles, no juicios.
- **[O]** = opinion editorial: direccion, tono, elecciones de arte.

---

## 1. Diagnostico honesto

El sistema actual no esta roto. Es **competente y frio**, y ahi esta el problema:
se lee como un dashboard oscuro bien hecho, no como un juego con alma. Lo
concreto:

**(a) El borde de control mas usado es invisible. [M]**
`--line: #2a303a` se usa en el CSS como borde real de `.btn`, `.level-card`,
`.chip`, `kbd`, `.stat-card` y el marco del tablero. Medido:

| par | ratio |
|---|---|
| `--line` #2a303a sobre `--surface` #15181e | **1.34:1** |
| `--line` sobre `--surface-2` #1b1f27 | **1.24:1** |
| `--line` sobre `--bg` #0d0f12 | **1.45:1** |

Umbral de limite de componente: 3:1. Falla por mas de un factor de dos.
`DESIGN.md` llama a `--line` "regla decorativa (no limite de control)", pero el CSS
lo usa como limite de control en todos los bordes. Es la contradiccion central del
sistema actual: la contencion visual que se ve "elegante" es, medida, un borde que
casi no existe.

**(b) `DESIGN.md` y `styles.css` ya divergen, y el test no lo atrapa. [M]**
`DESIGN.md` declara `--cell-line: #39414d` como borde de celda con la nota
">= 3:1 sobre cell". Medido: `#39414d` sobre `--cell` #232a34 = **1.40:1**. No
pasa. El CSS lo corrigio en silencio (`--cell-line: #79828f`, 3.72:1) y dejo
`#39414d` como `--cell-line-decor`. O sea: el documento de sistema miente y el
test pasa igual porque lee el CSS, no el `.md`. El sistema de registro no es el
sistema real. [O]

**(c) La silueta es template. [O]** Todos los contenedores son la misma pieza
redondeada: `.stat-card` radio 12, `.board` radio 14, `.level-card` radio 12,
`.btn` radio 10, `.btn--primary` radio 12, `.cell` radio 7. Un tablero redondeado
dentro de una tarjeta redondeada dentro de una pagina con esquinas redondeadas. El
espaciado es generoso y parejo (`2rem 0`, `0.85rem` gap), la tipografia es
`system-ui` + `ui-monospace`. Es exactamente el default de un starter de dashboard
oscuro: prolijo, intercambiable, sin firma.

**(d) Los 8 numeros son el arcoiris de Windows y colisionan. [M] [O]**
`--num-3` es `#ff8a8a` y `--mine` es `#ff5a5a`: mismo rojo. En una celda revelada,
un "3" y una mina jugada comparten familia cromatica. Los ocho tonos (azul,
verde, rojo, violeta, naranja, cian, magenta, gris) no forman un sistema: son ocho
decisiones sueltas. La regla de "color mas peso por numero" esta bien pensada y hay
que conservarla; el set de colores es lo que hay que rehacer como paleta.

**(e) El hero es decoracion que desaparece. [M] [O]** El SVG 150x150 usa
`color: var(--line)` como trazo: a 1.34 a 1.45:1 sobre el fondo, apenas se ve. Es
un "blueprint/nodo de red" generico que no dice nada del buscaminas. El unico
elemento con caracter propio, el nodo naranja, es un circulo de radio 5.

**(f) El movimiento no existe, y el kill-switch reduce la nada. [M]**
No hay un solo `transition` ni un `@keyframes` en `styles.css`. Revelar, marcar,
perder y ganar son instantaneos. El bloque `@media (prefers-reduced-motion:
reduce)` desactiva transiciones que no estan definidas: es codigo muerto que
declara una preocupacion de accesibilidad que el juego todavia no tiene. [O]

**(g) El texto es correcto y anonimo. [O]** "Boom. Reinicia y vuelve a
intentarlo." es lo mas flojo: "Boom" suena a comic y el resto a string de
placeholder. "Partida en curso: el reloj corre." no dice nada. "Despeja el campo"
es un verbo correcto pero gastado. Falta el filo que el brief ya tiene: un juego
que **explica por que**, no que adivina.

---

## 2. La direccion elegida: **CAMPO**

> Un campo de noche, leido en frio.

La identidad es una **placa de relevamiento topografico**: una grilla de lineas
finas sobre un fondo calido casi negro, un unico acento de brasa naranja, y nada
mas saturado que la bandera. El buscaminas no es una consola de arcade: es un
instrumento que medis con la cabeza. La identidad tiene que sonar a eso.

### Por que esta y no las otras tres

- **Arcade retro 8-bit.** La descarte porque contradice el diferencial del
  producto (deduccion verificable, no reflejos) y porque la tipografia pixelada
  destroza el texto chico por debajo de AA. Un juego que presume accesibilidad de
  fabrica no puede apoyarse en una fuente que no se lee a 12px.
- **Terminal verde monocromo.** La descarte porque todo el valor del tablero esta
  en los 8 numeros, que necesitan 8 hues distinguibles. Un solo hues los aplasta,
  y el verde choca con `--ok`.
- **Neon glass / mesh gradient.** Es la trampa donde ya cayo la v1: mas
  decoracion, menos legibilidad, y los degradados invalidan las mediciones de
  contraste sobre superficie plana.

CAMPO gana porque **(1)** mejora el editorial dark actual en lugar de reemplazarlo;
**(2)** convierte el diferencial real (leer, explicar, verificar) en forma visual;
**(3)** se implementa sin una dependencia: una fuente, gradientes CSS y SVG inline.

### Paleta

Se mueve el fondo de un near-black **neutro** (#0d0f12, azulado) a un near-black
**calido** (#0a0c10, apenas hacia el azul-verde) y los paneles a un slate calido.
Es un cambio chico en numeros y grande en sensacion: deja de ser "gris de
dashboard" y pasa a ser "papel de campo con luz baja". El naranja se conserva:
funciona y es la firma. Se oscurece lo justo para dar sombra real a las celdas
reveladas.

### Tipografia

- **Display y UI: `Archivo`** (Google Fonts CDN, subset latin, `display=swap`).
  Es grotesca, ancha y con caracter, y hace que un headline en 700 con tracking
  negativo se vea decidido y no "default". Reemplaza a `system-ui`.
- **Mono: `JetBrains Mono`** (Google Fonts CDN, latin). Reemplaza a
  `ui-monospace`. Tiene altura-x alta y numeros tabulares: los labels mono con
  tracking y el cronometro ganan legibilidad y perfil.
- Se usan **dos familias, tres roles**: display (Archivo 700, hero), UI (Archivo
  400/600, cuerpo y controles), mono (JetBrains 400/700, labels, valores, teclas).
  Archivo cumple display y UI para no cargar una tercera familia.
- Fallback de sistema intacto por si el CDN no responde:
  `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif` y
  `ui-monospace, "SF Mono", Menlo, Consolas, monospace`.

### Iconografia

Tres glifos y nada mas, reusados en todo el juego:

1. **Brasa** - cuadradito lleno en `--accent`. Es el nodo de la placa: marca lo
   que importa (nivel activo, nodo del hero).
2. **Cruz fina** - dos hairlines de 1px en `--cell-line` a 40% para celda segura
   o revelada sin numero.
3. **Gallardete** - bandera. Se dibuja con SVG inline de 3 trazos (mastil, pano,
   base) en vez del emoji de bandera actual, para que el color sea exacto y no
   dependa del set de emojis del sistema. El emoji se conserva como fallback si el
   SVG no monta.

El isotipo del lockup pasa de "cuadrado redondeado con cuadradito centrado" a una
**baldosa 3x3**: cuadro outline, grilla interna de hairlines, una celda llena en
`--accent` y una celda con el gallardete. Dice "campo" en 18px.

### Textura y grano

Dos capas, ambas **por debajo del contenido**:

1. **Grilla hairline** de 24px, hecha con dos `repeating-linear-gradient` en
   `--line`, sobre un pseudo-elemento con `opacity: 0.5` (efectivo ~0.2 alpha). Da
   el motivo de papel milimetrado del hero y del fondo de pagina.
2. **Grano** de pelicula: `feTurbulence` de SVG inline como data URI en un
   `::after` fijo, `opacity: 0.03`, `mix-blend-mode: overlay`.

**Restriccion dura:** grilla y grano viven solo en la capa de fondo de la pagina,
nunca sobre tarjetas, tablero ni celdas. Los ratios medidos de la seccion 3 valen
solo mientras los overlays no se apilen encima de texto ni de bordes de componente.
Si DEV los sube de capa, invalida las mediciones.

### Ilustracion del hero

Se reemplaza el path abstracto por una **placa de campo real**: un SVG de una
grilla 6x6 de celdas hairline (1px, `--cell-line` a 40%), con cinco celdas
reveladas mostrando los numeros 1, 2, 3 y 1 en sus colores del sistema, una celda
con gallardete y una celda explotada. Es el mecanismo del juego como imagen, no un
adorno. Se apoya sobre la grilla de 24px y no usa imagenes de stock: es SVG inline
y cero deps.

---

## 3. Tokens propuestos (hex) y contraste medido [M]

Todos los ratios de esta seccion estan medidos con `python3` sobre la formula
WCAG 2.x. Umbrales: texto `>= 4.5:1`, limite de componente y estado `>= 3:1`.

### Superficies

```css
--bg:        #0a0c10;   /* fondo de pagina, near-black calido */
--surface:   #121620;   /* panel / tarjeta */
--surface-2: #1a1f2b;   /* superficie elevada */
--line:      #2b3240;   /* SOLO decorativo: reglas, grilla, separadores. NO es limite de control */
--ctrl-line: #626c7a;   /* NUEVO: el limite real de botones, cards y chips */
```

`--line` sigue existiendo y sigue siendo decorativo, pero se le quita de encima el
rol de limite de control. Ese rol pasa a `--ctrl-line`.

| par | ratio | umbral |
|---|---|---|
| `--ctrl-line` #626c7a sobre `--surface` #121620 | **3.40:1** | 3.0 [M] OK |
| `--ctrl-line` sobre `--surface-2` #1a1f2b | **3.09:1** | 3.0 [M] OK |
| `--ctrl-line` sobre `--bg` #0a0c10 | **3.68:1** | 3.0 [M] OK |
| `--line` #2b3240 sobre `--surface` | 1.41:1 | decorativo, no aplica [M] |

`--line` sigue fallando 3:1 y **esta bien que falle**: ya no es un limite. Todo
borde de control debe usar `--ctrl-line`. Si DEV deja `.btn { border: 1px solid
var(--line) }` como hoy, el borde queda en 1.41:1 y el defecto del punto 1(a)
continua.

### Texto

```css
--ink:   #e9edf2;   /* texto principal */
--muted: #9aa4b2;   /* texto secundario */
--faint: #6b7480;   /* SOLO decorativo, nunca texto informativo */
```

| par | ratio | umbral 4.5 [M] |
|---|---|---|
| `--ink` sobre `--bg` | **16.65:1** | OK |
| `--ink` sobre `--surface` | **15.38:1** | OK |
| `--ink` sobre `--surface-2` | **14.01:1** | OK |
| `--muted` sobre `--bg` | **7.76:1** | OK |
| `--muted` sobre `--surface` | **7.17:1** | OK |
| `--muted` sobre `--surface-2` | **6.53:1** | OK |
| `--faint` sobre `--bg` | 4.13:1 | **no es texto** (decorativo) [M] |

### Acento

```css
--accent:      #ff7a1a;
--accent-ink:  #1a0e05;   /* texto sobre el acento */
--accent-soft: #241811;   /* tinte de la card activa */
--accent-line: #c25f13;   /* borde de la card activa, y regla del acento */
```

| par | ratio | umbral [M] |
|---|---|---|
| `--accent` #ff7a1a sobre `--bg` | **7.50:1** | 4.5 OK |
| `--accent` sobre `--surface` | **6.93:1** | 4.5 OK |
| `--accent` sobre `--surface-2` | **6.32:1** | 4.5 OK |
| `--accent-ink` #1a0e05 sobre `--accent` | **7.26:1** | 4.5 OK |
| `--accent` sobre `--hint-bg` #2a2410 | **5.93:1** | 4.5 OK |
| `--accent-line` #c25f13 sobre `--surface` | **4.25:1** | 3.0 OK |
| `--accent-line` sobre `--bg` | **4.60:1** | 3.0 OK |
| `--accent-soft` #241811 sobre `--surface` | 1.05:1 | tinte, no limite [M] |

Nota honesta: `--accent-soft` a 1.05:1 **no distingue nada por si solo**. La card
activa se reconoce por el borde `--accent-line` medido, por el nombre en `--ink` y
por `aria-checked`. El tinte es refuerzo, nunca la senal. Igual que hoy.

### Tablero

```css
--cell:      #1a2029;   /* celda oculta */
--cell-hover:#232b37;
--cell-open: #0c0f14;   /* revelada: mas oscura que la oculta */
--cell-line: #7d8794;   /* borde de celda (limite real) */
--cell-seam: #39414d;   /* costura interior de la revelada: decorativa */
```

| par | ratio | umbral [M] |
|---|---|---|
| `--cell-line` #7d8794 sobre `--cell` | **4.50:1** | 3.0 OK |
| `--cell-line` sobre `--cell-hover` | **3.92:1** | 3.0 OK |
| `--cell-line` sobre `--cell-open` | **5.27:1** | 3.0 OK |
| `--cell-line` sobre `--surface` | **4.96:1** | 3.0 OK |
| `--cell-line` sobre `--bg` | **5.37:1** | 3.0 OK |
| `--ink` sobre `--cell` | **13.93:1** | 4.5 OK |
| `--muted` sobre `--cell` | **6.49:1** | 4.5 OK |
| `--cell-seam` #39414d sobre `--cell` | 1.59:1 | decorativa [M] |

`--cell` pasa de #232a34 (neutro) a #1a2029 (slate calido) y `--cell-open` de
#0f1216 a #0c0f14, para que el contraste oculta/revelada se sienta mas profundo
sin bajar ningun borde del piso.

### Estado

```css
--flag:     #ff7a1a;
--mine:     #ff5a5a;
--exploded: #3a1113;
--focus:    #ff9d4d;
--ok:       #5ee08a;
```

| par | ratio | umbral [M] |
|---|---|---|
| `--flag` #ff7a1a sobre `--cell` | **6.28:1** | 3.0 OK |
| `--mine` #ff5a5a sobre `--cell-open` | **6.27:1** | 3.0 OK |
| `--mine` sobre `--exploded` #3a1113 | **5.41:1** | 3.0 OK |
| `--focus` #ff9d4d sobre `--bg` | **9.49:1** | 3.0 OK |
| `--focus` sobre `--surface` | **8.77:1** | 3.0 OK |
| `--ok` #5ee08a sobre `--bg` | **11.65:1** | 3.0 OK |
| `--ok` sobre `--surface` | **10.77:1** | 3.0 OK |

### Pista

```css
--hint-bg:   #2a2410;
--hint-line: #ffc457;
```

| par | ratio | umbral 4.5 [M] |
|---|---|---|
| `--ink` sobre `--hint-bg` | **13.15:1** | OK |
| `--hint-line` #ffc457 sobre `--hint-bg` | **9.78:1** | OK |

### Numeros (texto sobre `--cell-open` #0c0f14)

Se rehace el set para que sea un sistema y se aleje del arcoiris. Cada valor
mantiene su par (color + peso): 1 a 4 en 500, 5 a 8 en 900. Ademas cada numero
lleva un **punto de peso** (glyph), asi la senal no depende solo del hues.

```css
--num-1: #8fb8ff;  --num-2: #63d99a;  --num-3: #ff8a8a;  --num-4: #b9a6ff;
--num-5: #ffbf47;  --num-6: #45d4c8;  --num-7: #e58cff;  --num-8: #c9d4e0;
```

| token | ratio sobre #0c0f14 | umbral 4.5 [M] |
|---|---|---|
| `--num-1` #8fb8ff | **9.57:1** | OK |
| `--num-2` #63d99a | **10.90:1** | OK |
| `--num-3` #ff8a8a | **8.46:1** | OK |
| `--num-4` #b9a6ff | **9.10:1** | OK |
| `--num-5` #ffbf47 | **11.70:1** | OK |
| `--num-6` #45d4c8 | **10.52:1** | OK |
| `--num-7` #e58cff | **8.71:1** | OK |
| `--num-8` #c9d4e0 | **12.78:1** | OK |

Cambio de criterio: `--num-3` se aleja del rojo de `--mine` (#ff8a8a vs #ff5a5a,
familias distintas) y `--num-6` pasa de cian a verde-agua. El set queda: azules
(1, 4, 8), verdes (2, 6), calidos (3, 5), violeta (7). Los 8 siguen pasando AA con
margen.

### Geometria y tipografia

```css
--radius-sm:   4px;    /* botones, kbd, celdas */
--radius-md:   8px;    /* tarjetas, tablero */
--radius-pill: 999px;  /* solo el chip */
```

Se baja el radio: de 7-14px a 4-8px. Es la correccion anti-template mas barata,
un cambio de dos valores que le saca el aire de "burbuja SaaS" a toda la
superficie. Solo el chip conserva la pildora.

```css
--font-display: "Archivo", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
--font-ui:      "Archivo", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
--font-mono:    "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;

--step-hero: clamp(2.6rem, 7vw, 4.8rem);   /* peso 700, tracking -0.04em, line-height 0.98 */
--step-0:    1rem;                          /* cuerpo */
--step-label:0.7rem;                        /* mono, uppercase, tracking 0.22em */
```

---

## 4. Movimiento

Hoy no hay animacion (punto 1(f)). La propuesta define un vocabulario chico,
compartido, con tokens:

```css
--ease-out:   cubic-bezier(0.2, 0.8, 0.2, 1);
--ease-in-out:cubic-bezier(0.4, 0, 0.2, 1);
--dur-fast:   90ms;
--dur:        140ms;
--dur-slow:   260ms;
```

| momento | que se anima | duracion | easing |
|---|---|---|---|
| **Revelar** una celda | fondo: crossfade `--cell` a `--cell-open`; numero: `opacity 0 a 1` + `translateY(2px a 0)` | 140ms | `--ease-out` |
| **Flood fill** (cascada) | vecinos revelados por anillo, desfasados 14ms por anillo, tope 12 anillos | 140ms + stagger, max ~168ms | `--ease-out` |
| **Marcar bandera** | solo el glifo: `scale 0.7 a 1.06 a 1`; el borde cambia instantaneo | 180ms | `--ease-out` |
| **Chording** | el numero origen se hunde 1px; despues los vecinos entran con la cascada de flood fill | 90ms + revelado | `--ease-out` |
| **Pista** | borde de las celdas de la pista: pulso de alpha 0.5 a 1, dos ciclos; la regla del panel crece de 4px a 6px | 600ms | `--ease-in-out` |
| **Perder** (explotada) | la celda explotada tiembla 3px (`translateX -3, 3, -2, 2, 0`); despues las minas entran con opacidad desfasadas 10ms por celda | 220ms + stagger | `--ease-in-out` |
| **Ganar** | onda de asentado: cada celda revelada baja su borde a `--cell-seam` y su fondo a `--bg`, desfasadas 6ms por indice; el numeral del hero pulsa una vez | 260ms + stagger | `--ease-out` |
| **Hover** de boton/card | borde y fondo | 120ms | `--ease-out` |

Criterios: nada de confeti (seria ruido y sumaria peso), nada de flash de pantalla
completa al perder (agresivo y molesto), toda la cascada tiene tope de anillos para
que un tablero 30x16 no tarde 400ms en asentarse, y la bandera nunca anima el
borde, solo el glifo, porque el borde es la senal medida de estado.

### `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0ms !important;
    animation-duration: 0ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
}
```

Con el vocabulario de arriba, este bloque **por fin reduce movimiento real**: todo
cambio de estado pasa a instantaneo, ningun elemento se desplaza (se eliminan
translate, scale, shake y el stagger de flood fill), y se conserva el anillo de
foco. No se reemplaza por opacidad: instantaneo es lo correcto para quien pidio
menos movimiento.

---

## 5. Voz

La voz es **seca, tecnica, sin relleno, y no pide permiso.** Suena a alguien que ya
leyo el campo y te lo esta contando. Sin emojis, sin signos de admiracion, sin
"excelente". Es **borrador**: el texto final es de Gonzo.

### Antes -> despues

| lugar | antes | despues |
|---|---|---|
| Eyebrow del hero | `Lee - marca - revela` | `Un campo, leido en frio` |
| Headline, linea 1 | `Piensa en frio.` | `El campo no se adivina.` |
| Headline, linea 2 | `Despeja el campo.` | `Se lee.` |
| Bajada del hero | `Primer clic siempre seguro. Las pistas explican el porque, no solo el resultado. Y cada razonamiento se puede verificar contra el tablero.` | `El primer clic nunca mata: la mina se coloca despues, lejos de tu celda. Las pistas no dicen donde hay mina, dicen por que. Cada frase se verifica contra el tablero.` |
| Chip de estado | `Campo local - sin conexion` | `Campo en tu equipo - sin red` |
| Estado `ready` | `Primera jugada segura: despeja el campo con calma.` | `Nada pisado. El primer clic no mata.` |
| Estado `playing` | `Partida en curso: el reloj corre.` | `El reloj corre. Lee antes de pisar.` |
| Estado `won` | `Campo despejado.` | `Campo despejado. Ninguna suposicion.` |
| Estado `lost` | `Boom. Reinicia y vuelve a intentarlo.` | `Mina. Vuelve a leer el campo.` |
| Boton principal | `Nuevo campo` | `Campo nuevo` |
| Boton pista | `Pista` | `Explicar` |
| Modo bandera | `Modo bandera: off` / `on` | `Bandera: off` / `on` |
| Pista sin deduccion | `No hay deduccion logica disponible ahora: marca banderas o revela otra zona.` | `Aca no hay nada que leer todavia. Marca una bandera o abre otra zona.` |
| Leyenda, chording | `Doble click` + `chording` | `Doble click` + `abrir alrededor` |
| Leyenda, revelar | `revelar` | `revelar` (se conserva: es el termino que tambien usan los labels ARIA) |
| Linea de stats | `Jugadas N - Ganadas N - Racha N (max N) - Mejor tiempo N` | `Campos N - Despejados N - Racha N (record N) - Mejor tiempo N` |
| Header de seccion | `Campo de minas` | `El campo` |

### Notas de voz [O]

- El cambio de fondo es "no se adivina / se lee": dice el diferencial del producto
  en dos lineas. "Piensa en frio" era una instruccion; "no se adivina" es una
  afirmacion, y las afirmaciones tienen voz.
- "Chording" es jerga de buscaminas: un jugador nuevo no sabe que es. "Abrir
  alrededor" se entiende sin manual.
- Los labels ARIA (`revelada`, `oculta`, `bandera`, `mina`) **no se tocan**: son
  contrato funcional y tienen tests. La voz nueva es visual; el texto de lector de
  pantalla sigue neutro y estable.
- Los nombres de nivel (`Facil`, `Medio`, `Dificil`) y los labels de stats se
  conservan por claridad. La voz no es excusa para confundir.

---

## 6. Que hay que verificar al implementar (para DEV)

1. Migrar todo borde de control de `--line` a `--ctrl-line`. Si queda `--line` en
   `.btn`, `.level-card`, `.chip`, `kbd`, `.stat-card`, el defecto 1(a) sigue vivo.
2. Alinear `DESIGN.md` con el CSS: hoy el `.md` declara un `--cell-line` que mide
   1.40:1. El documento de sistema debe dejar de mentir.
3. Extender `test/contrast.test.js` para cubrir `--ctrl-line` contra `--surface`,
   `--surface-2` y `--bg`, y **quitar la tolerancia implicita** que dejo pasar el
   1.40:1 (el test no verifica `--cell-line-decor` porque no lo lee; hoy no hay
   nada que impida que un limite decorativo se use como limite real).
4. Los overlays de grilla y grano no deben apilarse sobre texto ni bordes: suben de
   z-index y las mediciones de la seccion 3 dejan de valer.
5. Las fuentes entran por CDN con preconnect y `display=swap`; el fallback de
   sistema queda declarado por si el CDN no responde.
6. El movimiento nuevo debe pasar por el kill-switch de `prefers-reduced-motion`;
   hoy ese bloque no reduce nada.

---

## 7. Lo medido y lo opinado

**Medido [M]** (reproducible con python3, formula WCAG 2.x):

- `--line` #2a303a como limite de control: 1.24 a 1.45:1, falla 3:1.
- `--cell-line` declarado en `DESIGN.md` (#39414d): 1.40:1, falla 3:1.
- Los 8 numeros actuales pasan AA (8.27 a 13.33:1) pero `num-3` y `mine` comparten
  familia.
- Toda la paleta propuesta de la seccion 3 pasa los umbrales; ningun token se
  propuso por debajo del piso.
- No hay transiciones ni keyframes en `styles.css`.

**Opinado [O]** (juicio editorial, discutible):

- La direccion CAMPO y el rechazo de arcade, terminal y neon.
- La eleccion de Archivo y JetBrains Mono, y la baja de radios a 4-8px.
- La voz propuesta de la seccion 5 y cada reemplazo de copy.
- La placa de campo como ilustracion del hero y el isotipo de baldosa 3x3.

Nada de este documento se publica sin la aprobacion de Gonzo.
