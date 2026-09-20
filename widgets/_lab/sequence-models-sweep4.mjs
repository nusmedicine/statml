/* The fourth pass of the budget search behind `sequence-models-measure.mjs`:
 * the COST of stability.  The third pass found that the lesson's full width
 * (16 / 32 channels) makes every seed find the motif (min 97% over six) where
 * half width loses one seed in six — at 4.4 s a click against 1.7.  The
 * second convolution is the expensive one (16·32·5·125 multiplies against
 * 4·16·7·250), so: which mix of widths keeps every seed and what does it
 * cost?  And for the recurrence, whose composition task needed a 0.7 / 0.3
 * GC gap to converge on every seed: uni against bi at 20 epochs, N 150 and
 * 200.  Then the CNN + LSTM on the wider convolution's features, and the
 * stride-2 alignment claim at full width, six seeds.
 *
 * Run:  node widgets/_lab/sequence-models-sweep4.mjs
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
const summary = (accs, ms) => `min ${pct(Math.min(...accs))} median ${pct([...accs].sort()[Math.floor(accs.length / 2)])} · ${accs.map(pct).join(" ")} · ${f(mean(ms) / 1000, 1)} s`;

const motifTrain = M.dataset(makeRng(11), 400, 1), motifTest = M.dataset(makeRng(12), 100, 1);
const GC = 0.7;
const compTrain = M.dataset(makeRng(31), 400, 1, { task: "composition", gc: GC }), compTest = M.dataset(makeRng(32), 100, 1, { task: "composition", gc: GC });

head("S1 · the CNN on the motif, one-hot stride 1, N 300 × 20 at 1e-2: widths, six seeds");
const widths = {};
for (const channels of [[16, 32], [16, 16], [16, 8], [12, 16], [12, 12], [24, 8]]) {
  const accs = [], ms = [];
  for (const seed of SEEDS) {
    const rng = makeRng(2000 + seed);
    const net = M.buildCnn(rng, { code: "onehot", stride: 1, channels });
    const t = timed(() => M.trainNet(rng, net, motifTrain.slice(0, 300), { epochs: 20, lr: 1e-2 }));
    ms.push(t.ms); accs.push(E.accuracy(net, motifTest));
  }
  widths[channels.join("/")] = { min: Math.min(...accs), ms: mean(ms) };
  console.log(`channels ${channels.join("/").padEnd(5)}: ${summary(accs, ms)}`);
}

head("S2 · stride 2 at the width that held, six seeds, by the motif's offset parity");
{
  const pick = Object.entries(widths).filter(([, v]) => v.min >= 0.95).sort((a, b) => a[1].ms - b[1].ms)[0];
  const channels = (pick ? pick[0] : "16/32").split("/").map(Number);
  console.log(`using channels ${channels.join("/")}`);
  for (const stride of [2, 1]) {
    const even = [], odd = [], all = [];
    for (const seed of SEEDS) {
      const rng = makeRng(2100 + seed);
      const net = M.buildCnn(rng, { code: "onehot", stride, channels });
      M.trainNet(rng, net, motifTrain.slice(0, 300), { epochs: 20, lr: 1e-2 });
      const ones = motifTest.filter((d) => d.y === 1);
      even.push(E.accuracy(net, ones.filter((d) => d.motifAt[0] % 2 === 0))); odd.push(E.accuracy(net, ones.filter((d) => d.motifAt[0] % 2 === 1))); all.push(E.accuracy(net, motifTest));
    }
    console.log(`stride ${stride}: test ${all.map(pct).join(" ")}; class 1 with the motif at an even offset ${even.map(pct).join(" ")} (mean ${pct(mean(even))}), odd ${odd.map(pct).join(" ")} (mean ${pct(mean(odd))})`);
  }
}

head("S3 · the recurrence on composition (0.7 / 0.3), one-hot, last, packed, H 8: direction × N at 20 epochs, six seeds");
for (const direction of ["uni", "bi"]) for (const N of [150, 200]) {
  const accs = [], ms = [];
  for (const seed of SEEDS) {
    const rng = makeRng(3000 + seed);
    const model = M.buildSeqModel(rng, { code: "onehot", direction, pack: true, reduce: "last" });
    const t = timed(() => M.trainNet(rng, model, compTrain.slice(0, N), { epochs: 20, lr: 1e-2 }));
    ms.push(t.ms); accs.push(E.accuracy(model, compTest));
  }
  console.log(`${direction} N ${N} × 20: ${summary(accs, ms)}`);
}

head("S4 · CNN + LSTM on the wider convolution's frozen features, both tasks, last and max, three seeds");
for (const [task, tr, te] of [["motif", motifTrain, motifTest], ["composition", compTrain, compTest]]) {
  const rng = makeRng(180);
  const cnn = M.buildCnn(rng, { code: "onehot", stride: 1, channels: [16, 32] });
  M.trainNet(rng, cnn, tr.slice(0, 300), { epochs: 20, lr: 1e-2 });
  const fTrain = tr.slice(0, 200).map((d) => ({ x: M.convFeatures(cnn, d.x), y: d.y })), fTest = te.map((d) => ({ x: M.convFeatures(cnn, d.x), y: d.y }));
  for (const reduce of ["last", "max"]) {
    const accs = [], ms = [];
    for (const seed of [1, 2, 3]) {
      const rng2 = makeRng(190 + seed);
      const model = M.buildFeatureLstm(rng2, { D: 16, pack: true, reduce });
      const t = timed(() => M.trainNet(rng2, model, fTrain, { epochs: 8, lr: 1e-2 }));
      ms.push(t.ms); accs.push(E.accuracy(model, fTest));
    }
    console.log(`${task.padEnd(12)} [250, 16] → BiLSTM H 8, ${reduce}: 200 × 8: ${summary(accs, ms)} (page 1's net ${pct(E.accuracy(cnn, te))})`);
  }
}

console.log(`\ntotal ${secs()} s`);
