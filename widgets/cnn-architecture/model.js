/* ============================================================================
   Widget 61 · CNN Architecture — the arithmetic.

   PHM5005 06-1 cell 2 (the shared kernel, pooling, receptive field growth) and
   cell 1's parameter argument; 06-2 cell 23 (components and order, calculating
   dimensions, Flatten against global average pooling) and cell 25's SimpleCNN.
   The widget trains nothing: every number here is arithmetic over shapes, and
   every feature map is real — four named image operators over one drawn image
   in the first block, and four measured combinations of those maps after it.

   WHAT IS HERE AND WHAT IS IN `depict.js`. This file holds the arithmetic — the
   network, the parameter counts, the seeded image, the kernels and the maps
   they produce, the pacing, and the head figure that belongs to this widget
   alone. `depict.js` holds the DRAWING: where a column goes, where a window
   goes, and the walk back from a unit to the image. The split is the one
   widget 49 already made, and it is what lets `depict.js` be imported by the
   U-Net and the backbone/head widgets, which bring their own engines.

   THE MAPS ARE COMPUTED HERE, not there, for two reasons. They are seeded
   arithmetic, and seeded arithmetic belongs where `compute()` can run it once a
   parameter change (1.4, non-negotiable 6); and a motif that owned one engine
   could not be the motif.

   WHERE THE NUMBERS COME FROM. Shapes run through core's own `outSize`. A
   convolution costs in·out·k·k + out and a linear layer in·out + out. The
   receptive field is r_out = r_in + (k − 1)·jump with jump_out = jump·stride;
   the square drawn back on the image is `depict.js`'s backward recursion, which
   is the same number arrived at from the other end. Convolutions are stride 1
   with padding (k − 1)/2; pooling is k = 2, stride 2.

   THREE THINGS THE FIRST MOCK SETTLED WITHOUT A PICK, kept:

    1. `blocks: 3` DROPS THE THIRD BLOCK'S POOL, which is cell 25's own shape.
    2. ONE CONVOLUTION A BLOCK, which is what makes the measured 47,625 and
       19,977 the numbers on screen. Cell 25's third block holds two convs and
       reaches 26 px; this net's third block holds one and reaches 18.
    3. THE DIMENSION RULE IS `--c-dim-a` FOR H AND W TOGETHER and `--c-dim-b`
       for C. That departs from the tokens' counting from the last dimension,
       and it is deliberate: a rule per spatial axis would say the two can move
       apart, and under a square kernel with square pooling they do not.
   ========================================================================= */

import { outSize, initBound, uniform } from "../core/torch.js";
import { PAD, STAGE_REF, STAGE_WIDE, growth, stagesOf, galleryLayout, detailLayout, SHOWN, STRIP }
  from "./depict.js";

export { PAD, STAGE_REF, STAGE_WIDE, growth };

/** PathMNIST's nine colon-tissue classes, which is what the head predicts. */
export const CLASSES = 9;
/** Cell 1's dense alternative: the same image into this many units. */
export const DENSE_UNITS = 1000;

/* --- the network ----------------------------------------------------------- */

/**
 * The notebook's net. One block is Conv(k, pad) → ReLU → MaxPool 2, the
 * channels doubling at every block, and the head is Flatten or global average
 * pooling into one `nn.Linear`.
 *
 * `stages` is every tensor the data passes through, the input first; `layers`
 * is every shape-changing operation between them, which is what both receptive
 * field recursions walk.
 */
export function buildNet({ blocks = 2, base = 32, k = 3, head = "gap", input = 28 } = {}) {
  const pad = (k - 1) / 2;
  const stages = [{ kind: "input", name: "Input", C: 3, H: input, params: 0, changed: null }];
  const layers = [];
  let C = 3;
  let H = input;
  let convParams = 0;
  for (let b = 0; b < blocks; b += 1) {
    const out = base * 2 ** b;
    const p = C * out * k * k + out;
    convParams += p;
    H = outSize(H, k, 1, pad);
    layers.push({ k, s: 1, p: pad });
    /* `multi` marks a convolution whose drawn kernels are combinations over
       every input channel rather than one named operator over one channel.
       The first block is the four named operators; every block after it is
       `CONV2_KERNELS`, and the detail band draws a different shape for each. */
    stages.push({
      kind: "conv", name: `conv${b + 1}`, C: out, H, params: p, changed: "C", multi: b > 0,
    });
    C = out;
    /* cell 25's third block carries no pool */
    if (!(blocks === 3 && b === 2)) {
      H = outSize(H, 2, 2, 0);
      layers.push({ k: 2, s: 2, p: 0 });
      stages.push({ kind: "pool", name: `pool${b + 1}`, C, H, params: 0, changed: "HW" });
    }
  }
  const flatIn = C * H * H;
  const headIn = head === "flatten" ? flatIn : C;
  const headParams = headIn * CLASSES + CLASSES;
  let r = 1;
  let j = 1;
  const rf = [{ r, j }];
  for (const L of layers) {
    r += (L.k - 1) * j;
    j *= L.s;
    rf.push({ r, j });
  }
  return {
    cfg: { blocks, base, k, head, input },
    stages,
    layers,
    classes: CLASSES,
    C,
    H,
    flatIn,
    headIn,
    headParams,
    convParams,
    total: convParams + headParams,
    r,
    jump: j,
    rf,
    /** how many columns of the figure the network has, past the image: the
        shape-changing layers, then the head, then the linear layer */
    units: layers.length + 2,
    layerUnits: layers.length,
    dense: input * input * 3 * DENSE_UNITS + DENSE_UNITS,
  };
}

/** The parameters of every layer up to and including stage `n` of the tensors. */
export const convParamsTo = (net, n) =>
  net.stages.slice(1, n + 1).reduce((a, s) => a + s.params, 0);

/** The centre unit of a tensor stage, which is where an unclicked figure marks. */
export const centreUnit = (net, stage) => Math.floor(net.stages[stage].H / 2);

/**
 * What the network IS, as one string. A change to it recomputes and starts the
 * figure over; a change to `unit`, `pos` or `shown` does not.
 */
export const netKey = (p) => [p.blocks, p.base, p.k, p.head, p.input].join(":");

/**
 * The feature-map columns this network has, in order — which is what the Layer
 * control offers. Only `blocks` decides them, and the rule that a third block
 * carries no pool lives in `buildNet` alone (5.8).
 */
export const layerNames = (p) =>
  buildNet({ blocks: Number(p.blocks) || 2 }).stages.slice(1).map((s) => s.name);

/** The Layer control's value for the LAST feature map, whichever it is today.
    Written relatively for the reason `pos` is (decision 8): a block added moves
    the reader's choice to the new last column rather than stranding it. */
export const LAYER_LAST = "last";

/** The rail's string values, as `buildNet` wants them. */
export const paramsToCfg = (p) => ({
  blocks: Number(p.blocks),
  base: Number(p.base),
  k: Number(p.k),
  head: p.head,
  input: Number(p.input),
});

/* ==========================================================================
   THE IMAGE AND THE KERNELS.

   Kenneth, 2026-09-14: *"when animating, i don't see the results of the
   operations"*. So every map on the figure is real: four named operators out
   of image processing run over one drawn image, then ReLU, then max pooling,
   then four cross-channel kernels over the maps that came out. Nothing is
   trained, and the
   figure says so where it draws one — these are named operators, not learned
   filters, and calling them filters would teach the wrong thing about what a
   convolution learns.
   ====================================================================== */

/**
 * ONE CELL: a body inside a bright membrane, a nucleus off centre, and three
 * granules, on a darker field.
 *
 * ROUND 5 REPLACED A GAUSSIAN BLOB WITH THIS (Kenneth's pick, `_lab/
 * cnn-round5-mock.html` §2). A Gaussian has no boundary, so what the edge
 * kernels found in the old image was mostly its own noise and they found it
 * everywhere: the mock measured the horizontal-edge kernel at 2.1 × a flat
 * patch on the blob's own edge, against 28 × here. All four named operators
 * have something different to find in a cell — the membrane is a ring, so the
 * horizontal map is two arcs above and below and the vertical map two arcs left
 * and right; the nucleus is a second, softer boundary inside the first; the
 * granules are single bright spots, which is the centre-surround kernel's own
 * case — and one cell with a nucleus and granules is a BloodMNIST tile.
 *
 * WRITTEN IN COORDINATES OF n / 28, so 64 is the same picture sampled finer
 * rather than a second picture, and the contrast holds at both sizes.
 *
 * `NOISE` is the peak-to-peak amplitude of a uniform draw, so its standard
 * deviation is NOISE/√12 = 0.014. Drawn from the seeded rng core hands
 * `compute`, not `Math.random`.
 */
export const NOISE = 0.05;

/** The cell's geometry at side `n`, in units of n / 28. */
export function cellGeom(n) {
  const u = n / 28;
  return {
    cx: 13.5 * u, cy: 14 * u, R: 9.2 * u, ring: 1.1 * u,
    nx: 16.0 * u, ny: 11.5 * u, nR: 4.1 * u,
    gran: [[9.5, 18.5], [17.5, 19.0], [8.5, 10.0]].map(([a, b]) => [a * u, b * u, 1.35 * u]),
  };
}

/** The noise-free value at one pixel, and which part of the cell it belongs to. */
function cellAt(g, x, y) {
  const d = Math.hypot(x + 0.5 - g.cx, y + 0.5 - g.cy);
  let val = 0.24;
  let part = 0;
  if (d < g.R) { val = 0.60; part = 1; }
  if (d < g.R && d > g.R - g.ring) { val = 0.93; part = 2; }
  if (Math.hypot(x + 0.5 - g.nx, y + 0.5 - g.ny) < g.nR) { val = 0.30; part = 3; }
  for (let i = 0; i < g.gran.length; i += 1) {
    if (Math.hypot(x + 0.5 - g.gran[i][0], y + 0.5 - g.gran[i][1]) < g.gran[i][2]) {
      val = 0.97;
      part = 4 + i;
    }
  }
  return { val, part };
}

export function texture(n, rng) {
  const g = cellGeom(n);
  const v = new Float64Array(n * n);
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      v[y * n + x] = Math.max(0, Math.min(1,
        cellAt(g, x, y).val + NOISE * (rng.next() - 0.5)));
    }
  }
  return v;
}

/** Which part of the cell each pixel belongs to, from the geometry alone. */
export function cellParts(n) {
  const g = cellGeom(n);
  const p = new Int8Array(n * n);
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) p[y * n + x] = cellAt(g, x, y).part;
  }
  return p;
}

const B9 = 1 / 9;
export const KERNELS = [
  { name: "Horizontal edge", short: "H edge", k: [[1, 2, 1], [0, 0, 0], [-1, -2, -1]] },
  { name: "Vertical edge", short: "V edge", k: [[1, 0, -1], [2, 0, -2], [1, 0, -1]] },
  { name: "Blur", short: "Blur", k: [[B9, B9, B9], [B9, B9, B9], [B9, B9, B9]] },
  { name: "Centre-surround", short: "Centre", k: [[0, -1, 0], [-1, 4, -1], [0, -1, 0]] },
];

/* ==========================================================================
   THE SECOND BLOCK'S KERNELS ARE COMBINATIONS OF THE FIRST BLOCK'S MAPS.

   Kenneth, 2026-09-15: *"the second conv2 should have different kernels? for
   higher order features?"* Until round 6 conv2 ran the same four named
   operators, one over each pool1 channel. That contradicts the wiring the
   figure draws — a convolution reads EVERY input channel — and it tells the
   first block's story a second time: a horizontal edge of a horizontal edge.

   So one conv2 map carries a 4 × 3 × 3 weight and one bias: a 3 × 3 slice a
   pool1 channel, applied at the same position, added, plus the bias, then
   ReLU. `buildNet` already counts `C · out · k · k + out`, so the parameter
   count on screen already pays for the bias.

   THE BIAS IS WHAT MAKES A SECOND-LAYER KERNEL SELECTIVE, which is the round's
   own finding. Every input channel is non-negative after ReLU, so a sum of
   positive weights is a brightness — and the brightest structure in the
   picture is the membrane, which is a fifth of it. Four of the six candidates
   `_lab/cnn-round6-mock.html` measured were most enriched there whatever they
   were written to find; subtracting a threshold is what separates them.

   NAMED ON A MEASUREMENT, NOT ON AN INTENTION. Each candidate's response was
   attributed to the parts of the cell `cellParts` defines, and enrichment is
   the share of the response mass in a part over that part's share of the area.
   The four kept clear 3 × in the part they are named for: Membrane 3.67,
   Granule 12.39, Body 7.92, Nucleus 4.76. `_lab/cnn-verify.mjs` §3 runs that
   measurement over the shipping maps.

   A SLICE OF `null` IS AN INPUT CHANNEL THIS OUTPUT IGNORES, which is itself
   something a convolution can learn, and the detail band draws its zeros.
   ====================================================================== */

const AT_CENTRE = [[0, 0, 0], [0, 1, 0], [0, 0, 0]];
const ringOf = (rim, mid) => [[rim, rim, rim], [rim, mid, rim], [rim, rim, rim]];
const scaled = (K, s) => (K ? K.map((r) => r.map((v) => v * s)) : null);

export const CONV2_KERNELS = [
  {
    name: "Membrane",
    short: "Membrane",
    W: [scaled(AT_CENTRE, 0.25), scaled(AT_CENTRE, 0.25), null, AT_CENTRE],
    bias: -0.8,
  },
  {
    name: "Granule",
    short: "Granule",
    W: [null, null, ringOf(0.125, 0.5), null],
    bias: -1,
  },
  {
    name: "Body",
    short: "Body",
    W: [null, null, AT_CENTRE, scaled(AT_CENTRE, -0.5)],
    bias: -0.45,
  },
  {
    name: "Nucleus",
    short: "Nucleus",
    W: [null, null, ringOf(0.125, -1), scaled(AT_CENTRE, -0.5)],
    bias: 0,
  },
];

/**
 * THE 5 × 5 KERNEL IS THE 3 × 3 ONE PADDED WITH ZEROS. A kernel of 5 has to be
 * the same four named operators or the control would change what the figure is
 * about, and there is no second Sobel; a border of zeros is the honest way to
 * write a 3 × 3 operator as a 5 × 5 one, and the figure prints the zeros so the
 * reader can see that the extra ring does nothing. The map is then identical to
 * the map at k = 3, which is itself worth seeing: a bigger kernel is more
 * parameters, and more parameters are not automatically more picture.
 */
export function kernelAt(base, k) {
  if (k === 3) return base;
  const m = (k - 3) / 2;
  return Array.from({ length: k }, (_, j) =>
    Array.from({ length: k }, (_, i) =>
      (j >= m && j < m + 3 && i >= m && i < m + 3 ? base[j - m][i - m] : 0)));
}

/** The same padding for a cross-channel kernel: one slice a channel, or none. */
export const slicesAt = (W, k) => W.map((K) => (K ? kernelAt(K, k) : null));

function convolve(src, n, K) {
  const k = K.length;
  const p = (k - 1) / 2;
  const out = new Float64Array(n * n);
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      let a = 0;
      for (let j = 0; j < k; j += 1) {
        for (let i = 0; i < k; i += 1) {
          const yy = y + j - p;
          const xx = x + i - p;
          if (yy < 0 || yy >= n || xx < 0 || xx >= n) continue;
          a += src[yy * n + xx] * K[j][i];
        }
      }
      out[y * n + x] = a;
    }
  }
  return out;
}
/**
 * One cross-channel output map: a slice a channel, applied at the same
 * position, added, plus the bias. ReLU is applied by the caller, as it is for
 * the single-channel case.
 */
function convolveMulti(srcs, n, slices, bias) {
  const k = (slices.find(Boolean) ?? [[0]]).length;
  const p = (k - 1) / 2;
  const out = new Float64Array(n * n);
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      let a = bias;
      for (let c = 0; c < slices.length; c += 1) {
        const K = slices[c];
        if (!K) continue;
        const src = srcs[Math.min(c, srcs.length - 1)];
        for (let j = 0; j < k; j += 1) {
          for (let i = 0; i < k; i += 1) {
            const yy = y + j - p;
            const xx = x + i - p;
            if (yy < 0 || yy >= n || xx < 0 || xx >= n) continue;
            a += src[yy * n + xx] * K[j][i];
          }
        }
      }
      out[y * n + x] = a;
    }
  }
  return out;
}
const relu = (a) => a.map((v) => Math.max(0, v));
function pool2(src, n) {
  const m = n >> 1;
  const out = new Float64Array(m * m);
  for (let y = 0; y < m; y += 1) {
    for (let x = 0; x < m; x += 1) {
      out[y * m + x] = Math.max(
        src[(2 * y) * n + 2 * x], src[(2 * y) * n + 2 * x + 1],
        src[(2 * y + 1) * n + 2 * x], src[(2 * y + 1) * n + 2 * x + 1],
      );
    }
  }
  return out;
}
export const maxOf = (a) => a.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
export const meanOf = (a) => a.reduce((s, v) => s + v, 0) / a.length;

/** The window a convolution reads at one output cell, zero outside the map. */
export const windowAt = (src, n, r, c, k) => {
  const p = (k - 1) / 2;
  return Array.from({ length: k }, (_, j) => Array.from({ length: k }, (_, i) => {
    const yy = r + j - p;
    const xx = c + i - p;
    return (yy < 0 || yy >= n || xx < 0 || xx >= n) ? 0 : src[yy * n + xx];
  }));
};
/** …and the four values a 2 × 2 max pool reads. */
export const poolWindowAt = (src, n, r, c) =>
  [[src[(2 * r) * n + 2 * c], src[(2 * r) * n + 2 * c + 1]],
    [src[(2 * r + 1) * n + 2 * c], src[(2 * r + 1) * n + 2 * c + 1]]];

/**
 * Every map the figure draws, for one network and one seed.
 *
 * `stages[i]` is `SHOWN` maps of stage i (the image carries one, drawn as a
 * single grey channel); `kernels[i][c]` is the kernel that produced drawn
 * channel c — one of `KERNELS` in the first block and one of `CONV2_KERNELS`
 * after it — and a pooling stage inherits the one before it so the name beside
 * a pooled map is still true. `reads[i]` is what stage i's kernels actually
 * multiplied, which is `stages[i - 1]` everywhere except the third block (see
 * the rescale below). `head` is the four head values and `scores` is the nine
 * the linear layer produces from them.
 */
export function computeMaps(net, rng) {
  const k = net.cfg.k;
  const tex = texture(net.cfg.input, rng);
  const stages = [[tex]];
  const kernels = [null];
  const reads = [null];
  let block = 0;
  /* THE RANGE THE CROSS-CHANNEL KERNELS WERE MEASURED AGAINST. Their biases
     are thresholds, and a threshold means nothing until the inputs are on the
     scale it was set on: the first block's maps run to 2.82 and the second
     block's to 0.12, so the same four kernels over the second block's own
     output answer nowhere at all. The third block therefore scales each input
     channel to the largest value the SECOND block read, and the detail band
     prints the scaled values it multiplies. */
  let readRange = null;
  for (let i = 1; i < net.stages.length; i += 1) {
    const s = net.stages[i];
    const src = stages[i - 1];
    const srcH = net.stages[i - 1].H;
    if (s.kind === "conv") {
      if (block === 0) {
        reads.push(src);
        stages.push(Array.from({ length: SHOWN }, (_, c) =>
          relu(convolve(src[Math.min(c, src.length - 1)], srcH, kernelAt(KERNELS[c].k, k)))));
        kernels.push(KERNELS);
      } else {
        let from = src;
        if (readRange === null) readRange = Math.max(...src.map(maxOf));
        else from = src.map((m) => { const hi = maxOf(m); return m.map((v) => (v * readRange) / hi); });
        reads.push(from);
        stages.push(CONV2_KERNELS.map((K) =>
          relu(convolveMulti(from, srcH, slicesAt(K.W, k), K.bias))));
        kernels.push(CONV2_KERNELS);
      }
      block += 1;
    } else {
      reads.push(src);
      stages.push(src.map((m) => pool2(m, srcH)));
      kernels.push(kernels[i - 1]);
    }
  }
  const last = stages[stages.length - 1];
  /* EVERY VALUE THE FIGURE'S OWN HEAD PRODUCES, which is what the linear layer
     reads: one average a drawn channel under global average pooling, and all
     four drawn channels unrolled end to end under Flatten. Round 5's point 3 —
     the nine scores were computed from four numbers under both heads, so the
     two heads reached the linear layer looking identical. */
  const headAll = net.cfg.head === "gap"
    ? last.map(meanOf)
    : last.flatMap((m) => Array.from(m));
  /* what the head COLUMN draws: four cells under global average pooling, and
     the first `STRIP` values of the vector under Flatten */
  const head = net.cfg.head === "gap"
    ? headAll
    : Array.from({ length: STRIP }, (_, i) => last[0][i] ?? 0);
  /* nine scores from an untrained linear layer at torch's own bound for its
     real in_features, over every value above */
  const bound = initBound.linear(net.headIn);
  const weights = Array.from({ length: CLASSES }, () =>
    Array.from({ length: headAll.length }, () => uniform(rng, bound)));
  const scores = weights.map((row) => row.reduce((a, v, i) => a + v * headAll[i], 0));
  return { stages, kernels, reads, head, headAll, scores, weights, tex };
}

/**
 * The contrast a named kernel reaches on this image: its mean |response| on the
 * cell's boundaries against its mean |response| on a flat patch.
 *
 * A BOUNDARY pixel has a four-neighbour belonging to another part of the cell;
 * a FLAT pixel has a 5 × 5 neighbourhood entirely inside its own part. Both
 * sets come from the noise-free geometry, so the measurement is of the picture
 * and not of the draw. The mock's §2 measured five candidate images this way
 * and the cell won on it.
 */
export function edgeContrast(tex, n, which = 0) {
  const part = cellParts(n);
  const h = convolve(tex, n, KERNELS[which].k);
  let edge = 0;
  let nb = 0;
  let flat = 0;
  let nf = 0;
  for (let y = 2; y < n - 2; y += 1) {
    for (let x = 2; x < n - 2; x += 1) {
      const i = y * n + x;
      if (part[i] !== part[i - 1] || part[i] !== part[i + 1]
        || part[i] !== part[i - n] || part[i] !== part[i + n]) {
        edge += Math.abs(h[i]);
        nb += 1;
        continue;
      }
      let same = true;
      for (let j = -2; j <= 2 && same; j += 1) {
        for (let q = -2; q <= 2; q += 1) {
          if (part[(y + j) * n + x + q] !== part[i]) { same = false; break; }
        }
      }
      if (same) { flat += Math.abs(h[i]); nf += 1; }
    }
  }
  const e = edge / Math.max(1, nb);
  const f = flat / Math.max(1, nf);
  return { edge: e, flat: f, ratio: e / f, nb, nf };
}
/** The same kernel on a constant field, which has to be zero everywhere inside. */
export function flatResponse(n) {
  const flat = new Float64Array(n * n).fill(0.5);
  const h = convolve(flat, n, KERNELS[0].k);
  let m = 0;
  for (let y = 1; y < n - 1; y += 1) for (let x = 1; x < n - 1; x += 1) m = Math.max(m, Math.abs(h[y * n + x]));
  return m;
}

/* ==========================================================================
   WHERE THE MARKED UNIT IS, AS ONE NUMBER.

   CORE ALLOWS A REGION EXACTLY ONE PARAMETER (3.6, and `widget.js` throws at
   load on two), and a click on the figure now has to say three things: which
   column, which of the four drawn channels, and which cell of it. So one
   parameter carries all three.

       pos = 0                                   the default
       pos = ((stage · 4 + channel) · 4097 + idx) + 1

   `idx` is the row-major cell, or 4096 for "the centre of that map", which is
   what a click on a column's own name writes. 4096 is 64 × 64, the largest map
   any control reaches (conv1 on a 64 px image), so a cell can never run into
   the next channel's block.

   THE STAGE IS WRITTEN RELATIVELY WHEN IT IS THE LAST ONE — round 3's bug.
   Kenneth, 2026-09-14: *"when I add another block, there is no link or
   animation to the final one"*. `pos` is a parameter, so nothing rebased it
   when `blocks` moved and the new last column drew with no window and no lines
   into it. Core has no rebase hook, and it should not have one: the fix is that
   the figure's DEFAULT already means *the last feature map*, so a click there
   writes that meaning rather than the index it happens to have today. Three
   reserved stage numbers carry the relative form:

       63  the last stage that carries a feature map
       62  the head column, wherever it sits
       61  the linear layer

   A click on any EARLIER column writes its absolute index, and that pin then
   survives a change to the network — which is what pinning means.
   ====================================================================== */

export const POS_CELLS = 4096;                 // 64 × 64
export const POS_CENTRE_IDX = POS_CELLS;       // "that column, its centre"
export const POS_BLOCK = POS_CELLS + 1;
export const STAGE_LAST = 63;
export const STAGE_HEAD = 62;
export const STAGE_LINEAR = 61;
export const POS_DEFAULT = 0;

export const posOf = (stage, channel, idx) =>
  ((stage * SHOWN + channel) * POS_BLOCK + idx) + 1;
/** "that column, its centre" — what a click on a column's name writes. */
export const posOfColumn = (stage, channel = 0) => posOf(stage, channel, POS_CENTRE_IDX);

/** What a `pos` names, or nulls where it names nothing of its own. */
export function readPos(v) {
  const p = Math.round(Number(v));
  if (!Number.isFinite(p) || p <= POS_DEFAULT) return { stage: null, channel: 0, idx: null };
  const q = p - 1;
  const idx = q % POS_BLOCK;
  const rest = (q - idx) / POS_BLOCK;
  return {
    stage: Math.floor(rest / SHOWN),
    channel: rest % SHOWN,
    idx: idx === POS_CENTRE_IDX ? null : idx,
  };
}
export const POS_MAX = posOf(STAGE_LAST, SHOWN - 1, POS_CENTRE_IDX);
export const POS_MIN = 0;

/* ==========================================================================
   THE PACING, one constant a phase.
   ====================================================================== */

/**
 * ONE COLUMN A PRESS, at the collection's Medium pace. There is no speed
 * control: a network is seven presses at the most, so a pace choice would be a
 * question the reader has to rule out before the figure gets attention (3.4b).
 */
export const UNIT_MS = 700;

/**
 * THE WALK OVER THE MAP, behind the gate. A window has to be on screen long
 * enough to be read as a window — the depiction mock measured that at about
 * 60 ms — and 784 cells at 60 ms is 47 seconds, which nobody watches. So the
 * pace is 60 ms at the first cell and the RATE ramps linearly to `speedup` × by
 * the last, with `speedup` solved for each map so the whole of it finishes
 * inside ten seconds. A 7 × 7 map needs no ramp at all and stays at 60 ms
 * throughout; 28 × 28 ends about fourteen times faster than it starts; 64 × 64
 * about a hundred, which is several cells a frame at the end and is the honest
 * cost of showing every one of 4,096.
 *
 * ROUND 6 MERGED TWO WALKS INTO THIS ONE. Kenneth, 2026-09-15: *"why does the
 * patch scan twice?"* The kernel's walk over the chosen layer's input and the
 * marked unit's walk over its own map visit the same cells of the same map in
 * reading order, and the window the first drew on the immediate source IS the
 * innermost window of the second's receptive field — one step of the backward
 * recursion `lo → lo·s − p` is the kernel's own window. So there is one walk,
 * on this clock, and the fixed six seconds the second used went with it.
 */
export const SLIDE_MS0 = 60;
export const SLIDE_BUDGET = 10000;
const slideTotal = (n, speedup) => {
  let t = 0;
  for (let i = 0; i < n; i += 1) t += SLIDE_MS0 / (1 + (i / n) * (speedup - 1));
  return t;
};
export function slidePlan(n) {
  if (n <= 0) return { n: 0, speedup: 1, total: 0 };
  if (slideTotal(n, 1) <= SLIDE_BUDGET) return { n, speedup: 1, total: slideTotal(n, 1) };
  let lo = 1;
  let hi = 2;
  while (slideTotal(n, hi) > SLIDE_BUDGET && hi < 1e7) hi *= 2;
  for (let i = 0; i < 60; i += 1) {
    const m = (lo + hi) / 2;
    if (slideTotal(n, m) > SLIDE_BUDGET) lo = m; else hi = m;
  }
  return { n, speedup: hi, total: slideTotal(n, hi) };
}
export const slideMsAt = (plan, i) =>
  SLIDE_MS0 / (1 + (Math.min(Math.max(0, i), plan.n - 1) / plan.n) * (plan.speedup - 1));

/* ==========================================================================
   THE THREE BANDS.

   Band 1 is `depict.js`'s gallery, band 2 is its detail band, band 3 is the
   head figure below — which belongs to this widget and to no other, because
   Flatten against global average pooling is 06-2 cell 23's own comparison.

   BAND 2 RESERVES ITS TALLEST CASE, over every column the reader can pick. A
   pooling detail is shorter than a convolution's and the head's is shorter
   again, so a height that followed the pick would move the head figure under
   the reader every time they clicked a column — 3.4k's rule, vertically.
   ====================================================================== */

/* ROUND 5 DREW ONE HEAD INSTEAD OF TWO (Kenneth's pick B, mock §4), and the
   band came down from 300px to 210: the chosen head's figure and its count,
   the other head's total on one printed line under it, and the dense-layer
   rule. What the pair of bars was carrying is now carried by two numbers, and
   the bar floor that stated 11 : 1 where the counts said 48 : 1 goes with it —
   2.11, and the fault the mock measured in the pair. */
const HEAD_H = 210;
const HEAD_MAP = 54;
const HEAD_VEC = 28;
const HEAD_BAR_X = 44;
const BAR_TAIL = 122;
export const BAND_GAP = 18;

export const barMaxAt = (w) => w - (PAD + HEAD_MAP + HEAD_VEC + HEAD_BAR_X) - BAR_TAIL;

/** An empty maps object, for the layout functions that only need shapes.
    The head's LENGTH is real even here, because the head column draws a cell a
    value and `galleryLayout` reads it. */
export const shapesOnly = (net) => ({
  stages: net.stages.map(() => null), kernels: net.stages.map(() => null),
  reads: net.stages.map(() => null),
  head: new Array(net.cfg.head === "flatten" ? STRIP : SHOWN).fill(0),
  headAll: null, scores: null,
});

/** The stage list the drawing reads, for one network. */
export const stagesFor = (net, maps, names) => stagesOf(net, maps ?? shapesOnly(net), names);

/** The tallest detail band any column of this network asks for. */
export function detailHeight(w, stages) {
  let h = 0;
  for (let i = 1; i < stages.length; i += 1) h = Math.max(h, detailLayout(w, stages, i).height);
  return h;
}

/** The three bands' heights and their tops, for one width and one network. */
export function bands(w, net, stages) {
  const st = stages ?? stagesFor(net);
  const one = galleryLayout(w, st).height;
  const two = detailHeight(w, st);
  const three = HEAD_H;
  return {
    one, two, three,
    topOne: 0,
    topTwo: one + BAND_GAP,
    topThree: one + BAND_GAP + two + BAND_GAP,
    height: one + BAND_GAP + two + BAND_GAP + three,
  };
}

/** The stage height core asks for, from the parameters and the width. */
export const stageHeight = (w, params) => bands(w, buildNet(paramsToCfg(params))).height;

/**
 * Band 3: where the chosen head's marks sit, and how long its bar is.
 *
 * `rows` still holds both heads — the band draws one of them and prints the
 * other's total — so the caller asks for the one the reader picked and the one
 * they did not by name rather than by index.
 */
export function headLayout(w, net) {
  const flat = buildNet({ ...net.cfg, head: "flatten" });
  const gap = buildNet({ ...net.cfg, head: "gap" });
  const rows = [
    { head: "flatten", name: "Flatten", net: flat, vec: flat.flatIn },
    { head: "gap", name: "Global average pooling", net: gap, vec: gap.C },
  ];
  return {
    rows, flat, gap,
    barMax: barMaxAt(w),
    mapX: PAD,
    mapS: HEAD_MAP,
    vecX: PAD + HEAD_MAP + HEAD_VEC,
    barX: PAD + HEAD_MAP + HEAD_VEC + HEAD_BAR_X,
    capY: 24,
    /** the chosen head's row, the other head's line, and the benchmark */
    rowY: 48,
    otherY: 134,
    denseY: 164,
    footY: HEAD_H - 12,
    height: HEAD_H,
  };
}
