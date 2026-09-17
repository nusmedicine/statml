# Archive

Full copies of the working documents as they stood before a compaction, so that
trimming HANDOVER never loses anything.

| file | taken at | why |
|---|---|---|
| `HANDOVER-2026-08-26.md` | commit `235ffca`, 2026-08-26 | HANDOVER had reached 152 KB and 2,874 lines, most of it per-widget histories for widgets 14–20 that [the catalogue](../catalogue.md) already holds. The live file was cut to the things a new session must act on; this is what it looked like before. |
| `catalogue-2026-08-26.md` | commit `235ffca`, 2026-08-26 | Taken at the same moment so the two can be read against each other. The live catalogue was **not** cut — see below. |
| `HANDOVER-2026-09-16.md` | commit `72b6f83`, 2026-09-16 (byte-identical to HANDOVER.md there) | HANDOVER had grown back to 238 KB and 3,528 lines, most of it per-widget session records for widgets 22–65 that the catalogue already holds. The live file was cut to 1,627 lines: current state, the order of work, the machine, the lessons not yet in the principles, the open items, and the reference sections that CLAUDE.md, README, `scripts/` and the `_lab/` comments point at. The catalogue was not cut and not copied. |
| `HANDOVER-2026-09-17.md` | commit `93f2d6d`, 2026-09-17 (byte-identical to HANDOVER.md there) | Taken at the close that shipped widget 67, a day after the cut above, so the second cut was small: 1,651 lines (113 KB) to 1,464 (108 KB). Out of the live file: slot 62's what-shipped and review record (the catalogue holds both), the history behind *Working on Windows* and the DPR section (each diagnosis kept, how it was found cut), widget 15's marginal-vs-conditional item, moot since 2026-08-29, from both places it was listed, a paragraph recording a closed audit, and a duplicated line on `composition`. Every section another file names was kept. |
| `HANDOVER-2026-09-17b.md` | commit `ea9426e`, 2026-09-17 (byte-identical to HANDOVER.md there) | Taken at the day's second close, which shipped widget 62's Classification task: 1,466 lines to 1,433. Out of the live file: slot 67's what-shipped and verification paragraphs (the catalogue has both); the in-review block for widget 62's task, replaced by what is still true of it; the particulars of the MR, PRS and 01-2 notebook text written for Kenneth (the decisions and the repo consequences kept); and the lesson-link and projection clauses repeated under each open item, now said once, with the two `tensors` blocks merged. In: the closing state, widget 62's current notes and link words, the visibility log for the suite, the shooter's recorded-hash check, and the day's lessons. Every section another file names was kept. |

## Why the catalogue was not compacted

CLAUDE.md calls the design record *"the most valuable thing"* in the repo, and
the catalogue is deliberately redundant: it keeps sections marked
`SUPERSEDED BY ROUND ONE` rather than deleting them, so a later reader can check
an answer against what was assumed. Cutting that is not compaction, it is
deleting the record. It gained a table of contents instead.

**HANDOVER is the one that duplicates.** It is meant to be current state and the
next task; it had grown a parallel history of every widget since 14. Those
sections are in this archive and in the catalogue, and the live file points at
both.

## Reading an archived copy

Nothing here is loaded by anything — no script reads `docs/archive/`, and
`npm run check` ignores it. It is for a human who wants to know what a decision
looked like before it was summarised. Prefer the catalogue first: it is the
maintained record and it is organised by widget.
