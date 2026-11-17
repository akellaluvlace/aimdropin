// Maps the already-ingested HTML component library (Uiverse + HyperUI, see
// scripts/ingest-components.mjs) into CatalogItems. Reads the existing
// public/data/components/index.json - no network.

import { promises as fs } from "node:fs";
import path from "node:path";
import { classifyPurpose } from "../classify.mjs";

// The library's own categories that are whole sections rather than small
// components. Everything else maps to "component".
const SECTION_CATEGORIES = new Set(["footers", "navbars", "pricing", "stats", "tables"]);

/**
 * @param {object} opts
 * @param {string} opts.repoRoot
 * @param {Record<string, { source: object, license: import("../../../lib/catalog/types").CatalogLicense }>} opts.sources
 *   keyed by the library's `source` value ("uiverse", "hyperui")
 * @returns {AsyncGenerator<import("../../../lib/catalog/types").CatalogItem>}
 */
export async function* indexComponentLibrary({ repoRoot, sources }) {
  const indexPath = path.join(repoRoot, "public", "data", "components", "index.json");
  const index = JSON.parse(await fs.readFile(indexPath, "utf-8"));
  const now = new Date().toISOString();
  for (const c of index.components) {
    const s = sources[c.source];
    if (!s) continue; // source not approved in sources.json
    yield {
      id: `${s.source.name}/${c.slug}`,
      sourceId: s.source.name,
      sourceKind: "html-collection",
      name: c.slug,
      title: c.title,
      description: null,
      kind: SECTION_CATEGORIES.has(c.category) ? "section" : "component",
      purpose: classifyPurpose({ name: c.slug, title: c.title, categories: [c.category, ...(c.tags ?? [])] }),
      registryType: null,
      stack: "html",
      dependencies: [],
      registryDependencies: [],
      heavyDeps: [],
      categories: [c.category],
      license: s.license,
      author: c.author,
      homepage: s.source.homepage ?? null,
      sourceUrl: c.sourceUrl,
      install: { method: "editor" },
      previewStatus: "ok",
      contentHash: null,
      indexedAt: now,
    };
  }
}
