/* TEST ONLY (Kenneth, 2026-09-15, "would showing a smaller u-net instead be
 * useful to match the computation?"). Which settings could the browser engine
 * train on page load, so the diagram and the operation panel are ONE network?
 * Times widgets/unet/engine.js (the one the widget ships) at small settings,
 * 200 images, three seeds, and reads held-out Dice at 3 and 5 epochs.
 *
 *     node widgets/_lab/unet-small-test.mjs
 */
import { makeRng } from "../core/rng.js";
import * as E from "../unet/engine.js";

const SETTINGS = [[2, 4, 16], [3, 4, 16], [2, 8, 16], [2, 4, 32], [3, 4, 32], [3, 8, 32]];
for (const [depth, base, S] of SETTINGS) {
  const rows = [];
  for (const seed of [1, 2, 3]) {
    const rng = makeRng(seed);
    const data = E.makeData(S, 200, rng);
    const test = E.makeData(S, 60, makeRng(9000));
    const net = E.makeUNet(depth, base, S, rng);
    let step = 0;
    const t0 = performance.now();
    step = E.train(net, data, { epochs: 3, rng, step }).steps;
    const t3 = performance.now() - t0;
    const d3 = E.evaluateDice(net, test);
    const t1 = performance.now();
    step = E.train(net, data, { epochs: 2, rng, step }).steps;
    const t5 = t3 + performance.now() - t1;
    const d5 = E.evaluateDice(net, test);
    rows.push({ t3, d3, t5, d5 });
  }
  const f = (k, d = 2) => rows.map((r) => r[k].toFixed(d)).join(" / ");
  const ms = (k) => rows.map((r) => `${(r[k] / 1000).toFixed(1)}`).join(" / ");
  console.log(`depth ${depth} base ${base} input ${S} (${E.parameterCount(E.makeUNet(depth, base, S, makeRng(1)))} params): `
    + `3 epochs ${ms("t3")} s, Dice ${f("d3")}; 5 epochs ${ms("t5")} s, Dice ${f("d5")}`);
}
