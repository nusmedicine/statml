# roc1.py - reproduce 04-2 Model Evaluation cells 16-39 exactly, and dump
# everything a roc-auc widget could need. Mirrors the notebook line by line.
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder, LabelEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, precision_score, recall_score,
                             f1_score, classification_report, confusion_matrix,
                             roc_curve, roc_auc_score)

data_hf = pd.read_csv("heart_failure_alpha.csv")
X = data_hf.drop(columns=["DEATH_EVENT"])
y = data_hf["DEATH_EVENT"]

categorical_cols = X.select_dtypes(include=['object', 'category']).columns.tolist()
numeric_cols = [c for c in X.columns if c not in categorical_cols]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y)

num_pipeline = Pipeline([('scaler', StandardScaler())])
cat_pipeline = Pipeline([('encoder', OneHotEncoder(drop='if_binary',
                                                   handle_unknown='ignore'))])
preprocessor = ColumnTransformer([
    ('num', num_pipeline, numeric_cols),
    ('cat', cat_pipeline, categorical_cols)])

X_train = preprocessor.fit_transform(X_train)
X_test = preprocessor.transform(X_test)
label_enc = LabelEncoder()
y_train = label_enc.fit_transform(y_train)
y_test = label_enc.transform(y_test)

print("n =", len(data_hf), " train =", X_train.shape, " test =", X_test.shape)
print("classes:", list(label_enc.classes_), " test pos =", int(y_test.sum()),
      "of", len(y_test), " train pos =", int(y_train.sum()), "of", len(y_train))

model = LogisticRegression(class_weight='balanced')
model.fit(X_train, y_train)
y_pred_train = model.predict(X_train)
y_pred_test = model.predict(X_test)

print("\n--- cell 22: metrics at 0.5 ---")
for name, yt, yp in [("Train", y_train, y_pred_train), ("Test", y_test, y_pred_test)]:
    print(f"{name}: acc={accuracy_score(yt, yp):.4f} prec={precision_score(yt, yp):.4f} "
          f"rec={recall_score(yt, yp):.4f} f1={f1_score(yt, yp):.4f}")

print("\n--- cell 20: confusion matrices (rows true 0/1, cols pred 0/1) ---")
print("train:\n", confusion_matrix(y_train, y_pred_train))
print("test:\n", confusion_matrix(y_test, y_pred_test))

y_prob_test = model.predict_proba(X_test)[:, 1]
fpr, tpr, thresholds = roc_curve(y_test, y_prob_test)
auc = roc_auc_score(y_test, y_prob_test)
print("\n--- cells 30-32: ROC ---")
print("roc points:", len(fpr), " AUC:", auc)

optimal_idx = int(np.argmax(tpr - fpr))
optimal_threshold = thresholds[optimal_idx]
print("\n--- cell 35: Youden ---")
print(f"optimal idx {optimal_idx}  threshold {optimal_threshold:.6f}  "
      f"tpr {tpr[optimal_idx]:.4f}  fpr {fpr[optimal_idx]:.4f}  "
      f"J {tpr[optimal_idx]-fpr[optimal_idx]:.4f}")

print("\n--- cell 39: default vs optimal threshold, test ---")
print("default 0.5:\n", classification_report(y_test, y_pred_test))
y_pred_opt = (y_prob_test >= optimal_threshold).astype(int)
print("optimal:\n", classification_report(y_test, y_pred_opt))
print("cm default:\n", confusion_matrix(y_test, y_pred_test))
print("cm optimal:\n", confusion_matrix(y_test, y_pred_opt))
print("acc default", round(accuracy_score(y_test, y_pred_test), 4),
      " acc optimal", round(accuracy_score(y_test, y_pred_opt), 4))

# also train-set probabilities, in case the widget shows train vs test
y_prob_train = model.predict_proba(X_train)[:, 1]
print("\nAUC train:", roc_auc_score(y_train, y_prob_train))

out = {
    "auc_test": auc,
    "optimal_threshold": float(optimal_threshold),
    "fpr": fpr.tolist(), "tpr": tpr.tolist(),
    "thresholds": [float(t) if np.isfinite(t) else None for t in thresholds],
    "y_test": y_test.tolist(),
    "y_prob_test": [round(float(p), 6) for p in y_prob_test],
}
with open("roc-ref.json", "w") as f:
    json.dump(out, f)
print("\nwrote roc-ref.json:", len(y_prob_test), "test patients")
