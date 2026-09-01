"""Fixture for the widget-38 mock: notebook 04-5's pipeline, plus every number
a SHAP figure needs, computed by BRUTE-FORCE coalition enumeration so the mock
cannot quietly disagree with the definition."""
import numpy as np, pandas as pd, itertools, math, json
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder, LabelEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import roc_auc_score

CSV="C:/Users/Admin/Downloads/PHM5005 AY2025-26 - Notebooks/_scratch/heart_failure_alpha.csv"
d=pd.read_csv(CSV)
F=["age","ejection_fraction","serum_creatinine"]
SHORT=["Age","Ejection fraction","Serum creatinine"]
UNITS=["years","%","mg/dL"]
y=(d["DEATH_EVENT"]=="Y").astype(int).values
X=d[F].values.astype(float)
itr,ite=train_test_split(np.arange(len(d)),test_size=0.2,random_state=42,stratify=y)
Xtr_r,Xte_r,ytr,yte=X[itr],X[ite],y[itr],y[ite]
sc=StandardScaler().fit(Xtr_r); Xtr=sc.transform(Xtr_r); Xte=sc.transform(Xte_r)

lr=LogisticRegression(class_weight="balanced",random_state=42).fit(Xtr,ytr)
tr=DecisionTreeClassifier(class_weight="balanced",max_depth=3,random_state=42).fit(Xtr,ytr)

def tree_json(t, names):
    T=t.tree_
    def node(i):
        if T.children_left[i]==-1:
            v=T.value[i][0]; return {"leaf":True,"p":float(v[1]/v.sum()),"n":int(T.n_node_samples[i])}
        return {"leaf":False,"f":int(T.feature[i]),"name":names[T.feature[i]],
                "thr_std":float(T.threshold[i]),
                "thr_raw":float(T.threshold[i]*sc.scale_[T.feature[i]]+sc.mean_[T.feature[i]]),
                "n":int(T.n_node_samples[i]),"L":node(T.children_left[i]),"R":node(T.children_right[i])}
    return node(0)

MODELS={
 "lr_margin": lambda Z: lr.decision_function(Z),
 "lr_prob":   lambda Z: lr.predict_proba(Z)[:,1],
 "tree_prob": lambda Z: tr.predict_proba(Z)[:,1],
}
SUBSETS=[(),(0,),(1,),(2,),(0,1),(0,2),(1,2),(0,1,2)]
PERMS=list(itertools.permutations(range(3)))

def vtable(f,x,bg):
    out={}
    for S in SUBSETS:
        Z=bg.copy()
        for k in S: Z[:,k]=x[k]
        out["".join(str(k) for k in S) or "-"]=float(f(Z).mean())
    return out
def shap_from_v(V):
    phi=[0.0]*3
    for i in range(3):
        rest=[k for k in range(3) if k!=i]
        for r in range(3):
            for S in itertools.combinations(rest,r):
                w=math.factorial(len(S))*math.factorial(2-len(S))/6.0
                a="".join(str(k) for k in sorted(S+(i,))); b="".join(str(k) for k in sorted(S)) or "-"
                phi[i]+=w*(V[a]-V[b])
    return phi
def perm_deltas(V):
    rows=[]
    for p in PERMS:
        S=[];dl=[0.0]*3
        for i in p:
            a="".join(str(k) for k in sorted(S+[i])); b="".join(str(k) for k in sorted(S)) or "-"
            dl[i]=V[a]-V[b]; S=S+[i]
        rows.append({"order":list(p),"delta":dl})
    return rows

patients=[]
for j in range(len(Xte)):
    rec={"i":int(ite[j]),"raw":[float(v) for v in Xte_r[j]],"std":[float(v) for v in Xte[j]],
         "died":int(yte[j]),"models":{}}
    for mk,f in MODELS.items():
        V=vtable(f,Xte[j],Xtr); phi=shap_from_v(V)
        rec["models"][mk]={"v":V,"phi":phi,"perms":perm_deltas(V),
                           "fx":V["012"],"base":V["-"],
                           "spread":[max(r["delta"][i] for r in perm_deltas(V))-min(r["delta"][i] for r in perm_deltas(V)) for i in range(3)]}
    patients.append(rec)

# ---- the notebook's FULL 11-feature model, for the beeswarm --------------
Xa=d.drop(columns=["DEATH_EVENT"]); ya=d["DEATH_EVENT"]
cat=Xa.select_dtypes(include=["object","category","str"]).columns.tolist(); num=[c for c in Xa.columns if c not in cat]
A,B,ay,by=train_test_split(Xa,ya,test_size=0.2,random_state=42,stratify=ya)
pre=ColumnTransformer([('num',Pipeline([('s',StandardScaler())]),num),
                       ('cat',Pipeline([('e',OneHotEncoder(drop="if_binary",handle_unknown='ignore'))]),cat)])
A2=pre.fit_transform(A); B2=pre.transform(B)
le=LabelEncoder(); ay2=le.fit_transform(ay); by2=le.transform(by)
lr11=LogisticRegression(class_weight="balanced",random_state=42).fit(A2,ay2)
names11=[n.replace("num__","").replace("cat__","") for n in pre.get_feature_names_out()]
mu11=A2.mean(axis=0); b11=lr11.coef_[0]
phi11=(B2-mu11)*b11

out={
 "source":"heart_failure_alpha.csv (299 rows, Chicco & Jurman 2020) via notebook 04-5",
 "features":F,"labels":SHORT,"units":UNITS,
 "scaler":{"mean":sc.mean_.tolist(),"scale":sc.scale_.tolist()},
 "train":{"raw":Xtr_r.tolist(),"std":Xtr.tolist(),"y":ytr.tolist()},
 "test_raw":Xte_r.tolist(),"test_y":yte.tolist(),
 "lr":{"coef":lr.coef_[0].tolist(),"intercept":float(lr.intercept_[0]),
       "auc":float(roc_auc_score(yte,lr.predict_proba(Xte)[:,1])),
       "train_mean_std":Xtr.mean(axis=0).tolist()},
 "tree":{"root":tree_json(tr,F),"auc":float(roc_auc_score(yte,tr.predict_proba(Xte)[:,1])),
         "leaves":int(tr.get_n_leaves())},
 "patients":patients,
 "full11":{"names":names11,"coef":b11.tolist(),"mean":mu11.tolist(),
           "intercept":float(lr11.intercept_[0]),
           "base":float(lr11.intercept_[0]+mu11@b11),
           "phi_test":phi11.tolist(),"x_test":B2.tolist(),"y_test":by2.tolist(),
           "auc":float(roc_auc_score(by2,lr11.predict_proba(B2)[:,1]))},
}
json.dump(out,open("widgets/_lab/shap-ref.json","w"))
print("wrote widgets/_lab/shap-ref.json")
print("lr 3-feature AUC %.4f   tree AUC %.4f   lr 11-feature AUC %.4f" % (out["lr"]["auc"],out["tree"]["auc"],out["full11"]["auc"]))
print("lr coef", np.round(lr.coef_[0],4), "intercept %.4f"%lr.intercept_[0])

# a few candidate patients for the mock, chosen on what they SHOW
sp_tree=np.array([max(p["models"]["tree_prob"]["spread"]) for p in patients])
sp_lr  =np.array([max(p["models"]["lr_margin"]["spread"]) for p in patients])
print("\nper-ordering spread, tree: max %.4f median %.4f | lr margin: max %.2e"%(sp_tree.max(),np.median(sp_tree),sp_lr.max()))
print("\ncandidate patients (3-feature LR, log-odds):")
print("%-4s %-6s %-6s %-6s %-5s %9s %9s %9s %9s %8s"%("i","age","EF","creat","died","phi_age","phi_EF","phi_cr","f(x)","treeSprd"))
mu=Xtr.mean(axis=0)
for j,p in enumerate(patients):
    ph=p["models"]["lr_margin"]["phi"]
    print("%-4d %-6.0f %-6.0f %-6.2f %-5d %9.4f %9.4f %9.4f %9.4f %8.3f"%(
        j,p["raw"][0],p["raw"][1],p["raw"][2],p["died"],ph[0],ph[1],ph[2],
        p["models"]["lr_margin"]["fx"], max(p["models"]["tree_prob"]["spread"])))
