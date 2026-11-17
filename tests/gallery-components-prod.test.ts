// lib/catalog/components.ts - the gallery's Components section: which
// catalog items it lists, its facets (type, stack, source, category), the
// single-pill filter, counts, sorting, paging and the card mapping.

import { describe, it, expect } from "vitest";
import {
  componentCard,
  componentTypeOf,
  normalizeCategory,
  selectComponents,
} from "@/lib/catalog/components";
import type { LibraryItem } from "@/lib/catalog/library";

function item(id: string, over: Partial<LibraryItem> = {}): LibraryItem {
  return {
    id,
    src: id.split("/")[0],
    name: id.split("/").slice(1).join("/"),
    title: id.split("/").pop() ?? id,
    desc: null,
    kind: "component",
    tab: "component",
    purpose: "general",
    stack: "react-tsx",
    fw: null,
    type: "registry:ui",
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
    install: { method: "shadcn", command: "npx shadcn@latest add x", url: "https://x/r/x.json" },
    thumb: `/catalog-thumbs/r/${id.length}.webp`,
    demo: null,
    ghStars: null,
    preview: "ok",
    ...over,
  };
}

const labels = new Map([
  ["@magicui", "Magic UI"],
  ["hyperui", "HyperUI"],
  ["@shadcn", "shadcn/ui"],
]);

describe("componentTypeOf", () => {
  it("maps catalog tabs onto Components / Sections / Screens", () => {
    expect(componentTypeOf(item("@magicui/marquee"))).toBe("component");
    expect(componentTypeOf(item("@shadcn/hero-1", { kind: "section", tab: "section" }))).toBe("section");
    for (const tab of ["screen", "dashboard", "landing"] as const) {
      expect(componentTypeOf(item("@shadcn/login-03", { kind: "page", tab }))).toBe("screen");
    }
  });

  it("leaves out our own templates and whole-app GitHub templates", () => {
    expect(componentTypeOf(item("aimdropin/3-saas-dark", { src: "aimdropin", editorSlug: "3-saas-dark" }))).toBeNull();
    expect(componentTypeOf(item("tailadmin/app", { install: { method: "clone", repo: "a/b", commit: "c" } }))).toBeNull();
    expect(componentTypeOf(item("@x/broken", { preview: "error" }))).toBeNull();
  });
});

describe("normalizeCategory", () => {
  it("merges singular/plural and chart variants into one readable label", () => {
    expect(normalizeCategory("button")).toBe("Buttons");
    expect(normalizeCategory("buttons")).toBe("Buttons");
    expect(normalizeCategory("charts-radar")).toBe("Charts");
    expect(normalizeCategory("chart")).toBe("Charts");
    expect(normalizeCategory("checkbox")).toBe("Checkboxes");
    expect(normalizeCategory("authentication")).toBe("Authentication");
    expect(normalizeCategory("other")).toBeNull();
    expect(normalizeCategory("")).toBeNull();
  });
});

describe("componentCard", () => {
  it("opens the component workbench and its full-screen preview", () => {
    const c = componentCard(item("@magicui/marquee", { title: "Marquee", cats: ["animation"] }), labels);
    expect(c).toMatchObject({
      key: "@magicui/marquee",
      title: "Marquee",
      subtitle: "Magic UI · Component",
      selectHref: "/c/%40magicui/marquee",
      previewHref: "/c/%40magicui/marquee/preview",
      chips: [{ label: "React", accent: true }],
    });
    expect(c.search).toContain("magic ui");
    const html = componentCard(item("hyperui/accordions-base", { stack: "html", title: "Base", kind: "section", tab: "section" }), labels);
    expect(html.subtitle).toBe("HyperUI · Section");
    expect(html.chips).toEqual([{ label: "HTML" }]);
  });
});

describe("selectComponents", () => {
  const items = [
    item("@magicui/marquee", { title: "Marquee", cats: ["animation"] }),
    item("@magicui/globe", { title: "Globe", cats: ["animation"] }),
    item("hyperui/hero-1", { stack: "html", title: "Hero One", kind: "section", tab: "section", cats: ["hero"] }),
    item("@shadcn/login-03", { title: "Login 03", kind: "page", tab: "screen", cats: ["authentication"] }),
  ];
  const score = (i: LibraryItem) => (i.id === "@magicui/globe" ? 10 : 1);

  it("counts every facet value over the whole matched set", () => {
    const r = selectComponents(items, labels, { active: null, sort: "az", page: 1, pageSize: 24 }, score);
    expect(r.total).toBe(4);
    expect(r.counts.all).toBe(4);
    expect(r.counts.byFacet["type:Components"]).toBe(2);
    expect(r.counts.byFacet["type:Sections"]).toBe(1);
    expect(r.counts.byFacet["type:Screens"]).toBe(1);
    expect(r.counts.byFacet["stack:HTML"]).toBe(1);
    expect(r.counts.byFacet["source:Magic UI"]).toBe(2);
    expect(r.counts.byFacet["category:Animation"]).toBe(2);
  });

  it("filters by one facet value and sorts", () => {
    const r = selectComponents(items, labels, { active: { facet: "source", value: "Magic UI" }, sort: "az", page: 1, pageSize: 24 }, score);
    expect(r.cards.map((c) => c.title)).toEqual(["Globe", "Marquee"]);
    const pop = selectComponents(items, labels, { active: null, sort: "popular", page: 1, pageSize: 24 }, score);
    expect(pop.cards[0].title).toBe("Globe");
  });

  it("mixes types when nothing is filtered, components first", () => {
    const many = [
      ...Array.from({ length: 6 }, (_, k) => item(`@shadcn/screen-${k}`, { title: `S${k}`, kind: "page", tab: "screen" })),
      ...Array.from({ length: 6 }, (_, k) => item(`@magicui/comp-${k}`, { title: `C${k}` })),
      ...Array.from({ length: 6 }, (_, k) => item(`hyperui/sec-${k}`, { title: `X${k}`, kind: "section", tab: "section" })),
    ];
    // Screens score highest, but the unfiltered view still leads with components.
    const scoreTyped = (i: LibraryItem) => (i.tab === "screen" ? 100 : i.tab === "section" ? 50 : 10);
    const r = selectComponents(many, labels, { active: null, sort: "popular", page: 1, pageSize: 6 }, scoreTyped);
    expect(r.cards.map((c) => c.facets.type)).toEqual(["Components", "Components", "Sections", "Components", "Screens", "Sections"]);
    const onlyScreens = selectComponents(many, labels, { active: { facet: "type", value: "Screens" }, sort: "popular", page: 1, pageSize: 3 }, scoreTyped);
    expect(onlyScreens.cards.every((c) => c.facets.type === "Screens")).toBe(true);
  });

  it("pages results", () => {
    const p2 = selectComponents(items, labels, { active: null, sort: "az", page: 2, pageSize: 3 }, score);
    expect(p2.cards.map((c) => c.title)).toEqual(["Marquee"]);
    expect(p2.page).toBe(2);
    expect(p2.total).toBe(4);
  });

  it("lists only facet values that have items, biggest first", () => {
    const r = selectComponents(items, labels, { active: null, sort: "az", page: 1, pageSize: 24 }, score);
    const source = r.facets.find((f) => f.id === "source");
    expect(source?.values).toEqual(["Magic UI", "HyperUI", "shadcn/ui"]);
    expect(r.facets.find((f) => f.id === "type")?.values).toEqual(["Components", "Sections", "Screens"]);
  });
});
