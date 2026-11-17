import { notFound } from "next/navigation";
import DashboardWorkbench from "@/components/dashboards/DashboardWorkbench";
import { getDashboard, getDashboardRepoFiles } from "@/lib/dashboards";
import { frameworkLabel, uiLabel } from "@/lib/gallery/cards";
import { getGalleryTabs } from "@/lib/gallery/sections";
import SiteNav from "@/components/site/SiteNav";
import { breadcrumbJsonLd, jsonLdHtml } from "@/lib/seo";
import { socialMeta } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const d = await getDashboard(params.slug);
  if (!d) return { title: "Not found" };
  const title = `${d.title} - free ${frameworkLabel(d.framework)} dashboard`;
  const description = `${d.description} ${d.pages.length} pages, ${uiLabel(d.ui)}, ${d.license.spdx} license. Live demo, full source and download.`;
  return {
    title,
    description,
    alternates: { canonical: `/d/${d.slug}` },
    ...socialMeta({
      title,
      description,
      path: `/d/${d.slug}`,
      image: d.thumb ? { url: d.thumb, width: 960, height: 600, alt: `${d.title} dashboard` } : null,
    }),
  };
}

export default async function DashboardPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const d = await getDashboard(params.slug);
  if (!d) notFound();
  const [files, tabs] = await Promise.all([getDashboardRepoFiles(d.slug), getGalleryTabs()]);
  const trail = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Dashboards", path: "/gallery/dashboards" },
    { name: d.title, path: `/d/${d.slug}` },
  ]);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(trail) }} />
      <DashboardWorkbench
        nav={<SiteNav tabs={tabs} active="dashboards" />}
        dashboard={d}
        files={files}
        editable={d.framework === "html" && !d.spa}
      />
    </>
  );
}
