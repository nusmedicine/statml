import numpy as np, pandas as pd, itertools, math
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier, export_text
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
CSV="C:/Users/Admin/Downloads/PHM5005 AY2025-26 - Notebooks/_scratch/heart_failure_alpha.csv"
d=pd.read_csv(CSV); F=["age","ejection_fraction","serum_creatinine"]
y=(d["DEATH_EVENT"]=="Y").astype(int).values; X=d[F].values.astype(float)
Xtr,Xte,ytr,yte=train_test_split(X,y,test_size=0.2,random_state=42,stratify=y)

for depth in (2,3):
    t=DecisionTreeClassifier(class_weight="balanced",max_depth=depth,random_state=42).fit(Xtr,ytr)
    print("\n=== depth %d, AUC %.4f, leaves %d ===" % (depth, roc_auc_score(yte,t.predict_proba(Xte)[:,1]), t.get_n_leaves()))
    print(export_text(t, feature_names=F, decimals=1))

print("\n=== the interaction, measured directly on the RAW data ===")
lo_ef = d["ejection_fraction"]<=30; hi_cr = d["serum_creatinine"]>=1.4; old = d["age"]>=65
for nm, m in [("EF<=30",lo_ef),("EF>30",~lo_ef),("creat>=1.4",hi_cr),("creat<1.4",~hi_cr),("age>=65",old),("age<65",~old)]:
    print("  %-12s n=%3d  death %.3f" % (nm, m.sum(), y[m.values].mean()))
print("  2x2 on EF x creatinine (death rate, n):")
for a,an in [(lo_ef,"EF<=30"),(~lo_ef,"EF>30")]:
    row=[]
    for b_,bn in [(hi_cr,"creat>=1.4"),(~hi_cr,"creat<1.4")]:
        m=(a&b_).values; row.append("%s %.3f (n=%d)"%(bn,y[m].mean(),m.sum()))
    print("    %-8s %s" % (an, "   ".join(row)))
print("  2x2 on age x EF:")
for a,an in [(old,"age>=65"),(~old,"age<65")]:
    row=[]
    for b_,bn in [(lo_ef,"EF<=30"),(~lo_ef,"EF>30")]:
        m=(a&b_).values; row.append("%s %.3f (n=%d)"%(bn,y[m].mean(),m.sum()))
    print("    %-8s %s" % (an, "   ".join(row)))

# how big does the ordering count get?
print("\n=== orderings and coalitions by feature count ===")
for p in (2,3,4,5,11):
    print("  p=%2d  coalitions 2^p=%-8d orderings p!=%d" % (p, 2**p, math.factorial(p)))
