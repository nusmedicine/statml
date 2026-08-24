# Handover

## Where things are

**Sixteen widgets, all sixteen SHIPPED.** `logistic-regression` and
`support-vector-machine` were promoted out of `/lab/` onto the gallery; `/lab/`
is now empty. Everything is live at <https://nusmedicine.github.io/statml/>.

**123 fingerprint states, each carrying two hashes, and the suite is GREEN** — a
full run on this machine reports *all 123 states identical*. Six are widget 16's,
four settled and two driven. Four are widget 15's, all settled: it declares no
`animation` and no `regions`, so settled coverage is all `check` requires of it.

**The work now happens on Windows, and the toolchain is verified there.** Read
*Working on Windows* and *`px` tracks the device pixel ratio* below before
trusting or re-recording any hash. The short version:

- **`npm run build` was failing two runs in three** — Dropbox holds `_site/` open
  and Windows will not remove a directory anything has a handle on. It retries now.
- **The dev server is on `:8010`, not `:8000`** — a Docker container in WSL owns
  8000, and the failure looks like a working server from the shell.
- **All 123 `px` hashes were re-recorded**; `tx` did not move on a single state.
  It was display scaling, not a regression.
- **HANDOVER's own baselining recipe computed `tx` wrongly** and would have
  poisoned widget 17's baseline silently. Fixed.

**A later pass found three more, all of them the move's fault:**

- **`.claude/launch.json` declared `"port": 8010` and never passed it**, so the
  preview tool started the server on its default **8000** — the one port the pin
  exists to avoid — and then pointed the pane at 8010. It also carried
  `autoPort: true`, which contradicts the determinism it was added for.
- **The documented dev command was bash-only.** `PORT=8010 npm run dev` was in
  CLAUDE.md, README and this file; PowerShell is the shell here and has no
  inline env-var prefix, so it dies with `CommandNotFoundException`. It is
  `node scripts/serve.mjs 8010` everywhere now — an argv port works in any shell.
- **The PHM5005 notebooks were missing** and are re-downloaded, but the only
  copies available online are **output-stripped**. That is not cosmetic: it is
  what forced `04-3`'s numbers to be re-measured, and re-measuring changed them.

**The suite was re-run twice this session: 122/123 then 123/123.** The lone
DIFFER was a `px`-only flake — see the note below — not a regression.

**Two things were shipped without being done**, both worth knowing:
widget 15 still lacks the marginal-vs-conditional note Kenneth asked for (below),
and **no widget from 11 onward has been judged projected**.

**Next up is widget 17, tree-based models** — the section right after SVM in
`04-3`. Nothing is built; what is known is directly below. **It is no longer
blocked**: all 34 PHM5005 notebooks are back on this machine, and `04-3`'s tree
numbers have been re-measured rather than read — which changed one of them. See
*Reading the PHM5005 notebooks* for where they are and what they do not carry.

```bash
node scripts/serve.mjs 8010   # NOT `npm run dev` — :8000 is Docker's here
npm run check                 # before every commit
```

> **A lone `DIFFER` is worth re-running before believing.** On the Mac,
> `logistic-regression`'s `?theme=light` hashed one value on the first suite run,
> a different one on the second and the original again on the third — with its
> **`tx` identical every time**, so only the pixels ever moved. Isolated, it gave
> the recorded value on six consecutive renders and again after 10, 20 and 30
> churned iframes: eleven observations against one. The specific hashes are gone,
> superseded by the Windows re-baseline, but the habit is the point.
>
> **It has now happened on Windows too, on a different state.** A full suite run
> reported 122 MATCH and one DIFFER —
> `clt ?theme=light&dist=exponential&n=5&shown=12` — with **`px` moved and `tx`
> identical**, the same signature. The very next run returned all 123 MATCH. So
> this is not a `logistic-regression` quirk and not a macOS one: it is a property
> of `px`, it is rare, and `tx` has never once moved with it. **A lone DIFFER
> whose `tx` is unchanged is a re-run, not a regression.**

---

## NEXT: widget 17 — tree-based models and ensembles

Arc A #4 in [docs/catalogue.md](docs/catalogue.md): **one widget for tree →
forest → boosting**, hosting at PHM5005 `04-3`, sections "Tree-based Models" and
"Ensembled Trees". Nothing is built. Nothing is designed. What follows is what
is known, so none of it is measured a second time — and two of the three blocks
below are measurements taken this session, not notes carried over.

### The notebook's own numbers — RE-MEASURED, and one of them was an artifact

The table this section used to quote was read off `04-3`'s printed cell outputs
on the Mac. **It has now been re-run** (sklearn 1.9.0, the notebook's own
preprocessing and parameters, verbatim) and it does not come back the same:

| model | as printed in `04-3` | re-run here | agrees? |
|---|---|---|---|
| Decision tree | 0.70 / 0.58 / 11 of 19 | 0.70 / 0.63 / 12 of 19 | no |
| Random forest | 0.72 / 0.42 / 8 of 19 | 0.73 / 0.58 / 11 of 19 | no |
| Gradient boosting | 0.65 / 0.42 / 8 of 19 | 0.65 / 0.42 / 8 of 19 | **exactly** |

Two different causes, and both matter:

- **The notebook's `DecisionTreeClassifier` carries no `random_state`.** Its
  printed row is one unseeded draw. Over 200 seeds on the same split: accuracy
  0.67–0.73, recall **0.47–0.74**, deaths caught **9–14**, median 12. The printed
  0.58 / 11 sits below its own median.
- **The forest moved despite `random_state=42`**, so that one is library drift,
  not seeding. Boosting reproducing to the digit is what rules out the data or
  the split having changed.

**The section's claim is "Higher accuracy than single trees. Reduce
overfitting."** Paired over 200 seeds — same seed to both, same test set:

| | tree | forest |
|---|---|---|
| accuracy | 0.709 ± 0.017 | **0.730 ± 0.023** |
| recall on deaths | **0.621 ± 0.051** | 0.566 ± 0.052 |
| deaths caught | **11.8 ± 1.0** | 10.8 ± 1.0 |

**The trade-off is real and it is directional**: the forest is more accurate in
70% of seeds and catches fewer deaths in 64% of them. **But it is worth about
ONE death, not three.** "Misses three more" was the printed draw's extreme, and
building a widget around three would be building around noise.

That is still a real finding and it is the first thing to decide about: is it
this widget's subject, or does it belong to the evaluation arc (`04-2` owns the
threshold and the confusion matrix)? **Do not let it be both.**

### What a tree widget can reuse from widget 16, verbatim

The two are the same picture with a different boundary, which is an argument for
building it on the same stage:

- **The three generators** — `Two blobs`, `Rings`, `Crescents` — with their fixed
  square domain and seeded `rng`. A tree on the rings draws a **staircase**
  around them where the RBF drew a circle, and putting those two side by side in
  a lesson is free if the data is the same.
- **The square isometric panel** and `heightFor`.
- **`contour()` + `chain()`** — marching squares with interpolated crossings and
  the segments linked into polylines. A tree's decision surface is piecewise
  constant, so its contours come out as exact axis-aligned steps with no extra
  work.
- **The sweep harness**, `widgets/_lab/svm-sweep.html`. Point it at the new slug
  and change the state list.

### What is DIFFERENT, and worth deciding early

- **A tree grows, so it probably WANTS Step and Play** — depth 1, then 2, then 3,
  one split at a time — where widget 16 declined both. That is a real animation
  with something to advance, and `check.mjs` will then demand a driven
  fingerprint state.
- **A forest is a pile of trees**, which is what `core/accumulator.js` is for and
  what four widgets in the statistics arc already use. Averaging B trees one at a
  time is the same motion as `bootstrap`'s resampling — 2.3, show a countable
  thing while the count is small.
- **Boosting is sequential and corrects the previous tree's mistakes**, which is
  a genuinely different motion from bagging and may not fit one widget with the
  other two. The catalogue says one widget for all three; that was decided before
  any of it was drawn, and it is worth re-testing against a mock-up rather than
  assumed.

### Measure before designing — it has paid four times now

Every widget in this arc has had at least one candidate story die to a
measurement, and each death saved a build:

- kNN's *forgetting to scale* — dead, ejection fraction is recorded in coarse
  steps so creatinine survives as a tie-breaker
- SVM's *always standardise* — dead, `gamma="scale"` already divides by the
  variance
- SVM's *a kernel unlocks the problem* — dead on all three course data sets, so
  widget 16 generates its own
- the *margin is a handful of points* — dead on heart failure, 179 of 299

**For trees, the obvious candidates to measure first:**

1. **Does a single tree's structure really change with the data? — MEASURED, and
   it does.** The notebook says "small changes in data can change the tree
   structure". Over 200 bootstrap resamples of the heart-failure training set the
   ROOT split lands on:

   | feature | share of resamples |
   |---|---|
   | `serum_creatinine` | **66%** |
   | `ejection_fraction` | **33%** |
   | `serum_sodium`, `age` | 0.5% each |

   **The caveat fires, and the shape of it is teachable**: it is not a rare
   accident, it is a two-thirds/one-third coin, and it is the same two features
   kNN's story turned on. A widget can show the root flipping between exactly two
   candidates rather than dissolving into noise.

2. **Does the forest actually reduce variance visibly?** Not yet measured as a
   *boundary* spread — what is measured is the outcome spread, and it is small:
   tree ±1.0 deaths caught against forest ±1.0, so the forest is not visibly
   steadier on this metric. The boundary picture may still show it. Measure on
   widget 16's generators, not on heart failure, since that is the stage.
3. **Where does boosting's advantage show up**, if anywhere, given it is the
   worst of the three on this data?

`04-3`'s data is body fat (regression) and heart failure (classification); the
scratch reference for both, plus the sklearn comparison harness, is described
under *Widget 16* in the catalogue.

---

## Widget 16 · `support-vector-machine` — SHIPPED

**Baselined and promoted.** Six states: four settled, and two driven with
`drive: { set: { lift: "kernel" }, frames: 4, dt: 32 }` — the ease is reached
through the `Looking at` control, since the widget declines Step and Play. Each
was hashed three times and was identical every time.

**It has never been judged projected.** Neither has any widget from 11 onward.

`widgets/_lab/fingerprint-new.html` is what recorded them, and it is reusable:
edit its `STATES` list for the next widget. It exists because the suite and the
baseline are two different jobs — the suite proves the widgets you are NOT
looking at still render identically, and welding the two together means
re-verifying 117 known-good states twice in order to learn six numbers.

### What it is, and what was decided

Three generated data sets, all three of `04-3`'s kernels, C on a ladder with γ or
d beside it, and two display toggles — `Looking at` (Input space / Kernel space)
and the support-vector rings. **150 of 150 states match `sklearn.svm.SVC`
exactly** on support-vector count and error count.

    http://localhost:8010/widgets/support-vector-machine/

| what it shows | url |
|---|---|
| the default — blobs, a line is enough | `?theme=light` |
| **a line cannot carve out a ring** — 171 of 180 are support vectors, 74 wrong | `?theme=light&data=rings&kernel=linear` |
| **the same data, RBF** — a closed circle, 31 support vectors, none wrong | `?theme=light&data=rings&kernel=rbf` |
| **THE LIFT** — press *Kernel space* and watch it flatten | `?theme=light&data=rings&kernel=rbf` |
| the polynomial, one cubic between the crescents | `?theme=light&data=moons&kernel=poly` |
| γ too high — the boundary wraps single samples | `?theme=light&data=moons&kernel=rbf&gamma=5` |

Open, and worth a look:

- **The lifted view's vertical axis is compressed beyond one margin**, because
  median max|f| is 1.90 and the worst state is 42. Only 0 and ±1 are labelled,
  so it never claims a reading it is not giving — but it is a broken axis.
- **No seed control.** The data is fixed at seed 1. Exposing one would let a
  reader redraw the samples and watch which points become support vectors — one
  line of spec, but a fourth control on a widget asked to be simpler.
- **`--c-boundary` still wants a name.** The boundary is on `--c-highlight`
  violet because `--c-theory` orange is eleven degrees of hue from
  `--c-event`'s red. Five of the six PHM5005 algorithm widgets draw a decision
  boundary, so the role would be earning its slot rather than serving one widget.
- **An earlier two-panel lift is superseded** and left at
  `widgets/_lab/svm-kernel.html`: φ(z) = (z₁², z₂²) beside the measurements. It
  reads well but can only draw that one map — not RBF, not the crescents.

---

## `px` TRACKS THE DEVICE PIXEL RATIO — the baseline is now Windows

**The move to Windows turned all 123 states red on `px` and not one on `tx`.**
The cause is not the rasteriser, which is what this section used to guess. It is
`devicePixelRatio`, and the arithmetic is exact:

| | macOS | this machine |
|---|---|---|
| `.w-figure` | 550.4 CSS px | 550.4 CSS px |
| `devicePixelRatio` | 2 | **1.25** (Windows at 125% scaling) |
| canvas backing store | 1100 | **688** |

The geometry is identical — same breakpoint, same rail beside the same figure.
But `px` hashes `toDataURL()`, which encodes the **backing store**, so a display
scaling change rewrites every hash while leaving the picture the same size on
screen.

**Measured over the full suite, not sampled:** 123 of 123 `px` moved, **0 of 123
`tx` moved** — including all 41 driven mid-animation states. `tx` is therefore
the cross-machine invariant, demonstrated at full scale rather than hoped for.
The re-baseline diff is exactly 123 `px` lines and nothing else, which is itself
the evidence that only pixels moved.

**Windows hashes are stable.** Eight states hashed three times each came back
identical, including `odds-and-risk` — the widget whose ten `view=calculate`
states were the flaky ones on the Mac. That flakiness has not reappeared here.

### What this means for the next move

**The baseline is now specific to DPR 1.25.** Changing Windows display scaling
is enough to turn the whole suite red again, and it will look exactly like a
catastrophic regression. **Check `devicePixelRatio` before believing anything**:

```js
// in the harness page, or any widget's console
devicePixelRatio                                   // expect 1.25
document.querySelector(".w-figure canvas").width   // expect 688 at FRAME_W 900
```

The standing rule still holds for the **undiagnosed** case: do not re-baseline
to make the suite green, because that buries the reason. What made re-baselining
right this time is that the cause was identified first and `tx` proved the
figures had not changed — the baseline was re-recorded *knowing* what moved, not
to silence it.

The options for making `px` durable are unchanged, and now better informed: pin
the browser *and* the scale factor, hash something less brittle than the PNG
bytes, or accept that `px` is a same-machine check and lean on `tx`. Note that
normalising the canvas back to a fixed size before hashing would survive a
scaling change but **not** a platform change — Windows DirectWrite and macOS
CoreText rasterise text differently, so it solves the smaller half.

---

## Working on Windows

**The toolchain runs there now; it did not before.** `npm run check` — and with
it `npm run build` — failed on the first line of the first assertion on any
Windows machine, because five dynamic imports were written
`import(join(root, "…"))` and `join()` gives `C:\…` there, which Node's ESM
loader refuses outright: `ERR_UNSUPPORTED_ESM_URL_SCHEME, Received protocol
'c:'`. They go through `pathToFileURL` now. `serve.mjs` and `build.mjs` were
already fine — both use `resolve`/`sep`, and build's lab-directory filter already
matched on `[/\\]`.

`.gitattributes` now pins the working tree to LF. Git for Windows defaults to
`core.autocrlf=true`, so without it the first commit from a Windows machine
rewrites every line ending in the repository into one unreadable diff.

**`npm run build` retries the `_site` delete**, because this repo lives inside
Dropbox and Windows will not remove a directory anything holds a handle on.
Dropbox indexes `_site/` the moment a build populates it, so a second build died
on `EBUSY` before writing anything — roughly two runs in three. It is a race, not
a stuck lock: the failing path moved *deeper* each run, the scanner walking
behind the delete. Measured worst case 6 attempts, ~300ms.

**The dev server runs on :8010 here, not :8000.** A Docker container in WSL
(`mcq-app-web-1`, from the `app-mcq` project) publishes `127.0.0.1:8000`, and
WSL2's localhost forwarding mirrors it onto the Windows side through
`wslrelay.exe`. The failure is confusing rather than obvious: the port is split
by address family — `wslrelay` holds **IPv4** `127.0.0.1:8000` while a dev
server started on 8000 gets **IPv6** `::`. `curl` prefers IPv6 and reports a
happy `200`; the browser prefers IPv4 and gets the container's `400`. So the
server looks fine from the shell and broken in the tab.

`.claude/launch.json` pins **8010** so the preview tool is deterministic rather
than picking a random free port — and it now *passes* that port. It previously
declared `"port": 8010` while its `runtimeArgs` were just `["scripts/serve.mjs"]`,
so the server fell through to its own default of **8000** — the one port the pin
exists to avoid — while the preview pane was pointed at 8010. It also carried
`autoPort: true`, which contradicts the determinism it was added for; both are
fixed.

**Use `node scripts/serve.mjs 8010`, not `PORT=8010 npm run dev`.** The shell on
this machine is PowerShell, which has no inline env-var prefix: `PORT=8010 npm
run dev` dies with `CommandNotFoundException: The term 'PORT=8010' is not
recognized`. It worked on macOS and it works in the Git Bash tool, which is why
it survived the move into CLAUDE.md, README and this file. An argv port works in
every shell, and `serve.mjs` has always honoured one.

CLAUDE.md and README each carry a note pointing here rather than a hardcoded
`:8010`. That is deliberate: the clash is **machine-local**, so swapping one
hardcoded port for another would be stale again on the next machine, and the
README's seven example URLs are the documented deployed paths.

**Both of the macOS-shaped gaps are now closed.**

- **The PHM5005 notebooks are back**, all 34, in `~/Downloads/PHM5005 AY2025-26 -
  Notebooks/Master/` — on this machine, `C:\Users\Admin\Downloads\…`. Plus
  `Supporting Materials/Heart Failure.ipynb`. **They are output-stripped**; see
  *Reading the PHM5005 notebooks* below, which is the caveat that matters.
  PHM5003 is fine: `../jupyterbook/phm5003` is present.
- **There is a working Python again.** `python` from the Bash tool hits the
  Microsoft Store stub and dies with an install advert; **`py` is the launcher
  that works**, and it is Python 3.14. sklearn 1.9.0 / pandas 3.0.5 / numpy
  2.5.2 install cleanly:

  ```powershell
  py -m venv .venv
  .venv\Scripts\python.exe -m pip install scikit-learn pandas
  ```

  **Build the venv outside the repo.** `.venv/` is gitignored, but this repo is
  inside Dropbox and a venv is thousands of small files for the indexer to fight
  with — the same class of problem as the `_site` delete.

  The two scripts behind the tree numbers in *NEXT* are kept beside the
  notebooks, in `…/PHM5005 AY2025-26 - Notebooks/_scratch/`: `tree43.py`
  reproduces `04-3`'s three models verbatim, `tree43b.py` runs the paired
  200-seed comparison and the root-split census. They are **deliberately not in
  this repo** — prd §6 records why a Python helper was deleted from it.

**Git had no identity here** and refused the first commit. Set repo-local to
`Kenneth Ban <kennethban@gmail.com>`, matching every existing commit; a
`--global` one would save doing it again in the next repo.

Everything else is Node ≥ 20 and a browser. Nothing in `package.json` shells out.

---

## THEN: widget 15 needs the marginal-vs-conditional note, then a projected review


**The widget is built and the design has held for two rounds.** What is open is
one thing Kenneth found and one thing nobody has done.

### 1. The green dots and the curve answer different questions, and nothing says so

Reported as: *"when I move BMI/Age, sometimes they move outside the range of the
green dots — what does it mean?"*

It means the figure is correct and silent. The **dots are marginal**: the
observed proportion among everyone in that bin, at whatever BMI they actually
had — average 25.4. The **curve is conditional**: the model at the one held value
the slider is set to. Drag BMI to 45 and you are asking about a subgroup almost
nobody in the bins belongs to, so of course the curve leaves them. They coincide
only near the middle of the data, BMI ≈ 25.4 or age ≈ 49.

That is the most useful thing the two sliders demonstrate and it currently reads
as a defect. It is a caption or a readout line, not a rebuild — **and it will
move the `px` of all four states**, so rebaseline in the same commit.

### 2. Judge it projected

Widgets 11, 12, 13, 14 and now 15 have never been seen from the back of a room.
Widget 15's binomial intervals are 1px hairlines and its strip bars are ~3px
wide at the narrow frame, so it has more to lose from distance than most.

### Do NOT re-argue these

Every one was measured or chosen from a mock-up, and all of it is in
`docs/catalogue.md` under *Widget 15* with the numbers:

- **The model is 05-05's own**, `TenYearCHD ~ BMI + age`, coefficients to the
  digit. A second data set (`prevalentHyp ~ sysBP`) was built, made step 1
  unmissable, and was cut for matching the lesson. Its numbers are kept.
- **Three panels, and they are the two bounds coming off one at a time** — not
  three arbitrary views. That is the answer to *why log it*.
- **No training, no convergence.** Widget 8 owns iterative fitting.
- **No stages, no sweep, no animation.** Both were built at Kenneth's request
  and both were removed at his request; the figure's subject is a mapping, and
  varying two sliders is the exploration.
- **The straight line is `--c-reference` grey**, not `--c-extreme`: extreme and
  event are the same `--series-8`, so a red line and a red dot would be one
  colour with two meanings.


## Then: two things the promotion did not do

**1. Neither shipped widget has been judged projected.** Widgets 11, 12, 13 and
14 have never been seen from the back of a room, and two of them now carry no
draft bar. It is the cheapest review left and the only one a shipped widget is
missing.

**2. The matrix's geometry is still uncovered, and no fingerprint state can see
it.**
`px` hashes the canvas; `tx` reads `.w-math`, `.w-legend` and `.w-readout`, and
the rail is excluded on purpose. On the canvas the grid was at least inside `px`,
and `check.mjs` forced a `hit` state to cover the cell-to-value mapping. Both are
gone. Two ways to close it, and the choice is open:

- **`?pair=Weight~Hip` as a settled state.** Free — the widget has no animation,
  so a URL settles it — and it proves the parameter reaches the figure. It does
  not prove the CELL sets it.
- **Teach the harness's `set` verb to drive a `matrix`.** `set` finds a control by
  `data-param` and writes `.value`, which a grid has none of; clicking
  `[data-value="…"]` inside it instead would be a few lines and would cover the
  cell-to-value mapping the way `hit` covered the canvas. This is the honest
  replacement for what was lost.

The four settled states widget 14 now carries prove the parameter reaches the
figure — including `?pair=Age~Weight`, the near-circular end at r = 0.013. None of
them proves that the CELL sets it.

---

### CLOSED: predicted on which axis — the widget is already right

Kenneth's instinct was that predicted belongs on y. **It does not — leave the
widget alone.** This was researched rather than argued from convention, and the
answer is one-sided.

**scikit-learn, which is what the course teaches and what `04-3` uses.**
`PredictionErrorDisplay` with `kind="actual_vs_predicted"`, in
`sklearn/metrics/_plot/regression.py`:

    x_data, y_data = self.y_pred, self.y_true
    xlabel, ylabel = "Predicted values", "Actual values"

The name reads *Y vs X*, not left-to-right. Its sibling `residual_vs_predicted`
shares that x-axis, so the two panels sklearn draws side by side line up —
flipping ours breaks the correspondence with the notebook's own figure.

**Everywhere else the course touches.** caret's `plotObsVsPred` is `obs ~ pred`
with `xlab = "Predicted"` — Kuhn's own package. Harrell's `val.prob` is
`xlab = "Predicted Probability"`. Clinical calibration plots are universally
predicted-risk on x against observed proportion on y, which is the figure these
students will meet again and again. R's `plot(lm)` has no observed-vs-fitted
panel at all, but every panel it does have puts fitted on x.

**And there is a real argument, not just a head-count.** Residual = observed −
predicted. With predicted on x, the signed vertical gap from a point down to the
`y = x` line **is** the residual: above the line means the model under-predicted.
Flip the axes and the vertical gap becomes *predicted − observed*, so every
statement about over- and under-prediction inverts relative to what "residual"
means everywhere else in the course. The residual plot is this plot with the
`y = x` line straightened to horizontal, and that only reads if both share
predicted on x.

Second: for a calibrated model `E[observed | predicted] = predicted`, so a
smoother through the cloud should sit on `y = x`. The reverse conditional is not
— shrinkage makes the cloud flatter than 45°, which is regression to the mean
rather than a model defect. Piñeiro et al., *Ecological Modelling* 216(3), 2008,
1000+ citations, concludes observed-on-y against predicted-on-x for exactly this
reason: r² is the same either way, but slope and intercept are not.

**The dissent is real but thin**: tidymodels puts predicted on y — the same
author as caret, disagreeing with himself — and no source found offers a
*statistical* argument for it. It is habit: predicted is what the procedure
produced, so it feels like output.

If it still looks wrong on screen, the fix is the axis labels or a caption, not
the orientation.

---

## What the core contract gained

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

## Widget 14 · `linear-regularization` — SHIPPED AS A DRAFT

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

## Measurements worth not repeating

All were made to settle a design question, and several killed an idea.

**The body fat data leaks its target.** `04-3` fits on
`drop(columns=["BodyFat"])`, which keeps `Density`, and BodyFat is derived from
Density by Siri's equation: `495/D − 450` reproduces the target to within 0.1
percentage points for **243 of 252 men**. The printed R² table (0.992 down to
0.767) is therefore not comparing algorithms, it is measuring how hard each one
shrinks a leaked feature. **Kenneth agreed to drop the column; not yet done.**

**The penalty is a function of how much data you have.** Median test R² over 25
splits, lasso, without Density:

| n_train | α=0 | α=0.1 | α=0.3 | α=1 | best |
|---|---|---|---|---|---|
| 18 | **−0.761** | 0.435 | 0.568 | 0.585 | α=1 |
| 40 | 0.548 | 0.635 | 0.654 | 0.636 | α=0.3 |
| 202 | 0.698 | 0.690 | 0.675 | 0.633 | **α=0** |

**The grouping effect is real, not a solver artefact.** Raising α₂ at fixed α₁
puts coefficients *back* — 9 of 13 up to all 13. 300 sweeps agrees with 20,000 to
machine zero. The smallest marginal covariance is Height at −0.75 against an L1
threshold of 0.1, so once L2 separates the correlated measurements each clears it
alone.

**Four of the 637 reachable coefficient slots print as `0.00` under `toFixed(2)`
while being non-zero** — at α₁ = α₂ = 0.01 the equation read `− 0.00 z(Knee)`.
A term that is in the model now carries enough digits to show it.

**kNN's scaling story is dead.** Standardised against as-measured is within one
or two patients at every *k*, even though ejection fraction outweighs
log-creatinine **52:1** in range — because ejection fraction is recorded in
coarse steps, so creatinine survives as a tie-breaker. Do not build a kNN widget
around "forgetting to scale". What *does* fire: at k = 9, adding features
strongest-first takes deaths caught from 8 of 19 to **1 of 19**.

**MathML, checked rather than assumed.** Baseline since January 2023, floor
Chrome/Edge 109. A single `<math>` does **not** line-break — MathML Core treats
`white-space` as `nowrap` on every MathML element and no engine implements
automatic linebreaking — so thirteen terms in one `<math>` measure past 1000px
and overflow. One inline `<math>` per term wraps normally, because each is an
atomic inline box in an ordinary inline formatting context.

---

## Traps that cost time

Each of these produced a wrong answer that looked right.

**From widget 15's session:**

- **A display parameter marked as data silently discards the reader's work.**
  All three of widget 15's controls were data parameters, so every slider move
  reset the animation: press two buttons, move a slider, and both curves vanish
  and the drive row goes back to the start. It survived a 308-state text sweep,
  because every string on the canvas was legal — they were just the strings for
  the state it had been reset to. **The check that finds it is a canvas hash
  across a parameter change with the drive-button states read beside it**, and
  nothing else will.
- **A hand-typed data table looks exactly like a correct one.** Widget 15's age
  aggregate was typed into a heredoc rather than pasted from the generator and
  drifted from age 53 up — seventeen wrong rows, a total of 3653/558 against the
  true 3658/557. Generate the string, splice it in programmatically, and assert
  the totals in the same script.
- **The console panel caps at 50 and does not clear on navigate.** Fifty
  identical errors persisted across reloads after the bug producing them was
  fixed, which reads exactly like a fix that did not work. Install your own
  `window.onerror` counter and drive the failing case; that is the honest read.
- **`advance` returning "there is more to show" is what a RUN means, not a
  step.** Core re-queues on a true return, so widget 15's first step button
  walked the entire axis on one press and then greyed itself out. A step
  advances one unit and returns `false`.
- **Two similar tokens are one colour at a 1.5px stroke.** `--c-extreme`
  (`#e34948`) and `--c-theory` (`#eb6834`) are eleven degrees of hue apart, and
  the legend was still declaring the old token after the canvas had moved to a
  new one — so it was not merely hard to read, it was naming a colour the figure
  no longer used. Read the swatches' computed colours, not the source.

**From earlier sessions:**

- **The fingerprint table renders a state string as HTML, so `&params=` shows as
  `¶ms=`.** `&para` is a legacy named entity that browsers resolve without a
  semicolon, and the harness sets that cell with `innerHTML`. It is display only —
  the widget receives `params=12`, verified by opening the URL and reading the
  control — but it reads exactly like a state that lost a parameter, and it will
  do the same to `&amp…`, `&lt…`, `&not…`. Check the widget, not the table.
- **A `requestAnimationFrame` measurement reported the PREVIOUS frame.** The panel
  mock-up measured its heights in a rAF after rendering, and after a width change
  it printed the old stage height beside the new rail height — the two columns
  disagreeing about which frame they were in, which is worse than no number.
  Reading a bounding rect forces layout, so **measure synchronously at the end of
  the render**; the rAF buys nothing and costs correctness.
- **A batch of scripted edits is all-or-nothing, and a failed assert is silent.**
  Two edits in this session did not land — a stale `76.3px` and a blurb — because
  a *later* replacement in the same script threw, so the file was never written
  and the earlier ones went with it. It looks exactly like success: no error in
  the file, no diff. Either write after each replacement or grep for the new text
  afterwards.
- **A screenshot of a long page comes back black once it is scrolled.** The
  browser pane paints the top of the document; `scrollIntoView` then screenshot
  gives a black frame with no error. Hide the cards above the one you want and
  screenshot at the top instead.
- **A measurement comparing unlike things.** The MathML capability probe compared
  an `<mfrac>` against a `<span>` *wrapping* a `<math>`, whose height carries the
  surrounding line-height — 19px against the fraction's 16.5px. It reported a
  browser that lays maths out perfectly as one that does not, which would have
  forced the fallback on every reader for ever. Both sides must be `<math>`.
- **A ceiling that hid a term.** `-webkit-line-clamp: 3` on the equation looked
  right until below the 880px breakpoint, where thirteen terms need four lines
  and the clamp dropped one — silently, no scrollbar, no ellipsis.
- **Mounting at module scope.** `buildShell` creates `.w-figure` inside
  `defineWidget`, so a widget's module scope runs before it exists. Querying it
  there returns null and the reader gets a **blank page**, not a missing element.
  Mount from inside `draw()`, scoped to the widget's own host.
- **A frame conditioned on live state.** The coefficient plane's frame was built
  from the slice conditioned on the *current* eleven coefficients, which shrink —
  so the whole panel drifted under the reader as they dragged.
- **A sweep that measured two paints as one.** Setting two parameters fires two
  repaints, and a text sweep that clears its buffer before both records two
  different figures at the same coordinates — reported as 318 collisions that did
  not exist. Clear after the last set, then force one clean repaint.
- **`document.fonts.check` returns true for everything.** It is not an
  availability test. Measure glyph widths against a generic fallback instead.

---

## Deferred, ready to pick up individually

**Button labels.** A five-widget sweep was reverted (`a23be6b`) as too much to
review at once. The observations still hold; each is a one-file change:

- `maximum-likelihood`'s step button reads "Step" — core's generic fallback, and
  the only step button in fourteen widgets that names no act.
- `bootstrap` and `permutation-test` grey out Step and Play until their lead has
  run, and neither says why. The other lead-gated widgets have a `leadHint`.
- `bayesian`'s `leadHint` says "Step and Play" while the button reads "Add a
  count" or "Propose a move".
- `em-mixture`'s lead reads "Start", the only lead label naming no act.

**Judge projected.** Widgets 11, 12, 13, 14 and 15 have never been seen from the
back of a room. Widget 11's hypergeometric dots are ~4px at the narrow layout;
widget 15's binomial intervals are 1px hairlines and its strip bars ~3px wide.

**Give `fingerprint.html` an `?only=<slug>` filter.** It always runs every state,
which is what forces the loop in *NEVER BASELINE BY PLACEHOLDER-AND-DIFF* above.
A filter would make "record the new widget's states" a first-class thing the
harness does rather than something worked around.

**`widgets/_lab/index.html` has stopped being an index.** Sixteen of the
twenty-nine lab pages are missing from it, including every mock-up made for
widgets 13, 14 and 15 and all three drive-row pages. Adding one alone makes
the list *more* misleading, not less, so this is one change: catch the index up in
a single pass, or delete it. To list them:

```bash
for f in widgets/_lab/*.html; do b=$(basename "$f"); case $b in index.html|fingerprint.html) continue;; esac; grep -q "$b" widgets/_lab/index.html || echo "$b"; done
```

**`04 / 04-08` needs two corrections in `../jupyterbook/phm5003`**, by hand:

- **Cell 40** states the odds-ratio interpretation wrongly. On `a=24, b=60,
  c=16, d=100` the odds are 24/60 = **2:5**; 2.5 is the odds *ratio*, which is
  not an odds; and the death counts are 24 and 16, i.e. **3:2**.
- **Cell 47's Caution** should say **case-control**, not "retrospective" — a
  retrospective *cohort* is fine for a risk ratio, and in a case-control the
  exposure is precisely what you go and ascertain. What is unknown is the
  population at risk.

**`04-3` needs `Density` dropped**, per the measurement above.

---

## Reading the PHM5005 notebooks

Two routes, both verified:

- **Local copies on this machine**, all 34, in `~/Downloads/PHM5005 AY2025-26 -
  Notebooks/Master/`.
- **Shared Drive folder**, readable without auth:
  <https://drive.google.com/drive/folders/1QcSRjgcasZRpFyw1lOHSowjjDgcXp0_c>
  Its top level is the 34 lesson notebooks; `Supporting Materials/` holds the
  data-prep notebooks, `Heart Failure.ipynb` among them.

**THE DRIVE COPIES CARRY NO CELL OUTPUTS.** Measured across all 34: every one
parses, and **not one holds a single output**. The Drive folder is the clean
student copy. The `For Review/` set that had the printed numbers was local to the
Mac and has no equivalent online.

**The printed numbers were the valuable half, and that half must now be re-run
rather than read.** That is exactly how `04-3`'s table in *NEXT* turned out to be
part artifact. **Treat any number in this file quoted from a printed output, and
not since re-measured, as one draw from a possibly unseeded model.**

**Match by filename, never by link.** The same notebook has appeared under three
Drive IDs across two sessions.

There is still no `../jupyterbook/phm5005`, so PHM5005 lesson slots are named by
notebook filename.

---

## How Kenneth works — read before writing anything he will see

- **One change at a time.** A commit touching five widgets is not reviewable and
  gets reverted whole, including the parts that were right. If a fix reveals the
  same fault elsewhere, **say where and stop**; offer the rest as a list.
- **He picks from mock-ups rather than reviewing prose.** Four rounds this
  session were settled that way — the ridge/lasso geometry, the layout, the
  equation typesetting, the matrix placement. A `_lab/` page with the candidates
  drawn at the real width and their trade-offs measured underneath gets a
  one-line answer; an argument in prose gets a longer conversation.
- **Replacement wording must be shorter than what it replaced**, or it is not an
  improvement. Said twice.
- **On-screen copy names the quantity** — principle 2.9. No metaphors, no
  personifying the method, no verdicts where a mechanism belongs. Source comments
  are exempt and should stay vivid.
- **Explanations are one claim per line, not paragraphs.**
- **Hand over the exact localhost URL after every edit.**
- **He may be away from the desktop.** `_lab/` is local-only by design and is not
  published; to show him something remotely, publish it as an Artifact with
  `tokens.css` inlined rather than changing what deploys.

---

## Verifying changes

**Screenshots for judgement — is this legible, is this pleasing. Assertions for
facts. Never the reverse.** Screenshots here have produced several phantom bugs:
the automation browser generates stray pointer input that moves sliders
mid-capture, and it throttles `requestAnimationFrame` to ~1 frame per 300 ms.

### The canvas text sweep

Wrap `fillText`, measure each string, compare its right edge to the canvas width.
It catches a `NaN` at one end of a slider, a caption overrunning its line, a
printed claim that is false.

```js
PR.fillText = function (s, x, y) {
  const w = this.measureText(String(s)).width;
  const left = this.textAlign === "center" ? x - w / 2
    : this.textAlign === "right" ? x - w : x;
  seen.push({ s: String(s), left, right: left + w, y });
  return orig.apply(this, arguments);
};
```

- **`y === 0` is a rotated label** — its coordinates are in the rotated frame.
- **Clear the buffer after the LAST parameter set, then force one repaint.** Two
  sets are two paints, and recording both reports collisions that do not exist.
- **Dedupe before any collision check.**
- **It cannot see DOM.** Widget 14's equation is MathML and does not go through
  `fillText` at all — the sweep stopped seeing it with no error and no gap in its
  output. That is what the text hash below exists to cover.
- **A HARNESS TIMING NUMBER CAN BE 300x WRONG.** The sweep reported a worst
  repaint of **22 seconds**, captioned "each state is a COLD page, so the worst
  is a first paint". That state warm is 54-138 ms and its compute path in node
  is 70 — it was the browser pane being throttled, and the same 201-state sweep
  took **84 s, 165 s and 465 s on three identical runs**. Time a WARM repaint or
  do not report one, and never caption a number you have not checked against a
  second measurement.
- **A HARNESS PAGE MUST REPORT ITS OWN PROGRESS.** `svm-sweep.html` printed
  "running…" and never changed, because the sweep was driven from the console
  and its result read out of a variable — so a finished run and a hung one
  looked identical to anyone opening the page, and one was taken for the other.
  It now shows a bar, the state it is on, and a PASS/FAIL summary. Any lab page
  that takes minutes needs the same.
- **A STATE THAT PAINTED NOTHING IS A FAILURE, NOT A PASS.** A widget that
  throws inside `render()` leaves its canvas at the default **150x75** and its
  readout empty — and a sweep that only counts overruns then reports a clean run
  over an EMPTY LIST. That is exactly how a temporal-dead-zone bug in widget
  16's solver, throwing on every single state, read as "the harness settled too
  early" for a whole round. Assert the canvas has a real width and the readout
  has text before believing a zero.
- **FORCE THE REPAINT BY DRIVING A CONTROL, never by resizing.** Widget 16's
  sweep reported a clean pass twice from an EMPTY list. Dispatching `resize` on
  the iframe's window does nothing, because core listens to a ResizeObserver on
  `.w-figure`. Changing the iframe's width for real does not work either: the
  document reflows — `.w-figure` measured 550 → 666 → 550 — and the canvas stays
  at 1100 backing pixels, because **a ResizeObserver callback is delivered as
  part of the rendering lifecycle and this browser suspends that for an
  offscreen iframe**. Nothing after the initial synchronous paint ever runs.
  `setParam → recompute → paint` IS synchronous, inside the event handler, so
  load each state with one parameter a step away and move it onto the target:
  exactly one paint, at exactly the state you want. Recipe in
  `widgets/_lab/svm-sweep.js`.

### The fingerprint harness — now TWO hashes

`widgets/_lab/fingerprint.html`. **It auto-runs on load; never click Run** — that
starts a second concurrent pass into the same table and can make "Copy new
baseline" copy a half-interleaved set.

Every state records **`px`**, a hash of the canvas, and **`tx`**, a hash of the
figure's text — the concatenated `textContent` of `.w-math`, `.w-legend` and
`.w-readout`. A state MATCHes only if **both** match, and `check.mjs` fails a
state carrying only `px`.

The rail is deliberately absent from `tx`: the rail is what you SET and the stage
is what you SEE, and a control's own label is not a reading of the figure.

> *Earned:* widget 14 moved its equation into the DOM, which left both cheap
> checks at once. But the readout had never been hashed for **any** widget — the
> equation did not create that hole, it made it visible.

**Run the full suite when you touch `widgets/core/`.** That is the only kind of
change that can reach a widget you are not looking at. A run takes about five
minutes.

Three kinds of state:

| kind | how | sees |
|---|---|---|
| **settled** | a URL that fully determines the figure | the finished figure |
| **driven** | `drive: { click, frames, dt }` or `drive: { set: {…}, … }` | anything drawn mid-motion |
| **interrupted** | `drive: { before: [{ click, frames }], … }` | a state one action leaves another in |

Plus a fourth verb, **`drive: { hit: [x, y] }`**, which dispatches a real pointer
event on the canvas at a point in *drawing* coordinates. `set` reaches a
parameter through its DOM control and routes around the region map entirely, so
a `set` state gives a widget's hit-test **no coverage at all** — and that
geometry is exactly what no pixel hash can see, because the picture is identical
whether a target sits where it is drawn or six columns away. It throws when the
point is over no region; the widget's own cursor is the detector.

`check.mjs` fails a non-draft widget that declares `animation` without a driven
state, or `regions` without a `hit` state.

- **`set` drives a control** rather than a drive button — found by `data-param`,
  never by position (5.7).
- Before recording a new driven state, confirm it is identical **across three
  runs**. A flaky check is worse than none.

### THE BIG ONE: every baseline is at the NARROWEST canvas

`fingerprint.html` sets `FRAME_W = 900`. The side layout stacks at
`max-width: 880px`, so 900 is **20px above the breakpoint** — every state is
hashed with the rail still beside the figure, on a **550px canvas**.

This is where widget 11's six overflows were found, and none was visible at
1400px. No hash would ever have caught one: `note()` and friends stroke
surface-coloured before filling, so **a collision erases what it overruns rather
than blending**.

### Order of work, and why baselining comes last

| job | when | cost |
|---|---|---|
| did I break the **other** widgets? | only if `widgets/core/` changed — run once, baseline nothing | one run |
| record a baseline for the **new** widget | only once the design is agreed | hash its own states directly, seconds |

Build → cheap checks → **if core changed, one suite run** → *show Kenneth and
iterate* → and only then add states, baseline, commit.

### NEVER BASELINE BY PLACEHOLDER-AND-DIFF

**Do not add states with `"px": "0", "tx": "0"`, run the suite to see them go
red, copy the numbers back, and run the suite again to confirm.** The two jobs in
the table above are separate, and this welds them together: it re-verifies 113
already-known-good states in order to learn four numbers, twice.

Measured, on widget 15: **three full runs at roughly forty minutes each** — the
placeholder run, the confirming run, and a third to settle one flaky hash — to
record four states. The same four hashes take **seconds** computed directly.

**The previous widgets are baselined once. After that you only ever ADD.** To
record a new widget's states, hash them yourself in an iframe — this is exactly
what `shoot()` does, and copying it is cheaper than driving it:

```js
const hash = (s) => { let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, "0"); };
const f = document.createElement("iframe");
f.width = 900; f.height = 1200;                     // FRAME_W / FRAME_H, do not change
f.src = `../<slug>/${state}`;                        // state must carry ?theme=light
document.body.appendChild(f);
await new Promise((r) => f.addEventListener("load", r));
await new Promise((r) => setTimeout(r, 400));        // SETTLE_MS
const d = f.contentDocument;
const px = hash(d.querySelector(".w-figure canvas").toDataURL("image/png"));
const tx = hash([".w-math", ".w-legend", ".w-readout"]      // per SELECTOR, joined " | "
  .map((s) => [...d.querySelectorAll(s)].map((n) => n.textContent).join(" "))
  .join(" | ").replace(/\s+/g, " ").trim());
```

**The three selectors are joined by `" | "`, not flattened into one list.** This
recipe read `.flatMap(…).join(" ")` until it was checked against
`figureText()` in `fingerprint.html`, which is the function that actually
recorded every `tx` in the baseline. The two build different strings, so they
hash differently — and the failure is silent in the worst way: the recipe still
returns a plausible eight-hex-digit `tx`, and a widget baselined with it reads
MATCH against itself for ever while never agreeing with the suite. It surfaced
only because a sixteen-widget spot-check came back 16/16 red on `tx` at the same
moment `px` went red for an unrelated reason. **Copy `figureText` rather than
this block if the two ever disagree again.**

Run it from any page under `widgets/_lab/`, loop the states you want, paste the
pairs into the baseline. Then run the full suite **once** at the end — that run
is the confirmation, and it is the only one you need.

The placeholder pair is an **escape hatch and nothing else**: it exists so
`check` will pass on a non-draft widget whose design is still moving. It is not a
step in baselining.

*The harness has no way to run a subset, which is what makes the loop above
necessary. A `?only=<slug>` filter on `fingerprint.html` would remove the need
for it and is a small, obvious change nobody has made.*

> *Earned three times.* `bootstrap` was baselined three times over. Widget 11
> changed shape in six of eight review rounds. Widget 12 went thirteen rounds.

`npm run check` fails a **non-draft** widget with no fingerprint states, which is
the escape hatch: leave it `draft` while the design moves.

If a state legitimately changes, regenerate the baseline **in the same commit**
as the change, so the diff records that the rendering moved.
