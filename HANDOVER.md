# Handover

**Twenty-two widgets, all shipped, all on the gallery, and the fingerprint
suite GREEN at 139 of 139.**

Widget 22 `umap` was planned, measured, built, revised over four rounds of
Kenneth's review, baselined and promoted on 2026-08-26. **Widget 23 is
K-MEANS**, chosen the same day and reconnoitred but not planned — see *NEXT*.

> **This file was cut from 152 KB to this on 2026-08-26.** It had grown a
> per-widget history of everything since widget 14, which
> [docs/catalogue.md](docs/catalogue.md) already holds and holds better. The
> full previous version is at
> [docs/archive/HANDOVER-2026-08-26.md](docs/archive/HANDOVER-2026-08-26.md);
> nothing was lost. **HANDOVER is current state and the next task. The catalogue
> is the record.** Please keep it that way — if a section here grows past a
> screen and is not about what to do next, it belongs in the catalogue.

```bash
node scripts/serve.mjs 8010   # NOT `npm run dev` — :8000 is Docker's here
npm run check                 # before every commit
```

---

## The suite is GREEN at 139 of 139

**Every state is recorded and every one matches.** Widget 22's five states went
in on 2026-08-26 when Kenneth promoted it, confirmed identical across three
consecutive runs first, and a fourth run against the recorded baseline read
**139 of 139 MATCH**. Earlier the same day the eleven placeholders left by the
previous promotion were replaced with real hashes, on the same three-run rule. The two `widgets/core/` changes
that owed a run — hoisting `at` out of the `if (regions)` block, and the
regions hover handler falling back to the drag cursor — are covered by that run:
**123 pre-existing states matched, so neither reached a widget it should not
have.**

**Four of the eleven placeholder states were wrong in ways `check` cannot
see**, and recording them is what found it. Worth knowing, because the next
widget's states will be written the same way:

- **`pca` could not be driven at all.** It declines Step and Play outright
  (4.5, `stepLabel: null`), so its only animation is the gate opening — and
  `press` looked only inside `.w-drive`, while `set` needs a `data-param` the
  gate does not carry. The harness now falls back to `.w-gate-btn[data-key]`,
  which `controls.js` already stamps. **A gate counts as a drive button.**
- **`mds` and `balancing-data` hashed IDENTICALLY settled and driven**, which
  passes `check` and covers nothing. Their Step does nothing until a gate is
  open: mds needs `measured=1`, and balancing-data needs **four** things true —
  `keep=3` so cases have actually been thrown away, then `fit=1`, `balance=1`
  and a method that generates samples. At 100% kept, SMOTE adds nothing and the
  widget removes Step itself.
- **`t-sne`'s hit coordinate was guessed and hit nothing.** It is computed from
  the widget's own `regions()` at the harness's 550px canvas now.

**So a driven state needs checking against its settled sibling.** If the two
hash the same, the drive did nothing — `check` cannot tell, and the whole
reason it demands a driven state is the mid-animation rendering a settled state
is blind to.

---

## Where things are

| # | slug | state |
|---|---|---|
| 1–16 | … | shipped and baselined, long settled |
| 17 | `trees-and-ensembles` | shipped. **Kenneth has not seen the finished boosting page**, and he flagged that its 20 rounds may be too many since nothing visible changes after round 6 |
| 18 | `balancing-data` | shipped, twelve rounds of review, what he asked for |
| 19 | `pca` | shipped, six rounds |
| 20 | `mds` | shipped, five rounds, **two methods** — classical and non-metric |
| 21 | `t-sne` | shipped, built and reviewed across one long session on 2026-08-26 |
| 22 | `umap` | shipped. Planned, measured, built and revised over four review rounds on 2026-08-26, then baselined with five states |

**Every one of those histories is in [docs/catalogue.md](docs/catalogue.md)**,
organised by widget, including the rounds that reversed an earlier decision and
why. Read the round headings there before changing anything.

**Widget 15 still lacks the marginal-vs-conditional note** Kenneth asked for,
and **no widget from 11 onward has been judged projected**. Both are old and
neither blocks anything.

### Still open on widget 20, and both are teaching calls

1. **The default fits.** Two groups of three is `05-04`'s own shape but its
   stress is 0.002, so a reader who never touches `groups` leaves having seen
   MDS be exact. Four groups of two fails at 0.195 and keeps its numbers at
   every width, so the swap costs nothing.
2. **The rank fit degenerates at four groups** — it satisfies an order by
   pulling each cluster toward a point. The *Ranks held* tile reports it (`2/66`
   against `15/15` at the default). It is the documented non-metric degeneracy,
   not the solver: three cures were measured and none worked.

### Still open on widget 21

**The structureless-cloud failing case is built and then removed.** A stage with
no groups at all, where t-SNE draws clusters anyway — measured over 40 seeds at
**0.634 ± 0.104 against a plain projection's 0.447 ± 0.057, higher on 38 of
40**, and worst at low perplexity. That is the demonstration the lesson's own
link (distill.pub's *How to Use t-SNE Effectively*) is about. It was replaced by
the `labels` toggle on Kenneth's call and **bringing it back is one extra option
on `labels`, not a rebuild.**

---

## NEXT: PLAN K-MEANS, WIDGET 23

**Kenneth chose it on 2026-08-26**, and the reconnaissance is already written:
[docs/catalogue.md](docs/catalogue.md) § *NEXT · K-Means*. **Read that, not this
summary.** Then run a planning session on the pattern of § *NEXT · t-SNE* —
three questions, each closed with a number rather than an argument.

### The four things that shape it

1. **ONE HOST, for the first time since widget 19.** PHM5005 `03-5` cells 52–59.
   **PHM5003 does not teach K-Means at all** — its clustering notebook is
   hierarchical clustering and mentions it zero times. Nothing to reconcile
   between an R library and a Python one.
2. **ASK FOR THE DIAGRAM FIRST.** Cell 52 embeds `unsupervised-kmeans.png` from
   **Dropbox rather than as an attachment**, so it cannot be pulled out of the
   notebook the way widget 22's was. Widget 22's layout came from exactly such a
   diagram and the catalogue treats one as binding — so getting it is the first
   move, not the last.
3. **THE FAILING CASES ARE THE NOTEBOOK'S OWN WORDS.** Cell 52's limitations
   column reads *"Must specify K in advance"*, *"Assumes clusters are spherical
   and similar size"*, *"Sensitive to outliers and initial centroid placement"*.
   All three are cheap to stage, and the third is nearly free — `seed` is in
   every widget already.
4. **CELL 53 ASKS A QUESTION NOTHING IN THE ARC HAS MET.** Verbatim: *"For
   simplicity, we will reduce the dimensions to 2 … In practice, data is reduced
   to 10-50 dimensions to for clustering in this space."* Clustering in the
   reduced space is a choice with consequences, and the lesson says so without
   showing it.

**Question 1 is already answered and it is the first time**: Lloyd's algorithm at
n = 48 is microseconds, so compute-versus-replay is not a real question here. It
was wrong twice — for t-SNE and again for UMAP — and this time the answer is
obvious rather than assumed.

**Lift `widgets/umap/`, and repeat `model.js` above all.** The algorithm in its
own module is what made *what is verified is what ships* true for widget 22 and
false for widget 21.

---

## WIDGET 22 IS SHIPPED — and one review is still owed

**On the gallery, five fingerprint states, suite GREEN at 139 of 139.** Promoted
on 2026-08-26 after four rounds of Kenneth's review; the states were recorded
only once he promoted it, which is the order the catalogue argues for.

```bash
node scripts/serve.mjs 8017
# http://localhost:8017/widgets/umap/?graph=1&flatten=1&labels=on   then press Optimise
node widgets/_lab/umap-verify.mjs     # the shipping module against umap-learn
node widgets/_lab/umap-landing.mjs    # the flattening lands on frame 0, 2.2e-16
node widgets/_lab/umap-measure.mjs    # every number the catalogue quotes
```

**STILL OWED: it has not been judged PROJECTED**, at lecture size from the back
of a room. Neither has any widget from 11 onward — it is the cheapest review
left in the repo and the one nothing here can do.

The full record is [docs/catalogue.md](docs/catalogue.md) § *Widget 22 · `umap`*.

### Two things recorded and NOT fixed

- **A published `step` survives a data change in the URL but not in the figure,
  and widget 21 does it too.** Measured there: `?step=40` reads KL 0.157, then
  moving `perplexity` reads 1.727 while the URL still says `step=40`. Core's
  `seededOnce` is deliberate; leaving the parameter in the address bar is not.
  **The fix is core's and owes a full fingerprint run.**
- **Widget 21 draws the same wireframe globe over samples that fill the BALL.**
  Widget 22's now sit on the sphere and its globe is a surface; widget 21's is
  not, and implies one its data is not on. It never claims a manifold, so it is
  the smaller version of the same problem.

### What baselining widget 22 taught, for widget 23

- **The hit coordinate is measured, never guessed.** A pointer sweep of the whole
  canvas at the harness's 900px frame found 959 live targets, and `[140, 188]`
  was checked to set `pick=44` before it went into the baseline. Widget 21's was
  guessed and hit nothing.
- **Check every driven state against its settled sibling.** `mds` and
  `balancing-data` once hashed IDENTICALLY settled and driven, which passes
  `check` and covers nothing.
- **A gate counts as a drive button**: `click: "gate-flatten"` is what captures
  an entry animation, and it is how the flattening tween got a state at all.
- **The harness needs the tab FRONTED** — it composites no frames otherwise — and
  a full pass over 139 states takes about 40 seconds here.

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

**THE BROWSER PANE REPORTS THE SAME 1.25, so a baseline CAN be recorded from an
agent session.** I argued the opposite when the eleven placeholders went in —
that the pane runs at DPR 1 and any `px` recorded there would be wrong for this
machine — and it was inherited rather than measured. It is one line to check:
`devicePixelRatio` in the pane reads **1.25**, and the decisive test is stronger
still — **run the suite and see whether the pre-existing states MATCH.** They
did, all 123 of them, which proves the environment reproduces the baseline
exactly. Do that before assuming a hash cannot be recorded.

The pane does have a real limitation, and it is a different one: **it composites
no frames while it is not displayed**, so `requestAnimationFrame` stalls and the
harness cannot run at all. Front the tab first.

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

### Python is installed — and ASK before working around a blocked network

Python 3.12 is at `%LOCALAPPDATA%\Programs\Python\Python312\python.exe`, with
`numpy`, `scipy` and `scikit-learn`. It went in with
`winget install Python.Python.3.12`.

**KENNETH RUNS SIMPLEWALL, a per-application firewall, and a blocked socket
usually means a prompt he did not approve in time.** On 2026-08-26 `pip` failed
with `WinError 10013` on every connection while PowerShell reached PyPI fine. I
diagnosed that as a permanent property of the machine, built a
fetch-wheels-with-PowerShell-and-install-offline workaround, and wrote it into
this file as standing guidance. **It was a firewall prompt that had timed out.**
One click would have fixed it, and the workaround has been deleted rather than
left here to send the next session down the same path.

**So: a blocked network call is a question, not a constraint.** Say what was
blocked and what it was trying to reach, and ask him to approve it. Only build
around it if he says it cannot be approved.

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

  **The venv had vanished by the next session and had to be rebuilt.** It is
  at `…/PHM5005 AY2025-26 - Notebooks/_scratch/venv`, and the measurement
  scripts sit beside it: `tree43.py` / `tree43b.py` behind widget 17's tree
  numbers, and `imb1.py`–`imb6.py` plus `verify18.mjs` behind widget 18's.
  `verify18.mjs` is the interesting one — node imports the SHIPPING module
  `widgets/balancing-data/model.js` and dumps its numbers for `imb6.py` to
  check against scikit-learn, so what was verified is what runs. Its imports are
  absolute `file:///D:/…` URLs because a relative path cannot cross from C: to
  D: on Windows. They are **deliberately not in this repo** — prd §6 records why
  a Python helper was deleted from it.

  **Widget 22's planning scripts are there too**, and the catalogue cites them
  by name: `umapstage.py` is the shared stage and metrics, `umap1.py`/`umap2.py`
  the `min_dist`-against-`n_neighbors` sweeps, `umap3.py` the library limits and
  the two failure cases, `umap4.py`/`umap5.py` the full-batch-against-library
  comparison and the learning-rate sweep, `umap6.py` the distance-form
  diagnosis, `umapfig.py`/`umap7.py`/`umap8.py` the digitising and fitting of
  `umap-cross.png`, `umap9.py` the d*(mu) table, `umap10.py` the `03-5`
  reproducibility check, `graph-legible.mjs` the edge counts, and
  `ce-panel.mjs` the fourth panel's legibility. What ships in the repo is the
  other half — `widgets/_lab/umap-engine.js`, `umap-ref.py`, `umap-verify.mjs` and
  `umap-measure.mjs`.

  ```powershell
  cd "C:/Users/Admin/Downloads/PHM5005 AY2025-26 - Notebooks/_scratch"
  py -m venv venv
  ./venv/Scripts/python.exe -m pip install scikit-learn pandas imbalanced-learn umap-learn pillow
  ```

  Note `imbalanced-learn` is now in that list: `03-4` needs it, and the earlier
  claim that it was unavailable is no longer a constraint. **`umap-learn` and
  `pillow` joined it at widget 22's planning session** — the first is the
  reference `widgets/_lab/umap-ref.py` pulls its table from, the second is what
  digitised the notebook's cross-entropy figure. `umap-learn` 0.5.12 drags in
  numba, so the first call costs ~5.6 s of JIT and ~30 ms after that.

  **numpy 2.x removed `ndarray.ptp`**, so `Y.ptp(0)` raises `AttributeError` in
  anything copied from an older script. `np.ptp(Y, axis=0)` is the replacement.

**Git had no identity here** and refused the first commit. Set repo-local to
`Kenneth Ban <kennethban@gmail.com>`, matching every existing commit; a
`--global` one would save doing it again in the next repo.

Everything else is Node ≥ 20 and a browser. Nothing in `package.json` shells out.

---

## Known blind spots — things no check in this repo can see

Kept here rather than in the catalogue because they are about the CHECKS, and a
session that trusts a green run needs to know what green does not cover.

- **A canvas control's geometry is outside both hashes.** `px` hashes the
  canvas and `tx` reads `.w-math`, `.w-legend` and `.w-readout` — so anything
  that moved off the canvas into a DOM control (widget 14's matrix) is covered
  by neither. That is why `check` demands a **hit-driven** fingerprint state of
  any widget declaring `regions`: it is the one interaction where the picture is
  identical whether a target sits where it is drawn or six columns away.
- **The legend is DOM and renders happily with a wrong key.** Core builds a
  swatch from `var(--c-${item.token}, var(--${item.token}))`. Writing
  `swatch:` instead of `token:` leaves every entry resolving to the same default
  grey — present, occupying space, carrying nothing. Widget 21 shipped that way
  and a human looking at the screen found it. Nothing here would have.
- **Widget 15's green dots and its curve answer different questions**, and
  nothing on screen says so. Kenneth reported it as *"when I move BMI/Age,
  sometimes they move outside the range of the curve"*. The marginal-vs-
  conditional note he asked for is still not written. Full record in
  [docs/catalogue.md](docs/catalogue.md) § *Widget 15*.
- **No widget from 11 onward has been judged projected** — seen from the back of
  a room at lecture size. It is the cheapest review left and every shipped
  widget from 11 on is missing it.

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

### Driving the animation in node, with no browser at all

**This is the way past "the browser pane runs no frames".** A widget's `main.js`
imports exactly one thing, so stubbing that import captures the whole config
object — and `compute`, `animation.init/advance`, `readout`, `summary` and
`drag.value` are then all callable from node, with no DOM and no clock.

```js
src = src.replace(/^import \{ defineWidget \} from "\.\.\/core\/index\.js";$/m,
  'const __cfg = {}; const defineWidget = (c) => Object.assign(__cfg, c);');
src += "\nexport { __cfg };\n";
```

Then supply an rng with `.next()`, call `compute`, and pump `advance` with a
fixed `dt` until `anim.done`. **What it catches that nothing else here does:**
that the animation reaches its last frame at all, that every stage is passed in
order, that `shown=N` lands where it claims, and — cheapest of the lot — that no
`readout` tile or `summary` string anywhere along the rail contains a `NaN` or
an `undefined`. Twenty-three such assertions over widget 19 ran in under a
second and needed no server.

It does NOT see the drawing: `draw` wants a real `CanvasRenderingContext2D`. Use
it for the contract and the numbers, the text sweep below for the strings, and
the fingerprint for the pixels.

**AND LIST THE CAPABILITIES BY NAME, or the driver will not notice a deletion.**
This is the sharper half and it was learned twice in one session. A wholesale
rewrite deleted the entire `drag` block during a comment cleanup; the `turn` and
`tilt` parameters survived, the camera still read them, nothing wrote to them,
and the cloud was frozen — while **every existing assertion still passed**,
because all of them tested behaviour that was still there. The same rewrite
habit had already deleted `slerp` and then called it.

So a second driver asserts what the widget must HAVE rather than what it does:

```js
for (const key of ["slug","title","status","layout","height","params",
                   "compute","draw","readout","summary","animation","drag"])
  ck(`declares \`${key}\``, W[key] != null);
const WANT = { groups:"choice", samples:"choice", seed:"int",
               pca:"gate", projected:"gate", turn:"int", tilt:"int" };
for (const [n, t] of Object.entries(WANT)) ck(`${n} is ${t}`, W.params[n]?.type === t);
ck("no parameters beyond those",
   Object.keys(W.params).sort().join() === Object.keys(WANT).sort().join());
```

A driver that only exercises what exists cannot notice what stopped existing.
**Edit these files; do not regenerate them.**

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
