import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ItemWorkbench from "@/components/catalog/ItemWorkbench";
import ComponentPreviewFull from "@/components/catalog/ComponentPreviewFull";
import FullscreenLink from "@/components/fullscreen/FullscreenLink";
import GalleryTile from "@/components/gallery/GalleryTile";
import RatingStars from "@/components/community/RatingStars";
import AddToKitButton from "@/components/kit/AddToKitButton";
import { idFromSegments, kindLabel, stackLabel } from "@/components/catalog/labels";
import { kitItemFromLibrary } from "@/lib/kit/from-library";
import { getCatalog, getLibraryItem, getLibrarySources, getSimilarItems, type LibraryItem } from "@/lib/catalog/library";
import { componentCard, componentHref, componentTypeOf } from "@/lib/catalog/components";
import { getGalleryTabs } from "@/lib/gallery/sections";
import SiteNav from "@/components/site/SiteNav";
import { breadcrumbJsonLd, componentPageMeta, jsonLdHtml, sharedTitleIds } from "@/lib/seo";
import { socialMeta } from "@/lib/site";

export const dynamic = "force-dynamic";

// /c/<source>/<name> is a component's workbench; /c/<source>/<name>/preview
// its full-screen preview (the gallery tile's two actions).
async function resolve(segments: string[]): Promise<{ item: LibraryItem; preview: boolean } | null> {
  const id = idFromSegments(segments);
  const direct = await getLibraryItem(id);
  if (direct && componentTypeOf(direct)) return { item: direct, preview: false };
  if (segments.length > 1 && segments[segments.length - 1] === "preview") {
    const base = await getLibraryItem(idFromSegments(segments.slice(0, -1)));
    if (base && componentTypeOf(base)) return { item: base, preview: true };
  }
  return null;
}

export async function generateMetadata(props: { params: Promise<{ id: string[] }> }): Promise<Metadata> {
  const params = await props.params;
  const found = await resolve(params.id);
  if (!found) return { title: "Not found", robots: { index: false } };
  const { item, preview } = found;
  const [sources, catalog] = await Promise.all([getLibrarySources(), getCatalog()]);
  const srcLabel = sources.find((s) => s.id === item.src)?.label ?? item.src;
  // Variants that share a name ("Avatar Group with Max" three times) add
  // their own short name, so no two pages carry the same title.
  const name = sharedTitleIds(catalog.items).has(item.id) ? `${item.title} (${item.name})` : item.title;
  const { title, description } = componentPageMeta(
    { title: name, desc: item.desc, kind: kindLabel(item), stack: item.stack ? stackLabel(item.stack) : null, author: item.author, lic: item.lic },
    srcLabel,
    preview,
  );
  return {
    title,
    description,
    alternates: { canonical: componentHref(item.id) },
    // Only when it applies: an explicit `undefined` here would drop the
    // site-wide robots settings instead of inheriting them.
    ...(preview ? { robots: { index: false, follow: true } } : {}),
    ...socialMeta({
      title,
      description,
      path: componentHref(item.id),
      image: item.thumb ? { url: item.thumb, alt: item.title } : null,
    }),
  };
}

function licenseSentence(item: LibraryItem): string {
  const who = item.author ? ` Keep the copyright notice for ${item.author} in your project.` : " Keep the copyright notice in your project.";
  return `${item.lic} license: free to use, change and ship in personal and commercial projects.${who}`;
}

export default async function ComponentPage(props: { params: Promise<{ id: string[] }> }) {
  const params = await props.params;
  const found = await resolve(params.id);
  if (!found) notFound();
  const { item, preview } = found;
  if (preview) return <ComponentPreviewFull item={item} backHref={componentHref(item.id)} />;

  const [sources, similar, tabs] = await Promise.all([getLibrarySources(), getSimilarItems(item, 8), getGalleryTabs()]);
  const source = sources.find((s) => s.id === item.src);
  const srcLabel = source?.label ?? item.src;
  const labels = new Map(sources.map((s) => [s.id, s.label]));
  const more = similar.filter((s) => componentTypeOf(s)).map((s) => componentCard(s, labels));

  const trail = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Components", path: "/gallery/components" },
    { name: item.title, path: componentHref(item.id) },
  ]);

  return (
    <div className="min-h-screen font-sans text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(trail) }} />
      <SiteNav tabs={tabs} active="components" sticky />
      <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-5 md:px-6 lg:px-10">
        <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          <Link href="/gallery/components" className="inline-flex h-8 items-center gap-2 border-2 border-ink bg-paper px-3 text-ink shadow-brut-sm transition-colors hover:bg-ink hover:text-paper">
            <span aria-hidden="true">←</span> All components
          </Link>
          <span aria-hidden="true">/</span>
          <span>{srcLabel}</span>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-3xl">
            <p className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              <span>{kindLabel(item)}</span>
              {item.stack ? <span>{stackLabel(item.stack)}</span> : null}
              <span>{srcLabel}</span>
              {item.author ? <span>by {item.author}</span> : null}
              <span>{item.lic}</span>
            </p>
            <h1 className="mt-2 break-words font-display text-4xl leading-none tracking-tight md:text-5xl">{item.title}</h1>
            {item.desc ? <p className="mt-2 text-ink/75">{item.desc}</p> : null}
            <div className="mt-3">
              <RatingStars targetType="catalog" targetId={item.id} trackView={false} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <FullscreenLink href={`${componentHref(item.id)}/preview`} className="btn btn-ink" />
            <AddToKitButton item={kitItemFromLibrary(item, srcLabel)} />
          </div>
        </div>

        <ItemWorkbench item={item} fullscreenHref={`${componentHref(item.id)}/preview`} />

        <section className="mt-8 border-2 border-ink bg-card p-4">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">License</h2>
          <p className="mt-2 text-sm">{licenseSentence(item)}</p>
          <p className="mt-2 flex flex-wrap gap-3 text-sm">
            {item.licUrl ? (
              <a href={item.licUrl} target="_blank" rel="noreferrer" className="underline">
                License text ↗
              </a>
            ) : null}
            {item.srcUrl ? (
              <a href={item.srcUrl} target="_blank" rel="noreferrer" className="underline">
                Original source ↗
              </a>
            ) : null}
            {source?.homepage ? (
              <a href={source.homepage} target="_blank" rel="noreferrer" className="underline">
                {srcLabel} ↗
              </a>
            ) : null}
          </p>
          {item.freeOnly ? <p className="mt-2 text-xs text-ink/60">{srcLabel} also sells paid items. We only list their free, MIT-licensed ones.</p> : null}
          {item.deps.length ? (
            <p className="mt-2 text-sm">
              <span className="text-ink/60">Needs npm: </span>
              <span className="font-mono text-xs">{item.deps.join(", ")}</span>
            </p>
          ) : null}
        </section>

        {more.length ? (
          <section className="mt-12">
            <h2 className="font-display text-2xl">More from {srcLabel}</h2>
            <ul className="mt-4 grid list-none grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
              {more.map((c) => (
                <li key={c.key} className="min-w-0">
                  <GalleryTile card={c} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
