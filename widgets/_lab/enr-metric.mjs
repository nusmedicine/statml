/* ============================================================================
   THE RANKING METRIC — the open item at the foot of `widgets/enrichment/main.js`.
   Measured BEFORE anything is drawn, and measured because the obvious version
   of it teaches something FALSE.

     node widgets/_lab/enr-metric.mjs

   The widget's arc must not say that sophistication removes arbitrary choices.
   ORA's choices are the cutoff and the background; the enrichment score drops
   both and picks up the ranking metric. So tab 2 needs a metric control — and
   the shipped stage cannot carry one, because it hands out ONE number per gene
   and every metric over one number is the same order.

   Five questions, and the second one killed the first design:

     1. do fold change and signed significance disagree at all, and does the
        disagreement have a READING — noisy-but-big against quiet-but-consistent;
     2. on a stage where the planted effect is a constant shift, is one metric
        simply BETTER — because a claim that both are defensible is then false;
     3. what stage makes each metric win somewhere;
     4. what a metric costs when NOTHING is differentially expressed;
     5. what the change costs the claims §§ 4-7 of `enr-measure.mjs` already made.

   The candidate stage is defined here and not in `model.js` on purpose: it is
   not picked. If it is, it moves there and this file keeps the measurements.
   ========================================================================= */

import { makeRng } from "../core/rng.js";
import { tTailP } from "../core/stats.js";
import { ora, oraAll, N_SETS } from "../enrichment/model.js";

const SIZE_MIN = 12, SIZE_MAX = 45, PLANTED_MIN = 28;
const GENES = 400, CUT = 60, UNIVERSE = 400, ALPHA = 0.05;

/* THE CANDIDATE STAGE — an experiment rather than one number per gene.
   `n` samples per arm, a gene-specific noise level, and from those a fold
   change AND a t-test p. Both metrics then exist and can disagree.

   TWO KINDS OF PLANTED PATHWAY, which § 2 below is the reason for:
     loud  — a big average change in genes that are noisy anyway
     quiet — a small change in genes that are tightly controlled
   and one down-regulated, which is what § 6 of `enr-measure.mjs` needs. */
const KINDS = {
  loud: { mu: 0.8, sd: 2.0 },
  quiet: { mu: 0.30, sd: 0.5 },
  down: { mu: -0.6, sd: 1.0 },
};

function makeStage(rng, { genes = GENES, n = 4, metric = "fc", scale = 1,
  spec = KINDS, sigmaLog = 0.35 } = {}) {
  const all = [...Array(genes).keys()];
  const order = rng.shuffle([...Array(N_SETS).keys()]);
  const kindOf = { [order[0]]: "loud", [order[1]]: "quiet", [order[2]]: "down" };

  const sets = [];
  for (let i = 0; i < N_SETS; i += 1) {
    const planted = kindOf[i] ?? null;
    const lo = planted ? PLANTED_MIN : SIZE_MIN;
    const size = lo + Math.floor(rng.next() * (SIZE_MAX - lo + 1));
    sets.push({
      index: i, label: `Pathway ${i + 1}`, planted, size,
      members: new Set(rng.shuffle(all).slice(0, size)),
    });
  }

  const df = 2 * n - 2;
  const logFC = [], pVal = [], geneSd = [];
  for (let g = 0; g < genes; g += 1) {
    let mu = 0, sdMul = null;
    for (const s of sets) {
      if (!s.planted || !s.members.has(g)) continue;
      mu += spec[s.planted].mu * scale;
      /* A gene in two planted pathways takes the LOUDER noise. It cannot be
         tightly controlled and wildly variable at once, and the noisy regime
         is the one that governs what you actually measure. */
      sdMul = sdMul === null ? spec[s.planted].sd : Math.max(sdMul, spec[s.planted].sd);
    }
    /* Gene-level variance spans orders of magnitude in real expression data.
       Log-normal with median 1 keeps a typical gene where the shipped stage's
       was; sigmaLog = 0 is the homoscedastic control § 1 needs. */
    const sdG = (sdMul ?? 1) * Math.exp(sigmaLog * rng.normal());
    const A = [], B = [];
    for (let k = 0; k < n; k += 1) A.push(rng.normal(0, sdG));
    for (let k = 0; k < n; k += 1) B.push(rng.normal(mu, sdG));
    const mA = A.reduce((u, v) => u + v, 0) / n;
    const mB = B.reduce((u, v) => u + v, 0) / n;
    const vA = A.reduce((u, v) => u + (v - mA) ** 2, 0) / (n - 1);
    const vB = B.reduce((u, v) => u + (v - mB) ** 2, 0) / (n - 1);
    const sp = Math.sqrt((vA + vB) / 2);
    const fc = mB - mA;
    logFC.push(fc);
    pVal.push(Math.max(1e-300, tTailP(Math.abs(fc / (sp * Math.sqrt(2 / n))), df)));
    geneSd.push(sdG);
  }

  /* The lesson ranks on log2 fold change (cell 9) and names
     -log10(p) x sign(logFC) as the alternative (cell 6). Both are one signed
     number per gene, which is all ORA's cutoff and the running sum need. */
  const signed = pVal.map((p, g) => -Math.log10(p) * Math.sign(logFC[g]));
  const score = metric === "fc" ? logFC : signed;
  const rank = [...Array(genes).keys()].sort((x, y) => score[y] - score[x]);
  const rankOf = new Array(genes);
  rank.forEach((g, i) => { rankOf[g] = i; });
  return { genes, sets, logFC, pVal, signed, geneSd, score, rank, rankOf };
}

/* A single-kind stage, for §§ 1 and 2: the shipped widget's constant shift,
   rebuilt on the experiment so that both metrics exist to be compared. */
const FLAT = (shift) => ({
  loud: { mu: shift, sd: 1 }, quiet: { mu: shift, sd: 1 }, down: { mu: -shift, sd: 1 },
});

const idx = (st, k) => st.sets.find((s) => s.planted === k).index;
const found = (st, kind) => ora(st, idx(st, kind), CUT, UNIVERSE).p < ALPHA;
const med = (xs) => { const y = [...xs].sort((a, b) => a - b); return y[Math.floor(y.length / 2)]; };
const pc = (v, n) => `${((100 * v) / n).toFixed(0)}%`;
const L = console.log;
const rule = (n = 78) => "=".repeat(n);


/* --- 1. do the two metrics disagree, and does it have a reading? ----------- */

L(rule());
L("1. DO THEY DISAGREE — and is the disagreement READABLE?");
L(rule());
L(`
   400 genes, one constant shift of 0.6, top-${CUT} list, 40 seeds. The two
   metrics are ranked over the same genes; sigmaLog is the spread of gene noise.

   swap  = genes in one top-${CUT} and not the other
   sdFC  = mean noise of the genes ONLY fold change picks
   sdSig = mean noise of the genes ONLY signed significance picks
`);
L("     n  sigmaLog |  swap/60    sdFC    sdSig  |  reading");
L("   " + "-".repeat(68));
for (const n of [4, 10]) {
  for (const sigmaLog of [0, 0.3, 0.5, 0.7, 1.0]) {
    let swap = 0, sdFC = 0, sdSig = 0, nFC = 0, nSig = 0;
    const SEEDS = 40;
    for (let s = 1; s <= SEEDS; s += 1) {
      const a = makeStage(makeRng(s), { n, sigmaLog, spec: FLAT(0.6), metric: "fc" });
      const b = makeStage(makeRng(s), { n, sigmaLog, spec: FLAT(0.6), metric: "sig" });
      const tf = new Set(a.rank.slice(0, CUT)), ts = new Set(b.rank.slice(0, CUT));
      for (const g of tf) if (!ts.has(g)) { swap += 1; sdFC += a.geneSd[g]; nFC += 1; }
      for (const g of ts) if (!tf.has(g)) { sdSig += b.geneSd[g]; nSig += 1; }
    }
    const tag = sigmaLog === 0 ? "one variance for all genes — NO reading" : "";
    L(`    ${String(n).padStart(2)}    ${sigmaLog.toFixed(1)}    |   ${(swap / SEEDS).toFixed(1).padStart(4)}     ${(sdFC / Math.max(1, nFC)).toFixed(2)}    ${(sdSig / Math.max(1, nSig)).toFixed(2)}   |  ${tag}`);
  }
  L("");
}
L(`   THE CONTROL IS THE FIRST ROW OF EACH BLOCK. With one variance for all
   genes the two metrics still swap 7-12 genes of ${CUT} — but the genes each
   one prefers have IDENTICAL noise, 1.00 against 1.00. That swap is sampling
   error in the pooled SD and is nothing a reader could name. Gene-level
   variance is what turns it into a distinction: at sigmaLog 0.5 fold change's
   exclusive picks are 2.7x noisier than signed significance's.`);


/* --- 2. the design this kills --------------------------------------------- */

L(`
${rule()}`);
L("2. THE OBVIOUS DESIGN TEACHES SOMETHING FALSE");
L(rule());
L(`
   Keep the shipped stage's ONE constant shift and add the metric control to
   it. 200 seeds, n = 4, shift 0.6. If one metric is simply better, the widget
   cannot claim that the choices merely move.
`);
L("     sigmaLog |  planted pathway found by       |  the metric changes");
L("              |  fold change     signed signif. |  the verdict on");
L("   " + "-".repeat(68));
for (const sigmaLog of [0, 0.3, 0.5, 0.7, 1.0]) {
  let f = 0, s2 = 0, flip = 0;
  const SEEDS = 200;
  for (let s = 1; s <= SEEDS; s += 1) {
    const a = makeStage(makeRng(s), { sigmaLog, spec: FLAT(0.6), metric: "fc" });
    const b = makeStage(makeRng(s), { sigmaLog, spec: FLAT(0.6), metric: "sig" });
    const va = found(a, "loud"), vb = found(b, "loud");
    if (va) f += 1;
    if (vb) s2 += 1;
    if (va !== vb) flip += 1;
  }
  L(`       ${sigmaLog.toFixed(1)}      |     ${pc(f, SEEDS).padStart(4)}            ${pc(s2, SEEDS).padStart(4)}        |     ${pc(flip, SEEDS).padStart(4)} of seeds`);
}
L(`
   SIGNED SIGNIFICANCE IS STRICTLY BETTER HERE, and increasingly so: 86% against
   92% at sigmaLog 0.5, and 65% against 98% at 1.0. That is not a bias in the
   test — it is what the stage MEANS. A constant shift applied to every gene of
   a pathway regardless of its noise is exactly the alternative a t-test is
   built to detect, so ranking on significance is the correct answer to the
   question this stage asks, and a student would rightly conclude "use the
   p-value". Adding the control to the shipped stage would teach that.`);


/* --- 3. the stage that makes the claim true -------------------------------- */

L(`
${rule()}`);
L("3. TWO KINDS OF PATHWAY — and each metric wins on one");
L(rule());
L(`
   loud  = a big average change (${KINDS.loud.mu}) in genes ${KINDS.loud.sd}x noisier than usual
   quiet = a small change (${KINDS.quiet.mu}) in genes tightly controlled at ${KINDS.quiet.sd}x
   Both are real pathways. Neither metric is wrong about either. 300 seeds.
`);
L("                     |  LOUD pathway found  |  QUIET pathway found");
L("     metric          |                      |");
L("   " + "-".repeat(62));
{
  const SEEDS = 300;
  for (const [metric, name] of [["fc", "fold change  "], ["sig", "signed signif"]]) {
    let l = 0, q = 0;
    for (let s = 1; s <= SEEDS; s += 1) {
      const st = makeStage(makeRng(s), { metric });
      if (found(st, "loud")) l += 1;
      if (found(st, "quiet")) q += 1;
    }
    L(`     ${name}   |        ${pc(l, SEEDS).padStart(4)}          |        ${pc(q, SEEDS).padStart(4)}`);
  }
}
L(`
   FOLD CHANGE IS BLIND TO THE QUIET PATHWAY and that is structural, not tuned:
   the list is the top ${CUT} BY MAGNITUDE, and a small change is small however
   many times it repeats. Signed significance finds it on 88% of seeds, and
   pays for it on the loud pathway: 57% against fold change's 100%. Flip the
   control and a different row of the results table lights up, which is the
   figure this is for.`);


/* --- 4. what it costs when nothing is differentially expressed ------------- */

L(`
${rule()}`);
L("4. NOTHING IS DIFFERENTIALLY EXPRESSED — every true shift is zero");
L(rule());
L(`
   The only thing separating the loud pathway from the other seven is that its
   genes are NOISIER. 500 seeds, top-${CUT} list, ORA at ${ALPHA}.
`);
L("     loud genes' noise |  called significant by  |  by signed");
L("     (x a normal gene) |  ranking on FOLD CHANGE |  significance");
L("   " + "-".repeat(64));
for (const sd of [1.0, 1.4, 2.0, 2.6, 3.2]) {
  let f = 0, s2 = 0;
  const SEEDS = 500;
  const spec = { loud: { mu: 0, sd }, quiet: { mu: 0, sd: 0.5 }, down: { mu: 0, sd: 1 } };
  for (let s = 1; s <= SEEDS; s += 1) {
    if (found(makeStage(makeRng(s), { metric: "fc", spec }), "loud")) f += 1;
    if (found(makeStage(makeRng(s), { metric: "sig", spec }), "loud")) s2 += 1;
  }
  const tag = sd === 1.0 ? "   <- no difference at all" : "";
  L(`          ${sd.toFixed(1)}x         |          ${pc(f, SEEDS).padStart(4)}          |     ${pc(s2, SEEDS).padStart(4)}${tag}`);
}
L(`
   THE FIRST ROW IS THE CONTROL: with the pathway no noisier than the rest,
   both metrics sit at or under the nominal ${ALPHA}. Then, with the true
   difference held at exactly zero, ranking on fold change calls the pathway
   significant 25% -> 63% -> 81% -> 89% of the time as its genes get noisier,
   while signed significance stays flat at 2%. Dividing by the estimated
   standard deviation is precisely what removes this, and it is the reason a
   ranking on raw fold change is usually filtered on a p-value as well.`);


/* --- 5. what the change costs the claims already made ---------------------- */

L(`
${rule()}`);
L("5. WHAT §§ 4-7 OF enr-measure.mjs WOULD HAVE TO BE RE-MEASURED AS");
L(rule());
L("");
const CUTOFFS = [10, 20, 40, 60, 80, 100, 150, 200];
{
  const SEEDS = 300;
  const out = {};
  for (const metric of ["fc", "sig"]) {
    let dl = 0, dq = 0, down = 0, lost = 0;
    const sig = [], adj = [];
    for (let s = 1; s <= SEEDS; s += 1) {
      const st = makeStage(makeRng(s), { metric });
      const v = (k) => CUTOFFS.map((c) => ora(st, idx(st, k), c, UNIVERSE).p < ALPHA);
      if (new Set(v("loud")).size > 1) dl += 1;
      if (new Set(v("quiet")).size > 1) dq += 1;
      if (v("down").some(Boolean)) down += 1;
      const all = oraAll(st, CUT, UNIVERSE);
      sig.push(all.filter((r) => r.p < ALPHA).length);
      adj.push(all.filter((r) => r.padj < ALPHA).length);
      if (all.some((r) => r.planted && r.p < ALPHA && r.padj >= ALPHA)) lost += 1;
    }
    out[metric] = {
      dl: pc(dl, SEEDS), dq: pc(dq, SEEDS), down: pc(down, SEEDS),
      sig: med(sig), adj: med(adj), lost: pc(lost, SEEDS),
    };
  }
  L("                                                    fold change   signed signif.");
  L("   " + "-".repeat(74));
  const row = (label, k) => L(`   ${label.padEnd(47)}   ${String(out.fc[k]).padStart(9)}   ${String(out.sig[k]).padStart(13)}`);
  row("the eight cutoffs disagree, LOUD pathway", "dl");
  row("the eight cutoffs disagree, QUIET pathway", "dq");
  row("ORA ever sees the DOWN-regulated pathway", "down");
  row("median pathways significant, raw", "sig");
  row("median pathways significant, after BH", "adj");
  row("BH costs a real finding", "lost");
}
L(`
   THE ONE CLAIM THAT SURVIVES UNTOUCHED is the best one: ORA on a top-k list
   never sees a coordinately down-regulated set, 0% under both metrics. It was
   always structural rather than a property of the stage.

   EVERY RATE MOVES, and one of them moves the widget's defaults: the shipped
   default seed 12 was picked for a collection with two pathways significant and
   one surviving BH. That is still the median under signed significance and is
   1 -> 1 under fold change, so a default metric has to be chosen first and the
   default seed re-picked after it.`);
