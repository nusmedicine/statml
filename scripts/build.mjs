#!/usr/bin/env node
/* ============================================================================
   Assemble the deployable site into _site/.

     _site/index.html <- the landing page: the widget gallery
     _site/widget/    <- the widgets, copied verbatim

   That is the whole site. This repo produces widgets and nothing else; the
   teaching material lives in the MyST notebook lessons and reaches a widget by
   its URL. See docs/prd.md §4 and §6.

   Widgets are plain ES modules with relative imports, so copying widgets/ to
   _site/widget/ preserves every path: widgets/clt/main.js imports
   "../core/index.js" and finds it at _site/widget/core/index.js. That is the
   whole reason there is no bundler here.

   The deployed layout is:

     https://nusmedicine.github.io/statml/                 the gallery
     https://nusmedicine.github.io/statml/widget/clt/      a widget

   `widget` (singular) is the published namespace and `widgets/` is the source
   directory, so this is the one place the two names differ. scripts/serve.mjs
   aliases /widget/ -> widgets/ so a link works unchanged in dev:

     dev   http://localhost:8000/widget/clt/
     prod  https://nusmedicine.github.io/statml/widget/clt/

   Everything the site serves is addressed relatively, because it is served from
   a /statml/ subpath — an absolute path would work in dev and 404 in production.
   scripts/check.mjs asserts that; do not weaken it.
   ========================================================================= */

import { cp, mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_DIR } from "./site.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "_site");

/* Windows holds a directory open while anything has a handle on it, so a file
   scanner walking the tree makes rmdir fail EBUSY. This repo lives inside
   Dropbox, which indexes _site/ the moment a build populates it, and a second
   build then dies before it writes anything. It is a race, not a stuck lock:
   the failing path moved DEEPER on each run — _site, then _site/widget, then
   _site/widget/bayesian — which is the scanner walking behind the delete.
   Measured here, it needed up to 6 attempts and always won inside 300ms; a
   cold _site/ succeeds on the first. macOS never sees this at all, because
   unlink there does not care that a handle is open. */
async function rmTree(dir) {
  const DEADLINE = 40; // × 50ms = 2s, against a measured worst case of 6 attempts
  for (let attempt = 1; ; attempt++) {
    try {
      return await rm(dir, { recursive: true, force: true });
    } catch (err) {
      const locked = err.code === "EBUSY" || err.code === "EPERM" || err.code === "ENOTEMPTY";
      if (!locked || attempt === DEADLINE) throw err;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}

await rmTree(site);
await mkdir(site, { recursive: true });

// 1. Widgets -> _site/widget. Underscore-prefixed directories are design-lab
// pages (widgets/_lab/...) and stay out of the deployed site.
await cp(join(root, "widgets"), join(site, PUBLIC_DIR), {
  recursive: true,
  filter: (src) => !/[/\\]_[^/\\]*$/.test(src.replace(/[/\\]+$/, "")),
});
const { widgets } = JSON.parse(await readFile(join(root, "widgets", "manifest.json"), "utf8"));
console.log(`widgets: ${widgets.length} copied to _site/${PUBLIC_DIR}`);

// 2. The landing page. It is a real page, not a redirect — a link to
// https://nusmedicine.github.io/statml/ is the front door and should arrive
// somewhere. It reads widgets/manifest.json at runtime, so the gallery cannot
// drift from the registry.
await cp(join(root, "index.html"), join(site, "index.html"));
console.log("root:    _site/index.html is the gallery");

// 3. The lab: an index of drafts, at /lab/. Deliberately not linked from the
// landing page — see lab/index.html for why.
await cp(join(root, "lab"), join(site, "lab"), { recursive: true });
console.log("lab:     _site/lab/ indexes the drafts");

// 4. Pages must not run the output through Jekyll (it drops _-prefixed paths).
await writeFile(join(site, ".nojekyll"), "");

console.log("\nBuilt _site/. Preview it with:  npx --yes serve _site");
