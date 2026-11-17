// Publish one of your studio pages. The owner sends their access token; the
// server (service role) runs the automatic checks and either puts the page
// live, holds it for the site owner's review, or refuses it with reasons.

import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/supabase/admin";
import { parsePublishRequest, statusForVerdict } from "@/lib/studio/publish-rules";
import { checkPageSource } from "@/scripts/community/page-checks.mjs";
import { createRateLimiter } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const limiter = createRateLimiter({ limit: 20, windowMs: 60 * 60_000 });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(status: number, error: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const admin = getAdminSupabase();
  if (!admin) return fail(503, "Publishing isn't switched on for this site yet.");
  if (!UUID_RE.test(params.id)) return fail(404, "Page not found.");
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return fail(401, "Sign in to publish.");
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth?.user;
  if (!user) return fail(401, "Your session ended - sign in again.");
  if (!limiter.allow(user.id, Date.now())) return fail(429, "That's a lot of publishing - try again in a while.");

  const parsed = parsePublishRequest(await req.json().catch(() => null));
  if (!parsed.ok) return fail(400, parsed.error);
  const body = parsed.value;

  // Ownership first: nobody learns anything about someone else's page.
  const { data: page } = await admin.from("pages").select("id, owner_id, source, stack, published_at").eq("id", params.id).maybeSingle();
  if (!page || page.owner_id !== user.id) return fail(404, "Page not found.");

  const { data: profile } = await admin.from("profiles").select("username").eq("id", user.id).maybeSingle();
  if (!profile?.username) {
    if (!body.username) return fail(409, "Pick a username for your public pages.", { need: "username" });
    const { error } = await admin.from("profiles").update({ username: body.username }).eq("id", user.id);
    if (error) return fail(409, "That username is taken - try another.", { need: "username" });
  }


  const check = checkPageSource(String(page.source ?? ""), page.stack === "jsx" ? "jsx" : "html");
  const status = statusForVerdict(check.verdict);
  const { error } = await admin
    .from("pages")
    .update({
      title: body.title,
      description: body.description,
      purpose: body.purpose,
      visibility: body.visibility,
      license: "MIT",
      status,
      published_at: status === "published" ? page.published_at ?? new Date().toISOString() : page.published_at,
    })
    .eq("id", page.id);
  if (error) return fail(500, "Couldn't publish the page. Try again.");
  return NextResponse.json({ status, findings: check.findings });
}
