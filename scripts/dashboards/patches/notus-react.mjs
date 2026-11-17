// BrowserRouter needs the demo base. The demo opens on the admin dashboard;
// the UI-kit landing page moves from / to /index and the logo links follow it.
import { addBasename, replaceOnce, replaceAll } from "./_react-cra.mjs";
addBasename("src/index.js");
replaceOnce(
  "src/index.js",
  '<Route path="/" exact component={Index} />',
  '<Route path="/index" exact component={Index} />\n      <Redirect exact from="/" to="/admin/dashboard" />',
);
for (const f of [
  "src/components/Sidebar/Sidebar.js",
  "src/components/Navbars/AuthNavbar.js",
  "src/components/Navbars/IndexNavbar.js",
  "src/views/Landing.js",
]) {
  replaceAll(f, 'to="/"', 'to="/index"');
}
// Unpinned installs hoist ajv 6, which ajv-keywords 5 (via react-scripts 5) can't load.
import { editJson } from "./_react-cra.mjs";
editJson("package.json", (p) => {
  p.dependencies.ajv = "^8.12.0";
});
import { dropGoogleMaps } from "./_react-cra.mjs";
dropGoogleMaps("src/components/Maps/MapExample.js");
// With react-scripts 5, require("x.png") is the URL itself (".default" is undefined); SVGs still need .default.
import { readFileSync as rf, writeFileSync as wf, readdirSync as rd, statSync as st } from "node:fs";
let fixed = 0;
const walkDir = (d) => rd(d).forEach((n) => {
  const p = `${d}/${n}`;
  if (st(p).isDirectory()) return walkDir(p);
  if (!p.endsWith(".js")) return;
  const s = rf(p, "utf8");
  const out = s.replace(/(require\("[^"]+\.(?:png|jpe?g|gif)"\))\.default/g, "$1");
  if (out !== s) { wf(p, out); fixed++; }
});
walkDir("src");
if (!fixed) throw new Error("patch: no require(...).default left to fix");
