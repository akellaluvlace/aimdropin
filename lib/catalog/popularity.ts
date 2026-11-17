// Popularity scores from Supabase's ranked_targets view (views, copies,
// installs, remixes, exports, stars, ratings - see the migration for the
// weights). Server-only; cached through Next's fetch cache for 5 minutes.
// Returns null when Supabase isn't configured or the query fails, and the
// library falls back to its fixed quality order.

import { getServerSupabase } from "@/lib/supabase/client";
import type { PopularityLookup } from "./library";

export async function getCatalogPopularity(): Promise<PopularityLookup | null> {
  const sb = getServerSupabase(300);
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from("ranked_targets")
      .select("target_type, target_id, score")
      .gt("score", 0)
      .order("score", { ascending: false })
      .limit(5000);
    if (error || !data) return null;
    // Compress: log scale so one viral item doesn't bury everything else.
    const scores = new Map<string, number>();
    // Community pages are tracked by uuid; the library knows them as
    // "community/<uuid>".
    for (const r of data) {
      const key =
        r.target_type === "page"
          ? `community/${r.target_id}`
          : String(r.target_id);
      scores.set(key, Math.log2(1 + Number(r.score)));
    }
    return { scores };
  } catch {
    return null;
  }
}
