# Part 2: does the ORDER matter? The notebook's formula averages over all
# orderings, but on an ADDITIVE model every ordering gives the same number, so
# the machinery is invisible. Measure the gap on a model that interacts.
import numpy as np, pandas as pd, itertools, math
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.tree import DecisionTreeClassifier, export_text
from sklearn.metrics import roc_auc_score

CSV = "C:/Users/Admin/Downloads/PHM5005 AY2025-26 - Notebooks/_scratch/heart_failure_alpha.csv"
d = pd.read_csv(CSV)
F = ["age","ejection_fraction","serum_creatinine"]
y = (d["DEATH_EVENT"]=="Y").astype(int).values
X = d[F].values.astype(float)
Xtr_r, Xte_r, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
sc = StandardScaler().fit(Xtr_r); Xtr = sc.transform(Xtr_r); Xte = sc.transform(Xte_r)

print("=== correlations among ALL 11 raw numeric+binary features (train) ===")
num = ["age","creatinine_phosphokinase","ejection_fraction","platelets","serum_creatinine","serum_sodium"]
C = d[num].corr()
mx = 0; pair=None
for i in range(len(num)):
    for j in range(i+1,len(num)):
        if abs(C.iloc[i,j])>mx: mx=abs(C.iloc[i,j]); pair=(num[i],num[j],C.iloc[i,j])
print("largest |r| among numerics:", pair)
print(C.round(3).to_string())

def shap_bruteforce(f, x, bg, p):
    """Exact interventional Shapley values by enumerating every coalition.
    v(S) = mean over background of f(x with S from the patient, rest from bg)."""
    idx = list(range(p)); phi = np.zeros(p)
    vcache = {}
    def v(S):
        S = tuple(sorted(S))
        if S in vcache: return vcache[S]
        Z = bg.copy()
        for k in S: Z[:,k] = x[k]
        r = float(f(Z).mean()); vcache[S] = r; return r
    for i in idx:
        rest = [k for k in idx if k!=i]
        for r in range(len(rest)+1):
            for S in itertools.combinations(rest, r):
                w = math.factorial(len(S))*math.factorial(p-len(S)-1)/math.factorial(p)
                phi[i] += w*(v(list(S)+[i]) - v(list(S)))
    return phi, v

def per_ordering(v, p):
    """Marginal contribution of each feature under each of the p! orderings."""
    rows = []
    for perm in itertools.permutations(range(p)):
        S=[]; delta=np.zeros(p)
        for i in perm:
            delta[i] = v(S+[i]) - v(S); S = S+[i]
        rows.append((perm, delta))
    return rows

for name, mk, out in [
    ("LogisticRegression (log-odds)", lambda: LogisticRegression(class_weight="balanced", random_state=42).fit(Xtr,ytr),
        lambda m: (lambda Z: m.decision_function(Z))),
    ("RandomForest 300 trees (prob)", lambda: RandomForestClassifier(class_weight="balanced", n_estimators=300, n_jobs=-1, random_state=42).fit(Xtr,ytr),
        lambda m: (lambda Z: m.predict_proba(Z)[:,1])),
    ("DecisionTree depth 3 (prob)", lambda: DecisionTreeClassifier(class_weight="balanced", max_depth=3, random_state=42).fit(Xtr,ytr),
        lambda m: (lambda Z: m.predict_proba(Z)[:,1])),
]:
    m = mk(); f = out(m)
    print("\n==================== %s ====================" % name)
    print("test AUC on 3 features: %.4f" % roc_auc_score(yte, m.predict_proba(Xte)[:,1]))
    base = float(f(Xtr).mean())
    # spread of per-ordering deltas, over all test patients
    worst = 0; worst_i = None
    spreads = []
    for i in range(len(Xte)):
        phi, v = shap_bruteforce(f, Xte[i], Xtr, 3)
        rows = per_ordering(v, 3)
        D = np.array([r[1] for r in rows])
        s = float(D.max(axis=0).max() - D.min(axis=0).min())
        rng_per_feat = D.max(axis=0)-D.min(axis=0)
        spreads.append(rng_per_feat.max())
        if rng_per_feat.max() > worst: worst = rng_per_feat.max(); worst_i = i
    spreads = np.array(spreads)
    print("per-ordering spread of a feature's marginal contribution, over 60 test patients:")
    print("   max %.4f   median %.4f   mean %.4f   (0 => order never matters)" % (spreads.max(), np.median(spreads), spreads.mean()))
    i = worst_i
    phi, v = shap_bruteforce(f, Xte[i], Xtr, 3)
    print("\n   widest patient = test #%d  raw %s" % (i, dict(zip(F, np.round(Xte_r[i],2)))))
    print("   base v(empty) = %.4f   v(all) = %.4f   died=%d" % (v([]), v([0,1,2]), yte[i]))
    print("   %-28s %8s %8s %8s" % ("ordering","age","EF","creat"))
    for perm, delta in per_ordering(v, 3):
        print("   %-28s %8.4f %8.4f %8.4f" % ("->".join(F[k][:5] for k in perm), *delta))
    print("   %-28s %8.4f %8.4f %8.4f   sum=%.4f  v(N)-v(0)=%.4f" % ("SHAPLEY (average)", *phi, phi.sum(), v([0,1,2])-v([])))
