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
| 7 | `power-and-error` 🟡 | Type I/II error, power, sample size | *I decided. How often is that decision wrong — and in which direction?* | That the two error rates are symmetric consequences of the same thing: that a noisier or smaller study is wrong more often in **both** directions. **α is chosen** and is fixed by construction whatever n does; **β is inherited** and is where all the noise lands | **documented** — and see below |

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
| 9 | `posterior` 🟢 | What do the data make probable, and how sure am I? | `P(Parameters \| Data)` |
| 10 | `em-mixture` | What if each point came from one of two populations and nobody recorded which? | E-step, M-step, iterate |

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

### Widget 9 · `posterior` — shipped

| # | slug | concept | what it answers | misconception | evidence |
|---|---|---|---|---|---|
| 9 | `posterior` 🟢 | Bayesian estimation | *What do the data make probable — and how sure am I?* | That the likelihood curve already tells you how probable each parameter value is. It is `P(data \| θ)`. To get `P(θ \| data)` you need a prior, and you have to **normalise** | **documented parent** — the transposed conditional, same as #8 |

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
The posterior correlation between the two parameters is 0.024, which is why the
first three lines agree — and the best `mu` is the sample mean at *every* size
(8.66 at 0.5, at 2.5, at 10, at a million), because the `r` terms cancel out of
`d/dmu`. So widget 8's coordinate ascent is not a greedy shortcut that finds a
worse answer; it finds exactly the same one.

**The search strategy is not what costs you. The model assumption is.** Which
reframes the `Both` tab: it is not "the proper way" against "the shortcut", it
is the tab that tells you *whether the shortcut was safe* — a crest running
straight up means the best `mu` does not depend on `size`, and you can see that
rather than be told it.

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

### Still queued: #10, and it is not certain

`em-mixture` — the notebook's third section, two normals over height data
(adults 170 ± 30, children 120 ± 15) fitted with `flexmix`. Candidate
misconceptions: that EM finds *the* answer rather than a local optimum that
depends on its initialisation, and that a hard assignment and a soft
responsibility are the same thing. Neither has been through the rule above.

## Deferred from PHM5003

Not dropped — parked, in the order I would revisit them. Each already has its
misconception named above the line in git history.

| slug | concept | why it was parked |
|---|---|---|
| `ppv-prevalence` | Predictive value vs prevalence | **The highest-evidence item in the whole catalogue is now deferred** — physicians report sensitivity *as* PPV, and most put P(disease \| positive) at 70–80% when it is far lower. It sits outside the resampling arc, which is a good reason to postpone it and a bad reason to forget it. Flagging so the choice is visible |
| `regression-to-mean` | Regression to the mean | Attacks "responder" reasoning directly, but needs no resampling machinery |
| `interaction-effect` | Effect modification | The conceptual core of *precision*, but may be technical rather than abstract — see open question 4 |
| `censoring-km` | Censoring and Kaplan–Meier | Survival is its own arc; better built as a pair with `hazard-ratio` |
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
