import { describe, expect, it } from "vitest";
import { bringsOwnCss, buildPreviewDocument } from "../lib/preview";

describe("Tailwind injection for HTML previews", () => {
  it("adds Tailwind to plain Tailwind-class pages", () => {
    const doc = buildPreviewDocument({ code: '<div class="p-4">x</div>', kind: "html" });
    expect(doc).toContain("cdn.tailwindcss.com");
    expect(bringsOwnCss('<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet">')).toBe(false);
  });

  it("leaves pages with their own stylesheet alone", () => {
    const boot =
      '<!doctype html><html><head><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"></head><body><div class="container">x</div></body></html>';
    expect(bringsOwnCss(boot)).toBe(true);
    expect(buildPreviewDocument({ code: boot, kind: "html" })).not.toContain("cdn.tailwindcss.com");
    expect(bringsOwnCss('<script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>')).toBe(true);
  });
});
