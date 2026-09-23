/* cell-qc — Single-Cell RNA-seq: QC (PHM5003 08 / 02-2 cells 16–26)
 *
 * THE MISCONCEPTION: the three thresholds are universal numbers, a low count
 * is a dead cell and a high mitochondrial percentage is a dying one. The
 * lesson's own 40,564 cells say otherwise, and `_lab/cell-qc-measure.mjs`
 * reads them: mitochondrial percentage there is a property of the SAMPLE, not
 * of a cell type — inside the one that runs high every marker group sits at
 * 12–15%, and the same tissue in the other patient sits at 0.1% — so one
 * number applied to four samples removes 85% of one of them and nothing from
 * the rest. Two mechanisms hide under one word: a dying cell keeps its
 * mitochondria while the rest of its RNA goes, so its percentage rises as its
 * count falls; ambient RNA from cells that broke during the preparation lands
 * in every droplet, so it raises a whole sample and leaves it flat across the
 * counts. And two of the three rules are one rule: 84% of the cells either
 * count rule removes fail both.
 *
 * TWO PAGES, Metrics · Thresholds. Four metrics are measured on the first and
 * four rules applied on the second — his round 4 (2026-09-23), after the
 * doublet step arrived on a page of its own and "looks weird as it stands
 * out ... unless it is part of the metric? then we threshold everything in
 * the next page?" The shape was three pages at planning and was streamlined
 * to two at his round 2: "for threshold, don't need to step, the graph
 * shows dynamically when we change sliders" and "maybe we don't need cell's
 * kept page? could the cluster plot be put under threshold". Both are right,
 * and the second is the stronger figure: the map is now beside the bar under
 * the same sliders, a removed droplet is GONE rather than hollow, and
 * dragging the mitochondrial rule from 30 to 5 empties the hepatocyte cluster
 * while the other five stay — a universal threshold deleting a population
 * from the pooled data, in one drag. The stage is simulated and FITTED to the real
 * cells rather than shaped to resemble them (`./engine.js`): nFeature is not
 * drawn but is how many genes are seen when the droplet's molecules are drawn
 * from its own profile, and mt% is mitochondrial over total — so the overlap
 * between the count rules, the negative correlation and the recovery curve
 * all come back without being written anywhere.
 *
 * NOTHING IS DRIVEN. The three rules apply as the sliders move, so the widget
 * declares an animation for its EASES alone and marks it inert, which takes
 * Step out of the drive row. The walkthrough it replaces (genes, then
 * transcripts, then mitochondrial percentage, one press each) made the
 * argument that two of the three rules are one rule — the second press took
 * thirteen droplets after the first took a hundred and twenty — and that
 * argument now lives where it also holds still: the bar's three segments, the
 * crossing lines on the Metrics scatter, and the readout's own count.
 *
 * THE THRESHOLDS ARE DISPLAY PARAMETERS. They change which droplets are kept
 * and no droplet's numbers. The data parameters are the ones that change the
 * droplets themselves — the seed and which sample carries ambient RNA.
 *
 * THE STAGE IS CACHED by its data parameters, as widget 73's trained models
 * are: a slider tick must not redraw 1,600 droplets from 8,000 genes each.
 */
import { defineWidget, fmt, makePlot } from "../core/index.js";
import { makeRng } from "../core/rng.js";
import { simulate, confusion, profileOf, doubletScores, projectProfile, median, DOUBLET, TYPES, SAMPLES } from "./engine.js";

const PAGES = [
  { value: "metrics", label: "Metrics" },
  { value: "thresholds", label: "Thresholds" },
];
/* the Metrics page is taller when its four panels take two rows; core hands a
   height function the width for exactly this (widget 60's is the precedent) */
const HEIGHTS = { thresholds: 400 };
const EASE_MS = 450;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
const log10 = (v) => Math.log10(Math.max(1, v));
const RULES = ["genes", "transcripts", "mt", "doublet"];
const RULE_NAME = {
  genes: "too few genes", transcripts: "too few transcripts",
  mt: "too high a mitochondrial %", doublet: "called a doublet",
};
/* The fourth rule's own settings. One artificial doublet per droplet is
   scDblFinder's own default ("roughly as many artificial doublets as there
   are cells, which is usually appropriate"); at ratio 2 every ordinary cell's
   score rises with them (median 0.42 against 0.26) and the line has to move
   to follow, which teaches the arbitrariness rather than the method. Fifty
   neighbours over eleven hundred droplets is 21 ms, so the call can be
   dragged.

   POOLED, against both tools' own rule of one sample at a time, and the
   reason is this stage's size rather than the rule. Measured: at 400 droplets
   a sample the per-lane cloud of artificial doublets is too thin and the
   method finds 34 of 49 where pooling finds 49; at 1,200 it is 113 against
   122; at 3,000, near a real lane, 250 against 258. The rule exists because
   pairing cells from samples that hold DIFFERENT populations invents doublets
   that cannot exist — and every sample here holds the same six, so pooling
   invents nothing. A stage that can show the rule is slot 80's, where a
   population sits in one batch only. */
const DBL_OPTIONS = ["none", "0.9", "0.8", "0.7", "0.6", "0.5"];

/* the three the sequencer hands you, in the order the lesson prints them
   (cell 19), and the fourth that takes every other droplet to work out */
const METRICS = [
  { key: "nFeature", name: "Genes detected", log: true },
  { key: "nCount", name: "Transcripts", log: true },
  { key: "mt", name: "Mitochondrial %", log: false },
  { key: "score", name: "Doublet score", log: false, derived: true },
];

/* the two scatters of cell 22, hoisted beside the metrics because `derive`
   works out their domains and `hoverAt` reads them back: one geometry for the
   drawing and the hit test (5.8) */
const SCATTERS = [
  { xk: "nCount", yk: "nFeature", ylog: true, caption: "Genes against transcripts", note: "one point a droplet" },
  { xk: "nCount", yk: "mt", ylog: false, caption: "Mitochondrial % against transcripts", note: "the same droplets" },
];

const SAMPLE_OPTIONS = [
  { value: "none", label: "None" },
  ...SAMPLES.map((s) => ({ value: s.key, label: s.name })),
];
const shortName = (key) => (SAMPLES.find((s) => s.key === key)?.name ?? "").replace("Patient ", "P");

/* --- the stage, memoised by the parameters that draw it ---------------------
   compute() stays pure and seeded: the key holds every input, and the value is
   rebuilt whenever one of them moves. What it saves is the 8,000-gene draw per
   droplet, which a threshold slider must not pay for. */
let cached = { key: null, value: null };
function stageFor(seed, hot, hotMt) {
  const key = `${seed}|${hot}|${hotMt}`;
  if (cached.key === key) return cached.value;
  const sim = simulate(makeRng(seed), { hot, hotMt });
  /* ONE MEASUREMENT A DROPLET. Its six block fractions are read once, the map
     is that reading projected, and the doublet score counts neighbours in it —
     so a droplet's place and its company are the same fact seen twice. */
  const rng = makeRng(seed * 7919 + 13);
  const prof = sim.cells.map((c) => profileOf(rng, c));
  cached = { key, value: { cells: sim.cells, prof, pos: prof.map(projectProfile) } };
  return cached.value;
}

/* --- geometry, above defineWidget: the module draws once at load ------------ */
const PAD = { l: 52, r: 16, t: 26 };
/* THREE BANDS, ONE CONCEPT EACH (his round 12, and layout E of
   `_lab/cell-qc-bands-mock.html`). His words: "1) violin genes/transcripts ->
   genes x transcripts. 2) violin mito -> mito x transcripts. 3) violin
   doublet -> spider + scores", because "my eye is just wandering everywhere
   seeing which graphs are referring to the same concept".

   Each band reads left to right — the distributions first, then what they
   are plotted against — under a rule and a heading of its own. Four violins
   in one row and two scatters in another put a panel four hundred pixels from
   the panel about the same number, with six others in between.

   THE FLOORS BELOW WERE MEASURED, not chosen: the mock printed the width of
   every line each panel has to fit, in the widget's own type. A violin needs
   174px before the two lines of a sample name collide under its four samples
   — a figure floor, which is why a third of a 534px canvas cannot hold one
   and the first and third bands wrap there. The three score rows need 236 for
   their axis label and the neighbourhood panel 163 for its two marks and their
   key; those are caption widths and both clear at either width. */
const BANDS = [
  { text: "The two counts — the same thing twice" },
  { text: "Mitochondrial % — a dying cell, or the sample" },
  /* THE BAND SAYS IT ONCE, for all three panels under it. These two lines used
     to sit over the neighbourhood panel, which is 178px wide in this layout
     and could hold neither: at 233px and 222px they printed across the score
     rows beside it. A band heading is full width and is the right place for a
     thing that is true of the whole band. */
  {
    text: "The doublet score — from the droplets nearest it",
    note: "nearest in the middle, fiftieth at the rim; scored on what the other three rules keep",
  },
];
const F_VIOLIN = 174, F_SPIDER = 163, F_ROWS = 236;
const GAP = 22;        // between two panels in a band
/* A SCATTER NEEDS ITS LEFT GUTTER. Its y-axis carries a rotated label as well
   as ticks, and at a 22px gap that label prints through the sample names of
   the violin beside it. A violin's own ticks are three characters and clear
   the 22. The old two-scatter row used 56 and this is the same number. */
const SGAP = 56;
const CAP = 46;        // a band's rule down to the top of the panel under it
const CAP3 = 52;       // band three: its heading carries a note line under the rule
const LABELS = 29;     // two lines of sample name under a violin
const BAND_GAP = 24;   // the foot of one band to the next band's rule
const FOOT = 30;

/* One measurement a width, because every draw and every hit-test asks for the
   same rects and the page has eleven of them. */
const layouts = new Map();
function metricsLayout(w) {
  const hit = layouts.get(w);
  if (hit) return hit;
  const full = w - PAD.l - PAD.r;
  const violins = [], scatters = [], heads = [];
  let y = 20;

  heads.push({ y, ...BANDS[0] });
  y += CAP;
  const e3 = (full - GAP - SGAP) / 3;
  if (e3 >= F_VIOLIN) {
    violins[0] = { x: PAD.l, y, w: e3, h: 180 };
    violins[1] = { x: PAD.l + e3 + GAP, y, w: e3, h: 180 };
    scatters[0] = { x: PAD.l + 2 * e3 + GAP + SGAP, y, w: e3, h: 180 };
    y += 180 + LABELS;
  } else {
    /* no room for three across: the two counts pair, and their scatter takes
       the whole band under them */
    const e2n = (full - GAP) / 2;
    violins[0] = { x: PAD.l, y, w: e2n, h: 180 };
    violins[1] = { x: PAD.l + e2n + GAP, y, w: e2n, h: 180 };
    y += 180 + LABELS + GAP + 22;
    scatters[0] = { x: PAD.l, y, w: full, h: 180 };
    y += 180 + LABELS;
  }
  y += BAND_GAP;

  heads.push({ y, ...BANDS[1] });
  y += CAP;
  const e2s = (full - SGAP) / 2;
  violins[2] = { x: PAD.l, y, w: e2s, h: 180 };
  scatters[1] = { x: PAD.l + e2s + SGAP, y, w: e2s, h: 180 };
  y += 180 + LABELS + BAND_GAP;

  heads.push({ y, ...BANDS[2] });
  y += CAP3;
  const e2 = (full - GAP) / 2;
  let space, rows;
  const trio = full - 2 * GAP;
  if (trio >= F_VIOLIN + F_SPIDER + F_ROWS) {
    /* THE SLACK GOES WHERE IT IS WORTH MOST. The three rows carry a thousand
       droplets across a 0-to-1 axis and the spider fifty spokes, so they take
       two thirds and a quarter of what is left over; the violin is legible at
       its floor and takes the rest. */
    const slack = trio - (F_VIOLIN + F_SPIDER + F_ROWS);
    const wv = F_VIOLIN + slack * 0.1, ws = F_SPIDER + slack * 0.25;
    violins[3] = { x: PAD.l, y, w: wv, h: 262 };
    space = { x: PAD.l + wv + GAP, y, w: ws, h: 262 };
    rows = { x: PAD.l + wv + ws + 2 * GAP, y, w: trio - wv - ws, h: 262 };
    y += 262 + LABELS;
  } else {
    violins[3] = { x: PAD.l, y, w: e2, h: 262 };
    space = { x: PAD.l + e2 + GAP, y, w: e2, h: 262 };
    y += 262 + LABELS + GAP + 22;
    rows = { x: PAD.l, y, w: full, h: 210 };
    y += 210;
  }
  const L = { violins, scatters, heads, space, rows, height: Math.round(y + FOOT) };
  layouts.set(w, L);
  return L;
}
/* THE DOUBLET VIOLIN IS 262 TALL, not 180 (his round 12): it shares its band
   with the neighbourhood panel and the three rows, and the three line up top
   and bottom. */
const violinRect = (w, i) => metricsLayout(w).violins[i];
const scatterRect = (w, i) => metricsLayout(w).scatters[i];
const spaceRect = (w) => metricsLayout(w).space;
const scoreRect = (w) => metricsLayout(w).rows;
/* LAYOUT A (his pick, round 2): the map is the biggest thing on the page,
   because what the sliders do to the cells is what the page is now about; the
   bar sits beside it and the sweep under the bar, so the whole dial stays
   visible while a slider moves along it. The harness renders every widget in a
   900px frame, which puts this canvas at 534px, so every rect is a share of
   the width rather than a number. */
const mapRect = (w) => {
  const side = Math.max(190, Math.min(310, w * 0.42));
  return { x: 22, y: 34, w: side, h: side };
};
const rightCol = (w) => {
  const m = mapRect(w);
  const x = m.x + m.w + 58;
  /* 66px at the right edge: the four sample names sit at the ends of their own
     curves on the sweep, and at 42 they were clipped to "P1 · tum" */
  return { x, w: Math.max(150, w - x - 66) };
};
const barRect = (w) => ({ ...rightCol(w), y: 34, h: 104 });
const sweepRect = (w) => ({ ...rightCol(w), y: 226, h: 116 });

/** A smoothed density over a fixed range, scaled to its own maximum. */
function density(values, lo, hi, bins = 40) {
  const d = new Array(bins).fill(0);
  for (const v of values) {
    const t = (v - lo) / (hi - lo);
    if (t >= 0 && t <= 1) d[Math.min(bins - 1, Math.floor(t * bins))] += 1;
  }
  const s = d.map((_, i) => (d[Math.max(0, i - 1)] + 2 * d[i] + d[Math.min(bins - 1, i + 1)]) / 4);
  const mx = Math.max(...s, 1);
  return s.map((v) => v / mx);
}

/** Every dot on a scatter or a map, drawn without the ring plot.dot() carries:
    1,600 droplets a frame, and the ring is for a mark that must stay legible
    where marks cross — here the crossing IS the data. */
function dots(ctx, points, r, fill, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  for (const [x, y] of points) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** A DROPLET WITH TWO CELLS IN IT IS DRAWN AS TWO CIRCLES (his round 6): one
    mark a thing, two joined marks a thing made of two. It is the made-up
    doublets that wear it most — each really is two droplets added together —
    so a real doublet surrounded by them is a double mark in a crowd of double
    marks, and the shape match IS the score. */
function pairs(ctx, points, r, fill, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  const off = r * 0.78;
  for (const [x, y] of points) {
    ctx.beginPath();
    ctx.arc(x - off, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + off, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** WHAT A DROPLET HOLDS, AS A MARK (his round 7: "i get confused by just
    reading the text ... different colors for different cell types"). One
    circle is one cell, two joined circles are two cells in one droplet, and
    the two colours are whether those are two of a type or two different ones.

    THE COLOURS ARE THE WHOLE DISTINCTION, which the mock settled: drawn in
    one ink, or in the row's own data colour, "two different types" and "two
    of the same type" are the same mark, and that sameness is exactly the
    confusion this was built to remove.

    IT IS ALWAYS A MARK BESIDE ITS OWN WORDS, never a dot among the data. That
    is what keeps it clear of each panel's own colours — on the score rows
    blue already means a droplet the rule keeps and red one it calls, so the
    glyph takes the next two free hues off the cluster ramp rather than its
    first two, which are that same blue and that same red. */
const GLYPH_R = 4.2;
const glyphWidth = (kind, r) => (kind === "het" || kind === "hom" ? 3.84 * r : 2 * r);
function drawGlyph(ctx, colors, x, y, r, kind) {
  const same = colors.clusters[1], other = colors.clusters[3];
  const off = r * 0.92;
  ctx.save();
  const disc = (px, col) => {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(px, y, r, 0, Math.PI * 2); ctx.fill();
  };
  if (kind === "het" || kind === "hom") {
    disc(x + r, same);
    disc(x + r + 2 * off, kind === "het" ? other : same);
  } else if (kind === "none") {
    /* no cell at all: the outline is the droplet with nothing in it */
    ctx.strokeStyle = colors.ink3;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x + r, y, r - 0.6, 0, Math.PI * 2); ctx.stroke();
  } else {
    disc(x + r, same);
  }
  ctx.restore();
  return glyphWidth(kind, r);
}
/** The one droplet's composition, in the glyph's terms and in words — the two
    always drawn together, so the words are never the only carrier. */
const holdsOf = (c) => (
  c.state === "doublet"
    ? (c.partner === c.type
      ? { kind: "hom", words: "two cells of one type" }
      : { kind: "het", words: "two cells of different types" })
    : c.state === "good" ? { kind: "one", words: "one cell" }
      : c.state === "dying" ? { kind: "one", words: "a dying cell" }
        : { kind: "none", words: "ambient RNA only" }
);

const tickLabel = (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)));
/** A droplet's value for a metric. The first three are on the droplet; the
    fourth was worked out from every other one, and is absent for a droplet
    the other rules removed before the scoring ran. */
const valueOf = (m, c, i, state) => (m.derived ? (state.dbl ? state.dbl.score[i] : NaN) : c[m.key]);
const ruleOf = (m, thr) => (m.key === "nFeature" ? thr.nFeature : m.key === "nCount" ? thr.nCount : m.key === "mt" ? thr.mt : thr.dbl);

/* =========================================================================
   THE HOVER — an inspector, and nothing lives only in it (core's own rule).

   What it is for is different on each page, and on each it is the same
   object seen twice. On Metrics the three numbers are three readings of ONE
   droplet, which the three violins and the two scatters split across five
   panels: pointing at a droplet in either scatter marks it in the other and
   ticks its value in all three violins. On Thresholds a sample is a bar and a
   curve: pointing at either lights both. On Cells kept a droplet is a
   position, a colour and a fate: pointing at one names them.

   One geometry for the drawing and the test (5.8): both read `state.axes` and
   the same rect functions, so a target sits where it is drawn.
   ====================================================================== */
const near = (px, py, x, y, r) => (px - x) ** 2 + (py - y) ** 2 < r * r;

function scatterScale(w, si, axes) {
  const rect = scatterRect(w, si);
  const { xlo, xhi, ylo, yhi } = axes.scatters[si];
  return {
    rect,
    sx: (v) => rect.x + ((log10(v) - xlo) / (xhi - xlo)) * rect.w,
    sy: (v, ylog) => rect.y + rect.h - (((ylog ? log10(v) : v) - ylo) / (yhi - ylo)) * rect.h,
  };
}

function mapScale(w, view) {
  const rect = mapRect(w);
  const span = view[1] - view[0];
  return {
    rect,
    sx: (v) => rect.x + ((v - view[0]) / span) * rect.w,
    sy: (v) => rect.y + ((view[1] - v) / span) * rect.h,
  };
}

function hoverAt(pointer, w, page, state) {
  if (!pointer) return null;
  const { cells, pos, axes, view } = state;
  if (page === "metrics") {
    for (let si = 0; si < SCATTERS.length; si += 1) {
      const sc = SCATTERS[si], g = scatterScale(w, si, axes);
      if (pointer.x < g.rect.x - 6 || pointer.x > g.rect.x + g.rect.w + 6) continue;
      if (pointer.y < g.rect.y - 6 || pointer.y > g.rect.y + g.rect.h + 6) continue;
      let best = -1, bd = 81;
      cells.forEach((c, i) => {
        const d = (pointer.x - g.sx(c[sc.xk])) ** 2 + (pointer.y - g.sy(c[sc.yk], sc.ylog)) ** 2;
        if (d < bd) { bd = d; best = i; }
      });
      if (best >= 0) return { kind: "droplet", i: best };
    }
    /* THE SCORE ROWS ARE HOW A DROPLET IS REACHED. They are laid out by the
       very number the neighbourhood panel explains, so pointing at the right
       end of the first row and then at the middle of the third is the lesson
       — and the same hover rings the droplet in both scatters and ticks it in
       all four distributions. */
    const sr = scoreRect(w);
    if (state.dbl && pointer.x > sr.x - 8 && pointer.x < sr.x + sr.w + 8 && pointer.y > sr.y - 8 && pointer.y < sr.y + sr.h) {
      const rowH = sr.h / DBL_ROWS.length;
      const ri = Math.max(0, Math.min(DBL_ROWS.length - 1, Math.floor((pointer.y - sr.y) / rowH)));
      const y0 = sr.y + ri * rowH, h = rowH - 26;
      let best = -1, bd = 100;
      for (const i of state.dbl.index) {
        if (!DBL_ROWS[ri].of(cells[i])) continue;
        const px = sr.x + state.dbl.score[i] * sr.w;
        const py = y0 + 4 + state.dbl.jitter[i] * (h - 8);
        const d = (pointer.x - px) ** 2 + (pointer.y - py) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0) return { kind: "droplet", i: best };
    }
    return null;
  }
  if (page === "thresholds") {
    const rect = barRect(w), rowH = rect.h / SAMPLES.length;
    if (pointer.x > rect.x - 70 && pointer.x < rect.x + rect.w + 40 && pointer.y > rect.y && pointer.y < rect.y + rect.h) {
      const si = Math.min(SAMPLES.length - 1, Math.max(0, Math.floor((pointer.y - rect.y) / rowH)));
      return { kind: "sample", key: SAMPLES[si].key };
    }
    const sr = sweepRect(w);
    if (pointer.x > sr.x && pointer.x < sr.x + sr.w + 60 && pointer.y > sr.y - 8 && pointer.y < sr.y + sr.h + 8) {
      const mt = 2 + ((pointer.x - sr.x) / sr.w) * 28;
      const k = Math.max(0, Math.min(56, Math.round((mt - 2) / 0.5)));
      let best = null, bd = Infinity;
      for (const sm of SAMPLES) {
        const y = sr.y + sr.h - state.sweep[sm.key][k] * sr.h;
        const d = Math.abs(pointer.y - y);
        if (d < bd) { bd = d; best = sm.key; }
      }
      if (bd < 24) return { kind: "sample", key: best, mt: 2 + k * 0.5 };
    }
    return null;
  }
  /* only the droplets still on the map can be pointed at: the rest are not
     drawn, so a hit on one would be a hit on nothing */
  const g = mapScale(w, view);
  if (pointer.x < g.rect.x - 6 || pointer.x > g.rect.x + g.rect.w + 6) return null;
  if (pointer.y < g.rect.y - 6 || pointer.y > g.rect.y + g.rect.h + 6) return null;
  let best = -1, bd = 64;
  const shown = state.removedAt.map((r, i) => (r ? -1 : i)).filter((i) => i >= 0);
  for (const i of shown) {
    const d = (pointer.x - g.sx(pos[i].x)) ** 2 + (pointer.y - g.sy(pos[i].y)) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return best >= 0 ? { kind: "droplet", i: best } : null;
}

/** The hover's own line, in the space each page keeps for it. */
function hoverLine(ctx, colors, x, y, parts) {
  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  let cx = x;
  for (const [text, tone, weight] of parts) {
    ctx.font = `${weight ?? ""} ${colors.fsXs} ${colors.font}`.trim();
    ctx.fillStyle = tone ?? colors.ink2;
    ctx.fillText(text, cx, y);
    cx += ctx.measureText(text).width + 8;
  }
  ctx.restore();
}
const bigCount = (v) => Math.round(v).toLocaleString("en-US");
const ringAt = (ctx, colors, x, y, r = 5.5) => {
  ctx.save();
  ctx.strokeStyle = colors.highlight;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

/* =========================================================================
   PAGE 1 · Metrics — the three numbers per cell, one distribution a sample,
   and the two scatters under them (cells 19 and 22, his pick 10).
   ====================================================================== */
function drawMetrics(ctx, colors, w, state, hover) {
  const { cells, thr, axes } = state;
  /* THE BAND RULES FIRST, so every caption's surface halo prints over them.
     Drawn in --grid and labelled in ink: a divider is structure, not data, and
     every colour on this page already answers a question about a droplet. */
  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (const b of metricsLayout(w).heads) {
    ctx.beginPath(); ctx.moveTo(PAD.l, b.y + 0.5); ctx.lineTo(w - PAD.r, b.y + 0.5); ctx.stroke();
    ctx.font = `600 ${colors.fsSm} ${colors.font}`;
    ctx.fillStyle = colors.surface;
    ctx.fillRect(PAD.l - 4, b.y - 9, ctx.measureText(b.text).width + 8, 18);
    ctx.fillStyle = colors.ink2;
    ctx.fillText(b.text, PAD.l, b.y);
    if (b.note) {
      ctx.font = `${colors.fsXs} ${colors.font}`;
      ctx.fillStyle = colors.ink3;
      ctx.fillText(b.note, PAD.l, b.y + 18);
    }
  }
  ctx.restore();
  METRICS.forEach((m, mi) => {
    const rect = violinRect(w, mi);
    const { lo, hi } = axes.violins[mi];
    const plot = makePlot({ ctx, colors, rect, xDomain: [0, SAMPLES.length], yDomain: [lo, hi] });
    plot.caption(m.name);
    plot.axisY({
      ticks: m.log ? Array.from({ length: Math.round(hi - lo) + 1 }, (_, k) => lo + k).filter((t) => Number.isInteger(t))
        : m.derived ? [0, 0.5, 1] : [0, 20, 40, 60].filter((t) => t <= hi),
      format: (t) => (m.log ? tickLabel(10 ** t) : m.derived ? fmt(t, 1) : String(t)),
    });
    if (m.derived && !state.dbl) {
      ctx.save();
      ctx.fillStyle = colors.ink3;
      ctx.font = `${colors.fsXs} ${colors.font}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("no droplets to score", rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.restore();
      return;
    }
    SAMPLES.forEach((s, si) => {
      const v = cells.map((c, i) => [c, i]).filter(([c]) => c.sample === s.key)
        .map(([c, i]) => (m.log ? log10(valueOf(m, c, i, state)) : valueOf(m, c, i, state)))
        .filter((x) => Number.isFinite(x));
      if (!v.length) return;
      const d = density(v, lo, hi);
      const cx = plot.sx(si + 0.5);
      const half = Math.min(26, (rect.w / SAMPLES.length) * 0.44);
      ctx.save();
      ctx.fillStyle = colors.empirical;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      for (let b = 0; b < d.length; b += 1) ctx.lineTo(cx - half * d[b], plot.sy(lo + ((b + 0.5) / d.length) * (hi - lo)));
      for (let b = d.length - 1; b >= 0; b -= 1) ctx.lineTo(cx + half * d[b], plot.sy(lo + ((b + 0.5) / d.length) * (hi - lo)));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      /* the sample's median, as a rule inside its own violin */
      const md = median(v);
      ctx.save();
      ctx.strokeStyle = colors.ink2;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(cx - half * 0.7, plot.sy(md));
      ctx.lineTo(cx + half * 0.7, plot.sy(md));
      ctx.stroke();
      ctx.restore();
      if (mi === 0 || true) {
        ctx.save();
        ctx.fillStyle = colors.ink3;
        ctx.font = `${colors.fsXs} ${colors.font}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const n = shortName(s.key).split(" · ");
        ctx.fillText(n[0], cx, rect.y + rect.h + 5);
        ctx.fillText(n[1] ?? "", cx, rect.y + rect.h + 17);
        ctx.restore();
      }
      /* the hovered droplet's own value, ticked across the violin it belongs
         to: the same droplet the scatters ring, in the panel for this metric */
      if (hover && hover.kind === "droplet" && cells[hover.i].sample === s.key
          && Number.isFinite(valueOf(m, cells[hover.i], hover.i, state))) {
        const c = cells[hover.i];
        const raw = valueOf(m, c, hover.i, state);
        const hy = plot.sy(m.log ? log10(raw) : raw);
        ctx.save();
        ctx.strokeStyle = colors.highlight;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(cx - half - 4, hy);
        ctx.lineTo(cx + half + 4, hy);
        ctx.stroke();
        ctx.restore();
      }
    });
    /* the reader's own rule, on the metric it applies to */
    const t = ruleOf(m, thr);
    if (t === null || t === undefined) {
      ctx.save();
      ctx.fillStyle = colors.ink3;
      ctx.font = `${colors.fsXs} ${colors.font}`;
      ctx.textAlign = "right";
      ctx.textBaseline = "top";
      /* inside the panel: the caption owns the line above it, and on a narrow
         canvas the two printed through each other */
      ctx.fillText("no rule set", rect.x + rect.w - 4, rect.y + 4);
      ctx.restore();
      return;
    }
    /* clamped to the panel: a threshold of nought sits below a log axis's own
       floor, and unclamped its label printed over the panel beneath */
    const ty = Math.max(rect.y, Math.min(rect.y + rect.h, plot.sy(m.log ? log10(t) : t)));
    ctx.save();
    ctx.strokeStyle = colors.reference;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(rect.x, ty);
    ctx.lineTo(rect.x + rect.w, ty);
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = colors.reference;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "right";
    const atFloor = ty >= rect.y + rect.h - 1;
    ctx.textBaseline = atFloor ? "top" : "bottom";
    ctx.fillText(`${m.key === "nFeature" || m.key === "nCount" ? ">" : "<"} ${t}`, rect.x + rect.w, ty + (atFloor ? -13 : -3));
    ctx.restore();
  });

  SCATTERS.forEach((s, si) => {
    const rect = scatterRect(w, si);
    const xs = cells.map((c) => log10(c[s.xk]));
    const ys = cells.map((c) => (s.ylog ? log10(c[s.yk]) : c[s.yk]));
    const { xlo, xhi, ylo, yhi } = axes.scatters[si];
    const plot = makePlot({ ctx, colors, rect, xDomain: [xlo, xhi], yDomain: [ylo, yhi] });
    plot.caption(s.caption);
    plot.note(s.note);
    plot.axisX({
      ticks: Array.from({ length: Math.round(xhi - xlo) + 1 }, (_, k) => xlo + k).filter((t) => Number.isInteger(t)),
      format: (t) => tickLabel(10 ** t), label: "Transcripts",
    });
    plot.axisY({
      ticks: s.ylog ? Array.from({ length: Math.round(yhi - ylo) + 1 }, (_, k) => ylo + k).filter((t) => Number.isInteger(t)) : [0, 20, 40, 60].filter((t) => t <= yhi),
      format: (t) => (s.ylog ? tickLabel(10 ** t) : String(t)),
      label: s.yk === "nFeature" ? "Genes detected" : "Mitochondrial %",
    });
    dots(ctx, cells.map((c, i) => [plot.sx(xs[i]), plot.sy(ys[i])]), 1.5, colors.empirical, 0.45);
    /* the two rules that cross on this panel */
    ctx.save();
    ctx.strokeStyle = colors.reference;
    ctx.setLineDash([4, 3]);
    const vx = plot.sx(log10(thr.nCount));
    ctx.beginPath(); ctx.moveTo(vx, rect.y); ctx.lineTo(vx, rect.y + rect.h); ctx.stroke();
    const hv = s.yk === "nFeature" ? log10(thr.nFeature) : thr.mt;
    const hy = plot.sy(hv);
    ctx.beginPath(); ctx.moveTo(rect.x, hy); ctx.lineTo(rect.x + rect.w, hy); ctx.stroke();
    ctx.restore();
    if (hover && hover.kind === "droplet") {
      const c = cells[hover.i];
      ringAt(ctx, colors, plot.sx(log10(c[s.xk])), plot.sy(s.ylog ? log10(c[s.yk]) : c[s.yk]));
    }
  });
  drawDoubletPanels(ctx, colors, w, state, hover);
  /* ONE DROPLET, EVERY PANEL. Its four numbers are four readings of it, and
     what it holds is not among them: the three rows on the right are the
     answer, and the reader can see they were never an input. */
  if (hover && hover.kind === "droplet") {
    const c = cells[hover.i];
    hoverLine(ctx, colors, scatterRect(w, 0).x, scatterRect(w, 1).y + scatterRect(w, 1).h + 44, [
      [SAMPLES.find((sm) => sm.key === c.sample).name, colors.ink1, "600"],
      [`${bigCount(c.nCount)} transcripts`, colors.ink2],
      [`${bigCount(c.nFeature)} genes`, colors.ink2],
      [`${fmt(c.mt, 1)}% mitochondrial`, colors.ink2],
    ]);
  }
}

/* =========================================================================
   PAGE 2 · Thresholds — the three rules as the reader moves them: the map of
   the cells they leave, the bar of what they took from each sample, and the
   mitochondrial rule swept from 2 to 30 under it (layout A, his round 2).

   A DROPLET A RULE REMOVES IS GONE, not marked (his round 2: "can also remove
   cells from the cluster instead of changing from filled to empty so effect
   is more apparent"). The drag is the proof: at a mitochondrial rule of 30
   the map is six dense clusters and every sample keeps 88–93%; at 5 the
   sample carrying the ambient RNA is at 0% and the hepatocyte cluster is a
   scatter, because that sample was 62% hepatocyte. What that costs is then a
   number rather than a mark, and the readout carries it.
   ====================================================================== */
const STATE_COLOUR = (colors) => ({
  good: colors.empirical, dying: colors.extreme, empty: colors.unknown, doublet: colors.highlight,
});

function drawThresholds(ctx, colors, w, state, hover) {
  const lit = hover && hover.kind === "sample" ? hover.key : null;
  const { cells, pos, view, removedAt, centres, tally, sweep, thr } = state;
  const SC = STATE_COLOUR(colors);

  /* --- the map: the cells the rules leave ---------------------------------- */
  const { rect: mr, sx, sy } = mapScale(w, view);
  ctx.save();
  ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  ctx.fillStyle = colors.ink2;
  ctx.textAlign = "left";
  ctx.fillText("The cells the rules leave", mr.x, mr.y - 10);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.strokeRect(mr.x + 0.5, mr.y + 0.5, mr.w, mr.h);
  ctx.restore();
  for (const st of ["good", "empty", "dying", "doublet"]) {
    const pts = [];
    cells.forEach((c, i) => {
      if (c.state !== st || removedAt[i]) return;
      pts.push([sx(pos[i].x), sy(pos[i].y)]);
    });
    dots(ctx, pts, st === "good" ? 1.9 : 2.3, SC[st], st === "good" ? 0.5 : 0.9);
  }
  /* the six populations, named where their own cells are; a population the
     rules have emptied loses its name along with its cells */
  ctx.save();
  ctx.font = `600 ${colors.fsXs} ${colors.font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  TYPES.forEach((t) => {
    const c = centres[t.key];
    if (!c) return;
    ctx.lineWidth = 3;
    ctx.strokeStyle = colors.surface;
    ctx.strokeText(t.name, sx(c[0]), sy(c[1]));
    ctx.fillStyle = colors.ink2;
    ctx.fillText(t.name, sx(c[0]), sy(c[1]));
  });
  ctx.restore();
  if (hover && hover.kind === "droplet") {
    const c = cells[hover.i];
    ringAt(ctx, colors, sx(pos[hover.i].x), sy(pos[hover.i].y), 6);
    const type = c.state === "empty" ? "" : c.partner
      ? `${TYPES.find((t) => t.key === c.type).name.toLowerCase()} and ${TYPES.find((t) => t.key === c.partner).name.toLowerCase()}`
      : TYPES.find((t) => t.key === c.type).name.toLowerCase();
    const held = { good: "one cell", dying: "a dying cell", empty: "no cell, ambient RNA only", doublet: "two cells" }[c.state];
    hoverLine(ctx, colors, mr.x, mr.y + mr.h + 16, [[held, SC[c.state], "600"], [type, colors.ink3]]);
    hoverLine(ctx, colors, mr.x, mr.y + mr.h + 32, [
      [`${bigCount(c.nCount)} transcripts`, colors.ink2],
      [`${bigCount(c.nFeature)} genes`, colors.ink2],
      [`${fmt(c.mt, 1)}% mitochondrial`, colors.ink2],
    ]);
  }

  /* --- the bar: what the rules took from each sample ----------------------- */
  const rect = barRect(w);
  const rowH = rect.h / SAMPLES.length;
  ctx.save();
  ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  ctx.fillStyle = colors.ink2;
  ctx.textAlign = "left";
  ctx.fillText("Droplets, one bar a sample", rect.x, rect.y - 10);
  ctx.restore();
  SAMPLES.forEach((s, si) => {
    const t = tally[s.key];
    const y = rect.y + si * rowH + 3;
    const h = rowH - 12;
    const unit = rect.w / t.n;
    let x = rect.x;
    ctx.save();
    ctx.fillStyle = colors.empirical;
    ctx.fillRect(x, y, t.kept * unit, h);
    x += t.kept * unit;
    ctx.fillStyle = colors.extreme;
    /* the three rules in the order they are written, hairline-separated: the
       transcript rule's sliver between the other two is what says that two of
       the three rules are one rule, which the walkthrough used to say in time */
    for (const r of RULES) {
      if (!t.by[r]) continue;
      ctx.fillRect(x, y, t.by[r] * unit, h);
      x += t.by[r] * unit;
      ctx.save();
      ctx.strokeStyle = colors.surface;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = lit === s.key ? colors.highlight : colors.grid;
    ctx.lineWidth = lit === s.key ? 1.6 : 1;
    ctx.strokeRect(rect.x + 0.5, y + 0.5, rect.w, h);
    ctx.fillStyle = colors.ink2;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(shortName(s.key), rect.x - 8, y + h / 2);
    ctx.textAlign = "left";
    ctx.fillStyle = colors.ink3;
    ctx.fillText(`${Math.round((100 * t.kept) / t.n)}%`, rect.x + rect.w + 6, y + h / 2);
    ctx.restore();
  });
  ctx.save();
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textBaseline = "top";
  ctx.fillStyle = colors.empirical;
  ctx.textAlign = "left";
  ctx.fillText("kept", rect.x, rect.y + rect.h - 2);
  ctx.fillStyle = colors.extreme;
  ctx.textAlign = "right";
  ctx.fillText("removed", rect.x + rect.w, rect.y + rect.h - 2);
  ctx.restore();
  if (lit) {
    const t = tally[lit];
    hoverLine(ctx, colors, rect.x, rect.y + rect.h + 22, [
      [SAMPLES.find((sm) => sm.key === lit).name, colors.ink1, "600"],
      [`${t.n - t.kept} removed of ${t.n}`, colors.extreme],
    ]);
    hoverLine(ctx, colors, rect.x, rect.y + rect.h + 38, [
      [RULES.map((r) => `${t.by[r]} ${RULE_NAME[r]}`).join(", "), colors.ink3],
    ]);
  }

  /* --- the sweep: every mitochondrial rule this reader could have set ------- */
  const sr = sweepRect(w);
  const plot = makePlot({ ctx, colors, rect: sr, xDomain: [2, 30], yDomain: [0, 1] });
  plot.caption("Droplets kept, at every mitochondrial %");
  plot.grid([0, 0.5, 1]);
  plot.axisX({ ticks: [5, 10, 20, 30], format: (t) => String(t) });
  plot.axisY({ ticks: [0, 0.5, 1], format: (t) => `${Math.round(t * 100)}%` });
  for (const s of SAMPLES) {
    plot.curve(sweep[s.key].map((v, k) => [2 + k * 0.5, v]),
      { stroke: lit === s.key ? colors.highlight : colors.empirical, width: lit === s.key ? 2.4 : 1.6 });
  }
  const ends = SAMPLES
    .map((s) => ({ key: s.key, y: plot.sy(sweep[s.key][sweep[s.key].length - 1]) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i += 1) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 12);
  ctx.save();
  ctx.fillStyle = colors.ink3;
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (const e of ends) ctx.fillText(shortName(e.key), sr.x + sr.w + 5, e.y);
  ctx.restore();
  if (lit && hover.mt !== undefined) {
    const k = Math.round((hover.mt - 2) / 0.5);
    plot.dot(hover.mt, sweep[lit][k], { fill: colors.highlight, r: 3.5 });
    ctx.save();
    ctx.fillStyle = colors.highlight;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = hover.mt > 22 ? "right" : "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(`${Math.round(100 * sweep[lit][k])}% at ${hover.mt}`, plot.sx(hover.mt) + (hover.mt > 22 ? -8 : 8), plot.sy(sweep[lit][k]) - 6);
    ctx.restore();
  }
  ctx.save();
  ctx.strokeStyle = colors.reference;
  ctx.setLineDash([4, 3]);
  const vx = plot.sx(Math.max(2, Math.min(30, thr.mt)));
  ctx.beginPath(); ctx.moveTo(vx, sr.y); ctx.lineTo(vx, sr.y + sr.h); ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = colors.reference;
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textAlign = vx > sr.x + sr.w - 60 ? "right" : "left";
  ctx.textBaseline = "top";
  ctx.fillText(` ${thr.mt} `, vx, sr.y + 2);
  ctx.restore();
}

/* =========================================================================
   THE FOURTH METRIC, under the four distributions on the Metrics page — how
   it is measured, and what it catches (his round 4: a page of its own "looks
   weird as it stands out ... unless it is part of the metric").

   The lesson names doublets twice, both in prose, and sets no rule for them;
   no tool is named in any of its four single-cell notebooks. What the field
   does — Scrublet, DoubletFinder and scDblFinder all share it — cannot be
   written as a cut on a droplet's own numbers, which is why the other three
   rules remove not one of the 81 doublets, measured. Instead: add random
   pairs of droplets together, put those artificial doublets in the same
   space, and score each droplet by the share of its nearest neighbours that
   are artificial.

   THE LEFT PANEL IS WHAT THE METHOD SEES — droplets and made-up doublets,
   with nothing marking which droplets really hold two cells. THE RIGHT PANEL
   IS THE ANSWER, in three rows the method never gets to look at. At a score
   of 0.6 the first row is called whole — 49 of 49, for two droplets holding
   one cell — and the second row is not touched at any score the control
   offers: a doublet of two cells of one type has that type's profile, so the
   artificial doublets around it were made from that type too. That is what
   DoubletFinder's homotypic-proportion adjustment concedes rather than fixes,
   and it is the half of this method worth teaching.
   ====================================================================== */
const DBL_ROWS = [
  { key: "het", name: "Two different types", of: (c) => c.state === "doublet" && c.partner !== c.type },
  { key: "hom", name: "Two of the same type", of: (c) => c.state === "doublet" && c.partner === c.type },
  { key: "one", name: "One cell", of: (c) => c.state !== "doublet" },
];

/** The k nearest of one droplet, over the real droplets and the made-up ones
    together — the score's own arithmetic, for a single droplet, so the panel
    can draw what it counted. Bounded insertion, so it costs nothing per
    frame: two thousand distances and a list of fifty. */
function neighbourhoodOf(state, i) {
  const { dbl, prof } = state;
  const me = prof[i];
  const k = DOUBLET.k;
  const best = [];
  const offer = (d, pt, art) => {
    if (best.length === k && d >= best[best.length - 1].d) return;
    let at = best.length < k ? best.length : k - 1;
    if (best.length < k) best.push(null);
    while (at > 0 && best[at - 1].d > d) { best[at] = best[at - 1]; at -= 1; }
    best[at] = { d, pt, art };
  };
  const dist = (u, v) => { let t = 0; for (let j = 0; j < u.length; j += 1) t += (u[j] - v[j]) ** 2; return t; };
  for (const j of dbl.index) if (j !== i) offer(dist(me, prof[j]), state.pos[j], 0);
  for (let j = 0; j < dbl.artProf.length; j += 1) offer(dist(me, dbl.artProf[j]), dbl.art[j], 1);
  return { near: best, made: best.filter((n) => n.art).length, k };
}

function drawDoubletPanels(ctx, colors, w, state, hover) {
  const { cells, pos, dbl, thr } = state;
  const mr = spaceRect(w);
  ctx.save();
  ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  ctx.fillStyle = colors.ink2;
  ctx.textAlign = "left";
  /* ONE SHORT LINE. The rank and the order used to be two more lines here and
     they are the band's own note now, because this panel is 178px wide in the
     three-across band and neither line fitted: they printed across the score
     rows beside it. The order itself still has to be said — the widget
     scores what the other three rules keep, which is DoubletFinder's; the
     other order is scDblFinder's, and the two disagree in their own docs. */
  ctx.fillText("One droplet's fifty nearest", mr.x, mr.y - 8);
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.strokeRect(mr.x + 0.5, mr.y + 0.5, mr.w, mr.h);
  ctx.restore();
  if (!dbl) return;

  /* ONE DROPLET'S NEIGHBOURS, AS SPOKES (his rounds 5 and 6). The first
     drawing of this put the fifty inside a circle, and a circle with dots in
     it is a container — "i saw it and i thought they were cells in a single
     droplet". So: no boundary, a spoke to every neighbour, and the focal
     droplet a filled mark at the hub. Distance is replaced by its RANK along
     each spoke — nearest at the middle, fiftieth at the rim, direction kept —
     because at true distance the nearest neighbours, which are the ones that
     decide the score, pile up under the hub and cannot be seen.

     With no pointer it opens on the droplet whose score is the middle of them
     all: the inspector stays an inspector, and nothing lives only in it. */
  const subject = hover && hover.kind === "droplet" && Number.isFinite(dbl.score[hover.i]) ? hover.i : dbl.example;
  const { near, made, k } = neighbourhoodOf(state, subject);
  const me = pos[subject];
  const R = Math.min(mr.w / 2 - 12, (mr.h - 64) / 2);
  const cx = mr.x + mr.w / 2, cy = mr.y + R + 12;
  const place = (n, rank) => {
    const a2 = Math.atan2(n.pt.y - me.y, n.pt.x - me.x);
    const rr = 0.2 * R + ((rank + 1) / near.length) * 0.8 * R;
    return [cx + Math.cos(a2) * rr, cy - Math.sin(a2) * rr];
  };
  ctx.save();
  ctx.lineWidth = 1;
  near.forEach((n, r) => {
    const [px, py] = place(n, r);
    ctx.globalAlpha = n.art ? 0.42 : 0.24;
    ctx.strokeStyle = n.art ? colors.reference : colors.empirical;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(px, py); ctx.stroke();
  });
  ctx.restore();
  dots(ctx, near.map((n, r) => (n.art ? null : place(n, r))).filter(Boolean), 2.6, colors.empirical, 0.85);
  pairs(ctx, near.map((n, r) => (n.art ? place(n, r) : null)).filter(Boolean), 2.2, colors.reference, 0.95);
  /* THE DROPLET ITSELF WEARS THE GLYPH (his round 8: "the cell in the middle
     of the spider is always one color? even when i look at a doublet with 2
     different cell types?"). It did not, and it should: the hub is the one
     droplet whose composition the panel is about.

     --c-highlight moves off its fill and becomes a ring around it. Colour
     then says what the droplet holds and the enclosure says this is the one
     under the pointer, which is how this project puts two groupings on one
     figure — the neighbours keep colour for the only question the score asks,
     made up or real. The disc of surface under the glyph is the gap that
     stops the fifty spokes running through it. */
  const c = cells[subject];
  const holds = holdsOf(c);
  const hubW = glyphWidth(holds.kind, GLYPH_R);
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = colors.surface;
  ctx.beginPath(); ctx.arc(cx, cy, hubW / 2 + 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  drawGlyph(ctx, colors, cx - hubW / 2, cy, GLYPH_R, holds.kind);
  ctx.save();
  ctx.strokeStyle = colors.highlight;
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(cx, cy, hubW / 2 + 3.6, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  /* the key for the two marks, beside the marks themselves */
  ctx.save();
  const keyY = mr.y + mr.h - 40;
  dots(ctx, [[mr.x + 8, keyY]], 2.4, colors.empirical, 0.85);
  pairs(ctx, [[mr.x + 78, keyY]], 2.2, colors.reference, 0.95);
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillStyle = colors.ink3;
  ctx.fillText("a droplet", mr.x + 16, keyY);
  ctx.fillText("artificial doublet", mr.x + 86, keyY);
  ctx.restore();

  const sc = dbl.score[subject];
  const called = thr.dbl !== null && sc >= thr.dbl;
  hoverLine(ctx, colors, mr.x, mr.y + mr.h - 22, [[`${made} of its ${k} nearest are artificial`, colors.ink2, "600"]]);
  /* the same mark the hub wears and the rows below are labelled with, beside
     the same words: what this droplet holds is the one thing the score cannot
     see, and it is the distinction the words alone would not carry */
  const scoreText = `score ${fmt(sc, 2)}`;
  const line2 = mr.y + mr.h - 6;
  ctx.save();
  ctx.font = `600 ${colors.fsXs} ${colors.font}`;
  const scoreW = ctx.measureText(scoreText).width;
  ctx.restore();
  hoverLine(ctx, colors, mr.x, line2, [[scoreText, called ? colors.extreme : colors.ink1, "600"]]);
  const gx = mr.x + scoreW + 10;
  const gw = drawGlyph(ctx, colors, gx, line2, GLYPH_R, holds.kind);
  hoverLine(ctx, colors, gx + gw + 5, line2, [[holds.words, colors.ink3]]);

  /* --- the scores, in the three rows the method never sees ----------------- */
  const sr = scoreRect(w);
  const rowH = sr.h / DBL_ROWS.length;
  const SX = (v) => sr.x + v * sr.w;
  ctx.save();
  ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  ctx.fillStyle = colors.ink2;
  ctx.textAlign = "left";
  ctx.fillText("By what the droplet holds", sr.x, sr.y - 24);
  ctx.restore();
  DBL_ROWS.forEach((row, ri) => {
    const y0 = sr.y + ri * rowH, h = rowH - 26;
    const mine = dbl.index.filter((i) => row.of(cells[i]));
    ctx.save();
    ctx.fillStyle = colors.ink3;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    const head = `${row.name} · ${mine.length}`;
    const gw = drawGlyph(ctx, colors, sr.x, y0 - 8, GLYPH_R, row.key);
    const headX = sr.x + gw + 6;
    ctx.fillText(head, headX, y0 - 4);
    const headRight = headX + ctx.measureText(head).width;
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = colors.grid;
    ctx.strokeRect(sr.x + 0.5, y0 + 0.5, sr.w, h);
    ctx.restore();
    const kept = [], called = [];
    for (const i of mine) {
      const v = dbl.score[i];
      const py = y0 + 4 + dbl.jitter[i] * (h - 8);
      (thr.dbl !== null && v >= thr.dbl ? called : kept).push([SX(v), py]);
    }
    dots(ctx, kept, 1.6, colors.empirical, 0.5);
    dots(ctx, called, 1.8, colors.extreme, 0.8);
    if (hover && hover.kind === "droplet" && row.of(cells[hover.i]) && Number.isFinite(dbl.score[hover.i])) {
      ringAt(ctx, colors, SX(dbl.score[hover.i]), y0 + 4 + dbl.jitter[hover.i] * (h - 8), 4.5);
    }
    if (thr.dbl !== null) {
      ctx.save();
      ctx.strokeStyle = colors.reference;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(SX(thr.dbl), y0); ctx.lineTo(SX(thr.dbl), y0 + h); ctx.stroke();
      ctx.restore();
    }
    if (mine.length) {
      const med = `median ${fmt(median(mine.map((i) => dbl.score[i])), 2)}`;
      ctx.save();
      ctx.fillStyle = colors.ink3;
      ctx.font = `${colors.fsXs} ${colors.font}`;
      ctx.textAlign = "right";
      /* on the 534px canvas the harness renders, the row's own name takes the
         line, so the median drops inside the row — core's rule for a note */
      const room = sr.x + sr.w - ctx.measureText(med).width > headRight + 14;
      ctx.textBaseline = room ? "alphabetic" : "top";
      ctx.strokeStyle = colors.surface;
      ctx.lineWidth = 3;
      const mx = sr.x + sr.w - (room ? 0 : 4), my = room ? y0 - 4 : y0 + 4;
      ctx.strokeText(med, mx, my);
      ctx.fillText(med, mx, my);
      ctx.restore();
    }
  });
  ctx.save();
  ctx.fillStyle = colors.ink3;
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textBaseline = "top";
  for (const v of [0, 0.5, 1]) {
    ctx.textAlign = v === 0 ? "left" : v === 1 ? "right" : "center";
    ctx.fillText(fmt(v, 1), SX(v), sr.y + sr.h - 20);
  }
  ctx.textAlign = "center";
  ctx.fillStyle = colors.ink2;
  ctx.fillText("share of the nearest neighbours that are artificial", sr.x + sr.w / 2, sr.y + sr.h - 6);
  ctx.restore();
}

/* --- the tallies the pages read ------------------------------------------- */
function tallyBy(cells, removedAt) {
  const t = {};
  for (const s of SAMPLES) t[s.key] = { n: 0, kept: 0, by: { genes: 0, transcripts: 0, mt: 0, doublet: 0 } };
  cells.forEach((c, i) => {
    const row = t[c.sample];
    row.n += 1;
    if (!removedAt[i]) row.kept += 1;
    else row.by[RULES[removedAt[i] - 1]] += 1;
  });
  return t;
}

/* --- the figures, derived from a set of droplets and the three rules --------
   Lifted out of `compute` so an ease can re-run it on droplets part of the way
   between two settings: everything here is cheap (a pass or two over 1,600
   droplets), and deriving the whole figure from interpolated droplets is what
   keeps a slide honest — no panel is tweened independently of another. */
function derive(cells, prof, pos, thr) {
    /* the panels' own ranges, worked out once from the droplets rather than
       per frame inside the drawing, so a hover resolves against exactly the
       scales the picture was painted with */
    const axes = {
      violins: METRICS.map((m) => {
        if (m.derived) return { lo: 0, hi: 1 };
        const v = cells.map((c) => (m.log ? log10(c[m.key]) : c[m.key]));
        return m.log
          ? { lo: Math.floor(Math.min(...v) * 2) / 2, hi: Math.ceil(Math.max(...v) * 2) / 2 }
          : { lo: 0, hi: Math.min(60, Math.ceil(Math.max(...v))) };
      }),
      scatters: SCATTERS.map((sc) => {
        const xs = cells.map((c) => log10(c[sc.xk]));
        const ys = cells.map((c) => (sc.ylog ? log10(c[sc.yk]) : c[sc.yk]));
        return {
          xlo: Math.floor(Math.min(...xs) * 2) / 2, xhi: Math.ceil(Math.max(...xs) * 2) / 2,
          ylo: sc.ylog ? Math.floor(Math.min(...ys) * 2) / 2 : 0,
          yhi: sc.ylog ? Math.ceil(Math.max(...ys) * 2) / 2 : Math.min(60, Math.ceil(Math.max(...ys))),
        };
      }),
    };

    const removedAt = cells.map((c) => (c.nFeature > thr.nFeature ? (c.nCount > thr.nCount ? (c.mt < thr.mt ? 0 : 3) : 2) : 1));
    /* THE FOURTH RULE runs on what the first three left, as a real pipeline
       does, and it cannot be written as a cut on a droplet's own numbers: it
       needs the whole neighbourhood, so it is computed here and only when it
       is being used. `dbl` is the score above which a droplet is called. */
    let dbl = null;
    if (thr.dbl !== null || thr.wantScores) {
      const index = cells.map((c, i) => i).filter((i) => removedAt[i] === 0);
      const { score, art } = doubletScores(makeRng(thr.scoreSeed), cells, index, { ...DOUBLET, profiles: index.map((i) => prof[i]) });
      const byCell = new Float64Array(cells.length).fill(NaN);
      index.forEach((i, r) => { byCell[i] = score[r]; });
      /* the droplet the neighbourhood panel opens on: the one whose score is
         the middle of them all, so the figure starts on a typical droplet and
         the reader finds the rest by pointing */
      /* each droplet's place across its row, drawn once and hit-tested from the
         same number (5.8): the rows are how the reader reaches a droplet, so
         the dot under the pointer has to be the dot that was painted */
      const jitter = new Float64Array(cells.length);
      const jRng = makeRng(97);
      for (const i of index) jitter[i] = jRng.next();
      const sorted = index.slice().sort((a, b) => byCell[a] - byCell[b]);
      dbl = {
        index, score: byCell, artProf: art, art: art.map(projectProfile), jitter,
        example: sorted[Math.floor(sorted.length / 2)] ?? index[0],
      };
      if (thr.dbl !== null) index.forEach((i, r) => { if (score[r] >= thr.dbl) removedAt[i] = 4; });
    }
    const keep = removedAt.map((r) => r === 0);
    const tally = tallyBy(cells, removedAt);

    /* the sweep, every half per cent from 2 to 30 */
    const sweep = {};
    for (const s of SAMPLES) {
      const cs = cells.filter((c) => c.sample === s.key);
      sweep[s.key] = [];
      for (let mt = 2; mt <= 30.001; mt += 0.5) {
        let k = 0;
        for (const c of cs) if (c.nFeature > thr.nFeature && c.nCount > thr.nCount && c.mt < mt) k += 1;
        sweep[s.key].push(k / cs.length);
      }
    }

    /* the map's frame: the droplets' own extent, squared, so the figure is not
       mostly empty when the profiles sit close together. One range for both
       axes, because a map whose axes are scaled differently is not a map. */
    const px = pos.map((q) => q.x).slice().sort((a, b) => a - b);
    const py = pos.map((q) => q.y).slice().sort((a, b) => a - b);
    const qAt = (arr, f) => arr[Math.min(arr.length - 1, Math.floor(f * arr.length))];
    const lo = Math.min(qAt(px, 0.01), qAt(py, 0.01));
    const hi = Math.max(qAt(px, 0.99), qAt(py, 0.99));
    const mid = (lo + hi) / 2, half = ((hi - lo) / 2) * 1.18;
    const view = [mid - half, mid + half];

    /* the map's six centres, from the droplets whose profile was measured best
       AND WHICH THE RULES LEFT, so a name sits among the cells that are still
       there rather than where they used to be. A population would lose its
       name with its cells, but none does: measured at every extreme of the
       three rules, all six keep more than the eight cells a centre needs —
       the populations are in all four samples, and the rules take samples. */
    const centres = {};
    for (const t of TYPES) {
      const g = cells.map((c, i) => i).filter((i) => cells[i].type === t.key && cells[i].state === "good" && cells[i].nCount > 4000 && !removedAt[i]);
      if (g.length >= 8) centres[t.key] = [g.reduce((s, i) => s + pos[i].x, 0) / g.length, g.reduce((s, i) => s + pos[i].y, 0) / g.length];
    }

    /* what the filter claimed, and what was true */
    const conf = confusion(cells, keep);

    /* the two count rules, as the numbers the readout prints */
    let either = 0, both = 0;
    for (const c of cells) {
      const a = !(c.nFeature > thr.nFeature), b = !(c.nCount > thr.nCount);
      if (a || b) either += 1;
      if (a && b) both += 1;
    }
    const medians = {};
    for (const s of SAMPLES) {
      const cs = cells.filter((c) => c.sample === s.key);
      medians[s.key] = { mt: median(cs.map((c) => c.mt)), nCount: median(cs.map((c) => c.nCount)), nFeature: median(cs.map((c) => c.nFeature)) };
    }
    return { cells, prof, pos, view, axes, thr, removedAt, keep, tally, sweep, centres, conf, dbl, overlap: { either, both }, medians };
}

/* --- a data change that MOVED the droplets rather than replacing them -------
   The ambient level is the one data control the droplets survive: the engine
   draws each one in the same order whatever that level is, so droplet i at 8%
   and droplet i at 25% are the same droplet with more mitochondrial RNA in it.
   Measured: raising it from 15 to 25 keeps every droplet's state, type and
   sample, and moves the numbers of the 400 in that sample and of NO other.
   That is worth a slide rather than a jump, because the thing to see is
   exactly that three samples do not move while one rises — the same reason
   core offers the frames at all.

   The seed and which sample carries the ambient RNA both redraw every
   droplet, so they can only cross-fade.

   The whole figure is re-derived from the droplets part of the way across —
   0.9 ms a frame measured — rather than each panel tweening on its own, so
   the bar, the sweep, the violins and the map can never disagree mid-flight. */
const lerp = (a, b, e) => a + (b - a) * e;
function slideState(from, to, e) {
  const cells = to.cells.map((c, i) => {
    const o = from.cells[i];
    if (!o) return c;
    return { ...c, nCount: lerp(o.nCount, c.nCount, e), nFeature: lerp(o.nFeature, c.nFeature, e), mt: lerp(o.mt, c.mt, e) };
  });
  const pos = to.pos.map((q, i) => (from.pos[i] ? { x: lerp(from.pos[i].x, q.x, e), y: lerp(from.pos[i].y, q.y, e) } : q));
  const prof = to.prof.map((q, i) => (from.prof[i] ? q.map((v, j) => lerp(from.prof[i][j], v, e)) : q));
  const st = derive(cells, prof, pos, to.thr);
  /* the panels' ranges ease with the values inside them, so the droplets move
     against a frame that is moving with them instead of snapping under them */
  st.axes = {
    violins: st.axes.violins.map((v, k) => ({ lo: lerp(from.axes.violins[k].lo, to.axes.violins[k].lo, e), hi: lerp(from.axes.violins[k].hi, to.axes.violins[k].hi, e) })),
    scatters: st.axes.scatters.map((v, k) => ({
      xlo: lerp(from.axes.scatters[k].xlo, to.axes.scatters[k].xlo, e), xhi: lerp(from.axes.scatters[k].xhi, to.axes.scatters[k].xhi, e),
      ylo: lerp(from.axes.scatters[k].ylo, to.axes.scatters[k].ylo, e), yhi: lerp(from.axes.scatters[k].yhi, to.axes.scatters[k].yhi, e),
    })),
  };
  st.view = [lerp(from.view[0], to.view[0], e), lerp(from.view[1], to.view[1], e)];
  return st;
}

/* The state and the parameters last DRAWN, so `init` can tell a change that
   moved the droplets from one that replaced them. Recorded at the end of
   `draw` rather than of `compute`, because core recomputes before it re-inits
   and a value written in `compute` would already be the new one. */
let lastState = null, lastParams = null;
const DATA_KEYS = ["seed", "hot", "hotMt"];

defineWidget({
  slug: "cell-qc",
  title: "Single-Cell RNA-seq: QC",
  subtitle:
    "Droplets are filtered before analysis on three numbers: the genes detected, "
    + "the transcripts counted, and the percentage of transcripts that are "
    + "mitochondrial. The first two measure the same thing twice. The third rises "
    + "both in a cell that is dying and in a sample whose preparation released "
    + "free mitochondrial RNA into every droplet, so one threshold applied across "
    + "every sample can empty one of them and take nothing from the rest. A fourth "
    + "number is not measured on the droplet at all: it is worked out from the "
    + "droplets nearest it.",
  layout: "side",
  status: "draft",
  height: ({ page, w }) => (page === "metrics" ? metricsLayout(w ?? 900).height : HEIGHTS[page]),

  params: {
    page: { type: "segmented", label: "Page", options: PAGES, default: "metrics", display: true },

    dataSec: { type: "section", label: "The data" },
    hot: {
      type: "select", label: "Ambient mitochondrial RNA in",
      detail: "cells that break apart during the preparation release mitochondrial transcripts, which land in every droplet of that sample",
      options: SAMPLE_OPTIONS, default: "p1-liver",
    },
    hotMt: {
      type: "choice", label: "That sample's median mitochondrial %",
      detail: "the level the ambient RNA puts every one of its droplets at; the other three samples sit near 1%",
      options: [2, 8, 15, 25].map((v) => ({ value: String(v), label: `${v}%` })), default: "15",
      when: { param: "hot", not: "none" },
    },
    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },

    filterSec: { type: "section", label: "The filter" },
    genes: {
      type: "int", label: "Genes detected, more than", min: 0, max: 1500, step: 50, default: 500, display: true,
      detail: "how many of the cell's genes were seen at least once",
    },
    counts: {
      type: "int", label: "Transcripts, more than", min: 0, max: 3000, step: 100, default: 800, display: true,
      detail: "how many molecules the droplet held",
    },
    mt: {
      type: "int", label: "Mitochondrial %, less than", min: 1, max: 40, step: 1, default: 10, display: true,
      detail: "the share of a droplet's molecules that came from mitochondrial genes",
    },
    /* NONE BY DEFAULT, which is what the lesson does: it names doublets twice
       and sets no rule for them. The others are scores above which a droplet
       is called — a share of its fifty nearest neighbours, not a count. */
    dbl: {
      type: "choice", label: "Doublet score, at least",
      detail: "the share of a droplet's nearest neighbours that are artificial doublets",
      options: DBL_OPTIONS.map((v) => ({ value: v, label: v === "none" ? "None" : v })),
      default: "none", display: true,
    },
  },

  legend: ({ params }) => {
    if (params.page === "kept") return [
      { token: "empirical", label: "A droplet holding one cell; point at one to read what it holds", mark: "dot" },
      { token: "extreme", label: "A dying cell: its RNA has gone and its mitochondria have not", mark: "dot" },
      { token: "unknown", label: "No cell: ambient RNA only", mark: "dot" },
      { token: "highlight", label: "Two cells in one droplet", mark: "dot" },
      { token: "ink-3", label: "Hollow: a droplet the filter removed", mark: "hollow" },
    ];
    if (params.page === "thresholds") return [
      { token: "empirical", label: "A droplet holding one cell, and on the bar the droplets kept", mark: "dot" },
      { token: "extreme", label: "A dying cell; on the bar, droplets a rule removed", mark: "dot" },
      { token: "unknown", label: "No cell: ambient RNA only", mark: "dot" },
      { token: "highlight", label: "Two cells in one droplet", mark: "dot" },
      { token: "reference", label: "The mitochondrial % now set; point at a droplet, a bar or a curve", mark: "line" },
    ];
    return [
      { token: "empirical", label: "A droplet: point at one in either scatter for its four numbers", mark: "dot" },
      { token: "reference", label: "A rule now set, and an artificial doublet: two droplets added together, drawn as two circles", mark: "dot" },
      { token: "extreme", label: "A droplet the doublet score calls", mark: "dot" },
      { token: "cluster-b", label: "What a droplet holds: one circle is one cell, two joined are two", mark: "dot" },
      { token: "cluster-d", label: "A second colour: those two cells are of different types", mark: "dot" },
    ];
  },

  /* Pure and seeded. The droplets come from the memo, which holds every data
     parameter in its key; `derive` below is the filter and the figures, which
     is what a display parameter changes — and what a slide re-runs per frame
     on the droplets part of the way between two settings. */
  compute: ({ params }) => {
    const { cells, prof, pos } = stageFor(params.seed, params.hot, params.hotMt);
    /* the engine's own names inside, the reader's in the URL: a shareable
       link reads ?genes=500&counts=800&mt=10 (5.9) */
    const thr = {
      nFeature: params.genes, nCount: params.counts, mt: params.mt,
      dbl: params.dbl === "none" ? null : Number(params.dbl),
      /* the fourth metric is drawn on Metrics whether or not its rule is set,
         so the score is wanted there; on Thresholds only if the rule is on */
      wantScores: params.page === "metrics",
      scoreSeed: params.seed * 31 + 7,
    };
    return derive(cells, prof, pos, thr);
  },

  readout: ({ params, state }) => {
    const { tally, overlap, medians, conf, thr } = state;
    const total = SAMPLES.reduce((a, s) => a + tally[s.key].n, 0);
    const kept = SAMPLES.reduce((a, s) => a + tally[s.key].kept, 0);
    if (params.page === "metrics") {
      const hi = SAMPLES.slice().sort((a, b) => medians[b.key].mt - medians[a.key].mt)[0];
      const lo = SAMPLES.slice().sort((a, b) => medians[a.key].mt - medians[b.key].mt)[0];
      const tiles = [
        {
          label: "Median mitochondrial %, highest sample against lowest",
          value: `${fmt(medians[hi.key].mt, 1)} against ${fmt(medians[lo.key].mt, 1)}`,
          note: `${hi.name} and ${lo.name}, of ${tally[hi.key].n} droplets each; every cell type inside a sample sits at that sample's level`,
        },
        {
          label: "Droplets failing either count rule that fail both",
          value: overlap.either ? `${overlap.both} of ${overlap.either}` : "none",
          note: overlap.either
            ? `${Math.round((100 * overlap.both) / overlap.either)}% — the genes detected in a droplet are the molecules it held, counted a second time, so more than ${thr.nCount} transcripts and more than ${thr.nFeature} genes are nearly the same rule`
            : `at more than ${thr.nFeature} genes and more than ${thr.nCount} transcripts neither rule reaches any droplet`,
        },
      ];
      /* the fourth metric's own numbers, beside the first three's: what the
         score caught, and what it cannot catch at any setting */
      const d = state.dbl;
      if (!d) return tiles;
      const n = (f) => d.index.filter((i) => f(state.cells[i])).length;
      const called = (f) => (thr.dbl === null ? 0 : d.index.filter((i) => f(state.cells[i]) && d.score[i] >= thr.dbl).length);
      const het = DBL_ROWS[0].of, hom = DBL_ROWS[1].of, one = DBL_ROWS[2].of;
      const medOf = (f) => fmt(median(d.index.filter((i) => f(state.cells[i])).map((i) => d.score[i])), 2);
      tiles.push({ break: true });
      tiles.push({
        label: "Doublets of two different types called",
        value: `${called(het)} of ${n(het)}`,
        note: thr.dbl === null
          ? `every droplet has a score, and with no rule set none of them is called; their median score is ${medOf(het)}, against ${medOf(one)} for a droplet holding one cell`
          : `at a score of ${fmt(thr.dbl, 1)} or more; their median is ${medOf(het)}, against ${medOf(one)} for a droplet holding one cell, and ${called(one)} of those are called too`,
      });
      tiles.push({
        label: "Doublets of two of the same type called",
        value: `${called(hom)} of ${n(hom)}`,
        note: `a doublet of two cells of one type has that type's profile, so the artificial doublets around it were made from that type too — its median score is ${medOf(hom)}, and no score the rule offers separates it from a droplet holding one cell`,
      });
      return tiles;
    }
    /* THE COST IS A NUMBER NOW, because a removed droplet leaves the figure
       (his round 2). These three tiles are what the page that was cut said. */
    const worst = SAMPLES.slice().sort((a, b) => tally[a.key].kept / tally[a.key].n - tally[b.key].kept / tally[b.key].n)[0];
    const t = tally[worst.key];
    const removed = total - kept;
    return [
      {
        label: "Droplets kept",
        value: `${kept} of ${total}`,
        note: `removed: ${RULES.map((r) => `${SAMPLES.reduce((a, s) => a + tally[s.key].by[r], 0)} ${RULE_NAME[r]}`).join(", ")}`,
      },
      {
        label: `Kept in ${worst.name}, the sample the rules take most from`,
        value: `${Math.round((100 * t.kept) / t.n)}%`,
        note: `its median mitochondrial % is ${fmt(medians[worst.key].mt, 1)}, against ${fmt(median(SAMPLES.filter((s) => s.key !== worst.key).map((s) => medians[s.key].mt)), 1)} in the other three`,
      },
      {
        label: "Removed droplets that held one healthy cell",
        value: removed ? `${conf.removedGood} of ${removed}` : "none removed",
        note: removed
          ? `${Math.round((100 * conf.removedGood) / removed)}% of the removals; ${conf.keptBad} of the ${kept} kept are not one healthy cell — ${conf.keptDoublet} hold two cells, ${conf.keptDying} a dying cell, ${conf.keptEmpty} no cell`
          : `${conf.keptBad} of the droplets on the figure are not one healthy cell`,
      },
    ];
  },

  /* NOTHING IS DRIVEN (his round 2), so this declares the EASES alone and
     marks itself inert, which takes Step and Play out of the drive row. The
     two changes that deserve frames are unchanged: the ambient level moves
     the droplets it belongs to, so it slides; the seed and which sample
     carries it draw different droplets, so they cross-fade. */
  animation: {
    init: ({ params }) => {
      const anim = { data: { t: 1, from: null, kind: null }, easing: false, inert: true, done: true };
      if (lastState && lastParams && DATA_KEYS.some((k) => lastParams[k] !== params[k])) {
        const moved = lastParams.seed === params.seed && lastParams.hot === params.hot;
        anim.data = { t: 0, from: lastState, kind: moved ? "slide" : "fade" };
        anim.easing = true;
      }
      return anim;
    },
    advance: (anim, { dt }) => {
      if (anim.data.t < 1) {
        anim.data.t = Math.min(1, anim.data.t + dt / EASE_MS);
        if (anim.data.t >= 1) anim.data.from = null;
        return anim.data.t < 1;
      }
      return false;
    },
    /* a threshold moved mid-slide lands the slide: the droplets the reader is
       now filtering are the ones the figure is about to hold */
    rebuild: (anim) => {
      if (anim.data.t < 1) { anim.data.t = 1; anim.data.from = null; }
    },
  },

  pointer: true,

  draw: ({ ctx, colors, w, params, state, anim, pointer }) => {
    const D = anim && anim.data.from && anim.data.t < 1 ? { from: anim.data.from, e: easeInOut(anim.data.t), kind: anim.data.kind } : null;
    /* the inspector is the reader's pointer on the figure at rest; mid-ease
       there is no droplet under it that will still be there when it lands */
    const hover = D ? null : hoverAt(pointer, w, params.page, state);
    const one = (st, alpha) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      if (params.page === "metrics") drawMetrics(ctx, colors, w, st, hover);
      else drawThresholds(ctx, colors, w, st, hover);
      ctx.restore();
    };
    if (D && D.kind === "fade") { one(D.from, 1 - D.e); one(state, D.e); }
    else if (D) one(slideState(D.from, state, D.e), 1);
    else one(state, 1);
    lastState = state;
    lastParams = { seed: params.seed, hot: params.hot, hotMt: params.hotMt };
  },
});
