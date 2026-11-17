import Link from "next/link";
import { notFound } from "next/navigation";
import SiteHeader from "@/components/site/SiteHeader";
import GalleryTile from "@/components/gallery/GalleryTile";
import { communityCard, getCommunityPages } from "@/lib/community/listing";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: { params: Promise<{ username: string }> }) {
  const params = await props.params;
  return { title: `@${params.username} · Community` };
}

export default async function ProfilePage(props: { params: Promise<{ username: string }> }) {
  const params = await props.params;
  if (!/^[a-z0-9][a-z0-9-]{1,38}$/.test(params.username)) notFound();
  const rows = await getCommunityPages({ username: params.username });
  if (!rows.length) notFound();
  const name = rows[0].displayName ?? `@${params.username}`;
  const rated = rows.filter((r) => r.ratingCount > 0);
  const avg = rated.length ? rated.reduce((n, r) => n + (r.rating ?? 0), 0) / rated.length : null;
  return (
    <div className="min-h-screen font-sans text-ink">
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-4 pb-24 pt-8 md:px-6 lg:px-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">
          <Link href="/gallery/community" className="hover:text-coral">
            Community
          </Link>{" "}
          / @{params.username}
        </p>
        <h1 className="mt-2 font-display text-5xl leading-none tracking-tight">{name}</h1>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {rows.length} published page{rows.length === 1 ? "" : "s"}
          {avg != null ? ` · ★ ${avg.toFixed(1)} average` : ""}
          {` · ${rows.reduce((n, r) => n + r.views, 0).toLocaleString("en-US")} views`}
        </p>
        <ul className="mt-8 flex list-none flex-wrap gap-4">
          {rows.map((r) => (
            <li key={r.id}>
              <GalleryTile card={communityCard(r)} widthPx={260} />
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
