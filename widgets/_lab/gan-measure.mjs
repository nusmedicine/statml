/* Slot 108 measurement, on the mock's own engine (gan-engine.js): which
   targets and schedules settle, and which seeds collapse onto one mode.

   node widgets/_lab/gan-measure.mjs            prints the mock's table

   Settled: generated samples within 0.17 of the data (1-D Wasserstein over
   2,000 fixed noise draws), D within 0.06 of ½ at the modes, and for two
   modes half the samples (±0.1) on each side of 0. Collapse: under 10% or
   over 90% on one side. */

import { train, net, sig } from "./gan-engine.js";
import { makeRng } from "../core/rng.js";

function score(run) {
  const s = run.snaps.at(-1), r = makeRng(7);
  const xs = Array.from({ length: 2000 }, () => net(s.G, r.normal())).sort((a, b) => a - b);
  const rq = [...run.real].sort((a, b) => a - b);
  let w1 = 0;
  for (let i = 0; i < xs.length; i++) w1 += Math.abs(xs[i] - rq[Math.floor((i + 0.5) / xs.length * rq.length)]);
  w1 /= xs.length;
  const D = (x) => sig(net(s.D, x));
  if (run.cfg.target === "bi") {
    const left = xs.filter((x) => x < 0).length / xs.length;
    return { w1, left, dMode: Math.max(Math.abs(D(-2) - 0.5), Math.abs(D(2) - 0.5)), dGap: D(0) };
  }
  return { w1, left: 0.5, dMode: Math.max(...[2.4, 3, 3.6].map((x) => Math.abs(D(x) - 0.5))), dGap: NaN };
}

const ROWS = [
  ["uni", "1 and 1, equal rates", { target: "uni" }, 40],
  ["uni", "1 and 1, D 5x faster", { target: "uni", lrD: 0.01 }, 40],
  ["bi", "1 and 1, equal rates", {}, 40],
  ["bi", "1 and 1, D 5x faster", { lrD: 0.01 }, 40],
  ["bi", "20 D then 20 G", { kD: 20, kG: 20, rounds: 150, every: 1 }, 40],
  ["bi", "100 D then 20 G", { kD: 100, kG: 20, rounds: 150, every: 1 }, 20],
];

for (const [t, label, opts, n] of ROWS) {
  let ok = 0, col = 0; const good = [], gaps = [], w1s = [], dms = [];
  const t0 = Date.now();
  for (let seed = 1; seed <= n; seed++) {
    const q = score(train(seed, opts));
    const collapsed = q.left < 0.1 || q.left > 0.9;
    if (collapsed) col++;
    else if (q.w1 < 0.17 && Math.abs(q.left - 0.5) < 0.1 && q.dMode < 0.06) { ok++; good.push(seed); }
    if (isFinite(q.dGap)) gaps.push(q.dGap);
    if (!collapsed) { w1s.push(q.w1); dms.push(q.dMode); }
  }
  const ms = ((Date.now() - t0) / n).toFixed(0);
  const gap = gaps.length ? `  D(0) ${Math.min(...gaps).toFixed(2)}–${Math.max(...gaps).toFixed(2)}` : "";
  const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  console.log(`${t.padEnd(4)}${label.padEnd(24)} settle ${ok}/${n}  collapse ${col}/${n}  W1 median ${med(w1s).toFixed(2)} max ${Math.max(...w1s).toFixed(2)}  |D-½| at modes median ${med(dms).toFixed(2)}${gap}  ${ms} ms  [${good.join(",")}]`);
}
