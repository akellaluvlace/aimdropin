import { NextResponse, type NextRequest } from "next/server";
import { bareAssetUrl } from "./lib/dashboards/canonical";

// Demo code runs in an opaque origin, so any fetch with custom headers (Next
// app-router page loads, axios with Authorization) sends a CORS preflight.
// Static files under /demos can't answer OPTIONS themselves.
export function proxy(req: NextRequest) {
  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
        "Access-Control-Max-Age": "86400",
      },
    });
  }
  const bare = bareAssetUrl(new URL(req.url));
  if (bare) {
    // CORS on the redirect too: fonts and module scripts from the sandboxed
    // (opaque-origin) demo frame are CORS requests, redirects included.
    return NextResponse.redirect(bare, { status: 308, headers: { "Access-Control-Allow-Origin": "*" } });
  }
  return NextResponse.next();
}

export const config = { matcher: "/demos/:path*" };
