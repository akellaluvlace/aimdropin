// Helpers for the react-vite batch patches. Like _lib.mjs, everything here
// fails loudly when the code it expects isn't there.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { BASE } from "./_lib.mjs";

function walk(dir, exts, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, exts, out);
    else if (exts.includes(path.extname(name))) out.push(p);
  }
  return out;
}

/**
 * Replace a pattern in every source file under `dir`; throws when fewer
 * than `min` replacements were made.
 */
export function replaceInTree(dir, search, replacement, { exts = [".js", ".jsx", ".ts", ".tsx"], min = 1 } = {}) {
  const re = search instanceof RegExp ? new RegExp(search.source, search.flags.includes("g") ? search.flags : search.flags + "g") : null;
  let total = 0;
  for (const file of walk(dir, exts)) {
    const s = readFileSync(file, "utf8");
    const n = re ? (s.match(re) ?? []).length : s.split(search).length - 1;
    const next = re ? s.replace(re, replacement) : s.split(search).join(replacement);
    if (n) {
      writeFileSync(file, next);
      total += n;
    }
  }
  if (total < min) throw new Error(`patch: expected at least ${min} replacement(s) of ${search} under ${dir}, made ${total}`);
  return total;
}

/**
 * Root-relative public files ("/img/x.png" in JS strings) don't follow the
 * bundler base; prefix them with the demo base. `folders` are the public
 * sub-folders to rewrite, e.g. ["img", "images"].
 */
export function prefixPublicPaths(dir, folders, opts = {}) {
  const alt = folders.map((f) => f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const re = new RegExp(`(["'\`])/(${alt})/`, "g");
  return replaceInTree(dir, re, (_m, q, folder) => `${q}${BASE}${folder}/`, opts);
}
