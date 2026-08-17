/* ============================================================================
   A pile: a distribution being built one value at a time.

   Four of the six widgets in the statistics arc accumulate a statistic into a
   growing distribution — the sampling distribution of a mean, a bootstrap
   distribution, a permutation null, and twenty thousand permutation nulls. They
   differ entirely in where the values come from and not at all in what happens
   once a value arrives, so that second half lives here.

   What a pile owns:
     - counts over equal-width bins, and the running sum / sum of squares
     - the count-axis ceiling, ratcheted upward only so it never jitters
     - the dot-plot-to-histogram crossfade, so a single arrival is a visible dot
       rather than a two-pixel bar
     - the smoothed density of what has arrived so far
     - the landing flash

   What a pile does NOT own: how a value is produced, and the choreography that
   shows it being produced. Those are the part that actually differs between
   widgets, and they stay in the widget. (Resisted extracting the CLT's
   draw/collapse/drop as well — a Galton ball descending row by row has a wholly
   different shape, and abstracting over one example would have been a guess.)

   Usage inside an animation:

       init({ params, state }) {
         return { pile: createPile({ ...state.binning, headroomFor }), done: false };
       }
       advance(anim, { dt }) { anim.pile.tick(dt); ... anim.pile.push(value); }
       draw({ ctx, colors, state, anim }) {
         const f = anim.pile.frame();
         const pb = makePlot({ ..., yDomain: [0, f.yMax] });
         anim.pile.draw(pb, f, { colors, smooth: params.smooth });
       }
   ========================================================================= */

import { normalPdf } from "./stats.js";

/* The count at which individual arrivals stop being countable, and the axis
   ceiling held until then — paired with DOT_R so that stacked dots very nearly
   touch in a panel of the usual height. */
export const DOT_FROM = 30;
export const DOT_TO = 50;
export const DOT_CEIL = 14;
export const DOT_R = 6;

/* The smoothed density earns its place much earlier than any theoretical curve:
   watching it lurch with every new value IS the lesson, so it has to be visible
   while a student is still adding values one at a time. */
export const SMOOTH_FROM = 4;
export const SMOOTH_TO = 10;

export const FLASH_MS = 420;

const clamp01 = (t) => Math.max(0, Math.min(1, t));

/** 0 = pure dot plot, 1 = pure histogram. */
export const barMixFor = (total) => clamp01((total - DOT_FROM) / (DOT_TO - DOT_FROM));
export const smoothMixFor = (total) => clamp01((total - SMOOTH_FROM) / (SMOOTH_TO - SMOOTH_FROM));

// Fine enough that a peak of 50 gives a ceiling of 60 rather than 100 — a coarse
// 1/2/5 ladder wastes half the panel at the worst moment.
const NICE_STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

export function niceCeil(v) {
  if (!(v > 0)) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  for (const s of NICE_STEPS) if (n <= s + 1e-9) return s * mag;
  return 10 * mag;
}

/**
 * @param bins        number of equal-width bins
 * @param lo          left edge of the first bin
 * @param width       bin width
 * @param headroomFor (total) => extra height in COUNT units that an overlay
 *                    needs at that total, so the axis leaves room for it.
 *                    Called on every push; keep it cheap.
 */
export function createPile({ bins, lo, width, headroomFor = () => 0 }) {
  const hi = lo + bins * width;

  const pile = {
    bins,
    lo,
    width,
    counts: new Array(bins).fill(0),
    shown: 0,
    sum: 0,
    sumsq: 0,
    maxCount: 0,
    yMax: DOT_CEIL,
    flashBin: -1,
    flashAge: FLASH_MS,

    /** Bin index for a value, or -1 if it falls outside the plotted window. */
    binOf(v) {
      if (v < lo || v > hi) return -1;
      const i = Math.min(bins - 1, Math.floor((v - lo) / width));
      return i >= 0 ? i : -1;
    },

    /** Centre of a bin, for placing a landing marker. */
    centreOf(i) {
      return lo + (i + 0.5) * width;
    },

    push(v) {
      const bin = pile.binOf(v);
      if (bin >= 0) {
        pile.counts[bin] += 1;
        if (pile.counts[bin] > pile.maxCount) pile.maxCount = pile.counts[bin];
        pile.flashBin = bin;
        pile.flashAge = 0;
      }
      // Values outside the plotted window still count toward the statistics.
      // They are simply not drawn — the same treatment a histogram gives them.
      pile.sum += v;
      pile.sumsq += v * v;
      pile.shown += 1;

      // Ratcheted on every push, not once per paint: the DOT_CEIL floor only
      // applies while the crossfade is incomplete, so the ceiling genuinely
      // depends on the sequence of totals passed through, not just the last one.
      const want = requiredYMax(pile.shown, pile.maxCount, headroomFor(pile.shown));
      if (want > pile.yMax) pile.yMax = want;
      return bin;
    },

    /**
     * Re-derive from a list of values. For display-parameter changes that alter
     * the binning (rescaling an axis) without altering the data — the student's
     * work is preserved because the invariant is how many values they have
     * added, and everything else is replayed from that.
     */
    rebuild(values) {
      pile.counts = new Array(bins).fill(0);
      pile.shown = 0;
      pile.sum = 0;
      pile.sumsq = 0;
      pile.maxCount = 0;
      pile.yMax = DOT_CEIL;
      for (const v of values) pile.push(v);
      pile.clearFlash();
    },

    tick(dt) {
      pile.flashAge += dt;
    },

    /** A landing flash is a cue for motion; a frozen one reads as a marked bar. */
    clearFlash() {
      pile.flashBin = -1;
      pile.flashAge = FLASH_MS;
    },

    get mean() {
      return pile.shown ? pile.sum / pile.shown : NaN;
    },

    /** Sample standard deviation of everything pushed so far. */
    get sd() {
      if (pile.shown < 2) return NaN;
      // Clamped: the sum-of-squares form can go slightly negative on cancellation.
      const v = Math.max(0, (pile.sumsq - (pile.sum * pile.sum) / pile.shown) / (pile.shown - 1));
      return Math.sqrt(v);
    },

    /** Per-paint derived values: axis ceiling and the two crossfade weights. */
    frame() {
      return {
        yMax: pile.yMax,
        barMix: barMixFor(pile.shown),
        smoothMix: smoothMixFor(pile.shown),
        total: pile.shown,
      };
    },

    /**
     * Gaussian kernel density of what has arrived, in the same expected-count
     * units as the bars, so it is directly comparable to a theoretical overlay.
     *
     * Built by convolving the BINNED counts rather than the raw values, so the
     * cost is bins x grid (~10k) instead of values x grid (~600k) and it holds
     * sixty frames a second. Bandwidth follows Silverman, floored at three
     * quarters of a bin so it cannot go spiky enough to imply structure the
     * binning has already smoothed away.
     */
    kde(domain, steps = 200) {
      const sdHat = pile.sd;
      const h = Math.max(
        0.75 * width,
        0.9 * (sdHat || width) * Math.pow(Math.max(pile.shown, 1), -0.2)
      );
      const pts = [];
      for (let g = 0; g <= steps; g += 1) {
        const x = domain[0] + ((domain[1] - domain[0]) * g) / steps;
        let f = 0;
        for (let i = 0; i < bins; i += 1) {
          const c = pile.counts[i];
          if (!c) continue;
          f += c * normalPdf(x, pile.centreOf(i), h);
        }
        pts.push([x, f * width]);
      }
      return pts;
    },

    /**
     * Draw the pile: bars and/or dots with the crossfade, the landing flash, and
     * the smoothed density. The caller still owns the grid, the axes and any
     * theoretical overlay — those carry widget-specific meaning.
     */
    draw(plot, f, { colors, smooth = true, maxR = DOT_R } = {}) {
      const opts = { lo, width, fill: colors.empirical };

      if (f.barMix > 0) plot.bars(pile.counts, { ...opts, opacity: f.barMix });
      if (f.barMix < 1) plot.dotColumns(pile.counts, { ...opts, opacity: 1 - f.barMix, maxR });

      if (pile.flashBin >= 0 && pile.flashAge < FLASH_MS) {
        const one = new Array(bins).fill(0);
        one[pile.flashBin] = pile.counts[pile.flashBin];
        const fade = 1 - pile.flashAge / FLASH_MS;
        const hot = { lo, width, fill: colors.highlight };
        if (f.barMix > 0) plot.bars(one, { ...hot, opacity: fade * f.barMix });
        if (f.barMix < 1) plot.dotColumns(one, { ...hot, opacity: fade * (1 - f.barMix), maxR });
      }

      if (smooth && f.smoothMix > 0 && pile.shown > 1) {
        plot.curve(pile.kde(plot.xDomain), {
          stroke: colors.smoothed,
          width: 2,
          opacity: f.smoothMix,
        });
      }
      return pile;
    },
  };

  return pile;
}

/**
 * The count-axis ceiling. Held at DOT_CEIL through the dot phase so the axis does
 * not move while individual values are arriving, then stepped up in nice
 * increments — never down, so it cannot jitter frame to frame.
 */
function requiredYMax(total, maxCount, headroom) {
  const barMix = barMixFor(total);
  return Math.max(barMix < 1 ? DOT_CEIL : 1, niceCeil(Math.max(maxCount, headroom) * 1.12));
}
