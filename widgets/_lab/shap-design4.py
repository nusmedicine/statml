# Part 3: THE SCALE. shap.Explainer(LogisticRegression, X) explains the MARGIN
# (log-odds), where the model is additive and every ordering agrees. Explain the
# same model's PROBABILITY and the sigmoid makes it non-additive -- so the
# orderings must disagree. Measure by how much.
import numpy as np, pandas as pd, itertools, math
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
CSV="C:/Users/Admin/Downloads/PHM5005 AY2025-26 - Notebooks/_scratch/heart_failure_alpha.csv"
d=pd.read_csv(CSV); F=["age","ejection_fraction","serum_creatinine"]
y=(d["DEATH_EVENT"]=="Y").astype(int).values; X=d[F].values.astype(float)
Xtr_r,Xte_r,ytr,yte=train_test_split(X,y,test_size=0.2,random_state=42,stratify=y)
sc=StandardScaler().fit(Xtr_r); Xtr=sc.transform(Xtr_r); Xte=sc.transform(Xte_r)
lr=LogisticRegression(class_weight="balanced",random_state=42).fit(Xtr,ytr)
tr=DecisionTreeClassifier(class_weight="balanced",max_depth=3,random_state=42).fit(Xtr,ytr)

def vfun(f,x,bg):
    c={}
    def v(S):
        S=tuple(sorted(S))
        if S in c: return c[S]
        Z=bg.copy()
        for k in S: Z[:,k]=x[k]
        c[S]=float(f(Z).mean()); return c[S]
    return v
def shapley(v,p):
    phi=np.zeros(p)
    for i in range(p):
        rest=[k for k in range(p) if k!=i]
        for r in range(len(rest)+1):
            for S in itertools.combinations(rest,r):
                w=math.factorial(len(S))*math.factorial(p-len(S)-1)/math.factorial(p)
                phi[i]+=w*(v(list(S)+[i])-v(list(S)))
    return phi
def orderings(v,p):
    out=[]
    for perm in itertools.permutations(range(p)):
        S=[];dl=np.zeros(p)
        for i in perm: dl[i]=v(S+[i])-v(S); S=S+[i]
        out.append((perm,dl))
    return out

for nm,f in [("LR  margin (log-odds)  <- what shap.Explainer(lr,X) returns", lambda Z: lr.decision_function(Z)),
             ("LR  probability        <- the scale students assume",         lambda Z: lr.predict_proba(Z)[:,1]),
             ("Tree probability",                                            lambda Z: tr.predict_proba(Z)[:,1])]:
    sp=[]
    for i in range(len(Xte)):
        v=vfun(f,Xte[i],Xtr); D=np.array([r[1] for r in orderings(v,3)])
        sp.append(float((D.max(axis=0)-D.min(axis=0)).max()))
    sp=np.array(sp)
    print("%-58s spread over orderings: max %.4f  median %.4f  zero for %d/60 patients"
          % (nm, sp.max(), np.median(sp), int((sp<1e-12).sum())))

print("\n=== the same patient, both scales ===")
b=lr.coef_[0]; b0=lr.intercept_[0]; mu=Xtr.mean(axis=0)
for i in [20, 52, 0]:
    v1=vfun(lambda Z: lr.decision_function(Z), Xte[i], Xtr)
    v2=vfun(lambda Z: lr.predict_proba(Z)[:,1], Xte[i], Xtr)
    p1=shapley(v1,3); p2=shapley(v2,3)
    closed=(Xte[i]-mu)*b
    print("\n test #%d  %s  died=%d" % (i, dict(zip(F,np.round(Xte_r[i],1))), yte[i]))
    print("   log-odds : base %+.4f  phi %s  -> f=%.4f   closed form b(x-mu)=%s  maxdiff %.2e"
          % (v1([]), np.round(p1,4), v1([0,1,2]), np.round(closed,4), np.abs(p1-closed).max()))
    print("   prob     : base %+.4f  phi %s  -> f=%.4f   sigmoid(log-odds parts) do NOT add"
          % (v2([]), np.round(p2,4), v2([0,1,2])))
    D=np.array([r[1] for r in orderings(v2,3)])
    print("   prob per-ordering range per feature: %s" % np.round(D.max(axis=0)-D.min(axis=0),4))

print("\n=== 11-feature model, ordering count ===")
print("   11 features -> 39,916,800 orderings, 2048 coalitions")
