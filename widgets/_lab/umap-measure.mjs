/* ============================================================================
   The measurements docs/catalogue.md § NEXT · UMAP quotes, run in the engine
   that would ship rather than in Python. Same construction as umapstage.py, a
   different generator (core's mulberry32 against numpy's PCG), so the numbers
   are comparable in kind and not to the digit — where both are quoted the
   catalogue says which.

   Run: node widgets/_lab/umap-measure.mjs
   ========================================================================= */

import { umap, fuzzySet, findAbParams } from "../umap/model.js";
import { makeRng } from "../core/rng.js";

/* --- the stage, and the metrics ---------------------------------------------
   Widget 21's: `g` centres on a sphere of radius 2, `per` samples scattered by
   0.62 around each. */
const R = 2, SIGMA = 0.62;
const CENTRES = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]
  .map((c) => { const m = Math.hypot(...c) / R; return c.map((v) => v / m); });

function stage(seed, per = 12, g = 4, sigma = SIGMA) {
  const rng = makeRng(seed), X = [], y = [];
  for (let i = 0; i < g; i += 1)
    for (let p = 0; p < per; p += 1) {
      X.push(CENTRES[i].map((c) => c + rng.normal(0, sigma)));
      y.push(i);
    }
  return { X, y };
}

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a) => Math.sqrt(mean(a.map((x) => (x - mean(a)) ** 2)));
const dist = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

function knnSets(A, k) {
  return A.map((p, i) => new Set(
    A.map((q, j) => [dist(p, q), j]).filter(([, j]) => j !== i)
      .sort((u, v) => u[0] - v[0]).slice(0, k).map(([, j]) => j)));
}
/** what UMAP KNOWS: how much of each point's true neighbourhood survives. */
function retention(X, Y, k = 5) {
  const a = knnSets(X, k), b = knnSets(Y, k);
  return mean(a.map((s, i) => [...s].filter((j) => b[i].has(j)).length / k));
}
/** how tight the clusters LOOK: mean within-cluster radius over mean gap. */
function tightness(Y, y) {
  const gs = [...new Set(y)];
  const cs = gs.map((g) => {
    const m = Y.filter((_, i) => y[i] === g);
    return [mean(m.map((p) => p[0])), mean(m.map((p) => p[1]))];
  });
  const within = mean(gs.map((g, q) => mean(Y.filter((_, i) => y[i] === g).map((p) => dist(p, cs[q])))));
  const gaps = [];
  for (let i = 0; i < cs.length; i += 1)
    for (let j = i + 1; j < cs.length; j += 1) gaps.push(dist(cs[i], cs[j]));
  return within / mean(gaps);
}
function silhouette(Y, y) {
  let s = 0;
  for (let i = 0; i < Y.length; i += 1) {
    const same = [], oth = new Map();
    for (let j = 0; j < Y.length; j += 1) {
      if (i === j) continue;
      const d = dist(Y[i], Y[j]);
      if (y[j] === y[i]) same.push(d);
      else { if (!oth.has(y[j])) oth.set(y[j], []); oth.get(y[j]).push(d); }
    }
    const a = same.length ? mean(same) : 0;
    const b = Math.min(...[...oth.values()].map(mean));
    s += (b - a) / Math.max(a, b);
  }
  return s / Y.length;
}

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const pm = (a) => `${mean(a).toFixed(3)} +-${sd(a).toFixed(3)}`;

/* --- Q1: CAN THE WIDGET COMPUTE? ------------------------------------------- */
console.log("=== Q1 · what compute() would cost, node on this machine ===");
console.log(`${"n".padStart(5)} ${"iters".padStart(6)} | ${"fuzzy set".padStart(10)} ` +
            `${"descent".padStart(9)} ${"total".padStart(8)}`);
console.log("-".repeat(46));
for (const [per, iters] of [[6, 500], [12, 200], [12, 500], [12, 800], [24, 500]]) {
  const { X } = stage(1, per);
  const ts = [], tf = [];
  for (let r = 0; r < 5; r += 1) {
    let t0 = performance.now(); fuzzySet(X, 15); tf.push(performance.now() - t0);
    t0 = performance.now(); umap(X, { nNeighbors: 15, minDist: 0.1, iters, seed: 1 });
    ts.push(performance.now() - t0);
  }
  console.log(`${String(X.length).padStart(5)} ${String(iters).padStart(6)} | ` +
    `${(`${mean(tf).toFixed(1)} ms`).padStart(10)} ${(`${(mean(ts) - mean(tf)).toFixed(0)} ms`).padStart(9)} ` +
    `${(`${mean(ts).toFixed(0)} ms`).padStart(8)}`);
}

/* --- Q2: THE ONE SENTENCE -------------------------------------------------- */
console.log("\n=== Q2 · min_dist changes how it LOOKS, not what it KNOWS ===");
console.log(`${"min_dist".padStart(9)} ${"a".padStart(7)} ${"b".padStart(7)} | ` +
            `${"5-NN retention".padStart(16)} | ${"tightness".padStart(16)} | ${"silhouette".padStart(16)}`);
console.log("-".repeat(80));
const mdRows = {};
for (const md of [0.0, 0.05, 0.1, 0.25, 0.5, 0.8, 0.99]) {
  const { a, b } = findAbParams(1, md);
  const rt = [], tg = [], sl = [];
  for (const s of SEEDS) {
    const { X, y } = stage(s);
    const { Y } = umap(X, { nNeighbors: 15, minDist: md, iters: 500, seed: s });
    rt.push(retention(X, Y)); tg.push(tightness(Y, y)); sl.push(silhouette(Y, y));
  }
  mdRows[md] = { rt, tg };
  console.log(`${String(md).padStart(9)} ${a.toFixed(3).padStart(7)} ${b.toFixed(3).padStart(7)} | ` +
    `${pm(rt).padStart(16)} | ${pm(tg).padStart(16)} | ${pm(sl).padStart(16)}`);
}
const lo = mdRows[0.0], hi = mdRows[0.99];
const dRet = hi.rt.map((v, i) => v - lo.rt[i]);
const rTig = hi.tg.map((v, i) => v / lo.tg[i]);
console.log(`\n  PAIRED per seed, min_dist 0.0 -> 0.99:`);
console.log(`    retention  ${mean(dRet) >= 0 ? "+" : ""}${mean(dRet).toFixed(4)}  ` +
  `(range ${Math.min(...dRet).toFixed(3)} .. ${Math.max(...dRet).toFixed(3)}), ` +
  `moved past seed noise on ${dRet.filter((d) => Math.abs(d) > 0.05).length}/${SEEDS.length} seeds`);
console.log(`    tightness  x${mean(rTig).toFixed(2)}  ` +
  `(range ${Math.min(...rTig).toFixed(2)} .. ${Math.max(...rTig).toFixed(2)}), ` +
  `looser on ${rTig.filter((r) => r > 1).length}/${SEEDS.length} seeds`);

/* --- the contrast: n_neighbors DOES change what it knows ------------------- */
console.log("\n=== the contrast · n_neighbors, the same two measures ===");
console.log(`${"n_neighbors".padStart(11)} | ${"5-NN retention".padStart(16)} | ` +
            `${"tightness".padStart(16)} | ${"silhouette".padStart(16)}`);
console.log("-".repeat(70));
const nnRows = {};
for (const k of [2, 3, 5, 10, 15, 25, 40, 47]) {
  const rt = [], tg = [], sl = [];
  for (const s of SEEDS) {
    const { X, y } = stage(s);
    const { Y } = umap(X, { nNeighbors: k, minDist: 0.1, iters: 500, seed: s });
    rt.push(retention(X, Y)); tg.push(tightness(Y, y)); sl.push(silhouette(Y, y));
  }
  nnRows[k] = rt;
  console.log(`${String(k).padStart(11)} | ${pm(rt).padStart(16)} | ${pm(tg).padStart(16)} | ${pm(sl).padStart(16)}`);
}
const dnn = nnRows[40].map((v, i) => v - nnRows[2][i]);
console.log(`\n  PAIRED per seed, n_neighbors 2 -> 40: retention ` +
  `${mean(dnn) >= 0 ? "+" : ""}${mean(dnn).toFixed(4)} ` +
  `(range ${Math.min(...dnn).toFixed(3)} .. ${Math.max(...dnn).toFixed(3)}), ` +
  `up on ${dnn.filter((d) => d > 0).length}/${SEEDS.length} seeds`);

/* --- what a STEP can be ---------------------------------------------------- */
console.log("\n=== where the arrangement becomes honest (widget 21: a step != one iteration) ===");
console.log(`${"iters".padStart(6)} | ${"5-NN retention".padStart(16)} | ${"tightness".padStart(16)} | ` +
            `${"silhouette".padStart(16)} | ${"cross-entropy".padStart(14)}`);
console.log("-".repeat(84));
for (const it of [1, 10, 25, 50, 100, 150, 200, 300, 500, 800]) {
  const rt = [], tg = [], sl = [], ce = [];
  for (const s of SEEDS) {
    const { X, y } = stage(s);
    const { Y, curve } = umap(X, { nNeighbors: 15, minDist: 0.1, iters: it, seed: s });
    rt.push(retention(X, Y)); tg.push(tightness(Y, y)); sl.push(silhouette(Y, y));
    ce.push(curve[curve.length - 1]);
  }
  console.log(`${String(it).padStart(6)} | ${pm(rt).padStart(16)} | ${pm(tg).padStart(16)} | ` +
    `${pm(sl).padStart(16)} | ${mean(ce).toFixed(1).padStart(14)}`);
}

/* --- the learning rate, and what a monotone curve costs -------------------- */
console.log("\n=== eta · a chartable descent, and its price ===");
console.log(`${"eta".padStart(6)} | ${"CE rises".padStart(10)} | ${"final CE".padStart(9)} | ` +
            `${"retention".padStart(10)} | ${"tightness".padStart(10)}`);
console.log("-".repeat(60));
for (const eta of [1.0, 0.5, 0.25, 0.1, 0.05]) {
  const rz = [], fz = [], rt = [], tg = [];
  for (const s of SEEDS.slice(0, 6)) {
    const { X, y } = stage(s);
    const { Y, curve } = umap(X, { nNeighbors: 15, minDist: 0.1, iters: 500, eta, seed: s });
    rz.push(curve.slice(1).filter((v, i) => v > curve[i]).length);
    fz.push(curve[curve.length - 1]); rt.push(retention(X, Y)); tg.push(tightness(Y, y));
  }
  console.log(`${String(eta).padStart(6)} | ${(`${mean(rz).toFixed(0)}/500`).padStart(10)} | ` +
    `${mean(fz).toFixed(1).padStart(9)} | ${mean(rt).toFixed(3).padStart(10)} | ${mean(tg).toFixed(3).padStart(10)}`);
}
