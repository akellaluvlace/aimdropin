// Notus NextJS (pages router): static export; Google Maps script goes (it
// throws in the sandbox) and the map component bails out without it; the
// unused react-scripts/gulp dependencies are dropped from the unpinned install.
import { rmSync } from "node:fs";
import { replaceOnce, editJson } from "./_lib.mjs";
import { staticNextConfig, prefixPublicPaths } from "./_next.mjs";
rmSync("next.config.js"); // empty upstream
staticNextConfig();
replaceOnce("pages/_app.js", /[ \t]*<script src="https:\/\/maps\.googleapis\.com\/maps\/api\/js[^"]*"><\/script>\n/, "");
replaceOnce("components/Maps/MapExample.js", "let google = window.google;", "let google = window.google;\n    if (!google || !google.maps) return;");
editJson("package.json", (p) => {
  for (const d of ["react-scripts", "gulp", "gulp-append-prepend"]) {
    if (!p.dependencies[d]) throw new Error(`patch: ${d} not in dependencies`);
    delete p.dependencies[d];
  }
  p.dependencies["prop-types"] = "15.8.1"; // came in through react-scripts
  // The charts use the Chart.js 2 API (default export, xAxes/yAxes).
  if (p.dependencies["chart.js"] !== "4.3.0") throw new Error("patch: chart.js version changed");
  p.dependencies["chart.js"] = "2.9.4";
});
prefixPublicPaths(["pages", "components", "layouts", "styles"]);
// Written for Next 12: every <Link> wraps its own <a>, which Next 13 nests
// inside another <a> (invalid HTML, so hydration fails). legacyBehavior keeps
// the old single-<a> rendering.
import { findFiles } from "./_next.mjs";
import { readFileSync, writeFileSync } from "node:fs";
let links = 0;
for (const f of [...findFiles("components", /\.js$/), ...findFiles("pages", /\.js$/), ...findFiles("layouts", /\.js$/)]) {
  const s = readFileSync(f, "utf8");
  const t = s.replace(/<Link(\s)(?!legacyBehavior)/g, "<Link legacyBehavior$1");
  if (t !== s) { writeFileSync(f, t); links++; }
}
if (links < 5) throw new Error("patch: expected <Link> uses in several files");
