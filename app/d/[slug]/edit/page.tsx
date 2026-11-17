import { notFound } from "next/navigation";
import StudioWorkspace from "@/components/studio/StudioWorkspace";
import { getDashboard } from "@/lib/dashboards";
import { editablePageHtml } from "@/lib/dashboards/html";
import { readDemoText } from "@/lib/dashboards/demo-store";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const d = await getDashboard(params.slug);
  return {
    title: d ? `Edit ${d.title}` : "Edit",
    robots: { index: false, follow: false },
  };
}

// One page of a static HTML dashboard in the editor. Its CSS, scripts and
// images keep loading from the demo through a <base> on the page's folder.
export default async function EditDashboardPage(
  props: {
    params: Promise<{ slug: string }>;
    searchParams?: Promise<{ page?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const d = await getDashboard(params.slug);
  if (!d || d.framework !== "html" || d.spa) notFound();
  const requested = typeof searchParams?.page === "string" ? searchParams.page.replace(/^\/+/, "") : "";
  const pagePath = /\.html?$/i.test(requested) ? requested : d.entry;
  if (pagePath.split("/").some((s) => s === "" || s.startsWith("."))) notFound();
  const raw = await readDemoText(d.slug, pagePath);
  if (raw === null) notFound();
  const html = editablePageHtml(raw, pagePath, { slug: d.slug, kind: "static", entry: d.entry });
  const pageTitle = d.pages.find((p) => p.path === pagePath)?.title ?? pagePath;
  return (
    <StudioWorkspace
      origin={{ type: "dashboard", id: `${d.slug}/${pagePath}`, title: `${d.title} - ${pageTitle}`, license: d.license.spdx, sourceUrl: `https://github.com/${d.repo}` }}
      projectTitle={`${d.title} - ${pageTitle}`}
      key={`${d.slug}:${pagePath}`}
      initialCode={html}
      initialKind="html"
      filename={`${d.slug}--${pagePath.replace(/[^a-z0-9]+/gi, "-")}`}
      title={d.title}
      subtitle={pageTitle}
      persistEdits
      backHref={`/d/${d.slug}`}
      backLabel={d.title}
    />
  );
}
