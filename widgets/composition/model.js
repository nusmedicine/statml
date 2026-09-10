/* ============================================================================
   Widget 51 · Composition — the arithmetic of composing layers into a model,
   and of the four connections that send the data somewhere other than straight
   on.

   PHM5005 05-3 cells 61-101. Every operand here is the notebook's own: one
   `x = torch.randn(4, 10)` (cells 66, 68, 72, 74, 92, 95, 98, 101), cell 62's
   three perspectives on the order, cells 72 and 74's MLP1 and MLP2, cell 80's
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
import { initBound, uniform, outSize, torchError, shapeText } from "../core/torch.js";

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

/* ====================== the walk is one line ahead =========================
 * DECISION 14, and `main.js`'s header carries the whole of it. Kenneth on
 * Gating and Branching (2026-09-10, round 1, comment 3): "some of downstream
 * processes shouldn't be shown at the beginning but revealed with the
 * animation". A unit is LANDED once its line has run, PREVIEW while it is the
 * next line to run, and ABSENT until then — so the stage holds the input, the
 * bus, and exactly one line more than the reader has asked for.
 *
 * Here rather than in `main.js` because the verify script has to read the same
 * rule the drawing does, and a rule computed twice is a rule that can differ
 * (5.8).
 */
export function stageOf(done, unit) {
  if (done >= unit) return "landed";
  if (done + 1 === unit) return "preview";
  return "absent";
}

/**
 * WHICH LINE OWNS WHICH PIECE OF THE DIAGRAM. One entry per thing the page
 * draws that is not the input or the bus, so the verify script can assert that
 * every line lands something and that nothing is drawn more than one line
 * ahead of the walk. `main.js` names the same units at the draw sites; this is
 * the table those names have to agree with.
 */
export function pageUnits(state) {
  switch (state.kind) {
    case "dimensions":
      return state.steps.map((s, i) => ({ id: s.layer.label, unit: i + 1 }));
    case "building":
      return state.steps.map(([label], i) => ({ id: label, unit: i + 1 }));
    case "skip": {
      const u = [
        { id: "skip", unit: 1 },
        { id: "fc1", unit: 2 },
        { id: "relu", unit: 3 },
        { id: "fc2", unit: 4 },
        /* the rail and the + belong to `out = x3 + skip`, which is where the
           two paths meet; line 1 previews the label and nothing else */
        { id: "add", unit: 5 },
        { id: "rail", unit: 5 },
        /* the three bands are values, so they belong to the line that adds
           them and not to the lines that produced the two operands */
        { id: "bands", unit: 5 },
      ];
      if (state.proj) u.push({ id: "proj", unit: 1 });
      if (state.match) u.push({ id: "fc_out", unit: 6 });
      return u;
    }
    case "gating":
      return [
        { id: "fc1", unit: 1 },
        { id: "relu", unit: 1 },
        { id: state.gate === "mask" ? "mask" : "gate_fc", unit: 2 },
        { id: "ring", unit: 3 },
        { id: "gated", unit: 3 },
        { id: "fc2", unit: 4 },
      ];
    case "branching": {
      const u = [
        { id: "fc1", unit: 1 },
        { id: "x1", unit: 1 },
        { id: "fc2", unit: 2 },
        { id: "x2", unit: 2 },
        { id: "merge", unit: 3 },
      ];
      if (!state.mergeError) u.push({ id: "fc3", unit: 4 });
      return u;
    }
    case "routing":
      return [
        { id: "gate", unit: 1 },
        { id: "weights", unit: 1 },
        { id: "branches", unit: 2 },
        { id: "stack", unit: 3 },
        { id: "select", unit: 4 },
        { id: "combined", unit: 5 },
        { id: "fc_out", unit: 6 },
      ];
    default: {
      /* Ordering: one unit a step, a combination or a position, by view. A
         combination is ONE unit and not one per box — Step lights the group,
         because what the figure claims is that the layers go together. */
      const ids = state.view === "combinations"
        ? COMBOS.map((c) => c.boxes.join(" + "))
        : state.view === "position"
          ? POSITIONS.map((p) => p.box)
          : ROLES.map((r) => r.role);
      return ids.map((id, i) => ({ id, unit: i + 1 }));
    }
  }
}

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
export const XLAB = 16;           // a one-line label above a spine, `x` or `input`
export const ORDER_EDGE = 26;     // Ordering's shorter edge, since it has five of them

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
  /* the diagram's own minimum, plus the code column beside it. The add is
     drawn as three bands, and the fit pass reserves the widest of them at 20
     cells, so the cell size does not change when the width control does. */
  skip: (z, cw) => cw + TEXT_GAP + Math.max(SKIP_MIN_DIAG, SKIP_BAND_COLS * z.band),
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
  /* Ordering carries no text column at all since the rebuild: the three views
     draw a box and the text beside it, and the text wraps to whatever the
     stage leaves. So the page's claim on the width is the diagram's own. */
  ordering: () => ORDER_MIN_DIAG,
};

export const routeMinDiag = (z) => 3 * (MIN_BOX + COLGAP) + 3 * z.wcell;

/* --- Routing's weighted sum, drawn ------------------------------------------
 * The box under the three branches used to hold nothing but its own label, and
 * Kenneth asked for a depiction of the sum the page is named for
 * (`_lab/composition-routing-sum.html`, 2026-09-10). Candidate C was built
 * first — the chosen sample's row from each branch, one strip of ROUTE_HIDDEN
 * cells apiece — and he then asked why a `[4, 20]` branch showed one row, so
 * the block is candidate D, the mock's §4: THE WHOLE TENSOR. Three bands of
 * ROUTE_SAMPLES rows by ROUTE_HIDDEN cells, one per branch, each cell shaded as
 * the product that branch contributes to that sample and feature, over a rule,
 * with the combined band under it. The chosen sample's row is lit in all four.
 *
 * THAT BLOCK IS WHAT DECIDES THE DIAGRAM'S WIDTH. The box spans the three
 * branch columns, so twenty cells and their labels are a claim on the diagram
 * that `routeMinDiag`'s four columns alone never made, and the fit pass answers
 * it by putting the code under the diagram at both widths — beside leaves a
 * 259px box against a 456px block, and the cells fall to 6px. The WIDTH is C's
 * exactly: the right-hand column is reserved at the same measurement, so only
 * the height moved, by three rows a band.
 *
 * The two label widths are MEASURED: `main.js` reads them off the live canvas
 * and passes them in, and the constants below are that measurement, for the
 * verify script which has no canvas to ask. The same arrangement as MONO_SM.
 */
export const SUM_PAD = 8;         // the block's inset inside the box
export const SUM_HEAD = 15;       // the box's label, above the first band
export const SUM_GAP = 14;        // between two bands, and where the + sits
export const SUM_RULE = 12;       // between the last branch band and the total
export const SUM_OPW = 12;        // the + / = column
export const SUM_OPGAP = 4;
export const SUM_LGAP = 6;        // between the branch's name and its cells
export const SUM_RGAP = 6;        // between the cells and the weight column
export const SUM_ARITH = 24;      // the one printed line under the box
/* `branch 3` at --fs-xs, and the widest of `combined`, `not taken`, `taken`,
   `weights` and a weight cell at the 770 geometry: the right column is
   reserved at the widest thing it ever carries, so the block does not move
   when the reader switches modes or the stage grows */
export const SUM_LAB_L = 43;
export const SUM_LAB_R = 49;

/** Everything in a band row that is not a cell. */
export const routeSumFixed = (labL = SUM_LAB_L, labR = SUM_LAB_R) =>
  2 * SUM_PAD + SUM_OPW + SUM_OPGAP + labL + SUM_LGAP + SUM_RGAP + labR;
/** The box the block needs: 376px at a 12px cell, 456px at 16px. */
export const routeSumMinW = (z, fixed = routeSumFixed()) =>
  fixed + ROUTE_HIDDEN * z.band;
/** Its height at a cell size: three branch bands, a rule, and the total band,
    each ROUTE_SAMPLES rows deep. 263px at a 12px cell and 327px at 16px. */
export const routeSumH = (p) =>
  2 * SUM_PAD + SUM_HEAD + 4 * (ROUTE_SAMPLES * p) + 2 * SUM_GAP + SUM_RULE;
/** The diagram's minimum: four columns, or the block plus the gate column. */
export const routeDiagMin = (z, fixed) =>
  Math.max(routeMinDiag(z), routeSumMinW(z, fixed) + 3 * z.wcell + COLGAP);

/* the box, the gradient gutter and the skip rail down the right */
export const SKIP_MIN_DIAG = 250;
/* the widest band the add is drawn as: f(x) at the wider of the two widths */
export const SKIP_BAND_COLS = 20;
export const DIM_BOX_W = 180;
/* the 150px box, and the text printed beside it */
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
 * THE PAGE NAMES NO ARCHITECTURE. It drew cell 62's three example blocks —
 * MLP, ResNet, the transformer feed-forward path — until Kenneth on
 * 2026-09-10: "maybe we don't go into details for specific architectures i.e.
 * MLP, Resnet, transformer", and "we want principles like in the notebook 05-3
 * (general pattern, layer combinations, some specific layers at beginning and
 * end)". `_lab/composition-ordering-mock.html` drew three ways to carry that
 * and he picked A: the notebook's three perspectives on one `view` control.
 *
 *   pattern        the four steps a block applies, and the job each one does
 *   combinations   pairs of layers that are used as a unit, each with its reason
 *   position       where each layer sits between the input and the output
 *
 * No page here carries a tensor shape any more, so the widget's shape story
 * belongs to Dimensions alone. The geometry is the mock's §A, constant for
 * constant, and it lives here because `pageHeight`, `draw` and the verify
 * script all measure it (5.8).
 */

/** The four steps of the subunit figure: the role, the job it does, and the
    layers that fill it. `weights` is whether the step has parameters, which is
    what the readout counts. */
export const ROLES = [
  { role: "Transform", job: "learns new features", eg: "Linear, Convolution, Attention", hue: "groupA", weights: true },
  { role: "Normalize", job: "stabilizes the distribution of activations", eg: "BatchNorm, LayerNorm", hue: "groupB", weights: true },
  { role: "Activate", job: "introduces non-linearity", eg: "ReLU, GELU, SiLU", hue: "groupB", weights: false },
  { role: "Regularize", job: "reduces overfitting", eg: "Dropout", hue: "groupC", weights: false },
];
export const PATTERN = ROLES.map((r) => r.role).join(" → ");
export const ROLES_WITH_WEIGHTS = ROLES.filter((r) => r.weights).length;

/** Cell 62's second figure: the layers that are used as a unit. `or` is the
    row a group's alternatives are separated at, and `follows` is the layer the
    first one hands to, which is the readout's third tile. */
export const COMBOS = [
  {
    boxes: ["Convolution", "Pooling"],
    or: null,
    data: "images",
    follows: "Pooling",
    reason: "Convolution extracts local features and pooling summarizes them at a coarser resolution.",
  },
  {
    boxes: ["Embedding", "Recurrent", "Attention"],
    or: 2,
    data: "sequences",
    follows: "Recurrent or Attention",
    reason: "Embedding maps tokens to vectors and the layer after it relates them across the sequence.",
  },
  {
    boxes: ["Linear", "Activation"],
    or: null,
    data: "vectors",
    follows: "Activation",
    reason: "Two linear layers in a row are one linear map, so the activation adds the non-linearity.",
  },
];

/** Cell 62's third figure: the whole network, top to bottom. `side` is the
    text beside the box, at most two lines because a 30px box holds two. */
export const POSITIONS = [
  {
    box: "Encoding",
    pos: "beginning",
    tile: "Embedding, Convolution",
    side: ["Embedding for tokens, Convolution for images,", "or the raw inputs normalized"],
  },
  {
    box: "Subunit",
    pos: "middle",
    repeated: true,
    tile: "the block, repeated",
    side: [PATTERN, "stacked to add depth"],
  },
  {
    box: "Global pooling",
    pos: "end",
    tile: "Global pooling",
    side: ["averages across time or space"],
  },
  {
    box: "Linear",
    pos: "end",
    tile: "Linear",
    side: ["maps to the number of outputs the task needs"],
  },
];

export const ORDER_VIEWS = {
  pattern: ROLES.length,
  combinations: COMBOS.length,
  position: POSITIONS.length,
};

/* --- the mock's §A geometry, so the verify script measures the same page ---
 * The one thing `orderHeight` cannot know is how many rows the caption block
 * wraps to, since that needs a canvas; `main.js` measures it and passes it in,
 * and the verify script asserts the arithmetic at the row counts the browser
 * reports. The same arrangement as MONO_SM. */

export const SIDE_GAP = 8;          // between a box and the text beside it
export const REPEAT_PAD = 24;       // the height the brackets add around a subunit
export const COMBO_GAP = 8;         // between two boxes of one combination
export const COMBO_HEAD = 12;       // above the first box inside a dashed group
export const COMBO_FOOT = 8;        // below the last one

export const COMBO_ROWS = Math.max(...COMBOS.map((c) => c.boxes.length + (c.or != null ? 1 : 0)));
export const COMBO_GROUP_H = COMBO_HEAD + COMBO_ROWS * (BOX_H + COMBO_GAP) + COMBO_FOOT;
export const comboGroupW = (usable) => Math.floor((usable - 2 * GAP) / 3);

/** How tall one position's row is: the repeated one carries its brackets. */
export const positionRowH = (p) => (p.repeated ? BOX_H + REPEAT_PAD : BOX_H);

/** The figure alone, without the band header or the captions. */
export function orderBodyH(view) {
  if (view === "combinations") return COMBO_GROUP_H;
  if (view === "position") {
    return XLAB + POSITIONS.reduce((a, p) => a + positionRowH(p) + ORDER_EDGE, 0)
      + ORDER_EDGE + XLAB;
  }
  return ROLES.length * BOX_H + (ROLES.length - 1) * ORDER_EDGE;
}

/** The stage the page asks for, at a measured number of caption rows. */
export const orderHeight = (view, capRows) =>
  BAND_HEAD + orderBodyH(view) + CAP_GAP + capRows * CAPTION_H + PAD;

export function ordering(view) {
  const v = ORDER_VIEWS[view] ? view : "pattern";
  return { kind: "ordering", view: v, units: ORDER_VIEWS[v] };
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

/* --- the add, drawn as three bands ------------------------------------------
 * The page named the add with a `+` circle and printed the values of one
 * sample in the readout, and Kenneth asked for the bands the plan carried
 * (2026-09-10, round 2): x3, skip and out as three shaded tensors, the form
 * Branching already draws its merge in. The two operands stack, the `+` sits
 * on the spine in the gap under them, and the result is the band below it —
 * or, where the widths disagree, torch's message in the result's place.
 *
 * Here rather than in `main.js` because `pageHeight`, `draw`, `regions` and
 * the verify script all measure the same block (5.8).
 */
export const SKIP_BAND_GAP = 4;     // between the two operand bands
export const SKIP_PLUS_GAP = 34;    // the row the + circle sits in, under them
export const SKIP_BLOCK_FOOT = 8;   // under the result band, before the out edge
export const SKIP_ERR_GAP = 22;     // into the result's row, to the message's first line

/** The block's height, measured from the top of the x3 band. */
export const skipBlockH = (bandH, match, errRows) =>
  2 * bandH + SKIP_BAND_GAP + SKIP_PLUS_GAP
  + (match ? bandH + SKIP_BLOCK_FOOT : SKIP_ERR_GAP + errRows * LINE + 10);

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
 * FC3 IS SIZED FOR THE MERGE. Cell 98 writes `fc3 = nn.Linear(14, 2)`, which
 * is the width concat gives on 8 and 6, and the page held that number fixed
 * until Kenneth on 2026-09-10: with fc3 pinned at 14, five of the six
 * combinations end in a message and only the notebook's own reaches an output.
 * `fc3In` is the width the merge produces, and fc3 is the `Linear(N, 2)` a
 * model written for that merge would declare: 14 after concat on 8 and 6, 16
 * after concat on 8 and 8, 8 after add or average.
 *
 * The one failure left is the notebook's own: add or average on 8 and 6, where
 * the two branches have nothing to line up and torch raises AT THE MERGE.
 */

export const BRANCH_SEED = 41;
/** The width the merge produces, which is what fc3 is declared with. Concat
    joins the two branches, and an elementwise merge keeps one branch's width. */
export const fc3In = (merge, fc2) => (merge === "concat" ? 8 + fc2 : 8);
const brRng = makeRng(BRANCH_SEED);
const B_FC1 = initLinear(brRng, 10, 8);
const B_FC2 = { 6: initLinear(brRng, 10, 6), 8: initLinear(brRng, 10, 8) };
/** One fc3 for each width a merge can hand it. */
const B_FC3 = {
  8: initLinear(brRng, 8, 2),
  14: initLinear(brRng, 14, 2),
  16: initLinear(brRng, 16, 2),
};

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
  const inF = fc3In(merge, fc2);
  const y = merged ? applyLinear(B_FC3[inF], merged) : null;
  const code = CODE_BRANCH.map((l) => (l === MERGE_LINE.concat ? MERGE_LINE[merge] : l));
  return {
    kind: "branching",
    merge,
    fc2,
    x1,
    x2,
    merged,
    feats,
    /* the width fc3 was declared with, which every merge that torch accepts
       hands it exactly */
    fc3In: inF,
    y,
    code,
    mergeError: mergeFails ? torchError.broadcast(8, fc2, 1) : null,
    params: linearParams(10, 8) + linearParams(10, fc2) + linearParams(inF, 2),
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
/* the batch's own row count, named because the sum block draws every one of
   them: a band is [ROUTE_SAMPLES, ROUTE_HIDDEN], which is what the branch
   edges above it already say */
export const ROUTE_SAMPLES = 4;
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

/** What branch `i` contributes to sample `s`: at `soft` the product
    `weights[s][i] * outs[i][s]`, which is the row the block shades; at `hard`
    the row only where that sample took the branch, and null where it did not.
    One function, because the bands, the framed column and the printed line all
    read the same arithmetic (5.8). */
export function routeProductRow(st, i, s) {
  if (st.mode === "hard") return st.top[s] === i ? st.outs[i][s] : null;
  return st.outs[i][s].map((v) => v * st.weights[s][i]);
}

/** The whole [ROUTE_BRANCHES, ROUTE_SAMPLES, ROUTE_HIDDEN] tensor the block
    draws as three bands. */
export const routeProducts = (st) =>
  [0, 1, 2].map((i) => Array.from({ length: ROUTE_SAMPLES }, (_, s) => routeProductRow(st, i, s)));

/** The three rows of one sample — one row out of each band. */
export const routeSumRows = (st, s) => [0, 1, 2].map((i) => routeProductRow(st, i, s));

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

/* ============================== the captions ===============================
 * DECISION 14's second half, and principle 2.4: a claim waits until there is
 * something to claim about. Each line carries the unit it waits for — `at: 0`
 * is a DEFINITION, true before the walk starts, and any other number is a
 * RESULT that appears when the line producing it has run. A held line's row is
 * still measured and still reserved, so the stage height does not move as the
 * walk fills it in.
 *
 * The split, line by line:
 *   Dimensions  the input's own shape and its batch dimension are drawn at rest,
 *               so that line shows at rest; where the chain ends is the result.
 *               A failure is a result of the step that raised.
 *   Skip        both sides of the add, and the two routes back to x, wait for
 *               the add and for the output; what a projection does is a
 *               definition.
 *   Gating      what the gate holds waits for the gate, what gated holds waits
 *               for the multiply; what a mask is, and what a second Linear is,
 *               are definitions.
 *   Branching   the feature count and the fc3 it decides wait for the merge;
 *               what each merge does is a definition.
 *   Routing     the sample's mixture waits for the combine and its branch for
 *               the argmax; nn.ModuleList and the argmax's gradient are
 *               definitions.
 *   Building    what the print names against what the forward pass runs is the
 *               page's result and waits for the last layer; what a print is is
 *               a definition.
 *   Ordering    Pattern and Position each hold a result that waits for the
 *               last unit and a definition that reads at rest; Combinations
 *               holds one reason per group, each marked `only`, so the row
 *               shows for the group being lit and the block stays one line.
 *
 * It lives here rather than in `main.js` so the verify script reads the same
 * table the drawing does (5.8), and the copy audit reads both files.
 */
export function captions(params, state) {
  const line = (text, at = 0) => ({ text, at });
  switch (state.kind) {
    case "dimensions": {
      const last = state.steps[state.steps.length - 1];
      const set = state.set;
      if (last && last.error) {
        return [
          line(`${last.layer.label} was given ${shapeText(last.from)}, and its own sizes describe a different tensor.`,
            state.steps.length),
          line("Each layer's output shape has to be the input shape the next layer was told to expect."),
        ];
      }
      return [
        line(`${set.label} enter as ${shapeText(set.shape)}, and dimension 0 is the batch, which no layer is told about.`),
        line(`The chain ends at ${shapeText(state.out)}, and every size in between is fixed by the layer that produced it.`,
          state.units),
      ];
    }
    case "skip":
      return state.match
        ? [
          line(state.proj
            ? `The projection is a Linear(10, ${state.width}), so both sides of the add are ${shapeText([4, state.width])}.`
            : `f(x) and skip are both ${shapeText([4, state.width])}, so the add is elementwise and the block learns the correction.`,
          5),
          line("The path from the output back to x has two routes, and the one through the skip multiplies the gradient by 1.",
            state.units),
        ]
        : [
          line(`f(x) is ${shapeText([4, state.width])} and skip is ${shapeText([4, 10])}, so the add has nothing to line up.`,
            5),
          line("A projection on the skip path maps the input to the width f(x) produces."),
        ];
    case "gating":
      return state.gate === "mask"
        ? [
          line(`${state.blocked} of the 20 features are blocked, and their column of gated is empty for every sample.`, 3),
          line("A fixed mask is a tensor of 1s and 0s, so it has nothing to learn and the same features are blocked for every input."),
        ]
        : [
          line("Every feature has its own gate between 0 and 1, so the signal is turned down rather than switched off.", 2),
          line("The gate is a second Linear on the same input, and its output is the same shape as the path it multiplies."),
        ];
    case "branching": {
      const w2 = state.fc2;
      if (state.mergeError) {
        return [
          line(`The two branches are ${shapeText([4, 8])} and ${shapeText([4, w2])}, so ${state.merge} has nothing to line up.`, 3),
          line("Concatenation joins the features instead, and it accepts branches of different widths."),
        ];
      }
      return [
        line(`${state.merge} on 8 and ${w2} gives ${state.feats} features, so fc3 is Linear(${state.fc3In}, 2).`, 3),
        line(state.merge === "concat"
          ? "Concatenation keeps both branches whole, so the merged width is the sum of the two."
          : "Addition and averaging combine the branches cell by cell, so the merged width is the width of one branch."),
      ];
    }
    case "routing": {
      const s = Number(params.sample);
      return state.mode === "hard"
        ? [
          line(`Sample ${s} takes branch ${state.top[s] + 1}, and the other two branches contribute nothing to its output.`, 4),
          line("The argmax is a discrete choice, so no gradient reaches the router and it cannot be trained by backpropagation."),
        ]
        : [
          line(`Sample ${s} mixes the three branches ${state.weights[s].map((v) => v.toFixed(2)).join(" · ")}, and branch ${state.top[s] + 1} carries the most of it.`, 5),
          line("nn.ModuleList holds the three branches so they can be applied in a loop; nn.ModuleDict holds them by name so one can be chosen."),
        ];
    }
    case "building":
      return [
        line(state.key === "learnable"
          ? "F.relu is called in forward and is not a submodule, so it is not in the print."
          : state.key === "blocks"
            ? "Each block is a Sequential of its own, so the print nests and the parameter count is the sum of all five layers."
            : "Every layer was declared in __init__, so every layer is in the print.",
        state.units),
        line(params.show === "summary"
          ? "summary() counts registered modules, so it reports the same layers the print names."
          : "A print names the layers a model declares, and the forward pass is what decides which of them run."),
      ];
    default:
      /* ORDERING'S THREE VIEWS. Combinations is the one page in the widget
         whose caption is not a stack: each group has a reason of its own, and
         `only` says the row belongs to the group being shown rather than to
         everything that has landed. The rows SHARE one slot, so the block is
         one line tall whichever group is lit and `pageHeight` is unmoved — the
         mock's §A measured the alternative, a reason under every group, and
         the widest ran into its neighbour. */
      if (state.view === "combinations") {
        return COMBOS.map((c, i) => ({ text: c.reason, at: i + 1, only: true }));
      }
      if (state.view === "position") {
        return [
          line("The layers at the beginning follow the data and the layers at the end follow the task.",
            state.units),
          line("Only the middle is repeated, and the number of repeats is what sets the depth."),
        ];
      }
      return [
        line(`${ROLES_WITH_WEIGHTS} of the ${ROLES.length} steps carry weights, and an activation and a dropout carry none.`,
          state.units),
        line("A block applies these four steps, and the order of the last three is an empirical choice."),
      ];
  }
}
