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
export const T3B = T3.map((s) => s.map((r) => r.map((v) => v + 20)));

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

/** A position in reading order over a [2, 2, 5] tensor, as its three indices. */
export function srcIndex(n) {
  return [Math.floor(n / 10), Math.floor((n % 10) / 5), n % 5];
}

export const CELLS = 20;   // values in one [2, 2, 5] tensor

/* --- the shape and join operations, from a verb and its argument ------------ *
 * ROUND 11 (Kenneth, 2026-09-09: "do we just give them the pre-baked examples?
 * or allow them to try different options (those that work)"). The five fixed
 * lines of the lesson became a verb and an argument: every ordering for
 * `permute`, every dimension for `unsqueeze`, `flatten`, `cat` and `stack`,
 * and for `reshape` EVERY shape that holds the same twenty values up to rank 4
 * — sixty-five of them — plus one that does not, [3, 7], which fails the way
 * torch fails it. Each operation is still `dest(n, t)`: where the value at
 * reading position `n` of tensor `t` (0 for T, 1 for the second) lands.
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

/** The URL value of a shape or an ordering: `2-10`, `0-2-1`. */
export const shapeKey = (shape) => shape.join("-");
export const parseKey = (key) => String(key).split("-").map(Number);

/* --- reshape's argument, as the student typed it (round 13) ----------------- *
 * Kenneth chose free entry over a curated list: four slots, each any size from
 * 1 to 20, -1, or blank. So the argument is whatever was typed, and torch's
 * three answers to it are reproduced here: a product other than the size
 * fails as `shape '[3, 7]' is invalid for input of size 20`; one -1 is the
 * size that makes the product right, or that same failure when none does;
 * two are `only one dimension can be inferred`. The empty call fails as
 * torch fails `reshape(())`.
 */
/* ROUND 14: the argument is one TYPED field, `2, -1`. The four dropdowns of
   round 13 were 22 items each, which Kenneth would not have. What was typed
   is split on commas, spaces, `x` or `×`, with brackets ignored, so `[2, 5, 2]`
   and `2x5x2` are the same shape; a token that is not a whole number is
   torch's own TypeError. The URL carries the canonical `2x5x2`. */
const SEP = /[\s,x×]+/;
const MINUS = /[−–]/g;             // a typed minus sign or en dash is a minus

/** The tokens of a typed shape: whole numbers as numbers, anything else as
    the string it was, so the error can name it. */
export function parseShapeText(text) {
  return String(text ?? "").replace(MINUS, "-").replace(/[[\]()]/g, " ").trim()
    .split(SEP).filter(Boolean)
    .map((t) => (/^-?\d+$/.test(t) ? Number(t) : /^-?\d*\.\d+$/.test(t) ? Number(t) : t));
}

/** The URL form of what was typed: `2x-1` where every token is a whole
    number, else the text itself, so a failing entry survives a reload. */
export function shapeWire(text) {
  const toks = parseShapeText(text);
  return toks.every((t) => Number.isInteger(t)) ? toks.join("x") : String(text ?? "").trim();
}

/** What the field shows for a stored value: `2, -1` for `2x-1`. */
export function shapeShow(v) {
  return /^-?\d+(x-?\d+)*$/.test(v ?? "") ? v.split("x").join(", ") : String(v ?? "");
}

/** Resolve typed entries — `[2, -1]` — to the shape they make, or the error. */
export function reshapeFrom(asked) {
  const bad = (shape) => ({ asked, shape: null, ok: false,
    error: `shape '${shapeText(shape)}' is invalid for input of size ${CELLS}` });
  const k = asked.findIndex((d) => !Number.isInteger(d));
  if (k >= 0) {
    return { asked, shape: null, ok: false,
      error: `reshape(): argument 'shape' must be tuple of ints, but found element of type ${typeof asked[k] === "number" ? "float" : "str"} at pos ${k}` };
  }
  if (!asked.every((d) => d >= 1 || d === -1)) return bad(asked);
  const holes = asked.filter((d) => d === -1).length;
  if (holes > 1) return { asked, shape: null, ok: false, error: "only one dimension can be inferred" };
  const known = asked.filter((d) => d !== -1).reduce((a, d) => a * d, 1);
  if (holes === 1) {
    if (asked.length > 4 || CELLS % known !== 0) return bad(asked);
    return { asked, shape: asked.map((d) => (d === -1 ? CELLS / known : d)), ok: true, error: null };
  }
  if (asked.length < 1 || asked.length > 4 || known !== CELLS) return bad(asked);
  return { asked, shape: [...asked], ok: true, error: null };
}


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

function insertedName(d, names, setName) {
  return d === 0 ? (roleNames(setName, 4)[0] || "") : "size 1";
}

/** One Shape operation from its verb and argument. */
export function shapeOp(kind, arg, setName = "sequence") {
  const src = T3_SHAPE;
  const names = roleNames(setName, 3);
  const base = { kind, second: false, ok: true, error: null };
  if (kind === "reshape") {
    /* `arg` is the typed entries, or a `2-10` key from the lab scripts */
    const r = reshapeFrom(Array.isArray(arg) ? arg : parseKey(arg));
    const { asked, shape, ok } = r;
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
            : `A reshape must keep every value, and ${CELLS} values do not fill ${shapeText(asked)}.`,
      dest: (n) => shape.map((d, k) => Math.floor(n / strides[k]) % d),
    };
  }
  if (kind === "permute") {
    const p = parseKey(arg);
    const identity = p.every((v, k) => v === k);
    return {
      ...base,
      value: `permute-${shapeKey(p)}`,
      label: `permute(${p.join(", ")})`,
      shape: p.map((k) => src[k]),
      names: p.map((k) => names[k]),
      caption: identity
        ? "permute(0, 1, 2) keeps the dimensions in their order, so every value stays where it is."
        : `Each value goes to its index reordered as (${p.join(", ")}); each dimension's name travels with its data.`,
      dest: (n) => { const s = srcIndex(n); return p.map((k) => s[k]); },
    };
  }
  if (kind === "unsqueeze") {
    const d = Number(arg);
    const shape = [...src.slice(0, d), 1, ...src.slice(d)];
    return {
      ...base,
      value: `unsqueeze-${d}`,
      label: `unsqueeze(${d})`,
      shape,
      names: [...names.slice(0, d), insertedName(d, names, setName), ...names.slice(d)],
      caption: `A dimension of size 1 is added at position ${d}. Every value keeps its place under it.`,
      dest: (n) => { const s = srcIndex(n); return [...s.slice(0, d), 0, ...s.slice(d)]; },
    };
  }
  /* flatten(start_dim) */
  const start = Number(arg);
  const shape = [...src.slice(0, start), shapeSize(src.slice(start))];
  const strides = src.slice(start).map((_, k, arr) => shapeSize(arr.slice(k + 1)));
  return {
    ...base,
    value: `flatten-${start}`,
    label: start === 0 ? "flatten()" : `flatten(start_dim=${start})`,
    shape,
    names: [...names.slice(0, start), nameJoin(names.slice(start))],
    caption: start === 0
      ? "Every dimension is collapsed into one and the reading order is kept."
      : start === src.length - 1
        ? `Only the last dimension is left to collapse, so the shape does not change.`
        : `The dimensions from ${start} on are collapsed into one; the ones before it are kept.`,
    dest: (n) => {
      const s = srcIndex(n);
      const flat = s.slice(start).reduce((a, v, k) => a + v * strides[k], 0);
      return [...s.slice(0, start), flat];
    },
  };
}

/** One Join operation from its verb and the dimension it works along. */
export function joinOp(kind, arg, setName = "sequence") {
  const src = T3_SHAPE;
  const names = roleNames(setName, 3);
  const d = Number(arg);
  if (kind === "cat") {
    const shape = src.map((v, k) => (k === d ? 2 * v : v));
    return {
      kind, second: true, ok: true, error: null,
      value: `cat-${d}`,
      label: `cat(dim=${d})`,
      shape,
      names,
      caption: `The two tensors are joined along dim ${d}, which grows from ${src[d]} to ${2 * src[d]}. No new dimension appears.`,
      dest: (n, t) => { const s = srcIndex(n); s[d] += t * src[d]; return s; },
    };
  }
  const shape = [...src.slice(0, d), 2, ...src.slice(d)];
  return {
    kind, second: true, ok: true, error: null,
    value: `stack-${d}`,
    label: `stack(dim=${d})`,
    shape,
    names: [...names.slice(0, d), insertedName(d, names, setName), ...names.slice(d)],
    caption: `A new dim ${d} of size 2 holds the two tensors, and each keeps the shape it had.`,
    dest: (n, t) => { const s = srcIndex(n); return [...s.slice(0, d), t, ...s.slice(d)]; },
  };
}

/** The operation the parameters ask for, on either topic, with its dimension
    labels attached. */
export function opFrom(params) {
  const setName = params.names ?? "sequence";
  const op = params.tab === "join"
    ? joinOp(params.join, params.join === "cat" ? params.cdim : params.sdim, setName)
    : shapeOp(params.op,
      params.op === "reshape" ? parseShapeText(params.shape)
        : params.op === "permute" ? params.perm
          : params.op === "unsqueeze" ? params.udim : params.fstart,
      setName);
  return { ...op, roles: labelsOf(op.names ?? []) };
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
