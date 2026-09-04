# Handover

**FORTY-THREE WIDGETS SHIPPED — 42 on the gallery, `roc-auc` UNLISTED (live at
its URL, off the cards; Kenneth's call, 2026-08-30) — and 324 fingerprint states
recorded. `/lab/` is empty: there is no draft.**

**WIDGET 43 `enrichment` SHIPPED 2026-09-05** after two days and roughly twenty
review rounds. Slot 5 of the high-throughput arc was the last one open, so
**the arc is complete**.

```bash
node scripts/serve.mjs 8010   # 8010-8012 are often taken; launch.json goes to 8014
# /widgets/enrichment/?view=ora&page=one     Venn + 2 x 2
# /widgets/enrichment/?view=ora&page=all     ... plus eight rows and BH
# /widgets/enrichment/?view=gsea&page=one&shown=400&pathway=1   THE ARGUMENT
# /widgets/enrichment/?view=gsea&page=all    ... plus ES, NES, p, after BH
node widgets/_lab/enr-measure.mjs   # nine sections; SS 4-7 re-measured 2026-09-04
node widgets/_lab/enr-metric.mjs    # why the OBVIOUS ranking-metric design was wrong
node widgets/_lab/enr-table.mjs     # why the score table needed NES, not ES
# widgets/_lab/enr-shape.html       # the three shapes, one of which he picked
# widgets/_lab/enr-subpages.html    # the four-page mock-up, annotated with what it got wrong
```

**WHAT THE WIDGET IS.** Four pages: method (overrepresentation / enrichment
score) x view (one pathway / all pathways). *All pathways* is the one-pathway
figure PLUS a clickable results table — clicking a row drives the figure above
it, and the walk survives the click because `pathway` is a display parameter.
On seed 174 the argument lands in one view: pathway 2 is down-regulated, the
score finds it at permutation p 0.001, and overrepresentation reads 0.9991 with
one gene of 41 in the list.

---

## A CORE BUG THIS SHIPPED THROUGH — read before the next widget with regions

**A gated `drag` erased the pointer cursor a `regions` map had just set**, so
clickable rows advertised nothing. Core registers two `pointermove` handlers
and the drag's runs second, assigning unconditionally. The `else` branch below
it already named this collision for an UNGATED drag; the gated branch had it
too. **Enrichment is the first widget to declare `regions` and a gated `drag`
together**, which is why nobody had seen it.

It was not cosmetic: **it blocked shipping.** The fingerprint's `hitAt` proves a
region was struck by reading that cursor, so with the pointer erased no
hit-driven state could be recorded — and `check` requires one of every shipped
widget declaring `regions`. Fixed with a one-line early return in
`widgets/core/widget.js`. The full suite was run and **all 314 pre-existing
states matched**, which is what a core change owes.

---

## THE BASELINE, AND HOW IT WAS DONE

324 states: 314 unchanged, 10 new. Eight settled (all four pages, plus the
background moved, plus `effect=none`, plus the two metrics), one driven (the
walk mid-flight at Slow), one hit-driven (row 3 of ORA's table at `[60,337]`).

**5.10 was followed and is worth following again.** Placeholders `"0"`/`"0"`
went in first; one suite run then both proved the core fix safe and reported
the ten real hashes; only widget 43's ten entries were patched, never the bulk
copy; and a SECOND run confirmed **"All 324 states identical"** before
anything was committed. A positional diff of the file proved 0 of the original
314 had moved. That is the discipline that would have caught widget 42.

---

## THE FOUR THINGS THIS WIDGET SETTLED THAT NO MEASUREMENT COULD

1. **A metric choice needs a stage that can LOSE.** The obvious ranking-metric
   design — add the control to the old constant-shift stage — was measured and
   discarded: signed significance came out strictly better (86% against 92% at
   moderate noise spread, 65% against 98% at high), because a constant shift is
   exactly what a t-test is built to detect. It would have taught that
   sophistication removes the arbitrary choice. The fix was two KINDS of planted
   pathway, loud and quiet, so each metric wins on one. `_lab/enr-metric.mjs`.
2. **NES, not ES, in the table.** With nothing planted, a random 12-gene set
   scores |ES| 0.379 against a 150-gene set's 0.227. The first NES check ran on
   seed 174 alone, where the order is unchanged, and nearly concluded the
   normalisation was pointless — over 40 seeds it reorders on 90%.
3. **ORA is pinned to fold change.** Hiding its metric control was only honest
   once `makeStage` also kept `rankFc`; otherwise ORA's p-values moved for a
   reason the reader could not see. Verified identical under both metrics.
4. **Correction belongs to the collection page only.** It appears on neither
   one-pathway view, and it is out of the subtitle entirely — the notebook's own
   GSEA step 4 says multiple test correction applies to both methods, so
   attributing it to ORA alone was wrong.

**WHAT IS STILL OPEN ON IT:**

1. **The permutation scheme.** `gseaNull` permutes set membership; the real
   thing permutes sample labels and re-ranks. Newly buildable — the stage now
   has an expression matrix — and costed at the foot of `main.js`.
2. **Not judged projected**, which every widget from 11 on still owes.
3. **The notebook link**, which no PHM5003 lesson carries.

**FOUR THINGS THE REVIEW SETTLED that no measurement could have.** Kenneth
picked the figure from three drawn at the real width; then made it two tabs in
the lesson's order; then took the ranking off the ORA tab entirely; then cut
that tab back to a Venn, a 2 x 2 and eight pathways. **A shape mock-up settles
what a figure looks like, not what the teaching sequence is** — ask for the
sequence too, next time.

**TWO PROCESS SLIPS FROM THAT SESSION, both worth not repeating.** Python's
`io.open(path, "w")` truncates before it validates its arguments, and emptied
`model.js` — recoverable only because it was committed; write to a temp file
and `os.replace`. And an R `p.adjust` output quoted from memory flagged a
CORRECT Benjamini-Hochberg implementation as wrong; § 8 of the measure script
now implements R's four documented lines independently instead.

**Widget 42 `hierarchical-clustering` shipped and PUSHED 2026-09-03** after
fourteen review rounds across two sessions the same day. Two tabs over one
20 x 20 table: the Cluster tab draws the pipeline (data matrix → distances →
scatter and tree), the Heatmap tab draws the thing people run. Catalogue
§ *Widget 42* carries every round and every measurement.

**One rule came out of it that is not widget-specific and will bite again:**

> Colour never carries two groupings at once. If a figure shows both what an
> algorithm FOUND and what is really TRUE, the truth gets the colour ramp and
> the found grouping is drawn as ENCLOSURE — boxes, rings, gaps, a bracket.

The reason is that cluster labels are arbitrary. `cut` numbers groups in the
order it meets them, so a comparison between a found grouping and a true one
must be invariant to relabelling, and colour is not. Measured on this widget at
k = 2, where the cut recovered both conditions EXACTLY: 0 of 20 columns shared a
hue between the two strips on four seeds of five. A student reading colour
would have read a perfect result as a total failure.

`tokens.css` is where the trap lives and it is still there for the next widget:
**`--c-group-a`/`--c-group-b` alias `--c-cluster-a`/`--c-cluster-b`** — the same
two series slots. The file argues that is safe because "a cluster figure has no
p-value tail and no theoretical curve in it"; widget 42 is the first to put a
found partition and a true one on the same marks, which that reasoning does not
cover. If you hit this again, the answer is not a seventh hue.

Two attempts failed before the rule was found, and both are worth not repeating:
ink for the truth with solid/dashed rings (cannot carry more than two
categories, and Kenneth read it as "the symbols just confuse me"), and
renumbering both labellings by first appearance (correct at k = 2, broken above
it). `_lab/hc-truth.html` mocks up all four options against the real engine.

**Widget 41 `matrix-factorization` shipped and PUSHED 2026-09-03** after three
review rounds in one day. Two tabs, NMF and PCA, factorising the same matrix
into the same two pieces; two views, the decomposition and the geometry. It
began as `nmf` and was renamed and restructured mid-review. Catalogue § Slot 2
carries every round.

**Widget 40 `batch-effect` shipped and PUSHED 2026-09-02** after eleven review
rounds in one day. One gated widget: ground truth permanently beside the
observed data, and behind the gate four correction methods, a forest plot of
intervals and four dials — disease effect, batch effect, confounding, seed. See
NEXT below; catalogue § Slot 3 carries every round, including the five that
built the wrong widget.

**Widget 39 `normalization` shipped and PUSHED 2026-09-02** after four rounds
across two days — scaling and transforming as two operations, with a quantile
walkthrough behind a gate. Catalogue § Slot 1.

**Widget 38 `shap` Explaining a Prediction** (PHM5005 `04-5 Model Explanation`)
shipped 2026-09-01 after sixteen review rounds: two pages and three tabs — an
abstract three-player game whose six dividend sliders ARE the game, then the
random forest 04-5 declares and never fits, explained for one held-out patient
and then for all sixty. Catalogue § Widget 38 carries all sixteen rounds; four
core changes came out of it — a new `--c-value-low/high` colour role,
`runLabel` taking the map form `stepLabel` had, a hidden control no longer
choosing a drive label, and sections rendering their `detail`.

Widget 37 `mlp` **Neural Networks (MLP)**
shipped and PUSHED 2026-08-31 after ten review rounds across two days,
and **ARC A IS COMPLETE**: every algorithm-family slot of PHM5005 `04-3`
is built. Widget 36 `naive-bayes` shipped 2026-08-30, widget 35
`metrics` the same day. See NEXT below and catalogue §§ Widget 37, 36.
Earlier, on 2026-08-29:

**Widget 34 `roc-auc` SHIPPED** — **Scoring a Classifier** (PHM5005,
04-2 Model Evaluation), six rounds in one day, grown from a D3 app
Kenneth uploaded (kept as `_lab/roc-app-original.html`): one simulated
cohort, overlaid score histograms with a strip-confined draggable
threshold, the confusion matrix following the threshold live, the ROC
curve traced patient by patient, and a momentary find-optimal button
whose scan lands by MOVING the threshold to Youden's J (with a
from-arrow as the receipt). Core gained `drag.hit` for it (round 5;
suite run three times over a flake — see catalogue).

**Widget 15 `logistic-regression` was REBUILT ON ONE COVARIATE** the
same day, three post-ship rounds on Kenneth's live review — see its
section below and catalogue § Widget 15.

**KENNETH'S POST-MIXED-MODEL QUEUE IS EMPTY.** Widget 33
`lm-diagnostics` **Checking the Model Fit** (05-01) shipped the same
day after three rounds; catalogue § Widget 33. THE AGREED MODELING ARC
IS COMPLETE — widget 32 `mixed-model` (05-07, the arc's last slot)
shipped the same day; see catalogue § Widget 32.

**THE MODELING ARC'S FIVE lm-/CAUSAL SLOTS ARE ALL SHIPPED AND LIVE**,
built over 2026-08-27/28: widget 26 `fork-pipe-collider` (nine rounds),
27 `lm-least-squares` **Fitting a Linear Model** (nine rounds incl.
three post-ship), 28 `lm-adjustment` **Fitting Multiple Covariates**
(twelve rounds across two sessions — Fit and Adjust merged into one tab,
Collinearity rebuilt as persistent twins + a VIF section with clickable
bars), 29 `lm-categorical` **Fitting a Categorical Covariate** (one
round — the relevel as eased arrows, the means refusing to move), and
30 `lm-interaction` **Fitting an Interaction** (two rounds — the +/×
toggle, the probe, the axis-to-zero slide, the 2×2 as the canonical
interaction plot with per-line formula rows on the card). **Every
round-by-round record is in [docs/catalogue.md](docs/catalogue.md)**
under its widget's section. Each shipped with its own shooter and
measure script, the pattern now routine:
`_lab/<slug>-shoot.html` (copy proved 4/4 against recorded hashes,
three runs identical, every drive checked non-inert against its bare
URL) and `_lab/lm-{adjust,cat,int}-measure.mjs` (25 / 25 / 33 checks —
every notebook stored output to the digit). Two arc-wide conventions
those sessions settled, worth reusing: **eased values lerp the model
and every printed number is computed from the LERPED coefficients** (no
label is false mid-frame), and **a hit-driven state that performs an
instant param flip runs zero frames and still must differ from its bare
URL** — that difference is the region geometry proven.

## Widget 42 `hierarchical-clustering` — shipped, and what it left behind

```bash
node scripts/serve.mjs 8014            # :8000 and :8010-8013 are other sessions'
W=http://localhost:8014/widgets/hierarchical-clustering
# $W/?shown=19&k=4&truth=1                 the truth coloured, the cut as rings and a bar
# $W/?view=heatmap&truth=1&cutRows=5       both truth strips, and the gaps the cut opens
# $W/?shown=19&separation=0                two clusters out of one population
node widgets/_lab/hc-verify.mjs        # 8400 comparisons against R's hclust
node widgets/_lab/hc-measure.mjs       # every number the figure prints
# widgets/_lab/hc-truth.html           the four ways to show found-against-true
```

**Still open on it, in the order they matter:**

- **Narrow widths unchecked** since the canvas grew to 790 tall. Last measured
  at 375px when it was 400. This is the one thing on the list a student could
  actually hit.
- **Not judged projected**, which every widget from 11 on still owes.

**Traps it paid for that are not in its code:**

- **`parseFloat(canvas.style.width)` returns 100** — the style is `"100%"`. Use
  `getBoundingClientRect()`.
- **A CRLF reference file made 3325 comparisons pass on nothing.** R writes
  CRLF; the trailing carriage return rode on the last header field, `r.value`
  was `undefined`, and `Math.abs(NaN - x) > tol` is FALSE. Reject a non-finite
  value outright rather than comparing it.
- **`Reset` restores every control to its default**, not just the animation. A
  driver that set a parameter and then pressed Reset tested the default three
  times and reported agreement.
- **A `choice` control's range input takes the option INDEX, not its value**,
  and a `segmented` is a `<button>` with no `.value` at all.
- **`legend` is handed `{ params }`; `height` is handed the values SPREAD.**
- **Canvas has no `color-mix`** — `fillStyle` refuses it silently and keeps the
  previous colour, so it renders correctly in Chrome and paints the whole figure
  one colour elsewhere.
- **Canvas discards a NaN path in silence.** Ward's linkage marks never drew at
  all for nine rounds because one line multiplied by a per-metric TABLE instead
  of by the metric's number. No error, no console warning, nothing missing from
  a text sweep — just an absence nobody counted. If a mark "looks missing",
  instrument `moveTo`/`lineTo`/`arc` for non-finite arguments before looking for
  it anywhere else.
- **A test that pins one seed for a rate.** "cutree_rows = 5 boxes the
  unstructured genes" holds in 86% of seeds; seed 1 is in the other 14%.
- **Assertions that assume layout order.** Both axes are shuffled, so "genes past
  index 16 are unplanted" is false. Check membership by label.

## The high-throughput arc — COMPLETE, all five shipped

**Kenneth asked for a plan for PHM5003 `05 - Introduction to High Throughput
Data` on 2026-09-01, and it is in catalogue § *The high-throughput arc*.**
All nine of that week's notebooks were read. **Four already have a shipped
host** — `missing-data` (02), `linear-regularization` (06),
`multiple-testing` (07) and the four dimensionality-reduction widgets (04) —
and `01 Experimental Design` is out of scope. That leaves five:

| slot | slug | notebook | the claim |
|---|---|---|---|
| 1 | `normalization` | 05 / 03 | **SHIPPED 2026-09-02** — scaling and transforming are different operations; min-max and z-score leave the shape **exactly** unchanged |
| 2 | `matrix-factorization` | 05 / 04 | **SHIPPED 2026-09-03** — NMF and PCA as two tabs; the constraint, and what it costs |
| 3 | `batch-effect` | 05 / 05 | **SHIPPED 2026-09-02** — the danger is confounding, not noise; correct a confounded design and the disease effect goes with it |
| 4 | `hierarchical-clustering` | 05 / 08 | **SHIPPED 2026-09-03** — the tree is evidence, the cut is a choice, and the cut answers whether or not there is anything to answer |
| 5 | `enrichment` | 05 / 09 | **SHIPPED 2026-09-05** — a cutoff at the top of a ranking cannot see a set at the bottom; the background and the ranking metric move the answer too |

**ALL FIVE SLOTS HAVE SHIPPED, so this arc is finished and nothing in it is
waiting.** Two of the catalogue's open calls on it survive the arc and are still
Kenneth's: whether `05 / 06` needs a `p ≫ n` act widget 14 does not have, and a
citation to verify.

**The four already-hosted lessons owe notebook links too.** Zero of the nine
carry one — grepped 2026-09-01 — so item 3 below gains four rows.

**What else remains is Kenneth's own**, listed under item 3: the notebook
links, the 05-07 notebook fix he reported done, and judging projected, which
is still owed by every widget from 11 on. **Nothing is picked as of the end of
2026-09-03** — ask rather than choose, and prd §11 exists to be pointed at.

**Widgets 30-38 shipped between 2026-08-29 and 2026-09-01**, all pushed, all
recorded in the catalogue under their own `§ Widget N` sections. Their
per-widget histories used to sit here and were moved out on 2026-09-02 under
this file's own rule: HANDOVER is current state and the next task, the catalogue
is the record.

| widget | slug | shipped | catalogue |
|---|---|---|---|
| 38 | `shap` | 2026-09-01, sixteen rounds | § Widget 38 |
| 37 | `mlp` | 2026-08-31, ten rounds — completed Arc A | § Widget 37 |
| 36 | `naive-bayes` | 2026-08-30 | § Widget 36 |
| 35 | `metrics` | 2026-08-30, five rounds | § Widget 35 |
| 34 | `roc-auc` | 2026-08-29, six rounds — UNLISTED on the gallery | § Widget 34 |
| 33 | `lm-diagnostics` | 2026-08-29, three rounds | § Widget 33 |
| 32 | `mixed-model` | 2026-08-29, seven rounds | § Widget 32 |
| 31 | `time-event` | 2026-08-29, eighteen rounds | § Widget 31 |
| 30 | `causal-dag` | act 1 added 2026-08-29 | § Widget 30 |
| 15 | `logistic-regression` | rebuilt on one covariate 2026-08-29 | § Widget 15 |

**THE CORE DOORS THOSE SESSIONS ADDED**, which are the part a new widget needs
to know about — each is documented at its own definition in `widgets/core/`:
`style: "action"` (a bool rendering as a full-width button), `style: "bits"` (an
int as a row of toggles), `legend` as a FUNCTION of the params, `drag.hit` (a
pointer drag confined to a strip), `--c-value-low/high` as a colour role,
`runLabel` taking the map form `stepLabel` had, sections rendering their
`detail`, `style: "grid"` on segmented with `span` on an option, and
`mathmlRenders()` moving into `core/env.js`.

**The 2026-08-27 cross-widget audit's free-surface half is COMPLETE,
Kenneth-reviewed line by line, MERGED and LIVE** (pushed the same day; the
branch is deleted). All 24 subtitles and all 24 blurbs settled
one at a time with him; widget 7 retitled **Decision Making** (slug kept —
students hold the URL; rename after the course ends); metas are now the blurb
verbatim with `check` enforcing the match; the rail speaks one vocabulary
(Play speed with Slow/Medium/Fast(/Fastest), True groups, Groups in the data);
two titles re-cased. **Every decision is codified in design-principles**:
the register in **2.10**, shared control vocabulary and the reveal pattern in
**3.7** and **3.4j (amended)**, visible-data-only claims in **2.11**, and the
meta-equals-blurb invariant in **5.8 (amended)**. **The hashed batch landed
the same day** — the audit is CLOSED; see its section below.

**The RAIL-SECTION SWEEP followed the same day and is COMPLETE and LIVE.**
Kenneth's rule: where a rail carries a choice of data, it says so — a data
section and an algorithm section. Eleven widgets gained their headings, one
Kenneth pick at a time from mock-ups in `_lab/dimred-rail.html`; **16 of 25
now carry sections and the 9 flat rails are flat for reasons recorded in the
catalogue** (§ *The rail-section sweep*, under the audit entry — the rule, the
picks, the boundary rulings, and bootstrap's reveal deliberately superseding
3.4j's after-Seed position). One core change rode along: **`.w-section` now
spans its grid row** — in the stacked layout the heading's hairline used to
stop at one cell (reported from mobile); the full suite ran for it, **159 of
159 MATCH**, and no state was rebaselined because the rail is outside both
hashes. **Kenneth then reviewed the whole open-items docket and PARKED all of
it** except deleting `widgets/_lab/index.html`, which is done — see *Deferred*
below.

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

## The suite: 314 states, all matching

**Widget 42 added eleven on 2026-09-03** — nine settled and two driven, since a
suite of settled states is no test of an animation. They were computed three
times over before being written down, and the other 303 matched on every run.
`check` then rejected the two heatmap states for not pinning `shown`: that tab
ignores it, but the invariant is blanket, and re-running proved the hashes
unchanged by the pin rather than assuming it.

**Widget 40 added eleven on 2026-09-02 through `_lab/batch-shoot.html`** — nine
settled across both gate states, two driven easing between correction methods in
each direction. Each shot three times in one run and refused if the triple
disagreed; the shooter's copy proved 4/4 against known-good states first; both
drives checked against their settled sibling. **One driven state's `tx` equals a
settled state's on purpose**: the readout prints the target state's numbers while
only the canvas eases, so the text is already at its destination when the picture
is halfway there. Widget 39's driven state has the same shape.

**Widget 39 added eight on 2026-09-02** through `_lab/norm-shoot.html`, seven
settled and one driven.

**Widget 37 added eleven states on 2026-08-31 through the full suite** (the
widget-24/31 route, no shooter): three whole-suite runs at DPR 1.25 with all
eleven hashes byte-identical on every run, spliced, then a confirming run read
**268 of 268 MATCH**. Nine settled, two driven — one mid-training at Medium
where epochs are merely counted, one 0.6 through the FIRST step at Slow, which
lands in the backward phase of the choreography. No regions, so no hit state
owed. **`check` refuses a driven state that also carries `shown=`**, which is
right — `shown` fast-forwards, so nothing would be in flight — and both driven
states start from scratch because of it.

**The pane flake was unusually visible on the way**: run 1 flagged five px-only
DIFFERs across lm-adjustment, roc-auc and naive-bayes, run 2 flagged two
naive-bayes states, run 3 flagged none, and every `tx` half was identical
throughout. A different set each run is the pane, not the widgets — and the
confirming run agreed. **The core change (`style: "action"`) had already run
the suite green at 257 of 257** before any widget-37 state went in, which is
what proves it reached nothing that does not ask for it.

**Widget 36 added eight states on 2026-08-30 through the full suite**
(the widget-24/31 route, no shooter): three whole-suite runs at DPR 1.25
with all moved hashes byte-identical on every run and the 247
pre-existing states matching on every run, spliced, then a confirming
run read **257 of 257 MATCH**. Six settled (the empty open is legal —
the widget declares no `shown`; admission lives in the pill params), two
driven mid-grow via `set` on the pills. **The harness was taught pills
for this** — setParam clicks a `.w-pill` only when its `aria-pressed`
differs from the target — and that fix exposed a shipped silent no-op:
**time-event's two driven states had been INERT since their 2026-08-29
recording** (the old generic branch wrote `.value` to the pill button
and fired an event nothing listened to, hashing an undriven figure —
5.7's exact failure shape). Both were rebaselined in the promotion
commit; each new `tx` equals its settled sibling's, the proof the param
now actually flips. Their scrub-and-drag caveats are unchanged.

**Widget 15's states were re-recorded TWICE on 2026-08-29 with
`_lab/logistic-shoot.html`** (derived from roc-shoot, DPR gate included):
once for the one-covariate rebuild (four settled, replacing four whose
URLs died with `xvar`/`age`/`bmi`), and again for round 3's ease — where
**all four settled `px` hashes came back IDENTICAL** (the ease lands
exactly on the pictures the old toggle jumped to; only `tx` moved with
the tile renames and the swapping equation card) and a fifth state went
in, driven mid-bend (`set link=logit`, 8 frames, non-inert). The round-2
pill change re-ran the shooter purely as proof: the rail is outside both
hashes, and all four states read byte-identical. The same day's
lm-interaction fix (rise labels to two decimals) re-shot all 13 of its
states: exactly the three diabsex-tab states moved, px only.

**Widget 34 added seven states on 2026-08-29 with `_lab/roc-shoot.html`**
(the lm-shoot pattern, plus a DPR gate: the shooter WAITS for
devicePixelRatio 1.25 before shooting — the pane reports 1 until it is
displayed and can flap back to hidden between runs, and the first two
attempts were refused by the copy-proof for exactly that). Copy proved
4/4, every state shot three times in one run and identical, both drives
non-inert. Five settled (`shown=0` untraced, `shown=999` traced,
`youden=1&shown=999` found — the pill settles by URL, `threshold=0.7`,
and a weak imbalanced cohort), two driven (`click: "run"` 40 frames
mid-sweep, `click: "step"` 5 frames mid-step). The confirming full-suite
run read **237 of 237 MATCH**. The round-5 core change (`drag.hit`) had
already run the suite three times the same day — run 1's five
lm-adjustment px-only DIFFERs matched on both the stash-control and the
re-run: the pane flake, clustering.

**Widget 33 added ten states on 2026-08-29 with `_lab/lm-diag-shoot.html`**
(the lm-shoot pattern): DPR checked at 1.25 in the run's own output, copy
proved 4/4 against recorded hashes, every state shot three times in one
run and identical, every drive checked non-inert against its bare URL.
Seven settled (claim via `?claim=1` — a pill is a `<button data-param>`
setParam cannot toggle), three driven: the gate-click ENTRY at 30 frames
(a gate counts as a drive button; its `tx` equals the settled fit's,
correctly — mid-flight only the picture differs), the scenario morph at
4 frames, and `set junk=12` at zero frames (an instant flip that still
differs from its bare URL). No full-suite rerun owed — nothing in
`widgets/core/` moved for this widget.

**Widget 30 re-baselined and extended on 2026-08-29** (the revived age ×
BMI act + the legend, TWICE — generic shipped and rejected, then the
live per-tab legend through core's new function door): each re-shoot of
the 13 states asserted px identical at splice (a legend is DOM-only) with
tx moving; three act-1 states added; and the CORE change ran the full
suite — **220 of 220 MATCH**, the 207 static-legend states proving the
door touches nothing that does not open it.

**Widget 32 added ten states on 2026-08-29 with `_lab/mixed-shoot.html`**
(the lm-shoot pattern): copy proved 4/4 against recorded hashes, every
state shot three times in one run and identical, every drive checked
non-inert against its bare URL. Seven settled, three driven mid-ease
(`set view=related` on each data tab, `set ranef=slope` on Syntax — the
only harness verbs the widget has; no regions, so no hit state owed).
The confirming full-suite run read **217 of 217 MATCH**; nothing in
`widgets/core/` moved for this widget, and the 207 pre-existing states
held on the same run.

**Widget 31 added nine states on 2026-08-29 through the full suite**
(the widget-24 route, no shooter): three whole-suite runs at DPR 1.25
with the nine hashes identical on every run and the 198 pre-existing
states matching on every run, spliced, then a confirming fourth run
read **207 of 207 MATCH**. Seven settled (Censoring finished; ten
patients four censored dropped; the `shown=14` mid-build still; groups
with bands+shared; effect none; follow 5; the full factors model), two
driven mid-ease (`set` on the age and snps pills). No regions, so no
hit state owed; the scrub has no harness verb and is recorded as
untested geometry.

**Widget 30 added ten states on 2026-08-28 with `_lab/lm-int-shoot.html`**
(the lm-shoot pattern): copy proved 4/4, three-run stable, drives
non-inert. Six settled, three driven mid-ease (`set` on the terms and
zero controls — the split, the domain slide, the 2×2 pivot), one
hit-driven on the probe's year-40 region at [160, 160]. That hit ran
ZERO frames — the probe is an instant param flip with no ease, so the
drive queue was empty — and the state still hashes different from its
bare URL, which is all the region rule wants: the geometry, proven. No
full-suite rerun owed — nothing in `widgets/core/` has moved since its
last green run at 173.

**Widget 29 added seven states on 2026-08-28 with `_lab/lm-cat-shoot.html`**
(the lm-shoot pattern): copy proved 4/4, three-run stable, drives
non-inert. Four settled by URL, the gate mid-fade (`click: "gate-fit"`),
the relevel mid-ease (`set ref=obese` — the rule between two means,
labels counting), and a hit on the obese column at [300, 160] — which
hashes IDENTICAL to the set-driven state (same write, same door, same
frames) and DIFFERENT from its bare URL: for a region that performs the
same transaction as a control, that identity is the correct outcome and
the bare-URL difference is the geometry proven. No full-suite rerun owed
— nothing in `widgets/core/` has moved since its last green run at 173.

**Widget 28 added eight states on 2026-08-28 with `_lab/lm-adjust-shoot.html`**
(the lm-shoot pattern): copy proved 4/4 against recorded hashes, every
state shot three times in one run and identical, every drive checked
non-inert against its bare URL. Five settled by URL (the pills are
`<button data-param>` the harness's setParam cannot toggle, so URLs do
the settling — `vifvar` included), one driven mid-slide (`set
view=resid`, vmix ≈ 0.64), two hit-driven: the DAG age node at
[60, 164] (the forest marks mid-ease — the only driven path to the ease)
and age's VIF bar at [500, 660], which hashes IDENTICAL to the
`vifvar=age` settled state and DIFFERENT from its bare URL — for a
region whose effect is an instant param flip, that identity is the
correct outcome, not the mds/balancing-data failure (those drives
changed *nothing*, including against their own bare URL). No full-suite
rerun owed — nothing in `widgets/core/` has moved since its last green
run at 173.

**Widget 27 added six states on 2026-08-28 with `_lab/lm-shoot.html`** (the
causal-shoot pattern): copy proved 4/4 against recorded hashes, every state
shot three times in one run and identical, both driven states checked
against their settled siblings. Four settled, two driven (mid-crawl via
Fit; one exact minimisation via Step). The settled states carry `shown=0` —
`check` requires a widget declaring `shown` to pin it. **Rebaselined three
times the same day for the post-ship rounds** (R² tile: 6 tx; the strip +
grid default: 6 px, one settled URL moved to `?grid=0`; the trend-line
removal: 6 px) — each in the same commit as its change, each by re-running
the shooter. **The full suite last ran green at 173 of 173** for the day's
second core change (the `style: "pill"` bool); the first (`--c-cost-low/
high` + `env.js`) ran it at 167 of 167. Core has not moved since the pill.

**Widget 26 added eight states on 2026-08-27 with `_lab/causal-shoot.html`** —
the missing-shoot pattern, plus one improvement worth reusing: the shooter
itself shoots every state THREE times in one run and refuses to print JSON on
a flake, and shoots every driven state's bare URL beside it, flagging a drive
that changed nothing. The copy proved 4/4 against recorded hashes; five
settled, two driven mid-ease, one hit-driven on the DAG's third-variable
node. No full-suite rerun owed — nothing in `widgets/core/` moved since its
last green run.

**The rail-section sweep's core change ran the full suite on 2026-08-27:
159 of 159 MATCH.** `.w-section` gaining `grid-column: 1 / -1` is the only
`widgets/core/` change the sweep made; the eleven per-widget rail edits are
outside both hashes (`px` is the canvas, `tx` is `.w-math`/`.w-legend`/
`.w-readout`, and the rail is neither), so nothing was rebaselined.

**Widget 25 added seven states on 2026-08-27 with `_lab/missing-shoot.html`**,
on the kmeans-shoot pattern: the copy proved against four recorded hashes
first, three byte-identical runs, spliced directly — no full-suite rerun owed,
nothing in `widgets/core/` moved.

### And widget 24 ran the full one

**Widget 24 added eight states on 2026-08-27 by running the full suite three
times**, then a fourth against the recorded hashes: **152 of 152 MATCH**. It did
not need the full run — nothing in `widgets/core/` was touched — but the suite
was the cheapest way to get eight hashes at once, and it bought a real
assurance for free: **the 144 pre-existing states all matched on every run**, so
nothing in the new widget reached a widget nobody was looking at.

**Widget 23 added five states on 2026-08-26 WITHOUT running the suite**, with
`_lab/kmeans-shoot.html` — which is what *NEVER BASELINE BY PLACEHOLDER-AND-DIFF*
below prescribes. It reproduced four existing baseline hashes first, to prove its
copy of the harness had not drifted, and all five new states were identical
across three runs.

**Every state before those is recorded and every one matches.** Widget 22's five states went
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
| 23 | `kmeans` | shipped. Planned, measured, built and revised over four review rounds on 2026-08-26, then baselined with five states |
| 24 | `dbscan` | shipped. Planned and measured on 2026-08-26, built and revised over two review rounds on 2026-08-27, then baselined with **eight** states — five settled, three driven |
| 25 | `missing-data` | shipped. Planned, measured, built, revised over **seven** rounds, judged projected and promoted in ONE day (2026-08-27); seven states — five settled, one driven mid-beat, one interrupted. `node widgets/_lab/missing-drive.mjs` = 130 assertions |
| 26 | `fork-pipe-collider` | shipped. Nine rounds in one day (2026-08-27); eight states — five settled, two driven mid-ease, one hit-driven. NOT yet judged projected; 06-02 link not yet placed |
| 27 | `lm-least-squares` | shipped. NINE rounds over 2026-08-28 (rounds 7–9 post-ship: R² tile, the residual strip, grid-on default — each rebaselined same-commit and pushed); six states. NOT yet judged projected; 05-01 link not yet placed |
| 28 | `lm-adjustment` | shipped as **Fitting Multiple Covariates**. TWELVE rounds across two sessions (2026-08-28), promoted on "tested ok" and pushed; eight states — five settled, one driven mid-slide, two hit-driven. NOT yet judged projected; 05-02 link not yet placed |
| 29 | `lm-categorical` | shipped as **Fitting a Categorical Covariate**. ONE round in one session (2026-08-28); seven states — four settled, two driven, one hit-driven. NOT yet judged projected; 05-03 link not yet placed |
| 30 | `lm-interaction` | shipped as **Fitting an Interaction**. TWO rounds (2026-08-28), then act 1 (age × BMI, the fan) revived post-ship 2026-08-29 with the LIVE PER-TAB LEGEND; **13 states** — eight settled, four driven, one hit-driven. NOT yet judged projected; 05-04 link not yet placed |
| 31 | `time-event` | shipped as **Modeling Time-to-Event Data**. EIGHTEEN rounds in one day (2026-08-29), every design change mocked in `_lab/time-event-round12.html` first; nine states — seven settled, two driven mid-ease. No Step/Play — the scrub is the time control. NOT yet judged projected; 05-06 link not yet placed |
| 32 | `mixed-model` | shipped as **Modeling Hierarchical Data**. SEVEN rounds in one day (2026-08-29); ten states — seven settled, three driven mid-ease. Three tabs (Repeated · Nested · Syntax), no Step/Play/gate — figures open finished, two eases on the request door. NOT yet judged projected; 05-07 link not yet placed |
| 33 | `lm-diagnostics` | shipped as **Checking the Model Fit**. THREE rounds in one day (2026-08-29); ten states — seven settled, three driven (the gate's ENTRY mid-conveyor, the scenario morph, the act's path). All-simulated stage; entry + hover link + claim bells; the claim pill settles by URL and its stagger ease is untested geometry. NOT yet judged projected; 05-01 link not yet placed |
| 34 | `roc-auc` | shipped as **Scoring a Classifier** (PHM5005, 04-2), then **UNLISTED 2026-08-30** — off the gallery, live at its URL, no draft bar (`status: "unlisted"`), because widget 35 carries the ROC act. SIX rounds in one day (2026-08-29), grown from Kenneth's D3 app; seven states — five settled, two driven. Core gained `drag.hit`. The drag and the scan are untested geometry. NOT yet judged projected |
| 35 | `metrics` | shipped as **Scoring the Predictions** (PHM5005, 04-2). FIVE rounds in one day (2026-08-30); **eleven states** — nine settled, two driven. Two outcomes, and categorical picks matrix or ROC (`?outcome=`/`&view=`); MathML formula card, positive-class pick that renames the cells, macro/weighted averages, the trace as a one-way door. Core gained `when.all`, readout `{ break: true }`, segmented `token:`. The threshold drag, the Youden scan mid-flight and the positive-class flip mid-trace are untested geometry. NOT yet judged projected; 04-2 link placed |
| 37 | `mlp` | shipped as **Neural Networks (MLP)** (PHM5005, 04-3 § Neural Networks — Arc A's LAST slot). TEN rounds across 2026-08-30/31; **eleven states** — nine settled, two driven (mid-training at Medium; 0.6 through the first step at Slow, in the backward phase). Two live panels (network + boundary), a loss strip, a magnified neuron aligned to the network's columns, hover inspector, and Slow choreographing one training step. Engine pinned to the reference at 1.1e-15. Core gained `style: "action"`. NOT yet judged projected; 04-3 link not yet placed |
| 36 | `naive-bayes` | shipped as **Naive Bayes** (PHM5005, 04-3 § Probabilistic — Arc A slot 5). EIGHT rounds in one day (2026-08-30); **eight states** — six settled, two driven mid-grow. Continuous · Discrete tabs (GaussianNB on CRP+WBC, BernoulliNB on fever+chills), per-feature pills as URL state, Independent \| Correlated segmented imposing ρ/λ on the FITTED marginals. The harness learned `style:"pill"` buttons at its promotion. NOT yet judged projected; 04-3 link not yet placed |

**Every one of those histories is in [docs/catalogue.md](docs/catalogue.md)**,
organised by widget, including the rounds that reversed an earlier decision and
why. Read the round headings there before changing anything.

**Widget 15's marginal-vs-conditional note is MOOT** — the 2026-08-29
one-covariate rebuild removed the second covariate the note was about.
**No widget from 11 through 24 has been judged projected** (25 was, on its
promotion day); old, and blocks nothing.

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

## THE CROSS-WIDGET AUDIT: COMPLETE — free surfaces and hashed batch both landed

**Kenneth's 2026-08-27 brief — design consistency, and prose that is too
AI-like — was run on 2026-08-27.** The inventory is
`node widgets/_lab/audit-inventory.mjs --report`: it stub-imports all 24 configs
and puts every subtitle, control label/detail, drive verb, legend entry and
readout tile in one JSON. (Do not regex the source for these strings — that is
how the first subtitle measurement reversed.)

**Done, in commit `Audit, free surfaces` — nothing hashed was touched:**

- **Eight subtitles rewritten**, every one shorter, the tic struck rather than
  the grammar compressed: bootstrap 398→224, trees 363→221, bayesian 355→228,
  logistic 340→296, permutation 289→271, confidence 252→236, galton 225→209
  (aphoristic closer cut), kmeans recast at 174. Arc now spans 140–296.
- **The a23be6b deferred drive-label items**: ML `Step`→`Next candidate`
  (honest in all three tabs), em-mixture lead `Start`→`Guess two curves`,
  leadHints added to bootstrap and permutation-test, bayesian's hint no longer
  names "Step" beside a button reading "Add a count" (it names the condition
  alone — a static hint cannot follow a tab-dependent label).
- **"Play speed" everywhere** — was "Speed" (prob-mechanisms) and "Pace" (trees).
- **Rules solidified**: design-principles **2.10** (subtitle budget + the tics
  table) and **3.7** (one name per repeated control; the leadHint pattern).
  CLAUDE.md's token-role list corrected and completed; `tokens.css` now records
  the audited reading of `--c-empirical` — **what the reader BUILT from the
  data** (pile, likelihood, fit, arrangement, embedding), never "raw data".
  Under that reading all 24 widgets are consistent; raw samples wear
  group/outcome colours or `--c-unknown`, measured constraint tables wear ink.
- **`--c-unknown` audit: CLEAN.** All seven users mean "not known yet".
- **Verified live** (subtitles, hints, buttons, greying) and the full suite ran
  twice for the tokens.css comment: second run **152 of 152 MATCH**.

**FOUND, NOT FIXED — a flaky fingerprint state on Windows.** First suite run:
`clt ?theme=light&dist=exponential&n=5&shown=12` DIFFERed on `px` only
(`tx` identical); second run, all 152 matched. One-off, same shape as
odds-and-risk's old Mac flakiness. If it DIFFERs alone again, suspect the flake
before the change.

### The line-by-line review happened, and the register it settled

Everything free was reviewed with Kenneth one surface at a time on 2026-08-27
and is on the branch. What the review added beyond the first pass, now codified
in 2.10's amendments:

- **Conventional textbook register, concept first** (often literally "We
  can …"); the field's own terms over vivid ones ("assigned", not "claims") but
  no more technical than the course has reached; never describe the dashboard;
  **no lesson references in widget copy** (widgets must be reusable — the
  lesson links to the widget, never the reverse); keep claims generalizable
  ("the confidence level", not "the 95%").
- **Blurb = one declarative sentence naming the method**; meta description =
  blurb verbatim, and `check` now fails a drifted pair. The check caught its
  first real drift the same day it landed (balancing-data, whose review also
  fixed a real error: class weights do NOT rebalance data, they reweight the
  fit).
- **Two review artefacts**: the prose sheet (Artifact
  <https://claude.ai/code/artifact/95289ad4-6c8a-459e-a391-e3cea4db6ca9>) and
  `_lab/vocab-labels.html`, the four-frame mockup that settled the rail
  vocabulary. `_lab/audit-inventory.mjs` regenerates the data.

## Open items on already-shipped widgets

These are the things a past session recorded and did NOT fix. Each is a
deliberate deferral, not a bug list — the full reasoning is in the catalogue
under each widget's own section.

**NOT YET JUDGED PROJECTED** — widgets 22 (`tsne`) and 23 (`umap`) have never
been looked at from the back of a lecture room. Principle: thin strokes and
small tick labels are what fail at distance.

**Widget 24 `kmeans`, three recorded and not fixed:**

- The objective is not monotone in K on a single start. On 16 of 60 walks a
  reader could take, the within-cluster SS tile goes UP as K goes up, because
  "falls at every K" is a claim about the global optimum. `n_init` is the cure
  and is on the widget, defaulted to 1 so the lesson still fires; the claim
  itself is not made on screen.
- `shape` was never built. The elongation cliff is measured — nothing breaks at
  3:1, 11 of 30 runs break at 4:1, 30 of 30 at 8:1 — and `blobs(rng, { aspect })`
  is written and exported. One control.
- The widget runs Forgy; the reference implementation runs k-means++. Both are
  exported and verified; an `init` control showing the pair is one segmented
  control.

**Widgets 21-22 (`tsne`, `umap`), two recorded and not fixed:**

- A published `step` survives a data change in the URL but not in the figure.
  Measured: `?step=40` reads KL 0.157, then moving `perplexity` reads 1.727
  while the URL still says `step=40`. Core's `seededOnce` is deliberate; leaving
  the parameter in the address bar is not. **The fix is core's and owes a full
  fingerprint run.**
- Widget 21 draws the same wireframe globe over samples that fill the BALL.
  Widget 22's sit on the sphere and its globe is a surface; widget 21's is not,
  and implies one its data is not on. It never claims a manifold, so it is the
  smaller version of the same problem.

**Widget 25 `missing-data`:** the slug rename `power-and-error` →
`decision-making` waits for the course to end (noted at its `title:`).

**Widgets 22-25 shipped 2026-08-27**, all pushed, all recorded in the catalogue.
The cross-widget audit and the height sweep that ran alongside them are both
CLOSED — see the audit section above.

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

### Working beside another session

`.claude/launch.json` has **`widgets-alt` on 8011** beside `widgets` on 8010:
two sessions cannot share a pinned port, and the second lane keeps both
deterministic. The 8010 pin and its rationale are unchanged.

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

**`git commit` can die with `unable to write file .git/objects/…: Permission
denied` while PowerShell writes the same path fine.** It is Dropbox racing
git for the new object file — the same class as the `_site` delete retry —
and it struck three times on 2026-08-27. **Retry with backoff before
diagnosing anything** — the second strike cleared in seconds, the third took
~45 s (`git hash-object -w <file>` in a sleep-8 loop is a clean probe: the
moment it writes, the commit goes through). The first strike
persisted across retries from both shells and cleared only after
`core.createObject rename` went into the repo config (Dropbox's filter driver
can deny the hardlink git defaults to); the setting is still in place, and the
second strike proved it is not a complete cure on its own. So: retry, and only
then chase configuration — never permissions.

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

### Text-sweep traps (a)-(i) — most are one shape: a silent no-op reads as a pass

A "text sweep" here means wrapping `CanvasRenderingContext2D.prototype.fillText`
to collect every string a widget paints, driving it through its states, and
checking the collected boxes for collisions, overflow and bad numbers. It is the
cheapest check in the repo and it has failed silently nine distinct ways.

**(a)** The `resize` repaint is inert — 45 states came back with zero strings and
looked clean; clear the buffer BEFORE the parameter write, not after, and
split on the caption because one state can cause several repaints.

**(b)** rAF is throttled to ~1 frame per 300 ms here, so a 45-state sweep on
`requestAnimationFrame` times out — use `setTimeout(0)`, in chunks of 15.

**(c)** A `const` in its temporal dead zone made `draw` throw and abort after
panel 2, and the collision sweep PASSED because the two lines it would have
collided with were never painted. Any sweep must assert that the LAST thing
`draw` paints is present in every state, or it is checking a partial figure.

**(d)** A `const` in its temporal dead zone has now done this TWICE — `SHORT`
in `normalization`, `byBatch` in `batch-effect` — and the second time the
sweep passed, because its terminator was the x-axis label and `axisX` paints
that BEFORE the caption and note. **A sweep's terminator must be the last
thing `draw` paints**, not merely something late in it.

**(e)** An ease running in the background leaks frames into the next state's
capture, and every string then collides with ITSELF — 80 findings, all
spurious.

**(f)** Split the buffer on the LAST thing a paint draws, never the first.
Slicing on panel 1's caption worked until the walkthrough started drawing above
it, at which point the slice ate the previous paint's tail and
reported `values -2.00 – 7.10` colliding with `values -11.7 – 7.1`. The
pipeline line is the terminator here.

**(g)** A `const` in its temporal dead zone, THIRD time — `axisFmt` in
`batch-effect`, declared beside `ticksOf` at the foot of the file. `draw` runs
while the module is still evaluating, so **every helper below `defineWidget`
must be a `function` declaration**, which hoists. Two of the three were caught
only by opening the page.

**(h)** A sweep that never reloaded tests the PREVIOUS version. 60 states came
back clean while the current module threw on every render, because the page
had been loaded before the edit. `npm run dev` sends `no-store`, but nothing
reloads for you. **Navigate first, and make the sweep fail on any uncaught
error** — one `window.onerror` listener is the whole fix.

**(i)** A collision test cannot see CROWDING. Two axis labels 23px apart with
no overlap passed, and read as one run-on string. A sweep should also fail a
gap under about 10px between strings sharing a baseline. This is the case for
judgement: the assertions were right and the picture was still wrong.

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

## Deferred — Kenneth reviewed this whole docket on 2026-08-27 and PARKED it

**Everything below was elaborated for him item by item and consciously parked,
not forgotten.** None of it blocks anything; pick up only what he asks for.
The full docket he ruled on also included, from other sections of this file
and the catalogue: the widget-20 default swap, widget 21's structureless-cloud
`labels` option and its wireframe globe, widget 15's marginal-vs-conditional
note, widget 17's 20 boosting rounds, dbscan's discs-off default, kmeans's
unbuilt `shape` and `init` controls, and core's published-`step`-survives-a-
data-change fix (the one item that owes a full fingerprint run).

*(The old "Button labels" block that led this section landed with the
2026-08-27 audit — ML's "Next candidate", em-mixture's "Guess two curves",
the bootstrap/permutation leadHints, bayesian's hint — and was removed.)*

**Judge projected.** Widgets 11, 12, 13, 14 and 15 have never been seen from the
back of a room. Widget 11's hypergeometric dots are ~4px at the narrow layout;
widget 15's binomial intervals are 1px hairlines and its strip bars ~3px wide.

**Give `fingerprint.html` an `?only=<slug>` filter.** It always runs every state,
which is what forces the loop in *NEVER BASELINE BY PLACEHOLDER-AND-DIFF* above.
A filter would make "record the new widget's states" a first-class thing the
harness does rather than something worked around.

**`widgets/_lab/index.html` was DELETED on 2026-08-27** (Kenneth's call,
delete over catch-up). It listed 13 of 32 pages, drifted with every mock-up,
and the catalogue already names each lab page beside the decision it settled.
**Do not recreate it** — a list nobody maintains reads as maintained.

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

**THE SUITE WAS FLAKY UNTIL 2026-09-01, AND THE CAUSE WAS A SCROLLBAR.** Five
runs of the same code reported 0, 6, 0, 4 and 8 differing states, always drawn
from `lm-adjustment`, `roc-auc` and `naive-bayes`.

**A figure taller than the frame gives the framed document a scrollbar; the
scrollbar takes ~15px off the width; and a canvas sized from that width
re-renders narrower.** That second layout pass is what a fixed 400ms wait caught
sometimes and missed sometimes. Measured before fixing: every flaky state was
hashed **688** backing pixels wide where its baseline holds the settled **669**,
and only the ELEVEN states tall enough to scroll were ever affected. The
baselines were already the settled value, so the fix cost no rebaselining.

`shoot()` now calls `settle()`, which polls the canvas's dimensions until they
hold still for two consecutive 50ms samples — comfortably past core's
60ms-debounced ResizeObserver — with a floor of the old wait and a 4s cap. A
state that never settles is hashed anyway and says **NEVER SETTLED** in its note
rather than passing quietly. **Every row now carries the size it was hashed at**
in `tr.title` and `tr.dataset.size`, because the first question about a px-only
difference is whether the canvas was even the same shape.

**If a DIFFER ever appears again, three tells say it is measurement and not
code, and all three must point the same way:**

1. **`tx` unchanged and only `px` moves** — same text, different pixels: the
   drawing did not change, the SURFACE did. Check `dataset.size` first.
2. **The set varies between runs.** A regression is the same states every time.
3. **The code you touched cannot reach them.** `lm-adjustment` declines both
   drive buttons (`stepLabel: null`, `runLabel: null`), so the label resolver —
   the suspect at the time — could not run there at all.

Run with the pane VISIBLE and do not poll it from another tab: switching tabs
mid-run backgrounds the harness. **Read the code before rebaselining anything.**

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
