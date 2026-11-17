// lib/dashboards/serve.ts - maps a /demos/<slug>/<path> request onto a stored
// file, a redirect, or a 404, without ever leaving demos/<slug>/.

import { describe, it, expect } from "vitest";
import { resolveDemoPath, isValidSlug } from "@/lib/dashboards/serve";
import type { DemoServeInfo } from "@/lib/dashboards/types";

const staticInfo: DemoServeInfo = {
  slug: "sb-admin-2",
  kind: "static",
  entry: "index.html",
  spa: false,
  cdnBase: "https://cdn.jsdelivr.net/gh/StartBootstrap/startbootstrap-sb-admin-2@f0309881ef82794a1bd6257cd321801bc38a0f3d/",
  cdnRoot: "",
  cdnMap: null,
};

const spaInfo: DemoServeInfo = {
  slug: "shadcn-admin",
  kind: "build",
  entry: "index.html",
  spa: true,
  cdnBase: "https://cdn.jsdelivr.net/gh/satnaing/shadcn-admin@aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/",
  cdnRoot: null,
  cdnMap: { "images/shadcn-admin.png": "public/images/shadcn-admin.png" },
};

const has = (files: string[]) => (rel: string) => files.includes(rel);

describe("resolveDemoPath - static sites", () => {
  const exists = has(["index.html", "tables.html", "pages/index.html", "docs/guide.html"]);

  it("sends the bare demo URL to the entry page", () => {
    expect(resolveDemoPath(staticInfo, [], exists)).toEqual({
      kind: "redirect",
      location: "/demos/sb-admin-2/index.html",
    });
  });

  it("serves stored files", () => {
    expect(resolveDemoPath(staticInfo, ["tables.html"], exists)).toEqual({ kind: "file", rel: "tables.html" });
  });

  it("redirects folders to their index.html so relative links resolve", () => {
    expect(resolveDemoPath(staticInfo, ["pages"], exists)).toEqual({
      kind: "redirect",
      location: "/demos/sb-admin-2/pages/index.html",
    });
  });

  it("resolves extensionless paths to .html", () => {
    expect(resolveDemoPath(staticInfo, ["tables"], exists)).toEqual({ kind: "file", rel: "tables.html" });
  });

  it("redirects assets that aren't stored to jsDelivr under cdnRoot", () => {
    expect(resolveDemoPath(staticInfo, ["vendor", "jquery", "jquery.min.js"], exists)).toEqual({
      kind: "redirect",
      location: `${staticInfo.cdnBase}vendor/jquery/jquery.min.js`,
    });
    const nested = { ...staticInfo, cdnRoot: "dist" };
    expect(resolveDemoPath(nested, ["css", "a.css"], exists)).toEqual({
      kind: "redirect",
      location: `${staticInfo.cdnBase}dist/css/a.css`,
    });
  });

  it("never sends a missing HTML page to jsDelivr (it would show as text)", () => {
    expect(resolveDemoPath(staticInfo, ["missing.html"], exists)).toEqual({ kind: "notfound" });
  });

  it("404s missing assets when jsDelivr can't serve the repo", () => {
    expect(resolveDemoPath({ ...staticInfo, cdnBase: null }, ["a.css"], exists)).toEqual({ kind: "notfound" });
  });
});

describe("resolveDemoPath - built SPAs", () => {
  const exists = has(["index.html", "assets/index-abc.js", "settings/index.html", "about.html"]);

  it("serves the entry at the bare URL", () => {
    expect(resolveDemoPath(spaInfo, [], exists)).toEqual({ kind: "file", rel: "index.html" });
  });

  it("serves folder indexes and .html pages directly (assets are absolute)", () => {
    expect(resolveDemoPath(spaInfo, ["settings"], exists)).toEqual({ kind: "file", rel: "settings/index.html" });
    expect(resolveDemoPath(spaInfo, ["about"], exists)).toEqual({ kind: "file", rel: "about.html" });
  });

  it("falls back to the entry for client routes", () => {
    expect(resolveDemoPath(spaInfo, ["users", "42"], exists)).toEqual({ kind: "file", rel: "index.html" });
  });

  it("redirects mapped build outputs to jsDelivr", () => {
    expect(resolveDemoPath(spaInfo, ["images", "shadcn-admin.png"], exists)).toEqual({
      kind: "redirect",
      location: `${spaInfo.cdnBase}public/images/shadcn-admin.png`,
    });
  });

  it("404s missing files that have an extension", () => {
    expect(resolveDemoPath(spaInfo, ["assets", "gone.js"], exists)).toEqual({ kind: "notfound" });
  });

  it("doesn't fall back for non-SPA builds", () => {
    expect(resolveDemoPath({ ...spaInfo, spa: false }, ["users", "42"], exists)).toEqual({ kind: "notfound" });
  });
});

describe("resolveDemoPath - hostile paths", () => {
  const exists = () => true;
  it("rejects traversal, dotfiles, separators and NUL", () => {
    for (const segs of [[".."], ["a", "..", "..", "etc"], ["."], [".env"], ["a/b"], ["a\\b"], ["a\0b"], [""]]) {
      expect(resolveDemoPath(staticInfo, segs, exists)).toEqual({ kind: "notfound" });
    }
  });
});

describe("isValidSlug", () => {
  it("accepts lowercase slugs and rejects anything else", () => {
    expect(isValidSlug("sb-admin-2")).toBe(true);
    for (const bad of ["", "SB", "a/b", "..", "-x", "a b", "x".repeat(81)]) expect(isValidSlug(bad)).toBe(false);
  });
});

describe("redirectLocation", () => {
  it("encodes non-ASCII paths for the Location header, without double-encoding", async () => {
    const { redirectLocation } = await import("@/lib/dashboards/serve");
    expect(redirectLocation("https://cdn.jsdelivr.net/gh/a/b@c/audio/海阔天空.mp3")).toBe(
      "https://cdn.jsdelivr.net/gh/a/b@c/audio/%E6%B5%B7%E9%98%94%E5%A4%A9%E7%A9%BA.mp3",
    );
    expect(redirectLocation("/demos/x/a%20b.png")).toBe("/demos/x/a%20b.png");
    expect(redirectLocation("/demos/x/a b.png")).toBe("/demos/x/a%20b.png");
  });
});

describe("resolveDemoPath - encoded traversal towards jsDelivr", () => {
  const missing = () => false;

  it("refuses double-encoded segments (they would decode to .. in the redirect)", () => {
    expect(resolveDemoPath(staticInfo, ["%2e%2e", "%2e%2e", "x.js"], missing)).toEqual({ kind: "notfound" });
    expect(resolveDemoPath(staticInfo, ["a%2fb.js"], missing)).toEqual({ kind: "notfound" });
  });

  it("never redirects outside the dashboard's repo folder", () => {
    const escaping = { ...spaInfo, cdnMap: { "x.js": "../../npm/evil/x.js" } };
    expect(resolveDemoPath(escaping, ["x.js"], missing)).toEqual({ kind: "notfound" });
  });
});
