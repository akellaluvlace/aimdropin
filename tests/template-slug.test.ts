// lib/templates.ts - slugs come from the URL and are joined onto
// templates/ and web/, so they must never be able to leave those folders.

import { describe, it, expect } from "vitest";
import { getAllTemplates, getTemplate, isSafeTemplateSlug } from "@/lib/templates";

describe("isSafeTemplateSlug", () => {
  it("accepts every real slug", async () => {
    const all = await getAllTemplates();
    expect(all.length).toBeGreaterThan(100);
    for (const t of all) expect(isSafeTemplateSlug(t.slug)).toBe(true);
  });

  it("rejects traversal, separators and odd characters", () => {
    for (const bad of ["", "..", "../web", "a/b", "a\\b", ".hidden", "a..b", "..%2Fweb", "x".repeat(121)]) {
      expect(isSafeTemplateSlug(bad)).toBe(false);
    }
  });

  it("never loads anything for a traversal slug", async () => {
    expect(await getTemplate("../templates/coming-soon")).toBeNull();
  });
});
