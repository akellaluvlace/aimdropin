import type { LibraryItem } from "@/lib/catalog/library";

// Ids look like "@shadcn/dashboard-01" or "uiverse/uiverse-buttons-…"; each
// segment is encoded so "@" and friends survive the round trip.
export function itemHref(id: string): string {
  return "/library/" + id.split("/").map(encodeURIComponent).join("/");
}

export function idFromSegments(segments: string[]): string {
  return segments.map((s) => decodeURIComponent(s)).join("/");
}

export function kindLabel(
  item: Pick<LibraryItem, "kind" | "purpose" | "tab" | "src">,
): string {
  if (item.kind === "page") {
    if (item.tab === "dashboard" || item.purpose === "dashboard")
      return "Dashboard";
    if (item.tab === "screen") return "App screen";
    return "Landing page";
  }
  if (item.kind === "section") return "Section";
  return "Component";
}

export function stackLabel(stack: NonNullable<LibraryItem["stack"]>): string {
  return stack === "html"
    ? "HTML"
    : stack === "react-tsx"
      ? "React TSX"
      : "React JSX";
}
