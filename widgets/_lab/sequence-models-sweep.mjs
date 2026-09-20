/* The budget search behind `sequence-models-measure.mjs`, kept because its
 * first run found NOTHING trained: the lesson's CNN at half width, learned
 * embedding, stride 2, 200 sequences × 20 epochs at Adam 1e-3 sat at chance
 * on the planted 7-mer, and so did the BiLSTM at H = 8 (100 × 8 at 1e-2).
 * The planning script's M4b reached 97.5% with a ONE-layer stride-1 one-hot
 * net, 400 × 20 at 3e-3.  So: which of input code, stride, learning rate,
 * count and depth is the one that matters, at what click budget?
 *
 * Run:  node widgets/_lab/sequence-models-sweep.mjs
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

/* ------------------------------------------------- S0 · the 1.9e-4 check */
head("S0 · the unpacked-last gradient check: is 1.9e-4 a vanishing entry or a bug?");
{
  const rng = makeRng(3);
  const d = M.dataset(rng, 2, 1);
  const net = M.buildSeqModel(rng, { pack: false });
  const x = d[1].x, y = 1;
  const lossFn = (back) => { const out = net.forward(x); const { loss, g } = E.softmaxCE(out, y); if (back) net.backward(g); return loss; };
  for (const eps of [1e-4, 1e-5, 1e-6]) {
    for (const p of net.params) p.g.fill(0);
    lossFn(true);
    let worst = 0, worstAbs = 0, at = "";
    const names = ["emb", "W_f", "U_f", "b_f", "W_b", "U_b", "b_b", "W_head", "b_head"];
    net.params.forEach((p, pi) => {
      const rr = makeRng(9);
      for (let q = 0; q < 8; q++) {
        const i = Math.floor(rr.next() * p.v.length);
        if (p.skip && p.skip(i)) continue;
        const old = p.v[i];
        p.v[i] = old + eps; const lp = lossFn(false);
        p.v[i] = old - eps; const lm = lossFn(false);
        p.v[i] = old;
        const num = (lp - lm) / (2 * eps), an = p.g[i];
        const rel = Math.abs(num - an) / Math.max(1e-8, Math.abs(num) + Math.abs(an));
        if (rel > worst) { worst = rel; worstAbs = Math.abs(num - an); at = `${names[pi] ?? pi}[${i}] num ${num.toExponential(2)} an ${an.toExponential(2)}`; }
      }
    });
    console.log(`eps ${eps}: worst rel ${worst.toExponential(1)}, abs ${worstAbs.toExponential(1)} at ${at}`);
  }
}

/* ------------------------------------------------- S1 · M4b reproduced */
head("S1 · the planning script's M4b net on this stage, through the engine");
const train400 = M.dataset(makeRng(11), 400, 1), test = M.dataset(makeRng(12), 100, 1);
const train200 = train400.slice(0, 200);
{
  const rng = makeRng(101);
  const emb = M.embedding(rng, { code: "onehot" });
  const net = E.Sequential([emb, E.Conv1d(rng, 4, 8, 7, 1, 3, false), E.ReLU(), E.GlobalPool(8, "max"), E.Linear(rng, 8, 2)]);
  const { ms } = timed(() => M.trainNet(rng, net, train400, { epochs: 20, lr: 3e-3 }));
  console.log(`conv(4→8,k7,s1,p3,bias=False) ReLU max linear, one-hot, 400 × 20 at 3e-3: ${f(ms / 1000, 1)} s, test ${pct(E.accuracy(net, test))}`);
}

/* ------------------------------------------------- S2 · the CNN sweep */
head("S2 · the lesson's two-layer CNN at half width: code × stride × lr × N, 20 epochs, one seed");
const rows = [];
for (const code of ["onehot", "learned"]) for (const stride of [1, 2]) for (const lr of [1e-3, 3e-3, 1e-2]) for (const N of [200, 400]) {
  const rng = makeRng(500);
  const net = M.buildCnn(rng, { code, E: 8, stride });
  const data = N === 200 ? train200 : train400;
  const { r: curve, ms } = timed(() => M.trainNet(rng, net, data, { epochs: 20, lr }));
  const acc = E.accuracy(net, test);
  const ks = M.kernelsSpelled(net);
  rows.push({ code, stride, lr, N, acc, ms, spell: `${ks[0].spell} ${ks[0].match}/7` });
  console.log(`${code.padEnd(8)} s${stride} lr ${String(lr).padEnd(6)} N ${N}: ${f(ms / 1000, 1)} s, loss ${f(curve[0])}→${f(curve[curve.length - 1])}, test ${pct(acc)}, best kernel ${ks[0].spell} ${ks[0].match}/7`);
}

/* ------------------------------------------------- S3 · the best, three seeds, and 40 epochs */
head("S3 · the best CNN settings over three seeds");
{
  const best = rows.filter((r) => r.acc >= 0.9).sort((a, b) => a.ms - b.ms).slice(0, 4);
  for (const b of best) {
    const accs = [], spells = [], ms = [];
    for (const seed of [1, 2, 3]) {
      const rng = makeRng(600 + seed);
      const net = M.buildCnn(rng, { code: b.code, E: 8, stride: b.stride });
      const t = timed(() => M.trainNet(rng, net, b.N === 200 ? train200 : train400, { epochs: 20, lr: b.lr }));
      ms.push(t.ms); accs.push(E.accuracy(net, test));
      const ks = M.kernelsSpelled(net); spells.push(`${ks[0].spell}(${ks[0].match}) ${ks[1].spell}(${ks[1].match})`);
    }
    console.log(`${b.code.padEnd(8)} s${b.stride} lr ${String(b.lr).padEnd(6)} N ${b.N}: ${f(ms.reduce((a, c) => a + c, 0) / 3000, 1)} s; test ${accs.map(pct).join(" ")}; kernels ${spells.join(" | ")}`);
  }
  if (best.length === 0) console.log("nothing reached 90%");
}

/* ------------------------------------------------- S4 · the LSTM sweep */
head("S4 · the BiLSTM at H = 8, packed: code × reduce × lr, 200 × 12 epochs");
const seqTest = M.dataset(makeRng(22), 100, 1);
const lrows = [];
for (const code of ["onehot", "learned"]) for (const reduce of ["last", "max"]) for (const lr of [3e-3, 1e-2]) {
  const rng = makeRng(700);
  const model = M.buildSeqModel(rng, { code, E: 8, pack: true, reduce });
  const { r: curve, ms } = timed(() => M.trainNet(rng, model, train200, { epochs: 12, lr }));
  const acc = E.accuracy(model, seqTest);
  lrows.push({ code, reduce, lr, acc, ms });
  console.log(`${code.padEnd(8)} ${reduce.padEnd(5)} lr ${String(lr).padEnd(6)}: ${f(ms / 1000, 1)} s, loss ${f(curve[0])}→${f(curve[curve.length - 1])}, test ${pct(acc)}`);
}
head("S5 · the LSTM scaled: the best code/reduce/lr at N 400 × 20, and H = 16");
{
  const b = lrows.sort((a, c) => c.acc - a.acc)[0];
  for (const [N, epochs, H] of [[400, 20, 8], [200, 12, 16], [400, 20, 16]]) {
    const rng = makeRng(800);
    const model = M.buildSeqModel(rng, { code: b.code, E: 8, H, pack: true, reduce: b.reduce });
    const { r: curve, ms } = timed(() => M.trainNet(rng, model, N === 200 ? train200 : train400, { epochs, lr: b.lr }));
    console.log(`${b.code} ${b.reduce} lr ${b.lr} H ${H} N ${N} × ${epochs}: ${f(ms / 1000, 1)} s, loss ${f(curve[0])}→${f(curve[curve.length - 1])}, test ${pct(E.accuracy(model, seqTest))}`);
  }
}

console.log(`\ntotal ${secs()} s`);

