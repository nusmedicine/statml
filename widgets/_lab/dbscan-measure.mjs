/* ============================================================================
   Every number in docs/catalogue.md § Widget 24 · DBSCAN.

   It imports `widgets/dbscan/model.js` — the SHIPPING engine, verified against
   sklearn 1.9.0 by `dbscan-verify.mjs` — and never a copy of it, so a plan
   written from this output is a plan about the code that will run.

     node widgets/_lab/dbscan-measure.mjs           # everything
     node widgets/_lab/dbscan-measure.mjs 2 5       # only sections 2 and 5

   SECTION 8 RUNS UMAP AND IS THE SLOW ONE — about a minute. Everything else
   together is well under a minute.

   THE CRITERION IS `recovered`, NOT THE ARI, and that is the single most
   important thing about this file. Three stages in this session passed for the
   wrong reason before it was noticed: `adjusted_rand_score` treats `-1` as one
   more label, so "I clustered one group and declared the other entirely noise"
   scores 1.000 — identical to "I found both". Section 61 demonstrates it on
   hand-built labelings. Any measurement of a density method that scores itself
   with a plain ARI is measuring something other than what it thinks.

   NOT DEPLOYED — `widgets/_lab/` is excluded from the build.
   ========================================================================= */

import { makeRng } from "../core/rng.js";
import { lloyd, forgy } from "../kmeans/model.js";
import { stage as sphereStage, umap } from "../umap/model.js";
import {
  dbscan, blobs, cloud, rings, moons, varying, kDistances, recovered,
  silhouetteWithNoise, silhouetteClustersOnly, adjustedRand, adjustedRandNoiseAware,
} from "../dbscan/model.js";

const want = process.argv.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
const on = (n) => want.length === 0 || want.includes(n);
const H = (n, s) => { if (on(n)) console.log(`\n\n=== ${n}. ${s}\n${"=".repeat(74)}`); };
const f = (v, d = 3) => (v === null || v === undefined || Number.isNaN(v) ? "  -  " : v.toFixed(d));
const pad = (s, n) => String(s).padStart(n);
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a) => (a.length < 2 ? 0 : Math.sqrt(a.reduce((s, v) => s + (v - mean(a)) ** 2, 0) / (a.length - 1)));
const pm = (a, d = 3) => `${f(mean(a), d)} ± ${f(sd(a), d)}`;
const count = (a) => a.reduce((s, v) => s + v, 0);

/* All 48 points, all built the one way, so a seed means the same thing in
   every section. `blobs` is 4 x 12 — widget 23's shipping default — so the two
   clustering widgets can be run on byte-identical stages. */
const STAGES = {
  blobs: (rng, o = {}) => blobs(rng, { groups: 4, per: 12, ...o }),
  rings: (rng, o = {}) => rings(rng, o),
  moons: (rng, o = {}) => moons(rng, o),
  varying: (rng, o = {}) => varying(rng, o),
  cloud: (rng, o = {}) => cloud(rng, { n: 48, ...o }),
};
const build = (name, seed, o) => {
  const st = STAGES[name](makeRng(seed), o);
  return { X: st.map((s) => s.p), y: st.map((s) => s.g) };
};

/* --------------------------------------------------------------------------
   1. QUESTION 1 — can it run at render time, and can a whole SWEEP run at
      render time? The second is the one that decides a panel: widget 23 could
      afford the objective plotted against every K because the sweep cost
      1.24 ms, and DBSCAN's equivalent is the cluster count against every eps.
   ----------------------------------------------------------------------- */
H(1, "COST — one fit, and a whole eps sweep");
if (on(1)) {
  const time = (fn, reps) => {
    fn(); fn();
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < reps; i += 1) fn();
    return Number(process.hrtime.bigint() - t0) / 1e6 / reps;
  };
  console.log("n     eps    ms per fit   clusters");
  for (const [n, eps] of [[48, 0.30], [48, 0.55], [96, 0.25], [150, 0.20], [300, 0.15]]) {
    const { X } = build("blobs", 3, { per: n / 4 });
    const ms = time(() => dbscan(X, { eps, minPts: 4 }), 400);
    console.log(`${pad(n, 4)}  ${f(eps, 2)}   ${pad(ms.toFixed(4), 9)}   ${dbscan(X, { eps, minPts: 4 }).nClusters}`);
  }
  const { X } = build("blobs", 3);
  for (const STEPS of [60, 120]) {
    const sweep = () => {
      for (let i = 1; i <= STEPS; i += 1) dbscan(X, { eps: (i / STEPS) * 0.9, minPts: 4 });
    };
    console.log(`\na ${STEPS}-step eps sweep at n=48: ${time(sweep, 40).toFixed(3)} ms`);
  }
  console.log("(widget 23's whole K=1..8 sweep with ten restarts was 1.24 ms)");
}

/* --------------------------------------------------------------------------
   2. QUESTION 2 — the one sentence. The reconnaissance's candidate is "DBSCAN
      does not make you choose K; it makes you choose a radius, and the radius
      decides how many clusters you get", and it says outright that this must
      be MEASURED rather than believed: if a wide sweep of eps gives the same
      count, the sentence is wrong and something else is the lesson.
   ----------------------------------------------------------------------- */
H(2, "THE eps SWEEP — does the cluster count actually move?");
if (on(2)) {
  for (const stage of ["blobs", "rings", "moons"]) {
    const { X, y } = build(stage, stage === "blobs" ? 3 : 1);
    const truth = new Set(y).size;
    console.log(`\n${stage} (${X.length} points, ${truth} true groups), min_samples = 4`);
    console.log("eps    clusters  noise  border   ARI    sil(clusters)");
    for (let e = 0.08; e <= 0.92; e += 0.04) {
      const r = dbscan(X, { eps: e, minPts: 4 });
      const got = recovered(y, r.labels);
      const mark = got.all ? "  <- every group recovered"
        : r.nClusters === truth ? "  <- right COUNT, wrong answer" : "";
      console.log(`${f(e, 2)}   ${pad(r.nClusters, 6)}   ${pad(r.noise.length, 4)}   ${pad(r.border.length, 5)}`
        + `  ${f(adjustedRandNoiseAware(y, r.labels))}     ${f(silhouetteClustersOnly(X, r.labels))}${mark}`);
    }
  }
}

/* --------------------------------------------------------------------------
   3. The sentence's teeth. "Does not require specifying the number of clusters
      in advance" is cell 60's first STRENGTH; if only a narrow band of eps
      returns the true answer then the choice has been MOVED, not removed.
   ----------------------------------------------------------------------- */
H(3, "THE WINDOW — how much of the eps range gives the right answer");
if (on(3)) {
  const STEPS = 400, LO = 0.02, HI = 1.2;
  console.log("stage     seeds  eps giving the RIGHT COUNT       eps RECOVERING every group");
  console.log("                 share    band                    share    band");
  for (const stage of ["blobs", "rings", "moons", "varying"]) {
    const shares = [], gots = [], lo = [], hi = [], alo = [], ahi = [];
    for (let seed = 1; seed <= 20; seed += 1) {
      const { X, y } = build(stage, seed);
      const truth = new Set(y).size;
      let okCount = 0, okGot = 0, l = null, h = null, al = null, ah = null;
      for (let i = 0; i <= STEPS; i += 1) {
        const e = LO + ((HI - LO) * i) / STEPS;
        const r = dbscan(X, { eps: e, minPts: 4 });
        if (r.nClusters === truth) { okCount += 1; if (l === null) l = e; h = e; }
        if (recovered(y, r.labels).all) { okGot += 1; if (al === null) al = e; ah = e; }
      }
      shares.push(okCount / (STEPS + 1)); gots.push(okGot / (STEPS + 1));
      if (l !== null) { lo.push(l); hi.push(h); }
      if (al !== null) { alo.push(al); ahi.push(ah); }
    }
    const band = lo.length ? `${f(mean(lo), 2)}-${f(mean(hi), 2)}` : "never";
    const aband = alo.length ? `${f(mean(alo), 2)}-${f(mean(ahi), 2)}` : "never";
    console.log(`${stage.padEnd(9)}  ${pad(20, 4)}   ${f(mean(shares) * 100, 1)}%   ${band.padEnd(21)}`
      + `   ${f(mean(gots) * 100, 1)}%   ${aband.padEnd(10)} ${alo.length}/20 seeds ever reach it`);
  }
}

/* --------------------------------------------------------------------------
   4. The second knob. Cell 60 names BOTH parameters in its first limitation,
      and a widget with room for one control needs to know which one carries
      the lesson.
   ----------------------------------------------------------------------- */
H(4, "min_samples — the second knob, at an eps that works");
if (on(4)) {
  for (const stage of ["blobs", "rings", "moons"]) {
    const { X, y } = build(stage, stage === "blobs" ? 3 : 1);
    let best = null;
    for (let e = 0.05; e <= 1.0; e += 0.005) {
      const r = dbscan(X, { eps: e, minPts: 4 });
      const a = adjustedRandNoiseAware(y, r.labels);
      if (recovered(y, r.labels).all && (!best || a > best.a)) best = { e, a };
    }
    if (!best) { console.log(`\n${stage}: no eps recovers every group at min_samples=4`); continue; }
    console.log(`\n${stage}, eps fixed at ${f(best.e, 3)} — the value that works for min_samples = 4`);
    console.log("min_samples  clusters  noise  border   ARI    every group recovered");
    for (let m = 2; m <= 10; m += 1) {
      const r = dbscan(X, { eps: best.e, minPts: m });
      const got = recovered(y, r.labels);
      console.log(`${pad(m, 8)}     ${pad(r.nClusters, 6)}   ${pad(r.noise.length, 4)}   ${pad(r.border.length, 5)}`
        + `  ${f(adjustedRandNoiseAware(y, r.labels))}    ${got.all ? "yes" : `no (${got.found}/${got.of})`}`);
    }
  }
}

/* --------------------------------------------------------------------------
   5. THE STRENGTH, HEAD TO HEAD WITH WIDGET 23 — the one measurement no
      earlier widget in this arc could make, because `widgets/kmeans/model.js`
      is right there and importable. Identical points into both engines.
   ----------------------------------------------------------------------- */
H(5, "AGAINST K-MEANS on identical points");
if (on(5)) {
  console.log("K-Means is scored by the plain ARI — it never returns noise, so both readings");
  console.log("agree on it. DBSCAN is scored by the noise-aware one and by `recovered`.\n");
  console.log("stage     K-Means (K = truth, 10 starts)  DBSCAN (best eps, m=4)  20 seeds");
  for (const stage of ["blobs", "rings", "moons", "varying"]) {
    const km = [], db = [], eps = [], got = [], kmGot = [];
    for (let seed = 1; seed <= 20; seed += 1) {
      const { X, y } = build(stage, seed);
      const truth = new Set(y).size;
      const irng = makeRng(seed * 1000 + 7);
      let run = null;
      for (let t = 0; t < 10; t += 1) {
        const a = lloyd(X, truth, { init: forgy(X, truth, irng) });
        if (!run || a.inertia < run.inertia) run = a;
      }
      km.push(adjustedRand(y, run.labels));
      kmGot.push(recovered(y, run.labels).all ? 1 : 0);
      let best = null;
      for (let e = 0.03; e <= 1.2; e += 0.005) {
        const r = dbscan(X, { eps: e, minPts: 4 });
        const a = adjustedRandNoiseAware(y, r.labels);
        if (!best || a > best.a) best = { a, e, r };
      }
      db.push(best.a); eps.push(best.e);
      got.push(recovered(y, best.r.labels).all ? 1 : 0);
    }
    console.log(`${stage.padEnd(9)} ${pm(km).padEnd(16)} ${pad(`${count(kmGot)}/20 ok`, 12)}`
      + `  ${pm(db).padEnd(16)} ${pad(`${count(got)}/20 ok`, 9)}  at eps ${f(mean(eps), 2)}`);
  }
}

/* --------------------------------------------------------------------------
   6. THE FAILING CASE THAT IS DBSCAN'S OWN — cell 60's third limitation,
      "varying densities can cause clusters to be merged or split
      incorrectly". The claim under test is stronger than "it gets worse": that
      NO SINGLE eps serves both densities at once. So the search is over the
      whole eps range, and if the best it can do anywhere is still short of the
      truth, the failure is the method's and not the tuning's.
   ----------------------------------------------------------------------- */
H(6, "VARYING DENSITY — is there any eps that works at all?");
if (on(6)) {
  console.log("Two tight blobs close together, one loose blob away from both.");
  console.log("`ratio` is how much wider the loose one is. 30 stage seeds each.\n");
  console.log("ratio  ANY eps recovers all 3   best noise-aware ARI    working eps band");
  for (const ratio of [1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 8]) {
    const per = [], okAny = [], widths = [];
    for (let seed = 1; seed <= 30; seed += 1) {
      const { X, y } = build("varying", seed, { ratio });
      let best = null, lo = null, hi = null;
      for (let e = 0.03; e <= 1.4; e += 0.005) {
        const r = dbscan(X, { eps: e, minPts: 4 });
        const a = adjustedRandNoiseAware(y, r.labels);
        if (!best || a > best.a) best = { a, e, r };
        if (recovered(y, r.labels).all) { if (lo === null) lo = e; hi = e; }
      }
      per.push(best.a); okAny.push(lo === null ? 0 : 1);
      if (lo !== null) widths.push(hi - lo);
    }
    console.log(`${f(ratio, 1)}    ${`${count(okAny)}/30`.padEnd(22)} ${pm(per).padEnd(22)} `
      + `${widths.length ? f(mean(widths)) : "never"}`);
  }

  console.log("\nThe scissors, at ratio 6 — one seed, every eps, and what each end does:");
  console.log("eps    clusters  noise   the two tight blobs   the loose blob      ARI");
  const { X, y } = build("varying", 1, { ratio: 6 });
  for (let e = 0.08; e <= 0.86; e += 0.04) {
    const r = dbscan(X, { eps: e, minPts: 4 });
    const lab = (g) => r.labels.filter((_, i) => y[i] === g);
    const live = (L) => L.filter((v) => v !== -1);
    const merged = live(lab(0)).length > 0 && live(lab(1)).length > 0
      && new Set([...live(lab(0)), ...live(lab(1))]).size === 1;
    const loose = lab(2);
    const looseSay = live(loose).length === 0 ? "ALL NOISE"
      : `${new Set(live(loose)).size} piece(s), ${loose.length - live(loose).length} noise`;
    console.log(`${f(e, 2)}   ${pad(r.nClusters, 6)}   ${pad(r.noise.length, 4)}    `
      + `${(merged ? "MERGED into one" : "separate").padEnd(21)} ${looseSay.padEnd(19)} `
      + `${f(adjustedRandNoiseAware(y, r.labels))}${recovered(y, r.labels).all ? "  <- all three" : ""}`);
  }
}

/* --------------------------------------------------------------------------
   61. THE TRAP THE RECONNAISSANCE DID NOT PREDICT, and the one that cost this
       session three stages. Section 7 has the silhouette trap, which it did
       predict. This is the ARI's, and it is worse.
   ----------------------------------------------------------------------- */
H(61, "ARI SCORES 'I DECLINED TO CLUSTER THIS' AS 'I FOUND THIS'");
if (on(61) || on(6)) {
  /* HAND-BUILT LABELINGS, not a run, because the claim is about the METRIC and
     a run would leave room to argue it was the run's fault. 48 points, two
     true groups of 24, scored exactly as cell 67 scores them. */
  const y = [...Array(24).fill(0), ...Array(24).fill(1)];
  const CASES = [
    ["both groups found as clusters", [...Array(24).fill(0), ...Array(24).fill(1)]],
    ["ONE found, the other ALL NOISE", [...Array(24).fill(0), ...Array(24).fill(-1)]],
    ["one found, the other in 2 pieces", [...Array(24).fill(0), ...Array(12).fill(1), ...Array(12).fill(2)]],
    ["both found, 6 points left noise", [...Array(21).fill(0), ...Array(3).fill(-1), ...Array(21).fill(1), ...Array(3).fill(-1)]],
    ["every point noise", Array(48).fill(-1)],
    ["both merged into one cluster", Array(48).fill(0)],
  ];
  console.log("what DBSCAN returned                cell 67's ARI    noise split into singletons");
  for (const [what, L] of CASES) {
    console.log(`${what.padEnd(34)} ${pad(f(adjustedRand(y, L)), 8)}         ${pad(f(adjustedRandNoiseAware(y, L)), 8)}`);
  }
  console.log("\nA run that found ONE of two subtypes and threw the other away scores 1.000,");
  console.log("identical to a run that found both. Widget 23 prints this tile unchanged.");
  console.log("The correction is one line and moves nothing that was not already lying.");
}

/* --------------------------------------------------------------------------
   7. THE OTHER NOISE TRAP, which the reconnaissance DID predict: cell 67
      prints `silhouette_score(X_umap, db_labels)` with `-1` still in the
      labels, so sklearn scores noise as if it were one cluster.
   ----------------------------------------------------------------------- */
H(7, "SCORING NOISE AS A CLUSTER — how much does it move the silhouette?");
if (on(7)) {
  console.log("stage    eps    noise  as cell 67 prints it   noise dropped    gap");
  for (const stage of ["blobs", "rings", "moons", "varying", "cloud"]) {
    for (const eps of [0.18, 0.25, 0.35, 0.50]) {
      const { X } = build(stage, stage === "blobs" ? 3 : 1);
      const r = dbscan(X, { eps, minPts: 4 });
      if (r.nClusters === 0) continue;
      const a = silhouetteWithNoise(X, r.labels);
      const b = silhouetteClustersOnly(X, r.labels);
      const gap = a === null || b === null ? null : b - a;
      console.log(`${stage.padEnd(8)} ${f(eps, 2)}  ${pad(r.noise.length, 5)}       ${pad(f(a), 10)}`
        + `        ${pad(f(b), 10)}   ${f(gap)}`);
    }
  }
  console.log("\nAnd the sharper question — CAN the silhouette choose eps, the way it can");
  console.log("choose K? (widget 23: it peaks at the true K on 5 of 5 seeds.) 20 seeds:\n");
  console.log("stage     eps the silhouette picks   an eps that works        it lands");
  for (const stage of ["blobs", "rings", "moons"]) {
    const picked = [], good = [], hits = [];
    for (let seed = 1; seed <= 20; seed += 1) {
      const { X, y } = build(stage, seed);
      let bs = null, br = null;
      for (let e = 0.05; e <= 1.2; e += 0.005) {
        const r = dbscan(X, { eps: e, minPts: 4 });
        if (r.nClusters >= 2) {
          const s = silhouetteClustersOnly(X, r.labels);
          if (s !== null && (!bs || s > bs.s)) bs = { s, e, r };
        }
        if (recovered(y, r.labels).all && !br) br = { e };
      }
      if (!bs || !br) continue;
      picked.push(bs.e); good.push(br.e);
      hits.push(recovered(y, bs.r.labels).all ? 1 : 0);
    }
    console.log(`${stage.padEnd(9)} ${pm(picked, 2).padEnd(24)}  ${pm(good, 2).padEnd(22)} `
      + `${count(hits)}/${hits.length}`);
  }
}

/* --------------------------------------------------------------------------
   8. QUESTION 4 — WHICH SPACE. Widget 23 was kept flat and named THIS widget
      as the host, because cell 62 runs DBSCAN on UMAP output. Two different
      questions live here and they must not be conflated:
        (a) does clustering the 2-D picture instead of the data change the
            answer — widget 23's question, re-asked of a density method;
        (b) does UMAP MANUFACTURE the density DBSCAN then finds — which is a
            question only a density method can ask.
   ----------------------------------------------------------------------- */
H(8, "WHICH SPACE — the data, or its picture");
if (on(8)) {
  const sweep = (X, y) => {
    let best = null, any = 0;
    for (let e = 0.02; e <= 3.0; e += 0.02) {
      const r = dbscan(X, { eps: e, minPts: 4 });
      const a = adjustedRandNoiseAware(y, r.labels);
      if (!best || a > best.a) best = { a, e, r };
      if (recovered(y, r.labels).all) any = 1;
    }
    return { ...best, any };
  };
  console.log("Best over all eps in each space, 10 seeds. The sphere stage of widgets 20-22.\n");
  console.log("groups  in 3-D (the data)        in the UMAP picture      answers differ");
  for (const groups of [2, 3, 4, 6]) {
    const per = Math.round(48 / groups);
    const d3 = [], d2 = [], o3 = [], o2 = [], differ = [];
    for (let seed = 1; seed <= 10; seed += 1) {
      const st = sphereStage(groups, per, makeRng(seed));
      const X = st.map((s) => s.p);
      const y = st.map((s) => s.g);
      const Yr = umap(X, { rng: makeRng(seed + 77) });
      const Y = (Yr.Y ?? Yr).map((p) => [p[0], p[1]]);
      const a = sweep(X, y);
      const b = sweep(Y, y);
      d3.push(a.a); d2.push(b.a); o3.push(a.any); o2.push(b.any);
      differ.push(adjustedRand(a.r.labels, b.r.labels) < 0.999 ? 1 : 0);
    }
    console.log(`${pad(groups, 4)}    ${pm(d3).padEnd(14)} ${pad(`${count(o3)}/10 ok`, 8)}  `
      + `${pm(d2).padEnd(14)} ${pad(`${count(o2)}/10 ok`, 8)}   ${count(differ)}/10`);
  }

  console.log("\nAnd the question only a density method can ask — UMAP a STRUCTURELESS");
  console.log("CLOUD, then DBSCAN the picture, choosing eps the way a reader would:");
  console.log("by maximising the only number visible in it.\n");
  console.log("what went in     clusters found   noise            silhouette of the answer");
  for (const [what, mk] of [
    ["a cloud, no groups", (rng) => Array.from({ length: 48 }, () => {
      const u = rng.normal(0, 1), v = rng.normal(0, 1), w = rng.normal(0, 1);
      const r = (2 * Math.cbrt(rng.next())) / Math.hypot(u, v, w);
      return [u * r, v * r, w * r];
    })],
    ["4 real groups", (rng) => sphereStage(4, 12, rng).map((s) => s.p)],
  ]) {
    const ks = [], ns = [], ss = [];
    for (let seed = 1; seed <= 10; seed += 1) {
      const X = mk(makeRng(seed));
      const Yr = umap(X, { rng: makeRng(seed + 77) });
      const Y = (Yr.Y ?? Yr).map((p) => [p[0], p[1]]);
      let best = null;
      for (let e = 0.05; e <= 3.0; e += 0.02) {
        const r = dbscan(Y, { eps: e, minPts: 4 });
        if (r.nClusters < 2) continue;
        const s = silhouetteClustersOnly(Y, r.labels);
        if (s !== null && (!best || s > best.s)) best = { s, e, r };
      }
      if (!best) continue;
      ks.push(best.r.nClusters); ns.push(best.r.noise.length); ss.push(best.s);
    }
    console.log(`${what.padEnd(17)} ${pm(ks, 1).padEnd(16)} ${pm(ns, 1).padEnd(16)} ${pm(ss)}`);
  }
}

/* --------------------------------------------------------------------------
   9. The standard cure for the eps problem. Measured only to find out whether
      it is READABLE at this scale, because a widget that names a defect and
      shows no cure is half a lesson — and because widget 23 shipped `n_init`
      for exactly that reason.
   ----------------------------------------------------------------------- */
H(9, "IS THE k-DISTANCE KNEE READABLE at n = 48?");
if (on(9)) {
  console.log("The knee of the sorted 4-distance curve is the textbook way to pick eps.");
  console.log("20 seeds; 'lands' counts the seeds where taking the knee recovers everything.\n");
  console.log("stage     the knee              middle of what works    lands");
  for (const stage of ["blobs", "rings", "moons", "varying"]) {
    const knees = [], bands = [], lands = [];
    for (let seed = 1; seed <= 20; seed += 1) {
      const { X, y } = build(stage, seed);
      const d = kDistances(X, 4);
      let knee = d[0], bestCurve = -Infinity;
      for (let i = 1; i < d.length - 1; i += 1) {
        const curve = d[i - 1] - 2 * d[i] + d[i + 1];
        if (curve > bestCurve) { bestCurve = curve; knee = d[i]; }
      }
      let lo = null, hi = null;
      for (let e = 0.03; e <= 1.2; e += 0.005) {
        if (recovered(y, dbscan(X, { eps: e, minPts: 4 }).labels).all) { if (lo === null) lo = e; hi = e; }
      }
      knees.push(knee);
      if (lo !== null) bands.push((lo + hi) / 2);
      lands.push(recovered(y, dbscan(X, { eps: knee, minPts: 4 }).labels).all ? 1 : 0);
    }
    console.log(`${stage.padEnd(9)} ${pm(knees).padEnd(20)} ${pm(bands).padEnd(23)} ${count(lands)}/20`);
  }
}

/* --------------------------------------------------------------------------
   10. HOW MANY POINTS A DENSITY METHOD NEEDS. Every widget in this arc stages
       48 samples. A method that estimates density may not survive that, and
       the whole plan depends on knowing before anything is drawn.
   ----------------------------------------------------------------------- */
H(10, "DOES 48 SAMPLES CARRY A DENSITY METHOD?");
if (on(10)) {
  console.log("Share of 20 seeds where SOME eps recovers every true group.\n");
  console.log("stage      n=32   n=48   n=64   n=96  n=144");
  for (const stage of ["blobs", "rings", "moons", "varying"]) {
    const cells = [];
    for (const n of [32, 48, 64, 96, 144]) {
      const per = stage === "blobs" ? n / 4 : stage === "varying" ? n / 3 : n;
      const ok = [];
      for (let seed = 1; seed <= 20; seed += 1) {
        const { X, y } = build(stage, seed, { per });
        let any = 0;
        for (let e = 0.03; e <= 1.2; e += 0.005) {
          if (recovered(y, dbscan(X, { eps: e, minPts: 4 }).labels).all) { any = 1; break; }
        }
        ok.push(any);
      }
      cells.push(`${count(ok)}/20`);
    }
    console.log(`${stage.padEnd(10)} ${cells.map((c) => c.padEnd(6)).join(" ")}`);
  }
}
