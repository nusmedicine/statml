# Handover

## Where things are

**Widget 9, `posterior`, is shipped.** Four tabs, baselined with **9 fingerprint
states** (six settled, three driven), and the suite reports **56/56 MATCH**.

The inference arc's pair is now complete: #8 answers `P(Data | Parameters)` and
#9 answers `P(Parameters | Data)`, on the same lesson, the same negative
binomial and the same two parameter names.

`power-and-error` is still the only `draft` in the manifest, and still has no
fingerprint states. Widget 10, `em-mixture`, is sketched in
[docs/catalogue.md](docs/catalogue.md) and has **not** been through the
misconception rule — do that before building it.

## What widget 9 is, in one paragraph

The same twelve counts, arriving one at a time instead of all at once. Every
press adds one observation and every curve moves. Three panels multiply —
likelihood **×** prior **=** posterior — and each prints its own area, which is
the whole argument: the likelihood's is `5 × 10⁻¹³` and nothing holds it there,
the prior's is 1, the posterior's is 1 *after dividing by `P(counts)`*. A `size`
tab does the same for the dispersion, a `Both` tab shows the joint posterior the
two are the edges of, and an `MCMC` tab walks a Metropolis chain over that same
posterior so a reader can see what `brms` does instead of a grid.

## The next job

**Nothing is queued that has earned a slot.** #10 (`em-mixture`) is a candidate,
not a decision — [docs/catalogue.md](docs/catalogue.md) §"Still queued" says so
and names the two candidate misconceptions. The rule at the top of that file is
the gate. `ppv-prevalence` is flagged there as the highest-evidence deferred
item in the whole catalogue, which is a live argument for un-parking it instead.

## Things this session learned the hard way

- **A claim printed on a figure has to survive the FIRST press, not just the
  last.** The likelihood panel's note said `area = … — not 1`, and for a single
  Poisson observation the likelihood over `mu` integrates to exactly 1 — it is a
  Gamma(k+1, 1) density in disguise. So the widget printed `area = 0.999 — not
  1` the moment anyone pressed the button once. It now says **`not fixed at 1`**,
  which is true at every count and, at one count, is the more interesting
  statement.

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
**whenever `widgets/core/` changes** — it ran clean twice this session (47/47
MATCH after the token and helper moves, and again after `nbLogPmf` moved), which
is what made two separate core extractions safe to ship.

**Baselining is slow and the wait is the job.** One suite pass over 56 states
takes about eight minutes in the browser pane, and a new driven state needs three
identical passes before it is recorded — so budget roughly half an hour, and do
not start until the design has stopped moving. Confirm the table is nearly empty
straight after a reload, or you will read a stale one and think a run finished in
seconds.

**Write the baseline back with the original formatting.** A plain
`json.dumps(indent=1)` rewrote all 47 states once and turned an 8-state addition
into a 408-line diff. Preserve each existing state's own key order and pass
`ensure_ascii=False`; widget 9's nine states were **60 insertions and no
deletions**. `widgets/manifest.json` is the opposite — it stores non-ASCII
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
