// Slot 107 copy audit (2026-10-20): every reader-facing string, scanned against the claudisms.ai
// banlist (a local copy, path as argv[2]) and the project's own register rules (memory: never,
// second person, personification, outcome commentary, our coined words, lesson references).
//   node widgets/_lab/diffusion-copy-scan.mjs <claudisms.md> [--all]
// As 108's scan: evaluates the widget's own declarations (S, CAP at every state they key on, the
// card's diagrams, formulas and notes) rather than matching literals, and adds the press labels
// and titles, the page and option labels, the title, the manifest card and the meta description.
import { readFileSync } from "node:fs";
import { FORWARD, TRAINING, GENERATION, CONDITIONAL, COND_TRAINING } from "../diffusion/data.js";

const md = readFileSync(process.argv[2], "utf8");
const terms = [];
for (const l of md.split("\n")) {
  const m = l.match(/^- \*\*(.+?)\*\*/);
  if (m) m[1].split(/\*\* \/ \*\*| \/ /).forEach((t) => terms.push(t.replace(/\*/g, "").trim().toLowerCase().replace(/^["“]|["”]$/g, "")));
}

const src = readFileSync(new URL("../diffusion/main.js", import.meta.url), "utf8");
const block = src.slice(src.indexOf("/* ------------------------------------------------------------- the schedule"), src.indexOf("let mathHost = null"));
const W = new Function(
  "FORWARD", "TRAINING", "GENERATION", "CONDITIONAL", "COND_TRAINING", "mathmlRenders",
  `${block}; return { S, CAP, EQ, PAGES, CK_NAME, MAX, diagramSVG, T_EVEN, T_TENTH };`,
)(FORWARD, TRAINING, GENERATION, CONDITIONAL, COND_TRAINING, () => true);
const { S, CAP, EQ, PAGES, CK_NAME, MAX, diagramSVG } = W;

const strs = [];
const walk = (v) => {
  if (typeof v === "string") strs.push(v);
  else if (typeof v === "function") { try { const r = v(0.63, 0.78, 0.18, 0.78, -0.52, -0.29, 0.5); if (typeof r === "string") strs.push(r); } catch { /* skip */ } }
  else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === "object") Object.values(v).forEach(walk);
};
walk(S);
strs.push(S.fwd.sum(15, 18, 0.63, 0.18, 0.78, -0.52, -0.29), S.tr.x0(2, true), S.tr.x0(2, false), S.tr.samples("after epoch 3", true), S.tr.samples("after epoch 3", false), S.tile.ckNote(5));
/* every caption at every state it keys on */
for (const t of [0, W.T_EVEN, W.T_TENTH]) strs.push(CAP.forward(t));
for (const page of ["training", "ctraining"]) for (let ck = 0; ck <= MAX[page]; ck++) for (const pl of [false, true]) strs.push(CAP[page](ck, pl));
for (let f = 0; f <= MAX.generation; f++) strs.push(CAP.generation(f));
for (let f = 0; f <= MAX.conditional; f++) strs.push(CAP.conditional(f));
for (const e of Object.values(EQ)) strs.push(e.lead, e.plain, e.note);
for (const page of ["forward", "training", "ctraining", "generation", "conditional"]) {
  const svg = diagramSVG(page);
  for (const m of svg.matchAll(/<text[^>]*>(.*?)<\/text>/g)) strs.push(m[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<"));
  strs.push(svg.match(/aria-label="([^"]+)"/)[1]);
}
PAGES.forEach((p) => strs.push(p.label, p.group ?? ""));
CK_NAME.forEach((n) => strs.push(n));
for (const m of src.matchAll(/(?:stepLabel: "([^"]+)"|title: "([^"]+)"|credit: "([^"]+)")/g)) m.slice(1).filter(Boolean).forEach((s) => strs.push(s));
for (const m of src.matchAll(/runLabel: \{ param: "page", labels: \{([^}]+)\}/g)) for (const n of m[1].matchAll(/"([^"]+)"/g)) strs.push(n[1]);
const man = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8")).widgets.find((w) => w.slug === "diffusion");
strs.push(man.blurb, readFileSync(new URL("../diffusion/index.html", import.meta.url), "utf8").match(/name="description" content="([^"]+)"/)[1]);
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
const ours = /\b(never|you|your|carr(y|ies)|compares?|reads? off|comes? from|chose|choose|waits?|reach(es)?|sits?|stands?|points?|route|finds?|shows?|misses|settles?|settled|appears?|lands?|walks?|card|pile|arm|face|stage|lanes?|sweep|passes|moves?|moved|reads|holds?|held|leaves?|keeps?|gives?|given|needs?|lesson|notebook|cell|pulls?|wins?|follows?|follow|places?|strip|frame|frames|snapshot|checkpoint|lives?|grows?|falls?|fell|rose|rises?|sharpens?|fills?|sends?|asks?|asked|tells?|says|knows?|wants?|tries|sees?|decides?|looks?|marks?|enters?|almost|guess|remains?|returns?|share|faint|blur|fades?|spread|row|column|press(es)?|run|playhead|result|finished|harsh|magnif\w*)\b/gi;
console.log("\nproject rules (each match is a word to read in context, not a verdict):");
for (const s of uniq) { const m = [...new Set((s.match(ours) || []).map((x) => x.toLowerCase()))]; if (m.length) console.log(`  [${m.join(", ")}] :: ${s.slice(0, 320)}`); }
