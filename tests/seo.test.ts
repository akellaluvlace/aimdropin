import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, componentPageMeta, jsonLdHtml, sharedTitleIds, templatePageMeta } from "../lib/seo";
import { SITE_URL } from "../lib/site";

describe("componentPageMeta", () => {
  const base = { title: "Accordion", desc: null, kind: "Component", stack: "React TSX", author: null, lic: "MIT" };

  it("names the source, so the same component from two libraries gets two titles", () => {
    const a = componentPageMeta(base, "shadcn/ui");
    const b = componentPageMeta(base, "HextaUI");
    expect(a.title).toBe("Accordion · shadcn/ui component");
    expect(b.title).toBe("Accordion · HextaUI component");
  });

  it("describes an item that has no description of its own", () => {
    const m = componentPageMeta({ ...base, title: "Bad Chipmunk 3", stack: "HTML", author: "csozidev" }, "Uiverse");
    expect(m.description).toBe("Bad Chipmunk 3: a free HTML component from Uiverse by csozidev (MIT), with live preview, code and install command.");
  });

  it("keeps the item's own description first and adds what it is", () => {
    const m = componentPageMeta({ ...base, desc: "The main Accordion demo from the docs." }, "HextaUI");
    expect(m.description).toBe("The main Accordion demo from the docs. A free React TSX component from HextaUI (MIT), with live preview, code and install command.");
  });

  it("does not credit the source twice", () => {
    const m = componentPageMeta({ ...base, kind: "Section", stack: "HTML", author: "HyperUI" }, "HyperUI");
    expect(m.description).toContain("section from HyperUI (MIT)");
    expect(m.description).not.toContain("by HyperUI");
  });

  it("works without a stack and marks the full-screen preview", () => {
    const m = componentPageMeta({ ...base, stack: null }, "Astryx", true);
    expect(m.title).toBe("Preview: Accordion · Astryx component");
    expect(m.description).toContain("a free component from Astryx (MIT)");
  });

  it("leads with the item's name when its own description doesn't mention it", () => {
    // 18 "Features" blocks from one library all say "A simple features block."
    const m = componentPageMeta({ ...base, title: "Features 03", kind: "Section", desc: "A simple features block." }, "shadcn/ui blocks");
    expect(m.description).toBe(
      "Features 03: A simple features block. A free React TSX section from shadcn/ui blocks (MIT), with live preview, code and install command.",
    );
  });
});

describe("sharedTitleIds", () => {
  it("finds items whose name is shared by another item from the same library", () => {
    const items = [
      { id: "@a/button-1", src: "@a", title: "Button" },
      { id: "@a/button-2", src: "@a", title: "Button" },
      { id: "@b/button", src: "@b", title: "Button" },
      { id: "@a/card", src: "@a", title: "Card" },
    ];
    expect([...sharedTitleIds(items)].sort()).toEqual(["@a/button-1", "@a/button-2"]);
    // Same list, same answer, without counting again.
    expect(sharedTitleIds(items)).toBe(sharedTitleIds(items));
  });
});

describe("templatePageMeta", () => {
  const t = { title: "Newsletter Landing", category: "Blog", style: "Editorial" as string | null };

  it("says what the template is, in which formats, and that it is free", () => {
    const m = templatePageMeta(t, ["jsx", "html"]);
    expect(m.title).toBe("Newsletter Landing - free landing page template");
    expect(m.description).toBe(
      "Newsletter Landing: a free editorial blog page template in HTML and JSX. Preview it live, edit it in your browser, then copy or download the code. MIT licensed.",
    );
  });

  it("handles one format, no style and the plain landing category", () => {
    const m = templatePageMeta({ title: "Aether", category: "Landing", style: null }, ["html"]);
    expect(m.description).toBe(
      "Aether: a free landing page template in HTML. Preview it live, edit it in your browser, then copy or download the code. MIT licensed.",
    );
  });

  it("has a phrase for every category and never an em dash", () => {
    for (const category of ["Ecommerce", "Portfolio", "Blog", "Dashboard", "Marketing", "Utility", "Landing", "Something new"]) {
      const m = templatePageMeta({ ...t, category }, ["jsx", "html"]);
      expect(m.description).toMatch(/ page template in HTML and JSX\./);
      expect(m.description + m.title).not.toContain("\u2014");
    }
  });
});

describe("breadcrumbJsonLd", () => {
  it("lists the trail in order with absolute addresses", () => {
    const ld = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Dashboards", path: "/gallery/dashboards" },
      { name: "Mazer", path: "/d/mazer" },
    ]);
    expect(ld["@type"]).toBe("BreadcrumbList");
    expect(ld.itemListElement.map((e) => e.position)).toEqual([1, 2, 3]);
    expect(ld.itemListElement[0].item).toBe(`${SITE_URL}/`);
    expect(ld.itemListElement[2]).toEqual({ "@type": "ListItem", position: 3, name: "Mazer", item: `${SITE_URL}/d/mazer` });
  });
});

describe("jsonLdHtml", () => {
  it("cannot be closed early by a title from someone else's catalog", () => {
    const html = jsonLdHtml({ name: 'x</script><script>alert(1)</script>', note: "a & b \u2028 c" });
    expect(html).not.toContain("</script>");
    expect(html).not.toContain("<");
    expect(html).not.toContain("\u2028");
    expect(JSON.parse(html)).toEqual({ name: 'x</script><script>alert(1)</script>', note: "a & b \u2028 c" });
  });
});
