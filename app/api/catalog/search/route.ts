// Library search for client widgets (the builder's "add pieces" drawer).
// Same query rules as /library; returns a trimmed item shape.

import { NextResponse } from "next/server";
import { parseLibraryQuery, queryLibrary } from "@/lib/catalog/library";
import { getCatalogPopularity } from "@/lib/catalog/popularity";
import { getCommunityItems } from "@/lib/community/library-items";
import { createRateLimiter, readClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Search-as-you-type: generous, but bounded per IP.
const searchRateLimiter = createRateLimiter({ limit: 90, windowMs: 60_000 });

export async function GET(req: Request) {
  if (!searchRateLimiter.allow(readClientIp(req), Date.now())) {
    return NextResponse.json({ error: "rate-limited" }, { status: 429 });
  }
  const sp = Object.fromEntries(new URL(req.url).searchParams.entries());
  const query = { ...parseLibraryQuery(sp), pageSize: 24 };
  const [popularity, community] = await Promise.all([
    getCatalogPopularity(),
    getCommunityItems(),
  ]);
  const r = await queryLibrary(query, popularity ?? undefined, community);
  return NextResponse.json(
    {
      total: r.total,
      page: r.page,
      items: r.items.map((i) => ({
        id: i.id,
        src: i.src,
        name: i.name,
        title: i.title,
        kind: i.kind,
        purpose: i.purpose,
        stack: i.stack,
        thumb: i.thumb,
        srcUrl: i.srcUrl,
        home: i.home,
        lic: i.lic,
        licUrl: i.licUrl,
        author: i.author,
        install: i.install,
        editorSlug: i.editorSlug,
      })),
    },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
  );
}
