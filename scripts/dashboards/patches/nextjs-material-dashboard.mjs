// NextJS Material Dashboard (Next 10 pages router): `next export` under the
// demo base; the Google Maps script goes (it throws in the sandbox).
import { replaceOnce } from "./_lib.mjs";
import { staticNextConfig, prefixPublicPaths } from "./_next.mjs";
staticNextConfig();
replaceOnce("pages/_app.js", /[ \t]*<script src="https:\/\/maps\.googleapis\.com\/maps\/api\/js[^"]*"><\/script>\n/, "");
prefixPublicPaths(["pages", "components", "layouts", "assets", "variables"]);
replaceOnce("pages/admin/maps.js", "let google = window.google;", "let google = window.google;\n    if (!google || !google.maps) return;");
