// WCAG AA contrast guard for the UI palette.
//
// Why this test exists: the palette is picked by eye, and an adversarial review
// found `--hint-line` measured 4.35:1 as TEXT on `--hint-bg`, below the 4.5:1
// AA floor - on the hint text, the differentiator of the game. A colour chosen
// "by value" is not a verified colour. This test reads the real CSS variables
// so a recolour (like the editorial dark system) cannot silently drop below AA.
//
// It is pure (no DOM): it parses `src/ui/styles.css` and does the math.
//
// Thresholds are fixed: text >= 4.5:1, component boundary and state >= 3:1.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const CSS = readFileSync(new URL("../src/ui/styles.css", import.meta.url), "utf8");

function cssVar(name) {
  const m = CSS.match(new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{3,8})`));
  assert.ok(m, `variable --${name} not found in styles.css`);
  return m[1];
}

function channel(c) {
  c /= 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((ch) => ch + ch).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

const AA_TEXT = 4.5;
const AA_UI = 3.0;

test("body text on every surface meets AA", () => {
  for (const [fg, bg] of [
    ["ink", "bg"],
    ["ink", "surface"],
    ["ink", "surface-2"],
    ["muted", "bg"],
    ["muted", "surface"],
    ["muted", "surface-2"],
  ]) {
    const r = contrast(cssVar(fg), cssVar(bg));
    assert.ok(r >= AA_TEXT, `${fg} on ${bg} = ${r.toFixed(2)}:1 (need >= ${AA_TEXT})`);
  }
});

test("the accent reads as text on the dark surfaces", () => {
  // The hero headline line 2 and the section numeral are accent-coloured text.
  for (const bg of ["bg", "surface"]) {
    const r = contrast(cssVar("accent"), cssVar(bg));
    assert.ok(r >= AA_TEXT, `accent on ${bg} = ${r.toFixed(2)}:1 (need >= ${AA_TEXT})`);
  }
});

test("text on the accent button is readable", () => {
  const r = contrast(cssVar("accent-ink"), cssVar("accent"));
  assert.ok(r >= AA_TEXT, `accent-ink on accent = ${r.toFixed(2)}:1 (need >= ${AA_TEXT})`);
});

test("number palette meets AA on the revealed cell", () => {
  for (let n = 1; n <= 8; n++) {
    const r = contrast(cssVar(`num-${n}`), cssVar("cell-open"));
    assert.ok(r >= AA_TEXT, `num-${n} = ${r.toFixed(2)}:1 (need >= ${AA_TEXT})`);
  }
});

test("the hint text is readable (the defect this test locks in)", () => {
  // `--hint-line` is used as text (the "?" marker and the hint rule), on both
  // the hint background and the panel.
  for (const bg of ["hint-bg", "surface"]) {
    const r = contrast(cssVar("hint-line"), cssVar(bg));
    assert.ok(r >= AA_TEXT, `hint-line on ${bg} = ${r.toFixed(2)}:1 (need >= ${AA_TEXT})`);
  }
});

test("the hint body text meets AA on the hint background", () => {
  const r = contrast(cssVar("ink"), cssVar("hint-bg"));
  assert.ok(r >= AA_TEXT, `ink on hint-bg = ${r.toFixed(2)}:1 (need >= ${AA_TEXT})`);
});

test("the cell boundary meets the UI floor on every cell surface", () => {
  // `--cell-line` is the real boundary of the hidden cell: it must be visible
  // against the hidden cell, the revealed cell and the panel the board sits on.
  for (const bg of ["cell", "cell-open", "surface"]) {
    const r = contrast(cssVar("cell-line"), cssVar(bg));
    assert.ok(r >= AA_UI, `cell-line on ${bg} = ${r.toFixed(2)}:1 (need >= ${AA_UI})`);
  }
});

test("control borders meet the UI floor on every surface they sit on (F2.2)", () => {
  // `--ctrl-line` is the limit of a UI component (buttons, cards, chip, board,
  // kbd): WCAG 1.4.11 requires 3:1. `--line` is decorative (separators) and is
  // deliberately NOT held to this floor.
  for (const bg of ["surface", "surface-2", "bg"]) {
    const r = contrast(cssVar("ctrl-line"), cssVar(bg));
    assert.ok(r >= AA_UI, `ctrl-line on ${bg} = ${r.toFixed(2)}:1 (need >= ${AA_UI})`);
  }
});

test("no control border uses the decorative --line (F2.1 regression guard)", () => {
  // The defect was `--line` (1.24:1) used as a control border. This fails if a
  // control border regresses to the decorative token. Control blocks are the
  // ones that also declare a background or a min-height/interactive role; the
  // allowed --line uses are `border-bottom` separators only.
  const controlBorder = /border:\s*1px\s+solid\s+var\(--line\)/g;
  const hits = CSS.match(controlBorder) || [];
  assert.equal(
    hits.length,
    0,
    `found ${hits.length} control border(s) still on --line; use --ctrl-line`,
  );
  // and the separators must still be on --line (they are the only allowed use)
  const separators = (CSS.match(/border-bottom:\s*1px\s+solid\s+var\(--line\)/g) || []).length;
  assert.ok(separators >= 3, `expected >= 3 decorative separators on --line, found ${separators}`);
});

test("the active level boundary and accent line meet the UI floor", () => {
  for (const bg of ["surface", "bg"]) {
    const r = contrast(cssVar("accent-line"), cssVar(bg));
    assert.ok(r >= AA_UI, `accent-line on ${bg} = ${r.toFixed(2)}:1 (need >= ${AA_UI})`);
  }
});

test("flag and mine state colours meet the UI contrast floor", () => {
  const flag = contrast(cssVar("flag"), cssVar("cell"));
  assert.ok(flag >= AA_UI, `flag on cell = ${flag.toFixed(2)}:1 (need >= ${AA_UI})`);
  const flagOpen = contrast(cssVar("flag"), cssVar("cell-open"));
  assert.ok(flagOpen >= AA_UI, `flag on cell-open = ${flagOpen.toFixed(2)}:1 (need >= ${AA_UI})`);
  const mine = contrast(cssVar("mine"), cssVar("cell-open"));
  assert.ok(mine >= AA_UI, `mine on cell-open = ${mine.toFixed(2)}:1 (need >= ${AA_UI})`);
});

test("focus ring and the offline status dot meet the UI floor", () => {
  for (const bg of ["bg", "surface"]) {
    const focus = contrast(cssVar("focus"), cssVar(bg));
    assert.ok(focus >= AA_UI, `focus on ${bg} = ${focus.toFixed(2)}:1 (need >= ${AA_UI})`);
    const ok = contrast(cssVar("ok"), cssVar(bg));
    assert.ok(ok >= AA_UI, `ok on ${bg} = ${ok.toFixed(2)}:1 (need >= ${AA_UI})`);
  }
});
