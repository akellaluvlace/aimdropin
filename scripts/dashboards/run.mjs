// Import every dashboard in sources.json: download at the pinned sha, build
// in Docker when needed, copy into demos/ + public/demos/, then rebuild the
// serve map. Resumable: a dashboard already imported at the same sha is
// skipped unless --force. Results go to data/dashboards/log/<slug>.json.
//
//   node scripts/dashboards/run.mjs [--only a,b] [--kind static|build]
//        [--concurrency 4] [--build-concurrency 2] [--force]
// Then (app running): node scripts/dashboards/check.mjs && node scripts/dashboards/build-index.mjs

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readAllSources, validateSources } from "./manifest.mjs";
import { CACHE_ROOT, fetchRepo } from "./fetch.mjs";
import { buildSite } from "./build.mjs";
import { DATA_DIR, processSite } from "./process.mjs";
import { buildIndex } from "./build-index.mjs";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
}
const ONLY = arg("only", "") ? new Set(arg("only", "").split(",")) : null;
const KIND = arg("kind", "");
const FORCE = process.argv.includes("--force");
// Re-copy already downloaded/built sites (after a process.mjs change): no
// download, no Docker build.
const REPROCESS = process.argv.includes("--reprocess");
// One log file per dashboard, so parallel importers never overwrite each other.
const LOG_DIR = path.join(DATA_DIR, "log");

function alreadyImported(source) {
  const p = path.join(DATA_DIR, "records", `${source.slug}.json`);
  if (!existsSync(p)) return false;
  try {
    return JSON.parse(readFileSync(p, "utf8")).record.sha === source.sha;
  } catch {
    return false;
  }
}

async function importOne(source) {
  const t0 = Date.now();
  const root = path.join(CACHE_ROOT, source.slug);
  const srcDir = path.join(root, "src");
  let step = "download";
  try {
    let siteDir;
    if (REPROCESS) {
      siteDir = source.site.kind === "build" ? path.join(root, "work", source.site.out) : path.join(srcDir, source.site.root);
      if (!existsSync(siteDir)) throw new Error(`nothing to reprocess at ${siteDir}`);
      step = "process";
      const { record } = await processSite({ source, repoDir: srcDir, siteDir });
      return { ok: true, pages: record.pages.length, storedMB: +(record.storedBytes / 1048576).toFixed(2), seconds: Math.round((Date.now() - t0) / 1000) };
    }
    await fetchRepo(source.repo, source.sha, srcDir);
    if (source.site.kind === "build") {
      step = "build";
      siteDir = await buildSite(source, srcDir, path.join(root, "work"), { logFile: path.join(root, "build.log") });
    } else {
      siteDir = path.join(srcDir, source.site.root);
    }
    step = "process";
    const { record } = await processSite({ source, repoDir: srcDir, siteDir });
    return { ok: true, pages: record.pages.length, storedMB: +(record.storedBytes / 1048576).toFixed(2), seconds: Math.round((Date.now() - t0) / 1000) };
  } catch (e) {
    return { ok: false, step, error: String(e.message ?? e).slice(0, 900), seconds: Math.round((Date.now() - t0) / 1000) };
  }
}

async function pool(items, n, fn) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: Math.min(n, queue.length) }, async () => {
      while (queue.length) await fn(queue.shift());
    }),
  );
}

async function main() {
  // Invalid entries are reported and skipped, so one bad entry (from any
  // batch file) never blocks the others.
  const { ok, errors } = validateSources(readAllSources());
  const relevant = ONLY ? errors.filter((e) => ONLY.has(e.split(":")[0])) : errors;
  for (const e of relevant) console.error(`invalid source - ${e}`);
  if (ONLY) {
    const known = new Set(ok.map((s) => s.slug));
    for (const slug of ONLY) if (!known.has(slug)) console.error(`${slug}: not a valid source (see errors above) or not found`);
  }
  const todo = ok.filter(
    (s) => (!ONLY || ONLY.has(s.slug)) && (!KIND || s.site.kind === KIND) && (FORCE || REPROCESS || !alreadyImported(s)),
  );
  console.log(`${todo.length} to import (${ok.length} valid sources)`);
  mkdirSync(LOG_DIR, { recursive: true });
  const runOne = async (s) => {
    const r = await importOne(s);
    writeFileSync(path.join(LOG_DIR, `${s.slug}.json`), JSON.stringify({ ...r, sha: s.sha, at: new Date().toISOString() }, null, 2));
    console.log(r.ok ? `✓ ${s.slug} - ${r.pages} pages, ${r.storedMB} MB, ${r.seconds}s` : `✗ ${s.slug} - ${r.step}: ${r.error.split("\n")[0].slice(0, 200)}`);
  };
  await Promise.all([
    pool(todo.filter((s) => s.site.kind === "static"), Number(arg("concurrency", "4")), runOne),
    pool(todo.filter((s) => s.site.kind === "build"), Number(arg("build-concurrency", "2")), runOne),
  ]);
  const idx = buildIndex();
  console.log(`serve.json: ${idx.served} demos · index.json: ${idx.listed} listed (after checks)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
