# Handover

## Where things are — read this first

**Nothing from the last three sessions is deployed.** `main` and `origin/main`
are both at `5cb11eb`, so the live site still shows **seven** widgets. Widgets 8
and 9 exist only on branches:

```
main                        5cb11eb   ← what the world sees
widget-8-maximum-likelihood 031f85c   ← +2 commits
widget-9-posterior          HEAD      ← +10 more, branched off widget 8
```

`widget-9-posterior` therefore carries **both** widgets. Merging it publishes
both at once, and every push to `main` publishes immediately with no staging
step. **That was deliberate: widget 9 is still under review.** Do not merge
unless asked.

Widget 9 passes everything — `npm run check` clean, fingerprint **57/57 MATCH**,
10 baselined states (six settled, four driven). It is finished in the sense that
it works and is verified, and unfinished in the sense that each of the last four
review rounds found something and the next one probably will too.

## What widget 9 is, in one paragraph

`posterior`, "Bayesian Estimation", on the lesson's own `rnbinom(size = 2.5,
mu = 10)`. A lead deals the whole sample at once — solid dots for observed,
hollow rings for still to come — and Step works through it, one count per press.
Three panels multiply: likelihood **×** prior **=** posterior, each printing its
own area, which is the whole argument. The likelihood's is `5 × 10⁻¹³` and
nothing holds it there; the prior's is 1; the posterior's is 1 *after dividing
by `P(counts)`*. A `size` tab does the same for the dispersion, a `Both` tab
shows the joint posterior with both marginals standing on its edges, and an
`MCMC` tab walks a Metropolis chain over that same posterior — with two bars
showing that `P(counts)` **cancels out of the acceptance ratio**, which is why
the chain never has to compute it, and histograms of the draws filling in under
the exact marginals it is recovering.

## The next job

**Keep fixing widget 9.** That is what the branch is for and where the last
session stopped. Nothing else has earned a slot: #10 (`em-mixture`) is a
candidate, not a decision — [docs/catalogue.md](docs/catalogue.md) §"Still
queued" names its two candidate misconceptions and neither has been through the
rule at the top of that file. `ppv-prevalence` is flagged there as the
highest-evidence deferred item in the whole catalogue, which is a live argument
for un-parking it instead of building #10.

`power-and-error` is still the only `draft` in the manifest and still has no
fingerprint states.

## What the last session did

Four commits. The last was not on the list when the session started, and it is
the one worth reading.

| commit | what |
|---|---|
| `Widget 9: an axis in tenths…` | five canvas fixes, below |
| `Delete manifest's height…` | the field is gone, and `check`'s assertion with it |
| `Power and error: a ladder…` | alphas `0.01` and `0.10` carried `detail: ""`, so the block jumped a line taller and shorter as you clicked across the row |
| `A note that will not fit…` | core `note()` gained a fallback; three callers core cannot reach were fixed as copy |

The five in widget 9, all found by reading the text the canvas paints:

- **An axis in tenths, in the opening frame.** At zero counts the likelihood's
  peak is the prior's own integral, which is 1 — except that summing 80 cells
  lands on `0.9999999999999999` for the DEFAULT prior. `log()` of that is
  `-1.1e-16`, `floor()` takes it to **-1**, and the panel redrew its y-axis
  `0 – 11` with the flat curve at 10 and `area = 20.0` printed underneath. One
  notch of the size slider read `0 – 1.5`. `expoOf()` carries the tolerance now,
  and the comment carries the story.
- **A caption that ran backwards over half its slider.** "so you expected a lot
  of extra spread" was fixed text under a slider running to 6, and a larger size
  is LESS spread — which the axis label two panels down says outright.
- **The first MCMC proposal was invisible.** `drawPlane` returned early at
  `t = 0`, before the dot, the dashed line and the bars alike, so the first press
  of "Propose a move" left the panel reading "nothing proposed yet" for its whole
  flight. `compute()` returns the chain's start now and the plane draws it.
- **The current point's bar never moved.** Pinned at full width, it made the
  proposal's length the acceptance probability read off the axis — but it encoded
  nothing itself while its printed value swung two orders of magnitude, in the
  one tab whose subject is a chain moving. Both bars scale to the plane's peak
  now. The decision is untouched: `proposed/current > u` is
  `len(proposed) > len(current) × u`, so the dart moved along the current bar
  and means what it meant. `CAP` went with it — against the peak nothing can
  pass full width. Measured over 600 draws, current/peak has median 0.53 and
  quartiles 0.22/0.72, with 6% under 0.05.
- **Counts stopped being countable at n = 60.** Seven rows in a 46px strip with a
  fixed 3.6px radius drew solid bars, in the figure whose hollow rings exist to
  be counted. The radius follows the row pitch and is unchanged below ~n = 24.

## THE BIG ONE: every baseline is recorded at the NARROWEST canvas

`fingerprint.html` sets `FRAME_W = 900`. The side layout stacks at
`max-width: 880px`, so 900 is **20px above the breakpoint** — every state is
hashed with the rail still beside the figure, on a **550px canvas**, the
narrowest that layout ever produces. Nobody had ever looked at one.

Measured there, **10 of the 32 settled states had a caption printing through its
own note**, by up to **123px**:

| widget | states | colliding |
|---|---|---|
| posterior | 6 | 4 |
| maximum-likelihood | 5 | 4 |
| bootstrap | 3 | 2 |
| the other five | 18 | 0 |

**The halo is what hid it.** `note()` strokes surface-coloured before it fills,
so a collision ERASES the caption underneath rather than blending — the result
still looks like a caption, a short one, and it hashes consistently for ever. A
screenshot at 1400px would never have shown it and no hash ever will. It took
reading the painted text **at the width the harness itself uses**.

`caption()` records where it ended; `note()` checks before claiming the same
baseline and drops INSIDE the panel's top-right when the line is full — the
position `note()` already had, for "a panel whose caption line is already spoken
for". A full line is a caption line that is spoken for. At 770px the automatic
fallback fires **zero** times, so nothing changed for the normal case.

That fixed 7 of 10. The other three were not caption/note pairs, which is the
lesson worth keeping: **a fallback in core only reaches callers that use the core
call.** `bootstrap`'s caption was itself 36px too long and `caption()` has no
fallback to give it; widget 9's ratio-strip heading and its "nothing proposed
yet" line are hand-drawn `fillText`. All three were fixed as copy.

**If you add a caption or a note, measure it at 550px, not at 1400.** The recipe
is below; point it at a 900px iframe.

## Open, and deliberately not fixed

- **`caption()` still has no width fallback.** `note()` got one; a caption that
  is simply too long still runs off the canvas, and the only reason none does
  today is that `bootstrap`'s was shortened by hand. A second occurrence is the
  trigger to give `caption()` the same treatment. The hard part is that there is
  no good automatic answer — truncating a caption is worse than wrapping it, and
  wrapping moves every panel below it.

- **The four widgets that gained visible copy have now been read.** `detail` used
  to render into a `title` tooltip on `segmented` and nowhere at all on
  `int`/`float`; fixing it surfaced written-and-reviewed lines in `clt`,
  `confidence-interval`, `maximum-likelihood` and `power-and-error`. All four
  were read this session. Only `power-and-error` needed anything — its two empty
  strings, now fixed. The other three read well and are considered done.

- **Widget 8 is the cautionary example in widget 9's copy.** Its `mu` tab
  assumes Poisson, and widget 9's readout prints what that assumption costs
  (47% of the interval's width). Agreed deliberately; noted so nobody "fixes"
  widget 8 to match.

## What core gained, because it is a lot

Eight files under `widgets/core/` moved across these three sessions. A fresh
session should know the surface changed:

| change | why |
|---|---|
| `nbLogPmf` / `nbPmf` / `nbDraw` → `stats.js` | widget 9 was the second consumer, which is the rule |
| `sci` / `sup` → `stats.js` | same; both widgets print exponents and should print them alike |
| `noteRight` → `plot.note()` in `canvas.js` | ditto |
| `--c-prior`, `--c-posterior` | a Bayesian figure holds three curves and only one is data |
| `fsLg`, `fsFig` in `readTokens` | canvas needed the larger size tokens |
| `stepLabel` may be `{ param, labels, default }` | widget 9's tabs drive different nouns — 3.4c amendment |
| `detail` renders on **every** field type | it was a tooltip, or nothing — 3.4f |
| `section` field type | a labelled divider between control groups — 3.4g |
| `group` on segmented options | two captioned rows, not a caption that changes — 3.4g |
| `init({ leadDone })` | Replay replays the loop instead of un-dealing the data — 3.4h |
| `note()` falls back INSIDE when the line is full | a caption and its note were printing through each other in 10 of 32 states — see above |

Every one was followed by a full fingerprint run before it was committed, and
that is the only reason this much core churn was safe. The `note()` fallback is
the first that deliberately CHANGED rendering: 17 of 57 states moved, and every
one was accounted for before the baseline was written — 2 `bootstrap` (the
caption shortened), 6 `maximum-likelihood` (untouched file; all six are the note
dropping inside), 9 `posterior`. The five widgets with no collisions and no edits
— 32 states between them — all MATCHed, which is what proves the change reached
only what it should. Three passes agreed exactly before anything was recorded.

## The questions that reshaped widget 9

Worth keeping: a student will ask the same ones, and two of them were things I
had got wrong.

- **"Should the sample be generated first, so it does not move?"** It never
  moved — `compute()` is pure and seeded — but the figure did not say so. The
  lead now deals every count and the hollow rings are what is left.
- **"Are mu / size / Both like MAP?"** No. MAP is a point; these are the whole
  posterior, computed exactly by enumeration over 6,400 cells. **Widget 8
  maximises; widget 9 integrates.** Different verbs, and that is the pair.
- **"Is MCMC finding the denominator?"** The opposite, and this changed a whole
  panel. `P(counts)` cancels out of the acceptance ratio, so the chain never
  computes it. brms shipping a separate `bridge_sampler()` is the proof: if the
  sampler gave you the denominator, that function would not need to exist.
- **"Why guess, when the true distribution is on screen?"** The best question in
  the set. On this problem you *should* just use the grid — the contour is drawn
  so the sampler can be watched agreeing with an answer already known to be
  right, which is the only way to trust it where no such answer exists.
- **"Is `give or take` needed? MLE did not need this extra parameter."** It is
  not a model parameter. The model has two; the three sliders describe a
  **prior**, which is a distribution rather than a value, and a Normal takes two
  numbers where an Exponential takes one. MLE needs none of them because it never
  produces a distribution over the parameter.
- **"Should the tabs be gated until each is played through?"** No — the first
  three are three views of ONE accumulation, and a sample observed once has been
  observed. But the want underneath was real and produced the Replay fix.

## What the numbers said about coordinate ascent, since it will come up

The intuition that widget 8's "best mu, then best size" is a greedy shortcut is
the natural one and it is **wrong for this model**. The best mu is the sample
mean at every size — 8.66 at 0.5, at 2.5, at 10, at a million — because the `r`
terms cancel out of `d/dmu`. Measured, same twelve counts and same prior:

| what you do about `size` | 95% interval for mu | width |
|---|---|---|
| pin it at its estimate, 2.55 | 6.02 – 11.77 | 5.75 |
| don't pin it — integrate it out | 5.87 – 11.86 | 5.99 |
| **assume Poisson (size = ∞)** | **7.10 – 10.27** | **3.17** |

Pinning the nuisance parameter costs **4%**. Assuming the wrong model costs
**47%**. The first two agree because the best mu is the sample mean at *every*
size (8.670 at 0.5, 1, 2.5, 5, 10 and a million, identical to three decimals). **The search strategy is not what costs you; the model
assumption is** — and the `Both` tab is what tells you which case you are in,
because a crest running straight up is what makes the shortcut safe.

## Things these sessions learned the hard way

- **A claim has to survive the whole slider, not just the default.** The size
  prior's caption said "so you expected a lot of extra spread" at every setting
  of a control that runs to 6 — and larger size is LESS spread, which the axis
  label two panels below states outright. Sweeping a slider end to end and
  reading what the canvas prints at each stop takes about a minute. The same
  sweep is what proves there is no `NaN` at either extreme.

- **One ulp is enough to make a figure lie, and the DEFAULT is where it landed.**
  `Math.floor(Math.log(x) / Math.LN10)` on an `x` that should be exactly 1 but is
  `0.9999999999999999` returns `-1`, not `0`. A panel that factors a power of ten
  out of its axis then silently redraws in tenths. It is the first frame a reader
  sees, it survived three review rounds, and the only reason it was caught is that
  somebody read the axis and the printed area in the same breath and multiplied.
  **When a computed exponent feeds a label, put a tolerance in the floor.**

- **On-screen copy names no tool and asserts no significance.** Two passes'
  worth of provenance (`the notebook uses…`, `brms puts its normal(0, 10) on
  log(mu)`, `as brms would`, `the notebook contours the NEGATIVE of this`) and of
  editorial tails (`which is the point`, `nothing else is needed`, `to aim at`,
  `you never get another one`, `taken without EVEN needing u`) came out of
  `posterior` and `maximum-likelihood`. A student needs the fact, not where it
  came from or how much it matters. Provenance still belongs in the comments —
  it is why a default is what it is — but the canvas is not the place. Cutting
  one of them deleted code as well: with `— nothing else is needed` gone, the
  ratio strip's heading always fits, so the measured two-form fallback it needed
  went too.

- **A number measured at the DEFAULT is not a property of the model.** The
  header comment and [docs/catalogue.md](docs/catalogue.md) both said "the
  posterior correlation between the two parameters is 0.024" as settled fact. It
  is the correlation *at the default prior*. Across the prior's range on the same
  twelve counts it runs **+0.393** to **−0.327**. The trap is that the default
  was chosen to be sensible, so the coupling is invisible exactly where anybody
  would look. **Before writing a measured number into prose, move every control
  and measure it again** — the same discipline as a printed caption, applied to
  a comment. Found by a student question, which is the third time that has
  happened on this widget.

- **"The argmax does not move" is not "the parameters are independent."** Widget
  8's best `mu` really is the sample mean at every size — 8.670 at 0.5, 1, 2.5,
  5, 10 and a million. But the likelihood does not factor: a smaller size means
  more variance, so a wider spread of `mu` stays tolerable. The ridge's LOCATION
  is independent of size; its WIDTH is not. On the crest you cannot see the
  difference, and off the crest it is the whole story — force `mu` to 3 when the
  counts average 8.7 and contain a 19, and the size posterior collapses 2.55 to
  0.92. The `size` tab prints that now.

- **A fallback in core only reaches callers that use the core call.** `note()`
  gained a width fallback that fixed 7 of 10 collisions. The other three were a
  caption too long for `caption()` to help with, and two hand-drawn `fillText`
  calls that core has no view of. Fixing the shared path is right and it is not
  the whole job — go back and re-measure rather than assuming the class is closed.

- **A claim printed on a figure has to survive the FIRST press.** The likelihood
  note said `— not 1`, and for a single Poisson observation the likelihood over
  mu integrates to exactly 1 (a Gamma(k+1, 1) in disguise), so the widget printed
  `area = 0.999 — not 1` the moment anyone pressed once. It says `not fixed at 1`
  now, which is true at every count and, at one count, is the more interesting
  statement.

- **Capture the canvas's text and read it.** That bug, two caption/note pairs
  overrunning their panel, a label needing 55px of a 54px margin, and the absence
  of `NaN` at every slider extreme — all found by wrapping `fillText`. **Compare
  spans within a SINGLE frame**: comparing across frames reports every caption
  against its own next value and buries the real hits in noise. Recipe below.

- **`∝` does not render.** At the largest size token it is 3.9px tall against 9.6
  for the `×` above it, and reads as a stray hyphen. The lesson's own figure uses
  it, so it was tried first. Widget 9 uses `=` with the division stated at the
  other end of the same line.

- **Prose is what you reach for when the layout is not carrying the
  distinction.** Four separate questions about widget 9 all had prose answers on
  screen and no structural one. The fixes — a `section` divider, distribution
  names in the labels, a two-row tab strip — deleted more text than they added.

- **A section heading must differ in KIND from a field label, not in degree.**
  The first attempt was `--fs-sm` on `--ink-2` like every label, one weight
  bolder, and the blocks were reported as not apparent. Primary ink, a hairline,
  a full line of air above. Two-word headings: one needing a subordinate clause
  is doing the block's explaining for it.

- **`.w-subtitle` caps at `57ch`, and the old `62ch` was too WIDE, not too narrow.**
  `ch` is the width of the "0" glyph, which runs ~30% narrow against real prose,
  so 62ch was recorded here as "~76 real characters, the top of the readable
  range" and is actually **82** — seven past it. Measured at `--fs-sm`:
  62ch = 469px = 82 characters, 57ch = 431px = 75. The question that found it was
  "why not let the text go full width?", and the answer to that is 196 characters
  per line, ~2.6x the maximum. **The empty space to the right of a subtitle is
  not a problem stretching text can fix**; it is answered by shorter copy. Widget
  9's is 63 words and 5 lines, `bootstrap` 74 and 6, everything else 31–53 and
  3–4. `_lab/subtitle-measure.html` holds the comparison and re-measures live.

- **Replay replays the loop; only Reset undoes the lead.** Core used to re-run
  `init` from nothing, so a button labelled Replay produced a blank figure with
  step and run disabled. `init` now receives `leadDone`. True of `bootstrap`,
  `permutation-test` and widget 8 as well, and it is what makes the lead greying
  out mean something — exactly one control undoes it.

- **An axis window does not have to follow the truth.** Widget 9's true
  parameters were cut because a moving window would let a prior slide off the
  panel; fixing the windows instead (`mu` on [0, 20], `size` on [0.5, 10])
  brought them back, and with them the thing widget 8 is seen doing — set a
  truth, collect counts, watch the posterior find it.

- **A constant used by `draw` must be declared ABOVE `defineWidget`.** It renders
  synchronously at module load, so a `const` below it is still in the temporal
  dead zone and the widget dies with "cannot access before initialization".

- **The fingerprint harness auto-runs on load.** `run()` is the last statement in
  `fingerprint.html`. Clicking **Run** starts a SECOND concurrent pass into the
  same table and the same `latest` array — that is how a 47-state suite reported
  79 rows, and it could make "Copy new baseline" copy a half-interleaved set.
  Load the page and wait; never click Run.

- **The measured numbers are the argument.** The one-parameter build was cut on a
  coverage measurement (64% over 2,000 seeds against 95% for the version that
  shipped); the sampler's jump sizes were chosen over twelve chains of 600 draws;
  58% of rejected proposals score under 2% of the current height, which is why
  the ratio prints in scientific notation below 0.01. All in
  [docs/catalogue.md](docs/catalogue.md) so nobody re-derives them.

- **Two versions of one formula, deliberately.** Widget 9 factorises the negative
  binomial's log-pmf so one count costs 80 `lgamma` calls instead of 6,400, which
  is what makes its prior sliders live. Widget 8 evaluates 2,460 cells in total
  and keeps the plain form. 5.8 says one formula one place; this is the exception
  and it is written down at both ends.

## Verifying, and what actually caught things

`npm run check` before every commit. The fingerprint suite
(`_lab/fingerprint.html`) **whenever `widgets/core/` changes** — it ran clean on
every core change listed above.

**Baselining is slow and the wait is the job.** One pass over 57 states takes
about eight minutes in the browser pane, and a new driven state needs three
identical passes before it is recorded — budget half an hour, and do not start
until the design has stopped moving. Confirm the table is nearly empty straight
after a reload, or you will read a stale one and think a run finished in seconds.

**A DOM-only change does not move a baseline.** The fingerprint hashes the canvas
only, so readout text, control labels and CSS are free. Check before assuming a
re-baseline is needed — it saved half an hour twice.

**Write the baseline back with the original formatting.** A plain
`json.dumps(indent=1)` once rewrote all 47 states and turned an 8-state addition
into a 408-line diff. Preserve each state's own key order and pass
`ensure_ascii=False`. `widgets/manifest.json` is the opposite — it stores
non-ASCII escaped, so write that one with `ensure_ascii=True`.

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
P.fillText = function (s, x, y, ...r) {
  const w = this.measureText(String(s)).width;
  const x0 = this.textAlign === "right" ? x - w : this.textAlign === "center" ? x - w / 2 : x;
  (window.__t ??= []).push([String(s), Math.round(x0), Math.round(x0 + w), Math.round(y), this.getTransform().e]);
  return P.__of.call(this, s, x, y, ...r);
};
// Clear __t immediately before ONE action, so the capture is a single frame.
// Group by y, sort by x, flag any span reaching the next one. Ignore rows whose
// transform is non-zero — those are the rotated axis labels.
```

Stray pointer input moves sliders between tool calls and rewrites the URL. Do
everything for one measurement **inside a single `javascript_exec`**, and assert
`location.search` if the state matters. Screenshots come back at an inconsistent
scale in this pane; pass `scale: 1`, and if the page renders small, resize and
re-take rather than trusting it.

**SWEEP EVERY STATE AT 900px, WHICH IS WHERE THE COLLISIONS LIVE.** This is what
found the caption/note overlaps, and it is worth keeping because a widget's text
is at its most cramped at exactly the width the harness records. Load a widget
into a 900px iframe, hook `fillText` inside it, and force ONE repaint by clicking
its own theme button — far more reliable than waiting on the `ResizeObserver`,
which silently measured nothing about a third of the time and reported the empty
result as "no collisions". **A capture of zero strings is a failed measurement,
not a clean one** — assert `painted > 0` on every row or the sweep lies to you.

```js
const f = document.createElement("iframe");
f.width = 900; f.height = 1500;
f.style.cssText = "position:fixed;left:-9999px;top:0;border:0";
f.src = "/widgets/" + slug + "/" + state;          // a baseline state, verbatim
document.body.appendChild(f);
await new Promise((r) => f.addEventListener("load", r, { once: true }));
await new Promise((r) => setTimeout(r, 260));
const rows = [];
const P = f.contentWindow.CanvasRenderingContext2D.prototype;
const orig = P.fillText;
P.fillText = function (s, x, y, ...r) { /* …push as above… */ };
f.contentWindow.document.querySelector('button[data-key="theme"]').click();
await new Promise((r) => setTimeout(r, 60));
P.fillText = orig;
// Then: group by y, sort by x, flag it[i].x0 < it[i-1].x1, and flag any
// x1 > canvasWidth. Skip rows with a non-zero transform (rotated axis labels).
```

Run it in chunks of about a dozen states — the whole 38-state sweep in one
`javascript_exec` blows the 30s tool timeout, and a timed-out call can leave
hidden iframes behind that need clearing before the next attempt.

## Lab pages, and what each one settled

| page | settled |
|---|---|
| `likelihood.html` | counts vs a normal for the mechanism — counts won, because their heights add to an exact `1.000` |
| `two-then-both.html` | layouts for a surface with two marginals. Records a design cut from widget 8; its finding that two upright curves side by side make the worse-determined parameter look better determined is why widget 9's marginals sit on the plane's edges |
| `plain-language.html` | how much technical detail a biology MSc needs. Widget 8's readout is variant C, and widget 9's two-tiles-per-tab follows it |
| `mcmc-panel.html` | **what the MCMC tab should show.** Settled B — the walk plus the ratio bars — and hollow rings for pending counts. Also records what was cut: the histogram of draws, because at forty draws it reads as the sampler failing. Later reinstated on the plane's edges, where the exact curve sits over it and the reading becomes "not enough draws yet" |
