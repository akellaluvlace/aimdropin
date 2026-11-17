import { notFound, permanentRedirect } from "next/navigation";
import { idFromSegments } from "@/components/catalog/labels";
import { getLibraryItem } from "@/lib/catalog/library";
import { componentHref, componentTypeOf } from "@/lib/catalog/components";

export const dynamic = "force-dynamic";

// Old /library/<id> links: components moved to /c/<id>, our own templates
// open in the editor.
export default async function LibraryItemRedirect(props: { params: Promise<{ id: string[] }> }) {
  const params = await props.params;
  const item = await getLibraryItem(idFromSegments(params.id));
  if (!item) notFound();
  if (item.editorSlug) permanentRedirect(`/t/${item.editorSlug}`);
  if (componentTypeOf(item)) permanentRedirect(componentHref(item.id));
  permanentRedirect("/gallery");
}
