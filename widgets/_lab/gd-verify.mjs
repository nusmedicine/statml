/* ============================================================================
   Assertions on widget 48's engine — the kind no picture can settle.

       node widgets/_lab/gd-verify.mjs

   Imports `widgets/gradient-descent/model.js`, the shipping code and not a
   copy (5.8). Every check below is either an algebraic identity the widget's
   on-screen claims rest on, or one of the numbers a control's `detail` prints
   — so a failure here means the widget is saying something untrue, not merely
   drawing it oddly. Exits non-zero on failure.

   The two claims that most need a reader: the `scale` control tells the reader
   that raw x gives curvatures 68.5 and 0.50 and that standardizing makes both
   2, and the one-parameter page's caption prints the curvature of the b1
   slice. Nothing else in the collection would notice if any of those drifted.
   ========================================================================= */

import { makeRng } from "../core/rng.js";
import {
  N, EPOCHS, LR_LADDER,
  makeData, standardize, quad, domainFor, contourSegments,
  descendFull, descendMini, descendSlope, posAt,
} from "../gradient-descent/model.js";

let failed = 0;
let ran = 0;
const pad = (s, n) => String(s).padEnd(n);

function check(name, ok, detail) {
  ran += 1;
  if (!ok) failed += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${pad(name, 56)} ${detail}`);
}

const SEEDS = [1, 7, 19, 30];
const draws = SEEDS.map((s) => {
  const { x, y } = makeData(makeRng(s));
  return { seed: s, x, y, raw: quad(x, y), std: quad(standardize(x), y) };
});
const D = draws[0];

/* -- 1 · THE ANALYTIC GRADIENT IS THE DERIVATIVE OF THE LOSS ---------------- *
 * The whole widget is a picture of one vector. If `grad` and `loss` disagreed
 * the arrow would point somewhere the walk does not go, and every panel would
 * still look plausible. A central difference over the closed-form loss is
 * exact for a quadratic up to roundoff, so the tolerance is tight on purpose. */
console.log("\n=== 1 · grad matches a central difference of loss ===");
{
  const H = 1e-3;
  const POINTS = [[0, 0], [5, 2], [-1, 3], [3, 1.5], [10, -1], [0.2, 1.97]];
  let worst = 0;
  let where = "";
  for (const { seed, raw, std } of draws) {
    for (const [tag, q] of [["raw", raw], ["std", std]]) {
      for (const [b0, b1] of POINTS) {
        const [g0, g1] = q.grad(b0, b1);
        const n0 = (q.loss(b0 + H, b1) - q.loss(b0 - H, b1)) / (2 * H);
        const n1 = (q.loss(b0, b1 + H) - q.loss(b0, b1 - H)) / (2 * H);
        for (const [a, b] of [[g0, n0], [g1, n1]]) {
          if (Math.abs(a - b) > worst) {
            worst = Math.abs(a - b);
            where = `seed ${seed} ${tag} (${b0}, ${b1})`;
          }
        }
      }
    }
  }
  check("analytic = numerical, 96 partials", worst < 1e-8,
    `worst |Δ| ${worst.toExponential(2)} at ${where}`);
}

/* -- 2 · THE CLOSED-FORM WALK IS THE PER-ROW WALK --------------------------- *
 * `quad` folds the five data sums in once so a surface pixel costs O(1). That
 * is only legitimate if descending on it lands exactly where descending on the
 * rows themselves lands, epoch by epoch — the expansion is the one place a
 * sign error would poison every panel at once and still look like a surface. */
console.log("\n=== 2 · the closed form walks the same path as a per-row loop ===");
{
  const byRow = (xs, y, lr, epochs) => {
    const n = xs.length;
    const path = [[0, 0]];
    let b0 = 0;
    let b1 = 0;
    for (let e = 0; e < epochs; e += 1) {
      let g0 = 0;
      let g1 = 0;
      for (let i = 0; i < n; i += 1) {
        const r = b0 + b1 * xs[i] - y[i];
        g0 += (2 * r) / n;
        g1 += (2 * r * xs[i]) / n;
      }
      b0 -= lr * g0;
      b1 -= lr * g1;
      path.push([b0, b1]);
    }
    return path;
  };
  let worst = 0;
  let where = "";
  for (const { seed, x, y, raw, std } of draws) {
    for (const [tag, q, xs] of [["raw", raw, x], ["std", std, standardize(x)]]) {
      for (const lr of [0.001, 0.01, 0.028]) {
        const t = descendFull(q, lr, 1000);
        const p = byRow(xs, y, lr, 1000);
        for (let e = 0; e <= 1000; e += 1) {
          const d = Math.max(Math.abs(t.b0[e] - p[e][0]), Math.abs(t.b1[e] - p[e][1]));
          if (d > worst) {
            worst = d;
            where = `seed ${seed} ${tag} lr ${lr} epoch ${e}`;
          }
        }
      }
    }
  }
  check("24 walks x 1000 epochs agree", worst < 1e-9,
    `worst |Δ| ${worst.toExponential(2)} at ${where}`);
}

/* -- 3 · THE CURVATURES THE `scale` CONTROL PRINTS -------------------------- *
 * The Hessian of the mean squared error is 2 * [[1, mean x], [mean x, mean
 * x^2]] — no y in it — so these are facts about the design and hold for every
 * seed. Both numbers appear verbatim in the control's `detail` text. */
console.log("\n=== 3 · the printed curvatures ===");
{
  let rawOk = true;
  let stdOk = true;
  for (const { raw, std } of draws) {
    if (raw.lmax.toFixed(1) !== "68.5" || raw.lmin.toFixed(2) !== "0.50") rawOk = false;
    if (Math.abs(std.lmax - 2) > 1e-9 || Math.abs(std.lmin - 2) > 1e-9) stdOk = false;
  }
  check("raw x: curvatures 68.5 and 0.50", rawOk,
    `${D.raw.lmax.toFixed(3)} and ${D.raw.lmin.toFixed(3)}, condition ${(D.raw.lmax / D.raw.lmin).toFixed(0)}`);
  check("standardized x: both curvatures 2", stdOk,
    `|Δ| ${Math.abs(D.std.lmax - 2).toExponential(2)} and ${Math.abs(D.std.lmin - 2).toExponential(2)}`);
  /* The one-parameter page holds b0 and walks the b1 slice, whose curvature is
     2 * mean(x^2) — printed as the panel's note and used by the line that
     names the regime. */
  let worst = 0;
  for (const { x, raw } of draws) {
    const mxx = x.reduce((a, v) => a + v * v, 0) / N;
    worst = Math.max(worst, Math.abs(raw.curvB1 - 2 * mxx));
  }
  check("slice curvature = 2 x mean(x^2)", worst < 1e-12,
    `${D.raw.curvB1.toFixed(3)} raw, ${D.std.curvB1.toFixed(3)} standardized; worst |Δ| ${worst.toExponential(2)}`);
}

/* -- 4 · THE STABILITY BOUNDARY IS 2 / THE LARGEST CURVATURE ---------------- *
 * The claim the whole lr ladder exists to make. 2 / 68.5 = 0.0292, so 0.028
 * must hold and 0.05 must blow up — on every seed, since the boundary does not
 * depend on y. This is also what makes the ladder's 0.03 a legitimate stage. */
console.log("\n=== 4 · raw x is stable below 2 / 68.5 = 0.0292 and not above ===");
{
  const stable = draws.every(({ raw }) => descendFull(raw, 0.028, EPOCHS).diverged === null);
  const blows = draws.every(({ raw }) => descendFull(raw, 0.05, EPOCHS).diverged !== null);
  check("lr 0.028 holds on 4 seeds", stable,
    `loss ${(descendFull(D.raw, 0.028, EPOCHS).epochLoss[EPOCHS] / D.raw.Lmin).toFixed(3)}x the least`);
  check("lr 0.05 diverges on 4 seeds", blows,
    `seed 1 at epoch ${descendFull(D.raw, 0.05, EPOCHS).diverged}`);

  /* Every rung of the shipped ladder, so a control cannot quietly gain or lose
     a regime: raw diverges from 0.03 up, standardized only at 3. */
  const rawDiv = LR_LADDER.map((lr) => descendFull(D.raw, lr, EPOCHS).diverged !== null);
  const stdDiv = LR_LADDER.map((lr) => descendFull(D.std, lr, EPOCHS).diverged !== null);
  check("raw ladder diverges from 0.03 up",
    rawDiv.join() === [false, false, false, true, true, true, true, true].join(),
    LR_LADDER.map((lr, i) => `${lr}${rawDiv[i] ? "*" : ""}`).join(" "));
  check("standardized ladder diverges only at 3",
    stdDiv.join() === [false, false, false, false, false, false, false, true].join(),
    LR_LADDER.map((lr, i) => `${lr}${stdDiv[i] ? "*" : ""}`).join(" "));
}

/* -- 5 · STANDARDIZING PUTS THE MINIMUM ONE STEP AWAY ----------------------- *
 * With both curvatures 2, a step of 1 / curvature = 0.5 lands exactly on the
 * least-squares point from anywhere. That is the argument for normalisation in
 * one number: it does not make a walk fast, it lets the step be large. And at
 * lr 1 the factor 1 - lr * curvature is exactly -1, so the walk alternates for
 * ever at the loss it started with — a rung that neither converges nor blows
 * up, which is why it is on the ladder. */
console.log("\n=== 5 · standardized x: lr 0.5 lands in one step, lr 1 never settles ===");
{
  let worst = 0;
  for (const { std } of draws) {
    const t = descendFull(std, 0.5, 1);
    worst = Math.max(worst, Math.abs(t.b0[1] - std.B0), Math.abs(t.b1[1] - std.B1));
  }
  check("lr 0.5, one step, 4 seeds", worst < 1e-6, `worst |Δ| ${worst.toExponential(2)}`);

  let drift = 0;
  for (const { std } of draws) {
    const t = descendFull(std, 1, EPOCHS);
    if (t.diverged !== null) drift = Infinity;
    else drift = Math.max(drift, Math.abs(t.epochLoss[EPOCHS] / t.epochLoss[0] - 1));
  }
  check("lr 1, the loss after 1000 epochs is the loss at epoch 0", drift < 1e-6,
    `worst relative drift ${drift.toExponential(2)}`);
}

/* -- 6 · A BATCH OF ALL 100 ROWS IS THE FULL-BATCH WALK --------------------- *
 * The `batch` control's claim is that the gradient becomes an ESTIMATE from
 * the batch, and at batch = n there is nothing to estimate. The two code paths
 * are different — one uses the folded sums, the other loops the shuffled rows
 * — so agreement here is what says the mini-batch loop is the same descent
 * with a smaller sum, rather than a second algorithm. Not bit-identical: the
 * shuffle changes the summation ORDER, which is the whole difference. */
console.log("\n=== 6 · batch 100 reproduces the full-batch path ===");
{
  let worst = 0;
  let where = "";
  for (const { seed, raw } of draws) {
    for (const lr of [0.001, 0.01]) {
      const full = descendFull(raw, lr, 400);
      const mini = descendMini(raw, lr, 400, N, makeRng(seed));
      for (let e = 0; e <= 400; e += 1) {
        const a = mini.epochAt[e];
        const d = Math.max(Math.abs(full.b0[e] - mini.b0[a]), Math.abs(full.b1[e] - mini.b1[a]));
        if (d > worst) {
          worst = d;
          where = `seed ${seed} lr ${lr} epoch ${e}`;
        }
      }
    }
  }
  check("8 walks x 400 epochs agree", worst < 1e-9,
    `worst |Δ| ${worst.toExponential(2)} at ${where}`);

  /* And the update counts the control's `detail` promises. */
  const counts = [100, 10, 1].map((b) => {
    const t = b === N
      ? descendFull(D.raw, 0.01, 20)
      : descendMini(D.raw, 0.01, 20, b, makeRng(1));
    return t.len - 1;
  });
  check("20 epochs at batch 100 / 10 / 1", counts.join() === "20,200,2000", counts.join(" · "));
}

/* -- 7 · THE ONE-PARAMETER WALK IS THE b1 SLICE ----------------------------- *
 * b0 held at its fitted value, so each step multiplies the distance to B1 by
 * exactly 1 - lr * curvature — the number the page's caption states. */
console.log("\n=== 7 · each one-parameter step keeps 1 - lr x curvature of the distance ===");
{
  let worst = 0;
  let where = "";
  let held = true;
  let tried = 0;
  for (const { seed, raw, std } of draws) {
    for (const [tag, q] of [["raw", raw], ["std", std]]) {
      for (const lr of [0.001, 0.01, 0.1, 0.3]) {
        const r = 1 - lr * q.curvB1;
        const t = descendSlope(q, lr, 60);
        if (t.diverged !== null) continue;
        tried += 1;
        for (let e = 0; e <= 60; e += 1) {
          if (t.b0[e] !== q.B0) held = false;
          const want = q.B1 + (0 - q.B1) * r ** e;
          const d = Math.abs(t.b1[e] - want);
          if (d > worst) {
            worst = d;
            where = `seed ${seed} ${tag} lr ${lr} epoch ${e}`;
          }
        }
      }
    }
  }
  check("the walk equals B1 + (0 - B1) (1 - lr c)^e", worst < 1e-9,
    `${tried} walks; worst |Δ| ${worst.toExponential(2)} at ${where}`);
  check("b0 never moves off its fitted value", held, "held at B0 in every recorded position");
}

/* -- 8 · THE FRAME AND THE CONTOURS ---------------------------------------- *
 * The window has to hold the start at (0, 0) and the least-squares point on
 * both scales, or a walk begins off stage. And the contour levels have to
 * produce segments inside it, or the surface ships as a bare ramp. */
console.log("\n=== 8 · the surface window holds the start and the minimum ===");
{
  let holds = true;
  let segs = Infinity;
  for (const { raw, std } of draws) {
    for (const q of [raw, std]) {
      const dom = domainFor(q);
      const inside = (b0, b1) =>
        b0 > dom.b0[0] && b0 < dom.b0[1] && b1 > dom.b1[0] && b1 < dom.b1[1];
      if (!inside(0, 0) || !inside(q.B0, q.B1)) holds = false;
      segs = Math.min(segs, contourSegments(q, dom).length);
    }
  }
  check("(0, 0) and (B0, B1) are inside on 8 surfaces", holds,
    `raw b0 [${domainFor(D.raw).b0.map((v) => v.toFixed(1)).join(", ")}]`);
  check("every surface draws contour segments", segs > 200, `fewest ${segs} segments`);
}

/* -- 9 · SEEDED AND PURE --------------------------------------------------- */
console.log("\n=== 9 · same seed, same data and same walk ===");
{
  const a = makeData(makeRng(5));
  const b = makeData(makeRng(5));
  const c = makeData(makeRng(6));
  const same = a.y.every((v, i) => v === b.y[i]);
  const differs = a.y.some((v, i) => v !== c.y[i]);
  check("seed 5 twice is identical; seed 6 differs", same && differs, `${N} rows`);

  /* posAt is what the choreographed step interpolates through, and it has to
     agree with the stored positions at whole indices or the point would jump
     as a beat ends. */
  const t = descendFull(D.raw, 0.01, 50);
  let worst = 0;
  for (let k = 0; k <= 50; k += 1) {
    const [b0, b1] = posAt(t, k);
    worst = Math.max(worst, Math.abs(b0 - t.b0[k]), Math.abs(b1 - t.b1[k]));
  }
  const mid = posAt(t, 10.5);
  const exact = Math.abs(mid[0] - (t.b0[10] + t.b0[11]) / 2) < 1e-15;
  check("posAt is exact at whole indices and linear between", worst === 0 && exact,
    `worst |Δ| ${worst}`);
}

console.log(failed ? `\n${failed} of ${ran} FAILED\n` : `\nall ${ran} checks passed\n`);
process.exit(failed ? 1 : 0);
