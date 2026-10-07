/* qc-drift — slot 91, "Metabolomics: QC and Drift". DRAFT 2026-10-08.
 *
 * Planned in the catalogue's § The proteomics and metabolomics arc and
 * § Slot 91: measured in `_lab/proteomics-arc-measure.mjs`, mocked in
 * `_lab/proteomics-arc-mock.html` and `_lab/qc-drift-mock.html`; his seven
 * calls all the recommendation. The misconception: per-sample normalization
 * corrects instrument drift — each metabolite drifts its own way along the
 * injection order, only a curve through pooled QCs follows it, and a run made
 * in group order turns drift into a group difference.
 *   1. two pages, Drift · Correction, under a control named Step;
 *   2. 02-4's comparison, Prostatic hyperplasia vs Prostate cancer, 52 + 52,
 *      26 metabolites with MTBLS6038's names, simulated (no QCs in the lesson);
 *   3. Drift: one metabolite against injection order; below, every
 *      metabolite's QCs centred, and the per-injection median across them in
 *      bold — the one curve median normalization removes; an Inject press, an
 *      injection a beat;
 *   4. Correction: the metabolite with the curve the correction removes, then
 *      every value moved by it (a Correct press); below, all 26 differences in
 *      rows None · Median · QC-LOESS. "None" is the page before the press, so
 *      the Correction control offers Median (02-3's choice, the default) and
 *      QC-LOESS with its span;
 *   5. Run order Random (default) · Grouped and QC every 5 · 10 are data;
 *      the example metabolite is the one not truly different with the most
 *      drift, any of the 26 from a dropdown, or a click;
 *   6. True values Off · On: the true drift, the true differences, and the
 *      drift left in the study samples.
 * The press clock is 90's: stages per page, a page switch mid-press finishes it.
 */
import { defineWidget, mathmlRenders } from "../core/index.js";
import * as E from "./engine.js";

const TYPICAL_SEED = 84;            // measured over 100 seeds (scratch qcd-seed.mjs): nearest the means, grouped and random
const H_DRIFT = 452, H_CORR = 418;
const INJECT_MS = 45;               // one injection a beat: about six seconds for the run
const CORRECT_MS = 2000;            // the curve held for the first 30%, then every value moves
const EASE_MS = 900;                // a Correction or Span change after the press
const RIGHT = 20, X0 = 56;

const slugOf = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const MET_OPTIONS = [
  { value: "most-drift", label: "Most drift (not truly different)" },
  ...E.METABOLITES.map((n) => ({ value: slugOf(n), label: n, group: "Metabolites" })),
];
const f1 = (v) => v.toFixed(1), f3 = (v) => v.toFixed(3);
const sg = (x, d = 2) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(d)}`;
const pFmt = (p) => (p < 0.001 ? p.toExponential(1).replace("e-", "e−") : p.toFixed(3));
const pct = (v) => `${(100 * v).toFixed(1)}%`;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const corrKey = (p) => (p.correction === "median" ? "median" : `qc-loess-${p.span}`);
const CORR_NAME = { median: "Median", "qc-loess-0.3": "QC-LOESS, span 0.3", "qc-loess-0.75": "QC-LOESS, span 0.75" };

/* ------------------------------------------------------------ the press clock (90's) */
const STAGES = { drift: 1, correction: 1 };
function settle(anim, page) {
  const max = STAGES[page], n = anim.n[page] ?? 0;
  anim.inert = max === 0;
  anim.done = n >= max && anim.p >= 1;
  anim.labelAt = `${page}${anim.done ? "done" : n}`;
}
const stageMs = (page, state) => (page === "drift" ? state.run.N * INJECT_MS : CORRECT_MS);
function stageOf(page, params, anim) {
  if (!anim) return { s: Math.min(1, Number(params.shown) || 0), p: 1 };
  const s = anim.n[page] ?? 0;
  return { s, p: anim.n[page] >= 1 && anim.page === page && anim.p < 1 ? anim.p : 1 };
}

/* ------------------------------------------------------------ drawing helpers */
function txt(ctx, colors, s, x, y, { size = "fsSm", colour = colors.ink2, align = "left", weight = "", mono = false } = {}) {
  ctx.font = `${weight ? weight + " " : ""}${colors[size] ?? size} ${mono ? colors.mono : colors.font}`;
  ctx.fillStyle = colour; ctx.textAlign = align; ctx.textBaseline = "alphabetic";
  ctx.fillText(s, x, y);
}
function rule(ctx, x1, y1, x2, y2, colour, width = 1, dash = null) {
  ctx.save(); ctx.strokeStyle = colour; ctx.lineWidth = width; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}
function poly(ctx, xs, ys, colour, width = 1.5, dash = null, alpha = 1) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = colour; ctx.lineWidth = width; ctx.lineJoin = "round"; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); xs.forEach((x, i) => (i ? ctx.lineTo(x, ys[i]) : ctx.moveTo(x, ys[i]))); ctx.stroke(); ctx.restore();
}
function dot(ctx, x, y, r, fill, stroke = null, lw = 1) {
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  ctx.restore();
}
function square(ctx, x, y, s, fill) { ctx.fillStyle = fill; ctx.fillRect(x - s / 2, y - s / 2, s, s); }

/* the run against injection order: points from `val(i)`, the first `upTo` injections */
function runPanel(ctx, colors, state, m, P, { val, upTo, curve = null, curveColour = null, truthLine = null }) {
  const { run } = state, { N, inj } = run;
  const sx = (i) => P.x0 + (i / (N - 1)) * (P.x1 - P.x0);
  const sy = (v) => P.y1 - ((v - P.lo) / (P.hi - P.lo)) * (P.y1 - P.y0);
  rule(ctx, P.x0, P.y1, P.x1, P.y1, colors.axis); rule(ctx, P.x0, P.y0, P.x0, P.y1, colors.axis);
  for (let t = 0; t < N; t += 25) { rule(ctx, sx(t), P.y1, sx(t), P.y1 + 4, colors.axis); txt(ctx, colors, String(t + 1), sx(t), P.y1 + 16, { size: "fsXs", colour: colors.ink3, align: "center" }); }
  for (let v = Math.ceil(P.lo); v <= P.hi; v += 1) { rule(ctx, P.x0 - 4, sy(v), P.x0, sy(v), colors.axis); txt(ctx, colors, String(v), P.x0 - 6, sy(v) + 4, { size: "fsXs", colour: colors.ink3, align: "right" }); }
  txt(ctx, colors, "log2", P.x0 - 6, P.y0 - 8, { size: "fsXs", colour: colors.ink3, align: "right" });
  if (truthLine) poly(ctx, inj.map((_, i) => sx(i)), truthLine.map(sy), colors.theory, 1.5, [4, 3]);
  for (let i = 0; i < Math.min(upTo, N); i += 1) if (inj[i].kind !== "QC") dot(ctx, sx(i), sy(val(i)), 2.6, inj[i].kind === "A" ? colors.groupA : colors.groupB);
  for (let i = 0; i < Math.min(upTo, N); i += 1) if (inj[i].kind === "QC") square(ctx, sx(i), sy(val(i)), 7, colors.reference);
  if (curve) poly(ctx, inj.map((_, i) => sx(i)), curve.map(sy), curveColour, 2.4);
  return { sx, sy };
}
function groupKey(ctx, colors, x, y, truth) {
  const items = [["Prostatic hyperplasia", colors.groupA, "dot"], ["Prostate cancer", colors.groupB, "dot"], ["pooled QC", colors.reference, "square"]];
  if (truth) items.push(["true drift", colors.theory, "dash"]);
  let kx = x;
  for (const [t, c, mk] of items) {
    if (mk === "dot") dot(ctx, kx + 4, y - 4, 3.2, c); else if (mk === "square") square(ctx, kx + 4, y - 4, 7, c); else rule(ctx, kx, y - 4, kx + 12, y - 4, c, 1.5, [4, 3]);
    txt(ctx, colors, t, kx + 14, y, { size: "fsXs", colour: colors.ink2 });
    ctx.font = `${colors.fsXs} ${colors.font}`;
    kx += 14 + ctx.measureText(t).width + 16;
  }
}

/* ------------------------------------------------------------ geometry */
const driftLayout = (w) => ({ top: { x0: X0, x1: w - RIGHT, y0: 44, y1: 226 }, key: 256, qc: { x0: X0, x1: w - RIGHT, y0: 296, y1: 404 }, axis: 438 });
const corrLayout = (w) => ({ top: { x0: X0, x1: w - RIGHT, y0: 44, y1: 214 }, axis: 252, strips: { x0: 20, x1: w - RIGHT, top: 290, step: 30 } });
const ROWS = ["none", "median", "qc-loess"];
const stripX = (S, v) => S.x0 + 96 + ((Math.max(-1.5, Math.min(1.5, v)) + 1.5) / 3) * (S.x1 - S.x0 - 106);

/* ------------------------------------------------------------ the Drift page */
function drawDrift(ctx, colors, w, params, state, anim) {
  const L = driftLayout(w), { run } = state, m = resolveMet(params, state);
  const { s, p } = stageOf("drift", params, anim);
  const upTo = s >= 1 ? Math.floor(p * run.N) + (p >= 1 ? 0 : 1) : 0;
  const truth = params.truth === "on";
  txt(ctx, colors, `${E.METABOLITES[m]}: each injection, in run order`, 12, 20, { colour: colors.ink1, weight: "600" });
  const P = { ...L.top, lo: state.range[m][0], hi: state.range[m][1] };
  runPanel(ctx, colors, state, m, P, {
    val: (i) => run.X[m][i], upTo,
    truthLine: truth ? run.inj.map((_, i) => run.mets[m].base + run.drift[m][i]) : null,
  });
  groupKey(ctx, colors, X0, L.key, truth);

  // every metabolite's QCs, centred; the per-injection median across all 26 in bold
  const Q = L.qc, qc = run.qcIdx.filter((i) => i < upTo);
  const sx = (i) => Q.x0 + (i / (run.N - 1)) * (Q.x1 - Q.x0);
  const sy = (v) => Q.y1 - ((Math.max(-1.3, Math.min(1.3, v)) + 1.3) / 2.6) * (Q.y1 - Q.y0);
  txt(ctx, colors, "Every metabolite's pooled QCs, each centred on its own mean", 12, Q.y0 - 14, { colour: colors.ink1, weight: "600" });
  rule(ctx, Q.x0, Q.y1, Q.x1, Q.y1, colors.axis); rule(ctx, Q.x0, Q.y0, Q.x0, Q.y1, colors.axis);
  for (const v of [-1, 0, 1]) { rule(ctx, Q.x0 - 4, sy(v), Q.x0, sy(v), colors.axis); txt(ctx, colors, v === 0 ? "0" : sg(v, 0), Q.x0 - 6, sy(v) + 4, { size: "fsXs", colour: colors.ink3, align: "right" }); }
  for (let t = 0; t < run.N; t += 25) { rule(ctx, sx(t), Q.y1, sx(t), Q.y1 + 4, colors.axis); txt(ctx, colors, String(t + 1), sx(t), Q.y1 + 16, { size: "fsXs", colour: colors.ink3, align: "center" }); }
  if (qc.length) {
    state.qcCentred.forEach((c, k) => { if (k !== m) poly(ctx, qc.map(sx), qc.map((i) => sy(c[i])), colors.ink3, 1, null, 0.45); });
    poly(ctx, qc.map(sx), qc.map((i) => sy(state.qcCentred[m][i])), colors.ink1, 1.6);
    poly(ctx, qc.map(sx), qc.map((i) => sy(state.medianCentred[i])), colors.highlight, 3);
    txt(ctx, colors, "median across the 26", Q.x1 - 4, Q.y0 + 10, { size: "fsXs", colour: colors.highlight, weight: "600", align: "right" });
    txt(ctx, colors, E.METABOLITES[m], Q.x0 + 6, Q.y0 + 10, { size: "fsXs", colour: colors.ink1, weight: "600" });
  }
  txt(ctx, colors, "injection order", (X0 + w - RIGHT) / 2, L.axis, { size: "fsXs", colour: colors.ink3, align: "center" });
}

/* ------------------------------------------------------------ the Correction page */
function drawCorrection(ctx, colors, w, params, state, anim) {
  const L = corrLayout(w), { run } = state, m = resolveMet(params, state);
  const { s, p } = stageOf("correction", params, anim);
  const truth = params.truth === "on";
  // which correction is on screen, and how far an ease between two has gone
  const to = corrKey(params), ease = anim && anim.cor.t < 1 ? { from: anim.cor.from, e: easeInOut(anim.cor.t) } : null;
  const C = (k) => state.corr[k];
  const mix = (a, b, e) => a.map((v, i) => v + (b[i] - v) * e);
  const curveNow = ease ? mix(C(ease.from).curve[m], C(to).curve[m], ease.e) : C(to).curve[m];
  const Yto = ease ? mix(C(ease.from).Y[m], C(to).Y[m], ease.e) : C(to).Y[m];
  // the press: the curve held, then every value moved by it
  const moved = s < 1 ? 0 : p < 0.3 ? 0 : easeInOut((p - 0.3) / 0.7);
  const val = (i) => run.X[m][i] + (Yto[i] - run.X[m][i]) * moved;
  const curveColour = (ease ? (moved >= 1 && ease.e < 0.5 ? ease.from : to) : to) === "median" ? colors.highlight : colors.smoothed;
  const label = s < 1 ? "as measured" : moved >= 1 ? `after ${CORR_NAME[to]}` : `as measured, the curve ${CORR_NAME[to]} removes`;
  txt(ctx, colors, `${E.METABOLITES[m]}: ${label}`, 12, 20, { colour: colors.ink1, weight: "600" });
  const truthLine = truth ? run.inj.map((_, i) => { const free = run.mets[m].base + run.drift[m][i]; return free + (Yto[i] - run.X[m][i]) * moved; }) : null;
  // the curve shown while it is being applied: it moves with the values, flat once they land
  const curveLine = s >= 1 && moved < 1 ? curveNow.map((v, i) => v + (Yto[i] - run.X[m][i]) * moved) : null;
  runPanel(ctx, colors, state, m, { ...L.top, lo: state.range[m][0], hi: state.range[m][1] }, { val, upTo: run.N, curve: curveLine, curveColour, truthLine });
  txt(ctx, colors, "injection order", (X0 + w - RIGHT) / 2, L.axis, { size: "fsXs", colour: colors.ink3, align: "center" });

  // all 26: cancer − hyperplasia under each correction; the corrections' rows appear when the press lands
  const S = L.strips;
  txt(ctx, colors, "All 26 metabolites: cancer − hyperplasia, log2 (medians)", 12, S.top - 14, { colour: colors.ink1, weight: "600" });
  const rowKeys = { none: "none", median: "median", "qc-loess": `qc-loess-${params.span}` };
  const rowName = { none: "None", median: "Median", "qc-loess": "QC-LOESS" };
  ROWS.forEach((r, k) => {
    const y = S.top + 10 + k * S.step;
    const shown = r === "none" || (s >= 1 && moved >= 1);
    const sel = s >= 1 && moved >= 1 && rowKeys[r] === to;
    txt(ctx, colors, rowName[r], S.x0 + 88, y + 4, { size: "fsXs", colour: shown ? colors.ink1 : colors.ink3, weight: sel ? "700" : "500", align: "right" });
    rule(ctx, stripX(S, -1.5), y, stripX(S, 1.5), y, colors.grid);
    rule(ctx, stripX(S, 0), y - 9, stripX(S, 0), y + 9, colors.axis);
    if (!shown) return;
    const sc = state.scores[rowKeys[r]];
    if (truth) run.mets.forEach((mt) => { if (mt.real) rule(ctx, stripX(S, mt.fc), y - 9, stripX(S, mt.fc), y + 9, colors.reference, 1.5); });
    run.mets.forEach((_, j) => dot(ctx, stripX(S, sc.fc[j]), y, 3.4, sc.padj[j] < 0.05 ? colors.extreme : colors.ink3, j === m ? colors.ink1 : null, 1.6));
    txt(ctx, colors, `${sc.called} called`, S.x1, y - 10, { size: "fsXs", colour: colors.ink2, align: "right" });
  });
  const yT = S.top + 10 + ROWS.length * S.step - 6;
  for (const v of [-1, 0, 1]) txt(ctx, colors, v === 0 ? "0" : sg(v, 0), stripX(S, v), yT, { size: "fsXs", colour: colors.ink3, align: "center" });
}

/* ------------------------------------------------------------ the formula card */
const MATHML = mathmlRenders();
const Y_IJ = "<msub><mi>y</mi><mrow><mi>i</mi><mi>j</mi></mrow></msub>";
const YP_IJ = "<msubsup><mi>y</mi><mrow><mi>i</mi><mi>j</mi></mrow><mo>′</mo></msubsup>";
const FORMULAS = {
  drift: {
    math: "<math><mrow><mi>RSD</mi><mo>=</mo><mfrac><msub><mi>s</mi><mtext>QC</mtext></msub><msub><mover><mi>x</mi><mo>¯</mo></mover><mtext>QC</mtext></msub></mfrac><mo>×</mo><mn>100</mn><mo>%</mo></mrow></math>",
    plain: "RSD = s_QC / x̄_QC × 100%",
    note: "a pooled QC is the same material at every position in the run, so the spread of its values is the instrument's: x̄ and s are the mean and SD of one metabolite's QC values, on the linear scale",
  },
  median: {
    math: `<math><mrow>${YP_IJ}<mo>=</mo>${Y_IJ}<mo>−</mo><munder><mi>median</mi><mi>k</mi></munder><msub><mi>y</mi><mrow><mi>k</mi><mi>j</mi></mrow></msub><mo>+</mo><mi>c</mi></mrow></math>`,
    plain: "y′ij = yij − median_k ykj + c",
    note: "median normalization: injection j's median across all metabolites k is removed from every metabolite i, so only the drift every metabolite shares is removed; y is log2 and c keeps the level",
  },
  loess: {
    math: `<math><mrow>${YP_IJ}<mo>=</mo>${Y_IJ}<mo>−</mo><msub><mover><mi>f</mi><mo>^</mo></mover><mi>i</mi></msub><mo>(</mo><mi>j</mi><mo>)</mo><mo>+</mo><mi>c</mi></mrow></math>`,
    plain: "y′ij = yij − f̂i(j) + c",
    note: "QC-LOESS: f̂i is a LOESS curve through metabolite i's QC values against injection order j, its own curve for every metabolite; the span is the share of the QCs each local fit uses",
  },
};
let mathHost = null, mathKey = null;
function renderFormula(key) {
  if (!mathHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    mathHost = document.createElement("div");
    mathHost.className = "w-math";
    figure.parentNode.insertBefore(mathHost, figure);
  }
  if (mathKey === key) return;
  mathKey = key;
  const F = FORMULAS[key];
  mathHost.innerHTML = `<div class="w-math-eq"><span style="color:var(--ink-2)">${MATHML ? F.math : F.plain}</span></div><div class="w-math-note">${F.note}</div>`;
}

/* ------------------------------------------------------------ the example metabolite */
function resolveMet(params, state) {
  if (params.metabolite === "most-drift") return state.most;
  const k = E.METABOLITES.findIndex((n) => slugOf(n) === params.metabolite);
  return k >= 0 ? k : state.most;
}

/* ------------------------------------------------------------ the widget */
defineWidget({
  slug: "qc-drift",
  title: "Metabolomics: QC and Drift",
  subtitle:
    "Metabolite abundances drift along the injection order of an LC-MS run, and each metabolite drifts in its own way. "
    + "Pooled quality-control (QC) samples, the same material injected throughout the run, give the drift of each metabolite; "
    + "a curve fitted through them removes it, while normalizing each sample to its median removes only the drift shared by "
    + "all metabolites. In a run made in group order, uncorrected drift becomes a difference between the groups.",
  layout: "side",
  status: "draft",
  height: (p) => (p.page === "correction" ? H_CORR : H_DRIFT),

  params: {
    page: {
      role: "page", type: "segmented", label: "Step", display: true, default: "drift",
      options: [{ value: "drift", label: "Drift" }, { value: "correction", label: "Correction" }],
    },
    dataSec: { type: "section", label: "The run" },
    order: {
      type: "segmented", label: "Run order", default: "random",
      detail: "the sequence of the study samples between the QCs",
      options: [{ value: "random", label: "Random" }, { value: "grouped", label: "Grouped", detail: "all hyperplasia samples, then all cancer samples" }],
    },
    qc: {
      type: "segmented", label: "A pooled QC every", default: "5",
      detail: "study samples, and one at the start and the end of the run",
      options: [{ value: "5", label: "5" }, { value: "10", label: "10" }],
    },
    seed: { type: "int", label: "Seed", min: 1, max: 200, default: TYPICAL_SEED },
    corrSec: { type: "section", label: "The correction", when: { param: "page", equals: "correction" } },
    correction: {
      type: "segmented", label: "Correction", display: true, default: "median", when: { param: "page", equals: "correction" },
      options: [
        { value: "median", label: "Median", detail: "each injection's median across the metabolites, removed from all of them" },
        { value: "qc-loess", label: "QC-LOESS", detail: "a curve through each metabolite's QCs, removed from that metabolite" },
      ],
    },
    span: {
      type: "segmented", label: "Span", display: true, default: "0.3", when: { param: "correction", equals: "qc-loess" },
      detail: "the share of the QCs each local fit of the curve uses",
      options: [{ value: "0.3", label: "0.3" }, { value: "0.75", label: "0.75" }],
    },
    showSec: { type: "section", label: "Show" },
    metabolite: {
      type: "select", label: "Metabolite", display: true, default: "most-drift",
      detail: "the metabolite drawn above; a click on a QC trace or a dot below selects that metabolite",
      options: MET_OPTIONS,
    },
    truth: {
      type: "segmented", label: "True values", display: true, default: "off",
      detail: "the true drift and the true differences: known in a simulation, unknown in a measured data set",
      options: [{ value: "off", label: "Off" }, { value: "on", label: "On" }],
    },
    /* authoring escape hatch, first render only: 1 = the page's press finished */
    shown: { type: "int", min: 0, max: 1, default: 0, hidden: true },
  },

  legend: ({ params }) => {
    const truth = params.truth === "on";
    if (params.page === "correction") {
      return [
        { token: "group-a", label: "A prostatic hyperplasia sample", mark: "dot" },
        { token: "group-b", label: "A prostate cancer sample", mark: "dot" },
        { token: "reference", label: "A pooled QC: the same material at every position in the run", mark: "bar" },
        params.correction === "median"
          ? { token: "highlight", label: "The curve the correction removes: the median across the metabolites", mark: "line" }
          : { token: "smoothed", label: "The curve the correction removes: LOESS through this metabolite's QCs", mark: "line" },
        { token: "extreme", label: "Called different: adjusted p < 0.05", mark: "dot" },
        ...(truth ? [{ token: "theory", label: "The true drift", mark: "dash" }, { token: "reference", label: "A true difference (tick)", mark: "line" }] : []),
      ];
    }
    return [
      { token: "group-a", label: "A prostatic hyperplasia sample", mark: "dot" },
      { token: "group-b", label: "A prostate cancer sample", mark: "dot" },
      { token: "reference", label: "A pooled QC: the same material at every position in the run", mark: "bar" },
      { token: "highlight", label: "The median across the 26 metabolites at each injection", mark: "line" },
      ...(truth ? [{ token: "theory", label: "The true drift", mark: "dash" }] : []),
    ];
  },

  /* Pure and seeded: the run, both corrections at both spans, every test. */
  compute: ({ params, rng }) => {
    const sim = E.simulate(rng);
    const run = E.layout(sim, params.order, Number(params.qc));
    const corr = { none: { curve: null, Y: run.X }, median: E.correct(run, "median"), "qc-loess-0.3": E.correct(run, "qc-loess", 0.3), "qc-loess-0.75": E.correct(run, "qc-loess", 0.75) };
    const scores = {}, left = {};
    for (const [k, c] of Object.entries(corr)) { scores[k] = E.score(run, c.Y); left[k] = E.driftLeft(run, c.Y); }
    const range = run.X.map((_, m) => {
      const all = Object.values(corr).flatMap((c) => c.Y[m]).concat(run.X[m]);
      return [Math.floor(Math.min(...all) - 0.2), Math.ceil(Math.max(...all) + 0.2)];
    });
    const qcCentred = run.X.map((r) => { const mu = E.mean(run.qcIdx.map((i) => r[i])); return r.map((v) => v - mu); });
    const med = run.inj.map((_, i) => E.median(run.X.map((r) => r[i])));
    const muMed = E.mean(run.qcIdx.map((i) => med[i]));
    return { run, corr, scores, left, range, qcCentred, medianCentred: med.map((v) => v - muMed), most: E.mostDrift(run) };
  },

  animation: {
    stepLabel: { anim: "labelAt", labels: { drift0: "Inject", driftdone: "Inject", correction0: "Correct", correctiondone: "Correct" }, default: "Step" },
    stepTitle: { anim: "labelAt", labels: {
      drift0: "Run the injections in order, one a beat: the study samples, and a pooled QC between every few",
      driftdone: "Every injection of this run has been made",
      correction0: "Draw the curve the correction removes, then move every value by it",
      correctiondone: "This correction has been applied; change Correction to compare",
    }, default: "Step through this page" },
    runLabel: null,
    init: ({ params, fromScratch }) => {
      const k = corrKey(params);
      const anim = { n: { drift: 0, correction: 0 }, p: 1, page: params.page, cor: { from: k, to: k, t: 1 }, easing: false };
      if (!fromScratch && Number(params.shown) > 0) anim.n[params.page] = 1;
      settle(anim, params.page);
      return anim;
    },
    advance: (anim, { dt, params, state }) => {
      if (anim.mode === "ease") {
        anim.cor.t = Math.min(1, anim.cor.t + dt / EASE_MS);
        if (anim.cor.t >= 1) anim.cor.from = anim.cor.to;
        return anim.cor.t < 1;
      }
      const page = params.page;
      if (anim.p >= 1) {
        if ((anim.n[page] ?? 0) >= STAGES[page]) { settle(anim, page); return false; }
        anim.n[page] += 1; anim.p = 0; anim.page = page;
      }
      anim.p = Math.min(1, anim.p + dt / stageMs(page, state));
      if (anim.p >= 1) { settle(anim, page); return false; }
      return true;
    },
    rebuild: (anim, { params }) => {
      const k = corrKey(params);
      if (k !== anim.cor.to) {
        anim.cor.from = anim.cor.t < 0.5 ? anim.cor.from : anim.cor.to;
        anim.cor.to = k; anim.cor.t = 0;
        // an ease only once the correction has been applied; before the press there is nothing to move
        if (anim.n.correction >= 1 && anim.p >= 1) anim.easing = true; else { anim.cor.from = k; anim.cor.t = 1; }
      }
      /* a page switch mid-press finishes the press where it was (the 2026-09-20 sweep) */
      if (anim.p < 1) anim.p = 1;
      anim.page = params.page;
      settle(anim, params.page);
    },
  },

  /* a metabolite's QC trace (Drift), or its dot in a row (Correction), selects it */
  regions: ({ w, params, state, anim }) => {
    if (!state) return [];
    const { run } = state;
    if (params.page === "drift") {
      if ((anim ? anim.n.drift : Number(params.shown) || 0) < 1) return [];
      const Q = driftLayout(w).qc;
      const sx = (i) => Q.x0 + (i / (run.N - 1)) * (Q.x1 - Q.x0);
      const sy = (v) => Q.y1 - ((Math.max(-1.3, Math.min(1.3, v)) + 1.3) / 2.6) * (Q.y1 - Q.y0);
      return run.mets.flatMap((_, k) => run.qcIdx.map((i) => ({ x: sx(i) - 4, y: sy(state.qcCentred[k][i]) - 4, w: 8, h: 8, set: { metabolite: slugOf(E.METABOLITES[k]) }, label: E.METABOLITES[k] })));
    }
    const S = corrLayout(w).strips;
    const done = (anim ? anim.n.correction : Number(params.shown) || 0) >= 1;
    const rowKeys = { none: "none", median: "median", "qc-loess": `qc-loess-${params.span}` };
    return ROWS.flatMap((r, k) => {
      if (r !== "none" && !done) return [];
      const y = S.top + 10 + k * S.step, sc = state.scores[rowKeys[r]];
      return run.mets.map((_, j) => ({ x: stripX(S, sc.fc[j]) - 4, y: y - 5, w: 8, h: 10, set: { metabolite: slugOf(E.METABOLITES[j]) }, label: E.METABOLITES[j] }));
    });
  },

  draw: ({ ctx, colors, w, params, state, anim }) => {
    renderFormula(params.page === "drift" ? "drift" : params.correction === "median" ? "median" : "loess");
    if (params.page === "correction") drawCorrection(ctx, colors, w, params, state, anim);
    else drawDrift(ctx, colors, w, params, state, anim);
  },

  readout: ({ params, state, anim }) => {
    const truth = params.truth === "on";
    const { run } = state, m = resolveMet(params, state), name = E.METABOLITES[m];
    const nQC = run.qcIdx.length;
    const called = (sc) => truth ? `${sc.tp} true positive${sc.tp === 1 ? "" : "s"}, ${sc.fp} false positive${sc.fp === 1 ? "" : "s"}; 4 truly differ` : "Wilcoxon rank-sum test, adjusted p < 0.05";
    if (params.page === "drift") {
      const { s, p } = stageOf("drift", params, anim);
      const done = s >= 1 && p >= 1;
      const k = s >= 1 ? Math.min(run.N, Math.floor(p * run.N) + (p >= 1 ? 0 : 1)) : 0;
      const sc = state.scores.none;
      return [
        { label: "Injections", value: `${k} of ${run.N}`, note: `${run.N - nQC} study samples and ${nQC} pooled QCs` },
        done
          ? { label: name, value: `${sg(sc.fc[m])} log2`, note: `cancer − hyperplasia; adjusted p ${pFmt(sc.padj[m])}; QC RSD ${pct(sc.rsd[m])}` }
          : { label: name, value: "–", note: "cancer − hyperplasia, once every injection is made" },
        { label: "Metabolites called different", value: done ? `${sc.called} of 26` : "–", note: done ? called(sc) : "once every injection is made" },
      ];
    }
    const { s, p } = stageOf("correction", params, anim);
    const done = s >= 1 && p >= 1;
    const k = corrKey(params), none = state.scores.none, sc = state.scores[k];
    return [
      { label: `QC RSD, ${name}`, value: done ? `${pct(none.rsd[m])} → ${pct(sc.rsd[m])}` : pct(none.rsd[m]), note: done ? `as measured → after ${CORR_NAME[k]}` : "as measured" },
      truth
        ? { label: "Drift left in the study samples", value: done ? `${f3(state.left.none[m])} → ${f3(state.left[k][m])} log2` : `${f3(state.left.none[m])} log2`, note: "SD of the corrected values minus the drift-free values, this metabolite" }
        : { label: "Drift left in the study samples", value: "–", note: "against the drift-free values: True values On" },
      { label: "Metabolites called different", value: done ? `${none.called} → ${sc.called} of 26` : `${none.called} of 26`, note: done ? called(sc) : "as measured; Correct applies the correction" },
    ];
  },
});
