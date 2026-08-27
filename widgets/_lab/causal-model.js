/* ============================================================================
   Shared model for widget 26 · fork-pipe-collider.

   The three generative models are VERBATIM from PHM5003 06-02 (Modeling for
   Explanation), cells 8/22/37 — same coefficients, same distributions — so
   the widget shows the notebook's own traps, not a retelling. The stored
   notebook outputs (fork unadjusted −0.401, adjusted +0.082; collider
   adjusted −0.181) are the reference this module was checked against in
   `causal-measure.mjs`: our rng reproduces the same means across 200 seeds
   (−0.40 / +0.10 / −0.22).

   One OLS, used by the measure script, the mock-ups and the widget — the
   two-copies-of-a-formula rule (see `deviationAfter` in galton-board).
   ========================================================================= */

/** OLS of y on [1, ...xs]; returns coefficients, SEs, p-values, R². */
export function ols(y, xs, tTailP) {
  const n = y.length;
  const p = xs.length + 1;
  const col = (j) => (j === 0 ? null : xs[j - 1]);
  const xtx = Array.from({ length: p }, () => new Array(p).fill(0));
  const xty = new Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    const row = [1];
    for (let j = 1; j < p; j++) row.push(col(j)[i]);
    for (let a = 0; a < p; a++) {
      xty[a] += row[a] * y[i];
      for (let b = 0; b < p; b++) xtx[a][b] += row[a] * row[b];
    }
  }
  /* Gauss-Jordan on [xtx | I] — p is at most 3, numerically tame. */
  const m = xtx.map((r, i) => [...r, ...r.map((_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < p; c++) {
    let piv = c;
    for (let r = c + 1; r < p; r++) if (Math.abs(m[r][c]) > Math.abs(m[piv][c])) piv = r;
    [m[c], m[piv]] = [m[piv], m[c]];
    const d = m[c][c];
    for (let j = 0; j < 2 * p; j++) m[c][j] /= d;
    for (let r = 0; r < p; r++) {
      if (r === c) continue;
      const f = m[r][c];
      for (let j = 0; j < 2 * p; j++) m[r][j] -= f * m[c][j];
    }
  }
  const inv = m.map((r) => r.slice(p));
  const beta = inv.map((r) => r.reduce((s, v, j) => s + v * xty[j], 0));
  let ssr = 0, sst = 0;
  const ybar = y.reduce((s, v) => s + v, 0) / n;
  for (let i = 0; i < n; i++) {
    let f = beta[0];
    for (let j = 1; j < p; j++) f += beta[j] * col(j)[i];
    ssr += (y[i] - f) ** 2;
    sst += (y[i] - ybar) ** 2;
  }
  const df = n - p;
  const s2 = ssr / df;
  const se = inv.map((r, j) => Math.sqrt(s2 * r[j]));
  const t = beta.map((b, j) => b / se[j]);
  const pv = tTailP ? t.map((tv) => tTailP(Math.abs(tv), df)) : null;
  return { beta, se, t, p: pv, r2: 1 - ssr / sst, df };
}

/** age -> {smoking, COPD}, smoking -> COPD (+0.1 true). */
export function fork(rng, n) {
  const age = [], smoking = [], COPD = [];
  for (let i = 0; i < n; i++) {
    const a = rng.normal(20, 15);
    const s = 150 - a + rng.normal();
    age.push(a); smoking.push(s);
    COPD.push(0.5 * a + 0.1 * s + rng.normal());
  }
  return { z: age, x: smoking, y: COPD };
}

/** exercise -> HR -> sysBP; total effect of exercise is 10. */
export function pipe(rng, n) {
  const exercise = [], HR = [], sysBP = [];
  for (let i = 0; i < n; i++) {
    const e = rng.normal();
    const h = 5 * e + rng.normal() + 60;
    exercise.push(e); HR.push(h);
    sysBP.push(2 * h + rng.normal());
  }
  return { z: HR, x: exercise, y: sysBP };
}

/** DKA -> ICU <- AMI; DKA and AMI independent, 5% of ICU flags flipped. */
export function collider(rng, n) {
  const DKA = [], AMI = [], ICU = [];
  for (let i = 0; i < n; i++) {
    const d = rng.normal() ** 2;
    const a = rng.normal() ** 2;
    let icu = d > 1 || a > 1 ? 1 : 0;
    if (rng.next() < 0.05) icu = 1 - icu;
    DKA.push(d); AMI.push(a); ICU.push(icu);
  }
  return { z: ICU, x: DKA, y: AMI };
}

export const STRUCTURES = {
  fork: {
    make: fork,
    exposure: "smoking", outcome: "COPD", other: "age",
    truth: 0.1,
    /* age -> smoke, age -> COPD, smoke -> COPD */
    edges: [["z", "x"], ["z", "y"], ["x", "y"]],
  },
  pipe: {
    make: pipe,
    exposure: "exercise", outcome: "sysBP", other: "HR",
    truth: 10,
    /* exercise -> HR -> sysBP */
    edges: [["x", "z"], ["z", "y"]],
  },
  collider: {
    make: collider,
    exposure: "DKA", outcome: "AMI", other: "ICU",
    truth: 0,
    /* DKA -> ICU <- AMI */
    edges: [["x", "z"], ["y", "z"]],
  },
};
