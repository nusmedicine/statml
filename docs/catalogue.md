# Widget catalogue

Which concepts earn a widget, for which course, and on what evidence.
Companion to [design-principles.md](design-principles.md).

## How to read this file

**This is the RECORD, and it is long on purpose.** HANDOVER is current state and
the next task; this is where a decision and the measurement behind it live, and
it keeps sections marked `SUPERSEDED` rather than deleting them so a later
answer can be checked against what was assumed.

| looking for | go to |
|---|---|
| what to build next | § *The high-throughput arc*, five proposed slots — the only open queue |
| how a widget got its shape | § *Widget N*, in order |
| the four-method reconnaissance | § *Widget 19*, under the PCA sections |
| the arcs, and what is deliberately not a widget | the arc sections below |

A full copy as it stood on 2026-08-26 is in
[archive/](archive/), taken when HANDOVER was cut from 152 KB to 46.

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
| 4 | `confidence-interval` ✅ | Effect size and its uncertainty | *How big is the effect, and how sure am I?* An interval, read as a range of compatible effects | That there is a 95% chance the true value lies in *this* interval. A realised interval either contains it or does not; 95% describes the procedure across many studies | **documented** |
| 5 | `permutation-test` ✅ | p-value by shuffling | *Could chance alone have produced what I saw?* Shuffle the group labels, rebuild the difference, count | That p is P(H₀ true), or that 1 − p is the probability the alternative holds. Persists among researchers and professionals in statistics and epidemiology, not only students | **documented** |
| 6 | `multiple-testing` ✅ | Correction | *What if I do that twenty thousand times?* | That 50 hits at p < 0.05 out of 20,000 tests is a finding. The most consequential statistical error in omics work | **documented** |

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

**A dot that lands past the line turns red** (`--c-extreme`, added for this and
wanted again by #6 for the tests a correction flags), so p is *count the red
ones* rather than an abstract tail area. It is a different colour from the
arrival highlight on purpose: highlight means "moving right now", landing
somewhere that counts is a separate fact. That count is exactly p's numerator: the tail is
counted per bin as values arrive, never derived from bin centres at paint time,
because quantising the boundary bin would let a student count a different number
than the readout reports. Mocked up first in `widgets/_lab/null-and-p.html`,
which also established that the shaded tail band is close to furniture — the
tails run from the observed line to the panel edge, roughly half the panel.

**The true effect is a control and its first setting is None.** Verified in node
across 200 seeds with no effect at `n=12`: **exactly 5.0%** of studies give
p < 0.05 while the null is *true*. `?effect=none&seed=103` is the one to show —
it reads **p = 0.000**, which is also the case the never-zero form `(k+1)/(B+1)`
exists for.

**Named levels, not a number**, and it solved two problems at once. A numeric
slider put two numbers for "the effect" on screen — the one you set and the
different one your study measured — and the gap between them is sampling
variability, i.e. widgets 2 and 3 interrupting widget 5. A name cannot be
compared against, so the question never arises. It also let the levels stay in
SDs, where "Small" means the same thing in every population, without ever
printing a σ multiple beside a raw difference. The multiples and detection rates
are measured, not guessed — 120 studies per level — and the rates sit in the
control's detail line, so it **teaches power for free**: a small real effect is
found in about one study in six. Moderate is 0.9 SD rather than 0.8 because 0.8
lands the default on p = 0.055, exactly on the threshold, which is a poor first
thing to meet.

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

## Widget 7 — past the agreed six

The arc above is closed and stays closed: those six are one continuous argument
and nothing has been inserted into it. This one is an **extension**, and it is
numbered 7 in build order even though in *lesson* order it sits between #5 and
#6 (it hosts at `03 / 04-02 — Hypothesis Testing: Decision Making`, which
follows 04-01 and precedes the multiple-testing material). Renumbering a shipped
widget to make the gallery match the lessons was the alternative and was not
worth the churn.

| # | slug | concept | what it answers | misconception | evidence |
|---|---|---|---|---|---|
| 7 | `power-and-error` ✅ | Type I/II error, power, sample size | *I decided. How often is that decision wrong — and in which direction?* | That the two error rates are symmetric consequences of the same thing: that a noisier or smaller study is wrong more often in **both** directions. **α is chosen** and is fixed by construction whatever n does; **β is inherited** and is where all the noise lands | **documented** — and see below |

**The evidence is unusually direct: this course's own material states it wrongly,
because the app it links to computes it wrongly.** `03/04-02` sends students to
`kennethban.shinyapps.io/decision`, whose `plot_decision` takes the critical
value as `qnorm(1-threshold)` — the **standard** normal quantile — so it is
pinned at 1.645 regardless of `sd`. Verified against the deployed app, which at
its defaults (d = 4, sd = 1.5, α = 0.05) prints FP = 0.136 where the truth is
0.05. The lesson prose then draws the conclusion the broken figure supports:

> Larger variance (e.g. smaller sample size) · False positive (type I error)
> **increases** · … · True negative **decreases**

Neither happens. The β and power statements in that same block are all correct.
**This needs fixing in `../jupyterbook/phm5003` as well as here** — replacing the
app does not un-teach the sentence.

**Why it earns a slot rather than being a port.** The Shiny app is a static
figure with sliders, which non-negotiable #4 rules out. Here the two curves and
the threshold are the *setup* — the Neyman-Pearson planning phase legitimately
computes α and β before any data exists — and what the student builds is the
**evidence that those predictions hold**, one study at a time. Set the effect to
None and the two curves coincide exactly: one curve, and 5% of studies still
land past the line, at every sample size from 3 to 100.

**What building it settled**, and the first one generalises to any figure that
draws a threshold:

- **An axis must not carry two kinds of quantity — and the obvious fix cost more
  than the problem.** Built first on the raw difference of means, the control
  said α = 0.05 and the line it drew sat at 0.67 SD, with nothing connecting
  them: 0.05 is an *area*, 0.67 is a *position*. Rebuilding on the **test
  statistic** fixes that outright — the line sits at 1.645 in every state.

  But standardising **divides the spread out**. Both curves become N(μ, 1), so
  `n` has nowhere to act but position, and λ = d√(n/2) is the only thing either
  data control touches. **Changing the sample size then looks exactly like
  changing the effect size**, and the sliding curve was labelled "the true
  effect". For a widget whose job is showing what each control does, collapsing
  two of three controls into one motion is worse than the conflation it cured.

  **So both are offered and raw is the default**, with the line printing its α
  *and* its position in whichever units:

  | control | raw axis | test-statistic axis |
  |---|---|---|
  | effect | alternative's centre moves | alternative moves |
  | sample size | **both curves narrow** | alternative moves — *same motion* |
  | threshold α | line moves | line moves |

  They are one test drawn twice, and that is guaranteed by construction rather
  than asserted: the studies are stored **once** as raw differences and the view
  derives z as difference/se, which is all standardising is. Verified — power,
  separation and observed rate are identical on both axes at every n. Flipping
  the toggle is therefore a picture of the standardisation `03/04-01` teaches.
- **Both windows are fixed, for opposite reasons.** Raw: the curves must be seen
  to *narrow*, so a window fitted to the standard error would rescale in step and
  hide it. z: a fitted window would put the line at a new pixel on every change,
  which is the original defect in a new coordinate system.
- **A pinned window forces the BINS to follow the spread.** On the raw axis a
  fixed bin count collapses the pile to five bars of visible mass at n = 100
  (against 29 at n = 3). Sizing bins to the standard error holds ~22 across the
  visible mass at every n, so the pile still reads as a shape while genuinely
  shrinking against a fixed axis.
- **Areas are the wrong encoding for judging change**, so every shaded area is
  restated as a length. Two regions can move a great deal and look identical; the
  Shiny app hits the same wall and bolts a bar chart underneath for the same
  reason. This went through two forms — a pair of proportion bars first, then the
  **2 × 2 outcome grid** the figure now ends on, which is both what students
  already know and what the lesson's own `plot_decision` builds. Every cell is the
  same width and filled to its own rate, so all four share one scale and any cell
  can be compared against any other, across rows as well as along them.
- **Rows are the truth, columns are the decision**, and that orientation is what
  makes the table teach: you pick your column, you never pick your row, and you
  are never told which row you are in. The cells are CONDITIONAL rates, so each
  row sums to 1 and no total is shown — a joint table needs a prior on how often
  H₀ is true, which is a different and much harder lesson, and implying one here
  would be the error widget 6 exists to undo.
- **The degenerate case is left honest rather than blanked.** At effect = None the
  two rows come out identical, because power collapses to α exactly. That is
  arithmetic, not a bug, and reading one row twice is a better statement of "there
  is no second world" than an empty row would be.
- **A rule may only cross panels that share its axis.** The spanning rule ran
  through the rate bars, which were on a 0–100% scale — the bar split sat at 71%
  while the rule crossed at 50%, two unrelated positions reading as one
  coordinate. It is two segments now, and the gap is deliberate.
- **The threshold is a DISPLAY parameter.** α changes the decision, never the
  observations, so a student can run a thousand studies and then slide it and
  watch the same dots reclassify in place — measured: 5.1% → 25.4% called
  significant with "studies run" untouched at 1000.
- **A rate needs enough repetitions to stop looking like a trend.** At 400
  studies a sweep across n = 3, 12, 30, 100 with the null true gave 6.0%, 5.8%,
  4.0%, 3.3% — every one consistent with 0.05, and read left to right they look
  exactly like a rate *falling with sample size*, the opposite of the point.
  Fixed by a thousand repetitions **and** by putting the prediction beside the
  observation, which is principle 2.7 doing real work rather than decorating.
- **`spanningRule` gained an optional `width` and `dash`.** Widget 3 wants a
  hairline for a quiet reference behind the data; a decision boundary wants the
  heaviest mark in the figure. Verified pixel-identical on all 39 existing
  fingerprint states.
- **Text with a halo must be painted after the rule it defends.** `caption()` has
  always drawn a surface halo so a spanning rule can pass behind it — which does
  nothing if the rule is drawn last. Cost two passes to notice, once for the
  captions and once for the curve labels.

---

## The inference arc — MLE, MCMC, EM

Three widgets, all hosted by one lesson, `03 / 02-02 — Inferential Statistics:
Inferring Parameters`, and they are **one argument rather than three topics**:

> what makes the data most likely → what the data make likely → and if the data
> is a mixture, where the labels are missing

| # | slug | question | lesson's framing |
|---|---|---|---|
| 8 | `maximum-likelihood` 🟢 | Which parameter makes what I saw most probable? | `P(Data \| Parameters)` |
| 9 | `bayesian` 🟢 | What do the data make probable, and how sure am I? | `P(Parameters \| Data)` |
| 10 | `em-mixture` 🟢 | What if each point came from one of two populations and nobody recorded which? | E-step, M-step, iterate |

**The pairing of #8 and #9 is the point of the arc.** MLE answers `P(Data|θ)` and
Bayes answers `P(θ|Data)`; the lesson states both in exactly that form, two
headings apart. Reversing them is one of the most common errors in applied
statistics, and this pair is built to make the reversal visible rather than
warned about.

### Widget 8 · `maximum-likelihood` — shipped

| # | slug | concept | what it answers | misconception | evidence |
|---|---|---|---|---|---|
| 8 | `maximum-likelihood` 🟢 | Maximum likelihood estimation | *Which parameter value makes what I actually saw most probable?* | That the likelihood is a probability distribution **over the parameter** — that a taller curve at θ means θ is more probable. It is `P(data \| θ)` read as a function of θ for fixed data: it does not integrate to 1, and its total depends only on the range you chose to sweep | **reported**, with a documented parent — see below |

**The evidence, graded honestly.** I cannot name a study that measures *this*
misconception at a rate, so it is **reported**, not documented. What is
documented is its parent: **transposing a conditional** — reading `P(A|B)` as
`P(B|A)` — which the p-value literature widget 5 already leans on records among
researchers and professionals, not only students. "The likelihood is a
distribution over θ" is that same transposition applied to estimation, and its
stronger form — *the MLE is the most probable parameter value* — is precisely the
**Bayesian** statement. Treat the grade as a hypothesis to test on your students,
which is what the `inferred`/`reported` grades exist for.

**It also earns the slot on the second route: it is a prerequisite for #9 and
#10.** #9 is this widget's curve multiplied by a prior and normalised, which is
the moment the area *does* mean 1 — a comparison that only works if #8 has
established what the height means first. And **#10 contains #8**: the M-step *is*
maximum likelihood, run on soft-weighted data, the way #6 was #5 run twenty
thousand times.

**What the lesson supplies, so nothing is re-derived.** The worked example is a
negative binomial at `size = 2.5`, `mu = 10`, chosen *because it has no
analytical solution* — the point being that MLE is a search. The lesson optimises
with `optim` and draws a contour over (size, mu). That contour is widget 8's
second stage.

#### Design decisions, settled before code

Mocked up first in [`widgets/_lab/likelihood.html`](../widgets/_lab/likelihood.html),
which drew the whole figure twice — on counts and on a normal — and carries the
judging questions each panel had to answer.

**Counts, not measurements**, and one number decided it. The distinction the
widget exists to teach is *probability sums to 1 over the data, likelihood sums
to nothing in particular over the parameter*, and on a discrete model the first
of those is an **exact `1.000` you can print on the panel**. On a normal it is
the area under a density — one more abstraction handed to a student who is
already confused about which thing is a distribution. Counts are also the
lesson's own model and what RNA-seq actually uses.

**Three tabs, and the tab is the control the widget was missing.** A negative
binomial *has* two parameters, and a widget that estimates one while quietly
holding the other invites exactly the question that was asked of it — *"so are we
recovering the mean, or both?"*. Naming what you are estimating answers it before
it is asked.

| tab | assumed | swept | what it teaches |
|---|---|---|---|
| **Mean** | no extra dispersion, i.e. **Poisson** | the mean, 41 candidates | the mechanism, and that the peak lands on the sample mean |
| **Dispersion** | the mean, at what the first tab found | the dispersion, 41 candidates | that the Poisson assumption was wrong, and by how much |
| **Both** | nothing | a **climb** over the drawn surface | that the two searches stop disagreeing after two moves |

Each tab keeps its own cursor, so switching never destroys a sweep in progress.

**The mean tab assumes Poisson, which is what makes the second tab inevitable
rather than optional.** Poisson is the negative binomial at dispersion zero, so
the assumption sits exactly on the *left end* of the dispersion axis. And because
the counts are overdispersed, **the best Poisson visibly fails to cover them** —
at the default the counts 0–3 and 21–23 sit where the fitted Poisson has almost
no mass, on screen, before anything is said. That replaces a fiction (holding the
true dispersion and calling it "known") with a lesson: **maximum likelihood gives
you the best parameter for the model you assumed, and if the model is wrong the
best parameter is still wrong.**

**The Both tab climbs rather than sweeps, and that is the whole reason it works.**
A surface version was built and cut once: it filled the contour one mean-column
at a time, so each press evaluated one mean and *all* the dispersions — one
marginal grew a dot per press while the other was finished after the first. Every
established treatment draws the surface first and animates a **path** over it
([rpsychologist.com/likelihood](https://rpsychologist.com/likelihood/) uses live
sliders; animated surfaces are always gradient paths), so this does too. The
climb is **coordinate ascent** — maximise over one parameter, then the other —
which means each move is literally one of the other two tabs run once.

**It is not what `optim` does, and the code said otherwise until it was checked.**
`optim(method = "BFGS")` is quasi-Newton: it takes the gradient numerically,
corrects the direction with an approximation to the inverse Hessian, and
line-searches along it, so **every iteration moves both parameters at once,
diagonally**. Measured from the same start on the same data: BFGS-style steps run
at 21°, 111°, 21°, 110° and take six iterations; coordinate ascent runs straight
up, straight across, and is done in two. Both land in the same place — (2.14,
8.66) against (2.15, 8.67). **Same answer, different path.** Coordinate ascent is
kept because each of its moves *is* one of the other two tabs run once, which is
what makes the third tab a synthesis rather than a fourth idea; a gradient path
would be truer to `optim` and would teach nothing the other tabs have not already
set up.

**It converges in two moves and the next two visibly do nothing.** Measured: from
the leftmost candidate at dispersion zero, move 1 slides the mean 6.10 → 9.22,
move 2 lifts the dispersion 0.02 → 0.76, and moves 3, 4 and 5 do not budge —
because for a fixed dispersion the NB's MLE for the mean *is* the sample mean
whatever that dispersion is. **That is the vertical-crest fact acted out by a
search that refuses to move**, and it costs 246 cells against 1,681 for the whole
grid.

**The true parameters are settable, and the dispersion slider is the best control
in the widget.** Measured at n = 12: set it to 0 and the dispersion tab finds
0.03 and reports **"nothing to fix — these counts really are Poisson"**. Slide it
up and the same search reports Poisson being wrong by 10⁴, then 10⁸, then 10²³.
That answers a question a student actually asks: *how would I know I needed the
negative binomial?* The true-mean slider is weaker — it mostly relabels — but it
is capped at 5–20 so an instructor can match their own example.

**A default seed made the method look broken, and the fix was not the seed.**
Seed 12 shipped first. Its sample mean goes 9.17 → 9.50 → 8.22 as n goes 12 → 30
→ 60, so the first person to slide the sample size *up* watched the estimate get
*worse* and reasonably concluded maximum likelihood was failing. Nothing was
wrong — measured over 400 seeds the mean absolute error falls 2.63 → 1.64 → 1.02
→ 0.71 against a theoretical 2.82 → 1.63 → 1.03 → 0.73, and the sampler's own
mean over 400,000 draws is 10.02 — but seed 12 at n = 60 is in the unluckiest
3.8%, and a default that makes the method look broken is a bad default. It is now
seed 46: 8.67 → 9.53 → 10.33.

**The seed is not the real fix and must not be relied on.** For any single sample
the estimate genuinely *can* get worse with more data, and a student who moves the
seed will find one that does. What improves reliably is the **precision**, so the
readout now leads with the likelihood interval — which falls 3.32 → 2.15 → 1.17
even on the unlucky seed — and says so outright: *"more counts shrink THIS, not
the miss."* The widget previously spent two of its four tiles on one quantity
(`Best mean so far` and `Sample mean` differ only by a grid step), which is where
the room came from.

**`size` and `mu`, because that is what the notebook and `dnbinom` take.** The
lesson writes `rnbinom(1000, size = 2.5, mu = 10)`, defines its likelihood with
`dnbinom(x, size, mu, log = TRUE)`, optimises `c(size, mu)` with `optim`, and
plots its contour as `aes(x = size, y = mu)`. The widget now uses those two
parameters, in that orientation, with the truth at 2.5 and 10 — so a student can
move between the two without translating anything.

An earlier build used edgeR's **dispersion** instead (`φ = 1/size`, so `φ = 0` is
Poisson and larger means *more* spread), which points the intuitive way. It was
changed back: matching the lesson wins, and a student reading "dispersion" here
and `size` there would have had to invert it in their head every time.

**So the direction warning is the widget's job.** `var = μ + μ²/size`, so a
**larger `size` means LESS spread** and `size → ∞` is Poisson. The notebook does
not say this anywhere — its own parameter table calls `k` the dispersion, which
is the opposite convention from edgeR's — and the size slider's detail line does.

**Two starting points, and conflating them broke the figure.** `optim` is handed
`initial_values <- c(size = 1, mu = mean(data))` — a *solver* detail, a place to
begin iterating. The climb tab starts there, because that tab **is** `optim`. The
mu tab needs something else: a *modelling* assumption to sweep under. Using
`size = 1` there was mimicking the wrong thing and it showed — at `size = 1` the
data is assumed so overdispersed that the mean's likelihood interval ran off both
ends of the panel and the readout printed a span equal to the whole window.
Poisson is what an analyst assumes before thinking about overdispersion, it gives
a sharp unclipped peak, and it is what makes the size tab's **× 3.1 × 10⁴** mean
anything. That figure is computed at the exact `size → ∞` limit, which is off the
right-hand end of an axis stopping at 10 — the limit is taken in closed form
rather than approached with a huge `size`, where the gamma terms would be
differences of `lgamma` at ~1e9 and lose every significant digit.

**One deliberate deviation.** The notebook starts `optim` at `mu = mean(data)`,
which is already the answer, so the climb's first move would do nothing. The
widget starts the climb at the notebook's `size = 1` and a deliberately poor `mu`,
so the first move is worth watching. Everything after the start is the notebook's
procedure.

**Written for a biology MSc, and the readout was rewritten to prove it.** The
reader is comfortable with gene counts, samples and means, and not with
log-likelihoods or 10⁻¹¹⁰. Shown a finished sweep, the widget used to put four
tiles on screen — three of them scientific notation, two of those near-identical
huge negative exponents sitting side by side inviting a comparison nobody can
make by eye. It was read, correctly, as "technical".

It is now **two tiles per tab**: a number to point at and a range to point at.
Audited string by string in
[`widgets/_lab/plain-language.html`](../widgets/_lab/plain-language.html), which
renders three candidate readouts from the widget's real numbers and gives a
verdict on every label, caption and axis in it.

| cut | why |
|---|---|
| `log = -287.3` | a second unreadable number attached to the first |
| `these add to 7.9 × 10⁻¹¹⁰ — not 1` | the weak half of the probability-vs-likelihood point: two huge exponents to compare by eye |
| the **Likelihood / Log** toggle | a second axis convention to explain, and the log is what `optim` maximises — a fact for whoever is teaching, not for a first encounter |

**The misconception target survives the cut, on the canvas.** `all spikes add to
1.000` is exact, instant and free; the tile version was the same idea in its
worst possible vehicle. A secondary idea belongs in small grey text, not in a
stat tile.

**And the Poisson ratio went too.** It answered *"why a negative binomial rather
than a Poisson?"*, which this lesson does not ask — the negative binomial is
simply the example it uses. The size tab reports a **plausible range** instead,
which says something about the *method* and says it by comparison with the tab
next door: at n = 60 the mean is pinned to a factor of 1.2 and the size only to
2.6. **Some parameters are much harder to estimate than others** — no Poisson
required.

Poisson survives as the mu tab's *assumption*, because at any other assumed size
the mean's plausible range runs off the panel — measured: holding size at 1 or at
the true 2.5 clips it at both n = 12 and n = 60, because if you assume the counts
are that overdispersed you genuinely cannot pin the mean down within ±40%. What
was missing was a note saying what is held still, which now sits in the slot the
cut freed: *"size is held fixed — only mu is moving."*

**And the exponent now comes off the log-likelihood rather than off `exp()` of
it.** At n = 200 the likelihood is past 1e-308, `exp()` returns 0, and the axis
label would have been -Infinity with every plotted value NaN. Scaling in log
space cannot underflow at any n the widget offers.

**One press in the Both tab is a whole sweep, and it says so rather than showing
it.** The mu and size tabs spend one press per candidate — 41 presses, 41 dots.
The Both tab spends one press per *move*, and a move maximises over an entire
axis: **41 evaluations behind a single click.** Five presses do 41× the work of
five presses next door while looking like less, which was read — reasonably — as
*"why is the sweep only a few steps?"*.

**It was animated as the sweep it is, and that was reverted.** A scan ran the
length of the axis cell by cell with a marker trailing it holding the best so
far; it worked, and it was measured working (move 1 climbing the mu axis frame by
frame, move 2 running rightward along size). It was still **jarring** — a marker
shooting across the panel and snapping back, five times, reads as a glitch rather
than as a search. The note carries it instead: *"move 2 of 5: swept all 41 size
candidates"*. **Naming the 41 costs nothing; the motion cost legibility.**

**Why it does not reproduce R's numbers, and it is not the solver.** The
notebook's `optim` reports `size = 2.535698, mu = 9.931002` from **1000** counts.
The widget fits 12–60, because its mechanism is seeing each count's own factor
and that needs a countable number. Measured on the widget's own method with no
grid at all: n = 22 → size 1.80, n = 60 → 2.85, n = 200 → 2.55, **n = 1000 →
2.561**, which is R's answer to within the difference between two random samples.
The grid costs another 0.09 on size and 0.02 on mu at n = 1000 — real, but an
order of magnitude smaller than the sampling error at the sizes the widget shows.
So: **different data, and far less of it**, then the grid a distant second. The
readout says so in the Both tab — *"Counts used 22 · the notebook's optim uses
1000"*.

**The contour is the notebook's, negated.** The notebook plots `neg_loglik` with
`geom_contour_filled` and hunts the **minimum**; the widget plots the
log-likelihood and hunts the maximum. Identical function, opposite sign, same
`aes(x = size, y = mu)` orientation — and the axis label says it outright, because
a reader holding the two figures side by side needs telling once.

**Every factor uses both parameters, and the panel now says which.** *"Multiply
these together"* was asked, reasonably, *"multiply what — both mu and size?"*.
Each factor is `dnbinom(count, size, mu)` and always uses both; the tabs differ
only in which one is moving. The factor row's caption now names the pair it is
sitting at, in every tab.

**The Both tab reports two numbers, not four.** It used to add how many moves had
changed anything and how many cells the climb cost against the full grid — both
true, both interesting, and both more technical detail piled on a notebook that
is already technical. What is left is what `optim` itself returns: `size` and
`mu`. The climb's own caption still says when it stopped moving.

**The count axis ratchets, and at the far corner it has to reach past 200.** That
is not a drawing failure: mean 20 with dispersion 1 genuinely produces counts
that large, which is exactly why RNA-seq needs this distribution. The default
reaches 32.

**Stage one's answer is checkable, which is why it can carry the widget alone.**
With the spread fixed, the MLE for the mean is exactly the sample mean (`d/dμ` of
the NB log-likelihood gives `μ̂ = Σk/n` outright, whatever the spread is). So the
widget is seen reproducing an estimator the reader already trusts. The peak lands
on the nearest *grid* point, which is honest about what a grid search returns.

**And the estimate is not the truth**, which the readout says outright rather than
leaving a reader to conclude the method is broken: the sample mean is 9.17 against
a true 10, which is twelve counts' worth of sampling error.

**The lead action is the probability direction.** *Draw the counts* shows the
distribution they come from, drops them out of it, and then takes it away for
good — the one time the arrow runs parameter → data. Every press after it runs
data → parameter. Same lead-button grammar as #3 and #5, where the button greying
out permanently *is* the teaching, used here for a different reason.

**Its first labels were reported as a broken widget, and that earned a core
change.** With the lead unpressed, core disables step and run — so the first
thing a reader met was two dead buttons, a blank figure and no way to tell a gate
from a bug. `Draw` / `Try one` / `Play` became **`Draw the counts` / `Step` /
`Play`**, and `animation.leadHint` now prints one line under the drive row
saying what the greyed-out buttons are waiting for. **Widgets 3 and 5 have the
identical structure and neither declares a hint yet** — the same complaint is
presumably available there and has simply never been made.

### Widget 9 · `bayesian` — shipped

| # | slug | concept | what it answers | misconception | evidence |
|---|---|---|---|---|---|
| 9 | `bayesian` 🟢 | Bayesian estimation | *What do the data make probable — and how sure am I?* | That the likelihood curve already tells you how probable each parameter value is. It is `P(data \| θ)`. To get `P(θ \| data)` you need a prior, and you have to **normalise** | **documented parent** — the transposed conditional, same as #8 |

**This is the widget #8 was built to set up**, and the lesson states both forms two
headings apart: MLE answers `P(Data | Parameters)`, Bayes answers
`P(Parameters | Data)`. Reversing them is one of the commonest errors in applied
statistics, and the pair is built to make the reversal visible rather than
warned about.

#### What shipped

Four tabs over the lesson's own `rnbinom(size = 2.5, mu = 10)` counts, with a
prior on **both** parameters and the joint posterior computed exactly on an
80 × 80 grid:

| tab | shows |
|---|---|
| `mu` | likelihood **×** prior **=** marginal posterior, over the mean |
| `size` | the same three panels over the dispersion |
| `Both` | the joint posterior the two marginals are the edges of, shaded by 50 / 80 / 95% HPD |
| `MCMC` | a Metropolis chain walking that same posterior — the answer to "what is the backend?" |

Every panel prints its own total, which is the whole argument in one column:
the likelihood's area is `5 × 10⁻¹³` and nothing holds it there; the prior's is
1; the posterior's is 1 **after dividing by `P(counts)`**, which is the lesson's
`P(X)` and is printed with it.

#### Three things the plan got wrong, and what replaced them

- **~~One parameter, `mu`.~~ Both.** The plan reasoned from #8's discovery that
  two parameters at once is where a figure comes apart — true for a *sweep*, and
  wrong here, because the place the two approaches actually diverge IS the second
  parameter. #8 cannot estimate `mu` without pinning `size` somewhere (it assumes
  Poisson, and says so); Bayes puts a prior on both and **adds the plane up along
  the axis you do not care about**. Marginalising is the lesson, and it needs two
  axes to exist. The three-panel figure survives intact because the marginal
  still factors — `posterior(mu) ∝ prior(mu) × ∫L(size, mu)·prior(size)·dsize` —
  so the middle panel is the likelihood with the other parameter averaged out.

- **The payoff is that the two parameters behave DIFFERENTLY**, which one
  parameter could never have shown. Measured on the defaults: over twelve counts
  `mu`'s posterior narrows from SD 2.90 to 1.52 and its centre is dragged
  7.08 → 8.57, so the prior is largely overwhelmed. `size`'s SD goes 1.00 → 1.12
  — it does not narrow at all. Twelve counts say a great deal about a mean and
  almost nothing about a dispersion, so on one parameter the prior stops
  mattering and on the other it is still doing the work. #8 reported the same
  asymmetry as a wider interval; this is the sharper version of it.

- **~~MCMC is a sentence, not a widget.~~ It is a tab.** The plan's reasoning
  still holds for the *mechanics* — burn-in, autocorrelation and rejected
  proposals are not what this lesson asks about, and
  [chi-feng.github.io/mcmc-demo](https://chi-feng.github.io/mcmc-demo/) does them
  better than anything here would. What the plan missed is that a student who
  has just watched an exact grid computation will reasonably ask what `brms` is
  doing, and the honest answer is worth one tab: the same posterior, walked by a
  random-walk Metropolis on **log** `size` and **log** `mu` (with the Jacobian —
  that is what Stan is doing behind the notebook's log link), so the cloud can be
  seen converging on a contour already on screen and already known to be right.
  What it buys is the point: the grid costs 6,400 evaluations for two parameters
  and 80ᵏ for k of them.

#### A one-parameter Poisson build was made first, and cut

Worth recording, because the numbers are the argument and re-deriving them costs
an hour. The plan's "reuse #8's `mu` grid" implies scoring the lesson's
negative binomial counts with #8's **Poisson** likelihood. Measured over 2,000
seeds at n = 12: the 95% credible interval then covers the true mean **64%** of
the time. One seed in three shows the headline number missing the truth — which
is a misspecified model, #8's lesson, not a broken method, and paying for it
here with the widget's own headline is a bad trade.

Poisson *counts* with a Poisson likelihood is calibrated (95.2%) and drops the
lesson's model. The negative binomial with **both** parameters estimated is
calibrated on both (98.2% for `mu`, 95.0% for `size`) and keeps it. That is the
version that shipped.

#### What the sampler tab shows, and why it is not the obvious thing

Mocked in [`_lab/mcmc-panel.html`](../widgets/_lab/mcmc-panel.html) before any
of it was written, because the first build showed a chain converging on a
contour — true, and the least interesting fact about it.

**MCMC does not compute the normalising constant. It avoids it.** `P(counts)` is
the same number on the top and the bottom of the acceptance ratio, so it
cancels, and the chain never needs it. That is the entire reason the method
works on a model where the integral does not, and it is the misconception the
tab exists to dissolve — it was the first thing asked about this widget, which
is evidence enough that a student will ask it too.

So the tab carries **two bars**: `prior × L` where the chain is and where it
wants to go, from one left edge with the current point at full width, so the
proposal's length *is* the acceptance probability and `u` is a dart thrown along
the same axis. Underneath, one grey line: *both would be divided by
P(counts) = 4.0 × 10⁻¹⁷ — so the chain never computes it.*

Three things the mockup settled that guessing would not have:

- **A teaching case has to be a near miss.** The first draft picked a rejection
  with a ratio of `3 × 10⁻³⁵ / 1.2 × 10⁻¹⁸`. The bar was invisible and the ratio
  printed `0.00`, which reads as a broken figure rather than a close call.
- **Most proposals really are hopeless, and the panel has to survive it.**
  Measured over 600 draws: 436 rejected, and 58% of those score under 2% of the
  current height. That is not a scaling problem to fix — rejecting cheaply is
  why the method is affordable — but `toFixed(2)` printed all of them as
  `0.00`. Below 0.01 the ratio now prints in scientific notation.
- **The histogram of the draws was built and cut.** It is the notebook's own
  figure and it proves the chain recovers what the grid computed — but at forty
  draws it is a row of spikes with a tall one where the chain sat stuck, and it
  reads as the sampler *failing* rather than as the sampler working slowly. The
  tab has to survive the first hundred presses, not just the finished run.

**Both bars take one colour.** They were briefly coloured by outcome, which made
accept and reject instant and quietly said they were two different quantities.
They are one quantity at two points, which is the only reason comparing them
means anything.

#### The sample is dealt once, and says so

`compute()` has always drawn every count up front — it is pure and seeded, so it
has no choice — but the figure did not say so, and dots appearing from nowhere
invite the reading that each press draws a fresh observation. A **lead action**
now deals the whole sample at once and Step works through it: solid for
observed, **hollow rings** for still to come, so what is left is countable and a
reader can see the answer is still moving.

Rings beat the two alternatives on the same page: at n = 60 a low-opacity
pending dot is indistinguishable from a solid one in the same column, and a
separate waiting row costs 36 px more and puts a gap between things you are
comparing. The lead deliberately does **not** re-show the population the way
widget 8's does — that needs a 150 px distribution panel this widget does not
have and would leave empty for the rest of the session, and widget 8 has already
run that arrow once on this exact population.

#### What refusing to assume is worth, on the widget's own face

The `mu` tab's interval carries it: *width 6.0 · assume no extra spread and it
claims only 3.2.* Both numbers are computed live from the same twelve counts and
the same prior — the second under a Poisson likelihood, which is what widget 8's
`mu` tab assumes and says it assumes.

That is the payoff of the whole two-parameter design, and the direction of it
surprised the build:

| what you do about `size` | 95% interval for mu | width |
|---|---|---|
| pin it at its estimate, 2.55 | 6.02 – 11.77 | 5.75 |
| pin it at the *true* 2.5 | 6.00 – 11.79 | 5.78 |
| don't pin it — integrate it out | 5.87 – 11.86 | **5.99** |
| **assume Poisson (size = ∞)** | **7.10 – 10.27** | **3.17** |

**Pinning the nuisance parameter costs 4%. Assuming the wrong model costs 47%.**
The first three lines agree because the best `mu` is the sample mean at *every*
size — 8.670 at 0.5, at 1, at 2.5, at 5, at 10 and at a million, identical to
three decimals — because the `r` terms cancel out of `d/dmu`. So widget 8's
coordinate ascent is not a greedy shortcut that finds a worse answer; it finds
exactly the same one.

> **This entry used to say "the posterior correlation between the two parameters
> is 0.024", and that was a default-prior number written up as a property of the
> model.** Measured on the same twelve counts, it runs from **+0.393** at
> `mu ~ N(2, 0.5)` to **−0.327** at `mu ~ N(16, 3)`. What is independent of size
> is where the `mu` ridge *sits*, not how wide it is: the likelihood does not
> factor, and a smaller size means more variance, so a wider spread of `mu` stays
> tolerable. On the crest the coupling is invisible — which is precisely why
> 0.024 looked like a fact. **Independence of the argmax is not independence of
> the parameters**, and the distinction is now something widget 9 prints rather
> than something this file gets wrong. Found by a student question, not by us.

**The search strategy is not what costs you. The model assumption is.** Which
reframes the `Both` tab: it is not "the proper way" against "the shortcut", it
is the tab that tells you *whether the shortcut was safe* — a crest running
straight up means the best `mu` does not depend on `size`, and you can see that
rather than be told it.

#### Three questions from the first read, and what each changed

- **"Is `give or take` needed? MLE did not need this extra parameter."** It is
  not a model parameter. The model has two, `mu` and `size`, and both methods
  estimate those two. The three sliders describe a **prior**, which is a
  *distribution* over a parameter rather than a value for it — a normal takes a
  centre and a width, an exponential takes one number. MLE needs none of them
  because it never produces a distribution over the parameter: it returns a
  point and a curve with no area. **The prior is the price of the sentence
  widget 8 cannot say** — *there is a 95% chance mu is between 5.9 and 11.9.*
  That is now the `detail` line on the first prior slider, and `give or take` is
  labelled as the prior's STRENGTH, which is the widget's best single
  experiment.

- **"How can we indicate mu / size / Both are grid and MCMC is not?"** It was
  already written and was rendering into a tooltip — see
  [design-principles.md](design-principles.md) §3.4f, which that question
  earned. The tab strip now shows *EXACT, by adding up all 6,400 grid cells*
  against *SAMPLED, never enumerated · 80 cells per axis is 6,400 for two
  parameters and 10¹⁹ for ten.*

- **"Why guess, when we can see the true distribution?"** The best question in
  the set, and the honest answer is that **on this problem you should just use
  the grid.** The contour is on screen so the sampler can be watched agreeing
  with an answer you already have — the only way to earn trust in it for the
  problems where you cannot compute one. The readout carries the check
  continuously: *mu, from the draws 8.35 · the grid says 8.57.* Two different
  "true" things share that panel and the widget now separates them: the faded
  contour is the exact posterior, computable here and not at ten parameters; the
  `truth` dot is the real parameters, visible only because the population is
  seeded.

#### The marginals sit on the plane's edges

Asked for on the sampler tab and given to `Both` as well, because it is what
makes that tab's claim to be "the joint the other two are the edges of"
checkable instead of asserted. `mu`'s marginal stands on the right (mu is the
plane's y-axis) and `size`'s lies underneath (size is the x), so each aligns
with the axis it belongs to and *a marginal is the plane added up along the
other axis* becomes visible.

**Not side by side**, which
[`_lab/two-then-both.html`](../widgets/_lab/two-then-both.html) had already
ruled out: two upright curves invite the eye to compare their peaks, and the
peaks are not comparable, so the worse-determined parameter looks better
determined.

On the sampler they carry a histogram of the draws under the exact curve — the
notebook's own `post_samples %>% ggplot(aes(x=mu)) + geom_histogram()`. **This
reverses the earlier decision to cut it.** The objection was that at forty draws
it reads as the sampler failing; with the exact curve drawn over it and the draw
count on screen, "lumpy at 40, close by 600" is the right lesson and it is
exactly why brms takes 6,000.

#### The rail says which numbers are the truth and which are a belief

Four questions in a row turned out to have one cause: the control block had two
completely different kinds of thing in it and no way of saying so. It now reads
as two labelled groups —

```
The population — which you would never really know
   True mean · True size · Counts to collect · Seed
Your prior — one distribution per parameter
   mu — a Normal centred at · …give or take · size — an Exponential with mean
```

**The true parameters are controls again.** They were cut because the axis
window followed the truth and a moving window would let a prior slide off the
panel. The window does not have to follow: `mu` is fixed on [0, 20] and `size`
on [0.5, 10], and the truth moves inside them. Which restores the thing widget 8
is seen doing and this one was not — **set a truth, collect counts, watch the
posterior find it.** At a true mean of 15 against a prior at 7, twelve counts
get you to 11.1, which is the honest answer and the reason the prior sliders are
there.

**Naming the distributions replaced three lines of prose.** `mu — a Normal
centred at` / `…give or take` / `size — an Exponential with mean` teaches that a
prior *is* a distribution and each one costs its own parameters — which is the
trade against maximum likelihood, and the answer to "why did MLE not need this
extra parameter?". See [design-principles.md](design-principles.md) §3.4g.

**The tab strip is two rows, not one.** `mu · size · Both` captioned *exact —
one grid, added up*, and `MCMC` captioned *approximate — sampled, never
enumerated*. The method is the grouping, so it is true before you click.

**The sampler reports both parameters**, in the same two tiles the `Both` tab
uses, each against the grid's exact value and the truth. The acceptance rate
moved to the ratio strip, which is where the proposals are — it is a property of
them, not one of the answers.

#### The rail reads as one sentence, in three blocks

`The population` → `Your prior` → `The inference`, each a heading with a
hairline above it and a line of air. The first attempt had headings that were
`--fs-sm` on `--ink-2` like every field label, differing only in weight, and the
blocks were reported as not apparent — see
[design-principles.md](design-principles.md) §3.4g. **No widget in the
collection had ever grouped its controls**, so there was no precedent to match:
`power-and-error`'s gate divider is a stage reveal, not a grouping.

Three or four sliders under a two-word heading needs no further explanation,
which is why the per-tab `detail` lines came out again — the row captions say
what separates the rows and each figure's caption says what its tab shows.

**And the subtitle was the actual problem with the header, not the layout.**
`.w-subtitle` caps at `62ch`, which in this font resolves to 469px — about 76
real characters per line, the top of the readable range, not a narrow column.
Widget 9's subtitle was **108 words against a collection median of 44** and the
next-longest of 74. It is 63 now. The cap is fine; the copy was not.

#### Should the tabs be gated? No — but Replay had to be fixed

Asked whether `size` and `Both` should stay blank until a reader has "played
through" them, since running `mu` fills them in. They should not: the first
three tabs are three views of **one** accumulation, and a sample observed once
has been observed. Nothing further happens to produce the `size` answer — it is
the same 6,400 cells added up along the other axis. Widget 8's tabs each carry
their own cursor because each is a different *search* with a different amount of
labour in it; these are not.

Gating them would also fight the rule that put them in a segmented control:
alternatives stay visible at rest, and a lecturer opening straight on `Both`
should not be blocked.

But the want underneath — *watch this tab build* — was already available and
unusable, because **Replay re-ran `init` from nothing and un-dealt the sample**.
Fixed in core: `init` receives `leadDone`, Replay re-runs the loop, and Reset
remains the only way back to before the lead. That is now true of `bootstrap`,
`permutation-test` and widget 8 as well, and it makes the lead greying out mean
something — exactly one control undoes it.

#### The `brms` check, answered

- **`normal(0, 10)` on the Intercept is a prior on `log(mu)`**, because
  `family = negbinomial()` uses a log link and the notebook recovers
  `mu = exp(b_Intercept)`. Enormously wider than anything the widget's slider
  reaches, and on a different scale. The `mu` prior's `detail` line says so.
- **`exponential(1)` on `shape` is on the parameter itself**, so the widget's
  `size` prior reproduces the notebook **exactly** at its default. That it sits
  well below the true 2.5 is not a flaw to tune away: it is why the `size` tab
  shows a prior still doing work at n = 12.
- **Prior shape:** settled by the lesson rather than by a control. `mu` gets a
  normal (centre and width, two sliders); `size` gets an exponential (its mean,
  one slider). Three prior sliders, no shape picker.

#### What went into core, and what did not

The second consumer arrived, so the extraction the plan anticipated happened:
`nbLogPmf` / `nbPmf` / `nbDraw` are in `core/stats.js`, and `sci` / `sup` went
with them. `noteRight` became `plot.note()` in `canvas.js`. Two semantic colour
roles were added — `--c-prior` and `--c-posterior` — because a Bayesian figure
holds three curves and only one of them is data.

**What did NOT get shared: the likelihood evaluation.** #9 factorises the
negative binomial's log-pmf so that one count costs 80 `lgamma` calls instead of
6,400 (the only per-observation term touching the grid is `Σ lgamma(k + r)`,
which depends on `r` alone) — without which the prior sliders would not be live.
#8 evaluates 2,460 cells in total and wants the plain, readable form. Two
versions of one formula, deliberately, because they are optimising different
things — the exception that 5.8 does not cover, and it is written down in both.

### Widget 10 · `em-mixture` — shipped

| # | slug | concept | what it answers | misconception | evidence |
|---|---|---|---|---|---|
| 10 | `em-mixture` 🟢 | EM on a two-component mixture | *What if each point came from one of two populations and nobody recorded which?* | That a hard cluster assignment and a soft responsibility are the same thing. EM never assigns a point to a component, it assigns a **fraction**; `clusters(em_result)` is an argmax taken afterwards, and the lesson's final figure paints a point whose share was 0.55 one confident colour | **inferred**, and the lesson's own output is what invites it |

**The sentence the widget exists to say: EM gets the populations right and the
individuals wrong.** Both halves are true at once on the lesson's own data, and
the two readout tiles are named for them. Averaged over 200 datasets from
`adults ~ N(170, 30)`, `children ~ N(120, 15)`, 100 each:

| | |
|---|---|
| fitted components | 120.8 ± 14.7 and 172.1 ± 28.5 — right |
| hard labels disagreeing with the true group | 27.9 of 200 (13.9%) — wrong |
| shares between .2 and .8 | 43.2 of 200 |

#### The other candidate misconception was measured, and dropped

"EM finds a local optimum that depends on where it started" is the standard
warning and it is **false on this data often enough to mislead**:

| start | outcome |
|---|---|
| 500 random parameter starts | 499 → the same optimum; 1 → a degenerate spike on the tail |
| 500 random-**responsibility** starts — what `flexmix`'s `set.seed(123)` actually seeds | **500 → the same optimum** |
| both curves at the grand mean · both narrow on the children · one on each tail · min/max | the same optimum, every time |

Every one lands on `logL = −966.89`. Showing a local optimum would mean rigging
either the data or the start, and a figure that does so claims a pathology is
routine when it is 0.2%. **It was dropped on honesty, not on the cost of a
second figure** — which is the stronger reason and settles it permanently.

#### The separation slider carries the argument across its whole range

Sixty datasets per stop, children fixed at 120 ± 15:

| adult mean | fitted components | hard labels wrong |
|---|---|---|
| 220 | 120.5 ± 14.8 / 220.5 ± 29.8 | 2.8 of 200 (1.4%) |
| **170** (the lesson) | 120.8 ± 14.7 / 172.1 ± 28.5 | **27.9 of 200 (13.9%)** |
| 140 | 121.0 ± 15.0 / **145.6** ± 28.8 | 63.8 of 200 (31.9%) |

Three regimes on one control — populations right and individuals right;
populations right and individuals wrong; and, at 140, the components merge and
the populations go wrong too, which is 2.6's failing case. Together they say the
mislabelled individuals are a property of the **overlap** and not a failure of
the algorithm: at a gap of 100 the method is no better, the data simply is.

#### All four parameters, because `parameters()` returns four

Cell 32 names its rows `mean` and `sd` and its columns 1 and 2. The first build
had two sliders and reported two means; it now has four and reports
`121 ± 17 and 169 ± 23 cm` against `the children are 120 ± 15, the adults
170 ± 30`. The spread ranges are 5–40 for both, safe across the whole square:
over 1,040 runs covering every corner, the axis never had to stretch past
**1.28×** the pile's own height (1.9× being the point at which the figure looks
broken). The ratio is scale-invariant — halve a true spread and the pile narrows
by exactly as much as the curve sharpens.

**The spread is 3–12× harder to recover than the mean**, at every setting tried,
150 seeds each:

| setting | child mean | child sd | adult mean | adult sd |
|---|---|---|---|---|
| the notebook, 120±15 / 170±30 | 2.0% | **11.7%** | 4.1% | **13.1%** |
| far apart, 100±15 / 220±30 | 1.2% | **6.4%** | 1.2% | **6.4%** |
| merged, 140±15 / 150±30 | 1.7% | **20.8%** | 6.3% | **16.2%** |
| equal spreads, 120±20 / 170±20 | 4.2% | **12.9%** | 3.0% | **14.2%** |

That is widget 8's finding in a second model — there, at n = 60, the mean is
pinned to a factor of 1.2 and the size only to 2.6. Not printed on the canvas:
the tile carries all four numbers against all four true ones, and naming it
would be a third idea in a figure already carrying two.

**The spreads also open a regime the means cannot.** At 40/40 the two groups
overlap heavily while their means stay 50 cm apart — 51 of 200 mislabelled and
125 ambiguous — so overlap is reachable by widening as well as by closing in.

#### Three stages, and the gate is the boundary

> populations → **draw a sample** → inference

**Populations.** Four sliders and two curves, in the two group colours, with a
coloured swatch beside each pair in the rail so the control block and the figure
agree before anything is fitted. No data on screen: none has been drawn.

**The sample.** A `gate` — a full-width button in the control flow that hides the
whole drive row until pressed (3.4b, already built). The people fall out of those
curves grey and unlabelled, **and the true curves go with the labels**: both are
the truth, and a figure that keeps one while withholding the other has given the
premise away before it starts.

**Inference.** Start, Iterate, Play, Reset — plus how to read it.

Four beats, one visible change each. **Draw a sample** puts people on screen,
**Start** puts curves on screen, **Iterate** is the first thing that colours
anybody. People stay grey until the first E-step, because until then there are no
responsibilities and so nothing for the mark to be a fraction of.

The gate is deliberately **not** `display: true`, unlike widget 7's. There it
opens an overlay on a finished figure, so leaving must not destroy the work. Here
it is a stage boundary: going back to the populations and returning should start
the inference over rather than resume a converged fit the reader stepped away
from. Core sends a non-display gate down the data path, which resets that much.

The caption names what is actually drawn at each stage. It read "Two curves, and
the people they are claiming" throughout, which is false at both ends — no people
before the sample, no curves between the sample and Start. **A caption naming a
mark the frame does not contain is the same defect as a claim that is false on
the first press.**

#### The hard label is the default, and the setup shows the truth

Two reorderings, both from the same report — that `share` is the harder of the
two to explain when it comes first.

**`hard cluster` is now the default reading.** A misconception is dislodged by
being *met*, not pre-empted: the reader arrives expecting each person to be in a
group, gets exactly that, and finds the share underneath it. The other way round,
`share` has to be explained before anything has asked a question.

**The setup shows both groups in their own colours, and Start takes them away.**
Before the lead the colour control is overridden and the pile is painted by true
group — those are not EM's guess about anything, they are the two populations the
reader just set, and painting them `hard cluster` would report a fit that does not
exist. That is cells 25 and 27 with the transition between them drawn, and it
gives the lead something real to do: the labels going away **is** the premise, so
a button that removes them earns being pressed once and greying out. The old
"guess two curves" never did, and the handover said so at the time.

The dissolve needs no colour interpolation, because the mark already carries a
fraction: a child at 1 and an adult at 0 both travel to 0.5, which lands exactly
on the state the first E-step starts from. An earlier attempt faded each dot
toward `--ink-3` and read as the data being deleted rather than relabelled.

#### How a person shows a share — settled in `_lab/soft-share.html`

The first build encoded the share as a **hue**, ramping through `--ink-3` at
0.5. It was reported unreadable in the precise way that matters: *under hard
cluster you can see the colours swapping; under share you cannot tell what
changed.* Two failures, both fatal to a figure whose subject is the E-step — a
hue that shifts a few percent per iteration is not a visible **event**, and grey
in a figure whose other colours are named reads as *no data* rather than *no
group*. At the guess, where every share is exactly 0.5, the whole pile went grey
and looked broken.

It is a **split mark** now: one circle per person, filled from the bottom by its
share, so a person at 0.55 is drawn 55% amber. At the guess that is 200 visibly
half-and-half people, and every E-step is fill levels sliding. Published practice
agrees on the mark and not the geometry — Kern et al., *The whole and its parts*
(Visual Informatics, 2024), encode mixture proportions as **pie glyphs whose
circular segments are the component densities**; a fill level is the same glyph
read as a level, which is easier to compare across neighbours than an angle.

**The candidate worth recording as rejected** is splitting each *column* at its
weighted count `Σ share` — appealing because it is literally the M-step's input,
and wrong because it paints the bottom 7 of 12 people fully amber and the top 5
fully blue. That is a hard assignment wearing a soft costume, in the widget built
to separate the two. The mock-up is what caught it.

#### The pile stacks children first, and that is a fix

Filled by height, a person's level within a column is arbitrary with respect to
group. Invisible under `share` and `hard cluster` — a share depends on height, so
a 5cm column is one flat colour whatever the order — but under `true group` it
scattered blue through the amber columns and read as noise. Ordering by the true
group makes that view a stacked histogram, which is the notebook's own cell 25,
and the blue caps on the short columns become the mislabelled people, countable.
Not a spoiler: the ordering is fixed for the whole run and cannot be seen until
the truth is asked for, and nothing moves when the colouring is toggled — which
is what makes the three views the same 200 people read three ways.

#### What did NOT transfer from #8, though the plan assumed it would

The plan said the M-step panel could be widget 8's figure, on the strength of
the lesson's own `(e.g. using MLE)`. The statement is true and **the figure does
not transfer**: widget 8's is a *search* — 41 candidates, one dot per press, a
curve you climb — and the Gaussian M-step is closed form, a weighted mean and a
weighted sd. Drawing a climb over arithmetic would make the arc's payoff a lie
about what the M-step does. What transfers is the verb, not the panel.

#### Why the `n` slider stops at 40

A two-component Gaussian mixture has an unbounded likelihood: a component can
shrink onto a few near-identical points and drive its own sd towards zero. Over
210 (adult mean, seed) combinations per setting — 6/210 collapse below sd 6 at
n = 20, 1/210 at n = 40, 0/210 at n = 100. That spike is a **second** lesson,
about mixture likelihoods rather than about responsibilities, and the figure has
nothing to say about it. It is not floored in the M-step, because a variance
floor is a modelling choice and inventing one silently would misrepresent EM;
the slider's floor makes it rare instead of hiding it.

The same sweep killed a line of on-screen copy. The `share` option's detail read
*"never 0 or 1"* — true of the model, false of a double: some share rounds to
exactly 0 or 1 in 2/210 runs at n = 100 and 22/210 at n = 20. **A claim that
holds at the default and not at the ends is not a claim.**

## Widget 11 · `probability-mechanisms` — shipped

| # | slug | concept | what it answers | misconception | evidence |
|---|---|---|---|---|---|
| 11 | `probability-mechanisms` 🟢 | Probability distributions, and the `d`/`p`/`q`/`r` family | *Which distribution do I need, and what do the four functions give me?* | That a distribution is chosen by the shape of the histogram — which cannot be consulted until the data is in, by which point the choice has been made by whatever function got typed | **inferred** |

**Three views, and naming the map as a place you can go is the workflow.** *Map*
is the decision tree; *Distribution* plays the chosen process one draw at a time;
*R code* turns each of `d`, `p`, `q` and `r` into the question it answers. Try
one, press Map, try another.

**The tree is never a toll.** The R code view carries all eight distributions as
chips, so a student who already knows they want `rpois` reaches it in one click.
Walking the tree is how you *find* a distribution, not the price of looking one
up.

**The figure is generic; the example is one line of description.** Free throws
and endangered species told a reader what *that panel* was about and nothing
about what a binomial is, so the axes now read "Successes in 10 trials" and
"Targets found in 50 draws" and the concrete cases sit in the nameplate.

### The tree, and why it is drawn rather than walked

Eight endings, all on screen from the first click, dimmed, with the path lighting
up as it goes. A breadcrumb says where you have been; the tree says where you
are, what the alternatives were, and that there are exactly eight endings. Three
questions reach any leaf:

| | question | splits |
|---|---|---|
| 1 | Is your data **discrete** or **continuous**? | counting / measuring |
| 2a | Is there a maximum possible count? | binomial-pair / Poisson-pair |
| 2b | What kind of measurement? | quantity / waiting time / all equally likely |
| 3a | Does every try have the same chance? | binomial / hypergeometric |
| 3b | Is the average rate the same in every window? | Poisson / negative binomial |
| 3c | Could the biggest plausible value be **ten times** the smallest? | normal / log-normal |

**Question 3c is the one that took three attempts.** "Symmetric or right-skewed"
is answerable only with the data in hand, which is the habit the widget exists to
break. The span test is answerable about the quantity itself, and it disposes of
"but lab values are normal" with a number:

| quantity | 1st pct | 99th pct | span |
|---|---|---|---|
| serum sodium N(140, 2.5) | 134.2 | 145.8 | **1.1×** |
| adult height N(160, 10) | 136.7 | 183.3 | **1.3×** |
| birthweight N(3.2, 0.5) | 2.04 | 4.36 | **2.1×** |
| ALT lognormal(3.1, 0.55) | 6.2 | 79.8 | **12.9×** |
| CRP lognormal(1, 1) | 0.27 | 27.8 | **105×** |

Everything normal sits at 1–2×; everything log-normal at 10×+. Sodium is the case
that makes the rule rather than the exception to it — an earlier draft paired
birthweight against CRP and gave a reader no way to tell which was which.

### Every distribution has its parameters on sliders

Frozen numbers let a student watch eight processes and never ask what happens
when one of them changes. Each entry is a **builder over its own parameters**,
and the params block declares one slider per entry gated on `dist`, so only the
two or three that belong to the chosen distribution are ever on screen. Three of
them carry an idea no static figure could:

| slider | what it demonstrates | measured |
|---|---|---|
| negative binomial **size** | large size *is* a Poisson | var/mean **3.57 → 1.23** as size goes 2 → 30 |
| hypergeometric **how many you draw** | without-replacement only matters when you take a big fraction | var/mean **0.86 → 0.42** as draws go 50 → 500 of 1000 |
| uniform **top of the range** | a density is not a probability | `dunif` **1.00 → 5.00** as the range narrows to 0.2 |

The last is the cheapest demonstration in the collection that a density can
exceed 1, and it is one slider. `dexp` at rate 20 reads **10.0** for the same
reason.

### The rail is decided in one place, per view

Core decides which controls *exist* from the spec's `when`, which takes one
condition. Three of the four rules here need two — a field belongs to a
distribution AND to a view — so `syncChrome` settles them from `draw`, as one
table rather than four scattered lines, because the rule is a single idea: **the
Map is for choosing**, and a rail carrying the last distribution's sliders, its
outputs and a dropdown naming it is a rail full of answers to a question the
reader has not asked yet.

| control | map | distribution | R code |
|---|---|---|---|
| view switcher | ✓ | ✓ | ✓ |
| its parameters | | ✓ | ✓ |
| speed, seed | | ✓ | |
| q | | | ✓ |
| drive row | | ✓ | |
| legend | | ✓ | |

**There is no distribution dropdown.** It was a `select`, and it read badly: on a
view with nothing chosen it said *"— not chosen —"* above a figure telling you to
go to the Map, which is two controls disagreeing about who is in charge. Both
figure views carry the same **row of eight chips**, so a distribution is picked
the same way wherever you are and the tree is never the toll for looking one up.
The cost is that the eight names are no longer keyboard-reachable; the readout
still names what is chosen.

The Map's readout is one line — *Chosen: Hypergeometric* — rather than Draws /
Mean / Variance with em-dashes in them, which is a preview of an answer nobody
has asked for. **Clear** sits on the map, where the choice was made, and only
once there is something to clear.

**Four defects came out of building this, all of them the same kind.**

*The cursor moved after the repaint.* `setParam` repaints synchronously, so
setting the tree cursor afterwards drew the previous leaf still lit while the
rail already showed the new one — a dropdown reading Hypergeometric above a tree
lit through to Binomial, with nothing scheduled to reconcile them.

*The cursor never followed the list.* `cursor` and `dist` are genuinely
independent — you can have chosen the binomial and be browsing the continuous
branch — so the cursor must not track `dist` on every paint. It follows only when
`dist` changes from outside the tree, which needs a remembered last value.

*`PAR_NAMES` was written out by hand* and drifted the moment `hk` became `hpct`
and `hN` was added; those two sliders then stayed on the Map because nothing was
looking for them. Derived from the distribution table now — principle 5.8.

*The log-normal's slider and its R call disagreed.* The slider is the **median**,
because that is the number a reader can picture, but R's parameter is the mean of
the logs — so a slider reading 3 sat above a call reading `meanlog = 1.10`. The
call is written `meanlog = log(3)` now: valid R, it runs, and it says where the
number came from.

*`hidden` does not hide an element with an explicit `display`.* The attribute is
only a user-agent default and `.w-legend` is `display: flex`, so the legend stayed
on screen while every DOM check agreed it was hidden. `.w-drive` escapes this
only because the side layout carries `.w-split .w-drive[hidden]`. Both are set
now: the attribute for assistive tech, the inline style for the eye.

### Answering a question must not navigate

Landing used to switch to the Distribution view the instant the last answer was
clicked, and the report was that it *jumps*. A click that answers a question and
a click that changes what you are looking at are two different actions, and one
button doing both is why it felt jarring. The answer box lands and stays on the
Map; the **distribution's name**, one column to its right, carries a `→` and is
what you press to go and watch it.

### The hypergeometric's pool is a control, and its draw is a fraction

A thousand dots in a 58px strip are 2px across and a removal leaves a gap nobody
can see. **Pool size** is now 100/200/500/1000 and the grid lays itself out for
whichever it has — at 200 the dots are four times the area. **How much of the
pool you draw** replaced a raw count, because what decides whether without-
replacement differs from with-replacement is the *share* taken, and a slider
reading "50" says nothing about that until you have also read the pool size.
Measured at K = 40: taking 5% of a pool of 100 gives var/mean **0.59**, taking
60% gives **0.23**.

*A URL bug came out of this.* `params.js` matches a URL parameter against option
keys with `includes`, which is strict equality — so numeric `choice` values made
`?hN=1000` fall back to the default silently, and two pool sizes produced
identical figures. Every other `choice` in the collection uses strings; this one
now does too.

### Four things testing caught that no assertion would have

**The parameter sliders stayed on the Map.** They are gated on `dist`, which is
right, but the Map is where you *choose* — arriving there to find the last
distribution's sliders still on screen reads as leftovers. `when` takes one
condition and this needs two (`dist` AND `view`), so `draw` hides them, the same
way it hides the drive row.

**The discrete overlay was drawn as stems.** A pmf conventionally is, but stems
over a histogram put two sets of vertical bars in one panel and it read as a
mistake. A **dot at the expected count** says "this is where the bar should
reach" and leaves the bars the only vertical thing on screen.

**The exponential's rate and mean are reciprocals**, and nothing said so — a
slider reading 5 above a mean reading 0.20 looks like the widget disagreeing with
itself. The strip now prints *gaps average 1/5 = 0.20* and the slider's detail
says the same.

**The R-code cards looked inert under a rescaling parameter.** An exponential's
window is 5/rate wide and a normal's is mean ± 3sd, so both are *self-similar*:
change the parameter and the curve is pixel-identical while only the scale
beneath it moves. The mini figures had no axis, so that read as a slider doing
nothing. They carry tick labels now.

**The theory dots needed a line through them.** Dots alone read as scattered
marks; the line is what makes eight of them one distribution, and it is the same
stroke the continuous panels use.

**The theory curve was named in the legend and never drawn.** It was lost when
the reading moved to its own view, so the legend advertised a mark that did not
exist. It is back on the Distribution view behind a `Show the distribution`
toggle, scaled to expected counts, and it waits for a draw rather than opening on
the answer.

### Eight distributions, four of each type

Three are beyond the taught five: **exponential** (the gap between the same
arrivals the Poisson panel counts — one process asked two questions),
**uniform** (a p-value under a true null), and **log-normal** (the shape most
biomedical measurements take). Adding them balances the tree and makes "a density
is not a probability" demonstrable without a contrived parameter:
`dexp(0.2, rate = 5) = 1.84` and `dunif(x, 0, 1) = 1.0000` exactly.

### Which mechanism pair is a picture, measured before anything was drawn

40,000 draws per cell, in [`_lab/mechanisms.html`](../widgets/_lab/mechanisms.html):

| pair | var/mean | separation | |
|---|---|---|---|
| `rpois(lambda = 5)` vs `rnbinom(size = 2, mu = 5)` | 0.995 vs 3.536 | **3.5×** | a picture |
| `rbinom(50, 0.02)` vs `rhyper(m = 20, n = 980, k = 50)` | 0.988 vs 0.928 | **5%** | not a picture |

Surveying 50 plots from 1000 gives a finite-population correction of 0.951, so
the hypergeometric panel carries a different claim — **the chance moves as the
pool empties**, printed as a running `P(next) = 19/951` against the binomial's
fixed `P(make) = 0.7`. Its pool **pulses rather than dims**: fifty faded dots in a
thousand is a 5% change in a field of grey, but the *event* is visible even when
the total is not.

### Three things the build settled the hard way

**The cursor is a quantile, not an x.** x has a different range in every
distribution and a slider's bounds cannot depend on another parameter; the
control then performs `q` rather than illustrating it; and it puts the discrete
overshoot on the control — ask 0.95 of the Poisson and `qpois` returns 9, whose
cumulative is 0.968.

**Reading is a view, not a `gate`.** Core's `updateAnimButtons` treats a gate as
the boundary of the stage the animation lives in and hides step/run/reset while
it is shut. Here the drawing happens *before* the reading, so a gate hid the
drive row in the only view that has one — and the widget hides that row itself,
from `draw`, on the two views with nothing to drive.

**`setParam` does not sync the control showing the same value.** The tree is
clicked on the canvas — a first for this collection, and it needed no core change
because `defineWidget` returns `setParam`. But `setParam` only rebuilds controls
when the parameter *gates* another field, so the `Where you are` select went
stale on every canvas click and then reasserted its stale value. Two lines in the
widget rather than a core change; if a second widget ever drives a parameter from
its canvas, that is the moment to move it.

## Widget 12 · `odds-and-risk` — SHIPPED

| # | slug | concept | what it answers | misconception | evidence |
|---|---|---|---|---|---|
| 12 | `odds-and-risk` ✅ | Odds ratio vs relative risk | *One table, two ratios. Why do they disagree, and which one am I allowed to compute?* | That an odds ratio reports how much **more likely** an outcome is. It is the same numerator over a denominator that shrinks as the outcome gets common, so it always overstates the risk ratio — and by how much is set by the **base rate**, not by the effect | **documented** |

### REBUILT AFTER REVIEW — this supersedes the design notes below

Shown to Kenneth as a built draft and it did not survive contact. Three
complaints, all fair, and the fix for each was smaller than the thing it removed.

**1. ~~Baseline risk and true risk ratio as inputs.~~ You set the four counts.**
*"What is true risk ratio? So we are sampling from this distribution — sounds a
bit misleading."* Correct, and it was an error rather than a preference: the
label says there is a population parameter and we are sampling from it, and
**nothing in this widget samples anything**. The epistemics of widgets 2–5 got
imported into a widget that has none. Two sliders now set how many died in each
arm; the risk ratio and odds ratio are the only numbers on screen the reader did
not set. **A ratio is the one thing in this topic that must always be an output.**

**2. ~~Views called "Two denominators" and "Why the odds ratio".~~ Tabs called
Cohort and Case-control.** *"I don't understand the view buttons — do we need
it?"* They were my own section headings leaking onto the screen as controls, and
they were the first thing a reader tripped over. The tabs are **study designs**
now: two words a student recognises before they arrive, and switching between
them is itself the lesson rather than a way to reach it. Kenneth's call.

**3. The control names the act, not the jargon.** *Measure the deaths against
**everyone** / **the survivors***, and then *risk* and *odds* appear on the
figure as the **result** of having done it.

**And the case-control argument lost its algebra.** The brackets and the
regrouping identity `(a/b)/(c/d) = (a/c)/(b/d)` are the deep reason and they are
too much: the reader must hold four cells and two groupings before the point
arrives. One line gets there instead — **enrol fewer survivors and your study's
death rate climbs to 81%**, not because the disease got worse but because you
stopped enrolling survivors. A death rate you set with a budget slider is not a
finding, and neither is a risk ratio built out of two of them: 2.00 in the
cohort, 1.22 here. The odds ratio sits at 2.67 the whole way, which is the
answer to *then what do I report*.

| survivors enrolled | death rate in your study | RR | OR |
|---|---|---|---|
| all of them | 30% | 2.00 | **2.67** |
| 1 in 2 | 46% | 1.71 | **2.67** |
| 1 in 5 | 68% | 1.38 | **2.67** |
| 1 in 10 | 81% | 1.22 | **2.67** |

**The tab switch is the transition.** Core principle 4.4 was added for the
denominator toggle and pays for itself twice: switching to Case-control empties
the survivors you did not enrol out of the *same* picture as hollow rings, so the
two designs are visibly two views of one cohort rather than two figures.

**IEEE already knows the difference between undefined and infinite, and my zero
guards were destroying it.** `riskU === 0 ? Infinity : riskE / riskU` turns both
`0/0` and `0.4/0` into infinity. Drag both sliders to zero — nobody dies in
either arm, two drags from the default — and the figure claimed the odds ratio
was ∞. It is not; it does not exist. Plain division gets all three cases right,
and the four degenerate corners are now named on screen rather than papered over.
Everyone dying in both arms is the best of them: the risk ratio is 1.00 and the
odds ratio does not exist, **which is the odds scale showing you its edge**.

**Verified: 420 states swept at the 550px canvas** — 70 cohort and 350
case-control, every corner included — with every printed ratio checked against an
independent computation, and no overflow, collision or blank.

Mock-up: `widgets/_lab/simpler-2x2.html`, which is where the shape was settled
before any of it was built.

### Round two of review: the division graphic, and what the convention is

**The fraction is back under each arm.** Cut in the rebuild as furniture, asked
for again, and it earns the space: the numerator is the deaths and is *identical*
in both readings, while the denominator drops its red dots one at a time. That
shows the thing no wording does — **risk's numerator sits inside its denominator
and odds' sits beside it** — which is why only one of the two can pass 1. Set 90
and 45 and the exposed arm reads 90 over 10 = **9.00**; a risk never could.

**What the convention actually is**, since it was asked and the widget should
carry it. Two different things get called a convention here and only one of them
is arbitrary:

- **The table layout** — exposure down the rows with the exposed first, outcome
  across the columns with the event first — *is* arbitrary, in the way driving on
  the left is. It exists so `a`, `b`, `c`, `d` mean the same thing everywhere.
- **Risk versus odds is not.** Risk divides by everyone, is bounded at 1, and is
  the quantity anybody actually wants. Odds divides by the survivors, has no
  ceiling, and is the quantity the **mathematics keeps handing you** — a
  case-control cannot give a risk, odds survives that sampling, and above all
  **logistic regression models `log(odds)`**: the logit is what maps (0,1) onto
  the real line so a linear model can fit a binary outcome. `exp(bₙ)` is an odds
  ratio because of the link function, not because anyone chose it for
  interpretability.

That last point is the one to say out loud in `05-05`: **we report odds ratios
because that is what the method returns, not because they are easier to
understand — and they are not.** It is the whole reason the misreading is so
common.

**A study-design reminder graphic, mocked up:** `widgets/_lab/study-design.html`.
Time runs left to right in both panels and what differs is which end the
investigator *started* from; the case-control dots travel **against** the arrow,
the only motion on the page that does. Each panel ends on one line — *60 of your
200 died, you counted that* against *60 of your 130 died, you chose that*. Open
question on that page: a strip along the top of the figure that redraws with the
Cohort/Case-control tab, or a first tab of its own.

One thing that build settled: **a ghost stays behind in the recruited box.** The
first version let it empty out, which says the patients *left* the infected group
when they died. They did not — the two ends are two sortings of the same 200
people, and a person is in one box at each end at once.

**One more core fix, from the same family as the last two.** `startAnim` stops
the pending frame before scheduling a new one, so a display parameter changing
faster than the frame clock — a slider being dragged, or a sweep setting seventy
parameters a second — cancelled every frame before it ran and the ease never
advanced. Core now declines to restart a loop already easing. Found by a sweep
that measured a permanently stuck transition and blamed the widget; the widget
was fine, verified directly. All 78 fingerprint states MATCH.

**Verified: 420 states swept at the 550px canvas**, 70 cohort and 350
case-control, with the settle checked by *observing the target value* rather than
by a fixed wait — this browser does not always run rAF through a long await, and
a probe that watched the wording instead of the number passed at the halfway
point of an ease and reported the widget wrong twice.

### Round three: the button names the RESULT, and the design graphic reads by step

**~~The control names the act, not the jargon.~~ Reversed, and it was my
mistake.** "Measure the deaths against · Everyone / The survivors" reads well and
it does not TEACH: nothing on screen connects the choice to the two ratio cards
at the bottom, so a reader is left asking *which of these am I supposed to be
looking at*. Reported exactly that way.

The buttons are now **Relative risk / Odds ratio** — the two things the widget
exists to distinguish are the two things you press — and the denominator moved to
the detail line underneath, which `segmented` renders as visible copy. **The
selected card is lit and the other dimmed**, crossfading on the same `q` as the
piles, with a rule under the live one so the link survives a projector that eats
a 30% alpha difference. Button → piles → fraction → result is now one chain.

Both cards stay on screen: the comparison *is* the lesson, and dimming says "not
the one you are building", never "not relevant".

**The study-design graphic reads left to right by STEP, not by time.** The first
version was faithful to the calendar — exposure left, outcome right, in both
panels — so the cohort's dots flowed right and the case-control's flowed left,
and it read as two things converging on the middle. **Reading order beat
chronology.** Step 1 on the left is always the group you *recruited*; step 2 on
the right is always what you went and *counted*:

| | step 1 | step 2 |
|---|---|---|
| cohort | recruit by **exposure** | wait, count the outcome |
| case-control | recruit by **outcome** | look back at the exposure |

Four phrases, and the distinction is in the reading direction rather than in an
arrow that has to be explained. The graphic is now driven by the same two death
sliders as the widget, so a reminder can carry the reader's own numbers.

**A limit of the harness, recorded because it wasted three rounds.** An ease
cannot be settled by waiting a fixed time — this browser does not always run rAF
through a long await — nor by watching the *wording*, which flips at the halfway
point while the numbers keep moving. It has to be settled by observing the exact
target value. Even then a sweep flagged 17 of 420 states at one degenerate column
where a direct probe shows the widget printing the right thing; the layout sweep
(420 states, zero overflow, zero collisions) is the part that carries.

### Round four: the drive row is gone, and the explanation explains

**~~Work it out.~~ Cut, and it was the widget's worst friction.** Reported
exactly: change a slider, find the button greyed out, and the only way back is
Reset — which throws away the numbers you had just set.

The lead existed on the reading of non-negotiable #4 that a widget must not open
on its own answer. **#4 exists so a student BUILDS the answer instead of being
handed it, and here there is nothing to build**: the answer is a division of two
numbers the student typed in themselves, so a button between the input and the
arithmetic is a toll rather than a stage. What honours #4 instead is **where it
opens** — both sliders at 20, no effect, both ratios exactly 1.00. The figure
opens on the null case, which is the *opposite* of its answer, and the first drag
is what makes the two numbers separate. The drive row is now **Reset alone**.

**A ship-time blocker this creates, named rather than deferred quietly**
(principle 5.6). `check.mjs` requires a driven fingerprint state from any widget
declaring an `animation`, and the harness drives by pressing a button with a
`data-key`. Widget 12 has no such button: its animation is driven by *display
parameters*. Drafts are exempt, so this passes today. Shipping it needs either
the harness taught to drive a control, or the rule narrowed to widgets that have
a drive button — and until one of those happens **the eases have no fingerprint
coverage, which is a blind spot and not a safety.**

**The study-design strip sits above the figure**, two lines, redrawing with the
tab. Step 1 is the group you recruited and its counts are **boxed**; step 2 is
what you then counted, unboxed. The case-control explanation points back at it: a
risk divides by a number in a box, and a number in a box is not a measurement.

**"Overstates" is now defined, in numbers, every time it appears.** It was a bare
verb in the readout and nowhere explained — *further from what, and why does it
matter?* It matters because of the sentence people actually write:

> The truth is that infection multiplies the RISK of dying by 2.00. Someone who
> reads the odds ratio as if it were a risk ratio would write "2.67 times as
> likely" — 33% more effect than there is.

**And the case-control line gives the mechanism, not a verdict.** It used to say
*you chose this* and stop, which names the crime and not the method. Now:

> You kept every case and only 28 of the 140 survivors. So the risk of dying with
> infection reads 40 out of 52 here, where those same 40 deaths sat in 100 people
> in the cohort — and the two arms' denominators shrank by different amounts, so
> 2.00 became 1.38. The odds ratio survived because both arms lost the same
> FRACTION of their survivors: each arm's odds rose by the same factor, and a
> ratio does not notice.

**The rounding footnote fires at 5%, not 0.5%.** It is true at 0.5% and it is a
footnote, and firing it on almost every setting displaced the sentence the reader
is there for. The cohort's odds ratio is now named in the note either way, so the
reader can see for themselves that it did not move.

**Three harness traps in one session, all of which produced false reports about a
correct widget**, and all worth knowing before the next sweep: an ease cannot be
settled by a fixed wait, nor by watching wording that flips at the halfway point;
a repeated paint lands the same string at the same pixel and must be **deduped**
before any collision check, or a frame captured mid-ease reads as thousands of
overlaps; and a wrapper flag that says *installed* is worthless once a diagnostic
has restored the original — the probe then measures nothing and every state looks
wrong. 420 states swept clean once all three were fixed.

### Round five: the strip has to NAME the design, and the odds ratio goes first

**A strip that is only numbered steps does not read as an explanation.** It
shipped as two numbered lines with counts, and a reader looked straight past it:
*where is the description about study design?* It was on screen the whole time —
verified by reading the canvas — and it did not register, because it had no
heading and no sentence, only instructions. It now opens with the design's
**name** and one plain line saying what that design is, plus a key for the boxes:
*boxed = a number you chose, not one you measured.*

The lesson generalises past this widget: **a caption tells you what you are
looking at; only a heading tells you that you are meant to look.**

**Those descriptions are short because they were measured.** The first pair
carried a second clause each — *this is the design a risk ratio needs* — and ran
**65px off the 550px canvas**, where an overrun erases what it crosses rather
than blending and still looks like text. The clause is said better by the readout
note anyway, attached to the number it is about. The strip's widest right edge is
now 451 of 550.

**The odds ratio comes first, everywhere.** Buttons, cards and readout tiles, and
it is the default. `04-08` derives the odds ratio in its cell 35 and the relative
risk six cells later — **a widget that hosts in a lesson should meet the reader
in the order the lesson does**, and the widget's own title says odds ratio first.

### Round six: the strip is a diagram, not a summary of one

**A two-line text summary is not what "incorporate the mock-up" meant**, and a
reader said so. The point the design graphic makes is **shape** — two groups you
assembled, two you counted — and shape is the thing a sentence is worst at. The
strip is now the mock-up's diagram: four boxes in a row with an arrow between the
pairs, the recruited pair heavy-bordered and filled, the counted pair light.

One row rather than the mock-up's two columns of two, because the widget already
spends 150px on the piles below. The row still carries the only thing that
matters — **which pair is boxed** — and it redraws with the tab, so switching
design visibly moves the border from one pair to the other.

**And the lab page was broken at rest, which is the state anyone opening it sees
first.** The boxes were faded in with the animation, so before you pressed Run
the whole left half of each panel was invisible while its heading sat above
nothing. **Boxes are furniture and are always drawn**; only the contents — the
dots and the counts — are the study's output and worth waiting for. Caught from a
screenshot, and no assertion would have found it: every string was painting, at
the right coordinates, at `globalAlpha = 0`.

### Round seven: study design is a TAB, and it comes first

**Two attempts to put the design above the figure both failed, and the third
answer was that it does not belong above the figure at all.** It went in as a
two-line text summary (invisible to a reader), then as a compact four-box
diagram (better, still a caption). What it actually is: *a whole idea, and the
one that has to land before the calculation means anything.* So it gets a whole
panel, and it is the **first tab and the default**.

| tab | what it is |
|---|---|
| **Study design** | both designs side by side, animated. Recruit, then count. |
| **The calculation** | the piles, the division, the two ratios |

**Two tabs, not three.** Cohort and case-control live *inside* the calculation as
an ordinary control, because there they select a table; on the design tab both
are on screen at once, because there the whole point is the comparison.

The panel is `_lab/study-design.html` ported in, at one dot per five people, with
the case-control enrolling one survivor in two — fixed, because this tab is a
reminder and not a parameter study. The enrolment slider stays with the
calculation, where it changes an answer.

**The widget owns the drive row from `draw`**, the way widget 11 does: core
decides which buttons exist and cannot know that one of two views has nothing to
run. Play belongs to the design tab; the calculation hides the row entirely.
Both `hidden` and `style.display` are set — `hidden` is only a user-agent default
and loses to any explicit display.

**A `const` below `defineWidget` is in its temporal dead zone.** The design tab's
geometry was declared next to the function that uses it, which is where it reads
best and where it kills the widget on load: `defineWidget` calls `draw` during
its own top-level run. *Function declarations hoist; `const` does not.* Declared
above the call now, with the reason written where the next person will move it
back.

**Three placements for one number before it stopped colliding.** The box count
went inside the box, where 28 dots reach it; then onto the label line, where
"lived — the controls" is 105px against an 88px box and the right-aligned count
lands inside the label; then below the box, which is the only line in the panel
nothing else occupies — and even that needed the row pitch opened up, because
row 1's count was sitting 8px above row 2's label. **A count has to be placed
against everything that can grow, not against the thing it labels.**

### Round eight: three layout defects in the design panel, mocked up before porting

All three reported from one screenshot, all fixed in `_lab/study-design.html`
first and ported only once they read.

**The step headings sat 12px above the box labels** and the two ran together as
one block of text on top of the boxes — *the words are obscuring the graphs*. The
boxes now start **40px** below the heading, which is the whole fix.

**A count below its box labels neither box.** It sits between two of them, and
the reader has to guess upward or downward — reported as exactly that confusion,
and it was my own doing: the count had been moved there in round seven to escape
the dots. It shares the **label's line** now, right-aligned to the box edge, so
label and count are one phrase attached to one box.

That only works with **short labels**: "lived — the controls" is 105px against a
104px box, so the count lands inside the label. The labels are `cases` /
`controls` / `infected` / `not infected`, and what the long ones were explaining
is said once on its own line — *cases died · controls lived*. **Three placements
for one number, and the constraint was never the thing it labels — it was
everything around it that can grow.**

**The enrolment slider now shows on the design tab**, where it drives the
case-control panel and is the argument: change your budget, watch the death rate
move while nobody's illness does. That needed a rule `when` cannot express — the
field belongs on the design tab always, and on the calculation tab only when the
design is case-control — so the widget manages that one field from `draw`, in
`syncRail`, alongside the drive row. Both `hidden` and `style.display` are set.

### Round nine: concrete labels stay, and the design animation is staged

**Settled: concrete labels, generic vocabulary in the RULES.** Widget 11 went
concrete → generic and the catalogue calls that a win, but the argument does not
transfer: widget 11 had **eight panels** and the examples were doing the work of
telling them apart, so a student learned "the free-throw one" instead of "the
fixed-n one". Widget 12 has **one table** and nothing to confuse it with, so the
concrete labels are not standing in for a mechanism.

What decided it is that **the widget's hardest sentences collapse without
concrete nouns.** *"40 died for every 60 who lived"* is readable; *"40 events per
60 non-events"* is not, and that phrase is the entire odds concept. Worse on the
design tab, where **"cases" and "controls" mean nothing except died and lived.**

So the split is widget 11's real lesson applied properly — *the figure carries
the mechanism, the example is one line of description*: the boxes say infected
and died, and every RULE says EXPOSURE and OUTCOME. A cohort fixes the exposure
and measures the outcome; a case-control fixes the outcome and measures the
exposure. Both are on screen and neither does the other's job.

**Parked, not rejected:** a `scenario` parameter (ICU · smoking/lung cancer ·
treatment/response) would buy transfer and serve `05-05`'s CHD example properly.
It costs a control on a widget already told three times it has too many. Cheap to
add later — everything downstream is four counts.

### Round nine, part two: the design animation had to be staged

Two complaints from one screenshot. **Nothing was in the recruited boxes until
Run**, so dragging a slider changed nothing visible; and **all four flows moved
at once** — *"I have no idea where came from what"*.

**Full at rest** fixes the first and pays for itself twice, because it states the
designs' real asymmetry with no words at all: **what you do not know at
recruitment is different.**

| | at recruitment you know | so the dots | and what arrives is |
|---|---|---|---|
| cohort | who is exposed | sit **grey** | the outcome colour |
| case-control | who died | are **already red and blue** | which box they belong in |

**One pass per recruited group** fixes the second: the active group is lit and its
partner held back, so a reader follows one split at a time.

Two defects caught on the way, both invisible to a text sweep. The finished
figure sat **entirely dimmed**, because once both passes are over neither is
"live" — dimming is for guiding attention *during* a run, not a property of the
result. And every travelling dot was painted **black**: `stagesFor` emits
`fill:` and the rewritten painter read `f.k`, so `fills[undefined]` is an invalid
`fillStyle` and an invalid `fillStyle` is a **no-op that silently leaves the
canvas default**. Found by wrapping `arc` and `fill` and tallying what colour was
actually asked for — the same recipe as the fillText sweep, one level down, and
worth keeping: **a canvas will not tell you it ignored you.**

### Round ten: the case-control model was wrong, and so was the claim about it

**Reported as a question, and the question was right.** *"If I put 100 cases and
100 controls it looks like a cohort — am I misunderstanding something?"* No. The
model was parameterised as **thin the survivors 1-in-k**, which is a real
sampling scheme and a bad choice of dial: **at k = 1 it IS the cohort**, so the
control made the distinction look like it was about sampling fraction when it is
about which margin you fixed. It also spoke a language no investigator uses —
nobody thinks *one survivor in five*, they think *100 cases and 100 controls*.

**The model now enrols every case and `r` controls per case**, drawn from a
source population that both studies sample: the cohort follows 100 exposed and
100 unexposed chosen by EXPOSURE, the case-control enrols by OUTCOME. That is
also why case-control studies exist — you cannot follow everyone when the outcome
is rare — and it is what lets the control ratio exceed the survivors the cohort
happened to follow.

**AND I GOT THE ARITHMETIC CLAIM WRONG, twice over.** I told Kenneth the new
model would make the odds ratio *exactly* invariant and retire the whole-people
footnote. Measured before building on it:

| model | exactly invariant | worst drift |
|---|---|---|
| thin survivors 1-in-k (old) | 10.4% | 133% |
| enrol N cases + M controls | **3.9%** | 102% |
| enrol ALL cases + M controls | 8.8% | 25% |

Enrolling a fixed number of cases is **worse**, because it rounds *both* columns
instead of one. Nothing makes it exact. Whole people do not divide.

**So the claim changed, and the new one is truer than the old one ever was.**

> The odds ratio **estimates** the population's. The risk ratio is not estimating
> anything.

Measured across the sensible slider range: the risk ratio's median shift is
**7.9%** and the odds ratio's is **0.7%**, an eleven-fold difference — and the
risk ratio's *direction is the investigator's to choose*, which is worse than a
bias. At the default table:

| controls per case | death rate | RR | shift | OR | shift |
|---|---|---|---|---|---|
| 1 : 1 | 50% | **1.64** | −18% | 2.62 | −1.9% |
| 1 : 2 | 33% | **1.96** | −2% | 2.71 | +1.5% |
| 1 : 4 | 20% | **2.20** | +10% | 2.66 | −0.2% |

The risk ratio swings 1.64 → 2.20 and **crosses the truth on the way**, so it is
right at 1:2 purely by accident — and you would have no way to know, because
knowing would require the population ratio you are doing a case-control study to
avoid measuring. **"The odds ratio is unchanged" was an idealisation this widget
asserted for six rounds and papered over with a footnote about rounding. Naming
what the number actually IS retires the footnote by making it the point.**

**One dot scale, derived.** A 1:4 enrolment holds several hundred people, so the
design tab's scale is computed from the fullest box in either panel and printed
once — a fixed scale either overflows there or wastes the box everywhere else.

**And both tabs read the same `studyOf`** (5.8). A design tab and a calculation
tab that modelled a case-control differently would be the exact confusion this
round started from, one level up.

### Round eleven: two of round nine's four decisions were never in the widget

**Found by assertion, not by eye, and it is the exact failure the handover
warns about.** The design tab painted **112 dots at `globalAlpha = 0`** at rest.
Round nine settled *full at rest* — "so the sliders visibly drive them" — and the
catalogue claimed all four of `study-design.html`'s lessons were in the widget.
Two were not. `recruited = easeSeg(t, 0, 0.18)` is 0 when `t` is 0, so both
recruited boxes were empty until Play, and dragging either death slider changed
**nothing visible on the tab the slider sits next to**. The other missing one:
*one pass per recruited group* — all four flows shared a single `travel`.

A screenshot shows an empty box and an empty box looks like a design choice.
What proved it was wrapping `arc`/`fill` and tallying the alpha each dot was
asked for. **`globalAlpha = 0` paints perfectly**, and no hash will ever flag it.

**Full at rest pays for itself twice, and the second payment is the better one.**
The asymmetry it states without words:

| | at recruitment you know | so its dots sit | and what arrives is |
|---|---|---|---|
| cohort | who is exposed | **unknown-grey** | the outcome colour |
| case-control | who died | **already red and blue** | which box they belong in |

That needed one token. `--c-unknown` aliases `--ink-3` the way `--c-reference`
does, and grey is right *here* for the same reason it is wrong for
`--c-nonevent`: this one really is absence of information, and it has to lose to
both outcome colours beside it.

**The ghost had to come back to full, which the fixed 0.22 never did.** A faint
ghost was correct when the boxes started EMPTY and wrong the moment they started
full: the run then took a bright box and left a washed-out one, saying *these
people left* louder than an empty box ever did — the precise thing the ghost was
invented to prevent. Faint only while the dot is genuinely in transit.

### Round eleven, part two: four layout defects, all measured

**A panel gets `half - 14` = 233px, not the 247 it looks like**, and at
`STEP_DX = 34` the two boxes alone spanned 242. So the boxes overflowed their own
panel and the step-2 heading crossed the dashed divider into the next one.
`104 + 25 + 104 = 233` exactly.

**Step 2 is "then count" in both panels now**, and that is not a saving. The
counting is the same act in both designs; the only thing that differs is which
margin you fixed, so putting all the asymmetry in step 1 says so. What gets
counted is on the boxes directly beneath. Any left-aligned step 2 also starts
**1px** after step 1 ends — step 1's phrase is 128px over a 104px box — so it is
right-aligned to the panel edge.

**The closing copy's last line was painted 12px BELOW the canvas floor**, where
it is invisible and unhashable. It spelled out both death rates, which are
already on screen twice: under each panel and again in the readout tiles. A
caption that restates the readout costs lines and buys nothing.

**The calculation figure sits 40px higher.** `FLOOR` and `RULE_Y` moved together,
so every gap between the pile, its sentence, the fraction and the cards is
unchanged; what was removed was a band of nothing between the strip's rule and
the top of the tallest pile the figure can draw — **fixed at both ends, so dead
in every state** rather than headroom consumed in some. The arm heading came down
with it, from 82px above the pile it names (128px at a 50/50 split) to a fixed
baseline just clear of the highest a dot ever goes. Fixed, not tracking its own
pile: the two arms are different heights, so a heading following its pile puts the
two titles at two heights and reads as broken.

**And "the two exposure groups" is gone.** It sat below the strip's rule, so it
captioned nothing above it, and 128px above the piles it was meant to name. Its
job — the generic word on the figure — belongs to the strip's step 1, which now
reads `1 recruit by EXPOSURE` exactly as the design tab does. That step heading
had been a **ternary whose two branches were identical**: the case-control
wording was meant to differ and had collapsed, so the strip called an
outcome-recruited group an exposure.

**Measured, not judged:** 882 cohort states and 1,020 case-control states swept
at the 550px canvas across both ratios and all three enrolments — zero overflows,
zero collisions, worst baseline 692 against a 718 canvas.

### Round eleven, part three: THE SHIP BLOCKER IS GONE

The handover named it rather than deferring it quietly (5.6): `check.mjs` demands
a driven fingerprint state from any widget declaring an `animation`, and the
harness could only press `.w-drive .w-btn[data-key=…]`. Widget 12 declines Play
and Step on the calculation tab (4.5) and eases on a segmented toggle (4.4), so
**its transitions had no coverage and could not have any.**

Taken the better of the two routes the handover offered — teach the harness to
drive a control:

- `controls.js` stamps `data-param` on every settable control and `data-value` on
  every segmented button. Nothing in the shipped page reads them.
- A `choice` slider also carries `data-options`, because its DOM value is an
  **index**; without it a spec would have to name a position, which is the exact
  thing 5.7 forbids.
- A drive spec may now say `{ set: { against: "risk" }, frames: 6 }`. Both forms
  work in `before` steps and one step may do both — a set THEN a click, because a
  control chooses what the button will run.
- `check.mjs` needed no change: it only ever required `drive.frames > 0` and no
  `shown=`.

Proved end to end rather than assumed: setting `against` to `risk` at 60/30
yields six frames of ease whose middle frame prints `= 73%` — a denominator
genuinely mid-flight, which no settled state can reach — settling to `60% ÷ 30%`
22 frames later.

**All 78 pre-existing fingerprint states MATCH** after all four core changes
(`tokens.css`, `env.js`, `controls.js`, and the harness). Widget 12 is still
unbaselined, deliberately: the order of work puts baselining after the design is
agreed, and this round changed the design.

### Round twelve: why anyone runs a case-control, and prose that names the quantity

**"The case-control panel still doesn't explain why you'd ever do one."** Fair,
and the tab creates the problem itself: it spends its whole space showing that a
case-control's death rate is set by the enrolment ratio and its risk ratio
estimates nothing, so a reader who stops there concludes — reasonably, and
wrongly — that nobody should run one. That is the opposite of what `05-05` needs,
where students are handed odds ratios from case-control studies and logistic
regressions for the rest of their careers.

**One line each, as a pair rather than as a defence.** The limitation sits on the
design that has it and the remedy sits opposite at the same baseline, so it reads
across:

| | |
|---|---|
| COHORT · recruit by exposure, then wait | *a rare outcome needs a very large cohort* |
| CASE-CONTROL · recruit by outcome, then look back | *you enrol the cases directly, however rare* |

The other reasons — long latent periods, cost, many exposures against one
outcome — are prose and belong in the lesson. This is the one the figure's own
counts already support: 200 followed to observe 40 deaths, against 40 enrolled
straight away.

**A limitation to name rather than hide (5.6):** the widget *states* this and
cannot *demonstrate* it. Its own cohort is 200 people with a 20% death rate,
where a cohort is perfectly feasible. Demonstrating it needs a base rate low
enough that a cohort is impossible, which is a fourth control on a widget already
told three times it has too many.

### Round twelve, part two: the copy names the quantity

**Reported directly:** *don't use words like budget etc… please don't mix
metaphors. use statistical language where possible and don't editorialize. use
the simplest way to explain intuitively.*

That killed "a fact about your budget", which was **added in round eleven** —
a metaphor doing a statistician's job. The quantity has a name. The pair is now:

| | |
|---|---|
| cohort | *you counted this — it is the incidence* |
| case-control | *you set this — it is controls per case* |

37 characters each, measured: every version that ran to 43 wrapped with a single
word underneath. Same fix for *"the cohort does not know who dies"* — a study
design does not know things — now *"the outcome has not been observed yet, which
at recruitment is true of the cohort and not of the case-control"*; and for the
readout's *"your controls-per-case ratio, nothing else"*, where "nothing else"
was a verdict rather than a mechanism.

### Round twelve, part three: the enrolment ratio, researched rather than guessed

Asked whether the notches should become 2:1 · 1:1 · 1:2, and whether real studies
use one control per case or more.

**They stay 1:1 · 1:2 · 1:4, and the literature is the reason.** 1:1 is the
textbook default — for a fixed TOTAL sample, equal groups maximise power. Above
it you fix the cases and add controls, and precision reaches about `r/(r+1)` of
what unlimited controls would give: **50%, 67%, 75%, 80%** at 1, 2, 3, 4, which is
the plateau the classical ceiling of four comes from (Ury 1975; Taylor 1986).
**Below 1:1 is not a design anyone runs** — cases are the scarce half and controls
the cheap one — so a 2:1 notch would teach a study students will never meet. (The
one real exception: large-scale genetic association studies use 10+ controls per
case, because their significance threshold is extreme enough that the plateau does
not bind. Not PHM5003 material.)

**What the question really found is that the control is inert at the opening
table**, and necessarily so:

| | 1:1 | 1:2 | 1:4 |
|---|---|---|---|
| 20 / 20 — the default | RR 1.00 · OR 1.00 | 1.00 · 1.00 | 1.00 · 1.00 |
| 40 / 20 | RR 1.64 · OR 2.62 | **1.96** · 2.71 | 2.20 · 2.66 |
| 60 / 30 | RR 1.87 · OR 3.45 | 2.32 · 3.54 | 2.71 · 3.50 |

With no effect every enrolment gives 1.00 and only the death rate moves. Once
there IS an effect the existing three notches already cross the truth — the swing
was never missing, it was gated behind making an effect first. So the notches did
not change and **the detail lines now carry the efficiency in numbers**, which
means the control teaches something even at the opening table where it moves no
ratio at all.

### Round thirteen: a copy sweep, and paragraphs became lines

**"Looks like a wall of text."** It was: the design tab's closing copy ran four
sentences across five wrapped lines, and nothing in a wrapped paragraph tells the
eye where one claim ends and the next begins — so a reader takes all of it or
none. Every explanatory block is now **one claim per line**, via a `textBlock`
helper that also takes an empty string as a half-height gap. The constraint is
its own editor: a claim that will not fit one line is too long.

The design tab's rest state was a key all along, so it is shaped like one:

| before | after |
|---|---|
| four sentences, 4 wrapped lines, ending "Press Run both studies." | `Two studies of the same source population. Neither one is the population.`<br>`Heavy box = a group the investigator recruited — a count chosen, not measured.`<br>`Grey = the outcome is not yet observed. At recruitment, that is the cohort only.`<br>`Steps 1 and 2 are the order you did things, not the order they happened.`<br>*(gap)*<br>`Press Run both studies.` |

And the case-control caption became four aligned rows — `Enrolled:` /
`Death rate:` / `Risk ratio:` / `Odds ratio:` — so the three quantities can be
read against each other instead of extracted from a paragraph.

### Round thirteen, part two: every editorial tail cut

A sweep of all on-screen copy against principle **2.9**. Four captions ended with
the widget admiring its own point, and cutting them cost no information:

| cut | from |
|---|---|
| *"That is the odds scale showing you its edge."* | everyone died in both arms |
| *"and this is where that stops being an abstraction"* | one arm with no survivors |
| *"That gap is what 'the odds ratio overstates' means…"* | the main cohort claim |
| *"and you choose which"* | the case-control claim |

Four more were verdicts or personification rather than mechanism:

| was | now |
|---|---|
| NOT AN ESTIMATE OF ANYTHING — the population's is 2.00 | does not estimate the population's 2.00 |
| estimates the population's 2.67 — this is the one you can report | estimates the population's 2.67 |
| effect that is not there | more effect than the risk ratio shows |
| The risk ratio **followed you** … the odds ratio **did not follow you** | Risk ratio: 2.00 in the population, 1.64 here … Odds ratio: 2.67, 2.62 here |

Two more went for redundancy rather than tone. *"That is the whole difference"*
is the paragraph talking about itself; and *"only one of the two death rates
below is a finding"* is now said per panel, attached to the number it is about,
so repeating it in the closing block bought nothing. The reading-order note moved
into the key, where a legend's facts belong.

Also unified: the calculation tab's strip said *"start with the exposure, then
wait"* where the design tab said *"recruit by exposure, then wait"* — one study,
one vocabulary (5.8 applied to words).

**Swept: 616 calculation states and 330 design states** (165 of them genuinely at
rest, with a Reset between) at the 550px canvas — zero overflows, zero
collisions, nothing leaving its own panel. Deepest 709 against 718, and 476
against 512.

### The mock-ups, and one retired

| page | status |
|---|---|
| `_lab/denominators.html` | **live.** Settled candidate A — the survivors step aside — and the division graphic underneath it. Both are in the widget |
| `_lab/simpler-2x2.html` | **panel A live, panel B superseded and bannered.** Panel A settled the shape: you set the four counts, the ratios are outputs. Panel B's *which side did you fill in first* framing survived; its thinning arithmetic did not |
| `_lab/study-design.html` | **retired and deleted** |

`study-design.html` settled four things and all four are in the widget and in
this entry: read left to right **by step** rather than by chronology; a **ghost
stays behind** in the recruited box; the boxes are **full at rest** so the
sliders visibly drive them; and the groups move **one pass at a time**. What was
left in the file afterwards was the superseded thinning model — a page that
teaches a case-control wrongly is worse than no page, and the repo keeps records
of *cut designs*, not of wrong arithmetic.

### Why this goes next, ahead of `ppv-prevalence`

The handover pointed at `ppv-prevalence` as the highest-evidence deferred item,
and it still is. This one goes first anyway, on four counts that are checkable
rather than aesthetic:

- **Two confirmed lesson slots**, where `ppv-prevalence` has none.
  `04 / 04-08 — Comparing Counts Between 2x2 Categories`, effect-size section;
  and `04 / 05-05 — Modeling: Categorical Outcome`, which derives `exp(bₙ)` as an
  odds ratio and hands students one to read. No other widget but
  `confidence-interval` has two.
- **It fixes a live error in the course's own material** — see below. Same
  evidence shape that earned `power-and-error` its slot.
- **It completes 04-08 rather than duplicating it.** That lesson has two halves.
  The first — Fisher's exact test as a permutation null over a hypergeometric —
  is already served twice, by `permutation-test` and by widget 11's
  hypergeometric panel. The effect-size half has nothing.
- **It builds the machinery `ppv-prevalence` needs.** Both are a natural-frequency
  2×2 whose lesson is a denominator nobody looked at, and `imbalance-metrics` is
  the same grid a third time with *predictions* on the columns. Per the rule in
  Shared machinery, the seam is not cut here — the second consumer tells you
  where it belongs, and that is `ppv-prevalence`.

### What building it settled

**The base rate and the risk ratio are `display` parameters, which looks like a
violation and is not.** `display: true` means exactly one thing to core:
recompute, call `animation.rebuild`, keep the student's work — an overlay is a
consequence of that meaning rather than the meaning itself. The data rule exists
because a pile built from *other samples* is a lie about what was drawn, and
nothing here is drawn: the table is exact arithmetic on two settings and the
animation is a progressive **reveal** of it. Getting this wrong costs the widget
its point — the gesture it exists for is *pin the effect and walk the base rate*,
and under the data rule that gesture wipes 200 followed-up patients at every
notch. Found by a sweep that reported all 72 states wrong, because every one of
them was the empty figure.

**The follow-up animation was built and then cut.** The cohort arrived ten
patients at a time, which put a stopwatch on the part of epidemiology nobody
watches: you get the 2×2 at the end, already complete. What is genuinely in
motion is the **reading**, and that is where the frames went instead.

That needed **two core additions**, both written up as principles 4.4 and 4.5.
A `display` parameter could not animate, because for an overlay a jump is
correct — but these two settings are two readings of the same data, and the
deaths must be *seen* not to move while their denominator does. And there was no
way to have an animation without a Step button, which after the cut had nothing
to step. All 78 pre-existing fingerprint states MATCH after both changes.

**The `easing` flag has to be consumed, not merely read.** First written as
`if (anim.easing) startAnim("ease")`, which left the flag set for the whole
transition — so every display change mid-ease stopped and restarted the loop.
Found by a sweep whose own control-poking was doing exactly that, and which
therefore measured mid-ease values and reported 56 states wrong.

### The visual answer to *why a risk ratio needs a cohort*

The design view now argues it rather than stating it, in three marks.

**A heavy bar locks the margin the design fixed** — rows for a cohort, columns
for a case-control. The one you fixed is a number you *chose*; the one left free
is a number you *measured*. The caption says so in the same words at every
setting: *everything inside a bar is a group you assembled*.

**The pairing rectangles ease between the two groupings.** `(a/b)/(c/d)` and
`(a/c)/(b/d)` are the same four numbers regrouped, and a jump would let a reader
think they are different data. The rule falls straight out and is the thing to
carry away: **a ratio survives the sampling when both its terms come from the
same enrolled group.** A risk divides a case count by a case-plus-control count,
so it crosses; an odds *within* a column does not.

**And the risk moves while the slider does.** At baseline 20% with RR 2, keeping
one control in five takes the risk of dying from **0.40 to 0.77** — with not one
patient's outcome changed. That is the proof rather than the illustration: a
quantity that shifts when you change your own enrolment is not one you measured.
Meanwhile the cohort's within-column odds are 2.00 and 0.75, and the sample's
are 2.00 and 0.75 — identical, at every base rate, with no rare-outcome
assumption anywhere in it.

**Controls come in whole people, and the invariance is only exact when they
divide.** Thinning by round(b/k) is exactly invariant in **66 of 90**
combinations; the worst drift is **28.6%** at baseline 30% with RR 3, where the
exposed arm has ten survivors and a quarter of them is 2.5 people. Rounding
quietly and still claiming "unchanged" would be a claim that holds at the default
and not at the ends, which is not a claim. So the figure says what happened, and
names the cause as the rounding rather than the study being small — at baseline
1% the drift is 1% on **99** controls, which is not a small study by any reading.
The default (20%, RR 2) is exact at every *k*.

**Prose on a canvas has to be wrapped by whoever paints it.** The verdict line
ran **163px past a 770px canvas** and looked completely fine, because a
surface-coloured stroke erases what it overruns rather than blending. 288
instances across the design view's 180 states, none of which any hash would ever
catch. `wrapText` now owns it, and the strip's right-aligned note measures where
the coloured labels actually finished rather than predicting it.

**`--c-event` and `--c-nonevent` added to `tokens.css`**, the gap the mock-up
flagged. `--c-extreme` was the nearest role and means something else — past a
threshold, which a 2×2 does not have — and the group roles are spoken for by the
other axis of the same table. `--c-nonevent` is deliberately **not** grey: it is
the odds' denominator and the whole lesson is that it shrinks, so drawing it as
furniture would hide the one quantity that moves. All **78 existing fingerprint
states MATCH** after the core change.

**Verified by assertion, not by screenshot: 252 states swept at the 550px
canvas** — 72 in the denominators view and 180 in the design view — every printed
ratio and every fraction checked against an independent computation, with no
overflow, no collision and nothing blank.

### The lesson states it wrongly, and the numbers say so

`04-08` cell 40, on the ICU table `a=24, b=60, c=16, d=100`:

> Here, the odds of death in infected patients is 2.5:1 = 5:2 … for every 5
> patients who died with infection, there were 2 who died without infection

The odds of death in infected patients is 24/60 = **0.4, i.e. 2:5**. 2.5 is the
odds *ratio*, which is not an odds. And the death counts are 24 and 16, i.e.
**3:2**, not 5:2. The bullet takes the OR, narrates it as an odds, then
re-narrates it as a head-count ratio across groups — the two confusions the
widget exists to dislodge, in one sentence, in the lesson that hosts it.
**This needs fixing in `../jupyterbook/phm5003` as well as here.** Cell 44's RR
reading is correct, and `05-05`'s "higher odds" phrasing is correct.

### The evidence, which is unusually good

- [Holcomb et al. 2001](https://pubmed.ncbi.nlm.nih.gov/11576589/), *An odd
  measure of risk*: **26%** of OB/GYN papers surveyed asserted an "X-fold risk"
  from an odds ratio, and in **44%** of those the OR–RR gap exceeded 20%.
- [Schulman et al. 1999](https://www.nejm.org/doi/full/10.1056/NEJM199902253400806)
  and the Schwartz/Woloshin/Welch correspondence: referral 90.6% vs 84.7%,
  **OR 0.60, RR 0.93**. National media reported "40% less likely"; the truth was
  **6.5%**, a 6.5× exaggeration of the reduction. The NEJM editors published a
  mea culpa for allowing the odds ratio into the abstract.

### The measurements, taken before anything was drawn

**Holding the effect fixed at RR = 2 and moving only the base rate.** The
student changes nothing about the effect and the odds ratio runs away:

| baseline risk | 1% | 5% | 8.3% | **13.8%** | 20% | 30% | 40% |
|---|---|---|---|---|---|---|---|
| OR | 2.02 | 2.11 | 2.20 | **2.38** | 2.67 | 3.50 | 6.00 |
| overstatement | 1% | 6% | **10%** | **21%** | 33% | 75% | 200% |

Two things this settled. The familiar rule of thumb — *under 10% and OR ≈ RR* —
is **exactly the 10% overstatement line**, at a baseline of 8.3%. And **the
lesson's own example is already past it**: the ICU table's baseline is 13.8%, a
21% overstatement, so the widget does not need a contrived case to make its
point — it needs the one the notebook already uses.

**Thinning the controls, on the same table.** Keep every case, keep 1 in *k*
survivors, which is what a case-control study does:

| controls kept | infected | uninfected | RR | OR |
|---|---|---|---|---|
| all | 24/60 | 16/100 | 2.07 | **2.5000** |
| 1 in 2 | 24/30 | 16/50 | 1.83 | **2.5000** |
| 1 in 5 | 24/12 | 16/20 | 1.50 | **2.5000** |
| 1 in 10 | 24/6 | 16/10 | 1.30 | **2.5000** |

Both groups' odds multiply by exactly *k*, so the ratio cancels; the two risks
multiply by **different** factors (2.33× and 3.22× at 1 in 5), so their ratio does
not. That is the answer to *then why use an odds ratio at all*, and it is
visible rather than asserted.

**Relabelling the outcome.** OR(death) = 2.5, OR(survival) = 0.4 — exactly
reciprocal. RR(death) = 2.07, RR(survival) = 0.83, and 1/2.07 = **0.48**. So
*"twice the risk of dying" does not mean "half the chance of surviving"* — for the
risk ratio.

**~~The flip ships, the transpose does not.~~ Reversed.** Transposing the table
was filed as one symmetry too many. It is not a symmetry, it is **the mechanism
of view 2** — see the design section below. It ships.

### Which design permits which measure, and why — the corrected version

The rule is **not** cohort versus observational. A cohort study *is*
observational unless it is an RCT, and a **retrospective cohort is still a
cohort**, where RR is fine. The line is **case-control versus everything else**,
and one question draws it: *did the sampling fix the outcome column?*

| design | investigator fixes | free to be measured | RR? |
|---|---|---|---|
| RCT / cohort, prospective **or** retrospective | the **rows** — who is exposed | the outcome split within each row | ✅ |
| cross-sectional | only the grand total | both | ✅ (prevalence) |
| **case-control** | the **columns** — how many cases, how many controls | the exposure split within each column | ❌ |

In one sentence: **you may only compute a proportion whose denominator is a group
you deliberately assembled.** A case-control's "risk of dying" is a number you
chose when you decided to recruit two controls per case.

**Why the odds ratio escapes, which is a better fact than "it approximates the
RR".** Read the ICU table *down the columns* — the only direction a case-control
can see — before and after keeping every case and 1 in 5 survivors:

| | full cohort | case-control |
|---|---|---|
| odds of infection **among the dead** | 24/16 = **1.5000** | 24/16 = **1.5000** |
| odds of infection **among the living** | 60/100 = **0.6000** | 12/20 = **0.6000** |
| ratio | **2.5000** | **2.5000** |

Not approximately equal — **identical**, and not only the ratio but each odds on
its own. Thinning scales the whole survivor column by 1/5 and odds computed
*within* a column cannot feel it. The row-wise risks meanwhile go 0.286 and 0.138
→ 0.667 and 0.444, and RR 2.07 → 1.50.

The bridge is `(a/b)/(c/d) = (a/c)/(b/d)` — the same four numbers, regrouped.
**The odds ratio does not know which variable is the cause**, so *odds of exposure
among cases vs controls*, which is all you can measure, **is** *odds of outcome
among exposed vs unexposed*, which is what you wanted. That is the entire reason
case-control studies work, and it is **exact at every base rate** — no rare-disease
assumption anywhere in it.

Keep that separate from the rare-disease claim, which is weaker and comes later:
the OR you recovered is exact, but reading it *as a risk ratio* is the step that
needs the outcome to be rare.

**A second correction for `04-08`.** Cell 47's Caution says *"In retrospective
studies, we often do not know the population at risk, as the exposure is usually
not known."* Two things: it should say **case-control**, not retrospective — a
retrospective cohort is fine — and in a case-control the exposure is precisely
what you go and ascertain. What is unknown is the population at risk.

### The figure — the denominator is the thing that moves

Each exposure group is a column of people. Press **Risk** and the red fraction is
measured against the *full column*. Press **Odds** and the survivors slide out
into a **second pile**, so the same red is now measured against a pile that
shrinks as the outcome gets common. That split is the whole mechanism: at a 1%
baseline the survivor pile and the whole column are indistinguishable, which is
**the rare-outcome approximation as something you can see** rather than a rule
with a threshold attached.

Below, both ratios on **one log axis with 1 marked**, per 2.7 — adjacency is the
argument. Slide the base rate and the RR marker stays pinned while the OR marker
walks away.

Two views on one segmented control, per widget 11:

| view | what it does |
|---|---|
| **Two denominators** | the split, the divergence, and the flip toggle |
| **Why the odds ratio** | thin the controls; RR collapses, OR does not move a digit — then read the same table **down the columns** and find the two numbers a case-control actually computes untouched by the sampling |

The second view is why the widget is not an argument that the odds ratio is bad.
It ends on **which measure is honest is decided by the design, not by taste** —
which is also what `05-05` needs, since logistic regression hands students an
odds ratio whether they wanted one or not.

### Decisions taken at planning, so they are not re-argued

- **The risk ratio is the control; the odds ratio is derived.** Setting the
  effect *as an RR* is what makes "you did not change the effect and the OR
  changed" a demonstration rather than a coincidence. The base-rate slider is
  capped so the exposed risk stays below 1.
- **No risk difference, no NNT.** 04-08 does not teach them, and a third mark on
  a two-mark axis dilutes the one contrast the widget exists to make. Deliberate
  non-goal; the clinical case for reporting it is real and belongs in the lesson
  prose, not here.
- **Thinning is deterministic, not sampled.** The point is the structural
  invariance, not sampling noise — importing noise here imports widgets 2–5 into
  a widget that is not about them. A note says real sampling adds noise on top.
- **The Fisher's-test half of 04-08 is out of scope**, being already served twice.

### Open before building

Presets. The ICU table is the host lesson's own and must be one. Schulman is the
**case that fails** (2.6) — a protective direction at a 90% base rate, where the
OR is a *worse* liar than anything a slider reaches. A third, rare-outcome case
where the two coincide is the control condition. Whether these are a `choice`
control or three `?shown=` links is a layout question for the mock-up.

**Mock up before implementing** (5.1). The one thing no argument settles is
whether the column-splits-into-two-piles motion reads as *the denominator
changed* or as *dots moving*. **Built, and A chosen:**
`widgets/_lab/denominators.html` — four treatments in lockstep over the same
pinned RR = 2.00, with the base rate on a segmented control so the two ends can
be judged against each other. **A** steps the survivors aside, **B** draws both
denominators as brackets and never moves, **C** is A without the people, and
**D** is the 2×2 and four numbers — what every existing tool does, on the page as
the baseline to beat rather than as a straw man.

**Settled: A, and it carries the division underneath.** The towers answer *what
is it measured against*; they do not show the arithmetic, so the figure now
writes the fraction out with the same people as its two terms, ten to a row. The
numerator is the deaths and is **identical in both readings**. The denominator is
everyone, and moving to odds makes it **shed its red dots one at a time** until
only survivors remain.

That drop-out earns its place by showing something no wording had: **risk's
numerator sits inside its denominator and odds' sits beside it**, which is the
reason only one of the two can pass 1. At a 30% base rate the exposed group reads
60 ÷ 40 = **1.50**, and a risk never could. The ratio is written as a division
too — `odds ratio = 4.00 ÷ 0.67 = 6.00` — so both levels of the calculation are
on screen.

**The shedding is discrete, one person per step, not a fade.** A half-faded dot
belongs to neither term, so a denominator interpolated to 76 is a number
describing nothing — 2.8 asks the readout to report what has actually been
collected, and 4.3 warns that a frozen half-faded mark reads as *marked* rather
than as leaving. Shedding whole people keeps the printed count equal to the dots
on screen at every frame, and both counts are read off the block that was just
drawn so they cannot drift from it.

**B, C and D stay on the page** at their original height and without the
fraction. Deciding by looking is only honest while the alternatives are still
there to look at.

Two open questions the fraction raises, for the projected review: whether its
duplication of the towers costs more than the fraction form buys, and whether 100
dots are countable or texture — 2.3 wants a countable thing and 100 per group is
what makes *out of 100* a natural frequency, and those pull opposite ways.

Two things the build settled on the way:

- **There is no token for *the outcome happened*.** `--c-extreme` is the nearest
  and means something else — past a threshold, which widget 12 does not have —
  and `--c-group-a`/`--c-group-b` are spoken for by the two *arms*, which is the
  other axis of the same table. A 2×2 widget needs both pairs at once, so
  whatever is added must not collide with the group roles. Probably
  `--c-event` / `--c-nonevent`.
- **The fillText sweep cannot see two strings colliding inside the canvas.** It
  found two real left-edge overflows and a `1 deaths` plural, then passed a
  ratio label sitting on top of a group title — both comfortably within the
  canvas bounds, so every extent was legal. A screenshot caught it in one look.
  The sweep answers *does anything run off the edge*; it does not answer *does
  anything run into anything else*, and the harness now checks the second too,
  grouped by canvas — grouping by y alone pairs each string with its twin in the
  cell next door.

## Widget 14 · `linear-regularization` — SHIPPED

**Moved here from HANDOVER on 2026-08-26**, which was the only place it lived —
the catalogue jumped from widget 12 to widget 15. HANDOVER is current state and
the next task; this is the record, so this is where it belongs.

### What the core contract gained, at widgets 14 and 15

**Widget 15 added three CSS roles and nothing else** — `.w-link-eq`,
`.w-link-row` and `.w-links`, for the card above its figure. No new parameter
type, no new `widget.js` hook. The full suite was run once afterwards and all 113
pre-existing states matched, which is the only thing that run was for.

The eight below are widget 14's, each its own commit, each verified with a full
105-state run.

| what | where | why |
|---|---|---|
| `type: "readback"` | `params.js`, `controls.js`, `tokens.css` | a case table in the rail naming which of a few labelled outcomes the controls above it produce. A non-parameter spec entry, exactly like `section`: carries no value, never reaches the URL |
| **`type: "matrix"`** | `params.js`, `controls.js`, `tokens.css` | a labelled grid of shaded cells, one option per cell, for a parameter that is a **pair**. Declares `rows`, `cols` and a `token`; each option carries `row`, `col` and `shade`. Arrow keys move the selection from one focus stop, which is what lets it replace a 156-option dropdown rather than sit beside one |
| **a height may be a function of the WIDTH** | `canvas.js`, `widget.js` | `resize(heightOf)` resolves it, because the width is knowable before anything is painted and the height is not. For a panel that has to stay **square** — widget 14's plane is only allowed to be square, so wider costs taller |
| `regions` | `widget.js`, `canvas.js` | clickable targets on the canvas, resolved to a parameter. **Declared by no widget now** — kept for SVM's support vectors and the tree widget's nodes, which are figure-native |
| `pointAt` / `hitTest` | `canvas.js` | pointer event → drawing coordinates; the region under a point |
| the exported `setParam` syncs | `widget.js` | it is the door that is NOT a control, so it must tell the rail |
| a checkbox's `detail` renders | `controls.js` | 3.4f, third time |
| `<optgroup>` runs in a `select` | `controls.js` | the 156-option keyboard path, before the matrix replaced it |

Four of these have a subtlety worth not rediscovering:

**A `matrix` cell's shade is an opacity on a CHILD element.** Fading the cell
fades the selected cell's ring with it — brightest exactly where it is least
needed.

**A `matrix` arrow step that lands on a non-option keeps going; one that runs off
the edge does not wrap.** So the ends of the grid are findable by feel, and the
diagonal — a measurement against itself is not a pair — is skipped rather than
stopping you.


**`readback` takes a `live` FUNCTION where `when` must stay declarative.** `when`
is declarative so core can avoid rebuilding the control block on every change —
rebuilding mid-drag drops the slider you are holding. A readback rebuilds
nothing; it swaps two class names. So a predicate is safe there and only there.

**`regions` allows exactly ONE parameter per region, checked at load.** Two would
paint an intermediate state nobody asked for, write the URL twice, and — the
reason that matters — make the click a *different transaction* from the one a
fingerprint state performs, so the harness would be verifying a sequence the
reader never takes. A pair of variables is one parameter, not two.

---

### The widget itself

Hosts at PHM5005 `04-3 Tour of Algorithms`, section 1. Its four-row table —
linear / ridge / lasso / elastic net against α₁ and α₂ — is read as four
algorithms. They are four settings of one objective, which the notebook prints
two lines above that table.

Two dials on a shared ladder, a readback in the rail naming which of the four you
are in, a labelled 13×13 correlation matrix in the rail as the pair selector, the
fitted equation as MathML in a card above the figure, thirteen coefficient bars
across the full width, a conditional-slice coefficient plane, and a
predicted-against-measured panel. **Canvas height is a function of the width**
(`ROW_TOP + panelSide(w) + ROW_BOTTOM` — 423px at the narrow frame, 541 at the
wide) because the two panels have to stay square. No animation, no seed, no
`shown`.

What remains is the fingerprint question at the top of this file, then the
shipping steps under *Then*.

### The design decisions, so they are not re-argued

- **Layout D2**, chosen from a four-way mock-up: equation on top, bars full
  width, then the plane and the predictions as two squares of equal standing.
  **The squares fill the row** (P3 of four in `_lab/linreg-panel-width.html`) and
  the canvas is however tall that makes it — they are square because the
  diamond has to look like a diamond, so wider costs taller. The 228px cap they
  used to carry left 206px of the row empty at the wide frame.
- **The matrix is in the RAIL, as core's `matrix` control**, chosen as C4a from
  two rounds of `_lab/linreg-matrix-rail.html`. It replaces a 156-option
  dropdown rather than sitting beside one: the dropdown's 66px of rail is the
  difference between a grid smaller than the canvas's and one half again bigger.
  **Both axes named in full**, the columns turned ninety degrees — at 45° the
  names cleared each other by 2.3px against an 11px type size, at 90° by 7.8px.

  It was on the CANVAS first, placement M1 of four, unlabelled because thirteen
  row names plus thirteen rotated column names cost more room than a 150px grid.
  What moved it was a measurement nobody had taken: the rail is 444px against a
  654px stage, so it had 210px of slack, and it is 300px wide against the 150px
  the canvas could spare. Cells went 11.5px → 17.8px *with* the names, and the
  bars got 174px of width back.
- **All 156 ordered pairs, not 78.** `(i, j)` and `(j, i)` are the same two
  measurements with the axes swapped, and which is horizontal is a real
  difference on screen. The four-pair slider it replaced reached elongations
  1.09–4.77:1; the matrix reaches 1.01:1 (Age against Weight, r = 0.013 —
  contours so nearly circular that the diamond and the circle become the same
  shape, which is the case where the L1/L2 distinction stops mattering) and
  5.73:1 (Weight against Hip). Neither end was reachable before.
- **The readback sits in the rail, not on the figure.** It reports the two dials
  directly above it, and 2.7 puts a reading next to what produced it. On the
  canvas it also painted over the Forearm and Wrist bars and only looked clear
  because those two coefficients happen to be small.
- **The plane is a CONDITIONAL SLICE** of the full thirteen-feature fit: the
  other eleven held where they were fitted, the pair free. An earlier build
  fitted a separate two-feature model and the panels then disagreed about
  Abdomen — 8.80 against 10.27 — because those are different models, not
  different views. The slice is exact, not approximate: a coordinate-descent
  fixed point IS the statement that the solution is already optimal in any subset
  of coordinates given the rest. Profiling the other eleven out instead is
  wrong — at a lasso solution their gradients are not zero, they equal the
  subgradient, so a profiled contour is tangent to nothing.

---

---

## Widget 15 · `logistic-regression` — SHIPPED

### 2026-08-29 · ONE COVARIATE — the second one cut on Kenneth's call

Kenneth, reviewing post-ship: the two-covariate BMI/age stage may confuse —
05-05's cell 4 introduces the logit as `log(p/(1−p)) = b₀ + b₁x`, ONE
covariate — and the sigmoid should be SEEN spanning 0 to 1. Three candidates
were measured and mocked (`_lab/logistic-1cov.html`,
`_lab/logistic-1cov-measure.py`): `CHD ~ age` (a ramp — fitted p spans
0.04–0.41, p = 0.5 at age 74.8 off the data, and only 6 of 4221 impossible
under the straight line, so BOTH lessons go flat), the built-and-cut
`prevalentHyp ~ sysBP`, and synthetic dials. **Kenneth picked B and cut the
BMI + age stage entirely** — "do not retain the existing BMI + age as it
would complicate things. the main point is the link function."

**What the rebuild is**: the same three-rung ladder (probability · odds ·
log-odds, the strips, the raw 0/1 bands, the binomial-CI binned dots, the
link toggle, the equation card with the logit inset) on
`glm(prevalentHyp ~ sysBP)` — fitted p spans **0.0003 → 1.000** so the S
saturates at both ends on screen; the straight line leaves 0 below 111 and 1
above 179 mmHg, making **794 of 4240 people (18.7%) impossible** with no
setting that hides it (the old CHD version needed the held slider pulled to
a corner to show 37); the fitted 50% lands at **141.6 mmHg against the
clinical 140** — a self-check; OR per mmHg exp(0.14110) = **1.1515**. The
equation card now reads cell 4 verbatim with the fitted numbers:
`log(p(Y)/(1−p(Y))) = −19.98 + sysBP × 0.141`.

**Cut with the second covariate**: the axis picker (`xvar`), both held
sliders, the lit-term equation switching, the "adjusted for" material — and
with them the old open item about a marginal-vs-conditional note, which a
one-covariate model no longer needs. **Kept live**: one `at` slider reading
what one mmHg is worth at a chosen pressure (the third lesson — constant
only on log-odds). One new guard the new data forced: **a Δ strip only
counts steps whose values are ON its own panel** — odds reaches ~20 000 at
the right edge, and one runaway Δ flattened every visible bar with a scale
line reading 4146.9. Data facts: the aggregate is by DISTINCT sysBP value
(234 values, 4240 people), proven a sufficient statistic — fit from
aggregate ≡ fit from rows to 1e-8; the 6 patients above the 215 mmHg axis
are in the fit and off the display. All four fingerprint states re-recorded
via `_lab/logistic-shoot.html` (copy proved 4/4, triples stable); two old
state URLs died with `xvar`/`age`/`bmi` and were replaced.

**Round 2 (same day)**: the link toggle went checkbox → pill button on
Kenneth's ask, and the source comments were cut to their load-bearing whys.
The rail is outside both hashes and the shooter re-ran to prove it — all
four states byte-identical.

**Round 3 (same day), from Kenneth's annotated screenshot**: "what one mmHg
is worth" rephrased ("where the one-mmHg step is read"); the card's links
row CUT ("log → hazards, counts" not relevant here); and his two design
calls — **the control became a segmented `Link function: Identity | Logit`**
(a GLM as a choice of link, 05-05's own framing) and **toggling it EASES the
fitted curve** from the straight line into the sigmoid (~0.6 s, core's
ease-request door; the widget's first `animation` block — stepLabel and
runLabel both null, the ease is its one motion). Every step bar and printed
number is computed from the BLENDED fit, so no label is false mid-frame; the
caption and the risk-difference note flip at the halfway point; the OR tile
prints only once the ease lands. **The equation card follows the chosen
link**, each side wearing its OWN fitted numbers — identity shows
`p(Y) = −1.63 + sysBP × 0.0146`, logit shows cell 4's line — because
printing the logit's coefficients over an identity fit is a claim the figure
does not make. Tiles renamed *Identity link* / *Logit link*. Re-recorded
(copy 4/4, triples): **all four settled `px` hashes IDENTICAL to the
pre-ease recording** — the ease lands exactly on the pictures the toggle
used to jump to — `tx` moved with the wording, and one driven mid-bend state
(`set link=logit`, 8 frames) went in non-inert. The old
marginal-vs-conditional open item died with the second covariate.

The record below is the TWO-COVARIATE design's, kept for its decisions —
the axis opening, the strips, the three-rung argument — most of which
survive unchanged in the rebuild.

### REDESIGNED AFTER REVIEW — this supersedes the staging notes below

Shown as a built draft and the verdict was *"I don't get the intuition, what is
the dataset?"*, with an arc to replace it: **(1) what happens when you predict a
0/1 outcome with ordinary linear regression, (2) why we add the link to squash
it into (0, 1), (3) how that makes the coefficients odds** — and, after a first
rebuild, *"let's match 05-05 if possible"*: `CHD ~ BMI + age`, both covariates
shown, and the logit function drawn somewhere.

**The dataset question was a defect, not a question.** The figure showed 3658
dots and named none of them. The caption now says what they are before anything
happens: *Framingham · 3658 people · did they develop heart disease within ten
years?*

**Step 1 needed the axis opened and the held slider to drive it.** Measured
first: over the whole sample the linear probability model only makes 37 of 3658
people impossible, and the worst is −0.032, which is easy to dismiss. But the
defect belongs to the LINE, not to the sample, and the held covariate is what
walks it out of the box:

| held at | the straight line is negative | worst |
|---|---|---|
| BMI on x, age 32 | **below BMI 29.1** — most of the axis | −0.063 |
| Age on x, BMI 18 | below age 37.2 | −0.050 |

So **the probability axis runs from −0.18 to 1.18 with 0 and 1 ruled**, because
an axis stopping at the boundary clips away exactly the thing step 1 exists to
show, and the readout reports where the line crosses rather than a headcount.
That last part was a correction: at BMI on x with age held at 32 the count read
*"3058 people"*, which is everyone under BMI 29.1 and none of whom is
necessarily 32 — a conditional printed as a fact.

**Either covariate goes on the x axis.** One control doing two jobs: it is how
the reader sees the second coefficient at all — `exp(0.07581) = 1.0788` for age,
`exp(0.03532) = 1.0360` for BMI, both the notebook's — and it is *adjusted for*
as a picture, since holding the other covariate elsewhere shifts the intercept
and changes the slope not at all. Both sliders are always present, because the
model has both; whichever is on the axis is where the step is read.

**The link is drawn, not only named.** The card above the figure carries
`f(y) = b₀ + b₁x₁ + b₂x₂`, then `logit(p) = log( p / (1 − p) )`, then a small
inline SVG of the logit itself — the curve that takes (0, 1) and stretches it
over the whole real line, which is the only reason an unbounded straight line
can live there. Named as an equation it is a definition; drawn, it is the
reason.

**Two acts, not three, and that is a claim rather than a saving.** *Fit a
straight line*, then *Add the link*. Squashing on the probability scale and
straightening on the log-odds scale are not two things in sequence — they are
the same change of scale, so every panel changes on the same press.

**A second data set was built and cut, and the numbers are kept in case this
reads flat.** `prevalentHyp ~ sysBP` is the only pair in the file whose
probability spans 0.003 to 0.960; there the same straight line makes **684
people (18.7%) impossible and predicts 269%**, its fitted 50% point lands at
**141.4 mmHg** against a clinical threshold of 140 — a self-check the reader can
perform — and because hypertension crosses p = 0.5 its probability strip is a
**hump** rather than the half-story ramp CHD can manage. It went because
matching 05-05 matters more.

**What survived:** three panels abreast (layout B), the floor strips, the
framework row above the figure (F1), the fixed corner for the step's number.
**What went:** the 38-step walk, replaced by reading the step wherever the
slider is; and the bin-width control, which multiplied by the step unit and gave
the second data set 50 mmHg bins.

**EVERY CONTROL IS A DISPLAY PARAMETER, and getting that wrong was invisible in
every check that had been run.** Reported as *"I change the sliders and nothing
happens"* — and nothing was the wrong word for what was happening. The data is
3658 fixed people and the coefficients are fixed constants, so no slider changes
what the numbers ARE; each only chooses which slice of one model is drawn. Marked
as data parameters, every one of them **reset the animation**: press *Fit a
straight line*, press *Add the link*, move any slider, and both curves vanished
and the drive row went back to the start. Non-negotiable 3, exactly — an overlay
that discards the reader's work is a bug — and `anim` here holds no derived state
at all, so `display: true` costs nothing and no `rebuild` is needed.

It survived a 308-state text sweep because a sweep reads the strings on the
canvas and every string was legal; it survived the readout checks because the
readout was correct for the stage it had been reset to. **The check that finds it
is a canvas hash across a parameter change with the stage read beside it**, which
is what the fingerprint harness does per state and what no amount of text
checking will do.

**And the fix removed a slider rather than relabelling one.** Reported next as
*"is there supposed to be some sweep or animation?"* — there was not, and the
read point should never have been a parameter. Widget 8's precedent settles it:
a swept position is `anim` state over precomputed data, with no control of its
own, because an animation that wrote a parameter would make the slider and the
figure disagree about where the reader is (non-negotiable 1). So the read point
became `anim.cursor`, **Play walks it the length of the axis** and the strip
fills in behind it, and the only slider left is the covariate being HELD — which
is gated by the segmented control, so it never has to explain which role it is
in.

That freed the drive row and pushed *Add the link* onto a checkbox, which is
where it belonged: **it wants to be reversible.** Flipping it off and on is how
the reader sees this is one set of data read two ways rather than a second
model, and a one-way drive button cannot do that.

**The reversible toggle then paid for itself twice over.** Because the steps are
read off whichever fit is showing, the two silhouettes SWAP:

| | probability strip | log-odds strip |
|---|---|---|
| straight line | **flat** — +0.95 pp at every step | curved |
| with the link | a ramp — +0.33 pp to +1.83 pp | **flat** |

A straight line asserts the risk DIFFERENCE is constant; the link asserts the
LOG-ODDS difference is. Which assumption you are making is what the checkbox
picks, and the flat strip is which one you picked. That was not designed — it
fell out of computing the steps from the active fit, three lines — and it is now
the clearest thing on the figure.

The odds-ratio tile reads `—` while the link is off, deliberately: a straight
line has no constant one, and quoting exp(b) there would be quoting a
coefficient the model on screen does not have.

**Three more from the same review, each mocked up in
`_lab/logit-card.html` and chosen from four:**

- **M1 — the equation is 05-05's own line, in MathML**, fraction and subscripts
  and all, with **the term on the x axis lit** (M4's addition). Which covariate
  is being stepped and which is held is a fact about the equation, so 2.7 puts
  the reading next to what produced it. One `<math>` per term, `form="infix"` on
  every sign, and a `<math>`-against-`<math>` capability probe — all three
  lessons inherited from widget 14 rather than rediscovered. The separate
  general form went: `log(p/(1−p)) = …` **is** the link on the left-hand side,
  shown concretely, and the links row underneath already names the framework.
- **L4 — the drawn link is transposed, and that is a deliberate break with
  convention.** Every textbook plots p on the horizontal axis; every panel under
  this card puts it on the vertical one, and *"the axis for p in the formula box
  is 90 degrees to the probability graph below"* is the cost of following the
  convention inside a 132px inset. p runs up the side here too, and the reader's
  current two probabilities are marked on the curve — which turns the card from
  a definition into a reading. L3, two tied rulers, is conceptually the closest
  thing to what the panels below actually do and was cut on measurement: at
  132px its labels collide.
- **S3 — the strip names its quantity and carries a scale.** *"When I step, what
  increases in the bars?"* was unanswerable: the row label read `step`, which
  names what CAUSED the change rather than what is measured. The rows now read
  `Δ p`, `Δ odds`, `Δ log-odds`, and full height carries its own value once, so
  every other bar can be read off it. Each strip is still scaled to its own
  largest, because the three quantities share no unit — the scale line is what
  makes that legible rather than arbitrary.

**THE THREE PANELS HAD A JOB AND NEVER SAID IT, which is why they read as
decoration.** Four questions from review — *"if I don't add the link then all the
graphs don't make sense, so should I always add it?"*, *"fitting a straight line
only makes sense for probability, i.e. we assume the 0/1 outcome is
probability?"*, *"why do I need to log it — doesn't 0/1 map to p/(1−p)?"* and
*"where does the binomial family fit?"* — and the middle two are the answer to
the outer two.

**The three panels are the two bounds coming off one at a time.** That is the
answer to *why log it*, and the widget was not giving it:

| | range | what is still wrong |
|---|---|---|
| p | 0 to 1 | bounded at **both** ends |
| p/(1−p) | 0 to ∞ | ceiling gone, **floor still at 0** |
| log(p/(1−p)) | −∞ to +∞ | both gone |

**Odds is only half the fix**, and it is asymmetric in a way the numbers make
plain: p = 0.01 gives odds 0.010 and p = 0.99 gives 99, two symmetric
probabilities and wildly asymmetric odds; take logs and they are −4.595 and
+4.595 again. So each panel's header now carries its **range** rather than its
expression — the expression names the scale, which the title already did — and
each panel **rules the bounds it has**: two on probability, one on odds, none on
log-odds, where the emptiness is the point.

The odds floor needed the axis opened below 0 to be visible at all. At `lo = 0`
the rule lands on the plot's own bottom edge and reads as the axis, which hides
the single fact the middle panel exists for.

**Least squares on a 0/1 outcome fits the probability itself**, and the caption
says so now. `E[Y|X]` for a binary Y **is** `P(Y = 1|X)`, which is why a fitted
value outside 0 and 1 is a defect rather than a curiosity: the model has already
called it a probability.

**The family is drawn, as intervals on the binned dots.** Link and family are
two choices — the link is the scale the mean is linear on, the family is how
each observation scatters around it — and `family = "binomial"` is why R hands
you the logit without being asked, it being binomial's canonical link. On screen
the family is what says **how far a dot should be from the curve**:
1.96·√(p(1−p)/n) is 4.9px at the 461-person bin and 20.9px at the 139-person
one, so the sparse bins visibly wander and the dense ones do not. The interval
is computed in probability space and then transformed, never a standard error
transformed — on the log-odds panel a bar of equal length either side of the dot
would be wrong at both ends.

*Earned on the way:* with the link off the step is read off the straight line,
whose probability can be negative — and **a negative probability has no logit**,
so the card's two dots have nowhere to go. Writing `NaN` into an SVG `cx` is a
console error; hiding the dot is the lesson.

**THE STAGES AND THE SWEEP ARE BOTH GONE, and the widget is four controls.**
Reported as *"I get confused which one comes first"* and *"maybe don't need the
step and animation — we'll let the student vary the BMI or age to see how it
maps to probability"*. The staging was mine, not the material's: fitting a
straight line and then adding a link is a sequence I imposed on a figure whose
subject is a MAPPING, and a reader who has to remember which button they already
pressed is spending attention on the widget rather than on the model.

So: no lead, no step, no Play, no `shown`. The straight line is always drawn
because it is the foil, the link is a checkbox, and both covariates are live
sliders — whichever is on the axis is where the step is read, the other is held.
The reader varies two numbers and watches the mapping, which is the whole of it.
The sweep added two turns earlier went with it; it was asked for, built, and
then read as a fourth thing to operate.

**The two lines were the same colour and nobody could tell them apart.**
`--c-extreme` is `#e34948` and `--c-theory` is `#eb6834` — eleven degrees of hue
apart, and at a 1.5px stroke in either theme they are one line. The straight
line is the FOIL, the thing being compared against rather than a result, so it
takes `--c-reference` and dashes: grey dashed against solid orange, which no
reader has to decode.

**The formula looked squashed, and a fraction is why.** An `<mfrac>` renders
about 2.2× the base size, so at the 1.55 line-height inherited from `.w-math`
the line box is shorter than the thing inside it and two wrapped lines close up
on each other. `line-height: 2.3` on `.w-link-eq` clears it, set there rather
than on `.w-math` so the links row keeps its own spacing. Card height is 121px
and constant across all 120 reachable states — the figure never jogs (3.4d).

**"How can one show the mapping from the outcome (0/1) to the link function?"
— there is no such mapping, and saying so is the answer.** The link does not
transform the outcome; it transforms the MEAN. `logit(0)` is −∞ and `logit(1)`
is +∞, so an individual observation has no place on the other two axes at all.
What gets transformed is `E[Y|X]`, which for a binary Y is `P(Y = 1|X)` — and
the only way to SEE that mean is to group, which is what the binned proportions
are. The figure had been making this point solely by omission (the raw dots
appear on one panel and no other), so the caption band is now two lines and the
first says it outright: *a single 0 or 1 has no odds, so what the link
transforms is the proportion.*

**There is no training and no convergence, and that is the decision rather than
an omission.** The coefficients are fixed constants — the notebook's printed
output — and *Fit a straight line* is instant because fitting is a computation,
not a reveal. IRLS converging is a real animation, and widget 8 already owns
*likelihood, one candidate at a time*; an iterative fit here would be a second
widget in the first one's clothes, and the claim on this figure is about the
link rather than about the search.

**Verified.** 308 states swept with the `fillText` wrapper across both frames,
both covariates, six BMI values, five ages and all three stages — no overflow,
no collision, no NaN. `tokens.css` gained `.w-link-eq` / `.w-links` /
`.w-link-row`, so the full fingerprint suite was run: **113 of 113 MATCH.** No
states of its own yet; it is a draft and the design is still moving.

### Scope: logistic, not a GLM with a family selector

Asked at planning — should this be *generalized linear models* as a whole, with
logistic as one setting on a family selector? **No, and the reason is a count
rather than a taste.** The course fits exactly one family.

Every `family =` in PHM5003, counted:

| family | where | covariates? |
|---|---|---|
| `binomial` ×6 | `05-05`, `06-01` (through `glmulti`), `07 Summary` | yes |
| `negbinomial` ×1 | `02-02`, as `brm(count ~ 1, …)` | **no — intercept only** |

The single non-binomial fit has no covariate, so it has no `β₁`, no `exp(b)` and
nothing to read through a link at all. It is the Bayesian parameter-estimation
lesson using NB as a *distribution* — widget 9's host, not a regression.

`07 - Summary` cell 24 is the other half of the count. It is the course's own
**Build model** table, the thing a student consults to choose a model, and it has
four rows: continuous → `lm`, binary → `glm(family="binomial")`, time-to-event →
`coxph`, hierarchical → `lmer`. **No count row, one glm family.** A family
selector would carry two or three options the course never asks anyone to fit,
and each would need a dataset the course does not supply.

**The idea's second instance is `05-06`, and it is not a GLM.** The very next
lesson writes `h(t) = h₀(t)·exp(β₁X₁ + …)`, then `ln(h/h₀) = β₁X₁ + …`, and says
out loud that this is *the familiar linear combination of predictors on the RHS,
similar to what we see in multiple linear regression*. It then runs the same
`modelsummary(exponentiate = T)` line and reads the same forest plot with a
reference at 1, and `exp(b)` is a hazard ratio for the identical reason. Cox has
no family, no `glm()` and an unspecified baseline hazard, so **a family selector
would exclude the best second instance the course has.**

**PHM5005 teaches the same model with no GLM framing at all**, which argues for a
logistic widget and against a GLM one. `04-3` §2 is `z = Xw + b` then `σ(z)`,
minimising cross-entropy, deciding at `p ≥ 0.5` — no odds, no link, no `exp(b)`:

| | PHM5003 `05-05` | PHM5005 `04-3` §2 |
|---|---|---|
| form | `log(p/(1−p)) = β₀ + β₁X` | `z = Xw + b`, then `σ(z)` |
| direction | p → link | link → p |
| objective | binomial likelihood | cross-entropy |
| what you read off | `exp(b)`, an odds ratio | a class, at `p ≥ 0.5` |

They are the same function read in opposite directions, and cross-entropy **is**
the binomial log-likelihood. One logistic widget serves both hosts; a family
dropdown is meaningless in `04-3`.

**The case for the unified frame is real, and it is a case for two instances
rather than for a mode.** Comparing two cases beats studying them one at a time
for abstracting the schema — studied singly, cases are encoded concretely and
retrieved later on surface similarity ([Gentner, Loewenstein & Thompson
2003][gentner]). But that result is about comparing **instances**, and the
instances this course has are logistic and Cox, not logistic and an invented
Poisson. No empirical study was found comparing unified-first against
instances-first teaching for GLMs: the literature is normative on the frame and
silent on the sequencing, so the misconception above is graded `inferred`.

So the framework **is** on screen, as one labelled row rather than as a mode —
see *Decided* below. And **widget 16 is Cox, at `05-06`**, where the same figure
returns and `exp(b)` is a hazard ratio. That is the comparison the result above
actually asks for, and it is why widget 15's spine must not be binomial-specific.

Poisson and negative-binomial regression are parked with no host; see *Deferred
from PHM5003*.

[gentner]: https://groups.psych.northwestern.edu/gentner/papers/GentnerLoewensteinThompson03.pdf

### What the lesson fits, to the digit

- **Data:** the Framingham study,
  `https://raw.githubusercontent.com/kennethban/dataset/main/framingham.csv`.
  4240 rows, 16 columns.
- **Model:** `glm(TenYearCHD ~ BMI + age, data = data, family = "binomial")`,
  after `data %>% drop_na`.
- **Printed coefficients**, from the notebook's own `broom::tidy` output. A
  widget that does not reproduce these to the digit is wrong:

  | term | estimate | std. error | p |
  |---|---|---|---|
  | (Intercept) | **−6.54292372** | 0.407430778 | 4.9e−58 |
  | BMI | **0.03532089** | 0.011176590 | 1.6e−03 |
  | age | **0.07581313** | 0.005744181 | 9.0e−40 |

- **The odds ratios it derives:** `exp(0.035) = 1.036` for BMI,
  `exp(0.076) = 1.079` for age.
- The lesson closes with a `modelsummary` table at `exponentiate = TRUE` and a
  `ggcoefstats` forest plot on the OR scale with a dashed line at 1.

### Measured before anything was designed

Four measurements, all from the notebook's own CSV, fitted by IRLS in plain JS.
Two of them changed the shape of the widget.

**1. The row set is 3658, and `BMI` is not why.** `drop_na` runs on the **whole
sixteen-column frame** before the fit, so the row set depends on columns the
model never uses: `glucose` has **388** missing and `education` 105, against
`BMI`'s 19. Complete cases across all sixteen columns is **3658**.

- On those 3658 rows the fit reproduces the printed table to all eight digits,
  and the standard errors to seven.
- Dropping NA on `BMI + age + TenYearCHD` only gives n = 4221 and
  **−6.27495 / 0.03162 / 0.07226** — visibly not the notebook's numbers.

So *agreeing with the printed table* is a real self-check rather than a
tautology, and it is the cheapest one the widget has.

**2. Inlining costs 40KB, and subsampling is not available.** 3658 rows of
`(BMI, age, TenYearCHD)` as a flat delimited string is **39,868 bytes**; as JSON
arrays, 47,240. `linear-regularization` already inlines 252 rows this way inside
a 63KB `main.js` — same shape, five times the size. Subsampling would break
measurement 1, which is the whole self-check, so it is not a saving that is
available.

**3. The upper bend of the S is off-data — and the widget is better for it.**
Fitted p over the 3658 rows runs **0.034 to 0.523**, median 0.127. At median BMI,
p = 0.5 is not reached until **age 74.5**, and the data stops at 70. The reader
never sees the curve flatten at the top.

What is reachable is the whole argument anyway, with no extrapolation:

| age step, at median BMI 25.38 | p | Δp | odds × |
|---|---|---|---|
| 32 → 33 | 0.038 | **+0.0029** | 1.0788 |
| 50 → 51 | 0.135 | +0.0091 | 1.0788 |
| 70 → 71 | 0.416 | **+0.0185** | 1.0788 |

**The same coefficient, the same odds ratio to four decimals, and a 6.4× spread
in the risk difference** — which is widget 12's finding arrived at from the other
direction, and the reason an odds ratio is one number while a risk ratio is not.
Any design that needs the flat top has to leave the data to get it.

**4. Binned age proportions are usably straight on the logit scale, and two bins
are undrawable.**

| bin | n | events | rate | logit |
|---|---|---|---|---|
| 30–34 | 20 | 0 | 0.000 | **−∞** |
| 35–39 | 461 | 21 | 0.046 | −3.04 |
| 40–44 | 753 | 57 | 0.076 | −2.50 |
| 45–49 | 685 | 81 | 0.118 | −2.01 |
| 50–54 | 610 | 108 | 0.177 | −1.54 |
| 55–59 | 533 | 122 | 0.229 | −1.22 |
| 60–64 | 456 | 116 | 0.254 | −1.08 |
| 65–69 | 139 | 52 | 0.374 | −0.52 |
| 70–74 | 1 | 0 | 0.000 | **−∞** |

The two end bins have no events, so they go to −∞ and cannot be plotted at all.
That is not a nuisance to be trimmed — it is **the ±∞ point, free**, and it is
the same reason a raw 0/1 outcome cannot be drawn on a log-odds axis either.


Three more came out of drawing it, in `widgets/_lab/logistic-scales.html`. All
three change something.

**5. The +1 step on the probability panel is SUB-PIXEL at the young end, in every
layout.** 0.4–0.7px at age 35 against 2.2–3.5px at 68, and a taller panel does
not rescue it: A's 224px panel still gives 0.8px. So **the gap cannot carry that
half of the argument — the printed number has to**, which is why the step's
number gets a slot of its own rather than a position beside the marker. It is
also not a defect: 0.36 percentage points on an axis that runs to 1 *is*
invisible, and that is the claim. The risk is only that invisible reads as
broken, and a number next to it is what stops that.

**6. The odds rung is a different curve, not a halfway house.** Probability is an
S, odds is convex, log-odds is straight — three shapes, not three degrees of one
bend. That is what makes the middle rung worth a panel instead of a step to skip
past, and it was not obvious until it was drawn.

**7. With age on x the whole figure costs 356 bytes, not 40KB.** The raw strip is
fully determined by the 39 `(age, n, events)` triples, so measurement 2's
39,868-byte inline is only needed if a covariate other than age goes on the x
axis. Worth knowing before the data is pasted in.

### Decided at planning, so they are not re-argued

- **The common framework is on screen, and it is a labelled ROW, not a mode.**
  `f(μ) = β₀ + β₁X`, with the links the course touches named beside it —
  identity → `lm`, **logit → this widget**, log → hazards and counts — and the
  current one lit. What it exists to make visible is *where the link lives*:
  **on the left-hand side**, applied to the mean, so the right-hand side is the
  same linear model the reader has already fitted four times. It carries no
  value, never reaches the URL and is not a control (3.5) — a `readback`-shaped
  row, like widget 14's.

  **It goes ABOVE THE FIGURE at the full stage width** — placement **F1** of
  three, and the measurement is one-sided. At 550px the full wording is one line
  and 58px tall. In the rail's 300px it wraps to two lines and 79px (F2), and the
  only way to get it back to one line there is to drop what each link is *for*
  (F3), which is the entire content of the row.
- **The spine is family-agnostic on purpose.** *Straight on one scale, curved on
  another; a constant `b` on the link scale is a constant multiple on the
  response scale.* Nothing in that sentence is binomial, so widget 16 reuses it
  rather than re-arguing it — which is the whole reason the scope note above
  refuses the family selector but keeps the framework.
- **It opens empty on the PROBABILITY scale: the raw 0/1 outcomes, no fitted
  curve.** That is the problem statement — 3658 points at two heights and no line
  that could go through them — and it is the lesson's own order, `p → odds →
  log(odds)`. The alternative was to open on the log-odds scale with only the
  binned proportions, so their straightness is the reader's own observation; that
  is the better reveal but it starts on the answer. Trying the first (agreed with
  Kenneth); the second is the fallback if it reads flat.

  **With B this got stronger rather than weaker.** The opening state is three
  axes, the raw outcomes on the first, and nothing on the other two — so the
  first thing the reader sees is that *the data cannot be drawn on two of these
  three axes at all*. That is the problem statement and the ±∞ point in one, and
  it costs nothing.
- **Two covariates, age on x, BMI held.** Fitting age alone gives a different
  coefficient and measurement 1 dies. The conditional slice is **exact and
  trivial** here, unlike `linear-regularization`'s: the model is linear in the
  link, so holding BMI fixed only shifts the intercept. Moving the BMI slider
  shifts the log-odds line vertically by `0.03532 × Δ` and slides the S-curve
  horizontally along age. Same fact, two appearances — which is *adjusted for
  BMI* as a picture, at no cost.
- **Three scales, THREE PANELS, no control.** Layout **B** of four in
  `widgets/_lab/logistic-scales.html`, chosen by Kenneth over the one-panel
  control (A), the two-stacked switch (C) and the three-stacked full-width (D).
  Probability, odds and log-odds beside each other, 114px per column at the
  narrow frame. Planning had assumed a control on one panel; the mock-up says
  otherwise, and the reason is that **the comparison is the argument** — three
  rungs in sequence is a thing to remember, three rungs abreast is a thing to
  see. It is also what the Gentner result in the scope note above asks for.

  What travels across all three is the binned proportions; what does **not** is
  the raw 0/1 strip, which is at ±∞ the moment you leave the probability scale.

  **B was the most expensive of the four to make legible, and the three fixes
  are part of the decision:**
  - **Tick density follows the panel, not the figure.** Eight labels 64px apart
    at 486px are the same eight 15px apart at 114px. The text sweep calls that
    legal — every extent is inside the canvas — and the eye calls it a smear.
    Under 300px the ticks go every ten years.
  - **The ±∞ fact is a caption for the figure, said once.** Per panel it did not
    fit in a 114px column, so it silently vanished from both of the panels it is
    about, which is worse than not saying it.
  - **The step's number has a fixed corner** rather than following the marker.
    At 114px the +1 bracket is **3px wide** and is not a bracket. The quantity
    was always the number, and a fixed bottom-right slot makes B's three panels
    read as a row of three: `+0.91 pp`, `×1.0788`, `+0.0758` — of which exactly
    one is a constant you would quote. It is stroked surface-coloured first,
    because on the probability panel the band of zeros runs through that corner.
- **The fitting is not shown.** IRLS converging is a real animation and widget 8
  already owns *likelihood, one candidate at a time*. The claim here is about the
  link, not about the fit; an IRLS pass would be a second widget in the first
  one's clothes. Consequence: no animation, therefore no driven fingerprint
  states — same as `linear-regularization`.
- **No forest plot.** `ggcoefstats` on the OR scale with a line at 1 is the
  lesson's last figure, but widget 12 already owns odds ratios on a log axis with
  1 marked. Spending a panel to restate it makes widget 12's point worse. The
  readout naming `exp(b)` for whichever covariate is stepped is enough.

### Open, for the mock-up

- **Which covariate the +1 step applies to, and whether that is a control.**
  Stepping age *walks along* the curve; stepping BMI *shifts* the curve. Both are
  `exp(b)` on the odds scale, so the pair shows adjustment as a picture — and it
  may be one idea too many for one figure.
- **Whether the curve is drawn past the data.** Measurement 3 says the flat top
  is unreachable honestly. Either accept the one-sided story, or continue the
  curve beyond age 70 with the data range marked.
- **Bin width, and where the bins are ANCHORED.** Five-year bins give seven
  usable bins and two at −∞; ten-year bins give four, all usable. The undrawable
  pair is worth something (measurement 4), which argues for five. The mock-up
  also caught the anchoring: bins from the youngest age present start at 32 and
  there are then **no** zero-event bins, so the ±∞ point disappears. Anchored on
  multiples of the width — 30–34, 35–39, … , which is how a person bins — the two
  come back.
- **If a confidence interval is printed, say which one.** R's `broom::tidy(conf.int
  = TRUE)` — which is what `modelsummary` and `ggcoefstats` use — is
  **profile-likelihood**, not Wald. They are close and they are not equal, and a
  widget quoting Wald against the notebook's printed interval will look wrong.

## Deferred from PHM5003

Not dropped — parked, in the order I would revisit them. Each already has its
misconception named above the line in git history.

| slug | concept | why it was parked |
|---|---|---|
| `ppv-prevalence` | Predictive value vs prevalence | **The highest-evidence item in the whole catalogue is now deferred** — physicians report sensitivity *as* PPV, and most put P(disease \| positive) at 70–80% when it is far lower. It sits outside the resampling arc, which is a good reason to postpone it and a bad reason to forget it. **Postponed once more, deliberately**: widget 12 is the same natural-frequency 2×2 with two confirmed lesson slots against this one's none, and building it first builds the grid this needs |
| `count-regression` | Poisson / negative-binomial regression | **Parked with no host, and the measurement is in widget 15's scope note.** Every `family =` with a covariate in PHM5003 is `binomial`; NB appears only as a *distribution* (`02-01`, `02-02`), as a simulation device (HTD `03`), and inside `DESeq2` at `08 / 01-2`, where the student calls `DESeq()` and never writes a GLM. `08` is the slot it would earn, and the framing there is already sitting in the output: **`log2FoldChange` IS the coefficient on the log link**, and `2^LFC` is a fold change for exactly the reason `exp(b)` is an odds ratio |
| `regression-to-mean` | Regression to the mean | Attacks "responder" reasoning directly, but needs no resampling machinery |
| `interaction-effect` | Effect modification | The conceptual core of *precision*, but may be technical rather than abstract — see open question 4 |
| `censoring-km` | Censoring and Kaplan–Meier | Survival is its own arc; better built as a pair with `hazard-ratio` |
| `sd-vs-se` · `confounding-simpson` · `forking-paths` · `bayes-updating` | | as before |

`forking-paths` is worth noting as the natural #7 alternative: it is #6's lesson
applied to analytic choices rather than to formal tests, and it needs no new
machinery at all.

---

## The high-throughput arc — proposed 2026-09-01, from PHM5003 week 5

`05 - Introduction to High Throughput Data` is nine notebooks, and it is the
first PHM5003 week where **most of the widgets already exist**. Four of its nine
lessons have a shipped host, three of those built for PHM5005 and inherited.
Reading all nine end to end says the gap is **five slots**, and one of the five
is a hole in an arc this file already called complete.

The week is one continuous argument, and it is the omics pipeline in order:
*design it → find the holes → put the samples on one scale → look at it → find
out the machine did that, not the biology → fit when p ≫ n → stop believing
twenty thousand p-values → group what is left → say what the group means.*

### What is already covered — read this before proposing anything

| # | notebook | host widget | state |
|---|---|---|---|
| 01 | Review of Experimental Design | — | randomisation, blinding, replication. No widget proposed; `fork-pipe-collider` touches the confounding half. **Out of scope for this arc** |
| 02 | Missing Data and Imputation | **25 `missing-data`** ✅ | already recorded as this notebook's widget, cells 1–23 |
| 03 | Normalization and Transformation | — | **SLOT 1** |
| 04 | Dimensionality Reduction | **19 `pca`, 20 `mds`, 21 `t-sne`, 22 `umap`** ✅ | four of five headings. `## 2 NMF` has none — **SLOT 2** |
| 05 | Batch Effect Correction | — | **SLOT 3** |
| 06 | Regularization and Fitting | **14 `linear-regularization`** ✅ | ridge / lasso / elastic net. The notebook adds `p ≫ n` and `findCorrelation`; see the open call below |
| 07 | Multiple Test Correction | **6 `multiple-testing`** ✅ | prd §7 already names this notebook as its lesson |
| 08 | Hierarchical Clustering | — | `kmeans` and `dbscan` are different methods, and § *Widget 23* records that **this notebook mentions K-Means zero times**. **SLOT 4** |
| 09 | Enrichment Analysis | — | **SLOT 5** |

**Not one of the nine carries a widget link.** Grepped the whole `phm5003`
notebook tree on 2026-09-01: zero hits for `nusmedicine.github.io/statml`,
anywhere. So the four already-hosted lessons owe links exactly as the week-4
ones do — see HANDOVER § *NEXT* item 3, which this adds four rows to.

### The five slots

| # | slug | notebook | misconception | evidence | status |
|---|---|---|---|---|---|
| 1 | `normalization` | 05 / 03 | "normalising" makes data normal — that scaling and transforming are one operation with one purpose | reported | **SHIPPED 2026-09-02** |
| 2 | `nmf` | 05 / 04 `## 2` | NMF is PCA with the minus signs banned — a rotation, not a decomposition into parts you add up | reported | **proposed** |
| 3 | `batch-effect` | 05 / 05 | a batch effect is noise you subtract. The danger is **confounding**, and correcting a confounded design deletes the biology | documented — citation NOT yet verified | **proposed** |
| 4 | `hierarchical-clustering` | 05 / 08 | the dendrogram is a finding. It is a consequence of two choices and a cut, and pure noise produces a handsome one | reported | **proposed** |
| 5 | `enrichment` | 05 / 09 | a significant pathway is an activated pathway; and the p-value is a property of your gene list, when the **background** and the **cutoff** move it just as hard | reported | **proposed** |

**Slug rulings, on the precedents already in this file.** Kenneth renamed
`censoring-km → time-event` and `pseudoreplication → mixed-model` on 2026-08-28,
so the revealed rule is *name the method or the data shape, not the failure* —
which is why slot 1 is `normalization` and not `scaling-vs-transform`, and slot 3
is `batch-effect` and not `confounded-batch`. Slot 2 takes the bare algorithm
name because `pca` / `mds` / `t-sne` / `umap` already do and it joins them. Slot 5
drops its trailing noun by the `lm-categorical` ruling — shorter URLs read better
from a slide.

### Slot 2 earns its place by the rule that gave t-SNE and UMAP theirs

§ *NEXT · t-SNE* read `04 - Dimensionality Reduction`'s headings and settled
one-algorithm-one-widget by reading rather than by taste:

```
## 1. Principal Component Analysis (PCA)          cells  7–14   <- widget 19
## 2. Non-negative Matrix Factorization (NMF)      cells 15–23   <- NOTHING
## 3. Multidimensional Scaling (classical + NMDS)  cells 24–38   <- widget 20
## 4. t-SNE                                        cells 39–45   <- widget 21
## 5. UMAP                                         cells 46–53   <- widget 22
```

**So the dimensionality-reduction arc was declared closed with a gap in it.**
The closing note under § *After UMAP* moved on to PHM5005's clustering half and
never came back to `## 2`; the manifest's four DR widgets are four of five.

The lesson states the claim twice and both times in the same words — a
**parts-based representation**. `V ≈ W × H` with everything non-negative, `W`
holding the patterns and `H` how much of each pattern each sample carries. That
is a different object from PCA's rotation, and the difference is what the widget
is for: PCA's components are signed, orthogonal, ordered by variance and unique;
NMF's parts are none of those four. The notebook admits the last one itself —
cell 17's worked answer is "a possible outcome (depending on initialization and
optimization)" — so **the seed giving a different `W`, not merely a different
picture, is in the lesson already** and needs only to be shown.

### Slot 1 · `normalization` — SHIPPED 2026-09-02, four review rounds in two days

**Kenneth picked this slot first and then answered every question on
[`_lab/norm-mock.html`](../widgets/_lab/norm-mock.html) in one pass.** Recorded
here so they are not re-argued; the mock page carries the same list under § *The
picks*.

| # | question | ANSWER |
|---|---|---|
| 1 | the stage | **Depth spread is a slider**, default ±50%, and the reader can turn it to 0 — which *is* the notebook's stage. The control carries the idea directly: with no depth differences, every normaliser has nothing to do |
| 5 | the rail | **Two controls in sequence** — *1 · Normalize* then *2 · Transform* — and Box-Cox λ appears only when Box-Cox is chosen, via `when:`. The rail's shape is the argument (2.7) |
| 2 | panel 1 | **Boxplots**, the notebook's own figure. The median line is what the scale tile measures, so panel and readout answer one question in one unit |
| 3 | the axis | **Fit it, and print the range.** The labels read 0–468 before and 0–1 after, which is the half an autoscale throws away. The range ribbon and the Same/Fit toggle were both declined |
| 7 | counts or intensities | **Continuous intensities** — see the stage table below, which is where this pick had a consequence nobody predicted |
| 4 | panel 2 | **Raw axes.** Log–log loses 558 of 1000 genes the moment the reader picks Z-score, and the ρ tile already carries the number the slope would have |
| 6 | the readout | **Three tiles** — *Samples on one scale · Skew · Variance vs mean*. No single control moves all three, which is the argument in numbers |
| 8 | animation | **None, for now.** `linear-regularization` is the one precedent and is the closest structural sibling. The quantile procedure as an act stays a clean round-2 decision |

#### The pick at ask 7 forced a stage question, and the obvious answer was wrong

Boxplots plus intensities means quantile normalisation's one claim — *every
sample's distribution is now identical* — is something the reader checks by eye.
Log-normal was the obvious continuous stage. **Measured, it is degenerate.**

| stage | raw skew | raw ρ | quantile median range | ρ after log1p |
|---|---|---|---|---|
| `rnbinom` (the notebook) | 3.201 | 0.950 | **1.50 — the claim fails** | 0.432 |
| log-normal | 1.923 | 0.913 | 0.00 | **0.063 — circular** |
| **gamma** | **3.030** | **0.955** | **0.00** | **0.529** |

- **Counts cannot carry the claim.** 1000 genes hold only ~198 distinct values,
  ties dominate, and the medians still span 1.5 after normalising. Averaging the
  tied blocks instead of min-ranking gets it to 0.997, so it is the data's
  fault. And it does **not** go away by raising the count scale: `nbDraw` caps at
  `k = 4000`, which starts biting at U(50,500) — 62 draws saturated, 345 at
  U(100,1000) — while compute climbs 53 ms → 419 ms, past what a slider can feel.
- **Log-normal fixes the ties and breaks the lesson.** `log1p` inverts the
  generator almost exactly, so ρ falls to 0.063 and *the log stabilises the
  variance* becomes true by construction rather than demonstrated. Its raw skew
  is also only 1.923 — a much milder fan than the lesson's picture.
- **Gamma is the negative binomial's own mixing distribution** — the same
  gamma-Poisson model with the Poisson counting step left off. `shape = 1/disp`,
  `scale = μ·disp` gives mean μ and variance μ³/100, which is exactly the
  notebook's overdispersion term without its Poisson part. It keeps the
  notebook's numbers, collapses quantile normalisation to exactly 0, and is
  describable in one honest sentence.

#### BUILT AS A DRAFT the same day — and four defects the checks found

```bash
node scripts/serve.mjs 8011
# http://localhost:8011/widgets/normalization/                     (raw, unequal samples)
# .../widgets/normalization/?normalize=median                      (the staircase collapses)
# .../widgets/normalization/?normalize=minmax                      (0 – 1, and NOTHING else moves)
# .../widgets/normalization/?transform=log1p                       (the fan collapses, the staircase does not)
# .../widgets/normalization/?normalize=quantile&transform=log1p    (both, composed)
# .../widgets/normalization/?spread=0                              (the notebook's stage: nothing to correct)
node widgets/_lab/norm-verify.mjs      # 12 algebraic identities on the shipping engine
node widgets/_lab/norm-measure.mjs     # every number in this section
```

**The canvas text sweep and `norm-verify.mjs` between them found four things no
screenshot would have**, and two of them were false claims already written into
the source:

- **The scale tile's denominator was shift-sensitive.** It divided the range of
  the sample medians by the grand median, which survives a rescaling but not a
  shift — so z-score read **1.299** where raw and min-max read 0.717, three
  answers for three affine maps that all leave the samples equally unequal. The
  denominator is now the **pooled IQR**: a ratio of two differences, so it
  survives any `y = ax + b` exactly. Raw, min-max and z-score now agree to
  4.4e-16, and *that equality is the lesson*.
- **The panel printed the whisker range, not the data range**, so min-max read
  `0.010 – 0.245` instead of `0 – 1`. The axis is still fitted to p5–p95 so the
  boxes stay readable; the note now says where all the values are, which is the
  number the ask-3 pick exists to show.
- **Box-Cox after z-score silently deleted 6,729 of 10,000 values** and drew a
  figure from what was left. The notebook does this too — cell 25 ends
  `na.omit()` — and says nothing. The figure now prints the count and the
  reason, and the ρ tile counts the genes that survived rather than the 1000 it
  started with.
- **λ → 0 approaches log(y), not log(1+y)** — the source comment claimed the
  second, on a number borrowed from the integer-count stage where the smallest
  value is 0 and the "+1" barely matters. The gamma stage runs down to 2.35e-6
  with 0.33% of values below 1, which separates the three outright: log(y) skew
  −0.665, Box-Cox at 0.02 −0.446, log(1+y) −0.061. Dragging λ toward zero walks
  *past* the log(1+y) button rather than onto it.

Two smaller ones: `kept.map(quantiles)` passed the array index into the
quantile-list argument (map's second parameter), and the x-axis label "sample"
printed through the pipeline line — measured at y=388 x=[201..223] against
y=398 x=[46..223]. The label is deleted; the caption already says "per sample".

`_lab/norm-verify.mjs` is the record: 12 identities over 3 spreads × 3 seeds,
including the two that are **deliberately allowed to fail** — Box-Cox at λ = 1
is `y − 1` and must land back on the untransformed row, and it does for none,
median and quantile (1e-15) while breaking for min-max (1 value) and z-score
(6827). A claim true on three of five paths and silently false on the other two
is worse than no claim.

#### ROUND 1 — Kenneth, 2026-09-02: three questions, and the third was research

**1 · "Why doesn't the y-axis scale change when I try different normalization
methods?"** It did — raw `−11…288`, min-max `−0.016…0.413`, z-score
`−1.08…3.51` — but the question exposed a defect. The axis was fitted to
**p5–p95**, so **min-max's axis topped out at 0.41 rather than 1**: the one
method that states its own output range in its name never showed it. And
fitting each state to its own interquantile span **rescales the skew away**, so
raw and log(1+y) drew near-identical pictures while the tiles read 3.03 against
−0.06 — panel 1 was mute about the very thing panel 2 and the skew tile were
shouting.

Panel 1 now uses **Tukey whiskers with outlier dots and a full-range axis** —
`geom_boxplot`'s own grammar, and the notebook's own figure. Measured:

| state | box height, p5–p95 axis | box height, full axis | outliers |
|---|---|---|---|
| raw | 28% of the panel | **6%** | 683 of 10,000 |
| log(1+y) | 41% | **19%** | **55** |

So the transform's job is now visible *in panel 1*: a sliver with a dense tail
becomes a box filling a fifth of the panel, and the outlier count falls
twelvefold. Under the old axis the two states differed by 1.5×; they now differ
by 3×, and min-max's axis reads `−0.04 … 1.04`.

**2 · "Do we normalize → transform, or choose one or the other?"** **Both,
sequentially — and the course's own downstream notebooks are the evidence**, not
this lesson, which presents them as a menu and applies each to the raw data
independently (`data_normalized`, `data_standardized`, `data_vst` are all
`data_simulated %>% mutate(…)`).

| pipeline | order |
|---|---|
| `08 / 01-2` RNA-seq, DESeq2 | size-factor **normalisation** (`x_ij / SF_i`) → **`vst()`** variance-stabilising transform; the heatmap cell says "normalized and transformed data" |
| `09 / 02-3` metabolomics, tidymass | `normalize_data(method = "median")` → "Transform the values using log + 1" → "Scale the data" |
| `09 / 01-3` proteomics, tidyproteomics | `normalize(.method = c('median', …))`, best method selected on variance and dynamic range |

The canonical framing in metabolomics is the same three steps in that order —
normalisation is **row-wise**, transformation **element-wise**, scaling
**column-wise**.

**But MS proteomics commonly reverses the first two**: log2 first, *then*
median-centre, because the error is multiplicative, the log makes it additive,
and normalisation on the log scale is then a shift rather than a ratio.

**AND FOR A SCALING NORMALISER THE TWO ORDERS ARE THE SAME OPERATION.**
Measured on the widget's own engine: `log(y/m) = log(y) − log(m)` and
`median(log y) = log(median y)` because the log is monotone, so
median-then-log and log-then-median-centre agree to **2.3e-7 in skew and
exactly 0.0 in ρ**. The `+1` is what breaks it — with `log(1+y)` the same pair
differs by 6.5e-3. **The order only matters because of the pseudocount**, and
because quantile normalisation is not a scaling at all.

*Decision*: the rail keeps its fixed `1 · Normalize → 2 · Transform` order. It
is the dominant convention, it is what every pipeline in this course does, and
for the scaling methods the alternative is provably the same answer. An
order-reversal control would be a control that mostly changes nothing — 3.5.
The proteomics exception is recorded here rather than on screen.

**3 · "Depth difference is not taught in detail — simplify to something more
generic."** Done, using the lesson's own vocabulary: cell 1 names the problem as
"**Technical Variability**: Increased technical variations due to multiple steps
in high-throughput technologies". The control is now **Technical variation
between samples**, and the option details say "one sample's values run about
2.3× another's" rather than naming sequencing depth — which is one instance of
it, injected sample amount being another.

**A THIRD DEFECT CAME OUT OF FIXING THE FIRST, and it is the one worth
remembering.** `SHORT`, a `const` added at the bottom of `main.js` beside the
function that used it, sat in its temporal dead zone when `draw` ran — `draw`
executes synchronously inside `defineWidget`, which the module body has not
finished evaluating. Every render threw and aborted after panel 2. **The
collision sweep passed, because the two lines it would have collided with were
never painted.** A silent abort and a clean pass look identical, which is the
`resize`-repaint trap in a new costume. The sweep now asserts the *last* thing
`draw` paints is present in every state.

#### ROUND 2 — Kenneth, 2026-09-02: the picker, the formula, the quantile act

Mocked in [`_lab/norm-round2.html`](../widgets/_lab/norm-round2.html), which
builds every candidate with `core/controls.js` itself at both rail widths.

**1 · The picker stays split, and the measurement is the reason.** Normalize is
a `select` and Transform a `segmented`, which looked like an inconsistency:

| shape | rail | options | share each | widest label needs | |
|---|---|---|---|---|---|
| segmented | 250 | 3 | 75px | `log(1 + y)` 68px | fits |
| segmented | 250 | **5** | **45px** | `Min–max` **65px** | **no** |
| segmented | 300 | **5** | **55px** | `Min–max` **65px** | **no** |
| choice | 250 | 5 | ticks at 13/51/98/153/200 | 14px apart | fits |

Segments are `flex: 1`, so each gets an equal share whatever its label needs.
Shortening does not rescue it — 45px of button is about 29px of text and
`Min–max` is 49px — and nor does cutting an option, since four segments get
56px. The `choice` slider fits and is still wrong: 3.3 reserves it for options
forming a **magnitude**, and these five read 0.481 / 0.481 / 0.481 / 0.000 /
0.000 on the scale tile, which is a two-valued fact. **So the split is
load-bearing**: five long-named options cannot be a button group at any width
this layout reaches, and three short ones must not be a dropdown, because a
dropdown hides that a second operation is on offer at all.

**2 · The formula card.** One row per rail step, above the figure in the figure
column — so it survives into the exported PNG, which the rail does not. Both
rows always, greyed when the step is None, and the Box-Cox row prints the λ the
slider is actually on. Two things it settled the hard way:

- **The card jogged 23px** (60px to 83px across the 45 states) until the reserve
  went in, which is the fault "both rows always" was chosen to avoid. `7.8em`
  covers the worst case at the **narrowest** column, 535px, where the quantile
  row wraps to two lines. Flat at 86px at both 535 and 770 now.
- **The Transform row read "the samples are left as they are"** — the *other*
  step's claim, from a shared `none` string. Normalisation is about the samples;
  transformation is about the shape. Two strings now.

Quantile has **no closed form**, so its row carries the notebook's own three
steps as prose. That is also the argument for the third item.

**3 · The quantile act is built**, behind a `gate` below the two panels, on its
own six-by-four stage from the same generator, seed and technical variation.
Four phases — the table, rank within each sample, average at each rank, assign
back — with the cells **travelling between their gene row and their rank row**,
eased. That motion is the mechanism: quantile normalisation is the claim that a
value's rank is the only thing about it that survives, and 4.3 says motion
should read as the thing it depicts.

Three defects came out of building it:

- **The last phase never ran.** `if (phase >= last) return false` at the top of
  `advance` fired the moment the phase became 3, with `t` still 0, so the
  assign-back motion never played and the settled figure showed phase 2's
  picture under phase 3's caption. The terminal condition is the last phase
  **completed**, not reached.
- **The note printed through the column headers** — measured, the note's box ran
  441–452 and the headers' 442–454. The grid moved from `y0 + 44` to `y0 + 62`.
- **A separate payoff line was redundant with the phase note** and silently was
  not drawing. Its one distinct claim — *in a different order* — is folded into
  the note, because without it a reader can leave thinking the samples were made
  identical. They were not; only their distributions were.

**And `mathmlRenders()` moved into core first**, as its own commit — the third
copy was the trigger (5.8), and the full fingerprint suite read **275 of 275
MATCH** to prove the move changed nothing.

#### ROUND 3 — Kenneth, 2026-09-02: three placements, and one question with a number for an answer

**1 · "Why doesn't z-score centre the mean?"** It does, exactly — the pooled
mean is `0.0000`. The boxes sit at **−0.337** because a boxplot draws the
**median**, and on a table with skew 3.03 the median is a third of a standard
deviation below the mean. Nothing on screen said so, and a claim in a dropdown
label — *Z-score → mean 0, sd 1* — with no mark to check it against is a claim
the figure cannot support (2.11).

**Panel 1 now draws the pooled mean too**, dashed, over the solid median rule.
Both are `--c-reference` — both are the fixed benchmark the ten samples are
judged against — and the dash is the distinction, which is what `spanningRule`
already takes as an argument. What it buys:

| state | pooled mean | pooled median | gap, in sd |
|---|---|---|---|
| raw | 59.33 | 36.85 | −0.337 |
| z-score | **0.0000** | −0.3369 | −0.337 |
| log(1+y) | 3.6413 | 3.6335 | **−0.008** |

So the reader sees the mean land on 0 while the boxes stay below it, and sees
the two lines **converge once the log has taken the skew out**. The gap is a
second reading of the number the skew tile prints.

**The legend had no word for a dashed rule** — only `line` and `dot` — so two
references would have shown two identical swatches. `data-mark="dash"` added to
`tokens.css`, additive (nothing else sets it), suite **275 of 275 MATCH**.

**2 · The walkthrough's controls moved to the method that needs them.** The gate
now sits directly under the Normalize dropdown and appears only when Quantile is
chosen — quantile is the one method with no formula, so the walkthrough belongs
to that option rather than to the foot of the rail.

**The Step and Play buttons are gone entirely**, and that is the same call. Core
fixes the drive row at the foot of the rail (3.4e), which is right when the
buttons drive THE figure and wrong here: they would have driven one option's
sub-stage from three sections away. `afterDrive` cannot fix it either — **Reset
travels with the drive row** and would have landed mid-rail. So the walk is a
`step` choice slider beside the gate that opened it, and the motion comes from
**core's ease-request door**, the same one `logistic-regression` uses to bend
its fitted curve. Three things fall out: the control sits beside what it
controls (2.7), the widget declines drive buttons again (4.5), and **the walk is
in the URL** — `?normalize=quantile&act=1&step=3` — which a drive button cannot
do. `shown` was deleted; the parameter replaces it.

Rewriting the phase as **one continuous number in [0, 3]** also deleted round
2's worst bug by construction: a number easing toward a target has no last phase
to forget.

**3 · The walkthrough moved above the panels**, under the formula card — it is a
mock-up of how the method works, so it belongs where the method is explained
rather than under the result.

**Two sweep traps, both new, both the same family as the old ones.** An ease
running in the background leaks frames into the next state's capture, so
*every* string collided with **itself** — 80 findings, all spurious. And once
the act draws BEFORE the panel caption, slicing the buffer on that caption cuts
into the previous paint's tail, which reported `values -2.00 – 7.10` colliding
with `values -11.7 – 7.1`. A paint's boundary is the **last** thing it draws —
here the pipeline line — and nothing else is safe to split on.

#### ROUND 4 — Kenneth, 2026-09-02: the picker as a grid, and a comment pass

**The normalize picker is a 2 × 2 of buttons under a full-width None.** Round 2
measured five segments in one row as impossible — they get 45px and `Min–max`
needs 61 — and concluded a dropdown was the only option. That was true of one
*row*; a grid was not tried. Measured in
[`_lab/norm-picker.html`](../widgets/_lab/norm-picker.html):

| candidate | 250px cell | 300px cell | height | |
|---|---|---|---|---|
| 2 columns, 5 cells | 111px | 136px | 87px | fits, one empty cell |
| **None spanning, then 2 × 2** | **111px** | **136px** | **87px** | **fits, no empty cell** |
| same with the dropdown's full labels | 111px | 136px | 87px | truncates at 250 (`Z-score → mean 0, sd 1` needs 136) |
| 3 columns, 5 cells | 74px | 91px | 58px | fits, one empty cell |
| one row of five | 45px | 55px | 30px | truncates at both |

The winner costs 57px of rail against the dropdown's 30px and buys every option
visible at rest, which is what 3.3 asks for wherever the width allows. The
option details moved onto the buttons, so `Min–max` carries "rescale the whole
table to [0, 1]" as its detail line instead of in the label.

**Core gained `style: "grid"` on `segmented`**, plus `span: true` on an option
to take a full row — the two-column CSS, and nothing else changed. Suite **275
of 275 MATCH**.

**And a comment pass over both widget files.** Editorial phrasing out
(*"worse than no claim at all"*, *"the invariant working rather than a wart"*,
*"the trap in a new costume"*), invented labels out — `sortedness` became
`toRank` — dated attributions out of the source and left in this file, and the
long banners cut where they duplicated the header or this record. main.js went
1021 → 898 lines and model.js 398 → 362, with the measurements and the failed
approaches kept: those are the part CLAUDE.md calls the most valuable thing in a
module.

**Still open**: the title, the subtitle, and the gene/sample counts, all better
settled against the running widget than in advance. **Not baselined** — a draft
owes no fingerprint states, and a baseline recorded before the design settles
gets thrown away. When it is promoted it owes a **driven** state too, since it
declares an `animation`; the natural one is `drive: { set: { step: "3" }, frames,
dt }`, catching the ease mid-flight the way `logistic-regression`'s does.

### The notebook hands over its own figure

Every method in `05 / 03` is judged in the same two-panel picture — a boxplot per
sample, and a mean-versus-variance scatter over genes — and the notebook writes
the verdict underneath each one as two bullets, **Effect on: Distribution** and
**Effect on: Mean-Variance Relationship**. That is a widget: one method picker,
two panels, two readouts, and the readouts are the notebook's own claims.

The argument is that the six methods fall into **three** classes and the two
panels are what tell them apart — a rescaling moves neither panel, quantile
normalisation moves only the first, a transformation moves both.

**MEASURED 2026-09-01**, on the notebook's own generator reproduced exactly
(1000 genes, 10 samples, means ~ U(10,100), `rnbinom(mu, size = 1/disp)`,
`disp = mu/100`) using `core/stats.js`'s `nbDraw`. The engine is
`widgets/normalization/model.js` — written as `_lab/norm-model.js` for the mock
round and moved when the widget was built. `_lab/norm-measure.mjs` and
`_lab/norm-mock.html` both import it and print every number below, so what is
measured is what ships.

```bash
node widgets/_lab/norm-measure.mjs
```

| method | skew | ρ(gene mean, gene variance) | sample medians, min..max |
|---|---|---|---|
| raw | 2.978 | 0.948 | 32.0 .. 37.0 |
| median, per sample | 3.014 | 0.948 | 34.9 .. 34.9 |
| min-max, global | **2.978** | **0.948** | 0.048 .. 0.055 |
| z-score, global | **2.978** | **0.948** | −0.374 .. −0.289 |
| quantile | 2.902 | **0.948** | 33.8 .. 34.9 |
| log1p | −0.165 | 0.462 | 3.50 .. 3.64 |
| Box-Cox λ=0.02 | −0.145 | 0.450 | 3.59 .. 3.74 |
| Box-Cox λ=0.10 | 0.089 | 0.555 | 4.14 .. 4.35 |
| Box-Cox λ=0.25 | 0.506 | 0.708 | 5.51 .. 5.87 |
| Box-Cox λ=0.50 | 1.207 | 0.853 | 9.31 .. 10.17 |
| Box-Cox λ=1.00 | **2.978** | **0.948** | 31.0 .. 36.0 |

> **The ρ column for Box-Cox was wrong when this section was first committed**
> (0.092 / 0.220 / 0.434 / 0.671 / 0.865), and writing the measurement as a
> repo file is what caught it. The scratch version compacted each COLUMN's
> NaNs independently — Box-Cox sends a zero count to NaN — which shifts gene
> indices in that column only and silently misaligns every per-gene row after
> the first zero. **λ=1 is the check that fails loudly**: Box-Cox at λ=1 is
> `y − 1`, an affine map, so it MUST land exactly on the raw row. It did not.
> A self-checking row belongs in every table of this shape.

Five things that came out of measuring rather than reasoning:

- **The invariance is exact, not approximate.** Min-max and z-score leave the
  skew unchanged to **7e-14** — float noise. Both are one affine map applied to
  every value in the table, so the shape *cannot* move, and a widget can say so
  without hedging. This is the whole lesson and it is a number.
- **The right second readout is Spearman ρ(mean, variance), not the log–log
  slope**, which was the obvious choice and is wrong twice over: z-score makes
  most values negative so `log(var)` is undefined for 558 of 1000 genes, and
  log1p leaves the slope at 2.58 while ρ has already fallen to 0.46. ρ is
  rank-based, so it is provably invariant under any affine map and moves only
  when the map is non-linear — which is exactly the distinction being taught.
- **λ is a control that carries an idea** (3.5): ρ runs 0.450 → 0.948 across
  λ = 0.02 → 1, monotonically, with λ=1 landing back **exactly** on the raw row
  because at λ=1 Box-Cox is affine. The notebook's prose says "e.g. 0.5" and its
  code runs `lambda = 0.02`; at λ=0.5 ρ is **0.853**, barely off the raw 0.948,
  so the prose and the code do not agree about whether the variance was
  stabilised, and the code is the one that is right. A slider settles it on
  screen. λ=0.02 lands on 0.450 against log1p's 0.462, which is the other thing
  the slider teaches: λ → 0 *is* the log.
- **Quantile normalisation needs a continuous stage to show its one job.** On
  the notebook's integer counts there are only ~190 distinct values per sample
  across 1000 genes, so ties dominate and the sample medians still span 1.0
  after normalising — and averaging the tied blocks instead of min-ranking them
  only gets it to 0.997, so this is the data's fault, not the implementation's.
  On continuous data the spread collapses to **exactly 0**, under either tie
  rule. If the stage stays integer, the boxplots visibly fail to line up and the
  widget argues against itself.
- **The notebook's stage has nothing for a normaliser to correct**, and this is
  the biggest design finding of the five. `simulate_data` draws every sample
  from the *same* mean vector, so the ten samples are exchangeable before
  anything is done to them: the raw sample medians span 32..37, which is
  sampling noise on 1000 genes and not a depth difference. Give sample *j* a
  depth factor and the methods separate the way they are supposed to —

  The **scale gap** below is the widget's own first tile — the range of the
  sample medians over the pooled IQR, a ratio of two differences and therefore
  unmoved by any affine map. Raw and min-max read the same number by
  construction, which is the point:

  | stage | raw median range | scale gap: raw | after median norm | after quantile | after min-max |
  |---|---|---|---|---|---|
  | `spread = 0` (the notebook) | 5.0 | 0.096 | **0.000** | 0.022 | **0.096 — unchanged** |
  | `spread = 0.5` | 30.0 | 0.545 | **0.000** | 0.027 | **0.545 — unchanged** |
  | `spread = 1.0` | 53.0 | 0.815 | **0.000** | 0.038 | **0.815 — unchanged** |

  Min-max's last column is the lesson in one number: it makes the raw *range*
  small — 30.0 down to 0.040 — and leaves the samples **exactly** as unequal as
  it found them. On the notebook's own stage that is nearly invisible, because
  there was almost nothing to equalise. **A per-sample depth spread is what
  makes normalisation mean anything**, and it is a stage decision, so it goes to
  the mock-up.

  It also exposes what "affine" does and does not cover: median normalisation
  is affine *per sample* but is not one affine map over the table, so it does
  move the pooled skew — 2.978 → 3.014. Small, real, and the reason the widget
  should say *scaling* rather than *affine* on screen.

Second act, if it earns one: **the quantile procedure itself** — rank, average
across samples at each rank, assign back — is three numbered steps in cell 16
that no student can picture, and it is a countable thing while the count is
small (2.3).

### Slot 3 · `batch-effect` — the stage is already written, and it hides its own assumption

Cells 3–7 are a complete widget: 50 genes × 40 samples, a disease effect of 0.8
on genes 1–25 of the even-numbered samples, a **+2 shift on samples 21–40**, and
one PCA scatter coloured twice — by batch, then by condition. Correct the shift
and the colourings swap over.

**The assumption the notebook never states is the one that matters.** Condition
alternates (even = Disease) and batch splits at sample 20, so **every batch is
10 healthy and 10 disease** — perfectly balanced. That balance is why the
correction works, and nothing on screen says so. Batch effect 2 against disease
effect 0.8 is also why PC1 is batch: the artefact is 2.5× the biology.

So the one control that carries the whole widget is **how far batch and
condition overlap**, from balanced to fully confounded. At balanced, correction
reveals the biology. At confounded, correction *removes* it and the estimated
effect goes to zero — a failing case in the sense of 2.6, and the most
consequential design error in high-throughput work. The readout is the estimated
disease effect against the true 0.8; that number is what the correction is
*for*, and it is what collapses.

Three notes for the build:

- **Method scope.** The notebook runs ComBat, SVA and RUV. Three is a tour, not
  an argument, and only ComBat's model is written out (cell 10). Recommend
  building the mechanism — subtract a per-batch location, optionally rescale —
  and leaving the package names as prose. RUV is worth one sentence for a
  different reason: its control genes are `26:50`, which are **exactly** the
  genes carrying no disease effect. The truth was used to pick the controls.
- **A colour-role question, and it may need a new role.** Two categorical splits
  live on the same points. `--c-group-a` / `--c-group-b` is right for condition —
  two arms of a comparison you decided. Batch is *also* assigned and *also* not a
  cluster, so neither `--c-cluster-*` nor the group pair is honest for it. The
  notebook's two-panel form (same points, coloured twice) sidesteps this by giving
  each panel its own split; if a single-panel form wins the mock-up, this is a
  request to add a role, not to reach for `--series-n`.
- **Reuse.** PCA of a gene × sample matrix is widget 19's engine.

#### PICKED NEXT and MEASURED 2026-09-02 — and the argument is three-way, not two

```bash
node widgets/_lab/batch-measure.mjs      # every number below
```

`_lab/batch-model.js` reproduces cell 3 exactly and adds `overlap`, the control
the notebook does not have. **The notebook's own design sits at `overlap = 0`,
confirmed**: 10 healthy and 10 diseased in each batch, every time.

| overlap | batch 1 | batch 2 |
|---|---|---|
| 0.00 — *the notebook* | 10 / 10 | 10 / 10 |
| 0.25 | 12 / 8 | 8 / 12 |
| 0.50 | 15 / 5 | 5 / 15 |
| 0.75 | 17 / 3 | 3 / 17 |
| 1.00 | 20 / 0 | 0 / 20 |

**THE PLANNED TWO-WAY STORY WAS WRONG, AND THE MEASUREMENT IS BETTER.** The
plan above said: correct at balance and it works, correct when confounded and it
deletes the biology. True — but there is a third column, and it is the one the
notebook mentions and does not use. `ComBat(mod = NULL)` is what cell 12 runs;
`ComBat(mod = model.matrix(~ condition))` is named in cell 11 as "optional but
recommended". Estimated disease effect, truth **0.80**, mean of 5 seeds:

| overlap | no correction | subtract each batch's mean | …keeping condition |
|---|---|---|---|
| 0.00 | 0.825 | 0.825 | 0.825 |
| 0.25 | 1.240 | 0.813 | 0.847 |
| 0.50 | 1.808 | **0.620** | 0.826 |
| 0.75 | 2.219 | **0.443** | 0.868 |
| 1.00 | 2.771 | **0.000** | *not estimable* |

Three outcomes, each a different mistake:

- **No correction** reports the batch as biology — 0.83 becomes 2.77.
- **The naive correction** removes the batch and takes the biology with it, in
  proportion to the confounding: 0.813 → 0.620 → 0.443 → 0.000.
- **Keeping condition in the model** holds 0.83–0.87 across every estimable
  design, and then stops, because at `overlap = 1` there is nothing to hold.

**And the clinical number is the null genes.** Genes 26–50 carry no effect at
all; uncorrected, they report one anyway:

| overlap | 0.00 | 0.25 | 0.50 | 0.75 | 1.00 |
|---|---|---|---|---|---|
| no correction | 0.036 | 0.409 | 1.024 | 1.413 | **2.000** |
| either correction | 0.036 | 0.009 | 0.024 | 0.012 | 0.000 / 1.000 |

2.000 is the batch shift, exactly. That row is the false-positive mechanism in
one number and it belongs on screen.

**`overlap = 1` MUST NOT PRINT A NUMBER.** Batch and condition are then the same
variable, the design matrix drops to rank 2, and the condition-preserving fit
returns 1.385 — an artefact of the ridge, not an estimate. Measured, only
`overlap = 1` is singular; 0.90 still has one sample in each cell and is
estimable. The widget says *not estimable* there, which is the honest end of its
own argument: **no correction can separate two variables that are the same
variable.**

**PC1 confirms the picture the notebook draws.** Separation along PC1, as
|difference in group means| ÷ pooled sd:

| overlap | correction | PC1 share | by batch | by condition |
|---|---|---|---|---|
| 0.00 | none | 0.526 | **7.694** | 0.446 |
| 0.00 | either | 0.131 | 0.000 | **3.667** |
| 1.00 | none | 0.616 | 18.022 | 18.022 |
| 1.00 | naive | 0.084 | 0.000 | 0.000 |

At full confounding the two columns are identical, because the two questions
have the same answer.

**A second control, and it is measured rather than assumed.** The notebook picks
a shift of 2 against an effect of 0.8. The crossover is lower than that:

| batch shift | PC1 by batch | PC1 by condition |
|---|---|---|
| 0.00 | 0.072 | 3.634 |
| 0.50 | 1.429 | 2.156 |
| **1.00** | **3.531** | **0.971** |
| 2.00 | 7.694 | 0.446 |

Below about 0.5 the condition still owns PC1. So "is the batch bigger than the
biology" is a question with a threshold, and the shift earns a control.

#### ROUND 0 SETTLED 2026-09-02 — seven picks from `_lab/batch-mock.html`

| # | question | ANSWER |
|---|---|---|
| 2 | the PCA panel | **One panel: colour = condition, shape = batch.** The standard form for two categorical splits on one scatter, and it dissolves the colour-role question rather than working around it — batch never needs a hue |
| 3 | the correction picker | **One picker of three** — None / Batch mean / Keep condition — as a grid. The middle option is the mistake being taught, and it should be chosen rather than landed on |
| 4 | the estimate | **Tiles plus a strip**: the tiles carry the numbers, the strip draws all three corrections against the known 0.80 on one axis |
| 5 | the singular state | **The slider reaches 1 and the estimate says *not estimable*.** That boundary is the argument's own conclusion |
| 1 | the design | **A 2 × 2 count table beside the scatter.** Confounding is a property of the design, and a reader seeing only the scatter cannot tell an unbalanced design from a large batch effect (2.7) |
| 6 | the batch shift | **A `choice` slider.** The crossover is measured at ≈ 1.0, not the notebook's 2, so the control carries an idea (3.5) |
| 7 | the motion | **Ease between corrections**, on core's ease-request door. No drive buttons |

#### The ease forces a fixed projection, and that is 2.5 one level up

**Refitting the PCA per correction does not merely flip the axes, it rotates
them.** Correlation between the uncorrected scores and the corrected ones, seed 1:

| overlap | PC1 | PC2 |
|---|---|---|
| 0.00 | 0.213 | −0.492 |
| 0.50 | 0.167 | 0.302 |
| 0.75 | 0.133 | −0.522 |

Removing the batch removes the dominant direction, so PC1 becomes something
else entirely. **An ease between two such states shows motion that is about the
axes rather than about the data** — which is exactly the fault 2.5 records for a
rescaled axis, one level up: a basis refitted per state hides the collapse that
is the point.

So every correction is **projected onto the uncorrected data's axes**, and the
axis is labelled as such. Measured, that tells the story better than a refit
would:

| overlap | correction | PC1 by batch | PC1 by condition |
|---|---|---|---|
| 0.00 | none | **7.694** | 0.446 |
| 0.00 | either | **0.000** | **3.504** |
| 0.50 | none | 9.084 | 1.696 |
| 0.50 | batch mean | 0.000 | 2.151 |
| 0.50 | keep condition | 0.968 | **3.813** |
| 1.00 | none | 18.022 | 18.022 |
| 1.00 | batch mean | 0.000 | 0.000 |

The batch separation collapses to **exactly zero** and the condition emerges on
the same axis, so the ease is one motion: the points slide together along PC1
and re-separate by colour.

**It is a departure from the notebook**, which runs `prcomp` on the corrected
data each time, and the axis label has to say so — *PC1 of the uncorrected
data*. It follows from the pick at ask 7: an ease is only honest on a fixed
frame.

### Slot 4 · `hierarchical-clustering` — the merge sequence is the animation

The claim: **a dendrogram is not a finding.** Every dataset yields one, including
a cloud with no groups in it; the tree's shape is a consequence of a distance, a
linkage and a cut, none of which the data chose. This is the same shape of claim
as t-SNE's failure #1, and § *NEXT · t-SNE* measured that one on a generated
stage — the precedent for how to establish it is in this file. **It is not yet
measured here**, and it must be before it goes on a screen.

The mechanism is a countable one: N singletons, merge the closest pair, repeat.
`shown` is **the number of merges performed**, and the dendrogram grows one join
upward per step at the merge height. Switch the linkage with the distances held
fixed and a different tree comes out of the same numbers — which is the argument,
made by a control.

Two scope calls, both real, both flagged below rather than decided:

- The notebook gives **five distance measures** their own section with five
  formulas, and then uses Euclidean for everything that follows. Cosine, Pearson
  and Jaccard need a different data shape to mean anything (profiles, or binary
  sets), so a single stage cannot show all five honestly.
- Cell 15's stage is **1-D** (20 log-fold-changes) — which makes the distance
  trivial and the linkage the whole story. Its comment says 50 genes and it
  generates 20. A 2-D stage lets both controls matter and gives the classic
  points-beside-dendrogram pair, but it is no longer the notebook's figure.

The `pheatmap` half (cells 31–43 — rows and columns clustered, `cutree_rows`,
`cutree_cols`) is a second act and probably a second decision.

### Slot 5 · `enrichment` — the cutoff and the background, both invisible in the code

ORA's whole answer turns on two numbers a student never sees themselves choose:

- **the background.** Cell 3 writes `d <- 10000 - (a + b + c)` with no comment.
  Change the universe from 20,000 to 2,000 and the same overlap changes verdict.
- **the cutoff** for "differentially expressed". GSEA exists *because* that
  cutoff is arbitrary — the notebook says so in its own opening — and that is
  the pairing the widget can show: one ranked list, ORA's verdict flickering as
  the threshold moves, GSEA's running sum unmoved because it never needed one.

The GSEA running sum is the second animation of this arc and a good one: walk the
ranked list, step up inside the set, step down outside it, and the ES is the
largest deviation. Cell 6's figure already names the three cases — enriched at the
top, random, enriched at the bottom — so the failing case (2.6) is the notebook's
own middle panel.

Reuse is unusually high: the 2×2 and its natural-frequency grid are widget 12's,
the p-value machinery and the BH step are widget 6's, and the permutation null is
widget 5's.

**One thing to record about the notebook**: cell 3's `sample()` is unseeded, so
the ORA example prints a different p-value on every run. That is a lesson bug the
widget's seeded `rng` would not reproduce, and worth mentioning to Kenneth
separately from the widget.

### Open calls — for Kenneth, not to be decided by a session

1. **Build order.** Notebook order starts at `normalization`; evidence order
   starts at `batch-effect`, which has the strongest misconception and a genuine
   failing case. Both are defensible and the pick is his.
2. **Slot 4's scope** — linkage only, or distance too; 1-D like the notebook, or
   2-D points beside the tree.
3. **Slot 5's shape** — one widget with an ORA tab and a GSEA tab on one shared
   ranked list, or two widgets. The heading rule that gave t-SNE and UMAP
   separate widgets argues for two; the teaching argument is the *pairing*, which
   argues for one. `shap` shipped three tabs on 2026-09-01, so the multi-tab form
   is established.
4. **Whether `05 / 06` is fully covered.** Widget 14 teaches ridge / lasso /
   elastic net on a low-dimensional stage. This notebook's point is different:
   `p ≫ n`, where plain `lm()` returns **NA coefficients** because there is not
   enough information to estimate them, and `findCorrelation` shows why. That is
   a real second claim and it may be a widget-14 extension rather than a slot.
5. **Citations.** The batch-confounding misconception is graded **documented** on
   the strength of a literature this session did not open. Verify before any of
   it reaches a screen — the standing rule in HANDOVER is that a number not
   re-measured is one draw from a possibly unseeded model, and the same applies
   to a citation not re-read.

---

## The modeling arc — proposed 2026-08-27, from PHM5003 week 4

The week-4 notebooks (`04 - Introduction to Statistical Computing Part 2`,
sections 05-01 → 06-02) are one continuous argument — *a line → more
covariates → categories → interactions → other outcomes → other data shapes →
which covariates belong at all* — and `logistic-regression` (05-05) is already
its midpoint. Kenneth reviewed the seven-slot proposal on 2026-08-27 and
**approved building `fork-pipe-collider` first**; the rest are proposed, not
agreed, and three revive entries from the deferred table above
(`interaction-effect`, `censoring-km`, `confounding-simpson`).

| # | slug | notebook | misconception | evidence | status |
|---|---|---|---|---|---|
| 1 | `lm-least-squares` | 05-01 | the fitted line is a formula's output, not the minimum of a surface you can stand on | reported; prerequisite for the arc | **SHIPPED 2026-08-28** |
| 2 | `lm-adjustment` | 05-02 | a coefficient is THE effect of its variable regardless of the model — the Table 2 fallacy | **documented** (Westreich & Greenland 2013) | **SHIPPED 2026-08-28** |
| 3 | `lm-categorical` | 05-03 | dummy coefficients are group means; the reference level is a finding rather than a choice | reported | **SHIPPED 2026-08-28** |
| 4 | `lm-interaction` | 05-04 | main effects can be read unconditionally when an interaction is present | reported | **SHIPPED 2026-08-28** (revived deferred `interaction-effect`) |
| 5 | `time-event` | 05-06 | censored patients are missing data to discard | reported | **SHIPPED 2026-08-29** (renamed from `censoring-km`, Kenneth 2026-08-28) |
| 6 | `mixed-model` | 05-07 | 500 rows are 500 observations | **documented** (Hurlbert 1984) | **SHIPPED 2026-08-29** — seven rounds in one day (renamed from `pseudoreplication`, Kenneth 2026-08-28) |
| 7 | `fork-pipe-collider` | 06-02 | more covariates is always safer — adjustment is a causal decision, not a statistical one | reported; absorbs deferred `confounding-simpson` | **SHIPPED 2026-08-27** |

**The linear four wear an `lm-` prefix — agreed with Kenneth 2026-08-28.** The
four widgets teach one model family on one shared Framingham stage, and the
prefix marks the family in the URL; it is also the name of the function the
students actually type — the notebooks are R, and 05-01 → 05-04 is `lm()`
throughout. Rulings made with it, so they are not re-argued:

- **Slots 3 and 4 drop their trailing noun** (`lm-categorical`, not
  `lm-categorical-covariates`): the prefix now supplies the context the long
  form was carrying alone, and shorter URLs read better from a slide.
- **Slot 1 keeps `least-squares` over `lm-single`** even though 05-01 is titled
  *Single Covariate*: a slug names the misconception the widget dislodges, and
  this one is about least squares — the line as the minimum of a surface —
  not about single-ness, which only means anything relative to 05-02, a lesson
  its reader has not met. Widget copy is lesson-independent (2.10) and so are
  slugs.
- **Scope boundary, from the notebooks' own titles**: `lm-least-squares` is
  ONE covariate, full stop. The second covariate is `lm-adjustment`'s opening
  move (05-02 is *Multiple Covariates*), not an extension of slot 1.
- **The two shipped relatives keep their unprefixed slugs** —
  `logistic-regression` and `linear-regularization` — students hold those URLs,
  the same reason `power-and-error`'s rename waits for course end. Slots 5 and
  6 stay unprefixed too — they are not `lm()` lessons — and were **RENAMED by
  Kenneth on 2026-08-28: `time-event`** (was `censoring-km`) **and
  `mixed-model`** (was `pseudoreplication`) — each names the data shape or the
  method the lesson reaches for, not the failure it dislodges.
- **This is the repo's first family prefix** and deliberately so: the dimred
  slugs (`pca`, `umap`, …) are self-identifying algorithm names, while
  `adjustment` alone says nothing about what it adjusts. Prefix where the bare
  slug is ambiguous, not everywhere.

No week-4 notebook links a widget yet (grepped all seven: zero hits), so each
ship includes adding its link to the MyST lesson.

## Widget 33 · `lm-diagnostics` — SHIPPED 2026-08-29, three review rounds in one day

**Promoted on Kenneth's "looks good push to gallery" (2026-08-29), after
round 3.** Ten fingerprint states recorded with `_lab/lm-diag-shoot.html`
(the lm-shoot pattern): DPR checked at 1.25, copy proved 4/4 against
recorded hashes, every state shot three times in one run and identical,
every drive checked non-inert against its bare URL. Seven settled (the
opening question; the finished Linear figure; the three violations; the
bells via `?claim=1` — the pill is a `<button data-param>` setParam
cannot toggle, so claim settles by URL and **the bells' stagger ease is
untested geometry**, recorded here like time-event's scrub; the act at
junk=20) and three driven (the ENTRY mid-conveyor via `click: "gate-fit"`
+ 30 frames — a gate counts as a drive button; the scenario morph
mid-ease; the act's path via `set junk=12`, which ran zero frames — an
instant flip that still differs from its bare URL, the lm-adjustment
precedent). The entry drive's `tx` equals the settled fit's — correct,
since mid-flight only the picture differs. Baseline now **230 states**;
no full-suite rerun owed — nothing in `widgets/core/` moved for this
widget. **Still owed: the 05-01 notebook link (Kenneth places links by
hand) and judging it projected**, like every widget from 11 on. The
hover link is pointer-only and untestable by the harness (no parameter
moves — an inspector by design).

The round-by-round record follows.

### The rounds, as they ran (all 2026-08-29)

**KENNETH PICKED, 2026-08-29, all four from the mock:** composition **B**
(the data panel above its two diagnostic panels); **named scenarios** for
the generator (segmented Data: Framingham · Curved · Unequal spread ·
Skewed noise — not dials, not scenario + strength); RvF marks =
**smoothed trend + labelled extremes + ±2 SD band** (no envelope rails,
no ±3 SD clamp — the full y-range, the notebook's own honesty about
+7 SD); and the **small-n act** for adjusted R² (n = 30, a junk-covariate
slider 0→10). Built the same day as `widgets/lm-diagnostics/`
(status draft, on the lab page, final URL from first commit):

- **Two tabs** (Concept): *Diagnostic plots* — composition B with the
  scenario control, behind the arc's **Fit the model** gate — and
  *Adjusted R²* — the R²-vs-adjusted paths as noise columns accumulate,
  the equation card showing the subsample fit's own b₀/b₁ wobbling as
  junk is added. The gate is global: both tabs are properties of a fit.
- **Two eased values** (widget 30's chase): the gate's alpha and the
  scenario morph `m` — every dot, the fitted line, the smooth, the band,
  and each patient's Q-Q position (theoretical quantile AND standardized
  residual) lerp between outgoing and incoming scenario under fixed
  frames, so a switch reads as the data changing (2.5). Scenario and
  junk are display parameters over precomputed data (the lm-interaction
  `terms` pattern); compute() draws all scenarios from the one rng in
  fixed order, then the n = 30 subsample and ten junk columns.
- **The smooth runs the FULL fitted range**, as the notebook's own
  autoplot draws it (its blue line ticks up at the sparse right edge
  too) — the first draft cut it at the dense window and the curved
  scenario's right-side upturn vanished; the dense-window restriction
  stays on the measure script's flatness numbers, where edge wander was
  the artifact.
- **Edge labels flip inward** — a row number half outside the panel clip
  read as a different number (judged on screen; the adjusted-R² path's
  end labels at k = 10 had the same fault, fixed the same way).
- **Verified before review**: no console errors; every readout number
  matches the measure script (R² 0.106/0.170 real/curved, max|stdres|
  7.1, the adjusted path going negative on junk at n = 30); the canvas
  text sweep across all scenarios, both gate states, the full junk sweep
  and a seed change reads 65 distinct strings, zero NaN/undefined; URL
  round-trips every state.

### ROUND 1 — Kenneth, 2026-08-29: the stage goes ALL-SIMULATED

**The comment:** mixing real and simulated data in one control risks
confusing people — use simulation to illustrate what each kind of data
looks like and how it appears in the diagnostic plots; *"i don't really
see the curve in the data"* (title "Checking the Model Fit" approved).
Both halves were measured before the fix:

- **The curve really was invisible**: at the real data's noise (SD 19.9)
  curve 0.2 bends the cloud ~1.5 noise SDs — chosen for the SMOOTH's
  legibility, not the data's. The rebuilt stage is a simulated study
  keeping the Framingham fit's own line (b₀ 87.07, b₁ 1.72) and the real
  BMI distribution clipped to its dense 18–40 window: **n = 600, noise
  SD 12, curve 0.4** — the bend is now 5.2 noise SDs off its own best
  line, unmistakable in the cloud before any plot says so. Frames re-set
  from measured 30-seed extents. Framingham left the scenario control;
  a fourth scenario **Linear** ("every assumption holds", R² ≈ 0.26) is
  the default and the reference the violations are read against. The
  notebook's real autoplot stays in the lesson; the widget is the
  controlled reading trainer beside it.
- **The lower noise broke the adjusted-R² act and the fix was measured**:
  at n = 30 / k = 10 junk columns, ADJUSTED also climbed (> 0.1) on 13
  of 60 seeds — one lucky noise column survives the df penalty — and the
  then-default seed 1 was one of them (0.30 → 0.40). The shipped setting
  is **n = 60 / k = 20** (climb kept: 54/60 seeds gain > 0.15, mean
  +0.26; misleading tail halved to 7/60), and the **default seed is 6**,
  chosen to open on the TYPICAL picture — R² 0.25 → 0.51 with adjusted
  flat at 0.24 — because the claim is true in expectation and a widget
  should not open on the 12% tail. The seed control is what shows the
  wander.
- Two smaller fixes from driving it: near-coincident extreme rows mashed
  their labels (staggered by rank), and **the TDZ trap struck a third
  time** — the stagger table was declared below defineWidget and threw on
  load; the stale-console trap then showed the error three times after it
  was fixed (fresh `window.onerror` counter proved it clean).

### ROUND 2 — Kenneth, 2026-08-29: rename the tab; animate the WHY — mock built, awaiting picks

Three asks: the second tab should read **"Model fit"**, not "Adjusted R²"
(renamed, value `adjr2` kept so shared URLs hold); can the widget ANIMATE
why residuals should be normal ("overlay bell curve sideways on plot");
and can the residual plot's construction be animated ("lines from dots
extend to the perpendicular of the fit… linked to the residual plot… if
too crowded, selected lines") — with a research pass on how others do it.

**The research** (what exists, and what it settled): Whitlock's
*Visualizing residuals* (UBC shiny) clicks a point and lights its
residual in BOTH the scatterplot and the residual plot — the
linked-selection pattern; the *Regressomatic 4000* (refsmmat.com) pairs
each diagnostic with the data panel and lets the reader DRAG a point,
diagnostics updating live — the propagation pattern; the marginal
histogram on a plot's edge (ggExtra's ggMarginal) is the established home
for "the distribution of what this axis shows"; and the classic textbook
diagram — sideways normal curves straddling the fitted line — appears
never to have been animated anywhere found. One naming correction folded
in: the residual is the VERTICAL distance to the line, not the
perpendicular (that is total least squares), so every candidate draws
vertical segments.

**The candidates are BUILT AND RUNNING** in
[`_lab/lm-diag-anim.html`](../widgets/_lab/lm-diag-anim.html), all on the
widget's own generator (seed 6, n = 600), each with a Replay:

- **§A · Build the residual plot** — twelve selected patients
  (quantile-spread, the largest residual included): the vertical segment
  grows dot-to-line, then dot-and-segment TRAVEL into the panel below to
  land at (fitted, residual); the remaining 588 fade in en masse.
  Integration: the gate's entry animation (core's door), then
  hover/click lights a patient in both panels (the Whitlock move, the
  arc's pointer channel).
- **§B · Lay the line flat** — one ease: the fitted line rotates flat
  while every dot keeps its residual; the data panel BECOMES the
  residual plot. Cheaper, all 600 dots, but nothing is singled out.
- **§C · The sideways pile** — the residual plot's dots sweep to the
  right margin and stack into a pile (leaving faint ghosts — a settled
  sweep that emptied the plot read as broken); the sideways bell over it
  (theory token) is the normality claim at the residual SD. On Skewed
  noise the pile leans visibly off the bell. Two lessons from drawing
  it: the dot spacing must shrink to fit the DEEPEST bin (a fixed
  spacing saturated the centre bins into a barcode), and the y-window
  must hold the skew tail (+136).
- **§D · The model's claim on the data** — the textbook diagram
  animated: three sideways bells straddle the fitted line at BMI
  21/28/35, staggered in, ONE claimed spread (dashed, theory token). On
  Unequal spread the fixed bells visibly disagree with the widening
  cloud. Integration: a "Model's claim" overlay toggle on the data
  panel.

A and B answer the construction ask; C and D answer the normality ask
(C on the residual plot, D on the data).

**KENNETH PICKED §A AND §D, and both are INTEGRATED the same day:**

- **§A is the gate's entry** (core's door — which required the `fit`
  gate to become NON-display: core sends a non-display gate down the
  data path, where the entry trigger lives; em-mixture's arrangement,
  and this widget has no accumulated work for a gate-close to destroy).
  The twelve travellers now OVERLAP on a 250 ms stagger (~3.7 s total —
  the mock's strict sequence took ~9 s); the zero line arrives with the
  fitted line, the mass (dots, band, smooth, Q-Q, labels) fades in at
  the end, and the traveller segments fade out into it. The entry flag
  follows em-mixture's one-shot contract, so a shared `?fit=1` link and
  every fingerprint state open FINISHED — no 3.7 s wait, no spoiler
  question. **Afterwards hover links the panels** (the Whitlock move,
  the pointer channel): the nearest patient within ~10px lights in all
  three panels — segment to the line, segment to zero, ring on the
  Q-Q — an inspector only, inert mid-entry, restoring exactly on leave
  (hash-verified).
- **§D is `claim`, a display bool** ("Show the model's claim") on the
  data panel: three bells at BMI 21/28/35, staggered in on an eased
  chase, drawn at the FIT's own residual SD (2.11: never the hidden
  generator's), lerped through scenario switches; a `theory`-token
  legend entry appears with it (the live-legend door).

Verified: the entry runs on gate open and settles to a stable hash; a
`?fit=1&claim=1` link is finished at rest; hover paints and restores
byte-identically; the text sweep across scenarios × claim × gate ×
junk × seed reads zero NaN; `npm run check` green. One environment
note: with the Browser pane's compositor stalled the synchronous paint
shows the finished figure and the choreography waits for the first
frame — em-mixture's exact structure, a sub-frame flash in a live
browser.

### ROUND 3 — Kenneth, 2026-08-29: the pill, the MathML, the copy pass

"Looks nice" plus three: **the bell-curve toggle became a BUTTON** —
core's `style: "pill"` bool (widget 28's membership chip), face
"Model's claim", `aria-pressed` carrying the state. NOTE FOR THE
HARNESS, inherited with the pill: it is a `<button data-param>` the
fingerprint's setParam cannot toggle — drive claim states by URL.
**The equation card is MathML** — the arc's machinery ported from
lm-interaction (the render probe, one `<math>` per term so thirteen
terms can wrap, plain-text fallback): rows "the model" (generic, ink-2)
and "this model" (the fit's numbers, empirical), the act's card adding
a muted "+ k noise terms" note and its generic form reading
y = b₀ + b₁x + b₂z₁ + ⋯. **And the copy/comment pass**: the main.js
header cut to the load-bearing whys (the round narrative lives here,
not in the source), inline comments trimmed to their earned cores, and
the visible copy tightened (control details lost their trailing
clauses; the R² tile note is "variance explained by the model"; the
act's is "never falls as covariates are added" — a fact of nested
least squares, not a verdict).

The planning record below stands as written.

### The planning record — MEASURED 2026-08-29, before the mock

**The brief (Kenneth's queue, after `lm-interaction`'s revived act):** a new
widget supporting 05-01, cells 53–62 plus the Application section from 63 —
goodness of fit (R², adjusted R² with the bias argument) and
`autoplot(which = 1:2)`: **Residuals vs Fitted and the Normal Q-Q**, with
the notebook's three reading bullets (residuals hover around 0 → the linear
form is appropriate; a horizontal band → equal variance; no significant
outliers). The fit is the notebook's own `sysBP ~ BMI` on the arc's shared
frame (n = 3547). The scope boundary was drawn at widget 27's round 8 and
holds: **lm-least-squares reads a LINE's residuals, this widget reads a
MODEL's** — curve/funnel/skew as verdicts on the model class belong here
and only here.

**The machinery is built and verified** (the lm-model.js arrangement —
planning copies in `_lab/`, one function per fact):

- [`_lab/lm-diag-model.js`](../widgets/_lab/lm-diag-model.js) — `qnorm`
  (Acklam, checked against R's), the diagnostic pipeline (`rstandard` via
  closed-form simple-regression leverage; Q-Q positions via R's `ppoints`
  with a = 1/2; the quartile line `qqline` draws), `loessAt` (local-linear
  tricube — a mark, not a printed number), and `makeSynth`, the
  assumption-breaking generator.
- [`_lab/lm-diag-measure.mjs`](../widgets/_lab/lm-diag-measure.mjs) —
  **20 checks, all passing**: R² 0.1064831 and adjusted 0.106231 to the
  digit (cells 56/59), and — the check that ties residuals, sigma and
  leverage together in one line — **the three rows the notebook's stored
  autoplot labels (404, 1003, 1668) are this pipeline's three largest
  |standardized residuals|**. The figure-read values (max stdres ~7.3, the
  residual extremes) carry honest wide tolerances; the PNG is the source.

**Measured before design** — the facts the mock answers to:

- **The real data passes the first two readings and visibly fails the
  third.** The residual smooth moves ~5px on a 250px panel (flat); the SD
  ratio across fitted fifths is 1.22 (near-equal variance); but residual
  skewness is 1.13 and the Q-Q's right tail sits **0.88 SD off the line at
  theoretical +2** (1.87 SD at +3). A real dataset that is mostly fine and
  gently wrong is the honest opening state — the notebook's own bullet
  says "roughly normally distributed", and the widget can show exactly how
  rough. The unmistakable violations come from the generator.
- **Generator legibility thresholds** (same BMI xs, the real fit's own
  line, one violation at a time, seeded): curvature 0.2 bows the smooth
  24px at panel scale (0.1 gives 12px); the fan must ramp over the
  **1%–99% BMI window** — ramped over the full range it spends itself on
  the outlier tail and never shows (measured, the first version's
  mistake) — and needs fan ≈ 3 (SD ratio 2.0) before the cloud itself
  funnels, because BMI's density piles the points left; log-normal noise
  lifts the Q-Q gap at +2 to 1.25 SD while leaving band and smooth clean.
  Cross-talk is real and honest: strong curvature also inflates
  |stdres| (6.5 at curve 0.2), so a curved model bends the Q-Q too.
- **The adjusted-R² bias argument does not fire at n = 3547.** Ten
  pure-noise covariates: R² 0.106 → 0.109, adjusted 0.106 flat (mean over
  20 seeds). At **n = 30** the same ten take R² 0.15 → 0.45 while adjusted
  wanders ~0.12 — and single seeds dip **negative** (seed 7: −0.12), which
  is the sharpest version of the claim. So the bias lesson needs a
  small-n act (seeded subsample + junk-covariate stepper) or it stays a
  sentence; that is a Kenneth call, drawn in the mock's §4.
- **Two edge artifacts worth not rediscovering**: the loess smooth and the
  local-SD envelope both extrapolate at the sparse fitted edges — the
  envelope blew up on the real data's right edge and pinched to zero on
  the fan's left until both were restricted to the dense (1%–99%) window.

**The mock-up page is BUILT** —
[`_lab/lm-diag-stage.html`](../widgets/_lab/lm-diag-stage.html), every
panel drawn from the shared module on the real data, captions computed
live. Four sections, each a design question for Kenneth's pick:

- **§1 stage composition**: A the notebook's own pair (RvF | Q-Q, nothing
  else) vs **B** the data panel above the pair — the same patient traced
  three times (point, residual, quantile), with the three labelled rows
  ringed in all three panels; B is what makes the generator legible, at
  ~260px more height.
- **§2 the generator**: four scenario rows (Framingham · curved 0.2 ·
  fan 3 · skewed noise), frames FIXED across rows (2.5) so a scenario
  switch reads as the data changing; plus the **envelope candidate** —
  rails at ±2 local SD, level on the real data, a funnel under fan 3 —
  the mark that makes the fan legible where BMI's density hides it. The
  control question: a segmented Data control naming the scenarios vs two
  dials (curvature/fanning) vs segmented + one strength slider.
- **§3 the RvF marks**: dots+zero / +smooth / +labels+±2 band (full
  range — honest about +7.1 SD, thin about the band) / the same clamped
  at ±3 SD with clipped outliers parked at the edge and counted. The
  ±2 band is faint fill + dashed edges (a 0.3-alpha slab drowned the
  dots, judged on screen).
- **§4 adjusted R²**: the small-n act's figure — n = 30, junk covariates
  0 → 10, R² climbing on pure noise while adjusted refuses (and this
  seed goes negative) — against the tiles-only alternative.

**Open interaction questions, deliberately left for the build session**:
whether the diagnostics sit behind the arc's **Fit the model** gate;
whether a scenario switch eases the dots (x never moves, only y — the
26/28 slide); what the readout holds (R², adjusted R², residual SD — and
2.11: any printed verdict must be computed from the drawn residuals,
never from the scenario parameter); where the three reading bullets live.

## Widget 32 · `mixed-model` — SHIPPED 2026-08-29, seven rounds in one day

**The misconception (slot 6, Hurlbert 1984): 500 rows are 500 observations.**
Measured before anything was argued, the arc's rhythm:

- **The engine came first and is pinned to lme4 itself.**
  `widgets/mixed-model/model.js` is a zero-dependency profiled REML fitter in
  lme4's formulation (relative covariance factor, β and σ² profiled out,
  Nelder–Mead over Λ's Cholesky, q ≤ 2 specialised to closed-form 2×2
  algebra — the generic version allocated its way to ~30 ms a fit and priced
  the tally out of compute()). `_lab/mixed-ref.R` regenerates the notebook's
  two simulated datasets EXACTLY in base R (mutate evaluates sequentially, so
  the RNG stream is six calls in order; head/tail rows proven against the
  stored outputs) and, with lme4 installed, appends lme4's own fits to
  `mixed-ref.json`. `_lab/mixed-measure.mjs` (89 checks): every printed
  number of the BP tables to the digit — coefficients, t(n−p) Wald CIs
  (measured off the printed half-widths: modelsummary's multiplier is
  1.9647, not 1.96), SD(int) 9.918, SD(slope) 1.164, cor −0.255, σ 4.978,
  ICC, AIC, BIC, RMSE — lm at 1e-8 against R, both lmer fits with REML
  criteria agreeing to ~1e-10 (ours lands a hair LOWER on the BP fit).
  KNOWN-DIFF: Nakagawa R² third-decimal only (Johnson 2014 verbatim vs
  performance's bookkeeping).
- **The design measurements** (`_lab/mixed-design.mjs`): visits 1→20 at 100
  patients takes lm's false-positive rate 5%→57% while lmer holds 4–9% and
  its half-CI ~4.1; 500×1 / 100×5 / 50×10 / 25×20 all print n = 500 while
  the honest interval reads 2.0 / 4.1 / 5.9 / 8.4; the sdPatient ladder has
  the fits agreeing at 0 and diverging monotonically; at family SD 5 the
  flat fit averages 2.5 false SNPs of 9 AND misses the causal one 22% of
  the time — lmer 0.64, never (modeling the families GAINS power).
- **The notebook review found a real defect** — *Kenneth reported it FIXED
  on 2026-08-30 (naming it "05-06"); the copy at `../jupyterbook/phm5003`
  still shows the defect and is unmodified since February, so he likely
  edited a working copy this repo cannot see. HANDOVER's item 4 records
  exactly what was checked.* The defect: 05-07's SNP lm "adjusting
  for family_id" enters it NUMERIC (coefficient 0.0038 — behaviourally
  identical to no adjustment; measured). Kenneth's fix conversation
  settled: drop the term and reword to "ignoring the family structure";
  `as.factor` also works but reaches lmer's own conclusion (SNP5 alone,
  1.233 vs 1.235) and kills the lesson's contrast. Measured for the
  argument's honesty: fixed-effects adjustment is near-equivalent to lmer
  HERE (SE ratio ≤ 1.09); the knockout cases are the BP design (medication
  never varies within patient — rank-deficient, and R silently prints
  order-dependent nonsense: −30.98*** one way, NA the other) and
  unrecorded/crossed relatedness (household+clan sim: lm+factor 3.48 false
  of 9, lmer(1|household) 3.42, lmer both levels 0.28) — judged TOO
  COMPLICATED for the lesson and parked as prose.

### Round 1 — built from four mock picks (2026-08-29)

Kenneth picked all four recommendations off `_lab/mixed-stage.html` (every
figure computed by the real engine): two tabs; the cloud→spaghetti reveal as
an EASED DISPLAY FLIP, not a Step (round-17 spirit: data changes land
finished, the ease runs only on the view flip); the repeat-the-study gate;
the notebook-faithful one-level family design with widget 31's causal
chips. Draw 7 is the measured default story on BOTH tabs; the families
stream offset (900) is measured, not arbitrary — at the natural offset the
default draw had lm MISSING the causal SNP. The tally's fast warm-started
fits are verified decision-identical to full fits (0 flips over 100+100
studies, re-pinned in the drive script at 40). `_lab/mixed-drive.mjs`
pins the contract (80 checks). Build hit the lm-adjustment TDZ incident
(F_LO below defineWidget while a families-tab URL draws during it).

### Round 7 — promotion: ten states through the shooter

**Kenneth's "tested ok"** after confirming the defaults carry the
notebook's finding (they do, by construction: Draw 7 at effect None is
the pinned default story; Draws 5/6/8/10 vary it, Draw 3 fools both
models — the honest caveat). Promotion ran the lm-shoot route:
`_lab/mixed-shoot.html` proved its harness copy 4/4 against recorded
baseline hashes, shot ten states three times each (all STABLE), and shot
every driven state's bare URL beside it (all non-inert). Seven settled —
both Repeated views, the 25×20 trade corner, the Nested cloud, the flat
famdiff=none band, the two-causal-SNP forest (causal=48), the Syntax
hero — and three driven mid-ease (`set view=related` on each data tab,
`set ranef=slope` on Syntax). No regions, so no hit state owed. DPR
checked at 1.25 before recording. The confirming full-suite run read
**217 of 217 MATCH** — no `widgets/core/` change was ever made, and the
207 pre-existing states held on the same run. Manifest and status →
shipped; the 05-07 link handed to Kenneth to place.

### Round 6 — the code leads the Syntax page

Kenneth: the note is wordy, and the code is small on a page whose focus
is syntax. Both fixed by the same restructure, on three named principles:
visual hierarchy (the ACTIVE formula is now the page's largest type —
--fs-fig, the stat-tile size, with the inactive model small and dimmed
above it), proximity (round 5's sentence became a per-token KEY attached
to the term each line explains: 1 — its own level for each school ·
hours — its own trend · school — the grouping — categorical: labels, not
numbers), and progressive disclosure (a key line exists only when its
token is in the active formula; at None there is no key). The abstract
⟨pattern⟩ template line was cut as redundant — the scenario picker plus
the key teach it concretely. Scenario y-names shortened (chol, tumor) so
the hero line cannot wrap at the default width. Verified: 20px computed,
one-line height, 97 drive checks.

### Round 5 — G is categorical, said where the formula is taught

Kenneth: "is it clear that G has to be categorical?" It was not, anywhere —
and it is the exact trap the notebook's own numeric family_id fell into.
One note line added to the Syntax card, in the scenario's own word:
"right of the | the grouping variable is categorical — each distinct
school is one group; the same ID as an ordinary covariate would be fitted
as a number, with a slope." No lesson reference (2.10); the inoculation
is general.

### Round 4 — generic legend, and the scenarios

Kenneth's two asks. **The legend went generic** — Group A · Group B, and
the lmer line reworded to "the grouping modeled as a random effect" — with
the canvas carrying the specific names where they matter (the Repeated
facets say control · medication; the Syntax lines say the scenario's own
unit). **The Syntax tab gained the Scenario picker**: five concrete
studies (Y/X/G generic · BP over time in patients · cholesterol vs age in
families · scores vs hours in schools · tumor size by week in mice) whose
variable names flow into the formula card, the axis labels, the line
labels (school A · school B) and the readout notes ("one level per school
— the 1 in (1 + hours | school)"). A SELECT, not free text, on purpose:
recognising WHICH variable is the grouping is the syntax skill, each
option is that recognition made for one study, and params stay typed with
the URL as the state of record. Display: true — the picture is the same
picture, relabelled. Drive: 97 checks.

### Round 3 — the toggle everywhere, the repeat stage cut, Syntax born

Kenneth's fixes plus two asked questions. **The Measurements toggle now
lives on Nested too** (his ask — "would be nice to see the contrast"): at
Independent the strip is 1000 dots in collection order with lm alone in
the forest and the lmer tile withheld; at Related the dots TRAVEL to
their family columns, the span bars and the lmer rows ease in, and the
formula card dims lm — the same reveal grammar as Repeated, every dot
carrying both addresses for the ease. **The repeat-the-study gate is
CUT** — his call, made with the counter-argument in front of him: his own
round-3 observation ("lm often reaches the same conclusion") was measured
(150 draws/cell: agreement ~70% under the null at EVERY n from 50 to 400
patients while lm false-claims 34–44%; 99% agreement only when a real
effect meets a big sample) and the tally was the one instrument showing
agreement and validity coming apart. The numbers stay here and in
`mixed-design.mjs`; the rate story belongs to the lesson prose now.
**The Syntax tab was added** (his floated idea, taken): the notebook's
random-effects block live — Random effects: None · Intercept · Both
builds `lm(Y ~ X)` → `lmer(Y ~ X + (1 | G))` → `(1 + X | G)` in the card
(with the ⟨slopes⟩|⟨grouping⟩ template as the note), while the REAL
engine's three fits pivot on stage: pooled lm always present as the
dashed naive line, per-group lines easing between intents, groups with
FIXED level/trend offsets (a diagram brought to life, not an inference
demo — a draw where the groups agreed would teach nothing; only the
points jitter with Draw). Also answered in-round: yes the integer
family_id was wrong (drop it, not as.factor, to keep the lesson's
contrast). OPEN: the legend's group entries say Control/Medication, wrong
for Syntax's group 1/2 — a wording pick owed.

### Round 2 — the notebook's own vocabulary, and less machinery

Kenneth's fixes, all four picks taken as offered: tabs renamed
**Repeated · Nested** (the notebook's hierarchy types; values renamed too —
draft, no URLs held); the confusing "Rows · Patients" toggle became
**Measurements: Independent · Related** (his own mapping); the tally
**opens finished** — Step and Play declined outright, the widget-31 ruling
("may be too much"), Draw re-rolls the hundred; and the Nested stage
gained **the family strip above the forest** — cholesterol as one thin
column per family, families sorted by their mean, so the page opens on the
DATA (a ramp of tight clusters at the notebook's strength, one flat band
at none) rather than on the forest's answer. Both tabs gained the **R
formula card** (his ask): both calls written out, the active one at full
strength, the random-effect term wearing --c-empirical. The TDZ incident
struck a second time (formulaHost); the file now carries the warning at
the binding.

## Widget 31 · `time-event` — SHIPPED 2026-08-29, eighteen rounds in one day

### Round 18 — promotion: the fingerprint catches its bug, the states go in

**Kenneth's "tested ok" ("push to gallery, looks good"), and the
promotion ran the widget-24 route — no shooter, the full suite three
times.** The pane came up at the true DPR 1.25 mid-promotion, and the
first whole-suite pass did two jobs at once: it CLEARED the rounds-14–16
core-change debt (**198 of 198 pre-existing states MATCH** — the bits
control, `bitsFrom`, `.w-seg-bits` and the pill fill reached no other
widget), and its text column caught a real defect in the nine
placeholder rows: **the groups HR tile printed 2381965155654895.00 at
follow 5** — one event cannot pin a two-group Cox fit, and the honesty
guard existed only on the factors card. The tile and the summary now
refuse a runaway disease-only fit ("too few events to estimate a hazard
ratio", value "—"); drive check added (132 total). Then the states:
three full runs, the nine hashes byte-identical on each and the 198
matching on each, spliced, and a confirming fourth run read
**207 of 207 MATCH**. Seven settled states (the notebook table
finished; ten patients four censored under dropped; the `shown=14`
mid-build still; bands+shared; effect none; follow 5; the full model)
and two driven mid-ease (`set age`, `set snps`). No regions, so no hit
state owed; **the scrub remains untested geometry** — no harness verb
drives a pointer drag; noted for whoever adds one to the harness.
Manifest → shipped; the 05-06 link handed to Kenneth to place.

### Round 17 — Step and Play die; the scrub is the one time control

**Kenneth's realization, and it completes what round 14 started**: "the
play function is not useful as we have the scrub ability — this allows
instant feedback on the curves as we change the parameters." Every
figure now opens FINISHED and redraws finished on every parameter
change; dragging on a time panel is the one way to move the clock.
Round 8's watch-the-study-build motif is thereby kept AVAILABLE (drag
from zero) rather than imposed (wait for a sweep after every change) —
the reversal is deliberate and his.

What went: the Step glide (round 6's 350ms tween and its landing
contract), Play/Pause/Replay, the Play speed control and its SPEEDS
table, and round 14's per-tab `anim.inert` (superseded — Step and Play
are now DECLINED outright with the widget-12 `stepLabel: null` /
`runLabel: null`, and the forest's ease needs no buttons: core grants
frames on the `anim.easing` request). The drive row is **Reset alone**,
which stays genuinely useful — it returns every control to its default
and the cursor to the finished figure. `?shown` was REPURPOSED rather
than cut: it places the cursor mid-build on first render (cursor time
× 2; 0 = complete), so old `?shown=44` links still open a finished
figure and an authoring link can now open a mid-build still.

Verified: drive re-pinned at **131 checks** (opens finished on both
sweep tabs; a data change lands finished — the instant feedback the
round exists for; `?shown=14` opens the cursor at t = 7; the declines
asserted; the scrub still clamps both ends and pulls the finished
figure back mid-axis); in-browser — the drive row renders Reset alone,
Play speed is gone, the censoring curve carries ink on load with no
button pressed, and toggling Dropped redraws instantly; no console
errors. `npm run check` green.

### Round 16 — who is censored, as a picker (pick C1)

**Kenneth settled Modeling and turned to the Censoring rail: "the
controls look a bit weird, as we have a specific one for patient E?
should we have a picker (like the snps)?" Mocked first** (mock §7, both
candidates as live chips), **picked C1: the picker replaces both.** One
"Censored" chip row of patient letters — default B · E, the notebook's
table exactly — replacing the Censored COUNT, its invisible fixed flip
order (E, B, F, G, H, C, D), the "A stays an event" clamp (an artefact
of that order, not a teaching decision), and the bespoke Patient E's
time slider, whose lesson survives as CHOICE: censoring C (t = 6,
mid-events) moves different denominators than censoring B (t = 10,
after everything) — asserted, S(8) 0.30 → 0.40. E's time is the
notebook's 7 for good.

**Core: the bits control gained `bitsFrom`** — a chip count that follows
another parameter, declared declaratively and registered in
`gatingParams`, so the SAME rebuild rule that serves `when` re-renders
the row when Patients moves (5.3's no-opaque-predicates line holds). A
pick beyond the roster stays in the value — hide a patient and the
pick is remembered, not erased (asserted). Every censored lane now
names a cause (the round-2 fix extended to the full roster — the two
notebook causes alternate; B and E keep theirs). The reachable
all-censored corner is honest: zero events, the kept curve holds at 1,
and the dropped reading of nobody says "—", not a number.

Verified: drive re-pinned at **135 checks**; in-browser — the row grows
A–E → A–G as Patients moves, pressing G writes `?cens=82`; 550px sweep
at ten patients with four censored: 0 overruns, 0 collisions, all four
reason labels painted, the mechanism phrase computed from the mask; no
console errors. `npm run check` green. The standing suite-run debt
covers this round's controls.js line too.

### Round 15 — three tweaks under Modeling

Kenneth's pass over round 14: (1) the compact curves carry **confidence
bands and censor ticks always** — no controls for them on the tab; (2)
**a pressed pill or chip FILLS with `--c-highlight`** with
surface-colour text (the 18% tint read as nothing at chip size) —
tokens.css, and deliberately shared: the lm arc's model pills (28–30)
strengthen identically, one control one look, **flagged to Kenneth for
veto since it restyles rails he has already approved**; (3) **Play
speed left the Modeling tab** (`when` on the speed param — no clock, no
speed; it stays on the two sweep tabs). Drive 130 checks green; browser
verified (fill computed on both pill and chip, speed absent on Modeling
and present on Comparing, band wash painting in the compact panel); the
round-14 suite-run debt covers this round's tokens.css line too.

### Round 14 — the chips: choose WHICH SNPs; the Modeling tab loses its clock

**Kenneth's review of round 13, four asks.** Two needed no mock: Causal
SNPs became CONTEXTUAL (Modeling tab only — the value still governs the
one shared cohort, as Patient E's time does from its tab), and the
Modeling tab's compact curves went STATIC — drawn complete, updating
instantly as the data controls move. The clock leaves that tab through
core's existing `anim.inert` (the widget-18 door: Step and Play leave
the row, Reset stays), so NO core change was needed there, and the
cross-tab sweep hand-off survives — the widget just draws Modeling's
curves at `tEnd` regardless of the clock, and `scrubHit` refuses the
whole tab.

**The labels** (picked from live-width mock candidates): **Censoring ·
Comparing · Modeling** — "Comparing groups" had been truncating at the
rail's measured ~13–15-char limit since round 2 ("Comparing gr…").
Gerunds, not verbs: round 4's precedent is that bare verbs read as
drive actions. The VALUES are unchanged — they are the URL.

**The chips** (his ask: choose the individual SNPs "that we will try to
recover later"; researched against the repo's own rules): Causal SNPs
is now ONE int bitmask worn as ten toggle chips — `?causal=7` = SNPs
1–3, the notebook's truth and the default, reproducing the round-8
generator bit for bit (asserted). Alternatives recorded as rejected:
clicking the forest's rows (round 11's ruling — the rail is what you
SET, the stage is what you SEE; a data write hiding in the answer plot
is the disease-pill confusion doubled) and ten bool params (ten URL
parameters for one idea). **Core gained `style: "bits"` on int** — an
int worn as toggle chips, chip j flipping bit j, segmented styling with
a `.w-seg-bits` width modifier in tokens.css. The chosen SNPs wear a
`--c-reference` dot beside their forest row names — truth on the label,
the model's verdict on the mark, recovery at a glance (the reader set
the truth, so it spoils nothing). Detection statistics carry over from
the round-13 grid by symmetry: the SNPs are iid and balanced, so only
the POPCOUNT matters, not which bits.

Verified: drive re-pinned at **129 checks** (labels; the mask semantics
— default ≡ 7, masks 7/56 and 0/1023 draw different cohorts; chips
declared bits-10 factors-only; inert set on Modeling, cleared on the way
back; Modeling never scrubs); in-browser — chips render at 300px in the
rail, 1·2·3 pressed, a chip click writes `?causal=71` and redraws; Step
and Play hidden with their group on Modeling, Reset remaining; the
compact curves carry ink with the clock untouched; no console errors.
`npm run check` green.

**THE FULL SUITE RUN IS OWED AND BLOCKED — environmental, recorded
here so nobody chases a phantom.** controls.js/tokens.css moved, so the
198-state run is required. The attempt from this session read **every
completed row DIFFER on `px` with `tx` IDENTICAL — and
`devicePixelRatio` reads 1, not the baseline's 1.25** (the pane
composites nothing and reports DPR 1 while not displayed; HANDOVER's
px-tracks-DPR section is this exact signature). The tx invariant held
on all 64 completed states. The run must happen with the pane
DISPLAYED and reporting 1.25 (or in Kenneth's own browser at 125%),
and it GATES THE PUSH. Reasoned blast radius, for the reader of that
run: the new controls.js branch is gated on `field.style === "bits"`,
which only this widget declares, and the CSS is scoped `.w-seg-bits` —
and the rail is outside both hashes anyway.

### Round 13 — the ground truth becomes a lever; the model moves above the figure

**Kenneth's review of round 12, four asks, every one mocked or measured
before the build** (the mock page grew §5; the grids are 100 seeds per
cell at n = 200 moderate, re-run through the shipping generator):

- **The card above the figure (pick V2)**: title, the exp form in its
  GENERAL shape, the pill-following ln row, and a baseline note — the
  canvas card head (title, formula, gloss) is gone and the forest gained
  its 30px back, keeping one RESERVED line for the too-few-patients
  warning so a bad draw cannot jog the forest (3.4d). The exp row is
  general on purpose: a name-carrying exp row goes false the moment the
  pills disagree with it, and it is one un-wrappable `<math>` — the LIVE
  line is the per-term ln row. The note answers Kenneth's own review
  question in place ("is disease the intercept?"): **h₀(t) is the
  baseline hazard — the intercept's role: every exp(b) multiplies it.**
- **Causal SNPs 0 · 1 · 3 · 5** (default 3) in the data section — the
  generator's ground truth as a data lever (model.js amendment 3):
  the first k of the ten SNPs subtract a year each, and **k = 3
  reproduces the round-8 generator bit for bit** (asserted on seed 7 in
  the drive), so the clean default draw survives untouched. Measured
  detection at the defaults: a lone causal SNP 76%, each of three ~88%,
  each of five ~93%. **The k = 0 finding that needed a call**: 67 of 100
  draws still star at least one null SNP (54 events across 12
  covariates — events-per-variable, the honesty line's cousin), so the
  Significant tile's note computes to "no SNP truly shortens survival in
  this cohort — a starred SNP is a false positive" — licensed because
  the truth is a generator setting the reader chose (the Disease
  effect: None precedent).
- **Follow-up re-pinned to 5 · 9 · 12 · 25** — Kenneth: the old ladder
  (12/15/20/25) "doesn't really do anything"; measurement agreed —
  detection was total from 12 up, no rung failed. The new ladder's four
  lessons: **5 y — the study was not run long enough and NOTHING is
  detectable on either cohort tab** (3 events median, log-rank fires
  26%, Cox 0% on every covariate, 88% of fits refuse with the
  too-few-patients line); 9 y — the strong factors survive (disease/age
  100%) while each SNP drops to ~55% and all-three to 15%; 12 y — the
  default (SNPs ~88%, all-three 70%); 25 y — censoring dissolves, 200
  events of 200. The short rungs exposed a latent generator fault: the
  staggered-entry censoring time `follow − uniform(0,10)` goes NEGATIVE
  below follow 10.5 — a time no axis can draw — so it is floored at 0.5
  (amendment 3's second half; touches nothing at the old ladder).
- **The disease pill starts PRESSED.** Kenneth's confusion ("disease is
  the baseline? it should already be included?") was the finding: the
  reader arrives from Comparing groups holding the disease HR, and the
  tab's question is which OTHER factors matter. Opening with tab 2's
  number re-met is not opening on the tab's own answer — the answer is
  what age and the SNPs do to it. The baseline note carries the
  conceptual correction.

Verified: drive re-pinned at **124 checks** (the ladders asserted
option-for-option; the k = 3 ≡ legacy identity; the F = 5 floor; the
false-positive note firing at k = 0 and not at k = 3; the
disease-default fixes to the ease and readout sweeps); in-browser at
550px — the factors sweep reads NO canvas title, 0 overruns, 0
collisions, end labels present; F = 5 on groups reads "Events 1 of 200"
with log-rank p 0.593 on the default draw; causal=0 shows the note; no
console errors on any tab. `npm run check` green. The catalogue's
round-12 numbers that changed: the follow options and disease default —
everything else stands.

### Round 12 — consolidated to the notebook; the bridge drawn as MathML

**The round opened with an adversarial notebook-vs-widget review against
05-06's own spine**, seeded by Kenneth's three observations: the censoring
page helps (the notebook explains why keeping the data gives good hazard
estimates); the hazard's limit definition may not click and he could not
say which page illustrates it; and the log-rank is never taught — the
course goes straight to Cox. The review's findings: the material maps
almost one-to-one; the hazard is taught twice but was not FINDABLE (the
finding that settled "keep the interval-hazard panel"); and the log-rank
tile is already at its minimum defensible size because **the notebook's
own plot prints a log-rank p** (`pval = T`) that students would otherwise
stare at unexplained. The p tile explains the number the notebook shows;
nothing more was added.

**Every choice was mocked before the build** (`_lab/time-event-round12.html`,
engine-drawn at the shipping defaults — the same page also renders real
MathML for the bridge candidates). Kenneth's picks: **B with MathML,
variant M1** for the ln(h/h₀) bridge — ONE `.w-math` row above the
Finding-factors figure that FOLLOWS THE PILLS (every name in the equation
is a covariate the reader added; resting at the notebook's symbols
b₁x₁ + b₂x₂ + … while no pill is in), `ln` not `log` (the notebook's own
symbol beats the logistic widget's spelling), **L1** for the forest's
direction labels ("← hazard lower · hazard ratio, exp(b) · hazard
higher →", flanking the caption row), and yes to the one-word tile fix.
The row uses lm-interaction's machinery verbatim — the MathML probe with
a plain-text fallback, one `<math>` per term so the all-pills line wraps
at narrow widths (verified wrapping at 340px in the mock) — and sits
exactly where every lm-arc widget puts its formula, so the "we have done
this move before" echo is positional as well as notational. The b-indices
are positions in the CURRENT model, matching how the fit numbers them
(age alone is b₁·age).

**The decided cuts, executed**: "As events" left the `censored` control
(the notebook names ONE tempting mistake — dropping; the second wrong
treatment pushed the same way while doubling the notes), and the
direction line, mechanism notes, lane drawing and readout simplified with
it — at zero censored the note now says "the two readings agree", still
asserted kept ≡ dropped step-for-step. Onset left the data section (Early
baked in: `SHIFT = 6` in the generator, axis fixed at 16 — max event time
at shift 6 is 20 − 0.1·30 − 6 + 5 = 16). The truth overlay left the
Comparing-groups tab (notebook-absent; its misconception job lives on the
Censoring tab, where the kept/dropped comparison IS the lesson) — the
`--c-reference` legend entry went with it; the token's remaining use is
the forest's reference line at 1. **The vocabulary closed**: the HR tile
and the groups summary now say "hazard" where they said "event rate" —
the two panels above the tile both label the quantity hazard, one word.

**One latent defect found by the axis fix**: the interval panel's bottom
tick row painted a "20" at `sx(20)` — off-plot since round 10 fixed the
axis at 16 (at the 550px canvas it landed at x ≈ 656, off the canvas
entirely, which is why no sweep flagged it). The row is [0, 5, 10, 15]
now.

Verified: drive re-pinned at **111 checks** — the parameter roster
(onset/truth asserted ABSENT via the no-parameters-beyond-those check),
kept,dropped the only options, follow 25 dissolving censoring (200 of
200) replacing the late-onset corner, five bridgeHTML fixtures pinning
the b-index logic through the fallback branch, and the dbscan caller
lesson applied (`draw()` provably calls `renderBridge`). In-browser at
550px: all three tabs by DIRECT URL (the TDZ trap), no console errors;
the bridge row above the figure with a real `<mfrac>`, following pill
clicks live, hidden and EMPTIED on the other tabs so the text hash reads
nothing there; fillText sweeps on all three tabs — 0 overruns, 0
same-row collisions, the end labels and direction line painted, no "20",
the dropped product line reading (1−1/3)(1−1/2)(1−1/1) = 0.00 to the
digit. (Two sweep notes for whoever reruns: a display-param click is the
reliable repaint — the resize path yielded nothing under the pane; and
the rotated y-axis label false-positives the overrun check, HANDOVER's
own height-sweep trap.) `npm run check` green. **Still owed: Kenneth's
test pass** (all three tabs at 550px and stacked width, scrub/hover by
hand, judge projected), and only on his "tested ok": shooter, states,
manifest, catalogue mark, the 05-06 link.

### Round 11 — scrub and the hover inspector, on a new core pointer channel

**From the round-10 UX review, both approved.** Core gained a POINTER
CHANNEL — two opt-ins, inert for every widget that does not declare them:
`pointer: true` hands draw() the pointer's drawing-coordinate position and
repaints on idle movement (coalesced to one rAF), and
`animation.scrub(anim, {x, y, w, h, params, state})` +
`animation.scrubHit(...)` let a drag on the canvas hand the reader the
clock — core stops any running animation, calls scrub per move, repaints.
**The scrub writes `anim`, never a parameter**: a playhead was never in
the URL and must not start being (invariant 1). A region click wins over
a scrub where they overlap, the drag block's own rule. The tracking block
registers before the scrub block so the inspector never reads a
one-event-stale pointer.

The widget's use:

- **Scrub**: drag anywhere on a time panel — both directions, tween
  cancelled, `done` re-read (so Play/Replay stays honest). On Finding
  factors only the compact curves scrub; a drag on the forest must not
  move time (asserted).
- **The hover inspector**: a dashed guide at the hovered year and one
  right-aligned reading composed of colour-coded segments — groups tab:
  `year 8.2 · at risk 81 / 62 · survival 0.71 / 0.44` with the counts in
  group colours; Censoring tab: the same for the chosen treatment's
  curve (under "dropped", the at-risk count excludes the dropped).
  **Clamped to the built portion of the sweep — hovering ahead of the
  cursor does not leak the future.** No inspector on Finding factors (the
  card is the focus). Everything the inspector shows also lives in tiles
  or on marks: the lecture screen has no hover (prd §3), so it is a
  convenience, never the carrier.

Verified: drive 99 checks (scrub clamps both ends, cancels the tween,
gates by tab; pointer declared); in-browser synthetic pointer sequence —
scrub changed the hash, the cursor label moved 8.2 → 6.5, the inspector
segments painted; **the full suite ran twice for the core change**. The
first run read five lm-adjustment states DIFFER on `px` only, `tx`
identical on all five; the second run read **198 of 198 identical
including those five** — an environmental flake (the automation pane's
stray-pointer input is HANDOVER's own documented phantom, and
lm-adjustment is a regions widget), the same class as the recorded clt
one-off, now with a five-state instance on record so the next reader
re-runs before believing.

### Round 10 — the copy diet, and Onset as a control

**Kenneth's asks**: strip self-explanatory descriptors, metacommentary and
notebook references from the screen; make the flat head a control ("the
onset as the shift"). Built:

- **The copy diet**: thirteen details removed or trimmed — everything that
  restated its label ("removed from the data entirely" under "Dropped"),
  predicted what the reader would see ("ragged curves, wide bands, a p
  that can fail" — the controls exist so they SEE it), or referenced the
  notebook ("the notebook's five, then five more fixed lanes"). What
  survives carries content the label cannot: kept's "…the Kaplan–Meier
  estimate", Draw's "another cohort from the same population", the three
  curve-overlay meanings, effect-none's "no real difference between the
  groups".
- **Onset (Early · Late)** in the data section: `shift` in the generator
  (6 or 0 years), moving the whole event process earlier. **Default
  early** — the flagged dead head is gone from the default view — and the
  time axis follows (16 at early, 22 at late; asserted). Measured at
  early: the ladder holds (none 2–8%, small 15→66%, moderate 55→100%,
  large saturates at F = 12), and the follow lever now spans "most
  censored" (F = 12, 82 events of 200) to "censoring dissolves entirely"
  (F = 25, 200 of 200 — long-enough follow-up as its own lesson).
  **Follow-up default moved to 12** to keep censoring visible at the new
  onset, and **Draw default is 32** — re-scanned: the one clean cohort at
  the new defaults whose adjusted HR (4.77) also sits inside the forest's
  axis rather than clamped at its edge (the other clean draws run 6–17).
  Onset late + follow 12 remains reachable and extreme (5 events of 200) —
  the corners teach.

Drive: 92 checks green at the new defaults; iframe sweeps 0 overruns at
both onsets; `npm run check` green.

### Round 9 — the Censoring tab plays too; the rail reads data-first

**Kenneth's review of the round-8 controls asked for**: play controls on
the Censoring page (number of patients, number censored); the data section
FIRST in the comparing rail; the view options under their own section with
their descriptors reviewed. Built:

- **The patient table is a control surface, still deterministic**: the
  first five ARE the notebook's table and the defaults reproduce it
  exactly. **Patients (5–10)** extends with five hand-fixed lanes — J ties
  C at t = 6, so ten patients include a tied event (d/n = 2/n on screen).
  **Censored (0–7)** flips statuses in a FIXED order, E and B first, A
  never; the count clamps to the flippable patients (asserted). No draw on
  this tab — the human scale stays a table you can point at.
- **Every "B and E" became computed**: the mechanism notes speak
  `state.censPhrase` ("B, E, F and G leave both the event count and the
  risk set"), the lane reasons apply only while that patient is censored,
  and at zero censored the note says the true thing: "no patient is
  censored — the three readings agree" (asserted: kept ≡ as-events
  step-for-step at c = 0). The round-4 "(B and E)" heading reverted to
  "Censored patients" — the parenthetical could now be false.
- **The product line caps its expansion at five factors** (measured: six
  overruns the 550px panel) and prints
  `survival = product of (1 − h) over N events = X` past that.
- **Rail order**: Concept → The patients (censoring) / The data (cohort
  tabs) → Reading the data / The curves → The model — data before views,
  the reading order of the setup.
- **Descriptors de-jargoned**: "Greenwood" left the bands detail ("95%
  confidence bands — wider where fewer remain at risk"); the shared curve
  says what it is ("all patients pooled — the one curve both groups would
  follow if the disease made no difference"); truth tightened ("every true
  event time, censoring undone").
- Geometry became functions of the patient count (lanes, curve, strip,
  height).

**Open question handed back (the flat head)**: Kenneth asked why nothing
happens for the first ~6 years of the cohort curves and whether that could
be a control. Recommendation pending his call: a control carries no idea
there (3.5) — the honest fix is shifting the event process left in the
generator, which re-measures the grid, the ladder, the follow-up options
and the clean draw; a real but mechanical round.

Drive: 87 checks green; iframe sweeps at 550px over the new corner states
(n = 10 c = 4 dropped; c = 0), 0 overruns.

### Round 8 — the play surface: the widget stops being "thin cosmetics"

**Kenneth's step-back: fixed patient curves were "just making the static
notebook graphs move a bit… thin cosmetics" — research how students could
understand by playing.** The research (a Shiny KM app varying n/censoring/
benefit; The Stats Geek's generate-then-censor simulations; the SERC/CAUSE
applet literature) converges on three causal levers — sample size, effect,
censoring — and the arc's own tradition (CLT's n, power-and-error's effect
ladder, rng.js calling the seed "a first-class pedagogical move") says the
same. This widget was the arc's only one with a locked generator.

**The data section** (both cohort tabs; the five patients stay fixed —
their tab teaches mechanics at human scale): **Patients** 30/60/100/200 ·
**Disease effect** None/Small/Moderate/Large · **Follow-up** 12/15/20/25 ·
**Draw** 1–50. All DATA parameters: moving one draws a new study and the
sweep restarts, which is the point. **The measured grid behind the option
values** (100 seeds per cell, % log-rank p < 0.05): none 3–6% at every n
(the 5% floor — the widget can finally show what NO difference looks
like); small 24/31/53/89% at n = 30/60/100/200 (the power story);
moderate 77→100%; large saturates. Follow-up at n = 200 moderate: doors
at 12 → 7 events of 200, at 25 → 188. **Generator amendment 2** (model.js
header): the SNPs are now BALANCED across groups — the notebook routes
part of the disease effect through SNP prevalence, and a clean "None" must
silence every channel. Default draw re-scanned under the new generator:
**draw 1** (χ² 33.2, adjusted HR 3.85, cell 17's exact story, all nulls
quiet, every bin ordered).

**The Censoring tab's lever: "E drops out at" (1–10).** Moving the
censoring across the events re-derives every later denominator — at
etime 2 the product line reads (1−1/4)(1−1/3)(1−1/2) = 0.25, the first
event now 1 of 4. E's time became a parameter; the four other patients
stay the notebook's.

**Also in the round:**
- **The obtuse header line is GONE** — "Cox regression summarizes the
  ratio as one number" named tab 3's method on tab 2 (Kenneth's catch);
  the HR tile carries the idea method-free, and Cox is named where it is
  taught.
- **The interval claim is now COUNTED**: "disease sits above no-disease in
  2 of 4 intervals" at effect none — the every/most wording could not
  survive a null draw.
- **Small-study honesty**: at n = 30 the 12-coefficient Cox fit runs away
  on 24/50 draws (measured); the card prints "too few patients to pin this
  many coefficients" when a fitted HR leaves [0.02, 50]. The bins panel
  handles zero drawable bins.
- **Core gained `when: { param, oneOf: [...] }`** — the one-line extension
  controls.js's own comment promised, needed because the data section
  shows on two of three concept tabs and `equals` cannot say that. **The
  full fingerprint suite ran for it: 198 of 198 MATCH**, all pre-existing
  states identical.
- Every tile/caption/summary that said "200" now reads the live n
  ("Events 23 of 30"); the p tile's derivation sentence holds at every
  setting ("about 7 in the disease group; 12 happened" at n = 30).

Verified: drive rewritten, 81 checks green, including the play corners
(etime 3 → first event 1 of 4; effect none → p = 0.572 on draw 1;
follow 12 → 5 events of 200; n = 30 clean readouts); iframe sweeps at
550px across five corner states, 0 overruns; `npm run check` green. One
tooling trap recorded: a heredoc batch edit's en-dashes reached Python as
cp1252 mojibake and the asserts refused the write — PYTHONUTF8=1, and the
all-or-nothing batch structure did its job.

### Round 7 — the null, drawn: how the p and the CI are derived

**Kenneth asked how to illustrate the CI and the p-value calculation,
then vetoed the first proposal (an observed-vs-expected ledger panel) as
apparatus rather than intuition, and asked for research on how the
log-rank is actually explained.** The research: the canonical teaching
form is Bland & Altman's BMJ sentence — each death splits between the
groups in proportion to the numbers at risk — repeated across PSU 509,
the GRAPH courses, Real Statistics, StatsDirect. NOBODY draws it; no
interactive log-rank explainer exists. But the standard presentations all
compute the expected counts from "the pooled estimate under the null" —
i.e. **the null hypothesis is itself a curve**, and drawing the claim
being tested is this repo's own move. Kenneth picked B: sentence + the
null drawn.

- **`shared` toggle ("One shared curve")**: the pooled KM of all 200 in
  `--c-theory` dashed — the token's exact meaning, its first use in this
  widget — building with the sweep, under the group curves. Both groups
  visibly leave it in opposite directions; the p is about how far.
  Asserted in the drive script: pooled sits between the group curves at
  t = 12 (0.50 < 0.67 < 0.84 on seed 3).
- **The p tile's note is the derivation sentence with live numbers**: "if
  the groups shared one curve, each event would fall by the risk sets —
  about 44 in the disease group; 76 happened" — obs/exp computed from the
  test itself, so the sentence holds on any seed.
- **The CI's one sentence**, bands on: "each share is estimated from those
  still at risk — fewer patients, wider band" (the panel note slot).
- **Measured and REJECTED, recorded so it stays rejected**: the coverage
  demonstration. The widget's own truth overlay cannot illustrate CI
  coverage — it is the same 200 patients uncensored, correlated with the
  estimate by construction (600/600 inside the band, a demo that always
  "works" for the wrong reason). Against POPULATION truth (200k draws,
  200 seeds) pointwise coverage is 92–98% at most probes but **42% at
  t = 10 in the no-disease group**, where survival ≈ 0.995 and a typical
  study has seen no events yet, so the band is a zero-width point at 1.00
  missing a truth just below it — real, known, and too subtle for this
  widget. No coverage claim appears on screen. The O−E ledger panel and
  the per-event 2×2 walkthrough are also recorded as declined.

Verified frame-free (the pane was not compositing): settled-state hashes
differ with `shared` on, 0 overruns with every overlay on, the bands note
paints once, the tile string exact. Drive: 68 checks green.

### Round 6 — the bars build with the sweep, and Step glides

**Kenneth's two comments**: the histogram should animate as the sweep
passes (and by bin, since the intervals are the unit), and Step should
tween the curves instead of teleporting. Built:

- **The interval bars grow WITH the sweep, inside their bins**: a bar's
  height at cursor t is "events seen so far in this interval ÷ at risk at
  its start" — true at every frame, equal to the final h once the cursor
  clears the interval. Bins ahead of the cursor are absent. The computed
  "disease sits above no-disease…" claim now WAITS for the sweep to clear
  the last bin, so it never describes bars not yet on screen.
- **One Step is a 350ms glide** to the next recorded time — `advance`
  returns true while tweening and false on landing, which stays inside the
  step contract because the glide stops at ONE time point (the widget-15
  walk-the-whole-axis bug was stopping nowhere). Every panel reading t
  tweens with it — both tabs' curves, tab 1's strip and product line, the
  bars. Reduced motion is core's fastForward at dt = 400, which completes
  a step in one pump — asserted in the drive script.
- **Verified frame-free**, because the browser pane had stopped
  compositing mid-session (not displayed — the HANDOVER limitation, worth
  recognizing by its signature: every hash identical, clicks changing
  nothing, a screenshot that times out; the FIRST reading of it as "the
  widget is broken" was wrong). The drive script pumps the tween by hand
  (mid-step the cursor sits strictly between times; landings exact:
  5, 6, 7, 8, 10), and the bar growth was proven with settled `?shown`
  states in iframes — 26/27/28 (t = 13/13.5/14) hash pairwise differently,
  the bar growing INSIDE bin [12,14), and identical URLs reproduce
  identically. Initial paints are synchronous, so shown-states need no
  frames — the svm-sweep lesson, reused.

Drive: 64 checks green.

### Round 5 — the groups tab's hazard panel rebuilt; the H4 pick unwound

**Kenneth's review of Comparing groups: "what are the bars? the x axis is
not aligned to the curve? i am confused what this means."** The diagnosis:
three failures at once. The bars panel sat under the curve in the visual
language of a shared time axis while spanning [10,16] against the curve's
[0,22] — breaking the stacked-panels-share-an-axis contract tab 1 itself
established; the bars were person-time RATES, a quantity defined nowhere
else in the widget, silently switching hazard definitions one tab after
h = events ÷ at risk was taught; and four numbers stood in tension (the
×3.36 claim, per-bin ×6.4/×3.1/×1.7 observed ratios, dashed boxes, solid
bars). **Pick H4 is UNWOUND on this review** — the drawn proportionality
claim confused more than it taught, and the record shows why.

Built as option C: **the hazard by interval, in tab 1's own vocabulary, on
the curve's own axis.** h = events ÷ at risk per 2-year interval, paired
group-colour bars, drawn with the KM plot's own `sx` so the axes CANNOT
disagree; the same title gloss and the same `h = events ÷ at risk` chip as
tab 1 — one hazard definition, met twice, and the bars rise exactly under
the stretch where the curves fall apart. Bins stop once either group has
fewer than 10 at risk (seed 3: at 16 years — beyond, denominators of 5 and
2 are noise; the cut is measured, catalogue round-2 planning, and named in
a note under the panel). The hazard ratio survives as the tile and ONE
sentence, and **the "disease sits above no-disease in every interval"
claim is computed from the drawn bins** — on a seed where an interval
flips, it prints "most intervals" instead, so the screen cannot carry a
false claim (the widget-15 first-press incident class). Rejected
alternatives recorded: aligning the rates panel (cures one failure of
three), and cutting the bars entirely (tab 2 loses its mechanism picture).

Verified: fillText sweep at 550px, 0 overruns, 0 same-row collisions; the
five header/note strings read exactly; no console errors; drive updated —
hazard-bin assertions replace the rate ones, 61 checks green.

### Round 4 — the implication, the formula, and the control's names

**Kenneth's second Censoring-tab pass asked for the implication (does the
hazard read high or low?) and a hazard formula, and for a review of the
Kept · Dropped · As events labels.** The label review found "Kept" the weak
label (kept WHERE is the whole content) and measured the rail's truncation
limit (~13–15 chars per segmented option — the Concept control already
renders "Comparing gr…"), which rules out the textbook-explicit forms.
Approved and built as F1 + F2 + F3 + P1:

- **F1, the formula chip**: `h = events ÷ at risk`, right-aligned on the
  strip's header; the worded gloss stays. The header became two lines and
  the strip moved 14px down for it.
- **F2, the identity**: the product line now reads
  `survival = product of (1 − h): (1−1/5)(1−1/4)(1−1/2) = 0.30` — the
  chip's h and the product's h are one letter, closing strip → formula →
  curve into one loop.
- **F3, the direction line**, wrong treatments only: "smaller risk sets:
  bars higher than kept, survival lower" / "extra events: bars higher than
  kept, survival lower". COMPARATIVE ON PURPOSE — on this tab the truth is
  unknowable (hand data), so "overestimates" would claim what the figure
  cannot show (2.11); the licensed absolute claim lives where the truth
  curve exists, on the groups tab. Both mistreatments push the SAME way,
  which is itself teaching — students expect the two errors to oppose.
  The rise-arrows variant was proposed and deliberately skipped: the ghost
  pairs already show the rise.
- **P1, the heading**: "Censored patients (B and E)" — ties the control to
  the two lanes it acts on; the mechanism notes already speak in those
  names, so rail and stage share one vocabulary. Rejected alternatives
  recorded: verb labels (Keep · Drop · Count as events) read as drive
  actions and sit at the truncation edge.

Verified: fillText sweep across all three treatments at 550px — 0 overruns
and 0 same-row collisions (the new chip shares its line with the direction
text); the three product lines to the digit; no console errors; drive
60/60.

### Round 3 — the Censoring tab's hazard follows the treatment

**Kenneth's review of the Censoring page asked two questions**: how is the
hazard explained, and does it change when the censored are dropped or kept;
and what exactly distinguishes kept / dropped / as events. The review found
the strip pinned to the KEPT reading whatever the control said — hiding
that the hazard is precisely where the treatments differ, because they are
operations on the numerator and the denominator. Approved and built, all
tab-1-local:

- **The strip follows the chosen treatment**, kept bars behind as ghosts
  (the curve's own convention). Dropped inflates every bar — 1/3 for 1/5,
  1/2 for 1/4, and the last patient always "dies" at 1/1; as-events grows
  bars at 7 and 10 that never happened, each ending at 1/1. A bar reaching
  the strip's top rail takes its label INSIDE in surface colour.
- **The product line**: `survival = (1−1/5)(1−1/4)(1−1/2) = 0.30` printed
  under the strip as the sweep collects factors — the bars ARE the curve's
  factors, and the line always equals the Survival tile because it is the
  same arithmetic. Dropped reads `(1−1/3)(1−1/2)(1−1/1) = 0.00`.
- **The mechanism notes name numerator and denominator**, one per
  treatment, kept included: kept — "B and E stay in the risk set until
  they leave, and never enter the events"; dropped — "B and E leave both
  the event count and the risk set — as if never enrolled"; as events —
  "B and E enter the event count at their last visit".

Verified: fillText sweep at the 550px canvas across all three treatments,
0 overruns; the three product lines read to the digit; no console errors;
drive still 60/60.

### Round 2 — restructured to three concepts (Kenneth's step-back)

**Kenneth stepped back to first principles on 2026-08-29**: three questions —
how we track time-to-event and what censoring is; how we determine whether
groups differ (the KM curves); how we find factors associated with the
hazard, where "the SNPs come out of nowhere". He asked for structure
alternatives and an adversarial student-eye review; picked the **3-part
structure with labels option B: Censoring · Comparing groups · Finding
factors**. What round 2 changed:

- **One tab per question.** Censoring keeps the round-1 stage (lanes, curve,
  H1 strip, the `censored` control). Comparing groups keeps the two curves
  and gains **H4, moved out of the Cox card and reframed as the
  introduction of the hazard ratio** — the disease-only model's number,
  "one number at every time", so HR exists before Cox is named. It had sat
  beside the 12-covariate forest where its marginal 3.36 contradicted the
  adjusted 4.37 on the same card — a student would see two disease HRs and
  ask which is right.
- **Finding factors is built BY the reader**: the cohort named on screen,
  the group curves kept compact above (Play still sweeps something), and
  three pills — disease · age · SNPs — the lm-adjustment move from two
  lessons back. Forest rows EASE in (log-HR space, chased like widget 28's
  marks); the Disease and Age rows carry the alone-fit ghost and the move
  annotation ("3.36 → 4.37 with the others held constant"). The SNPs stop
  coming out of nowhere because the reader adds them. All seven pill
  combinations are fit in compute (one per data change), so a pill click
  costs nothing and an ease always has its target.
- **Adversarial fixes**: the two censored lanes name their reasons ("study
  ended", "dropped out") — an unlabelled open circle reads as "survived",
  the misconception in costume; the wrong treatments state their mechanism
  in a panel note ("B and E's event-free years are discarded" / "counted as
  events at their last visit") — mechanism, never a verdict (2.9); the
  groups tab got its cohort caption.
- **Two defects caught in the round**: the collapsed SNP row's label
  "SNP_1 … SNP_10" overran the label column at 550px (now "SNPs"); and
  `ROW_NAMES` declared below `defineWidget` hit the temporal dead zone on a
  page loading straight onto the factors tab — core calls draw() during the
  defineWidget call, the exact lm-adjustment incident, reproduced and
  moved above. The drive script cannot see that class (it never calls
  draw); loading each tab DIRECTLY by URL is the check that does.
- Known judgement item: the per-bin observed ratios on seed 3 read 6.4,
  3.1, 1.7 around the 3.36 claim — the generator is accelerated-time, so
  PH holds only roughly, and the last bin visibly undershoots the dashed
  claim. Recorded, for Kenneth's eye at review.

`_lab/time-event-drive.mjs` rewritten for the structure: 60 checks — the
option-B labels asserted, no gate anywhere, the forest ease pumped by hand
to its targets, 54 readout states clean.

### Round 1 — the draft, from picks H1 + H4

**Kenneth picked H1 and H4 on 2026-08-29; the draft went up the same day** as
`widgets/time-event/` (status draft, on /lab/ only): title *Modeling
Time-to-Event Data*, two tabs on the `concept` segmented control, one motion —
a time cursor sweeps right and the curve builds under it, Step walking the
recorded times one by one. **Five patients**: the notebook's table as lanes
(event dots `--c-event`, censor marks open `--c-unknown`), the KM curve below,
and pick H1 — the hazard strip, bars d/n at each event with no bar at a
censoring, the censor tick on the strip's axis instead. **Two groups**: seed 3
of the model's own generator (the lowest seed telling cell 17's exact story:
Age, Disease, SNP_1–3 significant, all seven nulls quiet — seeds 1 and 2 each
flag a null SNP), KM by disease with censor ticks, optional Greenwood bands
and the truth overlay (`--c-reference`, dashed), and the Cox card — the
12-covariate forest beside pick H4, per-bin event rates with the marginal
claim (coxph ~ Disease, HR 3.36 on seed 3) as dashed outlines.

Decisions the build made, each earned in the session:

- **The `censored` control is `display: true`** — three readings of ONE
  dataset, so toggling compares and never resets the sweep. Verified live:
  three steps to t = 7, toggle to Dropped, survival re-reads 0.33 with the
  cursor unmoved.
- **`cox` is a bool, NOT a `gate`**: core hides the entire drive row while
  any gate is shut (right for pca, whose gate opens the only thing there is
  to drive), and this widget's sweep must keep its Play with the card
  closed.
- **`anim.done` is re-read against the new tab's end in `rebuild`**, so a
  curve finished on Five patients keeps building when the reader moves to
  Two groups instead of Play snapping back to zero.
- **Group labels are pinned where each curve crosses S ≈ 0.6** and drawn
  only once the sweep passes that point — labels that followed the curves'
  ends stacked in the corner when both finished near zero.
- **The Cox card's header and H4's title are two fsXs lines each** — the
  one-line versions overran the 550px canvas every state is hashed at
  (caught by the fillText sweep at a 920px viewport, 0 overruns after;
  first sweep attempt raced a `location.href` navigation and silently swept
  the OLD page — six states reading exactly 24 strings each was the tell).

`_lab/time-event-drive.mjs` (45 checks, no browser): capabilities by name,
cell 17's story on the default seed, the step walk 5/6/7/8/10, the tab
hand-off, `?shown=44` opening finished, and 72 readout+summary states with
no NaN/undefined/Infinity. Not yet judged: legibility at projection; the
truth-overlay colour question (two group truths share one `--c-reference`
dash); the `Survival` tile's treatment-following value.

### The planning record — measured and mocked 2026-08-29

**Slot 5 of the modeling arc (05-06, Time-to-Event Data). The misconception:
censored patients are missing data to discard.** Planned on the 27–30 rhythm:
notebook read with outputs, measure script first, mock second, nothing built.

**What 05-06 stores, and what it does not.** Eighteen cells. The stored
outputs are the five-patient table (cells 6/8 — ID A–E, Time 5/10/6/8/7,
Status 1/0/1/1/0, and its KM plot), the `head` of the simulated 200-patient
draw (cell 12), and the KM-by-disease plot with `p < 0.0001` painted in the
image (cell 14). **Cell 16 — the `coxph` on all 12 covariates — stored NO
output**, so there are no HR digits to verify against; cell 17's prose claims
age and SNP_1–3 as significant. The five-patient KM is verified to the digit
(S = 0.8, 0.6, 0.3 at t = 5, 6, 8; censor marks at (7, 0.6) and (10, 0.3);
median 8; Greenwood log-scale CI 0.5161 at t = 5). The Cox engine is verified
by an independent naive Efron likelihood, the tie-free log-rank ≡ score-test
identity, and scale/shift/time-rescaling invariances instead — recorded in
`_lab/time-event-measure.mjs` (30 checks, all pass).

**THE GENERATOR RULING — the notebook's simulated arm cannot host the
lesson.** Cell 11 draws `Status ~ sample(0:1)` independently of time, so a
censored patient is censored AT the very time their event would have
happened. Measured over 100 seeds against the truth (the same patients
uncensored): **KM on the notebook's design lies HIGH by +0.13 and discarding
the censored is the UNBIASED estimate** — a discard toggle on that data would
teach the opposite of the lesson. With honest study-end censoring (staggered
entry, doors close at 20: observed = min(T, C), event fraction 0.62) the
roles are what the lesson says: KM −0.0002 from truth, discarding −0.081,
consistently low. **So the widget's simulated arm keeps the notebook's event
process and replaces the Status coin with min(T, C).** Under that honest
design the second half of the lesson survives intact: log-rank by disease
p < 1e-4 on 100/100 widget seeds (the notebook's own coin design managed
94/100), Cox finds Age on 100/100 and all three causal SNPs jointly on
72/100, null SNPs at the 5% floor. The five-patient arm needs none of this —
it is hand-made data and fully deterministic.

**Measured for the design:**

- The five-patient stage carries the whole mechanism at human scale: the
  t = 8 step is a halving (1 of 2 at risk) — the at-risk denominator made
  visible. Under the two wrong treatments: dropped → S = 0.667, 0.333, 0
  ("everyone dies by 8"); counted as events → 0.8, 0.6, 0.4, 0.2, 0. Gaps
  beyond t = 8 are 0.30 and 0.20 — 90px and 60px at a 300px axis.
- A 200-patient draw has ~23 distinct event times — a step curve, not a
  staircase blur, at the 550px canvas.
- Seed 1 of the widget generator: 81/200 censored, log-rank χ² = 51.1,
  Cox flags Age, Disease, SNP_1–3 — and SNP_5, a 5%-floor false positive.
  **Choose the default seed with the false positives in view.**

**The mock is `_lab/time-event-stage.html`** (engine-drawn, no hand-placed
numbers): §1 the five-patient stage — lanes above a building KM curve,
cursor mid-animation at t = 7, then the settled figure under a segmented
**Censored: kept (KM) · dropped · counted as events**; §2 the same control at
n = 200 against the truth curve (`--c-reference`, the arc's "you never see
this" motif); §3 KM by disease with the log-rank p as a readout, and the
candidate Cox forest (HR = exp(β), log axis, reference at 1 — the exp(β)
reading returning from lm-adjustment and logistic-regression).

**Kenneth's picks, 2026-08-29:** (1) **two tabs** — *Five patients* ·
*Two groups*; (2) **Cox as a card in the groups tab**, not a third tab.
Still open: (3) a token role for "the method you were warned off" — the
dropped/as-events curves have no semantic colour today (the mock borrows
`--c-highlight` and dashed ink).

### The hazard function, researched 2026-08-29 (Kenneth's ask)

**What exists:** the established teaching visual is Singer & Willett's
paired profile — hazard per interval drawn beside the survival curve, read
as "when hazard is high the survivor drops fast" (Applied Longitudinal Data
Analysis ch. 10; the bookdown reproduction confirms the form: hazard
ĥ(t_j) and survival Ŝ(t_j) as side-by-side panels on a shared time axis).
The analytic route — h(t) = −d/dt log S(t), cumulative hazard as summed
risk (Rodríguez's GLM notes §7.1) — has no workable geometry at this
course's level and is out. No explorable-explanation of hazard exists to
borrow from; what the search surfaces (SurviVIS, CASAS, GraphPad guides)
are analytics tools or prose with static shape galleries (bathtub curves —
reliability framing, not this lesson). The speedometer metaphor for
"instantaneous risk" is prose-only and 2.9 bars it from the canvas anyway.

**The widget-native translation: the discrete hazard d/n is ALREADY ON
SCREEN** — its denominator is tab 1's at-risk count, and cell 2's bullet
(censored patients count in P(T ≥ t) until they leave) is precisely a
statement about that denominator. Four candidates are mocked in
`_lab/time-event-stage.html` §4, all engine-drawn:

- **H1 — the paired hazard strip** (five patients): bars 1/5, 1/4, 1/2
  under the KM curve on a shared time axis; censor times get a tick on the
  strip's axis and NO bar — a censoring is a denominator change, not a
  hazard. The t = 8 halving is the tallest bar. The literature-backed form
  at human scale.
- **H2 — the drop annotated on the curve itself**: each step bracketed
  "d of n = %", no second panel, no new axis. Cheaper; conflates the S
  scale with the h reading.
- **H3 — interval hazard by group** (groups tab): life-table bins
  [6,10), [10,12), [12,14), [14,16), [16,20), h = d/n at bin start.
  Measured: disease sits above no-disease in every bin on seed 1, and the
  ordering holds on 100/100/100/98/78 of 100 seeds per bin — the last bin
  has 2 at risk (the small-denominator caveat, itself teachable). The
  rising profile is real: an ageing cohort.
- **H4 — the Cox claim on the hazard scale** (companion to the Cox card):
  per-bin event rates per person-time, with the one-covariate Cox claim as
  dashed outlines — every baseline bar × the same exp(β). Restricted to
  bins [10,16): [6,10) has zero baseline events (an outline at 0 against a
  visible bar reads as failure and is only an empty cell) and [16,20) has
  ~0 person-time in the disease arm. Seed 1: HR = 4.24 marginal (it
  absorbs the SNP effects the 12-covariate fit adjusts away), observed
  per-bin ratios 6.8, 3.5, 4.4. **The generator is an accelerated-time
  process, so PH holds only roughly** — right for a card that teaches what
  "proportional" claims, wrong for a goodness-of-fit demonstration.

## Widget 30 · `lm-interaction` — SHIPPED 2026-08-28, two review rounds

### Act 1 revived — age × BMI, the fan (2026-08-29, Kenneth's queue)

Round 1 cut the two-continuous act ("the same lesson with a fan in place
of a crossing"); Kenneth revived it post-ship to mirror the notebook's
three sections. The tab is the notebook's ggPredict picture (cell 13):
totChol against age, the model drawn at BMI 20/30/40 — parallel under +,
a fan CROSSING at age 57.2 under × (where the BMI effect passes zero) —
plus a probe reading the AGE SLOPE at a chosen BMI: 1.97 at 20, −0.32 at
40, sign flip at BMI 37.2, all measured additions to lm-int-measure.mjs
(37 checks; the two fits themselves were verified to the digit at the
original planning). The equation card gained a general per-level rows
form; the legacy women/men output is BYTE-IDENTICAL and a full suite run
proved it: **217 of 217 MATCH**, nothing recorded moved. The patients are
one neutral cloud on this tab — BMI is on neither axis, which is why the
model must carry it. Concept order now mirrors the notebook (act 1 first)
with the default still agesex (the approved opening story). THE LEGEND NOW FOLLOWS THE TAB.
Kenneth's "fix the legend" was first read as the mixed-model generic
ruling (Group A/B, canvas names the groups) — shipped, and REJECTED the
same hour: "the legend should match the graph — now it's too generic."
The real fix opened a core door: **legend may be a FUNCTION of the
parameters** (widget.js — resolved at build, re-resolved in recompute(),
a no-op for every static array; the item-builder is shared so the two
render paths cannot drift; a live legend gets its ul even when one tab
shows fewer than two entries, hidden per render). lm-interaction now
declares three per-tab legends: the sex tabs name women and men and what
the highlight reads there (the sex gap at the chosen age; the
interaction bracket), the fan tab names the BMI levels and the probed
slope. The 13 states were re-shot TWICE in one day (generic, then live —
px identical both times, asserted at splice), three act-1 states added,
and the core change ran the full suite: **220 of 220 MATCH**, the 207
static-legend states proving the door touches nothing that does not
open it.

**Promoted on 2026-08-28 after Kenneth's "tested ok" — measured, mocked,
built and revised over two rounds in one session.** Title **Fitting an
Interaction**. **Ten fingerprint states recorded with
`_lab/lm-int-shoot.html`** (the lm-shoot pattern: copy proved 4/4, every
state shot three times and identical, every drive non-inert): six
settled (the empty open; the independent fit with the probe's constant
−5.0; the crossing with the four-row card in tx; the extrapolation; the
2×2 parallel; the 2×2 pivoted), three driven mid-ease (the split, the
zero slide, the 2×2 pivot — each with counting labels), and one
hit-driven on the probe's year-40 region — an instant param flip, so
zero frames ran, and the hash still differs from its bare URL, which is
the per-year hit geometry proven. Baseline now **198 states**; no
full-suite rerun owed (nothing in `widgets/core/` moved).

**Still owed:** the 05-04 notebook link (Kenneth places these by hand):
`Explore interacting covariates: [Fitting an Interaction](https://nusmedicine.github.io/statml/widget/lm-interaction/)`
— and judging it projected, which every widget from 11 on awaits.

The planning record follows as written.

### The original planning record — MEASURED 2026-08-28

**The brief:** 05-04 (Modeling — Interactions), catalogue slot 4: main
effects can be read unconditionally when an interaction is present. The
notebook's three acts, all on totChol (the frame is the arc's, n = 3547):
age × BMI (continuous × continuous), age × sex (continuous ×
categorical, ggPredict's crossing lines), diabetes × sex (2 × 2). The
old deferred-table caution — that this concept "may be technical rather
than abstract" — dissolves on measurement: the whole lesson is two
lines crossing.

**Verified** (`node widgets/_lab/lm-int-measure.mjs`): **33 checks pass**
— all six models' stored outputs to the digit, plus the saturated-2×2 =
cell-means identity at 1e-9.

**Measured before design:**

- **Act 2 (age × sex) is the flagship.** With `age:sex` in, "the sex
  effect" prints **+95.57** — and that number is the gap AT AGE ZERO,
  32 years left of the youngest patient. In the data the gap runs +24.2
  (age 35) through zero (the lines cross at 46.9) to −37.0 (age 65) —
  **28–42px at panel scale, fully legible**. Slopes 2.29 (women) vs
  0.25 (men). R² 0.074 → 0.113.
- **The independent model is the setup, not filler**: its two lines are
  5 units apart (sex1 = −5.0), so the `+`→`×` toggle SPLITS a
  near-single line into opposite slopes — the ease has something big to
  do.
- **Act 3 (diabetes × sex)**: diabetes raises totChol by **+21.0 in
  women and −0.02 in men**; the independent model's "+10.18" is an
  average of 21 and nothing; the interaction (−21.02) IS the difference
  of differences. Cell ns 1913/44/1543/47 — the honesty note.
- **Act 1 (age × BMI)**: both slopes become functions (BMI slope flips
  sign at age 57.2, age slope at BMI 37.2; "the age effect +4.27" lives
  at BMI 0). Same lesson as act 2 with a fan of near-parallel lines in
  place of a crossing — **proposed OUT**, its one extra fact (both
  coefficients go conditional) a caption.

**The mock-up page is BUILT** —
[`_lab/lm-int-stage.html`](../widgets/_lab/lm-int-stage.html): **§1** the
stage (A1/A2 the `+`/`×` frames the toggle eases between; B the PROBE —
an age slider bracketing the live sex gap, the "effect" read as a
function); **§2** the extrapolation drawn — the axis extended to zero,
the fitted lines diverging across 32 shaded years of empty axis to the
+95.57 bracket ("real, exact, and about nobody"); **§3** act 3 as a
candidate second tab (means, per-group arrows, the independent model's
one-size answer as ghost dashes).

### ROUND 1 — Kenneth picked, and the draft is BUILT the same day

**The probe IN, the extrapolation IN, acts 2 + 3 as TABS** (act 1 out).
`widgets/lm-interaction/` — imports the shared stage; title **Fitting an
Interaction**. The shape: two Concept tabs (**Age × sex · Diabetes ×
sex**); widget 26's gate opens the model on the data; the core control
is the notebook's own operator — **Terms: + independent · ×
interacting** — and THREE eased values drive everything (widget 28's
chase): `a` the gate's alpha, `t` the model mix (lines, prediction
ticks, arrows and every printed gap are computed from the LERPED
coefficients — widget 29's counting-label rule, so no number is false
mid-frame), `z` the axis extension (dots, lines, ticks and the shaded
no-patients stretch share one lerped x-domain — widget 28's slide).
Age × sex: patients coloured by the group tokens, the two lines easing
between one-slope-5-apart and crossing-at-46.9; the PROBE (slider, and
the whole stage is click regions — one per year of age, the slider the
keyboard path) brackets the live gap; **Show age zero** slides the
domain to [0, 69] and brackets the printed [sex] coefficient where it
lives — under `+` that bracket honestly reads −5.00 (the offset IS
unconditional there), under `×` it reads +95.57. Diabetes × sex: the
four observed cell means stand still while the model's prediction
ticks ease between the one-size +10.18 and the saturated
+21.0-in-women/−0.02-in-men; the arrows read from the eased
predictions. Tiles: R² and the interaction coefficient (em-dash under
`+`, "no product term in this model"). Equation card: the generic row
gains the b₃x₁x₂ term when × is chosen; concrete terms per tab.
compute() is fully deterministic — no rng, no seed. Height 356, both
tabs. Verified on screen: gate, both toggles' eases caught mid-flight
(labels counting), the zero slide with its shaded stretch, both tabs'
equations and tiles, zero console errors, `check` green.

### ROUND 2 — the formulas follow the lines, and the 2×2 becomes an interaction plot

**Kenneth: a bit hard to understand — show the formulas that correspond
to the graph's changes, and find a clearer 2×2.** Researched and mocked
in `_lab/lm-int2.html`, both fixes picked and built the same day:

1. **The equation card grows ONE ROW PER LINE on the graph** — the
   notebook's own "rearranging the terms" move (05-04 cell 23) made
   permanent: women's and men's equations in their line's group colour,
   the men's row annotated with the sums that produced it
   ("125.41 + 95.57, and 2.29 − 2.04"; on the 2×2 tab
   "21.00 − 21.02: the effect is gone"). Toggle `+`/`×` and the rows
   rewrite with the lines — the graph and the algebra are one object.
2. **The 2×2 is redrawn as the INTERACTION PLOT** — the canonical
   two-factor display (cell means joined by one line per group;
   parallel = no interaction), which is also what the notebook's own
   ggPredict draws in cell 36, and which gives BOTH tabs one picture
   grammar: two lines per sex, the x-axis reduced from a continuum to
   two positions. Under `+` the lines are parallel (both rise 10.18)
   and visibly miss the observed ticks; under `×` they pivot onto the
   means, and a right-edge bracket names the nonparallelism against a
   dotted if-parallel ghost — the difference of the two rises IS the
   printed interaction, 21.02, counting in with the ease. The observed
   means are fixed group-coloured ticks; round 1's four floating bars,
   per-bar prediction ticks and vertical arrows are DELETED — they were
   the hard-to-read part. The legend's empirical entry went with them.
   Verified on screen: group rows on both tabs and both readings, the
   pivot caught mid-ease with counting labels, the parallel state's
   missed ticks, zero console errors, `check` green.

## Widget 29 · `lm-categorical` — SHIPPED 2026-08-28, one review round

**Promoted on 2026-08-28 after Kenneth's "tested ok" — measured, mocked,
built and shipped in ONE session and one round** (the picks — stage C,
sex out of scope — landed the design whole; the arc's shared machinery
did the rest). Title **Fitting a Categorical Covariate**. **Seven
fingerprint states recorded with `_lab/lm-cat-shoot.html`** (the lm-shoot
pattern: copy proved 4/4, every state shot three times and identical,
every drive non-inert against its bare URL): four settled (the empty
open; the fitted default; releveled to obese; reference underweight),
one driven mid-fade (the gate at partial alpha), one driven mid-relevel
(the rule between two means, arrows re-anchoring, labels counting), and
one hit-driven on the obese COLUMN — which hashes identical to the
set-driven state (the same parameter write through the same door, the
same four frames) and different from its bare URL, which is exactly the
region geometry proven. Baseline now **188 states**; no full-suite rerun
owed (nothing in `widgets/core/` moved). `lm-cat-measure.mjs` was
current at promotion — no stale block to update.

**Still owed:** the 05-03 notebook link (Kenneth places these by hand):
`Explore dummy coding interactively: [Fitting a Categorical Covariate](https://nusmedicine.github.io/statml/widget/lm-categorical/)`
— and judging it projected, which every widget from 11 on awaits.

The planning record follows as written.

### The original planning record — MEASURED 2026-08-28

**The brief:** 05-03 (Modeling — Categorical Covariates), catalogue slot 3:
dummy coefficients are group means, and the reference level is a finding
rather than a choice. The notebook's own arc: sex as a 0/1 dummy inside
the BMI + age model (ggPredict's parallel lines, coefficient −2.25), the
`model.matrix` coding shown twice, then BMI recoded to four categories
(underweight < 18.5 / healthy / overweight / obese ≥ 30) with healthy as
reference — 125.78, obese +17.72, overweight +8.42, underweight −7.36 —
then modelsummary/ggcoefstats. **05-03's frame is 05-01's exactly**
(filter(BPMeds==0) + drop_na, n = 3547), so the arc's shared stage
(`lm-least-squares/data.js`, which carries SEX) serves unchanged.

**Verified** (`node widgets/_lab/lm-cat-measure.mjs`): **25 checks pass** —
every stored output in 05-03 to the digit (the sex model's full
coefficient/SE/t/CI/R² block; the BMI_cat model's block), plus the two
identities the widget stands on, asserted at 1e-9: **group mean =
intercept + coefficient** (a dummy coefficient IS a difference of group
means), and **the relevel changes every coefficient while R² and the
fitted means are identical to machine precision** (reference = obese:
intercept 143.50, healthy −17.72, overweight −9.30, underweight −25.08).

**Measured before design:**

- **The offsets are ALIVE in data space** — obese 18.5px, overweight
  8.8px, underweight 7.7px at the arc's 230px/[80,300] panel — which
  widget 28's moves never were. The coefficients can be drawn as ARROWS
  from the reference's ruled mean; no forest is forced.
- **The sex offset is 2.4px — two parallel lines cannot carry the sex
  act.** The notebook's ggPredict picture fails at our scale (drawn
  honestly in the mock's §4). Sex alone is n.s. (t −1.90), adjusted
  significant (t −3.57) — but that is widget 28's lesson. **Proposed
  scope: the widget is the BMI-category act alone**, sex at most a
  caption line (k = 2 means one dummy — the offset).
- **R's default reference is the ALPHABET** (healthy < obese <
  overweight < underweight) — the opening gift: the default is literally
  an accident, so "the reference is a choice" needs no argument.
- **Group ns: 48 / 1595 / 1480 / 424** — underweight's thin column shows
  WHY its SE is 2.96, and on relevel to obese that SE moves to 3.08: the
  SE belongs to the PAIR being compared.
- Categorising BMI loses 21.4% of the continuous R² (0.1065 → 0.0837) —
  measured for honesty; whether it enters the widget is a scope call.

**The mock-up page is BUILT** —
[`_lab/lm-cat-stage.html`](../widgets/_lab/lm-cat-stage.html): **§1** the
stage (A columns + mean bars + coefficient arrows at full window; B the
means alone zoomed to 108–152 with the sums written; C = A beside B,
the zoom as magnifier — the recommendation); **§2** the relevel drawn as
before/after (reference healthy, then obese — every arrow re-anchors,
the means stand still); **§3** the coding table, category-rows (the
reference row all zeros — why its mean is the intercept); **§4** the sex
act at true scale, drawn to be seen failing.

### ROUND 1 — Kenneth picked, and the draft is BUILT the same day

**Stage C, and SEX IS OUT OF SCOPE** (not even a caption line — "don't
overcomplicate", the round-9 rule). `widgets/lm-categorical/` — imports
the shared stage; title **Fitting a Categorical Covariate**. The shape:
the widget opens as data and a question (four jittered columns, no
model — widget 26's gate, "Fit the model"); the gate reveals the mean
bars, the reference's dashed rule, the coefficients as ARROWS from rule
to means with their signed labels, the zoomed means ladder (108–152)
beside the columns with guide lines carrying each mean across, the
equation card (widget 27/28's machinery — indicator terms wear their
category name in brackets, one <math> per term), and the coding table
full-width below (category rows, the reference row all zeros and
outlined). **The relevel is the punchline**: a Reference segmented (its
healthy option's detail says "R's own default — first in the alphabet,
not a medical choice") plus the category COLUMNS as click regions; on
relevel the RULE eases to the new reference's mean (widget 12's ease,
one value) and the arrows — drawn live from the eased rule to the fixed
means — re-anchor with it, their labels the signed distance from the
EASED rule so no printed number is false mid-frame; the equation and
the zero row rewrite; the R² tile's note says "identical for every
reference level — the model never changed". Term order everywhere is
BMI order (cell 36's own order; R's alphabetical print is the same
accident the reference teaches). The ladder drops below 400px of stage
width (nothing to magnify into). Heights 334 shut / 520 open. Verified
on screen: gate, relevel by column click (URL ref=obese, equation
rewrites 143.50 − 25.08·[underweight] …, the ease caught mid-flight
with labels counting), coding table follows, zero console errors,
`check` green. Only randomness: the dots' x-jitter, seeded, hidden.

## Widget 28 · `lm-adjustment` — SHIPPED 2026-08-28, twelve review rounds

**Promoted on 2026-08-28 after Kenneth's "tested ok" — planned, measured,
mocked, built and revised over twelve recorded rounds across two
sessions** (rounds 1–7 built the concept-strip draft; 8 merged Fit and
Adjust; 9 scoped weight and retitled; 10 struck VIF from the first tab
and made the move annotation symmetric; 11–12 rebuilt Collinearity as
persistent twins + a VIF section and dropped its strip). Title
**Fitting Multiple Covariates**. **Eight fingerprint states recorded
with `_lab/lm-adjust-shoot.html`** (the lm-shoot pattern: copy proved
4/4 against recorded hashes, every state shot three times in one run
and identical, every drive checked non-inert against its bare URL):
five settled by URL (the empty open; the merged page; the FWL end
state; Collinearity at subject weight; subject age via `vifvar`), one
driven mid-slide (`set view=resid`, vmix ≈ 0.64, both panels in
flight), and two hit-driven — the DAG's age node at [60, 164] catching
the forest marks MID-EASE (the pills are buttons `setParam` cannot
drive, so the node is both the exercised region and the only driven
path to the ease), and age's VIF bar at [500, 660], which hashes
identical to the `vifvar=age` settled state and different from its bare
URL — exactly what a region hit should do. Baseline now **181 states**;
no full-suite rerun owed (nothing in `widgets/core/` moved since its
last green run at 173). **The measure script gained the shipping-twin
block at promotion** (`lm-adjust-measure.mjs`, 25 checks: the old
±3-jitter block still verifies the notebook's own arm; the new block
reproduces the widget's weight construction draw-for-draw — r 0.933,
VIF 7.7 ± 0.2, weight n.s. 187/200, b(BMI) 1.502 ± 0.208, R² untouched
to 4 dp at seed 1).

**Still owed:** the 05-02 notebook link (Kenneth places these by hand),
and judging it projected, which every widget from 11 on awaits.

The planning record follows as written.

### The original planning record — MEASURED 2026-08-28

**The brief:** 05-02 (Multiple Covariates), the Table 2 fallacy — a
coefficient is not THE effect of its variable; it is the effect *in this
model*. The notebook's own arithmetic is the lesson: BMI's coefficient is
**1.721 alone and 1.499 with age in the model** (−12.9%), age's is 0.924
alone and 0.836 with BMI (−9.5%), and "held constant" is what the change
means. Second act in the same notebook: collinearity — `BMI_related =
jitter(BMI, 3)`, the twins split the coefficient, the SEs inflate, VIF
detects it.

**Verified** (`node widgets/_lab/lm-adjust-measure.mjs`, on the shipped
shared stage `widgets/lm-least-squares/data.js` + `model.js`): **21 checks
pass** — every deterministic 05-02 stored output to the digit (all three
models' estimates, the full SE/t/CI/R² block for `sysBP ~ BMI + age`,
df = 3544), plus FWL asserted exact (the age-residual scatter's slope IS
1.4990839, to 1e-9). **The collinearity cells cannot be verified to the
digit and the script does not pretend to**: the notebook's `jitter()` is
unseeded (HANDOVER's standing warning), so the arm is measured across 200
seeds instead — which is what a seeded widget can honestly claim.

**Measured before design:**

- **Two slopes on the scatter CANNOT carry this widget.** The unadjusted
  and adjusted BMI lines differ by **1.8–3.1px** at widget 27's panel scale
  (1.7–2.9 mmHg across the 1%–99% BMI window). Widget 26's candidate-A
  treatment is dead here before being drawn; the −12.9% move needs a stage
  where coefficients are marks, not slopes — the notebook's own closer is a
  three-model `modelsummary` table and a `ggcoefstats` forest.
- **r(BMI, age) = 0.125** — the confounding is real but the correlation is
  modest; the move comes from age's strong link to sysBP (r = 0.373). A
  design that implies "BMI and age are highly correlated" would lie.
- **The FWL residual view is available and exact** (widget 26's motion,
  reusable): regress both axes on age, and the residual cloud's slope is
  the adjusted coefficient. Residual windows: BMI −7.6..12.7, sysBP
  −36.6..61.0.
- **The collinearity arm is stable across seeds** with `BMI + U(−3, 3)`:
  the twin is n.s. in **186/200** seeds, b(BMI_related) = 0.002 ± 0.191
  (the notebook's 0.0249 is one draw), SE(BMI) inflates ×2.50 — √VIF
  predicts ×2.52 — and VIF(BMI) is 6.34 ± 0.12 against the threshold 5.
  Every number the widget would print survives reseeding.
- n = 3547 fixed, same frame; the only randomness is the twin's jitter,
  which the widget would seed.

**The mock-up page is BUILT** —
[`_lab/lm-adjust-stage.html`](../widgets/_lab/lm-adjust-stage.html): §1
three coefficient-stage treatments (A paired forest, B eased marks with
ghosts — widget 12's motion, drawn at its end state, C the three-model
slopegraph); §2 the FWL slide drawn as before/after; §3 the collinearity
act at seed 1 (the twin forest and the notebook's own VIF bars) for the
scope ruling; plus the numbers table and the rail/ghost/seed/R² questions
in prose.

**ROUND 1 — Kenneth picked, 2026-08-28, all from the mock-ups:** **B eased
marks** for the coefficient stage (the switches pick the model, a mark
EASES to its new value, the alone-reading stays as a ghost); **the FWL
slide in**, behind a View; **the collinearity act IN**, behind an "Add a
twin covariate" gate — 05-02 stays whole in one widget; **two switches**
for the rail (BMI in model / age in model — four states including the
empty model); and, from the widget-27 session, **the residual strip rides
along**: the current model's residuals against its fitted values, the
cloud tightening as covariates enter (sd 21.1 → 19.9 → 18.7 — R² made
physical). Build follows as a draft.

### BUILT AS A DRAFT — the same day

`widgets/lm-adjustment/` — imports the shared stage across widget dirs
(widget 26's arrangement; `../lm-least-squares/data.js` + `model.js`). The
shape: **two switches** build the model from empty (sysBP = 131.31, R² 0);
the **forest** shows each coefficient as an eased mark with its CI, the
alone-reading staying as a faint empirical ghost whenever the model holds
more than that covariate — so 1.72 → 1.50 is a watched move on a fixed
−0.6..2 axis; the **scatter** below carries the model's line (the 3px
non-event, drawn because it is true) and slides to the **FWL view** behind
View: Age removed — origin crosshair, the slope line drawn ONLY for the
exact model (BMI + age, no twin) where FWL holds to 1e-9; **widget 27's
residual strip** under the scatter, against fitted values (the empty model
stands its residuals in one column — everyone predicted the same number);
and the **twin act** behind a gate: a third forest row straddling zero,
CIs ×2.5, the VIF panel with the extreme-dashed 5, a seeded Seed control
(1–200) because the notebook's own jitter is unseeded. Tiles: R²,
Residual spread (21.1 → 19.9 → 18.6), Largest VIF while the twin is in.
The equation card is widget 27's, grown to many terms — one <math> per
term (widget 14's wrapping lesson) and a negative coefficient folds its
sign into the operator. Height is a function of the twin (590 / 642).

**One core-contract lesson, earned twice now:** `anim.easing = true` in
`rebuild` is the REQUEST FOR FRAMES — the first build omitted it and every
mark stood at alpha 0 for ever while the ghosts drew, exactly the class of
bug the fingerprint's driven states exist to catch. The main.js comment
now says so.

### ROUND 3 — pills, the clickable DAG, the plane, the table, and the strip becomes a CONCEPT strip

**Kenneth's four comments (mocked in `_lab/lm-adjust2.html`), all in, plus
the structure ruling.** The widget is now staged by a **Concept** segmented
— Fit · Adjust · Collinearity — one idea per tab, while the reader's model
persists: the covariate switches are **rounded PILLS** (`style: "pill"` on
`bool`, a small core addition — a toggle button whose aria-pressed IS the
state; the suite ran for it: **173 of 173 MATCH**), and the **DAG is the
control** (05-02 cell 9's own triangle; covariate nodes are click targets
through `regions`, the pills the keyboard path; the age–BMI link is a
DASHED ASSOCIATION labelled r = 0.12 — a directed arrow would claim
causality, which is fork-pipe-collider's lesson, not this widget's).
Per tab: **Fit** = the three-model table (canvas-drawn, current column
outlined to match the pills) and the scatter carrying **the plane as a
family of lines** (one per age 35–65, same slope, lifted 0.836/year —
"held constant", drawn); **Adjust** = the eased forest + ghosts + the FWL
slide; **Collinearity** = the twin act, now UNGATED (entering the tab IS
the act; the twin's Seed shows there). The residual strip rides under the
scatter in every tab — and unlike widget 27 it does NOT share the
scatter's x-axis (fitted ≠ BMI with multiple covariates), so the scatter
kept its own BMI axis and the gap grew to hold it (caught on screen: the
first cut left the scatter's x unlabelled). **The 3D plane was considered
and declined**: pca's turn/tilt machinery makes it buildable, but
held-constant-as-parallel-lines is strictly clearer in 2D at projector
size, which is why ggPredict itself draws the family. Two blemishes fixed
on sight: forest row labels right-aligned (they reached into the DAG's
sysBP node), and heights are per-concept (608 / 608 / 658).

**For the baseline, recorded now:** the pills are `<button data-param>`,
which the fingerprint's `setParam` cannot toggle — drive states by URL or
by `hit` on the DAG's regions (which the hit rule wants exercised anyway).

### ROUND 5 — the table moves to Adjust, and the twin becomes WEIGHT

**From Kenneth's student/UX review (mocked in `_lab/lm-adjust3.html`):**

1. **Fit and Adjust overlapped because the table was on the wrong tab.**
   The three-model table is a COMPARISON — Table-2 material — and it
   spoiled Adjust's punchline from the Fit tab. It now sits beside the
   scatter on Adjust (compacted: short headers, no intercept row), and the
   forest ANNOTATES the move ("1.72 → 1.50 when age enters", arrows on
   every ghosted row; value labels moved below the whiskers to clear
   them). Fit's right panel became **fit-quality bars** — R² against 1,
   residual spread against the no-model 21.1 — what fitting owns.
2. **Collinearity now shows its failure.** The DAG grows a fourth node on
   that tab — **weight**, ringed and linked to BMI by a dashed
   `--c-extreme` **r = 0.93**; the scatter slot shows THE TWINS AGAINST
   EACH OTHER (the correlation graph itself); VIF bars stay. The
   wandering-split panel (§2C) was drawn and DECLINED — Kenneth does not
   want "seed" explained on screen — and the **Seed control is hidden**
   (the parameter survives for URL and harness).
3. **The twin became WEIGHT, and the construction is a measured ruling.**
   Kenneth's framing: a data scientist includes every variable without
   asking whether two carry the same information — and BMI IS
   weight/height². The file has no weight column, so weight is simulated
   as BMI × height². **Sex-specific heights FAILED the measurement**: the
   weight/BMI ratio identifies sex, sex relates to sysBP, and weight came
   out significantly NEGATIVE in 86% of seeds with VIF only 2.9 — the
   widget would have taught that weight lowers blood pressure. **Unisex
   N(1.68, 0.05)** instead: r = 0.933, VIF 7.7 ± 0.2, weight n.s. in
   187/200 seeds, b(BMI) unbiased (1.502 ± 0.208 vs 1.499), CI ×2.76 —
   and R² and residual sd IDENTICAL to four decimals with or without
   weight: prediction untouched, attribution broken, which is the honest
   name of the failure. The screen says "weight is simulated from BMI and
   a plausible height" on the twins panel.

### ROUND 7 — both marginals, the twins apart, VIF drawn

**Kenneth's picks from `_lab/lm-adjust4.html`, all in.** The Fit tab shows
**BOTH MARGINALS at once** (his pick A over the x-axis control): sysBP
against BMI and against age side by side — 05-02's own ggpairs move — each
panel carrying the model's reading of its covariate with the other held at
three bands (the plane seen from each side; band labels right-aligned
inside the frame after the clip ate their last digit). **Weight is a real
pill** (third bool, visible on the Collinearity tab, membership persisting
across tabs so the model never changes behind the reader's back): the
twins are clickable APART, and the lesson sharpened — weight ALONE is a
perfectly good model (0.53 mmHg/kg, tight CI, its ghost in the forest);
only both together break. All **8 models** are computed; VIFs for every
≥2-covariate set, so bmi + age's quiet ~1.0 pair is the contrast that
makes 7.7 mean something. **VIF is drawn, not defined**: the Collinearity
panel shows the largest-VIF covariate against WHAT THE OTHERS PREDICT FOR
IT — the cloud hugs the diagonal at R² 0.87 with the arithmetic in the
caption (R² → VIF = 1/(1−R²) = 7.7); drop weight and the same panel shows
the bmi–age blob at VIF ≈ 1. It replaced the twins-vs-each-other scatter,
which was the same cloud without the arithmetic; the honesty note
("weight is simulated…") rides on it. The weight DAG node is a third
click region; the DAG goes 4-node whenever weight is in the model or the
tab is Collinearity; the strip is full-width on every tab.

### ROUND 8 — Fit and Adjust merge into MODEL

**Kenneth's question — the Fit tab's band families already show "held
constant", so how is Adjust different? — was the seam failing a second
time**, and the answer (researched, mocked in `_lab/lm-adjust5.html`,
adversarially argued both ways) is that it cannot be drawn: **a band
family IS the adjusted slope drawn**, so fitting and adjusting are one
act seen in two spaces, and any seam between them leaks. Round 5 had
already moved the table off Fit to stop the same overlap and invented
fit-quality bars to fill the hole (which duplicated the R²/spread
tiles) — two rounds of patching plus his own proposed fix (Adjust keeps
both marginals, making Adjust a superset and Fit vestigial) is the
evidence the seam was misplaced, not mis-drawn. The measured constraint
that sorts the pieces: the 1.72 → 1.50 move is 1.8–3.1px in data space,
so ONLY the forest can carry it, while the panels carry the conditional
reading. The literature agrees on co-location: the 3D-confounding study
(PMC1192815) got its gains from LINKING the crude/confounder/adjusted
projections, not from 3D; Westreich & Greenland's Table 2 fallacy lives
in the coefficient table read against a DAG; visreg/ggPredict treat the
band family as the display of ONE model and the added-variable plot as
what adjustment did. 05-02 itself has no page break between fitting and
adjusting. Considered and killed in the mock's §4: stratified scatter
(same 2–3px measurement), two slopes on one panel (dead since planning),
3D (round 3's ruling stands), Venn (breaks under suppression).

**Kenneth picked M merged, WITH the table, with the FWL view.** Built
the same day:

- **The Concept strip is two tabs — Model · Collinearity** (`concept`
  values `model`/`collinear`; old `fit`/`adjust` URLs fall to the
  default). One page, both spaces: a pill click fans the band families,
  eases the forest mark off its ghost, moves the tiles, tightens the
  strip — everything at once, on one screen. Staging is the empty start
  and the pills, not tabs.
- **The forest sits beside the DAG on BOTH tabs; the fit-quality bars
  are deleted** (they duplicated the tiles — invented in round 5 only to
  give Fit something to own, which was itself the tell).
- **The three-model table is a full-width row under the marginals**,
  transposed to models-as-rows (`~ BMI` · `~ age` · `~ BMI + age`
  against b(BMI) / b(age) / R²) so a formula label survives every stage
  width; the current model's row is outlined when it is one of the
  three. A model holding weight has no row — its story is the forest's
  and the Collinearity tab's. The merge's price is height: 778 (858
  with weight in), against the old 608.
- **The FWL slide rides on BOTH panels** (View: Data · Other removed):
  each covariate and sysBP with the OTHER regressed out, each residual
  slope exactly its adjusted coefficient — 1.50 left, 0.84 right; the
  old Adjust showed the why for BMI only. Both y-axes are labelled in
  residual space (they no longer share a variable). The slide is
  guarded to the exact BMI + age model; otherwise the panel notes what
  to change ("put BMI and age in the model…" / "…take weight out").
  New right-panel window measured: age|BMI spans −18.4..20.9 →
  `R2X_DOM [-20, 22]`; sysBP|BMI shares RY_DOM.
- Collinearity is untouched (its <2-covariate fallback scatter was
  inlined into draw() when the old shared branch dissolved).
- Verified: canvas text sweep clean (no NaN; annotation, table, both
  residual axis pairs all painted), forest/table numbers read 1.72/0.92
  ghosts and 1.50/0.84/0.22 current, heights exact (778/858), no
  console errors, `npm run check` green. One blemish caught on screen:
  the table title sat 8px under the panels' x-axis labels at +40; the
  gap is +56 now.

### ROUND 9 — the tab says Fit and adjust, weight acts on its own tab, the title is the notebook's

**Kenneth's three comments on the merge, same day, all in:**

1. **The first tab is labelled "Fit and adjust"** (value `fit`, so the
   round-3 legacy URLs land on it), not "Model" — the merge keeps both
   words because both concepts live there; only the page split is gone.
2. **Weight acts on the Collinearity tab ONLY** — round 7's cross-tab
   persistence is REVERSED (Kenneth: the fit-adjust page demonstrates
   BMI + age adjustment and nothing else; don't overcomplicate).
   `twinActive` now requires `concept === "collinear"`, and `keyOf`/
   `dagWide` follow it, so with `?weight=1` the first tab shows the
   3-node DAG, the 2-row forest, the BMI + age equation and the `ba`
   fits — while the `weight` parameter survives the tab switch and the
   Collinearity tab restores the reader's composition. The VIF tile is
   scoped to Collinearity too (the quiet ~1.0 added a number the first
   tab does not teach), and its note now claims only what any
   composition shows ("one covariate predicted by the rest" — the old
   text said weight explains BMI even when weight was out). The
   "take weight out" gate note died with the scoping; heights are now
   fixed per tab, 778 / 688.
3. **Title: "Fitting Multiple Covariates"** — 05-02's own name, the
   sibling of widget 27's "Fitting a Linear Model" — with the subtitle
   defining what that means (several covariates fitted together; each
   coefficient read with the others held constant, a property of the
   model, moving when the model changes). Blurb and meta unchanged —
   they already describe the adjustment content; `check` green on the
   title agreement across card, <h1>, <title>.

### ROUND 10 — no VIF on the first tab, and the annotation goes symmetric

**Kenneth's three asks for the Fit-and-adjust page.** (1) **The legend's
VIF entry is deleted** — the legend is static core-side, so any entry
shows on every tab; the Collinearity tile's note names the threshold
instead ("above 5 flags collinearity — one covariate predicted by the
rest"). (2) **BMI and age were already off by default** — verified
against the served bare URL (both pills aria-pressed false, the empty
131.31 model); the review links' `?bmi=1&age=1` is what pre-builds the
model. (3) **The move annotation is contextual by being SYMMETRIC, not
by tracking click order** — order is not a parameter and parameters are
the only state of record (non-negotiable 1: the same URL must always
draw the same figure, and the fingerprint would read an order-dependent
canvas as flaky). Every moved row now carries its own sentence naming
the covariate that moved it: "1.72 → 1.50 when age is added" on the BMI
row, "0.92 → 0.84 when BMI is added" on the age row — so whichever pill
the reader clicks second, the row that eases is the one whose sentence
just appeared, and both of Kenneth's orderings read correctly. With two
or more others in the model (the Collinearity tab's three-covariate
case) the sentence says "when the others are added". Verified by canvas
text sweep: both fit-tab sentences and all three collinear variants
paint; no collisions on screen; `check` green.

### ROUND 11 — the Collinearity tab: persistent twins, and the VIF check becomes a SECTION

**Kenneth's complaint: click weight and the scatter "suddenly switches"
to the VIF regression** — the same seam class the merge fixed on tab 1
(the data view replaced because the model changed, nothing announcing
it). Researched against the notebook and mocked in
`_lab/lm-adjust6.html`; **Kenneth picked candidate A** (candidate B —
the diagnostic behind a View, tab 1's grammar — was argued in prose and
declined by the pick). The authority is 05-02 itself, cells 32–53:
first the act ("only one of the covariates is significant"), then a
separate subsection *"Using a VIF to detect collinearity"* that walks
EACH covariate with the formula visible — `lm(age ~ BMI +
BMI_related)`, R² → VIF = 1/(1−R²) — then `car::vif` and the bar plot.
Fit first, then check; the widget now keeps them as two visible steps.

Built the same day:

- **The twins' marginals are PERSISTENT** — sysBP against BMI and
  against weight, dots always, the panels never swapped for a
  diagnostic; each carries the model's reading of its covariate (others
  at means). This also repairs a missing half-lesson: with both twins
  in, **weight's line goes flat (0.01/kg) under a cloud that plainly
  rises** — attribution broken in data space — while R², the strip and
  the lines barely move (prediction untouched, previously only stated).
  The panel says so: "the model's line: 0.01 per kg". Swapping the
  panels to BMI + age when weight is out was considered and rejected —
  panels switching content is the very complaint; this tab's fixed pair
  is the twins, its subject.
- **"Detecting collinearity — VIF" is a page section** below the
  panels: recipe line ("regress each covariate on the others — what
  they explain inflates its variance"), then the formula CONCRETE —
  `weight ~ BMI + age → R² 0.87 → VIF = 1 ⁄ (1 − R²) = 7.7` — above the
  prediction panel, VIF bars beside it. **The bars are click targets**
  (`vifvar`, a hidden segmented set through `regions`; rects from
  `vifLayout`, one copy of the arithmetic for draw and regions —
  widget 26's lesson): clicking age's bar makes the section read
  `age ~ BMI + weight → R² 0.02 → VIF = 1.0` over the blob — the
  notebook's one-covariate-at-a-time walk (cells 44–49) as an
  interaction, verified end-to-end (URL gains `vifvar=age`, formula and
  panel and emphasis all move). An invalid subject falls back to the
  largest VIF. With fewer than two covariates the section stays and
  fills in ("put two covariates in the model to test for
  collinearity") — it never appears or vanishes. The honesty note rides
  under the panel, now VIF-conditional: high → "weight is simulated
  from BMI and a plausible height", low → "the others know almost
  nothing about it" (the old members-based text claimed weight explains
  things even when the displayed subject was the quiet pair).
- Heights: collinear 966 (was 688); fit unchanged at 778.
- **One bug earned its comment**: `SUBJ_OF` as a module-scope const
  BELOW the defineWidget call threw
  `Cannot access before initialization` on first paint — core calls
  draw() during defineWidget itself, so consts after that call are
  still in the temporal dead zone. It lives inside the function now.
  And the two stale console errors it left survived the fix in the
  panel (the 50-cap trap) — a fresh `window.onerror` counter read 0.
- Verified: canvas text sweep clean (formula, recipe, fill-in note, all
  twins captions; no NaN); bar-click regions live; fit tab untouched;
  `check` green.

### ROUND 12 — the strip leaves the Collinearity tab

**Kenneth: the residual plot should sit between the fit views and the
section — or is it distracting and better deleted here? Deleted, with
agreement**, reversing round 3's every-tab ruling for this tab only.
The reasoning: on Collinearity the strip's whole message is "the
residuals did not change when weight entered" — a NON-EVENT no reader
can see without comparing two states from memory; the residual-spread
tile states it as a number (18.6, unchanged to four decimals), the
twins' stable lines show it in data space, and the detection section is
the tab's rightful closer. On Fit and adjust the strip STAYS — there
the cloud visibly tightens as covariates enter, which is that tab's
lesson, so it earns its pixels. Heights: fit 778 (unchanged), collinear
966 → **852**. Verified: fit tab still paints the strip ("fitted
sysBP" in the text sweep), collinear ends on the section, no NaN,
`check` green.

**The original open questions** (superseded above): the stage —
a coefficient forest that models enter and leave (the notebook's own
closer), the FWL residual slide (widget 26's motion), or forest + scatter;
whether the collinearity act lives in this widget behind a gate ("Add a
twin covariate") or is deferred — 05-02 teaches both, but the catalogue row
names only the Table 2 fallacy; and what the rail's data/model split is
when the data never changes.

## Widget 27 · `lm-least-squares` — SHIPPED 2026-08-28, seven review rounds

**Promoted on 2026-08-28 after Kenneth's "tested ok" — planned, measured,
mocked, built and revised over seven review rounds in one day.** Six
fingerprint states recorded with `_lab/lm-shoot.html` (the causal-shoot
pattern): copy proved 4/4 against recorded hashes, every state shot three
times and identical, both driven states checked against their settled
sibling. Four settled (the open at the notebook's (70, 2); a second held
line; the grid open, minimum unmarked; the finished walk via `shown=999` —
whose `tx` hashes the three-row equation card), two driven (mid-crawl at
t = 3000 of ~4000 via Fit; one exact minimisation via Step). The settled
states carry `shown=0` because `check` requires a widget declaring `shown`
to pin it. Baseline now **173 states**; no full-suite run owed — the one
core change (`--c-cost-low/high` + `env.js`) ran the suite the day it
landed, 167 of 167 MATCH, and nothing in core moved since.

**Still owed:** the 05-01 notebook link (Kenneth places notebook links by
hand — it joins 06-02's, still unplaced), and judging it projected, which
every widget from 11 on awaits.

The planning record follows as written.

### The original planning record — MEASURED 2026-08-28

**The brief:** 05-01's own pedagogy is the widget — pick a line by hand, watch
the sum of squares, then see that the fitted line is the MINIMUM of a surface,
not a formula's output. The notebook does exactly this (cells 9–23: a
`sum_squares` function, a hand-picked b₀=70/b₁=2 line, a 31×51 grid heatmap of
SS over b₀ ∈ [0,150] × b₁ ∈ [0,5], then `optim`, then `lm`), so the widget's
moves and vocabulary are already the lesson's.

**The shared machinery is built and verified** (the `causal-model.js`
pattern, planning copies in `_lab/`):

- [`_lab/lm-data.js`](../widgets/_lab/lm-data.js) — the arc's Framingham
  stage, GENERATED by [`_lab/lm-data-gen.mjs`](../widgets/_lab/lm-data-gen.mjs)
  from the notebooks' own CSV, never typed (the widget-15 heredoc lesson).
  Frame verbatim from 05-01 cell 2: `filter(BPMeds==0) + drop_na` over all 16
  columns → **n = 3547**, head spot-checked against the printed six rows.
  Carries the six columns the whole arc needs (05-02/03/04 formulas grepped:
  sysBP, BMI, age, sex, totChol, diabetes) at 76 KB of source; the
  (BMI, sysBP) pairs alone are 36 KB.
- [`_lab/lm-model.js`](../widgets/_lab/lm-model.js) — one exact OLS (normal
  equations, k ≤ 5 across the arc) plus 05-01's `sum_squares`. Exact, not
  the notebook's Nelder-Mead: 05-01's own `optim` run lands 0.03 off `lm()`'s
  intercept, and `lm()` is what every printed coefficient comes from.
- [`_lab/lm-measure.mjs`](../widgets/_lab/lm-measure.mjs) — **18 checks, all
  passing**: n, df = 3545, b₀ = 87.068295, b₁ = 1.721042, SE 2.178396 /
  0.08373255, t 39.96899 / 20.55403, R² 0.1064831, adj R² 0.106231, both 95%
  CIs at the notebook's qt = 1.960633, and the SS grid's four printed corners
  (62 737 626 at (0,0) …) to the digit.

**Measured before design** (`node widgets/_lab/lm-measure.mjs`) — the facts
the mock-ups must answer to:

- **The surface's relief is the design problem.** SS spans 1 410 293 at the
  minimum to 62.7M at the grid's (0,0) corner — **44.5×** — while the whole
  teaching range sits in the bottom 10%: the flat mean line (b₁ = 0, b₀ = ȳ)
  reads 1 578 362, only 10.6% above the minimum — that gap IS R². A linear
  colour or height scale over the notebook's grid washes the entire
  interesting region into one band; the scale (log, windowed, or
  relative-to-minimum) is a design decision, not a styling one.
- **The valley is a 13:1 diagonal trench** on the notebook's own square plot
  (Hessian eigen-ratio after axis scaling), because x is uncentred so b₀ and
  b₁ trade off. 30 of 1581 grid cells sit within 5% of the true minimum.
  A contour view draws long diagonal ellipses, not a bowl around a point —
  which is honest (many near-equally-good lines) and is also why `optim`'s
  answer differs from `lm`'s in the second decimal.
- **The real data is displayable as-is.** 3 547 points on a 500×380 stage:
  3 167 distinct pixel positions, worst pixel holds 4, only 231 pixels hold
  more than one. No subsampling needed.
- **Axis window matters**: full ranges BMI 15.5–56.8, sysBP 83.5–295 are
  outlier-stretched; the 1%–99% window is 18.1–38.5 / 96.5–197.5 and holds
  3 417 of 3 547 points.
- SS at the notebook's own hand-picked line (70, 2): 1 762 150 — 25% above
  the minimum, a good "close but standably wrong" opening.

**The mock-up page is BUILT** —
[`_lab/lm-stage.html`](../widgets/_lab/lm-stage.html), all candidates drawn
on the real data with the reader's line at the notebook's own hand-picked
(70, 2). Four sections, each a design question for Kenneth's pick:
**§1 stage composition** (A scatter + SS meter strip; B scatter beside the
surface at ~250px each; C scatter above the surface, ~500px tall — the
natural gate shape); **§2 the surface's scale** (linear = the notebook's own
wash, log, capped at 3× the minimum, banded — capped is what §1's panels
wear); **§3 the misfit on the scatter** (no marks / all 3547 residuals at 5%
alpha / 60-patient squares — the captions carry 2.11's case against the
squares); **§4 what "Fit" reveals** (snap vs walk; the drawn walk is
coordinate descent from the notebook's `optim` start (0, 0) — two moves
reach the trench, then the crawl along it IS the 13:1 elongation, with the
SS-per-step curve beneath). The open interaction questions (sliders vs
dragging the line, the gate, the axis window and its 2.11 note) are prose at
the page's foot. `ssQuad` joined `lm-model.js` for the surface panels —
the O(1) closed quadratic, self-checked against `ssLine` at load.

**ROUND 1 — Kenneth picked, 2026-08-28, all six from the mock-ups:**
**C behind a gate** (scatter + SS tile first; the surface opens below on
request — 3.4b's shape); **sliders first** (b₀/b₁ are the notebook's own
`c(b0, b1)`; dragging the line may join a later round as the 5.6 shortcut);
**the walk** for Fit (a descent path, the line swinging as the point
slides); **capped at 3×** for the surface's scale; **every residual, faint**
for the misfit; **full range** axes (every patient on stage — no 2.11 note
owed).

### BUILT AS A DRAFT — the same day

`widgets/lm-least-squares/` — `data.js` and `model.js` moved in from `_lab/`
(the lab pages now import FROM the widget, widget 26's arrangement, so there
is one copy). The shape: b₀/b₁ sliders (data parameters — moving one
abandons a walk in progress, the honest reading), the residual wash always
on under the dots, the gate opening the surface below (height 358 → 686),
and the walk as the one animation — **coordinate descent from the reader's
own line**, exact 1-D minimisations, Step = one of them, Fit = the whole
walk on a fixed ~4 s schedule (two 700 ms opening moves, the crawl sharing
2.6 s — equal time over shrinking moves is a deceleration, so the crawl
reads as a crawl from any start; no speed control, widget 12's
one-gesture-one-ease reasoning). The minimum's cross is drawn only once the
walk has found it (non-negotiable 4 applied to the answer); `?shown=N`
pre-walks N segments.

**Two core additions rode along, and the full suite ran for them: 167 of
167 MATCH.** `--c-cost-low` / `--c-cost-high` in tokens.css — a cost painted
over a parameter space, the role the surface needed and no existing token
honestly carried (nonevent/event are outcomes; extreme is past a threshold)
— and their lines in `env.js` `readTokens`. The surface is rendered once
per size/theme into an offscreen bitmap and blitted per frame (~10k O(1)
`ssQuad` evaluations, never per-frame fillRects).

**Verified before handover** (browser + the node stub-driver, no screenshots
trusted for facts): tiles read the measured values exactly (your line at
(70, 2) = 1,762,150; the fit = 1,410,293 at b₀ 87.07, b₁ 1.72); the gate
toggle preserves a finished walk and a slider move resets it (invariant 3
both ways); `?shown=999` lands the done state; Step advances exactly one
vertex per press — **229 presses to done from (70, 2)**, verified in node
(the pane's throttled rAF makes a browser count meaningless). A reader who
steps is expected to step a few times and press Fit; whether 229 available
presses needs a cap is a review question.

### ROUND 2 — Kenneth's three comments, same day

1. **The equation is MathML now**, written the way 05-01 writes the lm
   equation: a `.w-math` card above the figure (widget 14's machinery —
   layout-probed, mounted lazily from `draw()`, memoised on the numbers,
   plain-text fallback). "your line sysBP = 70 + 2.00 × BMI", joined at the
   walk's end by "least squares sysBP = 87.07 + 1.72 × BMI" in the fit's
   own colour. The canvas caption that carried the equation is gone.
2. **ONE line, and the walk moves it.** The second (reference-coloured)
   walking line is deleted: the reader's line itself travels the descent —
   its residual wash and its surface dot ride along, so the wash visibly
   thins as the sum falls — and it changes to `--c-reference` when it
   arrives, which is also when the fitted equation appears. The fit tile is
   live mid-walk ("walking — b₀ …, b₁ …"). A slider move still resets
   everything to the reader's own line.
3. **Stack vs beside is a live A/B behind a TEMPORARY hidden param**:
   `?arrange=row` puts the surface beside the scatter (height stays
   shut-size ~358; each panel ~half width; the surface goes nearly square,
   which helps the trench) against the default stack (both panels full
   width; open height ~686). The loser gets deleted and the winner
   hardcoded — a layout A/B is not a reader control, so it never renders
   as one.

### ROUND 3 — the row wins, the descent question, the reframe

**Kenneth picked BESIDE.** The `arrange` param is deleted and the row is
the only layout: gate shut, the scatter has the whole width; open, it cedes
the right half to the near-square surface and the height never moves (358).
The two notes the half-width panels could not hold moved to the legend —
the cost ramp's two ends are legend entries now (`cost-low` / `cost-high`
swatches), which also names the surface's colours somewhere permanent.

**"Is the descent what is actually done, or the shortest route?" — neither,
and the copy is audited to claim only what it draws.** The walk is
coordinate descent (each move an exact 1-D minimisation — Step's title says
exactly that). 05-01's `optim` is Nelder-Mead, a tumbling simplex that is
illegible at widget scale; `lm()` walks nowhere (closed form); and nothing
takes the shortest route, because a straight line to the minimum requires
knowing the answer first. The teaching — the fit is the surface's minimum,
findable by walking downhill — is algorithm-independent, and the main.js
header now records the ruling so no later round makes the widget claim to
be `optim`.

**Reframed as LINEAR MODEL + FITTING** (Kenneth: the linear model is the
arc's central theme; this widget is its fitting chapter). Title **Fitting a
Linear Model**; subtitle opens by defining the model, then fitting as a
search; blurb/meta re-paired; the equation card labels are "your model" /
"least-squares fit"; tile 1 is "Sum of squares — your model". The slug
stays `lm-least-squares` — it names the method that does the fitting.

### ROUND 4 — a scale instead of a sentence, and the arrival made visible

1. **The ramp's words became a colour scale.** The two cost legend entries
   (round 3's "saturates at 3×…") are deleted; a gradient bar under the
   surface runs 1× → ≥3×, captioned "sum of squares, × the least possible"
   (the caption drops below 220px of bar, endpoint ticks stay). The cap is
   shown, not said.
2. **The finished line wears `--c-empirical`, not `--c-reference`.**
   Reference aliases the same ink-3 grey as the 3547 unknown dots, so the
   line the whole widget walks toward arrived invisible — Kenneth caught it
   on screen. Empirical is also the audited ROLE for exactly this mark ("a
   fit the reader built from the data"), so the fix is semantic, not
   cosmetic: the fitted equation, the legend entry and the landed surface
   dot all moved with it. The landed dot is empirical blue on the trench's
   cost-low blue (both alias series-1), so its surface-coloured ring went
   to 2px and the ink-1 cross still marks the minimum.

### ROUND 5 — the notebook's word is GRID, and a drag report not reproduced

**"Surface" → "grid" on every reader-facing surface** (Kenneth's catch):
05-01 itself says "a grid of b0 and b1 values" (cell 14) and never says
surface, so the widget now speaks the lesson's word — the param is `grid`
(URL `?grid=1`, gate key `gate-grid`), the gate reads "Hide the grid" with
detail "a grid of every (b₀, b₁) pair, coloured by its sum of squares", and
the subtitle ends "…the sum smallest over a grid of every line you could
draw." Source comments keep "surface" where they mean the mathematical
object. The module also gained a typeof-window guard on the MathML probe so
the node stub-drivers can load it.

**Kenneth reported the slope slider would not drag, and it could not be
reproduced by any driven path**: real pointer drag at two widths (b₁ moved
2 → 3.95), synthetic input events, mid-walk, in the shown-done state; the
input is uncovered (elementFromPoint at five points), enabled, and a change
costs 1–2 ms. Two true findings came out of the sweep: **`shown` survives
in the URL after a slider move** (`?b1=…&shown=999` — the figure is honest,
the address is stale; same class as the deferred core item "a published
`step` survives a data change", and the same core fix should clear both),
and **the pane's stray-input phantom is alive** — b₀ drifted 70 → 67 → 69
between two probes with no action taken, which is why nothing here trusts
a screenshot for a fact.

### ROUND 7 (post-ship) — the R² tile, from the sums already on stage

**An R² tile joined the readout on Kenneth's ask**, revealed with the fit:
0.11, noted "variance explained by the model — 1 − fit ⁄ flat-line sums".
It is 05-01's goodness-of-fit section computed from the two numbers the
reader has already watched (the fit's sum is SS_residual; the flat mean
line's is SS_total), and it hands the baton to lm-adjustment's 0.106 →
0.218. The rebaseline: **6 tx moved and exactly 0 px** — the diff the
change predicts, since the canvas is untouched — recorded by re-running
`_lab/lm-shoot.html` (copy proved 4/4, three-run stable) and spliced in
the same commit.

### ROUND 8 — RESOLVED: the strip is in, and the grid opens by default

**Kenneth picked B, plus grid-on default.** Built the same day: a permanent
residual strip under the scatter (STRIP_H 80; height 426 everywhere), the
line's own residuals live — band off zero = b₀ wrong, tilted trend = b₁
wrong, and at the walk's end the trend lies flat on the ruled zero in the
fit's colour: the stopping condition visible. **The strip shares the BMI
axis** so each patient's residual sits directly below its dot, and it
carries the x-axis for both panels (the mock drew vs fitted; for one
covariate the two are affine-identical, and alignment wins under a stacked
panel). The trend is closed-form (tilt = simple-fit b₁ − yours, offset =
ȳ − b₀ − b₁x̄) — no per-frame regression. **`grid` now defaults ON**; the
minimum stays unmarked until the walk, so the widget still does not open
on its answer, and `?grid=0` keeps the scatter-alone state (settled state 3
moved to that URL). The rebaseline: **6 px moved and exactly 0 tx** — the
mirror of round 7's diff, as a canvas-only change predicts; re-shot by
`lm-shoot.html`, copy proved 4/4, three-run stable, drives non-inert.

### ROUND 9 — the strip loses its trend line; the dots carry it

**Kenneth: no fitted line in the strip — the dots should move around the
centre.** The trend line is deleted and the y-window tightened from
[−70, 130] to **[−50, 70]**, which is what makes the dots' own drift
legible (a 10 mmHg offset is now ~7px; in the wide window it was ~4px and
the trend line was doing all the talking). Each dot is that patient's
residual from the current line, so the cloud sits off the ruled zero for a
wrong intercept, tilts for a wrong slope, and settles around zero as the
walk lands. Dots an absurd line pushes past the frame are clipped — an
honest reading. Rebaseline: **6 px, 0 tx** again, three-run stable.

### The round-8 mock, as it was drawn

**[`_lab/lm-resid.html`](../widgets/_lab/lm-resid.html)** draws the
residual plot Kenneth asked to see, with the framing that fits THIS
widget's lesson: the residuals of the READER'S OWN LINE, live with the
sliders — offset = b₀ wrong (+9.9 at the notebook's line), tilt = b₁ wrong
(−0.14 per fitted mmHg; the shallow (110, 0.6) line tilts +1.87 the other
way), flat at zero = fitted, which is literally the walk's stopping
condition. Two placements drawn: **A** a View toggle on the scatter panel
(Data / Residuals, the 26/28 slide, height unchanged — legible at the
250px gate-open width because the view is a band, not a cloud) and **B** a
permanent strip under the scatter (~90px of height on every state). What
neither can teach on the real data: curve/funnel = wrong model class —
sysBP ~ BMI is an adequate fit, so that lesson stays with the proposed
synthetic-data diagnostics widget, and the two would not overlap (this
reads a LINE's residuals, that reads a MODEL's). Awaiting Kenneth's pick:
A, B, or neither.

### ROUND 6 — the generic form leads the card

**`y = b₀ + b₁x` now heads the equation card**, muted, labelled "the
model" — 05-01's own order (cell 5 states the generic form before any
numbers exist), and it is what names b₀ and b₁ for a reader who arrives
without the lesson. The card reads: the model (ink-2) / your model /
least-squares fit (empirical, on walk completion).

**RESOLVED — Kenneth: "it had the stop sign and dropped off", and now
works.** The 🚫 cursor names the mechanism: a native drag-and-drop, not a
slider drag. With any text or element selected on the page (a double-click
suffices), the next press-and-drag lifts the SELECTION as a drag ghost and
the range input under it never sees the pointer; releasing "drops" it and
everything looks dead. Stock browser behaviour, not widget code — which is
why no driven path could reproduce it. If it recurs, the guard is
`user-select: none` on the rail — one line in core's tokens.css, invisible
to both hashes (the rail is outside them) but still a core change owing a
suite run; not applied because a selection-drag is rare and the fix would
also make control labels uncopyable.

## Widget 26 · `fork-pipe-collider` — SHIPPED 2026-08-27, nine review rounds

**Promoted on 2026-08-27 after nine rounds of Kenneth's review in one day —
planned, measured, built, revised and shipped in a single session.** Eight
fingerprint states recorded with `_lab/causal-shoot.html` (the missing-shoot
pattern): the copy proved against four existing baseline hashes (4/4 MATCH),
every state shot three times in one run and identical, and **every driven
state checked against its settled sibling in the same run** — the shooter now
automates the mds/balancing-data lesson. Five settled (the empty open, the
fork dressed, the pipe residual view, the collider pair, the collider
residual view), two driven mid-ease (the swing at mix ≈ 0.56, the slide at
vmix ≈ 0.64), one **hit-driven** on the third variable's node at [94, 56].
Baseline now **167 states**; no full-suite run owed — nothing in
`widgets/core/` moved since its last green run.

**Still owed:** the link from PHM5003 06-02's markdown (it would be the first
widget link in the notebooks — Kenneth places it by hand), and judging it
projected.

The planning record follows as written.

### The original plan — PLANNED AND MEASURED

**The brief:** one widget, a Structure control (Fork / Pipe / Collider) and one
toggle — **Adjust for Z** — flipping between the notebook's own regression
pairs. The vocabulary is exactly 06-02's: fork/pipe/collider, exposure,
outcome, adjust, open/blocked paths. The notebook deliberately never says
"backdoor" or "mediator", so neither does the widget.

**The three generative models are VERBATIM from 06-02** (cells 8/22/37), in
[`_lab/causal-model.js`](../widgets/_lab/causal-model.js), shared by the
measure script, the mock-ups and eventually the widget — one OLS, one set of
generators. Verified against the notebook's stored outputs at seed 1,
n = 1000: fork unadjusted **−0.397** (notebook −0.401), adjusted **+0.110**
(+0.082), collider unadjusted **0.003 n.s.** (0.024 n.s.), adjusted **−0.180**
(−0.181).

**Measured before design** (`node widgets/_lab/causal-measure.mjs`, 200 seeds
per cell):

- **n is 1000 and gets NO control.** The fragile arm is the fork's adjusted
  effect: +0.1 against SE ≈ 1/√n is significant 11% of the time at n = 50,
  32% at 200, 51% at 400, **87% at 1000**. A smaller, prettier n would teach
  "adjusting made it go away" — the opposite of the lesson. The other traps
  fire at every n (pipe 94–99%, collider 82–100% from n = 200).
- **The sign flip itself is 100% at every n** — only the significance star on
  +0.1 wavers, which argues for CI readouts over stars.
- **The R² trap is real in both directions**: pipe 0.95 → 0.99 and collider
  0.00 → 0.22 — the WRONG model fits better, which is the widget's kicker.

**The design question for review — what does "adjust" LOOK like** — is drawn
at the real 550px width in
[`_lab/causal-stage.html`](../widgets/_lab/causal-stage.html): **A** two
slopes on the scatter (unadjusted / adjusted / truth dashed), **B** the
scatter coloured by Z with per-stratum fits (adjustment as comparing like
with like; age quartiles for the fork, ICU groups for the collider), **C** a
coefficient forest closest to the notebook's tables, plus the DAG panel in
adjust-off/on states with ggdag's open/blocked path colouring. Known blemish
to fix in the real widget: fitted lines need clipping to the plot frame.

**Open questions for Kenneth:** which stage treatment (or combination — DAG +
scatter + coefficient tiles is the current guess); whether the fork's
continuous-Z strata may wear cluster colours (they are bins we assigned, which
strains the token's "groups nobody assigned" reading); rail shape under the
data/algorithm rule (Structure + Seed = the data; Adjust = the model, and
Adjust is `display: true` — both fits computed per `compute()`, the toggle
only re-reads them, exactly `confidence-interval`'s method pattern).

### BUILT AS A DRAFT — round 1 (2026-08-27)

Kenneth picked **candidate A with the DAG beside it**. Shipped as
`widgets/fork-pipe-collider/`, status draft: DAG left (boxed adjusted node,
open paths in `--c-extreme`, blocked as faded dashes, a one-line verdict),
scatter right with the two slopes, truth dashed on request. Rail: *The data*
(Structure, Seed, True effect) / *The model* (a "Fit the model" gate so the
widget starts as data and a question, then Adjust). All toggles display-true;
both fits computed up front. Verified by DOM drive (all six structure×adjust
states read the mock-up's numbers) and a six-state canvas text sweep (clean;
the centred pipe verdict clipped at 550px by arithmetic and ships
left-aligned).

### ROUND 2 — Kenneth: click the node, show Z, and should the fit move?

Three asks, all in: **the third variable's node is a click target** flipping
`adjust` (a `regions` entry built from `dagLayout()`, the one copy of the
geometry; no region while the model is unfitted, since 3.6 wants the control
visible); **Colour by the third variable** tints each patient
`--c-nonevent` → `--c-event` (5th–95th percentile scale for the continuous
age/HR, the exact endpoints for ICU) — the clue to *why* adjusting moves the
fit; and **the adjusted line now EASES** between the unadjusted slope and its
own, widget 12's mechanism for widget 12's reason: two readings of the same
data, and the samples are seen not to move while the model changes. No drive
buttons (`stepLabel: null`, `runLabel: null` — the drive row is Reset alone);
a data change lands instantly by `init`. The ease answers Kenneth's "useful
or distracting?" with the repo's own precedent rather than taste; if it reads
as noise in review, deleting the `animation` block reverts it whole.

### ROUND 3 — "the colors do what here?", and the squished collider

Kenneth's two comments, one answered by measurement and one fixed:

- **The band-line bridge is KILLED, measured before it was drawn.** The
  obvious way to link colour to fit — thin fit lines inside each colour band
  — teaches the OPPOSITE: within quartile bands the fork's slope is still
  −0.38 to −0.30 (a 15-sd age is too wide to de-confound by quartile), and
  the pipe's is 5–9 against an adjusted −0.04. In `causal-measure.mjs`,
  ROUND TWO section. **The added-variable view is exact instead**: regress
  both axes on the third variable and plot the residuals — the slope IS the
  adjusted coefficient by Frisch–Waugh (0.110 / −0.040 / −0.180 to the
  digit), and the tint visibly STOPS RUNNING anywhere, which is the proof
  the third variable is out. Drawn for all three structures in
  `causal-stage.html` round two, beside the killed candidate; the open
  interaction choice ((a) a View control once fitted, dots tweening between
  views, or (b) tied to Adjust) is stated on the page. Awaiting Kenneth.
- **The collider's frame stops at the 99th percentile** (was min-to-max of a
  squared normal, which crushed 95% of patients into the corner). The
  caption counts what is past the frame — "18 of 1000 past the frame — the
  fits use them all" — because the window is where you look, not what the
  model saw.

### ROUND 4 — the added-variable view ships as a View control

Kenneth took recommendation (a). A **View** segmented — *Data / Third
variable removed* — appears once the model is ADJUSTED (gated
`when: adjust=on`, because the residual cloud IS the adjusted picture and a
view of it beside an unadjusted readout would disagree with every tile).
Every patient slides between its data position and its residual position — a
second eased quantity beside the line-swing, odds-and-risk's two-ease
pattern — with each view's lines fading with its share of the slide. In the
residual view both residuals are mean-zero, so the adjusted slope is drawn
through the origin and equals `adj.beta[1]` exactly (FWL); the note says
"the slope of this cloud is the adjusted coefficient", and with the tint on
the colours visibly stop running anywhere. The collider's residual frame is
quantile-clipped like its data frame, with its own past-the-frame count.
Verified: all three structures' residual captions and axis labels by text
sweep, the readout consistent in every reachable state, and the View
control disappearing when Adjust flips off (the cloud slides home).

### ROUND 5 — the collider's blocks, ruled: B for the collider, the slide stays for fork and pipe

Kenneth watched the collider's residual slide and asked why the block moves
up, whether it should disappear, or be "distributed along the fitted line".
The answer was measured before it was drawn (`causal-stage.html` round
three): the slide IS the controlling (each ICU group minus its own
averages), the blocks cannot honestly disappear, and his instinct has an
exact form for a BINARY third variable — **one slope, two intercepts**,
05-03's parallel lines, with the pooled within-group slope equal to the
adjusted coefficient to the digit (−0.1799 = −0.1799). The groups' own
separate fits are +0.13 / −0.21, so the pair is drawn as the model's
single-slope claim and the caption says "one slope, two intercepts".

**Shipped:** the collider's Adjust now swings the parallel PAIR apart from
the unadjusted line, each landing on its own group centroid; its View
control is hidden by widget 12's `syncRail` pattern (`when` cannot express
"and not collider", and a slide control that changes nothing violates 3.5).
Fork and pipe keep the residual slide unchanged — their third variables are
continuous, where banding was measured to mislead and the residual clouds
are clean ellipses. **The hiding was SUPERSEDED in round 8, below.**

### ROUNDS 6–8 — variant C lands, the slide is announced, and the collider gets the button back

- **Round 6 (mock) and 7:** Kenneth picked **C** from `causal-stage.html`
  round four — the ICU = 0 comparator DOTTED ([2,4], deliberately unlike the
  truth line's [6,5] dashes), each line labelled `ICU = 0` / `ICU = 1`, and
  the **gap bracket on the intercept axis** naming R's printed coefficient
  as a distance ("effect of ICU = +1.30"). All annotations fade in with the
  pair's split. His comprehension questions settled two teaching points now
  in the record: R prints two intercepts as baseline + shift (05-03's
  reference coding), and **adjusting removes comparisons across groups, not
  patients** — restriction to one stratum is a different technique with a
  different answer (+0.13 here, not −0.18).
- **Round 7:** Kenneth adjusted the fork and read the slide as gone — it was
  behind the View control and nothing on the figure said so. The figure's
  note now reads **"switch View to remove age"** (drive-hint register) on
  every adjusted data view.
- **Round 8, superseding round 5's hiding:** with the labelled pair as the
  collider's PRIMARY adjusted picture, Kenneth asked for **the same button
  everywhere** — and the slide earns its place back as the second act: in
  the residual view the two intercepts are REMOVED, so the pair collapses
  into the one line through the origin and the round-5 confusion (recentred
  blocks with no grounding) no longer applies. `syncRail` deleted; the
  pair's labels and bracket fade out with the slide so no annotation
  outlives the cloud it describes; the hint outranks the frame count while
  adjusted (the count has held the slot since Fit and returns when Adjust
  goes off).

---

# PHM5005 · AI/ML for Precision Medicine

**The notebooks are readable now, and that changed the plan.** They are on disk
at `~/Downloads/PHM5005 AY2025-26 - Notebooks/For Review/` with their cell
outputs intact, and mirrored in a shared Drive folder that needs no auth. Match
by filename, never by link — the same notebook has appeared under three Drive
IDs. There is still no `../jupyterbook/phm5005`, so PHM5005 lesson slots are
named by notebook filename rather than by chapter.

## Two arcs, not one

The evaluation arc below was written before any notebook had been read. Reading
`04-3 Tour of Algorithms` produced a **second** arc that runs beside it rather
than inside it, and the two target different things: this one is about
*evaluating* a model, that one is about what a model *is*.

### Arc A · one widget per algorithm family, from `04-3`

Agreed 2026-08-23, in this order. The notebook's own structure — six family
sections, each with a **Model** and an **Objective** — is the spine.

| # | slug | family | status |
|---|---|---|---|
| 1 | `linear-regularization` | linear, with and without regularization | **built — shipped** |
| 2 | — | instance-based (kNN) | deferred, see below |
| 3 | `support-vector-machine` | margin-based (SVM) | **built — shipped** |
| 4 | `trees-and-ensembles` | tree-based and ensembles, one widget for tree → forest → boosting | **built — draft**, one page unreviewed |
| 5 | `naive-bayes` | probabilistic (naive Bayes) | **built — shipped** |
| 6 | `mlp` | neural networks (a shallow MLP) | **built — shipped**; ARC A COMPLETE |

#### Widget 16 · `support-vector-machine` — SHIPPED

**REBUILT AFTER REVIEW — this supersedes the design notes below.** The first
build was about the margin, on two clinical data sets, with a hinge-loss panel
beside the plane. Kenneth asked for three things — one data set, show the kernel
transformation, drop the hinge loss if it is hard to explain — and pointed at a
published interactive (a Medium article by Budi Sumandra) whose shape is:
synthetic blobs / circles / moons, a linear-vs-rbf toggle, C and gamma sliders,
a *show support vectors* checkbox, and ONE panel showing the decision boundary
with its two margin contours.

**The widget is now that shape.** Three generators (`Two blobs`, `Rings`,
`Crescents`), two kernels, C and gamma on `choice` ladders, one square panel with
x₁ and x₂ on the axes, and a display toggle for the rings on the support
vectors. Every control carries a plain-language `detail` line, which is the
"student friendly" half of the ask.

**The claim:** C sets how wide the corridor is; the kernel sets what shape it may
be. On the rings a linear kernel puts a straight boundary through the middle —
**171 of 180 samples become support vectors and 74 are misclassified** — and the
same data under an RBF kernel is a closed circle with **31 support vectors and
none wrong**. One control, and the whole point of a kernel.

**THE DATA IS GENERATED, AND IT HAS TO BE.** None of PHM5005's data sets can show
a kernel doing anything, which was measured before anything was drawn:

| data | what a kernel adds |
|---|---|
| Colorectal biopsies (`03-5`) | nothing. 2,258 probes have \|AUC − 0.5\| > 0.45 and one separates the classes alone; of 435 mid-strength pairs, **0** need a curve |
| Heart failure (`04-3`) | 2.4–4.0 CV points on the best 2-feature pairs, and on all features RBF is **worse** than linear, 0.729 against 0.736. Ejection fraction is not U-shaped: the 50–60 uptick is 7 deaths in 24 patients and 60+ drops back to 0.194 |
| Body fat (`04-1/2/3`) | regression, not classification |

So the samples come from the seeded `rng`, as widgets 1–11 do. **A clinical
framing was built and cut**: two labs each with a reference range, so "normal on
both" is a region in the middle and the boundary is a ring for a real reason.
It is at `widgets/_lab/svm-kernel.html` with its measurements. It was dropped
because a made-up label on invented patients reads as a clinical finding, and
this widget's subject is a shape. Kenneth's call.

**The two-panel lift is also built, and also not shipped.** Same lab page: the
measurements on the left, φ(z) = (z₁², z₂²) on the right, where the boundary is
a straight line with a corridor — a genuine degree-2 polynomial map that lands
in TWO dimensions, so the lifted space can be drawn rather than described. It is
one commit away if the boundary's *shape* turns out not to be enough of an
illustration. It cannot draw RBF or crescents, which is why it is not the widget.

##### Round two: the lift, the ease, and the third kernel

Kenneth's three follow-ups, and what each turned into.

**1. "Is there a way to visualize lifts?"** — he has the classic three-panel
diagram in the notebook: *input space → (Kernel) → kernel space, boundary flat,
margins either side → back to input space, boundary a ring.* The widget now does
that as **one panel that morphs**, on a `Looking at` control: *Input space* /
*Kernel space*.

**The lifted view is exact, for every kernel.** `f(x) = w·φ(x) + b` is a linear
functional of the feature vector, so plotting `f` against `x₁` is a true 2-D view
of the kernel space — the direction `w`, and one input coordinate. The boundary
is exactly the line `f = 0` and the margins exactly `f = ±1`. Nothing about it is
an illustration, which the earlier φ(z) = (z₁², z₂²) lab version could not claim
for RBF.

**Only the HEIGHT moves.** `x₁` is the horizontal axis at both ends, so every dot
slides straight up or down and a reader can follow the one they were watching.
One rule does all of it: a sample at input height `x₂` with decision value `f` is
drawn at `(1−t)·x₂ + t·squash(f)`, and a contour vertex at height `b` on level
`L` at `(1−t)·b + t·L`. So the boundary flattens into `y = 0` and its margins
into `y = ±1`, and the samples and the boundary cannot disagree mid-flight (5.8).

**The vertical axis is linear to one margin and logarithmic beyond.** Median
max|f| over the 150 states is **1.90** and the worst is **42** (blobs, degree-4
polynomial, C = 100), so a linear axis either wastes four fifths of the panel or
throws away 68 of 180 samples. The three positions that carry meaning — the
boundary and the two margins — keep true spacing; "much further out" is
compressed, which is the half that carries none. Those three are the **only
labelled positions**, so the axis never claims a reading it is not giving.

**2. "Can the transitions be animated?"** — the lift eases, on core's
display-change path: `rebuild` sets `anim.easing`, core grants frames, `advance`
chases the target exponentially so an interruption resumes from where the figure
actually is. That is 4.4's narrow case, and this is its second use after widget
12's two denominators.

A contour is only traced where it EXISTS in the input plane, so a closed ring
flattens into a segment as wide as the ring was — a boundary stopping in mid-air.
The full-width straight line is **cross-faded** with it. Both fade, not just one:
they land at the same height at t = 1, but a dashed contour and a dashed line
arrive with different dash phases, and two dashes out of phase on one line read
as a solid one.

**3. "Would polynomial be useful?"** — yes, and it is in. `K = (⟨xᵢ,xⱼ⟩ + 1)^d`,
the notebook's own form, with `d` on its own `choice` ladder shown only for that
kernel, exactly as γ is shown only for RBF. It earns its place by looking
different: on the crescents a degree-3 polynomial threads a single smooth cubic
between the two arcs (**14 support vectors, none wrong**) where RBF makes closed
loops, and on the rings degree 2 gives an exact conic with **9 support vectors**.

##### Round three: the flip, which was two things

*"Why is it when we use the linear kernel there is some flip transformation?"*
Measured rather than guessed, and it was **two separate causes**:

**One was my labelling.** The kernel space puts the +1 class above the boundary
by definition, so a data set whose +1 class sits LOW in the input space has to
turn over on the way up. The crescents had the +1 class on the *lower* arc, so
they flipped under **every** kernel: the correlation between x₂ and f ran −0.75
to −0.94 across all ten kernel settings. Swapping the arcs takes it to **+0.75
to +0.94** and the flip is gone. The fit is untouched — a global label swap
negates w, b and f and leaves the support-vector set and the error count exactly
as they were, re-checked against sklearn afterwards.

**One was real, and only on the linear kernel.** On the rings, the linear fit is
degenerate — no line separates them — so the direction w is essentially
arbitrary, and it landed near −x₂: correlation **−0.98** for linear against
−0.05 to −0.17 for every curved kernel. Lifting along an arbitrary direction
mirrored the picture.

**The fix is that the linear kernel's lift is now a ROTATION.** For a linear
kernel φ is the identity, so its "kernel space" *is* the input plane — the
honest move is to turn the plane until the boundary is level, not to collapse it
onto f. The horizontal axis becomes the along-boundary coordinate and says so;
the caption reads *the same plane, turned level*, which is the whole point of a
linear kernel. Written as a proper rotation: `t = (w₂, −w₁)/‖w‖` against
`n = w/‖w‖` has determinant **+1**, where the more obvious `(−w₂, w₁)` has
determinant −1 and is a REFLECTION. That distinction is the entire fix — a
reflection reads as an unexplained mirror, a rotation reads as turning the page.
Checked: det = 1.000000 at every C on all three data sets.

**A harness number can be 300× wrong and still get captioned as normal.** The
sweep reported a worst repaint of **22 seconds** on one state, under a line
saying "each state is a COLD page, so the worst is a first paint". That state
warm is 54–138 ms and its whole compute path in node is 70 — the number was the
browser pane being throttled, and the same 201-state sweep took 84 s, 165 s and
465 s on three identical runs. The harness now drives each state twice and times
the second.

**No Step and no Play.** Declaring `animation` for the ease got core's two
default drive buttons for free, and they had nothing to advance — Kenneth
clicked them and nothing happened. `stepLabel: null` and `runLabel: null`
decline them, which is 4.5 and what widget 12 does for the same reason: a dead
Step beside a live toggle teaches that the toggle is the afterthought. **An ease
is not an animation the reader drives**, and the only thing that should be
declared alongside it is the control that triggers it.

**Verified again after all three: 150 of 150 states match `sklearn.svm.SVC`
exactly** on support-vector count and error count — every dataset × kernel × C ×
(γ or d). The polynomial reference is `SVC(kernel="poly", gamma=1, coef0=1)`,
which is the notebook's form rather than sklearn's default.

##### Decided while building, so it is not re-argued

- **The corridor is NOT shaded.** Shading |f| ≤ 1 is right for a linear kernel,
  where the band is a strip. On an RBF it inverts the picture: f decays to b away
  from the data, so the whole far field sits inside the margin and the shading
  covers everything *except* the two clouds — which reads as "the margin is the
  plane". Both were drawn. The three contours say it without lying, which is
  what every SVM tutorial figure does.
- **The panel is square**, so its height is a function of the width. A margin is
  a distance and a distance needs equal units per pixel.
- **One fixed square domain for all three generators**, so gamma means the same
  thing in each (2.5).
- **RBF, not poly.** The notebook offers linear / poly / rbf; poly is left out
  because rbf is the notebook's own default and the one whose two dials — C and
  gamma — the notebook explains.

##### Verified

- **105 of 105 states match `sklearn.svm.SVC` exactly** on support-vector count
  and error count — every dataset × kernel × C × gamma combination, checked twice:
  once against the extracted solver in node, once against the running widget's
  own readout in the browser.
- **111-state canvas text sweep**: no overrun, no NaN, no collision. Slowest
  repaint 52 ms, median 17 ms.

##### Three things that cost time, all of which looked like something else

**A temporal dead zone in the solver made every solve throw, and it read as a
harness problem.** `const hi = C - 1e-12` at function scope, then `let lo, hi`
inside the loop body — the `let` shadows the outer binding for the whole block,
including the selection loop that runs *before* the declaration. A widget that
throws in `render()` leaves its canvas at the default 150×75 and its readout
empty, so the sweep reported a clean pass over an empty list and the obvious
reading was "the iframe had not laid out yet". **The sweep now fails a state that
painted nothing**, which is the check that would have named it in one run.

**`maxIter` was the binding constraint, not `eps`.** On the rings at C = 100 — a
linear kernel on data no line can separate, so the optimum is flat — stopping at
20,000 iterations gave 175 support vectors and 77 errors against sklearn's 170
and 74. Every value of eps from 1e-5 to 1e-9 gave the *same* cut-off answer, and
every one of them converged to sklearn's exactly once the cap was raised. A
cut-off solve is silently wrong rather than obviously wrong.

**Two closures in the selection loop cost 1.9 seconds on one state.** The
membership tests were `inUp(k)` / `inLow(k)`, called twice per sample per
iteration — tens of millions of closure calls on a control meant to be dragged.
Written out inline the same state is tens of milliseconds.

`linear-regularization` **is** the `regularization-path` entry in the tail list
below, built under a clearer name. Its misconception: *the penalty is not a
property of the algorithm, it is a response to how little data you have.*
Measured on the notebook's own body fat data — the best penalty slides from
α = 1 at n = 18 to **α = 0 at n = 202**, so the four rows of `04-3`'s table are
four settings of one objective rather than four algorithms.

**kNN was planned in detail and then deferred**, which is worth recording so the
work is not redone. `04-3` mentions it once, in the overview table, with no
worked example; Kenneth's course covers it in the unsupervised-learning notebook
instead, and it will be picked up there. What the planning measured, on the heart
failure data:

- serum creatinine (AUC 0.728) and ejection fraction (0.324, i.e. 0.676
  inverted) are the top two features by a clear margin, so a 2-D plane on them
  is a fair reduction rather than a caricature
- **the scaling story does not fire.** Standardised against as-measured is within
  one or two patients at every k, even though ejection fraction outweighs
  log-creatinine 52:1 in range — because ejection fraction is recorded in coarse
  steps, so creatinine survives as a tie-breaker. Do not build a kNN widget
  around "forgetting to scale"
- **the dimensionality story fires hard.** At k = 9, adding features
  strongest-first takes deaths caught from 8 of 19 down to **1 of 19**, while the
  nearest neighbour's distance goes from 0.038 of the mean distance to 0.394.
  "Nearest" stops meaning near, and it is measurable on screen

## Widget 18 · `balancing-data` — SHIPPED, twelve rounds of review

**It belongs to neither arc, and that is the point.** Arc A is *what a model is*
and arc B is *how well it did*; this one hosts at `03-4 ML - Data Preprocessing`,
section `## Balancing Data`, which is upstream of both — it happens to `X` and
`y` before any model exists.

**The host, cell by cell.** `03-4` cells 62–72 are a complete treatment, and the
previous session's report that no PHM5005 notebook mentions SMOTE was simply
wrong — cell 67 imports `from imblearn.over_sampling import SMOTE` verbatim.

| cell | what it teaches |
|---|---|
| 62 | why imbalance matters — *"could predict 'no disease' for everyone and still achieve high accuracy"* |
| 63 | resample **vs** class weights, as a table — *"Start with adjusting class weights if the model supports it"* |
| 64 | over vs under; `SMOTE` and `RandomUnderSampler`; **"Always apply balancing only to the training set"** |
| 65 | SMOTE's mechanism — k nearest minority neighbours, new points along the connecting lines; *smaller k → less diverse, larger k → more overlap between classes* |
| 66–71 | the worked example: `fit_resample`, `value_counts()` before and after, a two-panel bar chart |
| 72 | recommendations — class weights first; SMOTE only when the minority is *highly* underrepresented |

**`03-4` never fits a model.** Its own figure is two bar charts of class counts.
Everything downstream of a score is the widget's measurement, not the lesson's,
and the widget has to say so.

### Agreed with Kenneth before building

Three pages, and a **generated** 2-D stage with the imbalance on a dial:

| page | subject |
|---|---|
| *What each method does* | the four methods side by side, on one plane |
| *How SMOTE makes a point* | the animation — pick, light the k neighbours, slide, drop |
| *Only on the training set* | balance after the split, or before it |

### The measurements, taken before anything was drawn

Five runs, all reproducible from `~/Downloads/PHM5005 AY2025-26 - Notebooks/_scratch/imb1–5.py`
against a venv there (`py -m venv venv`; scikit-learn 1.9.0, imbalanced-learn 0.14.2).

**1 · On 03-4's own data, SMOTE does not win.** 40 seeds, 03-4's exact pipeline
(`KNNImputer` → `StandardScaler` → `OneHotEncoder`), paired, 80/20 stratified:

| | logreg F1 | recall | | forest F1 | recall |
|---|---|---|---|---|---|
| none | 0.5211 | 0.4632 | | 0.4992 | 0.4447 |
| `class_weight` | **0.6014** | 0.7026 | | **0.5667** | 0.5868 |
| SMOTE | 0.5998 | 0.6974 | | 0.5417 | 0.5316 |
| random over | 0.6008 | 0.7013 | | 0.5392 | 0.5276 |
| random under | 0.5957 | 0.7132 | | 0.5865 | 0.6987 |

On the linear model the four are **indistinguishable** — |t| ≤ 0.96 against
`class_weight` on every metric. On the forest SMOTE is significantly *worse*
(−0.025 F1, t = −2.47; −0.055 recall, t = −4.58) and plain undersampling wins.
Not balancing at all costs +0.08 F1 and +0.24 recall, t = 6 to 16.

**2 · No crossing anywhere between 1:2 and 1:50.** Synthetic 2-D, 400 majority,
30 seeds, two minority shapes. SMOTE never overtakes `class_weight` on both F1
and balanced accuracy at once — where it gains on one it loses the other, which
is the recall/precision trade wearing two names. The forest at 2% minority:
SMOTE −0.084 F1 (t = −10.4) and **+0.073 balanced accuracy** (t = +9.9), the
same comparison in opposite directions. **A page that ranks the methods has to
name its metric, or it is not saying anything.**

**3 · The leakage number is enormous and never flakes.** `03-4` bolds *only to
the training set*; SMOTE before the split against SMOTE after, on 03-4's data:

| | honest | leaky | paired |
|---|---|---|---|
| forest F1 | 0.5417 | **0.8109** | +0.2692, t = 18.1, **100% of 40 seeds** |
| forest AUC | 0.7489 | 0.8908 | +0.1419, t = 14.4, 100% |
| logreg F1 | 0.5998 | **0.7439** | +0.1441, t = 12.3, **100%** |

**4 · The heart failure data CANNOT host the picture, and this is why the stage
is generated.** SMOTE runs in the 11-column preprocessed space; a widget draws
two. A segment survives projection — a drawn synthetic point really does sit
between its drawn parents — but *the neighbours do not*:

- the 5 nearest minority neighbours in 11-D overlap the 5 nearest in the drawn
  plane by **1.00 of 5**, and **39 of 96 minority patients share none at all**
- a real 11-D neighbour sits at **median rank 16** in the picture, mean 21.6,
  90th percentile 47, worst 84 of 95 — the widget would draw a line to a patient
  that visibly is not nearby
- *"the synthetic point landed in majority territory"* reads **0.0% in 11-D and
  32.9% in the two drawn columns**. The picture would invent a pathology that is
  not there

The two columns a widget would pick are serum creatinine (AUC 0.704) and ejection
fraction (0.324), the top two by |AUC − 0.5|, and they carry 0.751 of the
all-column 0.815 in-sample AUC. That is a fair reduction and it still is not
enough. Same conclusion widget 16 reached, for a different reason.

**5 · The stage, verified at the size a widget can draw.** 200 dots, one majority
cloud and one minority cloud on `[0, 10]²`, 200 seeds, logistic regression, held
out at the same prevalence:

| minority share | recall, none | recall, any of the four | AUC, none | balanced acc, none |
|---|---|---|---|---|
| 40% (1:1.5) | 0.7795 | 0.843–0.845 | 0.9114 | 0.8224 |
| 20% (1:4) | 0.5513 | 0.834–0.847 | 0.9109 | 0.7476 |
| 10% (1:9) | 0.3311 | 0.819–0.841 | 0.9098 | 0.6542 |
| 5% (1:19) | 0.1633 | 0.791–0.827 | 0.9074 | 0.5774 |
| 3% (1:32) | **0.0877** | 0.761–0.817 | **0.9056** | **0.5419** |

That is cell 62's sentence, quantified. At 3% an unbalanced model finds **one
minority case in eleven**, its balanced accuracy is a coin flip — and its **AUC
is 0.9056, higher than any balanced model's**. Balancing moves the cut, not the
ranking, and precision is what pays: 0.5416 → 0.2127.

**The four methods stay interchangeable all the way down.** Spread across the
four, max − min: recall 0.0024 at 40%, 0.0555 at 3% — against a 70-point gap to
doing nothing. SMOTE is reliably a shade *below* `class_weight` on recall
(−0.024 at 3%, t = −18.4) and a shade above on precision. **Real, tiny, and the
widget must not oversell it.**

Point counts on the dial, and why `k` tops out at 5: 40% → 80 minority, 20% → 40,
10% → 20, 5% → 10, 3% → **6**. SMOTE needs k + 1 minority points, so k ∈ {1, 3, 5}
is valid at every share and k = 9 is not.

**6 · What `k` does, which is the notebook's own claim.** Cell 65 says larger k
means *"more overlap between classes"*. Measured, as the share of synthetic
points whose nearest REAL neighbour belongs to the majority:

| minority share | k = 1 | k = 3 | k = 5 | k = 9 |
|---|---|---|---|---|
| 20% | 10.4% | 15.2% | 18.9% | 22.5% |
| 10% | 17.8% | 26.7% | 31.2% | 35.8% |
| 5% | 27.6% | 38.9% | 44.0% | 50.9% |

So the `k` control carries an idea at rest (3.5) and the widget can print the
number rather than assert the trade-off.

### Round two: the ideal-world line, and one page fewer

Kenneth's two asks after seeing the build, and both are in.

**1. "Compare to the case if there was no imbalance, then we can see how each
method can try to push it to the true classifier line."** The figure now carries
a third line: **where this same model would cut if the two classes were equally
common**. That is what all four methods are estimating — every one of them makes
the effective prior 50/50 — so the page stops being *the line moved* and becomes
*the gap closed*.

**Not the Bayes boundary.** The two clouds have unequal spreads, so the Bayes
rule is a conic; drawing a curve against straight fitted lines would blame
imbalance for the model being linear, which is a different error and not this
widget's subject. Same logistic model, equal classes, large sample.

**It is a constant of the population, not of the draw.** Over six seeds it
crosses x₂ = 5 within **0.07 of a 10-unit axis — four pixels** — so it is
computed once from 20,000 points (~20 ms, then cached) and does not move when the
seed or the dial does. 20,000 lands within 0.008 of 40,000.

**The measurement that earned it.** Share of a 6,000-patient population each
fitted line labels differently from the target, 40 seeds:

| minority | none | class weights | over | under | SMOTE |
|---|---|---|---|---|---|
| 40% | 5.67% | **2.29%** | 2.41% | 2.58% | 2.35% |
| 20% | 21.04% | **2.91%** | 2.91% | 4.17% | 3.24% |
| 10% | 34.21% | **3.88%** | 4.13% | 5.99% | 4.42% |
| 5% | 43.58% | **5.09%** | 5.31% | 8.43% | 5.92% |

And it is visible rather than only measurable: the unbalanced line sits **30 / 83
/ 126 / 174 px** from the target on the 560 px panel as the minority runs 40% →
5%, while every balanced method lands within **11 px**.

**This is what finally lets the widget say WHY the methods differ.**
Undersampling is consistently worst — it throws away 180 of 190 majority
patients, so the line is estimated from twenty — which is cell 64's *"removing
too many majority samples can lose information"*, measured. Recall and precision
could not say that; distance-to-target can.

**T2 won** of three mock-ups at `widgets/_lab/balance-target.html`: the gap drawn
as the **washed region the two lines label differently**, which closes to nothing
as the plan runs. T1 was the three lines alone; T3 added a gap bar under the
panel for 46 px of height.

The region is computed in `model.js` beside the number the readout prints, by
clipping the domain square against each half-plane in turn — **not** by joining
the two lines into a quadrilateral, because a near-vertical line's endpoints on
the x = 0 and x = 10 edges sit at |y| ≈ 1e5, and two lines crossing inside the
panel make that a bow-tie whose fill depends on the winding rule. Checked against
a 160,000-cell grid: area **30.944** against **30.937**.

**The gap number is measured over the widget's own held-out set**, the same 4,000
samples recall and precision use — one population for every number on the page.
It plateaus at extreme imbalance (19.2% at 10%, 19.5% at 5%) because a line that
has moved past the majority cloud cannot mislabel anyone new, and that is a true
statement about impact rather than an artefact. Over an equal-classes population
the same comparison keeps climbing, 33.6% → 42.7%; over the minority alone,
52.2% → 68.7%. All three were measured before choosing.

**2. "The widget is quite complicated and I was trying to learn which buttons do
what."** The middle page went. *One sample at a time* was never a different
subject — it was the same plan at a slower pace, and core already has a word for
that: its own tooltip for Step reads *"advance one step, slowly, showing every
stage"*. **So Step is the slow motion and Play is the fast one**, the two buttons
carry the difference, and there are two pages instead of three.

The class-counts readout tile went too: the strip under the figure already draws
them with the starting count marked, and a number printed twice is a number that
can disagree with itself. The lead tile is now the gap.

**The three lines are named by a key on the panel, not by the legend.** Core
builds the legend once at shell time so it cannot vary, and the split page draws
none of the three — the same defect widget 17 had, advertising two curve colours
on two pages that drew neither. The key sits right-aligned on the caption's line,
each label in its own line's colour, and drops below when the line is full. It
measures the caption itself rather than reading core's private `captionRight`,
because reaching into core for one accessor costs a full 123-state fingerprint
run.

### Round twelve: why undersampling is not punished here — and where the cost hides

Kenneth: *"undersampling improves it, but in practice throwing away samples makes
everything underfit. How come it isn't detrimental here? Is it because the
dataset is simple?"*

The intuition is right and the widget was hiding the evidence. Three
measurements, 60 seeds each.

#### 1 · The cost IS there. It is in the SPREAD, not the average

| 5% collected | mean F1 | spread |
|---|---|---|
| class weights | 0.814 | **± 0.028** |
| undersample | 0.806 | **± 0.049** |

Nearly **twice the variance for a third of a point of mean**. At 10% collected it
is ±0.016 against ±0.030. Undersampling reaches the same answer far less
reliably, and a table of means cannot say so.

**So the widget now has a `seed` control** — every other widget in the collection
had one and this did not, which is an oversight worth naming rather than quietly
fixing. Across seeds 1–6 at 5% collected: class weights 0.825 / 0.837 / 0.804 /
0.749 / 0.809 / 0.801, undersample 0.808 / 0.798 / 0.838 / 0.766 / 0.822 /
0.752. The instability is now something a reader can press a button and see.

#### 2 · Why the MEAN survives: the minority is the binding constraint

With 8 minority cases you have eight points of information about where that cloud
is — whether you keep 150 majority points or 8. The majority's centre is already
pinned to about σ/√8 by eight points. **Undersampling discards the class you have
plenty of**, and on this stage the boundary's uncertainty was never coming from
that side.

#### 3 · Dimensionality does NOT punish it — it helps, and the reason matters

Adding pure-noise features at 5% collected, so 16 undersampled rows must fit ever
more parameters:

| features | params | none | class weights | **undersample** |
|---|---|---|---|---|
| 2 | 3 | 0.280 | 0.814 | 0.806 |
| 12 | 13 | 0.328 | 0.678 | **0.749** |
| 50 | 51 | 0.231 | 0.415 | **0.720** |

The opposite of the prediction. **It is the L2 penalty.** sklearn's objective is
`0.5·‖b‖² + C·Σ wᵢ·lossᵢ` with C = 1, so the likelihood term grows with the
number of rows: 16 rows means the penalty weighs proportionally more, the noise
coefficients are shrunk hard, and the fit stays near the signal. 158 rows have
enough leverage to chase noise directions that separate eight upweighted minority
points. **That is a fact about the regulariser, not a recommendation for
undersampling.**

#### 4 · A structured majority did not punish it either, and that is instructive

Majority redrawn as three separated clusters of 50. At 8 kept, **11.4% of draws
miss a cluster entirely** — and F1 barely moves (0.921 ± 0.020 against class
weights' 0.922 ± 0.017). Because all three clusters sit on the same side of the
minority and a LINEAR boundary only needs the majority's rough centroid. Losing a
mode does not move a line.

#### So: is it because the dataset is simple?

**Partly, and specifically.** What would make undersampling bite is a model with
capacity to lose — a tree or a forest, where every split needs points in its own
region — or majority structure sitting ON the decision surface, where dropping
95% removes the evidence for where the surface goes. Two Gaussians and a
three-parameter linear model have neither.

**What the widget can honestly claim is what it now shows: undersampling costs
you reliability, not accuracy.** The rest belongs to a widget about model
capacity, and `overfitting-capacity` is already in arc B.

### Round eleven: THE TEST SET WAS MOVING WITH THE DIAL — and that was the bug

Kenneth: *"say the ground truth is 0.852 in a perfect world, but we only collect
25% of disease cases — then if we correct imbalance should we approach the
theoretical 0.852? What would make sense pedagogically?"*

**Under his framing, yes it should — and the widget was making it impossible.**
The dial was doing TWO things at once, and they are different stories:

| | training set | test set | what balancing can do |
|---|---|---|---|
| **A** the disease itself gets rarer | rarer | **also rarer** | recovers the boundary, never the score |
| **B** we only collected some cases | rarer | **unchanged** | recovers both |

The widget did A. Kenneth's sentence is B. Measured, 40 seeds, F1:

```
        ---------- A ----------      ---------- B ----------
kept    ceiling   none  balanced     ceiling   none  balanced
100%     0.836   0.836   0.836        0.836   0.836   0.836
 50%     0.769   0.748   0.769        0.836   0.791   0.835-0.836
 25%     0.665   0.624   0.664        0.836   0.688   0.831-0.834
 10%     0.468   0.392   0.464        0.836   0.442   0.818-0.826
  5%     0.328   0.230   0.328        0.836   0.268   0.802-0.810
```

Under A every method lands **exactly** on a ceiling that slides out from under
it, so a correct figure still reads as "balancing does not work". Under B the
ceiling is **one number at every rung** and balancing visibly climbs back to it.

**It is now B**, and three things fell out:

- **Kenneth's original intuition becomes true.** Accuracy improves with balancing
  (0.749 → 0.832 at 25% collected) instead of getting worse. Nothing on the
  readout moves counterintuitively any more.
- **The residual gap becomes the second lesson.** At 5% collected, balancing
  reaches 0.810 of a possible 0.836 — it recovers almost everything, and what is
  left is the estimation error from eight real cases. **Balancing cannot invent
  cases nobody collected.**
- **The accuracy tile went.** On a world that stays 50/50 it tracks F1 to within
  a few thousandths. Its old job — "99% accuracy by predicting the rare outcome
  away" — needs an IMBALANCED test set to fire, and that is arc B's
  `imbalance-metrics`, not this widget's subject.

Three tiles now, all against one fixed reference:

```
 5% collected  none      caught  256 of 2000   alarms  11   F1 0.226  (0.832 with every case)
 5% collected  weights   caught 1619 of 2000   alarms 308   F1 0.825  (0.832 with every case)
```

#### The distinction that has to stay written down

**This is a SAMPLING imbalance, not a PREVALENCE one.** The copy says "collect"
throughout for that reason. When a class is genuinely rare in the world,
rebalancing to 50/50 throws away a correct prior and the honest fix is a
threshold, not a resample. That is a different widget and it is already planned.

#### And the rule the whole round earned

**A REFERENCE THAT MOVES WITH THE CONTROL IS NOT A REFERENCE.** Principle 2.5
says fix the frame, not the data — and the test population IS the frame for every
number in the readout. Letting it follow the dial was 2.5 broken in the one place
nobody thought to look, because it was in `compute` rather than in a scale. The
figure was right, the numbers were right, every check passed, and the widget
still could not be read.

### Round ten: THE CEILING MOVES WITH PREVALENCE — Kenneth was right, the widget was wrong

Kenneth: *"whole cohort F1 ≈ 0.832; at 50% kept it drops to 0.727, balancing takes
it to ~0.755 but doesn't approach the ground truth. Is this expected, or are we
not calculating the correct cohort?"*

**Neither. The widget was comparing him against a ceiling from a different
population.** Two explanations were possible and they are very different:

- **less information** — half the minority cases are gone and no balancing
  invents them, so the boundary is estimated worse. An honest gap.
- **F1 moved its own goalposts** — F1 depends on prevalence, because precision
  falls as the positive class gets rarer, so the SAME boundary scores lower on a
  rarer test set.

Measured, 40 seeds, scoring the whole-cohort boundary on every test set:

| kept | share | whole cohort on a 50% test | on **this** test | balanced methods |
|---|---|---|---|---|
| 100% | 50.0% | 0.836 | 0.836 | 0.836 |
| 50% | 33.3% | 0.836 | **0.769** | 0.767 – 0.769 |
| 25% | 20.2% | 0.836 | **0.665** | 0.657 – 0.666 |
| 10% | 9.1% | 0.836 | **0.468** | 0.448 – 0.472 |
| 5% | 5.1% | 0.836 | **0.328** | 0.308 – 0.343 |

**It is the second explanation, and completely.** The balanced methods land ON
the reachable ceiling at every rung — 0.769 against 0.769 at 50% kept. There is
essentially no estimation gap. The entire residual was the metric changing its
own scale, and 0.832 is a number from a 50%-prevalence population that does not
exist once the dial has moved.

At the sparse end the balanced fits even come out slightly ABOVE the whole-cohort
line (0.465 against 0.454 at 10% kept), because neither boundary is optimised for
F1 at that prevalence — the whole cohort's is optimal for a 50/50 prior.

**So the F1 tile's note now carries the ceiling for the CURRENT test set**, and a
reader watches it come down as they turn the dial:

```
100% kept  none      F1 0.832   (for the minority class; 0.832 with the whole cohort)
 50% kept  none      F1 0.727   (for the minority class; 0.759 with the whole cohort)
 50% kept  weights   F1 0.755   (for the minority class; 0.759 with the whole cohort)
 10% kept  weights   F1 0.465   (for the minority class; 0.454 with the whole cohort)
```

0.755 against a reachable 0.759 reads as "it got there". 0.755 against a
remembered 0.832 read as "it fell short", and that was the widget's fault.

Both straw-man numbers moved into the accuracy tile, where the contrast is
sharper for being in one place: *"flagging nobody scores 94.9%, and 0.000 on
F1"*.

**This is also Chicco & Jurman's complaint about F1, made visible rather than
asserted.** Their objection is that F1 *"fails to consider the ratio between
positive and negative elements"* — which is exactly why its ceiling slides from
0.836 to 0.328 while the boundary that achieves it barely moves. A reader who
turns the dial sees that happen.

**A COMPARISON IS ONLY HONEST IF BOTH SIDES ARE MEASURED ON THE SAME
POPULATION.** Every other tile already obeyed it — `caught` and `false alarms`
both compare against the whole cohort scored on the current test set. F1 was the
one that did not, and it was the one that misled.

### Round nine: the minority ALREADY was the positive class — now the widget says so

Kenneth: *"can you predict on minority class as this is the usual use case?"*

**It already did, at the code level, and had done since the first build.** Three
places make it so, and none of them were on screen:

- `MINORITY = 1`, and `fitLogistic` regresses on `p.y` — so `y = 1` is the side
  the model's decision value points at
- `score()` counts a minority patient the model flagged as a **true positive**
- recall, precision and F1 therefore all describe **finding the rare outcome**

So the numbers were right and the framing was invisible. A reader who does not
know which class is being detected cannot read a single tile below the figure,
and Kenneth had to ask — which is the report.

**Three places now say it:**

| where | what it says |
|---|---|
| subtitle | *"The job is to find the rare outcome, and a model can score well by predicting it away…"* — the task in the first clause |
| legend | *"Minority class — the one to find"* |
| F1 tile | *"for the minority class"* |

The subtitle is shorter than the one it replaced.

**And `model.js` now carries the reason it is fixed rather than offered**, next to
the constants: F1, precision and recall are not invariant to swapping the classes
— that asymmetry is the whole argument for MCC — so a control letting a reader
relabel which class is "positive" would let them flatter a model without changing
it. A screening test is asked to find disease, not to confirm health.

**Worth keeping as a general lesson: a widget can be correct and unreadable.**
Every number here was right for four rounds of review while the one sentence that
makes them legible was missing. Nothing in the harness could have caught that —
the text sweep reads what is painted, not what is absent.

### Round eight: F1 beside accuracy, and NO class toggle — both decided from evidence

Kenneth: *"maybe we should report F1? or accuracy/precision/recall? also depends
what we are trying to predict… maybe give a toggle to predict on majority or
minority?"*

#### The toggle is a trap, and the literature says why

**F1, precision and recall are NOT invariant to swapping the classes.** Chicco &
Jurman's argument for MCC turns on exactly this: F1 *"fails to consider the ratio
between positive and negative elements"*, where MCC is *"invariant for class
swapping"*. So the reason Kenneth had to ask "what are we trying to predict?" is
that those three metrics have no answer until you say.

A toggle would therefore let a reader **flatter a model by relabelling it**,
which is the opposite of the lesson. The rare outcome is what a clinical model is
asked to find, so it is **fixed**, and the F1 tile states it in four words —
*"for the minority class"*. Stating the positive class costs one phrase; offering
to change it costs the point of the widget.

#### F1 and accuracy, because they disagree

Measured, 40 seeds, at each rung of the dial. F1 improves with balancing at every
setting; accuracy worsens at every setting:

| 5% kept, 4000 held-out, 203 rare | accuracy | F1 | caught |
|---|---|---|---|
| **flagging nobody at all** | **94.9%** | **0.000** | 0 |
| no balancing | **95.0%** | 0.230 | 32 |
| class weights | 82.6% | 0.328 | 163 |
| SMOTE | 84.2% | 0.343 | 158 |
| undersample | 80.1% | 0.308 | 166 |

**That is the pair.** The straw man that flags nobody scores 94.9% on one and
0.000 on the other — which is why `04-4` scores on `f1` and why cell 62 is about
accuracy. Two numbers moving opposite ways, each with the same straw man printed
beside it.

**The four tiles are now:**

| tile | reference in its note |
|---|---|
| Minority cases caught — `22 of 203` | `170 of 203 with the whole cohort` |
| False alarms — `19` | `692 with the whole cohort` |
| F1 — `0.180` | `for the minority class; flagging nobody scores 0.000` |
| Accuracy — `95.0%` | `flagging nobody scores 94.9%` |

Two counts against the best case, two metrics against the worst one. The
"Judged differently" tile went; the band on the figure already shows that gap and
shows it shrinking, which is what it was for.

**F1 and not MCC**, though the 2024 comparisons prefer MCC for imbalanced health
data. MCC is what the course does not type, and a correlation coefficient is a
second lesson. Recorded as a decision.

**And metric selection is not this widget's subject.** Arc B's `imbalance-metrics`
is already planned for exactly that — *"99% accuracy on a 1% prevalence outcome"*.
Widget 18 shows what balancing does to the DATA; it carries only the two numbers
it needs to stop misleading.

`score()` now returns `f1`, and `imb6.py` checks it against
`sklearn.metrics.f1_score`: worst metric disagreement **0.000e+00**.

### A FIFTH TOOLING FAULT: an anchor that matched the WRONG occurrence

A scripted edit spliced on `if (at === 2 && params.method !== "none") {` — a
string that appears **twice**, once in `drawFigure` and once in the readout.
`str.index` took the first, and `s[:i] + new + s[j:]` duplicated ~350 lines,
leaving `defineWidget` called **twice** in one file.

**The file parsed. `npm run check` was green.** Two valid halves make a valid
whole, and nothing counted anything.

`check.mjs` now asserts **exactly one `defineWidget({` per main.js**. Matched on
`defineWidget({` rather than on a line-anchored `defineWidget(`, because
`probability-mechanisms` assigns the result — the first version of the check
failed on a correct file, which is at least the honest direction to fail in.

Five faults now, and four of them silent. The rule earned by all of them:
**assert the anchor, and count the thing you think you edited.**

### Round seven: THE METRICS WERE THE PROBLEM, and accuracy is the answer

Kenneth: *"do the metrics mean… i'm confused, the accuracy should be better with
balancing?"* It should not, and the readout never showed the number that says so.

Measured at 5% kept — 8 cases — over 40 seeds, on 4,000 held-out patients of whom
203 are the rare class:

| | accuracy | caught | missed | false alarms |
|---|---|---|---|---|
| **calling everyone majority** | **94.9%** | 0 | 203 | 0 |
| no balancing | **95.0%** | 32 | 171 | 31 |
| class weights | **82.6%** | 163 | 40 | 656 |
| SMOTE | 84.2% | 158 | 45 | 586 |
| undersample | 80.1% | 166 | 37 | 757 |

**Balancing makes accuracy WORSE — 95.0% down to 82.6% — and that is cell 62's
entire point.** The unbalanced model is a rounding error away from a model that
flags nobody at all, and it catches 32 of 203. The old readout printed recall and
precision as bare percentages that moved in opposite directions and explained
neither.

**The tiles are now counts, and accuracy is named as the trap:**

| tile | at 5% kept, no balancing | with class weights |
|---|---|---|
| Minority cases caught | **22 of 203** | 165 of 203 |
| False alarms | 19 | 616 |
| Accuracy | **95.0%** — *calling everyone majority scores 94.9%* | 83.7% |
| Judged differently | 20.5% | 2.0% |

That third note is the whole lesson in eight words, and it is computed live
(`1 − rare / test.length`), not written down.

**Counts, not percentages, for the first two.** "22 of 203" is a sentence about
patients; "10.8% recall" is a sentence about a formula. 2.3, applied to a number
that is not small but is still countable.

### Round seven, part two: Play's speed is the reader's

The automatic speed-up went. It choreographed the first six samples and then
raced, which showed the mechanism to someone who pressed Play without stepping —
but the figure changed its own speed halfway through for reasons nothing on
screen explained. **A `pace` rung says the same thing and says who decided it**
(4.1), and it appears only at the balancing step.

| rung | ms per sample | shows |
|---|---|---|
| Slow | 700 | every beat of every sample |
| Steady | 260 | still shows where each sample comes from |
| Quick | 60 | arrivals only — for filling the plane |

**Step ignores the dial and is always slow with every beat.** That is what Step
IS, and core's own tooltip already promises "slowly, showing every stage".

Verified by counting the neighbour fan's own dash pattern, `[3, 3]`, per frame at
64 ms a frame:

```
Slow Play      ###########.##########.##########.######   11 frames = 704 ms
Steady Play    ####.####.####.####.####.####.####.####.    4 frames = 256 ms
Quick Play     ........................................    no fan at all
Quick + Step   ########################.                  24 frames = 1536 ms
```

`pace` is a DISPLAY parameter, so changing speed never discards the samples the
reader has already made, and it takes effect at the next sample because
`advance` fixes a unit's duration when the unit starts.

### Round seven, part three: the rule is on screen where it applies

Cell 64's *"apply balancing only to the training set"* was cut with the split
step and is back as copy rather than as a page. The balance gate reads **"four
corrections, every one of them on the training data only"**, and the panel at
that step carries the note **"held-out patients are never balanced"** — which is
literally true of the figure: every method acts on `pts`, and every number
underneath comes from `test`, which nothing touches.

### Round six: THREE steps, revealed downwards — and core shrank to 13 lines

Kenneth again: *"still confusing, perhaps can also simplify"* — reveal the steps
**vertically with dividers so it looks cumulative**, cut the number of steps, and
find words that tell Reset, Play and Restart apart.

#### The gates were already the answer

Core's `gate` type is, verbatim from its own comment, *"a full-width button
inside the control flow, not in the drive row… it sits exactly where the stage it
opens begins, with the controls it reveals directly beneath it"*, with a divider
above and a `labelOff` for closing again. That is precisely the vertical
cumulative reveal, and it has been in core since widget 12.

**So the rail is now two gates and the controls beneath them:**

```
Cases kept   [100%  50%  25%  10%  5%]      <- always there
──────────────────────────────────────
[ Fit a model ]            <-> Back to the cohort
──────────────────────────────────────
[ Try a balancing method ] <-> Back to the plain fit
Balancing    [None | Class weights | Oversample | Undersample | SMOTE]
k            [1  3  5]                       <- only under SMOTE
── Make one sample · Play · Start over
```

#### And it made two of the three core additions unnecessary

`when: { param, atLeast: n }` existed so a numbered step could reveal controls
cumulatively. **A gate is a bool, so `when: { param }` — the truthy form core has
always had — already says it.** `keepOnReset` existed so Reset would not collapse
the narrative; once the narrative is gates, the honest thing is for Reset to
close them, which is what it does by default.

**Both were reverted.** Core carried a comparison nothing compared for exactly
one session. What is left is **13 lines of actual code**:

| | |
|---|---|
| `anim.inert` | the widget says there is nothing to drive; core removes Step and Play. Seven lines |
| `.w-drive-group[hidden]` | `display: inline-flex` outranks the UA sheet's `[hidden]` — one line |
| `resetLabel` / `resetTitle` | four lines, default unchanged, so no existing widget moves |

#### Three actions, three words

The usability literature on reset controls is blunt: **a bare "Reset" is vague
and gets pressed by mistake**; the label should name what it clears. This widget
now has three ways to go back or forward, and each says which:

| word | what it does |
|---|---|
| **Play** / **Make one sample** | run the balancing |
| **Back to the cohort** / **Back to the plain fit** | the gate, closing |
| **Start over** | Reset — closes every gate, returns to the whole cohort |

`resetLabel` is what let the third one be named. Nothing else in the collection
changes: the default is still "Reset".

#### The dial runs 100% → 5%, and starts at 100%

`KEEPS = [1, 0.5, 0.25, 0.1, 0.05]` of a 150-case minority pool — **150, 75, 38,
15, 8 cases** against a fixed 150 majority, so the outcome goes from half the
cohort to one patient in twenty. Expressed as *how many you keep* and not as a
minority share, because that is what the reader is doing: throwing cases away.

**So the widget opens on a balanced cohort and the reader creates the imbalance.**
The whole-cohort line and the current line start on top of each other and
separate as the dial comes down, which is the entire argument in one gesture.

#### What was cut

**The train/test split step is gone**, and with it cell 64's *"apply balancing
only to the training set"*. It was a page, then a step, and it did not survive
the reduction to three. The leakage it warns about is arc B's `data-leakage`
anyway. Recorded in the widget header so it reads as a decision rather than an
omission — and it is one gate away if Kenneth wants it back.

#### Verified

- **All 123 fingerprint states identical** after the core revert-and-add.
- **Model matches scikit-learn** on the new dial: worst coefficient disagreement
  **9.7e-07**, zero problems, 15 states.
- **135-state text sweep** PASS; **120-state drive sweep** PASS with **84 of 120**
  buttons unavailable — exactly 5 methods × 2 keeps × 2 keys × 3 frames at the
  fit step, plus None and Class weights at the balance step.

At 10% kept (15 cases): gap to the whole cohort **19.7%** unbalanced against
**4.5%** under SMOTE.

### Round four/five: rebuilt as a five-step narrative

Kenneth, after seeing the two-page version: show the whole dataset and the ground
truth before simulating the imbalance; gate the controls so the sequence tells a
story; keep the k-neighbour animation during Play. He also pushed back on the
first estimate of what gating would cost — *"do we need such a radical change?"*
— and was right to.

**The widget is now five steps, each unlocking one control:**

```
1 Cohort    both classes, fully sampled            no controls
2 Rare      the imbalance dial                     -> share
3 Sample    the cases that survived                no new control
4 Split     fit on everything, or on four fifths   -> train
5 Balance   the four methods                       -> method, k
```

Steps 1 and 3 unlock nothing deliberately — the two beats where the reader is
meant to look rather than fiddle.

**The evidence for that order**, since it is a design claim and not a taste:

- **PhET's implicit scaffolding** — guidance belongs in the affordances and
  constraints of the thing itself, so a reader is "guided without feeling
  guided". Hence controls that appear, and no numbered instructions on screen.
- **PhET on successive tabs** — each "adds complexity… and sometimes relaxes
  constraints present in earlier tabs". Every control here STAYS once revealed.
- **Schwartz & Bransford, *A Time For Telling*** (and Schwartz & Martin in
  statistics) — instruction lands far better when learners have first compared
  contrasting cases. Watching 142 of 150 cases disappear is that contrast;
  being told the class is rare is not.

**Rarity is a REMOVAL, not a redraw.** The cohort is 150 + 150, and the dial
keeps a PREFIX of the minority list, so 5% ⊂ 10% ⊂ 20% ⊂ 40% and the majority
never moves. Step 2 draws the cases it took as dashed outlines. Keeping 100 / 38
/ 17 / 8 of 150 against a fixed 150 gives 1:1.5, 1:3.9, 1:8.8, 1:18.8 — and
**k drops to {1, 3, 5}**, because eight cases leave k ≤ 7.

The claim sharpens under the new stage — 40 seeds, held out at the same
prevalence:

| minority | recall, none | recall, the four | gap, none | gap, the four |
|---|---|---|---|---|
| 40% (100 cases) | 78.0% | 84.3–84.5% | 5.3% | 2.2–2.5% |
| 20% (38) | 55.6% | 83.5–84.6% | 15.3% | 3.1–4.4% |
| 10% (17) | 33.0% | 81.7–83.6% | 18.9% | 4.4–6.4% |
| 5% (8) | **15.8%** | 78.0–81.6% | 19.3% | 7.0–9.3% |

Undersampling is furthest from the target at every share **while having the
highest recall at 5%** (81.6%) — it overshoots. The one place the two readings
disagree about which method wins, and worth keeping for that.

**The reference line is now the whole cohort's own fit.** Kenneth: *"ground truth
can make it simpler."* It replaced a line fitted to 20,000 invisible points —
defensible, since that is what every method estimates, but it invited exactly the
question it got. Now it comes from the picture in step 1, and the honest answer
is short: it is the line you get when you have every case.

### What core cost: 38 lines, one fingerprint run

| | |
|---|---|
| `when: { param, atLeast: n }` | a control appears at its step and **stays**. With `equals` alone a control belongs to exactly one step and vanishes after it |
| `keepOnReset: true` | Reset skips the parameter that says **which part of the widget you are looking at**. Without it, Reset collapses a narrative the reader has walked through |
| `anim.inert` | the widget says there is nothing to drive and core **removes** Step and Play. `stepLabel: null` cannot: it is read once when the shell is built |
| `.w-drive-group[hidden]` | `display: inline-flex` outranks the UA sheet's `[hidden]` — the same collision the drive row itself hit |

**All 123 fingerprint states identical** afterwards. `anim.inert` also kills the
standing "Replay does nothing under None and Class weights" wart.

**One blemish, left deliberately.** `k` is gated on `method === "smote"` and not
on the step, because only SMOTE has neighbours — so a reader who picks SMOTE at
step 5 and clicks back to step 2 sees a lone `k` slider. `when` takes one
parameter, and the alternative shows `k` under four methods that have none.

### Round three: it is not ground truth, and the copy stopped saying so

Kenneth: *"is the ideal line the ground truth from the data?"* **No** — and the
word "ideal" was quietly implying it was. Measured against the true optimal rule
for these two clouds, 200,000 patients at equal prevalence:

| | |
|---|---|
| the line and the true rule disagree about | **3.19%** of patients |
| error rate, the line | 16.42% |
| error rate, the true rule | 16.09% |
| the straight line therefore costs | **0.33 points** over the best possible |
| patients BOTH get wrong — the clouds genuinely overlap | **14.66%** |

The true rule is a curve, because the clouds have different spreads: majority
sd (1.7, 1.9) against minority (1.3, 1.6). It bows outward with height — at
x₂ = 5 it sits **14 px** from the line on the 560 px panel, and at x₂ = 1 and 9
it is **22 and 28 px** the other way.

So the third line is **the best straight cut when the classes are equally
common**, which is exactly what all four methods estimate — the right target for
this figure, and not the data's truth. It is now labelled **`equal classes`**
rather than `ideal`, and the readout tile reads *Gap to equal classes*.

**The true curve is deliberately not drawn.** A fourth line within 3% of the
third, on a figure whose complaint was complexity, answering a question this page
does not ask. The numbers are recorded here so the decision can be revisited
without re-measuring.

**And no on-screen string names a source any more.** Every `detail` line names a
mechanism: `minority samples copied at random until the counts are even` rather
than `RandomOverSampler — …`, `hold out 20% first, then balance only the 80% left
behind` rather than `the training half only — what 03-4 says to do`. The library
names moved into source comments one line above each method. All seven details
are 56–61 characters, so the rail cannot jog by a line as the reader drags across
a ladder (3.4d).

**A second minority cluster was measured and dropped.** The obvious story — two
minority clusters with majority in the gap, so interpolation lands synthetic
points in majority territory — **does not fire**: on the balanced boundary only
4.2% of synthetic points land on the majority side at 5% and k = 5, against 8.6%
for the single cluster. The single cloud shows the k effect *more* strongly.
Building a shape control for it would have been building for a story the data
does not support.
---

## The unsupervised arc · ONE WIDGET PER ALGORITHM

**Agreed 2026-08-26, and it reversed a plan that had already been built against.**
`03-5 - ML - Unsupervised Learning` holds four dimensionality-reduction methods,
and the first design was one widget with four tabs. Kenneth's call after seeing
the PCA tab: *"we'll do each algorithm as a separate widget due to the
complexity."*

| # | slug | method | status |
|---|---|---|---|
| 19 | `pca` | PCA | **built — draft** |
| 20 | `mds` | MDS, classical **and non-metric** | **built — draft**, five review rounds |
| 21 | `t-sne` | t-SNE | **built — shipped**, one long session on 2026-08-26 |
| 22 | `umap` | UMAP | **built — shipped**, four review rounds on 2026-08-26 |
| 23 | `kmeans` | K-Means (`03-5` cells 51–59) | **built — shipped**, four review rounds on 2026-08-26 |
| 24 | `dbscan` | DBSCAN (`03-5` cells 60–67) | **reconnoitred** — see § NEXT · DBSCAN below |

**What the count was, so it is not re-argued.** Four tabs meant roughly 25
parameters, six renderers that do not exist, four separate optimisers and ~18
fingerprint states, against a project budget of 3–8 hours a widget. An
adversarial pass over the four storyboards reached "these are four widgets,
honestly closer to five" independently.

**MDS was built next rather than t-SNE**, because it is the only one of the three
with a closed-form answer to debug the shared machinery against, and it
exercises the whole iterative half that PCA does not. That answer earned its
keep immediately — see Widget 20 below. **t-SNE is next, and its planning
session is done: the notebook gives it its own heading, so it is one widget, and
an exact t-SNE at widget scale runs in 55 ms, so it computes rather than
replays. § NEXT carries the measurements.**

---

## Widget 19 · `pca` — SHIPPED

**It belongs to neither arc**, like widget 18. Arc A is *what a model is* and arc
B is *how well it did*; this one hosts at `03-5 - ML - Unsupervised Learning`,
cells 7–19, where there is no model and no score — only a picture, and the
question of what may be read off it.

| # | slug | concept | what it answers | misconception | evidence |
|---|---|---|---|---|---|
| 19 | `pca` 🟠 | PCA | *Why not just plot two of the genes?* | That a 2-D plot **is** the data. Any two standardised genes keep exactly two thirds of the spread; the reader has to meet the cost of a projection before "the best plane" means anything | **reported** — the standard warning in the single-cell literature, and `03-5`'s own text is the invitation: it reads "the samples separate visually into 2 clusters" straight off a PCA plot |

**THE DESIGN WENT THROUGH FOUR SHAPES AND THE FOURTH IS THE ONE.** Recorded
because three were built, and the last two were cut for the same reason: I kept
adding to the previous version instead of going back to the mock-up Kenneth had
already approved.

1. *Four projections of one data set, which is honest* — a comparison widget.
   Cut when the four notebook diagrams turned out to be **mechanism** diagrams:
   he wanted what each method does, not which is best.
2. *Four beats: Gene 1 against Gene 2, then PC1, PC2, project.* The first beat
   was a baseline plane — what a reader does when they have not heard of PCA —
   and because the features are standardised it keeps **exactly 2.00 of 3.00**,
   verified to 8.9e-16 over 360 runs, for any pair of genes. **That fact
   survives and is worth re-using** if a later version wants a baseline back.
3. *The same four beats plus a rotatable cloud, a lead that centred the samples,
   a viewpoint choice and a one-axis orbit.* Cut whole: **"what the heck are you
   doing? this is not what we did in the mockup."** It was.
4. **What is built**, and it is the mock-up: two controls, free rotation, PCA
   drawn, projection shown.

**NOTHING SPINS, AND THAT IS THE POINT.** Shape 3 turned PC1 into place by power
iteration and swept PC2 through the perpendicular circle, defended on the ground
that both are real algorithms and therefore not a fiction. They are real, and it
was still wrong: sklearn computes an SVD, nothing rotates, and a reader watching
a line hunt for a maximum learns a mechanism the method has not got. *"Don't do
crazy spinning rotation that is nonsensical."* The components are now simply
drawn — they are a property of the data, they appear when asked for, and the
widget claims nothing about how they were found. **This also closes the honesty
gap that was open through shapes 2 and 3**, which no amount of careful wording
had managed to.

**THE SAMPLES ARRIVE CENTRED.** Shape 3 had a lead button that translated the
cloud onto the origin so "every feature minus its mean" was visible. It was one
press between the reader and the thing they came for, and standardising is
preprocessing rather than part of PCA — `03-5` does it in cell 3, two sections
earlier.

**Three controls, two gates, no Step and no Play.** `groups`, `samples` and
`seed` are the whole rail. `Run PCA` draws PC1, PC2 and the plane; `Project onto
the plane` flattens the samples and fills the 2-D panel. There is nothing to step
through, so both buttons are declined via `stepLabel: null` / `runLabel: null`
(4.5) — a dead Step beside a live gate teaches that the gate is the afterthought.

**`--c-cluster-a` … `-f` is a ramp of six, ordered brightest first: blue,
yellow, red, aqua, green, violet.** The first three are Kenneth's — *"choose
bright base colors first"* — and a figure showing three groups should get the
three most separable hues rather than whatever the other roles left over. An
earlier version started at aqua and magenta and read as a muted palette at the
count most widgets use.

**The last three were measured rather than picked by eye.** With blue/yellow/red
fixed, all ten ways of choosing three more were scored on the smallest weighted
RGB distance between any two of the six, in **both** themes:

| last three | worst pair |
|---|---|
| **aqua + green + violet** | **76** |
| orange + aqua + green / orange + aqua + violet / orange + green + violet | 40 |
| everything containing magenta | 34 |

Magenta is in every one of the worst options because it sits too close to red.
A first attempt used it and would have put two near-identical dots on the same
six-group figure. Final worst pair: 85 in light, 76 in dark.

**`samples` is per group, not in total**, so the groups stay balanced whatever
the count — an unbalanced cloud would put a second variable into a control meant
to change only how much data there is. **It was checked against the group count
before being added**, at all 25 combinations over 40 seeds: two components are
never worse than one, PC1+PC2 holds 99–100% throughout, and PC1 alone tracks the
group count and not the sample count. The two controls are independent: one sets
how much data there is, the other how hard the question is.

### A TRAP THAT WILL BITE THE NEXT WIDGET: only the FIRST gate animates

`GATE_PARAM` in `widgets/core/widget.js` is
`Object.entries(spec).find(([, f]) => f.type === "gate")?.[0]` — **the first gate
in the spec and only that one.** It is what the entry animation is keyed on. So
with two data gates, opening the first played in and opening the second silently
**jumped**: a data change runs `stopAnim(); render()`, and `init` then read the
new value and set the finished figure directly. Reported as *"i didn't see any
animation for projection?"* — and it was not there to see.

**The fix is to make the gates `display: true`**, which is also the honest
reading: neither gate changes what the state IS. `compute` finds the components
and the projection whatever they say; the gates choose how much is drawn. Display
parameters take the other branch and ask for frames through `anim.easing`, which
has no first-gate restriction. Any widget here wanting two animated gates needs
the same.

### THE ROTATION HAS TO LAND ON THE 2-D GRAPH, not merely face-on

Turning until the plane's normal points at the reader leaves the **in-plane**
rotation wherever it happened to be, so the cloud settled at an arbitrary roll
and the panel beside it showed the same samples the other way up. *"It should
rotate so the 2D plane looks the same as what the final 2d graph looks like."*

So the end state is written down rather than derived from angles: the screen
basis becomes **PC1 across and PC2 up** — exactly what the right panel plots —
and the scale becomes the right panel's scale, `(side/2 − 16) / span`. The
camera therefore returns its two basis vectors instead of a projection function,
and the turn slerps each toward its target and re-orthonormalises, which keeps
every intermediate frame an orthonormal pair so the cloud rotates rather than
shearing. Asserted: at the end of the turn **every sample sits within 1.1e-13 px
of where the 2-D panel draws it**, from every starting angle.

**`slerp` had been deleted and was then called again** — the "nothing spins"
rewrite removed the last use, and the landing needed it back. It went unnoticed
in the browser and was caught by the node driver, which is the argument for that
harness in one line.

**THE PROJECTION IS TWO MOVES IN SEQUENCE, NOT TWO AT ONCE.** They used to share
the middle tenth, so the samples were still falling while the camera had begun to
swing — two motions together, and the eye can follow neither.

| | |
|---|---|
| 0.00 – 0.42 | every sample slides onto the plane |
| 0.42 – 1.00 | the plane turns to face the reader |
| 0.70 – 1.00 | the 2-D panel fades up behind the end of that turn |

1800ms against 900 for the components, because the components appearing is a
*reveal* and this is a *move* (4.3). The turn takes the larger share and a cubic
ease rather than the quadratic the drop uses: a plane that starts turning
abruptly reads as a cut. The turn also takes the **shorter way round** — without
that a 10-degree move can travel 350 the wrong way, which is precisely the
nonsensical spin this widget exists without.

**THE GROUP CENTRES LIE IN A PLANE, NOT ON A LINE**, and that one choice is what
makes a second component worth having. Nearest-neighbour-in-its-own-group, 40
seeds:

| centres | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|
| on a line, PC1 | 99% | 98% | 85% | 70% | 57% |
| on a line, PC1+PC2 | 100% | 99% | 85% | 68% | 55% |
| **in a plane, PC1** | 100% | 91% | 78% | 67% | **51%** |
| **in a plane, PC1+PC2** | 100% | 100% | 100% | 100% | **99%** |

With the centres on a line PC1 already separates everything and PC2 adds
nothing, so "now add the second component" is a step with no reason behind it.
In a plane, **one** component gets monotonically worse as groups are added and
**two** stay perfect. That is the argument for PC2, and it is what makes `groups`
a control that carries an idea (3.5) rather than a count of dots.

**Not gated — Step and Play.** A gate is for a stage the reader must *choose* to
enter; widget 18 has three and each is a decision with a consequence. These four
beats are one continuous story with no decision in it, so gates would add three
presses that mean nothing and three chances to stop halfway.

**`drag` was added to `widgets/core/widget.js`** so the cloud can be turned
freely. Core previously resolved a pointer to an identity through the region map
and ignored movement entirely.

It names its parameters **up front**, so core validates them at load exactly as
it validates a region — a name that is not in the spec is a code defect and
throws there rather than doing nothing on the first drag. It may name **more
than one**, which a region may not, and the difference is real rather than a
relaxation: a region's objection to two is that it would paint an intermediate
state, write the URL twice and make a click a different transaction from the one
the harness performs. None of that follows here, because the values are applied
**together** and only the last goes through `setParam` — one recompute, one
repaint, one address-bar write, however many are named. Two numbers that are one
gesture stay one transaction.

**A first attempt got this wrong** and constrained the camera to a single
`orbit` axis with the tilt hidden inside a viewpoint choice, on a
misreading of that comment. Free rotation was the ask, and `turn` and `tilt`
are now both parameters — so a shared link reproduces the angle a student was
looking from. Turn wraps (a cloud has no far side, and a drag that hits a wall
reads as the figure being broken); tilt clamps at 80°, past which the vertical
axis collapses to a point.

**Samples paint back to front**, or the cloud is a flat sticker and turning it
tells you nothing.

### THIS WIDGET NO LONGER HAS A FAILING CASE, and principle 2.6 wants one

Shape 2 carried a `shape` control with two, both measured and both the
notebook's own blind spots:

- **`outlier`** — `03-5` cell 7 lists "sensitive to outliers, which can dominate
  principal components" and never shows it. One sample moved 12 units
  perpendicular to the group axis, 60 seeds: PC1 swings onto it (alignment
  0.91), **that one sample supplies 77% of PC1's variance**, and the other
  eleven are squeezed into **30% of the plot's width**. Sharp transition between
  6 and 12 units — at 8 it is 7% and 97%.
- **`round`** — a cloud with no groups in it. The plane still keeps **2.42 of
  3.00, 81%**, and PC1 still beats every single gene. *Keeping more of the
  spread is not the same as finding something.*

Both were dropped for simplicity, not because they stopped being true. **The
numbers above are enough to rebuild either as one extra option.** Its caption was
wrong twice on the way — first "no direction carries much more than another",
then "barely better than any two genes" — both times by describing the
population when the figure shows twelve samples of it.

**A `within one gene` failing case was designed and is arithmetically
impossible**, which is worth not rediscovering: after `StandardScaler` every
feature has variance exactly 1.00, so no gene can "have a large spread", and with
only three genes the group direction can never be pushed out of the top two
components. What would do it is a correlated nuisance direction loading on all
three — and that needs more than three genes to draw.

**The reconnaissance below was done for the four-method comparison widget.** It
is the payoff for the per-algorithm widgets rather than their spine. None is
wasted; none should be taken again.

### The real data was measured first, and it answered the question the plan hung on

`Colorectal_GSE44076.csv`, preprocessed as the notebook does: **194 samples ×
49,386 probes, balanced 97 normal / 97 adenocarcinoma.** All four methods, five
seeds each.

| method | silhouette of the two clusters **in the picture** | of 194, how many it puts in the **wrong** group | 10-NN agreement across seeds |
|---|---|---|---|
| MDS | 0.400 | 5, 5, 8, 7, 7 | **0.35** |
| PCA | 0.590 | 5, 5, 5, 5, 5 | **1.00** |
| t-SNE | 0.679 | 2, 2, 2, 2, 2 | 0.72 |
| UMAP | **0.810** | 2, 2, 2, 2, 2 | 0.71 |

**How separated the picture looks doubles; how much it knows moves by three
samples out of 194.** UMAP and t-SNE score an identical ARI of 0.959, MDS and PCA
an identical 0.899 — four methods, two answers. Distance faithfulness runs the
other way: MDS 0.77, PCA 0.76, t-SNE 0.61, UMAP 0.56. The tighter and more
convincing the clusters look, the less the distances mean.

**PCA is bit-identical across all five seeds. MDS is the least reproducible of
the four, not t-SNE** — only about a third of each point's ten nearest neighbours
survive a seed change, and the number of samples it puts in the wrong group
changes with the seed. That is the opposite of what most people expect, and it is
what `03-5`'s "the cluster separation is less clear" is actually recording.

**On generated blobs where the truth is known:** a cluster genuinely 10× wider
renders 2.1× wider in t-SNE and **1.2× in UMAP**; a true 5:1 gap ratio renders as
**11.4:1 in UMAP**. PCA gets both right to two decimals, being a linear
projection.

**Two things were measured and did NOT fire, so nobody re-runs them.** t-SNE does
not invent clusters from pure noise at this scale — silhouettes 0.31–0.37 for
every method including PCA — and no method splits the tumour class into fake
subgroups. The Wattenberg-style "t-SNE manufactures structure" demonstration is
not available on data of this size.

**The consequence for principle 2.6:** on the real data nothing fails. Every
method separates the classes at 97–99%. The failing cases therefore have to come
from the generated stage, which is what the `shape` control is.

### Treatment A over B, and what A costs

`_lab/dr-pca-mechanism.html` drew both at the real width. **A** — the 3-D cloud
with a turning plane, Kenneth's diagram. **B** — the same mechanism one dimension
lower, where a direction is a single angle so the variance-against-angle curve
underneath is provably every direction there is. Kenneth chose A: *"go with A, it
matches my diagrams."*

**A cannot show every candidate**, because in 3-D a direction has two degrees of
freedom. That is not paid for by sweeping a family and implying it was
exhaustive; it is paid by making both moves real algorithms. PC1 is **power
iteration** — multiply by the covariance, renormalise — which is how the top
eigenvector is genuinely computed, climbs monotonically, and converges from any
start. PC2 is an **exhaustive 180° sweep** of the circle perpendicular to PC1,
which in 3-D really is every allowed direction, and where the reader watches the
spread rise, pass the maximum and *fall*.

**The residual honesty gap, named rather than designed away:** sklearn computes
PCA by SVD, not by iterating. Power iteration is a real algorithm and randomised
SVD is essentially it, so the widget does not lie — but a reader could leave
thinking the library turns a line. Open, not settled.

### The generated stage, measured before it was drawn

**Twelve samples, not nine.** The diagram has three groups of three. Over 60
seeds three-of-three separates in the 2-D plot at a mean of 97% but **67% on the
worst seed** — four samples of nine landing nearer another group, on a figure
whose whole claim is that the groups came through. Four-of-three is 99% mean,
92% worst, no seed below 90%.

**A `within one gene` failing case was designed and is arithmetically
impossible.** After `StandardScaler` every feature has variance exactly 1.00, so
no gene can "have a large spread", and with only three genes the group direction
can never be pushed out of the top two components. Measured, then dropped. What
would actually do it is a correlated nuisance direction loading on all three
genes — and that needs more than three genes to draw.

**The failing case is the notebook's own instead.** `03-5` cell 7 lists
"sensitive to outliers, which can dominate principal components" and never shows
it. One sample moved 12 units perpendicular to the group axis, over 60 seeds:
PC1 swings onto it (alignment 0.91), **that one sample supplies 77% of PC1's
variance**, and the other eleven are squeezed into **30% of the plot's width**.
The transition is sharp and sits between 6 and 12 units — at 8 it is 7% and 97%.

**The round cloud turned out to be the sharper failing case.** Its caption nearly
shipped as "no direction carries much more than another", which is true of the
population and false of twelve samples: PC1 lands at **1.50 against PC2's 0.90**
and clears the one-gene tick at every seed. Twelve samples in three genes
manufacture a leading direction out of nothing.

**λ₁ ≥ 1 is a theorem on standardised data**, with equality only if every
correlation is zero. So "PC1 lands past the one-gene tick" is guaranteed and must
not be presented as a discovery. What is contingent, and is the real content, is
*how far* past — 2.80 at `groups`, 1.64 at `outlier`, 1.50 at `round`.

### Three bugs the assertions caught and no screenshot would have

- **The `start` control printed a claim that was false.** An eigenvector has no
  sign, so power iteration lands on whichever end it started nearest:
  **83 of 270 start-pairs landed on opposite signs**, mirroring the arrow and
  flipping the 2-D scatter. Fixed with sklearn's `svd_flip` convention, and the
  direction arrows are drawn **double-headed**, because pinning the sign is a
  convention and one arrowhead would assert a direction the data has not got.
- **Power iteration capped at 14 steps landed 0.29 from the true PC1** on the
  worst of 360 trajectories. It needs up to **500** when the top two eigenvalues
  are close, which is exactly what two of the three shapes are built to have. It
  now runs to convergence, shows six real iterates, and the answer comes from a
  Jacobi eigendecomposition — agreement verified to 1e-12.
- **Below 420px the two panels overflowed the canvas** and the right one was
  simply not drawn. A `Math.max(180, …)` floor that read as protecting the figure
  was what did it.

### `--c-cluster-a/b/c` were added to `tokens.css`

A third group colour did not exist. `--c-group-a`/`--c-group-b` are **two arms of
a comparison**, which is a thing you decided; a cluster in a projection is the
opposite — the grouping is what you are trying to find out. Three, because the
failure these widgets exist to show is a third group appearing, merging or moving
between methods. Aqua, magenta and green are what the ramp had left.

**This is a `widgets/core/` change and the full suite was run.** 123 of 123
states: every text hash identical, every pixel hash different — uniformly, on
every widget, at `devicePixelRatio` 1 against a baseline recorded at the
machine's scaled DPR. That is the documented `px` behaviour, not a regression,
but **the pixel half is still unverified** and wants one run from the normal
browser before this lands.

### Still owed

- The t-SNE and UMAP tabs. Storyboards exist for all four; **MDS is built**, as
  widget 20 and its own widget rather than a tab.
- **An adversarial pass says these are four widgets, not one** — roughly 25
  parameters, six renderers that do not exist, four separate optimisers, ~18
  fingerprint states. It recommends building **MDS** next rather than t-SNE:
  MDS has a closed-form answer to debug the shared skeleton against, and it
  exercises the whole iterative half that PCA does not.
- No fingerprint states, by design — the shape is unreviewed.
- **`dimreduce-artifacts` in the arc-B tail list is this widget's second half**
  and should be struck from there, or narrowed, once the four tabs land.

### THE RAIL GAINED SECTIONS — Kenneth, 2026-08-27

Round two of the rail-section sweep (candidates in
[`_lab/dimred-rail.html`](../widgets/_lab/dimred-rail.html)): **The data**
(groups+samples on one row, seed, True groups) / **PCA** (the two gates).
This was the loud half of the double-naming call — "PCA" sits directly above a
button reading "Run PCA" — and Kenneth took arc consistency over avoiding the
repetition. +34px measured. Rail-only — both hashes untouched, no rebaseline.
---

## Widget 20 · `mds` — SHIPPED

**FOUR ROUNDS OF REVIEW IN, and the fourth added a second method.** Built against the storyboard below, which is kept
intact underneath so the answers can be checked against what was assumed; then
Kenneth asked for three things, one of which changed the stage — see *Round one*
below before reading anything under it, because two later sections it
supersedes are marked and kept rather than deleted.

| # | slug | concept | what it answers | misconception | evidence |
|---|---|---|---|---|---|
| 20 | `mds` 🟠 | Multidimensional scaling, classical and non-metric | *What does a method see when it is given no coordinates?* | That a 2-D picture is a **projection** of the data — a flattening, with a direction of view. MDS has no view: it is handed a table of distances and builds an arrangement from nothing, and the arrangement it builds is only as good as the distances it manages to match | **reported** — `03-5`'s own text reads "the cluster separation is less clear" off an MDS plot, which is a statement about the picture rather than about the fit |

### The one sentence, and where it is on screen

*The input is the table of distances, not the cloud, and the 2-D picture is the
arrangement whose distances come closest to it.*

**Three panels, left to right: where the samples are, what was measured, what
came out.** One gate — *Measure every pair* — and then Step and Play.

**THE BEAT THAT IS THE WIDGET IS THE THIRD PHASE OF THE GATE.** Opening it plays
four overlapping beats over 2 s: a line grows between every pair, the distances
fill into the table in reading order, **the gene axes go out and the samples
hollow to faint rings**, and the starting layout arrives on the right. The
outline stays for the rest of the run, so the reader watches it be ignored
rather than deleted — and turning it still works, and still moves no digit in
the table, which is the seed of "distance survives rotation".

**EVERY CELL CARRIES TWO NUMBERS**, and that is the argument rather than a
decoration: the distance the samples have, in full ink, and directly under it
the distance the picture managed, in `--c-empirical`. At four samples the table
reads 3.27 six times over the top row of every cell and **2.79 2.79 2.79 2.79
3.94 3.94** underneath — the square, visible without a sentence saying so.
Adjacency (2.7) applied per cell instead of per figure.

### Round one of review: three asks, and the second one changed the stage

Kenneth's first look: *"looks nice a few things, 1. can we visualize the
original points in 3D so show that it's in >2D? 2. could we have the seed slider
to vary the samples 3. is a graph of the stress possible to show the
minimization?"* All three are in. The second one is the interesting one, because
doing it literally would have broken the widget.

**1 · The samples now sit on a drawn sphere, and the dots are sized by depth.**
The sphere is its three coordinate great circles, with the half of each that
runs behind drawn at a third of the ink — which is what stops three ellipses
reading as three flat rings, and what makes the turning legible. A bounding cube
was the other candidate and does the same job; the sphere wins because it is
*exactly true of this stage* — every sample is on it — so it describes the data
rather than furnishing the panel. On top of that a near sample is drawn a fifth
larger and at full ink and a far one a fifth smaller and lighter: depth sorting
alone only separates the samples that happen to overlap, and says nothing about
a dot sitting *between* two others. Both fade out with the axes when the
coordinates are set aside.

**2 · The seed moves the samples — but FULLY RANDOM SAMPLES BREAK THE WIDGET,
and that had to be measured before it was believed.** n random points on a
sphere are near-coplanar often enough that four of them fit in two dimensions to
three decimals at the median seed:

| samples | n = 3 | n = 4: min / p50 / max final stress over 200 seeds |
|---|---|---|
| uniform on the sphere | 0.000 always | **0.000** / 0.037 / 3.553 |
| spread, jittered by 0.12R | 0.000 always | **0.385** / 1.673 / 4.409 |
| spread, jittered by 0.20R | 0.000 always | 0.048 / 1.435 / 5.152 |
| spread, jittered by 0.30R | 0.000 always | 0.000 / 0.891 / 6.761 |

Uniform sampling hands the reader the *opposite* of the lesson — at seed 1 the
four samples fit exactly. So the shapes stay and the seed **jitters** them, at
**0.12 of the radius: the largest jitter that still fails at every seed.** Each
sample is put back on the sphere afterwards, because raw stress is
scale-dependent and a cloud that grew with the seed would make the number
incomparable between seeds.

**What this bought, and what it cost.** Bought: the table stops reading as a
pattern — six cells all saying 3.27 looked like a construction, and now every
seed gives a different set of measurements — and `seed` means *new data*, which
is what it means in the other nineteen widgets. Cost: **the regular
tetrahedron's 3.27 → 2.79 / 3.94 is gone as an on-screen fact**, and so is the
local-optimum lesson at five and six samples, which needed fixed data to be
visible as such. What survives is the same contrast with more variety behind it:
three fits at every seed, four never does, and *how badly* it fails now ranges
0.4 to 4.4.

**The closed-form checks are gone from the widget but not from the record**, and
they were what verified the solver in the first place — see the table below,
which is now history rather than a live assertion. What replaces them in the
driver are properties that hold at every seed: n = 3 exact at all 60 tested,
n = 4 never below 0.2, twelve seeds giving twelve different distance tables, and
**the stress never rising across 100 runs**, which is SMACOF's defining property
and the one the new chart draws.

**3 · A stress chart under the arrangement**, 40–78px tall depending on the
canvas. It is drawn only as far as the reader has stepped (2.1) — the whole
curve up front would hand them the answer before they pressed anything — but the
FRAME is the finished run's, the y axis fixed at the starting layout's stress and
the x axis at however many steps there turn out to be (2.5). It sits under the
arrangement and nowhere else: run full width it would sit under the cloud too
and claim a relationship it has not got. The head of the curve is
`--c-highlight`, which is the token for the thing moving right now.

**Where the numbers moved.** Widget height goes 272 → 379 at a 776px canvas and
203 → 287 at 550. Default seed 1 at four samples: stress 1.445 rather than
1.830, over 19 steps rather than 25.

### Round two of review: groups, and the same lesson arriving one level up

Kenneth: *"could we also set groups like in PCA? then we can see the
clustering?"* — so `points` is gone and the rail carries widget 19's own pair,
**Groups** (2–4) and **Samples per group** (1–3), for totals of 2 to 12. Group
centres spread on the sphere and jittered by the seed; members scattered around
their centre at σ = 0.22R.

**THE GROUP COUNT TURNED OUT TO REPRODUCE THE WIDGET'S ARGUMENT, and that is
what makes it a control worth having rather than more dots (3.5).** Two centres
make a line and three make a plane — both are already flat, so a 2-D picture can
hold them exactly. Four make a tetrahedron and it cannot. Measured over 40 seeds
at three per group:

| groups | median stress | what the reader sees |
|---|---|---|
| 2 | **0.01** | the picture is faithful — every distance comes out right |
| 3 | **0.12** | still faithful |
| 4 | **14.3** | the clusters come through; the gaps between them do not |

It is the sample-count lesson at a second scale: three points fit and four never
do, and their *centres* obey the same rule. At four groups the separation ratio
— smallest between-cluster distance over largest within-cluster one — still
reads **2.5**, so every cluster is a distinct blob, while how far apart they
LOOK has stopped being how far apart they are. **That is the single most useful
thing the widget now says**, and it is exactly `03-5`'s "the cluster separation
is less clear" with a mechanism under it.

**Separation is asserted, not eyeballed.** Every grouped setting, 30 seeds each,
worst-case ratio > 1 — because "see the clustering" fails silently if a cluster
ever smears into its neighbour, and no pixel hash would notice.

### The table had to change, and the shading is the part worth keeping

**Twelve samples is a 12 × 12 table.** The cells reach 7px, which is not a
number anybody reads. Two things follow:

- **Every cell is now shaded by its distance** — darker is further, so the
  shading and the number it sits under say the same thing rather than opposite
  ones. Alpha runs 0.04 to 0.34 of `--c-empirical`, capped well short of opaque
  so a number stays readable on top. It is drawn at **every** count, so at six
  samples it sits under the numbers rather than replacing them.
- **The numbers go when the cell drops below 8px.** Numbers up to 8 samples at a
  550px canvas and 9 at 770; nothing at 12. Nine is the one count that flips
  with the window, which is the cost of a legibility floor honestly applied.

**This is a gain, not a concession.** What a reader wants from a 12 × 12 table
is the BLOCK PATTERN — near within a cluster, far between them — and that is a
picture, not a set of figures. The shading is how the reader sees that *the
input already contains the clustering*, which is the whole reason the 2-D
picture can show it.

**Letters and pair lines retire together at six samples.** Past that a letter
has nothing to label — the dots sit on top of each other inside a cluster — and
fifteen pair lines read as a figure where sixty-six read as a hairball. The
table's headers keep the letters at every count, in the sample's own letter and
its GROUP's colour, which is what makes the block pattern readable as groups
rather than as texture.

**GROUPS STOP AT FOUR, where PCA goes to six.** The table is n by n and it is
the object this widget is about, so the table sets the limit. PCA can afford
six groups of twelve because its figure is a scatter.

**The default is two groups of three**, which is `03-5`'s own case — normal
against tumour — and the largest setting whose table is comfortably numbered at
every width. It is the *faithful* end of the sweep: stress 0.001, the picture
exact. **Worth a decision:** the previous default failed to fit, which is the
widget's headline claim, and no setting both shows clusters and fails while
staying comfortably numbered — four groups of two is the closest and its font
lands exactly on the 8px threshold at 550.

### Round three of review: two by two, and which quadrant is which

Kenneth: *"can you see if can decongest the panels..all 3 are in a row with the
stress graph in a separate row..how to 2 x 2? or any other arrangement that
makes sense?"* — the row of three is gone.

```
    the samples        the table
    the stress         the arrangement
```

**Three in a row put every panel on a third of the canvas** — 210px at the width
a reader has and 146 at the narrowest — and left the chart alone in a band that
was two thirds empty. Each panel now gets **half** the canvas, which is 37% more,
and the widget goes 377px tall to 666 (550px canvas: 287 to 492). That is
ordinary here: `multiple-testing` is 700 and `odds-and-risk` 718.

**The table is what the extra width buys.** Its cells grow enough to keep their
numbers where the row could not:

| samples | row of three | two by two |
|---|---|---|
| 6 | 13px / 10px | 13px / **13px** |
| 8 | 10px / 8px | 13px / **11px** |
| 9 | 10px / **none** | 13px / **9px** |
| 12 | **none** / none | **10px** / none |

(desktop 770px canvas / narrow 550px). Twelve samples — four groups of three,
the setting where the fit breaks — now prints all 132 of its numbers at the
width a reader has, where the row of three could only shade them.

**THE QUADRANTS ARE NOT INTERCHANGEABLE**, and there is exactly one assignment
that satisfies all three constraints:

- **the table sits DIRECTLY ABOVE the arrangement** it is the input to, which is
  the one adjacency the widget cannot do without (2.7)
- **the cloud is DIAGONAL from the arrangement**, never beside or above it.
  Widget 19 puts a cloud next to a 2-D plot because there the second IS a
  projection of the first; here it is not, and two spaces sharing an edge invite
  exactly the reading this widget exists to break. In the row of three the table
  sat physically between them, and that was doing real work
- **reading order runs across then down** (3.1), which is the order the story
  does: the samples, their distances, the fit falling, the arrangement

With the cloud top-left, that forces the arrangement bottom-right, and the two
remaining quadrants take the table and the chart. Table top-right is the only
one of those two that puts it above the arrangement. Everything is determined.

**The chart earned its quadrant rather than being stretched into it.** With a
half-canvas cell it is a chart now instead of a baseline with a line over it: a
plot area inset from the cell, four gridlines, an axis, the starting stress
against 0 on the y and the step count on the x. The reader is being asked to
read a SHAPE — steep, then flat — and a shape needs something to be read
against.

### Round four of review: non-metric MDS, in this widget

Kenneth's four calls on the mock-up (`widgets/_lab/mds-nmds.html`): a **segmented
control**, the table showing **ranks**, **no transform panel**, and **no squash
control** — *"we just want to give an intuition of how non-metric is different
because it uses ranks."* All four are in.

**One widget, and `05-04` decided it rather than taste.** The lesson has one
section — `## 3. Multidimensional Scaling (MDS): Classical and Non-metric` —
with `### 1) Classical MDS` and `### 2) Non-metric MDS` under it, on the same
`distMatrix`: `cmdscale(dist(t(countData)), k = 2)` then
`isoMDS(distMatrix, k = 2)`. Its data is `airway`, 4 controls and 4 treated,
which is why **`samples per group` gained a fourth option** — without it the
widget could not reproduce the design it sits beside.

### The rank fit CONTINUES the metric one, and that is load-bearing

`isoMDS` takes its default starting configuration from `cmdscale`, so beginning
at the classical answer is what the lesson's own code does. It is also the
difference between working and not: from a random start, non-metric SMACOF
**collapsed 18 of 40 seeds** into degenerate clumps at eight samples. From the
metric fit it never did.

So the rank-order trajectory **is the metric one with more steps on the end**,
and three things fall out of that:

- the reader who has run the metric fit **keeps their place** when they switch,
  which is what makes a segmented control read as *carry on* rather than *start
  again*. `rebuild` clamps the step index for the switch back, where the path
  gets shorter
- the stress chart is one curve with the switch marked, drawn only once the
  reader has stepped past it
- `method` is `display: true` even though it changes what `compute` returns.
  That is the point rather than a fudge: the prefix is bit-identical, asserted

### The table prints ranks, and they disagree exactly where the fit is bad

Under the rank fit the cell shows the measured rank over the rank the picture
produced, the caption changes to *Rank of every pair's distance*, and the
shading runs on rank too — which flattens it, honestly: a distance ramp
separates *far* from *very far*, and a rank ramp is evenly spaced because the
method has stopped being able to tell them apart.

**A threshold nudge was proposed for this and then measured away.** The worry
was that ranks would disagree everywhere and make a good fit look broken. What
the measurement showed is that agreement tracks the GROUP COUNT, not the sample
count — the share of pairs holding their exact rank, over 40 seeds:

| | 2 groups | 3 groups | 4 groups |
|---|---|---|---|
| exact rank held | 87–100% | 44–100% | **6–33%** |

That is the widget's own lesson arriving per cell: two centres make a line and
three make a plane, so 2-D holds them and the order survives; four make a
tetrahedron and it does not. **The disagreement is content.** And a rank is a
shorter string than a distance, so it fits wherever a distance did — no
threshold change was needed at all.

### THE RANK FIT DEGENERATES AT FOUR GROUPS, and it is recorded rather than hidden

Non-metric scaling can satisfy an order by clumping. With four tetrahedral
centres — which 2-D cannot hold anyway — it pulls each cluster toward a point
and equalises what is left. Over 20 seeds at four groups: **spearman 0.785 →
0.809 while stress-1 goes 0.159 → 0.106**, which is the textbook signature of a
degenerate solution — the number falls because the configuration collapsed, not
because the order improved. Two and three groups are clean at 0/20.

**It is not the solver, and three things were tried before concluding that:**

| tried | result |
|---|---|
| rescale the disparities to the configuration's size | 19/30 collapse |
| rescale the configuration instead (textbook) | **bit-identical**, 19/30 |
| stop on stress gain < 1e-3, the way `isoMDS` does | 12/20, from 14/20 |

So it ships, and the readout says so: under the rank fit the second tile becomes
**Ranks held**, which reads `15/15` at the default and `2/66` at four groups of
three. **A reader is told what happened rather than left to wonder.** If Kenneth
would rather the widget never showed it, the options are capping `groups` at 3
while the rank fit is selected, or a line of copy naming it.

### CHECKED AGAINST THE LIBRARY: the continuation is real, the iterating first half is not `cmdscale`

Kenneth, on the *rank order from here* marker: *"does this mean the NMDS
algorithm uses MDS first, then converts to ranks? is it your idea, or this is
the actual algorithm? we don't want to invent things just for visualization."*
The right question, and it was answered from the MASS documentation rather than
from memory.

**The continuation is real.** `isoMDS`'s signature is

```
isoMDS(d, y = cmdscale(d, k), k = 2, maxit = 50, trace = TRUE, tol = 1e-3, p = 2)
```

and its own words for `y` are *"An initial configuration. If none is supplied,
`cmdscale` is used to provide the classical solution."* So
`isoMDS(distMatrix, k = 2)` — exactly how `05-04` calls it — computes the
classical solution first and iterates on ranks from there. The same page
confirms the stress this widget prints: *"the square root of the ratio of the
sum of squared differences between the input distances and those of the
configuration to the sum of configuration distances squared"*, which is Kruskal
stress-1, and *"an iterative algorithm is used, which will usually converge in
around 10 iterations"*, which is the length of the widget's rank phase.

**WHAT IS NOT `cmdscale` IS THE FIRST HALF.** `cmdscale` is classical
Torgerson scaling — an eigendecomposition, closed form, no iterations at all.
The widget's metric phase is SMACOF, which iterates. So a reader who maps the
widget's first run onto the lesson's first line of code would come away thinking
`cmdscale` converges over steps, and it does not.

**Three things make that defensible, and they are worth having written down
rather than rediscovered:**

- **SMACOF is a real metric MDS, not a teaching fiction.** It is what
  `sklearn.manifold.MDS(metric=True)` runs. The widget is faithful to a
  standard implementation; it is just not faithful to R's.
- **The lesson's own prose describes the iterative one.** `05-04` says of
  classical MDS: *"The optimization process involves adjusting the positions of
  points in the lower-dimensional space to minimize the stress function S. This
  is typically done using iterative algorithms"*, and carries a figure called
  `mds-stress.png` for it. The prose and the code disagree in the lesson itself;
  the widget matches the prose.
- **The widget never names `cmdscale`.** The control says *Distances* and
  *match the distances themselves*. A detail line that did name it was cut for
  exactly this reason (2.9) — the claim that survives is the one the widget can
  back: the rank fit carries on from where the metric fit stopped.

**SETTLED: the metric option names stress minimisation.** Kenneth's call —
*"yes, name it as stress minimization"* — so its detail reads *match the
distances themselves — by minimising the stress, a step at a time*. The last
four words are the ones doing the work: `cmdscale` does not take steps, so a
reader who has just run it cannot map this fit onto it.

This is the same class of gap as widget 19's *nothing spins*, and it was closed
the opposite way. There, the motion was removed, because sklearn computes an SVD
and nothing rotates. Here the motion is real — `sklearn.manifold.MDS(metric=True)`
genuinely iterates — so the fix is to NAME it rather than to remove it. **The
test is not "is there motion" but "does the library do this"**, and the two
widgets answer it differently because their libraries do.

Both options' details render three lines at 300px, so switching between them
does not jog the rail by a line (3.4d).

### The size of a non-metric arrangement is arbitrary, so it is held fixed

Kenneth, on seeing it: *"in NMDS the clusters are quite close together and not as
clear as MDS."* **Half of that was the drawing rather than the method.** Only the
ORDER of the distances is fitted, so nothing in the objective says how big the
picture should be — and left alone the fit drifts smaller, because the monotone
fit pools neighbouring distances and pooling averages. The final arrangement as a
fraction of the panel, before the fix:

| | metric | rank |
|---|---|---|
| two or three groups | 84% | 84% |
| four groups of two | 83% | 66% |
| four groups of three | 84% | **48%** |

So at four groups the rank result was drawn at half size beside a metric one at
full size, and the reader was comparing two pictures at different scales. The
rank fit now holds the metric fit's size at every step — which the first frame
already has, so the switch stays seamless. **Scaling changes no distance ORDER,
so it changes nothing the fit is judged on**: separation and stress come out the
same either way, and the 149 assertions do not move.

**The other half was real** and is the degeneracy recorded above. Fixing the
scale makes it MORE visible rather than less, which is the right direction: the
clusters that merged are now drawn merged at full size instead of merged and
small.

### Kruskal stress-1 replaces raw stress, throughout

The widget printed RAW stress, which is `sklearn`'s `stress_` and the lesson's
classical formula. The lesson's non-metric formula is the normalised one, and
the two are not comparable — so one chart carrying both methods forces a single
definition, and stress-1 is the one that works for both. **Every stress figure
recorded above this line is a different number now**: four samples ungrouped
reads 0.152 rather than 1.445, four groups of three 0.190 rather than 20.7.

**And stress-1 is not monotone, which raw stress was.** It divides by the size
of the arrangement, and the first Guttman step out of a random layout can shrink
it faster than it improves the fit: 8 of 5699 metric steps rise, every one of
them at step 1, the worst by 0.108. The chart's ceiling is the trajectory's
maximum rather than its first value, or those runs would draw their second point
above the top of the frame.

### SUPERSEDED BY ROUND ONE · the closed-form checks, which verified the solver

| stage | what must come out | measured |
|---|---|---|
| n = 3 | stress **0.000** — three points make one triangle, and a triangle is flat | 0.000 on **200 of 200** starting layouts |
| n = 4, regular tetrahedron | six equal distances of **3.27** come out as four at **2.79** and two at **3.94**; stress **1.830** | exact, on **200 of 200** |
| the seed | one stress value, and the arrangement mirrored about half the time | 1.830 on all 50; the mirror splits **22 / 28** |

The analytic optimum confirms the fit rather than the other way round: for a
square of side *s* against a target δ, minimising 4(s − δ)² + 2(s√2 − δ)² gives
*s* = δ(2 + √2)/4 = 2.7876 and stress 1.8302. **Debug the machinery against
those, not against a picture** — it is what caught a harness that was pumping
the reveal instead of the fit and reporting stress 8.58 at n = 4.

### SUPERSEDED BY ROUND TWO · the stage before it had groups

One sentence describes all four counts, and the shapes fall out of it — a
triangle, a **regular tetrahedron**, a triangular bipyramid, an octahedron, all
on a sphere of radius 2 — and then the seed moves every sample off it by 0.12 of
the radius and puts it back on the surface (round one). R = 2 is what made the
unjittered tetrahedron's edge 3.266, which is the number the superseded checks
below are written against.

**`points` STOPS AT SIX, and both reasons are one reason.** `--c-cluster-a…f` is
six colours and a sample needs its own identity in three panels at once; and the
table is n by n, so a seventh row takes the cells below the size two numbers fit
in at the narrowest canvas. The storyboard said 3–8.

**The default is FOUR, not three.** Three opens on stress 0.000, which is the
wrong first impression of a method whose whole content is *close, not equal*;
four is the failing case one notch to the right of the exact one, and the reader
meets "close" before they meet "exact".

**The arrangement is turned by a fixed rotation before anything is measured.**
Unrotated, the octahedron's six samples sit exactly ON the three gene axes,
which says a sample is one gene. Nothing about the method changes — every
distance is identical — which is itself the first thing the widget shows.

### SUPERSEDED BY ROUND ONE · `seed` used to be the optimiser's start only

Kept because the measurement behind it is real and would otherwise be taken
again. With the data fixed per count, the seed was where SMACOF was dropped
before its first step, and at five and six samples it changed the ANSWER
rather than the orientation — SMACOF is a local optimiser and these shapes
are symmetric enough to have several optima:

| n | optima found over 200 starting layouts, data fixed |
|---|---|
| 3 | 0.000 x200 |
| 4 | 1.830 x200 |
| 5 | **4.100 x162**, 5.287 x4, 8.380 x34 |
| 6 | **6.468 x73**, 8.483 x72, 12.328 x38, 14.216 x17 |

That is a true property of the method — sklearn's `n_init=4` exists for it,
and the reconnaissance measured MDS as the least reproducible of the four on
the real data (10-NN agreement 0.35 across seeds against PCA's 1.00). It is
no longer VISIBLE, because the seed now moves the data too and the two causes
cannot be told apart from one number. Restoring it means freezing the data
again, which is the change round one reversed.

### Decided while building, so they are not re-argued

- **The starting layout is part of the reveal, not of the first press.** Held
  back until the first step it flashed past inside that step's 340 ms and the
  reader saw only the result. Shown, Rearrange is a button that **improves**
  something and the stress tile has a baseline to fall from.
- **Stop when the picture stops moving, not when the number stops falling.** Raw
  stress keeps improving in the ninth decimal long after every sample is inside
  a pixel of where it lands, and those steps are Play running with nothing to
  see. At a 0.002-unit movement tolerance the last step is sub-pixel at every
  canvas width, n = 4 still lands on 1.830 from all 200 starts, and the median
  run is **15 steps rather than 30**.
- **Raw stress, Σ(d − δ)², because that is what `mds.stress_` returns** and the
  only number `03-5` prints. It is scale-dependent, which is why the distances
  are drawn at a fixed radius rather than normalised.
- **No axes and no axis labels on the 2-D panel.** An MDS arrangement is fixed
  only up to a turn and a mirror, so an x and a y would name two quantities that
  do not exist. The line where the labels would have been says so.
- **ONE SCALE FOR BOTH PANELS**, covering the whole trajectory including the
  starting layout — so a distance that came out short cannot look long because
  its panel was drawn bigger, and nothing crosses a panel edge mid-run (2.5).
- **The gate is `display: true`.** As a data gate it would be the one gate core
  animates, which is convenient — but shutting it would throw away a fit the
  reader had stepped through, behind a button labelled *Back to the
  coordinates*. It asks for frames with `anim.easing` instead.
- **`Rearrange`, not `Iterate` or `Step`** — both are taken by widgets 10 and 8,
  and the label names this widget's noun (3.4c).

### Three defects the checks caught, and one was invisible in the source

- **A `choice` renders the SELECTED OPTION's `detail` and ignores the field's
  own.** `points` carried one line for the whole slider and it was copy nobody
  could read — found in the browser, not in the source, where it looks correct.
  Per option it is also the better line: 3, 6, 10 and 15 distances, all the same
  length or two or three different ones. Both are facts about the **input**, so
  neither gives away what the fit will do.
- **A square table cell takes its size from the height it does not need.** The
  box is wider than it is tall and the text in it runs across; at a 550px canvas
  a square cell put six samples on a **7px font**. Width sets the type size now
  and height only has to hold two lines of it: 10px there, 13px at the width a
  reader actually has.
- **The largest-gap tile read "B–A is 3.94"** of a pair every other part of the
  widget calls A–B, because `pairs` runs down the table's rows and holds the
  later letter first.

### Still owed

- **Kenneth has not seen it.** Nothing below the mock-up line has been reviewed.
- **No fingerprint states** — the shape is unreviewed, and a baseline recorded
  before the design is settled is thrown away.
- **No catalogue promotion, no manifest `shipped`.** It is a draft and off the
  gallery.
- **Judge it projected**, which no widget from 11 onward has had.
- **NMDS: same widget or its own?** Raised by Kenneth on seeing the 2x2 and
  left open. In sklearn it is one flag on the class this widget already
  implements — `MDS(metric=False)` fits the RANK ORDER of the distances rather
  than the distances — which argues for a toggle here. Against: it is a
  different objective, so "the arrangement whose distances come closest" stops
  being true and the second number in every cell stops being comparable to the
  first. The table is this widget's whole argument, and NMDS is exactly the case
  where the table's numbers are not what is being matched. **Check `03-5` cells
  20-30 for which one the notebook actually runs before deciding** — the
  PHM5005 notebooks were not on disk when this was written.
- **A pair-highlight was designed and dropped**: clicking a table cell drawing
  that one pair as a line in both pictures. It is the obvious next thing the
  matrix wants, and it was cut because `regions` requires the parameter to keep
  a visible control (3.6) and a dropdown of fifteen pairs in the rail is clutter
  that carries no idea at rest.

### THE RAIL GAINED SECTIONS — Kenneth, 2026-08-27

Round two of the rail-section sweep, the milder half of the double-naming call
(candidates in [`_lab/dimred-rail.html`](../widgets/_lab/dimred-rail.html)):
**The data** (groups+samples on one row, seed, True groups) / **MDS** (the
gate, and the Fit toggle once it opens — the toggle the unsectioned rail left
floating). The gate names an act ("Measure every pair"), not the method, so
here the heading adds a word the rail did not carry. +32px measured. Rail-only
— both hashes untouched, no rebaseline.

---

## NEXT · t-SNE — PLANNED AND MEASURED, not yet built

**The planning session ran on 2026-08-26 and it settled all three questions.**
Everything below that carries a number was measured in this repo, in node,
against an exact t-SNE written for the purpose — not recalled. The prototype and
its checks are described under *The prototype, and what it proves* below; it is
about 90 lines and is what the widget would ship.

**READ THE NOTEBOOK SECTION FIRST.** It is on this disk after all —
`../jupyterbook/phm5003/notebook/05 - Introduction to High Throughput Data/04 -
Dimensionality Reduction.ipynb`, 54 cells — and it answered the structural
question before any code was written. The previous handover said to ask Kenneth
for it; that is no longer needed for PHM5003. **PHM5005's `03-5` is still not on
this disk.**

### Question 0, which the notebook settled: ONE WIDGET, not two

`04 - Dimensionality Reduction` gives t-SNE **its own top-level heading**:

```
## 1. Principal Component Analysis (PCA)               cells 7–14
## 2. Non-negative Matrix Factorization (NMF)           cells 15–23
## 3. Multidimensional Scaling (MDS): Classical and     cells 24–38   <- widget 20
     Non-metric
## 4. t-Distributed Stochastic Neighbor Embedding       cells 39–45   <- this one
## 5. Uniform Manifold Approximation and Projection     cells 46–53
```

**So widget 20's exception does not extend here.** MDS carries two methods
because `## 3` carries two sub-headings under one topic; t-SNE has `## 4` to
itself and UMAP has `## 5`. One algorithm, one widget — Kenneth's rule, applied
by reading rather than by taste.

### Question 1: COMPUTE AT RUNTIME. The replay is not needed.

**This is the question the previous handover said decides the rest, and the
answer is that its premise was too pessimistic.** Exact t-SNE — the algorithm
`sklearn` runs as `method="exact"` and `Rtsne` runs at `theta=0` — is *small*,
and at widget scale it is *fast*:

| n | 1000 iterations | 400 iterations |
|---|---|---|
| 24 | 23 ms | 13 ms |
| 36 | 35 ms | 20 ms |
| **48** | **55 ms** | 29 ms |
| 60 | 92 ms | 39 ms |
| 80 | 138 ms | 65 ms |

`compute()` runs on parameter change only, never per frame (invariant 2), so
55 ms is a slider that feels immediate. **`perplexity` can therefore be a live
control**, which is what the whole widget hangs on — and the replayed table,
which could not have honoured it, is not needed.

Three checks say the implementation is right rather than merely fast:

- **the analytic gradient matches a central difference of the KL to 2.4e-10.**
  It matched to only 1.9e-2 first, and the cause was a real bug: the row
  normalisation of `P(·|i)` recomputed its sum inside the divide loop, so `P`
  never summed to 1 — and the standard gradient `4Σ(p−q)w(yᵢ−yⱼ)` is derived
  assuming it does. **A wrong `P` is consistent between analytic and numerical,
  so only the gradient check could see this.** No picture would have.
- **the perplexity bisection hits its target**, to within 1.1e-4 in `2^H` across
  perplexity 2–11, in about 15 bisections a point.
- **KL falls**, 2.14 to 0.22 over 1000 steps at n = 48.

### Question 2: the one sentence, and it is the lesson's own weakness column

> **t-SNE keeps who is near whom, and throws away everything else. The clusters
> are real; their sizes, their gaps and where they sit are not.**

The notebook's overview table (cell 1) names t-SNE's weakness as *"Does not
preserve global structure"* and its strength as *"Excellent at revealing local
structures and clusters"*. The sentence above is those two lines made into one
claim a figure can be built to demonstrate. Every half of the "not" is measured
below.

**The catalogue's earlier candidate — *what a neighbourhood is, and that
`perplexity` decides how big one is* — survives as the MECHANISM but not as the
sentence.** Perplexity is how the widget shows the claim; the claim is what a
reader is allowed to conclude from the picture.

### Question 3: which failure — FIVE fire, and they need pruning to two

All measured on generated stages, which is where the reconnaissance said they
would have to come from.

| # | the failure | measured |
|---|---|---|
| 1 | **it manufactures clusters from a cloud that has none** | a round 3-D Gaussian, no groups at all. Best 2-way split a reader could see: **t-SNE 0.634 ± 0.104 against PCA's 0.447 ± 0.057**, higher on **38 of 40 seeds** at n = 12, perplexity 2. Holds at every size tried (n = 12, 24, 40, 60) and **is strongest at low perplexity**, decaying toward PCA's value as perplexity rises |
| 2 | **cluster size means nothing** | a group genuinely **11.2× wider** than its neighbour is drawn **1.6× wider**. At 5.6× true it draws 1.4×; at 2.2× true it draws 1.2× |
| 3 | **the gaps between clusters mean nothing** | true centre-to-centre gaps of 5.2 / 7.1 / 1.9 draw as 1568 / 1440 / 713 — and the *ratio* moves too, 3.7 : 1 true against 2.2 : 1 drawn |
| 4 | **the seed gives a different answer, not just a different picture** | n = 48, perplexity 5, one stage, 40 seeds: **5 of 40 come out broken** (silhouette < 0.4, as low as 0.08). The other 35 average 0.648 and agree with each other. A student who runs it once has no way to know which they got |
| 5 | **perplexity too small shatters the true groups** | n = 48: perplexity 2 → silhouette **0.09**; perplexity 5 → **0.66**; perplexity 12 → 0.58. A sevenfold swing across the legal range, with the optimum in the middle |

**#1 and #5 are the pair to build**, and they are one control: both live on
`perplexity`, both are what the lesson's own link is about — cell 41 sends
students to <https://distill.pub/2016/misread-tsne/> in as many words — and #1
is the demonstration the four-method reconnaissance reported as unavailable.
**It was unavailable on the real 194-sample data; at the widget's generated
scale it fires on 38 of 40 seeds.** That is not a contradiction of the earlier
measurement, it is its boundary, and both readings should stay in this file.

#4 is nearly free — `seed` exists in every widget in the arc — and it feeds an
arc-wide comparison, **though not as one number: the reconnaissance measured
seed-to-seed 10-NN agreement on the real 194 samples (PCA 1.00, MDS 0.35, t-SNE
0.72), and the 5-of-40 figure above is a different metric on a generated stage.**
Both are true and they are not interchangeable; a widget that wants the
comparison has to measure the same thing on the same data before quoting it.
#2 and #3 each need a stage of their own and should wait.

### THE STAGE MUST BE BIGGER THAN MDS'S, and Rtsne's own rule is why

`Rtsne` refuses to run unless **3 × perplexity < n − 1**. That is not a
convention, it is a hard error in the library, and it decides the sample count.
Silhouette of the true groups, four overlapping groups, mean of 12 seeds:

| n | legal perplexity | what the control can show |
|---|---|---|
| 12 | ≤ 3 | **nothing** — 0.62 at p2 against 0.56 at p3 |
| 24 | ≤ 7 | 0.48 → 0.58 → 0.58 |
| 36 | ≤ 11 | 0.32 → 0.49 → 0.60 → 0.57 |
| **48** | **≤ 15** | **0.09 → 0.34 → 0.66 → 0.65 → 0.58** |

**So the stage is about 48 samples, four groups of twelve** — four times MDS's,
and it follows from the library rather than from taste. Two consequences, to be
planned for rather than discovered:

- **there is no distance table.** MDS's 12 × 12 grid was already at its
  legibility limit at n = 12 (the round-three measurements above). t-SNE does
  not want one anyway: its input panel is a *neighbourhood*, one point at a time.
- **the lesson's own run is n = 8**, and `perplexity_value <- min(2, ncol/3)` in
  cell 42 is a **workaround for a sample count too small to choose in**, not a
  tuning decision. The widget can show why that line has to be there, which is a
  better use of the notebook than reproducing its 8 points.

### What the widget looks like, and most of it is determined

**The 2×2 is inherited and its assignment is forced**, by exactly the argument
recorded under widget 20's round three: the input panel sits directly above the
arrangement it feeds, and the 3-D cloud sits **diagonal** from the arrangement
because the arrangement is not a projection of it. t-SNE is "Non-linear" in the
notebook's own table, so that argument is stronger here than it was for MDS.

```
    the samples (3-D, draggable)      one point's neighbourhood
    the KL falling                    the t-SNE arrangement
```

The **neighbourhood panel** is this widget's answer to MDS's distance table, and
it is where the three formulas of cell 40 live: a selected sample, the Gaussian
`σᵢ` that perplexity sets drawn as a ring around it, and `p_{j|i}` as the weight
of the edges to everything else. Moving `perplexity` moves the ring, which puts
the mechanism in one gesture.

Lift from `widgets/mds/main.js` rather than rewriting: the 3-vector helpers, the
orthographic `camera`, the wireframe `globe`, the depth-sorted and depth-sized
scatter, the `drag` block, `--c-cluster-a…f`, and the `layout` function read by
both `height` and `draw`.

### Three things that will bite, all measured

1. **A STEP CANNOT BE ONE ITERATION.** The picture needs the full 1000 and is
   *worse than useless* partway: at n = 48, silhouette **0.21 at 250 steps,
   0.02 at 300, 0.23 at 400, 0.50 at 600, 0.66 at 1000**. A Step button
   advancing one gradient step would need a thousand presses to reach an honest
   figure, and every early press would show a picture the method does not
   endorse. **A step should be about 25 iterations**, giving 40 of them.
2. **THE KL CURVE DOES NOT FALL CLEANLY, and this is widget 20's stress-1
   problem again.** At n = 48 it rises on **139 of 1000 steps**, and it **jumps
   +0.54 at step 250** when early exaggeration is released. Charting instead the
   quantity each step is actually minimising is worse, not better: during
   exaggeration that number is ~45 against ~2 after, and **one axis cannot hold
   both** — the exact reason raw stress became stress-1 in widget 20.
   **Recommendation: chart KL against the plain `P` for the whole run, and mark
   the release**, because the wobble is the mechanism rather than a defect — for
   250 steps t-SNE is deliberately not minimising the thing it reports.
   *This is a call for Kenneth, and it is the one open design question.*
3. **EARLY EXAGGERATION IS SIZE-DEPENDENT, so do not carry the n = 12 finding
   forward.** At n ≤ 12 it does nothing measurable (silhouette 0.972 with it,
   0.980 without). At n = 48 it is real: **0.574 with against 0.484 without,
   helping on 13 of 20 seeds**. The stage the perplexity lesson needs is exactly
   the size at which the library's default earns its place, so **keep it** — and
   it is what makes the picture visibly fly apart and settle, which is real
   motion the library genuinely performs (widget 20's test, not widget 19's).

### Two things checked so nobody re-checks them

- **The random start is fine here, and widget 20's degeneracy does not
  reproduce.** Non-metric MDS collapsed 18 of 40 seeds from a random start. For
  t-SNE at n = 48 over 20 seeds, a random start scored **0.577** against a PCA
  start's **0.498** — no evidence the PCA start helps. `Rtsne`, which is what
  PHM5003 runs, starts from `rnorm × 1e-4` anyway. *(`sklearn` changed its
  default to `init="pca"` in 1.2; PHM5005's notebook is not on this disk, and
  its `max_iter` argument dates it to sklearn ≥ 1.5, so it will be getting the
  PCA start. Worth one look when that notebook is available — it is exactly the
  kind of library-versus-memory claim this project has been wrong about before.)*
- **The picture's size converges rather than running away.** Radius 179 at 250
  steps, 509 at 500, and 505–508 from there out to 4000 with KL flat at 0.046.
  So the widget does **not** need widget 20's hold-the-size-fixed correction.
  The absolute scale is still arbitrary and enormous — a true gap of 5.2 draws
  as 1568 units — so the panel must normalise, and no distance may be read off
  it.

### The hosts, and there are two

| course | notebook | what it runs |
|---|---|---|
| PHM5003 | `05 / 04 — Dimensionality Reduction`, **cells 39–45**, heading `## 4` | `Rtsne` — `perplexity` and nothing else, set to `min(2, ncol/3)` on 8 samples. **On this disk.** Links distill.pub's *How to Use t-SNE Effectively* |
| PHM5005 | `03-5 - ML - Unsupervised Learning`, cells 31–40 | `sklearn.manifold.TSNE` — `perplexity` 5–50, `learning_rate`, `max_iter`, `random_state`. **ON this disk** — read 2026-08-26 while planning widget 22; the note that it was not is stale |

**BOTH HOSTS ARE CONFIRMED BY KENNETH** (2026-08-26: *"t-sne is also taught in
PHM5005 03-5"*). So this is the **second widget with a host in each course**,
after widget 20 — and it hits the same limitation: the manifest records one
`course` and nothing reads that field. prd §7 carries the note; it does not need
a second one.

**The two libraries do not agree on defaults** — the start, the learning rate,
and `max_iter` versus `n_iter` — so a widget claiming "this is what the library
does" has to say *which*. `Rtsne` is the simpler and the stricter of the two,
and it is what PHM5003 runs; `sklearn`'s side is now verified directly (above),
`Rtsne`'s is not, because R is not installed here.

**A practical note on the two, since a lesson can be read either way.** `Rtsne`
exposes `perplexity` and little else in the notebook's usage, and refuses to run
at `3 × perplexity ≥ n − 1`. `sklearn` exposes `learning_rate` and `max_iter`
too, and does not refuse — it warns. **The widget should follow `Rtsne` and
refuse**, because a control that silently produces nonsense past a threshold is
the failure this project exists to avoid, and because a reader who meets the
limit learns why `min(2, ncol/3)` is in cell 42.

### THE LAYOUT IS KENNETH'S DIAGRAM, and it overrides one inherited rule

**He supplied it on 2026-08-26, and widget 19's history says to treat it as
binding** — *"go with A, it matches my diagrams"*, and then, when a later shape
drifted, *"what the heck are you doing? this is not what we did in the mockup."*

His diagram is already a 2×2, and it is not the one proposed above:

```
    3D space  ——red arrow——>  2D space (TSNE1 / TSNE2)
    the same three coloured points in both, each wearing concentric
    halos: TIGHT in 3-D, WIDE AND OVERLAPPING in 2-D

    Probability distribution   ——>   Probability distribution
    (Gaussian)                       (Student's t)
    probability against distance     the same, with the Gaussian
                                     under it as a dashed line
```

So the quadrants are **the two spaces on top, the two distributions
underneath** — which means:

- **there is no separate "one point's neighbourhood" panel.** The halo IS the
  neighbourhood, it is drawn on every point rather than one, and it lives in
  the space panels. `perplexity` sets the 3-D halo, and that is the mechanism.
- **THE CLOUD SITS BESIDE THE ARRANGEMENT, NOT DIAGONAL FROM IT.** Widget 20's
  round three forbade exactly this: a cloud sharing an edge with a 2-D result
  invites reading the second as a projection of the first. Kenneth's diagram
  puts them side by side with an arrow between them, and the arrow is doing the
  work the diagonal was doing. **This is a real conflict between an agreed rule
  and an agreed diagram, and it is his call, not one to settle quietly.**
- the bottom row is the pair of curves, and **drawing them on ONE axis fixes a
  flaw in the notebook's own figures** — see below.

### The notebook's three figures, and one of them will confuse a reader

Cell 40 embeds `tsne-high.png`, `tsne-low.png` and `tsne-kl.png`. Extracted and
read this session:

| figure | what it draws | note |
|---|---|---|
| `tsne-high.png` | a Gaussian pdf, peak **0.4** | fine |
| `tsne-low.png` | `1/(1+x²)`, peak **1.0**, 0.1 at x = ±3 | exactly t-SNE's kernel, but **unnormalised**, so it is drawn on a different y-scale from the Gaussian |
| `tsne-kl.png` | `r·ln r` against `r = p/q`, with a red line labelled *"Ideal Ratio (p/q = 1)"* | **the marked ideal is not the curve's minimum** |

**Two things a careful student will trip on, and the widget can fix both.**

1. **The two distribution figures are on different y-scales** (0.4 against 1.0),
   so the t-distribution reads as *taller as well as heavier-tailed*. Only the
   tail is the point. Kenneth's own composite already fixes this by overlaying
   them — one axis, the Gaussian dashed underneath — which is what the widget
   should draw.
2. **`tsne-kl.png` marks `p/q = 1` as ideal, but the plotted curve bottoms out
   at `p/q = 1/e ≈ 0.37` with value `−1/e ≈ −0.37`.** The curve is right and
   the label is right; what is missing is that a *single term* of the KL sum is
   not what gets minimised. `Σ p log(p/q) ≥ 0` with equality only at `p = q`
   (Gibbs), and the constraint `Σp = Σq = 1` is what stops the individual terms
   diving to −1/e. As drawn, the figure invites "why aim at 1 when 0.37 is
   lower?" and has no answer on the page.

   **This is an opportunity rather than a complaint**: a widget that shows the
   real KL falling over real steps, on real data, needs no ratio plot — and it
   is a better answer to the same question. *Flagging it for Kenneth; the
   notebook is his and this may well be deliberate simplification.*

**It also settles the open chart question by other means.** The diagram commits
to showing KL, so the widget has a KL panel; and since that panel plots KL
against steps rather than against `p/q`, the recommendation above stands — one
quantity, the plain `P`, the whole run, with the exaggeration release marked.

### THE REFERENCE CHECK IS DONE, and the engine agrees with scikit-learn

**Python was installed on 2026-08-26 at Kenneth's go-ahead, so the debt this
section used to record is paid.** `tsne-sklearn-ref.py` writes
`tsne-sklearn-ref.json` and `tsne-verify.mjs` compares the JS engine against it.
All comparisons pass against **scikit-learn 1.9.0 / numpy 2.5.2**.

| what | result |
|---|---|
| **P**, the high-dimensional affinities | worst `|P_js − P_sk|` between **1.6e-10 and 5.6e-9** across five cases; both sum to 1.000000000 |
| **KL** at an embedding both are handed | agrees to **2–4e-9** |
| **the gradient** at that embedding | **cosine 1.000000000000, scale 1.0000×** — not merely parallel, identical |
| **the embedding** | compared on 3-NN retention and group separation, not coordinates. Our five seeds land inside sklearn's five on every case |

**The residual is sklearn's, not ours, and that was measured rather than
assumed.** Sweeping our bisection tolerance against sklearn's fixed P: 1e-3 gives
3.8e-5, 1e-4 gives 2.1e-6, **1e-5 gives 5.6e-9 — and 1e-6 and tighter give
2.0e-7 and stop improving.** Agreement is best exactly at sklearn's own
tolerance and then *worsens* as we converge past it, which is the signature of
the library's truncation rather than a difference in algorithm.

**One finding strengthens the seed lesson.** sklearn's spread across five seeds
is *wider* than ours at perplexity 2 — silhouette **−0.240 to 0.415** against our
0.015 to 0.325, final KL up to 3.649 against our 1.697. The instability the
widget is built to show is, if anything, understated by our engine.

### The prototype, and what it proves

Written this session in node, about 90 lines: squared distances, the per-point
bisection on `βᵢ = 1/2σᵢ²` to hit `log(perplexity)` in nats, the symmetrised
joint `P`, Student-t `Q`, the gradient, and the descent both libraries run —
momentum 0.5 → 0.8 at step 250, early exaggeration ×12 released at 250,
per-coordinate gains with `min_gain` 0.01. **It is the widget's `compute()`
already**, and it is what every number in this section came out of.

**Agreement with `sklearn` is now proven too** — see *THE REFERENCE CHECK IS
DONE* above. The internal checks catch implementation bugs; the reference check
catches a wrong reading of the algorithm, and both are green.

**`Rtsne` is still unchecked**, and it is the library PHM5003 actually runs. R
is not installed here. The gap is narrow — sklearn's `method="exact"` and
`Rtsne` at `theta=0` are the same algorithm — but their defaults differ (the
start above all), so a claim about *what the lesson's own code does* should say
`Rtsne` and be checked against it, not inferred from sklearn.

### THE RAIL GAINED SECTIONS — Kenneth, 2026-08-27

Kenneth's sweep found the make-data-then-fit widgets inconsistent: kmeans and
dbscan head their rails *The data* / method, t-SNE and UMAP did not. Three
candidates per widget were drawn at the real 300px track in
[`_lab/dimred-rail.html`](../widgets/_lab/dimred-rail.html) and he picked C for
both: sections **plus** the kmeans pairs, which pay for the headings' height.

The rail now reads **The data** (groups+samples on one row, seed, True groups)
/ **t-SNE** (perplexity). Perplexity had sat beside `samples`, which sets its
legal range; the heading won because the clamp already has a voice in the
readout and the rail's two kinds of thing had none (3.4g). Cost measured in the
mock-up: +32px against the unsectioned rail. Rail-only — both hashes untouched,
no rebaseline.

---

## Widget 22 · `umap` — SHIPPED, planned and measured first

**The planning session ran on 2026-08-26 and it settled all three questions.**
Everything below that carries a number was measured — in this repo in node
against `_lab/umap-engine.js`, or in the `_scratch` venv against `umap-learn`
0.5.12 — not recalled. Where both were measured the source is named, because
the two use different generators for the stage and agree in shape rather than
to the digit.

**The prototype is `widgets/_lab/umap-engine.js`**, about 250 lines, and it is
what the widget's `compute()` should be. `umap-verify.mjs` checks it against
the library through `umap-ref.json`; `umap-measure.mjs` produces the numbers
quoted here.

### THE DRAFT IS BUILT — 2026-08-26, and what building it found

`widgets/umap/main.js` plus **`widgets/umap/model.js`**, and the second one is
the point: the solver is a separate module so `_lab/umap-verify.mjs` imports it
in node and checks THE SHIPPING CODE against `umap-learn`. Widget 21 has its
algorithm twice — `_lab/tsne-engine.js` is what the verification checks and
`widgets/t-sne/main.js` is what students run, with nothing keeping them in step.
`widgets/balancing-data/model.js` is the pattern that avoids that, and this
follows it.

**SHIPPED on 2026-08-26, and baselined last** — it spent the session as a draft
on `/lab/` through four rounds of Kenneth's review, and the states were recorded
only once he promoted it. `bootstrap` was baselined three times over for taking
that order the other way round.

**Five fingerprint states, and the suite is GREEN at 139 of 139:**

| kind | state | what it covers |
|---|---|---|
| settled | `?theme=light` | the gate shut — the one-panel layout nothing else reaches |
| settled | `…&graph=1&flatten=1&step=15` | the finished figure |
| driven | `click: step`, 12 frames | mid-optimisation, which no settled state can see |
| **hit-driven** | `hit: [140, 188]`, 2 frames | the region map — that point resolves to `pick=44`, a sample in the cloud |
| driven | `click: gate-flatten`, 8 frames | **the flattening tween mid-rotation** |

**The hit coordinate was measured, not guessed** — widget 21's was guessed and hit
nothing, which is recorded above. A pointer sweep over the whole canvas at the
harness's 900px frame found 959 live targets; `[140, 188]` was checked to set
`pick=44` before it went in. The canvas is 547 × 488 there.

**Each driven state was checked against its settled sibling**, which is the other
thing widget 21's session learned: `mds` and `balancing-data` hashed IDENTICALLY
settled and driven, which passes `check` and covers nothing. All five differ on
`px`. Two share a `tx` — the hit state and the tween both sit at step 0 with the
same parameters, so the words are the same while the pictures are not.

**The staging is Kenneth's workflow — set up, inspect, then run** — expressed as
cell 41's own two numbered steps:

| gate | what appears |
|---|---|
| *(shut)* | one large panel: the cloud on its globe, draggable, `labels` off |
| **Join the neighbours** | halos and weighted edges, in place, same panel |
| **Flatten it** | the full 2×2 — both spaces, both cross-entropy panels |

**BOTH GATES ARE `display: true`**, which widget 19's trap forces: `GATE_PARAM`
is the FIRST gate in the spec and only that one, so a second data gate opens
without animating.

**AND CORE ONLY HIDES THE DRIVE ROW FOR THE FIRST GATE**, which left Settle and
Play live and useless while `graph` was open and `flatten` was shut — the
`maximum-likelihood` shape core's own comment warns about. `anim.inert` is the
answer core points to, set in **both** `init` and `rebuild` because `flatten` is
a display parameter and opening it never re-runs `init`.

#### THE FLATTENING IS REAL — the start is the PCA plane, not noise

**Kenneth asked whether the initial configuration was random or a genuine
flattening. It was random, and that turned out to be the LIBRARY'S NON-DEFAULT:**
`umap-learn`'s default `init` is `"spectral"`. Measured over eight seeds, the
difference is entirely at the start —

| start | 5-NN retention AT THE START | at the end | tightness | cost |
|---|---|---|---|---|
| random | **0.087** | 0.819 | 0.116 | 0.0 ms |
| **PCA plane** | **0.653** | 0.814 | 0.103 | 0.1 ms |
| spectral (the library's default) | 0.538 | 0.818 | 0.106 | 4.3 ms |

— all three finish in the same place, so the choice costs nothing in the answer
and decides only what the reader watches happen. **The PCA plane was chosen**
(*Kenneth, 2026-08-26: "switch to PCA init and animate the flattening"*):

1. **it IS a flattening**, so cell 41's globe-onto-a-map analogy stops being a
   metaphor and the widget can animate the real transformation
2. **it is widget 19's own plane** — start from the flat map PCA gives you, then
   let the neighbour graph pull it into shape
3. **`sklearn`'s t-SNE defaults to `init="pca"`** for the same reason
4. it hands the widget a number nothing else in the arc states: **60% of
   neighbourhoods survive the flattening alone, 83% after UMAP. That difference
   IS what UMAP adds**, and it is a readout tile.

**IT MUST NOT BE THE CAMERA'S VIEW.** `turn` and `tilt` are display parameters,
so an init that followed them would let turning the cloud change the answer.

**The entry animation lands EXACTLY on frame 0**, checked rather than eyeballed:
`_lab/umap-landing.mjs` compares the tween's final basis projection against the
descent's first frame across four cases including the extremes, and the worst
disagreement is **2.2e-16**. A mismatch there would jump the cloud at the end of
the rotation, and no pixel hash of a settled state could see it.

#### TWO THINGS THE NEW START CHANGED, and both were measured after

**1. THE RUN IS HALF AS LONG — 300 iterations, not 500.** From the PCA plane,
ten seeds:

| step | iterations | retention | tightness | CE | moves, as % of the picture |
|---|---|---|---|---|---|
| 0 | 0 | 0.663 | 0.282 | 302.6 | — |
| 1 | 10 | **0.795** | 0.177 | 217.4 | 25.6% |
| 2 | 20 | 0.802 | 0.155 | 208.5 | 9.1% |
| 10 | 100 | 0.812 | 0.121 | 197.7 | 1.3% |
| 30 | 300 | **0.813** | 0.105 | 194.0 | 0.25% |
| 50 | 500 | 0.813 | 0.103 | 193.7 | 0.01% |

Retention is finished by step 2; the tail buys tightness at a collapsing rate.
Cutting 500 to 300 leaves retention **identical** and tightness 0.110 against
0.103. **That removes twenty presses which each moved the picture by under a
third of one per cent** — and Kenneth already reported that exact defect on
widget 17, whose twenty boosting rounds change nothing visible after six.

**2. THE CROSS-ENTROPY HAS A FLOOR AND THE CHART NOW DRAWS IT.** Writing
`CE = Σ H(μ) + KL(μ‖w)` splits it into the entropy of the graph, which no
arrangement can remove, and the fit error, which is the only part the descent
touches. On this stage **the floor is 139.8 against a final 170.9 — 82 per cent
of what the widget reports is irreducible.** A better start shrank the curve's
range, which is what exposed it: anchored at 0 with nothing marked, the chart
said the curve was failing to reach a target it could in principle hit. It is
now a dashed reference line labelled *as low as it can go*, and the descent
visibly lands on it.

#### THE SENTENCE FIRES IN THE BUILT WIDGET, read off its own readout

Seed 1, four groups of twelve, at the settled end (`?…&step=50`):

| `packing` | Neighbours kept | How tight it looks |
|---|---|---|
| 0 | 81% | 0.108 |
| 0.1 | 83% | 0.110 |
| 0.5 | 86% | 0.153 |
| 0.95 | **83%** | **0.205** |

| `neighbours` | Neighbours kept | How tight it looks |
|---|---|---|
| 2 | **41%** | 1.239 |
| 5 | 68% | 0.592 |
| 15 | **83%** | 0.110 |
| 40 | 83% | 0.135 |

**Five points of retention against forty-two.** The two tiles sit side by side
and say it without a caption, which is what they are for.

#### THE METRIC IS PLAIN EUCLIDEAN — asked, and checked rather than asserted

*(Kenneth, 2026-08-26: "is the distance used euclidean or something else?")*
`knn` agrees with the Euclidean norm to **8.9e-16** over every neighbour pair,
which is exact. That matches both hosts: `umap-learn` defaults to
`metric="euclidean"` and PHM5005 cell 42 passes it explicitly.

**UMAP's manifold story does not come from a different distance.** It comes from
`ρᵢ` and `σᵢ`: subtracting the nearest-neighbour distance and dividing by a
per-point bandwidth rescales each neighbourhood so the local metric is unit,
which is what cell 46 means by "the Riemannian metric is locally constant". On
this stage `σ` varies by **×5.2** across the samples. **No geodesic is ever
computed** — the rescaling is the approximation.

#### THE GLOBE IS A REFERENCE SPHERE, NOT A MANIFOLD, and that needs deciding

**The samples do not lie on the sphere the widget draws.** `stage()` puts the
four cluster CENTRES on a sphere of radius 2 and then scatters samples around
them in all three dimensions, so the cloud fills the ball rather than the shell.
Measured, seed 1:

| radius from the origin | min | p25 | median | p75 | max |
|---|---|---|---|---|---|
| | 1.14 | 1.98 | 2.29 | 2.62 | 3.33 |

mean 2.29 ± 0.47, and **only 9 of 48 samples are within 0.1 of radius 2**. The
great-circle distance on that sphere differs from the Euclidean chord by up to
**1.83** on neighbour pairs, so the two are not interchangeable.

**So the wireframe globe invites a reading the data does not support** — Kenneth
asked the question as "drawing the links in 3D manifold space", which is the
misconception the drawing creates. Widget 21 draws the same globe and inherits
the same problem, though it never claims a manifold. Two ways out and it is a
teaching call:

- **drop the globe**, and stop implying a surface the samples are not on
- **put the samples ON the sphere**, which makes the manifold real and cell 41's
  globe-onto-a-map analogy literal

**CORRECTION: THE FOUR WIDGETS DO NOT SHARE A STAGE, and an earlier note here
saying so was wrong.** Each `stage()` is a private copy in its own `main.js`,
and the constants already differ: `pca` uses SIGMA 0.42 and has no R or JITTER,
`mds` uses SIGMA 0.22, and only `t-sne` and `umap` match at 0.62. **No widget
imports or quotes another's numbers.** So changing widget 22's stage changes
nothing in 19, 20 or 21 — they keep their own code and their own fingerprint
baselines. The only thing lost is that 21 and 22 would stop generating the same
cloud from the same seed, and nothing in the repo compares them numerically.

#### AND THE SPHERE WOULD TEACH NOTHING EXTRA — measured, then proved

`_lab/umap-sphere.html` runs four stages live through the shipping `model.js`:
what ships, clusters as caps ON the sphere, one band around it, and a tightly
wound Swiss roll. 5-NN, n = 48, seed 1:

| stage | chord vs true neighbourhoods agree | layout keeps CHORD | layout keeps TRUE |
|---|---|---|---|
| A · in the ball (ships) | — *no surface* | 84% | — |
| B · caps on the sphere | **100%** | 89% | 89% |
| C · band on the sphere | **100%** | 95% | 95% |
| D · Swiss roll | **49%** | 69% | **40%** |

**B and C read 100% and that is not a coincidence, it is a theorem.** On a
sphere the chord is `2R·sin(θ/2)` in the great-circle angle θ, which is strictly
increasing over the whole range — so the k nearest by chord are ALWAYS the k
nearest by geodesic, for every k. **A sphere cannot separate the two metrics.**
Putting the samples on it would make the globe honest and the analogy literal,
and would add no geodesic lesson whatever.

**The Swiss roll is the manifold that can, and UMAP FAILS IT at this size.** Wound
so the gap between turns (0.75) is below the spacing between points along the
sheet (1.29), only 49% of chord neighbours are the right ones — and the layout
keeps 69% of the CHORD neighbourhoods it was handed while keeping only **40%** of
the true ones. It faithfully preserves the wrong graph. That is a legitimate
failing case, but it is a different widget: no clusters, and it contradicts the
"UMAP preserves manifold structure" story rather than showing it.

**So the sphere buys the metaphor and nothing else, and the roll buys a lesson
this widget is not telling.** *Kenneth's call; the recommendation is to drop the
globe unless he wants the metaphor, in which case B costs nothing.*

#### THE SAMPLES ARE ON THE SPHERE NOW — stage B, and it is his call

*(Kenneth, 2026-08-26: "can go with B for umap for the metaphor… the problem
with current setup is that the distance cuts through the sphere and it doesn't
bring home the point that umap can find clusters on manifolds.")* Every sample
sits at exactly radius 2, as a cap around each group's direction — poles at two
groups, an equatorial triangle at three, a tetrahedron at four. `CAP_DEG` is 30,
measured: retention is flat at 0.876 from 15 to 35 degrees and only falls at 60.

**HE IS RIGHT ABOUT THE LOCAL METRIC, and it is what makes the chord legitimate.**
A manifold is locally Euclidean, so for a short enough separation the straight
chord and the arc along the surface agree to second order. Measured over all
1128 pairs of this stage:

| arc between the pair | pairs | worst chord/arc | mean |
|---|---|---|---|
| 0 – 0.5 | 177 | **0.9974** | 0.9989 |
| 0.5 – 1 | 79 | 0.9899 | 0.9949 |
| 2 – 3 | 25 | 0.9093 | 0.9181 |
| 4 – 7 | 301 | **0.7457** | 0.8228 |

Near pairs agree to three parts in a thousand; distant ones are out by a quarter.
**The graph only ever joins near pairs**, which is why the substitution holds, and
the widget now says so in a readout tile: *Chord over arc*, **97.3%** mean over
the edges the graph actually built, range 88–100%.

**What the stage change did to the two claims, re-measured over ten seeds:**

| | on the ball (was) | on the sphere (now) |
|---|---|---|
| `min_dist` 0 → 0.99, retention | +0.026, past noise on 2/10 seeds | **+0.023, past noise on 0/10** |
| `min_dist` 0 → 0.99, tightness | ×2.16 | **×2.63** |
| `n_neighbors` 2 → 40, retention | +0.490 | **+0.255, up on 10/10** |

**The sentence is cleaner, not weaker**: `min_dist` now fails to move retention on
*every* seed, while moving the picture further. Retention overall is higher too
(0.862 against 0.813) — a 2-manifold flattens into two dimensions better than a
solid ball does, which is the manifold assumption paying off.

**Two knock-on changes, both measured after:**

- **FIFTEEN STEPS, not thirty.** Mean distance a sample travels per step, against
  the arrangement's radius: at 10 iterations a step, 16 of 30 steps move under
  1%; at 20 a step, 5 of 15 do. The tail is not dead, it is *tightening* —
  retention is flat from 25 iterations while the clusters keep contracting from
  0.242 to 0.068 on the spread measure.
- **eta 0.1 STANDS, and the reason is what the chart can draw.** On the sphere 17
  of 300 iterations rise, which read as 48/500 when sampled every iteration and
  looked like a regression. **They all fall between plotted points: 0 of the
  chart's 15 points rise.** Dropping to 0.05 removes upticks no reader can see
  and costs 2.5% of the objective and a visibly looser picture.

**The stage moved into `widgets/umap/model.js` and is exported**, so
`_lab/umap-measure.mjs` imports the stage the widget generates rather than
keeping a copy — the same reason the solver lives there. Widget 21 keeps its
stage private and its measurement script keeps a copy, with nothing holding the
two together.

**Still open, and it needs eyes:** the globe was decoration when the samples
filled the ball and is load-bearing now that they sit on it. Three great circles
may be too sparse to read as a surface.

#### SIX GROUPS, EVENLY SPACED — because four could be flattened

*(Kenneth, 2026-08-26: "I can clearly see clusters already when flatten and
won't see the benefit of umap optimization.")* He was right, and it is a fact
about geometry rather than about tuning: **four directions in three dimensions
can be projected onto a plane and stay apart; six evenly spaced ones cannot,
because any plane has an axis and whatever lies along it collapses.** Six seeds,
n = 48 throughout:

| groups | per | cap | projection silhouette | after UMAP | gain |
|---|---|---|---|---|---|
| 4 | 12 | 30° | **0.684** | 0.882 | +0.199 |
| **6** | **8** | **30°** | **0.540** | **0.899** | **+0.360** |
| 8 | 6 | 25° | 0.502 | 0.908 | +0.406 |
| 12 | 4 | 20° | 0.549 | 0.901 | +0.352 |

**Eight and twelve gain more and are not used, for a reason with nothing to do
with geometry:** `tokens.css` defines SIX cluster roles, `--c-cluster-a` to
`-f`, and `sampleCol` wraps with `%`. At eight groups two pairs would share a
colour, and a cluster plot that repeats a colour tells the reader something
false. **Six is the octahedron, it is every cluster colour there is, and it
keeps n = 48 at eight per group.**

**What the reader now sees, on the widget's own tiles:**

| | flat map | settled | |
|---|---|---|---|
| four groups | 78% kept, spread 0.095 | 80%, 0.067 | +2 points, ×1.4 |
| **six groups** | **81% kept, spread 0.104** | **90%, 0.036** | **+9 points, ×2.9** |

And the sentence is stronger again: `min_dist` 0 → 0.99 moves retention
**+0.013**, past seed noise on **1 of 10** seeds, while moving the clusters
**×3.62** looser on 10 of 10. `n_neighbors` 2 → 40 moves retention **+0.271** on
10 of 10 — **twenty-one times the effect on the same measure.**

`n_neighbors` also has a real optimum now rather than a ceiling: retention
0.663 / 0.847 / 0.897 / 0.930 / 0.934 at 2 / 3 / 5 / 15 / 40, while the
silhouette turns over — 0.904 at 15 against 0.884 at 40.

#### THE GLOBE IS A WIREFRAME OF PARALLELS AND MERIDIANS

Seven parallels and twelve meridians, front arcs at full weight and back arcs at
0.28, every arc broken where it crosses the horizon rather than drawn whole and
over-painted. **The change follows the stage change**: while the samples filled
the ball the globe was a reference and three coordinate circles placed it; now
every sample sits on it and the wireframe has to read as a SURFACE, because
whether a reader sees a curved surface or a scatter in a box is the whole
difference between a manifold and a cloud.

**And one defect the sweep caught:** `pick` had `max: 47` from when four groups
was the ceiling, so the last 24 samples of the largest stage were unreachable by
URL. `draw` clamps, so nothing broke and nothing said so.

#### THE COPY IS CONVENTIONAL, after a pass on Kenneth's instruction

*(2026-08-26: "remove any extraneous commentary from the widget. use
conventional language, not something you invented.")* The parameter `packing`
was invented and is now `minDist`, labelled **Minimum distance** and naming
`min_dist` in its detail — the same treatment widget 21 gives Perplexity. Also
renamed to the terms the notebooks and the libraries use: *Settle* → **Optimise**
(cell 41's own verb), *What one link pays* → **Cross-entropy, one pair**,
*as low as it can go* → **lower bound**, *How tight it looks* → **Spread over
gap**, *Join the neighbours* → **Build the neighbour graph**, and the legend now
says **membership strength μ** rather than "how strongly two samples are
joined". The two stage captions are bare instructions; the invitations
("How many clusters can you see?") were cut, since the `labels` control already
asks it.

**EVERY LABEL PAIR WAS MEASURED against the narrowest column the layout produces
— 203px at a 520px viewport — and four of the first five overflowed it.**

**A SECOND PASS CUT THE CONTROL DETAILS** *(Kenneth, 2026-08-26: "remove
unnecessary comments in the slides/options if it's apparent what it means")*, and
house style was already on his side: `pca`, `mds` and `t-sne` carry **two**
top-level details each across eight or nine parameters, where this widget had one
on nearly everything. It is down to three — `n_neighbors`, `min_dist`, and the
seed's dual role, which is the one thing not apparent from its label — plus four
per-option details naming the group arrangements, since "at the poles" and "an
octahedron" are not readable off the numbers 2 and 6.

**AND THE CHORD-OVER-ARC TILE IS GONE** *("we use the sphere as an example, so we
only show metrics that make sense for this algorithm")*, which is the right cut:
that ratio is a property of THIS STAGE'S geometry, not of UMAP, and a readout
that only means something on a sphere teaches the example rather than the method.
The measurement stays in this file, because it is why the sphere is a legitimate
stage — but the manifold point is made by the picture, not by a number.

#### TWO DEFECTS THE BUILD FOUND, and only one is this widget's

1. **EVERY SAMPLE HAS A LINK AT μ = 1 AND ITS IDEAL DISTANCE IS ZERO.** A
   sample's nearest neighbour sits at `d ≤ ρ`, on the kernel's flat top, and the
   fuzzy union keeps it at 1 — so `d*(1) = 0` for any `a` and `b`, and it is the
   one link `packing` cannot move. Drawn as the strongest of the kernel panel's
   three curves it rose monotonically from the origin and read as the headline,
   saying the opposite of the panel's point; the weakest curve had its minimum
   off the right of the frame, and the caption printed `μ 1.00, 0.30, 0.00`.
   **The window is now the range whose minimum FITS** — `d*(μ) ≤ 4` bounds μ
   below, `μ < 1` above — and each minimum carries its own μ on the dot rather
   than the three being listed in a caption that did not fit. *A screenshot
   caught this and no assertion would have.*

2. **A PUBLISHED `step` SURVIVES A DATA CHANGE IN THE URL BUT NOT IN THE FIGURE,
   AND WIDGET 21 DOES IT TOO.** Core's `seededOnce` deliberately forces
   `fromScratch` after the first render — non-negotiable 4, exploring must be
   spoiler-free — so a data change resets the animation to empty. But the
   parameter is left in the address bar. Measured on **t-SNE**: `?step=40` first
   render reads KL 0.157, then moving `perplexity` reads KL 1.727 while the URL
   says `?perplexity=8&step=40`. A link shared from that state shows the
   recipient a settled figure the sharer was not looking at. **Inherited, not
   introduced, and the fix is core's** — which owes a full fingerprint run, so it
   is recorded rather than taken here.

#### Checked, and what is still owed

A `fillText` sweep over 16 URLs at the parameter extremes — every combination of
2/4 groups, 3/12 samples, `neighbours` 2 and 40, `packing` 0 and 0.95, three
positions in the run, both label settings, and the camera at both stops —
collected **65 distinct strings and not one `NaN`, `Infinity`, `undefined` or
`null`**. `npm run check` passes at 22 widgets.

**Still owed, and all of it needs eyes rather than a hash:** Kenneth has not seen
it; it has not been judged projected; and the fingerprint states cannot be
recorded until the design stops moving.

### It is its own widget, and the notebook already says so

`## 5. Uniform Manifold Approximation and Projection`, cells 46–53 of
`05 / 04 — Dimensionality Reduction`. Its own top-level heading, exactly as
t-SNE has `## 4` — so by the rule that settled widget 21, **UMAP is widget 22
and not a second half of anything.**

### The hosts

| course | notebook | what it runs |
|---|---|---|
| PHM5003 | `05 / 04`, cells 46–53, heading `## 5` | `umap` (CRAN): `umap(scaledData, n_neighbors = 3, min_dist = 0.5)` on the same 8-sample `airway` data. **On this disk.** Cell 47 links <https://pair-code.github.io/understanding-umap/> |
| PHM5005 | `03-5 - ML - Unsupervised Learning`, cells 41–50, heading `### UMAP` | `umap-learn`: `UMAP(n_components=2, n_neighbors=15, min_dist=0.1)` on the cancer gene expression data. **ON THIS DISK** — `~/Downloads/PHM5005 AY2025-26 - Notebooks/Master/`, read 2026-08-26. Cell 41 carries the diagram and the globe-to-flat-map analogy |

#### THE TWO HOSTS DISAGREE ABOUT THE SETTINGS, and PHM5005's are the widget's

| | `n_neighbors` | `min_dist` | data |
|---|---|---|---|
| PHM5003, R | **3** | **0.5** | 8 samples of `airway` |
| PHM5005, Python | **15** | **0.1** | the cancer gene expression set |

**PHM5005's pair is exactly what every measurement in this section defaults
to**, which was luck rather than judgement — the sweeps were centred there
before `03-5` was read. It also sits at the good end: `n_neighbors` = 15 is the
silhouette peak on this stage, and 3 is the shattering end. **PHM5003's 3 is
forced by having 8 samples**, the same way t-SNE's `min(2, ncol/3)` is, and it
is worth showing rather than reproducing.

#### `03-5` CELL 45 IS NOT REPRODUCIBLE, and its own syntax block says how to fix it

Cell 42 documents `random_state=42`. **Cell 45, the run that makes the figure,
omits it.** Measured — five runs of cell 45 exactly as written, on the widget's
stage (`_scratch/umap10.py`):

| | silhouette across 5 identical runs | spread |
|---|---|---|
| cell 45 as written | +0.676, +0.736, +0.758, +0.808, +0.823 | **0.147** |
| with `random_state=42` | +0.772 five times | **0.000000** |

The extent of the picture moves too — 16.7 × 10.5 on one run, 6.6 × 18.4 on
another. **A student who reruns the notebook gets a different figure, and the
one-word fix is already written three cells above.** *Flagged for Kenneth.* It
is also the seed lesson arriving in his own notebook, which is a better hook for
the widget's `seed` control than anything generated.

**The lesson names exactly two controls** — `n_neighbors` ("number of
neighboring points") and `min_dist` ("minimum distance between points") — and
says outright that they "can alter the clustering". Note the notebook's prose
calls them `num_neighbor` and `min_dist_value`, which are the R variable names
in cell 48 rather than the argument names; the arguments are `n_neighbors` and
`min_dist`. Cell 47 also says "we can perform t-SNE using the `umap`
function" — a copy-paste from the t-SNE section above it. **Both are one-word
fixes and neither changes anything; flagged for Kenneth, not acted on.**

### Cell 46's maths, and the three places it departs from t-SNE

1. **A fuzzy membership in high dimensions**,
   `μ(xᵢ,xⱼ) = exp(−max(0, d(xᵢ,xⱼ) − ρᵢ) / σᵢ)` — and `ρᵢ` is **the distance
   to the point's nearest neighbour**, subtracted off. t-SNE has no counterpart.
   It is what guarantees every point is connected to something. `σᵢ` is
   bisected so the row sums to `log₂(k)`, which is the same shape as t-SNE's
   perplexity bisection with **`n_neighbors` setting the target**.
2. **A low-dimensional membership `1 / (1 + a·d^{2b})`**, where **`a` and `b`
   are FITTED from `min_dist`** rather than fixed. t-SNE's Student-t has no free
   parameter at all.
3. **Cross-entropy, not KL.** KL is one-sided: t-SNE pays for pulling a true
   neighbour apart and is *credited* for drawing a stranger close. Cross-entropy
   carries both terms, so UMAP pays for putting strangers together too — and
   that is the mechanism behind it spreading clusters further than t-SNE.

### Question 1: COMPUTE AT RUNTIME. The replay is not needed — again.

**This section used to assert that a replay was "likely the only honest
option". That was wrong, for the second time in this arc.** The identical
assertion was made about t-SNE and overturned by measuring it; the same holds
here. Node on this machine, `_lab/umap-measure.mjs`:

| n | iterations | fuzzy set | descent | total |
|---|---|---|---|---|
| 24 | 500 | 0.8 ms | 6 ms | **7 ms** |
| 48 | 200 | 0.4 ms | 10 ms | 11 ms |
| **48** | **500** | **0.4 ms** | **24 ms** | **25 ms** |
| 48 | 800 | 0.4 ms | 39 ms | 39 ms |
| 96 | 500 | 1.2 ms | 96 ms | 97 ms |

`compute()` runs on parameter change only, never per frame (invariant 2), so
25 ms is a slider that feels immediate — **less than half t-SNE's 55 ms**.
**Both `n_neighbors` and `min_dist` can therefore be live controls**, which is
what the whole widget hangs on, and a replayed table could have honoured
neither.

**The fuzzy simplicial set costs nothing (0.4 ms) and the descent is everything
else**, which matters for the widget's structure: `min_dist` changes only `a`
and `b`, so a `min_dist` move does not have to rebuild μ at all.

#### The departure from `umap-learn`, made deliberately and measured

The library optimises by **stochastic edge sampling with five negative samples
a step** — an approximation built for n in the millions. At n = 48 the **exact
full-batch gradient** over all 1128 pairs is affordable, so that is what the
engine runs. On the library's own μ, eight seeds, `min_dist` 0.1 (measured in
Python so both sides see identical μ):

| | 5-NN retention | tightness | silhouette |
|---|---|---|---|
| `umap-learn` SGD | 0.718 | 0.093 | 0.765 |
| exact full-batch | **0.820** | 0.085 | **0.807** |

Same picture, slightly better, and seed for seed they agree about which seeds
come out loose — because this is the objective the library approximates. **It
follows that the widget may say "this is UMAP's objective" and may NOT say
"this is what `umap-learn` prints".** *That wording is a call for Kenneth.*

The gradient is exact and worth writing down, because it is one line:

```
C     = −Σ [ μ·log(w) + (1−μ)·log(1−w) ],   w = 1/(1 + a·s^b),   s = d²
dC/ds = (b/s)·(μ − w)
```

#### Checked against the library, and the residual is the library's

`umap-verify.mjs` against `umap-learn` 0.5.12 / numpy 2.5.2, five cases
(n = 48 at `n_neighbors` 3/5/15/30, and n = 8 at 3 — the lesson's own shape):

| what | result |
|---|---|
| `a` and `b` from `min_dist` | worst **4.7e-6** relative over twelve values, 0.0 to 0.99. Gauss-Newton here against scipy's Levenberg-Marquardt there |
| **`ρ`** | **200 of 200 bit-exact** at float32 |
| **`σ`** | **199 of 200 bit-exact** at float32; the one that is not differs by 3.5e-6 |
| **`μ`** | worst **1.4e-5** absolute, 2.4e-5 relative, at `n_neighbors` = 3 |

**The first run reported ρ off by 5.2e-8 everywhere and the obvious suspect was
wrong.** sklearn's `kneighbors` uses the cancelling `|x|²+|y|²−2x·y` form, so
that looked like the cause — but sklearn's distances agree with a direct sum of
squares **exactly, 0.0e0**. What is actually happening is that `umap-learn`
declares `rho` and `result` as `np.float32` *inside* `smooth_knn_dist`, so it
rounds whatever dtype it is handed. The evidence is a bit pattern rather than a
plausible story: `Math.fround(js) === lib` for **200 of 200** values. The one σ
that misses is the bisection's own stopping tolerance — both values land inside
`umap-learn`'s `SMOOTH_K_TOLERANCE` of 1e-5 on the row sum (js 3.90688992,
lib 3.90690118, target 3.90689060). Two legal stopping points, not two answers.

**`umap-learn` was already installed** (0.5.12, numba 0.67.0) — the previous
note here saying it was not is stale. First call costs ~5.6 s of numba JIT and
~30 ms thereafter. **The R `umap` package is still unchecked**, and it is what
PHM5003 actually runs; R is not installed here. Same gap as `Rtsne`'s.

### Question 2: the one sentence, and it is measured two ways

> **`min_dist` decides how tight the picture LOOKS, not what UMAP KNOWS. The
> clusters get tighter and more convincing and not one bit more real.**

**The evidence is a paired sweep of both controls against the same two
measures** — 5-NN retention for what it knows, and within-cluster radius over
centre-to-centre gap for how it looks. Ten seeds, n = 48, four groups of twelve
(`umap-measure.mjs`; the Python column is `_scratch/umap1.py`–`umap2.py` and
agrees in shape):

| control, swept end to end | 5-NN retention | tightness |
|---|---|---|
| **`min_dist` 0.0 → 0.99** | **+0.026**, past seed noise on **2 of 10** seeds | **×2.16 looser, on 10 of 10 seeds** |
| **`n_neighbors` 2 → 40** | **+0.490**, up on **10 of 10** seeds | ×0.07 |

**A nineteenfold difference in effect on what survives.** One knob moves the
knowledge and the other moves only the presentation, and the widget can put
them side by side and let a reader discover which is which. *Nothing else in
the arc has a control like that*, and it is the natural close of the
four-widget sequence: PCA — *a 2-D plot is not the data*; MDS — *the input is
the table of distances, not the cloud*; t-SNE — *it keeps who is near whom and
throws away everything else*; UMAP — *and how tight it looks is a setting*.

#### THE MECHANISM IS EXACT, and it is the best thing found this session

`dC/ds = (b/s)(μ − w)` is zero exactly when **`w = μ`**. So every pair has an
ideal separation, and it is closed-form:

```
d*(μ) = ( (1/μ − 1) / a ) ^ (1 / 2b)
```

μ comes from the data and `n_neighbors`. `a` and `b` come from `min_dist`
**and nothing else**. So `min_dist` moves every pair's target distance without
touching a single μ — which is the sentence, mechanically, in one formula.
Verified numerically against a 400,000-point argmin at μ = 0.2 / 0.5 / 0.8: the
analytic `d*` and the numerical minimum agree to four decimals.

And what it does is not a uniform stretch — it is a **compression of the range**
(`_scratch/umap9.py`):

| `min_dist` | d\*(μ=0.9) | d\*(μ=0.5) | d\*(μ=0.05) | spread across μ |
|---|---|---|---|---|
| 0.0 | 0.164 | 0.659 | 4.244 | **×25.8** |
| 0.25 | 0.335 | 0.947 | 3.811 | ×11.4 |
| 0.5 | 0.537 | 1.224 | 3.690 | ×6.9 |
| 0.99 | 0.982 | 1.741 | 3.754 | **×3.8** |

At `min_dist` 0 the picture is asked to draw distances spanning a factor of 26,
so near pairs go very tight and far pairs go far — **tight blobs with big gaps**.
At 0.99 the same μ's are asked for distances spanning only 3.8, so everything
lands at a similar remove. Strong pairs move **5.98×** and weak pairs **0.88×**,
and no μ changed. That is exactly the ×2.16 measured on the finished picture.

### Question 3: which failure — the SIZE one, and the gap one is a trap

Both were measured on generated stages, ten seeds each, `umap-learn`
(`_scratch/umap3.py`):

| the failure | true | drawn | verdict |
|---|---|---|---|
| **cluster size means nothing** | 1.9× wider | **1.01× ±0.06** | **BUILD THIS** |
| | 4.6× wider | **1.02× ±0.07** | |
| | 9.3× wider | **1.31× ±0.27** | |
| **the gap between clusters means nothing** | 2:1 | 3.17:1 **±2.60**, range 0.69 .. 9.93 | **do not print a number** |
| | 5:1 | 5.76:1 ±2.75, range 2.05 .. 11.43 | |
| | 10:1 | 6.57:1 ±4.27, range 1.61 .. 14.84 | |

**Cluster size is not merely distorted, it is erased**, and tightly enough to
put a number on screen: a group genuinely five times wider draws the same size
as its neighbour, on every seed. It pairs with the sentence exactly — the
clusters look tight and convincing *because* `min_dist` says so, and their
width carries nothing.

**The gap failure is the trap.** This file previously recorded "a true 5:1 gap
ratio renders as 11.4:1" from the old reconnaissance. That number reproduces —
**as the maximum of a ten-seed range that also contains 2.05.** It is not a
systematic inflation, it is *noise*, and quoting the single run as "the"
distortion would have put a false claim on a widget. A true 2:1 gap draws
anywhere from 0.69:1 to 9.93:1. **Both readings stay in this file**; the
failure is real but its shape is "arbitrary", not "inflated", and demonstrating
arbitrary needs the seed control and several presses rather than one printed
ratio.

### THE LIBRARY DOES NOT REFUSE — and that inverts widget 21's rule

Widget 21's lesson was *refuse where the library refuses*: `Rtsne` errors unless
`3 × perplexity < n − 1`, and that hard error decided the sample count. **UMAP's
equivalent does not exist.** Measured at n = 48:

| `n_neighbors` | what `umap-learn` does |
|---|---|
| 1 | **raises** `ValueError: n_neighbors must be greater than 1` |
| 2 … 47 | runs |
| 48, 60 | **runs anyway, silently clamping to 47** — no warning naming the clamp |

So the floor is a hard error and the ceiling is a silent clamp. **The widget
should still say so**, because a control that quietly stops meaning what it
reads is precisely the failure this project exists to avoid — but it says it as
a readout, not as a refusal. Widget 21's readout already does this when it
clamps perplexity; the same treatment, opposite reason.

**`n_neighbors` has an optimum in the middle, and the lesson's own setting is
near the edge.** From the sweep above: retention 0.332 at k = 2, 0.492 at 3,
0.677 at 5, **0.805 at 15**, 0.829 at 47 — and the tightness and silhouette
columns turn over, silhouette peaking at k = 15 and falling to 0.743 at 47.
**The lesson runs `n_neighbors = 3` on 8 samples**, which at widget scale is the
shattering end of the range. That is the same shape as t-SNE's
`perplexity_value <- min(2, ncol/3)`: a workaround for a sample count too small
to choose in, and worth showing rather than reproducing.

### The stage: 48 samples, four groups of twelve — inherited, and it still fits

Widget 21's stage carries over unchanged (centres on a sphere of radius 2,
σ = 0.62, twelve per group), and the `n_neighbors` sweep above is the evidence
that it still has room: eight legal settings that differ by 0.50 in retention.
`Rtsne`'s `3 × perplexity < n − 1` is what forced 48 for t-SNE; nothing forces
it here, so **keeping it is a choice, and the reason is the arc** — the same
cloud under four methods is what makes widgets 19–22 comparable.

### Three things that will bite, all measured

1. **A STEP CANNOT BE ONE ITERATION**, same as widget 21. At n = 48, ten seeds:

   | iterations | 5-NN retention | silhouette |
   |---|---|---|
   | 1 | 0.116 | **−0.119** |
   | 25 | 0.312 | −0.004 |
   | 100 | 0.641 | 0.343 |
   | 300 | 0.787 | 0.698 |
   | **500** | **0.805** | **0.774** |
   | 800 | 0.811 | 0.790 |

   One iteration is *worse than nothing* — a negative silhouette is a picture
   that puts the groups inside each other. **500 iterations, and a step of about
   12**, giving ~42 of them, which is t-SNE's 40 within rounding. 800 buys
   almost nothing.

2. **THE CROSS-ENTROPY CURVE CAN BE MADE TO FALL CLEANLY, and this is the first
   time in the arc that has been true.** Widget 20's raw stress and widget 21's
   KL both rose often enough to need explaining away — t-SNE's rises on 139 of
   1000 steps and jumps at the exaggeration release. UMAP's is a choice of step
   size (`umap-measure.mjs`, six seeds):

   | `eta` | CE rises on | final CE | retention | tightness |
   |---|---|---|---|---|
   | 1.0 | **206/500** | 186.4 | 0.822 | 0.080 |
   | 0.25 | 147/500 | 187.3 | 0.826 | 0.092 |
   | **0.1** | **8/500** | **190.3** | **0.803** | **0.102** |
   | 0.05 | 0/500 | 208.5 | 0.794 | 0.156 |

   **`eta` = 0.1 buys a monotone chart for 2% of the objective.** 0.05 buys the
   last eight rises for 10% and a visibly looser picture, which is too much.
   The justification is not that the chart looks nicer: a **full-batch** gradient
   does not need the large steps a stochastic one does, so a small `eta` is the
   appropriate setting and the clean curve is a consequence. Recorded with its
   price so the choice is not re-argued as a cosmetic one.

3. **`min_dist` IS A DISPLAY-LIKE CONTROL THAT IS NOT A DISPLAY PARAMETER.** It
   changes the arrangement, so it must reset the animation (non-negotiable 3) —
   but everything a reader has learned about *which* points are near which
   survives it, which is the whole point. Do not be tempted to mark it
   `display: true` to keep the descent: it feeds `compute()`, and invariant 1
   is not negotiable for a control that moves the picture. **Read the
   `otherDisplay` comment in `t-sne/main.js` before adding any display
   parameter** — core says a display parameter changed but not which, the widget
   deduces it by watching every display parameter except the one being scrubbed,
   and two versions of that guard were wrong before the third was right.

### The notebook's three figures, and what checking them found

Cell 46 embeds `umap-high.png`, `umap-low.png` and `umap-cross.png`, extracted
and read this session. **`umap-cross.png` was digitised rather than eyeballed** —
1131 columns off the teal curve, axes recovered from the gridlines, an error
floor of ±0.025 CE units from the line thickness (`_scratch/umapfig.py`,
`umap8.py`).

| figure | what it draws | finding |
|---|---|---|
| `umap-high.png` | a 3-D scatter, a blue manifold curve, dashed black edges | the edges are **uniform** — no membership strength is visible, and μ is the whole of step 1. It also reads as near-complete rather than k-nearest |
| `umap-low.png` | the same graph in 2-D | same, and on its own axes |
| `umap-cross.png` | cross-entropy against low-dimensional distance | **the right idea, and NOT a curve UMAP can produce** |

**`umap-cross.png` is illustrative, not computed.** Its minimum sits at
d = 1.106 with CE = 0.667, which is the correct *shape* — a genuine minimum at
a non-zero distance is exactly what the per-pair cross-entropy has. But fitting
`−[μ log w + (1−μ) log(1−w)]` to the digitised curve:

- free in `(μ, a, b)`: best fit μ = 0.527, **a = 0.653, b = 1.930**, RMS 0.117 —
  4.7× the digitisation floor
- constrained so `(a, b)` come from a real `min_dist`: RMS **0.408**, worst
  residual 1.53 CE units on a curve whose minimum is 0.667 — 16× the floor

**No `min_dist` pairs a = 0.653 with b = 1.930.** The `min_dist` giving that `a`
is about 0.47, and its `b` is 1.31. So the figure is a hand-drawn illustration
of the right idea.

**This is a much better figure than t-SNE's `tsne-kl.png` and it should be said
so.** That one marked `p/q = 1` as ideal while the curve it plotted bottomed out
at `1/e`, which invites a question the page cannot answer. UMAP's has no such
flaw: its minimum **is** the ideal, because the per-pair cross-entropy really is
minimised at `w = μ`. *Flagged for Kenneth; the notebooks are his and both may
be deliberate simplification.*

**What the widget can add that all three figures lack: the weights.** Drawing
the graph with edge opacity or width carrying μ puts step 1 on screen, and it is
what makes `n_neighbors` visible as something other than a number.

### THE LAYOUT IS KENNETH'S DIAGRAM, and it came from PHM5005 cell 41

**He supplied it on 2026-08-26** and widget 21's history says to treat it as
binding — *"go with A, it matches my diagrams"*, and then, when a later shape
drifted, *"what the heck are you doing? this is not what we did in the
mockup."* It is **his own notebook's figure**, `unsupervised-umap.png`, embedded
in `03-5` cell 41 at 540px and hosted on Dropbox. Four quadrants:

```
    3D space                  ——red arrow——>   2D space (UMAP1 / UMAP2)
    three coloured points,                     THE SAME three points, halos
    each wearing concentric                    WIDER AND OVERLAPPING
    halos, TIGHT

    Graph of neighborhood     ——red arrow——>   Graph of neighborhood
    probabilities                              probabilities
    the same three points,                     the SAME graph, same edge
    edges WEIGHTED — one black                 weights, RE-DRAWN flat
    (strong), two grey (weak)
```

**Read against widget 21's diagram it is the same top row and a different
bottom one.** t-SNE's carried the two probability curves underneath; UMAP's
carries **the graph, drawn once per space**. So the claim the diagram makes is
*the graph is what survives, and the picture is a re-drawing of it* — which is
the notebook's own analogy, below.

#### THE ANALOGY IS THE NOTEBOOK'S OWN WORDS, and the widget already owns it

Cell 41, verbatim: high-dimensional data lies on a manifold, *"analogous to
mapping points on a globe to a flat map while trying to keep nearby points
close together and faraway points far apart without too much distortion."*
Kenneth restated it on 2026-08-26 as **connect them in a graph, then flatten
the manifold — like flattening a map.**

**Widget 21 already draws a wireframe globe**, and it is in the lift list above.
So the analogy the lesson uses and the machinery this arc has built are the same
object, which has not happened before in the arc.

**AND THE ANALOGY IS ALSO THE FAILING CASE, which is the useful part.**
Flattening a globe is exactly why Greenland looks the size of Africa on a
Mercator — and the measurement above is that a cluster genuinely 4.6× wider
draws **1.02×**. The distortion the analogy warns about is the distortion the
widget measures. *That connection is worth making on screen; it is his framing
and it lands on the failing case for free.*

Cell 41 also gives the two steps in his words — *"build a weighted graph where
edges represent the probability of connection between points"*, then *"place
points in lower dimension so that the same connectivity pattern is preserved"* —
and writes the cross-entropy with `p_ij` / `q_ij` rather than PHM5003's `μ`.
**The two notebooks use different notation for the same quantity**, and a widget
serving both has to pick one and say so.

#### THE FOUR QUADRANTS BECOME THE TOP ROW — decided, and by him

*(2026-08-26.)* **His diagram's bottom row isolates the edges the way its top
row isolates the halos, and the widget draws points, halos and weighted edges
together in each space panel** — exactly what widget 21 did with t-SNE's halos.
So the layout is:

```
    3D space  ——arrow——>  2D space (UMAP1 / UMAP2)
    points + halos +      the same points, halos and edges,
    weighted edges        flattened

    the cross-entropy     the cross-entropy against
    falling, clickable    low-dimensional distance
    to scrub the run
```

That keeps every panel his diagram asks for and leaves the bottom row for the
two cross-entropy panels, the second of which he chose separately.

#### THE GRAPH IS DRAWN WHOLE, opacity carrying μ — his call, measured after

His diagram has three points and three edges. The stage has 48, and the counts
are the reason the question was asked at all (`_scratch/graph-legible.mjs`):

| `n_neighbors` | edges of 1128 | mean μ | edges ≥ 0.5 |
|---|---|---|---|
| **3** (PHM5003's) | 66 | **0.833** | **66 — all of them** |
| **15** (PHM5005's) | **385** | 0.360 | 122 |
| 40 | 1040 | 0.183 | 167 |

**He chose all edges with opacity ∝ μ**, over drawing only the picked sample's.
`_lab/umap-edges.html` is that decision at real panel size — 300 × 300, roughly
what a 2×2 gives each quadrant at the 900px breakpoint — with four mappings side
by side and every μ computed live by the shipping engine. *"Ink"* below is summed
alpha × width, a proxy for how much of the panel the edges occupy:

| mapping | k = 3 | k = 15 | k = 40 |
|---|---|---|---|
| **A · alpha = μ** (the literal reading) | 1.1 | 2.9 | **4.0** |
| **B · alpha = μ²** | 1.0 | 1.9 | 2.5 |
| C · alpha = μ^1.5 and width 0.4–2.2px | 2.2 | 4.0 | **5.2** |
| D · each sample's three strongest | 1.1 | 1.6 | 1.7 |

*(ink per point; A also goes from 353 strokes at k = 15 to 940 at k = 40.)*

**C IS CHOSEN — opacity AND width, `alpha = μ^1.5` with width 0.4–2.2px.**
*(Kenneth, 2026-08-26, over a recommendation of B.)*

**The ink column argues against C and the ink column is the wrong measure.**
C carries the most ink at every setting, but it *concentrates* it: width is a far
stronger visual channel than opacity, so a strong edge reads as a line and a weak
one as a hairline, where under A and B every edge is the same line at a different
grey. Total ink says how much of the panel is covered; it does not say whether
the covering is structured. **The reason to record the number anyway is that C is
the variant most at risk at `n_neighbors` = 40** (ink per point 5.2), and that is
where to look first if the panel ever reads as full.

**What the sweep did establish, and it holds for C too:** the mapping decides
whether `n_neighbors` changes how FULL the panel is. Under A the ink per point
nearly quadruples across the control, 1.1 → 4.0, so moving the slider reads partly
as "the picture got darker" rather than as "the neighbourhood got bigger". B goes
1.0 → 2.5 and C 2.2 → 5.2. **At `n_neighbors` = 3 the four are indistinguishable**
(ink 1.0–2.2), because mean μ is 0.833 there and almost every edge is strong.

**No mapping is literally honest and that is worth saying rather than resolving.**
Overlapping semi-transparent strokes compound, so `alpha = μ` already does not
render as *darkness ∝ μ* wherever edges cross — which at 385 edges is everywhere.
C adds a second channel rather than fixing that, and the widget should not claim
an edge's appearance can be read back as a number.

**D is recorded but not chosen.** It is the sparse end of the scale, and it is
what the `pick` route would have looked like.

### What to lift, and the one comment to read first

`widgets/t-sne/main.js` is the reference, not `mds`. Method-independent and
three times used now: the 3-vector helpers, the orthographic `camera`, the
wireframe `globe`, the depth-sorted and depth-sized scatter, the `drag` block,
the `labels` toggle, `--c-cluster-a…f`, and the `layout` function read by both
`height` and `draw`. New at widget 21 and worth reusing: the `regions` map, the
clickable objective chart that scrubs the run, and the `otherDisplay` guard.

**A shared axis between two spaces is a fiction that has to be paid for.**
`_lab/tsne-kernels.html` draws four ways of doing it and records which are
honest — and UMAP needs one for the d\*(μ) panel, whose x-axis is a distance in
the *picture* while μ comes from the *data*.

### What the session did NOT settle

- **the layout**, above — Kenneth's, and it blocks building
- **the wording of the library claim** — the widget runs the exact objective
  `umap-learn` approximates, and how that is said on screen is a teaching call
- **the R `umap` package is unchecked**, and it is what PHM5003 runs. R is not
  installed. The same gap `Rtsne` has, and it matters for the same reason: a
  claim about *what the lesson's own code does* should be checked against the
  lesson's own library
- **how the two notebooks' notation is reconciled.** PHM5003 writes the high-D
  membership as `μ(xᵢ,xⱼ)`, PHM5005 as `p_ij` with `q_ij` for the low-D one. The
  widget serves both and has to pick one and say which

### THE RAIL GAINED SECTIONS — Kenneth, 2026-08-27

Same sweep and same pick as widget 21's (candidate C in
[`_lab/dimred-rail.html`](../widgets/_lab/dimred-rail.html)): **The data**
(groups+samples on one row, seed, True groups) / **UMAP** (neighbours+min dist
on one row, then the two gates). Two real fixes rode along: `seed` — "moves
every sample" — no longer sits *below the run buttons*, and the True-groups
reveal takes the arc's settled place directly after it. The pairs out-pay the
headings: measured 39px *shorter* than the shipped rail. Gates keep their
relative order, so core's `GATE_PARAM` (first gate in the spec) is untouched.
Rail-only — both hashes untouched, no rebaseline.

### After UMAP

The dimensionality-reduction arc closes here. `03-5`'s **second subject** is
clustering — K-Means (cells 52–59) and DBSCAN (60–67) — and **K-Means is widget
23**, chosen by Kenneth on 2026-08-26.

---

## Widget 23 · `kmeans` — SHIPPED 2026-08-26, four review rounds

**The reconnaissance was done on 2026-08-26 while closing widget 22; the
planning session ran the same day, on the pattern of § *NEXT · t-SNE*, and
closed all four questions.** Everything below that carries a number was measured
in the engine that would ship — `widgets/kmeans/model.js`, **imported** and not
copied by `widgets/_lab/kmeans-measure.mjs`. That is the widget-22 lesson
applied from the first line rather than retrofitted, and it is why the
verification below is of the shipping code.

```bash
node   widgets/_lab/kmeans-measure.mjs             # every number in this section
node   widgets/_lab/kmeans-verify.mjs --fixtures   # then kmeans-ref.py, then:
node   widgets/_lab/kmeans-verify.mjs              # 8 cases against sklearn 1.9.0
```

### THE HOST, AND FOR THE FIRST TIME SINCE WIDGET 19 THERE IS ONLY ONE

| course | notebook | what it runs |
|---|---|---|
| PHM5005 | `03-5`, cells 52–59, heading `### K-Means` | `KMeans(n_clusters=2, random_state=42)` on `X_pca` — the cancer gene expression data reduced to 2-D by PCA first |
| PHM5003 | **nothing** | its clustering notebook is `05 / 08 — Hierarchical Clustering`, and it mentions K-Means **zero times** |

**So the two-host pattern of widgets 20, 21 and 22 does not apply here.** Nothing
has to be reconciled between an R library and a Python one, and no claim has to
say which library it is about.

### CELL 52 IS UNUSUALLY COMPLETE, and most of the widget is in it

- **the algorithm in four numbered steps**: choose K centroids at random; assign
  each point to the nearest centroid by Euclidean distance; move each centroid to
  the mean of the points assigned to it; repeat until assignments stop changing
- **the objective**, written out: minimise `Σ_k Σ_{x ∈ C_k} ‖x − μ_k‖²`
- **a diagram**, `unsupervised-kmeans.png` — hosted on Dropbox rather than
  embedded, so unlike UMAP's it could not be extracted from the notebook.
  **Kenneth supplied it on 2026-08-26**, which is what let this session plan a
  layout at all; its grammar is read off below and is binding.
- **a strengths and limitations table**, and its three limitations are three
  candidate failing cases in the notebook's own words:
  - *"Must specify K in advance"*
  - *"Assumes clusters are spherical and similar size"*
  - *"Sensitive to outliers and initial centroid placement"*

  **All three were staged and measured this session, and all three fire.** Which
  two to ship is below.

### THE DIAGRAM, AND WHAT IT DECIDES

Four panels left to right — `k = 2`, **Assign**, **Update**, **Final** — with a
red arrow looping from Update back to Assign. Its notation, in the order a
builder needs it:

| it draws | so the widget must |
|---|---|
| points as **dots**, centroids as **crosses** in the cluster's colour | two marks, and only the cross moves |
| the dots **black** in panel 1 | start uncoloured — `--c-unknown`, "not measured yet, not a third outcome". The data has no colours of its own, which is the whole of unsupervised |
| assignment **recolours dots and does not move crosses** | one beat that changes only colour |
| update **moves crosses and does not recolour dots**, leaving the old cross as a faded ghost with a dotted arrow to the new one | one beat that changes only position, and keeps its own before-and-after on screen |
| a loop arrow from Update back to Assign | a **Step** button. The loop is the algorithm; a widget that only plays it start-to-finish throws away the one thing the diagram bothered to draw |
| bare L-shaped axes, no ticks, no numbers | the coordinates are not the point. Widget 19–22 precedent agrees |

**The four panels are one plot at four moments, not four plots.** So the widget
is a single stage that replays them, and the diagram's left-to-right reading
becomes the Step button's job. This is the same conversion widget 22 made from
its own diagram.

**`lloyd()` already returns exactly this.** It hands back the whole run as
`steps` — `init`, then alternating `assign` and `update` frames, each carrying
its centroids, its labels and its inertia, and each `update` also carrying the
positions it came *from*. `compute()` runs the algorithm to convergence before
the first frame is drawn and the animation only walks the array, which is
non-negotiable 2 satisfied by construction rather than by discipline.

### QUESTION 1: COMPUTE AT RUNTIME — and the consequence is bigger than the answer

The reconnaissance called this one already answered. It is, but the rule is that
a question closes with a number and this one was free to take:

| n | K | ms per fit, init and Lloyd to convergence | iterations |
|---|---|---|---|
| 48 | 2 | **0.018 ms** | 1 |
| 48 | 4 | 0.019 ms | 2 |
| 48 | 8 | 0.042 ms | 2 |
| 120 | 4 | 0.045 ms | 3 |
| 399 | 6 | 0.273 ms | 17 |

**The whole K = 1…8 sweep, ten restarts at every K, costs 1.24 ms.** That is the
number that matters, because it means the widget can afford **a panel of the
objective against K, recomputed on every parameter change**. No earlier widget in
this arc could have fitted its own model nine times per render — t-SNE at n = 48
is 55 ms and UMAP more — and that panel is what closes question 2 below. Compare
the two failures of nerve this repo has already recorded: compute-versus-replay
was assumed wrong for t-SNE and again for UMAP.

### THE ENGINE IS THE LIBRARY'S — exactly, which widget 22 could not manage

Eight fixtures spanning both candidate stages, both initialisers, K below, at and
above the truth, and 3-D as well as 2-D. Against **sklearn 1.9.0**:

| what | agreement |
|---|---|
| labels | **identical on all 8**, point for point |
| inertia | ≤ **7.1e-15** |
| silhouette | ≤ 3.3e-16 |
| ARI | ≤ 1.1e-16 |

**Exact, rather than umap-verify's "comparable in kind and not to the digit".**
The difference is that `kmeans-verify.mjs --fixtures` writes the points *and the
initial centroids* to JSON and `kmeans-ref.py` reads them, so both engines run
Lloyd from byte-identical input; UMAP's reference had to rebuild its stage in
numpy and compare across two generators. Any widget whose stage can be
serialised should do it this way.

Two details that had to be got right for the comparison to mean anything:

- **`tol=0`.** sklearn's default `tol=1e-4` stops on a small centre shift, which
  is a *weaker* rule than cell 52's "until assignments no longer change". Left at
  the default the two engines would disagree for a reason that is a bug in
  neither.
- **the one deliberate divergence never fires.** An emptied cluster keeps its
  centroid here and sklearn relocates it; **0 of 1680 runs** empty a cluster at
  any step, across 2–4 groups, K = 2…8, 40 seeds and both initialisers. Freezing
  is also the better picture — a centroid nobody chose sits still and visibly
  owns nothing, which is what K set too high looks like.

### AND THE NOTEBOOK'S OWN CALL GETS ONE START

`KMeans(n_clusters=2, random_state=42)` resolves `n_init` to **1** under sklearn
1.9.0 — the default became `"auto"` in 1.4, which is 1 for k-means++ and 10 for
random init. So the lesson's third limitation is **live in the lesson's own
code** rather than defended against by the library, and the widget can say so
about the exact call on the exact page. Measured consequences are in question 3.

### QUESTION 2: THE ONE SENTENCE

> **K-Means returns K clusters whether or not the data has any. What it minimises
> falls at every K, so it cannot be what tells you K was wrong.**

The arc so far: PCA — *a 2-D plot is not the data*; MDS — *the input is the table
of distances, not the cloud*; t-SNE — *it keeps who is near whom and throws away
everything else*; UMAP — *how tight it looks is a setting*. **This is the first
widget in the arc where the reader supplies the answer's shape and the method
complies**, which is why "must specify K" was the candidate with no counterpart
anywhere, and the measurement is what turns it from a limitation into a claim:

| K | inertia | fall vs K−1 | silhouette | ARI vs truth |
|---|---|---|---|---|
| 1 | 55.73 | — | — | 0.000 |
| 2 | 29.78 | 46.6% | 0.508 | 0.561 |
| **3 (the truth)** | **5.33** | **82.1%** | **0.738** | **1.000** |
| 4 | 4.21 | 21.0% | 0.632 | 0.872 |
| 5 | 3.71 | 11.9% | 0.481 | 0.773 |
| 6 | 2.85 | 23.0% | 0.417 | 0.653 |
| 7 | 2.37 | 16.8% | 0.450 | 0.627 |
| 8 | 2.04 | 14.2% | 0.402 | 0.504 |

**The objective never rises.** It is still falling 14% a step at K = 8, where the
answer has 5 clusters more than the data has groups and the ARI has halved. A
reader watching only the number the algorithm is minimising has no signal at all
— and the fall at K = 6 (23.0%) is *larger* than the fall at K = 4 (21.0%), so
the elbow is not even monotone in its decrements. That is the elbow method's own
weakness on the page, unprompted.

**And the honest boundary, which the widget must not overclaim past.** The
silhouette *can* choose K here — it peaks at the truth on 5 of 5 stage seeds
(0.499 ± 0.013 at K = 2, **0.714 ± 0.013 at K = 3**, 0.607 ± 0.020 at K = 4). So
the sentence is *the objective cannot*, not *nothing can*. What the widget is
teaching is that **the check has to come from outside the thing being minimised**,
which is also why cell 59 prints two scores the fit never saw.

**The structureless cloud, and what it is honestly worth.** 48 points uniform on
a disc, no groups at all, 40 seeds:

| K | silhouette on the cloud | on three real groups |
|---|---|---|
| 2 | 0.403 ± 0.032 | 0.491 ± 0.021 |
| 3 | 0.422 ± 0.030 | 0.696 ± 0.030 |
| 4 | 0.428 ± 0.030 | 0.596 ± 0.037 |

K-Means partitions the cloud into K tidy wedges and scores **0.42**, which
against cell 51's own scale — near +1 well matched, near 0 between clusters —
reads as *fine*. But **0 of 40 cloud runs beat the worst real-group run**, so
the widget may not claim the silhouette is fooled. What it may claim is sharper
and is visible in the table: **at K = 2 three real groups score 0.491 and pure
noise scores 0.403.** The number means nothing on its own; it means something
against another number.

*(t-SNE's #1 failing case was the same demonstration — a method drawing clusters
in a cloud that has none — and there it was the headline. Here it is support:
t-SNE's cloud was a surprise, K-Means' is arithmetic.)*

### QUESTION 3: WHICH FAILURE — all three fire, and two should ship

| # | the lesson's words | measured | cost |
|---|---|---|---|
| 1 | *"Must specify K in advance"* | the table above: monotone fall to K = 8, ARI 1.000 → 0.504 | **one control, and it is the one sentence** |
| 2 | *"Assumes clusters are spherical and similar size"* | a cliff between 3:1 and 4:1 elongation, below | one control and its own stage shape |
| 3 | *"Sensitive to … initial centroid placement"* | needs four groups to fire, below | ~~free — every widget has `seed`~~ **one more control, see WHAT BUILDING IT CHANGED** |

**#1 and #3 are the pair to build.** #1 is the widget. #3 costs nothing, rides on
a control that already exists in every widget in the collection, and is *the one
a reader discovers by pressing a button twice* — which is what the reconnaissance
predicted and the measurement now supports. #2 is real and well measured but it
needs a stage shape of its own; it is the first thing to add if the layout has
room, and the second thing to cut if it does not.

#### #3, measured: 60 restarts per setting, on a stage where the truth is reachable

A restart counts as having failed if it **misses the best partition found**, not
if it scores worse — two earlier criteria were tried and both were wrong, and the
script records why: inertia-above-best counted 3.94 against 3.92 (one point
swapped) as a failure, and ARI-below-0.9-against-the-truth counted 60 of 60 at
six groups because at 8 per group the stage itself is unrecoverable. What a
reader sees is **a different picture from the same data**, so that is what is
counted.

| stage | random init, `n_init=1` | random, `n_init=10` | k-means++, `n_init=1` | k-means++, `n_init=10` |
|---|---|---|---|---|
| 3 groups of 16 | 3 / 60 | 0 / 60 | 0 / 60 | 0 / 60 |
| 4 groups of 12 | 19 / 60 | 0 / 60 | 6 / 60 | 0 / 60 |
| **6 groups of 8** | **41 / 60** | 1 / 60 | **9 / 60** | 0 / 60 |

**Three groups is not enough to show it and six is.** At three groups the
notebook's own configuration — k-means++, one start — never misses, so a widget
staged at three would quietly teach that the limitation is theoretical. At six it
misses 9 times in 60, and plain random starts miss 41.

**And a missed run is visibly missed**: it agrees with the best partition at ARI
0.45 (three groups), 0.60 (four) and 0.73 (six). It is a different answer, not a
rounding difference — two true groups fused and one split, which is exactly what
a reader can point at.

#### #2, measured — and it corrects the lesson's own wording

Twenty stage seeds each, two groups, K = 2:

| stage | ARI vs truth | silhouette of the answer |
|---|---|---|
| round, equal | 1.000 ± 0.000 | 0.751 |
| elongated 3:1 | **1.000 ± 0.000** | 0.535 |
| elongated 5:1 | 0.212 ± 0.346 | 0.400 |
| elongated 8:1 | 0.002 ± 0.028 | 0.449 |
| equal n, **3× width** | 0.714 ± 0.151 | 0.583 |
| **4× count**, equal width | **0.995 ± 0.020** | 0.750 |
| 4× count *and* 3× width | 0.333 ± 0.186 | 0.428 |

**"Similar size" is about WIDTH, not COUNT.** Four times as many points in one
group as the other costs nothing measurable (0.995); three times the *spread*
costs 0.29 of ARI on its own and 0.67 when the counts are lopsided too. The
lesson's phrase reads as *n* to most students and the widget can put that right
in one control.

**Where "spherical" tips over**, 30 stage seeds per row:

| aspect | ARI vs truth | runs broken (ARI < 0.9) |
|---|---|---|
| 1 – 3 | 0.997 ± 0.015 | **0 / 30** |
| 3.5 | 0.965 | 1 / 30 |
| 4 | 0.656 | 11 / 30 |
| 4.5 | 0.460 | 17 / 30 |
| 5 | 0.185 | 26 / 30 |
| 8 | 0.002 | **30 / 30** |

A cliff between 3:1 and 4:1, and nothing before it. That is a good control —
a slider whose whole first half does nothing is honest here, because *the
assumption holds until it doesn't* is the lesson.

### QUESTION 4: WHICH SPACE — it fires, and only from four groups up

Cell 53, verbatim: *"For simplicity, we will reduce the dimensions to 2 so that
that be mapped to the 2D plots for comparison. In practice, data is reduced to
10-50 dimensions to for clustering in this space."* Measured on the arc's own
stage — `groups` caps on a sphere of radius 2, widgets 20–22's `stage()`,
imported — clustered in 3-D and in its PCA plane, K set to the true number, 20
seeds each:

| groups | ARI in 3-D | ARI in the 2-D picture | the two labelings differ |
|---|---|---|---|
| 2 × 24 | 1.000 | 1.000 | **0 / 20** |
| 3 × 16 | 1.000 | 1.000 | 0 / 20 |
| 4 × 12 | 1.000 | 0.903 ± 0.119 | 11 / 20 |
| **6 × 8** | **0.995** | **0.776 ± 0.091** | **19 / 20** |

**At the notebook's own K = 2 the question does not exist**, which is worth
saying out loud: cell 56 clusters two groups, and for two groups the choice of
space changes nothing in 20 of 20 runs. The lesson's caveat is true and its own
example cannot show it.

**And the reason it is worth a widget at all is the second table.** Both answers
scored *in the 2-D picture*, which is the only place a reader can see anything:

| groups | silhouette of the 2-D answer | of the 3-D answer | ARI (2-D / 3-D) |
|---|---|---|---|
| 4 | 0.708 | 0.663 | 0.903 / 1.000 |
| 6 | **0.618** | 0.487 | **0.776 / 0.995** |

**The picture endorses the answer that was fitted to the picture.** At six groups
the worse clustering scores 27% *better* on the only number a reader can compute
from what is on screen. That is a genuinely new idea for this arc and it is cell
53's sentence made true rather than asserted.

### THE STAGE IS FLAT — settled by Kenneth on 2026-08-26

| | **A · flat** | **B · chained** |
|---|---|---|
| stage | 2-D blobs, exactly the diagram | the arc's 3-D sphere stage, projected by PCA |
| shows | the mechanism, K, the seed, the shape cliff | all of that, plus question 4 |
| costs | nothing new | a camera, a globe, two runs, two spaces on screen |
| risk | question 4 goes unshown, or waits for widget 24 | the assign/update beat — the thing the diagram is about — happens inside a projection, and the widget teaches two things |

**A, and Kenneth took it on 2026-08-26**, on the collection's own rule that a widget teaches
one thing — the rule that cut widget 3's `stat` control after it was built and
working. The diagram is flat and binding; question 4 needs four groups minimum
and a third dimension the reader cannot see; and **DBSCAN (cells 60–67) is the
natural widget 24 and runs on UMAP output**, so "which space" has a better host
one widget later, where the mechanism is not competing for the same screen.

Both sets of numbers are recorded above so B can be chosen without re-measuring —
and under A they are what widget 24 inherits rather than what widget 23 discards.

### THE SHAPE OF IT, if A

- **one stage**, one plot, dots and crosses, replaying `steps`
- **Step** advances one beat and names it (`Assign` / `Update`); **Run** plays to
  convergence; the caption says which beat and which iteration
- **`K`** — an int control, 1…6. Six because `tokens.css` defines exactly six
  cluster colours (`--c-cluster-a`…`-f`) and widget 22 already took that as the
  ceiling for `groups`
- **`groups`** — how many the data actually has, so K and the truth can disagree.
  Default **6**: question 3's table says the seed lesson does not fire below four
- **`seed`** — the failing case, free
- **`shape`** — **held back from the first build, Kenneth's call on 2026-08-26.**
  The elongation cliff is measured and `blobs(rng, { aspect })` is built, so
  adding it after review is one control and no new machinery
- **`labels`** — display-only, off by default, non-negotiable 4. **A toggle, not
  two panels — Kenneth's call on 2026-08-26.** Cell 58 draws found-clusters and
  true-labels side by side; widget 22 made the same comparison a toggle on one
  panel, and two panels would halve the stage the mechanism plays on
- **readout**: inertia (the thing being minimised), silhouette and ARI — cell 59
  prints the last two, and the first has to be visible for "it improves at every
  K" to be watchable
- **the K sweep panel**, if it fits: inertia and silhouette against K = 1…6, live
  at 1.24 ms a render. **This is what makes the one sentence a picture rather
  than a caption**, and it is the whole reason question 1's answer mattered

### WHAT BUILDING IT CHANGED — one control the plan did not have

**`seed` was not free after all, and the plan said it was.** Every widget in the
collection has a `seed`, so question 3 counted the initial-placement failing
case as costing nothing. Built, it cost one more control, and the reason is
worth keeping:

**One seed feeding both the samples and the starting centroids moves two things
at once.** A reader presses it, gets a different clustering, and cannot tell
whether the data changed or the start did — on the one control whose entire job
is to show that *the start* matters. The plan's own measurements had the same
confound and did not notice it, because they varied the init against a stage
held fixed at one seed, which is not a thing the widget could do.

So there are two: **`seed` draws different samples, `start` places the centroids
differently on the same samples.** Measured through the shipping widget, at the
default 8 samples per group, over 60 starts on identical points:

| groups (K = groups) | starts landing somewhere else | first one |
|---|---|---|
| 2 | **0 / 60** | — |
| 3 | 3 / 60 | start 4 |
| **4 (the default)** | **15 / 60** | **start 4** |
| 6 | 33 / 60 | start 3 |

*(Re-measured at the shipping defaults — 12 samples a group, Forgy init. The
first version of this table was k-means++ at 8 a group; see REVIEW ROUND 1.)*

**~~That is why `groups` defaults to 6~~** — it did, for one build; REVIEW ROUND 1
below moved it to 4 for a reason that outranks this one. Same 48 points, two
nudges of the start:

| | start 2 (the default) | start 4 |
|---|---|---|
| within-cluster SS | **3.79** | 13.24 |
| silhouette | **0.70** | 0.44 |
| ARI | **1.00** | 0.58 |
| iterations | 4 | 1 |

**And the silhouette moves with it**, which matters for honesty: a reader who
never turns the true groups on can still see that something is worse. The
widget does not need the labels to make the point; it needs them to *score* it.

**These numbers are not the plan's 9-in-60 and should not be quoted as if they
were.** That figure held the samples fixed at one stage seed and varied only the
init, in a lab script; this one is the widget's own two controls, and it is the
one a reader can reproduce. Both are in the repo — `_lab/kmeans-measure.mjs` §5
for the first, `_lab/kmeans-drive.mjs` for this one.

### REVIEW ROUND 1 — three notes, and each one moved something structural

Kenneth, 2026-08-26, on the first build: the clustering read as cluttered; a
speed control would help, with the slowest showing the centroid comparing itself
against the dots near it and the fastest not; and choosing K to watch the two
scores move is the lesson, with the sweep panel in doubt.

**1. The clutter was one mark, and removing it was right.** A ring in
`--c-highlight` marked every point that had changed cluster on the current
assignment. On the FIRST assignment every point has changed, so it drew a ring
on all 48 at once, on top of a dot that already had a fill and — with the true
groups shown — a second ring outside it. Three marks per point, two of them
rings. **The count moved into the caption** (*"Assign — 12 points changed
cluster"*), which is where it always belonged: it is the algorithm's stopping
rule, and a number is a better reading of it than 48 circles.

**2. The spokes replace it, and they are the assignment being WORKED OUT.** At
Slow and Medium each centroid grows a dashed spoke out to every point it is
claiming, and only then do the colours change:

```
0.00 - 0.55   spokes grow, from the centroid outward
0.45 - 1.00   the dots cross-fade to their new colour
0.72 - 1.00   the spokes fade out
```

**Growing from the centroid rather than from the point** is what makes it read
as the centroid reaching rather than the points jumping. **Winner only** — a
line from every point to every centroid is the comparison itself, and at K = 6
with 48 points that is 288 lines and a hairball. Fast draws none of it, which is
what Fast is: the same states, none of the working.

**And Iterate always runs the full choreography, whatever Play is set to.** Its
whole job is to show the mechanism and a fast single step is useless.
`bootstrap` settled the identical question the identical way.

**3. The sweep panel is cut.** ** It plotted the objective and the silhouette
against every K at once, under the stage. Three reasons, in order of weight:
it showed all six answers before the reader had built one, which principle 4 is
against; it was a second figure competing with the mechanism for the same
screen; and it was 194px of height for something the two readout tiles already
say one K at a time. **Choosing K and watching the tiles move is the same lesson
with the reader doing the work.** **The version worth building was called “not a small change” here, then asked
for, built and cut** — REVIEW ROUND 2. It cost `k` becoming a display parameter,
and what killed it was not the cost: it was being a second object.

#### And cutting it exposed a defect in the default

With the sweep gone, the reader walks K on the slider. At `groups = 6` — the
default the plan argued for — **the truth sits AT THE TOP of the K slider**, so
walking K shows both scores improving all the way to the end. A reader doing
exactly what the widget invites would have learned the opposite of the lesson.
**Four groups leaves room above the truth**, and the divergence is the whole
sentence, on the slider:

| K | 1 | 2 | 3 | **4** | 5 | 6 |
|---|---|---|---|---|---|---|
| within-cluster SS | 49.2 | 27.0 | 13.2 | **3.8** | 3.2 | 2.5 |
| silhouette | — | 0.45 | 0.57 | **0.70** | 0.61 | 0.57 |
| ARI | 0.00 | 0.48 | 0.70 | **1.00** | 0.91 | 0.84 |

The objective never rises. The silhouette turns over at the truth and falls.
**That is question 2's sentence with nothing left to assert**, and it is only
visible because K can go past the number of groups. Six is one click away for
anyone who wants the start lesson at full strength (33 of 60 against 15).

#### THE INIT CHANGED TO FORGY, and the plan's numbers are about the other one

`kmeans++` starts so well on separated blobs that **the default run converged in
ONE iteration** — the loop the whole widget is about was over before the reader
saw it. The widget now uses **Forgy**: K of the observations, uniformly at
random. Two reasons and they agree:

- **It is cell 52's step 1 verbatim** — *"Choose K cluster centres (centroids)
  randomly"*. The lead button says the centroids are placed at random, and
  k-means++ makes that a half-truth since it deliberately spreads them apart.
  `sklearn`'s own `init="random"` is this.
- **It gives a loop worth watching**: 3.0 iterations on average at the defaults
  against 1.8, and 15 of 60 starts landing elsewhere against 10.

**So every k-means++ number in the sections above describes what the notebook's
code runs, not what the widget runs, and the two must not be quoted for each
other.** The distinction is worth keeping on both sides: the lesson's own
`KMeans(n_clusters=2, random_state=42)` gets one k-means++ start, and the
algorithm the lesson *writes out* starts uniformly at random. **An `init`
control showing both is the obvious next one**, and it is one segmented control
over machinery that already exists — `forgy` and `kmeansPlusPlus` are both
exported and both verified.

#### The defaults, and why each is the value it is

| | | |
|---|---|---|
| `groups` | **4** | leaves room above the truth on the K slider — the table above |
| `samples` | **12** | 48 samples, the scale the rest of the arc uses |
| `k` | **4** | opens matching the stage, so the first run shows the mechanism working |
| `start` | **2** | four iterations AND the right answer; start 4 is one of the fifteen in sixty that is not, so the lesson is two nudges away |
| `speed` | medium | spokes shown, briskly |

**`start = 2` is chosen, not incidental**, and that is worth saying plainly: a
default that converged in one iteration would have hidden the loop, and one that
converged wrongly would have taught distrust of the widget rather than of the
method.

### REVIEW ROUND 2 — the silhouette graph, BUILT AND CUT. The measurement stands.

Kenneth asked for it, then read it and cut it: *"more confusing for students. will
let them explore and take note of numbers."* **The panel is gone; everything
measured for it is below and is about the method, not about the panel.**

**That is the second panel this widget has built and cut, and the reasons were
different both times** — which is worth stating plainly, because a third
proposal will arrive:

| | what it did | why it went |
|---|---|---|
| round 1 | plotted the objective and the silhouette against every K at once, behind a checkbox | handed over the answer to the widget's own question before the reader had run anything |
| round 2 | plotted only the K the reader had taken to convergence, starting empty | **fixed that, and was still too much to carry.** Reading a number off a tile after each run is the same lesson with one thing on screen instead of two |

**So the objection is not spoilers and it is not the drawing — it is the second
object.** A widget teaches one thing, and the stage is the thing. Anything that
proposes to put a curve under it has to beat "look at the tile, write it down",
which is a lower bar than it sounds.

#### THE MEASUREMENT, which is the valuable half and outlives the panel

Same 48 points, 60 different starts, walking K = 1…6 with each:

| | one start (what the widget runs) | ten starts (`n_init = 10`) |
|---|---|---|
| silhouette peaks at the true K | **45 / 60** | **60 / 60** |
| the objective **rises** somewhere in the curve | **16 / 60** | **0 / 60** |
| silhouette at K = 4, the truth | 0.632 ± 0.119 (0.31 – 0.70) | 0.699 ± 0.000 |
| at K = 3 | 0.538 ± 0.033 | 0.568 ± 0.000 |
| at K = 5 | 0.610 ± 0.031 | 0.636 ± 0.009 |

Three readings, and the third is the one that is still open:

1. **A single start is not stable, and a quarter of the curves point at the
   wrong K.**
2. **The instability is concentrated AT THE TRUTH** — spread 0.119 at K = 4
   against 0.03 either side. A bad start costs most exactly where the answer is,
   because that is the only K with a good partition to miss.
3. **`n_init = 10` removes it.** Not reduces: 60 of 60 peaks correct, 0 of 60
   curves non-monotone, zero variance below K = 5. And **sklearn's
   `n_init="auto"` already resolves to 10 for `init="random"`**, which is the
   init this widget runs. The library's default is the cure.

#### AND CUTTING THE GRAPH DID NOT CLOSE THE ONE THAT NEEDED A RULING — settled in ROUND 3

Row two of that table is a problem for the widget as it now stands, and arguably
a bigger one: **the reader is being asked to note the numbers down as they move
K.** "What K-Means minimises falls at every K" is a claim about the global
optimum, and one random start does not reach it — so on 16 of 60 curves, the SS
tile **goes up** as K goes up, and now it goes up in the reader's own notes with
no curve on screen to make the oddity obvious.

Three ways out, unchanged by the cut:

| | |
|---|---|
| **accept it** | the deeper lesson: a single-start elbow is unreliable, which is why nobody draws one from a single start |
| **an `n_init` control** | 1 or 10, sklearn's own parameter. One segmented control over machinery that exists — `_lab/kmeans-measure.mjs` already fits in a loop and keeps the lowest inertia as `tries` |
| **say less** | soften the on-screen claim to "the objective cannot tell you K was too big", which survives non-monotonicity |

**The recommendation was the control, and Kenneth took it** — see REVIEW ROUND 3.
The three ways out below are kept because the argument for the other two is what
the control has to keep beating.

#### What was reverted, so it is not rebuilt by accident

- the strip under the stage, and `layout()` is stage-only again at `STAGE_MAX`
  400 (446px tall, against 546 with the strip)
- **`k` is a DATA parameter again.** It was briefly `display: true` because the
  record lived in `anim`, which a data change re-inits; with no record there is
  no reason, and data is what it should be — a new K is a new model and starting
  the run over is honest
- `compute` fits **one** K again rather than all six
- the hidden `tried` bitmask, `?shown=`'s counterpart, is gone
- `animation.rebuild` is gone; `labels` and `speed` derive nothing, so core
  keeping `anim` untouched is exactly right

**`_lab/kmeans-drive.mjs` went from 84 assertions to 69 with it**, and that ratio
is the honest cost of the feature: twelve of the fifteen were for the graph
alone, because a graph that quietly empties on a change of K still renders and
still passes everything else.

### REVIEW ROUND 3 — `n_init` lands, and the true groups move up the rail

Kenneth, 2026-08-26, after asking what `n_init` and `"auto"` actually do:
*"add the n_init control, 1 or 10, also move the true groups toggle after seed
slider (before the K-means section)."* **This closes the ruling round 2 left
open.**

#### `restarts` — the cure for the control above it

A `segmented`, 1 or 10, in the K-Means block directly under `start`, which is
the control it answers. **Default 1**, because ten hides the lesson `start`
exists to teach; ten is what the reader turns on once they have felt it.

What it does, on the same 48 points:

| | start 2 (the default) | start 4 | start 8 |
|---|---|---|---|
| `n_init = 1` | SS **3.79**, sil 0.70, ARI **1.00**, 4 iterations | SS 13.24, sil 0.44, ARI **0.58** | SS 13.06, sil 0.41, ARI **0.63** |
| `n_init = 10` | SS **3.79**, sil 0.70, ARI **1.00**, 4 iterations | SS **3.79**, sil 0.70, ARI **1.00** | SS **3.79**, sil 0.70, ARI **1.00** |

Over 30 starts at the defaults: **8 land somewhere else at one start, 0 at ten.**

#### THE PROPERTY THE CONTROL RESTS ON, and it is worth protecting

**All the restarts draw from ONE stream, so the ten starts BEGIN with the one
start.** Switching to ten can lower the objective or leave the picture exactly
where it was, and can never land somewhere unrelated. Measured across 90
(start × K) pairs, **40 are unchanged** — and an unchanged picture is not a
control doing nothing, it is the reader learning something true: *their start
was already the best of ten*.

Lose that and the control becomes a re-roll wearing a different label, with the
picture moving for a reason the reader will mis-attribute. Nothing else in
`_lab/kmeans-drive.mjs` would notice, so it is asserted directly.

#### And the figure says which it is showing

At ten starts the animation replays **the winner** and the other nine are never
drawn — which is exactly what `sklearn` reports, and exactly the kind of thing a
widget has to say out loud rather than let a reader assume. The init frame's
caption becomes *"4 centroids — the best of 10 random starts"*, and the
accessible summary says the same. The canvas text sweep covers both wordings,
because a caption that only one setting produces is a caption no check sees.

#### What `n_init` actually is, checked against the installed library

Read out of `_BaseKMeans._check_params_vs_input` in **sklearn 1.9.0**, not from
memory:

- **It is a best-of-N wrapper, not more iterations.** The whole algorithm runs
  `n_init` times from fresh starts, each to convergence, and **only the lowest
  inertia is kept**. The rest are discarded.
- **`"auto"` resolves by looking at `init`**: `"k-means++"` → **1**;
  `"random"` → **10**; an explicit array → 1; a callable → 10. It became the
  default in 1.4; before that it was 10 for everything.
- Measured on 48 points in 4 blobs, `init="random"`, 40 seeds: at `n_init=1`
  **35 of 40** runs score above the best (worst 144.8 against best 72.3); at 10,
  **1 of 40** (worst 72.5).

**So the control is the gap between what the widget does and what the library
would have done.** The widget runs Forgy, which *is* `init="random"`, with one
start; sklearn's own default for that init is ten.

**And "k-means++ makes restarts unnecessary" is sklearn's judgement, not a
guarantee** — measured on this stage, k-means++ with one start still missed the
best partition 9 times in 60 at six groups. Worth knowing, because the
notebook's own `KMeans(n_clusters=2, random_state=42)` is exactly that
configuration.

#### The true groups moved into the data block

`labels` now sits after `seed`, before the `K-Means` divider. **What the groups
really were is a fact about the samples, not a way of looking at them** — the
only display-ish thing about it is that revealing it must not throw the run
away, which is why it stays `display: true`. The rail now reads:

```
The data      groups · samples · seed · True groups
K-Means       K · centroid start · starts to try
Watching      play speed
```

One control under the last divider is thin, and it is still the right split:
playback is not the model, and a `shape` control would join the first block
while an `init` control would join the second.

### REVIEW ROUND 4 — the rail was twice the figure

Kenneth, 2026-08-26: *"the left panel is quite tall so when i scroll to play i
can't see the graph. can you see if can reduce the rows? like 2 sliders per
row?"* — and, correctly, *"mock-up before implementing"*.

**The report as a number, measured at 1240px, side layout, the real 300px
track:** controls **776**, drive row 138, rail **947** — against a **446px**
stage whose whole column is 570. Play started **808px** down a column beside a
figure that ended at 446. Scroll far enough to see Play and the stage still on
screen was **45% at a 700px viewport, 58% at 760, 89% at 900**.

Six rails were drawn side by side at the real width in
[`_lab/kmeans-rail.html`](../widgets/_lab/kmeans-rail.html), each built by
`core/controls.js` itself from a real spec — same builder, same CSS, same track,
so the heights are the heights rather than an impression of them.

| | | controls | Play at | rail | stage visible @700 / @760 / @900 |
|---|---|---|---|---|---|
| A | as shipped | 776 | 808 | 947 | 45% / 58% / 89% |
| B | two sliders per row | 649 | 682 | 820 | — |
| C | speed below the buttons | 616 | 649 | 876 | — |
| **D** | **B + C — SHIPPED** | **489** | **522** | **737** | **100% / 100% / 100%** |
| E | + seed beside true groups | 433 | 466 | 693 | 100% |
| F | E without the headings | 328 | 361 | 588 | 100% |

**D was taken because it costs nothing.** Both halves are core's own machinery
and both were already in use:

- **`row: { key }`** puts consecutive fields in one flex row — widget 9's, for
  its population dials. Here it pairs `groups`+`samples` (both describe the
  stage) and `k`+`start` (both describe the fit). **Each pair is genuinely one
  kind of thing**, which is what a flex row asserts.
- **`afterDrive: true`** builds a field into the block *below* the drive row —
  widget 10's and `generalization`'s. `speed` goes there, and the "Watching"
  divider goes with it: a heading over one control below the buttons is
  furniture. It removes nothing and moves 160px out from between the reader and
  Play. It is also arguably where a pace belonged — 3.4e fixes the drive row as
  the last thing you SET before pressing, and a play speed is not that.

Measured after shipping: controls **489**, drive top **522**, rail **737**, and
**100% of the stage on screen with Play visible at every viewport tried**.

#### ONE IDEA BUILT AND DROPPED, because it measured to zero

The obvious companion to pairing was **shortening the labels to fit the
half-width** — "Groups in the data" → "Groups", "Clusters to look for (K)" →
"Clusters (K)" — with each noun rehomed into the detail line, which principle
3.4c requires and the rail already renders. Built as its own candidate and
measured: **at 144px every full-length label already sits on one 18px line.**
None of them wrapped, so the shortened rail came out at exactly the same height
as the long-labelled one, to the pixel.

**A real cost for a saving of zero**, and the pairs keep every label they have.
Worth recording because the idea will occur again to anyone looking at a 300px
rail and assuming long labels must be the problem.

#### E and F are on the table and each spends something

**E** is a third pair, `seed` beside `True groups`, for 56 more pixels. The
objection is not the height: **those two are not siblings.** One draws different
samples; the other reveals what the samples always were, and a flex row says the
things inside it are the same kind of thing. **F** drops the two remaining
headings for 105 more — and the headings are what keep `seed` and `start` from
reading as one dial, which is the distinction round 1 added a whole control to
make. Cheapest height, dearest meaning.

Neither is needed: D already puts the whole stage on screen with Play visible.

### BUILT — what is in `widgets/kmeans/`, and what is owed

```bash
node scripts/serve.mjs 8010
# http://localhost:8010/widgets/kmeans/
node widgets/_lab/kmeans-drive.mjs     # 68 assertions, incl. the canvas text sweep
node widgets/_lab/kmeans-verify.mjs    # 8 cases against sklearn 1.9.0
```

| | |
|---|---|
| `model.js` | Lloyd, k-means++ and Forgy, inertia, silhouette, ARI, the stage. Verified against sklearn exactly |
| `main.js` | the widget. `status: "draft"`, not in the manifest, not on the gallery |
| `_lab/kmeans-drive.mjs` | drives it with no browser and no clock — the contract, the numbers, and every string it paints |

**The drive script does three jobs and the third is new to this repo.** Besides
the contract assertions and the canvas text sweep, it records **where** the
widget draws and fails if anything lands outside the canvas at 320, 420, 550,
694, 770 or 900px. The fingerprint hashes one width and `check` asserts nothing
about geometry, so an overrun at a width nobody looked at is invisible — and
this collection has already shipped one, a caption printing through its own note
at 550px. It is cheap and it belongs in the next widget too.

**Owed, in order:** Kenneth's review; then the fingerprint states (two or three
settled plus at least one driven, confirmed identical across three runs); then
the manifest entry and `status: "shipped"`. Baselining before the review is what
the order-of-work section argues against, and `bootstrap` paid for it three
times.

**Not yet judged projected**, like every widget from 11 on.

### What this session did NOT settle

*(The three layout questions it raised were put to Kenneth the same day and are
settled above: flat stage, `labels` toggle, no shape control in the first build.)*

- **the centroid cross is not a core mark.** `canvas.js` has `dot()` and nothing
  cross-shaped. Drawing it in `widgets/kmeans/main.js` is the cheap answer and is
  defensible under the repo's own "one consumer does not decide a seam" rule (the
  `note()` comment in `canvas.js`); promoting it to core costs a full fingerprint
  run and should wait for a second consumer
- **the real data has not been re-run.** Cell 59's printed silhouette and ARI on
  GSE44076 are not on this disk and the Drive copies carry no outputs, so what
  the lesson's own figure actually prints is unknown. It needs one network fetch
  of the CuMiDa CSV — ask before reaching for it
- **the two typos in cell 53** — "so that that be" and "to for clustering", plus
  "reduce the data to before clustering" with the number missing. Flag with the
  `03-5` cell 45 `random_state` omission already recorded above

### WHAT TO LIFT

`widgets/umap/` is the reference, and **`model.js` is the pattern that was
repeated**: the algorithm in its own module, so `_lab` imports the shipping code
rather than a copy of it. `widgets/kmeans/model.js` exists and is verified;
`main.js` is what remains. Also worth lifting: the two-gate staging, `anim.inert`,
the `otherDisplay` guard, and — only if B is chosen — the stage on the sphere,
the camera and the wireframe globe.

**And the obvious arc move**: `03-5` runs K-Means on **PCA output** and DBSCAN on
**UMAP output**. So the clustering widgets chain off widgets 19 and 22 rather
than starting fresh, and under recommendation A that chaining is what widget 24
inherits rather than what widget 23 spends itself on.

---

## Widget 24 · `dbscan` — SHIPPED 2026-08-27

**The reconnaissance was written on 2026-08-26 while shipping widget 23; the
planning session ran the same day, on the pattern of § *NEXT · K-Means*, and
closed all four questions.** Everything below that carries a number was measured
in the engine that will ship — `widgets/dbscan/model.js`, **imported** and never
copied by `widgets/_lab/dbscan-measure.mjs`. Kenneth supplied cell 60's diagram
at the top of the session, which is what let a layout be planned at all.

```bash
node   widgets/_lab/dbscan-measure.mjs             # every number in this section
node   widgets/_lab/dbscan-verify.mjs --fixtures   # then dbscan-ref.py, then:
node   widgets/_lab/dbscan-verify.mjs              # 13 cases against sklearn 1.9.0
```

### THE HOST, AND AGAIN THERE IS ONLY ONE

| course | notebook | what it runs |
|---|---|---|
| PHM5005 | `03-5`, cells 60–67, heading `### DBSCAN` | `DBSCAN(eps=0.7, min_samples=5)` on `X_umap` — the cancer gene expression data reduced to 2-D by **UMAP** first |
| PHM5003 | **nothing** | checked across all ten notebook directories: DBSCAN appears **zero times** |

So nothing has to be reconciled between an R library and a Python one, exactly
as at widget 23.

### CELL 60 IS AS COMPLETE AS CELL 52 WAS

- **the algorithm in five numbered steps**, introducing three kinds of point
  rather than one: count the neighbours within `eps`; at least `min_samples` of
  them makes a **core point**; core points within `eps` of each other join one
  cluster; a non-core point within `eps` of a core point is a **border point**;
  anything else is **noise**, labelled `-1`
- **two parameters and no K**: `eps` ("typically 0.5 – 5 on scaled data") and
  `min_samples`, which cell 60 is careful to say counts **the point itself**
- **a strengths and limitations table**, and both halves are live:
  - strengths: no K in advance · clusters of arbitrary shape · noise found automatically
  - limitations: *"Sensitive to choice of parameters"* · *"degrade in high-dimensional data"* · *"Varying densities can cause clusters to be merged or split incorrectly"*

### THE DIAGRAM, AND WHAT IT DECIDES

Two panels — **Data**, a red arrow, **Assign points ≤ eps** — then two dotted
arrows fanning out of the second panel to two named verdicts. Its notation, in
the order a builder needs it:

| it draws | so the widget must |
|---|---|
| points as **dots, all black** in panel 1 | start uncoloured. Same opening as cell 52's diagram, and the arc already agrees: the data has no colours of its own |
| a **grey disc on EVERY point** in panel 2, not on a selected one | draw `eps` as a disc per point. It is the first drawable parameter in the arc — K never could be |
| the discs **overlapping** inside each group and standing alone at the lone point | draw them translucent and under the dots. **The overlap is the whole algorithm**: it is what "within `eps` of each other" looks like |
| one point left **black**, labelled *Noise (< min samples)* | noise is what never gained a colour — and see § THREE KINDS OF POINT, because this collides with an existing token |
| two groups **coloured** red and blue, labelled *Cluster (≥ min samples)* | cluster colours from the six in `tokens.css` |
| both verdicts named with **their rule in parentheses** | the caption names the count rule, not a verdict word alone. Principle 2.9 already wants this |
| bare L-shaped axes, no ticks, no numbers | the coordinates are not the point. Widgets 19–23 agree |

**The diagram draws TWO outcomes and the text describes THREE.** Border points
are step 4 of the numbered list and appear nowhere in the picture. That gap is
the widget's one real drawing decision and it is put to Kenneth below.

**And the loop that cell 52 had is not here.** K-Means' diagram has a red arrow
from Update back to Assign, which became the Iterate button. DBSCAN has no
outer loop at all — but it has an inner one the diagram does not draw, and
`dbscan()` returns it: a cluster **grows one hop at a time** from the point that
seeded it, through the chain of overlapping discs. Measured at an `eps` that
works, that growth is 11–14 beats on four blobs and **[4, 10] on two rings** —
the outer ring crawling around itself ten hops — which is the best animation
available here and the one thing that makes `eps` legible as a *reach* rather
than a setting.

### QUESTION 1: COMPUTE AT RUNTIME — and so can a whole sweep

| n | eps | ms per fit | clusters |
|---|---|---|---|
| 48 | 0.30 | **0.026 ms** | 4 |
| 48 | 0.55 | 0.024 ms | 3 |
| 96 | 0.25 | 0.039 ms | 4 |
| 150 | 0.20 | 0.061 ms | 5 |
| 300 | 0.15 | 0.156 ms | 5 |

**A 60-step sweep of `eps` costs 0.86 ms and a 120-step sweep 1.62 ms**, against
widget 23's whole K = 1…8 sweep at 1.24 ms. So the panel that closed widget 23's
question 2 has an exact counterpart here that is equally affordable: **the
cluster count plotted against every `eps`, live, on every render.** Whether it
should ship is a different question — widget 23 built that panel twice and cut
it twice — but it is not blocked by cost.

### THE ENGINE IS THE LIBRARY'S — exactly, and with nothing to reconcile

Thirteen fixtures spanning all four stages, `eps` below / inside / above the
useful range, `min_samples` at 3, 4 and 5, and 3-D and UMAP output as well as
2-D. Against **sklearn 1.9.0**:

| what | agreement |
|---|---|
| labels, **as integers** and not merely as a partition | **identical on all 13**, point for point |
| `core_sample_indices_` | **identical on all 13** |
| silhouette, both readings | ≤ **1.9e-15** |
| ARI | ≤ 1.1e-16 |

**Stricter than widget 23's, because there is less to get right.** K-Means had an
initialisation and a tolerance to reconcile; DBSCAN has no seed anywhere, so the
same points and the same two parameters either agree point for point or one
engine is wrong. Two details still had to be deliberate:

- **the point is its own neighbour.** `min_samples` counts it — cell 60 says so —
  and getting it wrong shifts every core/border verdict by one, which reads as a
  tuning difference rather than a bug.
- **the traversal is copied, including the arbitrary part.** A border point
  within `eps` of two clusters has no principled owner; it goes to whichever
  cluster reaches it first, and "first" is sklearn's outer loop in index order
  plus a **LIFO stack**. `dbscan()` runs that stack for the labels and a separate
  breadth-first pass for the drawing, so the picture can be a growing front
  while the answer stays byte-identical.

### QUESTION 2: THE ONE SENTENCE — the candidate fires, and something sharper is under it

The reconnaissance's candidate was *DBSCAN does not make you choose K; it makes
you choose a radius instead, and the radius decides how many clusters you get* —
and it said outright that this had to be **measured**, because if a wide sweep of
`eps` gave the same count the sentence was wrong. It does not. On four blobs of
twelve, `min_samples` = 4:

| eps | clusters | core | border | noise | what a reader sees |
|---|---|---|---|---|---|
| 0.10 | 1 | 2 | 3 | 43 | none of the four groups |
| 0.15 | 3 | 13 | 4 | 31 | 1 of 4 |
| 0.20 | **4** | 20 | 6 | 22 | **2 of 4 — the right COUNT, the wrong answer** |
| 0.25 | 4 | 25 | 9 | 14 | 3 of 4 |
| **0.30** | **4** | **32** | **11** | **5** | **all four** |
| 0.40 | 4 | 46 | 2 | 0 | all four |
| 0.50 | 4 | 47 | 1 | 0 | all four |
| 0.60 | 3 | 48 | 0 | 0 | 3 of 4 |
| 0.80 | 1 | 48 | 0 | 0 | 1 of 4 |

**The count moves, it is not monotone, and the right count is not the right
answer.** Over 20 seeds the count passes through the truth on 27.6% of the `eps`
range for blobs, 20.9% for rings and **5.0% for moons** — so "does not require
specifying the number of clusters in advance" is true only in the sense that the
choice has been **moved**, not removed. On rings the count runs 0 → 2 → 1 → 2 →
4 → 1 as `eps` rises: **the same count arrives twice from different radii, with
different answers behind it.**

**And the second half, which is the finding of this session.** Widget 23's honest
boundary was *the objective cannot choose K, but the silhouette can* — it peaks
at the true K on 5 of 5 seeds. Asked the same question here, over 20 seeds:

| stage | eps the silhouette picks | an eps that works | it lands |
|---|---|---|---|
| blobs | 0.14 ± 0.03 | 0.29 ± 0.03 | **0 / 20** |
| rings | 0.27 ± 0.01 | 0.35 ± 0.01 | **0 / 20** |
| moons | 0.18 ± 0.03 | 0.33 ± 0.02 | **0 / 15** |

**Nought of fifty-five, and biased in a direction that can be explained.** The
mechanism is in the table above: at `eps` 0.18 on blobs, 22 of 48 points are
noise and the silhouette of what remains is **0.856** — the highest anywhere on
the sweep, higher than the 0.740 at the `eps` that is actually right. **Throwing
points away makes what is left look tighter**, and the silhouette scores only
what is left. So it always prefers a radius that is too small.

> **The candidate sentence, with the measurement's second clause attached:**
>
> **DBSCAN does not make you choose how many clusters there are. It makes you
> choose a radius, the radius decides how many you get — and the number you can
> compute from the picture prefers a radius that is too small.**

That is the arc's fifth one-sentence claim and it inverts widget 23's rather than
repeating it: there, the check that works has to come from outside the thing
being minimised, and the silhouette was that check. Here the silhouette is
*inside* the thing being chosen, because `eps` decides which points get scored.

### THE TWO NOISE TRAPS, AND ONE OF THEM WAS NOT PREDICTED

The reconnaissance flagged one: cell 67 prints `silhouette_score(X_umap,
db_labels)` with `-1` still in the labels, so **sklearn scores noise as if it
were one cluster** scattered over the whole plane. Measured, the gap is large and
it is not a constant:

| stage | eps | noise | as cell 67 prints it | noise dropped | gap |
|---|---|---|---|---|---|
| blobs | 0.18 | 22 | 0.157 | **0.856** | 0.699 |
| blobs | 0.35 | 1 | 0.621 | 0.740 | 0.119 |
| moons | 0.18 | 40 | −0.016 | **0.934** | 0.951 |
| cloud | 0.25 | 30 | 0.025 | 0.710 | 0.685 |
| varying | 0.35 | 0 | 0.885 | 0.885 | 0.000 |

**So widget 23's silhouette tile and widget 24's are not comparable unless the
widget says which reading it prints** — the gap runs from 0.000 to 0.951 with the
noise count, which is precisely the thing that changes as a reader drags `eps`.

**The second trap was not predicted and it is worse.** `adjusted_rand_score`
treats `-1` as one more label, so a whole true group declared noise counts as a
whole true group correctly separated. On hand-built labelings of 48 points in two
true groups of 24:

| what DBSCAN returned | cell 67's ARI | noise split into singletons |
|---|---|---|
| both groups found as clusters | 1.000 | 1.000 |
| **ONE found, the other ALL NOISE** | **1.000** | **0.505** |
| one found, the other in 2 pieces | 0.743 | 0.743 |
| both found, 6 points left noise | 0.759 | 0.765 |
| both merged into one cluster | 0.000 | 0.000 |

**A run that found one of two cancer subtypes and threw the other away scores
exactly as well as a run that found both**, and widget 23 prints that tile
unchanged. The correction is one line — count each noise point as its own
singleton, which is what `-1` means — and it **moves the number only where the
number was lying**: 1.000 → 0.505 on the case that deserves it, 0.759 → 0.765 on
the case that does not. It is `adjustedRandNoiseAware` in the engine.

> ***Earned, three times in one session.*** This was not found by reasoning about
> the metric. It was found because **three stages built for this plan passed for
> the wrong reason**: the first `rings` had unequal density, so DBSCAN "solved"
> it by clustering the inner ring and calling the entire outer ring noise —
> scored 1.000. The first `varying` had two groups, so "cluster the tight one,
> noise the loose one" scored 1.000. Both looked like successes. **A stage that
> can be passed for the wrong reason is not a stage, and a criterion that can be
> gamed measures nothing** — which is why every table in this section is scored
> by `recovered()`, a blunt verdict that asks whether each true group actually
> came back as a cluster, and not by any index at all.

### QUESTION 3: WHICH FAILURE — and this is the first widget in the arc with a STRENGTH to show

Widgets 19–23 each demonstrated a limitation. DBSCAN is the first method in the
arc that does something the previous widget could not, and `widgets/kmeans/
model.js` is importable, so the comparison runs both engines on **byte-identical
points**. K-Means gets K = the true number and ten restarts — its best case:

| stage | K-Means ARI | groups recovered | DBSCAN ARI | groups recovered |
|---|---|---|---|---|
| blobs 4 × 12 | 0.997 ± 0.013 | 20 / 20 | 0.993 ± 0.015 | 20 / 20 |
| **rings** | **−0.016 ± 0.001** | **0 / 20** | **1.000 ± 0.000** | **20 / 20** |
| moons | 0.220 ± 0.034 | 20 / 20 * | 0.833 ± 0.182 | 15 / 20 |
| varying (ratio 1) | 1.000 ± 0.000 | 20 / 20 | 1.000 ± 0.000 | 20 / 20 |

\* *moons is the one row where `recovered()` and the ARI disagree about K-Means,
and the ARI is right: a 60%-plurality rule is too generous when two crescents
are cut across the middle. The ARI of 0.220 is what to quote.*

**On rings, K-Means scores below chance on every one of 20 seeds and DBSCAN is
exact on every one of 20.** That is the cleanest head-to-head this collection
has produced, it needs no caveat, and it is the notebook's own first strength —
*"Can find clusters of arbitrary shape"* — with a number on it.

**And the failing case that is DBSCAN's own**, cell 60's third limitation. Two
tight blobs close together and one loose blob away from both, so the two blades
of the scissors are on the stage at once; `ratio` is how much wider the loose one
is; 30 stage seeds each; and the search is over the **whole** `eps` range, so a
failure is the method's and not the tuning's:

| ratio | some eps recovers all three | best noise-aware ARI | width of the working eps band |
|---|---|---|---|
| 1.0 | 30 / 30 | 1.000 ± 0.000 | 0.233 |
| 2.0 | 30 / 30 | 0.994 ± 0.013 | 0.182 |
| 3.0 | 28 / 30 | 0.953 ± 0.054 | 0.128 |
| 4.0 | 22 / 30 | 0.896 ± 0.075 | 0.090 |
| 5.0 | 14 / 30 | 0.838 ± 0.073 | 0.070 |
| 6.0 | **8 / 30** | 0.797 ± 0.067 | 0.061 |
| 8.0 | **3 / 30** | 0.758 ± 0.049 | 0.015 |

**Two things get worse at once and both are true**: the answer degrades, and the
band of `eps` that still works narrows from 0.233 to 0.015. And the scissors is
visible on one seed at ratio 6 — there is no radius that does both jobs:

| eps | the two tight blobs | the loose blob |
|---|---|---|
| 0.08 – 0.12 | separate | **ALL NOISE** |
| 0.16 – 0.28 | separate | 1–2 pieces, 3–12 noise |
| **0.32** | **MERGED into one** | 2 pieces, 3 noise |
| 0.40 – 0.84 | **MERGED into one** | whole, 0 noise |

**`min_samples` is the second knob and it matters exactly where the shape is not
round.** At an `eps` that works: on blobs every value from 2 to 8 recovers all
four groups and 9–10 only start shedding points; on **rings** only 2–4 work and 5
already breaks it; on **moons** only 4–5 work, 3 merges the two crescents into
one and 6 shatters them into noise. So it is a real control on the stages where
the strength lives and a no-op on the stage widget 23 used.

**The k-distance knee — the textbook cure — is only half a cure here.** Taking
the knee of the sorted 4-distance curve recovers everything on 16/20 blobs seeds
and 20/20 varying seeds, but **5/20 on rings and 5/20 on moons**: it reads
0.308 ± 0.042 where 0.474 ± 0.010 is needed. It works where you did not need it.

### QUESTION 4: WHICH SPACE — it does NOT fire, and that is the answer

Widget 23 measured that clustering the 2-D picture instead of the data changes
the answer on 11 of 20 runs at four groups and 19 of 20 at six, **named this
widget as question 4's host**, and kept itself flat. Re-asked of a density
method on the same sphere stage, best `eps` in each space, 10 seeds:

| groups | best in 3-D | best in the UMAP picture | the two answers differ |
|---|---|---|---|
| 2 × 24 | 1.000 ± 0.000 | 1.000 ± 0.000 | **0 / 10** |
| 3 × 16 | 1.000 ± 0.000 | 1.000 ± 0.000 | **0 / 10** |
| 4 × 12 | 1.000 ± 0.000 | 1.000 ± 0.000 | **0 / 10** |
| 6 × 8 | 0.990 ± 0.018 | 0.982 ± 0.030 | 2 / 10 |

**It does not fire, and the reason is not an accident.** UMAP's objective is to
preserve local neighbourhoods, and local neighbourhoods are the entire input to
DBSCAN — so `UMAP → DBSCAN` is a well-matched pipeline in a way `PCA → K-Means`
is not. Cell 51's two named workflows are not equally safe, and the widget could
say so; but **question 4 has no host in widget 24 either, and should stop being
carried forward as an open item.** Widget 23's numbers stand and are the record.

**The related question that DOES exist here was measured and is weak.** UMAP a
structureless cloud, then DBSCAN the picture, choosing `eps` the way a reader
would — by maximising the only number visible:

| what went in | clusters found | noise | silhouette |
|---|---|---|---|
| a cloud, no groups at all | 2.4 ± 0.7 | 38.1 ± 2.6 | 0.904 ± 0.075 |
| 4 real groups | 2.4 ± 0.7 | 34.8 ± 11.4 | 0.968 ± 0.030 |

The cloud scores 93% of what real structure scores — but **both runs are
degenerate**, leaving 35–38 of 48 points as noise, which is the § QUESTION 2
silhouette bias showing up again rather than an independent finding. It is
support, not a headline, and t-SNE's version of this demonstration is better.

### 48 SAMPLES CARRIES A DENSITY METHOD — checked, because it might not have

Every widget in this arc stages 48 points, and a method that estimates density
could plausibly have needed more. Share of 20 seeds where some `eps` recovers
every true group:

| stage | n=32 | n=48 | n=64 | n=96 | n=144 |
|---|---|---|---|---|---|
| blobs | 20/20 | **20/20** | 20/20 | 20/20 | 20/20 |
| rings | 20/20 | **20/20** | 20/20 | 20/20 | 20/20 |
| moons | 19/20 | **19/20** | 20/20 | 20/20 | 20/20 |
| varying | 20/20 | **20/20** | 20/20 | 20/20 | 20/20 |

The arc's stage size holds. Moons is the only one that would gain from 64.

### THREE KINDS OF POINT, AND THE TOKEN QUESTION THE RECONNAISSANCE PREDICTED

`tokens.css` defines six cluster colours and `--c-unknown`, which its own comment
scopes precisely: *"not measured yet, not a third outcome"*. **Noise is exactly
the third outcome that comment excludes** — it is a verdict, not an absence.

And the widget needs **both roles in the same figure**, which is the part that
makes this a real problem rather than a naming one. The diagram's first panel is
every dot uncoloured — nothing has been decided — and that is `--c-unknown`. The
last panel has noise in it. If noise is also grey, a reader cannot tell *not yet
decided* from *decided: no cluster*, and those are the widget's two most
important states.

Three candidate resolutions, none measured, all cheap to mock up:

1. **`--c-noise` as a new colour role.** Honest, and the tokens file's own
   precedent (`--c-holdout` was added rather than borrowed) supports adding
   rather than aliasing.
2. **Same grey, different mark** — a filled dot for undecided, an open ring or a
   small × for noise. This is closest to the diagram, where the noise point is
   simply the dot that never gained a colour.
3. **Border points get the third mark instead**, and noise stays grey. The
   diagram does not draw border points at all, so nothing is inherited here.

The three kinds also need a mark grammar, and there are only two natural axes —
fill and outline. The obvious assignment is **core = filled in the cluster
colour, border = the cluster colour as a ring on an unfilled dot, noise = grey**,
which says "border belongs to this cluster but did not build it" without a word.

### THE SHAPE OF IT

- **one stage**, one plot, dots and discs, replaying the growth
- **`eps`** — the widget. A slider; the useful range across all four stages is
  0.05 – 0.90 and every value in it paints something. On `blobs` the default
  wants to be **0.30**: the only setting where all three kinds of point are on
  screen at once (32 core, 11 border, 5 noise) *and* the answer is right, where
  0.40 is also right but has 2 border points and 0 noise and so hides two thirds
  of the lesson. **The same measurement has not been made for `rings`, which is
  now the default stage** — its working band is 0.35 – 0.60 and the equivalent
  all-three-kinds-visible value is the first thing to measure at build time
- **`min_samples`** — an int, 2–10. A no-op on blobs and decisive on rings and
  moons, which is a reason to pair it with the stage control rather than ship it
  alone
- **`shape`** — `rings` (default) and `blobs`, settled by Kenneth on 2026-08-26.
  `moons` and `varying` are built and measured but held back; each is one more
  option and no new machinery
- **`seed`** — free here, and genuinely free: DBSCAN has no initialisation, so
  unlike widget 23 there is no second `start` control hiding behind it
- **`labels`** — display-only, off by default, non-negotiable 4. It keeps
  **widget 23's outer ring unchanged**, which grammar G is chosen partly to
  afford: border is carried by opacity rather than by the ring, so nothing had
  to be invented here
- **the drive**: no outer loop to iterate, so the beats are *place the discs* →
  *mark the core points* → *grow each cluster, one hop at a time*. Measured at
  11–14 beats on blobs and 14–25 on rings and moons
- **readout**: clusters found, points called noise, and the silhouette — with the
  ARI **corrected** per § THE TWO NOISE TRAPS or dropped, but not carried over
  from widget 23 unchanged

### TWO CALLS SETTLED BY KENNETH, 2026-08-26

**1. `rings` is the default stage, with `blobs` one click away.** A `shape`
control with two options and nothing else. The reasoning is the measurement:
`rings` is the only place in the arc where the new method does something the
previous one cannot — K-Means **−0.016 ± 0.001 on 20 of 20 seeds**, DBSCAN
**1.000 ± 0.000 on 20 of 20** — and it is also where the growth animation is
best, the outer ring crawling around itself in **10 hops** while the inner takes
4. `blobs` is widget 23's own stage point for point, so the two clustering
widgets stay comparable.

**`moons` and `varying` are built, verified and measured but do NOT ship in the
first build.** Adding either later is one more option on `shape` and no new
machinery — the same shape the `shape` control took at widget 23, and the same
reason: a widget teaches one thing. `varying` is the first to add if there is
room, because it is DBSCAN's own failing case and the widget currently shows a
strength without one.

**2. The one sentence takes both clauses:**

> **DBSCAN does not make you choose how many clusters there are. It makes you
> choose a radius, the radius decides how many you get — and the number you can
> compute from the picture prefers a radius that is too small.**

The second clause is the session's strongest finding (**0 of 55**) and it inverts
widget 23 rather than repeating it: there, the check that works had to come from
outside the thing being minimised, and the silhouette was that check. Here the
silhouette is *inside* the thing being chosen, because `eps` decides which points
get scored at all.

**One consequence for the build, and it is not free.** The claim's second clause
is about a number, so that number has to be **on screen and moving** as `eps`
moves — a silhouette tile alone will not carry it, because a reader dragging a
slider sees one value at a time and the claim is about where the maximum is. The
§ QUESTION 1 sweep panel (1.62 ms, affordable) is the obvious answer and it is
also the panel widget 23 built twice and cut twice. **Read § REVIEW ROUND 2 of
widget 23 before proposing it**, and note that the objection there — *it asks the
reader to hold two things at once* — is weaker here, because the panel would be
plotting the very quantity the sentence is about rather than a second opinion
about the answer.

### THE STAGE DECISION HAS A CONSEQUENCE, MEASURED AFTER IT WAS TAKEN

**`rings` cannot show the three kinds of point, and no tuning fixes it.** The
default-`eps` measurement in § QUESTION 2 was made on `blobs`; repeated on
`rings`, which is now the opening stage, it says something different:

| eps | clusters | core | border | noise | hops | what a reader sees |
|---|---|---|---|---|---|---|
| 0.28 | 4 | 8 | 11 | 29 | [3,3,3,3] | neither ring |
| 0.32 | 7 | 22 | 15 | 11 | [5,4,3,3,3,4,3] | 1 of 2 |
| 0.36 | 3 | 45 | 3 | 0 | [5,10,8] | **both rings** |
| **0.40** | **2** | **48** | **0** | **0** | **[4, 10]** | **both rings** |
| 0.50 | 2 | 48 | 0 | 0 | [3, 9] | both rings |
| 0.65 | 1 | 48 | 0 | 0 | [6] | 1 of 2 |

**At every `eps` that recovers both rings, there are 0 border points and 0 noise
points** — over 20 seeds, only 5 have any `eps` at all where both rings come back
*and* all three kinds of point are on screen, and the best single value qualifies
on 3 of 20.

**The cause is structural and it is the same fact as the strength.** A ring is a
near-uniform chain, so every point sits at nearly the same 4th-nearest-neighbour
distance — and as `eps` crosses that distance, *every* point becomes core at
once. Border and noise points require local density to VARY, and a ring has no
variation by construction. That uniformity is exactly what makes the two rings
separable at all.

**Scattering extra points over the disc does not fix it, measured both ways.**
Taking the scatter out of the rings' 48 thins them and breaks the connectivity
the stage exists to show (best case 7 of 20 seeds); adding it on top at n = 50–56
fails differently, because the `eps` at which the two rings connect is *above*
the `eps` at which a scattered point near a ring is absorbed — so by the time
both rings work, the scatter has been absorbed too (0–1 of 20 seeds at every
count from 2 to 8).

**So the two stages carry two halves of the lesson and cannot be merged:**

| | `rings` | `blobs` |
|---|---|---|
| arbitrary shape, against K-Means | **the whole point** — −0.016 vs 1.000 | ties, 0.997 vs 0.993 |
| core / border / noise all on screen | **never**, at any working `eps` | at `eps` 0.30: 32 / 11 / 5 |
| the growth animation | **[4, 10] — a ring crawling round itself** | [4,3,3,2] |
| cell 60's third strength, *finds noise automatically* | cannot show it | shows it |

**This does not overturn the call to open on `rings`** — it is one click to
`blobs`, and the strength is the reason the widget exists next to widget 23. But
the diagram's entire second panel is the three verdicts, and on `rings` the
opening screen has only two of them. **Worth one look before building**: opening
on `blobs` puts the diagram's own picture first and moves the strength one click
away, which is the same trade in the other direction.

### THE MARKS MOCK-UP IS BUILT — `_lab/dbscan-marks.html`

**Seven candidate grammars, drawn by the shipping engine on the real 550&nbsp;px
canvas at the real 4.6&nbsp;px radius, on both stages, with `labels` off and
on.** Ink is counted off an offscreen canvas rather than reasoned about. Open it
with `node scripts/serve.mjs 8010` at
`/widgets/_lab/dbscan-marks.html`; it needs no interaction and auto-draws.

| | grammar | border vs core, real | at projector size |
|---|---|---|---|
| A | the diagram's own — border not drawn | — | — |
| B | + a new `--c-noise`, border still not drawn | — | — |
| C | core filled, border hollow, noise a grey cross | 36% | **9%** |
| D | as C, noise a hollow grey ring | 36% | **9%** |
| E | border at 0.62 the radius | 65% | **67%** |
| F | border takes the outer ring | 244% | 427% |
| **G** | **border at 45% opacity, full size** | **98%** | **97%** |

**Four fail on the numbers rather than on taste.** A's noise is **0% distinct
from `--c-unknown`** — the same grey circle, which is the token argument with a
number on it. F draws border at **148% of core's ink**, so the weaker membership
is the louder mark, and it spends the ring. D is the weakest on noise (36% from
undecided). And C and D fail in the way that matters most, below.

**THE MEASUREMENT THAT REVERSED THE PAGE, and it was not in the first version.**
Every mark was originally scored against *undecided*, which is the right
question for noise and the wrong one for **border** — border's job is to be told
apart from **core**. Added, and measured at both radii:

> **Stroke width is not scale-invariant, so a hollow mark converges on its
> filled twin as the figure shrinks.** A 1.9&nbsp;px stroke on a 2.6&nbsp;px dot
> has closed the hole. C and D read correctly at 4.6&nbsp;px (36% distinct) and
> collapse to **9%** at projector size: core and border become the same mark
> exactly where legibility is already worst.

**Size and opacity are the two channels that survive**, because both scale with
the mark. E holds at 65% → 67% but pays for it — border is **9 pixels** at
projector size against core's 23. **G was added after E's result** to ask
whether the scale-invariant channel has to cost area, and it does not: border
keeps **99% of core's ink** and stays **97% distinct** from it, in both themes.

### G, AND KENNETH TOOK IT ON 2026-08-26

**The mark grammar, in full, and this is what `main.js` implements:**

| state | mark |
|---|---|
| **undecided** — nothing has run | filled `--c-unknown`, full radius. Cell 60's first panel |
| **core** — at least `min_samples` within `eps` | filled in the cluster colour, full radius |
| **border** — in a cluster, did not build it | the **same** cluster colour, **same** radius, **45% opacity** |
| **noise** — in no cluster | a cross in `--ink-3` |
| **true group**, when `labels` is on | the outer ring, **unchanged from widget 23** |

**No new token.** `--c-noise` was candidate B's ask and G does not need it: noise
is a *shape* here, not a colour, so `--c-unknown`'s comment stays true and
nothing is added to `tokens.css`.

**And the widget draws all three kinds cell 60 names**, which was the real
question underneath the shortlist. B would have drawn two.

**The rule a reader learns is one sentence**: *solid built this cluster, faint
only joined it, a cross belongs to none.*

**One thing to check while building, seen in the swatches and not measured.**
With `labels` on, a 45%-opacity dot inside a full-strength truth ring lets the
ring dominate — a border point can read as an empty ring rather than as a faint
dot. It is the one combination on the page where G is not obviously best, it
appears only when the reader turns the true groups on, and the fix if it is real
is the ring's weight rather than the dot's. **Look at the `labels` ON figure at
550px before baselining anything.**

**Two things the page found that are not about marks:**

- **The `eps` disc must be `--ink-3` at low alpha, never `--grid`.** `--grid` is
  a hairline colour chosen to be nearly invisible — #e1e0d9 on a #fcfcfb surface,
  #2c2c2a on a #1a1a19 one — and the disc vanished outright in dark mode.
  `--ink-3` is #898781 in *both* themes, so a low-alpha fill lands mid-grey
  against either. Found by reading pixels, not by looking.
- **Drawing the disc on all 48 points at once is a grey field, not a picture.**
  At a working `eps` the discs cover most of the plot and merge. Cell 60's
  diagram gets away with it because it has seven points. **The widget probably
  wants the disc on the growth frontier rather than on everything** — which is
  also what makes `eps` read as a reach rather than a wash. Not settled here.

### THE ARI TILE IS CORRECTED, SILENTLY — Kenneth, 2026-08-26

**One tile, computed by `adjustedRandNoiseAware`, and the trap is not named on
screen.** Each noise point is counted as its own singleton, which is what `-1`
means: not grouped with anything.

| what DBSCAN returned | cell 67's ARI | the tile this widget prints |
|---|---|---|
| both groups found as clusters | 1.000 | 1.000 |
| **ONE found, the other ALL NOISE** | **1.000** | **0.505** |
| both found, 6 points left as noise | 0.759 | 0.765 |
| both merged into one cluster | 0.000 | 0.000 |

**The correction moves the number only where the number was lying**, which is
what makes it a correction rather than a different metric — and is the whole
reason it can be made without a word on screen. A reader who never learns there
was a trap still gets an honest number, and the tile stays comparable in kind
with widget 23's, which is the point of having it at all.

**The two rejected options are recorded because each was arguable.** Printing
both readings makes the gap between them the lesson and it moves live as `eps`
moves — but it spends a tile on a rail that is already the widest thing in the
widget, and asks a reader to hold two numbers where the widget's own sentence is
about a third one (the silhouette). Dropping it avoids the trap by not walking
into it, and loses the direct comparison with the widget sitting next to it on
the gallery.

**Consequence for widget 23, and it is not a bug there.** `widgets/kmeans/`
prints the uncorrected ARI and is right to: K-Means never returns noise, so the
two readings are identical on every input it can produce. But **the two widgets
sit side by side and a reader comparing the two numbers is comparing different
computations.** Nothing needs changing; it needs knowing. If widget 23 is ever
touched again, importing `adjustedRandNoiseAware` would make them literally the
same function at zero cost to its numbers.

### REVIEW ROUND 1 — Kenneth, 2026-08-27, and one note was a design fault

Three notes on the first build: could it have a shape selector and controls for
the number of clusters and samples like the other widgets; the search animation
could be improved, with the dashed reach thin and hard to see; and — *"I was
playing with the eps radius and couldn't dynamically see its effect."*

**1. The third note was a fault rather than a preference.** `eps` is a data
parameter, so changing it re-initialised the animation, which reset the disc
tween to 0 — **the discs vanished, and the widget's single most important
slider moved with nothing on screen responding to it.** The lead button *was*
"Draw the reach", which is what made that possible: the reach had been modelled
as a beat you PERFORM.

> **The discs are a picture of the PARAMETER, not of the answer, so they are
> drawn always.** Cell 60's step 1 — count the neighbours within eps — needs no
> press; it is what the slider already says. The lead is now **"Mark the core
> points"**, which is step 2 and the first actual verdict.

Principle 4 is untouched: no cluster appears until something is pressed. What
changed is that dragging `eps` is now a thing a reader can watch — the discs
resize and the caption counts the core points live, **0 / 0 / 36 / 48** across
eps 0.20 / 0.30 / 0.40 / 0.55, with nothing pressed at all.

**2. The stage controls, and one of them is deliberately not "per group".**

| control | options | note |
|---|---|---|
| `shape` | `rings` · `moons` · `blobs` | `moons` promoted from the held-back list |
| `samples` | 48 · 96 · 150, **a total** | see below |
| `groups` | 2 · 3 · 4 · 6, **`blobs` only** | `when: { param: "shape", equals: "blobs" }` — two rings are two rings, and a control claiming otherwise would be a lie about the data |

**`moons` earns its place on a measurement.** At 48 points and the default `eps`
0.40 it is the best stage in the widget for the mark grammar: **2 clusters, 2/2
recovered, 36 core, 11 border, 1 noise** — all four marks live *and* the answer
right, which `rings` cannot do at any radius.

**`samples` is a TOTAL where widget 23's is per group.** `rings` defines its
count as a total by construction — `model.js` records why: an equal count on
rings of different circumference is secretly a varying-density stage — and
`blobs` splits its by group. One "per group" number cannot give 48 on both, and
**48 is the size every measurement in this section was taken at.**

**24 was offered for one build and withdrawn.** Swept across the whole
0.10–0.80 range: at 24 points there is **no `eps` at all** that recovers `rings`
or `moons`. A stage option that cannot work at any setting is a trap rather than
a lesson — the reader gets a screen of noise and no way out. 48 is the floor,
which is § 48 SAMPLES CARRIES A DENSITY METHOD arriving from the other side.

**3. The reach mark is fixed; the hop choreography goes back to Kenneth.**
`widgets/_lab/dbscan-reach.html` draws seven reach marks and four hop
choreographies at the real 550px canvas, and measures the first set: **contrast
is the mean channel distance between the ring's own pixels and the wash beside
it**, sampled every degree around the circle.

| mark | contrast | |
|---|---|---|
| dashed, 1.5px — **as shipped** | **89** | the baseline |
| solid 2.2px | 195 | 2.2× |
| **tint only, no outline** | **33** | **worse than the dashed line** |
| filled + outlined | 204 | 2.3× |
| **haloed outline** | **214** | **2.4× — taken** |
| haloed + filled + outlined | 214 | no better than plain haloed |
| haloed + wash cut away inside | 214 | no better either |

**The dashed ring was the one mark in this collection not laying a surface
stroke underneath itself** — the trick every other mark here already uses, so a
mark never has to win a contrast fight it did not pick. Applied, because it is
strictly better at no cost. **The tint-only row is the one worth keeping**:
filling a region the grey wash already fills adds no edge, and reads worse than
the thin line it would replace.

**The hop is NOT applied and is Kenneth's call.** Four choreographies are on the
page, live and as a filmstrip — the strip is there because motion cannot be
reviewed one frame at a time and the automation browser throttles
`requestAnimationFrame` to about three frames a second. The interesting one is
**2, the sweep**: the ring grows from the source point out to `eps` over the
first 60% of the beat, and each arriving point takes its colour as the expanding
edge passes it — which makes `eps` **a distance the cluster travels** rather
than a number in a slider. Its risk is pace: at Play's 330 ms a sweep may read
as a flicker, and the page has a toggle to watch it at both.

### THE SWEEP — built, shipped for one round, replaced

Candidate 2 of the reach mock-up: the ring grew in place from the source point
out to `eps` over the first 62% of a beat, and each arriving point took the
cluster colour once the expanding edge passed it. **Review round 2 below
replaced it with a point-by-point walk**, so the choreography is gone and only
two things from it are worth keeping.

**The sweep was per BFS LAYER, and that is why it failed** — see round 2.

**And hand-pumping `requestAnimationFrame` caught a bug nothing else could.**
`draw` read `pace.sweep` with `pace` never declared in `draw`. That
`ReferenceError` fires *only* on a grow beat with `layer > 0` at a sweeping
speed — so every settled state, every `?shown=N` link and the first hop of
every cluster sail straight past it, and it threw on the first hand-pumped
frame. The suite's *settled states are no test of an animation* rule, earning
itself one widget later, and the reason this widget's driven states are the
shape they are.

### REVIEW ROUND 2 — the sweep was the wrong animation, and three reports said so

Kenneth on the shipped sweep, 2026-08-27: he expected the ring to **tween and
move to the next one**; asked **why multiple rings are highlighted when he
thought it was one at a time**; and asked **what happened to the spiderweb links
to the nearby points being considered**. Plus: the eps radii on load are
distracting and want a toggle.

**The first three are one report, and it is not a tuning note.** The sweep grew
one ring in place per **BFS layer** — so four rings were live at once, none of
them moved, and nothing showed a neighbourhood being counted. That is a growth
**front**, and a front is not what DBSCAN does. `dbscan_inner` pops **one point**
at a time, looks at its neighbourhood, and pushes what is new. The widget was
drawing a defensible abstraction of the algorithm instead of the algorithm, and
three separate "why does it do that" questions is what that costs.

> **One beat is now one point being examined.**
>
> ```
> 0.00 - 0.44   the disc TRAVELS from the point just examined to this one
> 0.38 - 0.74   spokes grow from it to every point inside the disc
> 0.62 - 1.00   the ones it pulls in take the cluster colour
> ```
>
> **The order is the argument**: the disc arrives before it can see anything, it
> sees before it claims, and it claims last.

**Border points are pulled in but never examined.** They cannot extend a
cluster — that is what makes them border points — and giving them a beat would
say the opposite.

**The spokes draw EVERY point inside the disc, not just the new ones.** A reader
watching a point be examined is watching it *count*, and the ones already taken
still counted toward the verdict that made this point core. Drawing only the new
ones would show fewer spokes than the caption's number.

**The walk order is the layers', flattened; the labels stay the stack's.**
`model.js` already keeps both and records why. Flattened layers give a disc that
crawls outward from the seed; the LIFO stack would send it jumping back and
forth across ground it has already covered — true to the source and useless to
watch. The answer is byte-identical either way.

**Cost, and it is real**: the default stage went from 14 beats to **36**, one per
core point. Pacing was re-cut to suit (Slow 620 ms, Medium 300, Fast 105, one
press of *Next point* 900), and a **progress counter** was added — *"Cluster 2/2
· core point 7/28"* — because a 36-beat walk with nothing showing is a reader
wondering whether it has stalled.

**Verified by hand-pumping `requestAnimationFrame`**, one Slow beat:

| frame | 1 | 3 | 5 | 7 | 10 |
|---|---|---|---|---|---|
| discs on screen | 1 | 1 | 1 | 1 | 1 |
| disc centre | 407,228 | 402,219 | 388,195 | 381,183 | 381,183 |
| spoke segments | 0 | 0 | 0 | **4** | 4 |
| dots drawn | 48 | 48 | 48 | 48 | **50** |

**One disc throughout, its centre travelling, spokes only after it arrives, and
points joining only after the spokes.** At Fast: **0 frames with spokes** and
never more than one disc — the same "drop the working, keep the states" call
widget 23's Fast makes.

**And the eps discs are now a toggle, defaulting OFF.** At a working radius
every point carries one, so the wash is the largest thing on the figure and it
competes with the single disc that is doing the work. **This trades against
review round 1**, where the discs were made permanent precisely so dragging
`eps` had something to move; what moves now is the caption's live core count and
the travelling disc. **If that is too little, the fix is this one default** —
the mark, the wash and the toggle all stay as they are.

### THE RAIL, TIDIED — Kenneth, 2026-08-27

**The disc toggle moved into the DBSCAN block**, under `eps` and
`min_samples`. It had been sitting with the data controls because it is a
`display` parameter, which was the wrong reason: **it is about the fitting
parameters, not about the sample**, and the block it now sits in is the one
whose two sliders it draws. The rail reads

```
The data   shape · samples · groups (blobs only) · seed · true groups
DBSCAN     eps · min_samples · every point's disc
           [ Mark the core points ] [ Next point ] [ Play ] [ Reset ]
           play speed
```

**And the control text was cut back to what the label does not already say.**
Four details went:

| control | was | now |
|---|---|---|
| Shape · Rings | "one cluster surrounds the other — no partition by nearest centre can separate them" | "one ring inside the other" |
| Shape · Moons | "sklearn's own comparison stage: neither half is convex and their bounding discs overlap" | "two interleaving crescents" |
| Shape · Blobs | **"widget 23's stage, point for point — what K-Means is good at"** | "round, separated groups" |
| Radius (eps) | "how far a cluster reaches from each point" | *(none)* |
| Every point's disc · Off | "just the disc of the point being examined" | *(none)* |

**The `Blobs` one was a defect rather than verbosity.** *"Widget 23's stage"*
means nothing to a student — the gallery numbers widgets for us, not for them,
and no other user-facing string in the collection names one. It was the only
leak of internal vocabulary into the reader's screen, and it was found by
grepping the `detail:` strings for internal references rather than by reading
them.

The rest stayed and each has a reason: **Samples** keeps *"in total, split
between the groups"* because the total-vs-per-group distinction is exactly what
is not obvious; **Neighbours needed** keeps *"min_samples — counting the point
itself"* because that name maps to the notebook and the counting rule shifts
every core/border verdict by one; **Seed** keeps *"draws different samples"*,
which every widget in the collection carries.

**`eps` lost its gloss because the figure gives it three times over** — the label
says *Radius*, a disc is drawn at that radius, and the caption counts what is
inside it.

### WHAT SHIPPED, AND WHAT IS STILL OWED

| | |
|---|---|
| `widgets/dbscan/model.js` | the engine — `dbscan()` returning labels, core flags, neighbourhoods and the growth layers; both silhouette readings; both ARI readings; `recovered()`; the k-distance curve; four stages |
| `widgets/dbscan/main.js` | the widget: grammar G, the point-by-point walk, three stages, the corrected ARI |
| `_lab/dbscan-verify.mjs` + `dbscan-ref.py` | 13 cases against sklearn 1.9.0, **all 13 exact** on labels, core indices, both silhouettes and the ARI |
| `_lab/dbscan-measure.mjs` | every planning number, in ten sections, importing the shipping engine |
| `_lab/dbscan-marks.html` | seven mark grammars at the real width, ink counted — how G was chosen |
| `_lab/dbscan-reach.html` | seven reach marks and four hop choreographies, contrast measured — how the haloed ring was chosen, and where the four rejected hops live |

**Eight fingerprint states, baselined 2026-08-27** — five settled and three
driven, identical across three consecutive full-suite runs, and the whole
152-state suite MATCHes after recording:

| state | covers |
|---|---|
| `?shown=0` | the empty opening |
| `?shown=99` | rings, finished |
| `?discs=on&shown=99` | the disc wash — same `tx`, different `px`, which is the toggle doing exactly what it claims |
| `?shape=blobs&eps=0.3&labels=on&shown=99` | all four marks at once, true-group rings, the ARI tile |
| `?shape=moons&shown=99` | the third stage |
| `lead → step×34 → step +9f` | **mid-travel** — the disc between two points |
| `lead → step×34 → step +20f` | the same beat with the spokes out and the joins tinting |
| `speed=fast, lead → run +14f` | the only path that draws no spokes at all |

**`_lab/dbscan-drive.mjs` is written — 130 assertions, no browser and no
clock.** It stubs `main.js`'s one import to capture the config, then drives
`compute`, `animation.advance`, `readout` and `summary` directly, sweeps every
string the widget paints against a recording stub, and checks that nothing is
drawn off-canvas at 320–900px.

**Its own first run failed on an assertion that was wrong, not on the widget.**
The stage is `min(400, w − 32)` square, so it stops growing at w = 432 — well
below the 550 every baseline is recorded at — and the assertion demanded it
still grow between 550 and 694.

**And it was mutation-tested, which found a hole in it.** Reverting the ARI tile
to `adjustedRand` — undoing a decision Kenneth took explicitly — left every
assertion green: three of them test that `adjustedRandNoiseAware` behaves
correctly and none tested that the *widget* calls it. A guard now compares the
printed tile against both readings on a stage where they differ (0.806 against
sklearn's 0.788). **Testing a function is not testing the caller**, and the two
mutants that were caught (border points being examined, the disc's travel
removed) gave no hint that the third was not.

### THE ARC MOVE, WHICH THE NOTEBOOK STATES OUTRIGHT

Cell 51 names the two common workflows in as many words: **PCA → K-Means** and
**UMAP → DBSCAN**. Widget 23 is the first; widget 24 is the second, and
`widgets/umap/model.js` already exports the machinery — `umap`, `fuzzySet`,
`findAbParams`, `pcaPlane`, and the sphere `stage()`. **The four
dimensionality-reduction widgets become the input to the two clustering ones**,
which is the shape the whole arc has been building toward.

### WHAT TO LIFT

`widgets/kmeans/` is the closest reference and the more recent one:

- **`model.js` imported, never copied** — `_lab/kmeans-verify.mjs` hands sklearn
  the points *and* the initial state as JSON so both engines run on
  byte-identical input, which is why widget 23 matches the library exactly
  rather than "comparably". DBSCAN is deterministic given `eps` and
  `min_samples`, so the same trick should give an exact match with no seed to
  reconcile at all.
- **`_lab/kmeans-drive.mjs`** — 77 assertions with no browser and no clock:
  the contract, the numbers, the canvas text sweep run offline against a
  recording stub, and a geometry check that fails anything drawn outside the
  canvas at 320–900px. Copy it wholesale.
- **`_lab/kmeans-shoot.html`** — records a new widget's fingerprint states
  without re-running the suite, and **proves its copy of the harness faithful
  against existing baseline hashes before printing anything**. That guard is the
  whole value; HANDOVER records what the drifted version cost.
- **the rail**: `row: { key }` pairs two controls, `afterDrive: true` puts the
  pace control under the button it governs. `_lab/kmeans-rail.html` has the
  measurements and the two candidates that were not taken.

---

## The MDS storyboard, as it was written

Kept intact so the answers above can be checked against what was assumed.

**Build this one before t-SNE and UMAP.** It is the only one of the three with a
**closed-form answer to check the machinery against**, and it exercises the whole
iterative half that PCA does not — PCA's objective does not fall over steps at
all, which is why it ended up with no Step button.

#### The one sentence

*The input is the table of distances, not the cloud, and the 2-D picture is the
arrangement whose distances come closest to it.*

#### The beat that IS the widget

After the distances are measured, **the coordinates are put away**: the 3-D
cloud fades to a faint outline and the distance matrix stays at full ink.
It is the only place in the four DR widgets where the *input to a method* is
shown to be something other than the cloud. The outline stays on screen for the
rest of the run so the reader can see it being **ignored**, not deleted.

#### The closed-form checks — debug the machinery against these, not a picture

| stage | what must come out |
|---|---|
| **n = 3** | stress exactly **0.000**. Three points make one triangle, and a triangle is flat |
| **n = 4, regular tetrahedron** | six equal distances of **3.27** come out as four at **2.79** and two at **3.94** — it lies down as a square. Stress settles at **1.830** and will not go lower |
| **the seed** | all 50 seeds give **1.8304**; the mirror splits 23 / 27 |

That last row is the seed lesson with no sentence needed: the picture arrives
rotated or mirrored, the stress tile reads the same to three decimals, and the
two sit side by side. **This is Kenneth's own diagram made true — his 5.5 / 3.2 /
6.1 becoming 5.2 / 2.8 / 5.4 is exactly "close, not equal".**

#### Why MDS is the seed widget, measured on the real data

From the four-method reconnaissance (see the section above): **MDS is by far the
least reproducible of the four, not t-SNE.** Across 5 seeds only **35%** of each
point's ten nearest neighbours survive a seed change — PCA 100%, t-SNE 72%, UMAP
71% — and the number of samples it puts in the wrong group changes with the seed
(5, 5, 8, 7, 7 of 194). This is what `03-5`'s "the cluster separation is less
clear" is actually recording, and it is the opposite of what most readers expect.

#### Two controls that carry ideas

- **`points` 3–8.** 3 fits exactly; 4 never does. That is principle 2.6's failing
  case on one slider, and it needs no extra machinery.
- **`turn`, on the 3-D cloud.** Turning it moves the picture and **does not move
  a digit in the matrix**. Distance is what survives rotation — and it plants the
  seed lesson in 3-D before the reader meets it in 2-D. Must be `display: true`
  so it does not reset the run.

#### What can be reused from widget 19 verbatim

`widgets/pca/main.js` is the reference. The 3-vector helpers, `slerp`, the
orthographic `camera` returning two basis vectors, the depth-sorted scatter, the
`layout` function read by both `height` and `draw`, `--c-cluster-a…f`, and the
`drag` block are all method-independent. **Read the two traps recorded under
widget 19 before writing any of it**: only the FIRST gate animates unless the
gates are `display: true`, and a rotation must land on the 2-D graph's own
framing rather than merely face-on.

#### Not settled

Whether the real 194 samples appear at all. The storyboard proposes a gate —
*Run it on the 194 samples* — swapping the mechanism panels for one scatter and a
Shepard plot. That is a second widget's worth of work and should be a separate
decision after the mechanism half is reviewed.

---

### Arc B · evaluation

Unchanged below, and still the arc widget 13 belongs to. `generalization` is
built and shipped against `04-1` and `04-4`.

**`04-2 Model Evaluation` is BUILDING as widget 34 `roc-auc`** — see § *Widget
34* directly below. The one-paragraph sketch that sat here (a probability axis,
one dot per patient, a threshold line whose four quadrants ARE the confusion
matrix) became the shipped stage's left panel.

## Widget 38 · `shap` — Explaining a Prediction · SHIPPED 2026-09-01

PHM5005 `04-5 Model Explanation`, and the first widget for that notebook. **Both
pages are built**: "the game", three players A, B, C and a payout the reader
sets with six sliders; and "the model", the identical figure driven by a random
forest's prediction for one held-out patient, with the three features as the
players. Everything below the page switch is shared — same walk, same path
diagram, same six rows, same bars — and only where the game COMES FROM changes,
which is the structural claim the widget is making.

**THE MISCONCEPTION:** that a feature's contribution is a single well-defined
number, so averaging over orderings is bookkeeping. Grade: **inferred**, and
unusually well supported by the notebook itself — `04-5` prints the weighted-sum
formula and then demonstrates it on a **logistic regression**, which is the one
model where the machinery cannot show. A second misconception rides along and is
documented (Kumar et al. 2020, arXiv:2002.11097): that a SHAP value is the
model's coefficient, or a general importance.

### The measurement the design rests on

Brute-force enumeration of all eight coalitions for every one of `04-5`'s 60
test patients (`_lab/shap-ref.py` → `shap-ref.json`; the three-feature reduction
is age · ejection fraction · serum creatinine, the last two being the pair
Chicco & Jurman 2020 found sufficient on this same 299-patient data):

| model · scale | spread of one feature's marginal contribution over the 6 orderings |
|---|---|
| LR · log-odds — **what `shap.Explainer(lr, X)` returns** | **exactly 0, for 60/60 patients** (max 1e-15) |
| LR · probability | median 0.021, max 0.111 |
| Decision tree, depth 3 · probability | median 0.092, **max 0.900 — a sign flip** |

`phi_i = beta_i (x_i − xbar_i)` is the closed form `shap/explainers/_linear.py`
computes in one line (`phi = (X - mean) * coef`, `feature_perturbation` defaults
to `"interventional"`). **So the notebook's own worked example is the degenerate
case.**

### The black-box example the notebook declares and never fits

Cell 6 builds `RandomForestClassifier(class_weight="balanced", n_estimators=300,
max_depth=None, n_jobs=-1, random_state=42)` — and then calls `lr.fit` and only
`lr.fit`. The forest is never fitted, never predicted with, never explained.
Page 2 fits it, and the machinery finally has something to do: on the same 60
held-out patients the six orders disagree by a **median of 16.9 and a maximum of
43.1 percentage points**, against Shapley values in the low tens.

**v(S) IS PINNED, NOT THE MODEL.** That forest is 35,326 nodes / 798 KB of JSON,
and depth rather than tree count is where the interaction lives — 25/50/100/300
trees at unlimited depth all give a spread near 0.16, and capping at depth 6
halves it — so no "small forest" is a faithful stand-in and shrinking it the
cheap way destroys the effect being taught. But the widget only ever needs v(S)
for one patient, which is 60 x 8 numbers: `_lab/shap-page2-ref.py` writes
`widgets/shap/model.js`, **6.9 KB**, holding the notebook's actual forest exactly.
The cost is that a reader picks one of the 60 rather than inventing a patient,
which is the honest constraint anyway: every dot is then a real person.

**ONE MODEL SHIPS** (Kenneth, 2026-09-01: *"you can use only one model for
simplicity i.e. random forest. unless you had a reason for multiple models?"*).
There was a reason and it did not survive being stated: the logistic regression
would have shown that the notebook's own example is the case where none of this
is needed — but **page 1 already lets a reader reach that case by hand**, by
setting the three pair sliders to zero, and doing it beats being shown it. The
generator still fits the LR and prints the collapse, so the measurement stays
reproducible; it is simply not written into `model.js`.

Second finding, and it decided the two-page split: **the redundancy caveat cannot
be shown on this data.** The strongest correlation among the eleven features is
sex↔smoking at 0.45, and among the three used on page 2 it is 0.16. Page 1's
`duplicates` cell shows it exactly. **Page 1 is therefore not a warm-up; it
teaches what page 2 structurally cannot.**

### How the design got here — Kenneth's review, 2026-08-31

Recorded because five of the six turns changed the widget, and three of them
reversed something.

1. **"Looks complicated"** — an eight-section lab page of seven coalition
   depictions was cut to two pages: the abstract game, then the data.
2. **"Animate using A, B, C with circles like in the diagram"** — the visual
   language is his own `04-5` figure. What his two figures cannot show is the
   part that moves, and the widget adds exactly three things: a token outside
   the enclosure is being *averaged over*, his four-panel figure stops short of
   the average, and nothing in either says the order matters.
3. **"Link it to the path diagram"** — the path diagram is **drawn by the
   walking**: each arrival adds one node and one edge, so the reader builds the
   lattice rather than being shown one. That is the widget's one real idea.
4. **"So we ADD players and not subtract them?"** — the same subtraction from
   opposite ends. Adding is right for the animation: one walk yields all three
   contributions at once where removal needs twelve before/after pairs, and
   **efficiency is only visible on a route** from `v({})` to `v({A,B,C})`.
5. **"These options seem arbitrary"** (twice) — a row of five named games became
   a 3×3 grid, and then the grid gained a third axis. The non-arbitrary framing
   is the **Harsanyi dividend parameterisation**: any three-player game is what
   each brings alone plus what each pair creates on top, and
   `phi_i = solo_i + ½ Σ pair_ij` — every dividend split equally among whoever
   made it. All four axioms the notebook states and never demonstrates then land
   on one page: **efficiency** (the scores sum to the payout), **symmetry**
   (A&C and B&C give identical grids — checked on screen, difference 0),
   **dummy** (`adds nothing` scores exactly 0), **additivity** (the nine φ_C are
   an exact plane — largest deviation 0, asserted rather than claimed).
6. **"The table values change depending on the dial?"** — they did not, and two
   of the six sliders genuinely move φ_C. The grid is live now, and the deeper
   fault it exposed is worth carrying: **a matrix's axis headers are OPTIONS,
   not readouts.** "C alone: +30 / 0 / −30" beside a C slider reading 0 looks
   like a contradiction until the live row is marked and the columns carry their
   own numbers.
7. **"Chooser then summary"** — the cells lost their digits, because a number in
   a cell made the chooser read as a summary of the game you were already in.
8. **"If I set up the game, why do I get a whole grid of other combinations I
   don't care about?"** — the nine kinds stopped being a chooser and became a
   `readback` naming what the sliders produced.
9. **"The paired sliders individually — the segmented design doesn't let me see
   the whole picture"**, and **"the grid is confusing: I thought rows would be
   one pair and columns the other"**. THESE TWO ARE THE SAME CHANGE, and it is
   worth recording why the second could not be fixed on its own. The nine kinds
   were "what C brings alone" against "what share C takes from THE pair", which
   only reads while exactly one pair is live; his expectation — one pair per axis
   — cannot be built either, because three pairs do not fit two axes. **Once all
   three pair dividends are sliders a game can be two things at once (A&B
   complementary while A&C duplicate), so it has no single kind and the table has
   nothing true to say.** Naming kinds needed the toggle; seeing the whole game
   needed the sliders; they were never both available. The table is gone.

   What replaces it is a **decomposition, on the stage rather than the rail**:
   per player, what it brought alone, what it took as its share of the pairs it
   is in, and the score those add to. It is the one-line rule made visible, it
   is well defined for any setting of the six, and it is checked — `compute`
   throws if the split and the subset enumeration disagree by more than 1e-9,
   because two routes to one number is how the halves of a figure come apart.

10. **Four more, on the built widget.** (a) *"Are the descriptors supposed to
    change with the values?"* — a control `detail` is static text core writes
    once, so it must say what the control IS; three different general facts
    across three pair sliders read as three readings of three pairs. They now
    say the same thing three times, varying only in who splits it, and the
    general facts moved to the section. (b) *"The animation is a bit jarring — the
    path starts again from the previous node."* A walk is **four units now, not
    three**: three arrivals and a CLEAR-OUT in which the players ease back to the
    queue and the finished route fades into the pile. The sixth walk has no
    clear-out, so the figure ends full. (c) *"The circles are not centred radially
    in the coalition circle."* They were not: an isosceles triangle put two
    players 32 from the centre and one at 23. **The seats are 120° apart at one
    radius now**, and the outline is the smallest shape holding them — a circle
    when they are equidistant, the notebook's capsule for a stacked pair. An
    equilateral triangle has no square bounding box, so one box rule could not
    give both a centred ring and this arrangement. (d) *"Are the contributions
    the same as the SHAP graph, sorted by magnitude with − and + either side?"*
    They are now: the closing block is **sorted by |φ|, signed against a zero
    line, biggest at the top** — `shap.plots.bar`'s own shape — with each bar's
    two ingredients printed under it. Page 1 ends on the picture page 2 opens
    with.

11. **Where the score bars go — mocked, then picked.** *"The plots bar looks nice
    but small… any other place to put it?"* Five placements at the real canvas
    width in `_lab/shap-bars.html`, and the tension named before choosing: as a
    reading of the table the bars belong under "the average" in those three
    columns, which makes them vertical and A-B-C ordered; as
    `shap.plots.bar` they are horizontal and sorted by magnitude, which is what
    page 2 opens with. **Kenneth picked 3** — walks table left, bars right — for
    no extra canvas height and roughly treble the travel (226px → 586px at
    1080). Its cost, stated at the time: reading order reverses, the conclusion
    sitting right of the working. What it buys is that each column of the figure
    now reads top to bottom as one thought — coalition then its record on the
    left, path plot then its conclusion on the right.

    **A headless-only artefact worth not chasing twice.** At narrow widths the
    Edge screenshots showed the coalition ring as an ellipse. It is not: core's
    canvas is `width: 100%` with its height pinned in px, so a frame painted
    before the 60 ms-debounced ResizeObserver catches up is stretched in x and
    not in y — `core/canvas.js` documents exactly this above `pointAt`. Measured
    in a real browser at 746px the two scales are 1.250 and 1.251. **Trust the
    programmatic read over the screenshot** (5.4), including when the screenshot
    comes from headless rather than the automation pane.

### What is built, and what is owed

Built: `widgets/shap/` — **six `int` sliders that ARE the game** (three solo
dividends, three pair dividends) and nothing else that sets it; the coalition
filling on the left, the path diagram drawn by the walking on the right, and
below them two blocks on one baseline — the decomposition of each score, and the
six walks as they are taken. Four readout tiles (three scores plus `Together`,
so efficiency is adjacent to what it is a claim about). **Nothing on the figure
is clickable**; the sliders are the only state of record.

**Page 2**: one control, the patient. `v(S)` comes from `model.js` in
**percentage points**, which is not cosmetic — it puts page 2's numbers in the
same range as page 1's tens and units, so a reader crossing the tabs reads one
figure at one scale, and "+13.6" is a sentence a clinician can finish. The
circles keep their three colours and take the feature codes Age / EF / Cr; the
patient's own values go in the **legend**, which already carries a swatch beside
a name and costs the figure no space. `v(∅)` is the average prediction and
`v({all})` this patient's, so the axis ends are labelled as such. Each bar's
sublabel is the **range across the six orders** rather than page 1's dividend
split — page 2's game has a three-way dividend as well, so no two-column split
accounts for it, and the spread is the thing worth knowing about a number that
only exists as an average. `compute` asserts **efficiency** on both pages.

The default is **patient 11**: 48 years old, ejection fraction 30%, creatinine
1.6, and the patient died. Young age pulls the risk down against two findings
that push it up, and its two bad features are far worse together than apart —
each alone barely moves the prediction, the pair takes it from 38.6% to 70.3%.
That interaction is why one feature's contribution ranges from +2.5 to +31.5
across the six orders, and it is exactly what the notebook's linear example
could never show.

### Round 12 — what the model page was not saying (Kenneth, 2026-09-01)

Three questions, and the third named a real hole. *"For the model, how does the
score arise from the prediction? The output is 0–1 but how does it translate to
the scores?"* and *"I see +/- a number but don't know what it means."*

**A score is a difference of two probabilities.** `v(S)` is the model's average
output over the 239 training patients with the features in S pinned to this
patient, so `v(∅) = 38.6%` is what it predicts knowing nothing about anyone and
`v({all}) = 54.2%` is what it predicts for this person. The three scores are
percentage points and they sum to exactly the distance between those two. That
identity is the whole of what SHAP promises and the figure was stating it in one
readout tile's note. It now says it on the stage, in two lines under the path
plot: what the model is, and `average prediction 38.6% → this patient 54.2% ·
the features must explain the +15.60 points between them`. The score caption
carries the unit and so does every readout tile.

**Global as well as individual** — a third block, under the bars: every one of
the 60 held-out patients as one dot per feature, this patient's marked, with
mean |contribution| in a right-hand column. That is `shap.plots.beeswarm` and
`shap.plots.bar` in one, and the point of putting it here rather than on a page
of its own is that a global explanation only means something beside the
individual it aggregates: **the bar above and the marked dot below are the same
number twice.** Its axis is FIXED to the extremes over all 180 values while the
bars above rescale to whoever is selected — deliberate, and most of why the block
earns its space: sweep the patient slider and the cloud holds still while the
marker moves through it. Feature order follows this patient's, not mean size, so
the two blocks line up row for row; when the two orders differ, that is itself
the lesson.

Lanes are **deterministic, not jittered** — `rng` belongs to `compute` and never
reaches `draw`, and a swarm that resettled every repaint would be a different
figure each frame. Dots are laid out in value order and stacked within a 5px
bucket. Page 2's path plot gives up 16px of height to make room for the two
sentences; page 1 has nothing to put there and keeps the taller plot. Canvas:
614 side / 747 stacked on the model page, 530 / 620 on the game page.

**`highlight` now does two jobs on page 2** — the live route and the marked dot
— so the legend names both. A legend that named only the first would be
describing half of the mark.

**Two overruns the estimate missed and the sweep caught.** The swarm caption ran
105px off a 535px canvas because a character count is not a width; it is two
lines now. And sizing the block off the score bars alone put its caption 8px
into the walks table's *the average* row, which at wide widths is the lower of
the two blocks — it clears both. Re-verified over 65 states x 3 canvas widths.

### Round 16 — which rows, and copy that says it

**The train/test question, mocked up rather than argued** (`_lab/shap-dataset.html`,
fed by `_lab/shap-train-ref.py`). Kenneth read the test-set global as "building
the model on test data", which it is not: the forest is fitted on the 239
training rows and those same 239 are the BACKGROUND, so every v(S) on every page
is already their mean output. The only choice is which rows get a phi.

Building it his way is entirely feasible — 239 x 8 pinned values is 24.9 KB and
55 s. It was dropped on what the mockup shows instead:

| | TRAIN (239) | TEST (60) |
|---|---|---|
| forest AUC on these rows | **0.9996** | 0.7895 |
| predictions pinned at 0 or 1 | 38% | 18% |
| ranking by mean \|phi\| | **EF > Cr > Age** | **Cr > EF > Age** |
| value ↔ phi correlation, Cr | 0.566 | **0.815** |
| value ↔ phi correlation, Age | 0.426 | **0.750** |

**The headline answer flips**, and the colour story — the whole reason the value
ramp was added — is measurably muddier on the rows the forest memorised: on the
train line blue and red are stirred together, on the test line they separate.
Kept as it was. The mockup stays in `_lab/` as the artefact for the overfitting
lesson, which is a different lesson from SHAP.

**And the copy says where the model came from now**: the model tab reads *"a
random forest trained on 239 patients, inspected on the 60 held out"*, and the
figure *"random forest, 300 trees, trained on 239 patients — scored here on the
60 held out, 0 to 1 for death"*. The global page opens *"trained on 239 patients
· inspected here on all 60 held out, one at a time"*.

**A SECTION MAY CARRY THE DESCRIPTION ITS WHOLE GROUP SHARES** (`widgets/core/`).
The three pair sliders each repeated one sentence with the letters changed — "A
and B split this between them", twice more — which is three copies of one fact
pretending to be three. Hoisting it to the section revealed that core rendered
only a section's `label` and **dropped `detail` in silence**: widget 38 had
carried one since it was written and it had never once been on screen. Sections
render it now. It is the only section detail in the repo, so exactly one string
lit up; full suite after: all 268 states identical.

Worth naming as a method: the hoist was verified by reading the RENDERED RAIL,
not the source. A grep would have said the sentence was there.

**Checked against practice, since the choice was made on measurement alone.**
There is no settled convention, which is itself worth knowing:

- The SHAP library's own beeswarm example explains the **whole dataset** the
  model was trained on — `explainer = shap.Explainer(model, X)` then
  `explainer(X)`. The library is not fussy about it.
- Molnar's *Interpretable Machine Learning* does not address the train/test
  choice for summary plots at all.
- **scikit-learn's permutation-importance guide gives the clearest reasoning**
  for the same question: *"Using a held-out set makes it possible to highlight
  which features contribute the most to the generalization power of the
  inspected model. Features that are important on the training set but not on
  the held-out set might cause the model to overfit."*
- Production tooling defaults to held out — Qlik AutoML: *"The SHAP importance
  chart ... visualizes the SHAP data from the model predictions created on the
  holdout (test) data."*

So the widget is on the majority side for a global picture, and this data set is
a live instance of sklearn's warning: **ejection fraction is important on the
training rows and less so on the held-out ones**, which is exactly the sentence
that describes a feature the model is overfitting through. The BACKGROUND is a
separate question with a settled answer, and it is training data either way.

**The pair descriptor rewritten for a student**, from *"on top of what its
members bring alone, and reaching nobody outside it"* — where "reaching nobody
outside it" was the model's phrasing, not a reader's — to *"Value that appears
only when both are in the coalition, on top of what each brings alone. The two
split it equally, and the third player gets none of it. Negative means they get
in each other's way."* One clause per idea, and it borrows "coalition" from the
figure rather than inventing a word.

### Round 15 — the notebook's own words, its own units, and its own dataset

**Individual / Global**, from 04-5 itself: §1 contrasts *"Global explanations:
which features are most influential across the entire dataset"* with *"Local
explanations: why a specific prediction was made for one individual"*, and the
cells are commented `# Plot global explanation` / `# Plot individual
explanation`.

**THE 0 TO 1 SCALE, not percentage points.** Points read better and put page 2's
numbers in page 1's range, which is why they were tried first — but a SHAP value
has the UNITS OF THE MODEL OUTPUT, and a summary printing a prediction of 0.542
beside a contribution of +13.6 makes the reader convert before they can add up.
It is also what `shap_values` holds, so the widget and the notebook now print the
same numbers.

**The summary starts with the thing being explained** (Kenneth: it *"reports the
different contributions, but I was expecting what is the prediction, then
followed by the shap scores"*). `Predicted risk 0.542`, noted
`0.386 before any feature · the three add +0.156`, then the three scores. The
baseline and the total ride in that note rather than taking a fifth tile,
because five tiles wrap at the 535px canvas every fingerprint state is hashed at.

**The global view stays on the TEST set, against the request, because the
notebook does.** Kenneth asked for the training data; 04-5 runs
`explainer = shap.Explainer(model, X_train)` then `shap_values = explainer(X_test)`
and plots BOTH the beeswarm and the waterfall from that one array. X_train is
the BACKGROUND — it is already in every `v(S)` the widget computes, as the set
the expectation averages over — and X_test is what gets explained. Measured, the
swap would also be a bad idea on its own terms: this forest scores **AUC 0.9996
on its own training data against 0.7895 held out** (14% of training predictions
above 0.95, against 3% on test), so a training-set global explains memorisation
and inflates every feature — mean |phi| for EF 15.7 against 11.8, Age 9.5
against 7.4. Keeping the test set also keeps the link the two views are built
on: the individual's dot is one of the dots in the global swarm.

**Two defects the scale change exposed, both invisible at tens.**
`const mx = Math.max(1, ...)` was a divide-by-zero guard, and a no-op while a
score was tens of points — on a 0 to 1 scale every |phi| is under 1, so the
floor BECAME the scale: every bar shrank to a stub and both end reserves divided
by a fraction and put the axis ticks off the canvas. **A guard must not be a
bound.** And the two end reserves needed backstops for the all-zero game, where
both fractions are zero, every reserve is Infinity, and the ticks are drawn off
both edges at once.

**And a mangled escape that four checks walked past.** `sed` does not interpret
`—`, so an em-dash became the literal string `"2014"`, painted on the global
page's mean column before any patient is added. `node --check` passed it, `npm
run check` passed it, the text sweep passed it — it is not a NaN, not an
overflow, not a collision — and the verification grep looked for `u2014`, which
no longer matched. The sweep now fails any bare four-digit codepoint on the
canvas. Rule: **when a shell rewrites source, grep for what should be there, not
for what should not.**

### Round 14 — the tabs nest after all, and core stops a stale label

Round 13 flattened to three peers to dodge a label defect. Kenneth asked for the
nesting back, and an adversarial review of his own proposal is what settled it:
**gating a segmented on a segmented is the house pattern** — `metrics`,
`mixed-model`, `lm-diagnostics`, `odds-and-risk` and `lm-adjustment` all do it —
and three peers assert a flatness the material does not have. The notebook's own
headings are the game and the model; individual and global are both readings OF
the model.

**The defect that forced the flattening is fixed where it belonged.** Drive
labels are chosen by a PARAMETER NAME, and a `when`-gated field keeps its value
while hidden (deliberately — leaving a stage must not destroy the work), so a
label keyed on such a field goes on reporting a choice that is no longer on
screen. `balancing-data` has the same shape and is safe only because core hides
the whole drive row behind its gate; widget 38's buttons are visible on every
page. So core now reads a hidden control's label as its default:
**a label may not be chosen by a control the reader cannot see.** One line in
`resolveLabel`, `labelSet` deliberately untouched so the width reservation still
covers every label the button can hold, and no shipped widget moves.

**The `new patient` tab was reviewed and dropped**, and not for cost — pinning
v(S) on an 8-level grid is 4,096 numbers, 28 KB, entirely shippable. It was
dropped because **67% of such a grid sits more than 1 SD from the nearest of the
239 training patients** (46% beyond 1.5 SD), and three free sliders make the
empty corners trivial to reach: *young, very low EF, very high creatinine* is
3.21 SD from the nearest real patient with zero neighbours within 1 SD, against
46 for the default patient 11. Interventional v(S) would then average the forest
over coordinate combinations that never occur and return a confident, well
formatted, meaningless explanation. **A widget about explaining a black box
honestly must not ship a control whose main affordance is manufacturing
dishonest explanations** — and clamping the sliders does not help, because the
problem is the combinations, not the ranges. It also costs the claim the widget
currently has: that `model.js` is the notebook's forest, exactly. The deployment
lesson worth building instead is that **the explanation depends on the
background set** — deploy the same unchanged model among sicker patients and
every phi moves because the baseline moved. That is its own page or its own
widget.

**And a second one, in the fingerprint suite itself — since diagnosed and
FIXED.** The first run after the core change reported **6 states DIFFER** — five
`lm-adjustment`, one `roc-auc`. The code said that was impossible:
`lm-adjustment` declines both drive buttons (`stepLabel: null`,
`runLabel: null`), so the resolver under suspicion never runs there. Five runs
of identical code then gave 0, 6, 0, 4 and 8.

**The cause was a scrollbar.** A figure taller than the frame gives the framed
document a scrollbar, the scrollbar takes ~15px off the width, and a canvas
sized from that width re-renders narrower — a second layout pass that a fixed
400ms wait caught sometimes and missed sometimes. Every flaky state was hashed
**688** backing pixels wide where its baseline holds the settled **669**, and
only the ELEVEN states tall enough to scroll were ever affected. The baselines
were already the settled value, so the fix cost no rebaselining. `shoot()` now
waits for the canvas dimensions to hold still rather than for a number of
milliseconds, says NEVER SETTLED instead of hashing mid-flight, and puts the
size it hashed at on every row. Three clean runs after. Details in HANDOVER.

**A harness artefact that nearly became a bug fix.** Stepping the pile appeared
to do nothing: zero paints, zero frames, the counter stuck at 0 of 60. The
control experiment settled it — **the game page's walk did nothing either**, and
the Browser pane was hidden, so its `requestAnimationFrame` never fired. Driven
by hand with the fingerprint harness's own queue-and-pump (5.4: replace rAF,
feed fixed timestamps), every press advances exactly one patient and Run reaches
60 of 60. Two lessons re-earned: an animation cannot be tested through a hidden
pane, and a suspected regression needs a control before it needs a fix. A
second one the same hour: the first measurement after an iframe width change is
taken mid-resize and reported a 535x368 canvas the widget can never ask for —
sizes now come after a discarded warm-up load.

### Round 13 — one picture per page, and colour that means direction

*"It's confusing when both are presented together. Can we show how the global
was built on one sub-page? Then the patient one can remain on a different
sub-page?"* Round 12's swarm went under the individual bars and Kenneth cut it in
one turn. He was right, and the reason is sharper than clutter: **the two
pictures cannot share an axis.** The bars rescale to whoever is selected, which
is what keeps them legible; the swarm must not, or the cloud would move under the
marker. Two axes stacked in one figure is a figure that has to be read twice.

**THREE TABS, NOT TWO WITH A TOGGLE INSIDE ONE.** He described a sub-page and the
flat control is how that gets built here. A nested toggle keeps its own value
when you leave the page it belongs to, and drive labels are chosen by a
PARAMETER — so a reader who visited the global view and returned to the game
would find a Step button reading *Add one patient* while three players walked
into a ring, which is exactly the 3.4c defect. One control, three values, no
stale second axis, and the rail stays one row.

**THE GLOBAL PAGE BUILDS.** A global explanation is nothing but the pile of
individual ones, so the honest way to show it is to add them: one step, one
patient, three dots. `mean size` beside each row is the mean so far, from a
prefix table computed once at load — a running mean recomputed per frame would be
per-frame work painting the same 183 numbers. Rows are ranked by the FINISHED
pile, as `shap.plots.beeswarm` ranks its own, and fixed for the whole build so a
dot never changes row under the reader; early on the ranking and the numbers can
therefore disagree, which is the ranking settling and worth watching.

**A NEW COLOUR ROLE: `--c-value-low` / `--c-value-high`.** Where a measured value
falls in its own range, so a figure can carry the DIRECTION of a relationship and
not only its size. Added rather than borrowed from `--c-cost-low/high`, which is
the same shape making a different claim — a cost ramp says how badly a model
fits, and a feature value is neither good nor bad; nobody's age is a worse fit.
The ends alias the same blue and red slots because the SHAP library's own
beeswarm is blue-low/red-high, and a student who has run `shap.plots.beeswarm`
should meet the same convention. Values are clipped at the 5th and 95th
percentiles before mapping, which is also what the library does and for its
reason: one creatinine of 9.4 against a median of 1.1 would put everyone else
inside the same tenth of the ramp.

**A PANEL USING IT MUST NOT ALSO COLOUR BY IDENTITY.** The individual page paints
Age blue, EF amber and Cr red because there the question is *which feature*; on
the global page the row already says which, and the open question is *which
direction* — so the dots take the value ramp and the row labels go to ink.
Without that, a low-Age dot and the Age row would be the same blue for two
unrelated reasons. The rule is written into the token's own comment.

And it reads: on `Cr` the blues sit left and the reds right, on `EF` that
inverts — low ejection fraction pushes the risk **up** — and on `Age` young is
left. That is the relationship, and no arrangement of grey dots could show it.

**`runLabel` now takes the map form `stepLabel` always had** (`widgets/core/`).
It was the only drive label that did not, and the reasoning in core's own comment
applies to it identically: a widget whose tabs run genuinely different nouns
cannot obey 3.4c with one word. `resolveLabel` on a plain string returns the
string, so no existing widget moves; `runLabel: null` still declines the button,
because that check is on the raw value.

**The temporal-dead-zone trap the file header warns about, hit for real.**
`G_ORDER` ranks the swarm's rows from `GLOBAL.runMean` at module-eval time, and
`GLOBAL` was declared below it — *Cannot access 'GLOBAL' before initialization*,
a blank canvas, and no widget at all. It lives above the geometry section now.
`gameFromModel` is a function DECLARATION and hoists, which is the only reason
calling it from `GLOBAL` works; making it a `const` arrow would break the file at
load.

Verified: 60 patients x 2 canvas widths on the individual page, six build stages
on the global one, plus the game page's defaults and extremes — 0 overflows,
collisions or labels-on-markers. Core changed, so the **full fingerprint suite
ran: all 268 states identical.**

**The page switch is `display: true`**, deliberately: the animation's whole
state is one index into six walks of three arrivals, and that index means the
identical thing on both pages. Stop halfway through the fourth order, change
page, and the same walk is halfway through against a different game. Resetting
would make the tab a restart instead of a comparison. It survives round 13
because `game` and `one` still run the same walk;
`all` runs a different animation, and `animation.rebuild` — which core calls on
exactly this kind of change — empties the pile when the KIND changes rather than
reinterpreting a walk index as a patient count. `patient` is data and does reset.

Owed before it ships: a colour role for "one of the p players" (the draft
borrows `--c-cluster-a/b/c`, whose documented meaning is "groups nobody
assigned", which a chosen player is not); fingerprint states including a driven
one; the notebook link; and judging projected. **The true outcome is
deliberately absent from page 2** — SHAP explains the model's output, and
printing "this one died" beside it invites the reading that a wrong prediction
has a wrong explanation.

**Fixed, 2026-09-01 — the near-tie labels** that page 1 left as "known, not
fixed". Page 2 forces the issue: this patient's `{EF}` is 38.8 and `{Age}` 36.9,
nine pixels apart in the same column, and no leader line can distinguish two
dots at the same place. The rule generalises from "equal value" to
"indistinguishable on this axis" — **CLEAR** is a dot's radius plus half the
9px ink, two dots can hold separate labels only if they are `2 x CLEAR` apart,
and a merged cluster gets **one short line per member stacked above the top
dot** rather than one long joined line. Joining read fine for two and broke for
three: patient 1 puts all three pairs within 10px and
`"Age+EF 31.8 · Age+Cr 29.3 · EF+Cr 28.7"` is 250px of label across a 155px
column. A block then reaches further up than the single line it was sized for
and can hit the dot above, so placement runs, finds what did not fit, merges it
upward and runs again. Verified over **all 60 patients x 3 canvas widths**, plus
page 1's default and extreme games, for overflow, label collision and
label-over-marker: 0 failures. Page 1's own labels are byte-identical; two of
them merely moved 4px into the free band they were overlapping.

**Fixed, 2026-09-01 — the bottom half at narrow widths.** Candidate 3 gives the
walks table the left half and the bars the right, which is what trebles the
bars' travel at 770px. At 550 — **the width every fingerprint state is hashed
at** — the same rule left the bars 13px of half-span on page 1 and 4px on page
2, with page 2's sublabel 42px off the right edge. Below 700 the two blocks
stack instead and the canvas grows from 530 to 620; the wide reading is
untouched. The badge also got its own gutter: a long negative bar puts its
number just left of the bar, which cleared a one-letter badge by 4px and landed
on a three-letter one. Two lanes, so the clearance is structural rather than a
coincidence of two constants. Reserving both ends of the bar unconditionally
then cost a third of the travel, so only the end a bar actually reaches pays for
its label — one of the two fractions is always exactly 1.

### The lab pages, and what each settled

| page | what it is for |
|---|---|
| `_lab/shap-explainer.html` | **the live prototype** page 1 grew from — six dividend sliders, the grid, the walk, and a six-step derivation ending at the one-line rule. Carries the assertions: the plane's flatness, the A&C ≡ B&C swap, and the general rule against the six-walk average |
| `_lab/shap-mock.html` | round 0 — the notebook's model measured, the collapse in three panels, the waterfall against the coefficient, the beeswarm |
| `_lab/shap-coalitions.html` | seven ways to draw eight coalitions, compared on one page: path plot · cube · ordering tree · weighted bars · 6×3 matrix · running mean · rows and lattice |
| `_lab/shap-groups.html` | the notebook figure animated — the stand-in deal, his 2×2 in motion, the queue |
| `_lab/shap-design{,2,3,4}.py` | the measurements above |
| `_lab/shap-page2-ref.py` | **generates `widgets/shap/model.js`** — fits both models, writes only the forest's v(S), and prints the LR collapse and the forest's spread so the decision above stays checkable. No pandas: the CSV is twelve columns and `csv` reads it in the same row order, so the stratified split is bit-identical |

## Widget 37 · `mlp` — Neural Networks (MLP) · SHIPPED 2026-08-31

**Arc A's last slot, and the arc is now complete.** PHM5005 `04-3 Tour of
Algorithms` § Neural Networks (MLP) — ten review rounds across 2026-08-30/31.
Kenneth's two structural picks up front: **the SVM widget's stage** (widget
16's own three generators and its class colours, so kernels and hidden units
answer one visible problem) and **both acts** — training bends the boundary,
and the k × activation dials with the identity collapse.

**A 2 → k → 1 network, trained by full-batch gradient descent with momentum
0.9 at lr 0.05 over 600 epochs.** `compute()` trains once and keeps every
epoch's weights; the animation reveals a trajectory rather than training per
frame (1.4). Two panels, both live: the network, every edge a fitted weight
(thickness |w|, colour its sign), and the decision boundary as a class wash
with a contour at P = 0.5. A loss strip runs under both.

### The reliability table, which is the design's real finding

Measured in `_lab/mlp-design.py` over 20 inits per cell, and identically
under every optimiser tried — so it is a property of the problem, not the
step rule:

| | k=1 | k=2 | k=3 | k=4 | k=8 |
|---|---|---|---|---|---|
| rings | 0/20 | 0/20 | 10/20 | 19/20 | 20/20 |
| crescents | 0/20 | 0/20 | 3/20 | 6/20 | 17/20 |

**It corrected a one-seed claim the mock had already made in prose**: an early
draft showed rings k = 3 reaching 0 errors and called 3 "the first k that
works"; a different data seed reached 24. Two facts fall out, and **no surface
may claim "k ≥ 3 works"**: capacity (one and two units cannot close a ring —
they produce a line and a wedge) and optimisation (k 3 usually converges to a
local minimum; extra units make the optimisation more reliable, not only the
model more expressive). The mechanism is visible as a **dead unit** — one that
activates on no sample, drawn in `--c-unknown` — and the crescents at k = 3
show it starkly: 1 of 3 units live. **The optimiser was then chosen on how much
of the training stays visible**, since reliability did not separate the
candidates: momentum 0.9 at lr 0.05 spreads rings k = 4 over 77 → 32 → 1 → 0
errors at epochs 20/60/150/300, where lr 0.2 has converged before epoch 60.

### The rounds

1. **Build** — two panels, loss strip, k and activation dials.
2. **The activation shown, not named** — an inset drawing the curve's shape,
   with a rug of the pre-activations the units actually receive, so it spreads
   as the weights grow and a unit sliding into ReLU's flat region is a dead one
   being made. A crossfade between activations was designed and dropped:
   changing the activation is a data change, which resets training, so no
   figure stands still for it.
3. **The hover inspector** on core's pointer channel: a hidden unit lights its
   edges, prints its weights, and draws **its own straight piece** on the
   boundary. Core's rule for that channel — an inspector must stay additive,
   since a lecture screen has no pointer — is honoured rather than worked
   around: *Each unit's line* puts all k lines on the boundary without one.
4. **Backpropagation, first as a static overlay and then properly.** The
   overlay was not what Kenneth meant; **Slow now choreographs one training
   step** over two seconds — a sample is ringed on the boundary and travels the
   edges, its prediction meets the label, the error returns, the weights move —
   each phase naming itself. THE WIDGET TRAINS FULL-BATCH, so the last caption
   says the weights move once after every sample has made the trip.
5. **The panels fill the width.** Only the boundary must be square, so it takes
   46% and the network takes the rest; equal halves capped at 300px had left
   dead canvas at every wide frame.
6. **The backward pass lands on the hidden units**, by right-angled elbow
   (`_lab/mlp-backprop.html`, four candidates). Backpropagation produces a
   gradient for every *parameter*; the inputs are data and have none, so an
   arrow reaching them promised an update that never happens. **The dead unit
   is never ringed** — it receives zero gradient, which is why it cannot
   recover.
7. **The magnified neuron aligns to the network's columns**
   (`_lab/mlp-band.html`), sum over the hidden column and out over output, so a
   reader can look straight down from the Σ to the units it explains. The
   equation that briefly filled the spare width was cut: whether it fitted
   depended on the width.
8. **The neuron's lettering and fan-in** (`_lab/mlp-neuron.html`, three
   lettering candidates and five line treatments). MathML is DOM and this figure
   is painted, but the convention it would apply is one a canvas can follow: a
   variable is italic serif, everything else upright, and a subscript is smaller
   and set below the baseline — Unicode's subscripts sit ON the baseline at the
   wrong size, which is why the band read as a caption. The fan-in became a long
   flat stub and a short turn: the old shallowness was structural (four inputs
   in a 92px band running the diagonal all the way can only make ~7°), and the
   outer arrivals now measure 28°.
9. **Core gained `style: "action"`** — a bool rendering as a full-width button
   in the drive row's sizing, so *Initialize weights* sits as a sibling of Reset
   (measured 626×35 against 626×35). The rule must sit AFTER `.w-btn` (equal
   specificity, later wins) and the FIELD carries the flex basis, not the
   button. The harness learned it the way it learned pills.
10. **Retitled to the notebook's own heading** and the copy rewritten in its
    vocabulary — "bending a boundary" was colloquial, and **the subtitle no
    longer says classify**, since an MLP fits a continuous outcome as readily as
    a categorical one.

### The engine is pinned, and the pinning had to be designed

The widget and the reference cannot share a random stream, so a shared seed
would prove nothing. `_lab/mlp-verify.mjs` dumps the data AND the initial
weights the widget produced; `_lab/mlp-verify.py` trains from those exact
arrays. After 600 epochs across four cases the worst disagreement in any
weight is **1.1e-15**, and every error count matches.

### Promotion

Eleven states — nine settled, two driven (one mid-training at Medium, one 0.6
through the first step at Slow, in the backward phase) — via three full-suite
runs at DPR 1.25, all eleven byte-identical on every run, then a confirming
**268 of 268 MATCH**. The flake showed itself plainly: run 1 flagged five
px-only DIFFERs across three widgets, run 2 flagged two, run 3 none, `tx`
identical throughout. A different set each run is the pane.

**Two sweep lessons worth carrying**, both found here and both the same shape.
A state sweep that forces its repaint with a `resize` event, or with a
one-pixel frame nudge, is **inert wherever the canvas width is capped** — it
then hashes a canvas nobody repainted and reports either a vacuous pass or a
false "PAINTED NOTHING". Toggle a display parameter instead, and print the
string count. And a collision check that runs only settled states **never
paints the choreography's captions**, which is how a label sitting on the
column headings survived one round.

## Widget 36 · `naive-bayes` — Naive Bayes · SHIPPED 2026-08-30

**Arc A slot 5, PHM5005 `04-3 Tour of Algorithms` § Probabilistic — eight
review rounds in one day.** The claim: P(y|x) ∝ P(y)·ΠP(xⱼ|y), a prior times
one likelihood per feature, whatever shape each likelihood takes. Kenneth's
structural picks (rounds 0–1, via AskUserQuestion then the mock):
**synthetic data illustrating continuous AND discrete likelihoods**, both
acts in scope, then **Continuous · Discrete as separate tabs, each with its
own correlation act** — not the one mixed ledger the mock proposed — and
**disease / no disease with real-name features**: CRP + WBC (Gaussian rows),
fever + chills (Bernoulli rows). Ledger form A with C's running total, from
the three mocked candidates in `_lab/nb-mock.html`; title *Naive Bayes* over
the catchier options, his call.

**Measured before anything was drawn** (`_lab/nb-design.py`, closed-form
mixed NB vs sklearn to ~4e-16), **and the design's one real trap is recorded
there**: the correlation act only tells the double-counting story when the
second feature is REDUNDANT — matched standardized shifts for the labs
(both move 1.333 pooled SD), matched rates for the symptoms (0.70/0.25
twice). With mismatched shifts the CORRECT model *exploits* the correlation —
the residual turns class-informative and its posterior runs to 1.000 at
ρ 0.99 — which teaches "correlation is free information", the opposite of
the notebook's caveat. The population parameters are load-bearing, not
flavour. Measured act receipts: continuous, NB flat at 0.584 while correct
relaxes to the one-lab 0.437; discrete with both symptoms present, NB 0.771
flat against correct 0.545 at λ 1 — and λ is capped at 0.95 because at 1 a
mixed cell (present, absent) has probability 0 in both classes.

**The rounds, each its own commit:**

1. **Build**: the ledger (readoff left, log-odds evidence bar right, prior +
   two features + running total), fitted live on a seeded cohort (n 400,
   prevalence 0.3); MathML card; correlation gate per tab.
2. **Per-feature pills** — Kenneth: "use buttons to select features to add".
   The generic Step died; each feature has a membership pill, admission is
   URL state, the product visibly commutes, Step/Play declined (4.5), bars
   ease on the request door. The gate moved BELOW the pills. Caught in the
   same round: with one feature admitted the card printed
   `0.37 × LR(CRP) × 0.56 = 0.21` — an equation false as read; it now prints
   only the factors actually in the product.
3. **"The patient" read as possibly ground truth** — renamed everywhere to
   *A new patient*, disease status unknown; only the training cohort's
   status is known.
4. **The readoff column labelled as the trained model** (a header over the
   panels), then
5. **moved below the prior row** so it heads exactly the distributions, then
6. **restyled as parallel headings** — *Prior* and *Model* in one voice,
   subtitle "distributions fitted to the training data", counts dropped
   (2.10: nothing that can date).
7. **The symptom panels were quietly lying.** They drew P(patient's state |
   class), so flipping the Fever checkbox changed bars sitting under the
   "Model" heading — Kenneth: "I thought they are stable?" They are: each
   Bernoulli panel now draws the FULL fitted distribution (absent and
   present pairs, never moving) with the patient's outcome framed in the
   highlight — the exact analogue of the Gaussian panels' patient rule.
8. **Polish**: the gate became a segmented **The two features: Independent |
   Correlated** (two readings of one fit — what a segmented is for), and a
   comment sweep stripped round narration and editorial phrasing.

**Promotion, and what recording it found.** Eight states — six settled, two
driven mid-grow — via three full-suite runs at DPR 1.25, all moved hashes
byte-identical across runs, spliced, confirming run **257 of 257 MATCH**.
The pills are `<button data-param>` setParam could not toggle, so the
harness was taught them (the third option controls.js's note sanctions):
click only when `aria-pressed` differs from the target. **That fix exposed a
shipped instance of 5.7's silent-no-op failure: time-event's two "driven"
states (set on its age/snps pills) had been INERT since their 2026-08-29
recording** — the old generic branch wrote `.value` to the button and fired
an event nothing listened to, so both states had been photographing
undriven figures. Rebaselined in the promotion commit, with the new tx of
each equal to its settled sibling's — the proof the param now flips.

**Recorded, not fixed**: the continuous act's default patient is discordant
(CRP up, WBC down), and for a discordant patient the correct posterior
RISES at high ρ — the mismatch between two supposedly-correlated labs is
itself informative. Honest, measured, explorable; the caption's claim is
the one true for every patient (the naive Bayes line is flat because its
inputs, the marginals, never move). The overconfidence story appears when
the reader raises WBC to concordance. Untested geometry: none — no regions,
no drag; the pills' ease is covered by the two driven states.

## Widget 35 · `metrics` — Scoring the Predictions · SHIPPED 2026-08-30

**The second 04-2 widget, Kenneth's brief 2026-08-30**: widget 34 owns the
threshold story; this one owes the METRICS themselves — scoring a numeric and
a categorical outcome, the confusion matrix the centre of the categorical
half. **No ROC anywhere, by his decision** ("maybe we leave out ROC for now …
we have a widget already"): it never draws a curve and never moves a cutoff.

**Two misconceptions, one per tab:**

- **Numeric** (grade: reported): that RMSE, MAE and R² are interchangeable
  summaries of one thing. Measured (`_lab/metrics-measure.mjs`, 60 seeds):
  at σ 3 one outlier of 18 points moves **RMSE +38% and MAE +16%**; and R²
  is not an error but a comparison against predicting the mean — the mean
  model reads R² = 0.000 exactly, RMSE = SD(actual).
- **Categorical** (grade: documented — 04-2's own cell 25 blames class
  imbalance): that accuracy says how good a classifier is. Every metric is a
  different ratio of the SAME four cells; measured at separation 1.5,
  prevalence 0.5 → 0.05 sends **accuracy 0.77 → 0.95 while recall collapses
  0.77 → 0.14**, the all-negative baseline nearly tying. The trap needs the
  PLUG-IN rule (the cutoff a default logistic regression trained at that
  prevalence applies at 0.5 — cutoff log((1−p)/p)/d on the latent scale): a
  fixed midpoint cutoff holds every rate constant and shows no trap, measured
  side by side.

### Round 0 — measured and mocked (2026-08-30), Kenneth's seven picks

`_lab/metrics-mock.html` drew six candidates from the measured numbers
(A plain stage · B MSE-as-squares vs MAE-as-bars · C R² as model squares vs
mean-model squares · D matrix counts+wash vs dot-per-patient · E per-metric
cell lighting · F the trap at two prevalences). Kenneth picked: **(1)** the
`metric` pick lights that metric's anatomy on the figure (a control, not
hover-only); **(2)** matrix cells as counts + row wash (the widget-34
convention); **(3)** the trap lives on the prevalence dial with an
all-negative baseline tile, not a two-cohort view; **(4)** a screening frame
("disease present/absent" — precision reads as PPV); **(5)** body fat % for
the numeric act (04-2's own example; Normal(19, 8) clipped to [5, 40] matches
bodyfat.csv's mean 19.2, SD 8.4); **(6)** the R² ease (the model's
predictions slide to the mean line, errors growing on the way); **(7)** title
**Scoring the Predictions**, slug `metrics`.

### Round 1 — built as a draft (2026-08-30)

One widget, two tabs on a segmented `target` (Numeric · Categorical, the
notebook's own split). Generators live in `widgets/metrics/model.js` and the
measure script imports FROM the widget (the lm-diagnostics rule) — re-run
after the move, every number identical. No Step and no Play; the one motion
is the R² ease on core's ease-request door (widget 15's shape). The numeric
plot is SQUARE on one shared domain, because a drawn square is only an honest
squared error if a unit of x and a unit of y are the same pixels; each error
square grows TOWARD the diagonal, whose horizontal distance equals the
residual, so the far edge touches the line and no square leaves the frame.
The categorical `metric` control is three grouped rows (widget 9's door) and
the captions are the lesson: **"read off everyone"** (Accuracy) against
**"about the disease class"** (Precision · Recall · F1) — five segments in
one row also truncate in the rail, so the grouping is both the fix and the
teaching. Tiles: RMSE/MAE/R² plus an **Outlier pull** tile when outliers > 0;
the four classification metrics plus the **all-negative baseline**
("accuracy has to beat this"). Verified in the pane: seed-1 numbers to the
digit against the measure script on both tabs, the ease landing with a clean
error counter, the canvas text sweep clean at the trap state (prevalence
0.10: cells 171/1/22/6, accuracy 0.885, recall 0.214) and at the σ 8 edge.

One housekeeping note: the round-1 splice re-serialised
`fingerprint-baseline.json` at indent 2 — which is what the harness's own
Copy button emits (`fingerprint.html` line ~400), so the one-time whitespace
churn in that commit is the file arriving AT the format future rebaselines
will produce, not drift.

### Round 2 — Kenneth (2026-08-30): MathML, the score histograms, and ROC folded in

His three asks, all in: **(1) formulas in MathML**, consistent with widget
15 — they moved off the canvas into a `.w-math` card above the figure
(engine-checked with the compare-math-to-math probe, plain-text fallback,
one `<math>` per term so the card wraps at the seams, memoised on its
printed string because draw() runs per frame; the card is inside the `tx`
hash, which is where formulas belong). Every formula wears the live numbers
of the state on screen. **(2) The score histograms**, widget 34's overlaid
strip (counts, one shared y — densities would hide the prevalence dial)
with the threshold line at 0.5, "predicted −/+" said once at its feet, and
the threshold DRAGGABLE on the strip only (`drag.hit` gates by concept and
strip bounds). **(3) ROC folded in**: `target` became **`concept` —
`numeric` · `threshold` · `roc`** — so one notebook link lands on any of
04-2's stations (`?concept=threshold`, `?concept=roc`), the grouped
segmented saying the taxonomy (Numeric / categorical: Confusion matrix ·
ROC curve, captioned threshold-dependent vs -independent).

**What made the fold-in one generator instead of two**: for latent
z ~ N(±d/2, 1) the log-likelihood ratio is d·z, so the trained model's
calibrated probability is σ(d·z + logit(p)) — and **cutting that at 0.5 is
algebraically round 0's plug-in rule**. `model.js` now returns per-patient
probabilities (`categoricalPatients`), the cells are `cellsAt(patients,
threshold)`, and the round-0 measure script re-ran BYTE-IDENTICAL through
the wrappers (the "mid" comparison rule maps to prob ≥ p). The ROC walk is
widget 34's per-patient staircase; AUC by column sums.

**The boundary with widget 34, decided here**: the curve opens FINISHED in
this widget — its concept is what threshold-independence *means* (drag the
threshold: the dot moves ALONG the curve, AUC's tile does not), while
widget 34 keeps the construction story (the trace, Youden, find-optimal).
Rule 4 is not offended because the curve is not this widget's withheld
answer; flagged for Kenneth's review regardless. ROC tiles: AUC first
("the one number the threshold cannot move"), then accuracy/recall/
precision each noted "at threshold X". Verified in the pane at 1280 and
narrow: all three concepts, the drag writing `?threshold=` (0.50 → 0.34
moved TPR 0.545 → 0.773, FPR 0.112 → 0.201, AUC still 0.850), the trap
state at prevalence 0.1, zero console errors.

### Round 3 — Kenneth (2026-08-30): two-level selection, widget-34 parity, the positive-class pick, ROC's whole act

His four asks, all in. **(1) Two-level selection**: `Outcome` (Numeric ·
Categorical) first, then `Metric family` (Confusion matrix · ROC curve)
appearing only on categorical — his posed alternative "threshold
dependent/independent" lives in the options' details, so both vocabularies
are on screen (my pick: concrete nouns on the buttons, the taxonomy in the
detail line). Deep links became `?outcome=categorical&view=matrix|roc`.
**CORE grew `when: { all: [...] }`** for it — the metric picker exists on one
view of one outcome, a field gated on a field that is itself gated, and
gating on the view alone showed it under the numeric outcome (whose hidden
view value was still "matrix"). A conjunction of the declarative forms keeps
the rebuild rule; the full suite ran for it: **238 of 238 recorded states
MATCH** (the two metrics placeholders DIFFER by design, hashes "0").
**(2) Widget-34 control parity**: Separation (0.2–3, roc-auc's range), Class
balance (labelled so, detail keeping "prevalence"), Sample size n (60–600).
**(3) The positive-class pick**: a `positive` segmented (Disease · No
disease) that **RENAMES the matrix cells instead of recounting them** —
sklearn's per-class rows one at a time; the strip's "predicted −/+" feet
flip with it, the formula card and every per-class tile follow, and the
all-negative baseline generalises ("say <other class> for everyone").
Verified identity: weighted recall = accuracy (0.775 = 0.775 at the
default). classification_report's **Macro avg and Weighted avg tiles appear
only when a per-class metric is picked** — the crowd control he asked for.
**(4) ROC's whole act, ported from widget 34**: the curve opens UNTRACED
(AUC "—", "trace the curve first"), Next patient / Trace with Play speed,
one effective threshold everywhere mid-sweep, the strip-confined drag, and
the MOMENTARY find-optimal pill — scan, ring, from-arrow, landing by moving
the threshold through the exported setParam (verified live: 0.50 → 0.29,
pill self-released, URL kept only `?threshold=`). The walk engine
(rocWalk/aucOf/youdenOf) is **copied from roc-auc/model.js, deliberately
not imported**: a cross-widget import would let an edit there silently
change the numbers here, and both copies answer to sklearn. `?shown=999`
publishes the finished curve; `?youden=1&shown=999` opens found.

### Round 4 — Kenneth (2026-08-30): the averages row, the coloured pick, the trace as a one-way door

Three tweaks, all in, two of them through small core doors (one suite run
covered both: **238 of 238 recorded states MATCH**, metrics placeholders
DIFFER by design). **(1)** Macro/Weighted avg tiles start their OWN row —
core's readout accepts `{ break: true }`, a full-width zero-height grid cell
(adds no text, so `tx` sees nothing): an average over both classes is a
different KIND of number from the per-class tiles beside it. **(2)** The
positive-class buttons wear their histogram hues — a segmented option may
declare `token:` and core renders a swatch dot before the label (params.js
passes it through; array-form options only, like `group`). **(3) The trace
is a ONE-WAY DOOR, and the door is a PARAMETER.** His question: after
animating the trace, should a data change reset the curves, or display
instantly so students explore what bends a ROC curve? The answer is a
hidden display param `traced`, written true through the exported setParam
when the trace first lands (or the pill completes the curve, or a
`shown=999` link opens finished): from then on every data change — n,
balance, separation, seed, positive class — redraws the FINISHED curve
instantly. Reset closes the door (it returns every parameter to default);
**Replay still retraces**, via one interception in `advance`: with traced=1
a fresh init opens finished, so a run/step arriving on a finished figure is
the reader asking to watch the build again. A shared URL carries
`traced=1` and opens the way it looked — invariant 1 kept.

`positive` also widened to the ROC view: the walk is scored FOR the chosen
class (score 1 − p, labels flipped), so flipping it point-reflects the
curve while **AUC does not move** — verified live at balance 0.1: AUC 0.844
both ways, sensitivity/specificity swapping 0.99/0.21 ↔ 0.21/0.99,
accuracy unchanged. The Youden landing, the sweep line and the card all map
the walk's score scale back to the strip's probability-of-disease axis.

### Round 5 — units and the last copy pass (Kenneth, 2026-08-30)

RMSE and MAE print as **plain floats with the unit leading the note** ("%
body fat; penalises large errors more") — his pick B from
`_lab/metrics-units.html`, which drew the three candidates in real tile
markup: the outcome happens to be measured in percent, so "2.59 %" read as
a RELATIVE error of 2.59%, and the notebook's own print() shows plain
floats. The card ends "= 2.59". His copy sweep landed the same hour: "the
biggest miss owns the sum" → "large errors dominate the sum", "squaring
hands the big miss the sum" → "squaring amplifies the outlier", "every miss
weighted alike" → "all errors count equally", "finding the sick / clearing
the well" → "disease / no disease counts as positive", "others cleared" →
"true 'no disease' correct".

### Promotion — 2026-08-30, on "push to gallery"

**Eleven states recorded the honest way** (the widget-31 full-suite route):
the eleven URLs went in as placeholders, THREE clean suite runs at DPR 1.25
read the same eleven hash pairs with all 238 pre-existing states matching
on every run, the hashes were spliced, and the confirming run read **249 of
249 MATCH**. Nine settled (both numeric metric acts, the matrix with lit
cells, the renamed-cells state at prevalence 0.1, the untraced ROC opening,
`shown=999` traced, `youden=1&shown=999` found, and the one-way door at
`traced=1&threshold=0.3`), two driven (`click: "run"` 40 frames mid-trace —
tx moving with the sweep, the non-inert proof — and `set metric=r2` 8
frames mid-bend, whose tx equals the settled state's, correctly: only the
picture moves during the ease). Both drives differ from their bare URLs.
**Untested geometry, recorded**: the threshold drag (no harness verb), the
find-optimal scan mid-flight and its landing write, and the positive-class
flip mid-trace.

**One run was discarded, and the diagnosis is worth keeping**: the suite
started while the Browser pane was HIDDEN — DPR 1, the first `clt` state
hashed wrong px with identical tx (the documented environmental signature)
— and **taking a screenshot is what DISPLAYS the pane**: DPR snapped to
1.25 on the next probe. The clean-run protocol that followed: screenshot to
wake the pane, verify DPR 1.25, THEN reload so the run starts clean, and
trust a run only when the 238 pre-existing states all MATCH — that
all-match is the proof the whole run stayed at 1.25.

Shipped with 04-2's notebook link owed
(`https://nusmedicine.github.io/statml/widget/metrics/`), judging projected
owed like every widget since 10, and widget 34 UNLISTED in the same push —
see its section.

## Widget 34 · `roc-auc` — Scoring a Classifier · SHIPPED 2026-08-29, six rounds in one day · UNLISTED 2026-08-30

**UNLISTED, not deleted (Kenneth, 2026-08-30)**: widget 35 `metrics` carries
the ROC act now, so this widget left the gallery — but it stays at its URL
(students hold links), wears no draft bar, and keeps its seven fingerprint
states. `status: "unlisted"` is a third status minted for exactly this;
`scripts/check.mjs` documents it.

**The misconception**: that the ROC curve is a static property of the model — a
picture you look up — rather than the trace of every possible decision
threshold, each point of it one whole confusion matrix; and that a good AUC (or
a good accuracy) settles which threshold to act at. **The evidence is `04-2`'s
own cell 39, measured 2026-08-29** (`_lab/roc-measure.py`, sklearn, the
notebook's exact pipeline): at threshold 0.50 and at Youden 0.3137 the test
accuracy is **0.70 both times**, while missed deaths go **9 → 3**. Accuracy
cannot pick a threshold, and AUC does not try — the choice is a clinical
trade-off the reader should make with a drag.

**Provenance — Kenneth's D3 app.** The widget grew from an app Kenneth uploaded
(kept verbatim as `_lab/roc-app-original.html`): threshold slider, class
separation, noise, sample size, class balance, score distributions, ROC + AUC +
Youden, confusion matrix. Cut in translation, each on a standing rule: unseeded
`d3.randomNormal` (rule 6); regenerate-on-every-slider-move (rule 2 — same URL,
same figure); the separate **Noise** slider (after the app's own min–max
normalisation only separation ÷ noise survives — one Separation dial carries
it, and the min–max rescale itself was replaced by a fixed logistic squash so
the axis is not a function of the two most extreme draws); and opening with
the optimal point already marked (rule 4 — Youden is a reveal).

**The measured numbers, all reproduced to the digit from notebook 04-2 cells
16–39** (`_lab/roc-measure.py` writes `_lab/roc-ref.json`; the widget embeds
the 60 test probabilities in `roc-auc/model.js`): heart-failure logistic
regression (class_weight balanced, random_state 42, stratified), test AUC
**0.740693**, Youden threshold **0.313674** (TPR 0.842, FPR 0.366), cm at 0.50
[[32,9],[9,10]] → at Youden [[26,15],[3,16]], train AUC 0.831. One geometry
note: sklearn's `roc_curve` returns **24** points (drop_intermediate removes
collinear ones); the per-patient walk has **61** — identical curves, and the
walk is what the animation advances.

### Round 0 — the mock, and Kenneth's six picks (2026-08-29)

`_lab/roc-mock.html` drew four candidates from the real numbers: **A** the
strip alone, **B** the linked strip + ROC pair, **C** the sweep-trace entry,
**D** the simulated act. Kenneth picked: **(1)** B as the main stage; **(2)**
TWO tabs — *Threshold* (real test set) · *What moves the curve* (simulated);
**(3)** Youden as an **overlay toggle**, not a claim pill; **(4)** threshold as
a **draggable line on the canvas** — no rail slider; **(5)** Sample size n
**kept** as a control on the simulated tab (its lesson: the staircase gets
chunky at small n); **(6)** title **Scoring a Classifier**. The trace-as-entry
(C) rode along unopposed.

### Round 1 — built (2026-08-29), the shape

- **Stage**: strip left (one dot per patient, deaths above / survivors below,
  quadrant counts at the threshold line — the four regions ARE the confusion
  matrix), ROC square right. Below 640px canvas width the square drops under
  the strip and the height function pays for it.
- **The curve is never given away**: it opens untraced, and Step (**Next
  patient**) / Play (**Trace**) sweep the threshold from 1 to 0, the staircase
  growing one patient at a time — up for a positive, right for a negative,
  which is AUC's own rank reading. AUC's tile reads "—" until the trace
  lands; `?shown=999` publishes the finished figure. Mid-trace the sweep owns
  the dashed line and the quadrant counts hide (they describe the reader's
  parked threshold).
- **The threshold is dragged** through core's drag channel (`ew-resize`,
  ±strip-width relative, snapped to 0.01) — a display parameter, hidden from
  the rail, still in the URL. Dragging it moves the dot ALONG the curve and
  every tile except AUC; that stillness is the concept.
- **Tab 2 simulates** n ∈ [60, 600] patients, latent Normal(±sep/2, 1)
  squashed by a fixed logistic; per-class score histograms in COUNTS, not
  densities, so the balance dial is visible in the picture. At sep 1.3 the
  empirical AUC read 0.825 against the binormal Φ(1.3/√2) = 0.821.
- **Youden** is an `afterDrive` toggle (the withheld-answer position, widget
  10's rule): a `--c-theory` ring on the curve plus a tile, only once the
  curve is traced.
- Verified in the pane: the notebook numbers to the digit on the tiles, the
  drag writing `?threshold=`, the trace running to Replay with a fresh
  `window.onerror` counter clean. Draft status; placeholder fingerprint
  states carry both zero hashes until promotion.

### Round 2 — one page (Kenneth, 2026-08-29): "the first tab is duplicating the second"

His four asks, all in: **(1) one page with the controls** — the real-test-set
tab is CUT and the simulated cohort with its dials is the whole widget (the
all-simulated precedent is lm-diagnostics; the 60 real patients stay in
`model.js` and the measure script as the pinned reference, no longer drawn);
**(2) the ROC sweep kept** unchanged; **(3) a confusion-matrix panel added**
under the strip, its counts moving as the threshold is scrubbed — and its
GEOMETRY follows the strip rather than sklearn's print order: true + on top,
predicted − on the left, so the table is literally the strip's four quadrants
folded inward ([[FN,TP],[TN,FP]] where sklearn prints [[TN,FP],[FN,TP]]) —
flip the rows if the notebook's order should win; **(4) Youden became a
FIND-OPTIMAL button** (`style: "pill"`, still the `afterDrive` withheld-answer
position): pressing it completes the curve if it is untraced, then a probe
scans along it carrying the vertical segment down to the chance line —
Youden's J made visible — and lands on the longest one (ring + tile + the
segment left standing). The scan runs on core's ease-request door
(`anim.easing` in rebuild), ~1.4 s; Replay with the pill pressed retraces and
then re-finds, because `advance` starts a missing scan whenever the trace
lands with the pill on.

The strip's dots became per-class HISTOGRAMS (counts, one shared y-scale —
per-class densities would hide the balance dial) in the same two-row geometry,
so the threshold line still cuts four quadrants and the quadrant counts kept
their places. Tiles: AUC (withheld until traced) · Accuracy · Sensitivity ·
Specificity, plus the Youden threshold once found; the Missed tile went — the
matrix's FN cell carries it. Pane-verified: pill press from untraced completes
and scans to the ring (the pane's ~300 ms rAF throttle stretches the 1.4 s
scan to ~7 s there — the known harness artifact, not the widget), `?youden=1`
in the URL, `?youden=1&shown=999` opens found, fresh error counter clean.
One placeholder state updated to `?theme=light&youden=1&shown=999`.

### Round 3 — overlay, live matrix, matrix UX (Kenneth, 2026-08-29)

Three fixes, all in: **(1)** the two histogram rows became ONE overlaid panel
("hard to see overlap" — and the overlap IS the problem the threshold cannot
solve); the quadrant counts at the line went with the rows, replaced by
haloed "predicted −/+" side labels at the line's feet, the matrix now the
counts' one home. **(2)** One EFFECTIVE threshold everywhere: mid-sweep the
line, the matrix and the tiles all follow the sweep (verified: captions tick
0.95→0.90…, sensitivity 0.07/specificity 0.99 early in the sweep), snapping
back to the reader's 0.50 when the trace lands. **(3)** The matrix redrawn to
the standard advice for these tables: sklearn's own orientation (rows = true
class, negatives first — the folded-quadrant layout died with the split
strip), spanning axis titles ("predicted" over the columns, "true" rotated at
the rows) with the class names spelled out, each row washed in its class's
histogram hue with wash strength = the cell's share of its row — a
row-normalised heatmap, so TN and TP darken exactly as specificity and
sensitivity rise — count large, "% of negatives/positives" small beneath
(the TP cell's percentage IS sensitivity, the link to the tiles).

### Round 4 — the search is an action, and speed returns (Kenneth, 2026-08-29)

**(1) Find-optimal is no longer a toggle.** The pill is now MOMENTARY: press
it, the curve completes if untraced, the probe scans, and when it lands the
THRESHOLD MOVES to the optimum — the widget writes `threshold` (and releases
its own pill) through the exported `setParam`, the door that syncs the rail,
deferred 350 ms so the landing is seen before the line moves. The lasting
state of record is the threshold parameter alone (`?threshold=0.59` is what
the URL keeps; `youden=1` appears only transiently). The strip draws the
receipt: an arrow from where the line stood to where it landed, "from 0.50"
at its tail — anim state, cleared by the next data change or by dragging the
line away (the ring stays; it marks a property of the curve, not of the
reader's threshold). A stale apply-timer is disarmed by a `params.youden`
guard, so Reset inside the beat cannot be overwritten. The legend's theory
entry went STATIC — the optimum's marks are anim state a legend function of
the parameters cannot track, and the CLT precedent lists an overlay whether
or not it is on screen. **(2) Play speed is back**: Slow / Medium / Fast
(9 s / 4.5 s / 2.2 s whole-sweep), a display choice below the drive row per
the rail convention, touching only the trace rate — the find-optimal scan
keeps its fixed 1.4 s. Also: the patients note dropped inside the strip
panel — on the caption line it collided with the threshold label whenever
the threshold sat right of ~0.55.

### Round 6 and promotion (Kenneth: "great, can push to gallery", 2026-08-29)

Round 6 was copy polish on Kenneth's ask — no directions in the subtitle, no
editorializing: the drag instruction left the subtitle (which now closes on
the notebook's claim, "the area under it summarises performance across all
thresholds"), the legend went to plain names ("Random baseline" is the
notebook's own term for the diagonal), tile notes reduced to counts, the n
slider's "chunkier staircase" quip cut, and the source comments trimmed to
their load-bearing whys.

**Promoted with seven states via `_lab/roc-shoot.html`** (the lm-shoot
pattern): copy proved 4/4, every state shot three times in one run and
identical, both drives non-inert against their bare URLs. Five settled — the
untraced open (`shown=0`), the traced default, found-by-URL
(`youden=1&shown=999` — the pill is a `<button data-param>` setParam cannot
toggle), the threshold at 0.7, and a weak imbalanced n=320 cohort — plus two
driven: the trace mid-sweep (`click: "run"`, 40 frames — line, matrix and
tiles all following the sweep) and a single step mid-flight. The confirming
full-suite run read **237 of 237 MATCH**. Untested geometry, recorded: the
threshold drag (no harness verb), and the find-optimal scan's mid-flight
probe plus its threshold-moving landing (reachable only through the pill).
One shooter lesson: **the pane reports DPR 1 until it is DISPLAYED and can
flap back to hidden between runs** — the shooter now waits for 1.25 before
shooting rather than recording a mixed-environment pass its own copy-proof
would refuse.

Still owed post-ship: the 04-2 notebook link (Kenneth places links by hand)
and the judged-projected review.

### Round 5 — the drag confined to the strip; core grows `drag.hit` (2026-08-29)

Kenneth circled an arrow reading "from 0.48" and asked why not 0.50. The
arrow was honest; the drag surface was not: `drag` covered the WHOLE canvas,
so a casual click-and-slip on the ROC square nudged the threshold ~0.02 per
8 px with nothing calling attention to it, and Find-optimal faithfully
recorded the drift. **Core gained `drag.hit`** — optional, the `scrubHit`
shape: `({ x, y, w, h, params, state }) => bool` gates both the gesture and
the advertised cursor; absent, everything behaves exactly as before (and the
cursor handler registers only when `hit` exists, because t-sne pairs an
ungated drag with regions and relies on the regions handler's pointer
cursor). The widget confines its threshold drag to the strip rect with
margins for the label row and the axis. Verified: a 60 px drag on the ROC
square moves nothing, the same drag on the strip moves the threshold, cursor
`ew-resize` over the strip and `default` elsewhere, t-sne's cloud still
turns.

**The core change ran the full suite THREE times** (232 states; the two
roc-auc placeholders read DIFFER by design). Run 1: five lm-adjustment
states DIFFERed on `px` only, `tx` identical on all five. Run 2, with the
core change stashed as a control: **all 230 real states MATCH** — the
baseline was fine. Run 3, change restored: **all 230 MATCH again**. So the
five were one occurrence of the documented pane flake (the audit's clt case
had the same px-only/tx-identical signature), now seen striking five states
of one widget in a single pass — worth knowing it can cluster. Nothing was
rebaselined.

My guess at the evaluation arc's spine, for you to overwrite:

> a model that fits → a model that generalises → an honest estimate of how well → a probability you can act on

| # | slug | concept | misconception targeted | evidence |
|---|---|---|---|---|
| 1 | `overfitting-capacity` | Overfitting and capacity | That overfitting can be diagnosed from the training curve alone, or that low/zero training loss *is* overfitting. Students then tune learning rates instead of concluding the dataset is too small | **documented** |
| 2 | `data-leakage` | Train/test leakage | That any random split is a valid split. 40.5% of students preferred a model trained on shuffled data *because its test R² was higher*. Rarely taught in introductory courses at all | **documented** |
| 3 | `cv-nested` | Cross-validation and selection bias | That a CV score is still honest after choosing hyperparameters on those folds. Fewer than 10% recognise that un-nested CV inflates the estimate | **documented** |
| 4 | `imbalance-metrics` | Metrics under class imbalance | That 99% accuracy on a 1% prevalence outcome is a good model | **documented** |
| 5 | `calibration` | Calibration vs discrimination | That good AUC means the predicted probabilities are usable at the bedside | reported |

Then: `bias-variance` · `learning-curve` · `dimreduce-artifacts` ·
`feature-importance`. (`regularization-path` has left this list — it is built, as
`linear-regularization` in Arc A.)

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

## The cross-widget audit RAN on 2026-08-27, free surfaces shipped

The prose half is merged and live: all 24 subtitles and blurbs rewritten in a
register Kenneth settled line by line (design-principles **2.10** and **3.7**
now carry it), metas locked to blurbs by a `check` assertion, widget 7 retitled
**Decision Making** (slug kept until the course ends), and the rail unified
(Play speed's paces, True groups, Groups in the data). One teaching claim
changed and belongs here: **balancing-data's copy said class weights rebalance
the training data; they do not — they reweight the fit.** Caught by Kenneth in
review; blurb, subtitle and meta now say so. The hashed half (legend casing,
readout notes, canvas captions, `--c-reference`) is still owed —
[HANDOVER.md](../HANDOVER.md) § *NEXT* has the batch.

### THE RAIL-SECTION SWEEP followed the same day — Kenneth's data/algorithm rule

Kenneth: where a rail carries a **choice of data**, it should say so — a data
section and an algorithm section. Candidates were drawn at the real width in
[`_lab/dimred-rail.html`](../widgets/_lab/dimred-rail.html), three rounds, and
he picked one at a time. Landed: **t-sne, umap, pca, mds** (per-widget entries
above), then **maximum-likelihood** (*The population / The inference* —
bayesian's pair minus the prior, "Estimating" leading the inference block),
**confidence-interval** (*The data / The intervals*; seed rose into the data
block, Play speed went below the buttons), and **em-mixture** (*The
populations* headed; "Inference" harmonised to bayesian's *The inference*,
3.7). The sweep also fixed core: `.w-section` now spans its grid row
(`grid-column: 1 / -1`) — in the stacked layout the heading's hairline used to
stop at one cell, reported from mobile; suite 159/159 after. **Left flat, each
for a reason**: galton (no algorithm exists), multiple-testing (no testing
knobs), missing-data (deliberately no algorithm), probability-mechanisms and
odds-and-risk (view-switched rails), generalization / linear-regularization /
logistic-regression (no data choice), trees (one method knob on one page).
**Kenneth then ruled the boundary the inclusive way**: the choice of data is
marked wherever it exists, even when the algorithm block heads watch-controls
(bootstrap) or the data section holds one control (svm). Landed the same day:
**svm** (*The data / SVM*), **bootstrap** (*The population / The bootstrap*,
Play speed below the buttons — and the truth reveal now sits with the pile it
overlays rather than after Seed, superseding 3.4j's position for this widget;
the source comment records it), **clt** (*The population / The sample means*)
and **permutation-test** (*The population / The test*, True effect in the
population block — a fact about the data the test never gets told). All four
with Play speed below the buttons. Every make-data widget in the collection
now marks its data block; the flat rails named above stay flat.

---

## Widget 25 · `missing-data` — SHIPPED 2026-08-27

**Planned, measured, built, revised over seven rounds of Kenneth's review and
promoted in a single day** — the fastest widget in the collection, and the
first planned for both courses since t-SNE. Judged projected the same day.
Seven fingerprint states (five settled, one driven mid-beat, one interrupted),
recorded with `_lab/missing-shoot.html` on the kmeans-shoot pattern: the copy
proved against four existing baseline hashes first, three byte-identical runs,
no full-suite rerun owed since nothing in `widgets/core/` moved.
`node widgets/_lab/missing-drive.mjs` is the no-browser driver: 130 assertions.

### The seven rounds, each begun by something Kenneth saw

1. **The check panel read as "the age distribution is bad."** Grey bars under
   an age axis look like a histogram of age. Bars became a dot-and-line
   profile against a dashed overall-rate line.
2. **His three questions became three features**: the profile still needed a
   mental inversion, so it became a weighed/not-weighed **composition** per
   band (the VIM::aggr shape the PHM5003 lesson itself uses); "can the data
   tell you the mechanism?" became the **verdict line**, computed from the
   visible data only — keying it off the mechanism parameter would tell the
   student what a study cannot know (per-rate thresholds measured: misfires
   2/1200 at the default rate, an honest 93/1200 at 10% where twelve missing
   patients is genuinely too few); "why is MAR imputable?" became the
   **observed trend** — hidden weights sit −0.1 kg off it under MCAR/MAR and
   **+10.0 ± 1.1 kg above it under MNAR, 400/400 cohorts** — the reason
   conditional imputation works, shown without an imputer.
3. **Conventional terminology throughout** — "holes" and the dashboard
   description out of every visible surface, "associated with" for "follows",
   "Percentage missing" naming both the control and the panel.
4. **True values moved after Seed** as a segmented Off/On — the clustering
   pair's pattern; 3.4j's below-the-drive-row placement was reversed for arc
   consistency. Verdict onto its own reserved line (3.4k). **Mean rules onto
   the pile** so the mean tiles have marks to match — tiles are means, scatter
   lines are trends, and each reading now has its surface.
5. **The Missing-vs-trend tile, and its note retracted.** The tile quantifies
   the trend picture (+9.6 kg at the default MNAR seed). Its note claimed "the
   mean's bias is the percentage missing times this" — printed, checked on
   screen, and found FALSE: wrong sign everywhere, and wrong outright under
   MAR, where the mean's bias comes from age composition rather than any
   residual gap. No phrasing is true in all three tabs, so the tile keeps the
   number and the prose stays silent. The identity (bias = −share × gap) is
   real for age-flat mechanisms and belongs in lecture, not on a shared
   surface.
6. **Pacing beats.** A step became one patient watched — a fixed 340ms unit
   spanning frames — and Slow/Medium choreograph each arrival (highlight
   colour, collapsing ring, final colour on landing) with Fast declaring none
   (4.1). Verified by hand-pumping requestAnimationFrame: an interrupted
   mid-beat step then Play runs clean to the end. Marks sized against widget
   11's projection failures: 2.5×11px ticks, 3.8px dots, 2px rules.
7. **The blurb was the gallery's only fragment** — now one declarative
   sentence, meta synced under check's assertion.

### The planning record (2026-08-27, pre-build)

### TWO HOSTS, one per course — the first widget planned for both since t-SNE

| course | notebook | what it does |
|---|---|---|
| PHM5003 | `05 / 02 — Missing Data and Imputation`, cells 1–23 | R. Simulated 50×10 omics matrix; MCAR by random deletion, MAR by batch (first five samples), **MNAR by detection limit** (`data < 3 → NA`); `VIM::aggr` pattern plots; mice imputation demo |
| PHM5005 | `03-4 — Data Preprocessing`, cells 16–19 | Python. The MCAR/MAR/MNAR taxonomy, delete-vs-impute decision, sklearn imputers on `heart_failure_alpha_missing.csv` (measured: serum_creatinine 31% missing, MAR on ejection fraction; serum_sodium 10%, ~MCAR) |

**The PHM5003 lesson's cell 19 states the widget's claim in its own words**:
comparing the patterns visually, MAR shows its association with an observed
factor, but *"it is difficult to distinguish MCAR from MNAR as the patterns
appear random."* The widget makes that sentence operational — a check you can
run that sees MAR and cannot see MNAR — and adds the half the lesson asserts
without showing: that while MNAR *looks* like MCAR, its observed data are
biased and MCAR's are not. Cell 23's "most cases in high-throughput data are
MNAR" is why the distinction earns a widget. The lesson's MNAR is censoring
from below (detection limit); the clinic scenario censors from above (the
heavy avoid the scale) — same mechanism, opposite tail, and the widget stays
lesson-agnostic per 2.10.

**The misconception, named by Kenneth**: students cannot tell MCAR, MAR and
MNAR apart. Not "students impute badly" — **imputation is explicitly out of
scope** for this widget — but the taxonomy itself never becoming concrete. The
widget exists to make the three mechanisms *visibly different things*, and to
land the one fact about them that matters in practice:

> **MNAR passes every check you can run.** MAR is diagnosable — the missingness
> follows a variable you observed. MNAR follows the missing value itself, so
> its diagnostics look exactly like MCAR's while the observed data are biased.
> Only the truth view, which the widget has and reality never grants, shows the
> damage — the same "you never see this" move as bootstrap's population and
> permutation-test's true effect.

### The scenario (Kenneth picked A)

A clinic measuring **body weight against age**: age is always known (the
booking), weight is the measurement that can go missing. One one-line story per
mechanism: the scale was broken that day (MCAR); older patients get weighed
more often at check-ups, so the young are missing (MAR); patients heavier than
their age predicts avoid the scale (MNAR).

### The three design calls already settled, one by measurement

1. **Segmented mechanism control** — MCAR · MAR · MNAR are three alternative
   readings, all worth seeing at rest (3.3). A rate control sets how much is
   missing; **the mechanisms are calibrated by bisection to hit the same
   overall rate**, because "the damage is set by the mechanism, not the
   amount" is only honest if the amounts are equal.
2. **The check panel is in scope** — % missing per age bin, the one diagnostic
   reality permits. It is the panel that makes MAR ≠ MNAR operational rather
   than definitional.
3. **MNAR is scored on the RESIDUAL — weight minus what age predicts — not on
   raw weight, and the first sweep is why.** Raw weight carries age, so MNAR
   leaked a 40-point slope into the age diagnostic and "looks like MCAR" held
   on only 60 of 200 cohorts. The residual is the textbook definition anyway
   (MAR: missingness ⊥ value *given* the observed covariate; MNAR: still
   depends on the value after conditioning) and is orthogonal to age by
   construction. After the change, MNAR's check contrast is distributionally
   identical to MCAR's (17.7 vs 17.5 points at 4 bins).

### The numbers, measured through the shipping model

`widgets/missing-data/model.js` exists and is imported, never copied, by
`node widgets/_lab/missing-measure.mjs`. Cohort n = 120, age uniform 20–80,
weight 78 + 0.25·(age − 50) ± 8 kg (true SD 8.97), steepness 2.0 — every one of
those chosen by the sweep. At the default 30% missing, over 400 seeds:

| mechanism | bias of observed mean | observed SD | check contrast (4 bins) |
|---|---|---|---|
| MCAR | +0.01 ± 0.56 kg | 8.95 | 17.5 pts |
| MAR | **+1.70 ± 0.55 kg** | 8.67 | **71.8 pts** |
| MNAR | **−2.98 ± 0.49 kg** | **7.82** | 17.7 pts |

Single-cohort reliability at those constants — the widget shows one seeded
cohort, so the pattern has to hold per seed, not on average: MAR's check
visibly sloped (>2× MCAR's contrast) on **389/400** seeds; |MNAR bias| > 2 kg
on **388/400**. MNAR also shrinks the observed SD (7.8 vs 9.0), a second
reading the truth toggle can carry: the heavy tail is what went missing.

The rate range 0.1–0.5 all carries the lesson (MAR bias 0.5→2.9 kg, MNAR
−1.1→−4.8 kg, MCAR pinned at 0.0 throughout) — the slider has no dead stops.

### Still open, for the layout session

- **Panel arrangement**: scatter + observed-vs-true pile + check panel is
  three pieces; the mock-up decides what sits where at 550px.
- **The animation**: the mechanism as a process — patients measured or skipped
  one at a time — with the standard drive row; whether the lead is "Recruit
  the cohort" or the cohort is simply given.
- **The truth reveal**: `True values` (matching the settled `True groups`
  vocabulary), hollow marks where the missing weights really are; afterDrive
  per 3.4j, conditioned on there being holes to reveal.
- **Bins**: 4 bins beat 6 on the noise floor (MCAR's own max−min is 17.5 vs
  26.8 points); 3 is more reliable still but draws no shape. Mock both.
- **Slug**: `missing-data` (directory already exists with the model).

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
