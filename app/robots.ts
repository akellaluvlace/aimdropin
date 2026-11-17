import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Per-browser builds, account pages and sign-in callbacks have
        // nothing to index; live demos are other people's templates (the
        // /d/<slug> page is the canonical one).
        disallow: ["/api/", "/build/d/", "/me", "/connect/", "/auth/", "/demos/", "/d/*/live", "/d/*/edit"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
