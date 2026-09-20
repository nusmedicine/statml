/* The second pass of the budget search behind `sequence-models-measure.mjs`
 * (`sequence-models-sweep.mjs` is the first).  That pass found: stride 1
 * trains and stride 2 does not at the same budget; one-hot trains faster
 * than a learned table; the BiLSTM never finds the 7-mer.  So: is stride 2's
 * failure alignment?  What click budget does the CNN need?  Does the LSTM
 * learn a COMPOSITION task (GC-rich against GC-poor, the lesson's
 * coding-against-intergenic in proxy), and does packing matter there?  And
 * does the CNN + LSTM find the motif when it stands on page 1's trained
 * convolution, as 73's did?
 *
 * Run:  node widgets/_lab/sequence-models-sweep2.mjs
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
const train400 = M.dataset(makeRng(11), 400, 1), test = M.dataset(makeRng(12), 100, 1);


head("S6 · stride 2 and alignment: a trained stride-2 net, scored by the parity of the motif's offset");
{
  for (const stride of [2, 1]) {
    const rng = makeRng(900);
    const net = M.buildCnn(rng, { code: "onehot", stride });
    M.trainNet(rng, net, train400, { epochs: 20, lr: 1e-2 });
    const ones = test.filter((d) => d.y === 1);
    const by = [0, 1].map((par) => { const s = ones.filter((d) => d.motifAt[0] % 2 === par); return `${pct(E.accuracy(net, s))} of ${s.length}`; });
    console.log(`stride ${stride}, one-hot, 400 × 20 at 1e-2: class-1 accuracy with the motif at an even offset ${by[0]}, at an odd offset ${by[1]}; class 0 ${pct(E.accuracy(net, test.filter((d) => d.y === 0)))}`);
  }
}

head("S7 · the CNN's click budget: one-hot, stride 1, Adam 1e-2, three seeds");
for (const [N, epochs] of [[200, 20], [200, 30], [300, 20], [400, 15], [400, 20]]) {
  const accs = [], ms = [];
  for (const seed of [1, 2, 3]) {
    const rng = makeRng(1000 + seed);
    const net = M.buildCnn(rng, { code: "onehot", stride: 1 });
    const t = timed(() => M.trainNet(rng, net, train400.slice(0, N), { epochs, lr: 1e-2 }));
    ms.push(t.ms); accs.push(E.accuracy(net, test));
  }
  console.log(`N ${N} × ${epochs}: ${f(ms.reduce((a, c) => a + c, 0) / 3000, 1)} s; test ${accs.map(pct).join(" ")}`);
}
head("S7b · the learned table at the same budget, E = 4 and 8, stride 1, Adam 1e-2");
for (const Ed of [4, 8]) for (const [N, epochs] of [[300, 20], [400, 20]]) {
  const accs = [], ms = [], spells = [];
  for (const seed of [1, 2, 3]) {
    const rng = makeRng(1100 + seed);
    const net = M.buildCnn(rng, { code: "learned", E: Ed, stride: 1 });
    const t = timed(() => M.trainNet(rng, net, train400.slice(0, N), { epochs, lr: 1e-2 }));
    ms.push(t.ms); accs.push(E.accuracy(net, test));
    const ks = M.kernelsSpelled(net); spells.push(`${ks[0].spell}(${ks[0].match})`);
  }
  console.log(`E ${Ed} N ${N} × ${epochs}: ${f(ms.reduce((a, c) => a + c, 0) / 3000, 1)} s; test ${accs.map(pct).join(" ")}; best kernel through the table ${spells.join(" ")}`);
}

head("S8 · the composition task (GC 0.6 against 0.4): the CNN, then the BiLSTM by pack × direction");
const compTrain = M.dataset(makeRng(31), 400, 1, { task: "composition" }), compTest = M.dataset(makeRng(32), 100, 1, { task: "composition" });
{
  const gcs = compTest.map((d) => M.gcOf(d.x.tok));
  console.log(`GC of class 1 ${f(gcs.filter((_, i) => compTest[i].y === 1).reduce((a, b) => a + b, 0) / 50)}, class 0 ${f(gcs.filter((_, i) => compTest[i].y === 0).reduce((a, b) => a + b, 0) / 50)}`);
  for (const pool of ["max", "avg"]) {
    const rng = makeRng(1200);
    const net = M.buildCnn(rng, { code: "onehot", stride: 1, pool });
    const t = timed(() => M.trainNet(rng, net, compTrain.slice(0, 200), { epochs: 20, lr: 1e-2 }));
    console.log(`CNN one-hot s1, ${pool} pool, 200 × 20: ${f(t.ms / 1000, 1)} s, test ${pct(E.accuracy(net, compTest))}`);
  }
}
for (const epochs of [12, 20]) for (const direction of ["bi", "uni"]) for (const pack of [true, false]) {
  const accs = [], ms = [], drift = [];
  for (const seed of [1, 2, 3]) {
    const rng = makeRng(1300 + seed);
    const model = M.buildSeqModel(rng, { code: "onehot", pack, reduce: "last", direction });
    const t = timed(() => M.trainNet(rng, model, compTrain.slice(0, 200), { epochs, lr: 1e-2 }));
    ms.push(t.ms); accs.push(E.accuracy(model, compTest));
    drift.push(f(M.padDrift(model, compTest[1].x).move, 2));
  }
  console.log(`${direction.padEnd(3)} pack ${pack ? "on " : "off"} last, one-hot, 200 × ${epochs} at 1e-2: ${f(ms.reduce((a, c) => a + c, 0) / 3000, 1)} s; test ${accs.map(pct).join(" ")}; forward state's move over the PAD ${drift.join(" ")}`);
}
head("S8b · composition at a smaller gap (0.55 against 0.45), packed bi, and the learned table");
for (const [gc, code] of [[0.55, "onehot"], [0.6, "learned"]]) {
  const tr = M.dataset(makeRng(41), 200, 1, { task: "composition", gc }), te = M.dataset(makeRng(42), 100, 1, { task: "composition", gc });
  const rng = makeRng(1400);
  const model = M.buildSeqModel(rng, { code, E: 8, pack: true, reduce: "last" });
  const t = timed(() => M.trainNet(rng, model, tr, { epochs: 12, lr: 1e-2 }));
  console.log(`gc ${gc}, ${code}: ${f(t.ms / 1000, 1)} s, test ${pct(E.accuracy(model, te))}`);
}

head("S9 · CNN + LSTM on the motif, standing on page 1's trained convolution (frozen), packed");
{
  const rng = makeRng(1500);
  const cnn = M.buildCnn(rng, { code: "onehot", stride: 1 });
  M.trainNet(rng, cnn, train400, { epochs: 20, lr: 1e-2 });
  console.log(`page 1's net: test ${pct(E.accuracy(cnn, test))}`);
  const fTrain = train400.slice(0, 200).map((d) => ({ x: M.convFeatures(cnn, d.x), y: d.y })), fTest = test.map((d) => ({ x: M.convFeatures(cnn, d.x), y: d.y }));
  for (const reduce of ["last", "max"]) for (const pack of [true, false]) {
    const rng2 = makeRng(1600);
    const model = M.buildFeatureLstm(rng2, { pack, reduce });
    const t = timed(() => M.trainNet(rng2, model, fTrain, { epochs: 8, lr: 1e-2 }));
    console.log(`features [250, 8] → BiLSTM H 8, ${reduce.padEnd(4)} pack ${pack ? "on " : "off"}: 200 × 8: ${f(t.ms / 1000, 1)} s, test ${pct(E.accuracy(model, fTest))}`);
  }
  // and the same with the stride-2 convolution's 125 steps
  const rng3 = makeRng(1700);
  const cnn2 = M.buildCnn(rng3, { code: "onehot", stride: 2 });
  M.trainNet(rng3, cnn2, train400, { epochs: 20, lr: 1e-2 });
  const fTrain2 = train400.slice(0, 200).map((d) => ({ x: M.convFeatures(cnn2, d.x), y: d.y })), fTest2 = test.map((d) => ({ x: M.convFeatures(cnn2, d.x), y: d.y }));
  for (const reduce of ["last", "max"]) {
    const rng2 = makeRng(1800);
    const model = M.buildFeatureLstm(rng2, { pack: true, reduce });
    const t = timed(() => M.trainNet(rng2, model, fTrain2, { epochs: 8, lr: 1e-2 }));
    console.log(`stride-2 features [125, 8] (page 1's net at ${pct(E.accuracy(cnn2, test))}) → BiLSTM, ${reduce} packed: ${f(t.ms / 1000, 1)} s, test ${pct(E.accuracy(model, fTest2))}`);
  }
}
head("S9b · CNN + LSTM end to end (cell 67's shape) on composition, packed last");
{
  const rng = makeRng(1900);
  const model = M.buildSeqModel(rng, { code: "onehot", conv: true, pack: true, reduce: "last" });
  const t = timed(() => M.trainNet(rng, model, compTrain.slice(0, 200), { epochs: 10, lr: 1e-2 }));
  console.log(`end to end, one-hot, 200 × 10: ${f(t.ms / 1000, 1)} s, test ${pct(E.accuracy(model, compTest))}`);
}

console.log(`\ntotal ${secs()} s`);
