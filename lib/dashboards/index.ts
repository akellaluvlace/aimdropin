import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { DashboardRecord } from "./types";

// Reads what scripts/dashboards/build-index.mjs writes. In development the
// files are re-read when they change, so a fresh import shows up without a
// restart.

const DATA_DIR = path.join(process.cwd(), "data", "dashboards");
const INDEX_PATH = path.join(DATA_DIR, "index.json");

let cache: { mtimeMs: number; list: DashboardRecord[]; bySlug: Map<string, DashboardRecord> } | null = null;

export async function getDashboards(): Promise<DashboardRecord[]> {
  try {
    if (!cache || process.env.NODE_ENV !== "production") {
      const st = await fs.stat(INDEX_PATH);
      if (!cache || cache.mtimeMs !== st.mtimeMs) {
        const list = JSON.parse(await fs.readFile(INDEX_PATH, "utf8")) as DashboardRecord[];
        cache = { mtimeMs: st.mtimeMs, list, bySlug: new Map(list.map((d) => [d.slug, d])) };
      }
    }
    return cache.list;
  } catch {
    return [];
  }
}

export async function getDashboard(slug: string): Promise<DashboardRecord | null> {
  await getDashboards();
  return cache?.bySlug.get(slug) ?? null;
}

// The repo's files at the pinned commit, as [path, bytes] pairs (code view).
export async function getDashboardRepoFiles(slug: string): Promise<Array<[string, number]>> {
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) return [];
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, "files", `${slug}.json`), "utf8"));
  } catch {
    return [];
  }
}
