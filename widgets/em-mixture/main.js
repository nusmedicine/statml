/* ============================================================================
   Expectation–Maximization — widget 10, and the last of the inference arc.

     what makes the data most likely -> what the data make likely -> and if the
     data is a mixture, where the labels are missing

   Hosted by `03 / 02-02 — Inferential Statistics: Inferring Parameters`, cells
   22–36, "Mixed distributions". Same notebook as widgets 8 and 9, which is why
   this one was built ahead of everything else in the queue: its host was settled
   before the design started.

   MISCONCEPTION TARGETED: that a hard cluster assignment and a soft
   responsibility are the same thing. EM never assigns a point to a component;
   it assigns a FRACTION. The lesson's `clusters(em_result)` is a post-hoc
   argmax, and cell 35 paints every point one confident colour without flagging
   that the fraction behind it was 0.55.

   THE SENTENCE THE WIDGET EXISTS TO SAY: **EM gets the populations right and
   the individuals wrong.** Measured on the lesson's own generating process
   (adults 170 ± 30, children 120 ± 15, 100 each), averaged over 200 datasets:

       fitted components   120.8 ± 14.7  and  172.1 ± 28.5    — right
       hard labels wrong   27.9 of 200 (13.9%)                — wrong
       responsibilities between .2 and .8   43.2 of 200

   Both halves are true at once, and the two readout tiles are named for them.

   THE OTHER CANDIDATE MISCONCEPTION WAS MEASURED AND DROPPED. "EM finds a local
   optimum that depends on where it started" is the standard warning, and on
   THIS data it is false often enough to be misleading:

       500 random parameter starts        499 -> the same optimum, 1 -> a
                                          degenerate spike on the tail
       500 random-responsibility starts   500 -> the same optimum
       (this is what flexmix's set.seed(123) actually seeds)
       both curves at the grand mean      the same optimum
       both narrow on the children        the same optimum
       one on each tail, min/max starts   the same optimum

   Every one lands on logL -966.89. To show a local optimum here you would have
   to rig the data or the start, and a figure that does so claims a pathology is
   routine when it is 0.2%. That is why the guess is random and nothing is made
   of it: the widget lets you re-roll it with the seed and quietly always
   converges to the same place. It does not ASSERT that, because 2.4 says a claim
   waits until there is something to claim about, and one seed is not evidence.

   THE M-STEP IS NOT WIDGET 8'S FIGURE, though the catalogue's plan assumed it
   would be. "(e.g. using MLE)" is the lesson's own parenthesis and it is true —
   the M-step maximises a likelihood — but widget 8's figure is a SEARCH: 41
   candidates, one dot per press, a curve you climb. The Gaussian M-step is
   closed form. It is a weighted mean and a weighted sd, arithmetic, no search
   at all. Drawing a climb over it would make the arc's payoff a lie about what
   the M-step does, so what transfers is the verb and not the panel.

   THE FIGURE IS THE LESSON'S OWN, and that is the whole layout decision. Cell
   29 draws the two steps as two pictures of ONE panel — the sample as coloured
   dots along the height axis, two curves above them — captioned "Find
   probability data belongs to a cluster" and "Adjust theta to fit data assigned
   to clusters". So:

       the E-step   the dots change colour, and nothing else moves
       the M-step   the curves move, and no dot changes

   One press runs both, and the thing that moves is what says which half is
   running — which matters because core forbids the BUTTON saying it. A step
   label may depend on a parameter and on nothing else (widget.js), and a label
   that alternates at runtime is exactly the defect 3.4d records. So the button
   is "Iterate" and the figure carries the alternation.

   A SECOND PANEL WAS BUILT AND CUT: each person's share plotted against their
   height, which is exact, and which is an S-curve. It was reported as hard to
   explain and it is — the shape is nowhere in the lesson, so it has to be
   introduced before it can be read, and it put the same 200 people on screen a
   second time. What it did that the pile cannot is show a share as a MAGNITUDE
   rather than as a hue; the ramp through grey and the stat tiles carry that
   instead.

   THE SPREAD IS HARDER TO RECOVER THAN THE MEAN, AND THE READOUT NOW SHOWS IT.
   Relative error over 150 seeds per setting, all four parameters:

       setting                    child mean  child sd   adult mean  adult sd
       the notebook 120/15 170/30       2.0%     11.7%         4.1%     13.1%
       far apart    100/15 220/30       1.2%      6.4%         1.2%      6.4%
       merged       140/15 150/30       1.7%     20.8%         6.3%     16.2%
       equal spreads 120/20 170/20      4.2%     12.9%         3.0%     14.2%

   Three to twelve times the error, at every setting — so it survives the whole
   slider, which is the bar for a claim here. It is also widget 8's finding in a
   second model: there, at n = 60, the mean is pinned to a factor of 1.2 and the
   size only to 2.6. Some parameters are much harder to estimate than others,
   and it is the same ones. NOT PRINTED ON THE CANVAS — the tile shows all four
   numbers against all four true ones and a reader who looks can see it, and
   naming it would be a third idea in a figure already carrying two.

   THE SEPARATION SLIDERS CARRY THE ARGUMENT ACROSS THEIR WHOLE RANGE, which is
   the property 3.5 asks of a control. Sixty datasets per stop:

       adult mean 220    120.5 ± 14.8 / 220.5 ± 29.8     2.8 of 200 wrong (1.4%)
       adult mean 170    120.8 ± 14.7 / 172.1 ± 28.5    27.9 of 200 wrong (13.9%)
       adult mean 140    121.0 ± 15.0 / 145.6 ± 28.8    63.8 of 200 wrong (31.9%)

   Three regimes on one control. Wide: populations right, individuals right.
   The lesson's default: populations right, individuals wrong. Narrow: the
   components merge and the populations go wrong too — 145.6 for a true 140 —
   which is 2.6's failing case. Together they say the mislabelled individuals
   are a property of the OVERLAP and not a failure of the algorithm: at a gap of
   100 the method is no better, the data simply is.
   ========================================================================= */

import { defineWidget, makePlot, fmt, normalPdf, niceTicks } from "../core/index.js";

/* --- the lesson's own generating process --------------------------------- *
 * `rnorm(100, mean = 120, sd = 15)` for the children and `rnorm(100, mean =
 * 170, sd = 30)` for the adults, verbatim from cell 23 — and all four numbers
 * are sliders, because all four are what `parameters(em_result)` hands back in
 * cell 32. A widget that let you set a mean and then reported only a mean would
 * be showing half of what the lesson extracts.
 *
 * THE MEAN RANGES DO NOT OVERLAP: children 100-140, adults 150-220. A gap of 10
 * at one end is already more overlap than EM can resolve, and at the other end
 * they separate completely — so nothing is lost by stopping the ranges short of
 * each other, and it buys an invariant the copy leans on everywhere: the
 * children's true mean is ALWAYS below the adults'.
 *
 * THE SPREAD RANGES ARE THE SAME 5-40 FOR BOTH, and they are safe across the
 * whole square. The worry was the spike — a narrow component whose curve peak
 * runs off the top of a panel scaled to the pile. Measured over 1,040 runs
 * covering every corner (5/5, 5/40, 40/5, 40/40 and the notebook's 15/30),
 * against every mean pairing: the axis never had to stretch past 1.28x the
 * pile's own height, and 1.9x was the threshold for "this looks broken". The
 * reason it is safe is that the ratio is scale-invariant — halve a true spread
 * and the pile narrows by exactly as much as the curve sharpens. */
const SD_MIN = 5;
const SD_MAX = 40;

/* Convergence, and both numbers are measured rather than chosen. The parameters
   move 12.5 cm on the first iteration and 1.0 on the second, then creep: the
   largest move is under 0.05 by iteration 60 and under 0.01 by about 90. The
   creep is real — EM is a first-order method — and Play is what carries it, so
   the tolerance is set where the picture has genuinely stopped rather than
   where it looks stopped. The cap is a backstop for the merged regime. */
const TOL = 0.01;
const MAX_ITERS = 160;

/* Step always reads at one pace; Play is the reader's to set (4.1). At `fast`
   the choreography is off and a frame is half an iteration — a declared
   property of the chosen speed, never something the animation decides.

   PER PHASE, NOT PER PRESS, which is why it is lower than widget 8's 420 for
   what looks like the same job. One press here plays TWO phases in sequence, so
   560 each made a press take 1.12s — long enough that repeated stepping, the
   primary affordance, felt held up. Core supplies the other half of 4.2: a
   second click while a step is in flight fast-forwards the iteration in flight
   rather than being swallowed. */
const STEP_MS = 400;

/* The sample falling out of the curves it was drawn from. Long enough to read
   as a fall rather than a flicker, short enough not to sit between a reader and
   the button they meant to press next. `DROP_LAG` staggers it by how high in
   its column a person lands, so the piles fill from the bottom instead of 200
   dots arriving in one sheet. */
const DROP_MS = 900;
const DROP_LAG = 0.45;
const RUN_MS = { slow: 420, medium: 150, fast: 0 };

/* --- panel geometry ------------------------------------------------------ *
 * ONE PANEL, because the lesson's own E-step and M-step figures are one panel:
 * the sample as coloured dots along the height axis, with the two curves above
 * them. An earlier build had two — a histogram with the curves, and a second
 * plotting each person's share against their height. The second was exact and
 * it was an S-curve, a shape the lesson never draws and one that has to be
 * explained before it can be read; it also put the same 200 people on screen
 * twice. Collapsing them costs the share its own axis and buys the figure the
 * representation a reader already arrives with.                               */
const PAD_L = 58;
const PAD_R = 18;
/* 400, AND THE FOUR PARAMETER SLIDERS ARE WHY. Measured at 1400px against the
   rest of the collection: this widget's rail is 979px — in family with
   `bayesian`'s 904, the other seven-slider widget — but its canvas was 380, the
   SMALLEST of the nine, so the rail stood two and a half times the figure. In
   the side layout the page height is bound by the taller column, which is the
   rail, so the figure was leaving 600px of its own column empty and the page
   was no shorter for it. Taking the panel to 400 costs nothing and buys the
   dots two pixels of radius, which is what a split mark needs to be read. */
const PANEL_Y = 34;
const PANEL_H = 400;
const CANVAS_H = PANEL_Y + PANEL_H + 46;

const clamp01 = (t) => Math.max(0, Math.min(1, t));
const easeInOut = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

/* --- the E-step, for one point ------------------------------------------- *
 * ONE DEFINITION, TWO CALLERS: compute() runs it over every observation to
 * build the trajectory, and nothing else may re-derive a responsibility from
 * parameters. 5.8, and here it matters more than usual — the dots in the pile
 * and the numbers in the readout are the same quantity, and two copies is how
 * the halves of a figure come to disagree.
 *
 * Returns the share claimed by component 1, which compute() keeps as the LEFT
 * curve (the lower mean) at every iteration.                                  */
function shareOfLeft(x, p) {
  const a = p.w * normalPdf(x, p.m1, p.s1);
  const b = (1 - p.w) * normalPdf(x, p.m2, p.s2);
  const t = a + b;
  return t > 0 ? a / t : 0.5;
}

/** The M-step: maximum likelihood on soft-weighted data, in closed form. */
function maximize(xs, resp) {
  const n = xs.length;
  let n1 = 0;
  for (let i = 0; i < n; i += 1) n1 += resp[i];
  const n2 = n - n1;
  /* A component with no weight left has no parameters to estimate. It cannot
     happen from the guesses this widget makes, and returning null rather than
     dividing by zero is what keeps a NaN off the canvas if it ever does. */
  if (n1 < 1e-9 || n2 < 1e-9) return null;

  let m1 = 0, m2 = 0;
  for (let i = 0; i < n; i += 1) { m1 += resp[i] * xs[i]; m2 += (1 - resp[i]) * xs[i]; }
  m1 /= n1; m2 /= n2;

  let v1 = 0, v2 = 0;
  for (let i = 0; i < n; i += 1) {
    v1 += resp[i] * (xs[i] - m1) ** 2;
    v2 += (1 - resp[i]) * (xs[i] - m2) ** 2;
  }
  return {
    m1, m2,
    s1: Math.sqrt(Math.max(1e-9, v1 / n1)),
    s2: Math.sqrt(Math.max(1e-9, v2 / n2)),
    w: n1 / n,
  };
}

/** Component 1 is always the LEFT curve. Kept true at every iteration so the
    colour of a point means one thing for the whole run, and so a trajectory
    where the two happen to cross cannot swap the palette mid-animation. */
function orderLeftFirst(p) {
  if (p.m1 <= p.m2) return p;
  return { m1: p.m2, s1: p.s2, m2: p.m1, s2: p.s1, w: 1 - p.w };
}

const moveOf = (a, b) =>
  Math.max(Math.abs(a.m1 - b.m1), Math.abs(a.m2 - b.m2),
           Math.abs(a.s1 - b.s1), Math.abs(a.s2 - b.s2));

/* --- one person, part of each curve --------------------------------------- *
 * A CIRCLE FILLED FROM THE BOTTOM BY ITS SHARE. A person at 0.55 is drawn 55%
 * amber and 45% blue, so a share is a QUANTITY on the mark rather than a
 * property of its colour.
 *
 * IT WAS A HUE RAMP FIRST, through --ink-3 at 0.5, and that was reported as
 * unreadable in the precise way that matters: under `hard cluster` you can see
 * the colours swapping, and under `share` you cannot tell what changed. Two
 * separate failures, both fatal to a figure whose subject is the E-step:
 *
 *   - a hue that shifts a few percent per iteration is not a visible EVENT, so
 *     the E-step had nothing on screen saying it had happened
 *   - at 0.5 the mark was grey, and grey in a figure whose other colours are
 *     named reads as "no data" rather than as "no group". At the guess, where
 *     every share is exactly 0.5, the whole pile went grey and looked broken.
 *
 * The split mark answers both: at the guess, 200 visibly half-and-half people,
 * and every E-step is fill levels sliding. Compared in _lab/soft-share.html
 * against the ramp, against opacity pairs, and against splitting each COLUMN at
 * its weighted count. That last one is the one to keep away from — it paints
 * the bottom 7 of 12 people fully amber and the top 5 fully blue, which is a
 * hard assignment wearing a soft costume, in the widget built to separate them.
 *
 * Published practice agrees on the mark and not on the geometry: Kern et al.,
 * "The whole and its parts" (Visual Informatics, 2024), encode mixture
 * proportions as pie glyphs whose circular SEGMENTS are the component
 * densities. A fill level is the same glyph read as a level, which is easier to
 * compare across neighbours than an angle is.
 *
 * NOT LIFTED INTO core/canvas.js, though mark specs live there. One consumer is
 * not a seam — the rule this repo has actually used is that a thing moves to
 * core when a SECOND widget wants it. The surface halo is copied deliberately:
 * it is what keeps 200 overlapping people separable, and `dot()` cannot be
 * called here because it owns its own fill.                                    */
function splitDot(ctx, cx, cy, r, f, top, bottom, surface) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = top;
  ctx.fill();
  if (f > 0.002) {
    if (f >= 0.998) {
      ctx.fillStyle = bottom;
      ctx.fill();
    } else {
      /* The bottom cap, as one arc between the two points where the fill line
         crosses the circle. A clip per dot would do the same and costs a
         save/restore pair 200 times a frame. */
      const a = Math.asin(1 - 2 * f);
      ctx.beginPath();
      ctx.arc(cx, cy, r, a, Math.PI - a);
      ctx.closePath();
      ctx.fillStyle = bottom;
      ctx.fill();
    }
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = surface;
  ctx.stroke();
}

/* FIVE CENTIMETRES, FIXED, and not a bin width derived from the sample size.
   A derived width picked 10cm at n = 100, which put 22 columns across the panel
   in a 20px band while the row pitch held the dots to 7px across — so the pile
   drew as thin dotted lines with more gap than dot, in the figure whose whole
   job is to be a countable pile of people. Halving the bin doubles the columns
   and halves their height, and the dots grow to fill the band because the pitch
   stops being the binding constraint. It also makes the axis label a sentence
   rather than a number to decode: people per 5 cm. */
const BIN_CM = 5;

defineWidget({
  slug: "em-mixture",
  title: "Expectation–Maximization",
  subtitle:
    "Two hundred heights, and nobody recorded who was an adult and who was a " +
    "child. Guess two curves, then let every point say how much it belongs to " +
    "each — and let those shares refit the curves. The populations come back. " +
    "The individuals do not.",
  layout: "side",
  height: CANVAS_H,

  params: {
    /* THE TWO CONTROLS THAT CARRY THE ARGUMENT, and between them they set the
       one quantity the widget is about: how far the groups overlap. Three
       regimes across their range, measured in the header comment at a child
       mean of 120 — at an adult mean of 220 the hard labels are 98.6% right, at
       the notebook's 170 they are 86%, and at 140 the two components merge and
       the PARAMETERS go wrong as well. Reading them in that order is what shows
       the mislabelled people to be a property of the overlap rather than a
       failure of EM. Two sliders rather than one because the notebook has two
       populations and names both; a single "separation" number would be the
       widget's abstraction rather than the lesson's. */
    /* EACH POPULATION IS ONE ROW UNDER ITS OWN COLOUR, which does two jobs at
       once. It stops four full-width sliders reading as four unrelated numbers,
       and the swatch says which curve on the figure each pair is setting —
       before anything has been drawn, and while the pile is still showing both
       groups in those same two colours. */
    childMean: {
      type: "int", label: "average", min: 100, max: 140, default: 120,
      row: {
        key: "child", label: "Children", token: "group-b",
      },
    },
    childSd: {
      type: "int", label: "spread", min: SD_MIN, max: SD_MAX, default: 15,
      row: { key: "child" },
    },
    adultMean: {
      type: "int", label: "average", min: 150, max: 220, default: 170,
      row: {
        key: "adult", label: "Adults", token: "group-a",
      },
    },
    adultSd: {
      type: "int", label: "spread", min: SD_MIN, max: SD_MAX, default: 30,
      row: { key: "adult" },
    },

    /* 40 to 100 per group, and the floor is 40 because of a MEASURED failure
       rather than because the cloud looks thin. A two-component Gaussian
       mixture has an unbounded likelihood: a component can shrink onto a
       handful of near-identical points and drive its own sd towards zero. Over
       210 (adult mean, seed) combinations per setting:

           n = 20    6/210 collapsed to sd < 6, worst 3.56
           n = 40    1/210,  worst 5.75
           n = 100   0/210,  worst 8.45

       At n = 20 that is a spike over the pile and a saturated set of shares,
       and it is a SECOND lesson — the one about mixture likelihoods being unbounded —
       which this figure has nothing to say about. It is not floored in
       `maximize`, because a variance floor is a modelling choice and inventing
       one silently would misrepresent what EM does. Raising the slider's floor
       makes it rare instead of hiding it; the notebook's own 100 is the
       default and it does not happen there at all. */
    n: {
      type: "int", label: "People in each group", min: 40, max: 100, default: 100,
    },

    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 3 },

    /* THREE STAGES, AND THE GATE IS THE BOUNDARY BETWEEN TWO OF THEM (3.4b).

         populations   four sliders and two curves. No data on screen at all,
                       because none has been drawn yet.
         the sample    press it: the people fall out of those curves, grey, and
                       THE TRUE CURVES GO WITH THE LABELS. Both are the truth,
                       and a figure that keeps one while withholding the other
                       has given the premise away before it starts.
         inference     everything else.

       NOT `display: true`, unlike the gate in widget 7. There the gate opens an
       overlay on a figure that is already complete, so leaving must not destroy
       the work. Here it is a stage boundary: going back to the populations and
       returning should start the inference over, not resume a converged fit the
       reader has stepped away from. Core sends a non-display gate down the data
       path, which resets exactly that much. */
    sampled: {
      type: "gate",
      label: "Draw a sample from them",
      labelOff: "Change the populations",
      detail: "the labels come off as they land",
      default: false,
    },

    view: { type: "section", label: "Inference", when: { param: "sampled" } },

    /* THE MISCONCEPTION, AS A CONTROL. `responsibility` and `cluster` are the
       SAME FIT read two ways — nothing is recomputed between them, and the
       second is `clusters(em_result)`, an argmax taken after the fact. Flipping
       between them is the whole lesson: 34 points change colour and not one
       number behind them moves.

       `truth` is a different KIND of thing and the group caption says so (3.4g)
       — it is not something the algorithm produces, it is what the widget has
       been withholding, which is the pair of plots in cells 25 and 27. It also
       brings the true curves into the figure as dashed references, because the
       truth about a mixture is its parameters as much as its labels, and tile
       one is about the parameters. */
    colour: {
      type: "segmented",
      label: "Colour each person by",
      /* THE HARD LABEL COMES FIRST AND IT IS THE DEFAULT, which is the opposite
         of where this started. A misconception is dislodged by being MET, not by
         being pre-empted: the reader arrives expecting each person to be in a
         group, gets exactly that, and then finds the share underneath it. Put
         the other way round, `share` has to be explained before anything has
         asked a question — and it was reported as the harder of the two to
         explain, in that order. */
      options: [
        { value: "cluster", label: "hard cluster",
          detail: "everyone put in one group or the other, at 0.5" },
        /* IT SAID "never 0 or 1" AND THAT DOES NOT SURVIVE THE SLIDERS. True of
           the model — both normals have support everywhere — and false of a
           double: swept over 210 (mean, seed) combinations, some share rounds to
           exactly 0 or 1 in 2/210 runs at n = 100 and 22/210 at n = 20. A claim
           that holds at the default and not at the ends is not a claim, and this
           one would have been read straight off the panel. */
        { value: "resp", label: "share",
          detail: "the same fit, not rounded off — every person part one curve, part the other" },
      ],
      default: "cluster",
      display: true,
      when: { param: "sampled" },
    },

    speed: {
      type: "choice", label: "Play speed",
      options: [
        { value: "slow", label: "slow", detail: "both halves of every iteration, slowly" },
        { value: "medium", label: "medium", detail: "both halves, quickly" },
        { value: "fast", label: "fast", detail: "no choreography — results only" },
      ],
      default: "medium",
      display: true,
      when: { param: "sampled" },
    },

    /* THE WITHHELD ANSWER, AND IT SITS BELOW THE DRIVE ROW (3.4e's exception).
       It was the third option of the colour control, and two things were wrong
       with that. A reader met the answer in the setup block before having asked
       a question — reported as confusing. And because a segmented control has
       one selection, choosing it visibly DESELECTED `hard cluster` and `share`,
       which made a reveal look like it had switched the fit off.

       As its own checkbox it composes instead of competing: the fit stays
       whatever you were reading it as, and the truth lies over the top. */
    truth: {
      type: "bool", label: "Show who they really were", default: false,
      display: true, afterDrive: true, when: { param: "sampled" },
    },

    shown: { type: "int", label: "Iterations already run", min: 0, max: MAX_ITERS, default: 0, hidden: true },
  },

  /* THE LABELS SAY "SHARE OF", NOT "THE PEOPLE IT CLAIMS", because the mark is a
     part of a person rather than a person. The earlier wording described a hard
     assignment while the figure drew a soft one — the widget's own misconception
     in its own legend. There is no grey entry any more: the split mark says
     "half and half" by being half and half, which is the thing a colour ramp
     through --ink-3 could never do without also reading as "no data". */
  legend: [
    { token: "group-b", label: "The left curve, and the share of each person it claims", mark: "dot" },
    { token: "group-a", label: "The right curve, and the share it claims", mark: "dot" },
    { token: "reference", label: "The curves they really came from", mark: "line" },
  ],

  compute: ({ params, rng }) => {
    const { childMean, childSd, adultMean, adultSd, n } = params;

    /* Adults first, then children, so the RNG stream does not change shape when
       the slider moves — only the numbers it produces do. */
    const heights = [];
    const truth = []; // 1 = child, matching the share of the LEFT curve
    for (let i = 0; i < n; i += 1) { heights.push(rng.normal(adultMean, adultSd)); truth.push(0); }
    for (let i = 0; i < n; i += 1) { heights.push(rng.normal(childMean, childSd)); truth.push(1); }
    const N = heights.length;

    let lo = Infinity, hi = -Infinity;
    for (const x of heights) { if (x < lo) lo = x; if (x > hi) hi = x; }
    const domain = [Math.floor((lo - 6) / 10) * 10, Math.ceil((hi + 6) / 10) * 10];

    /* THE HISTOGRAM IS IN PEOPLE, NOT DENSITY, and the curves are scaled to
       match. The notebook plots density because ggplot needs it to overlay
       `dnorm`; here it costs an axis of 0.005s for no gain, and 2.3's rule about
       a countable thing applies to a static figure too. Scaling the curves by
       N x binW x w also puts the MIXING WEIGHT on screen as curve height, which
       a density axis normalises away — and the weight is a parameter the M-step
       updates like any other. */
    const binW = BIN_CM;
    const bins = Math.ceil((domain[1] - domain[0]) / binW);

    /* WHERE EACH PERSON SITS IN THE PILE — their column and how many people are
       already stacked under them. Derived once here rather than in `draw`,
       because `draw` runs per frame and because a second copy of this
       arithmetic is how a dot and the count it belongs to come to disagree
       (5.8).

       GROUPED BY TRUE GROUP WITHIN A COLUMN, AND THE SMALLER GROUP GOES AT THE
       BOTTOM. Two separate fixes, and the second is the subtle one.

       Filled by height alone, a person's level within a column was arbitrary
       with respect to group — invisible under `share` and `hard cluster`, where
       a share depends on height so a 5cm column is one flat colour whatever the
       order, but under the truth it scattered blue through the amber columns and
       read as noise.

       Grouping alone is not enough, though. With children always at the bottom,
       the handful of adults in an amber column stack ON TOP, floating twenty
       rows above the blue curve, which is near zero out there — so the mark that
       is supposed to say "this person came from the right-hand curve" sits as
       far from that curve as the panel allows. Reported as confusing, and it is.
       Putting the SMALLER group at the bottom puts those few dots at levels 0-2,
       which is exactly where their own curve is, and it works on both sides
       because the minority in a column is always the group whose curve is low
       there. The majority then reads as the bulk of the pile, which it is.

       IT IS NOT A SPOILER, because the ordering is fixed for the whole run and
       cannot be seen until the truth is asked for. Nothing moves when the
       colouring is toggled, which is what makes the three views the same 200
       people read three ways. */
    const binOf = (x) => Math.max(0, Math.min(bins - 1, Math.floor((x - domain[0]) / binW)));
    const nChild = new Array(bins).fill(0);
    const nAdult = new Array(bins).fill(0);
    for (let i = 0; i < N; i += 1) (truth[i] === 1 ? nChild : nAdult)[binOf(heights[i])] += 1;
    /* Ties go to the children, so the choice is a property of the data rather
       than of the array order — the same reason the heights break ties below. */
    const bottomIsChild = (b) => nChild[b] <= nAdult[b];
    const order = heights.map((_, i) => i).sort((a, b) => {
      const ba = binOf(heights[a]);
      const bb = binOf(heights[b]);
      if (ba !== bb) return ba - bb;
      if (truth[a] !== truth[b]) {
        const aIsBottom = (truth[a] === 1) === bottomIsChild(ba);
        return aIsBottom ? -1 : 1;
      }
      return heights[a] - heights[b];
    });
    const filled = new Array(bins).fill(0);
    const slots = new Array(N);
    for (const i of order) {
      const b = binOf(heights[i]);
      slots[i] = { b, level: filled[b] };
      filled[b] += 1;
    }
    const histMax = Math.max(...filled);
    const scale = N * binW; // a density, read as people per bin

    /* THE GUESS. "Start with an initial guess for the parameters. This could be
       random" — the lesson's first bullet, and the lead button is that bullet.
       Both means land in the middle two thirds of the data with a gap between
       them, and both spreads start far too wide, so the first M-step is a long
       move and the figure has somewhere to travel from. Deliberately poor, and
       it does not matter: see the header on why the start is not the subject. */
    const span = hi - lo;
    const guess = orderLeftFirst({
      m1: lo + span * rng.uniform(0.18, 0.42),
      m2: lo + span * rng.uniform(0.58, 0.82),
      s1: span / 6,
      s2: span / 6,
      w: 0.5,
    });

    /* THE WHOLE TRAJECTORY, COMPUTED ONCE. `compute` is pure and seeded and runs
       on parameter change only (invariant 2), so the animation is a reveal of
       this array and lands exactly where the seed promises. Each entry holds the
       E-step's output and then the M-step's, in that order — which is the order
       one press plays them in. */
    const steps = [];
    let p = guess;
    for (let it = 0; it < MAX_ITERS; it += 1) {
      const resp = new Float64Array(N);
      for (let i = 0; i < N; i += 1) resp[i] = shareOfLeft(heights[i], p);

      const next = maximize(heights, resp);
      if (!next) break;
      const ordered = orderLeftFirst(next);

      let wrong = 0, ambig = 0;
      for (let i = 0; i < N; i += 1) {
        if ((resp[i] > 0.5) !== (truth[i] === 1)) wrong += 1;
        if (resp[i] > 0.2 && resp[i] < 0.8) ambig += 1;
      }

      const move = moveOf(p, ordered);
      steps.push({ resp, p: ordered, wrong, ambig, move });
      p = ordered;
      if (move < TOL) break;
    }

    /* THE AXIS IS FIXED FOR THE WHOLE RUN (2.5). Taken over the histogram and
       every curve the trajectory will ever draw, including the guess, so a
       narrow intermediate component cannot rescale the panel underneath a
       reader who is watching two curves move. */
    let yMax = histMax;
    for (const q of [guess, ...steps.map((s) => s.p)]) {
      yMax = Math.max(yMax,
        scale * q.w * normalPdf(q.m1, q.m1, q.s1),
        scale * (1 - q.w) * normalPdf(q.m2, q.m2, q.s2));
    }

    return {
      N, heights, truth, domain, binW, bins, slots, scale,
      guess, steps, yMax: yMax * 1.08,
      childMean, childSd, adultMean, adultSd,
    };
  },

  animation: {
    /* THE LEAD IS THE LESSON'S FIRST BULLET. It is not a near-synonym of Iterate
       (3.4c): one guesses, the other refits, and the guess happens once. Unlike
       widget 3's, this lead greying out teaches nothing on its own — you CAN go
       back and guess again, by moving the seed — and it earns its place instead
       by making initialisation a visible event rather than a state the figure
       is simply found in. */
    /* "Start" for a long time — the only lead in the arc naming no act (3.4c).
       Guessing is the act: two curves put down knowing nothing. */
    leadLabel: "Guess two curves",
    leadTitle: "Take the labels away and put two curves down at random",
    leadHint: "Iterate and Play wake up once the labels are gone.",
    stepLabel: "Iterate",
    stepTitle: "One E-step and one M-step: re-weigh every person, then refit both curves",
    runLabel: "Play",
    runTitle: "Iterate to convergence",

    init({ params, state, fromScratch, leadDone }) {
      const anim = {
        /* Set on every init and acted on by exactly one caller: core plays it
           only when the GATE opens, so on a page load that already has
           `sampled=1` it is inert and the figure is simply there. That is what
           keeps a shared link, and every fingerprint state, free of it. */
        entry: Boolean(params.sampled),
        /* LANDED UNLESS SOMETHING STARTS IT FALLING. Keying this off
           `fromScratch` looked right and was wrong: Replay re-inits with
           fromScratch true and nothing plays an entry, so the pile froze
           halfway out of the curves. `entry` is the one-shot trigger instead —
           core starts the mode, and `advance` consumes the flag and resets the
           clock on its first frame. Every other path leaves it at 1. */
        dropT: 1,
        leadDone: Boolean(leadDone),
        leadT: leadDone ? 1 : 0,
        /* `done` iterations are complete and at rest. `phase` and `phaseT`
           describe the one in flight: 'e' moves panel B, 'm' moves panel A. */
        iters: 0,
        phase: null,
        phaseT: 1,
        done: false,
      };
      /* CLAMPED AGAINST THE TRAJECTORY THAT EXISTS, not against MAX_ITERS. The
         run stops at TOL, so how many iterations there ARE depends on the data
         — and an authored `?shown=` that outran it indexed off the end of the
         array. Same clamp widget 8 puts on its cursor, for the same reason. */
      const total = state.steps.length;
      const pre = fromScratch ? 0 : Math.min(Math.max(0, params.shown | 0), total);
      if (pre > 0) {
        anim.leadDone = true;
        anim.leadT = 1;
        anim.iters = pre;
        anim.done = pre >= total;
      }
      return anim;
    },

    advance(anim, { dt, params, state }) {
      /* The stage playing itself in. It ends by returning false, so the loop
         stops on its own and the drive row is untouched — nothing has been
         driven, and Play still says Play. */
      if (anim.mode === "enter") {
        if (anim.entry) { anim.entry = false; anim.dropT = 0; }
        if (anim.dropT >= 1) return false;
        anim.dropT = Math.min(1, anim.dropT + dt / DROP_MS);
        return anim.dropT < 1;
      }
      if (anim.mode === "lead") {
        if (anim.leadDone) return false;
        anim.leadT = Math.min(1, anim.leadT + dt / 520);
        if (anim.leadT < 1) return true;
        anim.leadDone = true;
        return false;
      }
      if (!anim.leadDone || anim.done) return false;

      const total = state.steps.length;
      if (anim.iters >= total) { anim.done = true; return false; }

      const dur = anim.mode === "step" ? STEP_MS : RUN_MS[params.speed];

      /* A phase in flight finishes first. At `fast` the duration is zero, so a
         phase completes within the frame it started and one frame is half an
         iteration — the choreography is off, the sequence is not. */
      if (anim.phase) {
        anim.phaseT = dur > 0 ? clamp01(anim.phaseT + dt / dur) : 1;
        if (anim.phaseT < 1) return true;
        if (anim.phase === "e") {
          anim.phase = "m";
          anim.phaseT = dur > 0 ? 0 : 1;
          if (dur > 0) return true;
        }
        // The M-step has landed: the iteration is complete.
        anim.phase = null;
        anim.iters += 1;
        anim.phaseT = 1;
        if (anim.iters >= total) { anim.done = true; return false; }
        if (anim.mode === "step") return false;
        return true;
      }

      anim.phase = "e";
      anim.phaseT = dur > 0 ? 0 : 1;
      return true;
    },
  },

  draw: ({ ctx, colors, w, h, params, state, anim }) => {
    const { heights, truth, domain, binW, bins, slots, scale, steps, N } = state;
    const plotW = w - PAD_L - PAD_R;
    const sampled = Boolean(params.sampled);

    /* WHAT IS ON SCREEN RIGHT NOW, and both halves come from the trajectory
       rather than from anything recomputed here. `curves` is what the two
       normals are; `share` is what each person is worth to the left one.
       Between them they are the entire animation.

         phase 'e'   curves held at the last M-step, shares moving to the new
         phase 'm'   shares held at the new E-step, curves sliding to meet them
         at rest     both at iteration `iters`

       BEFORE THE FIRST E-STEP EVERY SHARE IS 0.5, and that is not a placeholder
       — with no responsibilities yet, every person is exactly as much one curve
       as the other, which is why the pile starts one flat colour. */
    const i = anim.iters;
    const prev = i === 0 ? state.guess : steps[i - 1].p;
    const cur = steps[Math.min(i, steps.length - 1)];
    const inFlight = anim.phase && i < steps.length;
    const t = easeInOut(clamp01(anim.phaseT));

    let curves = prev;
    if (inFlight && anim.phase === "m") {
      curves = {
        m1: lerp(prev.m1, cur.p.m1, t), s1: lerp(prev.s1, cur.p.s1, t),
        m2: lerp(prev.m2, cur.p.m2, t), s2: lerp(prev.s2, cur.p.s2, t),
        w: lerp(prev.w, cur.p.w, t),
      };
    }

    const settled = i > 0 ? steps[i - 1].resp : null;
    const share = (k) => {
      if (!anim.leadDone) return null;
      if (inFlight && anim.phase === "e") return lerp(settled ? settled[k] : 0.5, cur.resp[k], t);
      if (inFlight) return cur.resp[k];
      return settled ? settled[k] : 0.5;
    };
    const shown = i > 0 ? steps[i - 1] : null;

    /* HAS ANYTHING BEEN WEIGHED YET. Below this the people are grey, and — the
       part that was a bug — the TRUTH IS NOT REVEALED EITHER, however the
       checkbox is set. `truth` is display-only and therefore sticky, so after a
       population change it stayed ticked and the true curves stayed on screen
       over a figure that had just been reset to nothing. Reported as "the true
       curves remain". They are a reference behind a RESULT; with no result
       there is nothing for them to be behind, and they come back by themselves
       the moment the first E-step runs. */
    const weighed = sampled && anim.leadDone && (i > 0 || inFlight);
    const showTruth = weighed && Boolean(params.truth);

    const plot = makePlot({
      ctx, colors,
      rect: { x: PAD_L, y: PANEL_Y, w: plotW, h: PANEL_H },
      xDomain: domain,
      yDomain: [0, state.yMax],
    });
    const ticks = niceTicks(0, state.yMax, 4);
    plot.grid(ticks);
    plot.axisY({ ticks, label: `people per ${fmt(binW, binW % 1 ? 1 : 0)} cm` });
    plot.axisX({ label: "height (cm)" });

    /* THE TRUE CURVES, BEHIND EVERYTHING. Drawn first so the fitted pair and
       the pile sit over them: they are the answer being checked against, not
       a result. */
    const curveOf = (m, s, weight) => {
      const pts = [];
      const STEPS = 200;
      for (let k = 0; k <= STEPS; k += 1) {
        const x = domain[0] + ((domain[1] - domain[0]) * k) / STEPS;
        pts.push([x, scale * weight * normalPdf(x, m, s)]);
      }
      return pts;
    };
    /* THE TWO CURVES THE PEOPLE REALLY CAME FROM. Solid and in their own colours
       while the populations are being set, because at that point they are not a
       spoiler — they are the thing under the sliders and nothing else is on
       screen. Dashed and recessive when `true group` brings them back, because
       by then they are a reference behind a result. */
    const dropT = clamp01(anim.dropT ?? 1);
    const landing = sampled && dropT < 1;
    if (!sampled || landing) {
      /* They fade as the people fall out of them: by the time the pile has
         landed the curves that made it are gone, which is the same act as the
         labels coming off. */
      const a = landing ? 1 - easeInOut(dropT) : 1;
      plot.curve(curveOf(state.childMean, state.childSd, 0.5), { stroke: colors.groupB, width: 2.5, opacity: a });
      plot.curve(curveOf(state.adultMean, state.adultSd, 0.5), { stroke: colors.groupA, width: 2.5, opacity: a });
    }
    if (sampled && showTruth) {
      plot.curve(curveOf(state.childMean, state.childSd, 0.5),
        { stroke: colors.reference, width: 1.5, dash: [5, 4] });
      plot.curve(curveOf(state.adultMean, state.adultSd, 0.5),
        { stroke: colors.reference, width: 1.5, dash: [5, 4] });
    }

    /* ONE PERSON, ONE DOT, STACKED WHERE THEY LAND — the lesson's own E-step
       and M-step figures, which draw the sample as coloured dots along the
       height axis with the two curves above them.

       THIS REPLACED A SECOND PANEL PLOTTING SHARE AGAINST HEIGHT. That panel
       was exact and it was an S-curve, which is a shape the lesson never draws
       and which costs a paragraph to explain before it can be read at all. The
       pile says the same thing in the representation a reader arrives with:
       the E-step is the dots changing colour, the M-step is the curves moving,
       and nothing else in the frame moves during either. It also stops the
       figure showing the same 200 people twice.

       The radius follows the tighter of the column width and the row pitch, so
       a pile 30 deep stays countable and one 8 deep does not turn into blobs. */
    /* THE RADIUS IS BOUND BY THE TIGHTER OF THE COLUMN AND THE ROW, and the cap
       is 7.5 rather than 5 because the mark now has to show a FRACTION. At r=5
       a 55/45 split is a two-pixel offset; at 7.5 it is three, and the
       difference between "mostly amber" and "half and half" is what the figure
       is for. The cap still binds only in the widest layout — at the 900px the
       harness records, the column is 14px and the radius comes out at 5.8. */
    const band = plotW / bins;
    const pitch = PANEL_H / state.yMax;
    const r = Math.max(1.6, Math.min(7.5, band * 0.40, pitch * 0.40));
    /* NO PEOPLE UNTIL THEY HAVE BEEN DRAWN. The populations stage is two curves
       and nothing else, which is what makes pressing the gate an event. */
    if (sampled) for (let k = 0; k < N; k += 1) {
      const s = share(k);
      /* ONE MARK, THREE FILLS, and the three colourings differ ONLY in what
         fraction they hand it. `share` gives the fraction itself; the other two
         round it off, one to the argmax and one to the withheld truth — so a
         solid dot in either of those views is visibly the same mark with the
         gradation thrown away, which is the comparison the widget is for.

         UNDER `truth` THE WRONG ONES NEED NO EXTRA MARK. An amber dot sitting
         inside the right-hand curve's territory IS a child EM handed to the
         adults; the encoding says so and the note counts them. A --c-extreme
         ring was drawn round each one first and it buried the reading it was
         meant to support: with a seventh of the pile ringed, the rings were what
         the eye followed and the two group colours disappeared underneath. */
      const trueF = truth[k] === 1 ? 1 : 0;
      /* THREE PHASES BEFORE THE COLOUR CONTROL GETS A SAY, and they are the
         lesson's two figures with the transition between them drawn.

           setting up   the two groups you chose, in their own colours
           the lead     those colours dissolving to half and half
           first guess  half and half, because nothing has been weighed yet

         BEFORE THE LEAD THE COLOUR CONTROL IS OVERRIDDEN, deliberately: at that
         point the groups are not EM's guess about anything, they are the two
         populations the reader just set with four sliders, and painting them
         `hard cluster` would be reporting a fit that does not exist. It also
         gives the lead something real to do — the labels going away IS the
         premise, and a button that removes them earns being pressed once and
         then greying out, which the old "guess two curves" never did.

         THE DISSOLVE NEEDS NO COLOUR MIXING. The mark already carries a
         fraction, so a child at f = 1 and an adult at f = 0 both travelling to
         0.5 is the whole animation, and it lands exactly on the state the first
         E-step starts from. An earlier version faded each dot towards --ink-3
         and that read as the data being deleted rather than relabelled. */
      /* GREY UNTIL THE FIRST E-STEP, and that is the honest state rather than a
         placeholder: between the sample landing and the first Iterate there are
         no responsibilities at all, so there is nothing for the mark to be a
         fraction OF. It also keeps one button to one visible change — Draw a
         sample puts people on screen, Start puts curves on screen, and Iterate
         is the first thing that colours anybody.

         An earlier build dissolved true colours into half-and-half across the
         lead. That answered a different question, from a flow where the dots
         existed before the sample did. */
      const f = !weighed ? 0
        : showTruth ? trueF
        : params.colour === "cluster" ? (s > 0.5 ? 1 : 0)
        : s;
      const tone = weighed ? colors.groupA : colors.ink3;

      /* WHERE THIS PERSON IS RIGHT NOW. At rest it is their slot. While the
         sample is landing they are somewhere between the curve that generated
         them and that slot — so a dot leaves the amber curve if a child drew
         it and the blue one if an adult did, which is the only moment the
         figure ever says where a person came from without being asked.

         Staggered by how high they land, so the piles fill from the bottom.
         Eased IN rather than out: a falling thing accelerates (4.3), and the
         earlier version eased out and read as dots being lowered on strings. */
      const level = slots[k].level;
      const x = domain[0] + (slots[k].b + 0.5) * binW;
      let y = level + 0.5;
      if (landing) {
        const lag = DROP_LAG * (level / Math.max(1, state.yMax));
        const t = clamp01((dropT - lag) / Math.max(0.01, 1 - lag));
        const from = scale * 0.5 * normalPdf(x, truth[k] === 1 ? state.childMean : state.adultMean,
          truth[k] === 1 ? state.childSd : state.adultSd);
        y = lerp(from, y, t * t);
      }
      splitDot(ctx, plot.sx(x), plot.sy(y),
        r, f, tone, weighed ? colors.groupB : colors.ink3, colors.surface);
    }

    /* The fitted pair, over the pile they are being fitted to. */
    if (sampled && anim.leadDone) {
      const a = easeInOut(clamp01(anim.leadT));
      plot.curve(curveOf(curves.m1, curves.s1, curves.w),
        { stroke: colors.groupB, width: 2.5, opacity: a });
      plot.curve(curveOf(curves.m2, curves.s2, 1 - curves.w),
        { stroke: colors.groupA, width: 2.5, opacity: a });
    }

    /* ONE CAPTION AND ONE NOTE, because one panel has room for one of each and
       the counts already live in the stat tiles. The note is the only thing
       that says which half of the iteration just ran, so it says nothing else. */
    /* THE CAPTION NAMES WHAT IS ACTUALLY DRAWN, and there are three answers
       because there are three stages. It said "Two curves, and the people they
       are claiming" throughout, which is a lie at both ends: before the sample
       there are no people, and between the sample and Start there are no
       curves. A caption that describes a mark the frame does not contain is the
       same defect as a claim that is false on the first press. */
    plot.caption(!sampled ? "Two populations, and nobody sampled from them yet"
      : !anim.leadDone ? "One pile of people, and no idea who is who"
      : "Two curves, and the people they are claiming");
    if (!sampled) {
      plot.note("set them, then draw a sample");
    } else if (!anim.leadDone) {
      plot.note("no labels — nobody knows who was which");
    } else if (i === 0 && !inFlight) {
      plot.note("two curves, guessed at random — nobody weighed yet");
    } else if (inFlight && anim.phase === "e") {
      plot.note("E-step: re-weigh every person", { tone: colors.highlight });
    } else if (inFlight) {
      plot.note("M-step: refit both curves to those shares", { tone: colors.highlight });
    } else {
      plot.note(`after ${i} iteration${i === 1 ? "" : "s"}`);
    }
  },
  readout: ({ params, state, anim }) => {
    const { steps, N } = state;
    if (!params.sampled) {
      /* THE POPULATIONS STAGE REPORTS THE TRUTH, because at that point it is not
         an answer to anything — it is the setting the reader just dialled in,
         and the tile is the only place the four numbers appear together. From
         the sample onwards the same tile reports the ESTIMATE against them,
         which is the comparison the widget exists to make. */
      return [
        {
          label: "The populations",
          value: `${state.childMean} ± ${state.childSd} and ${state.adultMean} ± ${state.adultSd} cm`,
          note: "what you have set — a sample has not been drawn from them",
        },
        { label: "The individuals", value: "—", note: `${N} people, once you draw them` },
      ];
    }
    if (!anim.leadDone) {
      return [
        { label: "The populations", value: "—", note: "nothing estimated yet" },
        { label: "The individuals", value: "—", note: `${N} heights, and no labels` },
      ];
    }

    const i = anim.iters;
    const p = i > 0 ? steps[i - 1].p : state.guess;
    const shown = i > 0 ? steps[i - 1] : null;

    return [
      {
        /* ADJACENCY, NOT ARITHMETIC (2.7). The fitted pair sits next to the true
           pair and the reader does the comparison by looking. Naming them left
           and right is deliberate: EM does not know which is the children, and
           finding that out is what the truth option is for.

           FOUR NUMBERS, BECAUSE parameters(em_result) RETURNS FOUR. Cell 32
           names its rows "mean" and "sd" and its columns 1 and 2; a tile that
           reported only the means would be showing half of what the lesson
           pulls out of the fit, and the spread is the parameter a mixture is
           actually interesting about — it is what decides how far each curve
           reaches into the other's territory. */
        label: "The populations",
        value: `${fmt(p.m1, 0)} ± ${fmt(p.s1, 0)} and ${fmt(p.m2, 0)} ± ${fmt(p.s2, 0)} cm`,
        note: `${i === 0 ? "a random guess — " : ""}the children are `
          + `${state.childMean} ± ${state.childSd}, the adults ${state.adultMean} ± ${state.adultSd}`,
      },
      {
        /* BOTH HALVES HAVE TO READ AT ZERO, and both reach it: at an adult mean
           of 220 the hard labels can be perfect, and a clean separation can
           leave nothing at all in the middle band. "0 of 40 in the wrong group"
           and "0 more sit between .2 and .8 — no group really" were the strings
           that state produced, and the second one describes no people. */
        label: "The individuals",
        value: !shown ? "—"
          : shown.wrong === 0 ? `none of ${N} in the wrong group`
          : `${shown.wrong} of ${N} in the wrong group`,
        note: !shown ? "nobody has been weighed yet"
          : shown.ambig === 0 ? "and every share is past .8 or under .2"
          : shown.ambig === 1 ? "and one more sits between .2 and .8 — in no group really"
          : `${shown.ambig} more sit between .2 and .8 — no group really`,
      },
    ];
  },
});
