/* The seventh pass of the budget search behind `sequence-models-measure.mjs`:
 * RESTARTS.  No width, rate, batch or data regime in passes 3–6 made every
 * seed find the motif — the initialisation decides it, and about one seed in
 * four at 16/16 (fixed data) or one in eight (fresh data) never does.  The
 * standard remedy is random restarts: train a few initialisations briefly,
 * keep the one whose loss fell, finish that one.  Does the early loss pick
 * the winner, how many restarts does it take, and what does the click cost?
 *
 * Run:  node widgets/_lab/sequence-models-sweep7.mjs
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
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const summary = (accs, ms) => `min ${pct(Math.min(...accs))} median ${pct([...accs].sort()[Math.floor(accs.length / 2)])} · ${accs.map(pct).join(" ")} · ${f(mean(ms) / 1000, 1)} s`;
const motifTest = M.dataset(makeRng(12), 100, 1);

/** `restarts` initialisations trained `probe` epochs each on fresh data; the
    one with the lowest last-epoch loss continues to `epochs` in all. */
function trainRestarts(rng, build, { restarts, probe, epochs, N, lr = 1e-2 }) {
  const cands = [];
  for (let r = 0; r < restarts; r++) {
    const net = build(rng);
    const curve = [];
    E.train(rng, net, () => M.dataset(rng, N, 1), { epochs: probe, lr, onEpoch: (_, l) => curve.push(l) });
    cands.push({ net, curve });
  }
  cands.sort((a, b) => a.curve[a.curve.length - 1] - b.curve[b.curve.length - 1]);
  const best = cands[0];
  E.train(rng, best.net, () => M.dataset(rng, N, 1), { epochs: epochs - probe, lr, onEpoch: (_, l) => best.curve.push(l) });
  return { net: best.net, curve: best.curve, probes: cands.map((c) => f(c.curve[c.curve.length - 1])) };
}

for (const [channels, restarts, probe] of [[[12, 12], 3, 6], [[12, 12], 3, 4], [[8, 16], 3, 6], [[8, 16], 4, 5], [[16, 16], 2, 6], [[12, 12], 1, 6]]) {
  head(`${channels.join("/")} · ${restarts} restart(s) × ${probe} probe epochs, then to 20, fresh 300 an epoch, ten seeds`);
  const accs = [], ms = [], probes = [];
  for (const seed of SEEDS) {
    const rng = makeRng(7000 + seed);
    const t = timed(() => trainRestarts(rng, (r) => M.buildCnn(r, { code: "onehot", stride: 1, channels }), { restarts, probe, epochs: 20, N: 300 }));
    ms.push(t.ms); accs.push(E.accuracy(t.r.net, motifTest)); probes.push(t.r.probes.join("/"));
  }
  console.log(`${summary(accs, ms)}`);
  console.log(`probe losses by seed: ${probes.join("  ")}`);
}

console.log(`\ntotal ${secs()} s`);
