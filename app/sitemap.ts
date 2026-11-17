import type { MetadataRoute } from "next";
import { getAllTemplates } from "@/lib/templates";
import { getCatalog } from "@/lib/catalog/library";
import { componentHref, componentTypeOf } from "@/lib/catalog/components";
import { getDashboards } from "@/lib/dashboards";
import { GSAP_SITES } from "@/lib/gsap/sites";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [templates, dashboards, catalog] = await Promise.all([getAllTemplates(), getDashboards(), getCatalog().catch(() => null)]);

  // Real dates only. Stamping every page with the build time tells search
  // engines that all 7,000 pages changed on each deploy, and they stop
  // trusting the dates. The catalog and each dashboard record when they were
  // last refreshed; pages with no such record give no date.
  // An unreadable date becomes "no date": the sitemap writer throws on one.
  const dateOf = (value: string | null | undefined): Date | undefined => {
    const d = value ? new Date(value) : undefined;
    return d && !Number.isNaN(d.getTime()) ? d : undefined;
  };
  const catalogDate = dateOf(catalog?.generatedAt);
  const dashboardDates = dashboards.map((d) => dateOf(d.importedAt)).filter((d): d is Date => !!d);
  const newestDashboard = dashboardDates.length ? new Date(Math.max(...dashboardDates.map((d) => d.getTime()))) : undefined;
  // The GSAP sites carry the date each was added.
  const gsapDates = GSAP_SITES.map((s) => dateOf(s.added)).filter((d): d is Date => !!d);
  const newestGsap = gsapDates.length ? new Date(Math.max(...gsapDates.map((d) => d.getTime()))) : undefined;
  const dataDates = [catalogDate, newestDashboard, newestGsap].filter((d): d is Date => !!d);
  // The home page shows every library, so it changed when any of them did.
  const newest = dataDates.length ? new Date(Math.max(...dataDates.map((d) => d.getTime()))) : undefined;

  const fixed: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: newest, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/gallery`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/gallery/dashboards`, lastModified: newestDashboard, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/gallery/components`, lastModified: catalogDate, changeFrequency: "weekly", priority: 0.9 },
    // The GSAP gallery is listed only once it has a site in it.
    ...(GSAP_SITES.length ? [{ url: `${SITE_URL}/gallery/gsap`, lastModified: newestGsap, changeFrequency: "weekly" as const, priority: 0.9 }] : []),
    { url: `${SITE_URL}/build`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/playground`, changeFrequency: "monthly", priority: 0.8 },
  ];

  const templatePages: MetadataRoute.Sitemap = templates.map((t) => ({
    url: `${SITE_URL}/t/${t.slug}`,
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  // Every component, section and screen with a working preview.
  const componentPages: MetadataRoute.Sitemap = (catalog?.items ?? [])
    .filter((i) => componentTypeOf(i) !== null)
    .map((i) => ({
      url: `${SITE_URL}${componentHref(i.id)}`,
      lastModified: catalogDate,
      changeFrequency: "monthly" as const,
      priority: i.kind === "component" ? 0.3 : 0.4,
    }));

  const dashboardPages: MetadataRoute.Sitemap = dashboards.map((d) => ({
    url: `${SITE_URL}/d/${d.slug}`,
    lastModified: dateOf(d.importedAt),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  // Each GSAP site is a page of its own.
  const gsapPages: MetadataRoute.Sitemap = GSAP_SITES.map((s) => ({
    url: `${SITE_URL}${s.liveHref}`,
    lastModified: dateOf(s.added),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  return [...fixed, ...templatePages, ...dashboardPages, ...gsapPages, ...componentPages];
}
