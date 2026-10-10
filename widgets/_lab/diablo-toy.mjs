// Slot 100's Method example, measured before the mock: two blocks of two
// features on the same 80 samples, sharing a large axis that has nothing to
// do with the two subtypes (the LV3 finding on TCGA: r 0.85, subtype share
// 0.02), each with the subtype on an axis of its own.
//
// mixOmics' block.plsda written out (sparse.mint.block_iteration, horst
// scheme; init svd.single = each block's own first right singular vector;
// every feature scaled; Y as its indicator matrix, scaled, linked to each
// block at 1), so `diablo-measure.R toy` can check it against the library.
//
//   node diablo-toy.mjs [seed]     writes _lab/diablo-toy.csv and -toy-js.json

import { writeFileSync } from "node:fs";
import { makeRng } from "../core/rng.js";

const seed = Number(process.argv[2] ?? 100);
const rng = makeRng(seed);
const N = 80;
const unitAt = (deg) => [Math.cos((deg * Math.PI) / 180), Math.sin((deg * Math.PI) / 180)];
const ANG = { ha: 35, za: 115, hb: 145, zb: 60 };
const ha = unitAt(ANG.ha), za = unitAt(ANG.za), hb = unitAt(ANG.hb), zb = unitAt(ANG.zb);

const g = [], A0 = [], B0 = [];
for (let i = 0; i < N; i++) {
  const grp = i % 2;
  const h = 1.8 * rng.normal();
  const z = (grp ? 0.8 : -0.8) + 0.4 * rng.normal();
  g.push(grp);
  A0.push([0, 1].map((j) => h * ha[j] + z * za[j] + 0.25 * rng.normal()));
  B0.push([0, 1].map((j) => h * hb[j] + z * zb[j] + 0.25 * rng.normal()));
}

const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;
const col = (X, j) => X.map((r) => r[j]);
function scale(X) {
  const p = X[0].length, m = [], s = [];
  for (let j = 0; j < p; j++) {
    const c = col(X, j); m[j] = mean(c);
    s[j] = Math.sqrt(c.reduce((a, x) => a + (x - m[j]) ** 2, 0) / (c.length - 1));
  }
  return X.map((r) => r.map((x, j) => (x - m[j]) / s[j]));
}
const norm = (v) => { const n = Math.hypot(...v); return v.map((x) => x / n); };
const proj = (X, w) => X.map((r) => r.reduce((a, x, j) => a + x * w[j], 0));
const xtz = (X, z) => X[0].map((_, j) => X.reduce((a, r, i) => a + r[j] * z[i], 0));
const corr = (a, b) => {
  const ma = mean(a), mb = mean(b); let ab = 0, aa = 0, bb = 0;
  a.forEach((x, i) => { ab += (x - ma) * (b[i] - mb); aa += (x - ma) ** 2; bb += (b[i] - mb) ** 2; });
  return ab / Math.sqrt(aa * bb);
};
/** first right singular vector by power iteration on XᵀX */
function pc1(X) {
  let v = norm(X[0].map((_, j) => 1 + 0.1 * j));
  for (let k = 0; k < 500; k++) v = norm(xtz(X, proj(X, v)));
  return v;
}
const eta = (t) => {
  const mt = mean(t); let b = 0;
  for (const k of [0, 1]) { const v = t.filter((_, i) => g[i] === k); b += v.length * (mean(v) - mt) ** 2; }
  return b / t.reduce((a, x) => a + (x - mt) ** 2, 0);
};
const ang = (w) => (Math.atan2(w[1], w[0]) * 180) / Math.PI;

const A = scale(A0), B = scale(B0);
const Yd = scale(g.map((k) => (k ? [0, 1] : [1, 0])));
const blocks = [A, B, Yd];

function sgcca(wt, maxIter = 100) {
  const C = [[0, wt, 1], [wt, 0, 1], [1, 1, 0]];
  let W = blocks.map(pc1);
  let T = blocks.map((X, q) => proj(X, W[q]));
  const frames = [{ W: W.map((w) => [...w]), T: T.map((t) => [...t]) }];
  for (let it = 0; it < maxIter; it++) {
    const old = W.map((w) => [...w]);
    for (let q = 0; q < 3; q++) {
      const Z = T[0].map((_, i) => C[q].reduce((a, c, l) => a + c * T[l][i], 0));
      W[q] = norm(xtz(blocks[q], Z));
      T[q] = proj(blocks[q], W[q]);
    }
    frames.push({ W: W.map((w) => [...w]), T: T.map((t) => [...t]) });
    const diff = Math.max(...W.map((w, q) => w.reduce((a, x, j) => a + (x - old[q][j]) ** 2, 0)));
    if (diff < 1e-6) break;
  }
  return { W, T, frames };
}

writeFileSync(new URL("./diablo-toy.csv", import.meta.url),
  ["a1,a2,b1,b2,g", ...A0.map((r, i) => [...r, ...B0[i]].map((x) => x.toFixed(6)).join(",") + "," + g[i])].join("\n") + "\n");

const out = { seed, ANG, fits: [] };
// the directions to read the fits against, in the scaled blocks
const subDir = (X) => norm(xtz(X, g.map((k) => (k ? 0.5 : -0.5))));
const shared = (() => { // PLS of A and B alone (99's answer): the weight-1, no-Y limit
  let wb = pc1(B);
  for (let k = 0; k < 500; k++) { const wa = norm(xtz(A, proj(B, wb))); wb = norm(xtz(B, proj(A, wa))); }
  return { wa: norm(xtz(A, proj(B, wb))), wb };
})();
out.ref = { pc1A: pc1(A), pc1B: pc1(B), subA: subDir(A), subB: subDir(B), plsA: shared.wa, plsB: shared.wb };
const report = (lab, wa, wb) => {
  const ta = proj(A, wa), tb = proj(B, wb);
  console.log(`${lab.padEnd(10)} wA ${wa.map((x) => x.toFixed(3)).join(",")} (${ang(wa).toFixed(0)}°)  wB ${wb.map((x) => x.toFixed(3)).join(",")} (${ang(wb).toFixed(0)}°)  r(tA,tB) ${corr(ta, tb).toFixed(3)}  eta² tA ${eta(ta).toFixed(2)} tB ${eta(tb).toFixed(2)}`);
};
report("PC1", out.ref.pc1A, out.ref.pc1B);
report("subtype", out.ref.subA, out.ref.subB);
report("PLS A-B", out.ref.plsA, out.ref.plsB);
for (const wt of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
  const f = sgcca(wt);
  report(`w=${wt}`, f.W[0], f.W[1]);
  console.log(`           iterations ${f.frames.length - 1}; mRNA angle by update: ${f.frames.slice(0, 7).map((F) => ang(F.W[0]).toFixed(0)).join(" → ")}`);
  out.fits.push({ w: wt, wA: f.W[0], wB: f.W[1], r: corr(f.T[0], f.T[1]), eta: [eta(f.T[0]), eta(f.T[1])], iters: f.frames.length - 1 });
}
writeFileSync(new URL("./diablo-toy-js.json", import.meta.url), JSON.stringify(out, null, 1));
