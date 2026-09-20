/* ============================================================================
   Widget 75 · Deep Learning - Sequences: CNN and LSTM

   PHM5005 07-3 cells 26–178, four pages in the notebook's own order: the
   lesson's `CNN1D` on tokenized DNA, its `BiLSTM` with `pack_padded_sequence`,
   its `CNN_LSTM`, and Captum's `Occlusion` with PAD as the baseline. The
   sequence halves of 73's four pages, on the same engine. `model.js` is the
   stage and the nets, `table.js` the trained weights; this file draws and
   paces, and holds every string a reader sees.

   THE MISCONCEPTIONS, one a page (the catalogue's § 75):
     1D-CNN      a 1D kernel is a smoothing filter — on one-hot DNA a [4, k]
                 kernel IS a position weight matrix, its feature map the
                 motif's score at every position, and a trained kernel spells
                 the motif by column argmax; the global max reads 125
                 positions of which 22 are padding.
     LSTM        "the last state" is the state after the last real base —
                 unpacked it is the state after fifty PAD steps, which carries
                 nothing: one direction, unpacked, scores chance on a task the
                 packed recurrence reads at 97%; both ways, the reverse pass
                 reads the PAD first and its score survives.
     CNN + LSTM  the lesson's final states summarise a localized event —
                 they stay at chance where max over the steps reaches 99%.
     Occlusion   an attribution map has the sequence's resolution — it has
                 the window's, and two copies of the motif each read as
                 unimportant.

   DECISIONS TAKEN AT THE MOCK (his picks, 2026-09-20), so they are not
   re-argued:
    1. NOTHING TRAINS IN THE PAGE. Every net the rail can reach was trained
       ahead by `_lab/sequence-cnn-lstm-table.mjs` and shipped in `table.js`
       (the CNN the best of three initialisations, probed six epochs each,
       because seven sweeps found the initialisation decides whether a seed
       finds the motif at all). Seed draws the sequence shown and nothing
       else. The loss curves are the table's.
    2. TWO TASKS, a data control: a planted TGACTCA (the CNN's reading), and
       GC-rich against GC-poor (the task a recurrence at H = 8 can read; on
       the motif it stays at chance in any budget, and the page says so).
    3. ONE-HOT · LEARNED as a data control: on one-hot the kernel is the
       matrix itself; through a learned table it is the kernel composed with
       the table, and the page reads that.
    4. STRIDE 1 · 2, default 1: at the lesson's 2 a trained net reads the
       motif at one offset parity only, which the readout prints.
    5. THE LSTM PAGE reads the lesson's final states and nothing else;
       Direction and Pack are its controls, default one way and packed. The
       CNN + LSTM page stands on page 1's trained first layer, as 73's did,
       and offers last · max.
    6. OCCLUSION's baseline is PAD only (against N the maps correlate 0.98);
       k = 4 · 8 · 12 at stride k / 2; any of the three models is asked.
   ========================================================================= */

import { defineWidget, makeRng } from "../core/index.js";
import * as M from "./model.js";
import * as E from "../signal-cnn-lstm/engine.js";
import { TABLE, SPEC } from "./table.js";

/* ------------------------------------------------------------- the pages -- */

const PAGES = [
  { value: "cnn", label: "1D-CNN" },
  { value: "lstm", label: "LSTM" },
  { value: "combo", label: "CNN + LSTM" },
  { value: "occlusion", label: "Occlusion" },
];
const ON = (page) => ({ param: "page", equals: page });
const ON_TASK = (task) => ({ param: "task", equals: task });
const ON_LSTM = { any: [ON("lstm"), { all: [ON("occlusion"), { param: "model", equals: "lstm" }] }] };
const ON_COMBO = { any: [ON("combo"), { all: [ON("occlusion"), { param: "model", equals: "combo" }] }] };
const MODEL_NAMES = { cnn: "1D-CNN", lstm: "LSTM", combo: "CNN + LSTM" };

const STAGES = { cnn: 3, lstm: 3, combo: 4 };
const DUR = {
  cnn: [2200, 700, 1200],
  lstm: [1800, 600, 1400],
  combo: [700, 1400, 600, 1200],
};
const WINDOW_MS = 220;
const PREFIX_EVERY = 10;
const ROW_LEN = 40;   // cell 178 wraps the letters at 40

/* The input panel every model page opens with (his round 1, 2026-09-20: the
   letters at the top with the motif bold, the same panel on every page, and
   the learned table drawn as its own rows): the sequence's letters wrapped at
   40, then the encoded rows on the 250-token axis — four one-hot rows, or the
   embedding's eight — with a bar under the motif. Everything below sits at an
   offset from its bottom, which depends on the encoding. */
const INPUT = { top: 22, lineH: 14, rowH: 8, gap: 10 };
const lettersBot = INPUT.top + 5 * INPUT.lineH;
const rowsTop = lettersBot + INPUT.gap;
const nRows = (code) => (code === "onehot" ? 4 : SPEC.E);
const inputBot = (code) => rowsTop + nRows(code) * INPUT.rowH + 16;
const cnnGeom = (b) => ({ kernHead: b + 18, kernTop: b + 26, cell: 11, mapsHead: b + 112, mapsTop: b + 120, mapRowH: 11, spellW: 112, chainHead: b + 236, outsY: b + 316, lossHead: b + 360, lossTop: b + 368, lossH: 34 });
const lstmGeom = (b) => ({ embY: b + 14, blockTop: b + 44, cellH: 7, gap: 6, reduceGap: 22, reduceH: 12, runGap: 66, runH: 70, lossGap: 44, lossH: 34 });
const comboGeom = (b) => ({ featsHead: b + 14, featsTop: b + 20, featCellH: 6, permY: b + 88, blockTop: b + 118, cellH: 6, gap: 6, reduceGap: 22, reduceH: 12, runGap: 66, runH: 70, lossGap: 44, lossH: 34 });
const HEIGHTS = {
  cnn: (code) => inputBot(code) + 420,
  lstm: (code, direction) => inputBot(code) + 362 + (direction === "bi" ? SPEC.H * 7 + 6 : 0),
  combo: (code) => inputBot(code) + 498,
  occlusion: 236,
};

/* ------------------------------------------------------------- the copy --- */

const S = {
  subtitle:
    "A DNA sequence reaches a network as tokens: one-hot rows or a learned table. Over those rows a "
    + "1D kernel is a position weight matrix and its feature map is a motif's score at every base; a "
    + "packed recurrence stops at the last real base, and its final state is what the linear layer reads; "
    + "occlusion sets a window of tokens to PAD and asks the model again.",
  pageLabel: "Page",
  pageDetail: "the three models, then occlusion on any of them",
  seqSection: "The sequence",
  taskLabel: "Task",
  taskDetail: "what separates the two classes: one planted motif, TGACTCA, or the fraction of G and C",
  copiesLabel: "Copies of the motif",
  copiesDetail: "how many copies the sequence shown carries; 0 is the other class — the models were trained on one copy",
  clsLabel: "Class",
  clsDetail: "which class the sequence shown is drawn from: G or C at 0.7, or at 0.3",
  codeLabel: "Encoding",
  codeDetail: "how a token reaches the first layer: four fixed one-hot rows, or a table of eight learned values a token",
  seedLabel: "Seed",
  seedDetail: "the sequence shown, reproducibly; the trained models do not change",
  layerSection: "The first layer",
  kLabel: "Kernel size k",
  kDetail: "how many bases one output of the first layer reads",
  strideLabel: "Stride",
  strideDetail: "how far the window moves between outputs",
  headSection: "The head",
  poolLabel: "Pool",
  poolDetail: "how the last feature maps are collapsed to one value a channel before the linear layer",
  lookSection: "Look at",
  followLabel: "Kernel",
  followDetail: "which of the eight first-layer kernels is read as a matrix; a click on its map does the same",
  stopLabel: "Window at base",
  stopDetail: "where the window sits once it has slid; a click on the rows picks it",
  recurSection: "The recurrence",
  directionLabel: "Direction",
  directionDetail: "one pass along the sequence, or a forward and a reverse pass whose final states are joined",
  packLabel: "Pack",
  packDetail: "whether the recurrence stops at the last real base or reads the fifty PAD tokens after it",
  reduceLabel: "Reduce",
  reduceDetail: "how the outputs at every step are summarised for the linear layer; the head was trained on this summary",
  modelSection: "The model",
  modelLabel: "Model",
  modelDetail: "which trained model the window is asked; the method is the same for any of them",
  windowSection: "The window",
  windowLabel: "Window k",
  windowDetail: "how many tokens are set to PAD at once; the stride is k / 2, half a window",
  heatLabel: "Heat",
  heatDetail: "the attribution drawn behind each letter once every window has been occluded",

  stepLabels: {
    cnn0: "Slide the kernel", cnn1: "Stack the layers", cnn2: "Classify", cnn3: "Classify",
    lstm0: "Run the recurrence", lstm1: "Read the final states", lstm2: "Predict along the sequence", lstm3: "Predict along the sequence",
    combo0: "Extract the maps", combo1: "Run the recurrence", combo2: "Reduce", combo3: "Predict along the maps", combo4: "Predict along the maps",
    occ: "Next window",
  },
  stepTitles: {
    cnn0: "Move the kernel across the one-hot rows and write one value of its feature map at each stop",
    cnn1: "Convolve again, and draw how many bases one output of the second layer reads and which outputs read padding only",
    cnn2: "Collapse each feature map to one number, apply the linear layer, and draw the training that set the weights",
    cnn3: "Every stage of this page is drawn",
    lstm0: "Run the recurrence along the sequence, one base a step, and fill the block of its outputs",
    lstm1: "Take the final states and apply the linear layer",
    lstm2: "Ask the model what it would say if the sequence ended at each base",
    lstm3: "Every stage of this page is drawn",
    combo0: "Run the sequence through page 1's trained first layer: 250 steps of 8 features",
    combo1: "Run the recurrence along those steps, packed to the real ones",
    combo2: "Summarise the block by the chosen reduction and apply the linear layer",
    combo3: "Ask the model what it would say if the maps ended at each step",
    combo4: "Every stage of this page is drawn",
    occ: "Set the next window of tokens to PAD, ask the model again, and record the change",
  },
  runTitle: "Run the remaining presses of this page in order",

  legend: {
    cnn: [
      { token: "empirical", label: "A one-hot cell, and each feature map drawn light to dark", mark: "bar" },
      { token: "value-high", label: "A positive kernel weight, or contribution" },
      { token: "value-low", label: "A negative kernel weight, or contribution" },
      { token: "highlight", label: "The window, the kernel being read, the output whose reach is drawn" },
      { token: "reference", label: "Where the motif is; the motif as a matrix" },
    ],
    lstm: [
      { token: "value-high", label: "A positive output of the recurrence" },
      { token: "value-low", label: "A negative output" },
      { token: "highlight", label: "The states the linear layer reads" },
      { token: "empirical", label: "The model's probability if the sequence ended at that base", mark: "line" },
      { token: "reference", label: "Where the motif is" },
    ],
    occlusion: [
      { token: "extreme", label: "The window set to PAD" },
      { token: "magnitude", label: "Attribution: how far the probability moved when the window covering that base was occluded", mark: "bar" },
      { token: "reference", label: "Where the motif is" },
    ],
  },

  /* canvas captions */
  capInput: (code) => (code === "onehot" ? `tokens [${M.MAX_LEN}] → one-hot [4, ${M.MAX_LEN}]` : `tokens [${M.MAX_LEN}] → Embedding [${M.MAX_LEN}, ${SPEC.E}] → transpose [${SPEC.E}, ${M.MAX_LEN}]`),
  capPad: "PAD",
  capTruth: (task, cls, extra) => (task === "motif" ? (cls ? `the sequence shown: motif, ${extra} ${extra === 1 ? "copy" : "copies"}` : "the sequence shown: no motif") : `the sequence shown: ${cls ? "GC-rich" : "GC-poor"} · GC ${extra.toFixed(2)}`),
  capWindow: (k) => `window · k = ${k} bases`,
  capKernel: (c, k, code) => `kernel ${c} read as a matrix [4, ${k}]${code === "learned" ? " through the table" : ""}`,
  capSpell: (spell, match, k, offset) => `spells ${spell}: ${match} of ${Math.min(k, M.MOTIF.length)} columns the motif's${offset ? ` at a shift of ${offset > 0 ? "+" : ""}${offset}` : ""}`,
  capMotifMatrix: "the motif as a matrix",
  capBand: (t) => `at base ${t}: the window's bases, each read by its column`,
  capBandSum: (v) => `sum ${v.toFixed(2)}`,
  capBandRelu: (v) => `ReLU → ${v.toFixed(2)}`,
  capMaps: (c, L1) => `Conv1 → ReLU · [${c}, ${L1}] · each output under the window it read`,
  capChain: "The stack, one output's reach, and the global max",
  capSees: (rf) => `sees ${rf} bases`,
  capOutputs: (L2, pad) => `Conv2 outputs · ${L2} · ${pad} read padding only`,
  capReach: (rf, jump) => `one output reads ${rf} bases; neighbours ${jump} apart`,
  capHead: (pool, c2) => `${pool === "avg" ? "AdaptiveAvgPool1d(1)" : "AdaptiveMaxPool1d(1)"} → Linear(${c2}, 2)`,
  capLoss: (n, e, r, p) => `loss by epoch · ${n} fresh sequences an epoch · ${e} epochs · the best of ${r} initialisations, each probed for ${p}`,
  capLossLstm: (n, e) => `loss by epoch · ${n} fresh sequences an epoch · ${e} epochs · H = ${SPEC.H}`,
  capProbe: (v) => v.toFixed(2),
  capPred: (p, name) => `p(${name}) = ${p.toFixed(2)}`,
  capEmbed: (code, packed) => `${code === "onehot" ? "one-hot" : "Embedding"} [B, ${M.MAX_LEN}, ${code === "onehot" ? 4 : SPEC.E}]${packed ? ` · pack_padded_sequence: ${M.LEN} real steps` : ` · unpacked: all ${M.MAX_LEN} steps`}`,
  capBlock: (T, F) => `output · [${T}, ${F}]`,
  capHalfFwd: (H) => `h→ · forward pass · ${H} rows`,
  capHalfRev: (H) => `h← · reverse pass · ${H} rows`,
  capLastAt: (T, packed) => (packed ? `last · the state after base ${T}, the last real one` : `last · the state after step ${T}, fifty PAD tokens past the last real base`),
  capReduced: (name, T, F) => `${name} · [${T}, ${F}] → [${F}] → Linear(${F}, 2)`,
  capFromFwd: (H) => `from h→ [${H}]`,
  capFromRev: (H) => `from h← [${H}]`,
  capHow: {
    last: (T, bi) => (bi ? `concat: the forward pass's state at step ${T} and the reverse pass's at step 1 — the two framed columns` : `the state at step ${T} — the framed column`),
    max: (T) => `each row's largest value over its ${T} steps — the marked cells`,
  },
  capRunning: (name) => `if the sequence ended here: p(${name})`,
  capRunningCombo: (name) => `if the maps ended here: p(${name})`,
  capFeats: (C, L) => `page 1's trained first layer: Conv1 → ReLU · [${C}, ${L}]`,
  capPermuteCombo: (L, C) => `transpose: [B, ${C}, ${L}] → [B, ${L}, ${C}] · pack to the real steps`,
  capNoMotifLstm: "on the motif task this recurrence stays at chance in any budget; it reads composition",
  capFx: (p, model) => `f(x) = ${p.toFixed(2)} · f is the trained ${model}`,
  capOccluded: (p, a) => `window at PAD: f = ${p.toFixed(2)} · change ${a.toFixed(2)}`,
  capAttr: (k, s) => `attribution by position · k = ${k}, stride ${s} · padding stripped`,
  capHalfMax: (n) => `half-max width ${n} bases`,
  capMotif: "the motif",
  capCopies: "the copies",
  className: { motif: ["No motif", "Motif"], composition: ["GC-poor", "GC-rich"] },

  /* readout */
  tileK: "Kernel size",
  tileKNote: "bases one first-layer output reads",
  tileReach: "One Conv2 output reads",
  tileReachNote: "the receptive field after the second convolution, in bases",
  tileAcc: "Held-out accuracy",
  tileAccNote: (n) => `${n} sequences outside the training set, scored when the table of models was made`,
  tileParity: "By the motif's offset",
  tileParityNote: "held-out class-1 accuracy with the motif at an even base, then at an odd one",
  tileWait: "—",
  tileP: (name) => `p(${name})`,
  tilePNote: (truth) => `the trained model's probability for the whole sequence, which is ${truth}`,
  tilePNoteModel: (model, truth) => `the trained ${model}'s probability for the whole sequence, which is ${truth}`,
  truthOf: (task, cls, extra) => (task === "motif" ? (cls ? `a motif sequence, ${extra} ${extra === 1 ? "copy" : "copies"}` : "a sequence with no motif") : `${cls ? "GC-rich" : "GC-poor"} at GC ${extra.toFixed(2)}`),
  tileMove: "The state's move over the padding",
  tileMoveNote: "how far the forward state moved between the last real base and step 250, as a fraction of its norm there",
  tileMovePacked: "0 · packed",
  tileReduce: "Reduction",
  tileReduceNote: (T, F) => `output [${T}, ${F}] summarised to one vector of ${F}; the head was trained on it`,
  tileWindow: "Windows occluded",
  tileWindowNote: (k, s) => `of ${k} tokens at stride ${s}`,
  tileWidth: "Half-max width of the map",
  tileWidthNote: "bases above half the largest attribution; the motif is 7 wide",
  tileWidthNoteNone: "bases above half the largest attribution; this sequence has no motif",

  /* summary */
  sum: {
    cnn: (n) => ["the sequence alone", "the kernel read as a matrix and its feature map", "the stack, one output's reach and the global max", "the classification and the training curve"][n],
    lstm: (n) => ["the sequence alone", "the block of the recurrence's outputs", "the final states and the linear layer", "the prediction at every base"][n],
    combo: (n) => ["the sequence alone", "the first layer's maps", "the block of the recurrence's outputs", "the block reduced to one vector", "the prediction at every step"][n],
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
const letterFont = (colors) => `${colors.fsSm} ${colors.mono}`;
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

const PAD_L = 44, PAD_R = 14;
/** the x of token `t` on the sequence's axis, 250 columns across the stage */
const px = (w, t) => PAD_L + (t / M.MAX_LEN) * (w - PAD_R - PAD_L);
const colW = (w) => (w - PAD_R - PAD_L) / M.MAX_LEN;
/** the input base under the centre of first-layer output `t` */
const centreOf = (t, k, stride, pad) => t * stride - pad + (k - 1) / 2;
const isGC = (id) => id === 2 || id === 3;

/* ----------------------------------------------------------- the geometry */

const OCC = { lettersTop: 34, lineH: 14, attrHead: 122, attrTop: 130, attrH: 56 };

/* ================================================================ compute */

/** a net from the table, rebuilt from its spec and filled with the shipped weights; cached by key */
const nets = new Map();
function fromTable(key, build) {
  if (nets.has(key)) return nets.get(key);
  const entry = TABLE[key];
  if (!entry) throw new Error(`sequence-cnn-lstm: no trained net in the table at ${key}`);
  const net = M.loadWeights(build(makeRng(1)), M.decodeWeights(entry.w));
  const out = { net, curve: entry.curve, probes: entry.probes ?? null, best: entry.best ?? 0, acc: entry.acc };
  nets.set(key, out);
  return out;
}

function compute({ params }) {
  const seed = params.seed, task = params.task, code = params.code;
  const copies = task === "motif" ? Number(params.copies) : 1;
  const cls = task === "motif" ? (copies > 0 ? 1 : 0) : (params.cls === "rich" ? 1 : 0);
  const seqOpts = task === "motif" ? { copies: Math.max(1, copies) } : { task: "composition", gc: SPEC.gc };
  const seq = M.sequence(makeRng(seed * 7 + 3), cls, seqOpts);
  const x = seq.x;
  const k = Number(params.k), stride = Number(params.stride), pad = M.samePad(k), pool = params.pool;

  const cnn = fromTable(M.keyCnn({ task, code, k, stride, pool }), (r) => M.buildCnn(r, { code, E: SPEC.E, k, stride, pool, channels: SPEC.channels }));
  const acts = cnn.net.activations(x);
  const chain = M.chain({ k, stride });
  const pred = E.predict(cnn.net, x);
  const L1 = acts[1].L;
  const kernels = M.kernelsSpelled(cnn.net);
  const follow = Math.max(0, Math.min(M.C1 - 1, Number(params.follow) - 1));
  const followed = kernels.find((q) => q.c === follow);
  /* the read at one stop: the output whose window centre is nearest `stop` */
  const stop = Math.max(1, Math.min(M.LEN, Number(params.stop))) - 1;
  let stopT = 0, best = Infinity;
  for (let t = 0; t < L1; t++) { const d = Math.abs(centreOf(t, k, stride, pad) - stop); if (d < best) { best = d; stopT = t; } }
  /* the parity readout: the table's held-out class-1 accuracy by the motif's offset, computed on a fixed set */
  let parity = null;
  if (task === "motif") {
    const test = M.dataset(makeRng(SPEC.testSeed), SPEC.nTest, 1).filter((d) => d.y === 1);
    const by = [0, 1].map((par) => { const s = test.filter((d) => d.motifAt[0] % 2 === par); return E.accuracy(cnn.net, s); });
    parity = by;
  }

  const extra = task === "motif" ? copies : M.gcOf(x.tok);
  const truth = S.truthOf(task, cls, extra);
  const state = { seq, x, task, code, cls, extra, truth, cnn, acts, chain, pred, k, stride, pad, L1, kernels, followed, stopT, parity, lstm: null, combo: null, occ: null };
  const names = S.className[task];

  const lstmOf = () => {
    const packed = params.pack === "on";
    const m = fromTable(M.keyLstm({ task, code, direction: params.direction, pack: packed }), (r) => M.buildSeqModel(r, { code, E: SPEC.E, direction: params.direction, pack: packed, reduce: "last", H: SPEC.H }));
    return m;
  };
  const comboOf = () => fromTable(M.keyCombo({ task, code, k, stride, pool, reduce: params.reduce }), (r) => M.buildFeatureLstm(r, { D: SPEC.channels[0], H: SPEC.H, pack: true, reduce: params.reduce }));

  if (params.page === "lstm") {
    const m = lstmOf();
    const reading = M.seqReading(m.net, x);
    const running = M.prefixCurve(m.net, x, PREFIX_EVERY);
    state.lstm = { ...m, reading, running, T: reading.T, packed: params.pack === "on", drift: params.pack === "on" ? 0 : M.padDrift(m.net, x).move };
  }
  if (params.page === "combo") {
    const m = comboOf(), X = M.convFeatures(cnn.net, x);
    const z = m.net.forward(X);
    const reading = { feats: m.net.clf.feats.map((r) => r.slice()), reduced: m.net.clf.z.slice(), arg: Array.from(m.net.clf.arg), p: E.softmaxCE(z, 0).p, T: m.net.T };
    const running = [];
    for (let t = PREFIX_EVERY - 1; t < x.len; t += PREFIX_EVERY) running.push({ t, p: E.predict(m.net, M.convFeatures(cnn.net, M.prefixAt(x, t)))[1] });
    state.combo = { ...m, X, reading, running, T: reading.T };
  }
  if (params.page === "occlusion") {
    const predict = params.model === "lstm" ? ((m) => (q) => E.predict(m, q)[1])(lstmOf().net)
      : params.model === "combo" ? ((m) => (q) => E.predict(m, M.convFeatures(cnn.net, q))[1])(comboOf().net)
        : (q) => E.predict(cnn.net, q)[1];
    const kw = Number(params.window);
    state.occ = M.occlusionWalk(predict, x, { k: kw, stride: Math.max(1, kw / 2), baseline: "pad" });
    state.occ.model = MODEL_NAMES[params.model] ?? MODEL_NAMES.cnn;
  }
  state.names = names;
  return state;
}

/* ================================================================== anim */

const countOf = (anim) => (anim.page === "occlusion" ? anim.occ : anim.n[anim.page] ?? 0);
function settle(anim) { anim.labelAt = anim.page === "occlusion" ? "occ" : `${anim.page}${anim.n[anim.page]}`; }
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

const stageT = (anim, n, count) => (count > n ? 1 : count === n ? ease(anim.t) : 0);

/** the cell of letter `t` in rows of 40: its left edge, its baseline (row 0's at `base`) and the pitch */
function letterCell(w, t, base) {
  const pitch = (w - PAD_R - PAD_L) / ROW_LEN;
  return { x: PAD_L + (t % ROW_LEN) * pitch, y: base + Math.floor(t / ROW_LEN) * INPUT.lineH, pitch };
}

/**
 * The input panel: the sequence's letters (the motif bold in the reference
 * colour; on composition G and C in ink and A and T lighter), then the encoded
 * rows on the token axis — the four one-hot rows, or the embedding's rows read
 * from the page's model — PAD shaded, a bar under each copy of the motif.
 * Returns the panel's bottom, where the page's own drawing starts.
 */
function drawInput(ctx, colors, w, state, code, emb) {
  const { x, seq, task, cls, extra } = state;
  const capIn = S.capInput(code), capTruth = S.capTruth(task, cls, extra);
  txt(ctx, colors, capIn, PAD_L, 14, { font: capFont(colors), fill: colors.ink1 });
  ctx.save(); ctx.font = capFont(colors); const inEnd = PAD_L + ctx.measureText(capIn).width; ctx.font = `${colors.fsXs} ${colors.font}`; const truthW = ctx.measureText(capTruth).width; ctx.restore();
  if (w - PAD_R - truthW > inEnd + 16) txt(ctx, colors, capTruth, w - PAD_R, 14, { fill: colors.reference, align: "right" });
  const inMotif = (t) => seq.motifAt.some((m) => t >= m && t < m + M.MOTIF.length);
  const small = letterCell(w, 0, 0).pitch < 9;
  for (let t = 0; t < M.LEN; t++) {
    const { x: lx, y: ly, pitch } = letterCell(w, t, INPUT.top + 12);
    const id = x.tok[t], motif = task === "motif" && inMotif(t);
    if (motif) rect(ctx, lx, ly - INPUT.lineH + 3, pitch, INPUT.lineH, wash(colors.reference, 0.22));
    const fill = motif ? colors.reference : task === "composition" ? (isGC(id) ? colors.ink1 : colors.ink3) : colors.ink1;
    txt(ctx, colors, M.VOCAB[id], lx + pitch / 2, ly, { font: `${motif ? "700 " : ""}${small ? colors.fsXs : colors.fsSm} ${colors.mono}`, fill, align: "center" });
  }
  const cw = colW(w), rows = nRows(code), rowH = INPUT.rowH;
  rect(ctx, px(w, M.LEN), rowsTop, px(w, M.MAX_LEN) - px(w, M.LEN), rows * rowH, colors.surface2);
  if (code === "onehot") {
    for (let t = 0; t < M.LEN; t++) { const bi = M.BASES.indexOf(x.tok[t]); if (bi >= 0) rect(ctx, px(w, t), rowsTop + bi * rowH, cw + 0.4, rowH - 1, colors.empirical); }
    "ACGT".split("").forEach((b, i) => txt(ctx, colors, b, PAD_L - 6, rowsTop + i * rowH + rowH - 1, { font: monoFont(colors), fill: colors.ink3, align: "right" }));
  } else {
    /* the embedding's rows: the table's value for each token, signed */
    const E_ = emb.E; let amax = 1e-9; for (const v of emb.W.v) amax = Math.max(amax, Math.abs(v));
    for (let t = 0; t < M.LEN; t++) for (let e = 0; e < E_; e++) rect(ctx, px(w, t), rowsTop + e * rowH, cw + 0.4, rowH - 1, signed(colors, emb.W.v[x.tok[t] * E_ + e], amax));
    for (let e = 0; e < E_; e++) txt(ctx, colors, `e${e + 1}`, PAD_L - 6, rowsTop + e * rowH + rowH - 1, { font: monoFont(colors), fill: colors.ink3, align: "right" });
  }
  txt(ctx, colors, S.capPad, (px(w, M.LEN) + px(w, M.MAX_LEN)) / 2, rowsTop + Math.floor(rows / 2) * rowH + 4, { fill: colors.ink3, align: "center" });
  const rowsBot = rowsTop + rows * rowH;
  for (const m of seq.motifAt) rect(ctx, px(w, m), rowsBot + 2, M.MOTIF.length * cw, 3, colors.reference);
  return inputBot(code);
}

function drawMatrix(ctx, colors, x0, y0, Mx, cell, amax, { spell = null, fill = null } = {}) {
  const k = Mx[0].length;
  for (let bi = 0; bi < 4; bi++) for (let j = 0; j < k; j++) rect(ctx, x0 + j * cell, y0 + bi * cell, cell - 1, cell - 1, fill ? fill(Mx[bi][j]) : signed(colors, Mx[bi][j], amax));
  "ACGT".split("").forEach((b, i) => txt(ctx, colors, b, x0 - 4, y0 + i * cell + cell - 2, { font: monoFont(colors), fill: colors.ink3, align: "right" }));
  if (spell) for (let j = 0; j < k; j++) txt(ctx, colors, spell[j], x0 + j * cell + cell / 2 - 0.5, y0 + 4 * cell + 10, { font: monoFont(colors), fill: colors.ink1, align: "center" });
  return x0 + k * cell;
}

function drawLossCurve(ctx, colors, x0, y0, h, curve, upto, caption, probes = null, probeAt = 0) {
  const n0 = curve.length, cx = (i) => x0 + (i / (n0 - 1)) * 220, cy = (v) => y0 + h - h * Math.min(1, v / 0.75);
  const n = Math.max(2, Math.min(n0, upto));
  polyline(ctx, curve.slice(0, n).map((_, i) => cx(i)), curve.slice(0, n).map(cy), colors.empirical, 1.4);
  if (probes) for (const p of probes) { ctx.save(); ctx.fillStyle = colors.ink3; ctx.beginPath(); ctx.arc(cx(probeAt - 1), cy(p), 2.4, 0, 7); ctx.fill(); ctx.restore(); }
  line(ctx, x0, y0 + h + 0.5, x0 + 220, y0 + h + 0.5, colors.axis);
  txt(ctx, colors, `${curve[0].toFixed(2)} → ${curve[n - 1].toFixed(2)}`, x0 + 228, y0 + h, { font: monoFont(colors) });
  if (caption) txt(ctx, colors, caption, x0 + 228, y0 + 12, { font: `600 ${colors.fsSm} ${colors.mono}`, fill: colors.ink1 });
}

function drawCnn(ctx, colors, w, params, state, anim) {
  const { x, seq, acts, chain, cnn, pred, k, stride, pad, L1, kernels, followed, stopT, code, task } = state;
  const X0 = PAD_L, X1 = w - PAD_R, cw = colW(w);
  const count = anim.n.cnn, tSlide = count === 1 ? ease(anim.t) : count > 1 ? 1 : 0;
  const follow = followed.c;
  const relu1 = acts[1];

  const CNN = cnnGeom(drawInput(ctx, colors, w, state, code, cnn.net.emb));
  const rowsBot = rowsTop + nRows(code) * INPUT.rowH;

  /* the window: slides through every stop with press 1, then parks at `stop` */
  const shownT = count === 1 && anim.t < 1 ? Math.round(tSlide * (L1 - 1)) : stopT;
  if (count >= 1) {
    const start = shownT * stride - pad;
    const wx0 = px(w, Math.max(0, start)), wx1 = px(w, Math.min(M.MAX_LEN, start + k));
    rect(ctx, wx0 - 1, rowsTop - 2, Math.max(2, wx1 - wx0) + 2, rowsBot - rowsTop + 3, wash(colors.highlight, 0.22), colors.highlight, 1.5);
    const right = wx1 + 6 + 120 > X1;
    txt(ctx, colors, S.capWindow(k), right ? wx0 - 6 : wx1 + 6, rowsBot + 13, { fill: colors.highlight, align: right ? "right" : "left" });
  }

  /* the kernel read as a matrix, the motif as a matrix, and the read at the shown stop */
  if (count >= 1) {
    const headText = S.capKernel(follow + 1, k, code);
    txt(ctx, colors, headText, X0, CNN.kernHead, { font: capFont(colors), fill: colors.ink1 });
    ctx.save(); ctx.font = capFont(colors); const headEnd = X0 + ctx.measureText(headText).width; ctx.restore();
    let amax = 1e-9; for (const r of followed.M) for (const v of r) amax = Math.max(amax, Math.abs(v));
    const endK = drawMatrix(ctx, colors, X0, CNN.kernTop, followed.M, CNN.cell, amax, { spell: followed.spell });
    txt(ctx, colors, S.capSpell(followed.spell, followed.match, k, followed.offset), X0, CNN.kernTop + 4 * CNN.cell + 24, { fill: colors.ink2 });
    let bx = endK + 26, capEnd = headEnd;
    if (task === "motif") {
      const motifM = M.motifKernel();
      /* the caption sits on the header's line, past the header's end when the matrix starts under it */
      const cx = Math.max(bx, headEnd + 14);
      txt(ctx, colors, S.capMotifMatrix, cx, CNN.kernHead, { fill: colors.reference });
      ctx.save(); ctx.font = `${colors.fsXs} ${colors.font}`; capEnd = cx + ctx.measureText(S.capMotifMatrix).width; ctx.restore();
      const endM = drawMatrix(ctx, colors, bx, CNN.kernTop, motifM, CNN.cell, 1, { spell: M.MOTIF, fill: (v) => (v > 0 ? colors.reference : wash(colors.reference, 0.12)) });
      bx = endM + 26;
    }
    /* the band: the window's bases, each read by its column of the matrix */
    const start = shownT * stride - pad;
    const contrib = [], letters = [];
    for (let j = 0; j < k; j++) { const pos = start + j; const id = pos >= 0 && pos < M.MAX_LEN ? x.tok[pos] : M.PAD; const bi = M.BASES.indexOf(id); letters.push(pos >= 0 && pos < M.LEN ? M.VOCAB[id] : "*"); contrib.push(bi >= 0 ? followed.M[bi][j] : 0); }
    const conv1 = cnn.net.conv1;
    const sum = contrib.reduce((a, b) => a + b, 0) + (conv1.b ? conv1.b.v[follow] : 0);
    if (bx + k * CNN.cell + 120 <= X1) {
      txt(ctx, colors, S.capBand(shownT * stride - pad + Math.floor(k / 2) + 1), Math.max(bx, capEnd + 14), CNN.kernHead, { fill: colors.ink2 });
      let cmax = 1e-9; for (const v of contrib) cmax = Math.max(cmax, Math.abs(v));
      const base = CNN.kernTop + 3 * CNN.cell;
      for (let j = 0; j < k; j++) {
        const h = 2.4 * CNN.cell * Math.abs(contrib[j]) / cmax;
        rect(ctx, bx + j * CNN.cell, base - (contrib[j] > 0 ? h : 0), CNN.cell - 1, h, contrib[j] >= 0 ? colors.valueHigh : colors.valueLow);
        txt(ctx, colors, letters[j], bx + j * CNN.cell + CNN.cell / 2 - 0.5, CNN.kernTop + 4 * CNN.cell + 10, { font: monoFont(colors), fill: colors.highlight, align: "center" });
      }
      line(ctx, bx, base + 0.5, bx + k * CNN.cell, base + 0.5, colors.axis);
      const sx = bx + k * CNN.cell + 10;
      txt(ctx, colors, S.capBandSum(sum), sx, CNN.kernTop + CNN.cell + 2, { font: monoFont(colors), fill: colors.ink1 });
      txt(ctx, colors, S.capBandRelu(Math.max(0, sum)), sx, CNN.kernTop + 2 * CNN.cell + 6, { font: monoFont(colors), fill: colors.ink1 });
    }
  }

  /* the feature maps, on the sequence's axis: output t under the centre of its window; each row spelled at the right */
  txt(ctx, colors, S.capMaps(M.C1, L1), X0, CNN.mapsHead, { font: capFont(colors), fill: colors.ink1 });
  const mapX1 = X1 - CNN.spellW;
  const mpx = (t) => X0 + (t / M.MAX_LEN) * (mapX1 - X0), mcw = (mapX1 - X0) / M.MAX_LEN;
  let maxAct = 1e-9; for (const v of relu1.d) if (v > maxAct) maxAct = v;
  const cellW = Math.max(1, mcw * stride);
  const revealed = count >= 2 || (count === 1 && anim.t >= 1);
  for (let c = 0; c < M.C1; c++) {
    const y = CNN.mapsTop + c * CNN.mapRowH;
    rect(ctx, X0, y, mapX1 - X0, CNN.mapRowH - 1, colors.surface2);
    const upto = c === follow ? (count === 1 && anim.t < 1 ? shownT + 1 : count >= 1 ? L1 : 0) : (revealed ? L1 : 0);
    for (let t = 0; t < upto; t++) {
      const v = relu1.d[c * L1 + t];
      if (v > 0) rect(ctx, mpx(centreOf(t, k, stride, pad)) - cellW / 2, y, cellW + 0.5, CNN.mapRowH - 1, ramp(colors, v / maxAct, colors.empirical));
    }
    txt(ctx, colors, `k${c + 1}`, X0 - 6, y + 9, { font: monoFont(colors), fill: c === follow ? colors.highlight : colors.ink3, align: "right" });
    if (revealed || (count >= 1 && c === follow)) {
      const q = kernels.find((z) => z.c === c);
      txt(ctx, colors, `${q.spell} ${q.match}/${Math.min(k, M.MOTIF.length)}`, mapX1 + 8, y + 9, { font: monoFont(colors), fill: c === follow ? colors.highlight : q.match >= Math.min(k, M.MOTIF.length) - 1 ? colors.ink1 : colors.ink3 });
    }
  }
  for (const m of seq.motifAt) line(ctx, mpx(m + 3.5), CNN.mapsTop, mpx(m + 3.5), CNN.mapsTop + M.C1 * CNN.mapRowH, wash(colors.reference, 0.6), 1, [2, 3]);
  if (count >= 1) {
    rect(ctx, X0 - 1, CNN.mapsTop + follow * CNN.mapRowH - 1, mapX1 - X0 + 2, CNN.mapRowH + 1, null, colors.highlight, 1.2);
    const cxm = mpx(centreOf(shownT, k, stride, pad));
    rect(ctx, cxm - cellW / 2 - 1, CNN.mapsTop + follow * CNN.mapRowH - 2, cellW + 2, CNN.mapRowH + 2, null, colors.highlight, 1.5);
  }

  /* the stack (press 2) */
  const tStack = stageT(anim, 2, count);
  if (tStack > 0) {
    ctx.save(); ctx.globalAlpha = tStack;
    txt(ctx, colors, S.capChain, X0, CNN.chainHead, { font: capFont(colors), fill: colors.ink1 });
    const rows = [{ name: code === "onehot" ? "one-hot" : "embedding", L: M.MAX_LEN, rf: 1 }, ...chain.rows];
    rows.forEach((r, i) => {
      const y = CNN.chainHead + 15 + i * 13;
      txt(ctx, colors, r.name, X0, y, { font: monoFont(colors), fill: colors.ink1 });
      txt(ctx, colors, `L = ${r.L}`, X0 + 132, y, { font: monoFont(colors) });
      if (i) txt(ctx, colors, S.capSees(r.rf), X0 + 200, y, { font: monoFont(colors), fill: i === rows.length - 1 ? colors.highlight : colors.ink2 });
    });
    txt(ctx, colors, S.capHead(params.pool, M.C2), X0, CNN.chainHead + 15 + rows.length * 13, { font: monoFont(colors) });
    const last = chain.rows[chain.rows.length - 1], L2 = last.L;
    const ox = (i) => X0 + (i / Math.max(1, L2 - 1)) * (X1 - X0);
    const focus = seq.motifAt.length ? seq.motifAt[0] + 3 : Math.floor(M.LEN / 2);
    const outI = Math.max(0, Math.min(L2 - 1, Math.round((focus - last.centre0) / last.jump)));
    cnn.net.forward(x);
    const arg = cnn.net.pool.arg;
    for (let i = 0; i < L2; i++) rect(ctx, ox(i) - 2, CNN.outsY, 4, 8, chain.padOnly.includes(i) ? colors.surface3 : colors.surface2);
    if (params.pool === "max") for (let c = 0; c < M.C2; c++) rect(ctx, ox(arg[c]) - 2, CNN.outsY, 4, 8, colors.empirical);
    rect(ctx, ox(outI) - 2, CNN.outsY, 4, 8, colors.highlight);
    txt(ctx, colors, S.capOutputs(L2, chain.padOnly.length), X1, CNN.outsY + 34, { align: "right", fill: colors.ink3 });
    const centre = last.centre0 + outI * last.jump, rf0 = centre - (last.rf - 1) / 2, rf1 = rf0 + last.rf;
    line(ctx, ox(outI), CNN.outsY, px(w, Math.max(0, rf0)), rowsBot, colors.highlight, 1, [3, 3]);
    line(ctx, ox(outI), CNN.outsY, px(w, Math.min(M.MAX_LEN, rf1)), rowsBot, colors.highlight, 1, [3, 3]);
    txt(ctx, colors, S.capReach(last.rf, last.jump), X0, CNN.outsY + 22, { fill: colors.ink2 });
    ctx.restore();
  }

  /* classify (press 3): the table's loss curve epoch by epoch, then the prediction */
  const tCls = stageT(anim, 3, count);
  if (tCls > 0) {
    ctx.save(); ctx.globalAlpha = Math.min(1, tCls * 3);
    txt(ctx, colors, S.capLoss(SPEC.cnn.n, SPEC.cnn.epochs, SPEC.cnn.restarts, SPEC.cnn.probe), X0, CNN.lossHead, { font: capFont(colors), fill: colors.ink1 });
    drawLossCurve(ctx, colors, X0, CNN.lossTop, CNN.lossH, cnn.curve, Math.ceil(tCls * cnn.curve.length), tCls >= 1 ? S.capPred(pred[1], state.names[1]) : null, tCls >= 1 ? cnn.probes : null, SPEC.cnn.probe);
    ctx.restore();
  }
}

/** the block of a recurrence's outputs, the states the head reads, and the running prediction — shared by the two recurrence pages */
function drawRecurrence(ctx, colors, w, params, m, G, count, anim, { xOfStep, top, runCaption, lossCaption, reduce, bi, packed, motifSteps, T, names, note = null }) {
  const X0 = PAD_L, X1 = w - PAD_R;
  const { reading, running, curve, acc } = m;
  const feats = reading.feats, Fd = feats[0].length, H = bi ? Fd / 2 : Fd;
  const tSweep = stageT(anim, 1, count), tRed = stageT(anim, 2, count), tRun = stageT(anim, 3, count);
  let amax = 1e-9; for (const r of feats) for (const v of r) amax = Math.max(amax, Math.abs(v));

  txt(ctx, colors, S.capBlock(T, Fd), X0, top - 8, { font: capFont(colors), fill: colors.ink1 });
  const stepW = xOfStep(1) - xOfStep(0);
  const rowY = (j) => top + j * G.cellH + (bi && j >= H ? G.gap : 0);
  const blockBot = rowY(Fd - 1) + G.cellH;
  rect(ctx, X0, top, X1 - X0, H * G.cellH, colors.surface2);
  if (bi) rect(ctx, X0, rowY(H), X1 - X0, H * G.cellH, colors.surface2);
  const upto = Math.floor(tSweep * T);
  for (let t = 0; t < upto; t++) for (let j = 0; j < Fd; j++) rect(ctx, xOfStep(t) - stepW / 2, rowY(j), stepW + 0.5, G.cellH, signed(colors, feats[t][j], amax));
  txt(ctx, colors, "h→", X0 - 6, top + H * G.cellH / 2 + 3, { font: monoFont(colors), fill: colors.ink2, align: "right" });
  if (bi) txt(ctx, colors, "h←", X0 - 6, rowY(H) + H * G.cellH / 2 + 3, { font: monoFont(colors), fill: colors.ink2, align: "right" });
  txt(ctx, colors, S.capHalfFwd(H), X1, top - 3, { align: "right", fill: colors.ink3 });
  if (bi) txt(ctx, colors, S.capHalfRev(H), X1, rowY(H) - 1, { align: "right", fill: colors.ink3 });
  if (tSweep > 0 && tSweep < 1) line(ctx, xOfStep(upto), top, xOfStep(upto), blockBot, colors.highlight, 1.5);
  for (const s of motifSteps) line(ctx, xOfStep(s), top, xOfStep(s), blockBot, wash(colors.reference, 0.6), 1, [2, 3]);

  let y = blockBot;
  if (tRed > 0) {
    const v = reading.reduced, cw = 14, gapV = bi ? 10 : 0;
    const vx = (j) => X0 + j * cw + (bi && j >= H ? gapV : 0);
    if (reduce === "last") {
      rect(ctx, xOfStep(T - 1) - stepW / 2 - 1.5, top - 1.5, stepW + 3, H * G.cellH + 3, null, colors.highlight, 1.5);
      if (bi) rect(ctx, xOfStep(0) - stepW / 2 - 1.5, rowY(H) - 1.5, stepW + 3, H * G.cellH + 3, null, colors.highlight, 1.5);
    } else {
      for (let j = 0; j < Fd; j++) rect(ctx, xOfStep(reading.arg[j]) - stepW / 2 - 1, rowY(j) - 1, stepW + 2, G.cellH + 2, null, colors.highlight, 1.2);
    }
    const rTop = blockBot + G.reduceGap;
    ctx.save(); ctx.globalAlpha = tRed;
    txt(ctx, colors, S.capReduced(reduce, T, Fd), X0, rTop - 8, { font: capFont(colors), fill: colors.ink1 });
    for (let j = 0; j < Fd; j++) rect(ctx, vx(j), rTop, cw, G.reduceH, signed(colors, v[j], amax), colors.grid);
    rect(ctx, vx(0) - 1, rTop - 1, H * cw + 2, G.reduceH + 2, null, colors.highlight, 1);
    if (bi) rect(ctx, vx(H) - 1, rTop - 1, H * cw + 2, G.reduceH + 2, null, colors.highlight, 1);
    txt(ctx, colors, S.capFromFwd(H), vx(0), rTop + G.reduceH + 11, { fill: colors.ink3 });
    if (bi) txt(ctx, colors, S.capFromRev(H), vx(H), rTop + G.reduceH + 11, { fill: colors.ink3 });
    if (reduce === "last") {
      line(ctx, xOfStep(T - 1), top + H * G.cellH, vx(0) + H * cw / 2, rTop, colors.highlight, 1, [2, 3]);
      if (bi) line(ctx, xOfStep(0), blockBot, vx(H) + H * cw / 2, rTop, colors.highlight, 1, [2, 3]);
    }
    txt(ctx, colors, reduce === "last" && packed != null ? S.capLastAt(T, packed) : S.capHow[reduce](T, bi), X0, rTop + G.reduceH + 25, { fill: colors.ink2 });
    txt(ctx, colors, S.capPred(reading.p[1], names[1]), vx(Fd - 1) + cw + 14, rTop + 10, { font: `600 ${colors.fsSm} ${colors.mono}`, fill: colors.ink1 });
    ctx.restore();
    y = rTop + G.reduceH + 30;
  }

  if (tRun > 0) {
    const rTop = blockBot + G.reduceGap + G.reduceH + G.runGap, rBot = rTop + G.runH;
    txt(ctx, colors, runCaption, X0, rTop - 8, { font: capFont(colors), fill: colors.ink1 });
    for (const p of [0, 0.5, 1]) { const yy = rBot - p * (rBot - rTop); line(ctx, X0, yy + 0.5, X1, yy + 0.5, colors.grid); txt(ctx, colors, p.toFixed(1), X0 - 6, yy + 3, { font: monoFont(colors), fill: colors.ink3, align: "right" }); }
    for (const s of motifSteps) rect(ctx, xOfStep(s) - 4, rTop, 8, rBot - rTop, wash(colors.reference, 0.12));
    const n = Math.max(1, Math.ceil(tRun * running.length));
    const pts = running.slice(0, n);
    polyline(ctx, pts.map((r) => xOfStep(r.t)), pts.map((r) => rBot - r.p * (rBot - rTop)), colors.empirical, 1.6);
    for (const r of pts) { ctx.save(); ctx.fillStyle = colors.empirical; ctx.beginPath(); ctx.arc(xOfStep(r.t), rBot - r.p * (rBot - rTop), 2.2, 0, 7); ctx.fill(); ctx.restore(); }
    if (tRun >= 1 && note) txt(ctx, colors, note, X0, rBot + 16, { fill: colors.ink3 });
    if (tRun >= 1) {
      const lTop = rBot + G.lossGap;
      txt(ctx, colors, lossCaption, X0, lTop - 8, { font: capFont(colors), fill: colors.ink1 });
      drawLossCurve(ctx, colors, X0, lTop, G.lossH ?? 34, curve, curve.length, `${Math.round(100 * acc)}% held out`);
    }
  }
}

function drawLstm(ctx, colors, w, params, state, anim) {
  const { lstm, seq, task, code, names } = state;
  const X0 = PAD_L;
  const LSTM = lstmGeom(drawInput(ctx, colors, w, state, code, lstm.net.emb));
  txt(ctx, colors, S.capEmbed(code, lstm.packed), X0, LSTM.embY, { font: monoFont(colors), fill: colors.ink1 });
  drawRecurrence(ctx, colors, w, params, lstm, LSTM, anim.n.lstm, anim, {
    xOfStep: (t) => px(w, t) + colW(w) / 2, top: LSTM.blockTop, runCaption: S.capRunning(names[1]), lossCaption: S.capLossLstm(SPEC.lstm.n, SPEC.lstm.epochs),
    reduce: "last", bi: params.direction === "bi", packed: lstm.packed, motifSteps: seq.motifAt.map((m) => m + 3), T: lstm.T, names,
    note: task === "motif" ? S.capNoMotifLstm : null,
  });
}

function drawCombo(ctx, colors, w, params, state, anim) {
  const { combo, seq, code, names } = state;
  const X0 = PAD_L, X1 = w - PAD_R, count = anim.n.combo;
  const Lp = combo.X.T, tFeat = stageT(anim, 1, count);
  const xOfStep = (t) => X0 + ((t + 0.5) / Lp) * (X1 - X0);
  const COMBO = comboGeom(drawInput(ctx, colors, w, state, code, state.cnn.net.emb));
  txt(ctx, colors, S.capFeats(M.C1, Lp), X0, COMBO.featsHead, { font: capFont(colors), fill: colors.ink1 });
  let fmax = 1e-9; for (const r of combo.X.feats) for (const v of r) fmax = Math.max(fmax, v);
  const cw = (X1 - X0) / Lp;
  rect(ctx, X0, COMBO.featsTop, X1 - X0, M.C1 * COMBO.featCellH, colors.surface2);
  const uptoF = Math.floor(tFeat * Lp);
  for (let t = 0; t < uptoF; t++) for (let c = 0; c < M.C1; c++) { const v = combo.X.feats[t][c]; if (v > 0) rect(ctx, X0 + t * cw, COMBO.featsTop + c * COMBO.featCellH, cw + 0.5, COMBO.featCellH, ramp(colors, v / fmax, colors.empirical)); }
  const stepOf = (m) => Math.round(((m + 3) / M.MAX_LEN) * Lp);
  for (const m of seq.motifAt) line(ctx, xOfStep(stepOf(m)), COMBO.featsTop, xOfStep(stepOf(m)), COMBO.featsTop + M.C1 * COMBO.featCellH, wash(colors.reference, 0.6), 1, [2, 3]);
  if (count >= 1) txt(ctx, colors, S.capPermuteCombo(Lp, M.C1), X0, COMBO.permY, { font: monoFont(colors), fill: colors.ink1 });
  const shifted = { n: { combo: count - 1 }, t: anim.t, page: "combo" };
  if (count >= 2) drawRecurrence(ctx, colors, w, params, combo, COMBO, count - 1, shifted, {
    xOfStep, top: COMBO.blockTop, runCaption: S.capRunningCombo(names[1]), lossCaption: S.capLossLstm(SPEC.combo.n, SPEC.combo.epochs),
    reduce: params.reduce, bi: true, packed: null, motifSteps: seq.motifAt.map(stepOf), T: combo.T, names,
  });
}

const letterAt = (w, t) => letterCell(w, t, OCC.lettersTop);

function drawOcclusion(ctx, colors, w, params, state, anim) {
  const { x, seq, occ, names } = state;
  const X0 = PAD_L, X1 = w - PAD_R;
  const n = occ.windows.length, i = anim.occ, t = ease(anim.t);
  const cur = i >= 1 ? occ.windows[i - 1] : null;
  const done = i >= n && anim.t >= 1;

  txt(ctx, colors, S.capFx(occ.base, occ.model), X0, 14, { font: capFont(colors), fill: colors.ink1 });
  if (cur) txt(ctx, colors, S.capOccluded(cur.p, cur.a), X0 + 250, 14, { fill: colors.ink1 });

  /* the partial map, overlaps averaged as Captum does, the newest window fading in */
  const partial = new Float64Array(M.LEN), cnt = new Float64Array(M.LEN);
  const shown = Math.min(n, i);
  for (let j = 0; j < shown; j++) {
    const win = occ.windows[j], f = j === shown - 1 ? t : 1;
    for (let s = win.start; s < win.start + occ.k && s < M.LEN; s++) { partial[s] += win.a * f; cnt[s] += f; }
  }
  let amax = 1e-9; for (const win of occ.windows) amax = Math.max(amax, win.a);
  let pmax = 1e-9; for (let s = 0; s < M.LEN; s++) if (cnt[s] > 0) pmax = Math.max(pmax, partial[s] / cnt[s]);
  const scale = Math.max(pmax, amax * 0.5);

  /* the letters, the heat behind each once the map is complete (cell 178), the window boxed, the motif outlined */
  for (let s = 0; s < M.LEN; s++) {
    const { x: lx, y: ly, pitch } = letterAt(w, s);
    if (params.heat === "on" && done) rect(ctx, lx, ly - OCC.lineH + 3, pitch, OCC.lineH, wash(colors.magnitude, 0.85 * occ.attr[s] / Math.max(1e-9, ...occ.attr)));
    const inWin = cur && s >= cur.start && s < cur.start + occ.k;
    txt(ctx, colors, inWin ? "*" : M.VOCAB[x.tok[s]], lx + pitch / 2, ly, { font: letterFont(colors), fill: inWin ? colors.extreme : colors.ink1, align: "center" });
  }
  for (const m of seq.motifAt) {
    const a = letterAt(w, m), b = letterAt(w, Math.min(M.LEN - 1, m + M.MOTIF.length - 1));
    if (a.y === b.y) rect(ctx, a.x, a.y - OCC.lineH + 3, b.x + b.pitch - a.x, OCC.lineH, null, colors.reference, 1);
    else { rect(ctx, a.x, a.y - OCC.lineH + 3, X1 - a.x, OCC.lineH, null, colors.reference, 1); rect(ctx, X0, b.y - OCC.lineH + 3, b.x + b.pitch - X0, OCC.lineH, null, colors.reference, 1); }
  }
  if (cur) {
    const a = letterAt(w, cur.start), b = letterAt(w, Math.min(M.LEN - 1, cur.start + occ.k - 1));
    if (a.y === b.y) rect(ctx, a.x, a.y - OCC.lineH + 3, b.x + b.pitch - a.x, OCC.lineH, null, colors.ink1, 1.2);
    else { rect(ctx, a.x, a.y - OCC.lineH + 3, X1 - a.x, OCC.lineH, null, colors.ink1, 1.2); rect(ctx, X0, b.y - OCC.lineH + 3, b.x + b.pitch - X0, OCC.lineH, null, colors.ink1, 1.2); }
  }

  /* the bar plot by position (cell 176) */
  txt(ctx, colors, S.capAttr(occ.k, occ.stride), X0, OCC.attrHead, { font: capFont(colors), fill: colors.ink1 });
  const bw = (X1 - X0) / M.LEN;
  for (let s = 0; s < M.LEN; s++) if (cnt[s] > 0) { const a = partial[s] / cnt[s]; const h = OCC.attrH * a / scale; rect(ctx, X0 + s * bw, OCC.attrTop + OCC.attrH - h, bw + 0.5, h, colors.magnitude); }
  line(ctx, X0, OCC.attrTop + OCC.attrH + 0.5, X1, OCC.attrTop + OCC.attrH + 0.5, colors.axis);
  for (const m of seq.motifAt) rect(ctx, X0 + m * bw, OCC.attrTop - 2, M.MOTIF.length * bw, OCC.attrH + 4, null, colors.reference, 1);
  if (seq.motifAt.length) txt(ctx, colors, seq.motifAt.length > 1 ? S.capCopies : S.capMotif, X0 + seq.motifAt[0] * bw, OCC.attrTop + OCC.attrH + 14, { fill: colors.reference });
  if (done) txt(ctx, colors, S.capHalfMax(M.halfMaxWidth(occ.attr)), X1, OCC.attrHead, { align: "right", fill: colors.ink3 });
}

/* ================================================================ widget */

defineWidget({
  slug: "sequence-cnn-lstm",
  status: "draft",
  title: "Deep Learning - Sequences: CNN and LSTM",
  subtitle: S.subtitle,
  layout: "side",
  height: ({ page, direction, code }) => (page === "lstm" ? HEIGHTS.lstm(code, direction) : page === "combo" ? HEIGHTS.combo(code) : page === "occlusion" ? HEIGHTS.occlusion : HEIGHTS.cnn(code)),

  params: {
    page: { type: "segmented", label: S.pageLabel, detail: S.pageDetail, options: PAGES, default: "cnn", display: true },

    seqSec: { type: "section", label: S.seqSection },
    task: {
      type: "segmented", label: S.taskLabel, detail: S.taskDetail,
      options: [{ value: "motif", label: "Motif" }, { value: "composition", label: "Composition" }], default: "motif",
    },
    copies: {
      type: "segmented", label: S.copiesLabel, detail: S.copiesDetail,
      options: [{ value: "0", label: "0" }, { value: "1", label: "1" }, { value: "2", label: "2" }, { value: "3", label: "3" }], default: "1", when: ON_TASK("motif"),
    },
    cls: {
      type: "segmented", label: S.clsLabel, detail: S.clsDetail,
      options: [{ value: "rich", label: "GC-rich" }, { value: "poor", label: "GC-poor" }], default: "rich", when: ON_TASK("composition"),
    },
    code: {
      type: "segmented", label: S.codeLabel, detail: S.codeDetail,
      options: [{ value: "onehot", label: "One-hot" }, { value: "learned", label: "Learned" }], default: "onehot",
    },
    seed: { type: "int", label: S.seedLabel, detail: S.seedDetail, min: 1, max: 200, default: 1 },

    /* page 1 · the first layer and the head; page 3 stands on the same net */
    layerSec: { type: "section", label: S.layerSection, when: ON("cnn") },
    k: {
      type: "choice", label: S.kLabel, detail: S.kDetail,
      options: M.KERNELS.map((k) => ({ value: String(k), label: String(k), detail: `${k} bases` })),
      default: "7", when: ON("cnn"),
    },
    stride: {
      type: "segmented", label: S.strideLabel, detail: S.strideDetail,
      options: [{ value: "1", label: "1" }, { value: "2", label: "2" }], default: "1", when: ON("cnn"),
    },
    headSec: { type: "section", label: S.headSection, when: ON("cnn") },
    pool: {
      type: "segmented", label: S.poolLabel, detail: S.poolDetail,
      options: [{ value: "max", label: "Max" }, { value: "avg", label: "Average" }], default: "max", when: ON("cnn"),
    },
    lookCnn: { type: "section", label: S.lookSection, afterDrive: true, when: ON("cnn") },
    follow: {
      type: "choice", label: S.followLabel, detail: S.followDetail,
      options: Array.from({ length: M.C1 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
      default: "1", display: true, afterDrive: true, when: ON("cnn"),
    },
    stop: { type: "int", label: S.stopLabel, detail: S.stopDetail, min: 1, max: M.LEN, default: 100, display: true, afterDrive: true, when: ON("cnn") },

    /* page 4 · which trained model the window is asked; before the recurrence blocks so their controls follow it */
    modelSec: { type: "section", label: S.modelSection, when: ON("occlusion") },
    model: {
      type: "segmented", label: S.modelLabel, detail: S.modelDetail,
      options: [{ value: "cnn", label: "1D-CNN" }, { value: "lstm", label: "LSTM" }, { value: "combo", label: "CNN + LSTM" }], default: "cnn", when: ON("occlusion"),
    },

    /* page 2 · the recurrence: direction and packing; the head reads the final states */
    recurSec: { type: "section", label: S.recurSection, when: ON_LSTM },
    direction: {
      type: "segmented", label: S.directionLabel, detail: S.directionDetail,
      options: [{ value: "uni", label: "One way" }, { value: "bi", label: "Both ways" }], default: "uni", when: ON_LSTM,
    },
    pack: {
      type: "segmented", label: S.packLabel, detail: S.packDetail,
      options: [{ value: "on", label: "On" }, { value: "off", label: "Off" }], default: "on", when: ON_LSTM,
    },
    /* page 3 · the reduction the head was trained on */
    comboSec: { type: "section", label: S.recurSection, when: ON_COMBO },
    reduce: {
      type: "segmented", label: S.reduceLabel, detail: S.reduceDetail,
      options: [{ value: "last", label: "Last" }, { value: "max", label: "Max" }], default: "last", when: ON_COMBO,
    },

    windowSec: { type: "section", label: S.windowSection, when: ON("occlusion") },
    window: {
      type: "choice", label: S.windowLabel, detail: S.windowDetail,
      options: [4, 8, 12].map((k) => ({ value: String(k), label: String(k), detail: `${k} tokens, stride ${k / 2}` })),
      default: "8", when: ON("occlusion"),
    },
    lookOcc: { type: "section", label: S.lookSection, afterDrive: true, when: ON("occlusion") },
    heat: {
      type: "segmented", label: S.heatLabel, detail: S.heatDetail,
      options: [{ value: "off", label: "Off" }, { value: "on", label: "On" }], default: "on", display: true, afterDrive: true, when: ON("occlusion"),
    },

    /* authoring escape hatch, first render only: presses already taken on the page it opens with */
    shown: { type: "int", min: 0, max: 99, default: 0, hidden: true },
  },

  legend: ({ params }) => (params.page === "combo" ? S.legend.lstm : S.legend[params.page]) ?? S.legend.cnn,

  compute,

  regions: ({ w, params, state, anim }) => {
    if (!state || params.page !== "cnn" || (anim?.n?.cnn ?? 0) < 1) return [];
    const CNN = cnnGeom(inputBot(params.code));
    const X0 = PAD_L, X1 = w - PAD_R, mapX1 = X1 - CNN.spellW;
    const rows = Array.from({ length: M.C1 }, (_, c) => ({ x: X0, y: CNN.mapsTop + c * CNN.mapRowH, w: mapX1 - X0, h: CNN.mapRowH, set: { follow: String(c + 1) }, label: `kernel ${c + 1}` }));
    const buckets = 20, bw = (px(w, M.LEN) - X0) / buckets;
    const stops = Array.from({ length: buckets }, (_, b) => ({
      x: X0 + b * bw, y: rowsTop, w: bw, h: nRows(params.code) * INPUT.rowH,
      set: { stop: Math.round((b + 0.5) * (M.LEN / buckets)) }, label: `window at base ${Math.round((b + 0.5) * (M.LEN / buckets))}`,
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
      /* a press belongs to the page it started on: a switch mid-press ends it here (73, the 2026-09-20 sweep) */
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
    const names = state.names;
    if (params.page === "lstm") {
      const m = state.lstm, count = anim?.n?.lstm ?? 0, read = count >= 2;
      return [
        { label: S.tileP(names[1]), value: read ? m.reading.p[1].toFixed(2) : S.tileWait, note: S.tilePNote(state.truth) },
        { label: S.tileMove, value: m.packed ? S.tileMovePacked : m.drift.toFixed(2), note: S.tileMoveNote },
        { label: S.tileAcc, value: read ? `${Math.round(100 * m.acc)}%` : S.tileWait, note: S.tileAccNote(SPEC.nTest) },
      ];
    }
    if (params.page === "combo") {
      const m = state.combo, Fd = m.reading.feats[0].length, count = anim?.n?.combo ?? 0, read = count >= 3;
      return [
        { label: S.tileP(names[1]), value: read ? m.reading.p[1].toFixed(2) : S.tileWait, note: S.tilePNote(state.truth) },
        { label: S.tileReduce, value: params.reduce, note: S.tileReduceNote(m.T, Fd) },
        { label: S.tileAcc, value: read ? `${Math.round(100 * m.acc)}%` : S.tileWait, note: S.tileAccNote(SPEC.nTest) },
      ];
    }
    if (params.page === "occlusion") {
      const i = anim?.occ ?? 0, n = state.occ.windows.length, done = i >= n && (anim?.t ?? 1) >= 1;
      return [
        { label: S.tileP(names[1]), value: state.occ.base.toFixed(2), note: S.tilePNoteModel(state.occ.model, state.truth) },
        { label: S.tileWindow, value: `${Math.min(i, n)} / ${n}`, note: S.tileWindowNote(state.occ.k, state.occ.stride) },
        { label: S.tileWidth, value: done ? String(M.halfMaxWidth(state.occ.attr)) : S.tileWait, note: state.seq.motifAt.length ? S.tileWidthNote : S.tileWidthNoteNone },
      ];
    }
    const last = state.chain.rows[state.chain.rows.length - 1];
    const count = anim?.n?.cnn ?? 0, classified = count >= 3 && (anim?.t ?? 1) >= 1;
    const tiles = [
      { label: S.tileP(names[1]), value: classified ? state.pred[1].toFixed(2) : S.tileWait, note: S.tilePNote(state.truth) },
      { label: S.tileK, value: `${state.k} bases`, note: S.tileKNote },
      { label: S.tileReach, value: count >= 2 ? `${last.rf} bases` : S.tileWait, note: S.tileReachNote },
      { label: S.tileAcc, value: classified ? `${Math.round(100 * state.cnn.acc)}%` : S.tileWait, note: S.tileAccNote(SPEC.nTest) },
    ];
    if (state.parity) tiles.push({ label: S.tileParity, value: classified ? `${Math.round(100 * state.parity[0])}% · ${Math.round(100 * state.parity[1])}%` : S.tileWait, note: S.tileParityNote });
    return tiles;
  },

  summary({ params, state, anim }) {
    if (params.page === "lstm") return S.sum.lstm(anim?.n?.lstm ?? 0);
    if (params.page === "combo") return S.sum.combo(anim?.n?.combo ?? 0);
    if (params.page === "occlusion") return S.sum.occ(anim?.occ ?? 0, state.occ.windows.length);
    return S.sum.cnn(anim?.n?.cnn ?? 0);
  },
});
