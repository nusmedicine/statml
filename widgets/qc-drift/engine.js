/* qc-drift's engine — one LC-MS run of 02-4's comparison with pooled QCs,
 * instrument drift along the injection order, and the two corrections 02-3
 * cell 10 names: a per-sample median, and a curve through the QCs (LOESS).
 * Measured in `_lab/proteomics-arc-measure.mjs` and mocked in
 * `_lab/proteomics-arc-mock.html` and `_lab/qc-drift-mock.html` (catalogue
 * § Slot 91); the drift model and the corrections are the arc model's part D.
 *
 * Two changes from the arc model, on purpose:
 *   1. every metabolite's drift and every sample's values are drawn BEFORE the
 *      run order, and the random order is always drawn, so Run order Random ·
 *      Grouped puts the same samples in a different sequence, and QC every
 *      5 · 10 only changes where the QCs sit — the arc model drew a new run
 *      for each;
 *   2. the test is 02-4's: a Wilcoxon rank-sum test (cell 12, `paired =
 *      FALSE`) with Benjamini–Hochberg, and the fold change from the medians
 *      (cell 10, `mean_median = "median"`); the arc used Welch's t.
 *
 * Simulated, because MTBLS6038 has no QC samples (02-3 cell 10).
 */

export const METABOLITES = [
  "Lactic acid", "Succinic acid", "Fumaric acid", "Malic acid", "Maleic acid", "Citric acid", "Malonic acid",
  "Glutaric acid", "Vanillic acid", "D-Glucuronic acid", "Pantothenic acid", "Nicotinic acid", "Adipic acid",
  "Tartaric acid", "Hippuric acid", "Pyroglutamic acid", "5-Hydroxymethyl-2-furoic acid", "3-Methylglutaric acid",
  "Ethylmalonic acid", "Suberic acid", "Phenyllactic acid", "Pyridoxine", "3-Indoleacetic acid",
  "Homovanillic acid", "3-Hydroxy-3-methylglutaric acid", "Phenylpyruvic acid",
];
export const PER_GROUP = 52;                       // 02-4: 52 prostatic hyperplasia, 52 prostate cancer
export const GROUPS = { A: "Prostatic hyperplasia", B: "Prostate cancer" };
const REAL = 4, FC = 0.6;                          // four truly different, two up and two down, by 0.6 log2
const SHARED = 0.5, OWN_SD = 0.5, BEND_SD = 0.3, TECH = 0.08, BIO = 0.35;
const MAX_QCS = 40;

export const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
export function variance(a) {
  const m = mean(a);
  return a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length - 1);
}
export function median(a) {
  const s = [...a].sort((x, y) => x - y);
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
}
export function bh(p) {
  const m = p.length;
  const idx = p.map((v, i) => i).sort((a, b) => p[a] - p[b]);
  const out = new Array(m);
  let run = 1;
  for (let r = m - 1; r >= 0; r -= 1) {
    run = Math.min(run, (p[idx[r]] * m) / (r + 1));
    out[idx[r]] = run;
  }
  return out;
}

/** Everything random, drawn once: the metabolites and their drift, every
    study sample's values, every QC injection's noise, and a random order. */
export function simulate(rng) {
  const mets = METABOLITES.map((name, m) => ({
    name, base: rng.normal(18, 2),
    slope: rng.normal(0, OWN_SD), bend: rng.normal(0, BEND_SD),
    real: m < REAL, fc: m < REAL ? (m % 2 ? -FC : FC) : 0,
  }));
  const samples = [];
  for (const g of ["A", "B"]) for (let i = 0; i < PER_GROUP; i += 1) {
    samples.push({ group: g, v: mets.map((mt) => rng.normal(0, BIO) + (g === "B" ? mt.fc : 0) + rng.normal(0, TECH)) });
  }
  const qcNoise = Array.from({ length: MAX_QCS }, () => mets.map(() => rng.normal(0, TECH)));
  const perm = samples.map((_, i) => i);
  for (let i = perm.length - 1; i > 0; i -= 1) { const j = Math.floor(rng.next() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  return { mets, samples, qcNoise, perm };
}

/** The shared fall of the whole signal as the source dirties, steepest early, at run fraction t. */
const sharedAt = (t) => (-SHARED * (1 - Math.exp(-3 * t))) / (1 - Math.exp(-3));
export const driftAt = (mt, t) => sharedAt(t) + mt.slope * (t - 0.5) + mt.bend * Math.sin(Math.PI * t * 2);

/**
 * The run: a pooled QC first, then a QC after every `qcEvery` study samples,
 * and a QC last; study samples in `order` ("random" or "grouped"). X[m][i] is
 * metabolite m at injection i, log2; drift[m][i] what the instrument added.
 */
export function layout(sim, order, qcEvery) {
  const seq = order === "grouped" ? sim.samples.map((_, i) => i) : sim.perm;
  const inj = [{ kind: "QC", q: 0 }];
  let q = 1;
  seq.forEach((s, k) => {
    inj.push({ kind: sim.samples[s].group, s });
    if ((k + 1) % qcEvery === 0) inj.push({ kind: "QC", q: q++ });
  });
  if (inj[inj.length - 1].kind !== "QC") inj.push({ kind: "QC", q: q++ });
  const N = inj.length;
  const drift = sim.mets.map((mt) => inj.map((_, i) => driftAt(mt, i / (N - 1))));
  const X = sim.mets.map((mt, m) => inj.map((x, i) => mt.base + drift[m][i]
    + (x.kind === "QC" ? sim.qcNoise[x.q][m] : sim.samples[x.s].v[m])));
  const qcIdx = inj.map((x, i) => (x.kind === "QC" ? i : -1)).filter((i) => i >= 0);
  return { inj, N, X, drift, qcIdx, mets: sim.mets };
}

/* ------------------------------------------------------------ corrections */

/** Local linear regression with tricube weights — R's loess, degree 1, no robustness iterations. */
export function loess(xs, ys, at, span) {
  const n = xs.length;
  const k = Math.max(2, Math.ceil(span * n));
  return at.map((x0) => {
    const d = xs.map((x) => Math.abs(x - x0));
    const h = [...d].sort((a, b) => a - b)[k - 1] || 1;
    let sw = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < n; i += 1) {
      const u = d[i] / h;
      if (u >= 1) continue;
      const w = (1 - u ** 3) ** 3;
      sw += w; sx += w * xs[i]; sy += w * ys[i]; sxx += w * xs[i] * xs[i]; sxy += w * xs[i] * ys[i];
    }
    const den = sw * sxx - sx * sx;
    if (Math.abs(den) < 1e-12) return sy / sw;
    const b = (sw * sxy - sx * sy) / den;
    return (sy - b * sx) / sw + b * x0;
  });
}

/**
 * What each correction subtracts, per metabolite and injection — the curve
 * the Correction page draws — and the corrected values. Median normalization
 * (02-3 cell 11): each injection's median across the metabolites, the same
 * for every metabolite. QC-LOESS: per metabolite, a LOESS curve through its
 * QCs against injection order. Each is centred so the level is kept.
 */
export function correct(run, method, span) {
  const { X, N, qcIdx } = run;
  if (method === "none") return { curve: null, Y: X };
  if (method === "median") {
    const med = Array.from({ length: N }, (_, i) => median(X.map((r) => r[i])));
    const grand = median(med);
    const curve = X.map((r) => { const lvl = median(r); return med.map((v) => v - grand + lvl); });
    return { curve, Y: X.map((r, m) => r.map((v, i) => v - curve[m][i] + median(r))) };
  }
  const all = Array.from({ length: N }, (_, i) => i);
  const curve = X.map((r) => loess(qcIdx, qcIdx.map((i) => r[i]), all, span));
  const Y = X.map((r, m) => { const lvl = median(qcIdx.map((i) => r[i])); return r.map((v, i) => v - curve[m][i] + lvl); });
  return { curve, Y };
}

/* ------------------------------------------------------------ the test, 02-4's */

function normalTail(z) {
  // two-sided p for |z|: erfc(|z|/√2), Abramowitz–Stegun 7.1.26 on the complementary error function
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return Math.min(1, y * Math.exp(-x * x));
}
/** Wilcoxon rank-sum, two-sided, normal approximation with continuity correction (R's default for n > 50). */
export function rankSum(a, b) {
  const all = [...a.map((v) => [v, 0]), ...b.map((v) => [v, 1])].sort((x, y) => x[0] - y[0]);
  let rb = 0;
  for (let i = 0; i < all.length;) {
    let j = i;
    while (j + 1 < all.length && all[j + 1][0] === all[i][0]) j += 1;
    const r = (i + j + 2) / 2;
    for (let k = i; k <= j; k += 1) if (all[k][1] === 1) rb += r;
    i = j + 1;
  }
  const n1 = a.length, n2 = b.length;
  const W = rb - (n2 * (n2 + 1)) / 2;
  const mu = (n1 * n2) / 2, sd = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12);
  const z = (W - mu - Math.sign(W - mu) * 0.5) / sd;
  return { W, z, p: normalTail(z) };
}
/**
 * Every metabolite tested, cancer against hyperplasia: the log2 fold change
 * from the medians, the rank-sum p, BH over the 26; and the QC RSD (the
 * linear-scale SD over the mean, across the pooled QCs).
 */
export function score(run, Y) {
  const { inj, mets, qcIdx } = run;
  const A = inj.map((x, i) => (x.kind === "A" ? i : -1)).filter((i) => i >= 0);
  const B = inj.map((x, i) => (x.kind === "B" ? i : -1)).filter((i) => i >= 0);
  const fc = Y.map((r) => median(B.map((i) => r[i])) - median(A.map((i) => r[i])));
  const p = Y.map((r) => rankSum(A.map((i) => r[i]), B.map((i) => r[i])).p);
  const padj = bh(p);
  const rsd = Y.map((r) => { const lin = qcIdx.map((i) => 2 ** r[i]); return Math.sqrt(variance(lin)) / mean(lin); });
  let tp = 0, fp = 0;
  mets.forEach((mt, k) => { if (padj[k] < 0.05) (mt.real ? tp += 1 : fp += 1); });
  return { fc, p, padj, rsd, tp, fp, called: tp + fp };
}

/** What a correction leaves of the drift in the study samples: the SD over
    them of (corrected − drift-free), per metabolite. Known only in a simulation. */
export function driftLeft(run, Y) {
  return run.X.map((row, m) => {
    const d = row.map((v, i) => Y[m][i] - (v - run.drift[m][i])).filter((_, i) => run.inj[i].kind !== "QC");
    const mu = mean(d);
    return Math.sqrt(mean(d.map((x) => (x - mu) ** 2)));
  });
}

/** The example metabolite: the one not truly different whose drift spans most. */
export function mostDrift(run) {
  return run.mets.map((mt, m) => [m, Math.max(...run.drift[m]) - Math.min(...run.drift[m])])
    .filter(([m]) => !run.mets[m].real).sort((a, b) => b[1] - a[1])[0][0];
}
