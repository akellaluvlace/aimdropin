import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Component titles and descriptions are shown as the site's own copy (page
// text, share cards, "similar" lists), so they follow the site's style: no em
// dashes. scripts/catalog/publish-catalog.mjs swaps them when it writes the file.
describe("catalog text", () => {
  it("has no em dashes in titles or descriptions", () => {
    const file = path.join(__dirname, "../data/catalog/catalog.json");
    const { items } = JSON.parse(readFileSync(file, "utf8")) as {
      items: { id: string; title?: string; desc?: string }[];
    };
    expect(items.length).toBeGreaterThan(6000);
    const withDash = items.filter((i) => /\u2014/.test(`${i.title ?? ""} ${i.desc ?? ""}`));
    expect(withDash.map((i) => i.id)).toEqual([]);
  });
});
