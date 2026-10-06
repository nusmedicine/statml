/* ============================================================================
   The attribution every widget page carries, at the right end of the Copy
   link row (Kenneth, 2026-10-06; `_lab/attribution-mock.html`).

   One line, written here once. A widget changes it through `defineWidget`:
     attribution: "…"   replaces the line — a widget someone else wrote or co-wrote
     credit: "…"        keeps the line and names a source after it, " · Data: …"
   Two forms rather than one because a replace-only override would make every
   widget that cites a source restate this line, and restated copies drift.

   Its own module so scripts/check.mjs can import it in node: the gallery and
   the lab page are served verbatim and cannot import core, so they carry the
   text written out, and check asserts it matches this.

   At the END of the row and not on a line of its own, measured on all 77
   widgets in the fingerprint harness's 900 × 1200 frame: in the row it adds no
   height to any page; a line of its own would bring a scrollbar to two default
   pages and narrow their canvas.
   ========================================================================= */

export const ATTRIBUTION = "Kenneth Ban, NUS Medicine";

/** The line a widget shows: its own `attribution` or the common one, then its `credit`. */
export function attributionLine({ attribution, credit } = {}) {
  const base = attribution ?? ATTRIBUTION;
  return credit ? `${base} · ${credit}` : base;
}
