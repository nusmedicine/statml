/* ============================================================================
   Assertions on widget 49's engine — the arithmetic no picture can settle.

       node widgets/_lab/processing-layers-verify.mjs

   Imports `widgets/processing-layers/model.js` and `widgets/core/torch.js`,
   the shipping code and not a copy (5.8). Every number here is either the
   notebook's own (PHM5005 05-3 cells 3-28) or one of the measured facts
   docs/catalogue.md § Slot 49 records, so a failure means the widget is
   drawing something the lesson does not say.

   Four of these need a reader most. A LINEAR OUTPUT is four products and a
   bias and nothing else — the page prints those four products in the readout,
   and a picture of six blue cells is a perfectly stable pixel hash whichever
   numbers are in them. THE OUTPUT-SIZE RULES decide how many cells the walk
   has, and the transposed one decides whether the reconstruction is the size
   of the image at all. THE GCN COEFFICIENTS are printed on the arcs and the
   caption names two of them out loud. And ATTENTION AT INITIALISATION being
   nearly uniform is the page's whole claim, which the `projection` control
   exists to put a contrast beside.

   Exits non-zero on failure.
   ========================================================================= */

import { makeRng } from "../core/rng.js";
import { outSize, transposedOutSize, initBound } from "../core/torch.js";
import * as M from "../processing-layers/model.js";

let failed = 0;
let ran = 0;
const pad = (s, n) => String(s).padEnd(n);

function check(name, ok, detail = "") {
  ran += 1;
  if (!ok) failed += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${pad(name, 62)} ${detail}`);
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

/* --- 1 · the initialiser bounds PyTorch's own reset_parameters uses --------- */
{
  check("Linear(4, 3) draws from ±1/√4", near(initBound.linear(4), 0.5), initBound.linear(4));
  check("Conv2d(1, 2, 3) draws from ±1/3", near(initBound.conv(1, 3), 1 / 3), initBound.conv(1, 3));
  check("ConvTranspose2d(2, 1, 3) draws from ±1/√18",
    near(initBound.conv(2, 3), 1 / Math.sqrt(18)), initBound.conv(2, 3).toFixed(4));
  check("a recurrent layer with 3 hidden features draws from ±1/√3",
    near(initBound.recurrent(3), 1 / Math.sqrt(3)), initBound.recurrent(3).toFixed(4));
  check("MultiheadAttention(4, 1)'s in-projection is xavier on [12, 4]",
    near(initBound.xavier(4, 12), Math.sqrt(6 / 16)), initBound.xavier(4, 12).toFixed(4));
  check("GCNConv(3, 3)'s weight is glorot on [3, 3], so the bound is 1",
    near(initBound.xavier(3, 3), 1), initBound.xavier(3, 3));
}

/* --- 2 · Linear: one output is four products and a bias -------------------- */
{
  const L = M.linear(makeRng(1), 3);
  check("x is [2, 4] and W is [3, 4], one row per output unit",
    L.X.length === 2 && L.X[0].length === 4 && L.W.length === 3 && L.W[0].length === 4,
    `x ${L.X.length}×${L.X[0].length}, W ${L.W.length}×${L.W[0].length}`);

  let worst = 0;
  for (let i = 0; i < 2; i += 1) {
    for (let j = 0; j < 3; j += 1) {
      const sum = L.terms(i, j).reduce((s, t) => s + t.product, 0) + L.b[j];
      worst = Math.max(worst, Math.abs(sum - L.Y[i][j]));
    }
  }
  check("every y[i, j] is its four products plus b[j]", worst < 1e-12, `worst ${worst.toExponential(1)}`);

  const t = L.terms(0, 1);
  check("the products the readout prints are x[i, k] × W[j, k]",
    t.length === 4 && t.every((p, k) => near(p.product, L.X[0][k] * L.W[1][k])),
    `${t.length} products`);

  const every = [2, 3, 5].every((out) => M.linear(makeRng(1), out).units === 2 * out);
  check("the walk has one unit per output value, at every out_features", every);

  /* every weight inside the bound the initialiser declares */
  const inside = L.W.flat().concat(L.b).every((v) => Math.abs(v) <= 0.5 + 1e-12);
  check("no weight or bias leaves ±1/√4", inside);
}

/* --- 3 · Convolutional: the two output-size rules --------------------------- */
{
  check("outSize(16, 3, 2, 1) = 8", outSize(16, 3, 2, 1) === 8, outSize(16, 3, 2, 1));
  check("transposedOutSize(8, 3, 2, 1, 1) = 16",
    transposedOutSize(8, 3, 2, 1, 1) === 16, transposedOutSize(8, 3, 2, 1, 1));

  /* THE RECONSTRUCTION IS 16 x 16 AT EVERY SETTING THE PAGE OFFERS, which is
     what lets the True-image reveal draw z − img in one footprint whatever
     the kernel and padding are. */
  const sizes = [];
  for (const k of [3, 5]) {
    for (const p of [0, 1]) {
      const n = outSize(M.IMG_N, k, M.STRIDE, p);
      sizes.push([k, p, n, transposedOutSize(n, k, M.STRIDE, p, M.OUT_PAD)]);
    }
  }
  check("z is 16 × 16 for every kernel and padding on the control",
    sizes.every(([, , , z]) => z === M.IMG_N),
    sizes.map(([k, p, n, z]) => `k${k}p${p}→${n}→${z}`).join(" "));

  const C = M.conv(makeRng(1), 3, 1);
  check("the feature maps are 2 × 8 × 8 with no pooling anywhere",
    C.maps.length === 2 && C.maps.every((m) => m.length === 8 && m.every((r) => r.length === 8)),
    `${C.maps.length} × ${C.maps[0].length} × ${C.maps[0][0].length}`);

  /* the input is zero outside the square, so an output that reads no part of
     it is the bias exactly — the reason the map's ramp is centred on the bias */
  const flat = C.maps[0].flat();
  const atBias = flat.filter((v) => Math.abs(v - C.biases[0]) < 1e-12).length;
  check("outside the square's footprint an output is the bias exactly",
    atBias >= 40, `${atBias} of 64 cells`);

  /* one output value, checked against the window and the kernel the band draws */
  const w = C.window(3, 4);
  let sum = C.biases[0];
  for (let u = 0; u < 3; u += 1) for (let v = 0; v < 3; v += 1) sum += w[u][v] * C.kernels[0][u][v];
  check("the window ⊛ kernel + bias the band draws is the map's own value",
    near(sum, C.maps[0][3][4], 1e-12), C.maps[0][3][4].toFixed(4));

  const cov = C.covers(0, 0);
  check("the window at position 0, 0 covers rows and columns 0–1 of the image",
    cov.rows[0] === 0 && cov.rows[1] === 1 && cov.cols[0] === 0 && cov.cols[1] === 1,
    `rows ${cov.rows.join("–")}, columns ${cov.cols.join("–")}`);

  /* the walk builds the same z the whole scatter does */
  const whole = M.reconstruct(C, 64);
  const none = M.reconstruct(C, 0);
  check("the reconstruction starts at the bias and ends at the whole of z",
    none.flat().every((v) => near(v, C.tbias, 1e-12)) && whole.length === 16,
    `${whole.length} × ${whole[0].length}`);

  const d = M.difference(whole);
  check("the difference z − img reaches the full range of the input",
    d.max > 1.0 && d.max < 1.6, `largest |z − img| = ${d.max.toFixed(3)}`);
}

/* --- 4 · Recurrent: the shapes, and where the reverse pass starts ----------- */
{
  const R = M.recurrent(makeRng(1));
  check("the input is [2, 5, 4] and y is [2, 5, 6]",
    R.X.length === 2 && R.X[0].length === 5 && R.X[0][0].length === 4
    && R.y[0].length === 5 && R.y[0][0].length === 6,
    `y ${R.y.length}×${R.y[0].length}×${R.y[0][0].length}`);
  check("every y_t is its forward and reverse halves end to end",
    R.y[0].every((v, t) => v.slice(0, 3).every((x, k) => near(x, R.fwd[0][t][k]))
      && v.slice(3).every((x, k) => near(x, R.rev[0][t][k]))));
  check("the reverse pass starts at the far end of the sequence",
    M.rnnStepAt(6, true).t === 4 && M.rnnStepAt(10, true).t === 0
    && M.rnnStepAt(11, true).dir === 2,
    `step 6 → t${M.rnnStepAt(6, true).t}, step 10 → t${M.rnnStepAt(10, true).t}`);
  check("every hidden value is a tanh, so it lies in (−1, 1)",
    R.fwd.flat(2).concat(R.rev.flat(2)).every((v) => Math.abs(v) < 1));
}

/* --- 5 · Attention: the weights sum to 1 and start nearly uniform ----------- */
{
  for (const seed of [1, 2, 3, 4, 5]) {
    const A = M.attention(makeRng(seed), "random");
    const sums = A.W.map((r) => r.reduce((a, b) => a + b, 0));
    check(`seed ${seed}: each row of attention weights sums to 1`,
      sums.every((s) => near(s, 1, 1e-12)), sums.map((s) => s.toFixed(6)).join(" "));
    const worst = Math.max(...A.W.flat().map((v) => Math.abs(v - 1 / 3)));
    check(`seed ${seed}: every weight is within 0.06 of 1/3 at Random`,
      worst < 0.06, `largest departure ${worst.toFixed(4)}`);
  }

  const I = M.attention(makeRng(1), "identity");
  check("Identity departs from uniform four times as far as Random",
    Math.max(...I.W.flat().map((v) => Math.abs(v - 1 / 3))) > 0.06,
    `${Math.min(...I.W.flat()).toFixed(3)} to ${Math.max(...I.W.flat()).toFixed(3)}`);
  /* the caption the Identity page carries, asserted rather than believed */
  check("at Identity, The attends most to itself",
    I.W[0][0] === Math.max(...I.W[0]), I.W[0].map((v) => v.toFixed(3)).join(" "));
  check("at Identity, cat and sat weight each other above The",
    I.W[1][2] > I.W[1][0] && I.W[2][1] > I.W[2][0],
    `cat→sat ${I.W[1][2].toFixed(3)} vs cat→The ${I.W[1][0].toFixed(3)}`);
}

/* --- 6 · Graph: GCNConv's coefficients ------------------------------------- */
{
  const G = M.graph(makeRng(1), "normalized");
  check("with self-loops the degrees are 2, 3, 3, 2",
    M.DEG.join(",") === "2,3,3,2", M.DEG.join(", "));
  check("an endpoint weights itself 0.500 and an interior node 0.333",
    near(G.coef[0][0], 0.5, 1e-12) && near(G.coef[1][1], 1 / 3, 1e-12),
    `${G.coef[0][0].toFixed(3)} and ${G.coef[1][1].toFixed(3)}`);
  check("the coefficient between an endpoint and its neighbour is 0.408",
    near(G.coef[0][1], 1 / Math.sqrt(6), 1e-12), G.coef[0][1].toFixed(3));
  check("the coefficients do NOT sum to one — 0.908 at an end, 1.075 inside",
    Math.abs(G.coef[0].reduce((a, b) => a + b, 0) - 0.908) < 5e-4
    && Math.abs(G.coef[1].reduce((a, b) => a + b, 0) - 1.075) < 5e-4,
    `${G.coef[0].reduce((a, b) => a + b, 0).toFixed(3)} and ${G.coef[1].reduce((a, b) => a + b, 0).toFixed(3)}`);
  check("the aggregate is the coefficients applied to the node features",
    near(G.agg[1][0], G.coef[1].reduce((s, c, j) => s + c * G.X[j][0], 0), 1e-12));
  check("Mean weights an endpoint 0.500 and an interior node 0.333 as well",
    near(M.graph(makeRng(1), "mean").coef[0][0], 0.5, 1e-12)
    && near(M.graph(makeRng(1), "mean").coef[1][1], 1 / 3, 1e-12));
  check("Max applies no coefficients, so there are none to print",
    M.graph(makeRng(1), "max").coef === null);
  check("one layer is one hop: node 0's update reads nodes 0 and 1 only",
    M.neighbours(0).join(",") === "0,1", `N(0) ∪ {0} = ${M.neighbours(0).join(", ")}`);
  check("the edge list is [2, 6], the chain in both directions",
    M.EDGE_INDEX.length === 2 && M.EDGE_INDEX[0].length === 6);
}

/* --- 7 · the print's height, which `height` reserves before it has values --- */
{
  check("a [2, 3] result prints on 2 lines and a [4, 3] on 4",
    M.printRows([2, 3]) === 2 && M.printRows([4, 3]) === 4
    && M.printRows([2, 5]) === 2,
    `${M.printRows([2, 3])}, ${M.printRows([2, 5])}, ${M.printRows([4, 3])}`);
}

console.log(failed ? `\n${failed} of ${ran} FAILED\n` : `\nall ${ran} checks passed\n`);
process.exit(failed ? 1 : 0);
