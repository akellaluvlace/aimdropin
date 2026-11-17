// Helpers for the angular-etc batch patches. Like _lib.mjs, everything here
// fails loudly when the code it expects isn't there.
import { readFileSync, writeFileSync } from "node:fs";
import { replaceOnce } from "./_lib.mjs";
import { replaceInTree } from "./_react-vite.mjs";
export { replaceInTree, prefixPublicPaths } from "./_react-vite.mjs";

/** RouterModule.forRoot(routes, { useHash: true }) → history routing. */
export function dropUseHash(file) {
  replaceOnce(file, /useHash\s*:\s*true/, "useHash: false");
}

/** provideRouter(..., withHashLocation()) → history routing. */
export function dropWithHashLocation(file) {
  replaceOnce(file, /withHashLocation\(\)\s*,?/, "");
}

/**
 * Root-relative asset URLs ("/assets/x.png") in templates and TS ignore the
 * <base href>; make them relative so they resolve under the demo base.
 */
export function relativeAssets(dir = "src", folders = ["assets"], { min = 1, exts = [".html", ".ts"] } = {}) {
  const alt = folders.join("|");
  return replaceInTree(dir, new RegExp(`(["'\`(])/(${alt})/`, "g"), (_m, q, f) => `${q}${f}/`, { exts, min });
}

/** Edit angular.json (with or without trailing commas) through `fn`. */
export function editAngularJson(fn, file = "angular.json") {
  const raw = readFileSync(file, "utf8").replace(/,(\s*[}\]])/g, "$1");
  const j = JSON.parse(raw);
  fn(j);
  writeFileSync(file, JSON.stringify(j, null, 2));
}

/** Drop size budgets (old templates exceed them and fail production builds). */
export function dropBudgets() {
  editAngularJson((j) => {
    for (const p of Object.values(j.projects)) {
      const confs = p.architect?.build?.configurations ?? {};
      for (const c of Object.values(confs)) delete c.budgets;
    }
  });
}

/** Google Maps can't load in the demo sandbox: drop its <script> tag. */
export function dropGoogleMapsScript(file = "src/index.html") {
  replaceOnce(file, /<script[^>]*?\s+src="https:\/\/maps\.googleapis\.com[^"]*"[^>]*>\s*<\/script>/, "");
}

/** Make a Maps component skip map setup when Google Maps isn't loaded. */
export function guardMapsInit(file, hook = "ngOnInit") {
  replaceOnce(file, new RegExp(`${hook}\\s*\\(\\)\\s*(:\\s*void\\s*)?\\{`), (m) => `${m}\n    if (typeof google === "undefined" || !google.maps) return;`);
}
