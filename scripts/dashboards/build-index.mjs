// Combine data/dashboards/records/*.json (+ crawl checks and thumbnails) into
//   data/dashboards/serve.json  every processed demo, so it can be served and checked
//   data/dashboards/index.json  the dashboards the gallery lists: checked and passing
// Run: node scripts/dashboards/build-index.mjs

import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readAllSources } from "./manifest.mjs";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data", "dashboards");
const THUMBS = path.join(ROOT, "public", "thumbs", "dashboards");

// A dashboard is listed when the crawl reached its entry page and at least
// this share of the pages it found loaded without broken files or errors.
export const MIN_PASS_RATE = 0.9;

export function passes(check) {
  if (!check || check.pagesChecked === 0) return false;
  if (check.failures.some((f) => f.path === "(entry)")) return false;
  return check.pagesOk / check.pagesChecked >= MIN_PASS_RATE;
}

// Listed pages that aren't real template pages (see page-excludes.json).
function loadPageExcludes() {
  const file = path.join(ROOT, "scripts", "dashboards", "page-excludes.json");
  if (!existsSync(file)) return () => false;
  const { patterns = [], pages = {} } = JSON.parse(readFileSync(file, "utf8"));
  const res = patterns.map((p) => new RegExp(p));
  return (slug, pagePath) => res.some((re) => re.test(pagePath)) || (pages[slug] ?? []).includes(pagePath);
}

// Readers (the running app) never see a half-written file.
function writeAtomic(file, text) {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}

export function buildIndex({ includeUnchecked = false } = {}) {
  const recDir = path.join(DATA_DIR, "records");
  const serve = {};
  const listed = [];
  const files = existsSync(recDir) ? readdirSync(recDir).filter((f) => f.endsWith(".json")) : [];
  // A source marked excluded (e.g. after a license review) is never served,
  // even if an older import left its record behind.
  const excluded = new Set(readAllSources().filter((s) => s && s.exclude).map((s) => s.slug));
  const junkPage = loadPageExcludes();
  for (const file of files.sort()) {
    const { record, serve: info } = JSON.parse(readFileSync(path.join(recDir, file), "utf8"));
    if (excluded.has(record.slug)) continue;
    serve[record.slug] = info;
    const checkPath = path.join(DATA_DIR, "check", `${record.slug}.json`);
    const check = existsSync(checkPath) ? JSON.parse(readFileSync(checkPath, "utf8")) : null;
    const thumbFile = path.join(THUMBS, `${record.slug}.webp`);
    const full = {
      ...record,
      check,
      // The crawl knows which pages are reachable; prefer its list.
      pages: (check?.pages?.length ? check.pages : record.pages).filter((p) => !junkPage(record.slug, p.path)),
      thumb: existsSync(thumbFile) ? `/thumbs/dashboards/${record.slug}.webp` : null,
    };
    if (check) delete full.check.pages;
    if (passes(check) || (includeUnchecked && !check)) listed.push(full);
  }
  listed.sort((a, b) => b.quality - a.quality || a.title.localeCompare(b.title));
  writeAtomic(path.join(DATA_DIR, "serve.json"), JSON.stringify(serve));
  writeAtomic(path.join(DATA_DIR, "index.json"), JSON.stringify(listed));
  return { served: Object.keys(serve).length, listed: listed.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = buildIndex({ includeUnchecked: process.argv.includes("--include-unchecked") });
  console.log(`serve.json: ${r.served} demos · index.json: ${r.listed} listed`);
}
