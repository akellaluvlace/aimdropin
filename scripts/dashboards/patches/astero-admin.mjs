// Astero builds root-absolute production URLs (/pages, /assets, /js, /css)
// through many `isDev ? devPath : prodPath` helpers; prefix every prodPath
// with the demo base.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { replaceOnce, BASE_NOSLASH } from "./_lib.mjs";

const B = JSON.stringify(BASE_NOSLASH);

// Every other `isDev ? <dev> : '/…'` or `` : `/…` `` production branch.
const PROD = /(isDev\s*\?\s*(?:`[^`]*`|'[^']*'|"[^"]*")\s*:\s*)([`'"])\/(?!\/)/g;
let hits = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(astro|js|mjs|ts)$/.test(name)) {
      const s = readFileSync(p, "utf8");
      const t = s.replace(PROD, (_m, lead, q) => {
        hits++;
        return `${lead}${q}${BASE_NOSLASH}/`;
      });
      if (t !== s) writeFileSync(p, t);
    }
  }
};
walk("src");
// Asset prefixes return the bare path in production.
replaceOnce("src/utils/path.js", "return isDev ? `/dist${path}` : `${path}`", `return isDev ? \`/dist\${path}\` : ${B} + path`);
replaceOnce("src/assets/js/path-utils.js", "return isDev ? `/dist${path}` : `${path}`", `return isDev ? \`/dist\${path}\` : ${B} + path`);
replaceOnce("src/assets/js/pages/roles-permissions/roles/submitform.js", '"/pages/roles-permissions/roles/list"', `${B} + "/pages/roles-permissions/roles/list"`);

if (hits < 10) throw new Error(`patch: expected many isDev production paths, found ${hits}`);
console.log(`astero patch: ${hits} production paths prefixed`);
