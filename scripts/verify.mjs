#!/usr/bin/env node
/* ============================================================================
   The engine and contract checks, run as one suite: `npm test`.

   Every engine in this collection is verified against the implementation the
   lesson actually uses — scikit-learn, R's hclust, umap-learn, lme4 — through
   a reference table checked into widgets/_lab/, and several widgets have a
   driver that stubs `defineWidget` and asserts the contract with no browser
   and no clock (HANDOVER § *Driving the animation in node*). Until 2026-09-05
   each was a one-off command nobody ran after its widget shipped, and the
   time-event driver had been failing since that morning's import change with
   nothing to say so. This file runs them all and fails if any one fails.

   Only scripts that ASSERT are listed. `mlp-verify.mjs` dumps arrays for a
   Python comparison and `tsne-checks.mjs` prints diagnostics; neither has a
   pass/fail, so neither belongs here. `*-measure.mjs` and `design-*.mjs`
   print the numbers a widget's header quotes and are read, not checked.

   `npm run build` runs this after check.mjs, so a deploy cannot ship an
   engine that disagrees with its reference.
   ========================================================================= */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const SCRIPTS = [
  // engines against a reference implementation
  "widgets/_lab/dbscan-verify.mjs",   // sklearn.cluster.DBSCAN
  "widgets/_lab/gd-verify.mjs",       // identities, and the curvatures widget 48 prints
  "widgets/_lab/gwas-verify.mjs",     // the cohort, the three scans and the stage widget 57 draws
  "widgets/_lab/hardy-weinberg-verify.mjs",     // the HWE test and the samplers widget 56 draws
  "widgets/_lab/hc-verify.mjs",       // R hclust
  "widgets/_lab/kmeans-verify.mjs",   // sklearn.cluster.KMeans
  "widgets/_lab/norm-verify.mjs",     // properties no picture can settle
  "widgets/_lab/processing-layers-verify.mjs",  // the layer arithmetic widget 49 prints
  "widgets/_lab/support-layers-verify.mjs",     // the layer arithmetic widget 50 prints
  "widgets/_lab/composition-verify.mjs",        // the shape chains and prints widget 51 draws
  "widgets/_lab/loss-functions-verify.mjs",     // the three losses and the stage widget 54 draws
  "widgets/_lab/optimizers-verify.mjs",         // torch.optim's own update rules, and the stage widget 55 draws
  "widgets/_lab/prs-verify.mjs",      // the region, the score, the threshold curve and the stage widget 59 draws
  "widgets/_lab/tensor-verify.mjs",   // the shape arithmetic widget 53 prints
  "widgets/_lab/tsne-verify.mjs",     // sklearn.manifold.TSNE
  "widgets/_lab/umap-verify.mjs",     // umap-learn 0.5.12
  // widget contracts driven in node
  "widgets/_lab/dbscan-drive.mjs",
  "widgets/_lab/hc-drive.mjs",
  "widgets/_lab/hmm-drive.mjs",
  "widgets/_lab/kmeans-drive.mjs",
  "widgets/_lab/mf-drive.mjs",
  "widgets/_lab/missing-drive.mjs",
  "widgets/_lab/mixed-drive.mjs",
  "widgets/_lab/time-event-drive.mjs",
];

/* A driver imports the widget through a data: URL carrying its whole source,
   and a syntax error then prints that URL — 90KB of base64 that says nothing.
   Drop those lines so a failure shows the message and not the payload. */
const readable = (text) => text.split("\n").filter((l) => !l.startsWith("data:"));

let failed = 0;
for (const rel of SCRIPTS) {
  const t0 = performance.now();
  const r = spawnSync(process.execPath, [rel], { cwd: root, encoding: "utf8" });
  const ms = Math.round(performance.now() - t0);
  const lines = readable(`${r.stdout ?? ""}${r.stderr ?? ""}`.trim());
  if (r.status === 0) {
    console.log(`  ok   ${rel}  ${String(ms).padStart(5)} ms  ${lines.at(-1) ?? ""}`);
  } else {
    failed += 1;
    console.error(`  FAIL ${rel}  (exit ${r.status})`);
    /* THE FAILING LINES FIRST, THEN THE TAIL. A script that fails one check of
       298 prints it two hundred lines above its summary, and the tail alone
       hid a timing assertion from a day of failed deploys (2026-09-12). */
    const failing = lines.filter((l) => /FAIL/.test(l) && !l.startsWith("  FAIL "));
    for (const l of failing.slice(0, 12)) console.error(`       ! ${l}`);
    for (const l of lines.slice(-12)) console.error(`         ${l}`);
  }
}

if (failed) {
  console.error(`\n${failed} of ${SCRIPTS.length} check script(s) failed`);
  process.exit(1);
}
console.log(`\nall ${SCRIPTS.length} check scripts passed`);
