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
 * THREE PAGES (his picks at planning, 2026-09-23, eleven calls with
 * `_lab/cell-qc-mock.html` open, every one the recommendation):
 * Metrics · Thresholds · Truth. The stage is simulated and FITTED to the real
 * cells rather than shaped to resemble them (`./engine.js`): nFeature is not
 * drawn but is how many genes are seen when the droplet's molecules are drawn
 * from its own profile, and mt% is mitochondrial over total — so the overlap
 * between the count rules, the negative correlation and the recovery curve
 * all come back without being written anywhere.
 *
 * THE FILTER IS APPLIED IN THREE PRESSES, genes then transcripts then
 * mitochondrial percentage, because the second press visibly takes almost
 * nothing new and the third takes a whole sample. That argument only exists
 * in the order, which is why Step is the control and not a checkbox.
 *
 * THE THRESHOLDS ARE DISPLAY PARAMETERS. They change which droplets are kept
 * and no droplet's numbers, and a reader who has taken all three presses and
 * then moves a slider must not have the presses undone (invariant 3). The
 * data parameters are the ones that change the droplets themselves — the seed
 * and which sample carries ambient RNA — and those do re-init.
 *
 * THE STAGE IS CACHED by its data parameters, as widget 73's trained models
 * are: a slider tick must not redraw 1,600 droplets from 8,000 genes each.
 */
import { defineWidget, fmt, makePlot } from "../core/index.js";
import { makeRng } from "../core/rng.js";
import { simulate, confusion, embed, median, TYPES, SAMPLES } from "./engine.js";

const PAGES = [
  { value: "metrics", label: "Metrics" },
  { value: "thresholds", label: "Thresholds" },
  { value: "truth", label: "Truth" },
];
const HEIGHTS = { metrics: 580, thresholds: 430, truth: 400 };
const STAGES = 3;                 // genes, transcripts, mitochondrial percentage
const STEP_MS = 700;
const EASE_MS = 450;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2);
const log10 = (v) => Math.log10(Math.max(1, v));
const RULES = ["genes", "transcripts", "mt"];
const RULE_NAME = { genes: "too few genes", transcripts: "too few transcripts", mt: "too high a mitochondrial %" };

/* the three metrics, in the order the lesson prints them (cell 19) */
const METRICS = [
  { key: "nFeature", name: "Genes detected", log: true },
  { key: "nCount", name: "Transcripts", log: true },
  { key: "mt", name: "Mitochondrial %", log: false },
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
  const pos = embed(makeRng(seed * 7919 + 13), sim.cells);
  cached = { key, value: { cells: sim.cells, pos } };
  return cached.value;
}

/* --- geometry, above defineWidget: the module draws once at load ------------ */
const PAD = { l: 52, r: 16, t: 26 };
const violinRect = (w, i) => {
  const each = (w - PAD.l - PAD.r - 2 * 26) / 3;
  return { x: PAD.l + i * (each + 26), y: PAD.t + 4, w: each, h: 190 };
};
const scatterRect = (w, i) => {
  const each = (w - PAD.l - PAD.r - 56) / 2;
  return { x: PAD.l + i * (each + 56), y: 300, w: each, h: 196 };
};
/* THE TWO THRESHOLD PANELS ARE STACKED, not side by side. The harness renders
   every widget in a 900px frame, which puts this canvas at 534px — and side by
   side the sweep was 67px wide there, with its own caption 75px off the right
   edge (the text-overlap sweep, 2026-09-23). Stacked, both panels have the
   whole width at any size, and the bar (what the three rules did) sits above
   the sweep (what every other threshold would have done). */
const barRect = (w) => ({ x: 76, y: 34, w: w - 76 - 46, h: 112 });
const sweepRect = (w) => ({ x: 56, y: 234, w: w - 56 - 72, h: 126 });
const mapRect = (w) => ({ x: 20, y: 30, w: Math.min(300, w * 0.46), h: 300 });
const costRect = (w) => {
  const m = mapRect(w);
  return { x: m.x + m.w + 76, y: 40, w: w - (m.x + m.w + 76) - PAD.r, h: 240 };
};

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

/** The same droplets, outlined rather than filled — a droplet the filter
    removed. Colour carries what the droplet HOLDS and must not also carry
    whether it was removed, so removal is the mark: filled or hollow. */
function hollows(ctx, points, r, stroke, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1;
  for (const [x, y] of points) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

const tickLabel = (v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v)));

/* =========================================================================
   THE HOVER — an inspector, and nothing lives only in it (core's own rule).

   What it is for is different on each page, and on each it is the same
   object seen twice. On Metrics the three numbers are three readings of ONE
   droplet, which the three violins and the two scatters split across five
   panels: pointing at a droplet in either scatter marks it in the other and
   ticks its value in all three violins. On Thresholds a sample is a bar and a
   curve: pointing at either lights both. On Truth a droplet is a position, a
   colour and a fate: pointing at one names them.

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
  const g = mapScale(w, view);
  if (pointer.x < g.rect.x - 6 || pointer.x > g.rect.x + g.rect.w + 6) return null;
  if (pointer.y < g.rect.y - 6 || pointer.y > g.rect.y + g.rect.h + 6) return null;
  let best = -1, bd = 64;
  pos.forEach((q, i) => {
    const d = (pointer.x - g.sx(q.x)) ** 2 + (pointer.y - g.sy(q.y)) ** 2;
    if (d < bd) { bd = d; best = i; }
  });
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
  METRICS.forEach((m, mi) => {
    const rect = violinRect(w, mi);
    const { lo, hi } = axes.violins[mi];
    const plot = makePlot({ ctx, colors, rect, xDomain: [0, SAMPLES.length], yDomain: [lo, hi] });
    plot.caption(m.name);
    plot.axisY({
      ticks: m.log ? Array.from({ length: Math.round(hi - lo) + 1 }, (_, k) => lo + k).filter((t) => Number.isInteger(t))
        : [0, 20, 40, 60].filter((t) => t <= hi),
      format: (t) => (m.log ? tickLabel(10 ** t) : String(t)),
    });
    SAMPLES.forEach((s, si) => {
      const v = cells.filter((c) => c.sample === s.key).map((c) => (m.log ? log10(c[m.key]) : c[m.key]));
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
      if (hover && hover.kind === "droplet" && cells[hover.i].sample === s.key) {
        const c = cells[hover.i];
        const hy = plot.sy(m.log ? log10(c[m.key]) : c[m.key]);
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
    /* the reader's own threshold, on the metric it applies to */
    const t = m.key === "nFeature" ? thr.nFeature : m.key === "nCount" ? thr.nCount : thr.mt;
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
    ctx.fillText(`${m.key === "mt" ? "<" : ">"} ${t}`, rect.x + rect.w, ty + (atFloor ? -13 : -3));
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
  /* ONE DROPLET, FIVE PANELS. Its three numbers are three readings of it, and
     what it holds is not among them — that is the Truth page's to say. */
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
   PAGE 2 · Thresholds — one bar a sample, split by the rule that removed the
   droplet, and the mitochondrial rule swept from 2 to 30 beside it (his pick
   9: the bar is the state, the sweep is the dial).
   ====================================================================== */
function drawThresholds(ctx, colors, w, state, stage, p, hover) {
  const lit = hover && hover.kind === "sample" ? hover.key : null;
  const { tally, sweep, thr } = state;
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
    const y = rect.y + si * rowH + 6;
    const h = rowH - 16;
    const unit = rect.w / t.n;
    /* how much of each rule's removal has arrived. A press increments the
       stage first and then runs its progress, so the rule ARRIVING is index
       stage − 1 and the ones before it are whole. */
    const share = (k) => (k < stage - 1 ? 1 : k === stage - 1 ? p : 0);
    let x = rect.x;
    ctx.save();
    ctx.fillStyle = colors.empirical;
    const removedNow = RULES.reduce((a, r, k) => a + t.by[r] * share(k), 0);
    ctx.fillRect(x, y, (t.n - removedNow) * unit, h);
    x += (t.n - removedNow) * unit;
    ctx.fillStyle = colors.extreme;
    RULES.forEach((r, k) => {
      const seg = t.by[r] * share(k);
      if (seg <= 0) return;
      ctx.fillRect(x, y, seg * unit, h);
      x += seg * unit;
      /* a hairline in the surface colour between one rule's removals and the
         next, so the three arrivals stay legible once all three have landed */
      ctx.save();
      ctx.strokeStyle = colors.surface;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.stroke();
      ctx.restore();
    });
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
    const kept = t.n - removedNow;
    ctx.fillText(`${Math.round((100 * kept) / t.n)}%`, rect.x + rect.w + 8, y + h / 2);
    ctx.restore();
  });
  /* two lines rather than one: the rules applied so far is a long string, and
     on a 550px canvas it printed straight through the word it sits beside */
  ctx.save();
  ctx.font = `${colors.fsXs} ${colors.font}`;
  ctx.textBaseline = "top";
  ctx.fillStyle = colors.empirical;
  ctx.textAlign = "left";
  ctx.fillText("kept", rect.x, rect.y + rect.h + 6);
  ctx.fillStyle = colors.extreme;
  ctx.textAlign = "right";
  ctx.fillText("removed", rect.x + rect.w, rect.y + rect.h + 6);
  if (stage > 0) {
    ctx.fillStyle = colors.ink3;
    ctx.fillText(RULES.slice(0, stage).map((r) => RULE_NAME[r]).join(" · "), rect.x + rect.w, rect.y + rect.h + 20);
  }
  ctx.restore();

  /* A SAMPLE IS A BAR AND A CURVE, and pointing at either lights both: what
     these three rules did to it, and what every other mitochondrial rule
     would have done. */
  if (lit) {
    const t = tally[lit];
    const removed = t.n - t.kept;
    hoverLine(ctx, colors, rect.x, rect.y + rect.h + 40, [
      [SAMPLES.find((sm) => sm.key === lit).name, colors.ink1, "600"],
      [`${t.n} droplets`, colors.ink2],
      [stage > 0 ? `${removed} removed: ${RULES.slice(0, stage).map((r) => `${t.by[r]} ${RULE_NAME[r]}`).join(", ")}` : "no rule applied yet", stage > 0 ? colors.extreme : colors.ink3],
    ]);
  }

  /* the sweep: every mitochondrial threshold this reader could have chosen */
  const sr = sweepRect(w);
  const plot = makePlot({ ctx, colors, rect: sr, xDomain: [2, 30], yDomain: [0, 1] });
  plot.caption("Droplets kept, at every mitochondrial %");
  plot.grid([0, 0.5, 1]);
  plot.axisX({ ticks: [5, 10, 20, 30], format: (t) => String(t), label: "Mitochondrial % rule" });
  plot.axisY({ ticks: [0, 0.5, 1], format: (t) => `${Math.round(t * 100)}%` });
  for (const s of SAMPLES) {
    plot.curve(sweep[s.key].map((v, k) => [2 + k * 0.5, v]),
      { stroke: lit === s.key ? colors.highlight : colors.empirical, width: lit === s.key ? 2.4 : 1.6 });
  }
  /* the four names at the ends of their own curves, pushed apart where the
     curves arrive together — three of the four end within two points of each
     other, which is the fact, and stacked labels are not a way to say it */
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
   PAGE 3 · Truth — what the removed droplets held. Position is the cell type
   and colour is the state (his pick 4); the doublet panel beside it is the
   lesson's other sentence, answered (his pick 5).
   ====================================================================== */
const STATE_COLOUR = (colors) => ({
  good: colors.empirical, dying: colors.extreme, empty: colors.unknown, doublet: colors.highlight,
});

function drawTruth(ctx, colors, w, state, stage, p, hover) {
  const { cells, pos, view, removedAt, centres, cost } = state;
  const SC = STATE_COLOUR(colors);
  const { rect, sx, sy } = mapScale(w, view);
  ctx.save();
  ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  ctx.fillStyle = colors.ink2;
  ctx.textAlign = "left";
  ctx.fillText("Every droplet, placed by what was sequenced in it", rect.x, rect.y - 10);
  ctx.restore();
  /* how far a droplet has been removed: 0 while its rule has not been pressed */
  const gone = (i) => {
    const r = removedAt[i];
    if (!r) return 0;
    return stage > r ? 1 : stage === r ? p : 0;
  };
  for (const st of ["good", "empty", "dying", "doublet"]) {
    const here = [], leaving = [], gone1 = [];
    cells.forEach((c, i) => {
      if (c.state !== st) return;
      const g = gone(i);
      (g === 0 ? here : g === 1 ? gone1 : leaving).push([sx(pos[i].x), sy(pos[i].y), g]);
    });
    const r = st === "good" ? 1.9 : 2.3;
    const a = st === "good" ? 0.5 : 0.9;
    dots(ctx, here, r, SC[st], a);
    hollows(ctx, gone1, r, SC[st], st === "good" ? 0.55 : 0.8);
    /* THE PRESS EMPTIES A DROPLET RATHER THAN SWAPPING IT. Only the rule now
       arriving has droplets part of the way, so this set is small: each is
       drawn twice, its fill fading out as its outline comes in. A hard flip at
       the halfway point read as a different mark appearing, not as the same
       droplet being removed. */
    for (const [x, y, g] of leaving) {
      dots(ctx, [[x, y]], r, SC[st], a * (1 - g));
      hollows(ctx, [[x, y]], r, SC[st], (st === "good" ? 0.55 : 0.8) * g);
    }
  }
  /* the six populations, named where their own cells are */
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
  /* A DROPLET IS A POSITION, A COLOUR AND A FATE, and the map can only draw
     the first two. Pointing at one says all three, with the three numbers the
     rules were read from. */
  if (hover && hover.kind === "droplet") {
    const c = cells[hover.i], r = removedAt[hover.i];
    ringAt(ctx, colors, sx(pos[hover.i].x), sy(pos[hover.i].y), 6);
    const heldBy = { good: "one cell", dying: "a dying cell", empty: "no cell, ambient RNA only", doublet: "two cells" }[c.state];
    const type = c.state === "empty" ? "" : c.partner
      ? `${TYPES.find((t) => t.key === c.type).name.toLowerCase()} and ${TYPES.find((t) => t.key === c.partner).name.toLowerCase()}`
      : TYPES.find((t) => t.key === c.type).name.toLowerCase();
    hoverLine(ctx, colors, rect.x, rect.y + rect.h + 16, [
      [heldBy, SC[c.state], "600"],
      [type, colors.ink3],
    ]);
    hoverLine(ctx, colors, rect.x, rect.y + rect.h + 32, [
      [`${bigCount(c.nCount)} transcripts`, colors.ink2],
      [`${bigCount(c.nFeature)} genes`, colors.ink2],
      [`${fmt(c.mt, 1)}% mitochondrial`, colors.ink2],
    ]);
    hoverLine(ctx, colors, rect.x, rect.y + rect.h + 48, [
      [r && stage >= r ? `removed: ${RULE_NAME[RULES[r - 1]]}` : stage >= STAGES ? "kept" : "still here", r && stage >= r ? colors.extreme : colors.empirical, "600"],
    ]);
  }

  /* the doublet panel: every upper cut on genes detected, what it catches
     against what it costs */
  const cr = costRect(w);
  const plot = makePlot({ ctx, colors, rect: cr, xDomain: [0, Math.max(10, cost.maxLost)], yDomain: [0, Math.max(1, cost.nDoublet)] });
  plot.caption("An upper rule on genes detected");
  plot.note("one point a cut");
  plot.axisX({ label: "Good cells removed with them" });
  plot.axisY({ label: `Doublets caught, of ${cost.nDoublet}` });
  plot.curve(cost.curve, { stroke: colors.highlight, width: 1.8 });
  for (const m of cost.marks) {
    plot.dot(m.lost, m.caught, { fill: colors.reference, r: 3.5 });
    ctx.save();
    ctx.fillStyle = colors.reference;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(` ${m.pct}th`, plot.sx(m.lost), plot.sy(m.caught));
    ctx.restore();
  }
}

/* --- the tallies the pages read ------------------------------------------- */
function tallyBy(cells, removedAt) {
  const t = {};
  for (const s of SAMPLES) t[s.key] = { n: 0, kept: 0, by: { genes: 0, transcripts: 0, mt: 0 } };
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
function derive(cells, pos, thr) {
    /* the panels' own ranges, worked out once from the droplets rather than
       per frame inside the drawing, so a hover resolves against exactly the
       scales the picture was painted with */
    const axes = {
      violins: METRICS.map((m) => {
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

    /* the map's six centres, from the droplets whose profile was measured best */
    const centres = {};
    for (const t of TYPES) {
      const g = cells.map((c, i) => i).filter((i) => cells[i].type === t.key && cells[i].state === "good" && cells[i].nCount > 4000);
      if (g.length >= 8) centres[t.key] = [g.reduce((s, i) => s + pos[i].x, 0) / g.length, g.reduce((s, i) => s + pos[i].y, 0) / g.length];
    }

    /* the doublet cost curve: every upper cut from the 99.5th percentile down */
    const good = cells.filter((c) => c.state === "good");
    const dbl = cells.filter((c) => c.state === "doublet");
    const sortedF = Float64Array.from(cells.map((c) => c.nFeature)).sort();
    const at = (pctile) => sortedF[Math.min(sortedF.length - 1, Math.floor((pctile / 100) * sortedF.length))];
    const caught = (cut) => dbl.filter((c) => c.nFeature >= cut).length;
    const lostAt = (cut) => good.filter((c) => c.nFeature >= cut).length;
    const curve = [];
    for (let pc = 99.5; pc >= 80; pc -= 0.5) { const cut = at(pc); curve.push([lostAt(cut), caught(cut)]); }
    const marks = [95, 90].map((pc) => ({ pct: pc, lost: lostAt(at(pc)), caught: caught(at(pc)) }));
    const cost = {
      curve, marks, nDoublet: dbl.length, maxLost: lostAt(at(80)),
      ninety: { lost: lostAt(at(90)), caught: caught(at(90)) },
    };

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
    return { cells, pos, view, axes, thr, removedAt, keep, tally, sweep, centres, cost, conf, overlap: { either, both }, medians };
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
  const st = derive(cells, pos, to.thr);
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
    + "samples can remove most of one of them while removing nothing from the rest.",
  layout: "side",
  status: "draft",
  height: ({ page }) => HEIGHTS[page] ?? HEIGHTS.metrics,

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
      detail: "the share of those molecules that came from mitochondrial genes",
    },

    /* authoring escape hatch, first render only: presses already taken */
    shown: { type: "int", min: 0, max: STAGES, default: 0, hidden: true },
  },

  legend: ({ params }) => {
    if (params.page === "truth") return [
      { token: "empirical", label: "A droplet holding one cell; point at one to read what it holds", mark: "dot" },
      { token: "extreme", label: "A dying cell: its RNA has gone and its mitochondria have not", mark: "dot" },
      { token: "unknown", label: "No cell: ambient RNA only", mark: "dot" },
      { token: "highlight", label: "Two cells in one droplet", mark: "dot" },
      { token: "ink-3", label: "Hollow: a droplet the filter removed", mark: "hollow" },
    ];
    if (params.page === "thresholds") return [
      { token: "empirical", label: "Droplets the three rules keep; point at a bar or a curve for one sample", mark: "bar" },
      { token: "extreme", label: "Droplets a rule removed, in the order the rules were applied", mark: "bar" },
      { token: "reference", label: "The mitochondrial % now set", mark: "line" },
    ];
    return [
      { token: "empirical", label: "A droplet: point at one in either scatter for its three numbers", mark: "dot" },
      { token: "reference", label: "A threshold now set", mark: "line" },
    ];
  },

  /* Pure and seeded. The droplets come from the memo, which holds every data
     parameter in its key; `derive` below is the filter and the figures, which
     is what a display parameter changes — and what a slide re-runs per frame
     on the droplets part of the way between two settings. */
  compute: ({ params }) => {
    const { cells, pos } = stageFor(params.seed, params.hot, params.hotMt);
    /* the engine's own names inside, the reader's in the URL: a shareable
       link reads ?genes=500&counts=800&mt=10 (5.9) */
    const thr = { nFeature: params.genes, nCount: params.counts, mt: params.mt };
    return derive(cells, pos, thr);
  },

  readout: ({ params, state, anim }) => {
    const stage = anim ? anim.n : Number(params.shown) || 0;
    const { tally, conf, overlap, medians, cost, thr, sweep } = state;
    const total = SAMPLES.reduce((a, s) => a + tally[s.key].n, 0);
    const kept = SAMPLES.reduce((a, s) => a + tally[s.key].kept, 0);
    if (params.page === "metrics") {
      const hi = SAMPLES.slice().sort((a, b) => medians[b.key].mt - medians[a.key].mt)[0];
      const lo = SAMPLES.slice().sort((a, b) => medians[a.key].mt - medians[b.key].mt)[0];
      return [
        {
          label: "Median mitochondrial %, highest sample against lowest",
          value: `${fmt(medians[hi.key].mt, 1)} against ${fmt(medians[lo.key].mt, 1)}`,
          note: `${hi.name} and ${lo.name}, of ${tally[hi.key].n} droplets each; every cell type inside a sample sits at that sample's level`,
        },
        {
          label: "Droplets failing either count rule that fail both",
          value: overlap.either ? `${overlap.both} of ${overlap.either}` : "none yet",
          note: overlap.either
            ? `${Math.round((100 * overlap.both) / overlap.either)}% — the genes a droplet shows are the molecules it held, counted a second time, so more than ${thr.nCount} transcripts and more than ${thr.nFeature} genes are close to one rule`
            : `at more than ${thr.nFeature} genes and more than ${thr.nCount} transcripts neither rule reaches any droplet`,
        },
      ];
    }
    if (params.page === "thresholds") {
      const worst = SAMPLES.slice().sort((a, b) => tally[a.key].kept / tally[a.key].n - tally[b.key].kept / tally[b.key].n)[0];
      const t = tally[worst.key];
      const at20 = sweep[worst.key][Math.round((20 - 2) / 0.5)];
      return [
        {
          label: "Droplets kept",
          value: stage >= STAGES ? `${kept} of ${total}` : `${total}`,
          note: stage >= STAGES
            ? `too few genes ${SAMPLES.reduce((a, s) => a + tally[s.key].by.genes, 0)}, too few transcripts ${SAMPLES.reduce((a, s) => a + tally[s.key].by.transcripts, 0)}, too high a mitochondrial % ${SAMPLES.reduce((a, s) => a + tally[s.key].by.mt, 0)}`
            : "none of the three rules has been applied yet",
        },
        {
          label: `Kept in ${worst.name}, the sample that keeps fewest`,
          value: stage >= STAGES ? `${Math.round((100 * t.kept) / t.n)}%` : "—",
          note: stage >= STAGES
            ? `${Math.round(100 * at20)}% of it would be kept at a mitochondrial rule of 20 instead of ${thr.mt}; its median is ${fmt(medians[worst.key].mt, 1)}%`
            : "take the three presses",
        },
      ];
    }
    return [
      {
        label: "Removed droplets that held one good cell",
        value: stage >= STAGES ? `${conf.removedGood} of ${conf.removedGood + conf.removedBad}` : "—",
        note: stage >= STAGES
          ? `${Math.round((100 * conf.removedGood) / Math.max(1, conf.removedGood + conf.removedBad))}% of the removals; the other ${conf.removedBad} held a dying cell, two cells, or no cell at all`
          : "take the three presses",
      },
      {
        label: "Kept droplets that do not hold one good cell",
        value: stage >= STAGES ? `${conf.keptBad} of ${conf.keptGood + conf.keptBad}` : "—",
        note: stage >= STAGES ? `${conf.keptDoublet} hold two cells, ${conf.keptDying} a dying cell, ${conf.keptEmpty} no cell` : "take the three presses",
      },
      {
        label: "Good cells removed for each doublet caught",
        value: cost.ninety.caught ? fmt(cost.ninety.lost / cost.ninety.caught, 1) : "—",
        note: cost.ninety.caught
          ? `at an upper rule on the 90th percentile of genes detected, which catches ${cost.ninety.caught} of the ${cost.nDoublet} doublets`
          : "no doublet reaches that cut",
      },
    ];
  },

  animation: {
    stepLabel: {
      anim: "labelAt",
      labels: {
        s0: "Remove too few genes",
        s1: "Remove too few transcripts",
        s2: "Remove too high a mitochondrial %",
        done: "Step",
      },
      default: "Step",
    },
    stepTitle: {
      anim: "labelAt",
      labels: {
        s0: "Remove every droplet showing fewer genes than the rule allows",
        s1: "Remove every droplet holding fewer transcripts than the rule allows — the genes it showed were those molecules counted again",
        s2: "Remove every droplet whose mitochondrial share is above the rule",
        done: "All three rules have been applied",
      },
      default: "Apply the next rule",
    },
    runLabel: null,
    init: ({ params, fromScratch }) => {
      const anim = { n: 0, p: 1, halt: false, data: { t: 1, from: null, kind: null }, easing: false, labelAt: "s0", done: false, inert: false };
      if (!fromScratch) anim.n = Math.min(STAGES, Math.max(0, Number(params.shown) || 0));
      if (lastState && lastParams && DATA_KEYS.some((k) => lastParams[k] !== params[k])) {
        /* the ambient LEVEL moves the droplets it belongs to; the seed and
           which sample carries it draw different droplets altogether */
        const moved = lastParams.seed === params.seed && lastParams.hot === params.hot;
        anim.data = { t: 0, from: lastState, kind: moved ? "slide" : "fade" };
        anim.easing = true;
      }
      settle(anim, params);
      return anim;
    },
    advance: (anim, { dt, params }) => {
      if (anim.mode === "ease") {
        if (anim.data.t < 1) {
          anim.data.t = Math.min(1, anim.data.t + dt / EASE_MS);
          if (anim.data.t >= 1) anim.data.from = null;
          return anim.data.t < 1;
        }
        return false;
      }
      /* the loop left running for a press that `rebuild` finished ends here,
         before it takes the next rule unasked (widget 70's halt, 2026-09-19) */
      if (anim.halt) { anim.halt = false; settle(anim, params); return false; }
      if (anim.p >= 1) {
        if (anim.n >= STAGES) { settle(anim, params); return false; }
        anim.n += 1; anim.p = 0;
      }
      anim.p = Math.min(1, anim.p + dt / STEP_MS);
      if (anim.p >= 1) { settle(anim, params); return false; }
      return true;
    },
    /* A display change — a page, or any of the three thresholds — must not
       undo the presses. A page switch mid-press finishes that press where it
       was, which is the 2026-09-20 sweep's rule. */
    rebuild: (anim, { params }) => {
      /* A PRESS BELONGS TO THE MOMENT IT STARTED IN. Core keeps a running loop
         going through a display change, so a page switch or a threshold moved
         mid-press used to let the next frame take the NEXT rule unasked — the
         switch probe flags exactly that. The press finishes here as if its
         frames had run, and `halt` ends the loop at its next frame; only while
         one is moving, or it would swallow the first frame of the reader's
         next press. */
      if (anim.p < 1) { anim.p = 1; anim.halt = true; }
      /* a threshold moved mid-slide lands the slide: the droplets the reader
         is now filtering are the ones the figure is about to hold */
      if (anim.data.t < 1) { anim.data.t = 1; anim.data.from = null; }
      settle(anim, params);
    },
  },

  pointer: true,

  draw: ({ ctx, colors, w, params, state, anim, pointer }) => {
    const stage = anim ? anim.n : Number(params.shown) || 0;
    const p = anim && anim.p < 1 ? easeInOut(anim.p) : 1;
    const D = anim && anim.data.from && anim.data.t < 1 ? { from: anim.data.from, e: easeInOut(anim.data.t), kind: anim.data.kind } : null;
    /* the inspector is the reader's pointer on the figure at rest; mid-ease
       there is no droplet under it that will still be there when it lands */
    const hover = D ? null : hoverAt(pointer, w, params.page, state);
    const one = (st, alpha) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      if (params.page === "metrics") drawMetrics(ctx, colors, w, st, hover);
      else if (params.page === "thresholds") drawThresholds(ctx, colors, w, st, stage, p, hover);
      else drawTruth(ctx, colors, w, st, stage, p, hover);
      ctx.restore();
    };
    if (D && D.kind === "fade") { one(D.from, 1 - D.e); one(state, D.e); }
    else if (D) one(slideState(D.from, state, D.e), 1);
    else one(state, 1);
    lastState = state;
    lastParams = { seed: params.seed, hot: params.hot, hotMt: params.hotMt };
  },
});

/* Core reads `done` and `inert`; the page with nothing to step has neither. */
function settle(anim, params) {
  anim.inert = params.page === "metrics";
  anim.done = anim.n >= STAGES && anim.p >= 1;
  anim.labelAt = anim.done ? "done" : `s${Math.min(STAGES - 1, anim.n)}`;
}
