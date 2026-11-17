// Post-build step (run from a build command): `node /patches/root-links-post.mjs <outDir>`.
// Prefixes root-absolute href/src/srcset URLs in built HTML with the demo
// base, leaving ones that already carry it alone.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
const BASE = process.env.DEMO_BASE; // "/demos/<slug>/"
const dir = process.argv[2];
if (!BASE || !dir) throw new Error("usage: DEMO_BASE=... node root-links-post.mjs <outDir>");
const already = BASE.slice(1); // "demos/<slug>/"
let pages = 0;
const walk = (d) => {
  for (const name of readdirSync(d)) {
    const p = path.join(d, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.html?$/.test(name)) {
      const s = readFileSync(p, "utf8");
      const t = s.replace(/(\s(?:href|src)=)(["'])\/(?!\/)([^"']*)\2/g, (m, lead, q, rest) =>
        rest.startsWith(already) ? m : `${lead}${q}${BASE}${rest}${q}`,
      );
      if (t !== s) { writeFileSync(p, t); pages++; }
    }
  }
};
walk(dir);
console.log(`root-links-post: rewrote ${pages} pages`);
