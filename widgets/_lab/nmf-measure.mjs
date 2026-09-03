/* Measurements for widget 41 `nmf` — PHM5003 05/04 `## 2`.

   Answers, on the lesson's OWN stage (the airway count matrix, 33469 x 8),
   the questions the widget's design turns on:

     1. what does the notebook's own NMF figure actually look like;
     2. does a different seed move W, or only relabel it;
     3. how does that compare with the PCA the same notebook runs first.

   Run:  node widgets/_lab/nmf-measure.mjs <path-to-airway_count_matrix.csv>
   The CSV is the one cell 4 downloads.  */

import fs from "node:fs";

/* --- the lesson's data ---------------------------------------------------- */
const csvPath = process.argv[2];
if (!csvPath) { console.error("usage: node nmf-measure.mjs <airway_count_matrix.csv>"); process.exit(1); }
const lines = fs.readFileSync(csvPath, "utf8").trim().split(/\r?\n/);
const header = lines[0].split(",").map((s) => s.replace(/"/g, ""));
const samples = header.slice(1);
const genes = [], V = [];
for (let i = 1; i < lines.length; i += 1) {
  const f = lines[i].split(",");
  genes.push(f[0].replace(/"/g, ""));
  V.push(f.slice(1).map(Number));
}
const M = V.length, N = samples.length;
/* cell 6: the samples alternate untreated / treated, in file order. */
const treat = samples.map((_, j) => (j % 2 === 0 ? "untrt" : "trt"));

console.log(`AIRWAY  ${M} genes x ${N} samples`);
console.log(`  ${samples.map((s, j) => s.slice(-4) + "/" + treat[j]).join("  ")}`);
console.log(`  all non-negative: ${V.every((r) => r.every((v) => v >= 0))}`);
const colSum = samples.map((_, j) => V.reduce((s, r) => s + r[j], 0));
console.log(`  library sizes (millions): ${colSum.map((v) => (v / 1e6).toFixed(2)).join(" ")}`);
console.log(`  zero rows: ${V.filter((r) => r.every((v) => v === 0)).length}`);

/* --- seeded rng, so a rerun of this file reproduces ------------------------ */
function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* --- Lee & Seung multiplicative updates, Frobenius ------------------------- */
function nmf(V, r, seed, iters = 600) {
  const m = V.length, n = V[0].length, rng = mulberry(seed);
  const mean = Math.sqrt(V.reduce((s, row) => s + row.reduce((a, b) => a + b, 0) / (m * n), 0) / r);
  const W = Array.from({ length: m }, () => Array.from({ length: r }, () => (rng() + 0.1) * mean));
  const H = Array.from({ length: r }, () => Array.from({ length: n }, () => (rng() + 0.1) * mean));
  const eps = 1e-10;
  for (let it = 0; it < iters; it += 1) {
    /* H <- H .* (W^T V) ./ (W^T W H) */
    const WtV = Array.from({ length: r }, () => new Float64Array(n));
    for (let i = 0; i < m; i += 1) for (let k = 0; k < r; k += 1) {
      const w = W[i][k]; if (!w) continue;
      for (let j = 0; j < n; j += 1) WtV[k][j] += w * V[i][j];
    }
    const WtW = Array.from({ length: r }, () => new Float64Array(r));
    for (let i = 0; i < m; i += 1) for (let k = 0; k < r; k += 1)
      for (let l = 0; l < r; l += 1) WtW[k][l] += W[i][k] * W[i][l];
    for (let k = 0; k < r; k += 1) for (let j = 0; j < n; j += 1) {
      let d = 0; for (let l = 0; l < r; l += 1) d += WtW[k][l] * H[l][j];
      H[k][j] *= WtV[k][j] / (d + eps);
    }
    /* W <- W .* (V H^T) ./ (W H H^T) */
    const HHt = Array.from({ length: r }, () => new Float64Array(r));
    for (let k = 0; k < r; k += 1) for (let l = 0; l < r; l += 1)
      for (let j = 0; j < n; j += 1) HHt[k][l] += H[k][j] * H[l][j];
    for (let i = 0; i < m; i += 1) {
      const vh = new Float64Array(r);
      for (let k = 0; k < r; k += 1) for (let j = 0; j < n; j += 1) vh[k] += V[i][j] * H[k][j];
      for (let k = 0; k < r; k += 1) {
        let d = 0; for (let l = 0; l < r; l += 1) d += W[i][l] * HHt[l][k];
        W[i][k] *= vh[k] / (d + eps);
      }
    }
  }
  /* residual */
  let ss = 0, tot = 0;
  for (let i = 0; i < m; i += 1) for (let j = 0; j < n; j += 1) {
    let p = 0; for (let k = 0; k < r; k += 1) p += W[i][k] * H[k][j];
    ss += (V[i][j] - p) ** 2; tot += V[i][j] ** 2;
  }
  return { W, H, rel: Math.sqrt(ss / tot) };
}

/* NMF fixes W*H, not W and H separately: W*D and D^-1*H fit identically for any
   positive diagonal D. Normalising each part to unit L1 makes runs comparable. */
function normalise(W, H) {
  const r = H.length, m = W.length, n = H[0].length;
  const Wn = W.map((row) => row.slice()), Hn = H.map((row) => row.slice());
  for (let k = 0; k < r; k += 1) {
    let s = 0; for (let i = 0; i < m; i += 1) s += Wn[i][k];
    if (!s) continue;
    for (let i = 0; i < m; i += 1) Wn[i][k] /= s;
    for (let j = 0; j < n; j += 1) Hn[k][j] *= s;
  }
  return { W: Wn, H: Hn };
}
const cosine = (a, b) => {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i += 1) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return d / (Math.sqrt(na * nb) || 1);
};
const col = (W, k) => W.map((row) => row[k]);

/* --- 1. the notebook's own figure ----------------------------------------- */
console.log("\n=== 1. rank 2 on raw counts — the notebook's own figure ===");
const SEEDS = [1, 2, 3, 4, 5];
const fits = SEEDS.map((s) => { const f = nmf(V, 2, s); return { s, ...normalise(f.W, f.H), rel: f.rel }; });

for (const f of fits) {
  console.log(`  seed ${f.s}  relative residual ${f.rel.toFixed(5)}`);
  for (let k = 0; k < 2; k += 1)
    console.log(`    H row ${k + 1}: ${f.H[k].map((v) => (v / 1e6).toFixed(2).padStart(7)).join("")}   (millions)`);
}
const f1 = fits[0];
console.log(`  order of samples:  ${treat.map((t) => t.padStart(7)).join("")}`);

/* Does the picture separate the treatment groups? Score each component by how
   far apart the two groups sit in it, in within-group SDs. */
function sep(vals) {
  const a = vals.filter((_, j) => treat[j] === "untrt"), b = vals.filter((_, j) => treat[j] === "trt");
  const mu = (x) => x.reduce((s, v) => s + v, 0) / x.length;
  const sd = (x) => Math.sqrt(x.reduce((s, v) => s + (v - mu(x)) ** 2, 0) / (x.length - 1));
  const pooled = Math.sqrt((sd(a) ** 2 + sd(b) ** 2) / 2) || 1;
  return (mu(b) - mu(a)) / pooled;
}
console.log("\n  treatment separation of each component (Cohen's d, seed 1):");
console.log(`    component 1: ${sep(f1.H[0]).toFixed(2)}   component 2: ${sep(f1.H[1]).toFixed(2)}`);
const corr = (() => {
  const a = f1.H[0], b = f1.H[1], n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
  let sab = 0, sa = 0, sb = 0;
  for (let j = 0; j < n; j += 1) { sab += (a[j] - ma) * (b[j] - mb); sa += (a[j] - ma) ** 2; sb += (b[j] - mb) ** 2; }
  return sab / Math.sqrt(sa * sb);
})();
console.log(`    correlation between the two components across samples: ${corr.toFixed(3)}`);

/* --- 2. does the seed move W, or only relabel it? ------------------------- */
console.log("\n=== 2. seed to seed: is it the same W under a different name? ===");
for (let i = 1; i < fits.length; i += 1) {
  const a = fits[0], b = fits[i];
  const same = [cosine(col(a.W, 0), col(b.W, 0)), cosine(col(a.W, 1), col(b.W, 1))];
  const swap = [cosine(col(a.W, 0), col(b.W, 1)), cosine(col(a.W, 1), col(b.W, 0))];
  const best = Math.min(...(same[0] + same[1] >= swap[0] + swap[1] ? same : swap));
  console.log(`  seed 1 vs seed ${b.s}:  best matching of the two parts, worst cosine ${best.toFixed(4)}` +
    `   ${same[0] + same[1] >= swap[0] + swap[1] ? "(in order)" : "(swapped)"}`);
}

/* --- 3. what PCA does to the same matrix ---------------------------------- */
console.log("\n=== 3. the PCA the same notebook runs first (cell 10: scaled, centred) ===");
/* prcomp(t(countData), scale.=TRUE) — samples are rows, genes are columns. */
const keep = [];
for (let i = 0; i < M; i += 1) {
  let mu = 0; for (let j = 0; j < N; j += 1) mu += V[i][j]; mu /= N;
  let s2 = 0; for (let j = 0; j < N; j += 1) s2 += (V[i][j] - mu) ** 2;
  const sd = Math.sqrt(s2 / (N - 1));
  if (sd > 0) keep.push({ i, mu, sd });
}
console.log(`  genes with non-zero variance: ${keep.length} of ${M}`);
/* Z is N x keep.length; the Gram matrix Z Z^T is N x N, so the scores come out
   of an 8 x 8 eigenproblem rather than a 33469 x 33469 one. */
const G = Array.from({ length: N }, () => new Float64Array(N));
for (const { i, mu, sd } of keep) {
  const z = new Float64Array(N);
  for (let j = 0; j < N; j += 1) z[j] = (V[i][j] - mu) / sd;
  for (let a = 0; a < N; a += 1) for (let b = 0; b < N; b += 1) G[a][b] += z[a] * z[b];
}
function jacobi(Ain) {
  const n = Ain.length, A = Ain.map((r) => Array.from(r));
  const Vv = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 100; sweep += 1) {
    let off = 0;
    for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) off += A[i][j] ** 2;
    if (off < 1e-18) break;
    for (let p = 0; p < n; p += 1) for (let q = p + 1; q < n; q += 1) {
      if (Math.abs(A[p][q]) < 1e-30) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k += 1) { const kp = A[k][p], kq = A[k][q]; A[k][p] = c * kp - s * kq; A[k][q] = s * kp + c * kq; }
      for (let k = 0; k < n; k += 1) { const pk = A[p][k], qk = A[q][k]; A[p][k] = c * pk - s * qk; A[q][k] = s * pk + c * qk; }
      for (let k = 0; k < n; k += 1) { const kp = Vv[k][p], kq = Vv[k][q]; Vv[k][p] = c * kp - s * kq; Vv[k][q] = s * kp + c * kq; }
    }
  }
  return [...Array(n).keys()].sort((a, b) => A[b][b] - A[a][a])
    .map((i) => ({ val: A[i][i], vec: Vv.map((r) => r[i]) }));
}
const eig = jacobi(G);
const totVar = eig.reduce((s, e) => s + Math.max(0, e.val), 0);
for (let k = 0; k < 3; k += 1) {
  const scores = eig[k].vec.map((v) => v * Math.sqrt(Math.max(0, eig[k].val)));
  console.log(`  PC${k + 1}  ${(100 * eig[k].val / totVar).toFixed(1)}% of variance` +
    `   treatment separation ${sep(scores).toFixed(2)}`);
  console.log(`      scores: ${scores.map((v) => v.toFixed(0).padStart(7)).join("")}`);
}
console.log(`  order of samples:  ${treat.map((t) => t.padStart(7)).join("")}`);
console.log("\n  PCA scores carry both signs; the H above cannot.");

/* --- 4. the algorithm R actually runs -------------------------------------
   `nmf(x, rank, nrun=1)` defaults to method "brunet" — multiplicative updates
   on the KL divergence, not the Frobenius norm. On counts the two disagree:
   Frobenius is dominated by the few genes with the largest counts. */
function nmfKL(V, r, seed, iters = 600) {
  const m = V.length, n = V[0].length, rng = mulberry(seed);
  const mean = Math.sqrt(V.reduce((s, row) => s + row.reduce((a, b) => a + b, 0) / (m * n), 0) / r);
  const W = Array.from({ length: m }, () => Array.from({ length: r }, () => (rng() + 0.1) * mean));
  const H = Array.from({ length: r }, () => Array.from({ length: n }, () => (rng() + 0.1) * mean));
  const eps = 1e-10;
  for (let it = 0; it < iters; it += 1) {
    const P = Array.from({ length: m }, (_, i) => {
      const row = new Float64Array(n);
      for (let j = 0; j < n; j += 1) { let p = 0; for (let k = 0; k < r; k += 1) p += W[i][k] * H[k][j]; row[j] = p + eps; }
      return row;
    });
    const wSum = new Float64Array(r);
    for (let i = 0; i < m; i += 1) for (let k = 0; k < r; k += 1) wSum[k] += W[i][k];
    for (let k = 0; k < r; k += 1) for (let j = 0; j < n; j += 1) {
      let acc = 0; for (let i = 0; i < m; i += 1) acc += W[i][k] * (V[i][j] / P[i][j]);
      H[k][j] *= acc / (wSum[k] + eps);
    }
    const P2 = Array.from({ length: m }, (_, i) => {
      const row = new Float64Array(n);
      for (let j = 0; j < n; j += 1) { let p = 0; for (let k = 0; k < r; k += 1) p += W[i][k] * H[k][j]; row[j] = p + eps; }
      return row;
    });
    const hSum = new Float64Array(r);
    for (let k = 0; k < r; k += 1) for (let j = 0; j < n; j += 1) hSum[k] += H[k][j];
    for (let i = 0; i < m; i += 1) for (let k = 0; k < r; k += 1) {
      let acc = 0; for (let j = 0; j < n; j += 1) acc += H[k][j] * (V[i][j] / P2[i][j]);
      W[i][k] *= acc / (hSum[k] + eps);
    }
  }
  return { W, H };
}
console.log("\n=== 4. KL (brunet) — what the R package runs by default ===");
const kl = (() => { const f = nmfKL(V, 2, 1); return normalise(f.W, f.H); })();
/* Print it the way cell 21 does: H scaled so the columns of W sum to 1. */
for (let k = 0; k < 2; k += 1)
  console.log(`  H row ${k + 1}: ${kl.H[k].map((v) => (v / 1e6).toFixed(2).padStart(7)).join("")}   (millions)`);
console.log(`  order:     ${treat.map((t) => t.padStart(7)).join("")}`);
console.log(`  treatment separation:  component 1 ${sep(kl.H[0]).toFixed(2)}   component 2 ${sep(kl.H[1]).toFixed(2)}`);
console.log("  the notebook's printed coefMatrix separates cleanly: untrt high on");
console.log("  component 1, trt high on component 2. Compare the rows above.");

/* --- 5. the seed sweep: does the STORY move, not just the numbers? --------- */
console.log("\n=== 5. twelve seeds, Frobenius, rank 2 ===");
const sweep = [];
for (let s = 1; s <= 12; s += 1) {
  const f = nmf(V, 2, s), nf = normalise(f.W, f.H);
  sweep.push({ s, rel: f.rel, d: [sep(nf.H[0]), sep(nf.H[1])], W: nf.W });
}
const rels = sweep.map((x) => x.rel);
console.log(`  relative residual:  ${Math.min(...rels).toFixed(5)} to ${Math.max(...rels).toFixed(5)}` +
  `  (a spread of ${(100 * (Math.max(...rels) - Math.min(...rels)) / Math.min(...rels)).toFixed(2)}%)`);
const best = sweep.map((x) => Math.max(...x.d.map(Math.abs)));
console.log(`  strongest treatment separation any component reaches: ` +
  `${Math.min(...best).toFixed(2)} to ${Math.max(...best).toFixed(2)}`);
console.log("  per seed:  " + sweep.map((x) => `${x.s}:${Math.max(...x.d.map(Math.abs)).toFixed(2)}`).join("  "));
let worst = 1;
for (let i = 0; i < sweep.length; i += 1) for (let j = i + 1; j < sweep.length; j += 1) {
  const same = Math.min(cosine(col(sweep[i].W, 0), col(sweep[j].W, 0)), cosine(col(sweep[i].W, 1), col(sweep[j].W, 1)));
  const swap = Math.min(cosine(col(sweep[i].W, 0), col(sweep[j].W, 1)), cosine(col(sweep[i].W, 1), col(sweep[j].W, 0)));
  worst = Math.min(worst, Math.max(same, swap));
}
console.log(`  worst cosine between any two seeds' best-matched parts: ${worst.toFixed(4)}`);

/* --- 6. asking for a third part ------------------------------------------
   PCA is NESTED: PC1 is the same vector whether you asked for two components
   or five. NMF is not — every part is refit. This is the sharpest form of
   "not ordered", and it is checkable rather than assertable. */
console.log("\n=== 6. nesting: ask for 3 instead of 2, and see what survives ===");
const r2 = (() => { const f = nmf(V, 2, 1); return normalise(f.W, f.H); })();
const r3 = (() => { const f = nmf(V, 3, 1); return normalise(f.W, f.H); })();
for (let k = 0; k < 2; k += 1) {
  const c = [0, 1, 2].map((l) => cosine(col(r2.W, k), col(r3.W, l)));
  console.log(`  NMF part ${k + 1} of 2 vs the 3 parts of rank 3: ${c.map((v) => v.toFixed(3)).join("  ")}` +
    `   best ${Math.max(...c).toFixed(3)}`);
}
const pcaVec = (kk) => {
  /* the gene-space loading of PC kk, from the sample-space eigenvector */
  const v = eig[kk].vec, out = new Float64Array(keep.length);
  keep.forEach(({ i, mu, sd }, idx) => { let a = 0; for (let j = 0; j < N; j += 1) a += ((V[i][j] - mu) / sd) * v[j]; out[idx] = a; });
  return Array.from(out);
};
console.log("  PCA has nothing to check: its components come out of one");
console.log("  eigendecomposition, so PC1 and PC2 are byte-identical whether you");
console.log("  keep 2 or 3. The cosine is 1.000 by construction, not by luck.");
