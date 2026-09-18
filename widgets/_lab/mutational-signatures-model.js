/* ============================================================================
   Slot 70 `mutational-signatures` — the planning model: the 96 channels, a
   catalogue of reference profiles built for this page, a simulated cohort, and
   the KL (Brunet) extraction 01-4 cell 21 runs. The mock and
   `_lab/mutational-signatures-measure.mjs` both import THIS file, so the numbers
   the mock prints are the ones the measure checked (widget 41's rule).

   PHM5003 07 / 01-4. Nothing here is TCGA's or COSMIC's:

   - THE REFERENCES ARE LOOK-ALIKES, built from each process's known mechanism
     (which base changes, in which neighbours) and not from COSMIC's numbers.
     COSMIC's terms forbid exposing its data "on a free to access platform
     (including but not limited to public facing websites)" without GRL's
     written consent (cosmickb.org/terms, read 2026-09-18). The measure scores
     each look-alike against the real profile it stands for, which maftools
     ships and this machine has, and prints the cosine; that number is the
     look-alike's calibration and never leaves the repo as a vector.
   - THE COHORT IS SIMULATED from planted processes, as the arc's stages are
     (Kenneth's pick 4, 2026-09-16), with its mutation counts fitted to the
     lesson's MAF counted as cell 11 counts it.
   ========================================================================= */

export const CLASSES = ["C>A", "C>G", "C>T", "T>A", "T>C", "T>G"];
export const BASES = ["A", "C", "G", "T"];
/* maftools' order (trinucleotideMatrix's `subtype.levels`): class, then the
   5' base, then the 3' base. Channel i is class ⌊i/16⌋, 5' ⌊i/4⌋ mod 4, 3' i mod 4. */
export const CHANNELS = CLASSES.flatMap((s) => BASES.flatMap((l) => BASES.map((r) => `${l}[${s}]${r}`)));
export const TRANSITIONS = new Set(["C>T", "T>C"]);

const COMP = { A: "T", C: "G", G: "C", T: "A" };
export const revcomp = (s) => [...s].reverse().map((b) => COMP[b]).join("");

/* A change as written on the reference strand, read from the pyrimidine of the
   pair: G>A in AGC is C>T in GCT. Returns the channel index and whether the
   strand was swapped. `tri` is the reference trinucleotide, centre = `ref`. */
export function channelOf(tri, ref, alt) {
  let t = tri, r = ref, a = alt, swapped = false;
  if (r === "G" || r === "A") { t = revcomp(tri); r = COMP[ref]; a = COMP[alt]; swapped = true; }
  const s = CLASSES.indexOf(`${r}>${a}`);
  return { index: 16 * s + 4 * BASES.indexOf(t[0]) + BASES.indexOf(t[2]), swapped, tri: t, change: `${r}>${a}` };
}

export const sum = (v) => { let s = 0; for (const x of v) s += x; return s; };
export function cosine(a, b) {
  let d = 0, x = 0, y = 0;
  for (let i = 0; i < a.length; i += 1) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; }
  return d / (Math.sqrt(x * y) || 1);
}

/* --- the look-alike catalogue --------------------------------------------------
   Each profile is a recipe: the share of each substitution class, and within a
   class a weight for each 5' and each 3' base (multiplied), plus named
   channels given extra mass and a small floor everywhere. Weights are listed
   A, C, G, T. `like` is the COSMIC signature each stands for, used only by the
   measure to score the resemblance. */
const U = [1, 1, 1, 1];
function recipe({ classes, left = {}, right = {}, spikes = {}, floor = 0.0015 }) {
  const v = new Float64Array(96);
  CLASSES.forEach((s, k) => {
    const share = classes[s] ?? 0.01;
    const L = left[s] ?? U, R = right[s] ?? U;
    const Ls = sum(L), Rs = sum(R);
    for (let l = 0; l < 4; l += 1) for (let r = 0; r < 4; r += 1) v[16 * k + 4 * l + r] = share * (L[l] / Ls) * (R[r] / Rs);
  });
  for (const [ch, m] of Object.entries(spikes)) v[CHANNELS.indexOf(ch)] += m;
  for (let i = 0; i < 96; i += 1) v[i] += floor;
  const s = sum(v);
  return v.map((x) => x / s);
}

export const REFERENCES = [
  { key: "cpg", name: "Deamination at CpG", like: ["COSMIC_1", "SBS1"],
    profile: recipe({ classes: { "C>T": 0.93, "T>C": 0.03, "C>A": 0.012, "C>G": 0.008, "T>A": 0.012, "T>G": 0.008 },
      left: { "C>T": [0.36, 0.2, 0.22, 0.12] }, right: { "C>T": [0.03, 0.015, 0.92, 0.035] }, floor: 0.0008 }) },
  { key: "clock", name: "Clock-like, flat", like: ["COSMIC_5", "SBS5"],
    profile: recipe({ classes: { "C>A": 0.11, "C>G": 0.1, "C>T": 0.3, "T>A": 0.09, "T>C": 0.32, "T>G": 0.08 },
      left: { "T>C": [0.5, 0.15, 0.2, 0.15], "C>T": [0.32, 0.26, 0.2, 0.22], "C>A": [0.3, 0.28, 0.16, 0.26], "C>G": [0.28, 0.24, 0.18, 0.3],
        "T>A": [0.34, 0.22, 0.14, 0.3], "T>G": [0.3, 0.2, 0.2, 0.3] },
      right: { "T>C": [0.3, 0.2, 0.28, 0.22], "C>T": [0.3, 0.2, 0.3, 0.2], "C>A": [0.32, 0.22, 0.14, 0.32], "C>G": [0.3, 0.2, 0.14, 0.36],
        "T>A": [0.3, 0.24, 0.16, 0.3], "T>G": [0.26, 0.2, 0.3, 0.24] } }) },
  { key: "hr", name: "Homologous recombination defect", like: ["COSMIC_3", "SBS3"],
    profile: recipe({ classes: { "C>A": 0.18, "C>G": 0.2, "C>T": 0.17, "T>A": 0.16, "T>C": 0.18, "T>G": 0.11 },
      left: { "C>A": [0.2, 0.4, 0.12, 0.28], "C>G": [0.2, 0.3, 0.1, 0.4], "C>T": [0.22, 0.34, 0.14, 0.3], "T>A": [0.34, 0.26, 0.12, 0.28],
        "T>C": [0.36, 0.22, 0.2, 0.22], "T>G": [0.3, 0.2, 0.18, 0.32] },
      right: { "C>A": [0.3, 0.34, 0.1, 0.26], "C>G": [0.3, 0.22, 0.08, 0.4], "C>T": [0.26, 0.2, 0.16, 0.38], "T>A": [0.3, 0.2, 0.14, 0.36],
        "T>C": [0.3, 0.22, 0.24, 0.24], "T>G": [0.28, 0.2, 0.24, 0.28] } }) },
  { key: "flat", name: "Unknown, flat", like: ["COSMIC_8", "SBS40"],
    profile: recipe({ classes: { "C>A": 0.24, "C>G": 0.13, "C>T": 0.22, "T>A": 0.12, "T>C": 0.15, "T>G": 0.14 },
      left: { "C>A": [0.34, 0.2, 0.1, 0.36], "C>G": [0.3, 0.2, 0.1, 0.4], "C>T": [0.26, 0.16, 0.12, 0.46], "T>A": [0.3, 0.3, 0.1, 0.3],
        "T>C": [0.4, 0.2, 0.16, 0.24], "T>G": [0.26, 0.14, 0.14, 0.46] },
      right: { "C>A": [0.44, 0.18, 0.08, 0.3], "C>G": [0.36, 0.14, 0.1, 0.4], "C>T": [0.44, 0.16, 0.14, 0.26], "T>A": [0.34, 0.2, 0.1, 0.36],
        "T>C": [0.3, 0.2, 0.22, 0.28], "T>G": [0.26, 0.14, 0.14, 0.46] } }) },
  { key: "apobecT", name: "APOBEC, C>T", like: ["COSMIC_2", "SBS2"],
    profile: recipe({ classes: { "C>T": 0.98, "C>G": 0.005, "C>A": 0.005 }, left: { "C>T": [0.004, 0.006, 0.004, 0.986] },
      right: { "C>T": [0.54, 0.1, 0.05, 0.31] }, floor: 0.0003 }) },
  { key: "apobecG", name: "APOBEC, C>G", like: ["COSMIC_13", "SBS13"],
    profile: recipe({ classes: { "C>G": 0.8, "C>A": 0.15, "C>T": 0.04 }, left: { "C>G": [0.01, 0.01, 0.01, 0.97], "C>A": [0.05, 0.05, 0.05, 0.85] },
      right: { "C>G": [0.42, 0.08, 0.04, 0.46], "C>A": [0.6, 0.1, 0.05, 0.25] }, floor: 0.0003 }) },
  { key: "mmr", name: "Mismatch repair defect", like: ["COSMIC_6", "SBS6"],
    profile: recipe({ classes: { "C>T": 0.9, "T>C": 0.05, "C>A": 0.02, "T>A": 0.01, "T>G": 0.01, "C>G": 0.01 },
      left: { "C>T": [0.24, 0.24, 0.4, 0.12] }, right: { "C>T": [0.22, 0.2, 0.52, 0.06] }, floor: 0.0008 }) },
  { key: "pole", name: "Polymerase epsilon", like: ["COSMIC_10", "SBS10b"],
    profile: recipe({ classes: { "C>A": 0.33, "C>T": 0.5, "T>G": 0.08, "T>C": 0.04, "T>A": 0.03, "C>G": 0.02 },
      left: { "C>A": [0.08, 0.06, 0.06, 0.8], "C>T": [0.06, 0.05, 0.05, 0.84], "T>G": [0.1, 0.1, 0.1, 0.7] },
      right: { "C>A": [0.18, 0.04, 0.03, 0.75], "C>T": [0.14, 0.06, 0.6, 0.2], "T>G": [0.1, 0.1, 0.1, 0.7] }, floor: 0.0005 }) },
  { key: "tobacco", name: "Tobacco smoking", like: ["COSMIC_4", "SBS4"],
    profile: recipe({ classes: { "C>A": 0.62, "T>A": 0.15, "C>T": 0.1, "C>G": 0.06, "T>C": 0.05, "T>G": 0.02 },
      left: { "C>A": [0.18, 0.48, 0.1, 0.24], "T>A": [0.2, 0.44, 0.12, 0.24] }, right: { "C>A": [0.34, 0.32, 0.04, 0.3] } }) },
  { key: "oxidative", name: "Reactive oxygen", like: ["COSMIC_18", "SBS18"],
    profile: recipe({ classes: { "C>A": 0.7, "C>T": 0.14, "T>A": 0.05, "T>C": 0.05, "C>G": 0.04, "T>G": 0.02 },
      left: { "C>A": [0.14, 0.14, 0.34, 0.38] }, right: { "C>A": [0.46, 0.08, 0.04, 0.42] } }) },
];
export const REF = Object.fromEntries(REFERENCES.map((r) => [r.key, r]));

/* --- the simulated cohort ------------------------------------------------------
   Counts are lognormal, fitted to the lesson's matrix (log-mean 3.838, sd
   0.891 over 968 tumours; median 42). Each tumour carries the two clock-like
   processes, and some carry APOBEC or the recombination defect; APOBEC emits
   its C>T and its C>G together, as the enzyme family does. */
export const PLANTED = [
  { key: "cpg", from: ["cpg"], every: true, weight: () => 1 },
  { key: "clock", from: ["clock"], every: true, weight: () => 1.3 },
  { key: "apobec", from: ["apobecT", "apobecG"], mix: [0.55, 0.45], share: 0.3, weight: (rng) => 1.5 + 3 * rng.next() },
  { key: "hr", from: ["hr"], share: 0.25, weight: (rng) => 1 + 2.5 * rng.next() },
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

/* `hyper` is the hypermutated tumour's share of the cohort's mutations, 0 for
   none. TCGA-AN-A046 holds 5,841 of the lesson's 82,747 SNVs, 7.1%, so that is
   the share the page means by one hypermutated tumour. */
export const LESSON_HYPER_SHARE = 5841 / 82747;
export function makeCohort(rng, { tumours = 100, hyper = 0, hyperProfile = "pole", logsd = COUNT_LOGSD } = {}) {
  const profiles = PLANTED.map(plantedProfile);
  const M = Array.from({ length: 96 }, () => new Float64Array(tumours + (hyper ? 1 : 0)));
  const expo = [];                       // per tumour: mutations from each planted process
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

/* --- one tumour, for the catalogue page ------------------------------------------
   A MAF writes each change on the reference strand, so a C>T and a G>A are the
   same event read from opposite strands; in the lesson's file 41,398 of 82,747
   SNVs (50.0%) have a purine reference. Each mutation here is drawn in its
   pyrimidine channel and then written on one strand or the other at even odds. */
export const PURINE_FORM = { "C>A": "G>T", "C>G": "G>C", "C>T": "G>A", "T>A": "A>T", "T>C": "A>G", "T>G": "A>C" };
export const WRITTEN = CLASSES.flatMap((s) => [s, PURINE_FORM[s]]);
export function drawTumour(rng, n, weights) {
  const keys = Object.keys(weights);
  const mix = new Float64Array(96);
  const ws = sum(Object.values(weights));
  for (const k of keys) {
    const p = PLANTED.find((q) => q.key === k);
    plantedProfile(p).forEach((x, c) => { mix[c] += (weights[k] / ws) * x; });
  }
  const cdf = [];
  let acc = 0;
  for (const x of mix) { acc += x; cdf.push(acc); }
  const mutations = [];
  const counts = new Float64Array(96);
  for (let m = 0; m < n; m += 1) {
    const u = rng.next() * acc;
    let c = 0;
    while (cdf[c] < u) c += 1;
    const cls = CLASSES[c >> 4];
    const purine = rng.next() < 0.5;
    mutations.push({ index: c, cls, written: purine ? PURINE_FORM[cls] : cls, purine });
    counts[c] += 1;
  }
  return { mutations, counts, mix };
}

/* --- the extraction ------------------------------------------------------------
   `extractSignatures` in maftools: add pConstant to every cell, run NMF's
   default `brunet` — the KL multiplicative update, widget 41's `updateKL` —
   from one random start, then scale each signature to sum to one. Stops when
   the KL divergence changes by less than `tol` of itself over 10 iterations,
   or at `maxIter`. */
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

export function extract(M, r, rng, { pConstant = 0.1, maxIter = 3000, tol = 1e-7 } = {}) {
  const m = M.length, n = M[0].length;
  const V = M.map((row) => Float64Array.from(row, (x) => x + pConstant));
  let mean = 0;
  for (const row of V) for (const x of row) mean += x;
  mean /= m * n;
  const W = Array.from({ length: m }, () => Float64Array.from({ length: r }, () => rng.next() * mean + 1e-6));
  const H = Array.from({ length: r }, () => Float64Array.from({ length: n }, () => rng.next() * mean + 1e-6));
  const P = Array.from({ length: m }, () => new Float64Array(n));
  const product = () => {
    for (let i = 0; i < m; i += 1) for (let j = 0; j < n; j += 1) {
      let s = 0;
      for (let k = 0; k < r; k += 1) s += W[i][k] * H[k][j];
      P[i][j] = s;
    }
  };
  let last = Infinity, iter = 0;
  for (; iter < maxIter; iter += 1) {
    product();
    for (let k = 0; k < r; k += 1) {
      let ws = 0;
      for (let i = 0; i < m; i += 1) ws += W[i][k];
      for (let j = 0; j < n; j += 1) {
        let s = 0;
        for (let i = 0; i < m; i += 1) s += (W[i][k] * V[i][j]) / P[i][j];
        H[k][j] *= s / ws;
      }
    }
    product();
    for (let k = 0; k < r; k += 1) {
      let hs = 0;
      for (let j = 0; j < n; j += 1) hs += H[k][j];
      for (let i = 0; i < m; i += 1) {
        let s = 0;
        for (let j = 0; j < n; j += 1) s += (H[k][j] * V[i][j]) / P[i][j];
        W[i][k] *= s / hs;
      }
    }
    if (iter % 10 === 9) {
      const d = klDivergence(V, W, H);
      if (Math.abs(last - d) < tol * d) { iter += 1; break; }
      last = d;
    }
  }
  /* Scale: each signature sums to one, and its exposures carry the scale, so a
     tumour's exposure is in mutations. */
  const sigs = [], expo = [];
  for (let k = 0; k < r; k += 1) {
    let s = 0;
    for (let i = 0; i < m; i += 1) s += W[i][k];
    sigs.push(Float64Array.from(W, (row) => row[k] / s));
    expo.push(Float64Array.from(H[k], (h) => h * s));
  }
  /* Ordered by the mutations each explains, largest first: NMF fixes no order
     (widget 41's `normalise` says why this code chooses one). */
  const order = [...sigs.keys()].sort((a, b) => sum(expo[b]) - sum(expo[a]));
  return { signatures: order.map((k) => sigs[k]), exposures: order.map((k) => expo[k]), iterations: iter, kl: klDivergence(V, W, H) };
}

/* How concentrated a signature is: the largest tumour's share of the mutations
   it explains, and how many tumours it takes to reach half. */
export function holders(expoRow) {
  const t = sum(expoRow);
  const sorted = [...expoRow].map((x, j) => [x, j]).sort((a, b) => b[0] - a[0]);
  let acc = 0, half = 0;
  for (const [x] of sorted) { acc += x; half += 1; if (acc >= t / 2) break; }
  return { top: sorted[0][1], topShare: sorted[0][0] / t, half };
}

/* What built a signature, in the simulation's own terms: the non-negative mix
   of the planted profiles closest to it (least squares, Lee and Seung's
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

/* Best matches against the catalogue, in maftools' way: cosine, highest first. */
export function matches(sig, refs = REFERENCES) {
  return refs.map((r) => ({ key: r.key, name: r.name, cos: cosine(sig, r.profile) })).sort((a, b) => b.cos - a.cos);
}
