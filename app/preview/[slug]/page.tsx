import { notFound } from "next/navigation";
import PreviewRoute from "@/components/PreviewRoute";
import { getTemplate, type TemplateKind } from "@/lib/templates";
import { templateNeighbors } from "@/lib/gallery/neighbors";

function readKind(searchParams?: { kind?: string }): TemplateKind {
  return searchParams?.kind === "html" ? "html" : "jsx";
}

export async function generateMetadata(
  props: {
    params: Promise<{ slug: string }>;
    searchParams?: Promise<{ kind?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const t = await getTemplate(params.slug, {
    preferKind: readKind(searchParams),
  });
  return {
    title: t ? `Preview: ${t.title}` : "Preview",
    // The preview route is a transient, full-bleed render of a single
    // template. Don't dilute search results with N preview pages - the
    // canonical landing for each template is /t/[slug].
    robots: { index: false, follow: true },
  };
}

export default async function FullscreenPreviewPage(
  props: {
    params: Promise<{ slug: string }>;
    searchParams?: Promise<{ kind?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const preferKind = readKind(searchParams);
  const [template, nav] = await Promise.all([getTemplate(params.slug, { preferKind }), templateNeighbors(params.slug, preferKind)]);
  if (!template) notFound();

  return (
    <PreviewRoute
      code={template.source}
      kind={template.kind}
      filename={template.slug}
      steps={nav}
    />
  );
}
