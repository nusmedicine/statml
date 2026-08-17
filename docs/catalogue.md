# Widget catalogue

The plan: which concepts earn a widget, for which course, and on what evidence.
Companion to [design-principles.md](design-principles.md).

## Where this lives, and why not in the manifest

Two files, deliberately:

| file | role | read by |
|---|---|---|
| `docs/catalogue.md` | **the plan** — every candidate concept, its target misconception, evidence, tier, status | humans, arguing |
| `widgets/manifest.json` | **the registry** — what is built and deployable | the gallery page, `scripts/build.mjs` |

They are not merged because they have opposite shapes. The plan is ~35 entries,
90% unbuilt, carrying prose and citations. The registry is small and fetched by
every student's browser on every gallery load — shipping the entire unbuilt plan
to it would be absurd.

**Planned evolution.** Once more than a handful of widgets have shipped, promote
the machine-readable half of this file to `catalogue/index.js` (an ES module,
importable by both node and the gallery — no new dependency) and *generate*
`widgets/manifest.json` and the Python `HEIGHTS` dict from it. That closes the
hand-mirrored-heights cost recorded in the principles doc. Not yet: with one
widget shipped, a markdown parser would be tooling in search of a problem.

Until then the drift risk is one line in review: **a widget marked shipped here
must exist in the manifest, and vice versa.**

---

## The rule for earning a slot

Design principles are earned from an incident. **A widget is earned from a
misconception.** Every entry below names the specific wrong belief it exists to
dislodge. If an entry cannot name one, it is decoration and does not get built —
however pretty the animation would be.

Evidence is graded honestly, because "difficult to understand" should be
documented rather than assumed:

| grade | meaning |
|---|---|
| **documented** | a named study or review reports this specific misconception, often with rates |
| **reported** | instructors or practitioners widely report it; no single study pinned here |
| **inferred** | my judgement from the course context. No citation. Treat as a hypothesis to test on your students |

Roughly a third of the catalogue is `inferred`. Those are the entries to
interrogate first — they are where I am guessing about your students.

---

## Tier 1 — build these first (12 widgets)

Selected on two axes at once: the misconception is **documented**, and the
concept is **central to precision medicine** rather than merely central to
statistics. Ordered within each course by what should come first.

### PHM5003 · Applied Statistics for Precision Medicine

| # | slug | concept | misconception targeted | evidence |
|---|---|---|---|---|
| 1 | `clt` ✅ | Sampling distribution of the mean | That the sampling distribution should *look like the population*, and increasingly so as n grows — i.e. no distinction between a distribution of data and a distribution of a statistic | **documented** |
| 2 | `ppv-prevalence` | Predictive value vs prevalence | That a positive test on a 95%-sensitive assay means ~95% chance of disease. Physicians report sensitivity, or sensitivity minus specificity, *as* PPV; most estimate P(disease \| positive) at 70–80% when the true value is far lower | **documented** |
| 3 | `p-value` | What a p-value is | That p is P(H₀ true), or that 1 − p is the probability the alternative is true. Persists among researchers and professionals working in statistics and epidemiology, not just students | **documented** |
| 4 | `confidence-interval` | Interval coverage | That there is a 95% chance the true value lies in *this* interval. A realised interval either contains the value or does not; 95% describes the procedure across many studies | **documented** |
| 5 | `multiple-testing` | Familywise error and FDR | That 50 significant hits at p < 0.05 from 20,000 tests is a finding. The single most consequential statistical error in omics work | **documented** |
| 6 | `regression-to-mean` | Regression to the mean | That improvement in an extreme-baseline subgroup is a treatment effect. Directly attacks the "responder" reasoning precision medicine invites | **reported** |
| 7 | `interaction-effect` | Effect modification | That a difference in subgroup effect sizes *is* an interaction, and that a significant effect in one subgroup plus a non-significant one in another demonstrates differential response. This is the conceptual core of "precision" | **reported** |
| 8 | `censoring-km` | Censoring and Kaplan–Meier | That censored patients can be treated as event-free, or dropped. KM reliability degrades sharply with censoring — bias grows and CI coverage falls between 10% and 30% censoring | **documented** |

### PHM5005 · AI/ML for Precision Medicine

| # | slug | concept | misconception targeted | evidence |
|---|---|---|---|---|
| 9 | `data-leakage` | Train/test leakage | That any random split is a valid split. 40.5% of students preferred a model trained on shuffled data *because its test R² was higher*, not recognising the leakage. Rarely taught in introductory courses at all | **documented** |
| 10 | `overfitting-capacity` | Overfitting and capacity | That overfitting can be diagnosed from the training curve alone, or that low/zero training loss *is* overfitting. Students respond by tuning learning rates instead of recognising the dataset is too small | **documented** |
| 11 | `cv-nested` | Cross-validation and selection bias | That a CV score is still honest after using those same folds to choose hyperparameters. Fewer than 10% recognise that un-nested CV inflates the estimate | **documented** |
| 12 | `imbalance-metrics` | Metrics under class imbalance | That 99% accuracy on a 1% prevalence outcome is a good model; that ROC-AUC is the right summary when positives are rare. The machine version of the same base-rate error as #2 | **documented** |

**Note the symmetry between #2 and #12.** Base-rate neglect appears once as a
clinical reasoning error and once as a model evaluation error. Building them as a
matched pair — same natural-frequency grid, one labelled *patients*, one labelled
*predictions* — would make a point neither makes alone, and both courses would
carry it. Recent work explicitly ties class imbalance in AI to human base-rate
neglect.

---

## Tier 2 — the next dozen

Real concepts, weaker evidence or narrower reach. Build after Tier 1 has been
taught once and you know which ones the students actually needed.

### PHM5003

| slug | concept | misconception targeted | evidence |
|---|---|---|---|
| `power-sample-size` | Power | That a non-significant result means no effect; that power is a property of a study rather than of a study *and* an effect size | **documented** |
| `sd-vs-se` | SD vs SE | That they are interchangeable summaries of spread. Error bars in papers are routinely unlabelled and read as whichever is convenient | **reported** |
| `confounding-simpson` | Confounding and stratification | That the aggregate association is the causal one; that adjustment always moves an estimate toward the truth | **reported** |
| `forking-paths` | Analytic multiplicity | That multiplicity only arises from formal multiple tests, not from choices made while analysing one dataset | **reported** |
| `hazard-ratio` | Hazard ratios | That an HR is a risk ratio, and that it is constant over follow-up | **inferred** |
| `bayes-updating` | Prior to posterior | That a posterior is a compromise rather than a reweighting; that the prior's influence does not shrink with data | **reported** |

### PHM5005

| slug | concept | misconception targeted | evidence |
|---|---|---|---|
| `calibration` | Calibration vs discrimination | That good AUC means the predicted probabilities are usable. A model can rank perfectly and be numerically useless at the bedside | **reported** |
| `bias-variance` | Bias–variance decomposition | That bias and variance are one knob labelled "complexity", so error must be monotone in it | **reported** |
| `dimreduce-artifacts` | PCA vs t-SNE/UMAP | That distances, cluster sizes and gaps in a UMAP embedding carry quantitative meaning. Acute for single-cell work | **reported** |
| `regularization-path` | L1/L2 shrinkage | That regularisation is feature deletion, and that L1 picks *the* right features when predictors are correlated | **inferred** |
| `learning-curve` | Sample size and error | That a plateau means the model is done rather than the data is exhausted — the correct diagnosis students miss in #10 | **documented** |
| `feature-importance` | Importance vs cause | That a high-importance feature is a driver; that correlated features share importance in an interpretable way | **reported** |

---

## Tier 3 — candidates, not commitments

`gradient-descent` (loss surface, learning rate) · `kmeans-clusters` (finding
clusters in noise) · `bootstrap` (resampling as a substitute for a formula) ·
`missing-data` (MCAR/MAR/MNAR and what imputation can and cannot recover) ·
`batch-effects` (technical variation masquerading as biology) ·
`ensemble-variance` (why bagging and boosting differ) · `attention` (if
transformers are in scope) · `survival-immortal-time` (immortal time bias in EHR
cohorts) · `decision-curve` (net benefit and threshold choice).

Several of these are excellent and several will never be built. That is what
Tier 3 is for — a place to record a good idea without committing to it.

---

## Overlap between the courses

Four widgets serve both, and this is a feature of the architecture rather than a
duplication problem: **one implementation, two entry points**, differing only by
URL parameters and the chapter that embeds them.

| widget | in PHM5003 | in PHM5005 |
|---|---|---|
| `ppv-prevalence` | diagnostic test interpretation | the base-rate half of `imbalance-metrics` |
| `roc-threshold` | test performance, cut-point choice | model evaluation |
| `multiple-testing` | omics inference | feature selection in high dimensions |
| `regression-to-mean` | responder analysis | why validation cohorts underperform discovery |

`roc-threshold` has no home tier above because it belongs to both — treat it as
Tier 1 for whichever course you teach first.

---

## What this catalogue does not settle

1. **Sequencing against your actual syllabus.** Tiers are by evidence and
   centrality, not by teaching week. Mapping to weeks needs your course outlines
   and will probably reorder Tier 1.
2. **The `inferred` entries.** Roughly a third. They are hypotheses about your
   students, and you have data I do not — which questions they get wrong in
   exams, which they ask twice.
3. **Whether 12 is the right Tier 1.** At 3–8 hours each that is 40–100 hours.
   If that is one semester's budget, Tier 1 is the semester. If it is more,
   cut to the six with the strongest evidence: `clt`, `ppv-prevalence`,
   `p-value`, `multiple-testing`, `data-leakage`, `imbalance-metrics`.
4. **Whether any Tier 1 concept resists a widget.** Some concepts are hard
   because they are *abstract*, which widgets help with; others because they are
   *technical*, which widgets do not. `interaction-effect` may be the second kind.
   Worth a mock-up before committing — per principle 5.1.

---

## Sources

- [What Do Your Students Struggle with? A Survey of Statistics Instructors](https://www.tandfonline.com/doi/full/10.1080/26939169.2025.2455560) — conceptual errors dominate computational ones; randomness, p-values, sampling distributions and variation lead the difficulty list
- [Sotos et al., Students' misconceptions of statistical inference](http://mintlinz.pbworks.com/w/file/fetch/96929061/Sotos-2007-Misconceptions.pdf) — review of documented inference misconceptions
- [Greenland et al. 2016, Statistical tests, P values, confidence intervals, and power: a guide to misinterpretations](https://link.springer.com/article/10.1007/s10654-016-0149-3) — the canonical enumeration of 25 distinct misinterpretations
- [Misinterpretations of P-values and statistical tests persist among researchers and professionals](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9383044/)
- [Understanding sampling distribution (Kadijevich)](https://www.stat.auckland.ac.nz/~iase/publications/rt08/T4P9_Kadijevich.pdf) — the "sampling distribution looks like the population" misconception
- [Positive Predictive Value: A Clinician's Guide to Avoid Misinterpreting the Results of Screening Tests](https://www.psychiatrist.com/jcp/positive-predictive-value-clinician-guide-avoid-misinterpreting-results-screening-tests/)
- [Natural frequency trees improve diagnostic efficiency in Bayesian reasoning](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8338842/) — frequency formats resolve PPV problems without base-rate machinery
- [Machine Learning Students Overfit to Overfitting](https://arxiv.org/pdf/2209.03032) — training-curve-only diagnosis, zero-loss confusion, learning-rate flailing
- [Learning from Irreproducibility: Data Leakage Case Studies for ML Education](https://dl.acm.org/doi/10.1145/3736731.3746153) — the 40.5% shuffled-split finding
- [Censoring and its impact on Kaplan–Meier survival estimates](https://jptcp.com/index.php/jptcp/article/view/11439) — bias and coverage loss between 10% and 30% censoring
- [Biased Minds Meet Biased AI: How Class Imbalance Shapes Appropriate Reliance and Interacts with Human Base Rate Neglect](https://arxiv.org/pdf/2511.14591)
