// Source of one of our own templates, for the builder's kit (the model needs
// the code it's adapting). Public: the same source ships in /t/[slug].

import { NextResponse } from "next/server";
import { getTemplate } from "@/lib/templates";

export const dynamic = "force-dynamic";

export async function GET(req: Request, props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  if (!/^[a-z0-9][a-z0-9-]{0,120}$/i.test(params.slug)) {
    return NextResponse.json({ error: "bad slug" }, { status: 400 });
  }
  const kind =
    new URL(req.url).searchParams.get("kind") === "html" ? "html" : "jsx";
  const t = await getTemplate(params.slug, { preferKind: kind });
  if (!t) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(
    { slug: t.slug, title: t.title, kind: t.kind, source: t.source },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=86400" } },
  );
}
