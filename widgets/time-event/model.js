/* model.js — survival algorithms for the time-event widget (05-06).
 *
 * Pure functions, no DOM, no rng of their own — what the widget's compute()
 * and `_lab/time-event-measure.mjs` share, so what is verified is what runs.
 *
 * Conventions follow R's survival package, because the notebook's stored
 * outputs are what these must reproduce:
 *   - KM: at a time carrying both events and censorings, the censored are
 *     still at risk for the events at that time (survfit counts n.risk with
 *     time >= t, events drop first).
 *   - KM confidence interval: survfit's default conf.type = "log" —
 *     exp(log S ± z·se(log S)), se² by Greenwood.
 *   - Cox ties: Efron, coxph's default. The notebook's times are rounded to
 *     0.5 so ties are everywhere; Breslow would visibly disagree.
 */

/* --- normal tail ---------------------------------------------------------- *
 * erfc with fractional error < 1.2e-7 (Numerical Recipes 6.2.2). p-values on
 * screen carry 4 significant digits at most; the measure script checks beta
 * and se to far tighter tolerances than any p it prints.                     */
export function erfc(x) {
  const z = Math.abs(x);
  const t = 1 / (1 + z / 2);
  const ans = t * Math.exp(
    -z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
    t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
    t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? ans : 2 - ans;
}

/** P(Z > z) for standard normal. */
export const zTail = (z) => erfc(z / Math.SQRT2) / 2;

/** Two-sided p for a Wald z. */
export const zTailP2 = (z) => erfc(Math.abs(z) / Math.SQRT2);

/** P(chi²₁ > x). The log-rank and the Wald test with one constraint. */
export const chi2Tail1 = (x) => (x <= 0 ? 1 : erfc(Math.sqrt(x / 2)));

/* --- the widget's data ---------------------------------------------------- *
 * The notebook's event process, twice amended, both amendments measured:
 *
 * 1. The censoring is REPLACED (round-1 ruling). Cell 11 draws Status ~
 *    sample(0:1) independently of time, so a censored patient is censored AT
 *    the very time the event would have happened — over 100 seeds, KM on
 *    that design lies HIGH (+0.13) and discarding the censored is the
 *    unbiased choice, the OPPOSITE of the lesson. Study-end censoring
 *    (staggered entry over the first 10 years, doors close at `follow`)
 *    restores the roles the lesson teaches: KM −0.0002, discarding −0.081.
 * 2. The SNPs are BALANCED across groups (round-8 ruling). The notebook
 *    routes part of the disease effect through SNP prevalence (0.8 in the
 *    disease group); with a `Disease effect: none` control that channel
 *    would leave the "no difference" setting still different. One direct
 *    dial, every other channel silenced: at effect = 0 the groups genuinely
 *    share a curve (measured: log-rank rejects 3–6% at 0.05 across n).
 * 3. The causal SNPs are a parameter (round 13; round 14 made it a CHOICE
 *    of which, not a count — Kenneth: students set the ground truth, then
 *    see whether the model recovers it). `causal` is a BITMASK over the
 *    ten SNPs: bit j set means SNP_{j+1} subtracts a year. 7 (SNPs 1–3)
 *    is the notebook's truth and reproduces the round-8 generator bit
 *    for bit (verified on seed 32). Detection depends only on HOW MANY
 *    bits are set — the SNPs are iid and balanced, so the measured
 *    round-13 grid carries over to any mask of equal weight. And the
 *    censoring time is FLOORED at 0.5: at the short follow-ups the
 *    round-13 ladder added (doors at 5), `follow − uniform(0,10)` goes
 *    negative — a time no axis can draw. The floor touches nothing at
 *    follow ≥ 10.5.
 *
 * The play grid behind the option values (100 seeds each, % p < 0.05):
 *   effect none 3–6% at every n · small 24/31/53/89% at n = 30/60/100/200
 *   · moderate 77→100% · large 98→100%; follow-up at n = 200 moderate:
 *   doors at 12 → 7 events of 200, at 25 → 188.
 * The full record is docs/catalogue.md § Widget 31.                          */
export function simulate(rng, opts = {}) {
  /* `shift` is the onset control (round 10): it moves the whole event
     process earlier, so the curves need not idle through a flat head the
     reader cannot use. 0 keeps the round-8 behaviour. */
  const { n = 200, effect = 2.5, follow = 20, shift = 0, causal = 7 } =
    typeof opts === "number" ? { n: opts } : opts;
  const age = [];
  const disease = [];
  const snps = [];
  const time = [];
  const status = [];
  const trueT = [];
  for (let i = 0; i < n; i += 1) {
    age.push(rng.int(30, 80));
    disease.push(rng.int(0, 1));
  }
  for (let i = 0; i < n; i += 1) {
    const row = new Array(10);
    for (let j = 0; j < 10; j += 1) row[j] = rng.int(0, 1);
    snps.push(row);
  }
  for (let i = 0; i < n; i += 1) {
    let snpSum = 0;
    for (let j = 0; j < 10; j += 1) if ((causal >> j) & 1) snpSum += snps[i][j];
    let t = 20 - shift - 0.1 * age[i] - effect * disease[i]
      - snpSum + rng.uniform(0, 5);
    t = Math.round(t * 2) / 2;
    if (t < 0.5) t = 0.5;
    let c = Math.round((follow - rng.uniform(0, 10)) * 2) / 2;
    if (c < 0.5) c = 0.5;
    trueT.push(t);
    time.push(Math.min(t, c));
    status.push(t <= c ? 1 : 0);
  }
  return { age, disease, snps, time, status, trueT };
}

/* --- Kaplan–Meier --------------------------------------------------------- */

/**
 * Product-limit estimate. times/status parallel arrays, status 1 = event,
 * 0 = censored. Returns
 *   steps:   [{t, atRisk, events, censored, S, lo, hi}] one row per DISTINCT
 *            time (event or censoring), in time order — the survfit table.
 *   censors: [{t, S}] one mark per censoring, at the curve height it sits on
 *            (ggsurvplot's censor ticks).
 * S before the first time is 1. lo/hi are the conf-level log-scale interval,
 * NaN where S = 0 (R prints NA there).
 */
export function km(times, status, conf = 0.95) {
  const n = times.length;
  const order = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => times[a] - times[b] || status[b] - status[a]);
  const z = zCritical(conf);
  const steps = [];
  const censors = [];
  let S = 1;
  let greenwood = 0; // sum d / (n (n - d))
  let i = 0;
  while (i < n) {
    const t = times[order[i]];
    let d = 0;
    let c = 0;
    const atRisk = n - i;
    while (i < n && times[order[i]] === t) {
      if (status[order[i]] === 1) d += 1;
      else c += 1;
      i += 1;
    }
    if (d > 0) {
      S *= 1 - d / atRisk;
      if (d < atRisk) greenwood += d / (atRisk * (atRisk - d));
    }
    let lo = NaN;
    let hi = NaN;
    if (S > 0) {
      const se = Math.sqrt(greenwood); // se of log S
      lo = Math.exp(Math.log(S) - z * se);
      hi = Math.min(1, Math.exp(Math.log(S) + z * se));
    }
    steps.push({ t, atRisk, events: d, censored: c, S, lo, hi });
    if (c > 0) censors.push({ t, S });
  }
  return { steps, censors };
}

/** Median survival: smallest t with S(t) <= 0.5, or NaN if never reached. */
export function kmMedian(steps) {
  for (const s of steps) if (s.S <= 0.5) return s.t;
  return NaN;
}

/* z for a two-sided conf level, by bisection on the tail — avoids importing
   core/stats' t machinery for the one normal quantile this file needs. */
function zCritical(conf) {
  const tail = (1 - conf) / 2;
  let lo = 0;
  let hi = 40;
  for (let k = 0; k < 100; k += 1) {
    const mid = (lo + hi) / 2;
    if (zTail(mid) > tail) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/* --- log-rank ------------------------------------------------------------- */

/**
 * Two-group log-rank test (survdiff's default rho = 0). group is 0/1.
 * Returns { chi2, p, obs: [o0, o1], exp: [e0, e1] }.
 */
export function logrank(times, status, group) {
  const n = times.length;
  const order = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => times[a] - times[b]);
  let n0 = 0;
  let n1 = 0;
  for (const g of group) (g === 0 ? n0++ : n1++);
  let o1 = 0;
  let e1 = 0;
  let v = 0;
  let obs0 = 0;
  let obs1 = 0;
  let i = 0;
  while (i < n) {
    const t = times[order[i]];
    let d = 0;
    let d1 = 0;
    let leave0 = 0;
    let leave1 = 0;
    const atRisk = n0 + n1;
    const r1 = n1;
    while (i < n && times[order[i]] === t) {
      const idx = order[i];
      if (status[idx] === 1) {
        d += 1;
        if (group[idx] === 1) d1 += 1;
      }
      if (group[idx] === 1) leave1 += 1;
      else leave0 += 1;
      i += 1;
    }
    if (d > 0 && atRisk > 1) {
      o1 += d1;
      obs1 += d1;
      obs0 += d - d1;
      e1 += (d * r1) / atRisk;
      v += (d * r1 * (atRisk - r1) * (atRisk - d)) / (atRisk * atRisk * (atRisk - 1));
    }
    n0 -= leave0;
    n1 -= leave1;
  }
  const chi2 = v > 0 ? ((o1 - e1) * (o1 - e1)) / v : 0;
  return { chi2, p: chi2Tail1(chi2), obs: [obs0, obs1], exp: [obs0 + obs1 - e1, e1] };
}

/* --- Cox proportional hazards, Efron ties --------------------------------- */

/**
 * coxph(Surv(time, status) ~ X), Efron tie handling, Newton–Raphson with
 * step-halving. X is an array of rows (each an array of p covariates).
 * Returns { beta, se, hr, z, p, loglik0, loglik, iter, converged }.
 */
export function coxph(times, status, X, { maxIter = 50, tol = 1e-9 } = {}) {
  const n = times.length;
  const p = X[0].length;
  const order = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => times[a] - times[b]);

  // Distinct event times, each with its tied-event set and the index (into
  // `order`) where its risk set begins. Built once; every NR pass replays it.
  const eventBlocks = [];
  {
    let i = 0;
    while (i < n) {
      const t = times[order[i]];
      const start = i;
      const D = [];
      while (i < n && times[order[i]] === t) {
        if (status[order[i]] === 1) D.push(order[i]);
        i += 1;
      }
      if (D.length > 0) eventBlocks.push({ start, D });
    }
  }

  const negLikAt = (beta) => -loglikGradHess(beta, false).ll;

  function loglikGradHess(beta, wantDerivs) {
    // Suffix sums over the risk set, accumulated from the largest time down.
    const r = new Array(n);
    for (let i = 0; i < n; i += 1) {
      let s = 0;
      for (let j = 0; j < p; j += 1) s += beta[j] * X[i][j];
      r[i] = Math.exp(s);
    }
    // cumulative risk-set sums at each position of `order`
    const S0 = new Array(n + 1).fill(0);
    const S1 = wantDerivs ? Array.from({ length: n + 1 }, () => new Array(p).fill(0)) : null;
    const S2 = wantDerivs
      ? Array.from({ length: n + 1 }, () => new Array(p * p).fill(0))
      : null;
    for (let k = n - 1; k >= 0; k -= 1) {
      const idx = order[k];
      S0[k] = S0[k + 1] + r[idx];
      if (wantDerivs) {
        const x = X[idx];
        for (let a = 0; a < p; a += 1) {
          S1[k][a] = S1[k + 1][a] + r[idx] * x[a];
          for (let b = 0; b < p; b += 1) {
            S2[k][a * p + b] = S2[k + 1][a * p + b] + r[idx] * x[a] * x[b];
          }
        }
      } else {
        S1 && 0;
      }
    }

    let ll = 0;
    const g = wantDerivs ? new Array(p).fill(0) : null;
    const H = wantDerivs ? new Array(p * p).fill(0) : null;

    for (const { start, D } of eventBlocks) {
      const d = D.length;
      // tied-set sums
      let sD0 = 0;
      const sD1 = new Array(p).fill(0);
      const sD2 = wantDerivs ? new Array(p * p).fill(0) : null;
      for (const idx of D) {
        sD0 += r[idx];
        for (let a = 0; a < p; a += 1) {
          sD1[a] += r[idx] * X[idx][a];
          if (wantDerivs) {
            for (let b = 0; b < p; b += 1) sD2[a * p + b] += r[idx] * X[idx][a] * X[idx][b];
          }
        }
        let xb = 0;
        for (let a = 0; a < p; a += 1) xb += beta[a] * X[idx][a];
        ll += xb;
        if (wantDerivs) for (let a = 0; a < p; a += 1) g[a] += X[idx][a];
      }
      for (let l = 0; l < d; l += 1) {
        const f = l / d;
        const phi = S0[start] - f * sD0;
        ll -= Math.log(phi);
        if (wantDerivs) {
          const u = new Array(p);
          for (let a = 0; a < p; a += 1) {
            u[a] = (S1[start][a] - f * sD1[a]) / phi;
            g[a] -= u[a];
          }
          for (let a = 0; a < p; a += 1) {
            for (let b = 0; b < p; b += 1) {
              H[a * p + b] -= (S2[start][a * p + b] - f * sD2[a * p + b]) / phi - u[a] * u[b];
            }
          }
        }
      }
    }
    return { ll, g, H };
  }

  let beta = new Array(p).fill(0);
  const loglik0 = loglikGradHess(beta, false).ll;
  let ll = loglik0;
  let converged = false;
  let iter = 0;
  let Hlast = null;
  for (; iter < maxIter; iter += 1) {
    const { g, H } = loglikGradHess(beta, true);
    Hlast = H;
    const step = solveNegDefinite(H, g, p); // solve (-H) step = g
    if (!step) break;
    // step-halving: the Efron log-likelihood is concave but a full Newton step
    // from a bad start can still overshoot into overflow territory.
    let scale = 1;
    let next = beta;
    let llNext = ll;
    for (let h = 0; h < 20; h += 1) {
      next = beta.map((b, a) => b + scale * step[a]);
      llNext = -negLikAt(next);
      if (Number.isFinite(llNext) && llNext >= ll - 1e-12) break;
      scale /= 2;
    }
    const moved = Math.max(...step.map((s) => Math.abs(s * scale)));
    beta = next;
    if (Math.abs(llNext - ll) < tol && moved < 1e-6) {
      ll = llNext;
      converged = true;
      break;
    }
    ll = llNext;
  }
  // se from the inverse of the observed information (-H) at the solution
  const { H } = loglikGradHess(beta, true);
  Hlast = H;
  const cov = invertNegDefinite(Hlast, p);
  const se = beta.map((_, a) => (cov ? Math.sqrt(cov[a * p + a]) : NaN));
  const z = beta.map((b, a) => b / se[a]);
  return {
    beta,
    se,
    hr: beta.map(Math.exp),
    z,
    p: z.map(zTailP2),
    loglik0,
    loglik: ll,
    iter,
    converged,
  };
}

/* Solve (-H) x = g for symmetric negative-definite H, via Cholesky of -H. */
function solveNegDefinite(H, g, p) {
  const A = new Array(p * p);
  for (let i = 0; i < p * p; i += 1) A[i] = -H[i];
  const L = cholesky(A, p);
  if (!L) return null;
  return cholSolve(L, g, p);
}

function invertNegDefinite(H, p) {
  const A = new Array(p * p);
  for (let i = 0; i < p * p; i += 1) A[i] = -H[i];
  const L = cholesky(A, p);
  if (!L) return null;
  const inv = new Array(p * p);
  for (let c = 0; c < p; c += 1) {
    const e = new Array(p).fill(0);
    e[c] = 1;
    const col = cholSolve(L, e, p);
    for (let rIdx = 0; rIdx < p; rIdx += 1) inv[rIdx * p + c] = col[rIdx];
  }
  return inv;
}

function cholesky(A, p) {
  const L = new Array(p * p).fill(0);
  for (let i = 0; i < p; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      let s = A[i * p + j];
      for (let k = 0; k < j; k += 1) s -= L[i * p + k] * L[j * p + k];
      if (i === j) {
        if (s <= 0) return null;
        L[i * p + i] = Math.sqrt(s);
      } else {
        L[i * p + j] = s / L[j * p + j];
      }
    }
  }
  return L;
}

function cholSolve(L, b, p) {
  const y = new Array(p);
  for (let i = 0; i < p; i += 1) {
    let s = b[i];
    for (let k = 0; k < i; k += 1) s -= L[i * p + k] * y[k];
    y[i] = s / L[i * p + i];
  }
  const x = new Array(p);
  for (let i = p - 1; i >= 0; i -= 1) {
    let s = y[i];
    for (let k = i + 1; k < p; k += 1) s -= L[k * p + i] * x[k];
    x[i] = s / L[i * p + i];
  }
  return x;
}
