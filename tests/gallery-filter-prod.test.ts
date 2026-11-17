// lib/gallery/filter.ts + cards.ts - the gallery's search, single-pill
// filter, sorting and counts, shared by every section (landing pages,
// dashboards, …), plus the card mappers. Landing-page behaviour must stay
// exactly as it was before the gallery got sections.

import { describe, it, expect } from "vitest";
import { applyGalleryFilter, galleryCounts, type ActiveFilter } from "@/lib/gallery/filter";
import { dashboardCard, templateCard } from "@/lib/gallery/cards";
import type { GalleryCard } from "@/lib/gallery/types";
import type { TemplateSummary } from "@/lib/templates";
import type { DashboardRecord } from "@/lib/dashboards/types";

function card(key: string, over: Partial<GalleryCard> = {}): GalleryCard {
  return {
    key,
    title: key,
    subtitle: "Marketing",
    thumb: null,
    chips: [],
    selectHref: `/t/${key}`,
    previewHref: `/preview/${key}`,
    facets: { category: "Marketing", style: null },
    search: key,
    ...over,
  };
}

const cards = [
  card("b-saas", { title: "B SaaS", number: 3, search: "b saas dark", facets: { category: "Landing", style: "Cyber" } }),
  card("a-shop", { title: "A Shop", number: 10, search: "a shop store", facets: { category: "Ecommerce", style: null } }),
  card("c-folio", { title: "C Folio", search: "c folio photographer", facets: { category: "Portfolio", style: "Editorial" } }),
];

describe("applyGalleryFilter", () => {
  const all: ActiveFilter = null;

  it("matches every search token anywhere in the haystack", () => {
    expect(applyGalleryFilter(cards, { query: "shop", active: all, sort: "az" }).map((c) => c.key)).toEqual(["a-shop"]);
    expect(applyGalleryFilter(cards, { query: "  dark   saas ", active: all, sort: "az" }).map((c) => c.key)).toEqual(["b-saas"]);
    expect(applyGalleryFilter(cards, { query: "dark shop", active: all, sort: "az" })).toEqual([]);
  });

  it("filters by one facet value at a time", () => {
    const r = applyGalleryFilter(cards, { query: "", active: { kind: "facet", facet: "style", value: "Cyber" }, sort: "az" });
    expect(r.map((c) => c.key)).toEqual(["b-saas"]);
  });

  it("sorts A→Z, Z→A and by number with unnumbered last", () => {
    const keys = (sort: Parameters<typeof applyGalleryFilter>[1]["sort"]) =>
      applyGalleryFilter(cards, { query: "", active: all, sort }).map((c) => c.key);
    expect(keys("az")).toEqual(["a-shop", "b-saas", "c-folio"]);
    expect(keys("za")).toEqual(["c-folio", "b-saas", "a-shop"]);
    expect(keys("num-asc")).toEqual(["b-saas", "a-shop", "c-folio"]);
    expect(keys("num-desc")).toEqual(["a-shop", "b-saas", "c-folio"]);
  });

  it("sorts best-first by rank, then title", () => {
    const ranked = [card("x", { title: "X", rank: 2 }), card("y", { title: "Y", rank: 5 }), card("w", { title: "W", rank: 5 })];
    expect(applyGalleryFilter(ranked, { query: "", active: all, sort: "best" }).map((c) => c.key)).toEqual(["w", "y", "x"]);
  });

  it("sorts by rating (Bayesian), views and newest, unrated last", () => {
    const rated = [
      card("low", { title: "Low", stats: { rating: 3, ratingCount: 50, views: 900, bayes: 3.1 }, added: "2026-01-01" }),
      card("none", { title: "None", added: "2026-03-01" }),
      card("high", { title: "High", stats: { rating: 4.8, ratingCount: 20, views: 10, bayes: 4.5 }, added: "2026-02-01" }),
    ];
    const keys = (sort: Parameters<typeof applyGalleryFilter>[1]["sort"]) => applyGalleryFilter(rated, { query: "", active: null, sort }).map((c) => c.key);
    expect(keys("top")).toEqual(["high", "low", "none"]);
    expect(keys("views")).toEqual(["low", "high", "none"]);
    expect(keys("new")).toEqual(["none", "high", "low"]);
  });

  it("keeps picks in their curated order whatever the sort", () => {
    const r = applyGalleryFilter(cards, { query: "", active: { kind: "picks" }, sort: "za", picks: ["c-folio", "a-shop"] });
    expect(r.map((c) => c.key)).toEqual(["c-folio", "a-shop"]);
  });
});

describe("galleryCounts", () => {
  it("counts all, picks and every facet value against the search only", () => {
    const c = galleryCounts(cards, { query: "", picks: ["a-shop"], facets: [{ id: "category", label: "Category", values: ["Landing", "Ecommerce", "Portfolio", "Blog"] }, { id: "style", label: "Style", values: ["Cyber", "Editorial"] }] });
    expect(c.all).toBe(3);
    expect(c.picks).toBe(1);
    expect(c.byFacet.get("category:Ecommerce")).toBe(1);
    expect(c.byFacet.get("category:Blog")).toBe(0);
    expect(c.byFacet.get("style:Editorial")).toBe(1);
    const searched = galleryCounts(cards, { query: "dark", picks: [], facets: [{ id: "style", label: "Style", values: ["Cyber"] }] });
    expect(searched.all).toBe(1);
    expect(searched.byFacet.get("style:Cyber")).toBe(1);
  });
});

describe("templateCard", () => {
  const t: TemplateSummary = {
    slug: "42-boutique-hotel",
    title: "Boutique Hotel",
    description: "Rooms and rates",
    category: "Marketing",
    tags: ["hotel"],
    kind: "jsx",
    style: "Editorial",
  };

  it("links the JSX variant by default and the HTML one when asked", () => {
    expect(templateCard(t, true, "jsx")).toMatchObject({
      key: "42-boutique-hotel",
      selectHref: "/t/42-boutique-hotel",
      previewHref: "/preview/42-boutique-hotel",
      thumb: "/thumbs/42-boutique-hotel.webp",
      chips: [{ label: "JSX", accent: true }],
      number: 42,
      facets: { category: "Marketing", style: "Editorial" },
    });
    const html = templateCard({ ...t, kind: "html" }, false, "html");
    expect(html.selectHref).toBe("/t/42-boutique-hotel?kind=html");
    expect(html.previewHref).toBe("/preview/42-boutique-hotel?kind=html");
    expect(html.thumb).toBeNull();
    expect(html.chips).toEqual([{ label: "HTML" }]);
  });

  it("searches title, slug, category, tags and description", () => {
    expect(templateCard(t, true, "jsx").search).toBe("boutique hotel 42-boutique-hotel marketing hotel rooms and rates");
  });
});

describe("dashboardCard", () => {
  const d = {
    slug: "shadcn-admin",
    title: "Shadcn Admin",
    description: "Admin with tasks, chats and settings",
    framework: "react",
    ui: "shadcn",
    category: "Admin",
    tags: ["vite", "tanstack"],
    quality: 5,
    thumb: "/thumbs/dashboards/shadcn-admin.webp",
    pages: [{ path: "", title: "Home" }, { path: "tasks", title: "Tasks" }],
    author: "satnaing",
  } as unknown as DashboardRecord;

  it("opens the dashboard workbench and the full-screen live demo", () => {
    expect(dashboardCard(d)).toMatchObject({
      key: "shadcn-admin",
      title: "Shadcn Admin",
      subtitle: "React · shadcn/ui · 2 pages",
      selectHref: "/d/shadcn-admin",
      previewHref: "/d/shadcn-admin/live",
      thumb: "/thumbs/dashboards/shadcn-admin.webp",
      chips: [{ label: "React", accent: true }, { label: "shadcn/ui" }],
      facets: { stack: "React", ui: "shadcn/ui", category: "Admin" },
      rank: 5,
    });
    expect(dashboardCard(d).search).toContain("satnaing");
  });
});
