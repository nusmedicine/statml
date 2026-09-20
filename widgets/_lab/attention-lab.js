/* A single self-attention head with its own backward, for the LAB ONLY:
 * written 2026-09-21 for `positional-encoding-measure.mjs` and the slot 74
 * mock, because no widget has an attention layer yet. Checked against
 * finite differences there (worst relative error 2e-8). If a widget ships
 * on it, it moves into `signal-cnn-lstm/engine.js` beside RNN and LSTM,
 * with the same `{ d, L }` shapes; here it is token-major for legibility.
 *
 * Embedding(V, D) + position → q, k (dk) and v (D) → softmax(q·k / √dk) →
 * z = Σ α v → residual x + z → mean over tokens → Linear(D, 2).
 * `pe`: "none" · "learned" (nn.Embedding(Lmax, D), N(0, 1) rows) ·
 * "sinusoidal" (the lesson's fixed table) · "rope" (nothing added; q and k
 * rotated pair by pair by pos · θ_m). `x.pos`, if present, gives each
 * token's position; else 0..L−1. */

import * as E from "../signal-cnn-lstm/engine.js";

const F = (n) => new Float64Array(n);

/** the lesson's fixed table: angle(pos, i) = pos / 10000^(2(i//2)/d), sin on even, cos on odd */
export function sinusoid(Lmax, D) {
  const P = [];
  for (let p = 0; p < Lmax; p++) { const r = F(D); for (let i = 0; i < D; i++) { const ang = p / Math.pow(10000, (2 * Math.floor(i / 2)) / D); r[i] = i % 2 === 0 ? Math.sin(ang) : Math.cos(ang); } P.push(r); }
  return P;
}

/** RoPE: rotate the (2m, 2m+1) pair of a dk-vector by pos · θ_m, θ_m = 10000^(−2m/dk); `sign` −1 undoes it */
export function rope(v, pos, dk, sign = 1) {
  const out = F(dk);
  for (let m = 0; m < dk / 2; m++) {
    const th = sign * pos * Math.pow(10000, -(2 * m) / dk), c = Math.cos(th), s = Math.sin(th);
    const a = v[2 * m], b = v[2 * m + 1];
    out[2 * m] = c * a - s * b; out[2 * m + 1] = s * a + c * b;
  }
  return out;
}

export function attnModel(rng, { V = 21, D = 16, dk = 8, Lmax = 48, pe = "none" } = {}) {
  const tok = E.param(rng, V * D, 0); for (let i = 0; i < V * D; i++) tok.v[i] = rng.normal(0, 1); for (let e = 0; e < D; e++) tok.v[e] = 0;
  const pos = pe === "learned" ? E.param(rng, Lmax * D, 0) : null; if (pos) for (let i = 0; i < Lmax * D; i++) pos.v[i] = rng.normal(0, 1);
  const sinT = pe === "sinusoidal" ? sinusoid(Lmax, D) : null;
  const Wq = E.param(rng, dk * D, 1 / Math.sqrt(D)), Wk = E.param(rng, dk * D, 1 / Math.sqrt(D)), Wv = E.param(rng, D * D, 1 / Math.sqrt(D));
  const headL = E.Linear(rng, D, 2);
  const sc = 1 / Math.sqrt(dk);
  const matvec = (W, x, rows, cols) => { const y = F(rows); for (let o = 0; o < rows; o++) { let a = 0; for (let i = 0; i < cols; i++) a += W.v[o * cols + i] * x[i]; y[o] = a; } return y; };
  const model = {
    tok, pos, sinT, Wq, Wk, Wv, head: headL, D, dk, pe, Lmax,
    params: [tok, ...(pos ? [pos] : []), Wq, Wk, Wv, ...headL.params],
    /** the position vector added at `p` (zero for none and rope) */
    posVec(p) { const r = F(D); if (pos) for (let e = 0; e < D; e++) r[e] = pos.v[p * D + e]; else if (sinT) for (let e = 0; e < D; e++) r[e] = sinT[p][e]; return r; },
    forward(x) {
      const T = x.L, P = x.pos || Int32Array.from({ length: T }, (_, i) => i);
      const X = [], Q = [], K = [], Vv = [], Qr = [], Kr = [];
      for (let i = 0; i < T; i++) {
        const r = F(D), id = x.tok[i];
        for (let e = 0; e < D; e++) r[e] = tok.v[id * D + e] + (pos ? pos.v[P[i] * D + e] : sinT ? sinT[P[i]][e] : 0);
        X.push(r);
        const q = matvec(Wq, r, dk, D), k = matvec(Wk, r, dk, D);
        Q.push(q); K.push(k); Vv.push(matvec(Wv, r, D, D));
        Qr.push(pe === "rope" ? rope(q, P[i], dk) : q); Kr.push(pe === "rope" ? rope(k, P[i], dk) : k);
      }
      const A = [], Z = [];
      for (let i = 0; i < T; i++) {
        const s = F(T); let m = -Infinity;
        for (let j = 0; j < T; j++) { let a = 0; for (let d = 0; d < dk; d++) a += Qr[i][d] * Kr[j][d]; s[j] = a * sc; if (s[j] > m) m = s[j]; }
        let Zs = 0; for (let j = 0; j < T; j++) { s[j] = Math.exp(s[j] - m); Zs += s[j]; } for (let j = 0; j < T; j++) s[j] /= Zs;
        A.push(s);
        const z = F(D); for (let j = 0; j < T; j++) for (let e = 0; e < D; e++) z[e] += s[j] * Vv[j][e];
        Z.push(z);
      }
      const pooled = F(D); for (let i = 0; i < T; i++) for (let e = 0; e < D; e++) pooled[e] += (X[i][e] + Z[i][e]) / T;
      Object.assign(model, { x, P, X, Q, K, Vv, Qr, Kr, A, Z, T });
      return headL.forward({ d: pooled, L: 1 }).d;
    },
    backward(g) {
      const { x, P, X, Vv, Qr, Kr, A, T } = model;
      const dpool = headL.backward({ d: g, L: 1 }).d;
      const dh = F(D); for (let e = 0; e < D; e++) dh[e] = dpool[e] / T;
      const dX = Array.from({ length: T }, () => Float64Array.from(dh));
      const dV = Array.from({ length: T }, () => F(D)), dQr = Array.from({ length: T }, () => F(dk)), dKr = Array.from({ length: T }, () => F(dk));
      for (let i = 0; i < T; i++) {
        const dA = F(T); let dot = 0;
        for (let j = 0; j < T; j++) { let a = 0; for (let e = 0; e < D; e++) { a += dh[e] * Vv[j][e]; dV[j][e] += A[i][j] * dh[e]; } dA[j] = a; dot += A[i][j] * a; }
        for (let j = 0; j < T; j++) {
          const ds = A[i][j] * (dA[j] - dot) * sc;
          for (let d = 0; d < dk; d++) { dQr[i][d] += ds * Kr[j][d]; dKr[j][d] += ds * Qr[i][d]; }
        }
      }
      for (let i = 0; i < T; i++) {
        const dq = pe === "rope" ? rope(dQr[i], P[i], dk, -1) : dQr[i], dkk = pe === "rope" ? rope(dKr[i], P[i], dk, -1) : dKr[i];
        for (let o = 0; o < dk; o++) for (let e = 0; e < D; e++) { Wq.g[o * D + e] += dq[o] * X[i][e]; dX[i][e] += Wq.v[o * D + e] * dq[o]; Wk.g[o * D + e] += dkk[o] * X[i][e]; dX[i][e] += Wk.v[o * D + e] * dkk[o]; }
        for (let o = 0; o < D; o++) for (let e = 0; e < D; e++) { Wv.g[o * D + e] += dV[i][o] * X[i][e]; dX[i][e] += Wv.v[o * D + e] * dV[i][o]; }
        const id = x.tok[i];
        if (id !== 0) for (let e = 0; e < D; e++) tok.g[id * D + e] += dX[i][e];
        if (pos) for (let e = 0; e < D; e++) pos.g[P[i] * D + e] += dX[i][e];
      }
      return null;
    },
    /** the pre-softmax scores among the tokens */
    scores(x) { model.forward(x); const { Qr, Kr, T } = model; const S = []; for (let i = 0; i < T; i++) { const r = F(T); for (let j = 0; j < T; j++) { let a = 0; for (let d = 0; d < dk; d++) a += Qr[i][d] * Kr[j][d]; r[j] = a * sc; } S.push(r); } return S; },
  };
  return model;
}
export const nParams = (m) => m.params.reduce((p, q) => p + q.v.length, 0);
