// Registry preview bundle: GET /api/registry/bundle?url=<item json url>.
//
// Resolves the item (or its `-demo` sibling for bare primitives) plus every
// registryDependency, flattens the files into virtual modules and picks the
// export to render - a PreviewPlan that components/registry-preview/
// RegistryPreview.tsx turns into an iframe document. Same allowlist, caps and
// rate limit as /api/registry/item.

import { NextResponse } from "next/server";
import { readClientIp } from "@/lib/rate-limit";
import { planForUrl } from "@/lib/registry-preview/plan";
import { isAllowedRegistryUrl } from "@/lib/registry-preview/registries";
import { RegistryResolveError } from "@/lib/registry-preview/resolve";
import {
  CACHE_HEADERS,
  planCache,
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
  const cached = planCache.get(url);
  if (cached) return NextResponse.json(cached, { headers: CACHE_HEADERS });
  try {
    const plan = await planForUrl(url, registryFetchItem);
    planCache.set(url, plan);
    return NextResponse.json(plan, { headers: CACHE_HEADERS });
  } catch (e) {
    if (e instanceof RegistryResolveError) {
      return NextResponse.json({ error: e.message }, { status: e.status >= 500 ? 502 : e.status });
    }
    return NextResponse.json({ error: "could not build preview" }, { status: 500 });
  }
}
