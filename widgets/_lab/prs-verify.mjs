/* ============================================================================
   Assertions on widget 59's engine, geometry and copy.

       node widgets/_lab/prs-verify.mjs

   Imports `widgets/polygenic-score/model.js`, the shipping code and not a copy
   (5.8), and `widgets/core/params.js`, so the URL round trip is the one the
   page performs.

   Six of these need a reader most.

   THE MEASURE SCRIPT'S OWN NUMBERS. `_lab/prs-measure.mjs` ran 35 checks on
   2026-09-12 and every control on this widget was chosen from them: the region
   that can teach tagging, the polygenicity that reproduces the lesson's curve,
   the tag decay that reaches Martin 2019's figures, and the build size that
   fits a compute. The whole engine was MOVED into the widget, so §2 asserts
   the moved copies against the arrangement that script measured — the region
   from `makeRng(1)` reads 28 SNPs under P < 0.05, 8 clumps, and a lead SNP
   15 kb from the causal one at r² 0.83. If those drift, the figure is drawing
   something nobody measured.

   WHAT CLUMPING PROMISES. Two retained lead SNPs are never both inside the
   window and above the r², and every SNP is accounted for exactly once. No
   picture can show either: the panel draws the same points whether the
   algorithm held or not.

   THE SCORE IS THE LESSON'S OWN EQUATION. Σ β̂ⱼ xᵢⱼ over the SNPs the
   threshold keeps, asserted against the engine's own column for several people
   at several thresholds, and against the running sum the figure draws.

   THE RUN'S LAST FRAME IS THE FINISHED FIGURE, on all four pages, and page 1's
   first frame of Play is the tests with no clump taken. Neither is visible to
   any hash that photographs a settled figure.

   THE REGISTER, INCLUDING THE TWO NOMENCLATURE RULINGS. Kenneth, 2026-09-12:
   "tune" is machine learning's word and the field's are best-fit, target
   sample, validation sample and out of sample; and "holdout" stays the name of
   the token, not of anything a reader sees. §10 greps every reader-facing
   string for both, alongside the collection's own vocabulary.

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
  page: "ld", recomb: "medium", clumpR2: "0.1", causalTyped: "typed",
  causal: "300", h2: "0.3", target: "same", threshold: "0.01", person: 1,
  seed: 29, shown: 0,
};
const base = (over = {}) => ({ ...DEFAULTS, ...over });

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
 * it takes a context and does arithmetic — so §11 can drive the widget's own
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

/* --- 4 · the region the widget opens on ------------------------------------ */
const OPEN = build(base());
{
  const R = OPEN.region;
  check("the default region reads 27 SNPs under P < 0.05 and 8 clumps",
    R.hits === 27 && R.clumps.length === 8, `${R.hits} · ${R.clumps.length}`);
  check("…4 of them under P < 0.05", R.sigClumps === 4, String(R.sigClumps));
  check("…and its lead is 15 kb from the causal SNP at r² 0.83 — the case the page is for",
    R.leadIsCausal === false && R.leadDist === 15 && Math.abs(R.leadR2 - 0.833) < 0.002,
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
  check("the base study is 1,500 people over 1,000 SNPs",
    G.nBase === 1500 && G.m === 1000, `${G.nBase} × ${G.m}`);
  check("300 of them carry an effect", G.nCausal === 300, String(G.nCausal));
  check("the target and validation samples are 319 each",
    G.target.y.length === 319 && G.validation.y.length === 319);
  check("the kept count rises with the threshold",
    rows.every((r, i) => i === 0 || r.nSnp >= rows[i - 1].nSnp),
    rows.map((r) => r.nSnp).join(" "));
  check("P < 0.01 keeps 38 SNPs — the figure Kenneth picked page 2 at",
    at(0.01).nSnp === 38, String(at(0.01).nSnp));
  check("P < 1 keeps every SNP in the base study", at(1).nSnp === 1000, String(at(1).nSnp));

  /* the lesson's own shape: near zero at 5e-8, a maximum at a loose threshold,
     and a fall past it */
  const best = rows[G.bestIdx];
  check("the curve is near zero at 5e−8, as the lesson's 0.0013 was",
    at(5e-8).target < 0.01, at(5e-8).target.toFixed(4));
  check("…peaks at a loose threshold", best.thresh >= 0.01, String(best.thresh));
  check("…and falls again past it", at(1).target < best.target,
    `${best.target.toFixed(4)} → ${at(1).target.toFixed(4)}`);
  check("the best-fit threshold is 0.05 at R² 0.086 in the target sample",
    best.thresh === 0.05 && Math.abs(best.target - 0.0865) < 0.002, best.target.toFixed(4));
  check("…and the validation sample reads 0.064 there",
    Math.abs(best.validation - 0.0637) < 0.002, best.validation.toFixed(4));
  check("…so the overfitting the readout prints is 0.023",
    Math.abs(best.target - best.validation - 0.0228) < 0.002,
    (best.target - best.validation).toFixed(4));

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
  const st = M.personScore(OPEN, base({ page: "score" }));
  check("…and the running sum the figure draws ends on it",
    Math.abs(st.cum[st.cum.length - 1] - st.total) < 1e-12, st.total.toFixed(6));
  check("the person's own arithmetic is genotype × weight, term by term",
    st.contrib.every((c, i) => Math.abs(c - st.genotype[i] * st.beta[i]) < 1e-12));
  check("a person's percentile is where their score sits among the 319",
    st.percentile >= 0 && st.percentile <= 100 && Math.abs(st.z - 0.18) < 0.02,
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

/* --- 6 · portability, the claim page 4 is for ------------------------------
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
     about 0.2 for an African one. The mock measured 0.21 for the distant
     setting at its own size; this build size reads about 0.19. */
  check("…the distant target keeps about a fifth of it, Martin 2019's figure",
    mu.distant / mu.same > 0.10 && mu.distant / mu.same < 0.35,
    (mu.distant / mu.same).toFixed(2));
  check("…and the nearby target keeps about half",
    mu.nearby / mu.same > 0.35 && mu.nearby / mu.same < 0.75,
    (mu.nearby / mu.same).toFixed(2));
  check("the vigintile trend falls with it, which is what page 4 draws",
    rg.same > rg.nearby && rg.nearby > rg.distant,
    `${rg.same.toFixed(2)} · ${rg.nearby.toFixed(2)} · ${rg.distant.toFixed(2)} SD`);
  check("the matched trend is visible — over a trait SD from the first vigintile to the last",
    rg.same > 1, rg.same.toFixed(2));
}

/* --- 7 · compute is pure, and the display parameters do not touch it -------- */
{
  const digest = (s) => JSON.stringify({
    hits: s.region.hits,
    clumps: s.region.clumps.map((c) => [c.index, c.members.length, c.p]),
    lead: [s.region.lead, s.region.leadR2, s.region.causalAt],
    rows: s.genome.rows.map((r) => [r.nSnp, r.target, r.validation, r.range, r.excluding]),
    scores: Array.from(s.genome.rows[3].score.slice(0, 12)),
  });
  const a = M.build(makeRng(29), M.configFor(base()));
  const b = M.build(makeRng(29), M.configFor(base()));
  check("two computes at one seed are the same state", digest(a) === digest(b));
  check("a display change computes the same state — the threshold slides over one base study",
    digest(M.build(makeRng(29), M.configFor(base({ threshold: "0.5", person: 44, page: "quantile" }))))
    === digest(a));
  check("a different seed is a different state",
    digest(M.build(makeRng(30), M.configFor(base()))) !== digest(a));
  /* DECISION 1: the four sub-streams. A page-1 control must not move the
     genome, and a page-2 control must not move the region. */
  const otherRegion = M.build(makeRng(29), M.configFor(base({ recomb: "high" })));
  check("a region control leaves the genome exactly where it was",
    JSON.stringify(otherRegion.genome.rows.map((r) => [r.nSnp, r.target]))
    === JSON.stringify(a.genome.rows.map((r) => [r.nSnp, r.target])));
  const otherGenome = M.build(makeRng(29), M.configFor(base({ causal: "600", target: "distant" })));
  check("…and a base-study or target control leaves the region where it was",
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
          && s.region.causalAt >= 1 && Number.isFinite(s.region.top);
        if (!ok) {
          bad += 1;
          notes.push(`${recomb}/${clumpR2}/${causalTyped}`);
        }
      }
    }
  }
  for (const causal of ["100", "300", "600"]) {
    for (const h2 of ["0.1", "0.3", "0.5"]) {
      for (const target of ["same", "nearby", "distant"]) {
        const t0 = performance.now();
        const s = build(base({ causal, h2, target }));
        worstBuild = Math.max(worstBuild, performance.now() - t0);
        const fine = s.genome.rows.every((r) => Number.isFinite(r.target)
          && Number.isFinite(r.validation) && Number.isFinite(r.range)
          && r.binR2.every(Number.isFinite) && r.bins.every((b) => Number.isFinite(b.mean)));
        if (!fine) {
          bad += 1;
          notes.push(`${causal}/${h2}/${target}`);
        }
      }
    }
  }
  check("every setting of every data control builds a finite figure", bad === 0,
    notes.slice(0, 3).join(" | "));
  check("a compute at the defaults is inside the budget", worstBuild < 150,
    `${worstBuild.toFixed(0)} ms worst of the settings drawn here`);
}

/* --- 9 · the widget driven, with no browser and no clock ------------------- */
{
  const W = await widget();
  const PAGES = ["ld", "score", "threshold", "quantile"];

  /* the run on every page: its length, its last frame, and Step's own unit */
  {
    const state = W.compute({ params: base(), rng: makeRng(29) });
    const seconds = {};
    for (const page of PAGES) {
      const params = base({ page });
      const total = M.totalFor(page, state, params);
      const anim = W.animation.init({ params, state, fromScratch: true });
      anim.mode = "run";
      let frames = 0;
      while (W.animation.advance(anim, { dt: 16, params, state }) && frames < 4000) frames += 1;
      seconds[page] = (frames * 16) / 1000;
      check(`Play on ${pad(page, 9)} ends on the finished figure`,
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
      check(`…and one press of Step advances one ${page === "ld" ? "clump" : page === "score" ? "SNP" : page === "threshold" ? "threshold" : "vigintile"}`,
        stepped.k[page] === 1, `${stepped.k[page]} after ${n} frames`);
    }

    /* THE BATCH IS WHAT KEEPS PAGE 1 IN BAND. A strict clumping r² on a
       recombining region leaves fifty-eight clumps of one SNP where the
       default leaves eight of twenty, so a beat carries a batch past a
       countable number of them (2.3) and the run is the same length either
       way. */
    const out = [];
    for (const recomb of ["low", "medium", "high"]) {
      for (const clumpR2 of ["0.1", "0.5"]) {
        const p = base({ page: "ld", recomb, clumpR2 });
        const s = build(p);
        const a = W.animation.init({ params: p, state: s, fromScratch: true });
        a.mode = "run";
        let f = 0;
        while (W.animation.advance(a, { dt: 16, params: p, state: s }) && f < 4000) f += 1;
        const sec = (f * 16) / 1000;
        if (sec < 3 || sec > 7) out.push(`${recomb}/${clumpR2} ${sec.toFixed(1)} s`);
      }
    }
    check("page 1's run is between 3 and 7 s at every setting of its own controls",
      out.length === 0, out.join(" | "));
    check("the authored head start reaches the longest run the widget has",
      W.params.shown.max >= M.GENOME.m, `shown max ${W.params.shown.max}`);

    /* model.js decision 5: Play's first frame on page 1 draws the tests and
       takes no clump; Step takes one on the same press. */
    const params = base({ page: "ld" });
    const run = W.animation.init({ params, state, fromScratch: true });
    run.mode = "run";
    W.animation.advance(run, { dt: 16, params, state });
    check("Play's first frame on page 1 draws the tests and takes no clump",
      run.scanDone === true && run.k.ld === 0);
    const step = W.animation.init({ params, state, fromScratch: true });
    step.mode = "step";
    for (let i = 0; i < 40; i += 1) {
      if (!W.animation.advance(step, { dt: 16, params, state })) break;
    }
    check("…and the first press of Step does both", step.scanDone === true && step.k.ld === 1);
    check("nothing is drawn before the run starts",
      W.animation.init({ params, state, fromScratch: true }).scanDone === false);
  }

  /* the run is per page, and a display change keeps every page's work */
  {
    const params = base();
    const state = W.compute({ params, rng: makeRng(29) });
    const anim = W.animation.init({ params, state, fromScratch: true });
    anim.k.ld = 5;
    anim.scanDone = true;
    anim.k.score = 12;
    W.animation.rebuild(anim, { params: base({ page: "score" }), state });
    check("visiting another page keeps both pages' work (invariant 4)",
      anim.k.ld === 5 && anim.k.score === 12);
    check("…and the run button follows the page it is on",
      anim.done === false);
    W.animation.rebuild(anim, { params: base({ page: "ld" }), state });
    check("coming back leaves the clumps where they were", anim.k.ld === 5);
    /* the threshold is display, so it keeps the sum — and re-derives how far
       that sum can have got */
    anim.k.score = 30;
    W.animation.rebuild(anim, { params: base({ page: "score", threshold: "0.001" }), state });
    check("a tighter threshold stops the sum at the SNPs it keeps",
      anim.k.score === M.totalFor("score", state, base({ threshold: "0.001" })),
      `${anim.k.score} SNPs`);
    const fresh = W.animation.init({ params, state, fromScratch: true });
    check("a data change starts every page over (invariant 3)",
      PAGES.every((p) => fresh.k[p] === 0) && fresh.scanDone === false);

    const authored = W.animation.init({
      params: base({ page: "threshold", shown: 6 }), state, fromScratch: false,
    });
    check("shown= lands partway into the page the link names",
      authored.k.threshold === 6 && authored.k.ld === 0);
    const replayed = W.animation.init({
      params: base({ page: "threshold", shown: 6 }), state, fromScratch: true,
    });
    check("…and Replay ignores it", replayed.k.threshold === 0);
    const clamped = W.animation.init({
      params: base({ page: "quantile", shown: 9999 }), state, fromScratch: false,
    });
    check("a head start past the end lands on the last unit",
      clamped.k.quantile === 20 && clamped.done === true);
  }

  /* the tiles: blank before the run, tracking the partial figure during it */
  {
    const state = W.compute({ params: base(), rng: makeRng(29) });
    const empty = (page) => W.readout({
      params: base({ page }),
      state,
      anim: { k: { ld: 0, score: 0, threshold: 0, quantile: 0 }, scanDone: false },
    });
    let blank = true;
    for (const page of PAGES) {
      if (!empty(page).every((t) => t.value === "—")) blank = false;
    }
    check("every tile on every page is blank before the run (2.4)", blank);

    const anim = (page, k) => ({
      k: { ld: 0, score: 0, threshold: 0, quantile: 0, [page]: k }, scanDone: true,
    });
    const mid = W.readout({ params: base({ page: "score" }), state, anim: anim("score", 10) });
    const named = Object.fromEntries(mid.map((t) => [t.label, t.value]));
    check("the score tracks the SNPs added so far (2.8)",
      named.Score === M.n2(M.personScore(state, base({ page: "score" })).cum[9]), named.Score);
    check("…and the two tiles that place the person wait for the last SNP (decision 7)",
      named["Standardised score"] === "—" && named.Percentile === "—");
    const done = W.readout({
      params: base({ page: "score" }), state, anim: anim("score", 38),
    });
    const at38 = Object.fromEntries(done.map((t) => [t.label, t.value]));
    check("…and read once it is complete",
      at38["Standardised score"] !== "—" && at38.Percentile !== "—",
      `${at38["Standardised score"]} SD, ${at38.Percentile}th`);

    const early = Object.fromEntries(W.readout({
      params: base({ page: "threshold" }), state, anim: anim("threshold", 2),
    }).map((t) => [t.label, t.value]));
    check("a threshold the sweep has not reached prints no R² (2.11)",
      early["R² in the target sample"] === "—", early["R² in the target sample"]);
    const swept = Object.fromEntries(W.readout({
      params: base({ page: "threshold" }), state, anim: anim("threshold", 11),
    }).map((t) => [t.label, t.value]));
    check("…and the finished sweep prints both samples and the overfitting",
      swept["R² in the target sample"] === "0.078"
      && swept["R² in the validation sample"] === "0.060"
      && swept.Overfitting === "0.023",
      `${swept["R² in the target sample"]} / ${swept["R² in the validation sample"]} / ${swept.Overfitting}`);

    const q = Object.fromEntries(W.readout({
      params: base({ page: "quantile" }), state, anim: anim("quantile", 20),
    }).map((t) => [t.label, t.value]));
    check("page 4 reads the score's R², the trend and how many intervals clear the mean",
      q["R²"] !== "—" && q["First to last vigintile"] !== "—"
      && /^\d+ of 20$/.test(q["Intervals excluding the mean"]),
      `${q["R²"]} · ${q["First to last vigintile"]} · ${q["Intervals excluding the mean"]}`);
    const qPart = Object.fromEntries(W.readout({
      params: base({ page: "quantile" }), state, anim: anim("quantile", 8),
    }).map((t) => [t.label, t.value]));
    check("…and the first-to-last reading waits for the twentieth vigintile",
      qPart["First to last vigintile"] === "—");
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
              k: { ld: 0, score: 0, threshold: 0, quantile: 0, [page]: k },
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

  /* the legend follows the page, so it names what is drawn */
  {
    const of = (page) => W.legend({ params: base({ page }) }).map((e) => e.label);
    check("page 1's legend names the lead SNP, the line and the causal position",
      of("ld").some((l) => l.includes("lead SNP")) && of("ld").some((l) => l.includes("P = 0.05"))
      && of("ld").some((l) => l.includes("causal")), of("ld").length + " entries");
    check("page 2's names the genotype, the weight and the sum",
      of("score").some((l) => l.includes("genotype")) && of("score").some((l) => l.includes("weight"))
      && of("score").some((l) => l.includes("sum")));
    check("page 3's names both samples and neither says holdout",
      of("threshold").some((l) => l.includes("target sample"))
      && of("threshold").some((l) => l.includes("validation sample"))
      && !of("threshold").some((l) => /holdout/i.test(l)), of("threshold").join(" · "));
    check("page 4's names the reference line the canvas leaves unlabelled",
      of("quantile").includes(M.STRINGS.meanLine), of("quantile").join(" · "));
  }
}

/* --- 10 · the geometry ----------------------------------------------------- */
{
  const W = await widget();
  const WIDTHS = [550, 620, 690, 776, 900];
  let inside = true;
  let apart = true;
  const notes = [];
  for (const w of WIDTHS) {
    const L1 = M.layout(w, { page: "ld" });
    if (L1.assoc.y + L1.assoc.h + 36 > L1.tri.y) apart = false;
    if (L1.tri.y + L1.tri.h > L1.height) inside = false;
    if (L1.assoc.x + L1.assoc.w > w - M.AX_R + 0.5) inside = false;

    const L2 = M.layout(w, { page: "score" });
    const stack = [L2.geno, L2.weights, L2.sum, L2.dist];
    for (let i = 1; i < stack.length; i += 1) {
      /* a caption sits 18px above its rect and an axis label 35px below one */
      if (stack[i - 1].y + stack[i - 1].h + 18 > stack[i].y) apart = false;
    }
    if (L2.dist.y + L2.dist.h + 35 > L2.height + 0.5) inside = false;
    if (L2.geno.x + L2.geno.w > w - M.AX_R + 0.5) inside = false;

    const L3 = M.layout(w, { page: "threshold" });
    if (L3.curve.y + L3.curve.h + 35 > L3.height) inside = false;
    /* the right margin is the SNPs-kept tick column and its rotated label */
    if (L3.curve.x + L3.curve.w + 54 > w + 0.5) inside = false;

    const L4 = M.layout(w, { page: "quantile" });
    if (L4.bins.y + L4.bins.h + 35 > L4.height) inside = false;
    if (L4.bins.x + L4.bins.w > w - M.Q_R + 0.5) inside = false;
    notes.push(`${w}: ${L1.height}`);
  }
  check("every panel sits inside its own stage, at every width", inside, notes.join(" · "));
  check("no two stacked panels overlap, captions and axis labels included", apart);
  check("the mock's own geometry comes back at the narrowest canvas",
    M.layout(550, { page: "ld" }).tri.h === 124 && M.layout(550, { page: "ld" }).height === 396,
    `triangle ${M.layout(550, { page: "ld" }).tri.h}px of ${M.layout(550, { page: "ld" }).height}`);
  check("the score, threshold and quantile stages are 424, 316 and 300px",
    M.layout(690, { page: "score" }).height === 424
    && M.layout(690, { page: "threshold" }).height === 316
    && M.layout(690, { page: "quantile" }).height === 300);
  check("page 1's stage grows with the width, because its triangle is a fixed 250 kb",
    M.layout(900, { page: "ld" }).height > M.layout(550, { page: "ld" }).height,
    `${M.layout(550, { page: "ld" }).height} → ${M.layout(900, { page: "ld" }).height}`);
  check("the triangle is exactly the clumping window, in SNPs",
    M.layout(690, { page: "ld" }).tri.depth === M.CLUMP_KB / M.REGION.blockLen,
    `${M.layout(690, { page: "ld" }).tri.depth} SNPs either way`);
  check("the widget's height is the layout's own",
    ["ld", "score", "threshold", "quantile"].every((page) =>
      W.height({ ...base({ page }), w: 690 }) === M.layout(690, { page }).height));
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
    M.STRINGS.causalDetail, M.STRINGS.h2Detail, M.STRINGS.targetDetail,
    M.STRINGS.thresholdDetail, M.STRINGS.personDetail, M.STRINGS.seedDetail,
  ];
  const optionLines = [...M.PAGES, ...M.RECOMB, ...M.CLUMP_R2, ...M.TYPED, ...M.CAUSAL, ...M.H2,
    ...M.TARGETS, ...M.THRESHOLD_OPTIONS].map((o) => o.detail).filter(Boolean);
  /* Kenneth, 2026-09-11 (widget 55): a line under a control that says what will
     happen is the widget announcing its own answer before the first press. A
     detail says what the control IS. */
  const outcome = /\b(reach|reaches|fail|fails|pass|passes|end at|ends at|shows?|finds?|sees?|becomes?|leaves?|removes?|corrects?|improves?|worsens?)\b/i;
  const offenders = [...fieldLines, ...optionLines].filter((s) => outcome.test(s));
  check("no control line announces an outcome", offenders.length === 0, offenders.join(" | "));
  check("every field carries a line saying what it is (3.4f)",
    fieldLines.every((s) => typeof s === "string" && s.length > 10));

  /* every reader-facing string, swept for the register */
  const pages = ["ld", "score", "threshold", "quantile"];
  const state = W.compute({ params: base(), rng: makeRng(29) });
  const reader = [
    ...Object.values(M.STRINGS),
    ...[...M.PAGES, ...M.RECOMB, ...M.CLUMP_R2, ...M.TYPED, ...M.CAUSAL, ...M.H2, ...M.TARGETS,
      ...M.THRESHOLD_OPTIONS].flatMap((o) => [o.label, o.detail].filter(Boolean)),
    ...pages.flatMap((page) => W.legend({ params: base({ page }) }).map((e) => e.label)),
    /* BOTH ENDS OF EVERY PAGE. The sweep once ran only on the finished figure,
       and the sentence that describes the EMPTY one — the summary a reader
       meets first — went through it unread. */
    ...pages.flatMap((page) => [
      { k: { ld: 8, score: 38, threshold: 11, quantile: 20 }, scanDone: true, done: true },
      { k: { ld: 0, score: 0, threshold: 0, quantile: 0 }, scanDone: false, done: false },
      { k: { ld: 3, score: 9, threshold: 4, quantile: 7 }, scanDone: true, done: false },
    ].flatMap((anim) => [
      ...W.readout({ params: base({ page }), state, anim })
        .flatMap((t) => [t.label, t.note].filter(Boolean)),
      W.summary({ params: base({ page }), state, anim }),
    ])),
    ...Object.values(M.STEP_LABELS.labels), ...Object.values(M.STEP_TITLES.labels),
    ...Object.values(M.RUN_TITLES.labels),
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
  check("the score is never called a risk or a probability on any surface",
    !reader.some((s) => /\b(risk|probability|chance of)\b/i.test(s)),
    reader.filter((s) => /\b(risk|probability)\b/i.test(s)).join(" | "));
  check("the step label names each page's own noun (3.4c)",
    Object.values(M.STEP_LABELS.labels).join(" ") === "Next clump Next SNP Next threshold Next vigintile",
    Object.values(M.STEP_LABELS.labels).join(" · "));
  check("…and every one of them is declared against the page, so core can reserve the widest",
    M.STEP_LABELS.param === "page" && M.STEP_TITLES.param === "page"
    && M.RUN_TITLES.param === "page");

  /* THE URL IS READER-FACING COPY (5.9): every value is a word its own control
     shows, or the number on its tick. */
  const shown = (o) => o.label.toLowerCase().replace(/[,+]/g, " ").split(/[^a-z0-9.]+/);
  const wrong = [...M.PAGES, ...M.RECOMB, ...M.TYPED, ...M.TARGETS]
    .filter((o) => !shown(o).includes(o.value));
  check("every option's URL value is a word its control shows", wrong.length === 0,
    wrong.map((o) => `${o.value} / ${o.label}`).join(" | "));
  check("every number's URL value is the number on its tick",
    [...M.CLUMP_R2, ...M.CAUSAL, ...M.H2, ...M.THRESHOLD_OPTIONS].every((o) => o.value === o.label));

  {
    const spec = Object.fromEntries(Object.entries(W.params)
      .filter(([, f]) => f.type !== "section"));
    check("a bare page is the default state", toQuery(spec, base()) === "", toQuery(spec, base()));
    const qs = toQuery(spec, base({ page: "threshold", target: "distant", threshold: "0.5" }));
    check("a tuned figure is a short link",
      qs === "page=threshold&target=distant&threshold=0.5", qs);
    const back = resolveParams(spec, new URLSearchParams(qs));
    check("and it reads back", back.page === "threshold" && back.target === "distant"
      && back.threshold === "0.5" && back.causal === "300");
    check("an unknown value falls back to the default",
      resolveParams(spec, new URLSearchParams("target=european")).target === "same");
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

  const animAt = (page, k, scanDone = k > 0) => ({
    k: { ld: 0, score: 0, threshold: 0, quantile: 0, [page]: k },
    scanDone,
    done: false,
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
  for (const page of ["ld", "score", "threshold", "quantile"]) {
    for (const over of [{}, { causalTyped: "untyped", clumpR2: "0.5", recomb: "high" },
      { target: "distant", causal: "600", h2: "0.5" }, { threshold: "5e-8" },
      { threshold: "1", person: 319 }]) {
      const params = base({ page, ...over });
      const total = M.totalFor(page, build(params), params);
      for (const k of [0, 1, Math.max(1, Math.floor(total / 2)), total]) {
        for (const w of [550, 776]) {
          let r = null;
          try {
            r = paintedAt(params, animAt(page, k), w);
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

  /* page 1: the empty figure, the tests, the clumping */
  {
    const empty = paintedAt(base({ page: "ld" }), animAt("ld", 0, false)).painted;
    check("page 1 opens on its axes and the P = 0.05 line, with no test drawn",
      empty.includes(M.STRINGS.alphaLabel) && empty.includes(M.STRINGS.assocX)
      && empty.includes(M.STRINGS.assocY) && !empty.some((s) => /under P < 0\.05/.test(s)),
      empty.join(" · ").slice(0, 90));
    check("…and the triangle's caption is there before its own cells are",
      empty.includes(M.STRINGS.triCaption));

    const tested = paintedAt(base({ page: "ld" }), animAt("ld", 0, true)).painted;
    check("the first frame of Play counts the tests",
      tested.some((s) => s === "27 of 100 SNPs under P < 0.05")
      && tested.includes(M.STRINGS.assocCaption),
      tested.find((s) => s.includes("under P")) ?? "");
    const clumped = paintedAt(base({ page: "ld" }), animAt("ld", 8)).painted;
    check("…and once clumping has run the caption and the count are the clumps'",
      clumped.includes(M.STRINGS.assocCaptionClumped)
      && clumped.some((s) => s === "4 clumps under P < 0.05"),
      clumped.find((s) => s.includes("clump")) ?? "");
    const one = paintedAt(base({ page: "ld" }), animAt("ld", 1)).painted;
    check("…and one clump is not two, in the widget's own grammar",
      one.some((s) => s === "1 clump under P < 0.05"),
      one.find((s) => s.includes("clump")) ?? "");
  }

  /* DECISION 5: the causal SNP's mark arrives with the clump that accounts for
     it. No pixel hash can see this — the mark is three strokes — so it is
     counted off the recorded coordinates: two of its points sit on a row no
     data point can reach, 2px below the plot area's top edge. */
  {
    /* the one setting at this seed where the causal position is not inside the
       first clump: a strict r² with the causal variant off the array leaves it
       to the third */
    const params = base({ page: "ld", recomb: "high", clumpR2: "0.5", causalTyped: "untyped" });
    const L = M.layout(690, params);
    const region = build(params).region;
    const marksAt = (k) => paintedAt(params, animAt("ld", k)).marks
      .filter((m) => m.length === 2 && Math.abs(m[1] - (L.assoc.y + 2)) < 1e-9).length / 2;
    check("the causal SNP's position is not marked before the clumping reaches it (2.1)",
      region.causalAt > 1 && marksAt(region.causalAt - 1) === 0,
      `arrives on beat ${region.causalAt} of ${region.clumps.length}`);
    check("…and is marked once it does", marksAt(region.causalAt) === 1);
    check("…and stays for the rest of the run", marksAt(region.clumps.length) === 1);
  }

  /* page 2 */
  {
    const params = base({ page: "score" });
    const empty = paintedAt(params, animAt("score", 0)).painted;
    check("page 2 opens with no SNP added and no person's line",
      empty.some((s) => s === "0 of 38 SNPs added") && !empty.some((s) => /^person 1$/.test(s)
        && empty.filter((t) => t === "person 1").length > 1),
      empty.find((s) => s.includes("added")) ?? "");
    const mid = paintedAt(params, animAt("score", 12)).painted;
    check("…the sum counts what it has added (2.8)",
      mid.some((s) => s === "12 of 38 SNPs added"), mid.find((s) => s.includes("added")) ?? "");
    check("…and names the three strips and the sample underneath",
      mid.includes(M.STRINGS.genoCaption) && mid.includes(M.STRINGS.weightCaption)
      && mid.includes(M.STRINGS.sumCaption) && mid.includes(M.STRINGS.distCaption));
    const done = paintedAt(params, animAt("score", 38)).painted;
    /* DECISION 7: the person's line lands with the last SNP, so "person 1" is
       painted twice at the end — once as the strip's note, once on the line. */
    check("the person's own line joins the distribution with the last SNP (decision 7)",
      done.filter((s) => s === "person 1").length === 2
      && paintedAt(params, animAt("score", 37)).painted.filter((s) => s === "person 1").length === 1,
      `${done.filter((s) => s === "person 1").length} at the end`);
    const other = paintedAt(base({ page: "score", person: 200 }), animAt("score", 38)).painted;
    check("…and the Person slider draws somebody else's row",
      other.filter((s) => s === "person 200").length === 2);
  }

  /* page 3 */
  {
    const params = base({ page: "threshold" });
    const empty = paintedAt(params, animAt("threshold", 0)).painted;
    check("page 3 opens on both axes and its panel note, with no curve",
      empty.includes(M.STRINGS.curveNote) && empty.includes(M.STRINGS.curveX)
      && empty.includes(M.STRINGS.keptAxis) && !empty.some((s) => /largest in the target/.test(s)));
    const one = paintedAt(params, animAt("threshold", 1)).painted;
    check("…and marks no maximum among one threshold (decision 6)",
      !one.some((s) => /largest in the target/.test(s)));
    const full = paintedAt(params, animAt("threshold", 11)).painted;
    check("the finished sweep names the largest R² in the target sample and where it is",
      full.some((s) => s === "largest in the target: 0.086 at 0.05"),
      full.find((s) => s.includes("largest")) ?? "");
    check("…and the kept count's axis runs from 0 to every SNP in the base study",
      full.includes("0") && full.includes("1,000"));
  }

  /* page 4 */
  {
    const params = base({ page: "quantile" });
    const empty = paintedAt(params, animAt("quantile", 0)).painted;
    check("page 4 opens on its axes and names the target population",
      empty.includes(M.STRINGS.quantCaption) && empty.includes(M.STRINGS.quantX)
      && empty.includes("Same ancestry as the base"));
    check("…and the mean line carries no label on the canvas",
      !empty.includes(M.STRINGS.meanLine));
    const far = paintedAt(base({ page: "quantile", target: "distant" }), animAt("quantile", 20))
      .painted;
    check("…and says which population it is drawn in, in the control's own words",
      far.includes("Distant ancestry"), far.find((s) => s.includes("ancestry")) ?? "");
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
      ["ld", 8, (s) => s === M.STRINGS.assocCaptionClumped, (s) => /clumps? under P/.test(s)],
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

  /* THE RUN'S LAST FRAME IS THE FINISHED FIGURE, on all four pages: what Play
     ends on is what a `shown=` link lands on. */
  {
    let same = true;
    const differ = [];
    for (const page of ["ld", "score", "threshold", "quantile"]) {
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
    check("the run's last frame is the figure a shown= link lands on, on every page",
      same, differ.join(" "));
  }
}

console.log(failed ? `\n${failed} of ${ran} FAILED\n` : `\nall ${ran} checks passed\n`);
process.exit(failed ? 1 : 0);
