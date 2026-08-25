/* The five-stage narrative for widget 18, mocked up. Nothing here ships.
 *
 * Drawn with the widget's own `model.js` at the widget's own 560 px panel, so
 * the pictures are the pictures. What is NOT real here is the gating mechanism:
 * this page fakes the rail, because core's `when` has no "from stage N onwards"
 * and adding one is a change to a file every widget shares.
 */
import { makeRng } from "../core/rng.js";
import { makePlot, createCanvas } from "../core/canvas.js";
import { readTokens } from "../core/env.js";
import * as M from "../balancing-data/model.js";

export const SIDE = 560;
const PAD_L = 44, PAD_R = 12, PAD_T = 22, PAD_B = 40;

/* THE COHORT: both classes fully sampled. Rarity is then a REMOVAL from this,
   not a redraw — so 5% is a subset of 10% is a subset of 40%, the majority
   never moves, and the dial is visibly a loss. */
export const N_MAJ = 150, N_MIN_POOL = 150;
export const SHARES = [0.4, 0.2, 0.1, 0.05];
export const K_OPTIONS = [1, 3, 5];
export const keepFor = (share) => Math.round((N_MAJ * share) / (1 - share));

export function cohort(rng) {
  /* makeStage returns 200 points, so one call cannot fill 150 + 150 — it yields
     100 of each and every share comes out wrong while the numbers still look
     plausible. Measured the hard way. */
  const maj = [], min = [];
  while (maj.length < N_MAJ || min.length < N_MIN_POOL) {
    for (const p of M.makeStage(rng, 0.5)) {
      if (p.y === M.MAJORITY) { if (maj.length < N_MAJ) maj.push(p); }
      else if (min.length < N_MIN_POOL) min.push(p);
    }
  }
  return { maj, min };
}

/* ---- the ground truth ---------------------------------------------------- */

/* The rule that actually generated the patients. A CURVE, not a line: the two
   clouds have different spreads — majority sd (1.7, 1.9), minority (1.3, 1.6) —
   so the optimal rule is a conic. Traced by scanning each row for sign changes
   rather than solved, because the conic has two branches and the second one
   matters at the edges of the frame. */
const MAJ_MU = [3.7, 5.0], MAJ_SD = [1.7, 1.9];
const MIN_MU = [6.6, 5.0], MIN_SD = [1.3, 1.6];
const logp = (x1, x2, mu, sd) =>
  -0.5 * (((x1 - mu[0]) / sd[0]) ** 2 + ((x2 - mu[1]) / sd[1]) ** 2)
  - Math.log(sd[0]) - Math.log(sd[1]);
export const truthAt = (x1, x2) =>
  logp(x1, x2, MIN_MU, MIN_SD) - logp(x1, x2, MAJ_MU, MAJ_SD);

export function truthCurves() {
  const [lo, hi] = M.DOMAIN, N = 240;
  const left = [], right = [];
  for (let i = 0; i <= N; i += 1) {
    const x2 = lo + ((hi - lo) * i) / N;
    const roots = [];
    let prev = truthAt(lo, x2);
    for (let j = 1; j <= N; j += 1) {
      const x1 = lo + ((hi - lo) * j) / N;
      const cur = truthAt(x1, x2);
      if ((prev > 0) !== (cur > 0)) {
        const a = lo + ((hi - lo) * (j - 1)) / N;
        roots.push(a + ((hi - lo) / N) * (prev / (prev - cur)));
      }
      prev = cur;
    }
    if (roots.length >= 1) left.push([roots[0], x2]);
    if (roots.length >= 2) right.push([roots[roots.length - 1], x2]);
  }
  return [left, right].filter((c) => c.length > 1);
}

/* ---- drawing ------------------------------------------------------------- */

function lineAcross(fit) {
  const [lo, hi] = M.DOMAIN;
  if (Math.abs(fit.b2) > 1e-9) {
    return [[lo, -(fit.b0 + fit.b1 * lo) / fit.b2], [hi, -(fit.b0 + fit.b1 * hi) / fit.b2]];
  }
  return [[-(fit.b0 + fit.b2 * lo) / fit.b1, lo], [-(fit.b0 + fit.b2 * hi) / fit.b1, hi]];
}

function stroke(ctx, P, pts, { colour, width = 2, dash = null, alpha = 1 }) {
  ctx.save();
  ctx.beginPath(); ctx.rect(P.x, P.y, P.w, P.h); ctx.clip();
  ctx.globalAlpha = alpha; ctx.strokeStyle = colour; ctx.lineWidth = width;
  ctx.lineJoin = "round"; ctx.lineCap = "round";
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(P.sx(pts[0][0]), P.sy(pts[0][1]));
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(P.sx(pts[i][0]), P.sy(pts[i][1]));
  ctx.stroke();
  ctx.restore();
}

function band(ctx, P, polys, colour) {
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = colour;
  for (const poly of polys) {
    ctx.beginPath();
    ctx.moveTo(P.sx(poly[0][0]), P.sy(poly[0][1]));
    for (let i = 1; i < poly.length; i += 1) ctx.lineTo(P.sx(poly[i][0]), P.sy(poly[i][1]));
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function dot(ctx, P, colors, p, { alpha = 1, scale = 1, ring = 0 } = {}) {
  const r = 3.4 * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = p.y === M.MINORITY ? colors.event : colors.nonevent;
  ctx.beginPath(); ctx.arc(P.sx(p.x1), P.sy(p.x2), r, 0, Math.PI * 2); ctx.fill();
  if (ring > 0) {
    ctx.strokeStyle = colors.event; ctx.lineWidth = 1.2; ctx.globalAlpha = alpha * 0.85;
    ctx.beginPath(); ctx.arc(P.sx(p.x1), P.sy(p.x2), r + 2.2 + 1.6 * Math.min(ring, 4), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** A case rarity removed: outline only, so the loss is visible rather than told. */
function lost(ctx, P, colors, p) {
  ctx.save();
  ctx.globalAlpha = 0.42;
  ctx.strokeStyle = colors.event;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.beginPath(); ctx.arc(P.sx(p.x1), P.sy(p.x2), 3.2, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function hollow(ctx, P, colors, p, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha; ctx.strokeStyle = colors.event; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(P.sx(p.x1), P.sy(p.x2), 3.2, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function lineKey(ctx, colors, P, items, caption) {
  const SW = 16, GT = 5, GI = 12;
  ctx.save();
  ctx.font = `600 ${colors.fsSm} ${colors.font}`;
  const capRight = P.x + ctx.measureText(caption).width;
  ctx.font = `${colors.fsXs} ${colors.font}`;
  const widths = items.map((it) => SW + GT + ctx.measureText(it.label).width);
  const total = widths.reduce((a, b) => a + b, 0) + GI * (items.length - 1);
  const drop = P.x + P.w - total < capRight + 14;
  const y = drop ? P.y + 9 : P.y - 12;
  let x = P.x + P.w - total;
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  items.forEach((it, i) => {
    ctx.strokeStyle = it.colour; ctx.lineWidth = it.dash ? 1.4 : 2.2;
    ctx.setLineDash(it.dash ? [4, 3] : []);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + SW, y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = it.colour;
    ctx.fillText(it.label, x + SW + GT, y + 0.5);
    x += widths[i] + GI;
  });
  ctx.restore();
}

/* ---- one stage ----------------------------------------------------------- */

export const STAGES = ["cohort", "rare", "sample", "split", "balance"];

/**
 * Draw the figure as it stands at `stage`, with the controls that stage has
 * revealed already set to `opts`.
 */
export function drawStage(host, opts) {
  const { stage, share, method, k, seed, trainOnly, progress } = opts;
  const colors = readTokens();
  const rng = makeRng(seed);
  const { maj, min } = cohort(rng);
  const keep = keepFor(share);
  const kept = min.slice(0, keep);
  const dropped = min.slice(keep);
  const pts = maj.concat(kept);

  /* The 80/20 split, drawn from a stream of its own so it does not shift when
     the method changes. */
  const held = new Set();
  {
    const r = makeRng(seed + 555);
    const idx = pts.map((_, i) => i);
    const majIdx = idx.filter((i) => pts[i].y === M.MAJORITY);
    const minIdx = idx.filter((i) => pts[i].y === M.MINORITY);
    for (const i of r.shuffle(majIdx).slice(0, Math.round(majIdx.length * 0.2))) held.add(i);
    for (const i of r.shuffle(minIdx).slice(0, Math.max(1, Math.round(minIdx.length * 0.2)))) held.add(i);
  }
  const source = trainOnly ? pts.filter((_, i) => !held.has(i)) : pts;

  /* Plans, and the fit at the current point along one. */
  const rr = makeRng(seed + 31);
  let plan = [];
  if (stage === "balance") {
    if (method === "over") plan = M.overPlan(source, rr);
    else if (method === "under") plan = M.underPlan(source, rr);
    else if (method === "smote") plan = M.smotePlan(source, Math.min(k, keep - 1), rr);
  }
  const shown = Math.round((progress ?? 1) * plan.length);
  const dropIdx = new Set(), made = [], added = [];
  const copies = new Map();
  for (let i = 0; i < shown; i += 1) {
    const e = plan[i];
    if (e.drop !== undefined) { dropIdx.add(e.drop); continue; }
    /* `added` feeds the MODEL, `made` and `copies` only feed the picture. A
       random copy lands exactly on its parent, so it is drawn as a ring rather
       than as a new dot — and an earlier version therefore left copies out of
       the fit entirely, which made Oversample score identically to doing
       nothing. Two lists, because one of them is a drawing decision. */
    added.push({ x1: e.x1, x2: e.x2, y: M.MINORITY });
    if (method === "over") copies.set(e.parent, (copies.get(e.parent) ?? 0) + 1);
    else made.push(e);
  }
  const weights = method === "weights" ? M.balancedWeights(source) : null;
  const fitSet = source.filter((_, i) => !dropIdx.has(i)).concat(added);

  const whole = M.fitLogistic(maj.concat(min));       // the line the full cohort gives
  const rareFit = M.fitLogistic(source);              // what rarity leaves you with
  const now = stage === "balance" ? M.fitLogistic(fitSet, { weights }) : rareFit;

  const CAPTIONS = {
    cohort: "every case, and the rule that decides them",
    rare: "the same cohort, with the outcome made rare",
    sample: "the cases we actually collected",
    split: trainOnly ? "the training set, with the test set held back" : "the cases we actually collected",
    balance: "the training set, and where the model cuts it",
  };
  const caption = CAPTIONS[stage];

  const surface = createCanvas(host, PAD_T + SIDE + PAD_B);
  const { w } = surface.resize(null);
  surface.clear();
  const ctx = surface.ctx;
  const rect = { x: PAD_L, y: PAD_T, w: Math.min(SIDE, w - PAD_L - PAD_R), h: SIDE };
  const P = makePlot({ ctx, colors, rect, xDomain: M.DOMAIN, yDomain: M.DOMAIN });
  P.caption(caption);
  ctx.save(); ctx.strokeStyle = colors.grid; ctx.lineWidth = 1;
  ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1); ctx.restore();
  P.axisX({ ticks: [0, 2, 4, 6, 8, 10], label: "x₁" });
  P.axisY({ ticks: [0, 2, 4, 6, 8, 10], label: "x₂" });

  /* The gap band, only once there is a gap worth naming. */
  if (stage === "sample" || stage === "split" || stage === "balance") {
    band(ctx, P, M.disagreementRegion(now, whole), colors.theory);
  }

  /* Dots. Order matters: lost cases behind, live cases in front. */
  if (stage !== "cohort") for (const p of dropped) lost(ctx, P, colors, p);
  const showSet = stage === "cohort" ? maj.concat(min) : pts;
  showSet.forEach((p, i) => {
    if (stage === "cohort") { dot(ctx, P, colors, p); return; }
    const isHeld = held.has(i);
    if (dropIdx.has(i)) { lost(ctx, P, colors, p); return; }
    const fade = (stage === "split" || stage === "balance") && trainOnly && isHeld ? 0.22 : 1;
    dot(ctx, P, colors, p, {
      alpha: fade,
      scale: weights ? Math.sqrt(weights[p.y]) : 1,
      ring: copies.get(i) ?? 0,
    });
  });
  for (const e of made) hollow(ctx, P, colors, e, 0.8);

  /* Lines, and the key that names them. */
  const key = [];
  if (stage === "cohort") {
    for (const c of truthCurves()) stroke(ctx, P, c, { colour: colors.smoothed, width: 2.4 });
    key.push({ colour: colors.smoothed, label: "the true rule" });
  } else {
    stroke(ctx, P, lineAcross(whole), { colour: colors.theory, width: 2 });
    key.push({ colour: colors.theory, label: "whole cohort" });
    if (stage === "balance" && method !== "none") {
      stroke(ctx, P, lineAcross(rareFit), { colour: colors.reference, width: 1.4, dash: [5, 4], alpha: 0.85 });
      key.push({ colour: colors.reference, label: "before", dash: true });
    }
    stroke(ctx, P, lineAcross(now), { colour: colors.highlight, width: 2.4 });
    key.push({ colour: colors.highlight, label: "now" });
  }
  lineKey(ctx, colors, P, key, caption);

  const test = M.makeTest(makeRng(seed + 9000), share);
  return {
    keep, lost: dropped.length, plan: plan.length, shown,
    nMaj: maj.length, held: held.size, source: source.length,
    gap: stage === "cohort" ? null : M.disagreement(now, whole, test),
    gapRare: M.disagreement(rareFit, whole, test),
    score: M.score(now, test),
    scoreRare: M.score(rareFit, test),
  };
}
