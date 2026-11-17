import { notFound } from "next/navigation";
import StudioWorkspace from "@/components/studio/StudioWorkspace";
import {
  getTemplate,
  getThumbSlugs,
  listTemplateKinds,
  type TemplateKind,
} from "@/lib/templates";
import { breadcrumbJsonLd, jsonLdHtml, templatePageMeta } from "@/lib/seo";
import { socialMeta } from "@/lib/site";

// No `generateStaticParams` on purpose: `searchParams.kind` makes the route
// dynamic, and folder vs. web templates already have cheap reads, so SSG would
// only duplicate work for each ?kind= variant.

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
  const template = await getTemplate(params.slug, {
    preferKind: readKind(searchParams),
  });
  if (!template) {
    return { title: "Not found" };
  }
  const [thumbs, kinds] = await Promise.all([getThumbSlugs(), listTemplateKinds(template.slug)]);
  const hasThumb = thumbs.has(template.slug);
  const { title, description } = templatePageMeta(template, kinds);
  return {
    title,
    description,
    alternates: { canonical: `/t/${template.slug}` },
    ...socialMeta({
      title,
      description,
      path: `/t/${template.slug}`,
      image: hasThumb ? { url: `/thumbs/${template.slug}.webp`, width: 1280, height: 800, alt: `${template.title} landing page` } : null,
    }),
  };
}

export default async function TemplatePage(
  props: {
    params: Promise<{ slug: string }>;
    searchParams?: Promise<{ kind?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const preferKind = readKind(searchParams);
  const [template, availableKinds] = await Promise.all([
    getTemplate(params.slug, { preferKind }),
    listTemplateKinds(params.slug),
  ]);
  if (!template) notFound();

  // `key` forces Workspace to remount when the URL toggle flips kinds, so
  // its `useState(initialCode)` picks up the sibling file's source instead of
  // holding on to the previous variant.
  const trail = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Landing pages", path: "/gallery" },
    { name: template.title, path: `/t/${template.slug}` },
  ]);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdHtml(trail) }} />
      {/* "contents": a <main> landmark that adds no box, so the workspace's
          full-height layout is untouched. */}
      <main className="contents">
        <StudioWorkspace
          origin={{ type: "template", id: template.slug, title: template.title, license: "MIT" }}
          projectTitle={template.title}
          rateTarget={{ type: "template", id: template.slug }}
          backHref="/gallery"
          backLabel="Landing pages"
          key={`${template.slug}:${template.kind}`}
          initialCode={template.source}
          initialKind={template.kind}
          filename={template.slug}
          title={template.title}
          subtitle={template.category}
          urlKindToggle={availableKinds.length > 1}
        />
      </main>
    </>
  );
}
