// Helpers for build patches. Patches run inside the build container (cwd
// /app = the repo) and must fail loudly when the code they expect isn't
// there, so a changed upstream file never ships half-patched.
import { readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";

export const BASE = process.env.DEMO_BASE; // "/demos/<slug>/"
export const BASE_NOSLASH = process.env.DEMO_BASE_NOSLASH; // "/demos/<slug>"

export function replaceOnce(file, search, replacement) {
  const s = readFileSync(file, "utf8");
  const hit = typeof search === "string" ? s.indexOf(search) : s.search(search);
  if (hit === -1) throw new Error(`patch: ${file} doesn't contain ${search}`);
  writeFileSync(file, s.replace(search, replacement));
}

export function editJson(file, fn) {
  const j = JSON.parse(readFileSync(file, "utf8"));
  fn(j);
  writeFileSync(file, JSON.stringify(j, null, 2));
}

export function remove(file) {
  if (!existsSync(file)) throw new Error(`patch: ${file} is missing`);
  rmSync(file, { recursive: true, force: true });
}
