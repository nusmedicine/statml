/* Planning measurement for slot 54 `loss-functions` — PHM5005 05-4 cells
 * 30–40: MSELoss (cells 31–33), CrossEntropyLoss (34–36) and
 * BCEWithLogitsLoss (37–39), each at the notebook's own example, then under
 * the drag the widget plans to offer.  Every number the catalogue entry
 * carries (0.17, 0.0184, 4.52, 1.053) was the arithmetic written out, not
 * measured; this script is where each becomes a checked claim, and it adds
 * the ones the DRAG needs, which no cell of the notebook prints:
 *
 *   1. MSE.  The three gaps, squared, their mean; the loss as y_pred[0] is
 *      dragged, which is a parabola, and the range a slider needs so the
 *      notebook's 0.17 is readable beside the dragged extremes.
 *   2. CE.  Softmax of cell 36's row, −log p for each choice of label; the
 *      loss as the true class's score is dragged DOWN and a wrong class's
 *      UP; and the −log p curve's range — where to clip it so 4.52 and 4.92
 *      (the label moved to class 1 or 2) still sit on the curve.
 *   3. BCE.  Cell 39's five sigmoids, the five per-class terms, their mean;
 *      torch's stable form (max(z,0) − z·y + log(1 + e^−|z|)) against the
 *      textbook one, so the widget can print either and get the same digits;
 *      each score dragged with its label at 0 and at 1; a label toggled.
 *   4. THE CONFUSION the widget exists for (Kenneth, 2026-09-11: "students
 *      often get confused when to use CrossEntropyLoss and
 *      BCEWithLogitsLoss").  The SAME row of scores read both ways: softmax
 *      over the row against sigmoid per class, the probabilities' sum (1
 *      against not-1), and what each loss does when handed the other's
 *      target — one raises, one silently runs.
 *   5. What float32 does to the printed digits, since `loss.item()` prints
 *      a float32 and the widget computes in float64.
 *
 * torch was not on this machine when this was written, so §4's error strings
 * were quoted from memory — and two of the three were WRONG. torch 2.14 was
 * installed 2026-09-11 on Kenneth's ask; `_lab/dl-loss-torch.py` prints every
 * number and string here for real, and §4 now carries torch's own text.
 * Run: node widgets/_lab/dl-loss-measure.mjs
 */

const f = (v, d = 4) => (v < 0 ? "" : " ") + v.toFixed(d);
const row = (a, d = 4) => a.map((v) => f(v, d)).join(" ");
const rule = (s) => console.log(`\n${"=".repeat(4)} ${s} ${"=".repeat(Math.max(0, 68 - s.length))}`);
const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;

const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const softmax = (v) => {
  const m = Math.max(...v);
  const e = v.map((x) => Math.exp(x - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / s);
};

/* the three losses, batch of one, as the widget's model.js will write them */
const mse = (pred, target) => mean(pred.map((p, i) => (p - target[i]) ** 2));
const ce = (scores, label) => -Math.log(softmax(scores)[label]);
const bceTerms = (scores, y) =>
  scores.map((z, c) => -(y[c] * Math.log(sigmoid(z)) + (1 - y[c]) * Math.log(1 - sigmoid(z))));
/* torch's own form, binary_cross_entropy_with_logits: no log of a sigmoid,
   so no −inf at a large |z| */
const bceStable = (scores, y) =>
  scores.map((z, c) => Math.max(z, 0) - z * y[c] + Math.log(1 + Math.exp(-Math.abs(z))));

/* ==================================================================== 1 MSE */
rule("1 · MSELoss — cell 33: y_pred [2.5, 0.0, 2.1], y_true [3.0, -0.5, 2.0]");

const Y_PRED = [2.5, 0.0, 2.1];
const Y_TRUE = [3.0, -0.5, 2.0];
const gaps = Y_PRED.map((p, i) => p - Y_TRUE[i]);
const sq = gaps.map((g) => g * g);
console.log(`gaps     ${row(gaps, 2)}`);
console.log(`squared  ${row(sq, 4)}`);
console.log(`mean     ${f(mse(Y_PRED, Y_TRUE), 6)}   (the catalogue's 0.17)`);

console.log("\ny_pred[0] dragged, the other two held (a parabola with its floor at y_true[0] = 3.0):");
console.log("  y_pred[0] |  gap  | gap² | loss");
for (const p0 of [-1, 0, 1, 2, 2.5, 3, 3.5, 4, 5, 6]) {
  const l = mse([p0, Y_PRED[1], Y_PRED[2]], Y_TRUE);
  console.log(`  ${f(p0, 1)}     | ${f(p0 - 3, 2)} | ${f((p0 - 3) ** 2, 2)} | ${f(l, 4)}`);
}
console.log("  floor of the parabola: loss = (0.25 + 0.01) / 3 =", f((0.25 + 0.01) / 3, 4), "at y_pred[0] = 3.0");
console.log("  a slider from -1 to 6 spans loss 0.087 .. 5.42; from 0 to 5 spans 0.087 .. 3.09");
console.log("  the other two dragged: floor at -0.5 (loss (0.25+0.01)/3) and at 2.0 (loss (0.25+0.25)/3 =", f(0.5 / 3, 4) + ")");

/* ===================================================================== 2 CE */
rule("2 · CrossEntropyLoss — cell 36: scores [5.0, 0.5, 0.1], label 0");

const Z_CE = [5.0, 0.5, 0.1];
const P_CE = softmax(Z_CE);
console.log(`exp(z)   ${row(Z_CE.map(Math.exp), 4)}   sum ${f(Z_CE.map(Math.exp).reduce((a, b) => a + b), 4)}`);
console.log(`softmax  ${row(P_CE, 4)}   sum ${f(P_CE.reduce((a, b) => a + b), 4)}`);
console.log(`-log p   ${row(P_CE.map((p) => -Math.log(p)), 4)}   <- the loss for label 0, 1, 2`);
console.log(`label 0: ${f(ce(Z_CE, 0), 6)} (the catalogue's 0.0184);  label 1: ${f(ce(Z_CE, 1), 4)} (its 4.52);  label 2: ${f(ce(Z_CE, 2), 4)}`);

console.log("\nscore for class 0 dragged, label 0 (the true class losing confidence):");
console.log("  z0   |  p0    | loss");
for (const z0 of [8, 6, 5, 4, 3, 2, 1, 0.5, 0, -1, -2, -3]) {
  const z = [z0, Z_CE[1], Z_CE[2]];
  console.log(`  ${f(z0, 1)} | ${f(softmax(z)[0], 4)} | ${f(ce(z, 0), 4)}`);
}
console.log("  the loss passes 1 near z0 = 1.0 (p0 = 0.37) and 3 near z0 = -1.6; at z0 = z1 = 0.5 it is",
  f(ce([0.5, 0.5, 0.1], 0), 4), "(p0 = 0.37, three near-equal scores)");

console.log("\nscore for class 1 dragged UP, label 0 (a wrong class gaining confidence):");
console.log("  z1   |  p0    |  p1    | loss");
for (const z1 of [0.5, 2, 4, 5, 6, 8]) {
  const z = [Z_CE[0], z1, Z_CE[2]];
  const p = softmax(z);
  console.log(`  ${f(z1, 1)} | ${f(p[0], 4)} | ${f(p[1], 4)} | ${f(ce(z, 0), 4)}`);
}

console.log("\nthe -log p curve: loss against the probability given to the true class");
console.log("  p     | -log p");
for (const p of [1, 0.9, 0.7, 0.5, 0.3, 0.1, 0.05, 0.02, 0.01, 0.005, 0.001]) {
  console.log(`  ${f(p, 3)} | ${f(-Math.log(p), 3)}`);
}
console.log("  clipping the vertical axis at 5 keeps 4.52 (label 1, p = 0.0109) and 4.92 (label 2, p = 0.0073)");
console.log("  on the curve; at 6 the score-0 drag to z0 = -3 (p = 0.0029, loss 5.85) stays on it too; 0.0184");
console.log("  sits at p = 0.982, 6 px from the right wall of a 300px panel, which is the point of the drag");

/* ==================================================================== 3 BCE */
rule("3 · BCEWithLogitsLoss — cell 39: scores [0.2, -1.0, 0.5, 2.0, -0.3], y [0, 1, 1, 0, 0]");

const Z_BCE = [0.2, -1.0, 0.5, 2.0, -0.3];
const Y_BCE = [0, 1, 1, 0, 0];
const S_BCE = Z_BCE.map(sigmoid);
const T_BCE = bceTerms(Z_BCE, Y_BCE);
const T_STABLE = bceStable(Z_BCE, Y_BCE);
console.log(`sigmoid   ${row(S_BCE, 4)}   sum ${f(S_BCE.reduce((a, b) => a + b), 4)} (not 1: each class on its own)`);
console.log(`y         ${row(Y_BCE, 0)}`);
console.log(`p(true)   ${row(S_BCE.map((s, c) => (Y_BCE[c] ? s : 1 - s)), 4)}   the probability given to each class's TRUE label`);
console.log(`terms     ${row(T_BCE, 4)}   -log of the line above`);
console.log(`stable    ${row(T_STABLE, 4)}   torch's form; max |diff| ${Math.max(...T_BCE.map((t, i) => Math.abs(t - T_STABLE[i]))).toExponential(2)}`);
console.log(`mean      ${f(mean(T_BCE), 6)}   (the catalogue's 1.053)`);
console.log(`sum       ${f(T_BCE.reduce((a, b) => a + b), 4)}   what reduction='sum' would print`);

console.log("\neach score dragged alone, the others held (the term of the dragged class, and the mean):");
console.log("  the term is -log sigmoid(z) at y = 1 and -log(1 - sigmoid(z)) at y = 0 — the same -log p curve,");
console.log("  entered from p = sigmoid(z) or from p = 1 - sigmoid(z)");
console.log("  z    | term at y=1 | term at y=0");
for (const z of [-4, -3, -2, -1, 0, 0.5, 1, 2, 3, 4]) {
  console.log(`  ${f(z, 1)} |   ${f(-Math.log(sigmoid(z)), 4)}    |   ${f(-Math.log(1 - sigmoid(z)), 4)}`);
}
console.log("  a slider from -4 to 4 spans a term of 0.018 .. 4.02; the notebook's five scores lie in -1 .. 2");

console.log("\nclass 3 (z = 2.0, y = 0, the largest term) dragged down to -2:");
for (const z3 of [2, 1, 0, -1, -2]) {
  const z = [...Z_BCE];
  z[3] = z3;
  console.log(`  z3 ${f(z3, 1)}: term ${f(bceTerms(z, Y_BCE)[3], 4)}, mean ${f(mean(bceTerms(z, Y_BCE)), 4)}`);
}
console.log("class 1 (z = -1.0, y = 1, the true class scored below zero) dragged up to 3:");
for (const z1 of [-1, 0, 1, 2, 3]) {
  const z = [...Z_BCE];
  z[1] = z1;
  console.log(`  z1 ${f(z1, 1)}: term ${f(bceTerms(z, Y_BCE)[1], 4)}, mean ${f(mean(bceTerms(z, Y_BCE)), 4)}`);
}
console.log("\none label toggled, scores held:");
for (let c = 0; c < 5; c += 1) {
  const y = [...Y_BCE];
  y[c] = 1 - y[c];
  const t = bceTerms(Z_BCE, y);
  console.log(`  y[${c}] -> ${y[c]}: term ${f(t[c], 4)} (was ${f(T_BCE[c], 4)}), mean ${f(mean(t), 4)}`);
}
console.log("  all five labels 0:", f(mean(bceTerms(Z_BCE, [0, 0, 0, 0, 0])), 4),
  "  all five 1:", f(mean(bceTerms(Z_BCE, [1, 1, 1, 1, 1])), 4));

/* ============================================================== 4 CONFUSION */
rule("4 · CE against BCE — the same row of scores read both ways");

console.log("cell 39's five scores under each function:");
console.log(`  scores    ${row(Z_BCE, 2)}`);
console.log(`  softmax   ${row(softmax(Z_BCE), 4)}   sum ${f(softmax(Z_BCE).reduce((a, b) => a + b), 4)}  one distribution over five classes`);
console.log(`  sigmoid   ${row(S_BCE, 4)}   sum ${f(S_BCE.reduce((a, b) => a + b), 4)}  five separate probabilities`);
console.log("cell 36's three scores under each function:");
console.log(`  scores    ${row(Z_CE, 2)}`);
console.log(`  softmax   ${row(P_CE, 4)}   sum ${f(P_CE.reduce((a, b) => a + b), 4)}`);
console.log(`  sigmoid   ${row(Z_CE.map(sigmoid), 4)}   sum ${f(Z_CE.map(sigmoid).reduce((a, b) => a + b), 4)}`);

console.log("\nwhat each loss does with the OTHER loss's target (torch 2.x):");
console.log("  BCEWithLogitsLoss(scores [1, 3], target tensor([0]) long, shape [1]):");
console.log("    ValueError: Target size (torch.Size([1])) must be the same as input size (torch.Size([1, 3]))   VERIFIED torch 2.14, _lab/dl-loss-torch.py");
console.log("  CrossEntropyLoss(scores [1, 3], target tensor([0.]) float32, shape [1]):");
console.log("    RuntimeError: expected target dtype to be Long or Byte, but got Float   VERIFIED torch 2.14, _lab/dl-loss-torch.py");
console.log("  BCEWithLogitsLoss(scores [1, 5], target [[0, 1, 1, 0, 0]] long, shape [1, 5]):");
console.log("    RuntimeError: result type Float can't be cast to the desired output type Long   VERIFIED torch 2.14, _lab/dl-loss-torch.py");
console.log("  CrossEntropyLoss(scores [1, 5], target [[0, 1, 1, 0, 0]] float32, shape [1, 5]):");
console.log("    RUNS — same shape as the scores, so torch reads the row as class PROBABILITIES and the");
console.log("    loss is -sum_c y_c log softmax_c:");
const lsm = softmax(Z_BCE).map(Math.log);
const soft = -Y_BCE.reduce((s, y, c) => s + y * lsm[c], 0);
console.log(`    = -(log ${f(softmax(Z_BCE)[1], 4)} + log ${f(softmax(Z_BCE)[2], 4)}) = ${f(soft, 4)}   (BCEWithLogitsLoss gives ${f(mean(T_BCE), 4)})`);
console.log("    a number that looks like a loss and is a different loss: the softmax makes the five classes compete");
console.log("    for one unit of probability when the target says two of them are present");
console.log("  BCEWithLogitsLoss(scores [1, 3], target one-hot [[1, 0, 0]] float32):");
console.log(`    RUNS — the per-class terms are ${row(bceTerms(Z_CE, [1, 0, 0]), 4)}, mean ${f(mean(bceTerms(Z_CE, [1, 0, 0])), 4)}`);
console.log(`    against CrossEntropyLoss's ${f(ce(Z_CE, 0), 4)}: three binary questions instead of one three-way one`);

/* ================================================================ 5 FLOAT32 */
rule("5 · float32 — what loss.item() prints against the float64 above");

const fr = Math.fround;
const mse32 = fr(fr(fr(fr(fr(2.5) - fr(3.0)) ** 2) + fr(fr(fr(0.0) - fr(-0.5)) ** 2) + fr(fr(fr(2.1) - fr(2.0)) ** 2)) / 3);
console.log(`MSE  float64 ${mse(Y_PRED, Y_TRUE)}   float32 ${mse32}   (torch prints the float32; 4 dp agree)`);
console.log(`CE   float64 ${ce(Z_CE, 0)}   float32 ${fr(ce(Z_CE, 0))}`);
console.log(`BCE  float64 ${mean(T_BCE)}   float32 ${fr(mean(T_BCE))}`);
console.log("the widget prints 4 decimals, where the two agree on every number above; the readout's digits are");
console.log("therefore the notebook's to that precision, and a 6th digit is not to be claimed");
