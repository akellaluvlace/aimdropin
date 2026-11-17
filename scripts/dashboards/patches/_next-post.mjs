// Post-build step (runs in the build container): put the RSC fetch fix as
// the first script in <head> of every exported HTML page, for apps whose
// root layout isn't server-rendered (client-only layouts).
//   node /patches/_next-post.mjs <outDir>
import { readFileSync, writeFileSync } from "node:fs";
import { findFiles, RSC_FIX } from "./_next.mjs";
const dir = process.argv[2];
let n = 0;
for (const f of findFiles(dir, /\.html$/)) {
  const s = readFileSync(f, "utf8");
  if (s.includes("__aimRsc")) continue;
  const t = s.replace(/<head(\s[^>]*)?>/i, (m) => `${m}<script>${RSC_FIX}</script>`);
  if (t !== s) {
    writeFileSync(f, t);
    n++;
  }
}
if (!n) throw new Error(`post: no HTML pages patched in ${dir}`);
console.log(`post: RSC fix added to ${n} pages`);
