#!/usr/bin/env bash
# scripts/review-gate.sh - Independent verification gate for kanam-minesweeper.
#
# Runs the same refutations an adversarial reviewer would, as executable checks.
# Exit 0 = all gates pass. Any failure prints exactly what failed.
#
# Usage: bash scripts/review-gate.sh
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

fail=0
pass=0

ok()   { pass=$((pass+1)); echo "PASS  $1"; }
bad()  { fail=$((fail+1)); echo "FAIL  $1"; }

echo "== 1. em dash / en dash scan =="
dash_hits=$(python3 - <<'PY'
import glob, os
targets = []
for root, dirs, files in os.walk("."):
    if any(p in root for p in ("node_modules", ".git", "dist")):
        continue
    for f in files:
        if f.endswith((".js", ".mjs", ".css", ".html", ".json", ".md", ".webmanifest")):
            targets.append(os.path.join(root, f))
bad = []
for p in targets:
    with open(p, encoding="utf-8", errors="ignore") as fh:
        t = fh.read()
    for i, ch in enumerate(t):
        if ch in "\u2014\u2013\u2011":
            bad.append(f"{p}:{i}:{hex(ord(ch))}")
print("\n".join(bad))
PY
)
if [ -z "$dash_hits" ]; then ok "no long dashes"; else bad "long dashes found:"; echo "$dash_hits" | head -20; fi

echo "== 2. test suite has real cases =="
test_out=$(npm test 2>&1)
echo "$test_out" | tail -8
# Node 18-20 emit the TAP reporter ("# tests N"); Node >=21 defaults to the spec
# reporter ("i tests N"). Accept either so the gate works on both.
ntests=$(echo "$test_out" | grep -oE "(^# tests |^[^A-Za-z0-9]*tests )[0-9]+" | grep -oE "[0-9]+" | head -1)
nfiles=$(ls test/*.test.js 2>/dev/null | wc -l | tr -d ' ')
if [ "${ntests:-0}" -ge 40 ]; then ok "test count ${ntests} (>=40)"; else bad "test count ${ntests:-0} (expect >=40)"; fi
if [ "$nfiles" -ge 6 ]; then ok "test files ${nfiles} (>=6)"; else bad "test files ${nfiles} (expect >=6)"; fi

echo "== 3. build =="
if npm run build >/tmp/kg-build.log 2>&1; then ok "npm run build"; else bad "npm run build"; tail -20 /tmp/kg-build.log; fi

echo "== 4. first click never hits a mine (500 seeds x 3 presets) =="
node --input-type=module -e '
import { createGame, reveal, statusOf, safeZoneOf } from "./src/core/game.js";
import { createRng, deriveSeed } from "./src/core/rng.js";
import { PRESETS } from "./src/core/presets.js";
let cases = 0, bad = 0;
for (const p of Object.values(PRESETS)) {
  const size = p.width * p.height;
  for (let s = 0; s < 500; s++) {
    const rng = createRng(deriveSeed(s * 7919 + 13, s));
    const g0 = createGame(p);
    const spots = [0, p.width - 1, size - 1, Math.floor(size / 2), p.width, size - p.width];
    for (const i of spots) {
      const g = reveal(g0, i, rng);
      cases++;
      if (g.status === "lost") bad++;
      // the chosen cell must be revealed and not a mine
      if (!g.revealed[i]) bad++;
      if (g.mines[i]) bad++;
    }
  }
}
console.log(`cases=${cases} lost=${bad}`);
process.exit(bad === 0 ? 0 : 1);
' && ok "first click safe" || bad "first click can hit a mine"

echo "== 5. solver never reveals without a deduction =="
node --input-type=module -e '
import { createGame, reveal, isWon } from "./src/core/game.js";
import { createRng, deriveSeed } from "./src/core/rng.js";
import { solveLogically } from "./src/core/logic.js";
let boards = 0, violations = 0, solvedCount = 0;
for (let s = 0; s < 200; s++) {
  const preset = { width: 8, height: 8, mineCount: 10 };
  const rng = createRng(deriveSeed(s, 3));
  let g = reveal(createGame(preset), 27, rng);
  const r = solveLogically(g);
  boards++;
  if (r.solved) solvedCount++;
  // every step must carry a deduction with cells and evidence
  for (const step of r.steps) {
    if (!step.cells || step.cells.length === 0) { violations++; continue; }
    if (!step.evidence) { violations++; continue; }
    for (const c of step.cells) if (c < 0 || c >= g.size) violations++;
  }
}
console.log(`boards=${boards} solvedLogically=${solvedCount} violations=${violations}`);
process.exit(violations === 0 ? 0 : 1);
' && ok "solver steps are all justified" || bad "solver produced unjustified steps"

echo "== 6. hints do not lie against the real board =="
node --input-type=module -e '
import { createGame, reveal } from "./src/core/game.js";
import { createRng, deriveSeed } from "./src/core/rng.js";
import { findDeduction, verifyDeduction } from "./src/core/logic.js";
let checks = 0, lies = 0, found = 0;
for (let s = 0; s < 300; s++) {
  const preset = { width: 9, height: 9, mineCount: 12 };
  const rng = createRng(deriveSeed(s, 11));
  let g = reveal(createGame(preset), 40, rng);
  // Play out using deductions only; each hint must be truthful.
  for (let guard = 0; guard < 200; guard++) {
    const d = findDeduction(g);
    if (!d) break;
    found++;
    if (!verifyDeduction(g, d)) { lies++; break; }
    checks++;
    for (const c of d.cells) {
      const isMine = !!g.mines[c];
      if (d.action === "safe" && isMine) { lies++; break; }
      if (d.action === "mine" && !isMine) { lies++; break; }
    }
    // apply
    const next = d.action === "safe"
      ? d.cells.reduce((gg, c) => reveal(gg, c, rng), g)
      : g;
    if (d.action === "mine") break; // cannot reveal mines; stop this board
    if (next.status === "lost") { lies++; break; }
    g = next;
    if (g.status === "won") break;
  }
}
console.log(`deductions=${found} verified=${checks} lies=${lies}`);
process.exit(lies === 0 ? 0 : 1);
' && ok "every hint is truthful" || bad "a hint lied about the board"

echo "== 7. E2E in a real browser =="
if NODE_PATH=/Users/gonzoblasco/projects/kanam-fixer-v2/node_modules node scripts/e2e.mjs >/tmp/kg-e2e.log 2>&1; then
  ok "browser E2E"; tail -12 /tmp/kg-e2e.log
else
  bad "browser E2E"; tail -20 /tmp/kg-e2e.log
fi

echo
echo "== SUMMARY: ${pass} passed, ${fail} failed =="
[ "$fail" -eq 0 ] || exit 1
