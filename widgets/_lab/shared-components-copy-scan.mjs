// Slot 99 copy audit (2026-10-10): every reader-facing string, scanned against the claudisms.ai
// banlist (a local copy, path as argv[2]) and the project's own register rules (memory: never,
// second person, personification, outcome commentary, our coined words, lesson references).
//   node widgets/_lab/shared-components-copy-scan.mjs <claudisms.md> [--all]
// As 98's scan: evaluates the widget's own declarations (S, the press labels and titles, the
// formula card notes) rather than matching literals by regex, calls every string function with
// sample values, and adds the literals that live in draw/readout/legend, the manifest card and
// the page's meta description.
import { readFileSync } from "node:fs";
import { SUBTYPES, Y, BLOCKS, PAIRS } from "../shared-components/data.js";

const md = readFileSync(process.argv[2], "utf8");
const terms = [];
for (const l of md.split("\n")) {
  const m = l.match(/^- \*\*(.+?)\*\*/);
  if (m) m[1].split(" / ").forEach((t) => terms.push(t.trim().toLowerCase().replace(/^["“]|["”]$/g, "")));
}

const src = readFileSync(new URL("../shared-components/main.js", import.meta.url), "utf8");
const block = src.slice(src.indexOf("const PAGES = ["), src.indexOf("let mathHost = null"));
const { S, MATH, PAGES, AFTER, AFTER_TITLE, N_LABELS, N_TITLES, F_LABELS, F_TITLES, P_LABELS, P_TITLES, FIND_TITLE } = new Function(
  "SUBTYPES", "Y", "BLOCKS", "PAIRS", "mathmlRenders",
  `${block}; return { S, MATH, PAGES, AFTER, AFTER_TITLE, N_LABELS, N_TITLES, F_LABELS, F_TITLES, P_LABELS, P_TITLES, FIND_TITLE };`,
)(SUBTYPES, Y, BLOCKS, PAIRS, () => true);

const strs = [];
const sample = (v) => {
  const n = v.length, args = { 0: [], 1: ["mRNA"], 2: ["0.42, 0.91", "0.48, 0.88"], 3: [1, ["0.24", "0.45"], ["0.48", "0.88"]], 4: [1, ["0.24", "0.45"], ["0.48", "0.88"], "0.51"], 5: ["Subtype 1", "mRNA", "0.12", "Methylation", "0.30"] }[n];
  return String(v(...args));
};
const walk = (v, key) => {
  if (key === "math") return;
  if (typeof v === "string") strs.push(v);
  else if (typeof v === "function") strs.push(sample(v));
  else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
  else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => (k === "param" || k === "anim" ? null : walk(x, k)));
};
walk(S);
walk(MATH);
walk([PAGES.map((p) => p.label), PAGES.map((p) => p.group), AFTER, AFTER_TITLE, Object.values(N_LABELS), Object.values(N_TITLES), Object.values(F_LABELS), Object.values(F_TITLES), Object.values(P_LABELS), Object.values(P_TITLES), FIND_TITLE]);
strs.push("low value", "high value", "stacked into one table", "two tables", "sample 62 in mRNA", "row of sample 62", "E", "t", "X₂", "≈", "=");
strs.push(...SUBTYPES);
const title = src.match(/title: "([^"]+)"/)[1], credit = src.match(/credit: "([^"]+)"/)[1];
const man = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8")).widgets.find((w) => w.slug === "shared-components");
const meta = readFileSync(new URL("../shared-components/index.html", import.meta.url), "utf8").match(/name="description" content="([^"]+)"/)[1];
strs.push(title, credit, man.blurb, meta);
const uniq = [...new Set(strs)].filter((s) => /[a-z]/i.test(s));

const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hits = [];
for (const s of uniq) {
  const l = s.toLowerCase();
  for (const t of terms) if (t.length > 2 && new RegExp(`\\b${esc(t)}\\b`).test(l)) hits.push([t, s]);
}
console.log(`claudisms: ${terms.length} terms, ${uniq.length} strings, ${hits.length} hits`);
hits.forEach(([t, s]) => console.log(`  "${t}" :: ${s.slice(0, 140)}`));
const ours = /\b(never|you|your|carr(y|ies)|compares?|reads? off|comes? from|chose|choose|waits?|reach(es)?|sits?|stands?|points?|freed|route around|finds?|shows?|misses|missed|settles?|appears?|lands?|walks?|rung|card|pile|arm|face|stage|hole|holes|lanes?|pieces?|sweep|blank|passes|moves?|reads|stretched|holds?|ends at|serves?|leaves?|keeps?|gives?|needs?|lesson|notebook|cell|benchmark|arbitrary|shortcut|rebuild|kept|expl\.)\b/i;
console.log("\nproject rules:");
for (const s of uniq) { const m = s.match(ours); if (m) console.log(`  ${m[0]} :: ${s.slice(0, 170)}`); }
if (process.argv[3] === "--all") { console.log("\nall strings:"); uniq.forEach((s) => console.log(`  ${s}`)); }
