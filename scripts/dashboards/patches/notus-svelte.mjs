// Notus Svelte (svelte-routing): everything under the demo base. The router
// gets the base path, root links/asset strings are prefixed with it, the demo
// opens on the admin dashboard (the UI-kit index page moves to /index) and
// Google Maps is dropped (the maps page skips map setup without it).
import { readFileSync, writeFileSync } from "node:fs";
import { replaceOnce, BASE, BASE_NOSLASH } from "./_lib.mjs";
import { replaceInTree } from "./_react-vite.mjs";

// index.html template (written by rollup.config.js)
let r = readFileSync("rollup.config.js", "utf8");
r = r.replace(/<script src="https:\/\/maps\.googleapis\.com[^"]*"><\/script>/, "");
r = r.replace(/(\s(?:href|src)=)"\/(?!\/)/g, `$1"${BASE}`);
// The rollup build injects component CSS from JS; there is no build/bundle.css.
r = r.replace(/<link rel="stylesheet" href="[^"]*build\/bundle\.css" \/>/, "");
r = r.split('"/notus-svelte"').join(JSON.stringify(BASE_NOSLASH));
if (r.includes("build/bundle.css") || !r.includes(`href="${BASE}assets/styles/tailwind.css"`)) throw new Error("patch: rollup.config.js template not rewritten");
writeFileSync("rollup.config.js", r);

// Router base + routes
replaceOnce("src/App.svelte", '<Router url="{url}">', `<Router url="{url}" basepath="${BASE_NOSLASH}">`);
replaceOnce("src/App.svelte", '<Route path="/" component="{Index}" />', '<Route path="index" component="{Index}" />');
// svelte-routing snapshots the location when it's imported, so the redirect
// lives in its own module imported before the app.
writeFileSync(
  "src/demo-start.js",
  `if (/^${BASE_NOSLASH.replace(/\//g, "\\/")}\\/?(index\\.html)?$/.test(location.pathname)) history.replaceState(null, "", ${JSON.stringify(BASE + "admin/dashboard")});\n`,
);
replaceOnce("src/main.js", 'import App from "./App.svelte";', 'import "./demo-start.js";\nimport App from "./App.svelte";');

// Links and asset strings
replaceInTree("src", /href="\/"/g, `href="${BASE}index"`, { exts: [".svelte"], min: 1 });
replaceInTree("src", /(["'])\/(admin|auth|landing|profile|assets)\b/g, (_m, q, p) => `${q}${BASE}${p}`, { exts: [".svelte", ".js"], min: 20 });

// Google Maps
replaceOnce("src/components/Maps/MapExample.svelte", "let google = window.google;", "let google = window.google;\n    if (!google || !google.maps) return;");
