import "server-only";
import { communityCard, getCommunityPages, getStatsMap } from "@/lib/community/listing";
import { supabaseConfigured } from "@/lib/supabase/client";
import type { GalleryCard, GallerySortKey } from "./types";

// Ratings and views on cards, the sorts they enable, and community pages
// promoted into a main section by their ratings.

export async function withStats(cards: GalleryCard[], targetType: "template" | "dashboard"): Promise<GalleryCard[]> {
  const stats = await getStatsMap(targetType).catch(() => new Map());
  if (!stats.size) return cards;
  return cards.map((c) => {
    const s = stats.get(c.key);
    return s ? { ...c, stats: { rating: s.rating, ratingCount: s.ratingCount, views: s.views, bayes: s.bayes } } : c;
  });
}

export function statSorts(): { id: GallerySortKey; label: string }[] {
  return supabaseConfigured()
    ? [
        { id: "top", label: "Top rated" },
        { id: "views", label: "Most viewed" },
      ]
    : [];
}

export async function promotedCards(purposes: string[]): Promise<GalleryCard[]> {
  const rows = await getCommunityPages({ promotedOnly: true, limit: 200 }).catch(() => []);
  return rows.filter((r) => purposes.includes(r.purpose)).map(communityCard);
}
