#!/usr/bin/env node
// Catalog indexer. Reads scripts/catalog/sources.json, rejects every source
// whose license isn't verified and allowlisted, indexes the rest, and writes:
//   .cache/catalog/items.json    <- CatalogItem[] (lib/catalog/types.ts)
//   .cache/catalog/report.json   <- per-source counts, rejections, skips
// Output stays local until the Supabase catalog exists.
//
// Usage:
//   node scripts/catalog/build-catalog.mjs                  # tier 1
//   node scripts/catalog/build-catalog.mjs --tier all
//   node scripts/catalog/build-catalog.mjs --source @shadcn --max-items 20
//   node scripts/catalog/build-catalog.mjs --index-only     # skip item files

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { checkSourceLicense } from "./license.mjs";
import { createHttp } from "./http.mjs";
import { indexShadcnRegistry } from "./adapters/shadcn-registry.mjs";
import { indexComponentLibrary } from "./adapters/component-library.mjs";
import { headCommit, indexGithubTemplate, verifyRepoLicense } from "./adapters/github-template.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");
const DIRECTORY_URL = "https://ui.shadcn.com/r/registries.json";
const OFFICIAL_INDEX_URL = "https://ui.shadcn.com/r/styles/new-york-v4/registry.json";

function parseArgs(argv) {
  const args = { tier: "1", source: null, maxItems: Infinity, fetchItems: true, out: path.join(REPO_ROOT, ".cache", "catalog") };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--tier") args.tier = argv[++i];
    else if (a === "--source") args.source = argv[++i];
    else if (a === "--max-items") args.maxItems = Number(argv[++i]) || Infinity;
    else if (a === "--index-only") args.fetchItems = false;
    else if (a === "--out") args.out = path.resolve(argv[++i]);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { sources } = JSON.parse(await fs.readFile(path.join(HERE, "sources.json"), "utf-8"));
  const selected = sources.filter((s) =>
    args.source ? s.name === args.source : args.tier === "all" || String(s.tier) === args.tier
  );
  if (!selected.length) throw new Error("no sources match the given --tier / --source");

  const http = createHttp({ cacheDir: path.join(args.out, "http") });
  const report = { startedAt: new Date().toISOString(), sources: {}, rejected: {} };
  const items = [];

  // License gate first - nothing unverified is ever fetched or written.
  const approved = [];
  for (const s of selected) {
    if (s.excluded) {
      report.rejected[s.name] = `excluded: ${s.excluded}`;
      continue;
    }
    const check = checkSourceLicense(s);
    if (check.ok) approved.push({ source: s, license: check.license });
    else report.rejected[s.name] = check.reason;
  }

  let directory = null;
  const html = {};
  // Names of the official shadcn primitives, so registries' copies of them
  // can be told apart from original `registry:ui` components.
  const official = (await http.getJson(OFFICIAL_INDEX_URL)).json;
  const primitiveNames = new Set(
    (official?.items ?? []).filter((it) => it.type === "registry:ui").map((it) => it.name)
  );
  for (const { source, license } of approved) {
    if (source.kind === "html-collection") {
      html[source.name] = { source, license };
      continue;
    }
    if (source.kind === "github-template") {
      process.stdout.write(`▶ ${source.name} (${source.repo})\n`);
      try {
        const r = await indexGithubTemplate({ source, license, http });
        if (r.item) {
          items.push(r.item);
          report.sources[source.name] = { indexed: 1, commit: r.item.install.commit };
        } else {
          report.rejected[source.name] = r.reject;
        }
      } catch (e) {
        report.rejected[source.name] = String(e.message ?? e);
      }
      continue;
    }
    if (source.kind !== "shadcn-registry") {
      report.rejected[source.name] = `no adapter for kind "${source.kind}"`;
      continue;
    }
    // Registries with public source get the same LICENSE-text re-check as
    // templates, at the repo's current HEAD.
    if (source.licenseRepo) {
      try {
        const ref = await headCommit(source.licenseRepo);
        const lic = await verifyRepoLicense({ repo: source.licenseRepo, ref, spdx: license.spdx, http });
        if (!lic.ok) {
          report.rejected[source.name] = lic.reason;
          continue;
        }
      } catch (e) {
        report.rejected[source.name] = `license re-check failed: ${e.message ?? e}`;
        continue;
      }
    }
    let resolved = source;
    if (!source.url) {
      directory ??= (await http.getJson(DIRECTORY_URL)).json ?? [];
      const entry = directory.find((d) => d.name === source.name);
      if (!entry) {
        report.rejected[source.name] = "not in the shadcn directory";
        continue;
      }
      resolved = { ...source, url: entry.url, homepage: source.homepage ?? entry.homepage };
    }
    const stats = { indexed: 0, skipped: {}, total: 0, visual: 0 };
    report.sources[source.name] = stats;
    process.stdout.write(`▶ ${source.name}\n`);
    for await (const item of indexShadcnRegistry({
      source: resolved,
      license,
      http,
      maxItems: args.maxItems,
      fetchItems: args.fetchItems,
      primitiveNames,
      onEvent: (e) => {
        if (e.type === "index") Object.assign(stats, { total: e.total, visual: e.visual });
        if (e.type === "no-index") stats.error = "no item index found";
        if (e.type === "skip") stats.skipped[e.reason] = (stats.skipped[e.reason] ?? 0) + 1;
      },
    })) {
      items.push(item);
      stats.indexed++;
    }
  }

  if (Object.keys(html).length) {
    for (const name of Object.keys(html)) report.sources[name] = { indexed: 0 };
    for await (const item of indexComponentLibrary({ repoRoot: REPO_ROOT, sources: html })) {
      items.push(item);
      report.sources[item.sourceId].indexed++;
    }
  }

  report.finishedAt = new Date().toISOString();
  report.totals = summarize(items);
  await fs.mkdir(args.out, { recursive: true });
  await fs.writeFile(path.join(args.out, "items.json"), JSON.stringify(items), "utf-8");
  await fs.writeFile(path.join(args.out, "report.json"), JSON.stringify(report, null, 2), "utf-8");

  console.log(`\n${items.length} items from ${Object.keys(report.sources).length} sources`);
  console.log("by kind", report.totals.kind);
  console.log("by purpose", report.totals.purpose);
  const rejected = Object.entries(report.rejected);
  if (rejected.length) {
    console.log(`\n${rejected.length} sources rejected by the license gate:`);
    for (const [n, why] of rejected) console.log(`  ${n}: ${why}`);
  }
}

function summarize(items) {
  const count = (key) =>
    items.reduce((acc, it) => {
      acc[it[key]] = (acc[it[key]] ?? 0) + 1;
      return acc;
    }, {});
  return { items: items.length, kind: count("kind"), purpose: count("purpose"), stack: count("stack") };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
