// Slot 108 copy audit (2026-10-19): every reader-facing string, scanned against the claudisms.ai
// banlist (a local copy, path as argv[2]) and the project's own register rules (memory: never,
// second person, personification, outcome commentary, our coined words, lesson references).
//   node widgets/_lab/gan-copy-scan.mjs <claudisms.md> [--all]
// As 106's scan: evaluates the widget's own declarations (S, CAP, the card's diagram, lead lines,
// equations and note) rather than matching literals, and adds the press labels and titles, the
// title, the manifest card and the meta description.
import { readFileSync } from "node:fs";
import { SCHEDULE, normalQuantile } from "../gan/engine.js";

const md = readFileSync(process.argv[2], "utf8");
const terms = [];
for (const l of md.split("\n")) {
  const m = l.match(/^- \*\*(.+?)\*\*/);
  if (m) m[1].split(/\*\* \/ \*\*| \/ /).forEach((t) => terms.push(t.replace(/\*/g, "").trim().toLowerCase().replace(/^["“]|["”]$/g, "")));
}

const src = readFileSync(new URL("../gan/main.js", import.meta.url), "utf8");
const block = src.slice(src.indexOf("const ROUNDS = "), src.indexOf("let mathHost = null"));
const { S, CAP, LEAD, NOTE, EQ, DIAGRAM_LABEL, diagramSVG } = new Function(
  "SCHEDULE", "normalQuantile", "mathmlRenders",
  `${block}; return { S, CAP, LEAD, NOTE, EQ, DIAGRAM_LABEL, diagramSVG };`,
)(SCHEDULE, normalQuantile, () => true);

const strs = [];
const walk = (v) => {
  if (typeof v === "string") strs.push(v);
  else if (typeof v === "function") for (const a of [0.37, 1.23, "48% · 52%", 75]) { try { const r = v(a); if (typeof r === "string") { strs.push(r); break; } } catch { /* next */ } }
  else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === "object") Object.values(v).forEach(walk);
};
walk(S); walk(CAP); walk(LEAD); walk(NOTE); walk(DIAGRAM_LABEL);
walk(Object.values(EQ).map((e) => e.plain));
for (const lit of ["", "d", "g"]) for (const m of diagramSVG(lit).matchAll(/<text[^>]*>([^<]+)<\/text>/g)) strs.push(m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<"));
for (const m of src.matchAll(/(?:labels: \{ 0: "([^"]+)", 1: "([^"]+)" \}|runLabel: "([^"]+)"|runTitle: "([^"]+)"|title: "([^"]+)")/g)) m.slice(1).filter(Boolean).forEach((s) => strs.push(s));
const man = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8")).widgets.find((w) => w.slug === "gan");
strs.push(man.blurb, readFileSync(new URL("../gan/index.html", import.meta.url), "utf8").match(/name="description" content="([^"]+)"/)[1]);
const uniq = [...new Set(strs)].filter((s) => /[a-z]/i.test(s));
if (process.argv.includes("--all")) uniq.forEach((s) => console.log(`  · ${s}`));

const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hits = [];
for (const s of uniq) {
  const l = s.toLowerCase();
  for (const t of terms) if (t.length > 2 && new RegExp(`\\b${esc(t)}\\b`).test(l)) hits.push([t, s]);
}
console.log(`claudisms: ${terms.length} terms, ${uniq.length} strings, ${hits.length} hits`);
hits.forEach(([t, s]) => console.log(`  "${t}" :: ${s.slice(0, 160)}`));
const ours = /\b(never|you|your|carr(y|ies)|compares?|reads? off|comes? from|chose|choose|waits?|reach(es)?|sits?|stands?|points?|freed|route around|finds?|shows?|misses|missed|settles?|appears?|lands?|walks?|rung|card|pile|arm|face|stage|lanes?|sweep|passes|moves?|moved|reads|holds?|held|ends at|leaves?|keeps?|gives?|needs?|lesson|notebook|cell|pulls?|wins?|goes to|follows?|trades?|places?|strip|frame|snapshot|checkpoint|lives?|grows?|falls?|fell|rose|rises?|sharpens?|fills?|sends?|asks?|tells?|says|knows?|wants?|tries|fool|fools|sees?|decides?|looks?|marks?|enter|bridge|thin|almost|up|chases?|game|turns?|in turn|press(es)?|half|halves|round)\b/gi;
console.log("\nproject rules (each match is a word to read in context, not a verdict):");
for (const s of uniq) { const m = [...new Set((s.match(ours) || []).map((x) => x.toLowerCase()))]; if (m.length) console.log(`  [${m.join(", ")}] :: ${s.slice(0, 300)}`); }
