"""Page 2's engine: which second model can ship, and how big is it.
The notebook DEFINES a 300-tree RandomForest and never fits it; the only model
it explains is the logistic regression its own section 1 calls inherently
explainable. Page 2 needs a second model that (a) is honestly better, (b) makes
the orderings disagree, and (c) fits in a widget with no build step."""
import numpy as np, pandas as pd, itertools, math, json
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import roc_auc_score

CSV = "C:/Users/Admin/Downloads/PHM5005 AY2025-26 - Notebooks/_scratch/heart_failure_alpha.csv"
d = pd.read_csv(CSV)
F = ["age", "ejection_fraction", "serum_creatinine"]
y = (d["DEATH_EVENT"] == "Y").astype(int).values
X = d[F].values.astype(float)
Xtr_r, Xte_r, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
sc = StandardScaler().fit(Xtr_r)
Xtr, Xte = sc.transform(Xtr_r), sc.transform(Xte_r)

SUBSETS = [(), (0,), (1,), (2,), (0,1), (0,2), (1,2), (0,1,2)]
PERMS = list(itertools.permutations(range(3)))
def vtab(f, x):
    out = {}
    for S in SUBSETS:
        Z = Xtr.copy()
        for k in S: Z[:, k] = x[k]
        out["".join(map(str, S)) or "-"] = float(f(Z).mean())
    return out
def spread(V):
    best = 0
    for i in range(3):
        ds = []
        for p in PERMS:
            cur, S = V["-"], []
            for q in p:
                S = sorted(S + [q]); n = V["".join(map(str, S))]
                if q == i: ds.append(n - cur)
                cur = n
        best = max(best, max(ds) - min(ds))
    return best

def tree_nodes(t):
    return int(t.tree_.node_count)
def tree_json(t):
    T = t.tree_
    def node(i):
        if T.children_left[i] == -1:
            v = T.value[i][0]; return {"p": round(float(v[1] / v.sum()), 6)}
        return {"f": int(T.feature[i]), "t": round(float(T.threshold[i]), 6),
                "L": node(T.children_left[i]), "R": node(T.children_right[i])}
    return node(0)

cands = [
    ("LogisticRegression (the notebook fits this)",
     LogisticRegression(class_weight="balanced", random_state=42).fit(Xtr, ytr),
     lambda m: m.decision_function, "log-odds"),
    ("RandomForest 300, depth None (the notebook DEFINES this)",
     RandomForestClassifier(class_weight="balanced", n_estimators=300, max_depth=None,
                            n_jobs=-1, random_state=42).fit(Xtr, ytr),
     lambda m: (lambda Z: m.predict_proba(Z)[:, 1]), "probability"),
    ("RandomForest 25, depth 4",
     RandomForestClassifier(class_weight="balanced", n_estimators=25, max_depth=4,
                            n_jobs=-1, random_state=42).fit(Xtr, ytr),
     lambda m: (lambda Z: m.predict_proba(Z)[:, 1]), "probability"),
    ("DecisionTree depth 3",
     DecisionTreeClassifier(class_weight="balanced", max_depth=3, random_state=42).fit(Xtr, ytr),
     lambda m: (lambda Z: m.predict_proba(Z)[:, 1]), "probability"),
]
print("%-56s %7s %9s %9s %9s" % ("model", "AUC", "sprd med", "sprd max", "nodes"))
for name, m, fmk, scale in cands:
    f = fmk(m)
    sp = [spread(vtab(f, Xte[i])) for i in range(len(Xte))]
    nodes = (sum(tree_nodes(t) for t in m.estimators_) if hasattr(m, "estimators_")
             else (tree_nodes(m) if hasattr(m, "tree_") else 0))
    print("%-56s %7.4f %9.4f %9.4f %9s" % (name, roc_auc_score(yte, m.predict_proba(Xte)[:, 1]),
                                           float(np.median(sp)), float(np.max(sp)), nodes or "—"))

lr = cands[0][1]
rf25 = cands[2][1]
tr3 = cands[3][1]
print("\nJSON size of a shippable forest (25 trees, depth 4): %d bytes"
      % len(json.dumps([tree_json(t) for t in rf25.estimators_])))
print("JSON size of one depth-3 tree: %d bytes" % len(json.dumps(tree_json(tr3))))
print("background 239 x 3 standardized floats: %d bytes"
      % len(json.dumps([[round(v, 4) for v in r] for r in Xtr.tolist()])))
print("\nLR coef %s  intercept %.6f" % (np.round(lr.coef_[0], 6), lr.intercept_[0]))
print("scaler mean %s  scale %s" % (np.round(sc.mean_, 6), np.round(sc.scale_, 6)))
