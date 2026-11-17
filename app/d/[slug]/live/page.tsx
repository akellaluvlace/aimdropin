import { notFound } from "next/navigation";
import DemoFrame from "@/components/dashboards/DemoFrame";
import FullscreenBar from "@/components/fullscreen/FullscreenBar";
import { getDashboard } from "@/lib/dashboards";
import { dashboardNeighbors } from "@/lib/gallery/neighbors";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const d = await getDashboard(params.slug);
  return {
    title: d ? `Live: ${d.title}` : "Live demo",
    robots: { index: false, follow: true },
  };
}

// Full-screen live demo: the gallery tile's and the dashboard page's
// "Full screen". Close returns to where it was opened from; ← → step through
// the gallery without leaving full screen.
export default async function DashboardLivePage(
  props: {
    params: Promise<{ slug: string }>;
    searchParams?: Promise<{ page?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const [d, nav] = await Promise.all([getDashboard(params.slug), dashboardNeighbors(params.slug)]);
  if (!d) notFound();
  const page = typeof searchParams?.page === "string" ? searchParams.page.replace(/^\/+/, "") : "";
  return (
    <div className="flex h-[100dvh] flex-col bg-paper font-sans text-ink">
      <FullscreenBar
        title={d.title}
        kind={`Dashboard${nav ? ` · ${nav.index} of ${nav.total}` : ""}`}
        fallbackHref={`/d/${d.slug}`}
        prev={nav?.prev}
        next={nav?.next}
        noun="dashboard"
        primary={{ href: `/d/${d.slug}`, label: "Code & download", shortLabel: "Code" }}
      />
      <div className="min-h-0 flex-1 p-2">
        <DemoFrame key={d.slug} slug={d.slug} spa={d.spa} entry={d.entry} title={d.title} pages={d.pages} fill initialPage={page} />
      </div>
    </div>
  );
}
