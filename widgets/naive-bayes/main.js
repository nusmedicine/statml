/* Naive Bayes — PHM5005 04-3 § Probabilistic.
 *
 * One new patient scored feature by feature: the prior, then one likelihood
 * per feature, each a ledger row — the fitted readoff on the left, the
 * evidence as a log-odds bar on the right, the running total at the bottom.
 * Features are admitted by per-feature pills, so admission is URL state and
 * the product commutes in the reader's hands; Step and Play are declined
 * (4.5) and the bars ease on core's easing-request door. Two tabs, one per
 * likelihood family: Continuous (GaussianNB on CRP + WBC) and Discrete
 * (BernoulliNB on fever + chills), each with an Independent | Correlated
 * comparison at the bottom of the rail.
 *
 * THE CORRELATED VIEW IMPOSES ITS CORRELATION ON THE FITTED MARGINALS; it
 * never regenerates the cohort. Refitting on a resampled correlated cohort
 * would jitter naive Bayes's posterior by sampling noise, and the claim is
 * that it cannot move: its inputs are the marginals, which a correlation
 * leaves untouched. The correct model is computed exactly from the same
 * fitted marginals plus the imposed joint.
 *
 * MEASURED in _lab/nb-design.py (closed form vs sklearn to ~4e-16), with a
 * trap recorded there: the second feature must be REDUNDANT — matched
 * standardized shifts for the labs, matched rates for the symptoms — or the
 * correct model EXPLOITS the correlation (the residual turns
 * class-informative and its posterior runs to 1.0), the opposite lesson.
 * The population parameters below are load-bearing, not flavour.
 */

import { defineWidget, fmt, mathmlRenders } from "../core/index.js";

/* ---- the population the seeded cohort is drawn from ---------------------- */

const P_DISEASE = 0.3;
const N_COHORT = 400;

/* Matched standardized shifts: both labs move 1.333 pooled SD with disease. */
const LABS = {
  crp: { label: "CRP", unit: "mg/L", mu1: 24, mu0: 12, sd: 9, lo: 0, hi: 48, fmt: (v) => v.toFixed(1) },
  wbc: { label: "WBC", unit: "×10⁹/L", mu1: 10, mu0: 7, sd: 2.25, lo: 2, hi: 16, fmt: (v) => v.toFixed(1) },
};
/* Matched rates: at full co-occurrence chills repeats fever exactly. */
const SYMS = {
  fever: { label: "Fever", p1: 0.7, p0: 0.25 },
  chills: { label: "Chills", p1: 0.7, p0: 0.25 },
};

const LAB_KEYS = ["crp", "wbc"];
const SYM_KEYS = ["fever", "chills"];
const N_FEATURES = 2;

/* Which pill admits which ledger row. */
const PILL_OF = { crp: "addcrp", wbc: "addwbc", fever: "addfever", chills: "addchills" };

/* ---- geometry ------------------------------------------------------------ */

const HEAD_H = 22;        // the bar axis's direction labels
const MODEL_HEAD_H = 36;  // the Model heading + subtitle between prior and features
const ROW_H = 96;         // one ledger row
const TOTAL_H = 66;       // the running-total row
const LEDGER_H = HEAD_H + MODEL_HEAD_H + 3 * ROW_H + TOTAL_H + 10;
const GATE_H = 340;

const PANEL_X = 8;        // readoff panel, inside a row
const PANEL_W = 172;
const PANEL_H = 56;
const LR_MAX = 3.4;       // log-odds units the bar zone can hold
const GROW_MS = 450;

const HIST_BINS = 24;

/* ---- fitting: the same estimators sklearn uses --------------------------- */

function makeCohort(rng) {
  const rows = [];
  for (let i = 0; i < N_COHORT; i += 1) {
    const y = rng.next() < P_DISEASE ? 1 : 0;
    const r = { y };
    for (const k of LAB_KEYS) {
      const L = LABS[k];
      r[k] = Math.max(L.lo + 0.2, rng.normal(y ? L.mu1 : L.mu0, L.sd));
    }
    for (const k of SYM_KEYS) {
      const S = SYMS[k];
      r[k] = rng.next() < (y ? S.p1 : S.p0) ? 1 : 0;
    }
    rows.push(r);
  }
  return rows;
}

function fitNB(cohort) {
  const n = [0, 0];
  for (const r of cohort) n[r.y] += 1;
  const fit = { n, prior: [n[0] / cohort.length, n[1] / cohort.length], mu: {}, va: {}, rate: {} };
  for (const k of LAB_KEYS) {
    const mu = [0, 0];
    for (const r of cohort) mu[r.y] += r[k];
    fit.mu[k] = mu.map((s, y) => s / n[y]);
    const va = [0, 0];
    for (const r of cohort) va[r.y] += (r[k] - fit.mu[k][r.y]) ** 2;
    fit.va[k] = va.map((s, y) => s / n[y] + 1e-9);     // sklearn's var_smoothing
  }
  for (const k of SYM_KEYS) {
    const c = [0, 0];
    for (const r of cohort) c[r.y] += r[k];
    fit.rate[k] = c.map((s, y) => (s + 1) / (n[y] + 2)); // Laplace, alpha = 1
  }
  return fit;
}

const gaussLL = (x, mu, va) => -0.5 * Math.log(2 * Math.PI * va) - ((x - mu) ** 2) / (2 * va);
const sig = (z) => 1 / (1 + Math.exp(-z));

function labLR(fit, k, x) {
  return gaussLL(x, fit.mu[k][1], fit.va[k][1]) - gaussLL(x, fit.mu[k][0], fit.va[k][0]);
}
function symLR(fit, k, present) {
  const num = present ? fit.rate[k][1] : 1 - fit.rate[k][1];
  const den = present ? fit.rate[k][0] : 1 - fit.rate[k][0];
  return Math.log(num / den);
}

/* One ledger row per term: the prior, then each feature. */
function ledgerRows(fit, params) {
  const priorLR = Math.log(fit.prior[1] / fit.prior[0]);
  const rows = [{ key: "prior", name: "Prior", lr: priorLR }];
  if (params.family === "continuous") {
    for (const k of LAB_KEYS) {
      const L = LABS[k];
      rows.push({ key: k, name: `${L.label} ${L.fmt(params[k])}`, lr: labLR(fit, k, params[k]) });
    }
  } else {
    for (const k of SYM_KEYS) {
      const present = Boolean(params[k]);
      rows.push({
        key: k,
        name: `${SYMS[k].label} ${present ? "present" : "absent"}`,
        lr: symLR(fit, k, present),
        present,
      });
    }
  }
  return rows;
}

/* ---- the correlated view: exact, from the fitted marginals --------------- *
 * Continuous: per-class covariance built from the fitted variances plus the
 * imposed rho; the correct posterior is the two-Gaussian log-odds with the
 * full covariance, naive Bayes the same thing at rho 0.
 * Discrete: the joint with both fitted marginals kept and a co-occurrence
 * lambda interpolating independence -> maximal overlap:
 *   P(1,1) = pq + lambda(min(p,q) - pq)
 * so the marginals never move with lambda, by construction. lambda stops at
 * 0.95 because at 1 the patient's mixed cell (present, absent) has
 * probability 0 in both classes and the ratio is undefined.               */

function contCorrect(fit, a, b, rho) {
  let ll = Math.log(fit.prior[1] / fit.prior[0]);
  for (const y of [1, 0]) {
    const vA = fit.va.crp[y];
    const vB = fit.va.wbc[y];
    const cAB = rho * Math.sqrt(vA * vB);
    const det = vA * vB - cAB * cAB;
    const da = a - fit.mu.crp[y];
    const db = b - fit.mu.wbc[y];
    const q = (vB * da * da - 2 * cAB * da * db + vA * db * db) / det;
    const s = y === 1 ? 1 : -1;
    ll += s * (-0.5 * Math.log(det) - 0.5 * q);
  }
  return ll;
}

function discJoint(p, q, lambda, f, c) {
  const p11 = p * q + lambda * (Math.min(p, q) - p * q);
  if (f === 1 && c === 1) return p11;
  if (f === 1) return p - p11;
  if (c === 1) return q - p11;
  return 1 - p - q + p11;
}

function discCorrect(fit, f, c, lambda) {
  const j1 = discJoint(fit.rate.fever[1], fit.rate.chills[1], lambda, f, c);
  const j0 = discJoint(fit.rate.fever[0], fit.rate.chills[0], lambda, f, c);
  return Math.log(fit.prior[1] / fit.prior[0]) + Math.log(j1 / j0);
}

/* ---- formatting ---------------------------------------------------------- */

const f2 = (v) => fmt(v, 2);
const f3 = (v) => fmt(v, 3);
const signed = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2);

/* ---- the formula card (widget 15/35's pattern): MathML in the DOM -------- */

const MATHML = mathmlRenders();

const mi = (t) => `<mi mathvariant="normal">${t}</mi>`;
const mn = (t) => `<mn>${t}</mn>`;
const mo = (t) => `<mo>${t}</mo>`;
const M = (inner) => `<math><mrow>${inner}</mrow></math>`;

/* Posterior odds as the product of the admitted factors, then the odds
   converted to a probability, spelled out. The card follows the settled
   pill state; the canvas numbers follow the eased bars. */
function formula(rows, params, total) {
  const parts = [];
  const plain = [];
  parts.push(M(mi("posterior odds") + mo("=")));
  plain.push("posterior odds =");
  /* only the factors actually IN the product — an equation with a symbolic
     factor beside a numeric result would be false as read; the ledger is
     what shows the features not yet admitted */
  const inRows = rows.filter((r, i) => i === 0 || Boolean(params[PILL_OF[r.key]]));
  inRows.forEach((r, i) => {
    const val = f2(Math.exp(r.lr));
    if (i > 0) { parts.push(M(mo("×"))); plain.push("×"); }
    parts.push(M(mn(val)));
    plain.push(val);
  });
  const odds = f2(Math.exp(total));
  const post = sig(total);
  parts.push(M(mo("=") + mn(odds)));
  parts.push(M(mi("P(disease)") + mo("=")
    + `<mfrac><mrow>${mn(odds)}</mrow><mrow>${mn("1")}<mo>+</mo>${mn(odds)}</mrow></mfrac>`
    + mo("=") + mn(f3(post))));
  plain.push(`= ${odds} · P(disease) = ${odds} / (1 + ${odds}) = ${f3(post)}`);
  return { html: parts.join(" "), plain: plain.join(" ") };
}

let cardHost = null;
let cardKey = null;

function renderCard(rows, params) {
  if (!cardHost) {
    const figure = document.querySelector("#widget .w-figure");
    if (!figure || !figure.parentNode) return;
    cardHost = document.createElement("div");
    cardHost.className = "w-math";
    figure.parentNode.insertBefore(cardHost, figure);
  }
  const total = rows.reduce(
    (s, r, i) => s + (i === 0 || params[PILL_OF[r.key]] ? r.lr : 0), 0);
  const eq = formula(rows, params, total);
  if (eq.plain === cardKey) return;
  cardKey = eq.plain;
  if (MATHML) cardHost.innerHTML = eq.html;
  else cardHost.textContent = eq.plain;
}

/* ---- drawing helpers ----------------------------------------------------- */

function lineSeg(ctx, x1, y1, x2, y2, color, width = 1, dash = []) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function label(ctx, colors, s, x, y, { color, align = "left", font } = {}) {
  ctx.save();
  ctx.fillStyle = color ?? colors.ink3;
  ctx.font = font ?? `${colors.fsXs} ${colors.font}`;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(s, x, y);
  ctx.restore();
}

/* A lab's readoff: cohort histogram per class behind the two fitted curves,
   the patient's value as a vertical rule. */
function drawLabPanel(ctx, colors, state, k, x0, y0, patientV) {
  const L = LABS[k];
  const X = (v) => x0 + ((v - L.lo) / (L.hi - L.lo)) * PANEL_W;
  for (const y of [0, 1]) {
    const counts = state.hists[k][y];
    const max = Math.max(...counts, 1);
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = y ? colors.event : colors.nonevent;
    for (let b = 0; b < HIST_BINS; b += 1) {
      const h = (counts[b] / max) * (PANEL_H - 8);
      ctx.fillRect(x0 + (b / HIST_BINS) * PANEL_W + 0.5, y0 + PANEL_H - h, PANEL_W / HIST_BINS - 1, h);
    }
    ctx.restore();
  }
  for (const y of [0, 1]) {
    const mu = state.fit.mu[k][y];
    const va = state.fit.va[k][y];
    const peak = 1 / Math.sqrt(2 * Math.PI * va);
    ctx.save();
    ctx.strokeStyle = y ? colors.event : colors.nonevent;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i <= 60; i += 1) {
      const v = L.lo + (i / 60) * (L.hi - L.lo);
      const d = Math.exp(gaussLL(v, mu, va)) / peak;
      const yy = y0 + PANEL_H - 2 - d * (PANEL_H - 10);
      if (i === 0) ctx.moveTo(X(v), yy);
      else ctx.lineTo(X(v), yy);
    }
    ctx.stroke();
    ctx.restore();
  }
  lineSeg(ctx, X(patientV), y0 - 2, X(patientV), y0 + PANEL_H, colors.highlight, 1.6);
  lineSeg(ctx, x0, y0 + PANEL_H, x0 + PANEL_W, y0 + PANEL_H, colors.grid);
}

/* A symptom's readoff: the FULL fitted Bernoulli distribution — for each
   outcome (absent, present), one bar per class — stable whatever the
   patient does. An earlier version drew P(the patient's state | class), so
   flipping the checkbox appeared to change the trained model. The patient's
   outcome is framed in the highlight, the analogue of the Gaussian panels'
   patient rule. */
function drawSymPanel(ctx, colors, state, k, x0, y0, present) {
  const hFull = PANEL_H - 16;
  const base = y0 + PANEL_H - 2;
  const groupW = PANEL_W / 2;
  const bw = (groupW - 28) / 2;
  [0, 1].forEach((o) => {                      // outcome: absent, then present
    const gx = x0 + o * groupW + 10;
    [0, 1].forEach((y) => {
      const p = o ? state.fit.rate[k][y] : 1 - state.fit.rate[k][y];
      ctx.save();
      ctx.fillStyle = y ? colors.event : colors.nonevent;
      ctx.fillRect(gx + y * (bw + 4), base - hFull * p, bw, hFull * p);
      ctx.restore();
    });
    label(ctx, colors, o ? "present" : "absent", gx + bw + 2, y0 + PANEL_H + 11,
      { align: "center" });
    if ((present ? 1 : 0) === o) {
      ctx.save();
      ctx.strokeStyle = colors.highlight;
      ctx.lineWidth = 1.6;
      ctx.strokeRect(gx - 5, y0 - 2, 2 * bw + 14, PANEL_H + 2);
      ctx.restore();
    }
  });
  lineSeg(ctx, x0, base, x0 + PANEL_W, base, colors.grid);
}

/* One tilted-covariance ellipse, drawn parametrically so the anisotropic
   data->pixel mapping cannot distort it. */
function drawEllipse(ctx, muA, muB, vA, vB, rho, mult, X, Y, color, dash) {
  const cAB = rho * Math.sqrt(vA * vB);
  const tr = vA + vB;
  const det = vA * vB - cAB * cAB;
  const l1 = tr / 2 + Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l2 = tr / 2 - Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  let u1;
  if (Math.abs(cAB) > 1e-12) u1 = [l1 - vB, cAB];
  else u1 = vA >= vB ? [1, 0] : [0, 1];
  const n1 = Math.hypot(u1[0], u1[1]);
  u1 = [u1[0] / n1, u1[1] / n1];
  const u2 = [-u1[1], u1[0]];
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = dash.length ? 1 : 1.6;
  ctx.setLineDash(dash);
  ctx.beginPath();
  for (let i = 0; i <= 48; i += 1) {
    const t = (i / 48) * Math.PI * 2;
    const a = muA + mult * (u1[0] * Math.sqrt(l1) * Math.cos(t) + u2[0] * Math.sqrt(l2) * Math.sin(t));
    const b = muB + mult * (u1[1] * Math.sqrt(l1) * Math.cos(t) + u2[1] * Math.sqrt(l2) * Math.sin(t));
    if (i === 0) ctx.moveTo(X(a), Y(b));
    else ctx.lineTo(X(a), Y(b));
  }
  ctx.stroke();
  ctx.restore();
}

/* ---- the two halves of draw() -------------------------------------------- */

/* Running total in log-odds, each admitted row weighted by its ease — every
   printed number comes from the LERPED total (the lm-arc convention). */
function runningTotal(rows, tOf) {
  let total = rows[0].lr;
  for (let i = 1; i < rows.length; i += 1) total += rows[i].lr * tOf(rows[i].key);
  return total;
}

/* The ease weight for a row: 1 when no animation is running. */
const easeOf = (anim) => (key) => anim?.t?.[key] ?? 1;

function drawLedger(ctx, colors, w, params, state, anim) {
  const rows = state.rows;
  const tOf = easeOf(anim);

  const zoneL = PANEL_X + PANEL_W + 56;
  const zoneR = w - 12;
  const zero = (zoneL + zoneR) / 2;
  const scale = (zoneR - zero) / LR_MAX;

  label(ctx, colors, "← evidence for no disease", zero - 8, 13, { align: "right" });
  label(ctx, colors, "evidence for disease →", zero + 8, 13);
  lineSeg(ctx, zero, HEAD_H - 4, zero, HEAD_H + MODEL_HEAD_H + 3 * ROW_H, colors.grid);

  /* the feature panels are the model, and the figure says so where they
     begin: a heading in the same voice as "Prior", no counts (generic
     over any cohort size) */
  label(ctx, colors, "Model", PANEL_X, HEAD_H + ROW_H + 14,
    { color: colors.ink1, font: `${colors.fsSm} ${colors.font}` });
  label(ctx, colors, "distributions fitted to the training data",
    PANEL_X, HEAD_H + ROW_H + 28);

  rows.forEach((r, i) => {
    const yTop = HEAD_H + i * ROW_H + (i > 0 ? MODEL_HEAD_H : 0);
    const t = i === 0 ? 1 : tOf(r.key);
    const on = t > 0.001;
    ctx.save();
    if (!on) ctx.globalAlpha = 0.35;

    label(ctx, colors, r.name, PANEL_X, yTop + 12, { color: colors.ink1, font: `${colors.fsSm} ${colors.font}` });
    if (i > 0) {
      label(ctx, colors, params.family === "continuous" ? "Gaussian" : "Bernoulli",
        PANEL_X + PANEL_W + 8, yTop + 18 + PANEL_H / 2);
    }

    const py = yTop + 18;
    if (r.key === "prior") {
      const bw = PANEL_W;
      ctx.fillStyle = colors.nonevent;
      ctx.fillRect(PANEL_X, py + 16, bw * state.fit.prior[0], 13);
      ctx.fillStyle = colors.event;
      ctx.fillRect(PANEL_X + bw * state.fit.prior[0], py + 16, bw * state.fit.prior[1], 13);
      label(ctx, colors, `${f2(state.fit.prior[1])} of the cohort has the disease`, PANEL_X, py + 46);
    } else if (params.family === "continuous") {
      drawLabPanel(ctx, colors, state, r.key, PANEL_X, py, params[r.key]);
    } else {
      drawSymPanel(ctx, colors, state, r.key, PANEL_X, py, r.present);
    }

    if (on) {
      const g = i === 0 ? 1 : t;
      const wPx = Math.max(zoneL - zero, Math.min(zoneR - zero, r.lr * g * scale));
      const clipped = Math.abs(wPx) < Math.abs(r.lr * g * scale) - 0.5;
      const color = r.key === "prior" ? colors.prior : r.lr >= 0 ? colors.event : colors.nonevent;
      ctx.fillStyle = color;
      ctx.fillRect(Math.min(zero, zero + wPx), py + 12, Math.abs(wPx), 18);
      /* a bar at the zone's edge would push its label off the canvas, so the
         label steps inside the bar instead — the number is never clipped */
      const inside = clipped;
      label(ctx, colors, signed(r.lr * g),
        zero + wPx + (r.lr >= 0 ? (inside ? -6 : 6) : (inside ? 6 : -6)), py + 25,
        {
          color: inside ? colors.surface : colors.ink2,
          align: (r.lr >= 0) === !inside ? "left" : "right",
          font: `${colors.fsSm} ${colors.font}`,
        });
    }
    ctx.restore();
  });

  const yT = HEAD_H + MODEL_HEAD_H + 3 * ROW_H + 8;
  lineSeg(ctx, PANEL_X, yT - 6, w - 12, yT - 6, colors.grid);
  const total = runningTotal(rows, tOf);
  const nOn = rows.slice(1).filter((r) => params[PILL_OF[r.key]]).length;
  const wPx = Math.max(-zero + zoneL, Math.min(zoneR - zero, total * scale));
  ctx.save();
  ctx.fillStyle = colors.posterior;
  ctx.fillRect(Math.min(zero, zero + wPx), yT + 10, Math.abs(wPx), 20);
  ctx.restore();
  lineSeg(ctx, zero, yT, zero, yT + 40, colors.grid);
  label(ctx, colors, `Evidence total ${signed(total)}`, PANEL_X, yT + 24,
    { color: colors.ink1, font: `${colors.fsSm} ${colors.font}` });
  label(ctx, colors, `P(disease) = ${f3(sig(total))}`, zero + wPx + (total >= 0 ? 8 : -8), yT + 24,
    { color: colors.ink1, align: total >= 0 ? "left" : "right", font: `${colors.fsSm} ${colors.font}` });
  label(ctx, colors,
    nOn < N_FEATURES ? `with ${nOn} of ${N_FEATURES} features in the product` : "with both features in the product",
    PANEL_X, yT + 40);
}

function drawGate(ctx, colors, w, params, state) {
  const top = LEDGER_H;
  lineSeg(ctx, PANEL_X, top + 2, w - 12, top + 2, colors.grid);
  const cont = params.family === "continuous";
  const setting = state.gate.setting;
  const greek = cont ? "ρ" : "λ";

  label(ctx, colors,
    cont
      ? "If the two labs were correlated: the joint tilts, the fitted marginals do not move"
      : "If the two symptoms co-occurred: the joint shifts, the fitted marginals do not move",
    PANEL_X, top + 20, { color: colors.ink2, font: `${colors.fsSm} ${colors.font}` });

  /* left: the joint at the chosen setting */
  const ps = 232;
  const px0 = PANEL_X + 26;
  const py0 = top + 34;
  if (cont) {
    const X = (a) => px0 + ((a - LABS.crp.lo) / (LABS.crp.hi - LABS.crp.lo)) * ps;
    const Y = (b) => py0 + ps - ((b - LABS.wbc.lo) / (LABS.wbc.hi - LABS.wbc.lo)) * ps;
    ctx.save();
    ctx.strokeStyle = colors.grid;
    ctx.strokeRect(px0, py0, ps, ps);
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(px0, py0, ps, ps);
    ctx.clip();
    for (const y of [0, 1]) {
      const color = y ? colors.event : colors.nonevent;
      drawEllipse(ctx, state.fit.mu.crp[y], state.fit.mu.wbc[y],
        state.fit.va.crp[y], state.fit.va.wbc[y], setting, 1.5, X, Y, color, []);
      drawEllipse(ctx, state.fit.mu.crp[y], state.fit.mu.wbc[y],
        state.fit.va.crp[y], state.fit.va.wbc[y], 0, 1.5, X, Y, color, [3, 3]);
    }
    ctx.fillStyle = colors.highlight;
    ctx.beginPath();
    ctx.arc(X(params.crp), Y(params.wbc), 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    label(ctx, colors, "CRP", px0 + ps / 2, py0 + ps + 14, { align: "center" });
    ctx.save();
    ctx.translate(px0 - 12, py0 + ps / 2);
    ctx.rotate(-Math.PI / 2);
    label(ctx, colors, "WBC", 0, 0, { align: "center" });
    ctx.restore();
    label(ctx, colors, `solid: joint at ${greek} = ${f2(setting)} · dashed: what naive Bayes assumes`,
      px0 - 14, py0 + ps + 28);
  } else {
    /* the two 2x2 joints share one set of row labels; wash = the cell's
       probability, and "indep" prints the product naive Bayes uses instead */
    const cell = 46;
    const rowLab = 30;
    const tgap = 12;
    const ty = py0 + 34;
    [0, 1].forEach((y) => {
      const tx = px0 - 14 + rowLab + y * (2 * cell + tgap);
      label(ctx, colors, y ? "Disease" : "No disease", tx + cell, ty - 22,
        { align: "center", color: y ? colors.event : colors.nonevent, font: `${colors.fsSm} ${colors.font}` });
      const p = state.fit.rate.fever[y];
      const q = state.fit.rate.chills[y];
      [1, 0].forEach((f, ri) => [1, 0].forEach((c, ci) => {
        const j = discJoint(p, q, setting, f, c);
        const ind = discJoint(p, q, 0, f, c);
        const cx = tx + ci * cell;
        const cy = ty + ri * cell;
        ctx.save();
        ctx.globalAlpha = 0.12 + 0.75 * j;
        ctx.fillStyle = y ? colors.event : colors.nonevent;
        ctx.fillRect(cx, cy, cell - 2, cell - 2);
        ctx.restore();
        label(ctx, colors, f2(j), cx + (cell - 2) / 2, cy + 19,
          { align: "center", color: colors.ink1, font: `${colors.fsSm} ${colors.font}` });
        label(ctx, colors, f2(ind), cx + (cell - 2) / 2, cy + 35, { align: "center" });
        const isPatient = (Boolean(params.fever) ? 1 : 0) === f && (Boolean(params.chills) ? 1 : 0) === c;
        if (isPatient) {
          ctx.save();
          ctx.strokeStyle = colors.highlight;
          ctx.lineWidth = 2;
          ctx.strokeRect(cx - 1, cy - 1, cell, cell);
          ctx.restore();
        }
      }));
      label(ctx, colors, "yes", tx + cell / 2, ty - 8, { align: "center" });
      label(ctx, colors, "no", tx + cell + cell / 2, ty - 8, { align: "center" });
    });
    label(ctx, colors, "yes", px0 - 14 + rowLab - 6, ty + 22, { align: "right" });
    label(ctx, colors, "no", px0 - 14 + rowLab - 6, ty + cell + 22, { align: "right" });
    label(ctx, colors, `rows fever, columns chills — big: joint at ${greek} = ${f2(setting)}`,
      px0 - 14, ty + 2 * cell + 18);
    label(ctx, colors, "small: the independent product naive Bayes uses", px0 - 14, ty + 2 * cell + 32);
  }

  /* right: the two posteriors against the correlation dial */
  const cx0 = px0 + ps + 46;
  const cw = Math.max(150, w - cx0 - 16);
  const cy0 = py0 + 6;
  const ch = ps - 30;
  const RX = (r) => cx0 + (r / 0.95) * cw;
  const RY = (p) => cy0 + ch * (1 - p);
  ctx.save();
  ctx.strokeStyle = colors.grid;
  ctx.strokeRect(cx0, cy0, cw, ch);
  ctx.restore();
  [0, 0.25, 0.5, 0.75, 1].forEach((p) => {
    lineSeg(ctx, cx0, RY(p), cx0 + cw, RY(p), colors.grid, 0.5, [2, 4]);
    label(ctx, colors, f2(p), cx0 - 5, RY(p) + 4, { align: "right" });
  });
  [0, 0.5, 0.95].forEach((r) => label(ctx, colors, f2(r), RX(r), cy0 + ch + 13, { align: "center" }));
  label(ctx, colors, `${greek} (imposed on the fitted marginals)`, cx0 + cw / 2, cy0 + ch + 27, { align: "center" });

  lineSeg(ctx, cx0, RY(state.gate.one), cx0 + cw, RY(state.gate.one), colors.ink3, 1, [4, 4]);

  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = colors.empirical;
  ctx.beginPath();
  state.gate.curve.forEach((pt, i) => {
    if (i === 0) ctx.moveTo(RX(pt.r), RY(pt.nb));
    else ctx.lineTo(RX(pt.r), RY(pt.nb));
  });
  ctx.stroke();
  ctx.strokeStyle = colors.reference;
  ctx.beginPath();
  state.gate.curve.forEach((pt, i) => {
    if (i === 0) ctx.moveTo(RX(pt.r), RY(pt.correct));
    else ctx.lineTo(RX(pt.r), RY(pt.correct));
  });
  ctx.stroke();
  ctx.restore();

  lineSeg(ctx, RX(setting), cy0, RX(setting), cy0 + ch, colors.highlight, 1, [3, 3]);
  for (const [val, color] of [[state.gate.nb, colors.empirical], [state.gate.correct, colors.reference]]) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(RX(setting), RY(val), 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  /* three labels whose lines can crowd (at the dial's 0 the two curves
     coincide exactly): stack them apart wherever they land within a line */
  const entries = [
    { text: `naive Bayes ${f3(state.gate.nb)} — flat: the marginals never move`, y: RY(state.gate.nb) - 7, color: colors.empirical },
    { text: `correct model ${f3(state.gate.correct)}`, y: RY(state.gate.correct) - 7, color: colors.reference },
    { text: `one feature alone ${f3(state.gate.one)}`, y: RY(state.gate.one) - 7, color: colors.ink3 },
  ].sort((a, b) => a.y - b.y);
  for (let i = 1; i < entries.length; i += 1) {
    if (entries[i].y - entries[i - 1].y < 13) entries[i].y = entries[i - 1].y + 13;
  }
  for (const e of entries) {
    label(ctx, colors, e.text, cx0 + 6, Math.min(e.y, cy0 + ch - 4),
      { color: e.color, font: `${colors.fsXs} ${colors.font}` });
  }
  label(ctx, colors, "P(disease) for the new patient, both features", cx0, cy0 - 8);
}

/* ========================================================================== */

defineWidget({
  slug: "naive-bayes",
  title: "Naive Bayes",
  subtitle:
    "We can classify a new patient by multiplying the prior with one likelihood "
    + "per feature: a fitted curve for a lab result, a fitted rate for a "
    + "symptom. The features are treated as independent, so evidence they "
    + "share is counted twice.",
  layout: "side",

  height: ({ correlate }) => LEDGER_H + (correlate === "correlated" ? GATE_H : 0),

  params: {
    family: {
      type: "segmented",
      label: "Features",
      options: [
        { value: "continuous", label: "Continuous", detail: "two lab results — Gaussian likelihoods" },
        { value: "discrete", label: "Discrete", detail: "two symptoms — Bernoulli likelihoods" },
      ],
      default: "continuous",
    },

    patient: { type: "section", label: "A new patient" },

    crp: {
      type: "float",
      label: "CRP (mg/L)",
      detail: "higher with the disease",
      min: 2, max: 40, step: 0.5, default: 20,
      display: true,
      when: { param: "family", equals: "continuous" },
    },
    wbc: {
      type: "float",
      label: "WBC (×10⁹/L)",
      detail: "higher with the disease",
      min: 3, max: 15, step: 0.1, default: 7.5,
      display: true,
      when: { param: "family", equals: "continuous" },
    },
    fever: {
      type: "bool",
      label: "Fever",
      default: true,
      display: true,
      when: { param: "family", equals: "discrete" },
    },
    chills: {
      type: "bool",
      label: "Chills",
      default: false,
      display: true,
      when: { param: "family", equals: "discrete" },
    },

    seed: { type: "int", label: "Seed", min: 1, max: 200, default: 1 },

    calc: { type: "section", label: "The calculation" },

    /* One membership pill per feature: likelihoods multiply in any order,
       and admission is URL state — a shared link opens with the same
       features in the product. */
    addcrp: {
      type: "bool",
      style: "pill",
      label: "Add CRP",
      default: false,
      display: true,
      when: { param: "family", equals: "continuous" },
    },
    addwbc: {
      type: "bool",
      style: "pill",
      label: "Add WBC",
      default: false,
      display: true,
      when: { param: "family", equals: "continuous" },
    },
    addfever: {
      type: "bool",
      style: "pill",
      label: "Add fever",
      default: false,
      display: true,
      when: { param: "family", equals: "discrete" },
    },
    addchills: {
      type: "bool",
      style: "pill",
      label: "Add chills",
      default: false,
      display: true,
      when: { param: "family", equals: "discrete" },
    },

    /* Last in the rail: the caveat comes after the calculation is understood. */
    correlate: {
      type: "segmented",
      label: "The two features",
      options: [
        { value: "independent", label: "Independent", detail: "what naive Bayes assumes" },
        {
          value: "correlated", label: "Correlated",
          detail: "impose a correlation on the fitted marginals and compare the posteriors",
        },
      ],
      default: "independent",
      display: true,
    },
    rho: {
      type: "choice",
      label: "Correlation ρ",
      options: [
        { value: "0", label: "0" },
        { value: "0.5", label: "0.5" },
        { value: "0.8", label: "0.8" },
        { value: "0.95", label: "0.95" },
      ],
      default: "0.8",
      display: true,
      when: { all: [{ param: "correlate", equals: "correlated" }, { param: "family", equals: "continuous" }] },
    },
    lam: {
      type: "choice",
      label: "Co-occurrence λ",
      options: [
        { value: "0", label: "0" },
        { value: "0.5", label: "0.5" },
        { value: "0.8", label: "0.8" },
        { value: "0.95", label: "0.95" },
      ],
      default: "0.8",
      display: true,
      when: { all: [{ param: "correlate", equals: "correlated" }, { param: "family", equals: "discrete" }] },
    },
  },

  legend: ({ params }) => [
    {
      token: "event",
      label: params.family === "continuous"
        ? "Disease — fitted likelihood, and evidence toward it"
        : "Disease — fitted rate, and evidence toward it",
      mark: params.family === "continuous" ? "line" : "bar",
    },
    {
      token: "nonevent",
      label: params.family === "continuous"
        ? "No disease — fitted likelihood, and evidence toward it"
        : "No disease — fitted rate, and evidence toward it",
      mark: params.family === "continuous" ? "line" : "bar",
    },
    { token: "highlight", label: "The new patient — disease status unknown", mark: "line" },
    { token: "prior", label: "Prior evidence", mark: "bar" },
    { token: "posterior", label: "Evidence total", mark: "bar" },
    ...(params.correlate === "correlated"
      ? [
        { token: "empirical", label: "Naive Bayes posterior", mark: "line" },
        { token: "reference", label: "Correct-model posterior", mark: "line" },
      ]
      : []),
  ],

  compute: ({ params, rng }) => {
    const cohort = makeCohort(rng);
    const fit = fitNB(cohort);

    const hists = {};
    for (const k of LAB_KEYS) {
      const L = LABS[k];
      hists[k] = [new Array(HIST_BINS).fill(0), new Array(HIST_BINS).fill(0)];
      for (const r of cohort) {
        const b = Math.min(HIST_BINS - 1, Math.max(0, Math.floor(((r[k] - L.lo) / (L.hi - L.lo)) * HIST_BINS)));
        hists[k][r.y][b] += 1;
      }
    }

    const rows = ledgerRows(fit, params);
    const priorLR = rows[0].lr;

    /* the correlated view, exact from the fitted marginals */
    const cont = params.family === "continuous";
    const setting = parseFloat(cont ? params.rho : params.lam);
    const nbFull = rows.reduce((s, r) => s + r.lr, 0);
    const correctAt = cont
      ? (r) => contCorrect(fit, params.crp, params.wbc, r)
      : (r) => discCorrect(fit, params.fever ? 1 : 0, params.chills ? 1 : 0, r);
    const curve = [];
    for (let i = 0; i <= 40; i += 1) {
      const r = (i / 40) * 0.95;
      curve.push({ r, nb: sig(nbFull), correct: sig(correctAt(r)) });
    }
    const gate = {
      setting,
      curve,
      nb: sig(nbFull),
      correct: sig(correctAt(setting)),
      one: sig(priorLR + rows[1].lr),
    };

    return { fit, hists, rows, gate };
  },

  animation: {
    /* Step and Play are declined (4.5): the pills are the interaction
       loop. The bars chase the pill targets, so an interruption resumes
       from where the figure is. */
    stepLabel: null,
    runLabel: null,

    init: ({ params }) => {
      const t = {};
      for (const k of [...LAB_KEYS, ...SYM_KEYS]) t[k] = params[PILL_OF[k]] ? 1 : 0;
      return { t, done: true, easing: false };
    },

    advance: (anim, { dt, params }) => {
      const rate = Math.min(1, dt / GROW_MS);
      let moving = false;
      for (const k of Object.keys(anim.t)) {
        const target = params[PILL_OF[k]] ? 1 : 0;
        const gap = target - anim.t[k];
        if (Math.abs(gap) > 0.004) {
          anim.t[k] += Math.sign(gap) * rate;
          anim.t[k] = Math.max(0, Math.min(1, anim.t[k]));
          moving = true;
        } else {
          anim.t[k] = target;
        }
      }
      if (!moving) anim.easing = false;
      return moving;
    },

    /* a pill flip requests the ease; every other display change repaints */
    rebuild: (anim, { params }) => {
      for (const k of Object.keys(anim.t)) {
        if ((params[PILL_OF[k]] ? 1 : 0) !== anim.t[k]) anim.easing = true;
      }
    },
  },

  draw({ ctx, colors, w, params, state, anim }) {
    renderCard(state.rows, params);
    drawLedger(ctx, colors, w, params, state, anim);
    if (params.correlate === "correlated") drawGate(ctx, colors, w, params, state);
  },

  readout: ({ params, state, anim }) => {
    const total = runningTotal(state.rows, easeOf(anim));
    const nOn = state.rows.slice(1).filter((r) => params[PILL_OF[r.key]]).length;
    const tiles = [
      {
        label: "Prior P(disease)",
        value: f3(state.fit.prior[1]),
        note: "the share of the fitted cohort with the disease",
      },
      {
        label: "Evidence total",
        value: signed(total),
        note: `log odds, ${nOn} of ${N_FEATURES} features in the product`,
      },
      {
        label: "P(disease)",
        value: f3(sig(total)),
        note: nOn < N_FEATURES ? "the posterior so far" : "the posterior with both features",
      },
    ];
    if (params.correlate === "correlated") {
      const greek = params.family === "continuous" ? "ρ" : "λ";
      tiles.push(
        { break: true },
        {
          label: "Naive Bayes",
          value: f3(state.gate.nb),
          note: "multiplies the two marginal likelihoods",
        },
        {
          label: "Correct model",
          value: f3(state.gate.correct),
          note: `reads the joint at ${greek} = ${f2(state.gate.setting)}`,
        },
      );
    }
    return tiles;
  },
});
