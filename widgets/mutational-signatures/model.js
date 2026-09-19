/* ============================================================================
   Widget 70 · Mutational Signatures — the engine, the stage and the copy.
   `main.js` draws them; `_lab/mutational-signatures-model.js` re-exports this
   file, so the measure and the mock run the widget's own code.

   PHM5003 07 / 01-4, end to end. Three pages, from Kenneth's picks of
   2026-09-18 and 2026-09-19 (catalogue § Slot 70):

     Catalogue    one tumor's substitutions into 96 types: as written, read
                  from the pyrimidine, and with the base on either side
     Signatures   the cohort's 96 × n matrix factorised as M ≈ S × W, then
                  each column of S drawn as a signature beside W, then each
                  signature opened out with its exposures
     Matching     each signature against ten reference profiles by cosine
                  similarity, the chosen one beside its best match and the
                  runner-up

   DECISIONS TAKEN WHILE BUILDING, so they are not re-argued:

    1. THE ENGINE IS NMF'S `brunet`, which `extractSignatures` runs: widget
       41's `updateKL` (H, then W — the KL multiplicative update) with brunet's
       floor at machine epsilon every ten iterations, on the counts plus
       pConstant = 0.1 in every cell, from one random start. Held to R's NMF
       0.28 from a fixed start on a synthetic matrix
       (`_lab/mutational-signatures-reference.tsv`, the verify's § 1).

    2. THE REFERENCES ARE LOOK-ALIKES, his pick 1. COSMIC's terms forbid its
       data on a public website without GRL's written consent, so each profile
       is built from its process's mechanism — which base changes, beside which
       neighbours — and not from COSMIC's numbers. The measure scores each
       against the real profile on a machine that has it (0.80 to 1.00); no
       COSMIC vector is in the repo.

    3. THE COHORT IS SIMULATED (the arc's pick 4), its counts fitted to the
       lesson's matrix, with ONE HYPERMUTATED TUMOR holding 7.1% of the
       mutations — TCGA-AN-A046's share of the lesson's — in by default and
       left out by a switch, his pick 3.

    4. PAGE 1'S TUMORS ARE PAGE 2'S, his pick 6: the largest of the other 100
       and the hypermutated one, so the catalogue built on page 1 is a column
       of page 2's M.

    5. THE PAGE AND PAGE 1'S TUMOR ARE DISPLAY PARAMETERS. A visit to another
       page, or another tumor on page 1, does not undo an extraction; another
       tumor starts page 1's own walk over, since that walk was about the
       other tumor.

    6. NO PLAY, widget 69's rule: every press is read. The arrival on page 1
       and the descent on page 2 play in full on their one press.

    7. THE COHORT, THE EXTRACTION AND PAGE 1'S TUMORS ARE CACHED by the
       parameters each reads, because core reruns `compute()` on a display
       change too and one extraction takes a few hundred milliseconds.
       `compute()` stays pure: every cache is keyed on what it reads.

    8. THE SIX CLASSES WEAR THE FIELD'S COLOURS (his pick 5), as six roles in
       `tokens.css`; the heatmaps take `--c-magnitude`'s violet ramp (his pick
       of round 1, over the draft's grey), so red means C>T only.
   ========================================================================= */

import { makeRng } from "../core/rng.js";
import { updateKL, cosine } from "../matrix-factorization/model.js";

export { cosine };

/* ---- the 96 types ------------------------------------------------------------ */

export const CLASSES = ["C>A", "C>G", "C>T", "T>A", "T>C", "T>G"];
export const BASES = ["A", "C", "G", "T"];
/* maftools' order (trinucleotideMatrix's `subtype.levels`): the class, then the
   5′ base, then the 3′ base. Type i is class ⌊i/16⌋, 5′ ⌊i/4⌋ mod 4, 3′ i mod 4. */
export const CHANNELS = CLASSES.flatMap((s) => BASES.flatMap((l) => BASES.map((r) => `${l}[${s}]${r}`)));
export const TRANSITIONS = new Set(["C>T", "T>C"]);

const COMP = { A: "T", C: "G", G: "C", T: "A" };
export const revcomp = (s) => [...s].reverse().map((b) => COMP[b]).join("");

/* A change as written on the reference strand, read from the pyrimidine of the
   pair: G>A in AGC is C>T in GCT. `tri` is the reference trinucleotide. */
export function channelOf(tri, ref, alt) {
  let t = tri, r = ref, a = alt, swapped = false;
  if (r === "G" || r === "A") { t = revcomp(tri); r = COMP[ref]; a = COMP[alt]; swapped = true; }
  const s = CLASSES.indexOf(`${r}>${a}`);
  return { index: 16 * s + 4 * BASES.indexOf(t[0]) + BASES.indexOf(t[2]), swapped, tri: t, change: `${r}>${a}` };
}

/* A MAF writes each change on the reference strand, so C>T and G>A are one
   event read from opposite strands; 41,398 of the lesson's 82,747 SNVs (50.0%)
   have a purine reference. */
export const PURINE_FORM = { "C>A": "G>T", "C>G": "G>C", "C>T": "G>A", "T>A": "A>T", "T>C": "A>G", "T>G": "A>C" };
export const WRITTEN = CLASSES.flatMap((s) => [s, PURINE_FORM[s]]);

export const sum = (v) => { let s = 0; for (const x of v) s += x; return s; };

/* ---- the look-alike references (decision 2) -----------------------------------
   Each profile is a recipe: the share of each substitution class, and within a
   class a weight for each 5′ and each 3′ base (multiplied), plus a small floor
   everywhere. Weights are listed A, C, G, T. `like` names the COSMIC signature
   each stands for, which the page prints; `scored` names the legacy and the v3
   profile the measure scores the resemblance against
   (`_lab/mutational-signatures-measure.txt` § 2). */
const U = [1, 1, 1, 1];
function recipe({ classes, left = {}, right = {}, floor = 0.0015 }) {
  const v = new Float64Array(96);
  CLASSES.forEach((s, k) => {
    const share = classes[s] ?? 0.01;
    const L = left[s] ?? U, R = right[s] ?? U;
    const Ls = sum(L), Rs = sum(R);
    for (let l = 0; l < 4; l += 1) for (let r = 0; r < 4; r += 1) v[16 * k + 4 * l + r] = share * (L[l] / Ls) * (R[r] / Rs);
  });
  for (let i = 0; i < 96; i += 1) v[i] += floor;
  const s = sum(v);
  return v.map((x) => x / s);
}

export const REFERENCES = [
  { key: "cpg", name: "Deamination at CpG", like: "SBS1", scored: ["COSMIC_1", "SBS1"],
    profile: recipe({ classes: { "C>T": 0.93, "T>C": 0.03, "C>A": 0.012, "C>G": 0.008, "T>A": 0.012, "T>G": 0.008 },
      left: { "C>T": [0.36, 0.2, 0.22, 0.12] }, right: { "C>T": [0.03, 0.015, 0.92, 0.035] }, floor: 0.0008 }) },
  { key: "clock", name: "Clock-like, flat", like: "SBS5", scored: ["COSMIC_5", "SBS5"],
    profile: recipe({ classes: { "C>A": 0.11, "C>G": 0.1, "C>T": 0.3, "T>A": 0.09, "T>C": 0.32, "T>G": 0.08 },
      left: { "T>C": [0.5, 0.15, 0.2, 0.15], "C>T": [0.32, 0.26, 0.2, 0.22], "C>A": [0.3, 0.28, 0.16, 0.26], "C>G": [0.28, 0.24, 0.18, 0.3],
        "T>A": [0.34, 0.22, 0.14, 0.3], "T>G": [0.3, 0.2, 0.2, 0.3] },
      right: { "T>C": [0.3, 0.2, 0.28, 0.22], "C>T": [0.3, 0.2, 0.3, 0.2], "C>A": [0.32, 0.22, 0.14, 0.32], "C>G": [0.3, 0.2, 0.14, 0.36],
        "T>A": [0.3, 0.24, 0.16, 0.3], "T>G": [0.26, 0.2, 0.3, 0.24] } }) },
  { key: "hr", name: "Recombination defect", like: "SBS3", scored: ["COSMIC_3", "SBS3"],
    profile: recipe({ classes: { "C>A": 0.18, "C>G": 0.2, "C>T": 0.17, "T>A": 0.16, "T>C": 0.18, "T>G": 0.11 },
      left: { "C>A": [0.2, 0.4, 0.12, 0.28], "C>G": [0.2, 0.3, 0.1, 0.4], "C>T": [0.22, 0.34, 0.14, 0.3], "T>A": [0.34, 0.26, 0.12, 0.28],
        "T>C": [0.36, 0.22, 0.2, 0.22], "T>G": [0.3, 0.2, 0.18, 0.32] },
      right: { "C>A": [0.3, 0.34, 0.1, 0.26], "C>G": [0.3, 0.22, 0.08, 0.4], "C>T": [0.26, 0.2, 0.16, 0.38], "T>A": [0.3, 0.2, 0.14, 0.36],
        "T>C": [0.3, 0.22, 0.24, 0.24], "T>G": [0.28, 0.2, 0.24, 0.28] } }) },
  { key: "flat", name: "Unknown, flat", like: "SBS40", scored: ["COSMIC_8", "SBS40"],
    profile: recipe({ classes: { "C>A": 0.24, "C>G": 0.13, "C>T": 0.22, "T>A": 0.12, "T>C": 0.15, "T>G": 0.14 },
      left: { "C>A": [0.34, 0.2, 0.1, 0.36], "C>G": [0.3, 0.2, 0.1, 0.4], "C>T": [0.26, 0.16, 0.12, 0.46], "T>A": [0.3, 0.3, 0.1, 0.3],
        "T>C": [0.4, 0.2, 0.16, 0.24], "T>G": [0.26, 0.14, 0.14, 0.46] },
      right: { "C>A": [0.44, 0.18, 0.08, 0.3], "C>G": [0.36, 0.14, 0.1, 0.4], "C>T": [0.44, 0.16, 0.14, 0.26], "T>A": [0.34, 0.2, 0.1, 0.36],
        "T>C": [0.3, 0.2, 0.22, 0.28], "T>G": [0.26, 0.14, 0.14, 0.46] } }) },
  { key: "apobecT", name: "APOBEC, C>T", like: "SBS2", scored: ["COSMIC_2", "SBS2"],
    profile: recipe({ classes: { "C>T": 0.98, "C>G": 0.005, "C>A": 0.005 }, left: { "C>T": [0.004, 0.006, 0.004, 0.986] },
      right: { "C>T": [0.54, 0.1, 0.05, 0.31] }, floor: 0.0003 }) },
  { key: "apobecG", name: "APOBEC, C>G", like: "SBS13", scored: ["COSMIC_13", "SBS13"],
    profile: recipe({ classes: { "C>G": 0.8, "C>A": 0.15, "C>T": 0.04 }, left: { "C>G": [0.01, 0.01, 0.01, 0.97], "C>A": [0.05, 0.05, 0.05, 0.85] },
      right: { "C>G": [0.42, 0.08, 0.04, 0.46], "C>A": [0.6, 0.1, 0.05, 0.25] }, floor: 0.0003 }) },
  { key: "mmr", name: "Mismatch repair defect", like: "SBS6", scored: ["COSMIC_6", "SBS6"],
    profile: recipe({ classes: { "C>T": 0.9, "T>C": 0.05, "C>A": 0.02, "T>A": 0.01, "T>G": 0.01, "C>G": 0.01 },
      left: { "C>T": [0.24, 0.24, 0.4, 0.12] }, right: { "C>T": [0.22, 0.2, 0.52, 0.06] }, floor: 0.0008 }) },
  { key: "pole", name: "Polymerase epsilon", like: "SBS10a and SBS10b", scored: ["COSMIC_10", "SBS10b"],
    profile: recipe({ classes: { "C>A": 0.33, "C>T": 0.5, "T>G": 0.08, "T>C": 0.04, "T>A": 0.03, "C>G": 0.02 },
      left: { "C>A": [0.08, 0.06, 0.06, 0.8], "C>T": [0.06, 0.05, 0.05, 0.84], "T>G": [0.1, 0.1, 0.1, 0.7] },
      right: { "C>A": [0.18, 0.04, 0.03, 0.75], "C>T": [0.14, 0.06, 0.6, 0.2], "T>G": [0.1, 0.1, 0.1, 0.7] }, floor: 0.0005 }) },
  { key: "tobacco", name: "Tobacco smoking", like: "SBS4", scored: ["COSMIC_4", "SBS4"],
    profile: recipe({ classes: { "C>A": 0.62, "T>A": 0.15, "C>T": 0.1, "C>G": 0.06, "T>C": 0.05, "T>G": 0.02 },
      left: { "C>A": [0.18, 0.48, 0.1, 0.24], "T>A": [0.2, 0.44, 0.12, 0.24] }, right: { "C>A": [0.34, 0.32, 0.04, 0.3] } }) },
  { key: "oxidative", name: "Reactive oxygen", like: "SBS18", scored: ["COSMIC_18", "SBS18"],
    profile: recipe({ classes: { "C>A": 0.7, "C>T": 0.14, "T>A": 0.05, "T>C": 0.05, "C>G": 0.04, "T>G": 0.02 },
      left: { "C>A": [0.14, 0.14, 0.34, 0.38] }, right: { "C>A": [0.46, 0.08, 0.04, 0.42] } }) },
];
export const REF = Object.fromEntries(REFERENCES.map((r) => [r.key, r]));

/** The references ranked by cosine similarity, as `compareSignatures` ranks them. */
export function matches(sig, refs = REFERENCES) {
  return refs.map((r) => ({ key: r.key, name: r.name, like: r.like, cos: cosine(sig, r.profile) })).sort((a, b) => b.cos - a.cos);
}

/* ---- the simulated cohort (decision 3) ------------------------------------------
   Counts are lognormal, fitted to the lesson's matrix (log-mean 3.838, sd 0.891
   over 968 tumors; median 42). Every tumor carries the two clock-like
   processes, and some carry APOBEC or the recombination defect; APOBEC gives
   its C>T and its C>G together, as the enzyme family does. */
export const PLANTED = [
  { key: "cpg", name: "deamination at CpG", from: ["cpg"], every: true, weight: () => 1 },
  { key: "clock", name: "clock-like", from: ["clock"], every: true, weight: () => 1.3 },
  { key: "apobec", name: "APOBEC", from: ["apobecT", "apobecG"], mix: [0.55, 0.45], share: 0.3, weight: (rng) => 1.5 + 3 * rng.next() },
  { key: "hr", name: "recombination defect", from: ["hr"], share: 0.25, weight: (rng) => 1 + 2.5 * rng.next() },
];
export function plantedProfile(p) {
  const v = new Float64Array(96);
  p.from.forEach((k, i) => { const w = p.mix ? p.mix[i] : 1; REF[k].profile.forEach((x, c) => { v[c] += w * x; }); });
  const s = sum(v);
  return v.map((x) => x / s);
}

/* A Poisson draw by inversion for small means and a rounded normal above 60,
   where the difference is invisible at the scale of one bar. */
export function poisson(rng, mu) {
  if (mu <= 0) return 0;
  if (mu > 60) return Math.max(0, Math.round(rng.normal(mu, Math.sqrt(mu))));
  let k = 0, p = Math.exp(-mu), s = p;
  const u = rng.next();
  while (u > s && k < 1000) { k += 1; p *= mu / k; s += p; }
  return k;
}

export const COUNT_LOGMEAN = 3.838, COUNT_LOGSD = 0.891;
export const TUMORS = 100;
/* TCGA-AN-A046 holds 5,841 of the lesson's 82,747 SNVs. */
export const LESSON_HYPER_SHARE = 5841 / 82747;

/* `hyper` is the hypermutated tumor's share of the cohort's mutations, 0 for
   none. Its profile is the polymerase epsilon look-alike with a little of the
   two clock-like processes, as a hypermutated tumor still ages. */
export function makeCohort(rng, { tumours = TUMORS, hyper = 0, hyperProfile = "pole", logsd = COUNT_LOGSD } = {}) {
  const profiles = PLANTED.map(plantedProfile);
  const M = Array.from({ length: 96 }, () => new Float64Array(tumours + (hyper ? 1 : 0)));
  const expo = [];
  const counts = [];
  for (let j = 0; j < tumours; j += 1) {
    const n = Math.max(2, Math.round(Math.exp(rng.normal(COUNT_LOGMEAN, logsd))));
    const w = PLANTED.map((p) => (p.every || rng.next() < p.share ? p.weight(rng) * (0.5 + rng.next()) : 0));
    const ws = sum(w);
    const e = w.map((x) => (n * x) / ws);
    expo.push(e);
    const lam = new Float64Array(96);
    e.forEach((m, k) => profiles[k].forEach((x, c) => { lam[c] += m * x; }));
    let tot = 0;
    for (let c = 0; c < 96; c += 1) { M[c][j] = poisson(rng, lam[c]); tot += M[c][j]; }
    counts.push(tot);
  }
  if (hyper) {
    const j = tumours;
    const prof = REF[hyperProfile].profile;
    const clockMix = plantedProfile(PLANTED[0]).map((x, c) => 0.5 * x + 0.5 * plantedProfile(PLANTED[1])[c]);
    const n = (hyper / (1 - hyper)) * sum(counts);
    let tot = 0;
    for (let c = 0; c < 96; c += 1) { M[c][j] = poisson(rng, n * (0.92 * prof[c] + 0.08 * clockMix[c])); tot += M[c][j]; }
    counts.push(tot);
    expo.push(null);
  }
  return { M, profiles, expo, counts, hyperIndex: hyper ? tumours : -1 };
}

/* ---- the extraction (decision 1) --------------------------------------------- */

export const P_CONSTANT = 0.1;                     // extractSignatures(pConstant = 0.1)
export const EPS = 2.220446049250313e-16;          // .Machine$double.eps, brunet's floor
/* The stopping rule is this widget's own (NMF's brunet stops on a stable
   clustering of the columns). Measured over seeds 1–10 at rank 4
   (2026-09-19): 1e-7, 3e-7 and 1e-6 give the same answers — the hypermutated
   tumor's own signature in 9 of 10, the flat signature named after its smaller
   builder in 4 of 10 — and 1e-6 takes 226 ms on average against 295. */
export const TOL = 1e-6;                           // the divergence moves less than this of itself over ten iterations
export const MAX_ITER = 2000;
/* Snapshots of the descent for page 2's press, dense early: multiplicative
   updates move most of the way in the first few dozen iterations (widget 41's
   SCHEDULE says the same). The final iteration is added to whatever runs. */
export const SCHEDULE = [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987, 1597, 2584];

/** NMF's brunet, one iteration: H then W, and every tenth iteration a floor at
    machine epsilon, as `nmf_update.brunet` has it. `i` counts from 1. */
export function brunetStep(V, W, H, r, i) {
  updateKL(V, W, H, r);
  if (i % 10 === 0) {
    for (const row of W) for (let k = 0; k < r; k += 1) if (row[k] < EPS) row[k] = EPS;
    for (const row of H) for (let j = 0; j < row.length; j += 1) if (row[j] < EPS) row[j] = EPS;
  }
}

export function klDivergence(V, W, H) {
  const m = V.length, n = V[0].length, r = H.length;
  let d = 0;
  for (let i = 0; i < m; i += 1) for (let j = 0; j < n; j += 1) {
    let p = 0;
    for (let k = 0; k < r; k += 1) p += W[i][k] * H[k][j];
    const v = V[i][j];
    d += (v > 0 ? v * Math.log(v / p) : 0) - v + p;
  }
  return d;
}

/** Signatures scaled to sum to one, each exposure carrying the scale, so an
    exposure is in mutations — `extractSignatures`' normalisation. */
function scaled(W, H, r, order) {
  const sigs = [], expo = [];
  for (const k of order) {
    let s = 0;
    for (const row of W) s += row[k];
    sigs.push(Float64Array.from(W, (row) => row[k] / (s || 1)));
    expo.push(Float64Array.from(H[k], (h) => h * s));
  }
  return { sigs, expo };
}

/* M is 96 rows of counts, one column a tumor. The start is uniform on
   [0, mean) plus 1e-6, drawn W first and then H, row by row. */
export function extract(M, r, rng, { pConstant = P_CONSTANT, maxIter = MAX_ITER, tol = TOL, schedule = SCHEDULE } = {}) {
  const m = M.length, n = M[0].length;
  const V = M.map((row) => Float64Array.from(row, (x) => x + pConstant));
  let mean = 0;
  for (const row of V) for (const x of row) mean += x;
  mean /= m * n;
  const W = Array.from({ length: m }, () => Float64Array.from({ length: r }, () => rng.next() * mean + 1e-6));
  const H = Array.from({ length: r }, () => Float64Array.from({ length: n }, () => rng.next() * mean + 1e-6));
  const snaps = [];
  const snap = (iter) => snaps.push({ iter, W: W.map((row) => Float64Array.from(row)), H: H.map((row) => Float64Array.from(row)), kl: klDivergence(V, W, H) });
  if (schedule.includes(0)) snap(0);
  let last = Infinity, iter = 0;
  while (iter < maxIter) {
    iter += 1;
    brunetStep(V, W, H, r, iter);
    if (schedule.includes(iter)) snap(iter);
    if (iter % 10 === 0) {
      const d = klDivergence(V, W, H);
      if (Math.abs(last - d) < tol * d) break;
      last = d;
    }
  }
  if (!snaps.length || snaps[snaps.length - 1].iter !== iter) snap(iter);
  /* Ordered by the mutations each explains, largest first: NMF fixes no order
     (widget 41's `normalise` says why this code chooses one), and the order is
     the final one at every snapshot, so a column keeps its place as it forms. */
  const mass = Array.from({ length: r }, (_, k) => sum(W.map((row) => row[k])) * sum(H[k]));
  const order = [...mass.keys()].sort((a, b) => mass[b] - mass[a]);
  const final = scaled(W, H, r, order);
  const trace = snaps.map((s) => ({ iter: s.iter, kl: s.kl, ...scaled(s.W, s.H, r, order) }));
  return { signatures: final.sigs, exposures: final.expo, iterations: iter, kl: klDivergence(V, W, H), trace };
}

/** How concentrated a signature's exposure is: the largest tumor's share,
    and how many tumors it takes to reach half. */
export function holders(expoRow) {
  const t = sum(expoRow);
  const sorted = [...expoRow].map((x, j) => [x, j]).sort((a, b) => b[0] - a[0]);
  let acc = 0, half = 0;
  for (const [x] of sorted) { acc += x; half += 1; if (acc >= t / 2) break; }
  return { top: sorted[0][1], topShare: sorted[0][0] / t, half };
}

/* What built a signature, in the simulation's own terms: the non-negative mix
   of the given profiles closest to it (least squares, Lee and Seung's
   multiplicative update for a fixed basis), as shares summing to one. */
export function plantedMix(sig, profiles, iters = 2000) {
  const k = profiles.length;
  const AtA = Array.from({ length: k }, (_, a) => Array.from({ length: k }, (_, b) => profiles[a].reduce((s, x, i) => s + x * profiles[b][i], 0)));
  const Atb = profiles.map((p) => p.reduce((s, x, i) => s + x * sig[i], 0));
  const h = new Float64Array(k).fill(1 / k);
  for (let t = 0; t < iters; t += 1) {
    for (let a = 0; a < k; a += 1) {
      let d = 0;
      for (let b = 0; b < k; b += 1) d += AtA[a][b] * h[b];
      h[a] *= Atb[a] / (d || 1e-300);
    }
  }
  const s = sum(h);
  return Array.from(h, (x) => x / s);
}

/* ---- the caches (decision 7) ----------------------------------------------------- */

function remember(map, key, make, cap) {
  if (map.has(key)) return map.get(key);
  const value = make();
  if (map.size >= cap) map.delete(map.keys().next().value);
  map.set(key, value);
  return value;
}

const cohorts = new Map();
/** The cohort at a seed: 100 tumors and the hypermutated one as column 101. */
export function cohortFor(seed) {
  return remember(cohorts, seed, () => {
    const co = makeCohort(makeRng(seed), { tumours: TUMORS, hyper: LESSON_HYPER_SHARE });
    const ordinary = [...co.counts.keys()].filter((j) => j !== co.hyperIndex);
    const largest = ordinary.reduce((a, b) => (co.counts[b] > co.counts[a] ? b : a));
    const sorted = ordinary.map((j) => co.counts[j]).sort((a, b) => a - b);
    return { ...co, largest, median: sorted[sorted.length >> 1] };
  }, 6);
}

const fits = new Map();
/** The extraction at a seed, with the tumor in or left out, at a rank. */
export function fitFor(seed, hypermutated, rank) {
  return remember(fits, `${seed}|${hypermutated}|${rank}`, () => {
    const co = cohortFor(seed);
    const cols = hypermutated === "out" ? co.hyperIndex : co.hyperIndex + 1;
    const M = co.M.map((row) => row.slice(0, cols));
    const ex = extract(M, rank, makeRng(seed * 7919 + 1));
    /* What built each signature: the planted processes, and the polymerase
       epsilon profile the hypermutated tumor was drawn from while it is in. */
    const builders = hypermutated === "out" ? co.profiles : [...co.profiles, REF.pole.profile];
    const hyperCol = co.M.map((row) => row[co.hyperIndex]);
    const sigs = ex.signatures.map((s, k) => {
      const hold = holders(ex.exposures[k]);
      /* the tumors largest first, and each tumor's place in that order: the
         opened view's strip, and where the press's sort sends each bar */
      const sorted = [...ex.exposures[k].keys()].sort((a, b) => ex.exposures[k][b] - ex.exposures[k][a]);
      const place = new Int32Array(sorted.length);
      sorted.forEach((j, i) => { place[j] = i; });
      return {
        profile: s,
        exposure: ex.exposures[k],
        total: sum(ex.exposures[k]),
        sorted, place,
        hold,
        match: matches(s),
        mix: plantedMix(s, builders),
        own: hypermutated !== "out" && hold.top === co.hyperIndex && cosine(s, hyperCol) > 0.99,
      };
    });
    const fit = sum(sigs.map((s) => s.total));
    sigs.forEach((s) => { s.share = s.total / fit; });
    /* M's cells are coloured full at the 99th percentile of its counts, so one
       tumor's hundreds do not leave every other cell pale. */
    const flat = M.flatMap((row) => Array.from(row)).sort((a, b) => a - b);
    return {
      seed, hypermutated, rank, cols, M,
      cap: Math.max(1, flat[Math.floor(0.99 * (flat.length - 1))]),
      sigMax: Math.max(...ex.signatures.flatMap((s) => Array.from(s))),
      expoMax: Math.max(...ex.exposures.flatMap((e) => Array.from(e))),
      sigs,
      trace: ex.trace,
      iterations: ex.iterations,
      kl: ex.kl,
      total: sum(co.counts.slice(0, cols)),
    };
  }, 12);
}

const tumors = new Map();
/** Page 1's tumor: its mutations in the order they arrive, each written on one
    strand or the other at even odds, on a stream of its own. */
export function tumorFor(seed, which) {
  return remember(tumors, `${seed}|${which}`, () => {
    const co = cohortFor(seed);
    const index = which === "hypermutated" ? co.hyperIndex : co.largest;
    const counts = Float64Array.from(co.M, (row) => row[index]);
    const rng = makeRng(seed * 104729 + (which === "hypermutated" ? 2 : 1));
    const list = [];
    counts.forEach((c, ch) => { for (let k = 0; k < c; k += 1) list.push(ch); });
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng.next() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    const mutations = list.map((ch) => {
      const cls = CLASSES[ch >> 4];
      const purine = rng.next() < 0.5;
      return { ch, cls, purine, written: purine ? PURINE_FORM[cls] : cls };
    });
    const byClass = CLASSES.map((s) => ({ s, pyr: 0, pur: 0 }));
    for (const m of mutations) byClass[m.ch >> 4][m.purine ? "pur" : "pyr"] += 1;
    const classTotal = byClass.map((c) => c.pyr + c.pur);
    const n = mutations.length;
    return {
      which, index, n, counts, mutations, byClass,
      ti: (classTotal[2] + classTotal[4]) / n,
      yClass: niceMax(Math.max(...classTotal)),
      yChannel: niceMax(Math.max(...counts)),
      typesHit: counts.filter((c) => c > 0).length,
    };
  }, 8);
}

/** The written changes among the first `k` to arrive, in WRITTEN's order. */
export function writtenCounts(tumor, k = tumor.n) {
  const out = Object.fromEntries(WRITTEN.map((w) => [w, 0]));
  for (let i = 0; i < Math.min(k, tumor.n); i += 1) out[tumor.mutations[i].written] += 1;
  return out;
}

/* ---- the drives ---------------------------------------------------------------- */

/* Page 1: 0 empty, 1 the mutations as written, 2 read from the pyrimidine,
   3 split by the neighbouring bases. Page 2: 0 M alone, 1 extracted (cell 0's
   figure), 2 each signature drawn beside W, 3 each signature opened out with
   its exposures. Page 3: 0 nothing compared, 1 compared. */
export const CAT_STAGES = 3;
export const SIG_STAGES = 3;
export const MATCH_STAGES = 1;
export const LAND_MS = 1200;      // the mutations arrive over this long, whatever their number
export const FOLD_MS = 800;       // twelve bars fold into six
export const SPLIT_MS = 900;      // six bars split into 96
export const DESCENT_MS = 2400;   // the extraction's snapshots
export const COMPARE_MS = 500;    // the cosines arrive

/* THE TWO PRESSES THAT OPEN THE SIGNATURES (round 2, 2026-09-19; Kenneth's
   pick B of three, `_lab/mutational-signatures-round2-mock.html`). Round 1's
   press moved each column over the signatures already in place, which he
   found confusing, so the signatures now form in the space M leaves and the
   matrices keep theirs; the widening is a press of its own.

   "Show the signatures": M fades, then one column at a time, left to right,
   each column of S gathers itself in its own lane at its signature's row
   (squeezed to a short strip, so it turns in a small space), turns a quarter
   anticlockwise about its T>G end into the free space left of S, slides left
   along its own row, and its 96 cells stand up as bars in the class colours.
   The page rests there, the signatures beside W. No outline: one thing moves
   at a time, his pick over outlining it.

   "Show each signature's exposures": W's rows move down or up their own lane
   to their signatures' rows, then the signatures widen to the full width as
   each row of W widens under its signature, the row's cells standing up as
   bars in tumor order; then they sort, largest first, and the words arrive. */
export const JOURNEY_MS = 1200;      // one column: gather, turn, slide, stand
export const GATHER = 0.2, TURN = 0.45, SLIDE = 0.75;   // where each part of a journey ends
export const FADE_MS = 450;          // M and its labels leave
export const PRESS3 = { rows: 450, widen: 800, sort: 550, words: 300 };

/** Press 2's clock at a rank: the next column leaves S as the last one has
    turned, so one column is on its way out of S at a time. */
export function showTiming(rank) {
  const gap = TURN * JOURNEY_MS;
  return { gap, total: (rank - 1) * gap + JOURNEY_MS };
}
/** Press 3's clock, the same at every rank. */
export function openTiming() {
  const rows = PRESS3.rows, widen = rows + PRESS3.widen, sort = widen + PRESS3.sort;
  return { rows, widen, sort, total: sort + PRESS3.words };
}

const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)));

/** Where press 2 is `now` ms in: each column's journey, and how much of M and
    of S's frame is left. */
export function showAt(rank, now) {
  const T = showTiming(rank);
  const lastOut = (rank - 1) * T.gap;
  return {
    u: Array.from({ length: rank }, (_, k) => seg(now, k * T.gap, k * T.gap + JOURNEY_MS)),
    m: 1 - easeInOut(seg(now, 0, FADE_MS)),
    s: 1 - easeInOut(seg(now, lastOut, lastOut + TURN * JOURNEY_MS)),
    caption: easeInOut(seg(now, T.total - 0.15 * JOURNEY_MS, T.total)),
  };
}
/** Where press 3 is `now` ms in: W's rows in their lane, the widening, the
    sort and the words. */
export function openAt(now) {
  const T = openTiming();
  return {
    e: easeInOut(seg(now, 0, T.rows)),
    f: easeInOut(seg(now, T.rows, T.widen)),
    v: easeInOut(seg(now, T.widen, T.sort)),
    words: easeInOut(seg(now, T.sort, T.total)),
  };
}

/** The key the drive button's label is read at (STRINGS.stepLabels): the step
    the next press takes, or, once a page is done, the last one it took, so a
    finished page's disabled button names its last step. Page 3 extracts first
    when page 2 has not. */
export function labelStage(anim) {
  if (anim.page === "signatures") return `s${Math.min(SIG_STAGES - 1, anim.sig)}`;
  if (anim.page === "matching") return anim.sig === 0 ? "mX" : "m0";
  return `k${Math.min(CAT_STAGES - 1, anim.cat)}`;
}

export const easeInOut = (t) => {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2;
};
export const easeOut = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
/* Exact at both ends, (1 − t)a + tb rather than a + (b − a)t, which can miss b
   by a rounding at t = 1: a press must end on exactly the frame the next one
   starts on (the verify's seams). */
export const lerp = (a, b, t) => (1 - t) * a + t * b;
export const lerpRect = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t) });

/* ---- layout ---------------------------------------------------------------------- */

/* THE HEIGHT NEVER READS THE WIDTH (widget 62, 2026-09-16): a page whose height
   moved with the canvas between 535 and 770px never settled under the
   harness's scrollbar. Each page's height reads its rank at most. */
export const CAT_H = 372;
export const SIG_A_H = 430;       // cell 0's figure
export const SIG_ROW = 104;       // one signature opened out
export const MATCH_HEAD = 150;    // the references' names, set vertically
export const MATCH_ROW = 26;
export const BUILT_ROW = 15;

export function layout(w, params) {
  const rank = params.rank;
  if (params.page === "signatures") {
    const x0 = 44, right = w - 16;
    const sW = 12 * rank, wW = 120;
    const mW = right - x0 - 30 - sW - 26 - wW;
    const top = 58, rowH = 3;
    const heat = {
      top, rowH, base: top + 96 * rowH,
      M: { x: x0, w: mW },
      S: { x: x0 + mW + 30, w: sW },
      W: { x: right - wW, w: wW },
    };
    const rows = Array.from({ length: rank }, (_, k) => {
      const y = 40 + k * SIG_ROW;
      return { y, title: y + 12, profile: { top: y + 20, base: y + 56 }, stripLabel: y + 76, strip: { top: y + 82, base: y + 100 } };
    });
    return { page: "signatures", x0: 52, x1: w - 18, heat, rows, height: Math.max(SIG_A_H, 48 + rank * SIG_ROW) };
  }
  if (params.page === "matching") {
    const labelX = 96, cellX = 104, right = w - 16;
    const cellW = (right - cellX) / REFERENCES.length;
    const heatTop = MATCH_HEAD;
    const heatBase = heatTop + rank * MATCH_ROW;
    const builtTop = heatBase + 22;
    const bTop = builtTop + rank * BUILT_ROW + 20;
    return {
      page: "matching", x0: 52, x1: w - 18, labelX, cellX, cellW, heatTop, heatBase, builtTop,
      b: { top: bTop, own: { top: bTop + 22, base: bTop + 58 }, best: { label: bTop + 86, top: bTop + 94, base: bTop + 128 },
        runner: { label: bTop + 152, top: bTop + 160, base: bTop + 194 } },
      height: bTop + 226,
    };
  }
  const x0 = 56, x1 = w - 18;
  return { page: "catalogue", x0, x1, top: 64, base: 252, slot: (x1 - x0) / 6, height: CAT_H };
}
export const stageHeight = (w, values) => layout(w, values).height;

/* ---- the presses' geometry: one for cell 0's figure, both presses and the
   opened view (5.8), so each press starts on the last one's final frame and
   press 3 ends on the opened view ------------------------------------------------- */

export const TILE = 8;      // a column laid down, and a row slid under it, before the bars stand
export const W_ROW = 12;    // one row of W in cell 0's figure
/* THE FREE SPACE between the signatures and S. The signatures form in
   [x0, S.x − FREE], and a column is squeezed to GATHERED before it turns, so
   the whole of its turn stays in that space, 15px clear of them: the verify
   sweeps every moving strip against every finished signature. */
export const FREE = 90;
export const GATHERED = 80;

/** The top of W's first row in cell 0's figure: the rows centred on M's middle. */
export const wTop = (L, rank) => L.heat.top + 48 * L.heat.rowH - (rank * (W_ROW + 1)) / 2;
/** Where the signatures drawn beside W end: the free space left of S. */
export const shortRight = (L) => L.heat.S.x - FREE;

/** Column k of S in press 2, `u` of the way through its journey, and how far
    its cells have stood up as bars.

    The strip is given in its own frame, for `ctx.translate(px, py)` then
    `ctx.rotate(ang)`: y runs along it from -p·len (C>A) to (1 - p)·len and x
    across it, the bars standing on the edge x = -th/2, which faces down once
    it has turned. Here p = 1: THE PIVOT IS THE COLUMN'S T>G END, so a quarter
    turn anticlockwise lays it down to the LEFT of its own lane, over lanes the
    columns before it have already left, with C>A at the left as plotSignatures
    reads. Round 1 turned a full-length column about a point level with its
    row, and its sweep crossed the signatures already in place. */
export function column(L, rank, k, u) {
  const H = L.heat, R = L.rows[k];
  const gather = easeInOut(seg(u, 0, GATHER));
  const turn = easeInOut(seg(u, GATHER, TURN));
  const slide = easeInOut(seg(u, TURN, SLIDE));
  const stand = easeInOut(seg(u, SLIDE, 1));
  const sw = H.S.w / rank, th0 = sw - 1, len0 = 96 * H.rowH;
  const lane = H.S.x + k * sw + th0 / 2;
  const xc = shortRight(L);
  return {
    turn, stand,
    strip: {
      p: 1,
      px: lerp(lane, xc, slide),
      py: lerp(H.top + len0, R.profile.base - TILE / 2, gather),
      len: slide > 0 ? lerp(GATHERED, xc - L.x0, slide) : lerp(len0, GATHERED, gather),
      th: lerp(th0, TILE, turn),
      ang: (-Math.PI / 2) * turn,
    },
  };
}

/** Signature k in press 3, `f` of the way from beside W to the full width. */
export function widened(L, k, f) {
  const R = L.rows[k], xc = shortRight(L);
  return { p: 1, px: lerp(xc, L.x1, f), py: R.profile.base - TILE / 2, len: lerp(xc - L.x0, L.x1 - L.x0, f), th: TILE, ang: -Math.PI / 2 };
}

/** W's row k: in cell 0's figure, then `e` of the way down or up its own lane
    to its signature's row, then `f` of the way to the full width. */
export function wRow(L, rank, k, e, f) {
  const H = L.heat, R = L.rows[k];
  const home = { x: H.W.x, y: wTop(L, rank) + k * (W_ROW + 1), w: H.W.w, h: W_ROW };
  const lane = { x: H.W.x, y: R.strip.base - TILE, w: H.W.w, h: TILE };
  const wide = { x: L.x0, y: R.strip.base - TILE, w: L.x1 - L.x0, h: TILE };
  return f > 0 ? lerpRect(lane, wide, f) : lerpRect(home, lane, e);
}

/** S's cell i in the strip's own frame, standing `stand` of the way from a
    tile to a bar `barH` tall. Cells overlap by a hair while the strip moves as
    tiles, or their antialiased edges show the surface between them. */
export function stripCell(strip, i, moving, stand, barH) {
  const cell = strip.len / 96;
  const gap = stand * Math.min(1, cell * 0.25);
  return {
    x: -strip.th / 2, y: -strip.p * strip.len + i * cell + gap / 2,
    w: lerp(strip.th, barH, stand), h: cell - gap + (stand === 0 && moving ? 0.35 : 0),
  };
}

/** W's cell at column `slot` of its row (its column in M, or its place once
    sorted), standing `stand` of the way from a tile to a bar `barH` tall. At
    rest it is cell 0's figure's cell; stood and sorted, the opened view's bar. */
export function rowCell(row, n, slot, stand, barH) {
  const cw = row.w / n;
  const gap = 0.6 * stand;
  const h = lerp(row.h, barH, stand);
  return { x: row.x + slot * cw + gap / 2, y: row.y + row.h - h, w: stand > 0 ? Math.max(0.8, cw - gap) : Math.ceil(cw), h };
}

/* Page 1's bars, one geometry for the drawing and the verify (5.8). */
const Y = (L, v, yMax) => L.base - (v / yMax) * (L.base - L.top);
export function writtenRect(L, k, purine, v, yMax) {
  const bw = Math.min(26, L.slot * 0.3), cx = L.x0 + L.slot * (k + 0.5);
  const x = purine ? cx + 2 : cx - bw - 2;
  return { x, y: Y(L, v, yMax), w: bw, h: L.base - Y(L, v, yMax) };
}
export function foldedRect(L, k, purine, pyr, pur, yMax) {
  const bw = Math.min(26, L.slot * 0.3), fw = 2 * bw + 4, cx = L.x0 + L.slot * (k + 0.5);
  const lo = purine ? pyr : 0, hi = purine ? pyr + pur : pyr;
  return { x: cx - fw / 2, y: Y(L, hi, yMax), w: fw, h: Y(L, lo, yMax) - Y(L, hi, yMax) };
}
/* Where type `ch` sits inside its class's folded bar when the split starts: the
   sixteen types stacked in order, so the bar comes apart into its parts. */
export function stackedRect(L, ch, counts, yMax) {
  const k = ch >> 4;
  const bw = Math.min(26, L.slot * 0.3), fw = 2 * bw + 4, cx = L.x0 + L.slot * (k + 0.5);
  let below = 0;
  for (let c = 16 * k; c < ch; c += 1) below += counts[c];
  return { x: cx - fw / 2, y: Y(L, below + counts[ch], yMax), w: fw, h: Y(L, below, yMax) - Y(L, below + counts[ch], yMax) };
}
export function channelRect(L, ch, v, yMax) {
  const k = ch >> 4, inner = L.slot - 6, cw = inner / 16;
  const x = L.x0 + L.slot * k + 3 + (ch % 16) * cw;
  return { x: x + 0.5, y: Y(L, v, yMax), w: Math.max(1, cw - 1), h: L.base - Y(L, v, yMax) };
}

/* ---- numbers ---------------------------------------------------------------------- */

export function niceMax(m) {
  if (m <= 0) return 1;
  const e = 10 ** Math.floor(Math.log10(m));
  for (const k of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (k * e >= m) return k * e;
  return 10 * e;
}
export const n2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : "—");
export const n3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : "—");
export const cos3 = (x) => x.toFixed(3);
export const cell2 = (x) => x.toFixed(2).replace(/^0\./, ".");
export const intText = (x) => Math.round(x).toLocaleString("en-US");
export const pct = (x) => `${Math.round(100 * x)}%`;

/* ---- copy ------------------------------------------------------------------------- */

export const PAGES = [
  { value: "catalogue", label: "Catalogue" },
  { value: "signatures", label: "Signatures" },
  { value: "matching", label: "Matching" },
];
export const TUMOR_OPTIONS = [
  { value: "largest", label: "The largest" },
  { value: "hypermutated", label: "The hypermutated one" },
];
export const HYPER_OPTIONS = [
  { value: "in", label: "In" },
  { value: "out", label: "Left out" },
];
export const RANK_MIN = 2, RANK_MAX = 6, RANK_DEFAULT = 4;

/** The builders of a signature, the largest first: at most three, and none
    under 5%, so the line fits the narrowest canvas. */
export function builtText(mix) {
  const names = [...PLANTED.map((p) => p.name), "polymerase epsilon (tumor 101)"];
  return mix.map((x, k) => [names[k], x]).filter(([, x]) => x >= 0.05).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([n, x]) => `${pct(x)} ${n}`).join(", ");
}

export const STRINGS = {
  subtitle: "Each single-base substitution is counted as one of 96 types: the change read from the pyrimidine, "
    + "with the base on either side. Non-negative matrix factorization splits a cohort's counts into signatures "
    + "and their exposures, and each signature is named by the reference profile it is most similar to.",

  pageLabel: "Page",
  pageDetail: "one tumor's mutations, the cohort factorised, or each signature compared with the references",
  tumorSection: "The tumor",
  tumorLabel: "Tumor",
  tumorDetail: "two tumors of the cohort: the one with the most mutations apart from the hypermutated one, and the "
    + "hypermutated one",
  cohortSection: "The cohort",
  hyperLabel: "The hypermutated tumor",
  hyperDetail: "one tumor with 7.1% of the cohort's mutations, from a polymerase epsilon profile",
  rankLabel: "Signatures to extract",
  rankDetail: "the rank of the factorization: it finds as many signatures as it is given",
  lookSection: "How to look at it",
  openLabel: "Signature",
  openDetail: "the signature drawn beside its best match and the runner-up",
  dataSection: "The data",
  seedLabel: "Seed",
  seedDetail: "draws a different cohort",
  truthLabel: "True processes",
  truthDetail: "what the simulation built each signature from",

  stepLabels: {
    k0: "Add the mutations",
    k1: "Read from the pyrimidine",
    k2: "Split by the neighbouring bases",
    s0: "Extract the signatures",
    s1: "Show the signatures",
    s2: "Show each signature's exposures",
    mX: "Extract the signatures",
    m0: "Compare with the references",
  },
  stepTitle: "Take the next step",

  /* page 1 */
  tumorCaption: (t) => (t.which === "hypermutated"
    ? `Tumor 101, the hypermutated one: ${intText(t.n)} substitutions`
    : `Tumor ${t.index + 1}, the largest of the other 100: ${intText(t.n)} substitutions`),
  catEmpty: "No mutations added yet",
  catWritten: "As written: the change on the reference strand",
  catFolded: "Read from the pyrimidine: G>A is C>T on the other strand",
  catSplit: "96 types: the change and the base on either side",
  purineNote: "from a purine (G or A): the paler bar",
  axisCount: "substitutions",
  tiLine: (ti) => `Transitions (C>T and T>C): ${pct(ti)} · transversions: ${pct(1 - ti)}`,
  exampleLine: "A[C>T]G: C changed to T, with A on its 5′ side and G on its 3′ side",
  topLine: (items) => `Most common: ${items}`,

  /* page 2 */
  heatM: "M",
  heatS: "S",
  heatW: "W",
  typesAxis: "96 mutation types",
  tumorsAxis: (n) => `${n} tumors`,
  sigAxis: (r) => `${r} signatures`,
  hyperTag: "tumor 101",
  heatNote: (cap) => `Shading: M by count, full at ${cap} and above; S and W by the square root`,
  iterLine: (it, kl) => `after ${intText(it)} iterations: KL divergence ${intText(kl)}`,
  sigTitle: (k) => `Signature ${k}`,
  sigShare: (s) => `${pct(s)} of the fit`,
  halfLine: (n) => (n === 1 ? "Half of its exposure is in one tumor" : `Half of its exposure is in ${n} tumors`),
  topTumor: (j, hyper, share) => (hyper ? `tumor 101, the hypermutated one, has ${pct(share)}` : `tumor ${j + 1} has the most, ${pct(share)}`),
  stripNote: "its exposure in each tumor, largest first",

  /* page 3 */
  matchCaption: "Cosine similarity with each reference",
  noSignatures: "No signatures extracted yet",
  builtLine: (k, text) => `${k} · built from ${text}`,
  bestLabel: (m) => `Best match: ${m.name}`,
  runnerLabel: (m) => `Runner-up: ${m.name}`,
  cosLabel: (c) => `cosine ${cos3(c)}`,
  standsFor: (m) => `stands for ${m.like}`,
  referencesNote: "Each reference is a profile built to resemble the COSMIC signature named beside it.",

  shownCaption: "Each column of S, drawn as a signature: the share of each type",
  openedCaption: "Each signature, and below it its exposure in each tumor, largest first",

  /* the legend */
  legendPurine: "A change written from a purine (G or A): the paler bar",
  legendHeat: "A larger count or weight: a stronger shade",
  legendCosine: "A higher cosine similarity: a stronger shade",
  legendBest: "The best match in each row: outlined",
  legendHyper: "Tumor 101, the hypermutated one: outlined, then marked under its bar",

  /* the tiles */
  tileSubstitutions: "Substitutions",
  tileInTumor: (k) => `in tumor ${k}`,
  tileTransitions: "Transitions",
  tileTransitionsNote: "C>T and T>C",
  tileTypes: "Types with a mutation",
  tileTypesNote: "of 96",
  tileTumors: "Tumors",
  tileTumorsNote: (n) => `${intText(n)} substitutions`,
  tileSignatures: "Signatures",
  tileIterations: (it) => `after ${intText(it)} iterations`,
  tileToExtract: (r) => `${r} to extract`,
  tileLargest: "Largest share in one tumor",
  tileLargestNote: (k, j) => `of signature ${k}'s exposure, in tumor ${j + 1}`,
  tileLargestWait: "once each signature is shown",
  tileBest: "Best match",
  tileRunner: "Runner-up",
  tileFor: (k) => `for signature ${k}`,
  tileMargin: "Margin",
  tileMarginNote: "the best match's cosine minus the runner-up's",

  /* the summaries, the figure's accessible label */
  sumCatalogue: (cat, t) => [
    `Tumor ${t.index + 1}, with ${intText(t.n)} substitutions not yet added.`,
    `Tumor ${t.index + 1}'s ${intText(t.n)} substitutions, counted by the change as written on the reference strand: twelve kinds.`,
    `Tumor ${t.index + 1}'s substitutions read from the pyrimidine: six kinds, ${pct(t.ti)} of them transitions.`,
    `Tumor ${t.index + 1}'s substitutions in 96 types, the change with the base on either side; ${t.typesHit} types have a mutation.`,
  ][cat],
  sumM: (n) => `The matrix M: 96 mutation types by ${n} tumors, before any signature is extracted.`,
  sumExtracted: (n, r, it) => `M, 96 types by ${n} tumors, factorised into ${r} signatures and their exposures after ${intText(it)} iterations.`,
  sumShown: (r) => `${r} signatures, each a column of S drawn as bars over the 96 types, beside W, their exposures.`,
  sumOpened: (r, own) => `${r} signatures, each with its exposure in each tumor${own ? `; half of signature ${own}'s exposure is in one tumor` : ""}.`,
  sumNoSignatures: "Ten reference profiles, and no signature extracted yet to compare with them.",
  sumNotCompared: (r) => `${r} signatures and ten reference profiles, not yet compared.`,
  sumCompared: (r, k, a, b) => `${r} signatures compared with ten references by cosine similarity; signature ${k}'s best match is `
    + `${a.name} at ${cos3(a.cos)}, and the runner-up ${b.name} at ${cos3(b.cos)}.`,

  /* the card */
  labelFactor: "the factorization",
  labelCosine: "cosine similarity",
  noteSignatures: "M holds each tumor's counts of the 96 types, with 0.1 added to every count so that none is zero. "
    + "Each column of S is a signature, summing to one; each column of W holds one tumor's exposures, in mutations.",
  noteMatching: "A and B are the signature and a reference, each as its 96 values.",
};
