# Handover

## Where things are

**Widget 9, `posterior`, is shipped.** Four tabs, baselined with **10 fingerprint
states** (six settled, four driven), and the suite reports **57/57 MATCH**.

The inference arc's pair is now complete: #8 answers `P(Data | Parameters)` and
#9 answers `P(Parameters | Data)`, on the same lesson, the same negative
binomial and the same two parameter names.

`power-and-error` is still the only `draft` in the manifest, and still has no
fingerprint states. Widget 10, `em-mixture`, is sketched in
[docs/catalogue.md](docs/catalogue.md) and has **not** been through the
misconception rule — do that before building it.

## What widget 9 is, in one paragraph

A lead deals the whole sample at once — solid dots for observed, hollow rings
for still to come — and Step works through it, one count per press. Three panels
multiply: likelihood **×** prior **=** posterior, each printing its own area,
which is the whole argument. The likelihood's is `5 × 10⁻¹³` and nothing holds
it there; the prior's is 1; the posterior's is 1 *after dividing by
`P(counts)`*. A `size` tab does the same for the dispersion, a `Both` tab shows
the joint posterior with both marginals standing on its edges, and an `MCMC` tab
walks a Metropolis chain over that same posterior — with two bars showing that
`P(counts)` **cancels out of the acceptance ratio**, which is why the chain
never has to compute it, and histograms of the draws filling in under the exact
marginals it is trying to recover.

## The next job

**Nothing is queued that has earned a slot.** #10 (`em-mixture`) is a candidate,
not a decision — [docs/catalogue.md](docs/catalogue.md) §"Still queued" says so
and names the two candidate misconceptions. The rule at the top of that file is
the gate. `ppv-prevalence` is flagged there as the highest-evidence deferred
item in the whole catalogue, which is a live argument for un-parking it instead.

## The three questions that reshaped it, and the answers

Asked after the first four-tab build, and all three are worth keeping because a
student will ask the same ones.

- **"Should the sample be generated first, so it does not move?"** It never
  moved — `compute()` is pure and seeded — but the figure did not say so. It
  does now: the lead deals every count, and the hollow rings are what is left.
- **"Are mu / size / Both manual calculations, like MAP?"** No. MAP is a point;
  these are the whole posterior, computed exactly by enumeration over 6,400
  cells. Widget 8 *maximises*; widget 9 *integrates*. The subtitle and the tab
  details now say "exact, on the grid" so the fourth tab has something to be an
  alternative to.
- **"Is MCMC finding the denominator?"** The opposite, and this is the one that
  changed a whole panel. `P(counts)` cancels out of the acceptance ratio, so the
  chain never computes it. brms shipping a separate `bridge_sampler()` is the
  proof: if the sampler gave you the denominator, that function would not exist.

## What the numbers said about coordinate ascent, since it comes up

The intuition that widget 8's "best mu, then best size" is a greedy shortcut is
the natural one and it is **wrong for this model**. The best mu is the sample
mean at every size — 8.66 at size 0.5, at 2.5, at 10, at a million — because the
`r` terms cancel out of `d/dmu`. Measured:

| what you do about `size` | 95% interval for mu | width |
|---|---|---|
| pin it at its estimate, 2.55 | 6.02 – 11.77 | 5.75 |
| don't pin it — integrate it out | 5.87 – 11.86 | 5.99 |
| **assume Poisson (size = ∞)** | **7.10 – 10.27** | **3.17** |

Pinning the nuisance parameter costs **4%**. Assuming the wrong model costs
**47%**. Posterior correlation between the two parameters is 0.024, which is
*why* the first two agree. **The search strategy is not what costs you; the
model assumption is** — and the `Both` tab is what tells you which situation you
are in, because a crest that runs straight up is what makes the shortcut safe.

## Things this session learned the hard way

- **A claim printed on a figure has to survive the FIRST press, not just the
  last.** The likelihood panel's note said `area = … — not 1`, and for a single
  Poisson observation the likelihood over `mu` integrates to exactly 1 — it is a
  Gamma(k+1, 1) density in disguise. So the widget printed `area = 0.999 — not
  1` the moment anyone pressed the button once. It now says **`not fixed at 1`**,
  which is true at every count and, at one count, is the more interesting
  statement.

- **Prose is what you reach for when the layout is not carrying the
  distinction.** Four questions about widget 9 in a row — is `give or take`
  needed, can the truth be separated from the prior, can the grid tabs be marked
  as grid — all had prose answers on screen and none had a structural one. The
  fixes were a labelled `section` divider, distribution names in the prior labels
  (`mu — a Normal centred at`), and a two-row tab strip; between them they
  deleted more text than they added. Principle 3.4g.

- **An axis window does not have to follow the truth.** Widget 9's true
  parameters were cut because a moving window would let a prior slide off the
  panel. Fixing the windows instead — `mu` on [0, 20], `size` on [0.5, 10] —
  brings the controls back, and with them the thing widget 8 is seen doing:
  set a truth, collect counts, watch the posterior find it.

- **A field's `detail` was rendering into a tooltip, or nowhere.** `choice` and
  `gate` showed it; `segmented` put it in a `title`; `int` and `float` dropped it
  entirely. So widget 8's "larger size = LESS spread" warning — the one thing its
  own header calls the widget's job — has never been on screen, and neither had
  widget 9's grid-versus-sampler tab copy. Fixed in `controls.js` for every field
  type; it surfaces written-and-reviewed copy in five shipped widgets at once, so
  read it before shipping such a fix. Recorded as principle 3.4f.

- **`manifest.json`'s `height` is stale for every widget and nothing reads it.**
  The embedders that consumed it were deleted (prd §6). Measured at the
  fingerprint harness's own 900px frame, every recorded height is 190–310px too
  tall — left over from before the `side` layout. `posterior`'s is now correct
  (1112, its MCMC tab); the other eight are not. **A number nothing reads is a
  number that drifts:** either fix all of them against a stated width or delete
  the field, but do not leave it as it is.

- **Capture the canvas's text and read it.** That bug was found by wrapping
  `CanvasRenderingContext2D.prototype.fillText` to collect every string the
  widget paints, then grepping the list. The same trick found two caption/note
  pairs overrunning their panel by 20–46px and proved there was no `NaN` at any
  extreme of any slider. **No screenshot was going to show any of it.** The
  recipe is below and it is now the cheapest check in the repo.

- **`∝` does not render.** Measured in the shipping font: at the largest size
  token it is 3.9px tall against 9.6 for the `×` above it, and reads as a stray
  hyphen. The lesson's own figure uses `∝`, so this was tried first. Widget 9
  uses `=` with the missing division stated at the other end of the same line.

- **A constant used by `draw` must be declared ABOVE `defineWidget`.** It renders
  synchronously at module load, so a `const` below it is still in the temporal
  dead zone and the widget dies with "cannot access before initialization".

- **`Replay` re-runs the lead, which means it blanks the figure.** Core calls
  `resetAnim({fromScratch: true})` when `anim.done`, and that clears `leadDone`,
  so Play-after-finishing leaves both step and run disabled until the lead is
  pressed again. Widget 8 behaves the same way and `leadHint` explains it, so it
  is the arc's semantics rather than a bug — but it made a test look like the
  shared tab cursor had broken, which it had not.

- **The fingerprint harness auto-runs on load.** `run()` is the last statement in
  `fingerprint.html`. Clicking **Run** therefore starts a SECOND concurrent pass
  into the same table — that is how a 47-state suite reported 79 rows — and both
  passes write the same `latest` array, so **Copy new baseline could copy a
  half-interleaved set.** Load the page and wait; never click Run.

- **Two parameters is where the two approaches actually differ**, and the
  catalogue's plan for one was wrong. MLE has to pin a nuisance parameter
  somewhere before profiling the other; Bayes puts a prior on both and adds the
  plane up along the axis it does not care about. The three-panel figure survives
  because the marginal still factors.

- **The measured numbers are the argument, twice over.** The one-parameter build
  was cut on a coverage measurement (64% over 2,000 seeds, against 95% for the
  version that shipped), and the sampler's jump sizes were chosen on twelve
  chains of 600 draws rather than guessed. Both are in
  [docs/catalogue.md](docs/catalogue.md) so nobody re-derives them.

- **Two versions of one formula, deliberately.** Widget 9 factorises the negative
  binomial's log-pmf so one count costs 80 `lgamma` calls instead of 6,400,
  which is what makes its prior sliders live. Widget 8 evaluates 2,460 cells in
  total and keeps the plain form. Principle 5.8 says one formula one place; this
  is the exception, and it is written down at both ends.

## Verifying, and what actually caught things

`npm run check` before every commit. The fingerprint suite (`_lab/fingerprint.html`)
**whenever `widgets/core/` changes** — it ran clean three times this session,
each reporting 47/47 on the other widgets: after the token and helper moves,
after `nbLogPmf` moved, and after the step-label change to `widget.js`. That is
what made three separate core changes safe to ship.

**Baselining is slow and the wait is the job.** One suite pass over 57 states
takes about eight minutes in the browser pane, and a new driven state needs three
identical passes before it is recorded — so budget roughly half an hour, and do
not start until the design has stopped moving. Confirm the table is nearly empty
straight after a reload, or you will read a stale one and think a run finished in
seconds.

**Write the baseline back with the original formatting.** A plain
`json.dumps(indent=1)` rewrote all 47 states once and turned an 8-state addition
into a 408-line diff. Preserve each existing state's own key order and pass
`ensure_ascii=False`; widget 9's ten states landed as a clean block with the
other 47 untouched. `widgets/manifest.json` is the opposite — it stores non-ASCII
escaped, so write that one with `ensure_ascii=True`.

The browser pane's tab reports `document.visibilityState === "hidden"`, so
`requestAnimationFrame` never fires and nothing animates on its own. Drive
animations by hijacking the clock:

```js
window.requestAnimationFrame = (cb) => { (window.__q ??= []).push(cb); return 1; };
let t = 1000;
const adv = (n, dt = 32) => { for (let i = 0; i < n; i++) { const cb = window.__q.shift(); if (!cb) return i; t += dt; cb(t); } return n; };
```

And to read what the figure actually says, rather than looking at it:

```js
const P = CanvasRenderingContext2D.prototype;
if (!P.__of) P.__of = P.fillText;
window.__t = [];
P.fillText = function (s, x, y, ...r) { window.__t.push([String(s), Math.round(x), Math.round(y)]); return P.__of.call(this, s, x, y, ...r); };
// …drive the widget, then grep window.__t for NaN, measure caption+note widths,
// group by y to find two strings fighting for one line.
```

Stray pointer input moves sliders between tool calls and rewrites the URL. Do
everything for one measurement **inside a single `javascript_exec`**, and assert
`location.search` if the state matters. Screenshots also come back at an
inconsistent scale in this pane; pass `scale: 1` and re-take if the page renders
small.

## Lab pages, and what each one settled

| page | settled |
|---|---|
| `likelihood.html` | counts vs a normal for the mechanism — counts won, because their heights add to an exact `1.000` |
| `two-then-both.html` | layouts for a surface with two marginals. Records a design that was cut for widget 8; widget 9 ended up not needing it either, because its marginals are whole tabs rather than edge strips |
| `plain-language.html` | how much technical detail a biology MSc needs. Widget 8's readout is variant C, and widget 9's two-tiles-per-tab follows it |
