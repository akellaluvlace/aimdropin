import { describe, expect, it } from "vitest";
import {
  getLibraryItem,
  heuristicScore,
  inTab,
  parseLibraryQuery,
  queryLibrary,
  type LibraryItem,
} from "../lib/catalog/library";
import { SITE_URL } from "../lib/site";

const base: LibraryItem = {
  id: "@x/y",
  src: "@x",
  name: "y",
  title: "Y",
  desc: null,
  kind: "component",
  purpose: "general",
  stack: "react-tsx",
  fw: null,
  type: "registry:ui",
  cats: [],
  deps: [],
  regDeps: [],
  heavy: [],
  lic: "MIT",
  licUrl: "https://x",
  freeOnly: false,
  author: null,
  home: null,
  srcUrl: null,
  install: {
    method: "shadcn",
    command: "npx shadcn@latest add @x/y",
    url: "https://x/r/y.json",
  },
  thumb: null,
  demo: null,
  ghStars: null,
  preview: "unknown",
};

describe("library tabs and scoring", () => {
  it("routes items to tabs", () => {
    expect(
      inTab({ ...base, kind: "page", purpose: "landing" }, "landing"),
    ).toBe(true);
    expect(
      inTab({ ...base, kind: "page", purpose: "dashboard" }, "landing"),
    ).toBe(false);
    expect(
      inTab({ ...base, kind: "page", purpose: "dashboard" }, "dashboard"),
    ).toBe(true);
    // Chart sections are sections, not dashboards.
    expect(
      inTab({ ...base, kind: "section", purpose: "dashboard" }, "dashboard"),
    ).toBe(false);
    expect(
      inTab({ ...base, kind: "section", purpose: "dashboard" }, "section"),
    ).toBe(true);
    // Curated catalog items carry their tab: a login page is an app screen.
    expect(
      inTab(
        { ...base, kind: "page", purpose: "auth", tab: "screen" },
        "screen",
      ),
    ).toBe(true);
    expect(
      inTab(
        { ...base, kind: "page", purpose: "auth", tab: "screen" },
        "landing",
      ),
    ).toBe(false);
    expect(inTab(base, "component")).toBe(true);
  });

  it("ranks pages and previewable items above bare components", () => {
    expect(heuristicScore({ ...base, kind: "page" })).toBeGreaterThan(
      heuristicScore(base),
    );
    expect(heuristicScore({ ...base, preview: "ok" })).toBeGreaterThan(
      heuristicScore({ ...base, preview: "error" }),
    );
  });

  it("parses query params defensively", () => {
    expect(
      parseLibraryQuery({ tab: "evil", sort: "x", page: "-3", stack: "react" }),
    ).toMatchObject({
      tab: "all",
      sort: "popular",
      page: 1,
      stack: "react",
    });
    expect(parseLibraryQuery({ q: ["a", "b"], page: "2" })).toMatchObject({
      q: "a",
      page: 2,
    });
  });
});

// Runs against the published catalog (data/catalog/catalog.json) + our own
// templates, like the /library page does.
describe("queryLibrary on the real catalog", () => {
  it("finds dashboards and counts tabs", async () => {
    const r = await queryLibrary({ tab: "dashboard", pageSize: 96 });
    expect(r.total).toBeGreaterThan(10);
    expect(r.items.every((i) => i.kind === "page")).toBe(true);
    expect(r.tabCounts.all).toBeGreaterThan(4000);
  });

  it("lists only items that render, with no link-outs", async () => {
    const r = await queryLibrary({ pageSize: 96 });
    for (let page = 1; page <= Math.ceil(r.total / 96); page++) {
      const p = await queryLibrary({ pageSize: 96, page });
      for (const i of p.items) {
        expect(i.install.method, i.id).not.toBe("clone");
        expect(i.preview, i.id).toBe("ok");
        if (i.src !== "aimdropin") expect(i.thumb, i.id).toBeTruthy();
      }
    }
    const landing = await queryLibrary({ tab: "landing", pageSize: 96 });
    for (const i of landing.items)
      expect(["aimdropin", "open-source"], i.id).toContain(i.src);
  });

  it("searches across titles, categories and sources", async () => {
    const r = await queryLibrary({ q: "pricing", pageSize: 20 });
    expect(r.total).toBeGreaterThan(5);
    expect(
      r.items.some((i) => /pricing/i.test(i.title + " " + i.cats.join(" "))),
    ).toBe(true);
    const src = await queryLibrary({ q: "shadcn sidebar" });
    expect(src.items.some((i) => i.src === "@shadcn")).toBe(true);
  });

  it("filters by source and stack, and pages", async () => {
    const r = await queryLibrary({
      source: "hyperui",
      stack: "html",
      pageSize: 5,
      page: 2,
    });
    expect(r.items).toHaveLength(5);
    expect(
      r.items.every((i) => i.src === "hyperui" && i.stack === "html"),
    ).toBe(true);
    const react = await queryLibrary({ source: "hyperui", stack: "react" });
    expect(react.total).toBe(0);
  });

  it("merges our templates, first in Best-first order", async () => {
    const r = await queryLibrary({ tab: "landing", pageSize: 5 });
    expect(r.items[0].src).toBe("aimdropin");
    const t = await getLibraryItem(r.items[0].id);
    expect(t?.editorSlug).toBeTruthy();
  });

  it("links our own templates to the live site", async () => {
    const r = await queryLibrary({ source: "aimdropin", pageSize: 96 });
    expect(r.items.length).toBeGreaterThan(0);
    expect(r.items.some((i) => i.srcUrl?.startsWith(`${SITE_URL}/t/`))).toBe(
      true,
    );
    for (const i of r.items) {
      expect(`${i.home} ${i.srcUrl}`).not.toContain("akellainmotion");
    }
  });

  it("only lists allowlisted licenses", async () => {
    const r = await queryLibrary({ pageSize: 96 });
    const allowed = new Set([
      "MIT",
      "Apache-2.0",
      "BSD-2-Clause",
      "BSD-3-Clause",
      "ISC",
      "0BSD",
      "Unlicense",
      "CC0-1.0",
    ]);
    for (let page = 1; page <= Math.ceil(r.total / 96); page++) {
      const p = await queryLibrary({ pageSize: 96, page });
      for (const i of p.items)
        expect(allowed.has(i.lic), `${i.id} has ${i.lic}`).toBe(true);
    }
  });
});
