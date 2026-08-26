/* ============================================================================
   EXACT t-SNE, at the scale a widget uses. NOT DEPLOYED — this is the planning
   prototype for widget 21, kept because every number in docs/catalogue.md
   § NEXT · t-SNE came out of it, and because it is what that widget's
   compute() should be.

   It is the algorithm sklearn runs as method="exact" and Rtsne runs at
   theta=0: per-point Gaussian bandwidths chosen so each point's neighbour
   distribution has the requested perplexity, a Student-t in the picture, and
   gradient descent on the KL between the two — momentum 0.5 -> 0.8 at step
   250, early exaggeration x12 released at 250, per-coordinate gains.
   Barnes-Hut is an approximation for large n and has no place at n = 48.

   WHY THIS EXISTS RATHER THAN A REPLAY TABLE. The standing question in
   HANDOVER was whether t-SNE has to precompute. It does not: 1000 iterations
   at n = 48 cost 55 ms, which compute() can afford on a parameter change — and
   a replayed table could not have honoured a live perplexity slider, which is
   the control the whole widget hangs on.

   VERIFIED, and one of these caught a real bug:
     - the analytic gradient against a central difference of the KL: 2.4e-10.
       It read 1.9e-2 until the row normalisation in condP was fixed, and a
       wrong P is CONSISTENT between analytic and numerical, so no picture and
       no other check could have seen it.
     - the bisection against its target perplexity: within 1.1e-4 in 2^H.
     - KL falls, 2.14 -> 0.22 over 1000 steps at n = 48.

   NOT VERIFIED: agreement with sklearn or Rtsne on the same input. Python is
   not installed on this machine. That check is owed before the widget ships —
   svm-sklearn-ref.json is what it looks like when it is done.

   tsne-checks.mjs runs the three verifications; tsne-measure.mjs runs the
   measurements the catalogue quotes. Both are node scripts, not pages.
   ========================================================================= */

import { makeRng } from "../core/rng.js";

export function sqDists(X) {
  const n = X.length, D = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i += 1)
    for (let j = i + 1; j < n; j += 1) {
      let s = 0;
      for (let k = 0; k < X[i].length; k += 1) { const d = X[i][k] - X[j][k]; s += d * d; }
      D[i][j] = s; D[j][i] = s;
    }
  return D;
}

/* Per-point bandwidth by bisection on beta = 1/(2 sigma^2), so that the Shannon
   entropy of P(.|i) equals log(perplexity). This is the loop the perplexity
   slider actually moves, and the reason perplexity is a count of neighbours
   rather than a distance: it is fixed here for every point, so a sample in a
   dense region gets a small sigma and one out on its own gets a large one. */
export function condP(D, perplexity, tol = 1e-5, maxIter = 50) {
  const n = D.length, target = Math.log(perplexity);
  const P = Array.from({ length: n }, () => new Float64Array(n));
  const betas = new Float64Array(n);
  let worst = 0, iters = 0;
  for (let i = 0; i < n; i += 1) {
    let lo = -Infinity, hi = Infinity, beta = 1, H = 0;
    for (let it = 0; it < maxIter; it += 1) {
      iters += 1;
      let sum = 0, dot = 0;
      for (let j = 0; j < n; j += 1) {
        if (j === i) { P[i][j] = 0; continue; }
        const p = Math.exp(-beta * D[i][j]);
        P[i][j] = p; sum += p; dot += beta * D[i][j] * p;
      }
      if (sum === 0) sum = 1e-12;
      H = Math.log(sum) + dot / sum;            /* entropy in nats */
      const diff = H - target;
      if (Math.abs(diff) < tol) break;
      if (diff > 0) { lo = beta; beta = hi === Infinity ? beta * 2 : (beta + hi) / 2; }
      else { hi = beta; beta = lo === -Infinity ? beta / 2 : (beta + lo) / 2; }
    }
    /* THE ROW SUM IS TAKEN ONCE, BEFORE ANY DIVISION. Computing it inside the
       divide loop shrinks it as it goes, so P never sums to 1 — and the
       gradient below is derived assuming it does. That bug survived every
       check except the numerical-gradient one. */
    let rs = 0;
    for (let k = 0; k < n; k += 1) rs += P[i][k];
    if (rs === 0) rs = 1e-12;
    for (let j = 0; j < n; j += 1) P[i][j] /= rs;
    betas[i] = beta;
    worst = Math.max(worst, Math.abs(Math.exp(H) - perplexity));
  }
  return { P, betas, worstPerplexityError: worst, bisectionIters: iters };
}

/* p_ij = (p_j|i + p_i|j) / 2n — the symmetrised joint of the notebook's cell 40,
   and the form that makes the whole matrix sum to 1. */
export function joint(Pc) {
  const n = Pc.length, P = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i += 1)
    for (let j = 0; j < n; j += 1) P[i][j] = (Pc[i][j] + Pc[j][i]) / (2 * n);
  return P;
}

/* Q, the Student-t affinities, and the gradient. Returned together because they
   share the (1 + d^2)^-1 weights, which is most of the arithmetic. */
export function qAndGrad(Y, P) {
  const n = Y.length;
  const W = Array.from({ length: n }, () => new Float64Array(n));
  let Z = 0;
  for (let i = 0; i < n; i += 1)
    for (let j = i + 1; j < n; j += 1) {
      const dx = Y[i][0] - Y[j][0], dy = Y[i][1] - Y[j][1];
      const w = 1 / (1 + dx * dx + dy * dy);
      W[i][j] = w; W[j][i] = w; Z += 2 * w;
    }
  if (Z === 0) Z = 1e-12;
  const G = Array.from({ length: n }, () => [0, 0]);
  let kl = 0;
  for (let i = 0; i < n; i += 1)
    for (let j = 0; j < n; j += 1) {
      if (i === j) continue;
      const q = Math.max(W[i][j] / Z, 1e-12);
      const m = 4 * (P[i][j] - q) * W[i][j];
      G[i][0] += m * (Y[i][0] - Y[j][0]);
      G[i][1] += m * (Y[i][1] - Y[j][1]);
      if (P[i][j] > 0) kl += P[i][j] * Math.log(P[i][j] / q);
    }
  return { G, kl, Z, W };
}

export function klOnly(Y, P) { return qAndGrad(Y, P).kl; }

/* The descent sklearn and Rtsne both run. `path` holds every iterate, so an
   animation is a reveal of already-computed data (invariant 2) — nothing here
   runs per frame.

   A STEP OF THE ANIMATION IS NOT ONE OF THESE. The picture needs the full
   1000 and is worse than useless partway: silhouette 0.21 at 250, 0.02 at 300,
   0.66 at 1000. Show ~25 iterations a step. */
export function tsne(X, { perplexity = 5, iters = 1000, eta = 200, exaggeration = 12,
                          switchAt = 250, seed = 1, init = "random" } = {}) {
  const n = X.length, rng = makeRng(seed);
  const D = sqDists(X);
  const c = condP(D, perplexity);
  const P0 = joint(c.P);
  let Y;
  if (init === "random") Y = Array.from({ length: n }, () => [rng.normal(0, 1e-4), rng.normal(0, 1e-4)]);
  else Y = init.map((p) => p.slice());
  const up = Array.from({ length: n }, () => [0, 0]);
  const gains = Array.from({ length: n }, () => [1, 1]);
  const path = [Y.map((p) => p.slice())], kls = [];
  for (let it = 0; it < iters; it += 1) {
    const ex = it < switchAt ? exaggeration : 1;
    const P = ex === 1 ? P0 : P0.map((r) => r.map((v) => v * ex));
    const { G, kl } = qAndGrad(Y, P);
    kls.push(kl);
    const mom = it < switchAt ? 0.5 : 0.8;
    for (let i = 0; i < n; i += 1)
      for (let d = 0; d < 2; d += 1) {
        gains[i][d] = Math.sign(G[i][d]) !== Math.sign(up[i][d])
          ? gains[i][d] + 0.2 : Math.max(gains[i][d] * 0.8, 0.01);
        up[i][d] = mom * up[i][d] - eta * gains[i][d] * G[i][d];
        Y[i][d] += up[i][d];
      }
    /* Recentred every step, so the arrangement stays in the middle of its panel
       for the whole run. It changes no distance, and the objective is a
       function of distances alone. */
    const mx = Y.reduce((s, p) => s + p[0], 0) / n, my = Y.reduce((s, p) => s + p[1], 0) / n;
    for (const p of Y) { p[0] -= mx; p[1] -= my; }
    path.push(Y.map((p) => p.slice()));
  }
  /* `kls` is measured against the P each step was minimising, which is the
     exaggerated one for the first 250. That number is ~45 there against ~2
     after, so a chart cannot use it — measure against P0 instead. Widget 20's
     raw-stress-versus-stress-1 decision, arriving again. */
  return { path, kls, betas: c.betas, P0, D, diag: c };
}
