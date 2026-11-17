import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { DemoServeInfo } from "./types";

// data/dashboards/serve.json is written by scripts/dashboards/process.mjs:
// { "<slug>": DemoServeInfo }. Read once per server instance in production;
// re-read when it changes in development so a fresh import shows up.

const SERVE_PATH = path.join(process.cwd(), "data", "dashboards", "serve.json");

let cache: { mtimeMs: number; map: Record<string, DemoServeInfo> } | null = null;

export async function getDemoServeInfo(slug: string): Promise<DemoServeInfo | null> {
  try {
    if (!cache || process.env.NODE_ENV !== "production") {
      const st = await fs.stat(SERVE_PATH);
      if (!cache || cache.mtimeMs !== st.mtimeMs) {
        const map = JSON.parse(await fs.readFile(SERVE_PATH, "utf8")) as Record<string, DemoServeInfo>;
        cache = { mtimeMs: st.mtimeMs, map };
      }
    }
    return Object.prototype.hasOwnProperty.call(cache.map, slug) ? cache.map[slug] : null;
  } catch {
    return null;
  }
}
