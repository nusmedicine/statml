"""Design measurements for widget 36 `naive-bayes` (PHM5005 04-3 s.Probabilistic).

Kenneth's picks (2026-08-30): TWO TABS - Continuous (GaussianNB on CRP + WBC)
and Discrete (BernoulliNB on fever + chills) - EACH with a correlation gate
demonstrating the independence assumption double-counting; disease / no
disease framing with real-name features; ledger form A with C's running
total; log-odds bars with probability wording; title "Naive Bayes".

Measured here, before anything is drawn:

  1. Closed-form NB (Gaussian and Bernoulli, the same estimators sklearn
     uses) against sklearn itself.  The widget does this arithmetic in JS.
  2. The ledgers: per-feature log-likelihood-ratio contributions for the
     default patients - target mixed signs at readable magnitude.
  3. The two correlation gates.  Continuous: NB vs the correct equal-cov
     posterior as rho rises.  Discrete: NB vs the exact 2x2-joint posterior
     as phi (co-occurrence) rises.  Both need the second feature REDUNDANT -
     matched standardized shifts / matched marginal rates - so that at full
     correlation it repeats the first and the correct model relaxes to the
     one-feature answer while NB keeps the doubled evidence.

THE TRAP, kept from the first pass as a warning: with MISMATCHED shifts the
correct model EXPLOITS the correlation - the residual becomes class-
informative and the correct posterior runs to 1.000 at rho 0.99 while NB
stands still.  That teaches "correlation is free information", the opposite
of the caveat.  Matched shifts are load-bearing, not a convenience.

Run with the venv described in HANDOVER's *Working on Windows*:

    "C:/Users/Admin/Downloads/PHM5005 AY2025-26 - Notebooks/_scratch/venv/Scripts/python.exe" \
        widgets/_lab/nb-design.py
"""

import numpy as np
from sklearn.naive_bayes import GaussianNB, BernoulliNB

rng = np.random.default_rng(7)

P_DISEASE = 0.3          # class prior - imbalanced on purpose (the prior row
                         # must DO something in the ledger)

# Continuous: two inflammation markers, MATCHED standardized shifts (1.333 sd)
# and equal per-class sds, so the correlation gate's redundancy story is exact.
LAB = {
    #        mu_dis  sd    mu_healthy  (sd shared by both classes)
    "CRP": (24.0,   9.0,  12.0),      # mg/L    - shift 12 = 1.333 sd
    "WBC": (10.0,   2.25,  7.0),      # x10^9/L - shift  3 = 1.333 sd
}
# Discrete: MATCHED marginal rates, so at phi=1 chills repeats fever exactly.
SYM = {
    "fever":  (0.70, 0.25),   # P(present | disease), P(present | healthy)
    "chills": (0.70, 0.25),
}

N = 400  # training cohort


def make_cohort(n, rng, rho=0.0, phi=0.0):
    """Mixed cohort. rho correlates the labs; phi co-occurs the symptoms."""
    y = (rng.random(n) < P_DISEASE).astype(int)
    X_lab = np.zeros((n, 2))
    (muA1, sdA, muA0), (muB1, sdB, muB0) = LAB["CRP"], LAB["WBC"]
    for k in (0, 1):
        idx = np.where(y == k)[0]
        mA, mB = (muA1, muB1) if k else (muA0, muB0)
        cov = [[sdA**2, rho*sdA*sdB], [rho*sdA*sdB, sdB**2]]
        X_lab[idx] = rng.multivariate_normal([mA, mB], cov, size=len(idx))
    X_lab[:, 0] = np.maximum(X_lab[:, 0], 0.5)          # CRP floor, like the
                                                        # lm-diagnostics clip
    X_sym = np.zeros((n, 2))
    for k in (0, 1):
        idx = np.where(y == k)[0]
        p = SYM["fever"][0] if k else SYM["fever"][1]
        f = (rng.random(len(idx)) < p).astype(float)
        # chills: with prob phi copy fever, else independent draw at the same p
        copy = rng.random(len(idx)) < phi
        c = np.where(copy, f, (rng.random(len(idx)) < p).astype(float))
        X_sym[idx, 0] = f; X_sym[idx, 1] = c
    return X_lab, X_sym, y


# ---------------------------------------------------------------------------
# 1 - closed-form NB against sklearn (both families)
# ---------------------------------------------------------------------------

X_lab, X_sym, y = make_cohort(N, rng)

g = GaussianNB().fit(X_lab, y)
b = BernoulliNB(alpha=1.0).fit(X_sym, y)

pri = np.array([np.mean(y == 0), np.mean(y == 1)])
mu = np.array([X_lab[y == k].mean(axis=0) for k in (0, 1)])
var = np.array([X_lab[y == k].var(axis=0) for k in (0, 1)])
var += 1e-9 * X_lab.var(axis=0).max()          # sklearn's var_smoothing
cnt = np.array([[(X_sym[y == k, j] == 1).sum() for j in (0, 1)] for k in (0, 1)])
nk = np.array([(y == 0).sum(), (y == 1).sum()])
rate = (cnt + 1.0) / (nk[:, None] + 2.0)       # alpha=1 Laplace

def gauss_post(xl):
    ll = np.log(pri).copy()
    for k in (0, 1):
        ll[k] += np.sum(-0.5*np.log(2*np.pi*var[k]) - (xl - mu[k])**2/(2*var[k]))
    p = np.exp(ll - ll.max()); return p / p.sum()

def bern_post(xs):
    ll = np.log(pri).copy()
    for k in (0, 1):
        ll[k] += np.sum(np.where(xs == 1, np.log(rate[k]), np.log(1 - rate[k])))
    p = np.exp(ll - ll.max()); return p / p.sum()

worst_g = max(np.abs(g.predict_proba(x[None, :])[0] - gauss_post(x)).max()
              for x in [np.array([20.0, 6.5]), np.array([30.0, 11.0]), np.array([8.0, 7.0])])
worst_b = max(np.abs(b.predict_proba(x[None, :])[0] - bern_post(x)).max()
              for x in [np.array([1.0, 0.0]), np.array([1.0, 1.0]), np.array([0.0, 0.0])])
print(f"[1] closed form vs sklearn: GaussianNB worst |dP| = {worst_g:.2e}, "
      f"BernoulliNB worst |dP| = {worst_b:.2e}")

# ---------------------------------------------------------------------------
# 2 - the two ledgers, on the fitted model
# ---------------------------------------------------------------------------

def lab_lr(j, x):
    return (-0.5*np.log(var[1][j]/var[0][j])
            - (x-mu[1][j])**2/(2*var[1][j]) + (x-mu[0][j])**2/(2*var[0][j]))

def sym_lr(j, present):
    num = rate[1][j] if present else 1 - rate[1][j]
    den = rate[0][j] if present else 1 - rate[0][j]
    return np.log(num/den)

prior_lr = np.log(pri[1]/pri[0])
sig = lambda z: 1/(1+np.exp(-z))

print("\n[2] ledgers (fitted, n 400) - target mixed signs, |x| in ~0.3..2.5")
for name, (crp, wbc) in {"conflicted (CRP 20, WBC 6.5)": (20.0, 6.5),
                         "textbook (CRP 30, WBC 11)":    (30.0, 11.0),
                         "clean (CRP 8, WBC 7)":         (8.0, 7.0)}.items():
    rows = [("prior", prior_lr), ("CRP", lab_lr(0, crp)), ("WBC", lab_lr(1, wbc))]
    total = sum(v for _, v in rows)
    print(f"  cont {name:32s} " + "  ".join(f"{k}:{v:+.2f}" for k, v in rows)
          + f"  ->  P(disease)={sig(total):.3f}")
for name, (f, c) in {"conflicted (fever yes, chills no)": (1, 0),
                     "both present":                      (1, 1),
                     "neither":                           (0, 0)}.items():
    rows = [("prior", prior_lr), ("fever", sym_lr(0, f)), ("chills", sym_lr(1, c))]
    total = sum(v for _, v in rows)
    print(f"  disc {name:32s} " + "  ".join(f"{k}:{v:+.2f}" for k, v in rows)
          + f"  ->  P(disease)={sig(total):.3f}")

# ---------------------------------------------------------------------------
# 3a - continuous gate: NB vs correct as rho rises (population parameters)
# ---------------------------------------------------------------------------

(muA1, sdA, muA0), (muB1, sdB, muB0) = LAB["CRP"], LAB["WBC"]
lp = np.log(P_DISEASE/(1-P_DISEASE))

def cont_posts(x, rho):
    S = np.array([[sdA**2, rho*sdA*sdB], [rho*sdA*sdB, sdB**2]])
    Si = np.linalg.inv(S)
    d1 = x - np.array([muA1, muB1]); d0 = x - np.array([muA0, muB0])
    correct = lp - 0.5*d1 @ Si @ d1 + 0.5*d0 @ Si @ d0
    nb = (lp - d1[0]**2/(2*sdA**2) - d1[1]**2/(2*sdB**2)
             + d0[0]**2/(2*sdA**2) + d0[1]**2/(2*sdB**2))
    return sig(nb), sig(correct)

print("\n[3a] continuous gate - elevated patient consistent with the correlation")
a = 22.0                                        # ~1.1 sd above healthy CRP
xp = np.array([a, muB0 + (a-muA0)/sdA*sdB])
one = sig(lp - (a-muA1)**2/(2*sdA**2) + (a-muA0)**2/(2*sdA**2))
print(f"  patient CRP {a:.0f}, WBC {xp[1]:.1f}; one-lab answer {one:.3f}")
for rho in (0.0, 0.5, 0.8, 0.95):
    nb_p, ok_p = cont_posts(xp, rho)
    print(f"    rho={rho:.2f}  NB={nb_p:.3f}  correct={ok_p:.3f}")

# ---------------------------------------------------------------------------
# 3b - discrete gate: NB vs the exact joint as phi rises.
#      chills = fever with prob phi, else independent at the same rate.
#      Joint per class: P(f=1,c=1) = phi*p + (1-phi)*p^2, etc.  Marginals do
#      not move with phi, so NB (built from marginals) is exactly flat.
# ---------------------------------------------------------------------------

print("\n[3b] discrete gate - patient with fever AND chills (population rates)")
p1, p0 = SYM["fever"]
def joint(p, phi, f, c):
    if f == 1 and c == 1: return phi*p + (1-phi)*p*p
    if f == 0 and c == 0: return phi*(1-p) + (1-phi)*(1-p)*(1-p)
    return (1-phi)*p*(1-p)
one_sym = sig(lp + np.log(p1/p0))
print(f"  one-symptom answer {one_sym:.3f}")
for phi in (0.0, 0.5, 0.8, 1.0):
    nb = sig(lp + 2*np.log(p1/p0))              # marginals never move
    ok = sig(lp + np.log(joint(p1, phi, 1, 1)/joint(p0, phi, 1, 1)))
    print(f"    phi={phi:.2f}  NB={nb:.3f}  correct={ok:.3f}")
