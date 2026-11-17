import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getGalleryTabs } from "@/lib/gallery/sections";
import { GSAP_SITES } from "@/lib/gsap/sites";

// The fourth library (GSAP sites). While lib/gsap/sites.ts is empty its tab
// must say "Soon" and never show a count of 0, and it must not be offered as
// something that is live. With a site in the list the tab is an ordinary one
// with a count, and every site listed has to be complete: its page, its
// code, its card image, its check and its credits.

const root = path.join(__dirname, "..");

describe("GSAP section", () => {
  it("has a tab, after the three open libraries", async () => {
    const tabs = await getGalleryTabs();
    expect(tabs.slice(0, 4).map((t) => t.id)).toEqual(["landing", "dashboards", "components", "gsap"]);
    const gsap = tabs.find((t) => t.id === "gsap")!;
    expect(gsap.href).toBe("/gallery/gsap");
    expect(gsap.count).toBe(GSAP_SITES.length);
  });

  it("says Soon exactly while it is empty", async () => {
    const gsap = (await getGalleryTabs()).find((t) => t.id === "gsap")!;
    expect(!!gsap.soon).toBe(GSAP_SITES.length === 0);
  });

  it("only the GSAP tab can be shown empty", async () => {
    const tabs = await getGalleryTabs();
    expect(tabs.filter((t) => t.soon).map((t) => t.id)).toEqual(GSAP_SITES.length === 0 ? ["gsap"] : []);
    for (const t of tabs) if (!t.soon && t.id !== "landing" && t.id !== "community") expect(t.count).toBeGreaterThan(0);
  });

  it("the navigation shows Soon in place of the count", () => {
    const nav = readFileSync(path.join(root, "components/site/SiteNav.tsx"), "utf8");
    expect(nav).toContain('{t.soon ? "Soon" : compact(t.count)}');
  });

  it("the not-found page offers only sections that are open", () => {
    const page = readFileSync(path.join(root, "app/not-found.tsx"), "utf8");
    expect(page).toContain("tabs.filter((t) => !t.soon)");
  });

  it("its page is kept out of search engines while it is empty", () => {
    const page = readFileSync(path.join(root, "app/gallery/gsap/page.tsx"), "utf8");
    expect(page).toMatch(/GSAP_SITES\.length === 0 \? \{ robots: \{ index: false, follow: true \} \}/);
    const sitemap = readFileSync(path.join(root, "app/sitemap.ts"), "utf8");
    expect(sitemap.includes("/gallery/gsap")).toBe(GSAP_SITES.length > 0);
  });

  it("every site listed is complete and has its own address", () => {
    const slugs = GSAP_SITES.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of GSAP_SITES) {
      expect(s.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(s.title.trim().length).toBeGreaterThan(0);
      expect(s.blurb.trim().length).toBeGreaterThan(0);
      expect(s.thumb.startsWith("/")).toBe(true);
      expect(s.liveHref.startsWith("/")).toBe(true);
      expect(Number.isNaN(Date.parse(s.added))).toBe(false);
    }
  });

  // Every file of a site's own code, as text.
  const sourceOf = (slug: string) => {
    const dir = path.join(root, "components/gsap", slug);
    const walk = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(path.join(d, n)).isDirectory() ? walk(path.join(d, n)) : [path.join(d, n)]));
    return walk(dir).filter((f) => /\.(ts|tsx|css)$/.test(f)).map((f) => ({ file: path.relative(root, f), text: readFileSync(f, "utf8") }));
  };

  it("every site listed has its page, its code, its card image and its check", () => {
    for (const s of GSAP_SITES) {
      expect(s.liveHref).toBe(`/gallery/gsap/${s.slug}`);
      expect(existsSync(path.join(root, "app/gallery/gsap", s.slug, "page.tsx")), `${s.slug}: page`).toBe(true);
      expect(existsSync(path.join(root, "components/gsap", s.slug, "content.ts")), `${s.slug}: code`).toBe(true);
      expect(existsSync(path.join(root, "public", s.thumb)), `${s.slug}: card image`).toBe(true);
      expect(existsSync(path.join(root, "public/assets/gsap", s.slug)), `${s.slug}: assets`).toBe(true);
      expect(existsSync(path.join(root, "scripts/gsap", `verify-${s.slug}.mjs`)), `${s.slug}: check`).toBe(true);
    }
  });

  it("a site's chips name only what it uses: none of them uses ScrollTrigger", () => {
    for (const s of GSAP_SITES) {
      const uses = sourceOf(s.slug).some((f) => /from ['"]gsap\/ScrollTrigger['"]|registerPlugin\(/.test(f.text));
      if (!uses) expect(s.techniques.join(" ")).not.toMatch(/ScrollTrigger/i);
    }
  });

  it("a site's folder stands on its own: only its page wrapper reaches outside it", () => {
    for (const s of GSAP_SITES) {
      for (const f of sourceOf(s.slug)) {
        const outside = Array.from(f.text.matchAll(/from ['"]([^'"]+)['"]/g), (m) => m[1]).filter((spec) => !spec.startsWith("./") && !spec.startsWith("../") && spec !== "gsap" && spec !== "react");
        if (/Route\.tsx$/.test(f.file)) expect(outside.sort()).toEqual(["@/lib/fullscreen", "next/navigation"]);
        else expect(outside, f.file).toEqual([]);
        // Up and out of its own folder is outside too.
        const depth = f.file.split("/").length - 4;
        for (const m of f.text.matchAll(/from ['"]((?:\.\.\/)+)/g)) expect(m[1].length / 3, f.file).toBeLessThanOrEqual(depth);
      }
    }
  });

  it("a site names, credits and links to nobody: it only says it is a concept", () => {
    for (const s of GSAP_SITES) {
      const files = sourceOf(s.slug);
      for (const f of files) {
        expect(f.text, f.file).not.toMatch(/akella|inmotion|aimdropin|aim dropin/i);
        // No address but the XML namespace an SVG is made with.
        expect(f.text.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, ""), f.file).not.toMatch(/https?:\/\//);
      }
      expect(files.find((f) => f.file.endsWith("content.ts"))!.text).toMatch(/concept/i);
    }
  });

  it("each site's assets are where its code looks for them", () => {
    for (const s of GSAP_SITES) {
      const files = sourceOf(s.slug);
      const content = files.find((f) => f.file.endsWith("content.ts"))!.text;
      expect(content).toContain(`assets: '/assets/gsap/${s.slug}'`);
      const fonts = files.filter((f) => f.file.endsWith(".css")).flatMap((f) => Array.from(f.text.matchAll(/url\('([^']+)'\)/g), (m) => m[1]));
      expect(fonts.length).toBeGreaterThan(0);
      for (const url of fonts) {
        expect(url.startsWith(`/assets/gsap/${s.slug}/fonts/`), url).toBe(true);
        expect(existsSync(path.join(root, "public", url)), url).toBe(true);
      }
      // Every font comes with its licence.
      expect(readdirSync(path.join(root, "public/assets/gsap", s.slug, "fonts")).some((n) => n.startsWith("OFL-"))).toBe(true);
    }
  });

  it("GSAP is installed, credited, and never called MIT or open source", () => {
    if (GSAP_SITES.length === 0) return;
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
    expect(pkg.dependencies.gsap).toBeTruthy();
    const notices = readFileSync(path.join(root, "THIRD_PARTY_NOTICES.md"), "utf8");
    expect(notices).toContain("https://gsap.com/standard-license");
    expect(notices).toMatch(/OpenStreetMap contributors/);
    expect(notices).toMatch(/Natural Earth/);
    for (const font of ["Archivo", "Overpass", "Jost"]) expect(notices).toContain(font);
    const page = readFileSync(path.join(root, "app/gallery/gsap/page.tsx"), "utf8");
    expect(page).toContain("https://gsap.com/standard-license");
    for (const text of [page, readFileSync(path.join(root, "README.md"), "utf8"), notices]) {
      expect(text).not.toMatch(/GSAP (is|itself is) (MIT|open source)/i);
    }
  });

  it("the sitemap lists each site, and the gallery page may be kept by the CDN", () => {
    const sitemap = readFileSync(path.join(root, "app/sitemap.ts"), "utf8");
    expect(sitemap).toContain("GSAP_SITES.map((s) => ({");
    expect(sitemap).toContain("url: `${SITE_URL}${s.liveHref}`");
    const config = readFileSync(path.join(root, "next.config.js"), "utf8");
    expect(config).toContain('"/gallery/:section(dashboards|components|gsap|search)"');
  });
});
