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
  "widgets/_lab/hc-verify.mjs",       // R hclust
  "widgets/_lab/kmeans-verify.mjs",   // sklearn.cluster.KMeans
  "widgets/_lab/norm-verify.mjs",     // properties no picture can settle
  "widgets/_lab/tsne-verify.mjs",     // sklearn.manifold.TSNE
  "widgets/_lab/umap-verify.mjs",     // umap-learn 0.5.12
  // widget contracts driven in node
  "widgets/_lab/dbscan-drive.mjs",
  "widgets/_lab/hc-drive.mjs",
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
    for (const l of lines.slice(-12)) console.error(`         ${l}`);
  }
}

if (failed) {
  console.error(`\n${failed} of ${SCRIPTS.length} check script(s) failed`);
  process.exit(1);
}
console.log(`\nall ${SCRIPTS.length} check scripts passed`);
