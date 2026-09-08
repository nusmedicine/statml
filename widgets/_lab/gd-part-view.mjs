/* ============================================================================
   Where the Partial derivatives tab's relief should OPEN from.

       node widgets/_lab/gd-part-view.mjs

   The same question `_lab/gd-3d.html` swept for the loss surface, asked again
   for y = a^2 + 3ab and answered the same way: by measuring rather than by
   eye. The relief on that tab exists to show one variable varying while the
   other is held, and what carries that are the TWO SLICE CURVES lifted onto
   the surface — so the viewpoint to open at is the one that hides the least of
   them, with the point in front rather than round the back.

   Uses the shipping `reliefHidden` and `projector` out of `widgets/gradients/
   model.js`, never a copy (5.8): a sweep run against its own ray march would
   be measuring a surface the widget does not draw.

   The window is a SADDLE — y rises in a, and rises or falls in b depending on
   the sign of a — so unlike the loss surface's trench there is no single
   direction that is flat. What the sweep is looking for is therefore a
   viewpoint that hides little from ANY point the two sliders can reach, not
   only from the default (2, 1).
   ========================================================================= */

import {
  A_RANGE, B_RANGE, valueField, reliefHidden, reliefPoint, projector,
  RELIEF_DEFAULT_AZ, RELIEF_DEFAULT_EL,
} from "../gradients/model.js";

const SEG = 48;         // segments per slice curve, as the widget draws them
const RECT = { x: 0, y: 0, w: 300, h: 300 };

/* Every (a, b) the sliders can stop on is 51 x 41 pairs; a 6 x 5 grid over the
   same window is what the sweep costs an hour rather than a day, and the
   surface has no feature narrower than a grid cell. */
const POINTS = [];
for (let i = 0; i <= 5; i += 1) {
  for (let j = 0; j <= 4; j += 1) {
    POINTS.push([
      A_RANGE[0] + (i / 5) * (A_RANGE[1] - A_RANGE[0]),
      B_RANGE[0] + (j / 4) * (B_RANGE[1] - B_RANGE[0]),
    ]);
  }
}

const hide = (a, b, az, el) => reliefHidden(valueField, A_RANGE, B_RANGE, a, b, az, el);

/** The share of the two slice curves' segments the surface hides, classified
    at each segment's midpoint exactly as the widget classifies the pieces it
    draws. */
function hiddenShare(a, b, az, el) {
  let hid = 0;
  let n = 0;
  for (const [dom, along] of [[A_RANGE, "a"], [B_RANGE, "b"]]) {
    for (let k = 0; k < SEG; k += 1) {
      const u = dom[0] + ((k + 0.5) / SEG) * (dom[1] - dom[0]);
      n += 1;
      if (hide(along === "a" ? u : a, along === "a" ? b : u, az, el)) hid += 1;
    }
  }
  return hid / n;
}

/** Is the point on the near half of the surface? Depth grows away from the
    camera, so this is its depth against the middle of the window's own. */
function inFront(a, b, az, el) {
  const P = projector(RECT, az, el);
  const at = (x, y) => P(...reliefPoint(valueField, A_RANGE, B_RANGE, x, y)).depth;
  const mid = at((A_RANGE[0] + A_RANGE[1]) / 2, (B_RANGE[0] + B_RANGE[1]) / 2);
  return at(a, b) <= mid;
}

const rows = [];
for (let az = 0; az < 360; az += 5) {
  for (let el = 20; el <= 60; el += 5) {
    let worst = 0;
    let mean = 0;
    let behind = 0;
    for (const [a, b] of POINTS) {
      const s = hiddenShare(a, b, az, el);
      worst = Math.max(worst, s);
      mean += s / POINTS.length;
      if (!inFront(a, b, az, el)) behind += 1;
    }
    rows.push({
      az, el, worst, mean, behind,
      here: hiddenShare(2, 1, az, el),
      hereBehind: inFront(2, 1, az, el) ? 0 : 1,
    });
  }
}

/* Ranked on the default point first — that is the figure everyone opens — then
   on the worst any slider position can produce. */
const rank = (r) => r.here * 4 + r.worst + r.mean + r.hereBehind * 2 + (r.behind / POINTS.length);
rows.sort((a, b) => rank(a) - rank(b));

const line = (r) => `  az ${String(r.az).padStart(3)} el ${String(r.el).padStart(2)}   `
  + `at (2, 1) ${(r.here * 100).toFixed(1).padStart(5)}%   `
  + `worst ${(r.worst * 100).toFixed(1).padStart(5)}%   `
  + `mean ${(r.mean * 100).toFixed(1).padStart(5)}%   `
  + `${r.behind} of ${POINTS.length} points behind the middle`;

console.log(`\n=== the ten best of ${rows.length} viewpoints, 5-degree steps ===`);
for (const r of rows.slice(0, 10)) console.log(line(r));

console.log("\n=== the ten worst ===");
for (const r of rows.slice(-10)) console.log(line(r));

const at = (az, el) => rows.find((r) => r.az === az && r.el === el);
console.log("\n=== the loss surface's own default, and the best on its azimuth ===");
console.log(line(at(RELIEF_DEFAULT_AZ, RELIEF_DEFAULT_EL)));
const onAz = rows.filter((r) => r.az === RELIEF_DEFAULT_AZ).sort((a, b) => rank(a) - rank(b));
console.log(line(onAz[0]));

console.log("\n=== every elevation on the four cardinal-ish azimuths ===");
for (const az of [30, 120, 210, 300]) {
  for (const r of rows.filter((v) => v.az === az).sort((a, b) => a.el - b.el)) console.log(line(r));
  console.log("");
}

/* THE CLAIM THE SHIPPED DEFAULT ACTUALLY HAS TO MAKE, and the grid above is
   too coarse for it: not "good at 30 sampled points" but "good at every stop
   the two sliders have". Both step 0.1, so that is 51 x 41 = 2091 pairs, each
   with 96 slice segments and the point itself to classify. */
{
  let worst = 0;
  let where = "";
  let pointHidden = 0;
  let n = 0;
  for (let ai = 0; ai <= 50; ai += 1) {
    for (let bi = 0; bi <= 40; bi += 1) {
      const a = Math.round((A_RANGE[0] + ai * 0.1) * 10) / 10;
      const b = Math.round((B_RANGE[0] + bi * 0.1) * 10) / 10;
      n += 1;
      const s = hiddenShare(a, b, RELIEF_DEFAULT_AZ, RELIEF_DEFAULT_EL);
      if (s > worst) {
        worst = s;
        where = `(${a}, ${b})`;
      }
      if (hide(a, b, RELIEF_DEFAULT_AZ, RELIEF_DEFAULT_EL)) pointHidden += 1;
    }
  }
  console.log(`=== ${RELIEF_DEFAULT_AZ} / ${RELIEF_DEFAULT_EL} at every one of the ${n} slider stops ===`);
  console.log(`  worst share of the two slices hidden: ${(worst * 100).toFixed(1)}%${where ? ` at ${where}` : ""}`);
  console.log(`  points hidden by the surface itself:  ${pointHidden}\n`);
}
