/* ============================================================================
   Matrix factorization — NMF and PCA, as two tabs. Widget 41, DRAFT.

   Both tabs factorise the same matrix into the same two pieces, and everything
   that differs follows from one constraint. NMF may not use a minus sign: it
   cannot centre, its signatures are rays out of the origin, and it must be told
   how many to find before it starts. PCA may: it centres first, its components
   are directions through the middle of the cloud, and it computes all of them
   at once, so its control chooses how many to keep.

   THE PRICE OF THE CONSTRAINT IS ON SCREEN. PCA reconstructs better at every
   rank — 0.262 against 0.371 at one, 0.148 against 0.243 at two, 0.120 against
   0.133 at three — because a truncated SVD plus the mean is the best rank-k
   approximation there is. NMF gives up that much fit for factors that add
   rather than cancel.

   THE TRUTH DIAL EXISTS BECAUSE THE OBVIOUS CLAIM IS FALSE. "Change the start
   and the answer changes" does not hold for a correctly-specified NMF: with two
   real patterns fitted at rank 2, twelve starts give a residual spread of 0.00%
   and recover the truth to cosine 0.966-0.990. What is not reproducible is an
   NMF asked for MORE THAN ARE THERE — median agreement between starts falls
   0.973 to 0.470 as the rank climbs 2 to 7 against six real patterns, while the
   residual barely moves.

   THE TABS AND VIEWS ARE SEGMENTED CONTROLS, NOT GATES. `widget.js` finds
   GATE_PARAM with a `.find`, so a widget may have exactly one gate, and a shut
   gate hides the whole drive row. Solve is drivable from the default state, so
   a gate would have shipped a dead button.

   Design history and the measurements behind every constant are in
   docs/catalogue.md under Slot 2; `_lab/mf-nesting.mjs` reprints the numbers.
   ========================================================================= */

import { defineWidget, fmt } from "../core/index.js";

import {
  GENES, SAMPLES, SCHEDULE, clamp, col, cosine, agreement,
  makeStage, fitTrace, pcaTrace,
} from "./model.js";

/* ------------------------------------------------------------------ drawing */

/* Scaled to the 98th percentile rather than the maximum: one very large gene
   otherwise pushes every other cell to the bottom of the ramp and the block
   structure the stage was built to show stops being visible. */
function heatScale(M) {
  const flat = M.flat().slice().sort((a, b) => a - b);
  return flat[Math.floor(0.98 * (flat.length - 1))] || 1;
}

function mixColour(ctx, lo, hi, t) {
  /* canvas has no color-mix, so the two ends are interpolated by hand. Both
     ends come from tokens, so the ramp still has no hardcoded colour in it. */
  const parse = (c) => {
    ctx.fillStyle = c;
    const s = ctx.fillStyle;
    if (s[0] === "#") {
      return s.length === 4
        ? [1, 2, 3].map((i) => parseInt(s[i] + s[i], 16))
        : [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
    }
    const m = s.match(/[\d.]+/g) || [0, 0, 0];
    return [Number(m[0]), Number(m[1]), Number(m[2])];
  };
  const a = parse(lo), b = parse(hi);
  const u = clamp(t, 0, 1);
  return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * u)).join(",")})`;
}

/* A matrix of magnitudes runs one way from the figure surface; a matrix
   carrying signs needs zero in the middle and two directions out of it. So the
   PCA tab is drawn two-sided and the NMF tab one-sided.

   The one-sided ramp starts at `surface3` rather than at --c-value-low: running
   blue-to-red over a matrix of counts read as diverging, which said there was a
   middle when there is not one. */
function drawHeat(ctx, colors, M, x, y, cw, ch, max, signed = false) {
  const scale = signed
    ? (Math.max(...M.flat().map(Math.abs)) || 1)
    : (max ?? heatScale(M));
  for (let i = 0; i < M.length; i += 1) {
    for (let j = 0; j < M[i].length; j += 1) {
      const t = M[i][j] / scale;
      ctx.fillStyle = signed
        ? (t >= 0
          ? mixColour(ctx, colors.surface3, colors.valueHigh, t)
          : mixColour(ctx, colors.surface3, colors.valueLow, -t))
        : mixColour(ctx, colors.surface3, colors.valueHigh, t);
      ctx.fillRect(x + j * cw, y + i * ch, cw - 1, ch - 1);
    }
  }
}

function text(ctx, s, x, y, colour, align = "left") {
  ctx.save();
  ctx.fillStyle = colour;
  ctx.textAlign = align;
  ctx.fillText(s, x, y);
  ctx.restore();
}

/* ============================================================================ */

const METHODS = [
  { value: "nmf", label: "NMF", detail: "no minus signs, so it cannot centre" },
  { value: "pca", label: "PCA", detail: "centres first, and signs are allowed" },
];

const VIEWS = [
  { value: "decomposition", label: "Decomposition", detail: "the matrix split in two, and the factors themselves" },
  { value: "geometry", label: "Geometry", detail: "three genes as three axes, and what the factors are there" },
];

const isNmf = (p) => p.method === "nmf";
/* Two controls rather than one that renames itself: NMF must be TOLD its rank
   before it starts, PCA computes every component and you choose how many to
   KEEP, and the two names carry that difference. Core reads `field.label` as a
   plain value, so a single control could not rename itself per tab in any case. */
const askedFor = (p) => (isNmf(p) ? p.rank : p.components);

defineWidget({
  slug: "matrix-factorization",
  title: "Matrix Factorization",
  subtitle:
    "Matrix factorization reduces dimensions by writing one matrix as a product "
    + "of two smaller ones. NMF keeps both factors non-negative, so its patterns "
    + "add up and never cancel. PCA drops that, and goes by variance in order.",
  layout: "side",
  status: "shipped",
  height: 452,

  params: {
    /* The rail reads: what you are looking at, what you do to it, then — below
       the drive row — how you want to look at the result. Opening with the
       method asked the reader to choose a factorization before they had been
       told there was a matrix. */
    data: { type: "section", label: "The data" },

    /* THE TRUTH IS A PATTERN; AN ESTIMATE OF ONE IS A SIGNATURE OR A COMPONENT.
       Both tabs are then scored on "Match to the real patterns", so neither
       method's own word is made the standard the other is failing to meet. */
    programmes: {
      type: "int",
      label: "Real patterns",
      detail: "how many the samples were actually built from",
      min: 2, max: 5, default: 2,
    },

    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },

    how: { type: "section", label: "The factorization" },

    /* A DATA parameter, not display: the two tabs compute different numbers, so
       switching resets the animation and Solve is pressed again on each. */
    method: {
      type: "segmented",
      label: "Method",
      options: METHODS,
      default: "nmf",
    },

    rank: {
      type: "int",
      label: "Rank",
      detail: "NMF is told this before it starts, and refits if you change it",
      min: 1, max: 6, default: 2,
      when: { param: "method", equals: "nmf" },
    },

    components: {
      type: "int",
      label: "Components",
      detail: "how many to keep — every component was computed anyway",
      min: 1, max: 6, default: 2,
      when: { param: "method", equals: "pca" },
    },

    algorithm: {
      type: "segmented",
      label: "Objective",
      options: [
        { value: "frobenius", label: "Squared error", detail: "Lee and Seung's original update" },
        { value: "kl", label: "KL divergence", detail: "the default in R's NMF package" },
      ],
      default: "frobenius",
      when: { param: "method", equals: "nmf" },
    },

    /* A SECOND SEED. `seed` builds the data; `start` only decides where the
       solver begins on data that has not moved. One dial for both would
       conflate "different samples" with "different answer from the same
       samples". PCA has no such dial: it returns the same answer every time. */
    start: {
      type: "int",
      label: "Random start",
      detail: "the same data, a different place to begin",
      min: 1, max: 40, default: 1,
      when: { param: "method", equals: "nmf" },
    },

    /* `afterDrive` builds these into the block under Solve rather than above
       it. The view is a property of the answer, so it belongs after the button
       that produces one.

       `programmes` defaults to 2, matching the rank, so the first Solve shows
       the method working. At 3 against a rank of 2 the opening readout said
       "Match to the real patterns 0.485", and a number that low on first sight
       reads as the method having failed rather than as having been asked for
       fewer than exist. */
    look: { type: "section", label: "How to look at it", afterDrive: true },

    view: {
      type: "segmented",
      label: "View",
      options: VIEWS,
      default: "decomposition",
      display: true,
      afterDrive: true,
    },

    shown: { type: "int", min: 0, max: SCHEDULE.length, default: 0, hidden: true },
  },

  /* `({ params })`, NOT a flat destructure — core calls this with the params
     wrapped in an object. Destructured flat, every name was undefined, every
     branch fell through, and all views showed one another's legends. */
  legend: ({ params }) => {
    const nmf = isNmf(params);
    /* ONE MEANING PER PANEL. --c-value-low and --c-cluster-a are both
       series-1, so a factor's bars came out the same blue as "a small
       measurement" for two unrelated reasons. The decomposition view therefore
       drops the hues and labels its strips in ink. */
    if (params.view === "geometry") {
      const entries = nmf
        ? [{ token: "highlight", label: "the signatures, as rays from the origin", mark: "line" }]
        : [{ token: "highlight", label: "the components, as axes through the middle", mark: "line" }];
      entries.push({ token: "group-a", label: "a sample, coloured by the pattern it mostly runs on", mark: "dot" });
      if (askedFor(params) === 2) {
        entries.push(nmf
          ? { token: "highlight", label: "the cone every rebuilt sample lies in", mark: "area" }
          : { token: "highlight", label: "the plane every sample is projected onto", mark: "area" });
      }
      if (!nmf) entries.push({ token: "reference", label: "the mean, which PCA subtracts first", mark: "dot" });
      return entries;
    }
    return nmf
      ? [
        { token: "value-high", label: "a large measurement; pale is a small one", mark: "bar" },
        { token: "reference", label: "where the real patterns change", mark: "dashed" },
      ]
      : [
        { token: "value-high", label: "above this gene's mean", mark: "bar" },
        { token: "value-low", label: "below it — which is why PCA may centre and NMF may not", mark: "bar" },
        { token: "reference", label: "where the real patterns change", mark: "dashed" },
      ];
  },

  compute: ({ params, rng }) => {
    const { V, Wtrue, label, block } = makeStage(params.programmes, rng);
    const k = askedFor(params);
    const nmf = isNmf(params);

    /* The mean each gene is centred by. NMF never uses it; PCA's reconstruction
       is `mean + L × S`, and scoring without adding it back compares a centred
       reconstruction with an uncentred matrix — which gave a relative residual
       of 6.8 that ROSE with k before it was caught. */
    const mu = V.map((row) => row.reduce((a, b) => a + b, 0) / SAMPLES);

    const snaps = nmf
      ? fitTrace(V, k, params.start, params.algorithm, rng)
      : pcaTrace(V, k);
    const final = snaps[snaps.length - 1];

    /* BOTH RESIDUALS AGAINST V, ON ONE DENOMINATOR. PCA factorises the centred
       matrix and NMF the raw one, so their own residuals answer different
       questions and cannot be compared. */
    let ss = 0, tot = 0;
    for (let g = 0; g < GENES; g += 1) {
      for (let j = 0; j < SAMPLES; j += 1) {
        let p = nmf ? 0 : mu[g];
        for (let q = 0; q < k; q += 1) p += final.W[g][q] * final.H[q][j];
        ss += (V[g][j] - p) ** 2;
        tot += V[g][j] ** 2;
      }
    }
    const unexplained = Math.sqrt(ss / tot);

    const nPair = Math.min(k, params.programmes);
    /* A component has no sign — an eigenvector and its negative are the same
       direction — so PCA is scored on |cosine|, and NMF, which cannot be
       negative, on the cosine itself. */
    const toTruth = agreement(final.W, Wtrue, nPair, !nmf);

    let betweenStarts = null;
    if (nmf) {
      /* Same data, same rank, same objective, a different start. The offset is
         fixed so the number is reproducible from the URL like everything else. */
      const other = fitTrace(V, k, params.start + 17, params.algorithm, rng);
      betweenStarts = agreement(final.W, other[other.length - 1].W, k);
    }

    /* One more fit at one higher k: PCA's first k components are the same
       vectors whether you asked for k or for all of them, while NMF refits
       every signature. Computed so the figure can state it as a number. */
    let survives = null;
    if (k < 6) {
      const wider = nmf
        ? fitTrace(V, k + 1, params.start, params.algorithm, rng)
        : pcaTrace(V, k + 1);
      const wideW = wider[wider.length - 1].W;
      survives = [];
      for (let q = 0; q < k; q += 1) {
        let best = -1;
        for (let l = 0; l < k + 1; l += 1) {
          const c = Math.abs(cosine(col(final.W, q), col(wideW, l)));
          if (c > best) best = c;
        }
        survives.push(best);
      }
    }

    return {
      V, Wtrue, label, block, mu,
      Z: V.map((row, g) => row.map((v) => v - mu[g])),
      snaps, unexplained, toTruth, betweenStarts, survives, nPair,
      vMax: heatScale(V),
    };
  },

  animation: {
    /* `stepLabel: null` DECLINES the step button for the life of the widget.
       Omitting it is not the same thing: core would fall back to "Draw one" and
       the widget would grow a second button. */
    stepLabel: null,
    runLabel: "Solve",
    runTitle: "Factorise the matrix",

    init: ({ params, state, fromScratch }) => ({
      /* `shown` is honoured on first render only, which is what publishes a
         finished figure as `?shown=17`. */
      shown: fromScratch ? 0 : clamp(params.shown, 0, state.snaps.length),
      acc: 0,
      done: false,
    }),

    /* The rate is fixed, there being no speed control. PCA's trace is one
       snapshot and NMF's is seventeen, so the same rate takes PCA a single frame
       and NMF about a second and a half. */
    advance: (anim, { dt, state }) => {
      if (anim.shown >= state.snaps.length) { anim.done = true; return false; }
      anim.acc += dt * 12;
      while (anim.acc >= 1 && anim.shown < state.snaps.length) {
        anim.acc -= 1;
        anim.shown += 1;
      }
      if (anim.shown >= state.snaps.length) { anim.done = true; return false; }
      return true;
    },
  },

  draw: ({ ctx, colors, w, h, params, state, anim }) => {
    const shown = clamp(anim?.shown ?? 0, 0, state.snaps.length);
    const snap = shown > 0 ? state.snaps[shown - 1] : null;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textBaseline = "alphabetic";
    if (params.view === "geometry") drawGeometry(ctx, colors, w, h, params, state, snap);
    else drawDecomposition(ctx, colors, w, h, params, state, snap, shown);
  },

  readout: ({ params, state, anim }) => {
    const shown = clamp(anim?.shown ?? 0, 0, state.snaps.length);
    const k = askedFor(params);
    const nmf = isNmf(params);
    if (shown === 0) {
      return [
        { label: nmf ? "Signatures to find" : "Components to keep", value: String(k),
          note: `the data was built from ${params.programmes} patterns` },
        { label: "Solved", value: "not yet", note: "press Solve" },
      ];
    }
    const snap = state.snaps[shown - 1];
    const kept = GENES * k + k * SAMPLES;
    const full = GENES * SAMPLES;
    const tiles = [
      /* THE REDUCTION, AS A COUNT. Round 1: nothing on screen said what
         "reduce dimensions" buys, and the honest answer is how many numbers you
         keep. V is 288; the two factors are 36 per column. */
      { label: "Numbers kept", value: `${kept}`,
        note: `of ${full} — ${Math.round((100 * kept) / full)}% of the matrix` },
      { label: "Unexplained", value: fmt(100 * state.unexplained, 1) + "%",
        note: nmf ? "of V, after W × H" : "of V, after the mean and L × S" },
      { label: "Match to the real patterns", value: fmt(state.toTruth, 3),
        note: k < params.programmes
          ? `only ${k} asked for, so each is a blend`
          : "worst of the matched columns" },
    ];
    tiles.push(nmf
      ? {
        label: "Agreement between starts",
        value: fmt(state.betweenStarts, 3),
        note: k > params.programmes
          ? "asked for more signatures than are there"
          : "1.000 would be the same answer twice",
      }
      : {
        label: "Solved in",
        value: "1 step",
        /* SCHEDULE's last entry, not `snap.iter` — on this tab `snap` is the PCA
           snapshot and its own counter is 1, so the note read "NMF took 1
           updates": false, and ungrammatical in a way that made it obvious only
           once someone read it. The sweep cannot catch a wrong-but-finite
           number, which is why the readout gets read on every round. */
        note: `one eigendecomposition — NMF needs ${SCHEDULE[SCHEDULE.length - 1]}`,
      });
    return tiles;
  },
});

/* ============================================================== the two views */

/* --- 1. the decomposition -------------------------------------------------- */
function drawDecomposition(ctx, colors, w, h, params, state, snap, shown) {
  const nmf = isNmf(params);
  const k = askedFor(params);
  /* Rows taller than columns are wide: 24 genes have to fill the panel while 12
     samples must not run into the second matrix. */
  const ch = 13, cw = 11;
  const top = 44;
  const vh = GENES * ch;
  const x0 = 52;

  /* Rotated up the left edge. Written horizontally it started at x0 - 8 and ran
     straight through the label centred over the same block — the two painted
     "MeasuremeVts". */
  ctx.save();
  ctx.translate(x0 - 14, top + vh / 2);
  ctx.rotate(-Math.PI / 2);
  text(ctx, "Measurements", 0, 0, colors.ink3, "center");
  ctx.restore();

  /* The left matrix is what the method actually factorises: V for NMF, the
     centred matrix for PCA. Labelling both "V" would hide that PCA subtracts
     the mean before it starts. */
  const left = nmf ? state.V : state.Z;
  drawHeat(ctx, colors, left, x0, top, cw, ch, nmf ? state.vMax : null, !nmf);
  text(ctx, nmf ? "V" : "V − mean", x0 + (SAMPLES * cw) / 2, top - 12, colors.ink1, "center");
  text(ctx, "Samples", x0 + (SAMPLES * cw) / 2, top + vh + 16, colors.ink2, "center");

  const xW = x0 + SAMPLES * cw + 30;
  text(ctx, "≈", xW - 15, top + vh / 2, colors.ink2, "center");

  if (!snap) {
    text(ctx, "Not factorised yet.", xW, top + vh / 2 - 6, colors.ink2);
    text(ctx, nmf
      ? "Press Solve to run the multiplicative updates."
      : "Press Solve to run the eigendecomposition.", xW, top + vh / 2 + 10, colors.ink3);
    drawTruthRules(ctx, colors, params, state, x0, top, cw, ch);
    return;
  }

  drawHeat(ctx, colors, snap.W, xW, top, cw, ch, null, !nmf);
  text(ctx, nmf ? "W" : "L", xW + (k * cw) / 2, top - 12, colors.ink1, "center");
  text(ctx, nmf ? "Signatures" : "Components", xW + (k * cw) / 2, top + vh + 16, colors.ink2, "center");

  const xH = xW + k * cw + 30;
  text(ctx, "×", xH - 15, top + vh / 2, colors.ink2, "center");
  drawHeat(ctx, colors, snap.H, xH, top, cw, ch, null, !nmf);
  text(ctx, nmf ? "H" : "S", xH + (SAMPLES * cw) / 2, top - 12, colors.ink1, "center");
  text(ctx, "Samples", xH + (SAMPLES * cw) / 2, top - 25, colors.ink3, "center");
  text(ctx, nmf ? "Signatures" : "Components", xH + SAMPLES * cw + 8, top + ch * k, colors.ink2);

  drawTruthRules(ctx, colors, params, state, x0, top, cw, ch);
  drawTruthRules(ctx, colors, params, state, xW, top, cw, ch, k * cw);

  /* A heatmap column a few pixels wide cannot be read, so the factors are drawn
     again as one bar per gene. This is where "each signature is mostly one
     block" is visible. */
  const bx = xH + SAMPLES * cw + 52;
  const bw = w - bx - 16;
  if (bw > 120) {
    const LABEL_H = 13, gap = 10;
    const stripH = Math.max(14, (vh - k * (LABEL_H + gap)) / k);
    const each = bw / GENES;
    text(ctx, nmf ? "the signatures, one bar per gene" : "the components, one bar per gene",
      bx, top - 12, colors.ink2);

    for (let q = 0; q < k; q += 1) {
      const yLabel = top + q * (stripH + LABEL_H + gap) + LABEL_H;
      const vals = col(snap.W, q);
      const mx = Math.max(...vals.map(Math.abs)) || 1;
      /* signed bars need their baseline in the middle of the strip */
      const base = nmf ? yLabel + 2 + stripH : yLabel + 2 + stripH / 2;
      const reach = nmf ? stripH : stripH / 2;

      text(ctx, `${nmf ? "signature" : "component"} ${q + 1}`, bx, yLabel - 3, colors.ink2);

      /* Ink, not a cluster hue: this panel already spends colour on the value
         ramp beside it, and --c-cluster-a IS --c-value-low. */
      ctx.fillStyle = colors.ink2;
      for (let g = 0; g < GENES; g += 1) {
        const bh = (vals[g] / mx) * reach;
        ctx.fillRect(bx + g * each + 0.5, base - Math.max(0, bh), Math.max(1, each - 1.5), Math.abs(bh));
      }
      ctx.save();
      ctx.strokeStyle = colors.grid;
      ctx.beginPath();
      ctx.moveTo(bx, Math.round(base) + 0.5);
      ctx.lineTo(bx + bw, Math.round(base) + 0.5);
      ctx.stroke();

      ctx.strokeStyle = colors.reference;
      ctx.setLineDash([2, 3]);
      for (let b = state.block; b < GENES; b += state.block) {
        if (Math.floor(b / state.block) > params.programmes) break;
        ctx.beginPath();
        ctx.moveTo(bx + b * each, base - reach);
        ctx.lineTo(bx + b * each, base + (nmf ? 0 : reach));
        ctx.stroke();
      }
      ctx.restore();
    }

    /* SHORT, because `bx` moves right as k grows: at k = 6 this note starts at
       494px, leaving about 43 characters on a 770px stage. */
    const note = nmf
      ? (k > params.programmes
        ? "more than the data holds — move the start"
        : "NMF returns these unranked; the order is ours")
      : "ordered by variance; bars may cross zero";
    text(ctx, note, bx, top + vh + 16, colors.ink3);
  }

  if (nmf && shown < state.snaps.length) {
    text(ctx, `update ${snap.iter} of ${SCHEDULE[SCHEDULE.length - 1]}`,
      x0, top + vh + 34, colors.ink3);
  }
}

/* Where one real pattern's block of genes ends and the next begins.

   DRAWN IN THE MARGIN, NOT ACROSS THE CELLS: a one-pixel --c-reference hairline
   over a saturated heatmap is invisible. A tick in the gutter is legible
   whatever the cells are doing, and the seam drawn in the surface colour
   separates the blocks without adding a colour. */
function drawTruthRules(ctx, colors, params, state, x0, top, cw, ch, width) {
  const wide = width ?? SAMPLES * cw;
  ctx.save();
  for (let b = state.block; b < GENES; b += state.block) {
    if (Math.floor(b / state.block) > params.programmes) break;
    const y = Math.round(top + b * ch) + 0.5;
    ctx.strokeStyle = colors.surface;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + wide, y);
    ctx.stroke();
    ctx.strokeStyle = colors.reference;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0 - 9, y);
    ctx.lineTo(x0 - 1, y);
    ctx.stroke();
  }
  ctx.restore();
}

/* --- 2. the geometry -------------------------------------------------------
   The same three gene-axes on both tabs. NMF's factors are rays out of the
   ORIGIN and every sample is a non-negative mix of them, so the cloud lies in
   the cone they span. PCA's are directions through the MIDDLE of the cloud, and
   a sample's coordinates along them carry signs. */
function drawGeometry(ctx, colors, w, h, params, state, snap) {
  const nmf = isNmf(params);
  const k = askedFor(params);

  /* The basis vectors are unit length ON SCREEN so all three axes draw the same
     length: un-normalised, the shortest axis put its label on top of whatever
     pointed along it. */
  const ax = [[0.92, 0.38], [0.66, -0.30], [0, -1]]
    .map(([u, v]) => { const n = Math.hypot(u, v); return [u / n, v / n]; });
  const O = [120, h - 96];
  const SCL = Math.min(h - 190, (w - 336) / 2);
  const P = (v) => [
    O[0] + SCL * (v[0] * ax[0][0] + v[1] * ax[1][0] + v[2] * ax[2][0]),
    O[1] + SCL * (v[0] * ax[0][1] + v[1] * ax[1][1] + v[2] * ax[2][1]),
  ];

  const gi = [0, state.block, Math.min(GENES - 1, 2 * state.block)];
  const raw = Array.from({ length: SAMPLES }, (_, j) => gi.map((g) => state.V[g][j]));
  const mx = Math.max(...raw.flat()) || 1;
  const pts = raw.map((v) => v.map((t) => t / mx));
  const centre = [0, 1, 2].map((d) => pts.reduce((s, p) => s + p[d], 0) / SAMPLES);

  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  for (const a of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
    const s = P([0, 0, 0]), e = P(a);
    ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(e[0], e[1]); ctx.stroke();
  }
  ctx.restore();
  text(ctx, `Gene ${gi[0] + 1}`, ...P([1.13, 0, 0]), colors.ink3);
  text(ctx, `Gene ${gi[1] + 1}`, ...P([0, 1.13, 0]), colors.ink3);
  text(ctx, `Gene ${gi[2] + 1}`, ...P([0, 0, 1.08]), colors.ink3);

  if (snap) {
    const dirs = [];
    for (let q = 0; q < k; q += 1) {
      const v = gi.map((g) => snap.W[g][q]);
      const n = Math.hypot(...v) || 1;
      dirs.push(v.map((t) => t / n));
    }

    if (nmf) {
      /* THE RAYS RUN PAST THE DATA. A cone is unbounded but the drawn wedge is
         a triangle, and at a fixed length it stopped short of the furthest
         samples — three sat outside a region the caption said nothing could sit
         outside. The length is taken from the data instead. */
      const reach = Math.max(1, ...pts.map((v) => Math.hypot(...v))) * 1.12;
      const rays = dirs.map((d) => d.map((t) => t * reach));
      /* The wedge only exists as a flat region when there are two signatures.
         With three or more the cone is a solid and a filled triangle would be a
         lie about which mixes are reachable, so it is not drawn. */
      if (k === 2) {
        const o = P([0, 0, 0]), a = P(rays[0]), b = P(rays[1]);
        ctx.save();
        ctx.globalAlpha = 0.13;
        ctx.fillStyle = colors.highlight;
        ctx.beginPath();
        ctx.moveTo(o[0], o[1]); ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = colors.highlight;
      rays.forEach((d, q) => {
        const s = P([0, 0, 0]), e = P(d);
        ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(e[0], e[1]); ctx.stroke();
        const mid = P(d.map((t) => t * 0.55));
        text(ctx, `signature ${q + 1}`, mid[0] + 6, mid[1] + 12, colors.highlight);
      });
      ctx.restore();
    } else {
      /* Directions THROUGH THE CENTROID, drawn double-headed because an
         eigenvector has no sign. */
      const span = Math.max(...pts.map((v) =>
        Math.hypot(...[0, 1, 2].map((d) => v[d] - centre[d])))) * 1.25;
      if (k === 2) {
        const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([a, b]) =>
          P([0, 1, 2].map((d) => centre[d] + span * (a * dirs[0][d] + b * dirs[1][d]))));
        ctx.save();
        ctx.globalAlpha = 0.13;
        ctx.fillStyle = colors.highlight;
        ctx.beginPath();
        corners.forEach((c, i) => (i ? ctx.lineTo(c[0], c[1]) : ctx.moveTo(c[0], c[1])));
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = colors.highlight;
      dirs.forEach((d, q) => {
        const a = P([0, 1, 2].map((x) => centre[x] - span * d[x]));
        const b = P([0, 1, 2].map((x) => centre[x] + span * d[x]));
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
        text(ctx, `PC${q + 1}`, b[0] + 6, b[1] + 12, colors.highlight);
      });
      ctx.restore();
      const c = P(centre);
      ctx.save();
      ctx.strokeStyle = colors.reference;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(c[0], c[1], 5, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      text(ctx, "the mean", c[0] + 8, c[1] - 6, colors.reference);
    }
  }

  pts.forEach((v, j) => {
    const p = P(v);
    ctx.fillStyle = state.label[j] === 0 ? colors.groupA : colors.groupB;
    ctx.beginPath(); ctx.arc(p[0], p[1], 3.4, 0, Math.PI * 2); ctx.fill();
  });

  /* The caption column starts here, and the width it leaves decides how long a
     line may be: at w - 300 the longest ran to 794px on a 770px stage. */
  const cx = w - 336;
  let lines;
  if (!snap) {
    lines = [
      "Three of the genes, as three axes.",
      "",
      "Press Solve to factorise, and see what",
      "this method puts in the space.",
    ];
  } else if (nmf) {
    lines = [
      "Each signature is a ray out of the origin,",
      "and every sample is rebuilt as a non-negative",
      "mix of them — so every rebuilt sample lies in",
      "the cone they span.",
      "",
      "The measured samples sit NEAR it. How far a dot",
      "falls outside is the part of it W × H could not",
      "explain, which is the residual in the readout.",
      "",
      "Nothing may be subtracted, so the origin is",
      "where everything starts.",
    ];
  } else {
    lines = [
      "PCA subtracts the mean first, then finds",
      "directions through the MIDDLE of the cloud.",
      "",
      "A sample's coordinate along one is how far it",
      "sits from the mean, and which side — so it",
      "carries a sign. That is the freedom NMF gives",
      "up, and the reason its factors are rays out of",
      "the origin instead of axes through the middle.",
      "",
      "The directions are drawn double-headed because",
      "an eigenvector has no sign of its own.",
    ];
  }
  lines.forEach((s, i) => text(ctx, s, cx, 36 + i * 15, i < 3 ? colors.ink2 : colors.ink3));

  if (snap && k > 2) {
    text(ctx, nmf
      ? `${k} signatures span a solid cone — no flat wedge.`
      : `${k} components span a volume — no flat plane.`,
    cx, 36 + lines.length * 15 + 10, colors.ink3);
  }
}
