// Live demos of imported dashboards. Locally, static assets live in
// public/demos/<slug>/ and never reach this handler; it serves the HTML pages
// (rewritten on the way out: storage shim, no trackers, links kept inside the
// demo), folder indexes, SPA fallbacks, and redirects to jsDelivr for files
// we don't store. In production every file comes from the storage bucket
// through here (see lib/dashboards/demo-store.ts).
// Every response carries a CSP sandbox, so demo code runs in an opaque
// origin and can't touch the main site's session or storage.

import {
  contentTypeFor,
  demoHeaders,
  isHtmlPath,
  isValidSlug,
  redirectLocation,
  resolveDemoPath,
} from "@/lib/dashboards/serve";
import { transformDemoHtml } from "@/lib/dashboards/html";
import { getDemoServeInfo } from "@/lib/dashboards/serve-info";
import { DemoStoreError, demoFileExists, fetchDemoFile, readDemoText } from "@/lib/dashboards/demo-store";

function notFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { ...demoHeaders(null), "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=60" },
  });
}

// The bucket failed (not "file missing"): don't let anyone cache it.
function unavailable(): Response {
  return new Response("Demo storage unavailable, try again shortly", {
    status: 502,
    headers: { ...demoHeaders(null), "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function handle(
  params: { slug: string; path?: string[] },
  withBody: boolean,
  range: string | null,
): Promise<Response> {
  try {
    return await serve(params, withBody, range);
  } catch (e) {
    if (e instanceof DemoStoreError) {
      console.error(`[demos] ${params.slug}/${(params.path ?? []).join("/")}: ${e.message}`);
      return unavailable();
    }
    throw e;
  }
}

async function serve(
  params: { slug: string; path?: string[] },
  withBody: boolean,
  range: string | null,
): Promise<Response> {
  const { slug } = params;
  if (!isValidSlug(slug)) return notFound();
  const info = await getDemoServeInfo(slug);
  if (!info) return notFound();

  const exists = await demoFileExists(slug);
  const res = resolveDemoPath(info, params.path ?? [], exists);
  if (res.kind === "notfound") return notFound();
  if (res.kind === "redirect") {
    return new Response(null, {
      status: 302,
      headers: { ...demoHeaders(null), Location: redirectLocation(res.location), "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });
  }

  const headers: Record<string, string> = { ...demoHeaders(res.rel), "Content-Type": contentTypeFor(res.rel) };
  if (isHtmlPath(res.rel)) {
    const raw = await readDemoText(slug, res.rel);
    if (raw === null) return notFound();
    const html = transformDemoHtml(raw, { slug, kind: info.kind, entry: info.entry });
    return new Response(withBody ? html : null, { status: 200, headers });
  }
  const file = await fetchDemoFile(slug, res.rel, withBody ? "GET" : "HEAD", range);
  if (!file) return notFound();
  if (file.status !== 200) headers["Cache-Control"] = "no-store"; // partial content isn't a cache entry
  return new Response(withBody ? file.body : null, { status: file.status, headers: { ...headers, ...file.headers } });
}

export async function GET(req: Request, ctx: { params: Promise<{ slug: string; path?: string[] }> }) {
  return handle((await ctx.params), true, req.headers.get("range"));
}

export async function HEAD(req: Request, ctx: { params: Promise<{ slug: string; path?: string[] }> }) {
  return handle((await ctx.params), false, req.headers.get("range"));
}

// CORS preflight from demo code that sends custom headers.
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...demoHeaders(null), "Access-Control-Max-Age": "86400" } });
}
