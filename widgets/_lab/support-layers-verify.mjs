/* ============================================================================
   Assertions on widget 50's engine — the arithmetic no picture can settle.

       node widgets/_lab/support-layers-verify.mjs

   Imports `widgets/support-layers/model.js` and `widgets/core/torch.js`, the
   shipping code and not a copy (5.8). Every number here is either the
   notebook's own (PHM5005 05-3 cells 29-60) or one of the measured facts
   docs/catalogue.md § Slot 50 records, so a failure means the widget is
   drawing something the lesson does not say.

   Five of these need a reader most. THE POOLING GRIDS are shaded and carry no
   digits, so a picture of two grey squares is a perfectly stable pixel hash
   whichever numbers are behind it. THE NORMALIZED GROUPS have to leave with
   mean β and sd γ or the page's whole claim is false, and PyTorch's biased
   variance and its eps are what make the printed values match the lesson.
   THE SOFTMAX ROW OF FIVE ZEROS is the case that fails, and it has to read
   like every other row. THE DROPOUT MEAN has to be a pure function of the
   parameters, or `?seed=10` reproduces a different figure from the one that
   was shared. And THE BAND WIDTHS decide whether a page fits the stage at
   all, which no hash of a fitted figure can see.

   Exits non-zero on failure.
   ========================================================================= */

import { readFileSync } from "node:fs";
import { outSize } from "../core/torch.js";
import * as M from "../support-layers/model.js";

let failed = 0;
let ran = 0;
const pad = (s, n) => String(s).padEnd(n);

function check(name, ok, detail = "") {
  ran += 1;
  if (!ok) failed += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${pad(name, 64)} ${detail}`);
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
const allNear = (a, b, eps = 1e-9) => a.length === b.length && a.every((v, i) => near(v, b[i], eps));

/* --- 1 · Embedding: the lookup is a row copy, and the rank goes up ---------- */
{
  const E = M.embedding(4);
  check("the vocabulary is six residues and X is [2, 3] of integer ids",
    M.VOCAB.length === 6 && M.TOKENS.length === 2 && M.TOKENS[0].length === 3
    && M.TOKENS.flat().every((v) => Number.isInteger(v) && v >= 0 && v < 6),
    M.TOKENS.map((r) => `[${r}]`).join(" "));

  check("the table is [6, 4] and the result is [2, 3, 4]",
    E.table.length === 6 && E.table[0].length === 4
    && E.out.length === 2 && E.out[0].length === 3 && E.out[0][0].length === 4);

  const copies = M.TOKENS.every((row, i) => row.every((id, j) => allNear(E.out[i][j], E.table[id])));
  check("every output vector IS the table row its id names", copies,
    "h[i, j] === table[X[i, j]]");

  /* A DIFFERENT DIMENSION IS A DIFFERENT LAYER, and the table is redrawn: the
     stream fills row by row, so only the first row of the shorter table is a
     prefix of the longer one. Worth stating, because the drawn cells move when
     the control does and that is the honest picture rather than a fault. */
  const two = M.embedding(2);
  const eight = M.embedding(8);
  check("changing the dimension redraws the table, sharing only the first row",
    allNear(two.table[0], eight.table[0].slice(0, 2))
    && !allNear(M.embedding(4).table[5], eight.table[5].slice(0, 4)),
    `row 0 at dim 2 ${two.table[0].map((v) => v.toFixed(3)).join(", ")}`);

  /* the table is N(0, 1), which is what `nn.Embedding` initialises from */
  const flat = eight.table.flat();
  check("the table is drawn from a standard normal",
    Math.abs(M.mean(flat)) < 0.35 && Math.abs(M.sd(flat) - 1) < 0.3,
    `mean ${M.mean(flat).toFixed(3)}, sd ${M.sd(flat).toFixed(3)} over ${flat.length} values`);

  check("the walk has one unit per token at every dimension",
    [2, 4, 8].every((d) => M.embedding(d).units === 6));

  check("the walk's ordinal names the token it draws",
    E.tokenAt(0).i === 0 && E.tokenAt(0).j === 0
    && E.tokenAt(3).i === 1 && E.tokenAt(3).j === 0
    && E.tokenAt(5).i === 1 && E.tokenAt(5).j === 2);

  /* the table is a fixed draw, so the figure does not move with the dropout
     seed (model.js's note on where the randomness comes from) */
  check("the table is the same on every call, at a fixed seed",
    allNear(M.embedding(4).table.flat(), E.table.flat()), `seed ${M.EMB_SEED}`);
}

/* --- 2 · Pooling: the exact grids, and the output-size rule ----------------- */
{
  const P = M.pooling(2);
  check("out = ⌊(16 − k) / s⌋ + 1 with the stride equal to the window",
    P.n === 8 && P.n === outSize(16, 2, 2) && M.pooling(4).n === outSize(16, 4, 4),
    `k = 2 → ${P.n}, k = 4 → ${M.pooling(4).n}`);

  /* the bright square is rows and columns 5 to 10, so max is 1 over an 8 x 8
     block of output rows 2 to 5 and 0 everywhere else */
  const maxOnes = P.max.flat().filter((v) => v === 1).length;
  const maxRight = P.max.every((row, r) => row.every((v, c) =>
    near(v, r >= 2 && r <= 5 && c >= 2 && c <= 5 ? 1 : 0)));
  check("MaxPool2d(2, 2) is 1 on the 4 x 4 block of output rows 2 to 5",
    maxRight && maxOnes === 16, `${maxOnes} cells of value 1`);

  /* AvgPool2d's edge windows straddle the square: a corner window holds one
     bright pixel of four, an edge window two of four */
  check("AvgPool2d(2, 2) gives 0.25 at a corner, 0.50 at an edge and 1.00 inside",
    near(P.avg[2][2], 0.25) && near(P.avg[2][3], 0.5) && near(P.avg[3][3], 1),
    `${P.avg[2][2]} / ${P.avg[2][3]} / ${P.avg[3][3]}`);

  check("the average is the mean of the window it covers",
    P.avg.every((row, r) => row.every((v, c) => near(v, M.mean(P.window(r, c).flat())))));

  check("the maximum is the largest value of the window it covers",
    P.max.every((row, r) => row.every((v, c) => near(v, Math.max(...P.window(r, c).flat())))));

  /* the catalogue's k = 4 measurement: a level difference and no edge gradient */
  const Q = M.pooling(4);
  check("at k = 4 every interior average is 9/16, so the edge gradient is gone",
    near(Q.avg[1][1], 9 / 16) && near(Q.avg[1][2], 9 / 16)
    && near(Q.avg[2][1], 9 / 16) && near(Q.avg[2][2], 9 / 16),
    `${Q.avg[1][1].toFixed(4)} four times`);

  check("the window's count of ones is what decides both summaries",
    P.ones(2, 2) === 1 && P.ones(2, 3) === 2 && P.ones(3, 3) === 4
    && near(P.avg[2][3], P.ones(2, 3) / 4));

  check("the walk has one unit per output cell",
    P.units === 64 && Q.units === 16, `${P.units} at k = 2, ${Q.units} at k = 4`);

  check("pooling carries no learnable values at all",
    Object.keys(P).every((k) => !["weight", "bias", "kernels"].includes(k)));
}

/* --- 3 · Normalization: mean β and sd γ, on PyTorch's biased variance ------- */
{
  const B = M.normalization("batch", 1, 0);
  check("X_batch is [4, 3] and the walk takes one column at a time",
    B.X.length === 4 && B.X[0].length === 3 && B.units === 3);

  const colsOut = [0, 1, 2].map((c) => B.Y.map((r) => r[c]));
  check("with γ = 1 and β = 0 every column leaves with mean 0 and sd 1",
    colsOut.every((col) => near(M.mean(col), 0, 1e-9) && near(M.sd(col), 1, 1e-4)),
    colsOut.map((col) => M.sd(col).toFixed(5)).join(", "));

  /* eps of 1e-5 inside the square root is why the sd is 0.99999 rather than 1;
     without it the printed values differ from torch's in the second decimal on
     a small group */
  check("the sd is short of 1 by exactly the eps PyTorch adds",
    colsOut.every((col) => M.sd(col) < 1) && near(M.sd(colsOut[0]), 1, 1e-4),
    `${M.sd(colsOut[0]).toFixed(7)}, eps ${M.EPS}`);

  const G = M.normalization("batch", 2.5, -1);
  const scaled = [0, 1, 2].map((c) => G.Y.map((r) => r[c]));
  check("γ and β move the group to mean β and sd γ",
    scaled.every((col) => near(M.mean(col), -1, 1e-9) && near(M.sd(col), 2.5, 1e-3)),
    `mean ${M.mean(scaled[0]).toFixed(3)}, sd ${M.sd(scaled[0]).toFixed(3)}`);

  check("γ and β change nothing about the input, only the output",
    allNear(G.X.flat(), B.X.flat()));

  const L = M.normalization("layer", 1, 0);
  check("X_seq is [2, 5, 4] and the walk takes one row of one sample at a time",
    L.X.length === 2 && L.X[0].length === 5 && L.X[0][0].length === 4 && L.units === 10);

  const rows = L.Y.flat();
  check("every row of every sample leaves with mean 0 and sd 1",
    rows.every((r) => near(M.mean(r), 0, 1e-9) && near(M.sd(r), 1, 1e-3)),
    `${rows.length} rows`);

  /* THE CLAIM THE SECOND SAMPLE IS DRAWN FOR: a row's statistics come from its
     own four features, so the sample beside it changes nothing. */
  const rowStats = L.groups[0][0];
  check("a row's μ and σ are its own four features and nothing else",
    near(rowStats.m, M.mean(L.X[0][0]))
    && near(rowStats.s, Math.sqrt(M.mean(L.X[0][0].map((v) => (v - M.mean(L.X[0][0])) ** 2)) + M.EPS)),
    `μ ${rowStats.m.toFixed(3)}, σ ${rowStats.s.toFixed(3)}`);

  check("a batch column's μ and σ are taken across the samples, not along a row",
    near(B.groups[0].m, M.mean(B.X.map((r) => r[0])))
    && !near(B.groups[0].m, M.mean(B.X[0])),
    `column 0 μ ${B.groups[0].m.toFixed(3)} against row 0 μ ${M.mean(B.X[0]).toFixed(3)}`);

  check("the walk's ordinal names the group it standardizes",
    B.groupAt(2).col === 2 && L.groupAt(0).sample === 0 && L.groupAt(0).row === 0
    && L.groupAt(7).sample === 1 && L.groupAt(7).row === 2);
}

/* --- 4 · Activation: three uses, and the case that fails -------------------- */
{
  const H = M.activation("hidden");
  const [relu, gelu, silu, tanh] = H.out;
  check("Hidden draws four functions, tanh the fourth, and tanh(−2) is −0.9640",
    M.ACTS.length === 4 && M.ACTS[3].key === "tanh" && H.out.length === 4
    && near(tanh[0], -0.9640, 5e-4) && near(tanh[2], 0, 1e-12) && near(tanh[4], 0.9640, 5e-4),
    `tanh(−2) ${tanh[0].toFixed(4)}`);
  {
    const z = M.sizesAt(0);
    check("the Sigmoid page reserves the curve panel's width left of its two columns",
      M.bandWidth.sigmoid(z) === M.CURVE.w + M.GAP + 2 * z.cw + z.op + M.SIG_OP_EXTRA,
      `${M.bandWidth.sigmoid(z)}px at 550`);
  }
  check("the hidden input is cell 50's five values and the walk takes one each",
    allNear(M.HIDDEN_IN, [-2, -1, 0, 1, 2]) && H.units === 5);

  check("ReLU is the only one of the three that sets −2 to exactly zero",
    relu[0] === 0 && gelu[0] !== 0 && silu[0] !== 0,
    `ReLU ${relu[0].toFixed(4)}, GELU ${gelu[0].toFixed(4)}, SiLU ${silu[0].toFixed(4)}`);

  check("GELU(−2) is −0.0455 and SiLU(−2) is −0.2384",
    near(gelu[0], -0.0455, 5e-4) && near(silu[0], -0.2384, 5e-4),
    `${gelu[0].toFixed(4)} and ${silu[0].toFixed(4)}`);

  check("all three agree at 0 and rise with x above it",
    relu[2] === 0 && near(gelu[2], 0, 1e-12) && near(silu[2], 0, 1e-12)
    && relu[4] > relu[3] && gelu[4] > gelu[3] && silu[4] > silu[3]);

  check("GELU is x times the standard normal CDF",
    near(gelu[4], 2 * 0.9772, 1e-3) && near(gelu[3], 1 * 0.8413, 1e-3),
    `GELU(2) ${gelu[4].toFixed(4)}, GELU(1) ${gelu[3].toFixed(4)}`);

  check("SiLU is x times the sigmoid of x",
    H.out[2].every((v, i) => near(v, M.HIDDEN_IN[i] * M.sigmoid(M.HIDDEN_IN[i]))));

  const P = M.activation("sigmoid");
  check("a score of 0 is a probability of 0.5, and 2 is 0.881",
    near(P.out[1], 0.5) && near(P.out[3], 0.8808, 5e-4),
    P.out.map((v) => v.toFixed(3)).join(", "));

  check("every probability is between 0 and 1 and rises with the score",
    P.out.every((v) => v > 0 && v < 1) && P.out.every((v, i) => i === 0 || v > P.out[i - 1]));

  const D = M.activation("softmax");
  check("softmax is taken along dim=1, so every row sums to 1",
    D.out.every((_, r) => near(D.rowSum(r), 1, 1e-12)),
    D.out.map((_, r) => D.rowSum(r).toFixed(4)).join(", "));

  /* THE CASE THAT FAILS AND READS LIKE EVERY OTHER ROW (catalogue § slot 50) */
  check("the row of five zeros gives 0.2 five times and still sums to 1.0000",
    D.out[1].every((v) => near(v, 0.2, 1e-12)) && near(D.rowSum(1), 1, 1e-12),
    D.out[1].map((v) => v.toFixed(4)).join(" "));

  check("the largest score of a row takes the largest probability",
    D.out.every((row, r) => {
      const arg = M.DIST_IN[r].indexOf(Math.max(...M.DIST_IN[r]));
      return row[arg] === Math.max(...row);
    }));

  check("the walk takes one input on Hidden and Sigmoid and one row on Softmax",
    H.units === 5 && P.units === 5 && D.units === 3);

  /* THE THREE USES ARE KEYED BY THE NOTEBOOK'S OWN HEADINGS, which is what a
     shared link carries. Core drops a key that is not an option and takes the
     default, so an old `?use=probability` opens on Hidden; the model's own
     fallback is the same page, and this asserts it rather than leaving the
     stale key to reach a branch that no longer exists. */
  check("the three uses are keyed hidden, sigmoid and softmax",
    M.activation("hidden").use === "hidden" && P.use === "sigmoid" && D.use === "softmax"
    && Array.isArray(M.activation("probability").out[0])
    && M.activation("distribution").units === 5,
    "hidden · sigmoid · softmax");
}

/* --- 5 · Dropout: the scaling, the two modes, and the running mean ---------- */
{
  check("x is [2, 5] at a fixed seed, and its sum is 2.281",
    M.XD.length === 2 && M.XD[0].length === 5 && near(M.DROP_IN_SUM, 2.281, 5e-4),
    M.DROP_IN_SUM.toFixed(4));

  const T = M.dropout(1, 0.5, "training");
  check("a surviving value is the input divided by 1 − p, and a dropped one is 0",
    T.y.every((row, r) => row.every((v, c) =>
      near(v, T.mask[r][c] ? M.XD[r][c] / 0.5 : 0))),
    `${T.kept} of 10 survived`);

  check("the mask is 0 or 1 and nothing else",
    T.mask.flat().every((v) => v === 0 || v === 1));

  /* THE TWO ROWS THE FIGURE NOW DRAWS (main.js decision 13): m ⊙ x carries the
     input's own value where a cell survives, and y is that row times the scale.
     Two steps rather than one, which is what Kenneth's figure separates. */
  check("y is the masked row times the scale, value for value",
    T.y.every((row, r) => row.every((v, c) =>
      near(v, (T.mask[r][c] ? M.XD[r][c] : 0) * T.scale))),
    `scale ${T.scale.toFixed(2)}`);

  const E = M.dropout(1, 0.5, "evaluation");
  check("at evaluation the output IS the input, value for value",
    allNear(E.y.flat(), M.XD.flat()) && near(E.outSum, M.DROP_IN_SUM),
    "y = x");

  check("at evaluation nothing is masked and nothing is scaled",
    E.mask.flat().every((v) => v === 1) && E.kept === 10);

  check("the scale is 1 / (1 − p) at each rung of the ladder",
    near(M.dropout(1, 0.2, "training").scale, 1.25)
    && near(M.dropout(1, 0.5, "training").scale, 2)
    && near(M.dropout(1, 0.8, "training").scale, 5));

  /* DECISION 9: the third tile is a pure function of (seed, p), so a shared
     link reproduces the number rather than a count of presses. */
  const manual = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => M.dropDraw(s, 0.8).sum);
  check("the running mean is the mean over draws 1 to seed, and nothing else",
    near(M.dropout(10, 0.8, "training").meanSum, M.mean(manual), 1e-12),
    M.dropout(10, 0.8, "training").meanSum.toFixed(4));

  check("the same seed gives the same draw every time",
    near(M.dropout(7, 0.5, "training").outSum, M.dropout(7, 0.5, "training").outSum)
    && M.dropDraw(7, 0.5).mask.flat().join("") === M.dropDraw(7, 0.5).mask.flat().join(""));

  /* THE MEASURED WEAKNESS THE CAPTION HAS TO CARRY (catalogue § slot 50): the
     expectation is right and one draw is not. */
  const many = Array.from({ length: 400 }, (_, i) => M.dropDraw(i + 1, 0.8).sum);
  const zeros = many.filter((v) => v === 0).length;
  check("at p = 0.8 the mean over many draws lands near the input sum",
    Math.abs(M.mean(many) - M.DROP_IN_SUM) < 0.5,
    `mean ${M.mean(many).toFixed(3)} against ${M.DROP_IN_SUM.toFixed(3)}`);

  check("at p = 0.8 a draw that loses every cell is common enough to meet",
    zeros > 20 && zeros < 200, `${zeros} of 400 draws are all zero`);

  /* THE TWO NUMBERS THE TRAINING CAPTION NOW CARRIES. 0.8¹⁰ = 0.107 is the rate
     an all-zero draw arrives at, and the spread of one draw's sum is about twice
     the input sum — both stated on screen, so both are asserted here rather than
     left as a claim nobody measured. 2000 draws, because 400 puts the ratio at
     1.84 on sampling noise alone. */
  const wide = Array.from({ length: 2000 }, (_, i) => M.dropDraw(i + 1, 0.8).sum);
  const wideMean = M.mean(wide);
  const spread = Math.sqrt(M.mean(wide.map((v) => (v - wideMean) ** 2)));
  check("at p = 0.8 the spread of the output sum is about twice the input sum",
    Math.abs(spread / M.DROP_IN_SUM - 2) < 0.3,
    `sd ${spread.toFixed(3)}, ${(spread / M.DROP_IN_SUM).toFixed(2)} × the input sum`);

  check("at p = 0.8 about one draw in ten loses every cell, as 0.8^10 = 0.107 says",
    Math.abs(wide.filter((v) => v === 0).length / wide.length - 0.8 ** 10) < 0.03,
    `${(wide.filter((v) => v === 0).length / wide.length).toFixed(4)} against 0.107`);

  /* THE READOUT BRANCH A ZERO DRAW NEEDS: "0 of the 10 cells survived this draw,
     and each was scaled by 5.00" names a scaling applied to no value at all, so
     the Output-sum note has a line of its own for this state. `?p=0.8&seed=3` is
     the link that reaches it. */
  const none = M.dropout(3, 0.8, "training");
  check("at p = 0.8 and seed 3 no cell survives, so the output sum is 0",
    none.kept === 0 && none.mask.flat().every((v) => v === 0) && none.outSum === 0,
    `kept ${none.kept}, sum ${none.outSum.toFixed(3)}`);

  check("the walk has one unit per cell", T.units === 10 && E.units === 10);
}

/* --- 6 · the fit: every page inside the stage at 550 and at 770 ------------- */
{
  const pages = (w) => [
    ["Embedding dim 2", (z) => M.bandWidth.embedding(2, z, M.embedStacked(w, 2))],
    ["Embedding dim 4", (z) => M.bandWidth.embedding(4, z, M.embedStacked(w, 4))],
    ["Embedding dim 8", (z) => M.bandWidth.embedding(8, z, M.embedStacked(w, 8))],
    ["Pooling k 2", (z) => M.bandWidth.pooling(2, z)],
    ["Pooling k 4", (z) => M.bandWidth.pooling(4, z)],
    ["Batch normalization", (z) => M.bandWidth.batchNorm(z)],
    ["Layer normalization", (z) => M.bandWidth.layerNorm(z)],
    ["Activation Hidden", (z) => M.bandWidth.hidden(z)],
    ["Activation Sigmoid", (z) => M.bandWidth.sigmoid(z)],
    ["Activation Softmax", (z) => M.bandWidth.softmax(z)],
    /* The annotation column `main.js` measures at --fs-xs came to 130px in the
       browser ("kept with probability 0.5" is the widest of the four); the
       measurement needs a canvas, so 140 stands here as a ceiling on it */
    ["Dropout", (z) => M.bandWidth.dropout(z, 140)],
  ];
  for (const w of [550, 770]) {
    const avail = w - 2 * M.PAD;
    const over = pages(w)
      .map(([name, widest]) => [name, widest(M.fitSizes(w, widest))])
      .filter(([, used]) => used > avail);
    check(`${w}px: every page's widest band is inside ${avail}px`,
      over.length === 0,
      over.length ? over.map(([n, u]) => `${n} ${u}`).join(", ") : `${pages(w).length} pages`);
  }

  check("at the 550 stage the geometry is the one the mock drew",
    M.fitSizes(550, () => 0).t === 0 && M.sizesAt(0).cw === 46 && M.sizesAt(0).ch === 26
    && M.sizesAt(0).pix === 13,
    "cell 46 × 26, pooling pixel 13");

  check("at the 770 stage the pooling pixel is 19, which is the mock's pick",
    M.sizesAt(1).pix === 19 && M.sizesAt(1).cw === 60,
    `${M.bandWidth.pooling(2, M.sizesAt(1))}px of 742`);

  check("the two embedding frames stack only where they cannot sit side by side",
    !M.embedStacked(550, 2) && !M.embedStacked(550, 4) && M.embedStacked(550, 8)
    && M.embedStacked(770, 8),
    "dim 8 stacks at both stages");

  check("a narrower stage falls back to the 550 geometry rather than shrinking further",
    M.fitSizes(420, (z) => 10 * z.cw).t === 0);

  check("a wider stage grows the value cell rather than leaving the band left",
    M.fitSizes(770, (z) => M.bandWidth.sigmoid(z)).cw === 60);

  /* THE DROPOUT ROW GUTTER HOLDS THE WIDEST OF THE THREE ROW NAMES the masked
     row made it (main.js decision 13). `m ⊙ x  [2, 5]` is the widest, and it is
     right-aligned 8px left of the grid, so anything past the gutter runs off the
     stage. Node has no canvas, so the character width is `MONO_SM`, measured in
     the browser at the 550 stage; the assertion is that the name fits the
     gutter the mock drew rather than that the gutter was widened for it. */
  const rowNames = ["x  [2, 5]", "m ⊙ x  [2, 5]", "y  [2, 5]"];
  const widestName = Math.max(...rowNames.map((s) => s.length)) * M.MONO_SM;
  check("the row-name gutter holds `m ⊙ x  [2, 5]` at --fs-sm mono",
    M.DROP_GUT >= 8 + Math.ceil(widestName),
    `${M.DROP_GUT}px against ${8 + Math.ceil(widestName)}px`);
}

/* --- 7 · the register of the strings the reader sees ------------------------ *
 * Two standing rules: NO EM-DASH and NO "never" in anything a reader reads.
 * Neither is visible to a pixel hash and neither is visible to `npm run check`,
 * whose copy scan looks for lesson references in `label`, `detail` and `note`
 * alone — a caption, a band header or a hover line is a string this file can
 * reach and that one cannot.
 *
 * SOURCE COMMENTS ARE EXEMPT AND ARE READ PAST. Both files carry their history
 * in comments full of em-dashes, and that history is the most valuable thing in
 * them (CLAUDE.md § Style), so the scan takes the STRING LITERALS only: a small
 * scanner rather than a regex, because a regex over the file cannot tell a
 * comment's dash from a caption's.
 *
 * THE ONE EM-DASH THAT STAYS is the bare "—" a readout tile shows in place of a
 * value it does not have yet: it is the collection's own glyph for an empty
 * tile and not an aside inside a sentence. */
{
  /** Every string literal in `src`, comments skipped, `${}` expressions walked. */
  const literals = (src) => {
    const out = [];
    const n = src.length;
    let i = 0;
    const quoted = (q, j) => {
      let s = "";
      while (j < n && src[j] !== q) {
        if (src[j] === "\\") { j += 2; continue; }
        s += src[j];
        j += 1;
      }
      return { s, end: j + 1 };
    };
    while (i < n) {
      const c = src[i];
      const d = src[i + 1];
      if (c === "/" && d === "*") { i = src.indexOf("*/", i + 2) + 2; continue; }
      if (c === "/" && d === "/") { const nl = src.indexOf("\n", i); i = nl < 0 ? n : nl; continue; }
      if (c === '"' || c === "'") {
        const { s, end } = quoted(c, i + 1);
        out.push(s);
        i = end;
        continue;
      }
      if (c === "`") {
        let j = i + 1;
        let s = "";
        while (j < n && src[j] !== "`") {
          if (src[j] === "\\") { j += 2; continue; }
          if (src[j] === "$" && src[j + 1] === "{") {
            out.push(s);
            s = "";
            let depth = 1;
            j += 2;
            while (j < n && depth > 0) {
              const e = src[j];
              if (e === "{") depth += 1;
              else if (e === "}") depth -= 1;
              else if (e === '"' || e === "'" || e === "`") {
                const inner = quoted(e, j + 1);
                out.push(inner.s);
                j = inner.end - 1;
              }
              j += 1;
            }
            continue;
          }
          s += src[j];
          j += 1;
        }
        out.push(s);
        i = j + 1;
        continue;
      }
      i += 1;
    }
    return out.filter((s) => s.trim() !== "");
  };

  for (const file of ["main.js", "model.js"]) {
    const text = readFileSync(new URL(`../support-layers/${file}`, import.meta.url), "utf8");
    const strings = literals(text);
    const dashed = strings.filter((s) => s.includes("—") && s.trim() !== "—");
    const never = strings.filter((s) => /\bnever\b/i.test(s));
    check(`${file}: no string a reader sees carries an em-dash`,
      dashed.length === 0,
      dashed.length ? dashed.map((s) => JSON.stringify(s)).join(" · ") : `${strings.length} strings read`);
    check(`${file}: no string a reader sees says "never"`,
      never.length === 0,
      never.length ? never.map((s) => JSON.stringify(s)).join(" · ") : `${strings.length} strings read`);
  }

  /* THE SCANNER ITSELF NEEDS A READER, or a bug in it reads as a clean file. */
  const probe = literals('const a = "x — y"; /* — */ const b = `${"never"} ok`; // never\n');
  check("the scanner sees a template's parts and reads past the comments",
    probe.join("|") === "x — y|never| ok",
    probe.map((s) => JSON.stringify(s)).join(" "));

  /* THE PAGE CONTROLS ARE DECLARED WITH `when`, so a page shows its own and no
     other: `seed` on Dropout alone is what keeps every other page's operands
     fixed, and `fn` on Hidden alone is what keeps it from being a question
     with no answer on screen (main.js decisions 8 and the seed note). */
  const src = readFileSync(new URL("../support-layers/main.js", import.meta.url), "utf8");
  check("`seed` is declared on the Dropout page alone",
    /seed: \{[\s\S]*?when: ON\("dropout"\)/.test(src));
  check("`fn` is a display parameter on the Hidden use alone",
    /fn: \{[\s\S]*?display: true,[\s\S]*?equals: "hidden"/.test(src));
  check("the three rail heads are cell 1's own category names",
    /Representation & Aggregation/.test(src) && /Normalization & Activation/.test(src)
    && /Regularization/.test(src) && /groupHeads: true/.test(src));
}

/* --- 8 · the copy round: the wording the audit settled ---------------------- *
 * Section 7 asserts a PROPERTY of every string (no em-dash, no "never"); this
 * one asserts the specific lines, because a rewrite is exactly the change that
 * looks too small to check and the fingerprint's `tx` hash covers the card, the
 * legend and the readout but reaches no canvas caption and no control label.
 * Each check names the audit row it holds down, so a later rewrite can find
 * what it is arguing with. */
{
  const src = readFileSync(new URL("../support-layers/main.js", import.meta.url), "utf8");
  const stub = readFileSync(new URL("../support-layers/index.html", import.meta.url), "utf8");
  const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  const card = manifest.widgets.find((w) => w.slug === "support-layers");
  const has = (...parts) => parts.every((s) => src.includes(s));

  /* ROW 1: the gallery card and the stub say the same sentence, and it is no
     longer the subtitle's own first sentence read twice. */
  const blurb = "A support layer conditions the values a network passes on rather than "
    + "extracting features from them.";
  check("row 1: the blurb and the meta description are the one new sentence",
    card.blurb === blurb && stub.includes(`content="${blurb}"`)
    && !src.includes(blurb) && card.blurb.length <= 120,
    `${card.blurb.length} characters`);

  check("row 2: the Layer control's detail names the options as layers",
    has("each option is a layer that reshapes or rescales what passes through it"));

  check("rows 3 and 5: the pooling captions are the stride claim and the two statistics",
    has("The stride equals the window, so the windows tile the image and no input value is read twice.")
    && has("Max keeps the window's largest value and average keeps the mean of its ")
    && !src.includes("keeps their mean"));

  /* ROW 5's other half: the output-size arithmetic left the caption and is still
     on the card and its note, which is where a formula belongs. */
  check("row 5: the output-size arithmetic is on the card alone, not in a caption",
    (src.match(/⌊\(\$\{M\.IMG_N\} − \$\{k\}\) \/ \$\{k\}⌋/g) ?? []).length === 1
    && has("out = ⌊(in − kernel_size) / stride⌋ + 1."));

  check("row 4: the two statistics are max and mean, and the torch names stay on the band",
    has('[[0, "max", "max"], [1, "avg", "mean"]]')
    && has("`MaxPool2d(${k}, ${k})  ·  AvgPool2d(${k}, ${k})`")
    && !src.includes('"Average"'));

  check("row 6: the layer-norm caption names the other sample, which is stacked above",
    has("so the other sample changes nothing.") && !src.includes("the sample beside it"));

  check("row 7: the layer-norm Input note counts positions rather than steps",
    has('"2 samples, 5 positions, 4 features"') && !src.includes("5 steps"));

  check("rows 8 and 9: the activation and dropout titles name what a press does",
    has("Apply the function to the next input and land its output")
    && has("Take the next cell through the layer")
    && has("Take the remaining cells through the layer"));

  /* ROW 10: five pages, five nouns. The shared "The group being computed" was
     true on every page and specific on one. */
  const litLines = [
    "The token being looked up, and the values it reads",
    "The window being summarized, and the values it reads",
    "The group being standardized, and the values it reads",
    "The input being transformed, and the values it reads",
    "The cell being drawn, and the values it reads",
  ];
  check("row 10: the highlight entry names the page's own group, on all five pages",
    has(...litLines) && !src.includes("The group being computed"),
    `${litLines.length} legend lines`);

  check("row 11: the Output-sum note has a branch for a draw that keeps nothing",
    has("no cell survived this draw, so the output sum is 0.000")
    && has("state.kept === 0"));

  check("rows 12 and 13: the training captions carry the scale and the measured spread",
    has("so the output sum matches the input sum on average.")
    && has("One draw can be far from that average: at p = 0.8 the spread of the output sum is about twice the ")
    && has("input sum, and about one draw in ten loses every cell."));

  check("rows 14 and 15: the evaluation captions name the absent mask and what the scaling bought",
    has("At evaluation the layer applies no mask and no scaling, so the output carries the input's own numbers.")
    && has("The scaling during training is what lets the values pass through unchanged here and still have the ")
    && !src.includes("PyTorch does nothing at all"));

  check("row 16: the Use control's detail names the three jobs",
    has("the same function is used for a hidden value, a probability, or a distribution"));

  /* ROW 17 (Kenneth's pick): the page's Batch · Layer control is the GROUP the
     statistics are taken over, and the rail's own "Layer" control is the one
     that picks the page. Two controls called Layer on one screen was the find. */
  check("row 17: the normalization control is labelled Group and the rail keeps Layer",
    /norm: \{[\s\S]*?label: "Group",/.test(src) && /block: \{[\s\S]*?label: "Layer",/.test(src)
    && !/norm: \{[\s\S]*?label: "Normalization",/.test(src)
    /* the rail's page name is untouched: the option still reads Normalization */
    && src.includes('{ value: "normalization", label: "Normalization"'));

  /* ROW 18 (Kenneth's pick): the Activation step label follows `use` through
     core's nested label form, added for it on 2026-09-10 after he chose the
     core change over a single "Next input"; the four other pages keep their
     own nouns because the outer map is still keyed on `block`. */
  check("row 18: the step label is keyed on block, and Activation's on use",
    /stepLabel: { param: "block", labels: STEP_LABELS/.test(src)
    && /activation: { param: "use", labels: { hidden: "Next value", sigmoid: "Next score", softmax: "Next row" }, default: "Next value" }/.test(src)
    && /embedding: "Next token"/.test(src) && /dropout: "Next cell"/.test(src),
    "Next value / Next score / Next row on Activation, the other pages unchanged");

  /* THE CONSISTENCY FIXES THE AUDIT SAW ON SCREEN. A tile missing from two pages
     of five reads as a fact that stopped being true there. */
  check("every page that has nothing to learn carries the Parameters 0 tile",
    (src.match(/label: "Parameters"/g) ?? []).length === 5,
    "embedding, pooling, Hidden, Sigmoid, Softmax");

  check("the dropout page carries an Input shape tile, as every other page does",
    /label: "Input",\s*\n\s*value: sizeText\(\[M\.DROP_ROWS, M\.DROP_COLS\]\),\s*\n\s*note: "2 samples, 5 features",/
      .test(src));

  check("the This window tile prints both statistics at torch's four decimals",
    /state\.max\[at\.r\]\[at\.c\]\.toFixed\(4\)\}, \$\{state\.avg\[at\.r\]\[at\.c\]\.toFixed\(4\)/.test(src));

  /* THE HEADER'S OWN ARITHMETIC. Comments are exempt from the register and not
     from being true: decision 9 said one draw in six for an event the section
     above measures at 0.107. */
  check("decision 9 states the all-zero rate the measurement gives",
    src.includes("one draw in ten drops every cell (0.8^10 = 0.107)")
    && !src.includes("one draw in six"));
}

console.log(failed ? `\n${failed} of ${ran} FAILED\n` : `\nall ${ran} checks passed\n`);
process.exit(failed ? 1 : 0);
