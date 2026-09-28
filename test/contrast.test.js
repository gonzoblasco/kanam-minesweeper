// WCAG AA contrast guard for the UI palette.
//
// Why this test exists: the palette was picked by eye, and an adversarial
// review found `--hint-line` measured 4.35:1 as TEXT on `--hint-bg`, below the
// 4.5:1 AA floor - on the hint text, the differentiator of the game. A colour
// chosen "by value" is not a verified colour. This test reads the real CSS
// variables so a future recolour cannot silently drop below AA.
//
// It is pure (no DOM): it parses `src/ui/styles.css` and does the math.

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
    ["ink", "panel"],
    ["ink", "bg"],
    ["muted", "panel"],
    ["muted", "bg"],
  ]) {
    const r = contrast(cssVar(fg), cssVar(bg));
    assert.ok(r >= AA_TEXT, `${fg} on ${bg} = ${r.toFixed(2)}:1 (need >= ${AA_TEXT})`);
  }
});

test("number palette meets AA on the revealed cell", () => {
  for (let n = 1; n <= 8; n++) {
    const r = contrast(cssVar(`num-${n}`), cssVar("revealed-bg"));
    assert.ok(r >= AA_TEXT, `num-${n} = ${r.toFixed(2)}:1 (need >= ${AA_TEXT})`);
  }
});

test("the hint text is readable (the defect this test locks in)", () => {
  // `--hint-line` is used as text (the "?" marker and the hint rule), on both
  // the hint background and the panel.
  for (const bg of ["hint-bg", "panel"]) {
    const r = contrast(cssVar("hint-line"), cssVar(bg));
    assert.ok(r >= AA_TEXT, `hint-line on ${bg} = ${r.toFixed(2)}:1 (need >= ${AA_TEXT})`);
  }
});

test("flag and focus indicators meet the UI contrast floor", () => {
  const flag = contrast(cssVar("flag"), cssVar("hidden"));
  assert.ok(flag >= AA_UI, `flag on hidden = ${flag.toFixed(2)}:1 (need >= ${AA_UI})`);
  const focus = contrast(cssVar("focus"), cssVar("bg"));
  assert.ok(focus >= AA_UI, `focus on bg = ${focus.toFixed(2)}:1 (need >= ${AA_UI})`);
});

test("button text on the accent is readable", () => {
  const r = contrast("#ffffff", cssVar("accent"));
  assert.ok(r >= AA_TEXT, `white on accent = ${r.toFixed(2)}:1 (need >= ${AA_TEXT})`);
});
