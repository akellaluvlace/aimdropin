import GalleryView from "@/components/GalleryView";
import GalleryShell from "@/components/gallery/GalleryShell";
import { templateCard } from "@/lib/gallery/cards";
import { LANDING_PICKS } from "@/lib/gallery/picks";
import { getGalleryTabs } from "@/lib/gallery/sections";
import { promotedCards, statSorts, withStats } from "@/lib/gallery/enrich";
import type { FacetGroup, GallerySortKey } from "@/lib/gallery/types";
import {
  getAllTemplates,
  getCategories,
  getStyles,
  getThumbSlugs,
  type TemplateKind,
} from "@/lib/templates";
import { pageMeta } from "@/lib/site";

// Reads `searchParams` (?kind=), so it must render dynamically. Without
// this, Next can try to static-render it during build and crash ("couldn't
// be rendered statically because it used searchParams"). Pin it.
export const dynamic = "force-dynamic";

export const metadata = pageMeta({
  title: "Free landing pages",
  description:
    "Free landing page templates in HTML and JSX, across dozens of styles and categories. Preview each one live, edit it in your browser, then copy or download the code. MIT licensed.",
  path: "/gallery",
});

const SORTS: { id: GallerySortKey; label: string }[] = [
  { id: "az", label: "A → Z" },
  { id: "za", label: "Z → A" },
  { id: "num-asc", label: "№ asc" },
  { id: "num-desc", label: "№ desc" },
];

export default async function GalleryPage(props: { searchParams?: Promise<{ kind?: string; q?: string }> }) {
  const searchParams = await props.searchParams;
  const kindPref: TemplateKind = searchParams?.kind === "html" ? "html" : "jsx";
  const [all, categories, styles, thumbs, tabs] = await Promise.all([
    getAllTemplates({ preferKind: kindPref }),
    getCategories(),
    getStyles(),
    getThumbSlugs(),
    getGalleryTabs(),
  ]);
  // Only metadata crosses to the client; sources stay on the server.
  const own = await withStats(
    all.map(({ source: _s, ...t }) => templateCard(t, thumbs.has(t.slug), kindPref)),
    "template",
  );
  // Community landing pages voted up by star ratings join the gallery.
  const promoted = (await promotedCards(["landing", "ecommerce", "blog", "general"])).map((c) => ({
    ...c,
    facets: { category: "Community", style: null },
  }));
  const cards = [...own, ...promoted];
  const facets: FacetGroup[] = [
    { id: "category", label: "Category", values: promoted.length ? [...categories, "Community"] : categories },
    { id: "style", label: "Style", values: styles },
  ];

  return (
    <GalleryShell section="landing" tabs={tabs}>
      <GalleryView cards={cards} facets={facets} picks={LANDING_PICKS} kindPref={kindPref} sorts={[...SORTS, ...statSorts()]} defaultSort="az" noun="templates" initialQuery={searchParams?.q ?? ""} />
    </GalleryShell>
  );
}
