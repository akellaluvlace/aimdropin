import "server-only";
import { getServerSupabase } from "@/lib/supabase/client";
import type { GalleryCard } from "@/lib/gallery/types";

// Public reads for the community gallery, published pages, profiles and the
// stats behind "Top rated" / "Most viewed". All return empty when Supabase
// isn't configured, so the site works without it.

export interface CommunityRow {
  id: string;
  title: string;
  description: string | null;
  purpose: string;
  stack: "html" | "jsx";
  publishedAt: string | null;
  username: string | null;
  displayName: string | null;
  views: number;
  rating: number | null;
  ratingCount: number;
  bayes: number;
  promoted: boolean;
}

export const PURPOSE_LABEL: Record<string, string> = {
  landing: "Landing page",
  dashboard: "Dashboard",
  ecommerce: "Shop",
  blog: "Blog",
  auth: "Auth screen",
  docs: "Docs",
  general: "Other",
};

function toRow(r: Record<string, unknown>): CommunityRow {
  return {
    id: String(r.id),
    title: String(r.title),
    description: (r.description as string | null) ?? null,
    purpose: String(r.purpose),
    stack: r.stack === "jsx" ? "jsx" : "html",
    publishedAt: (r.published_at as string | null) ?? null,
    username: (r.username as string | null) ?? null,
    displayName: (r.display_name as string | null) ?? null,
    views: Number(r.views ?? 0),
    rating: r.rating == null ? null : Number(r.rating),
    ratingCount: Number(r.rating_count ?? 0),
    bayes: Number(r.bayes ?? 0),
    promoted: Boolean(r.promoted),
  };
}

export async function getCommunityPages(opts: { username?: string; promotedOnly?: boolean; limit?: number } = {}): Promise<CommunityRow[]> {
  const sb = getServerSupabase(60);
  if (!sb) return [];
  let q = sb.from("community_pages").select("*").order("published_at", { ascending: false }).limit(opts.limit ?? 500);
  if (opts.username) q = q.eq("username", opts.username);
  if (opts.promotedOnly) q = q.eq("promoted", true);
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map(toRow);
}

export interface PublishedPage extends CommunityRow {
  source: string;
  credits: Array<{ id: string; title: string; sourceUrl: string | null; license: string }>;
}

export async function getPublishedPage(id: string): Promise<PublishedPage | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const sb = getServerSupabase(30);
  if (!sb) return null;
  const { data: page } = await sb
    .from("pages")
    .select("id, title, description, purpose, stack, source, credits, published_at, owner_id, status, visibility")
    .eq("id", id)
    .eq("status", "published")
    .in("visibility", ["public", "unlisted"])
    .maybeSingle();
  if (!page) return null;
  const [{ data: profile }, { data: stats }] = await Promise.all([
    sb.from("profiles").select("username, display_name").eq("id", page.owner_id).maybeSingle(),
    sb.from("ranked_targets").select("views, rating, rating_count, bayes").eq("target_type", "page").eq("target_id", id).maybeSingle(),
  ]);
  return {
    ...toRow({ ...page, ...(stats ?? {}), username: profile?.username, display_name: profile?.display_name }),
    source: String(page.source ?? ""),
    credits: Array.isArray(page.credits) ? page.credits : [],
  };
}

export interface TargetSummary {
  rating: number | null;
  ratingCount: number;
  views: number;
  bayes: number;
}

/** Stats for every target of one type, for sorting a gallery section. */
export async function getStatsMap(targetType: "template" | "dashboard" | "catalog" | "page"): Promise<Map<string, TargetSummary>> {
  const sb = getServerSupabase(120);
  const out = new Map<string, TargetSummary>();
  if (!sb) return out;
  const { data } = await sb.from("ranked_targets").select("target_id, rating, rating_count, views, bayes").eq("target_type", targetType).limit(10000);
  for (const r of data ?? []) {
    out.set(String(r.target_id), {
      rating: r.rating == null ? null : Number(r.rating),
      ratingCount: Number(r.rating_count ?? 0),
      views: Number(r.views ?? 0),
      bayes: Number(r.bayes ?? 0),
    });
  }
  return out;
}

export function communityCard(r: CommunityRow): GalleryCard {
  const by = r.username ? `@${r.username}` : "Community";
  const kind = PURPOSE_LABEL[r.purpose] ?? "Page";
  return {
    key: `page:${r.id}`,
    title: r.title,
    subtitle: `${by} · ${kind}`,
    thumb: null,
    chips: [{ label: "Community", accent: true }, { label: r.stack.toUpperCase() }],
    selectHref: `/p/${r.id}`,
    previewHref: `/p/${r.id}?full=1`,
    facets: { purpose: kind, stack: r.stack === "jsx" ? "JSX" : "HTML" },
    search: [r.title, r.description ?? "", r.username ?? "", kind].join(" ").toLowerCase(),
    rank: r.bayes,
    stats: { rating: r.rating, ratingCount: r.ratingCount, views: r.views, bayes: r.bayes },
    added: r.publishedAt ?? undefined,
  };
}
