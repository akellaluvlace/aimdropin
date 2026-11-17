// Type declaration for `shadcn-registry.mjs` (implementation stays .mjs so
// the indexer runs under raw Node with no build step).

import type { CatalogItem, CatalogLicense } from "../../../lib/catalog/types";

export interface RegistrySource {
  name?: string;
  url: string;
  indexUrl?: string;
  style?: string;
  homepage?: string;
  bareInstall?: boolean;
  includeUi?: boolean;
}

export function indexCandidates(source: RegistrySource): string[];
export function itemUrl(source: RegistrySource, name: string): string;
export function indexShadcnRegistry(opts: {
  source: RegistrySource & { name: string };
  license: CatalogLicense;
  http: { getJson(url: string): Promise<{ status: number; json: unknown; fromCache: boolean; error?: string }> };
  maxItems?: number;
  fetchItems?: boolean;
  primitiveNames?: Set<string>;
  onEvent?: (e: Record<string, unknown>) => void;
}): AsyncGenerator<CatalogItem>;
