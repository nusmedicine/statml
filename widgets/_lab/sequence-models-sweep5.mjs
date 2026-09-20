/* The fifth pass of the budget search behind `sequence-models-measure.mjs`:
 * FRESH DATA.  Over 21 seeds at 16/16 channels, 300 × 20 at Adam 1e-2, the
 * CNN reached 90% on 17 and sat near chance on two, with the training loss
 * at 0.00 either way — the failed seeds MEMORISE the 300 fixed random
 * sequences before any kernel finds the one planted 7-mer.  The stage is
 * synthetic, so the training set can be a stream: `E.train` now accepts a
 * function of the epoch and each epoch draws 300 new sequences from the
 * seeded rng, and there is nothing to memorise.  Does every seed converge,
 * at half width, and what does it cost?  The same for the recurrence's
 * last-state reading on composition, and for the CNN + LSTM's features.
 *
 * Run:  node widgets/_lab/sequence-models-sweep5.mjs
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

const motifTest = M.dataset(makeRng(12), 100, 1);
const GC = 0.7;
const compTest = M.dataset(makeRng(32), 100, 1, { task: "composition", gc: GC });

head("S1 · the CNN on the motif, one-hot stride 1, fresh 300 sequences an epoch × 20 at 1e-2: widths, eight seeds");
for (const channels of [[8, 16], [16, 16], [8, 8], [12, 12]]) for (const N of [300]) {
  const accs = [], ms = [], spells = [];
  for (const seed of SEEDS) {
    const rng = makeRng(4000 + seed);
    const net = M.buildCnn(rng, { code: "onehot", stride: 1, channels });
    const t = timed(() => M.trainNet(rng, net, () => M.dataset(rng, N, 1), { epochs: 20, lr: 1e-2 }));
    ms.push(t.ms); accs.push(E.accuracy(net, motifTest));
    const ks = M.kernelsSpelled(net); spells.push(ks[0].match);
  }
  console.log(`channels ${channels.join("/").padEnd(5)} N ${N}: ${summary(accs, ms)}; best kernel's match ${spells.join(" ")}/7`);
}
head("S1b · the same at 8/16 with fewer epochs and sequences");
for (const [N, epochs] of [[200, 20], [300, 12], [200, 12]]) {
  const accs = [], ms = [];
  for (const seed of SEEDS) {
    const rng = makeRng(4000 + seed);
    const net = M.buildCnn(rng, { code: "onehot", stride: 1, channels: [8, 16] });
    const t = timed(() => M.trainNet(rng, net, () => M.dataset(rng, N, 1), { epochs, lr: 1e-2 }));
    ms.push(t.ms); accs.push(E.accuracy(net, motifTest));
  }
  console.log(`8/16 N ${N} × ${epochs}: ${summary(accs, ms)}`);
}
head("S1c · fresh data at the lesson's stride 2, and with the learned table, 8/16, 300 × 20");
for (const cfg of [{ stride: 2, code: "onehot" }, { stride: 1, code: "learned", E: 8 }]) {
  const accs = [], ms = [];
  for (const seed of SEEDS) {
    const rng = makeRng(4000 + seed);
    const net = M.buildCnn(rng, { ...cfg, channels: [8, 16] });
    const t = timed(() => M.trainNet(rng, net, () => M.dataset(rng, 300, 1), { epochs: 20, lr: 1e-2 }));
    ms.push(t.ms); accs.push(E.accuracy(net, motifTest));
  }
  console.log(`${JSON.stringify(cfg)}: ${summary(accs, ms)}`);
}

head("S2 · the recurrence on composition, uni packed last, H 8, fresh 150 an epoch × 20; and unpacked");
for (const pack of [true, false]) {
  const accs = [], ms = [];
  for (const seed of SEEDS) {
    const rng = makeRng(5000 + seed);
    const model = M.buildSeqModel(rng, { code: "onehot", direction: "uni", pack, reduce: "last" });
    const t = timed(() => M.trainNet(rng, model, () => M.dataset(rng, 150, 1, { task: "composition", gc: GC }), { epochs: 20, lr: 1e-2 }));
    ms.push(t.ms); accs.push(E.accuracy(model, compTest));
  }
  console.log(`uni ${pack ? "packed  " : "unpacked"}: ${summary(accs, ms)}`);
}
head("S2b · bi packed and unpacked, fresh 150 an epoch × 20, and the 0.6 / 0.4 gap under fresh data");
for (const [direction, pack, gc] of [["bi", true, 0.7], ["bi", false, 0.7], ["uni", true, 0.6], ["bi", true, 0.6]]) {
  const te = gc === GC ? compTest : M.dataset(makeRng(32), 100, 1, { task: "composition", gc });
  const accs = [], ms = [];
  for (const seed of SEEDS.slice(0, 6)) {
    const rng = makeRng(5000 + seed);
    const model = M.buildSeqModel(rng, { code: "onehot", direction, pack, reduce: "last" });
    const t = timed(() => M.trainNet(rng, model, () => M.dataset(rng, 150, 1, { task: "composition", gc }), { epochs: 20, lr: 1e-2 }));
    ms.push(t.ms); accs.push(E.accuracy(model, te));
  }
  console.log(`${direction} ${pack ? "packed  " : "unpacked"} gc ${gc}: ${summary(accs, ms)}`);
}

head("S3 · CNN + LSTM on a fresh-trained 8/16 net's frozen features, fresh 200 an epoch × 8: motif last and max");
{
  const rng = makeRng(180);
  const cnn = M.buildCnn(rng, { code: "onehot", stride: 1, channels: [8, 16] });
  M.trainNet(rng, cnn, () => M.dataset(rng, 300, 1), { epochs: 20, lr: 1e-2 });
  console.log(`page 1's net: test ${pct(E.accuracy(cnn, motifTest))}`);
  const fTest = motifTest.map((d) => ({ x: M.convFeatures(cnn, d.x), y: d.y }));
  for (const reduce of ["last", "max"]) {
    const accs = [], ms = [];
    for (const seed of SEEDS.slice(0, 4)) {
      const rng2 = makeRng(190 + seed);
      const model = M.buildFeatureLstm(rng2, { D: 8, pack: true, reduce });
      const t = timed(() => M.trainNet(rng2, model, () => M.dataset(rng2, 200, 1).map((d) => ({ x: M.convFeatures(cnn, d.x), y: d.y })), { epochs: 8, lr: 1e-2 }));
      ms.push(t.ms); accs.push(E.accuracy(model, fTest));
    }
    console.log(`motif [250, 8] → BiLSTM H 8, ${reduce}: ${summary(accs, ms)}`);
  }
}

console.log(`\ntotal ${secs()} s`);
