import { notFound } from "next/navigation";
import PublishedPageView from "@/components/community/PublishedPageView";
import { getPublishedPage, PURPOSE_LABEL } from "@/lib/community/listing";

export const dynamic = "force-dynamic";

export async function generateMetadata(
  props: { params: Promise<{ id: string }>; searchParams?: Promise<{ full?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const p = await getPublishedPage(params.id);
  if (!p) return { title: "Not found", robots: { index: false } };
  return {
    title: `${p.title}${p.username ? ` by @${p.username}` : ""} · Community`,
    description: p.description ?? `A ${PURPOSE_LABEL[p.purpose]?.toLowerCase() ?? "page"} shared on AiM Dropin. Rate it or remix it.`,
    alternates: { canonical: `/p/${p.id}` },
    robots: searchParams?.full ? { index: false, follow: true } : undefined,
  };
}

export default async function PublishedPage(
  props: { params: Promise<{ id: string }>; searchParams?: Promise<{ full?: string }> }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const p = await getPublishedPage(params.id);
  if (!p) notFound();
  return (
    <PublishedPageView
      id={p.id}
      title={p.title}
      description={p.description}
      username={p.username}
      kindLabel={PURPOSE_LABEL[p.purpose] ?? "Page"}
      stack={p.stack}
      source={p.source}
      credits={p.credits}
      full={Boolean(searchParams?.full)}
    />
  );
}
