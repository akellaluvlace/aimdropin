// Post-build step: styles that point at the site root (url(/assets/…)) skip
// the demo's base path, so under /demos/<slug>/ those files 404 (checkbox
// ticks, icons). Point them at the base instead, in global stylesheets and in
// component styles compiled into the JS bundles.
//   DEMO_BASE=/demos/<slug>/ node /patches/_root-urls-post.mjs <outDir>
import { readFileSync, writeFileSync } from "node:fs";
import { findFiles } from "./_next.mjs";

const dir = process.argv[2];
const base = process.env.DEMO_BASE;
if (!dir || !base || !base.startsWith("/") || !base.endsWith("/")) {
  throw new Error("post: usage DEMO_BASE=/demos/<slug>/ node _root-urls-post.mjs <outDir>");
}
let n = 0;
for (const f of findFiles(dir, /\.(css|js)$/)) {
  const s = readFileSync(f, "utf8");
  const t = s.replace(/url\((['"]?)\/assets\//g, (_m, q) => `url(${q}${base}assets/`);
  if (t !== s) {
    writeFileSync(f, t);
    n++;
    console.log(`post: ${f}`);
  }
}
if (!n) throw new Error(`post: no root asset URLs found in ${dir}`);
console.log(`post: pointed root asset URLs at ${base} in ${n} files`);
