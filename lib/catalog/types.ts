// Shared types for the unified catalog - one record shape for every source
// (shadcn registries, the HTML component library, AIMdropin templates and,
// later, community uploads). Produced by the Node-side indexer in
// `scripts/catalog/` (typed there via JSDoc, same convention as
// `lib/component-library/types.ts`) and read by search, /components and MCP.

// "page" = a whole screen (landing page, dashboard, login). "section" = a
// block meant to be stacked into a page (hero, pricing, sidebar). Anything
// smaller is a "component".
export type CatalogKind = "page" | "section" | "component";

export type CatalogPurpose =
  | "landing"
  | "dashboard"
  | "auth"
  | "ecommerce"
  | "blog"
  | "docs"
  | "general";

export type CatalogStack = "react-tsx" | "react-jsx" | "html";

export type CatalogSourceKind =
  | "shadcn-registry"
  | "html-collection"
  | "github-template"
  | "aimdropin"
  | "community";

// Licenses we are allowed to index. Anything else is rejected at index time
// by `isAllowedLicense` - see scripts/catalog/license.mjs.
export type AllowedLicense =
  | "MIT"
  | "Apache-2.0"
  | "BSD-2-Clause"
  | "BSD-3-Clause"
  | "ISC"
  | "0BSD"
  | "Unlicense"
  | "CC0-1.0";

export interface CatalogLicense {
  spdx: AllowedLicense;
  // The exact LICENSE file or terms page a human (or agent) read to verify it.
  url: string;
  verifiedAt: string;
  // Whole-app templates: sha1 of the LICENSE text at the indexed commit, so
  // the exact terms we relied on can be shown later.
  textHash?: string;
  // Freemium sources: the license only covers the free items; paid items are
  // detected at fetch time (HTTP 401/402/403) and never indexed.
  freeOnly: boolean;
}

export type InstallMethod =
  | { method: "shadcn"; command: string; url: string }
  // Whole-app templates: a pinned snapshot of the repo.
  | { method: "clone"; command: string; repo: string; commit: string }
  | { method: "copy" }
  | { method: "editor" };

export type CatalogFramework = "next" | "react" | "astro" | "html";

export interface CatalogItem {
  // `${sourceId}/${name}` - stable across re-indexes.
  id: string;
  sourceId: string;
  sourceKind: CatalogSourceKind;
  name: string;
  title: string;
  description: string | null;
  kind: CatalogKind;
  purpose: CatalogPurpose;
  // Raw shadcn `type` (registry:block, registry:page…), null for non-registry.
  registryType: string | null;
  stack: CatalogStack | null;
  // Set for whole-app templates; registry items run in any React app.
  framework?: CatalogFramework | null;
  dependencies: string[];
  registryDependencies: string[];
  // Subset of `dependencies` that drives the "heavy deps" filter.
  heavyDeps: string[];
  categories: string[];
  license: CatalogLicense;
  author: string | null;
  homepage: string | null;
  sourceUrl: string;
  install: InstallMethod;
  previewStatus: "unknown" | "ok" | "failed";
  // sha1 of the item's file contents; null when only the index was read.
  contentHash: string | null;
  indexedAt: string;
}
