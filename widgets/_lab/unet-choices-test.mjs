/* TEST ONLY (Kenneth, 2026-09-15: "give some choices so students can see what
 * happens if we change the architecture"). Which depth × base choices can the
 * widget train on a 16 × 16 colour image in a wait a reader accepts? The
 * widget's engine, 3 input channels, 200 images, 5 epochs; three seeds for the
 * time and the held-out Dice.
 *
 *     node widgets/_lab/unet-choices-test.mjs
 */
import { makeRng } from "../core/rng.js";
import * as E from "../unet/engine.js";

for (const [depth, base] of [[1, 4], [2, 4], [3, 4], [4, 4], [2, 8], [3, 8]]) {
  const out = [];
  for (const seed of [1, 2, 3]) {
    const rng = makeRng(seed);
    const data = E.makeData(16, 200, rng, 3);
    const test = E.makeData(16, 60, makeRng(9000), 3);
    const net = E.makeUNet(depth, base, 16, rng, 3);
    const t0 = performance.now();
    E.train(net, data, { epochs: 5, rng });
    out.push({ s: (performance.now() - t0) / 1000, d: E.evaluateDice(net, test), p: E.parameterCount(net) });
  }
  console.log(`depth ${depth} base ${base} (${out[0].p} params): ${out.map((o) => o.s.toFixed(1)).join(" / ")} s, Dice ${out.map((o) => o.d.toFixed(2)).join(" / ")}`);
}
