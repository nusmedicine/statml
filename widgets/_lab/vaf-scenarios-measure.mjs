/* Research for Kenneth, 2026-09-16: "add the minor chromosome case" and
   "simplify the presentation so we are clear what are free parameters, and
   what scenarios match".

       node widgets/_lab/vaf-scenarios-measure.mjs

   Nothing here asserts a design; it maps the scenario space page 1 can draw,
   says which parameters the VAF can and cannot see, and measures how many
   scenarios a reading leaves standing under each way of asking. */
import * as M from "../tumor-heterogeneity/model.js";

const f3 = (x) => x.toFixed(3);
const line = (s) => console.log(`\n${"=".repeat(76)}\n${s}\n${"=".repeat(76)}`);

/* The full description of one cell's genotype at this position. A state's
   mutation sits on ONE inherited chromosome; today the widget always uses the
   one with `major` copies, and the question is what the other adds. */
const HOSTS = (st) => {
  const out = [{ host: "major", copies: st.major }];
  if (st.minor > 0 && st.minor !== st.major) out.push({ host: "minor", copies: st.minor });
  return out;
};
const SCENARIOS = [];
for (const st of M.COPY_STATES) {
  for (const h of HOSTS(st)) {
    for (let m = 1; m <= h.copies; m += 1) SCENARIOS.push({ st, host: h.host, m });
  }
}

line("1 · THE PARAMETERS, AND WHICH ONES THE VAF CAN SEE");
console.log(`  VAF = p·c·m / (p·Cₜ + 2(1 − p))     — 01-2 cell 25

    p      tumour purity ............... the LESSON MEASURES IT (cell 24, CPE)
    Cₜ     copies per tumour cell ....... the LESSON MEASURES IT (cell 24, ASCAT)
    c      cancer cell fraction ........ cell 25: "(unknown)"
    m      mutation multiplicity ....... cell 25: "(unknown)"
    host   which inherited chromosome it
           arose on .................... NOT IN THE EQUATION AT ALL
    depth  reads covering the position .. sets the spread, not the place`);

{
  /* The host never enters vafExpected, which takes the TOTAL. Shown rather
     than asserted, because it is the whole reason the minor case is a picture
     and not a number. */
  let same = 0;
  for (const st of M.COPY_STATES) {
    for (const h of HOSTS(st)) {
      for (let m = 1; m <= h.copies; m += 1) {
        const v = M.vafExpected(0.7, 1, m, st.total);
        if (Number.isFinite(v)) same += 1;
      }
    }
  }
  const pairs = M.COPY_STATES.filter((s) => s.minor > 0 && s.minor !== s.major);
  console.log(`\n  ${same} scenarios at purity 0.70; the host changes none of their VAFs.`);
  for (const st of pairs) {
    const a = M.vafExpected(0.7, 1, 1, st.total);
    console.log(`    ${st.label}: on the ${st.major}-copy chromosome or on the ${st.minor}-copy one,`
      + ` both read ${f3(a)} with one mutated copy — two pictures, one number.`);
  }
}

line("2 · WHAT THE MINOR CASE ADDS, STATE BY STATE");
for (const st of M.COPY_STATES) {
  const hs = HOSTS(st);
  const bits = hs.map((h) => `on the ${h.copies}-copy chromosome: m = ${Array.from({ length: h.copies }, (_, i) => i + 1).join(", ")}`);
  const note = hs.length === 1
    ? (st.minor === 0 ? "the other chromosome is gone" : "both chromosomes have the same count, so there is no choice to make")
    : "NEW: a second picture at m = 1";
  console.log(`  ${st.label.padEnd(6)} ${bits.join("   |   ")}`);
  console.log(`  ${" ".repeat(6)} ${note}`);
}
console.log(`\n  So the minor case adds a picture to exactly ${M.COPY_STATES.filter((s) => s.minor > 0 && s.minor !== s.major).length} of ${M.COPY_STATES.length} states,`);
console.log(`  and adds no new VAF anywhere. Today the widget draws only the major one.`);

line("3 · THE SCENARIO SPACE PAGE 1 CAN DRAW");
{
  const P = M.PURITY_OPTIONS.map(Number);
  const C = [0.25, 0.5, 0.75, 1];
  const all = [];
  for (const p of P) for (const c of C) for (const s of SCENARIOS) {
    all.push({ p, c, ...s, vaf: M.vafExpected(p, c, s.m, s.st.total) });
  }
  const valid = all.filter((x) => x.vaf <= 1 + 1e-12);
  console.log(`  ${P.length} purities × ${C.length} fractions × ${SCENARIOS.length} genotypes = ${all.length} scenarios`);
  console.log(`  (${SCENARIOS.length} genotypes, against ${SCENARIOS.filter((s) => s.host === "major").length} the widget offers today)`);
  const byVaf = new Map();
  for (const x of valid) {
    const k = x.vaf.toFixed(4);
    byVaf.set(k, [...(byVaf.get(k) ?? []), x]);
  }
  const ties = [...byVaf.entries()].sort((a, b) => b[1].length - a[1].length);
  console.log(`  ${byVaf.size} distinct readings; the most crowded ones:`);
  for (const [v, xs] of ties.slice(0, 4)) {
    console.log(`    VAF ${v}: ${xs.length} scenarios, e.g. ${xs.slice(0, 3).map((x) => `p ${f3(x.p)} c ${f3(x.c)} ${x.st.label}/${x.host} m${x.m}`).join(" | ")}`);
  }
}

line("4 · THE LESSON'S OWN QUESTION: p AND Cₜ MEASURED, WHICH (c, m) MATCH?");
console.log(`  Cell 25 §3 fits c and m by likelihood with p and Cₜ given. Discretised:
  each multiplicity m implies exactly ONE cancer cell fraction, and a scenario
  is a candidate when that fraction is a fraction — 0 < c <= 1.\n`);
for (const [label, p, stKey, cTrue, mTrue] of [
  ["the widget's defaults", 0.7, "1+1", 1, 1],
  ["his screenshot", 0.7, "2+0", 1, 1],
  ["a gained region", 0.7, "3+1", 1, 2],
  ["a low-purity sample", 0.35, "2+1", 1, 1],
]) {
  const st = M.stateOf(stKey);
  const vaf = M.vafExpected(p, cTrue, mTrue, st.total);
  const rows = [];
  for (let m = 1; m <= st.major; m += 1) {
    const c = M.ccfFrom(vaf, p, m, st.total);
    rows.push({ m, c, ok: c <= 1 + 1e-9 });
  }
  console.log(`  ${label}: purity ${f3(p)}, ${st.label}, reading ${f3(vaf)}`);
  for (const r of rows) {
    console.log(`     m = ${r.m} -> c = ${f3(r.c)}  ${r.ok ? "a candidate" : "RULED OUT, more than every tumour cell"}`);
  }
  console.log(`     ${rows.filter((r) => r.ok).length} of ${rows.length} multiplicities survive\n`);
}
{
  /* How often does the reading leave exactly one? */
  let one = 0;
  let many = 0;
  let cells = 0;
  for (const p of M.PURITY_OPTIONS.map(Number)) {
    for (const st of M.COPY_STATES) {
      for (const cTrue of [0.25, 0.5, 0.75, 1]) {
        for (let mTrue = 1; mTrue <= st.major; mTrue += 1) {
          const vaf = M.vafExpected(p, cTrue, mTrue, st.total);
          let n = 0;
          for (let m = 1; m <= st.major; m += 1) if (M.ccfFrom(vaf, p, m, st.total) <= 1 + 1e-9) n += 1;
          cells += 1;
          if (n === 1) one += 1; else many += 1;
        }
      }
    }
  }
  console.log(`  over ${cells} settings: ${((100 * one) / cells).toFixed(1)}% leave ONE multiplicity, ${((100 * many) / cells).toFixed(1)}% leave more than one`);
  console.log(`  — and where more than one survives, the reading alone cannot choose. That is cell 25 §3's job.`);
}

line("5 · TODAY'S QUESTION: NOTHING MEASURED, WHICH SINGLE CAUSE?");
console.log(`  The three rows on the stage hold two unknowns at their neutral value and
  solve the third. That answers the misconception (a VAF is not a cancer cell
  fraction) but it is NOT the lesson's method, which measures p and Cₜ first.
  Measured in \`_lab/vaf-rows-measure.mjs\`: purity and the fraction are drawn
  90.2% of the time, copy number 13.7%, all three 12.1%.`);
