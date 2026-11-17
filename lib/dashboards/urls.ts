// URLs for a dashboard's live demo, its source and its download.

import type { DashboardRecord } from "./types";

type DemoTarget = Pick<DashboardRecord, "slug" | "spa" | "entry">;

/** Demo URL of a page; "" is the entry (client-routed apps start at the root). */
export function demoPageUrl(d: DemoTarget, pagePath = ""): string {
  const base = `/demos/${d.slug}/`;
  if (pagePath) return base + pagePath.replace(/^\/+/, "");
  return d.spa ? base : base + d.entry;
}

export function repoUrl(d: Pick<DashboardRecord, "repo" | "sha">): string {
  return `https://github.com/${d.repo}/tree/${d.sha}`;
}

/** The original source at the pinned commit, as GitHub serves it. */
export function zipUrl(d: Pick<DashboardRecord, "repo" | "sha">): string {
  return `https://codeload.github.com/${d.repo}/zip/${d.sha}`;
}

export function rawFileUrl(d: Pick<DashboardRecord, "repo" | "sha">, filePath: string): string {
  return `https://raw.githubusercontent.com/${d.repo}/${d.sha}/${filePath.split("/").map(encodeURIComponent).join("/")}`;
}
