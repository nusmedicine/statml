/* ============================================================================
   The engine behind `enrichment` — PHM5003 05/09 Enrichment Analysis.

   The data and the two tests; `main.js` is the figure. `_lab/enr-measure.mjs`
   and `_lab/enr-shape.html` import this same module, so there is ONE Fisher's
   test and ONE running sum in the project rather than a node copy and a
   browser copy drifting apart.

   WHAT THE MEASUREMENT SETTLED, before anything was drawn
   (`node widgets/_lab/enr-measure.mjs`, six sections):

     - The BACKGROUND moves ORA's verdict by twenty orders of magnitude with
       the data held fixed, and it moves it the counter-intuitive way: a bigger
       background makes the same overlap MORE significant, so the loosest
       universe is also the most flattering one.
     - The CUTOFF claim is only true in a band. At a strong effect every cutoff
       finds the set and there is nothing to show; at a shift of 0.4-0.8 the
       eight cutoffs disagree with each other on 48-78% of seeds. That is why
       `moderate` is the default effect.
     - ORA on a top-of-the-ranking list NEVER sees a coordinately DOWN-regulated
       set - 0% at every effect size and every cutoff. The fix a reader proposes
       within a minute (take the most changed in either direction) rescues it
       only to 5-13% and costs the up-regulated set most of its power, 95% ->
       20%. GSEA finds both at 95-100% and has no cutoff to choose.

   Nothing here draws. Everything is seeded.
   ========================================================================= */

import { lgamma, tTailP } from "../core/stats.js";

/* --- Fisher's exact test --------------------------------------------------- */

const lchoose = (n, k) => lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1);

/* P(overlap = x) under the null, given the margins: the list is `listN`, the
   set is `setN`, the universe is `n`. This is the hypergeometric, and it is
   the whole of ORA — Fisher's exact test on a 2 x 2 with fixed margins IS the
   hypergeometric, which is worth saying on screen because it makes `d` visible
   as a thing that was chosen. */
export function hyperProb(x, listN, setN, n) {
  return Math.exp(lchoose(setN, x) + lchoose(n - setN, listN - x) - lchoose(n, listN));
}

/* R's fisher.test(alternative = "two.sided"): the total probability of every
   table no more likely than the observed one. The 1e-7 relative slack is R's
   own — without it a table exactly as likely as the observed one drops out of
   the sum on a last-bit rounding difference. */
export function fisherTwoSided(a, b, c, d) {
  const listN = a + b, setN = a + c, n = a + b + c + d;
  const lo = Math.max(0, listN + setN - n), hi = Math.min(listN, setN);
  const pObs = hyperProb(a, listN, setN, n);
  let p = 0;
  for (let x = lo; x <= hi; x += 1) {
    const px = hyperProb(x, listN, setN, n);
    if (px <= pObs * (1 + 1e-7)) p += px;
  }
  return Math.min(1, p);
}

/* The one-sided p ORA actually asks for: overrepresentation, P(X >= a). Every
   enrichment tool reports this one; the lesson's cell 3 calls the two-sided
   test, which is a different question and a larger number. */
export function fisherGreater(a, b, c, d) {
  const listN = a + b, setN = a + c, n = a + b + c + d;
  const hi = Math.min(listN, setN);
  let p = 0;
  for (let x = a; x <= hi; x += 1) p += hyperProb(x, listN, setN, n);
  return Math.min(1, p);
}

/* R reports the CONDITIONAL MLE of the odds ratio, not ad/bc — in a sparse
   table they are far apart (ad/bc = 19992 where R prints 2345). Kept because a
   session comparing against the lesson's printed output needs the same
   estimator to compare with. See enr-measure.mjs § 1 for why R's own printed
   value is not the root of this equation. */
export function oddsRatioCmle(a, b, c, d) {
  const listN = a + b, setN = a + c, n = a + b + c + d;
  const lo = Math.max(0, listN + setN - n), hi = Math.min(listN, setN);
  if (a === lo) return 0;
  if (a === hi) return Infinity;
  const lw = [];
  for (let x = lo; x <= hi; x += 1) lw.push(lchoose(setN, x) + lchoose(n - setN, listN - x));
  const expect = (logPsi) => {
    const t = lw.map((w, i) => w + (lo + i) * logPsi);
    let m = -Infinity;
    for (const v of t) m = Math.max(m, v);
    let s = 0, sx = 0;
    t.forEach((v, i) => { const e = Math.exp(v - m); s += e; sx += e * (lo + i); });
    return sx / s;
  };
  let loL = -30, hiL = 30;
  for (let i = 0; i < 120; i += 1) {
    const mid = (loL + hiL) / 2;
    if (expect(mid) < a) loL = mid; else hiL = mid;
  }
  return Math.exp((loL + hiL) / 2);
}

/* --- the stage ------------------------------------------------------------- */

/* ONE RANKED LIST AND A COLLECTION OF PATHWAYS, which is what enrichment
   analysis is actually run on. The widget tested three named sets until
   multiple test correction arrived on the ORA tab, and correcting one p-value
   is what the notebook's own cell 5 does — it says so itself, "in this case,
   no correction as there is only one p-value". A collection is the smallest
   stage on which the correction is not a no-op.

   EIGHT, MEASURED. From five pathways to twenty the median is the same — two
   significant before correcting and one after — so the number does not decide
   whether the panel has anything in it. What it decides is how often the
   correction costs a REAL finding: 26% of seeds at five, 37% at eight, 54% at
   twenty. Eight is where that is common enough to meet and few enough to read
   as a table of named rows rather than a row of anonymous bars.

   THE UNPLANTED PATHWAYS ARE NOT PURE NULLS, and that is deliberate rather
   than sloppy: they overlap the planted ones by chance, so a few come out
   mildly enriched. That is exactly the population BH exists to handle.

   A PLANTED PATHWAY IS ALSO BIGGER than an unplanted one, 28-45 against 12-45.
   Not to flatter the method: a 14-gene pathway at this effect size is
   under-powered, so small planted pathways make the panel a coin toss rather
   than a lesson. */
export const N_SETS = 8;
const SIZE_MIN = 12;
const SIZE_MAX = 45;
const PLANTED_MIN = 28;

/* AN EXPERIMENT RATHER THAN ONE NUMBER PER GENE, and that is the whole reason
   this file changed. The stage used to draw `mu + rng.normal()` and stop, which
   gives every gene a single score — and every ranking metric over a single
   score is the SAME ORDER. A metric control on that stage would have been a
   control that does nothing.

   So each gene is measured in `SAMPLES_PER_ARM` samples per arm, and from those
   comes a fold change AND a t-test p. Two numbers, two orders, a real choice.

   FOUR PER ARM is a plausible omics experiment, and it also keeps a typical
   gene's noise where the old stage had it: the fold change of a gene with unit
   variance has SE sqrt(2/4) = 0.71 against the old draw's 1.0. Measured in
   `_lab/enr-metric.mjs` § 1, the number of samples barely moves the metrics'
   disagreement — 21 genes of 60 swap at four per arm and 18 at ten — so it is
   fixed rather than offered as a control nobody would learn anything from. */
export const SAMPLES_PER_ARM = 4;

/* GENE-LEVEL VARIANCE, WITHOUT WHICH THE TWO METRICS HAVE NO READING. Measured:
   with one variance for every gene the two orders still disagree about 12 genes
   of a top-60 list, but the genes each metric prefers have IDENTICAL mean noise,
   1.00 against 1.00 — sampling error in the pooled SD and nothing a reader
   could name. At this spread fold change's exclusive picks are 2.7x noisier
   than signed significance's, which is the distinction the tab is for.
   `_lab/enr-metric.mjs` § 1. Log-normal because expression variance is. */
const SIGMA_LOG = 0.35;

/* TWO KINDS OF PLANTED PATHWAY, AND THE MEASUREMENT THAT FORCED THEM.

   The first design kept the old constant shift and just added the metric. It
   was measured and DISCARDED: on a stage where every gene of a pathway moves
   by the same amount regardless of its own noise, signed significance is
   simply better — 86% against 92% at moderate noise spread, 65% against 98%
   at high — because a constant shift is exactly the alternative a t-test is
   built to detect. A student would have correctly concluded "use the p-value",
   and the arc's claim that the choices MOVE rather than disappear would have
   been false on the figure. `_lab/enr-metric.mjs` § 2.

   So a pathway is loud or quiet, and each metric wins on one:

     loud  — a big average change in genes that are noisy anyway. Fold change
             finds it on 100% of seeds, signed significance on 57%.
     quiet — a small change in genes held tightly. Signed significance finds it
             on 88% of seeds; fold change on 0%, and that is structural rather
             than tuned — the list is the top k BY MAGNITUDE, and a small change
             is small however many times it repeats.

   Neither metric is wrong about either pathway. They answer different
   questions — is it real, is it big — and which one is wanted is not in the
   data. `_lab/enr-metric.mjs` § 3.

   THE DOWN-REGULATED ONE is what § 6 of `enr-measure.mjs` needs: ORA on a
   top-k list never sees it, 0% under BOTH metrics. That claim was always
   structural and it survived this rebuild untouched. */
export const KINDS = {
  loud: { mu: 0.8, sd: 2.0 },
  quiet: { mu: 0.3, sd: 0.5 },
  down: { mu: -0.6, sd: 1.0 },
};

/* THE TWO METRICS THE LESSON ITSELF NAMES: it ranks on log2 fold change in
   cell 9 and names -log10(p) x sign(logFC) in cell 6. Both are one signed
   number per gene, which is all ORA's cutoff and the running sum need — so the
   choice is invisible in the code and changes the answer, which is the same
   shape as the background and the cutoff on the other tab. */
export const METRICS = {
  fc: {
    label: "Fold change",
    detail: "how big the change is — the gap between the two arms of four",
  },
  sig: {
    label: "Signed significance",
    detail: "how sure it is — a t-test on those same eight values, signed",
  },
};

/* `metric` picks which of the two orders the stage is ranked in, and it is
   applied AFTER every draw. Both metrics therefore describe the same
   experiment: switching the control changes the question asked of the data,
   never the data. */
export function makeStage(rng, { genes = 400, scale = 1, metric = "fc" } = {}) {
  const all = [...Array(genes).keys()];

  /* Which pathways carry real signal, drawn before the members so the stream is
     consumed in a fixed order whatever the sizes turn out to be. Seeded rather
     than fixed: fixed indices would teach "pathway 1 is always the answer", and
     seeded ones leave the reader where a real analysis leaves them, reading the
     results to find out. */
  const order = rng.shuffle([...Array(N_SETS).keys()]);
  const kindOf = { [order[0]]: "loud", [order[1]]: "quiet", [order[2]]: "down" };

  const sets = [];
  for (let i = 0; i < N_SETS; i += 1) {
    const planted = kindOf[i] ?? null;
    const lo = planted ? PLANTED_MIN : SIZE_MIN;
    const size = lo + Math.floor(rng.next() * (SIZE_MAX - lo + 1));
    sets.push({
      index: i,
      label: `Pathway ${i + 1}`,
      members: new Set(rng.shuffle(all).slice(0, size)),
      size,
      planted,
    });
  }

  const n = SAMPLES_PER_ARM;
  const df = 2 * n - 2;
  const logFC = new Array(genes);
  const pVal = new Array(genes);
  const geneSd = new Array(genes);

  for (let g = 0; g < genes; g += 1) {
    /* A gene in several planted pathways ACCUMULATES their shifts, and one in
       both an up and a down pathway nets to zero rather than taking whichever
       was applied last — "up and down at once" has no honest reading other
       than no effect. Two pathways of thirty out of four hundred share about
       two genes, so this is a handful either way.

       ITS NOISE TAKES THE LOUDER OF THE TWO, not the sum and not the last one:
       a gene cannot be tightly controlled and wildly variable at once, and the
       noisy regime is the one that governs what you actually measure. */
    let mu = 0;
    let sdMul = null;
    for (const s of sets) {
      if (!s.planted || !s.members.has(g)) continue;
      mu += KINDS[s.planted].mu * scale;
      sdMul = sdMul === null ? KINDS[s.planted].sd : Math.max(sdMul, KINDS[s.planted].sd);
    }
    const sdG = (sdMul ?? 1) * Math.exp(SIGMA_LOG * rng.normal());

    const A = new Array(n);
    const B = new Array(n);
    for (let k = 0; k < n; k += 1) A[k] = rng.normal(0, sdG);
    for (let k = 0; k < n; k += 1) B[k] = rng.normal(mu, sdG);
    const mA = A.reduce((u, v) => u + v, 0) / n;
    const mB = B.reduce((u, v) => u + v, 0) / n;
    const vA = A.reduce((u, v) => u + (v - mA) ** 2, 0) / (n - 1);
    const vB = B.reduce((u, v) => u + (v - mB) ** 2, 0) / (n - 1);
    const pooled = Math.sqrt((vA + vB) / 2);

    logFC[g] = mB - mA;
    /* Floored rather than allowed to reach zero: -log10(0) is Infinity, which
       would sort to the top and print as one. Four samples per arm cannot
       produce a p anywhere near this, so the floor is a guard, never a value. */
    pVal[g] = Math.max(1e-300, tTailP(Math.abs(logFC[g] / (pooled * Math.sqrt(2 / n))), df));
    geneSd[g] = sdG;
  }

  const signed = pVal.map((p, g) => -Math.log10(p) * Math.sign(logFC[g]));
  const score = metric === "sig" ? signed : logFC;
  const rank = [...Array(genes).keys()].sort((x, y) => score[y] - score[x]);
  const rankOf = new Array(genes);
  rank.forEach((g, i) => { rankOf[g] = i; });
  return { genes, scale, metric, n, logFC, pVal, signed, geneSd, score, rank, rankOf, sets };
}

/* --- ORA ------------------------------------------------------------------- */

/* WHICH GENES THE CUTOFF SELECTS. `top` is what the lesson does —
   `sort(gene_list, decreasing = TRUE)` and take the head. `both` is the fix a
   reader proposes within a minute of meeting the first one, and § 6 of the
   measurement says it makes ORA worse rather than better — which is why it is
   a control to try and not a correction applied quietly. */
export function listPositions(stage, k, mode = "top") {
  const n = Math.min(k, stage.genes);
  if (mode === "top") return stage.rank.slice(0, n);
  /* The most changed either way: walk in from both ends of the ranking at
     once, so the list is still exactly `k` long and the two modes compare. */
  const out = [];
  let lo = 0, hi = stage.genes - 1;
  while (out.length < n) {
    const gLo = stage.rank[lo], gHi = stage.rank[hi];
    if (Math.abs(stage.score[gLo]) >= Math.abs(stage.score[gHi])) { out.push(gLo); lo += 1; }
    else { out.push(gHi); hi -= 1; }
  }
  return out;
}

/* `universe` is the number the lesson writes as a bare 10000 with no comment,
   and it enters ONLY through d — which is exactly why it is invisible on a
   screen and exactly why it moves the answer. */
export function ora(stage, setIndex, k, universe, mode = "top") {
  const set = stage.sets[setIndex].members;
  const list = listPositions(stage, k, mode);
  const a = list.filter((g) => set.has(g)).length;
  const b = list.length - a;
  const c = set.size - a;
  const d = Math.max(0, universe - (a + b + c));
  return {
    a, b, c, d, universe, k: list.length,
    p: fisherGreater(a, b, c, d),
    pTwo: fisherTwoSided(a, b, c, d),
  };
}

/* --- GSEA ------------------------------------------------------------------ */

/* The weighted running sum. Up inside the set by the gene's own weight, down
   outside it by a flat step; the ES is the largest deviation from zero.
   No cutoff appears anywhere in it, which is the entire point of the pairing.

   `weight = 1` is GSEA's default (the classic `p` parameter). At weight 0 the
   statistic is the unweighted Kolmogorov-Smirnov one, where only membership
   counts and the metric's magnitude does not — worth having as a control,
   because it separates "near the top" from "large". */
export function gsea(stage, setIndex, weight = 1) {
  const { score, rank, genes } = stage;
  const set = stage.sets[setIndex].members;
  const ns = set.size;
  let norm = 0;
  for (const g of rank) if (set.has(g)) norm += Math.abs(score[g]) ** weight;
  const down = 1 / (genes - ns);
  const trace = new Array(genes);
  let run = 0, es = 0, esAt = 0;
  for (let i = 0; i < genes; i += 1) {
    const g = rank[i];
    run += set.has(g) ? Math.abs(score[g]) ** weight / norm : -down;
    trace[i] = run;
    if (Math.abs(run) > Math.abs(es)) { es = run; esAt = i + 1; }
  }
  return { es, esAt, trace };
}

/* The null a widget can actually run: permute WHICH genes are in the set and
   hold the ranking still. The real thing permutes sample labels and re-ranks —
   which needs the expression matrix, and preserves the correlation between
   genes that gene permutation destroys. The notebook's own step 3 says
   "permuting the labels of the dataset", so the widget owes that difference a
   line on screen rather than a silent substitution. */
export function gseaNull(stage, setIndex, rng, runs = 1000, weight = 1) {
  const obs = gsea(stage, setIndex, weight).es;
  const all = [...Array(stage.genes).keys()];
  const size = stage.sets[setIndex].size;
  const draws = new Array(runs);
  let ge = 0;
  for (let r = 0; r < runs; r += 1) {
    /* `esOnly` rather than `gsea`: a thousand permutations through the full
       version allocate a thousand traces nobody reads, and that is the whole
       of the cost. */
    const es = esOnly(stage, new Set(rng.shuffle(all).slice(0, size)), weight);
    draws[r] = es;
    if (obs >= 0 ? es >= obs : es <= obs) ge += 1;
  }
  return { obs, draws, p: (ge + 1) / (runs + 1), runs };
}

/* The same walk as `gsea`, keeping only the peak. Deliberately adjacent to it:
   two copies of one running sum is how a figure and its p-value come to
   disagree, so if either changes the other must, and next door is the only
   place that is hard to miss. */
function esOnly(stage, set, weight) {
  const { score, rank, genes } = stage;
  let norm = 0;
  for (const g of rank) if (set.has(g)) norm += Math.abs(score[g]) ** weight;
  const down = 1 / (genes - set.size);
  let run = 0, es = 0;
  for (let i = 0; i < genes; i += 1) {
    const g = rank[i];
    run += set.has(g) ? Math.abs(score[g]) ** weight / norm : -down;
    if (Math.abs(run) > Math.abs(es)) es = run;
  }
  return es;
}

/* --- the normalised score, and every pathway at once ----------------------- */

/* AN ES IS NOT COMPARABLE ACROSS PATHWAYS, which is why a results table cannot
   simply print one. Measured on this stage with NOTHING planted, the mean
   |ES| of a random set runs 0.379 at twelve genes down to 0.227 at a hundred
   and fifty — 1.7x apart on size alone, and still 1.36x over the 12-45 range
   this stage actually uses. A reader comparing that column would be reading
   set size.

   GSEA's answer is to divide by the mean of the null scores on the SAME SIDE
   of zero, so a set is judged against sets of its own size AND direction.

   IT IS NOT A FORMALITY HERE. Over 40 seeds the eight rows come out in a
   different order under NES on 90% of them, and the top row changes on 18%.
   The first seed checked was one of the 10% where nothing moved, which is
   exactly how a normalisation gets dismissed as pointless. */
export function normalisedScore(obs, draws) {
  const same = draws.filter((d) => (obs >= 0 ? d > 0 : d < 0));
  if (!same.length) return NaN;
  let sum = 0;
  for (const d of same) sum += d;
  return obs / Math.abs(sum / same.length);
}

/* EVERY PATHWAY SCORED, NORMALISED AND CORRECTED — the shape `gseGO` returns
   and cell 11 of the notebook prints with `head(gsea_result@result)`. Cell 10
   passes `pAdjustMethod = "BH"`, so a real GSEA result IS corrected; a widget
   that only ever shows one pathway's permutation p leaves a student thinking
   the correction is ORA's problem alone.

   THE TRACE IS DELIBERATELY NOT KEPT. Eight walks of four hundred genes is
   eight arrays nobody reads — the figure draws the selected pathway's trace,
   which `main.js` gets from `gsea` directly. The DRAWS are kept, because the
   histogram needs them for whichever pathway is selected and the selection
   changes without recomputing. */
export function gseaAll(stage, rng, runs = 1000, weight = 1) {
  const rows = stage.sets.map((set) => {
    const nul = gseaNull(stage, set.index, rng, runs, weight);
    const g = gsea(stage, set.index, weight);
    return {
      index: set.index,
      label: set.label,
      size: set.size,
      planted: set.planted,
      es: g.es,
      esAt: g.esAt,
      nes: normalisedScore(nul.obs, nul.draws),
      obs: nul.obs,
      draws: nul.draws,
      p: nul.p,
      runs: nul.runs,
    };
  });
  const padj = benjaminiHochberg(rows.map((r) => r.p));
  rows.forEach((r, i) => { r.padj = padj[i]; });
  return rows;
}

/* --- every pathway at once, and the correction that needs ------------------ */

/* ORA OVER THE WHOLE COLLECTION. This is the shape enrichment analysis is
   actually run in, and the shape cell 5 cannot demonstrate: `p.adjust` on a
   vector of length one is the identity function, and the notebook says so. */
export function oraAll(stage, k, universe, mode = "top") {
  const raw = stage.sets.map((set) => ora(stage, set.index, k, universe, mode));
  const padj = benjaminiHochberg(raw.map((r) => r.p));
  return raw.map((r, i) => ({
    ...r,
    index: i,
    label: stage.sets[i].label,
    size: stage.sets[i].size,
    planted: stage.sets[i].planted,
    padj: padj[i],
  }));
}

/* Benjamini-Hochberg, matching R's `p.adjust(method = "BH")`: scale each p by
   n / its rank, then take the running minimum from the LARGEST p downwards so
   the adjusted values cannot decrease where the raw ones increase. Without
   that second pass a pathway can come out with a smaller adjusted p than one
   that beat it on the raw value, which is the classic wrong implementation and
   is invisible until two of them straddle 0.05. */
export function benjaminiHochberg(p) {
  const n = p.length;
  if (n === 0) return [];
  const desc = [...Array(n).keys()].sort((a, b) => p[b] - p[a]);
  const out = new Array(n);
  let running = Infinity;
  desc.forEach((idx, j) => {
    const rank = n - j;                    /* 1-based rank in ASCENDING order */
    running = Math.min(running, (p[idx] * n) / rank);
    out[idx] = Math.min(1, running);
  });
  return out;
}

/* --- two-circle geometry, for the Venn ------------------------------------- */

/* The lens area of two overlapping circles, and its inverse. `main.js` draws a
   Venn whose two AREAS are the two gene counts and whose overlap area is
   exactly the overlap count, which needs `solveD` to find the distance between
   the centres that produces a given lens. The alternative — two circles of a
   fixed size with the numbers written in — draws the same picture whether nine
   genes overlap or ninety, which is the one thing that figure is for.

   Here rather than in the figure so `_lab/enr-measure.mjs` § 9 can check that
   the inverse holds across every shape the widget can reach. */
const clampTo = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function lensArea(r1, r2, d) {
  if (d >= r1 + r2) return 0;
  if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2;
  const d1 = (d * d - r2 * r2 + r1 * r1) / (2 * d);
  const d2 = d - d1;
  return r1 * r1 * Math.acos(clampTo(d1 / r1, -1, 1)) - d1 * Math.sqrt(Math.max(0, r1 * r1 - d1 * d1))
    + r2 * r2 * Math.acos(clampTo(d2 / r2, -1, 1)) - d2 * Math.sqrt(Math.max(0, r2 * r2 - d2 * d2));
}

export function solveD(r1, r2, target) {
  if (target <= 0) return r1 + r2;
  if (target >= Math.PI * Math.min(r1, r2) ** 2) return Math.abs(r1 - r2);
  let lo = Math.abs(r1 - r2), hi = r1 + r2;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (lensArea(r1, r2, mid) > target) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/* --- what the rail offers -------------------------------------------------- */

/* ONE KNOB OVER BOTH PLANTED CHANGES, so the ladder moves the whole stage
   rather than one pathway of it. The numbers in each `detail` are the two
   changes themselves — `scale` times the 0.8 and 0.3 in `KINDS`.

   `moderate` is the default because it is where the two metrics separate most
   cleanly. Measured over 300 seeds, ORA at 0.05 on a top-60 list:

     scale     loud by FC / signif     quiet by FC / signif
     0.0        63%  /   2%             0%  /   2%
     0.4        90%  /  16%             0%  /  27%
     1.0       100%  /  57%             0%  /  88%
     1.7       100%  /  91%            11%  /  99%

   `strong` is the top of the ladder for the reason it always was: above it
   both metrics find both pathways and there is nothing left to choose between.
   `none` is the one worth pressing — every true change is zero there, and fold
   change still calls the noisy pathway significant on 63% of seeds. */
export const EFFECTS = {
  none: { label: "None", detail: "no pathway changes on average", scale: 0 },
  weak: { label: "Weak", detail: "changes of 0.32 and 0.12 — small for both metrics", scale: 0.4 },
  moderate: { label: "Moderate", detail: "changes of 0.8 and 0.3, where a real experiment lives", scale: 1 },
  strong: { label: "Strong", detail: "changes of 1.4 and 0.5, which both metrics find", scale: 1.7 },
};

/* THE BACKGROUND, as the numbers people type. Only the first is a fact about
   this figure; the rest are what gets reached for when the code asks for a
   universe and the experiment is not in front of you. */
export const BACKGROUNDS = {
  400: { label: "400", detail: "the genes on this figure — the only ones it measured" },
  2000: { label: "2 000", detail: "a targeted panel" },
  12000: { label: "12 000", detail: "genes detected in a typical experiment" },
  20000: { label: "20 000", detail: "the protein-coding genome" },
  60000: { label: "60 000", detail: "every annotated transcript" },
};
