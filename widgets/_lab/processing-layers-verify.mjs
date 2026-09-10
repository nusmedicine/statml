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

console.log(failed ? `\n${failed} of ${ran} FAILED\n` : `\nall ${ran} checks passed\n`);
process.exit(failed ? 1 : 0);
