// The gallery's Components section: every catalog item whose preview works,
// except our own templates (Landing pages) and whole-app GitHub templates
// (Dashboards). Thousands of items, so filtering and paging happen on the
// server; the client gallery asks /api/gallery/components for a page.

import { diversify, getCatalog, heuristicScore, type LibraryItem } from "./library";
import { getCatalogPopularity } from "./popularity";
import type { FacetGroup, GalleryCard } from "@/lib/gallery/types";

export type ComponentType = "component" | "section" | "screen";

const TYPE_LABEL: Record<ComponentType, string> = { component: "Components", section: "Sections", screen: "Screens" };
const KIND_WORD: Record<ComponentType, string> = { component: "Component", section: "Section", screen: "Screen" };
const TYPE_ORDER = ["Components", "Sections", "Screens"];
const STACK_ORDER = ["React", "HTML"];
const MAX_CATEGORIES = 30;

export function componentTypeOf(i: LibraryItem): ComponentType | null {
  if (i.editorSlug || i.src === "aimdropin" || i.src === "community") return null;
  if (i.install?.method === "clone") return null;
  if (i.preview !== "ok") return null;
  const tab = i.tab ?? (i.kind === "page" ? "screen" : i.kind);
  if (tab === "component") return "component";
  if (tab === "section") return "section";
  return "screen";
}

const PLURAL: Record<string, string> = {
  button: "buttons",
  card: "cards",
  badge: "badges",
  alert: "alerts",
  checkbox: "checkboxes",
  input: "inputs",
  form: "forms",
  switch: "switches",
  toggle: "toggles",
  radio: "radios",
  tooltip: "tooltips",
  footer: "footers",
  header: "headers",
  navbar: "navbars",
  sidebar: "sidebars",
  notification: "notifications",
  accordion: "accordions",
  modal: "modals",
  dialog: "dialogs",
  tab: "tabs",
  table: "tables",
  loader: "loaders",
  spinner: "loaders",
  testimonial: "testimonials",
  feature: "features",
  stat: "stats",
  avatar: "avatars",
  menu: "menus",
  dropdown: "dropdowns",
  pagination: "pagination",
  breadcrumb: "breadcrumbs",
  slider: "sliders",
  select: "selects",
  textarea: "textareas",
  toast: "toasts",
  icon: "icons",
};
const DISPLAY: Record<string, string> = { cta: "CTA", faq: "FAQ", ui: "UI", ai: "AI" };

/** One readable label per category ("button" and "buttons" → "Buttons"); null to drop it. */
export function normalizeCategory(raw: string): string | null {
  let c = raw.trim().toLowerCase();
  if (!c || c === "other" || c === "misc" || c === "general") return null;
  if (c === "chart" || c.startsWith("chart-") || c.startsWith("charts")) c = "charts";
  c = PLURAL[c] ?? c;
  return c
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => DISPLAY[w] ?? w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function categoriesOf(i: LibraryItem): string[] {
  const out: string[] = [];
  for (const c of i.cats) {
    const n = normalizeCategory(c);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

export function componentHref(id: string): string {
  return `/c/${id.split("/").map(encodeURIComponent).join("/")}`;
}

export function componentCard(i: LibraryItem, labels: Map<string, string>): GalleryCard {
  const type = componentTypeOf(i) ?? (i.kind === "section" ? "section" : i.kind === "page" ? "screen" : "component");
  const source = labels.get(i.src) ?? i.src;
  const html = i.stack === "html";
  const cats = categoriesOf(i);
  const href = componentHref(i.id);
  return {
    key: i.id,
    title: i.title,
    subtitle: `${source} · ${KIND_WORD[type]}`,
    thumb: i.thumb,
    chips: [html ? { label: "HTML" } : { label: "React", accent: true }],
    selectHref: href,
    previewHref: `${href}/preview`,
    touchHref: href,
    facets: { type: TYPE_LABEL[type], stack: html ? "HTML" : "React", source, category: cats[0] ?? null },
    search: [i.title, i.name, source, KIND_WORD[type], cats.join(" "), i.desc ?? "", i.author ?? ""].join(" ").toLowerCase(),
  };
}

// Unfiltered "Popular": components lead, with sections and screens mixed
// in (whole screens would otherwise crowd the top: they score higher).
const TYPE_PATTERN: ComponentType[] = ["component", "component", "section", "component", "screen", "section"];

function interleaveTypes(scored: Array<{ item: LibraryItem; score: number }>): void {
  const queues: Record<ComponentType, Array<{ item: LibraryItem; score: number }>> = { component: [], section: [], screen: [] };
  for (const s of scored) queues[componentTypeOf(s.item) ?? "component"].push(s);
  const out: typeof scored = [];
  let k = 0;
  while (out.length < scored.length) {
    const want = TYPE_PATTERN[k++ % TYPE_PATTERN.length];
    const next = queues[want].shift() ?? queues.component.shift() ?? queues.section.shift() ?? queues.screen.shift();
    if (next) out.push(next);
  }
  scored.splice(0, scored.length, ...out);
}

export interface ComponentSelection {
  active: { facet: string; value: string } | null;
  sort: "popular" | "az";
  page: number;
  pageSize: number;
}

export interface ComponentPage {
  cards: GalleryCard[];
  total: number;
  page: number;
  pageSize: number;
  // Counts follow the search only (one pill active at a time).
  counts: { all: number; byFacet: Record<string, number> };
  facets: FacetGroup[];
}

/** Facet counts, one-pill filter, sort and paging over already-searched items. */
export function selectComponents(
  items: LibraryItem[],
  labels: Map<string, string>,
  sel: ComponentSelection,
  score: (i: LibraryItem) => number,
): ComponentPage {
  const rows = items
    .map((i) => ({ i, type: componentTypeOf(i) }))
    .filter((r): r is { i: LibraryItem; type: ComponentType } => r.type !== null)
    .map(({ i, type }) => ({
      i,
      values: {
        type: [TYPE_LABEL[type]],
        stack: [i.stack === "html" ? "HTML" : "React"],
        source: [labels.get(i.src) ?? i.src],
        category: categoriesOf(i),
      } as Record<string, string[]>,
    }));

  const byFacet: Record<string, number> = {};
  for (const r of rows) {
    for (const [facet, vals] of Object.entries(r.values)) {
      for (const v of vals) byFacet[`${facet}:${v}`] = (byFacet[`${facet}:${v}`] ?? 0) + 1;
    }
  }

  const active = sel.active;
  const filtered = active ? rows.filter((r) => (r.values[active.facet] ?? []).includes(active.value)) : rows;
  const scored = filtered.map((r) => ({ item: r.i, score: score(r.i) }));
  if (sel.sort === "az") {
    scored.sort((a, b) => a.item.title.localeCompare(b.item.title));
  } else {
    scored.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title));
    if (active?.facet !== "source") diversify(scored);
    if (!active) interleaveTypes(scored);
  }

  const pageSize = Math.min(Math.max(sel.pageSize, 1), 96);
  const page = Math.max(sel.page, 1);
  const start = (page - 1) * pageSize;

  const valuesOf = (facet: string) =>
    Object.entries(byFacet)
      .filter(([k]) => k.startsWith(`${facet}:`))
      .map(([k, n]) => [k.slice(facet.length + 1), n] as const);
  const bySize = (facet: string, limit = Infinity) =>
    valuesOf(facet)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([v]) => v);
  const fixed = (facet: string, order: string[]) => order.filter((v) => (byFacet[`${facet}:${v}`] ?? 0) > 0);

  return {
    cards: scored.slice(start, start + pageSize).map((s) => componentCard(s.item, labels)),
    total: scored.length,
    page,
    pageSize,
    counts: { all: rows.length, byFacet },
    facets: [
      { id: "type", label: "Type", values: fixed("type", TYPE_ORDER) },
      { id: "stack", label: "Stack", values: fixed("stack", STACK_ORDER) },
      { id: "source", label: "Source", values: bySize("source") },
      { id: "category", label: "Category", values: bySize("category", MAX_CATEGORIES) },
    ],
  };
}

export interface ComponentQuery {
  q?: string;
  sort?: "popular" | "az";
  facet?: string;
  value?: string;
  page?: number;
  pageSize?: number;
}

export async function queryComponents(query: ComponentQuery): Promise<ComponentPage> {
  const cat = await getCatalog();
  const q = query.q?.trim() ?? "";
  let base: LibraryItem[] = cat.items;
  let relevance: Map<string, number> | null = null;
  if (q) {
    const hits = cat.search.search(q);
    relevance = new Map(hits.map((h) => [String(h.id), h.score]));
    base = hits.map((h) => cat.byId.get(String(h.id))).filter((x): x is LibraryItem => !!x);
  }
  const pop = (await getCatalogPopularity())?.scores;
  const score = (i: LibraryItem) =>
    relevance
      ? (relevance.get(i.id) ?? 0) * 10 + heuristicScore(i) * 0.2
      : heuristicScore(i) + (pop?.get(i.id) ?? 0) * 10;
  const facetIds = new Set(["type", "stack", "source", "category"]);
  const active = query.facet && facetIds.has(query.facet) && query.value ? { facet: query.facet, value: query.value } : null;
  return selectComponents(base, cat.sourceLabel, { active, sort: query.sort ?? "popular", page: query.page ?? 1, pageSize: query.pageSize ?? 48 }, score);
}
