/* ============================================================================
   Widget 73 · Deep Learning - Signals: CNN and LSTM

   PHM5005 07-2 cells 22–99, four pages in the notebook's own order: the
   lesson's `CNN1D` on a 2 s ECG fragment, its `BiLSTM`, its `CNN_LSTM`, and
   Captum's `Occlusion` on the trained CNN. `model.js` is the stage and the
   nets, `engine.js` the layers; this file draws and paces, and holds every
   string a reader sees.

   THE MISCONCEPTIONS, one a page (the catalogue's § The sequence arc):
     1D-CNN      a 1D kernel is a smoothing window whose size is a tuning
                 number — its size is a DURATION (k / f_s), one output of the
                 lesson's stack reads 25 samples = 69 ms, most of one QRS, and
                 one value of a feature map is one window ⊙ one kernel, summed.
     LSTM        the last hidden state remembers the whole sequence — trained
                 on the raw 720 samples with the last states as its summary
                 the model stays at chance in the same budget that reaches 90%
                 with max over time; the running prediction says WHEN it knows.
     CNN + LSTM  the same recurrence over the convolutions' 90 steps of
                 features: the same claim, the beat found in a fraction of
                 the steps.
     Occlusion   an attribution map has the signal's resolution — it has the
                 WINDOW's: at the lesson's k = 32 a 30-sample beat reads 110
                 wide, and two copies of the beat each read as unimportant.

   DECISIONS TAKEN AT THE MOCK AND THE FIRST REVIEW (his picks, 2026-09-20),
   so they are not re-argued:
    1. THE CLASSES ARE NAMED BY WHAT THEY ARE — Sinus rhythm / Ectopic beat —
       never the lesson's OK / Dangerous (one ectopic beat is PhysioNet's
       class 4, which the lesson files under OK).
    2. THE CNN TRAINS IN compute(), on the click, at half the lesson's width
       (8 / 16 channels): 200 fragments, 20 epochs, about 1.3 s. The trained
       net is cached by its data parameters so a page switch (a display
       change, which re-runs compute) does not retrain.
    3. THE LSTMS TRAIN TOO, at H = 8 (review 1: the initialisation-only page
       had a sensitivity graph he read as a prediction, and it was not one).
       Raw: 100 fragments × 6 epochs, 1.6 s; on the CNN's features: 0.4 s.
       Both cached the same way. The reduction is trained into the head, so
       Reduce is a DATA control, and the last-states arm is the case that
       fails on the raw signal.
    4. LSTM AND CNN + LSTM ARE TWO PAGES, as the notebook has them (review 1,
       reversing the strip pick).
    5. THE FEATURE MAPS SHARE THE TRACE'S AXIS: each output is drawn under the
       centre of the window it read (review 1: they were 64 px narrower and
       nothing lined up). A band under the maps shows the multiplication for
       the followed kernel at one stop: window ⊙ weights, summed.
    6. k = 3 · 7 · 15 · 31 read in samples with the milliseconds beside;
       occlusion k = 8 · 16 · 32 · 64 with stride k / 2 and a baseline control;
       copies of the ectopic beat a data control shared by the pages.
   ========================================================================= */

import { defineWidget, makeRng } from "../core/index.js";
import * as M from "./model.js";
import * as E from "./engine.js";

/* ------------------------------------------------------------- the pages -- */

/* two rows, one parameter: the three models are one kind of thing and occlusion is not — it asks any of them
   (Kenneth 2026-09-20, round 13, for this widget and 73); core's `group` puts each run on its own row */
const PAGES = [
  { value: "cnn", label: "1D-CNN", group: "the models" },
  { value: "lstm", label: "LSTM", group: "the models" },
  { value: "combo", label: "CNN + LSTM", group: "the models" },
  { value: "occlusion", label: "Occlusion", group: "attribution, on any of them" },
];
const ON = (page) => ({ param: "page", equals: page });
const ON_LSTMS = { param: "page", oneOf: ["lstm", "combo"] };
/* the recurrence's controls also show on the occlusion page when it occludes a recurrence */
const ON_RECURRENCE = { any: [ON_LSTMS, { all: [{ param: "page", equals: "occlusion" }, { param: "model", oneOf: ["lstm", "combo"] }] }] };
const MODEL_NAMES = { cnn: "1D-CNN", lstm: "LSTM", combo: "CNN + LSTM" };

const STAGES = { cnn: 3, lstm: 3, combo: 4 };
const DUR = {
  cnn: [2200, 700, 1400],      // slide the kernel · stack the layers · classify
  lstm: [1800, 600, 1400],     // run the recurrence · reduce · predict along the fragment
  combo: [700, 1400, 600, 1200], // extract the features · run the recurrence · reduce · predict
};
const WINDOW_MS = 260;
const PREFIX_EVERY_RAW = 20, PREFIX_EVERY_COMBO = 3;
const N_LSTM_RAW = 100, EPOCHS_RAW = 8, N_LSTM_COMBO = 120, EPOCHS_COMBO = 8;

const HEIGHTS = { cnn: 536, lstm: 516, combo: 562, occlusion: 356 };

/* ------------------------------------------------------------- the copy --- */

const S = {
  subtitle:
    "In a signal, position is time, so a kernel's size is a duration and a recurrence's step is "
    + "a sample. A 1D convolution detects a shape wherever it occurs; an LSTM carries a state along "
    + "the fragment and one summary of its outputs reaches the linear layer. Occlusion scores each "
    + "window by how far the prediction moves without it, whichever model is asked.",
  pageLabel: "Page",
  fragSection: "The fragment",
  copiesLabel: "Ectopic beats",
  copiesDetail: "how many beats of the fragment are wide ectopic complexes; 0 is the other class, sinus rhythm — the models are trained the same way",
  seedLabel: "Seed",
  seedDetail: "the rhythm, the beats and the training set, reproducibly",
  layerSection: "The first layer",
  kLabel: "Kernel size k",
  kDetail: "how many samples one output of the first layer reads, at 360 Hz",
  strideLabel: "Stride",
  strideDetail: "how far the window moves between outputs",
  padLabel: "Padding",
  padDetail: "zeros added at both ends; ⌊k/2⌋ keeps the length unchanged at stride 1",
  headSection: "The head",
  poolLabel: "Pool",
  poolDetail: "how the last feature maps are collapsed to one value a channel before the linear layer",
  lookSection: "Look at",
  followLabel: "Kernel",
  followDetail: "which of the eight first-layer kernels the band follows; a click on its map does the same",
  stopLabel: "Window at sample",
  stopDetail: "where the window sits once it has slid, and which multiplication the band shows; a click on the trace picks it",
  recurSection: "The recurrence",
  directionLabel: "Direction",
  directionDetail: "one pass along the sequence, or a forward and a reverse pass whose states are joined",
  reduceLabel: "Reduce",
  reduceDetail: "how the outputs at every step are summarised for the linear layer; the head is trained on this summary",
  modelSection: "The model",
  modelLabel: "Model",
  modelDetail: "which trained model the window is asked; the method is the same for any of them",
  windowSection: "The window",
  windowLabel: "Window k",
  windowDetail: "how many samples are set to the baseline at once; the stride is k / 2, half a window",
  baselineLabel: "Baseline",
  baselineDetail: "what the window is replaced with",
  overlayLabel: "Overlay",
  overlayDetail: "the attribution drawn behind the trace once every window has been occluded",

  stepLabels: {
    cnn0: "Slide the kernel", cnn1: "Stack the layers", cnn2: "Classify", cnn3: "Classify",
    lstm0: "Run the recurrence", lstm1: "Reduce", lstm2: "Predict along the fragment", lstm3: "Predict along the fragment",
    combo0: "Extract the features", combo1: "Run the recurrence", combo2: "Reduce", combo3: "Predict along the features", combo4: "Predict along the features",
    occ: "Next window",
  },
  stepTitles: {
    cnn0: "Move the followed kernel across the fragment and write one value of its feature map at each stop",
    cnn1: "Pool, convolve again, and draw how far back into the trace one output of the second layer reads",
    cnn2: "Collapse each feature map to one number, apply the linear layer, and draw the training that set the weights",
    cnn3: "Every stage of this page is drawn",
    lstm0: "Run the trained LSTM along the fragment, one sample a step, and fill the block of its outputs",
    lstm1: "Summarise the block by the chosen reduction and apply the linear layer",
    lstm2: "Ask the model what it would say if the fragment ended at each step",
    lstm3: "Every stage of this page is drawn",
    combo0: "Run the fragment through page 1's trained convolutions: 90 steps of 16 features",
    combo1: "Run the LSTM trained on those features along the 90 steps",
    combo2: "Summarise the block by the chosen reduction and apply the linear layer",
    combo3: "Ask the model what it would say if the features ended at each step",
    combo4: "Every stage of this page is drawn",
    occ: "Set the next window to the baseline, ask the model again, and record the change",
  },
  runTitle: "Run the remaining presses of this page in order",

  legend: {
    cnn: [
      { token: "empirical", label: "The fragment, its samples in the window, and each feature map drawn light to dark", mark: "line" },
      { token: "value-high", label: "A positive kernel weight, or product" },
      { token: "value-low", label: "A negative kernel weight, or product" },
      { token: "highlight", label: "The window, the followed kernel, the output whose reach is drawn" },
      { token: "reference", label: "Where the ectopic beat is" },
    ],
    lstm: [
      { token: "value-high", label: "A positive output of the recurrence" },
      { token: "value-low", label: "A negative output" },
      { token: "highlight", label: "The states the chosen reduction reads" },
      { token: "empirical", label: "The model's probability if the fragment ended at that step", mark: "line" },
      { token: "reference", label: "Where the ectopic beat is" },
    ],
    occlusion: [
      { token: "empirical", label: "The fragment", mark: "line" },
      { token: "extreme", label: "The window set to the baseline" },
      { token: "magnitude", label: "Attribution: how far the probability moved when that window was occluded", mark: "bar" },
      { token: "reference", label: "Where the ectopic beats are" },
    ],
  },

  /* canvas captions */
  capInput: (L) => `x · [1, ${L}] · 2 s at 360 Hz`,
  capWindow: (k) => `window · k = ${k} samples = ${M.ms(k).toFixed(0)} ms`,
  capMaps: (c, L1) => `Conv1 → ReLU · [${c}, ${L1}] · each output under the centre of the window it read`,
  capBand: (c, t) => `kernel ${c} at output ${t}: the window's samples ⊙ its ${"weights"}, summed`,
  capBandX: "window",
  capBandW: "weights",
  capBandProd: "products",
  capBandSum: (v) => `sum ${v.toFixed(2)}`,
  capBandRelu: (v) => `ReLU → ${v.toFixed(2)}`,
  capChain: "The stack, and one output's reach",
  capSees: (rf) => `sees ${rf} samples = ${M.ms(rf).toFixed(0)} ms`,
  capOutputs: (L2) => `Conv2 outputs · ${L2}`,
  capReach: (rf, jump) => `one output reads ${rf} samples = ${M.ms(rf).toFixed(0)} ms of the trace; neighbours ${M.ms(jump).toFixed(0)} ms apart`,
  capHead: (pool, c2) => `${pool === "avg" ? "AdaptiveAvgPool1d(1)" : "AdaptiveMaxPool1d(1)"} → Linear(${c2}, 2)`,
  capLoss: "loss by epoch · 200 fragments · 20 epochs · 8 and 16 channels",
  capLossLstm: (n, e) => `loss by epoch · ${n} fragments · ${e} epochs · trained here at H = 8`,
  capPred: (p, name) => `p(${name}) = ${p.toFixed(2)}`,
  capPermute: "permute: [B, 1, 720] → [B, 720, 1]",
  capPermuteCombo: (Lp, C) => `permute: [B, ${C}, ${Lp}] → [B, ${Lp}, ${C}]`,
  capBlock: (T, F) => `output · [${T}, ${F}]`,
  capFeats: (C, Lp) => `the trained convolutions of the 1D-CNN page: Conv2 → ReLU · [${C}, ${Lp}]`,
  capReduced: (name, T, F) => `${name} · [${T}, ${F}] → [${F}] → Linear(${F}, 2)`,
  capHalfFwd: (H) => `h→ · forward pass · ${H} rows`,
  capHalfRev: (H) => `h← · reverse pass · ${H} rows`,
  capFromFwd: (H) => `from h→ [${H}]`,
  capFromRev: (H) => `from h← [${H}]`,
  capHow: {
    last: (T, bi) => (bi ? `concat: the forward pass's state at step ${T} and the reverse pass's at step 1 — the two framed columns` : `the state at step ${T} — the framed column`),
    mean: (T) => `each row averaged over its ${T} steps`,
    max: (T) => `each row's largest value over its ${T} steps — the marked cells`,
  },
  capUniNote: (H) => `one way: only h→, so the block is [T, ${H}] and the vector [${H}]`,
  capRunning: "if the fragment ended here: p(ectopic beat)",
  capRunningCombo: "if the features ended here: p(ectopic beat)",
  capFx: (p, model) => `f(x) = ${p.toFixed(2)} · f is the trained ${model}`,
  capOccluded: (p, a) => `window at the baseline: f = ${p.toFixed(2)} · change ${a.toFixed(2)}`,
  capAttr: (k, s) => `attribution by position · k = ${k}, stride ${s}`,
  capHalfMax: (n) => `half-max width ${n} samples`,
  capBeat: "the ectopic beat",
  capBeats: "the ectopic beats",
  capOverlay: "the attribution behind the trace",
  className: ["Sinus rhythm", "Ectopic beat"],

  /* readout */
  tileK: "Kernel size",
  tileKNote: (k) => `${k} samples at 360 Hz`,
  tileReach: "One Conv2 output reads",
  tileReachNote: "the receptive field after the second convolution",
  tileAcc: "Held-out accuracy",
  tileAccNote: "40 fragments outside the training set, scored once the model has classified",
  tileWait: "—",
  tileP: "p(ectopic beat)",
  tilePNote: "the trained model's probability for the whole fragment",
  tilePNoteModel: (model) => `the trained ${model}'s probability for the whole fragment`,
  tileReduce: "Reduction",
  tileReduceNote: (T, F) => `output [${T}, ${F}] summarised to one vector of ${F}; the head is trained on it`,
  tileWindow: "Windows occluded",
  tileWindowNote: (k, s) => `of ${k} samples at stride ${s}`,
  tileWidth: "Half-max width of the map",
  tileWidthNote: "samples above half the largest attribution; the beat is about 30 wide",
  tileWidthNoteNone: "samples above half the largest attribution; this fragment has no ectopic beat",

  /* summary */
  sum: {
    cnn: (n) => ["the fragment alone", "the followed kernel's feature map", "the stack and one output's reach", "the classification and the training curve"][n],
    lstm: (n) => ["the fragment alone", "the block of the recurrence's outputs", "the block reduced to one vector", "the prediction at every step"][n],
    combo: (n) => ["the fragment alone", "the convolutions' features", "the block of the recurrence's outputs", "the block reduced to one vector", "the prediction at every step"][n],
    occ: (i, n) => (i === 0 ? "no window occluded yet" : i < n ? `${i} of ${n} windows occluded` : "every window occluded; the map is complete"),
  },
};

/* --------------------------------------------------------- drawing helpers */

const rgb = (c) => { const m = String(c).match(/^#([0-9a-f]{6})$/i); return m ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : [128, 128, 128]; };
const wash = (color, a) => { const p = rgb(color); return `rgba(${p[0]},${p[1]},${p[2]},${a})`; };
const ramp = (colors, t, to) => { const a = rgb(colors.surface3), b = rgb(to); const u = Math.max(0, Math.min(1, t)); return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * u)).join(",")})`; };
const signed = (colors, v, scale) => (v >= 0 ? ramp(colors, v / scale, colors.valueHigh) : ramp(colors, -v / scale, colors.valueLow));
const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function txt(ctx, colors, s, x, y, { font = null, fill = null, align = "left", baseline = "alphabetic" } = {}) {
  ctx.save();
  ctx.font = font ?? `${colors.fsXs} ${colors.font}`;
  ctx.fillStyle = fill ?? colors.ink2;
  ctx.textAlign = align; ctx.textBaseline = baseline;
  ctx.fillText(s, x, y);
  ctx.restore();
}
const capFont = (colors) => `600 ${colors.fsSm} ${colors.font}`;
const monoFont = (colors) => `${colors.fsXs} ${colors.mono}`;
function line(ctx, x1, y1, x2, y2, stroke, width = 1, dash = null) {
  ctx.save(); ctx.strokeStyle = stroke; ctx.lineWidth = width; if (dash) ctx.setLineDash(dash);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
}
function rect(ctx, x, y, w, h, fill, stroke = null, lw = 1) {
  ctx.save();
  if (fill) { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1); }
  ctx.restore();
}
function polyline(ctx, xs, ys, stroke, width = 1.2) {
  ctx.save(); ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.lineJoin = "round";
  ctx.beginPath(); xs.forEach((x, i) => (i ? ctx.lineTo(x, ys[i]) : ctx.moveTo(x, ys[i]))); ctx.stroke(); ctx.restore();
}

/* The trace sits on a FIXED value window: the fragments are z-scored, so
   −2.5 … 4 holds every beat and the tallest ectopic complex. Rescaling per
   fragment would make one seed's beat as tall as another's (2.5). */
const V_LO = -2.5, V_HI = 4;
function trace(ctx, colors, x, x0, x1, top, bot, stroke, width = 1.1) {
  const n = x.length, xs = new Array(n), ys = new Array(n);
  for (let t = 0; t < n; t++) {
    xs[t] = x0 + (t / (n - 1)) * (x1 - x0);
    ys[t] = bot - ((Math.max(V_LO, Math.min(V_HI, x[t])) - V_LO) / (V_HI - V_LO)) * (bot - top);
  }
  polyline(ctx, xs, ys, stroke, width);
}
const PAD_L = 44, PAD_R = 14;
const px = (w, t) => PAD_L + (t / (M.L - 1)) * (w - PAD_R - PAD_L);
/** the input sample under the centre of first-layer output `t` */
const centreOf = (t, k, stride, pad) => t * stride - pad + (k - 1) / 2;

/* ----------------------------------------------------------- the geometry */

const CNN = { traceTop: 22, traceBot: 92, mapsHead: 116, mapsTop: 122, rowH: 12, bandHead: 236, bandTop: 244, bandH: 40, chainHead: 318, outsY: 400, lossHead: 470, lossTop: 478, lossH: 34 };
const LSTM = { traceTop: 22, traceBot: 78, permY: 100, blockHead: 120, blockTop: 128, cellH: 6, gap: 6, reduceHead: 254, reduceTop: 262, reduceH: 12, runHead: 330, runTop: 340, runBot: 416, lossHead: 456, lossTop: 464, lossH: 34 };
const COMBO = { traceTop: 22, traceBot: 78, featsHead: 100, featsTop: 106, featCellH: 5, permY: 204, blockHead: 222, blockTop: 230, cellH: 6, gap: 6, reduceHead: 356, reduceTop: 364, reduceH: 12, runHead: 432, runTop: 442, runBot: 516, lossY: 534 };
const OCC = { traceTop: 22, traceBot: 92, attrHead: 118, attrTop: 124, attrH: 56, overlayHead: 212, overlayTop: 220, overlayBot: 290 };

/* ================================================================ compute */

/* Trained models, cached by the parameters that shape them. compute() is
   pure in those parameters, and a page switch is a display change that
   re-runs compute: without the caches every visit to another page would
   retrain for seconds. Seeds are derived from `seed` rather than drawn from
   the one rng core hands over, so a cache hit and a cache miss consume
   nothing differently downstream. */
const caches = { cnn: new Map(), lstm: new Map(), combo: new Map() };
function cached(kind, key, make) {
  const c = caches[kind];
  if (c.has(key)) return c.get(key);
  const v = make();
  if (c.size > 12) c.delete(c.keys().next().value);
  c.set(key, v);
  return v;
}

function compute({ params }) {
  /* 0 shows the other class: the models train on one ectopic beat per positive fragment, as at 1 */
  const seed = params.seed, shownCopies = Number(params.copies), copies = Math.max(1, shownCopies);
  const data = M.dataset(makeRng(seed * 7 + 1), 200, copies);
  const test = M.dataset(makeRng(seed * 7 + 5), 40, copies);
  const frag = M.fragment(makeRng(seed * 7 + 3), shownCopies === 0 ? 0 : 1, { copies });
  const k = Number(params.k), stride = Number(params.stride), pad = params.pad === "same" ? M.samePad(k) : 0;

  const cnn = cached("cnn", [seed, copies, k, stride, params.pad, params.pool].join("|"), () => {
    const rng = makeRng(seed * 7 + 2);
    const net = M.buildNet(rng, { k, stride, pad: params.pad, pool: params.pool });
    const curve = M.trainNet(rng, net, data, { epochs: 20 });
    return { net, curve, acc: E.accuracy(net, test) };
  });
  const acts = cnn.net.activations(frag.x);
  const chain = M.chain({ k, stride, pad: params.pad });
  const pred = E.predict(cnn.net, frag.x);
  const L1 = acts[1].L;
  /* the followed kernel's multiplication at one stop: the output whose window centre is nearest `stop` */
  const stop = Math.max(1, Math.min(M.L, Number(params.stop))) - 1;
  let stopT = 0, best = Infinity;
  for (let t = 0; t < L1; t++) { const d = Math.abs(centreOf(t, k, stride, pad) - stop); if (d < best) { best = d; stopT = t; } }

  const bi = params.direction === "bi", reduce = params.reduce;
  const state = { frag, cnn, acts, chain, pred, k, stride, pad, L1, stopT, occ: null, lstm: null, combo: null };

  const rawLstm = () => cached("lstm", [seed, copies, bi, reduce].join("|"), () => {
    const seqs = data.slice(0, N_LSTM_RAW).map((d) => ({ x: M.rawSequence(d.x), y: d.y }));
    const { model, curve } = M.trainLstm(makeRng(seed * 7 + 4), seqs, { D: 1, reduce, bidirectional: bi, epochs: EPOCHS_RAW });
    const acc = E.accuracy(model, test.map((d) => ({ x: M.rawSequence(d.x), y: d.y })));
    return { model, curve, acc };
  });
  const comboLstm = () => cached("combo", [seed, copies, k, stride, params.pad, params.pool, bi, reduce].join("|"), () => {
    const seqs = data.slice(0, N_LSTM_COMBO).map((d) => ({ x: M.convFeatures(cnn.net, d.x), y: d.y }));
    const { model, curve } = M.trainLstm(makeRng(seed * 7 + 6), seqs, { D: M.C2, reduce, bidirectional: bi, epochs: EPOCHS_COMBO });
    const acc = E.accuracy(model, test.map((d) => ({ x: M.convFeatures(cnn.net, d.x), y: d.y })));
    return { model, curve, acc };
  });

  if (params.page === "lstm") {
    const m = rawLstm(), X = M.rawSequence(frag.x);
    state.lstm = { ...m, reading: M.lstmReading(m.model, X), running: M.prefixCurve(m.model, X, PREFIX_EVERY_RAW), T: X.length };
  }
  if (params.page === "combo") {
    const m = comboLstm(), X = M.convFeatures(cnn.net, frag.x);
    state.combo = { ...m, X, reading: M.lstmReading(m.model, X), running: M.prefixCurve(m.model, X, PREFIX_EVERY_COMBO), T: X.length };
  }
  if (params.page === "occlusion") {
    /* the window is asked of whichever trained model is chosen; the method does not change */
    const p1 = (z) => E.softmaxCE(z, 0).p[1];
    const predict = params.model === "lstm" ? ((m) => (x) => p1(m.forward(M.rawSequence(x))))(rawLstm().model)
      : params.model === "combo" ? ((m) => (x) => p1(m.forward(M.convFeatures(cnn.net, x))))(comboLstm().model)
        : (x) => E.predict(cnn.net, x)[1];
    const kw = Number(params.window);
    state.occ = M.occlusionWalk(predict, frag.x, { k: kw, stride: Math.max(1, kw / 2), baseline: params.baseline });
    state.occ.model = MODEL_NAMES[params.model] ?? MODEL_NAMES.cnn;
  }
  return state;
}

/* ================================================================== anim */

const countOf = (anim) => (anim.page === "occlusion" ? anim.occ : anim.n[anim.page] ?? 0);
function settle(anim) {
  anim.labelAt = anim.page === "occlusion" ? "occ" : `${anim.page}${anim.n[anim.page]}`;
}
function isDone(anim, state) {
  if (anim.page === "occlusion") return state.occ ? anim.occ >= state.occ.windows.length && anim.t >= 1 : true;
  return anim.n[anim.page] >= STAGES[anim.page] && anim.t >= 1;
}

function takePress(anim, dt, state) {
  if (anim.page === "occlusion") {
    const n = state.occ.windows.length;
    if (anim.t < 1) { anim.t = Math.min(1, anim.t + dt / WINDOW_MS); if (anim.t < 1) return true; }
    if (anim.occ >= n) return false;
    anim.occ += 1; anim.t = 0;
    return true;
  }
  const count = anim.n[anim.page], max = STAGES[anim.page];
  if (anim.t < 1) { anim.t = Math.min(1, anim.t + dt / DUR[anim.page][count - 1]); return true; }
  if (count >= max) return false;
  anim.n[anim.page] += 1;
  anim.t = 0;
  return true;
}

/* ================================================================ drawing */

/** reveal fraction of stage `n` on a page whose press count is `count` */
const stageT = (anim, n, count) => (count > n ? 1 : count === n ? ease(anim.t) : 0);

function drawFragment(ctx, colors, w, frag, top, bot, { caption = true } = {}) {
  const X0 = PAD_L, X1 = w - PAD_R;
  for (const e of frag.ectopic) rect(ctx, px(w, e - 30), top, px(w, e + 30) - px(w, e - 30), bot - top, wash(colors.reference, 0.10));
  trace(ctx, colors, frag.x.d, X0, X1, top, bot, colors.empirical);
  if (caption && frag.ectopic.length) txt(ctx, colors, frag.ectopic.length > 1 ? S.capBeats : S.capBeat, px(w, frag.ectopic[0]), bot + 12, { fill: colors.reference, align: "center" });
}

function drawLossCurve(ctx, colors, x0, y0, h, curve, upto, caption) {
  const cx = (i) => x0 + (i / (curve.length - 1)) * 220, cy = (v) => y0 + h - h * Math.min(1, v / 0.75);
  const n = Math.max(2, Math.min(curve.length, upto));
  polyline(ctx, curve.slice(0, n).map((_, i) => cx(i)), curve.slice(0, n).map(cy), colors.empirical, 1.4);
  line(ctx, x0, y0 + h + 0.5, x0 + 220, y0 + h + 0.5, colors.axis);
  txt(ctx, colors, `${curve[0].toFixed(2)} → ${curve[n - 1].toFixed(2)}`, x0 + 228, y0 + h, { font: monoFont(colors) });
  if (caption) txt(ctx, colors, caption, x0 + 228, y0 + 12, { font: `600 ${colors.fsSm} ${colors.mono}`, fill: colors.ink1 });
}

function drawCnn(ctx, colors, w, params, state, anim) {
  const { frag, acts, chain, cnn, pred, k, stride, pad, L1, stopT } = state;
  const X0 = PAD_L, X1 = w - PAD_R;
  const count = anim.n.cnn, tSlide = count === 1 ? ease(anim.t) : count > 1 ? 1 : 0;
  const follow = Math.max(0, Math.min(M.C1 - 1, Number(params.follow) - 1));
  const relu1 = acts[1], conv1 = cnn.net.layers[0];

  txt(ctx, colors, S.capInput(M.L), X0, 14, { font: capFont(colors), fill: colors.ink1 });
  drawFragment(ctx, colors, w, frag, CNN.traceTop, CNN.traceBot);

  /* the window: slides through every stop with press 1, then parks at `stop` */
  const shownT = count === 1 && anim.t < 1 ? Math.round(tSlide * (L1 - 1)) : stopT;
  if (count >= 1) {
    const start = shownT * stride - pad;
    const wx0 = px(w, Math.max(0, start)), wx1 = px(w, Math.min(M.L - 1, start + k - 1));
    rect(ctx, wx0, CNN.traceTop, Math.max(2, wx1 - wx0), CNN.traceBot - CNN.traceTop, wash(colors.highlight, 0.22), colors.highlight, 1.5);
    const right = wx1 + 6 + 170 > X1;
    txt(ctx, colors, S.capWindow(k), right ? wx0 - 6 : wx1 + 6, CNN.traceTop + 12, { fill: colors.highlight, align: right ? "right" : "left" });
  }

  /* the feature maps, on the trace's axis: output t under the centre of its window */
  txt(ctx, colors, S.capMaps(M.C1, L1), X0, CNN.mapsHead, { font: capFont(colors), fill: colors.ink1 });
  let maxAct = 1e-9; for (const v of relu1.d) if (v > maxAct) maxAct = v;
  const cellW = Math.max(1, px(w, stride) - px(w, 0));
  const revealed = count >= 2 || (count === 1 && anim.t >= 1);
  for (let c = 0; c < M.C1; c++) {
    const y = CNN.mapsTop + c * CNN.rowH;
    rect(ctx, X0, y, X1 - X0, CNN.rowH - 1, colors.surface2);
    const upto = c === follow ? (count === 1 && anim.t < 1 ? shownT + 1 : count >= 1 ? L1 : 0) : (revealed ? L1 : 0);
    for (let t = 0; t < upto; t++) {
      const v = relu1.d[c * L1 + t];
      if (v > 0) rect(ctx, px(w, centreOf(t, k, stride, pad)) - cellW / 2, y, cellW + 0.5, CNN.rowH - 1, ramp(colors, v / maxAct, colors.empirical));
    }
    txt(ctx, colors, `k${c + 1}`, X0 - 6, y + 9, { font: monoFont(colors), fill: c === follow ? colors.highlight : colors.ink3, align: "right" });
  }
  if (count >= 1) {
    rect(ctx, X0 - 1, CNN.mapsTop + follow * CNN.rowH - 1, X1 - X0 + 2, CNN.rowH + 1, null, colors.highlight, 1.2);
    // the output being written, on the followed row
    const cxm = px(w, centreOf(shownT, k, stride, pad));
    rect(ctx, cxm - cellW / 2 - 1, CNN.mapsTop + follow * CNN.rowH - 2, cellW + 2, CNN.rowH + 2, null, colors.highlight, 1.5);
    line(ctx, cxm, CNN.traceBot, cxm, CNN.mapsTop + follow * CNN.rowH, colors.highlight, 1, [2, 3]);
  }

  /* the band: the multiplication at the shown stop */
  if (count >= 1) {
    txt(ctx, colors, S.capBand(follow + 1, shownT + 1), X0, CNN.bandHead, { font: capFont(colors), fill: colors.ink1 });
    const start = shownT * stride - pad;
    const xs = [], ws = [], ps = [];
    for (let j = 0; j < k; j++) { const pos = start + j; const xv = pos >= 0 && pos < M.L ? frag.x.d[pos] : 0; const wv = conv1.W.v[follow * k + j]; xs.push(xv); ws.push(wv); ps.push(xv * wv); }
    const sum = ps.reduce((a, b) => a + b, 0) + conv1.b.v[follow];
    const groupW = Math.min(150, (X1 - X0 - 200) / 3), bw = Math.max(1.5, groupW / k), base = CNN.bandTop + CNN.bandH - 6;
    const group = (gx, vals, label, colourOf) => {
      let m = 1e-9; for (const v of vals) m = Math.max(m, Math.abs(v));
      for (let j = 0; j < vals.length; j++) { const h = 14 * Math.abs(vals[j]) / m; rect(ctx, gx + j * bw, base - 14 - (vals[j] > 0 ? h : 0), Math.max(1, bw - 0.6), h, colourOf(vals[j])); }
      line(ctx, gx, base - 13.5, gx + vals.length * bw, base - 13.5, colors.axis);
      txt(ctx, colors, label, gx, base + 6, { fill: colors.ink3 });
    };
    group(X0, xs, S.capBandX, () => colors.empirical);
    txt(ctx, colors, "⊙", X0 + groupW + 8, base - 16, { fill: colors.ink1 });
    group(X0 + groupW + 22, ws, S.capBandW, (v) => (v >= 0 ? colors.valueHigh : colors.valueLow));
    txt(ctx, colors, "=", X0 + 2 * groupW + 30, base - 16, { fill: colors.ink1 });
    group(X0 + 2 * groupW + 44, ps, S.capBandProd, (v) => (v >= 0 ? colors.valueHigh : colors.valueLow));
    const sx = X0 + 3 * groupW + 60;
    txt(ctx, colors, S.capBandSum(sum), sx, base - 18, { font: monoFont(colors), fill: colors.ink1 });
    txt(ctx, colors, S.capBandRelu(Math.max(0, sum)), sx, base - 4, { font: monoFont(colors), fill: colors.ink1 });
  }

  /* the stack (press 2) */
  const tStack = stageT(anim, 2, count);
  if (tStack > 0) {
    ctx.save(); ctx.globalAlpha = tStack;
    txt(ctx, colors, S.capChain, X0, CNN.chainHead, { font: capFont(colors), fill: colors.ink1 });
    const rows = [{ name: "input", L: M.L, rf: 1 }, ...chain];
    rows.forEach((r, i) => {
      const y = CNN.chainHead + 15 + i * 13;
      txt(ctx, colors, r.name, X0, y, { font: monoFont(colors), fill: colors.ink1 });
      txt(ctx, colors, `L = ${r.L}`, X0 + 132, y, { font: monoFont(colors) });
      if (i) txt(ctx, colors, S.capSees(r.rf), X0 + 200, y, { font: monoFont(colors), fill: i === rows.length - 1 ? colors.highlight : colors.ink2 });
    });
    txt(ctx, colors, S.capHead(params.pool, M.C2), X0, CNN.chainHead + 15 + rows.length * 13, { font: monoFont(colors) });
    const last = chain[chain.length - 1], L2 = last.L;
    const ox = (i) => X0 + (i / Math.max(1, L2 - 1)) * (X1 - X0);
    const outI = Math.max(0, Math.min(L2 - 1, Math.round(((frag.ectopic[0] ?? M.L / 2) / M.L) * (L2 - 1))));
    for (let i = 0; i < L2; i++) rect(ctx, ox(i) - 2, CNN.outsY, 4, 8, i === outI ? colors.highlight : colors.surface3);
    txt(ctx, colors, S.capOutputs(L2), X1, CNN.outsY + 22, { align: "right", fill: colors.ink3 });
    const centre = outI * last.jump, rf0 = centre - Math.floor(last.rf / 2), rf1 = rf0 + last.rf;
    line(ctx, ox(outI), CNN.outsY, px(w, Math.max(0, rf0)), CNN.traceBot, colors.highlight, 1, [3, 3]);
    line(ctx, ox(outI), CNN.outsY, px(w, Math.min(M.L - 1, rf1)), CNN.traceBot, colors.highlight, 1, [3, 3]);
    txt(ctx, colors, S.capReach(last.rf, last.jump), X0, CNN.outsY + 40, { fill: colors.ink2 });
    ctx.restore();
  }

  /* classify (press 3): the loss curve epoch by epoch, then the prediction */
  const tCls = stageT(anim, 3, count);
  if (tCls > 0) {
    ctx.save(); ctx.globalAlpha = Math.min(1, tCls * 3);
    txt(ctx, colors, S.capLoss, X0, CNN.lossHead, { font: capFont(colors), fill: colors.ink1 });
    drawLossCurve(ctx, colors, X0, CNN.lossTop, CNN.lossH, cnn.curve, Math.ceil(tCls * cnn.curve.length), tCls >= 1 ? S.capPred(pred[1], S.className[1]) : null);
    ctx.restore();
  }
}

/** the block of a recurrence's outputs, its reduction row and the running prediction — shared by the two LSTM pages */
function drawRecurrence(ctx, colors, w, params, { reading, running, T, curve, acc }, G, count, anim, { xOfStep, runCaption, lossCaption, frag, beatStep }) {
  const X0 = PAD_L, X1 = w - PAD_R;
  const feats = reading.feats, Fd = feats[0].length, H = Fd / (params.direction === "bi" ? 2 : 1);
  const tSweep = stageT(anim, 1, count), tRed = stageT(anim, 2, count), tRun = stageT(anim, 3, count);
  let amax = 1e-9; for (const r of feats) for (const v of r) amax = Math.max(amax, Math.abs(v));

  const bi = Fd > H;
  txt(ctx, colors, S.capBlock(T, Fd), X0, G.blockHead, { font: capFont(colors), fill: colors.ink1 });
  /* the block as its two halves: the forward pass's rows, a gap, the reverse pass's rows */
  const colW = (X1 - X0) / T;
  const rowY = (j) => G.blockTop + j * G.cellH + (bi && j >= H ? G.gap : 0);
  const blockBot = rowY(Fd - 1) + G.cellH;
  rect(ctx, X0, G.blockTop, X1 - X0, H * G.cellH, colors.surface2);
  if (bi) rect(ctx, X0, rowY(H), X1 - X0, H * G.cellH, colors.surface2);
  const upto = Math.floor(tSweep * T);
  for (let t = 0; t < upto; t++) for (let j = 0; j < Fd; j++) rect(ctx, xOfStep(t) - colW / 2, rowY(j), colW + 0.5, G.cellH, signed(colors, feats[t][j], amax));
  txt(ctx, colors, "h→", X0 - 6, G.blockTop + H * G.cellH / 2 + 3, { font: monoFont(colors), fill: colors.ink2, align: "right" });
  if (bi) txt(ctx, colors, "h←", X0 - 6, rowY(H) + H * G.cellH / 2 + 3, { font: monoFont(colors), fill: colors.ink2, align: "right" });
  txt(ctx, colors, S.capHalfFwd(H), X1, G.blockTop - 3, { align: "right", fill: colors.ink3 });
  if (bi) txt(ctx, colors, S.capHalfRev(H), X1, rowY(H) - 1, { align: "right", fill: colors.ink3 });
  if (tSweep > 0 && tSweep < 1) line(ctx, xOfStep(upto), G.blockTop, xOfStep(upto), blockBot, colors.highlight, 1.5);
  if (frag) for (const e of frag.ectopic) line(ctx, px(w, e), G.blockTop, px(w, e), blockBot, wash(colors.reference, 0.5), 1, [2, 3]);
  if (!bi) txt(ctx, colors, S.capUniNote(H), X0, blockBot + 12, { fill: colors.ink3 });

  if (tRed > 0) {
    const name = params.reduce, v = reading.reduced;
    const cw = 14, gapV = bi ? 10 : 0;
    const vx = (j) => X0 + j * cw + (bi && j >= H ? gapV : 0);
    /* which outputs the reduction reads, on the block */
    if (name === "last") {
      rect(ctx, xOfStep(T - 1) - colW / 2 - 1.5, G.blockTop - 1.5, colW + 3, H * G.cellH + 3, null, colors.highlight, 1.5);
      if (bi) rect(ctx, xOfStep(0) - colW / 2 - 1.5, rowY(H) - 1.5, colW + 3, H * G.cellH + 3, null, colors.highlight, 1.5);
    } else if (name === "max") {
      for (let j = 0; j < Fd; j++) rect(ctx, xOfStep(reading.arg[j]) - colW / 2 - 1, rowY(j) - 1, colW + 2, G.cellH + 2, null, colors.highlight, 1.2);
    } else {
      rect(ctx, X0 - 1, G.blockTop - 1, X1 - X0 + 2, H * G.cellH + 2, null, colors.highlight, 1.2);
      if (bi) rect(ctx, X0 - 1, rowY(H) - 1, X1 - X0 + 2, H * G.cellH + 2, null, colors.highlight, 1.2);
    }
    ctx.save(); ctx.globalAlpha = tRed;
    txt(ctx, colors, S.capReduced(name, T, Fd), X0, G.reduceHead, { font: capFont(colors), fill: colors.ink1 });
    /* the vector, as one group per pass, and where each group came from */
    for (let j = 0; j < Fd; j++) rect(ctx, vx(j), G.reduceTop, cw, G.reduceH, signed(colors, v[j], amax), colors.grid);
    rect(ctx, vx(0) - 1, G.reduceTop - 1, H * cw + 2, G.reduceH + 2, null, colors.highlight, 1);
    if (bi) rect(ctx, vx(H) - 1, G.reduceTop - 1, H * cw + 2, G.reduceH + 2, null, colors.highlight, 1);
    txt(ctx, colors, S.capFromFwd(H), vx(0), G.reduceTop + G.reduceH + 11, { fill: colors.ink3 });
    if (bi) txt(ctx, colors, S.capFromRev(H), vx(H), G.reduceTop + G.reduceH + 11, { fill: colors.ink3 });
    if (name === "last") {
      line(ctx, xOfStep(T - 1), G.blockTop + H * G.cellH, vx(0) + H * cw / 2, G.reduceTop, colors.highlight, 1, [2, 3]);
      if (bi) line(ctx, xOfStep(0), blockBot, vx(H) + H * cw / 2, G.reduceTop, colors.highlight, 1, [2, 3]);
    }
    txt(ctx, colors, S.capHow[name](T, bi), X0, G.reduceTop + G.reduceH + 25, { fill: colors.ink2 });
    txt(ctx, colors, S.capPred(reading.p[1], S.className[1]), vx(Fd - 1) + cw + 14, G.reduceTop + 10, { font: `600 ${colors.fsSm} ${colors.mono}`, fill: colors.ink1 });
    ctx.restore();
  }

  if (tRun > 0) {
    txt(ctx, colors, runCaption, X0, G.runHead, { font: capFont(colors), fill: colors.ink1 });
    const top = G.runTop, bot = G.runBot;
    for (const p of [0, 0.5, 1]) { const y = bot - p * (bot - top); line(ctx, X0, y + 0.5, X1, y + 0.5, colors.grid); txt(ctx, colors, p.toFixed(1), X0 - 6, y + 3, { font: monoFont(colors), fill: colors.ink3, align: "right" }); }
    if (beatStep != null) for (const b of beatStep) rect(ctx, xOfStep(b) - 4, top, 8, bot - top, wash(colors.reference, 0.12));
    const n = Math.max(1, Math.ceil(tRun * running.length));
    const pts = running.slice(0, n);
    polyline(ctx, pts.map((r) => xOfStep(r.t)), pts.map((r) => bot - r.p * (bot - top)), colors.empirical, 1.6);
    for (const r of pts) { ctx.save(); ctx.fillStyle = colors.empirical; ctx.beginPath(); ctx.arc(xOfStep(r.t), bot - r.p * (bot - top), 2.2, 0, 7); ctx.fill(); ctx.restore(); }
    if (tRun >= 1 && lossCaption) {
      txt(ctx, colors, lossCaption, X0, G.lossHead ?? G.lossY, { font: capFont(colors), fill: colors.ink1 });
      if (G.lossTop) drawLossCurve(ctx, colors, X0, G.lossTop, G.lossH, curve, curve.length, `${Math.round(100 * acc)}% held out`);
      else txt(ctx, colors, `${curve[0].toFixed(2)} → ${curve[curve.length - 1].toFixed(2)} · ${Math.round(100 * acc)}% held out`, X0, G.lossY + 15, { font: monoFont(colors), fill: colors.ink1 });
    }
  }
}

function drawLstm(ctx, colors, w, params, state, anim) {
  const { frag, lstm } = state;
  const X0 = PAD_L;
  txt(ctx, colors, S.capInput(M.L), X0, 14, { font: capFont(colors), fill: colors.ink1 });
  drawFragment(ctx, colors, w, frag, LSTM.traceTop, LSTM.traceBot);
  txt(ctx, colors, S.capPermute, X0, LSTM.permY, { font: monoFont(colors), fill: colors.ink1 });
  drawRecurrence(ctx, colors, w, params, lstm, LSTM, anim.n.lstm, anim, {
    xOfStep: (t) => px(w, t), runCaption: S.capRunning, lossCaption: S.capLossLstm(N_LSTM_RAW, EPOCHS_RAW), frag, beatStep: frag.ectopic,
  });
}

function drawCombo(ctx, colors, w, params, state, anim) {
  const { frag, combo } = state;
  const X0 = PAD_L, X1 = w - PAD_R, count = anim.n.combo;
  const Lp = combo.T, tFeat = stageT(anim, 1, count);
  const xOfStep = (t) => X0 + ((t + 0.5) / Lp) * (X1 - X0);
  txt(ctx, colors, S.capInput(M.L), X0, 14, { font: capFont(colors), fill: colors.ink1 });
  drawFragment(ctx, colors, w, frag, COMBO.traceTop, COMBO.traceBot);
  txt(ctx, colors, S.capFeats(M.C2, Lp), X0, COMBO.featsHead, { font: capFont(colors), fill: colors.ink1 });
  let fmax = 1e-9; for (const r of combo.X) for (const v of r) fmax = Math.max(fmax, v);
  const cw = (X1 - X0) / Lp;
  rect(ctx, X0, COMBO.featsTop, X1 - X0, M.C2 * COMBO.featCellH, colors.surface2);
  const uptoF = Math.floor(tFeat * Lp);
  for (let t = 0; t < uptoF; t++) for (let c = 0; c < M.C2; c++) { const v = combo.X[t][c]; if (v > 0) rect(ctx, X0 + t * cw, COMBO.featsTop + c * COMBO.featCellH, cw + 0.5, COMBO.featCellH, ramp(colors, v / fmax, colors.empirical)); }
  for (const e of frag.ectopic) line(ctx, xOfStep(Math.round(e / M.L * (Lp - 1))), COMBO.featsTop, xOfStep(Math.round(e / M.L * (Lp - 1))), COMBO.featsTop + M.C2 * COMBO.featCellH, wash(colors.reference, 0.5), 1, [2, 3]);
  if (count >= 1) txt(ctx, colors, S.capPermuteCombo(Lp, M.C2), X0, COMBO.permY, { font: monoFont(colors), fill: colors.ink1 });
  /* the recurrence over the features: presses 2, 3 and 4 of this page are its stages 1, 2 and 3 → shift the count by one */
  const shifted = { n: { combo: count - 1 }, t: anim.t, page: "combo" };
  if (count >= 2) drawRecurrence(ctx, colors, w, params, combo, COMBO, count - 1, shifted, {
    xOfStep, runCaption: S.capRunningCombo, lossCaption: S.capLossLstm(N_LSTM_COMBO, EPOCHS_COMBO), frag: null,
    beatStep: frag.ectopic.map((e) => Math.round(e / M.L * (Lp - 1))),
  });
}

function drawOcclusion(ctx, colors, w, params, state, anim) {
  const { frag, occ } = state;
  const X0 = PAD_L, X1 = w - PAD_R;
  const n = occ.windows.length, i = anim.occ, t = ease(anim.t);
  const cur = i >= 1 ? occ.windows[i - 1] : null;

  txt(ctx, colors, S.capFx(occ.base, occ.model), X0, 14, { font: capFont(colors), fill: colors.ink1 });
  drawFragment(ctx, colors, w, frag, OCC.traceTop, OCC.traceBot);
  if (cur) {
    const wx0 = px(w, cur.start), wx1 = px(w, Math.min(M.L - 1, cur.start + occ.k));
    rect(ctx, wx0, OCC.traceTop, wx1 - wx0, OCC.traceBot - OCC.traceTop, null, colors.ink1, 1.2);
    const yb = OCC.traceBot - ((0 - V_LO) / (V_HI - V_LO)) * (OCC.traceBot - OCC.traceTop);
    line(ctx, wx0, yb, wx1, yb, colors.extreme, 2);
    txt(ctx, colors, S.capOccluded(cur.p, cur.a), X0 + 250, 14, { fill: colors.ink1 });
  }

  txt(ctx, colors, S.capAttr(occ.k, occ.stride), X0, OCC.attrHead, { font: capFont(colors), fill: colors.ink1 });
  let amax = 1e-9; for (const win of occ.windows) amax = Math.max(amax, win.a);
  const cw = (X1 - X0) / M.L;
  const shown = Math.min(n, i);
  const partial = new Float64Array(M.L), cnt = new Float64Array(M.L);
  for (let j = 0; j < shown; j++) {
    const win = occ.windows[j], f = j === shown - 1 ? t : 1;
    for (let s = win.start; s < win.start + occ.k && s < M.L; s++) { partial[s] += win.a * f; cnt[s] += f; }
  }
  let pmax = 1e-9; for (let s = 0; s < M.L; s++) if (cnt[s] > 0) pmax = Math.max(pmax, partial[s] / cnt[s]);
  const scale = Math.max(pmax, amax * 0.5);
  for (let s = 0; s < M.L; s++) if (cnt[s] > 0) { const a = partial[s] / cnt[s]; const h = OCC.attrH * a / scale; rect(ctx, X0 + s * cw, OCC.attrTop + OCC.attrH - h, cw + 0.5, h, colors.magnitude); }
  line(ctx, X0, OCC.attrTop + OCC.attrH + 0.5, X1, OCC.attrTop + OCC.attrH + 0.5, colors.axis);
  if (i >= n && anim.t >= 1) txt(ctx, colors, S.capHalfMax(M.halfMaxWidth(occ.attr)), X1, OCC.attrHead, { align: "right", fill: colors.ink3 });

  if (params.overlay === "on" && i >= n && anim.t >= 1) {
    txt(ctx, colors, S.capOverlay, X0, OCC.overlayHead, { font: capFont(colors), fill: colors.ink1 });
    let m = 1e-9; for (const v of occ.attr) m = Math.max(m, v);
    for (let s = 0; s < M.L; s++) rect(ctx, X0 + s * cw, OCC.overlayTop, cw + 0.5, OCC.overlayBot - OCC.overlayTop, wash(colors.magnitude, 0.6 * occ.attr[s] / m));
    trace(ctx, colors, frag.x.d, X0, X1, OCC.overlayTop + 4, OCC.overlayBot - 4, colors.ink1, 0.9);
  }
}

/* ================================================================ widget */

defineWidget({
  slug: "signal-cnn-lstm",
  status: "shipped",
  title: "Deep Learning - Signals: CNN and LSTM",
  subtitle: S.subtitle,
  layout: "side",
  height: ({ page }) => HEIGHTS[page] ?? HEIGHTS.cnn,

  params: {
    page: { role: "page", type: "segmented", label: S.pageLabel, options: PAGES, default: "cnn", display: true },

    fragSec: { type: "section", label: S.fragSection },
    copies: {
      type: "segmented", label: S.copiesLabel, detail: S.copiesDetail,
      options: [{ value: "0", label: "0" }, { value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }], default: "1",
    },
    seed: { type: "int", label: S.seedLabel, detail: S.seedDetail, min: 1, max: 200, default: 1 },

    /* page 1 · the lesson's design table: k, stride, padding; the head */
    layerSec: { type: "section", label: S.layerSection, when: ON("cnn") },
    k: {
      type: "choice", label: S.kLabel, detail: S.kDetail,
      options: M.KERNELS.map((k) => ({ value: String(k), label: String(k), detail: `${k} samples = ${M.ms(k).toFixed(0)} ms` })),
      default: "7", when: ON("cnn"),
    },
    stride: {
      type: "segmented", label: S.strideLabel, detail: S.strideDetail,
      options: [{ value: "1", label: "1" }, { value: "2", label: "2" }], default: "2", when: ON("cnn"),
    },
    pad: {
      type: "segmented", label: S.padLabel, detail: S.padDetail,
      options: [{ value: "same", label: "⌊k/2⌋" }, { value: "none", label: "None" }], default: "same", when: ON("cnn"),
    },
    headSec: { type: "section", label: S.headSection, when: ON("cnn") },
    pool: {
      type: "segmented", label: S.poolLabel, detail: S.poolDetail,
      options: [{ value: "avg", label: "Average" }, { value: "max", label: "Max" }], default: "avg", when: ON("cnn"),
    },
    lookCnn: { type: "section", label: S.lookSection, afterDrive: true, when: ON("cnn") },
    follow: {
      type: "choice", label: S.followLabel, detail: S.followDetail,
      options: Array.from({ length: M.C1 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
      default: "1", display: true, afterDrive: true, when: ON("cnn"),
    },
    stop: { type: "int", label: S.stopLabel, detail: S.stopDetail, min: 1, max: M.L, default: 360, display: true, afterDrive: true, when: ON("cnn") },

    /* pages 2 and 3 · the recurrence; Reduce is trained into the head, so it is data */
    /* page 4 · which trained model the window is asked; declared before the recurrence block so the
       recurrence's own controls follow it when it names one */
    modelSec: { type: "section", label: S.modelSection, when: ON("occlusion") },
    model: {
      type: "segmented", label: S.modelLabel, detail: S.modelDetail,
      options: [{ value: "cnn", label: "1D-CNN" }, { value: "lstm", label: "LSTM" }, { value: "combo", label: "CNN + LSTM" }], default: "cnn", when: ON("occlusion"),
    },

    recurSec: { type: "section", label: S.recurSection, when: ON_RECURRENCE },
    direction: {
      type: "segmented", label: S.directionLabel, detail: S.directionDetail,
      options: [{ value: "uni", label: "One way" }, { value: "bi", label: "Both ways" }], default: "bi", when: ON_RECURRENCE,
    },
    reduce: {
      type: "segmented", label: S.reduceLabel, detail: S.reduceDetail,
      options: [{ value: "last", label: "Last" }, { value: "mean", label: "Mean" }, { value: "max", label: "Max" }], default: "max", when: ON_RECURRENCE,
    },

    windowSec: { type: "section", label: S.windowSection, when: ON("occlusion") },
    window: {
      type: "choice", label: S.windowLabel, detail: S.windowDetail,
      options: [8, 16, 32, 64].map((k) => ({ value: String(k), label: String(k), detail: `${k} samples = ${M.ms(k).toFixed(0)} ms, stride ${k / 2}` })),
      default: "32", when: ON("occlusion"),
    },
    baseline: {
      type: "segmented", label: S.baselineLabel, detail: S.baselineDetail,
      options: [{ value: "zero", label: "Zero" }, { value: "mean", label: "Window mean" }], default: "zero", when: ON("occlusion"),
    },
    lookOcc: { type: "section", label: S.lookSection, afterDrive: true, when: ON("occlusion") },
    overlay: {
      type: "segmented", label: S.overlayLabel, detail: S.overlayDetail,
      options: [{ value: "off", label: "Off" }, { value: "on", label: "On" }], default: "on", display: true, afterDrive: true, when: ON("occlusion"),
    },

    /* authoring escape hatch, first render only: presses already taken on the page it opens with */
    shown: { type: "int", min: 0, max: 99, default: 0, hidden: true },
  },

  legend: ({ params }) => (params.page === "combo" ? S.legend.lstm : S.legend[params.page]) ?? S.legend.cnn,

  compute,

  regions: ({ w, params, state, anim }) => {
    if (!state || params.page !== "cnn" || (anim?.n?.cnn ?? 0) < 1) return [];
    const X0 = PAD_L, X1 = w - PAD_R;
    const rows = Array.from({ length: M.C1 }, (_, c) => ({ x: X0, y: CNN.mapsTop + c * CNN.rowH, w: X1 - X0, h: CNN.rowH, set: { follow: String(c + 1) }, label: `kernel ${c + 1}` }));
    const buckets = 30, bw = (X1 - X0) / buckets;
    const stops = Array.from({ length: buckets }, (_, b) => ({
      x: X0 + b * bw, y: CNN.traceTop, w: bw, h: CNN.traceBot - CNN.traceTop,
      set: { stop: Math.round((b + 0.5) * (M.L / buckets)) }, label: `window at sample ${Math.round((b + 0.5) * (M.L / buckets))}`,
    }));
    return [...rows, ...stops];
  },

  animation: {
    stepLabel: { anim: "labelAt", labels: S.stepLabels, default: S.stepLabels.cnn0 },
    stepTitle: { anim: "labelAt", labels: S.stepTitles, default: S.stepTitles.cnn0 },
    runLabel: "Play",
    runTitle: S.runTitle,

    init: ({ params, state, fromScratch }) => {
      const shown = fromScratch ? 0 : Math.max(0, Number(params.shown) || 0);
      const anim = { page: params.page, n: { cnn: 0, lstm: 0, combo: 0 }, occ: 0, t: 1, moving: false, halt: false };
      if (params.page === "occlusion") anim.occ = Math.min(state.occ.windows.length, shown);
      else anim.n[params.page] = Math.min(STAGES[params.page], shown);
      anim.done = isDone(anim, state);
      settle(anim);
      return anim;
    },

    advance: (anim, { dt, state }) => {
      /* a press a page switch finished (`rebuild`) ends here, before it takes the new page's press */
      if (anim.halt) { anim.halt = false; anim.moving = false; settle(anim); return false; }
      const stepping = anim.mode === "step";
      const before = countOf(anim);
      let more = takePress(anim, dt, state);
      const after = countOf(anim);
      anim.done = isDone(anim, state);
      if (stepping && after > before) anim.pressEnd = after;
      if (stepping && anim.pressEnd != null && after >= anim.pressEnd && anim.t >= 1) { more = false; anim.pressEnd = null; }
      if (anim.done) more = false;
      anim.moving = more;
      settle(anim);
      return more;
    },

    rebuild: (anim, { params, state }) => {
      /* A press belongs to the page it started on: core keeps a running loop
         through a display change, so a switch mid-press used to run the other
         page's press (the 2026-09-20 sweep). The press finishes here and the
         loop ends at its next frame. */
      if (anim.moving && params.page !== anim.page) { anim.t = 1; anim.halt = true; anim.pressEnd = null; }
      anim.page = params.page;
      anim.done = isDone(anim, state);
      settle(anim);
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    if (params.page === "lstm") drawLstm(ctx, colors, w, params, state, anim);
    else if (params.page === "combo") drawCombo(ctx, colors, w, params, state, anim);
    else if (params.page === "occlusion") drawOcclusion(ctx, colors, w, params, state, anim);
    else drawCnn(ctx, colors, w, params, state, anim);
  },

  readout({ params, state, anim }) {
    if (params.page === "lstm" || params.page === "combo") {
      const m = params.page === "lstm" ? state.lstm : state.combo;
      const Fd = m.reading.feats[0].length, count = anim?.n?.[params.page] ?? 0;
      const reduced = params.page === "lstm" ? count >= 2 : count >= 3;
      return [
        { label: S.tileP, value: reduced ? m.reading.p[1].toFixed(2) : S.tileWait, note: S.tilePNote },
        { label: S.tileReduce, value: params.reduce, note: S.tileReduceNote(m.T, Fd) },
        { label: S.tileAcc, value: reduced ? `${Math.round(100 * m.acc)}%` : S.tileWait, note: S.tileAccNote },
      ];
    }
    if (params.page === "occlusion") {
      const i = anim?.occ ?? 0, n = state.occ.windows.length, done = i >= n && (anim?.t ?? 1) >= 1;
      return [
        { label: S.tileP, value: state.occ.base.toFixed(2), note: S.tilePNoteModel(state.occ.model) },
        { label: S.tileWindow, value: `${Math.min(i, n)} / ${n}`, note: S.tileWindowNote(state.occ.k, state.occ.stride) },
        { label: S.tileWidth, value: done ? String(M.halfMaxWidth(state.occ.attr)) : S.tileWait, note: state.frag.ectopic.length ? S.tileWidthNote : S.tileWidthNoteNone },
      ];
    }
    const last = state.chain[state.chain.length - 1];
    const count = anim?.n?.cnn ?? 0, classified = count >= 3 && (anim?.t ?? 1) >= 1;
    return [
      { label: S.tileK, value: `${M.ms(state.k).toFixed(0)} ms`, note: S.tileKNote(state.k) },
      { label: S.tileReach, value: count >= 2 ? `${last.rf} samples = ${M.ms(last.rf).toFixed(0)} ms` : S.tileWait, note: S.tileReachNote },
      { label: S.tileAcc, value: classified ? `${Math.round(100 * state.cnn.acc)}%` : S.tileWait, note: S.tileAccNote },
    ];
  },

  summary({ params, state, anim }) {
    if (params.page === "lstm") return S.sum.lstm(anim?.n?.lstm ?? 0);
    if (params.page === "combo") return S.sum.combo(anim?.n?.combo ?? 0);
    if (params.page === "occlusion") return S.sum.occ(anim?.occ ?? 0, state.occ.windows.length);
    return S.sum.cnn(anim?.n?.cnn ?? 0);
  },
});
