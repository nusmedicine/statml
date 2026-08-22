# Handover

## Where things are

**Thirteen widgets: twelve shipped, one draft.** `/lab/` has one entry,
`generalization`. `main` and `origin/main` are level at `bb96c44`, and every push
to `main` publishes immediately — which is what makes `npm run check` before
committing load-bearing rather than tidy.

**105 fingerprint states**, all MATCH. Widget 13 carries none yet; `check` allows
that because it is a draft, and that is deliberate (see below).

```
npm run dev      # :8000 — USE THIS, not python -m http.server
npm run check    # before every commit
```

---

## Reading the PHM5005 notebooks — the old blocker is gone

The previous handover said widget 13 could not be planned because Kenneth's Colab
links serve a sign-in page to an agent. **That was never the blocker it looked
like.** Two routes, both verified:

- **Shared Drive folder**, readable without auth:
  <https://drive.google.com/drive/folders/1QcSRjgcasZRpFyw1lOHSowjjDgcXp0_c>
  `curl -sL` it and parse the HTML — each entry is `data-id="<fileId>"` followed
  by the nearest `aria-label="<filename> Unknown Shared"`. That yields all 34
  notebooks plus a *Change Log* Google Doc (read it first,
  `.../export?format=txt`). Then pull any file:
  `curl -sL "https://drive.google.com/uc?export=download&id=<fileId>"`
- **Local copies, WITH cell outputs**, in
  `~/Downloads/PHM5005 AY2025-26 - Notebooks/For Review/`. Source is
  byte-identical to Drive; Drive's are stripped of outputs and these are not.
  **Prefer local** — the printed numbers are the valuable half.

**Match by filename, never by link.** The same notebook has appeared under three
Drive IDs across two sessions. Confirm with an MD5 against the local copy.

There is still no `../jupyterbook/phm5005`, so PHM5005 lesson slots are named by
notebook filename.

---

## Widget 13 — `generalization`, "Fitting and Generalizing" — SHIPPED AS A DRAFT

Two tabs over one train/test split, mirroring the workflow diagram in `04-1` and
`04-4`. The fit tab splits by ratio and shows training error falling while test
error turns around; the cross-validation tab makes the training set the CV set
and finds the same turning point without touching the test set.

### What remains before it ships

1. **Fingerprint states.** Two or three settled plus **at least one driven state
   per tab** — the tabs drive different nouns (`Add a parameter` vs `Next fold`),
   so one driven state does not cover both. Prove each identical across three
   runs before recording.
2. Flip `status` to `shipped` in `manifest.json` **and** in `main.js` — `check`
   asserts they agree.
3. Mark it shipped in `docs/catalogue.md`, which still lists the PHM5005 arc as
   entirely unbuilt.
4. **Judge it projected.** Never done for widgets 11, 12 or 13.

### The one open design question Kenneth flagged and did not settle

At the default 80/20 the test curve turns up on **80% of seeds**; at 60/40 it is
97%. Defaulting to the split students are taught costs a fifth of readers the
effect on their opening seed. Left as-is deliberately.

### Also unresolved, and deliberately

**CV diverges wildly from the test curve past the interpolation threshold** —
20–500x. This was researched and is consistent with the literature; a caption was
considered and declined. If it ever needs one, the material is: Bates, Hastie &
Tibshirani (arXiv 2104.00673) — CV "estimates the average prediction error of
models fit on other unseen training sets", not the model you fitted; and the
PRESS identity, `e_(i) = e_i / (1 - h_ii)` with `sum h_ii = p`, which makes the
divergence algebraic rather than incidental. Verified on the widget's own data:
mean leverage equals `p/n` to machine precision and `max h_ii` hits 1.0000 from
17 parameters on.

---

## What widget 13 cost, so the dead ends are not re-walked

**Three designs were built and two were stashed.** Both stashes are still in the
repo — `git stash list`:

| stash | approach | why it was dropped |
|---|---|---|
| `stash@{1}` | k-NN, merged validation + CV in one figure | **k's direction is backwards** — small k is MORE flexible, the exact defect principle 3.4f records. Also merged too much into one picture |
| `stash@{0}` | decision tree depth, 2-D classification | *"too complicated — students will get distracted with decision trees instead of seeing the big general picture"* |

**Measurements worth not repeating.** All were made to settle a design question:

- **Polynomial degree explodes without care.** Validation R² of -20,142 at
  n_train=15, degree 9. Solved by a log axis with a ceiling fitted in whole
  decades, plus sizing the ladder against n.
- **`p > 0.6 x n_train` is roughly where overfitting becomes reliable.** This
  single fact drove every sizing decision in the widget.
- **1-D logistic regression does not overfit at all** — accuracy 0.891 flat from
  2 to 10 parameters. Ridge plus sigmoid saturation. A dead end; do not retry it
  as an overfitting vehicle.
- **FEV1-against-age is very nearly a quadratic**, so the best polynomial is
  trivially three parameters and the exercise answers itself. Rejected in favour
  of a one-compartment concentration curve, where no polynomial is ever right.
- **Forsythe orthogonal polynomials** beat normal equations outright and give
  every parameter count in one pass. Checked against numpy's `Polynomial.fit`:
  worst disagreement 3e-11.
- **Training MSE is never exactly zero** while the parameter count stays below
  the training size — asserted over ~2,000 states, which is what makes the log
  axis safe.

**A new core token landed with it**: `--c-holdout` (red) in `tokens.css`, for
data set aside and scored once at the end. Neither `--c-extreme` nor `--c-event`
says that. Additive only — the full fingerprint suite reported 105/105 MATCH.

---

## A fully designed, fully de-risked widget that was NOT built

Before the arc moved to `04-1`/`04-4`, **`04-2 Model Evaluation` was designed in
detail and then set aside.** The design work is sound and should not be redone
from scratch. Its spine:

> A model outputs probabilities. A threshold turns them into labels. Every
> threshold-dependent metric is a property of that threshold, not of the model.

The evidence, straight out of `04-2`'s own printed output (cell 39), which prints
two classification reports side by side and which nobody reads across:

| | threshold 0.50 | Youden 0.31 |
|---|---|---|
| accuracy | **0.70** | **0.70** |
| recall | 0.53 (10 of 19) | 0.84 (16 of 19) |
| deaths missed | **9** | **3** |

Same 42 of 60 correct. Six more deaths caught, six more false alarms — and
accuracy does not move at all.

The figure: a probability axis with each patient a dot, died on one row and
survived on the other, and a vertical threshold line. **The four quadrants ARE
the confusion matrix**, actual on rows and predicted on columns, sklearn's own
layout. Sweeping the threshold traces the ROC curve one patient at a time — a
death steps it up, a survivor steps it right.

De-risked with a calibrated binormal model (negatives ~ N(0,1), positives ~
N(d,1), posterior `sigma(logit(pi) - d^2/2 + d*z)`, so AUC is an OUTPUT). At 5%
prevalence it reproduces the documented imbalance misconception exactly:
**AUC 0.95, accuracy 95%, recall 0%, precision undefined.**

---

## NEXT: plan a widget for classical algorithms, from `04-3`

`04-3 — ML - Supervised Learning - Tour of Algorithms`, 46 cells. Six families,
each with model, objective, strengths/caveats and one worked example: linear and
regularised regression (Ridge/Lasso/ElasticNet), logistic regression, SVM with
kernels, decision trees, ensembles (bagging against boosting), naive Bayes, and a
shallow MLP.

**Nothing is decided. Read the notebook first** — `04-3` locally, with outputs.

### The raw material, already extracted

Every classifier in `04-3` is scored on the same 60 test patients, 19 of them
deaths. Collected across `04-2`, `04-3`, `04-4` and `04-5`:

| model | accuracy | class-1 recall | class-1 F1 |
|---|---|---|---|
| GaussianNB | 0.70 | 0.26 | 0.36 |
| HistGradientBoosting | 0.65 | 0.42 | 0.43 |
| RandomForest | 0.72 | 0.42 | 0.48 |
| GridSearch-tuned LR | 0.68 | 0.53 | 0.51 |
| TPOT2 AutoML | 0.68 | 0.53 | 0.51 |
| LogisticRegression | 0.70 | 0.53 | 0.53 |
| MLP | 0.72 | 0.53 | 0.54 |
| DecisionTree | 0.70 | 0.58 | 0.55 |
| SVC (rbf) | 0.72 | 0.63 | 0.59 |
| **LR, threshold moved to 0.31** | 0.70 | **0.84** | **0.64** |

Nine algorithms, plus grid search, plus AutoML, span recall 0.26–0.63. **Moving
the threshold on the plainest model beat all of them**, and tuning and AutoML
both landed slightly *below* the untuned baseline.

Regression side, body fat: LinearRegression R² 0.992, Ridge 0.991, Lasso 0.979,
ElasticNet 0.845, SVR 0.767.

### Candidate misconceptions — the widget has to earn its slot from one

1. **That choosing the right algorithm is where the gains are.** The table above
   is the evidence, and it is the notebook's own output. Strongest on evidence,
   and it is a *negative* result, which is harder to build a figure around.
2. **That an algorithm is a black box rather than an assumed SHAPE.** A linear
   boundary, axis-aligned rectangles, distance-based blobs, a kernel's curve —
   the shape is the assumption, and it is what makes a model fit or fail. The
   known-good form here is sklearn's classifier-comparison figure: one row per
   dataset, one column per algorithm. Most visual, least novel.
3. **That a more complex algorithm is a better one.** Overlaps heavily with
   widget 13, which is now built — check before duplicating it.

### Open questions for the planning conversation

- Is this **one** widget or the head of several? Six families is a lot for one
  figure, and `regularization-path` and `feature-importance` are already separate
  catalogue entries.
- Does it want the 2-D decision-boundary picture (recognisable, and the tree
  version of that was already rejected as too complicated), or something else?
- Widget 13 already spent the decision-tree idea and Kenneth found it a
  distraction. Bear that on any design that leans on trees.

---

## Deferred, ready to pick up individually

**Button labels.** A five-widget sweep was reverted (`a23be6b`) as too much to
review at once, and the replacement labels were wordier than what they replaced.
The observations still hold; each is a one-file change, to be taken **one at a
time**:

- `maximum-likelihood`'s step button reads "Step" — core's generic fallback, and
  the only step button in thirteen widgets that names no act. Its own title says
  "Try the next candidate, **or** take the next move of the climb", so the action
  differs by tab; `stepLabel` accepts a `{param, labels, default}` form for
  exactly that, and `bayesian` and `probability-mechanisms` already use it.
- `bootstrap` and `permutation-test` grey out Step and Play until their lead has
  run, and neither says why. The other three lead-gated widgets have a
  `leadHint`.
- `bayesian`'s `leadHint` says "Step and Play" while the button reads "Add a
  count" or "Propose a move".
- `em-mixture`'s lead reads "Start", the only lead label naming no act.

**Judge projected.** Widgets 11, 12 and 13 have not been seen from the back of a
room. Widget 11's hypergeometric dots are ~4px at the narrow layout and its
R-code cards put 11px mono on a half-width card.

**`04 / 04-08` needs two corrections in `../jupyterbook/phm5003`.** Kenneth is
doing these by hand. **Both verified still present** in the notebook as of this
handover, so neither has been made yet.

- **Cell 40** states the odds-ratio interpretation wrongly. On `a=24, b=60,
  c=16, d=100` it says *"the odds of death in infected patients is 2.5:1 = 5:2
  … for every 5 patients who died with infection, there were 2 who died
  without"*. The odds are 24/60 = **2:5**; 2.5 is the odds *ratio*, which is not
  an odds; and the death counts are 24 and 16, i.e. **3:2**.
- **Cell 47's Caution** says *"In retrospective studies, we often do not know the
  population at risk, as the exposure is usually not known"*. It should say
  **case-control** — a retrospective *cohort* is fine for a risk ratio — and in a
  case-control the exposure is precisely what you go and ascertain. What is
  unknown is the population at risk.

---

## How Kenneth works — read before writing anything he will see

- **One change at a time.** A commit touching five widgets is not reviewable and
  gets reverted whole, including the parts that were right. If a fix reveals the
  same fault elsewhere, **say where and stop**; offer the rest as a list.
- **Replacement wording must be shorter than what it replaced**, or it is not an
  improvement. Said twice.
- **On-screen copy names the quantity** — principle 2.9. No metaphors ("a fact
  about your budget" for a death rate), no personifying the method ("the cohort
  does not know"), no verdicts where a mechanism belongs ("nothing else", "by
  construction"). Source comments are exempt and should stay vivid.
- **Explanations are one claim per line, not paragraphs.** Four sentences
  wrapping across five lines reads as a wall of text. `textBlock` in
  `odds-and-risk/main.js` is the pattern; an empty string is a half-height gap.
- **Hand over the exact localhost URL after every edit.**

---

## Verifying changes

**Screenshots for judgement — is this legible, is this pleasing. Assertions for
facts. Never the reverse.** Screenshots here have produced several phantom bugs:
the automation browser generates stray pointer input that moves sliders
mid-capture, and it throttles `requestAnimationFrame` to ~1 frame per 300 ms, so
animations appear frozen and any wait under ~300 ms races the frame clock.

### The canvas text sweep — the cheapest check in the repo

Wrap `fillText`, measure each string, compare its right edge to the canvas width.
It catches what screenshots cannot: a `NaN` at one end of a slider, a caption
overrunning its line, a printed claim that is false.

```js
PR.fillText = function (s, x, y) {
  const w = this.measureText(String(s)).width;
  const left = this.textAlign === "center" ? x - w / 2
    : this.textAlign === "right" ? x - w : x;
  seen.push({ s: String(s), left, right: left + w, y });
  return orig.apply(this, arguments);
};
```

- **`y === 0` is the rotated y-axis label** — its coordinates are in the rotated
  frame and always look like an overflow. Skip it.
- **Force a repaint** (re-press the already-selected segmented button) rather
  than dispatching `resize`, which no longer repaints if the size has not
  changed. A sweep reporting every state blank is measuring nothing.
- **Install unconditionally.** A flag that says *installed* is worthless once a
  diagnostic has restored the original.
- **Dedupe before any collision check.** A repeated paint lands the same string
  at the same pixel, so a frame captured mid-ease reads as thousands of overlaps.

**One level down, for marks rather than text:** wrap `arc` and `fill` and tally
what colour was actually *asked for*. An invalid `fillStyle` is a silent no-op
that leaves the canvas default, and **`globalAlpha = 0` paints perfectly** — a
whole panel was invisible while every string reported correct text at correct
coordinates. That is also how widget 12's design tab was found painting 112 dots
at alpha 0.

### Driving an animation

The browser's own clock is unusable. Take it by hand, exactly as
`_lab/fingerprint.html` does:

```js
const q = []; window.requestAnimationFrame = (cb) => q.push(cb); let t = 1000;
const pump = (n) => { for (let i = 0; i < n; i++) { const cb = q.shift(); if (!cb) break; t += 64; cb(t); } };
```

`MAX_FRAME_MS` is 64, so pump at 64. An ease cannot be settled by a fixed wait,
nor by watching the *wording*, which flips at the halfway point while the numbers
keep moving — settle by **observing the exact target value**.

### THE BIG ONE: every baseline is at the NARROWEST canvas

`fingerprint.html` sets `FRAME_W = 900`. The side layout stacks at
`max-width: 880px`, so 900 is **20px above the breakpoint** — every state is
hashed with the rail still beside the figure, on a **550px canvas**.

This is where widget 11's six overflows were found, and none was visible at
1400px. No hash would ever have caught one: `note()` and friends stroke
surface-coloured before filling, so **a collision erases what it overruns rather
than blending**. It still looks like text and it hashes consistently for ever.

### The fingerprint harness

`widgets/_lab/fingerprint.html`. **It auto-runs on load; never click Run** — that
starts a second concurrent pass into the same table and can make "Copy new
baseline" copy a half-interleaved set.

**Run the full suite when you touch `widgets/core/`.** That is the only kind of
change that can reach a widget you are not looking at.

Three kinds of state, and the distinction is load-bearing:

| kind | how | sees |
|---|---|---|
| **settled** | a URL that fully determines the figure | the finished figure |
| **driven** | `drive: { click, frames, dt }` or `drive: { set: {…}, frames, dt }` | anything drawn mid-motion |
| **interrupted** | `drive: { before: [{ click, frames }], … }` | a state one action leaves another in |

- A suite of settled states alone is **no test of the animation at all**. That
  gap let a coordinate change put every falling ball six columns off-centre while
  all eight settled states matched. `check.mjs` fails any widget declaring an
  `animation` without a driven state.
- **`set` drives a control** rather than a drive button — `data-param` on every
  control, `data-value` on segmented buttons, `data-options` on a `choice` slider
  because its DOM value is an index. This exists because a widget may decline
  drive buttons (4.5) and ease on a toggle (4.4), which made its transitions
  undriveable. Found **by name, never by position** (5.7).
- `check.mjs` requires `shown=` on a settled state only from widgets that declare
  a `shown` parameter. One that declares none has no build-up to be partway
  through, so the URL alone settles it.
- `before` exists because **three separate shipped bugs were mid-animation
  states**, and the last needed two actions to reach.

### Order of work, and why baselining comes last

| job | when | cost |
|---|---|---|
| did I break the **other** widgets? | only if `widgets/core/` changed — run once, baseline nothing | one run |
| record a baseline for the **new** widget | only once the design is agreed | 3 determinism runs + a verify pass |

Build → cheap checks → **if core changed, one suite run to confirm the existing
states still MATCH** → *show Kenneth and iterate* → and only then add states,
prove determinism, baseline, commit.

> *Earned three times.* `bootstrap` was baselined three times over. Widget 11
> changed shape in six of eight review rounds. Widget 12 went thirteen rounds,
> and two of them changed the design after it looked finished.

`npm run check` fails a **non-draft** widget with no fingerprint states, which is
the escape hatch: leave it `draft` while the design moves. A placeholder
`"px": "0"` also satisfies `check` if states need writing early.

If a state legitimately changes, regenerate the baseline **in the same commit** as
the change, so the diff records that the rendering moved. Before recording a new
driven state, confirm it is identical across three runs — a flaky check is worse
than none.
