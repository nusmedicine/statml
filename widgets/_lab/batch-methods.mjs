/* ============================================================================
   Can ComBat, SVA and RUV be told apart on the notebook's own stage?

       node widgets/_lab/batch-methods.mjs

   Round 1 measured that ComBat's empirical-Bayes step has nothing to do here:
   the shift is +2 for EVERY gene and both batches have the same spread. This
   asks the question for all three of the lesson's methods at once, and for the
   stage changes that would give each of them something to do.
   ========================================================================= */

import { simulate, AFFECTED, GENES, SAMPLES, TRUE_EFFECT }
  from "../batch-effect/model.js";
import { makeRng } from "../core/rng.js";

const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const f = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : "  n/a");
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);

/** Gauss-Jordan least squares, returning every coefficient, or null. */
function ols(cols, y) {
  const k = cols.length;
  const A = cols.map((u) => cols.map((v) => u.reduce((s, x, i) => s + x * v[i], 0)));
  const b = cols.map((u) => u.reduce((s, x, i) => s + x * y[i], 0));
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < k; c += 1) {
    let p = c;
    for (let r = c + 1; r < k; r += 1) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-9) return null;
    for (let r = 0; r < k; r += 1) {
      if (r === c) continue;
      const t = M[r][c] / M[c][c];
      for (let j = c; j <= k; j += 1) M[r][j] -= t * M[c][j];
    }
  }
  return M.map((r, i) => r[k] / M[i][i]);
}

/** Leading sample-space direction of a genes x samples matrix, genes centred. */
function topDirection(X) {
  const n = X[0].length;
  const C = X.map((row) => { const m = mean(row); return row.map((v) => v - m); });
  let v = Array.from({ length: n }, (_, i) => Math.sin(i + 1));
  for (let it = 0; it < 400; it += 1) {
    const t = C.map((row) => row.reduce((s, x, j) => s + x * v[j], 0));
    const w = Array.from({ length: n }, (_, j) => C.reduce((s, row, g) => s + row[j] * t[g], 0));
    const nrm = Math.sqrt(w.reduce((s, x) => s + x * x, 0)) || 1;
    v = w.map((x) => x / nrm);
  }
  return v;
}

/** Residuals of every gene on `cols`. */
function residuals(X, cols) {
  return X.map((row) => {
    const beta = ols(cols, row);
    return row.map((v, j) => v - cols.reduce((s, u, a) => s + u[j] * beta[a], 0));
  });
}

/**
 * ComBat: location AND scale, with the empirical-Bayes shrinkage that is the
 * whole point of the method. `keepCondition` is cell 11's `mod`.
 */
function combat(sim, { keepCondition }) {
  const { X, batch, disease } = sim;
  /* What is kept: the grand mean, and the condition when `mod` is given. */
  const cols = keepCondition
    ? [new Array(SAMPLES).fill(1), disease.map(Number)]
    : [new Array(SAMPLES).fill(1)];
  const fitted = X.map((row) => {
    const beta = ols(cols, row);
    return row.map((v, j) => cols.reduce((s, u, a) => s + u[j] * beta[a], 0));
  });
  const resid = X.map((row, g) => row.map((v, j) => v - fitted[g][j]));

  /* sigma-hat is the WITHIN-BATCH residual sd, so the batch term is fitted here
     even when it is not kept. Standardising by the total sd instead inflates
     everything the batch did not cause — measured, it took the disease effect
     from 0.825 to 1.365 at a balanced design, because the scale step then
     divides by a within-batch spread smaller than the sd it standardised with. */
  const withBatch = [...cols, batch.map(Number)];
  const sd = X.map((row, g) => {
    /* At complete confounding [1, condition, batch] is singular — which is what
       complete confounding MEANS — so there is no within-batch residual to take
       and the model without the batch is all there is. */
    const beta = ols(withBatch, row);
    const use = beta ? withBatch : cols;
    const b = beta || ols(cols, row);
    const r = row.map((v, j) => v - use.reduce((s, u, a) => s + u[j] * b[a], 0));
    return Math.sqrt(mean(r.map((v) => v * v))) || 1;
  });
  const z = resid.map((r, g) => r.map((v) => v / sd[g]));

  const idxOf = (b) => [...Array(SAMPLES).keys()].filter((j) => batch[j] === b);
  const gamma = [];
  const delta = [];
  for (let b = 0; b < 2; b += 1) {
    const idx = idxOf(b);
    gamma.push(z.map((r) => mean(idx.map((j) => r[j]))));
    delta.push(z.map((r, g) => mean(idx.map((j) => (r[j] - gamma[b][g]) ** 2)) || 1));
  }

  const gStar = [];
  const dStar = [];
  for (let b = 0; b < 2; b += 1) {
    const idx = idxOf(b);
    const nB = idx.length;
    const gBar = mean(gamma[b]);
    const tau2 = mean(gamma[b].map((v) => (v - gBar) ** 2)) || 1e-9;
    /* the normal-normal posterior mean: ComBat's gamma* */
    gStar.push(gamma[b].map((v, g) => (nB * tau2 * v + delta[b][g] * gBar)
      / (nB * tau2 + delta[b][g])));
    /* the inverse-gamma posterior mean for the scale, method of moments */
    const dBar = mean(delta[b]);
    const s2 = mean(delta[b].map((v) => (v - dBar) ** 2)) || 1e-9;
    /* Method of moments for the inverse-gamma prior. The shape is
       (2 s2 + dBar^2) / s2, NOT (2 dBar^2 + s2) / s2 — with the wrong form the
       ratio bPrior/aPrior tends to dBar/2 as the spread of delta goes to zero,
       so on a stage where every gene has the same batch variance the scale step
       divides by sqrt(0.5) and inflates everything by 1.41. Measured, that put
       the disease effect at 1.047 where it should be 0.825. */
    const aPrior = (2 * s2 + dBar ** 2) / s2;
    const bPrior = (dBar * s2 + dBar ** 3) / s2;
    dStar.push(delta[b].map((_, g) => {
      const ss = idx.reduce((s, j) => s + (z[g][j] - gStar[b][g]) ** 2, 0);
      return (0.5 * ss + bPrior) / (nB / 2 + aPrior - 1);
    }));
  }

  const out = X.map((row, g) => row.map((v, j) => {
    const b = batch[j];
    const adj = (z[g][j] - gStar[b][g]) / Math.sqrt(dStar[b][g]);
    return adj * sd[g] + fitted[g][j];
  }));
  /* the raw and shrunk per-gene shifts, in the data's own units, so section 4
     can ask what the empirical Bayes actually bought */
  out.gammaRaw = gamma[1].map((v, g) => (v - gamma[0][g]) * sd[g]);
  out.gammaShrunk = gStar[1].map((v, g) => (v - gStar[0][g]) * sd[g]);
  return out;
}

/** SVA: the batch is UNKNOWN. One surrogate variable from the residuals. */
function svaVariable(sim) {
  const cols = [new Array(SAMPLES).fill(1), sim.disease.map(Number)];
  return topDirection(residuals(sim.X, cols));
}

/** RUV: one factor from control genes assumed to carry no biology. */
function ruvVariable(sim, controls) {
  return topDirection(controls.map((g) => sim.X[g]));
}

/** Condition effect with extra covariate columns, on the RAW data. */
function effectWith(sim, extra, from, to) {
  const cols = [new Array(SAMPLES).fill(1), sim.disease.map(Number), ...extra];
  const out = [];
  for (let g = from; g < to; g += 1) {
    const beta = ols(cols, sim.X[g]);
    if (beta) out.push(beta[1]);
  }
  return out.length ? mean(out) : NaN;
}

/** Condition effect from a CORRECTED matrix, as a two-group difference. */
function effectOf(X, disease, from, to) {
  const out = [];
  for (let g = from; g < to; g += 1) {
    const a = X[g].filter((_, j) => disease[j]);
    const b = X[g].filter((_, j) => !disease[j]);
    out.push(mean(a) - mean(b));
  }
  return mean(out);
}

/** How well a sample-space direction lines up with the batch, |corr|. */
function alignment(v, flags) {
  const x = flags.map(Number);
  const mv = mean(v);
  const mx = mean(x);
  const num = v.reduce((s, a, i) => s + (a - mv) * (x[i] - mx), 0);
  const dv = Math.sqrt(v.reduce((s, a) => s + (a - mv) ** 2, 0));
  const dx = Math.sqrt(x.reduce((s, a) => s + (a - mx) ** 2, 0));
  return Math.abs(num / (dv * dx || 1));
}

/* ==== 1 · do the three methods differ on the notebook's own stage? ========= */
console.log();
console.log("=== 1 · THE NOTEBOOK'S STAGE: +2 on EVERY gene, both batches equal spread ===");
console.log(`estimated disease effect, truth ${TRUE_EFFECT}, mean of 5 seeds`);
console.log();
console.log([pad("confounding", 12), rpad("none", 8), rpad("ComBat", 8),
  rpad("ComBat+mod", 11), rpad("SVA", 8), rpad("RUV", 8)].join(" | "));
console.log("-".repeat(66));
const CONTROLS = [...Array(GENES - AFFECTED).keys()].map((i) => i + AFFECTED);
for (const ov of [0, 0.5, 0.75, 1]) {
  const acc = { none: [], cb: [], cbm: [], sva: [], ruv: [] };
  for (let seed = 1; seed <= 5; seed += 1) {
    const sim = simulate({ seed, overlap: ov, batchShift: 2 });
    acc.none.push(effectOf(sim.X, sim.disease, 0, AFFECTED));
    acc.cb.push(effectOf(combat(sim, { keepCondition: false }), sim.disease, 0, AFFECTED));
    acc.cbm.push(effectOf(combat(sim, { keepCondition: true }), sim.disease, 0, AFFECTED));
    acc.sva.push(effectWith(sim, [svaVariable(sim)], 0, AFFECTED));
    acc.ruv.push(effectWith(sim, [ruvVariable(sim, CONTROLS)], 0, AFFECTED));
  }
  console.log([rpad(ov.toFixed(2), 12), rpad(f(mean(acc.none)), 8), rpad(f(mean(acc.cb)), 8),
    rpad(f(mean(acc.cbm)), 11), rpad(f(mean(acc.sva)), 8), rpad(f(mean(acc.ruv)), 8)].join(" | "));
}

/* ==== 2 · does SVA actually find the batch, without being told? =========== */
console.log();
console.log("=== 2 · SVA IS NEVER TOLD THE BATCH. Does its surrogate variable find it? ===");
console.log("|correlation| between the estimated variable and the true batch label");
console.log();
console.log([pad("confounding", 12), rpad("SVA's variable", 16), rpad("RUV's variable", 16)].join(" | "));
console.log("-".repeat(50));
for (const ov of [0, 0.5, 0.75, 1]) {
  const a = [];
  const b = [];
  for (let seed = 1; seed <= 5; seed += 1) {
    const sim = simulate({ seed, overlap: ov, batchShift: 2 });
    const isB2 = sim.batch.map((x) => x === 1);
    a.push(alignment(svaVariable(sim), isB2));
    b.push(alignment(ruvVariable(sim, CONTROLS), isB2));
  }
  console.log([rpad(ov.toFixed(2), 12), rpad(f(mean(a)), 16), rpad(f(mean(b)), 16)].join(" | "));
}

/* ==== 3 · RUV depends entirely on the control genes ======================== */
console.log();
console.log("=== 3 · RUV DEPENDS ENTIRELY ON WHICH GENES YOU CALL CONTROLS ===");
console.log("estimated effect, overlap 0.5, batch shift 2, 5 seeds, truth 0.80");
console.log();
const rng = makeRng(7);
const shuffled = [...Array(GENES).keys()];
for (let i = shuffled.length - 1; i > 0; i -= 1) {
  const j = Math.floor(rng.next() * (i + 1));
  [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
}
for (const [name, ctrl] of [
  ["genes 26-50, the true nulls — what cell 21 uses", CONTROLS],
  ["genes 1-25, every one carrying the disease effect", [...Array(AFFECTED).keys()]],
  ["25 genes picked at random", shuffled.slice(0, 25)],
]) {
  const vals = [];
  for (let seed = 1; seed <= 5; seed += 1) {
    const sim = simulate({ seed, overlap: 0.5, batchShift: 2 });
    vals.push(effectWith(sim, [ruvVariable(sim, ctrl)], 0, AFFECTED));
  }
  console.log(" ", pad(name, 52), rpad(f(mean(vals)), 8));
}

/* ==== 4 · what would give ComBat's shrinkage something to do? ============= */
console.log();
console.log("=== 4 · COMBAT'S EMPIRICAL BAYES NEEDS PER-GENE BATCH EFFECTS ===");
console.log("RMS error of the estimated per-gene shift against the truth, 5 seeds");
console.log();
console.log([pad("per-gene shift sd", 18), rpad("raw", 9), rpad("shrunk", 9),
  rpad("gain", 8)].join(" | "));
console.log("-".repeat(50));
for (const spread of [0, 0.25, 0.5, 1]) {
  let rawErr = 0;
  let shrErr = 0;
  let n = 0;
  for (let seed = 1; seed <= 5; seed += 1) {
    const base = simulate({ seed, overlap: 0, batchShift: 2 });
    const r = makeRng(100 + seed);
    /* each gene gets its own batch shift, drawn once */
    const trueShift = Array.from({ length: GENES }, () => 2 + r.normal(0, spread));
    const X = base.X.map((row, g) => row.map((v, j) =>
      (base.batch[j] === 1 ? v - 2 + trueShift[g] : v)));
    const sim = { ...base, X };
    const out = combat(sim, { keepCondition: true });
    for (let g = 0; g < GENES; g += 1) {
      rawErr += (out.gammaRaw[g] - trueShift[g]) ** 2;
      shrErr += (out.gammaShrunk[g] - trueShift[g]) ** 2;
      n += 1;
    }
  }
  const rawRms = Math.sqrt(rawErr / n);
  const shrRms = Math.sqrt(shrErr / n);
  console.log([rpad(spread.toFixed(2), 18), rpad(f(rawRms), 9), rpad(f(shrRms), 9),
    rpad(`${((1 - shrRms / rawRms) * 100).toFixed(0)}%`, 8)].join(" | "));
}

/* ==== 5 · SVA's benefit is POWER, not bias =============================== */
console.log();
console.log("=== 5 · SVA CANNOT MOVE THE ESTIMATE. What it moves is the interval ===");
console.log("mean standard error of the condition coefficient, 5 seeds");
console.log();
console.log([pad("confounding", 12), rpad("no covariate", 14), rpad("with SVA's", 12),
  rpad("with the true batch", 20)].join(" | "));
console.log("-".repeat(64));
for (const ov of [0, 0.5, 0.75]) {
  const acc = { plain: [], sva: [], batch: [] };
  for (let seed = 1; seed <= 5; seed += 1) {
    const sim = simulate({ seed, overlap: ov, batchShift: 2 });
    acc.plain.push(seOf(sim, []));
    acc.sva.push(seOf(sim, [svaVariable(sim)]));
    acc.batch.push(seOf(sim, [sim.batch.map(Number)]));
  }
  console.log([rpad(ov.toFixed(2), 12), rpad(f(mean(acc.plain)), 14),
    rpad(f(mean(acc.sva)), 12), rpad(f(mean(acc.batch)), 20)].join(" | "));
}

/** Mean standard error of the condition coefficient over the affected genes. */
function seOf(sim, extra) {
  const cols = [new Array(SAMPLES).fill(1), sim.disease.map(Number), ...extra];
  const k = cols.length;
  const out = [];
  for (let g = 0; g < AFFECTED; g += 1) {
    const beta = ols(cols, sim.X[g]);
    if (!beta) continue;
    const res = sim.X[g].map((v, j) => v - cols.reduce((s, u, a) => s + u[j] * beta[a], 0));
    const s2 = res.reduce((s, v) => s + v * v, 0) / (SAMPLES - k);
    /* (X'X)^-1 diagonal for the condition column, by solving against e_1 */
    const A = cols.map((u) => cols.map((v) => u.reduce((s, x, i) => s + x * v[i], 0)));
    const e = A.map((_, i) => (i === 1 ? 1 : 0));
    const inv = ols(A.map((r) => r), e);
    if (!inv) continue;
    out.push(Math.sqrt(s2 * inv[1]));
  }
  return out.length ? mean(out) : NaN;
}

/** The observed batch-2-minus-batch-1 gap for every gene. */
function batchGap({ X, batch }) {
  return X.map((row) => {
    const a = row.filter((_, j) => batch[j] === 1);
    const b = row.filter((_, j) => batch[j] === 0);
    return mean(a) - mean(b);
  });
}
console.log();
