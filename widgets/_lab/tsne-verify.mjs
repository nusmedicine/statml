/* Does the JS engine agree with scikit-learn? NOT run by `npm run check` —
   it needs tsne-sklearn-ref.json, which needs Python.

   The engine's own checks (tsne-checks.mjs) prove the gradient is the gradient
   of the KL it computes and that the bisection hits its target. They cannot
   prove the KL, the P or the kernel are the ones t-SNE actually specifies.
   This can, because sklearn's are.

   Three comparisons, in increasing looseness, and the looseness is honest
   rather than convenient:

     P            deterministic given the data and the perplexity. Must match
                  to floating-point noise.
     KL and grad  evaluated at ONE fixed embedding sklearn and JS are both
                  handed, so no descent is involved. Must match likewise.
     embedding    cannot be compared coordinate-wise — the two seed different
                  RNGs and t-SNE has no unique answer. Compared on what the
                  picture is FOR: neighbours kept and group separation, against
                  the spread of sklearn's own five seeds.
   ========================================================================= */
import fs from "node:fs";
import { sqDists, condP, joint, qAndGrad, tsne } from "./tsne-engine.js";

const ref = JSON.parse(fs.readFileSync(new URL("./tsne-sklearn-ref.json", import.meta.url)));

/* THE TOLERANCES ARE MEASURED, NOT FITTED, and the measurement is worth
   keeping because it says something about sklearn rather than about us.

   Sweeping our own bisection tolerance against sklearn's fixed P:

     tol 1e-3  ->  3.8e-5      tol 1e-6  ->  2.0e-7
     tol 1e-4  ->  2.1e-6      tol 1e-8  ->  2.0e-7
     tol 1e-5  ->  5.6e-9      tol 1e-12 ->  2.0e-7

   The agreement is best exactly at 1e-5 — which is sklearn's own tolerance —
   and then STOPS IMPROVING and settles at 2.0e-7 as we converge past it. That
   floor is sklearn's truncation error, not ours: tightening our bisection walks
   us toward the exact answer while the library stays at its approximation.

   So 1e-6 is the honest bar for P: an order of magnitude below the residual we
   actually see at matched tolerance, and comfortably above the library's own
   precision. Anything tighter would be testing sklearn's rounding.

   The embedding comparison carries 5e-5 because the reference JSON rounds those
   summaries to four decimals; without it a value of 0.916666 fails against its
   own rounded self, 0.9167. */
const P_TOL = 1e-6;
const ROUND_TOL = 5e-5;
const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;

function knnKeep(hi, lo, k = 3) {
  const n = hi.length;
  const near = (D, i) => D[i].map((v, j) => [v, j]).filter(([, j]) => j !== i)
    .sort((a, b) => a[0] - b[0]).slice(0, k).map(([, j]) => j);
  const Dh = hi.map((a) => hi.map((b) => d3(a, b)));
  const Dl = lo.map((a) => lo.map((b) => d2(a, b)));
  let s = 0;
  for (let i = 0; i < n; i += 1) {
    const A = new Set(near(Dh, i));
    s += near(Dl, i).filter((j) => A.has(j)).length / k;
  }
  return s / n;
}
function sil(Y, gs) {
  const n = Y.length;
  let t = 0;
  for (let i = 0; i < n; i += 1) {
    const same = [], oth = new Map();
    for (let j = 0; j < n; j += 1) {
      if (i === j) continue;
      const d = d2(Y[i], Y[j]);
      if (gs[j] === gs[i]) same.push(d);
      else { if (!oth.has(gs[j])) oth.set(gs[j], []); oth.get(gs[j]).push(d); }
    }
    const a = same.length ? mean(same) : 0;
    const b = Math.min(...[...oth.values()].map(mean));
    t += (b - a) / Math.max(a, b);
  }
  return t / n;
}

let fail = 0;
console.log(`against scikit-learn ${ref.sklearn} / numpy ${ref.numpy}\n`);

console.log("=== P, the high-dimensional affinities — must match exactly ===");
for (const c of ref.cases) {
  const P = joint(condP(sqDists(c.points), c.perplexity).P);
  let worst = 0, sum = 0;
  for (let i = 0; i < c.n; i += 1)
    for (let j = 0; j < c.n; j += 1) {
      worst = Math.max(worst, Math.abs(P[i][j] - c.P[i][j]));
      sum += P[i][j];
    }
  const ok = worst < P_TOL;
  if (!ok) fail += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} n=${String(c.n).padStart(2)} perp=${String(c.perplexity).padStart(2)}   worst |Pjs - Psk| = ${worst.toExponential(2)}   sum ${sum.toFixed(9)} (sklearn ${c.P_sum.toFixed(9)})`);
}

console.log("\n=== KL and its gradient at an embedding BOTH are handed ===");
for (const c of ref.cases) {
  const P = joint(condP(sqDists(c.points), c.perplexity).P);
  const { kl, G } = qAndGrad(c.probe_Y, P);
  /* Measured: the cosine is 1.000000000000 and the scale is 1.0000 on every
     case, so sklearn's gradient is not merely parallel to ours, it IS ours.
     The scale is printed anyway — if a future sklearn changes the convention,
     that number moves before the cosine does. */
  const g = G.flat(), s = ref.cases && c.probe_grad;
  const dot = g.reduce((t, v, i) => t + v * s[i], 0);
  const nj = Math.hypot(...g), nk = Math.hypot(...s);
  const cos = dot / (nj * nk);
  const scale = nk / nj;
  const dkl = Math.abs(kl - c.probe_kl);
  const ok = dkl < P_TOL && cos > 1 - 1e-9;
  if (!ok) fail += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} n=${String(c.n).padStart(2)} perp=${String(c.perplexity).padStart(2)}   |KLjs - KLsk| = ${dkl.toExponential(2)}   grad cosine ${cos.toFixed(12)}  (sklearn's grad is ${scale.toFixed(4)}x ours)`);
}

console.log("\n=== the embedding — compared on what the picture is FOR ===");
for (const e of ref.embeddings) {
  const groups = e.groups, per = e.per;
  /* the same stage, generated the same way — points come from the reference so
     the two are looking at identical data */
  const c = ref.cases.find((x) => x.groups === groups && x.per === per && x.seed === e.seed);
  const pts = c ? c.points : null;
  if (!pts) { console.log(`  (no stage recorded for ${groups}x${per} seed ${e.seed})`); continue; }
  const gs = [];
  for (let g = 0; g < groups; g += 1) for (let i = 0; i < per; i += 1) gs.push(g);
  const mine = [];
  for (let s = 1; s <= 5; s += 1) {
    const Y = tsne(pts, { perplexity: e.perplexity, iters: 1000, seed: s }).path[1000];
    mine.push({ knn3: knnKeep(pts, Y), sil: sil(Y, gs), kl: qAndGrad(Y, joint(condP(sqDists(pts), e.perplexity).P)).kl });
  }
  const rng = (a) => `${Math.min(...a).toFixed(3)}–${Math.max(...a).toFixed(3)}`;
  const skKnn = e.runs.map((r) => r.knn3), skSil = e.runs.map((r) => r.sil), skKl = e.runs.map((r) => r.kl);
  const myKnn = mine.map((r) => r.knn3), mySil = mine.map((r) => r.sil), myKl = mine.map((r) => r.kl);
  /* the test: our five seeds sit in the same place as sklearn's five, not that
     any one of them matches */
  const overlap = (a, b) => Math.min(...a) <= Math.max(...b) + ROUND_TOL
    && Math.min(...b) <= Math.max(...a) + ROUND_TOL;
  const ok = overlap(myKnn, skKnn) && overlap(mySil, skSil);
  if (!ok) fail += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"} n=${String(e.n).padStart(2)} perp=${String(e.perplexity).padStart(2)}`);
  console.log(`         3-NN kept   js ${rng(myKnn)}   sklearn ${rng(skKnn)}`);
  console.log(`         silhouette  js ${rng(mySil)}   sklearn ${rng(skSil)}`);
  console.log(`         final KL    js ${rng(myKl)}   sklearn ${rng(skKl)}`);
}

console.log(fail === 0 ? "\nall reference comparisons passed" : `\n${fail} COMPARISON(S) FAILED`);
process.exit(fail === 0 ? 0 : 1);
