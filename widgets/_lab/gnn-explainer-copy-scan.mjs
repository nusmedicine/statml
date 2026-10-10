// Slot 98 copy audit (2026-10-10): every reader-facing string, scanned against the claudisms.ai
// banlist (fetched to a path given as argv[2]) and the project's own register rules (memory: never,
// second person, personification, outcome commentary, our coined words).
//   node widgets/_lab/gnn-explainer-copy-scan.mjs <claudisms.md>
// 97's scan matched string literals by regex and, on this file, the apostrophes inside double-quoted
// strings threw it into the code between them. This one evaluates the widget's own strings object `S`
// with stand-ins for the helpers it calls, calls every function with sample values, and adds the
// labels and canvas literals that live outside S, the manifest card and the page's meta description.
import { readFileSync } from "node:fs";
import { MOL, FEATURES, INFO } from "../gnn-explainer/data.js";

const md = readFileSync(process.argv[2], "utf8");
const terms = [];
for (const l of md.split("\n")) {
  const m = l.match(/^- \*\*(.+?)\*\*/);
  if (m) m[1].split(" / ").forEach((t) => terms.push(t.trim().toLowerCase().replace(/^["“]|["”]$/g, "")));
}

const src = readFileSync(new URL("../gnn-explainer/main.js", import.meta.url), "utf8");
const block = src.slice(src.indexOf("const S = {"), src.indexOf("\n};\n", src.indexOf("const S = {")) + 3);
const NF = FEATURES.length, NB = MOL.bonds.length, NR = 20;
const f2 = (v) => v.toFixed(2);
const atomName = (i) => `${MOL.atoms[i][0]}${i}`;
const bondName = (b) => `${atomName(MOL.bonds[b][0])}–${atomName(MOL.bonds[b][1])}`;
const S = new Function("MOL", "FEATURES", "INFO", "NF", "NB", "NR", "f2", "atomName", "bondName", `${block}; return S;`)(MOL, FEATURES, INFO, NF, NB, NR, f2, atomName, bondName);

const strs = [];
const walk = (v, key) => {
  if (typeof v === "string") strs.push(v);
  else if (typeof v === "function") strs.push(String(v.length >= 3 ? v(10, 0.08, 0.96) : v.length === 2 ? v(10, 0.5) : v(0.09)));
  else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
  else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => (k === "param" || k === "anim" ? null : walk(x, k)));
};
walk(S);
strs.push("Mask", "Scores", "Runs", "One run", "All runs", "dropped", "kept", "run 20 of 20", "kept by 20 of 20 runs");
strs.push(...FEATURES);
const title = src.match(/title: "([^"]+)"/)[1], credit = src.match(/credit: "([^"]+)"/)[1];
const man = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8")).widgets.find((w) => w.slug === "gnn-explainer");
const meta = readFileSync(new URL("../gnn-explainer/index.html", import.meta.url), "utf8").match(/name="description" content="([^"]+)"/)[1];
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
const ours = /\b(never|you|your|carr(y|ies)|compares?|reads? off|comes? from|chose|choose|waits?|reach(es)?|sits?|stands?|points? the|freed|route around|finds?|shows?|misses|missed|settles?|appears?|lands?|walks?|rung|card|pile|arm|face|stage|hole|holes|lanes?|pieces?|sweep|blank|passes|moves?|reads|stretched|holds?|ends at)\b/i;
console.log("\nproject rules:");
for (const s of uniq) { const m = s.match(ours); if (m) console.log(`  ${m[0]} :: ${s.slice(0, 150)}`); }
if (process.argv[3] === "--all") { console.log("\nall strings:"); uniq.forEach((s) => console.log(`  ${s}`)); }
