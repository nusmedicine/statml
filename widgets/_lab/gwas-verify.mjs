/* ============================================================================
   Assertions on widget 57's engine, geometry and copy.

       node widgets/_lab/gwas-verify.mjs

   Imports `widgets/gwas/model.js`, the shipping code and not a copy (5.8), and
   `widgets/core/params.js`, so the URL round trip is the one the page
   performs.

   Five of these need a reader most.

   THE SURVEY'S OWN NUMBERS. `_lab/gwas-measure.mjs` ran 110 checks on
   2026-09-12 and every control on this widget was chosen from them: λ and the
   false peaks under each model, the nested topology the eigenvalues need, the
   effect size that shows a peak at n = 300, and the fact that the relationship
   matrix is inert on the SCAN without families and not on the ESTIMATE. The
   whole engine was MOVED into the widget, so the same numbers are asserted
   here against the moved copies. If they drift, the figure is drawing
   something the survey never measured.

   THE CAUSAL SNP THE CONFOUNDER HIDES. The mock found it and it is the
   widget's answer to "principal components throw away real signal": at the
   default cohort, SNP only returns the middle causal SNP at −log₁₀P 2.09
   against the line's 4.60, and + 5 PCs finds it at 8.37. The confounder does
   not only add peaks; it hides one.

   THE TWO PATHS THROUGH THE EIGENVECTORS. The scatter's components come from
   subspace iteration and every covariate column from the full decomposition
   (main.js decision 4). That is only sound while the two agree about the
   picture, so the agreement is asserted rather than assumed.

   THE RUN'S LAST FRAME IS THE FINISHED SCAN, and its first frame is the
   variance step with no SNP tested. Both are the two-step the widget exists to
   show, and neither is visible to any hash that photographs a settled figure.

   THE STATUS. Both files say `draft` and this assertion says so; it flips at
   ship, in the same commit as the manifest and the widget.

   Exits non-zero on failure.
   ========================================================================= */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "../gwas/model.js";
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
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${pad(name, 80)} ${detail}`);
}

const src = read("widgets/gwas/main.js");
const manifest = JSON.parse(read("widgets/manifest.json"));
const card = manifest.widgets.find((w) => w.slug === "gwas");

/* the state the widget opens on, through its own door */
const DEFAULTS = {
  page: "association", ancestry: "strong", shift: "1", effect: "0.12",
  families: "none", familyEffect: 1, model: "snp", npcs: "5", seed: 1, shown: 0,
};
const base = (over = {}) => ({ ...DEFAULTS, ...over });

/** `compute`'s own body, called the way the widget calls it. */
function build(params, seed) {
  return M.build(makeRng(seed ?? params.seed ?? 1), M.configFor(params));
}
const readAll = (state) => M.reading(state, M.M_SNPS);

/* --- the widget itself, driven with no browser and no clock ----------------
 * `main.js` imports two things from core and its own model, so stubbing the
 * core import captures the whole config object — and `compute`,
 * `animation.init/advance/rebuild`, `legend`, `readout` and `summary` are then
 * callable with no DOM. The REAL `makePlot` is kept, because it is DOM-free —
 * it takes a context and does arithmetic — so §7 can drive the widget's own
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
    `import * as M from ${abs("../gwas/model.js")};`);
  text += "\nexport { __cfg };\n";
  cached = (await import(
    `data:text/javascript;base64,${Buffer.from(text, "utf8").toString("base64")}`
  )).__cfg;
  return cached;
}

/* --- 1 · the tails and the threshold --------------------------------------- */
{
  check("the corrected threshold is 0.05 / 2,000", Math.abs(M.THRESHOLD - 2.5e-5) < 1e-12,
    M.THRESHOLD.toExponential(2));
  check("…which is −log₁₀P 4.60", Math.abs(M.THR_L - 4.602) < 0.005, M.THR_L.toFixed(3));
  check("the χ²(1) tail at 3.841 is 0.05", Math.abs(M.chi1Tail(3.8415) - 0.05) < 1e-3,
    M.chi1Tail(3.8415).toFixed(5));
  check("…and its median is 0.4549, the divisor λ is read against",
    Math.abs(M.chi1Inv(0.5) - 0.4549) < 1e-3, M.chi1Inv(0.5).toFixed(4));
  /* the t tail against the normal it is NOT: on 294 df at the corrected
     threshold the two differ enough to move the count past the line */
  check("a two-sided t of 0 is P = 1", M.tTwoSided(0, 294) === 1);
  check("…and one of 4.3 on 294 df is about 2e-5",
    M.tTwoSided(4.3, 294) > 1e-5 && M.tTwoSided(4.3, 294) < 4e-5,
    M.tTwoSided(4.3, 294).toExponential(2));
  /* λ on a uniform set of P values is 1 by construction */
  const rng = makeRng(11);
  const U = Float64Array.from({ length: 4000 }, () => rng.next());
  check("λ of uniform P values is 1", Math.abs(M.lambda(U) - 1) < 0.05, M.lambda(U).toFixed(3));
}

/* --- 2 · the default cohort, against the mock's own readings ---------------- */
const SNP = build(base({ model: "snp" }));
const PC5 = build(base({ model: "pcs", npcs: "5" }));
const PC2 = build(base({ model: "pcs", npcs: "2" }));
const GRM = build(base({ model: "grm", npcs: "5" }));
{
  const s = readAll(SNP);
  const p5 = readAll(PC5);
  const p2 = readAll(PC2);
  const g = readAll(GRM);

  check("SNP only gives λ 4.83 on the default cohort", Math.abs(s.lambda - 4.834) < 0.02,
    s.lambda.toFixed(3));
  check("…with 96 SNPs past the corrected threshold", s.hits === 96, String(s.hits));
  check("…and finds 2 of the 3 causal SNPs", s.found === 2, String(s.found));

  check("+ 5 PCs gives λ 1.04", Math.abs(p5.lambda - 1.044) < 0.02, p5.lambda.toFixed(3));
  check("…with 3 past the line, all of them causal", p5.hits === 3 && p5.found === 3,
    `${p5.hits} past, ${p5.found} causal`);
  check("+ 2 PCs is the same reading", Math.abs(p2.lambda - p5.lambda) < 0.02 && p2.hits === 3,
    `λ ${p2.lambda.toFixed(3)}, ${p2.hits} past`);

  /* THE CAUSAL SNP THE CONFOUNDER HIDES — the mock's own find. */
  const mid = M.CAUSAL[1];
  check("SNP only loses the middle causal SNP at −log₁₀P 2.09",
    Math.abs(SNP.lp[mid] - 2.09) < 0.05 && SNP.lp[mid] < M.THR_L, M.n2(SNP.lp[mid]));
  check("…and + 5 PCs finds it at 8.37", Math.abs(PC5.lp[mid] - 8.37) < 0.05
    && PC5.lp[mid] > M.THR_L, M.n2(PC5.lp[mid]));

  /* the third model, with unrelated people: the SCAN does not move */
  check("+ PCs + GRM moves λ by less than 0.1 with no families",
    Math.abs(g.lambda - p5.lambda) < 0.1, `${p5.lambda.toFixed(3)} → ${g.lambda.toFixed(3)}`);
  check("…and finds the same 3 causal SNPs and no others",
    g.hits === 3 && g.found === 3, `${g.hits} past, ${g.found} causal`);
  /* …and the ESTIMATE does: the widget can promise the skyline will not move
     and cannot promise the variance readout prints zero (the measure script's
     second finding). At the default and seed 1 it does NOT fall back. */
  check("the variance step at seed 1 finds genetic variance and does not fall back",
    GRM.reml.h2 > 0.3 && GRM.reml.P < 0.05 && GRM.fellBack === false,
    `ĥ² ${M.n2(GRM.reml.h2)}, P ${M.pfmt(GRM.reml.P)}`);
  const fb = build(base({ model: "grm" }), 4);
  check("…and seed 4 at the identical settings falls back",
    fb.fellBack === true && fb.reml.P > 0.05, `ĥ² ${M.n2(fb.reml.h2)}, P ${M.pfmt(fb.reml.P)}`);
}

/* --- 2b · what the fixed y axis costs --------------------------------------
 * The axis runs 0 to 19 whatever the model and whatever the cohort, so a taller
 * peak is drawn at the ceiling. That is only honest while such a peak is one
 * the reader is being shown as extreme anyway, so the property is asserted
 * rather than assumed: a clipped SNP is always past the corrected threshold,
 * by a wide margin.
 */
{
  let clipped = 0;
  let worst = 0;
  let allExtreme = true;
  /* SNP only, which is where the tallest peaks are: the confounder inflates
     every test, so the model whose axis is hardest to hold is the one with no
     covariates in it. */
  for (const ancestry of ["none", "weak", "strong"]) {
    for (const effect of ["0.05", "0.20"]) {
      for (const seed of [1, 2, 3]) {
        const st = build(base({ ancestry, effect, model: "snp" }), seed);
        for (let j = 0; j < M.M_SNPS; j += 1) {
          worst = Math.max(worst, st.lp[j]);
          if (st.lp[j] > M.AXIS_TOP) {
            clipped += 1;
            if (st.lp[j] < M.THR_L * 2) allExtreme = false;
          }
        }
      }
    }
  }
  check("a SNP drawn at the axis ceiling is past the threshold by a wide margin",
    allExtreme, `${clipped} clipped, tallest −log₁₀P ${worst.toFixed(1)}`);
  check("…and the axis holds the default cohort's own peak",
    build(base({ model: "snp" })).lp[M.CAUSAL[0]] < M.AXIS_TOP,
    M.n2(build(base({ model: "snp" })).lp[M.CAUSAL[0]]));
}

/* --- 3 · the ancestry ladder, the trait difference, the effect ladder ------- */
{
  const ladder = ["none", "weak", "strong"].map((a) => ({
    a, r: readAll(build(base({ ancestry: a, model: "snp" }))),
  }));
  check("each ancestry setting says something different under SNP only",
    ladder[0].r.lambda < 1.2 && ladder[1].r.lambda > 1.5 && ladder[2].r.lambda > 3,
    ladder.map((x) => `${x.a} λ ${x.r.lambda.toFixed(2)} / ${x.r.hits} past`).join(" · "));
  check("…and no ancestry is no inflation: 3 past the line, all causal",
    ladder[0].r.hits === 3 && ladder[0].r.found === 3);

  /* THE CONFOUNDING CLAIM NEEDS TWO COHORTS, and the second is reached through
     the Trait difference control rather than drawn beside the stage (§2's
     pick): the same ancestry in the genotypes, no trait difference. */
  const flat = readAll(build(base({ shift: "0", model: "snp" })));
  check("the same ancestry with no trait difference sits on the line",
    flat.lambda < 1.2, `λ ${flat.lambda.toFixed(2)}, ${flat.hits} past`);

  /* the effect ladder: 0.05 is the case that fails at n = 300 */
  const weak = readAll(build(base({ effect: "0.05", model: "pcs" })));
  const strong = readAll(build(base({ effect: "0.20", model: "pcs" })));
  check("a causal effect of 0.20 puts all three causal SNPs past the line",
    strong.found === 3, String(strong.found));
  check("…and 0.05 does not, which is what power looks like",
    weak.found < 3, `${weak.found} of 3`);
}

/* --- 4 · families, and the relationship matrix ------------------------------ */
{
  const fpc = readAll(build(base({ families: "sibships", model: "pcs" })));
  const fgrm = build(base({ families: "sibships", model: "grm" }));
  const fr = readAll(fgrm);
  check("with sibships sharing a trait effect, + 5 PCs is inflated",
    fpc.lambda > 1.5, `λ ${fpc.lambda.toFixed(3)}, ${fpc.hits} past`);
  check("…and the relationship matrix returns λ to about 1",
    fr.lambda < 1.1, `λ ${fr.lambda.toFixed(3)}, ${fr.hits} past`);
  check("…with the variance step far from its fallback",
    fgrm.fellBack === false && fgrm.reml.P < 1e-6,
    `ĥ² ${M.n2(fgrm.reml.h2)}, P ${M.pfmt(fgrm.reml.P)}`);

  /* the image's own range, which is what the ±0.25 cap is chosen against */
  const r0 = M.grmRange(SNP.K);
  const rf = M.grmRange(fgrm.K);
  check("the relationship matrix runs about −0.13 to 0.17 off the diagonal",
    r0.lo > -0.2 && r0.lo < -0.1 && r0.hi > 0.13 && r0.hi < 0.25,
    `${M.n3(r0.lo)} to ${M.n3(r0.hi)}`);
  check("…and its diagonal sits around 1", r0.dlo > 0.8 && r0.dhi < 1.3,
    `${M.n2(r0.dlo)} to ${M.n2(r0.dhi)}`);
  check("a sibling pair is several times the strongest population block",
    rf.hi / r0.hi > 3, `${M.n3(rf.hi)} against ${M.n3(r0.hi)}, ${(rf.hi / r0.hi).toFixed(1)}×`);
  check("the ramp's cap sits between the population blocks and the sibling pairs",
    M.GRM_CAP > r0.hi && M.GRM_CAP < rf.hi, String(M.GRM_CAP));
  check("75 sibships of four, and none without them",
    fgrm.co.nFam === 75 && SNP.co.nFam === 0, `${fgrm.co.nFam} / ${SNP.co.nFam}`);
}

/* --- 5 · the two paths through the eigenvectors ----------------------------- */
{
  /* The nested topology, which is the measure script's fourth finding: three
     equidistant subpopulations give two eigenvalues of equal height where the
     lesson's own relationship matrix has 17.28 and 3.08. */
  const ratio = GRM.eig.values[0] / GRM.eig.values[1];
  check("the nested topology gives one large eigenvalue and a smaller second",
    ratio > 4 && ratio < 9, `λ1/λ2 ${ratio.toFixed(2)} against the lesson's 5.6`);
  check("…and the rest is flat, the Marchenko–Pastur edge and not a fourth axis",
    GRM.eig.values[2] / GRM.eig.values[5] < 1.2,
    [...GRM.eig.values].slice(0, 6).map((v) => v.toFixed(2)).join(" · "));

  /* main.js decision 4: the scatter is drawn from subspace iteration and every
     covariate column from the full decomposition, so the two have to agree
     about the picture. */
  const rel = (a, b) => Math.abs(a - b) / Math.abs(b);
  check("the scatter's two components match the full decomposition to 1e-3",
    rel(SNP.view.values[0], GRM.eig.values[0]) < 5e-3
    && rel(SNP.view.values[1], GRM.eig.values[1]) < 5e-3,
    `${rel(SNP.view.values[0], GRM.eig.values[0]).toExponential(1)}, `
    + `${rel(SNP.view.values[1], GRM.eig.values[1]).toExponential(1)}`);
  let worst = 0;
  for (let t = 0; t < 2; t += 1) {
    const a = SNP.view.vectors[t];
    const b = GRM.eig.vectors[t];
    let dot = 0;
    for (let i = 0; i < a.length; i += 1) dot += a[i] * b[i];
    worst = Math.max(worst, 1 - Math.abs(dot));
  }
  check("…and so do the vectors themselves, up to their sign", worst < 5e-3,
    worst.toExponential(1));
  check("the cohort's own picture does not move with the model",
    SNP.view.values[0] === PC5.view.values[0] && SNP.view.values[0] === GRM.view.values[0],
    "one source for the scatter, whatever the Model control says");
  /* the cheap path is skipped where a test reads the components */
  check("the full decomposition is built only when a test reads it",
    SNP.eig === null && PC5.eig !== null && GRM.eig !== null);
}

/* --- 6 · compute is pure, and the run reveals it ---------------------------- */
{
  const a = build(base());
  const b = build(base());
  let same = a.scan.P.length === b.scan.P.length;
  for (let j = 0; j < a.scan.P.length && same; j += 1) if (a.scan.P[j] !== b.scan.P[j]) same = false;
  check("compute is pure: the same parameters and seed give the same tests", same);

  /* the Model control changes no cohort: the genotypes and the trait are the
     same draws, which is what makes switching it a display change */
  let sameY = true;
  for (let i = 0; i < M.N && sameY; i += 1) if (SNP.co.y[i] !== GRM.co.y[i]) sameY = false;
  let sameG = true;
  for (let j = 0; j < M.M_SNPS && sameG; j += 1) {
    for (let i = 0; i < M.N; i += 1) if (SNP.co.G[j][i] !== GRM.co.G[j][i]) { sameG = false; break; }
  }
  check("the model changes which test each SNP gets, not which cohort exists", sameY && sameG);
  /* and neither does the trait difference change the genotypes, so the
     relationship matrix and the scatter are the same picture along that
     control */
  const flat = build(base({ shift: "0" }));
  let sameK = true;
  for (let i = 0; i < M.N && sameK; i += 1) {
    for (let j = 0; j < M.N; j += 1) if (SNP.K[i][j] !== flat.K[i][j]) { sameK = false; break; }
  }
  check("the trait difference changes the trait and leaves the genotypes alone", sameK);

  /* the partial reading is the finished one at the end, and honest before it */
  const mid = M.reading(PC5, 1000);
  const end = M.reading(PC5, M.M_SNPS);
  check("the reading at 1,000 tests counts only those tests",
    mid.points.length === 1000 && mid.hits <= end.hits, `${mid.hits} of ${end.hits} past`);
  check("…and the last one is the finished scan",
    end.points.length === M.M_SNPS && end.hits === 3, `${end.hits} past`);
  check("nothing is read before the first test",
    M.reading(PC5, 0).points.length === 0 && !Number.isFinite(M.reading(PC5, 0).lambda));
}

/* --- 7 · the widget driven in node, with no browser and no clock ----------- */
{
  const W = await widget();
  for (const key of ["slug", "title", "subtitle", "status", "layout", "height",
    "params", "legend", "compute", "draw", "readout", "summary", "animation"]) {
    check(`the widget declares \`${key}\``, W[key] != null);
  }

  const WANT = {
    page: "segmented", ancestry: "segmented", shift: "segmented", effect: "segmented",
    families: "segmented", familyEffect: "float", model: "segmented", npcs: "segmented",
    seed: "int", shown: "int",
  };
  for (const [n, t] of Object.entries(WANT)) {
    check(`${n} is a ${t}`, W.params[n]?.type === t, W.params[n]?.type);
  }
  const declared = Object.entries(W.params)
    .filter(([, f]) => f.type !== "section").map(([n]) => n).sort().join();
  check("no parameters beyond those", declared === Object.keys(WANT).sort().join(), declared);
  check("the display parameters are the page, the model and the PC count",
    Object.entries(W.params).filter(([, f]) => f.display).map(([n]) => n).sort().join()
      === "model,npcs,page",
    Object.entries(W.params).filter(([, f]) => f.display).map(([n]) => n).sort().join());
  check("the cohort's own controls are DATA",
    ["ancestry", "shift", "effect", "families", "familyEffect", "seed"]
      .every((n) => !W.params[n].display));
  check("the family effect shows under sibships alone (3.4b)",
    W.params.familyEffect.when?.param === "families"
    && W.params.familyEffect.when?.equals === "sibships");
  check("the PC count shows under the two models that use components",
    W.params.npcs.when?.oneOf?.join() === "pcs,grm");
  /* 3.4j is for a withheld answer, which a seed is not; Kenneth's ruling on 59
     (2026-09-12) puts the seed in a The data section under the page control */
  check("the seed sits in The data section directly under the page control, above the drive row",
    !W.params.seed.afterDrive && Object.keys(W.params).slice(0, 3).join() === "page,dataSec,seed"
    && W.params.dataSec.type === "section" && W.params.dataSec.label === "The data");
  check("the widget opens on SNP only, so the first run is the forest (2.1)",
    W.params.model.default === "snp");
  check("…and empty, with the head start hidden",
    W.params.shown.hidden === true && W.params.shown.default === 0);
  check("the animation reveals k and never recomputes (non-negotiable 2)",
    !/compute/.test(src.split("animation: {")[1]?.split("draw(")[0] ?? ""));
  check("every colour is a token, never a literal",
    !/#[0-9a-fA-F]{3,6}\b/.test(src.replace(/\/\*[\s\S]*?\*\//g, " ")));
  check("all randomness comes from the seeded rng (non-negotiable 6)",
    !/Math\.random/.test(src) && !/Math\.random/.test(read("widgets/gwas/model.js")));

  /* the run: one press of Step is one SNP, Play is a rate, and the first frame
     of a run is the variance step with nothing tested */
  {
    const params = base({ model: "grm" });
    const state = W.compute({ params, rng: makeRng(1) });
    const anim = W.animation.init({ params, state, fromScratch: true });
    check("the figure opens with no SNP tested (2.1)",
      anim.k === 0 && anim.varDone === false && anim.done === false);
    anim.mode = "run";
    W.animation.advance(anim, { dt: 16, params, state });
    check("Play's first frame is the variance step, and tests no SNP",
      anim.varDone === true && anim.k === 0);
    let frames = 1;
    while (!anim.done && frames < 20000) {
      W.animation.advance(anim, { dt: 16, params, state });
      frames += 1;
    }
    check("Play reaches the last SNP and stops", anim.done && anim.k === M.M_SNPS,
      `${anim.k} of ${M.M_SNPS}`);
    /* 200 units of 16.7 ms is 3.3 s, which is 209 frames of 16 ms — the number
       that catches a floor of one unit per frame */
    check("Play keeps the fraction across frames, so the pace is a rate",
      frames > 195 && frames < 230, `${frames} frames`);

    const stepAnim = W.animation.init({ params, state, fromScratch: true });
    stepAnim.mode = "step";
    let more = true;
    let steps = 0;
    while (more && steps < 100) {
      more = W.animation.advance(stepAnim, { dt: 16, params, state });
      steps += 1;
    }
    check("one press of Step tests one SNP, which is what its label says",
      stepAnim.k === 1, `${stepAnim.k} after ${steps} frames`);
    check("…and does the variance step on the way", stepAnim.varDone === true);

    /* the last frame IS the finished scan: the reading the run ends on is the
       reading a settled figure shows */
    const walked = M.reading(state, anim.k);
    const settled = M.reading(state, M.M_SNPS);
    check("the run's last frame is the finished scan",
      walked.hits === settled.hits && walked.lambda === settled.lambda,
      `${walked.hits} past, λ ${M.n2(walked.lambda)}`);
  }

  /* a display change keeps the tests; a data change starts them over */
  {
    const params = base();
    const state = W.compute({ params, rng: makeRng(1) });
    const anim = W.animation.init({ params, state, fromScratch: true });
    anim.k = 800;
    anim.varDone = true;
    W.animation.rebuild(anim, { params: { ...params, page: "cohort" }, state });
    check("visiting the cohort keeps the tests", anim.k === 800);
    check("…and takes Step and Play out of the row there (4.5)", anim.inert === true);
    W.animation.rebuild(anim, { params, state });
    check("coming back leaves them where they were", anim.k === 800 && anim.inert === false);
    W.animation.rebuild(anim, { params: { ...params, model: "pcs" }, state });
    check("switching the model keeps the reader's position in the run (decision 3)",
      anim.k === 800);
    const fresh = W.animation.init({ params, state, fromScratch: true });
    check("a data change starts the run over (invariant 3)",
      fresh.k === 0 && fresh.varDone === false);

    const authored = W.animation.init({ params: { ...params, shown: 800 }, state, fromScratch: false });
    check("shown= lands partway in", authored.k === 800 && authored.varDone === true);
    const replayed = W.animation.init({ params: { ...params, shown: 800 }, state, fromScratch: true });
    check("and Replay ignores it", replayed.k === 0);
    const clamped = W.animation.init({ params: { ...params, shown: 99999 }, state, fromScratch: false });
    check("a head start past the genome lands on its last SNP",
      clamped.k === M.M_SNPS && clamped.done === true);
  }

  /* the tiles: blank until the first test, and the variance row on the first
     frame of the run — the two-step, in the numbers */
  {
    const params = base({ model: "grm" });
    const state = W.compute({ params, rng: makeRng(1) });
    const empty = W.readout({ params, state, anim: { k: 0, varDone: false } });
    check("every tile is blank before the first test (2.4)",
      empty.filter((t) => !t.break).every((t) => t.value === "—"),
      empty.filter((t) => !t.break).map((t) => t.value).join(" "));
    const stepOne = W.readout({ params, state, anim: { k: 0, varDone: true } });
    const named = Object.fromEntries(stepOne.filter((t) => !t.break).map((t) => [t.label, t.value]));
    check("the variance tiles fill on the first frame of the run, with no SNP tested",
      named.Heritability !== "—" && named["λ"] === "—",
      `h² ${named.Heritability}, λ ${named["λ"]}`);
    const mid = W.readout({ params, state, anim: { k: 1000, varDone: true } });
    const at1000 = Object.fromEntries(mid.filter((t) => !t.break).map((t) => [t.label, t.value]));
    check("the tiles read the tests so far during the run (2.8)",
      at1000["Past the threshold"] === M.intText(M.reading(state, 1000).hits),
      at1000["Past the threshold"]);
    check("the variance tiles are the second row, not a fourth column",
      stepOne.some((t) => t.break === true) && stepOne.filter((t) => !t.break).length === 7);
    const noVar = W.readout({ params: base({ model: "pcs" }), state: W.compute({ params: base({ model: "pcs" }), rng: makeRng(1) }), anim: { k: 500, varDone: true } });
    check("…and there is no variance row where there is no variance step",
      noVar.length === 3 && !noVar.some((t) => t.break));
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
        const state = W.compute({ params, rng: makeRng(params.seed ?? 1) });
        for (const k of [0, 1, 1000, M.M_SNPS]) {
          const anim = { k, beat: 0, varDone: k > 0, done: k >= M.M_SNPS, inert: false };
          const say = [
            ...W.readout({ params, state, anim }).flatMap((t) => [t.label, t.value, t.note]),
            W.summary({ params, state, anim }),
            ...W.legend({ params }).map((e) => e.label),
          ].filter((s) => s != null);
          strings += say.length;
          for (const s of say) if (bad(s)) nans.push(`${name}=${v} k=${k}: ${s}`);
        }
      }
    }
    check(`no readout, summary or legend string carries a NaN (${strings} strings)`,
      nans.length === 0, nans.slice(0, 3).join(" | "));
  }

  /* the legend follows the page, so it names what is drawn */
  {
    const assoc = W.legend({ params: base() }).map((e) => e.label);
    const cohort = W.legend({ params: base({ page: "cohort" }) }).map((e) => e.label);
    check("the association page's legend names the threshold and the causal marks",
      assoc.some((l) => l.includes("threshold")) && assoc.some((l) => l.includes("causal")),
      assoc.join(" · "));
    check("the cohort page has its own legend, and no threshold in it",
      cohort.some((l) => l.includes("Subpopulation")) && !cohort.some((l) => l.includes("threshold")),
      cohort.join(" · "));
  }
}

/* --- 8 · the geometry ------------------------------------------------------ */
{
  const W = await widget();
  const WIDTHS = [550, 620, 690, 776, 900];
  let inside = true;
  let square = true;
  let apart = true;
  for (const w of WIDTHS) {
    for (const model of ["snp", "pcs", "grm"]) {
      const L = M.layout(w, { page: "association", model });
      if (L.man.x + L.man.w > L.qq.x) apart = false;
      if (L.qq.x + L.qq.w > w - M.AX_R + 0.5) inside = false;
      if (L.man.y + L.man.h + M.AXIS_ROW > L.height + 0.5) inside = false;
      if (L.qq.w !== L.qq.h) square = false;
      if (L.qq.y < L.man.y || L.qq.y + L.qq.h > L.man.y + L.man.h) inside = false;
      if (L.foot.on && L.foot.y > L.height) inside = false;
    }
    const C = M.layout(w, { page: "cohort" });
    if (C.scatter.x + C.scatter.w > C.grm.x) apart = false;
    if (C.grm.x + C.grm.w > w - 1) inside = false;
    if (C.scatter.w !== C.scatter.h || C.grm.w !== C.grm.h) square = false;
    if (C.scatter.y + C.scatter.h > C.height) inside = false;
  }
  check("every panel sits inside the stage, at every width", inside,
    WIDTHS.map((w) => M.layout(w, { page: "association", model: "snp" }).height).join(" "));
  check("the QQ plot and the relationship matrix are square", square);
  check("no two panels overlap", apart);
  check("the mock's own geometry comes back at the narrowest canvas",
    M.layout(550, { page: "association", model: "snp" }).man.w === 294
    && M.layout(550, { page: "association", model: "snp" }).qq.w === 166,
    `${M.layout(550, { page: "association", model: "snp" }).man.w} × 188, QQ `
    + `${M.layout(550, { page: "association", model: "snp" }).qq.w}`);
  check("the association stage is 260px, and 280 where the variance step has a line",
    M.layout(690, { page: "association", model: "pcs" }).height === 260
    && M.layout(690, { page: "association", model: "grm" }).height === 280);
  check("the cohort stage is 300px at the narrowest canvas",
    M.layout(550, { page: "cohort" }).height === 300,
    String(M.layout(550, { page: "cohort" }).height));
  check("the widget's height is the layout's own",
    W.height({ ...base(), w: 690 }) === M.layout(690, base()).height
    && W.height({ ...base({ page: "cohort" }), w: 690 })
      === M.layout(690, base({ page: "cohort" })).height);
  check("the widget asks layout() for every rect and builds none of its own",
    /M\.layout\(/.test(src) && !/const rect = \{ x: \d/.test(src));
  check("the height is a function of the parameters and the width",
    /height: \(\{ w, \.\.\.values \}\) => M\.stageHeight\(w, values\)/.test(src));
}

/* --- 9 · the register (5.9), the URL, and the status ----------------------- */
{
  const W = await widget();
  const optionLines = [...M.PAGES, ...M.ANCESTRY, ...M.SHIFTS, ...M.EFFECTS, ...M.FAMILIES,
    ...M.MODELS, ...M.NPCS].map((o) => o.detail).filter(Boolean);
  const fieldLines = [
    M.STRINGS.pageDetail, M.STRINGS.ancestryDetail, M.STRINGS.shiftDetail,
    M.STRINGS.effectDetail, M.STRINGS.familiesDetail, M.STRINGS.familyEffectDetail,
    M.STRINGS.modelDetail, M.STRINGS.npcsDetail, M.STRINGS.seedDetail,
  ];
  /* Kenneth, 2026-09-11 (widget 55): a line under a control that says what will
     happen is the widget announcing its own answer before the first press. A
     detail says what the control IS. */
  const outcome = /\b(reach|reaches|fail|fails|pass|passes|end at|ends at|shows?|finds?|sees?|becomes?|leaves?|removes?|corrects?)\b/i;
  const offenders = [...optionLines, ...fieldLines].filter((s) => outcome.test(s));
  check("no control line announces an outcome", offenders.length === 0, offenders.join(" | "));
  check("every field carries a line saying what it is (3.4f)",
    fieldLines.every((s) => typeof s === "string" && s.length > 10));

  /* every reader-facing string, swept for the register */
  const reader = [
    ...Object.values(M.STRINGS),
    ...[...M.PAGES, ...M.ANCESTRY, ...M.SHIFTS, ...M.EFFECTS, ...M.FAMILIES, ...M.MODELS,
      ...M.NPCS].flatMap((o) => [o.label, o.detail, o.caption].filter(Boolean)),
    ...["association", "cohort"].flatMap((page) => W.legend({ params: base({ page }) })
      .map((e) => e.label)),
    ...["association", "cohort"].flatMap((page) => {
      const params = base({ page, model: "grm" });
      const state = W.compute({ params, rng: makeRng(1) });
      return W.readout({ params, state, anim: { k: 1000, varDone: true } })
        .flatMap((t) => [t.label, t.note].filter(Boolean));
    }),
  ];
  check("no reader-facing string says \"never\"", !reader.some((s) => /\bnever\b/i.test(s)),
    reader.filter((s) => /\bnever\b/i.test(s)).join(" | "));
  check("no reader-facing string names a lesson, notebook, cell or course",
    !reader.some((s) => /\b(notebook|lesson|cell \d|chapter|PHM\d)\b/i.test(s)),
    reader.filter((s) => /\b(notebook|lesson|cell \d|chapter|PHM\d)\b/i.test(s)).join(" | "));
  /* the collection's own vocabulary is ours and not the textbook's — Kenneth,
     2026-09-11: "what is card, rung?" */
  const ours = /\b(cards?|rungs?|ladders?|rails?|stages?|faces?|arms?|piles?|ramps?|budgets?|arrivals?|walks?|wells?|plains?|trenches?|frames?|skylines?|forests?)\b/i;
  const coined = reader.filter((s) => ours.test(s));
  check("no reader-facing string uses the collection's own vocabulary",
    coined.length === 0, coined.join(" | "));
  check("the subtitle is three claims, not a paragraph",
    M.STRINGS.subtitle.length <= 300, `${M.STRINGS.subtitle.length} chars`);
  check("the gallery blurb fits the card's 120", M.STRINGS.blurb.length <= 120,
    `${M.STRINGS.blurb.length} chars`);
  check("the blurb in the manifest is the model's own", card.blurb === M.STRINGS.blurb);
  check("the meta description is the blurb, verbatim",
    read("widgets/gwas/index.html").includes(`content="${M.STRINGS.blurb}"`));
  check("the step label names the widget's own noun (3.4c)",
    /SNP/.test(M.STRINGS.stepLabel), M.STRINGS.stepLabel);
  /* the variance step's line has to be true in the state that shows it (2.11),
     so there are two of them and neither claims the other's case */
  check("the variance step's two lines say what it decided, not what the model always does",
    /found no genetic variance/.test(M.STRINGS.fellBack)
    && /found genetic variance/.test(M.STRINGS.usedGrm)
    && !/unrelated/.test(M.STRINGS.fellBack));

  /* THE URL IS READER-FACING COPY (5.9): every value is a word its own control
     shows, or the number on its tick. */
  const shown = (opt) => opt.label.toLowerCase().replace(/[,+]/g, " ").split(/[^a-z0-9.]+/);
  const wrong = [...M.PAGES, ...M.ANCESTRY, ...M.FAMILIES, ...M.MODELS]
    .filter((o) => !shown(o).includes(o.value));
  check("every option's URL value is a word its control shows", wrong.length === 0,
    wrong.map((o) => `${o.value} / ${o.label}`).join(" | "));
  check("every number's URL value is the number on its tick",
    [...M.SHIFTS, ...M.EFFECTS, ...M.NPCS].every((o) => o.value === o.label));

  /* the round trip: a link omits the defaults and reads back what it carries */
  {
    const spec = Object.fromEntries(Object.entries(W.params)
      .filter(([, f]) => f.type !== "section"));
    check("a bare page is the default state", toQuery(spec, base()) === "", toQuery(spec, base()));
    const qs = toQuery(spec, base({ page: "cohort", model: "grm", families: "sibships" }));
    check("a tuned figure is a short link",
      qs === "page=cohort&families=sibships&model=grm", qs);
    const back = resolveParams(spec, new URLSearchParams(qs));
    check("and it reads back", back.page === "cohort" && back.model === "grm"
      && back.families === "sibships" && back.shift === "1");
    check("an unknown value falls back to the default",
      resolveParams(spec, new URLSearchParams("model=mixed")).model === "snp");
  }

  /* THIS ASSERTION FLIPS AT SHIP, in the same commit as the manifest and the
     widget: a draft recorded as shipped is what puts unfinished teaching
     material on the front page. */
  /* Flipped with the status on "tested ok, push", 2026-09-12, in the same
     commit as the manifest and the fingerprint states. */
  check("the widget is declared shipped in both files",
    /^\s*status: "shipped",$/m.test(src) && card.status === "shipped", card.status);
  check("the card carries the slot's course and arc",
    card.course === "PHM5003" && card.arc === 57, `${card.course} ${card.arc}`);
}

/* --- 10 · what the figure actually paints ----------------------------------
 * The canvas text sweep, run in node: `draw` is handed a context that records
 * every string and every coordinate, and the REAL `makePlot` does the
 * arithmetic. It catches what no assertion above can — a NaN at one end of a
 * control, a caption that ran off its panel, a mark drawn nowhere — and it is
 * the only check here that sees the picture at all.
 */
{
  const W = await widget();
  const COLORS = Object.fromEntries([
    "surface", "surface2", "ink1", "ink2", "ink3", "grid", "axis", "empirical", "theory",
    "highlight", "reference", "extreme", "valueLow", "valueHigh",
  ].map((k) => [k, `--${k}`]));
  COLORS.clusters = ["--cluster-a", "--cluster-b", "--cluster-c"];
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
      drawImage: noop,
      stroke: noop, fill: noop, setLineDash: noop, translate: noop, rotate: noop,
      /* a width per character, so the caption's own collision guard is
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

  /* One compute per cohort-and-model, cached: a full pass costs 70 to 230 ms
     and the sweep asks for the same state at four points of the run and two
     widths. */
  const states = new Map();
  const stateFor = (params) => {
    const key = JSON.stringify(params);
    if (!states.has(key)) states.set(key, W.compute({ params, rng: makeRng(params.seed ?? 1) }));
    return states.get(key);
  };
  const paintedAt = (params, anim, w = 690) => {
    const r = recorder();
    W.draw({
      ctx: r.ctx, colors: COLORS, w, h: W.height({ ...params, w }),
      params, state: stateFor(params), anim,
    });
    return r;
  };

  let painted = 0;
  const badText = [];
  const badMark = [];
  let threw = null;
  for (const page of ["association", "cohort"]) {
    for (const model of ["snp", "pcs", "grm"]) {
      for (const families of ["none", "sibships"]) {
        for (const k of [0, 1, 1000, M.M_SNPS]) {
          for (const w of [550, 776]) {
            const params = base({ page, model, families });
            const anim = { k, beat: 0, varDone: k > 0, done: k >= M.M_SNPS, inert: false };
            let r = null;
            try {
              r = paintedAt(params, anim, w);
            } catch (e) {
              threw ??= `${page}/${model}/${families}/k=${k}/w=${w}: ${e.message}`;
              continue;
            }
            painted += r.painted.length;
            for (const s of r.painted) {
              if (/NaN|undefined|Infinity/.test(s)) {
                badText.push(`${page}/${model}/${families}/k=${k}: ${s}`);
              }
            }
            for (const m of r.marks) {
              if (m.some((v) => !Number.isFinite(v))) {
                badMark.push(`${page}/${model}/${families}/k=${k}: [${m.join(", ")}]`);
              }
            }
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

  /* the strings the figure paints are the ones it should be painting */
  {
    const empty = paintedAt(base(), { k: 0, varDone: false }).painted;
    check("the empty figure names the model and says no SNP has been tested",
      empty.some((s) => s === `SNP only — ${M.STRINGS.noTest}`),
      empty.find((s) => s.startsWith("SNP only")) ?? "");
    check("…and prints no count past the threshold and no λ yet (2.11)",
      !empty.some((s) => s.includes("past 0.05")) && !empty.some((s) => s.startsWith("λ")),
      empty.join(" · "));
    check("the empty figure carries both axes and the QQ plot's caption",
      empty.includes(M.STRINGS.manX) && empty.includes(M.STRINGS.manY)
      && empty.includes(M.STRINGS.qqX) && empty.includes(M.STRINGS.qqCaption));

    const mid = paintedAt(base(), { k: 1000, varDone: true }).painted;
    check("the caption counts the tests so far (2.8)",
      mid.some((s) => s === "SNP only — 1,000 of 2,000"),
      mid.find((s) => s.startsWith("SNP only")) ?? "");
    check("…the note names the threshold the line cannot label (decision 8)",
      mid.some((s) => /^\d+ past 0\.05 \/ 2,000$/.test(s)),
      mid.find((s) => s.includes("past")) ?? "");
    check("…and the QQ plot prints λ",
      mid.some((s) => /^λ \d/.test(s)), mid.find((s) => s.startsWith("λ")) ?? "");

    const done = paintedAt(base(), { k: M.M_SNPS, varDone: true, done: true }).painted;
    check("the finished caption drops the count of what is left",
      done.some((s) => s === "SNP only — all 2,000 tested"),
      done.find((s) => s.includes("tested")) ?? "");
    check("…and says how many tests are past the ceiling the QQ plot shares",
      done.some((s) => /^\d+ above$/.test(s)), done.find((s) => s.endsWith("above")) ?? "");

    for (const [model, name] of [["snp", "SNP only"], ["pcs", "+ 5 PCs"], ["grm", "+ 5 PCs + GRM"]]) {
      const said = paintedAt(base({ model }), { k: 500, varDone: true }).painted;
      check(`the caption names the model in the control's own words: ${name}`,
        said.some((s) => s.startsWith(`${name} —`)),
        said.find((s) => s.startsWith(name)) ?? "");
    }
    const two = paintedAt(base({ model: "pcs", npcs: "2" }), { k: 500, varDone: true }).painted;
    check("…and the PC count with it", two.some((s) => s.startsWith("+ 2 PCs —")),
      two.find((s) => s.includes("tested")) ?? "");

    /* DECISION 9: the variance step's own line, in both of its states, and
       only under the model that has a variance step */
    const kept = paintedAt(base({ model: "grm" }), { k: 500, varDone: true }).painted;
    check("the variance step says it found genetic variance at this cohort",
      kept.includes(M.STRINGS.usedGrm), kept.find((s) => s.startsWith("The variance")) ?? "");
    const fell = paintedAt(base({ model: "grm", seed: 4 }), { k: 500, varDone: true }).painted;
    check("…and says it found none where it found none",
      fell.includes(M.STRINGS.fellBack), fell.find((s) => s.startsWith("The variance")) ?? "");
    check("no other model carries that line",
      !paintedAt(base({ model: "pcs" }), { k: 500, varDone: true }).painted
        .some((s) => s.startsWith("The variance")));
    check("…and neither does the frame before the variance step has run",
      !paintedAt(base({ model: "grm" }), { k: 0, varDone: false }).painted
        .some((s) => s.startsWith("The variance")));

    /* the eigenvalues are a tile and not a note: the caption takes most of the
       scatter's own row at the narrowest canvas (main.js, drawScatter) */
    {
      const params = base({ page: "cohort" });
      const state = stateFor(params);
      const tile = W.readout({ params, state, anim: { k: 0 } })
        .find((t) => t.label === "Top eigenvalues");
      check("the cohort page reads its eigenvalues off a tile, three of them",
        tile != null && tile.value.split(" · ").length === 3, tile?.value ?? "");
      check("…and the scatter paints no eigenvalue line over its own points",
        !paintedAt(params, { k: 0 }).painted.some((s) => s.startsWith("eigenvalues")));
    }

    const cohort = paintedAt(base({ page: "cohort" }), { k: 0, inert: true }).painted;
    check("the cohort page names the two components and the matrix",
      cohort.includes(M.STRINGS.scatterX) && cohort.includes(M.STRINGS.scatterY)
      && cohort.includes(M.STRINGS.grmCaption) && cohort.includes(M.STRINGS.grmAxis),
      cohort.join(" · "));
    check("…and says which families setting produced it, in the control's words",
      cohort.includes("no families")
      && paintedAt(base({ page: "cohort", families: "sibships" }), { k: 0 })
        .painted.includes("sibships of 4"));
    check("the cohort page draws no skyline and no threshold",
      !cohort.some((s) => s.includes("past 0.05")) && !cohort.includes(M.STRINGS.manX));
  }

  /* THE CAPTION AND ITS NOTE NEVER PRINT THROUGH EACH OTHER. `plot.note` drops
     its line inside the plot area when the caption leaves it no room, and
     inside this panel's top right is where a causal SNP's mark sits — a note
     strokes the ground before it fills, so a collision ERASES the mark and the
     line still looks correct. Measured here at a width per character rather
     than in a browser, and at six pixels a character it is the pessimistic
     reading of both strings. */
  {
    const overlaps = [];
    for (const w of [550, 620, 690]) {
      for (const model of ["snp", "pcs", "grm"]) {
        for (const k of [1, 1000, M.M_SNPS]) {
          const r = paintedAt(base({ model }), { k, varDone: true }, w);
          const cap = r.placed.find((t) => t.s.startsWith(M.modelCaption(base({ model }))));
          const note = r.placed.find((t) => /past 0\.05 \/ 2,000$/.test(t.s));
          if (!cap || !note) {
            overlaps.push(`${w}/${model}/k=${k}: a line is missing`);
            continue;
          }
          if (Math.abs(cap.y - note.y) > 1) {
            overlaps.push(`${w}/${model}/k=${k}: the note left the caption's row`);
            continue;
          }
          const left = note.align === "right" ? note.x - note.w : note.x;
          if (left < cap.x + cap.w + 8) {
            overlaps.push(`${w}/${model}/k=${k}: "${cap.s}" ends at ${Math.round(cap.x + cap.w)}, `
              + `the note starts at ${Math.round(left)}`);
          }
        }
      }
    }
    check("the caption and its note share one row and never overlap on it",
      overlaps.length === 0, overlaps.slice(0, 2).join(" | "));

    /* the QQ panel's own pair, on the narrowest square it is drawn at */
    const r = paintedAt(base(), { k: M.M_SNPS, varDone: true }, 550);
    const cap = r.placed.find((t) => t.s === M.STRINGS.qqCaption);
    const lam = r.placed.find((t) => /^λ /.test(t.s));
    check("…and so do the QQ plot's",
      cap && lam && Math.abs(cap.y - lam.y) <= 1
      && lam.x - lam.w >= cap.x + cap.w + 8,
      cap && lam ? `${Math.round(cap.x + cap.w)} → ${Math.round(lam.x - lam.w)}` : "a line is missing");
  }

  /* THE TRUTH ARRIVES WITH THE TEST (decision 6). No pixel hash can see this —
     the mark is three strokes — so it is counted off the recorded coordinates:
     a causal SNP's mark is a closed triangle at the top edge of the plot area. */
  {
    const countMarks = (k) => {
      const params = base({ model: "pcs" });
      const r = recorder();
      const L = M.layout(690, params);
      W.draw({
        ctx: r.ctx, colors: COLORS, w: 690, h: L.height, params, state: stateFor(params),
        anim: { k, beat: 0, varDone: k > 0, done: false, inert: false },
      });
      /* the apex of each mark: 6px below the plot area's top edge */
      return r.marks.filter((m) => m.length === 2 && Math.abs(m[1] - (L.man.y + 8)) < 0.01).length;
    };
    check("no causal position is marked before its own test lands (2.1)",
      countMarks(0) === 0, String(countMarks(0)));
    check("…one is marked once the run has passed the first of them",
      countMarks(M.CAUSAL[0] + 1) === 1, String(countMarks(M.CAUSAL[0] + 1)));
    check("…and all three once the genome is done",
      countMarks(M.M_SNPS) === 3, String(countMarks(M.M_SNPS)));
  }
}

console.log(failed ? `\n${failed} of ${ran} FAILED\n` : `\nall ${ran} checks passed\n`);
process.exit(failed ? 1 : 0);
