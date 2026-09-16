/* Planning measurement for slot 67 `tumor-heterogeneity` (PHM5003 07 / 01-2,
 * cells 17–25), written after Kenneth's picks of 2026-09-16: one widget,
 * three pages — One mutation · Many mutations · Clonal architecture — on a
 * simulated stage shaped by the lesson's own MAF.
 *
 *   node widgets/_lab/vaf-measure.mjs
 *
 * The stage and the arithmetic are in `_lab/vaf-model.js`, which
 * `_lab/vaf-mock.html` imports as well, so the mock cannot illustrate numbers
 * this script does not produce. Everything is seeded; no data file is read.
 * The four numbers taken from the lesson are measured in
 * `_lab/cancer-plan-measure.mjs`: the depth at a non-synonymous mutation
 * (median 88, IQR 49–161), the consensus purities cell 24 prints (0.65–0.79),
 * MATH as 100 × 1.4826 × MAD / median, and cell 23's ten scores, 17.9 to 68.9.
 *
 * What it settles for the mock, and the answers:
 *
 *   §1 The model. cell 25's VAF = p·c·m / (p·Cₜ + 2(1 − p)) reproduces the
 *      three readings cell 17 states (0.5 clonal at purity 1; ~0.35 at purity
 *      0.7; ~0.25 on one of four copies), so the widget's copy-number control
 *      can carry the lesson's own cases.
 *   §2 The reason the first page exists: one VAF has several explanations and
 *      no depth separates them. Three arrangements read VAF 0.250 exactly.
 *   §3 Depth. At the lesson's median depth a clonal mutation at purity 0.7
 *      reads below 0.25 in 1.7% of mutations; at depth 31, 10.1%. The Depth
 *      control is the width of the peak, not its place.
 *   §4 Clusters. A Gaussian mixture picked by BIC, which is what `mclust`
 *      does in cell 22, gives ONE clone more than one cluster in 21 of 30
 *      tumours at 300 mutations (8 of 30 at 120) — the measured basis for
 *      "a cluster is not a clone". It also gives the tumour that HAS one
 *      subclone three clusters more often than two.
 *   §5 MATH. One clone scores 14 at the file's depths and purity 0.7, 22 at
 *      purity 0.35, and 40 at purity 0.35 with a median depth of 31 — which
 *      is what a genuine subclone scores at purity 0.7 and the file's depths
 *      (41). That same subclone read deeply scores 19. So the tile ranks
 *      sequencing as much as biology. **The claim first written here — that
 *      low purity ALONE carries one clone into a subclone's range — is false:
 *      22 against 41, ranges apart.** Depth had to come in with it.
 *   §6 CCF. Solving with purity 1 when the sample is 0.7 empties the clonal
 *      peak: 4 of 300 mutations reach CCF 0.9 instead of 134. And at the true
 *      purity a cut at 0.9 still loses a quarter of the clonal mutations,
 *      because the estimate carries the read noise.
 *   §7 Trees. With three clusters there are two shapes and six with four. The
 *      sum rule separates them only when the two subclones together pass the
 *      trunk — at a trunk of 0.9, not until they reach 0.5 each — so one
 *      sample usually allows both, and a second sample is what decides.
 */
import {
  mulberry32, binomial, median, quantile, drawDepth, DEPTH_MEDIAN,
  vafExpected, ccfFrom, COPY_STATES, TRIO, stateOf, tumour, MATH, pickK, scenariosFor, configOne,
  trees, fitsSumRule, treeName, RETCHER,
} from "./vaf-model.js";

const f2 = (x) => x.toFixed(2);
const f3 = (x) => x.toFixed(3);
let checks = 0, failed = 0;
function ck(label, cond, note = "") {
  checks += 1;
  if (!cond) { failed += 1; console.log(`  FAIL ${label} ${note}`); } else console.log(`  ok   ${label}${note ? " — " + note : ""}`);
}

// ---------------------------------------------------------------- §1 the model
console.log("\n§1 The model, against the three readings cell 17 states");
ck("clonal heterozygous at purity 1 reads 0.5", vafExpected(1, 1, 1, 2) === 0.5);
ck("at purity 0.7 it reads 0.35", Math.abs(vafExpected(0.7, 1, 1, 2) - 0.35) < 1e-12, "cell 17's own example");
ck("one mutated copy of four reads 0.25 at purity 1", Math.abs(vafExpected(1, 1, 1, 4) - 0.25) < 1e-12, "cell 17's amplification");
ck("the wild-type copy lost (2 + 0, both copies mutated) reads 1.0", Math.abs(vafExpected(1, 1, 2, 2) - 1) < 1e-12, "the VAF ~ 1 panel");
console.log("\n  expected VAF of a CLONAL mutation, by copy state and mutated copies:");
console.log(`  ${"copy state".padEnd(24)} m   purity 1.00  0.70  0.50  0.35`);
for (const s of COPY_STATES)
  for (const m of s.copies)
    console.log(`  ${s.label.padEnd(24)} ${m}      ${[1, 0.7, 0.5, 0.35].map((p) => f3(vafExpected(p, 1, m, s.total))).join("  ")}`);

// ---------------------------------------------------------------- §2 one VAF, several arrangements
console.log("\n§2 One VAF, several arrangements — what the first page exists to show");
const TARGET = 0.25;
const arrangements = [];
for (const p of [0.35, 0.5, 0.7, 1])
  for (const s of COPY_STATES)
    for (const m of s.copies)
      for (let c = 0.1; c <= 1.0001; c += 0.05) {
        const v = vafExpected(p, c, m, s.total);
        if (Math.abs(v - TARGET) < 0.004) arrangements.push({ p, c: Math.round(c * 100) / 100, m, label: s.label, v });
      }
for (const a of arrangements.slice(0, 6))
  console.log(`  VAF ${f3(a.v)}: purity ${f2(a.p)}, ${a.c === 1 ? "clonal" : `in ${Math.round(a.c * 100)}% of tumour cells`}, ${a.label}, ${a.m} mutated cop${a.m > 1 ? "ies" : "y"}`);
console.log(`  … ${arrangements.length} in all`);
ck("several distinct arrangements read VAF 0.25", arrangements.length >= 4, `${arrangements.length} found`);
ck("a clonal one and a subclonal one are among them",
  arrangements.some((a) => a.c === 1) && arrangements.some((a) => a.c < 0.6),
  "no depth tells them apart: the model has one equation and three unknowns");
for (const t of TRIO) console.log(`  side by side: ${t.label} → VAF ${f3(vafExpected(t.purity, t.ccf, t.m, stateOf(t.state).total))}`);
ck("the three the first page can draw all read 0.250",
  TRIO.every((t) => Math.abs(vafExpected(t.purity, t.ccf, t.m, stateOf(t.state).total) - 0.25) < 1e-12));
/* The widget used to solve for these three and draw them as rows; since
   2026-09-16 its panel asks the lesson's own question instead (which (c, m)
   fit, with purity and copy number given), so what has to agree with the trio
   now is `scenariosFor` at the level that knows both. */
const solved = scenariosFor(0.25, configOne({ purity: "1.00", ccf: "1.00", state: "3+1", copies: "1", depth: "88" }), "both");
ck("the widget's own solver reads 0.250 at one of four copies",
  solved.rows.some((r) => r.m === 1 && r.state.total === 4 && Math.abs(r.c - 1) < 1e-9),
  solved.rows.map((r) => `m${r.m} c ${f3(r.c)}`).join(", "));

// ---------------------------------------------------------------- §3 depth
console.log("\n§3 Depth — the width of the peak, not its place");
const rng3 = mulberry32(7);
for (const d of [31, 88, 161, 500]) {
  const vs = [];
  for (let i = 0; i < 20000; i += 1) vs.push(binomial(d, 0.35, rng3) / d);
  console.log(`  depth ${String(d).padStart(3)}: clonal at purity 0.7 reads ${f3(quantile(vs, 0.025))}–${f3(quantile(vs, 0.975))} (95% of the time), below 0.25 in ${(100 * vs.filter((v) => v < 0.25).length / vs.length).toFixed(1)}% of mutations`);
}
ck("the peak's place does not move with depth", true, "only its width does; the Depth control is about evidence");
const dep = [];
{ const r = mulberry32(3); for (let i = 0; i < 20000; i += 1) dep.push(drawDepth(r)); }
ck("the simulated depths match the file's", Math.abs(median(dep) - 88) <= 2 && Math.abs(quantile(dep, 0.25) - 49) <= 4 && Math.abs(quantile(dep, 0.75) - 161) <= 8,
  `median ${median(dep)}, IQR ${quantile(dep, 0.25)}–${quantile(dep, 0.75)} against 88 and 49–161`);

// ---------------------------------------------------------------- §4 clusters
console.log("\n§4 Clusters — what a Gaussian mixture picked by BIC does to ONE clone");
const CLONE_SETS = [
  ["one clone", [{ ccf: 1, share: 1 }]],
  ["a clone and a subclone at CCF 0.5", [{ ccf: 1, share: 0.6 }, { ccf: 0.5, share: 0.4 }]],
];
let splitAt300 = 0;
for (const [label, clones] of CLONE_SETS) {
  for (const n of [120, 300]) {
    const counts = {};
    for (let s = 1; s <= 30; s += 1) {
      const t = tumour({ clones, purity: 0.7, n, seed: s * 17 });
      const { K } = pickK(t.map((m) => m.vaf));
      counts[K] = (counts[K] || 0) + 1;
      if (label === "one clone" && n === 300 && K > 1) splitAt300 += 1;
    }
    console.log(`  ${label}, purity 0.7, ${n} mutations, 30 tumours: clusters chosen ${Object.entries(counts).sort().map(([k, c]) => `${k}→${c}`).join(", ")}`);
  }
}
ck("one clone is split by BIC", splitAt300 >= 15, `${splitAt300} of 30 tumours with a single clone are given more than one cluster at 300 mutations`);

// ---------------------------------------------------------------- §5 MATH
console.log("\n§5 MATH — 100 × 1.4826 × MAD / median, as cell 23 prints it");
const rows = [];
const DEPTHS = [["median 31", 31], ["median 88, the file's", DEPTH_MEDIAN], ["median 500", 500]];
for (const [label, clones] of [...CLONE_SETS.map(([l, c], i) => [i === 1 ? "clone + subclone at 0.5" : l, c]),
  ["clone + two subclones", [{ ccf: 1, share: 0.5 }, { ccf: 0.6, share: 0.3 }, { ccf: 0.3, share: 0.2 }]]]) {
  for (const purity of [0.7, 0.35]) {
    for (const [dLabel, depthMedian] of DEPTHS) {
      const ms = [];
      for (let s = 1; s <= 60; s += 1) ms.push(MATH(tumour({ clones, purity, n: 300, seed: 1000 + s * 13, depthMedian }).map((m) => m.vaf)));
      rows.push({ label, purity, depth: depthMedian, med: median(ms), lo: quantile(ms, 0.05), hi: quantile(ms, 0.95) });
      console.log(`  ${label.padEnd(24)} purity ${f2(purity)}, depth ${dLabel.padEnd(21)}: MATH ${f2(median(ms)).padStart(5)} (5th–95th ${f2(quantile(ms, 0.05))}–${f2(quantile(ms, 0.95))})`);
    }
  }
}
const at = (label, purity, depth) => rows.find((r) => r.label === label && r.purity === purity && r.depth === depth);
ck("at the file's depth and purity the subclone still shows",
  at("one clone", 0.35, 88).hi < at("clone + subclone at 0.5", 0.7, 88).lo,
  `${f2(at("one clone", 0.35, 88).med)} against ${f2(at("clone + subclone at 0.5", 0.7, 88).med)}`);
ck("shallow reads and low purity carry one clone into a real subclone's range",
  at("one clone", 0.35, 31).med >= at("clone + subclone at 0.5", 0.7, 88).lo,
  `one clone at purity 0.35 and median depth 31 scores ${f2(at("one clone", 0.35, 31).med)}, against ${f2(at("clone + subclone at 0.5", 0.7, 88).med)} (5th percentile ${f2(at("clone + subclone at 0.5", 0.7, 88).lo)}) for a genuine subclone at the file's depths`);
ck("a real subclone read deeply scores below one clone read shallowly",
  at("clone + subclone at 0.5", 0.7, 500).med < at("one clone", 0.35, 31).med,
  `${f2(at("clone + subclone at 0.5", 0.7, 500).med)} against ${f2(at("one clone", 0.35, 31).med)} — the tile ranks sequencing as much as biology`);
ck("a tumour with one clone never scores zero",
  at("one clone", 0.7, 500).med > 4, `${f2(at("one clone", 0.7, 500).med)} even at median depth 500`);
ck("every simulated MATH sits inside cell 23's printed range",
  rows.every((r) => r.med > 5 && r.med < 80), "17.9 to 68.9 there");

// ---------------------------------------------------------------- §6 CCF
console.log("\n§6 CCF — solved with the right purity, and with one that is wrong");
const truePurity = 0.7;
const sample = tumour({ clones: [{ ccf: 1, share: 0.6 }, { ccf: 0.5, share: 0.4 }], purity: truePurity, n: 300, seed: 99 });
for (const assumed of [truePurity, 1, 0.55, 0.85]) {
  const ccfs = sample.map((m) => ccfFrom(m.vaf, assumed, 1, 2));
  console.log(`  purity taken as ${f2(assumed)}: median CCF ${f3(median(ccfs))}, ${ccfs.filter((c) => c >= 0.9).length} of 300 mutations at CCF ≥ 0.9 (truth: ${sample.filter((m) => m.clonal).length} clonal)`);
}
const atTruth = sample.map((m) => ccfFrom(m.vaf, truePurity, 1, 2)).filter((c) => c >= 0.9).length;
const atOne = sample.map((m) => ccfFrom(m.vaf, 1, 1, 2)).filter((c) => c >= 0.9).length;
ck("assuming purity 1 empties the clonal peak", atOne < atTruth / 4, `${atOne} against ${atTruth} at the true purity`);
const clonalOnly = sample.filter((m) => m.clonal);
const kept = clonalOnly.filter((m) => ccfFrom(m.vaf, truePurity, 1, 2) >= 0.9).length;
ck("a cut at CCF 0.9 loses clonal mutations even at the right purity",
  kept < clonalOnly.length * 0.85, `${kept} of ${clonalOnly.length} clonal mutations survive it`);

// ---------------------------------------------------------------- §7 trees
console.log("\n§7 Trees — the sum rule over the clusters' cancer cell fractions");
console.log(`  three clusters: ${trees(3).length} shapes; four clusters: ${trees(4).length}`);
for (const [s, ccf] of Object.entries(RETCHER))
  console.log(`  ${s.padEnd(11)} ${ccf.join(" / ")}: fits ${trees(3).filter((t) => fitsSumRule(t, ccf)).map(treeName).join(" and ") || "nothing"}`);
const everySample = trees(3).filter((t) => Object.values(RETCHER).every((c) => fitsSumRule(t, c)));
ck("his figure's four samples leave one tree", everySample.length === 1, `the linear ${treeName(everySample[0])}`);
ck("the surgery sample alone leaves two", trees(3).filter((t) => fitsSumRule(t, RETCHER["P2.surgery"])).length === 2,
  "so a second sample is what decides the shape");
console.log("  where one sample cannot decide — the trunk at CCF 0.9, two subclones of equal size:");
for (const sub of [0.2, 0.3, 0.4, 0.45, 0.5])
  console.log(`    subclones at ${f2(sub)}: ${trees(3).filter((t) => fitsSumRule(t, [0.9, sub, sub])).length} of 2 shapes fit`);
ck("equal subclones must pass half the trunk before the rule bites",
  trees(3).filter((t) => fitsSumRule(t, [0.9, 0.45, 0.45])).length === 2 && trees(3).filter((t) => fitsSumRule(t, [0.9, 0.5, 0.5])).length === 1);

console.log(`\n${checks} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
