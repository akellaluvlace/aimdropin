import "server-only";
import { getAllTemplates, getCategories, getStyles, getThumbSlugs } from "@/lib/templates";
import { getDashboards } from "@/lib/dashboards";
import { componentCard, componentTypeOf, queryComponents } from "@/lib/catalog/components";
import { getLibraryItem, getLibrarySources } from "@/lib/catalog/library";
import { dashboardCard, frameworkLabel, templateCard, uiLabel } from "@/lib/gallery/cards";
import { LANDING_PICKS } from "@/lib/gallery/picks";
import type { GalleryCard } from "@/lib/gallery/types";
import type { StageCard, StageDashboard } from "./HeroStage";

// Everything the landing page shows, read from the same data as the
// gallery so every count and thumbnail stays live.

// The hero slideshow: one striking dashboard per stack.
const STAGE_SLUGS = ["adminlte-4-html", "argon-dashboard-react", "tremor-insights", "vben-admin", "ng-matero", "shadboard"];
// The dashboards panel mosaic.
const MOSAIC_SLUGS = ["coreui-angular", "black-dashboard-react", "mazer", "vue-pure-admin"];
// Components with strong thumbnails, for the panel and the gallery lanes.
// Missing ids are skipped and the popular list fills in.
const COMPONENT_PICKS = [
  "@motion-primitives/glow-effect",
  "@uiable/block-coming-soon-2",
  "@kokonutui/caustics-background",
  "@magicui/animated-circular-progress-bar",
  "@kokonutui/cradle-text",
  "@intentui/chart-03",
  "@kokonutui/activity-terrain",
  "@cult-ui/apple-keyboard",
  "@kokonutui/currency-transfer",
  "hyperui/hyperui-footers-call-to-action-with-gradient-dark",
  "@magicui/animated-gradient-text-demo-2",
  "@shadcn-space/chart-01",
  "@cult-ui/apple-iphone-17-pro-demo",
  "@magicui/android-demo-3",
  "@eldoraui/pricing-01",
  "@uiable/block-contact",
  "@shadcn-space/chat-application-01",
  "@cult-ui/agent-suggest-card-stack",
  "uiverse/uiverse-cards-codewithvinay-afraid-dodo-14",
  "@magicui/animated-beam-demo",
  "@shadcn-space/bento-grid-03",
  "@kokonutui/background-paths",
  "@eldoraui/features-01",
  "@kokonutui/clip-trimmer",
];
const HERO_LANDING = "4-ai-product-landing";
// The landing-pages panel fan: light, poster, dark photo.
const FAN_SLUGS = ["17-single-product-dtc", "65-typographic-swiss-poster", "88-fitness-wellness"];
const HERO_COMPONENT = "@motion-primitives/glow-effect";

const STACK_ORDER = ["html", "react", "next", "vue", "nuxt", "angular", "svelte", "sveltekit"];

export interface Count {
  label: string;
  count: number;
  href?: string;
}

export interface LandingData {
  counts: { landing: number; dashboards: number; components: number; dashboardPages: number; sources: number };
  stage: { dashboards: StageDashboard[]; landing: StageCard | null; component: StageCard | null };
  dashboards: { mosaic: GalleryCard[]; stacks: Count[]; uiKits: Count[] };
  landing: { fan: GalleryCard[]; categories: Count[]; styles: Count[] };
  components: { grid: GalleryCard[]; types: Count[]; sources: Count[] };
  lanes: GalleryCard[][];
}

// Cards cross into client components (the lanes); their search text isn't
// needed there.
const slim = (c: GalleryCard): GalleryCard => ({ ...c, search: "" });

export async function getLandingData(): Promise<LandingData> {
  const [templates, categories, styles, thumbs, dashboards, componentPage, sources] = await Promise.all([
    getAllTemplates(),
    getCategories(),
    getStyles(),
    getThumbSlugs(),
    getDashboards(),
    queryComponents({ pageSize: 48 }),
    getLibrarySources(),
  ]);

  // ---- Dashboards
  const bySlug = new Map(dashboards.map((d) => [d.slug, d]));
  const stageDashboards: StageDashboard[] = STAGE_SLUGS.map((s) => bySlug.get(s))
    .filter((d): d is NonNullable<typeof d> => !!d && !!d.thumb)
    .map((d) => ({
      slug: d.slug,
      title: d.title,
      thumb: d.thumb as string,
      stack: frameworkLabel(d.framework),
      ui: uiLabel(d.ui),
      pages: d.pages.length,
    }));
  const mosaic = MOSAIC_SLUGS.map((s) => bySlug.get(s))
    .filter((d): d is NonNullable<typeof d> => !!d && !!d.thumb)
    .map((d) => slim(dashboardCard(d)));

  const stackCounts = new Map<string, number>();
  const uiCounts = new Map<string, number>();
  for (const d of dashboards) {
    stackCounts.set(d.framework, (stackCounts.get(d.framework) ?? 0) + 1);
    uiCounts.set(d.ui, (uiCounts.get(d.ui) ?? 0) + 1);
  }
  // Svelte and SvelteKit read as one stack here.
  const svelte = (stackCounts.get("svelte") ?? 0) + (stackCounts.get("sveltekit") ?? 0);
  const stacks: Count[] = STACK_ORDER.filter((id) => id !== "sveltekit" && (id === "svelte" ? svelte > 0 : (stackCounts.get(id) ?? 0) > 0)).map((id) => {
    const label = frameworkLabel(id);
    return { label, count: id === "svelte" ? svelte : (stackCounts.get(id) ?? 0), href: `/gallery/dashboards?q=${encodeURIComponent(label)}` };
  });
  const uiKits: Count[] = Array.from(uiCounts.entries())
    .filter(([id]) => id !== "other")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([id, count]) => ({ label: uiLabel(id), count }));

  // ---- Landing pages
  const summaries = templates.map(({ source: _source, ...meta }) => meta);
  const withThumb = summaries.filter((t) => thumbs.has(t.slug));
  const landingBySlug = new Map(withThumb.map((t) => [t.slug, t]));
  const landingCards = [
    ...LANDING_PICKS.map((s) => landingBySlug.get(s)).filter((t): t is NonNullable<typeof t> => !!t),
    ...withThumb.filter((t) => !LANDING_PICKS.includes(t.slug)),
  ].map((t) => slim(templateCard(t, true, "jsx")));
  const heroLanding = landingBySlug.get(HERO_LANDING) ?? withThumb[0];
  const count = (key: "category" | "style", value: string) => summaries.filter((t) => t[key] === value).length;
  const categoryCounts: Count[] = categories
    .map((c) => ({ label: c, count: count("category", c) }))
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);
  const styleCounts: Count[] = styles
    .map((s) => ({ label: s, count: count("style", s) }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);

  // ---- Components
  const labels = new Map(sources.map((s) => [s.id, s.label]));
  const picked: GalleryCard[] = [];
  for (const id of COMPONENT_PICKS) {
    const item = await getLibraryItem(id);
    if (item && componentTypeOf(item) && item.thumb) picked.push(slim(componentCard(item, labels)));
  }
  const pickedKeys = new Set(picked.map((c) => c.key));
  const componentCards = [...picked, ...componentPage.cards.filter((c) => c.thumb && !pickedKeys.has(c.key)).map(slim)];
  const heroComponent = componentCards.find((c) => c.key === HERO_COMPONENT) ?? componentCards[0];
  const facet = (prefix: string) =>
    Object.entries(componentPage.counts.byFacet)
      .filter(([k]) => k.startsWith(`${prefix}:`))
      .map(([k, n]) => ({ label: k.slice(prefix.length + 1), count: n }))
      .sort((a, b) => b.count - a.count);
  const sourceCounts = facet("source");
  const typeCounts = facet("type");

  const dashboardLane = [
    ...dashboards.filter((d) => d.quality >= 5 && d.thumb),
    ...dashboards.filter((d) => d.quality === 4 && d.thumb).slice(0, 8),
  ].map((d) => slim(dashboardCard(d)));

  return {
    counts: {
      landing: templates.length,
      dashboards: dashboards.length,
      components: componentPage.counts.all,
      dashboardPages: dashboards.reduce((n, d) => n + d.pages.length, 0),
      sources: sourceCounts.length,
    },
    stage: {
      dashboards: stageDashboards,
      landing: heroLanding ? { title: heroLanding.title, thumb: `/thumbs/${heroLanding.slug}.webp`, href: `/t/${heroLanding.slug}`, label: "Landing page" } : null,
      component: heroComponent?.thumb ? { title: heroComponent.title, thumb: heroComponent.thumb, href: heroComponent.selectHref, label: "Component" } : null,
    },
    dashboards: { mosaic, stacks, uiKits },
    landing: {
      fan: (FAN_SLUGS.every((s) => landingBySlug.has(s))
        ? FAN_SLUGS.map((s) => landingBySlug.get(s)!).map((t) => slim(templateCard(t, true, "jsx")))
        : landingCards.slice(0, 3)),
      categories: categoryCounts,
      styles: styleCounts,
    },
    components: { grid: componentCards.slice(0, 6), types: typeCounts, sources: sourceCounts.slice(0, 8) },
    lanes: [dashboardLane.slice(0, 24), landingCards.slice(0, 24), componentCards.slice(0, 24)],
  };
}
