/* ============================================================================
   Check `hierarchical-clustering/model.js` against R's own `hclust`.

   Every engine in this repo is verified against the implementation the lesson
   actually uses, because an engine that is merely self-consistent will agree
   with its own bugs. Widget 41 is the standing example: its driver asserted
   the legend the same wrong way the widget read it, and passed while every
   view showed the wrong one.

   Two passes:

     node widgets/_lab/hc-verify.mjs --emit    writes hc-points.csv
     Rscript widgets/_lab/hc-ref.R             writes hc-ref.csv
     node widgets/_lab/hc-verify.mjs           compares them

   What is compared: the MERGE HEIGHTS and the CUT at every k, for all five
   linkages, over stages spanning separation 0 (no groups) to 4. The leaf
   ORDER is deliberately not compared — R orders branches by a different rule
   and the ordering is cosmetic. The heights and the cuts are the argument.
   ========================================================================= */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stage, pointVectors, cluster, cut, canonical, LINKAGES, DISTANCES } from "../hierarchical-clustering/model.js";
import { makeRng } from "../core/rng.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const POINTS = path.join(here, "hc-points.csv");
const REF = path.join(here, "hc-ref.csv");

/* The stages checked. Separation 0 is the case the widget exists for, so it
   carries the most seeds: a linkage bug that only shows on noise would
   otherwise slip through on well-separated groups, where every linkage agrees
   anyway and a wrong one still looks right. */
const CASES = [];
for (const separation of [0, 0.5, 1, 1.5, 2, 3, 4]) {
  for (const seed of [1, 2, 3, 4, 5]) CASES.push({ separation, seed });
}

const KS = [2, 3, 4, 5, 6];
const DISTANCE_KEYS = Object.keys(DISTANCES);

function emit() {
  const rows = ["case,separation,seed,i,x,y"];
  CASES.forEach((c, ci) => {
    stage(c, makeRng(c.seed)).forEach((p, i) => {
      rows.push(`${ci},${c.separation},${c.seed},${i},${p.x},${p.y}`);
    });
  });
  fs.writeFileSync(POINTS, rows.join("\n") + "\n");
  console.log(`wrote ${POINTS} — ${CASES.length} stages x 20 points`);
  console.log("now run:  Rscript widgets/_lab/hc-ref.R");
}

function compare() {
  if (!fs.existsSync(REF)) {
    console.error(`no ${REF}. Run --emit, then Rscript widgets/_lab/hc-ref.R`);
    process.exit(1);
  }
  // R on Windows writes CRLF. Left in place, the trailing \r rides on the LAST
  // header field, so `r.value` is undefined for every row — and then
  // Number(undefined) is NaN, and `Math.abs(NaN - x) > tol` is FALSE, so every
  // height comparison passes while comparing nothing at all. That happened, and
  // is why the height loop below rejects a non-finite value outright instead of
  // comparing it: a check that cannot fail is worse than no check, because it
  // reports a pass.
  const lines = fs.readFileSync(REF, "utf8").replace(/\r/g, "").trim().split("\n");
  const head = lines[0].split(",");
  const ref = lines.slice(1).map((l) => {
    const f = l.split(",");
    return Object.fromEntries(head.map((h, i) => [h, f[i]]));
  });

  // Index R's answers: case -> linkage -> distance -> { heights, cuts }
  const R = new Map();
  for (const r of ref) {
    const key = `${r.case}|${r.linkage}|${r.distance}`;
    if (!R.has(key)) R.set(key, { heights: [], cuts: {} });
    const e = R.get(key);
    if (r.kind === "height") e.heights[Number(r.idx)] = Number(r.value);
    else e.cuts[r.idx] = r.value;
  }

  let checked = 0;
  const fails = [];
  const TOL = 1e-9;

  CASES.forEach((c, ci) => {
    const pts = stage(c, makeRng(c.seed));
    for (const method of LINKAGES) {
      for (const distance of DISTANCE_KEYS) {
        const key = `${ci}|${method}|${distance}`;
        const r = R.get(key);
        if (!r) { fails.push(`${key}: absent from the R reference`); continue; }

        const t = cluster(pointVectors(pts), method, distance);
        const tag = `sep=${c.separation} seed=${c.seed} ${method}/${distance}`;

        // Heights, merge by merge and in merge order.
        for (let m = 0; m < t.height.length; m += 1) {
          checked += 1;
          const mine = t.height[m];
          const theirs = r.heights[m];
          if (!Number.isFinite(mine) || !Number.isFinite(theirs)) {
            fails.push(
              `${tag} height[${m}]: not a number — js ${mine}, R ${theirs}. ` +
              `A comparison against NaN passes silently, so this is a hard failure.`
            );
            continue;
          }
          if (Math.abs(mine - theirs) > TOL * Math.max(1, Math.abs(theirs))) {
            fails.push(`${tag} height[${m}]: js ${mine.toFixed(12)} vs R ${theirs.toFixed(12)}`);
          }
        }

        // Cuts, as partitions — labels are arbitrary, the grouping is not.
        for (const k of KS) {
          checked += 1;
          const mine = canonical(cut(t, k));
          const theirs = r.cuts[String(k)];
          if (mine !== theirs) {
            fails.push(`${tag} cut k=${k}:\n    js ${mine}\n    R  ${theirs}`);
          }
        }
      }
    }
  });

  console.log(
    `${checked} comparisons over ${CASES.length} stages x ${LINKAGES.length} linkages` +
    ` x ${DISTANCE_KEYS.length} distances`
  );
  if (fails.length) {
    // Which linkage is at fault matters more than the first 25 lines of detail:
    // the widget offers three of these five, and a failure confined to one it
    // does not offer is a different situation from one that reaches the figure.
    const byLinkage = {};
    for (const f of fails) {
      // The tag reads "<linkage>/<distance>", so match the pair rather than a
      // space-delimited word — the earlier ` ${L} ` pattern stopped matching
      // when the distance was appended and every failure fell into "?".
      const m = LINKAGES.flatMap((L) => DISTANCE_KEYS.map((D) => `${L}/${D}`))
        .find((tag) => f.includes(tag));
      byLinkage[m || "?"] = (byLinkage[m || "?"] || 0) + 1;
    }
    console.log(`\nFAIL — ${fails.length}, by linkage:`);
    for (const [L, n] of Object.entries(byLinkage)) console.log(`    ${L}: ${n}`);
    console.log("");
    const show = process.argv.includes("--all") ? fails.length : 25;
    for (const f of fails.slice(0, show)) console.log("  " + f);
    if (fails.length > show) console.log(`  ... and ${fails.length - show} more (--all)`);
    process.exit(1);
  }
  console.log("all match R's hclust — heights to 1e-9, cuts exactly");
}

if (process.argv.includes("--emit")) emit();
else compare();
