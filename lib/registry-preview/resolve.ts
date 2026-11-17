// Walk an item's registryDependencies the way `npx shadcn add` would, so the
// preview has every file the item imports. Breadth-first from the root, so
// the root's own files are seen before anything they pull in; deduped by URL;
// capped in item count, depth and total source size so one pathological item
// can't make the proxy fetch half a registry.

import type { FetchItemResult } from "./fetch-item";
import { resolveDependencyUrl } from "./registries";
import type { RegistryItem } from "./types";

export interface ResolvedItem {
  url: string;
  item: RegistryItem;
  depth: number;
}

export interface ResolvedTree {
  items: ResolvedItem[];
  missing: { dep: string; reason: string }[];
}

export interface ResolveOpts {
  maxItems?: number;
  maxDepth?: number;
  maxBytes?: number;
}

export async function resolveRegistryTree(
  rootUrl: string,
  fetchItem: (url: string) => Promise<FetchItemResult>,
  opts: ResolveOpts = {},
): Promise<ResolvedTree> {
  const maxItems = opts.maxItems ?? 60;
  const maxDepth = opts.maxDepth ?? 6;
  const maxBytes = opts.maxBytes ?? 4 * 1024 * 1024;

  const items: ResolvedItem[] = [];
  const missing: { dep: string; reason: string }[] = [];
  const seen = new Set<string>([rootUrl]);
  let bytes = 0;
  let level: { dep: string; url: string }[] = [{ dep: rootUrl, url: rootUrl }];

  for (let depth = 0; level.length && depth <= maxDepth; depth++) {
    // One level at a time, fetched in parallel; results are consumed in
    // declaration order so the output is deterministic.
    const results = await Promise.all(level.map((l) => fetchItem(l.url)));
    const next: { dep: string; url: string }[] = [];
    for (let i = 0; i < level.length; i++) {
      const { dep, url } = level[i];
      const r = results[i];
      if (!r.ok) {
        if (depth === 0) throw new RegistryResolveError(r.status, r.error);
        missing.push({ dep, reason: r.error });
        continue;
      }
      if (items.length >= maxItems) {
        missing.push({ dep, reason: "too many dependencies" });
        continue;
      }
      const size = (r.item.files ?? []).reduce((n, f) => n + (f.content?.length ?? 0), 0);
      if (bytes + size > maxBytes && depth > 0) {
        missing.push({ dep, reason: "dependencies too large" });
        continue;
      }
      bytes += size;
      items.push({ url, item: r.item, depth });
      for (const d of r.item.registryDependencies ?? []) {
        const depUrl = resolveDependencyUrl(d);
        if (!depUrl) {
          missing.push({ dep: d, reason: "registry not allowed" });
          continue;
        }
        if (seen.has(depUrl)) continue;
        seen.add(depUrl);
        if (depth + 1 > maxDepth) {
          missing.push({ dep: d, reason: "too deep" });
          continue;
        }
        next.push({ dep: d, url: depUrl });
      }
    }
    level = next;
  }
  return { items, missing };
}

export class RegistryResolveError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "RegistryResolveError";
  }
}
