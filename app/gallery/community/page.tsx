import { notFound } from "next/navigation";
import { ACCOUNTS_ENABLED } from "@/lib/supabase/client";
import Link from "next/link";
import GalleryView from "@/components/GalleryView";
import GalleryShell from "@/components/gallery/GalleryShell";
import { communityCard, getCommunityPages, PURPOSE_LABEL } from "@/lib/community/listing";
import { getGalleryTabs } from "@/lib/gallery/sections";
import type { FacetGroup, GallerySortKey } from "@/lib/gallery/types";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Community pages",
  description: "Pages people built and shared on AiM Dropin. Rate them; the best rise into the main gallery.",
  alternates: { canonical: "/gallery/community" },
};

const SORTS: { id: GallerySortKey; label: string }[] = [
  { id: "new", label: "Newest" },
  { id: "top", label: "Top rated" },
  { id: "views", label: "Most viewed" },
  { id: "az", label: "A → Z" },
];

export default async function CommunityGalleryPage(props: { searchParams?: Promise<{ q?: string }> }) {
  const searchParams = await props.searchParams;
  // Accounts and community ship switched off (NEXT_PUBLIC_FEATURE_ACCOUNTS).
  if (!ACCOUNTS_ENABLED) notFound();
  const [rows, tabs] = await Promise.all([getCommunityPages(), getGalleryTabs()]);
  const cards = rows.map(communityCard);
  const used = new Set(cards.map((c) => c.facets.purpose));
  const facets: FacetGroup[] = [
    { id: "purpose", label: "Kind", values: Object.values(PURPOSE_LABEL).filter((l) => used.has(l)) },
    { id: "stack", label: "Code", values: ["HTML", "JSX"].filter((s) => cards.some((c) => c.facets.stack === s)) },
  ];
  return (
    <GalleryShell section="community" tabs={tabs}>
      {cards.length ? (
        <GalleryView cards={cards} facets={facets} sorts={SORTS} defaultSort="new" groupedFacets noun="pages" initialQuery={searchParams?.q ?? ""} />
      ) : (
        <div className="mx-auto max-w-xl px-6 py-24 text-center">
          <p className="font-display text-4xl leading-tight">Nothing shared yet.</p>
          <p className="mt-3 text-ink/70">Build a page in your studio and publish it. People rate it here, and pages rated 4★+ by 10 or more people join the main gallery.</p>
          <Link href="/me" className="btn btn-accent mt-6">
            Open my studio
          </Link>
        </div>
      )}
    </GalleryShell>
  );
}
