/* ============================================================================
   Every number in catalogue § The high-throughput arc, slot 1.

       node widgets/_lab/norm-measure.mjs

   Imports the engine rather than copying it, so what is measured here is what
   the widget would ship. Nothing in this file is recalled; if a claim in the
   catalogue is not printed below, it was not measured.
   ========================================================================= */

import {
  simulate, apply, summarise, NORMALIZE, median,
} from "./norm-model.js";

const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "—");
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

function row(name, cols) {
  const s = summarise(cols);
  const { meds, range, relative } = s.spread;
  return [
    pad(name, 26),
    rpad(f(s.skew), 7),
    rpad(f(s.rho), 7),
    rpad(f(relative), 7),
    `${f(Math.min(...meds), 3)} .. ${f(Math.max(...meds), 3)}  (range ${f(range, 3)})`,
  ].join(" | ");
}

const header = () => {
  console.log([pad("method", 26), rpad("skew", 7), rpad("rho", 7), rpad("spread", 7), "sample medians"].join(" | "));
  console.log("-".repeat(96));
};

/* -- 1 · the notebook's own stage, every method it names ------------------- */
console.log("\n=== 1 · THE NOTEBOOK'S STAGE (1000 genes x 10 samples, equal depth) ===");
console.log("rnbinom(mu ~ U(10,100), size = 1/disp), disp = mu/100 — simulate_data, cell 4\n");
const nb = simulate({ seed: 1 }).cols;
header();
console.log(row("raw", nb));
for (const key of ["median", "minmax", "zscore", "quantile"]) {
  console.log(row(NORMALIZE[key].label, apply(nb, { normalize: key })));
}
console.log(row("log(1 + y)", apply(nb, { transform: "log1p" })));
for (const lam of [0.02, 0.10, 0.25, 0.50, 1.00]) {
  console.log(row(`Box-Cox lambda = ${lam.toFixed(2)}`, apply(nb, { transform: "boxcox", lambda: lam })));
}

/* -- 2 · is the affine invariance EXACT, or merely close? ------------------ */
console.log("\n=== 2 · THE INVARIANCE IS EXACT, NOT APPROXIMATE ===");
const skRaw = summarise(nb).skew;
for (const key of ["median", "minmax", "zscore"]) {
  const sk = summarise(apply(nb, { normalize: key })).skew;
  console.log(`  ${pad(NORMALIZE[key].label, 24)} skew ${sk.toPrecision(17)}  |delta| ${Math.abs(sk - skRaw).toExponential(2)}`);
}
console.log(`  ${pad("raw", 24)} skew ${skRaw.toPrecision(17)}`);
console.log("  -> an affine map over the whole table cannot move the shape. Float noise only.");

/* -- 3 · why rho and not the log-log slope --------------------------------- */
console.log("\n=== 3 · WHY rho(mean, variance) AND NOT THE log-log SLOPE ===");
function loglog(cols) {
  const pts = summarise(cols).pts.filter(([m, v]) => m > 0 && v > 0);
  const xs = pts.map(([m]) => Math.log(m));
  const ys = pts.map(([, v]) => Math.log(v));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i += 1) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2; }
  return { slope: num / den, kept: pts.length };
}
for (const [name, cols] of [
  ["raw", nb],
  ["z-score", apply(nb, { normalize: "zscore" })],
  ["log(1 + y)", apply(nb, { transform: "log1p" })],
  ["Box-Cox 0.02", apply(nb, { transform: "boxcox", lambda: 0.02 })],
]) {
  const { slope, kept } = loglog(cols);
  console.log(`  ${pad(name, 14)} slope ${rpad(f(slope), 7)} on ${rpad(kept, 4)}/1000 genes    rho ${f(summarise(cols).rho)}`);
}
console.log("  -> z-score drops 558 of 1000 genes (log of a negative); log1p keeps a slope of 2.58");
console.log("     while rho has already fallen to 0.46. The slope answers a different question.");

/* -- 4 · quantile normalisation needs a continuous stage ------------------- */
console.log("\n=== 4 · QUANTILE NORMALISATION NEEDS A CONTINUOUS STAGE ===");
const distinct = nb.map((c) => new Set(c).size);
console.log(`  distinct values per sample, integer counts: ${distinct.join(", ")}  (of 1000 genes)`);
for (const [stage, cols] of [
  ["integer counts", nb],
  ["continuous", simulate({ seed: 1, continuous: true }).cols],
]) {
  for (const ties of ["min", "average"]) {
    const q = apply(cols, { normalize: "quantile", ties });
    console.log(`  ${pad(`${stage}, ties = ${ties}`, 30)} median range after quantile: ${summarise(q).spread.range.toExponential(2)}`);
  }
}
console.log("  -> on the notebook's own stage the boxplots visibly fail to line up, which is");
console.log("     the ONE thing quantile normalisation exists to do.");

/* -- 5 · the notebook's stage has nothing for a normaliser to correct ------ */
console.log("\n=== 5 · THE NOTEBOOK'S STAGE HAS NOTHING FOR A NORMALISER TO CORRECT ===");
console.log("simulate_data draws every sample from the SAME mean vector, so the ten samples");
console.log("are exchangeable before anything is done to them. `spread` adds a per-sample");
console.log("depth factor — sequencing depth, or injected amount.\n");
header();
for (const spread of [0, 0.5, 1.0]) {
  const cols = simulate({ seed: 1, spread }).cols;
  console.log(row(`raw, spread = ${spread.toFixed(1)}`, cols));
  console.log(row(`  + median norm`, apply(cols, { normalize: "median" })));
  console.log(row(`  + quantile`, apply(cols, { normalize: "quantile" })));
  console.log(row(`  + min-max`, apply(cols, { normalize: "minmax" })));
}
console.log("\n  -> at spread = 0 (the notebook) median normalisation has no work to do, and");
console.log("     min-max is indistinguishable from it. At spread > 0 the per-sample methods");
console.log("     separate from the global ones, which is what normalisation IS.");

/* -- 6 · composing the two operations -------------------------------------- */
console.log("\n=== 6 · THE TWO OPERATIONS COMPOSE, WHICH IS THE ARGUMENT ===");
const staged = simulate({ seed: 1, spread: 1.0 }).cols;
header();
for (const [n, t] of [
  ["none", "none"], ["quantile", "none"], ["none", "log1p"], ["quantile", "log1p"],
  ["median", "log1p"], ["median", "none"],
]) {
  console.log(row(`${NORMALIZE[n].label} + ${t}`, apply(staged, { normalize: n, transform: t })));
}
console.log("\n  -> normalisation moves `spread`, transformation moves `skew` and `rho`, and");
console.log("     neither does the other's job. Two controls in sequence say that by shape.");
console.log();
