/* ============================================================================
   Widget 88 · target-decoy — the search's arithmetic, the method's claim, and
   the stage the widget draws.

       node widgets/_lab/target-decoy-verify.mjs

   §1 the masses: residues, a peptide, its b and y ions, against published values
   §2 trypsin and the decoys: cut after K/R not before P, 7–25 residues; a decoy
      is a target protein reversed, and never a target peptide
   §3 the search is pure and seeded, and every PSM is what its kind says
   §4 the method: per score the decoys count the wrong targets, over seeds; the
      list at the 1% point is about 1% wrong
   §5 the widget's defaults: the default threshold is the default search's 1%
      point, and a match AT it is less certain than the list's rate
   §6 parsimony reproduces 01-1's protein figure
   §7 the copy: no struck word in a reader-facing string
   ========================================================================= */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeRng } from "../core/rng.js";
import {
  RESIDUE, peptideMass, fragments, digest, reverse, search, binCounts, aboveFrom, levelThreshold, inferProteins, FIGURE,
} from "../target-decoy/engine.js";

const here = dirname(fileURLToPath(import.meta.url));
let fails = 0, checks = 0;
const assert = (ok, msg) => { checks++; if (!ok) { fails++; console.log(`  FAIL ${msg}`); } };
const section = (s) => console.log(`\n${s}`);
const near = (a, b, tol) => Math.abs(a - b) <= tol;

section("§1 the masses");
{
  // PEPTIDE: monoisotopic 799.3600; b2 (PE) 227.1026; y1 (E) 148.0604 — standard values
  assert(near(peptideMass("PEPTIDE"), 799.3600, 1e-3), `PEPTIDE weighs ${peptideMass("PEPTIDE").toFixed(4)} Da (799.3600)`);
  const { b, y } = fragments("PEPTIDE");
  assert(b.length === 6 && y.length === 6, "a 7-residue peptide has six b and six y ions");
  assert(near(b[1], 227.1026, 1e-3), `b2 = ${b[1].toFixed(4)} (227.1026)`);
  assert(near(y[0], 148.0604, 1e-3), `y1 = ${y[0].toFixed(4)} (148.0604)`);
  assert(near(b[5] + y[0] - 2 * 1.00728, peptideMass("PEPTIDE"), 1e-6), "b(n−1) and y1 add up to the peptide");
  assert(RESIDUE.I === RESIDUE.L, "leucine and isoleucine weigh the same");
  console.log(`  ${checks} checks`);
}

section("§2 trypsin and the decoys");
{
  const n0 = checks;
  assert(JSON.stringify(digest("AAAAAAAKAAAAAAAR")) === JSON.stringify(["AAAAAAAK", "AAAAAAAR"]), "trypsin cuts after K and after R");
  assert(JSON.stringify(digest("AAAAAAAKPAAAAAAR")) === JSON.stringify(["AAAAAAAKPAAAAAAR"]), "trypsin does not cut before P");
  assert(digest("AAAKAAAAAAAR").length === 1 && digest("AAAKAAAAAAAR")[0] === "AAAAAAAR", "a peptide under 7 residues is dropped");
  assert(reverse("MKWVTF") === "FTVWKM", "a decoy protein is the target reversed");
  const s = search(makeRng(12));
  const t = new Set(s.prot.flatMap((p) => digest(p)));
  const decoyPeps = new Set(s.psms.filter((p) => p.kind === "decoy").map((p) => p.peptide));
  assert([...decoyPeps].every((p) => !t.has(p)), "no decoy peptide is also a target peptide");
  assert(Math.abs(s.targets - s.decoys) / s.targets < 0.05, `about as many decoy peptides as target peptides (${s.targets} and ${s.decoys})`);
  console.log(`  ${checks - n0} checks`);
}

section("§3 the search is pure, seeded, and every PSM is its kind");
{
  const n0 = checks;
  const a = search(makeRng(12)), b = search(makeRng(12)), c = search(makeRng(13));
  const sig = (s) => s.psms.map((p) => `${p.peptide}:${p.ions}:${p.kind}`).join("|");
  assert(sig(a) === sig(b), "the same seed searches the same way");
  assert(sig(a) !== sig(c), "another seed searches differently");
  assert(a.psms.every((p) => p.ions === Math.floor(p.score) && p.ions >= 0), "a PSM's whole score is its ions on a peak");
  assert(a.psms.every((p) => (p.kind === "decoy") === Boolean(p.bestD && p.peptide === p.bestD.p && !(p.bestT && p.bestT.score > p.bestD.score))), "a decoy PSM is the best decoy, scoring above the best target");
  assert(a.psms.every((p) => p.kind !== "correct" || (p.hasCorrect && p.peptide === p.source)), "a correct PSM is the spectrum's own peptide");
  assert(a.psms.every((p) => p.hasCorrect || p.kind !== "correct"), "a spectrum from outside the database is never correct");
  console.log(`  ${checks - n0} checks`);
}

section("§4 the method, over seeds 1–10");
{
  const n0 = checks;
  const sum = { 5: [0, 0], 7: [0, 0] };
  const realised = [];
  for (let s = 1; s <= 10; s += 1) {
    const r = search(makeRng(s));
    const c = binCounts(r.psms);
    for (const t of [5, 7]) { const a = aboveFrom(c, t); sum[t][0] += a.D; sum[t][1] += a.W; }
    realised.push(aboveFrom(c, levelThreshold(c, 0.01)).tru);
  }
  for (const t of [5, 7]) {
    const ratio = sum[t][0] / sum[t][1];
    assert(ratio > 0.85 && ratio < 1.15, `at ${t} ions or more the decoys count the wrong targets: ${sum[t][0]} decoys, ${sum[t][1]} wrong (ratio ${ratio.toFixed(2)})`);
  }
  const m = realised.reduce((x, y) => x + y, 0) / realised.length;
  assert(m > 0.004 && m < 0.025, `at each search's 1% point the list is ${(100 * m).toFixed(1)}% wrong on average`);
  console.log(`  ${checks - n0} checks`);
}

section("§5 the widget's defaults");
{
  const n0 = checks;
  const src = readFileSync(join(here, "../target-decoy/main.js"), "utf8");
  const def = (name) => Number((src.match(new RegExp(`\\n    ${name}: \\{[^]*?default: (\\d+)`)) || [])[1]);
  const inDb = Number((src.match(/inDb: \{[^]*?default: "([\d.]+)"/) || [])[1]);
  const seed = def("seed"), thr = def("threshold");
  assert(seed === 12 && thr === 8 && inDb === 0.6, `defaults read: seed ${seed}, threshold ${thr}, inDb ${inDb}`);
  const r = search(makeRng(seed), { inDb });
  const c = binCounts(r.psms);
  assert(levelThreshold(c, 0.01) === thr, `the default threshold is the default search's 1% point (${levelThreshold(c, 0.01)})`);
  const a = aboveFrom(c, thr), b = c[thr];
  const atRate = b.decoy / (b.correct + b.wrong);
  assert(Math.abs(a.tru - a.est) < 0.005, `on the default search the estimate is near the truth at the threshold (${(100 * a.est).toFixed(1)}% against ${(100 * a.tru).toFixed(1)}%)`);
  assert(atRate > 2 * a.est, `a match at the threshold is less certain than the list's rate (${(100 * atRate).toFixed(0)}% against ${(100 * a.est).toFixed(1)}%)`);
  const t5 = levelThreshold(c, 0.05);
  assert(t5 < thr && aboveFrom(c, t5).est <= 0.05, `the 5% point sits below the threshold (${t5}, estimating ${(100 * aboveFrom(c, t5).est).toFixed(1)}%)`);
  console.log(`  ${checks - n0} checks`);
}

section("§6 parsimony on 01-1's protein figure");
{
  const n0 = checks;
  const g = inferProteins(FIGURE.proteins, FIGURE.peptides);
  const of = (id) => g.find((x) => x.ids.includes(id));
  assert(of("II").subset, "II is a subset (its one peptide, B, is in I)");
  assert(of("IV").subsumable && !of("IV").reported, "IV is subsumable and not reported");
  assert(of("V") === of("VI"), "V and VI are one group");
  assert(g.filter((x) => !x.subset).length === 4, "eliminating subsets leaves the figure's four protein groups");
  assert(g.filter((x) => !x.subset && !x.subsumable).length === 3, "eliminating subsumables too leaves its three");
  assert(g.filter((x) => x.reported).map((x) => x.ids.join("/")).join(" ") === "I III V/VI", "the minimal set is I, III and the group V/VI");
  console.log(`  ${checks - n0} checks`);
}

section("§7 the copy");
{
  const n0 = checks;
  const src = readFileSync(join(here, "../target-decoy/main.js"), "utf8").replace(/\/\*[^]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const strings = [...src.matchAll(/(["`])((?:\\.|(?!\1)[^\\])*?)\1/g)].map((m) => m[2]).filter((s) => /[a-z] [a-z]/i.test(s));
  const struck = /\b(you|your|never|notebook|lesson|cell \d|strip|walk|card|rung|deal|deck)\b/i;
  for (const s of strings) assert(!struck.test(s), `no struck word in "${s.slice(0, 70)}"`);
  console.log(`  ${checks - n0} checks over ${strings.length} strings`);
}

console.log(`\n${checks - fails} of ${checks} checks pass`);
if (fails) process.exit(1);
