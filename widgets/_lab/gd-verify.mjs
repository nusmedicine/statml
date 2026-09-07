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
  N, EPOCHS, LR_LADDER, LOG_CAP,
  RELIEF_DEFAULT_AZ, RELIEF_DEFAULT_EL, RELIEF_Z, MESH_G,
  makeData, standardize, quad, domainFor, contourSegments,
  descendFull, descendMini, descendSlope, posAt,
  projector, reliefHeight, reliefMesh, reliefPoint, reliefHidden,
  beatMs, choreographs, epochMs,
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

  /* THE TANGENT AND THE READOUT MUST AGREE AT REST. Since 2026-09-08 the page
     draws the tangent with the gradient AT the point it touches, so that it
     rolls with the curve through the move beat, while the readout keeps the
     floored one that decided the step. The two are the same number wherever the
     walk is standing on a whole index — which is every state but a Slow move —
     and that is only true because `descendSlope` stores at index k exactly what
     `grad` returns at position k. If it ever stopped, the tangent would part
     from its own printed slope with nothing on screen to say so. */
  let split = 0;
  let positions = 0;
  for (const { raw, std } of draws) {
    for (const q of [raw, std]) {
      for (const lr of LR_LADDER) {
        const t = descendSlope(q, lr, EPOCHS);
        for (let k = 0; k < t.len; k += 1) {
          const g = q.grad(q.B0, t.b1[k])[1];
          if (!Number.isFinite(g)) continue;
          positions += 1;
          split = Math.max(split, Math.abs(t.g1[k] - g));
        }
      }
    }
  }
  check("the stored partial IS grad at that b1", split === 0,
    `${positions} positions, worst |Δ| ${split}`);
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

/* -- 10 · THE RELIEF'S HEIGHT MAPPING --------------------------------------- *
 * The relief is the map read a second way, so its height has to be the same
 * function of the loss that the colour already is: monotone, zero at the least
 * loss, and flat once past the ramp's cap. A height that fell anywhere, or that
 * started above the floor, would draw a trench where the loss has none. */
console.log("\n=== 10 · height is monotone in the loss and 0 at the least ===");
{
  const ratios = [];
  for (let e = 0; e <= 60; e += 1) ratios.push(10 ** (e / 10));   // 1x to 1e6x
  let rises = true;
  for (let i = 1; i < ratios.length; i += 1) {
    if (reliefHeight(ratios[i]) < reliefHeight(ratios[i - 1])) rises = false;
  }
  check(`height rises over ${ratios.length} ratios, 1x to 1e6x`, rises,
    `1x ${reliefHeight(1)}, 10x ${reliefHeight(10).toFixed(3)}, cap ${reliefHeight(1e6).toFixed(3)}`);
  check("0 at the least loss, capped at the ramp's cap",
    reliefHeight(1) === 0 && Math.abs(reliefHeight(10 ** LOG_CAP) - RELIEF_Z) < 1e-12
      && reliefHeight(1e9) === RELIEF_Z,
    `floor 0, ${(10 ** LOG_CAP).toFixed(0)}x and above at ${RELIEF_Z}`);

  /* The floor really is the least-squares point on every surface: the height
     there is what the minimum's cross is drawn on. Not exactly zero, and it
     cannot be: `Lmin` comes from an explicit residual loop and `loss` from the
     expanded sums, so their ratio is 1 to roundoff. A ten-billionth of the
     ridge is a ten-millionth of a pixel. */
  let off = 0;
  for (const { raw, std } of draws) {
    for (const q of [raw, std]) off = Math.max(off, reliefPoint(q, domainFor(q), q.B0, q.B1)[2]);
  }
  check("the least-squares point sits on the floor, 8 surfaces", off < 1e-9,
    `highest ${off.toExponential(2)} of ${RELIEF_Z}`);
}

/* -- 11 · THE PROJECTION AND THE FIXED VIEWPOINT ---------------------------- *
 * Two claims the widget rests on and no picture settles. First, that the relief
 * is the SAME WINDOW as the map: looking straight down from azimuth 0, the
 * screen position must be the map's, with the height changing neither
 * coordinate. Second, that azimuth 300 / elevation 35 is a viewpoint from which
 * the lesson's own walk can be SEEN — the reason it is where the widget's
 * `turn` and `tilt` parameters start. The mock's first guess, 215/38, is the
 * counter-example, and it is asserted here so the pair cannot be nudged by eye
 * later without the failure saying what it cost.
 *
 * THE DEFAULTS ARE ASSERTED BY VALUE. Since 2026-09-08 the reader can drag the
 * relief round, so every measurement below is a claim about where the figure
 * OPENS rather than about the only view it has; a default edited without the
 * sweep being redone would leave the rest of this section measuring a viewpoint
 * nobody ever sees. */
console.log("\n=== 11 · the projector reduces to the map, and the viewpoint shows the walk ===");
{
  check("the default viewpoint is 300 / 35",
    RELIEF_DEFAULT_AZ === 300 && RELIEF_DEFAULT_EL === 35,
    `azimuth ${RELIEF_DEFAULT_AZ}, elevation ${RELIEF_DEFAULT_EL}`);

  const rect = { x: 0, y: 0, w: 200, h: 200 };
  const P = projector(rect, 0, 90);
  let flat = 0;      // the height moving the screen position
  let mono = true;   // X from b0 alone, rising; Y from b1 alone, falling (b1 up)
  for (let i = 0; i <= 8; i += 1) {
    for (let j = 0; j <= 8; j += 1) {
      const x = i / 8 - 0.5;
      const y = j / 8 - 0.5;
      const a = P(x, y, 0);
      const b = P(x, y, RELIEF_Z);
      flat = Math.max(flat, Math.abs(a.X - b.X), Math.abs(a.Y - b.Y));
      if (i > 0 && P(x, y, 0).X <= P(x - 1 / 8, y, 0).X) mono = false;
      if (j > 0 && P(x, y, 0).Y >= P(x, y - 1 / 8, 0).Y) mono = false;
      if (Math.abs(P(x, y, 0).X - P(x, 0, 0).X) > 1e-12) mono = false;
      if (Math.abs(P(x, y, 0).Y - P(0, y, 0).Y) > 1e-12) mono = false;
    }
  }
  check("az 0, el 90 is the map, over 81 points", flat < 1e-12 && mono,
    `worst height shift ${flat.toExponential(2)}px on a 200px panel`);

  /* Far to near: the mesh is painted in the order it comes back, so the order
     is what makes an opaque surface opaque. */
  const quads = reliefMesh(D.raw, domainFor(D.raw), projector(rect));
  let sorted = true;
  for (let k = 1; k < quads.length; k += 1) if (quads[k].depth > quads[k - 1].depth) sorted = false;
  check(`the mesh is ${MESH_G} x ${MESH_G} quads, far to near`,
    quads.length === MESH_G * MESH_G && sorted, `${quads.length} quads`);

  /* The rim facing the camera cannot be hidden: from 300/35 the two edges that
     meet at the nearest corner are b1 at its floor and b0 at its ceiling. */
  const domR = domainFor(D.raw);
  let rimHidden = 0;
  let rim = 0;
  for (let k = 0; k <= 40; k += 1) {
    rim += 2;
    if (reliefHidden(D.raw, domR, domR.b0[0] + (k / 40) * (domR.b0[1] - domR.b0[0]), domR.b1[0])) rimHidden += 1;
    if (reliefHidden(D.raw, domR, domR.b0[1], domR.b1[0] + (k / 40) * (domR.b1[1] - domR.b1[0]))) rimHidden += 1;
  }
  check(`the near rim is visible, ${rim} points`, rimHidden === 0,
    `${rimHidden} hidden from ${RELIEF_DEFAULT_AZ}/${RELIEF_DEFAULT_EL}`);

  /* THE MEASUREMENT THE VIEWPOINT RESTS ON. Each epoch of a walk classified by
     its midpoint, as the widget classifies each piece it draws; a piece that
     leaves the frame is skipped, because the widget does not draw one. Reported
     as the share hidden and how far the farthest hidden midpoint is from the
     least-squares point, in fractions of the panel. */
  const survey = (q, dom, t, az, el) => {
    const w0 = dom.b0[1] - dom.b0[0];
    const w1 = dom.b1[1] - dom.b1[0];
    const inside = (b0, b1) =>
      b0 > dom.b0[0] && b0 < dom.b0[1] && b1 > dom.b1[0] && b1 < dom.b1[1];
    let hid = 0;
    let drawn = 0;
    let far = 0;
    for (let e = 1; e <= t.epochsDone; e += 1) {
      const a = t.epochAt[e - 1];
      const b = t.epochAt[e];
      if (!inside(t.b0[a], t.b1[a]) || !inside(t.b0[b], t.b1[b])) continue;
      drawn += 1;
      const m0 = (t.b0[a] + t.b0[b]) / 2;
      const m1 = (t.b1[a] + t.b1[b]) / 2;
      if (reliefHidden(q, dom, m0, m1, az, el)) {
        hid += 1;
        far = Math.max(far, Math.hypot((m0 - q.B0) / w0, (m1 - q.B1) / w1));
      }
    }
    return { share: drawn ? hid / drawn : 0, drawn, far };
  };

  const walk = descendFull(D.raw, 0.01, EPOCHS);
  const good = survey(D.raw, domR, walk, RELIEF_DEFAULT_AZ, RELIEF_DEFAULT_EL);
  const bad = survey(D.raw, domR, walk, 215, 38);
  check(`${RELIEF_DEFAULT_AZ}/${RELIEF_DEFAULT_EL} hides none of the lr 0.01 walk`, good.share === 0,
    `${(good.share * 100).toFixed(1)}% of ${good.drawn} pieces hidden`);
  check("215/38 hides most of the same walk", bad.share > 0.5,
    `${(bad.share * 100).toFixed(1)}% of ${bad.drawn} pieces hidden`);

  /* EVERY RUNG, ON BOTH SCALES AND FOUR SEEDS — the claim the fixed viewpoint
     actually needs, since the reader can move the ladder and the scale but not
     the camera. Raw x gives away nothing at all: the view looks along the
     trench, which is the flat direction of a surface whose curvatures are 68.5
     and 0.50.

     The standardized bowl is NOT free of it, which the mock's own note had
     wrong. Both curvatures are 2, so in the panel's own coordinates the bowl is
     a round pit stretched by the window's 20.2-against-7.9 aspect, and the log
     ramp turns its last decade into a funnel: what the near lip hides is the
     floor of that funnel, within 0.08 of the panel of the minimum, under the
     ringed point itself. The descent into it is drawn solid; the pieces that
     arrive at the bottom are dashed. */
  let rawHidden = 0;
  let stdFar = 0;
  let rungs = 0;
  for (const { raw, std } of draws) {
    for (const [tag, q] of [["raw", raw], ["std", std]]) {
      const dom = domainFor(q);
      for (const lr of LR_LADDER) {
        const s = survey(q, dom, descendFull(q, lr, EPOCHS), RELIEF_DEFAULT_AZ, RELIEF_DEFAULT_EL);
        rungs += 1;
        if (tag === "raw") rawHidden = Math.max(rawHidden, s.share);
        else stdFar = Math.max(stdFar, s.far);
      }
    }
  }
  check(`raw x: nothing hidden on any of ${rungs / 2} rungs`, rawHidden === 0,
    `worst share ${(rawHidden * 100).toFixed(1)}%`);
  check("standardized x: what is hidden is the pit floor", stdFar < 0.08,
    `farthest hidden piece ${stdFar.toFixed(3)} of the panel from the minimum`);
}

/* -- 12 · THE PACING TABLE -------------------------------------------------- *
 * The two pages run on different clocks (main.js decision 6), which puts a
 * three-by-two table of durations behind the three words the `speed` control
 * shows. The one thing that table must never stop being is ORDERED: Slow slower
 * than Medium slower than Fast, on BOTH pages. A reader picks the label, not the
 * number, and a page where Fast were the slower of two would make the control a
 * lie — and it is exactly the kind of edit that looks safe, because each cell on
 * its own reads fine. */
console.log("\n=== 12 · the beat length is monotone Slow > Medium > Fast ===");
{
  for (const view of ["one", "two"]) {
    const [s, m, f] = ["slow", "medium", "fast"].map((sp) => epochMs(view, sp));
    check(`${view === "one" ? "one parameter" : "two parameters"}: slow > medium > fast`,
      s > m && m > f,
      `${s.toFixed(1)} > ${m.toFixed(1)} > ${f.toFixed(1)} ms an epoch`);
  }
  /* And the declaration that goes with it: a choreographed pair reports its
     epoch as its beat, an unchoreographed one reports no beat at all. */
  const table = [["one", true], ["two", false]];
  let agree = true;
  for (const [view, always] of table) {
    for (const speed of ["slow", "medium", "fast"]) {
      const want = always || speed === "slow";
      if (choreographs(view, speed) !== want) agree = false;
      if (beatMs(view, speed) !== (want ? epochMs(view, speed) : 0)) agree = false;
    }
  }
  check("beatMs is the epoch where it choreographs and 0 where it does not", agree,
    "6 (page, speed) pairs; only the surface at medium and fast show arrivals only");
}

console.log(failed ? `\n${failed} of ${ran} FAILED\n` : `\nall ${ran} checks passed\n`);
process.exit(failed ? 1 : 0);
