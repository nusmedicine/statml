/* The sixth pass of the budget search behind `sequence-models-measure.mjs`:
 * THE KERNEL LOTTERY.  Fresh data an epoch (pass 5) did not make every seed
 * find the motif — at 8/16 half the seeds sat at chance with their best
 * kernel matching 2–3 of 7 columns, at 16/16 one in eight — so the failure is
 * the initialisation: no kernel starts near enough to the 7-mer for the
 * global max to hand it the gradient.  What moves the odds: a lower rate
 * for longer, a larger batch (a steadier gradient), or more first-layer
 * kernels with a thin second layer, at what cost?  Fixed data throughout,
 * as the widget would train, eight seeds.
 *
 * Run:  node widgets/_lab/sequence-models-sweep6.mjs
 * ------------------------------------------------------------------------- */

import { makeRng } from "../core/rng.js";
import * as E from "../signal-cnn-lstm/engine.js";
import * as M from "../sequence-cnn-lstm/model.js";

const t0 = Date.now();
const secs = () => ((Date.now() - t0) / 1000).toFixed(1);
const pct = (x) => (100 * x).toFixed(0) + "%";
const f = (x, d = 2) => Number(x).toFixed(d);
const head = (s) => console.log(`\n=== ${s} ===  [${secs()} s]`);
const timed = (fn) => { const t = performance.now(); const r = fn(); return { r, ms: performance.now() - t }; };
const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
const summary = (accs, ms) => `min ${pct(Math.min(...accs))} median ${pct([...accs].sort()[Math.floor(accs.length / 2)])} · ${accs.map(pct).join(" ")} · ${f(mean(ms) / 1000, 1)} s`;
const motifTrain = M.dataset(makeRng(11), 400, 1), motifTest = M.dataset(makeRng(12), 100, 1);

head("S1 · one-hot stride 1, N 300, fixed data: channels × lr × epochs × batch, eight seeds");
for (const cfg of [
  { channels: [16, 16], lr: 1e-2, epochs: 20, batch: 16 },
  { channels: [16, 16], lr: 1e-2, epochs: 20, batch: 32 },
  { channels: [16, 16], lr: 3e-3, epochs: 30, batch: 16 },
  { channels: [32, 8], lr: 1e-2, epochs: 20, batch: 16 },
  { channels: [32, 8], lr: 1e-2, epochs: 20, batch: 32 },
  { channels: [24, 8], lr: 1e-2, epochs: 20, batch: 16 },
  { channels: [16, 8], lr: 1e-2, epochs: 20, batch: 32 },
  { channels: [8, 16], lr: 1e-2, epochs: 20, batch: 32 },
]) {
  const accs = [], ms = [];
  for (const seed of SEEDS) {
    const rng = makeRng(6000 + seed);
    const net = M.buildCnn(rng, { code: "onehot", stride: 1, channels: cfg.channels });
    const t = timed(() => E.train(rng, net, motifTrain.slice(0, 300), { epochs: cfg.epochs, lr: cfg.lr, batch: cfg.batch }));
    ms.push(t.ms); accs.push(E.accuracy(net, motifTest));
  }
  console.log(`${cfg.channels.join("/").padEnd(5)} lr ${String(cfg.lr).padEnd(5)} × ${cfg.epochs} batch ${cfg.batch}: ${summary(accs, ms)}`);
}

console.log(`\ntotal ${secs()} s`);
