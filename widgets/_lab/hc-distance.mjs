/* ============================================================================
   Can DISTANCE be a control? Measured, before it is drawn.

     node widgets/_lab/hc-distance.mjs

   The notebook gives distance its own section and five measures — Euclidean,
   Manhattan, cosine, Pearson, Jaccard — then uses Euclidean for everything
   after it. The question for the widget is not whether students expect the
   control, but whether it can do anything HONEST on a stage they can see.

   Act 1's stage is 2-D so the points can be plotted. Act 2's rows are
   20-vectors and its columns 50-vectors. Those are different situations and
   this file measures both.
   ========================================================================= */

import { stage, cluster, cut, canonical, heatStage, HEAT_GENES } from "../hierarchical-clustering/model.js";
import { makeRng } from "../core/rng.js";

/* The five, as distance functions over equal-length vectors. */
const DISTANCES = {
  euclidean: (a, b) => Math.hypot(...a.map((v, i) => v - b[i])),
  manhattan: (a, b) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0),
  cosine: (a, b) => {
    const dot = a.reduce((s, v, i) => s + v * b[i], 0);
    const na = Math.hypot(...a);
    const nb = Math.hypot(...b);
    return 1 - dot / (na * nb || 1);
  },
  pearson: (a, b) => {
    const m = (v) => v.reduce((s, x) => s + x, 0) / v.length;
    const ma = m(a);
    const mb = m(b);
    let num = 0;
    let da = 0;
    let db = 0;
    for (let i = 0; i < a.length; i += 1) {
      num += (a[i] - ma) * (b[i] - mb);
      da += (a[i] - ma) ** 2;
      db += (b[i] - mb) ** 2;
    }
    const r = num / (Math.sqrt(da * db) || 1);
    return 1 - r;
  },
};

function distinctValues(vectors, fn, round = 6) {
  const s = new Set();
  for (let i = 0; i < vectors.length; i += 1) {
    for (let j = i + 1; j < vectors.length; j += 1) {
      s.add(fn(vectors[i], vectors[j]).toFixed(round));
    }
  }
  return s;
}

console.log("=== A. ACT 1's 2-D STAGE — what can a distance measure even say? ===\n");
console.log("Twenty points, two coordinates each. A 'profile' of length TWO.\n");
{
  const pts = stage({ separation: 3 }, makeRng(1));
  const vecs = pts.map((p) => [p.x, p.y]);
  const pairs = (20 * 19) / 2;
  for (const [name, fn] of Object.entries(DISTANCES)) {
    const vals = distinctValues(vecs, fn);
    console.log(
      `  ${name.padEnd(10)} ${String(vals.size).padStart(4)} distinct values over ${pairs} pairs` +
      (vals.size <= 4 ? `   <-- DEGENERATE: ${[...vals].join(", ")}` : "")
    );
  }
}

console.log("\n=== B. DO THE USABLE ONES ACTUALLY MOVE THE TREE? (act 1, 2-D) ===\n");
console.log("Euclidean against Manhattan, k=2, ward.D2, 200 seeds per separation.\n");
console.log("  separation   trees identical   cuts identical");
for (const separation of [0, 1, 2, 3]) {
  let sameCut = 0;
  let sameOrder = 0;
  const N = 200;
  for (let seed = 1; seed <= N; seed += 1) {
    const pts = stage({ separation }, makeRng(seed));
    const vecs = pts.map((p) => [p.x, p.y]);
    const te = clusterWith(vecs, DISTANCES.euclidean, "ward.D2");
    const tm = clusterWith(vecs, DISTANCES.manhattan, "ward.D2");
    if (canonical(cut(te, 2)) === canonical(cut(tm, 2))) sameCut += 1;
    if (JSON.stringify(te.merge) === JSON.stringify(tm.merge)) sameOrder += 1;
  }
  console.log(
    `  ${String(separation).padStart(6)}      ${String(Math.round((100 * sameOrder) / N)).padStart(9)}%` +
    `       ${String(Math.round((100 * sameCut) / N)).padStart(9)}%`
  );
}

console.log("\n=== C. ACT 2's MATRIX — 20-vectors and 50-vectors ===\n");
{
  const heat = heatStage({}, makeRng(1));
  console.log(`  gene rows are ${heat.rows[0].length}-vectors, sample columns ${heat.cols[0].length}-vectors\n`);
  const pairs = (HEAT_GENES * (HEAT_GENES - 1)) / 2;
  for (const [name, fn] of Object.entries(DISTANCES)) {
    const vals = distinctValues(heat.rows, fn);
    console.log(`  rows / ${name.padEnd(10)} ${String(vals.size).padStart(5)} distinct over ${pairs} pairs`);
  }

  console.log("\n  And does the ROW cut move with the distance? (cutree_rows = 5, ward.D2)");
  const base = canonical(cut(clusterWith(heat.rows, DISTANCES.euclidean, "ward.D2"), 5));
  for (const [name, fn] of Object.entries(DISTANCES)) {
    const t = clusterWith(heat.rows, fn, "ward.D2");
    const c = canonical(cut(t, 5));
    // how many of the four planted blocks survive whole
    const labels = cut(t, 5);
    const whole = [0, 1, 2, 3].filter((b) => {
      const set = new Set(labels.slice(b * 10, b * 10 + 10));
      return set.size === 1;
    }).length;
    const noiseTogether = new Set(labels.slice(40)).size === 1;
    console.log(
      `    ${name.padEnd(10)} same cut as euclidean: ${String(c === base).padEnd(5)}` +
      `  planted blocks kept whole: ${whole}/4   the 10 noise genes in one box: ${noiseTogether}`
    );
  }
}

/* A clustering that takes an arbitrary distance function. The shipped engine
   hardcodes Euclidean; this is a probe, not a proposal, and it exists to find
   out whether a distance control would be worth adding to it. */
function clusterWith(rows, dist, method) {
  const n = rows.length;
  const active = [];
  for (let i = 0; i < n; i += 1) active.push({ slot: i, size: 1, id: -(i + 1) });
  const D = [];
  for (let i = 0; i < n; i += 1) {
    D.push(new Float64Array(n));
    for (let j = 0; j < n; j += 1) D[i][j] = i === j ? 0 : dist(rows[i], rows[j]);
  }
  const merge = [];
  const height = [];
  const lw = (dki, dkj, dij, ni, nj, nk) => {
    if (method === "complete") return Math.max(dki, dkj);
    if (method === "average") return (ni * dki + nj * dkj) / (ni + nj);
    const N = ni + nj + nk;
    return Math.sqrt(((ni + nk) * dki * dki + (nj + nk) * dkj * dkj - nk * dij * dij) / N);
  };
  for (let step = 1; step <= n - 1; step += 1) {
    let best = Infinity;
    let bi = -1;
    let bj = -1;
    for (let a = 0; a < active.length; a += 1) {
      for (let b = a + 1; b < active.length; b += 1) {
        const d = D[active[a].slot][active[b].slot];
        if (d < best) { best = d; bi = a; bj = b; }
      }
    }
    const ci = active[bi];
    const cj = active[bj];
    merge.push(ci.id < cj.id ? [ci.id, cj.id] : [cj.id, ci.id]);
    height.push(best);
    const merged = { slot: ci.slot, size: ci.size + cj.size, id: step };
    for (const ck of active) {
      if (ck === ci || ck === cj) continue;
      const d = lw(D[ci.slot][ck.slot], D[cj.slot][ck.slot], best, ci.size, cj.size, ck.size);
      D[merged.slot][ck.slot] = d;
      D[ck.slot][merged.slot] = d;
    }
    active.splice(bj, 1);
    active.splice(bi, 1, merged);
  }
  return { merge, height, n };
}
