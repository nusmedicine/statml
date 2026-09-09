/* ============================================================================
   Widget 53 · Tensors — the engine.

   PHM5005 05-2 cells 1-69 are the worked example this reproduces, and every
   number below is the notebook's own printed output rather than anything
   generated here:

     cells 3-16   the [2, 2, 5] tensor holding 1-20, dimensions named
                  sample (0), sequence (1), feature (2)
     cells 27-44  reshape(2, -1), flatten, unsqueeze(0), permute(0, 2, 1),
                  reshape(2, 5, 2), and cat/stack against a second tensor.
                  The notebook's holds 21-30 in BOTH of its samples; the
                  widget's holds 21-40 (Kenneth, round 12), so that every
                  cell of a join carries a value no other cell has — the
                  device the whole widget rests on — and the notebook cell
                  is his to bring in line
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

/** The second tensor cat and stack are given: T + 20, so 21-40, every value
    its own. The lesson's own has 21-30 in both samples, which puts two cells
    on one value and makes the third and fourth blocks of cat(dim=0) identical
    — a picture that cannot say which block came from which sample. */
export const T3B = T3.map((s) => s.map((r) => r.map((v) => v + 20)));   // sourceOf(3).tensors[1]

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

/* --- what the dimensions are called ---------------------------------------- *
 * ROUND 11: THE NAMES ARE A CONVENTION, AND THE WIDGET SAYS SO BY OFFERING
 * THREE. The lesson names its tensors two ways — sequence data [sample,
 * sequence, feature] and image data [sample, channel, height, width] — and a
 * student who sees only one takes it for a property of tensors. `names` is a
 * display parameter that switches the labels while every value stays put;
 * "positions" drops the names and leaves the indices, which is all PyTorch
 * itself knows about a dimension. Kenneth, 2026-09-09: keep the concrete
 * names for context, and show they are chosen per dataset.                  */
export const NAME_SETS = {
  sequence: {
    1: ["feature"],
    2: ["sample", "feature"],
    3: ["sample", "sequence", "feature"],
    4: ["batch", "sample", "sequence", "feature"],
  },
  image: {
    1: ["width"],
    2: ["height", "width"],
    3: ["channel", "height", "width"],
    4: ["sample", "channel", "height", "width"],
  },
  positions: null,
};

/** The role of each dimension at a rank under one convention; "" when the
    convention names nothing. */
export const roleNames = (setName, rank) =>
  NAME_SETS[setName]?.[Number(rank)] ?? Array.from({ length: Number(rank) }, () => "");

/** `0 sample`, or just `0` — a dimension's number and its role, as the arrows
    and the roles line name it. */
export const roleLabels = (setName, rank) =>
  roleNames(setName, rank).map((n, k) => (n ? `${k} ${n}` : `${k}`));

/** The lesson's own convention, which the tests and the defaults use. */
export const RANK_ROLES = NAME_SETS.sequence;
export const dimLabels = (rank) => roleLabels("sequence", rank);

/** What each dimension of the worked tensor holds, by index. */
export const DIM_ROLES = dimLabels(3);

/** The tensor at one rank: its shape, its dimension names, and its values. */
export function rankSpec(rank, setName = "sequence") {
  const r = RANK_DATA[rank] ? Number(rank) : 3;
  const data = RANK_DATA[r];
  return {
    rank: r,
    shape: RANK_SHAPES[r],
    roles: roleLabels(setName, r),
    names: roleNames(setName, r),
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
export function selectionOf(rank, parts, setName = "sequence") {
  const { shape, at, names } = rankSpec(rank, setName);
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
    roles: keep.map((k, j) => (names[k] ? `${j} ${names[k]}` : `${j}`)),
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

/** A position in reading order over `shape`, as its indices; and back. */
export function unravel(n, shape) {
  const idx = [];
  let rest = n;
  for (let k = shape.length - 1; k >= 0; k -= 1) { idx[k] = rest % shape[k]; rest = Math.floor(rest / shape[k]); }
  return idx;
}
export const ravel = (idx, shape) => idx.reduce((a, v, k) => a * shape[k] + v, 0);

/** A position in reading order over the [2, 2, 5] tensor — the lab scripts'
    own name for `unravel` at the lesson's rank. */
export const srcIndex = (n) => unravel(n, T3_SHAPE);

export const CELLS = 20;   // values in one [2, 2, 5] tensor

/* --- the tensor the Shape and Join topics work on (round 15) ---------------- *
 * Kenneth: "the tensors in basics don't carry over to shape/join?" Now they
 * do — `rank` is one parameter across the three data topics, so the tensor a
 * student built in Basics is the one they reshape and join, at 1 to 4
 * dimensions with the lesson's [2, 2, 5] as the default. The second tensor a
 * join takes is T + size, so no two cells of a join carry one value.        */
export function sourceOf(rank) {
  const r = RANK_DATA[rank] ? Number(rank) : 3;
  const shape = RANK_SHAPES[r];
  const size = shapeSize(shape);
  const plus = (d, k) => (Array.isArray(d) ? d.map((x) => plus(x, k)) : d + k);
  const data = [RANK_DATA[r], plus(RANK_DATA[r], size)];
  return {
    rank: r,
    shape,
    size,
    tensors: data,
    read: (t, idx) => idx.reduce((a, k) => a[k], data[t]),
  };
}

/* --- the shape and join operations, from a verb and its argument ------------ *
 * ROUND 11 (Kenneth, 2026-09-09: "do we just give them the pre-baked examples?
 * or allow them to try different options (those that work)"). The five fixed
 * lines of the lesson became a verb and an argument; rounds 13-15 made every
 * argument TYPED, answered as torch answers: a wrong product, a dimension out
 * of range, an ordering that is not a permutation, a word where a number was
 * wanted — each prints torch's own message and leaves the tab inert. Each
 * operation is still `dest(n, t)`: where the value at reading position `n` of
 * tensor `t` (0 for T, 1 for the second) lands.
 *
 * `roles` is what the operation leaves of the dimension names: a permute
 * carries each name with its data, an inserted dimension is named for what it
 * is, a reshape merges names where a new dimension is exactly a run of old
 * ones (`sequence × feature`) and drops them where it is not ([5, 4] cuts
 * across every old dimension, so its dimensions are positions only).          */

export const RESHAPE_FAIL = [3, 7];

/** Every ordered factorisation of `n` into 1..`maxRank` parts, by rank. */
export function allShapes(n, maxRank) {
  const seen = new Set();
  const out = [];
  const rec = (rest, acc) => {
    if (acc.length > 0 && rest === 1) {
      const k = acc.join(",");
      if (!seen.has(k)) { seen.add(k); out.push([...acc]); }
    }
    if (acc.length === maxRank) return;
    for (let d = 1; d <= rest; d += 1) if (rest % d === 0) rec(rest / d, [...acc, d]);
  };
  rec(n, []);
  return out.sort((x, y) => x.length - y.length
    || x.join(",").localeCompare(y.join(","), undefined, { numeric: true }));
}

export const RESHAPE_SHAPES = allShapes(CELLS, 4);
export const PERMUTATIONS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

/** Every ordering of `rank` dimensions, for the checks. */
export function allPermutations(rank) {
  if (rank <= 1) return [[0]];
  const out = [];
  for (const p of allPermutations(rank - 1)) {
    for (let k = 0; k < rank; k += 1) out.push([...p.slice(0, k), rank - 1, ...p.slice(k)]);
  }
  return out.sort((x, y) => x.join(",").localeCompare(y.join(",")));
}

/** The URL value of a shape or an ordering: `2-10`, `0-2-1`. */
export const shapeKey = (shape) => shape.join("-");
export const parseKey = (key) => String(key).split("-").map(Number);

/* --- typed arguments (rounds 13-15) ----------------------------------------- *
 * Every argument is what the student typed. A list — a shape, an ordering —
 * is split on commas, spaces, `x` or `×`, with brackets ignored, so `[2, 5, 2]`
 * and `2x5x2` are the same shape; the URL carries the canonical `2x5x2`. A
 * token that is not a whole number is kept as the string it was, so torch's
 * TypeError can name it. */
const SEP = /[\s,x×]+/;
const MINUS = /[−–]/g;             // a typed minus sign or en dash is a minus
const DRAWN_RANK = 4;              // the highest rank the figure has a drawing for

/** The tokens of a typed list: whole numbers as numbers, anything else as
    the string it was, so the error can name it. */
export function parseShapeText(text) {
  return String(text ?? "").replace(MINUS, "-").replace(/[[\]()]/g, " ").trim()
    .split(SEP).filter(Boolean)
    .map((t) => (/^-?\d+$/.test(t) ? Number(t) : /^-?\d*\.\d+$/.test(t) ? Number(t) : t));
}

/** The URL form of a typed list: `2x-1` where every token is a whole number,
    else the text itself, so a failing entry survives a reload. */
export function shapeWire(text) {
  const toks = parseShapeText(text);
  return toks.every((t) => Number.isInteger(t)) ? toks.join("x") : String(text ?? "").trim();
}

/** What the field shows for a stored list: `2, -1` for `2x-1`. */
export function shapeShow(v) {
  return /^-?\d+(x-?\d+)*$/.test(v ?? "") ? v.split("x").join(", ") : String(v ?? "");
}

/** One typed number: `-1`, or the text itself when it is not one. */
export function intWire(text) {
  const t = String(text ?? "").replace(MINUS, "-").trim();
  return /^-?\d+$/.test(t) ? String(Number(t)) : t;
}

const kindOf = (t) => (typeof t === "number" ? "float" : "str");

/** Resolve typed entries — `[2, -1]` — to the shape they make, or the error. */
export function reshapeFrom(asked, size = CELLS) {
  const bad = (shape) => ({ asked, shape: null, ok: false,
    error: `shape '${shapeText(shape)}' is invalid for input of size ${size}` });
  const k = asked.findIndex((d) => !Number.isInteger(d));
  if (k >= 0) {
    return { asked, shape: null, ok: false,
      error: `reshape(): argument 'shape' must be tuple of ints, but found element of type ${kindOf(asked[k])} at pos ${k}` };
  }
  if (!asked.every((d) => d >= 1 || d === -1)) return bad(asked);
  const holes = asked.filter((d) => d === -1).length;
  if (holes > 1) return { asked, shape: null, ok: false, error: "only one dimension can be inferred" };
  const known = asked.filter((d) => d !== -1).reduce((a, d) => a * d, 1);
  if (holes === 1) {
    if (size % known !== 0) return bad(asked);
    return { asked, shape: asked.map((d) => (d === -1 ? size / known : d)), ok: true, error: null };
  }
  if (asked.length < 1 || known !== size) return bad(asked);
  return { asked, shape: [...asked], ok: true, error: null };
}

/** torch's own words for a dimension outside the range it accepts. */
const outOfRange = (d, hi) => `Dimension out of range (expected to be in range of [${-(hi + 1)}, ${hi}], but got ${d})`;

/** One typed dimension for `verb`, normalised as torch normalises a negative
    one. `hi` is the largest position allowed; `fallback` is torch's default
    where the argument has one, else the empty call is torch's own complaint. */
export function dimFrom(text, verb, argName, hi, fallback = null) {
  const toks = parseShapeText(text);
  if (toks.length === 0) {
    return fallback === null
      ? { d: null, asked: "", ok: false, error: `${verb}() missing 1 required positional argument: '${argName}'` }
      : { d: fallback, asked: String(fallback), ok: true, error: null };
  }
  const t = toks[0];
  if (toks.length > 1 || !Number.isInteger(t)) {
    return { d: null, asked: toks.join(", "), ok: false,
      error: `${verb}(): argument '${argName}' must be int, not ${toks.length > 1 ? "tuple" : kindOf(t)}` };
  }
  if (t > hi || t < -(hi + 1)) return { d: null, asked: String(t), ok: false, error: outOfRange(t, hi) };
  return { d: t < 0 ? t + hi + 1 : t, asked: String(t), ok: true, error: null };
}

/** A typed ordering for `permute` over `rank` dimensions, or torch's error. */
export function permFrom(text, rank) {
  const toks = parseShapeText(text);
  const k = toks.findIndex((d) => !Number.isInteger(d));
  const fail = (error) => ({ p: null, asked: toks, ok: false, error });
  if (k >= 0) return fail(`permute(): argument 'dims' must be tuple of ints, but found element of type ${kindOf(toks[k])} at pos ${k}`);
  if (toks.length !== rank) {
    return fail(`permute(sparse_coo): number of dimensions in the tensor input does not match the length of the desired ordering of dimensions i.e. input.dim() = ${rank} is not equal to len(dims) = ${toks.length}`);
  }
  const over = toks.find((d) => d > rank - 1 || d < -rank);
  if (over !== undefined) return fail(outOfRange(over, rank - 1));
  const p = toks.map((d) => (d < 0 ? d + rank : d));
  if (new Set(p).size !== p.length) return fail("permute(): duplicate dims are not allowed.");
  return { p, asked: toks, ok: true, error: null };
}

/* The one answer that is the figure's and not torch's: a fifth dimension.
   torch would make it; this widget has drawings for four. Said plainly, in
   ink rather than the failure colour, and the tab goes inert. */
export const FIVE_DIMS = (shape) => `${shapeText(shape)} has five dimensions, and this figure draws four.`;

const nameJoin = (names) => names.filter(Boolean).join(" × ");
const labelsOf = (names) => names.map((n, k) => (n ? `${k} ${n}` : `${k}`));

/** The names a reshape leaves: a new dimension that is exactly a run of old
    ones inherits their names joined; a size-1 dimension is named for its size;
    anything else leaves every dimension a position. */
function reshapeNames(src, shape, names) {
  const out = [];
  let p = 0;
  for (const d of shape) {
    if (d === 1) { out.push("size 1"); continue; }
    let prod = 1;
    const run = [];
    while (p < src.length && prod < d) { prod *= src[p]; run.push(names[p]); p += 1; }
    if (prod !== d) return shape.map(() => "");
    out.push(nameJoin(run));
  }
  return p === src.length ? out : shape.map(() => "");
}

/** What an inserted dimension is called: the lesson's own name where it adds
    a front dimension to its [2, 2, 5] (batch, or sample for images), and
    `size 1` anywhere else — the ladder of names is declared per rank, not
    derived, so no other insertion has a name of its own. */
function insertedName(d, setName, rank) {
  return d === 0 && rank === 3 ? (roleNames(setName, 4)[0] || "size 1") : "size 1";
}

/** What a failing operation returns: its label, torch's words (or the
    figure's, for a fifth dimension), no walk. */
const failed = (base, label, error, asked, limit = false) => ({
  ...base, ok: false, error, label, shape: asked, names: [], caption: "", limit, dest: () => [],
});

/** One Shape operation from its verb and argument, on the tensor at `rank`. */
export function shapeOp(kind, arg, setName = "sequence", rank = 3) {
  const source = sourceOf(rank);
  const { shape: src, size } = source;
  const names = roleNames(setName, source.rank);
  const base = { kind, second: false, ok: true, error: null, limit: false, src, size, tensors: source.tensors, read: source.read };
  if (kind === "reshape") {
    /* `arg` is the typed entries, or a `2-10` key from the lab scripts */
    const r = reshapeFrom(Array.isArray(arg) ? arg : parseKey(arg), size);
    const { asked, shape, ok } = r;
    if (ok && shape.length > DRAWN_RANK) {
      return failed(base, `reshape(${asked.join(", ")})`, FIVE_DIMS(shape), shape, true);
    }
    const strides = [];
    let acc = 1;
    if (ok) for (let k = shape.length - 1; k >= 0; k -= 1) { strides[k] = acc; acc *= shape[k]; }
    const inferred = ok && asked.includes(-1) ? shape[asked.indexOf(-1)] : null;
    return {
      ...base,
      value: `reshape-${shapeKey(asked)}`,
      label: `reshape(${asked.join(", ")})`,
      asked,
      inferred,
      shape: ok ? shape : asked,
      ok,
      error: r.error,
      names: ok ? reshapeNames(src, shape, names) : [],
      /* ROUND 12: one line at the 550px stage. The first wording ran 30-55px
         past the canvas edge for every shape (`_lab/tensor-sweep.html?ops`). */
      caption: ok
        ? `The values are refilled into ${shapeText(shape)} in reading order; only the dimensions are recut.`
        : r.error === "only one dimension can be inferred"
          ? "One -1 asks for the size that fits; two leave torch nothing to fit it against."
          : r.error.startsWith("reshape()")
            ? "A shape is a list of whole numbers, one per dimension."
            : `A reshape must keep every value, and ${size} values do not fill ${shapeText(asked)}.`,
      dest: (n) => shape.map((d, k) => Math.floor(n / strides[k]) % d),
    };
  }
  if (kind === "permute") {
    /* a typed ordering, or a `0-2-1` key from the lab scripts */
    const r = permFrom(Array.isArray(arg) ? arg.join(",") : /^[\d-]+$/.test(String(arg)) && String(arg).includes("-") && !String(arg).startsWith("-") ? parseKey(arg).join(",") : arg, source.rank);
    if (!r.ok) return failed(base, `permute(${r.asked.join(", ")})`, r.error, r.asked);
    const p = r.p;
    const identity = p.every((v, k) => v === k);
    return {
      ...base,
      value: `permute-${shapeKey(p)}`,
      label: `permute(${r.asked.join(", ")})`,
      shape: p.map((k) => src[k]),
      names: p.map((k) => names[k]),
      caption: identity
        ? `permute(${p.join(", ")}) keeps the dimensions in their order, so every value stays where it is.`
        : `Each value goes to its index reordered as (${p.join(", ")}); each dimension's name travels with its data.`,
      dest: (n) => { const s = unravel(n, src); return p.map((k) => s[k]); },
    };
  }
  if (kind === "unsqueeze") {
    const r = dimFrom(arg, "unsqueeze", "dim", src.length);
    if (!r.ok) return failed(base, `unsqueeze(${r.asked})`, r.error, []);
    const d = r.d;
    const shape = [...src.slice(0, d), 1, ...src.slice(d)];
    if (shape.length > DRAWN_RANK) return failed(base, `unsqueeze(${r.asked})`, FIVE_DIMS(shape), shape, true);
    return {
      ...base,
      value: `unsqueeze-${d}`,
      label: `unsqueeze(${r.asked})`,
      shape,
      names: [...names.slice(0, d), insertedName(d, setName, source.rank), ...names.slice(d)],
      caption: `A dimension of size 1 is added at position ${d}. Every value keeps its place under it.`,
      dest: (n) => { const s = unravel(n, src); return [...s.slice(0, d), 0, ...s.slice(d)]; },
    };
  }
  /* flatten(start_dim) */
  const r = dimFrom(arg, "flatten", "start_dim", src.length - 1, 0);
  if (!r.ok) return failed(base, `flatten(start_dim=${r.asked})`, r.error, []);
  const start = r.d;
  const shape = [...src.slice(0, start), shapeSize(src.slice(start))];
  const strides = src.slice(start).map((_, k, arr) => shapeSize(arr.slice(k + 1)));
  return {
    ...base,
    value: `flatten-${start}`,
    label: start === 0 && r.asked === "0" ? "flatten()" : `flatten(start_dim=${r.asked})`,
    shape,
    names: [...names.slice(0, start), nameJoin(names.slice(start))],
    caption: start === 0
      ? "Every dimension is collapsed into one and the reading order is kept."
      : start === src.length - 1
        ? "Only the last dimension is left to collapse, so the shape does not change."
        : `The dimensions from ${start} on are collapsed into one; the ones before it are kept.`,
    dest: (n) => {
      const s = unravel(n, src);
      const flat = s.slice(start).reduce((a, v, k) => a + v * strides[k], 0);
      return [...s.slice(0, start), flat];
    },
  };
}

/** One Join operation from its verb and the dimension it works along, on two
    tensors of the shape at `rank`. */
export function joinOp(kind, arg, setName = "sequence", rank = 3) {
  const source = sourceOf(rank);
  const { shape: src, size } = source;
  const names = roleNames(setName, source.rank);
  const base = { kind, second: true, ok: true, error: null, limit: false, src, size, tensors: source.tensors, read: source.read };
  if (kind === "cat") {
    const r = dimFrom(arg, "cat", "dim", src.length - 1, 0);
    if (!r.ok) return failed(base, `cat(dim=${r.asked})`, r.error, []);
    const d = r.d;
    const shape = src.map((v, k) => (k === d ? 2 * v : v));
    return {
      ...base,
      value: `cat-${d}`,
      label: `cat(dim=${r.asked})`,
      shape,
      names,
      caption: `The two tensors are joined along dim ${d}, which grows from ${src[d]} to ${2 * src[d]}. No new dimension appears.`,
      dest: (n, t) => { const s = unravel(n, src); s[d] += t * src[d]; return s; },
    };
  }
  const r = dimFrom(arg, "stack", "dim", src.length, 0);
  if (!r.ok) return failed(base, `stack(dim=${r.asked})`, r.error, []);
  const d = r.d;
  const shape = [...src.slice(0, d), 2, ...src.slice(d)];
  if (shape.length > DRAWN_RANK) return failed(base, `stack(dim=${r.asked})`, FIVE_DIMS(shape), shape, true);
  return {
    ...base,
    value: `stack-${d}`,
    label: `stack(dim=${r.asked})`,
    shape,
    names: [...names.slice(0, d), insertedName(d, setName, source.rank), ...names.slice(d)],
    caption: `A new dim ${d} of size 2 holds the two tensors, and each keeps the shape it had.`,
    dest: (n, t) => { const s = unravel(n, src); return [...s.slice(0, d), t, ...s.slice(d)]; },
  };
}

/** The operation the parameters ask for, on either topic, with its dimension
    labels attached. */
export function opFrom(params) {
  const setName = params.names ?? "sequence";
  const rank = Number(params.rank ?? 3);
  const op = params.tab === "join"
    ? joinOp(params.join, params.join === "cat" ? params.cdim : params.sdim, setName, rank)
    : shapeOp(params.op,
      params.op === "reshape" ? parseShapeText(params.shape)
        : params.op === "permute" ? (params.perm ?? "")
          : params.op === "unsqueeze" ? (params.udim ?? "") : (params.fstart ?? ""),
      setName, rank);
  return { ...op, roles: labelsOf(op.names ?? []) };
}

/* --- what a field says while it is typed in (round 15) ---------------------- *
 * The widget's own voice, live, under the field: not torch's message, which
 * the band prints on Enter, but the one fact that would make the entry work.
 * Null when nothing is wrong. */
export function hintFor(kind, text, rank) {
  const src = RANK_SHAPES[rank] ?? T3_SHAPE;
  const size = shapeSize(src);
  const n = src.length;
  const range = (hi) => `0 to ${hi}, or −1 to −${hi + 1}`;
  if (kind === "reshape") {
    const toks = parseShapeText(text);
    if (toks.length === 0) return null;
    if (toks.some((t) => !Number.isInteger(t))) return "whole numbers only";
    if (toks.length > DRAWN_RANK) return `${toks.length} dimensions, and this figure draws ${DRAWN_RANK}`;
    const holes = toks.filter((t) => t === -1).length;
    if (holes > 1) return "only one −1";
    if (toks.some((t) => t < 1 && t !== -1)) return "every size at least 1";
    const known = toks.filter((t) => t !== -1).reduce((a, t) => a * t, 1);
    if (holes === 1) return size % known === 0 ? null : `${known} does not divide ${size}`;
    return known === size ? null : `product ${known}, and the tensor holds ${size}`;
  }
  if (kind === "permute") {
    const toks = parseShapeText(text);
    if (toks.length === 0) return null;
    if (toks.some((t) => !Number.isInteger(t))) return "whole numbers only";
    if (toks.length !== n) return `${n} positions, 0 to ${n - 1}, each once`;
    if (toks.some((t) => t > n - 1 || t < -n)) return `positions run 0 to ${n - 1}`;
    if (new Set(toks.map((t) => (t < 0 ? t + n : t))).size !== n) return "each position once";
    return null;
  }
  const toks = parseShapeText(text);
  if (toks.length === 0) return null;
  if (toks.length > 1 || !Number.isInteger(toks[0])) return "one whole number";
  const t = toks[0];
  const hi = kind === "unsqueeze" || kind === "stack" ? n : n - 1;
  if (t > hi || t < -(hi + 1)) return range(hi);
  if ((kind === "unsqueeze" || kind === "stack") && n === DRAWN_RANK) return "a fifth dimension, which this figure does not draw";
  return null;
}

/**
 * The walk one Step follows: reading order over the source tensor, then over
 * the second tensor where the operation takes one.
 *
 * Each move carries where the value comes from, what it is, and where it goes,
 * so the drawing, the readout and the assertions all read one list (5.8).
 */
export function shapeWalk(op) {
  const moves = [];
  if (!op.ok) return moves;
  const count = op.second ? 2 : 1;
  for (let t = 0; t < count; t += 1) {
    for (let n = 0; n < op.size; n += 1) {
      const src = unravel(n, op.src);
      moves.push({ t, src, v: op.read(t, src), dst: op.dest(n, t) });
    }
  }
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
