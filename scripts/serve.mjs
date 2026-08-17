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

   Usage:  node scripts/serve.mjs [port]
   ========================================================================= */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(import.meta.url), "..", "..");
const port = Number(process.argv[2]) || 8000;

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

async function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0].split("#")[0]);
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
  const file = await resolveFile(req.url ?? "/");

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
  console.log(`  gallery  http://localhost:${port}/widgets/`);
  console.log(`  lab      http://localhost:${port}/widgets/_lab/`);
});
