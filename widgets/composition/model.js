/* ============================================================================
   Widget 51 · Composition — the arithmetic of composing layers into a model,
   and of the four connections that send the data somewhere other than straight
   on.

   PHM5005 05-3 cells 61-101. Every operand here is the notebook's own: one
   `x = torch.randn(4, 10)` (cells 66, 68, 72, 74, 92, 95, 98, 101), cell 62's
   three example blocks, cells 72 and 74's MLP1 and MLP2, cell 80's
   `summary()`, cell 88's output-size rules and its layer table, and the four
   `forward()` bodies of cells 92, 95, 98 and 101.

   WHERE THE RANDOMNESS COMES FROM. `compute` is handed a seeded rng and the
   Gating mask is drawn from it — that is the one draw a page's claim depends
   on. Everything else is a FIXED draw at a stated seed: the batch, and every
   `nn.Linear`'s weights from `uniform(rng, initBound.linear(fanIn))`, which is
   PyTorch's own default initialiser. There is no `seed` parameter, because
   nothing here is a sampling argument: five wirings on one input is the point,
   and a batch that moved between pages would break the comparison.

   THE BATCH SEED IS 6, AND IT WAS CHOSEN BY MEASUREMENT. The router's gate
   continues the batch's own stream, and over ten seeds only three put the four
   samples on more than one branch. At `mode: hard` a seed where all four
   samples take the same branch makes the page's point badly, so the seed is
   one of those three and `_lab/composition-verify.mjs` asserts it.

   `main.js` draws these and nothing else; `_lab/composition-verify.mjs`
   asserts the arithmetic in node, with no browser and no clock.
   ========================================================================= */

import { makeRng } from "../core/rng.js";
import { initBound, uniform, outSize, torchError } from "../core/torch.js";

/* --- small helpers --------------------------------------------------------- */

export const mat = (rows, cols, f) =>
  Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => f(r, c)));

export const sum = (v) => v.reduce((a, b) => a + b, 0);
export const mean = (v) => sum(v) / v.length;

export const relu = (m) => m.map((r) => r.map((v) => Math.max(0, v)));
export const sigmoid = (x) => 1 / (1 + Math.exp(-x));
export function softmax(v) {
  const m = Math.max(...v);
  const e = v.map((x) => Math.exp(x - m));
  const s = sum(e);
  return e.map((x) => x / s);
}

/** x @ W.T + b — what `nn.Linear` computes, with the weight stored [out, in]. */
export const linear = (x, W, b) =>
  x.map((r) => W.map((w, i) => w.reduce((s, v, k) => s + v * r[k], 0) + b[i]));

/** One `nn.Linear` at PyTorch's default initialisation. */
export function initLinear(rng, inF, outF) {
  const bound = initBound.linear(inF);
  return {
    inF,
    outF,
    W: mat(outF, inF, () => uniform(rng, bound)),
    b: Array.from({ length: outF }, () => uniform(rng, bound)),
  };
}
export const applyLinear = (L, x) => linear(x, L.W, L.b);
/** weight + bias, which is what `summary()` counts. */
export const linearParams = (inF, outF) => inF * outF + outF;

/* --- how far one Play beat is ---------------------------------------------- *
 * The collection's three paces, and the same wording every widget uses (3.7).
 * A line of `forward()` is one beat; nothing here is staged in two phases,
 * because a line either produced a tensor or it did not. */
export const SPEEDS = [
  { value: "slow", label: "Slow", detail: "1.2 seconds a line" },
  { value: "medium", label: "Medium", detail: "0.7 seconds a line" },
  { value: "fast", label: "Fast", detail: "0.3 seconds a line" },
];
export const unitMs = (speed) => (speed === "slow" ? 1200 : speed === "fast" ? 300 : 700);

/* ============================== the geometry ===============================
 * The mock is the geometry of record: `_lab/composition-mock.html` drew all
 * eight sections at the real 550 stage and the pages that change with the
 * frame at 770, and Kenneth took the recommendation on every one (2026-09-10).
 * Every constant below is the mock's, and the three deep-learning widgets
 * share the first six so a box means the same thing on all of them.
 *
 * It lives here rather than in `main.js` because it is arithmetic with a
 * SECOND READER: `_lab/composition-verify.mjs` measures every page in node,
 * where `main.js` cannot be imported at all because it calls `defineWidget`
 * at module scope. */

export const PAD = 14;
export const GAP = 22;            // between two things that are not operands
export const COLGAP = 14;         // between two columns of one diagram
export const BOX_H = 30;          // a layer box
export const BOX_BW = 2;          // its border
export const EDGE_H = 30;         // an arrow between two boxes, with the shape on it
export const HEAD = 9;            // the arrowhead
export const LINE = 16;           // one printed line
export const BAND_HEAD = 26;      // the band header strip and the hairline under it
export const CAPTION_H = 17;
export const CAP_GAP = 14;
export const TEXT_GAP = 16;       // between the diagram column and the text column
export const BOX_W = 150;         // a named layer box on a single-column diagram
export const MIN_BOX = 60;        // `Linear` plus its padding, the narrowest box

/**
 * A --fs-sm mono character, measured in the browser with `measureText` over
 * the 53-character Routing line (the mock, 2026-09-10). The plans derived 6.75
 * and were conservative at 7.2; the drawing says 6.60, so every width here is
 * about 8 % smaller than the plans' arithmetic. `main.js` measures it again on
 * the live canvas and passes the measurement in; the verify script has no
 * canvas to ask and uses this.
 */
export const MONO_SM = 6.6;

export const codeChars = (lines) => Math.max(...lines.map((l) => l.length));
export const codeWidth = (lines, mono = MONO_SM) => Math.ceil(codeChars(lines) * mono);

const W_BASE = 550;
const W_WIDE = 770;
/* Only two lengths carry values rather than text, so only two scale: a shaded
   band's cell, and the softmax weight cell of the Routing gate column. */
const BASE = { band: 12, wcell: 34 };
const WIDE = { band: 16, wcell: 40 };

export function sizesAt(t) {
  const s = { t };
  for (const key of Object.keys(BASE)) s[key] = Math.round(BASE[key] + (WIDE[key] - BASE[key]) * t);
  return s;
}

/**
 * The largest geometry whose widest band is inside the stage — MEASURED, from
 * the same function `main.js` lays the band out with, rather than asserted
 * from a table of widths that would drift the first time a band changed.
 * Floored at the 550 geometry, which is where a 12px cell stops reading.
 */
const SIZE_STEP = 1 / 48;
export function fitSizes(w, widest) {
  const avail = w - 2 * PAD;
  for (let t = Math.max(0, Math.min(1, (w - W_BASE) / (W_WIDE - W_BASE))); t > 0; t -= SIZE_STEP) {
    const s = sizesAt(t);
    if (widest(s) <= avail) return s;
  }
  return sizesAt(0);
}

/**
 * THE FIT PASS, one function and three readers. Routing, Ordering and Building
 * all carry a text column — a `forward()` body or a `print(model)` — and all
 * three put it UNDER the diagram where the diagram would be left too narrow to
 * draw and BESIDE it where it would not. Skip, Gating and Branching keep
 * theirs beside at both widths, which this answers for them without a second
 * rule.
 */
export const besideFits = (w, textW, minDiag) => w - 2 * PAD - textW - TEXT_GAP >= minDiag;

/* --- the widest thing on each page ------------------------------------------
 * `main.js` hands one of these to `fitSizes`, so the scale is chosen by
 * measuring what will be drawn, and the verify script reads the same functions
 * to assert that every page fits at every width. A width computed twice is a
 * width that can differ (5.8). */

export const bandWidth = {
  /* the diagram's own minimum, plus the code column beside it */
  skip: (z, cw) => cw + TEXT_GAP + SKIP_MIN_DIAG,
  /* one 20-column band on the `gated` edge; two side by side do not fit and
     the mock's §3 measured that, so only the result edge carries one */
  gating: (z, cw) => cw + TEXT_GAP + Math.max(20 * z.band, 2 * MIN_BOX + COLGAP),
  /* the widest merge is concat on 8 and 8, and the open pair carries a 12px gap */
  branching: (z, cw) => cw + TEXT_GAP + Math.max(16 * z.band + 12, 2 * MIN_BOX + COLGAP),
  /* three branch columns, a gate column of three weight cells, and the block
     of strips the weighted sum is drawn as, which the box has to hold */
  routing: (z, cw, beside, fixed) =>
    (beside ? cw + TEXT_GAP + routeDiagMin(z, fixed) : Math.max(cw, routeDiagMin(z, fixed))),
  dimensions: () => DIM_BOX_W,
  building: (z, cw, beside) => (beside ? cw + TEXT_GAP + BOX_W : Math.max(cw, BOX_W)),
  ordering: (z, cw, beside) =>
    (beside ? cw + TEXT_GAP + ORDER_MIN_DIAG : Math.max(cw, ORDER_MIN_DIAG)),
};

export const routeMinDiag = (z) => 3 * (MIN_BOX + COLGAP) + 3 * z.wcell;

/* --- Routing's weighted sum, drawn ------------------------------------------
 * The box under the three branches used to hold nothing but its own label, and
 * Kenneth asked for a depiction of the sum the page is named for
 * (`_lab/composition-routing-sum.html`, candidate C, 2026-09-10). It holds the
 * chosen sample's row from each branch as a strip of ROUTE_HIDDEN cells, laid
 * out as an equation: an operator column, the branch's name, the cells, and
 * the weight that multiplies the row.
 *
 * THAT BLOCK IS NOW WHAT DECIDES THE DIAGRAM'S WIDTH. The box spans the three
 * branch columns, so twenty cells and their labels are a claim on the diagram
 * that `routeMinDiag`'s four columns alone never made, and the fit pass answers
 * it by putting the code under the diagram at both widths — beside leaves a
 * 259px box against a 456px block, and the strips fall to 6px a cell.
 *
 * The two label widths are MEASURED: `main.js` reads them off the live canvas
 * and passes them in, and the constants below are that measurement, for the
 * verify script which has no canvas to ask. The same arrangement as MONO_SM.
 */
export const SUM_PAD = 8;         // the block's inset inside the box
export const SUM_HEAD = 15;       // the box's label, above the first strip
export const SUM_GAP = 14;        // between two strips, and where the + sits
export const SUM_RULE = 12;       // between the last branch strip and the total
export const SUM_OPW = 12;        // the + / = column
export const SUM_OPGAP = 4;
export const SUM_LGAP = 6;        // between the branch's name and its cells
export const SUM_RGAP = 6;        // between the cells and the weight
export const SUM_ARITH = 24;      // the one printed line under the box
/* `branch 3` at --fs-xs, and the widest of `× 0.00`, `combined`, `not taken`
   and `taken`: the right column is reserved at the widest label it ever
   carries, so the block does not move when the reader switches modes */
export const SUM_LAB_L = 43;
export const SUM_LAB_R = 49;

/** Everything in a strip row that is not a cell. */
export const routeSumFixed = (labL = SUM_LAB_L, labR = SUM_LAB_R) =>
  2 * SUM_PAD + SUM_OPW + SUM_OPGAP + labL + SUM_LGAP + SUM_RGAP + labR;
/** The box the block needs: 376px at a 12px cell, 456px at 16px. */
export const routeSumMinW = (z, fixed = routeSumFixed()) =>
  fixed + ROUTE_HIDDEN * z.band;
/** Its height at a cell size: three branch strips, a rule, and the total. */
export const routeSumH = (p) =>
  2 * SUM_PAD + SUM_HEAD + 4 * p + 2 * SUM_GAP + SUM_RULE;
/** The diagram's minimum: four columns, or the block plus the gate column. */
export const routeDiagMin = (z, fixed) =>
  Math.max(routeMinDiag(z), routeSumMinW(z, fixed) + 3 * z.wcell + COLGAP);

/* the box, the gradient gutter and the skip rail down the right */
export const SKIP_MIN_DIAG = 250;
export const DIM_BOX_W = 180;
/* the 150px box, and the class name printed beside it */
export const ORDER_MIN_DIAG = 250;

/* ============================ the shared batch =============================
 * One `x = torch.randn(4, 10)`, which every module of cells 66 to 101 takes.
 * The router's gate CONTINUES this stream, which is the order
 * `_lab/dl-layers-measure.mjs` §7 drew in, so the weights the widget prints
 * are the ones that measurement printed. */

export const BATCH_SEED = 6;
export const BATCH_N = 4;
export const BATCH_F = 10;

/** The notebook's own input, from whichever generator it is handed. */
export const batch = (rng) => mat(BATCH_N, BATCH_F, () => rng.normal());

const batchRng = makeRng(BATCH_SEED);
export const X = batch(batchRng);
const GATE = initLinear(batchRng, BATCH_F, 3);

/* ============================ the printed forms ============================
 * `print(model)` reproduces torch's own `__repr__`: the module's class name, an
 * open paren, one indented `(key): child` line per submodule with a nested
 * module's own block indented two further, and a closing paren. */

/** A leaf: the repr torch prints for one layer. */
export const leaf = (repr, params = 0, out = null) => ({ repr, params, out });
/** A container: a class name and its named children. */
export const container = (repr, children) => ({ repr, children });

export function printModule(node, indent = 0) {
  const pad = " ".repeat(indent);
  if (!node.children) return [`${pad}${node.repr}`];
  const lines = [`${pad}${node.repr}(`];
  for (const [key, child] of node.children) {
    const sub = printModule(child, indent + 2);
    sub[0] = `${" ".repeat(indent + 2)}(${key}): ${sub[0].trimStart()}`;
    lines.push(...sub);
  }
  lines.push(`${pad})`);
  return lines;
}

/** Every leaf of a module tree, in the order torch registers them. */
export function leaves(node) {
  if (!node.children) return [node];
  return node.children.flatMap(([, child]) => leaves(child));
}

/* --- what `torchsummary` prints (cell 80) ---------------------------------- *
 * `summary` formats each row as "{:>20}  {:>25} {:>15}" under a 64-character
 * rule, and counts only REGISTERED modules — which is the page's whole
 * argument, since `F.relu` in `forward` is not one. */
const SUM_W = 64;
const sumRow = (a, b, c) =>
  `${String(a).padStart(20)}  ${String(b).padStart(25)} ${String(c).padStart(15)}`;

export function printSummary(rows) {
  const total = rows.reduce((a, r) => a + r.params, 0);
  return [
    "-".repeat(SUM_W),
    sumRow("Layer (type)", "Output Shape", "Param #"),
    "=".repeat(SUM_W),
    ...rows.map((r, i) => sumRow(`${r.type}-${i + 1}`, `[-1, ${r.out}]`, r.params)),
    "=".repeat(SUM_W),
    `Total params: ${total}`,
    `Trainable params: ${total}`,
    "Non-trainable params: 0",
    "-".repeat(SUM_W),
  ];
}

/* ======================== 1 · Ordering (cell 62) ===========================
 * Cell 62's three example blocks in its own words, and its own claim: the
 * ordering is empirical, so the page ranks nothing. What the shapes DO say is
 * that Transform is the only step that changes them. */

export const ORDER_BLOCKS = {
  mlp: {
    label: "MLP",
    in: [4, 10],
    params: linearParams(10, 20) + 2 * 20,        // 220, and a scale and a shift per feature: 260
    steps: [
      ["Transform", "Linear", [4, 20]],
      ["Normalize", "BatchNorm1d", [4, 20]],
      ["Activate", "ReLU", [4, 20]],
      ["Regularize", "Dropout", [4, 20]],
    ],
  },
  resnet: {
    label: "ResNet",
    in: [4, 16, 32, 32],
    params: 16 * 16 * 9 + 16 + 2 * 16,             // Conv2d(16, 16, 3) 2320, BatchNorm2d(16) 32: 2352
    steps: [
      ["Transform", "Conv2d", [4, 16, 32, 32]],
      ["Normalize", "BatchNorm2d", [4, 16, 32, 32]],
      ["Activate", "ReLU", [4, 16, 32, 32]],
    ],
  },
  transformer: {
    label: "Transformer feed-forward",
    in: [4, 20],
    params: linearParams(20, 80) + linearParams(80, 20) + 2 * 20, // 1680 + 1620, LayerNorm(20) 40: 3340
    steps: [
      ["Transform", "Linear", [4, 80]],
      ["Activate", "GELU", [4, 80]],
      ["Transform", "Linear", [4, 20]],
      ["Regularize", "Dropout", [4, 20]],
      ["Normalize", "LayerNorm", [4, 20]],
    ],
  },
};

/** What `nn.Sequential` prints for each of the three blocks. */
export const ORDER_PRINT = {
  mlp: [
    "Sequential(",
    "  (0): Linear(in_features=10, out_features=20, bias=True)",
    "  (1): BatchNorm1d(20, eps=1e-05, momentum=0.1)",
    "  (2): ReLU()",
    "  (3): Dropout(p=0.5, inplace=False)",
    ")",
  ],
  resnet: [
    "Sequential(",
    "  (0): Conv2d(16, 16, kernel_size=(3, 3), stride=(1, 1), padding=(1, 1))",
    "  (1): BatchNorm2d(16, eps=1e-05, momentum=0.1)",
    "  (2): ReLU()",
    ")",
  ],
  transformer: [
    "Sequential(",
    "  (0): Linear(in_features=20, out_features=80, bias=True)",
    "  (1): GELU(approximate='none')",
    "  (2): Linear(in_features=80, out_features=20, bias=True)",
    "  (3): Dropout(p=0.5, inplace=False)",
    "  (4): LayerNorm((20,), eps=1e-05)",
    ")",
  ],
};

/** Cell 62's second figure: the layers that are used as a unit. */
export const COMBOS = [
  { boxes: ["Convolutional", "Pooling"], note: "local features, then a coarser summary" },
  {
    boxes: ["Embedding", "Recurrent", "Attention"],
    or: 2,
    note: "tokens to vectors, then related across the sequence",
  },
  { boxes: ["Linear", "Activation"], note: "a linear map, then a non-linearity" },
];
export const COMBO_BOXES = COMBOS.reduce((a, g) => a + g.boxes.length, 0);

export function ordering(block, view) {
  const b = ORDER_BLOCKS[block];
  const changed = b.steps.filter(([, , out], i) => {
    const prev = i === 0 ? b.in : b.steps[i - 1][2];
    return out.join() !== prev.join();
  }).length;
  return {
    kind: "ordering",
    view,
    block: b,
    print: ORDER_PRINT[block],
    changed,
    units: view === "combination" ? COMBO_BOXES : b.steps.length,
  };
}

/* ======================= 2 · Building (cells 63-80) ========================
 * MLP1 and MLP2 compute the same function and print differently, because
 * `F.relu` inside `forward` is not a submodule. The parameter count is
 * invariant across that pair and NOT across flat and blocks, so the page names
 * which control it holds under.
 */

const LIN = (i, o) => `Linear(in_features=${i}, out_features=${o}, bias=True)`;

const MODELS = {
  flat: container("Sequential", [
    ["0", leaf(LIN(10, 20), linearParams(10, 20), 20)],
    ["1", leaf("ReLU()", 0, 20)],
    ["2", leaf(LIN(20, 2), linearParams(20, 2), 2)],
  ]),
  blocks: container("Sequential", [
    ["0", container("Sequential", [
      ["0", leaf(LIN(10, 20), linearParams(10, 20), 20)],
      ["1", leaf("ReLU()", 0, 20)],
    ])],
    ["1", container("Sequential", [
      ["0", leaf(LIN(20, 20), linearParams(20, 20), 20)],
      ["1", leaf("ReLU()", 0, 20)],
    ])],
    ["2", container("Sequential", [
      ["0", leaf(LIN(20, 2), linearParams(20, 2), 2)],
    ])],
  ]),
  all: container("MLP1", [
    ["fc1", leaf(LIN(10, 20), linearParams(10, 20), 20)],
    ["relu", leaf("ReLU()", 0, 20)],
    ["fc2", leaf(LIN(20, 2), linearParams(20, 2), 2)],
  ]),
  learnable: container("MLP2", [
    ["fc1", leaf(LIN(10, 20), linearParams(10, 20), 20)],
    ["fc2", leaf(LIN(20, 2), linearParams(20, 2), 2)],
  ]),
};

/** The boxes the diagram draws: every operation the forward pass performs. */
const BUILD_STEPS = {
  flat: [["fc1", 20], ["relu", 20], ["fc2", 2]],
  blocks: [["fc1", 20], ["relu", 20], ["fc2", 20], ["relu", 20], ["fc3", 2]],
  all: [["fc1", 20], ["relu", 20], ["fc2", 2]],
  learnable: [["fc1", 20], ["F.relu", 20], ["fc2", 2]],
};

const SUMMARY_ROWS = {
  flat: [
    { type: "Linear", out: 20, params: linearParams(10, 20) },
    { type: "ReLU", out: 20, params: 0 },
    { type: "Linear", out: 2, params: linearParams(20, 2) },
  ],
  blocks: [
    { type: "Linear", out: 20, params: linearParams(10, 20) },
    { type: "ReLU", out: 20, params: 0 },
    { type: "Linear", out: 20, params: linearParams(20, 20) },
    { type: "ReLU", out: 20, params: 0 },
    { type: "Linear", out: 2, params: linearParams(20, 2) },
  ],
  all: [
    { type: "Linear", out: 20, params: linearParams(10, 20) },
    { type: "ReLU", out: 20, params: 0 },
    { type: "Linear", out: 2, params: linearParams(20, 2) },
  ],
  /* `F.relu` is not a registered module, so `summary()` does not see it either */
  learnable: [
    { type: "Linear", out: 20, params: linearParams(10, 20) },
    { type: "Linear", out: 2, params: linearParams(20, 2) },
  ],
};

export const CODE_MLP = {
  all: ["def forward(self, x):", "x = self.fc1(x)", "x = self.relu(x)", "x = self.fc2(x)", "return x"],
  learnable: ["def forward(self, x):", "x = self.fc1(x)", "x = F.relu(x)", "x = self.fc2(x)", "return x"],
};

export function building(api, blocks, style, show) {
  const key = api === "module" ? style : blocks;
  const node = MODELS[key];
  const steps = BUILD_STEPS[key];
  const all = leaves(node);
  const params = all.reduce((a, l) => a + l.params, 0);
  const print = printModule(node);
  const summary = printSummary(SUMMARY_ROWS[key]);
  return {
    kind: "building",
    key,
    api,
    node,
    steps,
    /* COUNTED FROM THE PRINT, not asserted (2.11): the tile says how many
       layers the print names, and the print is drawn beside it. */
    printed: all.length,
    run: steps.length,
    params,
    text: show === "summary" ? summary : print,
    print,
    summary,
    code: api === "module" ? CODE_MLP[style] : null,
    units: steps.length,
  };
}

/* ====================== 3 · Dimensions (cell 88) ===========================
 * The menu deliberately holds layers that do not fit the step before them, and
 * that is the page. EVERY option is either legal where it sits or fails with
 * one of core's two messages — a Linear whose in_features disagree, or a
 * Conv2d whose in_channels do. Nothing is offered whose failure would be a
 * rank error, which torch words a third way.
 *
 * A SLOT'S MENU IS PER STEP AS WELL AS PER DATA TYPE (decision 6 in main.js).
 * One menu across all four positions cannot keep that promise: `MaxPool2d(2)`
 * after `Flatten` is a rank error and not a channel one.
 */

const LAYER = {
  "Conv2d-3-16-3": { label: "Conv2d(3, 16, 3)", kind: "conv2d", cin: 3, cout: 16, k: 3 },
  "Conv2d-8-16-3": { label: "Conv2d(8, 16, 3)", kind: "conv2d", cin: 8, cout: 16, k: 3 },
  "MaxPool2d-2": { label: "MaxPool2d(2)", kind: "maxpool2d", k: 2 },
  "MaxPool2d-3": { label: "MaxPool2d(3)", kind: "maxpool2d", k: 3 },
  Flatten: { label: "Flatten", kind: "flatten" },
  ReLU: { label: "ReLU", kind: "relu" },
  "Linear-3600-10": { label: "Linear(3600, 10)", kind: "linear", inF: 3600, outF: 10 },
  "Linear-1600-10": { label: "Linear(1600, 10)", kind: "linear", inF: 1600, outF: 10 },
  "Linear-100-10": { label: "Linear(100, 10)", kind: "linear", inF: 100, outF: 10 },
  "Linear-10-20": { label: "Linear(10, 20)", kind: "linear", inF: 10, outF: 20 },
  "Linear-20-20": { label: "Linear(20, 20)", kind: "linear", inF: 20, outF: 20 },
  "Linear-20-2": { label: "Linear(20, 2)", kind: "linear", inF: 20, outF: 2 },
  "Linear-10-2": { label: "Linear(10, 2)", kind: "linear", inF: 10, outF: 2 },
  "Linear-40-2": { label: "Linear(40, 2)", kind: "linear", inF: 40, outF: 2 },
  "Linear-8-2": { label: "Linear(8, 2)", kind: "linear", inF: 8, outF: 2 },
  "Embedding-6-4": { label: "Embedding(6, 4)", kind: "embedding", vocab: 6, dim: 4 },
  "Embedding-6-8": { label: "Embedding(6, 8)", kind: "embedding", vocab: 6, dim: 8 },
};

export const DATA_SETS = {
  image: {
    label: "Image",
    shape: [4, 3, 32, 32],
    note: "4 images, 3 channels, 32 by 32",
    menus: [
      ["Conv2d-3-16-3", "Conv2d-8-16-3"],
      ["MaxPool2d-2", "MaxPool2d-3"],
      ["Flatten", "ReLU"],
      ["Linear-3600-10", "Linear-1600-10", "Linear-100-10"],
    ],
  },
  vectors: {
    label: "Vectors",
    shape: [4, 10],
    note: "4 samples, 10 features",
    menus: [
      ["Linear-10-20", "Linear-20-20"],
      ["ReLU", "Linear-20-20"],
      ["Linear-20-20", "Linear-10-20"],
      ["Linear-20-2", "Linear-10-2"],
    ],
  },
  sequence: {
    label: "Sequence",
    shape: [4, 5],
    note: "4 sequences of 5 residues, as integer ids",
    menus: [
      ["Embedding-6-4", "Embedding-6-8"],
      ["ReLU", "Flatten"],
      ["Flatten", "ReLU"],
      ["Linear-20-2", "Linear-40-2", "Linear-8-2"],
    ],
  },
};

export const SLOT_KEYS = ["step1", "step2", "step3", "step4"];
export const slotOptions = (data, i) =>
  (DATA_SETS[data] ?? DATA_SETS.image).menus[i].map((v) => ({ value: v, label: LAYER[v].label }));

/** The layer a slot names, or the first of its menu if the value is from
    another data type — which a hand-built link can carry. */
export function slotLayer(data, i, value) {
  const menu = (DATA_SETS[data] ?? DATA_SETS.image).menus[i];
  const key = menu.includes(value) ? value : menu[0];
  return { key, ...LAYER[key] };
}

export const layerParams = (L) =>
  (L.kind === "conv2d" ? L.cin * L.cout * L.k * L.k + L.cout
    : L.kind === "linear" ? linearParams(L.inF, L.outF)
      : L.kind === "embedding" ? L.vocab * L.dim
        : 0);

/**
 * One layer applied to one shape: `{ shape }`, or `{ error }` carrying torch's
 * own message. The two shapes torch reports for a `Linear` are the input
 * flattened to a matrix and the weight TRANSPOSED, which is why a
 * `Linear(20, 2)` reads `20x2`.
 */
export function shapeAfter(shape, L) {
  if (L.kind === "relu") return { shape: shape.slice() };
  if (L.kind === "flatten") {
    return { shape: [shape[0], shape.slice(1).reduce((a, b) => a * b, 1)] };
  }
  if (L.kind === "embedding") return { shape: [...shape, L.dim] };
  if (L.kind === "conv2d") {
    if (shape[1] !== L.cin) {
      return {
        error: torchError.channels([L.cout, L.cin, L.k, L.k], shape, shape[1]),
      };
    }
    return {
      shape: [shape[0], L.cout, outSize(shape[2], L.k, 1), outSize(shape[3], L.k, 1)],
    };
  }
  if (L.kind === "maxpool2d") {
    return {
      shape: [shape[0], shape[1], outSize(shape[2], L.k, L.k), outSize(shape[3], L.k, L.k)],
    };
  }
  const last = shape[shape.length - 1];
  const rows = shape.slice(0, -1).reduce((a, b) => a * b, 1);
  if (last !== L.inF) return { error: torchError.matmul([rows, last], [L.inF, L.outF]) };
  return { shape: [...shape.slice(0, -1), L.outF] };
}

export function dimensions(data, chain) {
  const set = DATA_SETS[data] ?? DATA_SETS.image;
  const layers = chain.map((v, i) => slotLayer(data, i, v));
  const steps = [];
  let shape = set.shape.slice();
  for (const L of layers) {
    const r = shapeAfter(shape, L);
    if (r.error) {
      steps.push({ layer: L, error: r.error, from: shape.slice() });
      break;
    }
    shape = r.shape;
    steps.push({ layer: L, shape: shape.slice(), from: steps.length ? steps[steps.length - 1].shape : set.shape });
  }
  const failed = steps.length && Boolean(steps[steps.length - 1].error);
  const params = steps.filter((s) => !s.error).reduce((a, s) => a + layerParams(s.layer), 0);
  return {
    kind: "dimensions",
    data,
    set,
    layers,
    steps,
    failed,
    params,
    out: failed ? null : shape,
    units: steps.length,
  };
}

/* ========================= 4 · Skip (cells 90-92) ==========================
 * `y = x + f(x)`, and `y = P(x) + f(x)` where the shapes disagree. Setting the
 * hidden width to 20 is the case that fails, and the projection is the fix
 * cell 90 names.
 */

export const SKIP_SEED = 21;
const skipRng = makeRng(SKIP_SEED);
const S_FC1 = initLinear(skipRng, 10, 20);
const S_FC2 = { 10: initLinear(skipRng, 20, 10), 20: initLinear(skipRng, 20, 20) };
const S_PROJ = { 10: initLinear(skipRng, 10, 10), 20: initLinear(skipRng, 10, 20) };
const S_OUT = { 10: initLinear(skipRng, 10, 2), 20: initLinear(skipRng, 20, 2) };

export const CODE_SKIP = [
  "def forward(self, x):",
  "skip = x",
  "x1 = self.fc1(x)",
  "x2 = self.relu(x1)",
  "x3 = self.fc2(x2)",
  "out = x3 + skip",
  "out = self.fc_out(out)",
  "return out",
];
export const CODE_SKIP_PROJ = CODE_SKIP.map((l) => (l === "skip = x" ? "skip = self.proj(x)" : l));

/** The local factor on each edge of the walk back to x (cell 90's claim). */
export const SKIP_FACTORS = [
  ["fc_out", "Wᵀ_out"],
  ["the add", "1"],
  ["fc2", "Wᵀ₂"],
  ["relu", "f′(x1)"],
  ["fc1", "Wᵀ₁"],
];

export function skip(width, proj) {
  const x1 = applyLinear(S_FC1, X);
  const x2 = relu(x1);
  const x3 = applyLinear(S_FC2[width], x2);
  const skipT = proj ? applyLinear(S_PROJ[width], X) : X;
  const skipShape = proj ? [4, width] : [4, 10];
  const match = skipShape[1] === width;
  const out = match ? x3.map((r, i) => r.map((v, j) => v + skipT[i][j])) : null;
  const y = out ? applyLinear(S_OUT[width], out) : null;
  const params = S_FC1.inF * S_FC1.outF + S_FC1.outF
    + linearParams(20, width)
    + (proj ? linearParams(10, width) : 0)
    + linearParams(width, 2);
  return {
    kind: "skip",
    width,
    proj,
    x1,
    x2,
    x3,
    skip: skipT,
    skipShape,
    match,
    out,
    y,
    params,
    error: match ? null : torchError.broadcast(width, 10, 1),
    code: proj ? CODE_SKIP_PROJ : CODE_SKIP,
    /* the walk stops at the add where the add is what raises */
    units: match ? 6 : 5,
  };
}

/* ======================== 5 · Gating (cells 93-95) =========================
 * `GatedMLP`. The gate is elementwise and one number per feature per sample,
 * which is what a scalar switch cannot be. At `mask` some features are exactly
 * 0 and their column of `gated` is empty for every sample.
 */

export const GATE_SEED = 31;
export const GATE_F = 20;
const gateRng = makeRng(GATE_SEED);
const G_FC1 = initLinear(gateRng, 10, GATE_F);
const G_GATE = initLinear(gateRng, 10, GATE_F);
const G_FC2 = initLinear(gateRng, GATE_F, 2);
export const MASK_P = 0.35;

export const CODE_GATE = [
  "def forward(self, x):",
  "h = self.relu(self.fc1(x))",
  "g = torch.sigmoid(self.gate_fc(x))",
  "gated = h * g",
  "out = self.fc2(gated)",
  "return out",
];

export function gating(gate, rng) {
  const h = relu(applyLinear(G_FC1, X));
  /* THE MASK IS THE ONE DRAW THE WIDGET MAKES, and it comes from the rng
     `compute` is handed rather than from a generator of this module's own. */
  const mask = Array.from({ length: GATE_F }, () => (rng.next() < MASK_P ? 0 : 1));
  const g = gate === "mask"
    ? X.map(() => mask.slice())
    : applyLinear(G_GATE, X).map((r) => r.map(sigmoid));
  const gated = h.map((r, i) => r.map((v, j) => v * g[i][j]));
  const out = applyLinear(G_FC2, gated);
  const flat = g.flat();
  const params = linearParams(10, GATE_F) + linearParams(GATE_F, 2)
    + (gate === "mask" ? 0 : linearParams(10, GATE_F));
  const code = CODE_GATE.map((l) =>
    (gate === "mask" && l.startsWith("g = ") ? "g = mask" : l));
  return {
    kind: "gating",
    gate,
    h,
    g,
    mask,
    gated,
    out,
    params,
    code,
    lo: Math.min(...flat),
    hi: Math.max(...flat),
    /* COUNTED FROM THE DRAW (2.11), not from the parameter */
    blocked: gate === "mask" ? mask.filter((v) => v === 0).length : 0,
    gateMean: (s) => mean(g[s]),
    units: 4,
  };
}

/* ==================== 6 · Branching (cells 96-98) ==========================
 * Every merge both wins and loses on the notebook's own numbers: with 8 and 6,
 * concat works and add and average raise the broadcast message; with 8 and 8,
 * add and average work and concat gives 16, which `Linear(14, 2)` rejects.
 * The two failures are at DIFFERENT PLACES, and that is the page.
 */

export const BRANCH_SEED = 41;
export const FC3_IN = 14;
const brRng = makeRng(BRANCH_SEED);
const B_FC1 = initLinear(brRng, 10, 8);
const B_FC2 = { 6: initLinear(brRng, 10, 6), 8: initLinear(brRng, 10, 8) };
const B_FC3 = initLinear(brRng, FC3_IN, 2);

export const MERGE_LINE = {
  concat: "x3 = torch.cat([x1, x2], dim=1)",
  add: "x3 = x1 + x2",
  average: "x3 = (x1 + x2) / 2",
};
export const CODE_BRANCH = [
  "def forward(self, x):",
  "x1 = torch.relu(self.fc1(x))",
  "x2 = torch.relu(self.fc2(x))",
  MERGE_LINE.concat,
  "y = self.fc3(x3)",
  "return y",
];

export function branching(merge, fc2) {
  const x1 = relu(applyLinear(B_FC1, X));
  const x2 = relu(applyLinear(B_FC2[fc2], X));
  const elementwise = merge !== "concat";
  const mergeFails = elementwise && fc2 !== 8;
  let merged = null;
  if (!mergeFails) {
    merged = elementwise
      ? x1.map((r, i) => r.map((v, j) => (merge === "add" ? v + x2[i][j] : (v + x2[i][j]) / 2)))
      : x1.map((r, i) => [...r, ...x2[i]]);
  }
  const feats = merged ? merged[0].length : null;
  const fcFails = Boolean(merged) && feats !== FC3_IN;
  const y = merged && !fcFails ? applyLinear(B_FC3, merged) : null;
  const code = CODE_BRANCH.map((l) => (l === MERGE_LINE.concat ? MERGE_LINE[merge] : l));
  return {
    kind: "branching",
    merge,
    fc2,
    x1,
    x2,
    merged,
    feats,
    y,
    code,
    mergeError: mergeFails ? torchError.broadcast(8, fc2, 1) : null,
    fcError: fcFails ? torchError.matmul([4, feats], [FC3_IN, 2]) : null,
    params: linearParams(10, 8) + linearParams(10, fc2) + linearParams(FC3_IN, 2),
    units: mergeFails ? 3 : 4,
  };
}

/* ====================== 7 · Routing (cells 99-101) =========================
 * `SoftRoutingMLP`. The router's weights are plainly non-uniform, which is the
 * contrast with an untrained attention layer and the finding of the
 * measurement: the gate sees ten unit-scale features and gets a logit spread
 * an order of magnitude wider than cell 22's embeddings do.
 *
 * AT `mode: hard` THE TWO LINES THAT DIFFER ARE WRITTEN HERE. Cell 99 gives
 * hard routing as a two-branch `if / else` schematic and this diagram has
 * three branches, so the argmax and the row selection are spelled out in the
 * notebook's own idiom rather than transcribed. Everything else is cell 101
 * verbatim, and the code column is reserved at the soft form either way so the
 * diagram does not move when the reader switches.
 */

export const ROUTE_SEED = 11;
export const ROUTE_BRANCHES = 3;
export const ROUTE_HIDDEN = 20;
const routeRng = makeRng(ROUTE_SEED);
const R_BRANCH = [0, 1, 2].map(() => initLinear(routeRng, 10, ROUTE_HIDDEN));
const R_OUT = initLinear(routeRng, ROUTE_HIDDEN, 2);

export const ROUTE_WEIGHTS = applyLinear(GATE, X).map(softmax);
export const ROUTE_TOP = ROUTE_WEIGHTS.map((r) => r.indexOf(Math.max(...r)));

export const CODE_ROUTE = {
  soft: [
    "def forward(self, x):",
    "weights = F.softmax(self.gate(x), dim=1)",
    "branch_outs = [branch(x) for branch in self.branches]",
    "outs = torch.stack(branch_outs, dim=1)",
    "weights = weights.unsqueeze(-1)",
    "combined = torch.sum(weights * outs, dim=1)",
    "out = self.fc_out(combined)",
    "return out",
  ],
  hard: [
    "def forward(self, x):",
    "weights = F.softmax(self.gate(x), dim=1)",
    "branch_outs = [branch(x) for branch in self.branches]",
    "outs = torch.stack(branch_outs, dim=1)",
    "top = weights.argmax(dim=1)",
    "combined = outs[torch.arange(x.size(0)), top]",
    "out = self.fc_out(combined)",
    "return out",
  ],
};

export function routing(mode) {
  const outs = R_BRANCH.map((L) => relu(applyLinear(L, X)));
  const combined = X.map((_, s) =>
    Array.from({ length: ROUTE_HIDDEN }, (_, f) =>
      (mode === "hard"
        ? outs[ROUTE_TOP[s]][s][f]
        : outs.reduce((a, o, i) => a + ROUTE_WEIGHTS[s][i] * o[s][f], 0))));
  const y = applyLinear(R_OUT, combined);
  const params = ROUTE_BRANCHES * linearParams(10, ROUTE_HIDDEN)
    + linearParams(10, ROUTE_BRANCHES) + linearParams(ROUTE_HIDDEN, 2);
  return {
    kind: "routing",
    mode,
    weights: ROUTE_WEIGHTS,
    top: ROUTE_TOP,
    outs,
    combined,
    y,
    params,
    code: CODE_ROUTE[mode],
    /* the column is reserved at the widest form, so the diagram does not move */
    codeWidest: CODE_ROUTE.soft,
    units: 6,
  };
}

/** The three rows the weighted-sum block stacks for one sample: at `soft` the
    product each branch contributes, at `hard` the taken branch's row and
    nothing at all for the other two. */
export function routeSumRows(st, s) {
  return [0, 1, 2].map((i) => (st.mode === "hard"
    ? (i === st.top[s] ? st.outs[i][s] : null)
    : st.outs[i][s].map((v) => v * st.weights[s][i])));
}

/**
 * WHICH COLUMN THE BLOCK FRAMES WITH NO POINTER ON IT. Every branch ends in a
 * ReLU, so a feature can be zero in all three, and column 0 is one of those:
 * framed there the printed line reads `0.70 × 0.00 + 0.23 × 0.00 + 0.07 × 0.00
 * = 0.00`, which carries the form and none of the arithmetic. The rest column
 * is the one with the most non-zero terms, the largest total breaking the tie.
 *
 * Here rather than in `main.js` because the verify script asserts the rule and
 * a rule computed twice is a rule that can differ (5.8).
 */
export function routeRestColumn(st, s) {
  const rows = routeSumRows(st, s);
  const total = st.combined[s];
  let best = 0;
  let bestScore = -1;
  for (let c = 0; c < ROUTE_HIDDEN; c += 1) {
    const live = rows.filter((r) => r && Math.abs(r[c]) > 0).length;
    const score = live * 100 + Math.abs(total[c]);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}
