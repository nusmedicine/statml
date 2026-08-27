/* ============================================================================
   Measurements for widget 26 · fork-pipe-collider (06-02, PHM5003 week 4).

   The widget's whole claim is three regression traps, each staged by the
   notebook's own generative model:

     fork      age -> smoking, age -> COPD, smoking -> COPD (+0.1 true)
               unadjusted b_smoking reads NEGATIVE; adjusting for age
               recovers +0.1
     pipe      exercise -> HR -> sysBP (total effect 10)
               adjusting for HR erases a real effect
     collider  DKA -> ICU <- AMI, DKA and AMI independent
               adjusting for ICU manufactures a negative DKA "effect"

   Before any design is drawn, this script answers the question the design
   rests on: AT WHAT n DO ALL THREE TRAPS FIRE RELIABLY with our rng?
   The notebook uses n = 1000; a widget may want fewer dots on a 550px
   canvas, and the fragile arm is the fork's ADJUSTED effect: +0.1 against
   SE ~ 1/sqrt(n) needs n ≳ 400 to clear significance. If a smaller n
   breaks that arm, the widget would teach "adjusting made it go away" —
   the opposite of the lesson.

   Run:  node widgets/_lab/causal-measure.mjs
   ========================================================================= */

import { makeRng } from "../core/rng.js";
import { tTailP } from "../core/stats.js";
import { ols as olsShared, fork as forkShared, pipe as pipeShared, collider as colliderShared } from "../fork-pipe-collider/model.js";

/* The OLS and the three generators live in ../fork-pipe-collider/model.js so the mock-ups
   and the widget share ONE formula; this script only renames the triple's
   fields back to the notebook's variable names. */
const ols = (y, xs) => olsShared(y, xs, tTailP);
const fork = (rng, n) => { const d = forkShared(rng, n); return { age: d.z, smoking: d.x, COPD: d.y }; };
const pipe = (rng, n) => { const d = pipeShared(rng, n); return { exercise: d.x, HR: d.z, sysBP: d.y }; };
const collider = (rng, n) => { const d = colliderShared(rng, n); return { DKA: d.x, AMI: d.y, ICU: d.z }; };

/* --- The sweep ----------------------------------------------------------- */

const NS = [50, 100, 200, 400, 1000];
const SEEDS = 200;
const ALPHA = 0.05;

const pct = (x) => `${Math.round((100 * x) / SEEDS)}%`;
const f2 = (x) => x.toFixed(2);

console.log(`\n${SEEDS} seeds per cell, significance at p < ${ALPHA}\n`);

console.log("FORK — the trap needs BOTH arms: unadjusted significantly negative, adjusted significantly positive");
console.log("n     | unadj<0 sig | adj>0 sig | both | mean b_unadj | mean b_adj");
for (const n of NS) {
  let neg = 0, pos = 0, both = 0, mu = 0, ma = 0;
  for (let s = 1; s <= SEEDS; s++) {
    const d = fork(makeRng(s), n);
    const u = ols(d.COPD, [d.smoking]);
    const a = ols(d.COPD, [d.smoking, d.age]);
    const isNeg = u.beta[1] < 0 && u.p[1] < ALPHA;
    const isPos = a.beta[1] > 0 && a.p[1] < ALPHA;
    if (isNeg) neg++;
    if (isPos) pos++;
    if (isNeg && isPos) both++;
    mu += u.beta[1] / SEEDS; ma += a.beta[1] / SEEDS;
  }
  console.log(`${String(n).padEnd(5)} | ${pct(neg).padEnd(11)} | ${pct(pos).padEnd(9)} | ${pct(both).padEnd(4)} | ${f2(mu).padEnd(12)} | ${f2(ma)}`);
}

console.log("\nPIPE — unadjusted recovers the total effect (10); adjusting for HR erases it");
console.log("n     | unadj sig | adj n.s. | both | mean b_unadj | mean b_adj | R2 unadj | R2 adj");
for (const n of NS) {
  let sig = 0, ns = 0, both = 0, mu = 0, ma = 0, r2u = 0, r2a = 0;
  for (let s = 1; s <= SEEDS; s++) {
    const d = pipe(makeRng(s), n);
    const u = ols(d.sysBP, [d.exercise]);
    const a = ols(d.sysBP, [d.exercise, d.HR]);
    const isSig = u.p[1] < ALPHA;
    const isNs = a.p[1] >= ALPHA;
    if (isSig) sig++;
    if (isNs) ns++;
    if (isSig && isNs) both++;
    mu += u.beta[1] / SEEDS; ma += a.beta[1] / SEEDS;
    r2u += u.r2 / SEEDS; r2a += a.r2 / SEEDS;
  }
  console.log(`${String(n).padEnd(5)} | ${pct(sig).padEnd(9)} | ${pct(ns).padEnd(8)} | ${pct(both).padEnd(4)} | ${f2(mu).padEnd(12)} | ${f2(ma).padEnd(10)} | ${f2(r2u).padEnd(8)} | ${f2(r2a)}`);
}

console.log("\nCOLLIDER — unadjusted honestly null; adjusting for ICU manufactures a negative effect");
console.log("n     | unadj n.s. | adj<0 sig | both | mean b_unadj | mean b_adj | R2 unadj | R2 adj");
for (const n of NS) {
  let ns = 0, neg = 0, both = 0, mu = 0, ma = 0, r2u = 0, r2a = 0;
  for (let s = 1; s <= SEEDS; s++) {
    const d = collider(makeRng(s), n);
    const u = ols(d.AMI, [d.DKA]);
    const a = ols(d.AMI, [d.DKA, d.ICU]);
    const isNs = u.p[1] >= ALPHA;
    const isNeg = a.beta[1] < 0 && a.p[1] < ALPHA;
    if (isNs) ns++;
    if (isNeg) neg++;
    if (isNs && isNeg) both++;
    mu += u.beta[1] / SEEDS; ma += a.beta[1] / SEEDS;
    r2u += u.r2 / SEEDS; r2a += a.r2 / SEEDS;
  }
  console.log(`${String(n).padEnd(5)} | ${pct(ns).padEnd(10)} | ${pct(neg).padEnd(9)} | ${pct(both).padEnd(4)} | ${f2(mu).padEnd(12)} | ${f2(ma).padEnd(10)} | ${f2(r2u).padEnd(8)} | ${f2(r2a)}`);
}

/* --- Axis domains at candidate default n, seed 1 ------------------------- */

console.log("\nDOMAINS at n = 1000, seed 1 (for stage design):");
const q = (xs, p) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))];
const show = (name, xs) => console.log(`  ${name.padEnd(9)} min ${f2(Math.min(...xs))}  q01 ${f2(q(xs, 0.01))}  q99 ${f2(q(xs, 0.99))}  max ${f2(Math.max(...xs))}`);
{
  const d = fork(makeRng(1), 1000);
  show("age", d.age); show("smoking", d.smoking); show("COPD", d.COPD);
  const e = pipe(makeRng(1), 1000);
  show("exercise", e.exercise); show("HR", e.HR); show("sysBP", e.sysBP);
  const c = collider(makeRng(1), 1000);
  show("DKA", c.DKA); show("AMI", c.AMI);
  console.log(`  ICU share: ${f2(c.ICU.reduce((s, v) => s + v, 0) / 1000)}`);
}

/* --- Round two: how to SHOW the adjustment (Kenneth, 2026-08-27) ---------- *
 * The obvious device — candidate B's per-band fit lines — was measured and
 * KILLED: within quartile bands of the third variable the fork's slope is
 * still firmly negative (the band is too wide to de-confound), and the
 * pipe's is junk (within an HR band, exercise barely varies). The
 * added-variable plot (regress BOTH axes on Z, plot the residuals) is exact
 * in every structure — its slope IS the adjusted coefficient, by
 * Frisch–Waugh — and is what round two proposes instead.                    */

console.log("\nROUND TWO — band lines vs the added-variable plot (seed 1, n = 1000):");
for (const key of ["fork", "pipe", "collider"]) {
  const spec = (await import("../fork-pipe-collider/model.js")).STRUCTURES[key];
  const d = spec.make(makeRng(1), 1000);
  const adj = ols(d.y, [d.x, d.z]);
  const idx = d.z.map((z, i) => [z, i]).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
  const slopes = [0, 1, 2, 3].map((b) => {
    const ix = idx.slice(b * 250, (b + 1) * 250);
    return ols(ix.map((i) => d.y[i]), [ix.map((i) => d.x[i])]).beta[1];
  });
  const rx = (() => { const g = ols(d.x, [d.z]); return d.x.map((v, i) => v - g.beta[0] - g.beta[1] * d.z[i]); })();
  const ry = (() => { const g = ols(d.y, [d.z]); return d.y.map((v, i) => v - g.beta[0] - g.beta[1] * d.z[i]); })();
  const av = ols(ry, [rx]);
  console.log(`  ${key.padEnd(9)} adjusted ${f2(adj.beta[1])} | quartile bands ${slopes.map(f2).join(" ")} | AV plot ${f2(av.beta[1])}`);
}
