# logit1.py - candidates for widget 15's one-covariate act, measured.
# A: TenYearCHD ~ age (single covariate, same rows as the widget's model)
# B: prevalentHyp ~ sysBP (the built-and-cut pair, full sigmoid)
# Fits via sklearn LogisticRegression (no penalty) to match R glm.
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

d = pd.read_csv("framingham.csv")

def fit(x, y, name, lo, hi):
    m = LogisticRegression(penalty=None, max_iter=1000)
    X = x.values.reshape(-1, 1)
    m.fit(X, y)
    b0 = m.intercept_[0]
    b1 = m.coef_[0][0]
    p_lo = 1 / (1 + np.exp(-(b0 + b1 * lo)))
    p_hi = 1 / (1 + np.exp(-(b0 + b1 * hi)))
    mid = -b0 / b1
    # the linear probability model on the same rows
    A = np.column_stack([np.ones(len(x)), x])
    ols, *_ = np.linalg.lstsq(A, y, rcond=None)
    pred = A @ ols
    n_bad = int(((pred < 0) | (pred > 1)).sum())
    print(f"{name}: n={len(x)}  b0={b0:.5f} b1={b1:.5f}")
    print(f"  fitted p spans {p_lo:.4f} -> {p_hi:.4f} over x in [{lo}, {hi}];  p=0.5 at x={mid:.1f}")
    print(f"  OLS line: {ols[0]:.4f} + {ols[1]:.5f}x; impossible people: {n_bad} of {len(x)}"
          f" ({100*n_bad/len(x):.1f}%); worst {pred.min():.3f} .. {pred.max():.3f}")
    return b0, b1

# A: CHD ~ age, complete cases on the widget's variables (matches 3658 rows)
cc = d.dropna(subset=["BMI", "age", "TenYearCHD"])
print("complete cases (BMI, age, CHD):", len(cc))
fit(cc["age"], cc["TenYearCHD"], "A  TenYearCHD ~ age", 32, 70)

# B: prevalentHyp ~ sysBP
cb = d.dropna(subset=["sysBP", "prevalentHyp"])
b0, b1 = fit(cb["sysBP"], cb["prevalentHyp"], "B  prevalentHyp ~ sysBP",
             cb["sysBP"].min(), cb["sysBP"].max())

# B's aggregate size at 2-mmHg bins, for the widget's aggregates-not-rows rule
bins = (cb["sysBP"] / 2).round() * 2
agg = cb.groupby(bins)["prevalentHyp"].agg(["count", "sum"])
print(f"B aggregated at 2 mmHg: {len(agg)} bins, sysBP {bins.min()} .. {bins.max()}")
