# Archive

Full copies of the working documents as they stood before a compaction, so that
trimming HANDOVER never loses anything.

| file | taken at | why |
|---|---|---|
| `HANDOVER-2026-08-26.md` | commit `235ffca`, 2026-08-26 | HANDOVER had reached 152 KB and 2,874 lines, most of it per-widget histories for widgets 14–20 that [the catalogue](../catalogue.md) already holds. The live file was cut to the things a new session must act on; this is what it looked like before. |
| `catalogue-2026-08-26.md` | commit `235ffca`, 2026-08-26 | Taken at the same moment so the two can be read against each other. The live catalogue was **not** cut — see below. |

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
