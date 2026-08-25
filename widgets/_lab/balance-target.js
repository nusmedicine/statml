/* Mock-ups for widget 18's "ideal world" line. Nothing here ships.
 *
 * Draws with the widget's OWN model.js, at the widget's own panel width, so the
 * lines are the lines and not an impression of them.
 */
import { makeRng } from "../core/rng.js";
import { makePlot, createCanvas } from "../core/canvas.js";
import { readTokens } from "../core/env.js";
import * as M from "../balancing-data/model.js";

const SIDE = 560;
const PAD_L = 44, PAD_R = 12, PAD_T = 22, PAD_B = 40;

/* THE TARGET: the same logistic model, fitted where the two classes are equally
   common. Computed once from a large fixed sample, because it is a property of
   the two clouds and not of the reader's draw — across six seeds it crosses
   x2 = 5 within 0.07 of a 10-unit axis, which is four pixels. */
export function idealFit() {
  const rng = makeRng(20250825);
  const pts = [];
  while (pts.length < 40000) pts.push(...M.makeStage(rng, 0.5));
  return M.fitLogistic(pts);
}

/* A judging population, fixed, used for every "how far apart are these two
   lines" number on the page. */
const POP = (() => {
  const rng = makeRng(4242);
  const out = [];
  for (let i = 0; i < 30; i += 1) out.push(...M.makeStage(rng, 0.5));
  return out;
})();

const side = (f, p) => f.b0 + f.b1 * p.x1 + f.b2 * p.x2 > 0;
export function disagree(a, b) {
  let n = 0;
  for (const p of POP) if (side(a, p) !== side(b, p)) n += 1;
  return n / POP.length;
}

export function buildSet(pts, method, k, rng) {
  if (method === "over") {
    return { set: pts.concat(M.overPlan(pts, rng).map((e) => ({ x1: e.x1, x2: e.x2, y: M.MINORITY }))), weights: null };
  }
  if (method === "under") {
    const drop = new Set(M.underPlan(pts, rng).map((e) => e.drop));
    return { set: pts.filter((_, i) => !drop.has(i)), weights: null, drop };
  }
  if (method === "smote") {
    const plan = M.smotePlan(pts, k, rng);
    return { set: pts.concat(plan.map((e) => ({ x1: e.x1, x2: e.x2, y: M.MINORITY }))), weights: null, plan };
  }
  if (method === "weights") return { set: pts, weights: M.balancedWeights(pts) };
  return { set: pts, weights: null };
}

/* --- drawing -------------------------------------------------------------- */

function lineAcross(P, fit) {
  const [lo, hi] = M.DOMAIN;
  if (Math.abs(fit.b2) > 1e-9) {
    return [[lo, -(fit.b0 + fit.b1 * lo) / fit.b2], [hi, -(fit.b0 + fit.b1 * hi) / fit.b2]];
  }
  return [[-(fit.b0 + fit.b2 * lo) / fit.b1, lo], [-(fit.b0 + fit.b2 * hi) / fit.b1, hi]];
}

function stroke(ctx, P, fit, { colour, width = 2, dash = null, alpha = 1 }) {
  const pts = lineAcross(P, fit);
  ctx.save();
  ctx.beginPath(); ctx.rect(P.x, P.y, P.w, P.h); ctx.clip();
  ctx.globalAlpha = alpha; ctx.strokeStyle = colour; ctx.lineWidth = width;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(P.sx(pts[0][0]), P.sy(pts[0][1]));
  ctx.lineTo(P.sx(pts[1][0]), P.sy(pts[1][1]));
  ctx.stroke();
  ctx.restore();
}

/** The plane between two lines, washed — "this is the ground still to cover". */
function bandBetween(ctx, P, a, b, colour) {
  const A = lineAcross(P, a), B = lineAcross(P, b);
  ctx.save();
  ctx.beginPath(); ctx.rect(P.x, P.y, P.w, P.h); ctx.clip();
  ctx.globalAlpha = 0.13; ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(P.sx(A[0][0]), P.sy(A[0][1]));
  ctx.lineTo(P.sx(A[1][0]), P.sy(A[1][1]));
  ctx.lineTo(P.sx(B[1][0]), P.sy(B[1][1]));
  ctx.lineTo(P.sx(B[0][0]), P.sy(B[0][1]));
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

function dots(ctx, P, pts, colors, { drop, plan, weights } = {}) {
  pts.forEach((p, i) => {
    ctx.save();
    if (drop?.has(i)) {
      ctx.globalAlpha = 0.5; ctx.strokeStyle = colors.reference;
      ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.arc(P.sx(p.x1), P.sy(p.x2), 3.2, 0, Math.PI * 2); ctx.stroke();
    } else {
      const r = 3.4 * (weights ? Math.sqrt(weights[p.y]) : 1);
      ctx.fillStyle = p.y === M.MINORITY ? colors.event : colors.nonevent;
      ctx.beginPath(); ctx.arc(P.sx(p.x1), P.sy(p.x2), r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  });
  for (const e of plan ?? []) {
    ctx.save();
    ctx.strokeStyle = colors.event; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(P.sx(e.x1), P.sy(e.x2), 3.2, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
}

/**
 * One panel. `variant` picks how the ideal line is shown:
 *   T1  three lines, and nothing else
 *   T2  three lines plus the band between "now" and "ideal"
 *   T3  three lines plus a gap bar under the panel
 */
export function panel(host, { variant, share, method, k, seed, caption }) {
  const colors = readTokens();
  const ideal = idealFit();
  const rng = makeRng(seed);
  const pts = M.makeStage(rng, share);
  const { set, weights, drop, plan } = buildSet(pts, method, k, makeRng(seed + 31));
  const now = M.fitLogistic(set, { weights });
  const base = M.fitLogistic(pts);

  const barH = variant === "T3" ? 46 : 0;
  const h = PAD_T + SIDE + PAD_B + barH;
  const surface = createCanvas(host, h);
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

  if (variant === "T2") bandBetween(ctx, P, now, ideal, colors.theory);
  dots(ctx, P, pts, colors, { drop, plan, weights });
  if (method !== "none") stroke(ctx, P, base, { colour: colors.reference, width: 1.4, dash: [5, 4], alpha: 0.85 });
  stroke(ctx, P, ideal, { colour: colors.theory, width: 2, dash: [7, 4] });
  stroke(ctx, P, now, { colour: colors.highlight, width: 2.4 });

  const gap = disagree(now, ideal);
  const gap0 = disagree(base, ideal);

  if (variant === "T3") {
    /* The gap as a length, on a fixed scale, so the four methods can be compared
       at a glance without reading four percentages. Fixed at 50% full scale
       because that is where an unbalanced fit at 5% minority sits. */
    const y = PAD_T + SIDE + PAD_B - 6;
    const bw = rect.w;
    ctx.save();
    ctx.fillStyle = colors.surface3;
    ctx.fillRect(rect.x, y, bw, 12);
    ctx.fillStyle = colors.reference; ctx.globalAlpha = 0.55;
    ctx.fillRect(rect.x, y, bw * Math.min(1, gap0 / 0.5), 12);
    ctx.globalAlpha = 1; ctx.fillStyle = colors.theory;
    ctx.fillRect(rect.x, y, bw * Math.min(1, gap / 0.5), 12);
    ctx.fillStyle = colors.ink2;
    ctx.font = `${colors.fsXs} ${colors.font}`;
    ctx.textAlign = "left"; ctx.textBaseline = "top";
    ctx.fillText(`${(100 * gap).toFixed(1)}% of patients labelled differently from the ideal line`
      + `  ·  ${(100 * gap0).toFixed(1)}% before balancing`, rect.x, y + 17);
    ctx.restore();
  }
  return { gap, gap0, now, ideal, base };
}
