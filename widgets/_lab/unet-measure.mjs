/* Planning measurement for widget 65's round 2 (2026-09-15): the U-Net that
 * trains in compute() so the operation band draws a trained network.
 *
 *   node widgets/_lab/unet-measure.mjs
 *
 * 1. The gradient check of `widgets/unet/engine.js` (BatchNorm in training
 *    mode, the transposed convolution, the concatenation, DiceCELoss).
 * 2. Time and held-out Dice for the candidate sizes, epochs 1..8, three seeds:
 *    depth 2 base 4 at 16 × 16 with 120 / 200 training images, batch 8.
 *
 * FINDINGS are appended below after the run.
 */
import { makeRng } from "../core/rng.js";
import * as E from "../unet/engine.js";

const g = E.gradCheck(makeRng(7));
console.log(`gradient check: max relative error ${g.worst.toExponential(2)} over ${g.count} parameters`);
const g2 = E.gradCheck(makeRng(8), { depth: 2, base: 2, S: 8, B: 2 });
console.log(`gradient check depth 2, S 8: max relative error ${g2.worst.toExponential(2)} over ${g2.count} parameters`);

const S = 16;
for (const nTrain of [120, 200]) {
  for (const seed of [1, 2, 3]) {
    const rng = makeRng(seed);
    const train = E.makeData(S, nTrain, rng);
    const test = E.makeData(S, 60, makeRng(9000));
    const net = E.makeUNet(2, 4, S, rng);
    const line = [];
    let ms = 0;
    let step = 0;
    for (let ep = 1; ep <= 8; ep += 1) {
      const t0 = performance.now();
      step = E.train(net, train, { epochs: 1, rng, step }).steps;
      ms += performance.now() - t0;
      if ([3, 4, 5, 6, 8].includes(ep)) line.push(`e${ep} ${E.evaluateDice(net, test).toFixed(3)} (${(ms / 1000).toFixed(2)} s)`);
    }
    console.log(`n ${nTrain} seed ${seed}: ${line.join("  ")}  params ${E.parameterCount(net)}`);
  }
}
