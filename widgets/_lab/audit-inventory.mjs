/* ============================================================================
   Inventory every prose surface across all 24 widgets, in one pass.

   Built for the 2026-08 cross-widget audit: nothing on that list — subtitles,
   control labels, drive verbs, legend entries, readout tiles — can be judged
   one file at a time, which is exactly why it had never been done. The recipe
   is kmeans-drive.mjs's stub-import, made generic: regexing the SOURCE for
   strings is how the first subtitle measurement reversed (it read one quoted
   segment of a concatenation), so this reads each widget's actual config.

   Run:  node widgets/_lab/audit-inventory.mjs           # writes audit-inventory.json
         node widgets/_lab/audit-inventory.mjs --report  # prints a readable digest

   NOT DEPLOYED — `widgets/_lab/` is excluded from the build.
   ========================================================================= */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

const manifest = JSON.parse(readFileSync(join(ROOT, "widgets", "manifest.json"), "utf8"));

/* probability-mechanisms touches `document` at module scope (its own canvas
   click listener). A permissive self-returning stub lets the module evaluate;
   nothing config-shaped ever reads what it returns. */
const fake = () => new Proxy(function () {}, {
  get: (t, p) => (p === Symbol.toPrimitive ? () => 0 : fake()),
  apply: () => fake(),
  set: () => true,
});
globalThis.document = fake();
globalThis.window = fake();

/** Load a widget's config object by stubbing defineWidget. Every relative
    import has to become absolute: a data: module has no base URL. */
async function loadConfig(slug) {
  const dir = join(ROOT, "widgets", slug);
  const abs = (rel) => pathToFileURL(join(dir, rel)).href;
  let src = readFileSync(join(dir, "main.js"), "utf8");
  src = src.replace(
    /import\s*\{([\s\S]*?)\}\s*from\s*"(\.\.\/core\/index\.js)";/,
    (m, names) => {
      const rest = names.split(",").map((s) => s.trim()).filter((s) => s && s !== "defineWidget");
      return (rest.length ? `import { ${rest.join(", ")} } from "${abs("../core/index.js")}";\n` : "")
        + "const __cfg = {}; const defineWidget = (c) => Object.assign(__cfg, c);";
    },
  );
  // every other relative import (model.js, core submodules)
  src = src.replace(/from\s*"(\.\.?\/[^"]+)"/g, (m, rel) => `from "${abs(rel)}"`);
  src += "\nexport { __cfg };\n";
  return (await import(`data:text/javascript;base64,${Buffer.from(src).toString("base64")}`)).__cfg;
}

/** Colors are DOM-derived; compute/readout only ever format them, so any
    string satisfies them. */
const colors = new Proxy({}, { get: () => "#888888" });

const out = [];
for (const entry of manifest.widgets) {
  const W = await loadConfig(entry.slug);
  const rec = {
    slug: entry.slug,
    title: W.title,
    blurb: entry.blurb,
    subtitle: W.subtitle ?? null,
    layout: W.layout ?? null,
    heightKind: typeof W.height,
    params: [],
    legend: (W.legend ?? []).map((l) => ({ token: l.token, label: l.label, mark: l.mark })),
    drive: null,
    readout: null,
    summary: null,
    readoutError: null,
  };
  for (const [name, f] of Object.entries(W.params ?? {})) {
    rec.params.push({
      name, type: f.type,
      label: f.label ?? null,
      labelOff: f.labelOff ?? null,
      detail: f.detail ?? null,
      display: Boolean(f.display),
      hidden: Boolean(f.hidden),
      afterDrive: Boolean(f.afterDrive),
      when: f.when?.param ?? null,
      rowDetail: f.row?.detail ?? null,
      options: Array.isArray(f.options)
        ? f.options.map((o) => (typeof o === "object" ? o.label ?? o.value : o))
        : f.options && typeof f.options === "object" ? Object.values(f.options) : null,
    });
  }
  const A = W.animation;
  if (A) {
    rec.drive = {
      leadLabel: A.leadLabel ?? null, leadTitle: A.leadTitle ?? null,
      stepLabel: A.stepLabel === undefined ? "(default)" : A.stepLabel,
      stepTitle: A.stepTitle ?? null,
      runLabel: A.runLabel === undefined ? "(default)" : A.runLabel,
      runTitle: A.runTitle ?? null,
      leadHint: A.leadHint ?? null,
    };
  }
  // Readout tiles at the DEFAULT state — labels and notes are what the audit
  // wants; values prove nothing prints NaN before anything is pressed.
  try {
    const values = {};
    for (const [name, f] of Object.entries(W.params ?? {})) {
      if ("default" in f) values[name] = f.default;
    }
    const { makeRng } = await import(pathToFileURL(join(ROOT, "widgets", "core", "rng.js")).href);
    const rng = makeRng(values.seed ?? 1);
    const state = W.compute({ params: { ...values }, rng, colors });
    let anim = null;
    if (A?.init) {
      try { anim = A.init({ params: { ...values }, state, fromScratch: false, leadDone: false }); }
      catch { anim = {}; }
    }
    if (W.readout) {
      rec.readout = W.readout({ params: { ...values }, state, anim, colors })
        .map((t) => ({ label: t.label, value: String(t.value), note: t.note ?? null }));
    }
    if (W.summary) rec.summary = W.summary({ params: { ...values }, state, anim });
  } catch (e) {
    rec.readoutError = String(e).slice(0, 200);
  }
  out.push(rec);
}

writeFileSync(join(HERE, "audit-inventory.json"), JSON.stringify(out, null, 2));
console.log(`audit-inventory.json: ${out.length} widgets`);

if (process.argv.includes("--report")) {
  for (const r of out) {
    console.log(`\n=== ${r.slug} — ${r.title}`);
    console.log(`  blurb    | ${r.blurb}`);
    console.log(`  subtitle | ${(r.subtitle ?? "").replace(/\s+/g, " ")}`);
    if (r.drive) {
      const d = r.drive;
      console.log(`  drive    | lead=${JSON.stringify(d.leadLabel)} step=${JSON.stringify(d.stepLabel)} run=${JSON.stringify(d.runLabel)}`);
    }
    for (const p of r.params) {
      console.log(`  param    | ${p.name} [${p.type}${p.display ? ", display" : ""}] "${p.label ?? ""}"${p.labelOff ? ` / off "${p.labelOff}"` : ""}${p.detail ? ` — ${p.detail.replace(/\s+/g, " ")}` : ""}`);
    }
    for (const l of r.legend) console.log(`  legend   | [${l.mark ?? "?"}] ${l.token}: ${l.label}`);
    if (r.readout) for (const t of r.readout) console.log(`  tile     | ${t.label} = ${t.value}${t.note ? ` — ${t.note.replace(/\s+/g, " ")}` : ""}`);
    if (r.summary) console.log(`  summary  | ${String(r.summary).replace(/\s+/g, " ").slice(0, 160)}`);
    if (r.readoutError) console.log(`  !! readout not evaluated: ${r.readoutError}`);
  }
}
