// queryLibrary's word match for items outside the search index (published
// community pages): every search word must appear, split on whitespace.

import { describe, it, expect } from "vitest";
import { queryLibrary, type LibraryItem } from "@/lib/catalog/library";

function communityItem(title: string): LibraryItem {
  return {
    id: `community/${title.toLowerCase().replace(/\s+/g, "-")}`,
    src: "community",
    name: title,
    title,
    desc: null,
    kind: "page",
    tab: "landing",
    purpose: "landing",
    stack: "html",
    fw: null,
    type: null,
    cats: [],
    deps: [],
    regDeps: [],
    heavy: [],
    lic: "MIT",
    licUrl: null,
    freeOnly: false,
    author: null,
    home: null,
    srcUrl: null,
    install: { method: "editor" },
    thumb: null,
    demo: null,
    ghStars: null,
    preview: "ok",
  };
}

describe("queryLibrary - community word match", () => {
  const extra = [communityItem("Clean dashboard"), communityItem("Sass landing")];

  it("doesn't treat the letter s as a word separator", async () => {
    const r = await queryLibrary({ q: "sass", pageSize: 96 }, undefined, extra);
    const ids = r.items.filter((i) => i.src === "community").map((i) => i.title);
    expect(ids).toEqual(["Sass landing"]);
  });

  it("needs every word", async () => {
    const r = await queryLibrary({ q: "clean   dashboard", pageSize: 96 }, undefined, extra);
    expect(r.items.filter((i) => i.src === "community").map((i) => i.title)).toEqual(["Clean dashboard"]);
  });
});
