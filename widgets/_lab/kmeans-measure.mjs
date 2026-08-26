/* ============================================================================
   Every number docs/catalogue.md § NEXT · K-Means quotes, measured in the
   engine that would ship — `widgets/kmeans/model.js`, imported, not copied.

   Run: node widgets/_lab/kmeans-measure.mjs

   NOT DEPLOYED — `widgets/_lab/` is excluded from the build.
   ========================================================================= */

import { makeRng } from "../core/rng.js";
import { stage as sphereStage } from "../umap/model.js";
import { pcaPlane } from "../umap/model.js";
import {
  lloyd, forgy, kmeansPlusPlus, silhouette, adjustedRand, blobs, cloud, spreadFor,
} from "../kmeans/model.js";

const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : String(x));
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a) => Math.sqrt(mean(a.map((x) => (x - mean(a)) ** 2)));
const head = (s) => console.log(`\n${"=".repeat(74)}\n${s}\n${"=".repeat(74)}`);

const pts = (st) => st.map((s) => s.p);
const truth = (st) => st.map((s) => s.g);

/** One run of Lloyd from a fresh init, mirroring sklearn's `n_init`: fit
    `tries` times and keep the lowest inertia. */
function fit(X, K, seed, { tries = 1, init = "k-means++" } = {}) {
  const rng = makeRng(seed);
  let best = null;
  for (let t = 0; t < tries; t += 1) {
    const C0 = init === "random" ? forgy(X, K, rng) : kmeansPlusPlus(X, K, rng);
    const run = lloyd(X, K, { init: C0 });
    if (!best || run.inertia < best.inertia) best = run;
  }
  return best;
}

/* --- 1. cost ---------------------------------------------------------------
   The reconnaissance called this question already answered. It is, but the
   catalogue's rule is that a question closes with a number, and this one is
   free to take. */
head("1. COST — is compute-at-runtime real, or is a replayed table needed?");
{
  const rows = [];
  for (const [n, K] of [[48, 2], [48, 4], [48, 8], [120, 4], [400, 6]]) {
    const st = blobs(makeRng(1), { groups: 3, per: Math.round(n / 3) });
    const X = pts(st);
    const reps = 200;
    const t0 = process.hrtime.bigint();
    for (let r = 0; r < reps; r += 1) fit(X, K, 100 + r);
    const t1 = process.hrtime.bigint();
    const run = fit(X, K, 1);
    rows.push([X.length, K, Number(t1 - t0) / 1e6 / reps, run.iters]);
  }
  console.log("     n    K   ms per fit (init + Lloyd to convergence)   iters");
  for (const [n, K, ms, it] of rows) {
    console.log(`  ${String(n).padStart(4)} ${String(K).padStart(4)}   ${f(ms, 3).padStart(8)} ms${" ".repeat(24)}${it}`);
  }
  const st = blobs(makeRng(1), { groups: 3, per: 16 });
  const X = pts(st);
  const reps = 100;
  const t0 = process.hrtime.bigint();
  for (let r = 0; r < reps; r += 1) for (let K = 1; K <= 8; K += 1) fit(X, K, 7, { tries: 10 });
  const t1 = process.hrtime.bigint();
  console.log(`\n  the whole K = 1..8 sweep at n = 48, 10 inits each: ${f(Number(t1 - t0) / 1e6 / reps, 2)} ms`);
}

/* --- 2. the engine is the library's -----------------------------------------
   Written out for `kmeans-verify.mjs` to compare against; here we only report
   the fixtures so the two files cannot drift on what they mean by a stage. */
head("2. EMPTY CLUSTERS — how often the one divergence from sklearn can fire");
{
  let runs = 0;
  let hit = 0;
  const worst = [];
  for (const groups of [2, 3, 4]) {
    for (let K = 2; K <= 8; K += 1) {
      for (let seed = 1; seed <= 40; seed += 1) {
        const X = pts(blobs(makeRng(seed), { groups, per: Math.round(48 / groups) }));
        for (const init of ["k-means++", "random"]) {
          const run = fit(X, K, seed, { init });
          runs += 1;
          const empties = run.steps.filter((s) => s.kind === "update" && s.empty.length);
          if (empties.length) { hit += 1; worst.push(`${groups}g K=${K} ${init} seed ${seed}`); }
        }
      }
    }
  }
  console.log(`  ${hit} of ${runs} runs empty a cluster at any step  (${f((100 * hit) / runs, 1)}%)`);
  if (worst.length) console.log(`  first few: ${worst.slice(0, 6).join(", ")}`);
}

/* --- 3. K is not something the objective can choose ------------------------ */
head("3. \"MUST SPECIFY K IN ADVANCE\" — sweep K on a stage with THREE real groups");
{
  const st = blobs(makeRng(3), { groups: 3, per: 16 });
  const X = pts(st);
  const y = truth(st);
  console.log("    K    inertia    fall vs K-1    silhouette      ARI vs truth");
  let prev = null;
  for (let K = 1; K <= 8; K += 1) {
    const run = fit(X, K, 11, { tries: 10 });
    const sil = K > 1 ? silhouette(X, run.labels) : NaN;
    const ari = adjustedRand(y, run.labels);
    const fall = prev === null ? "" : `${f((100 * (prev - run.inertia)) / prev, 1)}%`;
    console.log(`  ${String(K).padStart(3)}   ${f(run.inertia, 2).padStart(7)}      ${fall.padStart(7)}       ${K > 1 ? f(sil) : "  —  "}         ${f(ari)}`);
    prev = run.inertia;
  }
  const over = [1, 2, 3, 4, 5].map((s) => {
    const stx = blobs(makeRng(s), { groups: 3, per: 16 });
    const Xs = pts(stx);
    const ys = truth(stx);
    return [2, 3, 4].map((K) => {
      const run = fit(Xs, K, 11, { tries: 10 });
      return [silhouette(Xs, run.labels), adjustedRand(ys, run.labels)];
    });
  });
  for (const [i, K] of [2, 3, 4].entries()) {
    console.log(`  across 5 stage seeds, K = ${K}: silhouette ${f(mean(over.map((o) => o[i][0])))} ± ${f(sd(over.map((o) => o[i][0])), 3)}   ARI ${f(mean(over.map((o) => o[i][1])))} ± ${f(sd(over.map((o) => o[i][1])), 3)}`);
  }
}

/* --- 4. a cloud with no groups in it --------------------------------------- */
head("4. THE CLOUD — K-Means returns K clusters from data that has none");
{
  const sils = { 2: [], 3: [], 4: [] };
  for (let seed = 1; seed <= 40; seed += 1) {
    const X = pts(cloud(makeRng(seed), { n: 48 }));
    for (const K of [2, 3, 4]) sils[K].push(silhouette(X, fit(X, K, 200 + seed, { tries: 10 }).labels));
  }
  const real = { 2: [], 3: [], 4: [] };
  for (let seed = 1; seed <= 40; seed += 1) {
    const X = pts(blobs(makeRng(seed), { groups: 3, per: 16 }));
    for (const K of [2, 3, 4]) real[K].push(silhouette(X, fit(X, K, 200 + seed, { tries: 10 }).labels));
  }
  console.log("        silhouette on a structureless cloud     on three real groups");
  for (const K of [2, 3, 4]) {
    console.log(`  K=${K}       ${f(mean(sils[K]))} ± ${f(sd(sils[K]), 3)} (40 seeds)          ${f(mean(real[K]))} ± ${f(sd(real[K]), 3)}`);
  }
  const overlap = sils[3].filter((s) => s > Math.min(...real[3])).length;
  console.log(`\n  cloud runs scoring above the WORST real-group run: ${overlap} of 40`);
}

/* --- 5. initial placement, and what sklearn's defaults hide ---------------- */
head("5. \"SENSITIVE TO INITIAL CENTROID PLACEMENT\" — 60 restarts per setting");
{
  /* TWO EARLIER CRITERIA WERE BOTH WRONG and both are worth recording.
     "inertia above the best" counted 3.94 against 3.92 — one point swapped —
     as a failure. "ARI against the truth below 0.9" then counted 60 of 60 at
     six groups, because at per = 8 the groups genuinely overlap and even the
     global optimum only reaches 0.80: that measures the STAGE, not the init.
     What the reader actually sees is a DIFFERENT PICTURE from the same data,
     so the count is of restarts that do not reach the best partition found,
     and the stage is separated enough that the best partition is the truth. */
  /* THE WIDGET'S OWN STAGE RULE, `spreadFor(groups)` — the spread scales with
     the gap, so these rows differ in the number of clusters and in nothing
     else. An earlier pass used hand-picked spreads and the rows were not
     comparable to each other or to what ships. */
  for (const groups of [3, 4, 6]) {
    const st = blobs(makeRng(3), { groups, per: Math.round(48 / groups) });
    const X = pts(st);
    const y = truth(st);
    console.log(`\n  ${groups} groups of ${Math.round(48 / groups)}, spread ${f(spreadFor(groups), 3)}, K = ${groups}` +
      `   (the best partition found scores ARI ${f(adjustedRand(y, fit(X, groups, 1, { tries: 200 }).labels))} against the truth)`);
    for (const [label, opts] of [
      ["random init, n_init=1  ", { init: "random", tries: 1 }],
      ["random init, n_init=10 ", { init: "random", tries: 10 }],
      ["k-means++,   n_init=1  ", { init: "k-means++", tries: 1 }],
      ["k-means++,   n_init=10 ", { init: "k-means++", tries: 10 }],
    ]) {
      const res = [];
      for (let seed = 1; seed <= 60; seed += 1) res.push(fit(X, groups, seed, opts));
      const best = Math.min(...res.map((r) => r.inertia));
      const missed = res.filter((r) => r.inertia > best * 1.02);
      const bestRun = res.find((r) => r.inertia === best);
      const away = missed.map((r) => adjustedRand(bestRun.labels, r.labels));
      const aris = res.map((r) => adjustedRand(y, r.labels));
      console.log(`    ${label}  missed the best partition: ${String(missed.length).padStart(2)}/60` +
        `   ARI vs truth ${f(mean(aris))} (min ${f(Math.min(...aris))})` +
        (away.length ? `   a missed run agrees with the best one at ARI ${f(mean(away))}` : ""));
    }
  }
}

/* --- 6. shape and size ----------------------------------------------------- */
head("6. \"ASSUMES CLUSTERS ARE SPHERICAL AND SIMILAR SIZE\" — 20 stage seeds each");
{
  const cases = [
    ["round, equal          ", { groups: 2, per: 24, aspect: 1 }],
    ["elongated 3:1         ", { groups: 2, per: 24, aspect: 3 }],
    ["elongated 5:1         ", { groups: 2, per: 24, aspect: 5 }],
    ["elongated 8:1         ", { groups: 2, per: 24, aspect: 8 }],
    ["equal n, 3x width     ", { groups: 2, per: 24, spreads: [1, 3] }],
    ["4x count, equal width ", { groups: 2, per: 24, sizes: [1.6, 0.4] }],
    ["4x count AND 3x width ", { groups: 2, per: 24, sizes: [1.6, 0.4], spreads: [3, 1] }],
  ];
  console.log("  stage                    ARI vs truth        silhouette of the ANSWER");
  for (const [label, opt] of cases) {
    const aris = [];
    const sils = [];
    for (let seed = 1; seed <= 20; seed += 1) {
      const st = blobs(makeRng(seed), opt);
      const X = pts(st);
      const run = fit(X, 2, 500 + seed, { tries: 10 });
      aris.push(adjustedRand(truth(st), run.labels));
      sils.push(silhouette(X, run.labels));
    }
    console.log(`  ${label}   ${f(mean(aris))} ± ${f(sd(aris), 3)}       ${f(mean(sils))} ± ${f(sd(sils), 3)}`);
  }
}

/* --- 7. cell 53's question: WHICH SPACE does it cluster in? ---------------- */
head("7. WHICH SPACE — cluster in the data, or in the 2-D picture of it?");
{
  console.log("  the arc's own stage: `groups` caps on a sphere of radius 2 (widgets 20-22),");
  console.log("  clustered in 3-D and in its PCA plane, K = the true number of groups.\n");
  console.log("  groups  per   ARI in 3-D      ARI in the 2-D plane   labelings differ");
  const keep = [];
  for (const [groups, per] of [[2, 24], [3, 16], [4, 12], [6, 8]]) {
    const a3 = [];
    const a2 = [];
    const s2of2 = [];
    const s2of3 = [];
    let differ = 0;
    for (let seed = 1; seed <= 20; seed += 1) {
      const st = sphereStage(groups, per, makeRng(seed));
      const X = st.map((s) => s.p);
      const y = st.map((s) => s.g);
      const Y = pcaPlane(X).Y;
      const r3 = fit(X, groups, 900 + seed, { tries: 10 });
      const r2 = fit(Y, groups, 900 + seed, { tries: 10 });
      a3.push(adjustedRand(y, r3.labels));
      a2.push(adjustedRand(y, r2.labels));
      /* Both scored IN THE PICTURE, which is the only place a reader can see
         them — and the whole point: the picture's own score endorses the
         answer that was fitted to the picture. */
      s2of2.push(silhouette(Y, r2.labels));
      s2of3.push(silhouette(Y, r3.labels));
      if (adjustedRand(r3.labels, r2.labels) < 0.999) differ += 1;
    }
    console.log(`  ${String(groups).padStart(4)} ${String(per).padStart(5)}   ${f(mean(a3))} ± ${f(sd(a3), 3)}   ${f(mean(a2))} ± ${f(sd(a2), 3)}          ${differ}/20`);
    keep.push([groups, mean(s2of2), mean(s2of3), mean(a2), mean(a3)]);
  }
  console.log("\n  scored in the 2-D picture, which is all a reader can see:");
  console.log("  groups   silhouette of the 2-D answer   of the 3-D answer   (ARI 2-D / 3-D)");
  for (const [g, s2, s3, a2, a3] of keep) {
    console.log(`  ${String(g).padStart(4)}     ${f(s2)}                         ${f(s3)}         (${f(a2)} / ${f(a3)})`);
  }
}

/* --- 8. where "spherical" tips over ---------------------------------------- */
head("8. THE ASPECT THRESHOLD — 3:1 survives and 5:1 does not, so where?");
{
  console.log("  aspect   ARI vs truth (30 stage seeds)     runs with ARI < 0.9");
  for (const aspect of [1, 2, 3, 3.5, 4, 4.5, 5, 6, 8]) {
    const aris = [];
    for (let seed = 1; seed <= 30; seed += 1) {
      const st = blobs(makeRng(seed), { groups: 2, per: 24, aspect });
      const run = fit(pts(st), 2, 700 + seed, { tries: 10 });
      aris.push(adjustedRand(truth(st), run.labels));
    }
    console.log(`  ${String(aspect).padStart(5)}    ${f(mean(aris))} ± ${f(sd(aris), 3)}                  ${aris.filter((a) => a < 0.9).length}/30`);
  }
}

console.log("");
