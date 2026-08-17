#!/usr/bin/env node
/* ============================================================================
   Assemble the deployable site into _site/.

     _site/index.html <- a redirect to the gallery
     _site/w/         <- the widgets, copied verbatim

   That is the whole site. This repo produces widgets and nothing else; the
   teaching material lives in the MyST notebook lessons and reaches a widget by
   its URL. See docs/prd.md §4 and §6.

   Widgets are plain ES modules with relative imports, so copying widgets/ to
   _site/w/ preserves every path: widgets/clt/main.js imports "../core/index.js"
   and finds it at _site/w/core/index.js. That is the whole reason there is no
   bundler here.

   Layout parity matters for the same reason:
     dev   http://localhost:8000/widgets/clt/
     prod  https://<user>.github.io/book-statml/w/clt/
   ========================================================================= */

import { cp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "_site");

await rm(site, { recursive: true, force: true });
await mkdir(site, { recursive: true });

// 1. Widgets -> _site/w. Underscore-prefixed directories are design-lab pages
// (widgets/_lab/...) and stay out of the deployed site.
await cp(join(root, "widgets"), join(site, "w"), {
  recursive: true,
  filter: (src) => !/[/\\]_[^/\\]*$/.test(src.replace(/[/\\]+$/, "")),
});
const { widgets } = JSON.parse(await readFile(join(root, "widgets", "manifest.json"), "utf8"));
console.log(`widgets: ${widgets.length} copied to _site/w`);

// 2. The root redirects to the gallery. Widgets stay under /w/ so the deployed
// layout matches dev (/widgets/ -> /w/) and a link keeps working if anything is
// ever served from the root.
await writeFile(
  join(site, "index.html"),
  `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>statml</title>
<meta http-equiv="refresh" content="0;url=./w/">
</head><body><p><a href="./w/">Widget gallery</a></p></body></html>
`
);
console.log("root:    _site/index.html redirects to the gallery");

// 3. Pages must not run the output through Jekyll (it drops _-prefixed paths).
await writeFile(join(site, ".nojekyll"), "");

console.log("\nBuilt _site/. Preview it with:  npx --yes serve _site");
