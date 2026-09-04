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

import { lgamma } from "../core/stats.js";

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

   TWO OF THEM ARE PLANTED, at seeded positions rather than fixed ones. Fixed
   indices would teach "pathway 1 is always the answer"; seeded ones leave the
   reader where a real analysis leaves them, reading the panel to find out.
   The two are the lesson's own outer cases — cell 6's figure names enriched at
   the top, random, and enriched at the bottom — and the eighteen unplanted
   ones supply the middle case eighteen times over, which is what makes the
   correction worth doing.

   THE UNPLANTED PATHWAYS ARE NOT PURE NULLS, and that is deliberate rather
   than sloppy: they overlap the planted ones by chance, so a few come out
   mildly enriched. That is exactly the population BH exists to handle. */
export const N_SETS = 20;
const SIZE_MIN = 12;
const SIZE_MAX = 45;

/* TWO UP AND ONE DOWN, and the counts are measured rather than chosen. With one
   planted pathway the default state has a median of ONE raw-significant result
   and ZERO surviving BH, so the correction panel opens empty and demonstrates
   nothing. With two, the median is 2 raw and 1 corrected: a couple of bars over
   the 0.05 line, one of them still standing after the correction, and the rest
   of the collection where it belongs. Measured over 200 seeds at the defaults —
   `_lab/enr-measure.mjs` § 7.

   A PLANTED PATHWAY IS ALSO BIGGER than an unplanted one, 28-45 against 12-45.
   Not to flatter the method: a 14-gene pathway at a 0.6 shift is under-powered,
   so small planted pathways make the panel a coin toss rather than a lesson. */
const N_UP = 2;
const N_DOWN = 1;
const PLANTED_MIN = 28;

export function makeStage(rng, { genes = 400, shift = 0.6 } = {}) {
  const all = [...Array(genes).keys()];

  /* Which ones carry real signal, drawn before the members so the stream is
     consumed in a fixed order whatever the sizes turn out to be. */
  const order = rng.shuffle([...Array(N_SETS).keys()]);
  const upAt = order.slice(0, N_UP);
  const downAt = order.slice(N_UP, N_UP + N_DOWN);

  const sets = [];
  for (let i = 0; i < N_SETS; i += 1) {
    const planted = upAt.includes(i) ? "up" : downAt.includes(i) ? "down" : null;
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

  /* The ranking metric. The lesson ranks by log2 fold change (cell 9) and
     names -log10(p) x sign(logFC) as the alternative (cell 6); either way it
     is one signed number per gene, which is all the running sum needs.

     A gene in several planted pathways ACCUMULATES their shifts, and one in
     both an up and a down pathway nets to zero rather than taking whichever
     was applied last. Two pathways of thirty out of four hundred share about
     two genes, so this is a handful either way — but "up and down at once" has
     no honest reading other than no effect. */
  const score = [];
  for (let g = 0; g < genes; g += 1) {
    let mu = 0;
    for (const s of sets) {
      if (s.planted === "up" && s.members.has(g)) mu += shift;
      if (s.planted === "down" && s.members.has(g)) mu -= shift;
    }
    score.push(mu + rng.normal());
  }
  const rank = [...Array(genes).keys()].sort((x, y) => score[y] - score[x]);
  const rankOf = new Array(genes);
  rank.forEach((g, i) => { rankOf[g] = i; });
  return { genes, shift, score, rank, rankOf, sets, upAt, downAt };
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

/* --- what the rail offers -------------------------------------------------- */

/* `moderate` is the default because § 5 of the measurement says the cutoff
   claim is dead above it: at a shift of 1.6 every cutoff finds the set. */
export const EFFECTS = {
  none: { label: "None", detail: "no set differs from the rest", shift: 0 },
  weak: { label: "Weak", detail: "the planted sets shift by 0.4 of a standard deviation", shift: 0.4 },
  moderate: { label: "Moderate", detail: "a shift of 0.6 — where a real experiment lives", shift: 0.6 },
  strong: { label: "Strong", detail: "a shift of 1.0, which any method finds", shift: 1.0 },
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
