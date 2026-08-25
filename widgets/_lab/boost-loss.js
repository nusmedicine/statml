/* =========================================================================
   Lab · showing boosting progress
   -------------------------------------------------------------------------
   Two design questions, mocked at the widget's real stage width.

   1. WHERE THE LOSS CURVE GOES. The boosting page shows what is left to fix,
      the running sum, the tree, and a shelf of trees — and none of them says
      the thing the slide's left-hand axis says, which is that a loss is going
      down. Three placements, all at the size they would really get.

   2. WHAT A LEAF SAYS. Leaves currently print `n = k`. Those counts barely
      move between rounds; the leaf's STEP does, and the step is the tree's
      actual output. Three labellings, driven by the same round slider, so the
      test is simply which one visibly changes.
   ========================================================================= */

import { readTokens, themeMode } from "../core/env.js";
import { LOSS } from "./boost-loss-data.js";

const $ = (id) => document.getElementById(id);
let T = null;

/* The widget's own stage geometry, so nothing here is judged at a width it
   will not get: 776 px of figure, three panels and a full-width shelf. */
const STAGE = 776, GAP = 14, PAD_L = 30;
const side = Math.max(176, Math.min(300, Math.floor((STAGE - 2 * GAP) * 0.30)));
const treeW = Math.max(210, STAGE - 2 * side - 2 * GAP);
const SHELF_H = 96, BOOST_M = 20;

function surface(host, w, h) {
  const c = document.createElement("canvas");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  c.style.width = `${w}px`; c.style.height = `${h}px`;
  host.appendChild(c);
  const ctx = c.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}
function cell(host, title, note) {
  const d = document.createElement("div");
  d.className = "cell";
  const h = document.createElement("h3"); h.textContent = title; d.appendChild(h);
  if (note) { const p = document.createElement("p"); p.textContent = note; d.appendChild(p); }
  host.appendChild(d);
  return d;
}
const measure = (host, html) => {
  const p = document.createElement("p"); p.className = "measure"; p.innerHTML = html; host.appendChild(p);
};

/* ---- the loss curve ---------------------------------------------------- */

/**
 * Log loss against round.
 *
 * Drawn on a LINEAR axis on purpose. A log axis makes the tail of a
 * converging series look like continued progress, which is the opposite of
 * what this page has to say: the whole point is that the drops get small.
 */
function lossCurve(ctx, R, series, k, { compact = false } = {}) {
  ctx.fillStyle = T.surface;
  ctx.fillRect(R.x, R.y, R.w, R.h);

  const L = compact ? 34 : 40, B = compact ? 20 : 24, TOP = 10, RGT = 8;
  const hi = series[0] * 1.06;
  const px = (i) => R.x + L + (i / (series.length - 1)) * (R.w - L - RGT);
  const py = (v) => R.y + R.h - B - (v / hi) * (R.h - B - TOP);

  ctx.strokeStyle = T.grid; ctx.lineWidth = 1;
  ctx.fillStyle = T.ink3; ctx.font = `10px ${T.font}`;
  ctx.textAlign = "right"; ctx.textBaseline = "middle";
  for (let g = 0; g <= 2; g += 1) {
    const v = (hi * g) / 2, y = Math.round(py(v)) + 0.5;
    ctx.beginPath(); ctx.moveTo(R.x + L, y); ctx.lineTo(R.x + R.w - RGT, y); ctx.stroke();
    ctx.fillText(v.toFixed(2), R.x + L - 4, py(v));
  }

  /* The whole curve faint, the part reached solid: the reader can see where
     this is going without being told the answer before pressing anything. */
  ctx.strokeStyle = T.ink3; ctx.globalAlpha = 0.28; ctx.lineWidth = 1.5;
  ctx.beginPath();
  series.forEach((v, i) => (i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v))));
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = T.smoothed; ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= k; i += 1) (i ? ctx.lineTo(px(i), py(series[i])) : ctx.moveTo(px(i), py(series[i])));
  ctx.stroke();

  /* Each round's DROP as a bar from the curve — the quantity a reader is
     really being asked to notice is how much smaller each drop gets. */
  ctx.fillStyle = T.smoothed; ctx.globalAlpha = 0.35;
  for (let i = 1; i <= k; i += 1) {
    const w = Math.max(1.5, (R.w - L - RGT) / series.length - 2);
    ctx.fillRect(px(i) - w / 2, py(series[i]), w, py(series[i - 1]) - py(series[i]));
  }
  ctx.globalAlpha = 1;

  if (k > 0) {
    ctx.fillStyle = T.highlight;
    ctx.beginPath(); ctx.arc(px(k), py(series[k]), 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = T.ink1; ctx.font = `600 10px ${T.font}`;
    ctx.textAlign = k > series.length * 0.6 ? "right" : "left";
    ctx.textBaseline = "bottom";
    ctx.fillText(series[k].toFixed(4), px(k) + (k > series.length * 0.6 ? -6 : 6), py(series[k]) - 5);
  }

  ctx.fillStyle = T.ink3; ctx.font = `10px ${T.font}`;
  ctx.textAlign = "center"; ctx.textBaseline = "top";
  for (let i = 0; i <= 20; i += 5) ctx.fillText(String(i), px(i), R.y + R.h - B + 4);
  if (!compact) ctx.fillText("trees added", (R.x + L + R.x + R.w) / 2, R.y + R.h - 12);
}

/* ---- a stand-in shelf, only detailed enough to judge the split ---------- */
function shelfStrip(ctx, R, k) {
  const s = Math.min(R.w / BOOST_M, R.h);
  const ox = R.x + (R.w - s * BOOST_M) / 2, oy = R.y + (R.h - s) / 2;
  for (let i = 0; i < BOOST_M; i += 1) {
    const cx = ox + i * s, pad = s * 0.16, w = s - 2 * pad;
    if (i >= k) {
      ctx.strokeStyle = T.grid; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
      ctx.strokeRect(cx + pad + 0.5, oy + pad + 0.5, w, w); ctx.setLineDash([]);
      continue;
    }
    /* A depth-2 silhouette: root, two internal, four leaves. */
    const gx = (c) => cx + pad + (c / 3) * w, gy = (d) => oy + pad + (d / 2) * w;
    ctx.strokeStyle = T.ink3; ctx.lineWidth = Math.max(0.7, s * 0.022);
    const seed = (i * 2654435761) % 4;
    ctx.beginPath();
    ctx.moveTo(gx(1.5), gy(0)); ctx.lineTo(gx(0.5), gy(1));
    ctx.moveTo(gx(1.5), gy(0)); ctx.lineTo(gx(2.5), gy(1));
    ctx.moveTo(gx(0.5), gy(1)); ctx.lineTo(gx(0), gy(2));
    ctx.moveTo(gx(0.5), gy(1)); ctx.lineTo(gx(1), gy(2));
    ctx.moveTo(gx(2.5), gy(1)); ctx.lineTo(gx(2), gy(2));
    ctx.moveTo(gx(2.5), gy(1)); ctx.lineTo(gx(3), gy(2));
    ctx.stroke();
    [[0, 0], [1, 1], [2, 2], [3, 3]].forEach(([c, j]) => {
      ctx.fillStyle = ((seed + j) % 2) ? T.event : T.nonevent;
      ctx.beginPath(); ctx.arc(gx(c), gy(2), Math.max(1.3, s * 0.055), 0, Math.PI * 2); ctx.fill();
    });
    if (i === k - 1) {
      ctx.strokeStyle = T.highlight; ctx.lineWidth = 1.4;
      ctx.strokeRect(cx + 0.5, oy + 0.5, s - 1, s - 1);
    }
  }
}

/* ---- one depth-2 tree, three labellings -------------------------------- */
function labelledTree(ctx, R, steps, mode) {
  ctx.fillStyle = T.surface;
  ctx.fillRect(R.x, R.y, R.w, R.h);
  const padX = 30, padY = 26;
  const gx = (c) => R.x + padX + (c / 3) * (R.w - 2 * padX);
  const gy = (d) => R.y + padY + (d / 2) * (R.h - 2 * padY - 12);
  const NS = [{ c: 1.5, d: 0 }, { c: 0.5, d: 1 }, { c: 2.5, d: 1 }];
  const LV = [{ c: 0, d: 2 }, { c: 1, d: 2 }, { c: 2, d: 2 }, { c: 3, d: 2 }];
  const N_IN_LEAF = [4, 1, 1, 6];

  ctx.strokeStyle = T.ink2; ctx.lineWidth = 1.6;
  const edge = (a, b, ra, rb) => {
    const dx = gx(b.c) - gx(a.c), dy = gy(b.d) - gy(a.d), len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len;
    ctx.beginPath();
    ctx.moveTo(gx(a.c) + ux * ra, gy(a.d) + uy * ra);
    ctx.lineTo(gx(b.c) - ux * rb, gy(b.d) - uy * rb);
    ctx.stroke();
  };
  edge(NS[0], NS[1], 13, 13); edge(NS[0], NS[2], 13, 13);
  edge(NS[1], LV[0], 13, 11); edge(NS[1], LV[1], 13, 11);
  edge(NS[2], LV[2], 13, 11); edge(NS[2], LV[3], 13, 11);

  ["x₁", "x₂", "x₂"].forEach((f, i) => {
    ctx.fillStyle = T.surface; ctx.strokeStyle = T.ink1; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(gx(NS[i].c), gy(NS[i].d), 13, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = T.ink1; ctx.font = `11px ${T.font}`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(f, gx(NS[i].c), gy(NS[i].d) + 0.5);
  });

  LV.forEach((p, i) => {
    const v = steps[i] ?? 0;
    const mag = Math.min(1, Math.abs(v) / 2.5);
    ctx.fillStyle = v > 0 ? T.event : T.nonevent;
    /* Mode C also carries the magnitude in the disc, so a big step and a small
       one differ before any number is read. */
    ctx.globalAlpha = mode === "C" ? 0.35 + 0.65 * mag : 1;
    ctx.strokeStyle = T.ink1; ctx.lineWidth = 1.8;
    const r = mode === "C" ? 8 + 5 * mag : 11;
    ctx.beginPath(); ctx.arc(gx(p.c), gy(p.d), r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = T.ink3; ctx.font = `10px ${T.font}`;
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    const label = mode === "A" ? `n = ${N_IN_LEAF[i]}`
      : mode === "B" ? (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2))
        : (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2));
    ctx.fillText(label, gx(p.c), gy(p.d) + r + 4);
  });
}

/* ---- render ------------------------------------------------------------ */

function render() {
  const k = Number($("k").value);
  const rate = $("rate").value;
  const series = LOSS[rate].loss;
  const steps = LOSS[rate].steps[Math.max(0, k - 1)] ?? LOSS[rate].steps[0];
  $("kOut").textContent = `${k} of 20`;

  /* --- placements --- */
  const rowL = $("rowL");
  rowL.innerHTML = "";
  rowL.style.gridTemplateColumns = "max-content";

  const c1 = cell(rowL, "L1 · curve on the left of the shelf row",
    "the shelf keeps the rest of the width");
  const x1 = surface(c1, STAGE, SHELF_H + 18);
  x1.fillStyle = T.surface; x1.fillRect(0, 0, STAGE, SHELF_H + 18);
  const curveW = Math.round(STAGE * 0.34);
  lossCurve(x1, { x: 0, y: 8, w: curveW, h: SHELF_H }, series, k, { compact: true });
  shelfStrip(x1, { x: curveW + GAP, y: 8, w: STAGE - curveW - GAP, h: SHELF_H });
  measure(c1, `curve <b>${curveW} px</b> · shelf <b>${STAGE - curveW - GAP} px</b>, ${((STAGE - curveW - GAP) / BOOST_M).toFixed(0)} px per tree`);

  const c2 = cell(rowL, "L2 · curve full width, shelf beneath it",
    "both get the whole row; the widget gets taller");
  const x2 = surface(c2, STAGE, 108 + SHELF_H + 10);
  x2.fillStyle = T.surface; x2.fillRect(0, 0, STAGE, 108 + SHELF_H + 10);
  lossCurve(x2, { x: 0, y: 4, w: STAGE, h: 104 }, series, k);
  shelfStrip(x2, { x: 0, y: 116, w: STAGE, h: SHELF_H });
  measure(c2, `curve <b>${STAGE} px</b> wide · costs <b>+114 px</b> of widget height`);

  const c3 = cell(rowL, "L3 · the curve replaces the shelf",
    "no tree strip at all");
  const x3 = surface(c3, STAGE, SHELF_H + 18);
  x3.fillStyle = T.surface; x3.fillRect(0, 0, STAGE, SHELF_H + 18);
  lossCurve(x3, { x: 0, y: 8, w: STAGE, h: SHELF_H }, series, k);
  measure(c3, `same height as today · the sequence of trees is no longer shown`);

  const drop = k > 0 ? series[k - 1] - series[k] : 0;
  const first = series[0] - series[1];
  $("claimsL").innerHTML = [
    `<li>At round <b>${k}</b> the loss is <b>${series[k].toFixed(4)}</b>, from ${series[0].toFixed(4)} at the start.</li>`,
    k > 0 ? `<li>This round removed <b>${drop.toFixed(4)}</b>; the first removed <b>${first.toFixed(4)}</b> — <b>${(first / Math.max(drop, 1e-9)).toFixed(0)}×</b> as much. The bars are there to make that shrinking legible.</li>` : "",
    `<li>The learning rate is visible in the SHAPE: 0.1 reaches ${LOSS["r0.1"].loss[20].toFixed(4)} by round 20, 0.3 reaches ${LOSS["r0.3"].loss[20].toFixed(4)}, 1.0 reaches ${LOSS["r1"].loss[20].toFixed(4)}.</li>`,
  ].filter(Boolean).join("");

  /* --- leaf labels --- */
  const rowN = $("rowN");
  rowN.innerHTML = "";
  rowN.style.gridTemplateColumns = "repeat(3, max-content)";
  const notes = {
    A: "what the widget shows today",
    B: "the step this leaf adds",
    C: "the step, and the disc sized by it",
  };
  ["A", "B", "C"].forEach((mode) => {
    const c = cell(rowN, `${mode} · ${mode === "A" ? "n = k" : mode === "B" ? "the step" : "step + magnitude"}`, notes[mode]);
    const ctx = surface(c, treeW, 190);
    labelledTree(ctx, { x: 0, y: 0, w: treeW, h: 190 }, steps, mode);
    measure(c, mode === "A" ? `4, 1, 1, 6 — the same at every round` : `${steps.map((v) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2))).join(", ")}`);
  });

  const r1 = LOSS[rate].steps[0], rk = steps;
  const moved = r1.filter((v, i) => Math.abs(v - (rk[i] ?? 0)) > 0.01).length;
  $("claimsN").innerHTML = [
    `<li><b>A</b> prints 4, 1, 1, 6 at every round — the counts are a property of the SPLIT, and the split barely moves.</li>`,
    `<li><b>B</b> prints the step, and <b>${moved} of 4</b> leaves differ from round 1 at this round.</li>`,
    `<li><b>C</b> adds size, so a leaf that pushes hard and one that barely nudges differ before any digit is read.</li>`,
  ].join("");
}

$("k").addEventListener("input", render);
$("rate").addEventListener("change", render);
$("dark").addEventListener("change", () => {
  document.documentElement.dataset.theme = $("dark").checked ? "dark" : "light";
  T = readTokens();
  render();
});

$("dark").checked = themeMode() === "dark";
document.documentElement.dataset.theme = $("dark").checked ? "dark" : "light";
T = readTokens();
render();
