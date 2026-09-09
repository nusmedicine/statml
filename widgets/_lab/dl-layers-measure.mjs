/* Planning measurement for the deep learning arc's `blocks` (slot 49/50) and
 * `composition` (slot 51b) slots — PHM5005 05-3.  Each block below checks one
 * NUMERIC CLAIM the two plans make, because several of them are claims about
 * what an UNTRAINED layer prints and those are exactly the ones that cannot be
 * asserted from the shape of the formula.
 *
 *   1. Attention.  plan-blocks 3.4 says nn.MultiheadAttention at PyTorch's
 *      default init gives weights near 0.32 / 0.33 / 0.35 — "nearly uniform".
 *      That is the page's whole reason for offering an Identity projection, so
 *      the spread over seeds decides whether the corrective is needed.
 *   2. Pooling.  plan-blocks 3.7 states the max and average outputs cell by
 *      cell.  It is exact arithmetic, so it is checkable rather than sampled.
 *   3. Convolution.  plan-blocks 3.2 claims the bright square survives an
 *      untrained Conv2d and that ConvTranspose2d "recovers the shape, not the
 *      values".  Both are claims about magnitudes at init.
 *   4. Graph.  plan-blocks 3.5 claims GCNConv's degree-normalised coefficients
 *      differ visibly between the chain's endpoints and its interior.
 *   5. Dropout.  plan-blocks 3.10 claims the input and output sums "over draws
 *      agree" — the 1/(1-p) argument.  How WIDE that agreement is at p = 0.8
 *      decides whether one seed press shows it.
 *   6/7. Composition: shapes, torch's two error strings, the parameter counts
 *      both plans print, and whether the soft router's weights are visibly
 *      different per sample at init (Routing's "four samples route four
 *      different ways").
 *
 * torch is not installed on this machine, so every layer here is the arithmetic
 * written out, with the weights drawn from the same distribution PyTorch's own
 * default initialiser uses (plan-blocks §4's table).  Absolute values therefore
 * match the notebook in DISTRIBUTION, not digit for digit — the notebook draws
 * unseeded.  Run: node widgets/_lab/dl-layers-measure.mjs
 */

import { makeRng } from "../core/rng.js";

const f = (v, d = 3) => (v < 0 ? "" : " ") + v.toFixed(d);
const row = (a) => a.map((v) => f(v)).join(" ");
const rule = (s) => console.log(`\n${"=".repeat(4)} ${s} ${"=".repeat(Math.max(0, 68 - s.length))}`);

/* ---------------------------------------------------------------- helpers */

/** [rows x cols] drawn U(-b, b) — kaiming_uniform_(a=sqrt(5)) reduces to this. */
const uniformMat = (rng, rows, cols, b) =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => rng.uniform(-b, b)));

const normalMat = (rng, rows, cols) =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => rng.normal()));

/** A @ B^T — the shape nn.Linear uses, weight [out, in]. */
const matmulT = (A, W) => A.map((r) => W.map((w) => w.reduce((s, v, i) => s + v * r[i], 0)));

const softmax = (v) => {
  const m = Math.max(...v);
  const e = v.map((x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
};

const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
const sd = (v) => Math.sqrt(v.reduce((a, b) => a + (b - mean(v)) ** 2, 0) / v.length);

/* ================================================================ 1 ATTENTION
 * nn.MultiheadAttention(embed_dim=4, num_heads=1): in_proj_weight [12, 4] is
 * xavier_uniform_ (bound sqrt(6/(12+4))), in_proj_bias 0, out_proj is a
 * Linear(4, 4) with kaiming_uniform_(a=sqrt(5)) -> U(-1/2, 1/2) and _reset_
 * parameters sets its bias to 0.  Cell 22's X exactly.
 */
rule("1 · ATTENTION — nn.MultiheadAttention(4, 1) at default init, cell 22's X");

const X_ATT = [
  [0.9, 0.1, 0.1, 0.1], // "The"
  [0.0, 0.2, 0.9, 0.0], // "cat"
  [0.0, 0.0, 0.8, 0.1], // "sat"
];
const TOK = ["The", "cat", "sat"];
const XAVIER = Math.sqrt(6 / (12 + 4));

function attention(Wq, Wk, Wv) {
  const Q = matmulT(X_ATT, Wq);
  const K = matmulT(X_ATT, Wk);
  const V = matmulT(X_ATT, Wv);
  const dk = Math.sqrt(4);
  const scores = Q.map((q) => K.map((k) => q.reduce((s, v, i) => s + v * k[i], 0) / dk));
  const W = scores.map(softmax);
  const out = W.map((w) => V[0].map((_, c) => w.reduce((s, wi, j) => s + wi * V[j][c], 0)));
  return { scores, W, out };
}

console.log(`xavier bound sqrt(6/16) = ${f(XAVIER, 4)};  out_proj U(-0.5, 0.5), bias 0`);
console.log("\nseed |  min w  |  max w  | mean |w - 1/3| | max-min | the 3 weights of query 'cat'");
const maxima = [];
const mads = [];
const scoreSpreads = [];
for (let seed = 1; seed <= 20; seed += 1) {
  const rng = makeRng(seed);
  const inProj = uniformMat(rng, 12, 4, XAVIER);
  const { W, scores } = attention(inProj.slice(0, 4), inProj.slice(4, 8), inProj.slice(8, 12));
  scoreSpreads.push(...scores.map((r) => Math.max(...r) - Math.min(...r)));
  const flat = W.flat();
  const mn = Math.min(...flat);
  const mx = Math.max(...flat);
  const mad = mean(flat.map((w) => Math.abs(w - 1 / 3)));
  maxima.push(mx);
  mads.push(mad);
  console.log(`  ${String(seed).padStart(2)} | ${f(mn)} | ${f(mx)} |     ${f(mad)}     | ${f(mx - mn)} | ${row(W[1])}`);
}
console.log(`\nover 20 seeds: max weight ranges ${f(Math.min(...maxima))} to ${f(Math.max(...maxima))}, mean ${f(mean(maxima))}`);
console.log(`               mean |w - 1/3| ranges ${f(Math.min(...mads))} to ${f(Math.max(...mads))}, mean ${f(mean(mads))}`);
console.log(`               seeds with a max weight above 0.45: ${maxima.filter((m) => m > 0.45).length} of 20`);
console.log(`               within-row SCORE spread (max - min of a query's three): mean ${f(mean(scoreSpreads))}, max ${f(Math.max(...scoreSpreads))}`);
console.log(`               (the plan predicts a scaled score near 0.09; a spread of that size gives weights near 0.32/0.33/0.35)`);

console.log("\nIDENTITY projection (Q = K = V = X), scores = X X^T / 2:");
const ident = attention(
  [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]],
  [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]],
  [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]],
);
console.log("  scores            weights          (rows are queries)");
for (let i = 0; i < 3; i += 1) {
  console.log(`  ${TOK[i].padEnd(4)} ${row(ident.scores[i])}   ${row(ident.W[i])}`);
}
const identFlat = ident.W.flat();
console.log(`  weights range ${f(Math.min(...identFlat))} to ${f(Math.max(...identFlat))}, mean |w - 1/3| ${f(mean(identFlat.map((w) => Math.abs(w - 1 / 3))))}`);
console.log(`  'cat' self ${f(ident.W[1][1])}, 'cat'->'sat' ${f(ident.W[1][2])}, 'cat'->'The' ${f(ident.W[1][0])}`);
console.log(`  'sat' self ${f(ident.W[2][2])}, 'sat'->'cat' ${f(ident.W[2][1])}, 'sat'->'The' ${f(ident.W[2][0])}`);

/* ================================================================== 2 POOLING
 * Cells 36-37's image, and the plan's cell-by-cell claim.
 */
rule("2 · POOLING — img[5:11, 5:11] = 1 on a 16x16 of zeros");

const IMG = Array.from({ length: 16 }, (_, r) =>
  Array.from({ length: 16 }, (_, c) => (r >= 5 && r < 11 && c >= 5 && c < 11 ? 1 : 0)));

const outSizePool = (n, k, s) => Math.floor((n - k) / s) + 1;

function pool(img, k, s, kind) {
  const n = img.length;
  const o = outSizePool(n, k, s);
  return Array.from({ length: o }, (_, r) =>
    Array.from({ length: o }, (_, c) => {
      const vals = [];
      for (let u = 0; u < k; u += 1) for (let v = 0; v < k; v += 1) vals.push(img[r * s + u][c * s + v]);
      return kind === "max" ? Math.max(...vals) : mean(vals);
    }));
}

const show = (M, d = 2) => M.forEach((r) => console.log("   " + r.map((v) => v.toFixed(d)).join(" ")));

console.log("\nMaxPool2d(2, 2) -> 8 x 8");
show(pool(IMG, 2, 2, "max"));
console.log("\nAvgPool2d(2, 2) -> 8 x 8");
show(pool(IMG, 2, 2, "avg"));

for (const [k, s] of [[4, 4], [2, 4]]) {
  const mp = pool(IMG, k, s, "max");
  const ap = pool(IMG, k, s, "avg");
  console.log(`\nk = ${k}, s = ${s}  ->  ${mp.length} x ${mp.length}   (out = floor((16 - ${k}) / ${s}) + 1 = ${outSizePool(16, k, s)})`);
  console.log("  MaxPool");
  show(mp);
  console.log("  AvgPool");
  show(ap);
}

/* ============================================================== 3 CONVOLUTION
 * Conv2d(1, 2, k=3, s=2, p=1): fan_in = 1*3*3 = 9, so U(-1/3, 1/3) on both
 * weight and bias.  ConvTranspose2d(2, 1, ...): fan_in = 2*3*3 = 18.
 */
rule("3 · CONVOLUTION — Conv2d(1, 2, 3, s=2, p=1) then ConvTranspose2d(2, 1, ...)");

const outSizeConv = (n, k, s, p) => Math.floor((n + 2 * p - k) / s) + 1;

function conv2d(img, kernels, biases, k, s, p) {
  const n = img.length;
  const o = outSizeConv(n, k, s, p);
  return kernels.map((ker, fi) =>
    Array.from({ length: o }, (_, r) =>
      Array.from({ length: o }, (_, c) => {
        let acc = biases[fi];
        for (let u = 0; u < k; u += 1) {
          for (let v = 0; v < k; v += 1) {
            const ri = r * s + u - p;
            const ci = c * s + v - p;
            if (ri >= 0 && ri < n && ci >= 0 && ci < n) acc += img[ri][ci] * ker[u][v];
          }
        }
        return acc;
      })));
}

/* weight [in_channels, out_channels, k, k]; each input cell SCATTERS into a kxk patch */
function convTranspose2d(maps, weight, bias, k, s, p, outPad) {
  const n = maps[0].length;
  const o = (n - 1) * s - 2 * p + k + outPad;
  const out = Array.from({ length: o }, () => new Array(o).fill(bias));
  for (let ic = 0; ic < maps.length; ic += 1) {
    for (let m = 0; m < n; m += 1) {
      for (let q = 0; q < n; q += 1) {
        const val = maps[ic][m][q];
        for (let u = 0; u < k; u += 1) {
          for (let v = 0; v < k; v += 1) {
            const i = m * s - p + u;
            const j = q * s - p + v;
            if (i >= 0 && i < o && j >= 0 && j < o) out[i][j] += val * weight[ic][0][u][v];
          }
        }
      }
    }
  }
  return out;
}

const CB = 1 / 3;
const TB = 1 / Math.sqrt(18);
console.log(`Conv2d weights U(-${f(CB, 4)}, ${f(CB, 4)});  ConvTranspose2d U(-${f(TB, 4)}, ${f(TB, 4)})`);
/* the 6x6 square at rows/cols 5-10 lands, under k=3 s=2 p=1, on output cells
 * 2-5 in both axes — the footprint the "is the square visible" count is about */
const inFoot = (r, c) => r >= 2 && r <= 5 && c >= 2 && c <= 5;

console.log("\nseed | filter | out range          | bias   | cells with |y| > |b| + 0.1 (of 64) | mean |y - b| in / out of the 4x4 footprint");
for (let seed = 1; seed <= 3; seed += 1) {
  const rng = makeRng(seed);
  const kernels = [uniformMat(rng, 3, 3, CB), uniformMat(rng, 3, 3, CB)];
  const biases = [rng.uniform(-CB, CB), rng.uniform(-CB, CB)];
  const y = conv2d(IMG, kernels, biases, 3, 2, 1);
  y.forEach((mapp, fi) => {
    const flat = mapp.flat();
    const lit = flat.filter((v) => Math.abs(v) > Math.abs(biases[fi]) + 0.1).length;
    const inF = mapp.flatMap((r, i) => r.filter((_, j) => inFoot(i, j))).map((v) => Math.abs(v - biases[fi]));
    const outF = mapp.flatMap((r, i) => r.filter((_, j) => !inFoot(i, j))).map((v) => Math.abs(v - biases[fi]));
    console.log(`  ${seed}  |   ${fi + 1}    | ${f(Math.min(...flat))} to ${f(Math.max(...flat))} | ${f(biases[fi])} |  ${String(lit).padStart(2)}${" ".repeat(31)}| ${f(mean(inF))} / ${f(mean(outF))}`);
  });
  /* the transposed pass, on this seed's own feature maps */
  const tw = [
    [uniformMat(rng, 3, 3, TB)],
    [uniformMat(rng, 3, 3, TB)],
  ];
  const tb = rng.uniform(-TB, TB);
  const z = convTranspose2d(y, tw, tb, 3, 2, 1, 1);
  const diffs = z.flatMap((r, i) => r.map((v, j) => Math.abs(v - IMG[i][j])));
  const zf = z.flat();
  const inSq = z.flatMap((r, i) => r.filter((_, j) => i >= 5 && i < 11 && j >= 5 && j < 11));
  const outSq = z.flatMap((r, i) => r.filter((_, j) => !(i >= 5 && i < 11 && j >= 5 && j < 11)));
  console.log(`     | deconv | z is ${z.length} x ${z[0].length}, range ${f(Math.min(...zf))} to ${f(Math.max(...zf))}, sd ${f(sd(zf))}`);
  console.log(`     |        | max |z - img| = ${f(Math.max(...diffs))};  mean z inside the square ${f(mean(inSq))} vs outside ${f(mean(outSq))}`);
  console.log(`     |        | that contrast in units of z's own sd: ${f((mean(inSq) - mean(outSq)) / sd(zf), 2)}`);
}

/* Is the square visible in the reconstruction AT ALL?  Twenty seeds of the
 * standardized inside-minus-outside contrast, since three seeds cannot say. */
const contrasts = [];
for (let seed = 1; seed <= 20; seed += 1) {
  const rng = makeRng(seed);
  const kernels = [uniformMat(rng, 3, 3, CB), uniformMat(rng, 3, 3, CB)];
  const biases = [rng.uniform(-CB, CB), rng.uniform(-CB, CB)];
  const y = conv2d(IMG, kernels, biases, 3, 2, 1);
  const tw = [[uniformMat(rng, 3, 3, TB)], [uniformMat(rng, 3, 3, TB)]];
  const z = convTranspose2d(y, tw, rng.uniform(-TB, TB), 3, 2, 1, 1);
  const inSq = z.flatMap((r, i) => r.filter((_, j) => i >= 5 && i < 11 && j >= 5 && j < 11));
  const outSq = z.flatMap((r, i) => r.filter((_, j) => !(i >= 5 && i < 11 && j >= 5 && j < 11)));
  contrasts.push((mean(inSq) - mean(outSq)) / sd(z.flat()));
}
console.log(`\nstandardized square contrast in z over 20 seeds: ${f(Math.min(...contrasts), 2)} to ${f(Math.max(...contrasts), 2)}, mean ${f(mean(contrasts), 2)}`);
console.log(`  seeds where the square reads brighter than its surround at all (contrast > 0): ${contrasts.filter((c) => c > 0).length} of 20`);
console.log(`  seeds where |contrast| > 0.5 sd (a difference the eye would find): ${contrasts.filter((c) => Math.abs(c) > 0.5).length} of 20`);

console.log("\nOutput sizes on 16 — floor((16 + 2p - k) / s) + 1:");
console.log("  k | s | p | out | fits an 8x8-sized panel?");
for (const k of [3, 5]) {
  for (const s of [1, 2]) {
    for (const p of [0, 1]) {
      const o = outSizeConv(16, k, s, p);
      console.log(`  ${k} | ${s} | ${p} |  ${String(o).padStart(2)} | ${o > 8 ? "NO — over 8" : "yes"}`);
    }
  }
}

/* ==================================================================== 4 GRAPH
 * GCNConv on the chain 0-1-2-3, with self-loops: 1/sqrt(dhat_i dhat_j).
 */
rule("4 · GRAPH — GCNConv coefficients on the chain 0–1–2–3 (cell 27)");

const ADJ = [[1, 1, 0, 0], [1, 1, 1, 0], [0, 1, 1, 1], [0, 0, 1, 1]]; // with self-loops
const DHAT = ADJ.map((r) => r.reduce((a, b) => a + b, 0));
console.log(`degrees with the self-loop: ${DHAT.join(", ")}  (endpoints 2, interior 3)`);
const COEF = ADJ.map((r, i) => r.map((a, j) => (a ? 1 / Math.sqrt(DHAT[i] * DHAT[j]) : 0)));
console.log("\ncoefficient matrix (row i = node i's update):");
console.log("        j=0     j=1     j=2     j=3   |  row sum");
COEF.forEach((r, i) => console.log(`  i=${i} ${row(r)}   |  ${f(r.reduce((a, b) => a + b, 0))}`));
console.log(`\n  endpoint self 1/sqrt(2*2) = ${f(COEF[0][0])};  endpoint->interior 1/sqrt(2*3) = ${f(COEF[0][1])}`);
console.log(`  interior self 1/sqrt(3*3) = ${f(COEF[1][1])};  interior->interior      = ${f(COEF[1][2])}`);
console.log(`  largest coefficient ${f(Math.max(...COEF.flat()))} vs smallest non-zero ${f(Math.min(...COEF.flat().filter((v) => v > 0)))} — a factor of ${f(Math.max(...COEF.flat()) / Math.min(...COEF.flat().filter((v) => v > 0)), 2)}`);

const rngG = makeRng(1);
const XG = normalMat(rngG, 4, 3);
const WG = uniformMat(rngG, 3, 3, 1); // glorot on [3, 3] is U(-1, 1) per plan §4
const HG = matmulT(XG, WG); // W h_j for every node
console.log("\ncell 27's X (randn(4, 3), seed 1):");
XG.forEach((r, i) => console.log(`  node ${i}  ${row(r)}`));
const aggregate = (kind) => HG.map((_, i) => {
  const nb = ADJ[i].map((a, j) => (a ? j : -1)).filter((j) => j >= 0);
  return HG[0].map((_, c) => {
    if (kind === "gcn") return nb.reduce((s, j) => s + COEF[i][j] * HG[j][c], 0);
    if (kind === "mean") return mean(nb.map((j) => HG[j][c]));
    return Math.max(...nb.map((j) => HG[j][c]));
  });
});
console.log("\nfirst row (node 0's output, before sigma) under each aggregate:");
console.log(`  normalized sum  ${row(aggregate("gcn")[0])}`);
console.log(`  mean            ${row(aggregate("mean")[0])}`);
console.log(`  max             ${row(aggregate("max")[0])}`);
console.log("\nall four nodes, normalized sum:");
aggregate("gcn").forEach((r, i) => console.log(`  node ${i}  ${row(r)}`));

/* ================================================================== 5 DROPOUT
 * Cell 59-60: randn(2, 5), p in {0.2, 0.5, 0.8}, survivors scaled by 1/(1-p).
 */
rule("5 · DROPOUT — randn(2, 5) seed 1, 200 masks per p");

const XD = normalMat(makeRng(1), 2, 5);
const inSum = XD.flat().reduce((a, b) => a + b, 0);
console.log("input:");
XD.forEach((r) => console.log(`  ${row(r)}`));
console.log(`input sum ${f(inSum)}\n`);
console.log("  p   | mean out sum | sd    | mean/input | within 20% of input | all-zero draws");
for (const p of [0.2, 0.5, 0.8]) {
  const rng = makeRng(7);
  const sums = [];
  let allZero = 0;
  for (let t = 0; t < 200; t += 1) {
    let s = 0;
    let kept = 0;
    for (const v of XD.flat()) {
      if (rng.next() >= p) { s += v / (1 - p); kept += 1; }
    }
    if (kept === 0) allZero += 1;
    sums.push(s);
  }
  const within = sums.filter((s) => Math.abs(s - inSum) <= 0.2 * Math.abs(inSum)).length / 200;
  console.log(`  ${p.toFixed(1)} | ${f(mean(sums))}       | ${f(sd(sums))} | ${f(mean(sums) / inSum)}     | ${(100 * within).toFixed(0)}%                 | ${allZero}`);
}

/* 200 draws is what the plan's reader would see in a seed-pressing session; the
 * "over draws they agree" claim is about the LIMIT, so 20000 says where it goes */
console.log("\nthe same at 20000 masks (the limit the 1/(1-p) factor is about):");
for (const p of [0.2, 0.5, 0.8]) {
  const rng = makeRng(7);
  const sums = [];
  for (let t = 0; t < 20000; t += 1) {
    let s = 0;
    for (const v of XD.flat()) if (rng.next() >= p) s += v / (1 - p);
    sums.push(s);
  }
  console.log(`  p ${p.toFixed(1)}: mean ${f(mean(sums))} (input ${f(inSum)}), sd ${f(sd(sums))} = ${f(sd(sums) / Math.abs(inSum), 2)} x the input sum`);
}

/* ============================================================== 6 COMPOSITION
 * Shapes and parameter counts for the five notebook modules on randn(4, 10).
 */
rule("6 · COMPOSITION — shapes and parameter counts on x = randn(4, 10)");

const lin = (i, o) => i * o + o;
const MODELS = [
  ["MLP1 / cell 66 flat  Sequential(10->20, ReLU, 20->2)", [lin(10, 20), lin(20, 2)],
    "[4, 10] -> fc1 [4, 20] -> ReLU [4, 20] -> fc2 [4, 2]"],
  ["cell 68 `blocks`     10->20->20->2", [lin(10, 20), lin(20, 20), lin(20, 2)],
    "[4, 10] -> block_in [4, 20] -> block_hidden [4, 20] -> block_out [4, 2]"],
  ["ResidualMLP  cell 92", [lin(10, 20), lin(20, 10), lin(10, 2)],
    "[4, 10] -> fc1 [4, 20] -> ReLU [4, 20] -> fc2 [4, 10] -> + skip [4, 10] -> fc_out [4, 2]"],
  ["GatedMLP     cell 95", [lin(10, 20), lin(10, 20), lin(20, 2)],
    "[4, 10] -> fc1/gate_fc [4, 20] each -> h * g [4, 20] -> fc2 [4, 2]"],
  ["BranchMerge  cell 98", [lin(10, 8), lin(10, 6), lin(14, 2)],
    "[4, 10] -> fc1 [4, 8] & fc2 [4, 6] -> cat [4, 14] -> fc3 [4, 2]"],
  ["SoftRouting  cell 101", [lin(10, 20), lin(10, 20), lin(10, 20), lin(10, 3), lin(20, 2)],
    "[4, 10] -> 3 branches [4, 20] -> stack [4, 3, 20]; gate [4, 3] -> softmax -> sum [4, 20] -> fc_out [4, 2]"],
];
for (const [name, parts, shapes] of MODELS) {
  console.log(`${name}\n    parameters ${parts.reduce((a, b) => a + b, 0)}  = ${parts.join(" + ")}\n    ${shapes}`);
}
console.log(`\nDimensions page's tile: Conv2d(3, 16, 3) = 3*16*9 + 16 = ${3 * 16 * 9 + 16}`);
console.log("torchsummary's split for MLP1: Linear-1 220, ReLU-2 0, Linear-3 42, total 262");

/* ============================================================ 7 SOFT ROUTING
 * gate = nn.Linear(10, 3) at default init: U(-1/sqrt(10), 1/sqrt(10)) on both.
 * Are the four samples' softmax rows visibly different, or uniform?
 */
rule("7 · SOFT ROUTING — gate weights per sample at default init, 10 seeds");

const GB = 1 / Math.sqrt(10);
console.log(`gate Linear(10, 3): U(-${f(GB, 4)}, ${f(GB, 4)}) on weight and bias\n`);
console.log("seed | largest weight per sample        | max-min across samples | spread within a sample");
const bigs = [];
const acrossSamples = [];
const withinSample = [];
for (let seed = 1; seed <= 10; seed += 1) {
  const rng = makeRng(seed);
  const x = normalMat(rng, 4, 10);
  const W = uniformMat(rng, 3, 10, GB);
  const b = Array.from({ length: 3 }, () => rng.uniform(-GB, GB));
  const logits = matmulT(x, W).map((r) => r.map((v, i) => v + b[i]));
  const w = logits.map(softmax);
  const largest = w.map((r) => Math.max(...r));
  const spreads = w.map((r) => Math.max(...r) - Math.min(...r));
  const argmax = w.map((r) => r.indexOf(Math.max(...r)) + 1);
  bigs.push(...largest);
  acrossSamples.push(Math.max(...largest) - Math.min(...largest));
  withinSample.push(...spreads);
  console.log(`  ${String(seed).padStart(2)} | ${largest.map((v) => f(v)).join(" ")} |        ${f(Math.max(...largest) - Math.min(...largest))}         | ${f(Math.max(...spreads))}   argmax ${argmax.join("")}`);
}
console.log(`\nlargest weight over 40 sample-rows: ${f(Math.min(...bigs))} to ${f(Math.max(...bigs))}, mean ${f(mean(bigs))}  (uniform would be 0.333)`);
console.log(`within-sample spread (max - min of the three): mean ${f(mean(withinSample))}, max ${f(Math.max(...withinSample))}`);
console.log(`across-sample spread of the largest weight:    mean ${f(mean(acrossSamples))}, max ${f(Math.max(...acrossSamples))}`);
const seedsAllSameBranch = [];
for (let seed = 1; seed <= 10; seed += 1) {
  const rng = makeRng(seed);
  const x = normalMat(rng, 4, 10);
  const W = uniformMat(rng, 3, 10, GB);
  const b = Array.from({ length: 3 }, () => rng.uniform(-GB, GB));
  const w = matmulT(x, W).map((r) => softmax(r.map((v, i) => v + b[i])));
  const arg = w.map((r) => r.indexOf(Math.max(...r)));
  seedsAllSameBranch.push(new Set(arg).size);
}
console.log(`distinct argmax branches per seed (4 samples): ${seedsAllSameBranch.join(", ")}`);

/* 8 — mono column width is a browser measurement (canvas measureText), not a
 * Node one, and it is deliberately absent here.  It belongs in the mock. */
rule("8 · MONO COLUMN WIDTH — not measurable in Node; measure it in the mock");
console.log("`monoChar` needs canvas measureText at the shipped --fs-sm / --fs-fig.");
