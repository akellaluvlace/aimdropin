// Server-side fetch of one registry item, shared by /api/registry/item and
// /api/registry/bundle. Every hop (including redirects, which are followed by
// hand) must stay on the allowlist; no cookies or auth headers are ever sent;
// bodies are capped and parsed as JSON. Results, including failures, are kept
// in a small LRU so a popular dashboard doesn't refetch its 20 primitives on
// every view.

import { isAllowedRegistryUrl } from "./registries";
import type { RegistryItem } from "./types";

export type FetchItemResult =
  | { ok: true; item: RegistryItem; finalUrl: string }
  | { ok: false; status: number; error: string };

export interface ItemFetcherOpts {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
  cacheSize?: number;
  // How long a failure is remembered before retrying.
  errorTtlMs?: number;
  now?: () => number;
}

const MAX_REDIRECTS = 3;

export function createLru<V>(max: number) {
  const map = new Map<string, V>();
  return {
    get(k: string): V | undefined {
      const v = map.get(k);
      if (v !== undefined) {
        map.delete(k);
        map.set(k, v);
      }
      return v;
    },
    set(k: string, v: V) {
      map.delete(k);
      map.set(k, v);
      while (map.size > max) map.delete(map.keys().next().value as string);
    },
    get size() {
      return map.size;
    },
  };
}

export function isRegistryItem(json: unknown): json is RegistryItem {
  if (!json || typeof json !== "object") return false;
  const j = json as Record<string, unknown>;
  return typeof j.name === "string" && (j.files === undefined || Array.isArray(j.files));
}

export function createItemFetcher(opts: ItemFetcherOpts = {}) {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 15_000;
  const maxBytes = opts.maxBytes ?? 2 * 1024 * 1024;
  const errorTtlMs = opts.errorTtlMs ?? 5 * 60_000;
  const now = opts.now ?? Date.now;
  const cache = createLru<{ result: FetchItemResult; at: number }>(opts.cacheSize ?? 500);
  const inflight = new Map<string, Promise<FetchItemResult>>();

  async function load(url: string): Promise<FetchItemResult> {
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isAllowedRegistryUrl(current)) {
        return { ok: false, status: 403, error: `host not allowed: ${safeHost(current)}` };
      }
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      let res: Response;
      try {
        res = await fetchImpl(current, {
          redirect: "manual",
          credentials: "omit",
          headers: { accept: "application/json" },
          signal: ctrl.signal,
        });
      } catch (e) {
        clearTimeout(timer);
        const aborted = e instanceof Error && e.name === "AbortError";
        return { ok: false, status: aborted ? 504 : 502, error: aborted ? "timeout" : "network error" };
      }
      try {
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get("location");
          if (!loc) return { ok: false, status: 502, error: "redirect without location" };
          current = new URL(loc, current).toString();
          continue;
        }
        if (!res.ok) return { ok: false, status: res.status, error: `upstream ${res.status}` };
        const len = Number(res.headers.get("content-length") ?? "0");
        if (len > maxBytes) return { ok: false, status: 413, error: "item too large" };
        const text = await res.text();
        if (text.length > maxBytes) return { ok: false, status: 413, error: "item too large" };
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          return { ok: false, status: 502, error: "not JSON" };
        }
        if (!isRegistryItem(json)) return { ok: false, status: 502, error: "not a registry item" };
        return { ok: true, item: json, finalUrl: current };
      } finally {
        clearTimeout(timer);
      }
    }
    return { ok: false, status: 508, error: "too many redirects" };
  }

  return async function fetchItem(url: string): Promise<FetchItemResult> {
    const hit = cache.get(url);
    if (hit && (hit.result.ok || now() - hit.at < errorTtlMs)) return hit.result;
    const pending = inflight.get(url);
    if (pending) return pending;
    const p = load(url).then((result) => {
      // Transient upstream trouble (timeouts, 5xx) isn't cached at all.
      if (result.ok || result.status < 500) cache.set(url, { result, at: now() });
      inflight.delete(url);
      return result;
    });
    inflight.set(url, p);
    return p;
  };
}

function safeHost(raw: string): string {
  try {
    return new URL(raw).hostname;
  } catch {
    return "invalid url";
  }
}
