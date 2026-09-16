/* Research for Kenneth's question of 2026-09-16: are all three "other
   arrangements" worth showing, given how often one of them is a red notice?

       node widgets/_lab/vaf-rows-measure.mjs

   Nothing here asserts; it prints what the three rows can and cannot do. */
import * as M from "../tumor-heterogeneity/model.js";
import { makeRng } from "../core/rng.js";

const pct = (a, b) => `${((100 * a) / b).toFixed(1)}%`;
const KINDS = ["purity", "ccf", "copies"];

console.log("=".repeat(78));
console.log("A · WHICH VAFs EACH ROW CAN EXPLAIN AT ALL (a pure single cause)");
console.log("=".repeat(78));
{
  const have = { purity: 0, ccf: 0, copies: 0 };
  let n = 0;
  const copiesOk = [];
  for (let v = 0.005; v < 1; v += 0.005) {
    n += 1;
    const rows = M.arrangementsFor(v);
    for (const r of rows) if (r.ok) have[r.kind] += 1;
    if (rows.find((r) => r.kind === "copies").ok) copiesOk.push(v);
  }
  for (const k of KINDS) console.log(`  ${k.padEnd(8)} exists for ${pct(have[k], n)} of VAFs in (0, 1)`);
  /* the copies row's windows, collapsed into ranges */
  const bands = [];
  for (const v of copiesOk) {
    const last = bands[bands.length - 1];
    if (last && v - last[1] < 0.011) last[1] = v; else bands.push([v, v]);
  }
  console.log(`  copies only inside: ${bands.map(([a, b]) => `${a.toFixed(3)}–${b.toFixed(3)}`).join("  ")}`);
  console.log(`  …because at purity 1 with one mutated copy, VAF = 1/Cₜ, and the`);
  console.log(`     lesson's list holds Cₜ = ${[...new Set(M.COPY_STATES.filter((s) => s.total > 1).map((s) => s.total))].join(", ")}`);
  console.log(`     -> ${[...new Set(M.COPY_STATES.filter((s) => s.total > 1).map((s) => s.total))].map((t) => (1 / t).toFixed(3)).join(", ")}, and nothing between them.`);
}

console.log();
console.log("=".repeat(78));
console.log("B · WHAT A READER ACTUALLY SEES, over every setting page 1 offers");
console.log("=".repeat(78));
{
  const tally = { purity: 0, ccf: 0, copies: 0 };
  const byCount = [0, 0, 0, 0];
  let cells = 0;
  const examples = { 3: null, 2: null, 1: null, 0: null };
  for (const st of M.COPY_STATES) {
    for (const copies of st.copies) {
      for (const purity of M.PURITY_OPTIONS) {
        for (const ccf of ["0.25", "0.50", "0.75", "1.00"]) {
          for (const depth of M.DEPTH_OPTIONS) {
            for (let seed = 1; seed <= 4; seed += 1) {
              const cfg = M.configOne({
                purity, ccf, state: st.key, copies: String(copies), depth,
              });
              const one = M.buildReads(makeRng(seed), cfg);
              const v = M.vafAt(one, one.depth);
              const rows = M.arrangementsFor(v);
              const ok = rows.filter((r) => r.ok);
              cells += 1;
              for (const r of ok) tally[r.kind] += 1;
              byCount[ok.length] += 1;
              if (!examples[ok.length]) {
                examples[ok.length] = `purity ${purity}, ${ccf} of tumour cells, ${st.label} with ${copies} mutated, depth ${depth} -> VAF ${M.n3(v)}`;
              }
            }
          }
        }
      }
    }
  }
  console.log(`  ${cells} readings swept (every copy state, mutated-copy count, purity, cancer cell fraction, depth; 4 seeds)`);
  for (const k of KINDS) console.log(`    ${k.padEnd(8)} row is drawn in ${pct(tally[k], cells)} of them`);
  console.log(`  rows drawn, of three:`);
  for (let i = 3; i >= 0; i -= 1) console.log(`    ${i} row(s): ${pct(byCount[i], cells)}   e.g. ${examples[i] ?? "—"}`);
}

console.log();
console.log("=".repeat(78));
console.log("C · THE FLICKER: how the set changes while the reader adds reads");
console.log("=".repeat(78));
{
  for (const [label, p] of [
    ["the widget's own defaults", { purity: "0.70", ccf: "1.00", state: "1+1", copies: "1", depth: "88" }],
    ["his screenshot", { purity: "0.70", ccf: "0.75", state: "1+1", copies: "1", depth: "500" }],
    ["the three-way case", { purity: "0.50", ccf: "1.00", state: "1+1", copies: "1", depth: "88" }],
  ]) {
    const cfg = M.configOne(p);
    const one = M.buildReads(makeRng(5), cfg);
    let flips = 0;
    let prev = null;
    const seen = new Set();
    for (let k = 1; k <= one.depth; k += 1) {
      const v = M.vafAt(one, k);
      const key = M.arrangementsFor(v).map((r) => (r.ok ? "1" : "0")).join("");
      seen.add(key);
      if (prev !== null && key !== prev) flips += 1;
      prev = key;
    }
    console.log(`  ${label}: the set of rows changes ${flips} times over ${one.depth} reads; patterns seen ${[...seen].join(", ")}`);
  }
}

console.log();
console.log("=".repeat(78));
console.log("D · IS THE COPIES ROW EVEN EXACT WHEN IT IS DRAWN?");
console.log("=".repeat(78));
{
  /* It is accepted within 0.02 of 1/Cₜ, so the bar it draws can read a
     different VAF from the one the reader has. */
  let worst = 0;
  let worstAt = null;
  for (let v = 0.005; v < 1; v += 0.0005) {
    const row = M.arrangementsFor(v).find((r) => r.kind === "copies");
    if (!row.ok) continue;
    const shown = M.vafExpected(1, 1, 1, row.state.total);
    if (Math.abs(shown - v) > worst) { worst = Math.abs(shown - v); worstAt = { v, shown, state: row.state.label }; }
  }
  console.log(`  worst gap between the reader's VAF and the row's own: ${worst.toFixed(4)}`);
  console.log(`    at VAF ${worstAt.v.toFixed(3)}, the row drawn is ${worstAt.state}, which reads ${worstAt.shown.toFixed(3)}`);
  console.log(`  the other two rows are solved exactly, so they never differ.`);
}

console.log();
console.log("=".repeat(78));
console.log("E · IF THE COPIES ROW COULD USE EVERY (mutated, total) THE LIST ALLOWS");
console.log("=".repeat(78));
{
  const pairs = [];
  for (const s of M.COPY_STATES) for (const m of s.copies) pairs.push({ s, m, v: m / s.total });
  const uniq = [...new Set(pairs.map((p) => p.v.toFixed(3)))].sort();
  console.log(`  reachable at purity 1, every cell carrying it: ${uniq.join(", ")}`);
  let have = 0;
  let n = 0;
  for (let v = 0.005; v < 1; v += 0.005) {
    n += 1;
    if (pairs.some((p) => Math.abs(p.v - v) < 0.02)) have += 1;
  }
  console.log(`  that would cover ${pct(have, n)} of VAFs, against ${pct(M.COPY_STATES.filter((s) => s.total > 1).length ? 0 : 0, 1)}`.replace(", against 0.0%", ""));
  console.log(`  — still discrete. Copy number IS discrete; no widening makes it continuous.`);
}


/* every arrangement copy number alone can make: purity 1, every tumour cell
   carrying it, m of C copies */
const PAIRS = [];
for (const s of M.COPY_STATES) for (const m of s.copies) PAIRS.push({ s, m, v: m / s.total });
const copiesWide = (vaf, tol = 0.02) => PAIRS
  .map((p) => ({ ...p, err: Math.abs(p.v - vaf) }))
  .sort((a, b) => a.err - b.err)
  .find((p) => p.err < tol) ?? null;

console.log("=".repeat(78));
console.log("F · WHAT COPY NUMBER ALONE CAN READ, WITH EVERY MUTATED-COPY COUNT");
console.log("=".repeat(78));
for (const p of PAIRS.slice().sort((a, b) => a.v - b.v)) {
  console.log(`  ${p.s.label} with ${p.m} mutated -> VAF ${p.v.toFixed(3)}${p.v > 0.5 ? "   <- past one half" : ""}`);
}

console.log();
console.log("=".repeat(78));
console.log("G · ABOVE VAF 0.5, IS COPY NUMBER THE ONLY EXPLANATION?");
console.log("=".repeat(78));
{
  let narrowHave = 0;
  let wideHave = 0;
  let n = 0;
  for (let v = 0.505; v < 1.0; v += 0.005) {
    n += 1;
    if (M.arrangementsFor(v).find((r) => r.kind === "copies").ok) narrowHave += 1;
    if (copiesWide(v)) wideHave += 1;
  }
  console.log(`  purity alone above 0.5:      never (it would need purity past 1)`);
  console.log(`  cancer cell fraction alone:  never (it would need a fraction past 1)`);
  console.log(`  copy number, as drawn today: ${pct(narrowHave, n)} of VAFs above one half`);
  console.log(`  copy number, every m of C:   ${pct(wideHave, n)} of VAFs above one half`);
  console.log(`  -> the lesson's own VAF ~ 1 case (01-2 cell 17) is 2 + 0 with both copies mutated,`);
  console.log(`     which reads 1.000 and is EXACTLY what the row says cannot exist today.`);
}

console.log();
console.log("=".repeat(78));
console.log("H · THE SWEEP AGAIN, WITH THE WIDER COPIES ROW");
console.log("=".repeat(78));
{
  const byCountNarrow = [0, 0, 0, 0];
  const byCountWide = [0, 0, 0, 0];
  let wideCopies = 0;
  let cells = 0;
  for (const st of M.COPY_STATES) {
    for (const copies of st.copies) {
      for (const purity of M.PURITY_OPTIONS) {
        for (const ccf of ["0.25", "0.50", "0.75", "1.00"]) {
          for (const depth of M.DEPTH_OPTIONS) {
            for (let seed = 1; seed <= 4; seed += 1) {
              const cfg = M.configOne({ purity, ccf, state: st.key, copies: String(copies), depth });
              const one = M.buildReads(makeRng(seed), cfg);
              const v = M.vafAt(one, one.depth);
              const rows = M.arrangementsFor(v);
              const nNarrow = rows.filter((r) => r.ok).length;
              const wide = Boolean(copiesWide(v));
              const nWide = rows.filter((r) => r.ok && r.kind !== "copies").length + (wide ? 1 : 0);
              cells += 1;
              byCountNarrow[nNarrow] += 1;
              byCountWide[nWide] += 1;
              if (wide) wideCopies += 1;
            }
          }
        }
      }
    }
  }
  console.log(`  ${cells} readings`);
  console.log(`    copies row drawn: ${pct(wideCopies, cells)} with every m of C, against 13.7% today`);
  console.log(`  rows drawn, of three:      today      with every m of C`);
  for (let i = 3; i >= 0; i -= 1) {
    console.log(`    ${i} row(s):            ${pct(byCountNarrow[i], cells).padStart(6)}        ${pct(byCountWide[i], cells).padStart(6)}`);
  }
}

console.log();
console.log("=".repeat(78));
console.log("I · THE FLICKER, IF THE ROWS FOLLOWED THE EXPECTED VAF INSTEAD");
console.log("=".repeat(78));
{
  for (const [label, p] of [
    ["the widget's own defaults", { purity: "0.70", ccf: "1.00", state: "1+1", copies: "1", depth: "88" }],
    ["his screenshot", { purity: "0.70", ccf: "0.75", state: "1+1", copies: "1", depth: "500" }],
  ]) {
    const cfg = M.configOne(p);
    const one = M.buildReads(makeRng(5), cfg);
    let flips = 0;
    let prev = null;
    for (let k = 1; k <= one.depth; k += 1) {
      const key = M.arrangementsFor(M.vafAt(one, k)).map((r) => (r.ok ? "1" : "0")).join("");
      if (prev !== null && key !== prev) flips += 1;
      prev = key;
    }
    console.log(`  ${label}:`);
    console.log(`     following the reading:  ${flips} changes over ${one.depth} reads`);
    console.log(`     following the expected: 0 changes (it is a function of the controls, not of the draw)`);
    console.log(`     expected VAF ${M.n3(cfg.expected)}, final reading ${M.n3(M.vafAt(one, one.depth))}`);
  }
}
