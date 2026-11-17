// Map each kind of gallery item onto a GalleryCard.

import type { TemplateKind, TemplateSummary } from "@/lib/templates";
import type { DashboardRecord } from "@/lib/dashboards/types";
import type { GalleryCard } from "./types";

export function templateCard(t: TemplateSummary, hasThumb: boolean, kindPref: TemplateKind): GalleryCard {
  const q = kindPref === "html" ? "?kind=html" : "";
  const num = t.slug.match(/^(\d+)/);
  return {
    key: t.slug,
    title: t.title,
    subtitle: t.category,
    thumb: hasThumb ? `/thumbs/${t.slug}.webp` : null,
    chips: [t.kind === "jsx" ? { label: "JSX", accent: true } : { label: "HTML" }],
    selectHref: `/t/${t.slug}${q}`,
    previewHref: `/preview/${t.slug}${q}`,
    facets: { category: t.category, style: t.style ?? null },
    search: [t.title, t.slug, t.category, (t.tags || []).join(" "), t.description].join(" ").toLowerCase(),
    number: num ? Number(num[1]) : undefined,
  };
}

export const FRAMEWORK_LABELS: Record<string, string> = {
  html: "HTML",
  react: "React",
  next: "Next.js",
  vue: "Vue",
  nuxt: "Nuxt",
  angular: "Angular",
  svelte: "Svelte",
  sveltekit: "SvelteKit",
  solid: "Solid",
  astro: "Astro",
  qwik: "Qwik",
};

export const UI_LABELS: Record<string, string> = {
  bootstrap: "Bootstrap",
  tailwind: "Tailwind",
  shadcn: "shadcn/ui",
  mui: "MUI",
  chakra: "Chakra UI",
  antd: "Ant Design",
  mantine: "Mantine",
  tremor: "Tremor",
  "element-plus": "Element Plus",
  vuetify: "Vuetify",
  naive: "Naive UI",
  primevue: "PrimeVue",
  primeng: "PrimeNG",
  "ant-design-vue": "Ant Design Vue",
  nebular: "Nebular",
  bulma: "Bulma",
  daisyui: "daisyUI",
  flowbite: "Flowbite",
  material: "Material",
  other: "Other",
};

export function frameworkLabel(id: string): string {
  return FRAMEWORK_LABELS[id] ?? id;
}

export function uiLabel(id: string): string {
  return UI_LABELS[id] ?? id;
}

export function dashboardCard(d: DashboardRecord): GalleryCard {
  const stack = frameworkLabel(d.framework);
  const ui = uiLabel(d.ui);
  const pages = d.pages.length;
  return {
    key: d.slug,
    title: d.title,
    subtitle: `${stack} · ${ui} · ${pages} ${pages === 1 ? "page" : "pages"}`,
    thumb: d.thumb,
    chips: [d.framework === "html" ? { label: stack } : { label: stack, accent: true }, { label: ui }],
    selectHref: `/d/${d.slug}`,
    previewHref: `/d/${d.slug}/live`,
    touchHref: `/d/${d.slug}`,
    facets: { stack, ui, category: d.category },
    search: [d.title, d.slug, stack, ui, d.category, d.tags.join(" "), d.description, d.author].join(" ").toLowerCase(),
    rank: d.quality,
  };
}
