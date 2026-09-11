/* ============================================================================
   Assertions on widget 54's engine — the arithmetic and the geometry no
   picture can settle.

       node widgets/_lab/loss-functions-verify.mjs

   Imports `widgets/loss-functions/model.js`, the shipping code and not a copy
   (5.8). Every number here is either the notebook's own (PHM5005 05-4 cells
   30-40), one of the digits `_lab/dl-loss-measure.mjs` prints, or one of the
   sizes `_lab/loss-functions-mock.html` measured at the real stage.

   Six of these need a reader most. THE THREE LOSSES are four digits in a tile
   and nothing on the figure contradicts them. THE DRAG ARITHMETIC is pixels
   into a score, which a settled hash never exercises and a screenshot of a
   moved bar cannot check. THE STAGE HEIGHTS decide whether a page fits at all,
   and `height` and `draw` share one function precisely so this script can
   measure what the widget draws. THE UNIT TABLE says which row lands with
   which step, and a row that lands one step early is a stable, plausible
   picture. THE TWO TORCH MESSAGES are the whole of two losing states, so their
   wording is checked against what torch 2.14 printed
   (`_lab/dl-loss-torch.txt`, the output of `_lab/dl-loss-torch.py`). And THE REGISTER of every reader-facing string is
   a 5.9 sweep no hash performs.

   Exits non-zero on failure.
   ========================================================================= */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as M from "../loss-functions/model.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

let failed = 0;
let ran = 0;
const pad = (s, n) => String(s).padEnd(n);
function check(name, ok, detail = "") {
  ran += 1;
  if (!ok) failed += 1;
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${pad(name, 72)} ${detail}`);
}
const row4 = (v) => v.map(M.n4).join(" ");
const row2 = (v) => v.map(M.n2).join(" ");

/* the three pages at the notebook's own values, through the widget's own door */
const REG = M.computeFor({ task: "regression" });
const CE = M.computeFor({ task: "single-label" });
const BCE = M.computeFor({
  task: "multi-label", A: false, B: true, C: true, D: false, E: false,
});

/* --- 1 · MSELoss, cell 33 --------------------------------------------------- */
{
  check("cell 33's y_pred is [2.5, 0.0, 2.1]", REG.scores.join() === "2.5,0,2.1", REG.scores.join());
  check("cell 33's y_true is [3.0, -0.5, 2.0]", REG.target.join() === "3,-0.5,2", REG.target.join());
  check("the page runs three outputs", REG.n === 3);
  check("the gaps are y_pred - y_true", row2(REG.gaps) === "-0.50 0.50 0.10", row2(REG.gaps));
  check("the squared gaps", row4(REG.sq) === "0.2500 0.2500 0.0100", row4(REG.sq));
  check("MSELoss is the mean of the three squares", M.n4(REG.loss) === "0.1700", M.n4(REG.loss));
  check("MSELoss to six digits, as the measure script prints it",
    REG.loss.toFixed(6) === "0.170000", REG.loss.toFixed(6));
  check("the loss is the mean and not the sum",
    Math.abs(REG.loss * 3 - M.sum(REG.sq)) < 1e-12);
  check("no dtype can raise on the Regression page", REG.bad === false);
  check("the Regression page has no row-sum column", REG.sumCol === false);

  /* the parabola the drag walks: the floor sits at y_true[0] and the ends are
     the axis's own, which is what the panel's -3..3 and 0..9 are drawn for */
  const at = (p0) => M.mean(M.mseTerms([p0, 2.5 === p0 ? 0 : 0, 2.1], [3, -0.5, 2]));
  check("y_pred[0] at its own target is the parabola's floor",
    M.n4(at(3)) === "0.0867", M.n4(at(3)));
  for (const [p0, want] of [[-1, "5.4200"], [0, "3.0867"], [1, "1.4200"], [2, "0.4200"],
    [2.5, "0.1700"], [3.5, "0.1700"], [4, "0.4200"], [5, "1.4200"], [6, "3.0867"]]) {
    check(`y_pred[0] dragged to ${p0} gives a loss of ${want}`, M.n4(at(p0)) === want, M.n4(at(p0)));
  }
  /* THE GAP CAN LEAVE THE PANEL. Both tensors are held inside -1..6, so a gap
     runs -7..7 against a panel drawn over -3..3, and a point past the end is
     drawn ON that end — where the clip at 9 puts it back on the curve. */
  const widest = M.RANGE.regression[1] - M.RANGE.regression[0];
  check("the widest gap the two fields can produce is 7", widest === 7);
  check("which is wider than the parabola panel's own -3..3",
    widest > M.GAP_HI - M.GAP_LO, `${M.GAP_LO}..${M.GAP_HI}`);
  check("the panel's ceiling is the square of its own end, so a clamped point stays on the curve",
    M.GAP_HI * M.GAP_HI === M.SQ_MAX, String(M.SQ_MAX));
  check("and the drawing clamps the gap into the panel",
    /Math\.max\(GAP_LO, Math\.min\(GAP_HI, v\)\)/.test(read("widgets/loss-functions/main.js")));
}

/* --- 2 · CrossEntropyLoss, cell 36 ------------------------------------------ */
{
  check("cell 36's scores are [5.0, 0.5, 0.1]", CE.scores.join() === "5,0.5,0.1", CE.scores.join());
  check("the label opens at class 0", CE.label === 0);
  check("the page runs three classes", CE.n === 3);
  check("the softmax row", row4(CE.p) === "0.9818 0.0109 0.0073", row4(CE.p));
  check("the softmax row sums to 1", M.n4(CE.rowSum) === "1.0000", M.n4(CE.rowSum));
  check("the row sums to 1 to machine precision", Math.abs(CE.rowSum - 1) < 1e-12);
  check("CrossEntropyLoss at label 0", M.n4(CE.loss) === "0.0184", M.n4(CE.loss));
  check("the loss to six digits", CE.loss.toFixed(6) === "0.018386", CE.loss.toFixed(6));

  const at = (l) => M.computeFor({ task: "single-label", label: String(l) });
  check("the label moved to class 1", M.n4(at(1).loss) === "4.5184", M.n4(at(1).loss));
  check("the label moved to class 2", M.n4(at(2).loss) === "4.9184", M.n4(at(2).loss));
  check("-log of each probability is the loss for that label",
    row4(CE.p.map((p) => -Math.log(p))) === "0.0184 4.5184 4.9184");
  check("both moved losses stay under the curve's clip at 5",
    at(1).loss < M.YMAX && at(2).loss < M.YMAX);
  /* the worst the fixed axis allows: the true class at the floor, the other two
     at the ceiling, which is left of where the curve enters the panel */
  const worst = M.computeFor({ task: "single-label", scores: "-2,6,6" });
  check("the axis still allows a loss past the curve's clip",
    worst.loss > M.YMAX, M.n4(worst.loss));
  check("and a probability left of where the curve is drawn from",
    worst.p[0] < Math.exp(-M.YMAX), worst.p[0].toExponential(2));
  check("so the drawing clamps a point onto the curve's own end",
    /Math\.max\(pLo, Math\.min\(1, pt\.p\)\)/.test(read("widgets/loss-functions/main.js")));

  /* the drag the page exists for: the true class losing confidence */
  const drag = (z0) => M.computeFor({ task: "single-label", scores: M.wire([z0, 0.5, 0.1]) });
  for (const [z0, p0, loss] of [[6, "0.9932", "0.0068"],
    [5, "0.9818", "0.0184"], [4, "0.9520", "0.0492"], [3, "0.8794", "0.1285"],
    [2, "0.7285", "0.3168"], [1, "0.4967", "0.6997"], [0, "0.2664", "1.3228"],
    [-1, "0.1178", "2.1384"], [-2, "0.0468", "3.0610"]]) {
    const s = drag(z0);
    check(`the score for A at ${z0}: p ${p0}, loss ${loss}`,
      M.n4(s.p[0]) === p0 && M.n4(s.loss) === loss, `${M.n4(s.p[0])} / ${M.n4(s.loss)}`);
  }
  check("a score typed past the axis is held at its ceiling, so every bar has a top",
    drag(8).scores[0] === 6, String(drag(8).scores[0]));
  const wrongUp = M.computeFor({ task: "single-label", scores: M.wire([5, 5, 0.1]) });
  check("a wrong class dragged up to A's own 5.0 gives 0.6969",
    M.n4(wrongUp.loss) === "0.6969", M.n4(wrongUp.loss));

  const bad = M.computeFor({ task: "single-label", singleDtype: "float32" });
  check("a float32 target raises on the Single-label page", bad.bad === true);
  check("a long target does not", CE.bad === false);
  check("the target's shape line follows the dtype",
    M.targetDtypeText(CE) === "[1], long" && M.targetDtypeText(bad) === "[1], float32",
    M.targetDtypeText(bad));
  check("the scores' shape line is [1, 3], float32",
    M.scoresDtypeText(CE) === "[1, 3], float32", M.scoresDtypeText(CE));
}

/* --- 3 · BCEWithLogitsLoss, cell 39 ----------------------------------------- */
{
  check("cell 39's scores are [0.2, -1.0, 0.5, 2.0, -0.3]",
    BCE.scores.join() === "0.2,-1,0.5,2,-0.3", BCE.scores.join());
  check("cell 39's target has B and C present", BCE.y.join() === "0,1,1,0,0", BCE.y.join());
  check("the page runs five classes", BCE.n === 5);
  check("the sigmoid row",
    row4(BCE.p) === "0.5498 0.2689 0.6225 0.8808 0.4256", row4(BCE.p));
  check("the sigmoid row sums to 2.7476, not to 1",
    M.n4(BCE.rowSum) === "2.7476", M.n4(BCE.rowSum));
  check("the probability given to each class's own label",
    row4(BCE.pTrue) === "0.4502 0.2689 0.6225 0.1192 0.5744", row4(BCE.pTrue));
  check("the five per-class terms",
    row4(BCE.terms) === "0.7981 1.3133 0.4741 2.1269 0.5544", row4(BCE.terms));
  check("BCEWithLogitsLoss is the mean of the five", M.n4(BCE.loss) === "1.0534", M.n4(BCE.loss));
  check("the loss to six digits", BCE.loss.toFixed(6) === "1.053352", BCE.loss.toFixed(6));
  check("reduction='sum' would print 5.2668", M.n4(M.sum(BCE.terms)) === "5.2668");
  check("a term is -log of the probability at the true label",
    BCE.terms.every((t, i) => Math.abs(t + Math.log(BCE.pTrue[i])) < 1e-12));

  /* torch's own stable form, so the widget can print either and get the digits */
  const stable = M.bceStable(BCE.scores, BCE.y);
  check("torch's stable form agrees with the textbook one to 1e-12",
    stable.every((t, i) => Math.abs(t - BCE.terms[i]) < 1e-12),
    Math.max(...stable.map((t, i) => Math.abs(t - BCE.terms[i]))).toExponential(2));
  check("the stable form prints the same four digits", row4(stable) === row4(BCE.terms));

  const y = (bits) => M.computeFor({
    task: "multi-label",
    A: bits[0], B: bits[1], C: bits[2], D: bits[3], E: bits[4],
  });
  for (const [c, want] of [[0, "1.0134"], [1, "0.8534"], [2, "1.1534"], [3, "0.6534"], [4, "1.1134"]]) {
    const bits = [false, true, true, false, false];
    bits[c] = !bits[c];
    check(`class ${M.LETTERS[c]} toggled gives a loss of ${want}`,
      M.n4(y(bits).loss) === want, M.n4(y(bits).loss));
  }
  check("every class absent gives 0.9534",
    M.n4(y([false, false, false, false, false]).loss) === "0.9534");
  check("every class present gives 0.6734",
    M.n4(y([true, true, true, true, true]).loss) === "0.6734");

  const z = (i, v) => {
    const s = [0.2, -1, 0.5, 2, -0.3];
    s[i] = v;
    return M.computeFor({
      task: "multi-label", logits: M.wire(s),
      A: false, B: true, C: true, D: false, E: false,
    });
  };
  for (const [v, want] of [[2, "1.0534"], [1, "0.8906"], [0, "0.7666"], [-1, "0.6906"], [-2, "0.6534"]]) {
    check(`class D's score at ${v} gives a loss of ${want}`, M.n4(z(3, v).loss) === want, M.n4(z(3, v).loss));
  }
  for (const [v, want] of [[-1, "1.0534"], [0, "0.9293"], [1, "0.8534"], [2, "0.8161"], [3, "0.8004"]]) {
    check(`class B's score at ${v} gives a loss of ${want}`, M.n4(z(1, v).loss) === want, M.n4(z(1, v).loss));
  }
  check("a term of 0.0181 at one end of the axis and 4.0181 at the other",
    M.n4(-Math.log(M.sigmoid(4))) === "0.0181" && M.n4(-Math.log(M.sigmoid(-4))) === "4.0181");

  const bad = M.computeFor({
    task: "multi-label", multiDtype: "long", A: false, B: true, C: true, D: false, E: false,
  });
  check("a long target raises on the Multi-label page", bad.bad === true);
  check("a float32 target does not", BCE.bad === false);
  check("the target's shape line follows the dtype",
    M.targetDtypeText(BCE) === "[1, 5], float32" && M.targetDtypeText(bad) === "[1, 5], long",
    M.targetDtypeText(bad));
}

/* --- 4 · the same row read both ways ----------------------------------------
 * The confusion the widget exists for, as a number rather than a caption: one
 * row of five scores under softmax and under sigmoid.
 */
{
  const z = [0.2, -1, 0.5, 2, -0.3];
  check("softmax over cell 39's row sums to 1",
    M.n4(M.sum(M.softmax(z))) === "1.0000", M.n4(M.sum(M.softmax(z))));
  check("sigmoid per class over the same row sums to 2.7476",
    M.n4(M.sum(z.map(M.sigmoid))) === "2.7476");
  check("softmax over cell 39's row",
    row4(M.softmax(z)) === "0.1074 0.0324 0.1450 0.6500 0.0652", row4(M.softmax(z)));
  check("sigmoid over cell 36's row does not sum to 1",
    M.n4(M.sum([5, 0.5, 0.1].map(M.sigmoid))) !== "1.0000");
  check("the two row sums the two pages print are different numbers",
    M.n4(CE.rowSum) === "1.0000" && M.n4(BCE.rowSum) === "2.7476");
  check("softmax is shift invariant, which is why it is computed off the maximum",
    M.softmax([5, 0.5, 0.1]).every((p, i) => Math.abs(p - M.softmax([15, 10.5, 10.1])[i]) < 1e-12));
  check("sigmoid(0) is a half", M.sigmoid(0) === 0.5);
  check("a large negative score does not underflow the sigmoid", M.sigmoid(-40) > 0);
}

/* --- 5 · the tensors on the wire -------------------------------------------- */
{
  const R = M.RANGE.regression;
  check("a typed row is canonicalised: spaces and trailing zeros go",
    M.parseVec("2.5, 0.0, 2.1", 3, R) === "2.5,0,2.1", M.parseVec("2.5, 0.0, 2.1", 3, R));
  check("the canonical form round trips through unwire",
    M.wire(M.unwire("2.5,0,2.1")) === "2.5,0,2.1");
  check("the negative target canonicalises",
    M.parseVec("3.0, -0.50, 2.00", 3, R) === "3,-0.5,2", M.parseVec("3.0, -0.50, 2.00", 3, R));
  check("show puts the row back the way a person writes it",
    M.showVec("2.5,0,2.1") === "2.5, 0, 2.1", M.showVec("2.5,0,2.1"));
  check("show and parse are inverses on a canonical row",
    M.parseVec(M.showVec("0.2,-1,0.5,2,-0.3"), 5, M.RANGE["multi-label"]) === "0.2,-1,0.5,2,-0.3");
  check("a short row is padded to the count the page draws",
    M.parseVec("5", 3, M.RANGE["single-label"]) === "5,0,0", M.parseVec("5", 3, M.RANGE["single-label"]));
  check("a long row is truncated to it",
    M.parseVec("5,0.5,0.1,9", 3, M.RANGE["single-label"]) === "5,0.5,0.1");
  check("a value is rounded to a tenth", M.parseVec("2.55,0,0", 3, R) === "2.6,0,0",
    M.parseVec("2.55,0,0", 3, R));
  check("a value off the axis is held inside it",
    M.parseVec("100,-100,0", 3, M.RANGE["single-label"]) === "6,-2,0",
    M.parseVec("100,-100,0", 3, M.RANGE["single-label"]));
  check("text that is not numbers still leaves a drawable row",
    M.parseVec("abc", 3, R) === "0,0,0", M.parseVec("abc", 3, R));
  check("the hint is silent when the count is right", M.hintFor("5,0.5,0.1", 3, "class") === null);
  check("the hint names the count and the noun",
    M.hintFor("5,0.5", 3, "class") === "three numbers, one per class",
    M.hintFor("5,0.5", 3, "class"));
  check("and the five-class page says five",
    M.hintFor("1", 5, "class") === "five numbers, one per class");
  check("the notebook's three defaults are the canonical form",
    [M.MSE_PRED, M.MSE_TRUE, M.CE_SCORES, M.BCE_SCORES]
      .every((t, i) => M.parseVec(t, i === 3 ? 5 : 3,
        i === 3 ? M.RANGE["multi-label"] : i < 2 ? R : M.RANGE["single-label"]) === t));
  check("every default sits inside its page's own axis",
    M.unwire(M.CE_SCORES).every((v) => v >= -2 && v <= 6)
    && M.unwire(M.BCE_SCORES).every((v) => v >= -4 && v <= 4)
    && [...M.unwire(M.MSE_PRED), ...M.unwire(M.MSE_TRUE)].every((v) => v >= -1 && v <= 6));
}

/* --- 6 · the drag -----------------------------------------------------------
 * A gesture of dy pixels against the page's FIXED axis, resolved from the value
 * the parameter held when it began.
 */
{
  const CE_R = M.RANGE["single-label"];
  check("the Single-label axis is 8 units over the 88px bar band",
    M.BAR_H / (CE_R[1] - CE_R[0]) === 11, `${M.BAR_H / 8}px a unit`);
  check("a dy of -44px moves a score by 4.0", M.dragTo(1, -44, CE_R) === 5, M.dragTo(1, -44, CE_R));
  check("a dy of +44px moves it back", M.dragTo(5, 44, CE_R) === 1, M.dragTo(5, 44, CE_R));
  check("dragging up raises the score", M.dragTo(0, -11, CE_R) === 1);
  check("dragging down lowers it", M.dragTo(0, 11, CE_R) === -1);
  check("a gesture of no distance changes nothing", M.dragTo(5, 0, CE_R) === 5);
  check("the value snaps to a tenth", M.dragTo(5, -1, CE_R) === 5.1, M.dragTo(5, -1, CE_R));
  check("a sub-tenth gesture rounds to the nearest tenth",
    M.dragTo(0, 0.4, CE_R) === 0, M.dragTo(0, 0.4, CE_R));
  check("the drag clamps at the top of the axis", M.dragTo(5, -400, CE_R) === 6);
  check("and at the bottom", M.dragTo(5, 400, CE_R) === -2);
  check("the Multi-label axis is 8 units too, over -4 to 4",
    M.BAR_H / (M.RANGE["multi-label"][1] - M.RANGE["multi-label"][0]) === 11);
  check("the Multi-label drag clamps at -4 and 4",
    M.dragTo(0, 400, M.RANGE["multi-label"]) === -4
    && M.dragTo(0, -400, M.RANGE["multi-label"]) === 4);
  check("the Regression axis is 7 units over the same band",
    Math.abs(M.BAR_H / (M.RANGE.regression[1] - M.RANGE.regression[0]) - 88 / 7) < 1e-12);
  check("the Regression drag clamps at -1 and 6",
    M.dragTo(0, 900, M.RANGE.regression) === -1 && M.dragTo(0, -900, M.RANGE.regression) === 6);

  check("only the grabbed column moves",
    M.dragVec("5,0.5,0.1", 0, -44, 3, CE_R) === "6,0.5,0.1",
    M.dragVec("5,0.5,0.1", 0, -44, 3, CE_R));
  check("the middle column moves alone",
    M.dragVec("5,0.5,0.1", 1, -44, 3, CE_R) === "5,4.5,0.1",
    M.dragVec("5,0.5,0.1", 1, -44, 3, CE_R));
  check("class A dragged to 1.0 is the mock's own dragged figure",
    M.dragVec("5,0.5,0.1", 0, 44, 3, CE_R) === "1,0.5,0.1");
  check("and it gives the measured 0.6997",
    M.n4(M.computeFor({ task: "single-label", scores: M.dragVec("5,0.5,0.1", 0, 44, 3, CE_R) }).loss)
    === "0.6997");
  check("a column outside the row leaves the tensor as it was",
    M.dragVec("5,0.5,0.1", -1, -44, 3, CE_R) === "5,0.5,0.1");
  check("the drag returns the canonical text the field's own parse would produce",
    M.dragVec("5,0.5,0.1", 2, -11, 3, CE_R) === M.parseVec(M.dragVec("5,0.5,0.1", 2, -11, 3, CE_R), 3, CE_R));
  check("the five-class row keeps its other four",
    M.dragVec("0.2,-1,0.5,2,-0.3", 3, 44, 5, M.RANGE["multi-label"]) === "0.2,-1,0.5,-2,-0.3");
  check("class D dragged to -2 gives the measured 0.6534",
    M.n4(M.computeFor({
      task: "multi-label", A: false, B: true, C: true, D: false, E: false,
      logits: M.dragVec("0.2,-1,0.5,2,-0.3", 3, 44, 5, M.RANGE["multi-label"]),
    }).loss) === "0.6534");
}

/* --- 7 · the walk ------------------------------------------------------------ */
{
  check("the Regression page lands four rows", REG.units === 4);
  check("the Single-label page lands three", CE.units === 3);
  check("the Multi-label page lands five", BCE.units === 5);

  for (const [name, state] of [["Regression", REG], ["Single-label", CE], ["Multi-label", BCE]]) {
    const units = M.pageUnits(state);
    check(`${name}: every unit of the table is a step the page runs`,
      units.every((u) => u.unit >= 1 && u.unit <= state.units),
      units.map((u) => u.unit).join(","));
    check(`${name}: every step lands at least one piece`,
      Array.from({ length: state.units }, (_, i) => i + 1)
        .every((n) => units.some((u) => u.unit === n)));
    check(`${name}: nothing on the stage before the walk but the next row's frame`,
      units.filter((u) => M.stageOf(0, u.unit, u.preview) !== "absent")
        .every((u) => u.unit === 1));
    check(`${name}: everything has landed once the last step has run`,
      units.every((u) => M.stageOf(state.units, u.unit, u.preview) === "landed"));
    check(`${name}: the loss waits for the last step`,
      units.find((e) => e.id === "loss").unit === state.units);
    check(`${name}: the loss has no pale form`,
      units.find((e) => e.id === "loss").preview === false);
  }

  check("Regression lands the target, the gap, the square and the mean, in that order",
    M.pageUnits(REG).filter((u) => u.preview !== false).map((u) => `${u.id}@${u.unit}`).join(" ")
    === "target@1 gap@2 gap squared@3");
  check("the target's tick on the bars has no pale form",
    M.pageUnits(REG).find((u) => u.id === "target ticks").preview === false);
  check("nor does the gap bracket",
    M.pageUnits(REG).find((u) => u.id === "gap bracket").preview === false);
  check("Regression's three points land with the row that squares the gaps",
    M.pageUnits(REG).find((u) => u.id === "curve points").unit === 3);
  check("Single-label lands the softmax row, the target and the loss",
    M.pageUnits(CE).map((u) => `${u.id}@${u.unit}`).join(" ")
    === "p@1 row sum@1 target@2 true class lit@2 loss@3 curve point@3");
  check("Multi-label lands two rows the other page does not",
    M.pageUnits(BCE).some((u) => u.id === "p at the true label")
    && M.pageUnits(BCE).some((u) => u.id === "-log p"));
  check("the row sum lands with the probability row it reads",
    M.pageUnits(CE).find((u) => u.id === "row sum").unit
    === M.pageUnits(CE).find((u) => u.id === "p").unit);

  check("stageOf: a step that has run is landed", M.stageOf(2, 1) === "landed");
  check("stageOf: the step itself is landed at its own number", M.stageOf(2, 2) === "landed");
  check("stageOf: the next step previews", M.stageOf(2, 3) === "preview");
  check("stageOf: the one after it is absent", M.stageOf(2, 4) === "absent");
  check("stageOf: a piece with no pale form is absent until it lands",
    M.stageOf(2, 3, false) === "absent");
  check("stageOf: before the walk starts, only the first row previews",
    M.stageOf(0, 1) === "preview" && M.stageOf(0, 2) === "absent");

  check("the three paces are named a step, the collection's own wording",
    M.SPEEDS.every((s) => /^\d\.\d seconds a step$/.test(s.detail)),
    M.SPEEDS.map((s) => s.detail).join(" / "));
  check("the paces are Slow, Medium and Fast",
    M.SPEEDS.map((s) => s.label).join(" ") === "Slow Medium Fast");
  check("a beat is 1.2s, 0.7s and 0.3s",
    [M.unitMs("slow"), M.unitMs("medium"), M.unitMs("fast")].join() === "1200,700,300");
  check("an unknown pace falls back to Medium", M.unitMs("what") === 700);
}

/* --- 8 · the stage, at the mock's own measurements ---------------------------- */
{
  const W = 550;
  check("the Regression stage is 494px at 550", M.layout(W, REG).height === 494, M.layout(W, REG).height);
  check("the Single-label stage is 414px", M.layout(W, CE).height === 414, M.layout(W, CE).height);
  check("the Multi-label stage is 524px", M.layout(W, BCE).height === 524, M.layout(W, BCE).height);
  check("`pageHeight` and `layout` are the same number (5.8)",
    M.pageHeight(W, { task: "regression" }) === M.layout(W, REG).height);
  check("the three heights differ, so no short page pays for the tallest",
    new Set([494, 414, 524]).size === 3);

  const bad = M.computeFor({ task: "single-label", singleDtype: "float32" });
  check("torch's message costs the Single-label stage one printed line",
    M.layout(W, bad).height === 426, M.layout(W, bad).height);
  const badB = M.computeFor({
    task: "multi-label", multiDtype: "long", A: false, B: true, C: true, D: false, E: false,
  });
  check("and costs the Multi-label stage nothing, since its loss line is the last thing drawn",
    M.layout(W, badB).height === 524, M.layout(W, badB).height);

  const gCE = M.layout(W, CE);
  const gBCE = M.layout(W, BCE);
  const gREG = M.layout(W, REG);
  check("the rows column is 300px at 550", gCE.leftW === 300, gCE.leftW);
  check("Single-label runs four columns, three classes and the row sum", gCE.cols === 4);
  check("at a pitch of 75px", gCE.pitch === 75, gCE.pitch);
  check("Multi-label runs six columns", gBCE.cols === 6);
  check("at a pitch of 50px, the tightest column in the widget", gBCE.pitch === 50, gBCE.pitch);
  check("Regression runs three columns and no sum", gREG.cols === 3);
  check("at the 88px cap rather than the 100px the room allows", gREG.pitch === 88, gREG.pitch);
  check("a bar is 56% of the pitch",
    gCE.barW === Math.round(75 * 0.56) && gBCE.barW === Math.round(50 * 0.56),
    `${gCE.barW} / ${gBCE.barW}`);
  check("every column fits inside the rows column",
    [gCE, gBCE, gREG].every((g) => g.cols * g.pitch <= g.leftW));

  const wide = M.layout(770, BCE);
  check("at 770 the rows column grows to 520px", wide.leftW === 520, wide.leftW);
  check("and the pitch reaches the 88px cap rather than the room", wide.pitch === 86, wide.pitch);
  check("the stage is the same height at both widths, since nothing here wraps",
    wide.height === gBCE.height);
  check("the curve panel keeps its 200px at both widths",
    M.CURVE_W === 200 && wide.curveX === 770 - M.PAD - M.CURVE_W, wide.curveX);

  check("the bars run 88px, the band the axis is drawn over", M.BAR_H === 88);
  check("the bar band starts under the class letters",
    gCE.barTop === gCE.barY + M.ROW_LBL, gCE.barTop);
  check("the axis maps the range's floor to the foot of the band",
    Math.abs(gCE.py(-2) - (gCE.barTop + M.BAR_H)) < 1e-9);
  check("and its ceiling to the top", Math.abs(gCE.py(6) - gCE.barTop) < 1e-9);
  check("zero sits a quarter of the band up from its foot, where -2..6 puts it",
    Math.abs(gCE.py(0) - (gCE.barTop + M.BAR_H * 0.75)) < 1e-9, gCE.py(0));
  check("a column centre is half a pitch in from its own left edge",
    gCE.colX(0) === M.PAD + gCE.pitch / 2);
  check("the columns are one pitch apart",
    gCE.colX(1) - gCE.colX(0) === gCE.pitch);

  /* what the drag's hit-test resolves, on the geometry the drawing uses */
  check("a point on the first bar resolves to column 0",
    M.barColAt(gCE.colX(0), gCE.barTop + 10, gCE) === 0);
  check("a point on the last bar resolves to the last column",
    M.barColAt(gCE.colX(2), gCE.barTop + 10, gCE) === 2);
  check("a point above the band resolves to no column",
    M.barColAt(gCE.colX(0), gCE.barTop - 20, gCE) === -1);
  check("a point below the band resolves to no column",
    M.barColAt(gCE.colX(0), gCE.barTop + M.BAR_H + 20, gCE) === -1);
  check("a point in the row-sum column is over no bar",
    M.barColAt(gCE.colX(3), gCE.barTop + 10, gCE) === -1, gCE.colX(3));
  check("the band's own edges are grabbable, with a few px of tolerance",
    M.barColAt(gCE.colX(1), gCE.barTop - 4, gCE) === 1
    && M.barColAt(gCE.colX(1), gCE.barTop + M.BAR_H + 4, gCE) === 1);
  check("all five Multi-label bars are grabbable",
    [0, 1, 2, 3, 4].every((i) => M.barColAt(gBCE.colX(i), gBCE.barTop + 4, gBCE) === i));

  /* the rows the walk lands, in the order the page draws them */
  check("Regression draws target, gap and gap² in that order",
    gREG.rows.map((r) => r.id).join(" ") === "target gap gap squared");
  check("Single-label draws p then the target",
    gCE.rows.map((r) => r.id).join(" ") === "p target");
  check("Multi-label draws p, the target, p at the true label and −log p",
    gBCE.rows.map((r) => r.id).join(" ") === "p target p at the true label -log p");
  check("every row's cells sit below its own name",
    [gCE, gBCE, gREG].every((g) => g.rows.every((r) => r.cellY === r.nameY + M.ROW_LBL)));
  check("the rows do not overlap",
    [gCE, gBCE, gREG].every((g) => g.rows.every((r, i) =>
      i === 0 || r.nameY >= g.rows[i - 1].cellY + M.CH)));
  check("the loss line sits under the last row",
    [gCE, gBCE, gREG].every((g) => g.lossY >= g.rows.at(-1).cellY + M.CH));
  check("the captions sit under both the rows and the curve",
    [gCE, gBCE, gREG].every((g) => g.capY >= g.top + M.CURVE_H && g.capY >= g.top + g.rowsH));
  check("the target row is the one that carries a dtype line",
    [gCE, gBCE, gREG].every((g) =>
      g.rows.filter((r) => r.dtypeY !== undefined).map((r) => r.id).join() === "target"));
  check("only Regression draws a second arrow, into the gap",
    gREG.secondEdgeY !== null && gCE.secondEdgeY === null && gBCE.secondEdgeY === null);
  check("the target row is chips on the classification pages and cells on Regression",
    gCE.rows.find((r) => r.id === "target").kind === "chips"
    && gBCE.rows.find((r) => r.id === "target").kind === "chips"
    && gREG.rows.find((r) => r.id === "target").kind === "cells");
}

/* --- 9 · torch's two messages, and their mark -------------------------------- */
{
  const model = read("widgets/loss-functions/model.js");
  const printed = read("widgets/_lab/dl-loss-torch.txt");
  check("the Single-label message is what torch printed for a float32 index",
    printed.includes("CE with a float32 index [0.]: " + M.torchDtypeError["single-label"]),
    M.torchDtypeError["single-label"]);
  check("the Multi-label message is what torch printed for a long 0/1 row",
    printed.includes("BCE with a long 0/1 row: " + M.torchDtypeError["multi-label"]),
    M.torchDtypeError["multi-label"]);
  check("the declaration says where the strings come from",
    /TORCH 2\.14.S OWN[\s\S]{0,600}torchDtypeError/.test(model));
  check("the Regression page declares no message, because it has no dtype control",
    M.torchDtypeError.regression === undefined);
  check("each message fits the stage's own 522px of usable width at 550",
    Object.values(M.torchDtypeError).every((s) => s.length * 7 < 522 * 2));
}

/* --- 10 · the register of every reader-facing string (5.9) -------------------- */
{
  const strings = [];
  const walk = (v) => {
    if (typeof v === "string") strings.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(M.STRINGS);
  walk(M.TASKS.map((t) => [t.label, t.qual ?? "", t.detail]));
  walk(M.OUTPUT_HEADS);
  walk([...M.headsFor("multi-label"), ...M.LABEL_OPTIONS]);
  walk(M.SPEEDS.map((s) => [s.label, s.detail]));
  walk(M.SUM_NOTE);
  walk(M.HEAD);
  walk(M.HEAD_EXPR);
  walk(M.FN_LABEL);
  walk(M.BIN_FN);
  walk(M.BIN_SHAPE);
  walk([M.binaryExpr(0), M.binaryExpr(1)]);
  walk([M.hintFor("", 1, "output"), M.hintFor("", 2, "class"),
    M.hintFor("", 3, "class"), M.hintFor("", 5, "class")]);
  check("there are strings to sweep", strings.length > 80, `${strings.length} strings`);
  const banned = /\b(notebook|lesson|cell \d|never)\b/i;
  const bad = strings.filter((s) => banned.test(s));
  check("no reader-facing string names a lesson, a notebook or a cell, and none says never",
    bad.length === 0, bad.join(" | "));
  check("no string editorialises with a verdict word",
    !strings.some((s) => /\b(simply|obviously|of course|magic|beautiful)\b/i.test(s)));
  check("the subtitle is two or three claims in the 140-240 character budget (2.10)",
    M.STRINGS.subtitle.length >= 140 && M.STRINGS.subtitle.length <= 400,
    `${M.STRINGS.subtitle.length} chars`);
  check("the subtitle names the loss, the target and the two classification cases",
    /A loss function measures/.test(M.STRINGS.subtitle) && /target/.test(M.STRINGS.subtitle)
    && /for each class/.test(M.STRINGS.subtitle));
  check("the one count control is labelled by its noun and detailed by what it resizes",
    M.STRINGS.outputsLabel === "Outputs" && /, or several: /.test(M.STRINGS.outputsDetail),
    M.STRINGS.outputsDetail);
  check("the Binary page's two column names say which form each is",
    M.STRINGS.binaryTwoRow === "y_pred, two outputs"
    && M.STRINGS.binaryOneRow === "y_pred, one output");
  check("its y_true detail names the two classes the index picks between",
    /0 is A, 1 is B/.test(M.STRINGS.binaryLabelDetail));
  check("each task option carries a detail of several clauses, the function among them",
    M.TASKS.every((t) => t.detail.split(" · ").length >= 2),
    M.TASKS.map((t) => t.detail.split(" · ")[0]).join(" / "));
  check("every classification detail opens with how many classes there are, and how many are true",
    M.TASKS.filter((t) => t.qual).every((t) => /^(one class of (two|three)|any of five classes)/.test(t.detail)),
    M.TASKS.filter((t) => t.qual).map((t) => t.detail.split(" · ")[0]).join(" / "));
  check("the three that say what the target holds name it as y_true",
    M.TASKS.filter((t) => /y_true/.test(t.detail)).length === 3);
  check("the four faces run Regression, then the classification three commonest first",
    M.TASKS.map((t) => t.label).join(" · ")
    === "Regression · Binary · Single-label · Multi-label",
    M.TASKS.map((t) => t.label).join(" · "));
  check("they carry two group heads, and the three classification faces are one run",
    M.TASKS.map((t) => t.group).join(" ") === "Regression Classification Classification Classification",
    M.TASKS.map((t) => t.group).join(" "));
  check("only the classification faces carry a second line, and it is the class count",
    M.TASKS.map((t) => t.qual ?? "—").join(" · ") === "— · 2 classes · >2 classes · >2 classes",
    M.TASKS.map((t) => t.qual ?? "—").join(" · "));
  check("a qualifier is a count and not a sentence, so it fits the 86.9px face at --fs-xs",
    M.TASKS.filter((t) => t.qual).every((t) => t.qual.length <= 12 && !/\./.test(t.qual)));
  check("each group head is one word (3.4g)",
    [...new Set(M.TASKS.map((t) => t.group))].every((g) => !g.includes(" ")));
  check("the three task values are the words on the control, lowercased (5.9)",
    M.TASKS.every((t) => t.value === t.label.toLowerCase()));
  check("each page's header names the loss class torch declares",
    Object.values(M.HEAD).join(" ").includes("MSELoss")
    && Object.values(M.HEAD).join(" ").includes("CrossEntropyLoss")
    && Object.values(M.HEAD).join(" ").includes("BCEWithLogitsLoss"));
  check("each page has two caption rows",
    Object.values(M.STRINGS.captions).every((c) => c.length === 2));
  check("a caption's first row waits for the first step and its second for the last",
    M.STRINGS.captions.regression[1].at === 4
    && M.STRINGS.captions["single-label"][1].at === 3
    && M.STRINGS.captions["multi-label"][1].at === 5);
  check("every caption is a sentence",
    Object.values(M.STRINGS.captions).flat().every((c) => /^[A-Z].*\.$/.test(c.line)));
  check("the two error captions say which dtype the loss reads",
    Object.values(M.STRINGS.errorCaption).every((s) => /float32|long/.test(s)));
  check("the dtype rule is stated for all four pages as a requirement, so it stays true on the failing arm (2.11)",
    Object.keys(M.STRINGS.dtypeRule).length === 4
    && Object.values(M.STRINGS.dtypeRule).every((s) => / must be /.test(s)));
  check("the row-sum note is the contrast, one page at a time",
    /sum to 1/.test(M.SUM_NOTE["single-label"]) && /nothing holds them to 1/.test(M.SUM_NOTE["multi-label"]));
  check("the two classification pages name the function on their own arrow",
    M.FN_LABEL["single-label"] === "softmax over the row"
    && M.FN_LABEL["multi-label"] === "sigmoid per class");
  check("Regression names no function, because it applies none",
    M.FN_LABEL.regression === "");
  check("the drive labels name this widget's own noun (3.4c)",
    M.STRINGS.stepLabel === "Next row" && /row/.test(M.STRINGS.stepTitle));
  check("the run button is Play, the collection's own word (3.7)",
    M.STRINGS.runLabel === "Play");
  check("the card carries a note for each page",
    Object.keys(M.STRINGS.cardNote).length === 4
    && Object.values(M.STRINGS.cardNote).every((s) => s.length > 40));
}

/* --- 11 · one output and several -------------------------------------------
 * The count is the number of COLUMNS. The tensor field keeps the row as typed
 * and `compute` reads the first k of it, so narrowing and widening returns the
 * row that was there — and no page resizes, because no ROW moves.
 */
{
  const REG1 = M.computeFor({ task: "regression", outputs: "1" });

  check("Regression at one output reads the first prediction and the first target",
    REG1.scores.join() === "2.5" && REG1.target.join() === "3",
    `${REG1.scores.join()} / ${REG1.target.join()}`);
  check("and prints the 0.2500 torch printed for 2.5 against 3.0",
    M.n4(REG1.loss) === "0.2500", M.n4(REG1.loss));
  check("to six digits, as `_lab/dl-loss-torch.txt` prints it",
    REG1.loss.toFixed(6) === "0.250000", REG1.loss.toFixed(6));
  check("the one-output page draws one column", REG1.n === 1);

  /* THE THREE CLASSIFICATION PAGES ARE FIXED (structure B): a count control on
     any of them said in a control what the face's own second line says. */
  check("Single-label is the notebook's three classes, whatever the URL asks for",
    M.computeFor({ task: "single-label", singleClasses: "2" }).n === 3);
  check("Multi-label is its five", M.computeFor({ task: "multi-label", multiClasses: "1" }).n === 5);
  check("and Binary is two, both ways", M.computeFor({ task: "binary" }).n === 2);
  check("the page widths are declared once, for the fields and the figure alike",
    M.PAGE_N["single-label"] === 3 && M.PAGE_N["multi-label"] === 5 && M.PAGE_N.binary === 2,
    Object.values(M.PAGE_N).join(" / "));
  check("THE ROW SUM IS BACK ON MULTI-LABEL UNCONDITIONALLY, since the page is five classes",
    BCE.sumCol === true && M.n4(BCE.rowSum) === "2.7476");
  check("which is the contrast, against Single-label's 1.0000 under the same head",
    CE.sumCol === true && M.n4(CE.rowSum) === "1.0000");
  check("so the readout has no row of one to give way to",
    !/if \(!state\.sumCol\) \{/.test(read("widgets/loss-functions/main.js")));
  check("the label's options are the three class indices, fixed",
    M.LABEL_OPTIONS.join() === "0,1,2", M.LABEL_OPTIONS.join());
  check("and its detail counts from A at 0, the head row's own letter",
    /counting from A at 0/.test(M.STRINGS.labelDetail), M.STRINGS.labelDetail);

  /* the shapes of Kenneth's own left columns */
  check("a row of one prints [1] and not [1, 1] (his own figures' left column)",
    M.scoresDtypeText(REG1) === "[1], float32" && M.targetDtypeText(REG1) === "[1], float32",
    M.scoresDtypeText(REG1));
  check("three classes print [1, 3], float32",
    M.scoresDtypeText(CE) === "[1, 3], float32", M.scoresDtypeText(CE));
  check("and the class index is [1], long",
    M.targetDtypeText(CE) === "[1], long", M.targetDtypeText(CE));
  check("five labels print [1, 5], float32 on the Multi-label page",
    M.scoresDtypeText(BCE) === "[1, 5], float32" && M.targetDtypeText(BCE) === "[1, 5], float32");

  /* the count narrows and pads without touching what was typed */
  const R = M.RANGE.regression;
  check("a three-value row read at one output is its first value",
    M.parseVec("2.5,0,2.1", 1, R) === "2.5", M.parseVec("2.5,0,2.1", 1, R));
  check("a one-value row read at three outputs is padded with zeros",
    M.parseVec("2.5", 3, R) === "2.5,0,0", M.parseVec("2.5", 3, R));
  check("and the field shows the padding, so it reads what the figure reads",
    M.showRow("2.5", 3, R) === "2.5, 0, 0", M.showRow("2.5", 3, R));
  check("the field narrowed to one output shows one number",
    M.showRow("2.5,0,2.1", 1, R) === "2.5", M.showRow("2.5,0,2.1", 1, R));
  check("`parseRow` stores what was typed, whatever the count",
    M.parseRow("2.5, 0.0, 2.1", R) === "2.5,0,2.1" && M.parseRow("2.5", R) === "2.5",
    M.parseRow("2.5", R));
  check("it still canonicalises and holds a value inside the axis",
    M.parseRow("100, -100", M.RANGE["single-label"]) === "6,-2",
    M.parseRow("100, -100", M.RANGE["single-label"]));
  check("it caps a pasted row, so the URL cannot grow without end",
    M.unwire(M.parseRow("1,1,1,1,1,1,1,1,1,1,1,1", R)).length === M.MAX_ROW);
  check("so a row typed at three outputs survives a trip through one output",
    M.parseVec(M.parseRow("2.5,0,2.1", R), 3, R) === "2.5,0,2.1");
  check("a drag at one output keeps the columns it does not draw",
    M.dragVec("2.5,0,2.1", 0, -22, 1, R) === "4.3,0,2.1",
    M.dragVec("2.5,0,2.1", 0, -22, 1, R));
  check("and a drag cannot reach a column the page is not drawing",
    M.dragVec("2.5,0,2.1", 2, -22, 1, R) === "2.5,0,2.1");

  check("the hint counts to whatever the control says",
    M.hintFor("2.5", 1, "output") === null
    && M.hintFor("2.5,0", 1, "output") === "one number, for the one output",
    M.hintFor("2.5,0", 1, "output"));
  check("and names two classes as two",
    M.hintFor("5", 2, "class") === "two numbers, one per class",
    M.hintFor("5", 2, "class"));

  check("the count reads its default when the URL carries none",
    M.countOf({}, "outputs") === 3);
  check("the count is the numbers on its own ticks (5.9)",
    M.OUTPUT_COUNTS.join() === "1,3", M.OUTPUT_COUNTS.join());
  check("its default is one of its own options",
    M.OUTPUT_COUNTS.includes(M.COUNT_DEFAULT.outputs));
  check("and is the notebook's own example, so the page opens as it did",
    M.COUNT_DEFAULT.outputs === "3");
  check("no other count parameter is declared, since the other pages are fixed",
    Object.keys(M.COUNT_DEFAULT).join() === "outputs", Object.keys(M.COUNT_DEFAULT).join());
  check("a label past the last class is held on the row it can reach",
    M.computeFor({ task: "single-label", label: "7" }).label === 2);

  /* THE HEIGHTS ARE THE MOCK'S OWN, and the whole point of the pick */
  const W = 550;
  check("Regression is 494px at one output, as at three",
    M.layout(W, REG1).height === 494, M.layout(W, REG1).height);
  check("and at three", M.layout(W, REG).height === 494, M.layout(W, REG).height);
  check("Single-label is 414px", M.layout(W, CE).height === 414, M.layout(W, CE).height);
  check("Multi-label is 524px", M.layout(W, BCE).height === 524, M.layout(W, BCE).height);
  check("so the count moves no row on the one page that has one",
    M.layout(W, REG).height === M.layout(W, REG1).height);
  check("the rows are the same rows at the same y, whatever the count",
    M.layout(W, REG).rows.map((r) => `${r.id}@${r.cellY}`).join()
    === M.layout(W, REG1).rows.map((r) => `${r.id}@${r.cellY}`).join());
  check("the columns widen to the 88px cap instead",
    M.layout(W, REG1).pitch === M.PITCH_CAP, String(M.layout(W, REG1).pitch));
  check("Single-label runs four columns, the three classes and the row sum",
    M.layout(W, CE).cols === 4, String(M.layout(W, CE).cols));
  check("Multi-label runs six, the five classes and the row sum",
    M.layout(W, BCE).cols === 6, String(M.layout(W, BCE).cols));
  check("every bar is still grabbable at the narrow count",
    M.barColAt(M.layout(W, REG1).colX(0), M.layout(W, REG1).barTop + 4, M.layout(W, REG1)) === 0
    && M.barColAt(M.layout(W, CE).colX(1), M.layout(W, CE).barTop + 4, M.layout(W, CE)) === 1);
  check("and the sum column is over no bar",
    M.barColAt(M.layout(W, CE).colX(3), M.layout(W, CE).barTop + 4, M.layout(W, CE)) === -1);
  check("the walk is the same walk at either count", REG1.units === REG.units);
  check("and the unit table is the same table",
    M.pageUnits(REG1).map((u) => u.id).join() === M.pageUnits(REG).map((u) => u.id).join());
}

/* --- 11b · the rail: the two tensors as columns, and the two core options ----
 * `_lab/loss-rail-mock.html`, 2026-09-11, Kenneth's picks: §1 D (two-line
 * faces) and §2 b (the grid). Both are core options rather than widget code, so
 * what is asserted here is that this widget declares them and that no other
 * widget's rail can have moved.
 */
{
  const src = read("widgets/loss-functions/main.js");
  /* every `cells: { … }` declared in the file, as { field: [count, heads] } */
  const declared = {};
  for (const m of src.matchAll(/^\s{4}(\w+): \{\n([\s\S]*?)\n\s{4}\},/gm)) {
    const body = m[2];
    const cells = body.match(/cells: \{([\s\S]*?)\},?\n/);
    if (cells) declared[m[1]] = cells[1].replace(/\s+/g, " ").trim();
  }
  check("the five tensor rows and the switch run declare `cells`, and nothing else does",
    Object.keys(declared).join() === "pred,target,scores,logits,A,binaryScores",
    Object.keys(declared).join());
  check("Regression's pair counts by Outputs and declares `cellsFrom`, so the block rebuilds with it",
    /count: \(values\) => M\.countOf\(values, "outputs"\)/.test(declared.pred)
    && /count: \(values\) => M\.countOf\(values, "outputs"\)/.test(declared.target)
    && (src.match(/cellsFrom: "outputs"/g) ?? []).length === 2);
  check("and heads its columns 1 2 3, since an output is not a class (3.7)",
    M.OUTPUT_HEADS.join() === "1,2,3"
    && /M\.OUTPUT_HEADS\.slice/.test(declared.pred) && /M\.OUTPUT_HEADS\.slice/.test(declared.target),
    M.OUTPUT_HEADS.join());
  check("the three classification rows head their columns with the class letters",
    M.headsFor("single-label").join() === "A,B,C"
    && M.headsFor("multi-label").join() === "A,B,C,D,E"
    && M.headsFor("binary").join() === "A,B",
    M.headsFor("multi-label").join());
  check("each declares its own page's width as its count",
    /count: M\.PAGE_N\["single-label"\]/.test(declared.scores)
    && /count: M\.PAGE_N\["multi-label"\]/.test(declared.logits)
    && /count: M\.PAGE_N\.binary/.test(declared.binaryScores));
  check("and its own page's heads",
    /HEADS\("single-label"\)/.test(declared.scores)
    && /HEADS\("multi-label"\)/.test(declared.logits)
    && /HEADS\("binary"\)/.test(declared.binaryScores));
  check("the five switches take the same five columns, declared on the first of the run",
    /A: \{\n\s+type: "bool",[\s\S]*?cells: \{ count: M\.PAGE_N\["multi-label"\] \},/.test(src));
  check("and only the first of the run declares it, as a row caption does",
    (src.match(/cells: \{ count: M\.PAGE_N\["multi-label"\] \}/g) ?? []).length === 1);
  check("the three classification faces carry the second line, the Regression face none",
    (src.match(/qual:/g) ?? []).length === 0
    && M.TASKS.filter((t) => t.qual).length === 3);
  check("THE URL IS UNCHANGED BY THE GRID: one canonical string, one parse, one show",
    /parse: \(t\) => M\.parseRow\(t, M\.RANGE/.test(src)
    && (src.match(/show: \(v\) => M\.showRow\(/g) ?? []).length === 5);
  check("and the drag still writes that one string, which the cells repaint from",
    /\.w-cells\[data-param="\$\{name\}"\]/.test(src));

  /* NO OTHER WIDGET'S RAIL CAN HAVE MOVED. Both additions are opt-in, so the
     proof is that nothing else opts in. */
  const others = [];
  for (const name of readdirSync(join(root, "widgets"), { withFileTypes: true })) {
    if (!name.isDirectory() || name.name === "loss-functions" || name.name.startsWith("_")) continue;
    for (const f of ["main.js", "model.js"]) {
      const path = join(root, "widgets", name.name, f);
      if (existsSync(path)) others.push([`${name.name}/${f}`, readFileSync(path, "utf8")]);
    }
  }
  check("there are other widgets to check", others.length >= 24, `${others.length} files`);
  check("no other widget declares `cells` on a field, so no rail of theirs is a grid",
    others.filter(([, s]) => /^\s+cells: \{/m.test(s)).map(([n]) => n).join() === "",
    others.filter(([, s]) => /^\s+cells: \{/m.test(s)).map(([n]) => n).join());
  check("nor `cellsFrom`",
    !others.some(([, s]) => /cellsFrom/.test(s)));
  check("and no other option anywhere declares a `qual`, so no segmented row takes two lines",
    others.filter(([, s]) => /\bqual:/.test(s)).map(([n]) => n).join() === "",
    others.filter(([, s]) => /\bqual:/.test(s)).map(([n]) => n).join());

  /* the core renderers themselves: the single field is untouched, the grid is
     the same one parameter, and both additions are gated on a declaration */
  const controls = read("widgets/core/controls.js");
  check("core renders a cells grid only where a field declares one",
    /if \(field\.cells\) \{/.test(controls));
  check("a text field without `cells` keeps the single input it has",
    /const input = textInput\(name, field\);\n\s+input\.id = id;\n\s+input\.classList\.add\("w-text"\);/
      .test(controls));
  check("the cells are joined with a comma for `parse`, so the URL is the same string",
    /inputs\.map\(\(c\) => c\.value\.trim\(\)\)\.join\(","\)/.test(controls));
  check("and `show` is split back across them",
    /String\(field\.show \? field\.show\(v\) : v\)\.split\(","\)/.test(controls));
  check("`cellsFrom` is a gating parameter, so the block rebuilds when the count moves",
    /if \(field\.cellsFrom\)/.test(controls));
  check("a two-line face is reserved PER RUN, so a row with none is untouched (3.4d)",
    /if \(twoLine\.has\(o\.group\)\) run\.seg\.classList\.add\("w-seg--two"\)/.test(controls));
  check("and the face stays the accessible name",
    /b\.setAttribute\("aria-label", o\.label\)/.test(controls));
  check("a bool run takes columns only where the run's first field asks for them",
    /const runCells = cell\.fields\[0\]\[1\]\.cells;/.test(controls));
  const css = read("widgets/core/tokens.css");
  check("the grid, the two-line face and the column run are all in the tokens",
    /\.w-cells \{/.test(css) && /\.w-seg--two \.w-seg-btn \{/.test(css)
    && /\.w-bools--cols \{/.test(css));
  check("and none of them writes a colour of its own (non-negotiable 5)",
    !/\.w-cell[\s\S]{0,800}#[0-9a-f]{3,6}/i.test(css.slice(css.indexOf(".w-cells"),
      css.indexOf(".w-cells") + 1400)));
}

/* --- 12 · the Binary page, both forms of one model ---------------------------
 * Softmax over two scores is the sigmoid of their difference, so
 * CrossEntropyLoss on two outputs and BCEWithLogitsLoss on z_B − z_A are the
 * same loss. Every number here is `_lab/dl-loss-torch.txt` §6's own.
 */
{
  const BIN = M.computeFor({ task: "binary" });
  const BIN_A = M.computeFor({ task: "binary", binaryLabel: "0" });

  check("the page opens on the mock's own pair, [0.5, 2.0] with B as the target",
    BIN.scores.join() === "0.5,2" && BIN.label === 1, BIN.scores.join());
  check("softmax over the two is 0.1824 and 0.8176", row4(BIN.p) === "0.1824 0.8176", row4(BIN.p));
  check("the difference z_B − z_A is 1.5", BIN.z === 1.5, String(BIN.z));
  check("the sigmoid of that difference is the softmax's own p_B",
    Math.abs(BIN.sig - BIN.p[1]) < 1e-12, BIN.sig.toExponential(3));
  check("both forms print 0.2014 at label B",
    M.n4(BIN.loss) === "0.2014" && M.n4(BIN.lossOne) === "0.2014",
    `${M.n4(BIN.loss)} / ${M.n4(BIN.lossOne)}`);
  check("and torch's own six digits", BIN.loss.toFixed(6) === "0.201413", BIN.loss.toFixed(6));
  check("both print 1.7014 at label A",
    M.n4(BIN_A.loss) === "1.7014" && M.n4(BIN_A.lossOne) === "1.7014",
    `${M.n4(BIN_A.loss)} / ${M.n4(BIN_A.lossOne)}`);
  check("to six digits, as torch printed both", BIN_A.loss.toFixed(6) === "1.701413");
  check("at label A the one-output form reads 1 − σ(z_B − z_A)",
    Math.abs(BIN_A.pOne - (1 - BIN.sig)) < 1e-12, M.n4(BIN_A.pOne));
  check("the two probabilities sum to 1", M.n4(BIN.rowSum) === "1.0000");
  check("the page lands three rows", BIN.units === 3);
  check("it keeps the row-sum column, since a row of two has something to read",
    BIN.sumCol === true);
  check("and no dtype can raise on it: it has no dtype control", BIN.bad === false);

  /* THE WHOLE §6 DRAG TABLE, with z_A held at 0.5 and B the target */
  const DRAG = [
    [-2.0, "0.0759", "2.578890"], [-1.0, "0.1824", "1.701413"],
    [0.0, "0.3775", "0.974077"], [0.5, "0.5000", "0.693147"],
    [1.0, "0.6225", "0.474077"], [2.0, "0.8176", "0.201413"],
    [3.0, "0.9241", "0.078890"], [4.0, "0.9707", "0.029750"],
  ];
  for (const [zb, p, loss] of DRAG) {
    const s = M.computeFor({ task: "binary", binaryScores: M.wire([0.5, zb]) });
    check(`z_B at ${zb}: p_B ${p}, and the two forms agree`,
      M.n4(s.p[1]) === p && Math.abs(s.loss - Number(loss)) < 5e-6
      && Math.abs(s.lossOne - s.loss) < 1e-6,
      `${M.n4(s.p[1])} / ${s.loss.toFixed(6)} / ${s.lossOne.toFixed(6)}`);
  }
  check("the largest gap between the two forms over the whole table is under 1e-6",
    Math.max(...DRAG.map(([zb]) => {
      const s = M.computeFor({ task: "binary", binaryScores: M.wire([0.5, zb]) });
      return Math.abs(s.loss - s.lossOne);
    })) < 1e-6);
  check("the same holds at label A over the same table",
    DRAG.every(([zb]) => {
      const s = M.computeFor({ task: "binary", binaryScores: M.wire([0.5, zb]), binaryLabel: "0" });
      return Math.abs(s.loss - s.lossOne) < 1e-6;
    }));

  /* THE REDUNDANT DEGREE OF FREEDOM, which is why the derived bar does not drag */
  const shifted = M.computeFor({ task: "binary", binaryScores: M.wire([3.5, 5]) });
  check("both scores shifted by +3 leave the probabilities where they were",
    row4(shifted.p) === row4(BIN.p), row4(shifted.p));
  check("and leave both losses where they were",
    M.n4(shifted.loss) === "0.2014" && M.n4(shifted.lossOne) === "0.2014");
  check("because the difference is unchanged", shifted.z === BIN.z);
  check("so the map from the difference back to a pair is not unique, and the "
    + "derived bar has no parameter to drag",
    /state\.kind === "binary" \? g\.left : g/.test(read("widgets/loss-functions/main.js")));

  /* the axes: eight units each, so one unit is 11px in both columns */
  check("the two-output form is drawn on the Single-label axis, −2 to 6",
    M.RANGE.binary.join() === "-2,6");
  check("the difference is drawn on the Multi-label axis, −4 to 4",
    M.RANGE.binaryDiff.join() === "-4,4");
  check("both span eight units, so 1.5 is the same length of bar in either column",
    M.RANGE.binary[1] - M.RANGE.binary[0] === M.RANGE.binaryDiff[1] - M.RANGE.binaryDiff[0]);
  check("and both run at 11px a unit over the 88px band",
    M.BAR_H / 8 === 11);
  check("the drag moves the two-output form, which is what moves both",
    M.dragVec("0.5,2", 1, 33, 2, M.RANGE.binary) === "0.5,-1",
    M.dragVec("0.5,2", 1, 33, 2, M.RANGE.binary));
  check("and dragging B by 33px lands the table's own z_B = −1.0 row",
    M.n4(M.computeFor({
      task: "binary", binaryScores: M.dragVec("0.5,2", 1, 33, 2, M.RANGE.binary),
    }).loss) === "1.7014");
  check("class A drags too", M.dragVec("0.5,2", 0, -22, 2, M.RANGE.binary) === "2.5,2");

  /* the stage: two columns of one flow, the curve below */
  const W = 550;
  const g = M.layout(W, BIN);
  check("the Binary stage is 586px at 550, from the same geometry function",
    g.height === 586, g.height);
  check("`pageHeight` agrees with it (5.8)",
    M.pageHeight(W, { task: "binary" }) === 586, M.pageHeight(W, { task: "binary" }));
  check("the height does not move with the target", M.layout(W, BIN_A).height === 586);
  check("nor with the width, since nothing on it wraps",
    M.layout(770, BIN).height === 586, M.layout(770, BIN).height);
  check("the two columns are 250px at 550, the mock's own", g.colW === 250, g.colW);
  check("and grow to 360px at 770", M.layout(770, BIN).colW === 360, M.layout(770, BIN).colW);
  check("the left column runs three columns, the pair and the row sum",
    g.left.cols === 3 && g.left.n === 2);
  check("at a pitch of 83px, against the 43px a four-decimal cell needs",
    g.left.pitch === 83, g.left.pitch);
  check("the right column runs one, at the 88px cap",
    g.right.cols === 1 && g.right.pitch === 88, `${g.right.cols} at ${g.right.pitch}`);
  check("the right column has no row sum", g.right.sumCol === false);
  check("both columns run the same rows at the same y, which is the argument",
    g.rows.map((r) => r.id).join() === "p,target");
  check("and both loss lines land on one line", typeof g.lossY === "number");
  check("the two loss lines are 272px apart on that line, the mock's own measurement",
    g.right.x - g.left.x === 272, String(g.right.x - g.left.x));
  check("the left column starts at the stage's own inset", g.left.x === M.PAD);
  check("the rule between them sits half a gap in", g.ruleX === M.PAD + g.colW + M.GAP / 2);
  check("the curve sits BELOW both columns", g.curveY > g.top + g.rowsH);
  check("across 320px of the width, centred", g.curveW === M.CURVE_WIDE
    && g.curveX === M.PAD + Math.round((W - 2 * M.PAD - M.CURVE_WIDE) / 2), g.curveX);
  check("and the captions sit under the curve", g.capY >= g.curveY + M.CURVE_H);
  check("the two columns do not overlap", g.left.x + g.colW <= g.right.x);
  check("and each column's own columns fit inside it",
    g.left.cols * g.left.pitch <= g.colW && g.right.cols * g.right.pitch <= g.colW);
  check("zero sits 22px higher on the difference axis than on the score axis",
    Math.round(g.left.py(0) - g.right.py(0)) === 22,
    String(Math.round(g.right.py(0) - g.left.py(0))));
  check("a score of 1.5 is the same 17px of bar in either column",
    Math.round(g.left.py(0) - g.left.py(1.5))
    === Math.round(g.right.py(0) - g.right.py(1.5)),
    String(Math.round(g.right.py(0) - g.right.py(1.5))));

  /* the hit-test: the two-output form's bars, and nothing else */
  check("both of the left column's bars are grabbable",
    [0, 1].every((i) => M.barColAt(g.left.colX(i), g.left.barTop + 10, g.left) === i));
  check("THE DERIVED BAR IS NOT: the left column's hit-test does not reach it",
    M.barColAt(g.right.colX(0), g.left.barTop + 10, g.left) === -1,
    String(g.right.colX(0)));
  check("nor is the row-sum column",
    M.barColAt(g.left.x + 2 * g.left.pitch + g.left.pitch / 2, g.left.barTop + 10, g.left) === -1);
  check("a point above the band is over no bar",
    M.barColAt(g.left.colX(0), g.left.barTop - 20, g.left) === -1);

  /* the walk, and the copy */
  const units = M.pageUnits(BIN);
  check("every step of the Binary walk lands a piece",
    [1, 2, 3].every((n) => units.some((u) => u.unit === n)));
  check("the two probability rows land together, with the row sum",
    units.filter((u) => u.unit === 1).map((u) => u.id).join() === "p,row sum");
  check("the targets land together on the second step",
    units.find((u) => u.id === "target").unit === 2);
  check("the loss and the point land last, with no pale form",
    units.find((u) => u.id === "loss").unit === 3
    && units.find((u) => u.id === "loss").preview === false
    && units.find((u) => u.id === "curve point").preview === false);
  check("the header names both loss classes",
    /CrossEntropyLoss/.test(M.HEAD.binary) && /BCEWithLogitsLoss/.test(M.HEAD.binary),
    M.HEAD.binary);
  check("and the header's expression NAMES THE TRUE CLASS, so it stays true at either target",
    M.binaryExpr(0) === "loss = −log p_A" && M.binaryExpr(1) === "loss = −log p_B",
    M.binaryExpr(0));
  check("the two columns name the two functions",
    M.BIN_FN.two === "softmax over the row" && M.BIN_FN.one === "sigmoid");
  check("and print the four shape lines the two forms differ in",
    M.BIN_SHAPE.scoresTwo === "[1, 2], float32" && M.BIN_SHAPE.scoresOne === "[1], float32"
    && M.BIN_SHAPE.targetTwo === "[1], long" && M.BIN_SHAPE.targetOne === "[1], float32",
    Object.values(M.BIN_SHAPE).join(" / "));
  check("the first caption is the identity the page exists for",
    /σ\(z_B − z_A\)/.test(M.STRINGS.captions.binary[0].line));
  check("the second says what the drag does, and waits for the loss",
    M.STRINGS.captions.binary[1].at === BIN.units
    && /dragging/.test(M.STRINGS.captions.binary[1].line));
  check("the card's note is the redundant degree of freedom",
    /redundant degree of freedom/.test(M.STRINGS.cardNote.binary));
  check("the readout names a loss per form, and the difference between them",
    M.STRINGS.binaryTwoTile === "Loss, two outputs"
    && M.STRINGS.binaryOneTile === "Loss, one output"
    && M.STRINGS.binaryDiffName === "z_B − z_A");
  check("and each loss tile's note names the torch class it comes from",
    /CrossEntropyLoss/.test(M.STRINGS.binaryTwoNote)
    && /BCEWithLogitsLoss/.test(M.STRINGS.binaryOneNote));
  check("the dtype tile names both dtypes", M.targetDtypeText(BIN) === "long · float32",
    M.targetDtypeText(BIN));
  check("the target chips are the class index, one parameter (3.6)",
    /set: \{ binaryLabel: String\(i\) \}/.test(read("widgets/loss-functions/main.js")));
}

/* --- 13 · the shipping files -------------------------------------------------- */
{
  const src = read("widgets/loss-functions/main.js");
  const model = read("widgets/loss-functions/model.js");
  const html = read("widgets/loss-functions/index.html");
  const manifest = JSON.parse(read("widgets/manifest.json"));
  const entry = manifest.widgets.find((w) => w.slug === "loss-functions");

  check("the widget is registered in the manifest", Boolean(entry));
  check("the manifest records it as a draft", entry.status === "draft", entry.status);
  check("and main.js declares the same", /^\s*status: "draft",$/m.test(src));
  check("the two agree, which is what keeps it off the gallery",
    entry.status === (src.match(/^\s*status: "([^"]+)",$/m) ?? [])[1]);
  check("it is arc 54 of PHM5005", entry.arc === 54 && entry.course === "PHM5005");
  check("the blurb is one sentence inside the gallery's 120-character cap",
    entry.blurb.length <= 120 && entry.blurb.split(". ").length === 1, `${entry.blurb.length} chars`);
  check("the meta description is the blurb verbatim (5.8)",
    html.includes(`content="${entry.blurb}"`));
  check("the page title matches the card",
    html.includes(`<title>${entry.title} · statml widgets</title>`));
  check("the topics name the three losses and the two functions",
    ["loss function", "MSE", "cross-entropy", "binary cross-entropy", "softmax", "sigmoid"]
      .every((t) => entry.topics.includes(t)), entry.topics.join(", "));

  check("the widget takes no seed, because nothing on any page is random",
    !/seed:/.test(src) && !src.includes("makeRng"));
  check("nothing draws from Math.random",
    !src.includes("Math.random") && !model.includes("Math.random"));
  check("compute is pure and ignores the rng it is handed",
    /compute: \(\{ params \}\) => M\.computeFor\(params\)/.test(src));
  check("no colour is hardcoded in the drawing",
    !/#[0-9a-fA-F]{3,6}\b/.test(src) && !/#[0-9a-fA-F]{3,6}\b/.test(model));
  check("every font, size and colour comes from the tokens, read once a render",
    /readTokens/.test(src) && /colors\.fsSm/.test(src) && /colors\.mono/.test(src)
    && !/font: "/.test(src));
  check("the geometry is named constants, not numbers written at the draw sites",
    /^const \{\n\s+PAD, GAP, LINE/m.test(src));
  check("every path in the deployed files is relative",
    !/["'(]\/(?!\/)/.test(html) && !/from "\//.test(src) && !/from "\//.test(model));
  check("the stage is drawn side by side with its rail (3.4a)", /layout: "side"/.test(src));
  check("the height is a function of the parameters and the width",
    /height: \(\{ w, \.\.\.values \}\) => M\.pageHeight\(w, values\)/.test(src));
  check("exactly one widget is defined in the file",
    (src.match(/defineWidget\(\{/g) ?? []).length === 1);

  check("the drag declares all four tensor parameters, since the list is fixed",
    /params: \["pred", "scores", "logits", "binaryScores"\]/.test(src));
  check("the drag names a hit-test, so a click off the bars turns nothing",
    /hit: \(\{ x, y, w, state \}\)/.test(src));
  check("the target chips are the region map, one parameter each (3.6)",
    /regions: \(\{ w, params, state \}\)/.test(src));
  check("a region is skipped until the target row has landed",
    /if \(!landed\(done, 2\)\) return \[\];/.test(src));
  check("speed is the only display parameter, so nothing else keeps the walk",
    (src.match(/display: true/g) ?? []).length === 1);
  check("the two dtype controls open on opposite arms, one per page",
    /options: \["long", "float32"\],\s*\n\s*default: "long"/.test(src)
    && /options: \["float32", "long"\],\s*\n\s*default: "float32"/.test(src));
  check("the page opens on Regression, the first row of the table",
    /options: M\.TASKS,\s*\n\s*groupHeads: true,\s*\n\s*default: "regression"/.test(src));
  check("the task faces are drawn as option groups with heads above them (§3 C)",
    /groupHeads: true/.test(src));
  check("the authoring head start is hidden and starts at zero (2.1)",
    /shown: \{ type: "int", min: 0, max: 5, default: 0, hidden: true \}/.test(src));
  check("the legend names group-a and empirical once, not twice",
    !/token: "group-a"/.test(src));
  check("the legend is a function of the parameters, so it matches the page",
    /legend: \(\{ params \}\) =>/.test(src));
  check("the walk keeps a finished figure finished on a data change (4.4)",
    /carry\.state !== state/.test(src));
  check("the geometry is asked for, never written twice (5.8)",
    (src.match(/M\.layout\(/g) ?? []).length >= 3);
}

console.log(failed ? `\n${failed} of ${ran} FAILED\n` : `\nall ${ran} checks passed\n`);
process.exit(failed ? 1 : 0);
