// Demo files never depend on the query string, but the CDN caches by the
// full URL, so `app.bundle.js?anything` would skip the cache and pull the
// file from the storage bucket again (a cheap way to run up egress). Asset
// requests that carry a query are sent to the bare URL instead, which is
// cached. HTML pages keep their query: single-page demos may read it.
//
// Edge-safe: no Node imports (used by proxy.ts).

export function bareAssetUrl(url: URL): URL | null {
  if (!url.search) return null;
  const last = url.pathname.slice(url.pathname.lastIndexOf("/") + 1);
  const dot = last.lastIndexOf(".");
  if (dot <= 0) return null;
  const ext = last.slice(dot + 1).toLowerCase();
  if (ext === "html" || ext === "htm") return null;
  const bare = new URL(url.href);
  bare.search = "";
  return bare;
}
