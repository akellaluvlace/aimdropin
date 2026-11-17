// Type declaration for `classify.mjs` (implementation stays .mjs so the
// indexer runs under raw Node with no build step).

import type { CatalogKind, CatalogPurpose, CatalogStack } from "../../lib/catalog/types";

export function normalizeDep(dep: unknown): string;
export function classifyKind(item: {
  registryType?: string | null;
  name?: string | null;
}): CatalogKind | null;
export function classifyPurpose(item: {
  name?: string | null;
  title?: string | null;
  description?: string | null;
  categories?: string[];
}): CatalogPurpose;
export function detectHeavyDeps(deps: string[] | undefined): string[];
export function detectStack(
  files: { path?: string; target?: string }[] | undefined
): CatalogStack | null;
export function titleFromName(name: unknown): string;
