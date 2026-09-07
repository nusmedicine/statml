/* Planning measurement for the deep learning arc's `training-loop` slot
 * (PHM5005 05-4). Reimplements the lesson's recipe — synthetic.csv (1000 rows,
 * 2 features, 2 balanced classes), stratified 60/20/20 split, MLP 2 -> h -> h
 * -> 2 with ReLU, cross-entropy, Adam lr 1e-3, batches of 16, checkpoint on
 * the best validation loss, early stopping at patience 10 / min_delta 1e-4 —
 * and asks whether the validation loss ever turns up, because an early-
 * stopping widget with no turn-up has nothing to stop.
 *
 * Findings, 2026-09-07 (seed 42, ONE DRAW EACH — two runs of this script
 * with different shuffles moved every epoch number by tens and the rises by
 * a factor of two; the shape held every time):
 *   - the lesson's own recipe (600 training rows, 100 epochs): the validation
 *     loss bottoms in the 30s or 40s, patience 10 fires ten epochs later, and
 *     by epoch 100 it has risen 0.01–0.03 — real, but a hairline on a strip.
 *     Over 300 epochs the rise is 0.09–0.12, and that is visible.
 *   - fewer training rows (200, 120) put the minimum later (60–90) and the
 *     rise by epoch 200 at 0.05–0.09; label noise mostly raises the floor.
 *   - PATIENCE 10 FIRED BEFORE THE TRUE MINIMUM in three of five runs (at 38
 *     against a best of 46; at 20 against 80; at 127 against 187): the
 *     validation curve is noisy at 200 rows, and a short patience stops on the
 *     noise.  That is the stage that loses in both directions — too short
 *     stops early, too long trains into the rise — and it argues for patience
 *     as the widget's dial ahead of training-set size.
 *   - cost: h = 64 on 600 rows for 200 epochs is ~4 s in this naive per-sample
 *     loop; h = 32 (the lesson's own class default) is ~1.1 s and a typed-
 *     array engine would be several times faster.  compute() trains once.
 *
 * The lesson runs in Colab with torch; torch is not installed here, so the
 * widget's engine will have to be pinned the way widget 37 was — dump the
 * data and the initial weights, train from those in torch, compare.
 * Run: node widgets/_lab/dl-loop-measure.mjs
 */

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const rows = fs.readFileSync(join(here, "dl-synthetic.csv"), "utf8")
  .trim().split("\n").slice(1).map((l) => l.split(",").map(Number));

let s = 42;
const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const gauss = () => {
  const u = rnd() || 1e-12;
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/* stratified 60/20/20, as train_test_split(stratify=y) twice */
function split(data) {
  const tr = [];
  const va = [];
  const te = [];
  for (const c of [0, 1]) {
    const g = shuffle(data.filter((r) => r[2] === c));
    const nT = Math.round(g.length * 0.2);
    te.push(...g.slice(0, nT));
    va.push(...g.slice(nT, 2 * nT));
    tr.push(...g.slice(2 * nT));
  }
  return { tr: shuffle(tr), va, te };
}

function mlp(h) {
  const mat = (r, c, sd) => Array.from({ length: r }, () => Array.from({ length: c }, () => gauss() * sd));
  return {
    h,
    W1: mat(h, 2, 1 / Math.sqrt(2)), b1: new Array(h).fill(0),
    W2: mat(h, h, 1 / Math.sqrt(h)), b2: new Array(h).fill(0),
    W3: mat(2, h, 1 / Math.sqrt(h)), b3: [0, 0],
  };
}

function forward(m, x) {
  const a1 = m.W1.map((w, i) => Math.max(0, w[0] * x[0] + w[1] * x[1] + m.b1[i]));
  const a2 = m.W2.map((w, i) => Math.max(0, w.reduce((acc, v, j) => acc + v * a1[j], 0) + m.b2[i]));
  const z = m.W3.map((w, i) => w.reduce((acc, v, j) => acc + v * a2[j], 0) + m.b3[i]);
  const mx = Math.max(z[0], z[1]);
  const e = z.map((v) => Math.exp(v - mx));
  const Z = e[0] + e[1];
  return { a1, a2, p: [e[0] / Z, e[1] / Z] };
}

function lossAcc(m, set) {
  let L = 0;
  let c = 0;
  for (const r of set) {
    const { p } = forward(m, r);
    L -= Math.log(p[r[2]] + 1e-12);
    if ((p[1] > 0.5 ? 1 : 0) === r[2]) c += 1;
  }
  return [L / set.length, c / set.length];
}

/* Adam with torch.optim.Adam defaults: betas (0.9, 0.999), eps 1e-8, bias-corrected */
function train(m, tr, va, { epochs = 100, batch = 16, lr = 1e-3, patience = 10, minDelta = 1e-4 } = {}) {
  const zero = (v) => (Array.isArray(v) ? v.map(zero) : 0);
  const names = ["W1", "b1", "W2", "b2", "W3", "b3"];
  const M = Object.fromEntries(names.map((k) => [k, zero(m[k])]));
  const V = Object.fromEntries(names.map((k) => [k, zero(m[k])]));
  let t = 0;
  const step = (k, i, j, g) => {
    const mm = j === undefined ? M[k] : M[k][i];
    const vv = j === undefined ? V[k] : V[k][i];
    const idx = j === undefined ? i : j;
    mm[idx] = 0.9 * mm[idx] + 0.1 * g;
    vv[idx] = 0.999 * vv[idx] + 0.001 * g * g;
    const mh = mm[idx] / (1 - 0.9 ** t);
    const vh = vv[idx] / (1 - 0.999 ** t);
    const target = j === undefined ? m[k] : m[k][i];
    target[idx] -= (lr * mh) / (Math.sqrt(vh) + 1e-8);
  };
  const hist = [];
  let best = Infinity;
  let bestEp = 0;
  let noImp = 0;
  let stopped = null;
  for (let ep = 0; ep < epochs; ep += 1) {
    const order = shuffle(tr.slice());
    for (let b = 0; b < order.length; b += batch) {
      const xb = order.slice(b, b + batch);
      const nb = xb.length;
      const g = { W1: zero(m.W1), b1: zero(m.b1), W2: zero(m.W2), b2: zero(m.b2), W3: zero(m.W3), b3: zero(m.b3) };
      for (const r of xb) {
        const f = forward(m, r);
        const dz = [f.p[0] - (r[2] === 0 ? 1 : 0), f.p[1] - (r[2] === 1 ? 1 : 0)].map((v) => v / nb);
        const da2 = new Array(m.h).fill(0);
        for (let i = 0; i < 2; i += 1) {
          g.b3[i] += dz[i];
          for (let j = 0; j < m.h; j += 1) { g.W3[i][j] += dz[i] * f.a2[j]; da2[j] += dz[i] * m.W3[i][j]; }
        }
        const dh2 = da2.map((v, j) => (f.a2[j] > 0 ? v : 0));
        const da1 = new Array(m.h).fill(0);
        for (let i = 0; i < m.h; i += 1) {
          g.b2[i] += dh2[i];
          for (let j = 0; j < m.h; j += 1) { g.W2[i][j] += dh2[i] * f.a1[j]; da1[j] += dh2[i] * m.W2[i][j]; }
        }
        const dh1 = da1.map((v, j) => (f.a1[j] > 0 ? v : 0));
        for (let i = 0; i < m.h; i += 1) { g.b1[i] += dh1[i]; g.W1[i][0] += dh1[i] * r[0]; g.W1[i][1] += dh1[i] * r[1]; }
      }
      t += 1;
      for (let i = 0; i < m.h; i += 1) {
        step("W1", i, 0, g.W1[i][0]); step("W1", i, 1, g.W1[i][1]); step("b1", i, undefined, g.b1[i]);
        for (let j = 0; j < m.h; j += 1) step("W2", i, j, g.W2[i][j]);
        step("b2", i, undefined, g.b2[i]);
      }
      for (let i = 0; i < 2; i += 1) {
        for (let j = 0; j < m.h; j += 1) step("W3", i, j, g.W3[i][j]);
        step("b3", i, undefined, g.b3[i]);
      }
    }
    const [tl, ta] = lossAcc(m, tr);
    const [vl, vacc] = lossAcc(m, va);
    hist.push({ ep: ep + 1, tl, ta, vl, vacc });
    if (vl < best - minDelta) { best = vl; bestEp = ep + 1; noImp = 0; } else {
      noImp += 1;
      if (noImp >= patience && stopped === null) stopped = ep + 1;
    }
  }
  return { hist, best, bestEp, stopped };
}

function report(tag, res) {
  const h = res.hist;
  const last = h[h.length - 1];
  console.log(`${tag}\n  best val ${res.best.toFixed(4)} at epoch ${res.bestEp}; patience 10 fires at ${res.stopped ?? "never"}; final val ${last.vl.toFixed(4)} (rise ${(last.vl - res.best).toFixed(4)})`);
  const picks = [1, 10, 20, 40, 60, 100, 150, 200, 300].filter((e) => e <= h.length);
  console.log(`  ${picks.map((e) => { const r = h[e - 1]; return `e${e} ${r.tl.toFixed(3)}/${r.vl.toFixed(3)} ${(100 * r.vacc).toFixed(0)}%`; }).join(" | ")}   (train loss / val loss, val accuracy)`);
}

const { tr, va, te } = split(rows);
console.log(`split ${tr.length} / ${va.length} / ${te.length}`);
report("lesson recipe: 600 rows, h 64, 100 epochs", train(mlp(64), tr, va));
report("lesson recipe, 300 epochs", train(mlp(64), tr, va, { epochs: 300 }));
report("200 training rows, h 64, 200 epochs", train(mlp(64), tr.slice(0, 200), va, { epochs: 200 }));
report("120 training rows, h 64, 200 epochs", train(mlp(64), tr.slice(0, 120), va, { epochs: 200 }));
report("120 training rows, h 32, 200 epochs", train(mlp(32), tr.slice(0, 120), va, { epochs: 200 }));
const t0 = performance.now();
train(mlp(32), tr, va, { epochs: 200 });
console.log(`\ncost: h 32, 600 rows, 200 epochs = ${((performance.now() - t0) / 1000).toFixed(2)} s`);
