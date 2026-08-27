// lm-model.js — the linear-model arc's shared machinery (planning copy).
//
// One OLS, shared by the measure scripts, the mock-ups and eventually the
// lm-* widgets, the same way causal-model.js served fork-pipe-collider: the
// numbers Kenneth reviews in a mock-up and the numbers the widget ships are
// the same numbers because they come from the same function.
//
// The solver is exact (normal equations), not the notebook's Nelder-Mead
// `optim` — 05-01's own optim run lands 0.03 off lm()'s intercept, and lm()
// is what every printed reference coefficient comes from.

// Fit y on covariate columns xs (array of arrays), intercept always included.
// Returns per-term arrays ordered [intercept, ...xs].
export function ols(y, ...xs) {
  const n = y.length;
  const X = [new Array(n).fill(1), ...xs];
  const k = X.length;

  // Normal equations X'Xb = X'y, solved by Gaussian elimination with partial
  // pivoting — k is at most 4 or 5 across the whole arc, so numerics are tame.
  const A = X.map((xi) => [...X.map((xj) => dot(xi, xj)), dot(xi, y)]);
  for (let c = 0; c < k; c++) {
    let p = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let j = c; j <= k; j++) A[r][j] -= f * A[c][j];
    }
  }
  const b = A.map((row, i) => row[k] / row[i]);

  const fitted = y.map((_, i) => X.reduce((s, xc, j) => s + b[j] * xc[i], 0));
  const ssRes = y.reduce((s, yi, i) => s + (yi - fitted[i]) ** 2, 0);
  const ybar = y.reduce((s, v) => s + v, 0) / n;
  const ssTot = y.reduce((s, yi) => s + (yi - ybar) ** 2, 0);
  const df = n - k;
  const sigma2 = ssRes / df;

  // SE(b_j) = sqrt(sigma2 * (X'X)^-1[j][j]), via solving for the inverse columns.
  const XtX = X.map((xi) => X.map((xj) => dot(xi, xj)));
  const inv = invert(XtX);
  const se = b.map((_, j) => Math.sqrt(sigma2 * inv[j][j]));
  const t = b.map((bj, j) => bj / se[j]);

  return {
    b, se, t, df, sigma2, ssRes, ssTot, fitted,
    r2: 1 - ssRes / ssTot,
    adjR2: 1 - (ssRes / df) / (ssTot / (n - 1)),
  };
}

// The sum the reader stands on: SS(b0, b1) over the single covariate, exactly
// 05-01's sum_squares.
export function ssLine(b0, b1, x, y) {
  let s = 0;
  for (let i = 0; i < y.length; i++) s += (b0 + b1 * x[i] - y[i]) ** 2;
  return s;
}

function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }

function invert(M) {
  const k = M.length;
  const A = M.map((row, i) => [...row, ...row.map((_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < k; c++) {
    let p = c;
    for (let r = c + 1; r < k; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    const d = A[c][c];
    for (let j = 0; j < 2 * k; j++) A[c][j] /= d;
    for (let r = 0; r < k; r++) {
      if (r === c) continue;
      const f = A[r][c];
      for (let j = 0; j < 2 * k; j++) A[r][j] -= f * A[c][j];
    }
  }
  return A.map((row) => row.slice(k));
}
