// Shared helpers for the react-cra batch (Create React App dashboards).
// Same contract as ./_lib.mjs: fail loudly when the expected code is missing.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { replaceOnce, editJson, BASE, BASE_NOSLASH } from "./_lib.mjs";

export { replaceOnce, editJson, BASE, BASE_NOSLASH };

/** Replace every occurrence of `search`; at least one must exist. */
export function replaceAll(file, search, replacement) {
  const s = readFileSync(file, "utf8");
  if (!s.includes(search)) throw new Error(`patch: ${file} doesn't contain ${search}`);
  writeFileSync(file, s.split(search).join(replacement));
}

/** `<BrowserRouter>` (or another router tag) gets the demo base as basename. */
export function addBasename(file, tag = "BrowserRouter") {
  replaceOnce(file, `<${tag}>`, `<${tag} basename=${JSON.stringify(BASE_NOSLASH)}>`);
}

/** Pin open-ended React ranges (">=16.8.0" now resolves to React 19, which these kits predate). */
export function pinReact18() {
  editJson("package.json", (p) => {
    for (const k of ["react", "react-dom"]) {
      if (p.dependencies?.[k]) p.dependencies[k] = "18.3.1";
    }
  });
}

function prefixed(s, prefixes) {
  for (const p of prefixes) {
    for (const q of ['"', "'", "`"]) s = s.split(`${q}${p}`).join(`${q}${BASE_NOSLASH}${p}`);
  }
  return s;
}

/** Root-absolute public asset paths ("/static/x.png") in source files point outside the demo. */
export function prefixPublicPaths(files, prefixes) {
  for (const file of files) {
    const s = readFileSync(file, "utf8");
    const out = prefixed(s, prefixes);
    if (out === s) throw new Error(`patch: ${file} has none of ${prefixes.join(", ")}`);
    writeFileSync(file, out);
  }
}

// readdirSync's `recursive` option needs Node 18.17+; the old CRA images run Node 16.
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/** prefixPublicPaths over every script file under `dir`; returns how many files changed (at least one). */
export function prefixPublicPathsIn(dir, prefixes) {
  let changed = 0;
  for (const file of walk(dir)) {
    if (!/\.(jsx?|tsx?)$/.test(file)) continue;
    const s = readFileSync(file, "utf8");
    const out = prefixed(s, prefixes);
    if (out !== s) {
      writeFileSync(file, out);
      changed++;
    }
  }
  if (!changed) throw new Error(`patch: nothing under ${dir} uses ${prefixes.join(", ")}`);
  return changed;
}

/**
 * Drop the Google Maps script (placeholder key; in the demo sandbox it throws a
 * cross-frame SecurityError) and let the map component bail out when it's missing.
 */
export function dropGoogleMaps(mapFile) {
  const html = readFileSync("public/index.html", "utf8");
  const out = html.replace(/[ \t]*<script src="https:\/\/maps\.googleapis\.com\/maps\/api\/js[^"]*"><\/script>\n?/, "");
  if (out === html) throw new Error("patch: public/index.html has no Google Maps script");
  writeFileSync("public/index.html", out);
  replaceOnce(mapFile, "let google = window.google;", "let google = window.google;\n    if (!google || !google.maps) return;");
}
