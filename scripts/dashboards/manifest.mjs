// Gate for scripts/dashboards/sources.json. A dashboard is downloaded only
// when its entry names a pinned commit and a license someone read at that
// commit, and every path it gives stays inside the repo. Excluded entries
// stay in the file (so nobody re-reviews them) and are set aside here.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ALLOWED_LICENSES } from "../catalog/license.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SOURCES_PATH = path.join(HERE, "sources.json");
// More sources, one file per batch (so parallel importers never edit the same file).
export const SOURCES_DIR = path.join(HERE, "sources");

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
const SHA_RE = /^[0-9a-f]{40}$/;
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** A repo-relative path that can't escape the repo. "." means the root. */
function isSafeRelPath(p) {
  if (typeof p !== "string" || p.length === 0) return false;
  if (p === ".") return true;
  if (p.startsWith("/") || p.includes("\\") || p.includes("\0")) return false;
  return p.split("/").every((seg) => seg !== ".." && seg !== "");
}

function nonEmpty(v) {
  return typeof v === "string" && v.trim().length > 0;
}

/** @param {any} s @returns {string[]} problems, empty when valid */
function problemsOf(s) {
  const out = [];
  if (!SLUG_RE.test(s.slug ?? "")) out.push("slug must be lowercase letters, digits and dashes");
  for (const key of ["title", "description", "author", "framework", "ui", "category"]) {
    if (!nonEmpty(s[key])) out.push(`${key} is required`);
  }
  if (!REPO_RE.test(s.repo ?? "")) out.push("repo must be owner/name");
  if (!SHA_RE.test(s.sha ?? "")) out.push("sha must be a full 40-character lowercase commit sha");
  if (!Array.isArray(s.tags)) out.push("tags must be an array");
  if (typeof s.quality !== "number" || s.quality < 1 || s.quality > 5) out.push("quality must be 1-5");

  const lic = s.license ?? {};
  if (!ALLOWED_LICENSES.includes(lic.spdx)) out.push(`license ${lic.spdx ?? "(none)"} is not allowed`);
  if (!isSafeRelPath(lic.path) || lic.path === ".") out.push("license path is required");
  if (!DATE_RE.test(lic.verifiedAt ?? "")) out.push("license.verifiedAt must be YYYY-MM-DD");

  const site = s.site ?? {};
  if (site.kind === "static") {
    if (!isSafeRelPath(site.root)) out.push("site.root must be a path inside the repo");
    if (!isSafeRelPath(site.entry) || site.entry === ".") out.push("site.entry must be a path inside the site");
    if (site.ignore !== undefined && !(Array.isArray(site.ignore) && site.ignore.every(isSafeRelPath))) {
      out.push("site.ignore must list paths inside the site");
    }
  } else if (site.kind === "build") {
    for (const key of ["image", "install", "build"]) {
      if (!nonEmpty(site[key])) out.push(`site.${key} is required`);
    }
    // "." = the repo itself (an install-only build that serves committed HTML).
    if (!isSafeRelPath(site.out)) out.push("site.out must be a folder inside the repo");
    if (!isSafeRelPath(site.entry) || site.entry === ".") out.push("site.entry must be a path inside the build output");
    if (typeof site.spa !== "boolean") out.push("site.spa must be true or false");
    if (site.patch !== undefined && !/^[a-z0-9][a-z0-9.-]*\.(sh|mjs)$/.test(site.patch)) {
      out.push("site.patch must name a .sh or .mjs file in scripts/dashboards/patches/");
    }
  } else {
    out.push('site.kind must be "static" or "build"');
  }
  return out;
}

/**
 * @param {unknown[]} list
 * @returns {{ ok: any[], excluded: Array<{ slug: string, reason: string }>, errors: string[] }}
 */
export function validateSources(list) {
  const ok = [];
  const excluded = [];
  const errors = [];
  const seen = new Set();
  for (const raw of list) {
    const s = /** @type {any} */ (raw ?? {});
    const name = typeof s.slug === "string" && s.slug ? s.slug : "(no slug)";
    if (nonEmpty(s.exclude)) {
      excluded.push({ slug: name, reason: s.exclude });
      continue;
    }
    const problems = problemsOf(s);
    if (problems.length) {
      errors.push(...problems.map((p) => `${name}: ${p}`));
      continue;
    }
    if (seen.has(s.slug)) {
      errors.push(`${name}: duplicate slug ${s.slug}`);
      continue;
    }
    seen.add(s.slug);
    ok.push(s);
  }
  return { ok, excluded, errors };
}

/** Every source: sources.json plus each sources/*.json fragment. */
export function readAllSources(file = SOURCES_PATH, dir = SOURCES_DIR) {
  const list = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : [];
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
      list.push(...JSON.parse(readFileSync(path.join(dir, f), "utf8")));
    }
  }
  return list;
}

/** Read and validate every source; throws when any entry is invalid. */
export function loadSources(file = SOURCES_PATH, dir = SOURCES_DIR) {
  const list = readAllSources(file, dir);
  const result = validateSources(list);
  if (result.errors.length) {
    throw new Error(`sources.json has problems:\n${result.errors.join("\n")}`);
  }
  return result;
}
