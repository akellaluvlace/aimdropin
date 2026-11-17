import "server-only";
import { statSync, promises as fs } from "node:fs";
import path from "node:path";
import { storageKey } from "@/scripts/dashboards/storage-key.mjs";

// Where the live demos' files come from.
//
// Local development: straight from disk - HTML pages in demos/<slug>/, every
// other file in public/demos/<slug>/ (Next serves those itself).
//
// Production: the 1.3 GB of demo files live in a public storage bucket
// (Supabase Storage), not in git or the deployment. DEMO_STORAGE_URL points
// at it, e.g. https://<ref>.supabase.co/storage/v1/object/public/demos. The
// demo route fetches each file from there and serves it under the same
// /demos/<slug>/… URL with the sandbox headers, and the CDN caches the
// result, so a demo behaves exactly as it does locally. Which files exist is
// read from data/dashboards/demo-files/<slug>.json, written by the upload
// script.

const DEMOS_HTML = path.join(process.cwd(), "demos");
const MANIFEST_DIR = path.join(process.cwd(), "data", "dashboards", "demo-files");

export function demoStorageBase(): string | null {
  const v = process.env.DEMO_STORAGE_URL?.trim();
  return v ? v.replace(/\/+$/, "") : null;
}

const manifests = new Map<string, Set<string> | null>();

async function manifest(slug: string): Promise<Set<string> | null> {
  if (manifests.has(slug)) return manifests.get(slug) ?? null;
  let set: Set<string> | null = null;
  try {
    const list = JSON.parse(await fs.readFile(path.join(MANIFEST_DIR, `${slug}.json`), "utf8")) as string[];
    set = new Set(list);
  } catch {
    set = null;
  }
  manifests.set(slug, set);
  return set;
}

/** `exists(rel)` for one demo: the HTML pages (and only those) in local mode, every stored file in storage mode. */
export async function demoFileExists(slug: string): Promise<(rel: string) => boolean> {
  if (demoStorageBase()) {
    const set = await manifest(slug);
    return (rel) => set?.has(rel) ?? false;
  }
  warnIfMisconfigured();
  const root = path.join(DEMOS_HTML, slug);
  return (rel) => {
    const abs = path.resolve(root, rel);
    if (!abs.startsWith(root + path.sep)) return false;
    return statSync(abs, { throwIfNoEntry: false })?.isFile() ?? false;
  };
}

function objectUrl(base: string, slug: string, rel: string): string {
  return `${base}/${storageKey(slug, rel)}`;
}

// Upstream reads: uncompressed (so sizes we pass on are the real ones), not
// kept in Next's fetch cache (the CDN caches our responses instead), and
// bounded so a slow bucket can't hold a function open. A rush of uncached
// reads (launch day, cold caches) makes the bucket answer 429 or 5xx now and
// then, or drop a connection: wait briefly and ask again, inside the same
// time budget, rather than serve a broken file.
const UPSTREAM_TIMEOUT_MS = 20_000;
const UPSTREAM_RETRIES = 3;
const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function upstream(url: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  const deadline = Date.now() + UPSTREAM_TIMEOUT_MS;
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: init.method ?? "GET",
        headers: { "accept-encoding": "identity", ...init.headers },
        cache: "no-store",
        signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
      });
    } catch (e) {
      // Dropped connection: try again while there's time. Out of time: give up.
      const wait = retryDelayMs(null, attempt);
      if ((e as Error).name === "TimeoutError" || attempt >= UPSTREAM_RETRIES || Date.now() + wait >= deadline) throw e;
      await sleep(wait);
      continue;
    }
    if (!RETRY_STATUS.has(res.status) || attempt >= UPSTREAM_RETRIES) return res;
    const wait = retryDelayMs(res.headers.get("retry-after"), attempt);
    if (Date.now() + wait >= deadline) return res;
    await res.body?.cancel().catch(() => {});
    await sleep(wait);
  }
}

/** Retry-After (seconds) when given, else 250 ms, 500 ms, 1 s; jittered so a burst doesn't retry in lockstep; at most 2 s. */
export function retryDelayMs(retryAfter: string | null, attempt: number): number {
  const secs = Number(retryAfter);
  const base = retryAfter !== null && Number.isFinite(secs) && secs > 0 ? secs * 1000 : 250 * 2 ** attempt;
  return Math.min(base * (0.75 + Math.random() * 0.5), 2000);
}

/** Thrown when the bucket fails (5xx, timeout, network): a 502, not a cached 404. */
export class DemoStoreError extends Error {}

let warnedNoBase = false;
function warnIfMisconfigured() {
  // On the host the demo files only exist in the bucket. Without the setting
  // every demo would 404, so say why in the logs.
  if (warnedNoBase || demoStorageBase() || !process.env.VERCEL) return;
  warnedNoBase = true;
  // Say which deployment scope is missing it, and catch near-miss names, so
  // the fix is obvious from one log line.
  const state = process.env.DEMO_STORAGE_URL === undefined ? "is not set" : "is empty";
  const similar = Object.keys(process.env).filter((k) => k !== "DEMO_STORAGE_URL" && /demo.?storage/i.test(k));
  console.error(
    `[demos] DEMO_STORAGE_URL ${state} in this deployment (environment: ${process.env.VERCEL_ENV ?? "?"}, ` +
      `branch: ${process.env.VERCEL_GIT_COMMIT_REF ?? "?"}), so live demos can't be served. Add it to the Vercel ` +
      `project's Environment Variables for that environment, then redeploy: variables only reach deployments ` +
      `made after they're saved.` +
      (similar.length ? ` Similar names present: ${similar.map((k) => JSON.stringify(k)).join(", ")}.` : "") +
      " See scripts/dashboards/README.md.",
  );
}

/** A stored HTML page's text, or null when it doesn't exist. */
export async function readDemoText(slug: string, rel: string): Promise<string | null> {
  const base = demoStorageBase();
  if (base) {
    let res: Response;
    try {
      res = await upstream(objectUrl(base, slug, rel));
    } catch (e) {
      throw new DemoStoreError(`demo storage unreachable: ${(e as Error).message}`);
    }
    if (res.ok) return res.text();
    await res.body?.cancel().catch(() => {});
    if (res.status === 400 || res.status === 404) return null;
    throw new DemoStoreError(`demo storage answered ${res.status}`);
  }
  warnIfMisconfigured();
  const root = path.join(DEMOS_HTML, slug);
  const abs = path.resolve(root, rel);
  if (!abs.startsWith(root + path.sep)) return null;
  try {
    return await fs.readFile(abs, "utf8");
  } catch {
    return null;
  }
}

export interface DemoFileResponse {
  status: number; // 200, or 206 for a range
  body: ReadableStream<Uint8Array> | null;
  headers: Record<string, string>; // length / range headers to pass on
}

/**
 * Storage mode only: a non-HTML file as a stream, honouring Range (video and
 * audio need 206 responses in Safari). Null when the file doesn't exist.
 */
export async function fetchDemoFile(
  slug: string,
  rel: string,
  method: "GET" | "HEAD",
  range: string | null,
): Promise<DemoFileResponse | null> {
  const base = demoStorageBase();
  if (!base) return null;
  let res: Response;
  try {
    res = await upstream(objectUrl(base, slug, rel), { method, headers: range ? { range } : {} });
  } catch (e) {
    throw new DemoStoreError(`demo storage unreachable: ${(e as Error).message}`);
  }
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    if (res.status === 400 || res.status === 404) return null;
    if (res.status === 416) return { status: 416, body: null, headers: { "Content-Range": res.headers.get("content-range") ?? "" } };
    throw new DemoStoreError(`demo storage answered ${res.status}`);
  }
  const headers: Record<string, string> = { "Accept-Ranges": "bytes" };
  // Only pass a length on when the bytes are exactly what we stream on.
  const length = res.headers.get("content-length");
  if (length && !res.headers.get("content-encoding")) headers["Content-Length"] = length;
  const contentRange = res.headers.get("content-range");
  if (res.status === 206 && contentRange) headers["Content-Range"] = contentRange;
  return { status: res.status === 206 ? 206 : 200, body: method === "GET" ? res.body : null, headers };
}
