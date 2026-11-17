// lib/dashboards/canonical.ts - asset requests with a query string go to the
// bare (cached) URL, so a random query can't force a fresh bucket fetch.

import { describe, it, expect } from "vitest";
import { bareAssetUrl } from "@/lib/dashboards/canonical";

const u = (s: string) => new URL(s, "https://www.aimdropin.com");

describe("bareAssetUrl", () => {
  it("sends asset requests that carry a query to the bare URL", () => {
    expect(bareAssetUrl(u("/demos/x/app.bundle.js?cb=123"))?.href).toBe("https://www.aimdropin.com/demos/x/app.bundle.js");
    expect(bareAssetUrl(u("/demos/x/fonts/fa.woff2?v=4.7.0"))?.href).toBe("https://www.aimdropin.com/demos/x/fonts/fa.woff2");
  });

  it("leaves HTML pages, extensionless routes and query-free URLs alone", () => {
    for (const s of ["/demos/x/index.html?page=2", "/demos/x/page.htm?a=1", "/demos/x/dashboard?tab=1", "/demos/x/app.js", "/demos/x/.env?x"]) {
      expect(bareAssetUrl(u(s))).toBeNull();
    }
  });
});
