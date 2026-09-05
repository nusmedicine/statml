/* ============================================================================
   Widget 44 · Experimental Design — PHM5003 HTD `05 / 01`.

   The misconception: that a confounder is something the analysis fixes. Every
   widget in the collection until now is downstream of the data — 26 adjusts,
   40 corrects, 32 fits the right model. This one is upstream: the reader
   ALLOCATES, and then pays for it.

   ---------------------------------------------------------------------------
   SHAPE B, picked from three drawn at the real width in `_lab/design-shape.html`:
   one study on top, and the pile of studies it came from below. A was the
   notebook's own view and cannot show a rate; C showed all three schemes'
   piles at once and had no study a reader could check against one they ran.

   ONE COLOUR RULE, and it is the rule widget 42 earned: colour is the
   confounder, position is the arm. Never both. So the two arms are two rows
   and two stacked histograms, and the argument is the colour mix inside each
   row — solid under Convenience, half and half under Block.

   ---------------------------------------------------------------------------
   MEASURED against this engine, `_lab/design-measure.mjs`. No true effect, the
   notebook's own population, 4000 draws. A p under 0.05 here is a wrong answer:

       n/arm | convenience | randomized | blocked | mean |imbalance| (random)
           4 |       62.1% |       4.8% |    0.4% |  1.09 of 4   (worst 4)
          10 |       98.9% |       5.2% |    0.4% |  1.78 of 10  (worst 8)
          20 |      100.0% |       5.1% |    0.5% |  2.51 of 20  (worst 13)
          24 |      100.0% |       5.1% |    0.7% |  2.74 of 24  (worst 13)

   Three things came out of that table and all three are the widget:

   1. RANDOMIZATION DOES NOT BALANCE. At twenty per arm it leaves 2.5 subjects
      out of balance on average and the worst draw of 4000 was 13 of 20. It
      holds 5% anyway, at every n, because the t-test prices its own imbalance
      into its own SD. The notebook's "with a sufficiently large sample size,
      randomization will balance these variables" is not where the protection
      comes from — and the figure shows exactly that: the sample's carrier
      fraction wanders while the population's stays put.
   2. THE ESTIMATE UNDER CONVENIENCE *IS* THE CONFOUNDER. Mean estimated
      disease effect 1.000 against a planted 1.000, at every n, and the pile
      never crosses zero. No seed rescues it.
   3. BLOCK IS CONSERVATIVE, not merely better: 0.5% where 5% is nominal, and
      its estimates are 30% tighter (spread 0.145 against randomization's
      0.207 at n = 24) while the unadjusted test still sizes itself off the
      full confounder variance. The power that buys back is a MODEL question
      and this widget does not claim it — see the open call at the foot.

   ---------------------------------------------------------------------------
   THE REPLICATE TAB is the notebook's §3 and §4 on one surface, because they
   are two directions on one budget. Measured over 3000 draws:

       false positives (nominal 5%)     power at a true effect of 0.5
       people\reps  x1    x2    x3   x10      x1    x2    x3   x10
             3    3.4% 10.9% 20.0% 43.5%    7.6% 26.5% 38.7% 68.7%
            10    4.7% 10.8% 16.6% 40.9%   31.2% 58.1% 70.6% 91.3%
            30    5.3% 11.2% 17.4% 40.5%   76.5% 93.3% 97.2% 99.8%

   The x10 column is FLAT — 43.5%, 40.9%, 40.5%. Ten times the people does not
   touch it, which is why this tab needs two dials and not one.

   AND WHY IT IS NOT WIDGET 32. That widget holds the data fixed and changes
   the model, lm against lmer. This one holds the BUDGET fixed and changes the
   design: at 30 measurements per arm the row test's power barely moves,
   76.5% to 68.7%, while the honest power collapses from 76.5% to 11.4%. The
   power the rows showed was never there.

   THE NOTEBOOK'S OWN §4 CONCLUSION IS ONE DRAW. Cell 85 reads that with
   pseudoreplicates "we no longer detect any significant differences"; over
   3000 draws of that exact setup it is significant 68.7% of the time, and
   4.8% of those have the sign backwards. `set.seed(123)` drew three people who
   happened to sit together. The widget reports the rate and makes no claim
   about any single study, which is the only honest way to disagree with a
   printed cell.
   ========================================================================= */

import {
  defineWidget, makePlot, createPile, makeRng, mean, fmt, niceTicks,
} from "../core/index.js";
import {
  runStudies, MAX_STUDIES, NOISE_SD, CONF_SHIFT, BASE, POP_PER_ARM, POP_ROWS, POP_COLS,
} from "./model.js";

/* the confounder decides what the three schemes MEAN, which is why it is a
   parameter and not a relabel: sex you can only sample, batch you assign */
const CONF = {
  sex: {
    name: "Sex", carrier: "Female", plain: "Male", low: "sex",
    detail: "you cannot assign it — you can only sample or block",
  },
  batch: {
    name: "Batch", carrier: "Batch 2", plain: "Batch 1", low: "batch",
    detail: "you assign it, so all three sampling methods are open to you",
  },
};

/* The notebook's own headings: "Non-random sampling", "Random sampling",
   "Blocking". Kenneth's call over "Convenience" and "Stratified". */
const SCHEMES = {
  nonrandom: "Non-random",
  random: "Random",
  blocked: "Blocked",
};

/* the effect ladder: none is where every p is a false positive, and 0.5 is the
   notebook's own disease bump in its cell 64 */
const EFFECTS = { none: 0, small: 0.25, moderate: 0.5, large: 1 };

/* THE CONFOUNDER'S SIZE IS A SIGNED DIAL, and both ends earn their place.

   `nothing` is why it exists: with no confounder all three allocations read the
   same rate — 4.6 / 5.0 / 4.8 at n = 20, `_lab/design-measure.mjs` §9 — which is
   the cleanest statement there is that the allocation is protecting against this
   and nothing else. 1.00 is the notebook's own female bump.

   THE NEGATIVE HALF IS NOT SYMMETRY FOR ITS OWN SAKE. A confounder that pushes
   the other way MASKS a real effect instead of inventing one, and at
   effect 0.50 with the confounder at -1.00 a Convenience study reports -0.50:
   the disease raises the measurement and the study concludes it lowers it. A
   dial that only goes up can only ever teach the false-positive half. */
const SHIFTS = { "-2": -2, "-1": -1, "0": 0, "1": 1, "2": 2 };

/* THE ASSAY'S OWN SPREAD, AGAINST THE 0.50 THE PEOPLE VARY BY.

   It was welded to the population's spread, which fixed the intraclass
   correlation at 0.50 — the one setting where a person's repeats scatter
   EXACTLY as widely as the people do. That is a strange place to pin a widget
   about telling the two apart, and it is not where the harm lives either.
   `design-measure` §13, at 10 people x 3 with nothing to find: the row test
   calls it significant 9.4% of the time at 1.00, 16.8% at 0.50, 24.3% at 0.25
   and 26.8% at 0.15. THE PRECISE ASSAY IS THE DANGEROUS ONE, which is the
   opposite of the intuition, and the reason is the design effect: the damage
   is 1 + (reps - 1) * ICC, and a precise assay is a high ICC.

   BOTH ENDS WIN SOMETHING, which is the test a choice has to pass. At 0.15 the
   clusters are tight and lie far apart — the picture pseudoreplication is
   usually drawn as — and repeating is nearly worthless there: holding people
   fixed at ten, ten measurements each take only 4% off the honest estimate's
   spread. At 1.00 the clouds swamp the gaps between people, and the same ten
   repeats take off 47%. Repeating is worth doing exactly where
   pseudoreplicating it would matter least. */
const NOISES = { "0.15": 0.15, "0.25": 0.25, "0.5": 0.5, "1": 1 };

const SPEEDS = {
  slow: { ms: 620, choreo: true },
  medium: { ms: 260, choreo: true },
  fast: { ms: 90, choreo: false },
};
const STEP_MS = 480;

/* THE PILE'S WINDOW IS A CLOSED FORM, and it deliberately does NOT depend on
   the parameter the reader is comparing.

   A window fitted to the studies actually drawn was the first attempt and it
   was worse than the fixed one it replaced: flipping Convenience to Randomize
   moved the AXIS by 1.4 and left the two piles looking alike, when the whole
   argument is that one of them sits on the confounder and the other on zero. A
   frame that moves with the thing under comparison hides the comparison.

   So the frame spans every scheme at the current scale, and moves only with
   the dials that genuinely change the scale — subjects per arm, and the true
   effect. The variance of the estimated difference is exact:

     convenience  every subject in an arm shares one confounder status, so the
     and blocked  confounder contributes nothing to the DIFFERENCE and it is
                  2 sigma^2 / n            -> SD 0.100 at n = 50
     randomize    each arm's carrier count is Binomial(n, 1/2), which adds
                  delta^2 / 2n             -> SD 0.141 at n = 50

   Both match `_lab/design-measure.mjs` §2 to the third decimal (0.101, 0.139).
   THE REPLICATE TAB'S FRAME IS PINNED OUTRIGHT, and for the same reason one
   step further on. Its two dials are BOTH the thing under comparison — the
   question is how one budget is split between them — so neither may move the
   axis. It was computed at the current `people` and that hid the whole point:
   10 people x 1 and 2 people x 5 are the same ten measurements, and the second
   estimate is 1.7 times wider (SD 0.316 against 0.548, and `design-measure`
   §11 confirms the closed form), but the frame grew from +-1.27 to +-2.83 with
   it and the two piles looked alike.

   So it is fixed at the widest the dials allow, 2(sigma^2 + sigma^2/reps)/people
   at reps = 1 and people = PEOPLE_MIN. The cost is real and was measured before
   it was accepted: the bulk of the pile covers 28 of 57 bins at 2 people and 7
   at 30. A 7-bin spike beside a 28-bin smear is the comparison, drawn.

   Four SDs each side: over every setting the widget offers, 0 of 300 studies
   fall outside, verified in `_lab/design-measure.mjs` §7. */
/* The fewest people the dial offers, and therefore the widest the pile can be.
   One constant because the frame is derived from it: a dial that went lower
   than the frame was built for would draw studies outside the axis. */
const PEOPLE_MIN = 2;

const PILE_BINS = 57;
const PILE_SDS = 4;

/* THE MEASURED-VALUE AXIS: A CLOSED FORM, FIXED ACROSS BOTH BUDGET DIALS.

   It was refitted to each study's own minimum and maximum, which cost twice.
   It carries no tick labels, so a reader cannot see a rescale — two studies of
   very different spread drew the same width and read as alike, which is the
   fault the pile's frame had. And a study-to-study tween is not definable on a
   moving axis: bin 3 of one study and bin 3 of the next would be different
   ranges of measurement.

   SPANNING THE 200 STUDIES FIXED THE FIRST FAULT AND LEFT THE SECOND. A min
   and a max over more draws reach further, so the window grew with the dials —
   4.41 units at 2 people x 1 against 6.45 at 30 x 10 — and the tab's whole
   comparison is between two settings of exactly those dials. 10 x 1 and 2 x 5
   were drawn at different scales, which is the same trap one axis down.

   One measurement is N(BASE + effect for the disease arm, sqrt(2) * NOISE_SD),
   so four SDs each side holds everything: over 200 studies of 300 measurements,
   0.0 dots per study fall outside it. It moves only with the true difference,
   which genuinely moves the centre. */
function binsFor(rows) {
  return Math.max(9, Math.min(28, Math.round(rows / 1.6)));
}

/** One arm's measurements binned onto that fixed axis. */
function armCounts(study, g, bins, lo, hi) {
  const counts = new Array(bins).fill(0);
  for (const m of study.arms[g]) {
    counts[Math.min(bins - 1, Math.max(0, Math.floor(((m.y - lo) / (hi - lo)) * bins)))] += 1;
  }
  return counts;
}

function valueWindow(effect, noise) {
  /* one measurement is N(BASE + effect for the disease arm, sqrt(sB^2 + sW^2)) */
  const sd = Math.sqrt(NOISE_SD ** 2 + noise ** 2);
  return { lo: BASE - 4 * sd, hi: BASE + effect + 4 * sd };
}

function pileWindow(params, effect, shift, noise) {
  let centres;
  let sds;
  if (isAllocate(params)) {
    const n = params.n;
    const plain = Math.sqrt((2 * NOISE_SD ** 2) / n);
    const drawn = Math.sqrt((2 * NOISE_SD ** 2) / n + shift ** 2 / (2 * n));
    /* Every scheme's own centre and spread, so the frame holds all three — and
       both scorings, since an adjusted estimate centres on `effect` with a
       spread no wider than `plain` and therefore sits inside a window already
       built for the randomized group. */
    centres = [shift + effect, effect, effect];
    sds = [plain, drawn, plain];
  } else {
    /* PEOPLE_MIN, not params.people — see the header. The frame must not move
       with either budget dial. */
    const widest = Math.sqrt((2 * (NOISE_SD ** 2 + noise ** 2)) / PEOPLE_MIN);
    centres = [effect];
    sds = [widest];
  }
  let lo = Infinity;
  let hi = -Infinity;
  centres.forEach((c, i) => {
    lo = Math.min(lo, c - PILE_SDS * sds[i]);
    hi = Math.max(hi, c + PILE_SDS * sds[i]);
  });
  /* rounded outward to a tenth, so the axis carries readable ticks */
  return { lo: Math.floor(lo * 10) / 10, hi: Math.ceil(hi * 10) / 10 };
}

/* Each arm is ONE horizontal band: label, its population as a grid, an arrow
   carrying the scheme, and the subjects it selected laid out on a value axis.
   That is Kenneth's own slide, with the measurement folded into the right-hand
   half so the sample and what it measured are the same marks rather than two
   pictures of the same twenty people. */
const CELL = 13;                      /* one population subject's grid pitch  */
const GUTTER = 62;                    /* left label gutter, shared by both    */

/* THE TWO BLOCKS GO SIDE BY SIDE, NOT ONE ABOVE THE OTHER.

   Stacking them cost a reserved row plus a gap, 22px that Randomize never uses
   — so the sample strip floored at the bottom of the band while the grid beside
   it stopped 23px short, and the two baselines did not line up. That is the
   misalignment Kenneth drew a red line under.

   Side by side, the grid is ALWAYS POP_ROWS tall whatever the carrier count, so
   the sample can share the grid's bottom row for good. It costs 22px of width
   instead — one extra column, which is the worst case over every carrier count
   from 0 to 96 — and gives back 22px of height per arm: the widget goes from
   500 to 456.

   The blocks are separated by a GAP rather than a rule. A line drawn at the
   block boundary is only true when the count divides evenly, and a coin flip
   gives 51 carriers as often as 48. */
const BLOCK_GAP = 9;
const GRID_COLS_MAX = POP_COLS + 1;   /* ceil(a/8) + ceil((96-a)/8) <= 13 */
const GRID_W = GRID_COLS_MAX * CELL + BLOCK_GAP;
const H_ARM = POP_ROWS * CELL;        /* one arm's band, constant in every state */

/* The two tabs' study bands are different heights and always were: Allocate
   draws two population grids, Replicate two rows of dots. One constant for both
   left the Replicate tab with 44px of nothing under it. */
/* The arms are 34 apart, not 14: the per-block counts live in that gap, and
   they are what tells Convenience from Block (`_lab/design-schemes.html`). */
const ARM_GAP = 16;   /* the bars moved out of here into the header */
/* the header now carries the confounder's whole set-up: two bars for its
   association with the arm, and two marks for what it does to the measurement */
const H_HEAD = 108;
const H_ALLOC = H_HEAD + 2 * H_ARM + ARM_GAP + 44;
/* THE REPLICATE BAND CARRIES THE MEASUREMENTS — candidate B of
   `_lab/design-replicate-band.html`, picked at the real width.

   It used to put a dot at `person index x repeat index` and read no
   measurement at all, so all 200 studies drew a byte-identical picture while
   the tile beside it said each study was a fresh set of people. Value now runs
   UP and each person is a column, so every study relocates every column: a
   person's value moves 0.553 between studies against a between-person SD of
   0.50.

   THE HISTOGRAM MOVED BESIDE IT RATHER THAN UNDER IT. Stacked below, value ran
   up in the band and across in the histogram — the same quantity on two axes,
   one above the other. As a MARGINAL sharing the y-axis it is that picture
   pooled, which is exactly what the row test sees once it forgets which person
   a measurement came from, and it costs width instead of height. The stage
   goes from 268 to 222. */
const B_TOP = 44;                     /* under the beat and the budget line    */
/* ONE ARM'S BAND, AND THE HEIGHT IS THE WHOLE POINT OF IT.

   At 78 the window's ~5.7 units of measurement got 68px, so one SD of spread
   was 5.3px and a person's whole cloud was 11px — Kenneth: "maybe increase
   height so can see spread?". At 140 the same window gets 130px, one SD is
   11.5px and a person's cloud is 23px, which is a spread you can actually read
   against the gap between people.

   140 IS A CEILING, NOT A PREFERENCE. It puts the stage at 354 and the widget
   at 564, which is just under the Sampling tab's 578 — the two tabs already
   have different heights, and this one staying the shorter of the two is what
   stops the tab switch from jumping the page. */
const B_ARM = 140;
const B_GAP = 10;
/* the tail is 20 and not 12: the "Run one study" prompt sits under the second
   band and at 12 its baseline landed on the rule dividing the stage from the pile */
const H_BUDGET = B_TOP + 2 * B_ARM + B_GAP + 20;
const H_PILE = 176;                   /* the studies it came from              */

const isAllocate = (p) => p.topic === "sampling";
const studyH = (p) => (isAllocate(p) ? H_ALLOC : H_BUDGET);
const EASE = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
/* an eased sub-interval of [0, 1] — the whole choreography is built of these */
const phase = (t, a, b) => EASE(clamp01((t - a) / (b - a)));

/* THE CHOREOGRAPHY, settled from `_lab/design-tween.html` where Kenneth picked
   D and G out of seven candidates drawn at the real width.

   G — the partition is its own beat. Blocking IS splitting the population by
   the confounder and then sampling within each part, and the figure used to
   show only the result. Randomize SKIPS this beat, and that absence is the
   difference between it and the other two.

   D — the sample travels as a convoy. The rejected default had every subject
   on its own diagonal: the vertical half of that line carried nothing (a grid
   row is unrelated to a stack row, which is assigned by collision on the value
   axis) and release order was grid order against a landing order that is value
   order, so about half the flights swapped places in mid-air. The convoy holds
   its layout while it moves — so nothing crosses anything — and opens out into
   value order only on arrival, where the spread reads as the measuring. */
/* SHAPE B, which Kenneth moved to after seeing D run: the boxes arrive one at a
   time and the sample then appears where it belongs. No travel at all, so
   nothing can cross anything and no path can slant.

   The subject is still in ONE PLACE at every instant: as the sample fades in on
   the axis, the same subject fades out of its cell, and the dashed box stays
   behind as the empty seat. A crossfade rather than a jump, and the endpoints
   are exactly the grid position and the value position. */
const STEPS = {
  partition: { sort: [0.02, 0.30], rings: [0.30, 0.56], appear: [0.58, 0.92] },
  direct: { sort: null, rings: [0.04, 0.30], appear: [0.34, 0.80] },
};

/* EVERY BEAT SAYS ITS OWN NAME — `_lab/design-parts.html` option L2, picked
   over three panels side by side because those need a 770px stage and the
   narrowest canvas the layout allows has 436px.

   The three parts Kenneth asked for are here in TIME rather than in space: the
   population, the arrangement the scheme wants, and the sample. Randomize has
   one beat fewer, and so does every study after the first under Block, because
   neither of them sorts — and the dot counter shows that rather than hiding it. */
function stepsFor(params, ran, sorts) {
  if (!isAllocate(params)) {
    /* The Replicate tab's own beats: the people, the repeats of each, and the
       measurement. It had none — the header was a static line while the
       Sampling tab named every beat, and the two tabs read as different
       widgets. At one measurement per person there is no repeat beat, and the
       counter shows two dots rather than three. */
    const first = { at: 0, label: `${params.people} people per group` };
    if (params.reps === 1) return [first, { at: 0.34, label: "Measured once each" }];
    return [first,
      { at: 0.28, label: `Measured ${params.reps} times each` },
      { at: 0.56, label: "Measured" }];
  }
  const n = params.n;
  const low = CONF[params.confounder].low;
  const take = params.scheme === "nonrandom"
    ? `${n} sampled from one block`
    : params.scheme === "blocked"
      ? `${Math.round(n / 2)} sampled per block`
      : `${n} sampled at random`;
  const first = { at: 0, label: `Population: ${POP_PER_ARM} per group` };
  if (sorts) {
    return [first,
      { at: 0.30, label: `Blocked by ${low}` },
      { at: 0.56, label: take },
      { at: 0.92, label: "Measured" }];
  }
  return [first, { at: 0.30, label: take }, { at: 0.80, label: "Measured" }];
}

/* Randomize never partitions; nor does any study after the first, whose sort
   already stands — blocking is a property of the DESIGN, decided once. */
const willSort = (params, ran) => params.scheme !== "random" && ran <= 1;
const scoreFor = (params, ran) => (willSort(params, ran) ? STEPS.partition : STEPS.direct);

/* --------------------------------------------------------------------------
   Drawing helpers. Both tabs draw the same three bands — who was measured,
   what was measured, and what every repeat of it said — so the band functions
   take a study and not a tab.
   ----------------------------------------------------------------------- */

function label(ctx, colors, x, y, s, colour, align = "left", size = null, weight = "") {
  ctx.fillStyle = colour;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.font = `${weight} ${size ?? colors.fsXs} ${colors.font}`.trim();
  ctx.fillText(s, x, y);
}

/* ONE MARK, TWO CHANNELS — Kenneth's slide, and it is a better assignment than
   the first build's. COLOUR is the arm (control / disease) and SHAPE is the
   confounder (a triangle carries it, a circle does not). Colour therefore
   carries exactly one grouping, which is widget 42's rule, and both arms can
   share one value axis instead of needing separate stacked histograms.

   The first build had colour on the confounder and position on the arm. It
   obeyed the same rule, but it cost the shared axis and left no channel for
   "was this subject selected" — which is the thing Kenneth could not find. */
function subjectMark(ctx, colors, x, y, s, arm, r, alpha = 1, tint = null) {
  ctx.save();
  ctx.globalAlpha = alpha;
  /* `tint` overrides the arm colour for the two marks that describe the
     POPULATION rather than either arm — the confounder's own levels. */
  const hue = tint ?? (arm ? colors.groupB : colors.groupA);
  ctx.beginPath();
  if (s.carrier) {
    /* a triangle, sized so it reads as the same weight as the circle beside it */
    const h = r * 1.9;
    ctx.moveTo(x, y - h * 0.62);
    ctx.lineTo(x + r * 1.15, y + h * 0.38);
    ctx.lineTo(x - r * 1.15, y + h * 0.38);
    ctx.closePath();
  } else {
    ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  /* FILLED CARRIES IT, HOLLOW DOES NOT — Kenneth's pick from four encodings in
     `_lab/design-tween.html`. The shape says the same thing, but at a 13px
     pitch a triangle and a circle are nearly the same blob, so a second channel
     has to carry it. Fill against outline weighs the two marks equally, where
     the fade it replaced made half the population recede — and half the
     population is not less important than the other half. */
  if (s.carrier) {
    ctx.fillStyle = hue;
    ctx.fill();
  } else {
    ctx.strokeStyle = hue;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  ctx.restore();
}

/** The dashed ring the slide puts round a selected member of the population. */
function selectionRing(ctx, colors, x, y, r, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = colors.ink1;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.strokeRect(Math.round(x - r - 2) + 0.5, Math.round(y - r - 2) + 0.5,
    2 * r + 4, 2 * r + 4);
  ctx.restore();
}

/**
 * One arm's population as a grid, with the study's selection ringed.
 * Non-carriers are drawn paler than carriers — redundant with the shape, which
 * is what makes the mix readable at a 9px pitch where a triangle and a circle
 * are nearly the same blob.
 */
const rowsFor = (k) => Math.ceil(k / POP_COLS);

/**
 * Where a subject sits once the population has been sorted into its two blocks:
 * carriers fill whole COLUMNS from the left, the non-carriers start a fresh
 * column after a gap, and the empty space between them IS the partition.
 *
 * Columns rather than rows so the grid keeps its POP_ROWS height in every
 * state — which is what lets the sample beside it share the grid's bottom row.
 */
function blockedCell(pop, i, { x, y }) {
  const carriers = [];
  const plain = [];
  pop.forEach((s, k) => (s.carrier ? carriers : plain).push(k));
  const seat = (rank, xOffset) => [
    x + xOffset + (Math.floor(rank / POP_ROWS) + 0.5) * CELL,
    y + ((rank % POP_ROWS) + 0.5) * CELL,
  ];
  const inC = carriers.indexOf(i);
  if (inC >= 0) return seat(inC, 0);
  const after = Math.ceil(carriers.length / POP_ROWS) * CELL + BLOCK_GAP;
  return seat(plain.indexOf(i), after);
}

/** Where a population member sits, `sort` of the way into its block. */
function seatOf(pop, i, at, sort) {
  const s = pop[i];
  const x0 = at.x + (s.col + 0.5) * CELL;
  const y0 = at.y + (s.row + 0.5) * CELL;
  if (!sort) return [x0, y0];
  const [x1, y1] = blockedCell(pop, i, at);
  return [x0 + (x1 - x0) * sort, y0 + (y1 - y0) * sort];
}

/**
 * The population, minus whoever this study took.
 *
 * A SUBJECT IS IN ONE PLACE. The first build left a full-opacity copy in the
 * grid and drew a second copy flying to the axis, so twenty people appeared to
 * become forty — Kenneth's review asked for them to be removed rather than
 * dimmed, and he is right that a duplicate is not a dimming problem. The
 * selected members are drawn by the convoy instead, from the same `seatOf`, so
 * before the flight starts they sit exactly where the grid would have put them
 * and nothing appears to move at all.
 *
 * The dashed box stays behind as the EMPTY SEAT: it is the only mark that says
 * where the sample came out of, and it is why the ring is drawn here and not
 * with the travelling subject.
 */
function drawPopulation(ctx, colors, at, study, g, sort, ringAt, leaving) {
  const pop = study.population[g];
  const r = CELL * 0.36;
  pop.forEach((s, i) => {
    const [cx, cy] = seatOf(pop, i, at, sort);
    const a = ringAt(i);
    if (a > 0) selectionRing(ctx, colors, cx, cy, r, a);
    /* a subject the study has taken fades out of its cell as the same subject
       fades in on the axis, so it is never in two places and never in none */
    const alpha = leaving(i);
    if (alpha > 0) subjectMark(ctx, colors, cx, cy, s, g, r, alpha);
  });
}

/**
 * The selected subjects on a value axis, stacked where they collide so twenty
 * of them at one value read as twenty rather than as one.
 */
/**
 * The selected subjects on a value axis, stacked where they collide.
 *
 * IT CANNOT GROW OUT OF ITS BAND. Twenty subjects on a 209px axis stacked ten
 * deep and the top of the pile pushed into the header's text — the sweep found
 * it only once it started asking whether text sat on a MARK. So the packing
 * allows a little overlap horizontally (1.5r rather than 2r, which reads as
 * density) and the row wraps at `maxRows`, which the caller sizes from the band.
 */
function stackRows(values, lo, hi, w, r, maxRows = 99) {
  const slots = [];
  return values.map((v) => {
    const px = ((v - lo) / (hi - lo)) * w;
    let row = 0;
    while (slots[row] !== undefined && px - slots[row] < 1.5 * r) row += 1;
    slots[row] = px;
    return { px, row: row % maxRows };
  });
}


/**
 * One arm's people as columns: x is the person, y is what they measured.
 *
 * `toValue` is where a dot sits between two truths. At 0 it stands at an evenly
 * spaced schematic position, which is where a measurement lives before it has
 * been taken — obviously regular, so the count reads while no value exists. At
 * 1 it stands at its measurement. The first study eases from one to the other,
 * and that is the ONLY tween in this widget asserting a true correspondence:
 * dot j of person p really does become measurement j of person p.
 */
function drawColumns(ctx, colors, geo, st, { alpha, toValue = 1 }) {
  if (alpha <= 0.01) return;
  const { x0, cell, yAt, top, r, arm } = geo;
  const people = st.subjects[arm].length;
  const reps = st.subjects[arm][0].rows.length;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = arm ? colors.groupB : colors.groupA;
  for (let p = 0; p < people; p += 1) {
    const cx = x0 + (p + 0.5) * cell;
    const rows = st.subjects[arm][p].rows;
    rows.forEach((v, j) => {
      const schematic = top + B_ARM * ((j + 1) / (reps + 1));
      const y = schematic + (yAt(v) - schematic) * toValue;
      ctx.beginPath();
      ctx.arc(cx, y, r, 0, Math.PI * 2);
      ctx.fill();
    });
    /* THE MARK THAT TEACHES, and it is not the cloud. In this population a
       person's repeats are exactly as wide as the gap between people — both
       SDs are 0.50, so the intraclass correlation is 0.50 by construction and
       "tight clusters, far apart" would be a lie. What repeating actually does
       is PIN this tick: its spread falls 0.500 / 0.289 / 0.158 at 1, 3 and 10
       measurements, while the people stay 0.50 apart however long you measure
       them. That is why no amount of repeating rescues the honest test. */
    if (toValue > 0.01) {
      const m = mean(rows);
      ctx.save();
      /* it fades in WITH the slide rather than appearing at the halfway mark:
         at rest there is no measurement, so there is no mean to draw */
      ctx.globalAlpha = alpha * toValue;
      ctx.strokeStyle = colors.ink1;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      const half = Math.min(9, cell * 0.34);
      ctx.moveTo(cx - half, yAt(m));
      ctx.lineTo(cx + half, yAt(m));
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

/**
 * The same measurements pooled, on the same axis — the row test's own view,
 * which is the whole reason it sits beside the columns rather than replacing
 * them. Bars run outward from the columns' right edge.
 */
function drawMarginal(ctx, colors, geo, counts, peak) {
  const { mx, mw, yAt, lo, hi, arm } = geo;
  const step = (hi - lo) / counts.length;
  ctx.save();
  ctx.fillStyle = arm ? colors.groupB : colors.groupA;
  ctx.globalAlpha = 0.6;
  counts.forEach((k, i) => {
    if (k <= 0) return;
    const yTop = yAt(lo + (i + 1) * step);
    const yBot = yAt(lo + i * step);
    ctx.fillRect(mx, yTop, Math.max(1, (k / peak) * mw), Math.max(1, yBot - yTop - 1));
  });
  ctx.restore();
}

/** The notebook's own `tbl_summary(by = group)`, and the imbalance it implies. */
function drawTable(ctx, colors, { x, y }, study, conf) {
  const n = study.arms[0].length;
  const col = 58;
  const rowH = 16;
  label(ctx, colors, x, y, "Control", colors.ink3, "center");
  label(ctx, colors, x + col, y, "Disease", colors.ink3, "center");
  [[conf.carrier, study.carried, colors.groupB],
    [conf.plain, study.carried.map((v) => n - v), colors.groupA]]
    .forEach(([name, vals, tint], i) => {
      const cy = y + rowH * (i + 1);
      label(ctx, colors, x - 34, cy, name, tint, "right");
      vals.forEach((v, g) => label(ctx, colors, x + col * g, cy, String(v),
        colors.ink1, "center", colors.fsSm, "600"));
    });
  const cy = y + rowH * 3;
  label(ctx, colors, x - 34, cy, "imbalance", colors.ink3, "right");
  label(ctx, colors, x + col / 2, cy, `${study.imbalance} of ${n}`,
    study.imbalance === 0 ? colors.ink2 : colors.extreme, "center", colors.fsSm, "600");
}

/* --------------------------------------------------------------------------
   The widget
   ----------------------------------------------------------------------- */

defineWidget({
  slug: "experimental-design",
  title: "Experimental Design",
  subtitle:
    "Experimental design comes before the data and improves the validity of the conclusions. "
    + "Randomization and blocking control confounders; replication counts experimental units "
    + "rather than repeated measurements.",

  layout: "side",
  height: (params) => studyH(params) + H_PILE + (isAllocate(params) ? 26 : 34),

  params: {
    lesson: { type: "section", label: "The question" },

    /* THE VALUES IN THE URL ARE THE WORDS ON THE CONTROL, or the numbers its
       ticks show. They were `concept=allocate` and `topic=replication`, and
       neither word appears anywhere a reader can see — Kenneth: "can you not
       use stupid terms like budget? it was replication right? make sure URL do
       not contain self-invented terms". A shared link is reader-facing copy
       and answers to principle 5.9 like every other string. */
    topic: {
      type: "segmented",
      label: "Topic",
      options: [
        { value: "sampling", label: "Sampling", detail: "one background variable, three sampling methods" },
        { value: "replication", label: "Replication", detail: "people against repeats of the same person" },
      ],
      default: "sampling",
    },

    /* NOT "The confounder". A confounder is a variable associated with BOTH
       the group and the measurement, and the dial below can switch the second
       association off — so the control was asserting something the reader had
       just removed. Kenneth: "if you put no effect on measurement, that means
       it's not a confounder?" It does, and the widget now says so on the figure
       instead of naming it in the rail. */
    design: { type: "section", label: "The study" },

    confounder: {
      type: "segmented",
      label: "Background variable",
      options: Object.entries(CONF).map(([value, c]) => ({
        value, label: c.name, detail: c.detail,
      })),
      default: "sex",
      when: { param: "topic", equals: "sampling" },
    },

    scheme: {
      type: "segmented",
      label: "Sampling method",
      options: [
        { value: "nonrandom", label: "Non-random", detail: "the two groups differ completely in the background variable" },
        { value: "random", label: "Random", detail: "a coin flip for each subject, whatever it lands on" },
        { value: "blocked", label: "Blocked", detail: "equal numbers from each level of the background variable" },
      ],
      default: "random",
      when: { param: "topic", equals: "sampling" },
    },

    n: {
      type: "int",
      label: "Sample size per group",
      /* capped at 24 of the 96 available: at 30, one draw in 12,000 runs out
         of carriers in a coin-flip population and the study would quietly be
         smaller than the reader asked for. At 24 and below, none do. */
      detail: `sampled from ${POP_PER_ARM} per group`,
      min: 4, max: 24, step: 2, default: 20,
      when: { param: "topic", equals: "sampling" },
    },

    people: {
      type: "int",
      label: "People per group",
      detail: "each one is a fresh draw from the population",
      min: PEOPLE_MIN, max: 30, default: 10,
      when: { param: "topic", equals: "replication" },
    },

    reps: {
      type: "int",
      label: "Measurements per person",
      detail: "the same person, measured again",
      min: 1, max: 10, default: 1,
      when: { param: "topic", equals: "replication" },
    },

    noise: {
      type: "choice",
      label: "Noise in one measurement",
      options: [
        { value: "0.15", label: "0.15", detail: "well under the spread between people — a person's repeats land close together" },
        { value: "0.25", label: "0.25", detail: "half the spread between people" },
        { value: "0.5", label: "0.50", detail: "the same as the spread between people" },
        { value: "1", label: "1.00", detail: "twice it — the assay varies more than the biology does" },
      ],
      default: "0.5",
      when: { param: "topic", equals: "replication" },
    },

    shift: {
      type: "choice",
      label: "Effect on the measurement",
      options: [
        { value: "-2", label: "−2.00", detail: "enough to reverse the sign of the answer" },
        { value: "-1", label: "−1.00", detail: "can mask a real group difference" },
        { value: "0", label: "nothing", detail: "with no effect, every sampling method agrees" },
        { value: "1", label: "1.00", detail: "twice the population's spread" },
        { value: "2", label: "2.00", detail: "larger than any group difference on offer" },
      ],
      default: "1",
      when: { param: "topic", equals: "sampling" },
    },

    effect: {
      type: "choice",
      label: "True group difference (Disease − Control)",
      options: [
        { value: "none", label: "none", detail: "so every p under 0.05 is a wrong answer" },
        { value: "small", label: "0.25", detail: "half the population's spread" },
        { value: "moderate", label: "0.50", detail: "the same size as the population's spread" },
        { value: "large", label: "1.00", detail: "twice the population's spread" },
      ],
      default: "none",
    },

    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },

    look: { type: "section", label: "How to look at it", afterDrive: true },

    speed: {
      type: "choice",
      label: "Play speed",
      options: [
        { value: "slow", label: "Slow" },
        { value: "medium", label: "Medium" },
        { value: "fast", label: "Fast", detail: "studies arrive without being drawn one at a time" },
      ],
      default: "medium",
      display: true,
      afterDrive: true,
    },

    smooth: {
      type: "bool",
      label: "Smoothed shape",
      default: false,
      display: true,
      afterDrive: true,
    },

    shown: { type: "int", min: 0, max: MAX_STUDIES, default: 0, hidden: true },
  },

  /* the legend has to match the graph: the Replicate tab has no confounder in
     it, so it must not print one */
  legend: ({ params }) => {
    const base = [
      { token: "empirical", label: "one study's estimated group difference", mark: "bar" },
      { token: "extreme", label: "significant at p < 0.05", mark: "bar" },
      /* NOT "no difference between the arms". The rule is drawn at the TRUE
         difference, so that label was false in every state with an effect set —
         it named zero while the line stood at 0.50. */
      { token: "reference", label: "true group difference", mark: "dash" },
    ];
    if (!isAllocate(params)) {
      return [{ token: "group-a", label: "one measurement, Control", mark: "dot" },
        { token: "group-b", label: "one measurement, Disease", mark: "dot" },
        { token: "ink-1", label: "one person's mean — each column is one person", mark: "line" },
        { token: "group-a", label: "Control's mean", mark: "dash" },
        { token: "group-b", label: "Disease's mean", mark: "dash" },
        ...base];
    }
    const c = CONF[params.confounder];
    return [
      { token: "group-a", label: "Control", mark: "dot" },
      { token: "group-b", label: "Disease", mark: "dot" },
      { token: "ink-2", label: `${c.carrier} (filled)`, mark: "tri" },
      { token: "ink-2", label: `${c.plain} (open)`, mark: "hollow" },
      { token: "ink-1", label: "sampled", mark: "ring" },
      ...base,
    ];
  },

  compute: ({ params }) => {
    const effect = EFFECTS[params.effect] ?? 0;
    const shift = SHIFTS[params.shift] ?? CONF_SHIFT;
    const noise = NOISES[params.noise] ?? NOISE_SD;
    const studies = runStudies(makeRng, params.seed, {
      topic: params.topic,
      scheme: params.scheme,
      n: params.n,
      people: params.people,
      reps: params.reps,
      effect,
      shift,
      noise,
    });
    return {
      studies,
      effect,
      shift,
      window: pileWindow(params, effect, shift, noise),
      values: isAllocate(params) ? null : valueWindow(effect, noise),
    };
  },

  animation: {
    stepLabel: "Run one study",
    stepTitle: "Select the subjects out of the two populations, measure them, test them, and drop the estimate into the pile",
    runLabel: "Play",
    runTitle: "Keep running studies and watch the rate the pile reports settle",

    init({ params, state, fromScratch }) {
      const anim = {
        pile: createPile({
          bins: PILE_BINS,
          lo: state.window.lo,
          width: (state.window.hi - state.window.lo) / PILE_BINS,
        }),
        ran: 0,
        wrong: 0,
        err: 0,
        /* 0 while idle; climbs 0 -> 1 across one study's selection and flight.
           The picture at rest is the picture at flight === 1, so a stopped
           animation is never a half-drawn one. */
        flight: 1,
        done: false,
      };
      const pre = fromScratch ? 0 : Math.min(Math.max(0, params.shown | 0), MAX_STUDIES);
      for (let i = 0; i < pre; i += 1) commit(anim, state);
      anim.pile.clearFlash();
      return anim;
    },

    advance(anim, { dt, params, state }) {
      if (anim.done) return false;
      anim.pile.tick(dt);

      const stepping = anim.mode === "step";
      const speed = SPEEDS[params.speed] ?? SPEEDS.medium;
      /* Pacing is chosen, not automatic (4.1). Fast declares that it stops
         flying each study's subjects and shows arrivals only — the flight is
         held at 1 there so the stage still reads as a finished selection. */
      const choreo = stepping || speed.choreo;
      const budget = stepping ? STEP_MS : speed.ms;

      if (!choreo) {
        anim.flight = 1;
        commit(anim, state);
        return halt(anim, stepping);
      }

      /* The commit happens FIRST and the flight then reveals it, so what flies
         is the study already in the pile rather than a guess at the next one —
         invariant 2, the same reason `compute` builds all of them up front. */
      if (anim.flight >= 1) {
        commit(anim, state);
        if (anim.done) return false;
        anim.flight = 0;
      }
      anim.flight += dt / Math.max(1, budget);
      if (anim.flight < 1) return true;
      anim.flight = 1;
      return halt(anim, stepping);
    },
  },

  draw({ ctx, colors, w, h, params, state, anim }) {
    const ran = anim?.ran ?? 0;
    const study = ran > 0 ? state.studies[ran - 1] : state.studies[0];
    const allocate = isAllocate(params);
    const flight = anim ? anim.flight : 1;
    const left = 12;

    if (allocate) drawAllocate(ctx, colors, { w, left, ran, flight }, params, study, state);
    else drawBudget(ctx, colors, { w, left, ran, flight }, params, study, state);

    /* --- the last band, shared: every repeat of the same design */
    const pileY = studyH(params) + 14;
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, pileY - 6.5);
    ctx.lineTo(w - 12, pileY - 6.5);
    ctx.stroke();

    const f = anim ? anim.pile.frame() : { yMax: 1, barMix: 0, smoothMix: 0, total: 0 };
    const plot = makePlot({
      ctx,
      colors,
      rect: { x: left + GUTTER, y: pileY + 8, w: w - GUTTER - 24, h: H_PILE - 46 },
      xDomain: [state.window.lo, state.window.hi],
      yDomain: [0, f.yMax],
    });
    plot.axisX({ label: "estimated group difference (Disease − Control)" });
    /* The truth, wherever the effect dial put it. Drawn by hand rather than
       through `vline`, which has no dash: the legend's swatch for a reference
       is dashed, and a solid rule here would leave the legend describing a mark
       the figure does not draw. */
    ctx.save();
    ctx.strokeStyle = colors.reference;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    const tx = Math.round(plot.sx(state.effect)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(tx, plot.y);
    ctx.lineTo(tx, plot.y + plot.h);
    ctx.stroke();
    ctx.restore();
    label(ctx, colors, tx, plot.y - 8, "the truth", colors.reference, "center");

    if (anim && anim.pile.shown > 0) {
      anim.pile.draw(plot, f, { colors, smooth: params.smooth });
      /* the studies that called it: what a p-value counts, drawn over the pile
         rather than instead of it, so the tail is read as part of the same
         distribution */
      if (anim.wrongCounts) {
        plot.bars(anim.wrongCounts, {
          lo: anim.pile.lo, width: anim.pile.width, fill: colors.extreme,
        });
      }
    } else {
      label(ctx, colors, plot.x + plot.w / 2, plot.y + plot.h / 2,
        "Every study you run lands here", colors.ink3, "center", colors.fsSm);
    }
    label(ctx, colors, left, pileY + 8 + (H_PILE - 46) / 2 - 7, "repeated", colors.ink2);
    label(ctx, colors, left, pileY + 8 + (H_PILE - 46) / 2 + 7, "studies", colors.ink2);
  },

  readout: ({ params, state, anim }) => {
    const ran = anim?.ran ?? 0;
    const study = ran > 0 ? state.studies[ran - 1] : null;
    const tiles = [];
    const asP = (v) => (v < 0.001 ? "<0.001" : fmt(v, 3));

    tiles.push({
      label: "Mean difference",
      value: study ? fmt(study.diff, 3) : "—",
      note: study
        ? (isAllocate(params)
          ? `p ${asP(study.p)}`
          : `p ${asP(study.p)} counting ${study.arms[0].length} rows per group`)
        : "nothing measured yet",
    });

    if (isAllocate(params)) {
      /* BOTH LEGS OF THE CONFOUNDER, on one line. The tile this replaces read
         "Subjects out of balance: 6 of 20", which named a thing that does not
         exist — six subjects are not out of balance; it is a difference of two
         counts. This says how many carriers each arm got, and what one carrier
         is worth, because a confounder needs both and neither alone is one. */
      const c = CONF[params.confounder];
      const carriers = study ? study.carried : null;
      const lift = study
        ? mean(study.population.flat().filter((x) => x.carrier).map((x) => x.y))
          - mean(study.population.flat().filter((x) => !x.carrier).map((x) => x.y))
        : 0;
      tiles.push({
        label: `${CONF[params.confounder].carrier} sampled, per group`,
        value: carriers ? `${carriers[0]} and ${carriers[1]}` : "—",
        note: !study
          ? "Control, then Disease"
          : Math.abs(lift) < 0.05
            ? `${c.carrier} and ${c.plain} measure the same, so no split can bias this`
            : study.imbalance === 0
              ? `level — the ${fmt(Math.abs(lift), 2)} difference falls on both groups`
              : `${study.imbalance} apart, and ${c.carrier} − ${c.plain} is ${lift > 0 ? "+" : "−"}${fmt(Math.abs(lift), 2)}`,
      });
    } else {
      /* The same data at the unit that actually varies. Balanced replicates
         give the two tests the SAME difference — the mean of the subject means
         is the mean of the rows — so printing that number twice would read as
         an error. What differs is the evidence, so the p is the value here. */
      tiles.push({
        label: "Same difference, per person",
        value: study && study.meanTest ? `p ${asP(study.meanTest.p)}` : "—",
        note: study
          ? (study.meanTest
            ? `counting ${params.people} people per group`
            : "one person per group cannot be tested")
          : "nothing measured yet",
      });
    }

    tiles.push({
      label: "Studies simulated",
      value: String(ran),
      note: ran
        ? (isAllocate(params)
          ? "each a fresh sample of the same population"
          : "each a fresh set of people")
        : "none yet",
    });

    /* WHAT THE HISTOGRAM SAYS, as a number rather than a count of red bars.
       The pile is 200 repeats of one design, so the honest report of it is a
       RATE and not a verdict — and with no true group difference every one of
       them is a wrong answer. It is the tab's argument in one figure: the same
       ten measurements read 5% at 10 people x 1 and 30% at 2 people x 5.

       IT IS NOT THE POWER TILE, which was cut. That one reported 100% for a
       design whose estimate was wrong by a factor of three, so a large number
       read as success. This one counts the marks already drawn in red, on the
       tab where the effect dial's default is none. It is on the Replicate tab
       only; the Sampling tab keeps the picture Kenneth asked it to keep. */
    if (!isAllocate(params)) {
      tiles.push({
        label: "Reached p < 0.05",
        value: ran ? `${anim.wrong} of ${ran}` : "—",
        /* THE NOTE NAMES WHICH OF TWO OPPOSITE THINGS THIS COUNT IS.

           The same number is an ERROR RATE at no true difference and POWER at
           any other setting, and the pseudoreplicated design scores higher on
           both — measured over 4000 draws, 2 people x 5 reads 30.9% against
           10 people x 1's 4.7% with nothing to find, and 47.1% against 30.6%
           with a difference of 0.50. So on the dial's upper half the worse
           design looks like the better one, which is what got the Sampling
           tab's power tile cut. The count stays; the note says which it is. */
        note: !ran
          ? "counted over every study you run"
          : state.effect === 0
            ? `${fmt((anim.wrong / ran) * 100, 1)}%, and every one is a wrong answer`
            : `${fmt((anim.wrong / ran) * 100, 1)}%, against a true difference of ${fmt(state.effect, 2)}`,
      });
    }

    /* 2.8: the rate reports what has actually been collected, and says so. It
       counts against the studies that HAD an estimate, because a study with no
       estimate did not decline to call it — there was nothing to call. */
    /* WHAT THE GROUND TRUTH IS FOR: how far the average study lands from the
       difference really in the population. Non-random misses by the whole
       background variable; random and blocked miss by sampling noise, and
       blocked by a third less of it. Measured at n = 20: 1.03 / 0.17 / 0.11. */
    {
      tiles.push({
        label: "Average distance from the truth",
        value: ran ? fmt(anim.err / ran, 3) : "—",
        note: ran ? `truth is ${fmt(state.effect, 2)}` : "the difference really in the population",
      });
    }

    /* NO POWER TILE. It reported 100% for a design whose estimate was 1.46
       against a truth of 0.50 — significant every time, and wrong every time by
       a factor of three. Kenneth: "maybe we remove this — qualitatively we
       should be able to see that randomization/blocking brings us closer to the
       correct conclusion". The pile against the truth line shows that, and the
       distance tile puts a number on it. The red bars still mark what reached
       p < 0.05, which is where the rate is now read: at no true difference
       non-random is entirely red, random shows a few in the tails, blocked
       almost none. */
    return tiles;
  },
});

/**
 * The beat's own name, and how many beats there are. Shared by both tabs since
 * the Replicate tab gained a score of its own — one copy, so the two cannot
 * drift into naming their steps differently.
 */
function drawBeats(ctx, colors, { w, left, ran, raw }, beats, prefix = "") {
  let step = 0;
  beats.forEach((b, i) => { if (ran > 0 && raw >= b.at) step = i; });
  label(ctx, colors, left, 12, `${prefix}${beats[ran > 0 ? step : 0].label}`,
    colors.ink1, "left", colors.fsSm, "600");
  beats.forEach((b, i) => {
    ctx.save();
    ctx.fillStyle = (ran > 0 && i === step) ? colors.highlight : colors.grid;
    ctx.beginPath();
    ctx.arc(w - 14 - (beats.length - 1 - i) * 11, 12, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

/* --------------------------------------------------------------------------
   The Allocate stage: two arms, each one band of

       label | its population as a grid | the scheme | its sample on a value axis

   and the tween carries each selected subject from its cell in the grid to its
   place on the axis. That flight IS the sampling — it is the only moment where
   "these twenty came out of those hundred and twenty" is visible rather than
   asserted, which is what Kenneth's review asked for.
   ----------------------------------------------------------------------- */

/* THE STUDY BOUNDARY IS A CROSSFADE, NOT A CUT — measured before it was fixed.

   A study ends with 40 subjects out of their cells and 40 marks on the axis,
   and the next one starts with all 192 in their cells and the axis empty.
   `appear` drops 1 -> 0 between those two frames and the sample strip was
   simply skipped while it was 0, so at Medium, counting the marks actually
   painted per frame over three studies:

       grid    194,194,194,194,194,194, 154,154,154  (repeating)
       strip    11, 11, 11,  53, 53, 53,  53, 53, 53

   Eighty marks changing state in ONE frame, three times a second. That is the
   flashing, and the dead zone is a third of every study.

   The fix uses time that was already dead rather than re-timing any beat: the
   PREVIOUS study's sample holds the axis until this one displaces it, and a
   subject's cell is empty to the degree it is on the axis for EITHER study. It
   is also what the model does — one population, sampled again and again — so
   the old sample returning to the population as the new one is drawn is a true
   picture of it rather than a transition effect.

   The selection rings are left alone. They rebuild each study because a
   different twenty are ringed each study, which is information, and arriving
   one at a time is the beat picked in `_lab/design-tween.html`. */
function drawAllocate(ctx, colors, { w, left, ran, flight }, params, study, state) {
  const conf = CONF[params.confounder];
  const gridX = left + GUTTER;
  /* one constant gap for the arrow, so the axis simply takes what is left */
  const axisX0 = gridX + GRID_W + 46;
  const axisW = w - axisX0 - 40;
  const r = CELL * 0.36;

  /* One value axis for both arms, which is what colour-on-the-arm buys. Fixed
     to the POPULATION's range rather than the sample's, so the sample does not
     appear to move when a different twenty are chosen. */
  const all = study.population.flat().map((s) => s.y);
  const lo = Math.min(...all) - 0.15;
  const hi = Math.max(...all) + 0.15;
  const atValue = (v) => axisX0 + ((v - lo) / (hi - lo)) * axisW;

  const sorts = willSort(params, ran);
  const partitions = params.scheme !== "random";
  const steps = scoreFor(params, ran);
  const raw = clamp01(flight);
  const sort = partitions ? (steps.sort ? phase(raw, ...steps.sort) : 1) : 0;
  const rings = clamp01((raw - steps.rings[0]) / (steps.rings[1] - steps.rings[0]));
  const appear = phase(raw, ...steps.appear);
  const armTop = (g) => H_HEAD + g * (H_ARM + ARM_GAP);

  drawBeats(ctx, colors, { w, left, ran, raw },
    stepsFor(params, ran, sorts), `${SCHEMES[params.scheme]} — `);

  /* --- THE CONFOUNDER'S SET-UP, both legs, and both visible before anything
     is run. Kenneth sketched this and I built its transpose twice: these bars
     are ONE PER LEVEL OF THE CONFOUNDER, split by ARM — "of the females, how
     many have the disease" — which is the association a confounder is named
     for. Bars per arm split by carrier answer a different question.

     Equal halves mean no association: in the population there is none, because
     sex and the arm are independent there. The ALLOCATION is what creates one,
     which is why the second pair only appears once a study has run and why
     Convenience drives it to all-of-one-colour. --------------------------- */
  const levels = [true, false].map((carrier) =>
    mean(study.population.flat().filter((sub) => sub.carrier === carrier).map((sub) => sub.y)));
  const gap = levels[0] - levels[1];
  const alike = Math.abs(gap) < 0.05;

  /* Laid out to fit left of the value axis at the 550px canvas: 44 for the row
     label, two 80px bars with their percentages, and a gap — 268 of the 286
     available. The percentages are what the bars are FOR, so they sit beside
     them rather than under. */
  const LB_X = left + 44;
  const LB_W = 80;
  const LB_2 = LB_X + LB_W + 40;
  const assocBar = (x, y, controlN, diseaseN) => {
    const total = controlN + diseaseN;
    if (!total) {
      label(ctx, colors, x + LB_W + 5, y + 4.5, "none", colors.ink3, "left");
      return;
    }
    const cut = (controlN / total) * LB_W;
    ctx.save();
    ctx.fillStyle = colors.groupA;
    ctx.fillRect(x, y, cut, 9);
    ctx.fillStyle = colors.groupB;
    ctx.fillRect(x + cut, y, LB_W - cut, 9);
    ctx.restore();
    label(ctx, colors, x + LB_W + 5, y + 4.5,
      `${Math.round((diseaseN / total) * 100)}%`, colors.ink2, "left");
  };
  const popCar = study.popCarried;
  const rows = [
    { name: conf.carrier, ctrl: popCar[0], dis: popCar[1],
      sCtrl: study.carried[0], sDis: study.carried[1] },
    { name: conf.plain, ctrl: POP_PER_ARM - popCar[0], dis: POP_PER_ARM - popCar[1],
      sCtrl: params.n - study.carried[0], sDis: params.n - study.carried[1] },
  ];
  /* B2: the two legs get headings, because one dial moves only one of them and
     the layout was promising otherwise. A confounder is associated with BOTH
     the group and the measurement; the dial sets the second, the sampling
     method sets the first. */
  label(ctx, colors, left, 28, `${conf.name} and group`, colors.ink1, "left", colors.fsXs, "600");
  label(ctx, colors, axisX0, 28, `${conf.name} and the measurement`,
    colors.ink1, "left", colors.fsXs, "600");
  label(ctx, colors, LB_X + LB_W / 2, 42, "Population", colors.ink3, "center");
  if (ran > 0) label(ctx, colors, LB_2 + LB_W / 2, 42, "Sample", colors.ink3, "center");
  rows.forEach((row, i) => {
    const y = 52 + i * 13;
    label(ctx, colors, LB_X - 6, y + 4.5, row.name, colors.ink2, "right");
    assocBar(LB_X, y, row.ctrl, row.dis);
    if (ran > 0) assocBar(LB_2, y, row.sCtrl, row.sDis);
  });
  label(ctx, colors, left, 80, "% with disease", colors.ink3, "left");

  /* WHAT IT TAKES TO BE A CONFOUNDER, stated rather than asserted. Both
     associations are needed and either can be switched off — the dial removes
     the one to the measurement, blocking removes the one to the group — so a
     line that simply declared "the confounder" was wrong in half the states.
     2.9: name the quantities, do not deliver a verdict. */
  const split = ran > 0 ? study.imbalance : null;
  label(ctx, colors, left, 96,
    alike
      ? `${conf.name} does not affect the measurement — nothing here can confound.`
      : split === null
        ? `A confounder needs both: ${conf.name} affects the measurement, and the sampling must split it unevenly.`
        : split === 0
          ? `Both are needed: ${conf.name} affects the measurement, but this study's split is level.`
          : `Both are present: ${conf.name} affects the measurement, and this study's split is ${split} of ${params.n} out.`,
    colors.ink2, "left");

  /* the confounder's OTHER leg: what carrying it does to the measurement */
  subjectMark(ctx, colors, atValue(levels[0]) - (alike ? 5 : 0), 58,
    { carrier: true }, 0, r, 1, colors.ink1);
  subjectMark(ctx, colors, atValue(levels[1]) + (alike ? 5 : 0), 58,
    { carrier: false }, 0, r, 1, colors.ink1);
  if (alike) {
    label(ctx, colors, atValue(levels[0]), 45,
      `${conf.carrier} and ${conf.plain} alike`, colors.ink2, "center");
  } else {
    label(ctx, colors, atValue(levels[0]), 45, conf.carrier, colors.ink2, "center");
    label(ctx, colors, atValue(levels[1]), 45, conf.plain, colors.ink2, "center");
  }
  label(ctx, colors, axisX0 + axisW, 80,
    alike ? "no difference" : `${conf.carrier} − ${conf.plain}: ${gap > 0 ? "+" : "−"}${fmt(Math.abs(gap), 2)}`,
    alike ? colors.ink3 : colors.ink2, "right");

  for (const g of [0, 1]) {
    const top = armTop(g);
    const mid = top + H_ARM / 2;
    const at = { x: gridX, y: top };
    const pop = study.population[g];
    const order = study.picked[g];
    const chosen = new Set(order);
    /* the sample still on the axis from the study before this one */
    const prev = ran > 1 ? state.studies[ran - 2] : null;
    const leaving = prev ? new Set(prev.picked[g]) : null;
    const shown = ran === 0 ? 0 : sort;

    label(ctx, colors, gridX - 8, mid, g ? "Disease" : "Control", colors.ink2, "right");

    /* how many of this arm's draw came out of each block — the count that tells
       Convenience from Block, since both partition and only the counts differ */
    const fromCarrier = order.filter((i) => pop[i].carrier).length;
    const fromPlain = order.length - fromCarrier;

    /* D3: a block nobody drew from is not merely unselected, it was never
       eligible. Under Convenience half of each population dims — and the two
       arms dim OPPOSITE halves, which is what complete confounding is. */
    const dimmed = (carrier) => (ran > 0 && partitions && shown > 0.4
      && (carrier ? fromCarrier : fromPlain) === 0);

    const ringAt = (i) => {
      if (ran === 0) return 0;
      const k = order.indexOf(i);
      return k < 0 ? 0 : clamp01(rings * order.length - k);
    };
    pop.forEach((sub, i) => {
      const [cx, cy] = seatOf(pop, i, at, shown);
      const a = ringAt(i);
      if (a > 0) selectionRing(ctx, colors, cx, cy, r, a);
      const faded = dimmed(sub.carrier) ? 0.22 : 1;
      /* A CELL IS EMPTY TO THE DEGREE ITS SUBJECT IS ON THE AXIS, and two
         studies can claim it at once: the one leaving is still there at
         `1 - appear`, the one arriving is at `appear`. Taking the larger keeps
         a subject picked by BOTH studies in its seat throughout instead of
         blinking as one claim hands over to the other. */
      const away = Math.max(
        leaving && leaving.has(i) ? 1 - appear : 0,
        chosen.has(i) ? appear : 0,
      );
      const alpha = ran > 0 ? faded * (1 - away) : faded;
      if (alpha > 0) subjectMark(ctx, colors, cx, cy, sub, g, r, alpha);
    });

    /* the arrow, carrying the scheme's name */
    const ax0 = gridX + GRID_W + 10;
    const ax1 = axisX0 - 12;
    ctx.save();
    ctx.strokeStyle = colors.ink2;
    ctx.fillStyle = colors.ink2;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(ax0, mid);
    ctx.lineTo(ax1 - 5, mid);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ax1, mid);
    ctx.lineTo(ax1 - 7, mid - 4);
    ctx.lineTo(ax1 - 7, mid + 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    /* NO LABEL ON THE ARROW. The gap between the grid and the axis is 24px and
       "Convenience" is 60 — it ran into the sample strip, which the text sweep
       cannot see because it only checks the canvas edge. The scheme now leads
       the step caption instead, where there is room and where it belongs: the
       caption is already naming what this beat does. */

    if (ran === 0) continue;

    /* THE SAMPLE SHARES THE GRID'S BOTTOM ROW — the one line the reader can run
       their eye along from the population to what it measured.

       Both samples are laid out by `stackRows` on the SAME axis, which is fixed
       to the population's range, so the two are directly comparable and the
       handover is a dissolve. It is deliberately not a flight: the two samples
       are different subjects, and moving mark i of one to mark i of the other
       would assert a correspondence that does not exist — the mistake the
       original per-subject flight made, recorded in the choreography note. */
    const maxRows = Math.max(1, Math.floor((H_ARM - 2 * r - 4) / (2 * r + 1.5)));
    const floor = top + (POP_ROWS - 0.5) * CELL;
    const strip = (st, alpha) => {
      if (alpha <= 0.01) return;
      const picked = st.arms[g];
      const placed = stackRows(picked.map((sub) => sub.y), lo, hi, axisW, r, maxRows);
      picked.forEach((sub, i) => {
        subjectMark(ctx, colors,
          axisX0 + placed[i].px, floor - placed[i].row * (2 * r + 1.5),
          sub, g, r, alpha);
      });
    };
    if (prev) strip(prev, 1 - appear);
    strip(study, appear);

    /* THE ARM MEAN SLIDES WHERE THE MARKS DISSOLVE, and the difference between
       the two is the point. Two samples are different subjects, so mark i of
       one is not mark i of the other and moving between them would assert a
       correspondence that is not there. The arm MEAN is the same quantity in
       both, so it interpolates honestly — and a rule that slides says what a
       dissolve cannot: this is the number the test differences, and it moves
       from study to study. Crossfading two rules instead put two white lines a
       few pixels apart, which reads as a fault rather than as a handover. */
    const mNow = mean(study.arms[g].map((sub) => sub.y));
    const mWas = prev ? mean(prev.arms[g].map((sub) => sub.y)) : mNow;
    ctx.save();
    ctx.globalAlpha = prev ? 1 : appear;
    ctx.strokeStyle = colors.ink1;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const mx = atValue(mWas + (mNow - mWas) * appear);
    ctx.moveTo(mx, floor + r + 2);
    ctx.lineTo(mx, top + 2);
    ctx.stroke();
    ctx.restore();
  }

  const baseY = armTop(1) + H_ARM + 12;
  if (ran === 0) {
    /* below BOTH arms, where the value axis will be — at arm 0's old position it
       sat on that arm's bar count */
    label(ctx, colors, w / 2, baseY + 8,
      "Run one study to sample this population", colors.ink3, "center", colors.fsSm);
    return;
  }
  /* one axis under both arms, since both are drawn on it */
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(axisX0, baseY + 0.5);
  ctx.lineTo(axisX0 + axisW, baseY + 0.5);
  ctx.stroke();
  for (const v of niceTicks(lo, hi, 5)) {
    if (v < lo || v > hi) continue;
    label(ctx, colors, atValue(v), baseY + 9, String(Math.round(v * 10) / 10), colors.ink3, "center");
  }
  label(ctx, colors, axisX0 + axisW / 2, baseY + 22, "measurement", colors.ink3, "center");
}

/* --------------------------------------------------------------------------
   The Replicate stage. Value runs UP the band, each person is a column of
   their own measurements, and the pooled histogram is the MARGINAL of that on
   the same axis — the two pictures the tab exists to set against each other.
   ----------------------------------------------------------------------- */

function drawBudget(ctx, colors, { w, left, ran, flight }, params, study, state) {
  const raw = clamp01(flight);
  drawBeats(ctx, colors, { w, left, ran, raw }, stepsFor(params, ran, false));

  /* THE BUDGET, STATED. The two dials are a split of one total and nothing on
     screen said what that total was, so comparing 10 x 1 against 2 x 5 started
     with arithmetic the reader had to do. Four linked-control designs were
     drawn at the real width in `_lab/design-linked-dials.html` and Kenneth took this
     one: the dials stay free, and the figure reports what they add up to. */
  label(ctx, colors, left, 26,
    `${params.people} × ${params.reps} = ${params.people * params.reps} measurements per group`,
    colors.ink3);

  const appear = phase(raw, params.reps === 1 ? 0.34 : 0.56, 0.86);
  const prev = ran > 1 ? state.studies[ran - 2] : null;
  const { lo, hi } = state.values;

  const x0 = left + GUTTER;
  const plotW = w - GUTTER - left - 12;
  const mw = Math.max(46, Math.round(plotW * 0.15));
  const colW = plotW - mw - 12;
  const people = study.subjects[0].length;
  const reps = study.subjects[0][0].rows.length;
  const cell = colW / people;
  const r = Math.max(1.3, Math.min(3, cell / 7));
  const bins = binsFor(people * reps);

  /* BOTH ARMS ARE MEASURED BEFORE EITHER IS DRAWN, because two things have to
     be shared between them and neither can be worked out inside one band's
     turn: the marginal's scale, and where the other arm's mean falls. */
  const arms = [0, 1].map((g) => {
    const now = armCounts(study, g, bins, lo, hi);
    const was = prev ? armCounts(prev, g, bins, lo, hi) : new Array(bins).fill(0);
    const mNow = mean(study.arms[g].map((m) => m.y));
    const mWas = prev ? mean(prev.arms[g].map((m) => m.y)) : mNow;
    return {
      counts: now.map((v, i) => was[i] + (v - was[i]) * appear),
      mean: mWas + (mNow - mWas) * appear,
      peak: Math.max(3, ...now, ...was),
    };
  });
  /* ONE SCALE FOR BOTH MARGINALS. Each was normalised to its own tallest bin,
     so both always ran the full width whatever they held — Kenneth: "the scale
     for pooled histograms is arbitrary so i can't really see that disease and
     control have a difference". A shared peak is what makes the two shapes
     comparable at all. */
  const peak = Math.max(arms[0].peak, arms[1].peak);

  /* the value axis runs UP now, so its name is rotated rather than sitting
     under a picture it stopped describing */
  ctx.save();
  ctx.translate(left + 7, B_TOP + B_ARM + B_GAP / 2);
  ctx.rotate(-Math.PI / 2);
  label(ctx, colors, 0, 0, "measured value", colors.ink3, "center");
  ctx.restore();

  for (let g = 0; g < 2; g += 1) {
    const top = B_TOP + g * (B_ARM + B_GAP);
    const yAt = (v) => top + B_ARM - 5 - ((v - lo) / (hi - lo)) * (B_ARM - 10);
    const geo = { x0, cell, yAt, top, r, arm: g, mx: x0 + colW + 12, mw, lo, hi };
    label(ctx, colors, x0 - 8, top + B_ARM / 2, g ? "Disease" : "Control",
      colors.ink2, "right");
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, Math.round(top + B_ARM) + 0.5);
    ctx.lineTo(x0 + plotW, Math.round(top + B_ARM) + 0.5);
    ctx.stroke();
    if (g === 0) {
      label(ctx, colors, x0 + colW + 12, top - 4, "pooled", colors.ink3);
    }

    if (ran === 0) {
      /* FULL STRENGTH BEFORE ANYTHING RUNS. These were drawn faint, on the
         argument that a solid dot claims a measurement nobody has taken — but
         Kenneth: "try not to dim it as it's hard to see when setting it up
         before play", and setting the dials up is what this state is FOR.

         Nothing is lost by it. The dots stand in a perfectly regular grid, and
         no measurement ever lands in a regular grid, so the layout says "not
         yet" more plainly than the opacity did; the prompt underneath says it
         in words; and there is no mean tick, because there is no mean. */
      drawColumns(ctx, colors, geo, study, { alpha: 1, toValue: 0 });
      continue;
    }

    /* Study one eases its dots off the schematic and into their values. Every
       study after that DISSOLVES out of the one before, because two studies are
       different people and column p of one is not column p of the next —
       sliding between them would assert a correspondence that is not there. */
    if (prev) {
      drawColumns(ctx, colors, geo, prev, { alpha: 1 - appear });
      drawColumns(ctx, colors, geo, study, { alpha: appear });
    } else {
      /* the first study only SLIDES: the dots are already at full strength, so
         fading them would dim the picture the reader just set up */
      drawColumns(ctx, colors, geo, study, { alpha: 1, toValue: appear });
    }

    drawMarginal(ctx, colors, geo, arms[g].counts, peak);

    /* THE MEAN LINES SIT ON THE MARGINAL, AND BOTH ARMS' ARE DRAWN IN EACH.

       A single mean ruled across the whole band first, on the argument that it
       spans the picture it summarises. It reads as a rule through the data —
       Kenneth: "that group mean line is distracting when it goes across" — and
       it also failed at the job: with one arm's mean in one band and the
       other's 150px below, the GAP between them could only be got by comparing
       two offsets by eye, and that gap is the number that drops into the pile.

       Confined to the marginal and doubled, both faults go. The columns are
       clear of it, and each band carries both means, so the distance between a
       blue line and an orange one IS the estimated group difference, read in
       one place. Colour says which arm, which is the rule the rest of the tab
       already follows, so no new token and no new kind of mark.

       They SLIDE where the dots dissolve: a mean is the same quantity in both
       studies, so interpolating it is honest, and it barely has to move —
       measured over 200 studies it shifts 0.202 between one and the next, a
       fifth of a single person's own spread. */
    ctx.save();
    ctx.globalAlpha = prev ? 1 : appear;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    for (const k of [0, 1]) {
      ctx.strokeStyle = k ? colors.groupB : colors.groupA;
      ctx.beginPath();
      const my = Math.round(yAt(arms[k].mean)) + 0.5;
      ctx.moveTo(geo.mx - 5, my);
      ctx.lineTo(geo.mx + mw, my);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (ran === 0) {
    label(ctx, colors, x0 + plotW / 2, B_TOP + 2 * B_ARM + B_GAP + 8,
      "Run one study to measure these people", colors.ink3, "center", colors.fsSm);
  }
}

/** Stop, and say whether the run may continue. */
function halt(anim, stepping) {
  if (anim.ran >= MAX_STUDIES) {
    anim.done = true;
    return false;
  }
  return !stepping;
}

/* One study folded into the pile: its estimate, how far that fell from the
   truth, and whether it reached p < 0.05. The tail's counts are kept separately
   rather than re-derived at draw time, so the two halves of the picture cannot
   disagree about which bin a study is in. */
function commit(anim, state) {
  const study = state.studies[anim.ran];
  if (!study) { anim.done = true; return; }
  anim.ran += 1;
  /* how far this study landed from the truth — the population's own group
     difference, which `makePopulation` pins to the dial */
  anim.err += Math.abs(study.diff - state.effect);
  const bin = anim.pile.push(study.diff);
  if (study.p < 0.05) {
    anim.wrong += 1;
    if (bin >= 0) {
      if (!anim.wrongCounts) anim.wrongCounts = new Array(PILE_BINS).fill(0);
      anim.wrongCounts[bin] += 1;
    }
  }
}

/* ---------------------------------------------------------------------------
   OPEN, and it is a teaching call rather than a defect.

   THE PERMUTATION SCHEME on the Replicate tab. `budgetStudy` gives every person
   the same measurement noise; a real technical replicate's noise varies with
   the instrument and the analyte.
   ------------------------------------------------------------------------ */
