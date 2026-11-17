// One page of the gallery's Components section: cards, facet counts and
// facet values for a search + one active pill + sort.

import { NextResponse } from "next/server";
import { queryComponents } from "@/lib/catalog/components";
import { createRateLimiter, readClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 120, windowMs: 60_000 });

export async function GET(req: Request) {
  if (!limiter.allow(readClientIp(req), Date.now())) {
    return NextResponse.json({ error: "rate-limited" }, { status: 429 });
  }
  const sp = new URL(req.url).searchParams;
  const page = Number.parseInt(sp.get("page") ?? "1", 10);
  const result = await queryComponents({
    q: (sp.get("q") ?? "").slice(0, 200),
    sort: sp.get("sort") === "az" ? "az" : "popular",
    facet: sp.get("facet") ?? undefined,
    value: (sp.get("value") ?? "").slice(0, 120) || undefined,
    page: Number.isFinite(page) && page > 0 ? Math.min(page, 500) : 1,
    pageSize: 48,
  });
  return NextResponse.json(result, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } });
}
