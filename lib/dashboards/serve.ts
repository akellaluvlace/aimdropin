// Request → stored file / redirect / 404 for /demos/<slug>/<path>. Pure, so
// the rules can be tested without a server; the route handler supplies
// `exists` (a regular-file check under demos/<slug>/).

import type { DemoServeInfo } from "./types";

export type DemoResolution =
  | { kind: "file"; rel: string }
  | { kind: "redirect"; location: string }
  | { kind: "notfound" };

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

function isSafeSegment(seg: string): boolean {
  return (
    seg.length > 0 &&
    !seg.startsWith(".") &&
    !seg.includes("/") &&
    !seg.includes("\\") &&
    !seg.includes("\0") &&
    // Segments arrive decoded once; a "%" left over means double encoding
    // (e.g. %252e%252e), which the redirect would decode into "..".
    !seg.includes("%")
  );
}

// A CDN redirect must stay inside the dashboard's own repo@commit folder
// after the URL parser resolves dot segments (including encoded ones).
function staysUnder(base: string, target: string): boolean {
  try {
    const b = new URL(base);
    const t = new URL(target);
    return t.origin === b.origin && t.pathname.startsWith(b.pathname);
  } catch {
    return false;
  }
}

function extOf(rel: string): string {
  const last = rel.slice(rel.lastIndexOf("/") + 1);
  const dot = last.lastIndexOf(".");
  return dot > 0 ? last.slice(dot + 1).toLowerCase() : "";
}

function joinRepoPath(root: string, rel: string): string {
  const r = root.replace(/^\.?\/?/, "").replace(/\/$/, "");
  return r ? `${r}/${rel}` : rel;
}

export function resolveDemoPath(
  info: DemoServeInfo,
  segments: string[],
  exists: (rel: string) => boolean,
): DemoResolution {
  if (!segments.every(isSafeSegment)) return { kind: "notfound" };
  const base = `/demos/${info.slug}/`;
  const rel = segments.join("/");

  if (rel === "") {
    return info.kind === "static"
      ? { kind: "redirect", location: base + info.entry }
      : exists(info.entry)
        ? { kind: "file", rel: info.entry }
        : { kind: "notfound" };
  }
  if (exists(rel)) return { kind: "file", rel };

  const dirIndex = `${rel}/index.html`;
  if (exists(dirIndex)) {
    return info.kind === "static"
      ? { kind: "redirect", location: base + dirIndex }
      : { kind: "file", rel: dirIndex };
  }

  const ext = extOf(rel);
  if (!ext && exists(`${rel}.html`)) return { kind: "file", rel: `${rel}.html` };

  if (info.cdnBase && ext && ext !== "html" && ext !== "htm") {
    const mapped = info.kind === "static" && info.cdnRoot !== null ? joinRepoPath(info.cdnRoot, rel) : info.cdnMap?.[rel];
    if (mapped) {
      const location = info.cdnBase + mapped;
      return staysUnder(info.cdnBase, location) ? { kind: "redirect", location } : { kind: "notfound" };
    }
  }

  if (info.spa && !ext && exists(info.entry)) return { kind: "file", rel: info.entry };
  return { kind: "notfound" };
}

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  cjs: "text/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  map: "application/json; charset=utf-8",
  webmanifest: "application/manifest+json; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  md: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  xml: "application/xml; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  bmp: "image/bmp",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  eot: "application/vnd.ms-fontobject",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  pdf: "application/pdf",
  wasm: "application/wasm",
};

export function contentTypeFor(rel: string): string {
  return TYPES[extOf(rel)] ?? "application/octet-stream";
}

export function isHtmlPath(rel: string): boolean {
  const ext = extOf(rel);
  return ext === "html" || ext === "htm";
}

// Every demo response: opaque origin even when opened directly, CORS for
// module scripts and fonts requested from that opaque origin, and kept out
// of search results (these are other people's templates).
export const DEMO_SANDBOX =
  "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads";

export function demoHeaders(rel: string | null): Record<string, string> {
  const html = rel !== null && isHtmlPath(rel);
  return {
    "Content-Security-Policy": DEMO_SANDBOX,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "X-Robots-Tag": "noindex, nofollow",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    // Content is pinned to a commit; a new deployment clears the CDN.
    "Cache-Control": html
      ? "public, max-age=300, s-maxage=31536000, stale-while-revalidate=86400"
      : "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=86400",
  };
}

/** A redirect target safe for the Location header (ASCII only, no double-encoding). */
export function redirectLocation(location: string): string {
  let decoded = location;
  try {
    decoded = decodeURI(location);
  } catch {
    // keep as given
  }
  return encodeURI(decoded);
}
