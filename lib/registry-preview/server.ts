// Process-wide state for the registry proxy routes: one item fetcher (with
// its LRU) shared by /api/registry/item and /api/registry/bundle, a plan
// cache, and a rate limiter. Browsing the library legitimately bursts (a grid
// of previews), so the limit is per-minute generous but still bounds a
// single IP from using us as a fetch relay.

import { createRateLimiter } from "@/lib/rate-limit";
import { createItemFetcher, createLru } from "./fetch-item";
import type { PreviewPlan } from "./types";

export const registryFetchItem = createItemFetcher();

export const planCache = createLru<PreviewPlan>(150);

export const registryRateLimiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

export const CACHE_HEADERS = {
  "cache-control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
};
