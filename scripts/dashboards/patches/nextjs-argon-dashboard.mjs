// NextJS Argon Dashboard (Next 10 pages router): `next export` under the demo
// base. node-sass 4 needs an install script (blocked), so the name is aliased
// to Dart Sass, whose legacy render() API sass-loader 6 can call. The Google
// Maps script goes (it throws in the sandbox) and the map page bails out.
import { replaceOnce, editJson } from "./_lib.mjs";
import { staticNextConfig } from "./_next.mjs";
staticNextConfig();
editJson("package.json", (p) => {
  if (!p.dependencies["node-sass"]) throw new Error("patch: node-sass not in dependencies");
  p.dependencies["node-sass"] = "npm:sass@1.32.13";
});
replaceOnce("pages/_app.js", /[ \t]*<script src="https:\/\/maps\.googleapis\.com\/maps\/api\/js[^"]*"><\/script>\n/, "");
replaceOnce("pages/admin/maps.js", "let google = window.google;", "let google = window.google;\n    if (!google || !google.maps) return;");
