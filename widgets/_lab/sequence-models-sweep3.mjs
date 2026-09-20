/* The third pass of the budget search behind `sequence-models-measure.mjs`:
 * STABILITY.  The second pass's "settled" CNN setting (one-hot, stride 1,
 * 300 × 20 at Adam 1e-2) scored 98 / 99 / 96 on seeds 1001–1003 and then
 * 52 / 68 / 60 on seeds 101–103 in the measure — half the seeds never find
 * the motif in 20 epochs, and a click that trains to chance half the time
 * is not a widget.  The LSTM's last-state reading on composition is the
 * same (96 / 98 / 85 on one seed triple, 60 / 56 / 69 on another).  So:
 * over six seeds, which of width (the lesson's 16 / 32 against half), epochs,
 * learning rate and — for the recurrence — the task's gap and H makes EVERY
 * seed converge, and at what cost?
 *
 * Run:  node widgets/_lab/sequence-models-sweep3.mjs
 * ------------------------------------------------------------------------- */

import { makeRng } from "../core/rng.js";
import * as E from "../signal-cnn-lstm/engine.js";
import * as M from "../sequence-models/model.js";

const t0 = Date.now();
const secs = () => ((Date.now() - t0) / 1000).toFixed(1);
const pct = (x) => (100 * x).toFixed(0) + "%";
const f = (x, d = 2) => Number(x).toFixed(d);
const head = (s) => console.log(`\n=== ${s} ===  [${secs()} s]`);
const timed = (fn) => { const t = performance.now(); const r = fn(); return { r, ms: performance.now() - t }; };
const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;
const SEEDS = [1, 2, 3, 4, 5, 6];
const summary = (accs, ms) => `min ${pct(Math.min(...accs))} median ${pct([...accs].sort()[3])} · ${accs.map(pct).join(" ")} · ${f(mean(ms) / 1000, 1)} s`;

const motifTrain = M.dataset(makeRng(11), 400, 1), motifTest = M.dataset(makeRng(12), 100, 1);

head("S1 · the CNN on the motif, one-hot stride 1, N 300: width × epochs × lr, six seeds");
for (const channels of [[8, 16], [16, 32]]) for (const lr of [1e-2, 2e-2]) for (const epochs of [20, 30]) {
  const accs = [], ms = [];
  for (const seed of SEEDS) {
    const rng = makeRng(2000 + seed);
    const net = M.buildCnn(rng, { code: "onehot", stride: 1, channels });
    const t = timed(() => M.trainNet(rng, net, motifTrain.slice(0, 300), { epochs, lr }));
    ms.push(t.ms); accs.push(E.accuracy(net, motifTest));
  }
  console.log(`channels ${channels.join("/")} lr ${lr} × ${epochs}: ${summary(accs, ms)}`);
}
head("S1b · the same at N 200 and 400 for the width that held");
for (const N of [200, 400]) for (const channels of [[8, 16], [16, 32]]) {
  const accs = [], ms = [];
  for (const seed of SEEDS) {
    const rng = makeRng(2000 + seed);
    const net = M.buildCnn(rng, { code: "onehot", stride: 1, channels });
    const t = timed(() => M.trainNet(rng, net, motifTrain.slice(0, N), { epochs: 20, lr: 1e-2 }));
    ms.push(t.ms); accs.push(E.accuracy(net, motifTest));
  }
  console.log(`N ${N} channels ${channels.join("/")} lr 1e-2 × 20: ${summary(accs, ms)}`);
}

head("S2 · the LSTM on composition, uni packed last, one-hot, N 200: gap × H × epochs, six seeds");
for (const gc of [0.6, 0.7]) {
  const tr = M.dataset(makeRng(31), 200, 1, { task: "composition", gc }), te = M.dataset(makeRng(32), 100, 1, { task: "composition", gc });
  for (const H of [8, 16]) for (const epochs of [12, 20]) {
    const accs = [], ms = [];
    for (const seed of SEEDS) {
      const rng = makeRng(3000 + seed);
      const model = M.buildSeqModel(rng, { code: "onehot", direction: "uni", pack: true, reduce: "last", H });
      const t = timed(() => M.trainNet(rng, model, tr, { epochs, lr: 1e-2 }));
      ms.push(t.ms); accs.push(E.accuracy(model, te));
    }
    console.log(`gc ${gc} H ${H} × ${epochs}: ${summary(accs, ms)}`);
  }
}
head("S2b · and the failure arm, uni UNPACKED last, at the gap and H that held (must stay at chance)");
for (const gc of [0.6, 0.7]) for (const H of [8, 16]) {
  const tr = M.dataset(makeRng(31), 200, 1, { task: "composition", gc }), te = M.dataset(makeRng(32), 100, 1, { task: "composition", gc });
  const accs = [], ms = [];
  for (const seed of SEEDS.slice(0, 3)) {
    const rng = makeRng(3000 + seed);
    const model = M.buildSeqModel(rng, { code: "onehot", direction: "uni", pack: false, reduce: "last", H });
    const t = timed(() => M.trainNet(rng, model, tr, { epochs: 12, lr: 1e-2 }));
    ms.push(t.ms); accs.push(E.accuracy(model, te));
  }
  console.log(`gc ${gc} H ${H} unpacked × 12: ${summary(accs.concat(accs), ms)}`);
}
head("S2c · bi packed last and bi unpacked last at the gap that held, H 8, six seeds");
for (const gc of [0.6, 0.7]) for (const pack of [true, false]) {
  const tr = M.dataset(makeRng(31), 200, 1, { task: "composition", gc }), te = M.dataset(makeRng(32), 100, 1, { task: "composition", gc });
  const accs = [], ms = [];
  for (const seed of SEEDS) {
    const rng = makeRng(3000 + seed);
    const model = M.buildSeqModel(rng, { code: "onehot", direction: "bi", pack, reduce: "last", H: 8 });
    const t = timed(() => M.trainNet(rng, model, tr, { epochs: 12, lr: 1e-2 }));
    ms.push(t.ms); accs.push(E.accuracy(model, te));
  }
  console.log(`gc ${gc} bi ${pack ? "packed" : "unpacked"} × 12: ${summary(accs, ms)}`);
}

console.log(`\ntotal ${secs()} s`);
