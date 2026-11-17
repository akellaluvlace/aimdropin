// Airmill (SvelteKit): adapter-static + demo base, prerender every page,
// root links through $app/paths base.
import { writeFileSync, existsSync } from "node:fs";
import { staticSvelteConfig, svelteBaseLinks } from "./_svelte.mjs";
staticSvelteConfig();
if (existsSync("src/routes/+layout.ts") || existsSync("src/routes/+layout.js")) throw new Error("patch: layout module already exists");
writeFileSync("src/routes/+layout.ts", "export const prerender = true;\nexport const trailingSlash = 'always';\n");
svelteBaseLinks("src", { min: 10 });
