/* ============================================================================
   Widget 53 · Tensors — the engine.

   PHM5005 05-2 cells 1-69 are the worked example this reproduces, and every
   number below is the notebook's own printed output rather than anything
   generated here:

     cells 3-16   the [2, 2, 5] tensor holding 1-20, dimensions named
                  sample (0), sequence (1), feature (2)
     cells 27-44  reshape(2, -1), flatten, unsqueeze(0), permute(0, 2, 1),
                  reshape(2, 5, 2), and cat/stack against a second tensor
                  holding 21-30 in BOTH of its samples (which is what the
                  lesson has; it is not a typo here)
     cells 51-53  broadcasting X [2, 5] + b, with the rule written as
                  "line the shapes up from the right"
     cells 55-58  X [3, 4] @ W-transpose [4, 2], three data points and two
                  neurons, with W transposed in its own cell so the inner
                  dimensions match
     cells 66-69  mean and std over dim 0 of a [3, 4] batch, then (X - mu)/sd

   NO RANDOMNESS AND NO SEED. Every tensor here is given and every result is
   exact, so there is nothing for an rng to draw and nothing to pin against a
   reference implementation — `_lab/tensor-verify.mjs` asserts the arithmetic
   and the destination maps instead.

   THE DESTINATION MAP IS THE WHOLE POINT. `reshape(2, 5, 2)` and
   `permute(0, 2, 1)` produce the same shape from the same tensor with
   different contents, and the only way to show that is to say where each
   value lands under each. So every shape operation is expressed as one
   function from a position in the source's reading order to an index in the
   result, and the widget animates that function one value at a time.
   ========================================================================= */

/* --- the tensors ---------------------------------------------------------- */

/** The lesson's [2, 2, 5] tensor: 1-20 in reading order. */
export const T3 = [
  [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]],
  [[11, 12, 13, 14, 15], [16, 17, 18, 19, 20]],
];

/** The second tensor cat and stack are given, holding 21-30 in both samples. */
export const T3B = [
  [[21, 22, 23, 24, 25], [26, 27, 28, 29, 30]],
  [[21, 22, 23, 24, 25], [26, 27, 28, 29, 30]],
];

export const T3_SHAPE = [2, 2, 5];

/* --- the four ranks the Basics topic walks -------------------------------- *
 * 05-2 cells 5-16 build the worked tensor by adding a dimension in front, and
 * name the dimensions as it goes. Every rank below is that ladder's own rung,
 * and the values are the notebook's: 1-5, then 1-10, then 1-20, then 1-20 under
 * batch 0 and 21-40 under batch 1.
 *
 * THE ROLE NAMES ARE NOT A SHIFT OF ONE ANOTHER. Going from [2, 5] to [2, 2, 5]
 * inserts `sequence` in the MIDDLE (sample, feature -> sample, sequence,
 * feature) while going from [2, 2, 5] to [2, 2, 2, 5] puts `batch` in front. So
 * a dimension's role is a fact about the rank, not about the dimension's
 * number, and the roles are declared per rank rather than derived.            */

/** [5] — the feature vector of one sample. */
export const R1 = [1, 2, 3, 4, 5];

/** [2, 5] — two samples of five features. */
export const R2 = [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]];

/** [2, 2, 2, 5] — a batch of two of the worked tensor, the second holding
    21-40 so the two batches are told apart by their values, not their shape. */
export const R4 = [T3, T3.map((s) => s.map((r) => r.map((v) => v + 20)))];

const RANK_DATA = { 1: R1, 2: R2, 3: T3, 4: R4 };

export const RANK_SHAPES = { 1: [5], 2: [2, 5], 3: T3_SHAPE, 4: [2, 2, 2, 5] };

/** What each dimension holds at each rank, outermost first. */
export const RANK_ROLES = {
  1: ["feature"],
  2: ["sample", "feature"],
  3: ["sample", "sequence", "feature"],
  4: ["batch", "sample", "sequence", "feature"],
};

/** `0 sample` — a dimension's number and its role, as the arrows name it. */
export const dimLabels = (rank) => RANK_ROLES[rank].map((n, k) => `${k} ${n}`);

/** What each dimension of the worked tensor holds, by index. */
export const DIM_ROLES = dimLabels(3);

/** The tensor at one rank: its shape, its dimension names, and its values. */
export function rankSpec(rank) {
  const r = RANK_DATA[rank] ? Number(rank) : 3;
  const data = RANK_DATA[r];
  return {
    rank: r,
    shape: RANK_SHAPES[r],
    roles: dimLabels(r),
    names: RANK_ROLES[r],
    at: (idx) => idx.reduce((a, k) => a[k], data),
  };
}

/* --- indexing and slicing ------------------------------------------------- *
 * Cells 19-23: one entry per dimension, either a position or a colon. An index
 * REMOVES the dimension it names and a colon KEEPS it, which is the whole of
 * why T[1, 0, 2] is a scalar and T[:, 0, :] is [2, 5].                        */

export const COLON = ":";

/**
 * What an index expression selects from the tensor at `rank`.
 *
 * `selects` says whether a full index is lit, `full` turns a position in the
 * selection into a position in the tensor, and `at` reads the value there — one
 * mapping, so the drawing, the printed text and the sub-tensor's own print
 * cannot disagree about which cells were taken (5.8).
 */
export function selectionOf(rank, parts) {
  const { shape, at, names } = rankSpec(rank);
  const spec = shape.map((_, k) => (parts[k] == null ? COLON : String(parts[k])));
  const keep = [];
  const gone = [];
  spec.forEach((p, k) => { (p === COLON ? keep : gone).push(k); });
  const outShape = keep.map((k) => shape[k]);
  const full = (sub) => {
    const idx = spec.map((p) => (p === COLON ? 0 : Number(p)));
    keep.forEach((k, j) => { idx[k] = sub[j]; });
    return idx;
  };
  return {
    spec,
    keep,
    gone,
    /* The roles the sub-tensor keeps, RENUMBERED: T[:, 0, :] of a [2, 2, 5]
       keeps sample and feature, and in the [2, 5] it makes they are dimensions
       0 and 1. Drawn under the selection, where the tensor's own roles line is
       drawn under the tensor. */
    roles: keep.map((k, j) => `${j} ${names[k]}`),
    fixed: spec.length - keep.length,
    shape: outShape,
    size: shapeSize(outShape),
    text: `T[${spec.join(", ")}]`,
    selects: (idx) => spec.every((p, k) => p === COLON || Number(p) === idx[k]),
    full,
    at: (sub) => at(full(sub)),
  };
}

/* --- the index expression as a control ------------------------------------ *
 * Which parameter holds which dimension's index, what pressing an index label
 * on the figure writes, and which dimensions a drawing offers as targets at
 * all. The widget's region map is built from these three, so the assertions in
 * `_lab/tensor-verify.mjs` are about the shipping rule rather than a copy of
 * it (5.8) — and a region map is exactly the thing no pixel hash can check.  */

/** The parameter that holds one dimension's index. The last dimension is five
    wide at every rank and has a control of its own; the leading ones are two
    wide and share an option list. */
export const indexSlot = (rank, dim) => (dim === rank - 1 ? "feature" : `i${dim}`);

/** What pressing the label for `value` on `dim` writes: that position, or a
    colon when the position is already the chosen one — so one target both sets
    a dimension and clears it. */
export function indexSet(rank, dim, value, parts) {
  const cur = parts[dim] == null ? COLON : String(parts[dim]);
  return { [indexSlot(rank, dim)]: cur === String(value) ? COLON : String(value) };
}

/**
 * Which dimensions a drawing offers as click targets, and how many labels it
 * writes for each.
 *
 * The stack view draws the leading dimension as depth and names it once per
 * index; the row and column indices are the frames view's device and only it
 * writes them. Rank 1 and rank 2 draw the same bare grid in both views, with
 * the edge indices on it, so they offer every dimension either way. At rank 4
 * the frames view names the second dimension INSIDE every frame of the first,
 * so it writes one label per pair.
 */
export function indexTargets(rank, view) {
  const shape = RANK_SHAPES[rank];
  if (rank <= 2) return shape.map((n, dim) => ({ dim, labels: n }));
  if (view === "stack") return [{ dim: 0, labels: shape[0] }];
  return shape.map((n, dim) => ({
    dim,
    labels: rank === 4 && dim === 1 ? shape[0] * n : n,
  }));
}

export const indexTargetCount = (rank, view) =>
  indexTargets(rank, view).reduce((a, t) => a + t.labels, 0);

/* --- shape operations ----------------------------------------------------- */

/** A position in reading order over a [2, 2, 5] tensor, as its three indices. */
export function srcIndex(n) {
  return [Math.floor(n / 10), Math.floor((n % 10) / 5), n % 5];
}

export const CELLS = 20;   // values in one [2, 2, 5] tensor

/* Each operation is `dest(n, t)`: where the value at reading position `n` of
   tensor `t` (0 for T, 1 for the second tensor) lands in the result.

   `second: true` means the walk runs over both tensors, T first, so the unit
   count doubles. Everything else about the animation is identical, which is why
   the Join topic reuses the Shape topic's whole stage — the reader is still
   watching one value go to one place. Cat and stack were two more options of
   the Shape control until 2026-09-08, when they became a topic of their own:
   what they teach is a SECOND TENSOR, not a second reading of one. */
export const SHAPE_OPS = [
  {
    value: "reshape-2-10",
    label: "reshape(2, −1)",
    shape: [2, 10],
    detail: "reads the values in order and cuts them into 2 rows of 10; −1 asks for the size that fits",
    caption: "The values are read in order and cut into two rows of ten. Nothing moves between samples.",
    dest: (n) => [Math.floor(n / 10), n % 10],
  },
  {
    value: "flatten",
    label: "flatten()",
    shape: [20],
    detail: "collapses every dimension into one, keeping the reading order",
    caption: "Every dimension is collapsed into one and the reading order is kept.",
    dest: (n) => [n],
  },
  {
    value: "unsqueeze",
    label: "unsqueeze(0)",
    shape: [1, 2, 2, 5],
    detail: "adds a dimension of size 1 in front, which is how a single sample becomes a batch of one",
    caption: "A dimension of size 1 is added in front. Every value keeps its position under it.",
    dest: (n) => [0, ...srcIndex(n)],
  },
  {
    value: "permute",
    label: "permute(0, 2, 1)",
    shape: [2, 5, 2],
    detail: "moves each value to the index with its last two positions swapped",
    caption: "Each value moves to the index with its last two positions swapped.",
    dest: (n) => {
      const [i, r, c] = srcIndex(n);
      return [i, c, r];
    },
  },
  {
    value: "reshape-2-5-2",
    label: "reshape(2, 5, 2)",
    span: true,
    shape: [2, 5, 2],
    detail: "the same shape permute reaches, filled in reading order instead",
    caption: "The same shape as permute, filled in reading order: the contents differ.",
    dest: (n) => [Math.floor(n / 10), Math.floor((n % 10) / 2), n % 2],
  },
];

/* THE JOIN TOPIC'S TWO OPERATIONS. Both take a second tensor, and the whole of
   what separates them is whether the joined dimension is one that already
   exists (cat, dim 0 grows from 2 to 4) or a new one in front (stack, a dim 0
   of size 2 over two tensors that keep their own shape). */
export const JOIN_OPS = [
  {
    value: "cat",
    label: "cat(dim=0)",
    shape: [4, 2, 5],
    second: true,
    detail: "joins the two tensors along dim 0, which grows from 2 to 4",
    caption: "The two tensors are joined along dim 0, which grows from 2 to 4. No new dimension appears.",
    dest: (n, t) => {
      const [i, r, c] = srcIndex(n);
      return [t * 2 + i, r, c];
    },
  },
  {
    value: "stack",
    label: "stack(dim=0)",
    shape: [2, 2, 2, 5],
    second: true,
    detail: "puts the two tensors under a new dim 0 of size 2, so both keep their own shape",
    caption: "A new dim 0 of size 2 holds the two tensors, and each keeps the shape it had.",
    dest: (n, t) => [t, ...srcIndex(n)],
  },
];

export const opByValue = (value) =>
  SHAPE_OPS.find((o) => o.value === value) ?? SHAPE_OPS[0];

export const joinByValue = (value) =>
  JOIN_OPS.find((o) => o.value === value) ?? JOIN_OPS[0];

/**
 * The walk one Step follows: reading order over the source tensor, then over
 * the second tensor where the operation takes one.
 *
 * Each move carries where the value comes from, what it is, and where it goes,
 * so the drawing, the readout and the assertions all read one list (5.8).
 */
export function shapeWalk(op) {
  const moves = [];
  const tensors = op.second ? [T3, T3B] : [T3];
  tensors.forEach((tensor, t) => {
    for (let n = 0; n < CELLS; n += 1) {
      const [i, r, c] = srcIndex(n);
      moves.push({ t, src: [i, r, c], v: tensor[i][r][c], dst: op.dest(n, t) });
    }
  });
  return moves;
}

/** Total values in a shape; `[]` is a scalar and holds one. */
export const shapeSize = (shape) => shape.reduce((a, b) => a * b, 1);

/** `[2, 5, 2]` — the printed form of a shape, and of a scalar's empty one. */
export const shapeText = (shape) => `[${shape.join(", ")}]`;

/** `T[1, 0, 2]` — the printed form of one index. */
export const indexText = (name, idx) => `${name}[${idx.join(", ")}]`;

/* --- broadcasting --------------------------------------------------------- */

export const BC_X = [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10]];
export const BC_X_SHAPE = [2, 5];

/* The five shapes of b the lesson works through, the last of which fails.
   `real` says which cells of the drawn 2 x 5 block are b's own values; the
   rest are the stretched copies, drawn faint. */
export const BC_CASES = [
  {
    value: "5",
    label: "[5]",
    shape: [5],
    detail: "one value per feature, stretched down the samples",
    at: (r, c) => [10, 20, 30, 40, 50][c],
    real: (r) => r === 0,
  },
  {
    value: "1-5",
    label: "[1, 5]",
    shape: [1, 5],
    detail: "the same five values with the sample dimension written out as 1",
    at: (r, c) => [10, 20, 30, 40, 50][c],
    real: (r) => r === 0,
  },
  {
    value: "2-1",
    label: "[2, 1]",
    shape: [2, 1],
    detail: "one value per sample, stretched across the features",
    at: (r) => [10, 20][r],
    real: (r, c) => c === 0,
  },
  {
    value: "scalar",
    label: "a scalar",
    shape: [],
    detail: "a single number, stretched over both dimensions",
    at: () => 2,
    real: (r, c) => r === 0 && c === 0,
  },
  {
    value: "2",
    label: "[2]",
    shape: [2],
    detail: "two values against five features: the case that fails",
    at: (r, c) => [10, 20][c],
    real: (r, c) => r === 0 && c < 2,
  },
];

export const bCaseByValue = (value) =>
  BC_CASES.find((c) => c.value === value) ?? BC_CASES[0];

/**
 * b's OWN index for the cell drawn at (r, c) of the 2 x 5 footprint, and the
 * reading of it a hover prints. A scalar has no index at all, which is the
 * whole of why it broadcasts everywhere.
 */
export function bName(bCase, r, c) {
  const v = bCase.at(r, c);
  if (bCase.shape.length === 0) return `b = ${num(v)}`;
  if (bCase.shape.length === 1) return `${indexText("b", [bCase.value === "2-1" ? r : c])} = ${num(v)}`;
  return `${indexText("b", [bCase.shape[0] === 1 ? 0 : r, bCase.shape[1] === 1 ? 0 : c])} = ${num(v)}`;
}

/**
 * The lesson's rule, as a verdict per dimension: line the shapes up from the
 * right, a missing dimension counts as 1, equal or 1 passes.
 *
 * Returns one row per dimension of the larger shape, outermost first, each
 * with the two sizes as they are printed and the verdict between them.
 */
export function alignment(xShape, bShape) {
  const rows = [];
  const n = Math.max(xShape.length, bShape.length);
  for (let k = n - 1; k >= 0; k -= 1) {
    const xi = xShape.length - 1 - (n - 1 - k);
    const bi = bShape.length - 1 - (n - 1 - k);
    const xd = xi >= 0 ? xShape[xi] : 1;
    const bd = bi >= 0 ? bShape[bi] : 1;
    const missing = bi < 0;
    const verdict = xd === bd ? "equal" : (xd === 1 || bd === 1 || missing) ? "stretch" : "error";
    rows.push({
      dim: k,
      x: String(xd),
      b: missing ? `(${bd})` : String(bd),
      verdict,
    });
  }
  return rows.reverse();
}

/** Whether the two shapes combine, and the result if they do. */
export function broadcastPlan(bCase) {
  const rows = alignment(BC_X_SHAPE, bCase.shape);
  const bad = rows.find((r) => r.verdict === "error");
  if (bad) {
    return { rows, ok: false, clash: `${bad.x} against ${bad.b}`, shape: null, result: null };
  }
  const result = BC_X.map((row, r) => row.map((v, c) => v + bCase.at(r, c)));
  return { rows, ok: true, clash: null, shape: [...BC_X_SHAPE], result };
}

/* --- matrix multiplication ------------------------------------------------ */

export const MM_X = [[1, 2, 3, 4], [5, 6, 7, 8], [9, 10, 11, 12]];
export const MM_X_SHAPE = [3, 4];
export const MM_Y_SHAPE = [3, 2];
export const MM_W = [[0.1, 0.1, 0.1, 0.1], [0.5, 0.5, 0.5, 0.5]];
export const MM_WT = [0, 1, 2, 3].map((k) => [MM_W[0][k], MM_W[1][k]]);

/** Rows x columns, with no shape checking: the caller has already matched them. */
export function matmul(A, B) {
  return A.map((row) => B[0].map((_, j) => row.reduce((s, v, k) => s + v * B[k][j], 0)));
}

export const MM_Y = matmul(MM_X, MM_WT);

/**
 * One cell of the product, as the sum of products it is: the four terms, their
 * total, and the printed line the readout and the figure both use (5.8).
 */
export function productTerms(r, c) {
  const terms = MM_X[r].map((v, k) => ({ a: v, b: MM_WT[k][c], product: v * MM_WT[k][c] }));
  const sum = terms.reduce((s, t) => s + t.product, 0);
  return {
    terms,
    sum,
    text: `${terms.map((t) => `${num(t.a)}×${num(t.b)}`).join(" + ")} = ${num(sum)}`,
  };
}

/* Which operand the `weights` control puts on the right of the @, and whether
   the inner dimensions match. W untransposed holds one row per neuron, so the
   inner pair is 4 and 2 and there is no product to draw. */
export const MM_CASES = [
  {
    value: "transposed",
    label: "Wᵀ  [4, 2]",
    detail: "W transposed, so the inner dimensions are 4 and 4 and each column is one neuron's weights",
    matrix: MM_WT,
    shape: [4, 2],
    name: "Wᵀ",
    ok: true,
  },
  {
    value: "untransposed",
    label: "W  [2, 4]",
    detail: "W as it is written, one row per neuron, so the inner dimensions are 4 and 2",
    matrix: MM_W,
    shape: [2, 4],
    name: "W",
    ok: false,
  },
];

export const mmCaseByValue = (value) =>
  MM_CASES.find((c) => c.value === value) ?? MM_CASES[0];

/* --- reductions ----------------------------------------------------------- */

export const RED_X = [[1, 2, 3, 4], [2, 3, 4, 5], [3, 4, 5, 6]];
export const RED_X_SHAPE = [3, 4];

export const REDUCERS = {
  mean: (xs) => xs.reduce((a, b) => a + b, 0) / xs.length,
  sum: (xs) => xs.reduce((a, b) => a + b, 0),
  max: (xs) => Math.max(...xs),
};

/**
 * The groups a reduction collapses, in the order Step takes them.
 *
 * dim 0 collapses each COLUMN — one number per feature over the batch, which
 * is the reading the axis confusion gets backwards. dim 1 collapses each row.
 * With no dim named there is one group holding every value.
 */
export function reduceGroups(dim) {
  if (dim === "0") {
    return RED_X[0].map((_, c) => ({
      values: RED_X.map((row) => row[c]),
      cells: RED_X.map((_, r) => [r, c]),
      at: c,
    }));
  }
  if (dim === "1") {
    return RED_X.map((row, r) => ({
      values: [...row],
      cells: row.map((_, c) => [r, c]),
      at: r,
    }));
  }
  return [{
    values: RED_X.flat(),
    cells: RED_X.flatMap((row, r) => row.map((_, c) => [r, c])),
    at: 0,
  }];
}

/** The shape a reduction over `dim` leaves behind. */
export const reduceShape = (dim) =>
  (dim === "0" ? [RED_X_SHAPE[1]] : dim === "1" ? [RED_X_SHAPE[0]] : []);

/** Every group's value under `fn`, in group order. */
export const reduceValues = (fn, dim) => reduceGroups(dim).map((g) => REDUCERS[fn](g.values));

/** The column means, and the unbiased (n − 1) standard deviations beside them. */
export const RED_MU = reduceValues("mean", "0");
export const RED_SD = RED_X[0].map((_, c) => {
  const col = RED_X.map((row) => row[c]);
  const m = RED_MU[c];
  return Math.sqrt(col.reduce((s, v) => s + (v - m) ** 2, 0) / (col.length - 1));
});

/** (X − μ) / σ, with μ and σ both [4] stretched back across the three rows. */
export const RED_Z = RED_X.map((row) => row.map((v, c) => (v - RED_MU[c]) / RED_SD[c]));

/* --- pacing --------------------------------------------------------------- */

/* HOW LONG ONE UNIT TAKES, AND WHETHER IT IS CHOREOGRAPHED, both declared per
   speed rather than decided mid-run (4.1). Slow and Medium slide the value
   from where it is read to where it lands; Fast places it and moves on, which
   is what makes it fast. */
export const UNIT_MS = { slow: 900, medium: 340, fast: 120 };

export const choreographs = (speed) => speed !== "fast";

export const unitMs = (speed) => UNIT_MS[speed] ?? UNIT_MS.medium;

/* --- number formatting ---------------------------------------------------- */

/** Integers plain, everything else to two decimals with trailing zeros gone. */
export function num(v) {
  if (!Number.isFinite(v)) return "—";
  if (Number.isInteger(v)) return String(v);
  return String(Math.round(v * 100) / 100);
}

/* --- how PyTorch prints a tensor ------------------------------------------ *
 * The Shape tab draws a tensor and prints it, and the two have to be the same
 * tensor: a value lights up in the drawing and in the text at once. So the
 * text is not a caption written by hand, it is torch's own layout reproduced
 * from its rules, checked against a real print in `_lab/tensor-verify.mjs`.
 *
 * The three rules that matter, from torch's `_tensor_str`:
 *   - every element is right-aligned to the width of the widest one, and
 *     elements are separated by ", ";
 *   - a node of rank r whose bracket sits at column c joins its children with
 *     "," then r − 1 newlines then c + 1 spaces — which is why a rank-3 print
 *     has a blank line between its 2-D blocks and a rank-4 print has two;
 *   - a row longer than the 80-column line width wraps, at
 *     floor((80 − c) / (width + 2)) elements a line, continuing at column
 *     c + 1. That is what puts `flatten()`'s twenty values on two lines.
 *
 * The lines come back as SEGMENTS rather than as strings, because the painter
 * colours one value at a time: the value in flight is highlighted, the values
 * already read are pale, and a value the walk has not reached yet is drawn as
 * nothing at all. The width is measured over EVERY value, present or not, so a
 * result filling up one value at a time never shifts under the reader.
 */

const LINEWIDTH = 80;             // torch.set_printoptions default
const TENSOR_PREFIX = "tensor(";

/** Every index of `shape`, in reading order. */
function eachIndex(shape, fn) {
  const idx = shape.map(() => 0);
  const total = shapeSize(shape);
  for (let n = 0; n < total; n += 1) {
    fn(idx.slice(), n);
    for (let k = shape.length - 1; k >= 0; k -= 1) {
      idx[k] += 1;
      if (idx[k] < shape[k]) break;
      idx[k] = 0;
    }
  }
}

/**
 * `torch.Size([2, 2, 5])` — what printing a tensor's `.shape` gives.
 * The drawn panels print the bare `[2, 2, 5]`; this is the line under the text.
 */
export const sizeText = (shape) => `torch.Size(${shapeText(shape)})`;

/**
 * A tensor as torch prints it: `{ lines, cols, text }`.
 *
 * `lines` is one array of segments per printed line; a segment carrying `idx`
 * is one value of the tensor at that index, and one without is punctuation,
 * indentation or a separator. `cols` is the longest line in characters, which
 * is what the layout measures the block by.
 */
export function torchPrint(shape, valueAt) {
  let width = 1;
  eachIndex(shape, (idx) => { width = Math.max(width, String(valueAt(idx)).length); });

  const lines = [[]];
  const put = (s, idx) => { if (s !== "") lines[lines.length - 1].push(idx ? { s, idx } : { s }); };
  const wrap = (col) => { lines.push([]); put(" ".repeat(col)); };

  const vector = (prefix, n, col) => {
    const perLine = Math.max(1, Math.floor((LINEWIDTH - col) / (width + 2)));
    put("[");
    for (let i = 0; i < n; i += 1) {
      const idx = [...prefix, i];
      put(String(valueAt(idx)).padStart(width), idx);
      if (i === n - 1) break;
      put(",");
      if ((i + 1) % perLine === 0) wrap(col + 1);
      else put(" ");
    }
    put("]");
  };

  const node = (prefix, depth, col) => {
    const rest = shape.length - depth;
    if (rest === 1) {
      vector(prefix, shape[depth], col);
      return;
    }
    put("[");
    for (let i = 0; i < shape[depth]; i += 1) {
      node([...prefix, i], depth + 1, col + 1);
      if (i === shape[depth] - 1) break;
      put(",");
      for (let k = 0; k < rest - 1; k += 1) lines.push([]);
      put(" ".repeat(col + 1));
    }
    put("]");
  };

  put(TENSOR_PREFIX);
  if (shape.length === 0) put(String(valueAt([])), []);
  else node([], 0, TENSOR_PREFIX.length);
  put(")");

  const rows = lines.map((segs) => segs.map((g) => g.s).join(""));
  return { lines, cols: Math.max(...rows.map((r) => r.length)), text: rows.join("\n") };
}
