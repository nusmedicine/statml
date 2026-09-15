/* The stage and the arithmetic behind slot 67 `tumor-heterogeneity`
 * (PHM5003 07 / 01-2 cells 17–25), imported by BOTH `_lab/vaf-measure.mjs`
 * and `_lab/vaf-mock.html`.
 *
 * Shared on purpose: the NMF mock computed its own stage, disagreed with the
 * measurement it illustrated, and showed a cliff the measurement does not
 * have (§ *Widget 41*). Nothing here draws, and nothing runs on import.
 */

// ---------------------------------------------------------------- numbers
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function normal(rng) {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function binomial(n, p, rng) { let k = 0; for (let i = 0; i < n; i += 1) if (rng() < p) k += 1; return k; }
export const median = (a) => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
export const quantile = (a, p) => { const s = [...a].sort((x, y) => x - y), h = (s.length - 1) * p, lo = Math.floor(h); return s[lo] + (h - lo) * ((s[lo + 1] ?? s[lo]) - s[lo]); };

/* The lesson's depths as a lognormal: median 88, and sigma from the measured
 * IQR 49–161 (`_lab/cancer-plan-measure.mjs`). A FIXED depth is not a stage —
 * every VAF is then a multiple of 1/d and the MAD takes a handful of values,
 * which printed a degenerate MATH spread the first time §5 was measured. */
export const DEPTH_MEDIAN = 88;
export const DEPTH_SD = (Math.log(161) - Math.log(49)) / (2 * 0.6745);
export const drawDepth = (rng, med = DEPTH_MEDIAN) => Math.max(8, Math.round(Math.exp(Math.log(med) + DEPTH_SD * normal(rng))));

// ---------------------------------------------------------------- the model
// 01-2 cell 25: p purity, c cancer cell fraction, m mutated copies, C copies per tumour cell
export const vafExpected = (p, c, m, C) => (p * c * m) / (p * C + (1 - p) * 2);
export const ccfFrom = (vaf, p, m, C) => (vaf * (p * C + (1 - p) * 2)) / (p * m);

// cell 24's allele-specific states, major + minor
export const COPY_STATES = [
  { key: "1+1", label: "1 + 1  diploid", total: 2, copies: [1] },
  { key: "2+0", label: "2 + 0  copy-neutral LOH", total: 2, copies: [1, 2] },
  { key: "1+0", label: "1 + 0  one copy lost", total: 1, copies: [1] },
  { key: "2+1", label: "2 + 1  one copy gained", total: 3, copies: [1, 2] },
  { key: "3+1", label: "3 + 1  amplified", total: 4, copies: [1, 2, 3] },
];
export const stateOf = (key) => COPY_STATES.find((s) => s.key === key);

/* Three arrangements that all read VAF 0.250 — the first page's argument.
 * Nineteen more in the swept grid; these three are the ones that read as
 * sentences. */
export const TRIO = [
  { label: "half the cells in the sample are normal", purity: 0.5, ccf: 1, m: 1, state: "1+1" },
  { label: "half the tumour cells carry it", purity: 1, ccf: 0.5, m: 1, state: "1+1" },
  { label: "it is on one of four copies in every tumour cell", purity: 1, ccf: 1, m: 1, state: "3+1" },
];

// ---------------------------------------------------------------- a tumour
/* clones: [{ ccf, share }] — share is the fraction of the tumour's MUTATIONS
 * that belong to that clone, ccf the fraction of tumour cells carrying them.
 * Every mutation is heterozygous in a diploid region unless a state is given. */
export function tumour({ clones, purity, n, seed, depthMedian = DEPTH_MEDIAN, state = "1+1", m = 1 }) {
  const rng = mulberry32(seed);
  const total = stateOf(state).total;
  const out = [];
  for (let i = 0; i < n; i += 1) {
    let u = rng(), pick = clones[0];
    for (const c of clones) { if (u < c.share) { pick = c; break; } u -= c.share; }
    const depth = drawDepth(rng, depthMedian);
    const p = vafExpected(purity, pick.ccf, m, total);
    const alt = binomial(depth, p, rng);
    out.push({ vaf: alt / depth, alt, depth, ccf: pick.ccf, clonal: pick.ccf >= 0.999 });
  }
  return out;
}

// cell 23's title: Mroz & Rocco's MATH, as maftools prints it
export const MATH = (v) => { const m = median(v); return (100 * 1.4826 * median(v.map((x) => Math.abs(x - m)))) / m; };

// ---------------------------------------------------------------- clusters
/* One-dimensional Gaussian mixture by EM, the number of components chosen by
 * BIC — `mclust`'s rule, which 01-2 cell 22 calls through inferHeterogeneity.
 * BIC = 2·loglik − k·ln n, higher better, mclust's sign convention. */
export function fitGMM(x, K, iters = 200) {
  const n = x.length, s = [...x].sort((a, b) => a - b);
  const mu = Array.from({ length: K }, (_, k) => s[Math.floor(((k + 0.5) / K) * n)]);
  const sd = new Array(K).fill(Math.max(0.01, (quantile(x, 0.75) - quantile(x, 0.25)) / (1.349 * K)));
  const w = new Array(K).fill(1 / K);
  const R = Array.from({ length: n }, () => new Array(K).fill(0));
  const pdf = (v, m0, s0) => Math.exp(-((v - m0) ** 2) / (2 * s0 * s0)) / (s0 * Math.sqrt(2 * Math.PI));
  let loglik = -Infinity;
  for (let it = 0; it < iters; it += 1) {
    let ll = 0;
    for (let i = 0; i < n; i += 1) {
      let tot = 0;
      for (let k = 0; k < K; k += 1) { R[i][k] = w[k] * pdf(x[i], mu[k], sd[k]); tot += R[i][k]; }
      if (!(tot > 0)) { tot = 1e-300; R[i].fill(1 / K); }
      for (let k = 0; k < K; k += 1) R[i][k] /= tot;
      ll += Math.log(tot);
    }
    for (let k = 0; k < K; k += 1) {
      let nk = 0, m0 = 0, v0 = 0;
      for (let i = 0; i < n; i += 1) { nk += R[i][k]; m0 += R[i][k] * x[i]; }
      m0 /= Math.max(nk, 1e-12);
      for (let i = 0; i < n; i += 1) v0 += R[i][k] * (x[i] - m0) ** 2;
      w[k] = nk / n; mu[k] = m0; sd[k] = Math.max(0.005, Math.sqrt(v0 / Math.max(nk, 1e-12)));
    }
    if (Math.abs(ll - loglik) < 1e-8) { loglik = ll; break; }
    loglik = ll;
  }
  const assign = x.map((v) => {
    let best = 0, bv = -Infinity;
    for (let k = 0; k < K; k += 1) { const p = w[k] * pdf(v, mu[k], sd[k]); if (p > bv) { bv = p; best = k; } }
    return best;
  });
  return { loglik, mu, sd, w, assign, bic: 2 * loglik - (3 * K - 1) * Math.log(n) };
}
export function pickK(x, maxK = 5) {
  let best = null, bestK = 1;
  const bics = [];
  for (let K = 1; K <= maxK; K += 1) {
    const f = fitGMM(x, K);
    bics.push(f.bic);
    if (!best || f.bic > best.bic) { best = f; bestK = K; }
  }
  return { K: bestK, fit: best, bics };
}

// ---------------------------------------------------------------- trees
/* Clusters ordered by CCF, descending; cluster 1 is the trunk and every later
 * cluster's parent is an earlier one, so three clusters have two shapes and
 * four have six. A tree fits a sample when no parent's children's CCFs sum
 * past its own — the pigeonhole principle (Nik-Zainal et al. 2012). */
export function trees(k) {
  const out = [];
  const walk = (parents) => {
    if (parents.length === k - 1) { out.push([...parents]); return; }
    for (let p = 0; p <= parents.length; p += 1) walk([...parents, p]);
  };
  walk([]);
  return out;
}
export const childrenOf = (tree, node) => tree.map((p, i) => [p, i + 1]).filter(([p]) => p === node).map(([, c]) => c);
export const fitsSumRule = (tree, ccf) => ccf.every((_, node) => childrenOf(tree, node).reduce((s, c) => s + ccf[c], 0) <= ccf[node] + 1e-12);
export const treeName = (tree) => tree.map((p, i) => `${p + 1} → ${i + 2}`).join(", ");

// 01-2 cell 25's figure, four samples of one patient, three clusters' mean CCF
export const RETCHER = {
  "P2.1st": [0.729, 0.534, 0.512],
  "P2.2st": [0.826, 0.597, 0.353],
  "P2.3st": [0.926, 0.767, 0.348],
  "P2.surgery": [0.806, 0.476, 0.304],
};
