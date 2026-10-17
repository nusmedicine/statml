"""Slot 105: a synthetic expression + mutation dataset in which 10-2b's fusion strategies differ.

His 2026-10-16 pick ("revise the dataset"): on the lesson's current CSVs every
fusion model reduces to "use expression" and the gate is 1.000 for every
patient (_lab/fusion-measure.py). This generator keeps the shapes (2,000
patients, 1,000 genes, 50 binary mutations, a binary label) and builds in:

  1. both modalities informative: INFO genes with weights, DRIVER mutations
     with effects, each predictive alone;
  2. an interaction only early fusion can represent: gene FLIP_GENE raises
     the risk in patients carrying mutation FLIP_MUT and lowers it in the
     rest (a sign flip; late fusion adds two separate logits, and a gate
     weight in [0, 1] cannot flip a sign);
  3. a per-patient reason to gate: DEGRADED_SHARE of patients have degraded
     expression (true profile plus heavy noise), so for them the mutations
     are the reliable modality.

  python -I widgets/_lab/fusion-generator.py <out_dir> [key=value ...]
writes synthetic_expression.csv, synthetic_mutations.csv,
synthetic_labels.csv (the lesson's file names and columns) and
synthetic_truth.json (the parameters and each patient's degraded flag, for
the widget; not for the students' files).
"""
import json, os, sys
import numpy as np

P = dict(seed=2026, n=2000, genes=1000, muts=50, mut_rate_lo=0.05, mut_rate_hi=0.15,
         info=12, w_info=0.55, drivers=6, b_driver=1.1, driver_rate=0.0, flip_mut=26, flip_rate=0.35, flip_gene=7, w_flip=1.6,
         degraded_share=0.25, degraded_noise=2.5, scale=1.0, degraded_mode="noise", degraded_keep=0.2, degraded_shift=-1.5,
         context=0, ctx_b=1.5, ctx_w=0.9)
for kv in sys.argv[2:]:
    k, v = kv.split("="); P[k] = type(P[k])(v)
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
rng = np.random.default_rng(P["seed"])
N, G, Mn = P["n"], P["genes"], P["muts"]

true = rng.normal(size=(N, G))
rates = rng.uniform(P["mut_rate_lo"], P["mut_rate_hi"], size=Mn); rates[P["flip_mut"]] = P["flip_rate"]
mut = (rng.uniform(size=(N, Mn)) < rates).astype(int)

info = rng.choice([g for g in range(G) if g != P["flip_gene"]], P["info"], replace=False)
w = rng.choice([-1, 1], P["info"]) * P["w_info"]
drivers = rng.choice([m for m in range(Mn) if m != P["flip_mut"]], P["drivers"], replace=False)
if P["driver_rate"] > 0:   # drivers carried more often than the background mutations (redrawn at that rate)
    rates[drivers] = P["driver_rate"]
    mut[:, drivers] = (rng.uniform(size=(N, len(drivers))) < P["driver_rate"]).astype(int)
b = rng.choice([-1, 1], P["drivers"]) * P["b_driver"]
risk = true[:, info] @ w + (mut[:, drivers] - rates[drivers]) @ b
if P["context"]:   # context-dependent reliability: carriers of mutation FLIP_MUT follow the drivers only, the rest the expression only
    c = mut[:, P["flip_mut"]] == 1
    risk = np.where(c, P["ctx_b"] * (mut[:, drivers] - rates[drivers]) @ np.sign(b), P["ctx_w"] * true[:, info] @ np.sign(w))
risk += P["w_flip"] * true[:, P["flip_gene"]] * (2 * mut[:, P["flip_mut"]] - 1)
risk = P["scale"] * (risk - np.median(risk))
y = (rng.uniform(size=N) < 1 / (1 + np.exp(-risk))).astype(int)

degraded = rng.uniform(size=N) < P["degraded_share"]
if P["degraded_mode"] == "noise":   # the true profile plus heavy noise (louder rows)
    expr = true + degraded[:, None] * rng.normal(scale=P["degraded_noise"], size=(N, G))
elif P["degraded_mode"] == "contaminated":   # confidently wrong: the risk genes pushed toward "high risk" whatever the outcome,
    expr = true.copy()                        # and a block of 10 quality-marker genes raised so the gate can see it
    markers = [g for g in range(G) if g not in set(info) | {P["flip_gene"]}][:10]
    expr[np.ix_(degraded, info)] += P["degraded_shift"] * np.sign(w)
    expr[np.ix_(degraded, markers)] += 2.0
elif P["degraded_mode"] == "background":   # the assay failed: every gene reads near background (degraded_shift, plus noise degraded_noise)
    expr = np.where(degraded[:, None], P["degraded_shift"] + P["degraded_noise"] * rng.normal(size=(N, G)), true)
elif P["degraded_mode"] == "missing":   # the assay failed: the whole expression row is blank (nan in the CSV)
    expr = np.where(degraded[:, None], np.nan, true)
else:                                # "quality": little of the true profile left, ordinary scale, every gene shifted down
    q = P["degraded_keep"]
    bad = q * true + np.sqrt(1 - q * q) * rng.normal(size=(N, G)) + P["degraded_shift"]
    expr = np.where(degraded[:, None], bad, true)

hdr = lambda k, pre: ",".join(f"{pre}{i + 1}" for i in range(k))
np.savetxt(os.path.join(out, "synthetic_expression.csv"), expr, delimiter=",", fmt="%.4f", header=hdr(G, "Gene"), comments="")
np.savetxt(os.path.join(out, "synthetic_mutations.csv"), mut, delimiter=",", fmt="%d", header=hdr(Mn, "Gene"), comments="")
np.savetxt(os.path.join(out, "synthetic_labels.csv"), y, fmt="%d", header="Label", comments="")
json.dump({"params": P, "info_genes": [int(g) + 1 for g in info], "info_w": w.tolist(), "driver_muts": [int(m) + 1 for m in drivers],
           "driver_b": b.tolist(), "flip_gene": P["flip_gene"] + 1, "flip_mut": P["flip_mut"] + 1, "degraded": degraded.astype(int).tolist()},
          open(os.path.join(out, "synthetic_truth.json"), "w"))
print("wrote", out, "| positive share", round(y.mean(), 3), "| degraded", int(degraded.sum()), "| flip mutation rate", round(mut[:, P["flip_mut"]].mean(), 3))
