/* ============================================================================
   Assertions on widget 59's engine, geometry and copy.

       node widgets/_lab/prs-verify.mjs

   Imports `widgets/polygenic-score/model.js`, the shipping code and not a copy
   (5.8), and `widgets/core/params.js`, so the URL round trip is the one the
   page performs.

   Eight of these need a reader most.

   THE MEASURE SCRIPT'S OWN NUMBERS. `_lab/prs-measure.mjs` ran 35 checks on
   2026-09-12 and every control on this widget was chosen from them: the region
   that can teach tagging, the polygenicity that reproduces the lesson's curve,
   the tag decay that reaches Martin 2019's figures, and the build size that
   fits a compute. The whole engine was MOVED into the widget, so §2 asserts
   the moved copies against the arrangement that script measured — the region
   from `makeRng(1)` reads 28 SNPs under P < 0.05, 8 clumps, and a lead SNP
   15 kb from the causal one at r² 0.83. If those drift, the figure is drawing
   something nobody measured.

   THE SUMMARY-STATISTIC BASE AGAINST THE PER-PERSON ONE (§5b). Round two makes
   the base study a file of β̂ and P rather than a cohort, which is what lets
   Base study size be a control at all. The two routes are compared at
   n = 1,500 where both exist — and the comparison has to be drawn on BOTH
   sides, because one cohort against one summary draw is two samples of one:
   the mock's first attempt read as a 4 SD failure and the whole discrepancy
   was the per-person route's own spread across cohorts.

   WHAT CLUMPING PROMISES. Two retained lead SNPs are never both inside the
   window and above the r², and every SNP is accounted for exactly once. No
   picture can show either: the panel draws the same points whether the
   algorithm held or not. §3b adds round two's own: every SNP an arc is drawn
   to is at or above the clumping r² to the lead it hangs from.

   THE SCORE IS THE LESSON'S OWN EQUATION. Σ β̂ⱼ xᵢⱼ over the SNPs the
   threshold keeps, asserted against the engine's own column for several people
   at several thresholds, and against the running sum the figure draws.

   STEP 3 IS ONE COLUMN A SNP AT EVERY COUNT (model.js decision 14, round
   three). The run counts beats and the figure counts SNPs and the two are the
   same number; what has to hold instead is the pace — a beat a SNP at the
   nominal 140 ms is 22 s for the default's 160, so the beat is capped by the
   run and the assertions are on the cap: the run at 160 and at every SNP in
   the base study is SCORE_RUN_MS, at 35 it is the nominal beat unchanged,
   and one press of Step is one SNP past the fortieth as before it. The
   column width at both stage widths is asserted against the dot minimum, so
   the strip's switch from dots to bars is the arithmetic and not taste.

   THE BLOCK ↔ TRIANGLE LINK (model.js decision 15, §12b). The pointer's cell
   is found by inverting the rotated frame, and every one of the 4,950 cells
   is asserted to round-trip through it from its own centre; the region table
   a click goes through is checked with core's own `hitTest` at every cell
   centre and every column, and the pin's parser against the forms a URL can
   carry. The reading lines are built from live numbers, so they are called
   here and put through the register sweep like the batch's lines once were.

   THE RISK MODEL (§6b). The logistic fit is asserted against three closed
   forms before anything is drawn from it, and then the calibration itself:
   fitted in the base population and read in a matched target it lands on the
   diagonal, and in a distant one it does not. That contrast is step 6's whole
   claim, and no pixel hash can see it.

   THE RUN'S LAST FRAME IS THE FINISHED FIGURE, on all six steps, and step 2's
   first frame of Play is the tests with no clump taken. Neither is visible to
   any hash that photographs a settled figure.

   THE REGISTER, INCLUDING THE TWO NOMENCLATURE RULINGS. Kenneth, 2026-09-12:
   "tune" is machine learning's word and the field's are best-fit, target
   sample, validation sample and out of sample; and "holdout" stays the name of
   the token, not of anything a reader sees. §11 greps every reader-facing
   string for both, alongside the collection's own vocabulary — and splits the
   sweep so that the SCORE is never called a risk while step 6, where a fitted
   model turns it into one, may say so.

   THE STATUS. Both files say `draft` and this assertion says so; it flips at
   ship, in the same commit as the manifest and the widget.

   Exits non-zero on failure.
   ========================================================================= */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "../polygenic-score/model.js";
import { makeRng } from "../core/rng.js";
import { resolveParams, toQuery } from "../core/params.js";
import { hitTest } from "../core/canvas.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

let failed = 0;
let ran = 0;
const pad = (s, n) => String(s).padEnd(n);
function check(name, ok, detail = "") {
  ran += 1;
  if (!ok) failed += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${pad(name, 82)} ${detail}`);
}

const src = read("widgets/polygenic-score/main.js");
const manifest = JSON.parse(read("widgets/manifest.json"));
const card = manifest.widgets.find((w) => w.slug === "polygenic-score");

/* the state the widget opens on, through its own door */
const DEFAULTS = {
  page: "haplotypes", recomb: "medium", clumpR2: "0.1", causalTyped: "typed",
  baseSize: "15000", causal: "300", h2: "0.3", target: "same", threshold: "0.01",
  prevalence: "20", riskThreshold: "30", person: 1, seed: 41, shown: 0,
};
const base = (over = {}) => ({ ...DEFAULTS, ...over });
const PAGES = M.PAGE_VALUES;

/** `compute`'s own body, called the way the widget calls it. */
const builds = new Map();
function build(params) {
  const key = JSON.stringify(M.configFor(params)) + (params.seed ?? 1);
  if (!builds.has(key)) builds.set(key, M.build(makeRng(params.seed ?? 1), M.configFor(params)));
  return builds.get(key);
}

/* --- the widget itself, driven with no browser and no clock ----------------
 * `main.js` imports two things from core and its own model, so stubbing the
 * core import captures the whole config object — and `compute`,
 * `animation.init/advance/rebuild`, `legend`, `readout` and `summary` are then
 * callable with no DOM. The REAL `makePlot` is kept, because it is DOM-free —
 * it takes a context and does arithmetic — so §12 can drive the widget's own
 * `draw` against a recording context and read every string the figure paints.
 */
let cached = null;
async function widget() {
  if (cached) return cached;
  const abs = (rel) => JSON.stringify(new URL(rel, import.meta.url).href);
  let text = src;
  text = text.replace(/^import \{ defineWidget, makePlot \} from "\.\.\/core\/index\.js";$/m,
    `import { makePlot } from ${abs("../core/canvas.js")};`
    + " const __cfg = {}; const defineWidget = (c) => Object.assign(__cfg, c);");
  text = text.replace(/^import \* as M from "\.\/model\.js";$/m,
    `import * as M from ${abs("../polygenic-score/model.js")};`);
  text += "\nexport { __cfg };\n";
  cached = (await import(
    `data:text/javascript;base64,${Buffer.from(text, "utf8").toString("base64")}`
  )).__cfg;
  return cached;
}

/* --- 1 · the tails and the small statistics -------------------------------- */
{
  check("a two-sided t of 0 is P = 1", M.tTwoSided(0, 497) === 1);
  check("…and one of 4.0 on 497 df is about 7e-5",
    M.tTwoSided(4, 497) > 5e-5 && M.tTwoSided(4, 497) < 9e-5, M.tTwoSided(4, 497).toExponential(2));
  /* qt(0.975, 15) = 2.1314, the multiplier the lesson's own interval uses at
     about 16 people a vigintile */
  check("the 95% t multiplier on 15 df is 2.131", Math.abs(M.tCritical(15) - 2.1314) < 1e-3,
    M.tCritical(15).toFixed(4));
  check("…and on 14 df it is 2.145", Math.abs(M.tCritical(14) - 2.1448) < 1e-3,
    M.tCritical(14).toFixed(4));

  const rng = makeRng(3);
  const a = Uint8Array.from({ length: 400 }, () => (rng.next() < 0.4 ? 1 : 0));
  const b = Uint8Array.from(a);
  check("r² of an allele vector with itself is 1", Math.abs(M.r2(a, b) - 1) < 1e-12);
  const c = Uint8Array.from({ length: 400 }, () => (rng.next() < 0.4 ? 1 : 0));
  const v = M.r2(a, c);
  check("…and with an independent one it is near zero", v >= 0 && v < 0.05, v.toFixed(4));
  check("the correlation of a vector with itself is 1",
    Math.abs(M.cor([1, 2, 3, 4], [1, 2, 3, 4]) - 1) < 1e-12);
  check("R² is the squared correlation",
    Math.abs(M.r2Score([1, 2, 3, 4], [2, 4, 5, 9]) - M.cor([1, 2, 3, 4], [2, 4, 5, 9]) ** 2) < 1e-12);
}

/* --- 1b · round two's numerics, against closed forms ------------------------
 * The normal tail carries the base study's P values and the normal quantile
 * carries the liability a prevalence names; the logistic fit carries the whole
 * of step 6. Each is asserted against an answer that can be written down.
 */
{
  check("Φ(1.96) is 0.975002", Math.abs(M.normCdf(1.96) - 0.9750021049) < 1e-9,
    M.normCdf(1.96).toPrecision(10));
  check("the two-sided tail at z 5.4513 is the 5e−8 end of the slider",
    Math.abs(M.normTail2(5.4513) / 5e-8 - 1) < 2e-3, M.normTail2(5.4513).toExponential(3));
  check("Φ⁻¹(0.975) is 1.959964", Math.abs(M.normQuantile(0.975) - 1.959963985) < 1e-6,
    M.normQuantile(0.975).toPrecision(10));
  check("Φ⁻¹(0.8) is 0.841621", Math.abs(M.normQuantile(0.8) - 0.8416212336) < 1e-6);
  check("the liability cut at prevalence 0.2 is Φ⁻¹(0.8)",
    Math.abs(M.normQuantile(1 - 0.2) - 0.8416212336) < 1e-6);

  /* intercept only: the MLE is log(k / (n − k)) exactly */
  const n = 400;
  const k = 120;
  const y = Array.from({ length: n }, (_, i) => (i < k ? 1 : 0));
  check("the logistic intercept on 120 of 400 is log(k / (n − k))",
    Math.abs(M.logistic([new Float64Array(n).fill(1)], y).beta[0] - Math.log(k / (n - k))) < 1e-9);

  /* a binary covariate: the MLE is the 2 × 2 log odds ratio exactly */
  const cells = [[30, 70], [10, 90]];
  const y2 = [];
  const x2 = [];
  for (let i = 0; i < cells[0][0]; i += 1) { y2.push(1); x2.push(1); }
  for (let i = 0; i < cells[0][1]; i += 1) { y2.push(0); x2.push(1); }
  for (let i = 0; i < cells[1][0]; i += 1) { y2.push(1); x2.push(0); }
  for (let i = 0; i < cells[1][1]; i += 1) { y2.push(0); x2.push(0); }
  const f2 = M.logistic([new Float64Array(y2.length).fill(1), Float64Array.from(x2)], y2);
  check("…and a binary covariate's slope is the 2 × 2 log odds ratio",
    Math.abs(f2.beta[1] - Math.log((30 * 90) / (70 * 10))) < 1e-9, f2.beta[1].toFixed(6));

  /* the offset branch: outcomes generated at a known logit must come back with
     a calibration intercept of 0 and a calibration slope of 1 */
  const N = 20000;
  const rng = makeRng(7);
  const off = [];
  const y3 = [];
  for (let i = 0; i < N; i += 1) {
    const e = -2 + 2 * rng.normal(0, 1);
    off.push(e);
    y3.push(rng.next() < 1 / (1 + Math.exp(-e)) ? 1 : 0);
  }
  const ones = new Float64Array(N).fill(1);
  const inter = M.logistic([ones], y3, { offset: off }).beta[0];
  const slope = M.logistic([ones, Float64Array.from(off)], y3).beta[1];
  check("outcomes generated at a known logit read back as intercept 0, slope 1",
    Math.abs(inter) < 0.05 && Math.abs(slope - 1) < 0.05,
    `${inter.toFixed(3)} · ${slope.toFixed(3)}`);

  const [lo, hi] = M.wilson(8, 32);
  check("Wilson's interval on 8 of 32 brackets the fraction and stays in [0, 1]",
    lo > 0 && lo < 0.25 && hi > 0.25 && hi < 1, `${lo.toFixed(3)} – ${hi.toFixed(3)}`);
}

/* --- 2 · the moved engine against the measure script's own arrangement ------
 * The measure script and the mock both built the region from `makeRng(1)` at
 * the defaults. These are their numbers, recomputed here from the copies that
 * ship.
 */
const MEASURED = M.buildRegion(makeRng(1), { recomb: 0.005, typed: true, clumpR2: 0.1 });
{
  check("the measured region has 28 SNPs under P < 0.05", MEASURED.hits === 28,
    String(MEASURED.hits));
  check("…and clumps to 8", MEASURED.clumps.length === 8, String(MEASURED.clumps.length));
  check("…and its lead SNP is NOT the causal one — the slot's own sentence",
    MEASURED.leadIsCausal === false);
  check("…at r² 0.83 to it", Math.abs(MEASURED.leadR2 - 0.8299) < 0.001, MEASURED.leadR2.toFixed(4));
  check("…15 kb away", MEASURED.leadDist === 15, `${MEASURED.leadDist} kb`);

  /* r² falls with distance, and less recombination holds more of it — the
     measure script's first table */
  const profile = (recomb) => {
    const reg = M.buildRegion(makeRng(1), { recomb, typed: true, clumpR2: 0.1 });
    const sums = [0, 0, 0];
    const counts = [0, 0, 0];
    for (let j = 0; j < reg.R.length; j += 1) {
      for (let k = 0; k < j; k += 1) {
        const d = (j - k) * M.REGION.blockLen;
        const bin = d < 25 ? 0 : d < 100 ? 1 : d < 400 ? 2 : -1;
        if (bin >= 0) {
          sums[bin] += reg.R[j][k];
          counts[bin] += 1;
        }
      }
    }
    return sums.map((s, i) => s / counts[i]);
  };
  const mid = profile(0.005);
  check("r² falls with distance at the default recombination",
    mid[0] > mid[1] && mid[1] > mid[2], mid.map((x) => x.toFixed(3)).join(" · "));
  const lowR = profile(0.002);
  const highR = profile(0.02);
  check("…less recombination holds more of it, more holds less",
    lowR[1] > mid[1] && mid[1] > highR[1],
    `${lowR[1].toFixed(3)} · ${mid[1].toFixed(3)} · ${highR[1].toFixed(3)}`);
  check("every r² is a squared correlation, so it sits in [0, 1]",
    MEASURED.R.every((row) => row.every((x) => x >= 0 && x <= 1 + 1e-12)));
  check("the r² matrix is symmetric with ones on its diagonal",
    MEASURED.R.every((row, j) => row[j] === 1 && row.every((x, k) => x === MEASURED.R[k][j])));

  /* ROUND TWO: step 1's readout is the BLOCK'S REACH and not the clump count.
     The mock measured the count moving 8 → 8 → 23 across the three settings,
     so Low and Medium read the same; what moves at every setting is how far a
     shared stretch of ancestor runs. */
  const reach = ["low", "medium", "high"].map((r) => {
    const reg = M.buildRegion(makeRng(1), { recomb: M.recombOf(r).rate, typed: true, clumpR2: 0.1 });
    return [reg.pairsHigh, reg.pairReach];
  });
  check("pairs above r² 0.5 fall as recombination rises",
    reach[0][0] > reach[1][0] && reach[1][0] > reach[2][0],
    reach.map((x) => x[0]).join(" → "));
  check("…and so does the furthest distance one of them spans",
    reach[0][1] >= reach[1][1] && reach[1][1] > reach[2][1],
    `${reach.map((x) => x[1]).join(" → ")} kb`);
  check("every pair of the region's own SNPs is counted once",
    MEASURED.pairsTotal === (M.REGION.m * (M.REGION.m - 1)) / 2, String(MEASURED.pairsTotal));
  check("the first clump's size is its lead plus the SNPs it accounts for",
    MEASURED.firstClump === 1 + MEASURED.clumps[0].members.length, String(MEASURED.firstClump));
}

/* --- 3 · what clumping promises -------------------------------------------
 * Neither property is visible in any picture: the panel draws the same points
 * whether the algorithm held or not.
 */
{
  let onceEach = true;
  let byP = true;
  let apart = true;
  let sizes = "";
  for (const recomb of [0.002, 0.005, 0.02]) {
    for (const r2t of [0.1, 0.5]) {
      for (const typed of [true, false]) {
        const reg = M.buildRegion(makeRng(1), { recomb, typed, clumpR2: r2t });
        const seen = new Uint8Array(reg.idx.length);
        for (const c of reg.clumps) {
          for (const j of [c.index, ...c.members]) {
            if (seen[j]) onceEach = false;
            seen[j] = 1;
          }
        }
        if (seen.some((x) => !x)) onceEach = false;
        for (let i = 1; i < reg.clumps.length; i += 1) {
          if (reg.clumps[i].p < reg.clumps[i - 1].p) byP = false;
        }
        /* THE ALGORITHM'S OWN GUARANTEE: no two retained leads are both inside
           the window and above the r². */
        for (let i = 0; i < reg.clumps.length; i += 1) {
          for (let j = 0; j < i; j += 1) {
            const a = reg.clumps[i].index;
            const b = reg.clumps[j].index;
            const near = Math.abs(reg.pos[a] - reg.pos[b]) <= M.CLUMP_KB;
            if (near && reg.Rs[a][b] >= r2t) apart = false;
          }
        }
        if (recomb === 0.005 && typed) sizes += ` r²${r2t}: ${reg.clumps.length}`;
      }
    }
  }
  check("every SNP in the region is in exactly one clump", onceEach);
  check("clumps come out in order of their lead SNP's P", byP);
  check("no two retained lead SNPs are within 250 kb at or above the clumping r²", apart);
  const loose = M.buildRegion(makeRng(1), { recomb: 0.005, typed: true, clumpR2: 0.1 });
  const strict = M.buildRegion(makeRng(1), { recomb: 0.005, typed: true, clumpR2: 0.5 });
  check("a stricter clumping r² absorbs less and leaves more clumps",
    strict.clumps.length > loose.clumps.length,
    `${loose.clumps.length} → ${strict.clumps.length}`);
  check("the lead SNP is the first clump's index, so it lands on the first beat",
    loose.clumps[0].index === loose.lead, sizes.trim());
  check("the causal SNP's mark arrives with a clump that exists",
    loose.causalAt >= 1 && loose.causalAt <= loose.clumps.length, `beat ${loose.causalAt}`);
}

/* --- 3b · what step 2's arcs claim -----------------------------------------
 * An arc says "this SNP's r² to the lead is at least the clumping r², and it
 * is inside the window" — the opacity carries the number. Nothing in a picture
 * can check either, and an arc drawn to a SNP that failed one of them would be
 * the figure teaching the algorithm's opposite.
 */
const OPEN = build(base());
{
  const R = OPEN.region;
  let ok = true;
  let worstR2 = 1;
  let worstKb = 0;
  for (const c of R.clumps) {
    for (const m of c.members) {
      const r2 = R.Rs[c.index][m];
      const kb = Math.abs(R.pos[m] - R.pos[c.index]);
      worstR2 = Math.min(worstR2, r2);
      worstKb = Math.max(worstKb, kb);
      if (r2 < R.clumpR2 || kb > M.CLUMP_KB) ok = false;
    }
  }
  check("every SNP an arc is drawn to is at or above the clumping r² to its lead", ok,
    `lowest r² ${worstR2.toFixed(3)}, furthest ${worstKb} kb`);
  check("the first clump draws 26 arcs at the default seed",
    R.clumps[0].members.length === 26, String(R.clumps[0].members.length));
  check("the run is three beats a clump, so 24 beats at the default",
    M.totalFor("clump", OPEN, base()) === M.CLUMP_BEATS * R.clumps.length
    && M.totalFor("clump", OPEN, base()) === 24,
    String(M.totalFor("clump", OPEN, base())));
  check("step 1's run is one haplotype a beat, 40 of them",
    M.totalFor("haplotypes", OPEN, base()) === M.HAP_ROWS && M.HAP_ROWS === 40);
}

/* --- 4 · the region the widget opens on ------------------------------------ */
{
  const R = OPEN.region;
  check("the default region reads 38 SNPs under P < 0.05 and 8 clumps",
    R.hits === 38 && R.clumps.length === 8, `${R.hits} · ${R.clumps.length}`);
  check("…3 of them under P < 0.05", R.sigClumps === 3, String(R.sigClumps));
  check("…and its lead is 25 kb from the causal SNP at r² 0.79 — the case the step is for",
    R.leadIsCausal === false && R.leadDist === 25 && Math.abs(R.leadR2 - 0.786) < 0.002,
    `r² ${R.leadR2.toFixed(3)}, ${R.leadDist} kb`);
  check("clumping leaves fewer findings than there are SNPs under the line",
    R.sigClumps < R.hits, `${R.hits} → ${R.sigClumps}`);
  const untyped = build(base({ causalTyped: "untyped" })).region;
  check("with the causal variant off the array the lead is still a good tag for it",
    untyped.leadR2 > 0.4 && untyped.leadIsCausal === false, untyped.leadR2.toFixed(3));
  check("…and the region is tested one SNP shorter", untyped.idx.length === M.REGION.m - 1,
    String(untyped.idx.length));
}

/* --- 5 · the genome, the curve and the score ------------------------------- */
{
  const G = OPEN.genome;
  const rows = G.rows;
  const at = (t) => rows[M.THRESHOLDS.indexOf(t)];
  /* ROUND TWO: the base study is a size the reader sets, and the cohort it used
     to be is gone (model.js decision 6). */
  check("the base study is 15,000 people over 1,000 SNPs, and no cohort is drawn for it",
    G.nBase === 15000 && G.m === 1000 && G.base === undefined, `${G.nBase} × ${G.m}`);
  check("300 of them carry an effect", G.nCausal === 300, String(G.nCausal));
  check("the target and validation samples are 319 each",
    G.target.y.length === 319 && G.validation.y.length === 319);
  check("the base population a risk model is fitted in is 3,000 people",
    G.basePop.y.length === M.BASE_POP_N && M.BASE_POP_N === 3000);
  check("the kept count rises with the threshold",
    rows.every((r, i) => i === 0 || r.nSnp >= rows[i - 1].nSnp),
    rows.map((r) => r.nSnp).join(" "));
  check("P < 0.01 keeps 160 SNPs at the default base study size",
    at(0.01).nSnp === 160, String(at(0.01).nSnp));
  check("P < 1 keeps every SNP in the base study", at(1).nSnp === 1000, String(at(1).nSnp));

  /* the lesson's own shape: a maximum at a loose threshold and a fall past it.
     ROUND TWO REWRITES THE 5e−8 ASSERTION. At a base study of 1,500 people the
     curve was near zero there, which is what the lesson's own 0.0013 reads; at
     15,000 the genome-wide cut already keeps 51 SNPs and explains 0.21, and
     that is the base study's size showing — the point the control exists to
     make. The near-zero claim is asserted where it is still true. */
  const best = rows[G.bestIdx];
  const small = build(base({ baseSize: "1500" })).genome;
  check("the curve is near zero at 5e−8 with a base study of 1,500, as the lesson's 0.0013 was",
    small.rows[0].target < 0.01, small.rows[0].target.toFixed(4));
  check("…and is already above 0.15 there at 150,000 — the base study's size, visible",
    build(base({ baseSize: "150000" })).genome.rows[0].target > 0.15,
    build(base({ baseSize: "150000" })).genome.rows[0].target.toFixed(4));
  check("the curve peaks at a threshold inside the slider and falls again past it",
    G.bestIdx > 0 && G.bestIdx < rows.length - 1 && at(1).target < best.target,
    `${best.thresh}: ${best.target.toFixed(4)} → ${at(1).target.toFixed(4)}`);
  check("the best-fit threshold is 0.01 at R² 0.294 in the target sample",
    best.thresh === 0.01 && Math.abs(best.target - 0.2939) < 0.002, best.target.toFixed(4));
  check("…and the validation sample reads 0.267 there",
    Math.abs(best.validation - 0.2671) < 0.002, best.validation.toFixed(4));
  /* THE OVERFITTING TILE CHANGED ITS SUBTRAHEND, and the mock is why: best-fit
     minus validation is a difference between two separate samples of 319 and
     came out positive on only 6 of 16 seeds at this base size. Best-fit minus
     the R² with every SNP kept is the same sample twice — what choosing the
     threshold bought — and was positive on 16 of 16. */
  check("the overfitting the readout prints is 0.039, best-fit minus every SNP kept",
    Math.abs(best.target - at(1).target - 0.0391) < 0.002,
    (best.target - at(1).target).toFixed(4));

  /* THE SCORE IS THE LESSON'S EQUATION, Σ β̂ⱼ xᵢⱼ over the SNPs kept. */
  let identical = true;
  let worst = 0;
  for (const t of [0.001, 0.01, 0.05, 1]) {
    const row = at(t);
    for (const person of [1, 2, 57, 200, 319]) {
      let s = 0;
      for (const j of row.kept) s += G.betaHat[j] * G.target.G[j][person - 1];
      worst = Math.max(worst, Math.abs(s - row.score[person - 1]));
      if (Math.abs(s - row.score[person - 1]) > 1e-9) identical = false;
    }
  }
  check("Σ β̂ⱼ xⱼ over the SNPs kept is the engine's own score", identical,
    `worst difference ${worst.toExponential(1)}`);
  /* DECISION 14: THE ORDER IS BY EVIDENCE. Step 3 draws the first forty kept
     SNPs one a beat, so which forty those are is a decision the figure makes —
     by P ascending, the SNPs carrying the most weight. The score is a sum and
     does not move; only the picture does, which is why the assertion above
     still holds term by term. */
  {
    const bad = rows.filter((r) =>
      !r.kept.every((j, i) => i === 0 || G.P[r.kept[i - 1]] <= G.P[j]));
    check("the SNPs a threshold keeps are ordered by P ascending, at every threshold",
      bad.length === 0, bad.map((r) => M.tText(r.thresh)).join(" "));
    check("…and the strongest forty are all under the tightest threshold that holds them",
      at(0.01).kept.slice(0, 40).every((j) => G.P[j] <= G.P[at(0.01).kept[40]]),
      `P ${G.P[at(0.01).kept[39]].toExponential(1)} → ${G.P[at(0.01).kept[40]].toExponential(1)}`);
  }
  const st = M.personScore(OPEN, base({ page: "score" }));
  check("…and the running sum the figure draws ends on it",
    Math.abs(st.cum[st.cum.length - 1] - st.total) < 1e-12, st.total.toFixed(6));
  check("the person's own arithmetic is genotype × weight, term by term",
    st.contrib.every((c, i) => Math.abs(c - st.genotype[i] * st.beta[i]) < 1e-12));
  check("a person's percentile is where their score sits among the 319",
    st.percentile >= 0 && st.percentile <= 100 && Math.abs(st.z - 2.385) < 0.02,
    `${st.percentile.toFixed(0)}th, ${st.z.toFixed(2)} SD`);

  /* every vigintile holds about a twentieth of the sample, and the intervals
     are the lesson's own t intervals */
  const bins = at(0.01).bins;
  check("the twenty vigintiles hold every person, about 16 each",
    bins.reduce((a, b) => a + b.n, 0) === 319 && bins.every((b) => b.n >= 15 && b.n <= 16));
  check("each vigintile's interval is its mean ± t × sd/√n",
    bins.every((b) => Math.abs(b.hi - b.mean - M.tCritical(b.n - 1) * b.se) < 1e-9));
  check("the vigintiles are in score order",
    bins.every((b, i) => i === 0
      || Math.max(...b.idx.map((k) => at(0.01).score[k]))
        >= Math.max(...bins[i - 1].idx.map((k) => at(0.01).score[k]))));
  check("the cumulative R² over the vigintiles ends on the whole sample's",
    Math.abs(at(0.01).binR2[20] - at(0.01).target) < 1e-9,
    at(0.01).binR2[20].toFixed(4));
}

/* --- 5b · the summary-statistic base against the per-person one -------------
 * BOTH ROUTES ARE DRAWN REPEATEDLY, and that is the whole shape of the check.
 * One per-person cohort against one summary draw compares two samples of one;
 * the mock's first attempt did exactly that and read as a 4 SD failure, all of
 * which was the per-person route's own spread across cohorts. What has to
 * agree is the DISTRIBUTION, so three base cohorts are drawn from one truth
 * and compared with six summary draws from the same truth.
 */
{
  const rng = makeRng(41);
  const seeds = [];
  for (let i = 0; i < 5; i += 1) seeds.push(rng.int(1, 1e9));
  const model = M.drawModel(makeRng(seeds[1]), { m: M.GENOME.m, nCausal: 300, h2: 0.3 });
  const tgt = M.drawTarget(makeRng(seeds[2]), model, { n: M.N_TARGET });
  const trueRaw = Array.from({ length: model.p.length }, (_, j) =>
    model.betaTrue[j] / (Math.sqrt(2 * model.p[j] * (1 - model.p[j])) || 1));
  const reading = (betaHat, P) => {
    const rows = M.THRESHOLDS.map((t) => {
      const { keep, n } = M.keepAt(P, t);
      return n === 0 ? 0 : M.r2Score(M.score(tgt.G, betaHat, keep), tgt.y);
    });
    return {
      err: M.sd(Float64Array.from(Array.from(betaHat).map((v, j) => v - trueRaw[j]))),
      n05: Array.from(P).filter((v) => v < 0.05).length,
      best: Math.max(...rows),
    };
  };
  const per = [];
  for (let i = 0; i < 3; i += 1) {
    const co = M.drawCohort(makeRng(3100 + i), 1500, model.p, model.betaTrue, model.h2, null, 1);
    const scan = M.olsScan(co.y, co.G);
    per.push(reading(scan.beta, scan.P));
  }
  const sum = [];
  for (let i = 0; i < 6; i += 1) {
    const b = M.summaryBase(makeRng(7000 + i), model, 1500);
    sum.push(reading(b.betaHat, b.P));
  }
  const pair = (rows, k) => [M.mean(rows.map((d) => d[k])),
    M.sd(Float64Array.from(rows.map((d) => d[k])))];
  let worstSd = 0;
  const lines = [];
  for (const [name, key] of [["sd(β̂ − β)", "err"], ["SNPs at P < 0.05", "n05"],
    ["best-fit R²", "best"]]) {
    const [pm, ps] = pair(per, key);
    const [sm, ss] = pair(sum, key);
    const apart = Math.abs(pm - sm) / Math.max(Math.sqrt(ps * ps + ss * ss), 1e-9);
    worstSd = Math.max(worstSd, apart);
    lines.push(`${name} ${apart.toFixed(2)} SD`);
  }
  check("the summary base agrees with the per-person one at n = 1,500, within 1.5 SD",
    worstSd <= 1.5, lines.join(" · "));

  /* the summary route's own arithmetic, which no distribution check can pin:
     the standard error is 1/√n on the standardised scale and both β̂ and se
     are divided by √(2p(1−p)) for the raw allele count */
  const big = M.summaryBase(makeRng(99), model, 150000);
  const small = M.summaryBase(makeRng(99), model, 1500);
  const errOf = (b) => M.sd(Float64Array.from(Array.from(b.betaHat)
    .map((v, j) => v - trueRaw[j])));
  check("…and a base study a hundred times larger is ten times closer to the truth",
    Math.abs(errOf(small) / errOf(big) / 10 - 1) < 0.25,
    `${errOf(small).toFixed(4)} → ${errOf(big).toFixed(4)}`);
  check("every P from the summary base sits in [0, 1]",
    Array.from(small.P).every((v) => v >= 0 && v <= 1));
}

/* --- 5c · the lever, which is what round one asked for ---------------------
 * Kenneth's first point was that the curves look flat on this data. Measured
 * the same evening, that was the base study's 1,500 people and not the data:
 * the widget was missing the control.
 */
{
  const r2At = (nb, seed) => {
    const g = build(base({ baseSize: nb, seed })).genome;
    return g.rows[g.bestIdx].target;
  };
  check("a larger base study gives a more accurate score, on the default seed",
    r2At("1500", 41) < r2At("15000", 41) && r2At("15000", 41) < r2At("150000", 41),
    [r2At("1500", 41), r2At("15000", 41), r2At("150000", 41)]
      .map((x) => x.toFixed(3)).join(" → "));
  const means = ["1500", "15000", "150000"]
    .map((nb) => M.mean([41, 1, 2, 3].map((s) => r2At(nb, s))));
  check("…and over four seeds the three sizes stay in that order",
    means[0] < means[1] && means[1] < means[2], means.map((x) => x.toFixed(3)).join(" → "));
  check("…while the vigintile trend grows with it",
    (() => {
      const range = (nb) => {
        const g = build(base({ baseSize: nb })).genome;
        return g.rows[g.bestIdx].range;
      };
      return range("1500") < range("15000") && range("15000") < range("150000");
    })(),
    ["1500", "15000", "150000"].map((nb) => {
      const g = build(base({ baseSize: nb })).genome;
      return g.rows[g.bestIdx].range.toFixed(2);
    }).join(" → "));
  check("the base study's size does not redraw the target sample under it",
    JSON.stringify(Array.from(build(base({ baseSize: "1500" })).genome.target.y.slice(0, 8)))
    === JSON.stringify(Array.from(OPEN.genome.target.y.slice(0, 8))));
}

/* --- 6 · portability, the claim step 5 is for ------------------------------
 * Measurement 5: an allele-frequency shift alone costs a score almost nothing,
 * so each Target population setting moves tag decay as well. Measured here at
 * this build size over eight seeds, at the threshold the matched sample's own
 * curve is largest at.
 */
{
  const SEEDS = 8;
  const acc = { same: [], nearby: [], distant: [] };
  const range = { same: [], nearby: [], distant: [] };
  for (let s = 1; s <= SEEDS; s += 1) {
    const bi = build(base({ seed: s })).genome.bestIdx;
    for (const key of ["same", "nearby", "distant"]) {
      const g = build(base({ seed: s, target: key })).genome;
      acc[key].push(g.rows[bi].target);
      range[key].push(g.rows[bi].range);
    }
  }
  const mu = Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, M.mean(v)]));
  const rg = Object.fromEntries(Object.entries(range).map(([k, v]) => [k, M.mean(v)]));
  check("accuracy falls as the target sample's ancestry moves from the base study's",
    mu.same > mu.nearby && mu.nearby > mu.distant,
    `${mu.same.toFixed(4)} · ${mu.nearby.toFixed(4)} · ${mu.distant.toFixed(4)}`);
  /* Martin 2019 reads about 0.5 for an East Asian target of a European base and
     about 0.2 for an African one. */
  check("…the distant target keeps about a fifth of it, Martin 2019's figure",
    mu.distant / mu.same > 0.10 && mu.distant / mu.same < 0.35,
    (mu.distant / mu.same).toFixed(2));
  check("…and the nearby target keeps about half",
    mu.nearby / mu.same > 0.35 && mu.nearby / mu.same < 0.75,
    (mu.nearby / mu.same).toFixed(2));
  check("the vigintile trend falls with it, which is what step 5 draws",
    rg.same > rg.nearby && rg.nearby > rg.distant,
    `${rg.same.toFixed(2)} · ${rg.nearby.toFixed(2)} · ${rg.distant.toFixed(2)} SD`);
  check("the matched trend is visible — over a trait SD from the first vigintile to the last",
    rg.same > 1, rg.same.toFixed(2));
}

/* --- 6b · the risk model, which is what step 6 is for -----------------------
 * A model fitted in the base population and read in a MATCHED target sits on
 * the diagonal; read in a distant one it does not. That is the whole of step
 * 6, and a pixel hash sees ten dots either way.
 */
{
  const rmOf = (over = {}) => M.riskFor(build(base(over)), base(over));
  const same = rmOf();
  const far = rmOf({ target: "distant" });
  check("the matched target's calibration slope is near 1",
    same.slope > 0.8 && same.slope < 1.3, same.slope.toFixed(3));
  check("…and at least 8 of its 10 deciles' intervals cover the prediction",
    same.covered >= 8, `${same.covered} of 10`);
  check("the distant target's slope falls below 0.7 — the score is less accurate there",
    far.slope < 0.7, far.slope.toFixed(3));
  check("…and fewer of its deciles reach the diagonal", far.covered < same.covered,
    `${far.covered} against ${same.covered}`);

  /* over eight seeds, because one target sample is one sample */
  const slope = { same: [], nearby: [], distant: [] };
  const cover = { same: [], nearby: [], distant: [] };
  for (let s = 1; s <= 8; s += 1) {
    for (const key of ["same", "nearby", "distant"]) {
      const rm = rmOf({ seed: s, target: key });
      slope[key].push(rm.slope);
      cover[key].push(rm.covered);
    }
  }
  const ms = Object.fromEntries(Object.entries(slope).map(([k, v]) => [k, M.mean(v)]));
  const mc = Object.fromEntries(Object.entries(cover).map(([k, v]) => [k, M.mean(v)]));
  check("over eight seeds the calibration slope falls as ancestry moves",
    ms.same > ms.nearby && ms.nearby > ms.distant,
    `${ms.same.toFixed(2)} · ${ms.nearby.toFixed(2)} · ${ms.distant.toFixed(2)}`);
  check("…and so does the number of deciles covering the diagonal",
    mc.same > mc.nearby && mc.nearby > mc.distant,
    `${mc.same.toFixed(1)} · ${mc.nearby.toFixed(1)} · ${mc.distant.toFixed(1)}`);

  /* THE CUT IS NOT A FIXED PERCENTILE — the answer to "how do people
     stratify, arbitrarily?". At the default seed the crossing moves right as
     the ancestry moves away, and the count over the line falls with it.

     IT IS ASSERTED AT THE DEFAULT SEED AND NOT AS A MEAN. Over eight seeds the
     count above a 30% risk is 65 · 65 · 71 — a mis-calibrated model pushes
     people either way, which is itself why the panel beside it exists. The
     reliable claim over seeds is the calibration slope above, and it is the
     one asserted there. */
  const t = M.riskThresholdOf("30").p;
  const cross = ["same", "nearby", "distant"]
    .map((k) => M.crossingPercentile(rmOf({ target: k }), t));
  check("at the default seed the crossing percentile moves with the target population",
    cross[0] < cross[1] && cross[1] < cross[2],
    cross.map((x) => x.toFixed(1)).join(" → "));
  const over = ["same", "nearby", "distant"].map((k) => M.peopleAbove(rmOf({ target: k }), t));
  check("…and fewer of the 319 are over the line as it does",
    over[0] > over[1] && over[1] > over[2], over.join(" → "));
  check("a threshold nobody crosses has no crossing to print (2.11)",
    M.crossingPercentile(same, 0.99) === null && M.peopleAbove(same, 0.99) === 0);

  /* prevalence is a data parameter because it decides who has the disease */
  const cases = ["5", "10", "20"].map((p) => rmOf({ prevalence: p }).cases);
  check("a higher prevalence gives the target sample more cases",
    cases[0] < cases[1] && cases[1] < cases[2], cases.join(" → "));
  check("…and at 5% several deciles hold no case at all, which is the panel falling apart",
    rmOf({ prevalence: "5" }).bins.filter((b) => b.cases === 0).length >= 3,
    `${rmOf({ prevalence: "5" }).bins.filter((b) => b.cases === 0).length} of 10 empty`);

  /* the deciles and the curve the panels draw */
  check("the ten deciles hold every person in the target sample, 31 or 32 each",
    same.bins.reduce((a, b) => a + b.n, 0) === M.N_TARGET
    && same.bins.every((b) => b.n === 31 || b.n === 32));
  check("each decile's mean predicted risk rises with the decile",
    same.bins.every((b, i) => i === 0 || b.pred >= same.bins[i - 1].pred));
  check("the stratification curve is ordered by SCORE, so its axis says what it draws",
    same.curve.every((p, i) => i === 0 || p[0] > same.curve[i - 1][0])
    && same.curve[0][0] === 0 && Math.abs(same.curve[M.N_TARGET - 1][0] - 100) < 1e-9);
  check("a threshold that keeps no SNP has no model, and the step says so",
    build(base({ baseSize: "1500" })).genome.risk[0] === null
    && build(base({ baseSize: "1500" })).genome.rows[0].nSnp === 0);
  check("the person's risk comes with the percentile step 3 prints for them",
    (() => {
      const p = base({ page: "risk" });
      const a = M.personRisk(build(p), p);
      const b = M.personScore(build(p), p);
      return Math.abs(a.percentile - b.percentile) < 1e-9 && a.person === b.person;
    })());
}

/* --- 7 · compute is pure, and the display parameters do not touch it -------- */
{
  const digest = (s) => JSON.stringify({
    hits: s.region.hits,
    clumps: s.region.clumps.map((c) => [c.index, c.members.length, c.p]),
    lead: [s.region.lead, s.region.leadR2, s.region.causalAt],
    rows: s.genome.rows.map((r) => [r.nSnp, r.target, r.validation, r.range, r.excluding]),
    risk: s.genome.risk.map((r) => (r ? [r.slope, r.inter, r.covered] : null)),
    scores: Array.from(s.genome.rows[3].score.slice(0, 12)),
  });
  const a = M.build(makeRng(41), M.configFor(base()));
  const b = M.build(makeRng(41), M.configFor(base()));
  check("two computes at one seed are the same state", digest(a) === digest(b));
  check("a display change computes the same state — the threshold slides over one base study",
    digest(M.build(makeRng(41), M.configFor(base({
      threshold: "0.5", person: 44, page: "quantile", riskThreshold: "40",
    })))) === digest(a));
  check("a different seed is a different state",
    digest(M.build(makeRng(42), M.configFor(base()))) !== digest(a));
  /* DECISION 1: the five sub-streams. A region control must not move the
     genome, and a genome control must not move the region. */
  const otherRegion = M.build(makeRng(41), M.configFor(base({ recomb: "high" })));
  check("a region control leaves the genome exactly where it was",
    JSON.stringify(otherRegion.genome.rows.map((r) => [r.nSnp, r.target]))
    === JSON.stringify(a.genome.rows.map((r) => [r.nSnp, r.target])));
  const otherGenome = M.build(makeRng(41), M.configFor(base({
    causal: "600", target: "distant", baseSize: "1500", prevalence: "5",
  })));
  check("…and a base-study, target or risk control leaves the region where it was",
    JSON.stringify(otherGenome.region.clumps.map((c) => c.index))
    === JSON.stringify(a.region.clumps.map((c) => c.index)));
  check("every randomness comes from the rng core hands in",
    !/Math\.random/.test(src) && !/Math\.random/.test(read("widgets/polygenic-score/model.js")));
}

/* --- 8 · every data setting draws a figure with numbers in it -------------- */
{
  let bad = 0;
  let worstBuild = 0;
  const notes = [];
  for (const recomb of ["low", "medium", "high"]) {
    for (const clumpR2 of ["0.1", "0.5"]) {
      for (const causalTyped of ["typed", "untyped"]) {
        const s = build(base({ recomb, clumpR2, causalTyped }));
        const ok = s.region.clumps.length > 0 && Number.isFinite(s.region.leadR2)
          && s.region.causalAt >= 1 && Number.isFinite(s.region.top)
          && Number.isFinite(s.region.pairReach);
        if (!ok) {
          bad += 1;
          notes.push(`${recomb}/${clumpR2}/${causalTyped}`);
        }
      }
    }
  }
  for (const baseSize of ["1500", "15000", "150000"]) {
    for (const causal of ["100", "300", "600"]) {
      for (const h2 of ["0.1", "0.3", "0.5"]) {
        for (const target of ["same", "nearby", "distant"]) {
          const t0 = performance.now();
          const s = build(base({ baseSize, causal, h2, target }));
          worstBuild = Math.max(worstBuild, performance.now() - t0);
          const fine = s.genome.rows.every((r) => Number.isFinite(r.target)
            && Number.isFinite(r.validation) && Number.isFinite(r.range)
            && r.binR2.every(Number.isFinite) && r.bins.every((b) => Number.isFinite(b.mean)))
            && s.genome.risk.every((rm) => rm === null
              || (Number.isFinite(rm.slope) && Number.isFinite(rm.inter)
                && rm.bins.every((b) => Number.isFinite(b.pred) && Number.isFinite(b.obs))));
          if (!fine) {
            bad += 1;
            notes.push(`${baseSize}/${causal}/${h2}/${target}`);
          }
        }
      }
    }
  }
  check("every setting of every data control builds a finite figure", bad === 0,
    notes.slice(0, 3).join(" | "));
  /* ROUND TWO COSTS MORE AND IS STILL INSIDE THE BUDGET. The base study's own
     cohort is gone (−28 ms) and step 6's base population of 3,000 arrived
     (+52 ms), so a compute is about 100 ms where it was 54. */
  check("a compute at every setting is inside the budget", worstBuild < 150,
    `${worstBuild.toFixed(0)} ms worst of the settings drawn here`);
}

/* --- 9 · the widget driven, with no browser and no clock ------------------- */
{
  const W = await widget();

  /* the run on every step: its length, its last frame, and Step's own unit */
  {
    const state = W.compute({ params: base(), rng: makeRng(41) });
    const seconds = {};
    for (const page of PAGES) {
      const params = base({ page });
      const total = M.totalFor(page, state, params);
      const anim = W.animation.init({ params, state, fromScratch: true });
      anim.mode = "run";
      let frames = 0;
      while (W.animation.advance(anim, { dt: 16, params, state }) && frames < 4000) frames += 1;
      seconds[page] = (frames * 16) / 1000;
      check(`Play on ${pad(page, 11)} ends on the finished figure`,
        anim.k[page] === total && anim.done === true, `${anim.k[page]} of ${total}`);
      check(`…and takes ${seconds[page].toFixed(1)} s at Medium, between 3 and 7`,
        seconds[page] >= 3 && seconds[page] <= 7, `${frames} frames`);

      const stepped = W.animation.init({ params, state, fromScratch: true });
      stepped.mode = "step";
      let more = true;
      let n = 0;
      while (more && n < 200) {
        more = W.animation.advance(stepped, { dt: 16, params, state });
        n += 1;
      }
      /* model.js decision 9: one press of Step is one CLUMP on step 2, which
         is three beats, and one unit everywhere else. The label names what the
         press does (4.4b), and on step 2 it says Next clump. */
      const unit = page === "clump" ? M.CLUMP_BEATS : 1;
      check(`…and one press of Step advances ${page === "clump" ? "one whole clump" : "one unit"}`,
        stepped.k[page] === unit, `${stepped.k[page]} after ${n} frames`);
    }

    /* THE BATCH IS WHAT KEEPS STEP 2 IN BAND. A strict clumping r² on a
       recombining region leaves fifty-eight clumps of one SNP where the
       default leaves eight of twenty-seven, so a beat carries a batch past a
       countable number of them (2.3) and the run is the same length either
       way. */
    const out = [];
    for (const recomb of ["low", "medium", "high"]) {
      for (const clumpR2 of ["0.1", "0.5"]) {
        const p = base({ page: "clump", recomb, clumpR2 });
        const s = build(p);
        const a = W.animation.init({ params: p, state: s, fromScratch: true });
        a.mode = "run";
        let f = 0;
        while (W.animation.advance(a, { dt: 16, params: p, state: s }) && f < 4000) f += 1;
        const sec = (f * 16) / 1000;
        if (sec < 3 || sec > 7) out.push(`${recomb}/${clumpR2} ${sec.toFixed(1)} s`);
      }
    }
    check("step 2's run is between 3 and 7 s at every setting of its own controls",
      out.length === 0, out.join(" | "));

    /* and step 3's, where the P threshold decides how many SNPs there are */
    const outScore = [];
    for (const baseSize of ["1500", "15000", "150000"]) {
      for (const threshold of ["5e-8", "0.01", "1"]) {
        const p = base({ page: "score", baseSize, threshold });
        const s = build(p);
        const a = W.animation.init({ params: p, state: s, fromScratch: true });
        a.mode = "run";
        let f = 0;
        while (W.animation.advance(a, { dt: 16, params: p, state: s }) && f < 8000) f += 1;
        const sec = (f * 16) / 1000;
        /* a threshold that keeps no SNP has nothing to run, which is not a
           pacing failure */
        if (M.totalFor("score", s, p) > 0 && (sec < 3 || sec > 7)) {
          outScore.push(`${baseSize}/${threshold} ${sec.toFixed(1)} s`);
        }
      }
    }
    check("step 3's run stays in band at every base study size and threshold",
      outScore.length === 0, outScore.join(" | "));

    /* DECISION 14: THE DEFAULT'S OWN RUN, a beat a SNP and the whole run held
       to SCORE_RUN_MS. The last frame is the finished sum; one press of Step
       is one SNP at every count. */
    {
      const p = base({ page: "score" });
      const s = build(p);
      const kept = M.rowFor(s, p).nSnp;
      const a = W.animation.init({ params: p, state: s, fromScratch: true });
      a.mode = "run";
      let f = 0;
      while (W.animation.advance(a, { dt: 16, params: p, state: s }) && f < 4000) f += 1;
      const sec = (f * 16) / 1000;
      check("Play on step 3 runs one beat a SNP, inside the band",
        a.k.score === kept && a.done === true && sec >= 3 && sec <= 7,
        `${a.k.score} beats, ${sec.toFixed(1)} s`);
      check("…and the sum its last frame draws is the engine's own score for that person",
        Math.abs(M.personScore(s, p).cum[kept - 1] - M.rowFor(s, p).score[0]) < 1e-12,
        M.rowFor(s, p).score[0].toFixed(6));
      check("…and the beat is the run's cap over the count, under the nominal beat",
        Math.abs(M.beatMs("score", s, p) - M.SCORE_RUN_MS / kept) < 1e-9
        && M.beatMs("score", s, p) < M.BEAT_MS.score,
        `${M.beatMs("score", s, p).toFixed(1)} ms a SNP at ${kept}`);
      const few = base({ page: "score", baseSize: "1500" });
      const sFew = build(few);
      const keptFew = M.rowFor(sFew, few).nSnp;
      check("…while at 40 or fewer kept the beat is the nominal one, as in round one",
        keptFew <= 40 && M.beatMs("score", sFew, few) === M.BEAT_MS.score,
        `${keptFew} SNPs at ${M.beatMs("score", sFew, few)} ms`);
      const all = base({ page: "score", threshold: "1" });
      const sAll = build(all);
      check("…and at every SNP in the base study the run is still the cap",
        M.totalFor("score", sAll, all) === M.GENOME.m
        && Math.abs(M.beatMs("score", sAll, all) * M.GENOME.m - M.SCORE_RUN_MS) < 1e-6,
        `${M.beatMs("score", sAll, all).toFixed(1)} ms a SNP at ${M.GENOME.m}`);
      /* one press of Step is one SNP, past the fortieth as before it */
      const one = W.animation.init({ params: p, state: s, fromScratch: true });
      one.k.score = 40;
      one.mode = "step";
      let g = 0;
      while (W.animation.advance(one, { dt: 16, params: p, state: s }) && g < 200) g += 1;
      check("…and one press of Step past the fortieth adds one SNP", one.k.score === 41,
        `${one.k.score} after ${g} frames`);
    }

    check("the authored head start reaches the longest run the widget has",
      W.params.shown.max >= M.GENOME.m, `shown max ${W.params.shown.max}`);

    /* model.js decision 5: Play's first frame on step 2 draws the tests and
       takes no beat; Step takes a whole clump on the same press. */
    const params = base({ page: "clump" });
    const run = W.animation.init({ params, state, fromScratch: true });
    run.mode = "run";
    W.animation.advance(run, { dt: 16, params, state });
    check("Play's first frame on step 2 draws the tests and takes no beat",
      run.scanDone === true && run.k.clump === 0);
    const step = W.animation.init({ params, state, fromScratch: true });
    step.mode = "step";
    for (let i = 0; i < 60; i += 1) {
      if (!W.animation.advance(step, { dt: 16, params, state })) break;
    }
    check("…and the first press of Step does both, and stops on a whole clump",
      step.scanDone === true && step.k.clump === M.CLUMP_BEATS);
    check("nothing is drawn before the run starts",
      W.animation.init({ params, state, fromScratch: true }).scanDone === false);
  }

  /* the run is per step, and a display change keeps every step's work */
  {
    const params = base();
    const state = W.compute({ params, rng: makeRng(41) });
    const anim = W.animation.init({ params, state, fromScratch: true });
    anim.k.clump = 6;
    anim.scanDone = true;
    anim.k.score = 12;
    anim.k.haplotypes = 9;
    W.animation.rebuild(anim, { params: base({ page: "score" }), state });
    check("visiting another step keeps every step's work (invariant 3)",
      anim.k.clump === 6 && anim.k.score === 12 && anim.k.haplotypes === 9);
    check("…and the run button follows the step it is on", anim.done === false);
    W.animation.rebuild(anim, { params: base({ page: "clump" }), state });
    check("coming back leaves the clumping where it was", anim.k.clump === 6);
    /* the threshold is display, so it keeps the sum — and re-derives how far
       that sum can have got */
    anim.k.score = 200;
    W.animation.rebuild(anim, { params: base({ page: "score", threshold: "0.001" }), state });
    check("a tighter threshold stops the sum at the SNPs it keeps",
      anim.k.score === M.totalFor("score", state, base({ threshold: "0.001" })),
      `${anim.k.score} SNPs`);
    const fresh = W.animation.init({ params, state, fromScratch: true });
    check("a data change starts every step over (invariant 3)",
      PAGES.every((p) => fresh.k[p] === 0) && fresh.scanDone === false);

    const authored = W.animation.init({
      params: base({ page: "threshold", shown: 6 }), state, fromScratch: false,
    });
    check("shown= lands partway into the step the link names",
      authored.k.threshold === 6 && authored.k.haplotypes === 0);
    const replayed = W.animation.init({
      params: base({ page: "threshold", shown: 6 }), state, fromScratch: true,
    });
    check("…and Replay ignores it", replayed.k.threshold === 0);
    const clamped = W.animation.init({
      params: base({ page: "risk", shown: 9999 }), state, fromScratch: false,
    });
    check("a head start past the end lands on the last unit",
      clamped.k.risk === M.RISK_DECILES && clamped.done === true);

    /* DECISION 14: `shown` ON STEP 3 COUNTS SNPs, clamped to the kept count,
       so `?shown=160` is the finished sum, a value inside it is the SNP it
       names, and a value past it lands on the end. */
    const kept3 = M.rowFor(state, base()).nSnp;
    const shownAt = (n) => W.animation.init({
      params: base({ page: "score", shown: n }), state, fromScratch: false,
    });
    check("shown= on step 3 counts SNPs added, clamped to the kept count",
      shownAt(12).k.score === 12 && shownAt(12).done === false
      && shownAt(41).k.score === 41 && shownAt(41).done === false
      && shownAt(kept3).k.score === kept3 && shownAt(kept3).done === true
      && shownAt(999).k.score === kept3 && shownAt(999).done === true,
      `12 → ${shownAt(12).k.score}, 41 → ${shownAt(41).k.score}, ${kept3} → ${shownAt(kept3).k.score}`);
  }

  /* the tiles: blank before the run, tracking the partial figure during it */
  {
    const state = W.compute({ params: base(), rng: makeRng(41) });
    const zero = Object.fromEntries(PAGES.map((p) => [p, 0]));
    const empty = (page) => W.readout({
      params: base({ page }), state, anim: { k: { ...zero }, scanDone: false },
    });
    let blank = true;
    const shown = [];
    for (const page of PAGES) {
      if (!empty(page).every((t) => t.value === "—")) {
        blank = false;
        shown.push(page);
      }
    }
    check("every tile on every step is blank before the run (2.4)", blank, shown.join(" "));

    const anim = (page, k) => ({ k: { ...zero, [page]: k }, scanDone: true });
    const mid = W.readout({ params: base({ page: "score" }), state, anim: anim("score", 10) });
    const named = Object.fromEntries(mid.map((t) => [t.label, t.value]));
    check("the score tracks the SNPs added so far (2.8)",
      named.Score === M.n2(M.personScore(state, base({ page: "score" })).cum[9]), named.Score);
    check("…and the two tiles that place the person wait for the last SNP (decision 7)",
      named["Standardised score"] === "—" && named.Percentile === "—");
    const total = M.totalFor("score", state, base());
    const done = W.readout({ params: base({ page: "score" }), state, anim: anim("score", total) });
    const at38 = Object.fromEntries(done.map((t) => [t.label, t.value]));
    check("…and read once it is complete",
      at38["Standardised score"] !== "—" && at38.Percentile !== "—",
      `${at38["Standardised score"]} SD, ${at38.Percentile}th`);

    const early = Object.fromEntries(W.readout({
      params: base({ page: "threshold" }), state, anim: anim("threshold", 2),
    }).map((t) => [t.label, t.value]));
    check("a threshold the sweep has not reached prints no R² (2.11)",
      early["R² in the target sample"] === "—", early["R² in the target sample"]);
    check("…and no overfitting until every SNP has been scored too",
      early.Overfitting === "—");
    const swept = Object.fromEntries(W.readout({
      params: base({ page: "threshold" }), state, anim: anim("threshold", 11),
    }).map((t) => [t.label, t.value]));
    check("…and the finished sweep prints both samples and the overfitting",
      swept["R² in the target sample"] === "0.294"
      && swept["R² in the validation sample"] === "0.267"
      && swept.Overfitting === "0.039",
      `${swept["R² in the target sample"]} / ${swept["R² in the validation sample"]} / ${swept.Overfitting}`);

    const q = Object.fromEntries(W.readout({
      params: base({ page: "quantile" }), state, anim: anim("quantile", 20),
    }).map((t) => [t.label, t.value]));
    check("step 5 reads the score's R², the trend and how many intervals clear the mean",
      q["R²"] !== "—" && q["First to last vigintile"] !== "—"
      && /^\d+ of 20$/.test(q["Intervals excluding the mean"]),
      `${q["R²"]} · ${q["First to last vigintile"]} · ${q["Intervals excluding the mean"]}`);
    const qPart = Object.fromEntries(W.readout({
      params: base({ page: "quantile" }), state, anim: anim("quantile", 8),
    }).map((t) => [t.label, t.value]));
    check("…and the first-to-last reading waits for the twentieth vigintile",
      qPart["First to last vigintile"] === "—");

    /* step 1 and step 6's own tiles */
    const hap = Object.fromEntries(W.readout({
      params: base({ page: "haplotypes" }), state, anim: anim("haplotypes", 12),
    }).map((t) => [t.label, t.value]));
    check("step 1 counts the haplotypes drawn and waits for the r² of the finished pool",
      hap["Haplotypes drawn"] === "12" && hap["Pairs above r² 0.5"] === "—",
      Object.values(hap).join(" · "));
    const hapDone = Object.fromEntries(W.readout({
      params: base({ page: "haplotypes" }), state, anim: anim("haplotypes", M.HAP_ROWS),
    }).map((t) => [t.label, t.value]));
    check("…and reads it once the pool is complete",
      hapDone["Pairs above r² 0.5"] === "271" && hapDone["The furthest of them"] === "80 kb"
      && hapDone["SNPs in the first clump"] === "27",
      Object.values(hapDone).join(" · "));

    const riskPart = Object.fromEntries(W.readout({
      params: base({ page: "risk" }), state, anim: anim("risk", 4),
    }).map((t) => [t.label, t.value]));
    check("step 6's intervals track the deciles drawn (2.8), and the two fits wait",
      /^\d+ of 4$/.test(riskPart["Intervals covering the diagonal"])
      && riskPart["Calibration slope"] === "—" && riskPart["People above it"] === "—",
      Object.values(riskPart).join(" · "));
    const riskDone = Object.fromEntries(W.readout({
      params: base({ page: "risk" }), state, anim: anim("risk", M.RISK_DECILES),
    }).map((t) => [t.label, t.value]));
    check("…and the finished panel prints the slope, the intercept, the cut and the count",
      riskDone["Calibration slope"] === "1.08" && riskDone["Calibration intercept"] === "0.07"
      && riskDone["Percentile crossing the threshold"] === "81"
      && riskDone["People above it"] === "62",
      Object.values(riskDone).join(" · "));
    check("…and the person's risk is a percentage, not a score",
      /^\d+%$/.test(riskDone["This person's risk"]), riskDone["This person's risk"]);
  }

  /* no tile, note or sentence carries a NaN, anywhere along the rail */
  {
    const bad = (s) => /NaN|undefined|Infinity/.test(String(s));
    const defaults = Object.fromEntries(Object.entries(W.params)
      .filter(([, f]) => f.type !== "section").map(([n, f]) => [n, f.default]));
    const optionsOf = (f) => (f.type === "int" || f.type === "float"
      ? [f.min, f.default, f.max]
      : f.options.map((o) => (typeof o === "string" ? o : o.value)));
    let strings = 0;
    const nans = [];
    for (const [name, field] of Object.entries(W.params)) {
      if (field.type === "section" || field.hidden) continue;
      for (const v of optionsOf(field)) {
        const params = { ...defaults, [name]: v };
        const state = build(params);
        for (const page of PAGES) {
          const total = M.totalFor(page, state, params);
          for (const k of [0, 1, Math.floor(total / 2), total]) {
            const p = { ...params, page };
            const anim = {
              k: { ...Object.fromEntries(PAGES.map((q) => [q, 0])), [page]: k },
              scanDone: k > 0,
              done: k >= total,
            };
            const say = [
              ...W.readout({ params: p, state, anim }).flatMap((t) => [t.label, t.value, t.note]),
              W.summary({ params: p, state, anim }),
              ...W.legend({ params: p }).map((e) => e.label),
            ].filter((s) => s != null);
            strings += say.length;
            for (const s of say) if (bad(s)) nans.push(`${name}=${v} ${page} k=${k}: ${s}`);
          }
        }
      }
    }
    check(`no readout, summary or legend string carries a NaN (${strings} strings)`,
      nans.length === 0, nans.slice(0, 3).join(" | "));
  }

  /* the legend follows the step, so it names what is drawn */
  {
    const of = (page) => W.legend({ params: base({ page }) }).map((e) => e.label);
    check("step 1's legend names the alleles, the r² and the causal position",
      of("haplotypes").some((l) => l.includes("allele"))
      && of("haplotypes").some((l) => l.includes("r²"))
      && of("haplotypes").some((l) => l.includes("causal")), of("haplotypes").join(" · "));
    check("step 2's names the lead SNP, its arcs, the line and the causal position",
      of("clump").some((l) => l.includes("lead SNP")) && of("clump").some((l) => l.includes("arc"))
      && of("clump").some((l) => l.includes("P = 0.05"))
      && of("clump").some((l) => l.includes("causal")), `${of("clump").length} entries`);
    check("step 3's names the genotype, the weight and the sum",
      of("score").some((l) => l.includes("genotype")) && of("score").some((l) => l.includes("weight"))
      && of("score").some((l) => l.includes("sum")));
    check("step 4's names both samples and neither says holdout",
      of("threshold").some((l) => l.includes("target sample"))
      && of("threshold").some((l) => l.includes("validation sample"))
      && !of("threshold").some((l) => /holdout/i.test(l)), of("threshold").join(" · "));
    check("step 5's names the reference line the canvas leaves unlabelled",
      of("quantile").includes(M.STRINGS.meanLine), of("quantile").join(" · "));
    check("step 6's names the diagonal, the threshold and the crossing",
      of("risk").some((l) => /Predicted equals observed/.test(l))
      && of("risk").some((l) => /risk threshold/i.test(l))
      && of("risk").some((l) => /crosses it/.test(l)), of("risk").join(" · "));
  }
}

/* --- 10 · the geometry ----------------------------------------------------- */
{
  const W = await widget();
  const WIDTHS = [550, 620, 690, 776, 900];
  let inside = true;
  let apart = true;
  let headed = true;
  const notes = [];
  for (const w of WIDTHS) {
    /* EVERY STEP CARRIES THE STEP LINE, and it has to be clear of the first
       caption on it: the line's own baseline is `HEAD_Y` with the text below
       it, and a caption sits 8px above its rect on an alphabetic baseline. */
    for (const page of PAGES) {
      const L = M.layout(w, { page });
      if (!L.head || L.head.w < 220 || L.head.x < 0) headed = false;
      if (L.head.y + 12 > M.STEP_LINE_H + 20) headed = false;
      if (L.height <= M.STEP_LINE_H) inside = false;
    }

    const L1 = M.layout(w, { page: "haplotypes" });
    if (L1.block.y + L1.block.h + 40 > L1.tri.y) apart = false;
    if (L1.tri.y + L1.tri.h > L1.height) inside = false;
    if (L1.block.x + L1.block.w > w - M.AX_R + 0.5) inside = false;

    const L2 = M.layout(w, { page: "clump" });
    if (L2.assoc.y + L2.assoc.h + 35 > L2.height) inside = false;
    if (L2.assoc.x + L2.assoc.w > w - M.AX_R + 0.5) inside = false;

    const L3 = M.layout(w, { page: "score" });
    const stack = [L3.geno, L3.weights, L3.sum, L3.dist];
    for (let i = 1; i < stack.length; i += 1) {
      /* a caption sits 18px above its rect and an axis label 35px below one */
      if (stack[i - 1].y + stack[i - 1].h + 18 > stack[i].y) apart = false;
    }
    if (L3.dist.y + L3.dist.h + 35 > L3.height + 0.5) inside = false;
    if (L3.geno.x + L3.geno.w > w - M.AX_R + 0.5) inside = false;

    const L4 = M.layout(w, { page: "threshold" });
    /* the reading line sits below the axis label and must be inside the stage */
    if (L4.curve.y + L4.curve.h + M.READ_LINE_DY + 13 > L4.height) inside = false;
    /* the right margin is the SNPs-kept tick column and its rotated label */
    if (L4.curve.x + L4.curve.w + 54 > w + 0.5) inside = false;

    const L5 = M.layout(w, { page: "quantile" });
    if (L5.bins.y + L5.bins.h + 35 > L5.height) inside = false;
    if (L5.bins.x + L5.bins.w > w - M.Q_R + 0.5) inside = false;

    const L6 = M.layout(w, { page: "risk" });
    if (L6.cal.w !== L6.cal.h || L6.strat.w !== L6.strat.h) inside = false;
    if (L6.cal.x + L6.cal.w >= L6.strat.x) apart = false;
    if (L6.strat.x + L6.strat.w > w - 8 + 0.5) inside = false;
    if (L6.strat.y + L6.strat.h + 35 > L6.height) inside = false;
    notes.push(`${w}: ${L1.height}`);
  }
  check("every panel sits inside its own stage, at every width", inside, notes.join(" · "));
  check("no two stacked or side-by-side panels overlap", apart);
  check("every step's stage carries a step line with room for it", headed,
    `${M.STEP_LINE_H}px`);
  check("the round-three mock's own geometry comes back at the narrowest canvas",
    M.layout(550, { page: "haplotypes" }).tri.h === 243
    && M.layout(550, { page: "haplotypes" }).height === 550,
    `triangle ${M.layout(550, { page: "haplotypes" }).tri.h}px of `
    + `${M.layout(550, { page: "haplotypes" }).height}`);
  check("the six stages are 550, 321, 445, 358, 321 and 317px at 550",
    PAGES.map((page) => M.layout(550, { page }).height).join(" ")
    === "550 321 445 358 321 317",
    PAGES.map((page) => M.layout(550, { page }).height).join(" "));
  check("step 1's stage grows with the width, because its triangle is a fixed 100 SNPs deep",
    M.layout(900, { page: "haplotypes" }).height > M.layout(550, { page: "haplotypes" }).height,
    `${M.layout(550, { page: "haplotypes" }).height} → `
    + `${M.layout(900, { page: "haplotypes" }).height}`);
  check("…and the other five do not, so only one stage moves under the reader",
    PAGES.slice(1).every((page) =>
      M.layout(900, { page }).height === M.layout(550, { page }).height));
  check("the clumping window's rule sits 50 SNPs deep, half a pitch a SNP",
    M.CLUMP_DEPTH === M.CLUMP_KB / M.REGION.blockLen && M.CLUMP_DEPTH === 50
    && Math.abs(M.cellCentre(M.layout(690, { page: "haplotypes" }).tri, 50, 0).y
      - (M.layout(690, { page: "haplotypes" }).tri.y + 25 * (630 / 100))) < 1e-9,
    `${M.CLUMP_DEPTH} SNPs`);
  check("step 6's two plots are square, so the diagonal is a diagonal",
    [550, 690, 900].every((w) => {
      const L = M.layout(w, { page: "risk" });
      return L.cal.w === L.cal.h && L.strat.w === L.strat.h && L.cal.w === L.strat.w;
    }), `${M.layout(550, { page: "risk" }).cal.w}px a side`);
  check("the widget's height is the layout's own",
    PAGES.every((page) => W.height({ ...base({ page }), w: 690 })
      === M.layout(690, { page }).height));
  check("the widget asks layout() for every rect and builds none of its own",
    /M\.layout\(/.test(src) && !/const rect = \{ x: \d/.test(src));
  check("the height is a function of the parameters and the width",
    /height: \(\{ w, \.\.\.values \}\) => M\.stageHeight\(w, values\)/.test(src));
}

/* --- 11 · the register (5.9), the URL, and the status ---------------------- */
{
  const W = await widget();
  const fieldLines = [
    M.STRINGS.pageDetail, M.STRINGS.recombDetail, M.STRINGS.clumpR2Detail, M.STRINGS.typedDetail,
    M.STRINGS.baseSizeDetail, M.STRINGS.causalDetail, M.STRINGS.h2Detail, M.STRINGS.targetDetail,
    M.STRINGS.thresholdDetail, M.STRINGS.personDetail, M.STRINGS.seedDetail,
    M.RISK_STRINGS.prevalenceDetail, M.RISK_STRINGS.riskThreshDetail,
  ];
  const optionLines = [...M.PAGES, ...M.RECOMB, ...M.CLUMP_R2, ...M.TYPED, ...M.BASE_SIZES,
    ...M.CAUSAL, ...M.H2, ...M.TARGETS, ...M.THRESHOLD_OPTIONS, ...M.PREVALENCES,
    ...M.RISK_THRESHOLDS].map((o) => o.detail).filter(Boolean);
  /* Kenneth, 2026-09-11 (widget 55): a line under a control that says what will
     happen is the widget announcing its own answer before the first press. A
     detail says what the control IS. */
  const outcome = /\b(reach|reaches|fail|fails|pass|passes|end at|ends at|shows?|finds?|sees?|becomes?|leaves?|removes?|corrects?|improves?|worsens?)\b/i;
  const offenders = [...fieldLines, ...optionLines].filter((s) => outcome.test(s));
  check("no control line announces an outcome", offenders.length === 0, offenders.join(" | "));
  check("every field carries a line saying what it is (3.4f)",
    fieldLines.every((s) => typeof s === "string" && s.length > 10));
  /* Kenneth's pick 7: the two details that wrapped to a second line at 300px
     are trimmed. Measured at about 50 characters a line in the rail. */
  check("the trimmed details fit one line in the 300px rail",
    M.STRINGS.baseSizeDetail.length <= 50 && M.STRINGS.h2Detail.length <= 50,
    `${M.STRINGS.baseSizeDetail.length} · ${M.STRINGS.h2Detail.length} chars`);

  /* every reader-facing string, swept for the register */
  const state = W.compute({ params: base(), rng: makeRng(41) });
  const zero = Object.fromEntries(PAGES.map((p) => [p, 0]));
  const full = Object.fromEntries(PAGES.map((p) =>
    [p, M.totalFor(p, state, base({ page: p }))]));
  const half = Object.fromEntries(Object.entries(full).map(([p, n]) => [p, Math.floor(n / 2)]));
  const surfacesOf = (pages) => pages.flatMap((page) => [
    { k: full, scanDone: true, done: true },
    { k: zero, scanDone: false, done: false },
    { k: half, scanDone: true, done: false },
  ].flatMap((anim) => [
    ...W.readout({ params: base({ page }), state, anim })
      .flatMap((t) => [t.label, t.note].filter(Boolean)),
    W.summary({ params: base({ page }), state, anim }),
    ...W.legend({ params: base({ page }) }).map((e) => e.label),
  ]));

  const reader = [
    ...Object.values(M.STRINGS),
    ...Object.values(M.RISK_STRINGS),
    ...Object.values(M.HANDOFFS),
    ...PAGES.map((p) => M.stepLine(p)),
    ...[...M.PAGES, ...M.RECOMB, ...M.CLUMP_R2, ...M.TYPED, ...M.BASE_SIZES, ...M.CAUSAL,
      ...M.H2, ...M.TARGETS, ...M.THRESHOLD_OPTIONS, ...M.PREVALENCES, ...M.RISK_THRESHOLDS]
      .flatMap((o) => [o.label, o.detail, o.sample].filter(Boolean)),
    /* BOTH ENDS OF EVERY STEP. The sweep once ran only on the finished figure,
       and the sentence that describes the EMPTY one — the summary a reader
       meets first — went through it unread. */
    ...surfacesOf(PAGES),
    ...Object.values(M.STEP_LABELS.labels), ...Object.values(M.STEP_TITLES.labels),
    ...Object.values(M.RUN_TITLES.labels),
    /* DECISION 15's reading lines are built from live numbers, so they are
       functions rather than entries in STRINGS and the sweep has to call them
       — at the default's own region, over the drawn rows and over none. */
    M.pairReading(14, 9, M.pairStats(state.region, 14, 9, M.HAP_ROWS)),
    M.pairReading(14, 9, M.pairStats(state.region, 14, 9, 0)),
    M.snpReading(state.region, 9, M.snpStats(state.region, 9)),
    M.snpReading(state.region, state.region.causal, M.snpStats(state.region, state.region.causal)),
    M.snpReading(state.region, 0, { n: 0, reach: 0, pos: 0, r2Causal: 0 }),
    W.summary({ params: base({ page: "haplotypes", snps: "10,15" }), state,
      anim: { k: { ...zero, haplotypes: full.haplotypes }, scanDone: true, done: true } }),
    card.blurb,
  ];

  /* KENNETH'S TWO NOMENCLATURE RULINGS, 2026-09-12. "tune" is machine
     learning's word for this and the field's are best-fit, target sample and
     out of sample; "holdout" is the name of the colour token and of nothing a
     reader sees. */
  const tuned = reader.filter((s) => /\btun(e|es|ed|ing)\b/i.test(s));
  check("no reader-facing string says tune, tuned or tuning", tuned.length === 0,
    tuned.join(" | "));
  const holdout = reader.filter((s) => /holdout/i.test(s));
  check("no reader-facing string says holdout", holdout.length === 0, holdout.join(" | "));
  check("…and the words that replace them are on the page",
    reader.some((s) => /best-fit/.test(s)) && reader.some((s) => /validation sample/.test(s))
    && reader.some((s) => /target sample/.test(s)) && reader.some((s) => /out of sample/.test(s)));
  check("the overfitting readout is named, in PRSice's own word",
    reader.some((s) => /^Overfitting$/.test(s)));

  check("no reader-facing string says \"never\"", !reader.some((s) => /\bnever\b/i.test(s)),
    reader.filter((s) => /\bnever\b/i.test(s)).join(" | "));
  check("no reader-facing string names a lesson, notebook, cell or course",
    !reader.some((s) => /\b(notebook|lesson|cell \d|chapter|PHM\d)\b/i.test(s)),
    reader.filter((s) => /\b(notebook|lesson|cell \d|chapter|PHM\d)\b/i.test(s)).join(" | "));
  /* the collection's own vocabulary is ours and not the textbook's — Kenneth,
     2026-09-11: "what is card, rung?" */
  const ours = /\b(cards?|rungs?|ladders?|rails?|stages?|faces?|arms?|piles?|ramps?|budgets?|arrivals?|walks?|wells?|plains?|trenches?|frames?|skylines?|forests?|strips?|beats?)\b/i;
  const coined = reader.filter((s) => ours.test(s));
  check("no reader-facing string uses the collection's own vocabulary",
    coined.length === 0, coined.join(" | "));
  /* ROUND TWO adds two of its own. An animation that ARRIVES is the builder's
     word for it — the reader is told what was added or chosen. */
  const arrival = /\b(landed|lands|taken|arrives?|arrived)\b/i;
  const arrivals = reader.filter((s) => arrival.test(s));
  check("no reader-facing string says landed, taken or arrives", arrivals.length === 0,
    arrivals.join(" | "));

  check("the subtitle is the one Kenneth picked, verbatim",
    M.STRINGS.subtitle === "A polygenic score is the sum of effect alleles weighted by "
      + "base-GWAS effect sizes. Its accuracy is assessed out of sample and depends on the "
      + "target sample sharing the base study's ancestry.",
    `${M.STRINGS.subtitle.length} chars`);
  check("the gallery blurb fits the card's 120", M.STRINGS.blurb.length <= 120,
    `${M.STRINGS.blurb.length} chars`);
  check("the blurb in the manifest is the model's own", card.blurb === M.STRINGS.blurb);
  check("the meta description is the blurb, verbatim",
    read("widgets/polygenic-score/index.html").includes(`content="${M.STRINGS.blurb}"`));

  /* THE SCORE IS NOT A RISK, AND THE SPLIT IS THE ASSERTION. Round one forbade
     "risk" and "probability" on every surface, which round two cannot keep:
     step 6 exists to say that a percentile becomes a risk only after a model
     is fitted and checked. So the ban holds on steps 1 to 5 and on every
     shared string, and step 6's own copy lives in `RISK_STRINGS`. */
  const notRisk = [
    ...Object.values(M.STRINGS),
    ...surfacesOf(PAGES.filter((p) => p !== "risk")),
    ...M.TARGETS.flatMap((t) => [t.label, t.sample]),
    card.blurb,
  ];
  const risky = notRisk.filter((s) => /\b(risk|probability|chance of)\b/i.test(s));
  check("no string on steps 1 to 5 calls the score a risk or a probability",
    risky.length === 0, risky.join(" | "));
  check("…and step 6 says it in the field's own terms",
    /absolute risk/.test(M.RISK_STRINGS.riskThreshDetail)
    && /predicted risk/.test(M.RISK_STRINGS.calCaption));

  check("the step label names each step's own noun (3.4c)",
    Object.values(M.STEP_LABELS.labels).join(" ")
    === "Next haplotype Next clump Next SNP Next threshold Next vigintile Next decile",
    Object.values(M.STEP_LABELS.labels).join(" · "));
  check("…and every one of them is declared against the step, so core can reserve the widest",
    M.STEP_LABELS.param === "page" && M.STEP_TITLES.param === "page"
    && M.RUN_TITLES.param === "page");
  check("every step has a label, a title, a run title and a hand-off",
    PAGES.every((p) => M.STEP_LABELS.labels[p] && M.STEP_TITLES.labels[p]
      && M.RUN_TITLES.labels[p] && M.HANDOFFS[p]));
  check("the step line counts this step of six, and names it",
    M.stepLine("clump") === "step 2 of 6 · Clump the SNPs"
    && M.stepLine("risk") === "step 6 of 6 · Calibrate the risk", M.stepLine("haplotypes"));
  check("every hand-off but the first names the step before it",
    PAGES.slice(1).every((p, i) => M.HANDOFFS[p].startsWith(`from step ${i + 1}:`))
    && !/^from step/.test(M.HANDOFFS.haplotypes),
    M.HANDOFFS.risk);
  check("the decile note's 32 people is the sample over the deciles",
    M.RISK_STRINGS.calNote.includes(String(Math.round(M.N_TARGET / M.RISK_DECILES))),
    M.RISK_STRINGS.calNote);

  /* THE URL IS READER-FACING COPY (5.9): every value is a word its own control
     shows, or the number on its tick.

     THE HELPER STRIPS A THOUSANDS SEPARATOR RATHER THAN SPLITTING ON IT. Round
     one replaced "," with a space, which reads "15,000" as the two words "15"
     and "000" and would force the Base study size control onto a URL value of
     "15" — punctuation inside one number is not a word boundary. A trailing
     "%" goes the same way, so `30%` gives `30`. */
  const shown = (o) => o.label.toLowerCase().replace(/[,%]/g, "").replace(/\+/g, " ")
    .split(/[^a-z0-9.]+/);
  const wrong = [...M.RECOMB, ...M.TYPED, ...M.TARGETS, ...M.BASE_SIZES, ...M.PREVALENCES,
    ...M.RISK_THRESHOLDS].filter((o) => !shown(o).includes(o.value));
  check("every option's URL value is a word its control shows", wrong.length === 0,
    wrong.map((o) => `${o.value} / ${o.label}`).join(" | "));
  /* THE SIX STEP VALUES, and the one exception, which is documented in
     model.js beside the list: five are a word on the control's own face and
     `quantile` is the step's own displayed name from round one, kept so the
     draft's links still resolve. `page=ld` is the value round two breaks. */
  const wrongStep = M.PAGES.filter((o) => o.value !== "quantile" && !shown(o).includes(o.value));
  check("every step's URL value but one is a word its own label shows",
    wrongStep.length === 0, wrongStep.map((o) => `${o.value} / ${o.label}`).join(" | "));
  check("…and the exception is the name round one gave that step",
    M.PAGES[4].value === "quantile" && M.PAGES[4].label === "5 · Check the score");
  check("every number's URL value is the number on its tick",
    [...M.CLUMP_R2, ...M.CAUSAL, ...M.H2, ...M.THRESHOLD_OPTIONS].every((o) => o.value === o.label));

  {
    const spec = Object.fromEntries(Object.entries(W.params)
      .filter(([, f]) => f.type !== "section"));
    check("a bare page is the default state", toQuery(spec, base()) === "", toQuery(spec, base()));
    const qs = toQuery(spec, base({ page: "risk", target: "distant", baseSize: "150000" }));
    check("an authored figure is a short link",
      qs === "page=risk&baseSize=150000&target=distant", qs);
    const back = resolveParams(spec, new URLSearchParams(qs));
    check("and it reads back", back.page === "risk" && back.target === "distant"
      && back.baseSize === "150000" && back.causal === "300");
    check("an unknown value falls back to the default",
      resolveParams(spec, new URLSearchParams("target=european").valueOf()).target === "same");
    /* ROUND TWO BREAKS ONE LINK, and it is the step that became two. */
    check("a link to the old LD page lands on the first of the two steps it became",
      resolveParams(spec, new URLSearchParams("page=ld")).page === "haplotypes");
    check("…and the three step values round one shipped still resolve",
      ["score", "threshold", "quantile"].every((v) =>
        resolveParams(spec, new URLSearchParams(`page=${v}`)).page === v));
  }

  /* the data / display split, read off the spec the widget declares */
  {
    const data = ["recomb", "clumpR2", "causalTyped", "baseSize", "causal", "h2", "target",
      "prevalence", "seed"];
    const display = ["page", "threshold", "person", "riskThreshold"];
    check("every data parameter is declared as one, so a change starts the run over",
      data.every((k) => W.params[k] && !W.params[k].display), data.join(" "));
    check("every display parameter is declared as one, so a change keeps the work",
      display.every((k) => W.params[k]?.display === true), display.join(" "));
    check("prevalence is data because it decides who has the disease",
      W.params.prevalence.display !== true
      && M.configFor(base({ prevalence: "5" })).prevalence === 0.05);
    check("the risk threshold is display because it moves a line over drawn risks",
      W.params.riskThreshold.display === true
      && !/prevalence/.test(String(M.riskThresholdOf)));
  }

  /* THIS ASSERTION FLIPS AT SHIP, in the same commit as the manifest and the
     widget: a draft recorded as shipped is what puts unfinished teaching
     material on the front page. */
  check("the widget is declared draft in both files",
    /^\s*status: "draft",$/m.test(src) && card.status === "draft", card.status);
  check("the card carries the slot's course and arc",
    card.course === "PHM5003" && card.arc === 59, `${card.course} ${card.arc}`);
  check("the title agrees across the three files",
    /^\s*title: "Polygenic Risk Scores",$/m.test(src) && card.title === "Polygenic Risk Scores"
    && read("widgets/polygenic-score/index.html").includes("<title>Polygenic Risk Scores ·"));
}

/* --- 12 · what the figure actually paints ----------------------------------
 * The canvas text sweep, run in node: `draw` is handed a context that records
 * every string and every coordinate, and the REAL `makePlot` does the
 * arithmetic. It catches what no assertion above can — a NaN at one end of a
 * control, a caption that ran off its panel, a mark drawn nowhere — and it is
 * the only check here that sees the picture at all.
 */
{
  const W = await widget();
  const COLORS = Object.fromEntries([
    "surface", "surface2", "surface3", "ink1", "ink2", "ink3", "grid", "axis", "empirical",
    "theory", "highlight", "reference", "extreme", "groupA", "groupB", "holdout",
    "valueLow", "valueHigh",
  ].map((k) => [k, `--${k}`]));
  COLORS.font = "system-ui";
  COLORS.fsXs = "11px";
  COLORS.fsSm = "12px";

  function recorder() {
    const painted = [];
    const placed = [];
    const marks = [];
    const noop = () => {};
    const ctx = {
      save: noop, restore: noop, beginPath: noop, closePath: noop, clip: noop,
      moveTo: (x, y) => marks.push([x, y]),
      lineTo: (x, y) => marks.push([x, y]),
      arc: (x, y) => marks.push([x, y]),
      arcTo: (x, y) => marks.push([x, y]),
      quadraticCurveTo: (cx, cy, x, y) => marks.push([cx, cy, x, y]),
      rect: (x, y) => marks.push([x, y]),
      fillRect: (x, y, w, h) => marks.push([x, y, w, h]),
      strokeRect: (x, y, w, h) => marks.push([x, y, w, h]),
      drawImage: noop, putImageData: noop, transform: noop,
      stroke: noop, fill: noop, setLineDash: noop, translate: noop, rotate: noop,
      /* a width per character, so every caption's own collision guard is
         exercised rather than short-circuited by a zero */
      measureText: (s) => ({ width: String(s).length * 6 }),
      fillText: (s, x, y) => {
        painted.push(String(s));
        placed.push({ s: String(s), x, y, w: String(s).length * 6, align: ctx.textAlign });
        marks.push([x, y]);
      },
      strokeText: (s, x, y) => { marks.push([x, y]); },
      textAlign: "left",
    };
    return { ctx, painted, placed, marks };
  }

  const zero = Object.fromEntries(PAGES.map((p) => [p, 0]));
  const animAt = (page, k, scanDone = k > 0, beat = 0) => ({
    k: { ...zero, [page]: k }, beat, scanDone, done: false,
  });
  const paintedAt = (params, anim, w = 690) => {
    const r = recorder();
    W.draw({
      ctx: r.ctx, colors: COLORS, w, h: W.height({ ...params, w }),
      params, state: build(params), anim,
    });
    return r;
  };

  let painted = 0;
  const badText = [];
  const badMark = [];
  let threw = null;
  for (const page of PAGES) {
    for (const over of [{}, { causalTyped: "untyped", clumpR2: "0.5", recomb: "high" },
      { target: "distant", causal: "600", h2: "0.5" }, { threshold: "5e-8", baseSize: "1500" },
      { threshold: "1", person: 319, prevalence: "5", riskThreshold: "40" }]) {
      const params = base({ page, ...over });
      const total = M.totalFor(page, build(params), params);
      for (const k of [0, 1, Math.max(1, Math.floor(total / 2)), total]) {
        for (const w of [550, 776]) {
          let r = null;
          try {
            r = paintedAt(params, animAt(page, k, k > 0, 0.4), w);
          } catch (e) {
            threw ??= `${page}/${JSON.stringify(over)}/k=${k}/w=${w}: ${e.message}`;
            continue;
          }
          painted += r.painted.length;
          for (const s of r.painted) {
            if (/NaN|undefined|Infinity/.test(s)) badText.push(`${page} k=${k}: ${s}`);
          }
          for (const m of r.marks) {
            if (m.some((v) => !Number.isFinite(v))) badMark.push(`${page} k=${k}: [${m.join(", ")}]`);
          }
        }
      }
    }
  }
  check("the figure draws at every setting without throwing", threw === null, threw ?? "");
  check(`no string the figure paints carries a NaN (${painted} strings)`,
    badText.length === 0, badText.slice(0, 3).join(" | "));
  check("every mark lands at a finite coordinate", badMark.length === 0,
    badMark.slice(0, 3).join(" | "));

  /* every step prints its own step line and hand-off (decision 8) */
  {
    const missing = [];
    for (const page of PAGES) {
      const p = paintedAt(base({ page }), animAt(page, 0, false)).painted;
      if (!p.includes(M.stepLine(page)) || !p.includes(M.HANDOFFS[page])) missing.push(page);
    }
    check("every step prints its step line and its hand-off, on the empty figure too",
      missing.length === 0, missing.join(" "));
  }

  /* step 1: the empty block, the pool filling, the triangle arriving last */
  {
    const params = base({ page: "haplotypes" });
    const empty = paintedAt(params, animAt("haplotypes", 0, false)).painted;
    check("step 1 opens on its own frame and the triangle's caption, with no haplotype drawn",
      empty.includes(M.STRINGS.blockCaption) && empty.includes(M.STRINGS.triCaption)
      && empty.some((s) => /^0 of 40 drawn/.test(s)),
      empty.find((s) => /drawn/.test(s)) ?? "");
    const mid = paintedAt(params, animAt("haplotypes", 12)).painted;
    check("…and the count follows the pool as it fills (2.8)",
      mid.some((s) => s === `12 of 40 drawn, from a pool of 1,000`),
      mid.find((s) => /drawn/.test(s)) ?? "");
    check("…the allele note and the region's own size sit under the block",
      mid.some((s) => s === `${M.STRINGS.blockNote} · 100 SNPs over 495 kb`),
      mid.find((s) => s.includes("SNPs over")) ?? "");
  }

  /* DECISION 13: the triangle's cells arrive with the last haplotype, and its
     caption is there from the start. No string can say whether the CELLS are
     drawn, so this is counted off the transform the image goes through — the
     buffer is skipped entirely with no DOM, so the assertion is on the
     geometry the drawing decides. Round three: the WHOLE half-matrix, at the
     block's own pitch, and the clumping window's reach drawn across it. */
  {
    const L = M.layout(690, { page: "haplotypes" });
    check("the triangle hangs from its own rule at the bottom of the block's gap",
      L.tri.y > L.block.y + L.block.h, `block ends ${L.block.y + L.block.h}, triangle at ${L.tri.y}`);
    check("…and is the whole half-matrix deep, at half the block's column pitch",
      L.tri.h === Math.ceil(((M.REGION.m - 1) / 2) * (L.block.w / M.REGION.m))
      && Math.abs(M.snpCentreX(L.tri, 99) - M.snpCentreX(L.block, 99)) < 1e-9,
      `${L.tri.h}px at 690, SNP 100 at ${M.snpCentreX(L.tri, 99).toFixed(2)} in both`);
    const h550 = M.stageHeight(550, { page: "haplotypes" });
    check("…so the stage is 550px at the 550 stage and 619 at 690",
      h550 === 550 && M.stageHeight(690, { page: "haplotypes" }) === 619,
      `${h550} / ${M.stageHeight(690, { page: "haplotypes" })}`);
    for (const w of [550, 690]) {
      const done = paintedAt(base({ page: "haplotypes" }), animAt("haplotypes", M.HAP_ROWS), w).painted;
      check(`the window's reach is labelled whole at ${w}, and the caption says every pair`,
        done.includes(M.STRINGS.windowLabel) && done.includes(M.STRINGS.triCaption)
        && M.STRINGS.triCaption === "linkage disequilibrium (r²) between every pair of SNPs",
        done.find((t) => /clumping window/.test(t)) ?? "");
    }
    const empty = paintedAt(base({ page: "haplotypes" }), animAt("haplotypes", 0, false)).painted;
    check("…and the label is on the empty figure too, since the rule is the axis's",
      empty.includes(M.STRINGS.windowLabel));
  }

  /* --- 12b · DECISION 15: the block ↔ triangle link ----------------------------
   * The cell under a point, the column under a point, the region table a click
   * resolves through, the pin's parser, the pair's statistics and the reading
   * lines — none of which a pixel hash can see, and all of which the figure
   * lies about if they drift from the drawing by a column.
   */
  {
    const params = base({ page: "haplotypes" });
    const L = M.layout(690, params);
    const m = M.REGION.m;
    const state = build(params);
    const region = state.region;

    /* every cell round-trips from its own centre, and from four points inside
       its diamond; the axis above and the diagonal are nobody's */
    let bad = 0;
    let badInner = 0;
    let misaligned = 0;
    const cw = M.snpPitch(L.tri);
    for (let j = 1; j < m; j += 1) {
      for (let k = 0; k < j; k += 1) {
        const c = M.cellCentre(L.tri, j, k);
        const hit = M.triCellAt(L.tri, c.x, c.y);
        if (!hit || hit[0] !== k || hit[1] !== j) bad += 1;
        for (const [dx, dy] of [[0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]]) {
          const h = M.triCellAt(L.tri, c.x + dx * cw / 2, c.y + dy * cw / 2);
          if (!h || h[0] !== k || h[1] !== j) badInner += 1;
        }
        const mid = (M.snpCentreX(L.block, j) + M.snpCentreX(L.block, k)) / 2;
        if (Math.abs(c.x - mid) > 1e-9) misaligned += 1;
      }
    }
    check("every triangle cell is found from its own centre by inverting the rotated frame",
      bad === 0, `${bad} of ${(m * (m - 1)) / 2} miss`);
    check("…and from four points inside its diamond", badInner === 0, `${badInner} miss`);
    check("…and sits above the midpoint of its two block columns", misaligned === 0,
      `${misaligned} off`);
    check("above the axis, and on the diagonal, there is no cell",
      M.triCellAt(L.tri, L.tri.x + 100, L.tri.y - 1) === null
      && M.triCellAt(L.tri, M.snpCentreX(L.tri, 40), L.tri.y + 0.1) === null
      && M.triCellAt(L.tri, L.tri.x - 5, L.tri.y + 30) === null);
    let badCol = 0;
    for (let j = 0; j < m; j += 1) {
      if (M.blockColumnAt(L.block, M.snpCentreX(L.block, j), L.block.y + 1) !== j) badCol += 1;
    }
    check("every block column is found from its centre", badCol === 0, `${badCol} miss`);
    check("…and outside the block there is no column",
      M.blockColumnAt(L.block, L.block.x + 10, L.block.y - 1) === -1
      && M.blockColumnAt(L.block, L.block.x + L.block.w + 1, L.block.y + 10) === -1);
    check("a point names one SNP in the block and a pair in the triangle",
      M.subjectAt(L, M.snpCentreX(L.block, 9), L.block.y + 5)?.kind === "snp"
      && M.subjectAt(L, M.snpCentreX(L.block, 9), L.block.y + 5)?.snps[0] === 9
      && M.subjectAt(L, M.cellCentre(L.tri, 14, 9).x, M.cellCentre(L.tri, 14, 9).y)?.kind === "pair"
      && M.subjectAt(L, L.tri.x, L.tri.y - 3) === null);

    /* THE REGION TABLE, through core's own hit-test */
    const regions = W.regions({ w: 690, params, state });
    check("the region table is the block's columns and the triangle's cells",
      regions.length === m + (m * (m - 1)) / 2
      && regions.every((r) => Object.keys(r.set).length === 1 && "snps" in r.set),
      `${regions.length} regions`);
    let badHit = 0;
    for (let j = 1; j < m; j += 1) {
      for (let k = 0; k < j; k += 1) {
        const c = M.cellCentre(L.tri, j, k);
        const r = hitTest(regions, c.x, c.y);
        if (!r || r.set.snps !== `${k + 1},${j + 1}`) badHit += 1;
      }
    }
    check("…and a click at every cell's centre pins that pair, and nothing else",
      badHit === 0, `${badHit} miss`);
    let badColHit = 0;
    for (let j = 0; j < m; j += 1) {
      const r = hitTest(regions, M.snpCentreX(L.block, j), L.block.y + L.block.h / 2);
      if (!r || r.set.snps !== `${j + 1}`) badColHit += 1;
    }
    check("…and a click on every column pins that SNP", badColHit === 0, `${badColHit} miss`);
    const pinned = W.regions({ w: 690, params: base({ page: "haplotypes", snps: "10,15" }), state });
    const c = M.cellCentre(L.tri, 14, 9);
    check("clicking the pinned pair clears the pin, and any other click moves it",
      hitTest(pinned, c.x, c.y).set.snps === ""
      && hitTest(pinned, M.snpCentreX(L.block, 9), L.block.y + 3).set.snps === "10",
      hitTest(pinned, c.x, c.y).set.snps);
    check("the table is empty on every other step, and on core's load-time probe",
      PAGES.filter((pg) => pg !== "haplotypes")
        .every((pg) => W.regions({ w: 690, params: base({ page: pg }), state }).length === 0)
      && W.regions({ w: 690, params, state: null }).length === 0);
    check("the widget draws for the pointer and declares the pin as a hidden display text",
      W.pointer === true && W.params.snps.type === "text" && W.params.snps.hidden === true
      && W.params.snps.display === true && W.params.snps.default === ""
      && W.params.snps.parse === M.parseSnps);

    /* THE PIN'S PARSER: what a URL can carry */
    check("the pin parses to its canonical form",
      M.parseSnps("52,37") === "37,52" && M.parseSnps("37,37") === "37"
      && M.parseSnps("0") === "" && M.parseSnps("101") === "" && M.parseSnps("a,3") === "3"
      && M.parseSnps("1,2,3") === "1,2" && M.parseSnps("") === "" && M.parseSnps(undefined) === "",
      [M.parseSnps("52,37"), M.parseSnps("37,37"), M.parseSnps("1,2,3")].join(" / "));
    check("…and reads back zero-based, in the shape the pointer produces",
      M.snpsOf({ snps: "37,52" }).join() === "36,51" && M.snpsText([51, 36]) === "37,52"
      && M.pinnedSubject({ snps: "37,52" }).kind === "pair"
      && M.pinnedSubject({ snps: "37" }).kind === "snp" && M.pinnedSubject({ snps: "" }) === null);
    check("the URL round trip keeps a pin and drops an empty one",
      resolveParams(W.params, new URLSearchParams("snps=52%2C37")).snps === "37,52"
      && !toQuery(W.params, resolveParams(W.params, new URLSearchParams(""))).includes("snps"));

    /* THE PAIR'S STATISTICS, at the default's own region */
    const lead = region.idx[region.lead];
    const st = M.pairStats(region, region.causal, lead, M.HAP_ROWS);
    let flagged = 0;
    for (const f of st.flags) flagged += f;
    check("a pair's r² is the matrix's, and its rows are counted from its flags",
      st.r2 === region.R[region.causal][lead] && flagged === st.together && st.rows === M.HAP_ROWS
      && st.together <= M.HAP_ROWS && st.dist === Math.abs(region.causalPos - region.pos[region.lead]),
      `r² ${st.r2.toFixed(2)}, ${st.together} of ${st.rows}`);
    const far = M.pairStats(region, region.causal, Math.min(m - 1, region.causal + 50), M.HAP_ROWS);
    check("…and the causal-lead pair travels together in more rows than a pair 250 kb apart",
      st.together > far.together && st.r2 > far.r2,
      `${st.together} against ${far.together}; r² ${st.r2.toFixed(2)} against ${far.r2.toFixed(2)}`);
    check("the reading lines say it in the field's words, at the default",
      M.pairReading(region.causal, lead, st)
        === "SNP 10 and SNP 15 · 25 kb apart · r² 0.79 · the two alleles travel together in 38 of 40 rows"
      && M.snpReading(region, lead, M.snpStats(region, lead))
        === "SNP 10 at 45 kb · r² above 0.5 with 8 SNPs, the furthest 70 kb away",
      M.pairReading(region.causal, lead, st));
    check("…and drop the rows clause while no row is drawn",
      !/rows/.test(M.readingFor(region, { kind: "pair", snps: [lead, region.causal] }, 0))
      && /rows/.test(M.readingFor(region, { kind: "pair", snps: [lead, region.causal] }, 12))
      && M.readingFor(region, null, 12) === null);

    /* THE READING REPLACES THE FOOT LINE, and only while a subject is on screen */
    const foot = `${M.STRINGS.blockNote} · 100 SNPs over 495 kb`;
    const rest = paintedAt(params, animAt("haplotypes", M.HAP_ROWS)).painted;
    const withPin = paintedAt(base({ page: "haplotypes", snps: "10,15" }),
      animAt("haplotypes", M.HAP_ROWS)).painted;
    const withSnp = paintedAt(base({ page: "haplotypes", snps: "10" }),
      animAt("haplotypes", M.HAP_ROWS)).painted;
    check("at rest the block's foot line is drawn; pinned, the reading is drawn in its place",
      rest.includes(foot) && !rest.some((t) => /travel together/.test(t))
      && withPin.includes(M.pairReading(region.causal, lead, st)) && !withPin.includes(foot)
      && withSnp.includes(M.snpReading(region, lead, M.snpStats(region, lead))) && !withSnp.includes(foot),
      withPin.find((t) => /travel together/.test(t)) ?? "");
    check("…and the pin reaches the summary", /Pinned: SNP 10 and SNP 15/.test(
      W.summary({ params: base({ page: "haplotypes", snps: "10,15" }), state,
        anim: animAt("haplotypes", M.HAP_ROWS) })));
    check("the legend names the pointer's mark and the causal SNP's pairs",
      W.legend({ params }).some((e) => /under the pointer/.test(e.label) && e.token === "highlight")
      && W.legend({ params }).some((e) => /its pairs in the triangle/.test(e.label)));
  }

  /* step 2: the empty figure, the tests, the lead, the clumping */
  {
    const params = base({ page: "clump" });
    const empty = paintedAt(params, animAt("clump", 0, false)).painted;
    check("step 2 opens on its axes and the P = 0.05 line, with no test drawn",
      empty.includes(M.STRINGS.alphaLabel) && empty.includes(M.STRINGS.assocX)
      && empty.includes(M.STRINGS.assocY) && !empty.some((s) => /under P < 0\.05/.test(s)),
      empty.join(" · ").slice(0, 90));

    const tested = paintedAt(params, animAt("clump", 0, true)).painted;
    check("the first frame of Play counts the tests",
      tested.some((s) => s === "38 of 100 SNPs under P < 0.05")
      && tested.includes(M.STRINGS.assocCaption),
      tested.find((s) => s.includes("under P")) ?? "");
    /* beat 1 of 3: the lead is chosen and the panel says what its r² takes */
    const lead = paintedAt(params, animAt("clump", 1)).painted;
    check("…the first beat names the lowest P and how many SNPs it accounts for",
      lead.includes(M.STRINGS.assocCaptionLead)
      && lead.some((s) => s === "26 SNPs at r² ≥ 0.1"),
      lead.find((s) => /r² ≥/.test(s)) ?? "");
    const one = paintedAt(params, animAt("clump", M.CLUMP_BEATS)).painted;
    check("…and after its three beats the count is the clumps', in the widget's own grammar",
      one.includes(M.STRINGS.assocCaptionClumped)
      && one.some((s) => s === "1 clump under P < 0.05"),
      one.find((s) => s.includes("clump")) ?? "");
    const clumped = paintedAt(params, animAt("clump", 24)).painted;
    check("…and the finished figure counts every clump under the line",
      clumped.some((s) => s === "3 clumps under P < 0.05"),
      clumped.find((s) => s.includes("clumps")) ?? "");
  }

  /* DECISION 5: the causal SNP's mark arrives with the clump that accounts for
     it. No pixel hash can see this — the mark is three strokes — so it is
     counted off the recorded coordinates: two of its points sit on a row no
     data point can reach, 2px below the plot area's top edge. */
  {
    /* the one setting at this seed where the causal position is not inside the
       first clump: a strict r² with the causal variant off the array */
    const params = base({ page: "clump", recomb: "high", clumpR2: "0.5", causalTyped: "untyped" });
    const L = M.layout(690, params);
    const region = build(params).region;
    const marksAt = (c) => paintedAt(params, animAt("clump", c * M.CLUMP_BEATS)).marks
      .filter((m) => m.length === 2 && Math.abs(m[1] - (L.assoc.y + 2)) < 1e-9).length / 2;
    check("the causal SNP's position is not marked before the clumping reaches it (2.1)",
      region.causalAt > 1 && marksAt(region.causalAt - 1) === 0,
      `arrives on clump ${region.causalAt} of ${region.clumps.length}`);
    check("…and is marked once it does", marksAt(region.causalAt) === 1);
    check("…and stays for the rest of the run", marksAt(region.clumps.length) === 1);
  }

  /* step 3 — one column a SNP (model.js decision 14, round three). */
  {
    const params = base({ page: "score" });
    const state3 = build(params);
    const total = M.totalFor("score", state3, params);
    const st = M.personScore(state3, params);
    const kept = st.n;
    const empty = paintedAt(params, animAt("score", 0)).painted;
    check("step 3 opens with no SNP added and no person's line",
      empty.some((s) => s === `0 of ${M.intText(kept)} SNPs added`)
      && empty.filter((t) => t === "person 1").length === 1,
      empty.find((s) => s.includes("added")) ?? "");
    const mid = paintedAt(params, animAt("score", 12)).painted;
    check("…the sum counts what it has added (2.8)",
      mid.some((s) => s === `12 of ${M.intText(kept)} SNPs added`),
      mid.find((s) => s.includes("added")) ?? "");
    check("…and names the three strips and the sample underneath",
      mid.includes(M.STRINGS.genoCaption) && mid.includes(M.STRINGS.weightCaption)
      && mid.includes(M.STRINGS.sumCaption) && mid.includes(M.STRINGS.distCaption));
    const done = paintedAt(params, animAt("score", total)).painted;
    /* DECISION 7: the person's line lands with the last SNP, so "person 1" is
       painted twice at the end — once as the strip's note, once on the line. */
    check("the person's own line joins the distribution with the last SNP (decision 7)",
      done.filter((s) => s === "person 1").length === 2
      && paintedAt(params, animAt("score", total - 1)).painted
        .filter((s) => s === "person 1").length === 1,
      `${done.filter((s) => s === "person 1").length} at the end`);
    const other = paintedAt(base({ page: "score", person: 200 }), animAt("score", total)).painted;
    check("…and the Person slider draws somebody else's row",
      other.filter((s) => s === "person 200").length === 2);

    /* ONE COLUMN A SNP: the run is the kept count and the axis ends on it */
    check("the default keeps 160 SNPs and the run is a beat each",
      kept === 160 && total === kept, `${kept} SNPs, ${total} beats`);
    const at40 = paintedAt(params, animAt("score", 40)).painted;
    check("…and the caption counts SNPs on both sides of the fortieth",
      at40.some((s) => s === `40 of ${M.intText(kept)} SNPs added`)
      && done.some((s) => s === `${M.intText(kept)} of ${M.intText(kept)} SNPs added`),
      `${at40.find((s) => s.includes("added"))} → ${done.find((s) => s.includes("added"))}`);
    check("…the x axis's last tick is the kept count, and no line of the batch remains",
      done.includes("160") && done.includes("40")
      && !done.some((s) => /^the other |effect alleles$|to the score$|what the rest added/.test(s))
      && done.includes(M.STRINGS.weightCaption),
      done.filter((s) => /^\d+$/.test(s)).join(" "));
    const all = base({ page: "score", threshold: "1" });
    const sAll = build(all);
    const doneAll = paintedAt(all, animAt("score", M.totalFor("score", sAll, all))).painted;
    /* "1,000" centred on the panel's last pixel would run off the canvas, so
       the end tick is dropped there and the note carries the count */
    check("…and at every SNP in the base study the end tick is dropped and the note counts",
      !doneAll.includes("1,000") && doneAll.includes("750")
      && doneAll.some((s) => s === "1,000 of 1,000 SNPs added"),
      doneAll.filter((s) => /^[\d,]+$/.test(s)).join(" "));

    /* THE X LAYOUT, measured at both widths (3.4a's arithmetic, not taste). */
    const ax690 = M.scoreAxis(M.layout(690, { page: "score" }).geno.w, kept);
    const ax550 = M.scoreAxis(M.layout(550, { page: "score" }).geno.w, kept);
    check("a column is the panel over the kept count",
      Math.abs(ax690.cw - 3.9375) < 0.01 && Math.abs(ax550.cw - 3.0625) < 0.01
      && ax690.units === kept && ax690.cols === kept,
      `690: ${ax690.cw.toFixed(2)}px a column; 550: ${ax550.cw.toFixed(2)}px`);
    check("…which is under the dot minimum at 160, so the genotype strip draws bars there",
      ax550.cw < M.SCORE_DOT_MIN && ax690.cw < M.SCORE_DOT_MIN && M.SCORE_DOT_MIN === 4);
    const few = base({ page: "score", baseSize: "1500", threshold: "0.01" });
    const sFew = build(few);
    const keptFew = M.rowFor(sFew, few).nSnp;
    check("at 40 or fewer kept a column holds two dots, as in round one",
      keptFew <= 40 && M.totalFor("score", sFew, few) === keptFew
      && M.scoreAxis(M.layout(550, { page: "score" }).geno.w, keptFew).cw >= 2 * 2.5 + 2.4,
      `${keptFew} SNPs at ${M.scoreAxis(490, keptFew).cw.toFixed(1)}px`);
    const fewPainted = paintedAt(few, animAt("score", keptFew)).painted;
    check("…and its finished figure counts them all",
      fewPainted.includes(M.STRINGS.weightCaption)
      && fewPainted.some((s) => s === `${keptFew} of ${keptFew} SNPs added`),
      fewPainted.find((s) => s.includes("added")) ?? "");
    check("a threshold keeping nothing still draws the empty strips",
      paintedAt(base({ page: "score", baseSize: "1500", threshold: "5e-8" }), animAt("score", 0))
        .painted.some((s) => s === "0 of 0 SNPs added"));
  }

  /* step 4 */
  {
    const params = base({ page: "threshold" });
    const empty = paintedAt(params, animAt("threshold", 0)).painted;
    check("step 4 opens on both axes and its panel note, with no curve",
      empty.includes(M.STRINGS.curveX) && empty.includes(M.STRINGS.keptAxis)
      && !empty.some((s) => /largest in the target/.test(s)));
    const one = paintedAt(params, animAt("threshold", 1)).painted;
    check("…and marks no maximum among one threshold, and writes no reading line (decision 6)",
      !one.some((s) => /largest in the target/.test(s))
      && !one.some((s) => /^best-fit R²/.test(s)));
    const full = paintedAt(params, animAt("threshold", 11)).painted;
    check("the finished sweep names the largest R² in the target sample and where it is",
      full.some((s) => s === "largest in the target: 0.294 at 0.01"),
      full.find((s) => s.includes("largest")) ?? "");
    /* THE READING LINE, the mock's §4 — and it names the SAME numbers the mark
       does, so the sentence and the figure cannot disagree. */
    check("…and the reading line under the axis says it in words",
      full.some((s) => s === "best-fit R² 0.294 in the target at P < 0.01; "
        + "0.267 in the validation sample there"),
      full.find((s) => /^best-fit R²/.test(s)) ?? "");
    check("…and the kept count's axis runs from 0 to every SNP in the base study",
      full.includes("0") && full.includes("1,000"));
  }

  /* step 5 */
  {
    const params = base({ page: "quantile" });
    const empty = paintedAt(params, animAt("quantile", 0)).painted;
    check("step 5 opens on its axes and names the target population",
      empty.includes(M.STRINGS.quantCaption) && empty.includes(M.STRINGS.quantX)
      && empty.includes("Same ancestry as the base"));
    check("…and the mean line carries no label on the canvas",
      !empty.includes(M.STRINGS.meanLine));
    const far = paintedAt(base({ page: "quantile", target: "distant" }), animAt("quantile", 20))
      .painted;
    check("…and says which population it is drawn in, in the control's own words",
      far.includes("Distant ancestry"), far.find((s) => s.includes("ancestry")) ?? "");
  }

  /* step 6 */
  {
    const params = base({ page: "risk" });
    const empty = paintedAt(params, animAt("risk", 0)).painted;
    /* The diagonal carries no label since 2026-09-12 (it crossed the top
       decile's bar; the legend names it), so its absence is the assertion. */
    check("step 6 opens on two square plots, the risk threshold, and no label on the diagonal",
      empty.includes(M.RISK_STRINGS.calCaption) && empty.includes(M.RISK_STRINGS.stratCaption)
      && !empty.includes(M.RISK_STRINGS.diagonalLabel) && empty.includes("30% risk")
      && !empty.some((s) => /above$/.test(s)),
      empty.find((s) => /risk$/.test(s)) ?? "");
    const full = paintedAt(params, animAt("risk", M.RISK_DECILES)).painted;
    check("…and the finished panels name the decile size and the count over the line",
      full.includes(M.RISK_STRINGS.calNote) && full.some((s) => s === "62 of 319 above"),
      full.find((s) => /above$/.test(s)) ?? "");
    check("…and the population, in the control's own words",
      full.includes("same ancestry as the base"));
    const none = paintedAt(base({ page: "risk", threshold: "5e-8", baseSize: "1500" }),
      animAt("risk", M.RISK_DECILES)).painted;
    check("a threshold that keeps no SNP draws the axes and says so",
      none.includes(M.RISK_STRINGS.emptyNote) && none.includes(M.RISK_STRINGS.calX),
      none.find((s) => /no SNP/.test(s)) ?? "");
    const four = paintedAt(params, animAt("risk", 4)).painted;
    check("…and the crossing is not marked before the curve reaches it (2.11)",
      !four.some((s) => /of 319 above$/.test(s)));
  }

  /* THE CAPTION AND ITS NOTE NEVER PRINT THROUGH EACH OTHER. `plot.note` drops
     its line inside the plot area when the caption leaves it no room, and
     inside a panel's top right is where this figure's own marks sit — a note
     strokes the ground before it fills, so a collision ERASES what is under it
     and the line still looks correct. Measured at six pixels a character,
     which is the pessimistic reading of both strings. */
  {
    const overlaps = [];
    const pairs = [
      ["haplotypes", 40, (s) => s === M.STRINGS.blockCaption, (s) => /drawn, from a pool/.test(s)],
      ["clump", 24, (s) => s === M.STRINGS.assocCaptionClumped, (s) => /clumps? under P/.test(s)],
      ["clump", 1, (s) => s === M.STRINGS.assocCaptionLead, (s) => /SNPs at r² ≥/.test(s)],
      ["score", 12, (s) => s === M.STRINGS.sumCaption, (s) => /SNPs added$/.test(s)],
      ["score", 12, (s) => s.startsWith("the person's genotype"), (s) => /^person \d+$/.test(s)],
      ["score", 12, (s) => s.startsWith("the base study's weight"), (s) => s === M.STRINGS.weightNote],
      ["score", 12, (s) => s.startsWith("every person in the target"), (s) => /^\d+ people$/.test(s)],
      ["quantile", 20, (s) => s.startsWith("mean trait by score"), (s) => /ancestry/.test(s)],
    ];
    for (const w of [550, 620, 690]) {
      for (const [page, k, capOf, noteOf] of pairs) {
        const r = paintedAt(base({ page }), animAt(page, k), w);
        const cap = r.placed.find((t) => capOf(t.s));
        const note = r.placed.find((t) => noteOf(t.s));
        if (!cap || !note) {
          overlaps.push(`${w}/${page}: a line is missing`);
          continue;
        }
        if (Math.abs(cap.y - note.y) > 1) {
          overlaps.push(`${w}/${page}: "${note.s}" left the caption's row`);
          continue;
        }
        const left = note.align === "right" ? note.x - note.w : note.x;
        if (left < cap.x + cap.w + 8) {
          overlaps.push(`${w}/${page}: "${cap.s}" ends at ${Math.round(cap.x + cap.w)}, `
            + `the note starts at ${Math.round(left)}`);
        }
      }
    }
    check("every caption and its note share one row and never overlap on it",
      overlaps.length === 0, overlaps.slice(0, 2).join(" | "));
  }

  /* STEP 6'S TWO CAPTIONS TAKE A LINE WIDER THAN THEIR OWN PANEL, and their
     notes drop to a line above rather than into the panel, where the tallest
     interval stands. Both have to stay inside the stage and clear of each
     other, and neither may be truncated. */
  {
    const bad = [];
    for (const w of [550, 620, 690, 776]) {
      const L = M.layout(w, { page: "risk" });
      const r = paintedAt(base({ page: "risk" }), animAt("risk", M.RISK_DECILES), w);
      const cal = r.placed.find((t) => t.s === M.RISK_STRINGS.calCaption);
      const strat = r.placed.find((t) => t.s === M.RISK_STRINGS.stratCaption);
      if (!cal || !strat) {
        bad.push(`${w}: a caption was truncated`);
        continue;
      }
      if (cal.x + cal.w + 8 > strat.x) bad.push(`${w}: the two captions meet`);
      if (strat.x + strat.w > w - 4) bad.push(`${w}: the right caption runs off the stage`);
      const note = r.placed.find((t) => t.s === M.RISK_STRINGS.calNote);
      if (!note || note.y >= cal.y) bad.push(`${w}: the decile note did not take its own line`);
      if (note && note.y < L.head.y + 12) bad.push(`${w}: the decile note met the step line`);
    }
    check("step 6's captions and notes fit the stage at every width", bad.length === 0,
      bad.slice(0, 2).join(" | "));
  }

  /* THE RUN'S LAST FRAME IS THE FINISHED FIGURE, on all six steps: what Play
     ends on is what a `shown=` link lands on. */
  {
    let same = true;
    const differ = [];
    for (const page of PAGES) {
      const params = base({ page });
      const state = build(params);
      const total = M.totalFor(page, state, params);
      const W2 = await widget();
      const anim = W2.animation.init({ params, state, fromScratch: true });
      anim.mode = "run";
      let guard = 0;
      while (W2.animation.advance(anim, { dt: 16, params, state }) && guard < 4000) guard += 1;
      const ran = paintedAt(params, anim).painted.join("|");
      const landed = paintedAt(params, {
        ...W2.animation.init({ params: { ...params, shown: total }, state, fromScratch: false }),
      }).painted.join("|");
      if (ran !== landed) {
        same = false;
        differ.push(page);
      }
    }
    check("the run's last frame is the figure a shown= link lands on, on every step",
      same, differ.join(" "));
  }
}

console.log(failed ? `\n${failed} of ${ran} FAILED\n` : `\nall ${ran} checks passed\n`);
process.exit(failed ? 1 : 0);
