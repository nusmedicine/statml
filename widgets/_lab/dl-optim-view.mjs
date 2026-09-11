/* The relief's default viewpoint for `optimizers`, MEASURED rather than chosen
 * (widget 48's lesson: its first viewpoint hid 94% of the walk and nobody saw,
 * because the path was painted over the mesh). For every azimuth and
 * elevation on a grid, count how many segments of the two crossing walks the
 * surface leaves in view — momentum 0.9 at lr 0.3 from Beyond the local
 * minimum (the headline claim, 45 steps to the global minimum) and Adam at lr
 * 1 from the same start (30 steps) — using the same sampled field and the
 * same hidden-line march the widget draws with.
 *
 * Run: node widgets/_lab/dl-optim-view.mjs
 */
import { TRENCH, heightField, sampledField, trace, STARTS } from "../optimizers/model.js";
import { reliefHidden } from "../gradients/model.js";

const G = 66;
const [xd, yd] = TRENCH.range;
const FIELD = sampledField(heightField(TRENCH), xd, yd, G);
const start = STARTS.find((s) => s.value === "beyond").at;

const walks = [
  { name: "momentum 0.9 @ 0.3", w: trace(TRENCH, "momentum", 0.3, start), upto: 60 },
  { name: "adam @ 1", w: trace(TRENCH, "adam", 1, start), upto: 40 },
];

function visible(w, upto, az, el) {
  let n = 0;
  const m = Math.min(upto, w.xs.length - 1);
  for (let k = 0; k < m; k += 1) {
    const mx = (w.xs[k] + w.xs[k + 1]) / 2;
    const my = (w.ys[k] + w.ys[k + 1]) / 2;
    if (!reliefHidden(FIELD, xd, yd, mx, my, az, el)) n += 1;
  }
  return { n, m };
}

const rows = [];
for (let az = 0; az < 360; az += 10) {
  for (let el = 20; el <= 60; el += 5) {
    const parts = walks.map((x) => visible(x.w, x.upto, az, el));
    rows.push({ az, el, total: parts.reduce((a, p) => a + p.n, 0), parts });
  }
}
rows.sort((a, b) => b.total - a.total);
const show = (r) => `az ${String(r.az).padStart(3)} el ${String(r.el).padStart(2)}  ${r.parts.map((p, i) => `${walks[i].name}: ${p.n}/${p.m}`).join("   ")}  total ${r.total}`;
console.log("best twelve viewpoints (segments of the two crossing walks left in view):");
for (const r of rows.slice(0, 12)) console.log("  " + show(r));
console.log("\nfor comparison:");
for (const [az, el] of [[270, 42], [300, 35], [0, 35], [180, 35], [90, 35]]) {
  const parts = walks.map((x) => visible(x.w, x.upto, az, el));
  console.log("  " + show({ az, el, total: parts.reduce((a, p) => a + p.n, 0), parts }));
}
/* elevations at or above 50 are most of the way back to the map, so the best
   viewpoint under 50 is printed on its own */
const under = rows.find((r) => r.el < 50);
console.log(`\nbest under el 50: ${show(under)}`);
