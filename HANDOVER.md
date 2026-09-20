# Handover

**SIXTY-THREE WIDGETS IN THE MANIFEST — 62 on the gallery and `roc-auc` UNLISTED; no draft on `main`** (`wgcna` is still a draft on its own branch and worktree, another session's). The live site is <https://nusmedicine.github.io/statml/>, deployed from `main`: the latest widget ship is `792b58c`, the last push is `e60b5ad` (the mid-press sweep, 2026-09-20, deploy green, live manifest 63), and this handover's commit follows it. **SESSION CLOSED.**

**2026-09-20, his pick over slot 71: the mid-press page switch, fixed in 69 and then swept across every widget. PUSHED on his "tested ok" as `e60b5ad`, deploy green** — `88d7929` (69), then one each for `trees-and-ensembles`, `generalization`, `odds-and-risk`, `mendelian-randomization`, `cnn-architecture`, `maximum-likelihood` and `bayesian` (`3b69b5e` … `0328a65`), then the baseline, the probe and the shooter, then this handover and the catalogue. The catalogue's § *The mid-press page switch, fixed 2026-09-20, and the sweep it started* (under slot 69) has the whole record: the fault, seven shapes of it, the probe (`_lab/switch-probe.html`: for each display control, is the figure after *press → switch* the same whether the press was interrupted five frames in or allowed to finish first, and the same after switching back; 308 switches on 63 widgets, 161 more after the lead), and the two things found beside it — core discards what `rebuild` returns, and a driven fingerprint state can hash identically to its settled sibling and cover nothing (`generalization`'s did; now thirty frames). The eight fixes change what a reader sees only when a control is switched mid-press, and every recorded state of the eight widgets reproduced under the shooter; he tested and pushed the same day.

**HANDOVER 2026-09-19, on "tested ok, push it and write handover".** Slot 70 `mutational-signatures` **SHIPPED AND PUSHED** as `792b58c`; the push carried the twenty commits since `719359c`, from the measurement on NMF 0.28 (`064f36d`) to the ship. After the draft, four rounds, each mocked first and picked by him: page 2's signatures form beside W one column at a time with nothing moving over a finished one (his "without them overlapping"); the matrices on a violet one-hue ramp, a new token role `--c-magnitude`; page 3's comparison as a scan, and an eased switch between signatures; page 1's Ti/Tv square, one mutation drawn on both strands, and the 96 types as a 4×4 grid a class and then lined up, a click naming one (core: `regions` now get `anim`, `e663c72`). Then the copy audit (ten fixes as a set and three picks), the Type control moved below the buttons, and the subtitle and blurb, his picks of three each, concept first. Three core commits, each with the full suite run: the substitution-class roles (`82928de`), `--c-magnitude` (`6bda435`) and the regions change. At the ship: 34 states, verify 104 checks, `check` and `test` read alone, the fronted suite 880 of 880 identical, the deploy green and the live manifest `shipped`.

**Two lessons from the ship, both in the order below.** **A paged widget can run a press nobody pressed:** core keeps a running loop going through a display change, and an `advance` that steps whichever page `anim.page` names runs the new page's next press when the reader switches page mid-press. It was found only by designing the interrupted states, fixed in 70 (`73f1658`), and **is live in 69 `driver-genes`** (its section below). And **a look-up control in the setup block reads as a filter:** he asked whether the Type dropdown, under Tumor, limited what "Add the mutations" adds. It moved to 3.4j's block under the buttons, "How to look at it".

The 2026-09-18 close (slot 69 `driver-genes` at `d411b2c`) and the 2026-09-17 closes (slot 62's Classification task at `ea9426e`, slot 67 `tumor-heterogeneity` at `93f2d6d`) are recorded in their sections below and in the catalogue.

**NEXT is his call: slot 71 `somatic-interactions`**, held back, measured and cuttable in the catalogue's § *Slot 71*, or 63 `pretrained` off KIV — his call, put to him on 2026-09-20 and deferred behind the sweep. A core option for the switch was not taken: seven shapes of finish are seven widgets' own knowledge, and a flag on the page parameter could only stop the loop, not finish the press. The cancer mutation arc's 67, 69 and 70 are complete; the image arc (PHM5005 06) has 61, 64, 65 and 62 shipped and 63 `pretrained` on KIV; slot 52 `training-loop` was discarded on 2026-09-13; the GWAS and PRS arc and the high-throughput arc are complete.

> **Compacted three times.** On 2026-09-16 from 3,528 lines ([docs/archive/HANDOVER-2026-09-16.md](docs/archive/HANDOVER-2026-09-16.md): every per-widget session record for widgets 22 to 65), on 2026-09-17 from 1,651 ([docs/archive/HANDOVER-2026-09-17.md](docs/archive/HANDOVER-2026-09-17.md): slot 62's review record, the history behind *Working on Windows* and the DPR section, and open items that were duplicated or moot), and at that day's second close from 1,466 to 1,433 ([docs/archive/HANDOVER-2026-09-17b.md](docs/archive/HANDOVER-2026-09-17b.md): slot 67's what-shipped and verification paragraphs and the in-review block for slot 62's Classification task, both in the catalogue; the particulars of the MR, PRS and 01-2 notebook text written for Kenneth; and the lesson-link and projection clauses repeated under each open item, now said once). Each archive is byte-identical to HANDOVER.md at the commit [docs/archive/README.md](docs/archive/README.md) names. Kept here: current state, the order of work, the machine, the lessons not yet in the principles, the open items, and every reference section another file points at (*Working on Windows*, *The canvas text sweep*, *Driving the animation in node*, the fingerprint harness, *THE BIG ONE*, *Order of work*, *NEVER BASELINE BY PLACEHOLDER-AND-DIFF*, the traps). A source comment naming a HANDOVER section that is no longer here resolves in an archive. **HANDOVER is current state and the next task; the catalogue is the record.**

## Slot 70 `mutational-signatures` — shipped 2026-09-19 (`792b58c`)

"Mutational Signatures" for PHM5003 07 / 01-4: *Catalogue · Signatures · Matching*. The catalogue's § *Slot 70* has the measurement, the picks, rounds 1 to 4, the copy audit, the Type move and the ship.

**Things the next session must know about this widget:**

- **Its link words are public now:** `page=catalogue|signatures|matching`, `tumor=largest|hypermutated`, `type=` one of the 96 names, percent-encoded (`T%5BC%3ET%5DA`; he said keep the notation), `hypermutated=in|out`, `rank` (2 to 6), `signature`, `seed`, `truth=off|on`, `shown`. Renaming one breaks shared links.
- **The references are look-alikes, not COSMIC's vectors.** COSMIC's terms rule out its signatures in a public repository, so each reference is a profile built to resemble the one it is "modelled on", and page 3 says so. The lesson's TCGA-derived data stay in the scratchpad, never the repo; `_lab/mutational-signatures-reference.tsv` is synthetic, scored by R's NMF 0.28 (installed on his approval), and holds the engine, widget 41's `updateKL` with brunet's floor.
- **Two core additions came with it.** `--c-magnitude` is a violet one-hue ramp from `--surface-3` and shares `--c-highlight`'s hue, so the two never meet on one page (pages 2 and 3 use ink where a highlight would go). `regions` are handed `anim` for one thing only, which settled view a stage shows: page 1's targets are grid cells after the split and bar columns after the line-up.
- **A press belongs to the page and the tumor it started on.** `advance` records `anim.moving`; `rebuild` finishes an in-flight press when the page or the tumor changes and sets `anim.halt`, which ends the loop at its next frame. Only while something moves, or the reader's next press loses its first frame. Two interrupted fingerprint states and five verify checks hold it; **this is the pattern for 69 and any other paged widget.** The probe: in an iframe, queue `requestAnimationFrame`, click step, pump 5 frames, click the other page's segment, pump 150, read the step label.
- **Nothing moves over a finished signature** (his round-2 ask): each forms beside W in its own lane, one at a time, and the verify sweeps rotated rectangles every 5 ms at three widths and ranks 2 to 6. Every press starts on the last one's final frame, op for op. Keep both passing through any change to the choreography.
- **Page 1 declines Play and has four presses** (the arrival, the fold to the pyrimidine, the split into grids, the line-up); page 2 three (Extract, the signatures, each opened with its exposures); page 3 extracts at once if page 2 has not, then compares as a scan of the chosen row.
- **The 01-4 notebook does not link to it yet** (prd §4 says how). Findings 5 to 7 in the catalogue's § *What the lesson's own output says* are 01-4's, and his to fix.

## Slot 69 `driver-genes` — shipped 2026-09-18 (`d411b2c`)

"Cancer Driver Genes" for PHM5003 07 / 01-3 cells 12–25: *One gene* · *The cohort*. The catalogue's § *Slot 69* has the measurement, the mock, every round and the ship.

**Things the next session must know about this widget:**

- **Its link words are public now:** `page=gene|cohort`, `gene=oncogene|suppressor|small|passenger`, `across=fraction|score`, `kinds`, `seed`, `shown`. Renaming one breaks shared links.
- **The engine is maftools' `oncodrive`, ported line for line with its quirks** (`model.js`): the residue threshold is a POINT probability, a residue below the threshold inside a cluster is scored but not counted into its N, and tied peaks recycle in R's row order. It is held to `_lab/driver-genes-reference.tsv` — 360 synthetic genes scored by maftools itself through `_lab/driver-genes-reference.R`, reaching every branch — so the repo carries no TCGA rows. maftools 2.26.0 is installed in the R user library on his approval.
- **Everything on the stage is simulated and calibrated to the lesson's MAF counted once per tumour.** `SHAPES` holds nine drivers with their real lengths, counts, truncating shares and hotspot residues; `GENOME` is fitted to the file's gene count, length and rate spread. A driver needs the passengers' own residue mutability or it scores far below its gene.
- **`shown` opens whichever page it is given with, and leaves the other empty.** The anim carries TWO counters — `stage` for page 1 and `cohort` for page 2 — each with its own tween clock, because the page is a display parameter and a display change resets nothing.
- **Page 2's y scale tops at −log₁₀ p, not −log₁₀ FDR** (`cohortTop`), so the correction can be drawn against ticks that do not move; the pre-correction cloud stays as a ghost at 0.16 alpha.
- **The cohort is cached by seed** (six entries, `cohortFor`), because it is 18,251 genes and core reruns `compute()` on a display change too. `compute()` stays pure: the cache is keyed on the one parameter the cohort reads.
- **Page 1 declines Play** (`runLabel: null`) and page 2 is driven by the same step button, whose labels are keyed `0`…`5` and `c0`…`c4` on `anim.labelAt`.
- **The mid-press page switch is FIXED (`88d7929`, 2026-09-20)**, with the Across sibling nobody had seen: an Across change on the cohort page hands the loop to the ease, which fast-forwards nothing, so a press in flight stayed where it stopped and the reader's next press was spent finishing it. `rebuild` finishes the press (`finishPress`) and sets `halt` on a page switch; five verify cases, three INTERRUPTED states. The catalogue's § *The mid-press page switch, fixed 2026-09-20* has it, with the sweep it started.
- **Open, not raised by him:** the **Across** control's own options ellipse at a rail narrow enough to stack — it is a two-option ROW, which the grid fix of 2026-09-18 does not reach. The same one-line remedy would.
- **The 01-3 notebook does not link to it yet** (prd §4 says how). The catalogue's § *What the lesson's own output says* lists findings 9–11, which are his to fix.

## Slot 67 `tumor-heterogeneity` — shipped 2026-09-17 (`93f2d6d`)

"Tumor Heterogeneity" for PHM5003 07 / 01-2 cells 17–25: *One mutation · Many mutations · Clonal architecture*. The catalogue's § *Slot 67* has what shipped, how it was verified (16 states, 196 verify checks, the suite 815 of 815 at the time), and every round.

**Things the next session must know about this widget:**

- **Its link words are public now:** `page=one|many|clonal`, `purity`, `ccf`, `state=1+1|2+0|1+0|2+1|3+1`, `copies`, `depth`, `knows=nothing|purity|both`, `clones=one|two|three`, `mutations`, `axis=vaf|ccf`, `assumed=nothing|purity`, `clusters`, `taken=1|2|4`, `tree=linear|branching`, `showcells`, `seed`, `all`. Renaming one breaks shared links.
- **Every knowledge level uses one method** (`scenariosFor` in `model.js`): enumerate the mutated copies, solve the fraction, keep what is at most 1. The assumed levels enumerate over the TOTAL, because a total of 2 cannot tell 1 + 1 from 2 + 0; only the given level caps the count at the chromosome the mutation arose on. Changing one level alone turns the others into straw men.
- **The panel, the tile and the card read what the analysis is given, never the sample the reader built.** `reportedScenario` preferred the built sample and put 1.00 beside *Cannot tell*; it is gone. The tile reads the span of what fits (`fractionSpan`), and the card inverts the model for each fitting multiplicity.
- **The call's threshold, 0.9, is the widget's own number** (`CUT`; the lesson says only "≈ 1"). The call is the same anywhere from 0.80 to 0.95, because the fraction control offers 0.25–1.00, so no mutation can be built sitting on the line.
- **Page 3's numbers are read off `cancer-retcher.png`**, means and error bars alike, at 0.0017 CCF a pixel. Two bars are upper bounds and one lower half is mirrored; `SAMPLES` in `model.js` says which. `JOIN_ORDER` puts the surgery sample first while the samples still draw in time order. Restoring the figure's order makes the sample control inert again.
- **The cells' geometry is solved, not tuned** (`cellMarks`, `cellGrid`). The copies the mutation can sit on are solid and the other chromosome's are dashed (his pick D). A somatic mutation arises on ONE chromosome, so the mutated-copies control is a dynamic-options choice (`optionsFrom: "state"`).
- **Three tweens, and one deliberate non-tween:** page 2's axis eases through core's display-change door; page 2's bars morph on purity, depth and mutation count (bar heights, not mutations, because depth re-deals the stream); page 3's tree glides on one scalar. The VAF bar is not eased.
- **The 01-2 notebook does not link to it yet** (prd §4 says how). The catalogue's § *What the lesson's own output says* lists what the lesson prints wrongly; those are his to fix.

## Slot 62 `augmentation` — shipped 2026-09-16, the Classification task shipped 2026-09-17 (`ea9426e`)

"Deep Learning - Image Augmentation" for PHM5005 06-2 and 06-3: **Task** (Classification · Segmentation) over two pages, Transforms · Pipeline. The catalogue's slot 62 entry has what shipped, how it was verified, and every round through *SHIPPED 2026-09-17*; what follows is still true and still owed.

- **Classification is the default**, so the gallery opens on it and a Segmentation link carries `task=segmentation`. Task is a data control above Topic: it changes the Pipeline list, as Split does, so switching it starts the page over. Every fingerprint state names its task, so a later change of default moves no state.
- **Under Classification the label is a class, and the page shows it as one.** `6 (neutrophil)` (BloodMNIST's label map; 06-2 cell 14's title form) sits in the mask's row, each call writes `keys=["image"]`, no outline is drawn, and White blood cell is hidden (`placeOf` draws the off-centre cell). Both claims were run on MONAI 1.6.0: a class label in keys raises on every spatial line, and cell 19 with `keys=["image"]` and no `AsDiscreted` runs, caches the same lines, and keeps the label an int. **No lesson writes that eleven-line pipeline out;** it is cell 19 with the rule the Transforms page shows.
- **`LINES` is the one master list.** A pipeline state carries `list` (the indices it shows), `last` (the line that ends an epoch) and `classify`, and `callOf(i, classify)` writes each call. The list area keeps twelve rows under both tasks: at eleven, the call under the list reached the row of the note under the sample.
- **The twelve samples sit under the figure on every Transforms page** (`bandLayout(…).samples`), with Affine's ranges, Contrast's γ curves and Noise's σ band below them, each band carrying the tally.

- **The reader argument is in his notebook, and the widget's wording does not depend on it.** Kenneth added `reader="PILReader", reverse_indexing=False` to both `LoadImaged` lines of cell 19 on 2026-09-17, with an explanation (his report: the Master copy under Downloads predates it). Measured that day (`_lab/augmentation-reader-plots.py`, `-choice.py`, `-cell19.py`): relative to what cell 27 plots, `spatial_axis=0` flips top to bottom, `Rotate90` k = 1 turns counter-clockwise, a positive affine rotate turns clockwise, and translate reads (height, width) under BOTH reader orders; the argument decides only whether the plots equal the saved files. The 2026-09-16 note that the wording "holds only with that argument" overstated it. MONAI swaps a 2D image's axes by default to match its medical-volume readers, indexed [x, y, z]; keep the default for NIfTI and DICOM. For 2D image files, name the reader with the flag: `reverse_indexing=False` means rows first on `PILReader` but is the width-first default on `ITKReader`, and with only Pillow installed a `.tif` finds no reader unless it is named. His revised cell 19 and `show_image_label` were run on a non-square image: both lists load `[C, H, W]`, the plots equal the files, and image and mask stay aligned.
- **The lesson's JPG masks are unmeasured.** Nothing rescales the label before `AsDiscreted(threshold=0.5)`, so on a 0–255 JPG mask any compression value of 1 or more becomes foreground (+25.0% to +33.8% on a synthetic disc); KRD-WBC's own masks were not read. Told to him 2026-09-15.
- **The engine restates MONAI's arguments in file axes in one place**, `fileOp(op, order)` in `widgets/augmentation/engine.js`. **The MONAI trap the pin caught:** `RandAffined`'s parameters readable after a call are a second, unapplied draw; read `rand_affine_grid.get_transformation_matrix()`.
- **The page's height must not depend on the canvas width between 535 and 770 px.** The Noise page never settled under the harness's scrollbar (255 px panels made the document 1,211 tall, the scrollbar narrowed the canvas to 535, the document fell to 1,200, the scrollbar went) until the panel and thumbnail sizes were capped at their 535 px values in `figureLayout`, `thumbSize` and `pipelineLayout`. The verify asserts one height at 535, 550, 755 and 770. Any widget whose height reads its width can do this; the shooter says NEVER SETTLED.
- **Its link words are public now:** `task=classification|segmentation`, `topic=pipeline`, `transform=flip|rotate|affine|contrast|noise`, `keys=image`, `cell=off-centre|centred`, `mode=bilinear`, `split=validation`, `translate_height`, `translate_width`, `scale_height`, `scale_width`, and the `*_prob`, `gamma_low`, `gamma_high` and `std` slots. Renaming breaks shared links.
- **Neither 06-2 nor 06-3 links to it yet** (prd §4 says how). A link from 06-2 needs no task word; one from 06-3 needs `?task=segmentation`.

## Open across the collection, none blocking

- **Core gap, not a widget's:** Reset does not rebuild a gated control block (`cnn-architecture`, `power-and-error`). The section and its control stay in the DOM after Reset while the parameter, the URL and the figure reset. A `widget.js` reset-path fix, and a full suite run when taken.
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
- **The shooter:** copy the newest `_lab/*-shoot.html` (now `mutational-signatures-shoot.html`, copied 2026-09-19 from `driver-genes-shoot.html`, which was built from the current harness functions, and counting every moment the document was hidden; an older copy can predate a branch of `setParam` and hash a state the drive never reached). It proves the copy against known states first, shoots each state three times, and checks every driven state against its settled sibling. **Re-recording a shipped widget,** give each state the change cannot reach its recorded hashes instead of `"0"`: the newest copy reports whether each one reproduced. Two traps: it reads `$note` unguarded and some states have none, so guard it (`$note ?? ""`); and its output is written only at the end, so an empty page mid-run is normal.
- **The scrollbar flake:** a `px`-only DIFFER on a tall page, `tx` matching and the row hashed at 688 where the baseline holds 669, is the scrollbar until that widget's shooter run alone says otherwise. Do not rebaseline it. A DIFFER on BOTH hashes with identical hashes across runs is something else (t-sne, 2026-09-10: proven environmental by running the harness on the last all-green commit from a detached worktree). And a ship claim that reads "all N of the new widget's states MATCH" is not a full-suite claim; read the DIFFER count.
- **Screenshots come back black once the page is scrolled:** shift `document.body.style.marginTop` instead of scrolling. The pane's screenshot is 800 px wide. Trust DOM reads over screenshots; under `resize_window`, clicks by `ref` can land off target, while DOM `.click()` and dispatched PointerEvents are reliable.
- **Python:** `python` is 3.12 at `%LOCALAPPDATA%\Programs\Python\Python312`, with numpy 2.5.2, scikit-learn 1.9.0, Pillow 12.3.0, torch 2.14.0+cpu and MONAI 1.6.0. Two of three torch error strings quoted from memory were wrong (2026-09-11). **A blocked network call is a question for Kenneth** (SimpleWall prompts), not a constraint to build around.
- **Subagents** (the block from 49 below has the cost): name geometry in a brief, not topology, and say so when a pick needs core. Commit before every subagent round; one ran `git checkout` on the baseline file and lost uncommitted states.

## Things learned, not yet in the principles

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

### From 55 `optimizers` (2026-09-11)

- **A copy audit has THREE passes, not one.** Register and lesson references
  are the first. The second is the collection's OWN VOCABULARY: card, rung,
  ladder, rail, stage, face, arm, pile, ramp, budget, arrivals, walk, well,
  plain, trench, frame — words that stop looking coined after a day in the
  catalogue. Kenneth caught "card" and "rung" in a control detail after the
  first pass had passed it ("i thought you already checked with the
  principles"). The third is OUTCOME COMMENTARY: a detail says what a
  control IS (a coordinate, a torch parameter, a pace, an instruction);
  it never says what will happen. The rate ladder's computed lines
  ("momentum 0.9 reaches the global minimum at step 45, Adam ends at the
  local minimum") were true, engine-built, and struck as editorializing
  ("sigh, again"). `_lab/optimizers-verify.mjs` greps every option and
  field line for outcome verbs; copy that guard into the next verify.
- **The textbook's nouns, when unsure, are put to him as options** — he
  chose *path* over *walk*, *update rule* over the bare *rule*, and asked
  for the subtitle "in terms of principles" with no method named. The
  optimizer's descriptor now sits ON THE FORMULA CARD under the update rule
  (his pick from `_lab/optimizers-card-mock.html`), and the rail carries
  only what is set and what the reader must do.

- **A chaotic cell exists and must never be a state.** RMSprop at lr 1 ends
  5.01 from the minimum in node and 1.81 in Chrome from the same code
  (`Math.exp` has no specified precision; one ulp is enough once a walk
  hovers). Every other cell reproduces. Any lr-1 state is proven over three
  shots like the rest.
- **Core sends only the drag's LAST declared parameter through `setParam`**,
  so the whole gesture takes that parameter's kind. A drag that must be
  display for one panel (the relief's `tilt`) and data for another (the
  marker's `x0`/`y0`) needs one deferred write through the data parameter on
  the next microtask (decision 5 in `widgets/optimizers/main.js`). Found by
  the builder; not a core change.

- **The relief renderer is now imported by two widgets** (`projector`,
  `reliefMesh`, `reliefPoint`, `reliefLift`, `reliefHidden`, `isoSegments`
  from `widgets/gradients/model.js`). A third relief is the moment to move
  them into `widgets/core/`, with the full suite run that entails.

### From 51 `composition` (2026-09-11)

- **Read `npm test`'s verdict on its own before a push, as `check`'s.** The
  ship commit `8b3602d` went up with one verify assertion failing (the
  script asserted the widget was a draft) because the push chain was
  conditioned on `check` and `test`'s line scrolled past. `2e9f7ba` fixed it
  in the next commit; the rule in this file about `check` applies to `test`.
- **The reveal rule (decision 14 in `composition/main.js`):** the next
  line's LAYER BOXES preview pale; operators, rails, bands, result edges and
  labels land only with their line (`preview: false` in `pageUnits`, the
  verify sweep reading the flag). Kenneth arrived at it in three comments
  ("downstream shouldn't be shown at the beginning", "the projection is
  shown before its line", "downstream + and arrows occur prematurely"); a
  new walk-driven widget should start there.
- **Every option must reach an output where torch accepts it.** Branching
  shipped with fc3 fixed at the notebook's `Linear(14, 2)`, so five of six
  merge × width combinations raised; he asked that they work "unless there
  is an intention of demonstrating the shapes", and fc3 now follows the
  merge. A "case that fails" is one case, not most of the grid.
- **A page without a figure for its control is a question.** Skip had a
  Sample control driving only the readout's digits; he asked "do we need
  it?", and the bands the plan had always listed were added.
- **The whole tensor, not one row.** Routing's box first showed the chosen
  sample's row per branch (his pick C); he then asked how to explain a
  `[4, 20]` branch showing one row and chose the full `[4, 20]` product
  bands (D). When the sibling pages draw whole tensors, draw the whole
  tensor.
- **An accidental click is undone at once**: he picked Ordering's C by
  mistake, said so, and the C build was stopped before it wrote anything.
  Ask "was that your pick?" only when he does; otherwise build.
- **A draft owes no fingerprint states** (`check.mjs:337` filters drafts),
  so the draft can be committed to `main` and pushed under `/lab/` without
  baselining; the states come at "tested ok".
- **The shooter's driven states need enough frames to pass a beat**: 14
  frames at 32 ms is 448 ms, under the 700 ms Medium beat, and a widget
  whose walk is a step function of the beat draws the empty page at 14.
  Composition's driven states use 30; the hit-driven ones run Play for 200
  frames first because `regions` return nothing before their line lands.

### From 50 `support-layers` (2026-09-10)

- **A build that needs core stops and asks, and he says yes to a small one.**
  Row 18 of 50's audit (the Activation step label keyed on `use`) needed
  `resolveLabel` to nest; put to him as one click against the no-core option,
  he took the six lines. A drive label entry may now itself be
  `{ param, labels, default }` (`widgets/core/widget.js`, `resolveLabel` and
  `labelSet`). The rail is not hashed, so a label change is verified by reading
  the button's text on the pages that key one (`bayesian`, `balancing-data`).

- **His questions between rounds are planning input.** Asked whether
  sigmoid, softmax and cross-entropy are layers, the answer from 05-3 cell
  1/70 and 05-4 cells 23–40 became slot 54 `loss-functions` (PROPOSED,
  unmeasured, three pages by task from 05-4 cell 30's table, the −log p curve
  shared) on his "ok add it to the catalogue". It waits for the arc to reach
  05-4; slot 52 `training-loop` links to it rather than drawing a loss's inside.

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

### From 48 `gradients` (2026-09-08)

- **A depth buffer painted through the canvas is wrong by tens of grey
  levels**; hidden-line on a height field is a ray march (`reliefHidden`
  in `model.js`). **The viewpoint is measured, not chosen**: swept over
  azimuths, since a log-height loss lies in a canyon visible only along it.
- **Choreography that re-evaluates at the moving point** ("the tangent
  translates") reads as broken; the tangent rolls with the curve.
- **URL values are copy** (5.9): `scale=std` and `nudge=` shipped as
  build shorthand and were renamed to `standardized` and `da` before
  the first link was pasted.

### From 45 `hmm` (2026-09-06)

- **`.w-math-eq` carries an 8.3em hanging indent** written for widget 14's
  sum. On a prose card it has nothing to hang from and every wrapped line
  restarts a third of the way across. Widget 40 and now 45 override it
  inline with a label gutter; a new prose card must too.
- **A `choice` control drops the field's `detail`** and shows the selected
  option's — put the detail on every option.
- **A `gate` hides the drive row while shut**, so a two-way display switch
  that must keep Step/Play alive is a `segmented`, not a gate.
- **`check` fails the word "notebook" on any reader-facing string** (2.10);
  say "the worked example".
- **The driver stubs `mathmlRenders` to false**, so a card's MathML path is
  exercised only in the browser; the import regex in `hmm-drive.mjs`
  expects the exact `import { defineWidget, fmt, mathmlRenders }` line.

### From 44 `experimental-design` (2026-09-05)

**HOW THE ANIMATION WORK WAS CHECKED, because screenshots cannot do it.** Patch
`requestAnimationFrame` into a queue, click the drive button, pump the queue on
a fixed clock, and sum `globalAlpha` over the marks painted in a y-band each
frame. Ink per frame is the metric: **counts mislead**, because they flip when a
mark crosses an alpha threshold. Before the fixes the Sampling band read
`154,154,154 | 194,194,193.7,...` against a strip reading `51,51,51.8 | 9,9,9.3`
— a 40-mark step in one frame. After, both are flat to under 3%. The Replicate
band now steps **0.0** between frames after the first study.

Roughly twenty rounds, and Kenneth said plainly that some of it was waste. The
three that cost the most, all avoidable:

- **The transpose, twice.** He asked for bars showing *of the females, how many
  have the disease* and got bars showing *of each group, how many are female* —
  the same numbers answering a different question. He had to sketch it before it
  landed. **When he describes a figure, draw what he describes, not what you
  think it means.**
- **Silent substitution.** He picked C3 and got D3's counts instead, on the
  argument that they carried the same information. They did; a bar is a picture
  and a count is arithmetic, which is why he asked for a bar. **If a pick cannot
  be built as picked, say so — do not deliver something else.**
- **Prose.** He asked three times for shorter answers and standard vocabulary,
  and a whole round went on removing invented phrases — *carrier*, *carries it*,
  *everyone*, *this study*, *called a difference*. The one that finally stuck is
  now a `check`, not a guideline.

### From 43 `enrichment` (2026-09-05)

1. **A metric choice needs a stage that can LOSE.** The obvious ranking-metric
   design — add the control to the old constant-shift stage — was measured and
   discarded: signed significance came out strictly better (86% against 92% at
   moderate noise spread, 65% against 98% at high), because a constant shift is
   exactly what a t-test is built to detect. It would have taught that
   sophistication removes the arbitrary choice. The fix was two KINDS of planted
   pathway, loud and quiet, so each metric wins on one. `_lab/enr-metric.mjs`.

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

### From the URL rename (2026-09-05)

- **A rename must be grepped through `_lab/`, not just through the widget: the scripts are callers too.** The 2026-09-05 URL rename moved a scheme key and `_lab/design-measure.mjs` kept the old one, printing another scheme's numbers under the renamed heading with nothing to say so. `model.js` now throws on an unknown scheme, so the next stale caller fails loudly.

**HOW IT WAS GATED, and the method is reusable.** `main` was served from a
detached worktree (`git worktree add --detach <scratchpad>/main-base main`,
outside Dropbox; `serve.mjs` roots at its own file, so running the worktree's
copy serves the worktree) and the branch from the repo, and the suite was run
on both in the same browser pane at DPR 1.25. Branch: **All 334 states
identical** to the committed baseline, every row hashed at the 1.25 canvas
size. Main, same pane: 9 px-only DIFFERs on naive-bayes, lm-adjustment and
roc-auc — the scrollbar flake set — and widget 44's ten MATCH. So the change was
rendering-neutral by two independent readings, and the branch was merged
`--no-ff` with that record in the merge message.

### From 42 `hierarchical-clustering` (2026-09-03)

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

### From the linear-model arc, 26–30 (2026-08-27/28)

- **Two arc-wide conventions the linear-model sessions settled, worth reusing:** **eased values lerp the model and every printed number is computed from the LERPED coefficients** (no label is false mid-frame), and **a hit-driven state that performs an instant param flip runs zero frames and still must differ from its bare URL** — that difference is the region geometry proven.

### From recording widgets 22–24's placeholder states (2026-08-26)

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

## Core doors widgets have added

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

**Give `fingerprint.html` an `?only=<slug>` filter.** It always runs every state,
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

*The harness has no way to run a subset, which is what makes the loop above
necessary. A `?only=<slug>` filter on `fingerprint.html` would remove the need
for it and is a small, obvious change nobody has made.*

> *Earned three times.* `bootstrap` was baselined three times over. Widget 11
> changed shape in six of eight review rounds. Widget 12 went thirteen rounds.

`npm run check` fails a **non-draft** widget with no fingerprint states, which is
the escape hatch: leave it `draft` while the design moves.

If a state legitimately changes, regenerate the baseline **in the same commit**
as the change, so the diff records that the rendering moved.
