# Widget catalogue

Which concepts earn a widget, for which course, and on what evidence.
Companion to [design-principles.md](design-principles.md).

## Where this lives, and why not in the manifest

Two files, deliberately:

| file | role | read by |
|---|---|---|
| `docs/catalogue.md` | **the plan** — candidates, target misconception, evidence, status | humans, arguing |
| `widgets/manifest.json` | **the registry** — what is built and deployable | the gallery page, `scripts/build.mjs` |

Not merged, because they have opposite shapes. The plan is mostly unbuilt entries
carrying prose and citations; the registry is small and fetched by every
student's browser on every gallery load.

**Planned evolution — mostly overtaken.** The prize was generating
`widgets/manifest.json` and the Python `HEIGHTS` dict from one machine-readable
source, closing the hand-mirrored-heights cost in the principles doc. Deleting
both embedders ([prd.md](prd.md) §6) closed it by subtraction instead: the height
now lives in exactly one file. What remains is the drift risk between *this* file
and the manifest, which is one line in review: **a widget marked shipped here must
exist in the manifest, and vice versa.** If generation ever returns, the trigger is
an incident — not a widget count, which under a no-fixed-number plan never fires.

---

## The rule for earning a slot

Design principles are earned from an incident. **A widget is earned from a
misconception** — the specific wrong belief it exists to dislodge. If an entry
cannot name one it is decoration, however good the animation would be.

**Amended once, by the statistics arc below.** A widget also earns a slot by
supplying a **prerequisite** that a misconception-targeting widget depends on.
`galton-board` targets no documented error; its job is to make the CLT mean
something rather than be accepted as a rule. That is a legitimate second route in,
and naming it as a route keeps it from becoming a loophole — a prerequisite widget
must name the widget it is a prerequisite *for*.

Evidence is graded honestly, because "difficult to understand" should be
documented rather than assumed:

| grade | meaning |
|---|---|
| **documented** | a named study or review reports this specific misconception, often with rates |
| **reported** | instructors or practitioners widely report it; no single study pinned here |
| **inferred** | my judgement from the course context. A hypothesis to test on your students |

---

# PHM5003 · Applied Statistics for Precision Medicine

## The arc — agreed build order

Six widgets in sequence. This is **not a tier list; it is one continuous
argument**, and the order is load-bearing: each widget answers a question the
previous one raises, and each reuses the previous one's machinery.

> increments → means → **one sample** → an interval → a null by shuffling → many nulls

| # | slug | concept | what it answers | misconception / prerequisite | evidence |
|---|---|---|---|---|---|
| 1 | `galton-board` ✅ | Origin of the bell curve | *Why does anything go normal?* Accumulated independent increments — a random walk of ±1 nudges, plotted as total deviation from zero so the shape reads as an error distribution from the start | **Prerequisite for `clt`.** Without it the CLT is a rule to memorise. Also dislodges the assumption that bell-shaped is simply the default shape of data | inferred |
| 2 | `clt` ✅ | Sampling distribution of the mean | *What happens if I average?* Means go normal with spread σ/√n, whatever the population | That a sampling distribution should look like the population, increasingly so as n grows — no distinction between a distribution of data and a distribution of a statistic | **documented** |
| 3 | `bootstrap` ✅ | Resampling one sample | *But I only ever have one sample.* Resample it with replacement and the spread of the resampled statistic stands in for the sampling distribution | That knowing an estimate's uncertainty requires repeated samples from the population — which is exactly what widget 2 quietly assumed. Also that resampling "manufactures data" | reported |
| 4 | `confidence-interval` | Effect size and its uncertainty | *How big is the effect, and how sure am I?* An interval, read as a range of compatible effects | That there is a 95% chance the true value lies in *this* interval. A realised interval either contains it or does not; 95% describes the procedure across many studies | **documented** |
| 5 | `permutation-test` ✅ | p-value by shuffling | *Could chance alone have produced what I saw?* Shuffle the group labels, rebuild the difference, count | That p is P(H₀ true), or that 1 − p is the probability the alternative holds. Persists among researchers and professionals in statistics and epidemiology, not only students | **documented** |
| 6 | `multiple-testing` | Correction | *What if I do that twenty thousand times?* | That 50 hits at p < 0.05 out of 20,000 tests is a finding. The most consequential statistical error in omics work | **documented** |

### Why this sequence is better than my tiering

My Tier 1 was six good widgets that happened to sit near each other. This is
**one object studied six times** — the sampling distribution — with each step
motivated by a genuine limitation of the step before.

The pivotal one is **#3**. As built, `clt` is a fiction: it draws 400 samples from
a population whose μ and σ are printed on screen. No one has ever been in that
position. Widget 3 is where the fiction is repaid, and putting it third makes the
CLT's setup a *problem to be solved* rather than a lie we quietly move past. I did
not have a bootstrap widget in Tier 1 at all, and its absence was the real hole in
my catalogue.

**#5 by permutation rather than by formula** also matches the evidence: the
simulation-based-inference literature exists precisely because the shuffling
account of a p-value survives contact with students in a way the sampling-
distribution-of-t account does not. And by #5 the student already owns the
resampling motor from #3, so the only new idea is *what gets shuffled*.

### Design notes to settle before building

**~~#3 should bootstrap both a mean and a difference.~~ Built, then cut.** The plan
was to make the widgets-2–3 mean → widgets-4–6 difference transition happen
*inside* widget 3 on a `stat` control, rather than silently between widgets. It
was built and it worked. It came out anyway: two groups meant two rows, two
collapses and a gap to read as the statistic, and **the mechanism widget 3 exists
to teach — sampling with replacement — got harder to narrate, not easier.** The
plan optimised for continuity of the *statistic* across the arc and paid for it in
clarity of the *idea* in this widget, which is the wrong trade. A widget teaches
one thing.

Widget 4 opens on a difference and carries the transition alone. The cost is real
and should be watched for: a student meets a new statistic and a new concept in
the same widget, which is exactly what this plan was trying to avoid.

**#3's killer view: bootstrap distribution against the truth — done.** The observed
sample is drawn from a seeded population, so the widget shows the true sampling
distribution *and* the bootstrap distribution on the same axis. The bootstrap
distribution — which you can actually compute — comes out nearly the same width as
the one you can never see. That single overlay is the entire justification for the
method, and it is only available to us because populations are seeded.

**#3 is two staged actions, not one — added after building it.** The observed
sample used to simply be there when the widget loaded, which meant the one draw
from the population — the draw a real analyst gets exactly once — was never shown
happening. Now *Sample the population* is its own button with its own animation,
it can be pressed once, and it greys out afterwards; *Resample your sample* is
unlimited. **The asymmetry between the two buttons is the distinction the widget
exists to teach**, and a student who has felt it in the affordances does not
confuse repeated sampling from a population with resampling one sample.

**What building #3 added to that plan**, and #4 inherits:

The two curves agree in *width* and disagree in *position*, because the bootstrap
is centred on your estimate and not on the truth. So the plotting window is
centred on the true value rather than on the estimate — centring it on the
estimate would put the pile in the middle every time and hide the one thing the
bootstrap cannot do.

**And the readout has to show `s` beside `σ`.** The bootstrap does not sample from
the population, it samples from *your sample* — the plug-in principle, F̂ₙ for F —
so for a mean its SE is essentially `s/√n`, and `bootstrap SE / true SE` is
exactly `s/σ`. Without that pair on screen the widget can only *assert* that
resampling sometimes works; with it, a student can see why. Measured across the
defaults: n=12 gives s=0.98 and SEs of 0.283 vs 0.289; seed 6 gives s=2.05 and
0.568 vs 0.289. Same mechanism, both times.

The honest framing for the lecture, which the arc should not overclaim: the
bootstrap is **asymptotically right and small-sample honest-but-noisy**. It is an
estimate of the sampling distribution and has its own sampling error. Worth
saying out loud that for a *mean* it barely earns its keep — `s/√n` is the
textbook formula — and that its real value is statistics with no closed form
(median, ratio, correlation) and skewed sampling distributions where a symmetric
interval is wrong. Here it earns its slot as the idea that feeds #4–#6.

**#4 needs two views, not one.** One study → one interval (from #3's bootstrap
distribution). Many studies → coverage, which is the *documented* misconception
target. Both, with the second reachable from the first.

**#6 is #5 run twenty thousand times.** If #5 is built so its null distribution
and test statistic are reusable, #6 is largely a loop over it plus Bonferroni/BH.

### What #5 settled, built out of order (before #4)

**Pool and re-deal, not swap or recolour.** Three candidates were mocked up in
`widgets/_lab/shuffle-visuals.html`. Recolouring dots in place was ruled out for
reading as *dancing colours* — decoration, where a physical reassignment is the
mechanism. The winner pools every observation into one band and deals it back,
which is what the Rossman/Chance applet and the by-hand card activity do, so it
is an established convention rather than a private notation. The pooling step is
H₀ stated physically: there is only one group and the split is a fiction. Dots
move **vertically only**, so nothing ever leaves its value, and the boxes carry
their `n` because a permutation holds the group *sizes* fixed.

**A survey worth recording, because it says the gap is real.** The
Rossman/Chance applet is the best mechanism animation in the field and is now a
dead Java plugin. StatKey — modern, widely used — was checked directly: pressing
*Generate* simply adds dots to a dotplot and **no shuffle is shown at all**. The
tools either give the result and hide the mechanism, or showed the mechanism and
have bit-rotted.

**A dot that lands in a tail stays lit**, so p is *count the lit ones* rather
than an abstract tail area. The lit count is exactly p's numerator: the tail is
counted per bin as values arrive, never derived from bin centres at paint time,
because quantising the boundary bin would let a student count a different number
than the readout reports. Mocked up first in `widgets/_lab/null-and-p.html`,
which also established that the shaded tail band is close to furniture — the
tails run from the observed line to the panel edge, roughly half the panel.

**The true effect is a control and it goes to zero.** Verified in node across 200
seeds at `effect=0`, `n=12`: **exactly 5.0%** of studies give p < 0.05 while the
null is *true*. `?effect=0&seed=103` is the one to show — it reads **p = 0.000**,
which is also the case the never-zero form `(k+1)/(B+1)` exists for.

### Shared machinery

Widgets 2, 3, 5 and 6 all accumulate a statistic into a growing distribution.

**Done.** `core/accumulator.js` (`createPile`) owns the binned counts, the running
mean and SD, the dot-plot-to-histogram crossfade, the ratcheted count axis, the
smoothed density and the landing flash. Both shipped widgets use it, and the
extraction was verified **pixel-identical** on five CLT states via
`widgets/_lab/fingerprint.html` rather than assumed invisible.

Deliberately *not* extracted: the draw/collapse/drop choreography. A Galton ball
descending row by row turned out to have a wholly different shape, so abstracting
over one example would have been a guess — the second consumer is what tells you
where the seam belongs.

**Done at widget #3:** `rng.resample(len)` in `core/rng.js`, returning *indices*
rather than values so the choreography can highlight which observations were
picked and show the duplicates that are the whole mechanism. A method on the
seeded generator rather than the free `resample(arr, rng)` the plan called for —
it needs only a length, and every other draw in that file is a method.

Also `binsFor(total)` moved into `core/accumulator.js`, where the rest of the
binning lives. `clt` and `bootstrap` had chosen it identically, which is the
second consumer the rule above asks for. Verified pixel-identical on all thirteen
existing fingerprint states.

`permute(labels, rng)` follows at widget #5, not before.

---

## Deferred from PHM5003

Not dropped — parked, in the order I would revisit them. Each already has its
misconception named above the line in git history.

| slug | concept | why it was parked |
|---|---|---|
| `ppv-prevalence` | Predictive value vs prevalence | **The highest-evidence item in the whole catalogue is now deferred** — physicians report sensitivity *as* PPV, and most put P(disease \| positive) at 70–80% when it is far lower. It sits outside the resampling arc, which is a good reason to postpone it and a bad reason to forget it. Flagging so the choice is visible |
| `regression-to-mean` | Regression to the mean | Attacks "responder" reasoning directly, but needs no resampling machinery |
| `interaction-effect` | Effect modification | The conceptual core of *precision*, but may be technical rather than abstract — see open question 4 |
| `censoring-km` | Censoring and Kaplan–Meier | Survival is its own arc; better built as a pair with `hazard-ratio` |
| `power-sample-size` | Power | Naturally follows #5, so a candidate for #7 |
| `sd-vs-se` · `confounding-simpson` · `forking-paths` · `bayes-updating` | | as before |

`forking-paths` is worth noting as the natural #7 alternative: it is #6's lesson
applied to analytic choices rather than to formal tests, and it needs no new
machinery at all.

---

# PHM5005 · AI/ML for Precision Medicine

Unchanged, awaiting the same treatment — an arc rather than a tier list. My guess
at its spine, for you to overwrite:

> a model that fits → a model that generalises → an honest estimate of how well → a probability you can act on

| # | slug | concept | misconception targeted | evidence |
|---|---|---|---|---|
| 1 | `overfitting-capacity` | Overfitting and capacity | That overfitting can be diagnosed from the training curve alone, or that low/zero training loss *is* overfitting. Students then tune learning rates instead of concluding the dataset is too small | **documented** |
| 2 | `data-leakage` | Train/test leakage | That any random split is a valid split. 40.5% of students preferred a model trained on shuffled data *because its test R² was higher*. Rarely taught in introductory courses at all | **documented** |
| 3 | `cv-nested` | Cross-validation and selection bias | That a CV score is still honest after choosing hyperparameters on those folds. Fewer than 10% recognise that un-nested CV inflates the estimate | **documented** |
| 4 | `imbalance-metrics` | Metrics under class imbalance | That 99% accuracy on a 1% prevalence outcome is a good model | **documented** |
| 5 | `calibration` | Calibration vs discrimination | That good AUC means the predicted probabilities are usable at the bedside | reported |

Then: `bias-variance` · `learning-curve` · `regularization-path` ·
`dimreduce-artifacts` · `feature-importance`.

**The pair worth building together.** `ppv-prevalence` and `imbalance-metrics`
are the same misconception twice — base-rate neglect as a clinical reasoning error
and as a model evaluation error. Same natural-frequency grid, one labelled
*patients*, one labelled *predictions*. Recent work ties class imbalance in AI
directly to human base-rate neglect. That is also the argument for un-parking
`ppv-prevalence` sooner than the table above suggests.

**Overlap.** `multiple-testing` (→ feature selection in high dimensions),
`bootstrap` (→ resampling-based model uncertainty), `permutation-test` (→
permutation feature importance) and `regression-to-mean` (→ why validation cohorts
underperform discovery) all serve both courses: one implementation, two entry
points, differing only by URL parameters and the chapter that embeds them.

---

## What this catalogue still does not settle

1. ~~**Sequencing against your actual teaching weeks.**~~ **Answered** in
   [prd.md](prd.md) §7: every widget in the arc maps to an existing lesson in the
   PHM5003 notebooks. Note that #3 and #4 share one — `03/03-02 Estimation:
   Quantifying Uncertainty` — which is a mild argument that #3's switch from a mean
   to a difference matters more than assumed, since one lesson carries both.
2. **The `inferred` entries** — you have data I do not: which questions they get
   wrong in exams, which they ask twice.
3. **Budget.** Six widgets at 3–8 hours each is 20–50 hours, and #1 and #3 will
   be at the long end. The `core/accumulator.js` extraction is on top of that and
   pays for itself by #5.
4. **Whether any concept resists a widget.** Some are hard because they are
   *abstract*, which widgets help with; others because they are *technical*, which
   widgets do not. `interaction-effect` is my main suspect. Mock up before
   committing — principle 5.1.

---

## Sources

- [Greenland et al. 2016, Statistical tests, P values, confidence intervals, and power: a guide to misinterpretations](https://link.springer.com/article/10.1007/s10654-016-0149-3) — the canonical enumeration of 25 distinct misinterpretations
- [Sotos et al., Students' misconceptions of statistical inference](http://mintlinz.pbworks.com/w/file/fetch/96929061/Sotos-2007-Misconceptions.pdf)
- [Misinterpretations of P-values and statistical tests persist among researchers and professionals](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC9383044/)
- [Understanding sampling distribution (Kadijevich)](https://www.stat.auckland.ac.nz/~iase/publications/rt08/T4P9_Kadijevich.pdf) — the "sampling distribution looks like the population" misconception
- [What Do Your Students Struggle with? A Survey of Statistics Instructors](https://www.tandfonline.com/doi/full/10.1080/26939169.2025.2455560) — conceptual errors dominate computational ones
- [Design principles for simulation-based learning of hypothesis testing](https://www.tandfonline.com/doi/full/10.1080/10986065.2022.2161288) — support for the permutation route into the p-value
- [Teaching Statistics with Simulation-Based Inference](https://www.zybooks.com/the-how-and-why-of-teaching-statistics-with-simulation-based-inference/)
- [Positive Predictive Value: A Clinician's Guide](https://www.psychiatrist.com/jcp/positive-predictive-value-clinician-guide-avoid-misinterpreting-results-screening-tests/) · [Natural frequency trees improve diagnostic efficiency](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8338842/)
- [Machine Learning Students Overfit to Overfitting](https://arxiv.org/pdf/2209.03032) · [Data Leakage Case Studies for ML Education](https://dl.acm.org/doi/10.1145/3736731.3746153)
- [Biased Minds Meet Biased AI: class imbalance and human base rate neglect](https://arxiv.org/pdf/2511.14591)
