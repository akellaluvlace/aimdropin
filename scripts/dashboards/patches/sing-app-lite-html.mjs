// Sing App Lite's committed dist/ pages load libraries from ../node_modules/,
// which the pipeline never serves (listFiles skips node_modules).
//   node sing-app-lite-html.mjs        (pre-build) point the pages at ../nm/
//   node sing-app-lite-html.mjs copy   (build) site/ = dist/ + the referenced
//                                       packages copied to site/nm/, minus their HTML;
//                                       the Google Maps page is left out
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const pages = readdirSync("dist").filter((n) => n.endsWith(".html"));
// Stylesheets reach the same packages as ../../node_modules/ (fonts, imports).
const styles = existsSync("dist/css") ? readdirSync("dist/css").filter((n) => n.endsWith(".css")).map((n) => `dist/css/${n}`) : [];

if (process.argv[2] !== "copy") {
  let changed = 0;
  for (const name of pages) {
    const file = `dist/${name}`;
    const s = readFileSync(file, "utf8");
    const out = s.split("../node_modules/").join("../nm/");
    if (out !== s) {
      writeFileSync(file, out);
      changed++;
    }
  }
  if (changed === 0) throw new Error("patch: no dist/*.html references ../node_modules/");
  for (const file of styles) {
    const s = readFileSync(file, "utf8");
    const out = s.split("../../node_modules/").join("../../nm/");
    if (out !== s) writeFileSync(file, out);
  }
  console.log(`patched ${changed} pages`);
} else {
  const pkgs = new Set();
  for (const name of pages) {
    for (const m of readFileSync(`dist/${name}`, "utf8").matchAll(/\.\.\/nm\/((?:@[^/"']+\/)?[^/"']+)\//g)) pkgs.add(m[1]);
  }
  for (const file of styles) {
    for (const m of readFileSync(file, "utf8").matchAll(/\.\.\/\.\.\/nm\/((?:@[^/"')]+\/)?[^/"')]+)\//g)) pkgs.add(m[1]);
  }
  rmSync("site", { recursive: true, force: true });
  mkdirSync("site/nm", { recursive: true });
  cpSync("dist", "site/dist", { recursive: true });
  for (const p of pkgs) {
    const from = path.join("node_modules", p);
    if (!existsSync(from)) throw new Error(`patch: package ${p} is not installed`);
    cpSync(from, path.join("site/nm", p), {
      recursive: true,
      dereference: true,
      filter: (src) => !/\.html?$/i.test(src),
    });
  }
  // Google Maps can't run in the demo sandbox (same as the static imports' ignored map pages).
  rmSync("site/dist/maps_google.html", { force: true });
  console.log(`copied ${pkgs.size} packages: ${[...pkgs].join(", ")}`);
}
