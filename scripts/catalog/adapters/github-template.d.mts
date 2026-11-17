// Type declaration for `github-template.mjs` (implementation stays .mjs so
// the indexer runs under raw Node with no build step).

import type { CatalogFramework, CatalogItem, CatalogLicense } from "../../../lib/catalog/types";

export function headCommit(repo: string): Promise<string>;
export function verifyRepoLicense(opts: {
  repo: string;
  ref: string;
  spdx: string;
  http: { getText(url: string): Promise<{ status: number; text: unknown }> };
}): Promise<{ ok: true; file: string; text: string } | { ok: false; reason: string }>;
export function detectFramework(deps: Record<string, string> | null | undefined): CatalogFramework;
export function indexGithubTemplate(opts: {
  source: { name: string; repo: string; purpose?: string; title?: string; description?: string; demoUrl?: string };
  license: CatalogLicense;
  http: {
    getJson(url: string): Promise<{ status: number; json: unknown }>;
    getText(url: string): Promise<{ status: number; text: unknown }>;
  };
}): Promise<{ item?: CatalogItem; reject?: string }>;
