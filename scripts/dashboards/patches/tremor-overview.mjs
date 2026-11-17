// Static export under the demo base (the "/" redirect goes; the entry is the first page).
import { staticNextConfig, prefixPublicPaths, fixRscFetchAll } from "./_next.mjs";
staticNextConfig();
prefixPublicPaths(["src"]);
fixRscFetchAll();
// Dates are prerendered in UTC and hydrated in the viewer's zone: pin UTC so
// the tables hydrate without a text mismatch.
import { readFileSync, writeFileSync } from "node:fs";
for (const f of ["src/components/ui/data-table-support/columns.tsx", "src/components/ui/data-table/columns.tsx"]) {
  const s = readFileSync(f, "utf8");
  const t = s.replaceAll('toLocaleDateString("en-GB", {', 'toLocaleDateString("en-GB", { timeZone: "UTC",');
  if (t === s) throw new Error(`patch: no en-GB dates in ${f}`);
  writeFileSync(f, t);
}
