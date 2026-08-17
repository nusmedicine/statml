#!/usr/bin/env node
/* ============================================================================
   Assemble the deployable site into _site/.

     _site/          <- the rendered Quarto book (if book/_book exists)
     _site/w/        <- the widgets, copied verbatim

   Widgets are plain ES modules with relative imports, so copying widgets/ to
   _site/w/ preserves every path: widgets/clt/main.js imports "../core/index.js"
   and finds it at _site/w/core/index.js. That is the whole reason there is no
   bundler here.

   Layout parity matters for the same reason:
     dev   http://localhost:8000/widgets/clt/
     prod  https://<user>.github.io/book-statml/w/clt/
   ========================================================================= */

import { cp, mkdir, rm, writeFile, readFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "_site");
const bookOut = join(root, "book", "_book");

const exists = async (p) => {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
};

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

// 2. Book -> _site root, if it has been rendered
if (await exists(bookOut)) {
  await cp(bookOut, site, { recursive: true });
  console.log("book:    _site/ (rendered Quarto output)");
} else {
  await writeFile(
    join(site, "index.html"),
    `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>statml</title>
<meta http-equiv="refresh" content="0;url=./w/">
</head><body><p><a href="./w/">Widget gallery</a></p></body></html>
`
  );
  console.log("book:    not rendered — _site/index.html redirects to the gallery.");
  console.log("         Install Quarto and run `npm run book` to include it.");
}

// 3. Pages must not run the output through Jekyll (it drops _-prefixed paths).
await writeFile(join(site, ".nojekyll"), "");

console.log("\nBuilt _site/. Preview it with:  npx --yes serve _site");
