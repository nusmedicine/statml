// Slot 109 copy audit (2026-10-20): every reader-facing string, scanned against the claudisms.ai
// banlist (a local copy, path as argv[2]) and the project's own register rules (memory: never,
// second person, personification, outcome commentary, our coined words, lesson references).
//   node widgets/_lab/generation-control-copy-scan.mjs <claudisms.md> [--all]
// As 107's scan: evaluates the widget's own declarations (S, CAP at every value they key on, the
// card's leads, notes and plain formulas) rather than matching literals, and adds the press labels
// and titles, the page and option labels, the title, the manifest card and the meta description.
import { readFileSync } from "node:fs";

const md = readFileSync(process.argv[2], "utf8");
const terms = [];
for (const l of md.split("\n")) {
  const m = l.match(/^- \*\*(.+?)\*\*/);
  if (m) m[1].split(/\*\* \/ \*\*| \/ /).forEach((t) => terms.push(t.replace(/\*/g, "").trim().toLowerCase().replace(/^["“]|["”]$/g, "")));
}

const src = readFileSync(new URL("../generation-control/main.js", import.meta.url), "utf8");
const cut = (a, b) => src.slice(src.indexOf(a), src.indexOf(b));
const block = cut("const N = 10;", "/* ------------------------------------------------------------- the arms") + cut("const MATHML = mathmlRenders();", "let mathHost = null");
const W = new Function("M", "mathmlRenders", `${block}; return { S, CAP, LEAD, NOTE, EQ, PAGES, RULES, PREFIXES, TS, KS, N };`)({ MAX_TOKENS: 11 }, () => true);
const { S, CAP, LEAD, NOTE, EQ, PAGES, RULES, PREFIXES, TS, KS, N } = W;

const strs = [];
const walk = (v) => {
  if (typeof v === "string") strs.push(v);
  else if (typeof v === "function") { for (const args of [[0, 1], [3, 5], [1, 1]]) { try { const r = v(...args); if (typeof r === "string") strs.push(r); } catch { /* skip */ } } }
  else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === "object") Object.values(v).forEach(walk);
};
walk(S);
strs.push(S.armRule.temperature("1.3"), S.armRule.topk("3"));
/* every caption at every value it keys on */
for (const r of ["greedy", "temperature", "topk"]) for (const T of ["1", "0.7"]) strs.push(CAP.start.decoding(r, T));
for (const pre of ["treat", "neg", "none"]) { strs.push(CAP.start.conditioning(pre), CAP.cond(pre, "treated")); }
strs.push(CAP.rule.greedy("patient", 0.37));
for (const T of TS) strs.push(CAP.rule.temperature(T, "patient"));
for (const k of KS) strs.push(CAP.rule.topk(k, "patient"));
strs.push(CAP.ended(0), CAP.capped(0), CAP.done.decoding, CAP.done.conditioning);
Object.values(LEAD).forEach((s) => strs.push(s));
Object.values(NOTE).forEach((s) => strs.push(s));
Object.values(EQ).forEach((e) => strs.push(e.plain));
[...PAGES, ...RULES, ...PREFIXES].forEach((o) => strs.push(o.label));
for (const m of src.matchAll(/(?:stepLabel|stepTitle|runLabel|runTitle|title): [`"]([^`"]+)[`"]/g)) strs.push(m[1].replace("${N}", String(N)));
const man = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8")).widgets.find((w) => w.slug === "generation-control");
strs.push(man.blurb, readFileSync(new URL("../generation-control/index.html", import.meta.url), "utf8").match(/name="description" content="([^"]+)"/)[1]);
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
const ours = /\b(never|you|your|carr(y|ies)|compares?|reads? off|comes? from|chose|choose|waits?|reach(es|ed)?|sits?|stands?|points?|route|finds?|shows?|misses|settles?|appears?|lands?|walks?|card|pile|arm|arms|face|stage|lanes?|sweep|passes|moves?|moved|holds?|held|leaves?|keeps?|gives?|given|needs?|lesson|notebook|cell|pulls?|wins?|follows?|places?|placed|strip|frame|lives?|grows?|falls?|fell|sends?|asks?|tells?|says|knows?|wants?|tries|sees?|decides?|looks?|marks?|enters?|almost|guess|remains?|takes?|picks?|uses?|steers?|fill|fills|table|column|row|end to end|interval|draws?|drawn|press|run)\b/gi;
console.log("\nproject rules (each match is a word to read in context, not a verdict):");
for (const s of uniq) { const m = [...new Set((s.match(ours) || []).map((x) => x.toLowerCase()))]; if (m.length) console.log(`  [${m.join(", ")}] :: ${s.slice(0, 320)}`); }
