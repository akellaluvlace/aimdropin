import GalleryView from "@/components/GalleryView";
import GalleryShell from "@/components/gallery/GalleryShell";
import { queryComponents } from "@/lib/catalog/components";
import { getGalleryTabs } from "@/lib/gallery/sections";
import type { GallerySortKey } from "@/lib/gallery/types";
import { pageMeta } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata = pageMeta({
  title: "Free UI components",
  description:
    "Thousands of free UI components, sections and screens from shadcn/ui, Magic UI, HyperUI, Uiverse and more, each with a working live preview, the code and an install command. MIT-style licenses only.",
  path: "/gallery/components",
});

const SORTS: { id: GallerySortKey; label: string }[] = [
  { id: "best", label: "Popular" },
  { id: "az", label: "A → Z" },
];

export default async function ComponentsGalleryPage(props: { searchParams?: Promise<{ q?: string }> }) {
  const searchParams = await props.searchParams;
  const q = typeof searchParams?.q === "string" ? searchParams.q.slice(0, 200) : "";
  const [initial, tabs] = await Promise.all([queryComponents({ q, pageSize: 48 }), getGalleryTabs()]);
  return (
    <GalleryShell section="components" tabs={tabs}>
      <GalleryView
        cards={[]}
        facets={[]}
        sorts={SORTS}
        defaultSort="best"
        groupedFacets
        noun="components"
        remote={{ endpoint: "/api/gallery/components", initial }}
        initialQuery={q}
      />
    </GalleryShell>
  );
}
