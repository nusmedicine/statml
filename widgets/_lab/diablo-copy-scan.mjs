// Slot 100 copy audit (2026-10-10): every reader-facing string, scanned against the claudisms.ai
// banlist (a local copy, path as argv[2]) and the project's own register rules (memory: never,
// second person, personification, outcome commentary, our coined words, lesson references).
//   node widgets/_lab/diablo-copy-scan.mjs <claudisms.md> [--all]
// As 99's scan: evaluates the widget's own declarations (S, the press labels and titles, the
// formula card notes) rather than matching literals by regex, calls every string function with
// sample values, and adds the literals that live in draw/readout/legend, the manifest card and
// the page's meta description.
import { readFileSync } from "node:fs";
import { SUBTYPES, Y, FEATURES, KEEPX, SWEEP, SELECT, PREDICT, PLS_R } from "../diablo/data.js";

const md = readFileSync(process.argv[2], "utf8");
const terms = [];
for (const l of md.split("\n")) {
  const m = l.match(/^- \*\*(.+?)\*\*/);
  if (m) m[1].split(" / ").forEach((t) => terms.push(t.trim().toLowerCase().replace(/^["“]|["”]$/g, "")));
}

const src = readFileSync(new URL("../diablo/main.js", import.meta.url), "utf8");
const block = src.slice(src.indexOf("const PAGES = ["), src.indexOf("let mathHost = null"));
const { S, MATH, PAGES, SEL_LABELS, SEL_TITLES, PRE_LABELS, PRE_TITLES, FIT_TITLE, D_LABELS, D_TITLES } = new Function(
  "SUBTYPES", "Y", "FEATURES", "KEEPX", "SWEEP", "SELECT", "PREDICT", "mathmlRenders",
  `${block}; return { S, MATH, PAGES, SEL_LABELS, SEL_TITLES, PRE_LABELS, PRE_TITLES, FIT_TITLE, D_LABELS, D_TITLES };`,
)(SUBTYPES, Y, FEATURES, KEEPX, SWEEP, SELECT, PREDICT, () => true);

const strs = [];
/* a string function called with sample values; one taking a list gets a list */
const sample = (v) => {
  const strArgs = ["0.1", "0.96", "46%", "0.98", "5%"].slice(0, v.length);
  try { return v(...strArgs); } catch { return v(["HIF3A", "L1CAM"]); }
};
const walk = (v, key) => {
  if (key === "math") return;
  if (typeof v === "string") strs.push(v);
  else if (typeof v === "function") walk(sample(v));
  else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
  else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => (k === "param" || k === "anim" ? null : walk(x, k)));
};
walk(S);
walk(MATH);
walk([PAGES.map((p) => p.label), PAGES.map((p) => p.group), Object.values(SEL_LABELS), Object.values(SEL_TITLES), Object.values(PRE_LABELS), Object.values(PRE_TITLES), FIT_TITLE, Object.values(D_LABELS), Object.values(D_TITLES)]);
/* literals in draw, legend and regions */
strs.push("Design matrix", "mRNA", "meth", "Y", "kept gene", "not measured", "test tumour 12 in mRNA", "sample 3 · Subtype 1", "CN_HIGH · mRNA 1.20 · methylation 0.98");
strs.push(...SUBTYPES);
const title = src.match(/title: "([^"]+)"/)[1], credit = src.match(/credit: "([^"]+)"/)[1];
const man = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8")).widgets.find((w) => w.slug === "diablo");
const meta = readFileSync(new URL("../diablo/index.html", import.meta.url), "utf8").match(/name="description" content="([^"]+)"/)[1];
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
const ours = /\b(never|you|your|carr(y|ies)|compares?|reads? off|comes? from|chose|choose|waits?|reach(es)?|sits?|stands?|points?|freed|route around|finds?|shows?|misses|missed|settles?|appears?|lands?|walks?|rung|card|pile|arm|face|stage|hole|holes|lanes?|pieces?|sweep|blank|passes|moves?|reads|stretched|holds?|ends at|serves?|leaves?|keeps?|gives?|needs?|lesson|notebook|cell|benchmark|arbitrary|shortcut|rebuild|pulls?|pull|sliver|wins?|goes to|follows?|counts?|agree|agreed|trades?|places?)\b/i;
console.log("\nproject rules:");
for (const s of uniq) { const m = s.match(ours); if (m) console.log(`  ${m[0]} :: ${s.slice(0, 200)}`); }
console.log(`\nblurb ${man.blurb.length} chars (check's cap 120)`);
if (process.argv[3] === "--all") { console.log("\nall strings:"); uniq.forEach((s) => console.log(`  ${s}`)); }
