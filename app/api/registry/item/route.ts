// Registry item proxy: GET /api/registry/item?url=<item json url>.
//
// Returns the raw shadcn registry item (files with source, dependencies,
// registryDependencies) for the library's code tab and the preview runtime.
// Only allowlisted registry hosts are fetched (lib/registry-preview/
// registries.ts); redirects are re-checked per hop, bodies are capped at 2MB,
// nothing from the incoming request (cookies, auth) is forwarded.

import { NextResponse } from "next/server";
import { readClientIp } from "@/lib/rate-limit";
import { isAllowedRegistryUrl } from "@/lib/registry-preview/registries";
import {
  CACHE_HEADERS,
  registryFetchItem,
  registryRateLimiter,
} from "@/lib/registry-preview/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!registryRateLimiter.allow(readClientIp(req), Date.now())) {
    return NextResponse.json({ error: "rate-limited" }, { status: 429 });
  }
  const url = new URL(req.url).searchParams.get("url") ?? "";
  if (!isAllowedRegistryUrl(url)) {
    return NextResponse.json({ error: "url not allowed" }, { status: 400 });
  }
  const r = await registryFetchItem(url);
  if (!r.ok) {
    return NextResponse.json({ error: r.error }, { status: r.status >= 500 ? 502 : r.status });
  }
  return NextResponse.json(r.item, { headers: CACHE_HEADERS });
}
