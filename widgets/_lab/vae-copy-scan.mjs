// Slot 106 copy audit (2026-10-19): every reader-facing string, scanned against the claudisms.ai
// banlist (a local copy, path as argv[2]) and the project's own register rules (memory: never,
// second person, personification, outcome commentary, our coined words, lesson references).
//   node widgets/_lab/vae-copy-scan.mjs <claudisms.md> [--all]
// As 104's scan: evaluates the widget's own declarations (S, CAP, MATH, the press titles, the
// schematic's SVG text) rather than matching literals by regex, calls every string function with
// sample values on every page, and adds the manifest card, the title, the credit and the meta.
import { readFileSync } from "node:fs";
import { MODELS, DIGITS, GRID16, STATS } from "../vae/data.js";

const md = readFileSync(process.argv[2], "utf8");
const terms = [];
for (const l of md.split("\n")) {
  const m = l.match(/^- \*\*(.+?)\*\*/);
  if (m) m[1].split(/\*\* \/ \*\*| \/ /).forEach((t) => terms.push(t.replace(/\*/g, "").trim().toLowerCase().replace(/^["“]|["”]$/g, "")));
}

const src = readFileSync(new URL("../vae/main.js", import.meta.url), "utf8");
const block = src.slice(src.indexOf("const PAGES = ["), src.indexOf("let mathHost = null"));
const G = new Function(
  "MODELS", "DIGITS", "GRID16", "STATS", "mathmlRenders",
  `${block}; return { S, CAP, MATH, PAGES, STEP_TITLES, GEN_TITLE, CLUSTER, schemaSVG };`,
)(MODELS, DIGITS, GRID16, STATS, () => true);
const { S, CAP, MATH, PAGES, STEP_TITLES, CLUSTER, schemaSVG } = G;

const strs = [];
const params = (page, d = "5") => ({ page, label: d, digit: d, s_ae: "", s_without: "", s_with: "", s_vae: "", s_cvae: "", shown: 0 });
const sampler = CLUSTER[5];
/* a string function, called with whatever its arguments are: a digit, a checkpoint, params, a sampler */
const call = (f, key) => {
  const tries = [() => f(params("conditional"), sampler), () => f(5), () => f("5"), () => f({ c: [0.8, 0.4], s: 0.6 }), () => f({ klMu: 1.07, klSd: 2.81 }), () => f(true), () => f(false), () => f(0.16)];
  const out = [];
  for (const t of tries) { try { const r = t(); if (typeof r === "string" && !/undefined|NaN|\[object/.test(r)) out.push(r); else if (Array.isArray(r)) out.push(...r); } catch { /* next */ } }
  return out.slice(0, 2);
};
const walk = (v, key) => {
  if (key === "math") return;
  if (typeof v === "string") strs.push(v);
  else if (typeof v === "function") {
    if (key === "play") for (const k of [0, 2, 5, 9]) strs.push(v(k));
    else call(v, key).forEach((s) => strs.push(s));
  } else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
  else if (v && typeof v === "object") Object.entries(v).forEach(([k, x]) => (k === "param" || k === "anim" ? null : walk(x, k)));
};
walk(S);
for (const page of ["ae", "vae", "conditional"]) {
  for (const k of [0, 1, 2]) strs.push(CAP[page][k](params(page), sampler));
  for (const k of [0, 2, 5, 9]) strs.push(CAP[page].play(k));
  /* the schematic's text, as the card renders it */
  for (const m of schemaSVG(page, "5").matchAll(/<text[^>]*>([^<]+)<\/text>/g)) strs.push(m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<"));
}
walk(MATH);
walk(STEP_TITLES);
walk([PAGES.map((p) => p.label), "Train", "Decode region"]);
const title = src.match(/title: "([^"]+)"/)[1], credit = src.match(/credit: "([^"]+)"/)[1];
const man = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8")).widgets.find((w) => w.slug === "vae");
const meta = readFileSync(new URL("../vae/index.html", import.meta.url), "utf8").match(/name="description" content="([^"]+)"/)[1];
strs.push(title, credit, man.blurb, meta);
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
const ours = /\b(never|you|your|carr(y|ies)|compares?|reads? off|comes? from|chose|choose|waits?|reach(es)?|sits?|stands?|points?|freed|route around|finds?|shows?|misses|missed|settles?|appears?|lands?|walks?|rung|card|pile|arm|face|stage|hole|holes|lanes?|pieces?|sweep|blank|passes|moves?|reads|stretched|holds?|ends at|serves?|leaves?|keeps?|gives?|needs?|lesson|notebook|cell|benchmark|arbitrary|shortcut|pulls?|draws? them|draws? back|sliver|wins?|goes to|follows?|agree|trades?|places?|strip|frame|checkpoint|lives?|grows?|falls?|sharpens?|fills?|probe|sends?|asks?|tells?|says|knows?|wants?|tries|tests?|occupy|occupies|share[sd]?|spread over|shading|blends?|patch|island|cloud|ours|mix)\b/gi;
console.log("\nproject rules (each match is a word to read in context, not a verdict):");
for (const s of uniq) { const m = [...new Set((s.match(ours) || []).map((x) => x.toLowerCase()))]; if (m.length) console.log(`  [${m.join(", ")}] :: ${s.slice(0, 260)}`); }
