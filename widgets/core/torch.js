/* ============================================================================
   core/torch.js — what PyTorch prints, and the numbers its layers start from.

   Lifted out of widgets/tensors/model.js on 2026-09-10, when the 05-3 plan
   (docs/catalogue.md § Slots 49–51) put two more widgets on the same idiom:
   a value-carrying cell grid beside the tensor AS TORCH PRINTS IT, the same
   cell lit in both. Three widgets printing tensors is three copies of torch's
   `_tensor_str` rules unless the rules live once, and 5.8 (one formula, one
   place) is the reason this file exists. Widget 53's model.js imports and
   re-exports these, so its main.js and its lab scripts kept their import.

   Two things are here that tensors never needed and slots 49–51 all do:

   - `outSize` / `transposedOutSize`, the output-size rules of 05-3 cells 6,
     12 and 34. Read by a Convolutional page's formula card, a Pooling page's
     card and a Dimensions page's shape chain — three call sites, one formula.
   - `torchError`, torch's own messages for the three failures the widgets
     draw (a Linear fed the wrong width, an add over unequal shapes, a Conv2d
     fed the wrong channel count). A message string copied into two widgets
     is how the two drift apart; the wording here is torch 2.x's, and it is
     printed in the failure colour as text, never drawn as a cell face.
   - `initBound`, the bounds of PyTorch's default initialisers. The widgets
     train nothing, so what they draw is an untrained layer, and its weights
     should have the magnitudes a real `nn.Linear(4, 3)` prints rather than
     ones invented for the figure. `_lab/dl-layers-measure.mjs` measures the
     consequences (attention at init is nearly uniform; a router's is not).
   ========================================================================== */

/** Total values in a shape; `[]` is a scalar and holds one. */
export const shapeSize = (shape) => shape.reduce((a, b) => a * b, 1);

/** `[2, 5, 2]` — the printed form of a shape, and of a scalar's empty one. */
export const shapeText = (shape) => `[${shape.join(", ")}]`;

/**
 * `torch.Size([2, 2, 5])` — what printing a tensor's `.shape` gives.
 * The drawn panels print the bare `[2, 2, 5]`; this is the line under the text.
 */
export const sizeText = (shape) => `torch.Size(${shapeText(shape)})`;

/** Integers plain, everything else to two decimals with trailing zeros gone. */
export function num(v) {
  if (!Number.isFinite(v)) return "—";
  if (Number.isInteger(v)) return String(v);
  return String(Math.round(v * 100) / 100);
}

/**
 * How torch prints the floats of ONE tensor: every value an integer prints
 * with a trailing point (`52.`), otherwise four decimals (`0.5000`), and a
 * tensor holding a value at or past 1e4 goes to four-digit scientific for
 * every cell (`5.1847e+21`) — what `print(torch.exp(X))` shows in 05-2 cell 50.
 */
export function torchFloatFormat(vals) {
  const flat = vals.flat(Infinity).filter(Number.isFinite);
  const sci = flat.some((v) => v !== 0 && Math.abs(v) >= 1e4);
  if (sci) {
    return (v) => {
      const [m, e] = v.toExponential(4).split("e");
      const sign = e.startsWith("-") ? "-" : "+";
      return `${m}e${sign}${e.replace(/^[-+]/, "").padStart(2, "0")}`;
    };
  }
  if (flat.every(Number.isInteger)) return (v) => `${v}.`;
  /* torch keeps the sign of a negative zero, which X * mask makes of -0.7 */
  return (v) => (Object.is(v, -0) ? "-" : "") + v.toFixed(4);
}

/* --- how PyTorch prints a tensor ------------------------------------------ *
 * A widget draws a tensor and prints it, and the two have to be the same
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
  /* a bracket segment carries the depth of the dimension it opens or closes,
     so the print can light the pair a size-1 dimension adds (widget 53, round 23) */
  const put = (s, idx, depth) => {
    if (s === "") return;
    lines[lines.length - 1].push(idx ? { s, idx } : depth !== undefined ? { s, depth } : { s });
  };
  const wrap = (col) => { lines.push([]); put(" ".repeat(col)); };

  const vector = (prefix, n, col, depth) => {
    const perLine = Math.max(1, Math.floor((LINEWIDTH - col) / (width + 2)));
    put("[", null, depth);
    for (let i = 0; i < n; i += 1) {
      const idx = [...prefix, i];
      put(String(valueAt(idx)).padStart(width), idx);
      if (i === n - 1) break;
      put(",");
      if ((i + 1) % perLine === 0) wrap(col + 1);
      else put(" ");
    }
    put("]", null, depth);
  };

  const node = (prefix, depth, col) => {
    const rest = shape.length - depth;
    if (rest === 1) {
      vector(prefix, shape[depth], col, depth);
      return;
    }
    put("[", null, depth);
    for (let i = 0; i < shape[depth]; i += 1) {
      node([...prefix, i], depth + 1, col + 1);
      if (i === shape[depth] - 1) break;
      put(",");
      for (let k = 0; k < rest - 1; k += 1) lines.push([]);
      put(" ".repeat(col + 1));
    }
    put("]", null, depth);
  };

  put(TENSOR_PREFIX);
  if (shape.length === 0) put(String(valueAt([])), []);
  else node([], 0, TENSOR_PREFIX.length);
  put(")");

  const rows = lines.map((segs) => segs.map((g) => g.s).join(""));
  return { lines, cols: Math.max(...rows.map((r) => r.length)), text: rows.join("\n") };
}

/* --- output sizes (05-3 cells 6, 12 and 34) --------------------------------- */

/** `⌊(in + 2·padding − kernel_size) / stride⌋ + 1` — Conv1d/2d, and pooling at padding 0. */
export const outSize = (n, k, s, p = 0) => Math.floor((n + 2 * p - k) / s) + 1;

/** `(in − 1)·stride − 2·padding + kernel_size + output_padding` — ConvTranspose1d/2d. */
export const transposedOutSize = (n, k, s, p = 0, outPad = 0) => (n - 1) * s - 2 * p + k + outPad;

/* --- torch's own failure messages ------------------------------------------- *
 * Printed verbatim in the failure colour when a shape does not fit. `a` and
 * `b` are 2-D shapes for matmul (mat2 is the Linear's weight TRANSPOSED, so a
 * `Linear(20, 2)` reads `20x2`); `broadcast` takes the two sizes and the
 * dimension they disagree at; `channels` takes the Conv2d weight's shape, the
 * input's shape and the channel count it found. */
export const torchError = {
  matmul: (a, b) =>
    `RuntimeError: mat1 and mat2 shapes cannot be multiplied (${a[0]}x${a[1]} and ${b[0]}x${b[1]})`,
  broadcast: (a, b, dim) =>
    `RuntimeError: The size of tensor a (${a}) must match the size of tensor b (${b}) at non-singleton dimension ${dim}`,
  channels: (weight, input, got) =>
    `RuntimeError: Given groups=1, weight of size ${shapeText(weight)}, expected input${shapeText(input)} to have ${weight[1]} channels, but got ${got} channels instead`,
};

/* --- PyTorch's default initialisers, as the bound of a uniform draw ---------- *
 * Every learnable value a widget draws comes from U(−bound, bound) with the
 * bound PyTorch's own reset_parameters uses, so an untrained figure has the
 * magnitudes the notebook's printed output has. `kaiming_uniform_(a=√5)`, the
 * default for Linear and Conv, reduces to 1/√fan_in; recurrent layers use
 * 1/√hidden on every weight; MultiheadAttention's in-projection and GCNConv's
 * weight are xavier/glorot, √(6 / (fan_in + fan_out)). nn.Embedding is N(0, 1)
 * and is not a bound. */
export const initBound = {
  linear: (fanIn) => 1 / Math.sqrt(fanIn),
  conv: (inChannels, k) => 1 / Math.sqrt(inChannels * k * k),
  recurrent: (hidden) => 1 / Math.sqrt(hidden),
  xavier: (fanIn, fanOut) => Math.sqrt(6 / (fanIn + fanOut)),
};

/** One draw from U(−bound, bound) off the seeded rng `compute` is handed. */
export const uniform = (rng, bound) => (rng.next() * 2 - 1) * bound;
