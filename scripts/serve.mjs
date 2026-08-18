#!/usr/bin/env node
/* ============================================================================
   Development server. Zero dependencies.

   It exists for ONE reason that `python -m http.server` cannot give us: it sends
   `Cache-Control: no-store`. Widgets are plain ES modules loaded by URL, and
   browsers cache those aggressively — edit a core module, reload, and the page
   quietly keeps running the old one. That failure mode looks exactly like a bug
   in your change, and costs far more than this file does.

   Deployed widgets hit a milder version of the same trap: GitHub Pages sends
   `max-age=600`, so a student can run a ten-minute-old widget after a push. That
   one we live with; this one we refuse to.

   It also serves the DEPLOYED path layout, not the source layout, so a URL
   copied out of a widget works in both places without editing:

     dev   http://localhost:8000/widget/clt/?dist=bimodal&n=30
     prod  https://nusmedicine.github.io/statml/widget/clt/?dist=bimodal&n=30

   Two rules do that — see the two helpers below. `/widgets/` keeps working
   because it is the real directory and the fingerprint harness addresses its
   frames as `../<slug>/` from `widgets/_lab/`.

   Usage:  node scripts/serve.mjs [port]      # or PORT=8123 npm run dev
   ========================================================================= */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { PUBLIC_DIR } from "./site.mjs";

const root = resolve(fileURLToPath(import.meta.url), "..", "..");
/* Explicit argument wins, then PORT from the environment, then 8000. Nothing in
   this repo depends on a particular port — every widget URL is relative and the
   fingerprint harness loads its frames relatively too — so a second dev server
   on another port is harmless, and honouring PORT is what lets one start when
   8000 is already taken. */
const port = Number(process.argv[2]) || Number(process.env.PORT) || 8000;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".ipynb": "application/json; charset=utf-8",
};

/* `widget` (singular) is the published namespace; `widgets/` is the source
   directory. scripts/build.mjs renames it on the way into _site/, and this is
   the same rename applied on the way in, so the two sides address a widget
   identically. `/widgets/...` is left alone: its eighth character is `s`, not
   the `/` this prefix requires, so it never matches. */
const ALIAS = `/${PUBLIC_DIR}`;
const aliasWidget = (p) =>
  p === ALIAS || p.startsWith(ALIAS + "/") ? "/widgets" + p.slice(ALIAS.length) : p;

/* Redirect a directory request that is missing its trailing slash, the way
   GitHub Pages does. Without this, `/widget/clt` serves the page but every
   relative import inside it resolves one level too high — a break that appears
   only in dev, which is the exact class of bug this file exists to prevent. */
async function isDirectory(fsPath) {
  try {
    return (await stat(fsPath)).isDirectory();
  } catch {
    return false;
  }
}

async function resolveFile(urlPath) {
  const clean = aliasWidget(decodeURIComponent(urlPath.split("?")[0].split("#")[0]));
  const target = resolve(root, "." + clean);

  // Never serve outside the repo, whatever the request says.
  if (target !== root && !target.startsWith(root + sep)) return null;

  try {
    const info = await stat(target);
    if (info.isDirectory()) {
      const index = join(target, "index.html");
      await stat(index);
      return index;
    }
    return target;
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const url = req.url ?? "/";
  const [path, rest] = [url.split(/[?#]/)[0], url.slice(url.split(/[?#]/)[0].length)];

  if (!path.endsWith("/")) {
    const asDir = resolve(root, "." + aliasWidget(decodeURIComponent(path)));
    if ((asDir === root || asDir.startsWith(root + sep)) && (await isDirectory(asDir))) {
      res.writeHead(301, { Location: path + "/" + rest });
      res.end();
      return;
    }
  }

  const file = await resolveFile(url);

  if (!file) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("404 Not Found\n");
    return;
  }

  try {
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
      // The entire point of this server.
      "Cache-Control": "no-store, must-revalidate",
      "Content-Length": body.length,
    });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("500 Internal Server Error\n");
  }
});

server.listen(port, () => {
  console.log(`statml dev server (no-store) on http://localhost:${port}`);
  console.log(`  gallery  http://localhost:${port}/`);
  console.log(`  widget   http://localhost:${port}/${PUBLIC_DIR}/clt/`);
  console.log(`  lab      http://localhost:${port}/widgets/_lab/`);
});
