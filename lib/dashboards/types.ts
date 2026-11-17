// Shared shapes for imported dashboards. The pipeline in scripts/dashboards/
// reads DashboardSource entries from sources.json and writes one
// DashboardRecord per dashboard into data/dashboards/; the app reads those
// records to list dashboards in the gallery and to serve their demos.

export type DashboardLicenseId =
  | "MIT"
  | "Apache-2.0"
  | "BSD-2-Clause"
  | "BSD-3-Clause"
  | "ISC"
  | "0BSD"
  | "Unlicense"
  | "CC0-1.0";

export type DashboardFramework =
  | "html"
  | "react"
  | "next"
  | "vue"
  | "nuxt"
  | "angular"
  | "svelte"
  | "sveltekit"
  | "solid"
  | "astro"
  | "qwik";

export interface DashboardSourceLicense {
  spdx: DashboardLicenseId;
  // Path of the license file inside the repo at `sha`.
  path: string;
  // YYYY-MM-DD the license text was read.
  verifiedAt: string;
  notes?: string;
}

// Ready-made HTML is committed to the repo under `root`.
export interface StaticSite {
  kind: "static";
  root: string;
  entry: string;
  // Folders under `root` that aren't part of the demo (docs, sources).
  ignore?: string[];
}

// The site has to be built. Commands run inside `docker run <image>` with
// the repo mounted at /app and DEMO_BASE=/demos/<slug>/ in the environment.
export interface BuildSite {
  kind: "build";
  image: string;
  install: string;
  build: string;
  // Build output folder, relative to the repo root.
  out: string;
  entry: string;
  // Client-side routed app: unknown extensionless paths fall back to entry.
  spa: boolean;
  // Shell script in scripts/dashboards/patches/ run before the build.
  patch?: string;
  env?: Record<string, string>;
}

export interface DashboardSource {
  slug: string;
  title: string;
  description: string;
  repo: string;
  sha: string;
  license: DashboardSourceLicense;
  author: string;
  framework: DashboardFramework;
  // UI kit / CSS framework, e.g. "bootstrap", "tailwind", "shadcn", "mui".
  ui: string;
  category: string;
  tags: string[];
  demoUrl?: string;
  // 1-5 editorial quality score from review.
  quality: number;
  site: StaticSite | BuildSite;
  // Set when the source was reviewed and rejected; kept so nobody re-checks it.
  exclude?: string;
}

export interface DashboardPage {
  // Demo-relative path, e.g. "pages/tables.html" or "settings" for SPAs.
  path: string;
  title: string;
}

export interface DashboardCheck {
  checkedAt: string;
  pagesChecked: number;
  pagesOk: number;
  // Demo-relative paths of pages that failed, with the first problem found.
  failures: Array<{ path: string; problem: string }>;
}

// What the serving route needs to answer a request.
export interface DemoServeInfo {
  slug: string;
  // "static": committed HTML made for a domain root - folders redirect to
  // their index.html and root-relative links get the /demos/<slug> prefix.
  // "build": built by us for /demos/<slug>/, served as built.
  kind: "static" | "build";
  entry: string;
  spa: boolean;
  // jsDelivr base for files that aren't stored locally, ending in "/":
  // https://cdn.jsdelivr.net/gh/<repo>@<sha>/
  cdnBase: string | null;
  // Static sites: repo folder that maps to the demo root ("" for the repo root).
  cdnRoot: string | null;
  // Built sites: demo path → repo path for build outputs identical to a repo file.
  cdnMap: Record<string, string> | null;
}

export interface DashboardRecord {
  slug: string;
  title: string;
  description: string;
  repo: string;
  sha: string;
  license: DashboardSourceLicense & { url: string };
  author: string;
  framework: DashboardFramework;
  ui: string;
  category: string;
  tags: string[];
  demoUrl: string | null;
  quality: number;
  entry: string;
  spa: boolean;
  pages: DashboardPage[];
  // Bytes stored under demos/<slug>/ (files served from jsDelivr excluded).
  storedBytes: number;
  thumb: string | null;
  check: DashboardCheck | null;
  importedAt: string;
}
