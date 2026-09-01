# Widget 38 planning: reproduce notebook 04-5's pipeline exactly, then measure
# what a SHAP widget could show. No shap library needed for a LINEAR model:
# the interventional Shapley value has a closed form, phi_i = b_i (x_i - mean_i).
import numpy as np, pandas as pd, itertools, json
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder, LabelEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, roc_auc_score

CSV = "C:/Users/Admin/Downloads/PHM5005 AY2025-26 - Notebooks/_scratch/heart_failure_alpha.csv"
data_hf = pd.read_csv(CSV)
X = data_hf.drop(columns=["DEATH_EVENT"]); y = data_hf["DEATH_EVENT"]
cat = X.select_dtypes(include=['object','category']).columns.tolist()
num = [c for c in X.columns if c not in cat]
print("rows", len(data_hf), "cat", cat, "num", num)
print("outcome", y.value_counts().to_dict())

Xtr_raw, Xte_raw, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
pre = ColumnTransformer([('num', Pipeline([('scaler', StandardScaler())]), num),
                         ('cat', Pipeline([('encoder', OneHotEncoder(drop="if_binary", handle_unknown='ignore'))]), cat)])
Xtr = pre.fit_transform(Xtr_raw); Xte = pre.transform(Xte_raw)
le = LabelEncoder(); ytr = le.fit_transform(ytr); yte = le.transform(yte)
names = list(pre.get_feature_names_out())
print("classes", list(le.classes_), "-> 0,1")
print("features", len(names), names)

lr = LogisticRegression(class_weight="balanced", random_state=42).fit(Xtr, ytr)
print("\n=== notebook's model: LogisticRegression(class_weight='balanced') ===")
print(classification_report(yte, lr.predict(Xte), digits=3))
print("test AUC %.4f" % roc_auc_score(yte, lr.predict_proba(Xte)[:,1]))

b = lr.coef_[0]; b0 = lr.intercept_[0]
mu = Xtr.mean(axis=0); sd = Xtr.std(axis=0)
print("\n%-34s %8s %8s %8s %8s" % ("feature","beta","mean_tr","sd_tr","mean|phi|"))
phi_te = (Xte - mu) * b            # exact interventional SHAP for a linear model
phi_tr = (Xtr - mu) * b
order = np.argsort(-np.abs(phi_te).mean(axis=0))
for j in order:
    print("%-34s %8.4f %8.4f %8.4f %8.4f" % (names[j], b[j], mu[j], sd[j], np.abs(phi_te[:,j]).mean()))
base = b0 + float(mu @ b)
print("\nbase value phi0 = b0 + mu.b = %.6f  (log-odds); sigmoid = %.4f" % (base, 1/(1+np.exp(-base))))
print("mean margin over TRAIN = %.6f  (equals phi0 by construction: %.2e)" % (
    (Xtr@b+b0).mean(), abs((Xtr@b+b0).mean()-base)))
add = np.abs(base + phi_te.sum(axis=1) - (Xte@b+b0)).max()
print("additivity check max|phi0+sum(phi)-margin| = %.3e" % add)

print("\n=== ranking: |beta| vs mean|phi| — do they disagree? ===")
rb = np.argsort(-np.abs(b)); rp = np.argsort(-np.abs(phi_te).mean(axis=0))
print("%-4s %-34s %-34s" % ("#","by |beta|","by mean|SHAP|"))
for i in range(len(names)):
    print("%-4d %-34s %-34s" % (i+1, "%s (%.3f)"%(names[rb[i]],abs(b[rb[i]])),
                                     "%s (%.3f)"%(names[rp[i]],np.abs(phi_te[:,rp[i]]).mean())))

print("\n=== the coefficient-is-not-the-attribution case ===")
# for each feature, how often is |phi| small even though |beta| is large?
for j in np.argsort(-np.abs(b))[:4]:
    small = (np.abs(phi_te[:,j]) < 0.1).mean()
    print("%-34s |beta|=%.3f  |phi|<0.1 for %4.1f%% of test patients" % (names[j], abs(b[j]), 100*small))
np.save("widgets/_lab/_shap_tmp.npy", np.array([0]))
