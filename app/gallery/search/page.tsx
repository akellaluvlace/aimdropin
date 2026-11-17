import Link from "next/link";
import SiteHeader from "@/components/site/SiteHeader";
import GalleryTile from "@/components/gallery/GalleryTile";
import { searchAll } from "@/lib/gallery/search-all";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: { searchParams?: Promise<{ q?: string }> }) {
  const searchParams = await props.searchParams;
  return { title: searchParams?.q ? `“${searchParams.q}” · Search` : "Search", robots: { index: false, follow: true } };
}

export default async function SearchPage(props: { searchParams?: Promise<{ q?: string }> }) {
  const searchParams = await props.searchParams;
  const q = typeof searchParams?.q === "string" ? searchParams.q : "";
  const r = await searchAll(q);
  return (
    <div className="min-h-screen font-sans text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 md:px-6 lg:px-10">
        <form action="/gallery/search" className="flex max-w-2xl gap-2">
          <input
            name="q"
            defaultValue={q}
            autoFocus
            placeholder="Search landing pages, dashboards, components…"
            aria-label="Search the gallery"
            className="h-12 min-w-0 flex-1 border-2 border-ink bg-white px-4 text-base focus:outline-none focus:ring-2 focus:ring-coral"
          />
          <button type="submit" className="btn btn-accent">
            Search
          </button>
        </form>
        {q && r.sections.length === 0 ? <p className="mt-10 font-display text-3xl">Nothing matches “{q}”. Try fewer words.</p> : null}
        {r.sections.map((s) => (
          <section key={s.id} className="mt-10">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-3xl">
                {s.label} <span className="font-mono text-sm text-muted">{s.total.toLocaleString("en-US")}</span>
              </h2>
              {s.total > s.cards.length ? (
                <Link href={s.href} className="font-mono text-[11px] uppercase tracking-[0.18em] hover:text-coral">
                  See all →
                </Link>
              ) : null}
            </div>
            <ul className="mt-4 flex list-none flex-wrap gap-4">
              {s.cards.map((c) => (
                <li key={c.key}>
                  <GalleryTile card={c} widthPx={240} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
