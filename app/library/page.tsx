import { permanentRedirect } from "next/navigation";

// The library became the gallery's sections. Old links land in the right one.
export default async function LibraryPage(
  props: { searchParams?: Promise<Record<string, string | string[] | undefined>> }
) {
  const searchParams = await props.searchParams;
  const tab = typeof searchParams?.tab === "string" ? searchParams.tab : "";
  if (tab === "landing") permanentRedirect("/gallery");
  if (tab === "dashboard") permanentRedirect("/gallery/dashboards");
  permanentRedirect("/gallery/components");
}
