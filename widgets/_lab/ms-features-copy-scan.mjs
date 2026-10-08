// Slot 93 copy audit (copied from 91's) (2026-10-08): every string literal in main.js and the manifest card,
// scanned against the claudisms.ai banlist (fetched to a path given as argv[2]) and the
// project's own register rules (memory: never, second person, personification, our words).
//   node widgets/_lab/ms-features-copy-scan.mjs <claudisms.md>
import { readFileSync } from "node:fs";

const md = readFileSync(process.argv[2], "utf8");
const terms = [];
for (const l of md.split("\n")) {
  const m = l.match(/^- \*\*(.+?)\*\*/);
  if (m) m[1].split(" / ").forEach((t) => terms.push(t.trim().toLowerCase().replace(/^["“]|["”]$/g, "")));
}
const src = readFileSync(new URL("../ms-features/main.js", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const strs = [...src.matchAll(/"((?:[^"\\]|\\.){4,})"|`((?:[^`\\]|\\.){4,})`/g)]
  .map((m) => m[1] || m[2]).filter((s) => /[a-z]{3} [a-z]/i.test(s));
const man = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8")).widgets.find((w) => w.slug === "ms-features");
strs.push(man.blurb, man.title);
const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hits = [];
for (const s of strs) {
  const l = s.toLowerCase();
  for (const t of terms) if (t.length > 2 && new RegExp(`\\b${esc(t)}\\b`).test(l)) hits.push([t, s]);
}
console.log(`claudisms: ${terms.length} terms, ${strs.length} strings, ${hits.length} hits`);
hits.forEach(([t, s]) => console.log(`  "${t}" :: ${s.slice(0, 120)}`));
const ours = /\b(never|you|your|carr(y|ies)|compares?|reads? off|comes? from|chose|choose|waits?|reach(es)?|sits?|stands?|points? the|freed|route around|finds?|shows?|misses|missed|settles?|appears?|lands?|walks?|rung|card|pile|arm|face|stage|hole|holes)\b/i;
console.log("\nproject rules:");
for (const s of strs) { const m = s.match(ours); if (m) console.log(`  ${m[0]} :: ${s.slice(0, 130)}`); }
