// Design document vs CSS consistency guard (F2.3).
//
// Why this test exists: `.knowledge/DESIGN.md` declared `--cell-line: #39414d`
// as a boundary ">= 3:1" while it measured 1.40:1. The CSS had been fixed, but
// the document kept lying because every guard read the CSS, not the doc. A
// document of record that no test reads is a document that drifts.
//
// This test parses the tokens documented in DESIGN.md and asserts that every
// token it DOES declare matches the value in styles.css. Tokens that only exist
// in the CSS are allowed (the doc is a subset); the point is that the doc never
// disagrees with the code.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const CSS = readFileSync(new URL("../src/ui/styles.css", import.meta.url), "utf8");
const DOC = readFileSync(new URL("../.knowledge/DESIGN.md", import.meta.url), "utf8");

function cssVars(text) {
  const out = new Map();
  const re = /--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g;
  let m;
  while ((m = re.exec(text))) out.set(m[1], m[2].toLowerCase());
  return out;
}

const css = cssVars(CSS);
const doc = cssVars(DOC);

test("DESIGN.md documents at least the core tokens", () => {
  assert.ok(doc.size >= 20, `expected a substantial token list, found ${doc.size}`);
});

test("every token declared in DESIGN.md matches styles.css", () => {
  const mismatches = [];
  for (const [name, value] of doc) {
    if (!css.has(name)) {
      // Documented but absent from the CSS: that is a real divergence too.
      mismatches.push(`--${name} documented as ${value} but missing from styles.css`);
      continue;
    }
    if (css.get(name) !== value) {
      mismatches.push(`--${name}: DESIGN.md says ${value}, styles.css says ${css.get(name)}`);
    }
  }
  assert.equal(mismatches.length, 0, `DESIGN.md disagrees with the code:\n${mismatches.join("\n")}`);
});

test("the documented cell-line is the one that actually meets the floor", () => {
  // Regression for the specific lie: the decorative #39414d must never be the
  // documented boundary again.
  const documentedCellLine = doc.get("cell-line");
  assert.ok(documentedCellLine, "DESIGN.md must document --cell-line");
  assert.notEqual(documentedCellLine, "#39414d", "the decorative seam cannot be the cell boundary");
});
