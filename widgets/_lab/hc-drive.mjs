/* ============================================================================
   Assertions for `hierarchical-clustering`, with no browser at all.

     node widgets/_lab/hc-drive.mjs

   `hc-verify.mjs` checks the engine against R. THIS file checks the properties
   the FIGURE depends on and R has no opinion about — that the boxes act 2
   draws are contiguous runs, that the cut line lands between the two merges it
   claims to, and that nothing anywhere is NaN.

   Every one of these is something the picture would keep looking plausible
   while getting wrong, which is the only kind of bug worth writing an
   assertion for here.
   ========================================================================= */

import {
  stage, pointVectors, cluster, cut, gapAt, cutHeight, canonical, witness,
  heatStage, noiseBoxes, DISTANCES, N_POINTS, HEAT_GENES, HEAT_SAMPLES, HEAT_PLANTED,
} from "../hierarchical-clustering/model.js";
import { makeRng } from "../core/rng.js";

const OFFERED = ["average", "complete", "ward.D2"];
/* Both distances, everywhere. The first version of this file swept only the
   default, so every assertion below was blind to Manhattan — a control the
   reader can reach on the very first click. */
const METRICS = Object.keys(DISTANCES);
const SEPARATIONS = [0, 1, 2, 3];
const KS = [2, 3, 4, 5, 6];

let checks = 0;
const fails = [];
const ok = (cond, msg) => { checks += 1; if (!cond) fails.push(msg); };

/* -------------------------------------------------------------------------
   ACT 1
   ---------------------------------------------------------------------- */
for (const separation of SEPARATIONS) {
  for (let seed = 1; seed <= 25; seed += 1) {
    const pts = stage({ separation }, makeRng(seed));
    ok(pts.length === N_POINTS, `stage sep=${separation} seed=${seed}: ${pts.length} points`);
    ok(pts.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)),
      `stage sep=${separation} seed=${seed}: a coordinate is not finite`);

    for (const method of OFFERED) {
     for (const metric of METRICS) {
      const tree = cluster(pointVectors(pts), method, metric);
      const tag = `sep=${separation} seed=${seed} ${method}/${metric}`;

      ok(tree.height.length === N_POINTS - 1, `${tag}: ${tree.height.length} merges, expected 19`);
      ok(tree.height.every(Number.isFinite), `${tag}: a merge height is not finite`);

      /* MONOTONE. average, complete and ward.D2 cannot invert — a merge is
         never lower than one before it. Centroid can, which is why it is not
         offered: an inverted tree draws a branch that goes back down and the
         cut line stops meaning anything. A broken Lance-Williams update shows
         up here first. */
      for (let m = 1; m < tree.height.length; m += 1) {
        ok(tree.height[m] >= tree.height[m - 1] - 1e-9,
          `${tag}: height inverts at merge ${m} (${tree.height[m - 1]} -> ${tree.height[m]})`);
      }

      /* The leaf order is a permutation. If it were not, the dendrogram would
         draw two leaves at one x and the picture would still look like a tree. */
      ok(new Set(tree.order).size === N_POINTS && tree.order.length === N_POINTS,
        `${tag}: leaf order is not a permutation of the ${N_POINTS} points`);

      for (const k of KS) {
        const labels = cut(tree, k);
        ok(new Set(labels).size === k, `${tag} k=${k}: got ${new Set(labels).size} clusters`);

        /* CONTIGUITY. Act 2 draws a box per RUN of adjacent rows sharing a
           label, so a cluster split across two runs would silently become two
           boxes — and five boxes drawn for four clusters is a picture nobody
           would question. */
        const seq = tree.order.map((leaf) => labels[leaf]);
        let runCount = 1;
        for (let i = 1; i < seq.length; i += 1) if (seq[i] !== seq[i - 1]) runCount += 1;
        ok(runCount === k, `${tag} k=${k}: ${runCount} runs for ${k} clusters — a box would be split`);

        /* The cut line sits BETWEEN the merge it accepts and the one it
           refuses. Drawn anywhere else it would contradict the colours. */
        const ch = cutHeight(tree, k);
        const below = tree.height[tree.n - k - 1];
        const above = tree.height[tree.n - k];
        ok(Number.isFinite(ch), `${tag} k=${k}: cut height is not finite`);
        if (below !== undefined) {
          ok(ch >= below - 1e-9 && ch <= above + 1e-9,
            `${tag} k=${k}: cut at ${ch} is outside [${below}, ${above}]`);
        }

        const g = gapAt(tree, k);
        ok(g === null || (Number.isFinite(g) && g > 0),
          `${tag} k=${k}: gap is ${g}`);
      }

      /* THE LINKAGE MARKS. `witness` is what makes the linkage control visible
         on the scatter, so its shape has to be right for every method: a
         complete/single merge names exactly one pair, average names every
         cross pair, and Ward names one spoke per member of the new cluster. A
         wrong count here draws a plausible picture of the wrong rule. */
      const nd = tree.nodes[tree.nodes.length - 1];
      const wt = witness(pointVectors(pts), nd.a.leaves, nd.b.leaves, method, metric);
      const na = nd.a.leaves.length;
      const nb = nd.b.leaves.length;
      if (method === "average") {
        ok(wt.kind === "all" && wt.pairs.length === na * nb,
          `${tag}: average named ${wt.pairs.length} pairs, expected ${na * nb}`);
      } else if (method === "ward.D2") {
        ok(wt.kind === "spokes" && wt.pairs.length === na + nb,
          `${tag}: ward named ${wt.pairs.length} spokes, expected ${na + nb}`);
        ok(wt.centres.length === 1 && wt.centres[0].every(Number.isFinite),
          `${tag}: ward centre is not a finite point`);
      } else {
        ok(wt.kind === "extreme" && wt.pairs.length === 1,
          `${tag}: complete named ${wt.pairs.length} pairs, expected 1`);
        const [i, j] = wt.pairs[0];
        ok(nd.a.leaves.includes(i) && nd.b.leaves.includes(j),
          `${tag}: the named pair does not straddle the two clusters`);
      }
     }
    }
  }
}

/* THE CLAIM ITSELF, as an assertion: at separation 0 there is no structure and
   the cut still returns exactly what was asked for, every time. If this ever
   fails the widget has stopped making its own point. */
for (let seed = 1; seed <= 50; seed += 1) {
  const pts = stage({ separation: 0 }, makeRng(seed));
  for (const k of KS) {
    const labels = cut(cluster(pointVectors(pts), "ward.D2"), k);
    ok(new Set(labels).size === k,
      `separation 0 seed=${seed}: asked for ${k} clusters, got ${new Set(labels).size}`);
  }
}

/* -------------------------------------------------------------------------
   ACT 2
   ---------------------------------------------------------------------- */
for (let seed = 1; seed <= 10; seed += 1) {
  const heat = heatStage({}, makeRng(seed));
  ok(heat.rows.length === HEAT_GENES, `heat seed=${seed}: ${heat.rows.length} genes`);
  ok(heat.rows.every((r) => r.length === HEAT_SAMPLES), `heat seed=${seed}: a row is the wrong length`);
  ok(heat.cols.length === HEAT_SAMPLES, `heat seed=${seed}: ${heat.cols.length} samples`);
  ok(heat.rows.every((r) => r.every(Number.isFinite)), `heat seed=${seed}: a cell is not finite`);

  /* The unstructured genes are unstructured. `planted` is what the readout
     counts, so if it ever disagreed with the generator the widget would name
     the wrong box. */
  /* COUNTS, NOT POSITIONS. The generator shuffles both axes now — a raw matrix
     with its blocks already adjacent looks clustered before anything has
     clustered it — so "genes past index 16 are unplanted" is no longer the
     invariant. What must hold is that four blocks of four exist and four genes
     have nothing added. */
  ok(heat.planted.filter((p) => p === null).length === HEAT_GENES - HEAT_PLANTED,
    `heat seed=${seed}: ${heat.planted.filter((p) => p === null).length} unstructured genes,`
    + ` expected ${HEAT_GENES - HEAT_PLANTED}`);
  for (let b = 0; b < 4; b += 1) {
    const size = heat.planted.filter((p) => p === b).length;
    ok(size === heat.perBlock,
      `heat seed=${seed}: block ${b} has ${size} genes, expected ${heat.perBlock}`);
  }
  ok(heat.condition.filter((c) => c === 0).length === HEAT_SAMPLES / 2,
    `heat seed=${seed}: the two conditions are not ${HEAT_SAMPLES / 2} samples each`);

  for (const method of OFFERED) {
   for (const metric of METRICS) {
    const rowTree = cluster(heat.rows, method, metric);
    const colTree = cluster(heat.cols, method, metric);
    for (const cr of [2, 3, 4, 5, 6, 7, 8]) {
      const labels = cut(rowTree, cr);
      const seq = rowTree.order.map((g) => labels[g]);
      let runCount = 1;
      for (let i = 1; i < seq.length; i += 1) if (seq[i] !== seq[i - 1]) runCount += 1;
      ok(runCount === cr, `heat seed=${seed} ${method}/${metric} cutRows=${cr}: ${runCount} runs for ${cr} boxes`);

      const empty = noiseBoxes(labels, heat.planted);
      ok(empty.every((b) => b.size > 0), `heat seed=${seed} ${method}/${metric} cutRows=${cr}: an empty box has size 0`);
      ok(empty.length <= cr, `heat seed=${seed} ${method}/${metric} cutRows=${cr}: more noise boxes than boxes`);
    }
    for (const cc of [2, 3, 4, 5, 6]) {
      const labels = cut(colTree, cc);
      ok(new Set(labels).size === cc, `heat seed=${seed} ${method}/${metric} cutCols=${cc}: wrong cluster count`);
    }
   }
  }
}

/* THE ACT'S OWN CLAIM: `cutree_rows = 5` draws a box round genes that had
   nothing added to them. That is a RATE, not a fact about one seed — measured
   at 86% of seeds for this stage in `_lab/hc-size.mjs` — and the first version
   of this assertion pinned seed 1, which happens to be one of the 14% where
   the noise genes are split across two boxes. A test that demands the typical
   case from a particular draw fails for the wrong reason. */
{
  let withBox = 0;
  const N = 100;
  for (let seed = 1; seed <= N; seed += 1) {
    const heat = heatStage({}, makeRng(seed));
    const boxes = noiseBoxes(cut(cluster(heat.rows, "ward.D2"), 5), heat.planted);
    if (boxes.length >= 1) withBox += 1;
  }
  ok(withBox >= 70,
    `cutree_rows=5 boxed the unstructured genes in only ${withBox} of ${N} seeds`);

  /* And with nothing planted anywhere, EVERY box must be a noise box. */
  for (let seed = 1; seed <= 20; seed += 1) {
    const heat = heatStage({ lift: 0 }, makeRng(seed));
    const boxes = noiseBoxes(cut(cluster(heat.rows, "ward.D2"), 5), heat.planted);
    ok(boxes.length === 5,
      `lift 0 seed=${seed}: ${boxes.length} of 5 boxes reported as noise`);
  }
}

console.log(`${checks} assertions`);
if (fails.length) {
  console.log(`\nFAIL — ${fails.length}:\n`);
  for (const f of fails.slice(0, 20)) console.log("  " + f);
  if (fails.length > 20) console.log(`  ... and ${fails.length - 20} more`);
  process.exit(1);
}
console.log("all pass");
