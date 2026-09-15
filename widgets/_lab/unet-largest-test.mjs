/* TEST ONLY (Kenneth, 2026-09-15: "what is the largest u-net that is feasible
 * in browser?"). The widget's own engine (widgets/unet/engine.js, Float64, one
 * thread), 200 training images, 5 epochs, batch 8, held-out Dice on 60 images.
 * One seed a setting past the ones `unet-small-test.mjs` measured on three.
 * The time a reader waits is the training time; node and a desktop browser
 * run this code at about the same speed (widget 64's engine, 2026-09-15).
 *
 *     node widgets/_lab/unet-largest-test.mjs
 */
import { makeRng } from "../core/rng.js";
import * as E from "../unet/engine.js";

const SETTINGS = [
  [4, 4, 16], [3, 8, 16], [4, 8, 16], [2, 16, 16], [3, 16, 16],
  [4, 4, 32], [2, 8, 32],
  [2, 4, 64],
];
for (const [depth, base, S] of SETTINGS) {
  const rng = makeRng(1);
  const data = E.makeData(S, 200, rng);
  const test = E.makeData(S, 60, makeRng(9000));
  const net = E.makeUNet(depth, base, S, rng);
  const t0 = performance.now();
  E.train(net, data, { epochs: 5, rng });
  const secs = (performance.now() - t0) / 1000;
  const dice = E.evaluateDice(net, test);
  console.log(`depth ${depth} base ${base} input ${S} (${E.parameterCount(net)} params): 5 epochs ${secs.toFixed(1)} s, held-out Dice ${dice.toFixed(2)}`);
}
