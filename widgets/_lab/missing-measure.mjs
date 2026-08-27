/* ============================================================================
   Widget 25 planning: every number the design leans on, measured.

   Imports the SHIPPING model — widgets/missing-data/model.js — never copies it.
   Run: node widgets/_lab/missing-measure.mjs

   What it settles, in order:
   1. STEEPNESS x BIN-COUNT SWEEP at the default rate: how sharply the holes
      concentrate, and how many bins the check panel needs before one seeded
      cohort reliably shows MAR sloped and MNAR flat. (The first sweep here
      found the check panel's noise floor: 6 bins of 20 patients put a 27-point
      max-min on MCAR itself, drowning the diagnostic — and found MNAR-on-raw-
      weight leaking a 40-point slope into age, which is why the model now
      scores MNAR on the residual.)
   2. AT THE SHIPPED CONSTANTS: bias, observed SD, and check contrast per
      mechanism per rate — so every slider stop can be confirmed to carry the
      lesson, and the catalogue can quote real numbers.
   3. SINGLE-COHORT RELIABILITY: the widget shows one seeded cohort, so the
      headline pattern has to hold on nearly every seed, not on average.

   NOT DEPLOYED — `widgets/_lab/` is excluded from the build.
   ========================================================================= */

import { pathToFileURL, fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const M = await import(pathToFileURL(join(HERE, "..", "missing-data", "model.js")).href);
const { makeRng } = await import(pathToFileURL(join(HERE, "..", "core", "rng.js")).href);

const N = 120;
const REPS = 400;
const RATE0 = 0.3;

/* Contrast on the check panel: max minus min bin missing-rate, in points. */
const contrastOf = (pts, bins) => {
  const bs = M.checkPanel(pts, bins).map((b) => (b.n ? b.missing / b.n : 0));
  return 100 * (Math.max(...bs) - Math.min(...bs));
};

const bias = (pts) =>
  M.mean(pts.filter((p) => !p.miss).map((p) => p.w)) - M.mean(pts.map((p) => p.w));

function run(mech, rate, steep, seed) {
  const rng = makeRng(seed);
  return M.applyMissing(M.cohort(N, rng), mech, rate, rng, steep);
}

/* --- 1. steepness x bins: averages AND single-cohort reliability ------------ */
console.log(`\n=== 1. steep x bins at rate ${RATE0}, n=${N} (reliability over ${REPS} seeds)`);
console.log("steep bins | MAR bias MNAR bias | chk MCAR/MAR/MNAR | MAR>2xMCAR  MNAR<=1.5xMCAR  |MNARbias|>2kg");
for (const steep of [1.0, 1.5, 2.0, 2.5]) {
  for (const bins of [3, 4, 6]) {
    let mb = 0, nb = 0, cM = 0, cA = 0, cN = 0, relA = 0, relN = 0, relB = 0;
    for (let s = 1; s <= REPS; s += 1) {
      const mcar = run("mcar", RATE0, steep, s);
      const mar = run("mar", RATE0, steep, s + 10000);
      const mnar = run("mnar", RATE0, steep, s + 20000);
      mb += bias(mar); nb += bias(mnar);
      const km = contrastOf(mcar, bins), ka = contrastOf(mar, bins), kn = contrastOf(mnar, bins);
      cM += km; cA += ka; cN += kn;
      if (ka > 2 * km) relA += 1;
      if (kn <= 1.5 * km) relN += 1;
      if (Math.abs(bias(mnar)) > 2) relB += 1;
    }
    const f = (x) => (x / REPS).toFixed(1).padStart(5);
    console.log(
      `${steep.toFixed(1)}   ${bins}  | ${(mb / REPS).toFixed(2).padStart(7)} ${(nb / REPS).toFixed(2).padStart(8)} | ${f(cM)}/${f(cA)}/${f(cN)} |   ${String(relA).padStart(3)}/${REPS}      ${String(relN).padStart(3)}/${REPS}        ${String(relB).padStart(3)}/${REPS}`,
    );
  }
}

/* --- 2. shipped constants across the rate range ----------------------------- */
console.log(`\n=== 2. shipped constants (steep ${M.STEEP}) across the rate range`);
console.log("rate  mech  |   bias ± sd     obs SD   check(4 bins)");
for (const rate of [0.1, 0.2, 0.3, 0.4, 0.5]) {
  for (const mech of ["mcar", "mar", "mnar"]) {
    let b = 0, b2 = 0, sdv = 0, c = 0;
    for (let s = 1; s <= REPS; s += 1) {
      const pts = run(mech, rate, M.STEEP, s);
      const x = bias(pts);
      b += x; b2 += x * x;
      sdv += M.sd(pts.filter((p) => !p.miss).map((p) => p.w));
      c += contrastOf(pts, 4);
    }
    const mBias = b / REPS;
    console.log(
      `${rate.toFixed(1)}  ${mech.padEnd(5)} | ${mBias.toFixed(2).padStart(6)} ± ${Math.sqrt(b2 / REPS - mBias * mBias).toFixed(2)}   ${(sdv / REPS).toFixed(2)}    ${(c / REPS).toFixed(1).padStart(5)}`,
    );
  }
}
let ts = 0;
for (let s = 1; s <= REPS; s += 1) ts += M.sd(M.cohort(N, makeRng(s)).map((p) => p.w));
console.log(`true SD of weight: ${(ts / REPS).toFixed(2)} kg`);

/* --- 3. the observed trend, and where the hidden weights sit off it ---------
   The reveal's second reading: fit w ~ age to the WEIGHED only, then measure
   the mean residual of the HIDDEN points against that line. Near zero says a
   prediction built from what you see would have been right for what you do
   not (why conditional imputation works under MCAR/MAR); systematically
   positive says the missing are exactly the ones no observed-data function
   could find (MNAR). */
console.log(`\n=== 3. hidden weights against the observed trend, rate ${RATE0}`);
for (const mech of ["mcar", "mar", "mnar"]) {
  let resid = 0, r2 = 0, pos = 0;
  for (let s = 1; s <= REPS; s += 1) {
    const pts = run(mech, RATE0, M.STEEP, s);
    const fit = M.fitLine(pts.filter((p) => !p.miss));
    const hidden = pts.filter((p) => p.miss);
    const r = M.mean(hidden.map((p) => p.w - (fit.intercept + fit.slope * p.age)));
    resid += r; r2 += r * r;
    if (r > 1) pos += 1;
  }
  const m = resid / REPS;
  console.log(`${mech.padEnd(5)} mean hidden residual ${m.toFixed(2).padStart(6)} ± ${Math.sqrt(r2 / REPS - m * m).toFixed(2)} kg   (> +1 kg on ${pos}/${REPS} cohorts)`);
}

/* --- 4. the dynamic caption's threshold -------------------------------------
   The check panel names what it sees, computed from the VISIBLE data — a
   caption keyed off the mechanism parameter would tell the student what a
   study cannot know. Verdict rule: band contrast (max - min share missing,
   4 bins) above T reads "follows age". Chosen so both misfires are rare. */
console.log(`\n=== 4. caption threshold sweep, rate ${RATE0} (misfire rates over ${REPS} seeds)`);
for (const T of [30, 35, 40, 45]) {
  let fp = 0, fnr = 0, fpN = 0;
  for (let s = 1; s <= REPS; s += 1) {
    const c = (m2, off) => contrastOf(run(m2, RATE0, M.STEEP, s + off), 4);
    if (c("mcar", 0) > T) fp += 1;
    if (c("mar", 10000) <= T) fnr += 1;
    if (c("mnar", 20000) > T) fpN += 1;
  }
  console.log(`T=${T}: MCAR reads sloped ${fp}/${REPS} · MAR reads flat ${fnr}/${REPS} · MNAR reads sloped ${fpN}/${REPS}`);
}
