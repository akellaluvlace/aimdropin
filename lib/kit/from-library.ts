// LibraryItem → KitItem. Kept separate from kit-store so the store has no
// dependency on the server-side catalog types.

import type { LibraryItem } from "@/lib/catalog/library";
import type { KitCodeRef, KitItem } from "./kit-store";

export function codeRefFor(
  item: Pick<LibraryItem, "src" | "name" | "install" | "editorSlug" | "stack">,
): KitCodeRef {
  if (item.editorSlug) return { type: "template", slug: item.editorSlug };
  if (item.install.method === "shadcn" && item.install.url)
    return { type: "registry", url: item.install.url };
  if (item.src === "community") return { type: "page", id: item.name };
  if (item.install.method === "editor" && item.stack === "html") {
    return { type: "html-component", slug: item.name };
  }
  return { type: "none" };
}

// The fields a kit entry needs; the search API returns just these.
export type KitSourceItem = Pick<
  LibraryItem,
  | "id"
  | "src"
  | "name"
  | "title"
  | "kind"
  | "purpose"
  | "stack"
  | "thumb"
  | "srcUrl"
  | "home"
  | "lic"
  | "licUrl"
  | "author"
  | "install"
  | "editorSlug"
>;

export function kitItemFromLibrary(
  item: KitSourceItem,
  srcLabel?: string,
): Omit<KitItem, "note" | "addedAt"> {
  return {
    id: item.id,
    title: item.title,
    src: item.src,
    srcLabel,
    kind: item.kind,
    purpose: item.purpose,
    stack: item.stack,
    thumb: item.thumb,
    srcUrl: item.srcUrl ?? item.home,
    lic: item.lic,
    licUrl: item.licUrl,
    author: item.author,
    codeRef: codeRefFor(item),
  };
}
