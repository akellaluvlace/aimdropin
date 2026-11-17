// Helpers for SvelteKit patches in the angular-etc batch. Like _lib.mjs,
// everything here fails loudly when the code it expects isn't there.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".svelte")) out.push(p);
  }
  return out;
}

/**
 * Prefix root-absolute href/src attributes in .svelte files with SvelteKit's
 * `base` (importing it from $app/paths where needed). Throws when fewer than
 * `min` attributes were rewritten.
 */
export function svelteBaseLinks(dir = "src", { min = 1 } = {}) {
  let total = 0;
  for (const file of walk(dir)) {
    const s = readFileSync(file, "utf8");
    let n = 0;
    let t = s.replace(/(\s(?:href|src)=)"\/(?!\/)([^"]*)"/g, (_m, lead, rest) => {
      n++;
      return `${lead}"{base}/${rest}"`;
    });
    if (!n) continue;
    total += n;
    const imp = "import { base } from '$app/paths';";
    // Instance script: a <script> without context="module" / module attribute.
    const m = t.match(/<script(?![^>]*\b(?:context="module"|module)\b)[^>]*>/);
    t = m ? t.replace(m[0], `${m[0]}\n\t${imp}`) : `<script>\n\t${imp}\n</script>\n\n${t}`;
    writeFileSync(file, t);
  }
  if (total < min) throw new Error(`patch: expected at least ${min} root links under ${dir}, rewrote ${total}`);
  return total;
}

/** A SvelteKit config with adapter-static, the demo base and prerendering. */
export function staticSvelteConfig({ fallback = null, preprocess = "vitePreprocess()", preprocessImport = "import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';" } = {}) {
  writeFileSync(
    "svelte.config.js",
    `import adapter from '@sveltejs/adapter-static';
${preprocessImport}
export default {
  preprocess: ${preprocess},
  kit: {
    adapter: adapter({ pages: 'build', assets: 'build', fallback: ${JSON.stringify(fallback)}, strict: false }),
    paths: { base: ${JSON.stringify(process.env.DEMO_BASE_NOSLASH)}, relative: false },
    prerender: { handleHttpError: 'warn', handleMissingId: 'warn' },
  },
};
`,
  );
}
