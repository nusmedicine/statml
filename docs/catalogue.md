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

## Widget 15 · `logistic-regression` — BUILT, AS A DRAFT

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
| 3 | — | margin-based (SVM) | planned |
| 4 | — | tree-based and ensembles, **one widget** for tree → forest → boosting | planned |
| 5 | — | probabilistic (naive Bayes) | planned |
| 6 | — | neural networks (a shallow MLP) | planned |

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

### Arc B · evaluation

Unchanged below, and still the arc widget 13 belongs to. `generalization` is
built and shipped against `04-1` and `04-4`.

**`04-2 Model Evaluation` is designed but unbuilt** — a probability axis, one dot
per patient, a threshold line whose four quadrants ARE the confusion matrix. Its
evidence is `04-2`'s own cell 39: at threshold 0.50 and at Youden 0.31 the
accuracy is 0.70 both times, while deaths missed goes from 9 to 3.

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
