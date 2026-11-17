import "server-only";
import { getAllTemplates, getThumbSlugs } from "@/lib/templates";
import { getDashboards } from "@/lib/dashboards";
import { queryComponents } from "@/lib/catalog/components";
import { communityCard, getCommunityPages } from "@/lib/community/listing";
import { applyGalleryFilter } from "./filter";
import { dashboardCard, templateCard } from "./cards";
import type { GalleryCard } from "./types";

export interface SearchAllResult {
  query: string;
  sections: Array<{ id: string; label: string; href: string; total: number; cards: GalleryCard[] }>;
}

const PER_SECTION = 12;

// One search box for the whole gallery: the best matches from every section.
export async function searchAll(query: string): Promise<SearchAllResult> {
  const q = query.trim().slice(0, 200);
  if (!q) return { query: q, sections: [] };
  const [templates, thumbs, dashboards, components, community] = await Promise.all([
    getAllTemplates(),
    getThumbSlugs(),
    getDashboards(),
    queryComponents({ q, pageSize: PER_SECTION }).catch(() => null),
    getCommunityPages({ limit: 500 }).catch(() => []),
  ]);
  const match = (cards: GalleryCard[]) => applyGalleryFilter(cards, { query: q, active: null, sort: "best" });
  const landing = match(templates.map(({ source: _s, ...t }) => templateCard(t, thumbs.has(t.slug), "jsx")));
  const dash = match(dashboards.map(dashboardCard));
  const comm = match(community.map(communityCard));
  const enc = encodeURIComponent(q);
  return {
    query: q,
    sections: [
      { id: "landing", label: "Landing pages", href: `/gallery?q=${enc}`, total: landing.length, cards: landing.slice(0, PER_SECTION) },
      { id: "dashboards", label: "Dashboards", href: `/gallery/dashboards?q=${enc}`, total: dash.length, cards: dash.slice(0, PER_SECTION) },
      { id: "components", label: "Components", href: `/gallery/components?q=${enc}`, total: components?.total ?? 0, cards: components?.cards ?? [] },
      { id: "community", label: "Community", href: `/gallery/community?q=${enc}`, total: comm.length, cards: comm.slice(0, PER_SECTION) },
    ].filter((s) => s.total > 0),
  };
}
