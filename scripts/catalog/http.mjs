// Polite JSON fetcher for the catalog indexer.
//   - At most `perHost` requests in flight per host (registries are small
//     sites; two of them already rate-limited the Phase 0 crawl).
//   - Retries 429 / 5xx with exponential backoff, honouring Retry-After.
//   - Disk cache under .cache/catalog/http with ETag / Last-Modified, so a
//     daily re-index only re-downloads what changed (304s cost nothing).

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

const USER_AGENT = "aimdropin-catalog/0.1 (+https://github.com/akellaluvlace/aimdropin)";

export function createHttp({ cacheDir, perHost = 4, timeoutMs = 20000, retries = 3 } = {}) {
  const inFlight = new Map(); // host -> count
  const waiters = new Map(); // host -> resolve[]

  async function acquire(host) {
    const n = inFlight.get(host) ?? 0;
    if (n < perHost) {
      inFlight.set(host, n + 1);
      return;
    }
    await new Promise((resolve) => {
      const q = waiters.get(host) ?? [];
      q.push(resolve);
      waiters.set(host, q);
    });
    // The releaser hands its slot straight to us, count unchanged.
  }

  function release(host) {
    const q = waiters.get(host);
    if (q && q.length) {
      q.shift()();
      return;
    }
    inFlight.set(host, (inFlight.get(host) ?? 1) - 1);
  }

  function cachePath(url, asText) {
    const key = createHash("sha1").update(`${asText ? "text:" : ""}${url}`).digest("hex");
    return path.join(cacheDir, key.slice(0, 2), `${key}.json`);
  }

  async function readCache(url, asText) {
    if (!cacheDir) return null;
    try {
      return JSON.parse(await fs.readFile(cachePath(url, asText), "utf-8"));
    } catch {
      return null;
    }
  }

  async function writeCache(url, asText, entry) {
    if (!cacheDir) return;
    const p = cachePath(url, asText);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, JSON.stringify(entry), "utf-8");
  }

  /**
   * @returns {Promise<{ status: number, json: unknown | null, fromCache: boolean, error?: string }>}
   */
  function getJson(url) {
    return get(url, false);
  }

  /** Same as getJson, but the body comes back as `text` (LICENSE files). */
  async function getText(url) {
    const r = await get(url, true);
    return { status: r.status, text: r.json, fromCache: r.fromCache, error: r.error };
  }

  async function get(url, asText) {
    const host = new URL(url).host;
    const cached = await readCache(url, asText);
    await acquire(host);
    try {
      for (let attempt = 0; ; attempt++) {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), timeoutMs);
        let res;
        try {
          const headers = { accept: asText ? "text/plain" : "application/json", "user-agent": USER_AGENT };
          if (cached?.etag) headers["if-none-match"] = cached.etag;
          if (cached?.lastModified) headers["if-modified-since"] = cached.lastModified;
          res = await fetch(url, { signal: ctl.signal, headers });
        } catch (e) {
          clearTimeout(timer);
          if (attempt < retries) {
            await sleep(backoff(attempt));
            continue;
          }
          return { status: 0, json: null, fromCache: false, error: e.name === "AbortError" ? "timeout" : String(e.message ?? e) };
        }
        clearTimeout(timer);

        if (res.status === 304 && cached) {
          return { status: 200, json: cached.json, fromCache: true };
        }
        if ((res.status === 429 || res.status >= 500) && attempt < retries) {
          const ra = Number(res.headers.get("retry-after"));
          await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : backoff(attempt));
          continue;
        }
        if (!res.ok) return { status: res.status, json: null, fromCache: false, error: `HTTP ${res.status}` };

        const text = await res.text();
        let json;
        try {
          json = asText ? text : JSON.parse(text);
        } catch {
          // Some registries answer unknown names with a 200 HTML page.
          return { status: res.status, json: null, fromCache: false, error: "not-json" };
        }
        await writeCache(url, asText, {
          etag: res.headers.get("etag"),
          lastModified: res.headers.get("last-modified"),
          json,
        });
        return { status: res.status, json, fromCache: false };
      }
    } finally {
      release(host);
    }
  }

  return { getJson, getText };
}

function backoff(attempt) {
  return 1000 * 2 ** attempt + Math.floor(Math.random() * 250);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
