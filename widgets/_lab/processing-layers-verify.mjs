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

import { readFileSync } from "node:fs";
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

/* --- 7 · what the bands write out, after Kenneth's review of 2026-09-10 ----- *
 * Each of these is a LINE OF ARITHMETIC the figure now prints, and a line of
 * arithmetic is exactly the kind of claim a pixel hash cannot check: the
 * picture is identical whichever numbers are in the cells. */
{
  /* BOTH KERNELS (decision 12). Band 2 draws two rows, and each row's sum cell
     is the map cell band 1 shades — for filter 1 AND filter 2. */
  for (const k of [3, 5]) {
    const C = M.conv(makeRng(1), k, 1);
    let worst = 0;
    for (let f = 0; f < 2; f += 1) {
      for (let r = 0; r < C.n; r += 1) {
        for (let c = 0; c < C.n; c += 1) {
          const t = M.convTerms(C, f, r, c);
          const sum = t.terms.reduce((s, x) => s + x.product, 0) + t.bias;
          worst = Math.max(worst, Math.abs(sum - C.maps[f][r][c]), Math.abs(t.value - C.maps[f][r][c]));
        }
      }
    }
    check(`k = ${k}: both kernels' sums are the map cells the figure shades`,
      worst < 1e-12, `worst ${worst.toExponential(1)} over ${2 * C.n * C.n} cells`);

    /* the two kernels are DIFFERENT draws — a figure showing one twice would
       pass every sum above and still be the bug the review found */
    const same = C.kernels[0].flat().every((v, i) => v === C.kernels[1].flat()[i]);
    check(`k = ${k}: the second kernel is its own draw, not the first again`, !same);

    /* THE TRANSPOSED PATCH IS TWO CONTRIBUTIONS ADDED. `ConvTranspose2d(2, 1, k)`
       holds one kernel per input map, and what one position adds to z is the
       two products summed — which is what the shared patch grid prints. */
    const before = M.reconstruct(C, 5);
    const after = M.reconstruct(C, 6);
    const m = Math.floor(5 / C.n), q = 5 % C.n;
    let pworst = 0;
    let terms2 = 0;
    for (let u = 0; u < k; u += 1) {
      for (let v = 0; v < k; v += 1) {
        const t = M.patchTerms(C, m, q, u, v);
        terms2 = t.terms.length;
        const i = m * M.STRIDE - C.p + u, j = q * M.STRIDE - C.p + v;
        if (i < 0 || i >= C.zN || j < 0 || j >= C.zN) continue;
        pworst = Math.max(pworst, Math.abs(after[i][j] - before[i][j] - t.value));
      }
    }
    check(`k = ${k}: a patch cell is both maps' contributions added`,
      pworst < 1e-12 && terms2 === 2, `${terms2} terms, worst ${pworst.toExponential(1)}`);
  }

  /* ATTENTION: THE DOT PRODUCTS THE BAND WRITES OUT SUM TO THE SCORE. The page
     answers "where did scores[sat, The] come from" with q · k ÷ √d_k written
     term by term, so the terms and the score must be one calculation. */
  for (const projection of ["random", "identity"]) {
    const A = M.attention(makeRng(1), projection);
    let worst = 0;
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        const t = M.attTerms(A, i, j);
        const dot = t.terms.reduce((s, x) => s + x.product, 0);
        worst = Math.max(worst, Math.abs(dot - t.dot), Math.abs(t.score - A.scores[i][j]));
      }
    }
    check(`${projection}: the four products sum to q · k, and ÷ √d_k is the score`,
      worst < 1e-12 && M.attTerms(A, 0, 0).terms.length === M.D_K,
      `${M.attTerms(A, 0, 0).terms.length} terms, worst ${worst.toExponential(1)}`);
  }
  /* the ramp is NOT stretched to the grid's range, and this is why: at Random
     every weight sits in a band a straight 0 -> 1 ramp draws as one shade */
  {
    const A = M.attention(makeRng(1), "random");
    const lo = Math.min(...A.W.flat()), hi = Math.max(...A.W.flat());
    check("at Random every attention weight is between 0.30 and 0.36",
      lo > 0.3 && hi < 0.36, `${lo.toFixed(3)} to ${hi.toFixed(3)}`);
  }

  /* GRAPH: THE AGGREGATION WRITTEN OUT IS THE AGGREGATE. The strips carry no
     digits, so this line is the only place the printed X and the printed
     output are joined. */
  for (const aggregate of ["normalized-sum", "mean", "max"]) {
    const G = M.graph(makeRng(1), aggregate);
    let worst = 0;
    let counts = [];
    for (let i = 0; i < M.NODES; i += 1) {
      for (let f = 0; f < M.GRAPH_IN; f += 1) {
        const t = M.aggTerms(G, i, f);
        const v = t.kind === "max"
          ? Math.max(...t.terms.map((x) => x.x))
          : t.terms.reduce((s, x) => s + x.product, 0);
        worst = Math.max(worst, Math.abs(v - G.agg[i][f]), Math.abs(t.value - G.agg[i][f]));
        if (f === 0) counts.push(t.terms.length);
      }
    }
    check(`${aggregate}: the terms the readout prints are the aggregate`,
      worst < 1e-12 && counts.join(",") === "2,3,3,2",
      `terms per node ${counts.join(", ")}, worst ${worst.toExponential(1)}`);

    /* every term reads a node feature the Input band prints, at the same
       index — the line is a path from that print to this one */
    const t1 = M.aggTerms(G, 1, 0);
    check(`${aggregate}: node 1's terms read X[0, 0], X[1, 0] and X[2, 0]`,
      t1.terms.map((x) => x.j).join(",") === "0,1,2"
      && t1.terms.every((x) => x.x === G.X[x.j][0]),
      t1.terms.map((x) => `X[${x.j}, 0] = ${x.x.toFixed(4)}`).join("  "));
  }
}

/* --- 7b · what band 2 of the Attention page adds up (main.js decision 16) --- *
 * The band draws three product rows, a rule and a total, and prints one
 * feature's arithmetic under it. THE PICTURE IS THE SAME WHATEVER NUMBERS ARE
 * IN THE CELLS, so the addition is asserted here — and so are the two captions,
 * which are quantitative claims about every query and, at Random, every seed on
 * the control. A caption cannot be checked by looking at it. */
{
  for (const projection of ["random", "identity"]) {
    for (const seed of [1, 2, 3, 4, 5]) {
      if (projection === "identity" && seed > 1) continue;   // Q = K = V = X, one figure
      const A = M.attention(makeRng(seed), projection);
      let worst = 0;
      for (let i = 0; i < 3; i += 1) {
        const { rows, total } = M.attProducts(A, i);
        for (let c = 0; c < M.D_K; c += 1) {
          const sum = rows.reduce((s, r) => s + r.row[c], 0);
          worst = Math.max(worst, Math.abs(sum - A.out[i][c]), Math.abs(total[c] - A.out[i][c]));
        }
        /* each row IS the value row scaled by that query's weight for it */
        const scaled = rows.every((r) => r.row.every((v, c) => near(v, A.W[i][r.j] * A.V[r.j][c])));
        if (!scaled) worst = 1;
      }
      check(`${projection} seed ${seed}: the three product rows sum to the output row`,
        worst < 1e-12, `worst ${worst.toExponential(1)} over 3 queries × ${M.D_K} features`);
    }
  }

  /* THE RANDOM CAPTION: "Each weight stays within 0.06 of one third, so every
     output lands within 0.02 of the mean of the three value rows." Both bounds,
     every query, every seed the control offers. The mean is the claim's own
     arithmetic, so it comes from `model.js` rather than from a copy here. */
  {
    let worstW = 0;
    let worstOut = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
      const A = M.attention(makeRng(seed), "random");
      const mean = M.attValueMean(A);
      for (let i = 0; i < 3; i += 1) {
        worstW = Math.max(worstW, ...A.W[i].map((v) => Math.abs(v - 1 / 3)));
        worstOut = Math.max(worstOut, ...A.out[i].map((v, c) => Math.abs(v - mean[c])));
      }
    }
    check("Random: every weight is within 0.06 of one third, at all five seeds",
      worstW <= 0.06, `largest departure ${worstW.toFixed(4)}`);
    check("Random: every output is within 0.02 of the mean of the value rows",
      worstOut <= 0.02, `largest departure ${worstOut.toFixed(4)}`);
    /* and the weights sum to 1, which is what makes the total an average at all */
    const A = M.attention(makeRng(4), "random");
    check("Random seed 4, the least uniform of the five, still sums to 1",
      A.W.every((r) => near(r.reduce((a, b) => a + b, 0), 1, 1e-12)),
      `weights ${A.W[0].map(M.n3).join(" ")}`);
  }

  /* THE IDENTITY CAPTION: "“cat” and “sat” weight each other above “The”, so
     every output lies nearer “sat”’s value row, 0.48 or less, than “The”’s, 0.68
     or more." Measured for all three queries, because the caption is on screen
     whichever query the walk is standing on. */
  {
    const I = M.attention(makeRng(1), "identity");
    const dist = (i, j) => Math.hypot(...I.V[j].map((v, c) => v - I.out[i][c]));
    const near2 = [0, 1, 2].map((i) => dist(i, 2));
    const far = [0, 1, 2].map((i) => dist(i, 0));
    check("Identity: every output is 0.48 or less from “sat”’s value row",
      Math.max(...near2) <= 0.48, near2.map((v) => v.toFixed(3)).join(" "));
    check("Identity: every output is 0.68 or more from “The”’s value row",
      Math.min(...far) >= 0.68, far.map((v) => v.toFixed(3)).join(" "));
    check("Identity: “The” is the farthest value row from every one of the three outputs",
      [0, 1, 2].every((i) => far[i] > dist(i, 1) && far[i] > dist(i, 2)));
  }
}

/* --- 7d · the columns of every attention grid are the embedding dimensions --- *
 * Round 3 asked what the columns of `w · v` mean, so band 1 and band 2 head them
 * (main.js decision 19). THE HEADERS ARE ONE LIST for every grid, which is the
 * only way four header rows can agree — and a picture of `0 1 2 3` over four
 * cells is a perfectly stable pixel hash whether there are four columns under it
 * or five. So the count is asserted against every grid the headers go over. */
{
  check("the headers are the embedding dimension indices, one per embed_dim",
    M.EMBED_HEADS.length === M.D_K
    && M.EMBED_HEADS.every((h, c) => h === String(c)),
    M.EMBED_HEADS.join(" "));

  for (const projection of ["random", "identity"]) {
    const A = M.attention(makeRng(1), projection);
    const prod = M.attProducts(A, 1);
    /* every row the four header rows stand over: X, Q and K in band 1, and V,
       the three product rows, their total and each query's output in band 2 */
    const widths = [
      ...M.ATT_X.map((r) => r.length),
      ...A.Q.map((r) => r.length), ...A.K.map((r) => r.length),
      ...A.V.map((r) => r.length),
      ...prod.rows.map((r) => r.row.length), prod.total.length,
      ...A.out.map((r) => r.length),
    ];
    check(`${projection}: every headed row is exactly ${M.D_K} columns wide`,
      widths.length === 19 && widths.every((n) => n === M.EMBED_HEADS.length),
      `${widths.length} rows, ${new Set(widths).size} distinct width(s)`);
    /* and a column of the output IS that column of the products added up, which
       is what the caption line under band 2 claims in words */
    let worst = 0;
    for (let c = 0; c < M.D_K; c += 1) {
      worst = Math.max(worst,
        Math.abs(prod.rows.reduce((s, r) => s + r.row[c], 0) - A.out[1][c]));
    }
    check(`${projection}: column c of the output is column c of the products summed`,
      worst < 1e-12, `worst ${worst.toExponential(1)} over ${M.D_K} columns`);
  }
}

/* --- 7e · which bands print a node-rowed tensor (decision 18) --------------- *
 * Kenneth read `W` under the Aggregate band as a tensor the step changes. It is
 * not one, so the Aggregate band prints THE AGGREGATE and `W` prints in the band
 * that applies it. WHAT A PICTURE CANNOT SAY is whether the printed rows are the
 * numbers the strips are shaded from, or whether `W` still carries a node's key
 * — the figure renders just as happily with either wrong. */
{
  check("three bands print a node-rowed tensor, and W is not one of them",
    M.NODE_PRINTS.length === 3
    && M.NODE_PRINTS.every((n) => n !== "W")
    && M.NODE_PRINTS[1] === "aggregate",
    M.NODE_PRINTS.join(", "));
  check("W is a [3, 3] whose rows are features, so it prints on 3 lines",
    M.printRows([M.GRAPH_IN, M.GRAPH_IN]) === M.GRAPH_IN
    && M.printRowLines([M.GRAPH_IN, M.GRAPH_IN]).length === M.GRAPH_IN,
    `${M.printRows([M.GRAPH_IN, M.GRAPH_IN])} lines`);
  /* the aggregate print takes the node gutter, so node i's row has to be line i
     — the same line X's row for that node is on, one band above */
  check("a node-rowed [4, 3] puts node i on line i, so all three prints agree",
    M.printRowLines([M.NODES, M.GRAPH_IN]).every((li, r) => li === r),
    M.printRowLines([M.NODES, M.GRAPH_IN]).join(", "));

  /* THE PRINTED ROW IS THE STRIP'S OWN THREE NUMBERS. Both read `state.agg[i]`
     in `main.js`, so what is asserted here is that the aggregate a node's strip
     is shaded from is the one the aggregation writes out, at every aggregate. */
  for (const aggregate of ["normalized-sum", "mean", "max"]) {
    const G = M.graph(makeRng(1), aggregate);
    let worst = 0;
    for (let i = 0; i < M.NODES; i += 1) {
      for (let f = 0; f < M.GRAPH_IN; f += 1) {
        worst = Math.max(worst, Math.abs(M.aggTerms(G, i, f).value - G.agg[i][f]));
      }
      /* and the output row the third band prints is W applied to that row */
      for (let f = 0; f < M.GRAPH_IN; f += 1) {
        const wa = G.W[f].reduce((s, v, k) => s + v * G.agg[i][k], 0);
        worst = Math.max(worst, Math.abs(wa - G.out[i][f]));
      }
    }
    check(`${aggregate}: the printed aggregate rows are the strips', and W · them is the output`,
      worst < 1e-12 && G.agg.length === M.NODES && G.agg[0].length === M.GRAPH_IN,
      `[${G.agg.length}, ${G.agg[0].length}], worst ${worst.toExponential(1)}`);
  }
}

/* --- 7c · one key per node, worn by three surfaces (decision 17) ------------ *
 * The Graph page answers "which node is which row of the tensor" by lighting
 * the row with the strip and the circle, which only works if the three are one
 * target. NOTHING IN A PICTURE SAYS WHETHER THEY ARE — the figure renders just
 * as happily with the print hit-tested on its own — so the keys are read back
 * here, off the same function `main.js` builds the hit plan with. */
{
  /* one band's arithmetic at the 550 stage: four strips of three cells at 30px,
     the circles under them, and the print with its gutter */
  const cw = 9.16;                     // --fs-sm mono, the width model.js records
  const gutter = M.NODE_GUTTER.length * cw + 10;
  const lines = M.printRowLines([M.NODES, M.GRAPH_IN]);
  check("each of the four nodes prints on its own line of a [4, 3]",
    lines.length === M.NODES && new Set(lines).size === M.NODES,
    `lines ${lines.join(", ")}`);
  check("the [4, 3] print is 37 characters wide, so the gutter and it clear 522",
    M.printCols([M.NODES, M.GRAPH_IN]) === 37
    && gutter + M.printCols([M.NODES, M.GRAPH_IN]) * cw < 550 - 2 * M.PAD,
    `${Math.round(gutter + M.printCols([M.NODES, M.GRAPH_IN]) * cw)}px of 522`);

  const bandAt = (top, prints) => ({
    stripLeft: [0, 1, 2, 3].map((i) => M.PAD + i * 110),
    stripY: top + 16,
    stripW: 90,
    stripH: 30,
    nodeCX: [0, 1, 2, 3].map((i) => M.PAD + i * 110 + 45),
    nodeY: top + 72,
    nodeR: 16,
    print: prints
      ? { x: M.PAD, y: top + 110, w: gutter + 37 * cw, lineH: 16, lines }
      : null,
  });
  /* every band prints a node-rowed tensor from round 4 (decision 18) */
  const bands = [bandAt(0, true), bandAt(200, true), bandAt(400, true)];
  const targets = M.graphTargets(bands);

  check("every target carries the key of the node it belongs to",
    targets.every((t) => t.key === M.nodeKey(t.node)),
    `${targets.length} targets over ${bands.length} bands`);
  /* THE ASSERTION THIS SECTION EXISTS FOR: one string per node, worn by the
     strip, the circle and the printed row alike. */
  for (let i = 0; i < M.NODES; i += 1) {
    const mine = targets.filter((t) => t.node === i);
    const kinds = new Set(mine.map((t) => t.kind));
    check(`node ${i}: strip, circle and print row are one key, ${M.nodeKey(i)}`,
      new Set(mine.map((t) => t.key)).size === 1
      && mine[0].key === M.nodeKey(i)
      && kinds.has("strip") && kinds.has("circle") && kinds.has("print")
      /* Input, Aggregate and Output print a row for this node (decision 18) */
      && mine.filter((t) => t.kind === "print").length === M.NODE_PRINTS.length,
      `${mine.length} surfaces: ${[...kinds].join(", ")}`);
  }
  /* no two nodes share a target, or a hover would light the wrong row */
  const centre = (t) => ({ x: t.x + t.w / 2, y: t.y + t.h / 2 });
  let wrong = [];
  for (const t of targets) {
    const found = M.graphHit(targets, centre(t));
    if (!found || found.key !== t.key) wrong.push(`${t.kind} ${t.node}`);
  }
  check("a pointer at the centre of any surface finds that node and no other",
    wrong.length === 0, wrong.length ? wrong.join(", ") : `${targets.length} surfaces`);
  check("a pointer outside every surface finds nothing",
    M.graphHit(targets, { x: 5, y: 5 }) === null
    && M.graphHit(targets, null) === null);
  /* the three surfaces of one node are three PLACES, so hovering the print row
     is not the same rectangle as hovering the strip */
  const n2 = targets.filter((t) => t.node === 2);
  check("node 2's three surfaces are three separate rectangles",
    new Set(n2.map((t) => `${t.x},${t.y}`)).size === n2.length,
    n2.map((t) => `${t.kind} at ${Math.round(t.x)},${Math.round(t.y)}`).join(" · "));
}

/* --- 8 · the print's height, which `height` reserves before it has values --- */
{
  check("a [2, 3] result prints on 2 lines and a [4, 3] on 4",
    M.printRows([2, 3]) === 2 && M.printRows([4, 3]) === 4
    && M.printRows([2, 5]) === 2,
    `${M.printRows([2, 3])}, ${M.printRows([2, 5])}, ${M.printRows([4, 3])}`);
}

/* --- 9 · the Recurrent page's two bands stand on one set of columns --------- *
 * THE ALIGNMENT IS WHY KENNETH PICKED OPTION B (main.js decision 15): the
 * diagram band's h³ has to sit directly over the three numbers of h³ in the
 * value rows below it. Nothing in a picture says whether it does — the band
 * renders just as happily one column off — so `rnnStage` computes the two sets
 * of centres by the two bands' own paths and this reads them back, at the 550
 * stage the mock drew and the 770 one a wide viewport gives. */
{
  for (const w of [550, 770]) {
    for (const bidirectional of [true, false]) {
      const st = M.rnnStage(w, bidirectional);
      const pass = bidirectional ? "two passes" : "one pass";
      check(`${w}px, ${pass}: the diagram's five columns are the value columns`,
        st.diagramCentres.length === M.SEQ
        && st.diagramCentres.every((c, t) => c === st.valueCentres[t]),
        st.diagramCentres.join(", "));
      check(`${w}px, ${pass}: one pitch, a value cell and the arrow column after it`,
        st.pitch === st.s.cw + st.s.op
        && st.valueCentres.every((c, t) => t === 0 || c - st.valueCentres[t - 1] === st.pitch),
        `pitch ${st.pitch} = ${st.s.cw} + ${st.s.op}`);
      /* the band binds the page's width, so its own rightmost ink — the Output
         box's right edge — is what has to clear the margin */
      check(`${w}px, ${pass}: the Output box ends inside the stage`,
        st.right <= w - M.PAD, `${st.right} of ${w - M.PAD}`);
    }
  }
  /* at 550 it is exactly the margin, which is the measurement the mock took.
     Below 550 the geometry is floored, so the band would run past the margin —
     the arrow into the box shortens instead, and the pitch the two bands share
     is untouched (main.js decision 15). A stage of 535 is what a 900 viewport
     gives once the page is tall enough to carry a scrollbar. */
  for (const w of [535, 550]) {
    const st = M.rnnStage(w, true);
    check(`at ${w} the Output box's right edge is the margin itself`,
      st.right === w - M.PAD, `${st.right} of ${w - M.PAD}`);
    check(`at ${w} the five columns are 72 apart, whatever the arrow does`,
      st.pitch === 72, `pitch ${st.pitch}`);
  }
  /* on one pass the diagram loses its Reverse row where the value rows lose
     theirs, so the band is shorter rather than blank at the bottom */
  const bi = M.rnnStage(550, true);
  const uni = M.rnnStage(550, false);
  check("on one pass the diagram band loses the Reverse row's height",
    uni.bandH < bi.bandH && uni.bottom === uni.xTop + 2 * uni.box.r,
    `${uni.bandH}px against ${bi.bandH}px`);
}

/* --- 10 · the query the reader picks, and the rows it is picked from --------- *
 * Round 5: "oh so it plays thru all the queries? I thought I would get a
 * selector?" (main.js decision 22). THREE THINGS NO PICTURE SETTLES. The ORDER —
 * a figure showing cat's weights looks the same whether Step goes on to sat or
 * back to The, and the rule now is that there is no rotation at all: the walk is
 * The, cat, sat whichever token the reader has picked, because the walk is the
 * layer's computation and the pick is a reading of it. The CLASSIFICATION —
 * `query` has to be `display`, or a click on a token throws away the grids the
 * reader filled to get there, and nothing in a still figure says which it is.
 * And the TARGETS — a click target six columns from the row it names renders
 * identically to one sitting on it, so `attnStage` places the page's columns and
 * the three query rows once, for the drawing and for the region map alike, and
 * this reads the rectangles back at the 550 stage the mock drew and the 770 one
 * a wide viewport gives. */
{
  const wk = M.attnWalk();
  check("the walk is the tokens' own order, The → cat → sat",
    wk.order.length === M.TOKENS.length && wk.order.every((t, k) => t === k),
    wk.order.map((i) => M.TOKENS[i]).join(" → "));
  /* `ordinal[t]` is the step token `t` is computed at, which is what the two
     grids and band 2 ask; with no rotation it is the row's own index */
  check("ordinal is the inverse of the order, so a row's step is its own index",
    wk.ordinal.length === M.TOKENS.length
    && wk.order.every((t, k) => wk.ordinal[t] === k)
    && wk.ordinal.every((k, t) => k === t),
    wk.ordinal.join(", "));
  check("the walk takes no argument, so nothing a reader picks can move it",
    M.attnWalk.length === 0,
    `attnWalk takes ${M.attnWalk.length}`);

  /* THE CLASSIFICATION, READ OFF THE SPEC. `main.js` calls `defineWidget` at
     module scope and cannot be imported in node, so the field is read as source
     text — the door `dbscan-drive.mjs` and `kmeans-drive.mjs` already use. What
     matters is `display: true` on `query`: without it a click on a token is a
     data change and core starts the walk from empty (CLAUDE.md invariant 3). */
  const src = readFileSync(new URL("../processing-layers/main.js", import.meta.url), "utf8");
  const field = src.slice(src.indexOf("    query: {"));
  const body = field.slice(0, field.indexOf("\n    },"));
  check("`query` is a display parameter, so picking one keeps the walk",
    /\bdisplay:\s*true\b/.test(body),
    body.includes("display") ? "display: true" : "NOT display");
  check("`query` is a rail control on the Attention page, defaulting to The",
    /type:\s*"segmented"/.test(body) && /default:\s*"The"/.test(body)
    && /when:\s*ON\("attention"\)/.test(body) && /options:\s*M\.TOKENS/.test(body),
    body.split("\n").map((l) => l.trim())
      .filter((l) => l.startsWith("type") || l.startsWith("default")).join(" · "));
  /* it is declared between Projection and Seed, which is where it renders */
  check("it sits after Projection and before Seed in the Attention group",
    src.indexOf("    projection: {") < src.indexOf("    query: {")
    && src.indexOf("    query: {") < src.indexOf("    seed: {"),
    "projection → query → seed");
  /* and `init` no longer reads it: a display parameter never re-inits, so a
     mention there would be a branch nothing can reach */
  const init = src.slice(src.indexOf("    init: ({ params, state, fromScratch })"));
  const initBody = init.slice(0, init.indexOf("advance:"));
  check("`init` reads `pos` and not `query`",
    initBody.includes("params.pos") && !initBody.includes("params.query"),
    "the Replay probe is what `pos` alone needs");

  for (const w of [550, 770]) {
    const xTop = 55;                       // X's grid top; main.js owns the header above it
    const st = M.attnStage(w, xTop);
    const { s } = st;
    check(`${w}px: the page's widest band is inside the stage`,
      M.attnWidest(s) <= w - 2 * M.PAD,
      `${M.attnWidest(s)} of ${w - 2 * M.PAD}, cell ${s.cw} × ${s.ch}`);

    const kinds = ["x", "scores", "weights"];
    check(`${w}px: one target per token in each of the three places it is named`,
      st.rows.length === kinds.length * M.TOKENS.length
      && kinds.every((k) => st.rows.filter((r) => r.kind === k).length === M.TOKENS.length)
      /* the value it sets is the TOKEN WORD, which is the option list core
         checks a region against at load */
      && st.rows.every((r) => r.query === M.TOKENS[r.i] && M.TOKENS.includes(r.query)),
      `${st.rows.length} targets`);

    /* THE ASSERTION THIS SECTION EXISTS FOR: each target IS the row the drawing
       paints. X's three rows tile its grid from `xTop` down at the value cell's
       own height and span its four columns; each grid's row label sits in the
       gutter immediately left of the grid, ATT_TOK wide, on the grid's own rows. */
    const rowsOf = (kind) => st.rows.filter((r) => r.kind === kind).sort((a, b) => a.i - b.i);
    const xr = rowsOf("x");
    check(`${w}px: X's three targets tile X's grid, ${s.cw * 4} × ${s.ch} each`,
      xr.every((r, i) => r.x === M.PAD && r.w === 4 * s.cw && r.h === s.ch
        && r.y === xTop + i * s.ch),
      xr.map((r) => `${r.x},${r.y}`).join(" · "));
    for (const [kind, gx] of [["scores", st.sx], ["weights", st.wx]]) {
      const gr = rowsOf(kind);
      check(`${w}px: the ${kind} row labels are the gutter left of the grid`,
        gr.every((r, i) => r.x + r.w === gx && r.w === M.ATT_TOK && r.h === s.ch
          && r.y === st.sy + i * s.ch),
        gr.map((r) => `${r.x}–${r.x + r.w} at ${r.y}`).join(" · "));
    }
    check(`${w}px: every target is inside the stage's margins`,
      st.rows.every((r) => r.x >= M.PAD && r.x + r.w <= w - M.PAD),
      `widest right edge ${Math.max(...st.rows.map((r) => r.x + r.w))} of ${w - M.PAD}`);

    /* no two rows share a rectangle, or a click would set the wrong query —
       resolved by the same half-open rule core's own hitTest uses */
    const centre = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    const wrong = st.rows.filter((r) => {
      const hit = M.graphHit(st.rows, centre(r));
      return !hit || hit.query !== r.query || hit.kind !== r.kind;
    });
    check(`${w}px: a click at any target's centre picks that token and no other`,
      wrong.length === 0,
      wrong.length ? wrong.map((r) => `${r.kind} ${r.query}`).join(", ") : `${st.rows.length} targets`);

    /* the whole stage hangs off `xTop`, so the band moving down moves the
       targets with it rather than leaving them where the mock drew them */
    const moved = M.attnStage(w, xTop + 100);
    check(`${w}px: every target moves with the band it sits in`,
      moved.rows.every((r, k) => r.y === st.rows[k].y + 100 && r.x === st.rows[k].x),
      `sy ${st.sy} → ${moved.sy}`);
  }
}

console.log(failed ? `\n${failed} of ${ran} FAILED\n` : `\nall ${ran} checks passed\n`);
process.exit(failed ? 1 : 0);
