# Handover

**2026-09-26 (later): 67 `tumor-heterogeneity` RESTRUCTURED, RE-SHIPPED AND
PUSHED (470c49e, 23 states, deploy green) — the record is the catalogue's § Slot
67 from *RESTRUCTURED TO THE NOTEBOOK'S ORDER* on.** Kenneth: the widget did not
help him teach 01-2 — CCF appeared before cell 17's VAF readings, and the tree
before the samples. Now four pages in the notebook's order: **One mutation**
(cell 17 only: purity 1.00 by default, the case control *The mutation is on* ·
1 of 2 · 2 of 2 · 1 of 1 · 1 of 4 copies, one kind of line in the cells, the
three readings labelled on the VAF scale, no CCF) · **Many mutations** (VAF
only) · **Cancer cell fraction** (new: page 1's sample and reads, cell 25 §3's
binomial likelihood per m, *Given*, *Clonal if* the whole 95% interval / the
best estimate is above a *Clonal threshold* 0.80–0.95; an All mutations view
with the fraction axis) · **Clonal architecture** (the tree BUILT from the
samples, Surgery then Recurrence 1–3, a press per sample with two beats where
the tree changes; the Tree and Samples used controls gone). Purity is one
parameter across pages 1–3; he links page 3 with `purity=0.70`.

**Worth knowing before the next widget:**

- **"Don't use fade for static transitions … only tween for movement."** His
  rule, applied repo-wide in this widget: appearing and disappearing things
  switch at once; only things that move are eased. The verify records every
  `globalAlpha` painted mid-transition and allows none that follow the clock.
- **Measure a control's effect before mocking it.** The threshold control he
  asked about barely changes a call; the RULE does (range vs best estimate).
  A threshold-only design would have taught the opposite.
- **A new rule in the struck-word sweep catches strings the scan missed** —
  it found two within seconds of being added. Add the audit's words to the
  verify in the same commit as the audit.
- **`_lab/tumor-heterogeneity-copy-sweep.html`** collects canvas and DOM
  strings; its canvas side needs the theme repaint on EVERY state.
- **The RETCHER paper** (PMC11483135) is readable through Europe PMC's API
  when OUP serves a bot check; P2 is a TNBC patient, "three recurrent samples
  and one surgical sample", no dates given.

**2026-09-26: 83 `attention` SHIPPED AND PUSHED (984afbf, 17 states, "Deep
Learning - Language: Attention"), the language arc's first and the gallery's
72nd card, after two days of review rounds — the record is the catalogue's
§ Slot 83.** Four steps under **Step**: **Projections** (X · Wᵀ = Q, K, V as a
matrix product, and one number of it as 48 products summed), **Weights** (the
sentence, qᵢ under the query and every kⱼ under its key, the attention_mask
row On · Off, scores key by key, the softmax, the α matrix with [PAD] on a
band), **Output** (zᵢ = Σⱼ αᵢⱼ vⱼ key by key, a **Query** pin by rail or click),
**Heads** (every head's Zₕ, the concatenation and W_O's output at their real
sizes). Every step has a hover inspector, picked from live mocks. The model is
the arc's trained tiny BERT, block 1, read in JS from `weights.js` (generated
by `_lab/attention-weights.py`); `_lab/attention-verify.mjs` holds it to torch
within 1.3e-6 and asserts every printed number (8344 checks).

**The things worth knowing before 84, in the order they cost time:**

- **Core validates `regions` at load, before `compute` has run** — `state` is
  null there. A region table that reads `state` throws and the widget does
  not render at all, while verify and check both pass (neither loads the
  page). Read sizes from `params` (`M.tokensOf(params.sentence).length`), or
  cache the last draw's geometry and return `[]` until there is one
  (`outRegions`). Load the page after touching `regions`.
- **Hover cannot be fingerprinted** — the harness clicks, it does not hover.
  Keep a hover's arithmetic in the verify (83 checks that the drawn slices
  reproduce q, k, v, and that the heads' parts add up to every output number).
  To see a hover in the browser pane, the pane must be painting: a hidden
  pane runs no frames, so a synthetic `pointermove` draws nothing and reads as
  a bug. A screenshot fronts it.
- **Determinism runs: front the pane BEFORE the reload.** A run that loads
  hidden hashes at DPR 1 (550 px wide, not 688) and reads DIFFER; discard it.
  And a state taller than about 1,000 px can tip the page scrollbar and hash
  669 or 688 wide run to run — 83's Heads on the 11-token sentence did; keep
  states at 963 px or less.
- **`check`: a driven or hit state may not set `shown=`** (nothing would be in
  flight). Reach its rows with `before: [{ click: "step", frames: 200 }]` —
  `before` stops when the press ends, so a generous count is safe.
- **`switch-probe.html` gained `at=`** (dfcbe14): it only ever opened a widget
  at its defaults, so a control shown on one step was never probed.
  `?only=attention&at=page%3Doutput%26shown%3D3`.
- **`--c-highlight` and `--c-magnitude` are one violet** and never share a
  page: 83's Weights and Heads steps wear the magnitude ramp, so their marks
  are the query's `--c-group-a`; Projections, with no ramp, uses the highlight.
- **The manifest blurb cap is 120 characters** (`check`), not a guideline.
- **A bulk rename reaches dated history.** Replacing `passed` → `on` across
  files rewrote two lines of the catalogue's dated round records; restored.
  Rename in code and live copy; leave dated records in the names of their day.
- **Copy, his standing notes this time:** token, not word, when the widget says
  token; the intuition before the mechanism; say why several heads; no worked
  example and no arithmetic in the subtitle; a subtitle's drafts go through the
  struck-word sweep AND the banlist before he sees them — and confirm the pane
  is on the banlist page when you scan (one scan ran against the widget page
  and "passed" on zero terms).

**SEVENTY-THREE WIDGETS IN THE MANIFEST — 72 on the gallery and `roc-auc`
UNLISTED.** NEXT: 84 `transformer`, measure then mock (§ *The language arc*;
the causal mask belongs on its Decoder page). Untracked and safe to leave, as
before: `_lab/cell-markers-umap-*.json`, `_lab/rnaseq-sc-qc.json`, two
`_lab/figs/sc-markers-*` figures, 65's `unet-lookup-test/`. **SESSION CLOSED.**

**2026-09-25: 81 `cell-markers` SHIPPED AND PUSHED (3ae2857, 35 states,
"Single-Cell RNA-seq: Clustering and Differential Expression"), the RNA-seq
arc's last and the gallery's 71st card, after some thirty review rounds in
one day — the record is the catalogue's § Slot 81.** Five analyses under a
control called **Analysis**, named in the field's terms: Clustering
(FindNeighbors and FindClusters stepped through in six tweened presses on 45
cells), Annotation, Marker genes (FindMarkers with pct.1 against pct.2),
Differential expression (cell-level against pseudobulk, one column per test,
a Venn against the simulated truth), Differential abundance.

**Three core changes went up with it, and they reach every widget:**

- **Reset (26766b5).** Reset is on every widget again, animated or not
  (7bf14df had taken it off the two with no animation, the same morning).
  It keeps the field marked **`role: "page"`**, returns the controls ON
  SCREEN to the values the link opened with (`opened`, resolved at load),
  leaves other pages' controls alone, and sends a hidden non-slot field
  such as `shown` to its default. Gates still close. It now rebuilds the
  control block, which closed the old gap where gated controls stayed in
  the rail after Reset. **A new widget with pages declares `role: "page"`
  on its page control** — 38 do; the list came from a stub-import of every
  config, because no derived rule finds them (cell-qc's page gates nothing;
  gradients' tab is not `display`). One state moved:
  mendelian-randomization's Play → Reset → Step, whose old hashes had
  recorded Reset leaving for Overview.
- **Links (21a126c).** `toQuery` leaves out a value that is only the first
  option standing in for an absent default — `within=4` had appeared on
  every page of 81.
- **The drive row (7bf14df)** hid itself when empty; with Reset everywhere
  that line was removed again in 26766b5.

**The things worth knowing before the next widget, in the order they cost
time:**

- **Taking the Draft banner off can move a baseline.** The banner is about
  50 px; without it 81's Marker genes page fits the harness's 1,200 px frame
  with 7 px to spare, the scrollbar goes, the canvas widens 532 → 547, and
  five states DIFFER on px alone. **Mark a widget shipped BEFORE its three
  determinism runs**, or run them again after. A line added to that page's
  rail brings the scrollbar back.
- **A hit at a target's edge can pass in a test iframe and miss in the
  harness.** Choose a hit point with 3 px of region on every side (scan the
  cursor, keep points whose neighbours are all `pointer`).
- **`check` wants `shown=` on every settled state** of a widget that
  declares `shown`, even on pages where `shown` does nothing.
- **Apply a pick exactly as worded.** p_val was dropped at every width when
  the pick said narrow widths only, and he caught it.
- **Notebook findings told to him (02-4):** the lesson does no pseudobulk
  (he has R code for it); cell 10's `ct_markers` omits DLK1; cell 4 says SNN
  keeps only mutual neighbours, where Seurat links every pair by Jaccard and
  prunes below 1/15.

**SEVENTY-TWO WIDGETS IN THE MANIFEST — 71 on the gallery and `roc-auc`
UNLISTED.** The RNA-seq arc (77–81) is COMPLETE. NEXT: his call. Untracked
and safe to leave: `_lab/cell-markers-umap-*.json` (regenerate with the
verify's `--export`), `_lab/rnaseq-sc-qc.json`, two `_lab/figs/sc-markers-*`
figures, and 65's `unet-lookup-test/`. **SESSION CLOSED.**

**2026-09-24 (later the same day): 80 `integration` SHIPPED ("Single-Cell
RNA-seq: Integration", 10 states), planned, drafted, reviewed and shipped in
one session — the record is the catalogue's § Slot 80.** What it is: slot
79's four samples and six types in a plane, a patient shift, tumour cells in
the tumour samples only; two panels of the same cells coloured by the batch
variable (two inks) and by cell type; Step runs Find anchors → Correct.
The control is **Batch variable = Patient · Tissue**, not the method.

**The things worth knowing before 81, in the order they cost time:**

- **The arc's plan for 80 was wrong, and a measurement showed it.** Its
  "Harmony pulls a one-batch type in, 98%" came from a lab stand-in that
  corrected nothing at a realistic scale. Written as published, Harmony and
  FastMNN merged nothing on this stage; the merge is CCA's and follows the
  declared batch (tissue: 55–59% of anchors join two types). **Print a
  before/after distance before believing any method comparison** —
  `_lab/integration-measure.mjs` carries both corrected stand-ins.
- **Every teaching source leads with mutual nearest neighbours** (Seurat's
  vignette, Stuart 2019, OSCA, HBC); CCA gets one sentence. The widget
  centres each batch on its own mean as its shared space and says so in the
  Find anchors tooltip.
- **`--c-group-a/b` are `--c-cluster-a/b`'s hues.** A figure with a
  two-group variable beside six cell types cannot use both; this one put the
  batch in inks. 81 will meet the same clash (conditions beside clusters).
- **The claudisms banlist is at <https://claudisms.ai/claudisms.md>**;
  run it on the subtitle and blurb OPTIONS before asking, as with the house
  verb list — it caught "moves", "hold" and "carries" this round.

**SEVENTY-ONE WIDGETS IN THE MANIFEST — 70 on the gallery and `roc-auc`
UNLISTED.** NEXT: **81 `cell-markers`** ("Single-Cell RNA-seq: Clusters and
Markers", three pages Clusters · Markers · Conditions), the arc's last;
measure first (`_lab/rnaseq-measure.mjs` M4 and M6 hold the arc's numbers,
which were measured with the SAME kind of stand-ins that were wrong for 80 —
re-measure before relying on them). **SESSION CLOSED.**

**2026-09-24: 79 `cell-qc` SHIPPED AND PUSHED (7648e10, 24 states,
"Single-Cell RNA-seq: QC"), the third of the RNA-seq arc and the gallery's
SEVENTIETH widget, after eighteen review rounds over two days — the record is
the catalogue’s § Slot 79.** What it is: 1,600 simulated droplets, 400 a
sample across four samples (Patient 1 / Patient 2 × liver / tumour), each
holding one cell, a dying cell, two cells or no cell at all, drawn by
`widgets/cell-qc/engine.js` and FITTED to the lesson’s own 40,564 10x cells
rather than shaped to look right. Two pages. **Metrics**: four violins across
the top (genes detected, transcripts, mitochondrial %, doublet score), the two
scatters, and under a rule the neighbourhood panel and the three score rows.
**Thresholds**: the cell map, one bar a sample, and a curve of every
mitochondrial setting. Four sliders, and a droplet under the pointer is ringed
in both scatters, ticked in all four distributions and named in the panel.

**The things worth knowing before 80, in the order they cost time:**

- **THE FOURTH RULE IS SCORED ON THE TWO COUNT RULES, NOT ALL THREE**, and
  that is load-bearing, not a detail. It used to be scored on what the other
  three keep (DoubletFinder’s order), which made the score move with the
  mitochondrial threshold — so the curve on Thresholds could not apply the
  doublet rule at all and read four to five points above the bar beside it.
  He caught that ("i thought we were thresholding on all 4 criteria?").
  Rescoring at the sweep’s 57 points measures **1,838 ms** against 26 for one
  scoring, so it was never an option. What made it affordable is that the two
  tools disagree only about where the MITOCHONDRIAL filter goes and agree on
  the floor: scDblFinder’s FAQ asks for a coverage floor and puts further QC
  downstream. Scoring on the count floor costs nothing, measured — 63 of 63
  heterotypic doublets called at 0.6 against 47 of 49 before — and the verify
  asserts per sample that the curve equals the bar at the set rule.
- **A doublet of two cells of ONE type is invisible at every setting**, and
  the second score row exists to show it: median 0.32 against 0.28 for a
  droplet holding one cell. That is DoubletFinder’s homotypic-proportion
  adjustment conceded rather than solved, and it is the half of the method
  worth teaching.
- **The measurement struck the arc’s own cell-type claim.** CYP3A4 is
  detected in 91% of the cells the mt% rule removes AND 89% of those it
  keeps: the rule removes a SAMPLE, not a cell type. Four words of the
  subtitle carry that and should survive any future trim.
- **Six layouts were tried and the round-10 one won.** Three concept columns
  and three concept bands were both mocked to scale and both BUILT once
  (a6dc8f4) and reverted on his word (5cbbd42) — “ok it looks more
  confusing..sigh”. The reusable part is the measurement, not the layouts:
  **a violin panel needs 174px before its two lines of sample name collide**,
  which is a FIGURE floor, so a third of a 534px canvas can never hold one.
  A scatter needs 194 for its caption, the neighbourhood panel 163 for its
  key, the three score rows 236 for their axis label. Both mocks are kept:
  `_lab/cell-qc-group-mock.html` and `_lab/cell-qc-bands-mock.html`.
- **A scatter needs a 56px left gutter and a violin does not** " its y-axis
  carries a rotated label as well as ticks, and at the 22px panel gap that
  label printed through the sample names beside it.
- **`--grid` is invisible across a full-width rule.** A hairline gridline is
  #e1e0d9 on #fcfcfb: it reads inside a 160px panel and vanishes across 678
  of them. The two band rules are `--ink-3`, the grey the axis labels and
  ticks already use.
- **The overlap sweep cannot see text over a GRAPH.** Two marks printed over
  the sweep’s gridline and curves and all 31 states passed throughout. It
  did catch what followed — a note dropped inside the panel onto the rule’s
  own number at 534px.
- **`\bstep\b` is struck in this widget’s copy check** (nothing is driven by
  presses since round 2), which caught "every step after it" in the subtitle.
  "all downstream analysis" is the field's word anyway.

**Two new lab pages, both reusable on the next widget.**
`_lab/cell-qc-copy-sweep.html` collects every reader-facing string, canvas AND
DOM — the fillText recipe alone sees only the canvas, and the rail, readout
and legend hold most of a widget’s copy; adapt its STATES and path. And
`_lab/cell-qc-layout-mock.html` carries the diagnosis of a CORE bug fixed this
session (bfc7708): `.w-stat-break` was `grid-column: 1 / -1`, which defeats
`auto-fit`'s track collapse, so four readout tiles sat in six live 114px
columns with half the width blank. It is a class on the tile AFTER the break
now, `grid-column-start: 1` — two tracks of 367px. Four other widgets use a
break (enrichment, gwas, metrics, naive-bayes) and it widens theirs the same
way; the full suite ran **1045/1045 identical** after that change.

**He asked for claudisms.ai this session** (<https://claudisms.ai>, banlist at
`/claudisms.md`, ~290 terms extracted from the bold lead of each bullet), and
it is a standing step in a copy audit from here. It matched **0 of 290** on
both passes. Its one rule this project does NOT take is the em-dash ban: house
style across seventy widgets, and changing one makes that one the odd one out.
Everything a copy audit found came from the project’s own register rules, not
from the list.

**SEVENTY WIDGETS IN THE MANIFEST — 69 on the gallery and `roc-auc`
UNLISTED; no draft on `main`** (`wgcna` is still a draft on its own branch and
worktree, another session's). The live site is
<https://nusmedicine.github.io/statml/>, deployed from `main`: the latest
widget ship is `7648e10` (79 `cell-qc`, 2026-09-24), and this handover’s
commit follows it. NEXT: **80 `integration`**, the second of the three
single-cell widgets — and slot 79 left it a stage to build on: the
per-sample-versus-pooled doublet measurement showed pooling costs nothing
HERE only because every sample holds the same six populations, and **the rule
bites when a population sits in one sample and not another, which is exactly
80's subject**. Measure first, as always; the catalogue’s § *The RNA-seq arc*
has the plan and his picks. **SESSION CLOSED.**

**2026-09-23: 78 `deseq2` SHIPPED AND PUSHED (bc2f534, 20 states, "Bulk
RNA-seq: Differential Expression"), the second of the RNA-seq arc, after
fifteen review rounds in two days — the record is the catalogue's § Slot 78.**
What it is: one simulated stage (1,200 genes, a tenth changed, the reader's
replicates, seed and — since round 11 — the simulation's dispersion α)
analysed by the widget's own engine (`widgets/deseq2/engine.js`: Cox–Reid
gene-wise MLE, parametric trend, prior width by trigamma, MAP with the outlier
rule, GLM, Wald, BH, a spike-and-normal LFC prior, the closed-form vst), read
on four pages in the vignette's order: Distribution (one gene's Poisson and NB
at a mean and α, hover any of the 1,200 to draw it), Shrinkage (three presses:
likelihood → trend as the prior → posterior; hover any of sixty), Fit and test
(four presses: Test → Fit the prior → Multiply by the prior → Shrink every
gene, with the three curves over β beside the one gene's fit and the MA plot
before and after; hover the MA plot), Transform (SD of the values against the
mean, the transform curve, and the clustered heatmap of the 30 most variable
genes with the truth as a tick and the group as a band). Things worth knowing
before 79: the PCA of the samples was built (round 8) and REPLACED by the
heatmap (round 11) on his word, because the heatmap carries the truth on the
figure and the tick count is the transform's worth in one number; the
notebook's sample-correlation heatmap separates the groups in NO unit and is
not here; his "two contradictory SDs" (round 10) was two spreads sharing one
word — the spread of an ESTIMATE (shrink) and of the VALUES (transform) — and
the copy keeps them apart; the subtitle and blurb are in the field's
methods-section register at his ask (round 14: "conventional scientific
language, not folksy"), which on a methods widget IS the plain register; a
`check` failure once went into a commit behind a piped `tail` (round 14) — run
`npm run check` alone and read it. A driven fingerprint state may not also
set `shown=`: later stages are reached with `before` lists of completed
presses (16 frames at 50 ms for a 700 ms press). NEXT: 79 `cell-qc`
("Single-Cell RNA-seq: QC"), the first of the three Seurat widgets — measure
first (`_lab/rnaseq-sc-data.mjs` and `_lab/rnaseq-sc-qc.json` hold the 10x
numbers: 40,564 → 31,014 cells, the mt% rule removes 85% of one sample), mock,
build; the catalogue's § *The RNA-seq arc* has the plan and his picks.

**SIXTY-NINE WIDGETS IN THE MANIFEST — 68 on the gallery and `roc-auc`
UNLISTED; no draft on `main`** (`wgcna` is still a draft on its own branch
and worktree, another session's). The live site is
<https://nusmedicine.github.io/statml/>, deployed from `main`: the latest
widget ship is `bc2f534` (78 `deseq2`, 2026-09-23, pushed with the fifteen
review-round commits behind it; that push's run was cancelled by the handover
push, as Pages does, and the handover's run 35823430155 completed green — the
live manifest read back with 69 widgets and deseq2 shipped), and this
handover's commit follows it. **SESSION CLOSED.**

**2026-09-22: 77 `count-normalization` SHIPPED AND PUSHED (ab66e5c, 14
states, "Bulk RNA-seq: Normalization"), the first of the RNA-seq arc, after
seventeen review rounds in two days — the record is the catalogue's § Slot 77.**
What it is: one data set, six genes in two samples, read three ways — piles of
reads, the genes × samples table (within = a column, between = a row, hover
reads any gene both ways, every ratio with its log2), and a slope chart of the
same six — under the reader's choice of depth, gene lengths, WHICH gene rises
8× (None or 1–6) and six units; the size-factor walkthrough behind a gate. Two
CORE roles were added for it (905da4e, `--c-between` / `--c-within`; the full
suite ran 1,011/1,011 before that commit). Two things were built and CUT on his
word and are worth knowing before 78: a majority-change state (the size
factor's own limit — correct, and it read as a broken widget; "most RNA-seq
analysis relies on most genes not changing; go back to the basics") and a
2,000-gene simulated panel under the six-gene table (histogram → boxes →
histogram → gone: it could only show between, and its genes were not the
table's; the sources all teach on a table's worth of genes). His personification
catch on the subtitle at round 17 is in memory: grep the OPTIONS before
offering them. NEXT: 78 `deseq2` ("Bulk RNA-seq: Differential Expression"),
four pages in the notebook's order Model · Dispersion · Transform · Test —
measure first (`_lab/rnaseq-measure.mjs` has the corrected stand-ins), mock,
build; ask before showing the median-of-ratios limit past half the genes at
all.

**SIXTY-SEVEN WIDGETS IN THE MANIFEST — 66 on the gallery and `roc-auc` UNLISTED; no draft on `main`** (`wgcna` is still a draft on its own branch and worktree, another session's). The live site is <https://nusmedicine.github.io/statml/>, deployed from `main`: the latest widget ship is `9f9c873` (74 `sequence-encoding`, 2026-09-21, pushed with the twenty-two commits of its planning and eleven review rounds; 72's retitle `1c814cc` pushed after it as `6ba5a7d`; the first deploy run was cancelled by the second push, as Pages does, and the second, 35578748128, completed green — the live manifest read back with 67 widgets and both titles), and this handover's commit follows it. **SESSION CLOSED.**

**2026-09-21 evening, ask to plan: the RNA-seq arc from PHM5003 08, PROPOSED
and awaiting his picks.** His ask named three confusions (FPKM/TPM and why
some units cannot compare conditions; DESeq2's size factors, dispersion
shrinkage, NB and vst; Seurat's integration and markers). All eight notebooks
read with their outputs; the lesson's own `results_DESeq2.tsv` and four 10x
matrices read for numbers (`_lab/rnaseq-sc-data.mjs` reproduces 40,564 →
31,014 exactly and finds the mt% rule removes 85% of one sample); every
candidate claim measured in `_lab/rnaseq-measure.mjs` (two stand-ins were
wrong first — the gene-wise MLE without Cox–Reid, a one-normal LFC prior —
and the script's comments record both). Six slots 77–82 in the catalogue's
§ *The RNA-seq arc*, mocked in `_lab/rnaseq-arc-mock.html` with every figure
computed on the page; recommended five with 82 folded into 81. Seven calls
put in the mock's § 7 and by AskUserQuestion, **all seven answered the same
evening, every one the recommendation** (five widgets 77–81 with 82 folded
into 81; the lessons' order; the size factor on 77's last page; 78 four
pages in the notebook's order, Model · Dispersion · Transform · Test (his
question: vst sits between the fit and the results in 01-2); simulated stage; MNN against Harmony on 80; names kept) — the table is
under the catalogue's § *The open calls*. Five findings about the lessons'
own output under § *What the lessons' own output says*. Nothing built. NEXT:
77 `count-normalization` — measure its own failing case (the median of ratios
past half the genes changing), mock, then build.

**2026-09-20 evening to 2026-09-21, one session, ask to plan then to build then to ship: 72 `signal-windows`.** His ask — *read handover and let's plan the next widget* — became § *72* in the catalogue's arc section (after 75's record): 07-2 cells 1–21 read again in full, the widget's own stage measured (`_lab/signal-windows-measure.mjs`, 129 s: the rhythm class is the leak whole, 59 → 87% by window as the overlap rises and chance by subject at every window length from 1 to 8 s; ectopic beats as the class do not leak; correlation at the best shift finds the same subject for 86% of held-out windows; amplitude is not a leak; 73's CNN trains in 0.65 s but moves with the seed), mocked with every number computed on the page (`_lab/signal-windows-mock.html`), and picked in two `AskUserQuestion` calls, every one the recommendation. **Then his ask for the cleaning steps too** — resample, filter, detrend, cell 4 §1, which the catalogue had down as *not a page* — mocked the same way (decimation, second-order sections run forward and backward, a periodised db4 beside a moving average and a polynomial; the lesson's band-pass measured to remove the drift by itself, so the filter is a notch and a low-pass and the drift is Detrend's; A_8 leaves 2% of a 0.25 Hz drift, A_9 18%, A_10 79%) and picked in two more calls: **a first page, Clean, so the widget is four pages in the notebook's order.** Drafted on "start the draft" (`be20dd3`; the wavelet's ramp read live from the array the loop was rewriting, so A_j drifted along the record — the ends are read once now), round 1 from his screenshot (one overlap he saw, one the text sweep found), the copy audit as fifteen rows **all applied on his word** (deal and deck struck for split and Hold out; sit and lie; URL values as control words; the letters 1 / 0; the sweep in the verify extended), subtitle A and blurb B1 his picks, both starting from the signal, and **SHIPPED AND PUSHED on "tested ok, do the states and ship it"**: status flipped first, 33 states identical across three filtered runs and MATCH on a fourth, `check` and `test` (33 scripts) run alone and green, the full suite 995 / 995 fronted at DPR 1.25, twelve commits pushed at once, deploy green. **A notebook issue told:** cell 13 splits the fragments at random while PhysioNet's fragments come several to a record, so the lesson's own split is window-level two cells after cell 5 warns against it.

**What 72 is, in one paragraph.** Eight subjects' 20 s recordings at 360 Hz, each in a morphology of their own, carrying both annotations of his figure — the rhythm as a recording annotation, each ectopic beat as an event — with line noise and a drifting baseline added by a Noise control. *Clean*: Step runs Resample (every M-th sample, a one-second zoom sample by sample) → Filter (Notch and Low-pass as sections run forward and backward, the power before and after as an inset; at 90 Hz the 50 Hz line has folded to 40 and the figure says no notch at 50 exists there) → Detrend (moving average, polynomial or wavelet A_j, the trend over the filtered trace and the cleaned trace under it); the cleaning controls are data, so the other pages window the cleaned recording. *Window*: the cleaned recording with the live annotation drawn on it, windows cut one a press into two staggered rows with their label, 1 / 0 under the recording arm and A / N under the event arm. *Split*: the windows one row a subject; press 1 holds out by window (a random fifth) or by subject (one of each class); each press after scores one held-out window by its nearest training window, correlation at the best shift, drawn over it with whose it is; a click on a held-out window picks the one drawn; both accuracies print. *Normalize*: one press moves every window's amplitude to sd 1, beside the `[N, C, L]` print. Nothing trains.

**Then, the same session: slot 74 re-examined and replaced.** His question — *what is sequence-encoding? I thought we did that in sequence-cnn-lstm already … or it needs a separate widget, e.g. embedding and vector spaces* — read against the collection: tokens, PAD, one-hot against embedding and the transpose are on 75's input panel, so the planned `sequence-encoding` was a strip already absorbed. What no widget shows is 07-1 cell 3's *Vector space* panel. **Measured** (`_lab/embedding-space-measure.mjs`, 11 s, `8d26a39`): an embedding trained on a role task puts same-role amino acids together (purity 35% → 100%, moving with the accuracy epoch by epoch), synonymous codons of the motif's amino acids become neighbours while the other 43 stay at chance, one-hot reaches 100% too (the embedding buys parameters and the geometry, not accuracy), E = 2 and 4 do not learn so the picture is a projection, and at E = 8 with 40 epochs the clusters survive the projection to 2-D (85–95%) in 0.8 s. **His call: build it.** The catalogue's § *Slot 74 · embedding-space* has the measurement and the proposal.

**2026-09-21, one long session, ask to plan, then to draft, then to ship: 74 `sequence-encoding` — "Deep Learning - Sequences: Tokens to Vectors" — SHIPPED AND PUSHED; the sequence arc is COMPLETE.** Planned as `embedding-space` (the catalogue's § *Slot 74*: the projection's frame measured, positional encoding measured on a single attention head written for the lab, the mock overturning two lines of the proposal, fourteen picks), drafted on "start the draft", then **eleven review rounds from his screenshots in the same day**, one commit each, the catalogue's numbered list has every one: a Words page and a DNA page, every row named, a Position page on attention that was then **cut back to arithmetic** ("we're getting ahead of ourselves": Tokenize · Encode · Position, one step each, one-hot as the identity alone, x + p = x̃ with no attention and no training), <unk> and <pad> in every example, the sinusoid as curves and the rotation as the pair turned with a hover magnifier, a Values · Change table view (the rows move 0.5 an entry against a ±3 ramp, so the heatmap barely stirs while the space turns), the text-overlap sweep as a lab page (`_lab/text-overlap-sweep.html`), the fades cut, a sixteen-row copy audit, subtitle and blurb his picks after two redo rounds (position is added FOR attention, not by it), and the rename with the Step label. Shipped with sixteen states identical across three runs; the full suite read 995 MATCH at the engine move (`a25d71d`); `check` and `test` green.

**NEXT: his call.** Two things are on the table: (1) 72 `signal-windows` retitled **"Deep Learning - Signals: Raw to Windows"** on his pick from `_lab/signal-windows-title-mock.html` (the arc's four cards with five candidates), pushed on his "tested ok"; (2) the 08 language arc, for which the attention head now in `signal-cnn-lstm/engine.js` (measured in `_lab/positional-encoding-measure.mjs`) is the first piece — nothing planned yet.

**The session before, 2026-09-20, ask to ship: the sequence arc planned and its first widget shipped.** His ask — *plan the next set of widgets to support PHM5005 Deep Learning for Sequences; scrap training-loop and somatic-interactions* — became the catalogue's § *The sequence arc* (PHM5005 `07-1` to `07-3`): the three notebooks read in full, two facts fetched rather than assumed (PhysioNet's fragments are 2 s at **360 Hz**; every one of the lesson's 100,000 DNA sequences is exactly 200 bp), a measure script with a gradient-checked conv1d, tanh RNN and LSTM (`_lab/dl-seq-measure.mjs`, 106 s), his fourteen figures in `_lab/figs/dl-sequential-*.png`, and an arc mock (`_lab/seq-arc-mock.html`). **Two claims the measurement ruled out before anything was drawn:** an H = 16 tanh RNN recalled an early token as far as an LSTM, so no widget compares the cells; and the lesson's pooling table (last for endpoints, mean for trend, max for events) reproduced only its max row. **His picks, three rounds:** group **by data type, two widgets each** — 72 `signal-windows`, 73 `signal-cnn-lstm`, 74 `sequence-encoding`, 75 `sequence-models` — 73 first, build order 73 → 72 → 75 → 74; slot 71 `somatic-interactions` **CUT**, slot 52 already discarded. Then 73 measured (`_lab/signal-cnn-lstm-measure.mjs`), mocked (`_lab/signal-cnn-lstm-mock.html`, eight picks, every recommendation but the slug — his is `signal-cnn-lstm`, "Deep Learning - Signals: CNN and LSTM"), drafted, reviewed in five looks the same afternoon, audited, recorded (thirty states, the shooter's copy proof 7 / 7, every state stable across three shots and reproduced on a second pass, the switch probe 15 / 0) and **SHIPPED AND PUSHED** as `c5aabad` (the plan) and `fbe62c2` (the widget) on his "tested ok, push it to gallery". The catalogue section under 73 has every round.

**What 73 is, in one paragraph.** Four pages on a 2 s ECG fragment, sinus rhythm with 0 · 1 · 2 · 3 planted wide ectopic beats (the classes named by what they are, never the lesson's OK / Dangerous): the lesson's `CNN1D` **trained in `compute()`** at half width in about 1.3 s (the kernel slid on the trace's own axis, a band showing window ⊙ weights summed, the stack and one output's 25-sample = 69 ms reach, the loss curve), an **LSTM trained in the browser** at H = 8 on the raw 720 samples (1.6 s; the block drawn as h→ / h← halves, the reduction it reads framed, a running prediction along the fragment: the whole model asked on every prefix), a **CNN + LSTM** trained on the first page's convolutions (under a second, 100%; its running prediction jumps to 0.98 on the beat), and **occlusion of any of the three** window by window. Reduce is a DATA control because the head is trained on the summary — with the last states the raw LSTM stays near chance in the budget that reaches 100% with max, the lesson's own table shown for real. Every trained model is cached by its data parameters so a page switch does not retrain.

**2026-09-20 evening, the same session continued, ask to ship: 75 `sequence-cnn-lstm` reviewed and shipped.** Thirteen review rounds from his screenshots (the catalogue's § *75* has each): the input panel rebuilt around his picks (letters with the motif in `--c-theory`, the lookup table, the window's k tokens as rows, the transpose, the 250 overview; hover and click through core `pointer` and `regions`), the one-token window following the recurrence, a Play speed, the occluded window on the plot, the combo page's kernel slide with three synced marks, the Page control as two rows (on 73 too), the attribution axis floored at 0.05 with the flat map said on the figure (on composition every window moves a saturated p by under 0.001 — measured, all three models). Then the copy audit (twenty strings; no model "asked"), subtitle and blurb in three draft rounds — his rules: **no "X reaches a network" (personification), the subtitle in the PIPELINE ORDER (sequence → symbols → tokens → one-hot or embedding → CNN/LSTM → occlusion), generalised to any biological sequence** — and the ship on "tested ok, do the states and ship": probe 18/0, 42 states identical across three runs, 73's thirty MATCH, `77fd1d7`. **Two things the ship found are under *Things learned* below: the engine's shuffle order had moved 73, and the shooter's proof no longer reproduces the harness, so `fingerprint.html` has `?only=` now.**

*(That session's NEXT was 72 `signal-windows`; it shipped in the session above.)*

> **Compacted four times.** On 2026-09-16 from 3,528 lines ([docs/archive/HANDOVER-2026-09-16.md](docs/archive/HANDOVER-2026-09-16.md): every per-widget session record for widgets 22 to 65), on 2026-09-17 from 1,651 ([docs/archive/HANDOVER-2026-09-17.md](docs/archive/HANDOVER-2026-09-17.md)) and again that day to 1,433 ([docs/archive/HANDOVER-2026-09-17b.md](docs/archive/HANDOVER-2026-09-17b.md)), and on 2026-09-20 from 1,481 ([docs/archive/HANDOVER-2026-09-20.md](docs/archive/HANDOVER-2026-09-20.md): the per-slot session records for 62, 67, 69 and 70, which the catalogue holds, and the *Things learned* subsections for widgets 22 to 55, whose promoted rules are in the principles). Each archive is byte-identical to HANDOVER.md as it stood.

## Open across the collection, none blocking

- **The shooters' copy proof has drifted from the harness** (2026-09-20, at 75's ship; *Working on this machine* has the numbers). `fingerprint.html?only=` covers what they were for. Re-deriving one shooter from the harness's current functions, or deleting the twenty-nine copies, is a cleanup for a quiet session.
- **Harmony for widget 80 is PARKED (2026-09-25, his word: it did not look nice).** Measured and mocked in `_lab/integration-harmony*` (e4e788b): on the shipped stage Harmony merges types even under Patient, so a revival needs the patient shift at 0.5; the look — pies per soft cluster, arrows to cluster centres — is what to rethink. The shipped anchors are unchanged.
- **Widget 75 `sequence-cnn-lstm`'s 208 networks are a generated file**, like 65's: after any change to `widgets/sequence-cnn-lstm/model.js` or the shared `widgets/signal-cnn-lstm/engine.js`, run `node widgets/_lab/sequence-cnn-lstm-table.mjs`, or its verify's retrain-and-compare fails. And a change to that engine reaches 73, which trains in the browser: run both widgets' states.
- **Widget 65 `unet`'s six networks are a generated file.** After any change to `widgets/unet/engine.js`, run `node widgets/_lab/unet-table.mjs`, or its verify's retrain-and-compare fails. Its link words (`topic=dice`, `truth`, `prediction`, `predictionsize`, `across`, `down`) are public.
- **`widgets/_lab/unet-lookup-test/*.json`** (eight files, 1.7 MB, untracked) is 65's lookup test's raw output; its summary is committed and the rest can be deleted.
- **`git stash list` holds two widget-13 drafts** (the decision-tree and k-NN versions of `overfitting`), found in the 2026-09-05 cleanup and still there on 2026-09-17. His to drop.
- **The deploy prints a Node.js 20 deprecation annotation** for `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4` and `actions/deploy-pages@v4`. GitHub forces them onto Node 24 and the run is green; newer action versions are the fix if that stops working.
- **The 2026-09-05 cleanup review's nine unapplied findings wait for his picks:** the same one-liners (`clamp01`, `lerp`, eases) in many widgets, one name for two easing curves, sixteen per-widget text helpers, `gauss` declared five times and not `rng.normal()`, seven engines still in `main.js` (t-sne's twice), a 3D stage copied across mds, pca, t-sne and umap, a display change re-running `compute()`, `_lab/` with no index, and three spelling outliers. The review called each a core change earning a full suite run; the archive's § *THE CLEANUP PASS* has each with its cost.
- **Most lessons do not link to their widgets yet, and no widget from 11 on except 25 has been judged projected.** Both are Kenneth's, both old.
- Kenneth's notebook edits, and the open items recorded per widget, are in their own sections below.

## How a widget goes, from ask to ship

The order has run on every widget since 49, unchanged through 67:

1. **Read the lesson first.** The Master notebook and its figures are the spec (*Reading the PHM5005 notebooks* below); plan in the catalogue under the slot.
2. **Measure** in `_lab/<slug>-measure.mjs`, and against the library itself where it is installed (torch, MONAI, scikit-learn). Quote no library message or number without running it.
3. **Mock** in `_lab/<slug>-mock.html` from the newest mock's shell, and read every section in the browser before he sees it.
4. **His picks by `AskUserQuestion`**, up to four a call, the recommendation first and marked. Record them in the catalogue and commit.
5. **Draft** at manifest status `draft`, so it sits at `/lab/` only, with `_lab/<slug>-verify.mjs` registered in `scripts/verify.mjs`. A draft owes no real fingerprint states; placeholders `"px": "0", "tx": "0"` are allowed meanwhile.
6. **Rounds** from his screenshots and comments, answered by number: small fixes (under about 20 lines, no design) in the main session, designs mocked first. Commit each round locally; push only on his word.
7. **The copy audit** as one table, then his picks: register and lesson references; the collection's own vocabulary; outcome commentary; personification and mannerisms; URL values as copy. Put a sweep for the struck words into the verify.
8. **On "tested ok" and his word to push:** the status flip FIRST — in the manifest AND `main.js`, and in any verify that asserts it — because the draft banner adds about 44px and a state recorded under it can hash on a scrolled page the shipped one never shows (widget 69, 2026-09-18) → the shooter (copy the newest `_lab/*-shoot.html` and change its slug filter) → the states (settled, pinning `shown=` if the widget declares it; at least one driven if it animates; a hit state if it declares `regions`; an interrupted state for each display control that re-targets the step, a page or a tumor, probed first with `_lab/switch-probe.html?only=<slug>`, which asks every display control the question with no knowledge of the widget — widget 70, 2026-09-19, and the sweep of 2026-09-20 that found seven more) (a blurb edited on the way goes to the page's meta description too, which `check` compares) → the full suite, fronted and visible at DPR 1.25 → `npm run check` and `npm test` each run alone and read → commit, one file at a time → push → `gh run list --limit 1` and the live manifest → the catalogue's SHIPPED note → this file.

**Closing a session** ("write handover and close this session"): the work committed and pushed, the catalogue brought level, this file's top rewritten naming the commit it follows, the memory updated, and SESSION CLOSED at the top.

## Working on this machine

Consolidated on 2026-09-16 from the session notes it replaces; *Working on Windows* below keeps the history and the diagnoses.

- **Dev server:** `node scripts/serve.mjs <port>`. Never `npm run dev` (a WSL Docker container holds :8000) and never `PORT=`. `.claude/launch.json` has `widgets` on 8010 and `widgets-alt` to `widgets-alt4` on 8011–8014; other chats' servers usually hold some of them, and `preview_start` refuses a taken port, so take the next free lane (2026-09-17's second close stopped its own server on 8011 and left only 8010 held, by the first session's). `netstat -ano | grep LISTENING | grep ':801'` says which are taken. A server another chat started on this tree serves the same files with `no-store`, so navigating to it works.
- **After every push, read `gh run list --limit 1` and curl the live manifest.** A verify that passed here failed on GitHub's runner for a day (a 150 ms gate in `prs-verify.mjs`, 2026-09-12), and every deploy failed with it. Never gate a verify on the clock.
- **Git on Dropbox:** `git add` one file at a time in a retry loop, and commit with `git -c gc.auto=0 commit`. `unable to write file .git/objects/…: Permission denied` is Dropbox indexing each object as git writes it, never permissions; the automatic repack fails on Dropbox's lock and leaves a `.tmp-*` file in `.git/objects/pack/`. An add that reports `Permission denied` can still have landed, so read `git status` before retrying blind.
- **Write scripts and patches to the scratchpad with the Write tool**, then run them: heredocs and `node -e` in the Bash tool mangle backslashes and quotes. **Line endings:** `.gitattributes` pins LF, and 502 tracked files are LF against 37 CRLF. Python's `open(p, "w")` writes CRLF on Windows, so open with `newline="\n"` or use the Edit tool, and check with `tr -cd '\r' < file | wc -c`.
- **The harness and every shooter need the pane displayed, the tab active and the document visible.** DPR reads 1.25 only then: a run with the pane hidden reads DPR 1 and every `px` DIFFERs, and a run with the document hidden at DPR 1.25 still gave 27 false `px` DIFFERs (2026-09-13). Close other tabs, `tabs_select` the harness, and read `devicePixelRatio` and `document.visibilityState` on every poll; discard a run that was hidden at any point. A poll only samples, so **install a `visibilitychange` listener on the harness page right after load** that logs the row count at each change: on 2026-09-17 two runs went hidden between polls (false `px` DIFFERs in `cnn-architecture` and `naive-bayes`), and the third, logged, showed no change from its fourth row to its last. `javascript_tool` caps at 45 s, so poll in waits of 38 s or less. The suite auto-runs; never click Run.
- **The harness frame is 900 × 1200.** A side-layout canvas is 550 CSS px wide there, 535 when the page is tall enough for a scrollbar, so aim hit coordinates at targets that hold at both. `check` refuses a driven state that also pins `shown=`; reach a finished figure through `before: [{ click: "run", frames: N }]`. The frame clock is 32 ms, so a driven state needs enough frames to pass a beat (14 frames is 448 ms). A hit state that "clears" a pin is inert, since the pointer still hovers the target; record pins.
- **Recording states: `fingerprint.html?only=<slug>[,<slug>]` since 2026-09-20 (27ea756).** A widget's forty states run in about two minutes, three runs prove determinism, and "Copy new baseline" under the filter splices the run into the baseline in place; read `latest` off the page by overriding `navigator.clipboard.writeText` before clicking Copy. **The shooter's copy proof no longer reproduces the harness** (75's ship: seven of seven proof states DIFFER px-only, deterministic, at DPR 1.25 and visible, in a pane where the harness MATCHes the same states — and its `want` hashes are not the baseline's either), so until someone re-derives a shooter from the harness and proves it, do not record from one. What follows is how the shooters worked until then: copy the newest `_lab/*-shoot.html` (now `mutational-signatures-shoot.html`, copied 2026-09-19 from `driver-genes-shoot.html`, which was built from the current harness functions, and counting every moment the document was hidden; an older copy can predate a branch of `setParam` and hash a state the drive never reached). It proves the copy against known states first, shoots each state three times, and checks every driven state against its settled sibling. **Re-recording a shipped widget,** give each state the change cannot reach its recorded hashes instead of `"0"`: the newest copy reports whether each one reproduced. Two traps: it reads `$note` unguarded and some states have none, so guard it (`$note ?? ""`); and its output is written only at the end, so an empty page mid-run is normal.
- **The scrollbar flake:** a `px`-only DIFFER on a tall page, `tx` matching and the row hashed at 688 where the baseline holds 669, is the scrollbar until that widget's shooter run alone says otherwise. Do not rebaseline it. A DIFFER on BOTH hashes with identical hashes across runs is something else (t-sne, 2026-09-10: proven environmental by running the harness on the last all-green commit from a detached worktree). And a ship claim that reads "all N of the new widget's states MATCH" is not a full-suite claim; read the DIFFER count.
- **Screenshots come back black once the page is scrolled:** shift `document.body.style.marginTop` instead of scrolling. The pane's screenshot is 800 px wide. Trust DOM reads over screenshots; under `resize_window`, clicks by `ref` can land off target, while DOM `.click()` and dispatched PointerEvents are reliable.
- **Python:** `python` is 3.12 at `%LOCALAPPDATA%\Programs\Python\Python312`, with numpy 2.5.2, scikit-learn 1.9.0, Pillow 12.3.0, torch 2.14.0+cpu and MONAI 1.6.0. Two of three torch error strings quoted from memory were wrong (2026-09-11). **A blocked network call is a question for Kenneth** (SimpleWall prompts), not a constraint to build around.
- **Subagents** (the block from 49 below has the cost): name geometry in a brief, not topology, and say so when a pick needs core. Commit before every subagent round; one ran `git checkout` on the baseline file and lost uncommitted states.

## Things learned, not yet in the principles

- **A text-overlap sweep is one wrap away from the text-string sweep (widget 72, 2026-09-20).** Wrap `fillText` to record each string's box — `measureText` for the width, the alignment for the left edge, the font's px for the height — then report pairs whose boxes intersect and strings past the canvas edge. It found the collision his screenshot showed and one he had not seen (a print 60 px off the right edge). **Parse the size as `/(\d+)px/`, not `parseFloat(font)`:** a bold caption's font string starts with its weight, and `parseFloat("600 13px …")` is 600, which gave every caption a 600 px box and reported everything as overlapping. To repaint under the wrap, toggle the theme button twice; a resize event does not redraw.
- **The harness's `latest` is module-scoped, so a script cannot read it (2026-09-21).** Read the table instead: each row's fifth cell holds the run's `px<br>tx`, its first cell the verdict, and `tr.dataset.size` the canvas it was hashed at. Three filtered runs compared that way proved 72's states identical before the hashes were written into the baseline by hand; then a fourth run read MATCH.

### From 74 `sequence-encoding` (2026-09-21)

- **Eleven review rounds in a day, and three of them took things OUT.** The draft trained an attention head on an order task for its Position page; his "we're getting ahead of ourselves" cut it to arithmetic — x + p = x̃ on the tokenised sequence — and the widget got clearer each time something stopped training. A page that shows a mechanism (one-hot as the identity, position as a sum) beats a page that trains it, and the measurement that justified the training (the head at chance without position) lives on in the lab where a later 08 widget can use it.
- **The text-overlap sweep is a lab page now: `_lab/text-overlap-sweep.html?slug=<slug>&w=900`.** A frame a state, the `fillText` wrap from the recipe above, boxes mapped through the context's transform so rotated column labels count, pairs that intersect and strings past the canvas reported. Run it at 900 (the narrowest side layout, a 534px canvas) and at 1200. Its first pass on 74 found eleven captions past their panel and three kinds of collision no screenshot had shown. **A state that paints nothing is a failure, not a pass:** the Tokenize page had thrown on a stale name after a patch, left a 300×150 canvas with no strings, and read as "ok" through a whole sweep until the page counted strings. The frame also needs a moment after its first load, or the first state records nothing.
- **Four mechanisms for text that fits, instead of shorter strings:** a caption drops trailing clauses (after " · ", "; " or ", ") until it fits its panel, so the clause order decides what goes; a grid's columns follow the width with the rows reserved for the narrowest layout, since the height cannot know the width; column labels thin to every k-th where a column is narrower than the face; a point label takes the first clear place of four or none, the hover still naming the point.
- **Why an embedding heatmap barely moves while its space turns:** the rows start N(0, 1), entries 0.85 on average, and forty epochs move an entry 0.5–0.65 — a fifth of a ±3 ramp, a fortieth of it a press — while each row turns 1.6–2.3 in eight dimensions against a length of 3. The direction changes, the colour does not. His pick was a Values · Change-since-start view; the alternatives were a quieter init (not what `nn.Embedding` does, and the widget would have to say so) or the ramp scaled to the table's range (which does not help the change).
- **The frame of a per-epoch projection must be held:** a PCA recomputed each epoch reflects and spins (four reflections in forty frames on one seed). Each epoch's own components laid over the final epoch's by Procrustes is the honest still frame, since `compute()` knows the end at the start; the final table's basis is smoother but chooses the axes with hindsight. And the axes of a picture come from the rows with a geometry (the eighteen motif codons, not all sixty-one), else the noise rows choose them.
- **"Position is added FOR attention, not by it"** — his correction of a blurb, twice. A CNN or an LSTM reads order from the sequence itself; the position encoding is the input's, added because attention has none. The subtitle says so and names no vocabulary.
- **The page control's label follows what the pages are:** Page where they are views (72, 73, 75, 70), Step where they are stages of one pipeline (30 normalization, now 74). And a title names the whole widget the way the arc does — "Signals: …", "Sequences: …" — which is why 72 became "Signals: Raw to Windows" from a gallery mock of five candidates beside the arc's cards.
- **A rename before the ship is cheap:** `git mv` the directory, then the slug in `main.js`, the stub's `<title>`, the manifest entry and the baseline's `slug` fields; the lab's measure and mock files keep the old name as the record of what was measured under it.

### From 75 `sequence-cnn-lstm` (2026-09-20 evening)

- **A shared engine change moved a shipped widget with every readout unchanged.** `train` gained a function source for 75 (fresh sequences each epoch) and, on the way, rebuilt its shuffle index from the identity every epoch instead of shuffling the persisting one. Same random draws, different batches, different weights — and 73 trains in the browser, so 26 of its thirty states DIFFERed on px alone at unchanged canvas sizes while the four "before any press" states matched. That pattern (only the untrained states match; sizes equal; text equal) is the engine, not the scrollbar. The fix restores the old order for a fixed set (`engine.js`, f44e663) and gives a new array a new order, which is what 75's table was generated under; 75's verify retrains three settings and compared them byte-for-byte under the fix. **Run the full suite when a shared engine changes, not only `widgets/core/`** — 73's measure passed throughout, because it asserts thresholds, not hashes.
- **The shooter's copy proof no longer reproduces the harness.** A fresh copy of `signal-cnn-lstm-shoot.html` (five substitutions) reported all seven proof states DIFFER on px in a pane where `fingerprint.html` MATCHed the same states, deterministically across two tabs, at DPR 1.25 and visible. Its `want` hashes also do not match the baseline's for those states (naive-bayes ?theme=light: baseline ca4a85f4, shooter wants 8d667536, gets f1e87045), so both its proof list and its hashing have drifted; how it read 7/7 this morning is not explained. `fingerprint.html` now takes `?only=a,b` (27ea756), which is what HANDOVER had asked for: a widget's 42 states run in about two minutes, three runs prove determinism, and "Copy new baseline" under a filter splices the run into the baseline in place of those widgets' entries. The states were recorded that way, read off the harness's own `latest` (override `navigator.clipboard.writeText`, click Copy, parse), and confirmed on a fourth run. Prefer the harness with `?only=` over a shooter copy until someone re-derives the shooter from the harness and proves it.
- **Occlusion on a composition class is flat by arithmetic**, and an axis fitted to the map drew noise at full height as if it were attribution. Three models, both classes: p saturates at 1.00 or 0.00 and blanking 8 of 200 bases moves it by under 0.001, since 8 bases move the fraction by 0.04 at most. The axis has a floor (a change of 0.05), labelled, and a flat map is said on the figure with the reason. A plot whose scale is the data's own maximum cannot show that nothing happened.
- **His copy rules this round:** "A DNA sequence reaches a network" is personification; a subtitle follows the pipeline's order, sequence → symbols → tokens → one-hot or embedding → CNN or LSTM → occlusion; generalise the opening to the class of data (any biological sequence, four bases or twenty amino acids, "here for DNA"). Struck this round: budget, probed, spells, class-1, half-max ("width at half maximum"), "the slide", a model "asked" (predict again). "Reads" and "sees" for a receptive field kept, as 73 shipped them.
- **The pace of a press is a control**, `speed` as a display choice after the drive — the draft's pace is Fast, Medium 1.5× is the default, Slow 2.5× — applied as a multiplier on the press durations in `takePress`; a driven state at `speed=fast` differs from the same frames at medium, which is the control's proof.

### From 73 `signal-cnn-lstm` and the sequence arc (2026-09-20)

- **An LSTM trains in the browser after all, at H = 8.** The planning measurement priced a BiLSTM at H = 32 over 720 steps at 24 ms a fragment forward and backward and wrote the page off as forward-only; at H = 8, 100 fragments × 8 epochs is about 2 s, and on a CNN's 90 steps of features under a second. Measure the small case before declaring a page untrainable: the forward-only page had a sensitivity graph he read as a prediction, and a trained running prediction (the whole model asked on every prefix) is what answered his question.
- **When the head is trained on a summary, the summary is a DATA control.** Reduce as a display would have applied a head trained for max to a mean vector. Made data, it became the case that fails: the last states at 48–57% against max at 100% on the raw signal, the lesson's own table.
- **A "his pick" can be reversed by the next review, and that is fine.** CNN + LSTM was picked as a strip at the mock and became a page at the first look, once the LSTM page existed to compare it with. Record the reversal beside the pick.
- **Feature maps must share the input's axis.** The first draft drew them 64 px narrower to leave room for a weights column, and his first comment was that the activations were not aligned to the beat. Each output now sits under the centre of the window it read; the weights moved into a band below.
- **The sweep's shooter is the general one.** `switch-shoot.html` copied with its default slug changed recorded thirty states in six minutes, proved its copy on seven baseline states first, and its second pass over the spliced baseline is the 5.10 confirmation. A widget's shooter is now a two-line copy.
- **A page's canvas width depends on the page's height.** The 1D-CNN page (536 px) hashes at 669 wide and the LSTM pages at 688, because the taller page gives the 1200 px frame a scrollbar. Each state is consistent with itself; a DIFFER between pages' widths is not drift.
- **The lesson's Dangerous / OK labels do not fit a planted-beat stage.** One ectopic beat is PhysioNet's class 4, which the lesson files under OK; naming the classes by what they are (Sinus rhythm / Ectopic beat) was his pick and avoids contradicting the data the page points at.


Each block below is carried as written by the session that learned it, newest first. `docs/design-principles.md` holds none of them yet (grepped 2026-09-16, and 2026-09-17 for the two newest blocks); moving them there is Kenneth's call.

### From 70 `mutational-signatures` (2026-09-18/19)

- **Design an interrupted state for every display control that re-targets the step.** A page switch mid-press ran the other page's press here and in 69; no settled or driven state could see it, and it surfaced only on asking what `before` plus `set: { page }` would show.
- **Tweens move in lanes** (his round-2 ask): nothing moves over marks already in place; separate regions, one mover at a time. Verified by a rotated-rectangle sweep over every frame, not by a screenshot.
- **A press starts on the previous press's last frame, op for op.** Recording both frames' draw ops is what checks it, and `lerp` is written (1 − t)a + tb so that t = 1 lands exactly on b.
- **Offer subtitle options only after reading the shipped ones.** Nearly all 61 open on the concept; the draft's opened on the counting rule and said a signature is "named by" its closest reference, the reading page 3 exists to correct.

### From 62 `augmentation`'s Classification task (2026-09-17)

- **A value that is a bug in one setting and correct in another needs a control naming the setting, not another value.** `keys=["image"]` was the stale mask's failure case under segmentation and is the only spatial call that runs for classification. A classification toggle on `keys` would have shown one setting as both; Task names what decides it.
- **A control that changes a list's length is a data control, as Split is.** Task began as display, keeping the draws. Once it also changed the Pipeline list from twelve lines to eleven, keeping progress would have meant mapping each press between two lists, and he picked "start over".
- **Shortening a list can move a line into a note's row.** Eleven rows put the call printed under the list on the baseline of the note under the sample, beside it. The layout keeps the longer list's rows.
- **A line's condition is its sibling's condition.** The Classification keys line printed after a draw that was not applied, while its Segmentation sibling, the stale mask's line, prints only after an applied one. Reading the canvas text after an unapplied press found it.
- **A second copy audit finds its rows in the strings written since the first, and in gating.** Every row was the day's, and one was made by a `when`: under Classification the section *The image* held only Seed.
- **Re-recording can measure what it expects unchanged.** Seven of 22 states kept their recorded hashes, and the shooter reported all seven reproduced, so "the change cannot reach them" was measured rather than argued.

### From 67 `tumor-heterogeneity`, the rounds to ship (2026-09-16/17)

- **Count a control's outcomes over its settings before building around it.** Page 3's sample control read "1 of 2 trees fit" at every setting, because the first sample to join already ruled out branching. The page existed to show biopsies narrowing the tree, and could not. It was found by the branching-patterns mock, not by any review of the draft.
- **A panel lists only what its caption promises.** "Scenarios that fit" also drew the ruled-out rows, each needing a line of explanation, and he read the result as information overload. Draw the fits, and say so in one line when none fit.
- **A number beside a verdict may use only what the analysis is given.** A fraction tile that preferred the sample the reader built showed 1.00 beside *Cannot tell*. The verdict was right; the tile was using knowledge the analysis does not have.
- **An instrument that does not match what it measures invents failures.** The verify's canvas stub drew axis ticks that core skips, which read as the widget painting 1,215px off the canvas; and a "settled" sweep carried a morph over from the previous cell. Import core's own helpers into the stub, and clear carried animation state for each cell.
- **A guard that has never painted is not yet a guard.** The extent sweep left `knows` at a default that draws no note; once widened, it found the longest note 52px off the canvas.
- **Numbers read off his figure are recorded with their caveats.** An error bar that reaches only the dot is an upper bound, and a half hidden under another cluster is mirrored and marked as mirrored.

### From 67 `tumor-heterogeneity` (2026-09-16)

- **Geometry inside a repeated small figure is solved from the tightest case and reused everywhere.** Two rounds went on marks and spacing that were two independent numbers: the mark that fitted at two copies met its neighbour at three, and a mark scaled per state read as a nucleus where a cell had one copy. One solved size, used by every state, ended it.
- **A parameter whose legal values depend on another is a dynamic-options choice, not a slider.** The mutated-copies slider ran to three in every copy state, so a link could ask for a cell that does not exist; `options: (v) => …` with `optionsFrom` is core's door, and a value the new list does not hold returns to the default through the same path a region write takes.
- **A mock may overturn its own written recommendation, and he may overrule the mock.** Keep both in the page: what it argued, and the pick. The record of a rejected argument is what stops it being re-argued.
- **A painted-extent check is worth writing once per widget.** Record every `fillRect`, `arc` and `fillText` extent while driving the widget and assert nothing lands outside the canvas: it caught a y-axis label drawn off the left edge that no text sweep and no screenshot reported.
- **A section and its fields must agree about the drive row.** A section marked `afterDrive` whose fields are not renders an empty heading under the buttons with its fields above them.
- **A parameter name can collide with another widget's verify guard.** `cells` tripped widget 54's proof that no other widget declares `cells` on a field; the fix is the rename (`showcells`), not a weaker check.

### From 62 `augmentation` (2026-09-15/16)

- **A picture that blends two images reads as a third technique.** A crossfade between two draws reads as MixUp, and a draw run backwards reads as stacked transforms; so each draw fades the last result out to the empty panel and the original in, and only then moves.
- **A struck-through list item reads as switched off, not as absent.** Validation/Test drew the training list with its random lines struck, and he read it as augmentations disabled. The split now lists its own pipeline as the notebook writes it.
- **A default the eye cannot see is changed on the stage, not in the listing.** Cell 19's std 0.01 moves no pixel by more than 10 grey levels, so the Contrast and Noise pages open on stronger values while the pipeline listing keeps cell 19's. Images are point-sampled to the panel as well: averaging a 512 px image into a 247 px panel roughly halves the noise.
- **A tween moves the transform's arguments, drawn at device pixels, and ends on the engine's exact result.** The verify holds both ends, the start equal to the input and the end to the engine.
- **A library's readable parameters can be a second draw** (MONAI's `RandAffined`). Pin to the applied matrix or to the output, never to an attribute read after the call.

### From 60 `mendelian-randomization` (2026-09-13)

- **A step label may key on the animation's own counter**
  (`widgets/core/widget.js`, `resolveLabel`): `{ anim: "trialBeat", labels,
  default }`. Widget 60's overview runs five acts under one Step button.
- **Readings of one study, eased** (`widgets/mendelian-randomization/model.js`):
  a data-shaped control becomes a display parameter by drawing the noise
  once, unconditionally, and building each setting's reading on first
  request; `lerpView` interpolates two readings leaf by leaf and core's
  ease mode supplies the frames. The pattern for any widget whose controls
  are re-readings of one draw.

### From 59 `polygenic-score`, round three (2026-09-12/13)

- **A hover is an inspector and a click is a parameter, and one drawing
  serves both.** `pointer: true` repaints on movement with nothing
  written; `regions` writes ONE hidden display parameter; the overlay is
  one function called with whichever subject is present, the pointer
  winning while it is on a target. The URL then carries the pin, a
  lesson link can open on it, and the hit-driven state hashes identically
  to the `snps=` state — the proof that a click and a link agree.
- **Two panels that share an axis must share a pitch.** The triangle
  spaced SNPs at w / (m − 1) and the block at w / m for two rounds; five
  pixels apart at the right edge, invisible until a hover tied them.
- **A batch that draws as a flat line is a lie about the path.** Every
  SNP its own column at every count, the run capped by time, the strips
  switching from dots to bars below 4px — one regime, and the order
  (lowest P first) gives the staircase a shape that teaches.
- **A tile's label is a claim.** "Overfitting" showing the gain of
  thresholding was false; Kenneth chose to name the number what it is.
- **The lesson's own phrase beats ours.** "Inherited together" for
  "travel together"; "linkage disequilibrium (r²)" named once where the
  student first meets r².
- **Read the running session's commits before committing.** A parallel
  session landed the step-3 batching while this one was verifying it.

### From 59 `polygenic-score` (2026-09-12)

- **Nomenclature is a pick, not a pass.** "Tune" and "holdout" passed the
  three-pass audit because they are plain words; Kenneth caught them as
  machine learning's words in a genetics lesson. When a field has its own
  nouns for the thing (base, target, validation, best-fit), the subtitle
  and the readouts use those, and the audit's forbidden list grows by the
  widget's field.
- **A question from him during the build is a page.** "Can the score give
  a patient's risk?" and "how do people stratify?" became page 5's two
  sections before the draft had its round; write the plan under the slot
  at once and build it after the round, not during.
- **Sub-streams off one seed change what `seed=N` means.** Four
  independent rng streams keep a page-1 control from moving the genome,
  at the price that the widget's seed 1 is not the measure script's; the
  default seed is then chosen to open on the mock's reading and the
  script's own arrangement is asserted separately.
- **Reader-facing verbs of arrival ("landed", "taken") are ours.** The
  legend says "just added", "just chosen".

### From 57 `gwas` (2026-09-12)

- **A symmetric simulation can fail to reproduce the lesson's own picture.**
  Three populations at equal Fst give two equal eigenvalues; the lesson's
  GRM has 17.28 / 3.08. The nested topology (two close, one far) gives the
  ratio, and the mock's PC scatter looks like 01-4's only because of it.
  When the lesson has a real figure, measure the simulation against it.
- **A model switch is a display change.** `model` and `npcs` are display
  so the reader switches covariates and sees the same run at the same
  position under the other model — the section's whole argument — and
  `compute()` holds the scan the model names. A fingerprint state pins it
  (Play, then `set model=pcs`).
- **A promise the widget cannot keep goes in the copy as what happened.**
  The variance step on unrelated people is not reliably zero at m = 2000
  (a small GRM's off-diagonal spread), so the fallback line reads as
  something that happened at this cohort, and the footer row is reserved
  in both states so the figure does not jog.
- **Opening on SNP only is opening on the question.** The Model control's
  default is the uncorrected test, so the first run shows the forest of
  false peaks and the correction is something the reader does.

### From 56 `hardy-weinberg` (2026-09-12)

- **A settled state on a widget that declares `shown` must pin `shown=`.**
  `check` refuses "neither shown= nor drive" on such a widget, so a URL
  that lands the same finished figure another way (`?whole=1`) is not a
  state. Write the states with `shown=N` from the start.
- **A legend function sees parameters only.** Core passes `{ params }`, so
  a legend entry for a mark that exists only mid-animation (the path, the
  last step's arrivals) stays listed at rest. Open on 56; a core change
  would pass `anim` too — a full-suite change, to be argued not slipped in.
- **A readout tile has no tone.** The P value past the threshold is
  coloured on the canvas beside the bars instead; a `tone` on tiles is the
  one core addition 56 wanted and did not make.
- **Draw from counts when the page is 2,000 tables.** A display `page`
  means `compute()` builds both pages on every data change; per-individual
  sampling at 50,000 × 2,000 is 100M draws, so the Many-SNPs tables are
  binomial draws on counts (exact when small, seeded normal when large),
  with the verify asserting the moments.
- **The copy audit's mannerism pass.** Beyond register, vocabulary and
  outcome commentary: figurative verbs ("moves a sample off it", "read
  against"), chatty tails ("or 2,000 of them") and question-shaped labels
  ("What produced the sample") all read as mannerisms to him. State the
  literal fact; a label is a noun.

### Working with subagents, from 49 (2026-09-10)

**Working with subagents, learned on 49 (his question 2026-09-10: "why does a
simple task take so long?"):** each Opus subagent starts cold and spends two
thirds of its time verifying. So: small edits (< ~20 lines, no design) in the
main session; batch several comments into one brief; scope the verification
in the brief to the touched page and one width for a string change; `check`
and `npm test` always. `SendMessage` to a running agent was disabled in that
session, so a change of mind mid-round costs a second round — decide the
design with him before briefing.

### How he wants a widget built, across 48 and 53 (2026-09-09)

- **His notebook is the spec.** Read the Master copy of the lesson
  (`Downloads/PHM5005 AY2025-26 - Notebooks/Master/`) and its figures
  before proposing structure; mirror its headings as the rail, its
  sub-lists as control groups, its example values as the operands. The
  one time the widget departed from it (round 17 of tensors, a layout of
  the session's own) drew "are you fucking with me? … mock up and show me
  before imposing your own designs on the widget". His `05-3` figures are
  in `widgets/_lab/figs/` as `dl-layer-*` and `dl-compose-*` / `dl-flow-*`.
- **Mock in `_lab/` first, then he picks; one widget per commit; commit
  locally; push only on "tested ok".** The tensors mocks are the pattern:
  `_lab/tensor-lesson.html` (the notebook's order), `-style.html`,
  `-squeeze.html`, `-size1.html`, `-flow.html`, `-rank5.html` — each a
  page of two to four options with a recommendation, the widget itself
  cropped in iframes where it could already draw the thing.
- **He reviews from annotated screenshots**, several numbered points at a
  time; answer each by number; fix what is a fix, mock what is a design.
- **Reader-facing prose states the concept**, in the register of the
  shipped subtitles (two or three plain sentences defining the idea; the
  blurb one such sentence, under 120 characters). Options that described
  the widget drew "don't comment and describe the widget … look at
  previous examples". No "never", no coined adjectives, no personification.
- **Links to him carry no `shown=`** unless the finished figure is the
  point: a link that opens finished, plus a glide that keeps a finished
  figure finished, made him think a result appeared before he chose.
- **Run `npm run check` and READ its verdict before `git push`**: a chained
  `check && … && push` with `tail -1` on the check pushed a failing blurb
  once (2026-09-09, fixed in the next commit).

## Core doors widgets have added

**From 81 `cell-markers` (2026-09-25):** **`role: "page"`** on the field
that says which part of the widget is on screen (params.js documents it;
widget.js's Reset reads it), and Reset returning the controls on screen to
the link's values rather than the defaults. See the top of this file.

**From widgets 30–38 (2026-08-29 to 09-01):** **THE CORE DOORS THOSE SESSIONS ADDED**, which are the part a new widget needs
to know about — each is documented at its own definition in `widgets/core/`:
`style: "action"` (a bool rendering as a full-width button), `style: "bits"` (an
int as a row of toggles), `legend` as a FUNCTION of the params, `drag.hit` (a
pointer drag confined to a strip), `--c-value-low/high` as a colour role,
`runLabel` taking the map form `stepLabel` had, sections rendering their
`detail`, `style: "grid"` on segmented with `span` on an option, and
`mathmlRenders()` moving into `core/env.js`.

**From the tensors review (slot 53, 2026-09-09), each gated on a full suite run:**

- **`expr`** (params.js, controls.js, tokens.css): one line of code whose
  slots are `<select>`s over `hidden` parameters named in `slots` — or,
  since round 14, a text input where the slot's parameter is `text`.
- **`--c-dim-a..d`** (tokens.css, env.js `dims`): a hue per tensor
  dimension, on frames, rules, arrows and swatches — never on text. Named
  in CLAUDE.md's role list.
- **`text`** (params.js, controls.js, tokens.css, and the harness's `set`,
  rounds 14–15): a short string the reader types, with optional `parse`
  (what was typed → what is stored, applied to URL values too), `show`
  (stored → displayed) and `check(text, values)` (a message shown under
  the field while it is typed in, null to clear). Grows with its text.
  Commits on `change`, never per keystroke. README's type table names it.
- **Dynamic `options`** (params.js, controls.js, widget.js, round 16): an
  option-list field may declare `options: (values) => [...]` with
  `optionsFrom` naming the parameter(s) it reads; the block rebuilds when
  one moves, and a value the new list no longer holds returns to the
  field's default through `setFromRegion`, so the control is synced.
  README names it. Rounds 12 and 13 changed nothing in core.

**From `gradients` (slot 48, 2026-09-07/08), each gated on a full suite run:**

- **`controls.js`, `when` grammar:** `any` beside `all` and `oneOf`, and
  clauses nest (`gatingParams` walks the tree). For a control shown on two
  tabs' surfaces at once.
- **`tokens.css` / `env.js`, a colour role:** `--c-slope` on series-5
  (magenta) for the local slope — tangent, secant, gradient arrow — because
  `--c-highlight` is 1.08 against the curve a tangent lies on. Measured on
  `_lab/gd-colour.html`; CLAUDE.md's role list names it.
- **`controls.js`, principle 3.4f a fourth time:** the option-list types
  (`choice`, `segmented`, `matrix`) dropped a FIELD's own `detail` and
  rendered only the selected option's. `ownDetail()` renders the field's
  line first. Nine lines in eight widgets appeared for the first time and
  were register-passed the same day. 5.9's outstanding list of seven
  lesson-or-notebook references in control `detail` text is cleared: a
  grep of every `detail` line on 09-08 found none.

**Added since, by the DL and image arcs:**

- **Drive labels:** a label entry may itself be `{ param, labels, default }` (slot 50) or key on the animation's own counter, `{ anim, labels, default }` (slot 60) — `resolveLabel` in `widgets/core/widget.js`.
- **`cells` on a `text` field, `qual` on a segmented option, and an opt-in equal-column checkbox run** (slot 54, the grid rail).
- **`preview`, a rail block type**, showing the classes beside the controls (slot 64).
- **An `icon` painter on a segmented option** (`controls.js`, `params.js`, `tokens.css` `.w-seg--icon`; slot 65).
- **Core probes `regions` before the first compute**, so a `regions` function derives its own state rather than reading one that may not exist yet (slot 65).

## Kenneth's notebook edits

**03 - MR and the PRS notebooks (2026-09-13).** **Kenneth is editing the
notebooks himself; nothing in this repo waits on it.** The text written for him
at widget 60's close was all in the chat: the MR results cell, the three methods
as a table with inline math, the harmonisation table, the F statistic and
pleiotropy sentences, and the PRS calibration sentences ("on the diagonal", not
"sits"). Its particulars are in
[docs/archive/HANDOVER-2026-09-17b.md](docs/archive/HANDOVER-2026-09-17b.md).
When the arc is next touched, read the notebooks first — the widget's words must
match his.

**01-2, the HWE revision (2026-09-13).** Kenneth asked why the lesson's pooled sample of three populations "preserves" HWE. It does not: within Chinese, Malay and Indian separately NO SNP fails at 10⁻⁶, mean F is zero, and all 2008 pooled failures pass in every group. The numbers are under the catalogue's § *Three things the lesson's own output files say*, item 2.

**His decision: revise 01-2 to do it properly, not a note:** HWE tested within
each population (`--keep-fam` per RACE list), and the SNPs that pass in all three
kept with `--extract` in place of `--hwe`. The cell-by-cell plan, the six
intersection methods he chose among, and the QC practice it was checked against
are in the 2026-09-17b archive.

**Two things this may change in the repo later, neither owed now:** the
`hardy-weinberg` widget's copy and its catalogue misconception line were
written against the pooled notebook; once his revision lands, read it and
check the widget's Two-pooled reading and Many-SNPs page still say what
his cells show. And the five unlabelled people (in the .fam, not in the
measurements file; four have no phenotype) take no part in the
within-population tests and stay in the filtered set — fine, told to him.

**Notebook points recorded for him, his to fix; none blocks the repo:**

- **06-3:** the JPG masks meeting `AsDiscreted(threshold=0.5)` unscaled (2026-09-15; KRD-WBC's own masks unmeasured). The reader argument is DONE: he added it to both of cell 19's lists on 2026-09-17; cell 15's syntax block may still show the plain `LoadImaged` line, which was pointed out to him. See the slot 62 block at the top.
- **05-3 (2026-09-10):** cell 43 prints `X` and `Y` where it means `X_batch` and `Y_batch`; cell 44 says "BatchNorm3D"; cell 60's eval comment describes a scaling PyTorch does not do at eval.
- **05-2 (2026-09-09, recorded as his cell to edit):** the second tensor (cells 41–44) holds 21–30 where the `tensors` widget's holds T + size.
- **05/02, `hmm` (2026-09-06):** `prop.table(…, margin=2)` column-normalises E, so its rows do not sum to 1; cell 30 says the record came from P1 when it can only be P2.
- **05/01, `experimental-design` (2026-09-05):** cell 85 says pseudoreplicates lose the finding, which is one draw; over 3000 draws of that exact setup it is significant 68.7% of the time.
- **04/04-08** cells 40 and 47, and **04-3**'s `Density` column: under *Deferred* below.

## Open items on already-shipped widgets

These are the things a past session recorded and did NOT fix. Each is a
deliberate deferral, not a bug list — the full reasoning is in the catalogue
under each widget's own section.

*The lesson links that no notebook carries yet, and the projection check that no widget from 11 on except 25 has had, are listed once under* Open across the collection *above, not repeated per widget here.*

**Open on 67 `tumor-heterogeneity`, none blocking:** no mutation can be built sitting on the 0.9 line (offered as a note, not taken); the four-cluster patient in `_lab/vaf-trees-mock.html` stays a mock, on his pick of three clusters and his own data.

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

**Open on 57, none blocking:** the rail is ~790px against a ~500px figure
column; λ after three SNPs is a median of three and moves a lot early in a
run; dragging the Family effect slider under + PCs + GRM recomputes at
~230 ms an event.

**Open on 56, none blocking:** the frequency difference is shared by both
pages, so at the default 0.5 the Many-SNPs page shows most SNPs past the
line (the mock drew each SNP's difference from a spread and matched the
lesson file's 0.12%); the static legend entries above.

**Open on 55, none blocking:** 05-4's cell 41 links the netlify site where
the widget link would go; the three Start
detail lines were kept as descriptions of place ("(−3.6, 0.6); the local
minimum lies between here and the global one") and Kenneth may strike them
as steering; compare at lr 0.3 is a busy picture (real: RMSprop is flung at
that rate); the rail is ~685px in the tallest state against a ~590px stage.
**Open on 54:** the Single-label fraction renders small in MathML; the
Multi-label rail is taller than its stage.

**Open on `composition`, none blocking:** the readout tiles on the four flow
pages print results at rest (Gate range, shapes match, Merged) while the
captions wait, raised twice and not taken up.

**Open on `support-layers`, none blocking:** the pooling window's canvas
arithmetic line prints max at 2 dp and mean at 4 dp (the readout tile was
fixed, the canvas line was not named by the audit); the `PLACEHOLDER, draft:`
note prefix still stands on `processing-layers`' 29 states in the baseline
(50's were stripped; the shooter strips it itself, so it is cosmetic).

**Widget 53 `tensors`, open after shipping, none blocking** (the notebook's
second tensor is under *Notebook points recorded for him* above):

- The rank-5 figures are tall at the 550px stage (stack at rank 4 in the
  frames view about 1600px, its print under the drawing), and the
  phone-width overflow on Basics (canvas ≈ 371) is accepted for the lecture
  screen.

- The two degenerate stacks a student can type, [20, 1, 1] and
  [1, 20, 1, 1], overrun the 550px stage by 30 to 110px in the stack view
  (twenty slabs and a merged name); the frames view of each fits.
- The rank-4 frames header packs `dim 0 = 0`, the column indices and
  `dim 1 = 0` into 22px (visible on Join's stack in the frames view).
- The lesson's `T[0, 0, −1]` (cell 19): negative indices were offered as
  an option and Kenneth did not take them.
- Join at rank 4 is two 40-cell tensors and an 80-cell result, drawn since
  round 28 as a fifth level; judged by him and kept, at its height.
- At rank 4, `flatten()` and `reshape(-1)` make a [40] row, which at the
  550px stage runs 32px past the edge even at CELL_MIN (40 × 14 = 560); at
  770 it fits at 18px. The `?ops` sweep names it beside the two degenerate
  stacks; the three are the only overruns among 242 states.

**Widget 48 `gradients`, open items, none blocking, all for Kenneth's call:**

1. Play on the one-parameter page at lr 0.001 takes minutes: a cap, or a
   fourth speed.
2. The a-slice on the Partial relief is cased in the ground colour because
   `--c-group-a` and `--c-value-low` share `--series-1`.
3. 19 inherited rim-name collisions on the relief at turned viewpoints
   (`turn`/`tilt` off the default 300/35); none at the default.
4. The `∂L/∂b₁` arrow label meets the `30` tick on standardized x at lr 1.
5. `--c-extreme` carries both the diverged note and the faint straight
   line to the minimum on the map.
6. No hit-driven state exists for the drag: core's `drag` channel sets
   the `grab` cursor and the harness's `hit` step wants `pointer`. A
   harness `drag` step would close that; the turned-viewpoint settled state
   covers what the drag writes meanwhile.

**Widget 45 `hmm`, for its projection check:** the 550px fingerprint canvas gives 17px tiles and 10px letters on Biology.

**Widget 44 `experimental-design`, what is still open:**

1. **L1, the three side-by-side panels** — population → arranged by the scheme →
   the sample. Clearer than L2, and it needs 596px of stage where the 550px
   baseline canvas has 436. Kenneth: *"if the animation is confusing, we may do
   L1 later"*. It would need a width-dependent reflow, and the suite would only
   ever hash the narrow branch — a blind spot to name, not to hide.
2. **Independent against repeated measures**, measured in
   `_lab/design-taxonomy.mjs` §1 and NOT built: repeated measures holds 51.8%
   power while independent collapses 47.1% → 6.1% as between-subject SD grows,
   on half the people. Nothing in the collection hosts it. It belongs on the
   Replication tab if he wants it.
3. **The notebook's own §4 conclusion is one draw and should be fixed.** Cell 85
   says pseudoreplicates lose the finding; over 3000 draws of that exact setup it
   is significant 68.7% of the time, 4.8% of those with the sign backwards. The
   stated hazard is a lost finding; the measured one is an invented finding at
   43.5% when nothing is there. Kenneth has been told; the notebook is his.

**Widget 43 `enrichment`, still open:** the permutation scheme. `gseaNull`
permutes set membership; the real thing permutes sample labels and re-ranks.
Newly buildable — the stage now has an expression matrix — and costed at the
foot of `main.js`.

**Widget 42 `hierarchical-clustering`, still open:** narrow widths unchecked
since the canvas grew to 790 tall, last measured at 375px when it was 400. A
student could actually hit this one.

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

## `px` TRACKS THE DEVICE PIXEL RATIO — the baseline is Windows at 1.25

`px` hashes `toDataURL()`, which encodes the canvas's **backing store**, so display scaling rewrites every hash while the picture stays the same size on screen. The move from macOS (DPR 2, an 1100px backing store for the 550px figure) to this machine (**1.25**, 688px) turned all 123 states red on `px` and **0 of 123 on `tx`**, the 41 driven states included. So `tx` is the cross-machine invariant, and the re-baseline diff was exactly 123 `px` lines and nothing else.

- **The baseline is specific to DPR 1.25.** Changing Windows display scaling turns the whole suite red, and that looks exactly like a catastrophic regression. Check `devicePixelRatio` (expect 1.25) and `document.querySelector(".w-figure canvas").width` (688 at FRAME_W 900) before believing anything.
- **The browser pane reports 1.25 while it is displayed**, so a baseline can be recorded from an agent session. The proof was the pre-existing states MATCHing, and that is the test to run before assuming a hash cannot be recorded. **The pane composites no frames while it is not displayed:** `requestAnimationFrame` stalls, DPR reads 1, and the harness cannot run. Front the tab.
- **Windows hashes are stable.** Eight states hashed three times each came back identical, including `odds-and-risk`'s `view=calculate` states, which were flaky on the Mac.
- **Do not re-baseline an undiagnosed red suite.** The Windows re-baseline was right because the cause was found first and `tx` proved the figures unchanged. The options for a durable `px` are to pin the browser and the scale factor, to hash something less brittle than the PNG bytes, or to treat `px` as a same-machine check. Normalising the canvas size would survive a scaling change but not a platform change: DirectWrite and CoreText rasterise text differently.

---

## Working on Windows

*Working on this machine* above is the short form; this section keeps the diagnoses. How each was found is in [docs/archive/HANDOVER-2026-09-17.md](docs/archive/HANDOVER-2026-09-17.md).

### The dev server runs on :8010, not :8000

A Docker container in WSL (`mcq-app-web-1`, from the `app-mcq` project) publishes `127.0.0.1:8000`, and WSL2's localhost forwarding mirrors it onto the Windows side through `wslrelay.exe`. The failure is confusing rather than obvious: the port is split by address family. `wslrelay` holds **IPv4** `127.0.0.1:8000`, while a dev server started on 8000 gets **IPv6** `::`. `curl` prefers IPv6 and reports a happy `200`; the browser prefers IPv4 and gets the container's `400`. So the server looks fine from the shell and broken in the tab.

**Use `node scripts/serve.mjs 8010`, not `PORT=8010 npm run dev`.** The shell here is PowerShell, which has no inline env-var prefix (`CommandNotFoundException: The term 'PORT=8010' is not recognized`); an argv port works in every shell, and `serve.mjs` has always honoured one. `.claude/launch.json` pins 8010 and passes it as an argument. It once declared the port while the server fell through to 8000, with an `autoPort: true` that contradicted the pin; both are fixed. It also carries `widgets-alt` to `widgets-alt4` on 8011–8014 for other sessions, since `preview_start` refuses a taken port rather than moving; a server can also die when its tab navigates to another origin. CLAUDE.md and README point here rather than hardcoding `:8010`, because the clash is machine-local.

### ASK before working around a blocked network

**Kenneth runs SimpleWall, a per-application firewall, and a blocked socket usually means a prompt he did not approve in time.** On 2026-08-26 `pip` failed with `WinError 10013` on every connection while PowerShell reached PyPI. It was diagnosed as a permanent property of the machine and worked around, and it was a firewall prompt that had timed out; one click would have fixed it. **A blocked network call is a question, not a constraint:** say what was blocked and what it was trying to reach, and ask him to approve it. Build around it only if he says it cannot be approved.

### Python and the measurement scripts outside the repo

Python 3.12 is at `%LOCALAPPDATA%\Programs\Python\Python312\python.exe` (`winget install Python.Python.3.12`), and since 2026-09-16 `python` from the Bash tool resolves to it, with numpy, scipy, scikit-learn, Pillow 12.3.0, torch 2.14.0+cpu and MONAI 1.6.0. **numpy 2.x removed `ndarray.ptp`**, so `Y.ptp(0)` raises in anything copied from an older script; use `np.ptp(Y, axis=0)`.

**The older measurement scripts are deliberately not in this repo** (prd §6 records why a Python helper was deleted from it). They sit beside a venv at `C:\Users\Admin\Downloads\PHM5005 AY2025-26 - Notebooks\_scratch\venv`, which holds scikit-learn, pandas, imbalanced-learn, umap-learn and pillow:

- `tree43.py` / `tree43b.py`, behind widget 17's tree numbers;
- `imb1.py`–`imb6.py` and `verify18.mjs`, behind widget 18's. Node imports the shipping `widgets/balancing-data/model.js` and `imb6.py` checks its numbers against scikit-learn, through absolute `file:///D:/…` URLs, because a relative path cannot cross from C: to D:;
- widget 22's planning scripts, which the catalogue cites by name: `umapstage.py` (the shared stage and metrics), `umap1.py`–`umap10.py`, `umapfig.py`, `graph-legible.mjs` and `ce-panel.mjs`. The archive describes each; the repo holds the other half, `widgets/_lab/umap-engine.js`, `umap-ref.py`, `umap-verify.mjs` and `umap-measure.mjs`.

Build any venv outside the repo: Dropbox indexes its thousands of small files. `umap-learn` 0.5.12 pulls in numba, so its first call costs about 5.6 s of JIT.

### The notebooks

All 34 PHM5005 notebooks are in `C:\Users\Admin\Downloads\PHM5005 AY2025-26 - Notebooks\Master\`, plus `Supporting Materials/Heart Failure.ipynb`. **They are output-stripped**; *Reading the PHM5005 notebooks* below has the caveat that matters. PHM5003 is at `../jupyterbook/phm5003`.

### Git and the toolchain, on Windows inside Dropbox

- **`git commit` can die with `unable to write file .git/objects/…: Permission denied`** while PowerShell writes the same path fine. It is Dropbox racing git for the new object file. **Retry with backoff before diagnosing anything:** one strike cleared in seconds, another took ~45 s, and `git hash-object -w <file>` in a sleep loop is a clean probe. `core.createObject rename` is in the repo config, because Dropbox's filter driver can deny the hardlink git defaults to, and it is not a complete cure on its own. Retry, then chase configuration; never permissions.
- **`.gitattributes` pins the working tree to LF.** Git for Windows defaults to `core.autocrlf=true`, which would rewrite every line ending in the repository on the first commit from this machine.
- **`npm run build` retries the `_site` delete.** Dropbox indexes `_site/` the moment a build populates it, and Windows will not remove a directory anything holds a handle on: `EBUSY` came roughly two runs in three, the failing path moving deeper each run. Worst case measured, 6 attempts and ~300 ms.
- **Dynamic imports go through `pathToFileURL`.** `import(join(root, "…"))` gives `C:\…`, which Node's ESM loader refuses (`ERR_UNSUPPORTED_ESM_URL_SCHEME`), and that once failed `check` on its first line on any Windows machine.
- **Git's identity is repo-local**, `Kenneth Ban <kennethban@gmail.com>`, matching every existing commit.

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

**DONE 2026-09-20 (27ea756): `fingerprint.html` takes `?only=<slug>[,<slug>]`.** Until then it always ran every state,
which is what forces the loop in *NEVER BASELINE BY PLACEHOLDER-AND-DIFF* below
(per-widget `_lab/<slug>-shoot.html` pages have been the workaround since widget 23).
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
rather than read.** That is exactly how `04-3`'s table in an earlier NEXT list
of this file turned out to be part artifact. **Treat any number in this file
quoted from a printed output, and not since re-measured, as one draw from a
possibly unseeded model.**

**Match by filename, never by link.** The same notebook has appeared under three
Drive IDs across two sessions.

There is still no `../jupyterbook/phm5005`, so PHM5005 lesson slots are named by
notebook filename.

---

## How Kenneth works — read before writing anything he will see

**No coined adjectives (2026-09-06).** "Sticky coin" for a coin whose next
toss depends on the last read to Kenneth as a mannerism, and he asked for a
pass over everything written that day. The rule that came out of it: describe
a thing by the fact about it, not by a word that stands in for the fact. The
same pass caught "counted straight off the record" and "counting is the
estimate". He reads new strings for register even after the copy audit, so
an audit is not a licence for the strings that come after it.

- **No second person, no narration (2026-09-17).** *"…you built"*, *"what you bring"* and *"how you sequenced"* read to him as mannerisms. Rail sections are plain nouns, as across the collection (*The sample · The sequencing · The analysis*), and a verify's struck-word sweep strikes you/your and narration phrases.
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

**Three commands, in this order, before every commit.** `npm run check` for
the invariants (0.7 s of it is the dead-code rule: a declaration nothing reads
fails the build). `npm test` for the engine and contract scripts in `_lab/`
registered in `scripts/verify.mjs` (29 on 2026-09-17, about 49 s of script time;
`build` runs it, so the deploy does too). Then the
fingerprint suite, which is the only one of the three that sees a pixel.

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

*The harness had no way to run a subset, which is what made the loop above
necessary; `?only=<slug>` was added on 2026-09-20 (27ea756) and the loop is
no longer needed.*

> *Earned three times.* `bootstrap` was baselined three times over. Widget 11
> changed shape in six of eight review rounds. Widget 12 went thirteen rounds.

`npm run check` fails a **non-draft** widget with no fingerprint states, which is
the escape hatch: leave it `draft` while the design moves.

If a state legitimately changes, regenerate the baseline **in the same commit**
as the change, so the diff records that the rendering moved.
