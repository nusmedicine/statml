/* ============================================================================
   Deployed-site constants. One line, its own file, for a specific reason.

   `widget` is the published URL namespace and `widgets/` is the source
   directory. That single name is needed in three places — build.mjs renames the
   directory into _site/, serve.mjs aliases the same rename so dev and production
   address a widget identically, and index.html links into it — and a name in
   three places drifts. Widget heights used to live in three files and did drift;
   the check that caught it is recorded in CLAUDE.md, along with the rule that a
   second copy must not appear without a check to guard it.

   Two of the three import this. index.html cannot (it is served verbatim, and
   templating it would mean a build step for the one thing in this repo that
   deliberately has none), so check.mjs asserts it agrees.
   ========================================================================= */

/* The URL segment widgets are published under: /statml/widget/<slug>/.
   Renaming this changes every published lesson link. It is deliberately
   singular — `.../widget/clt/` reads as "the widget: clt". */
export const PUBLIC_DIR = "widget";
