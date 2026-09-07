/* Planning measurement for the deep learning arc's `gradients` slot
 * (PHM5005 05-2 cells 73-78). Reproduces the lesson's own example — x =
 * linspace(0, 10, 100), y = 5 + 2x + N(0, 1), MSE, plain gradient descent from
 * (0, 0) — and asks the two questions the widget hangs on:
 *
 *   1. Above which learning rate does the walk diverge?  The surface is a
 *      fixed quadratic, so this is 2 / lambda_max of its Hessian, and it is
 *      measured by running rather than only computed.
 *   2. Why does the lesson need 1000 epochs at lr 0.01?  Because the Hessian's
 *      small eigenvalue is 0.50 against a large one of 68.5 (x is not
 *      centred), so the intercept's direction is 138x flatter than the
 *      slope's.  Standardizing x makes both curvatures 2 and the same walk
 *      lands inside ten epochs at lr 0.5.
 *
 * The lesson draws its noise with an unseeded torch.normal, so no digit of
 * its printed output is reproducible; the numbers here are one seeded draw
 * and the widget will make its own.  Run: node widgets/_lab/dl-gd-measure.mjs
 */

let s = 12345;
const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const gauss = () => {
  const u = rnd() || 1e-12;
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const n = 100;
const x = Array.from({ length: n }, (_, i) => (10 * i) / (n - 1));
const y = x.map((v) => 5 + 2 * v + gauss());

/* MSE over (b0, b1) is quadratic: its Hessian is [[2, 2 mean x], [2 mean x, 2 mean x^2]] */
function hessian(xs) {
  const mx = xs.reduce((a, b) => a + b) / n;
  const mxx = xs.reduce((a, b) => a + b * b, 0) / n;
  const tr = 2 + 2 * mxx;
  const det = 2 * 2 * mxx - (2 * mx) ** 2;
  const d = Math.sqrt(Math.max(0, tr * tr - 4 * det));
  return { lmax: (tr + d) / 2, lmin: (tr - d) / 2 };
}

function descend(xs, lr, epochs) {
  let b0 = 0;
  let b1 = 0;
  const path = [];
  for (let e = 0; e < epochs; e += 1) {
    let g0 = 0;
    let g1 = 0;
    for (let i = 0; i < n; i += 1) {
      const err = b0 + b1 * xs[i] - y[i];
      g0 += (2 * err) / n;
      g1 += (2 * err * xs[i]) / n;
    }
    b0 -= lr * g0;
    b1 -= lr * g1;
    if (!Number.isFinite(b0) || Math.abs(b0) > 1e6) return { diverged: e + 1, path };
    if ([1, 2, 3, 10, 100, 1000].includes(e + 1)) path.push([e + 1, b0, b1]);
  }
  const loss = xs.reduce((a, v, i) => a + (b0 + b1 * v - y[i]) ** 2, 0) / n;
  return { b0, b1, loss, path };
}

const fmt = (v, d = 3) => v.toFixed(d);
const mx = x.reduce((a, b) => a + b) / n;
const my = y.reduce((a, b) => a + b) / n;
const sxx = x.reduce((a, v) => a + (v - mx) ** 2, 0);
const B1 = x.reduce((a, v, i) => a + (v - mx) * (y[i] - my), 0) / sxx;
const B0 = my - B1 * mx;
console.log(`least squares: b0 ${fmt(B0)}  b1 ${fmt(B1)}`);

const raw = hessian(x);
console.log(`\nRAW x     curvatures ${fmt(raw.lmax, 1)} and ${fmt(raw.lmin)}  (condition ${fmt(raw.lmax / raw.lmin, 0)});  stable lr < ${fmt(2 / raw.lmax, 4)}`);
for (const lr of [0.001, 0.01, 0.02, 0.028, 0.03, 0.05]) {
  const r = descend(x, lr, 1000);
  console.log(r.diverged
    ? `  lr ${lr}: DIVERGED at epoch ${r.diverged}`
    : `  lr ${lr}: b0 ${fmt(r.b0)}  b1 ${fmt(r.b1)}  loss ${fmt(r.loss)}`);
}
const walk = descend(x, 0.01, 1000);
console.log(`  lr 0.01 path (epoch: b0, b1): ${walk.path.map(([e, a, b]) => `${e}: ${fmt(a, 2)}, ${fmt(b, 2)}`).join("   ")}`);

const sd = Math.sqrt(sxx / n);
const xz = x.map((v) => (v - mx) / sd);
const z = hessian(xz);
console.log(`\nSTANDARDIZED x  curvatures ${fmt(z.lmax)} and ${fmt(z.lmin)};  stable lr < ${fmt(2 / z.lmax, 2)}`);
for (const lr of [0.01, 0.1, 0.5, 0.9, 1.1]) {
  const r = descend(xz, lr, 1000);
  console.log(r.diverged
    ? `  lr ${lr}: DIVERGED at epoch ${r.diverged}`
    : `  lr ${lr}: b0 ${fmt(r.b0)}  b1 ${fmt(r.b1)}  loss ${fmt(r.loss)}`);
}
for (const lr of [0.1, 0.5]) {
  const r = descend(xz, lr, 10);
  console.log(`  lr ${lr} after 10 epochs: loss ${fmt(r.loss)}`);
}

/* the chain-rule slot's third page: a product of L activation slopes */
console.log("\nSIGMOID chain, slope 0.25 at h = 0, w = 1:");
for (const L of [2, 5, 10, 20]) console.log(`  L = ${L}: ${(0.25 ** L).toExponential(2)}`);
const tslope = 1 - Math.tanh(1) ** 2;
console.log(`tanh chain at |h| = 1 (slope ${fmt(tslope)}): L = 10: ${(tslope ** 10).toExponential(2)}`);
