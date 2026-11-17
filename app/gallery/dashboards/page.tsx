import GalleryView from "@/components/GalleryView";
import GalleryShell from "@/components/gallery/GalleryShell";
import { dashboardCard } from "@/lib/gallery/cards";
import { getGalleryTabs } from "@/lib/gallery/sections";
import type { FacetGroup, GalleryCard, GallerySortKey } from "@/lib/gallery/types";
import { getDashboards } from "@/lib/dashboards";
import { promotedCards, statSorts, withStats } from "@/lib/gallery/enrich";
import { pageMeta } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata = pageMeta({
  title: "Free dashboards",
  description:
    "Complete free admin dashboards in HTML, React, shadcn/ui, Next.js, Vue, Angular and Svelte. Click through every page live, read the code and download it. MIT-style licenses only.",
  path: "/gallery/dashboards",
});

const SORTS: { id: GallerySortKey; label: string }[] = [
  { id: "best", label: "Best first" },
  { id: "az", label: "A → Z" },
  { id: "za", label: "Z → A" },
];

// Facet values in a fixed, readable order; values nobody uses are dropped.
const STACK_ORDER = ["HTML", "React", "Next.js", "Vue", "Nuxt", "Angular", "Svelte", "SvelteKit", "Solid", "Astro", "Qwik"];

function ordered(values: Set<string>, order: string[]): string[] {
  const known = order.filter((v) => values.has(v));
  const rest = Array.from(values).filter((v) => !order.includes(v)).sort((a, b) => a.localeCompare(b));
  return [...known, ...rest];
}

export default async function DashboardsGalleryPage(props: { searchParams?: Promise<{ q?: string }> }) {
  const searchParams = await props.searchParams;
  const [dashboards, tabs] = await Promise.all([getDashboards(), getGalleryTabs()]);
  const promoted: GalleryCard[] = (await promotedCards(["dashboard"])).map((c) => ({ ...c, facets: { stack: "Community", ui: null, category: null } }));
  const cards: GalleryCard[] = [...(await withStats(dashboards.map(dashboardCard), "dashboard")), ...promoted];
  const facetValues = (id: string) => new Set(cards.map((c) => c.facets[id]).filter((v): v is string => !!v));
  const uiCounts = new Map<string, number>();
  for (const c of cards) if (c.facets.ui) uiCounts.set(c.facets.ui, (uiCounts.get(c.facets.ui) ?? 0) + 1);
  const facets: FacetGroup[] = [
    { id: "stack", label: "Stack", values: ordered(facetValues("stack"), STACK_ORDER) },
    { id: "ui", label: "UI kit", values: Array.from(uiCounts.keys()).sort((a, b) => (uiCounts.get(b) ?? 0) - (uiCounts.get(a) ?? 0) || a.localeCompare(b)) },
  ];
  // Our picks: the highest-rated by review, best first.
  const picks = dashboards.filter((d) => d.quality >= 5).map((d) => d.slug);

  return (
    <GalleryShell section="dashboards" tabs={tabs}>
      <GalleryView cards={cards} facets={facets} picks={picks} sorts={[...SORTS, ...statSorts()]} defaultSort="best" groupedFacets noun="dashboards" initialQuery={searchParams?.q ?? ""} />
    </GalleryShell>
  );
}
