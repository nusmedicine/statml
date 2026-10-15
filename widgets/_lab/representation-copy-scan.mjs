// Slot 104 copy audit (2026-10-15): every reader-facing string, scanned against the claudisms.ai
// banlist (a local copy, path as argv[2]) and the project's own register rules (memory: never,
// second person, personification, outcome commentary, our coined words, lesson references).
//   node widgets/_lab/representation-copy-scan.mjs <claudisms.md> [--all]
// As 100's scan: evaluates the widget's own declarations (S, the press labels and titles, the
// formula card notes) rather than matching literals by regex, calls every string function with
// sample values, and adds the manifest card, the title, the credit and the meta description.
import { readFileSync } from "node:fs";
import { N_MAP, LABELS, KNN, TEST, MAPS, PICKS, CHECK } from "../representation/data.js";

const md = readFileSync(process.argv[2], "utf8");
const terms = [];
for (const l of md.split("\n")) {
  const m = l.match(/^- \*\*(.+?)\*\*/);
  if (m) m[1].split(" / ").forEach((t) => terms.push(t.trim().toLowerCase().replace(/^["“]|["”]$/g, "")));
}

const src = readFileSync(new URL("../representation/main.js", import.meta.url), "utf8");
const block = src.slice(src.indexOf("const PAGES = ["), src.indexOf("let mathHost = null"));
const { S, MATH, PAGES, TRAIN_TITLE } = new Function(
  "N_MAP", "LABELS", "KNN", "TEST", "MAPS", "PICKS", "CHECK", "mathmlRenders",
  `${block}; return { S, MATH, PAGES, TRAIN_TITLE };`,
)(N_MAP, LABELS, KNN, TEST, MAPS, PICKS, CHECK, () => true);

const strs = [];
const VIEW = { crop: [1, -1], translate: [0, -1], angle: -12.2, scale: 0.96 };
/* a string function called with sample values: an index and a view's parameters, else a page's test numbers */
const sample = (v) => {
  try { const r = v(3, VIEW); if (typeof r === "string" && !/undefined|NaN/.test(r)) return r; } catch { /* next */ }
  try { return v(TEST.autoencoder); } catch { return v(TEST.contrastive); }
};
const walk = (v, key) => {
  if (key === "math") return;
  if (typeof v === "string") strs.push(v);
  else if (typeof v === "function") {
    if (key === "play") for (const k of [0, 3, 6, 9]) strs.push(v(k));
    else walk(sample(v));
  } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
  else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => (k === "param" || k === "anim" ? null : walk(x, k)));
};
walk(S);
walk(MATH);
walk([PAGES.map((p) => p.label), PAGES.map((p) => p.group), TRAIN_TITLE]);
const title = src.match(/title: "([^"]+)"/)[1], credit = src.match(/credit: "([^"]+)"/)[1];
const man = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8")).widgets.find((w) => w.slug === "representation");
const meta = readFileSync(new URL("../representation/index.html", import.meta.url), "utf8").match(/name="description" content="([^"]+)"/)[1];
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
const ours = /\b(never|you|your|carr(y|ies)|compares?|reads? off|comes? from|chose|choose|waits?|reach(es)?|sits?|stands?|points?|freed|route around|finds?|shows?|misses|missed|settles?|appears?|lands?|walks?|rung|card|pile|arm|face|stage|hole|holes|lanes?|pieces?|sweep|blank|passes|moves?|reads|stretched|holds?|ends at|serves?|leaves?|keeps?|gives?|needs?|lesson|notebook|cell|benchmark|arbitrary|shortcut|rebuild|pulls?|pull|sliver|wins?|goes to|follows?|counts?|agree|agreed|trades?|places?|strip|frame|checkpoint|lives?|scramble[sd]?|carried|grows?|falls?|sharpens?|fills?)\b/i;
console.log("\nproject rules:");
for (const s of uniq) { const m = s.match(ours); if (m) console.log(`  ${m[0]} :: ${s.slice(0, 220)}`); }
console.log(`\nblurb ${man.blurb.length} chars (check's cap 120)`);
if (process.argv[3] === "--all") { console.log("\nall strings:"); uniq.forEach((s) => console.log(`  ${s}`)); }
