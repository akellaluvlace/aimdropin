// shadcn registry adapter: reads a registry's item index, fetches each visual
// item's own JSON (the index often omits dependencies and never carries the
// code), and normalizes it into a CatalogItem. Paid / private items on
// freemium registries answer 401/402/403 and are skipped, never indexed.

import { createHash } from "node:crypto";
import { PAID_STATUSES } from "../license.mjs";
import {
  classifyKind,
  classifyPurpose,
  detectHeavyDeps,
  detectStack,
  normalizeDep,
  titleFromName,
} from "../classify.mjs";

/**
 * Where a registry's item index lives. Most publish `<base>/registry.json`
 * next to their `{name}` item URLs; a few use `index` or a root registry.json.
 * `{style}` templates (e.g. @initium) are filled with the source's `style`.
 */
export function indexCandidates(source) {
  if (source.indexUrl) return [source.indexUrl];
  const tpl = fillStyle(source.url, source.style);
  if (!tpl.includes("{name}")) return [];
  const base = tpl.slice(0, tpl.indexOf("{name}"));
  return [
    tpl.replace("{name}", "registry"),
    tpl.replace("{name}", "index"),
    base.replace(/\/r\/$/, "/") + "registry.json",
  ];
}

export function itemUrl(source, name) {
  return fillStyle(source.url, source.style).replace("{name}", name);
}

function fillStyle(url, style) {
  return url.includes("{style}") ? url.replace("{style}", style ?? "new-york") : url;
}

function itemsOf(json) {
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.items)) return json.items;
  return null;
}

/**
 * @param {object} opts
 * @param {object} opts.source   entry from sources.json (name, url, homepage, …)
 * @param {import("../../../lib/catalog/types").CatalogLicense} opts.license
 * @param {{ getJson: Function }} opts.http
 * @param {number} [opts.maxItems]
 * @param {boolean} [opts.fetchItems] false = index-only (fast, less accurate)
 * @param {Set<string>} [opts.primitiveNames] official shadcn `registry:ui` names
 * @param {(e: object) => void} [opts.onEvent]
 * @returns {AsyncGenerator<import("../../../lib/catalog/types").CatalogItem>}
 */
export async function* indexShadcnRegistry({
  source,
  license,
  http,
  maxItems = Infinity,
  fetchItems = true,
  primitiveNames = new Set(),
  onEvent = () => {},
}) {
  let index = null;
  for (const u of indexCandidates(source)) {
    const r = await http.getJson(u);
    const items = itemsOf(r.json);
    if (items?.length) {
      index = items;
      break;
    }
  }
  if (!index) {
    onEvent({ type: "no-index", source: source.name });
    return;
  }

  // Most registries re-ship copies of the shadcn primitives (button, card…)
  // as `registry:ui` - 33k of them in the Phase 0 crawl. Those copies are
  // skipped by name; original `registry:ui` work (Motion Primitives ships
  // all its components that way) is kept. `includeUi` keeps everything.
  const visual = index.filter(
    (it) =>
      it?.name &&
      (it.type !== "registry:ui" || source.includeUi === true || !primitiveNames.has(it.name)) &&
      classifyKind({ registryType: it.type, name: it.name })
  );
  const picked = visual.slice(0, maxItems);
  onEvent({ type: "index", source: source.name, total: index.length, visual: visual.length, picked: picked.length });

  // Fetch item files in small parallel batches; http.mjs caps per-host load.
  const BATCH = 8;
  for (let i = 0; i < picked.length; i += BATCH) {
    const chunk = picked.slice(i, i + BATCH);
    const results = await Promise.all(
      chunk.map(async (entry) => {
        // Some freemium indexes flag paid items (e.g. @shadcnstore "paid": true).
        if (entry.paid === true || entry.meta?.paid === true || entry.meta?.pro === true) {
          return { entry, skip: "paid" };
        }
        if (!fetchItems) return { entry, full: null };
        const r = await http.getJson(itemUrl(source, entry.name));
        if (PAID_STATUSES.includes(r.status)) return { entry, skip: "paid" };
        if (!r.json) return { entry, skip: r.error ?? "error" };
        return { entry, full: r.json };
      })
    );
    for (const res of results) {
      if (res.skip) {
        onEvent({ type: "skip", source: source.name, name: res.entry.name, reason: res.skip });
        continue;
      }
      yield toCatalogItem({ source, license, entry: res.entry, full: res.full });
    }
  }
}

function toCatalogItem({ source, license, entry, full }) {
  const it = { ...entry, ...(full ?? {}) };
  const files = Array.isArray(it.files) ? it.files : [];
  const deps = [...new Set((it.dependencies ?? []).map(normalizeDep).filter(Boolean))];
  const content = files.map((f) => f.content ?? "").join("\n");
  const kind = classifyKind({ registryType: it.type, name: it.name });
  const url = itemUrl(source, it.name);
  return {
    id: `${source.name}/${it.name}`,
    sourceId: source.name,
    sourceKind: "shadcn-registry",
    name: it.name,
    title: it.title || titleFromName(it.name),
    description: it.description || null,
    kind,
    purpose: classifyPurpose({ name: it.name, title: it.title, description: it.description, categories: it.categories }),
    registryType: it.type ?? null,
    stack: detectStack(files),
    dependencies: deps,
    registryDependencies: it.registryDependencies ?? [],
    heavyDeps: detectHeavyDeps(deps),
    categories: it.categories ?? [],
    license,
    author: it.author ?? null,
    homepage: source.homepage ?? null,
    sourceUrl: it.meta?.links?.doc ?? source.homepage ?? url,
    install: {
      method: "shadcn",
      // The official registry installs by bare name; directory registries
      // install by namespace with no components.json setup.
      command: source.bareInstall
        ? `npx shadcn@latest add ${it.name}`
        : `npx shadcn@latest add ${source.name}/${it.name}`,
      url,
    },
    previewStatus: "unknown",
    contentHash: content ? createHash("sha1").update(content).digest("hex") : null,
    indexedAt: new Date().toISOString(),
  };
}
